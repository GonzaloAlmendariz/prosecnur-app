# lamina_mixtas_leyenda_compartida.R — la leyenda compartida de una lámina mixta va con los gráficos que la usan
#
# Ola 2, G7 (captura «I. Cuatro gráficos con exclusión»): los dos paneles de escala de la fila de arriba compartían
# leyenda y la lámina la dibujaba al pie, a todo el ancho, bajo las dos barras categóricas de abajo, que no la usan. Y uno
# de los dos paneles iba de respaldo, con su propia leyenda dentro de la imagen: la de la lámina la repetía.
#
# Regla, por fila de paneles que comparten la escala:
#   - si en la fila hay un panel de respaldo con esa escala, su imagen ya trae la leyenda: la lámina no la repite;
#   - si debajo de la fila hay otros paneles, o la fila tiene paneles que no la usan, va bajo la fila, centrada en el
#     ancho de los paneles que la usan (partida en filas si hace falta);
#   - si no, donde iba: al pie de la lámina, centrada. Sólo geometría.

#' Dibuja la leyenda compartida de una lámina mixta
#' @param P Paneles (`geo$paneles`). @param fines `y` donde terminó cada panel dibujado.
#' @keywords internal
.lam_mixta_leyenda_compartida <- function(lz, especs, P, compartida, respaldo, fines) {
  nativo <- vapply(seq_along(especs), function(k) is.null((respaldo %||% list())[k][[1]]), TRUE)
  U <- which(compartida & nativo)
  if (!length(U)) return(invisible(NULL))
  e1 <- especs[[U[1]]]; ley <- e1$leyenda
  labels <- e1$categorias$rotulo[ley]; cols <- e1$categorias$color[ley]
  ys <- vapply(P, `[[`, 0, "y")
  for (yr in unique(ys[U])) {
    Uy <- U[ys[U] == yr]
    if (any(compartida & !nativo & abs(ys - yr) < 1e-6)) next   # la imagen de respaldo de la fila ya la trae
    hay_abajo <- any(ys > yr + 1e-6)
    fila_parcial <- length(Uy) < sum(abs(ys - yr) < 1e-6)
    if (!hay_abajo && !fila_parcial) {
      .lam_leyenda(lz, .std_geom("contenido_y1") - 0.05, labels, cols, centrar_en = .std_geom("ancho") / 2)
      next
    }
    x0 <- min(vapply(P[Uy], `[[`, 0, "x")); x1 <- max(vapply(P[Uy], function(p) p$x + p$w, 0))
    tope <- min(vapply(P[Uy], function(p) p$y + p$h, 0))
    n_filas <- max(1L, length(.lam_leyenda_filas(labels, x1 - x0)))
    yl <- min(max(fines[Uy]) + 0.05, tope - 0.3 * n_filas)
    .lam_leyenda_panel(lz, yl, labels, cols, centro = (x0 + x1) / 2, x0 = x0, x1 = x1)
  }
  invisible(NULL)
}
