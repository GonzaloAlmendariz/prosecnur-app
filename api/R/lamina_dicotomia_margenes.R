# lamina_dicotomia_margenes.R — la dicotomía «partida» de la lámina completa respeta los márgenes del estándar.
#
# CCSS Perfil 2026 (láminas 14, 21, 22 y 54): la barra partida iba de `margen_izq` a `ancho - margen_der`. Como las cajas de
# texto llevan 0.1 in de sangría, el borde izquierdo de la barra quedaba 0.1 in fuera del texto del título y el derecho a
# 0.315 in del borde de la lámina (contra 0.595 a la izquierda): un margen desigual que se leía como «sin margen derecho».
# Ahora la barra va de borde de texto a borde de texto, con el mismo margen a ambos lados, y el bloque se centra en la zona
# de datos. Los paneles (corona, mixtas, filtro-sub) siguen con su geometría: sólo la lámina completa usa esto.

#' Sangría interior de las cajas de texto del compositor (in)
#' @keywords internal
.LAM_SANGRIA_TXT <- 0.1

#' Geometría de la dicotomía partida a lámina completa
#'
#' @param con_pregunta ¿Lleva el enunciado del panel sobre la barra?
#' @return `list(x, w, dy)`: borde izquierdo y ancho de la barra (in) y cuánto baja el bloque para centrarse en la zona de datos.
#' @keywords internal
.lam_dicotomia_partida_geo <- function(con_pregunta = TRUE) {
  W <- .std_geom("ancho"); ml <- .std_geom("margen_izq"); yt <- .std_geom("zona_datos_y0"); yf <- .std_geom("contenido_y1")
  x <- ml + .LAM_SANGRIA_TXT
  # Alto del bloque con la geometría de `.lam_dicotomia` a 40 pt: cifra (34 pt), rótulo 0.38 y barra 0.7; el enunciado suma 0.8.
  cuerpo <- round(40 * 0.85) * 1.25 / 72 + 0.38 + 0.7
  alto <- cuerpo + if (isTRUE(con_pregunta)) 0.8 else 0
  arranque <- if (isTRUE(con_pregunta)) 0.3 else 1.1
  list(x = x, w = W - 2 * x, dy = max(0, (yf - yt - alto) / 2 - arranque))
}
