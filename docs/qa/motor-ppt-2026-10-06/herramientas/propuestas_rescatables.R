# Propuestas rescatables de un informe externo de referencia (pedido de Gonzalo, 2026-10-08: «haz la propuesta de todo lo
# rescatable en un ppt aparte para hacer comentarios y evaluar su integración»). El informe de referencia es confidencial y
# no entra al repo: aquí sólo se reproducen los patrones de diseño, dibujados con la identidad de PULSO y con datos del
# recetario de Contabilidad o cifras ficticias. Se ejecuta con SOLO=rescatables desde recetario.R.
sf <- function(pct, valid) { n <- round(pct * valid / 100); list(pct = pct, n = n, valid = valid) }
fila_s <- function(actor, pct, valid) list(actor = actor, f = sf(pct, valid))
lista_marcada <- function(doc, items, x, y, w, paso = 0.68, size = 12) {   # números en círculo azul oscuro (no las marcas magenta de guía)
  for (i in seq_along(items)) { yy <- y + (i - 1) * paso; caja(doc, x, yy + 0.02, 0.32, 0.32, TK$navy, geom = "ellipse")
    txt(doc, i, x, yy + 0.04, 0.32, 0.28, 11, "#FFFFFF", bold = TRUE, align = "center"); txt(doc, items[i], x + 0.45, yy, w - 0.45, paso, size, TK$navy) } }
b2b <- function(f) f$pct[1] + f$pct[2]
nota_donde <- function(t) pie(doc, paste("Dónde viviría:", t))
VERDE_OSC <- "#2E6B22"   # verde del Top Two Box sobre su recuadro claro: el verde de la marca queda en 3.2:1

# ---------------------------------------------------------------- portada e índice de evaluación
doc <- nueva(doc, "Title Slide")
txt(doc, "PROPUESTAS PARA EL RECETARIO", 1.6, 2.12, 10.1, 0.32, 13, TK$coral, bold = TRUE, align = "center")
txt(doc, "Piezas rescatables de un informe de referencia", 0.8, 2.5, 11.7, 0.7, 32, TK$navy, bold = TRUE, align = "center")
txt(doc, "Dibujadas con la identidad de PULSO para comentarlas y decidir si entran al motor", 1.6, 3.3, 10.1, 0.4, 18, TK$navy, align = "center")
txt(doc, "Octubre de 2026", 1.6, 3.75, 10.1, 0.4, 16, TK$soft, align = "center")

doc <- nueva(doc); titulo(doc, "Qué se propone y dónde viviría", ante = "Para evaluar")
ev <- data.frame(`#` = 1:8,
  Propuesta = c("Separadores con número grande", "Resumen ejecutivo en columnas", "Bottom Two Box junto al Top Two Box", "Columna de impacto en la satisfacción",
                "Tabla resumen con significancia", "Línea punteada bajo el Total", "Bloques numerados de cierre", "Pregunta exacta en el pie"),
  `Qué cambia` = c("Portadillas de capítulo y subcapítulo", "Lámina nueva al inicio del informe", "Una columna más en las barras de escala", "Una columna a la izquierda y una lámina de pesos",
                   "Tabla con celdas resaltadas", "Separa la referencia de los subgrupos", "Limitaciones y consideraciones para la réplica", "Redacción de la pregunta sobre la base"),
  `Dónde viviría` = c("Layout de la plantilla + p_slide_seccion", "Constructor nuevo p_slide_resumen", "bloque_likert y likert_panel", "Analítica (regresión) + graficador",
                      "Tabla de cruces del motor (letras ya existen)", "bloque_likert y barras apiladas", "Constructor nuevo p_slide_bloques", "Pie de lámina del motor"),
  Esfuerzo = c("Bajo", "Medio", "Bajo", "Alto", "Medio", "Bajo", "Medio", "Bajo"), check.names = FALSE)
ft <- flextable(ev) |> font(fontname = TK$font, part = "all") |> fontsize(size = 12, part = "all") |> fontsize(size = 11, part = "header") |>
  color(color = TK$navy, part = "all") |> bold(part = "header") |> bold(j = 2) |> border_remove() |>
  border_inner_h(border = fp_border(color = TK$rule, width = 0.5)) |> hline_top(border = fp_border(color = TK$navy, width = 1), part = "header") |>
  hline_bottom(border = fp_border(color = TK$navy, width = 1), part = "header") |> padding(padding.top = 5, padding.bottom = 5, part = "all") |>
  width(j = 1, width = 0.45) |> width(j = 2, width = 3.6) |> width(j = 3, width = 3.9) |> width(j = 4, width = 3.4) |> width(j = 5, width = 1.0) |> valign(valign = "center", part = "all")
invisible(ph_with(doc, ft, location = ph_location(left = XC, top = YT - 0.1, width = 12.35, height = 4.5)))
pie(doc, "Esfuerzo bajo: cambio de dibujo. Medio: constructor nuevo. Alto: análisis nuevo en Analítica")

# ---------------------------------------------------------------- 1. separadores con número grande
cuna <- function(doc, cols = c(TK$coral, "#C9D3E6")) {   # cuña diagonal en la esquina inferior derecha
  d <- rbind(data.frame(g = 1, x = c(0.30, 0.56, 1, 1), y = c(0, 0, 0.60, 0.95)), data.frame(g = 2, x = c(0.64, 0.72, 1, 1), y = c(0, 0, 0.39, 0.50)))
  gc <- ggplot(d, aes(x, y, group = g, fill = factor(g))) + geom_polygon(colour = NA) + scale_fill_manual(values = cols) +
    coord_cartesian(xlim = c(0, 1), ylim = c(0, 1), expand = FALSE) + theme_void() + theme(legend.position = "none")
  invisible(ph_with(doc, dml(ggobj = gc, bg = "transparent"), location = ph_location(left = W - 3.6, top = H - 2.4, width = 3.6, height = 2.4))) }
separador <- function(doc, numero, clave, resto, lineas, oscuro = TRUE, size_n = 110) {
  doc <- nueva(doc, "General Objective"); fondo <- if (oscuro) TK$navy else TK$fondo; tinta <- if (oscuro) "#FFFFFF" else TK$navy
  caja(doc, 0, 0, W, H, fondo)
  x0 <- 1.0; y0 <- 2.15; lh <- 0.6; size <- 32
  wk <- ancho_tinta(clave, size, TRUE)
  caja(doc, x0 - 0.06, y0 + 0.04, wk + 0.14, lh - 0.04, TK$coral)
  txt(doc, clave, x0 - 0.1, y0, wk + 0.4, lh, size, "#FFFFFF", bold = TRUE)
  txt(doc, resto, x0 + wk + 0.12, y0, 7, lh, size, tinta, bold = TRUE)
  for (k in seq_along(lineas)) txt(doc, lineas[k], x0 - 0.1, y0 + k * lh, 7.6, lh, size, tinta, bold = TRUE)
  txt(doc, numero, 8.4, 1.75, 4.2, 1.9, size_n, tinta, bold = TRUE, align = "right")
  cuna(doc, if (oscuro) c(TK$coral, "#4F6A9A") else c(TK$coral, "#C9D3E6"))
  doc }
doc <- separador(doc, "02", "SATISFACCIÓN", "CON EL", c("SERVICIO EDUCATIVO", "DE LA CARRERA"))
doc <- separador(doc, "2.1", "TUTORÍA", "Y", c("ACOMPAÑAMIENTO", "ACADÉMICO"), size_n = 96)
doc <- separador(doc, "02", "SATISFACCIÓN", "CON EL", c("SERVICIO EDUCATIVO", "DE LA CARRERA"), oscuro = FALSE)
doc <- nueva(doc); titulo(doc, "Cómo se compara con la portadilla actual", ante = "Propuesta 1: separadores")
lista_marcada(doc, c("Fondo azul oscuro a sangre, o la variante clara sobre el fondo de la plantilla.",
                     "La palabra clave del capítulo va sobre un recuadro coral. El resto del título, en mayúsculas.",
                     "El número del capítulo o subcapítulo (02, 2.1) a la derecha, en grande: la jerarquía se lee sin texto extra.",
                     "Una cuña diagonal coral en la esquina cierra la composición. Reemplaza a las siluetas de público.",
                     "La portadilla actual (círculo coral con ícono y siluetas) puede convivir: una para capítulos y otra para partes."),
  XC, YT, AC, paso = 0.62, size = 14)
nota_donde("un layout «Separador» en la plantilla y p_slide_seccion con número y palabra clave como argumentos")

# ---------------------------------------------------------------- 2. resumen ejecutivo en columnas numeradas
hallazgos <- list(c("La misión se conoce entre los docentes", "El 98 % de los docentes conoce la misión y los propósitos de la PUCP, frente al 77 % de los estudiantes y el 78 % de los egresados."),
                  c("La tutoría académica divide a los públicos", "El 83 % de los docentes está de acuerdo con que la Unidad cuenta con tutoría académica. Entre los estudiantes baja a 53 %."),
                  c("Las competencias del perfil se valoran alto", "Las tres dimensiones del perfil de egreso llegan a 95 % o más de Top Two Box entre los estudiantes."),
                  c("Pocos egresados tienen el título", "El 31 % de los egresados cuenta con título universitario, aunque el 98 % trabaja."))
resumen <- function(doc, oscuro) {
  doc <- if (oscuro) nueva(doc, "General Objective") else nueva(doc)
  if (oscuro) { caja(doc, 0, 0, W, H, TK$navy); txt(doc, "Resumen ejecutivo", XT, 0.55, 9, 0.6, 28, "#FFFFFF", bold = TRUE) } else titulo(doc, "Resumen ejecutivo", ante = "Propuesta 2: resumen en columnas")
  cols <- if (oscuro) c(TK$coral, "#9DC3E6", "#F4B183", "#ADD493") else c(TK$navy, TK$coral, "#4F7FAF", TK$verde_txt)
  tinta <- if (oscuro) "#FFFFFF" else TK$navy; gap <- 0.4; wc <- (AC - 3 * gap) / 4
  for (k in 1:4) { x <- XC + (k - 1) * (wc + gap)
    if (k > 1) caja(doc, x - gap / 2, YT, 0.008, 4.6, if (oscuro) "#4F6A9A" else TK$rule)
    txt(doc, k, x - 0.1, YT - 0.1, 1.2, 1.0, 54, cols[k], bold = TRUE)
    caja(doc, x, YT + 0.95, wc, 0.06, cols[k])
    h1 <- alto_txt(hallazgos[[k]][1], wc, 15, TRUE); txt(doc, hallazgos[[k]][1], x - 0.1, YT + 1.15, wc + 0.1, h1, 15, tinta, bold = TRUE)
    txt(doc, hallazgos[[k]][2], x - 0.1, YT + 1.25 + h1, wc + 0.1, 2.2, 12.5, tinta) }
  doc }
doc <- resumen(doc, TRUE)
doc <- resumen(doc, FALSE)
nota_donde("constructor nuevo p_slide_resumen con dos a cuatro hallazgos (titular, texto y color). Cifras del recetario de Contabilidad")

# ---------------------------------------------------------------- 3 y 6. Bottom Two Box y línea punteada bajo el Total
filas_b2b <- function(doc, x, y, w, premisa, filas, impacto = NULL, fila = 0.46, wlab = 1.6) {   # barras de escala con T2B y B2B; la fila «Total» va arriba y separada
  wimp <- if (is.null(impacto)) 0 else 1.0; wcol <- 1.25; xb <- x + wimp + wlab + 0.12; wb <- w - wimp - wlab - 0.12 - 2 * wcol - 0.25
  xt2 <- xb + wb + 0.15; xb2 <- xt2 + wcol + 0.1; g <- 0.28
  txt(doc, premisa, x - 0.1, y, w, 0.34, 13, TK$navy, bold = TRUE)
  yh <- y + 0.42
  txt(doc, "Top Two Box", xt2 - 0.05, yh, wcol + 0.1, 0.26, 10, TK$verde_txt, bold = TRUE, align = "center")
  txt(doc, "Bottom Two Box", xb2 - 0.05, yh, wcol + 0.1, 0.26, 10, "#9C4421", bold = TRUE, align = "center")
  if (!is.null(impacto)) txt(doc, "Impacto", x - 0.1, yh, wimp + 0.1, 0.26, 10, TK$soft, bold = TRUE, align = "center")
  yy <- yh + 0.3
  for (k in seq_along(filas)) { fl <- filas[[k]]; yb <- yy + (fila - g) / 2
    if (!is.null(impacto)) txt(doc, impacto[k], x - 0.1, yb + (g - 0.3) / 2, wimp + 0.1, 0.3, 13, TK$navy, bold = impacto[k] != "-", align = "center")
    txt(doc, fl$actor, x + wimp, yb + (g - 0.3) / 2, wlab, 0.3, 12, TK$navy, bold = TRUE, align = "right")
    barra_apilada(doc, xb, yb, wb, fl$f$pct, TK$likert, g)
    caja(doc, xt2, yb - 0.02, wcol, g + 0.04, "#E3F0DA"); txt(doc, paste0(ttb(fl$f), "%"), xt2, yb + (g - 0.3) / 2, wcol, 0.3, 13, VERDE_OSC, bold = TRUE, align = "center")
    caja(doc, xb2, yb - 0.02, wcol, g + 0.04, "#FBE3D3"); txt(doc, paste0(b2b(fl$f), "%"), xb2, yb + (g - 0.3) / 2, wcol, 0.3, 13, "#9C4421", bold = TRUE, align = "center")
    if (identical(fl$actor, "Total")) for (j in 0:floor((w - wimp) / 0.14)) caja(doc, x + wimp + j * 0.14, yy + fila + 0.02, 0.08, 0.012, TK$soft)   # línea punteada
    yy <- yy + fila + (if (identical(fl$actor, "Total")) 0.06 else 0) }
  invisible(yy) }
tot <- function(a, na, b, nb) round((a * na + b * nb) / (na + nb))
doc <- nueva(doc); titulo(doc, "Servicios de tutoría", ante = "Propuestas 3 y 6: Bottom Two Box y línea bajo el Total")
d1 <- c(0, 2, 29, 54, 15); e1 <- c(6, 18, 34, 19, 23); d2 <- c(0, 2, 31, 44, 23); e2 <- c(3, 6, 45, 32, 13)
y_ <- filas_b2b(doc, XC, YT - 0.1, AC, "La Unidad cuenta con servicios de tutoría académica",
                list(fila_s("Total", tot(d1, 52, e1, 172), 224), fila_s("Docentes", d1, 52), fila_s("Estudiantes", e1, 172)))
filas_b2b(doc, XC, y_ + 0.2, AC, "La Unidad cuenta con servicios de tutoría socioemocional",
          list(fila_s("Total", tot(d2, 52, e2, 172), 224), fila_s("Docentes", d2, 52), fila_s("Estudiantes", e2, 172)))
leyenda(doc, 0, Y_LEY - 0.05, LIKERT_ROT, TK$likert, centrar_en = W / 2)
nota_donde("bloque_likert y likert_panel (columna B2B opcional y línea punteada cuando hay fila Total). Base: 52 docentes y 172 estudiantes")

# ---------------------------------------------------------------- 4. columna de impacto y lámina de pesos
doc <- nueva(doc); titulo(doc, "Satisfacción con la atención en la Unidad", ante = "Propuesta 4: impacto en la satisfacción")
atr <- list(fila_s("Trato del personal", c(3, 8, 47, 38, 4), 224), fila_s("Claridad de la información", c(4, 12, 51, 29, 4), 224),
            fila_s("Tiempo de atención", c(9, 19, 45, 22, 5), 224), fila_s("Infraestructura", c(2, 9, 52, 33, 4), 224))
filas_b2b(doc, XC, YT - 0.1, AC, "¿Qué tan satisfecho está con cada aspecto de la atención?", atr, impacto = c("41%", "26%", "33%", "-"), fila = 0.66, wlab = 2.5)
txt(doc, "Impacto: peso de cada aspecto en la satisfacción general, según una regresión lineal. El guion indica un aspecto sin efecto significativo.", XT, YT + 3.35, AC, 0.5, 12, TK$navy)
leyenda(doc, 0, Y_LEY - 0.05, LIKERT_ROT, TK$likert, centrar_en = W / 2)
pie(doc, "Cifras ficticias. Requiere un análisis nuevo en Analítica: regresión de la satisfacción general sobre los aspectos evaluados")

doc <- nueva(doc); titulo(doc, "Qué pesa más en la satisfacción general", ante = "Propuesta 4: impacto en la satisfacción")
panel_titulo(doc, XC, YT, 7.4, "Peso de cada aspecto", "Aspectos con efecto significativo, suman 100 %")
barras_h(doc, XC, YT + 0.65, 7.4, c("Trato del personal", "Tiempo de atención", "Claridad de la información"), c(41, 33, 26), wlab = 2.6, g = 0.42, fila = 0.75, size = 14, escala = 50)
narrativa(doc, 8.6, YT + 0.6, W - MR - 8.6, 2.6, list(N_("El "), B("trato del personal"), N_(" explica la mayor parte de la satisfacción general. La "), B("infraestructura"),
  N_(" se evalúa bien, pero no cambia la satisfacción general.")), size = 15)
pie(doc, "Cifras ficticias. En lugar del diagrama de flecha del informe de referencia: barras, que dicen lo mismo y se leen mejor")

# ---------------------------------------------------------------- 5. tabla resumen con significancia
doc <- nueva(doc); titulo(doc, "Formulación del perfil de egreso por público", ante = "Propuesta 5: tabla con significancia")
tb <- data.frame(Competencia = c("Estados financieros", "Tributación", "Auditoría", "Finanzas", "Visión empresarial", "Costos y presupuestos"),
                 Docentes = c(98, 94, 96, 96, 92, 92), Estudiantes = c(96, 96, 91, 95, 94, 94), Egresados = c(98, 98, 98, 93, 95, 94))
sig <- matrix(FALSE, 6, 3); sig[3, 3] <- TRUE; sig[3, 1] <- TRUE; sig[2, 3] <- TRUE; sig[4, 1] <- TRUE
tb2 <- tb; for (j in 2:4) tb2[[j]] <- paste0(tb[[j]], "%")
ft <- flextable(tb2) |> font(fontname = TK$font, part = "all") |> fontsize(size = 14, part = "all") |> fontsize(size = 12, part = "header") |>
  color(color = TK$navy, part = "all") |> bold(part = "header") |> bold(j = 1) |> align(j = 2:4, align = "center", part = "all") |> border_remove() |>
  border_inner_h(border = fp_border(color = TK$rule, width = 0.5)) |> hline_bottom(border = fp_border(color = TK$navy, width = 1), part = "header") |>
  width(j = 1, width = 3.4) |> width(j = 2:4, width = 1.7) |> padding(padding.top = 7, padding.bottom = 7, part = "all")
for (i in 1:6) for (j in 1:3) if (sig[i, j]) ft <- ft |> bg(i = i, j = j + 1, bg = "#E3F0DA") |> color(i = i, j = j + 1, color = VERDE_OSC) |> bold(i = i, j = j + 1)
invisible(ph_with(doc, ft, location = ph_location(left = XC, top = YT, width = 8.5, height = 3.8)))
narrativa(doc, 9.4, YT + 0.4, W - MR - 9.4, 2.4, list(N_("La celda en "), B("verde"), N_(" es significativamente mayor que el público más bajo de su fila. El motor ya calcula estas pruebas para las barras: falta llevarlas a la tabla.")), size = 14)
pie(doc, "Top Two Box. Marcas de significancia ilustrativas (p < 0.05). Base: 51 docentes, 109 estudiantes y 161 egresados")

# ---------------------------------------------------------------- 7. bloques numerados de cierre
bloque_num <- function(doc, k, y, h, titulo_, texto) {
  caja(doc, XC, y, 0.75, h, TK$navy); txt(doc, k, XC - 0.1, y + (h - 0.6) / 2, 0.95, 0.6, 30, "#FFFFFF", bold = TRUE, align = "center")
  caja(doc, XC + 0.85, y, AC - 0.85, h, TK$zebra)
  txt(doc, titulo_, XC + 1.0, y + 0.1, AC - 1.2, 0.32, 14, TK$navy, bold = TRUE)
  txt(doc, texto, XC + 1.0, y + 0.42, AC - 1.2, h - 0.48, 12, TK$navy) }
doc <- nueva(doc); titulo(doc, "Limitaciones del estudio", ante = "Propuesta 7: bloques numerados")
bloque_num(doc, 1, YT, 1.15, "Muestra no probabilística", "La encuesta se aplicó por conveniencia, con intención censal. Los resultados describen a quienes respondieron y no se proyectan a toda la población de cada público.")
bloque_num(doc, 2, YT + 1.35, 1.15, "Bases chicas", "El personal administrativo (15 casos) y los grupos de menos de 30 casos se reportan con frecuencias y sin pruebas de diferencia.")
bloque_num(doc, 3, YT + 2.7, 1.15, "Comparación con 2021", "El informe anterior se usa como referencia. Algunas preguntas cambiaron de redacción, por lo que la comparación se limita a las que se mantienen.")
pie(doc, "")
doc <- nueva(doc); titulo(doc, "Consideraciones para replicar el estudio", ante = "Propuesta 7: bloques numerados")
bloque_num(doc, 1, YT, 0.95, "Mismo cuestionario y escala", "Cualquier cambio en una pregunta clave rompe la comparación. Si se cambia, se documenta.")
bloque_num(doc, 2, YT + 1.08, 0.95, "Mismo momento del ciclo", "Aplicar en el mismo periodo académico evita comparar públicos en momentos distintos del año.")
bloque_num(doc, 3, YT + 2.16, 0.95, "Mismos públicos y marco", "Docentes, estudiantes, egresados y administrativos, con el marco actualizado de cada uno.")
bloque_num(doc, 4, YT + 3.24, 0.95, "Mismo procesamiento", "Top Two Box, redondeo del resto mayor y las mismas reglas para «Sin información».")
nota_donde("constructor nuevo p_slide_bloques (dos a cuatro bloques, con título y texto). Las recomendaciones quedaron fuera del motor cuantitativo")

# ---------------------------------------------------------------- 8. pregunta exacta en el pie
doc <- nueva(doc); titulo(doc, "Misión y propósitos institucionales", ante = "Propuesta 8: pregunta exacta en el pie")
filas_m <- lapply(1:4, function(i) list(lab = c("Docentes", "Estudiantes", "Egresados", "Administrativos")[i], f = D$mision1[[i]]))
likert_panel(doc, XC, YT + 0.2, 8.4, filas_m, cols = TK$dico, ttb_col = FALSE, g = 0.36, fila = 0.72, wlab = 1.7, size_lab = 12)
leyenda(doc, 0, YT + 3.55, c("Sí", "No"), TK$dico, centrar_en = XC + 4.2)
narrativa(doc, 9.3, YT + 0.4, W - MR - 9.3, 2.3, list(N_("Hoy el pie dice sólo la base. La propuesta agrega la "), B("redacción exacta de la pregunta"), N_(", tal como se leyó en la encuesta.")), size = 14)
txt(doc, "Pregunta: «¿Conoce usted la misión y los propósitos de la PUCP?»", ML, Y_BASE - 0.28, 10.5, 0.3, PT$base, TK$soft, italic = TRUE)
pie(doc, "Base: 52 docentes, 172 estudiantes, 178 egresados y 15 administrativos")
