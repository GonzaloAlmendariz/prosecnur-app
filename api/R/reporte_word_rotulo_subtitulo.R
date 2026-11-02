# reporte_word_rotulo_subtitulo.R — el subtítulo de la lámina entra al rótulo Word de su figura
#
# Decisión (2026-11-02, Perfil CCSS 2026): en el PPT el subtítulo de `p_slide_1_grafico` es lo que distingue dos láminas
# de la misma batería («TikTok» y «YouTube», ambas «según sexo»); el Word lo perdía y las dos figuras salían con el mismo
# «Gráfico N° N: título». El rótulo pasa a «título — subtítulo», con el separador de `.word_titulo_bloque_multi` (el que
# ya usan los bloques de multiapiladas), sin repetir el subtítulo si el título ya lo trae. Sólo `p_slide_1_grafico`
# (la única lámina de un gráfico con subtítulo propio); el PPT no cambia.

#' Título del rótulo Word con el subtítulo de la lámina
#' @param titulo Título ya resuelto de la figura (puede ser vacío o el espacio duro de «sin título»).
#' @param subtitulo Subtítulo de la lámina o NULL.
#' @return Texto del título.
#' @keywords internal
.word_titulo_con_subtitulo <- function(titulo, subtitulo) {
  sub <- .word_rotulo_titulo(subtitulo)
  if (!nzchar(sub)) return(titulo)
  tit <- .word_rotulo_titulo(titulo)
  if (nzchar(tit) && grepl(tolower(sub), tolower(tit), fixed = TRUE)) return(titulo)
  .word_titulo_bloque_multi(tit, sub)
}
