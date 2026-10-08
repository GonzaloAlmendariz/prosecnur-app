# Propuestas inspiradas en un informe externo de referencia (pedidos de Gonzalo, 2026-10-08: «haz la propuesta de todo lo
# rescatable en un ppt aparte para hacer comentarios y evaluar su integración» y, sobre la primera versión, «parece un calco;
# lo que busco es inspiración en base a la línea gráfica de PULSO» y «nuestro motor genera gráficos y elementos
# cuantitativos, no barras de texto; me preocupa que el motor también tenga que hacerlo desde la app»).
# Segunda versión: cada idea se dibuja con los recursos propios de PULSO (portadilla con personas y público, cifra destacada,
# íconos en círculo, filetes grises, columna verde del Top Two Box) y su contenido lo calcula el motor; lo que se escribe a
# mano se reduce a rótulos cortos, que la app ya edita con los campos de texto de Gráficos (ArgField, `texto`).
# El informe de referencia es confidencial y no entra al repo. Datos del recetario de Contabilidad o cifras ficticias.
# Se ejecuta con SOLO=rescatables desde recetario.R.
sf <- function(pct, valid) { n <- round(pct * valid / 100); list(pct = pct, n = n, valid = valid) }
fila_s <- function(actor, pct, valid) list(actor = actor, f = sf(pct, valid))
b2b <- function(f) f$pct[1] + f$pct[2]
NARANJA_TXT <- "#A44A1F"   # cifra del Bottom Two Box: el naranja de la escala oscurecido para leerse sobre el fondo

# ---------------------------------------------------------------- portada y tabla de evaluación
doc <- nueva(doc, "Title Slide")
txt(doc, "PROPUESTAS PARA EL RECETARIO", 1.6, 2.12, 10.1, 0.32, 13, TK$coral, bold = TRUE, align = "center")
txt(doc, "Ideas de referencia, en la línea de PULSO", 0.8, 2.5, 11.7, 0.7, 32, TK$navy, bold = TRUE, align = "center")
txt(doc, "Cada idea dibujada con los recursos de la identidad y con contenido que calcula el motor", 1.6, 3.3, 10.1, 0.4, 18, TK$navy, align = "center")
txt(doc, "Octubre de 2026", 1.6, 3.75, 10.1, 0.4, 16, TK$soft, align = "center")

doc <- nueva(doc); titulo(doc, "Qué se propone, de dónde sale y dónde viviría", ante = "Para evaluar")
ev <- data.frame(`#` = 1:7,
  Propuesta = c("Número del capítulo como protagonista", "Hallazgos clave en cifras", "Bottom Two Box junto al Top Two Box", "Peso de cada aspecto en la satisfacción",
                "Letras de significancia en la tabla resumen", "Fila Total separada", "Pregunta exacta en el pie"),
  `La idea` = c("Jerarquía de capítulos sin texto extra", "Abrir el informe con cuatro datos", "Cuántos están insatisfechos, sin sumar a ojo", "Qué importa, además de qué se evalúa bien",
                "Diferencias entre públicos en la misma tabla", "La referencia se distingue de los grupos", "Se lee la pregunta tal como se aplicó"),
  `Lo calcula el motor` = c("Número y título del plan", "Las cuatro cifras", "Toda la columna", "Todo, con un análisis nuevo", "Las letras (ya existen en barras)", "Toda la fila", "Sale del instrumento"),
  `Se escribe en la app` = c("Nada", "Un rótulo corto por cifra", "Nada", "Nada", "Nada", "Nada", "Nada"),
  Esfuerzo = c("Bajo", "Medio", "Bajo", "Alto", "Medio", "Bajo", "Bajo"), check.names = FALSE)
ft <- flextable(ev) |> font(fontname = TK$font, part = "all") |> fontsize(size = 11.5, part = "all") |> fontsize(size = 10.5, part = "header") |>
  color(color = TK$navy, part = "all") |> bold(part = "header") |> bold(j = 2) |> border_remove() |>
  border_inner_h(border = fp_border(color = TK$rule, width = 0.5)) |> hline_top(border = fp_border(color = TK$navy, width = 1), part = "header") |>
  hline_bottom(border = fp_border(color = TK$navy, width = 1), part = "header") |> padding(padding.top = 5, padding.bottom = 5, part = "all") |>
  width(j = 1, width = 0.4) |> width(j = 2, width = 3.3) |> width(j = 3, width = 3.4) |> width(j = 4, width = 2.6) |> width(j = 5, width = 1.75) |> width(j = 6, width = 0.9) |>
  valign(valign = "center", part = "all")
invisible(ph_with(doc, ft, location = ph_location(left = XC, top = YT - 0.1, width = 12.35, height = 4.5)))
pie(doc, "Esfuerzo bajo: cambio de dibujo. Medio: constructor o pieza nueva. Alto: análisis nuevo en Analítica")

# ---------------------------------------------------------------- 1. número del capítulo como protagonista (sobre la portadilla de PULSO)
sep_numero <- function(doc, num, t, sub, size_n = 96) {
  doc <- nueva(doc, "Section Header")
  wn <- ancho_tinta(num, size_n, TRUE)
  txt(doc, num, 2.5, 3.45, wn + 0.4, 1.6, size_n, TK$coral, bold = TRUE)
  xt <- 2.6 + wn + 0.45; caja(doc, xt - 0.25, 3.95, 0.04, 1.2, TK$coral)
  ht <- alto_txt(t, W - MR - xt, 30, TRUE)
  txt(doc, t, xt, 3.85, W - MR - xt, ht, 30, TK$navy, bold = TRUE)
  txt(doc, sub, xt, 3.85 + ht, W - MR - xt, 0.4, 15, TK$soft)
  doc }
sep_circulo <- function(doc, num, t, sub) {
  doc <- nueva(doc, "Section Header")
  caja(doc, 2.6, 3.75, 1.35, 1.35, TK$coral, geom = "ellipse")
  txt(doc, num, 2.5, 4.05, 1.55, 0.8, 40, "#FFFFFF", bold = TRUE, align = "center")
  txt(doc, t, 4.3, 3.95, W - MR - 4.3, 0.7, 32, TK$navy, bold = TRUE); txt(doc, sub, 4.3, 4.65, W - MR - 4.3, 0.4, 15, TK$soft)
  doc }
doc <- sep_numero(doc, "02", "Características institucionales", "Misión, propósitos, gestión y planificación")
doc <- sep_numero(doc, "2.1", "Misión y propósitos", "Conocimiento entre los cuatro públicos", size_n = 72)
doc <- sep_circulo(doc, "02", "Características institucionales", "Misión, propósitos, gestión y planificación")
doc <- nueva(doc); titulo(doc, "La portadilla de PULSO con el número al frente", ante = "Propuesta 1: número del capítulo")
pts1 <- c("Se conservan las personas, la línea coral punteada y el público de la portadilla actual.",
          "El número del capítulo pasa a ser el elemento grande, en coral: 02 para capítulos y 2.1 para subcapítulos, más chico.",
          "Una variante pone el número dentro del círculo coral que hoy lleva el ícono.",
          "El motor ya tiene el número y el título en el plan: no se escribe nada nuevo.")
for (k in seq_along(pts1)) { yk <- YT + (k - 1) * 0.7; caja(doc, XC, yk + 0.02, 0.32, 0.32, TK$navy, geom = "ellipse")
  txt(doc, k, XC, yk + 0.04, 0.32, 0.28, 11, "#FFFFFF", bold = TRUE, align = "center"); txt(doc, pts1[k], XC + 0.45, yk, AC - 0.45, 0.6, 14, TK$navy) }
pie(doc, "Viviría en p_slide_seccion (estilo «número») sobre el layout «Section Header» de la plantilla. Sin texto nuevo")

# ---------------------------------------------------------------- 2. hallazgos clave en cifras (cifra destacada de PULSO)
doc <- nueva(doc); titulo(doc, "Cuatro datos para empezar", ante = "Propuesta 2: hallazgos clave en cifras")
hc <- list(c("landmark", "98 %", "de los docentes conoce la misión", "Estudiantes 77 %, egresados 78 %"),
           c("hand-helping", "53 %", "de los estudiantes ve tutoría académica", "Entre los docentes, 83 %"),
           c("award", "95 %", "valora las competencias técnicas", "Top Two Box de los estudiantes"),
           c("graduation-cap", "31 %", "de los egresados tiene el título", "Aunque el 98 % trabaja"))
gap <- 0.45; wc <- (AC - 3 * gap) / 4
for (k in 1:4) { x <- XC + (k - 1) * (wc + gap)
  if (k > 1) separador_v(doc, x - gap / 2, YT + 0.2, YT + 3.3)
  icono_en_circulo(doc, hc[[k]][1], x, YT + 0.3, 0.62)
  txt(doc, hc[[k]][2], x - 0.1, YT + 1.1, wc + 0.1, 0.75, 40, TK$navy, bold = TRUE)   # cifra destacada con rótulo de dos líneas
  txt(doc, hc[[k]][3], x - 0.1, YT + 1.85, wc + 0.1, 0.5, 12, TK$navy, bold = TRUE)
  txt(doc, hc[[k]][4], x - 0.1, YT + 2.4, wc + 0.1, 0.3, 10, TK$soft) }
separador_h(doc, XC, W - MR, YT + 3.75)
txt(doc, "La cifra y su detalle los calcula el motor. El rótulo corto se escribe en la app, como el texto de una lámina narrativa.", XT, YT + 3.95, AC, 0.4, 13, TK$navy, bold = TRUE)
pie(doc, "Constructor nuevo p_slide_cifras_clave (dos a cuatro cifras con ícono). Cifras del recetario de Contabilidad")

# ---------------------------------------------------------------- 3 y 6. Bottom Two Box y fila Total separada (en el bloque Likert de PULSO)
filas_pulso <- function(doc, x, y, w, premisa, filas, peso = NULL, fila = 0.46, wlab = 1.6) {
  wpeso <- if (is.null(peso)) 0 else 1.5; wcol <- 1.25; xb <- x + wpeso + wlab + 0.12; wb <- w - wpeso - wlab - 0.12 - 2 * wcol - 0.15
  xt2 <- xb + wb + 0.1; xb2 <- xt2 + wcol; g <- 0.28
  txt(doc, premisa, x - 0.1, y, w, 0.34, 13, TK$navy, bold = TRUE)
  yh <- y + 0.42
  txt(doc, "Top Two Box", xt2 - 0.05, yh, wcol + 0.1, 0.26, 10, TK$verde_txt, bold = TRUE, align = "center")
  txt(doc, "Bottom Two Box", xb2 - 0.1, yh, wcol + 0.2, 0.26, 10, NARANJA_TXT, bold = TRUE, align = "center")
  if (!is.null(peso)) txt(doc, "Peso en la satisfacción", x - 0.1, yh, wpeso + 0.3, 0.26, 10, TK$soft, bold = TRUE)
  yy <- yh + 0.3
  for (k in seq_along(filas)) { fl <- filas[[k]]; es_tot <- identical(fl$actor, "Total"); yb <- yy + (fila - g) / 2
    if (!is.null(peso)) { pk <- peso[k]
      if (is.na(pk)) txt(doc, "sin efecto", x - 0.1, yb + (g - 0.28) / 2, wpeso, 0.28, 10, TK$soft) else {   # punto sobre una línea, como el ranking con puntos
        lw <- (wpeso - 0.6) * pk / 50; caja(doc, x, yb + g / 2 - 0.006, lw, 0.012, TK$faint); caja(doc, x + lw - 0.07, yb + g / 2 - 0.07, 0.14, 0.14, TK$navy, geom = "ellipse")
        txt(doc, paste0(pk, "%"), x + lw + 0.05, yb + (g - 0.3) / 2, 0.6, 0.3, 12, TK$navy, bold = TRUE) } }
    hl <- alto_txt(fl$actor, wlab, 12, TRUE)
    txt(doc, fl$actor, x + wpeso, yb + (g - hl) / 2, wlab, hl, 12, TK$navy, bold = TRUE, align = "right")
    barra_apilada(doc, xb, yb, wb, fl$f$pct, TK$likert, g)
    txt(doc, paste0(ttb(fl$f), "%"), xt2, yb + (g - 0.3) / 2, wcol, 0.3, 13, TK$verde_txt, bold = TRUE, align = "center")
    txt(doc, paste0(b2b(fl$f), "%"), xb2, yb + (g - 0.3) / 2, wcol, 0.3, 13, NARANJA_TXT, bold = TRUE, align = "center")
    if (es_tot) separador_h(doc, x + wpeso, x + w, yy + fila + 0.04)   # la fila Total se separa con el filete gris de la identidad
    yy <- yy + fila + (if (es_tot) 0.1 else 0) }
  invisible(yy) }
tot <- function(a, na, b, nb) round((a * na + b * nb) / (na + nb))
doc <- nueva(doc); titulo(doc, "Servicios de tutoría", ante = "Propuestas 3 y 6: Bottom Two Box y fila Total")
d1 <- c(0, 2, 29, 54, 15); e1 <- c(6, 18, 34, 19, 23); d2 <- c(0, 2, 31, 44, 23); e2 <- c(3, 6, 45, 32, 13)
y_ <- filas_pulso(doc, XC, YT - 0.1, AC, "La Unidad cuenta con servicios de tutoría académica",
                  list(fila_s("Total", tot(d1, 52, e1, 172), 224), fila_s("Docentes", d1, 52), fila_s("Estudiantes", e1, 172)))
separador_h(doc, XC, W - MR, y_ + 0.12)
filas_pulso(doc, XC, y_ + 0.28, AC, "La Unidad cuenta con servicios de tutoría socioemocional",
            list(fila_s("Total", tot(d2, 52, e2, 172), 224), fila_s("Docentes", d2, 52), fila_s("Estudiantes", e2, 172)))
leyenda(doc, 0, Y_LEY - 0.05, LIKERT_ROT, TK$likert, centrar_en = W / 2)
pie(doc, "bloque_likert y likert_panel: columna Bottom Two Box opcional, con el mismo trato que el Top Two Box. Base: 52 docentes y 172 estudiantes")

# ---------------------------------------------------------------- 4. peso de cada aspecto (puntos, como el ranking de PULSO)
doc <- nueva(doc); titulo(doc, "Satisfacción con la atención en la Unidad", ante = "Propuesta 4: peso en la satisfacción")
atr <- list(fila_s("Trato del personal", c(3, 8, 47, 38, 4), 224), fila_s("Claridad de la información", c(4, 12, 51, 29, 4), 224),
            fila_s("Tiempo de atención", c(9, 19, 45, 22, 5), 224), fila_s("Infraestructura", c(2, 9, 52, 33, 4), 224))
filas_pulso(doc, XC, YT - 0.1, AC, "¿Qué tan satisfecho está con cada aspecto de la atención?", atr, peso = c(41, 26, 33, NA), fila = 0.66, wlab = 2.4)
narrativa(doc, XC, YT + 3.45, AC, 0.75, list(N_("El "), B("trato del personal"), N_(" pesa más que los demás aspectos. La "), B("infraestructura"), N_(" se evalúa bien, pero no mueve la satisfacción general.")), size = 14)
leyenda(doc, 0, Y_LEY - 0.05, LIKERT_ROT, TK$likert, centrar_en = W / 2)
pie(doc, "Cifras ficticias. El peso sale de una regresión de la satisfacción general sobre los aspectos: análisis nuevo en Analítica")

# ---------------------------------------------------------------- 5. letras de significancia en la tabla resumen
doc <- nueva(doc); titulo(doc, "Formulación del perfil de egreso por público", ante = "Propuesta 5: letras de significancia")
tb <- data.frame(Competencia = c("Estados financieros", "Tributación", "Auditoría", "Finanzas", "Visión empresarial", "Costos y presupuestos"),
                 a = c(98, 94, 96, 96, 92, 92), b = c(96, 96, 91, 95, 94, 94), c = c(98, 98, 98, 93, 95, 94))
letras <- matrix("", 6, 3); letras[3, 1] <- "b"; letras[3, 3] <- "b"; letras[2, 3] <- "a"; letras[4, 1] <- "c"
ft <- flextable(tb) |> set_header_labels(a = "Docentes (a)", b = "Estudiantes (b)", c = "Egresados (c)")
for (i in 1:6) for (j in 1:3) { col <- c("a", "b", "c")[j]
  ft <- compose(ft, i = i, j = col, value = as_paragraph(as_chunk(paste0(tb[[col]][i], "%")), as_sup(if (nzchar(letras[i, j])) paste0(" ", letras[i, j]) else ""))) }
ft <- ft |> font(fontname = TK$font, part = "all") |> fontsize(size = 14, part = "all") |> fontsize(size = 12, part = "header") |>
  color(color = TK$navy, part = "all") |> bold(part = "header") |> bold(j = 1) |> align(j = 2:4, align = "center", part = "all") |> border_remove() |>
  border_inner_h(border = fp_border(color = TK$rule, width = 0.5)) |> hline_bottom(border = fp_border(color = TK$navy, width = 1), part = "header") |>
  width(j = 1, width = 3.3) |> width(j = 2:4, width = 1.75) |> padding(padding.top = 7, padding.bottom = 7, part = "all")
for (i in 1:6) for (j in 1:3) if (nzchar(letras[i, j])) ft <- ft |> bold(i = i, j = j + 1)
invisible(ph_with(doc, ft, location = ph_location(left = XC, top = YT, width = 8.6, height = 3.8)))
narrativa(doc, 9.5, YT + 0.4, W - MR - 9.5, 2.5, list(N_("La "), B("letra"), N_(" junto a una cifra dice de qué público es significativamente mayor. Es la misma marca que el motor ya pone en las barras.")), size = 14)
pie(doc, "Top Two Box. Letras ilustrativas (p < 0.05). Base: 51 docentes, 109 estudiantes y 161 egresados")

# ---------------------------------------------------------------- 7. pregunta exacta en el pie
doc <- nueva(doc); titulo(doc, "Misión y propósitos institucionales", ante = "Propuesta 7: pregunta exacta en el pie")
filas_m <- lapply(1:4, function(i) list(lab = c("Docentes", "Estudiantes", "Egresados", "Administrativos")[i], f = D$mision1[[i]]))
likert_panel(doc, XC, YT + 0.2, 8.4, filas_m, cols = TK$dico, ttb_col = FALSE, g = 0.36, fila = 0.72, wlab = 1.7, size_lab = 12)
leyenda(doc, 0, YT + 3.55, c("Sí", "No"), TK$dico, centrar_en = XC + 4.2)
narrativa(doc, 9.3, YT + 0.4, W - MR - 9.3, 2.3, list(N_("Hoy el pie dice sólo la base. La propuesta agrega la "), B("redacción exacta de la pregunta"), N_(", que el motor toma del instrumento.")), size = 14)
txt(doc, "Pregunta: «¿Conoce usted la misión y los propósitos de la PUCP?»", ML, Y_BASE - 0.28, 10.5, 0.3, PT$base, TK$soft, italic = TRUE)
pie(doc, "Base: 52 docentes, 172 estudiantes, 178 egresados y 15 administrativos")

# ---------------------------------------------------------------- lo que se dejó fuera
doc <- nueva(doc); titulo(doc, "Lo que no se trae", ante = "Para evaluar")
fuera <- list(c("layers", "Fondo oscuro a sangre y cuña diagonal", "Son la firma visual del informe de referencia. PULSO ya tiene la suya: fondo claro, personas y público."),
              c("file-text", "Láminas de bloques de texto", "Limitaciones o recomendaciones en párrafos no salen de los datos. Si hacen falta, van en la ficha técnica o en el Word."),
              c("route", "Diagrama de flecha de los factores", "Es decorativo. El peso de cada aspecto se lee mejor con puntos, como en la propuesta 4."),
              c("sun", "Colores por factor y celdas de color", "Rompen la paleta: en PULSO el color dice la respuesta, no el tema."))
for (k in seq_along(fuera)) { yk <- YT + (k - 1) * 1.05; if (k > 1) separador_h(doc, XC, W - MR, yk - 0.15)
  icono_en_circulo(doc, fuera[[k]][1], XC, yk, 0.55)
  txt(doc, fuera[[k]][2], XC + 0.75, yk - 0.02, AC - 0.75, 0.32, 14, TK$navy, bold = TRUE)
  txt(doc, fuera[[k]][3], XC + 0.75, yk + 0.3, AC - 0.75, 0.5, 12.5, TK$soft) }
pie(doc, "")
