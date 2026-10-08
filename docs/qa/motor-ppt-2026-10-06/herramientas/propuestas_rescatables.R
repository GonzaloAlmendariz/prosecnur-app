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
ev <- data.frame(`#` = 1:6,
  Propuesta = c("Separadores sin cero y con más alternativas", "Cifras destacadas de 1 a 5", "Bottom Two Box junto al Top Two Box", "Peso de cada aspecto en la satisfacción",
                "Letras de significancia en la tabla resumen", "Fila Total separada"),
  `La idea` = c("Jerarquía de capítulos sin texto extra", "La cifra destacada de III.2, en cualquier cantidad y posición", "Cuántos están insatisfechos, sin sumar a ojo", "Qué importa, además de qué se evalúa bien",
                "Diferencias entre públicos en la misma tabla", "La referencia se distingue de los grupos"),
  `Lo calcula el motor` = c("Número y título del plan", "Cifras y detalle", "Toda la columna", "Todo, con un análisis nuevo", "Las letras (ya existen en barras)", "Toda la fila"),
  `Se escribe en la app` = c("Nada", "Un rótulo corto por cifra", "Nada", "Nada", "Nada", "Nada"),
  Estado = c("En evaluación", "En evaluación", "Aceptada", "En evaluación", "En evaluación", "Aceptada"), check.names = FALSE)
ft <- flextable(ev) |> font(fontname = TK$font, part = "all") |> fontsize(size = 11.5, part = "all") |> fontsize(size = 10.5, part = "header") |>
  color(color = TK$navy, part = "all") |> bold(part = "header") |> bold(j = 2) |> border_remove() |>
  border_inner_h(border = fp_border(color = TK$rule, width = 0.5)) |> hline_top(border = fp_border(color = TK$navy, width = 1), part = "header") |>
  hline_bottom(border = fp_border(color = TK$navy, width = 1), part = "header") |> padding(padding.top = 5, padding.bottom = 5, part = "all") |>
  width(j = 1, width = 0.4) |> width(j = 2, width = 3.2) |> width(j = 3, width = 3.3) |> width(j = 4, width = 2.4) |> width(j = 5, width = 1.7) |> width(j = 6, width = 1.3) |>
  valign(valign = "center", part = "all")
invisible(ph_with(doc, ft, location = ph_location(left = XC, top = YT - 0.1, width = 12.35, height = 4.5)))
pie(doc, "Estado según los comentarios del 2026-10-08. La pregunta exacta en el pie se retiró")

# ---------------------------------------------------------------- 1. separadores (S1: sin cero delante y alternativas más elegantes; S2: el subcapítulo con otra identidad)
sep_base <- function(doc) nueva(doc, "Section Header")
sep_titulo <- function(doc, xt, y, t, sub) { ht <- alto_txt(t, W - MR - xt, 30, TRUE)
  txt(doc, t, xt, y, W - MR - xt, ht, 30, TK$navy, bold = TRUE); txt(doc, sub, xt, y + ht, W - MR - xt, 0.4, 15, TK$soft) }
etiqueta_alt <- function(doc, t) txt(doc, toupper(t), W - MR - 5, H - 0.62, 5, 0.26, 10, TK$soft, bold = TRUE, align = "right")
# A. número sin cero, con filete
doc <- sep_base(doc); txt(doc, "2", 2.5, 3.4, 1.4, 1.7, 110, TK$coral, bold = TRUE)
caja(doc, 3.85, 3.95, 0.04, 1.2, TK$coral); sep_titulo(doc, 4.1, 3.85, "Características institucionales", "Misión, propósitos, gestión y planificación"); etiqueta_alt(doc, "Capítulo, variante A: número")
# B. número dentro de un anillo coral
doc <- sep_base(doc); contorno(doc, 2.6, 3.7, 1.4, 1.4, TK$coral, lwd = 2.5, lty = "solid", geom = "ellipse")
txt(doc, "2", 2.5, 3.98, 1.6, 0.85, 48, TK$coral, bold = TRUE, align = "center"); sep_titulo(doc, 4.35, 3.95, "Características institucionales", "Misión, propósitos, gestión y planificación"); etiqueta_alt(doc, "Capítulo, variante B: anillo")
# C. rótulo «Capítulo 2» sobre un filete, título grande debajo
doc <- sep_base(doc); txt(doc, "CAPÍTULO 2", 2.5, 3.85, 6, 0.36, 15, TK$coral, bold = TRUE); caja(doc, 2.6, 4.27, 1.1, 0.04, TK$coral)
txt(doc, "Características institucionales", 2.5, 4.42, 9.8, 0.75, 36, TK$navy, bold = TRUE); txt(doc, "Misión, propósitos, gestión y planificación", 2.5, 5.15, 9.8, 0.4, 15, TK$soft); etiqueta_alt(doc, "Capítulo, variante C: rótulo")
# D. número grande de fondo, en un azul muy claro, y el título encima
doc <- sep_base(doc); txt(doc, "2", 8.3, 2.75, 4.6, 4.0, 280, "#DCE2EC", bold = TRUE, align = "right")
txt(doc, "CAPÍTULO 2", 2.5, 3.85, 6, 0.36, 15, TK$coral, bold = TRUE)
txt(doc, "Características institucionales", 2.5, 4.25, 7.6, 0.75, 34, TK$navy, bold = TRUE); txt(doc, "Misión, propósitos, gestión y planificación", 2.5, 4.98, 7.6, 0.4, 15, TK$soft); etiqueta_alt(doc, "Capítulo, variante D: número de fondo")
# Subcapítulo: otra composición, sin las personas ni el público, para que no se confunda con un capítulo (S2)
doc <- nueva(doc)
txt(doc, "CAPÍTULO 2: CARACTERÍSTICAS INSTITUCIONALES", XT, 2.35, 9, 0.3, 11, TK$soft, bold = TRUE); separador_h(doc, XC, W - MR, 2.75)
txt(doc, "2.1", XT, 3.1, 2.2, 1.0, 54, TK$navy, bold = TRUE)
caja(doc, XC + 1.75, 3.25, 0.04, 0.95, TK$coral)
txt(doc, "Misión y propósitos", XC + 1.95, 3.15, 9, 0.6, 30, TK$navy, bold = TRUE); txt(doc, "Conocimiento entre los cuatro públicos", XC + 1.95, 3.78, 9, 0.4, 15, TK$soft)
etiqueta_alt(doc, "Subcapítulo: sin personas ni público")
doc <- nueva(doc); titulo(doc, "Cuatro separadores de capítulo y uno de subcapítulo", ante = "Propuesta 1: separadores")
pts1 <- list(c("A. Número", "El número sin cero, grande y en coral, con un filete que lo separa del título."),
             c("B. Anillo", "El número dentro de un anillo coral fino: recuerda al círculo del ícono, sin llenarlo."),
             c("C. Rótulo", "«Capítulo 2» pequeño en coral sobre un filete corto. El título manda."),
             c("D. Número de fondo", "Un número grande en azul muy claro detrás de la composición, como marca de agua."),
             c("Subcapítulo", "Sin personas ni público: una ruta con el capítulo arriba, el número 2.1 en azul oscuro y el título. No se confunde con un capítulo."))
for (k in seq_along(pts1)) { yk <- YT + (k - 1) * 0.78; if (k > 1) separador_h(doc, XC, W - MR, yk - 0.12)
  txt(doc, pts1[[k]][1], XT, yk, 2.6, 0.32, 14, TK$navy, bold = TRUE); txt(doc, pts1[[k]][2], XC + 2.7, yk, AC - 2.7, 0.6, 13, TK$navy) }
pie(doc, "Todas viven en p_slide_seccion (un estilo por variante) sobre la plantilla. El número y el título salen del plan: no se escribe nada nuevo")

# ---------------------------------------------------------------- 2. hallazgos en cifras (S3: es la cifra destacada de III.2, de 1 a 5 cifras, con rótulos de largo distinto)
banda_cifras <- function(doc, items, x, y, w, size = 40, con_icono = TRUE) {   # cifra arriba, rótulo de hasta dos líneas y detalle siempre a la misma altura
  n <- length(items); gap <- if (n >= 5) 0.3 else 0.45; wc <- (w - gap * (n - 1)) / n; hn <- size * 1.25 / 72
  hr <- max(vapply(items, function(it) alto_txt(it[3], wc, 12, TRUE), 0))   # todos los detalles a la altura del rótulo más largo
  for (k in seq_len(n)) { xk <- x + (k - 1) * (wc + gap); it <- items[[k]]
    if (k > 1) separador_v(doc, xk - gap / 2, y, y + (if (con_icono) 0.75 else 0) + hn + hr + 0.45)
    yy <- y; if (con_icono) { icono_en_circulo(doc, it[1], xk, yy, 0.55); yy <- yy + 0.75 }
    txt(doc, it[2], xk - 0.1, yy, wc + 0.1, hn, size, TK$navy, bold = TRUE)
    txt(doc, it[3], xk - 0.1, yy + hn, wc + 0.1, hr, 12, TK$navy, bold = TRUE)
    txt(doc, it[4], xk - 0.1, yy + hn + hr + 0.05, wc + 0.1, 0.3, 10, TK$soft) } }
c5 <- list(c("landmark", "98 %", "de los docentes conoce la misión", "Estudiantes 77 %, egresados 78 %"),
           c("hand-helping", "53 %", "de los estudiantes reconoce la tutoría académica que ofrece la Unidad", "Entre los docentes, 83 %"),
           c("award", "95 %", "valora las competencias técnicas", "Top Two Box de los estudiantes"),
           c("graduation-cap", "31 %", "de los egresados tiene el título", "Aunque el 98 % trabaja"),
           c("users", "417", "personas encuestadas", "En cuatro públicos"))
doc <- nueva(doc); titulo(doc, "Una cifra frente a su gráfico", ante = "Propuesta 2: cifras, de 1 a 5")
banda_cifras(doc, c5[4], XC, YT + 0.6, 4.6, size = 54)
separador_v(doc, XC + 5.0, YT, YF - 0.2)
panel_titulo(doc, XC + 5.4, YT, W - MR - XC - 5.4, "¿Cuenta con título universitario?", "178 egresados")
dicotomia(doc, XC + 5.4, YT + 0.8, W - MR - XC - 5.4, c("Sí", "No"), c(31, 69), n = c(56, 122), size = 26, g = 0.42)
pie(doc, "Una cifra: mitad y mitad con un gráfico. Es la misma cifra destacada de «Dónde va la cifra destacada» (III.2)")
doc <- nueva(doc); titulo(doc, "Tres cifras con rótulos de largo distinto", ante = "Propuesta 2: cifras, de 1 a 5")
banda_cifras(doc, c5[1:3], XC, YT + 0.2, AC, size = 44)
separador_h(doc, XC, W - MR, YT + 3.6)
txt(doc, "La cifra queda arriba, el rótulo ocupa hasta dos líneas y el detalle siempre cae a la misma altura, aunque un rótulo sea más largo.", XT, YT + 3.8, AC, 0.6, 13, TK$navy, bold = TRUE)
pie(doc, "Tres cifras: banda a todo el ancho. Cifras del recetario de Contabilidad")
doc <- nueva(doc); titulo(doc, "Cinco cifras, el máximo", ante = "Propuesta 2: cifras, de 1 a 5")
banda_cifras(doc, c5, XC, YT + 0.2, AC, size = 34)
separador_h(doc, XC, W - MR, YT + 3.3)
txt(doc, "Con cinco, la cifra baja a 34 pt. Si un rótulo pide una línea más, todos los detalles bajan con él. Con seis o más, la información va a una tabla.", XT, YT + 3.5, AC, 0.6, 13, TK$navy, bold = TRUE)
pie(doc, "La cifra y el detalle los calcula el motor. El rótulo corto se escribe en la app, como el texto de una lámina narrativa")

# ---------------------------------------------------------------- 3 y 6. Bottom Two Box y fila Total separada (en el bloque Likert de PULSO)
filas_pulso <- function(doc, x, y, w, premisa, filas, peso = NULL, fila = 0.46, wlab = 1.6) {
  wpeso <- if (is.null(peso)) 0 else 1.5; wcol <- 1.25; xb <- x + wpeso + wlab + 0.12; wb <- w - wpeso - wlab - 0.12 - 2 * wcol - 0.15
  xt2 <- xb + wb + 0.1; xb2 <- xt2 + wcol; g <- 0.28
  txt(doc, premisa, x - 0.1, y, w, 0.34, 13, TK$navy, bold = TRUE)
  yh <- y + 0.42
  txt(doc, "Top Two Box", xt2 - 0.05, yh, wcol + 0.1, 0.26, 10, TK$verde_txt, bold = TRUE, align = "center")
  txt(doc, "Bottom Two Box", xb2 - 0.1, yh, wcol + 0.2, 0.26, 10, NARANJA_TXT, bold = TRUE, align = "center")
  if (!is.null(peso)) txt(doc, "Cuánto pesa", x - 0.1, yh, wpeso + 0.3, 0.26, 10, TK$soft, bold = TRUE)
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
atr <- list(fila_s("Trato del personal", c(3, 8, 47, 38, 4), 224), fila_s("Tiempo de atención", c(9, 19, 45, 22, 5), 224),
            fila_s("Claridad de la información", c(4, 12, 51, 29, 4), 224), fila_s("Infraestructura", c(2, 9, 52, 33, 4), 224))   # S5: ordenadas por peso
filas_pulso(doc, XC, YT - 0.1, AC, "¿Qué tan satisfecho está con cada aspecto de la atención?", atr, peso = c(41, 33, 26, NA), fila = 0.66, wlab = 2.4)
separador_h(doc, XC, W - MR, YT + 3.3)
txt(doc, "Cómo se lee el peso", XT, YT + 3.42, 4, 0.3, 12, TK$soft, bold = TRUE)
txt(doc, "Si sube la satisfacción con un aspecto, ¿cuánto sube la satisfacción general? El peso reparte 100 % entre los aspectos que sí la mueven.", XT, YT + 3.72, AC, 0.35, 13, TK$navy)
txt(doc, "Aquí, el trato del personal pesa más que la infraestructura, aunque las dos se evalúan bien.", XT, YT + 4.08, AC, 0.35, 13, TK$navy, bold = TRUE)
leyenda(doc, 0, Y_LEY - 0.05, LIKERT_ROT, TK$likert, centrar_en = W / 2)
pie(doc, "Cifras ficticias. El peso sale de una regresión de la satisfacción general sobre los aspectos: análisis nuevo en Analítica")

# ---------------------------------------------------------------- 5. letras de significancia (S6: más legibles que el superíndice)
doc <- nueva(doc); titulo(doc, "Formulación del perfil de egreso por público", ante = "Propuesta 5: letras de significancia")
tb <- data.frame(Competencia = c("Estados financieros", "Tributación", "Auditoría", "Finanzas", "Visión empresarial", "Costos y presupuestos"),
                 a = c(98, 94, 96, 96, 92, 92), b = c(96, 96, 91, 95, 94, 94), c = c(98, 98, 98, 93, 95, 94))
letras <- matrix("", 6, 3); letras[3, 1] <- "b"; letras[3, 3] <- "b"; letras[2, 3] <- "a"; letras[4, 1] <- "c"
AZUL_LETRA <- "#4F7FAF"
ft <- flextable(tb) |> set_header_labels(Competencia = "Competencia", a = "Docentes", b = "Estudiantes", c = "Egresados") |>
  add_header_row(values = c("", "a", "b", "c"), top = FALSE)
for (i in 1:6) for (j in 1:3) { col <- c("a", "b", "c")[j]; l <- letras[i, j]
  ft <- compose(ft, i = i, j = col, value = as_paragraph(as_chunk(paste0(tb[[col]][i], "%"), props = fp_text(font.size = 14, bold = nzchar(l), color = TK$navy, font.family = TK$font)),
    as_chunk(if (nzchar(l)) paste0("  ", l) else "", props = fp_text(font.size = 12, bold = TRUE, color = AZUL_LETRA, font.family = TK$font)))) }
ft <- ft |> font(fontname = TK$font, part = "header") |> fontsize(size = 12, part = "header") |> color(color = TK$navy, part = "header") |> bold(part = "header") |>
  color(i = 2, color = AZUL_LETRA, part = "header") |> fontsize(i = 2, size = 11, part = "header") |>
  font(fontname = TK$font, j = 1, part = "body") |> fontsize(j = 1, size = 14, part = "body") |> color(j = 1, color = TK$navy, part = "body") |> bold(j = 1, part = "body") |>
  align(j = 2:4, align = "center", part = "all") |> border_remove() |> border_inner_h(border = fp_border(color = TK$rule, width = 0.5), part = "body") |>
  hline_bottom(border = fp_border(color = TK$navy, width = 1), part = "header") |>
  width(j = 1, width = 3.3) |> width(j = 2:4, width = 1.75) |> padding(padding.top = 7, padding.bottom = 7, part = "body") |> padding(padding.top = 2, padding.bottom = 4, part = "header")
invisible(ph_with(doc, ft, location = ph_location(left = XC, top = YT, width = 8.6, height = 4.0)))
txt(doc, "Cada público tiene una letra. La letra junto a una cifra dice de qué público es significativamente mayor: «98 %  b» es mayor que estudiantes.", XT, YT + 4.0, 8.6, 0.55, 12, TK$navy)
narrativa(doc, 9.5, YT + 0.4, W - MR - 9.5, 2.6, list(N_("La letra va a tamaño legible, en azul, separada de la cifra. Es la misma marca que el motor ya pone en las barras, ahora en la tabla resumen.")), size = 14)
pie(doc, "Top Two Box. Letras ilustrativas (p < 0.05). Base: 51 docentes, 109 estudiantes y 161 egresados")

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
