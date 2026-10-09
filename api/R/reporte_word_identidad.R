# =============================================================================
# reporte_word_identidad.R — estilos y página del informe Word del recetario (N8.1)
# =============================================================================
#
# El recetario de Word (`docs/qa/motor-ppt-2026-10-06/4-recetario/propuesta-word.docx`, generado por
# `herramientas/recetario_word_identidad.R:17-57`) usa un solo juego de estilos semánticos y ningún formato directo en el
# cuerpo; A4 con márgenes de 1.1 / 0.9 / 1.0 in y un ancho útil de 6.27 in. Todo valor sale de los tokens Word del
# estándar (`.std_word`). El documento lo arma `reporte_word_documento.R`; aquí sólo la identidad.

#' Id de un estilo por su nombre en la plantilla abierta
#'
#' La plantilla de officer nombra los estilos en inglés pero sus ids son franceses («Titre1», «TM1»); un id fijo se
#' rompe con otra plantilla. Si el estilo no existe, el id es el nombre sin espacios (estilo nuevo).
#' @keywords internal
.word_estilo_id <- function(doc, nombre) {
  si <- officer::styles_info(doc)
  id <- si$style_id[tolower(si$style_name) == tolower(nombre)]
  if (length(id)) id[1] else gsub("[^A-Za-z0-9]", "", .ade_sin_tildes(nombre))
}

#' Aplica los estilos del recetario al documento
#' @keywords internal
.word_estilos <- function(doc) {
  f <- .std_word("tipografia", "fuente"); pt <- function(n) .std_word("tipografia", n)
  navy <- .std_word("colores", "titulos"); txt <- .std_word("colores", "texto"); suave <- .std_word("colores", "suave")
  ancho <- .std_word("pagina", "ancho_util")
  ft <- function(size, color, bold = FALSE) officer::fp_text(font.family = f, font.size = size, color = color, bold = bold)
  par <- function(nombre, fp_p, fp_t) officer::docx_set_paragraph_style(doc, style_id = .word_estilo_id(doc, nombre), style_name = nombre, fp_p = fp_p, fp_t = fp_t)
  tab <- officer::fp_tabs(officer::fp_tab(pos = ancho, style = "right"))
  doc <- par("heading 1", officer::fp_par(padding.top = 0, padding.bottom = 8, keep_with_next = TRUE,
                                          border.bottom = officer::fp_border(color = navy, width = 0.75)), ft(pt("titulo_1"), navy, TRUE))
  doc <- par("heading 2", officer::fp_par(padding.top = 16, padding.bottom = 6, keep_with_next = TRUE), ft(pt("titulo_2"), navy, TRUE))
  doc <- par("Rótulo de gráfico", officer::fp_par(text.align = "left", padding.top = 10, padding.bottom = 4, keep_with_next = TRUE, line_spacing = 1.15),
             ft(pt("rotulo"), txt))
  doc <- officer::docx_set_character_style(doc, style_id = .word_estilo_id(doc, "Número de rótulo"), style_name = "Número de rótulo",
                                           base_on = "Default Paragraph Font", fp_t = ft(pt("rotulo"), navy, TRUE))
  doc <- par("Base y fuente", officer::fp_par(text.align = "center", padding.top = 2, padding.bottom = 10, line_spacing = 1.1), ft(pt("base"), suave))
  doc <- par("Base y fuente con lectura", officer::fp_par(text.align = "center", padding.top = 2, padding.bottom = 10, line_spacing = 1.1, keep_with_next = TRUE),
             ft(pt("base"), suave))
  doc <- par("Lectura", officer::fp_par(text.align = "justify", line_spacing = 1.3, padding.top = 2, padding.bottom = 14), ft(pt("lectura"), txt))
  doc <- par("Número de capítulo", officer::fp_par(text.align = "left", padding.bottom = 0, keep_with_next = TRUE), ft(pt("numero_capitulo"), suave, TRUE))
  doc <- par("Lista de la guía", officer::fp_par(text.align = "justify", line_spacing = 1.3, padding.left = 10, padding.bottom = 5), ft(pt("cuerpo"), txt))
  doc <- par("Referencia", officer::fp_par(text.align = "left", line_spacing = 1.3, padding.bottom = 8), ft(10, txt))
  # El índice que arma Word usa «toc 1» y «toc 2»: capítulo en negrita azul y sección sangrada.
  doc <- par("toc 1", officer::fp_par(padding.top = 9, padding.bottom = 2, tabs = tab), ft(pt("toc_1"), navy, TRUE))
  par("toc 2", officer::fp_par(padding.left = 16, padding.bottom = 2, tabs = tab), ft(pt("toc_2"), txt))
}

#' Propiedades de sección del recetario: A4, márgenes y encabezado/pie a 0.4 in
#' @keywords internal
.word_props_pagina <- function(header_default = .word_vacio(), footer_default = .word_vacio(), header_first = NULL, footer_first = NULL,
                               type = "nextPage") {
  g <- function(n) .std_word("pagina", n)
  officer::prop_section(
    page_size = officer::page_size(width = g("ancho"), height = g("alto")),
    page_margins = officer::page_mar(top = g("margen_sup"), bottom = g("margen_inf"), left = g("margen_izq"), right = g("margen_der"),
                                     header = g("encabezado"), footer = g("pie")),
    type = type, header_default = header_default, footer_default = footer_default, header_first = header_first, footer_first = footer_first)
}

#' Encabezado interior: el título corto del informe a la izquierda y el capítulo a la derecha, sobre un filete
#' @keywords internal
.word_cabecera <- function(derecha, titulo_corto) {
  f <- .std_word("tipografia", "fuente")
  officer::block_list(officer::fpar(
    officer::ftext(titulo_corto %||% "", officer::fp_text(font.family = f, font.size = 8, color = .std_word("colores", "suave"))),
    officer::run_tab(),
    officer::ftext(derecha %||% "", officer::fp_text(font.family = f, font.size = 8, color = .std_word("colores", "titulos"), bold = TRUE)),
    fp_p = officer::fp_par(tabs = officer::fp_tabs(officer::fp_tab(pos = .std_word("pagina", "ancho_util"), style = "right")), padding.bottom = 4,
                           border.bottom = officer::fp_border(color = .std_word("colores", "filete"), width = 0.5))))
}

#' Pie interior: el folio (campo PAGE) a la derecha
#' @keywords internal
.word_pie <- function() {
  officer::block_list(officer::fpar(officer::run_word_field("PAGE", prop = officer::fp_text(font.family = .std_word("tipografia", "fuente"), font.size = 8.5,
                                                                                            color = .std_word("colores", "titulos"), bold = TRUE)),
                                    fp_p = officer::fp_par(text.align = "right")))
}

#' Bloque vacío para encabezados y pies sin contenido
#' @keywords internal
.word_vacio <- function() officer::block_list(officer::fpar(officer::ftext("")))

#' Documento nuevo con la identidad del recetario
#'
#' La sección por defecto es la última del documento (la contraportada en el informe): va sin encabezado ni pie. Las
#' secciones de capítulo las cierra `reporte_word_documento.R` con `.word_props_pagina` y su encabezado.
#' @keywords internal
.word_documento_nuevo <- function() {
  doc <- .word_estilos(officer::read_docx())
  officer::body_set_default_section(doc, .word_props_pagina(type = "nextPage"))
}
