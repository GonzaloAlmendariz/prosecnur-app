.session_env <- new.env(parent = emptyenv())

session_root_dir <- function() {
  root <- file.path(tempdir(), "prosecnur")
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
    data_raw = NULL,
    # Campos del archivo de proyecto .pulso. Si project_path es NULL la
    # sesión está en modo efímero (los cambios no se persisten). Cuando
    # hay un .pulso abierto, cada mutación de estado marca project_dirty
    # y el autosave del frontend dispara build_pulso cada 5 min.
    project_path = NULL,
    project_dirty = FALSE,
    project_last_saved_at = NULL
  )
  sid
}

# Helper privado: marca la sesión como "dirty" si tiene un .pulso abierto.
# Se llama desde todos los puntos que mutan estado relevante. NO marca si
# project_path es NULL (modo efímero — no hay proyecto al que escribir).
.mark_project_dirty <- function(s) {
  if (!is.null(s$project_path) && nzchar(s$project_path)) {
    s$project_dirty <- TRUE
  }
  s
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
  # Marcar dirty EXCEPTO para keys internas del propio sistema de proyecto
  # (sino se entraría en bucle: setear project_dirty vuelve a marcar dirty).
  if (!(key %in% c("project_path", "project_dirty", "project_last_saved_at"))) {
    s <- .mark_project_dirty(s)
  }
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
    s <- .mark_project_dirty(s)
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

  s <- .mark_project_dirty(s)
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

  s <- .mark_project_dirty(s)
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

  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(TRUE)
}

# Genera el próximo nombre automático libre dentro del estudio. Se usa
# cuando el usuario no especifica nombre al agregar base (flujo sin
# fricción de la Fase 1): `base_1`, `base_2`, …, saltando los que ya
# están tomados. Siempre retorna un nombre disponible dentro del tope.
# -----------------------------------------------------------------------------
# Validación v2 — scope por base dentro del estudio
# -----------------------------------------------------------------------------
# Cada base tiene su propio "workspace" de validación: plan, evaluación,
# reglas custom y caches. Se almacena en:
#   s$estudio$bases[[nombre]]$validacion = list(
#     plan_result,        # tibble del plan de reglas (instrumento + custom compiladas)
#     evaluacion,         # resultado de evaluar_consistencia()
#     reglas_custom,      # list de ReglaCustom (ver router_reglas_custom.R)
#     explorador_cache,   # hash -> view descriptors (lazy)
#     limpieza_draft,     # decisiones de cierre
#     limpieza_preview,   # preview before/after del borrador
#     limpieza_artifacts  # artefactos generados al finalizar
#   )
#
# Fallback legacy: si la sesión aún no tiene estudio pero sí rp_data, el
# scope apunta a la sesión entera (compatibilidad con flujo single-base
# antes de v0.2). Retorna list() si no hay nada aún.
validacion_scope_get <- function(sid, base_nombre = NULL, key = NULL) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(NULL)
  base_nombre <- .resolve_base_nombre(s, base_nombre)
  if (is.null(base_nombre)) {
    # Legacy single-base: usamos campos planos de la sesión.
    scope <- list(
      plan_result      = s$plan_result,
      evaluacion       = s$evaluacion,
      reglas_custom    = s$reglas_custom %||% list(),
      explorador_cache = s$explorador_cache %||% list(),
      limpieza_draft   = s$limpieza_draft %||% list(),
      limpieza_preview = s$limpieza_preview %||% NULL,
      limpieza_artifacts = s$limpieza_artifacts %||% list()
    )
  } else {
    scope <- s$estudio$bases[[base_nombre]]$validacion %||% list(
      plan_result      = NULL,
      evaluacion       = NULL,
      reglas_custom    = list(),
      explorador_cache = list(),
      limpieza_draft   = list(),
      limpieza_preview = NULL,
      limpieza_artifacts = list()
    )
  }
  if (is.null(key)) scope else scope[[key]]
}

validacion_scope_set <- function(sid, base_nombre = NULL, key, value) {
  s <- session_get(sid)
  base_nombre <- .resolve_base_nombre(s, base_nombre)
  if (is.null(base_nombre)) {
    # Fallback legacy: guardamos en la raíz de la sesión.
    s[[key]] <- value
  } else {
    if (is.null(s$estudio$bases[[base_nombre]]$validacion)) {
      s$estudio$bases[[base_nombre]]$validacion <- list(
        plan_result      = NULL,
        evaluacion       = NULL,
        reglas_custom    = list(),
        explorador_cache = list(),
        limpieza_draft   = list(),
        limpieza_preview = NULL,
        limpieza_artifacts = list()
      )
    }
    s$estudio$bases[[base_nombre]]$validacion[[key]] <- value
  }
  # Marcar dirty excepto para el cache (que se regenera al vuelo).
  if (!identical(key, "explorador_cache")) {
    s <- .mark_project_dirty(s)
  }
  .session_env[[sid]] <- s
  invisible(value)
}

.validacion_empty_scope <- function() {
  list(
    plan_result      = NULL,
    evaluacion       = NULL,
    reglas_custom    = list(),
    explorador_cache = list(),
    limpieza_draft   = list(),
    limpieza_preview = NULL,
    limpieza_artifacts = list()
  )
}

.invalidate_processing_state <- function(s, base_nombre = NULL) {
  # Todo lo que depende del par XLSForm + data debe recomputarse cuando
  # alguno de los dos cambia. Si no, Fase 2 puede mostrar plan/auditoría/
  # limpieza del instrumento anterior aunque la carga ya sea nueva.
  s$plan_result <- NULL
  s$evaluacion <- NULL
  s$reglas_custom <- list()
  s$explorador_cache <- list()
  s$limpieza_draft <- list()
  s$limpieza_preview <- NULL
  s$limpieza_artifacts <- list()
  s$analitica_prep_ok <- FALSE
  s$analitica_codebook_ok <- FALSE
  s$analitica_frecuencias_ok <- FALSE
  s$analitica_cruces_ok <- FALSE
  s$analitica_spss_ok <- FALSE
  s$analitica_enumeradores_ok <- FALSE
  s$analitica_dim_ok <- FALSE
  s$graficos_ppt_ok <- FALSE
  s$graficos_word_ok <- FALSE

  if (!is.null(s$estudio) && length(s$estudio$bases) > 0L) {
    targets <- if (!is.null(base_nombre) && nzchar(base_nombre)) {
      intersect(base_nombre, names(s$estudio$bases))
    } else {
      names(s$estudio$bases)
    }
    for (bn in targets) {
      s$estudio$bases[[bn]]$validacion <- .validacion_empty_scope()
    }
  }
  s
}

# Resuelve el nombre efectivo de la base. Reglas:
# - Si viene base_nombre y existe en el estudio, usar ese.
# - Si viene pero no existe, error.
# - Si no viene y hay estudio con ≥1 base, usar la primera.
# - Si no hay estudio pero hay rp_data legacy, retornar NULL (modo legacy).
# - Si no hay nada, retornar NULL y el caller decide.
.resolve_base_nombre <- function(s, base_nombre) {
  if (!is.null(base_nombre) && nzchar(base_nombre)) {
    if (is.null(s$estudio) || is.null(s$estudio$bases[[base_nombre]])) {
      stop_api(404, "E_BASE_NOT_FOUND",
               sprintf("Base '%s' no existe en el estudio.", base_nombre))
    }
    return(base_nombre)
  }
  if (!is.null(s$estudio) && length(s$estudio$bases) > 0L) {
    return(names(s$estudio$bases)[1])
  }
  NULL  # legacy single-base
}

estudio_next_auto_name <- function(sid) {
  s <- session_get(sid, required = FALSE)
  existing <- if (is.null(s) || is.null(s$estudio)) character()
              else names(s$estudio$bases)
  i <- 1L
  repeat {
    candidate <- sprintf("base_%d", i)
    if (!(candidate %in% existing)) return(candidate)
    i <- i + 1L
    if (i > 999L) stop_api(500, "E_AUTO_NAME_EXHAUSTED",
                           "No se pudo generar nombre automático.")
  }
}

# Reemplaza los archivos (xlsform y/o data) de una base existente.
# Re-parsea y actualiza los maps _sources. Si se toca la primera base,
# también refresca los mirrors rp_data/rp_inst.
estudio_replace_base_files <- function(sid, nombre,
                                        xlsform_file_id = NULL,
                                        data_file_id    = NULL,
                                        data_ext        = NULL,
                                        rp_data         = NULL,
                                        rp_inst         = NULL,
                                        n_filas         = NA_integer_,
                                        n_columnas      = NA_integer_) {
  s <- session_get(sid)
  if (is.null(s$estudio) || is.null(s$estudio$bases[[nombre]])) {
    stop_api(404, "E_BASE_NOT_FOUND", sprintf("Base '%s' no existe.", nombre))
  }
  meta <- s$estudio$bases[[nombre]]
  if (!is.null(xlsform_file_id) && nzchar(xlsform_file_id)) {
    meta$xlsform_file_id <- xlsform_file_id
    if (!is.null(rp_inst)) s$rp_inst_sources[[nombre]] <- rp_inst
  }
  if (!is.null(data_file_id) && nzchar(data_file_id)) {
    meta$data_file_id <- data_file_id
    if (!is.null(data_ext) && nzchar(data_ext)) meta$data_ext <- data_ext
    if (!is.null(rp_data)) s$rp_data_sources[[nombre]] <- rp_data
    if (!is.na(n_filas))    meta$n_filas    <- n_filas
    if (!is.na(n_columnas)) meta$n_columnas <- n_columnas
  }
  s$estudio$bases[[nombre]] <- meta

  if ((!is.null(xlsform_file_id) && nzchar(xlsform_file_id)) ||
      (!is.null(data_file_id) && nzchar(data_file_id))) {
    s <- .invalidate_processing_state(s, nombre)
  }

  # Refrescar mirror si es la primera base.
  first <- names(s$estudio$bases)[1]
  if (identical(first, nombre)) {
    s$rp_data <- s$rp_data_sources[[nombre]]
    s$rp_inst <- s$rp_inst_sources[[nombre]]
  }

  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(s$estudio$bases[[nombre]])
}

# Setea/limpia el nombre del estudio (opcional — solo metadata).
estudio_set_nombre <- function(sid, nombre) {
  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$nombre <- if (is.null(nombre) || !nzchar(nombre)) NULL else as.character(nombre)
  s <- .mark_project_dirty(s)
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

# ===========================================================================
# CODIFICACIÓN — state scoped por base (v0.2+)
# ===========================================================================
#
# Cada base del estudio tiene su propio progreso de codificación (familias
# generadas, grupos recodificados, respuestas por pregunta, plantilla de
# códigos, etc). Esto permite al analista codificar docentes, luego
# estudiantes, luego administrativos sin que se pise el trabajo.
#
# Modelo:
#   s$codif_por_base = list(
#     docentes    = list(familias_draft, familias_generated, marcadas,
#                        grupos_recod, respuestas_recod, plantilla_template,
#                        plantilla_codigos_file_id, codigos_sheets_meta,
#                        familias_file_id, familias_split, familias_xlsx_path,
#                        aplicado),
#     estudiantes = list(...),
#     administrativos = list(...)
#   )
#   s$codif_source_active = "docentes"  # base en la que el analista trabaja
#
# La fuente "activa" se usa por default cuando un endpoint no especifica
# source. Si el estudio cambia (reset, nuevo demo), se limpia.
#
# Los dataframes crudos (`codif_data`) y el instrumento (`codif_inst`) NO se
# guardan bajo codif_por_base — se leen on-demand de estudio_data_sources()
# y estudio_inst_sources(). Así evitamos duplicar memoria y siempre leemos
# los datos frescos de la base activa.

# Devuelve el nombre de la base activa para codificación. Si no está
# seteado, usa la primera base del estudio. Fallback: "default".
codif_source_active <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return("default")
  active <- s$codif_source_active
  if (!is.null(active) && nzchar(active)) {
    # Validar que siga existiendo en el estudio.
    bases <- names(s$estudio$bases %||% list())
    if (active %in% bases) return(active)
  }
  # Fallback: primera base del estudio.
  bases <- names(s$estudio$bases %||% list())
  if (length(bases) > 0L) return(bases[1])
  "default"
}

# Setea la base activa. Valida que exista en el estudio.
codif_source_set <- function(sid, source) {
  s <- session_get(sid)
  bases <- names(s$estudio$bases %||% list())
  if (length(bases) == 0L) {
    stop_api(409, "E_NO_ESTUDIO", "Aún no hay bases en el estudio (carga una en Fase 1).")
  }
  if (!source %in% bases) {
    stop_api(404, "E_BASE_NOT_FOUND",
             sprintf("Base '%s' no existe en el estudio. Disponibles: %s",
                     source, paste(bases, collapse = ", ")))
  }
  s$codif_source_active <- source
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(source)
}

# Lee un campo del state de codificación para la base activa (o la
# especificada explícitamente con `source`).
codif_get <- function(sid, key, default = NULL, source = NULL) {
  s <- session_get(sid)
  src <- if (is.null(source)) codif_source_active(sid) else source
  val <- s$codif_por_base[[src]][[key]]
  if (is.null(val)) default else val
}

# Escribe un campo del state de codificación para la base activa.
codif_set <- function(sid, key, value, source = NULL) {
  s <- session_get(sid)
  src <- if (is.null(source)) codif_source_active(sid) else source
  if (is.null(s$codif_por_base)) s$codif_por_base <- list()
  if (is.null(s$codif_por_base[[src]])) s$codif_por_base[[src]] <- list()
  s$codif_por_base[[src]][[key]] <- value
  # "inst" y "data" son caches del XLSForm parseado y del dataframe crudo
  # — se rederivan al abrir un .pulso desde el file_id, así que no son
  # cambios "user-visibles" que ameriten marcar dirty.
  if (!(key %in% c("inst", "data"))) {
    s <- .mark_project_dirty(s)
  }
  .session_env[[sid]] <- s
  invisible(value)
}

# IMPORTANTE: codificación NO usa `rp_data` / `rp_inst` (que son el
# output de reporte_data / reporte_instrumento, pensados para graficadores
# y reportes estadísticos). Usa la data CRUDA y el XLSForm parseado con
# leer_instrumento_xlsform(). Los siguientes helpers exponen esos datos
# por base, cacheando on-demand en `codif_por_base[[src]]$inst` / $data`.

codif_xlsform_path <- function(sid, source = NULL) {
  s <- session_get(sid)
  src <- if (is.null(source)) codif_source_active(sid) else source
  b <- s$estudio$bases[[src]]
  if (is.null(b)) return(NULL)
  meta <- s$files[[b$xlsform_file_id]]
  if (is.null(meta)) return(NULL)
  meta$path
}

codif_data_meta <- function(sid, source = NULL) {
  s <- session_get(sid)
  src <- if (is.null(source)) codif_source_active(sid) else source
  b <- s$estudio$bases[[src]]
  if (is.null(b)) return(NULL)
  s$files[[b$data_file_id]]
}

# Devuelve el instrumento XLSForm (leer_instrumento_xlsform) de la base
# activa. Cachea en `codif_por_base[[src]]$inst` la primera vez.
codif_inst_cached <- function(sid, source = NULL) {
  src <- if (is.null(source)) codif_source_active(sid) else source
  cached <- codif_get(sid, "inst", source = src)
  if (!is.null(cached)) return(cached)
  path <- codif_xlsform_path(sid, src)
  if (is.null(path)) {
    stop_api(409, "E_NO_XLSFORM",
             sprintf("La base '%s' no tiene XLSForm cargado.", src))
  }
  inst <- leer_instrumento_xlsform(path)
  codif_set(sid, "inst", inst, source = src)
  inst
}

# Dataframe crudo de la base activa (leído con .read_data_any del
# router_codificacion.R, que recibe un file-meta list).
codif_data_cached <- function(sid, source = NULL) {
  src <- if (is.null(source)) codif_source_active(sid) else source
  cached <- codif_get(sid, "data", source = src)
  if (!is.null(cached)) return(cached)
  meta <- codif_data_meta(sid, src)
  if (is.null(meta)) {
    stop_api(409, "E_NO_DATA",
             sprintf("La base '%s' no tiene data cargada.", src))
  }
  df <- .read_data_any(meta)
  codif_set(sid, "data", df, source = src)
  df
}

# Devuelve un snapshot del state de codificación de una base. Útil para
# el frontend al cambiar entre bases y también para export/import.
codif_snapshot <- function(sid, source = NULL) {
  s <- session_get(sid)
  src <- if (is.null(source)) codif_source_active(sid) else source
  s$codif_por_base[[src]] %||% list()
}
