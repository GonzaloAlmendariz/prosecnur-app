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

# C30 a C32 (comentarios de Gonzalo, 2026-10-07). Los mapas de calor usan una sola escala de azul que se ajusta al rango de
# los datos (del múltiplo de 5 bajo el mínimo al de encima del máximo), para que sirvan con cualquier actor y cualquier batería; debajo de
# cada cifra va su diferencia con el total, en puntos. Sin notas de lectura atadas al ejemplo: el uso va en el subtítulo.
rango_calor <- function(M) c(max(0, floor(min(M, na.rm = TRUE) / 5) * 5), min(100, ceiling(max(M, na.rm = TRUE) / 5) * 5))
# Cinco tramos en vez de un degradado: los azules intermedios de un degradado quedan en ~4:1 con letra blanca y con letra
# oscura a la vez (Gonzalo, 2026-10-07: «a veces las letras negras no se ven bien con el color»). Todos estos pasan 4.5:1.
TRAMOS_CALOR <- c("#EEF2F8", "#C9D3E6", "#9FB1D1", "#4F6A9A", "#2F4B7C")
calor <- function(v, lo, hi) TRAMOS_CALOR[pmin(5, pmax(1, floor((v - lo) / (hi - lo) * 5) + 1))]
celda_calor <- function(doc, x, y, w, h, v, lo, hi, ref = NULL) {
  col <- calor(v, lo, hi); caja(doc, x + 0.02, y + 0.02, w - 0.04, h - 0.04, col); tc <- texto_sobre(col)
  if (is.null(ref) || h < 0.6) txt(doc, paste0(round(v), "%"), x, y + (h - 0.3) / 2, w, 0.3, 12, tc, bold = TRUE, align = "center")
  else { dd <- round(v) - round(ref)
    txt(doc, paste0(round(v), "%"), x, y + h / 2 - 0.3, w, 0.3, 13, tc, bold = TRUE, align = "center")
    txt(doc, if (dd == 0) "=" else sprintf("%+d", dd), x, y + h / 2, w, 0.26, 10, tc, align = "center") } }
escala_calor <- function(doc, centro, y, lo, hi, w = 3.6, rotulo = "Top Two Box") {   # cinco tramos con sus cortes debajo, centrada
  wr <- ancho_tinta(rotulo, 11, TRUE) + 0.3; tot <- wr + w; x <- centro - tot / 2
  txt(doc, rotulo, x - 0.1, y - 0.04, wr + 0.2, 0.3, 11, TK$soft, bold = TRUE); x <- x + wr
  cortes <- round(seq(lo, hi, length.out = 6))
  for (i in 1:5) caja(doc, x + (i - 1) * w / 5, y, w / 5 - 0.03, 0.2, TRAMOS_CALOR[i])
  for (i in 1:6) txt(doc, paste0(cortes[i], "%"), x + (i - 1) * w / 5 - 0.35, y + 0.22, 0.7, 0.26, 10, TK$soft, align = "center")
  zona("escala", centro - tot / 2, y, tot, 0.45) }

MOTOR_ACT <- "p_slide_seccion"; doc <- portadilla(doc, "III.4", "Dimensiones e índices", "Requieren las dimensiones calculadas en Analítica", icono = ICONO_SECCION[6])

# --- p_dim_heatmap: dimensiones por grupo
MOTOR_ACT <- "p_slide_1_grafico: p_dim_heatmap"
doc <- nueva(doc); titulo(doc, "Competencias del perfil de egreso por grupo", ante = "Mapa de calor por dimensión",
                          sub = "Varios grupos en pocas dimensiones, con la diferencia de cada grupo frente al total")
cols <- c("Total", "Masculino", "Femenino", names(cic_cod)); xl <- ML + 2.9; wc <- (W - MR - xl) / length(cols); hc <- 0.95; y0 <- YT + 0.85
lh <- rango_calor(M_dim); chica <- n_g < 15
for (j in seq_along(cols)) { txt(doc, sub(" ciclo", "", cols[j]), xl + (j - 1) * wc, y0 - 0.58, wc, 0.26, 11, TK$navy, bold = TRUE, align = "center")
  txt(doc, sprintf("%d%s", n_g[[cols[j]]], if (chica[[cols[j]]]) "*" else ""), xl + (j - 1) * wc, y0 - 0.33, wc, 0.24, 10, TK$faint, align = "center") }
txt(doc, "Sexo", xl + wc, y0 - 0.86, 2 * wc, 0.26, 10, TK$soft, bold = TRUE, align = "center"); txt(doc, "Ciclo", xl + 3 * wc, y0 - 0.86, 6 * wc, 0.26, 10, TK$soft, bold = TRUE, align = "center")
for (i in seq_len(nrow(M_dim))) { yi <- y0 + (i - 1) * hc
  txt(doc, rownames(M_dim)[i], ML, yi + (hc - 0.3) / 2, 2.75, 0.3, 13, TK$navy, bold = TRUE, align = "right")
  for (j in seq_along(cols)) celda_calor(doc, xl + (j - 1) * wc, yi, wc, hc, M_dim[i, cols[j]], lh[1], lh[2], if (j == 1) NULL else M_dim[i, "Total"]) }
caja(doc, xl + wc - 0.01, y0 - 0.1, 0.02, nrow(M_dim) * hc + 0.1, TK$navy); caja(doc, xl + 3 * wc - 0.01, y0 - 0.1, 0.02, nrow(M_dim) * hc + 0.1, TK$navy)
escala_calor(doc, xl + length(cols) * wc / 2, y0 + nrow(M_dim) * hc + 0.45, lh[1], lh[2])
zona("mapa de calor, escala ajustada al rango", xl, y0, length(cols) * wc, nrow(M_dim) * hc)
pie(doc, sprintf("Base: %d estudiantes que respondieron la batería de competencias.%s Debajo de cada cifra, la diferencia con el total en puntos",
                 n_g[["Total"]], if (any(chica)) " * Menos de 15 casos." else ""))

# --- p_dim_heatmap_criterios: cada criterio dentro de su dimensión
MOTOR_ACT <- "p_slide_1_grafico: p_dim_heatmap_criterios"
doc <- nueva(doc); titulo(doc, "Cada competencia dentro de su dimensión", ante = "Mapa de calor por criterio",
                          sub = "Los ítems de cada dimensión por separado, para ver cuál sube o baja su índice")
cols2 <- c("Total", "Masculino", "Femenino"); xl <- ML + 5.4; wc <- (W - MR - xl - 0.1) / 3; hc <- (YF - YT - 1.3) / 11; y0 <- YT + 0.75
lh2 <- rango_calor(M_it[, cols2])
for (j in seq_along(cols2)) txt(doc, sprintf("%s (%d)", cols2[j], n_g[[cols2[j]]]), xl + (j - 1) * wc, y0 - 0.35, wc, 0.26, 11, TK$navy, bold = TRUE, align = "center")
fila_i <- 0
for (dn in names(dims)) { ix <- dims[[dn]]; ytop <- y0 + fila_i * hc
  caja(doc, ML, ytop + 0.04, 0.05, length(ix) * hc - 0.08, TK$navy)
  txt(doc, dn, ML + 0.15, ytop + (length(ix) * hc - 0.3) / 2, 2.3, 0.3 * (1 + (nchar(dn) > 20)), 11, TK$soft, bold = TRUE)
  for (k in ix) { yi <- y0 + fila_i * hc; txt(doc, nom_it[k], ML + 2.5, yi + (hc - 0.28) / 2, 2.75, 0.28, 11.5, TK$navy, bold = TRUE, align = "right")
    for (j in seq_along(cols2)) celda_calor(doc, xl + (j - 1) * wc, yi, wc, hc, M_it[k, cols2[j]], lh2[1], lh2[2]); fila_i <- fila_i + 1 }
  separador_h(doc, ML, xl + 3 * wc, y0 + fila_i * hc) }
escala_calor(doc, xl + 1.5 * wc, y0 + 11 * hc + 0.2, lh2[1], lh2[2])
zona("mapa de calor por criterio", xl, y0, 3 * wc, 11 * hc)
pie(doc, sprintf("Base: %d estudiantes que respondieron la batería de competencias", n_g[["Total"]]))

# --- p_dim_comparativo_radarbar: subíndices comparados entre grupos (barras sobre riel con la diferencia al lado)
MOTOR_ACT <- "p_slide_1_grafico: p_dim_comparativo_radarbar (componente de barras)"
doc <- nueva(doc); titulo(doc, "Índices por sexo", ante = "Comparativo de dimensiones")
xl <- ML + 3.1; xd <- W - MR - 2.3; wl <- xd - xl - 1.2; y0 <- YT + 0.75; bloque <- (YF - y0 - 0.35) / nrow(M_dim); gb <- 0.3
px <- function(v) xl + wl * v / 100; cg2 <- c(TK$navy, "#4F7FAF"); gr2 <- c("Masculino", "Femenino")
leyenda(doc, 0, YT + 0.05, sprintf("%s (%d)", gr2, n_g[gr2]), cg2, centrar_en = xl + wl / 2)
txt(doc, "Diferencia", xd, YT + 0.05, W - MR - xd, 0.3, 12, TK$soft, bold = TRUE, align = "center")
for (v in seq(0, 100, 25)) caja(doc, px(v) - 0.004, y0, 0.008, nrow(M_dim) * bloque, if (v == 0) TK$soft else TK$rule)   # E4 (Gonzalo, 2026-10-08): guías finas en vez del riel blanco
for (i in seq_len(nrow(M_dim))) { yi <- y0 + (i - 1) * bloque; yc <- yi + bloque / 2
  if (i > 1) separador_h(doc, ML, xl - 0.1, yi)
  txt(doc, rownames(M_dim)[i], ML, yc - 0.17, 2.95, 0.34, 14, TK$navy, bold = TRUE, align = "right")
  for (k in 1:2) { yb <- yc - gb - 0.05 + (k - 1) * (gb + 0.1); v <- M_dim[i, gr2[k]]
    caja(doc, xl, yb, px(v) - xl, gb, cg2[k])
    txt(doc, paste0(round(v), "%"), xl + wl + 0.1, yb + (gb - 0.3) / 2, 0.9, 0.3, 14, TK$navy, bold = TRUE) }
  d <- round(M_dim[i, "Femenino"]) - round(M_dim[i, "Masculino"])
  txt(doc, if (d == 0) "0" else sprintf("%d pts", abs(d)), xd, yc - 0.32, W - MR - xd, 0.4, 20, TK$navy, bold = TRUE, align = "center")
  txt(doc, if (d == 0) "sin diferencia" else paste("a favor de", gr2[1 + (d > 0)]), xd, yc + 0.08, W - MR - xd, 0.3, 11, TK$soft, align = "center") }
separador_v(doc, xd - 0.15, YT, YF - 0.3)
for (v in seq(0, 100, 25)) txt(doc, paste0(v, "%"), px(v) - 0.35, YF - 0.3, 0.7, 0.24, 10, TK$soft, align = "center")   # E4: escala debajo, sin riel
zona("barras desde 0 con guías cada 25 %", xl, y0, wl, nrow(M_dim) * bloque)
pie(doc, sprintf("Base: %d estudiantes que respondieron la batería de competencias", n_g[["Total"]]))

if (ESTILO == "moderna") { MOTOR_ACT <- "PROPUESTA: peso de cada aspecto en la satisfacción general (regresión, análisis nuevo en Analítica)"; doc <- rr_peso(doc) }

# --- p_dim_radar: once competencias como ejes (5 o más ejes), por sexo
# E5 (Gonzalo, 2026-10-08: «me encanta que pueda ponerse un límite mínimo al eje»): el motor ya lo tiene, p_dim_radar(inicio_eje_pct = 80)
MOTOR_ACT <- "p_slide_1_grafico: p_dim_radar(inicio_eje_pct = 80)"
doc <- nueva(doc); titulo(doc, "Las once competencias por sexo", ante = "Radar por dimensiones", sub = "El eje empieza en 80 %: con valores altos y parecidos, así se ven las diferencias")
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
