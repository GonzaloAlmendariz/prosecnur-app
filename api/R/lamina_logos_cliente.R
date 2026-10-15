# =============================================================================
# lamina_logos_cliente.R — los logos propios del cliente en la portada y la contraportada nativas del PPT (D5, ID9)
# =============================================================================
#
# El estilo del cliente (graficos_estilo_cliente.R) llega al worker del PPT ya resuelto a rutas de PNG. El worker los
# deja en la opción `prosecnur.logos_cliente` (graficos_estilo_cliente_worker.R) y la portada y el cierre del recetario
# (lamina_identidad.R) los ponen aquí, sin que el compositor del mazo (reporte_plan_ppt.R) tenga que conocerlos.
#
# Sólo sobre la plantilla ESTÁNDAR de PULSO: las portadas de cliente (ACNUR) tienen su propia composición y no se tocan
# (`.lam_plantilla_estandar`). En la estándar los logos por defecto vienen del layout, no del código: el logo propio los
# REEMPLAZA en la misma caja tapándolos con un rectángulo del color del fondo y poniendo el PNG encima, con su
# proporción («contain», centrado en la caja).
#
# Cajas medidas en `inst/plantillas/plantilla_16_9.pptx` (EMU / 914400):
# - «Title Slide» (slideLayout1): a la izquierda el de PULSO PUCP (501835, 432317, 2632817 x 1155425) y a la derecha el
#   de PUCP (8611445, 265713, 3181748 x 1586491). En el Word es al revés (PUCP a la izquierda): el lugar manda, no el
#   logo que hoy lo ocupa.
# - «Contraportada» (slideLayout14): el de PULSO PUCP centrado (4089679, 1975757, 4012643 x 2445629).
# Un cambio de plantilla que mueva esos logos obliga a volver a medir: lo cubre test-lamina-logos-cliente.R.

#' Caja (l, t, w, h en pulgadas) del logo de la plantilla estándar que reemplaza cada lugar
#' @keywords internal
.LAM_LOGOS_CLIENTE_CAJAS <- list(
  portada_izquierda = c(501835, 432317, 2632817, 1155425) / 914400,
  portada_derecha   = c(8611445, 265713, 3181748, 1586491) / 914400,
  contraportada     = c(4089679, 1975757, 4012643, 2445629) / 914400
)

# Lugares puestos durante el render en curso: el worker los lee al terminar para avisar de lo que no se pudo poner.
.lam_logos_cliente_estado <- new.env(parent = emptyenv())

#' Reinicia el registro de logos puestos (lo llama el worker antes de renderizar)
#' @keywords internal
.lam_logos_cliente_reiniciar <- function() {
  .lam_logos_cliente_estado$puestos <- character(0)
  invisible(NULL)
}

#' Lugares cuyo logo propio quedó puesto en el render en curso
#' @keywords internal
.lam_logos_cliente_puestos <- function() .lam_logos_cliente_estado$puestos %||% character(0)

#' Logos propios vigentes para unos lugares: `list(lugar = ruta)` sólo con los que existen
#' @keywords internal
.lam_logos_cliente <- function(lugares) {
  x <- getOption("prosecnur.logos_cliente") %||% list()
  x <- x[intersect(lugares, names(x))]
  x[vapply(x, function(p) is.character(p) && length(p) == 1L && !is.na(p) && nzchar(p) && file.exists(p), logical(1))]
}

#' Caja «contain» del PNG dentro de la caja del lugar (centrada); la caja entera si no se lee su cabecera
#' @keywords internal
.lam_logo_cliente_contain <- function(ruta, caja) {
  dims <- .mini_png_dims(ruta)
  aspecto <- as.numeric(dims[["width"]]) / as.numeric(dims[["height"]])
  if (!is.finite(aspecto) || aspecto <= 0) return(caja)
  w <- caja[3]; h <- caja[4]
  if (w / h > aspecto) w <- h * aspecto else h <- w / aspecto
  c(caja[1] + (caja[3] - w) / 2, caja[2] + (caja[4] - h) / 2, w, h)
}

#' Tapa en el lienzo los logos de la plantilla que el cliente reemplaza; devuelve los logos a poner tras agrupar
#'
#' La tapa sobra 0.02 in por lado para que el borde antialiasado del PNG de la plantilla no asome.
#' @param lz Lienzo de la lámina (antes de `.lam_agrupar`).
#' @param lugares Lugares que la lámina admite (`portada_izquierda`, `portada_derecha` o `contraportada`).
#' @return `list(lugar = ruta)` para `.lam_logos_cliente_poner`.
#' @keywords internal
.lam_logos_cliente_tapar <- function(lz, lugares) {
  logos <- .lam_logos_cliente(lugares)
  for (lugar in names(logos)) {
    k <- .LAM_LOGOS_CLIENTE_CAJAS[[lugar]]
    .lam_caja(lz, k[1] - 0.02, k[2] - 0.02, k[3] + 0.04, k[4] + 0.04, .std_color("fondo"), nombre = paste0("logo_cliente:tapa:", lugar))
  }
  logos
}

#' Pone los logos propios sobre sus tapas (después de agrupar el lienzo, para quedar encima) y los registra
#' @keywords internal
.lam_logos_cliente_poner <- function(doc, logos) {
  for (lugar in names(logos)) {
    k <- .lam_logo_cliente_contain(logos[[lugar]], .LAM_LOGOS_CLIENTE_CAJAS[[lugar]])
    doc <- officer::ph_with(doc, officer::external_img(logos[[lugar]], width = k[3], height = k[4]),
                            location = officer::ph_location(left = k[1], top = k[2], width = k[3], height = k[4],
                                                            newlabel = paste0("logo_cliente:", lugar)))
    .lam_logos_cliente_estado$puestos <- union(.lam_logos_cliente_puestos(), lugar)
  }
  doc
}
