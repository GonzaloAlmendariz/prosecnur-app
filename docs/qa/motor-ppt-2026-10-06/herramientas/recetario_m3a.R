# Recetario: galería de gráficos de distribución (loop M3a).
# Se carga desde recetario.R después de recetario_m2c.R.

MOTOR_ACT <- "p_slide_seccion"; doc <- portadilla(doc, "III.3", "Galería de gráficos", "Cada constructor del motor, con su mejor uso", icono = ICONO_SECCION[5])

# --- p_barras_categoricas: columnas verticales de un solo color
MOTOR_ACT <- "p_slide_1_grafico: p_barras_categoricas"
doc <- nueva(doc); titulo(doc, "Nivel curricular del estudiante", ante = "Barras categóricas")
cl <- D$ciclo; n_ <- length(cl$pct); x0 <- ML + 0.6; wv <- ANCHO - 1.2; paso <- wv / n_; wcol <- paso * 0.56
ybase <- 6.05; hmax <- 3.4; esc <- max(cl$pct) * 1.1
caja(doc, x0 - 0.1, ybase, wv + 0.2, 0.012, TK$faint)
for (k in seq_len(n_)) { hk <- hmax * cl$pct[k] / esc; xk <- x0 + (k - 1) * paso + (paso - wcol) / 2
  caja(doc, xk, ybase - hk, wcol, hk, TK$navy)
  txt(doc, paste0(cl$pct[k], "%"), xk - 0.3, ybase - hk - 0.42, wcol + 0.6, 0.36, 16, TK$navy, bold = TRUE, align = "center")
  txt(doc, sprintf("%d estudiantes", cl$n[k]), xk - 0.4, ybase - hk - 0.68, wcol + 0.8, 0.26, 10, TK$faint, align = "center")
  txt(doc, cl$labels[k], xk - 0.4, ybase + 0.1, wcol + 0.8, 0.3, 12, TK$navy, bold = TRUE, align = "center") }
zona("columnas", x0, ybase - hmax, wv, hmax)
pie(doc, "Base: 172 estudiantes")

# --- p_pie: dicotomía de un solo público
# E3 (Gonzalo, 2026-10-08: «la leyenda es particular, creo que el motor no tiene esta configuración»): no la tiene. graficar_pie
# (api/R/graficador_pie_dicotomico.R) sólo dibuja la leyenda estándar de ggplot, a la derecha o abajo. Queda como propuesta.
MOTOR_ACT <- "PROPUESTA: p_pie con leyenda de cifras (el motor hoy dibuja la leyenda estándar a la derecha o abajo)"
doc <- nueva(doc); titulo(doc, "Titulación del egresado", ante = "Gráfico de torta con leyenda de cifras")
t1 <- D$titulo; d_ <- 4.4; xp <- ML + 1.0; yp <- YT + 0.25
torta(doc, xp, yp, d_, t1$labels, t1$pct)
for (k in 1:2) { yk <- YT + 1.0 + (k - 1) * 1.9
  caja(doc, 6.7, yk + 0.12, 0.3, 0.3, TK$dico[k])
  txt(doc, paste0(t1$pct[k], "%"), 7.15, yk - 0.05, 2.2, 0.62, 34, if (k == 1) TK$navy else "#4F7FAF", bold = TRUE)
  txt(doc, sprintf("%s cuenta con título universitario", if (k == 1) "Sí" else "No"), 7.15, yk + 0.58, 5.5, 0.3, 13, TK$navy, bold = TRUE)
  txt(doc, sprintf("%d de %d egresados", t1$n[k], t1$valid), 7.15, yk + 0.86, 5.5, 0.26, 11, TK$faint) }
pie(doc, if (NUEVA) "Base: 178 egresados. Cada parte lleva su cifra, su rótulo y su conteo junto al gráfico" else "Base: 178 egresados. La leyenda con cifra, rótulo y conteo es una propuesta: el motor hoy dibuja la leyenda estándar")

# --- p_donut: dicotomía con la cifra clave al centro
MOTOR_ACT <- "p_slide_1_grafico: p_donut"
doc <- nueva(doc); titulo(doc, "Conocimiento de la misión entre estudiantes", ante = "Gráfico de dona")
m <- D$mision1[[2]]
df_d <- data.frame(k = factor(m$labels, levels = m$labels), v = m$pct)
gd <- ggplot(df_d, aes(x = 2, y = v, fill = k)) + geom_col(width = 1, colour = TK$fondo, linewidth = 1.2) + coord_polar(theta = "y", direction = -1) +
  xlim(c(0.15, 2.5)) + scale_fill_manual(values = TK$dico) + theme_void() + theme(legend.position = "none", plot.margin = margin(0, 0, 0, 0))
dd_ <- 4.0; xd <- ML + 1.2; yd <- YT + 0.35
invisible(ph_with(doc, dml(ggobj = gd, bg = "transparent", fonts = list(sans = "Arial")), location = ph_location(left = xd, top = yd, width = dd_, height = dd_)))
txt(doc, paste0(m$pct[1], "%"), xd, yd + dd_ / 2 - 0.45, dd_, 0.66, 34, TK$navy, bold = TRUE, align = "center")
txt(doc, "conoce la misión", xd, yd + dd_ / 2 + 0.2, dd_, 0.3, 12, TK$navy, align = "center")
zona("dona", xd, yd, dd_, dd_)
narrativa(doc, 6.9, YT + 1.0, 5.9, 2.6, list(N_("De "), B(sprintf("%d estudiantes", m$valid)), N_(", "), B(sprintf("%d", m$n[1])), N_(" conocen la misión y los propósitos de la PUCP y "),
  B(sprintf("%d (%d%%)", m$n[2], m$pct[2])), N_(" no la conocen.")), size = 17)
leyenda(doc, 0, yd + dd_ + 0.1, m$labels, TK$dico, centrar_en = xd + dd_ / 2)   # bajo la dona y centrada en ella (C25)
pie(doc, "Base: 172 estudiantes")

# --- p_barras_divergentes: Likert centrada en el paso de desacuerdo a acuerdo
MOTOR_ACT <- "p_slide_1_grafico: p_barras_divergentes"
doc <- nueva(doc); titulo(doc, "Personal administrativo: gestión y desarrollo", ante = "Barras divergentes")
it <- lapply(sprintf("p14_%d", 2:7), function(v) fr("administrativos", v)); it <- it[order(-sapply(it, ttb))]
neg <- sapply(it, function(f) f$pct[1] + f$pct[2]); pos <- sapply(it, ttb)
xq <- ML + 0.1; wq <- 4.5; xa_ <- xq + wq + 0.25; wsi <- 0.9; wa_ <- W - MR - xa_ - wsi - 0.2
lo_ <- ceiling((max(neg) + 5) / 10) * 10; px_ <- wa_ / (lo_ + 100); xc <- xa_ + lo_ * px_
fila_ <- 0.74; g_ <- 0.4; y0_ <- YT + 0.3
txt(doc, "En desacuerdo", xc - 2.2, y0_ - 0.4, 2.1, 0.26, 10.5, TK$soft, bold = TRUE, align = "right")
txt(doc, "De acuerdo (Top Two Box)", xc + 0.1, y0_ - 0.4, 3, 0.26, 10.5, TK$soft, bold = TRUE)
txt(doc, "SIN INF", W - MR - wsi, y0_ - 0.4, wsi, 0.26, 10.5, TK$soft, bold = TRUE, align = "center")
for (i in seq_along(it)) { f <- it[[i]]; yb <- y0_ + (i - 1) * fila_ + (fila_ - g_) / 2
  hp <- alto_txt(f$pregunta, wq, 10.5, TRUE); txt(doc, f$pregunta, xq, yb + g_ / 2 - hp / 2, wq, hp, 10.5, TK$navy, bold = TRUE)
  segs <- list(list(v = f$pct[2], c = TK$likert[2], dir = -1, off = 0), list(v = f$pct[1], c = TK$likert[1], dir = -1, off = f$pct[2]),
               list(v = f$pct[3], c = TK$likert[3], dir = 1, off = 0), list(v = f$pct[4], c = TK$likert[4], dir = 1, off = f$pct[3]))
  for (sg in segs) if (sg$v > 0) { wseg <- sg$v * px_; xs <- if (sg$dir < 0) xc - (sg$off + sg$v) * px_ else xc + sg$off * px_
    caja(doc, xs - 0.002, yb, wseg + 0.004, g_, sg$c)
    if (wseg >= 0.45) txt(doc, paste0(sg$v, "%"), xs - 0.1, yb + (g_ - 0.28) / 2, wseg + 0.2, 0.28, 11, TK$navy, bold = TRUE, align = "center")
    else { caja(doc, xs + wseg / 2 - 0.006, yb - 0.06, 0.012, 0.06, TK$faint)            # cifra chica encima, como en las apiladas
      txt(doc, paste0(sg$v, "%"), xs + wseg / 2 - 0.3, yb - 0.3, 0.6, 0.24, 10.5, TK$navy, bold = TRUE, align = "center") } }
  txt(doc, paste0(pos[i], "%"), xc + pos[i] * px_ + 0.08, yb + (g_ - 0.28) / 2, 0.7, 0.28, 11, TK$verde_txt, bold = TRUE)
  txt(doc, paste0(neg[i], "%"), xc - neg[i] * px_ - 0.75, yb + (g_ - 0.28) / 2, 0.7, 0.28, 11, TK$coral, bold = TRUE, align = "right")
  if (f$pct[5] > 0) caja(doc, W - MR - wsi + 0.05, yb, (wsi - 0.55) * f$pct[5] / max(1, max(sapply(it, function(z) z$pct[5]))), g_, TK$likert[5])
  txt(doc, paste0(f$pct[5], "%"), W - MR - 0.5, yb + (g_ - 0.26) / 2, 0.5, 0.26, 10.5, TK$soft, bold = TRUE, align = "right") }
caja(doc, xc - 0.006, y0_ - 0.1, 0.012, length(it) * fila_ + 0.15, TK$navy)
zona("divergente, centro entre desacuerdo y acuerdo", xa_, y0_, wa_, length(it) * fila_)
leyenda(doc, 0, y0_ + length(it) * fila_ + 0.25, LIKERT_ROT, TK$likert, centrar_en = W / 2)
pie(doc, if (NUEVA) "Para escalas con un punto medio claro. Base: 15 administrativos" else "Uso excepcional: con Top Two Box se prefieren barras apiladas alineadas. Base: 15 administrativos")

# --- p_lollipop: ranking de muchas opciones (selección múltiple)
MOTOR_ACT <- "p_slide_1_grafico: p_lollipop (selección múltiple)"
sm <- D$ing_p35
doc <- nueva(doc); titulo(doc, "Qué podría mejorar la carrera", ante = "Ranking con puntos")
o <- order(-sm$pct); lab <- sm$labels[o]; pc <- sm$pct[o]; res <- grepl("^Otros$|^No sabe", lab)
lab <- c(lab[!res], lab[res]); pc <- c(pc[!res], pc[res]); lab <- lab[pc > 0]; pc <- pc[pc > 0]
wl_ <- 6.3; xs_ <- ML + wl_ + 0.25; ws_ <- W - MR - xs_ - 0.7; fl_ <- (YF - YT - 0.45) / length(lab); esc_ <- ceiling(max(pc) / 10) * 10
for (v in seq(0, esc_, 10)) { xv <- xs_ + ws_ * v / esc_; caja(doc, xv, YT + 0.35, 0.006, length(lab) * fl_, TK$rule)
  txt(doc, paste0(v, "%"), xv - 0.3, YT + 0.05, 0.6, 0.24, 10, TK$faint, align = "center") }
for (k in seq_along(lab)) { yc <- YT + 0.35 + (k - 0.5) * fl_; xv <- xs_ + ws_ * pc[k] / esc_; col <- if (grepl("^No sabe|^Otros", lab[k])) TK$faint else TK$navy
  hl <- alto_txt(lab[k], wl_, 11); txt(doc, lab[k], ML, yc - hl / 2, wl_, hl, 11, TK$navy, align = "right")
  caja(doc, xs_, yc - 0.012, xv - xs_, 0.024, col); caja(doc, xv - 0.1, yc - 0.1, 0.2, 0.2, col, geom = "ellipse")
  txt(doc, paste0(pc[k], "%"), xv + 0.14, yc - 0.15, 0.7, 0.3, 12, TK$navy, bold = TRUE) }
zona("lollipop, eje desde 0", xs_, YT + 0.35, ws_, length(lab) * fl_)
txt(doc, "% de encuestados que marcó cada opción", xs_, YT - 0.25, ws_, 0.26, 10, TK$soft, bold = TRUE)
pie(doc, sprintf("Base: %d egresados", sm$valid))

# --- C26: la alternativa del ranking en barras ordenadas, con los mismos datos
MOTOR_ACT <- "p_slide_1_grafico: p_barras_agrupadas (orden_barras = «mayor_menor», residuales al final)"
doc <- nueva(doc); titulo(doc, "Qué podría mejorar la carrera", ante = "Ranking en barras")
txt(doc, "% de encuestados que marcó cada opción", ML + 6.55, YT - 0.25, 4, 0.26, 10, TK$soft, bold = TRUE)
barras_h(doc, ML, YT + 0.2, ANCHO, lab, pc, wlab = 6.3, g = min(0.42, fl_ * 0.62), fila = fl_, size = 11)
pie(doc, sprintf("Base: %d egresados. La opción más marcada va en azul oscuro. «Otros» y «No sabe» van al final", sm$valid))
