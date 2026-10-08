# Capítulo 1, láminas nuevas de la propuesta de diseño (2026-10-08): la lámina estándar medida, la escala tipográfica, portadas
# alternativas y las dos alternativas de objetivo. Claves «reg2:n»; el orden lo da recetario_estructura.json.
SEC <- "reg2"

# 1. La lámina estándar medida (X3 y X4, 2026-10-08): sobre una escala que sí lleva leyenda y Top Two Box, y con el grosor de barra según el número de filas
MOTOR_ACT <- "Reglas: la lámina estándar de un gráfico (p_slide_1_grafico, layout Graficos)"
doc <- nueva(doc); titulo(doc, "Servicios de tutoría", ante = "Medidas de la lámina estándar")
sf_m <- function(pct, valid) list(pct = pct, n = round(pct * valid / 100), valid = valid)
txt(doc, "La Unidad cuenta con servicios de tutoría académica", XT, YT - 0.05, AC, 0.3, 13, TK$navy, bold = TRUE)
# Las barras siguen su propia tabla: tres filas de escala, 1.22 cm (Gonzalo, 2026-10-08: medidas en cm y qué es «escala» y qué «categorías»)
yfin_ <- likert_panel(doc, XC, YT + 0.25, AC, list(list(lab = "Docentes", f = sf_m(c(6, 8, 29, 42, 15), 52)), list(lab = "Estudiantes", f = sf_m(c(6, 18, 34, 19, 23), 172)),
  list(lab = "Egresados", f = sf_m(c(6, 12, 47, 30, 5), 178))), g = grosor_apilada(3), fila = grosor_apilada(3) + 0.2, wlab = 1.5, size_lab = 12)
leyenda(doc, 0, yfin_ + 0.02, LIKERT_ROT, TK$likert, centrar_en = XC + AC / 2)
y_t <- yfin_ + 0.42; separador_h(doc, XC, W - MR, y_t)
med <- list(c("Título", "24 pt, coral, a 0.91 cm del borde"), c("Antetítulo", "10 pt, gris, sobre el título"), c("Pregunta", "13 pt, al inicio de la zona de datos"),
            c("Zona de datos", "de 4.19 a 16.31 cm de alto"), c("Cifra en la barra", "14 pt, o 12 pt encima si no cabe"), c("Top Two Box", "14 pt, verde, columna de 2.54 cm"),
            c("Leyenda", "12 pt, centrada bajo el gráfico"), c("Base", "10 pt, negrita, a 17.48 cm"))
wcol <- (AC - 0.8) / 3; xcol <- XC + (0:2) * (wcol + 0.4)
txt(doc, "Medidas", xcol[1] - 0.1, y_t + 0.06, wcol, 0.28, 11, TK$soft, bold = TRUE)
for (k in seq_along(med)) { cc <- if (k <= 4) 1 else 2; yk <- y_t + 0.38 + ((k - 1) %% 4) * 0.32
  txt(doc, med[[k]][1], xcol[cc] - 0.1, yk, 1.5, 0.28, 11, TK$navy, bold = TRUE); txt(doc, med[[k]][2], xcol[cc] + 1.35, yk, wcol - 1.35, 0.28, 11, TK$soft) }
separador_v(doc, xcol[3] - 0.2, y_t + 0.12, YF - 0.05)
txt(doc, "Grosor de barra según el número de filas", xcol[3] - 0.1, y_t + 0.06, wcol + 0.1, 0.28, 11, TK$soft, bold = TRUE)
# Dos columnas con su muestra: la escala es una barra apilada al 100 % (Likert o Sí y No) y la categoría, una barra simple por opción
gr_ <- list(c("1 o 2", 0.50, 0.26), c("3", 0.48, 0.26), c("4 a 6", 0.44, 0.28), c("7 a 9", 0.38, 0.32), c("10 o más", 0.32, 0.32))
xe_ <- xcol[3] + 0.75; xk_ <- xcol[3] + 2.2
txt(doc, "Filas", xcol[3] - 0.1, y_t + 0.34, 0.8, 0.24, 9.5, TK$soft, bold = TRUE)
txt(doc, "Escala apilada", xe_ - 0.05, y_t + 0.34, 1.45, 0.24, 9.5, TK$soft, bold = TRUE); txt(doc, "Categorías", xk_ - 0.05, y_t + 0.34, 1.4, 0.24, 9.5, TK$soft, bold = TRUE)
for (k in seq_along(gr_)) { yk <- y_t + 0.62 + (k - 1) * 0.27; ge <- as.numeric(gr_[[k]][2]); gc <- as.numeric(gr_[[k]][3])
  txt(doc, gr_[[k]][1], xcol[3] - 0.1, yk, 0.85, 0.24, 10.5, TK$navy, bold = TRUE)
  xx_ <- xe_; for (j in 1:4) { caja(doc, xx_, yk + 0.12 - ge * 0.18, 0.13, ge * 0.36, TK$likert[j]); xx_ <- xx_ + 0.13 }
  txt(doc, paste(cm(ge), "cm"), xe_ + 0.56, yk, 0.85, 0.24, 10, TK$navy)
  caja(doc, xk_, yk + 0.12 - gc * 0.18, 0.4, gc * 0.36, TK$navy); txt(doc, paste(cm(gc), "cm"), xk_ + 0.46, yk, 0.85, 0.24, 10, TK$navy) }
pie(doc, "Base: 52 docentes, 172 estudiantes y 178 egresados. Escala apilada: una barra al 100 % por público. Categorías: una barra por opción")

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

# 7. Las paletas en uso (Gonzalo, 2026-10-08: «le falta una diapositiva que ejemplifique cada paleta»). Va después de «Los colores y lo que significan»
MOTOR_ACT <- "Reglas: cada paleta aplicada a su tipo de gráfico"
doc <- nueva(doc); titulo(doc, "Las paletas en uso", ante = "Reglas de la lámina")
wq <- (AC - 0.6) / 2; xq <- c(XC, XC + wq + 0.6); yq <- c(YT - 0.1, YT + 2.62)
separador_v(doc, xq[2] - 0.3, YT - 0.1, YF - 0.1); separador_h(doc, XC, W - MR, yq[2] - 0.12)
# Escala Likert
panel_titulo(doc, xq[1], yq[1], wq, "Escala Likert de cinco puntos", "Del desacuerdo al acuerdo, con Sin información al final")
yl_ <- likert_panel(doc, xq[1], yq[1] + 0.5, wq, list(list(lab = "Docentes", f = sf_m(c(7, 10, 50, 21, 12), 52)), list(lab = "Estudiantes", f = sf_m(c(6, 18, 34, 19, 23), 172))),
  g = 0.4, fila = 0.6, wlab = 1.2, size_lab = 12)
leyenda(doc, 0, yl_ + 0.0, c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información"), TK$likert, centrar_en = xq[1] + wq / 2, size = 9)
# Dicotómica
panel_titulo(doc, xq[2], yq[1], wq, "Dicotómica", "Sí en azul oscuro y No en celeste")
dicotomia(doc, xq[2], yq[1] + 0.75, wq - 0.3, c("Sí", "No"), c(64, 36), n = c(114, 64), size = 26, g = 0.5)
# Actores
panel_titulo(doc, xq[1], yq[2], wq, "Actores", "Cada público con su color en todo el informe")
act_ <- c(Docentes = "#0B4F8C", Estudiantes = "#2A9D8F", Egresados = "#E9C46A", Autoridades = "#8E9DBD", Administrativos = "#081F5C", Empleadores = "#9DC3E6"); va_ <- c(98, 77, 81, 100, 88, 62)
for (k in seq_along(act_)) { yk <- yq[2] + 0.52 + (k - 1) * 0.32; wbk <- (wq - 1.9 - 0.7) * va_[k] / 100
  txt(doc, names(act_)[k], xq[1], yk, 1.75, 0.28, 11, TK$navy, bold = TRUE, align = "right")
  caja(doc, xq[1] + 1.87, yk + 0.03, wbk, 0.24, act_[k]); txt(doc, paste0(va_[k], "%"), xq[1] + 1.92 + wbk, yk - 0.01, 0.7, 0.3, 12, TK$navy, bold = TRUE) }
# Texto y realce
panel_titulo(doc, xq[2], yq[2], wq, "Texto, títulos y realce", "Coral sólo en títulos, verde sólo en Top Two Box")
txt(doc, "Servicios de tutoría", xq[2], yq[2] + 0.55, wq, 0.4, 20, TK$coral, bold = TRUE)
txt(doc, "83%", xq[2], yq[2] + 0.98, 1.3, 0.5, 26, TK$verde_txt, bold = TRUE); txt(doc, "Top Two Box de los docentes", xq[2] + 1.3, yq[2] + 1.1, wq - 1.3, 0.3, 12, TK$navy)
barras_h(doc, xq[2], yq[2] + 1.55, wq, c("Tutoría académica", "Tutoría socioemocional", "Orientación vocacional"), c(46, 31, 23), wlab = 1.9, g = 0.24, fila = 0.36, size = 11)
zona("cuatro paletas, cada una en su gráfico", XC, YT - 0.1, AC, YF - YT)
pie(doc, "La barra mayor en azul oscuro y las demás en el tono de apoyo. Cifras ilustrativas")
