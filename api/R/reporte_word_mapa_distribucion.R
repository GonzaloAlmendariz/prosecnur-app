# =============================================================================
# reporte_word_mapa_distribucion.R — el mapa de distribución en el Word (diseño aprobado, tablero 7 «Prueba en página A4»)
# =============================================================================
#
# El mapa lleva su propia letra: rótulos a 10,5 pt y leyenda a 9 pt, porque reducir la lámina al ancho de página los
# dejaría bajo 8 pt. Tiene tope de alto (9,5 cm) y toma el ancho que ese alto pide, como la lámina (Gonzalo, 2026-11-09).
# Si deja sitio, la lista va a su derecha en una columna; si no, debajo en dos. La leyenda va en su franja, con el estilo
# de la especificación aprobada (Gonzalo, 2026-11-03): barra sobre pista y la fila «otros» al final. Todo es un solo
# gráfico ggplot compuesto con cowplot.

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
.word_mapa_dist_ranking <- function(espec, w, pt, columnas = 2L, max_filas = 16L) {
  M <- .MAPA_DIST(); fuente <- "Arial"
  f <- .lam_mapa_dist_filas(espec, max_filas)
  n <- nrow(f); por_col <- max(1L, ceiling(n / columnas)); fila <- pt * 2.6 / 72
  col_w <- if (columnas > 1L) (w - 0.3 * (columnas - 1L)) / columnas else w
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

#' Alto máximo (in) del panel del mapa en el Word
#'
#' Gonzalo, 2026-11-09, sobre el Word v7.31: «no creo que en el Word el gráfico tenga que ser tan enorme» y el mapa «no
#' está bien centrado y muestra mucha info que no es del Perú, como el PPT antes». El panel iba siempre a 16 cm de ancho
#' con hasta 13,6 cm de alto: el Perú, alto y angosto, se encogía al alto y el resto del ancho se llenaba de países
#' vecinos; la figura entera llegaba a 19–22 cm, una página. Ahora el mapa tiene tope de alto y toma el ancho que ese
#' alto pide (el «zoom preciso» de la lámina, `.mapa_dist_ancho_natural`).
#' @keywords internal
.WORD_MAPA_ALTO_MAX <- 9.5 / 2.54

#' Figura del mapa de distribución en el Word: el mapa a su ancho natural (tope de alto), la leyenda debajo y la lista
#'
#' Si el mapa deja al costado al menos 6,5 cm, la lista va a su derecha en una columna, con las filas que caben en el alto
#' del mapa (el resto suma en «otros», como en la lámina). Si no, el mapa va centrado y la lista debajo, en dos columnas.
#' @keywords internal
.word_g_mapa_distribucion <- function(espec) {
  pt <- .mapa_dist_pt("word")
  w <- min(16 / 2.54, .std_word("pagina", "ancho_util")); h_ley <- 0.62
  h_full <- .mapa_dist_alto_natural(espec, w, pt)   # el alto que pide el mapa al ancho de texto
  if (h_full <= .WORD_MAPA_ALTO_MAX) {
    w_map <- w; h_map <- max(w * 0.5, h_full)
  } else {
    h_map <- .WORD_MAPA_ALTO_MAX
    w_map <- min(w, .mapa_dist_ancho_natural(espec, h_map, pt))
  }
  panel <- .mapa_dist_panel_gg(espec, w_map, h_map, pt)
  gap <- 0.25; w_lista <- w - w_map - gap
  fila <- pt$leyenda * 2.6 / 72
  if (w_lista >= 6.5 / 2.54) {
    filas <- max(3L, min(16L, floor((h_map - 0.16 * length(espec$nota_pie) - 0.1) / fila) - 1L))
    rk <- .word_mapa_dist_ranking(espec, w_lista, pt$leyenda, columnas = 1L, max_filas = filas)
    h_rk <- attr(rk, "alto"); h_fila <- max(h_map, h_rk)
    lista <- cowplot::plot_grid(rk, NULL, ncol = 1, rel_heights = c(h_rk, max(0.001, h_fila - h_rk)))
    arriba <- cowplot::plot_grid(panel, NULL, lista, nrow = 1, rel_widths = c(w_map, gap, w_lista))
    g <- cowplot::plot_grid(arriba, .word_mapa_dist_leyenda(espec, w, pt$leyenda), ncol = 1, rel_heights = c(h_fila, h_ley))
    attr(g, "alto") <- h_fila + h_ley
  } else {
    lado <- (w - w_map) / 2
    fila_mapa <- if (lado > 0.01) cowplot::plot_grid(NULL, panel, NULL, nrow = 1, rel_widths = c(lado, w_map, lado)) else panel
    rk <- .word_mapa_dist_ranking(espec, w, pt$leyenda)
    h_rk <- attr(rk, "alto")
    g <- cowplot::plot_grid(fila_mapa, .word_mapa_dist_leyenda(espec, w, pt$leyenda), rk, ncol = 1, rel_heights = c(h_map, h_ley, h_rk + 0.1))
    attr(g, "alto") <- h_map + h_ley + h_rk + 0.1
  }
  attr(g, "ancho") <- w
  attr(g, "ancho_mapa") <- w_map
  g
}
