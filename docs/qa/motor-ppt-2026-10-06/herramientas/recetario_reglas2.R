# Capítulo 1, láminas nuevas de la propuesta de diseño (2026-10-08): la lámina estándar medida, la escala tipográfica, portadas
# alternativas y las dos alternativas de objetivo. Claves «reg2:n»; el orden lo da recetario_estructura.json.
SEC <- "reg2"

# 1. La lámina estándar de un gráfico, con sus medidas al lado
MOTOR_ACT <- "Reglas: la lámina estándar de un gráfico (p_slide_1_grafico, layout Graficos)"
doc <- nueva(doc); titulo(doc, "Nivel curricular del estudiante", ante = "La lámina estándar")
wch <- 8.0
panel_titulo(doc, XC, YT, wch, "¿Qué ciclo de la carrera está cursando actualmente?", "172 respuestas")
barras_h(doc, XC, YT + 0.65, wch, es_ciclo$labels, es_ciclo$pct, wlab = 1.7, g = grosor_cat(6), fila = 0.66, size = 12)
xm_ <- XC + wch + 0.6; wm_ <- W - MR - xm_; separador_v(doc, xm_ - 0.3, YT, YF - 0.1)
txt(doc, "Medidas de la lámina estándar", xm_ - 0.1, YT, wm_ + 0.1, 0.3, 13, TK$navy, bold = TRUE)
med <- list(c("Título", "24 pt, a 0.36 in del borde"), c("Antetítulo", "10 pt, sobre el título"), c("Pregunta", "13 pt, inicio de la zona de datos"),
            c("Zona de datos", "de 1.65 a 6.42 in de alto"), c("Cifra en la barra", "14 pt, 12 pt si va fuera"), c("Barra", "0.42 in con hasta 6 categorías"),
            c("Leyenda", "12 pt, centrada en el gráfico"), c("Base", "10 pt, a 6.88 in"), c("Márgenes", "0.5 in a cada lado"))
for (k in seq_along(med)) { yk <- YT + 0.45 + (k - 1) * 0.47
  txt(doc, med[[k]][1], xm_ - 0.1, yk, 1.6, 0.28, 11, TK$navy, bold = TRUE); txt(doc, med[[k]][2], xm_ + 1.45, yk, wm_ - 1.45, 0.28, 11, TK$soft) }
pie(doc, "Base: 172 estudiantes. Todos los gráficos del capítulo 2 usan esta lámina y estas medidas")

# 2. Escala tipográfica
MOTOR_ACT <- "Reglas: escala tipográfica estándar"
doc <- nueva(doc); titulo(doc, "Escala tipográfica", ante = "Reglas de la lámina")
esc <- list(list("Cifra destacada", "98 %", 34, TK$navy, TRUE, "34 pt, negrita, azul oscuro"),
            list("Título de la lámina", "Satisfacción con el servicio", 24, TK$coral, TRUE, "24 pt, negrita, coral"),
            list("Texto de análisis", "El 75 % de los docentes está de acuerdo", 15, TK$navy, FALSE, "14 a 15 pt, con las cifras en negrita"),
            list("Cifra en la barra", "54 %", 14, TK$navy, TRUE, "14 pt, negrita"),
            list("Pregunta o premisa", "La Unidad cuenta con servicios de tutoría", 13, TK$navy, TRUE, "13 pt, negrita, azul oscuro"),
            list("Leyenda y rótulos", "Totalmente de acuerdo", 12, TK$navy, FALSE, "12 pt, azul oscuro"),
            list("Antetítulo", "CARACTERÍSTICAS INSTITUCIONALES", 10, TK$soft, TRUE, "10 pt, negrita, gris, mayúsculas"),
            list("Base y nota", "Base: 52 docentes y 172 estudiantes", 10, TK$navy, TRUE, "10 pt, negrita, azul oscuro"))
yk <- YT - 0.05
for (e_ in esc) { h_ <- max(0.42, e_[[3]] * 1.3 / 72 + 0.1)
  txt(doc, e_[[1]], XT, yk + (h_ - 0.28) / 2, 2.6, 0.28, 11, TK$soft, bold = TRUE)
  txt(doc, e_[[2]], XC + 2.6, yk + (h_ - e_[[3]] * 1.3 / 72) / 2 - 0.04, 6.4, e_[[3]] * 1.3 / 72 + 0.1, e_[[3]], e_[[4]], bold = e_[[5]])
  txt(doc, e_[[6]], XC + 9.1, yk + (h_ - 0.28) / 2, W - MR - XC - 9.1, 0.28, 11, TK$navy)
  yk <- yk + h_ + 0.06; separador_h(doc, XC, W - MR, yk - 0.03) }
pie(doc, "Arial en todo el informe. Ningún texto baja de 10 pt")

# 3 y 4. Portadas alternativas, en la misma línea de la portada (logos arriba, título como protagonista)
tp <- "Estudio de opinión sobre el servicio educativo de la carrera de Contabilidad"
# La plantilla de portada trae una línea coral fija en y = 4.21 in (x de 1.18 a 12.15): el título va arriba de ella y el encargo debajo.
MOTOR_ACT <- "PROPUESTA: portada alineada a la izquierda (p_slide_portada)"
doc <- nueva(doc, "Title Slide")
txt(doc, "INFORME CONSOLIDADO", 1.08, 2.25, 8, 0.32, 13, TK$coral, bold = TRUE)
txt(doc, tp, 1.08, 2.62, 9.6, 1.3, 30, TK$navy, bold = TRUE)
txt(doc, "Por encargo de la Facultad de Ciencias Contables", 1.08, 4.45, 9.6, 0.36, 16, TK$navy)
txt(doc, "Setiembre de 2026", 1.08, 4.85, 9.6, 0.34, 14, TK$soft)
zona("portada alineada a la izquierda, la línea de la plantilla separa título y encargo", 1.18, 2.25, 9.6, 2.95); dibujar_guias(doc)
MOTOR_ACT <- "PROPUESTA: portada con banda inferior (p_slide_portada)"
doc <- nueva(doc, "Title Slide")
txt(doc, "INFORME CONSOLIDADO", 1.6, 2.25, 10.1, 0.32, 13, TK$coral, bold = TRUE, align = "center")
txt(doc, tp, 1.4, 2.62, 10.5, 1.3, 30, TK$navy, bold = TRUE, align = "center")
caja(doc, 0, H - 1.25, W, 1.25, TK$navy)
txt(doc, "Por encargo de la Facultad de Ciencias Contables", 1.6, H - 0.95, 10.1, 0.34, 15, "#FFFFFF", bold = TRUE, align = "center")
txt(doc, "Setiembre de 2026", 1.6, H - 0.58, 10.1, 0.3, 13, "#FFFFFF", align = "center")
zona("portada con banda", 0, H - 1.25, W, 1.25); dibujar_guias(doc)

# 5 y 6. Objetivo, alternativas B (panel azul) y C (desglosado); la A es la del informe tipo
obj <- "Conocer la percepción sobre los propósitos de la carrera de Contabilidad, su perfil de egreso, su plan de estudios y otras dimensiones relevantes para la acreditación, a partir de la opinión de estudiantes, docentes, egresados(as), personal administrativo, Comité Consultivo y empleadores(as)."
actores6 <- list(c("graduation-cap", "Estudiantes"), c("presentation", "Docentes"), c("briefcase", "Egresados"),
                 c("building-2", "Personal administrativo"), c("users", "Comité Consultivo"), c("briefcase-business", "Empleadores"))
MOTOR_ACT <- "PROPUESTA: objetivo con panel azul (p_slide_objetivo_icono)"
doc <- nueva(doc); wp <- 4.4
caja(doc, 0, 0, wp, H, TK$navy); icono(doc, "diana-flecha", "blanco", 0.75, 1.75, 1.15)
txt(doc, "Objetivo del estudio", 0.75, 3.15, wp - 1.1, 1.3, 32, "#FFFFFF", bold = TRUE); caja(doc, 0.75, 4.6, 0.9, 0.06, TK$coral)
xo <- wp + 0.6; wo <- W - MR - xo
txt(doc, obj, xo, 1.55, wo, 2.6, 20, TK$navy); separador_h(doc, xo, W - MR, 4.3)
txt(doc, "Actores consultados", xo, 4.45, wo, 0.32, 12, TK$soft, bold = TRUE); wa <- wo / 3
for (k in seq_along(actores6)) { xa <- xo + ((k - 1) %% 3) * wa; ya <- 4.95 + ((k - 1) %/% 3) * 0.9
  icono_en_circulo(doc, actores6[[k]][1], xa, ya, 0.58); txt(doc, actores6[[k]][2], xa + 0.68, ya + 0.1, wa - 0.7, 0.42, 13, TK$navy, bold = TRUE) }
zona("objetivo con panel", xo, 1.55, wo, 4.5); dibujar_guias(doc)
MOTOR_ACT <- "PROPUESTA: objetivo desglosado (p_slide_objetivo_icono)"
doc <- nueva(doc)
icono_en_circulo(doc, "diana-flecha", XC, 0.62, 0.62, fondo = TK$coral); txt(doc, "Objetivo del estudio", XC + 0.8, 0.7, 6, 0.45, 20, TK$coral, bold = TRUE)
txt(doc, "Conocer la percepción sobre", XT, 1.55, AC, 0.45, 18, TK$navy, bold = TRUE)
temas <- list(c("goal", "Los propósitos de la carrera"), c("graduation-cap", "El perfil de egreso"), c("book-open", "El plan de estudios"), c("award", "Otras dimensiones de la acreditación"))
gap <- 0.25; wt <- (AC - gap * 3) / 4
for (k in seq_along(temas)) { xk <- XC + (k - 1) * (wt + gap)
  caja(doc, xk, 2.1, wt, 1.35, "#FFFFFF"); caja(doc, xk, 2.1, wt, 0.06, TK$navy); icono(doc, temas[[k]][1], "navy", xk + 0.25, 2.38, 0.42)
  txt(doc, temas[[k]][2], xk + 0.25, 2.86, wt - 0.45, 0.55, 14, TK$navy, bold = TRUE) }
txt(doc, "a partir de la opinión de", XT, 3.85, AC, 0.45, 18, TK$navy, bold = TRUE)
wa <- AC / 6; for (k in seq_along(actores6)) { xa <- XC + (k - 1) * wa
  icono_en_circulo(doc, actores6[[k]][1], xa + (wa - 0.72) / 2, 4.45, 0.72); txt(doc, actores6[[k]][2], xa, 5.25, wa, 0.5, 13, TK$navy, bold = TRUE, align = "center") }
pie(doc, "Carrera de Contabilidad. Proceso de acreditación 2026")
