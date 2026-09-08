# monitoreo_aulas_brecha_facultad.R — cuánto le falta a una facultad, UNA
# regla para el tablero y para el libro. Unidad A4 del loop de mejora
# estética y técnica (2026-09-08).
#
# ADR 0079: la cuota es por facultad Y por sexo, y no se compensa entre
# celdas — pasarse en mujeres no cubre lo que falta en hombres. El tablero
# (`.monitoreo_aulas_avance_cuota()`) ya sumaba lo que falta en cada celda; el
# libro (`.calaf_avance_por_facultad()`, hoja «Avance de campo» del xlsx y del
# Sheets) restaba el neto. Con un sexo pasado de su cuota, la misma facultad
# decía «faltan 1» en la hoja y «faltan 3» en la app. Medido el 07/09
# coincidían (2.288 en las 15 facultades) sólo porque ninguna celda sobraba
# todavía.

#' La brecha de una facultad contra su cuota.
#'
#' @param cuota la cuota de la facultad (personas).
#' @param conseguidas lo conseguido en total.
#' @param celdas lista de celdas de sexo, cada una `list(target, observed)`;
#'   se consideran sólo las que traen `target` finito; un `observed` ausente
#'   observa 0. Sin celdas útiles, la brecha es el neto `cuota − conseguidas`.
#' @return número no negativo, o `NA` sin cuota.
#' @keywords internal
monitoreo_aulas_brecha_facultad <- function(cuota, conseguidas, celdas = list()) {
  cuota <- suppressWarnings(as.numeric(cuota %||% NA))[1]
  if (!is.finite(cuota)) return(NA_real_)
  conseguidas <- suppressWarnings(as.numeric(conseguidas %||% 0))[1]
  if (!is.finite(conseguidas)) conseguidas <- 0
  faltas <- vapply(celdas %||% list(), function(c) {
    if (!is.list(c)) return(NA_real_)
    tg <- suppressWarnings(as.numeric(c$target %||% NA))[1]
    if (!is.finite(tg)) return(NA_real_)
    ob <- suppressWarnings(as.numeric(c$observed %||% 0))[1]
    if (!is.finite(ob)) ob <- 0
    max(0, tg - ob)
  }, numeric(1))
  faltas <- faltas[is.finite(faltas)]
  if (length(faltas)) return(sum(faltas))
  max(0, cuota - conseguidas)
}
