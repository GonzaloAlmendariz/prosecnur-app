# =============================================================================
# reporte_word_texto.R — texto corrido, entradas y aperturas de capítulo del Word del recetario (N8.12)
# =============================================================================
#
# Portan `cuerpo()`, `gal()`/`seccion()` (recetario_word.R:28, 74, 334) y `apertura_A`/`apertura_B`
# (recetario_word_identidad.R:129-145). El recetario escribe cuerpo y entrada con formato directo (Arial 10.5, interlineado
# 1.3); aquí se conserva ese aspecto con `.word_parr()`. Las dos aperturas son variantes elegibles (N7).

#' Texto corrido del informe: 10.5 pt en el gris del texto, justificado, interlineado 1.3 y 8 pt después
#' @keywords internal
.word_cuerpo <- function(doc, texto, mantener = FALSE) {
  if (is.null(texto) || !nzchar(trimws(paste(texto, collapse = " ")))) return(doc)
  .word_parr(doc, list(paste(texto, collapse = " "), 10.5, .std_word("colores", "texto")), align = "justify", mantener = mantener)
}

#' Entrada de una sección: 10.5 pt en el gris suave, pegada a lo que sigue (`gal()`)
#' @keywords internal
.word_entrada <- function(doc, texto) {
  if (is.null(texto) || !nzchar(trimws(texto))) return(doc)
  .word_parr(doc, list(texto, 10.5, .std_word("colores", "suave")), mantener = TRUE)
}

#' Título de sección (título 2) con su número, como `seccion()`: «4.1. Misión y propósitos»
#' @keywords internal
.word_seccion <- function(doc, titulo, numero = NULL) {
  officer::body_add_par(doc, if (is.null(numero) || !nzchar(numero)) titulo else paste0(numero, ". ", titulo), style = "heading 2")
}

#' Apertura de capítulo en una de sus dos variantes
#'
#' A (sobria): «CAPÍTULO N» en su estilo, el título 1 y la entrada. B: el número grande de 60 pt en azul claro, el título 1,
#' la entrada de 11.5 pt y, si se dan, las secciones del capítulo entre filetes grises.
#' @keywords internal
.word_apertura <- function(doc, n, titulo, intro = "", secciones = character(), variante = c("B", "A")) {
  variante <- match.arg(variante)
  if (identical(variante, "A")) {
    doc <- officer::body_add_par(doc, paste("CAPÍTULO", n), style = "Número de capítulo")
    doc <- officer::body_add_par(doc, titulo, style = "heading 1")
    return(if (nzchar(intro)) .word_parr(doc, list(intro, 10.5, .std_word("colores", "texto")), despues = 10) else doc)
  }
  for (k in 1:2) doc <- officer::body_add_par(doc, "")
  doc <- .word_parr(doc, list(as.character(n), 60, "#C9D3E6", TRUE), despues = 0, mantener = TRUE)
  doc <- officer::body_add_par(doc, titulo, style = "heading 1")
  if (nzchar(intro)) doc <- .word_parr(doc, list(intro, 11.5, .std_word("colores", "texto")), antes = 4, despues = 12, mantener = length(secciones) > 0)
  if (length(secciones)) {
    filete <- officer::fp_border(color = .std_word("colores", "filete"), width = 0.5)
    ft <- flextable::flextable(data.frame(s = as.character(secciones))) |> flextable::delete_part("header") |> flextable::border_remove() |>
      flextable::width(j = 1, width = .std_word("pagina", "ancho_util")) |> flextable::font(fontname = .std_word("tipografia", "fuente"), part = "all") |>
      flextable::fontsize(size = 9.5) |> flextable::color(color = .std_word("colores", "titulos")) |>
      flextable::hline(border = filete) |> flextable::hline_top(border = filete) |>
      flextable::padding(padding.top = 3, padding.bottom = 3, padding.left = 0)
    doc <- flextable::body_add_flextable(doc, ft, align = "left"); doc <- officer::body_add_par(doc, "")
  }
  doc
}
