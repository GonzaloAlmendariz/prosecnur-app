.session_env <- new.env(parent = emptyenv())

session_root_dir <- function() {
  root <- file.path(tempdir(), "pulso-report")
  if (!dir.exists(root)) dir.create(root, recursive = TRUE)
  root
}

session_create <- function() {
  sid <- uuid::UUIDgenerate()
  sdir <- file.path(session_root_dir(), sid)
  for (sub in c("uploads", "state", "jobs", "downloads")) {
    dir.create(file.path(sdir, sub), recursive = TRUE, showWarnings = FALSE)
  }
  .session_env[[sid]] <- list(
    id = sid,
    created_at = Sys.time(),
    dir = sdir,
    files = list(),
    instrumento = NULL,
    data_raw = NULL
  )
  sid
}

session_get <- function(sid, required = TRUE) {
  if (is.null(sid) || !nzchar(sid)) {
    if (required) stop_api(404, "E_NO_SESSION", "Missing X-Pulso-Session header.")
    return(NULL)
  }
  s <- .session_env[[sid]]
  if (is.null(s) && required) {
    stop_api(404, "E_NO_SESSION", sprintf("Session %s not found.", sid))
  }
  s
}

session_set <- function(sid, key, value) {
  s <- session_get(sid)
  s[[key]] <- value
  .session_env[[sid]] <- s
  invisible(value)
}

session_delete <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(FALSE)
  unlink(s$dir, recursive = TRUE, force = TRUE)
  rm(list = sid, envir = .session_env)
  TRUE
}

session_header <- function(req) {
  h <- req$HTTP_X_PULSO_SESSION
  if (is.null(h) || !nzchar(h)) NULL else h
}

# ===========================================================================
# MODELO DE ESTUDIO — multi-base (v0.2+)
# ===========================================================================
#
# Cada sesión mantiene un "estudio" con 1 a N bases (hasta 8 pragmático).
# Cada base es un par (instrumento, data) con un nombre identificador
# dentro del estudio.
#
# Estructura (campos nuevos bajo la misma `session_env[[sid]]`):
#
#   s$estudio = list(
#     nombre = "Acreditación PUCP" | NULL,
#     bases = list(
#       docentes = list(
#         nombre          = "docentes",
#         xlsform_file_id = "abc-...",   # del file store (save_upload)
#         data_file_id    = "xyz-...",
#         data_ext        = "sav",
#         n_filas         = 150,
#         n_columnas      = 42,
#         added_at        = Sys.time()
#       ),
#       ...
#     )
#   )
#
#   s$rp_data_sources = list(docentes = <df>, estudiantes = <df>, ...)
#   s$rp_inst_sources = list(docentes = <rp_inst>, estudiantes = <rp_inst>, ...)
#
# Back-compat:
#   s$rp_data / s$rp_inst se mantienen apuntando a la PRIMERA base para
#   que los routers que aún no migraron sigan funcionando single-base.
#   Cuando un router migra a multi-base, deja de leer esos campos y pasa
#   a usar s$rp_data_sources / s$rp_inst_sources.
#
#   Legacy también: s$analitica_fuente = "<fuente>:<nombre>" sigue siendo
#   string único; representa la fuente de la PRIMERA base del estudio.

# Tope pragmático de bases por estudio. 8 cubre los casos reales de
# acreditación (docentes/estudiantes/administrativos) y comparativos
# ("wave A" / "wave B" / etc.). Si se excede, el endpoint lo rechaza.
.ESTUDIO_MAX_BASES <- 8L

# Init del estudio si no existe. Llama internamente a session_set para
# persistir.
estudio_ensure <- function(sid) {
  s <- session_get(sid)
  if (is.null(s$estudio)) {
    s$estudio <- list(nombre = NULL, bases = list())
    s$rp_data_sources <- list()
    s$rp_inst_sources <- list()
    .session_env[[sid]] <- s
  }
  invisible(s$estudio)
}

# Devuelve la lista plana de bases del estudio.
estudio_list_bases <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s) || is.null(s$estudio)) return(list())
  s$estudio$bases
}

# Agrega una base al estudio. Parámetros:
#   - nombre: string único dentro del estudio (ej. "docentes").
#   - xlsform_file_id / data_file_id: identificadores del file store.
#   - data_ext: extensión del data ("xlsx" / "sav" / "csv") para que los
#     lectores sepan cómo abrirlo más adelante.
#   - rp_data / rp_inst: objetos R ya parseados (se guardan en los
#     maps paralelos _sources).
#   - n_filas / n_columnas: metadata de preview.
#
# Valida tope de bases y nombres únicos.
estudio_add_base <- function(sid, nombre, xlsform_file_id, data_file_id,
                              data_ext, rp_data, rp_inst,
                              n_filas = NA_integer_, n_columnas = NA_integer_) {
  estudio_ensure(sid)
  s <- session_get(sid)
  if (!is.character(nombre) || !nzchar(nombre)) {
    stop_api(400, "E_BASE_NOMBRE", "La base necesita un nombre identificador.")
  }
  if (grepl("\\$", nombre)) {
    # El `$` se usa como separador `fuente$variable` en los planes de
    # slides. Prohibirlo en nombres de base evita ambigüedad.
    stop_api(400, "E_BASE_NOMBRE_INVALIDO",
             sprintf("El nombre '%s' no puede contener '$'.", nombre))
  }
  if (nombre %in% names(s$estudio$bases)) {
    stop_api(409, "E_BASE_DUP", sprintf("Ya existe una base con nombre '%s' en este estudio.", nombre))
  }
  if (length(s$estudio$bases) >= .ESTUDIO_MAX_BASES) {
    stop_api(400, "E_BASE_LIMITE",
             sprintf("El estudio llegó al límite de %d bases.", .ESTUDIO_MAX_BASES))
  }

  s$estudio$bases[[nombre]] <- list(
    nombre          = nombre,
    xlsform_file_id = xlsform_file_id,
    data_file_id    = data_file_id,
    data_ext        = data_ext,
    n_filas         = n_filas,
    n_columnas      = n_columnas,
    added_at        = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  )
  s$rp_data_sources[[nombre]] <- rp_data
  s$rp_inst_sources[[nombre]] <- rp_inst

  # Back-compat: si esta es la primera base, espejar a rp_data/rp_inst.
  if (length(s$estudio$bases) == 1L) {
    s$rp_data <- rp_data
    s$rp_inst <- rp_inst
  }

  .session_env[[sid]] <- s
  invisible(s$estudio$bases[[nombre]])
}

# Elimina una base del estudio. Si se elimina la "primera" (la que
# espejaba a rp_data/rp_inst), se re-espeja a la siguiente que quede.
estudio_remove_base <- function(sid, nombre) {
  s <- session_get(sid)
  if (is.null(s$estudio) || is.null(s$estudio$bases[[nombre]])) {
    stop_api(404, "E_BASE_NOT_FOUND", sprintf("Base '%s' no existe en el estudio.", nombre))
  }
  s$estudio$bases[[nombre]] <- NULL
  s$rp_data_sources[[nombre]] <- NULL
  s$rp_inst_sources[[nombre]] <- NULL

  # Re-espejar si quedan bases; sino, limpiar los campos legacy.
  remaining <- names(s$estudio$bases)
  if (length(remaining) > 0L) {
    first <- remaining[1]
    s$rp_data <- s$rp_data_sources[[first]]
    s$rp_inst <- s$rp_inst_sources[[first]]
  } else {
    s$rp_data <- NULL
    s$rp_inst <- NULL
  }

  .session_env[[sid]] <- s
  invisible(TRUE)
}

# Renombra una base. No toca rp_data / rp_inst (son objetos R agnósticos
# al nombre dentro del estudio).
estudio_rename_base <- function(sid, nombre_actual, nombre_nuevo) {
  s <- session_get(sid)
  if (is.null(s$estudio) || is.null(s$estudio$bases[[nombre_actual]])) {
    stop_api(404, "E_BASE_NOT_FOUND", sprintf("Base '%s' no existe.", nombre_actual))
  }
  if (!is.character(nombre_nuevo) || !nzchar(nombre_nuevo) || grepl("\\$", nombre_nuevo)) {
    stop_api(400, "E_BASE_NOMBRE_INVALIDO",
             sprintf("Nombre nuevo inválido: '%s'.", nombre_nuevo))
  }
  if (nombre_nuevo %in% names(s$estudio$bases) && nombre_nuevo != nombre_actual) {
    stop_api(409, "E_BASE_DUP", sprintf("Ya hay una base con nombre '%s'.", nombre_nuevo))
  }
  if (nombre_nuevo == nombre_actual) return(invisible(FALSE))

  # Rename preservando orden: reconstruimos cada map en el mismo orden
  # pero cambiando la key.
  rename_key <- function(lst, old, new) {
    new_lst <- list()
    for (k in names(lst)) {
      new_k <- if (identical(k, old)) new else k
      new_lst[[new_k]] <- lst[[k]]
    }
    new_lst
  }
  s$estudio$bases <- rename_key(s$estudio$bases, nombre_actual, nombre_nuevo)
  s$estudio$bases[[nombre_nuevo]]$nombre <- nombre_nuevo
  s$rp_data_sources <- rename_key(s$rp_data_sources, nombre_actual, nombre_nuevo)
  s$rp_inst_sources <- rename_key(s$rp_inst_sources, nombre_actual, nombre_nuevo)

  .session_env[[sid]] <- s
  invisible(TRUE)
}

# Setea/limpia el nombre del estudio (opcional — solo metadata).
estudio_set_nombre <- function(sid, nombre) {
  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$nombre <- if (is.null(nombre) || !nzchar(nombre)) NULL else as.character(nombre)
  .session_env[[sid]] <- s
  invisible(s$estudio$nombre)
}

# Devuelve el map plano rp_data_sources. Si el estudio aún no se inicializó
# pero existe un legacy s$rp_data, lo envuelve en list(default = ...) para
# que los consumidores multi-base funcionen sin rupturas.
estudio_data_sources <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(list())
  if (!is.null(s$rp_data_sources) && length(s$rp_data_sources) > 0L) {
    return(s$rp_data_sources)
  }
  if (!is.null(s$rp_data)) return(list(default = s$rp_data))
  list()
}

estudio_inst_sources <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(list())
  if (!is.null(s$rp_inst_sources) && length(s$rp_inst_sources) > 0L) {
    return(s$rp_inst_sources)
  }
  if (!is.null(s$rp_inst)) return(list(default = s$rp_inst))
  list()
}
