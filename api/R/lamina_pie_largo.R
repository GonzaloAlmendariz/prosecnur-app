# lamina_pie_largo.R — la base de la lámina que no cabe en dos líneas no se sale por debajo de la lámina
#
# La base va en 7.06 in (composicion.pie del estándar) con su cuadro de 0.4 in: dos líneas caben antes del borde (7.5 in).
# Una lámina compuesta con cuatro gráficos de resumen junta en su pie la base de cada público, el sentido de la diferencia,
# el grupo chico y las filas de menos (lamina_resumen_ranura.R): con tres líneas la tercera quedaba fuera de la lámina
# (dumbbell de tres ciclos en cuatro ranuras, 2026-11-09). Con hasta dos líneas nada cambia; con más, el cuadro sube lo
# que miden las líneas de más sin pisar el fin del contenido y, si ni así cabe, la letra baja de a medio punto hasta 8 pt.

#' Cuadro de la base de la lámina: dónde empieza, su alto y su letra
#'
#' @param base Texto de la base.
#' @param size Letra del estándar para la base.
#' @param bold Si la base va en negrita.
#' @return `list(y, h, size)` en pulgadas y puntos.
#' @keywords internal
.lam_pie_caja <- function(base, size = .std_pt("base"), bold = FALSE, y = .std_comp("pie", "base_y"), w = 10.5) {
  piso <- .std_geom("contenido_y1") + 0.04; borde <- .std_valor("ppt", "geometria", "alto") - 0.04
  for (s in seq(size, 8, by = -0.5)) {
    lin <- max(1L, as.integer(.lam_lineas_tinta(base, w, s, bold)))
    h <- lin * s * 1.2 / 72 + 0.1   # márgenes internos del cuadro (0.05 in arriba y abajo)
    if (lin <= 2L) return(list(y = y, h = 0.4, size = s))
    y_s <- min(y, borde - h)
    if (y_s >= piso - 1e-9) return(list(y = y_s, h = h, size = s))
  }
  list(y = piso, h = borde - piso, size = 8)
}
