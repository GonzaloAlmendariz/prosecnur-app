# Capítulo 2, gráficos que sólo aparecían dentro de láminas múltiples, ahora solos sobre la lámina estándar (2026-10-08). Claves «graf2:n».
SEC <- "graf2"

MOTOR_ACT <- "p_slide_1_grafico: p_histograma"
doc <- nueva(doc); titulo(doc, "Edad de los estudiantes", ante = "Histograma")
dh <- data.frame(e = edad[edad >= 16 & edad <= 32]); md <- median(edad)
gh <- ggplot(dh, aes(e)) + geom_histogram(binwidth = 1, fill = TK$navy, colour = "#FFFFFF", boundary = 0.5) +
  geom_vline(xintercept = md, colour = TK$soft, linetype = "dashed", linewidth = 0.6) +
  annotate("text", x = md + 0.3, y = Inf, label = sprintf("Mediana: %d años", as.integer(md)), hjust = 0, vjust = 1.6, size = 12 / .pt, colour = TK$navy, fontface = "bold", family = "Arial") +
  stat_bin(aes(label = after_stat(ifelse(count > 0, count, ""))), binwidth = 1, boundary = 0.5, geom = "text", vjust = -0.4, size = 11 / .pt, colour = TK$navy, family = "Arial") +
  scale_x_continuous(breaks = 16:32) + scale_y_continuous(expand = expansion(mult = c(0, 0.15))) + labs(x = "Edad, en años", y = NULL) + theme_minimal(base_family = "Arial") +
  theme(plot.background = element_blank(), panel.background = element_blank(), panel.grid = element_blank(), axis.text.y = element_blank(),
        axis.text.x = element_text(size = 12, colour = TK$navy), axis.title.x = element_text(size = 11, colour = TK$soft))
invisible(ph_with(doc, dml(ggobj = gh, bg = "transparent", fonts = list(sans = "Arial")), location = ph_location(left = XC, top = YT, width = AC, height = YF - YT - 0.1)))
zona("histograma", XC, YT, AC, YF - YT - 0.1)
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
