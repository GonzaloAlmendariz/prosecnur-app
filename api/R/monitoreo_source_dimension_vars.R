# Dimensiones que salen de una COLUMNA de la fuente, no de una constante.
#
# Por que vive aparte de monitoreo_engine.R: el engine esta congelado a
# crecimiento (agentic/manifest.json), asi que la logica nueva va en archivo
# propio y el engine solo la llama.
#
# El problema que resuelve. `dimensions` siempre fue una etiqueta CONSTANTE por
# fuente: `.monitoreo_dimension_columns()` pasa cada valor por
# `.monitoreo_scalar()` y lo difunde con `rep()` a todas las filas. Eso sirve
# cuando una fuente ES un actor ("esta hoja es Homologacion"), y no sirve cuando
# una sola hoja lleva varios actores en una columna — que es la forma natural de
# un barrido telefonico.
#
# El efecto medido (PDM Medios de Vida 2026, 2026-08-01): una hoja de 183 casos
# con los dos componentes en la columna `Componente` reporta **universo 0** para
# ambos actores. Ninguna fila hereda actor, y `.monitoreo_report_unit_mask()`
# —que sabe matchear `dim_actor` fila a fila— se queda sin columna que mirar.
#
# Y el modo de fallar invita al error: en `acnur_pdm` alguien declaro
# `dimensions = list(sede = "sede", atencion = "atencion", ...)` con la
# intencion evidente de decir «la sede vive en la columna `sede`». El producto
# lo acepto como constante y escribio el literal `"sede"` en las 2726 filas.
# Nadie lo noto porque el reporte cae al `.source_label` cuando la dimension no
# discrimina.
#
# La regla de este archivo: **lo declarado como variable manda sobre lo
# declarado como constante**, y solo cuando la columna existe de verdad. Es
# opt-in: una fuente que no declara `actor_var` se comporta exactamente como
# antes, asi que ningun proyecto existente cambia de cifras al actualizar.

# Alias aceptados para «el actor de cada fila vive en esta columna». Son los
# mismos cuatro que reconoce `.monitoreo_source_from_payload` en el router: un
# alias de mas aqui seria letra muerta, porque el router ya normaliza a "" lo
# que no reconoce y `%||%` solo cae en NULL.
.monitoreo_source_actor_var <- function(source = list()) {
  .monitoreo_scalar(
    source$actor_var %||%
      source$actorVar %||%
      source$actor_column %||%
      source$actorColumn,
    ""
  )
}

# Un padrón compartido por dos públicos (Gonzalo, 30/10: «CENTRUM y Campus son
# dos perfiles separados a pesar de que pertenecen a una misma base»). Con
# `actor_var` sola, cada valor de la columna sería un público (TPA, DTC, CENTRUM,
# TPC20). `actor_map` dice cuáles valores van a qué público; los que no están en
# el mapa —y las celdas vacías— se quedan en el público constante de la fuente.
# Las claves se comparan sin mayúsculas ni tildes.
.monitoreo_source_actor_map <- function(source = list()) {
  raw <- source$actor_map %||% source$actorMap %||% list()
  if (is.data.frame(raw)) raw <- as.list(raw[1, , drop = FALSE])
  if (!is.list(raw) && !is.character(raw)) return(character(0))
  nombres <- names(raw)
  if (is.null(nombres) || !length(raw)) return(character(0))
  out <- character(0)
  for (i in seq_along(raw)) {
    clave <- .monitoreo_text_key(nombres[[i]])
    publico <- trimws(.monitoreo_scalar(raw[[i]], ""))
    if (!nzchar(clave) || !nzchar(publico)) next
    out[[clave]] <- publico
  }
  out
}

# Una fuente de respuestas puede declarar que el público de cada respuesta sale de
# SU FILA en el padrón, la que cruza por la llave, y no de la encuesta: una sola
# encuesta de Profesores alimenta a CENTRUM y a Campus. Opt-in por fuente; ver
# monitoreo_actor_por_padron.R.
.monitoreo_source_actor_por_padron <- function(source = list()) {
  valor <- source$actor_por_padron %||% source$actorPorPadron %||% FALSE
  isTRUE(as.logical(.monitoreo_scalar(valor, "FALSE")))
}

#' Dimensiones por columna declaradas en una fuente.
#'
#' Devuelve un mapa `dim_<clave> -> nombre de columna`. Hoy solo el actor tiene
#' atajo propio (`actor_var`), porque es el que bloqueaba un estudio real; el
#' mapa generico `dimension_vars` queda abierto para sede/tramite/origen sin
#' tener que volver a tocar el engine.
monitoreo_source_dimension_vars <- function(source = list()) {
  out <- list()
  raw <- source$dimension_vars %||% source$dimensionVars %||% list()
  if (is.data.frame(raw)) raw <- as.list(raw[1, , drop = FALSE])
  if (is.list(raw) && length(raw) && !is.null(names(raw))) {
    for (key in names(raw)) {
      column <- .monitoreo_scalar(raw[[key]], "")
      if (!nzchar(trimws(key)) || !nzchar(trimws(column))) next
      out[[paste0("dim_", .monitoreo_safe_name(key))]] <- trimws(column)
    }
  }
  actor_var <- .monitoreo_source_actor_var(source)
  if (nzchar(trimws(actor_var))) out[["dim_actor"]] <- trimws(actor_var)
  out
}

#' Reescribe las columnas `dim_*` de una fuente con los valores de sus columnas.
#'
#' Se llama DESPUES de que `.monitoreo_add_source_columns()` difundio las
#' constantes, y solo pisa las dimensiones que declararon variable. Una columna
#' declarada que no existe en los datos se ignora en silencio a proposito: la
#' fuente puede declararse antes del primer sync, y abortar ahi dejaria al
#' usuario sin poder guardar su configuracion.
monitoreo_apply_source_dimension_vars <- function(data, source = list()) {
  if (is.null(data) || !is.data.frame(data) || !nrow(data)) return(data)
  if (.monitoreo_source_actor_por_padron(source)) data$.actor_por_padron <- TRUE
  mapping <- monitoreo_source_dimension_vars(source)
  if (!length(mapping)) return(data)
  variable_labels <- .monitoreo_variable_label_map(data)
  mapa_actor <- .monitoreo_source_actor_map(source)
  for (dim_col in names(mapping)) {
    column <- mapping[[dim_col]]
    if (!column %in% names(data)) next
    values <- trimws(as.character(data[[column]]))
    values[is.na(values)] <- ""
    if (identical(dim_col, "dim_actor") && length(mapa_actor)) {
      constante <- if ("dim_actor" %in% names(data)) trimws(as.character(data$dim_actor)) else rep("", nrow(data))
      constante[is.na(constante)] <- ""
      mapeado <- unname(mapa_actor[.monitoreo_text_key(values)])
      data[[dim_col]] <- ifelse(is.na(mapeado), constante, mapeado)
      next
    }
    data[[dim_col]] <- values
  }
  .monitoreo_restore_variable_labels(data, variable_labels)
}
