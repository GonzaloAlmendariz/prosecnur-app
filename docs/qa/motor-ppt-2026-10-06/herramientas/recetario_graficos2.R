# Capítulo 2, gráficos que sólo aparecían dentro de láminas múltiples, ahora solos sobre la lámina estándar (2026-10-08). Claves «graf2:n».
SEC <- "graf2"

MOTOR_ACT <- "p_slide_1_grafico: p_histograma"
doc <- nueva(doc); titulo(doc, "Edad de los estudiantes", ante = "Histograma")
dh <- data.frame(e = edad[edad >= 16 & edad <= 32]); md <- median(edad)
# Histograma con formas nativas, como el del perfil: cada edad bajo su barra, la mediana como triángulo coral bajo su edad y su cifra
# arriba a la derecha; sin línea punteada ni título del eje (Gonzalo, 2026-10-08)
cnt <- table(factor(dh$e, levels = min(dh$e):max(dh$e))); hb <- YF - YT - 1.25; nb_ <- length(cnt); wcol <- AC / nb_; yh <- YT + 0.55
for (k in seq_len(nb_)) { hk <- hb * cnt[[k]] / max(cnt); xk <- XC + (k - 1) * wcol
  if (hk > 0) { caja(doc, xk + 0.02, yh + hb - hk, wcol - 0.04, hk, TK$navy)
    txt(doc, cnt[[k]], xk, yh + hb - hk - 0.3, wcol, 0.28, 12, TK$navy, bold = TRUE, align = "center") }
  txt(doc, names(cnt)[k], xk, yh + hb + 0.06, wcol, 0.28, 12, TK$navy, align = "center") }
xm <- XC + (md - min(dh$e) + 0.5) * wcol
caja(doc, xm - 0.08, yh + hb + 0.4, 0.16, 0.13, TK$coral, geom = "triangle")
txt(doc, sprintf("Mediana: %d años", as.integer(md)), W - MR - 3.2, YT, 3.2, 0.3, 12, TK$coral, bold = TRUE, align = "right")
zona("histograma", XC, yh, AC, hb)
pie(doc, sprintf("Base: %d estudiantes que declararon su edad", length(edad)))

MOTOR_ACT <- "p_slide_1_grafico: p_barras_multiapiladas (dicotómica)"
doc <- nueva(doc); titulo(doc, "Situación laboral del egresado", ante = "Dicotómica")
panel_titulo(doc, XC, YT + 0.3, AC, "¿Está trabajando actualmente?", paste(eg_trab$valid, "egresados"))
dicotomia(doc, XC, YT + 1.1, AC, eg_trab$labels[1:2], eg_trab$pct[1:2], eg_trab$n[1:2], size = 40, g = 0.7)
zona("dicotómica a todo el ancho", XC, YT + 1.1, AC, 2.0)
pie(doc, paste("Base:", eg_trab$valid, "egresados"))

MOTOR_ACT <- "p_slide_1_grafico: p_nube_palabras"
doc <- nueva(doc); titulo(doc, "Palabras más mencionadas por los egresados", ante = "Nube de palabras")
f <- head(nb$freq, 40); dfw <- data.frame(w = names(f), n = as.integer(f))
dfw$col <- grDevices::colorRampPalette(c("#8EA3C6", TK$navy))(5)[cut(dfw$n, breaks = unique(quantile(dfw$n, seq(0, 1, .25))), include.lowest = TRUE, labels = FALSE)]
set.seed(7)
gw <- ggplot(dfw, aes(label = w, size = n, colour = col)) + geom_text_wordcloud(family = "Arial", fontface = "bold", rm_outside = TRUE, eccentricity = 0.55, grid_margin = 0.7) +
  scale_size(range = c(11, 46) / .pt) + scale_colour_identity() + theme_void()
invisible(ph_with(doc, dml(ggobj = gw, bg = "transparent", fonts = list(sans = "Arial")), location = ph_location(left = XC, top = YT, width = AC, height = YF - YT - 0.1)))
zona("nube a todo el ancho", XC, YT, AC, YF - YT - 0.1)
pie(doc, sprintf("Base: %d egresados que respondieron la pregunta abierta. El tamaño crece con las menciones", nb$n_resp))
