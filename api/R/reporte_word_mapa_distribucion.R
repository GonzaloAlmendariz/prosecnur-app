# =============================================================================
# reporte_word_mapa_distribucion.R — el mapa de distribución en el Word (diseño aprobado, tablero 7 «Prueba en página A4»)
# =============================================================================
#
# El mapa va al ancho de texto (16 cm) con su propia letra: rótulos a 10,5 pt y leyenda y escala a 9 pt, porque reducir la
# lámina al ancho de página los dejaría bajo 8 pt. Debajo, la leyenda escalonada en su franja y el ranking en dos columnas
# (al costado no cabe sin achicar el mapa). Todo es un solo gráfico ggplot compuesto con cowplot.

#' Leyenda escalonada del Word: la de la lámina (`.lam_mapa_dist_leyenda`) dibujada en ggplot
#' @param w Ancho (in). @keywords internal
.word_mapa_dist_leyenda <- function(espec, w, pt) {
  M <- .MAPA_DIST; cl <- espec$clases; fuente <- "Arial"
  extras <- c(if (!is.null(espec$fuera)) paste(espec$fuera$nombre, "(fuera de escala)"), "Sin encuestados")
  cols_extra <- c(if (!is.null(espec$fuera)) rep(M$fuera, nrow(espec$fuera)), M$vacio)
  ancho_extra <- vapply(extras, function(t) max(0.9, .lam_ancho_tinta(t, pt) + 0.1), 0)
  n <- length(cl$colores); util <- w - 0.3 - sum(ancho_extra) - 0.12 * length(extras)
  paso <- util / n
  b <- data.frame(x0 = 0.15 + (seq_len(n) - 1) * paso, w = paso - 0.02, fill = cl$colores, t = cl$rotulos)
  xe <- 0.15 + n * paso + cumsum(c(0.12, utils::head(ancho_extra, -1) + 0.12))
  e <- data.frame(x0 = xe, w = ancho_extra, fill = cols_extra, t = extras,
                  borde = ifelse(cols_extra == M$vacio, M$vacio_borde, cols_extra))
  ggplot2::ggplot() +
    ggplot2::annotate("text", x = w / 2, y = 0.5, label = espec$leyenda_titulo, size = pt / ggplot2::.pt, fontface = "bold",
                      colour = "#3C4658", family = fuente) +
    ggplot2::geom_rect(data = b, ggplot2::aes(xmin = .data$x0, xmax = .data$x0 + .data$w, ymin = 0.27, ymax = 0.39, fill = .data$fill)) +
    ggplot2::geom_text(data = b, ggplot2::aes(.data$x0 + .data$w / 2, 0.13, label = .data$t), size = pt / ggplot2::.pt, colour = "#3C4658",
                       family = fuente) +
    ggplot2::geom_rect(data = e, ggplot2::aes(xmin = .data$x0, xmax = .data$x0 + .data$w, ymin = 0.27, ymax = 0.39, fill = .data$fill,
                                              colour = .data$borde), linewidth = .mapa_dist_lw(0.75)) +
    ggplot2::geom_text(data = e, ggplot2::aes(.data$x0 + .data$w / 2, 0.13, label = .data$t), size = pt / ggplot2::.pt, colour = "#3C4658",
                       family = fuente) +
    ggplot2::scale_fill_identity() + ggplot2::scale_colour_identity() +
    ggplot2::coord_cartesian(xlim = c(0, w), ylim = c(0, 0.62), expand = FALSE, clip = "off") +
    ggplot2::theme_void() + ggplot2::theme(plot.margin = ggplot2::margin(0, 0, 0, 0))
}

#' Ranking del Word en dos columnas: nombre, barra del color de su clase y cifra a la derecha, con su encabezado
#' @return ggplot con atributo `alto` (in). @keywords internal
.word_mapa_dist_ranking <- function(espec, w, pt) {
  M <- .MAPA_DIST; rk <- espec$ranking; fuente <- "Arial"
  n <- nrow(rk); por_col <- max(1L, ceiling(n / 2)); fila <- pt * 1.9 / 72
  col_w <- (w - 0.3) / 2
  w_nom <- min(col_w * 0.45, max(c(0.7, .lam_ancho_tinta(rk$nombre, pt))) * 1.08 + 0.05)
  w_val <- max(c(0.3, .lam_ancho_tinta(paste(rk$valor, rk$detalle), pt, TRUE))) * 1.05 + 0.05
  w_bar <- col_w - w_nom - w_val - 0.16
  k <- seq_len(n) - 1L
  d <- data.frame(x = (k %/% por_col) * (col_w + 0.3), y = -(k %% por_col) * fila - fila, nombre = rk$nombre, barra = rk$barra, color = rk$color,
                  valor = rk$valor, detalle = rk$detalle)
  cab <- data.frame(x = c(0, if (n > por_col) col_w + 0.3), y = 0)
  alto_tit <- 0.42
  notas <- c(espec$notas, espec$nota_pie)
  h <- alto_tit + (por_col + 1.4) * fila + 0.16 * length(notas)   # la primera nota baja una fila bajo la última
  g <- ggplot2::ggplot() +
    ggplot2::annotate("text", x = 0, y = alto_tit - 0.06, label = espec$ranking_titulo, hjust = 0, vjust = 1, size = (pt + 1) / ggplot2::.pt,
                      fontface = "bold", colour = M$texto, family = fuente) +
    ggplot2::annotate("text", x = 0, y = alto_tit - 0.26, label = espec$ranking_sub, hjust = 0, vjust = 1, size = (pt - 0.5) / ggplot2::.pt,
                      colour = M$gris, family = fuente) +
    ggplot2::geom_text(data = cab, ggplot2::aes(.data$x + w_nom, -fila * 0.35, label = toupper(espec$ranking_columnas[1])), hjust = 1,
                       size = (pt - 1.5) / ggplot2::.pt, fontface = "bold", colour = "#8A93A3", family = fuente) +
    ggplot2::geom_text(data = cab, ggplot2::aes(.data$x + col_w, -fila * 0.35, label = toupper(espec$ranking_columnas[2])), hjust = 1,
                       size = (pt - 1.5) / ggplot2::.pt, fontface = "bold", colour = "#8A93A3", family = fuente) +
    ggplot2::geom_segment(data = cab, ggplot2::aes(x = .data$x, xend = .data$x + col_w, y = -fila * 0.6, yend = -fila * 0.6), colour = "#D5D9E0",
                          linewidth = .mapa_dist_lw(0.75)) +
    ggplot2::geom_text(data = d, ggplot2::aes(.data$x + w_nom, .data$y, label = .data$nombre), hjust = 1, size = pt / ggplot2::.pt,
                       colour = "#2A3448", family = fuente) +
    ggplot2::geom_rect(data = d, ggplot2::aes(xmin = .data$x + w_nom + 0.08, xmax = .data$x + w_nom + 0.08 + w_bar, ymin = .data$y - fila * 0.28,
                                              ymax = .data$y + fila * 0.28), fill = "#F1F3F6") +
    ggplot2::geom_rect(data = d, ggplot2::aes(xmin = .data$x + w_nom + 0.08, xmax = .data$x + w_nom + 0.08 + w_bar * pmax(0.01, .data$barra),
                                              ymin = .data$y - fila * 0.28, ymax = .data$y + fila * 0.28, fill = .data$color)) +
    ggplot2::geom_text(data = d, ggplot2::aes(.data$x + col_w, .data$y, label = paste(.data$valor, .data$detalle)), hjust = 1,
                       size = pt / ggplot2::.pt, fontface = "bold", colour = M$texto, family = fuente) +
    ggplot2::scale_fill_identity()
  if (length(notas)) {
    dn <- data.frame(y = -(por_col + 0.4) * fila - fila - (seq_along(notas) - 1) * 0.16, t = notas)
    g <- g + ggplot2::geom_text(data = dn, ggplot2::aes(0, .data$y, label = .data$t), hjust = 0, size = (pt - 1) / ggplot2::.pt,
                                colour = M$gris, family = fuente)
  }
  g <- g + ggplot2::coord_cartesian(xlim = c(0, w), ylim = c(alto_tit - h, alto_tit), expand = FALSE, clip = "off") +
    ggplot2::theme_void() + ggplot2::theme(plot.margin = ggplot2::margin(0, 0, 0, 0))
  attr(g, "alto") <- h
  g
}

#' Figura del mapa de distribución en el Word: mapa al ancho de texto, leyenda escalonada y ranking en dos columnas
#' @keywords internal
.word_g_mapa_distribucion <- function(espec) {
  pt <- .mapa_dist_pt("word")
  w <- min(16 / 2.54, .std_word("pagina", "ancho_util"))
  h_map <- w * 430 / 603; h_ley <- 0.62
  panel <- .mapa_dist_panel_gg(espec, w, h_map, pt)
  rk <- .word_mapa_dist_ranking(espec, w, pt$leyenda)
  h_rk <- attr(rk, "alto")
  g <- cowplot::plot_grid(panel, .word_mapa_dist_leyenda(espec, w, pt$leyenda), rk, ncol = 1, rel_heights = c(h_map, h_ley, h_rk + 0.1))
  attr(g, "alto") <- h_map + h_ley + h_rk + 0.1
  attr(g, "ancho") <- w
  g
}
