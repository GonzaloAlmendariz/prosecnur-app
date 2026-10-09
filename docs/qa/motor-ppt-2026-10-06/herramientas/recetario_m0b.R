# Recetario v2, Parte I (reglas): escalas que llegan y reglas de rotulado. Va tras recetario_m0.R.
# Usa sf()/fila_s() de recetario_m1b.R? No: se definen aquí para no depender del orden.
sf <- function(pct, valid) { n <- round(pct * valid / 100); list(pct = pct, n = n, valid = valid) }
fila_s <- function(actor, pct, valid) list(actor = actor, f = sf(pct, valid))

# --- A5 escalas que llegan y cómo se leen igual (H57, H59, H64, H65)
MOTOR_ACT <- "Regla de robustez: la escala se reconoce por significado y orden. SIN INF al final (PROPUESTA para el motor: H57, H58, H59, H64, H65)"
doc <- nueva(doc); titulo(doc, "Una misma escala, muchas redacciones", ante = "Reglas de la identidad")
fam <- list(
  list("Acuerdo", c("Totalmente en desacuerdo … Totalmente de acuerdo", "Completamente en desacuerdo … Completamente de acuerdo", "Totalmente en Desacuerdo … Totalmente de Acuerdo",
                    "Totalmente en desacuerdo 1 … Totalmente de acuerdo 4, con SIN INF primero"), LIKERT_ROT),
  list("Satisfacción", c("Muy insatisfecho … Muy satisfecho", "Nada Satisfecho / Poco Satisfecho / Satisfecho / Muy Satisfecho", "Muy Insatisfecho / Poco Satisfecho / Satisfecho / Muy Satisfecho",
                         "con «No he usado el servicio» primero"), c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho", "SIN INF o no usado")),
  list("Importancia, utilidad y competencia", c("Nada importante … Muy importante", "Nada útil … Totalmente útil", "Nada competente … Totalmente competente"),
       c("Extremo bajo", "Bajo", "Alto", "Extremo alto", "SIN INF")))
y <- Y_DATOS - 0.1; wv <- 5.9
if (ESTILO == "moderna") { txt(doc, "Cómo aparece en las encuestas", XT, y - 0.05, wv, 0.26, 10, TK$soft, bold = TRUE); txt(doc, "Cómo se dibuja en el informe", 7.0, y - 0.05, 6, 0.26, 10, TK$soft, bold = TRUE); y <- y + 0.3 }
for (f_ in fam) {
  txt(doc, f_[[1]], XT, y, wv, 0.3, 13, TK$navy, bold = TRUE)
  for (j in seq_along(f_[[2]])) txt(doc, f_[[2]][j], XT, y + 0.3 + (j - 1) * 0.26, wv, 0.26, 10.5, TK$navy)
  for (i in 1:5) { xx <- 7.0 + (i - 1) * 1.18; caja(doc, xx, y + 0.35, 1.12, 0.36, TK$likert[i]); txt(doc, f_[[3]][i], xx, y + 0.75, 1.12, 0.42, 10, TK$navy, align = "center") }
  y <- y + 0.42 + max(length(f_[[2]]) * 0.26, 0.85) + 0.15
  if (ESTILO == "moderna") separador_h(doc, XC, W - MR, y - 0.12) }
txt(doc, "Top Two Box: suma de las dos respuestas más altas", 7.0, y + 0.02, 5.9, 0.3, 11, TK$verde_txt, bold = TRUE)
pie(doc, "La redacción cambia según la carrera y el actor, pero el color y el orden se mantienen")


# --- C23 cifras chicas seguidas (pregunta de Gonzalo: «¿qué pasa si hay un 1 %, 2 % y 3 % uno al lado del otro?»)
MOTOR_ACT <- "Regla de rotulado: cifras que no caben en su segmento van encima, con guía. Seguidas se separan 0,46 in sin salir de la barra. Con poco aire, la barra adelgaza"
cs <- list(list(texto = "Tres chicas al inicio", filas = list(fila_s("", c(1, 2, 3, 40, 54), 120))),
           list(texto = "Tres chicas al final", filas = list(fila_s("", c(30, 62, 2, 1, 5), 120))),
           list(texto = "Chicas en los dos extremos", filas = list(fila_s("", c(1, 3, 47, 47, 2), 120))),
           list(texto = "Todas chicas salvo una", filas = list(fila_s("", c(2, 1, 93, 3, 1), 120))))
doc <- laminas_likert(doc, "Cuando varias cifras son muy pequeñas", "Reglas de la identidad", cs, "Si una cifra no cabe en su tramo, sube con una línea guía. Base: 120 casos de ejemplo, con cifras ficticias")
