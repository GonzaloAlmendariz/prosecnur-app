# =============================================================================
# reporte_word_mapa_distribucion.R — el mapa de distribución en el Word lleva sus barras al costado
# =============================================================================
#
# El mapa del Word (`.word_g_mapa`) es el dibujo con su leyenda de clases a la derecha: en el mapa de resultado basta,
# porque la clase dice el rango del indicador. En la distribución de encuestados (graficos_mapa_distribucion_plan.R) la
# cifra es el contenido —«San Miguel, 57 (14%)»—, así que la figura es la de la lámina: el mapa con su leyenda debajo y,
# al costado, las áreas de mayor a menor en barras del color de su clase con su «conteo (porcentaje)» (Gonzalo,
# 2026-11-02: «la leyenda abajo y los distritos como gráfico de barras al costado del mapa»).

#' Las áreas de la distribución en barras: nombre a la izquierda, barra del color de su clase y cifra a su derecha
#' @param ranking `espec$ranking` (distrito, valor, color, cifra). @param escala_max Porcentaje de la barra más larga.
#' @return ggplot con atributos `ancho` y `alto` (in).
#' @keywords internal
.word_mapa_barras <- function(ranking, escala_max, pt) {
  navy <- .std_word("colores", "titulos")
  n <- nrow(ranking); paso <- pt * 1.7 / 72
  w_nombre <- max(c(0.8, .lam_ancho_tinta(ranking$distrito, pt))) * 1.1 + 0.1   # el dibujo mide algo más que la tinta estimada
  w_cifra <- max(c(0.5, .lam_ancho_tinta(ranking$cifra, pt, TRUE))) * 1.1 + 0.1
  w_barra <- 1.7
  x0 <- w_nombre + 0.08
  d <- data.frame(y = -(seq_len(n) - 1L) * paso, nombre = ranking$distrito, cifra = ranking$cifra, color = ranking$color,
                  largo = w_barra * ranking$valor / max(1, escala_max), stringsAsFactors = FALSE)
  g <- ggplot2::ggplot(d) +
    ggplot2::geom_rect(ggplot2::aes(xmin = x0, xmax = x0 + pmax(.data$largo, 0.01), ymin = .data$y - paso * 0.32, ymax = .data$y + paso * 0.32,
                                    fill = .data$color)) +
    ggplot2::geom_text(ggplot2::aes(w_nombre, .data$y, label = .data$nombre), hjust = 1, size = pt / ggplot2::.pt, colour = navy, family = "Arial") +
    ggplot2::geom_text(ggplot2::aes(x0 + .data$largo + 0.05, .data$y, label = .data$cifra), hjust = 0, size = pt / ggplot2::.pt,
                       colour = navy, fontface = "bold", family = "Arial") +
    ggplot2::scale_fill_identity() +
    ggplot2::scale_x_continuous(limits = c(0, x0 + w_barra + w_cifra), expand = c(0, 0)) +
    ggplot2::scale_y_continuous(limits = c(-(n - 0.5) * paso, paso / 2), expand = c(0, 0)) +
    ggplot2::coord_cartesian(clip = "off") +
    ggplot2::theme_void() + ggplot2::theme(plot.margin = ggplot2::margin(4, 4, 4, 4))
  attr(g, "ancho") <- x0 + w_barra + w_cifra + 0.1
  attr(g, "alto") <- n * paso + 0.15
  g
}

#' La leyenda en rampa del Word: la misma de la lámina (`.lam_mapa_leyenda_abajo`) dibujada en ggplot
#' @param w Ancho de la celda (in). @return ggplot.
#' @keywords internal
.word_mapa_leyenda_rampa <- function(leyenda, w, pt) {
  navy <- .std_word("colores", "titulos"); cortes <- leyenda$cortes; k <- length(cortes) + 1L
  cols <- leyenda$colores[seq_len(k)]; vacio <- leyenda$colores[k + 1L]
  w_barra <- min(2.2, w - 1.25); paso <- w_barra / k
  bloques <- data.frame(x0 = (seq_len(k) - 1) * paso, x1 = seq_len(k) * paso, fill = cols)
  marcas <- data.frame(x = seq_along(cortes) * paso, lab = paste0(format(cortes, trim = TRUE), " %"))
  ggplot2::ggplot() +
    ggplot2::annotate("text", x = 0, y = 0.62, label = leyenda$titulo, hjust = 0, size = pt / ggplot2::.pt, fontface = "bold",
                      colour = .WORD_TINTA$gris, family = "Arial") +
    ggplot2::geom_rect(data = bloques, ggplot2::aes(xmin = .data$x0, xmax = .data$x1, ymin = 0.3, ymax = 0.44, fill = .data$fill)) +
    ggplot2::geom_segment(data = marcas, ggplot2::aes(x = .data$x, xend = .data$x, y = 0.3, yend = 0.24), colour = navy, linewidth = 0.3) +
    ggplot2::geom_text(data = marcas, ggplot2::aes(.data$x, 0.12, label = .data$lab), size = pt / ggplot2::.pt, colour = navy, family = "Arial") +
    ggplot2::annotate("rect", xmin = w_barra + 0.2, xmax = w_barra + 0.34, ymin = 0.3, ymax = 0.44, fill = vacio) +
    ggplot2::annotate("text", x = w_barra + 0.4, y = 0.37, label = leyenda$rotulos[k + 1L], hjust = 0, size = pt / ggplot2::.pt,
                      colour = navy, family = "Arial") +
    ggplot2::scale_fill_identity() +
    ggplot2::scale_x_continuous(limits = c(0, w), expand = c(0, 0)) + ggplot2::scale_y_continuous(limits = c(0, 0.72), expand = c(0, 0)) +
    ggplot2::coord_cartesian(clip = "off") + ggplot2::theme_void() + ggplot2::theme(plot.margin = ggplot2::margin(2, 4, 2, 4))
}

#' Mapa de la distribución en el Word: el mapa con su leyenda en rampa debajo y las barras de las áreas al costado
#' @param mapa El ggplot de `.word_g_mapa` (con atributo `alto`).
#' @keywords internal
.word_g_mapa_con_ranking <- function(espec, mapa) {
  pt <- 8 + .word_desplazo("leyenda")
  barras <- .word_mapa_barras(espec$ranking, espec$escala_max %||% 100, pt)
  mapa <- mapa + ggplot2::guides(colour = "none") +
    # El recorte a los datos lleva el mismo marco fino que en la lámina (lamina_mapa_resultado.R).
    ggplot2::theme(legend.position = "none",
                   panel.border = if (isTRUE(espec$recortado)) ggplot2::element_rect(fill = NA, colour = .std_color("mapa_borde"), linewidth = 0.4)
                                  else ggplot2::element_blank())
  # El alto lo pone lo mayor: el mapa del recetario (4 in) o la columna de barras; con muchas áreas crece hasta 7.5 in.
  alto <- min(7.5, max(attr(mapa, "alto") %||% 3.8, attr(barras, "alto")))
  cj <- espec$caja
  asp <- unname((cj[["ymax"]] - cj[["ymin"]]) / ((cj[["xmax"]] - cj[["xmin"]]) * cos(mean(cj[c("ymin", "ymax")]) * pi / 180)))
  tope <- .std_word("pagina", "ancho_util")
  w_barras <- attr(barras, "ancho")
  h_ley <- 0.72; alto_mapa <- alto - h_ley - 0.1
  w_mapa <- max(3, min(tope - w_barras, alto_mapa / asp, 3.6))   # al menos lo que pide la rampa con «Sin encuestados»
  izq <- cowplot::plot_grid(mapa, .word_mapa_leyenda_rampa(espec$leyenda, w_mapa, pt), ncol = 1, rel_heights = c(alto_mapa, h_ley))
  g <- cowplot::plot_grid(izq, barras, nrow = 1, rel_widths = c(w_mapa, w_barras))
  attr(g, "alto") <- alto
  attr(g, "ancho") <- min(tope, w_mapa + w_barras)
  g
}
