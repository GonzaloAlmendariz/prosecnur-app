# Recetario: disposiciones de tres y cuatro gráficos (loop M2b).
# Se carga desde recetario.R después de recetario_m2.R; usa likert_panel() y narrativa().
# --- p_slide_3_graficos_2mas1: dos apilados a la izquierda y uno alto a la derecha
MOTOR_ACT <- "p_slide_3_graficos_2mas1: p_barras_multiapiladas (dicotómica) + p_barras_agrupadas x2"
doc <- nueva(doc); titulo(doc, "Titulación e ingresos del egresado", ante = "Tres gráficos: dos apilados y uno alto")
t1 <- D$titulo; a <- D$anio; s <- D$sueldo
panel_titulo(doc, ML, YT, col2, "¿Cuenta con título universitario?", paste(t1$valid, "respuestas"))
likert_panel(doc, ML, YT + 0.45, col2, list(list(lab = "Egresados", f = list(pct = t1$pct))), cols = TK$dico, ttb_col = FALSE, g = 0.5, fila = 0.85, wlab = 1.2)
leyenda(doc, 0, YT + 1.65, t1$labels, TK$dico, centrar_en = ML + 1.3 + (col2 - 1.3) / 2)
separador_h(doc, ML, ML + col2, YT + 2.15)
panel_titulo(doc, ML, YT + 2.35, col2, "¿En qué año obtuvo su título universitario?", paste(a$valid, "egresados titulados"))
barras_h(doc, ML, YT + 2.95, col2, a$labels, a$pct, wlab = 1.2, g = grosor_cat(5), fila = 0.36)
separador_v(doc, ML + col2 + GAP / 2, YT, YF)
xr <- ML + col2 + GAP
panel_titulo(doc, xr, YT, col2, "Sueldo mensual bruto", paste(s$valid, "respuestas"))
barras_h(doc, xr, YT + 0.75, col2, s$labels, s$pct, wlab = 2.5, g = grosor_cat(6), fila = 0.68, size = 12)
pie(doc, sprintf("Base: %d egresados. Año de titulación, %d que tienen título. Sueldo, %d que respondieron", t1$valid, a$valid, s$valid))

# --- p_slide_3_graficos_1mas2: uno alto a la izquierda y dos apilados a la derecha
MOTOR_ACT <- "p_slide_3_graficos_1mas2: p_barras_agrupadas x3"
doc <- nueva(doc); titulo(doc, "Perfil del docente", ante = "Tres gráficos: uno alto y dos apilados")
dep <- fr("docentes", "p7"); sx <- fr("docentes", "p5"); ed <- fr("docentes", "p4_recod")
panel_titulo(doc, ML, YT, col2, "Departamento académico al que pertenece", paste(dep$valid, "respuestas"))
barras_h(doc, ML, YT + 0.8, col2, dep$labels, dep$pct, wlab = 2.6, g = grosor_cat(4), fila = 0.95, size = 12)
separador_v(doc, ML + col2 + GAP / 2, YT, YF)
panel_titulo(doc, xr, YT, col2, "Sexo", paste(sx$valid, "respuestas"))
barras_h(doc, xr, YT + 0.6, col2, sx$labels, sx$pct, wlab = 1.6, g = grosor_cat(2), fila = 0.5)
separador_h(doc, xr, xr + col2, YT + 1.85)
panel_titulo(doc, xr, YT + 2.05, col2, "Rango de edades", paste(ed$valid, "respuestas"))
barras_h(doc, xr, YT + 2.65, col2, ed$labels, ed$pct, wlab = 1.6, g = grosor_cat(4), fila = 0.5)
pie(doc, "Base: 52 docentes")

# --- p_slide_3_graficos_1arriba: uno ancho arriba y dos abajo
MOTOR_ACT <- "p_slide_3_graficos_1arriba: p_barras_multiapiladas (var_cruce) + p_barras_multiapiladas x2 (dicotómica)"
doc <- nueva(doc); titulo(doc, "Tutoría y misión institucional", ante = "Tres gráficos: uno ancho arriba")
ta <- list(list(lab = "Docentes", f = fr("docentes", "p24_6")), list(lab = "Estudiantes", f = fr("estudiantes", "p17_5")))
panel_titulo(doc, ML, YT - 0.05, ANCHO, "La Unidad cuenta con servicios de tutoría académica.")
likert_panel(doc, ML, YT + 0.3, ANCHO, ta, wlab = 1.6, g = 0.38, fila = 0.66)
leyenda(doc, 0, YT + 1.95, LIKERT_ROT, TK$likert, centrar_en = W / 2)
separador_h(doc, ML, W - MR, YT + 2.4)
act3 <- c("Docentes", "Estudiantes", "Egresados")
for (k in 1:2) { bq <- if (k == 1) D$mision1 else D$mision2; x <- if (k == 1) ML else xr
  panel_titulo(doc, x, YT + 2.55, col2, bq[[1]]$pregunta)
  likert_panel(doc, x, YT + 2.75, col2, lapply(1:3, function(i) list(lab = act3[i], f = bq[[i]])), cols = TK$dico, ttb_col = FALSE, g = 0.3, fila = 0.5, wlab = 1.3, size_lab = 10.5) }
leyenda(doc, 0, YF - 0.05, c("Sí", "No"), TK$dico, centrar_en = W / 2)
pie(doc, "Base: 52 docentes, 172 estudiantes y 178 egresados")

# --- p_slide_4_graficos: cuadrícula de 2 x 2
MOTOR_ACT <- "p_slide_4_graficos: p_barras_agrupadas x3 + p_barras_multiapiladas (dicotómica)"
doc <- nueva(doc); titulo(doc, "Perfil del docente: formación y trayectoria", ante = "Cuatro gráficos")
gr <- fr("docentes", "p6"); h2 <- (YF - YT - 0.35) / 2
celdas <- list(list(x = ML, y = YT), list(x = xr, y = YT), list(x = ML, y = YT + h2 + 0.35), list(x = xr, y = YT + h2 + 0.35))
separador_v(doc, ML + col2 + GAP / 2, YT, YF); separador_h(doc, ML, W - MR, YT + h2 + 0.15)
pintar <- list(
  function(c) { panel_titulo(doc, c$x, c$y, col2, "Máximo grado alcanzado", paste(gr$valid, "respuestas")); barras_h(doc, c$x, c$y + 0.55, col2, gr$labels, gr$pct, wlab = 1.6, g = grosor_cat(3), fila = 0.42) },
  function(c) { panel_titulo(doc, c$x, c$y, col2, "Departamento académico", paste(dep$valid, "respuestas")); barras_h(doc, c$x, c$y + 0.55, col2, dep$labels, dep$pct, wlab = 2.6, g = grosor_cat(4), fila = 0.42, size = 11) },
  function(c) { panel_titulo(doc, c$x, c$y, col2, "Rango de edades", paste(ed$valid, "respuestas")); barras_h(doc, c$x, c$y + 0.55, col2, ed$labels, ed$pct, wlab = 1.6, g = grosor_cat(4), fila = 0.42) },
  function(c) { panel_titulo(doc, c$x, c$y, col2, "¿Conoce la misión y los propósitos de la PUCP?", "52 respuestas")
    m1 <- D$mision1[[1]]
    if (ESTILO == "moderna") dicotomia(doc, c$x, c$y + 0.65, min(col2, 5.2), c("Sí", "No"), m1$pct[1:2], size = 22, g = 0.34) else {
    likert_panel(doc, c$x, c$y + 0.25, col2, list(list(lab = "Docentes", f = m1)), cols = TK$dico, ttb_col = FALSE, g = 0.42, fila = 0.75, wlab = 1.2)
    leyenda(doc, 0, c$y + 1.35, c("Sí", "No"), TK$dico, centrar_en = c$x + 1.3 + (col2 - 1.3) / 2) } })
for (k in 1:4) pintar[[k]](celdas[[k]])
pie(doc, "Base: 52 docentes")
