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
  # La paleta por defecto de la plantilla rige la lámina que viene (o se apaga): el respaldo de paleta del motor la lee.
  options(prosecnur.paleta_defecto = .lam_paleta_defecto_de_plantilla(ruta, template_id))
  if (!.lam_plantilla_de_cliente(ruta, template_id)) return(slide)
  if (!is.null((slide$meta %||% list())$motor_nativo)) return(slide)
  slide$meta <- utils::modifyList(slide$meta %||% list(), list(motor_nativo = FALSE))
  slide
}

#' Paleta por defecto de cada plantilla de cliente: la que toma una lista sin paleta propia
#'
#' Una barra al 100 % colorea cada opción. Sin paleta de la lista (por nombre, vínculo o firma) el motor usaba la rampa
#' del estándar Pulso, en azul marino, también en un informe ACNUR. Con plantilla de cliente la lista sin paleta toma la
#' de la plantilla: la primera opción en el azul ACNUR, las siguientes en azules más claros y las respuestas que no son
#' sustantivas (no sabe, no responde, otro) en gris (checklist-pestana-plantillas-2026-11-11, P1).
#' @keywords internal
.LAM_PALETA_DEFECTO_CLIENTE <- list(
  acnur_16_9 = list(secuencia = c(.ACNUR_PPT_COLORS$blue, .ACNUR_PPT_COLORS$light_blue),
                    residual = c(.ACNUR_PPT_COLORS$control, .ACNUR_PPT_COLORS$gray))
)

#' Paleta por defecto de la plantilla del mazo, o `NULL` si no es de cliente
#' @keywords internal
.lam_paleta_defecto_de_plantilla <- function(ruta, template_id = NULL) {
  if (!.lam_plantilla_de_cliente(ruta, template_id)) return(NULL)
  id <- trimws(as.character(template_id %||% "")[1])
  if (is.na(id) || !id %in% names(.LAM_PALETA_DEFECTO_CLIENTE)) {
    r <- basename(as.character(ruta %||% "")[1])
    id <- names(.LAM_PLANTILLAS_CLIENTE)[match(r, .LAM_PLANTILLAS_CLIENTE)]
  }
  if (is.na(id) || !length(id)) return(NULL)
  .LAM_PALETA_DEFECTO_CLIENTE[[id]]
}

#' Colores por defecto para unos rótulos con la paleta de la plantilla: azules para los sustantivos, grises al resto
#'
#' Cada grupo toma sus colores en orden y, si son más que los declarados, la rampa entre ellos. Los grises de la no
#' respuesta van del más claro hacia el oscuro sin llegar a él: "No sabe" y "No responde" en la misma barra se distinguen.
#' @keywords internal
.lam_paleta_defecto_colores <- function(levels, paleta) {
  ns <- .graficos_rotulo_residual(levels)
  if (all(ns)) ns <- rep(FALSE, length(levels))
  tonos <- function(cols, n, hasta_el_ultimo = TRUE) {
    cols <- as.character(cols)
    if (!n) return(character(0))
    if (length(cols) == 1L) return(rep(cols, n))
    if (hasta_el_ultimo && n <= length(cols)) return(cols[seq_len(n)])
    rampa <- grDevices::colorRampPalette(cols)
    if (hasta_el_ultimo) rampa(n) else utils::head(rampa(n + 1L), n)
  }
  out <- stats::setNames(character(length(levels)), levels)
  out[!ns] <- tonos(paleta$secuencia, sum(!ns))
  out[ns] <- tonos(paleta$residual, sum(ns), hasta_el_ultimo = FALSE)
  out
}
