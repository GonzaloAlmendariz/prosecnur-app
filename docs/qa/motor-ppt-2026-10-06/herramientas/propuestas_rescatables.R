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

doc <- nueva(doc); titulo(doc, "Cómo mostrar una diferencia significativa", ante = "Propuesta 5: significancia")
reglas <- list(c("No juzgar por el solapamiento", "Que dos intervalos de 95 % se toquen no prueba que la diferencia no sea significativa: puede serlo aunque se solapen.", "Schenker y Gentleman (2001), The American Statistician. Cumming y Finch (2005), American Psychologist"),
               c("Graficar la diferencia, no sólo los grupos", "Se dibuja la diferencia entre dos públicos con su intervalo. Si el intervalo no cruza el cero, la diferencia es significativa.", "Gardner y Altman (1986), BMJ. Wright, Klein y Wieczorek (2019), The American Statistician. Newcombe (1998), Statistics in Medicine"),
               c("Con tres o más grupos, comparar por pares", "Cada par se prueba y se corrige por comparaciones múltiples. El resultado se lee en letras o en una matriz de pares sombreada.", "Piepho (2004), Journal of Computational and Graphical Statistics. Wright, Klein y Wieczorek (2019), método I"))
for (k in seq_along(reglas)) { yk <- YT + (k - 1) * 1.45; if (k > 1) separador_h(doc, XC, W - MR, yk - 0.2)
  caja(doc, XC, yk + 0.02, 0.36, 0.36, TK$navy, geom = "ellipse"); txt(doc, k, XC, yk + 0.05, 0.36, 0.3, 12, "#FFFFFF", bold = TRUE, align = "center")
  txt(doc, reglas[[k]][1], XC + 0.55, yk, AC - 0.55, 0.32, 15, TK$navy, bold = TRUE)
  txt(doc, reglas[[k]][2], XC + 0.55, yk + 0.34, AC - 0.55, 0.4, 13, TK$navy)
  txt(doc, reglas[[k]][3], XC + 0.55, yk + 0.74, AC - 0.55, 0.3, 10, TK$soft, italic = TRUE) }
pie(doc, "La prueba del motor ya es la correcta: z de diferencia de proporciones entre cada par, con corrección de Bonferroni y α = 0.05")

# Dos públicos: tabla a la izquierda y la diferencia con su intervalo a la derecha
it2 <- data.frame(item = c("Conoce la misión", "Sabe dónde consultarla", "Tutoría académica", "Tutoría socioemocional", "Auditoría", "Tributación"),
                  x1 = c(51, 47, 43, 39, 49, 48), n1 = c(52, 51, 52, 52, 51, 51), x2 = c(133, 106, 91, 132, 99, 105), n2 = c(172, 133, 172, 172, 109, 109))
it2$p1 <- round(100 * it2$x1 / it2$n1); it2$p2 <- round(100 * it2$x2 / it2$n2); it2$d <- 100 * (it2$x1 / it2$n1 - it2$x2 / it2$n2)
it2$pv <- mapply(z_pool, it2$x1, it2$n1, it2$x2, it2$n2); it2$sig <- it2$pv < 0.05
ci <- t(mapply(newcombe, it2$x1, it2$n1, it2$x2, it2$n2, MoreArgs = list(conf = 0.95))) * 100; it2$lo <- ci[, 1]; it2$hi <- ci[, 2]
stopifnot(all(it2$sig == (it2$lo > 0 | it2$hi < 0)))   # la prueba y el intervalo dicen lo mismo en estos datos
doc <- nueva(doc); titulo(doc, "Docentes y estudiantes en seis preguntas", ante = "Propuesta 5: tabla y diferencia")
t2 <- data.frame(Pregunta = it2$item, Docentes = paste0(it2$p1, "%"), Estudiantes = paste0(it2$p2, "%"), Diferencia = sprintf("%+d", round(it2$d)))
ft <- flextable(t2) |> font(fontname = TK$font, part = "all") |> fontsize(size = 13, part = "all") |> fontsize(size = 11.5, part = "header") |> color(color = TK$navy, part = "all") |>
  bold(part = "header") |> bold(j = 1) |> align(j = 2:4, align = "center", part = "all") |> border_remove() |> border_inner_h(border = fp_border(color = TK$rule, width = 0.5)) |>
  hline_bottom(border = fp_border(color = TK$navy, width = 1), part = "header") |> width(j = 1, width = 2.5) |> width(j = 2:4, width = 1.15) |> height_all(height = 0.52) |> hrule(rule = "exact") |>
  padding(padding.top = 4, padding.bottom = 4, part = "all") |> valign(valign = "center", part = "all")
for (i in which(it2$sig)) ft <- ft |> bold(i = i, j = 4) |> color(i = i, j = 4, color = TK$navy)
for (i in which(!it2$sig)) ft <- ft |> color(i = i, j = 4, color = TK$soft)
invisible(ph_with(doc, ft, location = ph_location(left = XC, top = YT + 0.3, width = 5.95, height = 3.7)))
d2 <- it2; d2$item <- factor(d2$item, levels = rev(d2$item))
gd <- ggplot(d2, aes(y = item)) + geom_vline(xintercept = 0, colour = TK$soft, linewidth = 0.6) +
  geom_segment(aes(x = lo, xend = hi, yend = item, colour = sig), linewidth = 2.2, lineend = "round") +
  geom_point(aes(x = d, fill = sig), shape = 21, size = 4.2, colour = "#FFFFFF", stroke = 0.8) +
  scale_colour_manual(values = c(`TRUE` = TK$navy, `FALSE` = "#C9CED8"), guide = "none") + scale_fill_manual(values = c(`TRUE` = TK$navy, `FALSE` = "#9AA5B8"), guide = "none") +
  scale_x_continuous(limits = c(-25, 45), breaks = seq(-20, 40, 20), labels = function(x) ifelse(x == 0, "0", sprintf("%+d", x))) + labs(x = NULL, y = NULL) + theme_minimal(base_family = "Arial") +
  theme(plot.background = element_blank(), panel.background = element_blank(), panel.grid.major.y = element_blank(), panel.grid.minor = element_blank(),
        panel.grid.major.x = element_line(colour = "#E2E5EA"), axis.text.y = element_blank(), axis.text.x = element_text(size = 10, colour = TK$soft))
xg <- XC + 6.3; wg <- W - MR - xg
txt(doc, "Diferencia en puntos (docentes menos estudiantes)", xg - 0.1, YT - 0.1, wg + 0.1, 0.3, 11, TK$soft, bold = TRUE)
invisible(ph_with(doc, dml(ggobj = gd, bg = "transparent", fonts = list(sans = "Arial")), location = ph_location(left = xg, top = YT + 0.3 + 0.52 - 0.12, width = wg, height = 6 * 0.52 + 0.55)))
leyenda(doc, 0, YT + 4.3, c("Diferencia significativa", "No significativa"), c(TK$navy, "#C9CED8"), centrar_en = xg + wg / 2)
pie(doc, "Top Two Box o «Sí». Barra: intervalo de 95 % de la diferencia (Newcombe). Si no cruza el cero, la diferencia es significativa (prueba z, α = 0.05)")

# Cuatro públicos: tabla con letras calculadas y matriz de pares sombreada
pub4 <- c("Docentes", "Estudiantes", "Egresados", "Administrativos"); x4 <- c(51, 133, 138, 14); n4 <- c(52, 172, 178, 15); p4 <- x4 / n4
pares <- combn(4, 2); pv <- apply(pares, 2, function(ab) z_pool(x4[ab[1]], n4[ab[1]], x4[ab[2]], n4[ab[2]])); padj <- p.adjust(pv, "bonferroni")
let4 <- rep("", 4); for (k in seq_len(ncol(pares))) if (padj[k] < 0.05) { a <- pares[1, k]; b <- pares[2, k]; if (p4[a] > p4[b]) let4[a] <- paste0(let4[a], LETTERS[b]) else let4[b] <- paste0(let4[b], LETTERS[a]) }
doc <- nueva(doc); titulo(doc, "Conocimiento de la misión en los cuatro públicos", ante = "Propuesta 5: tabla y matriz de pares")
t4 <- data.frame(Público = sprintf("%s (%s)", pub4, LETTERS[1:4]), Conoce = paste0(round(100 * p4), "%"), n = n4)
ft <- flextable(t4) |> set_header_labels(Público = "Público", Conoce = "Conoce la misión", n = "Base")
for (i in 1:4) ft <- compose(ft, i = i, j = "Conoce", value = as_paragraph(as_chunk(paste0(round(100 * p4[i]), "%"), props = fp_text(font.size = 14, bold = nzchar(let4[i]), color = TK$navy, font.family = TK$font)),
  as_chunk(if (nzchar(let4[i])) paste0("  ", let4[i]) else "", props = fp_text(font.size = 12, bold = TRUE, color = AZUL_LETRA, font.family = TK$font))))
ft <- ft |> font(fontname = TK$font, part = "header") |> font(fontname = TK$font, j = c(1, 3), part = "body") |> fontsize(size = 14, j = c(1, 3), part = "body") |> fontsize(size = 11.5, part = "header") |>
  color(color = TK$navy, part = "all") |> bold(part = "header") |> bold(j = 1) |> align(j = 2:3, align = "center", part = "all") |> border_remove() |>
  border_inner_h(border = fp_border(color = TK$rule, width = 0.5)) |> hline_bottom(border = fp_border(color = TK$navy, width = 1), part = "header") |>
  width(j = 1, width = 2.9) |> width(j = 2, width = 1.8) |> width(j = 3, width = 0.9) |> padding(padding.top = 8, padding.bottom = 8, part = "all")
invisible(ph_with(doc, ft, location = ph_location(left = XC, top = YT + 0.2, width = 5.6, height = 3)))
txt(doc, "La letra junto a una cifra indica de qué público es significativamente mayor.", XT, YT + 2.85, 5.6, 0.5, 12, TK$navy)
# matriz: fila menos columna, sólo bajo la diagonal
xm <- XC + 6.5; cw <- 1.35; ch <- 0.72; ym <- YT + 0.55
txt(doc, "Diferencia en puntos, fila menos columna", xm - 0.1, YT - 0.1, 6, 0.3, 11, TK$soft, bold = TRUE)
for (j in 1:3) txt(doc, LETTERS[j], xm + 1.6 + (j - 1) * cw, ym - 0.38, cw, 0.3, 13, TK$navy, bold = TRUE, align = "center")
for (i in 2:4) { yi <- ym + (i - 2) * ch; txt(doc, sprintf("%s  %s", LETTERS[i], pub4[i]), xm - 0.1, yi + (ch - 0.3) / 2, 1.7, 0.3, 12, TK$navy, bold = TRUE)
  for (j in 1:(i - 1)) { k <- which(pares[1, ] == j & pares[2, ] == i); s_ <- padj[k] < 0.05; dd <- round(100 * (p4[i] - p4[j]))
    fc <- if (s_) TK$navy else "#E3E7EF"; caja(doc, xm + 1.6 + (j - 1) * cw + 0.03, yi + 0.03, cw - 0.06, ch - 0.06, fc)
    txt(doc, if (dd == 0) "0" else sprintf("%+d", dd), xm + 1.6 + (j - 1) * cw, yi + (ch - 0.32) / 2, cw, 0.32, 14, texto_sobre(fc), bold = s_, align = "center") } }
leyenda(doc, 0, ym + 3 * ch + 0.25, c("Diferencia significativa", "No significativa"), c(TK$navy, "#E3E7EF"), centrar_en = xm + 1.6 + 1.5 * cw)
txt(doc, "Los administrativos superan en 16 puntos a estudiantes y egresados, pero con 15 casos esa distancia no es significativa.", xm - 0.1, ym + 3 * ch + 0.7, W - MR - xm + 0.1, 0.55, 12, TK$navy)
pie(doc, "Prueba z de diferencia de proporciones entre los seis pares, con corrección de Bonferroni y α = 0.05 (la misma del motor)")
caveat_txt <- "Estas pruebas suponen muestreo aleatorio. En estudios censales o por conveniencia, como los de acreditación, se leen como indicativas."
txt(doc, caveat_txt, XT, Y_BASE - 0.32, 10.5, 0.3, PT$base, TK$soft, italic = TRUE)

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
