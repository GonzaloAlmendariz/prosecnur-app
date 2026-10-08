# Recetario, Parte VII: alternativas editoriales de cierre (E8, Gonzalo, 2026-10-08: «también podemos tener alternativas
# editoriales para esta portada de cierre» y, sobre la primera versión, «lo interesante de la portada es el logo de PULSO
# centrado al final; replicar los estilos de los índices como cierre no está bien»). Las cuatro parten del layout
# «Contraportada» de la plantilla, que ya trae el logo institucional centrado (4.47, 2.16 in; 4.39 x 2.67 in) y los íconos
# de contacto al pie, y cambian sólo lo que rodea al logo. Se carga tras recetario_m8.R.
LOGO_Y0 <- 2.16; LOGO_Y1 <- 2.16 + 2.67
contacto_pie <- function(doc) {   # mismo contacto, posición y tamaño que la contraportada entregada
  txt(doc, "pulsopucp@pucp.edu.pe", 1.08, 6.7, 2.4, 0.4, 12, TK$navy); txt(doc, "Av. Universitaria 1801, San Miguel, Lima 32, Perú", 5.2, 6.69, 4.9, 0.4, 12, TK$navy)
  txt(doc, "pulso.pucp.edu.pe", 11.17, 6.71, 1.8, 0.4, 12, TK$navy) }
cierre <- function(doc, nombre) { MOTOR_ACT <<- sprintf("Propuesta de cierre: %s (layout «Contraportada», logo centrado)", nombre)
  doc <- nueva(doc, "Contraportada"); if (GUIAS) txt(doc, toupper(paste("Cierre:", nombre)), ML, 0.35, 6, 0.26, 10, TK$guia, bold = TRUE); doc }

# 1. Con filete: un filete coral corto bajo el logo marca el final, como el filete de la portada
doc <- cierre(doc, "logo con filete")
caja(doc, W / 2 - 0.45, LOGO_Y1 + 0.35, 0.9, 0.05, TK$coral)
contacto_pie(doc); zona("logo y filete", 4.47, LOGO_Y0, 4.39, 3.1); dibujar_guias(doc)

# 2. Con banda: el contacto pasa a una banda azul oscuro al pie, en blanco, con sus íconos
doc <- cierre(doc, "logo con banda al pie")
caja(doc, 0, H - 1.05, W, 1.05, TK$navy)
cto <- list(c("mail", "pulsopucp@pucp.edu.pe"), c("map-pin", "Av. Universitaria 1801, San Miguel, Lima 32, Perú"), c("globe", "pulso.pucp.edu.pe"))
ws <- vapply(cto, function(c_) 0.36 + ancho_tinta(c_[2], 12), 0); gap <- 0.7; x <- (W - sum(ws) - gap * 2) / 2
for (k in seq_along(cto)) { icono(doc, cto[[k]][1], "blanco", x, H - 0.64, 0.24); txt(doc, cto[[k]][2], x + 0.22, H - 0.69, ws[k], 0.32, 12, "#FFFFFF"); x <- x + ws[k] + gap }
zona("logo y banda de contacto", 0, H - 1.05, W, 1.05); dibujar_guias(doc)

# 3. Con el estudio: arriba, en pequeño, el nombre del informe que se cierra
doc <- cierre(doc, "logo con el nombre del estudio")
txt(doc, "Estudio de opinión sobre el servicio educativo de la carrera de Contabilidad", 1.6, 0.95, W - 3.2, 0.36, 15, TK$navy, bold = TRUE, align = "center")
txt(doc, "Informe consolidado, setiembre de 2026", 1.6, 1.32, W - 3.2, 0.32, 13, TK$soft, align = "center")
caja(doc, W / 2 - 0.45, 1.8, 0.9, 0.04, TK$coral)
contacto_pie(doc); zona("estudio arriba y logo", 1.6, 0.95, W - 3.2, LOGO_Y1 - 0.95); dibujar_guias(doc)

# 4. Con agradecimiento: una línea para quienes respondieron, bajo el logo
doc <- cierre(doc, "logo con agradecimiento")
txt(doc, "Gracias a los docentes, estudiantes, egresados y personal administrativo que respondieron", 1.6, LOGO_Y1 + 0.45, W - 3.2, 0.36, 15, TK$navy, align = "center")
contacto_pie(doc); zona("logo y agradecimiento", 1.6, LOGO_Y0, W - 3.2, LOGO_Y1 + 0.85 - LOGO_Y0); dibujar_guias(doc)
