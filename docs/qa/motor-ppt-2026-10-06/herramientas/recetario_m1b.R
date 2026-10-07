# Recetario v2, Parte II (informe tipo): número de respuestas por actor, tras la ficha técnica.
# Usa sf()/ACT6 definidos aquí mismo (se cargan antes que recetario_m4.R).
sf <- function(pct, valid) { n <- round(pct * valid / 100); list(pct = pct, n = n, valid = valid) }
fila_s <- function(actor, pct, valid) list(actor = actor, f = sf(pct, valid))
ACT6 <- c("Estudiantes", "Egresados", "Docentes", "Autoridades", "Administrativos", "Empleadores")

# --- A7 número de respuestas por actor (Derecho, Educación y Comunicaciones lo traen tras el Top Two Box)
MOTOR_ACT <- "p_slide_1_grafico: p_barras_agrupadas (conteos de participación por actor)"
doc <- nueva(doc); titulo(doc, "Número de respuestas por actor", ante = "Cómo leer este informe")
part <- data.frame(a = ACT6, n = c(1234, 314, 148, 12, 43, 15), N = c(1506, 1210, 175, 14, 52, 40))
part$t <- round(100 * part$n / part$N)
x0 <- ML; wl <- 1.9; xb <- x0 + wl + 0.2; wbar <- 6.2; y <- YT + 0.55
if (ESTILO == "moderna") { txt(doc, "Respuestas", xb, YT + 0.1, 2, 0.26, 10, TK$soft, bold = TRUE); txt(doc, "Tasa de respuesta", 9.7, YT + 0.1, 3.3, 0.26, 10, TK$soft, bold = TRUE, align = "center") }
for (k in seq_len(nrow(part))) { yc <- y + (k - 1) * 0.72
  txt(doc, part$a[k], x0, yc, wl, 0.34, 14, TK$navy, bold = TRUE, align = "right")
  wv <- max(0.04, wbar * sqrt(part$n[k] / max(part$n)))          # raíz: 12 y 1 234 caben en la misma escala sin desaparecer
  caja(doc, xb, yc + 0.04, wv, 0.3, if (ESTILO == "moderna" && k == 1) TK$navy else if (ESTILO == "moderna") TK$tenue else TK$navy)
  txt(doc, format(part$n[k], big.mark = ","), xb + wv + 0.1, yc, 1.2, 0.34, 14, TK$navy, bold = TRUE)
  if (ESTILO == "moderna") { caja(doc, 10.6, yc + 0.13, 1.5, 0.12, TK$zebra); caja(doc, 10.6, yc + 0.13, 1.5 * part$t[k] / 100, 0.12, TK$verde_txt)
    txt(doc, sprintf("%d%%", part$t[k]), 9.7, yc, 0.8, 0.34, 13, TK$verde_txt, bold = TRUE, align = "right")
    txt(doc, sprintf("de %s", format(part$N[k], big.mark = ",")), 12.17, yc, 0.85, 0.34, 10, TK$faint) }
  else txt(doc, sprintf("%d%% de %s", part$t[k], format(part$N[k], big.mark = ",")), 10.3, yc, 2.6, 0.34, 13, TK$navy, align = "center") }
zona("barras de participación, escala raíz", xb, y, wbar, 6 * 0.72)
pie(doc, "Universo: población de cada actor según la carrera. Tasa = respuestas válidas sobre universo")

