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
