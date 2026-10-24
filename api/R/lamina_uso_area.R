# =============================================================================
# lamina_uso_area.R — uso del área de datos por las categóricas en barras (CCSS, 2026-10-24)
# =============================================================================
#
# Con pocas categorías (4-6) las barras horizontales quedaban pegadas arriba: la fila estaba acotada en 0.62 in y el
# bloque arrancaba en `zona_datos_y0 + 0.2`, dejando un vacío grande hasta «Base:». Aquí la fila crece hasta un tope
# (barra ≤ 0.55 in, fila ≤ 1.6 × la barra) y el bloque se centra verticalmente en la zona. Con ≥ 8 categorías la fila
# ya la manda el alto disponible y nada cambia.

#' Tope de la fila (in) de las barras horizontales de una serie: barra ≤ 0.55 in y fila = 1.6 × barra
#' @keywords internal
.LAM_USO_AREA <- list(barra_max = 0.55, fila_max = 0.88, fila_vieja = 0.62, g_vieja = 0.42, sobre = 0.2, reserva = 0.45)

#' Fila y grosor de barra para `n` categorías en la zona de datos
#' @keywords internal
.lam_uso_area_fila <- function(n, disp) {
  U <- .LAM_USO_AREA; n <- max(1L, n)
  fila <- min(U$fila_max, disp / n)
  list(fila = fila, g = min(U$barra_max, fila * 0.62))
}

#' Desplazamiento vertical (in) desde `zona_datos_y0` del primer renglón: el bloque se centra en el alto disponible
#' @keywords internal
.lam_uso_area_arranque <- function(n, fila, extra = 0, disp = .std_geom("contenido_y1") - .std_geom("zona_datos_y0") - .LAM_USO_AREA$reserva) {
  U <- .LAM_USO_AREA
  U$sobre + max(0, (disp - n * fila - extra) / 2)
}
