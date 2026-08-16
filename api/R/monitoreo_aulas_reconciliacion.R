# Reconciliacion del parte de campo de un aula.
#
# El parte declara cuatro numeros que no son independientes:
#
#   asistentes - rechazos - duplicados = efectivas
#
# El Excel NO comprueba esa identidad. Medido sobre el estudio de 2025: falla en
# 2 de 196 partes. Son pocos, y por eso mismo es el tipo de error que nadie
# encuentra a ojo revisando una hoja de 101 columnas.
#
# Este control no corrige nada ni decide cual de los cuatro numeros esta mal:
# senala la fila y muestra la resta. Quien sabe que paso en esa aula es el
# equipo, no la app.

#' Diferencia entre lo que el parte declara y lo que sus numeros implican.
#'
#' @param parte una fila de parte de campo.
#' @return lista con `esperado`, `declarado` y `diferencia`, o `NULL` si el
#'   parte no trae numeros suficientes para comprobar nada.
#' @export
monitoreo_aulas_parte_descuadre <- function(parte) {
  num <- function(campo) {
    v <- suppressWarnings(as.numeric(parte[[campo]] %||% NA))
    if (length(v) != 1L || !is.finite(v)) NA_real_ else v
  }
  asistentes <- num("observed_students")
  efectivas <- num("effective_surveys")
  # Sin estos dos no hay identidad que comprobar. Suponer cero donde no hay
  # dato inventaria un descuadre que quiza no existe.
  if (!is.finite(asistentes) || !is.finite(efectivas)) return(NULL)
  rechazos <- num("refusals")
  duplicados <- num("duplicates")
  # Rechazos y duplicados SI se asumen cero cuando faltan: son cantidades de
  # eventos que, de no haberse anotado, no ocurrieron.
  if (!is.finite(rechazos)) rechazos <- 0
  if (!is.finite(duplicados)) duplicados <- 0
  esperado <- asistentes - rechazos - duplicados
  list(
    esperado = esperado,
    declarado = efectivas,
    diferencia = efectivas - esperado
  )
}

#' Partes cuyos numeros no reconcilian.
#'
#' @param partes lista de partes de campo.
#' @param tolerancia diferencia absoluta que se considera cuadrada.
#' @return lista de hallazgos, uno por parte descuadrado.
#' @export
monitoreo_aulas_reconciliacion_partes <- function(partes = list(), tolerancia = 0.5) {
  if (!length(partes)) return(list())
  out <- list()
  for (p in partes) {
    if (!is.list(p)) next
    d <- monitoreo_aulas_parte_descuadre(p)
    if (is.null(d) || abs(d$diferencia) <= tolerancia) next
    out[[length(out) + 1L]] <- list(
      operational_code = as.character(p$operational_code %||% p$classroom_id %||% ""),
      intento = as.integer(p$intento %||% 1L),
      asistentes = suppressWarnings(as.numeric(p$observed_students %||% NA)),
      rechazos = suppressWarnings(as.numeric(p$refusals %||% NA)),
      duplicados = suppressWarnings(as.numeric(p$duplicates %||% NA)),
      esperado = d$esperado,
      efectivas = d$declarado,
      diferencia = d$diferencia
    )
  }
  out
}

#' Frase que explica un descuadre sin jerga.
#'
#' @param hallazgo un elemento de `monitoreo_aulas_reconciliacion_partes()`.
#' @return texto en espanol.
#' @export
monitoreo_aulas_descuadre_texto <- function(hallazgo) {
  faltan <- hallazgo$diferencia < 0
  sprintf(
    "%s: %s asistentes menos %s rechazos y %s duplicados dan %s, pero el parte declara %s efectivas (%s %s).",
    hallazgo$operational_code,
    format(hallazgo$asistentes, trim = TRUE),
    format(hallazgo$rechazos %||% 0, trim = TRUE),
    format(hallazgo$duplicados %||% 0, trim = TRUE),
    format(hallazgo$esperado, trim = TRUE),
    format(hallazgo$efectivas, trim = TRUE),
    if (faltan) "faltan" else "sobran",
    format(abs(hallazgo$diferencia), trim = TRUE)
  )
}
