# Recetario, Parte VII: alternativas editoriales de cierre (E8, Gonzalo, 2026-10-08: «también podemos tener alternativas
# editoriales para esta portada de cierre»). Cada cierre repite la composición geométrica del índice, para que el informe
# abra y cierre con la misma figura. El contacto es el de la contraportada entregada. Se carga tras recetario_m8.R.
contacto_cierre <- list(c("mail", "pulsopucp@pucp.edu.pe"), c("map-pin", "Av. Universitaria 1801, San Miguel, Lima 32, Perú"), c("globe", "pulso.pucp.edu.pe"))
cierre_alt <- function(doc, img, nombre) {
  MOTOR_ACT <<- sprintf("Propuesta de cierre: %s (misma composición que el índice)", nombre)
  doc <- nueva(doc)
  invisible(ph_with(doc, external_img(file.path(ILU, paste0(img, ".png")), width = 6.2, height = 7.5), location = ph_location(left = 0, top = 0, width = 6.2, height = 7.5)))
  xl <- 6.95; wl <- W - MR - xl
  txt(doc, toupper(paste("Cierre:", nombre)), xl - 0.1, 0.62, 5.2, 0.26, 10, TK$soft, bold = TRUE)
  txt(doc, "Gracias", xl - 0.1, 2.15, wl, 0.9, 44, TK$coral, bold = TRUE)
  txt(doc, "PULSO PUCP", xl - 0.1, 3.05, wl, 0.4, 16, TK$navy, bold = TRUE)
  separador_h(doc, xl, W - MR, 3.75)
  for (k in seq_along(contacto_cierre)) { yk <- 4.05 + (k - 1) * 0.55
    icono_en_circulo(doc, contacto_cierre[[k]][1], xl, yk, 0.4, pad = 0.24)
    txt(doc, contacto_cierre[[k]][2], xl + 0.5, yk + 0.04, wl - 0.5, 0.32, 13, TK$navy) }
  zona("cierre: composición a la izquierda, contacto a la derecha", xl, 2.15, wl, 3.5); dibujar_guias(doc)
  doc
}
for (g_ in list(c("geoarcos_5", "arcos"), c("geofacetas_5", "facetas"), c("geocirculos_5", "círculos"), c("geobloques_5", "bloques")))
  doc <- cierre_alt(doc, g_[1], g_[2])
