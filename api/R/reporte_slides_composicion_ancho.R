# reporte_slides_composicion_ancho.R — el ancho del panel de composición sale del marcador real del layout.
#
# CCSS Perfil 2026 (p_slide_6_graficos_poblacion): los slots de la composición no traen `loc` (son marcadores de la plantilla) y
# `.composicion_render` les pasaba 5.2 in por defecto a todos. Un panel de seis mide 3.91 in: el graficador envolvía y medía
# los rótulos para un cajón 1.3 in más ancho y se encimaban («Universitaria» sobre «Superior técnica»).

#' Ancho físico (in) del slot `nm` de una composición
#'
#' Primero `loc$width` del contrato; si no hay, el ancho del marcador del layout; si tampoco, `respaldo`.
#' @keywords internal
.composicion_ancho_slot <- function(doc, contract, nm, respaldo = 5.2) {
  spec <- contract$slots[[nm]]
  w <- suppressWarnings(as.numeric((spec$loc %||% list())$width)[1])
  if (length(w) && is.finite(w) && w > 0) return(w)
  props <- tryCatch(officer::layout_properties(doc, layout = contract$layout), error = function(e) NULL)
  sel <- if (!is.null(props) && !is.null(spec)) tryCatch(.ppt_slide_template_select_placeholder(props, spec), error = function(e) NULL)
  w <- suppressWarnings(as.numeric(sel$cx %||% NA)[1])
  if (length(w) && is.finite(w) && w > 0) w else respaldo
}
