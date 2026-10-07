# Recetario v2, Parte VI: banco de recursos (I55). Pedido de Gonzalo (2026-10-07): «¿por qué falta slide de bancos de
# íconos por temática, bancos de elementos como cuadros, figuras geométricas, etc. en el PPT?».
# Íconos de Lucide (licencia ISC, la librería de la app), exportados con iconos.py y rsvg-convert a 512 px en navy y blanco.
# Cajas, figuras y conectores: las mismas funciones con que se dibuja el resto del mazo, con su medida.

TEMAS <- list(
  list("Actores y personas", c(users = "Grupo", `user-round` = "Persona", `graduation-cap` = "Estudiante", briefcase = "Egresado",
                               `building-2` = "Institución", handshake = "Empleador", contact = "Contacto", baby = "Infancia")),
  list("Educación", c(`book-open` = "Formación", school = "Escuela", library = "Biblioteca", pencil = "Evaluación",
                      `notebook-pen` = "Registro", presentation = "Clase", award = "Logro", lightbulb = "Idea")),
  list("Trabajo y economía", c(`briefcase-business` = "Empleo", wallet = "Ingreso", banknote = "Efectivo", factory = "Industria",
                               `trending-up` = "Crecimiento", `chart-line` = "Tendencia", coins = "Ahorro", store = "Comercio")),
  list("Salud y bienestar", c(`heart-pulse` = "Salud", stethoscope = "Atención", hospital = "Centro de salud", brain = "Salud mental",
                              smile = "Bienestar", `shield-check` = "Protección", `hand-heart` = "Apoyo", activity = "Actividad")),
  list("Territorio", c(`map-pin` = "Ubicación", map = "Mapa", house = "Hogar", route = "Recorrido",
                       globe = "Internacional", trees = "Ambiente", landmark = "Gobierno", mountain = "Zona rural")),
  list("Metodología", c(`clipboard-list` = "Cuestionario", `list-checks` = "Validación", phone = "Telefónica", mail = "Correo",
                        `calendar-days` = "Campo", shuffle = "Muestreo", hash = "Conteo", scale = "Ponderación")))

lamina_iconos <- function(doc, temas, parte) {
  MOTOR_ACT <<- "Banco de íconos por temática (recurso de diseño, no es una lámina del motor)"
  doc <- nueva(doc); titulo(doc, sprintf("Íconos por temática (%s)", parte), ante = "Banco de recursos")
  wn <- 2.4; xi <- XC + wn; wc <- (W - MR - xi) / 8; hr <- (YF - YT) / length(temas); d <- 0.46
  for (k in seq_along(temas)) { y <- YT + (k - 1) * hr; tm <- temas[[k]]
    txt(doc, tm[[1]], XT, y + hr / 2 - 0.3, wn - 0.2, 0.4, 14, TK$navy, bold = TRUE)
    for (j in seq_along(tm[[2]])) { cx <- xi + (j - 0.5) * wc
      icono(doc, names(tm[[2]])[j], "navy", cx - d / 2, y + hr / 2 - 0.42, d)
      txt(doc, tm[[2]][[j]], cx - wc / 2, y + hr / 2 + 0.1, wc, 0.3, 10, TK$soft, align = "center") }
    if (ESTILO == "moderna" && k < length(temas)) separador_h(doc, XC, W - MR, y + hr - 0.04) }
  zona("banco de íconos: 8 por fila, 0.46 in", xi, YT, W - MR - xi, YF - YT)
  pie(doc, "Íconos de Lucide (licencia ISC), la librería que usa la app. Trazo de 1.75, sin relleno")
  doc
}

MOTOR_ACT <- "p_slide_seccion"; doc <- portadilla(doc, "VI", "Banco de recursos", "Íconos, cajas, figuras y conectores de la identidad, con su medida y su uso", icono = "clipboard-list")
doc <- lamina_iconos(doc, TEMAS[1:3], "1 de 2")
doc <- lamina_iconos(doc, TEMAS[4:6], "2 de 2")

# --- tamaños y fondos de los íconos
MOTOR_ACT <- "Banco de recursos: tamaños y fondos de los íconos"
doc <- nueva(doc); titulo(doc, "Cómo se usan los íconos", ante = "Banco de recursos")
casos <- list(list("En la cabecera", 0.3, "navy", NULL, "0.3 in, navy, junto al antetítulo"),
              list("En una lámina de población", 1.1, "blanco", TK$navy, "1.1 in, blanco sobre círculo navy"),
              list("En la portadilla de sección", 0.62, "blanco", TK$coral, "0.62 in, blanco sobre círculo coral"),
              list("En una ficha o lista", 0.42, "navy", NULL, "0.42 in, navy, alineado al texto"))
wc <- AC / 4
for (k in seq_along(casos)) { c_ <- casos[[k]]; cx <- XC + (k - 0.5) * wc; cy <- YT + 1.0
  if (is.null(c_[[4]])) icono(doc, "users", c_[[3]], cx - c_[[2]] / 2, cy - c_[[2]] / 2, c_[[2]]) else icono_en_circulo(doc, "users", cx - c_[[2]] / 2, cy - c_[[2]] / 2, c_[[2]], fondo = c_[[4]])
  txt(doc, c_[[1]], cx - wc / 2, cy + 0.75, wc, 0.32, 13, TK$navy, bold = TRUE, align = "center")
  txt(doc, c_[[5]], cx - wc / 2, cy + 1.08, wc, 0.3, 11, TK$soft, align = "center") }
lista_marcada(doc, c("Un ícono acompaña una idea. No se usa como adorno.", "Siempre de trazo, nunca relleno, y del mismo grosor en todo el informe.",
                     "Navy sobre fondo claro y blanco sobre círculo navy. El círculo coral queda para la portadilla de sección.",
                     "Al lado de un texto, el ícono mide lo mismo que la altura de dos líneas."), XC, YT + 2.75, AC, paso = 0.5, size = 12)
zona("cuatro usos del ícono", XC, YT + 0.4, AC, 1.9)
pie(doc, "Cuando un tema no tiene ícono en el banco, se busca en Lucide con el mismo trazo antes de usar otra librería")

# --- cajas y tarjetas
MOTOR_ACT <- "Banco de recursos: cajas y tarjetas (cifra, narrativa, panel, franja, nota)"
doc <- nueva(doc); titulo(doc, "Cajas y tarjetas", ante = "Banco de recursos")
c3 <- (AC - 2 * GAP) / 3; xs <- XC + (0:2) * (c3 + GAP); y1 <- YT + 0.05; y2 <- YT + 2.65
rot <- function(x, y, w, a, b) { txt(doc, a, x - 0.1, y, w + 0.2, 0.3, 12, TK$navy, bold = TRUE); txt(doc, b, x - 0.1, y + 0.28, w + 0.2, 0.5, 10, TK$soft) }
cifra(doc, xs[1], y1 + 0.2, c3, "77%", "conoce la misión", "134 de 172 estudiantes")
rot(xs[1], y1 + 1.55, c3, "Cifra destacada", "34 pt negrita, rótulo de 12 pt y detalle de 10 pt. Para una sola cifra que resume la lámina")
narrativa(doc, xs[2], y1 + 0.15, c3, 1.3, list(N_("El "), B("75 %"), N_(" de los docentes valora la tutoría.")), size = 14)
rot(xs[2], y1 + 1.55, c3, "Texto con filete", "Filete coral de 0.05 in y 14 pt. Para la lectura del gráfico, al costado")
panel_titulo(doc, xs[3], y1 + 0.2, c3, "¿Conoce la misión de la carrera?", "Base: 172 estudiantes")
caja(doc, xs[3], y1 + 0.95, c3 * 0.77, 0.3, TK$navy); caja(doc, xs[3] + c3 * 0.77, y1 + 0.95, c3 * 0.23, 0.3, TK$dico[2])
rot(xs[3], y1 + 1.55, c3, "Panel con pregunta", "Pregunta de 13 pt y base de 10 pt sobre el gráfico. Para láminas de dos a seis gráficos")
for (k in 1:3) { cifra(doc, xs[1] + (k - 1) * c3 / 3, y2 + 0.2, c3 / 3 - 0.1, c("172", "52", "178")[k], c("estudiantes", "docentes", "egresados")[k], size = 24)
  if (k > 1) separador_v(doc, xs[1] + (k - 1) * c3 / 3 - 0.08, y2 + 0.2, y2 + 1.1) }
rot(xs[1], y2 + 1.55, c3, "Franja de cifras", "Cifras de 24 pt separadas por filetes. Para la ficha técnica y el número de respuestas")
caja(doc, xs[2], y2 + 0.15, c3, 1.15, "#FFFFFF", line = sp_line(color = TK$rule, lwd = 0.75))
txt(doc, "Con menos de 30 casos, junto al porcentaje va el número de respuestas.", xs[2] + 0.1, y2 + 0.3, c3 - 0.2, 0.9, 12, TK$navy)
rot(xs[2], y2 + 1.55, c3, "Nota", "Caja blanca con borde de 0.75 pt. Sólo para una advertencia de lectura que el gráfico no muestra")
icono_en_circulo(doc, "graduation-cap", xs[3], y2 + 0.25, 0.8); cifra(doc, xs[3] + 1.0, y2 + 0.15, c3 - 1.0, "172", "estudiantes", size = 28)
rot(xs[3], y2 + 1.55, c3, "Tarjeta con ícono", "Ícono de 0.8 in y cifra de 28 pt. Para el perfil de cada público")
zona("seis cajas, tres columnas con separación de 0.5 in", XC, YT, AC, YF - YT)
pie(doc, "")

# --- figuras y conectores
MOTOR_ACT <- "Banco de recursos: figuras y conectores (marca numerada, llave, conector, guía, separadores, meta)"
doc <- nueva(doc); titulo(doc, "Figuras y conectores", ante = "Banco de recursos")
# marca numerada
for (k in 1:3) marca(doc, k, xs[1] + (k - 1) * 0.5, y1 + 0.45)
rot(xs[1], y1 + 1.55, c3, "Marca numerada", "Círculo de 0.32 in con número blanco de 11 pt. Para señalar partes de un ejemplo")
# llave de Top Two Box
xb_ <- xs[2]; wb_ <- c3; barra_apilada(doc, xb_, y1 + 0.75, wb_, c(12, 13, 35, 40), TK$likert[1:4], 0.4)
x3_ <- xb_ + wb_ * 0.25; x4_ <- xb_ + wb_
caja(doc, x3_, y1 + 0.5, x4_ - x3_, 0.025, TK$verde_txt); caja(doc, x3_, y1 + 0.5, 0.025, 0.18, TK$verde_txt); caja(doc, x4_ - 0.025, y1 + 0.5, 0.025, 0.18, TK$verde_txt)
caja(doc, (x3_ + x4_) / 2 - 0.0125, y1 + 0.32, 0.025, 0.18, TK$verde_txt)
rot(xs[2], y1 + 1.55, c3, "Llave", "Trazo verde de 0.025 in. Agrupa los dos valores que suman el Top Two Box")
# conector de desglose
caja(doc, xs[3], y1 + 0.3, c3 * 0.35, 0.3, TK$navy); caja(doc, xs[3] + c3 * 0.35, y1 + 0.3, c3 * 0.65, 0.3, TK$dico[2])
caja(doc, xs[3], y1 + 1.05, c3, 0.25, TK$likert[3])
zoom_conector(doc, c(xs[3], y1 + 0.6, xs[3] + c3 * 0.35, y1 + 0.6), c(xs[3], y1 + 1.05, xs[3] + c3, y1 + 1.05))
rot(xs[3], y1 + 1.55, c3, "Conector de desglose", "Cuña al 5% de opacidad. Une el «Sí» de una pregunta filtro con su subpregunta")
# guía de cifra chica
barra_apilada(doc, xs[1], y2 + 0.6, c3, c(2, 1, 50, 47), TK$likert[1:4], 0.4)
rot(xs[1], y2 + 1.55, c3, "Guía de cifra chica", "Línea gris de 0.3 pt. Sube la cifra que no cabe en su tramo")
# separadores
separador_h(doc, xs[2], xs[2] + c3, y2 + 0.4); separador_v(doc, xs[2] + c3 / 2, y2 + 0.6, y2 + 1.2)
rot(xs[2], y2 + 1.55, c3, "Separadores", "Filete gris de 0.008 in. Divide filas o columnas sin cerrar cajas")
# marca de meta
caja(doc, xs[3], y2 + 0.6, c3, 0.34, TK$zebra); caja(doc, xs[3], y2 + 0.6, c3 * 0.78, 0.34, TK$navy); caja(doc, xs[3] + c3 * 0.85, y2 + 0.5, 0.03, 0.54, TK$coral)
rot(xs[3], y2 + 1.55, c3, "Marca de meta", "Línea coral de 0.03 in sobre la barra. Indica la meta en estudios de monitoreo")
zona("seis figuras, tres columnas con separación de 0.5 in", XC, YT, AC, YF - YT)
pie(doc, "Todas las figuras son formas de PowerPoint: se editan y se copian entre láminas")
