# Recetario en Word: gráficos a escala de página (I42, corrección de Gonzalo: «en word los gráficos
# van con un formato especial para que se vean bien: sin fondo, con texto encima como título y texto
# abajo para los públicos»). Formato medido en los Word entregados (Derecho 2026, AMDT 2026):
#   - título arriba como PÁRRAFO: «Gráfico N.º X: pregunta», 9 pt, negrita cursiva, navy 002060, centrado;
#   - imagen sin fondo de 5,8 a 6,3 in de ancho, sin título dentro;
#   - dentro de la imagen, al pie: leyenda y «N = … Fuente: PULSO PUCP 2026.» en cursiva navy;
#   - Top Two Box en columna a la derecha con rótulo arriba (verde, mayúsculas en la fiel).
# ESTILO=fiel reproduce ese formato (el del motor de Word) con las reglas de rotulado del recetario;
# ESTILO=moderna aplica además las propuestas (categoría mayor destacada, dicotomía, dumbbell, etc.).
suppressMessages(library(ggplot2))
WTK <- list(navy = "#081F5C", navy_w = "#002060", azul_si = if (ESTILO == "fiel") "#2B5797" else "#081F5C", celeste = if (ESTILO == "fiel") "#8DB4E2" else "#9DC3E6",
            likert = c("#F4B183", "#FFD965", "#ADD493", "#70AD47", "#BFBFBF"), verde = if (ESTILO == "fiel") "#548135" else "#4E9438",
            tenue = "#8E9DBD", gris = "#8A93A8", rule = "#D5D9DF")
ANCHO_W <- 6.27                                           # ancho de la imagen en la página (in)
FS <- if (ESTILO == "fiel") 0.86 else 0.95                 # escala de letra: la fiel imita los entregados (7,5 a 8,5 pt)
PT <- function(x) max(7.5, x * FS) / .pt                   # tamaños de texto de geom en puntos; nada bajo 7,5 pt en Word
fuente_pie <- function(n_txt) stringr::str_wrap(if (nzchar(n_txt)) paste0(n_txt, ". Fuente: PULSO PUCP 2026.") else "Fuente: PULSO PUCP 2026.", 120)
tema_w <- function() theme_void(base_family = "Arial") + theme(plot.background = element_blank(), panel.background = element_blank(),
  plot.caption = element_text(size = 7.5, face = "italic", colour = WTK$navy_w, hjust = 0.5, margin = margin(t = 6)),
  plot.margin = margin(6, 6, 4, 6), legend.position = "bottom", legend.title = element_blank(),
  legend.text = element_text(size = 7.5, colour = WTK$navy_w), legend.key.size = unit(8, "pt"))


# Margen izquierdo según la etiqueta más larga ya partida: ninguna etiqueta se corta.
# lbls: etiquetas con saltos de línea; pt: tamaño en puntos; xmax: límite derecho del eje; x0: inicio de las barras.
lab_in <- function(lbls, pt) max(nchar(unlist(strsplit(lbls, "\n")))) * max(7.5, pt * FS) * 0.5 / 72 + 0.15
xmin_para <- function(lbls, pt, xmax, x0 = 0) { L <- min(lab_in(lbls, pt), 3.3); x0 - L * (xmax - x0) / (ANCHO_W - 0.3 - L) }


# Alto de cada fila según las líneas de su etiqueta: devuelve el centro de cada fila (de arriba abajo) y el total.
posiciones <- function(lbls_envueltos, minimo = 1) {
  nl <- vapply(strsplit(lbls_envueltos, "\n"), length, 0L); esp <- pmax(minimo, 0.55 + 0.34 * nl)
  tot <- sum(esp); cen <- tot - (cumsum(esp) - esp / 2) + 0.5
  list(y = cen, tot = tot)
}

# Barra apilada por actor (Likert o Sí/No) con columna Top Two Box y cifras chicas encima con guía.
# filas: list(list(actor, pct)); rot: rótulos de categorías; cols: colores.
g_apilada <- function(filas, rot, cols, ttb = TRUE, n_txt = "", ancho_lab = 1.3, envolver = 22, ttb21 = NULL) {
  k <- length(rot); nf <- length(filas)
  lbw <- stringr::str_wrap(vapply(filas, `[[`, "", "actor"), envolver); hay_chicas <- any(vapply(filas, function(f) any(f$pct > 0 & f$pct < 7), TRUE))
  ps <- posiciones(lbw, minimo = if (hay_chicas) 1.3 else 1); ys <- ps$y   # aire sobre la barra para las cifras que suben
  d <- do.call(rbind, lapply(seq_along(filas), function(i) { p <- filas[[i]]$pct; x1 <- cumsum(p); x0 <- x1 - p
    data.frame(y = ys[i], cat = factor(rot, levels = rot), x0 = x0, x1 = x1, p = p) }))
  d$cabe <- d$p >= 7                                       # cifra dentro sólo si el segmento la contiene
  d$xm <- (d$x0 + d$x1) / 2
  chicas <- d[!d$cabe & d$p > 0, ]
  if (nrow(chicas)) chicas <- do.call(rbind, lapply(split(chicas, chicas$y), function(g) { g <- g[order(g$xm), ]; pos <- g$xm
    for (j in seq_along(pos)[-1]) pos[j] <- max(pos[j], pos[j - 1] + 5.5)       # separación en unidades de %
    tope <- if (ttb) 96 else 99   # con Top Two Box, la última cifra no alcanza el rótulo de la columna
    if (pos[length(pos)] > tope) { pos[length(pos)] <- tope; if (length(pos) > 1) for (j in (length(pos) - 1):1) pos[j] <- min(pos[j], pos[j + 1] - 5.5) }
    g$xl <- pos; g }))
  h <- if (ESTILO == "fiel") 0.7 else 0.58                   # grosor de barra en unidades de fila
  gg <- ggplot(d) + geom_rect(aes(xmin = x0, xmax = x1 + 0.05, ymin = y - h / 2, ymax = y + h / 2, fill = cat)) +
    scale_fill_manual(values = setNames(cols[seq_len(k)], rot), drop = FALSE) +
    geom_text(data = d[d$cabe, ], aes(x = xm, y = y, label = paste0(p, "%")), size = PT(9), fontface = "bold", family = "Arial",
              colour = ifelse(d$cat[d$cabe] %in% rot[1] & identical(cols[1], WTK$azul_si), "#FFFFFF", WTK$navy_w)) +
    annotate("text", x = -4, y = ys, label = lbw, hjust = 1, size = PT(9.5), fontface = "bold", colour = WTK$navy_w, family = "Arial", lineheight = 0.9)
  if (nrow(chicas)) gg <- gg + geom_segment(data = chicas, aes(x = xm, xend = xm, y = y + h / 2, yend = y + h / 2 + 0.07), colour = WTK$gris, linewidth = 0.3) +
    geom_segment(data = chicas, aes(x = xm, xend = xl, y = y + h / 2 + 0.07, yend = y + h / 2 + 0.07), colour = WTK$gris, linewidth = 0.3) +
    geom_text(data = chicas, aes(x = xl, y = y + h / 2 + 0.2, label = paste0(p, "%")), size = PT(8), fontface = "bold", colour = WTK$navy_w, family = "Arial")
  gg <- gg
  if (ttb) { sus <- tail(which(!grepl("^SIN INF|^No he usado|^No sabe", rot)), 2); tt <- vapply(filas, function(f) sum(f$pct[sus]), 0)
    gg <- gg + annotate("text", x = 110, y = ys, label = paste0(tt, "%"), size = PT(10), fontface = "bold", colour = WTK$verde, family = "Arial") +
      annotate("text", x = 110, y = max(ys) + h / 2 + (if (hay_chicas) 0.62 else 0.3), label = if (ESTILO == "fiel") "TOP TWO BOX" else "Top Two Box", size = PT(7.5), fontface = "bold", colour = WTK$verde, family = "Arial")
    if (!is.null(ttb21)) gg <- gg + annotate("text", x = 118, y = ys, label = ifelse(is.na(ttb21), "", paste0(ttb21, "%")), size = PT(9), fontface = "bold", colour = WTK$gris, family = "Arial") +
      annotate("text", x = c(110, 118), y = max(ys) + 0.38, label = c("2026", "2021"), size = PT(7.5), fontface = "bold", colour = c(WTK$navy_w, WTK$gris), family = "Arial") }
  gg <- gg + scale_x_continuous(limits = c(xmin_para(stringr::str_wrap(vapply(filas, `[[`, "", "actor"), envolver), 9.5, if (!is.null(ttb21)) 124 else if (ttb) 121 else 101, -4), if (!is.null(ttb21)) 124 else if (ttb) 121 else 101), expand = c(0, 0)) + scale_y_continuous(limits = c(0.45, ps$tot + 0.75), expand = c(0, 0)) +
    labs(caption = fuente_pie(n_txt)) + tema_w() + guides(fill = guide_legend(nrow = 1)) + coord_cartesian(clip = "off")
  attr(gg, "alto") <- alto_apilada(ps$tot); gg
}
alto_apilada <- function(nf) if (ESTILO == "fiel") 0.62 + 0.3 * nf + 0.42 else 0.7 + 0.36 * nf + 0.5   # fiel: 3 actores en ~1,95 in como los entregados

# Barras horizontales de una variable (perfil, opción múltiple, ordinales). Residuales al final.
g_barras <- function(labels, pct, n_txt = "", destacar = ESTILO == "moderna", con_n = NULL, resid = grepl("^Otro|^No sabe|^Ninguna|^Prefiero", labels)) {
  o <- seq_along(labels); d <- data.frame(l = stringr::str_wrap(labels, 40), p = pct, r = resid)[o, ]; d <- rbind(d[!d$r, ], d[d$r, ])
  psb <- posiciones(d$l, minimo = 1); d$y <- psb$y; mx <- which.max(ifelse(d$r, -1, d$p))
  d$col <- if (destacar) ifelse(d$r, WTK$gris, ifelse(seq_len(nrow(d)) == mx, WTK$navy, WTK$tenue)) else ifelse(d$r, WTK$gris, WTK$azul_si)
  d$et <- if (is.null(con_n)) paste0(d$p, "%") else paste0(d$p, "% (", con_n[o][c(which(!resid), which(resid))], ")")
  # Fiel como los Word entregados (AMDT, Educación): eje de 0% a 100%, cifra blanca centrada dentro de la barra y afuera sólo si no cabe.
  eje <- ESTILO == "fiel" && is.null(con_n)
  esc <- if (eje) 100 else max(d$p) * (if (is.null(con_n)) 1.18 else 1.34)
  d$dentro <- eje & d$p >= 9
  gb <- ggplot(d) + geom_rect(aes(xmin = 0, xmax = p, ymin = y - 0.32, ymax = y + 0.32, fill = col)) + scale_fill_identity() +
    geom_text(data = d[!d$dentro, ], aes(x = p + esc * 0.015, y = y, label = et), hjust = 0, size = PT(9), fontface = "bold", colour = WTK$navy_w, family = "Arial") +
    geom_text(data = d[d$dentro, ], aes(x = p / 2, y = y, label = et), size = PT(9), fontface = "bold", colour = "#FFFFFF", family = "Arial") +
    (if (eje) annotate("text", x = seq(0, 100, 25), y = 0.15, label = paste0(seq(0, 100, 25), "%"), size = PT(7.5), colour = "#A6A6A6", family = "Arial")) +
    geom_text(aes(x = -esc * 0.02, y = y, label = l, fontface = ifelse(destacar & seq_len(nrow(d)) == mx, "bold", "plain")), hjust = 1, size = PT(9), colour = WTK$navy_w, family = "Arial", lineheight = 0.9) +
    scale_x_continuous(limits = c(xmin_para(d$l, 9, esc), esc), expand = c(0, 0)) + scale_y_continuous(limits = c(if (eje) -0.1 else 0.4, psb$tot + 0.6), expand = c(0, 0)) +
    labs(caption = fuente_pie(n_txt)) + tema_w()
  attr(gb, "alto") <- alto_barras(psb$tot) + (if (eje) 0.15 else 0); gb
}
alto_barras <- function(n) if (ESTILO == "fiel") 0.4 + 0.24 * n + 0.28 else 0.45 + 0.27 * n + 0.3

# Dicotomía (moderna) o torta (fiel) para una pregunta Sí / No.
g_sino <- function(labels, pct, n = NULL, n_txt = "") {
  if (ESTILO == "fiel") {
    d <- data.frame(k = factor(labels, levels = labels), v = pct); d$et <- if (is.null(n)) paste0(pct, "%") else paste0(pct, "%\n(", n, ")")
    return(ggplot(d, aes(x = 1, y = v, fill = k)) + geom_col(width = 1, colour = "#FFFFFF") + coord_polar(theta = "y", direction = -1) +
      geom_text(aes(label = et), position = position_stack(vjust = 0.5), size = PT(9), fontface = "bold", family = "Arial", colour = c("#FFFFFF", WTK$navy_w)) +
      scale_fill_manual(values = c(WTK$azul_si, WTK$celeste)) + labs(caption = fuente_pie(n_txt)) + tema_w() + theme(legend.position = "right"))
  }
  d <- data.frame(x0 = c(0, pct[1]), x1 = c(pct[1], 100), k = labels)
  ggplot(d) + geom_rect(aes(xmin = x0, xmax = x1, ymin = 0, ymax = 1, fill = k)) + scale_fill_manual(values = setNames(c(WTK$navy, WTK$celeste), labels)) +
    annotate("text", x = 0, y = 2.0, label = paste0(pct[1], "%"), hjust = 0, size = PT(22), fontface = "bold", colour = WTK$navy, family = "Arial") +
    annotate("text", x = 100, y = 2.0, label = paste0(pct[2], "%"), hjust = 1, size = PT(22), fontface = "bold", colour = "#4F7FAF", family = "Arial") +
    annotate("text", x = 0, y = 1.3, label = if (is.null(n)) labels[1] else sprintf("%s (%d)", labels[1], n[1]), hjust = 0, size = PT(9), colour = WTK$navy_w, family = "Arial") +
    annotate("text", x = 100, y = 1.3, label = if (is.null(n)) labels[2] else sprintf("%s (%d)", labels[2], n[2]), hjust = 1, size = PT(9), colour = WTK$navy_w, family = "Arial") +
    scale_x_continuous(limits = c(0, 100), expand = c(0.01, 0)) + scale_y_continuous(limits = c(-0.1, 2.6)) + labs(caption = fuente_pie(n_txt)) + tema_w() + theme(legend.position = "none")
}

# Columnas en orden natural (escala de 1 a 10, años) con NS/NR al final en gris.
g_columnas <- function(k, p, n_txt = "", corte = NULL) {
  d <- data.frame(k = factor(k, levels = k), p = p)
  d$col <- ifelse(grepl("NS|No sabe", d$k), WTK$gris, if (ESTILO == "moderna" && !is.null(corte)) ifelse(seq_along(k) <= corte, WTK$tenue, WTK$navy) else WTK$azul_si)
  ggplot(d, aes(k, p)) + geom_col(aes(fill = col), width = 0.66) + scale_fill_identity() +
    geom_text(aes(label = paste0(p, "%")), vjust = -0.6, size = PT(8.5), fontface = "bold", colour = WTK$navy_w, family = "Arial") +
    scale_y_continuous(expand = expansion(mult = c(0, 0.16))) + labs(caption = fuente_pie(n_txt)) + tema_w() +
    theme(axis.text.x = element_text(size = 9, colour = WTK$navy_w, face = "bold", family = "Arial"))
}
# Comparación de dos grupos por indicador: barras agrupadas (fiel) o dumbbell con diferencia (moderna).
g_dos_grupos <- function(items, a, b, grupos, n_txt = "", lim = 100, cols = c(WTK$navy, WTK$celeste)) {
  n <- length(items); d <- data.frame(t = items, a = a, b = b, y = rev(seq_len(n)))
  if (ESTILO == "fiel") {
    dd <- rbind(data.frame(y = d$y + 0.17, v = a, g = grupos[1]), data.frame(y = d$y - 0.17, v = b, g = grupos[2]))
    return(ggplot(dd) + geom_rect(aes(xmin = 0, xmax = v, ymin = y - 0.15, ymax = y + 0.15, fill = g)) + scale_fill_manual(values = setNames(cols, grupos), breaks = grupos) +
      geom_text(aes(x = v + lim * 0.012, y = y, label = paste0(v, "%")), hjust = 0, size = PT(8.5), fontface = "bold", colour = WTK$navy_w, family = "Arial") +
      annotate("text", x = -lim * 0.02, y = d$y, label = stringr::str_wrap(d$t, 34), hjust = 1, size = PT(8.5), fontface = "bold", colour = WTK$navy_w, family = "Arial", lineheight = 0.9) +
      scale_x_continuous(limits = c(xmin_para(stringr::str_wrap(d$t, 34), 8.5, lim * 1.1), lim * 1.1), expand = c(0, 0)) + scale_y_continuous(limits = c(0.4, n + 0.6)) + labs(caption = fuente_pie(n_txt)) + tema_w())
  }
  lo <- floor(min(a, b) / 10) * 10 - 10
  anios <- all(grepl("^[0-9]{4}$", grupos))    # entre años la diferencia se colorea (sube o baja); entre grupos de personas, no
  
  xd <- lim + (lim - lo) * 0.2
  sep <- (lim - lo) * 0.03; d$cerca <- abs(d$a - d$b) < (lim - lo) * 0.12
  dd <- rbind(data.frame(y = d$y, v = b, g = grupos[2], cerca = d$cerca), data.frame(y = d$y, v = a, g = grupos[1], cerca = d$cerca)); dd$g <- factor(dd$g, levels = grupos)
  ggplot(d) + geom_segment(aes(x = pmin(a, b), xend = pmax(a, b), y = y, yend = y), colour = WTK$gris, linewidth = 0.8) +
    geom_point(data = dd, aes(x = v, y = y, colour = g, size = factor(cerca))) + scale_size_manual(values = c(`FALSE` = 3.2, `TRUE` = 2.5), guide = "none") + scale_colour_manual(values = setNames(cols, grupos), breaks = grupos, name = NULL) +
    # Puntos lejanos: cifra arriba (primer grupo) y abajo (segundo). Puntos cercanos: a los costados, en la misma línea, para que no se peguen.
    geom_text(data = d[!d$cerca, ], aes(x = a, y = y + 0.28, label = paste0(a, "%")), size = PT(8), fontface = "bold", colour = cols[1], family = "Arial") +
    geom_text(data = d[!d$cerca, ], aes(x = b, y = y - 0.28, label = paste0(b, "%")), size = PT(8), fontface = "bold", colour = "#4F7FAF", family = "Arial") +
    geom_text(data = d[d$cerca, ], aes(x = ifelse(a >= b, a + sep, a - sep), y = y, label = paste0(a, "%"), hjust = ifelse(a >= b, 0, 1)), size = PT(8), fontface = "bold", colour = cols[1], family = "Arial") +
    geom_text(data = d[d$cerca, ], aes(x = ifelse(a >= b, b - sep, b + sep), y = y, label = paste0(b, "%"), hjust = ifelse(a >= b, 1, 0)), size = PT(8), fontface = "bold", colour = "#4F7FAF", family = "Arial") +
    geom_text(aes(x = xd, y = y, label = sprintf("%+d pts", a - b)), size = PT(9), fontface = "bold", family = "Arial",
              colour = if (anios) ifelse(d$a - d$b < 0, "#CA5651", WTK$verde) else WTK$navy_w) +
    annotate("text", x = xd, y = n + 0.62, label = "Diferencia", size = PT(7.5), fontface = "bold", colour = WTK$gris, family = "Arial") +
    annotate("text", x = lo - (lim - lo) * 0.03, y = d$y, label = stringr::str_wrap(d$t, 34), hjust = 1, size = PT(8.5), fontface = "bold", colour = WTK$navy_w, family = "Arial", lineheight = 0.9) +
    scale_x_continuous(limits = c(xmin_para(stringr::str_wrap(d$t, 34), 8.5, lim + (lim - lo) * 0.3, lo - (lim - lo) * 0.03), lim + (lim - lo) * 0.3), expand = c(0, 0)) + scale_y_continuous(limits = c(0.4, n + 0.8)) +
    labs(caption = fuente_pie(n_txt)) + tema_w() + coord_cartesian(clip = "off")
}
# Serie por olas con rótulo directo al final de cada línea.
g_serie <- function(olas, series, n_txt = "") {
  d <- do.call(rbind, lapply(names(series), function(g) data.frame(x = seq_along(olas), v = series[[g]], g = g)))
  cg <- setNames(c(WTK$navy, WTK$tenue)[seq_along(series)], names(series)); lo <- min(d$v) - 8; hi <- max(d$v) + 8
  ggplot(d, aes(x, v, colour = g)) + geom_line(linewidth = 1.1) + geom_point(size = 2.4) +
    geom_text(aes(label = paste0(v, "%")), vjust = -1, size = PT(8.5), fontface = "bold", family = "Arial", show.legend = FALSE) +
    geom_text(data = d[d$x == length(olas), ], aes(x = length(olas) + 0.12, label = g), hjust = 0, size = PT(9), fontface = "bold", family = "Arial", show.legend = FALSE) +
    scale_colour_manual(values = cg) + scale_x_continuous(breaks = seq_along(olas), labels = olas, limits = c(0.8, length(olas) + 0.95)) +
    scale_y_continuous(limits = c(lo, hi)) + labs(caption = fuente_pie(n_txt)) + tema_w() +
    theme(legend.position = "none", axis.text.x = element_text(size = 9, colour = WTK$navy_w, face = "bold", family = "Arial"))
}
# Indicadores frente a su meta (monitoreo): barra, marca de meta en coral y cifra.
g_metas <- function(items, v, m, n_txt = "") {
  n <- length(items); d <- data.frame(t = items, v = v, m = m, y = rev(seq_len(n)), ok = v >= m)
  d$col <- if (ESTILO == "moderna") ifelse(d$ok, WTK$navy, WTK$tenue) else WTK$azul_si
  ggplot(d) + geom_rect(aes(xmin = 0, xmax = 100, ymin = y - 0.2, ymax = y + 0.2), fill = "#E9ECF1") + geom_rect(aes(xmin = 0, xmax = v, ymin = y - 0.2, ymax = y + 0.2, fill = col)) + scale_fill_identity() +
    geom_segment(aes(x = m, xend = m, y = y - 0.32, yend = y + 0.32), colour = "#CA5651", linewidth = 1) +
    geom_text(aes(x = 103, y = y + 0.08, label = paste0(v, "%")), hjust = 0, size = PT(9), fontface = "bold", colour = WTK$navy_w, family = "Arial") +
    geom_text(aes(x = 103, y = y - 0.22, label = paste0("meta ", m, "%")), hjust = 0, size = PT(7.5), colour = ifelse(d$ok, WTK$gris, "#CA5651"), family = "Arial") +
    annotate("text", x = -2, y = d$y, label = stringr::str_wrap(d$t, 32), hjust = 1, size = PT(8.5), fontface = "bold", colour = WTK$navy_w, family = "Arial", lineheight = 0.9) +
    scale_x_continuous(limits = c(xmin_para(stringr::str_wrap(d$t, 32), 8.5, 122, -2), 122), expand = c(0, 0)) + scale_y_continuous(limits = c(0.4, n + 0.6)) + labs(caption = fuente_pie(paste0("La línea coral marca la meta. ", n_txt))) + tema_w()
}
# Matriz de conteos (entidad × año) como mapa de calor con totales.
g_matriz <- function(filas, cols, m, n_txt = "") {
  d <- expand.grid(i = seq_along(filas), j = seq_along(cols)); d$v <- as.vector(m); d$y <- rev(seq_along(filas))[d$i]
  ggplot(d) + geom_tile(aes(x = j, y = y, fill = ifelse(v == 0, NA, v)), colour = "#FFFFFF", linewidth = 1.2) +
    scale_fill_gradient(low = "#D6DEEE", high = WTK$navy, na.value = "#F4F5F8", guide = "none") +
    geom_text(data = d[d$v > 0, ], aes(x = j, y = y, label = v, colour = v >= 3), size = PT(9), fontface = "bold", family = "Arial") + scale_colour_manual(values = c(`TRUE` = "#FFFFFF", `FALSE` = WTK$navy_w), guide = "none") +
    annotate("text", x = length(cols) + 0.85, y = rev(seq_along(filas)), label = rowSums(m), size = PT(9), fontface = "bold", colour = WTK$navy_w, family = "Arial") +
    annotate("text", x = seq_along(cols), y = length(filas) + 0.8, label = cols, size = PT(9), fontface = "bold", colour = WTK$navy_w, family = "Arial") +
    annotate("text", x = length(cols) + 0.85, y = length(filas) + 0.8, label = "Total", size = PT(9), fontface = "bold", colour = WTK$gris, family = "Arial") +
    annotate("text", x = 0.4, y = rev(seq_along(filas)), label = filas, hjust = 1, size = PT(8.5), colour = WTK$navy_w, family = "Arial") +
    scale_x_continuous(limits = c(-2.6, length(cols) + 1.3), expand = c(0, 0)) + scale_y_continuous(limits = c(0.4, length(filas) + 1.2)) + labs(caption = fuente_pie(n_txt)) + tema_w()
}

# Divergentes: desacuerdo a la izquierda del cero, acuerdo a la derecha, totales a cada lado.
g_divergente <- function(items, pct, n_txt = "", rot = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo")) {
  n <- length(items); itw <- stringr::str_wrap(items, 42); pd <- posiciones(itw); d <- do.call(rbind, lapply(seq_len(n), function(i) { p <- pct[[i]]; y <- pd$y[i]
    data.frame(y = y, k = factor(rot, levels = rot), x0 = c(-p[1] - p[2], -p[2], 0, p[3]), x1 = c(-p[2], 0, p[3], p[3] + p[4]), p = p[1:4]) }))
  tot <- data.frame(y = pd$y, neg = vapply(pct, function(p) p[1] + p[2], 0), pos = vapply(pct, function(p) p[3] + p[4], 0))
  ggplot(d) + geom_rect(aes(xmin = x0, xmax = x1, ymin = y - 0.3, ymax = y + 0.3, fill = k)) + scale_fill_manual(values = setNames(WTK$likert[1:4], rot)) +
    geom_text(data = d[d$p >= 8, ], aes(x = (x0 + x1) / 2, y = y, label = paste0(p, "%")), size = PT(8.5), fontface = "bold", colour = WTK$navy_w, family = "Arial") +
    geom_vline(xintercept = 0, colour = WTK$navy_w, linewidth = 0.4) +
    geom_text(data = tot, aes(x = -neg - 3, y = y, label = paste0(neg, "%")), hjust = 1, size = PT(9), fontface = "bold", colour = "#CA5651", family = "Arial") +
    geom_text(data = tot, aes(x = pos + 3, y = y, label = paste0(pos, "%")), hjust = 0, size = PT(9), fontface = "bold", colour = WTK$verde, family = "Arial") +
    annotate("text", x = -max(tot$neg) - 22, y = pd$y, label = itw, hjust = 1, size = PT(8.5), fontface = "bold", colour = WTK$navy_w, family = "Arial", lineheight = 0.9) +
    scale_x_continuous(limits = c(xmin_para(stringr::str_wrap(items, 42), 8.5, 110, -max(tot$neg) - 22), 110), expand = c(0, 0)) + scale_y_continuous(limits = c(0.4, pd$tot + 0.6)) + labs(caption = fuente_pie(n_txt)) + tema_w() -> gd
  attr(gd, "alto") <- 0.9 + 0.3 * pd$tot; gd
}
# Lollipop ordenado (ranking).
g_lollipop <- function(labels, pct, n_txt = "") {
  w <- stringr::str_wrap(labels, 45); o <- order(pct); d <- data.frame(l = factor(w[o], levels = w[o]), p = pct[o]); top <- d$l[nrow(d)]
  ggplot(d, aes(y = l)) + geom_segment(aes(x = 0, xend = p, yend = l), colour = WTK$tenue, linewidth = 0.9) +
    geom_point(aes(x = p), size = 3, colour = ifelse(d$l == top & ESTILO == "moderna", WTK$navy, if (ESTILO == "moderna") WTK$tenue else WTK$azul_si)) +
    geom_text(aes(x = p + max(p) * 0.04, label = paste0(p, "%")), hjust = 0, size = PT(8.5), fontface = "bold", colour = WTK$navy_w, family = "Arial") +
    scale_x_continuous(limits = c(0, max(d$p) * 1.15), expand = c(0, 0)) + labs(caption = fuente_pie(n_txt)) + tema_w() +
    theme(axis.text.y = element_text(size = 8.5 * FS, colour = WTK$navy_w, family = "Arial", hjust = 1, lineheight = 0.9, margin = margin(r = 8)))
}
# Promedio por grupo (indicador numérico): columnas desde cero con la cifra encima.
g_promedios <- function(grupos, v, n_txt = "", unidad = "") {
  d <- data.frame(g = factor(grupos, levels = grupos), v = v); mx <- which.max(v)
  ggplot(d, aes(g, v)) + geom_col(width = 0.6, fill = if (ESTILO == "moderna") ifelse(seq_along(v) == mx, WTK$navy, WTK$tenue) else WTK$azul_si) +
    geom_text(aes(label = paste0(format(v, nsmall = 1), unidad)), vjust = -0.6, size = PT(8.5), fontface = "bold", colour = WTK$navy_w, family = "Arial") +
    scale_y_continuous(limits = c(0, max(v) * 1.18), expand = c(0, 0)) + labs(caption = fuente_pie(n_txt)) + tema_w() +
    theme(axis.text.x = element_text(size = 8.5 * FS, colour = WTK$navy_w, face = "bold", family = "Arial"))
}
# Boxplot por grupo con la mediana rotulada.
g_boxplot <- function(lista, n_txt = "") {
  d <- do.call(rbind, lapply(names(lista), function(g) data.frame(g = g, v = lista[[g]]))); d$g <- factor(d$g, levels = names(lista))
  med <- tapply(d$v, d$g, median)
  ggplot(d, aes(g, v)) + geom_boxplot(width = 0.5, fill = if (ESTILO == "moderna") "#D6DEEE" else WTK$celeste, colour = WTK$navy_w, outlier.size = 1, linewidth = 0.4) +
    annotate("text", x = seq_along(med) + 0.33, y = med, label = paste0(med), hjust = 0, size = PT(8.5), fontface = "bold", colour = WTK$navy_w, family = "Arial") +
    labs(caption = fuente_pie(n_txt)) + tema_w() + theme(axis.text.x = element_text(size = 8.5 * FS, colour = WTK$navy_w, face = "bold", family = "Arial"),
      axis.text.y = element_text(size = 8 * FS, colour = WTK$gris, family = "Arial"), panel.grid.major.y = element_line(colour = "#E3E6EC", linewidth = 0.3))
}
# Torta de varias categorías (fiel) o dona con la cifra principal al centro (moderna).
g_torta <- function(labels, pct, n_txt = "", alto = 2.4) {
  d <- data.frame(k = factor(labels, levels = labels), v = pct); pal <- c(WTK$azul_si, WTK$celeste, "#2A9D8F", "#E9C46A", "#BFBFBF")[seq_along(labels)]
  mod <- ESTILO == "moderna"; tl <- if (mod) 9.5 else 8.5
  # Dona y leyenda se centran JUNTAS en el ancho de la página: el panel es cuadrado (coord_polar), así que el margen
  # lateral se calcula con el ancho real del círculo y de la leyenda (pedido de Gonzalo: «la leyenda no usa todo el espacio y no está centrada»).
  panel <- alto - 0.5; leg <- max(nchar(labels)) * tl * 0.55 / 72 + 0.4; m <- max(0.1, (ANCHO_W - panel - leg - 0.35) / 2)
  et <- ifelse(d$v >= 6 & !(mod & d$v == max(d$v)), paste0(d$v, "%"), "")   # en la moderna la cifra mayor ya está en el centro
  g <- ggplot(d, aes(x = if (mod) 2 else 1, y = v, fill = k)) + geom_col(width = 1, colour = "#FFFFFF") + coord_polar(theta = "y", direction = -1) +
    geom_text(aes(label = et), position = position_stack(vjust = 0.5), size = PT(8.5), fontface = "bold", family = "Arial", colour = "#FFFFFF") +
    scale_fill_manual(values = pal) + labs(caption = fuente_pie(n_txt)) + tema_w() +
    theme(legend.position = "right", legend.text = element_text(size = tl * FS, colour = WTK$navy_w, margin = margin(l = 4)), legend.key.size = unit(11, "pt"),
          legend.key.spacing.y = unit(5, "pt"), legend.box.spacing = unit(0.35, "in"), plot.margin = margin(6, m * 72, 4, m * 72, "pt"), plot.caption.position = "plot")
  if (mod) g <- g + xlim(0.6, 2.5) + annotate("text", x = 0.6, y = 0, label = paste0(max(pct), "%"), size = PT(18), fontface = "bold", colour = WTK$navy, family = "Arial")
  g
}
# Puntos por actor en cada competencia (moderna) o radar (fiel) a partir de una tabla de Top Two Box.
g_competencias <- function(comp, m, actores, n_txt = "", lo = 80) {
  cols <- c("#0B4F8C", "#2A9D8F", "#E9C46A")[seq_along(actores)]
  if (ESTILO == "fiel") {
    k <- length(comp); ang <- pi / 2 - 2 * pi * (0:(k - 1)) / k; rr <- function(v) (v - lo) / (100 - lo)
    ring <- do.call(rbind, lapply(seq(lo + 5, 100, 5), function(v) data.frame(r = v, x = rr(v) * cos(c(ang, ang[1])), y = rr(v) * sin(c(ang, ang[1])))))
    ser <- do.call(rbind, lapply(seq_along(actores), function(a) data.frame(a = actores[a], x = rr(m[, a]) * cos(ang), y = rr(m[, a]) * sin(ang))))
    ser$a <- factor(ser$a, levels = actores)
    lab <- data.frame(t = stringr::str_wrap(comp, 16), x = 1.22 * cos(ang), y = 1.14 * sin(ang), h = ifelse(abs(cos(ang)) < 0.1, 0.5, ifelse(cos(ang) > 0, 0, 1)))
    return(ggplot() + geom_path(data = ring, aes(x, y, group = r), colour = "#C9CED8", linewidth = 0.3) +
      geom_polygon(data = ser, aes(x, y, group = a, colour = a), fill = NA, linewidth = 0.8) + geom_point(data = ser, aes(x, y, colour = a), size = 1.6) +
      geom_text(data = lab, aes(x, y, label = t, hjust = h), size = PT(8), colour = WTK$navy_w, family = "Arial", fontface = "bold", lineheight = 0.9) +
      scale_colour_manual(values = setNames(cols, actores)) + coord_equal(xlim = c(-1.9, 1.9), ylim = c(-1.3, 1.3), clip = "off") + labs(caption = fuente_pie(n_txt)) + tema_w())
  }
  d <- do.call(rbind, lapply(seq_along(actores), function(a) data.frame(c = comp, a = actores[a], v = m[, a])))
  o <- order(rowMeans(m)); d$c <- factor(d$c, levels = comp[o]); d$a <- factor(d$a, levels = actores)
  rng <- do.call(rbind, lapply(comp, function(cc) data.frame(c = cc, mn = min(m[comp == cc, ]), mx = max(m[comp == cc, ])))); rng$c <- factor(rng$c, levels = comp[o])
  ggplot() + geom_segment(data = rng, aes(x = mn, xend = mx, y = c, yend = c), colour = WTK$gris, linewidth = 0.6) +
    geom_point(data = d, aes(v, c, colour = a), size = 2.6) + scale_colour_manual(values = setNames(cols, actores)) +
    scale_x_continuous(limits = c(lo, 100.5), labels = function(x) paste0(x, "%")) + labs(caption = fuente_pie(n_txt)) + tema_w() +
    theme(axis.text.y = element_text(size = 8.5 * FS, colour = WTK$navy_w, face = "bold", family = "Arial", hjust = 1), axis.text.x = element_text(size = 7.5, colour = WTK$gris, family = "Arial"),
          panel.grid.major.x = element_line(colour = "#E3E6EC", linewidth = 0.3))
}

# Mapa de calor: filas (dimensiones o criterios) por columnas (grupos), tono fijo de 80% a 100%.
g_heat <- function(M, n_txt = "", lo = 80, hi = 100) {
  d <- expand.grid(f = rownames(M), g = colnames(M), stringsAsFactors = FALSE); d$v <- as.vector(M)
  rampa <- grDevices::colorRampPalette(c("#EEF2F8", "#2F4B7C"))(41)
  d$col <- rampa[pmin(41, pmax(1, round((d$v - lo) / (hi - lo) * 40) + 1))]
  d$txt <- ifelse(vapply(d$col, function(h) { v <- grDevices::col2rgb(h)[, 1] / 255; sum(c(.2126, .7152, .0722) * v) }, 0) < 0.45, "#FFFFFF", WTK$navy_w)
  d$x <- match(d$g, colnames(M)); d$y <- nrow(M) + 1 - match(d$f, rownames(M))
  ggplot(d) + geom_tile(aes(x = x, y = y, fill = col), colour = "#FFFFFF", linewidth = 1.2) + scale_fill_identity() +
    geom_text(aes(x = x, y = y, label = paste0(round(v), "%"), colour = txt), size = PT(9), fontface = "bold", family = "Arial") + scale_colour_identity() +
    annotate("text", x = seq_len(ncol(M)), y = nrow(M) + 0.75, label = stringr::str_wrap(colnames(M), 8), size = PT(7.5), fontface = "bold", colour = WTK$navy_w, family = "Arial", vjust = 0, lineheight = 0.9) +
    annotate("text", x = 0.42, y = rev(seq_len(nrow(M))), label = stringr::str_wrap(rownames(M), 22), hjust = 1, size = PT(9), fontface = "bold", colour = WTK$navy_w, family = "Arial", lineheight = 0.9) +
    scale_x_continuous(limits = c(-1.9, ncol(M) + 0.5), expand = c(0, 0)) + scale_y_continuous(limits = c(0.5, nrow(M) + 1.35), expand = c(0, 0)) +
    labs(caption = fuente_pie(paste0(n_txt, ". El tono va de ", lo, "% (claro) a ", hi, "% (oscuro)"))) + tema_w() + coord_cartesian(clip = "off")
}

# Media y rango: una línea del mínimo al máximo y un punto en la media, por grupo.
g_rango <- function(grupos, n_txt = "", unidad = " años") {
  d <- data.frame(g = names(grupos), mn = sapply(grupos, min), mx = sapply(grupos, max), me = sapply(grupos, mean), y = rev(seq_along(grupos)))
  lo <- floor(min(d$mn) / 10) * 10; hi <- ceiling(max(d$mx) / 10) * 10
  ggplot(d, aes(y = y)) + geom_segment(aes(x = mn, xend = mx, yend = y), colour = if (ESTILO == "fiel") WTK$celeste else WTK$tenue, linewidth = 2.2, lineend = "round") +
    geom_point(aes(x = me), size = 3.4, colour = WTK$navy) +
    geom_text(aes(x = me, label = sprintf("%.1f", me)), nudge_y = 0.32, size = PT(8.5), fontface = "bold", colour = WTK$navy_w, family = "Arial") +
    geom_text(aes(x = mn - (hi - lo) * 0.015, label = round(mn)), hjust = 1, size = PT(8), colour = WTK$gris_txt %||% "#7F7F7F", family = "Arial") +
    geom_text(aes(x = mx + (hi - lo) * 0.015, label = round(mx)), hjust = 0, size = PT(8), colour = WTK$gris_txt %||% "#7F7F7F", family = "Arial") +
    annotate("text", x = lo - (hi - lo) * 0.08, y = d$y, label = d$g, hjust = 1, size = PT(9), fontface = "bold", colour = WTK$navy_w, family = "Arial") +
    scale_x_continuous(limits = c(lo - (hi - lo) * 0.38, hi + (hi - lo) * 0.05), expand = c(0, 0)) + scale_y_continuous(limits = c(0.5, nrow(d) + 0.7)) +
    labs(caption = fuente_pie(paste0(n_txt, ". El punto es la media. La línea va de la edad mínima a la máxima"))) + tema_w() + coord_cartesian(clip = "off")
}
