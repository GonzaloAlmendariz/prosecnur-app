# =============================================================================
# reporte_word_graficos_escala.R — la escala apilada del Word del recetario, desde la espec (N8.6; ADR 0093)
# =============================================================================
#
# Porta `g_apilada()` (recetario_word_graficos.R:39-76): barras de grosor 0.58 de la fila, cifra dentro sólo si el
# segmento la contiene (≥ 7 %), las chicas encima con su guía en codo, la columna Top Two Box en verde a la derecha (y
# Bottom Two Box en naranja si se pide, en su propia columna: `.word_columnas_box()`), un filete bajo la fila Total y la
# leyenda abajo. Lee la espec `escala/1`: las cifras, los anchos y el box ya vienen resueltos (redondeo de las láminas
# 20-21, Top Two Box de la 19) y aquí no se recalcula nada.

#' Tamaño de texto de un geom en el Word: nada bajo 8 pt (`PT()` del recetario)
#' @keywords internal
.word_pt <- function(x) max(.std_word("tipografia", "grafico_minimo"), x * 0.95) / ggplot2::.pt

#' Margen izquierdo del eje según el rótulo más largo ya partido (`xmin_para()` del recetario)
#' @keywords internal
.word_xmin <- function(rotulos, pt, xmax, x0 = 0) {
  L <- .word_rotulo_in(rotulos, pt)
  x0 - L * (xmax - x0) / (.std_word("pagina", "ancho_util") - 0.3 - L)
}

#' Ancho en pulgadas que reserva `.word_xmin()` para el rótulo más largo
#' @keywords internal
.word_rotulo_in <- function(rotulos, pt) {
  lin <- unlist(strsplit(rotulos, "\n")); lin <- lin[!is.na(lin)]
  if (!length(lin)) 0.15 else min(max(nchar(lin)) * max(7.5, pt * 0.95) * 0.5 / 72 + 0.15, 3.3)   # sin rótulos, sin -Inf
}

#' Ancho en pulgadas de un texto en negrita Arial a `pt` puntos (métrica de Helvetica, la que usa el dispositivo PDF)
#' @keywords internal
.word_texto_in <- function(texto, pt) {
  texto <- as.character(texto); texto <- texto[!is.na(texto) & nzchar(texto)]
  if (!length(texto)) return(0)
  previo <- grDevices::dev.cur(); grDevices::pdf(NULL)   # mide sin tocar el dispositivo en el que se esté dibujando
  on.exit({ grDevices::dev.off(); if (previo > 1L) grDevices::dev.set(previo) }, add = TRUE)
  graphics::par(family = "sans", ps = 12)
  max(graphics::strwidth(texto, units = "inches", cex = pt / 12, font = 2L))
}

#' Columnas Top Two Box y Bottom Two Box del Word, en unidades del eje x
#'
#' Con una sola columna (Top Two Box) se dibuja como en el recetario Word: cifra y rótulo centrados en x = 110 y el eje
#' hasta 121 (figuras 13 y 47 de `propuesta-word.docx`). Con las dos, las posiciones fijas 110/124 del recetario Word
#' encimaban los rótulos y cortaban «Bottom Two Box» en el borde (la figura 45 los perdía por el alto del eje). Aquí
#' rige la geometría del recetario PPT (lámina 79 de `recetario-moderna.pptx`): cada columna tiene su ancho, el rótulo
#' va en una línea centrado sobre su cifra y la Bottom Two Box va a la derecha de la Top Two Box sin tocarla. Los
#' anchos se miden en pulgadas y se pasan al eje con la misma relación que usa `.word_xmin()`, así que no dependen del
#' largo de los rótulos de las filas.
#' @return list(x1, x2, xmax, filete): centro de cada columna (x2 = NA sin Bottom Two Box), límite derecho del eje y fin
#'   del filete de la fila Total.
#' @keywords internal
.word_columnas_box <- function(lbw, rotulos, cifras, pt_rotulo, pt_cifra, b2b = FALSE) {
  if (!isTRUE(b2b)) return(list(x1 = 110, x2 = NA_real_, xmax = 121, filete = 116))
  ancho <- function(i) max(.word_texto_in(rotulos[i], pt_rotulo), .word_texto_in(cifras[[i]], pt_cifra))
  w1 <- ancho(1L); w2 <- ancho(2L)
  aire <- 0.12; gap <- 0.16; pad <- 0.06                                            # pulgadas: tras la barra, entre columnas y al borde
  c_in <- aire + w1 + gap + w2 + pad
  util <- .std_word("pagina", "ancho_util") - 0.3 - .word_rotulo_in(lbw, .WORD_ESCALA_PT$rotulo_fila)       # lo que mide de x = -4 a xmax (`.word_xmin`)
  k <- 104 / max(util - c_in, 1)                                                     # unidades del eje por pulgada
  list(x1 = 100 + (aire + w1 / 2) * k, x2 = 100 + (aire + w1 + gap + w2 / 2) * k, xmax = 100 + c_in * k,
       filete = 100 + (c_in - pad) * k)
}

#' Gráfico Word de una escala apilada a partir de su espec
#' @return ggplot con atributos `alto` (in, ya sin el pie) y `filas`.
#' @keywords internal
.word_g_escala <- function(espec, envolver = .WORD_ESCALA_ENVOLTURA) {   # constantes: reporte_word_escala_fijados.R
  navy <- .std_word("colores", "titulos"); gris <- "#8A93A8"; filete <- .std_word("colores", "filete")
  verde <- .std_color("verde_top_two_box"); naranja <- "#B4541F"
  orden <- espec$orden$aplicado %||% seq_len(nrow(espec$filas))
  F <- espec$filas[orden, , drop = FALSE]; U <- espec$unidades[orden, , drop = FALSE]; A <- espec$anchos[orden, , drop = FALSE]
  Ci <- espec$cifras[orden, , drop = FALSE]; Dw <- espec$dibujar[orden, , drop = FALSE]
  cat <- espec$categorias; k <- nrow(cat); nf <- nrow(F)
  rot_fila <- ifelse(is.na(F$rotulo) | !nzchar(F$rotulo), "", F$rotulo)
  lbw <- vapply(rot_fila, function(r) paste(strwrap(r, width = envolver), collapse = "\n"), "", USE.NAMES = FALSE)
  hay_chicas <- any(A * 100 > 0 & A * 100 < .WORD_ESCALA_CABE_PCT & Dw)
  nl <- vapply(strsplit(lbw, "\n"), function(x) max(1L, length(x)), 1L)
  esp <- pmax(if (hay_chicas) 1.3 else 1, 0.55 + 0.34 * nl); tot <- sum(esp); ys <- tot - (cumsum(esp) - esp / 2) + 0.5
  d <- do.call(rbind, lapply(seq_len(nf), function(i) {
    p <- as.numeric(A[i, ]) * 100; x1 <- cumsum(p); x0 <- x1 - p
    data.frame(y = ys[i], cat = factor(cat$rotulo, levels = cat$rotulo), x0 = x0, x1 = x1, p = p, cifra = as.character(Ci[i, ]),
               dibujar = as.logical(Dw[i, ]), stringsAsFactors = FALSE)
  }))
  d <- d[d$dibujar & d$p > 0, , drop = FALSE]
  d$cabe <- d$p >= .WORD_ESCALA_CABE_PCT; d$xm <- (d$x0 + d$x1) / 2
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
                       size = .word_pt(.WORD_ESCALA_PT$cifra_dentro), fontface = "bold", family = "Arial",
                       colour = vapply(cat$color[match(as.character(d$cat[d$cabe]), cat$rotulo)], .lam_texto_sobre, "")) +
    ggplot2::annotate("text", x = -4, y = ys, label = lbw, hjust = 1, size = .word_pt(.WORD_ESCALA_PT$rotulo_fila), fontface = "bold", colour = navy, family = "Arial", lineheight = 0.9)
  if (nrow(chicas)) {
    g <- g + ggplot2::geom_segment(data = chicas, ggplot2::aes(x = .data$xm, xend = .data$xm, y = .data$y + h / 2, yend = .data$y + h / 2 + 0.07), colour = gris, linewidth = 0.3) +
      ggplot2::geom_segment(data = chicas, ggplot2::aes(x = .data$xm, xend = .data$xl, y = .data$y + h / 2 + 0.07, yend = .data$y + h / 2 + 0.07), colour = gris, linewidth = 0.3) +
      ggplot2::geom_text(data = chicas, ggplot2::aes(x = .data$xl, y = .data$y + h / 2 + 0.2, label = .data$cifra), size = .word_pt(.WORD_ESCALA_PT$cifra_chica), fontface = "bold", colour = navy, family = "Arial")
  }
  b2b <- ttb && !is.null(espec$box2) && length(espec$box2$cifras)
  y_tit <- max(ys) + h / 2 + (if (hay_chicas) 0.62 else 0.3)
  pt_de <- function(x) .word_pt(x) * ggplot2::.pt
  col <- .word_columnas_box(lbw, c(espec$box$rotulo %||% "", espec$box2$rotulo %||% ""),
                            list(espec$box$cifras, espec$box2$cifras), pt_de(.WORD_ESCALA_PT$box_rotulo), pt_de(.WORD_ESCALA_PT$box_cifra), b2b = b2b)
  if (ttb) {
    g <- g + ggplot2::annotate("text", x = col$x1, y = ys, label = espec$box$cifras[orden], size = .word_pt(.WORD_ESCALA_PT$box_cifra), fontface = "bold", colour = verde, family = "Arial") +
      ggplot2::annotate("text", x = col$x1, y = y_tit, label = espec$box$rotulo, size = .word_pt(.WORD_ESCALA_PT$box_rotulo), fontface = "bold", colour = verde, family = "Arial")
    if (b2b) g <- g + ggplot2::annotate("text", x = col$x2, y = ys, label = espec$box2$cifras[orden], size = .word_pt(.WORD_ESCALA_PT$box_cifra), fontface = "bold", colour = naranja, family = "Arial") +
      ggplot2::annotate("text", x = col$x2, y = y_tit, label = espec$box2$rotulo, size = .word_pt(.WORD_ESCALA_PT$box_rotulo), fontface = "bold", colour = naranja, family = "Arial")
  }
  xmax <- if (ttb) col$xmax else 101; xmin <- .word_xmin(lbw, .WORD_ESCALA_PT$rotulo_fila, xmax, -4)
  attr_cols <- if (ttb) col[c("x1", "x2", "xmax")] else NULL
  if (isTRUE(F$es_total[1]) && nf > 1) {   # desde el borde del eje: con rótulos cortos, −30 del recetario quedaba fuera
    g <- g + ggplot2::annotate("segment", x = max(-30, xmin), xend = if (ttb) col$filete else 116, y = (ys[1] + ys[2]) / 2, yend = (ys[1] + ys[2]) / 2, colour = filete, linewidth = 0.5)
  }
  g <- g + ggplot2::scale_x_continuous(limits = c(xmin, xmax), expand = c(0, 0)) +
    ggplot2::scale_y_continuous(limits = c(0.45, max(tot + 0.75, y_tit + 0.15)), expand = c(0, 0)) +   # el rótulo del box no se cae del eje
    ggplot2::theme_void(base_family = "Arial") +
    ggplot2::theme(plot.background = ggplot2::element_blank(), panel.background = ggplot2::element_blank(), plot.margin = ggplot2::margin(6, 6, 4, 6),
                   legend.position = "bottom", legend.title = ggplot2::element_blank(), legend.text = ggplot2::element_text(size = .WORD_ESCALA_PT$leyenda, colour = navy),
                   legend.key.size = ggplot2::unit(.WORD_ESCALA_PT$leyenda_clave, "pt")) +
    ggplot2::guides(fill = ggplot2::guide_legend(nrow = if (sum(nchar(cat$rotulo)) > .WORD_ESCALA_LEYENDA_DOS_FILAS) 2 else 1, byrow = TRUE)) +
    ggplot2::coord_cartesian(clip = "off")
  attr(g, "filas") <- tot
  attr(g, "columnas_box") <- attr_cols   # centros y borde del eje: el contrato de no encimado los lee
  attr(g, "alto") <- .word_alto_figura("escala", tot)
  g
}
