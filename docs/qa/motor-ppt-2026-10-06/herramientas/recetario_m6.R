# Recetario v2, Parte V: la misma identidad en otros estudios de PULSO (pedido de Gonzalo:
# «mostrar su utilidad para otros tipos de estudios que realizamos»). Una lámina por familia de
# estudio, con la FORMA real de cada una (escalas, grupos, metas, olas) y porcentajes ficticios.
# Familias: opinión pública (Polarización: escala de 1 a 10, cruces por edad), cuasi-experimental
# (ACNUR comunidad de acogida: intervención frente a comparación), monitoreo posdistribución
# (ACNUR PDM: indicadores frente a su meta), encuestas en aulas (HST: prevalencia por facultad con
# bases chicas) y estudios por olas (seguimiento en el tiempo, normal fuera de acreditación).
# Sólo lo cuantitativo. Lo que el motor no tiene va rotulado PROPUESTA en MOTOR_ACT.

MOTOR_ACT <- "p_slide_seccion"; doc <- portadilla(doc, "V", "Otros estudios de PULSO", "Opinión pública, estudios cuasi-experimentales, monitoreo, encuestas en aulas y estudios por olas", icono = "globe")
xr <- ML + col2 + GAP

# --- V1 opinión pública: escala de 1 a 10 en su orden natural, NS/NR al final (Polarización)
MOTOR_ACT <- "p_slide_1_grafico: p_barras_agrupadas en columnas con orden del instrumento (1 a 10) y NS/NR al final"
doc <- nueva(doc); titulo(doc, "Confianza en el Congreso, de 1 a 10", ante = "Opinión pública")
v10 <- data.frame(k = c(as.character(1:10), "NS/NR"), p = c(18, 9, 12, 11, 15, 10, 8, 6, 3, 2, 6))
v10$k <- factor(v10$k, levels = v10$k)
v10$col <- if (ESTILO == "moderna") ifelse(v10$k == "NS/NR", "#BFBFBF", ifelse(as.integer(v10$k) <= 5, TK$tenue, TK$navy)) else ifelse(v10$k == "NS/NR", "#BFBFBF", TK$navy)
med <- sum((1:10) * v10$p[1:10]) / sum(v10$p[1:10])
g10 <- ggplot(v10, aes(k, p)) + geom_col(aes(fill = col), width = 0.68) + scale_fill_identity() +
  geom_text(aes(label = paste0(p, "%")), vjust = -0.5, size = 13 / .pt, colour = TK$navy, fontface = "bold", family = "Arial") +
  scale_y_continuous(expand = expansion(mult = c(0, 0.15))) + labs(x = NULL, y = NULL) + theme_minimal(base_family = "Arial") +
  theme(panel.grid = element_blank(), axis.text.y = element_blank(), axis.text.x = element_text(size = 13, colour = TK$navy, face = "bold"),
        plot.background = element_blank(), panel.background = element_blank())
invisible(ph_with(doc, dml(ggobj = g10, bg = "transparent", fonts = list(sans = "Arial")), location = ph_location(left = ML + 0.2, top = YT + 0.55, width = 9.0, height = 4.3)))
panel_titulo(doc, ML + 0.2, YT, 9, "En una escala de 1 a 10, ¿cuánto confía en el Congreso?", "1,200 entrevistados")
txt(doc, "Promedio", 9.9, YT + 1.0, 3, 0.3, 13, TK$navy, bold = TRUE)
txt(doc, sprintf("%.1f", med), 9.9, YT + 1.35, 3, 0.9, 48, TK$navy, bold = TRUE)
txt(doc, "sobre 10, sin contar NS/NR", 9.9, YT + 2.3, 3, 0.3, 12, TK$soft)
txt(doc, "Confía poco (1 a 5)", 9.9, YT + 2.95, 3, 0.3, 13, TK$navy, bold = TRUE); txt(doc, paste0(sum(v10$p[1:5]), "%"), 9.9, YT + 3.25, 3, 0.5, 26, if (ESTILO == "moderna") TK$tenue else TK$navy, bold = TRUE)
zona("columnas 1 a 10 y NS/NR", ML + 0.2, YT + 0.55, 9.0, 4.3)
pie(doc, "Base: 1,200 entrevistados")

# --- V2 opinión pública: la misma pregunta por grupo de edad (banner de edad2: 18 a 29, 30 a 59, 60 a más)
MOTOR_ACT <- "p_slide_1_grafico: p_barras_multiapiladas (modo cruce por edad2) con Top Two Box"
ed <- list(list(texto = "La democracia es preferible a cualquier otra forma de gobierno",
  filas = list(fila_s("18 a 29 años", c(9, 21, 44, 22, 4), 312), fila_s("30 a 59 años", c(6, 17, 46, 27, 4), 641), fila_s("60 años a más", c(4, 12, 43, 37, 4), 247), fila_s("Total", c(6, 17, 45, 28, 4), 1200))))
doc <- laminas_likert(doc, "Apoyo a la democracia por grupo de edad", "Opinión pública: cruce por edad", ed, "Base: 1,200 entrevistados (312 de 18 a 29 años, 641 de 30 a 59 y 247 de 60 a más)",
  rotulos = c("Muy en desacuerdo", "En desacuerdo", "De acuerdo", "Muy de acuerdo", "NS/NR"))

# --- V3 cuasi-experimental: intervención frente a comparación (ACNUR comunidad de acogida)
MOTOR_ACT <- if (ESTILO == "fiel") "p_slide_1_grafico: p_barras_agrupadas (indicador por brazo)" else "p_slide_1_grafico: p_dumbbell (brazo de intervención frente a comparación)"
doc <- nueva(doc); titulo(doc, "Percepción de la comunidad de acogida, por grupo", ante = "Estudio cuasi-experimental")
ind <- data.frame(t = c("Considera que la población refugiada aporta a su barrio", "Tiene un vecino o vecina de otra nacionalidad con quien conversa", "Participó en una actividad comunitaria en el último año", "Se siente seguro o segura caminando de noche en su barrio"),
                  int = c(58, 64, 31, 47), com = c(46, 59, 22, 45))
wl <- 4.6; xb <- ML + wl + 0.3; wb <- 6.0; y0 <- YT + 0.65
if (ESTILO == "moderna") {
  for (t in seq(0, 80, 20)) { xx <- xb + wb * t / 80; caja(doc, xx, y0 - 0.05, 0.006, nrow(ind) * 0.95, TK$rule); txt(doc, paste0(t, "%"), xx - 0.3, y0 - 0.35, 0.6, 0.24, 10, TK$faint, align = "center") }
  txt(doc, "Diferencia", xb + wb + 0.3, y0 - 0.38, 1.6, 0.26, 10, TK$soft, bold = TRUE, align = "center")
  for (k in seq_len(nrow(ind))) { yc <- y0 + (k - 1) * 0.95 + 0.3; a <- ind$com[k]; b <- ind$int[k]
    txt(doc, ind$t[k], ML, yc - alto_txt(ind$t[k], wl, 12.5, TRUE) / 2, wl, alto_txt(ind$t[k], wl, 12.5, TRUE), 12.5, TK$navy, bold = TRUE, align = "right")
    caja(doc, xb + wb * min(a, b) / 80, yc - 0.01, wb * abs(b - a) / 80, 0.02, TK$faint)
    caja(doc, xb + wb * a / 80 - 0.1, yc - 0.1, 0.2, 0.2, "#9DC3E6", geom = "ellipse"); caja(doc, xb + wb * b / 80 - 0.1, yc - 0.1, 0.2, 0.2, TK$navy, geom = "ellipse")
    d <- b - a; txt(doc, sprintf("%+d pts", d), xb + wb + 0.3, yc - 0.17, 1.6, 0.34, 13, if (d < 0) TK$coral else TK$verde_txt, bold = TRUE, align = "center") }
  leyenda(doc, 0, Y_LEY - 0.05, c("Distritos de intervención (99)", "Distritos de comparación (90)"), c(TK$navy, "#9DC3E6"), centrar_en = xb + wb / 2)
  zona("dumbbell por indicador", xb, y0, wb, nrow(ind) * 0.95)
} else {
  for (k in seq_len(nrow(ind))) { yc <- y0 + (k - 1) * 0.95
    txt(doc, ind$t[k], ML, yc + 0.05, wl, 0.6, 12, TK$navy, bold = TRUE, align = "right")
    for (j in 1:2) { v <- c(ind$int[k], ind$com[k])[j]; yy <- yc + (j - 1) * 0.32; caja(doc, xb, yy, wb * v / 80, 0.28, c(TK$navy, "#9DC3E6")[j])
      txt(doc, paste0(v, "%"), xb + wb * v / 80 + 0.08, yy - 0.02, 0.8, 0.3, 12, TK$navy, bold = TRUE) } }
  leyenda(doc, 0, Y_LEY - 0.05, c("Intervención", "Comparación"), c(TK$navy, "#9DC3E6"), centrar_en = xb + wb / 2)
  zona("barras agrupadas por brazo", xb, y0, wb, nrow(ind) * 0.95) }
pie(doc, "Base: 189 entrevistados (99 en distritos de intervención y 90 en distritos de comparación)")

# --- V4 monitoreo posdistribución: indicadores frente a su meta (ACNUR PDM)
MOTOR_ACT <- "PROPUESTA: barras de indicador con marca de meta (el motor no dibuja metas. Hoy van en el texto)"
doc <- nueva(doc); titulo(doc, "Indicadores de la asistencia en efectivo frente a su meta", ante = "Monitoreo posdistribución")
pdm <- data.frame(t = c("Recibió la asistencia en la fecha prevista", "Retiró el dinero sin problemas de acceso", "Usó el efectivo en necesidades básicas", "Conoce cómo presentar una queja", "Se sintió tratado o tratada con respeto"),
                  v = c(86, 78, 92, 41, 95), m = c(80, 85, 90, 60, 90))
wl <- 4.4; xb <- ML + wl + 0.3; wb <- 5.9; y0 <- YT + 0.55
for (t in c(0, 50, 100)) txt(doc, paste0(t, "%"), xb + wb * t / 100 - 0.3, y0 - 0.32, 0.6, 0.24, 10, TK$faint, align = "center")
for (k in seq_len(nrow(pdm))) { yc <- y0 + (k - 1) * 0.86; cumple <- pdm$v[k] >= pdm$m[k]
  txt(doc, pdm$t[k], ML, yc + 0.02, wl, 0.4, 12.5, TK$navy, bold = TRUE, align = "right")
  caja(doc, xb, yc + 0.08, wb, 0.3, TK$zebra)
  caja(doc, xb, yc + 0.08, wb * pdm$v[k] / 100, 0.3, if (ESTILO == "moderna" && !cumple) TK$tenue else TK$navy)
  caja(doc, xb + wb * pdm$m[k] / 100 - 0.015, yc - 0.02, 0.03, 0.5, TK$coral)
  txt(doc, paste0(pdm$v[k], "%"), xb + wb + 0.12, yc + 0.02, 0.8, 0.4, 14, TK$navy, bold = TRUE)
  txt(doc, sprintf("meta %d%%", pdm$m[k]), xb + wb + 0.85, yc + 0.06, 1.05, 0.34, 11, if (cumple) TK$soft else TK$coral, bold = !cumple) }
leyenda(doc, 0, Y_LEY - 0.05, c("Logrado", "Meta del indicador"), c(TK$navy, TK$coral), centrar_en = xb + wb / 2)
zona("barras con marca de meta", xb, y0, wb, nrow(pdm) * 0.86)
pie(doc, "Base: 2,296 hogares entrevistados por teléfono")

# --- V5 encuesta en aulas: prevalencia por facultad con su base (HST)
MOTOR_ACT <- "p_slide_1_grafico: p_barras_agrupadas (orden mayor a menor) con n por categoría. Bases menores de 30 se aclaran (PROPUESTA de regla)"
doc <- nueva(doc); titulo(doc, "Estudiantes que vivieron al menos una situación de hostigamiento", ante = "Encuesta en aulas")
fac <- data.frame(f = c("Ciencias Sociales", "Arquitectura", "Derecho", "Ingeniería", "Educación", "Ciencias Contables", "Artes"), p = c(31, 27, 24, 19, 18, 15, 22), n = c(412, 188, 305, 690, 96, 140, 24))
fac <- fac[order(-fac$p), ]
wl <- 2.8; xb <- ML + wl + 0.3; wb <- 7.0; y0 <- YT + 0.5
txt(doc, "Prevalencia en el último año", xb, y0 - 0.4, 4, 0.26, 10, TK$soft, bold = TRUE); txt(doc, "Casos", xb + wb + 1.1, y0 - 0.4, 1, 0.26, 10, TK$soft, bold = TRUE, align = "center")
for (k in seq_len(nrow(fac))) { yc <- y0 + (k - 1) * 0.62; chica <- fac$n[k] < 30
  txt(doc, fac$f[k], ML, yc, wl, 0.36, 13, TK$navy, bold = !chica, align = "right")
  colb <- if (chica) TK$faint else if (ESTILO == "moderna" && k > 1) TK$tenue else TK$navy
  caja(doc, xb, yc + 0.04, wb * fac$p[k] / 40, 0.32, colb)
  txt(doc, paste0(fac$p[k], "%"), xb + wb * fac$p[k] / 40 + 0.1, yc + 0.01, 0.8, 0.36, 13, TK$navy, bold = TRUE)
  txt(doc, format(fac$n[k], big.mark = ","), xb + wb + 1.1, yc + 0.02, 1, 0.34, 12, if (chica) TK$coral else TK$soft, bold = chica, align = "center") }
zona("barras con casos por facultad", xb, y0, wb, nrow(fac) * 0.62)
pie(doc, "Base: 1,855 estudiantes encuestados en aula")

# --- V6 estudios por olas: seguimiento en el tiempo (normal en opinión y monitoreo; excepcional en acreditación)
# En líneas el eje no necesita partir de cero (en barras sí): se acota a 25-68 para que la serie use el alto.
MOTOR_ACT <- "p_slide_1_grafico: p_serie_temporal (cuatro olas, rótulo directo al final de cada línea)"
doc <- nueva(doc); titulo(doc, "Aprobación de la gestión en cuatro mediciones", ante = "Estudio por olas")
olas <- data.frame(o = rep(c("Marzo", "Junio", "Setiembre", "Diciembre"), 2), x = rep(1:4, 2), g = rep(c("Aprueba", "Desaprueba"), each = 4), v = c(41, 37, 33, 35, 52, 56, 60, 58))
cg <- c(Aprueba = TK$navy, Desaprueba = if (ESTILO == "moderna") "#8E9DBD" else "#9DC3E6")
go <- ggplot(olas, aes(x, v, colour = g)) + geom_line(linewidth = 1.4) + geom_point(size = 3) +
  geom_text(aes(label = paste0(v, "%")), vjust = -1.0, size = 12 / .pt, fontface = "bold", family = "Arial", show.legend = FALSE) +
  geom_text(data = olas[olas$x == 4, ], aes(x = 4.12, label = g), hjust = 0, size = 13 / .pt, fontface = "bold", family = "Arial", show.legend = FALSE) +
  scale_colour_manual(values = cg) + scale_x_continuous(breaks = 1:4, labels = c("Marzo", "Junio", "Setiembre", "Diciembre"), limits = c(0.85, 4.9)) +
  scale_y_continuous(limits = c(25, 68)) + labs(x = NULL, y = NULL) + theme_minimal(base_family = "Arial") +
  theme(legend.position = "none", panel.grid = element_blank(), axis.text.y = element_blank(), axis.text.x = element_text(size = 13, colour = TK$navy, face = "bold"),
        plot.background = element_blank(), panel.background = element_blank())
invisible(ph_with(doc, dml(ggobj = go, bg = "transparent", fonts = list(sans = "Arial")), location = ph_location(left = ML + 0.4, top = YT + 0.1, width = 11.6, height = 4.7)))
zona("serie de cuatro olas", ML + 0.4, YT + 0.1, 11.6, 4.7)
pie(doc, "Base: 1,200 entrevistados en cada ola")
