# Recetario: gráficos de comparación (loop M3c). Se carga tras recetario_m3b.R.
rd <- D$radar
comp6 <- c("Estados financieros", "Auditoría", "Costos y presupuestos", "Finanzas", "Tributación", "Visión empresarial")
dd6 <- data.frame(Competencia = comp6, Docentes = sapply(rd$docentes, `[[`, "ttb"), Estudiantes = sapply(rd$estudiantes, `[[`, "ttb"), Egresados = sapply(rd$egresados, `[[`, "ttb"))
ns6 <- c(Docentes = rd$docentes[[1]]$valid, Estudiantes = rd$estudiantes[[1]]$valid, Egresados = rd$egresados[[1]]$valid)
eje_pct <- function(doc, xl, wl, y, h, lo, hi, paso, titulo_eje) {
  px <- function(v) xl + wl * (v - lo) / (hi - lo)
  for (v in seq(lo, hi, by = paso)) { caja(doc, px(v), y, 0.006, h, TK$rule); txt(doc, paste0(v, "%"), px(v) - 0.35, y - 0.3, 0.7, 0.24, 10, TK$faint, align = "center") }
  txt(doc, titulo_eje, xl, y - 0.58, 6, 0.26, 10, TK$soft, bold = TRUE)
  px
}

# --- p_puntos_comparativos: dos indicadores comparados entre grupos
MOTOR_ACT <- "p_slide_1_grafico: p_puntos_comparativos"
doc <- nueva(doc); titulo(doc, "Conocer la misión frente a saber dónde consultarla", ante = "Puntos comparativos")
act4 <- c("Docentes", "Estudiantes", "Egresados", "Administrativos")
xl <- ML + 2.4; wl <- W - MR - xl - 1.0; yb <- YT + 0.75; fila <- (YF - yb - 0.6) / 4   # aire para la cifra a la derecha del punto
px <- eje_pct(doc, xl, wl, yb, 4 * fila, 50, 100, 10, "% que responde Sí")
for (i in 1:4) { yc <- yb + (i - 0.5) * fila; a1 <- D$mision1[[i]]$pct[1]; a2 <- D$mision2[[i]]$pct[1]
  txt(doc, act4[i], ML, yc - 0.27, 2.2, 0.3, 13, TK$navy, bold = TRUE, align = "right")
  txt(doc, sprintf("%d respuestas", D$mision1[[i]]$valid), ML, yc + 0.02, 2.2, 0.26, 10, TK$faint, align = "right")
  caja(doc, px(min(a1, a2)), yc - 0.012, px(max(a1, a2)) - px(min(a1, a2)), 0.024, TK$faint)
  caja(doc, px(a2) - 0.12, yc - 0.12, 0.24, 0.24, "#4F7FAF", geom = "ellipse"); caja(doc, px(a1) - 0.12, yc - 0.12, 0.24, 0.24, TK$navy, geom = "ellipse")
  cifras_par(doc, px, a1, a2, yc, TK$navy, "#4F7FAF") }
zona("puntos, eje 50 a 100 rotulado", xl, yb, wl, 4 * fila)
leyenda(doc, 0, YF - 0.3, c("Conoce la misión y los propósitos", "Sabe dónde consultarlos"), c(TK$navy, "#4F7FAF"), centrar_en = xl + wl / 2)
pie(doc, "Base: 52 docentes, 172 estudiantes, 178 egresados y 15 administrativos")

# --- p_dumbbell: brecha entre dos públicos
MOTOR_ACT <- "p_slide_1_grafico: p_dumbbell (dos bases)"
doc <- nueva(doc); titulo(doc, "Competencias: docentes frente a estudiantes", ante = "Brecha entre dos públicos")
o <- order(-(dd6$Docentes - dd6$Estudiantes)); d2 <- dd6[o, ]
xl <- ML + 3.0; wl <- W - MR - xl - 2.4; yb <- YT + 0.75; fila <- (YF - yb - 0.6) / nrow(d2)   # aire para la cifra y la columna «Diferencia»
px <- eje_pct(doc, xl, wl, yb, nrow(d2) * fila, 80, 100, 5, "Top Two Box (De acuerdo + Totalmente de acuerdo)")
txt(doc, "Diferencia", W - MR - 1.3, yb - 0.3, 1.3, 0.26, 10, TK$soft, bold = TRUE, align = "center")
for (i in seq_len(nrow(d2))) { yc <- yb + (i - 0.5) * fila; a <- d2$Docentes[i]; b <- d2$Estudiantes[i]
  txt(doc, d2$Competencia[i], ML, yc - 0.15, 2.8, 0.3, 13, TK$navy, bold = TRUE, align = "right")
  caja(doc, px(min(a, b)), yc - 0.02, max(0.01, px(max(a, b)) - px(min(a, b))), 0.04, TK$faint)
  caja(doc, px(b) - 0.13, yc - 0.13, 0.26, 0.26, TK$actores[["Estudiantes"]], geom = "ellipse"); caja(doc, px(a) - 0.13, yc - 0.13, 0.26, 0.26, TK$actores[["Docentes"]], geom = "ellipse")
  cifras_par(doc, px, a, b, yc, TK$actores[["Docentes"]], TK$actores[["Estudiantes"]])
  txt(doc, sprintf("%+d pts", a - b), W - MR - 1.3, yc - 0.15, 1.3, 0.3, 13, TK$navy, bold = TRUE, align = "center") }   # entre públicos la diferencia no es mejor ni peor: azul neutro
zona("pesas, eje 80 a 100 rotulado", xl, yb, wl, nrow(d2) * fila)
leyenda(doc, 0, YF - 0.3, c(sprintf("Docentes (%d)", ns6[1]), sprintf("Estudiantes (%d)", ns6[2])), TK$actores[1:2], centrar_en = xl + wl / 2)
pie(doc, sprintf("Base: %d docentes y %d estudiantes", ns6[1], ns6[2]))

# --- p_serie_temporal: uso excepcional, dos mediciones
MOTOR_ACT <- "p_slide_1_grafico: p_serie_temporal (uso excepcional)"
doc <- nueva(doc); titulo(doc, "Tutoría académica, 2021 y 2026", ante = if (NUEVA) "Serie temporal de dos mediciones" else "Serie temporal (uso excepcional)")
ser <- list(Docentes = c(98, 83), Estudiantes = c(84, 53))
x1 <- ML + 3.2; x2 <- W - MR - 3.6; yt_ <- YT + 0.6; hy <- YF - yt_ - 0.5; lo <- 40; hi <- 100
py <- function(v) yt_ + hy * (hi - v) / (hi - lo)
for (v in seq(lo, hi, 20)) { caja(doc, x1, py(v), x2 - x1, 0.006, TK$rule); txt(doc, paste0(v, "%"), x1 - 0.75, py(v) - 0.13, 0.6, 0.26, 10, TK$faint, align = "right") }
for (k in 1:2) { caja(doc, if (k == 1) x1 else x2, yt_ - 0.05, 0.012, hy + 0.1, TK$faint)
  txt(doc, c("2021", "2026")[k], (if (k == 1) x1 else x2) - 0.5, yt_ + hy + 0.12, 1, 0.3, 14, TK$navy, bold = TRUE, align = "center") }
txt(doc, "Top Two Box", x1 - 0.75, yt_ - 0.45, 2, 0.26, 10, TK$soft, bold = TRUE)
for (nm in names(ser)) { v <- ser[[nm]]; col <- TK$actores[[nm]]
  dx <- x2 - x1; dy <- py(v[2]) - py(v[1]); L <- sqrt(dx^2 + dy^2); ang <- atan2(dy, dx) * 180 / pi
  invisible(ph_with(doc, "", location = ph_location(left = (x1 + x2) / 2 - L / 2, top = (py(v[1]) + py(v[2])) / 2 - 0.02, width = L, height = 0.04, bg = col, rotation = -ang, ln = sp_line(color = col, lwd = 0.25))))
  for (k in 1:2) caja(doc, (if (k == 1) x1 else x2) - 0.13, py(v[k]) - 0.13, 0.26, 0.26, col, geom = "ellipse")
  txt(doc, paste0(v[1], "%"), x1 - 1.55, py(v[1]) - 0.16, 0.75, 0.32, 13, col, bold = TRUE, align = "right")
  txt(doc, sprintf("%s %d%%", nm, v[2]), x2 + 0.2, py(v[2]) - 0.16, 2.6, 0.32, 13, col, bold = TRUE)
  txt(doc, sprintf("%+d pts", v[2] - v[1]), x2 + 0.2, py(v[2]) + 0.14, 2.6, 0.26, 11, TK$coral, bold = TRUE) }
zona("pendiente entre dos mediciones", x1, yt_, x2 - x1, hy)
pie(doc, "Base 2026: 52 docentes y 172 estudiantes. 2021: informe consolidado anterior")


# --- C29: la misma serie con varios procesos de acreditación, que es donde una línea se lee bien
MOTOR_ACT <- "p_slide_1_grafico: p_serie_temporal (cuatro mediciones)"
doc <- nueva(doc); titulo(doc, "Tutoría académica en cuatro procesos de acreditación", ante = "Serie temporal con varias mediciones")
gs <- grafico_serie(c("2012", "2016", "2021", "2026"), list(Docentes = c(88, 93, 98, 83), Estudiantes = c(71, 79, 84, 53)), unname(TK$actores[c("Docentes", "Estudiantes")]) |> setNames(c("Docentes", "Estudiantes")), lim = c(40, 100))
invisible(ph_with(doc, dml(ggobj = gs, bg = "transparent", fonts = list(sans = "Arial")), location = ph_location(left = ML + 0.4, top = YT + 0.1, width = AC - 0.4, height = 4.7)))
txt(doc, "Top Two Box", ML, YT - 0.25, 3, 0.26, 10, TK$soft, bold = TRUE)
zona("serie de cuatro mediciones", ML + 0.4, YT + 0.1, AC - 0.4, 4.7)
pie(doc, "Base: docentes y estudiantes de cada proceso (46 a 52 docentes y 702 a 1,234 estudiantes)")
# --- p_radar: el radar real, sólo en la lámina de un gráfico y con su tabla
MOTOR_ACT <- "p_slide_1_grafico: p_radar con tabla nativa (sólo en lámina de un gráfico)"
doc <- nueva(doc); titulo(doc, "Formulación del perfil de egreso", ante = "Radar con tabla")
ang <- pi / 2 - 2 * pi * (0:5) / 6; lo <- 80; rr <- function(v) (v - lo) / (100 - lo)
ring <- do.call(rbind, lapply(c(85, 90, 95, 100), function(v) data.frame(r = v, x = rr(v) * cos(c(ang, ang[1])), y = rr(v) * sin(c(ang, ang[1])))))
serie <- do.call(rbind, lapply(names(TK$actores), function(a) data.frame(a = a, x = rr(dd6[[a]]) * cos(ang), y = rr(dd6[[a]]) * sin(ang))))
serie$a <- factor(serie$a, levels = names(TK$actores))
labr <- data.frame(t = comp6, x = 1.2 * cos(ang), y = 1.12 * sin(ang), h = ifelse(abs(cos(ang)) < 0.1, 0.5, ifelse(cos(ang) > 0, 0, 1)))
gr <- ggplot() + geom_path(data = ring, aes(x, y, group = r), colour = "#C9CED8", linewidth = 0.4) +
  geom_polygon(data = serie, aes(x, y, group = a, colour = a), fill = NA, linewidth = 1.1) + geom_point(data = serie, aes(x, y, colour = a), size = 2.4) +
  geom_text(data = labr, aes(x, y, label = t, hjust = h), size = 12 / .pt, colour = TK$navy, family = "Arial", fontface = "bold") +
  geom_label(data = data.frame(v = c(85, 90, 95, 100)), aes(x = rr(v) * cos(pi / 3) * 0.87 + 0.02, y = rr(v) * sin(pi / 3) * 0.87, label = paste0(v, "%")), hjust = 0, vjust = 0.5,   # entre dos ejes: no pisa el rótulo del eje superior
    size = 10 / .pt, colour = TK$soft, family = "Arial", fill = TK$fondo, label.size = 0, label.padding = unit(0.06, "lines")) +
  scale_colour_manual(values = TK$actores) + coord_equal(xlim = c(-2.15, 2.15), ylim = c(-1.25, 1.25), clip = "off") + theme_void() + theme(legend.position = "none")   # xlim amplio: los rótulos de los ejes caben sin tocar la tabla
invisible(ph_with(doc, dml(ggobj = gr, bg = "transparent", fonts = list(sans = "Arial")), location = ph_location(left = ML, top = YT + 0.2, width = 6.6, height = 4.5)))
leyenda(doc, 0, YF - 0.3, names(TK$actores), TK$actores, centrar_en = ML + 3.3)
names(dd6)[1] <- "Competencia"; tabla_ttb(dd6, 7.25, YT + 0.6, c(2.2, 1.15, 1.25, 1.15), 0.5); names(dd6)[1] <- "Competencia"
zona("radar", ML, YT + 0.2, 6.6, 4.5)
pie(doc, sprintf("Base: %d docentes, %d estudiantes y %d egresados", ns6[1], ns6[2], ns6[3]))

# --- propuesta en lugar del radar: puntos por competencia, eje rotulado
MOTOR_ACT <- "propuesta: p_puntos_comparativos por competencia en lugar de p_radar"
doc <- nueva(doc); titulo(doc, "Formulación del perfil de egreso", ante = if (NUEVA) "Puntos por competencia, alternativa al radar" else "Propuesta en lugar del radar: puntos por competencia")
o <- order(-rowMeans(dd6[, 2:4])); d3 <- dd6[o, ]
xl <- ML + 3.0; wl <- W - MR - xl - 1.4; yb <- YT + 0.75; fila <- (YF - yb - 0.6) / nrow(d3)
px <- eje_pct(doc, xl, wl, yb, nrow(d3) * fila, 80, 100, 5, "Top Two Box por actor")
for (i in seq_len(nrow(d3))) { yc <- yb + (i - 0.5) * fila; v <- unlist(d3[i, 2:4])
  txt(doc, d3$Competencia[i], ML, yc - 0.15, 2.8, 0.3, 13, TK$navy, bold = TRUE, align = "right")
  caja(doc, px(min(v)), yc - 0.012, px(max(v)) - px(min(v)), 0.024, TK$faint)
  dy <- c(0, 0, 0); for (k in 2:3) for (m in 1:(k - 1)) if (v[k] == v[m]) dy[k] <- dy[m] + 0.17
  for (k in 1:3) { yk <- yc + dy[k] - 0.085 * (max(dy) > 0); caja(doc, px(v[k]) - 0.12, yk - 0.12, 0.24, 0.24, TK$actores[k], geom = "ellipse", line = sp_line(color = TK$fondo, lwd = 1.25)) }
  txt(doc, sprintf("%d a %d%%", min(v), max(v)), px(max(v)) + 0.2, yc - 0.14, 1.2, 0.28, 11, TK$navy, bold = TRUE) }
zona("puntos, eje 80 a 100 rotulado", xl, yb, wl, nrow(d3) * fila)
leyenda(doc, 0, YF - 0.3, sprintf("%s (%d)", names(TK$actores), ns6), TK$actores, centrar_en = xl + wl / 2)
pie(doc, sprintf("Base: %d docentes, %d estudiantes y %d egresados", ns6[1], ns6[2], ns6[3]))
