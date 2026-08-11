# =============================================================================
# reporte_plan_tabla_nativa.R — la tabla de apoyo sale del canvas
# =============================================================================
#
# ADR 0072: toda tabla del entregable se emite nativa. La de apoyo del radar se
# dibujaba dentro del canvas de ggplot, y el coste estaba a la vista en su
# propia API —`tabla_padding_mm`, `tabla_auto_fit`, `tabla_fit_pad`,
# `tabla_clip`…— una veintena de parámetros para resolver a mano lo que un motor
# de tablas resuelve solo.
#
# El reparto es el de siempre: el gráfico a la izquierda y la tabla a su
# derecha. Lo que cambia es que ya no comparten canvas, así que la tabla deja de
# encoger cuando el radar encoge, que era la razón de que su letra cayera por
# debajo de lo legible.

#' Parte el slot del gráfico en dos: gráfico a la izquierda, tabla a la derecha.
#'
#' @param spec Slot del gráfico, con `spec$loc = list(left, top, width, height)`
#'   en pulgadas.
#' @param frac_tabla Fracción del ancho que se lleva la tabla.
#' @param gap_in Aire entre los dos, en pulgadas.
#' @return `NULL` si el slot no es partible —y entonces el llamador dibuja como
#'   antes—; si lo es, `list(grafico = , tabla = )` con dos specs.
#' @keywords internal
.tabla_nativa_partir_slot <- function(spec, frac_tabla = 0.40, gap_in = 0.15) {
  if (is.null(spec) || is.null(spec$loc)) return(NULL)
  loc <- spec$loc
  if (is.numeric(loc) && length(loc) >= 4L) {
    loc <- list(left = loc[[1]], top = loc[[2]], width = loc[[3]], height = loc[[4]])
  }
  if (!is.list(loc) || !all(c("left", "top", "width", "height") %in% names(loc))) return(NULL)

  ancho <- suppressWarnings(as.numeric(loc$width)[1])
  if (!is.finite(ancho) || ancho <= 0) return(NULL)

  frac <- suppressWarnings(as.numeric(frac_tabla)[1])
  if (!is.finite(frac) || frac <= 0 || frac >= 1) frac <- 0.40
  gap <- suppressWarnings(as.numeric(gap_in)[1])
  if (!is.finite(gap) || gap < 0) gap <- 0
  # Sin sitio para los dos, no se parte: media tabla es peor que la de antes.
  if (gap >= ancho) return(NULL)

  ancho_tabla <- (ancho - gap) * frac
  ancho_graf  <- (ancho - gap) - ancho_tabla
  if (ancho_tabla <= 0 || ancho_graf <= 0) return(NULL)

  spec_graf <- spec; spec_graf$loc <- loc; spec_graf$loc$width <- ancho_graf
  spec_tab  <- spec; spec_tab$loc  <- loc
  spec_tab$loc$left  <- as.numeric(loc$left) + ancho_graf + gap
  spec_tab$loc$width <- ancho_tabla

  list(grafico = spec_graf, tabla = spec_tab)
}

#' Tabla nativa de apoyo, con encabezado.
#'
#' A diferencia de la ficha técnica —que borra su cabecera con `delete_part()`
#' porque su primera columna ya nombra cada fila—, aquí el encabezado lleva los
#' públicos comparados y es parte del dato.
#' @keywords internal
.tabla_nativa_flextable <- function(df,
                                    ancho_in,
                                    font_family = "Arial",
                                    color_texto = "#081F5C",
                                    color_header_fill = "#081F5C",
                                    color_header_texto = "#FFFFFF",
                                    color_borde = "#BFBFBF",
                                    size_header = 9,
                                    size_cuerpo = 9,
                                    frac_primera = 0.46) {
  if (!requireNamespace("flextable", quietly = TRUE)) {
    stop("Se requiere el paquete 'flextable' para la tabla nativa.", call. = FALSE)
  }
  df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  if (!nrow(df) || !ncol(df)) return(NULL)
  for (j in seq_along(df)) {
    col <- as.character(df[[j]]); col[is.na(col)] <- ""; df[[j]] <- col
  }

  ancho_in <- suppressWarnings(as.numeric(ancho_in)[1])
  if (!is.finite(ancho_in) || ancho_in <= 0) ancho_in <- 4

  n_col <- ncol(df)
  ancho_primera <- if (n_col > 1L) ancho_in * frac_primera else ancho_in
  ancho_resto   <- if (n_col > 1L) (ancho_in - ancho_primera) / (n_col - 1L) else 0

  borde <- officer::fp_border(color = color_borde, width = 0.75)
  ft <- flextable::flextable(df)
  ft <- flextable::set_table_properties(ft, layout = "fixed")
  ft <- flextable::width(ft, j = 1, width = ancho_primera)
  if (n_col > 1L) for (j in seq(2L, n_col)) ft <- flextable::width(ft, j = j, width = ancho_resto)
  ft <- flextable::font(ft, fontname = font_family, part = "all")
  ft <- flextable::fontsize(ft, size = size_cuerpo, part = "body")
  ft <- flextable::fontsize(ft, size = size_header, part = "header")
  ft <- flextable::color(ft, color = color_texto, part = "body")
  ft <- flextable::color(ft, color = color_header_texto, part = "header")
  ft <- flextable::bg(ft, bg = color_header_fill, part = "header")
  ft <- flextable::bold(ft, bold = TRUE, part = "header")
  ft <- flextable::border_outer(ft, border = borde, part = "all")
  ft <- flextable::border_inner_h(ft, border = borde, part = "all")
  ft <- flextable::border_inner_v(ft, border = borde, part = "all")
  ft <- flextable::align(ft, j = 1, align = "left", part = "all")
  if (n_col > 1L) ft <- flextable::align(ft, j = seq(2L, n_col), align = "center", part = "all")
  ft <- flextable::padding(ft, padding = 2, part = "all")
  ft
}
