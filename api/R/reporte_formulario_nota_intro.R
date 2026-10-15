# La nota que introduce un bloque ancho (item 17, checklist 2026-10-15).
#
# Una nota corta justo antes de una matriz (hsvg2026: «¿Has escuchado hablar de
# las siguientes instancias disciplinarias?» y debajo su bateria) quedaba en
# media columna, y la matriz a todo el ancho debajo: la nota cortaba el flujo de
# dos columnas para nada y la columna de al lado quedaba vacia o con otra cosa.
# Decision: la nota que precede a un bloque `full_width` es su INTRODUCCION —
# hereda `full_width` y va pegada a el (`keep_with_next`): keepNext en Word, y en
# el PDF el salto de pagina la lleva con su bloque.
#
# Solo PRESENTACION. No toca numeracion (las notas no numeran), ni el orden de
# los bloques, ni `n_questions` (B2: las notas no cuentan).
#
# Alcance: el bloque introducido es una matriz o una pregunta ancha (no una nota
# ancha suelta: una nota no introduce a otra nota). Una banda
# de seccion o de subseccion NO: una nota justo antes de `begin_group` es el
# cierre del grupo anterior («Gracias por su tiempo»), no la introduccion del
# siguiente, y pegarla a la banda la sacaria de su seccion. Varias notas
# seguidas antes del bloque heredan en cadena: son todas su introduccion.

.form_pdf_es_nota <- function(b) {
  identical(b$kind %||% "", "question") && identical(b$type %||% "", "note")
}

.form_pdf_nota_hereda_ancho <- function(blocks) {
  n <- length(blocks)
  if (n < 2L) return(blocks)
  for (i in rev(seq_len(n - 1L))) {
    sig <- blocks[[i + 1L]]
    # Se introduce una matriz o una PREGUNTA ancha; una nota ancha no introduce
    # nada por si sola, salvo que ella misma sea la introduccion de lo que sigue
    # (la cadena). Sin esto, «Gracias por su tiempo» (cierre de un filtro) se
    # pegaba a la nota larga siguiente solo por ser ancha.
    introducible <- isTRUE(sig$full_width) &&
      (identical(sig$kind %||% "", "matrix") ||
         (identical(sig$kind %||% "", "question") && !.form_pdf_es_nota(sig)) ||
         (.form_pdf_es_nota(sig) && isTRUE(sig$keep_with_next)))
    if (.form_pdf_es_nota(blocks[[i]]) && introducible) {
      blocks[[i]]$full_width <- TRUE
      blocks[[i]]$keep_with_next <- TRUE
    }
  }
  blocks
}

# Alto que un bloque ancho tiene que tener libre para no quedarse solo al pie:
# el suyo mas el de la cadena que arrastra. Una banda arrastra al bloque
# siguiente (L20); una nota-introduccion, al suyo; y si lo que sigue a una banda
# es una nota-introduccion, la banda arrastra nota Y bloque, o la banda podria
# quedarse con la nota mientras la matriz salta. Si la cadena no cabe ni en una
# pagina entera, saltar no arregla nada: se devuelve solo el alto propio.
.form_pdf_alto_arrastre <- function(blocks, bi, h, alto_util, medir) {
  # Desde el propio bloque arrastra una banda o una nota-introduccion; mas alla,
  # solo una nota-introduccion (banda -> subbanda -> ... sigue siendo L20 tal
  # cual: un paso).
  arrastra <- function(b, propio) {
    isTRUE(b$keep_with_next) ||
      (propio && (b$kind %||% "") %in% c("section", "subsection"))
  }
  total <- h
  k <- bi
  while (k < length(blocks) && (k - bi) < 3L && arrastra(blocks[[k]], k == bi)) {
    k <- k + 1L
    total <- total + medir(blocks[[k]])
  }
  if (total > alto_util) h else total
}

# Traza de geometria del render: no hace nada. Existe para que un test lea, con
# las coordenadas que el render ya conoce, donde cayo cada tramo del divisor y
# cada bloque de ancho completo (`tipo`, pagina, y de arriba, y de abajo).
.form_pdf_traza <- function(tipo, pagina, y_arriba, y_abajo) invisible(NULL)

# Aire entre el divisor de columnas y un bloque de ancho completo (npc, ~3.4 pt).
.FORM_PDF_DIVISOR_AIRE <- 0.004
