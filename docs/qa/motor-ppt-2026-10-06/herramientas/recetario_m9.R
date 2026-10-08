# Recetario, Parte VII: alternativas editoriales de cierre (E8). Pedidos de Gonzalo, 2026-10-08: «lo interesante de la
# portada es el logo de PULSO centrado al final; replicar los estilos de los índices como cierre no está bien» y, sobre la
# segunda versión, «sólo me gusta el dos y el último, pero el reemplazo de los logos me parece razonable; debe haber 4
# propuestas sobrias en esa línea, sin comentarios de agradecimiento o cosas cliché». Las cuatro parten del layout
# «Contraportada» (logo institucional centrado en 4.47, 2.16 in; 4.39 x 2.67 in; línea coral al pie en y = 7.48) y cambian
# sólo el contacto: íconos de Lucide en lugar de los de la plantilla. Donde el contacto no va al pie, una forma del color
# del fondo tapa los íconos del layout (en el motor sería un layout «Contraportada» sin contacto). Se carga tras recetario_m8.R.
LOGO_Y1 <- 2.16 + 2.67
CTO <- list(c("mail", "Correo", "pulsopucp@pucp.edu.pe"), c("map-pin", "Dirección", "Av. Universitaria 1801, San Miguel, Lima 32, Perú"), c("globe", "Web", "pulso.pucp.edu.pe"))
cierre <- function(doc, nombre, tapar = TRUE) { MOTOR_ACT <<- sprintf("Propuesta de cierre: %s (layout «Contraportada», logo centrado, contacto con íconos de Lucide)", nombre)
  doc <- nueva(doc, "Contraportada"); if (tapar) caja(doc, 0, 6.45, W, 0.95, TK$fondo)   # tapa los íconos del layout, no la línea coral
  if (GUIAS) txt(doc, toupper(paste("Cierre:", nombre)), ML, 0.35, 6, 0.26, 10, TK$guia, bold = TRUE); doc }
fila_cto <- function(doc, y, color = TK$navy, ico = "navy", gap = 0.7) {   # los tres datos en una fila centrada
  ws <- vapply(CTO, function(c_) 0.36 + ancho_tinta(c_[3], 12), 0); x <- (W - sum(ws) - gap * 2) / 2
  for (k in seq_along(CTO)) { icono(doc, CTO[[k]][1], ico, x, y + 0.05, 0.24); txt(doc, CTO[[k]][3], x + 0.22, y, ws[k], 0.32, 12, color); x <- x + ws[k] + gap } }

# 1. Banda azul al pie: el contacto en blanco sobre azul oscuro
doc <- cierre(doc, "banda azul al pie")
caja(doc, 0, H - 1.05, W, 1.05, TK$navy); fila_cto(doc, H - 0.69, color = "#FFFFFF", ico = "blanco")
zona("logo y banda de contacto", 0, H - 1.05, W, 1.05); dibujar_guias(doc)

# 2. Banda clara al pie: la misma banda en blanco, con un filete azul arriba, sobre la línea coral de la plantilla
doc <- cierre(doc, "banda clara al pie")
caja(doc, 0, 6.42, W, 1.0, "#FFFFFF"); caja(doc, 0, 6.42, W, 0.02, TK$navy); fila_cto(doc, 6.78)
zona("logo y banda clara", 0, 6.42, W, 1.0); dibujar_guias(doc)

# 3. Contacto bajo el logo: una fila centrada, separada del logo por un filete corto; el pie queda limpio
doc <- cierre(doc, "contacto bajo el logo")
caja(doc, W / 2 - 0.45, LOGO_Y1 + 0.4, 0.9, 0.02, TK$rule); fila_cto(doc, LOGO_Y1 + 0.65)
zona("logo y contacto en una fila", 1.0, 2.16, W - 2.0, LOGO_Y1 + 1.0 - 2.16); dibujar_guias(doc)

# 4. Contacto en tres columnas: ícono en círculo, rótulo y dato, bajo el logo
doc <- cierre(doc, "contacto en tres columnas")
wc_ <- 4.2; x0_ <- (W - 3 * wc_) / 2; y_ <- LOGO_Y1 + 0.5
for (k in seq_along(CTO)) { xk <- x0_ + (k - 1) * wc_
  if (k > 1) separador_v(doc, xk, y_ + 0.05, y_ + 1.15)
  icono_en_circulo(doc, CTO[[k]][1], xk + wc_ / 2 - 0.21, y_, 0.42)
  txt(doc, toupper(CTO[[k]][2]), xk, y_ + 0.5, wc_, 0.26, 10, TK$soft, bold = TRUE, align = "center")
  txt(doc, CTO[[k]][3], xk + 0.1, y_ + 0.76, wc_ - 0.2, 0.32, 12, TK$navy, align = "center") }
zona("logo y contacto en tres columnas", x0_, y_, 3 * wc_, 1.15); dibujar_guias(doc)
