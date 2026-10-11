# =============================================================================
# reporte_word_graficos_categorica.R — barras, dicotomía, lollipop y divergentes del Word del recetario (N8.7)
# =============================================================================
#
# Portan `g_barras`, `g_sino`, `g_lollipop` y `g_divergente` (recetario_word_graficos.R:79-125, 204-226) leyendo las
# especs `categorica/1` y `divergentes/1`: cifras, orden, residuales al final y realce ya vienen resueltos.
# Las agrupadas van de 0 a 100 % cuando la espec lo marca (`escala_completa`; Gonzalo, 2026-10-09: «si vamos a usar
# barras agrupadas es mejor que por defecto vayan de 0 a 100%»).

.WORD_TINTA <- list(navy = "#081F5C", tenue = "#8E9DBD", gris = "#8A93A8", celeste = "#9DC3E6", medio = "#4F7FAF",
                    verde = "#4E9438", coral = "#CA5651")

#' Tema de las figuras Word del recetario (`tema_w()`): vacío, Arial, leyenda abajo a 8 pt
#' @keywords internal
.word_tema <- function() {
  navy <- .std_word("colores", "titulos")
  ggplot2::theme_void(base_family = "Arial") +
    ggplot2::theme(plot.background = ggplot2::element_blank(), panel.background = ggplot2::element_blank(), plot.margin = ggplot2::margin(6, 6, 4, 6),
                   legend.position = "bottom", legend.title = ggplot2::element_blank(), legend.text = ggplot2::element_text(size = 8, colour = navy),
                   legend.key.size = ggplot2::unit(8, "pt"))
}

#' Centros de fila según las líneas de cada rótulo (`posiciones()` del recetario)
#' @keywords internal
.word_posiciones <- function(rotulos_envueltos, minimo = 1) {
  nl <- vapply(strsplit(rotulos_envueltos, "\n"), function(x) max(1L, length(x)), 1L)
  esp <- pmax(minimo, 0.55 + 0.34 * nl); tot <- sum(esp)
  list(y = tot - (cumsum(esp) - esp / 2) + 0.5, tot = tot)
}

# Rótulo largo: nunca se corta. Se ensancha el envoltorio desde `desde` hasta `hasta` caracteres buscando que ninguno pase de
# `lineas`; `.word_xmin` abre la columna de rótulos a ese ancho (tope 3.3 in). Si aun al ancho máximo no entra, crece en
# líneas y la fila crece con él (`.word_posiciones`). Gonzalo (2026-10-09): el rótulo grande gana espacio, no se trunca.
.word_envolver_holgado <- function(x, desde, hasta = 52L, lineas = 3L) {
  for (w in seq.int(desde, max(desde, hasta), by = 2L)) {
    l <- .word_envolver(x, w)
    if (max(vapply(strsplit(l, "\n"), length, 1L)) <= lineas) return(l)
  }
  .word_envolver(x, max(desde, hasta))
}
.word_envolver <- function(x, ancho)vapply(as.character(x), function(r) paste(strwrap(r, width = ancho), collapse = "\n"), "", USE.NAMES = FALSE)

#' Barras horizontales de una categórica o una agrupada de una serie
#' @keywords internal
.word_g_barras <- function(espec) {
  navy <- .std_word("colores", "titulos"); T <- .WORD_TINTA
  l <- .word_envolver_holgado(espec$rotulos, 40); p <- espec$largos * 100
  resid <- grepl(.CATEGORIAS_RESIDUALES, espec$rotulos, ignore.case = TRUE)
  ps <- .word_posiciones(l); mx <- which.max(ifelse(resid, -1, p))
  col <- if (isTRUE(espec$realce)) ifelse(resid, T$gris, ifelse(seq_along(p) == mx, T$navy, T$tenue)) else ifelse(resid, T$gris, T$navy)
  marcas <- isTRUE(espec$escala_completa) && isTRUE(espec$marcas_eje)
  esc <- if (isTRUE(espec$escala_completa)) max(100, max(p)) * 1.12 else max(p) * (if (any(grepl("\\(", espec$cifras))) 1.34 else 1.18)
  d <- data.frame(l = l, p = p, y = ps$y, col = col, et = espec$cifras, negrita = isTRUE(espec$realce) & seq_along(p) == mx, stringsAsFactors = FALSE)
  g <- ggplot2::ggplot(d) +
    ggplot2::geom_rect(ggplot2::aes(xmin = 0, xmax = .data$p, ymin = .data$y - 0.32, ymax = .data$y + 0.32, fill = .data$col)) + ggplot2::scale_fill_identity() +
    ggplot2::geom_text(ggplot2::aes(x = .data$p + esc * 0.015, y = .data$y, label = .data$et), hjust = 0, size = .word_pt(9), fontface = "bold", colour = navy, family = "Arial") +
    ggplot2::geom_text(ggplot2::aes(x = -esc * 0.02, y = .data$y, label = .data$l, fontface = ifelse(.data$negrita, "bold", "plain")), hjust = 1, size = .word_pt(9),
                       colour = navy, family = "Arial", lineheight = 0.9) +
    ggplot2::scale_x_continuous(limits = c(.word_xmin(l, 9, esc), esc), expand = c(0, 0)) +
    ggplot2::scale_y_continuous(limits = c(if (marcas) -0.1 else 0.4, ps$tot + 0.6), expand = c(0, 0)) + .word_tema()
  # Marcas 0-25-50-75-100 % bajo las barras, como la variante «fiel» de g_barras (RG:91): opcionales con la escala de 0 a
  # 100 % (Gonzalo, 2026-10-09: «Opcional brindar ambas opciones»).
  if (marcas) g <- g + ggplot2::annotate("text", x = seq(0, 100, 25), y = 0.15, label = paste0(seq(0, 100, 25), "%"), size = .word_pt(7.5),
                                         colour = "#A6A6A6", family = "Arial")
  attr(g, "filas") <- ps$tot; attr(g, "alto") <- .word_alto_figura("barras", ps$tot) + (if (marcas) 0.15 else 0)
  g
}

#' Dicotomía: la barra parte el total y las dos cifras grandes encima (`g_sino()` moderna)
#' @keywords internal
.word_g_sino <- function(espec) {
  navy <- .std_word("colores", "titulos"); T <- .WORD_TINTA
  p1 <- espec$largos[1] * 100; rot <- espec$rotulos[1:2]
  n <- .espec_casos(espec)[1:2]; et <- ifelse(is.finite(n), sprintf("%s (%s)", rot, format(n, big.mark = ",", trim = TRUE)), rot)
  d <- data.frame(x0 = c(0, p1), x1 = c(p1, 100), k = factor(rot, levels = rot))
  g <- ggplot2::ggplot(d) + ggplot2::geom_rect(ggplot2::aes(xmin = .data$x0, xmax = .data$x1, ymin = 0, ymax = 1, fill = .data$k)) +
    ggplot2::scale_fill_manual(values = stats::setNames(c(T$navy, T$celeste), rot)) +
    ggplot2::annotate("text", x = 0, y = 2.0, label = espec$cifras[1], hjust = 0, size = .word_pt(22), fontface = "bold", colour = T$navy, family = "Arial") +
    ggplot2::annotate("text", x = 100, y = 2.0, label = espec$cifras[2], hjust = 1, size = .word_pt(22), fontface = "bold", colour = T$medio, family = "Arial") +
    ggplot2::annotate("text", x = 0, y = 1.3, label = et[1], hjust = 0, size = .word_pt(9), colour = navy, family = "Arial") +
    ggplot2::annotate("text", x = 100, y = 1.3, label = et[2], hjust = 1, size = .word_pt(9), colour = navy, family = "Arial") +
    ggplot2::scale_x_continuous(limits = c(0, 100), expand = c(0.01, 0)) + ggplot2::scale_y_continuous(limits = c(-0.1, 2.6)) +
    .word_tema() + ggplot2::theme(legend.position = "none")
  attr(g, "alto") <- .word_alto_figura("dicotomia"); g
}

#' Lollipop ordenado de menor a mayor, el mayor en azul (`g_lollipop()` moderna)
#' @keywords internal
.word_g_lollipop <- function(espec) {
  navy <- .std_word("colores", "titulos"); T <- .WORD_TINTA
  w <- .word_envolver_holgado(espec$rotulos, 45); p <- espec$largos * 100; o <- order(p)
  d <- data.frame(l = factor(w[o], levels = unique(w[o])), p = p[o], et = espec$cifras[o]); top <- nrow(d)
  g <- ggplot2::ggplot(d, ggplot2::aes(y = .data$l)) +
    ggplot2::geom_segment(ggplot2::aes(x = 0, xend = .data$p, yend = .data$l), colour = T$tenue, linewidth = 0.9) +
    ggplot2::geom_point(ggplot2::aes(x = .data$p), size = 3, colour = ifelse(seq_len(top) == top, T$navy, T$tenue)) +
    ggplot2::geom_text(ggplot2::aes(x = .data$p + max(.data$p) * 0.04, label = .data$et), hjust = 0, size = .word_pt(8.5), fontface = "bold", colour = navy, family = "Arial") +
    ggplot2::scale_x_continuous(limits = c(0, max(d$p) * 1.15), expand = c(0, 0)) + .word_tema() +
    ggplot2::theme(axis.text.y = ggplot2::element_text(size = max(8, 8.5 * 0.95), colour = navy, family = "Arial", hjust = 1, lineheight = 0.9, margin = ggplot2::margin(r = 8)))
  attr(g, "alto") <- .word_alto_figura("lollipop"); g
}

#' Divergentes: desacuerdo a la izquierda del cero, acuerdo a la derecha y los totales a cada lado (`g_divergente()`)
#' @keywords internal
.word_g_divergente <- function(espec) {
  navy <- .std_word("colores", "titulos"); T <- .WORD_TINTA
  it <- .word_envolver_holgado(espec$filas, 42); pd <- .word_posiciones(it); C <- espec$categorias
  d <- do.call(rbind, lapply(seq_along(espec$filas), function(i) {
    u <- espec$unidades[i, ]; filas <- list()
    x <- 0; for (j in espec$orden_neg) { filas[[length(filas) + 1L]] <- data.frame(j = j, x0 = -x - u[j], x1 = -x); x <- x + u[j] }
    x <- 0; for (j in espec$orden_pos) { filas[[length(filas) + 1L]] <- data.frame(j = j, x0 = x, x1 = x + u[j]); x <- x + u[j] }
    r <- do.call(rbind, filas); r$y <- pd$y[i]; r$p <- u[r$j]; r$cifra <- espec$cifras[i, r$j]; r$k <- factor(C$rotulo[r$j], levels = C$rotulo); r
  }))
  tn <- espec$total_neg; tp <- espec$total_pos; xl <- -max(tn) - 22
  g <- ggplot2::ggplot(d) + ggplot2::geom_rect(ggplot2::aes(xmin = .data$x0, xmax = .data$x1, ymin = .data$y - 0.3, ymax = .data$y + 0.3, fill = .data$k)) +
    ggplot2::scale_fill_manual(values = stats::setNames(C$color, C$rotulo), breaks = C$rotulo[C$lado %in% c("neg", "pos")]) +
    ggplot2::geom_text(data = d[d$p >= 8, , drop = FALSE], ggplot2::aes(x = (.data$x0 + .data$x1) / 2, y = .data$y, label = .data$cifra), size = .word_pt(8.5), fontface = "bold",
                       colour = navy, family = "Arial") +
    ggplot2::geom_vline(xintercept = 0, colour = navy, linewidth = 0.4) +
    ggplot2::annotate("text", x = -tn - 3, y = pd$y, label = espec$cifras_neg, hjust = 1, size = .word_pt(9), fontface = "bold", colour = T$coral, family = "Arial") +
    ggplot2::annotate("text", x = tp + 3, y = pd$y, label = espec$cifras_pos, hjust = 0, size = .word_pt(9), fontface = "bold", colour = T$verde, family = "Arial") +
    ggplot2::annotate("text", x = xl, y = pd$y, label = it, hjust = 1, size = .word_pt(8.5), fontface = "bold", colour = navy, family = "Arial", lineheight = 0.9) +
    ggplot2::scale_x_continuous(limits = c(.word_xmin(it, 8.5, 110, xl), 110), expand = c(0, 0)) + ggplot2::scale_y_continuous(limits = c(0.4, pd$tot + 0.6)) + .word_tema()
  attr(g, "filas") <- pd$tot; attr(g, "alto") <- .word_alto_figura("divergentes", pd$tot)
  g
}
