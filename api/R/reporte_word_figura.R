# =============================================================================
# reporte_word_figura.R — la figura del informe Word del recetario: rótulo, imagen, base y lectura (N8.4)
# =============================================================================
#
# recetario_word.R:28-66. Todo lo que pone el motor es un estilo o un campo de Word, para que la posedición se haga desde
# Inicio > Estilos y la numeración se recalcule sola:
#   - rótulo «Gráfico N» (estilo de carácter «Número de rótulo» con campo SEQ) y, en la línea siguiente, el título en
#     cursiva, con el estilo «Rótulo de gráfico» (APA 7.ª); con el SEQ, Word arma el índice de gráficos;
#   - la imagen centrada, del ancho del texto y pegada a lo que sigue;
#   - la base y la fuente centradas, sin la palabra «Nota»; si hay lectura, no se separan de ella;
#   - la lectura con las cifras en negrita.

#' Run de texto con un estilo de carácter
#' @keywords internal
.word_run_estilo <- function(texto, estilo = NULL) structure(list(t = as.character(texto), sty = estilo), class = c("pulso_run_estilo", "run"))

#' Run con un campo SEQ (numeración de Word) y el número que se ve antes de actualizar
#' @keywords internal
.word_run_seq <- function(id, n, estilo = NULL) structure(list(id = id, n = n, sty = estilo), class = c("pulso_run_seq", "run"))

.word_xml_esc <- function(x) gsub(">", "&gt;", gsub("<", "&lt;", gsub("&", "&amp;", x, fixed = TRUE), fixed = TRUE), fixed = TRUE)
.word_rpr <- function(estilo) if (is.null(estilo)) "" else sprintf('<w:rPr><w:rStyle w:val="%s"/></w:rPr>', estilo)

#' @exportS3Method officer::to_wml
to_wml.pulso_run_estilo <- function(x, add_ns = FALSE, ...) {
  sprintf('<w:r>%s<w:t xml:space="preserve">%s</w:t></w:r>', .word_rpr(x$sty), .word_xml_esc(x$t))
}

#' @exportS3Method officer::to_wml
to_wml.pulso_run_seq <- function(x, add_ns = FALSE, ...) {
  r <- .word_rpr(x$sty)
  paste0('<w:r>', r, '<w:fldChar w:fldCharType="begin"/></w:r>',
         '<w:r>', r, '<w:instrText xml:space="preserve"> SEQ ', .word_xml_esc(x$id), ' \\* ARABIC </w:instrText></w:r>',
         '<w:r>', r, '<w:fldChar w:fldCharType="separate"/></w:r>',
         '<w:r>', r, '<w:t>', x$n, '</w:t></w:r>',
         '<w:r>', r, '<w:fldChar w:fldCharType="end"/></w:r>')
}

#' Rótulo de una figura o tabla: «Gráfico N» con SEQ y el título en cursiva en la línea siguiente
#' @keywords internal
.word_rotulo <- function(doc, n, titulo, etiqueta = "Gráfico") {
  num <- .word_estilo_id(doc, "Número de rótulo")
  officer::body_add_fpar(doc, officer::fpar(.word_run_estilo(paste0(etiqueta, " "), num), .word_run_seq(etiqueta, n, num), officer::run_linebreak(),
                                            officer::ftext(titulo %||% "", officer::fp_text_lite(italic = TRUE))),
                         style = "Rótulo de gráfico")
}

#' Base y fuente bajo la figura; con lectura, el estilo que no la separa de ella
#' @keywords internal
.word_base <- function(doc, texto, con_lectura = FALSE) {
  if (is.null(texto) || !nzchar(trimws(texto))) return(doc)
  officer::body_add_fpar(doc, officer::fpar(officer::ftext(trimws(texto))), style = if (isTRUE(con_lectura)) "Base y fuente con lectura" else "Base y fuente")
}

#' Lectura de la figura: las cifras (porcentajes, puntos) en negrita y el resto con el estilo
#' @keywords internal
.word_lectura <- function(doc, texto) {
  if (is.null(texto) || !nzchar(trimws(texto))) return(doc)
  texto <- trimws(texto)
  pos <- gregexpr("[0-9]+([.,][0-9]+)*( ?%| pts| puntos)?", texto)[[1]]; partes <- list(); k <- 1L
  if (pos[1] > 0) for (i in seq_along(pos)) {
    a <- pos[i]; b <- a + attr(pos, "match.length")[i] - 1L
    if (a > k) partes[[length(partes) + 1L]] <- officer::ftext(substr(texto, k, a - 1L))
    partes[[length(partes) + 1L]] <- officer::ftext(substr(texto, a, b), officer::fp_text_lite(bold = TRUE)); k <- b + 1L
  }
  if (k <= nchar(texto)) partes[[length(partes) + 1L]] <- officer::ftext(substr(texto, k, nchar(texto)))
  officer::body_add_fpar(doc, do.call(officer::fpar, partes), style = "Lectura")
}

#' Figura completa del recetario: rótulo, imagen centrada pegada a la base, base y, si la hay, la lectura
#'
#' @param png Imagen ya dibujada (fondo transparente).
#' @param ancho,alto Medidas de la imagen en pulgadas (el ancho útil del texto por defecto).
#' @keywords internal
.word_figura <- function(doc, n, titulo, png, alto, ancho = .std_word("pagina", "ancho_util"), base = NULL, lectura = NULL) {
  doc <- .word_rotulo(doc, n, titulo)
  doc <- officer::body_add_fpar(doc, officer::fpar(officer::external_img(png, width = ancho, height = alto),
                                                   fp_p = officer::fp_par(text.align = "center", keep_with_next = TRUE)))
  con_lectura <- !is.null(lectura) && nzchar(trimws(lectura))
  doc <- .word_base(doc, base, con_lectura = con_lectura)
  if (con_lectura) doc <- .word_lectura(doc, lectura)
  doc
}
