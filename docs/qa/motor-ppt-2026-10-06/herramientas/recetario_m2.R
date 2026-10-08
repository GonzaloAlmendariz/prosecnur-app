# Recetario: disposiciones de dos gráficos y de gráfico con texto (loop M2a).
# Se carga desde recetario.R con source(): usa sus tokens y piezas.

mitad <- (W - ML - MR - 0.5) / 2; xI <- ML; xD <- ML + mitad + 0.5

MOTOR_ACT <- "p_slide_seccion"; doc <- portadilla(doc, "III.1", "Disposiciones con dos gráficos y con texto", "Una misma lámina, dos lecturas", icono = ICONO_SECCION[3])

# --- p_slide_2_graficos: dos gráficos lado a lado
MOTOR_ACT <- "p_slide_2_graficos: p_barras_multiapiladas x2 (dicotómica)"
doc <- nueva(doc); titulo(doc, "Conocimiento de la misión", ante = "Dos gráficos")
act <- c("Docentes", "Estudiantes", "Egresados", "Administrativos")
for (k in 1:2) { bq <- if (k == 1) D$mision1 else D$mision2; x <- if (k == 1) xI else xD
  panel_titulo(doc, x, Y_DATOS, mitad, bq[[1]]$pregunta)
  likert_panel(doc, x, Y_DATOS + 0.5, mitad, lapply(1:4, function(i) list(lab = act[i], f = bq[[i]])), cols = TK$dico, ttb_col = FALSE, g = 0.46, fila = 0.9) }
separador_v(doc, xI + mitad + 0.25, Y_DATOS, YF - 0.3)   # C15
leyenda(doc, 0, 6.38, c("Sí", "No"), TK$dico, centrar_en = W / 2)
pie(doc, "Base: 52 docentes, 172 estudiantes, 178 egresados y 15 administrativos")

# --- p_slide_2_graficos_narrativo: dos gráficos con lectura arriba
MOTOR_ACT <- "p_slide_2_graficos_narrativo: p_barras_agrupadas x2"
doc <- nueva(doc); titulo(doc, "Inserción del egresado", ante = "Dos gráficos con narrativa")
a <- D$anio; s <- D$sueldo; top_s <- which.max(s$pct)
narrativa(doc, ML, Y_DATOS - 0.05, W - ML - MR, 0.75, list(N_("El "), B(paste0(a$pct[which(a$labels == "2025")], "% de los titulados")), N_(" obtuvo su título en 2025, y el tramo de sueldo más frecuente es "),
  B(paste0(tolower(s$labels[top_s]), " (", s$pct[top_s], "%)")), N_(".")), size = 15)
panel_titulo(doc, xI, Y_DATOS + 1.0, mitad, "¿En qué año obtuvo su título universitario?", paste(a$valid, "egresados titulados"))
barras_h(doc, xI, Y_DATOS + 1.65, mitad, a$labels, a$pct, wlab = 0.9, g = grosor_cat(5), fila = 0.6)
panel_titulo(doc, xD, Y_DATOS + 1.0, mitad, "Sueldo mensual bruto", paste(s$valid, "respuestas"))
barras_h(doc, xD, Y_DATOS + 1.65, mitad, s$labels, s$pct, wlab = 2.4, g = grosor_cat(6), fila = 0.5, size = 11)
separador_v(doc, xI + mitad + 0.25, Y_DATOS + 1.0, YF)   # C15
pie(doc, sprintf("Base: %d egresados que tienen título (año de titulación) y %d que respondieron el sueldo", a$valid, s$valid))

# --- p_slide_grafico_texto_derecha: gráfico grande, lectura a la derecha
MOTOR_ACT <- "p_slide_grafico_texto_derecha: p_barras_multiapiladas (modo var)"
doc <- nueva(doc); titulo(doc, "Competencias del perfil de egreso", ante = "Gráfico con texto a la derecha")
comp4 <- lapply(c("p30_1", "p30_2", "p30_3", "p30_9"), function(v) fr("docentes", v))
etq4 <- c("Estados financieros", "Auditoría", "Costos y presupuestos", "Trabajo en equipo")
likert_panel(doc, ML, Y_DATOS + 0.1, 8.6, lapply(1:4, function(i) list(lab = etq4[i], f = comp4[[i]])), wlab = 2.0, g = 0.48, fila = 1.05, size_lab = 12)
leyenda(doc, 0, Y_DATOS + 4.75, LIKERT_ROT, TK$likert, centrar_en = ML + 8.6 / 2)   # centrada en todo el panel, con la columna Top Two Box (C22)
mx <- which.max(sapply(comp4, ttb)); mn <- which.min(sapply(comp4, ttb))
narrativa(doc, 9.55, Y_DATOS + 0.8, 3.45, 3.4, list(N_("Los docentes valoran todas las competencias por encima de "), B(paste0(min(sapply(comp4, ttb)), "%")),
  N_(". La más alta es "), B(etq4[mx]), N_(paste0(" (", ttb(comp4[[mx]]), "%)")), N_(". La más baja, "), B(etq4[mn]), N_(paste0(" (", ttb(comp4[[mn]]), "%)."))))
pie(doc, "Base: 51 docentes")

# --- p_slide_grafico_texto_izquierda: lectura a la izquierda, gráfico a la derecha
MOTOR_ACT <- "p_slide_grafico_texto_izquierda: p_barras_agrupadas"
doc <- nueva(doc); titulo(doc, "Nivel curricular", ante = "Gráfico con texto a la izquierda")
cl <- D$ciclo; k1 <- which.max(cl$pct)
narrativa(doc, ML, Y_DATOS + 0.4, 3.45, 3.4, list(N_("La muestra se reparte entre los seis ciclos. El de mayor presencia es "), B(paste0(tolower(cl$labels[k1]), " (", cl$pct[k1], "%)")),
  N_(", y ningún ciclo baja de "), B(paste0(min(cl$pct), "%")), N_(".")))
panel_titulo(doc, 4.55, Y_DATOS + 0.1, 8.4, "¿Qué ciclo de la carrera está cursando actualmente?", "172 respuestas")
barras_h(doc, 4.55, Y_DATOS + 0.8, 8.4, cl$labels, cl$pct, wlab = 1.8, g = grosor_cat(6), fila = 0.62, size = 12)
pie(doc, "Base: 172 estudiantes")

# --- p_slide_2_graficos_texto_izquierda: lectura a la izquierda, dos gráficos a la derecha
MOTOR_ACT <- "p_slide_2_graficos_texto_izquierda: p_barras_agrupadas x2"
doc <- nueva(doc); titulo(doc, "Perfil del estudiante", ante = "Dos gráficos con texto a la izquierda")
g2 <- D$genero; r <- D$rango
narrativa(doc, ML, Y_DATOS + 0.4, 3.45, 3.6, list(N_("El estudiantado se reparte casi por igual entre "), B(paste0(tolower(g2$labels[1]), " (", g2$pct[1], "%)")), N_(" y "),
  B(paste0(tolower(g2$labels[2]), " (", g2$pct[2], "%)")), N_(". El "), B(paste0(r$pct[1] + r$pct[2], "%")), N_(" tiene entre 19 y 25 años.")))
xr <- 4.55; wr <- W - MR - xr
panel_titulo(doc, xr, Y_DATOS + 0.05, wr, "Sexo", "172 respuestas")
barras_h(doc, xr, Y_DATOS + 0.65, wr, g2$labels, g2$pct, wlab = 1.8, g = grosor_cat(2), fila = 0.5)
panel_titulo(doc, xr, Y_DATOS + 2.05, wr, "Rango de edades", "172 respuestas")
barras_h(doc, xr, Y_DATOS + 2.6, wr, r$labels, r$pct, wlab = 1.8, g = grosor_cat(4), fila = 0.46)
separador_h(doc, xr, W - MR, Y_DATOS + 1.85)   # C15; X6: debajo de la dicotómica, que termina en 1.65
pie(doc, "Base: 172 estudiantes")

# --- p_slide_2_graficos_texto_derecha: dos gráficos a la izquierda, lectura a la derecha
MOTOR_ACT <- "p_slide_2_graficos_texto_derecha: p_barras_multiapiladas x2 (dicotómica)"
doc <- nueva(doc); titulo(doc, "Situación laboral del egresado", ante = "Dos gráficos con texto a la derecha")
f11 <- fr("egresados", "p11"); f12 <- fr("egresados", "p12"); wl <- 8.6
panel_titulo(doc, ML, Y_DATOS + 0.05, wl, f11$pregunta)
likert_panel(doc, ML, Y_DATOS + 0.7, wl, list(list(lab = "Egresados", f = f11)), cols = TK$dico, ttb_col = FALSE, g = 0.5, fila = 0.8)
panel_titulo(doc, ML, Y_DATOS + 2.15, wl, f12$pregunta)
likert_panel(doc, ML, Y_DATOS + 2.8, wl, list(list(lab = "Egresados", f = f12)), cols = TK$dico, ttb_col = FALSE, g = 0.5, fila = 0.8)
leyenda(doc, 0, Y_DATOS + 4.25, f11$labels, TK$dico, centrar_en = ML + wl / 2)
narrativa(doc, 9.55, Y_DATOS + 0.4, 3.45, 3.4, list(B(paste0(f11$pct[1], "%")), N_(" de los egresados trabaja actualmente y, de ellos, el "), B(paste0(f12$pct[1], "%")),
  N_(" lo hace en un puesto relacionado con la contabilidad.")))
pie(doc, sprintf("Base: %d y %d egresados que respondieron", f11$valid, f12$valid))

# --- p_slide_2_graficos_vertical: dos gráficos apilados a lo ancho
MOTOR_ACT <- "p_slide_2_graficos_vertical: p_barras_multiapiladas x2 (var_cruce)"
doc <- nueva(doc); titulo(doc, "Servicios de tutoría", ante = "Dos gráficos apilados")
ta <- list(list(lab = "Docentes", f = fr("docentes", "p24_6")), list(lab = "Estudiantes", f = fr("estudiantes", "p17_5")))
ts <- list(list(lab = "Docentes", f = fr("docentes", "p24_7")), list(lab = "Estudiantes", f = fr("estudiantes", "p17_6")))
wv <- W - ML - MR
panel_titulo(doc, ML, Y_DATOS - 0.05, wv, "La Unidad cuenta con servicios de tutoría académica.")
likert_panel(doc, ML, Y_DATOS + 0.35, wv, ta, wlab = 1.6, g = 0.4, fila = 0.72)
panel_titulo(doc, ML, Y_DATOS + 2.2, wv, "La Unidad cuenta con servicios de tutoría socioemocional (bienestar estudiantil).")
likert_panel(doc, ML, Y_DATOS + 2.6, wv, ts, wlab = 1.6, g = 0.4, fila = 0.72)
leyenda(doc, 0, Y_DATOS + 4.5, LIKERT_ROT, TK$likert, centrar_en = W / 2)
pie(doc, "Base: 52 docentes y 172 estudiantes")

# --- p_slide_2_graficos_asimetrico: gráfico principal y gráfico de apoyo
MOTOR_ACT <- "p_slide_2_graficos_asimetrico: p_barras_multiapiladas (principal) + p_lollipop (apoyo)"
doc <- nueva(doc); titulo(doc, "Cuerpo académico", ante = "Gráfico principal y gráfico de apoyo")
cc <- lapply(c("p16_1", "p16_2", "p16_6", "p16_7"), function(v) fr("estudiantes", v))
lab_c <- vapply(cc, `[[`, "", "pregunta")   # texto completo: nada se trunca
o <- order(-sapply(cc, ttb)); cc <- cc[o]; lab_c <- lab_c[o]
wp_ <- 8.4
panel_titulo(doc, ML, Y_DATOS - 0.05, wp_, "Valoración del cuerpo académico, estudiantes")
FILA_A <- 1.02; G_A <- 0.4; Y0_A <- Y_DATOS + 0.3
likert_panel(doc, ML, Y0_A, wp_, lapply(seq_along(cc), function(i) list(lab = lab_c[i], f = cc[[i]])), wlab = 3.4, g = G_A, fila = FILA_A, size_lab = 10.5)
leyenda(doc, 0, Y0_A + 0.45 + length(cc) * FILA_A, LIKERT_ROT, TK$likert, centrar_en = ML + wp_ / 2)
# apoyo: ranking de Top Two Box (lollipop horizontal, eje desde cero)
xa <- 9.35; wa <- W - MR - xa
panel_titulo(doc, xa, Y_DATOS - 0.05, wa, "Top Two Box, de mayor a menor")
for (i in seq_along(cc)) { yc <- Y0_A + 0.3 + (i - 1) * FILA_A + (FILA_A - G_A) / 2 + 0.05 + G_A / 2   # mismo centro que la barra
  v <- ttb(cc[[i]]); xv <- xa + 0.15 + (wa - 0.9) * v / 100
  caja(doc, xa + 0.15, yc - 0.01, xv - xa - 0.15, 0.02, TK$faint); caja(doc, xv - 0.1, yc - 0.1, 0.2, 0.2, TK$navy, geom = "ellipse")
  txt(doc, paste0(v, "%"), xv + 0.14, yc - 0.15, 0.6, 0.28, 12, TK$navy, bold = TRUE) }
caja(doc, xa + 0.15, Y0_A + 0.3, 0.008, length(cc) * FILA_A, TK$rule)
zona("apoyo: ranking alineado a las filas", xa, Y0_A + 0.3, wa, length(cc) * FILA_A)
pie(doc, "Base: 172 estudiantes")
