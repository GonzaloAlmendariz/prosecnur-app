# =============================================================================
# lamina_corona.R — cómo dibuja la p160 cada panel de «Tres gráficos en corona»
# =============================================================================
#
# Las ranuras de la corona salen del estándar (`ppt.tipos_lamina`, `.lam_corona_geo`); lo que el panel dibuja dentro lo
# pone la regla compartida de las mixtas (`.lam_panel_geo`) salvo donde la p160 de recetario-moderna.pptx fija otra
# cosa a mano. Manda lo dibujado (Gonzalo: «el recetario siempre manda»); el código que lo generó es
# docs/qa/motor-ppt-2026-10-06/herramientas/recetario_m2c.R:36-49, y medido con python-pptx sobre la p160:
#
# - Dicotomía (sexo, :42): `dicotomia(ML, YT + 0.65, wc, ..., n, size = 24, g = 0.38)`. A todo el ancho del panel
#   (cifras en x 0.495 y 4.757, borde derecho 6.357), con la frecuencia en el rótulo («Masculino (33)»). La regla
#   compartida la deja a w − 0.8 y sin frecuencia (recetario.R:190, la dicotomía que sale de `barras_h`).
# - Barras de arriba a la derecha (:44): `barras_h(xc2, YT + 0.55, wc, ..., wlab = 1.4, fila = 0.42)`: rótulo de 1.4 in
#   (barras desde x 8.677), la primera fila 0.55 in bajo la pregunta.
# - Barras de abajo (:48): `barras_h(ML + 2.5, YT + 3.1, ANCHO - 5, ..., wlab = 1.9, fila = 0.42)`: el bloque centrado
#   con 2.5 in de sangría a cada lado (rótulos en x 2.995, barras en 5.015), filas de 0.42 in.
#
# El orden de las categorías (la p160 sigue el instrumento; el motor, la frecuencia) no se toca aquí: depende de la
# decisión D8.

#' Receta de la p160 para el panel `k` de la corona (1 arriba a la izquierda, 2 arriba a la derecha, 3 abajo)
#'
#' @return Lista con `dicotomia` (`ancho_pleno`, `con_n`, `size`, `g`) y `barras` (`wlab` mínimo, `fila` tope, `dy`
#'   bajo la pregunta y `sangria` a cada lado).
#' @keywords internal
.lam_corona_receta <- function(k) {
  dicotomia <- list(ancho_pleno = TRUE, con_n = TRUE, size = 24, g = 0.38)
  barras <- if (identical(as.integer(k), 3L)) list(wlab = 1.9, fila = 0.42, dy = 0.55, sangria = 2.5)
            else list(wlab = 1.4, fila = 0.42, dy = 0.55, sangria = 0)
  list(dicotomia = dicotomia, barras = barras)
}
