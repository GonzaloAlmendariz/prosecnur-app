# graficos_cobertura_publicos.R — la cobertura cuenta públicos, no las bases de una serie temporal
#
# Ola 2 (catálogo, recetario sintético): sin `bases` declaradas la cobertura tomaba todas las bases del estudio y listaba
# `estudiantes_2018` y `estudiantes_2021` como públicos sin barra. Son las ediciones anteriores de `estudiantes` (la base
# de una serie, lo que leen `p_serie_temporal` y el comparativo), no públicos de esta medición. Las bases declaradas se
# respetan tal cual.

#' Bases que son públicos: sin las ediciones anteriores de otra base (`<base>_<año>` cuando `<base>` existe)
#' @keywords internal
.cobertura_bases_publico <- function(bases) {
  bases <- as.character(bases)
  m <- regmatches(bases, regexec("^(.+)_((19|20)[0-9]{2})$", bases))
  de_serie <- vapply(m, function(x) length(x) >= 2L && x[2] %in% bases, TRUE)
  bases[!de_serie]
}
