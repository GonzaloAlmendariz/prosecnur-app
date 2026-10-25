# lamina_divergentes_area.R — L10-11 (mazo CCSS V2 aprobado, láminas 40, 45, 60 y 62): uso del alto en la divergente.
#
# La fila estaba acotada en 0.74 in y el bloque arrancaba pegado a `zona_datos_y0`: con tres afirmaciones la mitad de abajo
# de la zona quedaba vacía, y las afirmaciones iban a 10.5 pt (se leen como 8 en pantalla). Como `lamina_uso_area.R` en
# la categórica: la fila crece hasta un tope (1.2 in, barra hasta 0.45 in), el bloque se centra en el alto disponible y
# las afirmaciones toman el mayor cuerpo (12, 11.5 u 11 pt) con el que caben, ensanchando primero su columna (3.4 a
# 5.2 in). Si ni a 11 pt caben, se queda lo de siempre: 10.5 pt y `.lam_divergentes_wq`. Cifras y orden no cambian.

.LAM_DIV_AREA <- list(fila_max = 1.2, g_max = 0.45, cuerpos = c(12, 11.5, 11), w_min = 3.4, w_max = 5.2)

#' Geometría vertical y cuerpo de las afirmaciones de la divergente a lámina completa
#' @param filas Afirmaciones. @param yt,yf Borde superior de la zona de datos y fin del contenido.
#' @return `list(y0, fila, g, size, wq)`.
#' @keywords internal
.lam_divergentes_area <- function(filas, yt, yf) {
  A <- .LAM_DIV_AREA; n <- max(1L, length(filas))
  # La leyenda va 0.25 in bajo la última fila y mide ~0.3 in: se reservan 0.65 in para que no quede pegada a «Base:»
  # (con la reserva de antes, 0.35, una zona llena dejaba la leyenda encima del pie). El informe Arte no lleva divergentes.
  y_min <- yt + 0.3; disp <- yf - y_min - 0.65
  fila <- min(A$fila_max, disp / n); g <- min(A$g_max, fila * 0.55)
  y0 <- y_min + max(0, (disp - n * fila) / 2)
  tope <- if (fila >= 0.6) 3L else 2L
  for (size in A$cuerpos) for (w in seq(A$w_min, A$w_max, by = 0.1)) {
    ok <- all(vapply(filas, function(t) .lam_lineas(t, w, size, TRUE) <= tope && .lam_alto_txt(t, w, size, TRUE) <= fila - 0.04, TRUE))
    if (ok) return(list(y0 = y0, fila = fila, g = g, size = size, wq = w))
  }
  list(y0 = y0, fila = fila, g = g, size = 10.5, wq = .lam_divergentes_wq(filas, fila))
}
