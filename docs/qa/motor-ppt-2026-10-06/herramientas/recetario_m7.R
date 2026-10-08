# Recetario v2, Parte VI: banco de recursos (I55). Pedidos de Gonzalo (2026-10-07): «¿por qué falta slide de bancos de
# íconos por temática, bancos de elementos como cuadros, figuras geométricas, etc. en el PPT?» y «nos quedamos con Lucide,
# pero los bancos deben ser mucho más ricos y didácticos». Íconos de Lucide (licencia ISC, la librería de la app),
# exportados con iconos.py y rsvg-convert a 512 px. Cajas, figuras y diagramas con las mismas funciones del mazo.

TEMAS <- list(
  list("Actores y personas", "Perfil del encuestado y fichas de cada público",
       c(users = "Grupo", `user-round` = "Persona", `graduation-cap` = "Estudiante", briefcase = "Egresado", `building-2` = "Institución",
         handshake = "Empleador", contact = "Contacto", baby = "Infancia", `person-standing` = "Ciudadano", `user-check` = "Participante")),
  list("Educación", "Plan de estudios, docencia y servicios académicos",
       c(`book-open` = "Formación", school = "Escuela", library = "Biblioteca", pencil = "Evaluación", `notebook-pen` = "Registro",
         presentation = "Clase", award = "Logro", lightbulb = "Idea", backpack = "Escolar", `book-marked` = "Currículo")),
  list("Investigación y método", "Ficha técnica, diseño muestral y ponderación",
       c(`clipboard-list` = "Cuestionario", `list-checks` = "Validación", shuffle = "Muestreo", hash = "Conteo", scale = "Ponderación",
         `flask-conical` = "Prueba piloto", microscope = "Análisis", `file-search` = "Revisión", sigma = "Estadística", target = "Objetivo")),
  list("Campo y recolección", "Metodología de campo y avance del operativo",
       c(phone = "Telefónica", mail = "Correo", `tablet-smartphone` = "Tableta", `qr-code` = "Código QR", `map-pin` = "Ubicación",
         `calendar-days` = "Calendario", clock = "Duración", route = "Recorrido", `door-open` = "Visita", smartphone = "Celular")),
  list("Datos y análisis", "Procesamiento, resultados y tablas",
       c(`chart-column` = "Barras", `chart-pie` = "Proporción", `chart-line` = "Tendencia", table = "Tabla", database = "Base de datos",
         funnel = "Filtro", sheet = "Hoja de cálculo", calculator = "Cálculo", percent = "Porcentaje", layers = "Capas")),
  list("Trabajo y economía", "Situación laboral e ingresos del egresado",
       c(`briefcase-business` = "Empleo", wallet = "Ingreso", banknote = "Efectivo", factory = "Industria", `trending-up` = "Crecimiento",
         coins = "Ahorro", store = "Comercio", `hard-hat` = "Obra", `piggy-bank` = "Fondo", receipt = "Gasto")),
  list("Salud y bienestar", "Servicios de bienestar y estudios de salud",
       c(`heart-pulse` = "Salud", stethoscope = "Atención", hospital = "Hospital", brain = "Salud mental", smile = "Bienestar",
         `shield-check` = "Protección", `hand-heart` = "Apoyo", activity = "Actividad", pill = "Tratamiento", apple = "Nutrición")),
  list("Territorio y ambiente", "Hojas de ruta, cobertura y estudios territoriales",
       c(map = "Mapa", house = "Hogar", globe = "Internacional", trees = "Ambiente", landmark = "Gobierno local",
         mountain = "Zona rural", tractor = "Agro", droplets = "Agua", sun = "Clima", building = "Zona urbana")),
  list("Gobierno y participación", "Opinión pública y estudios de política",
       c(gavel = "Justicia", vote = "Voto", flag = "País", `scroll-text` = "Norma", `file-text` = "Documento",
         stamp = "Trámite", `badge-check` = "Verificado", megaphone = "Difusión", `messages-square` = "Diálogo", `share-2` = "Redes")),
  list("Calidad y acreditación", "Estándares, logros y recomendaciones",
       c(medal = "Mérito", trophy = "Premio", star = "Destacado", `circle-check` = "Cumple", `clipboard-check` = "Estándar",
         ruler = "Medición", gauge = "Indicador", `thumbs-up` = "Aprobación", `file-check` = "Informe", goal = "Meta")),
  list("Comunicación y tecnología", "Canales, medios y herramientas digitales",
       c(monitor = "Pantalla", laptop = "Virtual", wifi = "Conexión", cloud = "Nube", newspaper = "Prensa",
         video = "Video", mic = "Entrevista", camera = "Registro visual", `at-sign` = "Correo electrónico", `user-plus` = "Inscripción")),
  list("Inclusión y comunidad", "Estudios con poblaciones y programas sociales",
       c(`heart-handshake` = "Solidaridad", `hand-helping` = "Asistencia", accessibility = "Accesibilidad", languages = "Idiomas",
         church = "Comunidad", utensils = "Alimentación", bus = "Transporte", `shield-alert` = "Riesgo", sprout = "Desarrollo", `user-round` = "Familia")))

ok_mal <- function(doc, x, y, ok, t) {   # ✓ verde o ✗ coral con su motivo
  icono(doc, if (ok) "circle-check-big" else "circle-x", if (ok) "verde" else "coral", x, y, 0.3)
  txt(doc, t, x + 0.38, y - 0.04, 5.2, 0.4, 12, if (ok) TK$verde_txt else TK$coral, bold = TRUE)
}
cota_h <- function(doc, x0, x1, y, t) {   # cota horizontal con su medida, en el color de las guías
  caja(doc, x0, y, x1 - x0, 0.012, TK$guia); caja(doc, x0, y - 0.05, 0.012, 0.11, TK$guia); caja(doc, x1 - 0.012, y - 0.05, 0.012, 0.11, TK$guia)
  txt(doc, t, (x0 + x1) / 2 - 1, y - 0.3, 2, 0.26, 10, TK$guia, bold = TRUE, align = "center")
}
cota_v <- function(doc, x, y0, y1, t, lado = 1) {
  caja(doc, x, y0, 0.012, y1 - y0, TK$guia); caja(doc, x - 0.05, y0, 0.11, 0.012, TK$guia); caja(doc, x - 0.05, y1 - 0.012, 0.11, 0.012, TK$guia)
  txt(doc, t, if (lado > 0) x + 0.08 else x - 0.86, (y0 + y1) / 2 - 0.13, 0.78, 0.26, 10, TK$guia, bold = TRUE, align = if (lado > 0) "left" else "right")
}
rot <- function(x, y, w, a, b) { txt(doc, a, x - 0.1, y, w + 0.2, 0.3, 12, TK$navy, bold = TRUE); txt(doc, b, x - 0.1, y + 0.28, w + 0.2, 0.5, 10, TK$soft) }
c3 <- (AC - 2 * GAP) / 3; xs <- XC + (0:2) * (c3 + GAP)

MOTOR_ACT <- "p_slide_seccion"; doc <- portadilla(doc, "VI", "Banco de recursos", "Íconos, cajas, figuras y diagramas de la identidad: qué son, cuánto miden y cuándo se usan", icono = "layers")

# ================================================================== VI.1 íconos
lamina_iconos <- function(doc, temas, parte) {
  MOTOR_ACT <<- "Banco de íconos por temática (recurso de diseño, no es una lámina del motor)"
  doc <- nueva(doc); titulo(doc, sprintf("Íconos por temática (%s)", parte), ante = "Banco de recursos")
  wn <- 2.55; xi <- XC + wn; wc <- (W - MR - xi) / 10; hr <- (YF - YT) / length(temas); d <- 0.42
  for (k in seq_along(temas)) { y <- YT + (k - 1) * hr; tm <- temas[[k]]
    nl <- lineas(tm[[1]], wn - 0.2, 14, TRUE); y0 <- y + hr / 2 - 0.55   # la fila se centra en su alto
    txt(doc, tm[[1]], XT, y0, wn - 0.2, nl * 0.26 + 0.1, 14, TK$navy, bold = TRUE)
    txt(doc, tm[[2]], XT, y0 + nl * 0.26 + 0.12, wn - 0.25, 0.6, 10, TK$soft)
    for (j in seq_along(tm[[3]])) { cx <- xi + (j - 0.5) * wc
      icono(doc, names(tm[[3]])[j], "navy", cx - d / 2, y0 + 0.08, d)
      txt(doc, tm[[3]][[j]], cx - wc / 2 - 0.05, y0 + 0.58, wc + 0.1, 0.45, 10, TK$soft, align = "center") }
    if (ESTILO == "moderna" && k < length(temas)) separador_h(doc, XC, W - MR, y + hr - 0.04) }
  zona("banco de íconos: 10 por fila, 0.42 in", xi, YT, W - MR - xi, YF - YT)
  pie(doc, "Íconos de Lucide (licencia ISC), la librería de la app. Trazo de 1.75, sin relleno, en azul oscuro o en blanco")
  doc
}
for (p_ in 1:4) doc <- lamina_iconos(doc, TEMAS[(3 * p_ - 2):(3 * p_)], sprintf("%d de 4", p_))

# --- tamaños y fondos
MOTOR_ACT <- "Banco de recursos: tamaños y fondos de los íconos"
doc <- nueva(doc); titulo(doc, "Cómo se usan los íconos", ante = "Banco de recursos")
casos <- list(list("En la cabecera", 0.3, "navy", NULL, "0.3 in, azul oscuro, junto al antetítulo"),
              list("En una lámina de población", 1.1, "blanco", TK$navy, "1.1 in, blanco sobre círculo azul oscuro"),
              list("En la portadilla de sección", 0.62, "blanco", TK$coral, "0.62 in, blanco sobre círculo coral"),
              list("En una ficha o lista", 0.42, "navy", NULL, "0.42 in, azul oscuro, alineado al texto"))
wc4 <- AC / 4
for (k in seq_along(casos)) { c_ <- casos[[k]]; cx <- XC + (k - 0.5) * wc4; cy <- YT + 1.0
  if (is.null(c_[[4]])) icono(doc, "users", c_[[3]], cx - c_[[2]] / 2, cy - c_[[2]] / 2, c_[[2]]) else icono_en_circulo(doc, "users", cx - c_[[2]] / 2, cy - c_[[2]] / 2, c_[[2]], fondo = c_[[4]])
  txt(doc, c_[[1]], cx - wc4 / 2, cy + 0.75, wc4, 0.32, 13, TK$navy, bold = TRUE, align = "center")
  txt(doc, c_[[5]], cx - wc4 / 2, cy + 1.08, wc4, 0.3, 11, TK$soft, align = "center") }
lista_marcada(doc, c("Un ícono acompaña una idea. No se usa como adorno.", "Siempre de trazo, nunca relleno, y del mismo grosor en todo el informe.",
                     "Azul oscuro sobre fondo claro y blanco sobre círculo azul oscuro. El círculo coral queda para la portadilla de sección.",
                     "Al lado de un texto, el ícono mide lo mismo que la altura de dos líneas."), XC, YT + 2.75, AC, paso = 0.5, size = 12)
zona("cuatro usos del ícono", XC, YT + 0.4, AC, 1.9)
pie(doc, "Si un tema no tiene ícono en el banco, se busca en Lucide, con el mismo trazo, antes de pensar en otra librería")

# --- íconos en contexto
MOTOR_ACT <- "Banco de recursos: íconos en tres usos reales (ficha técnica, perfil, recomendaciones)"
doc <- nueva(doc); titulo(doc, "Los íconos en su contexto", ante = "Banco de recursos")
enc <- function(x, t) txt(doc, toupper(t), x - 0.1, YT - 0.05, c3, 0.26, 10, TK$soft, bold = TRUE)
enc(xs[1], "Ficha técnica")
fi <- list(c("clipboard-list", "Técnica", "Encuesta en línea"), c("users", "Actores", "Cuatro públicos"), c("hash", "Respuestas", "417 válidas"), c("calendar-days", "Campo", "Cuatro semanas"))
for (k in seq_along(fi)) { y <- YT + 0.35 + (k - 1) * 0.72
  icono(doc, fi[[k]][1], "navy", xs[1], y, 0.42); txt(doc, fi[[k]][2], xs[1] + 0.55, y - 0.04, c3 - 0.55, 0.28, 12, TK$navy, bold = TRUE)
  txt(doc, fi[[k]][3], xs[1] + 0.55, y + 0.22, c3 - 0.55, 0.28, 11, TK$soft) }
enc(xs[2], "Perfil del encuestado")
pf <- list(c("graduation-cap", "172", "estudiantes"), c("briefcase", "178", "egresados"), c("presentation", "52", "docentes"))
for (k in seq_along(pf)) { y <- YT + 0.35 + (k - 1) * 0.95
  icono_en_circulo(doc, pf[[k]][1], xs[2], y, 0.72); txt(doc, pf[[k]][2], xs[2] + 0.9, y - 0.02, 1.6, 0.48, 26, TK$navy, bold = TRUE)
  txt(doc, pf[[k]][3], xs[2] + 0.9, y + 0.44, 1.8, 0.28, 11, TK$soft) }
enc(xs[3], "Recomendaciones")
rc <- list(c("megaphone", "Difundir la misión entre estudiantes y egresados"), c("users", "Revisar la tutoría académica con los estudiantes"), c("scale", "Analizar los recursos asignados a la Unidad"))
for (k in seq_along(rc)) { y <- YT + 0.35 + (k - 1) * 0.95
  icono(doc, rc[[k]][1], "navy", xs[3], y + 0.02, 0.42); txt(doc, rc[[k]][2], xs[3] + 0.55, y - 0.04, c3 - 0.55, 0.62, 12, TK$navy) }
for (k in 1:2) separador_v(doc, xs[k] + c3 + GAP / 2, YT, YT + 3.2)
txt(doc, "En los tres casos el ícono abre la línea, mide lo mismo en toda la columna y el texto empieza a la misma distancia.", XT, YT + 3.55, AC, 0.35, 13, TK$navy, bold = TRUE)
zona("tres usos: ficha, perfil, recomendaciones", XC, YT, AC, 3.3)
pie(doc, "Cifras del proyecto de referencia de Contabilidad")

# --- hazlo y evita (íconos)
MOTOR_ACT <- "Banco de recursos: uso correcto e incorrecto de los íconos"
doc <- nueva(doc); titulo(doc, "Íconos: qué hacer y qué evitar", ante = "Banco de recursos")
xo <- XC; xm <- XC + AC / 2 + 0.2; hr <- (YF - YT) / 3
filas <- list(
  list("Todos del mismo tamaño", "Tamaños distintos en una fila",
       function(x, y) for (k in 0:3) icono(doc, c("users", "phone", "mail", "map-pin")[k + 1], "navy", x + k * 0.75, y + 0.45, 0.42),
       function(x, y) { ds <- c(0.24, 0.6, 0.34, 0.5); for (k in 0:3) icono(doc, c("users", "phone", "mail", "map-pin")[k + 1], "navy", x + k * 0.75, y + 0.66 - ds[k + 1] / 2, ds[k + 1]) }),
  list("Blanco sobre fondo oscuro", "Blanco sobre fondo claro: no se ve",
       function(x, y) icono_en_circulo(doc, "graduation-cap", x, y + 0.35, 0.7),
       function(x, y) icono_en_circulo(doc, "graduation-cap", x, y + 0.35, 0.7, fondo = TK$zebra)),
  list("Un ícono junto a su dato", "Íconos de adorno, sin dato",
       function(x, y) { icono(doc, "users", "navy", x, y + 0.45, 0.42); txt(doc, "417 respuestas válidas", x + 0.55, y + 0.47, 3, 0.35, 14, TK$navy, bold = TRUE) },
       function(x, y) for (k in 0:4) icono(doc, c("lightbulb", "star", "trophy", "award", "medal")[k + 1], "navy", x + k * 0.6, y + 0.45, 0.42)))
for (k in seq_along(filas)) { y <- YT + (k - 1) * hr; f_ <- filas[[k]]
  ok_mal(doc, xo, y + 0.02, TRUE, f_[[1]]); ok_mal(doc, xm, y + 0.02, FALSE, f_[[2]])
  f_[[3]](xo + 0.38, y); f_[[4]](xm + 0.38, y)
  if (k < 3) separador_h(doc, XC, W - MR, y + hr - 0.06) }
separador_v(doc, xm - 0.25, YT, YF - 0.1)
zona("tres pares: correcto a la izquierda, incorrecto a la derecha", XC, YT, AC, YF - YT)
pie(doc, "")

# ================================================================== VI.2 cajas
MOTOR_ACT <- "Banco de recursos: cajas y tarjetas (cifra, narrativa, panel, franja, nota)"
doc <- nueva(doc); titulo(doc, "Cajas y tarjetas", ante = "Banco de recursos")
y1 <- YT + 0.05; y2 <- YT + 2.65
cifra(doc, xs[1], y1 + 0.2, c3, "77%", "conoce la misión", "134 de 172 estudiantes")
rot(xs[1], y1 + 1.55, c3, "Cifra destacada", "34 pt negrita, rótulo de 12 pt y detalle de 10 pt. Para una sola cifra que resume la lámina")
narrativa(doc, xs[2], y1 + 0.15, c3, 1.3, list(N_("El "), B("75 %"), N_(" de los docentes valora la tutoría.")), size = 14)
rot(xs[2], y1 + 1.55, c3, "Texto con filete", "Filete coral de 0.05 in y texto de 14 pt. Para la lectura del gráfico, al costado")
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

# --- anatomía de una tarjeta
MOTOR_ACT <- "Banco de recursos: anatomía de la tarjeta con ícono, con sus cotas"
doc <- nueva(doc); titulo(doc, "Anatomía de una tarjeta", ante = "Banco de recursos")
bx <- XC + 0.9; by <- YT + 0.75; bw <- 4.4; bh <- 1.6; pd <- 0.25; di <- 0.9
caja(doc, bx, by, bw, bh, "#FFFFFF", line = sp_line(color = TK$rule, lwd = 0.75))
icono_en_circulo(doc, "graduation-cap", bx + pd, by + pd, di)
txt(doc, "172", bx + pd + di + 0.25 - 0.1, by + 0.18, 2.5, 0.65, 34, TK$navy, bold = TRUE)
txt(doc, "estudiantes", bx + pd + di + 0.25 - 0.1, by + 0.82, 2.5, 0.3, 13, TK$navy, bold = TRUE)
txt(doc, "41% de las respuestas", bx + pd + di + 0.25 - 0.1, by + 1.12, 2.8, 0.28, 11, TK$soft)
cota_h(doc, bx, bx + pd, by - 0.25, "0.25 in"); cota_h(doc, bx + pd, bx + pd + di, by - 0.25, "0.9 in")
cota_h(doc, bx + pd + di, bx + pd + di + 0.25, by + bh + 0.35, "0.25 in"); cota_v(doc, bx - 0.25, by, by + bh, "1.6 in", lado = -1)
cota_v(doc, bx + bw + 0.25, by, by + pd, "0.25 in")
specs <- list(c("Margen interior", "0.25 in en los cuatro lados"), c("Ícono", "0.9 in, blanco sobre círculo azul oscuro"), c("Cifra", "34 pt, negrita, azul oscuro"),
              c("Rótulo", "13 pt, negrita, azul oscuro"), c("Detalle", "11 pt, gris azulado"), c("Borde", "0.75 pt, gris claro, sin sombra"))
xsp <- bx + bw + 1.6
for (k in seq_along(specs)) { y <- YT + 0.4 + (k - 1) * 0.62
  marca(doc, k, xsp, y + 0.02); txt(doc, specs[[k]][1], xsp + 0.45, y - 0.04, 2.2, 0.3, 13, TK$navy, bold = TRUE); txt(doc, specs[[k]][2], xsp + 0.45, y + 0.24, W - MR - xsp - 0.45, 0.28, 11, TK$soft) }
txt(doc, "Las cotas en magenta son guías de medida. No se imprimen.", XT, YF - 0.4, 6, 0.3, 11, TK$guia, bold = TRUE)
zona("tarjeta a tamaño real con cotas", bx, by, bw, bh)
pie(doc, "La misma medida rige en todas las tarjetas del informe: si una crece, crecen todas")

# --- franjas por cantidad
MOTOR_ACT <- "Banco de recursos: franjas de 2 a 5 cifras"
doc <- nueva(doc); titulo(doc, "Franjas de cifras: de dos a cinco", ante = "Banco de recursos")
datos_f <- list(c("417", "respuestas"), c("52", "docentes"), c("172", "estudiantes"), c("178", "egresados"), c("15", "administrativos"))
hf <- 1.05; wl <- 1.4
for (n in 2:5) { y <- YT + (n - 2) * hf
  txt(doc, sprintf("%d cifras", n), XT, y + 0.3, wl, 0.32, 13, TK$soft, bold = TRUE)
  wcel <- (AC - wl) / n
  for (k in 1:n) { xk <- XC + wl + (k - 1) * wcel
    if (k > 1) separador_v(doc, xk - 0.06, y + 0.12, y + 0.85)
    txt(doc, datos_f[[k]][1], xk + 0.05, y + 0.08, wcel - 0.2, 0.5, if (n <= 3) 30 else 26, if (k == 1) TK$coral else TK$navy, bold = TRUE)
    txt(doc, datos_f[[k]][2], xk + 0.05, y + 0.6, wcel - 0.2, 0.28, 11, TK$soft) }
  if (n < 5) separador_h(doc, XC, W - MR, y + hf - 0.05) }
txt(doc, "Con más de cinco cifras, la información va en una tabla. La primera cifra, en coral, es el total.", XT, YF - 0.45, AC, 0.32, 13, TK$navy, bold = TRUE)
zona("cuatro franjas que reparten el mismo ancho", XC, YT, AC, 4 * hf)
pie(doc, "Cifras del proyecto de referencia de Contabilidad")

# --- hazlo y evita (cajas)
MOTOR_ACT <- "Banco de recursos: uso correcto e incorrecto de las cajas"
doc <- nueva(doc); titulo(doc, "Cajas: qué hacer y qué evitar", ante = "Banco de recursos")
wbx <- AC / 2 - 1.1
filas2 <- list(
  list("Borde fino o sin borde", "Sombra y borde grueso",
       function(x, y) { caja(doc, x, y + 0.42, wbx, 0.7, "#FFFFFF", line = sp_line(color = TK$rule, lwd = 0.75)); txt(doc, "Nota de lectura", x + 0.1, y + 0.6, wbx - 0.2, 0.3, 12, TK$navy) },
       function(x, y) { caja(doc, x + 0.08, y + 0.5, wbx, 0.7, "#9AA3B5"); caja(doc, x, y + 0.42, wbx, 0.7, "#FFFFFF", line = sp_line(color = TK$coral, lwd = 3)); txt(doc, "Nota de lectura", x + 0.1, y + 0.6, wbx - 0.2, 0.3, 12, TK$navy) }),
  list("Un solo fondo para todas", "Un color distinto por caja",
       function(x, y) for (k in 0:2) caja(doc, x + k * (wbx / 3), y + 0.42, wbx / 3 - 0.1, 0.7, "#FFFFFF", line = sp_line(color = TK$rule, lwd = 0.75)),
       function(x, y) for (k in 0:2) caja(doc, x + k * (wbx / 3), y + 0.42, wbx / 3 - 0.1, 0.7, c("#F4B183", "#9DC3E6", "#ADD493")[k + 1])),
  list("Texto a la izquierda, con margen", "Texto centrado y pegado al borde",
       function(x, y) { caja(doc, x, y + 0.42, wbx, 0.8, "#FFFFFF", line = sp_line(color = TK$rule, lwd = 0.75)); txt(doc, "El 75 % de los docentes valora la tutoría.", x + 0.15, y + 0.55, wbx - 0.3, 0.5, 12, TK$navy) },
       function(x, y) { caja(doc, x, y + 0.42, wbx, 0.8, "#FFFFFF", line = sp_line(color = TK$rule, lwd = 0.75)); txt(doc, "El 75 % de los docentes valora la tutoría.", x - 0.08, y + 0.44, wbx + 0.16, 0.5, 12, TK$navy, align = "center") }))
hr <- (YF - YT) / 3
for (k in seq_along(filas2)) { y <- YT + (k - 1) * hr; f_ <- filas2[[k]]
  ok_mal(doc, xo, y + 0.02, TRUE, f_[[1]]); ok_mal(doc, xm, y + 0.02, FALSE, f_[[2]])
  f_[[3]](xo + 0.38, y); f_[[4]](xm + 0.38, y)
  if (k < 3) separador_h(doc, XC, W - MR, y + hr - 0.06) }
separador_v(doc, xm - 0.25, YT, YF - 0.1)
zona("tres pares: correcto a la izquierda, incorrecto a la derecha", XC, YT, AC, YF - YT)
pie(doc, "")

# ================================================================== VI.3 figuras y diagramas
MOTOR_ACT <- "Banco de recursos: figuras y conectores (marca numerada, llave, conector, guía, separadores, meta)"
doc <- nueva(doc); titulo(doc, "Figuras y conectores", ante = "Banco de recursos")
for (k in 1:3) marca(doc, k, xs[1] + (k - 1) * 0.5, y1 + 0.45)
rot(xs[1], y1 + 1.55, c3, "Marca numerada", "Círculo de 0.32 in con número blanco de 11 pt. Para señalar partes de un ejemplo")
xb_ <- xs[2]; wb_ <- c3; barra_apilada(doc, xb_, y1 + 0.75, wb_, c(12, 13, 35, 40), TK$likert[1:4], 0.4)
x3_ <- xb_ + wb_ * 0.25; x4_ <- xb_ + wb_
caja(doc, x3_, y1 + 0.5, x4_ - x3_, 0.025, TK$verde_txt); caja(doc, x3_, y1 + 0.5, 0.025, 0.18, TK$verde_txt); caja(doc, x4_ - 0.025, y1 + 0.5, 0.025, 0.18, TK$verde_txt)
caja(doc, (x3_ + x4_) / 2 - 0.0125, y1 + 0.32, 0.025, 0.18, TK$verde_txt)
rot(xs[2], y1 + 1.55, c3, "Llave de suma", "Trazo verde de 0.025 in. Agrupa los dos valores que suman el Top Two Box")
caja(doc, xs[3], y1 + 0.3, c3 * 0.35, 0.3, TK$navy); caja(doc, xs[3] + c3 * 0.35, y1 + 0.3, c3 * 0.65, 0.3, TK$dico[2])
xcl_ <- llave_h(doc, xs[3], xs[3] + c3 * 0.35, y1 + 0.64, y1 + 1.1); caja(doc, xcl_, y1 + 1.1 - 0.011, 0.2, 0.022, TK$navy)   # la llave reemplaza a la cuña (C36)
caja(doc, xcl_ + 0.26, y1 + 1.04, c3 * 0.45, 0.07, TK$navy); caja(doc, xcl_ + 0.26, y1 + 1.17, c3 * 0.3, 0.045, TK$faint)
rot(xs[3], y1 + 1.55, c3, "Llave de dependencia", "Trazo azul oscuro de 0.022 in. Une la respuesta que habilita una subpregunta con esa subpregunta")
barra_apilada(doc, xs[1], y2 + 0.6, c3, c(2, 1, 50, 47), TK$likert[1:4], 0.4)
rot(xs[1], y2 + 1.55, c3, "Guía de cifra chica", "Línea gris de 0.3 pt. Sube la cifra que no cabe en su tramo")
separador_h(doc, xs[2], xs[2] + c3, y2 + 0.4); separador_v(doc, xs[2] + c3 / 2, y2 + 0.6, y2 + 1.2)
rot(xs[2], y2 + 1.55, c3, "Separadores", "Filete gris de 0.008 in. Divide filas o columnas sin cerrar cajas")
caja(doc, xs[3], y2 + 0.6, c3, 0.34, TK$zebra); caja(doc, xs[3], y2 + 0.6, c3 * 0.78, 0.34, TK$navy); caja(doc, xs[3] + c3 * 0.85, y2 + 0.5, 0.03, 0.54, TK$coral)
rot(xs[3], y2 + 1.55, c3, "Marca de meta", "Línea coral de 0.03 in sobre la barra. Indica la meta en estudios de monitoreo")
zona("seis figuras, tres columnas con separación de 0.5 in", XC, YT, AC, YF - YT)
pie(doc, "Todas las figuras son formas de PowerPoint: se editan y se copian entre láminas")

# --- llaves de dependencia (Gonzalo, 2026-10-07: «faltan más ejemplos de llaves de dependencia, y en el banco de recursos usarlo»)
MOTOR_ACT <- "Banco de recursos: llaves de dependencia (llave_h, llave_v)"
doc <- nueva(doc); titulo(doc, "Llaves de dependencia", ante = "Banco de recursos")
gl <- 0.45; wl4 <- (AC - 2 * gl) / 3;   # tres usos: la cadena de tres niveles no se lee bien (Gonzalo)
 hl4 <- 2.25; yl4 <- YT - 0.05
tarjeta_ll <- function(x) caja(doc, x, yl4, wl4, hl4, "#FFFFFF", line = sp_line(color = TK$rule, lwd = 0.75))
lin_t <- function(x, y, w) { caja(doc, x, y, w, 0.07, TK$navy); caja(doc, x, y + 0.13, w * 0.7, 0.045, TK$faint) }   # título y base de la subpregunta
# 1. bajo una categoría
x1_ <- XC; tarjeta_ll(x1_); p_ <- 0.2; wi_ <- wl4 - 2 * p_
caja(doc, x1_ + p_, yl4 + 0.3, wi_ * 0.35, 0.22, TK$navy); caja(doc, x1_ + p_ + wi_ * 0.35, yl4 + 0.3, wi_ * 0.65, 0.22, TK$dico[2])
xc_ <- llave_h(doc, x1_ + p_, x1_ + p_ + wi_ * 0.35, yl4 + 0.56, yl4 + 1.0); caja(doc, xc_, yl4 + 1.0 - 0.011, 0.18, 0.022, TK$navy)
lin_t(xc_ + 0.24, yl4 + 0.94, wi_ * 0.5); seg_ <- function(x, y, w, pc, cols, h) { xx <- x; for (j in seq_along(pc)) { caja(doc, xx, y, w * pc[j] / sum(pc), h, cols[j]); xx <- xx + w * pc[j] / sum(pc) } }
seg_(x1_ + p_, yl4 + 1.45, wi_, c(10, 25, 40, 25), TK$likert[1:4], 0.26)
# 2. al costado
x2c <- XC + (wl4 + gl); tarjeta_ll(x2c)
caja(doc, x2c + p_, yl4 + 0.85, wi_ * 0.42 * 0.3, 0.3, TK$dico[2]); caja(doc, x2c + p_ + wi_ * 0.42 * 0.3, yl4 + 0.85, wi_ * 0.42 * 0.7, 0.3, TK$navy)
yc2 <- llave_v(doc, x2c + p_ + wi_ * 0.42 + 0.06, yl4 + 0.85, yl4 + 1.15, x2c + p_ + wi_ * 0.55)
xs2 <- x2c + p_ + wi_ * 0.58; lin_t(xs2, yl4 + 0.35, wi_ * 0.4)
for (j in 0:3) caja(doc, xs2, yl4 + 0.75 + j * 0.3, (wi_ * 0.42) * c(0.9, 0.6, 0.75, 0.4)[j + 1], 0.16, if (j == 0) TK$navy else TK$tenue)
# 3. sobre varias categorías
x3c <- XC + 2 * (wl4 + gl); tarjeta_ll(x3c)
for (j in 0:4) caja(doc, x3c + p_, yl4 + 0.3 + j * 0.3, wi_ * 0.5 * c(0.95, 0.5, 0.3, 0.4, 0.2)[j + 1], 0.16, if (j < 3) TK$navy else TK$tenue)
yc3 <- llave_v(doc, x3c + p_ + wi_ * 0.52, yl4 + 0.3, yl4 + 0.3 + 2 * 0.3 + 0.16, x3c + p_ + wi_ * 0.62)
lin_t(x3c + p_ + wi_ * 0.66, yc3 - 0.25, wi_ * 0.32); caja(doc, x3c + p_ + wi_ * 0.66, yc3 + 0.1, wi_ * 0.34 * 0.8, 0.2, TK$navy); caja(doc, x3c + p_ + wi_ * 0.66 + wi_ * 0.34 * 0.8, yc3 + 0.1, wi_ * 0.34 * 0.2, 0.2, TK$dico[2])
casos_ll <- list(c("Bajo una categoría", "El «Sí» de una pregunta filtro abre su subpregunta, que va debajo a todo el ancho"),
                 c("Al costado", "Cuando la subpregunta tiene varias categorías y necesita el alto de la lámina"),
                 c("Sobre varias categorías", "Cuando la subpregunta la habilitan dos o más respuestas, como las modalidades de trabajo"))
for (k in 1:3) { x <- XC + (k - 1) * (wl4 + gl)
  txt(doc, casos_ll[[k]][1], x - 0.1, yl4 + hl4 + 0.12, wl4 + 0.2, 0.3, 14, TK$navy, bold = TRUE)
  txt(doc, casos_ll[[k]][2], x - 0.1, yl4 + hl4 + 0.44, wl4 + 0.2, 0.8, 12, TK$soft) }
separador_h(doc, XC, W - MR, yl4 + hl4 + 1.3)
reglas_ll <- c("Trazo azul oscuro de 0.022 in, alas de 0.1 in. Igual en todo el informe.", "El tallo termina en el título de la subpregunta, nunca dentro del gráfico.",
               "La subpregunta dice su base: «Sólo los 139 que trabajan».")
for (k in 1:3) txt(doc, reglas_ll[k], XC + (k - 1) * (AC / 3) - 0.1, yl4 + hl4 + 1.45, AC / 3 - 0.1, 0.6, 12, TK$navy, bold = TRUE)
zona("tres usos de la llave de dependencia", XC, yl4, AC, hl4)
pie(doc, "Los ejemplos completos están en IV.1: pregunta filtro, filtro al costado y llave sobre varias categorías. Una llave abre un solo nivel")

# --- formas básicas
MOTOR_ACT <- "Banco de recursos: formas básicas y su uso"
doc <- nueva(doc); titulo(doc, "Formas básicas", ante = "Banco de recursos")
c4 <- (AC - 3 * 0.4) / 4; x4s <- XC + (0:3) * (c4 + 0.4)
formas <- list(list("ellipse", "Círculo", "Fondo de ícono, marca numerada y punto de un gráfico"), list("rect", "Rectángulo", "Barra, caja y franja. Siempre con esquinas rectas"),
               list("linea", "Línea", "Separador, guía y eje. Gris claro, nunca negra"), list("rightArrow", "Flecha", "Sólo para indicar un paso o un cambio entre dos momentos"),
               list("chevron", "Chevrón", "Etapas consecutivas de un proceso"), list("homePlate", "Pentágono", "Primera etapa o etiqueta de un proceso"),
               list("triangle", "Triángulo", "Hito puntual de un cronograma"), list("llave", "Llave", "Agrupa elementos que se suman, o une una respuesta con su subpregunta"))
for (k in seq_along(formas)) { f_ <- formas[[k]]; col <- (k - 1) %% 4; fil <- (k - 1) %/% 4
  x <- x4s[col + 1]; y <- YT + 0.1 + fil * 2.5
  if (f_[[1]] == "linea") caja(doc, x, y + 0.5, c4 * 0.8, 0.02, TK$rule)
  else if (f_[[1]] == "llave") { caja(doc, x, y + 0.5, c4 * 0.8, 0.025, TK$verde_txt); caja(doc, x, y + 0.5, 0.025, 0.2, TK$verde_txt); caja(doc, x + c4 * 0.8 - 0.025, y + 0.5, 0.025, 0.2, TK$verde_txt); caja(doc, x + c4 * 0.4 - 0.0125, y + 0.32, 0.025, 0.18, TK$verde_txt) }
  else caja(doc, x, y + 0.1, if (f_[[1]] %in% c("ellipse", "triangle")) 0.85 else c4 * 0.8, 0.85, if (f_[[1]] == "rect") TK$tenue else TK$navy, geom = f_[[1]])
  rot(x, y + 1.15, c4, f_[[2]], f_[[3]]) }
zona("ocho formas en dos filas", XC, YT, AC, YF - YT)
pie(doc, "Sin sombras, sin degradados ni efectos 3D. Las esquinas redondeadas no son parte de la identidad")

# --- diagrama de proceso
MOTOR_ACT <- "Banco de recursos: diagrama de proceso de un estudio"
doc <- nueva(doc); titulo(doc, "Diagrama de proceso", ante = "Banco de recursos")
pasos <- list(c("clipboard-list", "Diseño", "Objetivos e instrumento"), c("shuffle", "Muestra", "Marco y selección"), c("phone", "Campo", "Aplicación y monitoreo"),
              c("list-checks", "Validación", "Base limpia y consistente"), c("chart-column", "Informe", "Resultados y recomendaciones"))
wp <- AC / 5; dc <- 0.8; yc <- YT + 0.25
caja(doc, XC + wp / 2, yc + dc / 2 - 0.01, wp * 4, 0.02, TK$rule)
for (k in seq_along(pasos)) { cx <- XC + (k - 0.5) * wp
  icono_en_circulo(doc, pasos[[k]][1], cx - dc / 2, yc, dc); marca(doc, k, cx + dc / 2 - 0.2, yc - 0.1, d = 0.3)
  txt(doc, pasos[[k]][2], cx - wp / 2, yc + dc + 0.12, wp, 0.32, 14, TK$navy, bold = TRUE, align = "center")
  txt(doc, pasos[[k]][3], cx - wp / 2 + 0.1, yc + dc + 0.45, wp - 0.2, 0.5, 11, TK$soft, align = "center") }
txt(doc, "Variante en una línea, para la ficha técnica", XT, YT + 2.55, 6, 0.3, 12, TK$soft, bold = TRUE)
for (k in seq_along(pasos)) { xk <- XC + (k - 1) * (AC / 5)
  fk <- if (k == 3) TK$navy else "#C9D3E6"   # blanco sobre el gris azulado quedaba en 2.7:1
  caja(doc, xk, YT + 2.95, AC / 5 + 0.12, 0.62, fk, geom = if (k == 1) "homePlate" else "chevron")
  txt(doc, pasos[[k]][2], xk + 0.25, YT + 3.08, AC / 5 - 0.4, 0.36, 13, texto_sobre(fk), bold = TRUE, align = "center") }
txt(doc, "La etapa en curso va en azul oscuro y las demás en azul claro, con letra oscura.", XT, YT + 3.8, AC, 0.32, 12, TK$navy)
zona("cinco etapas con ícono y su variante en chevrones", XC, YT, AC, 4.0)
pie(doc, "Para metodología, cronograma y avance del estudio. Hasta seis etapas en una lámina")

# --- embudo de la muestra
MOTOR_ACT <- "Banco de recursos: de la muestra prevista a las encuestas efectivas"
doc <- nueva(doc); titulo(doc, "De la muestra prevista a las efectivas", ante = "Banco de recursos")
emb <- list(c("Marco muestral", 1850), c("Elegibles", 1512), c("Contactados", 980), c("Efectivas", 417))
wl2 <- 2.4; xb2 <- XC + wl2; wb2 <- W - MR - xb2 - 2.6
for (k in seq_along(emb)) { y <- YT + 0.3 + (k - 1) * 1.0; v <- as.numeric(emb[[k]][2])
  txt(doc, emb[[k]][1], XT, y + 0.04, wl2 - 0.1, 0.36, 14, TK$navy, bold = TRUE)
  caja(doc, xb2, y, wb2 * v / 1850, 0.44, if (k == 4) TK$navy else TK$tenue)
  txt(doc, format(v, big.mark = ","), xb2 + wb2 * v / 1850 + 0.12, y + 0.02, 1.2, 0.4, 16, TK$navy, bold = TRUE)
  if (k > 1) txt(doc, sprintf("%d%% del paso anterior", round(100 * v / as.numeric(emb[[k - 1]][2]))), W - MR - 2.4, y + 0.05, 2.4, 0.36, 12, TK$soft, align = "right") }
txt(doc, "Las barras empiezan en el mismo punto: se compara el largo, igual que en las barras apiladas.", XT, YT + 4.4, AC, 0.32, 13, TK$navy, bold = TRUE)
zona("embudo con barras alineadas", XC, YT, AC, 4.2)
pie(doc, "Para la ficha técnica y los informes de avance de Monitoreo. Cifras ficticias")
