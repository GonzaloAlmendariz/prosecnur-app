# Qué respuesta cuenta como efectiva, con más de un criterio.
#
# El contrato admitía UN filtro —`platform_effective_filter: {variable, values}`—
# y eso alcanza mientras la única condición sea el consentimiento. No alcanza en
# cuanto el estudio exige dos: consentimiento sí Y encuesta terminada, o
# consentimiento sí Y modalidad telefónica. Con un solo campo, declarar la
# segunda condición obligaba a elegir cuál de las dos se comprobaba.
#
# Los criterios se guardan DENTRO del filtro que ya viaja en el `.pulso`, en
# `filters`, y no en una clave hermana:
#
#   platform_effective_filter:
#     variable: "Intro/Consent"      # el primer criterio, repetido
#     values:   ["Yes"]              # ídem
#     filters:  [{variable, values}, {variable, values}, …]
#
# La repetición es deliberada. `variable`/`values` siguen siendo verdad —son el
# primer criterio— así que todo lo que ya los leía sigue leyendo algo correcto:
# el PDF telefónico, los tests que fijan el contrato y cualquier proyecto
# guardado antes de esto. Una clave hermana `platform_effective_filters` habría
# dejado a esos consumidores viendo una definición de efectiva incompleta sin
# que nada fallara, que es la peor forma de romper algo.
#
# Se combinan con Y, no con O, y no es configurable. «Efectiva» significa que
# la respuesta cumple todo lo que el estudio pide; un O convertiría el filtro en
# una definición que nadie puede auditar después —«cuenta si consintió O si
# terminó» no es una definición de efectiva, es dos—. Dentro de un criterio, en
# cambio, los valores son alternativas: una variable con `["Yes", "Sí"]` acepta
# cualquiera de las dos escrituras de la misma respuesta.

#' Un criterio limpio, o NULL si no dice nada.
.monitoreo_effective_criterion <- function(raw) {
  if (!is.list(raw)) return(NULL)
  variable <- .monitoreo_scalar(
    raw$variable %||% raw$field %||% raw$question %||% raw$pregunta,
    ""
  )
  values <- .monitoreo_chr_vec(
    raw$values %||% raw$value %||% raw$options %||% raw$opciones
  )
  values <- values[nzchar(values)]
  if (!nzchar(variable) || !length(values)) return(NULL)
  list(
    variable = variable,
    values = as.list(values),
    label = .monitoreo_scalar(raw$label %||% raw$etiqueta, variable),
    value_label = .monitoreo_scalar(raw$value_label %||% raw$etiqueta_valor, "")
  )
}

#' Los criterios declarados, en orden y sin repetir variable.
#'
#' El primero sale de `variable`/`values` del propio filtro —que es donde vivía
#' el único criterio posible— y el resto de `filters`. Si `filters` ya trae ese
#' mismo primero, no se duplica: la lista es la fuente y el par suelto, su
#' reflejo.
.monitoreo_effective_criteria <- function(raw, profile = list()) {
  if (!is.list(raw)) raw <- list()
  primero <- .monitoreo_effective_criterion(list(
    variable = raw$variable %||% raw$field %||% raw$question %||% raw$pregunta
      %||% profile$platform_effective_var %||% profile$effective_filter_var,
    values = raw$values %||% raw$value %||% raw$options %||% raw$opciones
      %||% profile$platform_effective_values %||% profile$effective_filter_values,
    label = raw$label %||% raw$etiqueta,
    value_label = raw$value_label %||% raw$etiqueta_valor
  ))

  declarados <- raw$filters %||% raw$filtros %||% list()
  if (!is.list(declarados)) declarados <- list()
  # `jsonlite` puede entregar un solo criterio como lista plana en vez de lista
  # de listas; se envuelve para no iterar sus campos como si fueran criterios.
  if (length(declarados) && !is.null(names(declarados))) declarados <- list(declarados)
  resto <- Filter(Negate(is.null), lapply(declarados, .monitoreo_effective_criterion))

  criterios <- c(if (is.null(primero)) list() else list(primero), resto)
  if (!length(criterios)) return(list())

  vistos <- character(0)
  salida <- list()
  for (criterio in criterios) {
    clave <- .monitoreo_text_key(criterio$variable)
    if (clave %in% vistos) next
    vistos <- c(vistos, clave)
    salida[[length(salida) + 1L]] <- criterio
  }
  salida
}

#' El bloque `platform_effective_filter` ya normalizado.
#'
#' Reemplaza la construcción literal que vivía en `monitoreo_engine.R` —archivo
#' congelado a crecimiento— y de paso la deja más corta allá.
.monitoreo_effective_filter_block <- function(raw, profile = list()) {
  if (!is.list(raw)) raw <- list()
  criterios <- .monitoreo_effective_criteria(raw, profile)
  configurado <- length(criterios) > 0L
  primero <- if (configurado) criterios[[1]] else NULL
  list(
    enabled = .monitoreo_bool(raw$enabled %||% raw$activo, configurado),
    variable = primero$variable %||% "",
    values = primero$values %||% list(),
    filters = criterios,
    label = .monitoreo_scalar(raw$label %||% raw$etiqueta, primero$variable %||% ""),
    value_label = .monitoreo_scalar(raw$value_label %||% raw$etiqueta_valor, ""),
    source_kind = .monitoreo_scalar(raw$source_kind %||% raw$provider %||% raw$proveedor, "")
  )
}

#' Máscara de las filas que cumplen TODOS los criterios declarados.
#'
#' Sin criterios devuelve todo `TRUE`: un filtro sin declarar no descarta nada,
#' que es distinto de un filtro que no encuentra su columna —ese sí devuelve
#' todo `FALSE`, porque la definición existe y el corte no la cumple—.
.monitoreo_effective_criteria_mask <- function(df, criterios) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(logical(0))
  if (!length(criterios)) return(rep(TRUE, nrow(df)))

  mask <- rep(TRUE, nrow(df))
  for (criterio in criterios) {
    aceptados <- .monitoreo_text_key(.monitoreo_chr_vec(criterio$values))
    aceptados <- aceptados[nzchar(aceptados)]
    if (!length(aceptados)) next
    col <- .monitoreo_report_filter_column(df, criterio$variable)
    if (!nzchar(col)) return(rep(FALSE, nrow(df)))
    raw <- as.character(df[[col]] %||% "")
    raw[is.na(raw)] <- ""
    clean <- .monitoreo_text_key(raw)
    # Las respuestas de selección múltiple llegan como «A | B»; se comparan
    # también con los separadores colapsados para que un valor aceptado dentro
    # de una respuesta compuesta cuente.
    clean_compound <- .monitoreo_text_key(gsub("\\s*[|/]\\s*", " ", raw))
    mask <- mask & (clean %in% aceptados | clean_compound %in% aceptados)
  }
  mask
}
