# reporte_slides_composicion_grosor.R — en una lámina de composición la divergente mide la barra de la apilada vecina
#
# Ola 4, A4 (B3 de la lámina 2 del mazo de familias, «2 vertical divergente», y de la «G. 2 vertical divergente con saldo»):
# desde la ola 3 la divergente de imagen pinta con la escala del estándar y `verificar_mazo()` ya mide sus barras; salían a
# 0.86–1.06 cm junto a una apilada de 0.61–1.06 cm en la misma lámina. El recetario quiere un solo grosor por lámina.
# La apilada fija el suyo con sus pisos (cifras que suben, Top Two Box); la divergente no tiene esa atadura, así que es
# ella la que se redibuja con el grosor de la apilada (el menor si hay varias). Nunca engruesa por encima de su aire.

#' Opción con la que la divergente recibe el grosor objetivo de su barra, en pulgadas de la lámina
#' @keywords internal
.COMPOSICION_GROSOR_OPCION <- "prosecnur.grosor_objetivo_in"

#' Redibuja las divergentes de una composición con el grosor de barra de las apiladas vecinas
#'
#' @param rendered,els Gráficos ya dibujados y sus elementos, en el orden de `nombres`.
#' @param anchos,altos Cajón de cada gráfico (los mismos con que se dibujó).
#' @param render `function(el, ancho_slot, alto_slot)`.
#' @return `rendered` con las divergentes redibujadas cuando cambia su grosor.
#' @keywords internal
.composicion_grosor_comun <- function(rendered, els, anchos, altos, render) {
  if (!is.function(render) || length(rendered) < 2L) return(rendered)
  tipo <- vapply(els, function(e) as.character(e$.element_type %||% "")[1], "")
  g <- vapply(rendered, function(p) {
    ly <- attr(p, "pulso_barras_apiladas_layout", exact = TRUE) %||% list()
    v <- suppressWarnings(as.numeric(ly$grosor_in)[1])
    if (length(v) && is.finite(v) && v > 0) v else NA_real_
  }, 0)
  div <- which(tipo == "barras_divergentes" & !vapply(altos, is.null, TRUE))
  if (!length(div) || all(is.na(g))) return(rendered)
  objetivo <- min(g, na.rm = TRUE)
  for (k in div) {
    viejo <- options(stats::setNames(list(objetivo), .COMPOSICION_GROSOR_OPCION))
    p <- tryCatch(render(els[[k]], anchos[[k]], altos[[k]]), error = function(e) NULL)
    options(viejo)
    if (inherits(p, "ggplot")) rendered[[k]] <- p
  }
  rendered
}

#' Fracción de fila con la que la barra de la divergente mide `objetivo_in` en su lienzo
#'
#' Mide el panel real del ggplot armado (`ggplotGrob`: alto del lienzo menos lo fijo) y lo reparte entre las filas del eje
#' discreto: n − 1 entre la primera y la última más 0.6 por lado (la expansión por defecto de ggplot), n + 0.2.
#' @return Fracción, o `NA` si no se puede medir.
#' @keywords internal
.divergentes_grosor_para_objetivo <- function(p, alto, n, objetivo_in) {
  a <- suppressWarnings(as.numeric(alto)[1]); o <- suppressWarnings(as.numeric(objetivo_in)[1])
  if (!length(a) || !length(o) || !is.finite(a) || !is.finite(o) || a <= 0 || o <= 0 || n < 1) return(NA_real_)
  gt <- tryCatch(ggplot2::ggplotGrob(p), error = function(e) NULL)
  if (is.null(gt)) return(NA_real_)
  nulos <- vapply(seq_along(gt$heights), function(i) grid::unitType(gt$heights[i]) == "null", TRUE)
  fijo <- tryCatch(sum(grid::convertHeight(gt$heights[!nulos], "in", valueOnly = TRUE)), error = function(e) NA_real_)
  panel <- a - fijo
  if (!is.finite(panel) || panel <= 0) return(NA_real_)
  o / (panel / (n + 0.2))
}
