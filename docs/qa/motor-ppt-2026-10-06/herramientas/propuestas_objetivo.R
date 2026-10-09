# Propuestas para la lámina de objetivo (comentario de Gonzalo, 2026-10-07: «no me están gustando ese slide de objetivo»).
# Se cargan con SOLO=objetivo desde recetario.R y salen en un mazo aparte para elegir.
obj <- "Conocer la percepción sobre los propósitos de la carrera de Contabilidad, su perfil de egreso, su plan de estudios y otras dimensiones relevantes para la acreditación, a partir de la opinión de estudiantes, docentes, egresados(as), personal administrativo, Comité Consultivo y empleadores(as)."
actores6 <- list(c("graduation-cap", "Estudiantes"), c("presentation", "Docentes"), c("briefcase", "Egresados"),
                 c("building-2", "Personal administrativo"), c("users", "Comité Consultivo"), c("briefcase-business", "Empleadores"))
opcion <- function(doc, letra, nombre) txt(doc, paste("Opción", letra, "|", nombre), W - MR - 4, 0.12, 4, 0.3, 10, TK$faint, align = "right")
fila_actores <- function(doc, x0, x1, y, d = 0.62, size = 12) {
  wa <- (x1 - x0) / length(actores6)
  for (k in seq_along(actores6)) { xa <- x0 + (k - 1) * wa
    icono_en_circulo(doc, actores6[[k]][1], xa + (wa - d) / 2, y, d)
    txt(doc, actores6[[k]][2], xa, y + d + 0.08, wa, 0.5, size, TK$navy, bold = TRUE, align = "center") }
}

# --- A. Sobria: el objetivo con sus temas en negrita y los seis actores debajo
doc <- nueva(doc); opcion(doc, "A", "sobria, con los temas en negrita")
icono_en_circulo(doc, "diana-flecha", XC, 1.25, 0.62, fondo = TK$coral)
txt(doc, "Objetivo del estudio", XC + 0.8, 1.33, 6, 0.45, 20, TK$coral, bold = TRUE)
txt_runs(doc, list(list(t = "Conocer la percepción sobre "), list(t = "los propósitos de la carrera", b = TRUE), list(t = " de Contabilidad, su "),
                   list(t = "perfil de egreso", b = TRUE), list(t = ", su "), list(t = "plan de estudios", b = TRUE), list(t = " y "),
                   list(t = "otras dimensiones relevantes para la acreditación", b = TRUE),
                   list(t = ", a partir de la opinión de seis actores de la comunidad universitaria y su entorno.")),
         XT, 2.3, AC, 2.0, size = 22)
separador_h(doc, XC, W - MR, 4.7)
txt(doc, "Actores consultados", XT, 4.85, AC, 0.32, 12, TK$soft, bold = TRUE)
fila_actores(doc, XC, W - MR, 5.35)
dibujar_guias(doc)

# --- B. Panel: la mitad izquierda en azul oscuro nombra la lámina y la derecha lleva el texto
doc <- nueva(doc); wp <- 4.4
caja(doc, 0, 0, wp, H, TK$navy)
icono(doc, "diana-flecha", "blanco", 0.75, 1.75, 1.15)
txt(doc, "Objetivo del estudio", 0.75, 3.15, wp - 1.1, 1.3, 32, "#FFFFFF", bold = TRUE)
caja(doc, 0.75, 4.6, 0.9, 0.06, TK$coral)
opcion(doc, "B", "panel azul a la izquierda")
xo <- wp + 0.6; wo <- W - MR - xo
txt(doc, obj, xo, 1.55, wo, 2.6, 20, TK$navy)
separador_h(doc, xo, W - MR, 4.3)
txt(doc, "Actores consultados", xo, 4.45, wo, 0.32, 12, TK$soft, bold = TRUE)
wa <- wo / 3
for (k in seq_along(actores6)) { xa <- xo + ((k - 1) %% 3) * wa; ya <- 4.95 + ((k - 1) %/% 3) * 0.9
  icono_en_circulo(doc, actores6[[k]][1], xa, ya, 0.58)
  txt(doc, actores6[[k]][2], xa + 0.68, ya + 0.1, wa - 0.7, 0.42, 13, TK$navy, bold = TRUE) }
dibujar_guias(doc)

# --- C. Desglosado: el objetivo partido en qué se quiere conocer y a quién se le pregunta
doc <- nueva(doc); opcion(doc, "C", "el objetivo desglosado")
icono_en_circulo(doc, "diana-flecha", XC, 0.62, 0.62, fondo = TK$coral)
txt(doc, "Objetivo del estudio", XC + 0.8, 0.7, 6, 0.45, 20, TK$coral, bold = TRUE)
txt(doc, "Conocer la percepción sobre", XT, 1.55, AC, 0.45, 18, TK$navy, bold = TRUE)
temas <- list(c("goal", "Los propósitos de la carrera"), c("graduation-cap", "El perfil de egreso"),
              c("book-open", "El plan de estudios"), c("award", "Otras dimensiones de la acreditación"))
gap <- 0.25; wt <- (AC - gap * 3) / 4
for (k in seq_along(temas)) { xk <- XC + (k - 1) * (wt + gap)
  caja(doc, xk, 2.1, wt, 1.35, "#FFFFFF"); caja(doc, xk, 2.1, wt, 0.06, TK$navy)
  icono(doc, temas[[k]][1], "navy", xk + 0.25, 2.38, 0.42)
  txt(doc, temas[[k]][2], xk + 0.25, 2.86, wt - 0.45, 0.55, 14, TK$navy, bold = TRUE) }
txt(doc, "a partir de la opinión de", XT, 3.85, AC, 0.45, 18, TK$navy, bold = TRUE)
fila_actores(doc, XC, W - MR, 4.45, d = 0.72, size = 13)
pie(doc, "Carrera de Contabilidad. Proceso de acreditación 2026")
dibujar_guias(doc)
