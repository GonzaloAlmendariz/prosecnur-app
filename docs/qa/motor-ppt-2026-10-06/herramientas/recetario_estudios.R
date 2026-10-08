# Capítulo 4, láminas nuevas de estudios frecuentes en PULSO (censo de proyectos .pulso del 2026-10-08). Cifras ficticias y sin nombrar
# instituciones ni clientes (Gonzalo: «cifras ficticias sin mencionar la institución»). Claves «est:n».
SEC <- "est"
sf_ <- function(pct, valid) list(pct = pct, n = round(pct * valid / 100), valid = valid)
wil_ <- function(x, n, z) { p <- x / n; c_ <- (p + z^2 / (2 * n)) / (1 + z^2 / n); h <- z * sqrt(p * (1 - p) / n + z^2 / (4 * n^2)) / (1 + z^2 / n); c(c_ - h, c_ + h) }
newc_ <- function(x1, n1, x2, n2, z = 1.96) { p1 <- x1 / n1; p2 <- x2 / n2; a <- wil_(x1, n1, z); b <- wil_(x2, n2, z); d <- p1 - p2
  c(d - sqrt((p1 - a[1])^2 + (b[2] - p2)^2), d + sqrt((a[2] - p1)^2 + (p2 - b[1])^2)) }
FIC <- "Cifras ficticias."

# 4.1 Acreditación con varios programas
prog <- c("Ingeniería industrial", "Ingeniería civil", "Ingeniería informática", "Ingeniería mecánica", "Ingeniería electrónica", "Ingeniería química",
          "Ingeniería mecatrónica", "Ingeniería de minas", "Ingeniería de telecomunicaciones")
ttbp <- c(91, 88, 86, 84, 81, 79, 77, 74, 72)
MOTOR_ACT <- "p_slide_1_grafico: p_barras_agrupadas por programa (multibase, una base por programa)"
doc <- nueva(doc); titulo(doc, "Satisfacción con la formación recibida, por programa", ante = "Acreditación con varios programas")
panel_titulo(doc, XC, YT, 8.6, "Me siento satisfecho con la formación recibida en la carrera", "Top Two Box por programa")
barras_h(doc, XC, YT + 0.6, 8.6, prog, ttbp, wlab = 3.0, g = 0.3, fila = 0.46, size = 12, escala = 100)
separador_v(doc, XC + 9.0, YT, YF - 0.2)
xc9 <- XC + 9.35; wc9 <- W - MR - xc9
txt(doc, "82 %", xc9 - 0.1, YT + 0.3, wc9 + 0.1, 0.65, 34, TK$navy, bold = TRUE); txt(doc, "de satisfacción en los nueve programas", xc9 - 0.1, YT + 0.95, wc9 + 0.1, 0.5, 12, TK$navy, bold = TRUE)
txt(doc, "promedio ponderado por base", xc9 - 0.1, YT + 1.45, wc9 + 0.1, 0.28, 10, TK$soft)
narrativa(doc, XC + 9.35, YT + 1.8, W - MR - XC - 9.35, 2.0, list(N_("La distancia entre el programa más alto y el más bajo es de "), B("19 puntos"), N_(". Cada programa es una base del estudio.")), size = 13)
pie(doc, paste(FIC, "Base: entre 48 y 140 egresados por programa"))

MOTOR_ACT <- "p_slide_1_grafico: p_dim_heatmap por programa"
doc <- nueva(doc); titulo(doc, "Tres dimensiones de la formación, por programa", ante = "Acreditación con varios programas")
dimn <- c("Competencias técnicas", "Formación práctica", "Vínculo con el medio"); set.seed(3)
Mh <- sapply(1:3, function(j) pmin(98, pmax(60, ttbp + c(2, -6, -11)[j] + round(rnorm(9, 0, 3))))); lohi <- c(55, 100)
xl <- XC + 3.2; wc <- (W - MR - xl) / 3; hc <- (YF - YT - 1.2) / 9
for (j in 1:3) txt(doc, dimn[j], xl + (j - 1) * wc, YT - 0.05, wc, 0.3, 12, TK$navy, bold = TRUE, align = "center")
for (i in 1:9) { yi <- YT + 0.35 + (i - 1) * hc; txt(doc, prog[i], XC - 0.1, yi + (hc - 0.28) / 2, 3.1, 0.28, 11.5, TK$navy, bold = TRUE, align = "right")
  for (j in 1:3) { fc <- calor(Mh[i, j], lohi[1], lohi[2]); caja(doc, xl + (j - 1) * wc + 0.03, yi + 0.02, wc - 0.06, hc - 0.04, fc)
    txt(doc, paste0(Mh[i, j], "%"), xl + (j - 1) * wc, yi + (hc - 0.28) / 2, wc, 0.28, 12, texto_sobre(fc), bold = TRUE, align = "center") } }
escala_calor(doc, xl + 1.5 * wc, YT + 0.45 + 9 * hc, lohi[1], lohi[2])
pie(doc, paste(FIC, "Top Two Box promedio de los ítems de cada dimensión"))

# 4.2 Línea base
MOTOR_ACT <- "p_slide_cifras_y_graficos: indicadores de línea base"
doc <- nueva(doc); titulo(doc, "Indicadores de la línea base", ante = "Opinión pública y línea base")
ind <- list(c("vote", "38 %", "confía en el gobierno local", "1,200 entrevistas"), c("users", "61 %", "participó en una actividad comunitaria", "en el último año"),
            c("shield-check", "47 %", "se siente seguro en su barrio de noche", "mujeres 39 %, hombres 55 %"), c("smartphone", "72 %", "hizo un trámite por internet", "en los últimos seis meses"))
gp <- 0.4; wc4 <- (AC - 3 * gp) / 4
for (k in 1:4) { x <- XC + (k - 1) * (wc4 + gp); if (k > 1) separador_v(doc, x - gp / 2, YT + 0.2, YT + 3.0)
  icono_en_circulo(doc, ind[[k]][1], x, YT + 0.3, 0.6); txt(doc, ind[[k]][2], x - 0.1, YT + 1.1, wc4 + 0.1, 0.75, 40, TK$navy, bold = TRUE)
  txt(doc, ind[[k]][3], x - 0.1, YT + 1.85, wc4 + 0.1, 0.5, 12, TK$navy, bold = TRUE); txt(doc, ind[[k]][4], x - 0.1, YT + 2.4, wc4 + 0.1, 0.3, 10, TK$soft) }
separador_h(doc, XC, W - MR, YT + 3.4)
txt(doc, "Estas cifras son el punto de partida. La próxima medición se compara contra ellas con la misma pregunta y la misma escala.", XT, YT + 3.6, AC, 0.6, 13, TK$navy, bold = TRUE)
pie(doc, paste(FIC, "Base: 1,200 entrevistas, muestra probabilística"))

# 4.4 Monitoreo posdistribución
MOTOR_ACT <- "p_slide_grafico_texto_derecha: p_barras_agrupadas (opción múltiple)"
doc <- nueva(doc); titulo(doc, "Uso principal de la asistencia en efectivo", ante = "Monitoreo posdistribución")
panel_titulo(doc, XC, YT, 7.8, "¿En qué usó la asistencia que recibió?", "Opción múltiple, 640 hogares")
barras_h(doc, XC, YT + 0.6, 7.8, c("Alimentos", "Alquiler de vivienda", "Salud y medicinas", "Educación", "Pago de deudas", "Otros"), c(62, 41, 23, 15, 12, 6), wlab = 2.3, g = grosor_cat(6), fila = 0.6, size = 12, escala = 75)
narrativa(doc, 8.9, YT + 0.6, W - MR - 8.9, 2.6, list(N_("Seis de cada diez hogares usaron la asistencia en "), B("alimentos"), N_(" y cuatro de cada diez en el "), B("alquiler"), N_(".")), size = 14)
pie(doc, paste(FIC, "Base: 640 hogares. Opción múltiple: los porcentajes suman más de 100"))
MOTOR_ACT <- "p_slide_1_grafico: p_barras_multiapiladas por modalidad"
doc <- nueva(doc); titulo(doc, "Satisfacción con la entrega, por modalidad", ante = "Monitoreo posdistribución")
panel_titulo(doc, XC, YT, AC, "¿Qué tan satisfecho está con la forma en que recibió la asistencia?")
likert_panel(doc, XC, YT + 0.5, AC, list(list(lab = "Transferencia", f = sf_(c(3, 7, 48, 40, 2), 310)), list(lab = "Retiro en agencia", f = sf_(c(8, 15, 51, 24, 2), 190)),
  list(lab = "Tarjeta prepagada", f = sf_(c(5, 11, 50, 31, 3), 140))), g = 0.42, fila = 0.85, wlab = 2.0, size_lab = 13)
leyenda(doc, 0, YT + 3.6, c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho", "No sabe"), TK$likert, centrar_en = W / 2)
pie(doc, paste(FIC, "Base: 310, 190 y 140 hogares por modalidad"))

# 4.5 Encuesta en aulas
MOTOR_ACT <- "PROPUESTA: aulas aplicadas frente a las previstas (avance de campo cerrado)"
doc <- nueva(doc); titulo(doc, "Aulas aplicadas frente a las previstas, por facultad", ante = "Encuesta en aulas")
fac <- c("Ciencias Sociales", "Derecho", "Ingeniería", "Arquitectura", "Educación", "Artes", "Ciencias Contables"); prev <- c(24, 18, 30, 12, 10, 8, 14); apl <- c(24, 17, 27, 12, 9, 6, 14)
xb <- XC + 2.8; wb <- 7.2; mx <- max(prev)
for (i in seq_along(fac)) { yi <- YT + 0.2 + (i - 1) * 0.6
  txt(doc, fac[i], XC - 0.1, yi + 0.02, 2.75, 0.3, 12, TK$navy, bold = TRUE, align = "right")
  caja(doc, xb, yi, wb * prev[i] / mx, 0.34, "#E3E7EF"); caja(doc, xb, yi, wb * apl[i] / mx, 0.34, if (apl[i] == prev[i]) TK$navy else TK$tenue)
  txt(doc, sprintf("%d de %d", apl[i], prev[i]), xb + wb * prev[i] / mx + 0.12, yi + 0.02, 1.4, 0.3, 12, TK$navy, bold = TRUE) }
leyenda(doc, 0, YT + 4.55, c("Aplicadas, completa", "Aplicadas, con faltantes", "Previstas"), c(TK$navy, TK$tenue, "#E3E7EF"), centrar_en = xb + wb / 2)
pie(doc, paste(FIC, "109 aulas aplicadas de 116 previstas en la muestra"))
MOTOR_ACT <- "p_slide_1_grafico: p_barras_agrupadas por sexo"
doc <- nueva(doc); titulo(doc, "Prevalencia en el último año, por sexo y facultad", ante = "Encuesta en aulas")
panel_titulo(doc, XC, YT, AC, "Estudiantes que vivieron al menos una situación en el último año", "Mujeres en azul oscuro, hombres en azul claro")
barras_h(doc, XC, YT + 0.6, AC, fac, c(38, 33, 26, 29, 24, 31, 21), wlab = 2.8, g = 0.3, fila = 0.58, size = 12, comp = c(19, 15, 12, 14, 10, 17, 9), escala = 50)
leyenda(doc, 0, YT + 4.85, c("Mujeres", "Hombres"), TK$dico, centrar_en = W / 2)
pie(doc, paste(FIC, "Base: 1,855 estudiantes encuestados en aula"))

# 4.6 Encuesta organizacional, dos actores
MOTOR_ACT <- "p_slide_1_grafico: p_barras_multiapiladas con dos actores"
doc <- nueva(doc); titulo(doc, "Igualdad de oportunidades en la organización", ante = "Encuesta organizacional")
prem3 <- list(list("Hombres y mujeres tienen las mismas oportunidades de ascenso", c(6, 22, 47, 22, 3), c(1, 6, 45, 47, 1)),
              list("Los procesos de selección son transparentes", c(8, 25, 44, 18, 5), c(2, 9, 50, 38, 1)),
              list("Se puede conciliar el trabajo con la vida familiar", c(5, 18, 52, 23, 2), c(2, 10, 53, 34, 1)))
for (k in 1:3) { yk <- YT - 0.05 + (k - 1) * 1.45
  txt(doc, prem3[[k]][[1]], XT, yk, AC, 0.3, 13, TK$navy, bold = TRUE)
  likert_panel(doc, XC, yk + 0.25, AC, list(list(lab = "Trabajadores", f = sf_(prem3[[k]][[2]], 420)), list(lab = "Directivos", f = sf_(prem3[[k]][[3]], 38))), g = 0.3, fila = 0.48, wlab = 1.6, size_lab = 12) }
leyenda(doc, 0, Y_LEY - 0.02, LIKERT_ROT, TK$likert, centrar_en = W / 2)
pie(doc, paste(FIC, "Base: 420 trabajadores y 38 directivos"))
MOTOR_ACT <- "p_slide_1_grafico: p_dumbbell entre dos actores"
doc <- nueva(doc); titulo(doc, "Brecha entre trabajadores y directivos", ante = "Encuesta organizacional")
itm <- c("Oportunidades de ascenso", "Selección transparente", "Conciliación familiar", "Trato respetuoso", "Canal de denuncias conocido"); tw <- c(69, 62, 75, 81, 44); dw <- c(92, 88, 87, 90, 79)
xg0 <- XC + 3.4; wg <- 7.0; px <- function(v) xg0 + (v - 30) / 70 * wg
leyenda(doc, 0, YT - 0.05, c("Trabajadores", "Directivos"), c("#4F7FAF", TK$navy), centrar_en = xg0 + wg / 2)
for (i in seq_along(itm)) { yc <- YT + 0.7 + (i - 1) * 0.7; if (i > 1) separador_h(doc, XC, W - MR, yc - 0.35)
  txt(doc, itm[i], XC - 0.1, yc - 0.16, 3.3, 0.32, 13, TK$navy, bold = TRUE)
  caja(doc, px(tw[i]), yc - 0.035, px(dw[i]) - px(tw[i]), 0.07, "#AEB6C6")
  caja(doc, px(tw[i]) - 0.11, yc - 0.11, 0.22, 0.22, "#4F7FAF", geom = "ellipse"); caja(doc, px(dw[i]) - 0.11, yc - 0.11, 0.22, 0.22, TK$navy, geom = "ellipse")
  txt(doc, paste0(tw[i], "%"), px(tw[i]) - 0.82, yc - 0.15, 0.7, 0.3, 12, TK$navy, bold = TRUE, align = "right"); txt(doc, paste0(dw[i], "%"), px(dw[i]) + 0.12, yc - 0.15, 0.7, 0.3, 12, TK$navy, bold = TRUE)
  txt(doc, sprintf("%d puntos", dw[i] - tw[i]), xg0 + wg + 0.6, yc - 0.15, 1.6, 0.3, 12, TK$soft) }
pie(doc, paste(FIC, "Top Two Box. Base: 420 trabajadores y 38 directivos. Los directivos tienen menos de 30 casos por cargo"))
MOTOR_ACT <- "p_slide_grafico_texto_derecha: p_barras_agrupadas"
doc <- nueva(doc); titulo(doc, "Políticas que conocen los trabajadores", ante = "Encuesta organizacional")
panel_titulo(doc, XC, YT, 7.8, "¿Cuáles de estas políticas conoce?", "Opción múltiple, 420 trabajadores")
barras_h(doc, XC, YT + 0.6, 7.8, c("Horario flexible", "Licencia por paternidad", "Protocolo contra el acoso", "Lactario", "Teletrabajo", "Ninguna"), c(58, 46, 39, 33, 27, 12), wlab = 2.6, g = grosor_cat(6), fila = 0.6, size = 12, escala = 70)
narrativa(doc, 8.9, YT + 0.6, W - MR - 8.9, 2.4, list(N_("El "), B("protocolo contra el acoso"), N_(" lo conoce menos de la mitad del personal, aunque está vigente.")), size = 14)
pie(doc, paste(FIC, "Base: 420 trabajadores. Opción múltiple"))

# 4.7 Evaluación antes y después
ind7 <- c("Conoce sus derechos laborales", "Tiene un plan de negocio", "Ahorra cada mes", "Usa servicios financieros", "Participa en una red de apoyo")
an <- c(41, 18, 33, 27, 22); de <- c(63, 35, 39, 44, 24); n0 <- 300; n1 <- 285
MOTOR_ACT <- "p_slide_1_grafico: p_dumbbell antes y después"
doc <- nueva(doc); titulo(doc, "Cinco indicadores antes y después de la intervención", ante = "Evaluación antes y después")
xg0 <- XC + 3.6; wg <- 6.6; px <- function(v) xg0 + (v - 0) / 80 * wg
leyenda(doc, 0, YT - 0.05, c("Antes", "Después"), c("#AEB6C6", TK$navy), centrar_en = xg0 + wg / 2)
for (i in seq_along(ind7)) { yc <- YT + 0.7 + (i - 1) * 0.7; if (i > 1) separador_h(doc, XC, W - MR, yc - 0.35)
  txt(doc, ind7[i], XC - 0.1, yc - 0.16, 3.5, 0.32, 13, TK$navy, bold = TRUE)
  caja(doc, px(an[i]), yc - 0.035, px(de[i]) - px(an[i]), 0.07, TK$tenue)
  caja(doc, px(an[i]) - 0.11, yc - 0.11, 0.22, 0.22, "#AEB6C6", geom = "ellipse"); caja(doc, px(de[i]) - 0.11, yc - 0.11, 0.22, 0.22, TK$navy, geom = "ellipse")
  txt(doc, paste0(an[i], "%"), px(an[i]) - 0.82, yc - 0.15, 0.7, 0.3, 12, TK$navy, align = "right"); txt(doc, paste0(de[i], "%"), px(de[i]) + 0.12, yc - 0.15, 0.7, 0.3, 12, TK$navy, bold = TRUE) }
pie(doc, paste(FIC, "Base: 300 participantes antes y 285 después"))
MOTOR_ACT <- "PROPUESTA: cambio con su intervalo (Newcombe), antes y después"
doc <- nueva(doc); titulo(doc, "Cuánto cambió cada indicador", ante = "Evaluación antes y después")
xg0 <- XC + 3.6; wg <- 5.8; px <- function(v) xg0 + (v + 10) / 40 * wg; caja(doc, xg0, YT + 0.3, wg, 5 * 0.7, "#EAEDF2")
for (v in seq(-10, 30, 10)) { caja(doc, px(v) - (if (v == 0) 0.009 else 0.004), YT + 0.3, if (v == 0) 0.018 else 0.008, 5 * 0.7, if (v == 0) TK$soft else "#FFFFFF")
  txt(doc, if (v == 0) "0" else sprintf("%+d", v), px(v) - 0.35, YT + 0.34 + 5 * 0.7, 0.7, 0.24, 9.5, TK$soft, align = "center") }
txt(doc, "Puntos, después menos antes", xg0 - 0.1, YT - 0.05, wg + 0.2, 0.3, 11, TK$soft, bold = TRUE, align = "center")
for (i in seq_along(ind7)) { yc <- YT + 0.3 + (i - 1) * 0.7 + 0.35; ci <- 100 * newc_(round(de[i] * n1 / 100), n1, round(an[i] * n0 / 100), n0); s_ <- ci[1] > 0 | ci[2] < 0
  txt(doc, ind7[i], XC - 0.1, yc - 0.16, 3.5, 0.32, 13, TK$navy, bold = s_)
  caja(doc, px(ci[1]), yc - 0.03, px(ci[2]) - px(ci[1]), 0.06, if (s_) TK$navy else "#AEB6C6", geom = "roundRect")
  caja(doc, px(de[i] - an[i]) - 0.09, yc - 0.09, 0.18, 0.18, if (s_) TK$navy else "#FFFFFF", geom = "ellipse", line = sp_line(color = if (s_) TK$navy else "#AEB6C6", lwd = 1.5))
  txt(doc, sprintf("%+d puntos", de[i] - an[i]), xg0 + wg + 0.3, yc - 0.15, 1.5, 0.3, 13, if (s_) TK$navy else TK$soft, bold = s_)
  txt(doc, if (s_) "Significativo" else "No significativo", xg0 + wg + 1.75, yc - 0.15, W - MR - xg0 - wg - 1.75, 0.3, 11.5, if (s_) TK$navy else TK$soft, bold = s_) }
pie(doc, paste(FIC, "La barra es el intervalo de 95 % del cambio (Newcombe): si no cruza el cero, el cambio es significativo (α = 0.05)"))
MOTOR_ACT <- "p_slide_cifras_y_graficos: resultados de la evaluación"
doc <- nueva(doc); titulo(doc, "Resultados de la evaluación", ante = "Evaluación antes y después")
res <- list(c("trending-up", "3 de 5", "indicadores mejoraron de forma significativa", "derechos laborales, plan de negocio y servicios financieros"),
            c("chart-column", "+22", "puntos en conocimiento de derechos laborales", "el mayor cambio"), c("users", "285", "participantes en la medición posterior", "95 % de la línea base"))
gp <- 0.45; wc3 <- (AC - 2 * gp) / 3
for (k in 1:3) { x <- XC + (k - 1) * (wc3 + gp); if (k > 1) separador_v(doc, x - gp / 2, YT + 0.2, YT + 3.0)
  icono_en_circulo(doc, res[[k]][1], x, YT + 0.3, 0.6); txt(doc, res[[k]][2], x - 0.1, YT + 1.1, wc3 + 0.1, 0.75, 40, TK$navy, bold = TRUE)
  txt(doc, res[[k]][3], x - 0.1, YT + 1.85, wc3 + 0.1, 0.5, 12, TK$navy, bold = TRUE); txt(doc, res[[k]][4], x - 0.1, YT + 2.4, wc3 + 0.1, 0.5, 10, TK$soft) }
separador_h(doc, XC, W - MR, YT + 3.4)
txt(doc, "El ahorro y la participación en redes de apoyo no cambiaron de forma significativa en el periodo evaluado.", XT, YT + 3.6, AC, 0.6, 13, TK$navy, bold = TRUE)
pie(doc, paste(FIC, "Medición antes y después con la misma encuesta"))
