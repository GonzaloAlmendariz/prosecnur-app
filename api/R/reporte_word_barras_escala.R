# =============================================================================
# reporte_word_barras_escala.R — hasta dónde llega el eje de las barras categóricas del Word
# =============================================================================
#
# Gonzalo, 2026-11-09: los gráficos del Word deben tener «el mismo ancho de los textos». La imagen ya iba al ancho de
# texto, pero el eje de las barras llegaba a 112 % (con pista) o a 118 % del máximo (sin pista): la pista terminaba un 11 %
# antes del margen derecho y el gráfico se veía más angosto que los párrafos. Ahora el eje llega a lo justo para que la
# cifra más ancha quepa junto a su barra: con pista, la pista toca el margen salvo que una barra cerca del 100 % necesite
# sitio para su cifra.

#' Fin del eje (en %) de una figura de barras del Word: lo justo para que cada cifra quepa tras su barra
#'
#' La cifra va en `p + 0.015 · esc` y mide su tinta en pulgadas. Con la misma conversión que `.word_xmin()` (el rango
#' `[xmin, esc]` ocupa el ancho útil y la columna de rótulos `col_in`), la condición `p + 0.015·esc + w·esc/B <= esc`, con
#' `B` las pulgadas que le tocan al rango `[0, esc]`, da `esc >= p / (1 - 0.015 - w/B)`.
#' @param p Porcentajes de las barras. @param cifras Textos de las cifras («38%», «<1%»).
#' @param base Piso del eje: 100 con pista o escala completa; si no, el máximo.
#' @param col_in Columna de rótulos (pulgadas), la misma que recibe `.word_xmin()`.
#' @keywords internal
.word_barras_escala <- function(p, cifras, base, col_in, pt = 9, aire_in = 0.06) {
  W <- .std_word("pagina", "ancho_util")
  B <- (W - 0.3 - col_in) * W / (W - 0.3)
  p <- ifelse(is.finite(p), p, 0)
  w <- vapply(as.character(cifras), function(x) if (is.na(x) || !nzchar(x)) 0 else .word_texto_in(x, pt), 0) + aire_in
  frac <- pmax(0.2, 1 - 0.015 - w / B)
  max(base, max(p / frac), 1e-6)
}
