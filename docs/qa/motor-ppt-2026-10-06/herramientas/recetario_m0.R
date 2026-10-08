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
  txt(doc, as.character(k), x, y, d, d, if (d < 0.3) 10 else 11, "#FFFFFF", bold = TRUE, align = "center", nombre = "Centro marca")   # sanear_ph.py lo ancla al centro sin márgenes
}
lista_marcada <- function(doc, items, x, y, w, paso = 0.68, size = 12) {
  for (i in seq_along(items)) { yy <- y + (i - 1) * paso
    marca(doc, i, x, yy + 0.02); txt(doc, items[i], x + 0.45, yy, w - 0.45, paso, size, TK$navy) }
}

# Lámina estándar en miniatura, fiel a la plantilla (logo real del layout «Graficos» en 11.03, 0.18 in). La usan la anatomía y «Qué es cada
# elemento en PowerPoint» (Gonzalo, 2026-10-08: «primero tienes que presentarla… dónde va el título, el antetítulo, la pregunta»).
dir_logo <- file.path(tempdir(), "logo_lamina"); utils::unzip("api/inst/plantillas/plantilla_16_9.pptx", files = "ppt/media/image6.png", exdir = dir_logo, overwrite = TRUE)
LOGO_LAM <- file.path(dir_logo, "logo_recortado.png")   # X1: el layout recorta la imagen (arriba 29.471 %, abajo 26.643 %); se reproduce ese recorte para no estirarla
local({ im <- png::readPNG(file.path(dir_logo, "ppt/media/image6.png")); h <- dim(im)[1]; r <- seq(floor(h * 0.29471) + 1, h - floor(h * 0.26643)); png::writePNG(im[r, , , drop = FALSE], LOGO_LAM) })
mini_lamina <- function(doc, ox, oy, k) {   # dibuja la lámina estándar a escala k; devuelve el ancla de cada elemento en coordenadas de la lámina real
  caja(doc, ox, oy, W * k, H * k, TK$fondo, line = sp_line(color = TK$rule, lwd = 0.75))
  invisible(ph_with(doc, external_img(LOGO_LAM, width = 2.11 * k, height = 0.93 * k), location = ph_location(left = ox + 11.03 * k, top = oy + 0.18 * k, width = 2.11 * k, height = 0.93 * k)))
  caja(doc, ox + ML0 * k, oy + (Y_TIT - 0.12) * k, 0.03, 0.72 * k, TK$navy)
  tx <- function(t, x, y, w, size, col, bold = TRUE, align = "left") txt(doc, t, ox + x * k - 0.06, oy + y * k, w, size * 1.25 / 72 + 0.06, size, col, bold = bold, align = align)
  tx("CARACTERÍSTICAS INSTITUCIONALES", ML, Y_TIT - 0.2, 4, 7, TK$soft)
  tx("Servicios de tutoría", ML, Y_TIT + 0.04, 6, 15, TK$coral)
  tx("La Unidad cuenta con servicios de tutoría académica", ML, 1.6, 6, 8.5, TK$navy)
  tx("402 respuestas", ML, 1.92, 3, 7, TK$faint, bold = FALSE)
  # Tres públicos que llenan la zona de datos (Gonzalo, 2026-10-08: «¿por qué este slide de ejemplo se ve tan vacío?») y una leyenda
  # medida con la tinta de cada rótulo más su cuadro y un aire fijo, para que las categorías no se toquen («se superponen»).
  cl <- TK$likert; xb <- 2.4; wb <- 8.6; g_m <- 0.62
  sgs <- list(c(0, 2, 29, 54, 15), c(6, 18, 34, 19, 23), c(3, 12, 50, 30, 5)); ybs <- 2.55 + (0:2) * 1.05
  for (r in 1:3) { yb <- ybs[r]; xx <- xb; sg <- sgs[[r]]
    txt(doc, c("Docentes", "Estudiantes", "Egresados")[r], ox + 0.4 * k, oy + (yb + g_m / 2) * k - 0.12, 1.9 * k, 0.24, 7.5, TK$navy, bold = TRUE, align = "right")
    for (j in 1:5) { w_ <- wb * sg[j] / 100
      if (w_ > 0) { caja(doc, ox + xx * k, oy + yb * k, w_ * k, g_m * k, cl[j]); if (sg[j] >= 10) txt(doc, paste0(sg[j], "%"), ox + xx * k, oy + (yb + g_m / 2) * k - 0.11, w_ * k, 0.22, 7, texto_sobre(cl[j]), bold = TRUE, align = "center") }
      xx <- xx + w_ }
    txt(doc, paste0(sum(sg[3:4]), "%"), ox + 11.25 * k, oy + (yb + g_m / 2) * k - 0.12, 1.4 * k, 0.24, 8, TK$verde_txt, bold = TRUE, align = "center") }
  txt(doc, "Top Two Box", ox + 11.0 * k, oy + 2.1 * k, 1.9 * k, 0.2, 6.5, TK$verde_txt, bold = TRUE, align = "center")
  rot <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información")   # X2: sin abreviar
  y_ley <- 5.75; cuad <- 0.09; wr <- vapply(rot, function(t_) cuad + 0.06 + ancho_tinta(t_, 6), 0); gap_l <- 0.16
  x_ <- ox + 6.7 * k - (sum(wr) + gap_l * 4) / 2; ley_x <- (x_ - ox) / k
  for (j in 1:5) { caja(doc, x_, oy + y_ley * k + 0.015, cuad, cuad, cl[j]); txt(doc, rot[j], x_ + cuad + 0.06 - 0.05, oy + y_ley * k - 0.045, wr[j] + 0.1, 0.2, 6, TK$navy); x_ <- x_ + wr[j] + gap_l }
  tx("Base: 52 docentes, 172 estudiantes y 178 egresados", ML, Y_BASE, 5, 7, TK$navy)
  txt(doc, "12", ox + (W - MR - 0.6) * k, oy + Y_BASE * k, 0.6 * k, 0.2, 7, TK$soft, align = "right")
  list(ante = c(ML, Y_TIT - 0.1, 0), titulo = c(ML, Y_TIT + 0.3, 0), logo = c(13.14, 0.65, 1), pregunta = c(ML, 1.8, 0), grafico = c(2.4, 3.385, 0),
       ttb = c(12.6, 3.91, 1), leyenda = c(ley_x, 5.8, 0), base = c(ML, Y_BASE + 0.12, 0)) }
anotar <- function(doc, ox, oy, k, pos, items, xl, d = 0.26) {   # marcas fuera de la miniatura, con línea guía hasta su elemento, y la lista a la derecha
  ult <- -1
  for (m in seq_along(items)) { a <- pos[[items[[m]][[1]]]]; ye <- oy + a[2] * k
    if (a[3] == 0) { xm <- if (ye - ult < 0.3) ox - 0.68 else ox - 0.36; ult <- ye
      caja(doc, xm + d, ye - 0.006, ox + a[1] * k - 0.05 - xm - d, 0.012, TK$guia) } else {
      xm <- ox + W * k + 0.12; caja(doc, ox + a[1] * k + 0.04, ye - 0.006, xm - ox - a[1] * k - 0.04, 0.012, TK$guia) }
    marca(doc, m, xm, ye - d / 2, d = d) }
  wl <- W - MR - xl; hl <- (H * k + 0.1) / length(items)
  for (m in seq_along(items)) { yl <- oy + (m - 1) * hl
    marca(doc, m, xl, yl + 0.02, d = d)
    txt(doc, items[[m]][[2]], xl + d + 0.1, yl - 0.04, wl - d - 0.1, 0.3, 12.5, TK$navy, bold = TRUE)
    txt(doc, items[[m]][[3]], xl + d + 0.1, yl + 0.24, wl - d - 0.1, 0.5, 10.5, TK$soft) } }

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

# --- R2 en la propuesta nueva: la lámina estándar, presentada antes de medirla (Gonzalo, 2026-10-08)
if (NUEVA) {
MOTOR_ACT <- "Reglas: estructura de la lámina estándar (p_slide_1_grafico, layout Graficos)"
doc <- nueva(doc); titulo(doc, "La lámina estándar", ante = "Reglas de la lámina")
k <- 0.58; ox <- XC + 0.75; oy <- YT - 0.05; pos <- mini_lamina(doc, ox, oy, k)
anotar(doc, ox, oy, k, pos, list(list("ante", "Antetítulo", "El capítulo o tema, sobre el título"), list("titulo", "Título", "Qué muestra la lámina, en coral"),
  list("logo", "Logo", "Fijo en la plantilla"), list("pregunta", "Pregunta y respuestas", "Tal como se hizo, y cuántos respondieron"),
  list("grafico", "Gráfico", "Ocupa la franja central"), list("ttb", "Top Two Box", "Columna verde, si la escala la lleva"),
  list("leyenda", "Leyenda", "Debajo del gráfico, centrada"), list("base", "Base y folio", "Cierran la lámina")), xl = ox + W * k + 0.6)
zona("la lámina estándar con sus ocho elementos", ox, oy, W * k, H * k)
pie(doc, "Todas las láminas del informe parten de esta estructura. La lámina siguiente da sus medidas")
} else {
# --- R2 dónde va cada cosa: la lámina dibujada a escala (C1 y C2: franjas limpias, marcas numeradas en el dibujo y una
# línea guía que une cada marca con su explicación)
MOTOR_ACT <- "Reglas: retícula de la lámina 16:9 (13.33 x 7.5 in) con márgenes y bandas"
doc <- nueva(doc); titulo(doc, "Dónde va cada cosa en la lámina", ante = "Reglas de la identidad")
k <- 0.56; ox <- XC; oy <- Y_DATOS - 0.05; fw <- W * k; fh <- H * k
caja(doc, ox, oy, fw, fh, "#FFFFFF", line = sp_line(color = TK$rule, lwd = 0.75))
banda <- function(y0, y1, col, x0 = ML, x1 = W - MR) caja(doc, ox + x0 * k, oy + y0 * k, (x1 - x0) * k, (y1 - y0) * k, col)
bandas <- list(c(Y_TIT, Y_TIT + 0.75, "#F6D9D7"), c(Y_DATOS, Y_LEY - 0.12, "#E2EFD9"), c(Y_LEY - 0.05, Y_LEY + 0.3, "#FFF2CC"), c(Y_BASE - 0.02, Y_BASE + 0.28, "#E3E7EF"))
for (b_ in bandas) banda(as.numeric(b_[1]), as.numeric(b_[2]), b_[3], x1 = if (identical(b_[3], "#F6D9D7")) W - MR - 1.7 else W - MR)
# cota del margen lateral
for (xm in c(ML, W - MR)) for (j in 0:13) caja(doc, ox + xm * k - 0.004, oy + 0.06 + j * (fh - 0.12) / 14, 0.008, (fh - 0.12) / 28, TK$guia)
textos <- c(sprintf("El título va arriba a la izquierda, a %.1f cm del borde superior.", Y_TIT * 2.54),
            sprintf("El gráfico ocupa la franja central y empieza a %.1f cm de arriba.", Y_DATOS * 2.54),
            "La leyenda va debajo del gráfico, centrada en todo el bloque.",
            "La base cierra la lámina, en la última línea.",
            sprintf("Las líneas punteadas son el margen: %.1f cm a cada lado, igual en todas las láminas.", ML * 2.54),
            "Si algo no cabe, el contenido pasa a otra lámina marcada «(cont.)». La letra no se achica.")
xl <- ox + fw + 0.85; wl <- W - MR - xl; yl <- oy + seq(0, 5) * ((fh - 0.3) / 5)
# Cada guía va por su propio carril vertical (más a la derecha cuanto más abajo está su franja): así ninguna cruza a otra.
for (i in 1:4) { yb <- oy + mean(as.numeric(bandas[[i]][1:2])) * k
  xm <- ox + fw - (if (i == 4) 0.75 else 0.38); marca(doc, i, xm, yb - 0.14, d = 0.28)
  xa <- xm + 0.28; xe <- ox + fw + 0.12 + 0.15 * i; yt <- yl[i] + 0.12
  caja(doc, xa, yb - 0.004, xe - xa, 0.008, TK$guia); caja(doc, xe - 0.004, min(yb, yt), 0.008, abs(yt - yb) + 0.008, TK$guia); caja(doc, xe, yt - 0.004, xl - xe - 0.05, 0.008, TK$guia) }
marca(doc, 5, ox + ML * k - 0.16, oy + fh - 0.42, d = 0.32)
for (i in seq_along(textos)) { if (i >= 5) marca(doc, i, xl, yl[i] - 0.04, d = 0.32)
  txt(doc, textos[i], xl + (if (i >= 5) 0.42 else 0), yl[i] - 0.06, wl - (if (i >= 5) 0.42 else 0), 0.62, 12, TK$navy) }
zona("lámina a escala 0.56", ox, oy, fw, fh)
pie(doc, "Lámina de 16:9 dibujada a poco más de la mitad de su tamaño. Todas las láminas del informe usan este esqueleto")

}
# --- R3 colores y lo que significan
MOTOR_ACT <- "Reglas: paleta validada y regla de uso de cada color"
doc <- nueva(doc); titulo(doc, "Los colores y lo que significan", ante = "Reglas de la identidad")
sw <- function(x, y, cols, labs, w = 1.45) for (i in seq_along(cols)) { caja(doc, x + (i - 1) * (w + 0.1), y, w, 0.45, cols[i])
  txt(doc, labs[i], x + (i - 1) * (w + 0.1) - 0.05, y + 0.5, w + 0.1, 0.42, 10, TK$navy, align = "center") }
grupos <- list(
  list("Escala Likert", TK$likert, c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información"),
       "De lo negativo a lo positivo, siempre en este orden. Lo negativo va en naranja. Sin información va al final y en gris."),
  list("Dicotómica", TK$dico, c("Sí", "No"), "Sí en azul oscuro y No en celeste, en todas las láminas."),
  list("Actores", c(unname(TK$actores), "#8E9DBD", "#081F5C", "#9DC3E6"), c(names(TK$actores), "Autoridades", "Administrativos", "Empleadores"),
       "Cada grupo conserva su color en todo el informe. Si el nombre ya está escrito junto a la barra, no necesita color."),
  list("Texto, títulos y realce", c("#081F5C", "#CA5651", "#4E9438", "#8E9DBD"), c("Texto", "Títulos", "Top Two Box", "Barras de apoyo"),
       "El coral sólo se usa en los títulos. El verde sólo marca el Top Two Box."))
y <- Y_DATOS - 0.15
for (g_ in grupos) { txt(doc, g_[[1]], XT, y, 5, 0.3, 13, TK$navy, bold = TRUE)
  sw(XC, y + 0.32, g_[[2]], g_[[3]], w = if (length(g_[[2]]) > 5) 1.12 else 1.25)
  txt(doc, g_[[4]], 8.3, y + 0.3, W - MR - 8.3, 0.8, 12, TK$navy)
  y <- y + 1.32 }
pie(doc, "Para quien diseña: azul oscuro 081F5C, coral CA5651, verde 4E9438. Escala F4B183, FFD965, ADD493, 70AD47 y BFBFBF")

# --- R4 el texto que acompaña al gráfico (C3 y C4 de la tanda de comentarios: rangos en vez de «nunca más de», y las
# cuatro posiciones posibles del texto, no sólo a la derecha)
MOTOR_ACT <- "Reglas: texto narrativo en láminas con gráfico (p_slide_*_narrativo, p_slide_grafico_texto_*)"
doc <- nueva(doc); titulo(doc, "El texto que acompaña al gráfico", ante = "Reglas de la identidad")
gap4 <- 0.35; w4 <- (AC - 3 * gap4) / 4; h4 <- 1.75; y4 <- Y_DATOS - 0.1
miniatura <- function(x, y, pos) {
  caja(doc, x, y, w4, h4, "#FFFFFF", line = sp_line(color = TK$rule, lwd = 0.75)); pd <- 0.14
  lineas_txt <- function(tx, ty, tw, th) { caja(doc, tx, ty, 0.035, th, TK$coral)
    for (j in 0:3) caja(doc, tx + 0.1, ty + 0.06 + j * (th - 0.12) / 3.4, (tw - 0.14) * c(1, 0.92, 0.97, 0.6)[j + 1], 0.045, TK$faint) }
  if (pos == "derecha") { caja(doc, x + pd, y + pd, w4 * 0.58, h4 - 2 * pd, TK$tenue); lineas_txt(x + w4 * 0.58 + 2 * pd, y + 0.35, w4 * 0.42 - 3 * pd, 0.8) }
  if (pos == "izquierda") { lineas_txt(x + pd, y + 0.35, w4 * 0.42 - 3 * pd, 0.8); caja(doc, x + w4 * 0.42, y + pd, w4 * 0.58 - pd, h4 - 2 * pd, TK$tenue) }
  if (pos == "arriba") { lineas_txt(x + pd, y + pd, w4 - 2 * pd, 0.42); caja(doc, x + pd, y + 0.7, w4 - 2 * pd, h4 - 0.7 - pd, TK$tenue) }
  if (pos == "debajo") { caja(doc, x + pd, y + pd, w4 - 2 * pd, h4 - 0.7 - pd, TK$tenue); lineas_txt(x + pd, y + h4 - 0.56, w4 - 2 * pd, 0.42) }
}
casos4 <- list(c("derecha", "Texto a la derecha", "Lo más común. El gráfico ocupa cerca de 60 % del ancho"),
               c("izquierda", "Texto a la izquierda", "Cuando la lámina vecina lleva el texto a la derecha y conviene alternar"),
               c("arriba", "Texto arriba", "Cuando el gráfico necesita todo el ancho, como una tabla o muchas filas"),
               c("debajo", "Texto debajo", "Cuando la conclusión cierra la lámina después de mostrar el gráfico"))
for (k in seq_along(casos4)) { x <- XC + (k - 1) * (w4 + gap4)
  miniatura(x, y4, casos4[[k]][1])
  txt(doc, casos4[[k]][2], x - 0.1, y4 + h4 + 0.08, w4 + 0.2, 0.3, 13, TK$navy, bold = TRUE)
  txt(doc, casos4[[k]][3], x - 0.1, y4 + h4 + 0.38, w4 + 0.2, 0.55, 10.5, TK$soft) }
narrativa(doc, XC, y4 + h4 + 1.15, 6.1, 1.45, list(N_("El "), B("75 % de los docentes"), N_(" y el "), B("53 % de los estudiantes"),
  N_(" está de acuerdo o totalmente de acuerdo con que la Unidad cuenta con servicios de tutoría.")), size = 14)
lista_marcada(doc, c("Se recomiendan entre 40 y 70 palabras.", "Las cifras que menciona van en negrita y coinciden con las del gráfico.",
                     "Cuenta lo que muestra el gráfico, sin repetir la pregunta."),
  XC + 6.6, y4 + h4 + 1.2, AC - 6.6, paso = 0.47, size = 11.5)
zona("cuatro posiciones del texto", XC, y4, AC, h4 + 0.95)
pie(doc, "")

# --- R6 en la propuesta nueva: la misma lámina estándar y qué es cada elemento en PowerPoint (logo real, no un óvalo)
if (NUEVA) {
MOTOR_ACT <- "Reglas: naturaleza nativa de cada elemento de la lámina (título en marcador de título, gráficos vectoriales rvg::dml, tablas flextable)"
doc <- nueva(doc); titulo(doc, "Qué es cada elemento en PowerPoint", ante = "Reglas de la lámina")
k <- 0.58; ox <- XC + 0.75; oy <- YT - 0.05; pos <- mini_lamina(doc, ox, oy, k)
anotar(doc, ox, oy, k, pos, list(list("titulo", "Título", "Marcador de título: va al esquema y a la navegación"),
  list("logo", "Logo", "Diseño de la plantilla: se cambia en el patrón"), list("pregunta", "Textos", "Cuadros de texto con tamaño y color fijados"),
  list("grafico", "Gráfico", "Vectorial: cada barra y cifra es una forma editable"), list("leyenda", "Leyenda", "Formas agrupadas que se mueven con el gráfico")), xl = ox + W * k + 0.6)
zona("lámina estándar con cinco tipos de elemento", ox, oy, W * k, H * k)
pie(doc, "Nada se pega como imagen: todo se puede editar en PowerPoint")
} else {
# --- R6 qué es cada elemento en PowerPoint (C6: la tabla «no es dinámica ni intuitiva»; ahora una lámina de ejemplo con
# cada elemento marcado y una tarjeta breve por elemento: qué es y cómo se cambia)
MOTOR_ACT <- "Reglas: naturaleza nativa de cada elemento de la lámina (título en marcador de título, gráficos vectoriales rvg::dml, tablas flextable)"
doc <- nueva(doc); titulo(doc, "Qué es cada elemento en PowerPoint", ante = "Reglas de la identidad")
k <- 0.5; ox <- XC; oy <- Y_DATOS - 0.05; fw <- W * k; fh <- H * k
caja(doc, ox, oy, fw, fh, "#FFFFFF", line = sp_line(color = TK$rule, lwd = 0.75))
caja(doc, ox + ML0 * k, oy + (Y_TIT - 0.12) * k, 0.03, 0.36, TK$navy)
txt(doc, "Servicios de apoyo al estudiante", ox + ML * k - 0.06, oy + Y_TIT * k - 0.02, 3.6, 0.3, 11, TK$coral, bold = TRUE)
caja(doc, ox + fw - 0.8, oy + 0.13, 0.62, 0.26, TK$navy, geom = "ellipse")
txt(doc, "Texto de análisis con sus cifras en negrita.", ox + 0.25, oy + 0.95, 1.9, 0.6, 9.5, TK$navy)
for (j in 0:3) { yb <- oy + 1.0 + j * 0.4; caja(doc, ox + 2.45, yb, 3.7 * c(0.9, 0.7, 0.55, 0.8)[j + 1], 0.26, c(TK$navy, TK$tenue, TK$tenue, TK$tenue)[j + 1])
  txt(doc, paste0(c(62, 48, 37, 53)[j + 1], "%"), ox + 2.45 + 3.7 * c(0.9, 0.7, 0.55, 0.8)[j + 1] + 0.02, yb - 0.02, 0.5, 0.26, 9, TK$navy, bold = TRUE) }
for (j in 0:3) { yt <- oy + 2.78 + j * 0.15; caja(doc, ox + 0.25, yt, fw - 0.5, 0.13, if (j == 0) TK$navy else if (j %% 2) TK$zebra else "#FFFFFF") }
txt(doc, "Base: 148 docentes", ox + ML * k - 0.06, oy + Y_BASE * k - 0.02, 2.5, 0.22, 8, TK$navy, bold = TRUE)
xmk <- max(0.04, ox - 0.33)
mk <- list(c(1, xmk, oy + 0.12), c(2, xmk, oy + 0.98), c(3, ox + 2.45 + 3.7 * 0.9 + 0.45, oy + 0.98), c(4, xmk, oy + 2.76), c(5, ox + fw - 1.15, oy + 0.13))   # fuera de cada elemento, sin taparlo
for (m in mk) marca(doc, m[1], m[2], m[3], d = 0.26)
tarjetas <- list(c("Título", "Es el título de la lámina: aparece en el esquema y en la navegación. Se escribe en el cuadro."),
                 c("Texto y base", "Son cuadros de texto con su tamaño y color fijados. Se escribe en ellos."),
                 c("Gráfico", "Es un gráfico vectorial: cada barra y cada cifra es una forma. Los datos se cambian generándolo de nuevo."),
                 c("Tabla", "Es una tabla de PowerPoint. Se ajusta desde Diseño de tabla."),
                 c("Logo", "Es parte del diseño de la lámina, igual en todas. Se cambia en el patrón de diapositivas."))
xt <- ox + fw + 0.5; wt <- W - MR - xt; ht <- (fh + 0.1) / length(tarjetas)
for (i in seq_along(tarjetas)) { y <- oy + (i - 1) * ht
  marca(doc, i, xt, y + 0.05, d = 0.3)
  txt(doc, tarjetas[[i]][1], xt + 0.42, y + 0.0, wt - 0.42, 0.3, 13, TK$navy, bold = TRUE)
  txt(doc, tarjetas[[i]][2], xt + 0.42, y + 0.3, wt - 0.42, 0.42, 10.5, TK$soft)
  }
zona("lámina de ejemplo con cinco elementos marcados", ox, oy, fw, fh)
pie(doc, "")
}
