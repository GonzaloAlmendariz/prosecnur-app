# =============================================================================
# reporte_plan_icono_cajon.R — dónde va el ícono del público en un layout, y el aviso si no tiene dónde (K15)
# =============================================================================
#
# `.ppt_calibrar_pies_iconos` (reporte_plan_helpers.R) sólo aceptaba un cajón cuadrado de 1 in o más, centrado: el de
# los layouts históricos de población, con el ícono en medio de los gráficos. Al pasar el ícono de cinco y seis gráficos
# a la cabecera, como lo dibuja el recetario (p164/p166: un cuadrado de 0.3 en 0.495, 0.165), el cajón dejó de calificar,
# el slot quedó `suppress` y `.ph_with_strict` lo omitía sin decir nada (verificador de la 2.ª vuelta de K15).

#' El cajón del ícono del público en un layout, o `NULL`
#'
#' Primero el cuadrado grande centrado (layouts históricos); si no hay, el cuadrado chico de la cabecera (sobre la zona de
#' datos). Un cajón no cuadrado (el del logo de la derecha, 2.1 × 0.9) no califica.
#' @param bodies `layout_properties()` de los `body` del layout.
#' @keywords internal
.ppt_cajon_icono <- function(bodies, slide_dims) {
  cuadrado <- abs(bodies$cx - bodies$cy) <= pmax(0.6 * pmin(bodies$cx, bodies$cy), 0.05)
  grandes <- bodies[bodies$offy < slide_dims$height * 0.72 & bodies$cy >= 1 & bodies$cx <= 3 & abs(bodies$cx - bodies$cy) <= 0.6, , drop = FALSE]
  if (nrow(grandes)) {
    centrado <- abs(grandes$offx + grandes$cx / 2 - slide_dims$width / 2)
    return(grandes[which.min(centrado), , drop = FALSE])
  }
  cabecera <- bodies[cuadrado & bodies$cx <= 0.6 & bodies$offy + bodies$cy <= .std_geom("zona_datos_y0"), , drop = FALSE]
  if (nrow(cabecera)) return(cabecera[which.min(cabecera$offx), , drop = FALSE])
  NULL
}

#' Texto del aviso cuando el layout no tiene dónde poner el ícono
#' @keywords internal
.ppt_aviso_icono_suprimido <- function(layout_name) {
  sprintf("El layout «%s» de la plantilla no tiene un cajón para el ícono del público: la lámina sale sin ícono.", layout_name)
}

#' Un slot sin cajón se omite; si el omitido es algo que el usuario puso (el ícono), se avisa
#' @keywords internal
.ppt_slot_suprimido <- function(doc, spec) {
  aviso <- spec$aviso_supresion
  if (is.character(aviso) && length(aviso) == 1L && nzchar(aviso)) .pulso_aviso(aviso)
  doc
}
