# Piezas compartidas del recetario: se cargan antes de cualquier lámina.
# (Antes vivían en recetario_m2.R, recetario_m2b.R y recetario_m2c.R.)
YT <- Y_DATOS; YF <- 6.72                      # alto útil del contenido
ANCHO <- W - ML - MR; GAP <- 0.5
col2 <- (ANCHO - GAP) / 2
separador_v <- function(doc, x, y0, y1) caja(doc, x, y0, 0.008, y1 - y0, TK$rule)
separador_h <- function(doc, x0, x1, y) caja(doc, x0, y, x1 - x0, 0.008, TK$rule)

# Likert compacto dentro de un panel: rótulo a la izquierda, barra y Top Two Box.
likert_panel <- function(doc, x, y, w, filas, g = 0.34, fila = 0.66, wlab = 1.45, ttb_col = TRUE, cols = TK$likert, size_lab = 11) {
  wttb <- if (ttb_col) 0.75 else 0; xb <- x + wlab + 0.12; wb <- w - wlab - 0.12 - wttb
  if (ttb_col) txt(doc, if (ESTILO == "fiel") "TOP TWO BOX" else "Top Two Box", x + w - 1.3, y - 0.05, 1.3, 0.24, 10, TK$verde_txt, bold = TRUE, align = "center")
  yy <- y + 0.3
  if (any(vapply(filas, function(fl) tiene_peq(fl$f$pct, wb), TRUE)) && fila - g < 0.36) g <- max(0.22, fila - 0.36)   # aire para las cifras chicas
  for (fl in filas) {
    yb <- yy + (fila - g) / 2 + 0.05
    txt(doc, fl$lab, x, yb + g / 2 - alto_txt(fl$lab, wlab, size_lab, TRUE) / 2, wlab, alto_txt(fl$lab, wlab, size_lab, TRUE), size_lab, TK$navy, bold = TRUE, align = "right")
    barra_apilada(doc, xb, yb, wb, fl$f$pct, cols, g)
    if (ttb_col) txt(doc, paste0(ttb(fl$f), "%"), x + w - wttb, yb + (g - 0.3) / 2, wttb, 0.3, 13, TK$verde_txt, bold = TRUE, align = "center")
    yy <- yy + fila
  }
  zona(sprintf("likert compacto, g = %s cm", cm(g)), xb, y + 0.3, wb, length(filas) * fila)
  invisible(yy)
}
# Panel de texto narrativo: filete coral y párrafo con tramos en negrita.
narrativa <- function(doc, x, y, w, h, runs, size = 15) {
  caja(doc, x, y + 0.05, 0.05, h - 0.1, TK$coral)
  txt_runs(doc, runs, x + 0.22, y, w - 0.22, h, size = size)
  zona("texto narrativo", x, y, w, h)
}
B <- function(t) list(t = t, b = TRUE); N_ <- function(t) list(t = t)

# Dicotomía en una barra partida: cifra grande en cada extremo y la barra debajo.
dicotomia <- function(doc, x, y, w, labels, pct, n = NULL, size = 22, g = 0.34, cols = TK$dico) {
  size <- round(size * 0.85)   # C14 y C19: las cifras de la dicotomía, un poco más chicas en todo el mazo
  et <- function(k) if (is.null(n)) labels[k] else sprintf("%s (%d)", labels[k], n[k])
  txt(doc, paste0(pct[1], "%"), x, y, 1.6, size * 1.3 / 72, size, if (identical(cols, TK$dico)) TK$navy else "#4F7FAF", bold = TRUE)
  txt(doc, paste0(pct[2], "%"), x + w - 1.6, y, 1.6, size * 1.3 / 72, size, if (identical(cols, TK$dico)) "#4F7FAF" else TK$navy, bold = TRUE, align = "right")
  yl <- y + size * 1.25 / 72; yb <- yl + 0.32      # rótulo y barra se corren según el tamaño de la cifra
  txt(doc, et(1), x, yl, w / 2, 0.26, 10.5, TK$navy); txt(doc, et(2), x + w / 2, yl, w / 2, 0.26, 10.5, TK$navy, align = "right")
  w1 <- w * pct[1] / sum(pct)
  caja(doc, x + w1, yb, w - w1, g, cols[2]); caja(doc, x, yb, w1 + 0.004, g, cols[1])
  zona("dicotomía", x, y, w, yb - y + g)
  invisible(yb + g)
}
# Cifra destacada: número grande, rótulo y precisión debajo.
cifra <- function(doc, x, y, w, valor, rotulo, detalle = NULL, size = 34, align = "left") {
  txt(doc, valor, x, y, w, 0.62, size, TK$navy, bold = TRUE, align = align)
  txt(doc, rotulo, x, y + 0.62, w, 0.3, 12, TK$navy, bold = TRUE, align = align)
  if (!is.null(detalle)) txt(doc, detalle, x, y + 0.9, w, 0.26, 10, TK$faint, align = align)
  zona("cifra", x, y, w, 1.15)
}
icono_poblacion <- function(doc, nombre, cx, cy, d = 1.1) if (ICONO_MODO == "centro") icono_en_circulo(doc, nombre, cx - d / 2, cy - d / 2, d, pad = 0.26)


# Zoom o desglose conectado (pedido de Gonzalo: «quienes responden una cosa son los únicos que
# responden la siguiente»): una cuña translúcida une el segmento del filtro con el gráfico de la
# subpregunta. a = segmento de origen, b = destino; cada uno c(x0, y0, x1, y1) en pulgadas
# (dos puntos: los extremos del borde que se conecta).
zoom_conector <- function(doc, a, b, fill = "#081F5C", alpha = 0.05, borde = "#8E9DBD") {
  xs <- c(a[1], a[3], b[3], b[1]); ys <- c(a[2], a[4], b[4], b[2])
  l <- min(xs); t <- min(ys); w <- max(xs) - l; h <- max(ys) - t
  d <- data.frame(x = xs - l, y = h - (ys - t))
  gz <- ggplot(d, aes(x, y)) + geom_polygon(fill = fill, alpha = alpha, colour = NA) +
    geom_segment(aes(x = d$x[1], y = d$y[1], xend = d$x[4], yend = d$y[4]), colour = borde, linewidth = 0.4) +
    geom_segment(aes(x = d$x[2], y = d$y[2], xend = d$x[3], yend = d$y[3]), colour = borde, linewidth = 0.4) +
    scale_x_continuous(limits = c(0, w), expand = c(0, 0)) + scale_y_continuous(limits = c(0, h), expand = c(0, 0)) +
    theme_void() + theme(plot.margin = margin(0, 0, 0, 0))
  invisible(ph_with(doc, dml(ggobj = gz, bg = "transparent"), location = ph_location(left = l, top = t, width = max(w, 0.01), height = max(h, 0.01))))
}

# Llaves (C36 y C37: «una llave se ve más elegante» que la cuña semitransparente). Trazo azul oscuro de 0.022 in.
# llave_h: abraza un tramo horizontal [x0, x1] por debajo de y y baja un tallo desde el centro hasta y_tallo.
llave_h <- function(doc, x0, x1, y, y_tallo, color = TK$navy, t = 0.022) {
  caja(doc, x0, y, t, 0.1, color); caja(doc, x1 - t, y, t, 0.1, color); caja(doc, x0, y + 0.1 - t, x1 - x0, t, color)
  xc <- (x0 + x1) / 2; caja(doc, xc - t / 2, y + 0.1 - t, t, y_tallo - y - 0.1 + t, color)
  invisible(xc)
}
# llave_v: abraza un tramo vertical [y0, y1] a la derecha de x y sale un tallo horizontal hasta x_tallo.
llave_v <- function(doc, x, y0, y1, x_tallo, color = TK$navy, t = 0.022) {
  caja(doc, x, y0, 0.1, t, color); caja(doc, x, y1 - t, 0.1, t, color); caja(doc, x + 0.1 - t, y0, t, y1 - y0, color)
  yc <- (y0 + y1) / 2; caja(doc, x + 0.1 - t, yc - t / 2, x_tallo - x - 0.1 + t, t, color)
  invisible(yc)
}

# Serie temporal (C29, C40): guías suaves con su escala, puntos con borde y centro claro, cifras de la serie de arriba
# sobre sus puntos y las de abajo debajo (no se cruzan), y el nombre de cada serie al final de su línea.
grafico_serie <- function(periodos, series, cols, lim = NULL, paso = 10) {
  d <- do.call(rbind, lapply(names(series), function(g) data.frame(x = seq_along(periodos), v = series[[g]], g = g)))
  d$g <- factor(d$g, levels = names(series))
  arriba <- names(series)[which.max(vapply(series, mean, 0))]
  d$vj <- ifelse(d$g == arriba, -1.15, 2.0)
  lim <- lim %||% c(floor((min(d$v) - 8) / paso) * paso, ceiling((max(d$v) + 8) / paso) * paso)
  guias <- seq(lim[1], lim[2], paso)
  ultimo <- d[d$x == length(periodos), ]
  ggplot(d, aes(x, v, colour = g)) +
    geom_hline(yintercept = guias, colour = "#DCE1E8", linewidth = 0.35) +
    annotate("text", x = 0.62, y = guias, label = paste0(guias, "%"), hjust = 1, size = 10 / .pt, colour = TK$faint, family = "Arial") +
    geom_line(linewidth = 1.5) + geom_point(size = 3.6, shape = 21, fill = TK$fondo, stroke = 1.5) +
    geom_text(aes(label = paste0(v, "%"), vjust = vj), size = 12 / .pt, fontface = "bold", family = "Arial", show.legend = FALSE) +
    geom_text(data = ultimo, aes(x = length(periodos) + 0.16, label = g), hjust = 0, size = 13 / .pt, fontface = "bold", family = "Arial", show.legend = FALSE) +
    scale_colour_manual(values = cols) + scale_x_continuous(breaks = seq_along(periodos), labels = periodos, limits = c(0.45, length(periodos) + 0.95), expand = c(0, 0)) +
    scale_y_continuous(limits = lim, expand = c(0, 0)) + coord_cartesian(clip = "off") + labs(x = NULL, y = NULL) + theme_minimal(base_family = "Arial") +
    theme(legend.position = "none", panel.grid = element_blank(), axis.text.y = element_blank(), axis.text.x = element_text(size = 13, colour = TK$navy, face = "bold"),
          plot.background = element_blank(), panel.background = element_blank())
}

# Cifras de un par de puntos en la misma línea: la mayor a la derecha de su punto y la menor a la izquierda del suyo (C27, C28).
cifras_par <- function(doc, px, a, b, yc, col_a, col_b, size = 12) {
  mayor_a <- a >= b
  xa <- if (mayor_a) px(a) + 0.18 else px(a) - 0.18 - 0.7; xb <- if (mayor_a) px(b) - 0.18 - 0.7 else px(b) + 0.18
  txt(doc, paste0(a, "%"), xa, yc - 0.16, 0.7, 0.3, size, col_a, bold = TRUE, align = if (mayor_a) "left" else "right")
  txt(doc, paste0(b, "%"), xb, yc - 0.16, 0.7, 0.3, size, col_b, bold = TRUE, align = if (mayor_a) "right" else "left")
}

