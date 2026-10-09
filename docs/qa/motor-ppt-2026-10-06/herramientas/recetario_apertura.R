# Apertura de la propuesta de diseño (2026-10-08): portada, cómo está organizada (desde recetario_estructura.json) y principios.
EST <- jsonlite::fromJSON("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_estructura.json", simplifyVector = FALSE)

MOTOR_ACT <- "Portada de la propuesta de diseño (no es una lámina del motor)"
doc <- nueva(doc, "Title Slide")
txt(doc, "PROPUESTA DE DISEÑO", 1.6, 2.12, 10.1, 0.32, 13, TK$coral, bold = TRUE, align = "center")
txt(doc, "Informes cuantitativos de PULSO PUCP", 0.8, 2.5, 11.7, 0.75, 36, TK$navy, bold = TRUE, align = "center")
txt(doc, "Identidad visual, tipos de gráficos y de láminas, y estudios", 1.6, 3.3, 10.1, 0.4, 18, TK$navy, align = "center")
txt(doc, "Recetario de diseño, octubre de 2026", 1.6, 3.75, 10.1, 0.4, 15, TK$soft, align = "center")
zona("título", 0.8, 2.5, 11.7, 0.75); dibujar_guias(doc)

MOTOR_ACT <- "Mapa de la propuesta (no es una lámina del motor)"
doc <- nueva(doc); titulo(doc, "Cómo está organizada la propuesta", ante = "Propuesta de diseño")
caps <- EST$capitulos; hp <- (YF - YT + 0.1) / length(caps)
for (k in seq_along(caps)) { yk <- YT - 0.1 + (k - 1) * hp; c_ <- caps[[k]]
  txt(doc, c_$n, ML, yk + 0.02, 0.9, 0.6, 30, TK$coral, bold = TRUE)
  txt(doc, c_$titulo, ML + 1.0, yk + 0.02, 6, 0.38, 18, TK$navy, bold = TRUE)
  txt(doc, paste(vapply(c_$secciones, function(s_) s_$titulo, ""), collapse = ", "), ML + 1.0, yk + 0.4, W - MR - ML - 1.2, 0.32, 12, TK$soft)
  if (k < length(caps)) separador_h(doc, ML + 1.0, W - MR, yk + hp - 0.06) }
zona("capítulos", ML, YT - 0.1, W - MR - ML, YF - YT); pie(doc, "")

MOTOR_ACT <- "Principios de la propuesta (no es una lámina del motor)"
doc <- nueva(doc); titulo(doc, "Principios de la propuesta", ante = "Propuesta de diseño")
pri <- list(c("presentation", "Una idea por lámina", "El título dice el tema, el gráfico lo muestra y el texto, cuando lo hay, dice lo que hay que retener."),
            c("calculator", "El dato lo calcula el motor", "Cifras, bases, letras de significancia y rótulos salen de los datos. A mano sólo se escriben frases cortas."),
            c("ruler", "Mismo lugar, mismo tamaño", "Título, gráfico, leyenda y base ocupan el mismo sitio y la misma letra en todas las láminas."),
            c("users", "Legible para todos", "Cada gráfico se entiende sin ser especialista. La información técnica se agrega cuando el lector la necesita."))
gp_ <- 0.4; wc_ <- (AC - 3 * gp_) / 4
for (k in seq_along(pri)) { x <- XC + (k - 1) * (wc_ + gp_)
  if (k > 1) separador_v(doc, x - gp_ / 2, YT + 0.1, YT + 3.6)
  icono_en_circulo(doc, pri[[k]][1], x, YT + 0.2, 0.62)
  txt(doc, pri[[k]][2], x - 0.1, YT + 1.05, wc_ + 0.1, 0.6, 16, TK$navy, bold = TRUE)
  txt(doc, pri[[k]][3], x - 0.1, YT + 1.7, wc_ + 0.1, 1.6, 13, TK$navy) }
zona("cuatro principios", XC, YT, AC, 3.6); pie(doc, "")
