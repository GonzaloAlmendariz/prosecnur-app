# Flujo y lectura del formulario en PDF (HSyVbG 2026, 2026-10-22: «no se ve del
# todo bien»). Solo PRESENTACION del renderer PDF: no toca el modelo, ni la
# numeracion, ni el orden de los bloques, ni el Word.
#
#   1. Bloque solo en su tramo de dos columnas. Entre dos bloques de ancho
#      completo, un unico bloque de media columna dejaba la otra media vacia y un
#      divisor al lado de nada («Recuerda que esta encuesta es completamente
#      anonima», P62). No hay nada que equilibrar: va a ancho completo.
#   2. Condicion de apertura envuelta por ANCHO MEDIDO. Se envolvia por conteo de
#      caracteres calibrado para una sans normal; con la estrecha (item 22) el
#      filtro cortaba a media columna y ocupaba el doble de lineas.
#   3. Codigo de opcion en la MISMA linea base que su etiqueta. El codigo se
#      centraba a una altura fija y la etiqueta colgaba de su tope: el numero
#      quedaba ~1 pt mas abajo que el texto.
#   4. Nota informativa larga (un consentimiento) en redonda, con interlinea mas
#      abierta. Toda nota se componia en negrita; en un parrafo de 2.000
#      caracteres eso es un bloque negro ilegible, y ademas anulaba las negritas
#      que el autor puso a proposito (que en redonda SI se ven).

# --- 1. bloque solo en su tramo ------------------------------------------------

# TRUE si el bloque `i` es el unico de media columna entre dos de ancho completo
# (o el borde del documento). Las bandas de seccion no cuentan como contenido:
# siempre son de ancho completo.
.form_pdf_bloque_solo <- function(blocks, i) {
  b <- blocks[[i]]
  if (isTRUE(b$full_width)) return(FALSE)
  if (!identical(b$kind %||% "", "question")) return(FALSE)
  antes <- i == 1L || isTRUE(blocks[[i - 1L]]$full_width)
  despues <- i == length(blocks) || isTRUE(blocks[[i + 1L]]$full_width)
  antes && despues
}

# Los bloques que el renderer PDF dibuja: los del modelo, con el bloque solo de
# su tramo pasado a ancho completo. Copia: el modelo (que comparte el Word) no se
# toca.
.form_pdf_flujo_bloques <- function(blocks) {
  if (!length(blocks)) return(blocks)
  solos <- vapply(seq_along(blocks), function(i) .form_pdf_bloque_solo(blocks, i), logical(1))
  for (i in which(solos)) blocks[[i]]$full_width <- TRUE
  blocks
}

# --- 2. condicion de apertura ---------------------------------------------------

# Lineas de la condicion de apertura a ancho `w` del bloque: el texto se dibuja
# en `x + 0.008` con `w - 0.016` disponibles. Sin dispositivo (medicion
# imposible) `.form_pdf_wrap_fit` cae al conteo de caracteres.
.form_pdf_apertura_lineas <- function(text, w) {
  if (!nzchar(text %||% "")) return(character(0))
  .form_pdf_wrap_fit(text, w - 0.020, fontsize = 7.3, fontface = "italic")
}

# --- 3. codigo en la linea base de la etiqueta -------------------------------------

# Alto, en npc, que R baja desde `y` hasta la linea base cuando justifica un
# texto arriba: la ascendente de la «M» con ese cuerpo y ese peso (el motor
# grafico de R justifica en vertical con la metrica de la «M», en puntos enteros
# del dispositivo, asi que no es proporcional al cuerpo).
.form_pdf_ascendente <- function(fontsize, fontface = "plain") {
  tryCatch(
    grid::convertHeight(grid::grobAscent(grid::textGrob(
      "M", gp = grid::gpar(fontsize = fontsize, fontface = fontface))), "npc", valueOnly = TRUE),
    error = function(e) 0.75 * fontsize / 842)
}

# `y` (justificado arriba) para un codigo de cuerpo `code_fs` en negrita cuya
# linea base tiene que coincidir con la de una etiqueta de cuerpo `label_fs`
# justificada arriba en `y_label`.
.form_pdf_codigo_y <- function(y_label, code_fs, label_fs = 7.9) {
  y_label - .form_pdf_ascendente(label_fs, "plain") + .form_pdf_ascendente(code_fs, "bold")
}

# --- 4. nota larga ----------------------------------------------------------------

# Desde cuantos caracteres una nota es un parrafo informativo y no un rotulo.
.FORM_PDF_NOTA_LARGA_CHARS <- 600L
# Interlinea de la nota larga (8.4 pt): 0.0158 npc son 13.3 pt, 1.58 del cuerpo.
.FORM_PDF_NOTA_LARGA_LINE_H <- 0.0158

.form_pdf_nota_larga <- function(block) {
  identical(block$kind %||% "", "question") && identical(block$type %||% "", "note") &&
    nchar(.form_pdf_sin_marcas(.form_pdf_clean_text_safe(block$label %||% ""))) >= .FORM_PDF_NOTA_LARGA_CHARS
}

# Peso e interlinea del enunciado de un bloque de pregunta o nota.
.form_pdf_enunciado_estilo <- function(block) {
  if (.form_pdf_nota_larga(block)) {
    list(face = "plain", base_b = FALSE, line_h = .FORM_PDF_NOTA_LARGA_LINE_H)
  } else {
    list(face = "bold", base_b = TRUE, line_h = 0.0142)
  }
}

# --- 5. nota de ancho completo que abre un tramo de dos columnas --------------------

# Una nota de ancho completo seguida de un bloque de media columna es la entrada
# de ese tramo («Durante el año 2026, ¿experimentaste alguna de las siguientes
# situaciones...?» y debajo P15). Si el primer bloque no cabe al pie, la nota se
# quedaba sola al final de la pagina y el tramo empezaba en la siguiente. Se le
# exige alto para ella y ese primer bloque (a ancho de columna); si la pareja no
# cabe ni en una pagina entera, no se exige nada.
.form_pdf_arrastre_nota <- function(blocks, bi, h, keep, alto_util, medir_col) {
  b <- blocks[[bi]]
  es_nota <- function(x) identical(x$kind %||% "", "question") && identical(x$type %||% "", "note")
  # Una banda cuya siguiente es esa nota arrastra tambien el primer bloque del
  # tramo: si no, la banda quedaba sola al pie con su filtro (p. 3).
  if (identical(b$kind %||% "", "section") && bi + 2L <= length(blocks) &&
      es_nota(blocks[[bi + 1L]]) && isTRUE(blocks[[bi + 1L]]$full_width) &&
      !isTRUE(blocks[[bi + 2L]]$full_width)) {
    total <- keep + medir_col(blocks[[bi + 2L]])
    return(if (total > alto_util) keep else total)
  }
  if (!es_nota(b)) return(keep)
  if (bi >= length(blocks) || isTRUE(blocks[[bi + 1L]]$full_width)) return(keep)
  total <- h + medir_col(blocks[[bi + 1L]])
  if (total > alto_util) keep else max(keep, total)
}
