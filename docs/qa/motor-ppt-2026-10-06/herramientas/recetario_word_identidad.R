# Identidad del documento Word (W5 a W7, 2026-10-08): estilos, página, encabezado corrido, portadas, índices, aperturas de
# capítulo y contraportada. Pedido de Gonzalo: «en un Word hay capítulos, subcapítulos, una propuesta de índice… una forma más
# sofisticada, avanzada, minimalista, pero creativa». Parte de lo medido en los informes entregados: la numeración de gráficos se
# hacía de cuatro maneras, ningún informe traía índice de gráficos ni de tablas, los capítulos empezaban a mitad de página, el
# índice compartía página con la portada y los logos se repetían en todas las páginas.
# Se carga desde recetario_word.R después de sus helpers (tx, parr, rotulo…).

logo_tinta <- function(f) { im <- magick::image_trim(magick::image_read(file.path(LOGOS, f)), fuzz = 8); o <- file.path(TMP, paste0("t_", f)); magick::image_write(im, o)
  i <- magick::image_info(im); list(f = o, asp = i$width / i$height) }
L1 <- logo_tinta("image1.png"); L8 <- logo_tinta("image8.png")
logos_ft <- function(h = 0.5) flextable(data.frame(a = "", b = "")) |> delete_part("header") |> border_remove() |> width(j = 1, width = ANCHO_W / 2) |> width(j = 2, width = ANCHO_W / 2) |>
  compose(j = 1, value = as_paragraph(as_image(src = L1$f, width = h * L1$asp, height = h))) |>
  compose(j = 2, value = as_paragraph(as_image(src = L8$f, width = h * L8$asp, height = h))) |>
  align(j = 1, align = "left") |> align(j = 2, align = "right") |> valign(valign = "center") |> padding(padding = 0)

# ---- estilos: un solo juego, semántico, sin formato directo en el cuerpo
estilos_doc <- function(doc) {
  doc <- docx_set_paragraph_style(doc, style_id = "Titre1", style_name = "heading 1", fp_p = fp_par(padding.top = 0, padding.bottom = 8, keep_with_next = TRUE, border.bottom = fp_border(color = NAVY, width = 0.75)),
    fp_t = fp_text(font.family = FONT, font.size = 18, color = NAVY, bold = TRUE))
  doc <- docx_set_paragraph_style(doc, style_id = "Titre2", style_name = "heading 2", fp_p = fp_par(padding.top = 16, padding.bottom = 6, keep_with_next = TRUE),
    fp_t = fp_text(font.family = FONT, font.size = 12.5, color = NAVY, bold = TRUE))
  doc <- docx_set_paragraph_style(doc, style_id = "RotuloGrafico", style_name = "Rótulo de gráfico", fp_p = fp_par(text.align = "left", padding.top = 10, padding.bottom = 4, keep_with_next = TRUE, line_spacing = 1.15),
    fp_t = fp_text(font.family = FONT, font.size = 10, color = TXT))
  doc <- docx_set_character_style(doc, style_id = "NumeroRotulo", style_name = "Número de rótulo", base_on = "Default Paragraph Font", fp_t = fp_text(font.family = FONT, font.size = 10, color = NAVY, bold = TRUE))
  doc <- docx_set_paragraph_style(doc, style_id = "BaseFuente", style_name = "Base y fuente", fp_p = fp_par(text.align = "center", padding.top = 2, padding.bottom = 10, line_spacing = 1.1),
    fp_t = fp_text(font.family = FONT, font.size = 8.5, color = SOFT))
  doc <- docx_set_paragraph_style(doc, style_id = "BaseFuenteLectura", style_name = "Base y fuente con lectura", fp_p = fp_par(text.align = "center", padding.top = 2, padding.bottom = 10, line_spacing = 1.1, keep_with_next = TRUE),
    fp_t = fp_text(font.family = FONT, font.size = 8.5, color = SOFT))
  doc <- docx_set_paragraph_style(doc, style_id = "Lectura", style_name = "Lectura", fp_p = fp_par(text.align = "justify", line_spacing = 1.3, padding.top = 2, padding.bottom = 14),
    fp_t = fp_text(font.family = FONT, font.size = 10.5, color = TXT))
  doc <- docx_set_paragraph_style(doc, style_id = "NumeroCapitulo", style_name = "Número de capítulo", fp_p = fp_par(text.align = "left", padding.bottom = 0, keep_with_next = TRUE),
    fp_t = fp_text(font.family = FONT, font.size = 9, color = SOFT, bold = TRUE))
  doc <- docx_set_paragraph_style(doc, style_id = "ListaGuia", style_name = "Lista de la guía", fp_p = fp_par(text.align = "justify", line_spacing = 1.3, padding.left = 10, padding.bottom = 5),
    fp_t = fp_text(font.family = FONT, font.size = 10.5, color = TXT))
  doc <- docx_set_paragraph_style(doc, style_id = "Referencia", style_name = "Referencia", fp_p = fp_par(text.align = "left", line_spacing = 1.3, padding.bottom = 8),
    fp_t = fp_text(font.family = FONT, font.size = 10, color = TXT))   # la sangría francesa la pone word_nativo.py
  # El índice que arma Word usa «toc 1» y «toc 2»: capítulo en negrita azul y sección sangrada en gris oscuro
  doc <- docx_set_paragraph_style(doc, style_id = "TM1", style_name = "toc 1", fp_p = fp_par(padding.top = 9, padding.bottom = 2, tabs = fp_tabs(fp_tab(pos = ANCHO_W, style = "right"))),
    fp_t = fp_text(font.family = FONT, font.size = 10.5, color = NAVY, bold = TRUE))
  doc <- docx_set_paragraph_style(doc, style_id = "TM2", style_name = "toc 2", fp_p = fp_par(padding.left = 16, padding.bottom = 2, tabs = fp_tabs(fp_tab(pos = ANCHO_W, style = "right"))),
    fp_t = fp_text(font.family = FONT, font.size = 10, color = TXT))
  doc
}
# ---- página: logos sólo en la portada; en el interior, el nombre del informe y el capítulo en curso arriba, y el folio abajo.
# Cada capítulo es una sección de Word con su encabezado escrito (Gonzalo, 2026-10-08: Word mostraba «Error! Use the Home tab to apply
# heading 1» con el campo STYLEREF, que LibreOffice sí resolvía). El texto fijo no depende de cómo cada Word resuelva el estilo.
TITULO_CORTO <- "Propuesta de diseño de los informes en Word"
cab_int <- function(derecha, titulo_corto = TITULO_CORTO) block_list(fpar(ftext(titulo_corto, fp_text(font.family = FONT, font.size = 8, color = SOFT)), run_tab(),
  ftext(derecha, fp_text(font.family = FONT, font.size = 8, color = NAVY, bold = TRUE)),
  fp_p = fp_par(tabs = fp_tabs(fp_tab(pos = ANCHO_W, style = "right")), padding.bottom = 4, border.bottom = fp_border(color = "#D5D9DF", width = 0.5))))
pie_int <- function() block_list(fpar(run_word_field("PAGE", prop = fp_text(font.family = FONT, font.size = 8.5, color = NAVY, bold = TRUE)), fp_p = fp_par(text.align = "right")))
vacio <- function() block_list(fpar(ftext("")))
props_pagina <- function(header_default, footer_default, header_first = NULL, footer_first = NULL, type = "nextPage")
  prop_section(page_size = page_size(width = 8.27, height = 11.69), page_margins = page_mar(top = 1.1, bottom = 0.9, left = 1.0, right = 1.0, header = 0.4, footer = 0.4),
               type = type, header_default = header_default, footer_default = footer_default, header_first = header_first, footer_first = footer_first)
# Cierra la sección en curso con su encabezado: la portada (logos en la primera página), un capítulo o las referencias.
cerrar_seccion <- function(doc, derecha, con_portada = FALSE)
  body_end_block_section(doc, block_section(props_pagina(cab_int(derecha), pie_int(), header_first = if (con_portada) block_list(logos_ft()), footer_first = if (con_portada) vacio())))
# Documento nuevo: la última sección (la contraportada en la guía) va sin encabezado ni pie. Las miniaturas usan una sola sección con encabezado.
nuevo_doc <- function(derecha = NULL) {
  doc <- estilos_doc(read_docx())
  if (is.null(derecha)) body_set_default_section(doc, props_pagina(vacio(), vacio(), type = "nextPage"))
  else body_set_default_section(doc, props_pagina(cab_int(derecha, "Informe de ejemplo"), pie_int(), header_first = block_list(logos_ft()), footer_first = vacio(), type = "continuous"))
}
filete_coral <- function(doc, w = 0.9) body_add_flextable(doc, flextable(data.frame(a = "")) |> delete_part("header") |> border_remove() |> width(j = 1, width = w) |>
  height(height = 0.02) |> hline_top(border = fp_border(color = CORAL, width = 2.5)) |> padding(padding = 0), align = "left")

# ---- portadas (A tipográfica, B con banda, C con ficha del encargo)
M_EJ <- list(ante = "INFORME FINAL", titulo = "Estudio de opinión sobre el servicio educativo de la carrera", sub = "Docentes, estudiantes, egresados y personal administrativo",
             para = "Facultad de la carrera", por = "PULSO PUCP", fecha = "Octubre de 2026", version = "Versión final")
portada_A <- function(doc, m = M_EJ) {
  for (k in 1:6) doc <- body_add_par(doc, "")
  doc <- parr(doc, tx(m$ante, 9, SOFT, TRUE), after = 10)
  doc <- parr(doc, tx(m$titulo, 28, NAVY, TRUE), after = 14)
  doc <- filete_coral(doc)
  doc <- parr(doc, tx(m$sub, 13, TXT), before = 10, after = 120)
  doc <- parr(doc, tx(m$por, 9.5, NAVY, TRUE), after = 2)
  parr(doc, tx(m$fecha, 9.5, SOFT), after = 2)
}
portada_B <- function(doc, m = M_EJ) {
  ft <- flextable(data.frame(a = "", b = "")) |> delete_part("header") |> border_remove() |> width(j = 1, width = 0.3) |> width(j = 2, width = ANCHO_W - 0.3) |>
    bg(j = 1, bg = NAVY) |> height(height = 8.4) |> hrule(rule = "exact") |> valign(j = 2, valign = "bottom") |>
    compose(j = 2, value = as_paragraph(as_chunk(m$ante, props = fp_text(font.family = FONT, font.size = 9, color = SOFT, bold = TRUE)), "\n\n",
      as_chunk(m$titulo, props = fp_text(font.family = FONT, font.size = 26, color = NAVY, bold = TRUE)), "\n\n",
      as_chunk(m$sub, props = fp_text(font.family = FONT, font.size = 12, color = TXT)), "\n\n\n\n",
      as_chunk(paste(m$por, m$fecha, sep = "   "), props = fp_text(font.family = FONT, font.size = 9.5, color = NAVY, bold = TRUE)))) |>
    padding(j = 2, padding.left = 28, padding.bottom = 10) |> line_spacing(space = 1.05)
  body_add_flextable(doc, ft, align = "left")
}
portada_C <- function(doc, m = M_EJ) {
  for (k in 1:5) doc <- body_add_par(doc, "")
  doc <- parr(doc, tx(m$ante, 9, SOFT, TRUE), after = 10)
  doc <- parr(doc, tx(m$titulo, 26, NAVY, TRUE), after = 14)
  doc <- filete_coral(doc)
  doc <- parr(doc, tx(m$sub, 12, TXT), before = 10, after = 90)
  fic <- data.frame(k = c("Elaborado para", "Elaborado por", "Fecha", "Versión"), v = c(m$para, m$por, m$fecha, m$version))
  ft <- flextable(fic) |> delete_part("header") |> border_remove() |> width(j = 1, width = 1.6) |> width(j = 2, width = 3.2) |> font(fontname = FONT, part = "all") |>
    fontsize(size = 9.5) |> color(j = 1, color = SOFT) |> color(j = 2, color = NAVY) |> bold(j = 2) |> hline(border = fp_border(color = "#D5D9DF", width = 0.5)) |>
    hline_top(border = fp_border(color = NAVY, width = 0.75)) |> padding(padding.top = 4, padding.bottom = 4) |> padding(j = 1, padding.left = 0)
  body_add_flextable(doc, ft, align = "left")
}
# ---- índices (muestras estáticas para la miniatura: el índice real es el campo de Word con los estilos toc 1 y toc 2)
IDX_EJ <- list(list("1", "Introducción", 3, character()), list("2", "Diseño metodológico", 5, c("2.1. Ficha técnica", "2.2. Cómo leer este informe")),
               list("3", "Perfil de los participantes", 9, c("3.1. Estudiantes", "3.2. Docentes")), list("4", "Dimensión 1: Propósitos de la carrera", 14, c("4.1. Misión y propósitos", "4.2. Gestión")),
               list("5", "Dimensión 2: Formación integral", 22, c("5.1. Plan de estudios", "5.2. Cuerpo académico")), list("6", "Conclusiones y recomendaciones", 31, character()),
               list("", "Anexos", 35, character()))
indice_A <- function(doc) {
  doc <- parr(doc, tx("Contenido", 18, NAVY, TRUE), after = 12)
  for (c_ in IDX_EJ) { doc <- body_add_fpar(doc, fpar(ftext(trimws(paste(if (nzchar(c_[[1]])) paste0(c_[[1]], ".") else "", c_[[2]]))), run_tab(), ftext(as.character(c_[[3]]))), style = "toc 1")
    p <- c_[[3]]; for (s_ in c_[[4]]) { p <- p + 2; doc <- body_add_fpar(doc, fpar(ftext(s_), run_tab(), ftext(as.character(p))), style = "toc 2") } }
  doc <- parr(doc, tx("Índice de gráficos", 12.5, NAVY, TRUE), before = 18, after = 6)
  for (g_ in c("Gráfico 1. Número de respuestas por actor", "Gráfico 2. ¿Conoce la misión y los propósitos de la carrera?", "Gráfico 3. Satisfacción con la formación recibida"))
    doc <- body_add_fpar(doc, fpar(ftext(g_), run_tab(), ftext(sample(9:30, 1))), style = "toc 2")
  doc
}
indice_B <- function(doc) {   # el número de capítulo en una columna propia, grande y claro; las secciones debajo de cada título
  doc <- parr(doc, tx("Contenido", 18, NAVY, TRUE), after = 12)
  filas <- do.call(rbind, lapply(IDX_EJ, function(c_) data.frame(n = c_[[1]], t = paste(c(c_[[2]], c_[[4]]), collapse = "\n"), p = c_[[3]])))
  ft <- flextable(filas) |> delete_part("header") |> border_remove() |> width(j = 1, width = 0.7) |> width(j = 2, width = ANCHO_W - 1.3) |> width(j = 3, width = 0.6) |>
    font(fontname = FONT, part = "all") |> fontsize(j = 1, size = 22) |> bold(j = 1) |> color(j = 1, color = "#9FB1D1") |> fontsize(j = 2:3, size = 10) |>
    color(j = 2:3, color = NAVY) |> bold(j = 3) |> align(j = 3, align = "right") |> valign(valign = "top") |> hline(border = fp_border(color = "#D5D9DF", width = 0.5)) |>
    padding(padding.top = 6, padding.bottom = 8) |> padding(j = 1, padding.left = 0) |> line_spacing(space = 1.25)
  for (i in seq_len(nrow(filas))) { tt <- strsplit(filas$t[i], "\n")[[1]]
    ft <- compose(ft, i = i, j = 2, value = do.call(as_paragraph, c(list(as_chunk(tt[1], props = fp_text(font.family = FONT, font.size = 10.5, color = NAVY, bold = TRUE))),
      unlist(lapply(tt[-1], function(s_) list("\n", as_chunk(s_, props = fp_text(font.family = FONT, font.size = 9.5, color = TXT)))), recursive = FALSE)))) }
  body_add_flextable(doc, ft, align = "left")
}
# ---- aperturas de capítulo (A sobria, B con el número grande y el mapa del capítulo)
apertura_A <- function(doc, n, titulo, intro, secciones = character()) {
  doc <- body_add_par(doc, paste("CAPÍTULO", n), style = "Número de capítulo")
  doc <- body_add_par(doc, titulo, style = "heading 1")
  parr(doc, tx(intro), after = 10)
}
apertura_B <- function(doc, n, titulo, intro, secciones = character()) {
  for (k in 1:2) doc <- body_add_par(doc, "")
  doc <- parr(doc, tx(as.character(n), 60, "#C9D3E6", TRUE), after = 0, keep = TRUE)
  doc <- body_add_par(doc, titulo, style = "heading 1")
  doc <- parr(doc, tx(intro, 11.5, TXT), before = 4, after = 12, keep = length(secciones) > 0)
  if (length(secciones)) {
    ft <- flextable(data.frame(s = secciones)) |> delete_part("header") |> border_remove() |> width(j = 1, width = ANCHO_W) |> font(fontname = FONT, part = "all") |>
      fontsize(size = 9.5) |> color(color = NAVY) |> hline(border = fp_border(color = "#D5D9DF", width = 0.5)) |> hline_top(border = fp_border(color = "#D5D9DF", width = 0.5)) |>
      padding(padding.top = 3, padding.bottom = 3, padding.left = 0)
    doc <- body_add_flextable(doc, ft, align = "left"); doc <- body_add_par(doc, "")
  }
  doc
}
seccion_ej <- function(d) { d <- body_add_par(d, "4.1. Misión y propósitos", style = "heading 2")
  body_add_fpar(d, fpar(ftext(paste("El texto del informe corre en 10.5 pt, alineado a la izquierda, con interlineado holgado. Cada sección abre con un párrafo que dice qué se encontró,",
    "y luego vienen los gráficos con su rótulo, su base y su lectura."), fp_text(font.family = FONT, font.size = 10.5, color = TXT)), fp_p = fp_par(line_spacing = 1.3))) }
# ---- recuadro «Cómo leer este informe»
recuadro <- function(doc, titulo, lineas) {
  ft <- flextable(data.frame(a = "")) |> delete_part("header") |> border_remove() |> width(j = 1, width = ANCHO_W) |> bg(bg = "#F3F5F8") |>
    compose(j = 1, value = do.call(as_paragraph, c(list(as_chunk(titulo, props = fp_text(font.family = FONT, font.size = 10, color = NAVY, bold = TRUE))),
      unlist(lapply(lineas, function(l) list("\n", as_chunk(l, props = fp_text(font.family = FONT, font.size = 9.5, color = TXT)))), recursive = FALSE)))) |>
    hline_top(border = fp_border(color = NAVY, width = 1)) |> padding(padding = 10) |> line_spacing(space = 1.3)
  doc <- body_add_flextable(doc, ft, align = "left"); body_add_par(doc, "")
}
LEER_EJ <- c("Los porcentajes se calculan sobre quienes respondieron cada pregunta. La base va debajo de cada gráfico.",
             "Top Two Box es la suma de las dos respuestas de acuerdo de la escala.",
             "Con menos de 30 casos, junto al porcentaje va el número de personas entre paréntesis.")
# ---- contraportada: el logo al centro y el contacto debajo, en una línea
contraportada <- function(doc) {   # en la guía, la sección anterior ya cerró con salto de página
  for (k in 1:14) doc <- body_add_par(doc, "")
  doc <- body_add_fpar(doc, fpar(external_img(L8$f, width = 1.0 * L8$asp, height = 1.0), fp_p = fp_par(text.align = "center")))
  doc <- parr(doc, tx("pulsopucp@pucp.edu.pe     Av. Universitaria 1801, San Miguel, Lima 32, Perú     pulso.pucp.edu.pe", 8.5, SOFT), align = "center", before = 24)
  doc
}
# ---- miniaturas: cada alternativa se arma como un docx de verdad, con estos mismos estilos, y se muestra su primera página
mini <- function(nombre, construir, derecha = "Diseño metodológico") { d <- construir(nuevo_doc(derecha)); f <- file.path(TMP, paste0("mini_", nombre, ".docx")); print(d, target = f); f }
mini_png <- function(docs, pagina = 1, res = 90, paginas = rep(pagina, length(docs))) {
  system2("soffice", c("--headless", "--convert-to", "pdf", "--outdir", shQuote(TMP), shQuote(docs)), stdout = FALSE, stderr = FALSE)
  vapply(seq_along(docs), function(i) { f <- docs[i]; pdf <- sub("\\.docx$", ".pdf", f); o <- paste0(sub("\\.docx$", "", f), "_", res, "_", paginas[i])
    system2("pdftoppm", c("-png", "-r", res, "-f", paginas[i], "-l", paginas[i], "-singlefile", shQuote(pdf), shQuote(o)))
    im <- magick::image_border(magick::image_read(paste0(o, ".png")), "#C9CED8", "2x2"); magick::image_write(im, paste0(o, ".png")); paste0(o, ".png") }, "")
}
galeria <- function(doc, pngs, rotulos, por_fila = 3) {   # miniaturas de página A4 en fila, con su rótulo debajo
  w <- (ANCHO_W - 0.25 * (por_fila - 1)) / por_fila; h <- w * 11.69 / 8.27
  n <- length(pngs); filas <- ceiling(n / por_fila)
  for (f in seq_len(filas)) { idx <- ((f - 1) * por_fila + 1):min(n, f * por_fila)
    df <- as.data.frame(matrix("", nrow = 2, ncol = length(idx))); ft <- flextable(df) |> delete_part("header") |> border_remove() |> width(width = w + 0.25)
    for (j in seq_along(idx)) ft <- ft |> compose(i = 1, j = j, value = as_paragraph(as_image(src = pngs[idx[j]], width = w, height = h))) |>
      compose(i = 2, j = j, value = as_paragraph(as_chunk(rotulos[idx[j]], props = fp_text(font.family = FONT, font.size = 9, color = NAVY, bold = TRUE))))
    ft <- ft |> padding(padding = 2) |> valign(valign = "top")
    doc <- body_add_flextable(doc, ft, align = "left") }
  body_add_par(doc, "")
}
