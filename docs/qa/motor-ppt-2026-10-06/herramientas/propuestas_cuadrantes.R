# Propuesta para el recetario (G16, Gonzalo 2026-10-13: «Sí, vamos con matriz de cuadrantes»), el propósito general de la
# FODA. Cada tema es un punto con DOS medidas que el estudio ya tiene —X e Y, cada una con su corte—; la app no calcula
# ninguna («cuidado con hacer modelos muy específicos para una app que por definición es generalista»). Las líneas cortan
# en el promedio de cada eje (o en un valor declarado) y los cuadrantes llevan los nombres que declare la lámina. El
# ejemplo es el par satisfacción–importancia con su juego de nombres sugerido; el tipo sirve igual para docentes frente
# a estudiantes, 2021 frente a 2026 o conoce frente a usa.
# Maqueta con datos de ejemplo, como el resto del recetario. Uso: SOLO=cuadrantes ESTILO=moderna SP=<datos> SALIDA=<pptx>
MOTOR_ACT <- "p_slide_1_grafico: p_matriz_cuadrantes (propuesta)"
it <- data.frame(
  tema = c("Plana docente", "Malla curricular", "Prácticas", "Infraestructura", "Bienestar estudiantil",
           "Biblioteca", "Tutoría académica", "Vinculación laboral", "Servicios en línea", "Actividades culturales"),
  sat = c(92, 81, 64, 72, 86, 90, 58, 61, 77, 84),
  imp = c(95, 91, 93, 74, 70, 68, 88, 90, 66, 52))
cx <- round(mean(it$sat)); cy <- round(mean(it$imp))
doc <- nueva(doc); titulo(doc, "Servicios: satisfacción frente a importancia", ante = "Matriz de cuadrantes")
xl <- ML + 0.75; wl <- 7.2; yt <- YT + 0.45; hy <- YF - yt - 0.95
lox <- 50; hix <- 100; loy <- 50; hiy <- 100
px <- function(v) xl + wl * (v - lox) / (hix - lox); py <- function(v) yt + hy * (hiy - v) / (hiy - loy)
# Cuadrante «Prioridad» (importante y poco satisfecho) con un fondo tenue: es lo que la lámina quiere que se lea primero.
caja(doc, xl, yt, px(cx) - xl, py(cy) - yt, "#F8E3E2")
for (v in seq(50, 100, 10)) {
  caja(doc, px(v), yt, 0.006, hy, TK$rule); txt(doc, paste0(v, "%"), px(v) - 0.35, yt + hy + 0.06, 0.7, 0.24, 10, TK$faint, align = "center")
  caja(doc, xl, py(v), wl, 0.006, TK$rule); txt(doc, paste0(v, "%"), xl - 0.75, py(v) - 0.12, 0.62, 0.24, 10, TK$faint, align = "right")
}
caja(doc, px(cx) - 0.008, yt, 0.016, hy, TK$tenue); caja(doc, xl, py(cy) - 0.008, wl, 0.016, TK$tenue)
txt(doc, sprintf("Promedio %d%%", cx), px(cx) - 0.8, yt - 0.27, 1.6, 0.24, 9, TK$soft, align = "center")
txt(doc, sprintf("Promedio %d%%", cy), xl + wl - 1.6, py(cy) + 0.04, 1.6, 0.24, 9, TK$soft, align = "right")
txt(doc, "Satisfacción con el servicio · Satisfecho + Muy satisfecho", xl, yt + hy + 0.62, wl, 0.26, 10, TK$soft, bold = TRUE, align = "center")
txt(doc, "Importancia del servicio · Importante + Muy importante", xl - 0.75, yt - 0.62, 6, 0.26, 10, TK$soft, bold = TRUE)
# Nombre de cada cuadrante fuera del área de puntos, sobre y bajo su mitad: un punto nunca lo tapa.
mi <- function(a, b) (a + b) / 2
txt(doc, "Prioridad", mi(xl, px(cx)) - 1.1, yt - 0.3, 2.2, 0.28, 12, TK$coral, bold = TRUE, align = "center")
txt(doc, "Fortalezas", mi(px(cx), xl + wl) - 1.1, yt - 0.3, 2.2, 0.28, 12, TK$navy, bold = TRUE, align = "center")
txt(doc, "Mejorar", mi(xl, px(cx)) - 1.1, yt + hy + 0.3, 2.2, 0.28, 12, TK$soft, bold = TRUE, align = "center")
txt(doc, "Mantener", mi(px(cx), xl + wl) - 1.1, yt + hy + 0.3, 2.2, 0.28, 12, TK$soft, bold = TRUE, align = "center")
for (i in seq_len(nrow(it))) {
  prio <- it$sat[i] < cx && it$imp[i] >= cy
  col <- if (prio) TK$coral else TK$navy
  caja(doc, px(it$sat[i]) - 0.1, py(it$imp[i]) - 0.1, 0.2, 0.2, col, geom = "ellipse")
  txt(doc, it$tema[i], px(it$sat[i]) + 0.12, py(it$imp[i]) - 0.15, 2.4, 0.3, 11, col, bold = prio)
}
zona("dispersión con cuadrantes, ejes de 50 a 100", xl, yt, wl, hy)
# A la derecha, la lectura: lo que cae en «Prioridad», de mayor a menor importancia, con sus dos cifras.
xr <- xl + wl + 0.55; wr <- W - MR - xr
pr <- it[it$sat < cx & it$imp >= cy, ]; pr <- pr[order(-pr$imp), ]
txt(doc, "Prioridad", xr, yt - 0.05, wr, 0.32, 14, TK$coral, bold = TRUE)
txt(doc, "El cuadrante que la lámina destaca: importante y por debajo del promedio de satisfacción", xr, yt + 0.27, wr, 0.5, 10, TK$soft)
txt(doc, "Importancia", xr + wr - 2.0, yt + 0.8, 1.0, 0.24, 9, TK$faint, align = "right")
txt(doc, "Satisfacción", xr + wr - 1.0, yt + 0.8, 1.0, 0.24, 9, TK$faint, align = "right")
for (i in seq_len(nrow(pr))) {
  y <- yt + 1.1 + (i - 1) * 0.5
  caja(doc, xr, y + 0.44, wr, 0.006, TK$rule)
  txt(doc, pr$tema[i], xr, y + 0.06, wr - 2.0, 0.32, 12, TK$navy, bold = TRUE)
  txt(doc, paste0(pr$imp[i], "%"), xr + wr - 2.0, y + 0.06, 1.0, 0.32, 12, TK$navy, align = "right")
  txt(doc, paste0(pr$sat[i], "%"), xr + wr - 1.0, y + 0.06, 1.0, 0.32, 12, TK$coral, bold = TRUE, align = "right")
}
zona("lectura: lo que cae en Prioridad", xr, yt, wr, hy)
pie(doc, "Base: 289 estudiantes. Cada punto es un tema con sus dos medidas; las líneas cortan en el promedio de cada eje")
