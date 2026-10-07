# Recetario v2, Parte I: reglas de la identidad en PPT. Se carga en recetario.R tras la portadilla I.
# Pedidos de Gonzalo: «diapositivas iniciales que aclaren las reglas de tamaño estándar para cada
# elemento, su color, etc.» y (2026-10-07) «las reglas de gráficos en Word y en PPT son algo
# diferentes y ambas deben estar mucho más claras para que cualquier público pueda entenderlo».
# Por eso: lenguaje llano, sin códigos ni coordenadas en el cuerpo (los códigos van al pie para
# quien diseña), un ejemplo anotado al inicio y una lámina final con lo que cambia en Word.
# Tamaños MEDIDOS con herramientas/medir_estilo.py en los consolidados finales de Derecho,
# Educación Primaria, Comunicaciones, AMDT, Escultura y Contabilidad (2025 y 2026).

marca <- function(doc, k, x, y, d = 0.32) {               # número de anotación
  caja(doc, x, y, d, d, TK$guia, geom = "ellipse")
  txt(doc, as.character(k), x, y + 0.02, d, d - 0.04, 11, "#FFFFFF", bold = TRUE, align = "center")
}
lista_marcada <- function(doc, items, x, y, w, paso = 0.68, size = 12) {
  for (i in seq_along(items)) { yy <- y + (i - 1) * paso
    marca(doc, i, x, yy + 0.02); txt(doc, items[i], x + 0.45, yy, w - 0.45, paso, size, TK$navy) }
}

# --- R0 cómo se lee un gráfico: ejemplo anotado
MOTOR_ACT <- "Reglas: anatomía de una lámina con gráfico (ejemplo anotado)"
doc <- nueva(doc); titulo(doc, "Cómo se lee un gráfico de este informe", ante = "Reglas de la identidad")
x0 <- XC; y0 <- Y_DATOS - 0.1; w0 <- 8.45; h0 <- 5.0
contorno(doc, x0, y0, w0, h0, TK$rule, lty = "solid")
txt(doc, if (ESTILO == "fiel") "SERVICIOS DE APOYO AL ESTUDIANTE" else "Servicios de apoyo al estudiante", x0 + 0.5, y0 + 0.18, 7, 0.4, 16, TK$coral, bold = TRUE)
txt(doc, "La Unidad cuenta con servicios de tutoría académica", x0 + 0.5, y0 + 0.78, 7, 0.32, 13, TK$navy, bold = TRUE)
fl <- function(lab, p, v) list(lab = lab, f = list(pct = p, n = round(p * v / 100), valid = v))
likert_panel(doc, x0 + 0.5, y0 + 1.35, 7.7, list(fl("Docentes", c(2, 8, 54, 21, 15), 148), fl("Estudiantes", c(6, 18, 34, 19, 23), 1234), fl("Egresados", c(3, 12, 50, 30, 5), 314)), wlab = 1.4)
leyenda(doc, x0 + 0.45, y0 + 3.85, LIKERT_ROT, TK$likert, size = 10)
txt(doc, "Base: 148 docentes, 1,234 estudiantes y 314 egresados", x0 + 0.5, y0 + 4.45, 7, 0.3, 10, TK$navy, bold = TRUE)
xb_ <- x0 + 0.5 + 1.4 + 0.12; wb_ <- 7.7 - 1.4 - 0.12 - 0.75
marca(doc, 1, x0 + 0.08, y0 + 0.22); marca(doc, 2, x0 + 0.08, y0 + 0.78); marca(doc, 3, x0 + 0.08, y0 + 1.85)
marca(doc, 4, xb_ + wb_ * 0.37 - 0.16, y0 + 1.25); marca(doc, 5, x0 + 0.5 + 7.7 - 1.3 - 0.3, y0 + 1.26)
marca(doc, 6, x0 + 0.08, y0 + 3.85); marca(doc, 7, x0 + 0.08, y0 + 4.44)
lista_marcada(doc, c(
  "El título nombra el tema de la lámina.",
  "La pregunta aparece tal como se hizo en la encuesta.",
  "Cada fila es un grupo de personas: docentes, estudiantes o egresados.",
  "Naranja y amarillo son desacuerdo, verde es acuerdo y gris, sin información.",
  "Top Two Box suma las dos respuestas de acuerdo. Es la cifra que resume cada fila.",
  "La leyenda nombra los colores en el mismo orden de la barra.",
  "La base dice cuántas personas respondieron. Los porcentajes se calculan sobre ella."),
  x0 + w0 + 0.35, y0 + 0.05, W - MR - (x0 + w0 + 0.35), paso = 0.7, size = 11.5)
pie(doc, "Cada barra suma 100 %. Las cifras de este ejemplo son ficticias")

# --- R1 tamaño y color de cada elemento, en palabras
MOTOR_ACT <- "Reglas: tamaño, peso y color de cada elemento (medidos en 6 informes finales)"
fiel <- ESTILO == "fiel"
SPEC <- data.frame(
  Elemento = c("Título de la lámina", if (fiel) "Subtítulo" else "Antetítulo", "Pregunta", "Grupo de cada fila", "Cifra en la barra",
               "Top Two Box", "Leyenda", "Texto de análisis", "Base", "Respuestas por grupo"),
  `Cómo se ve` = c(if (fiel) "24 pt, negrita, coral y en mayúsculas" else "24 pt, negrita, coral",
                   if (fiel) "14 pt, azul oscuro, bajo el título" else "10 pt, negrita, gris, sobre el título",
                   "13 pt, negrita, azul oscuro", "12 pt, negrita, azul oscuro, a la izquierda de la barra",
                   "14 pt, negrita. Si el tramo es angosto, 12 pt encima, con una línea guía",
                   if (fiel) "13 pt, negrita, verde, en una columna a la derecha" else "14 pt, negrita, verde, en una columna a la derecha",
                   if (fiel) "10.5 pt, azul oscuro, debajo del gráfico" else "12 pt, azul oscuro, debajo del gráfico",
                   "14 pt, azul oscuro, con las cifras en negrita", "10 pt, negrita, azul oscuro, al pie de la lámina",
                   if (fiel) "No se usa" else "10 pt, gris, debajo del nombre del grupo"),
  `Para qué sirve` = c("Nombrar el tema", "Ubicar la lámina en su capítulo", "Mostrar lo que se preguntó", "Decir de quién es cada barra",
                       "Dar el porcentaje de cada respuesta", "Resumir el acuerdo de cada grupo", "Nombrar cada color", "Contar lo que se ve",
                       "Decir cuántos respondieron", "Mostrar el tamaño de cada grupo"),
  check.names = FALSE)
doc <- nueva(doc); titulo(doc, "Tamaño y color de cada elemento", ante = "Reglas de la identidad")
ft <- flextable(SPEC) |> font(fontname = TK$font, part = "all") |> fontsize(size = 13, part = "all") |> fontsize(size = 11.5, part = "header") |>
  color(color = TK$navy, part = "all") |> bold(j = 1) |> bold(part = "header") |> width(j = 1, width = 2.9) |> width(j = 2, width = 5.6) |> width(j = 3, width = 3.6) |>
  border_remove() |> padding(padding.top = 6, padding.bottom = 6, part = "all") |> valign(valign = "center", part = "all")
ft <- if (fiel) ft |> bg(part = "header", bg = TK$coral) |> color(part = "header", color = "#FFFFFF") |> border_inner_h(border = fp_border(color = "#757070", width = 0.5)) |> border_outer(border = fp_border(color = "#757070", width = 0.75)) else
  ft |> hline_top(border = fp_border(color = TK$navy, width = 1.25), part = "header") |> hline_bottom(border = fp_border(color = TK$navy, width = 0.75), part = "header") |>
    hline(border = fp_border(color = TK$rule, width = 0.5)) |> color(part = "header", color = TK$soft) |> color(j = 3, color = TK$soft, part = "body")
ft <- ancho_ft(ft); invisible(ph_with(doc, ft, location = ph_location(left = XC, top = Y_DATOS - 0.15, width = AC, height = 4.9)))
zona("tabla de tamaños", XC, Y_DATOS - 0.15, AC, 4.9)
pie(doc, "Todo en Arial y nada bajo 10 pt. Tamaños medidos en 2,725 cuadros de texto de 6 informes entregados (2025 y 2026)")

# --- R2 dónde va cada cosa: la lámina dibujada a escala
MOTOR_ACT <- "Reglas: retícula de la lámina 16:9 (13.33 x 7.5 in) con márgenes y bandas"
doc <- nueva(doc); titulo(doc, "Dónde va cada cosa en la lámina", ante = "Reglas de la identidad")
k <- 0.56; ox <- XC; oy <- Y_DATOS - 0.05
caja(doc, ox, oy, W * k, H * k, "#FFFFFF", line = sp_line(color = TK$rule, lwd = 0.75))
banda <- function(y0, y1, col, et, x0 = ML, x1 = W - MR) { caja(doc, ox + x0 * k, oy + y0 * k, (x1 - x0) * k, (y1 - y0) * k, col)
  txt(doc, et, ox + x0 * k + 0.08, oy + y0 * k + 0.02, (x1 - x0) * k, 0.24, 10, TK$navy, bold = TRUE) }
banda(Y_TIT, Y_TIT + 0.75, "#F6D9D7", "1  Título")
banda(Y_DATOS, Y_LEY - 0.1, "#E2EFD9", "2  Gráfico, pregunta y texto")
banda(Y_LEY - 0.05, Y_LEY + 0.3, "#FFF2CC", "3  Leyenda")
banda(Y_BASE - 0.05, Y_BASE + 0.25, "#E3E7EF", "4  Base")
xr_ <- ox + W * k + 0.4; wr_ <- W - MR - xr_
cm1 <- function(x) sprintf("%.1f cm", x * 2.54)
lista_marcada(doc, c(
  sprintf("El título va arriba a la izquierda, a %s del borde.", cm1(Y_TIT)),
  sprintf("El gráfico ocupa la franja central y empieza a %s de arriba.", cm1(Y_DATOS)),
  "La leyenda va siempre debajo del gráfico, centrada en él.",
  "La base cierra la lámina, en la última línea.",
  sprintf("Se deja %s de margen a cada lado y %s entre dos gráficos.", cm1(ML), cm1(GAP)),
  "Si algo no cabe, el contenido pasa a otra lámina marcada «(cont.)». La letra no se achica."),
  xr_, oy, wr_, paso = 0.7, size = 12)
zona("lámina a escala 0.56", ox, oy, W * k, H * k)
pie(doc, "Lámina de 16:9 dibujada a la mitad de su tamaño. Todas las láminas del informe usan este mismo esqueleto")

# --- R3 colores y lo que significan
MOTOR_ACT <- "Reglas: paleta validada y regla de uso de cada color"
doc <- nueva(doc); titulo(doc, "Los colores y lo que significan", ante = "Reglas de la identidad")
sw <- function(x, y, cols, labs, w = 1.45) for (i in seq_along(cols)) { caja(doc, x + (i - 1) * (w + 0.1), y, w, 0.45, cols[i])
  txt(doc, labs[i], x + (i - 1) * (w + 0.1) - 0.05, y + 0.5, w + 0.1, 0.42, 10, TK$navy, align = "center") }
grupos <- list(
  list("Respuestas de una escala", TK$likert, c("Muy en contra", "En contra", "A favor", "Muy a favor", "Sin información"),
       "De lo negativo a lo positivo, siempre en este orden. Lo negativo es naranja, nunca rojo. Sin información va al final y en gris."),
  list("Sí y No", TK$dico, c("Sí", "No"), "Sí en azul oscuro y No en celeste, en todas las láminas."),
  list("Grupos de personas", c(unname(TK$actores), "#8E9DBD", "#081F5C", "#9DC3E6"), c(names(TK$actores), "Autoridades", "Administrativos", "Empleadores"),
       "Cada grupo conserva su color en todo el informe. Si el nombre ya está escrito junto a la barra, no necesita color."),
  list("Texto y énfasis", c("#081F5C", "#CA5651", "#4E9438", "#8E9DBD"), c("Texto", "Títulos", "Top Two Box", "Barras de apoyo"),
       "El coral sólo se usa en los títulos. El verde sólo marca el Top Two Box."))
y <- Y_DATOS - 0.15
for (g_ in grupos) { txt(doc, g_[[1]], XT, y, 5, 0.3, 13, TK$navy, bold = TRUE)
  sw(XC, y + 0.32, g_[[2]], g_[[3]], w = if (length(g_[[2]]) > 5) 1.12 else 1.25)
  txt(doc, g_[[4]], 8.3, y + 0.3, W - MR - 8.3, 0.8, 12, TK$navy)
  y <- y + 1.22 }
pie(doc, "Para quien diseña: azul oscuro 081F5C, coral CA5651, verde 4E9438. Escala F4B183, FFD965, ADD493, 70AD47 y BFBFBF")

# --- R4 el texto que acompaña al gráfico
MOTOR_ACT <- "Reglas: texto narrativo en láminas con gráfico (p_slide_*_narrativo, p_slide_grafico_texto_*)"
doc <- nueva(doc); titulo(doc, "El texto que acompaña al gráfico", ante = "Reglas de la identidad")
wg <- 7.6; xg <- XC; xt <- xg + wg + 0.45; wt <- W - MR - xt
contorno(doc, xg, Y_DATOS + 0.1, wg, 4.3, TK$faint, lty = "dash")
txt(doc, "Gráfico", xg, Y_DATOS + 2.0, wg, 0.4, 16, TK$faint, bold = TRUE, align = "center")
txt(doc, "ocupa cerca de 60 % del ancho", xg, Y_DATOS + 2.4, wg, 0.3, 11, TK$faint, align = "center")
narrativa(doc, xt, Y_DATOS + 0.3, wt, 2.2, list(N_("El "), B("75 % de los docentes"), N_(" y el "), B("53 % de los estudiantes"),
  N_(" está de acuerdo o totalmente de acuerdo con que la Unidad cuenta con servicios de tutoría. Uno de cada cuatro estudiantes no tiene información sobre el servicio.")), size = 14)
lista_marcada(doc, c("Es breve: unas 50 palabras y nunca más de 74.", "Va a la derecha del gráfico. Arriba, sólo si el gráfico usa todo el ancho.",
                     "Las cifras que cita van en negrita y son las del gráfico.", "No repite la pregunta: cuenta lo que se ve."),
  xt, Y_DATOS + 2.75, wt, paso = 0.48, size = 11)
zona("texto: 4.5 in de ancho, 14 pt", xt, Y_DATOS + 0.3, wt, 2.2)
pie(doc, "Medido en 247 párrafos que acompañan gráficos en 6 informes entregados")

# --- R5 lo que cambia entre PPT y Word
MOTOR_ACT <- "Reglas: diferencias entre el gráfico en PPT y en Word (reporte_ppt_plan frente a reporte_word_plan)"
doc <- nueva(doc); titulo(doc, "En PPT y en Word: lo que cambia", ante = "Reglas de la identidad")
DIF <- data.frame(
  Aspecto = c("Título", "Tamaño de letra", "Fondo", "Base", "Texto de análisis", "Numeración", "Si no cabe"),
  `En PPT` = c("Es el título de la lámina, arriba y en coral", "12 a 14 pt: se lee proyectado", "La lámina blanca. El gráfico se puede editar",
               "Al pie de la lámina", "Al costado del gráfico, hasta 74 palabras", "Los gráficos no se numeran", "Pasa a otra lámina con «(cont.)»"),
  `En Word` = c(if (ESTILO == "fiel") "Una línea sobre la imagen: «Gráfico N°5: pregunta»" else "Dos líneas sobre la imagen: «GRÁFICO 5» y la pregunta", "8 a 10 pt: se lee impreso", "Imagen sin fondo sobre la página",
                "Debajo del gráfico, junto con la fuente", "Un párrafo debajo del gráfico, justificado", "Gráficos y tablas llevan número correlativo",
                "Título, gráfico y base pasan juntos a la página siguiente"),
  check.names = FALSE)
ft <- flextable(DIF) |> font(fontname = TK$font, part = "all") |> fontsize(size = 13, part = "all") |> fontsize(size = 11.5, part = "header") |>
  color(color = TK$navy, part = "all") |> bold(j = 1) |> bold(part = "header") |> width(j = 1, width = 2.3) |> width(j = 2:3, width = 4.9) |>
  border_remove() |> padding(padding.top = 7, padding.bottom = 7, part = "all") |> valign(valign = "center", part = "all")
ft <- if (fiel) ft |> bg(part = "header", bg = TK$coral) |> color(part = "header", color = "#FFFFFF") |> border_inner_h(border = fp_border(color = "#757070", width = 0.5)) |> border_outer(border = fp_border(color = "#757070", width = 0.75)) else
  ft |> hline_top(border = fp_border(color = TK$navy, width = 1.25), part = "header") |> hline_bottom(border = fp_border(color = TK$navy, width = 0.75), part = "header") |>
    hline(border = fp_border(color = TK$rule, width = 0.5)) |> color(part = "header", color = TK$soft)
ft <- ancho_ft(ft); invisible(ph_with(doc, ft, location = ph_location(left = XC, top = Y_DATOS - 0.15, width = AC, height = 4.2)))
zona("tabla PPT y Word", XC, Y_DATOS - 0.15, AC, 4.2)
txt(doc, "Los colores, el orden de las respuestas, el Top Two Box y la ubicación de las cifras pequeñas son iguales en los dos formatos.", XT, Y_LEY - 0.05, AC + 0.1, 0.35, 13, TK$navy, bold = TRUE)
pie(doc, "El recetario en Word muestra cada gráfico de este mazo con su formato de página")

# --- R6 qué es cada elemento en PowerPoint (pedido de Gonzalo: los elementos se presentan y se pueden editar)
MOTOR_ACT <- "Reglas: naturaleza nativa de cada elemento de la lámina (título en marcador de título, gráficos vectoriales rvg::dml, tablas flextable)"
doc <- nueva(doc); titulo(doc, "Qué es cada elemento en PowerPoint", ante = "Reglas de la identidad")
EL <- data.frame(
  Elemento = c("Título", "Antetítulo, texto y base", "Gráfico", "Tabla", "Logo"),
  `Qué es en PowerPoint` = c("El marcador de título de la lámina. Aparece en el esquema y en el panel de navegación",
                             "Cuadros de texto con su tamaño y color fijados", "Un gráfico vectorial: cada barra y cada cifra es una forma de PowerPoint",
                             "Una tabla de PowerPoint", "Una imagen del diseño de la lámina, igual en todas"),
  `Cómo se ajusta` = c("Se escribe en el cuadro. Su formato base está en el patrón de diapositivas", "Se escribe en el cuadro",
                       "Clic derecho > Agrupar > Desagrupar para cambiar una forma. Los datos se cambian volviendo a generar con el motor",
                       "Pestaña Diseño de tabla", "Vista > Patrón de diapositivas"),
  check.names = FALSE)
ft <- flextable(EL) |> font(fontname = TK$font, part = "all") |> fontsize(size = 13, part = "all") |> fontsize(size = 11.5, part = "header") |>
  color(color = TK$navy, part = "all") |> bold(j = 1) |> bold(part = "header") |> width(j = 1, width = 2.6) |> width(j = 2:3, width = 4.75) |>
  border_remove() |> padding(padding.top = 8, padding.bottom = 8, part = "all") |> valign(valign = "center", part = "all")
ft <- if (fiel) ft |> bg(part = "header", bg = TK$coral) |> color(part = "header", color = "#FFFFFF") |> border_inner_h(border = fp_border(color = "#757070", width = 0.5)) |> border_outer(border = fp_border(color = "#757070", width = 0.75)) else
  ft |> hline_top(border = fp_border(color = TK$navy, width = 1.25), part = "header") |> hline_bottom(border = fp_border(color = TK$navy, width = 0.75), part = "header") |>
    hline(border = fp_border(color = TK$rule, width = 0.5)) |> color(part = "header", color = TK$soft)
ft <- ancho_ft(ft); invisible(ph_with(doc, ft, location = ph_location(left = XC, top = Y_DATOS - 0.15, width = AC, height = 4.2)))
zona("tabla de elementos", XC, Y_DATOS - 0.15, AC, 4.2)
pie(doc, "En este recetario las barras se dibujan con formas para mostrar cada medida. En un informe real las genera el motor")
