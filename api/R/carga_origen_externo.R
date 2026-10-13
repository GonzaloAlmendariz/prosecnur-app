# **La base que llega depurada de fuera dice de dónde viene.** ADR 0100, pieza P2.
#
# En HSyVBG 2026 un script en R quitó 9 encuestas sospechosas (3 críticas y 6
# ambiguas) a las 3 327 efectivas de Monitoreo, y la base se cargó con 3 318.
# Para Prosecnur esas 3 318 eran «lo recibido»: la ficha del universo no tenía
# cómo decir que antes hubo 3 327, ni por qué faltan 9.
#
# El bloque `estudio$bases[[b]]$origen_externo` es hermano de `limpieza` (el
# linaje de la depuración hecha DENTRO de la app, ADR 0076) y se lee igual: la
# ficha saca el agregado; los `_uuid` y los motivos son material interno.
#
# Al declararlo se comprueban dos cosas y se DICEN, no se callan:
# - Ningún `_uuid` excluido sigue en la base: si alguno está, la lista y la
#   base cuentan historias distintas.
# - `n_recibidas = n_entregadas + excluidas`: si no cuadra, se publica la
#   diferencia en vez de redondearla.

# Los identificadores de encuesta que acepta la app, la MISMA lista que usa
# Codificación (`.codif_key_candidates`): Kobo (`_uuid`), SurveyMonkey
# (`respondent_id`, `response_id`) y el código PULSO. Era sólo la de Kobo y una
# base de SurveyMonkey no podía declararse. Función y no constante: el archivo
# se carga antes que router_codificacion.R.
.origen_externo_id_candidatas <- function() .codif_key_candidates

# Un CSV leído con `check.names` convierte `_uuid` en `X_uuid`: la columna es la
# misma y no puede quedar sin encontrarse por eso.
.origen_externo_col_id <- function(nombres) {
  clave <- sub("^x(?=_)", "", tolower(trimws(as.character(nombres))), perl = TRUE)
  i <- match(tolower(.origen_externo_id_candidatas()), clave)
  i <- i[!is.na(i)]
  if (length(i)) i[[1]] else NA_integer_
}

.origen_externo_chr <- function(x, default = "") {
  x <- as.character(x %||% default)
  if (!length(x) || is.na(x[[1]])) return(default)
  trimws(x[[1]])
}

#' Normaliza la tabla de exclusiones declarada.
#'
#' Acepta la columna de id con cualquiera de los nombres de Kobo y la de motivo
#' como `motivo`; `categoria` es opcional. Sin columna de id no hay lista.
#'
#' @param df data.frame leído del xlsx o csv.
#' @return data.frame con `id`, `motivo` y `categoria` (texto), sin filas vacías.
#' @keywords internal
.origen_externo_normalizar_exclusiones <- function(df) {
  if (!is.data.frame(df) || !ncol(df)) {
    stop_api(400, "E_BAD_FILE", "La lista de exclusiones está vacía.")
  }
  nombres <- tolower(trimws(names(df)))
  col_id <- .origen_externo_col_id(names(df))
  if (is.na(col_id)) {
    stop_api(400, "E_BAD_FILE", paste0(
      "La lista de exclusiones necesita una columna con el identificador de la encuesta (",
      paste(.origen_externo_id_candidatas(), collapse = ", "), ")."))
  }
  col_motivo <- match("motivo", nombres)
  col_categoria <- match("categoria", sub("í", "i", nombres, fixed = TRUE))
  texto <- function(i) {
    if (is.na(i)) return(rep("", nrow(df)))
    v <- as.character(df[[i]])
    v[is.na(v)] <- ""
    trimws(v)
  }
  out <- data.frame(
    id = texto(col_id), motivo = texto(col_motivo), categoria = texto(col_categoria),
    stringsAsFactors = FALSE
  )
  out[nzchar(out$id), , drop = FALSE]
}

#' Construye el bloque `origen_externo` de una base y sus avisos.
#'
#' @param exclusiones salida de `.origen_externo_normalizar_exclusiones()`.
#' @param ids_base identificadores de la base cargada (columna `_uuid` o la que
#'   corresponda).
#' @param n_recibidas cuántas encuestas recibió el script. `NA` la deduce como
#'   entregadas + excluidas y lo declara.
#' @param script,version cómo se llama y qué versión del script depuró.
#' @param data_file_id la base a la que se refiere la declaración.
#' @return `list(bloque, avisos)`. `avisos` es una lista de
#'   `list(codigo, mensaje)`; vacía cuando todo cuadra.
#' @keywords internal
origen_externo_construir <- function(exclusiones, ids_base, n_recibidas = NA_integer_,
                                     script = "", version = "", data_file_id = "") {
  ids_base <- as.character(ids_base %||% character(0))
  ids_base <- trimws(ids_base[!is.na(ids_base)])
  avisos <- list()
  aviso <- function(codigo, mensaje) avisos[[length(avisos) + 1L]] <<- list(codigo = codigo, mensaje = mensaje)

  duplicados <- unique(exclusiones$id[duplicated(exclusiones$id)])
  if (length(duplicados)) {
    aviso("duplicadas", sprintf(
      "La lista repite %d identificador(es); cada encuesta se cuenta una vez.", length(duplicados)))
    exclusiones <- exclusiones[!duplicated(exclusiones$id), , drop = FALSE]
  }
  siguen <- exclusiones$id[exclusiones$id %in% ids_base]
  if (length(siguen)) {
    aviso("siguen_en_la_base", sprintf(
      "%d encuesta(s) de la lista siguen en la base cargada: la base no es la que produjo el script, o la lista no es la suya.",
      length(siguen)))
  }
  n_entregadas <- length(ids_base)
  n_excluidas <- nrow(exclusiones)
  n_rec <- suppressWarnings(as.integer(n_recibidas %||% NA_integer_))[1]
  deducida <- is.na(n_rec)
  if (deducida) {
    n_rec <- n_entregadas + n_excluidas
  } else if (!identical(n_rec, as.integer(n_entregadas + n_excluidas))) {
    aviso("no_cuadra", sprintf(
      "Se declararon %d recibidas, pero la base trae %d y la lista excluye %d (suman %d): faltan o sobran %d.",
      n_rec, n_entregadas, n_excluidas, n_entregadas + n_excluidas,
      n_rec - (n_entregadas + n_excluidas)))
  }
  if (any(!nzchar(exclusiones$motivo))) {
    aviso("sin_motivo", sprintf(
      "%d exclusión(es) no traen motivo.", sum(!nzchar(exclusiones$motivo))))
  }

  bloque <- list(
    enabled = TRUE,
    script = .origen_externo_chr(script),
    version = .origen_externo_chr(version),
    n_recibidas = as.integer(n_rec),
    n_recibidas_deducida = deducida,
    n_entregadas = as.integer(n_entregadas),
    n_excluidas = as.integer(n_excluidas),
    exclusiones = lapply(seq_len(nrow(exclusiones)), function(i) list(
      id = exclusiones$id[[i]], motivo = exclusiones$motivo[[i]], categoria = exclusiones$categoria[[i]]
    )),
    data_file_id = .origen_externo_chr(data_file_id),
    declarado_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  )
  list(bloque = bloque, avisos = avisos)
}

#' ¿La declaración habla de la base que rige?
#'
#' Una base recargada después de declarar deja el bloque describiendo otra
#' cosa. No se borra en silencio: se dice.
#'
#' @return "vigente", "otra_base" o "" (sin declaración).
#' @keywords internal
.origen_externo_estado <- function(bloque, data_file_id_actual) {
  if (!is.list(bloque) || !isTRUE(bloque$enabled)) return("")
  declarado <- .origen_externo_chr(bloque$data_file_id)
  if (nzchar(declarado) && !identical(declarado, .origen_externo_chr(data_file_id_actual))) {
    return("otra_base")
  }
  "vigente"
}

#' El agregado que puede salir a la ficha: totales y conteo por categoría.
#'
#' Nunca los identificadores ni los motivos escritos: igual que el linaje de
#' Limpieza, son material de trabajo interno.
#'
#' @keywords internal
.origen_externo_resumen <- function(bloque) {
  if (!is.list(bloque) || !isTRUE(bloque$enabled)) return(NULL)
  cats <- vapply(bloque$exclusiones %||% list(), function(e) .origen_externo_chr(e$categoria), character(1))
  cats[!nzchar(cats)] <- "Sin categoría"
  por_cat <- if (length(cats)) table(cats) else integer(0)
  list(
    recibidas = as.integer(bloque$n_recibidas %||% NA_integer_),
    excluidas = as.integer(bloque$n_excluidas %||% 0L),
    entregadas = as.integer(bloque$n_entregadas %||% NA_integer_),
    por_categoria = lapply(names(por_cat), function(k) list(categoria = k, n = as.integer(por_cat[[k]])))
  )
}

# --- con sesión ---------------------------------------------------------------

.origen_externo_leer_archivo <- function(s, file_id, que) {
  fid <- .origen_externo_chr(file_id)
  meta <- (s$files %||% list())[[fid]]
  if (!nzchar(fid) || is.null(meta) || !file.exists(meta$path %||% "")) {
    stop_api(404, "E_FILE_NOT_FOUND", sprintf("No se encontró el archivo de %s.", que))
  }
  ext <- tolower(.origen_externo_chr(meta$ext, tools::file_ext(meta$path)))
  as.data.frame(.read_data_any_path(meta$path, ext), stringsAsFactors = FALSE, check.names = FALSE)
}

#' Declara de dónde viene la base: lista de exclusiones del script y recibidas.
#'
#' @param sid sesión. @param base_nombre base (vacío = la activa).
#' @param file_id archivo xlsx o csv ya subido con la lista de exclusiones.
#' @param n_recibidas,script,version ver `origen_externo_construir()`.
#' @return `list(base, estado, bloque, avisos, resumen)`.
#' @keywords internal
origen_externo_declarar <- function(sid, base_nombre = NULL, file_id = "",
                                    n_recibidas = NA_integer_, script = "", version = "") {
  s <- session_get(sid)
  nombre <- .resolve_base_nombre(s, base_nombre)
  meta <- s$estudio$bases[[nombre]]
  if (is.null(meta)) stop_api(404, "E_BASE_NOT_FOUND", sprintf("No existe la base «%s».", nombre))
  base_df <- .origen_externo_leer_archivo(s, meta$data_file_id, "la base")
  col_id <- .origen_externo_col_id(names(base_df))
  if (is.na(col_id)) {
    stop_api(400, "E_BAD_REQUEST", paste0(
      "La base no trae una columna de identificador de encuesta (",
      paste(.origen_externo_id_candidatas(), collapse = ", "), "): no hay contra qué cruzar la lista."))
  }
  exclusiones <- .origen_externo_normalizar_exclusiones(
    .origen_externo_leer_archivo(s, file_id, "exclusiones"))
  out <- origen_externo_construir(
    exclusiones, base_df[[col_id]], n_recibidas = n_recibidas,
    script = script, version = version, data_file_id = meta$data_file_id
  )
  meta$origen_externo <- out$bloque
  s$estudio$bases[[nombre]] <- meta
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  list(base = nombre, estado = "vigente", bloque = .origen_externo_sin_ids(out$bloque),
       avisos = out$avisos, resumen = .origen_externo_resumen(out$bloque))
}

#' Estado de la declaración de una base, sin identificadores.
#' @keywords internal
origen_externo_consultar <- function(sid, base_nombre = NULL) {
  s <- session_get(sid)
  nombre <- .resolve_base_nombre(s, base_nombre)
  meta <- s$estudio$bases[[nombre]] %||% list()
  bloque <- meta$origen_externo
  list(base = nombre, estado = .origen_externo_estado(bloque, meta$data_file_id),
       bloque = .origen_externo_sin_ids(bloque), resumen = .origen_externo_resumen(bloque))
}

# La respuesta HTTP no lleva los identificadores: viven en el .pulso, como las
# decisiones de Limpieza, y sólo se cuentan.
.origen_externo_sin_ids <- function(bloque) {
  if (!is.list(bloque) || !length(bloque)) return(NULL)
  bloque$exclusiones <- NULL
  bloque
}
