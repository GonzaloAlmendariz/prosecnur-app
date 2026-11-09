# =============================================================================
# graficos_dumbbell_eje.R — el eje de porcentaje del dumbbell: de cuatro a cinco marcas (D5, aprobado por Gonzalo)
# =============================================================================
#
# El dumbbell clásico rotulaba 45 %, 55 %, …, 95 % (paso 10 desde un múltiplo de 5) y el contraste del resumen,
# 40 %, 50 %, …, 100 % (siete marcas). Gonzalo, 2026-11-09 («Sí, los tres»): el eje lleva de cuatro a cinco marcas, con
# paso 10 en los rangos medianos y paso 5 sólo en los muy estrechos.
#
# Regla: se prueba el paso 5 (sólo si los datos caben en menos de 20 puntos), luego 10, 20 y 25; el eje arranca y
# termina en múltiplos del paso, no sale de 0–100, y gana el primer paso que deja de cuatro a cinco marcas. P8
# (2026-11-09): «65, 75, 85, 95» se veía raro; con paso 10 el eje va «60, 70, 80, 90, 100» (se deshace fc116b9e7), con
# su «100%» rotulado: R3 de verificar_mazo no cuenta las cifras del eje (`.verif_tamanos_texto`). Un eje tiene al menos tres pasos de ancho, así que nunca queda en un punto (lo == hi): con todos los valores
# en 80 el eje va de 75 a 90, no de 80 a 80.

#' Paso de un eje fijado a mano (`limite_x`): el que deja de cuatro a cinco marcas
#' @keywords internal
.dumbbell_eje_paso <- function(lo, hi) {
  for (paso in c(5, 10, 20, 25)) if ((hi - lo) / paso <= 4 + 1e-9) return(paso)
  (hi - lo) / 4
}

#' Eje de porcentaje del dumbbell: `c(lo, hi, paso)` con cuatro o cinco marcas
#'
#' @param valores Cifras que dibuja el gráfico (0–100). @param limite_x `c(lo, hi)` fijado por el analista, o un solo
#'   número (el tope).
#' @param holgura Puntos de aire a cada lado de los datos antes de redondear al paso.
#' @keywords internal
.dumbbell_eje <- function(valores, limite_x = NULL, holgura = 3) {
  lim <- suppressWarnings(as.numeric(limite_x))
  if (length(lim) == 2L && all(is.finite(lim)) && lim[2] > lim[1]) return(c(lo = lim[1], hi = lim[2], paso = .dumbbell_eje_paso(lim[1], lim[2])))
  v <- suppressWarnings(as.numeric(valores)); v <- v[is.finite(v)]
  if (!length(v)) return(c(lo = 0, hi = 100, paso = 25))
  vmin <- max(0, min(v)); vmax <- min(100, max(v))
  tope <- if (length(lim) == 1L && is.finite(lim) && lim > vmin) lim else NA_real_
  for (paso in c(5, 10, 20, 25)) {
    if (paso == 5 && (vmax - vmin) >= 20) next   # paso 5 sólo para rangos muy estrechos (menos de 20 puntos de datos)
    # P8: el eje arranca y termina en múltiplos del paso: con paso 10, 60, 70, 80, 90, 100, nunca 65, 75, 85, 95.
    lo <- max(0, floor((vmin - holgura) / paso) * paso)
    hi <- if (is.finite(tope)) tope else min(100, ceiling((vmax + holgura) / paso) * paso)
    if (hi - lo < 3 * paso) {   # al menos tres pasos: el eje no se cierra sobre un punto
      if (is.finite(tope)) lo <- max(0, hi - 3 * paso) else hi <- min(100, lo + 3 * paso)
      if (hi - lo < 3 * paso) lo <- max(0, hi - 3 * paso)
    }
    n <- floor((hi - lo) / paso + 1e-9) + 1
    if (n >= 4 && n <= 5) return(c(lo = lo, hi = hi, paso = paso))
  }
  c(lo = 0, hi = 100, paso = 25)
}
