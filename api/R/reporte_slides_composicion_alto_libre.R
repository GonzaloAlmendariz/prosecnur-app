# reporte_slides_composicion_alto_libre.R — la lámina de dos gráficos en vertical con imagen usa el alto libre del pie
#
# Ola 4, A7 (lámina «G. 2 vertical divergente con saldo»): cuando la lámina sólo lleva título y gráficos, G1 (ola 2,
# lamina_paneles_vertical_alto.R) reparte el alto libre en la composición nativa. La de respaldo (divergente o apilada de
# imagen en los huecos de la plantilla) no lo veía: cada gráfico lleva su «Base:» dentro y el pie de la lámina queda vacío,
# pero los huecos terminaban donde empieza el pie y la lámina dejaba ~10 % de su alto en blanco abajo.
#
# Regla: si la lámina no escribe base en el pie, los dos huecos crecen hasta el arranque del marcador de la base (el alto
# que ganan se reparte por mitades y el de abajo baja lo que crece el de arriba). Con base en el pie, nada cambia.

#' Huecos de `graficos_2_vertical` estirados al alto libre del pie cuando la lámina no lleva base
#'
#' @param doc Documento `rpptx` (para leer el layout).
#' @param contract Entrada de `.PPT_CONTRACT`.
#' @param slide La lámina del plan.
#' @param stype Tipo de lámina.
#' @return `contract` con `loc` en `superior` e `inferior`, o igual si no aplica.
#' @keywords internal
.composicion_vertical_alto_libre <- function(doc, contract, slide, stype) {
  if (!identical(stype, "graficos_2_vertical")) return(contract)
  slots <- slide$slots %||% list()
  base <- slots$base %||% slots$footer
  if (inherits(base, "ppt_element_text")) base <- base$text
  if (inherits(base, "ppt_element")) return(contract)
  if (is.character(base) && length(base) && !is.na(base[1]) && nzchar(trimws(base[1]))) return(contract)
  sup <- contract$slots$superior; inf <- contract$slots$inferior; pb <- contract$slots$base %||% contract$slots$footer
  if (is.null(sup) || is.null(inf) || is.null(pb) || !is.null(sup$loc) || !is.null(inf$loc)) return(contract)
  props <- tryCatch(officer::layout_properties(doc, layout = contract$layout), error = function(e) NULL)
  if (is.null(props)) return(contract)
  rect <- function(spec) {
    if (!is.null(spec$loc)) {
      l <- spec$loc; if (is.numeric(l)) l <- list(left = l[[1]], top = l[[2]], width = l[[3]], height = l[[4]])
      return(c(x = as.numeric(l$left), y = as.numeric(l$top), w = as.numeric(l$width), h = as.numeric(l$height)))
    }
    s <- tryCatch(.ppt_slide_template_select_placeholder(props, spec), error = function(e) NULL)
    if (is.null(s)) return(NULL)
    v <- suppressWarnings(as.numeric(c(x = s$offx %||% NA, y = s$offy %||% NA, w = s$cx %||% NA, h = s$cy %||% NA)))
    names(v) <- c("x", "y", "w", "h")
    if (any(!is.finite(v))) NULL else v
  }
  a <- rect(sup); b <- rect(inf); p <- rect(pb)
  if (is.null(a) || is.null(b) || is.null(p)) return(contract)
  libre <- p[["y"]] - (b[["y"]] + b[["h"]])
  if (!is.finite(libre) || libre < 0.05 || b[["y"]] < a[["y"]] + a[["h"]] - 0.01) return(contract)
  d <- libre / 2
  loc <- function(r, dy, dh) list(left = r[["x"]], top = r[["y"]] + dy, width = r[["w"]], height = r[["h"]] + dh)
  contract$slots$superior$loc <- loc(a, 0, d)
  contract$slots$inferior$loc <- loc(b, d, d)
  contract
}
