# =============================================================================
# lamina_plantilla_cliente.R — un mazo con plantilla de cliente se dibuja con su identidad
# =============================================================================
#
# El compositor nativo arma las láminas de gráfico con las piezas del recetario: título en coral, barra lateral, barras
# en el azul Pulso y la base como pie de lámina. Es la identidad de los informes Pulso. Un informe Pulso-ACNUR lleva la
# plantilla ACNUR (título negro, azul ACNUR, logo UNHCR) y su perfil de estilo; con las piezas del recetario encima
# salía con la identidad equivocada y, además, sin base: el plan ACNUR manda la base en la nota del gráfico y marca
# `suppress_footer_placeholder`, que la lámina nativa lee como "sin pie" (checklist-informe-acnur-2026-11-11, D1 y D2).
#
# La portada, el índice y el objetivo ya respetaban la plantilla de cliente (`.lam_plantilla_estandar`). Con esto las
# láminas de gráfico hacen lo mismo: con plantilla de cliente van por la ruta que lee los presets del perfil, salvo que
# la lámina pida el motor nativo de forma explícita (`meta$motor_nativo = TRUE`).

#' Plantillas de cliente registradas (`template_id` del contrato de plantillas y su archivo)
#' @keywords internal
.LAM_PLANTILLAS_CLIENTE <- c(acnur_16_9 = "plantilla_acnur_16_9.pptx")

#' ¿El mazo se abre sobre una plantilla de cliente?
#' @keywords internal
.lam_plantilla_de_cliente <- function(ruta, template_id = NULL) {
  id <- trimws(as.character(template_id %||% "")[1])
  if (!is.na(id) && id %in% names(.LAM_PLANTILLAS_CLIENTE)) return(TRUE)
  r <- as.character(ruta %||% "")[1]
  !is.na(r) && nzchar(r) && basename(r) %in% .LAM_PLANTILLAS_CLIENTE
}

#' Con plantilla de cliente, la lámina va por la ruta de la plantilla salvo que pida el motor nativo
#'
#' Enganche de `reporte_ppt_plan`, lámina por lámina. Sólo escribe `meta$motor_nativo = FALSE` cuando la lámina no
#' declaró nada: lo que el plan o el analista fijaron manda.
#' @keywords internal
.lam_motor_de_plantilla <- function(slide, ruta, template_id = NULL) {
  if (!.lam_plantilla_de_cliente(ruta, template_id)) return(slide)
  if (!is.null((slide$meta %||% list())$motor_nativo)) return(slide)
  slide$meta <- utils::modifyList(slide$meta %||% list(), list(motor_nativo = FALSE))
  slide
}
