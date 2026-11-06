# =============================================================================
# reporte_word_mapa_distribucion.R — el mapa de distribución en el Word (diseño aprobado, tablero 7 «Prueba en página A4»)
# =============================================================================
#
# El mapa va al ancho de texto (16 cm) con su propia letra: rótulos a 10,5 pt y leyenda a 9 pt, porque reducir la lámina
# al ancho de página los dejaría bajo 8 pt. Debajo, la leyenda en su franja y la lista en dos columnas, con el estilo de la
# especificación aprobada (Gonzalo, 2026-11-03): barra sobre pista y la fila «otros» al final (al costado no cabe). Todo es un solo gráfico ggplot compuesto con cowplot.

#' Leyenda del Word: la de la lámina (`.lam_mapa_dist_leyenda`) dibujada en ggplot, con el rayado de otra respuesta
#' @param w Ancho (in). @keywords internal
.word_mapa_dist_leyenda <- function(espec, w, pt) {
  M <- .MAPA_DIST(); cl <- espec$clases; fuente <- "Arial"
  ex <- espec$leyenda_extras %||% data.frame(texto = "Sin encuestados", tipo = "vacio", stringsAsFactors = FALSE)
  ancho_extra <- vapply(ex$texto, function(t) max(0.9, .lam_ancho_tinta(t, pt) + 0.1), 0)
  n <- length(cl$colores); util <- w - 0.3 - sum(ancho_extra) - 0.12 * nrow(ex)
  paso <- util / n
  b <- data.frame(x0 = 0.15 + (seq_len(n) - 1) * paso, w = paso - 0.02, fill = cl$colores, t = cl$rotulos)
  xe <- 0.15 + n * paso + cumsum(c(0.12, utils::head(ancho_extra, -1) + 0.12))
  otra <- ex$tipo == "otra"
  e <- data.frame(x0 = xe, w = ancho_extra, fill = ifelse(otra, M$otra, M$vacio), t = ex$texto,
                  borde = ifelse(otra, M$otra, M$vacio_borde))
  rayas <- do.call(rbind, lapply(which(otra), function(j) {
    x0 <- e$x0[j]; x1 <- x0 + e$w[j]; h <- 0.12
    cs <- seq(x0 - h, x1, by = 0.05)
    d <- data.frame(x = pmax(x0, cs), xend = pmin(x1, cs + h))
    sube <- ((ex$grupo[j] %||% 1L) %% 2) == 1   # sentidos alternos por grupo, como el mapa
    d$y <- if (sube) 0.27 + (d$x - cs) else 0.39 - (d$x - cs); d$yend <- if (sube) 0.27 + (d$xend - cs) else 0.39 - (d$xend - cs)
    d[d$xend - d$x > 0.004, , drop = FALSE]
  }))
  g <- ggplot2::ggplot() +
    ggplot2::annotate("text", x = w / 2, y = 0.5, label = espec$leyenda_titulo, size = pt / ggplot2::.pt, fontface = "bold",
                      colour = .MAPA_DIST()$guia, family = fuente) +
    ggplot2::geom_rect(data = b, ggplot2::aes(xmin = .data$x0, xmax = .data$x0 + .data$w, ymin = 0.27, ymax = 0.39, fill = .data$fill)) +
    ggplot2::geom_text(data = b, ggplot2::aes(.data$x0 + .data$w / 2, 0.13, label = .data$t), size = pt / ggplot2::.pt, colour = .MAPA_DIST()$guia,
                       family = fuente) +
    ggplot2::geom_rect(data = e, ggplot2::aes(xmin = .data$x0, xmax = .data$x0 + .data$w, ymin = 0.27, ymax = 0.39, fill = .data$fill,
                                              colour = .data$borde), linewidth = .mapa_dist_lw(0.75)) +
    ggplot2::geom_text(data = e, ggplot2::aes(.data$x0 + .data$w / 2, 0.13, label = .data$t), size = pt / ggplot2::.pt, colour = .MAPA_DIST()$guia,
                       family = fuente)
  if (NROW(rayas)) g <- g + ggplot2::geom_segment(data = rayas, ggplot2::aes(x = .data$x, xend = .data$xend, y = .data$y, yend = .data$yend),
                                                 colour = M$otra_raya, linewidth = .mapa_dist_lw(0.5))
  g + ggplot2::scale_fill_identity() + ggplot2::scale_colour_identity() +
    ggplot2::coord_cartesian(xlim = c(0, w), ylim = c(0, 0.62), expand = FALSE, clip = "off") +
    ggplot2::theme_void() + ggplot2::theme(plot.margin = ggplot2::margin(0, 0, 0, 0))
}

#' Lista del Word en dos columnas, como la de la lámina: nombre y «N (%)» en una línea, la barra sobre su pista debajo y la
#' fila «otros» al final, en gris
#' @return ggplot con atributo `alto` (in). @keywords internal
.word_mapa_dist_ranking <- function(espec, w, pt) {
  M <- .MAPA_DIST(); fuente <- "Arial"
  f <- .lam_mapa_dist_filas(espec, 16L)
  n <- nrow(f); por_col <- max(1L, ceiling(n / 2)); fila <- pt * 2.6 / 72
  col_w <- (w - 0.3) / 2
  k <- seq_len(n) - 1L
  d <- data.frame(x = (k %/% por_col) * (col_w + 0.3), y = -(k %% por_col) * fila, nombre = f$nombre, cifra = f$cifra, frac = pmin(1, f$frac),
                  color = f$color, texto = ifelse(f$otros, M$otros_texto, M$texto))
  hb <- fila * 0.2
  notas <- espec$nota_pie
  h <- (por_col + 0.3) * fila + 0.16 * length(notas)
  g <- ggplot2::ggplot() +
    ggplot2::geom_text(data = d, ggplot2::aes(.data$x, .data$y, label = .data$nombre, colour = .data$texto), hjust = 0, vjust = 1,
                       size = pt / ggplot2::.pt, family = fuente) +
    ggplot2::geom_text(data = d, ggplot2::aes(.data$x + col_w, .data$y, label = .data$cifra, colour = .data$texto), hjust = 1, vjust = 1,
                       size = pt / ggplot2::.pt, fontface = "bold", family = fuente) +
    ggplot2::geom_rect(data = d, ggplot2::aes(xmin = .data$x, xmax = .data$x + col_w, ymin = .data$y - fila * 0.55 - hb, ymax = .data$y - fila * 0.55),
                       fill = M$pista) +
    ggplot2::geom_rect(data = d, ggplot2::aes(xmin = .data$x, xmax = .data$x + col_w * pmax(0.005, .data$frac), ymin = .data$y - fila * 0.55 - hb,
                                              ymax = .data$y - fila * 0.55, fill = .data$color)) +
    ggplot2::scale_fill_identity() + ggplot2::scale_colour_identity()
  if (length(notas)) {
    dn <- data.frame(y = -(por_col + 0.1) * fila - (seq_along(notas) - 1) * 0.16, t = notas)
    g <- g + ggplot2::geom_text(data = dn, ggplot2::aes(0, .data$y, label = .data$t), hjust = 0, size = (pt - 1) / ggplot2::.pt,
                                colour = M$gris, family = fuente)
  }
  g <- g + ggplot2::coord_cartesian(xlim = c(0, w), ylim = c(-h, 0.02), expand = FALSE, clip = "off") +
    ggplot2::theme_void() + ggplot2::theme(plot.margin = ggplot2::margin(0, 0, 0, 0))
  attr(g, "alto") <- h + 0.02
  g
}

#' Figura del mapa de distribución en el Word: mapa al ancho de texto, leyenda escalonada y ranking en dos columnas
#' @keywords internal
.word_g_mapa_distribucion <- function(espec) {
  pt <- .mapa_dist_pt("word")
  w <- min(16 / 2.54, .std_word("pagina", "ancho_util"))
  h_map <- min(w * 0.85, max(w * 0.5, .mapa_dist_alto_natural(espec, w, pt))); h_ley <- 0.62   # el alto que pide el mapa a 16 cm
  panel <- .mapa_dist_panel_gg(espec, w, h_map, pt)
  rk <- .word_mapa_dist_ranking(espec, w, pt$leyenda)
  h_rk <- attr(rk, "alto")
  g <- cowplot::plot_grid(panel, .word_mapa_dist_leyenda(espec, w, pt$leyenda), rk, ncol = 1, rel_heights = c(h_map, h_ley, h_rk + 0.1))
  attr(g, "alto") <- h_map + h_ley + h_rk + 0.1
  attr(g, "ancho") <- w
  g
}
