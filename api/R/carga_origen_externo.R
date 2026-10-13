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
    por_categoria = lapply(names(por_cat), function(k) list(categoria = k, n = as.integer(por_cat[[k]]))),
    variables_retiradas = .origen_externo_resumen_variables(bloque$variables_retiradas)
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

# El `survey` del instrumento de ESA base (no el de la activa), por el lector y
# el cache que ya usa la vista de esquema de Carga. Sin XLSForm: E_NO_XLSFORM.
.origen_externo_survey <- function(sid, nombre) {
  (.carga_inst_estructura_por_base(sid, nombre) %||% list())$survey
}

# Las faltantes se calculan siempre, haya declaración o no. Una base sin
# instrumento, con un XLSForm que el lector no abre o sin archivo de data no
# tiene contra qué compararse: la consulta responde una lista vacía en vez de
# tumbar el panel (el POST sí falla) y deja la causa en stderr.
.origen_externo_faltantes_consulta <- function(sid, nombre, meta) {
  tryCatch({
    columnas <- names(.origen_externo_leer_archivo(session_get(sid), meta$data_file_id, "la base"))
    origen_externo_variables_faltantes(.origen_externo_survey(sid, nombre), columnas)
  }, error = function(e) {
    message(sprintf("[origen_externo] faltantes de «%s» sin calcular: %s", nombre, conditionMessage(e)))
    list()
  })
}

.origen_externo_tiene_casos <- function(bloque) {
  if (!is.list(bloque) || !isTRUE(bloque$enabled)) return(FALSE)
  if (!is.null(bloque$casos_declarados)) return(isTRUE(bloque$casos_declarados))
  length(bloque$exclusiones %||% list()) > 0L  # bloque anterior a P2b
}

# Declarar sólo variables no borra la lista de casos que ya regía para esta base
# (ni al revés): cada parte del panel se declara por su lado.
.origen_externo_bloque_sin_lista <- function(previo, n_entregadas, script, version, data_file_id) {
  b <- if (.origen_externo_tiene_casos(previo)) previo else list(
    n_recibidas = NA_integer_, n_recibidas_deducida = FALSE,
    n_entregadas = as.integer(n_entregadas), n_excluidas = 0L, exclusiones = list()
  )
  b$enabled <- TRUE
  b$casos_declarados <- .origen_externo_tiene_casos(previo)
  b$script <- .origen_externo_chr(script)
  if (!nzchar(b$script)) b$script <- .origen_externo_chr((previo %||% list())$script)
  b$version <- .origen_externo_chr(version)
  if (!nzchar(b$version)) b$version <- .origen_externo_chr((previo %||% list())$version)
  b$data_file_id <- .origen_externo_chr(data_file_id)
  b$declarado_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  b
}

# `variables_excluidas` de la config de Analítica DE ESA BASE: por base si el
# estudio scopea la config (ADR 0061) o la base ya tiene la suya; si no, la
# global, que es la que esa base lee. Devuelve la sesión mutada y las agregadas.
.origen_externo_analitica_excluir <- function(sid, s, nombre, retiradas) {
  configs <- s$analitica_config_por_base
  propia <- is.list(configs) && !is.null(configs[[nombre]])
  por_base <- propia || .analitica_config_es_por_base(sid)
  cfg <- if (por_base && !propia && identical(.analitica_scoped_base(sid), nombre)) {
    .analitica_config_get(sid, s)  # conserva la herencia de la base activa
  } else {
    .analitica_cfg_para_base(sid, nombre, s) %||% .analitica_default_config()
  }
  out <- .origen_externo_excluidas_con_retiradas(cfg, retiradas)
  if (!length(out$agregadas)) return(list(s = s, agregadas = character(0)))
  if (por_base) {
    if (!is.list(configs)) configs <- list()
    configs[[nombre]] <- out$cfg
    s$analitica_config_por_base <- configs
  } else {
    s$analitica_config <- out$cfg
  }
  list(s = s, agregadas = out$agregadas)
}

.origen_externo_variables_motivo <- function(x) {
  if (is.null(x) || !length(x)) return(list())
  x <- as.list(x)
  nombres <- trimws(names(x) %||% rep("", length(x)))
  x <- x[nzchar(nombres)]
  names(x) <- nombres[nzchar(nombres)]
  x
}

#' Declara de dónde viene la base: casos retirados, variables retiradas o ambos.
#'
#' @param sid sesión. @param base_nombre base (vacío = la activa).
#' @param file_id archivo xlsx o csv ya subido con la lista de exclusiones
#'   (opcional desde P2b).
#' @param n_recibidas,script,version ver `origen_externo_construir()`.
#' @param variables_motivo lista `variable -> motivo` ("metadato",
#'   "no_va_al_cliente", "otra"). Con algo dentro se registran TODAS las
#'   variables faltantes; las no nombradas llevan el motivo sugerido u "otra".
#' @return la consulta más `avisos` y `variables_excluidas_agregadas`.
#' @keywords internal
origen_externo_declarar <- function(sid, base_nombre = NULL, file_id = "",
                                    n_recibidas = NA_integer_, script = "", version = "",
                                    variables_motivo = NULL) {
  s <- session_get(sid)
  nombre <- .resolve_base_nombre(s, base_nombre)
  meta <- s$estudio$bases[[nombre]]
  if (is.null(meta)) stop_api(404, "E_BASE_NOT_FOUND", sprintf("No existe la base «%s».", nombre))
  fid <- .origen_externo_chr(file_id)
  vm <- .origen_externo_variables_motivo(variables_motivo)
  if (!nzchar(fid) && !length(vm)) {
    stop_api(400, "E_BAD_REQUEST", paste0(
      "Declara la lista de casos retirados ('file_id') o las variables retiradas ",
      "('variables_motivo'): sin ninguna de las dos no hay nada que declarar."))
  }
  base_df <- .origen_externo_leer_archivo(s, meta$data_file_id, "la base")
  # Se lee antes de mutar: el lector cachea el instrumento en la sesión.
  survey <- if (length(vm)) .origen_externo_survey(sid, nombre) else NULL
  s <- session_get(sid)
  previo <- meta$origen_externo
  previo_vigente <- identical(.origen_externo_estado(previo, meta$data_file_id), "vigente")
  avisos <- list()

  if (nzchar(fid)) {
    col_id <- .origen_externo_col_id(names(base_df))
    if (is.na(col_id)) {
      stop_api(400, "E_BAD_REQUEST", paste0(
        "La base no trae una columna de identificador de encuesta (",
        paste(.origen_externo_id_candidatas(), collapse = ", "), "): no hay contra qué cruzar la lista."))
    }
    exclusiones <- .origen_externo_normalizar_exclusiones(
      .origen_externo_leer_archivo(s, fid, "exclusiones"))
    out <- origen_externo_construir(
      exclusiones, base_df[[col_id]], n_recibidas = n_recibidas,
      script = script, version = version, data_file_id = meta$data_file_id
    )
    bloque <- out$bloque
    bloque$casos_declarados <- TRUE
    avisos <- out$avisos
  } else {
    bloque <- .origen_externo_bloque_sin_lista(
      if (previo_vigente) previo else NULL, nrow(base_df), script, version, meta$data_file_id)
  }

  if (length(vm)) {
    faltantes <- origen_externo_variables_faltantes(survey, names(base_df))
    v <- origen_externo_variables_retiradas(faltantes, names(base_df), vm)
    bloque$variables_retiradas <- v$retiradas
    avisos <- c(avisos, v$avisos)
  } else {
    bloque$variables_retiradas <- if (previo_vigente) previo$variables_retiradas %||% list() else list()
  }
  bloque$n_variables_retiradas <- length(bloque$variables_retiradas)

  meta$origen_externo <- bloque
  s$estudio$bases[[nombre]] <- meta
  analitica <- .origen_externo_analitica_excluir(sid, s, nombre, bloque$variables_retiradas)
  s <- .mark_project_dirty(analitica$s)
  .session_env[[sid]] <- s
  c(origen_externo_consultar(sid, nombre),
    list(avisos = avisos, variables_excluidas_agregadas = as.list(analitica$agregadas)))
}

#' Estado de la declaración de una base, sin identificadores, y las variables
#' del instrumento que la base no trae (siempre, haya declaración o no).
#' @keywords internal
origen_externo_consultar <- function(sid, base_nombre = NULL) {
  s <- session_get(sid)
  nombre <- .resolve_base_nombre(s, base_nombre)
  meta <- s$estudio$bases[[nombre]] %||% list()
  bloque <- meta$origen_externo
  list(base = nombre, estado = .origen_externo_estado(bloque, meta$data_file_id),
       bloque = .origen_externo_sin_ids(bloque), resumen = .origen_externo_resumen(bloque),
       variables_faltantes = .origen_externo_faltantes_consulta(sid, nombre, meta))
}

# La respuesta HTTP no lleva los identificadores: viven en el .pulso, como las
# decisiones de Limpieza, y sólo se cuentan.
.origen_externo_sin_ids <- function(bloque) {
  if (!is.list(bloque) || !length(bloque)) return(NULL)
  bloque$exclusiones <- NULL
  bloque
}
