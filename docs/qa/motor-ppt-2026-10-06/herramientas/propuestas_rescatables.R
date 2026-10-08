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
                "Tabla de significancia con su gráfico", "Fila Total separada"),
  `La idea` = c("Jerarquía de capítulos sin texto extra", "La cifra destacada de III.2, en cualquier cantidad y posición", "Cuántos están insatisfechos, sin sumar a ojo", "Qué importa, además de qué se evalúa bien",
                "La diferencia y su intervalo, o la matriz de pares", "La referencia se distingue de los grupos"),
  `Lo calcula el motor` = c("Número y título del plan", "Cifras y detalle", "Toda la columna", "Todo, con un análisis nuevo", "Prueba y letras (ya existen)", "Toda la fila"),
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

# ---------------------------------------------------------------- 1. separadores (S1, T1 a T4: sin cero, con aire bajo la línea punteada; S2 y T5: el subcapítulo como un subtítulo)
sep_base <- function(doc) nueva(doc, "Section Header")
sep_titulo <- function(doc, xt, y, t, sub) { ht <- alto_txt(t, W - MR - xt, 30, TRUE)
  txt(doc, t, xt, y, W - MR - xt, ht, 30, TK$navy, bold = TRUE); txt(doc, sub, xt, y + ht, W - MR - xt, 0.4, 15, TK$soft) }
etiqueta_alt <- function(doc, t) txt(doc, toupper(t), W - MR - 5, H - 0.62, 5, 0.26, 10, TK$soft, bold = TRUE, align = "right")
# A. número sin cero, con filete, más abajo para que respire bajo la línea punteada (T1)
doc <- sep_base(doc); txt(doc, "2", 2.5, 3.8, 1.4, 1.7, 110, TK$coral, bold = TRUE)
caja(doc, 3.85, 4.3, 0.04, 1.2, TK$coral); sep_titulo(doc, 4.1, 4.2, "Características institucionales", "Misión, propósitos, gestión y planificación"); etiqueta_alt(doc, "Capítulo, variante A: número")
# C. rótulo «Capítulo 2» sobre un filete, título grande debajo
doc <- sep_base(doc); txt(doc, "CAPÍTULO 2", 2.5, 3.85, 6, 0.36, 15, TK$coral, bold = TRUE); caja(doc, 2.6, 4.27, 1.1, 0.04, TK$coral)
txt(doc, "Características institucionales", 2.5, 4.42, 9.8, 0.75, 36, TK$navy, bold = TRUE); txt(doc, "Misión, propósitos, gestión y planificación", 2.5, 5.15, 9.8, 0.4, 15, TK$soft); etiqueta_alt(doc, "Capítulo, variante B: rótulo")
# D. número de fondo, más chico y con margen (T4)
doc <- sep_base(doc); txt(doc, "2", 10.0, 3.7, 2.6, 2.6, 180, "#DCE2EC", bold = TRUE, align = "center")
txt(doc, "CAPÍTULO 2", 2.5, 3.85, 6, 0.36, 15, TK$coral, bold = TRUE)
txt(doc, "Características institucionales", 2.5, 4.25, 7.4, 0.7, 32, TK$navy, bold = TRUE); txt(doc, "Misión, propósitos, gestión y planificación", 2.5, 4.95, 7.4, 0.4, 15, TK$soft); etiqueta_alt(doc, "Capítulo, variante C: número de fondo")
# Subcapítulo: cuatro alternativas que se sienten como subtítulo, no como portada (T5). Todas sobre la lámina general, sin personas ni público.
ruta <- "Capítulo 2: Características institucionales"
# S1. sobria: número y título en una línea, a media altura
doc <- nueva(doc); txt(doc, toupper(ruta), XT, 2.75, 9, 0.3, 11, TK$soft, bold = TRUE)
wn <- ancho_tinta("2.1", 30, TRUE); txt(doc, "2.1", XT, 3.1, wn + 0.3, 0.6, 30, TK$coral, bold = TRUE)
txt(doc, "Misión y propósitos", XT + wn + 0.3, 3.1, 9, 0.6, 30, TK$navy, bold = TRUE); txt(doc, "Conocimiento entre los cuatro públicos", XT, 3.72, 9, 0.4, 15, TK$soft)
etiqueta_alt(doc, "Subcapítulo, alternativa 1: sobria")
# S2. barra lateral coral a la izquierda del título
doc <- nueva(doc); caja(doc, XC, 2.85, 0.06, 1.35, TK$coral)
txt(doc, toupper(ruta), XC + 0.2, 2.82, 9, 0.3, 11, TK$soft, bold = TRUE)
txt(doc, "2.1  Misión y propósitos", XC + 0.2, 3.12, 10, 0.6, 30, TK$navy, bold = TRUE); txt(doc, "Conocimiento entre los cuatro públicos", XC + 0.2, 3.75, 9, 0.4, 15, TK$soft)
etiqueta_alt(doc, "Subcapítulo, alternativa 2: barra lateral")
# S3. banda clara a lo ancho, con el número a la izquierda
doc <- nueva(doc); caja(doc, 0, 2.55, W, 1.75, "#E3E7EF")
txt(doc, "2.1", XT, 2.95, 1.6, 0.9, 44, TK$navy, bold = TRUE); caja(doc, XC + 1.45, 3.0, 0.03, 0.9, TK$coral)
txt(doc, "Misión y propósitos", XC + 1.65, 2.95, 9, 0.6, 30, TK$navy, bold = TRUE); txt(doc, ruta, XC + 1.65, 3.55, 9, 0.4, 14, TK$soft)
etiqueta_alt(doc, "Subcapítulo, alternativa 3: banda clara")
# S4. sin lámina propia: la primera lámina del subcapítulo lo anuncia en su antetítulo
doc <- nueva(doc); titulo(doc, "Conocimiento de la misión y los propósitos", ante = NULL)
txt(doc, "2.1  MISIÓN Y PROPÓSITOS", ML, Y_TIT - 0.17, 9, 0.26, 10, TK$coral, bold = TRUE)
filas_m <- lapply(1:4, function(i) list(lab = c("Docentes", "Estudiantes", "Egresados", "Administrativos")[i], f = D$mision1[[i]]))
likert_panel(doc, XC, YT + 0.2, 8.4, filas_m, cols = TK$dico, ttb_col = FALSE, g = 0.36, fila = 0.72, wlab = 1.7, size_lab = 12)
leyenda(doc, 0, YT + 3.55, c("Sí", "No"), TK$dico, centrar_en = XC + 4.2)
narrativa(doc, 9.3, YT + 0.4, W - MR - 9.3, 2.0, list(N_("Sin lámina separadora: el antetítulo en coral, con el número del subcapítulo, marca dónde empieza.")), size = 14)
pie(doc, "Base: 52 docentes, 172 estudiantes, 178 egresados y 15 administrativos")
doc <- nueva(doc); titulo(doc, "Tres separadores de capítulo y cuatro de subcapítulo", ante = "Propuesta 1: separadores")
pts1 <- list(c("Capítulo A", "El número sin cero, grande y en coral, con un filete que lo separa del título."),
             c("Capítulo B", "«Capítulo 2» pequeño en coral sobre un filete corto. El título manda."),
             c("Capítulo C", "Un número grande en azul muy claro, detrás y a la derecha, como marca de agua."),
             c("Subcapítulo 1 y 2", "Lámina general sin personas ni público: el número y el título en una línea, o junto a una barra coral."),
             c("Subcapítulo 3", "Una banda clara a lo ancho con el número y el título. Se lee como un corte menor."),
             c("Subcapítulo 4", "Sin lámina propia: la primera lámina del subcapítulo lo anuncia en su antetítulo."))
for (k in seq_along(pts1)) { yk <- YT + (k - 1) * 0.68; if (k > 1) separador_h(doc, XC, W - MR, yk - 0.12)
  txt(doc, pts1[[k]][1], XT, yk, 2.8, 0.32, 14, TK$navy, bold = TRUE); txt(doc, pts1[[k]][2], XC + 2.9, yk, AC - 2.9, 0.55, 13, TK$navy) }
pie(doc, "El número y el título salen del plan del informe: ninguna variante pide escribir texto nuevo")

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
pie(doc, "Una cifra junto a su gráfico, en mitades. Base: 178 egresados")
doc <- nueva(doc); titulo(doc, "Tres cifras con rótulos de largo distinto", ante = "Propuesta 2: cifras, de 1 a 5")
banda_cifras(doc, c5[1:3], XC, YT + 0.2, AC, size = 44)
separador_h(doc, XC, W - MR, YT + 3.6)
txt(doc, "La cifra queda arriba, el rótulo ocupa hasta dos líneas y el detalle siempre cae a la misma altura, aunque un rótulo sea más largo.", XT, YT + 3.8, AC, 0.6, 13, TK$navy, bold = TRUE)
pie(doc, "Base: 52 docentes, 172 estudiantes y 178 egresados")
doc <- nueva(doc); titulo(doc, "Cinco cifras, el máximo", ante = "Propuesta 2: cifras, de 1 a 5")
banda_cifras(doc, c5, XC, YT + 0.2, AC, size = 34)
separador_h(doc, XC, W - MR, YT + 3.3)
txt(doc, "Con cinco, la cifra baja a 34 pt. Si un rótulo pide una línea más, todos los detalles bajan con él. Con seis o más, la información va a una tabla.", XT, YT + 3.5, AC, 0.6, 13, TK$navy, bold = TRUE)
pie(doc, "Base: 417 personas encuestadas en cuatro públicos")

# ---------------------------------------------------------------- 3 y 6. Bottom Two Box y fila Total separada (en el bloque Likert de PULSO)
filas_pulso <- function(doc, x, y, w, premisa, filas, peso = NULL, fila = 0.42, wlab = 1.6) {
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
    if (es_tot) separador_h(doc, x + wpeso, x + w, yb + g + 0.08)   # filete bajo la barra del Total (T6: antes chocaba con las cifras chicas de la fila siguiente)
    yy <- yy + fila + (if (es_tot) 0.22 else 0) }
  invisible(yy) }
tot <- function(a, na, b, nb) round((a * na + b * nb) / (na + nb))
doc <- nueva(doc); titulo(doc, "Servicios de tutoría", ante = "Propuestas 3 y 6: Bottom Two Box y fila Total")
d1 <- c(0, 2, 29, 54, 15); e1 <- c(6, 18, 34, 19, 23); d2 <- c(0, 2, 31, 44, 23); e2 <- c(3, 6, 45, 32, 13)
y_ <- filas_pulso(doc, XC, YT - 0.1, AC, "La Unidad cuenta con servicios de tutoría académica",
                  list(fila_s("Total", tot(d1, 52, e1, 172), 224), fila_s("Docentes", d1, 52), fila_s("Estudiantes", e1, 172)))
separador_h(doc, XC, W - MR, y_ + 0.08)
filas_pulso(doc, XC, y_ + 0.2, AC, "La Unidad cuenta con servicios de tutoría socioemocional",
            list(fila_s("Total", tot(d2, 52, e2, 172), 224), fila_s("Docentes", d2, 52), fila_s("Estudiantes", e2, 172)))
leyenda(doc, 0, Y_LEY - 0.05, LIKERT_ROT, TK$likert, centrar_en = W / 2)
pie(doc, "Top Two Box: «De acuerdo» más «Totalmente de acuerdo». Bottom Two Box: las dos respuestas en desacuerdo. Base: 52 docentes y 172 estudiantes")

# ---------------------------------------------------------------- 4. peso de cada aspecto (puntos, como el ranking de PULSO)
doc <- nueva(doc); titulo(doc, "Satisfacción con la atención en la Unidad", ante = "Propuesta 4: peso en la satisfacción")
atr <- list(fila_s("Trato del personal", c(3, 8, 47, 38, 4), 224), fila_s("Tiempo de atención", c(9, 19, 45, 22, 5), 224),
            fila_s("Claridad de la información", c(4, 12, 51, 29, 4), 224), fila_s("Infraestructura", c(2, 9, 52, 33, 4), 224))   # S5: ordenadas por peso
filas_pulso(doc, XC, YT - 0.1, AC, "¿Qué tan satisfecho está con cada aspecto de la atención?", atr, peso = c(41, 33, 26, NA), fila = 0.66, wlab = 2.4)
separador_h(doc, XC, W - MR, YT + 3.3)
txt(doc, "Cómo se lee el peso", XT, YT + 3.42, 4, 0.3, 12, TK$soft, bold = TRUE)
txt(doc, "El peso indica qué parte de la satisfacción general explica cada aspecto, según una regresión lineal. Se reparte entre los aspectos con efecto significativo y suma 100 %.", XT, YT + 3.72, AC, 0.55, 13, TK$navy)
txt(doc, "El trato del personal es el aspecto de mayor peso. La infraestructura, aunque bien evaluada, no tiene efecto significativo.", XT, YT + 4.25, AC, 0.35, 13, TK$navy, bold = TRUE)
leyenda(doc, 0, Y_LEY - 0.05, LIKERT_ROT, TK$likert, centrar_en = W / 2)
pie(doc, "Cifras ficticias. Peso estimado con una regresión lineal de la satisfacción general sobre los aspectos evaluados")

# ---------------------------------------------------------------- 5. significancia: tabla y gráfico al lado, con la prueba calculada (S6, T9 y comentario del 2026-10-08:
# «una tabla de significancia se lee mejor con un gráfico al lado que muestre esa significancia… hay que encontrar una forma creativa y estadísticamente válida»).
# Antes las letras eran ilustrativas y no salían de ninguna prueba; ahora todo se calcula con conteos reales del recetario.
# Prueba: la del motor (comparar_columnas_sig en api/R/reporte_cruces.R): z con proporción combinada para cada par, Bonferroni dentro de cada fila, α = 0.05.
# Intervalo de la diferencia: Newcombe (1998), híbrido de Wilson, al nivel ajustado por Bonferroni. Lectura (Gardner y Altman 1986; Wright, Klein y
# Wieczorek 2019, método II): si el intervalo de la diferencia no cruza el cero, la diferencia es significativa. No se juzga por el solapamiento de
# intervalos de cada grupo (Schenker y Gentleman 2001; Cumming y Finch 2005).
AZUL_LETRA <- "#4F7FAF"
wilson <- function(x, n, z) { p <- x / n; c_ <- (p + z^2 / (2 * n)) / (1 + z^2 / n); h <- z * sqrt(p * (1 - p) / n + z^2 / (4 * n^2)) / (1 + z^2 / n); c(c_ - h, c_ + h) }
newcombe <- function(x1, n1, x2, n2, conf) { z <- qnorm(1 - (1 - conf) / 2); p1 <- x1 / n1; p2 <- x2 / n2; w1 <- wilson(x1, n1, z); w2 <- wilson(x2, n2, z); d <- p1 - p2
  c(d - sqrt((p1 - w1[1])^2 + (w2[2] - p2)^2), d + sqrt((w1[2] - p1)^2 + (p2 - w2[1])^2)) }
z_pool <- function(x1, n1, x2, n2) { p1 <- x1 / n1; p2 <- x2 / n2; pp <- (x1 + x2) / (n1 + n2); se <- sqrt(pp * (1 - pp) * (1 / n1 + 1 / n2)); 2 * pnorm(-abs((p1 - p2) / se)) }

it2 <- data.frame(item = c("Conoce la misión", "Sabe dónde consultarla", "Tutoría académica", "Tutoría socioemocional", "Auditoría", "Tributación"),
                  x1 = c(51, 47, 43, 39, 49, 48), n1 = c(52, 51, 52, 52, 51, 51), x2 = c(133, 106, 91, 132, 99, 105), n2 = c(172, 133, 172, 172, 109, 109))
it2$p1 <- round(100 * it2$x1 / it2$n1); it2$p2 <- round(100 * it2$x2 / it2$n2); it2$d <- 100 * (it2$x1 / it2$n1 - it2$x2 / it2$n2)
it2$pv <- mapply(z_pool, it2$x1, it2$n1, it2$x2, it2$n2); it2$sig <- it2$pv < 0.05
ci <- t(mapply(newcombe, it2$x1, it2$n1, it2$x2, it2$n2, MoreArgs = list(conf = 0.95))) * 100; it2$lo <- ci[, 1]; it2$hi <- ci[, 2]
stopifnot(all(it2$sig == (it2$lo > 0 | it2$hi < 0)))   # la prueba y el intervalo dicen lo mismo en estos datos
pub4 <- c("Docentes", "Estudiantes", "Egresados", "Administrativos"); x4 <- c(51, 133, 138, 14); n4 <- c(52, 172, 178, 15); p4 <- x4 / n4
pares <- combn(4, 2); pv <- apply(pares, 2, function(ab) z_pool(x4[ab[1]], n4[ab[1]], x4[ab[2]], n4[ab[2]])); padj <- p.adjust(pv, "bonferroni")
let4 <- rep("", 4); for (k in seq_len(ncol(pares))) if (padj[k] < 0.05) { a <- pares[1, k]; b <- pares[2, k]; if (p4[a] > p4[b]) let4[a] <- paste0(let4[a], LETTERS[b]) else let4[b] <- paste0(let4[b], LETTERS[a]) }
fmt_p <- function(p) if (p < 0.001) "p < 0.001" else sprintf("p = %s", sub("^0", "0", formatC(p, format = "f", digits = 3)))
fmt_d <- function(d) if (round(d) == 0) "0" else sprintf("%+d", round(d))
COL_D <- unname(TK$actores["Docentes"]); COL_E <- unname(TK$actores["Estudiantes"])

# U1. Por qué graficar la diferencia: un caso real en que los intervalos se solapan y la diferencia sí es significativa
doc <- nueva(doc); titulo(doc, "Por qué se grafica la diferencia", ante = "Propuesta 5: significancia")
xa <- c(47, 106); na <- c(51, 133); wD <- wilson(xa[1], na[1], 1.96) * 100; wE <- wilson(xa[2], na[2], 1.96) * 100
dif <- newcombe(xa[1], na[1], xa[2], na[2], 0.95) * 100; pD <- 100 * xa[1] / na[1]; pE <- 100 * xa[2] / na[2]; pz <- z_pool(xa[1], na[1], xa[2], na[2])
pan <- function(x0, w, lo, hi, ticks) list(px = function(v) x0 + (v - lo) / (hi - lo) * w, ticks = ticks)
# panel izquierdo: cada grupo con su intervalo
x1 <- XC + 1.9; w1 <- 3.9; P1 <- pan(x1, w1, 65, 100, seq(70, 100, 10)); yA <- YT + 1.0
panel_titulo(doc, XC, YT, 5.8, "1. Cada grupo con su intervalo de 95 %", "¿Sabe dónde consultar la misión?")
for (v in P1$ticks) { caja(doc, P1$px(v), yA - 0.15, 0.006, 1.45, TK$rule); txt(doc, paste0(v, "%"), P1$px(v) - 0.4, yA + 1.35, 0.8, 0.26, 10, TK$soft, align = "center") }
caja(doc, P1$px(wD[1]), yA - 0.15, P1$px(wE[2]) - P1$px(wD[1]), 1.45, "#FBE3D3")   # zona de solapamiento
for (k in 1:2) { yk <- yA + 0.15 + (k - 1) * 0.65; iv <- list(wD, wE)[[k]]; pk <- c(pD, pE)[k]; ck <- c(COL_D, COL_E)[k]
  txt(doc, c("Docentes", "Estudiantes")[k], XC - 0.1, yk - 0.12, 1.85, 0.3, 13, TK$navy, bold = TRUE, align = "right")
  caja(doc, P1$px(iv[1]), yk - 0.025, P1$px(iv[2]) - P1$px(iv[1]), 0.05, ck); caja(doc, P1$px(pk) - 0.1, yk - 0.1, 0.2, 0.2, ck, geom = "ellipse")
  txt(doc, sprintf("%d%%", round(pk)), P1$px(iv[2]) + 0.08, yk - 0.14, 0.7, 0.28, 12, TK$navy, bold = TRUE) }
txt(doc, "Los intervalos se solapan (zona naranja). A simple vista parece que no hay diferencia.", XC - 0.1, yA + 1.75, 5.9, 0.55, 13, TK$navy)
separador_v(doc, XC + 6.2, YT, YT + 3.6)
# panel derecho: la diferencia con su intervalo
x2 <- XC + 6.6; w2 <- W - MR - x2 - 0.3; P2 <- pan(x2, w2, -10, 30, seq(-10, 30, 10)); yB <- yA + 0.48
panel_titulo(doc, x2, YT, W - MR - x2, "2. La diferencia con su intervalo de 95 %", "Docentes menos estudiantes, en puntos")
for (v in P2$ticks) { caja(doc, P2$px(v), yA - 0.15, if (v == 0) 0.02 else 0.006, 1.45, if (v == 0) TK$soft else TK$rule); txt(doc, fmt_d(v), P2$px(v) - 0.4, yA + 1.35, 0.8, 0.26, 10, TK$soft, align = "center") }
caja(doc, P2$px(dif[1]), yB - 0.035, P2$px(dif[2]) - P2$px(dif[1]), 0.07, TK$navy); caja(doc, P2$px(pD - pE) - 0.12, yB - 0.12, 0.24, 0.24, TK$navy, geom = "ellipse")
txt(doc, sprintf("%s puntos  [%.1f a %.1f]", fmt_d(pD - pE), dif[1], dif[2]), P2$px(pD - pE) - 2, yB - 0.55, 4, 0.3, 12, TK$navy, bold = TRUE, align = "center")
txt(doc, sprintf("El intervalo de la diferencia no cruza el cero: es significativa (%s).", fmt_p(pz)), x2 - 0.1, yA + 1.75, W - MR - x2 + 0.1, 0.55, 13, TK$navy, bold = TRUE)
separador_h(doc, XC, W - MR, YT + 3.85)
txt(doc, "Por eso el gráfico de significancia muestra la diferencia y su intervalo, no sólo los grupos. Con tres o más grupos, se comparan los pares y se corrige por comparaciones múltiples.", XT, YT + 3.98, AC, 0.55, 12.5, TK$navy)
pie(doc, "Fuentes: Schenker y Gentleman (2001), Cumming y Finch (2005), Gardner y Altman (1986), Newcombe (1998) y Wright, Klein y Wieczorek (2019). Intervalos de Wilson y Newcombe")

# U2. Dos públicos: forest plot integrado a la tabla (pregunta, cifras, diferencia con intervalo, intervalo en números y p)
forest_doc <- function(doc, tecnica = TRUE) {
grupos <- list(list("Misión institucional", 1:2), list("Tutoría", 3:4), list("Competencias del perfil de egreso", 5:6))
doc <- nueva(doc); titulo(doc, "Docentes y estudiantes en seis preguntas", ante = if (tecnica) "Propuesta 5: versión técnica" else "Propuesta 5: versión estándar")
xq <- XC; xdo <- XC + 3.05; xes <- xdo + 0.95; xg0 <- xes + 1.15; wg <- 4.2; xdi <- xg0 + wg + 0.2; xpv <- xdi + 1.8; wpv <- W - MR - xpv
lo_ <- -25; hi_ <- 45; px <- function(v) xg0 + (v - lo_) / (hi_ - lo_) * wg
yh <- YT - 0.05
txt(doc, "Pregunta", xq - 0.1, yh, 3, 0.3, 11, TK$soft, bold = TRUE)
caja(doc, xdo + 0.05, yh + 0.1, 0.12, 0.12, COL_D); txt(doc, "Docentes", xdo + 0.12, yh, 0.95, 0.3, 11, TK$navy, bold = TRUE)
caja(doc, xes + 0.05, yh + 0.1, 0.12, 0.12, COL_E); txt(doc, "Estudiantes", xes + 0.12, yh, 1.1, 0.3, 11, TK$navy, bold = TRUE)
txt(doc, "Diferencia, docentes menos estudiantes", xg0 - 0.1, yh, wg + 0.2, 0.3, 11, TK$soft, bold = TRUE, align = "center")
txt(doc, if (tecnica) "Puntos [IC 95 %]" else "Diferencia", xdi - 0.1, yh, 1.7, 0.3, 11, TK$soft, bold = TRUE); if (tecnica) txt(doc, "Prueba", xpv - 0.1, yh, wpv + 0.1, 0.3, 11, TK$soft, bold = TRUE)
separador_h(doc, XC, W - MR, yh + 0.36)
y_ <- yh + 0.45; rh <- 0.5; sh <- 0.36; y_top <- y_
filas_y <- numeric(6)
for (g in grupos) { txt(doc, toupper(g[[1]]), xq - 0.1, y_ + 0.05, 5, 0.26, 10, TK$soft, bold = TRUE); y_ <- y_ + sh
  for (i in g[[2]]) { filas_y[i] <- y_ + rh / 2; s_ <- it2$sig[i]; ct <- if (s_) TK$navy else TK$soft
    if (i %% 2 == 1) caja(doc, XC - 0.05, y_, W - MR - XC + 0.05, rh, "#EAEDF2")
    txt(doc, it2$item[i], xq - 0.1, y_ + 0.1, 3.0, 0.3, 13, ct, bold = s_)
    txt(doc, paste0(it2$p1[i], "%"), xdo, y_ + 0.1, 0.9, 0.3, 13, TK$navy, align = "center"); txt(doc, paste0(it2$p2[i], "%"), xes, y_ + 0.1, 0.9, 0.3, 13, TK$navy, align = "center")
    if (tecnica) { txt(doc, sprintf("%s  [%.1f a %.1f]", fmt_d(it2$d[i]), it2$lo[i], it2$hi[i]), xdi - 0.1, y_ + 0.1, 1.85, 0.3, 11.5, ct, bold = s_)
      txt(doc, fmt_p(it2$pv[i]), xpv - 0.1, y_ + 0.1, wpv + 0.1, 0.3, 11, ct) } else {
      txt(doc, sprintf("%s puntos", fmt_d(it2$d[i])), xdi - 0.1, y_ + 0.1, 1.5, 0.3, 13, ct, bold = s_)
      txt(doc, if (s_) "Significativa" else "No significativa", xpv - 0.35, y_ + 0.1, wpv + 0.35, 0.3, 11.5, ct, bold = s_) }
    y_ <- y_ + rh } }
y_bot <- y_
for (v in seq(-20, 40, 20)) { caja(doc, px(v) - (if (v == 0) 0.01 else 0.003), y_top, if (v == 0) 0.02 else 0.006, y_bot - y_top, if (v == 0) TK$soft else TK$rule)
  txt(doc, fmt_d(v), px(v) - 0.35, y_bot + 0.04, 0.7, 0.24, 10, TK$soft, align = "center") }
for (i in 1:6) { s_ <- it2$sig[i]; cc <- if (s_) TK$navy else "#AEB6C6"; yc <- filas_y[i]
  caja(doc, px(it2$lo[i]), yc - 0.03, px(it2$hi[i]) - px(it2$lo[i]), 0.06, cc)
  caja(doc, px(it2$d[i]) - 0.1, yc - 0.1, 0.2, 0.2, if (s_) TK$navy else "#FFFFFF", geom = "ellipse", line = sp_line(color = cc, lwd = 1.5)) }
txt(doc, "Mayor en estudiantes", px(0) - 2.0, y_bot + 0.28, 1.9, 0.26, 10, TK$soft, italic = TRUE, align = "right")
txt(doc, "Mayor en docentes", px(0) + 0.1, y_bot + 0.28, 1.9, 0.26, 10, TK$soft, italic = TRUE)
pie(doc, if (tecnica) "Top Two Box o «Sí». Base: 52 docentes y 172 estudiantes (Auditoría y Tributación: 51 y 109). Intervalo de Newcombe. Punto lleno: el intervalo no cruza el cero (prueba z, α = 0.05)" else
    "Top Two Box o «Sí». Base: 52 docentes y 172 estudiantes (Auditoría y Tributación: 51 y 109). La barra es el intervalo de 95 %: si no cruza el cero, la diferencia es significativa (α = 0.05)")
  doc }

# U3. Cuatro públicos: tabla con barras y letras, y matriz de pares con los porcentajes en la diagonal
matriz_doc <- function(doc, tecnica = TRUE) {
doc <- nueva(doc); titulo(doc, "Conocimiento de la misión en los cuatro públicos", ante = if (tecnica) "Propuesta 5: versión técnica" else "Propuesta 5: versión estándar")
yt <- YT + 0.05
txt(doc, "Público", XT, yt, 2, 0.3, 11, TK$soft, bold = TRUE); txt(doc, "Conoce la misión", XC + 2.2, yt, 2.4, 0.3, 11, TK$soft, bold = TRUE)
txt(doc, "Base", XC + 4.7, yt, 0.6, 0.3, 11, TK$soft, bold = TRUE, align = "center"); separador_h(doc, XC, XC + 5.6, yt + 0.36)
for (i in 1:4) { yi <- yt + 0.5 + (i - 1) * 0.62
  txt(doc, sprintf("%s  %s", LETTERS[i], pub4[i]), XT, yi + 0.12, 2.2, 0.3, 13, TK$navy, bold = TRUE)
  caja(doc, XC + 2.2, yi + 0.17, 1.6 * p4[i], 0.22, if (nzchar(let4[i])) TK$navy else TK$tenue)
  txt(doc, paste0(round(100 * p4[i]), "%"), XC + 2.25 + 1.6 * p4[i], yi + 0.12, 0.7, 0.3, 13, TK$navy, bold = TRUE)
  if (nzchar(let4[i])) txt(doc, let4[i], XC + 2.25 + 1.6 * p4[i] + 0.55, yi + 0.13, 0.6, 0.3, 12, AZUL_LETRA, bold = TRUE)
  txt(doc, n4[i], XC + 4.7, yi + 0.12, 0.6, 0.3, 12, TK$soft, align = "center")
  if (i < 4) separador_h(doc, XC, XC + 5.6, yi + 0.6) }
txt(doc, "La letra indica de qué público es significativamente mayor: docentes supera a estudiantes (B) y a egresados (C).", XT, yt + 3.1, 5.6, 0.55, 12, TK$navy)
separador_v(doc, XC + 6.0, YT, YT + 4.2)
xm <- XC + 6.75; cw <- 1.32; ch <- 0.84; ym <- YT + 0.5
txt(doc, "Fila menos columna, en puntos", xm - 0.1, YT - 0.05, 6, 0.3, 11, TK$soft, bold = TRUE)
azules <- grDevices::colorRampPalette(c("#4F6A9A", TK$navy))(5)
for (j in 1:4) txt(doc, LETTERS[j], xm + 0.45 + (j - 1) * cw, ym - 0.32, cw, 0.3, 13, TK$navy, bold = TRUE, align = "center")
for (i in 1:4) { yi <- ym + (i - 1) * ch; txt(doc, LETTERS[i], xm - 0.1, yi + (ch - 0.3) / 2, 0.5, 0.3, 13, TK$navy, bold = TRUE)
  for (j in 1:i) { xj <- xm + 0.45 + (j - 1) * cw
    if (i == j) { caja(doc, xj + 0.03, yi + 0.03, cw - 0.06, ch - 0.06, "#FFFFFF", line = sp_line(color = TK$rule, lwd = 0.75))
      txt(doc, paste0(round(100 * p4[i]), "%"), xj, yi + 0.12, cw, 0.32, 14, TK$navy, bold = TRUE, align = "center"); txt(doc, sprintf("n = %d", n4[i]), xj, yi + 0.44, cw, 0.26, 10, TK$soft, align = "center"); next }
    k <- which(pares[1, ] == j & pares[2, ] == i); s_ <- padj[k] < 0.05; dd <- 100 * (p4[i] - p4[j])
    fc <- if (s_) azules[min(5, max(1, ceiling(abs(dd) / 6)))] else "#E3E7EF"; tc <- texto_sobre(fc)
    caja(doc, xj + 0.03, yi + 0.03, cw - 0.06, ch - 0.06, fc)
    txt(doc, fmt_d(dd), xj, yi + (if (tecnica) 0.1 else (ch - 0.36) / 2), cw, 0.34, 15, tc, bold = s_, align = "center")
    if (tecnica) txt(doc, if (padj[k] >= 1) "p = 1" else fmt_p(padj[k]), xj, yi + 0.46, cw, 0.26, 10, tc, align = "center") } }
leyenda(doc, 0, ym + 4 * ch + 0.15, c("Significativa (más intensa, mayor)", "No significativa"), c(TK$navy, "#E3E7EF"), centrar_en = xm + 0.45 + 2 * cw)
txt(doc, "Administrativos supera en 16 puntos a estudiantes y egresados, pero con 15 casos esa distancia no es significativa.", xm - 0.1, ym + 4 * ch + 0.55, W - MR - xm + 0.1, 0.5, 11.5, TK$navy)
txt(doc, "Estas pruebas suponen muestreo aleatorio. En estudios censales o por conveniencia, como los de acreditación, se leen como indicativas.", XT, Y_BASE - 0.32, 10.5, 0.3, PT$base, TK$soft, italic = TRUE)
pie(doc, if (tecnica) "Prueba z de diferencia de proporciones en los seis pares, p ajustada por Bonferroni, α = 0.05 (la misma prueba del motor)" else "Diferencias significativas según la prueba z entre cada par de públicos, con corrección por comparaciones múltiples (α = 0.05)")
  doc }

# L. Tabla de letras, sobria, con un gráfico al lado que dibuja lo mismo (2026-10-08: «me gustaba la tabla sencilla, elegante y minimalista con las A y las B;
# sería interesante combinarla con un gráfico al lado»). Letras calculadas con la prueba del motor: z combinada por par, Bonferroni en la fila, α = 0.05.
tl <- list(list("Misión institucional", list(c("Conoce la misión", 51, 133, 138, 52, 172, 178), c("Sabe dónde consultarla", 47, 106, 112, 51, 133, 138))),
           list("Competencias del perfil de egreso", list(c("Estados financieros", 50, 105, 158, 51, 109, 161), c("Tributación", 48, 105, 158, 51, 109, 161), c("Auditoría", 49, 99, 158, 51, 109, 161),
                                                      c("Finanzas", 49, 104, 150, 51, 109, 161), c("Visión empresarial", 47, 102, 153, 51, 109, 161), c("Costos y presupuestos", 47, 102, 151, 51, 109, 161))))
pub3 <- c("Docentes", "Estudiantes", "Egresados"); col3 <- unname(TK$actores[pub3])
letras_fila <- function(x, n) { p <- x / n; pr <- combn(3, 2); pa <- p.adjust(apply(pr, 2, function(ab) z_pool(x[ab[1]], n[ab[1]], x[ab[2]], n[ab[2]])), "bonferroni")
  l <- rep("", 3); sigp <- list(); for (k in seq_len(ncol(pr))) if (pa[k] < 0.05) { a <- pr[1, k]; b <- pr[2, k]; sigp[[length(sigp) + 1]] <- c(a, b)
    if (p[a] > p[b]) l[a] <- paste0(l[a], LETTERS[b]) else l[b] <- paste0(l[b], LETTERS[a]) }
  list(p = 100 * p, l = l, pares = sigp) }
doc <- nueva(doc); titulo(doc, "Misión y perfil de egreso en tres públicos", ante = "Propuesta 5: tabla de letras y gráfico")
xi <- XC; wi <- 2.9; xv <- c(XC + 3.0, XC + 4.1, XC + 5.2); wv <- 1.05; xg0 <- XC + 6.75; wg <- W - MR - xg0 - 0.25; lo_ <- 75; hi_ <- 100; px <- function(v) xg0 + (v - lo_) / (hi_ - lo_) * wg
yh <- YT - 0.1
for (k in 1:3) { txt(doc, pub3[k], xv[k] - 0.1, yh, wv + 0.2, 0.28, 11.5, TK$navy, bold = TRUE, align = "center"); txt(doc, LETTERS[k], xv[k], yh + 0.26, wv, 0.26, 11, AZUL_LETRA, bold = TRUE, align = "center") }
leyenda(doc, 0, yh + 0.08, pub3, col3, centrar_en = xg0 + wg / 2)
separador_h(doc, XC, xv[3] + wv, yh + 0.58)
y_ <- yh + 0.66; rh <- 0.42; sh <- 0.34; ytop <- y_; filas <- list()
for (g in tl) { txt(doc, toupper(g[[1]]), xi - 0.1, y_ + 0.05, 6, 0.26, 10, TK$soft, bold = TRUE); y_ <- y_ + sh
  for (it in g[[2]]) { x <- as.numeric(it[2:4]); n <- as.numeric(it[5:7]); r <- letras_fila(x, n); hay <- length(r$pares) > 0
    txt(doc, it[1], xi - 0.1, y_ + 0.07, wi, 0.3, 13, TK$navy, bold = hay)
    for (k in 1:3) { l <- r$l[k]; cad <- paste0(round(r$p[k]), "%")
      if (nzchar(l)) { wnum <- ancho_tinta(cad, 13, TRUE); wl <- ancho_tinta(l, 11, TRUE); x0 <- xv[k] + (wv - wnum - wl - 0.08) / 2
        txt(doc, cad, x0 - 0.1, y_ + 0.07, wnum + 0.25, 0.3, 13, TK$navy, bold = TRUE); txt(doc, l, x0 + wnum + 0.08 - 0.1, y_ + 0.09, wl + 0.25, 0.28, 11, AZUL_LETRA, bold = TRUE)
      } else txt(doc, cad, xv[k], y_ + 0.07, wv, 0.3, 13, TK$navy, align = "center") }
    filas[[length(filas) + 1]] <- list(y = y_ + rh / 2, r = r); separador_h(doc, XC, xv[3] + wv, y_ + rh); y_ <- y_ + rh } }
ybot <- y_
for (v in seq(75, 100, 5)) { caja(doc, px(v) - 0.003, ytop, 0.006, ybot - ytop, TK$rule); txt(doc, paste0(v, "%"), px(v) - 0.35, ybot + 0.04, 0.7, 0.24, 10, TK$soft, align = "center") }
for (f in filas) { yc <- f$y; pv <- f$r$p
  caja(doc, px(min(pv)), yc - 0.012, px(max(pv)) - px(min(pv)), 0.024, "#C9CED8")
  for (pr in f$r$pares) { a <- min(pv[pr]); b <- max(pv[pr]); caja(doc, px(a), yc - 0.035, px(b) - px(a), 0.07, TK$navy) }
  for (k in order(-pv)) caja(doc, px(pv[k]) - 0.1, yc - 0.1, 0.2, 0.2, col3[k], geom = "ellipse", line = sp_line(color = "#FFFFFF", lwd = 1)) }
txt(doc, "La letra junto a una cifra indica de qué público es significativamente mayor. En el gráfico, la línea azul une a los públicos que difieren de forma significativa.", XT, ybot + 0.32, AC, 0.5, 12, TK$navy)
pie(doc, "Top Two Box o «Sí». Prueba z entre cada par de públicos, con corrección de Bonferroni (α = 0.05). Base: 51 docentes, 109 estudiantes y 161 egresados (misión: 52, 172 y 178)")

doc <- forest_doc(doc, TRUE); doc <- forest_doc(doc, FALSE)
doc <- matriz_doc(doc, TRUE); doc <- matriz_doc(doc, FALSE)

# Versiones para público general (2026-10-08: «debe haber una versión avanzada como la que muestras, pero también una versión entendible para un
# público general»). Mismos datos y misma prueba que las técnicas; sin p ni intervalos, y la significancia dicha en palabras.
# G2. Dos públicos: cada pregunta con sus dos puntos y la distancia marcada sólo cuando es significativa (no «clara»: significativa no quiere decir grande)
doc <- nueva(doc); titulo(doc, "Diferencias significativas entre docentes y estudiantes", ante = "Propuesta 5: versión para público general")
xq <- XC; xg0 <- XC + 3.4; wg <- 5.5; xr <- xg0 + wg + 0.95; lo_ <- 50; hi_ <- 100; px <- function(v) xg0 + (v - lo_) / (hi_ - lo_) * wg
leyenda(doc, 0, YT - 0.05, c("Docentes", "Estudiantes"), c(COL_D, COL_E), centrar_en = xg0 + wg / 2)
y_ <- YT + 0.5; rh <- 0.62
for (v in seq(50, 100, 10)) { caja(doc, px(v) - 0.003, y_, 0.006, 6 * rh, TK$rule); txt(doc, paste0(v, "%"), px(v) - 0.35, y_ + 6 * rh + 0.04, 0.7, 0.24, 10, TK$soft, align = "center") }
for (i in 1:6) { yc <- y_ + (i - 1) * rh + rh / 2; s_ <- it2$sig[i]; a <- it2$p1[i]; b <- it2$p2[i]
  if (i > 1) separador_h(doc, XC, W - MR, yc - rh / 2)
  txt(doc, it2$item[i], xq - 0.1, yc - 0.16, 3.3, 0.32, 14, TK$navy, bold = s_)
  caja(doc, px(min(a, b)), yc - (if (s_) 0.04 else 0.012), px(max(a, b)) - px(min(a, b)), if (s_) 0.08 else 0.024, if (s_) TK$navy else "#C9CED8")
  for (k in 1:2) { v <- c(a, b)[k]; caja(doc, px(v) - 0.12, yc - 0.12, 0.24, 0.24, c(COL_D, COL_E)[k], geom = "ellipse", line = sp_line(color = "#FFFFFF", lwd = 1))
    der <- (k == 1 && a >= b) || (k == 2 && b > a)   # la cifra mayor a la derecha de su punto, la menor a la izquierda
    txt(doc, paste0(v, "%"), if (der) px(v) + 0.12 else px(v) - 0.82, yc - 0.15, 0.7, 0.3, 12, TK$navy, bold = TRUE, align = if (der) "left" else "right") }
  txt(doc, if (s_) "Significativa" else "No significativa", xr - 0.1, yc - 0.15, W - MR - xr + 0.1, 0.3, 13, if (s_) TK$navy else TK$soft, bold = s_) }
txt(doc, "«Significativa»: la prueba estadística indica que es poco probable que la distancia se deba al azar de quiénes respondieron. No dice si la diferencia es grande o importante.", XT, YT + 4.55, AC, 0.35, 12.5, TK$navy)
pie(doc, "Top Two Box o «Sí». Base: 52 docentes y 172 estudiantes (Auditoría y Tributación: 51 y 109). La versión técnica muestra el intervalo y la prueba")

# G3. Cuatro públicos: barras ordenadas, el público que se distingue en azul oscuro y los que no se distinguen agrupados con una llave
doc <- nueva(doc); titulo(doc, "Los docentes son quienes más conocen la misión", ante = "Propuesta 5: versión para público general")
ord <- order(-p4); xb <- XC + 2.6; wb <- 4.4; y0 <- YT + 0.35; fr <- 0.85; gbar <- 0.46
for (r in seq_along(ord)) { i <- ord[r]; yb <- y0 + (r - 1) * fr; destaca <- nzchar(let4[i]); chica <- n4[i] < 30
  txt(doc, pub4[i], XC - 0.1, yb + (gbar - 0.32) / 2, 2.55, 0.32, 14, TK$navy, bold = destaca, align = "right")
  if (chica) contorno(doc, xb, yb, wb * p4[i], gbar, TK$tenue, lwd = 1.25, lty = "dash") else caja(doc, xb, yb, wb * p4[i], gbar, if (destaca) TK$navy else TK$tenue)
  txt(doc, paste0(round(100 * p4[i]), "%"), xb + wb * p4[i] + 0.1, yb + (gbar - 0.34) / 2, 0.9, 0.34, 15, TK$navy, bold = TRUE) }
r_est <- match(2, ord); r_egr <- match(3, ord); yl0 <- y0 + (min(r_est, r_egr) - 1) * fr; yl1 <- y0 + (max(r_est, r_egr) - 1) * fr + gbar
yc_ <- llave_v(doc, xb + wb * 0.8 + 0.85, yl0, yl1, xb + wb * 0.8 + 1.15)
txt(doc, "Sin diferencia significativa entre ellos", xb + wb * 0.8 + 1.2, yc_ - 0.3, 1.9, 0.6, 12, TK$navy, bold = TRUE)
separador_v(doc, XC + 9.25, YT, YT + 3.7)
narrativa(doc, XC + 9.5, YT + 0.2, W - MR - XC - 9.5, 2.3, list(N_("Los "), B("docentes"), N_(" conocen la misión más que estudiantes y egresados, y la diferencia es significativa. Los "),
  B("administrativos"), N_(" también marcan alto, pero con 15 casos su diferencia no resulta significativa.")), size = 13)
leyenda(doc, 0, y0 + 4 * fr + 0.05, c("Diferencia significativa con los demás", "Sin diferencia significativa"), c(TK$navy, TK$tenue), centrar_en = xb + wb / 2)
txt(doc, "Barra punteada: base de menos de 30 casos.", xb - 0.1, y0 + 4 * fr + 0.42, wb, 0.28, 11, TK$soft, italic = TRUE)
pie(doc, "Base: 52 docentes, 172 estudiantes, 178 egresados y 15 administrativos. La versión técnica muestra la matriz de pares con la prueba")

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
