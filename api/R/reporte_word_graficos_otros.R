# =============================================================================
# reporte_word_graficos_otros.R — dona, torta y mapas de calor del Word del recetario (N8.9)
# =============================================================================
#
# Portan `g_torta` y `g_heat` (recetario_word_graficos.R:244-258, 284-297) leyendo las especs `pie/1` y `heatmap/1`:
# las cifras con el redondeo del gráfico, el rango del color y los casos por columna ya vienen resueltos.

.WORD_PALETA_TORTA <- c("#081F5C", "#9DC3E6", "#2A9D8F", "#E9C46A", "#BFBFBF")

#' Dona (la cifra mayor al centro) o torta, con la leyenda a la derecha centrada junto al círculo (`g_torta()`)
#' @param dona `NULL` toma la forma de la espec (`forma`); la dicotomía de dos porciones va en torta.
#' @keywords internal
.word_g_pie <- function(espec, dona = NULL) {
  navy <- .std_word("colores", "titulos")
  rot <- as.character(espec$rotulos); n <- length(rot)
  v <- if (!is.null(espec$unidades)) as.numeric(espec$unidades) else as.numeric(espec$valores) * 100
  dona <- dona %||% (!identical(espec$forma, "pie") && n > 2L)
  alto <- if (n > 2L) 2.9 else 2.6                                       # recetario_word.R:352-354, con el pie
  pal <- rep_len(.WORD_PALETA_TORTA, n)
  # Dona y leyenda se centran JUNTAS en el ancho de la página («la leyenda no usa todo el espacio y no está centrada»).
  tl <- 9.5; panel <- alto - 0.5; leg <- max(nchar(rot)) * tl * 0.55 / 72 + 0.4
  m <- max(0.1, (.std_word("pagina", "ancho_util") - panel - leg - 0.35) / 2)
  et <- ifelse(v >= 6 & !(dona & v == max(v)), espec$cifras, "")         # en la dona la mayor ya está al centro
  d <- data.frame(k = factor(rot, levels = rot), v = v, et = et)
  g <- ggplot2::ggplot(d, ggplot2::aes(x = if (dona) 2 else 1, y = .data$v, fill = .data$k)) +
    ggplot2::geom_col(width = 1, colour = "#FFFFFF") + ggplot2::coord_polar(theta = "y", direction = -1) +
    ggplot2::geom_text(ggplot2::aes(label = .data$et), position = ggplot2::position_stack(vjust = 0.5), size = .word_pt(8.5), fontface = "bold",
                       family = "Arial", colour = "#FFFFFF") +
    ggplot2::scale_fill_manual(values = stats::setNames(pal, rot)) + .word_tema() +
    ggplot2::theme(legend.position = "right", legend.text = ggplot2::element_text(size = tl, colour = navy, margin = ggplot2::margin(l = 4)),
                   legend.key.size = ggplot2::unit(11, "pt"), legend.key.spacing.y = ggplot2::unit(5, "pt"), legend.box.spacing = ggplot2::unit(0.35, "in"),
                   plot.margin = ggplot2::margin(6, m * 72, 4, m * 72, "pt"))
  if (dona) g <- g + ggplot2::xlim(0.6, 2.5) +
    ggplot2::annotate("text", x = 0.6, y = 0, label = espec$cifras[which.max(v)], size = .word_pt(18), fontface = "bold", colour = .WORD_TINTA$navy, family = "Arial")
  attr(g, "alto") <- alto - 0.22; g
}

#' Mapa de calor de filas por columnas (`g_heat()`): rampa de claro a oscuro sobre el rango de la espec, la cifra en blanco
#' sobre los tonos oscuros, columnas con su rótulo arriba y filas a la izquierda
#' @keywords internal
.word_g_heat <- function(espec) {
  navy <- .std_word("colores", "titulos")
  M <- espec$valores; Mc <- espec$valores_crudos %||% M; lo <- espec$rango[1]; hi <- espec$rango[2]
  filas <- espec$filas; cols <- espec$columnas$rotulo; nf <- length(filas); nc <- length(cols)
  rampa <- grDevices::colorRampPalette(c("#EEF2F8", "#2F4B7C"))(41)
  d <- expand.grid(i = seq_len(nf), j = seq_len(nc)); d$v <- M[cbind(d$i, d$j)]; d$vc <- Mc[cbind(d$i, d$j)]
  d <- d[is.finite(d$v), , drop = FALSE]
  d$col <- rampa[pmin(41, pmax(1, round((d$vc - lo) / max(hi - lo, 1e-9) * 40) + 1))]   # el tramo lo decide el valor crudo
  d$txt <- ifelse(vapply(d$col, function(h) sum(c(.2126, .7152, .0722) * grDevices::col2rgb(h)[, 1] / 255), 0) < 0.45, "#FFFFFF", navy)
  d$x <- d$j; d$y <- nf + 1 - d$i
  g <- ggplot2::ggplot(d) + ggplot2::geom_tile(ggplot2::aes(x = .data$x, y = .data$y, fill = .data$col), colour = "#FFFFFF", linewidth = 1.2) +
    ggplot2::scale_fill_identity() +
    ggplot2::geom_text(ggplot2::aes(x = .data$x, y = .data$y, label = paste0(.data$v, "%"), colour = .data$txt), size = .word_pt(9), fontface = "bold",
                       family = "Arial") + ggplot2::scale_colour_identity() +
    ggplot2::annotate("text", x = seq_len(nc), y = nf + 0.75, label = .word_envolver(cols, 8), size = .word_pt(7.5), fontface = "bold", colour = navy,
                      family = "Arial", vjust = 0, lineheight = 0.9) +
    ggplot2::annotate("text", x = 0.42, y = rev(seq_len(nf)), label = .word_envolver(filas, 22), hjust = 1, size = .word_pt(9), fontface = "bold",
                      colour = navy, family = "Arial", lineheight = 0.9) +
    # La columna de rótulos crece con el rótulo más largo (nunca menos que la del recetario, -1.9).
    ggplot2::scale_x_continuous(limits = c(min(-1.9, .word_xmin(.word_envolver(filas, 22), 9, nc + 0.5, 0.42) - 0.1), nc + 0.5), expand = c(0, 0)) + ggplot2::scale_y_continuous(limits = c(0.5, nf + 1.35), expand = c(0, 0)) +
    .word_tema() + ggplot2::coord_cartesian(clip = "off")
  # Recetario: 2.4 in con 4 filas y 3.9 in con 11, con el pie (recetario_word.R:395, 399).
  attr(g, "alto") <- 1.54 + 0.214 * nf - 0.12
  attr(g, "nota_rango") <- sprintf("El tono va de %s%% (claro) a %s%% (oscuro)", lo, hi)
  g
}
