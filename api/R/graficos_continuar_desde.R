# =============================================================================
# graficos_continuar_desde.R — una lámina que sigue a otra: `continuar_desde` (P14)
# =============================================================================
#
# Prueba con el resumen de Arte (2026-11-09, lámina 4): con rótulos de tres líneas caben 11 de las 22 preguntas bajo
# 60%, y el pie prometía «el resto en otra lámina», que no existía. Decisión del lead: el motor no crea láminas (lo
# decide el analista) y el texto no promete lo que no existe. `continuar_desde` (entero, desde 1, en el orden de la
# regla: el de su métrica en la escala, la mayor diferencia absoluta en el contraste) hace que la lámina muestre las filas
# desde esa posición; es la base de la acción «Agregar lámina con las siguientes» de la tarjeta. El pie dice
# «Se muestran de la 12 a la 22 de las 22 bajo 60%, de 157 preguntas de escala.».

#' `continuar_desde` del constructor: NULL, o un entero >= 1 (1 equivale a no declararlo)
#' @keywords internal
.graf_continuar_desde <- function(x, constructor) {
  if (is.null(x) || !length(x)) return(NULL)
  v <- suppressWarnings(as.numeric(unlist(x))[1])
  if (is.na(v) || v < 1 || v != round(v)) {
    .plan_spec_abort(sprintf("%s: `continuar_desde` es la posición (entera, desde 1) de la primera fila que muestra la lámina.", constructor))
  }
  if (v == 1) NULL else as.integer(v)
}

#' El contraste en una ranura no sigue a otra lámina: si trae `continuar_desde`, lo dice y lo deja de lado (C4)
#'
#' En una lámina de dos o cuatro gráficos la ranura elige las filas que caben por la mayor diferencia, con su alto real
#' (lamina_resumen_ranura_prioridad.R), y ese recorte no tiene un orden fijo que otra lámina pueda continuar: cuántas
#' caben depende del ancho y del alto de la ranura. Antes `continuar_desde` se perdía en silencio; ahora el aviso dice
#' que la ranura muestra las de mayor diferencia y que continuar se hace en una lámina de un gráfico.
#' @return El elemento sin `continuar_desde` (o tal cual si no lo trae o no va en una ranura).
#' @keywords internal
.contraste_desde_en_ranura <- function(el) {
  if (.tope_espacio_desde(el$continuar_desde) <= 1L || !.tope_espacio_en_ranura(el)) return(el)
  .pulso_aviso(.aviso_en_lamina(sprintf(paste0(
    "En una lámina de dos o cuatro gráficos el contraste no admite `continuar_desde` (%d) y muestra las preguntas de mayor ",
    "diferencia que caben; para continuar desde una posición, ponlo en una lámina de un gráfico."), .tope_espacio_desde(el$continuar_desde))))
  el$continuar_desde <- NULL
  el
}

#' `hasta` del constructor (S6, S7): NULL, o la posición (entera, desde 1, en el orden de la regla) de la última fila que
#' muestra la lámina. Con `continuar_desde` arma dos láminas parejas: la primera `hasta = 11`, la segunda
#' `continuar_desde = 12`. No puede ser anterior a `continuar_desde`.
#' @keywords internal
.graf_hasta <- function(x, desde, constructor) {
  if (is.null(x) || !length(x)) return(NULL)
  v <- suppressWarnings(as.numeric(unlist(x))[1])
  d <- .tope_espacio_desde(desde)
  if (is.na(v) || v < 1 || v != round(v) || v < d) {
    .plan_spec_abort(sprintf("%s: `hasta` es la posición (entera, desde 1 y no antes de `continuar_desde`) de la última fila que muestra la lámina.", constructor))
  }
  as.integer(v)
}
