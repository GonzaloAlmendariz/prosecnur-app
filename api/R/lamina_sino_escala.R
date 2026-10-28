# lamina_sino_escala.R — la Sí/No que se dibuja como escala de dos opciones (multilista, lámina completa), revisión de
# Gabriela Palacios al informe de Arte (2026-10-28).
#
# G8 («me parece que es mejor colocar todo en color blanco»): la cifra dentro de la barra Sí/No va en blanco en los dos
# segmentos, también sobre el celeste del «No» (Contabilidad, vf.pdf p. 23: «8%», «2%» blancos sobre el celeste). Las
# opciones especiales (SIN INF, en gris) y las cifras que no caben y salen fuera conservan su color legible.
#
# G17 («las barras tienen que tener el mismo largo… no puede quedar la barra en tamaño distinto que la de abajo»): en una
# lámina que junta una Sí/No con una escala con Top Two Box, la Sí/No no llega hasta la columna del box: mide y arranca
# como la barra de la escala (`.std_geom("likert")$x_barra` y `$ancho_barra`, leídos del token). Sola en su lámina conserva
# su ancho casi completo.
#
# Las funciones de aquí son puras; el cableado vive en `.lam_escala_seg`, `.lam_barra_apilada` y `.lam_bloque_escala`
# (lamina_escala.R) y en `.lam_multilista_bloques` (lamina_multilista.R).

#' ¿Cada categoría de la escala lleva su cifra en blanco? Sólo las propias de una escala Sí/No (G8)
#'
#' @return Lógico, uno por categoría de `espec$categorias`.
#' @keywords internal
.lam_escala_sino_blanca <- function(espec) {
  k <- NROW(espec$categorias)
  if (!k || !identical(espec$tipo, "escala") || !isTRUE(.lam_dicotomia_es_sino(espec))) return(rep(FALSE, k))
  !(espec$categorias$especial %in% TRUE)
}

#' Color de la cifra que va dentro de su segmento: blanco si el segmento es de una Sí/No (G8); si no, el de contraste
#' @keywords internal
.lam_cifra_color_seg <- function(seg, k) {
  if (isTRUE(seg$blanca[k])) "#FFFFFF" else .lam_texto_sobre(seg$color[k])
}

#' Marca las Sí/No de una lámina que también lleva una escala con Top Two Box: su barra mide la de la escala (G17)
#'
#' @param items Bloques de UNA lámina (`.lam_multilista_items`), cada uno con su `espec`.
#' @return Los mismos bloques; las Sí/No sin box, con `espec$ancho_como_escala = TRUE`.
#' @keywords internal
.lam_multilista_igualar_ancho <- function(items) {
  con_box <- vapply(items, function(it) !is.null(it$espec$box$unidades), TRUE)
  if (!any(con_box)) return(items)
  for (k in which(!con_box)) if (isTRUE(.lam_dicotomia_es_sino(items[[k]]$espec))) items[[k]]$espec$ancho_como_escala <- TRUE
  items
}
