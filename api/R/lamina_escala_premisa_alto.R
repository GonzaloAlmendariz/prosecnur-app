# El alto de la premisa de una escala, medido con la tinta real (Gonzalo, 2026-10-28).
#
# `.lam_alto_txt` cuenta caracteres (0,56 del cuerpo por carácter en negrita) y sobreestima las líneas de un enunciado
# largo: en Arte, sin ensanchar la columna, la escala de cinco premisas de «Gestores… Administrativos» se partía en
# «(cont.)» dejando media lámina vacía. Aquí las líneas se cortan por palabras sobre el ancho de la tinta
# (`.lam_alto_tinta`, como compone PowerPoint), así la partición y el dibujo usan el alto que de verdad ocupa el texto.
# Sin `systemfonts` vuelve a la estimación por caracteres.

#' Alto del enunciado de una premisa (in) en el cuerpo de pregunta, en negrita
#' @keywords internal
.lam_alto_premisa_txt <- function(texto, w) {
  size <- .std_pt("pregunta")
  if (!requireNamespace("systemfonts", quietly = TRUE)) return(.lam_alto_txt(texto, w, size, TRUE))
  unname(.lam_alto_tinta(texto, w, size, TRUE)[[1]])
}
