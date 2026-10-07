# Recetario en Word (fiel y moderno): los mismos escenarios del PPT con el formato de gráfico de los
# Word entregados. Uso: SP=<datos> ESTILO=fiel|moderna SALIDA=<docx> LOGOS=<carpeta media plantilla> Rscript recetario_word.R
Sys.setlocale("LC_ALL", "en_US.UTF-8")
suppressMessages({ library(officer); library(flextable); library(ggplot2) })
`%||%` <- function(a, b) if (is.null(a)) b else a
SP <- Sys.getenv("SP"); ESTILO <- Sys.getenv("ESTILO", "fiel"); LOGOS <- Sys.getenv("LOGOS")
D <- readRDS(file.path(SP, "datos_muestra.rds")); CONTA <- readRDS(file.path(SP, "src_conta.rds"))
source("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_word_graficos.R", local = TRUE)
fr <- function(b, v) {
  sv <- CONTA$inst_sources[[b]]$survey; ch <- CONTA$inst_sources[[b]]$choices; lc <- function(df) grep("^label", names(df))[1]
  row <- sv[!is.na(sv$name) & sv$name == v, ][1, ]; cc <- ch[!is.na(ch$list_name) & ch$list_name == row$list_name, ]
  d <- as.character(CONTA$data_sources[[b]][[v]]); d <- d[!is.na(d) & d != ""]; n <- as.integer(table(factor(d, levels = cc$name)))
  list(pregunta = row[[lc(sv)]], labels = cc[[lc(ch)]], n = n, valid = length(d), pct = round(100 * n / length(d)))
}
ROT <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF")
MOD <- ESTILO == "moderna"   # remasterización: armazón editorial propio (pedido de Gonzalo: «que en Word se vea mucho mucho mejor»)
FONT <- "Arial"; NAVY <- "#002060"; CORAL <- "#CA5651"; SOFT <- "#5A6480"
TMP <- tempfile("recw_"); dir.create(TMP)

tx <- function(s, size = 11, color = "#000000", bold = FALSE, italic = FALSE) ftext(s, fp_text(font.family = FONT, font.size = size, color = color, bold = bold, italic = italic))
parr <- function(doc, ..., align = if (MOD) "left" else "justify", after = 8, before = 0, keep = FALSE) body_add_fpar(doc, fpar(..., fp_p = fp_par(text.align = align, padding.bottom = after, padding.top = before, line_spacing = if (MOD) 1.3 else 1.15, keep_with_next = keep)))
# ---- Elementos nativos de Word (pedido de Gonzalo, 2026-10-07: «la idea de hacerlo nativo en Word es que sean editables»):
# todo lo que el motor agrega es un estilo de Word o un campo de Word, no una tabla disfrazada. Así la posedición se hace
# desde Inicio > Estilos y la numeración se recalcula con F9.
xml_esc <- function(x) gsub(">", "&gt;", gsub("<", "&lt;", gsub("&", "&amp;", x, fixed = TRUE), fixed = TRUE), fixed = TRUE)
rpr_est <- function(sty) if (is.null(sty)) "" else sprintf('<w:rPr><w:rStyle w:val="%s"/></w:rPr>', sty)
run_est <- function(t, sty) structure(list(t = t, sty = sty), class = c("run_est", "run"))   # texto con estilo de carácter de Word
seq_run <- function(id, n, sty = NULL) structure(list(id = id, n = n, sty = sty), class = c("seq_pulso", "run"))   # campo SEQ con su número ya calculado
registerS3method("to_wml", "run_est", function(x, add_ns = FALSE, ...) sprintf('<w:r>%s<w:t xml:space="preserve">%s</w:t></w:r>', rpr_est(x$sty), xml_esc(x$t)), envir = asNamespace("officer"))
registerS3method("to_wml", "seq_pulso", function(x, add_ns = FALSE, ...) { r <- rpr_est(x$sty)
  paste0('<w:r>', r, '<w:fldChar w:fldCharType="begin"/></w:r><w:r>', r, '<w:instrText xml:space="preserve"> SEQ ', x$id, ' \\* ARABIC </w:instrText></w:r>',
         '<w:r>', r, '<w:fldChar w:fldCharType="separate"/></w:r><w:r>', r, '<w:t>', x$n, '</w:t></w:r><w:r>', r, '<w:fldChar w:fldCharType="end"/></w:r>') }, envir = asNamespace("officer"))
# Lectura: estilo de párrafo «Lectura»; las cifras van en negrita (formato directo mínimo: sólo la negrita).
lectura_runs <- function(texto) {
  pos <- gregexpr("[0-9]+([.,][0-9]+)*( ?%| pts)?", texto)[[1]]; ch <- list(); k <- 1
  if (pos[1] > 0) for (i in seq_along(pos)) { a <- pos[i]; b <- a + attr(pos, "match.length")[i] - 1
    if (a > k) ch[[length(ch) + 1]] <- ftext(substr(texto, k, a - 1))
    ch[[length(ch) + 1]] <- ftext(substr(texto, a, b), fp_text_lite(bold = TRUE)); k <- b + 1 }
  if (k <= nchar(texto)) ch[[length(ch) + 1]] <- ftext(substr(texto, k, nchar(texto)))
  ch
}
rotulo <- function(doc, etiqueta, id, n, titulo) {   # «GRÁFICO 5» + pregunta (moderna) o «Gráfico N°5: pregunta» (fiel), un solo párrafo con estilo
  p <- if (MOD) fpar(run_est(paste0(toupper(etiqueta), " "), "NumeroRotulo"), seq_run(id, n, "NumeroRotulo"), run_linebreak(), ftext(titulo))
       else fpar(ftext(paste0(etiqueta, " N°")), seq_run(id, n), ftext(paste0(if (id == "Tabla") ". " else ": ", titulo)))
  body_add_fpar(doc, p, style = "Rótulo de gráfico")
}
GN <- 0
NRO <- if (ESTILO == "fiel") "N°" else "N.º "   # los Word entregados escriben «Gráfico N°1:» y «Tabla N° 1.»
rot_tabla <- function(k, t) if (ESTILO == "fiel") sprintf("Tabla N° %d. %s", k, t) else sprintf("Tabla N.º %d: %s", k, t)
grafico <- function(doc, titulo, g, alto, texto = NULL) {
  GN <<- GN + 1
  doc <- rotulo(doc, "Gráfico", "Gráfico", GN, titulo)
  alto <- max(alto, attr(g, "alto") %||% 0)   # el gráfico declara el alto que necesita (etiquetas de varias líneas)
  f <- file.path(TMP, sprintf("g%03d.png", GN)); ggsave(f, g, width = ANCHO_W, height = alto, dpi = 300, bg = "transparent")
  doc <- body_add_fpar(doc, fpar(external_img(f, width = ANCHO_W, height = alto), fp_p = fp_par(text.align = "center", keep_with_next = !is.null(texto))))
  if (!is.null(texto)) doc <- body_add_fpar(doc, do.call(fpar, lectura_runs(texto)), style = "Lectura")
  doc
}
seccion <- function(doc, t) {
  if (!MOD) return(body_add_par(doc, t, style = "heading 1"))
  doc <- body_add_par(doc, sprintf("%02d", as.integer(sub("\\..*", "", t))), style = "Número de capítulo")
  body_add_par(doc, sub("^[0-9]+\\.\\s*", "", t), style = "heading 1")
}
poner_tabla <- function(doc, ft, align = "center", zebra = TRUE) {
  w <- dim(ft)$widths; ft <- width(ft, j = seq_along(w), width = w * ANCHO_W / sum(w))   # toda tabla mide el ancho útil exacto: bordes en los márgenes
  if (MOD) ft <- ft |> bg(bg = "transparent", part = "header") |> color(color = SOFT, part = "header") |> fontsize(size = 8.5, part = "header") |>
    border_remove() |> hline_top(border = fp_border(color = NAVY, width = 1.25), part = "header") |> hline_bottom(border = fp_border(color = NAVY, width = 0.75), part = "header") |>
    hline(border = fp_border(color = "#D5D9DF", width = 0.5), part = "body") |> hline_bottom(border = fp_border(color = NAVY, width = 0.75), part = "body") |>
    padding(j = 1, padding.left = 0, part = "all")   # texto de la 1.ª columna alineado con el texto corrido
  if (MOD && zebra && nrow_part(ft, "body") > 2) ft <- bg(ft, i = seq(2, nrow_part(ft, "body"), 2), bg = "#F3F5F8", part = "body")
  body_add_flextable(doc, paginate(ft, init = TRUE, hdr_ftr = TRUE), align = if (MOD) "left" else align)
}
cap_tabla <- function(doc, k, t) rotulo(doc, "Tabla", "Tabla", k, t)
subsec <- function(doc, t) body_add_par(doc, t, style = "heading 2")

doc <- read_docx()
doc <- docx_set_paragraph_style(doc, style_id = "Titre1", style_name = "heading 1",
  fp_p = if (MOD) fp_par(padding.top = 0, padding.bottom = 10, keep_with_next = TRUE, border.bottom = fp_border(color = NAVY, width = 1)) else fp_par(padding.top = 16, padding.bottom = 8, keep_with_next = TRUE),
  fp_t = fp_text(font.family = FONT, font.size = if (MOD) 22 else 14, color = NAVY, bold = TRUE))
doc <- docx_set_paragraph_style(doc, style_id = "Titre2", style_name = "heading 2", fp_p = fp_par(padding.top = if (MOD) 18 else 10, padding.bottom = 6, keep_with_next = TRUE),
  fp_t = fp_text(font.family = FONT, font.size = if (MOD) 13 else 11.5, color = NAVY, bold = TRUE))
doc <- docx_set_paragraph_style(doc, style_id = "RotuloGrafico", style_name = "Rótulo de gráfico",
  fp_p = if (MOD) fp_par(text.align = "left", padding.top = 10, padding.bottom = 6, keep_with_next = TRUE, line_spacing = 1.15) else fp_par(text.align = "center", padding.top = 6, padding.bottom = 4, keep_with_next = TRUE),
  fp_t = fp_text(font.family = FONT, font.size = if (MOD) 11 else 9, color = NAVY, bold = TRUE, italic = !MOD))
doc <- docx_set_character_style(doc, style_id = "NumeroRotulo", style_name = "Número de rótulo", base_on = "Default Paragraph Font",
  fp_t = if (MOD) fp_text(font.family = FONT, font.size = 8, color = CORAL, bold = TRUE) else fp_text(font.family = FONT, font.size = 9, color = NAVY, bold = TRUE, italic = TRUE))
doc <- docx_set_paragraph_style(doc, style_id = "Lectura", style_name = "Lectura",
  fp_p = if (MOD) fp_par(text.align = "left", line_spacing = 1.3, padding.left = 12, padding.top = 6, padding.bottom = 12, border.left = fp_border(color = CORAL, width = 2.25)) else fp_par(text.align = "justify", line_spacing = 1.15, padding.top = 6, padding.bottom = 10),
  fp_t = fp_text(font.family = FONT, font.size = if (MOD) 10.5 else 11, color = if (MOD) NAVY else "#000000"))
doc <- docx_set_paragraph_style(doc, style_id = "NumeroCapitulo", style_name = "Número de capítulo", fp_p = fp_par(text.align = "left", padding.bottom = 0, keep_with_next = TRUE),
  fp_t = fp_text(font.family = FONT, font.size = 44, color = CORAL, bold = TRUE))
logo_t <- data.frame(a = "", b = "")
# Logos recortados a su tinta y a la MISMA altura de marca (0.5 in): las imágenes de la plantilla traen márgenes transparentes
# distintos (PUCP ocupa 51% del alto de su imagen; PULSO, 80%) y a tamaño de archivo PULSO se veía casi el doble.
# Recortados, PUCP arranca en el margen izquierdo y PULSO termina en el derecho. Pedido de Gonzalo (2026-10-07).
logo_tinta <- function(f) { im <- magick::image_trim(magick::image_read(file.path(LOGOS, f)), fuzz = 8); o <- file.path(TMP, paste0("t_", f)); magick::image_write(im, o)
  i <- magick::image_info(im); list(f = o, asp = i$width / i$height) }
L1 <- logo_tinta("image1.png"); L8 <- logo_tinta("image8.png"); HL <- 0.5
cab_ft <- flextable(logo_t) |> delete_part("header") |> border_remove() |> width(j = 1, width = ANCHO_W / 2) |> width(j = 2, width = ANCHO_W / 2) |>
  compose(j = 1, value = as_paragraph(as_image(src = L1$f, width = HL * L1$asp, height = HL))) |>
  compose(j = 2, value = as_paragraph(as_image(src = L8$f, width = HL * L8$asp, height = HL))) |>
  align(j = 1, align = "left") |> align(j = 2, align = "right") |> valign(valign = "center") |> padding(padding = 0)
cab <- block_list(cab_ft)
pie_pag <- if (MOD) block_list(fpar(ftext("Recetario de identidad visual en Word", fp_text(font.family = FONT, font.size = 8, color = SOFT)), run_tab(),
    run_word_field("PAGE", prop = fp_text(font.family = FONT, font.size = 8, color = NAVY, bold = TRUE)),
    fp_p = fp_par(tabs = fp_tabs(fp_tab(pos = ANCHO_W, style = "right")), padding.top = 4))) else
  block_list(fpar(run_word_field("PAGE"), fp_p = fp_par(text.align = "center")))
doc <- body_set_default_section(doc, prop_section(page_size = page_size(width = 8.27, height = 11.69), page_margins = page_mar(top = 1.1, bottom = 0.9, left = 1.0, right = 1.0, header = 0.4, footer = 0.4),
  header_default = cab, footer_default = pie_pag))

# ---------------- portada y contenido (primera página sin gráficos)
if (MOD) {
  doc <- body_add_par(doc, "")
  cub <- flextable(data.frame(a = "")) |> delete_part("header") |> border_remove() |> width(j = 1, width = 6.27) |> bg(bg = NAVY) |>
    compose(j = 1, value = as_paragraph(
      as_chunk("RECETARIO DE IDENTIDAD VISUAL EN WORD", props = fp_text(font.family = FONT, font.size = 9.5, color = "#9DC3E6", bold = TRUE)), "\n\n",
      as_chunk("Informes cuantitativos", props = fp_text(font.family = FONT, font.size = 30, color = "#FFFFFF", bold = TRUE)), "\n",
      as_chunk("de PULSO PUCP", props = fp_text(font.family = FONT, font.size = 30, color = "#FFFFFF", bold = TRUE)), "\n\n",
      as_chunk("Versión moderna: cómo se ve cada gráfico, tabla y lectura en el informe en Word", props = fp_text(font.family = FONT, font.size = 12.5, color = "#C9D3E6")), "\n\n\n\n\n\n",
      as_chunk("Octubre de 2026", props = fp_text(font.family = FONT, font.size = 10.5, color = "#FFFFFF", bold = TRUE)))) |>
    padding(padding.left = 34, padding.right = 34, padding.top = 60, padding.bottom = 44) |> line_spacing(space = 1.05)
  doc <- body_add_flextable(doc, cub, align = "left")
  doc <- body_add_par(doc, "")
  doc <- parr(doc, tx(paste("Este documento acompaña al recetario en PPT y sigue su mismo orden. Los gráficos del informe tipo usan los datos del proyecto de referencia de Contabilidad.",
    "Los escenarios y los otros estudios usan la forma real de cada proyecto con porcentajes ficticios. Sólo se trata lo cuantitativo."), 10, SOFT), before = 14)
  doc <- body_add_break(doc)
  doc <- parr(doc, tx("Contenido", 22, NAVY, TRUE), after = 14)
  caps <- data.frame(n = sprintf("%02d", 1:5), t = c("Cómo leer y armar un gráfico en Word", "El informe tipo", "Galería de gráficos", "Escenarios de acreditación", "Otros estudios de PULSO"),
    d = c("El gráfico explicado parte por parte, sus reglas y lo que cambia frente al PPT", "Características institucionales, perfiles, competencias y situación laboral, con datos de Contabilidad",
          "Cada tipo de gráfico del motor en su formato de Word", "Las situaciones que aparecen en los estudios de acreditación de 2024 a 2026", "Opinión pública, cuasi-experimental, monitoreo, aulas y olas"))
  ftc0 <- flextable(caps) |> delete_part("header") |> border_remove() |> width(j = 1, width = 0.8) |> width(j = 2:3, width = c(2.3, 3.17)) |>
    font(fontname = FONT, part = "all") |> fontsize(j = 1, size = 22) |> bold(j = 1:2) |> color(j = 1, color = CORAL) |> color(j = 2, color = NAVY) |> fontsize(j = 2, size = 12) |>
    fontsize(j = 3, size = 9.5) |> color(j = 3, color = SOFT) |> valign(valign = "center") |> hline(border = fp_border(color = "#D5D9DF", width = 0.5)) |> padding(padding.top = 10, padding.bottom = 10)
  doc <- body_add_flextable(doc, ftc0, align = "left")
  doc <- body_add_break(doc)
} else {
doc <- body_add_par(doc, ""); doc <- body_add_par(doc, ""); doc <- body_add_par(doc, "")
doc <- parr(doc, tx(if (ESTILO == "fiel") "RECETARIO DE IDENTIDAD VISUAL EN WORD" else "Recetario de identidad visual en Word", 11, CORAL, TRUE), align = "center", after = 6)
doc <- parr(doc, tx("Informes cuantitativos de PULSO PUCP", 22, NAVY, TRUE), align = "center", after = 10)
doc <- parr(doc, tx(sprintf("Versión %s: cómo se ve cada gráfico en el informe en Word", if (ESTILO == "fiel") "fiel" else "moderna"), 13, SOFT), align = "center", after = 40)
doc <- parr(doc, tx("Octubre de 2026", 11, NAVY), align = "center")
doc <- body_add_break(doc)
doc <- parr(doc, tx("Contenido", 14, NAVY, TRUE), align = "left", after = 10)
for (it in c("1. Cómo leer y armar un gráfico en Word", "2. El informe tipo: características institucionales, perfiles, competencias y situación laboral", "3. Galería de gráficos", "4. Escenarios de acreditación", "5. Otros estudios de PULSO"))
  doc <- parr(doc, tx(it, 11.5, NAVY, TRUE), align = "left", after = 6)
doc <- parr(doc, tx(paste("Este documento acompaña al recetario en PPT y sigue su mismo orden. Los gráficos del informe tipo usan los datos del proyecto de referencia de Contabilidad.",
  "Los escenarios y los otros estudios usan la forma real de cada proyecto con porcentajes ficticios. Sólo se trata lo cuantitativo."), 10.5, SOFT), after = 6, before = 16)
doc <- body_add_break(doc)

}

# ---------------- 1. reglas, en lenguaje llano (pedido de Gonzalo, 2026-10-07: «las reglas de gráficos en Word y en PPT
# son algo diferentes y ambas deben estar mucho más claras para que cualquier público pueda entenderlo»)
tabla_llana <- function(doc, df, anchos) {
  ft <- flextable(df) |> font(fontname = FONT, part = "all") |> fontsize(size = 9.5, part = "all") |> color(color = NAVY, part = "all") |> bold(part = "header") |> bold(j = 1) |>
    bg(bg = NAVY, part = "header") |> color(color = "#FFFFFF", part = "header") |> border_remove() |> hline(border = fp_border(color = "#D5D9DF", width = 0.5), part = "body") |>
    padding(padding.top = 4, padding.bottom = 4, part = "all") |> valign(valign = "top", part = "body")
  for (j in seq_along(anchos)) ft <- width(ft, j = j, width = anchos[j])
  doc <- poner_tabla(doc, ft); body_add_par(doc, "")
}
doc <- seccion(doc, "1. Cómo leer y armar un gráfico en Word")
doc <- subsec(doc, "1.1. Cómo se lee un gráfico de este informe")
doc <- parr(doc, tx("Todos los gráficos del informe se leen igual. Este ejemplo muestra cada parte. La tabla que sigue explica dónde está y qué dice."), keep = TRUE)
doc <- grafico(doc, "La Unidad cuenta con servicios de tutoría académica", g_apilada(list(list(actor = "Docentes", pct = c(2, 8, 54, 21, 15)), list(actor = "Estudiantes", pct = c(6, 18, 34, 19, 23)),
  list(actor = "Egresados", pct = c(3, 12, 50, 30, 5))), ROT, WTK$likert, n_txt = "N = 148 docentes, 1,234 estudiantes y 314 egresados"), alto_apilada(3),
  texto = "El 75% de los docentes y el 53% de los estudiantes está de acuerdo o totalmente de acuerdo con que la Unidad cuenta con servicios de tutoría. Uno de cada cuatro estudiantes no tiene información sobre el servicio.")
doc <- tabla_llana(doc, data.frame(Parte = c("Número y título", "Grupos", "Colores", "Cifras", if (ESTILO == "fiel") "TOP TWO BOX" else "Top Two Box", "Leyenda", "Base y fuente", "Párrafo"),
  `Dónde está` = c(if (MOD) "Las dos líneas sobre el gráfico" else "La línea en cursiva sobre el gráfico", "A la izquierda de cada barra", "Dentro de la barra", "Sobre cada color", "La columna verde a la derecha", "Debajo de las barras",
                   "La última línea del gráfico", "Debajo del gráfico"),
  `Qué dice` = c("El número ordena los gráficos del informe. El título es la pregunta tal como se hizo", "De quién son las respuestas de esa barra",
                 "Cada color es una respuesta: naranja y amarillo para el desacuerdo, verdes para el acuerdo y gris para la falta de información", "Qué porcentaje del grupo eligió esa respuesta. Cada barra suma 100%",
                 "La suma de las dos respuestas de acuerdo", "El nombre de cada color, en el mismo orden de la barra",
                 "Cuántas personas respondieron (N) y quién hizo el estudio", "Lo que muestra el gráfico, con sus mismas cifras"), check.names = FALSE), c(1.4, 1.9, 3.0))
doc <- subsec(doc, "1.2. Reglas del gráfico en Word")
doc <- parr(doc, tx("El Word se lee impreso o en pantalla, página por página. Por eso el gráfico es más pequeño que en el PPT y lleva su título y su base pegados:"), keep = TRUE)
doc <- tabla_llana(doc, data.frame(Elemento = c("Título", "Gráfico", "Letra dentro del gráfico", "Base y fuente", "Párrafo de análisis", "Numeración", "Saltos de página"),
  `Cómo se ve` = c(if (MOD) "«GRÁFICO 5» en coral y, debajo, la pregunta en negrita. Las dos líneas alineadas a la izquierda, sobre el gráfico" else paste0("«Gráfico ", NRO, "5: pregunta», en una línea sobre el gráfico, centrada, en azul oscuro, negrita y cursiva"),
                   "Imagen sin fondo, del ancho del texto, sin título dentro",
                   if (ESTILO == "fiel") "Entre 7.5 y 9 pt. El rótulo TOP TWO BOX en verde y mayúsculas" else "Entre 8 y 9.5 pt. El rótulo Top Two Box en verde",
                   "«N = públicos. Fuente: PULSO PUCP 2026.», en cursiva, como última línea del gráfico",
                   if (MOD) "Debajo del gráfico, con un filete coral a la izquierda y las cifras en negrita. Son las mismas del gráfico" else "Debajo del gráfico, en 11 pt y justificado. Cita las mismas cifras del gráfico",
                   "Gráficos y tablas llevan número correlativo en todo el informe",
                   "Título, gráfico y base nunca se separan: si no caben, pasan juntos a la página siguiente"), check.names = FALSE), c(1.7, 4.6))
doc <- parr(doc, tx("Cada elemento que pone el motor es un estilo o un campo de Word. Para ajustar uno en todo el informe se modifica su estilo en Inicio > Estilos. Para renumerar gráficos y tablas, se selecciona todo y se presiona F9.", 11, if (MOD) NAVY else "#000000"), keep = TRUE)
el <- data.frame(Elemento = c("Título de capítulo y de sección", if (MOD) "Número de capítulo", "Rótulo del gráfico o de la tabla", "Número del gráfico o de la tabla", "Lectura", "Gráfico", "Tabla", if (MOD) "Franja de cifras", if (MOD) "Portada", "Pie de página"),
  `Qué es en Word` = c("Estilos «Título 1» y «Título 2»", if (MOD) "Estilo «Número de capítulo»", "Estilo de párrafo «Rótulo de gráfico»", if (MOD) "Campo de numeración con el estilo de carácter «Número de rótulo»" else "Campo de numeración",
                       if (MOD) "Estilo «Lectura»: el filete coral es el borde izquierdo del párrafo" else "Estilo «Lectura»", "Imagen sin fondo de 6.27 in, del ancho del texto", "Tabla de Word del ancho del texto",
                       if (MOD) "Tabla de Word de cinco columnas", if (MOD) "Tabla de Word de una celda con fondo azul oscuro", "Párrafo con tabulación a la derecha y el número de página"),
  `Cómo se ajusta` = c("Inicio > Estilos", if (MOD) "Inicio > Estilos", "Inicio > Estilos. Con la etiqueta «Gráfico» se arma el índice de gráficos en Referencias", "Se recalcula con F9", "Inicio > Estilos",
                       "Clic derecho > Cambiar imagen. El motor la vuelve a generar", "Diseño de tabla", if (MOD) "Se editan las cifras en la tabla", if (MOD) "Se edita el texto en la celda", "Insertar > Pie de página"),
  check.names = FALSE)
doc <- tabla_llana(doc, el, c(1.6, 2.6, 2.07))
doc <- subsec(doc, "1.3. Lo que cambia respecto del PPT")
doc <- tabla_llana(doc, data.frame(Aspecto = c("Título", "Tamaño de letra", "Fondo", "Base", "Texto de análisis", "Numeración", "Si no cabe"),
  `En Word` = c(if (MOD) "Dos líneas sobre el gráfico: «GRÁFICO 5» y la pregunta" else paste0("Una línea sobre el gráfico: «Gráfico ", NRO, "5: pregunta»"), "8 a 10 pt: se lee impreso", "Imagen sin fondo sobre la página", "Debajo del gráfico, junto con la fuente",
                if (MOD) "Un párrafo debajo, con filete coral y cifras en negrita" else "Un párrafo debajo del gráfico", "Gráficos y tablas numerados", "Título, gráfico y base pasan juntos a la página siguiente"),
  `En PPT` = c("El título de la lámina, arriba y en coral", "12 a 14 pt: se lee proyectado", "La lámina blanca. El gráfico se puede editar", "Al pie de la lámina",
               "Al costado del gráfico, hasta 74 palabras", "Sin número", "Pasa a otra lámina marcada «(cont.)»"), check.names = FALSE), c(1.4, 2.5, 2.4))
doc <- parr(doc, tx("Los colores, el orden de las respuestas, el Top Two Box y la ubicación de las cifras pequeñas son iguales en los dos formatos.", 11, NAVY, TRUE))
doc <- subsec(doc, "1.4. Cómo se ubican las cifras y las respuestas")
for (r in c("Las barras apiladas empiezan todas en el mismo punto, a la izquierda, para comparar el Top Two Box de cada fila. No se centran en el punto neutro.",
            "Ninguna cifra se omite. Si no cabe dentro de su color, va encima con una línea guía. Si hay varias pequeñas juntas, se separan para no taparse.",
            "Las respuestas de una escala van siempre de lo negativo a lo positivo. «Sin información» y «No he usado el servicio» van al final y en gris.",
            "Las respuestas sin orden propio van de la más elegida a la menos elegida. «Otros» y «No sabe» van al final.",
            "Si la pregunta sólo se hizo a una parte de las personas, la base lo dice: por ejemplo, «N = 20 estudiantes que respondieron Sí en la pregunta anterior»."))
  doc <- parr(doc, tx(r), after = 5)

# ---------------- 2. informe tipo (proyecto de referencia de Contabilidad)
doc <- body_add_break(doc)
doc <- seccion(doc, "2. El informe tipo")
act <- c("Docentes", "Estudiantes", "Egresados", "Administrativos")
doc <- subsec(doc, "2.0. Ficha técnica y número de respuestas")
doc <- parr(doc, tx("El informe abre con la ficha técnica y el número de respuestas por actor. Todos los porcentajes que siguen se leen sobre estas bases, salvo que el pie indique una base propia."))
nact <- vapply(c("docentes", "estudiantes", "egresados", "administrativos"), function(b) nrow(CONTA$data_sources[[b]]), 0L)
if (MOD) {   # franja de cifras clave: el total y cada actor en números grandes
  cc <- as.data.frame(t(c(sum(nact), nact))); names(cc) <- c("Total", act)
  ftk <- flextable(cc) |> delete_part("header") |> border_remove() |> width(width = ANCHO_W / 5) |> font(fontname = FONT, part = "all") |>
    compose(j = 1:5, value = as_paragraph(as_chunk(format(c(sum(nact), nact), big.mark = ",")), "\n", as_chunk(tolower(c("respuestas", act)), props = fp_text(font.family = FONT, font.size = 9, color = SOFT)))) |>
    fontsize(size = 24) |> bold() |> color(color = NAVY) |> color(j = 1, color = CORAL) |> align(align = "left") |> line_spacing(space = 1) |>
    border(j = 2:5, border.left = fp_border(color = "#D5D9DF", width = 0.75)) |> padding(padding.left = 10, padding.top = 4, padding.bottom = 4) |> padding(j = 1, padding.left = 0)
  doc <- body_add_flextable(doc, ftk, align = "left"); doc <- body_add_par(doc, "")
}
fic <- data.frame(Aspecto = c("Técnica", "Instrumento", "Actores consultados", "Respuestas válidas", "Tratamiento"),
  Detalle = c("Encuesta en línea autoadministrada", "Un cuestionario por actor, con preguntas comunes para comparar entre actores",
              paste(act, collapse = ", "), sprintf("%d en total: %s", sum(nact), paste(sprintf("%d %s", nact, tolower(act)), collapse = ", ")),
              "Base limpia y consistenciada. Las preguntas no obligatorias declaran su base en el pie"))
doc <- cap_tabla(doc, 1, "Ficha técnica del estudio")
ftf <- flextable(fic) |> font(fontname = FONT, part = "all") |> fontsize(size = 9.5, part = "all") |> color(color = NAVY, part = "all") |> bold(part = "header") |> bold(j = 1) |>
  bg(bg = NAVY, part = "header") |> color(color = "#FFFFFF", part = "header") |> border_remove() |> hline(border = fp_border(color = "#D5D9DF", width = 0.5), part = "body") |>
  width(j = 1, width = 1.7) |> width(j = 2, width = 4.5) |> padding(padding.top = 4, padding.bottom = 4, part = "all")
doc <- poner_tabla(doc, ftf); doc <- body_add_par(doc, "")
doc <- grafico(doc, "Número de respuestas por actor", g_barras(act, round(100 * nact / sum(nact)), n_txt = sprintf("N = %d respuestas válidas", sum(nact)), con_n = nact), alto_barras(4),
  texto = sprintf("Respondieron %d personas. El grupo más numeroso es el de %s (%d).", sum(nact), tolower(act[which.max(nact)]), max(nact)))
doc <- subsec(doc, "2.1. Características institucionales")
doc <- parr(doc, tx("En esta sección se presentan los resultados sobre el conocimiento de la misión y los propósitos institucionales y la valoración de la gestión de la carrera por parte de los actores consultados."))
for (mm in list(D$mision1, D$mision2)) {
  doc <- grafico(doc, mm[[1]]$pregunta, g_apilada(lapply(1:4, function(i) list(actor = act[i], pct = mm[[i]]$pct[1:2])), c("Sí", "No"), c(WTK$azul_si, WTK$celeste), ttb = FALSE,
    n_txt = sprintf("N = %d docentes, %d estudiantes, %d egresados y %d administrativos", mm[[1]]$valid, mm[[2]]$valid, mm[[3]]$valid, mm[[4]]$valid)), alto_apilada(4),
    texto = sprintf("El %d%% de los docentes y el %d%% de los administrativos responde «Sí». Entre estudiantes y egresados la proporción es de %d%% y %d%%.", mm[[1]]$pct[1], mm[[4]]$pct[1], mm[[2]]$pct[1], mm[[3]]$pct[1])) }
doc <- subsec(doc, "2.2. Gestión y planificación")
for (par_v in list(c("p16_4", "p21_3"), c("p16_5", "p21_4"))) { f1 <- fr("docentes", par_v[1]); f2 <- fr("egresados", par_v[2])
  doc <- grafico(doc, f1$pregunta, g_apilada(list(list(actor = "Docentes", pct = f1$pct), list(actor = "Egresados", pct = f2$pct)), ROT, WTK$likert,
    n_txt = sprintf("N = %d docentes y %d egresados", f1$valid, f2$valid)), alto_apilada(2),
    texto = sprintf("El %d%% de los docentes y el %d%% de los egresados está de acuerdo o totalmente de acuerdo.", f1$pct[3] + f1$pct[4], f2$pct[3] + f2$pct[4])) }
doc <- subsec(doc, "2.3. Gestores universitarios y personal de apoyo")
bat <- lapply(sprintf("p14_%d", 2:5), function(v) fr("administrativos", v))
for (f in bat[1:2]) doc <- grafico(doc, f$pregunta, g_apilada(list(list(actor = "Administrativos", pct = f$pct)), ROT, WTK$likert, n_txt = sprintf("N = %d administrativos", f$valid), ancho_lab = 1.6), alto_apilada(1),
  texto = sprintf("El %d%% del personal administrativo está de acuerdo o totalmente de acuerdo (%d de %d).", f$pct[3] + f$pct[4], f$n[3] + f$n[4], f$valid))
doc <- subsec(doc, "2.4. Perfil del egresado")
t1 <- D$titulo; a <- D$anio; s <- D$sueldo
doc <- grafico(doc, "¿Cuenta con título universitario?, egresados", g_sino(t1$labels[1:2], t1$pct[1:2], t1$n[1:2], n_txt = sprintf("N = %d egresados", t1$valid)), if (ESTILO == "fiel") 2.4 else 1.5,
  texto = sprintf("El %d%% de los egresados cuenta con título universitario.", t1$pct[1]))
doc <- grafico(doc, "¿En qué año obtuvo su título universitario?, egresados", g_columnas(a$labels, a$pct, n_txt = sprintf("N = %d egresados que tienen título", a$valid)), 2.2,
  texto = sprintf("El %d%% de los titulados obtuvo su título en 2025.", a$pct[a$labels == "2025"]))
doc <- grafico(doc, "Sueldo mensual bruto, egresados", g_barras(s$labels, s$pct, n_txt = sprintf("N = %d egresados que respondieron", s$valid)), alto_barras(length(s$labels)),
  texto = sprintf("El tramo de sueldo más frecuente es %s (%d%%).", tolower(s$labels[which.max(s$pct)]), max(s$pct)))


doc <- subsec(doc, "2.5. Perfil del estudiante")
sx <- fr("estudiantes", "p5"); ed <- fr("estudiantes", "p3_recod"); ci <- fr("estudiantes", "p6")
doc <- grafico(doc, "Sexo, estudiantes", g_sino(sx$labels[1:2], sx$pct[1:2], sx$n[1:2], n_txt = sprintf("N = %d estudiantes", sx$valid)), if (ESTILO == "fiel") 2.3 else 1.5)
doc <- grafico(doc, "Rango de edades, estudiantes", g_barras(ed$labels, ed$pct, n_txt = sprintf("N = %d estudiantes", ed$valid)), alto_barras(length(ed$labels)))
doc <- grafico(doc, "Nivel curricular, estudiantes", g_columnas(ci$labels, ci$pct, n_txt = sprintf("N = %d estudiantes", ci$valid)), 2.2,
  texto = sprintf("La mayor parte de los estudiantes encuestados cursa %s (%d%%).", tolower(ci$labels[which.max(ci$pct)]), max(ci$pct)))
doc <- subsec(doc, "2.6. Perfil del docente")
dp <- fr("docentes", "p7"); gr <- fr("docentes", "p6"); de <- fr("docentes", "p4_recod")
doc <- grafico(doc, "Departamento académico al que pertenece, docentes", g_barras(dp$labels, dp$pct, n_txt = sprintf("N = %d docentes", dp$valid)), alto_barras(length(dp$labels)))
doc <- grafico(doc, "Máximo grado académico alcanzado, docentes", g_barras(gr$labels, gr$pct, n_txt = sprintf("N = %d docentes", gr$valid)), alto_barras(length(gr$labels)))
doc <- grafico(doc, "Rango de edades, docentes", g_barras(de$labels, de$pct, n_txt = sprintf("N = %d docentes", de$valid)), alto_barras(length(de$labels)),
  texto = sprintf("El %d%% de los docentes tiene grado de %s.", max(gr$pct), tolower(gr$labels[which.max(gr$pct)])))
doc <- subsec(doc, "2.7. Cuerpo académico y orientación")
f <- fr("estudiantes", "p16_6")
doc <- grafico(doc, f$pregunta, g_apilada(list(list(actor = "Estudiantes", pct = f$pct)), ROT, WTK$likert, n_txt = sprintf("N = %d estudiantes", f$valid)), alto_apilada(1))
o1 <- fr("docentes", "p24_6"); o2 <- fr("estudiantes", "p17_5")
doc <- grafico(doc, paste(o1$pregunta, "(2026 frente a 2021)"), g_apilada(list(list(actor = "Docentes", pct = o1$pct), list(actor = "Estudiantes", pct = o2$pct)), ROT, WTK$likert, ttb21 = c(98, 84),
  n_txt = sprintf("N = %d docentes y %d estudiantes. 2021: informe consolidado anterior", o1$valid, o2$valid)), alto_apilada(2),
  texto = sprintf("Entre los estudiantes, el Top Two Box pasa de 84%% en 2021 a %d%% en 2026. Entre los docentes, de 98%% a %d%%.", o2$pct[3] + o2$pct[4], o1$pct[3] + o1$pct[4]))
doc <- subsec(doc, "2.8. Batería de un actor")
bat <- lapply(sprintf("p14_%d", 2:7), function(v) fr("administrativos", v))
doc <- grafico(doc, "Valoración del personal administrativo sobre su gestión y desarrollo", g_apilada(lapply(bat, function(f) list(actor = f$pregunta, pct = f$pct)), ROT, WTK$likert, envolver = 34,
  n_txt = sprintf("N = %d administrativos", bat[[1]]$valid)), alto_apilada(6) + 1.6)
doc <- subsec(doc, "2.9. Competencias del perfil de egreso")
cn <- c("Estados Financieros", "Auditoría", "Costos y presupuestos", "Finanzas", "Tributación", "Visión empresarial")
mm <- sapply(list(c("docentes", "p30_"), c("estudiantes", "p22_"), c("egresados", "p28_")), function(a) vapply(1:6, function(i) { f <- fr(a[1], paste0(a[2], i)); f$pct[3] + f$pct[4] }, 0))
tab <- data.frame(Competencia = cn, Docentes = paste0(mm[, 1], "%"), Estudiantes = paste0(mm[, 2], "%"), Egresados = paste0(mm[, 3], "%"))
doc <- cap_tabla(doc, 2, "Top Two Box de cada competencia, por actor")
ftc <- flextable(tab) |> font(fontname = FONT, part = "all") |> fontsize(size = 9, part = "all") |> color(color = NAVY, part = "all") |> bold(part = "header") |> bold(j = 1) |>
  bg(bg = NAVY, part = "header") |> color(color = "#FFFFFF", part = "header") |> align(j = 2:4, align = "center", part = "all") |> border_remove() |>
  hline(border = fp_border(color = "#D5D9DF", width = 0.5), part = "body") |> width(j = 1, width = 2.4) |> width(j = 2:4, width = 1.2) |> padding(padding.top = 3, padding.bottom = 3, part = "all")
doc <- poner_tabla(doc, ftc); doc <- body_add_par(doc, "")
doc <- grafico(doc, "Top Two Box de las competencias del perfil de egreso, por actor", g_competencias(cn, mm, c("Docentes", "Estudiantes", "Egresados"), n_txt = "N = 51 docentes, 109 estudiantes y 161 egresados"), if (ESTILO == "fiel") 3.3 else 2.6)
doc <- subsec(doc, "2.10. Situación laboral del egresado")
for (v in c("p11", "p12")) { f <- fr("egresados", v)
  doc <- grafico(doc, f$pregunta, g_sino(f$labels[1:2], f$pct[1:2], f$n[1:2], n_txt = sprintf("N = %d egresados", f$valid)), if (ESTILO == "fiel") 2.3 else 1.5) }
doc <- subsec(doc, "2.11. Pregunta de opción múltiple")
sm <- D$ing_p35
doc <- grafico(doc, sm$pregunta, g_barras(sm$labels[sm$pct > 0], sm$pct[sm$pct > 0], n_txt = "N = 131 egresados. Opción múltiple: los porcentajes pueden sumar más de 100"), alto_barras(sum(sm$pct > 0)) + 1.2)

# ---------------- 3. galería
doc <- body_add_break(doc)
doc <- seccion(doc, "3. Galería de gráficos")
doc <- parr(doc, tx("Esta sección muestra cada tipo de gráfico del motor en su formato de Word. Desde aquí, los datos son ficticios y conservan la forma real de cada caso."))
sf <- function(p) p
doc <- subsec(doc, "3.1. Barras de una variable con residual al final")
doc <- parr(doc, tx("Se usa en preguntas con categorías sin orden propio. Van de la más elegida a la menos elegida, con «Otro» y «Ninguna» al final y en gris.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "¿Qué herramientas de inteligencia artificial usa en sus funciones laborales?", g_barras(c("IA generativa (ChatGPT, Copilot, etc.)", "Automatización inteligente", "Analítica avanzada", "Machine Learning", "Visión computacional", "No precisa"),
  c(99, 13, 11, 7, 1, 1), con_n = c(172, 23, 19, 12, 2, 2), n_txt = "N = 174 egresados que usan IA. Opción múltiple: los porcentajes pueden sumar más de 100"), alto_barras(6))
doc <- subsec(doc, "3.2. Comparación de dos grupos por indicador")
doc <- parr(doc, tx("Se usa cuando dos grupos responden los mismos indicadores. Cada fila muestra la distancia entre ellos.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "Competencias genéricas: autopercepción de egresados y evaluación de empleadores (Top Two Box)", g_dos_grupos(c("Aprendizaje autónomo y adaptabilidad", "Ética, ciudadanía y conciencia ambiental", "Comunicación eficaz", "Pensamiento crítico y creativo", "Investigación, creación e innovación"),
  c(100, 87, 93, 100, 100), c(93, 95, 88, 91, 74), c("Empleadores", "Egresados"), n_txt = "N = 15 empleadores y 314 egresados", lim = 100), 2.9)
doc <- subsec(doc, "3.3. Matriz de conteos")
doc <- parr(doc, tx("Se usa para cruzar dos variables con pocos casos. Cada celda muestra la frecuencia y el tono crece con ella.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "Entidades que reconocieron la labor docente, por año", g_matriz(c("Dirección Académica del Profesorado", "Facultad", "Departamento académico", "Universidad", "Escuela de Posgrado"), as.character(2020:2024),
  rbind(c(0, 2, 3, 3, 5), c(3, 3, 3, 4, 2), c(1, 1, 1, 1, 2), c(1, 3, 2, 4, 2), c(0, 0, 1, 3, 1)), n_txt = "N = 26 docentes que respondieron «Sí». Un docente puede declarar varias"), 2.4)


doc <- subsec(doc, "3.4. Ranking con puntos")
doc <- parr(doc, tx("Se usa para ordenar una lista larga de opciones de mayor a menor.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "Qué podría mejorar la carrera (cinco opciones más mencionadas)", g_lollipop(head(sm$labels[order(-sm$pct)], 5), head(sort(sm$pct, decreasing = TRUE), 5), n_txt = "N = 131 egresados"), 2.8)
doc <- subsec(doc, "3.5. Promedio por grupo y distribución")
doc <- parr(doc, tx("Se usa con preguntas numéricas, como la edad. El promedio resume cada grupo y la caja muestra cuánto varía.", 11, NAVY), keep = TRUE)
# p3 = edad declarada (entero); p6 = nivel curricular
eda <- suppressWarnings(as.numeric(as.character(CONTA$data_sources$estudiantes$p3))); cic <- as.character(CONTA$data_sources$estudiantes$p6)
ok <- !is.na(eda) & !is.na(cic) & eda < 60; cl <- setNames(ci$labels, fr("estudiantes", "p6")$labels)
codes <- CONTA$inst_sources$estudiantes$choices; codes <- codes[!is.na(codes$list_name) & codes$list_name == CONTA$inst_sources$estudiantes$survey$list_name[match("p6", CONTA$inst_sources$estudiantes$survey$name)], ]
lab_c <- setNames(codes[[grep("^label", names(codes))[1]]], codes$name)
grp <- lab_c[cic[ok]]; prom <- round(tapply(eda[ok], grp, mean), 1); prom <- prom[intersect(lab_c, names(prom))]
doc <- grafico(doc, "Edad promedio por nivel curricular", g_promedios(names(prom), as.numeric(prom), n_txt = sprintf("N = %d estudiantes que declararon su edad", sum(ok)), unidad = " años"), 2.2)
doc <- grafico(doc, "Distribución de la edad por nivel curricular", g_boxplot(split(eda[ok], factor(grp, levels = names(prom))), n_txt = sprintf("N = %d estudiantes", sum(ok))), 2.4)
doc <- subsec(doc, "3.6. Torta o dona de varias categorías")
doc <- parr(doc, tx("Se usa con pocas categorías que suman 100%. Con más de cinco se usan barras.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "Situación laboral actual", g_torta(c("Trabaja de manera dependiente", "Trabaja de manera independiente", "No trabaja", "Estudia"), c(62, 21, 11, 6), n_txt = "N = 178 egresados", alto = 2.9), 2.9)
doc <- subsec(doc, "3.7. Serie temporal (uso excepcional)")
doc <- parr(doc, tx("Se usa con tres o más mediciones en el tiempo. Con dos mediciones se usa la comparación de dos grupos.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "Top Two Box de la tutoría académica en cuatro procesos de acreditación", g_serie(c("2012", "2016", "2021", "2026"), list(Docentes = c(88, 93, 98, 83), Estudiantes = c(71, 79, 84, 53)),
  n_txt = "N = 46, 49, 51 y 52 docentes. 702, 845, 1,102 y 1,234 estudiantes"), 2.4,
  texto = "La valoración de los estudiantes sube hasta 2021 y cae 31 puntos en 2026. La de los docentes baja 15 puntos en el mismo periodo.")
doc <- grafico(doc, "Satisfacción con la formación recibida en tres mediciones, egresados", g_serie(c("2016", "2021", "2026"), list(Egresados = c(79, 84, 88)),
  n_txt = "N = 241, 296 y 314 egresados"), 2.2,
  texto = "La satisfacción de los egresados sube 9 puntos entre 2016 y 2026.")

doc <- subsec(doc, "3.8. Mapa de calor por dimensión")
doc <- parr(doc, tx("Se usa para comparar dimensiones entre varios grupos. Cada celda es el Top Two Box promedio de la dimensión. El tono va siempre de 80% a 100%, de modo que un mismo color indica lo mismo en todo el informe.", 11, NAVY), keep = TRUE)
de_ <- CONTA$data_sources$estudiantes; it_ <- sprintf("p22_%d", 1:11)
dims_ <- list(`Competencias técnicas` = 1:5, `Visión empresarial` = 6, `Competencias transversales` = 7:11)
gr_ <- list(Total = rep(TRUE, nrow(de_)), Masculino = as.character(de_$p5) == "1", Femenino = as.character(de_$p5) == "2")
for (k in seq_along(ci$labels)) gr_[[ci$labels[k]]] <- as.character(de_$p6) == as.character(k)
ttb_ <- function(idx) sapply(it_, function(v) { x <- as.character(de_[[v]])[idx]; ok <- x %in% c("1", "2", "3", "4"); round(100 * mean(x[ok] %in% c("3", "4"))) })
Mi_ <- sapply(gr_, ttb_); Md_ <- t(sapply(dims_, function(ix) colMeans(Mi_[ix, , drop = FALSE])))
doc <- grafico(doc, "Top Two Box de las competencias por dimensión y grupo, estudiantes", g_heat(Md_, n_txt = sprintf("N = %d estudiantes", sum(apply(sapply(it_, function(v) as.character(de_[[v]]) %in% c("1", "2", "3", "4")), 1, any)))), 2.4,
  texto = { mn <- which(Md_ == min(Md_), arr.ind = TRUE)[1, ]; sprintf("En el total, las tres dimensiones alcanzan al menos %d%%. El valor más bajo está en %s, entre estudiantes de %s (%d%%).", floor(min(Md_[, "Total"])), tolower(rownames(Md_)[mn[1]]), tolower(colnames(Md_)[mn[2]]), round(min(Md_))) })
doc <- subsec(doc, "3.9. Comparativo de índices entre dos grupos")
doc <- parr(doc, tx("Se usa para comparar dos grupos en cada dimensión, por ejemplo hombres y mujeres.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "Índice de cada dimensión por sexo, estudiantes", g_dos_grupos(rownames(Md_), round(Md_[, "Masculino"]), round(Md_[, "Femenino"]), c("Masculino", "Femenino"),
  n_txt = sprintf("N = %d estudiantes hombres y %d mujeres", sum(gr_$Masculino), sum(gr_$Femenino)), lim = 100), 2.0,
  texto = { df_ <- round(Md_[, "Masculino"]) - round(Md_[, "Femenino"]); k_ <- which.max(abs(df_)); sprintf("La mayor distancia entre hombres y mujeres es de %d puntos, en %s.", abs(df_[k_]), tolower(names(df_)[k_])) })

doc <- subsec(doc, "3.10. Media y rango por público")
doc <- parr(doc, tx("Se usa para comparar una variable numérica, como la edad, entre públicos distintos. El punto marca la media y la línea va del valor más bajo al más alto.", 11, NAVY), keep = TRUE)
pub_ <- list(Docentes = c("docentes", "p4"), Estudiantes = c("estudiantes", "p3"), Egresados = c("egresados", "p4"), Administrativos = c("administrativos", "p3"))
ed_ <- lapply(pub_, function(z) { x <- suppressWarnings(as.numeric(as.character(CONTA$data_sources[[z[1]]][[z[2]]]))); x[!is.na(x) & x < 90] })
doc <- grafico(doc, "Edad por público", g_rango(ed_, n_txt = sprintf("N = %s", paste(sprintf("%d %s", lengths(ed_), tolower(names(ed_))), collapse = ", "))), 2.2,
  texto = sprintf("Los docentes tienen en promedio %.1f años y los estudiantes, %.1f. El rango más amplio es el de los %s.", mean(ed_$Docentes), mean(ed_$Estudiantes), tolower(names(ed_)[which.max(sapply(ed_, function(x) diff(range(x))))])))
doc <- subsec(doc, "3.11. Puntos comparativos de dos indicadores")
doc <- parr(doc, tx("Se usa para comparar dos preguntas emparentadas en cada público, como conocer la misión y saber dónde consultarla. La distancia entre los puntos es la brecha.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "Conocer la misión frente a saber dónde consultarla, por público", g_dos_grupos(act, vapply(D$mision1, function(m) m$pct[1], 0), vapply(D$mision2, function(m) m$pct[1], 0),
  c("Conoce la misión", "Sabe dónde consultarla"), n_txt = sprintf("N = %s", paste(sprintf("%d %s", vapply(D$mision1, `[[`, 0L, "valid"), tolower(act)), collapse = ", ")), lim = 100), 2.4,
  texto = sprintf("Entre los estudiantes, el %d%% conoce la misión y el %d%% sabe dónde consultarla.", D$mision1[[2]]$pct[1], D$mision2[[2]]$pct[1]))

# ---------------- 4. escenarios
doc <- body_add_break(doc)
doc <- seccion(doc, "4. Escenarios de acreditación")
doc <- subsec(doc, "4.1. Seis actores en un mismo gráfico")
doc <- parr(doc, tx("Si todos los actores responden la misma afirmación, van en un solo gráfico, con barras alineadas, para comparar el Top Two Box de cada uno.", 11, NAVY), keep = TRUE)
seis <- list(list(actor = "Estudiantes", pct = c(3, 23, 46, 28, 0)), list(actor = "Egresados", pct = c(0, 22, 61, 15, 2)), list(actor = "Docentes", pct = c(0, 33, 56, 11, 0)),
             list(actor = "Autoridades", pct = c(0, 8, 50, 42, 0)), list(actor = "Administrativos", pct = c(0, 0, 18, 29, 53)), list(actor = "Empleadores", pct = c(4, 12, 46, 31, 7)))
doc <- grafico(doc, "La carrera cuenta con un cuerpo académico suficiente en número, dedicación y calificaciones", g_apilada(seis, ROT, WTK$likert,
  n_txt = "N = 39 estudiantes, 67 egresados, 18 docentes, 12 autoridades, 17 administrativos y 26 empleadores"), alto_apilada(6))
doc <- subsec(doc, "4.2. Satisfacción con «No he usado el servicio» dentro de la base")
doc <- parr(doc, tx("Si una parte no usó el servicio, esa respuesta queda en la barra, al final y en gris, y el Top Two Box se lee sobre todos.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "Satisfacción con el servicio médico de la universidad", g_apilada(list(list(actor = "Estudiantes", pct = c(6, 20, 36, 19, 19)), list(actor = "Docentes", pct = c(1, 16, 61, 22, 0)), list(actor = "Administrativos", pct = c(12, 16, 64, 8, 0))),
  c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho", "No he usado el servicio"), WTK$likert, n_txt = "N = 201 estudiantes, 92 docentes y 25 administrativos"), alto_apilada(3))
doc <- subsec(doc, "4.3. Pregunta filtro y subpregunta")
doc <- parr(doc, tx("Si sólo quienes respondieron «Sí» pasan a la pregunta siguiente, el segundo gráfico va inmediatamente después y su base dice quiénes son.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "¿Ha participado en programas de intercambio?", g_sino(c("Sí", "No"), c(10, 90), c(20, 181), n_txt = "N = 201 estudiantes"), if (ESTILO == "fiel") 2.4 else 1.5)
doc <- grafico(doc, "Los programas de intercambio fortalecen mis competencias (sólo quienes participaron)", g_apilada(list(list(actor = "Participaron", pct = c(10, 0, 55, 35))), ROT[1:4], WTK$likert[1:4],
  n_txt = "N = 20 estudiantes que respondieron «Sí» en la pregunta anterior"), alto_apilada(1))
doc <- subsec(doc, "4.4. Escala de utilidad")
doc <- parr(doc, tx("Si la escala no es de acuerdo sino de utilidad, se dibuja con los mismos colores y en el mismo orden.", 11, NAVY), keep = TRUE)
oe <- list(list(actor = "OE1", pct = c(1, 2, 31, 66, 0)), list(actor = "OE2", pct = c(1, 10, 31, 57, 1)), list(actor = "OE3", pct = c(0, 4, 38, 58, 0)), list(actor = "OE4", pct = c(0, 3, 29, 67, 1)))
doc <- grafico(doc, "Utilidad de los objetivos educacionales de la carrera", g_apilada(oe, c("Nada útil", "Poco útil", "Útil", "Totalmente útil", "SIN INF"), WTK$likert, n_txt = "N = 131 egresados"), alto_apilada(4))
doc <- subsec(doc, "4.5. Sí, No y No sabe")
doc <- parr(doc, tx("Si la pregunta admite «No sabe», va al final de la barra y en gris, sin mezclarse con el No.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "¿Conoce el servicio de bienestar psicológico?", g_apilada(list(list(actor = "Estudiantes", pct = c(84, 11, 5)), list(actor = "Docentes", pct = c(72, 20, 8)), list(actor = "Administrativos", pct = c(60, 30, 10))),
  c("Sí", "No", "No sabe"), c(WTK$azul_si, WTK$celeste, "#BFBFBF"), ttb = FALSE, n_txt = "N = 1,234 estudiantes, 148 docentes y 43 administrativos"), alto_apilada(3))
doc <- subsec(doc, "4.6. Bases por cohorte")
doc <- parr(doc, tx("Si el mismo actor se divide en grupos, como los egresados por año de egreso, cada fila declara su base.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "Recomendaría la carrera a otras personas", g_apilada(list(list(actor = "2019 a 2023", pct = c(1, 6, 38, 54, 1)), list(actor = "Antes de 2019", pct = c(3, 9, 44, 41, 3))), ROT, WTK$likert,
  n_txt = "N = 67 egresados de 2019 a 2023 y 115 egresados antes de 2019"), alto_apilada(2))


doc <- subsec(doc, "4.7. Escalas de competencia y de importancia")
doc <- parr(doc, tx("Si la escala habla de competencia o de importancia, cambian las palabras de la leyenda. El color y el orden se mantienen.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "Autopercepción de competencias del egresado", g_apilada(list(list(actor = "Diseña soluciones de ingeniería", pct = c(1, 7, 40, 52, 0)), list(actor = "Gestiona proyectos", pct = c(2, 8, 47, 43, 0)),
  list(actor = "Se comunica de forma efectiva", pct = c(1, 6, 45, 48, 0)), list(actor = "Investiga e innova", pct = c(3, 15, 50, 31, 1))), c("Nada competente", "Poco competente", "Competente", "Totalmente competente", "SIN INF"), WTK$likert,
  ancho_lab = 1.8, envolver = 30, n_txt = "N = 131 egresados"), alto_apilada(4))
doc <- grafico(doc, "Importancia de las prácticas preprofesionales en la formación", g_apilada(list(list(actor = "Estudiantes", pct = c(1, 4, 33, 60, 2)), list(actor = "Egresados", pct = c(0, 3, 28, 68, 1)), list(actor = "Docentes", pct = c(0, 2, 38, 58, 2))),
  c("Nada importante", "Poco importante", "Importante", "Muy importante", "SIN INF"), WTK$likert, n_txt = "N = 1,234 estudiantes, 314 egresados y 148 docentes"), alto_apilada(3))
doc <- subsec(doc, "4.8. Etiquetas largas y cortas")
doc <- parr(doc, tx("Si las afirmaciones son largas, el texto se reparte en varias líneas y cada fila crece lo necesario, sin cortar palabras.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "Gestión institucional: afirmaciones extensas", g_apilada(list(
  list(actor = "Las autoridades de la Facultad informan oportunamente a la comunidad académica sobre las decisiones que afectan el desarrollo de la carrera y sus planes de mejora", pct = c(4, 18, 52, 24, 2)),
  list(actor = "La carrera cuenta con recursos humanos, técnicos y financieros suficientes para desarrollar actividades de investigación, desarrollo tecnológico e innovación", pct = c(6, 24, 47, 20, 3)),
  list(actor = "Los mecanismos de admisión, permanencia y graduación están claramente definidos y se aplican de manera transparente", pct = c(2, 11, 55, 31, 1))), ROT, WTK$likert,
  envolver = 40, n_txt = "N = 148 docentes"), alto_apilada(3) + 1.2)
doc <- grafico(doc, "Satisfacción con la infraestructura", g_apilada(lapply(list(c("Biblioteca", 2, 8, 50, 39, 1), c("Laboratorios", 4, 16, 52, 26, 2), c("Aulas", 3, 12, 58, 26, 1), c("Wifi", 9, 27, 44, 18, 2), c("Áreas deportivas", 3, 10, 47, 33, 7), c("Estacionamiento", 11, 24, 38, 12, 15)),
  function(r) list(actor = r[1], pct = as.numeric(r[2:6]))), c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho", "SIN INF"), WTK$likert, ancho_lab = 1.0, n_txt = "N = 1,234 estudiantes"), alto_apilada(6))
doc <- subsec(doc, "4.9. Dos preguntas seguidas con otra escala u otros actores")
doc <- parr(doc, tx("Si dos preguntas vecinas tienen escalas o actores distintos, cada una lleva su propio gráfico, leyenda y base.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "La Unidad cuenta con servicios de tutoría académica", g_apilada(list(list(actor = "Docentes", pct = c(2, 8, 54, 21, 15)), list(actor = "Estudiantes", pct = c(6, 18, 34, 19, 23))), ROT, WTK$likert, n_txt = "N = 148 docentes y 1,234 estudiantes"), alto_apilada(2))
doc <- grafico(doc, "¿Conoce el reglamento de prácticas preprofesionales?", g_apilada(list(list(actor = "Estudiantes", pct = c(64, 36)), list(actor = "Egresados", pct = c(71, 29)), list(actor = "Administrativos", pct = c(88, 12))), c("Sí", "No"), c(WTK$azul_si, WTK$celeste), ttb = FALSE,
  n_txt = "N = 1,234 estudiantes, 314 egresados y 43 administrativos"), alto_apilada(3))
doc <- subsec(doc, "4.10. Respuestas «Otros»")
doc <- parr(doc, tx("Si las respuestas abiertas de «Otros» son muchas y dispersas, van en una tabla aparte, de mayor a menor.", 11, NAVY), keep = TRUE)
otros <- data.frame(t = c("Ingeniero de proyectos", "Ingeniero de diseño", "Ingeniero de aplicaciones", "Planificador de mantenimiento", "Ingeniero de diseño mecánico", "Ingeniero de tuberías", "Ingeniero mecánico", "Asesor técnico comercial", "Comprador corporativo", "Consultor técnico"),
  n = c(7, 6, 5, 5, 2, 2, 2, 1, 1, 1))
tabo <- data.frame(`Puesto` = otros$t[1:5], `N.º` = otros$n[1:5], ` ` = "", `Puesto ` = otros$t[6:10], `N.º ` = otros$n[6:10], check.names = FALSE)
doc <- cap_tabla(doc, 3, "Respuestas «Otros» a la pregunta ¿Cuál es su puesto actual?")
fto <- flextable(tabo) |> font(fontname = FONT, part = "all") |> fontsize(size = 9, part = "all") |> color(color = NAVY, part = "all") |> bold(part = "header") |> border_remove() |>
  hline(border = fp_border(color = "#D5D9DF", width = 0.5), part = "body") |> hline_top(border = fp_border(color = NAVY, width = 1), part = "header") |> width(j = c(1, 4), width = 2.3) |> width(j = c(2, 5), width = 0.5) |> width(j = 3, width = 0.3) |> align(j = c(2, 5), align = "center", part = "all")
doc <- poner_tabla(doc, fto)
doc <- parr(doc, tx("N = 62 respuestas en «Otros». Fuente: PULSO PUCP 2026.", 7.5, NAVY, FALSE, TRUE), align = "center", after = 10)
doc <- subsec(doc, "4.11. Opción múltiple comparada entre actores")
doc <- parr(doc, tx("Si una pregunta de opción múltiple se hizo a dos actores, se compara cada opción entre ellos. Los porcentajes pueden sumar más de 100.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "¿A través de qué medios se ha enterado de la misión y la visión de la carrera?", g_dos_grupos(c("Página web de la Facultad", "Reuniones con autoridades", "Correo institucional", "Redes sociales", "Inducción"), c(68, 51, 26, 16, 22), c(53, 6, 22, 36, 0),
  c("Docentes", "Estudiantes"), n_txt = "N = 148 docentes y 1,234 estudiantes. Opción múltiple", lim = 80), 2.6)
doc <- subsec(doc, "4.12. Base chica")
doc <- parr(doc, tx("Si el grupo tiene menos de 30 personas, junto al porcentaje va el número de casos entre paréntesis.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "Cargo de las autoridades", g_barras(c("Coordinador(a)", "Jefe(a) de departamento", "Decano(a) o director(a)", "Secretario(a) académico(a)"), c(42, 25, 17, 17), con_n = c(5, 3, 2, 2), n_txt = "N = 12 autoridades: con menos de 30 casos se lee la frecuencia entre paréntesis"), alto_barras(4))
doc <- subsec(doc, "4.13. Escala ordinal con filtro")
doc <- parr(doc, tx("Si una pregunta de rangos sólo se hace a una parte, como el ingreso a quienes trabajan, los rangos van en su orden y la base lo dice.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "¿Trabaja de manera dependiente?", g_sino(c("Sí", "No"), c(87, 13), c(179, 26), n_txt = "N = 205 egresados"), if (ESTILO == "fiel") 2.3 else 1.5)
doc <- grafico(doc, "¿Cuál es su ingreso mensual aproximado? (en soles)", g_barras(c("De S/ 1,501 a S/ 2,500", "De S/ 2,501 a S/ 3,500", "De S/ 3,501 a S/ 4,500", "De S/ 4,501 a S/ 5,500", "S/ 5,501 a más", "Prefiero no responder"), c(8, 16, 22, 20, 31, 3),
  n_txt = "N = 179 egresados que trabajan de manera dependiente. Los rangos van en su orden"), alto_barras(6))

doc <- subsec(doc, "4.14. Cifras chicas seguidas")
doc <- parr(doc, tx("Si al inicio de la barra caen 1%, 2% y 3% seguidos, las tres cifras suben sobre la barra con su guía, separadas entre sí. Si no caben, el grupo se corre a la izquierda."))
doc <- grafico(doc, "El plan de estudios responde a las demandas del mercado laboral", g_apilada(list(list(actor = "Estudiantes", pct = c(1, 2, 3, 51, 43)), list(actor = "Egresados", pct = c(2, 3, 1, 47, 47)), list(actor = "Docentes", pct = c(0, 1, 2, 42, 55))),
  c("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Totalmente de acuerdo"), c("#F4B183", "#FFD965", "#D9D9D9", "#ADD493", "#70AD47"),
  n_txt = "N = 1,234 estudiantes, 314 egresados y 148 docentes"), alto_apilada(3))
doc <- subsec(doc, "4.15. Redondeo de cifras")
doc <- parr(doc, tx(paste("Los porcentajes se redondean al entero. Si el redondeo estándar no suma 100, se reparte el punto que falta a la categoría con mayor resto decimal, para que cada barra cierre en 100.",
  "El Top Two Box se calcula con las cifras exactas y después se redondea, por lo que puede diferir en un punto de la suma de sus dos segmentos visibles.")))
red <- data.frame(Categoría = c(ROT[1:4], "Suma"), Exacto = c("12.2%", "20.4%", "33.3%", "34.1%", "100.0%"), `Redondeo estándar` = c("12%", "20%", "33%", "34%", "99%"), `Redondeo repartido` = c("12%", "21%", "33%", "34%", "100%"), check.names = FALSE)
doc <- cap_tabla(doc, 4, "Ejemplo de reparto del redondeo")
ftr <- flextable(red) |> font(fontname = FONT, part = "all") |> fontsize(size = 9.5, part = "all") |> color(color = NAVY, part = "all") |> bold(part = "header") |> bold(i = 5) |>
  bg(bg = NAVY, part = "header") |> color(color = "#FFFFFF", part = "header") |> bg(i = 2, j = 4, bg = "#FBE3E2") |> color(i = 5, j = 3, color = CORAL) |> align(j = 2:4, align = "center", part = "all") |> border_remove() |>
  hline(border = fp_border(color = "#D5D9DF", width = 0.5), part = "body") |> width(j = 1, width = 2.3) |> width(j = 2:4, width = 1.3) |> padding(padding.top = 3, padding.bottom = 3, part = "all")
doc <- poner_tabla(doc, ftr, zebra = FALSE)
doc <- parr(doc, tx("Ejemplo ficticio con n = 250. El punto repartido va a «En desacuerdo», la categoría con mayor resto (0.4).", 7.5, NAVY, FALSE, TRUE), align = "center", after = 10)
doc <- subsec(doc, "4.16. Perfil de los empleadores")
doc <- parr(doc, tx("Si el actor es una organización y no una persona, se describe su sector y su tamaño antes de su opinión.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "Sector de la organización", g_barras(c("Privado", "Público", "Organismo internacional u ONG", "Otro"), c(62, 27, 8, 4), con_n = c(16, 7, 2, 1), n_txt = "N = 26 empleadores"), alto_barras(4))
doc <- grafico(doc, "Tamaño de la organización", g_columnas(c("Micro", "Pequeña", "Mediana", "Grande"), c(8, 15, 23, 54), n_txt = "N = 26 empleadores"), 2.2)
doc <- grafico(doc, "Desempeño de los egresados de la carrera en su organización", g_apilada(lapply(list(c("Conocimientos técnicos", 0, 4, 54, 42), c("Trabajo en equipo", 0, 8, 46, 46), c("Comunicación oral y escrita", 4, 12, 50, 34), c("Ética profesional", 0, 0, 38, 62), c("Liderazgo", 4, 19, 50, 27)),
  function(r) list(actor = r[1], pct = as.numeric(r[2:5]))), c("Muy malo", "Malo", "Bueno", "Muy bueno"), WTK$likert[1:4], ancho_lab = 1.6, n_txt = "N = 26 empleadores"), alto_apilada(5),
  texto = "Con 26 empleadores, cada uno equivale a casi 4 puntos porcentuales. Por eso no se interpretan diferencias menores de 8 puntos entre ítems.")
doc <- subsec(doc, "4.17. Desglose de un actor")
doc <- parr(doc, tx("Si interesa ver un actor por etapas o grupos, la fila «Total» va primero y cada grupo declara su base.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "Me siento satisfecho con la formación recibida, estudiantes por etapa", g_apilada(list(list(actor = "Total", pct = c(2, 9, 55, 33, 1)), list(actor = "Primeros ciclos", pct = c(1, 6, 52, 40, 1)), list(actor = "Ciclos intermedios", pct = c(3, 10, 56, 30, 1)), list(actor = "Últimos ciclos", pct = c(2, 12, 57, 28, 1))),
  ROT, WTK$likert, n_txt = "N = 1,234 estudiantes: 410 de primeros ciclos, 452 de ciclos intermedios y 372 de últimos ciclos"), alto_apilada(4),
  texto = "El 88% del total está satisfecho con la formación recibida. Los primeros ciclos llegan a 92% y los últimos, a 85%.")

doc <- subsec(doc, "4.18. Perfil de las autoridades en tabla")
doc <- parr(doc, tx("Con pocas autoridades, un gráfico exagera las diferencias. Por eso el perfil va en una tabla con frecuencias y porcentajes.", 11, NAVY), keep = TRUE)
doc <- cap_tabla(doc, 5, "Perfil de las autoridades consultadas")
aut <- data.frame(Característica = c("Cargo", "", "", "Años en el cargo", "", "Máximo grado académico", ""),
  Categoría = c("Coordinador(a) de especialidad", "Jefe(a) de departamento", "Decano(a) o director(a)", "Menos de 3 años", "3 años o más", "Magíster", "Doctor(a)"),
  `N.º` = c(5, 4, 3, 7, 5, 4, 8), `%` = c("42%", "33%", "25%", "58%", "42%", "33%", "67%"), check.names = FALSE)
fta <- flextable(aut) |> font(fontname = FONT, part = "all") |> fontsize(size = 9.5, part = "all") |> color(color = NAVY, part = "all") |> bold(part = "header") |> bold(j = 1) |>
  bg(bg = NAVY, part = "header") |> color(color = "#FFFFFF", part = "header") |> align(j = 3:4, align = "center", part = "all") |> border_remove() |>
  hline(i = c(3, 5, 7), border = fp_border(color = "#D5D9DF", width = 0.5), part = "body") |> width(j = 1, width = 1.9) |> width(j = 2, width = 2.6) |> width(j = 3:4, width = 0.8) |>
  padding(padding.top = 3, padding.bottom = 3, part = "all")
doc <- poner_tabla(doc, fta, zebra = FALSE)
doc <- parr(doc, tx("N = 12 autoridades. Fuente: PULSO PUCP 2026.", 7.5, NAVY, FALSE, TRUE), align = if (MOD) "left" else "center", after = 10)
doc <- subsec(doc, "4.19. Comparativo 2026 frente a 2021")
doc <- parr(doc, tx("Cuando el estudio repite preguntas del proceso anterior, se compara el Top Two Box de cada indicador entre las dos mediciones. El pie dice de dónde sale la cifra de 2021.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "Top Two Box de los estudiantes en indicadores repetidos, 2026 frente a 2021", g_dos_grupos(c("Conoce la misión de la carrera", "El plan de estudios es pertinente",
  "Los docentes dominan su materia", "La infraestructura es adecuada", "Recibe orientación académica"), c(81, 86, 92, 64, 53), c(74, 88, 90, 52, 61), c("2026", "2021"),
  n_txt = "N = 1,234 estudiantes en 2026 y 1,102 en 2021. 2021: informe consolidado anterior", lim = 100), 2.6,
  texto = "La infraestructura sube 12 puntos y la orientación académica baja 8. Los demás indicadores se mueven 7 puntos o menos.")

# ---------------- 5. otros estudios
doc <- body_add_break(doc)
doc <- seccion(doc, "5. Otros estudios de PULSO")
doc <- subsec(doc, "5.1. Opinión pública")
doc <- parr(doc, tx("Si la pregunta usa una escala de 1 a 10 o se cruza por edad, las columnas muestran cada valor y las barras apiladas comparan los grupos, con la fila «Total» al final.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "En una escala de 1 a 10, ¿cuánto confía en el Congreso?", g_columnas(c(as.character(1:10), "NS/NR"), c(18, 9, 12, 11, 15, 10, 8, 6, 3, 2, 6), corte = 5, n_txt = "N = 1,200 entrevistados"), 2.4)
doc <- grafico(doc, "La democracia es preferible a cualquier otra forma de gobierno, por grupo de edad", g_apilada(list(list(actor = "18 a 29 años", pct = c(9, 21, 44, 22, 4)), list(actor = "30 a 59 años", pct = c(6, 17, 46, 27, 4)), list(actor = "60 años a más", pct = c(4, 12, 43, 37, 4)), list(actor = "Total", pct = c(6, 17, 45, 28, 4))),
  c("Muy en desacuerdo", "En desacuerdo", "De acuerdo", "Muy de acuerdo", "NS/NR"), WTK$likert, n_txt = "N = 1,200 entrevistados: 312 de 18 a 29 años, 641 de 30 a 59 y 247 de 60 a más"), alto_apilada(4))
doc <- subsec(doc, "5.2. Estudio cuasi-experimental")
doc <- parr(doc, tx("Si se comparan distritos con y sin intervención, cada indicador muestra los dos grupos lado a lado.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "Percepción de la comunidad de acogida, por grupo", g_dos_grupos(c("Considera que la población refugiada aporta a su barrio", "Tiene un vecino de otra nacionalidad con quien conversa", "Participó en una actividad comunitaria en el último año", "Se siente seguro caminando de noche en su barrio"),
  c(58, 64, 31, 47), c(46, 59, 22, 45), c("Intervención", "Comparación"), n_txt = "N = 99 entrevistados en distritos de intervención y 90 en distritos de comparación", lim = 80), 2.6)
doc <- subsec(doc, "5.3. Monitoreo posdistribución")
doc <- parr(doc, tx("Si cada indicador tiene una meta, la barra muestra lo logrado y una marca coral, la meta.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "Indicadores de la asistencia en efectivo frente a su meta", g_metas(c("Recibió la asistencia en la fecha prevista", "Retiró el dinero sin problemas de acceso", "Usó el efectivo en necesidades básicas", "Conoce cómo presentar una queja", "Se sintió tratado con respeto"),
  c(86, 78, 92, 41, 95), c(80, 85, 90, 60, 90), n_txt = "N = 2,296 hogares entrevistados por teléfono"), 2.9)
doc <- subsec(doc, "5.4. Encuesta en aulas")
doc <- parr(doc, tx("Si se compara un indicador entre facultades con tamaños muy distintos, junto al porcentaje va el número de casos.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "Estudiantes que vivieron al menos una situación de hostigamiento, por facultad", g_barras(c("Ciencias Sociales", "Arquitectura", "Derecho", "Artes", "Ingeniería", "Educación", "Ciencias Contables"), c(31, 27, 24, 22, 19, 18, 15), con_n = c(412, 188, 305, 24, 690, 96, 140),
  n_txt = "N = 1,855 estudiantes encuestados en aula. Entre paréntesis, los casos de cada facultad"), alto_barras(7))
doc <- subsec(doc, "5.5. Estudio por olas")
doc <- parr(doc, tx("Si la misma pregunta se mide varias veces en el año, la línea muestra el cambio entre mediciones.", 11, NAVY), keep = TRUE)
doc <- grafico(doc, "Aprobación de la gestión en cuatro mediciones", g_serie(c("Marzo", "Junio", "Setiembre", "Diciembre"), list(Aprueba = c(41, 37, 33, 35), Desaprueba = c(52, 56, 60, 58))), 2.4)

print(doc, target = Sys.getenv("SALIDA"))
# El filete de «Lectura» necesita separación del texto (w:space); officer la escribe en 0.
system2("python3", c(shQuote("docs/qa/motor-ppt-2026-10-06/herramientas/word_nativo.py"), shQuote(Sys.getenv("SALIDA")))); cat("OK", GN, "gráficos", ESTILO, "\n")
