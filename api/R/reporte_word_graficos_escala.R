# =============================================================================
# reporte_word_graficos_escala.R — la escala apilada del Word del recetario, desde la espec (N8.6; ADR 0093)
# =============================================================================
#
# Porta `g_apilada()` (recetario_word_graficos.R:39-76): barras de grosor 0.58 de la fila, cifra dentro sólo si el
# segmento la contiene (≥ 7 %), las chicas encima con su guía en codo, la columna Top Two Box en verde a la derecha (y
# Bottom Two Box en naranja si se pide), un filete bajo la fila Total y la leyenda abajo. Lee la espec `escala/1`: las
# cifras, los anchos y el box ya vienen resueltos (redondeo de las láminas 20-21, Top Two Box de la 19) y aquí no se
# recalcula nada.

#' Tamaño de texto de un geom en el Word: nada bajo 8 pt (`PT()` del recetario)
#' @keywords internal
.word_pt <- function(x) max(.std_word("tipografia", "grafico_minimo"), x * 0.95) / ggplot2::.pt

#' Margen izquierdo del eje según el rótulo más largo ya partido (`xmin_para()` del recetario)
#' @keywords internal
.word_xmin <- function(rotulos, pt, xmax, x0 = 0) {
  lin <- unlist(strsplit(rotulos, "\n"))
  L <- min(max(nchar(lin)) * max(7.5, pt * 0.95) * 0.5 / 72 + 0.15, 3.3)
  x0 - L * (xmax - x0) / (.std_word("pagina", "ancho_util") - 0.3 - L)
}

#' Gráfico Word de una escala apilada a partir de su espec
#' @return ggplot con atributos `alto` (in, ya sin el pie) y `filas`.
#' @keywords internal
.word_g_escala <- function(espec, envolver = 22) {
  navy <- .std_word("colores", "titulos"); gris <- "#8A93A8"; filete <- .std_word("colores", "filete")
  verde <- .std_color("verde_top_two_box"); naranja <- "#B4541F"
  orden <- espec$orden$aplicado %||% seq_len(nrow(espec$filas))
  F <- espec$filas[orden, , drop = FALSE]; U <- espec$unidades[orden, , drop = FALSE]; A <- espec$anchos[orden, , drop = FALSE]
  Ci <- espec$cifras[orden, , drop = FALSE]; Dw <- espec$dibujar[orden, , drop = FALSE]
  cat <- espec$categorias; k <- nrow(cat); nf <- nrow(F)
  rot_fila <- ifelse(is.na(F$rotulo) | !nzchar(F$rotulo), "", F$rotulo)
  lbw <- vapply(rot_fila, function(r) paste(strwrap(r, width = envolver), collapse = "\n"), "", USE.NAMES = FALSE)
  hay_chicas <- any(A * 100 > 0 & A * 100 < 7 & Dw)
  nl <- vapply(strsplit(lbw, "\n"), function(x) max(1L, length(x)), 1L)
  esp <- pmax(if (hay_chicas) 1.3 else 1, 0.55 + 0.34 * nl); tot <- sum(esp); ys <- tot - (cumsum(esp) - esp / 2) + 0.5
  d <- do.call(rbind, lapply(seq_len(nf), function(i) {
    p <- as.numeric(A[i, ]) * 100; x1 <- cumsum(p); x0 <- x1 - p
    data.frame(y = ys[i], cat = factor(cat$rotulo, levels = cat$rotulo), x0 = x0, x1 = x1, p = p, cifra = as.character(Ci[i, ]),
               dibujar = as.logical(Dw[i, ]), stringsAsFactors = FALSE)
  }))
  d <- d[d$dibujar & d$p > 0, , drop = FALSE]
  d$cabe <- d$p >= 7; d$xm <- (d$x0 + d$x1) / 2
  ttb <- !is.null(espec$box) && length(espec$box$cifras)
  chicas <- d[!d$cabe, , drop = FALSE]
  if (nrow(chicas)) chicas <- do.call(rbind, lapply(split(chicas, chicas$y), function(g) {
    g <- g[order(g$xm), ]; pos <- g$xm
    for (j in seq_along(pos)[-1]) pos[j] <- max(pos[j], pos[j - 1] + 5.5)   # separación en unidades de %
    tope <- if (ttb) 96 else 99                                             # no alcanza el rótulo del box
    if (pos[length(pos)] > tope) { pos[length(pos)] <- tope; if (length(pos) > 1) for (j in (length(pos) - 1):1) pos[j] <- min(pos[j], pos[j + 1] - 5.5) }
    g$xl <- pos; g
  }))
  h <- .std_word("figura", "alto_apilada")$grosor_fraccion %||% 0.58
  cols <- stats::setNames(cat$color, cat$rotulo)
  g <- ggplot2::ggplot(d) +
    ggplot2::geom_rect(ggplot2::aes(xmin = .data$x0, xmax = .data$x1 + 0.05, ymin = .data$y - h / 2, ymax = .data$y + h / 2, fill = .data$cat)) +
    ggplot2::scale_fill_manual(values = cols, breaks = cat$rotulo[espec$leyenda %||% seq_len(k)], drop = FALSE) +
    ggplot2::geom_text(data = d[d$cabe, , drop = FALSE], ggplot2::aes(x = .data$xm, y = .data$y, label = .data$cifra),
                       size = .word_pt(9), fontface = "bold", family = "Arial",
                       colour = vapply(cat$color[match(as.character(d$cat[d$cabe]), cat$rotulo)], .lam_texto_sobre, "")) +
    ggplot2::annotate("text", x = -4, y = ys, label = lbw, hjust = 1, size = .word_pt(9.5), fontface = "bold", colour = navy, family = "Arial", lineheight = 0.9)
  if (nrow(chicas)) {
    g <- g + ggplot2::geom_segment(data = chicas, ggplot2::aes(x = .data$xm, xend = .data$xm, y = .data$y + h / 2, yend = .data$y + h / 2 + 0.07), colour = gris, linewidth = 0.3) +
      ggplot2::geom_segment(data = chicas, ggplot2::aes(x = .data$xm, xend = .data$xl, y = .data$y + h / 2 + 0.07, yend = .data$y + h / 2 + 0.07), colour = gris, linewidth = 0.3) +
      ggplot2::geom_text(data = chicas, ggplot2::aes(x = .data$xl, y = .data$y + h / 2 + 0.2, label = .data$cifra), size = .word_pt(8), fontface = "bold", colour = navy, family = "Arial")
  }
  b2b <- ttb && !is.null(espec$box2) && length(espec$box2$cifras)
  y_tit <- max(ys) + h / 2 + (if (hay_chicas) 0.62 else 0.3)
  if (ttb) {
    g <- g + ggplot2::annotate("text", x = 110, y = ys, label = espec$box$cifras[orden], size = .word_pt(10), fontface = "bold", colour = verde, family = "Arial") +
      ggplot2::annotate("text", x = 110, y = y_tit, label = espec$box$rotulo, size = .word_pt(7.5), fontface = "bold", colour = verde, family = "Arial")
    if (b2b) g <- g + ggplot2::annotate("text", x = 124, y = ys, label = espec$box2$cifras[orden], size = .word_pt(10), fontface = "bold", colour = naranja, family = "Arial") +
      ggplot2::annotate("text", x = 124, y = y_tit, label = espec$box2$rotulo, size = .word_pt(7.5), fontface = "bold", colour = naranja, family = "Arial")
  }
  xmax <- if (b2b) 132 else if (ttb) 121 else 101; xmin <- .word_xmin(lbw, 9.5, xmax, -4)
  if (isTRUE(F$es_total[1]) && nf > 1) {   # desde el borde del eje: con rótulos cortos, −30 del recetario quedaba fuera
    g <- g + ggplot2::annotate("segment", x = max(-30, xmin), xend = if (b2b) 130 else 116, y = (ys[1] + ys[2]) / 2, yend = (ys[1] + ys[2]) / 2, colour = filete, linewidth = 0.5)
  }
  g <- g + ggplot2::scale_x_continuous(limits = c(xmin, xmax), expand = c(0, 0)) +
    ggplot2::scale_y_continuous(limits = c(0.45, max(tot + 0.75, y_tit + 0.15)), expand = c(0, 0)) +   # el rótulo del box no se cae del eje
    ggplot2::theme_void(base_family = "Arial") +
    ggplot2::theme(plot.background = ggplot2::element_blank(), panel.background = ggplot2::element_blank(), plot.margin = ggplot2::margin(6, 6, 4, 6),
                   legend.position = "bottom", legend.title = ggplot2::element_blank(), legend.text = ggplot2::element_text(size = 8, colour = navy),
                   legend.key.size = ggplot2::unit(8, "pt")) +
    ggplot2::guides(fill = ggplot2::guide_legend(nrow = if (sum(nchar(cat$rotulo)) > 90) 2 else 1, byrow = TRUE)) +
    ggplot2::coord_cartesian(clip = "off")
  attr(g, "filas") <- tot
  attr(g, "alto") <- .word_alto_figura("escala", tot)
  g
}
