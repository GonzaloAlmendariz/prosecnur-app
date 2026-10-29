# =============================================================================
# lamina_portada_plantilla.R — la portada que va sobre el layout «Title Slide», como la aprobada de Contabilidad
# =============================================================================
#
# Checklist Arte vs Conta (2026-10-29), ítem 26, aprobado por Gonzalo. Cuando el título no cabe en la portada del
# recetario (`.lam_portada_cabe`) el motor llena los placeholders del layout «Title Slide» de `plantilla_16_9.pptx`
# (`reporte_plan_ppt.R`, rama TITLE SLIDE). Ahí salían dos cosas distintas de Conta:
#
#   1. El título en coral: el color caía a `color_titulo_slide` y, sin preset, a `.std_color("coral")`. En Conta y en
#      la portada nativa del recetario el título de portada es azul (#081F5C).
#   2. La fecha arriba y el encargo abajo, a 12 pt: es el orden del layout (fecha en y = 5,50, cuerpo en y = 6,49).
#      Conta los lleva al revés: «Por encargo de…» a 18 pt centrado en y = 5,50 y la fecha a la derecha en y = 6,21.
#
# Sólo aplica a la plantilla estándar de PULSO: las portadas de cliente (ACNUR) tienen su propia composición y se
# respetan, igual que en `.lam_plantilla_estandar`.
#
# Las cajas (pulgadas) y los tamaños de Conta viven en el estándar, `composicion.portada_plantilla`.

#' Caja de Conta del encargo o de la fecha de la portada de plantilla, como `c(left, top, width, height)`
#' @keywords internal
.lam_portada_caja <- function(cual) unlist(.std_comp("portada_plantilla", cual))[c("left", "top", "width", "height")]

# Los placeholders del layout «Title Slide» de plantilla_16_9.pptx: con `ph_xml` el texto sigue heredando su estilo
# aunque la caja vaya por coordenadas (ver `.ph_with_strict`).
.LAM_PORTADA_PLANTILLA_PH <- c(date = '<p:ph type="dt" idx="11"/>', subtexto = '<p:ph type="body" sz="quarter" idx="12"/>')

#' Color de fábrica del título cuando ningún preset lo declara: azul en la portada de la plantilla estándar, coral en el
#' resto (las láminas; y la portada de una plantilla de cliente, que conserva lo de siempre)
#' @keywords internal
.lam_portada_titulo_color_defecto <- function(es_portada, plantilla = NULL) {
  if (isTRUE(es_portada) && .lam_plantilla_estandar(plantilla)) .std_color("azul") else .std_color("coral")
}

#' Slot de la fecha o del encargo de la portada de plantilla: en la plantilla estándar va en la caja de Conta (orden
#' encargo → fecha); en otra plantilla, el slot del contrato sin tocar
#' @param spec Slot de `PPT_CONTRACT$title_slide$slots`.
#' @param clave `"date"` o `"subtexto"`.
#' @keywords internal
.lam_portada_slot_plantilla <- function(spec, clave, plantilla = NULL) {
  if (!.lam_plantilla_estandar(plantilla) || !clave %in% names(.LAM_PORTADA_PLANTILLA_PH)) return(spec)
  caja <- .lam_portada_caja(if (identical(clave, "date")) "fecha" else "encargo")
  spec$loc <- as.list(caja)
  spec$ph_xml <- .LAM_PORTADA_PLANTILLA_PH[[clave]]
  spec
}

#' Valor del encargo de la portada de plantilla: 18 pt azul centrado como Conta en la plantilla estándar (la fuente, del
#' placeholder); en otra plantilla, el texto tal cual
#'
#' El color va explícito a propósito: officer 0.7.1 no escribe el `rPr` de un `fp_text_lite()` que sólo trae
#' `font.size`, y el encargo se quedaba en los 12 pt del layout.
#' @keywords internal
.lam_portada_encargo_valor <- function(texto, plantilla = NULL) {
  .lam_portada_parrafo(texto, plantilla, .std_comp("portada_plantilla", "encargo_pt"), "center")
}

#' Valor de la fecha de la portada de plantilla: alineada a la derecha de su caja como Conta (el layout la deja a la
#' izquierda), a los 18 pt del placeholder `dt`; en otra plantilla, el texto tal cual
#' @keywords internal
.lam_portada_fecha_valor <- function(texto, plantilla = NULL) {
  .lam_portada_parrafo(texto, plantilla, .std_comp("portada_plantilla", "fecha_pt"), "right")
}

#' Párrafo de la portada de plantilla con tamaño, azul y alineación explícitos (sólo en la plantilla estándar)
#' @keywords internal
.lam_portada_parrafo <- function(texto, plantilla, pt, alinear) {
  if (!.lam_plantilla_estandar(plantilla)) return(texto)
  officer::fpar(officer::ftext(texto, officer::fp_text_lite(font.size = pt, color = .std_color("azul"))),
                fp_p = officer::fp_par_lite(text.align = alinear))
}
