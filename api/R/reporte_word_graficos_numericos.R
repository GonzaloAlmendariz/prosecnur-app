# =============================================================================
# reporte_word_graficos_numericos.R — números del Word del recetario (N8.8)
# =============================================================================
#
# Portan `g_dos_grupos` (moderna), `g_hist`, `g_promedios`, `g_rango` y `g_boxplot` (recetario_word_graficos.R:128-160,
# 213-242, 313-321) leyendo las especs `pesas/1`, `histograma/1`, `numerico/1`, `media_rango/1` y `boxplot/1`: las
# cifras, la diferencia (primera menos segunda, ADR 0093 enmienda 2026-10-09) y la mediana ya vienen resueltas.

#' Puntos comparativos y brecha (`g_dos_grupos()` moderna): dos puntos por fila, cada cifra hacia afuera de su punto y la
#' diferencia en su columna; entre años la diferencia se colorea (sube en verde, baja en coral), entre públicos no
#' @keywords internal
.word_g_pesas <- function(espec) {
  navy <- .std_word("colores", "titulos"); T <- .WORD_TINTA
  a <- espec$a; b <- espec$b; n <- length(a); gr <- espec$grupos
  cols <- .word_colores_de_espec(espec, gr, c(T$navy, T$celeste)); cb_col <- if (isTRUE(attr(cols, "de_paleta")[2])) cols[2] else T$medio; cols <- as.vector(cols)
  it <- .word_rotulos_completos(espec$rotulos, 8.5 + .word_desplazo("rotulo")); pd <- .word_posiciones(it); y <- pd$y   # R3: completo, hasta 3 líneas, columna <= 40 %
  lim <- 100; lo <- floor(min(a, b, na.rm = TRUE) / 10) * 10 - 10; rng <- lim - lo
  xd <- lim + rng * 0.2; sep <- rng * 0.025; cerca <- abs(a - b) < rng * 0.12
  anios <- all(grepl("^[0-9]{4}$", gr))
  d <- data.frame(y = y, a = a, b = b, cerca = cerca, ca = espec$cifras_a, cb = espec$cifras_b)
  pts <- rbind(data.frame(y = y, v = b, g = gr[2], cerca = cerca), data.frame(y = y, v = a, g = gr[1], cerca = cerca))
  pts$g <- factor(pts$g, levels = gr)
  col_dif <- if (anios) ifelse(espec$diferencia < 0, T$coral, T$verde) else navy
  g <- ggplot2::ggplot(d) +
    ggplot2::geom_segment(ggplot2::aes(x = pmin(.data$a, .data$b), xend = pmax(.data$a, .data$b), y = .data$y, yend = .data$y), colour = T$gris, linewidth = 0.8) +
    ggplot2::geom_point(data = pts, ggplot2::aes(x = .data$v, y = .data$y, colour = .data$g, size = factor(.data$cerca))) +
    ggplot2::scale_size_manual(values = c(`FALSE` = 3.2, `TRUE` = 2.5), guide = "none") +
    ggplot2::scale_colour_manual(values = stats::setNames(cols, gr), breaks = gr, labels = espec$leyenda %||% gr, name = NULL) +
    # Cada cifra al costado exterior de su punto, en la misma línea (Gonzalo, 2026-10-08: «números de porcentajes que chocan»).
    ggplot2::geom_text(ggplot2::aes(x = ifelse(.data$a >= .data$b, .data$a + sep, .data$a - sep), y = .data$y, label = .data$ca,
                                    hjust = ifelse(.data$a >= .data$b, 0, 1)), size = .word_pt(8.5, "cifra"), fontface = .word_cara("cifras"), colour = cols[1], family = "Arial") +
    ggplot2::geom_text(ggplot2::aes(x = ifelse(.data$a >= .data$b, .data$b - sep, .data$b + sep), y = .data$y, label = .data$cb,
                                    hjust = ifelse(.data$a >= .data$b, 1, 0)), size = .word_pt(8.5, "cifra"), fontface = .word_cara("cifras"), colour = cb_col, family = "Arial") +
    ggplot2::annotate("text", x = lo - rng * 0.03, y = y, label = it, hjust = 1, size = .word_pt(8.5, "rotulo"), fontface = .word_cara("categorias"), colour = navy,
                      family = "Arial", lineheight = 0.9) +
    ggplot2::scale_x_continuous(limits = c(.word_xmin(it, 8.5 + .word_desplazo("rotulo"), lim + rng * 0.3, lo - rng * 0.03), lim + rng * 0.3), expand = c(0, 0)) +
    ggplot2::scale_y_continuous(limits = c(0.4, pd$tot + 0.8)) + .word_tema() + ggplot2::coord_cartesian(clip = "off")
  if (!isFALSE(espec$mostrar_diferencia)) {
    g <- g + ggplot2::annotate("text", x = xd, y = y, label = espec$textos_diferencia, size = .word_pt(9, "cifra"), fontface = .word_cara("cifras"),
                               colour = col_dif, family = "Arial") +
      ggplot2::annotate("text", x = xd, y = pd$tot + 0.62, label = "Diferencia", size = .word_pt(7.5, "rotulo"), fontface = "bold", colour = T$gris, family = "Arial")
  }
  # Recetario: 2.4 in con 4 filas y su pie (recetario_word.R:379); sin el pie, 0.5 + 0.42 por fila.
  attr(g, "filas") <- pd$tot; attr(g, "alto") <- 0.5 + 0.42 * n
  g
}

#' El texto de la mediana como lo escribe el recetario WORD: sin truncar (`format(md)`, recetario_word_graficos.R:320; caja
#' `paste0(med)`, :239). La espec trae el texto del PPT, que trunca con datos enteros (recetario.R:631): aquí se rehace la
#' cifra desde el valor real y se conserva la unidad. Gonzalo, 2026-10-09: «El recetairo es la fuente de verdad» —cada
#' formato el suyo.
#' @keywords internal
.word_texto_mediana <- function(espec) {
  t <- as.character(espec$texto_mediana %||% "Mediana:")[1]
  if (!is.finite(espec$mediana %||% NA_real_)) return(t)
  sub("^(Mediana:) [^ ]+", paste("\\1", .cifra_mediana(espec$mediana, FALSE)), t)
}

#' Histograma (`g_hist()`): una columna por valor con su frecuencia encima, el valor debajo y la mediana como triángulo
#' coral bajo su valor; el texto de la mediana arriba a la derecha (ya truncado por la espec)
#' @keywords internal
.word_g_hist <- function(espec) {
  navy <- .std_word("colores", "titulos"); T <- .WORD_TINTA
  k <- seq_along(espec$rotulos); v <- espec$valores; mx <- max(v, na.rm = TRUE)
  d <- data.frame(k = k, v = v, cifra = espec$cifras, rot = espec$rotulos)
  g <- ggplot2::ggplot(d) +
    ggplot2::geom_rect(ggplot2::aes(xmin = .data$k - 0.46, xmax = .data$k + 0.46, ymin = 0, ymax = .data$v), fill = T$navy) +
    ggplot2::geom_text(data = d[nzchar(d$cifra), , drop = FALSE], ggplot2::aes(x = .data$k, y = .data$v + mx * 0.04, label = .data$cifra), vjust = 0,
                       size = .word_pt(8.5, "cifra"), fontface = .word_cara("cifras"), colour = navy, family = "Arial") +
    ggplot2::geom_text(ggplot2::aes(x = .data$k, y = -mx * 0.07, label = .data$rot), size = .word_pt(8.5, "rotulo"), colour = navy, family = "Arial") +
    ggplot2::annotate("point", x = espec$x_mediana + 1, y = -mx * 0.17, shape = 17, size = 2.6, colour = T$coral) +
    ggplot2::annotate("text", x = max(k) + 0.5, y = mx * 1.12, label = .word_texto_mediana(espec), hjust = 1, size = .word_pt(9, "cifra"), fontface = "bold",
                      colour = T$coral, family = "Arial") +
    ggplot2::scale_y_continuous(limits = c(-mx * 0.22, mx * 1.16), expand = c(0, 0)) + ggplot2::scale_x_continuous(expand = c(0.01, 0)) + .word_tema()
  attr(g, "alto") <- 2.5 - 0.22; g          # el recetario la inserta a 2.5 in con el pie (recetario_word.R:357)
}

#' Promedio por grupo (`g_promedios()`): columnas desde cero, la mayor en azul oscuro y la cifra encima
#' @keywords internal
.word_g_promedios <- function(espec) {
  navy <- .std_word("colores", "titulos"); T <- .WORD_TINTA
  v <- espec$valores; mx <- which.max(v)
  d <- data.frame(g = factor(espec$rotulos, levels = espec$rotulos), v = v, cifra = espec$cifras)
  g <- ggplot2::ggplot(d, ggplot2::aes(.data$g, .data$v)) +
    ggplot2::geom_col(width = 0.6, fill = ifelse(seq_along(v) == mx, T$navy, T$tenue)) +
    ggplot2::geom_text(ggplot2::aes(label = .data$cifra), vjust = -0.6, size = .word_pt(8.5, "cifra"), fontface = .word_cara("cifras"), colour = navy, family = "Arial") +
    ggplot2::scale_y_continuous(limits = c(0, max(v, na.rm = TRUE) * 1.18), expand = c(0, 0)) + .word_tema() +
    ggplot2::theme(axis.text.x = ggplot2::element_text(size = 8.5 + .word_desplazo("rotulo"), colour = navy, face = .word_cara("categorias"), family = "Arial"))
  attr(g, "alto") <- 2.2 - 0.22; g          # recetario_word.R:363
}

#' Media y rango (`g_rango()`): una línea del mínimo al máximo y un punto en la media, con la media encima
#' @keywords internal
.word_g_rango <- function(espec) {
  navy <- .std_word("colores", "titulos"); T <- .WORD_TINTA
  n <- length(espec$media); d <- data.frame(g = espec$rotulos, mn = espec$inf, mx = espec$sup, me = espec$media, cifra = espec$cifras, y = rev(seq_len(n)))
  lo <- floor(min(d$mn, na.rm = TRUE) / 10) * 10; hi <- ceiling(max(d$mx, na.rm = TRUE) / 10) * 10; r <- hi - lo
  g <- ggplot2::ggplot(d, ggplot2::aes(y = .data$y)) +
    ggplot2::geom_segment(ggplot2::aes(x = .data$mn, xend = .data$mx, yend = .data$y), colour = T$tenue, linewidth = 2.2, lineend = "round") +
    ggplot2::geom_point(ggplot2::aes(x = .data$me), size = 3.4, colour = T$navy) +
    ggplot2::geom_text(ggplot2::aes(x = .data$me, label = .data$cifra), nudge_y = 0.32, size = .word_pt(8.5, "cifra"), fontface = .word_cara("cifras"), colour = navy, family = "Arial") +
    ggplot2::geom_text(ggplot2::aes(x = .data$mn - r * 0.015, label = .cifra_mediana(.data$mn, TRUE)), hjust = 1, size = .word_pt(8, "rotulo"), colour = "#7F7F7F", family = "Arial") +
    ggplot2::geom_text(ggplot2::aes(x = .data$mx + r * 0.015, label = .cifra_mediana(.data$mx, TRUE)), hjust = 0, size = .word_pt(8, "rotulo"), colour = "#7F7F7F", family = "Arial") +
    ggplot2::annotate("text", x = lo - r * 0.08, y = d$y, label = d$g, hjust = 1, size = .word_pt(9, "rotulo"), fontface = .word_cara("categorias"), colour = navy, family = "Arial") +
    ggplot2::scale_x_continuous(limits = c(lo - r * 0.38, hi + r * 0.05), expand = c(0, 0)) + ggplot2::scale_y_continuous(limits = c(0.5, n + 0.7)) +
    .word_tema() + ggplot2::coord_cartesian(clip = "off")
  attr(g, "alto") <- 2.2 - 0.22; g          # recetario_word.R:369
}

#' Diagrama de caja por grupo (`g_boxplot()`): la caja del 50 % central, bigotes, atípicos y la mediana rotulada al lado
#' @keywords internal
.word_g_boxplot <- function(espec, unidad = "") {
  navy <- .std_word("colores", "titulos"); T <- .WORD_TINTA; G <- espec$grupos
  G$x <- seq_len(nrow(G))
  at <- do.call(rbind, lapply(seq_len(nrow(G)), function(i) if (length(espec$atipicos[[i]])) data.frame(x = i, v = espec$atipicos[[i]])))
  g <- ggplot2::ggplot(G) +
    ggplot2::geom_segment(ggplot2::aes(x = .data$x, xend = .data$x, y = .data$bigote_inf, yend = .data$bigote_sup), colour = navy, linewidth = 0.4) +
    ggplot2::geom_rect(ggplot2::aes(xmin = .data$x - 0.25, xmax = .data$x + 0.25, ymin = .data$q1, ymax = .data$q3), fill = "#D6DEEE", colour = navy, linewidth = 0.4) +
    ggplot2::geom_segment(ggplot2::aes(x = .data$x - 0.25, xend = .data$x + 0.25, y = .data$mediana, yend = .data$mediana), colour = navy, linewidth = 0.8) +
    ggplot2::annotate("text", x = G$x + 0.33, y = G$mediana, label = .cifra_mediana(G$mediana, FALSE), hjust = 0, size = .word_pt(8.5, "cifra"),
                      fontface = .word_cara("cifras"), colour = navy, family = "Arial") +
    ggplot2::scale_x_continuous(breaks = G$x, labels = G$rotulo, expand = ggplot2::expansion(add = 0.6)) + .word_tema() +
    ggplot2::theme(axis.text.x = ggplot2::element_text(size = 8.5 + .word_desplazo("rotulo"), colour = navy, face = .word_cara("categorias"), family = "Arial"),
                   axis.text.y = ggplot2::element_text(size = 8 + .word_desplazo("rotulo"), colour = T$gris, family = "Arial"),
                   panel.grid.major.y = ggplot2::element_line(colour = "#E3E6EC", linewidth = 0.3))
  if (!is.null(at)) g <- g + ggplot2::geom_point(data = at, ggplot2::aes(x = .data$x, y = .data$v), size = 1, colour = navy)
  attr(g, "alto") <- 2.2 - 0.22; g
}
