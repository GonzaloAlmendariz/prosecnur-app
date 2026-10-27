# texto_espacio_duro.R — la cifra no se separa de su «%» ni «N°» de su número (C6, CCSS Perfil 2026, lámina 13).
#
# El título «… y 38 % es primera generación universitaria» se partía con «38» al final de una línea y «%» al comienzo
# de la siguiente: el espacio normal entre la cifra y su signo es un punto de corte. Se cambia por un espacio duro
# (U+00A0), que PowerPoint, LibreOffice y Word respetan, en el título y el subtítulo de la lámina (`.lam_titulo`) y en el
# rótulo de las figuras del Word (`.word_rotulo`). Sólo cambia el carácter del espacio: ni cifras ni palabras.

#' Une con espacio duro la cifra y su «%» y el «N°»/«N.°»/«Nº» y su número
#'
#' @param s Vector de textos (o `NULL`).
#' @return El mismo vector con esos espacios cambiados por U+00A0; `NA` y vacíos quedan igual.
#' @keywords internal
.texto_espacio_duro <- function(s) {
  if (!length(s)) return(s)
  nb <- " "
  s <- gsub("([0-9])[   ]+%", paste0("\\1", nb, "%"), s, perl = TRUE)
  # «N° 5», «N.° 12», «Nº 3»: el número que sigue; y al final del texto (el prefijo del rótulo del Word va antes del SEQ).
  s <- gsub("(\\bN\\.?[°º])[ ]+(?=[0-9]|$)", paste0("\\1", nb), s, perl = TRUE)
  s
}
