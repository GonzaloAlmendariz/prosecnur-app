# Recetario: dimensiones (loop M3d). Índices desde las 11 competencias de estudiantes
# (p22_1..11): Top Two Box por ítem; subíndice = promedio de sus ítems. 5 = SIN INF, fuera.
# Se carga tras recetario_m3c.R.
de <- CONTA$data_sources$estudiantes
items <- sprintf("p22_%d", 1:11)
nom_it <- c("Estados financieros", "Auditoría", "Costos y presupuestos", "Finanzas", "Tributación", "Visión empresarial",
            "Aprendizaje autónomo", "Comunicación eficaz", "Trabajo en equipo", "Razonamiento matemático", "Ética y ciudadanía")
dims <- list(`Competencias técnicas` = 1:5, `Visión empresarial` = 6, `Competencias transversales` = 7:11)
ttb_it <- function(idx = rep(TRUE, nrow(de))) sapply(items, function(v) { x <- as.character(de[[v]])[idx]; ok <- x %in% c("1", "2", "3", "4"); round(100 * mean(x[ok] %in% c("3", "4"))) })
grupos <- list(Total = rep(TRUE, nrow(de)), Masculino = as.character(de$p5) == "1", Femenino = as.character(de$p5) == "2")
cic <- num_por_grupo("estudiantes", "p3", "p6")   # sólo para los nombres de ciclo
cic_cod <- setNames(as.character(1:6), names(cic))
for (k in names(cic_cod)) grupos[[k]] <- as.character(de$p6) == cic_cod[[k]]
M_it <- sapply(grupos, ttb_it)                                   # ítems x grupos
M_dim <- t(sapply(dims, function(ix) colMeans(M_it[ix, , drop = FALSE])))  # dimensiones x grupos
resp_bat <- apply(sapply(items, function(v) as.character(de[[v]]) %in% c("1", "2", "3", "4")), 1, any)   # respondió la batería
n_g <- sapply(grupos, function(g) sum(g & resp_bat))   # base real: quienes respondieron, no el total del grupo
azul <- function(v, lo = 80, hi = 100) grDevices::colorRampPalette(c("#EEF2F8", "#2F4B7C"))(41)[pmin(41, pmax(1, round((v - lo) / (hi - lo) * 40) + 1))]
celda <- function(doc, x, y, w, h, v) { col <- azul(v); caja(doc, x + 0.02, y + 0.02, w - 0.04, h - 0.04, col)
  txt(doc, paste0(round(v), "%"), x, y + (h - 0.3) / 2, w, 0.3, 12, if (1.05 / (lum(col) + .05) >= 4.5) "#FFFFFF" else TK$navy, bold = TRUE, align = "center") }
escala_azul <- function(doc, x, y, w, lo = 80, hi = 100) { n <- 20; for (i in 0:(n - 1)) caja(doc, x + i * w / n, y, w / n + 0.005, 0.16, azul(lo + (hi - lo) * i / (n - 1), lo, hi))
  txt(doc, paste0(lo, "%"), x - 0.55, y - 0.06, 0.5, 0.26, 10, TK$soft, align = "right"); txt(doc, paste0(hi, "%"), x + w + 0.05, y - 0.06, 0.6, 0.26, 10, TK$soft) }

MOTOR_ACT <- "p_slide_seccion"; doc <- portadilla(doc, "III.4", "Dimensiones e índices", "Requieren las dimensiones calculadas en Analítica", icono = ICONO_SECCION[6])

# --- p_dim_heatmap: dimensiones por grupo
MOTOR_ACT <- "p_slide_1_grafico: p_dim_heatmap"
doc <- nueva(doc); titulo(doc, "Competencias del perfil de egreso por grupo", ante = "Mapa de calor por dimensión")
cols <- c("Total", "Masculino", "Femenino", names(cic_cod)); xl <- ML + 2.9; wc <- (W - MR - xl) / length(cols); hc <- 1.0; y0 <- YT + 0.85
for (j in seq_along(cols)) { txt(doc, sub(" ciclo", "", cols[j]), xl + (j - 1) * wc, y0 - 0.62, wc, 0.26, 11, TK$navy, bold = TRUE, align = "center")
  txt(doc, sprintf("%d", n_g[[cols[j]]]), xl + (j - 1) * wc, y0 - 0.36, wc, 0.24, 10, TK$faint, align = "center") }
txt(doc, "Sexo", xl + wc, y0 - 0.92, 2 * wc, 0.26, 10, TK$soft, bold = TRUE, align = "center"); txt(doc, "Ciclo", xl + 3 * wc, y0 - 0.92, 6 * wc, 0.26, 10, TK$soft, bold = TRUE, align = "center")
for (i in seq_len(nrow(M_dim))) { yi <- y0 + (i - 1) * hc
  txt(doc, rownames(M_dim)[i], ML, yi + (hc - 0.3) / 2, 2.75, 0.3, 13, TK$navy, bold = TRUE, align = "right")
  for (j in seq_along(cols)) celda(doc, xl + (j - 1) * wc, yi, wc, hc, M_dim[i, cols[j]]) }
caja(doc, xl + wc - 0.01, y0 - 0.1, 0.02, nrow(M_dim) * hc + 0.1, TK$navy); caja(doc, xl + 3 * wc - 0.01, y0 - 0.1, 0.02, nrow(M_dim) * hc + 0.1, TK$navy)
escala_azul(doc, xl + 1.5, y0 + nrow(M_dim) * hc + 0.55, 4)
txt(doc, "Top Two Box promedio", xl + 1.5, y0 + nrow(M_dim) * hc + 0.22, 4, 0.26, 10, TK$soft, bold = TRUE)
zona("heatmap, escala fija 80 a 100", xl, y0, length(cols) * wc, nrow(M_dim) * hc)
pie(doc, sprintf("Base: %d estudiantes que respondieron la batería de competencias", n_g[["Total"]]))

# --- p_dim_heatmap_criterios: cada criterio dentro de su dimensión
MOTOR_ACT <- "p_slide_1_grafico: p_dim_heatmap_criterios"
doc <- nueva(doc); titulo(doc, "Cada competencia dentro de su dimensión", ante = "Mapa de calor por criterio")
cols2 <- c("Total", "Masculino", "Femenino"); xl <- ML + 5.4; wc <- (W - MR - xl - 0.1) / 3; hc <- (YF - YT - 1.15) / 11; y0 <- YT + 0.4
for (j in seq_along(cols2)) txt(doc, sprintf("%s (%d)", cols2[j], n_g[[cols2[j]]]), xl + (j - 1) * wc, y0 - 0.35, wc, 0.26, 11, TK$navy, bold = TRUE, align = "center")
fila_i <- 0
for (dn in names(dims)) { ix <- dims[[dn]]; ytop <- y0 + fila_i * hc
  caja(doc, ML, ytop + 0.04, 0.05, length(ix) * hc - 0.08, TK$navy)
  txt(doc, dn, ML + 0.15, ytop + (length(ix) * hc - 0.3) / 2, 2.3, 0.3 * (1 + (nchar(dn) > 20)), 11, TK$soft, bold = TRUE)
  for (k in ix) { yi <- y0 + fila_i * hc; txt(doc, nom_it[k], ML + 2.5, yi + (hc - 0.28) / 2, 2.55, 0.28, 11.5, TK$navy, bold = TRUE, align = "right")
    for (j in seq_along(cols2)) celda(doc, xl + (j - 1) * wc, yi, wc, hc, M_it[k, cols2[j]]); fila_i <- fila_i + 1 }
  fila_i <- fila_i; separador_h(doc, ML, xl + 3 * wc, y0 + fila_i * hc) }
escala_azul(doc, ML + 2.7, YF - 0.22, 2.2); txt(doc, "Top Two Box", ML + 0.6, YF - 0.28, 1.5, 0.26, 10, TK$soft, bold = TRUE)
zona("heatmap por criterio", xl, y0, 3 * wc, 11 * hc)
pie(doc, sprintf("Base: %d estudiantes que respondieron la batería de competencias", n_g[["Total"]]))

# --- p_dim_comparativo_radarbar: subíndices comparados entre grupos (barras)
MOTOR_ACT <- "p_slide_1_grafico: p_dim_comparativo_radarbar (componente de barras)"
doc <- nueva(doc); titulo(doc, "Índices por sexo", ante = "Comparativo de dimensiones")
xl <- ML + 3.1; wl <- W - MR - xl - 0.9; y0 <- YT + 0.6; bloque <- (YF - y0 - 0.6) / nrow(M_dim); gb <- 0.36
px <- function(v) xl + wl * v / 100
for (v in seq(0, 100, 20)) { caja(doc, px(v), y0, 0.006, nrow(M_dim) * bloque, TK$rule); txt(doc, paste0(v, "%"), px(v) - 0.35, y0 - 0.3, 0.7, 0.24, 10, TK$faint, align = "center") }
for (i in seq_len(nrow(M_dim))) { yi <- y0 + (i - 1) * bloque
  txt(doc, rownames(M_dim)[i], ML, yi + bloque / 2 - 0.15, 2.95, 0.3, 13, TK$navy, bold = TRUE, align = "right")
  for (k in 1:2) { g_ <- c("Masculino", "Femenino")[k]; yb <- yi + bloque / 2 - gb - 0.03 + (k - 1) * (gb + 0.06); v <- M_dim[i, g_]
    caja(doc, xl, yb, px(v) - xl, gb, c(TK$navy, "#4F7FAF")[k]); txt(doc, paste0(round(v), "%"), px(v) + 0.08, yb + (gb - 0.28) / 2, 0.8, 0.28, 12, TK$navy, bold = TRUE) } }
zona("barras desde 0", xl, y0, wl, nrow(M_dim) * bloque)
leyenda(doc, 0, YF - 0.3, sprintf("%s (%d)", c("Masculino", "Femenino"), n_g[c("Masculino", "Femenino")]), c(TK$navy, "#4F7FAF"), centrar_en = xl + wl / 2)
pie(doc, sprintf("Base: %d estudiantes que respondieron la batería de competencias", n_g[["Total"]]))

# --- p_dim_radar: once competencias como ejes (5 o más ejes), por sexo
MOTOR_ACT <- "p_slide_1_grafico: p_dim_radar"
doc <- nueva(doc); titulo(doc, "Las once competencias por sexo", ante = "Radar por dimensiones")
angs <- pi / 2 - 2 * pi * (0:10) / 11; lo <- 80; rr <- function(v) (v - lo) / (100 - lo)
ring <- do.call(rbind, lapply(c(85, 90, 95, 100), function(v) data.frame(r = v, x = rr(v) * cos(c(angs, angs[1])), y = rr(v) * sin(c(angs, angs[1])))))
ser <- do.call(rbind, lapply(c("Masculino", "Femenino"), function(g) data.frame(a = g, x = rr(M_it[, g]) * cos(angs), y = rr(M_it[, g]) * sin(angs))))
ser$a <- factor(ser$a, levels = c("Masculino", "Femenino"))
lb <- data.frame(t = nom_it, x = 1.18 * cos(angs), y = 1.12 * sin(angs), h = ifelse(abs(cos(angs)) < 0.15, 0.5, ifelse(cos(angs) > 0, 0, 1)))
gr <- ggplot() + geom_path(data = ring, aes(x, y, group = r), colour = "#C9CED8", linewidth = 0.4) +
  geom_polygon(data = ser, aes(x, y, group = a, colour = a), fill = NA, linewidth = 1.1) + geom_point(data = ser, aes(x, y, colour = a), size = 2.2) +
  geom_text(data = lb, aes(x, y, label = t, hjust = h), size = 11 / .pt, colour = TK$navy, family = "Arial", fontface = "bold") +
  geom_label(data = data.frame(v = c(85, 90, 95, 100)), aes(x = rr(v) * cos((angs[1] + angs[2]) / 2) * cos((angs[1] - angs[2]) / 2) + 0.02,
    y = rr(v) * sin((angs[1] + angs[2]) / 2) * cos((angs[1] - angs[2]) / 2), label = paste0(v, "%")), hjust = 0, vjust = 0.5,   # entre los dos primeros ejes, con fondo y sobre las series
    size = 10 / .pt, colour = TK$soft, family = "Arial", fill = TK$fondo, label.size = 0, label.padding = unit(0.06, "lines")) +
  scale_colour_manual(values = c(Masculino = TK$navy, Femenino = "#4F7FAF")) + coord_equal(xlim = c(-1.9, 1.9), ylim = c(-1.25, 1.25), clip = "off") + theme_void() + theme(legend.position = "none")
invisible(ph_with(doc, dml(ggobj = gr, bg = "transparent", fonts = list(sans = "Arial")), location = ph_location(left = ML + 0.4, top = YT + 0.05, width = 7.6, height = 4.9)))
leyenda(doc, 0, YF - 0.3, sprintf("%s (%d)", c("Masculino", "Femenino"), n_g[c("Masculino", "Femenino")]), c(TK$navy, "#4F7FAF"), centrar_en = ML + 4.2)
d_mf <- M_it[, "Masculino"] - M_it[, "Femenino"]; o <- order(-abs(d_mf))[1:3]
narrativa(doc, 8.95, YT + 0.9, 4.05, 3.2, list(N_("Ningún eje difiere más de "), B(paste0(max(abs(d_mf)), " puntos")), N_(" entre los dos grupos."),
  N_(" Las mayores distancias están en "), B(paste(tolower(nom_it[o[1:2]]), collapse = " y ")), N_(".")), size = 15)
zona("radar, anillos de 80 a 100 rotulados", ML + 0.4, YT + 0.05, 7.6, 4.9)
pie(doc, sprintf("Base: %d estudiantes que respondieron la batería de competencias", n_g[["Total"]]))
