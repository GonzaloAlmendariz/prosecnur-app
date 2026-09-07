# **Cuál columna es el sexo, y qué valor es cada sexo. Una vez.**
#
# Había CUATRO sitios adivinando la columna por su nombre —«sex», «sexo»,
# «genero»— y resolviendo la etiqueta con heurísticas de texto. En HSVG2026 la
# variable es `datos_demo/P2` y sus valores son «1» y «2», así que los cuatro
# fallaban a la vez y en silencio: el reparto por sexo salía vacío en las quince
# facultades, en las celdas de cuota y en el libro.
#
# El estudio DECLARA las dos cosas en su mapping (`sex_var`, `sex_female_values`,
# `sex_male_values`) y aquí se resuelven. La búsqueda por nombre se conserva de
# respaldo para un estudio que todavía no lo haya declarado; lo que no se hace
# nunca es adivinar QUÉ CÓDIGO es mujer, porque `sub_a` ya costó una lectura al
# revés y una cifra por sexo inventada es peor que ninguna.

#' La columna de sexo de las respuestas, según el estudio.
#'
#' @param responses `data.frame` de respuestas.
#' @param cfg config de aulas universitarias.
#' @return el nombre de la columna, o `""` si no hay ninguna.
#' @export
monitoreo_aulas_columna_sexo <- function(responses, cfg = list()) {
  if (!is.data.frame(responses) || !ncol(responses)) return("")
  declarada <- .monitoreo_scalar(
    ((cfg %||% list())[["source_mapping"]] %||% list())[["sex_var"]] %||% "", "")
  if (nzchar(declarada) && declarada %in% names(responses)) return(declarada)
  .monitoreo_aulas_col(responses, c("sex", "sexo", "genero", "género", "gender"))
}

#' De qué sexo es cada valor, según el estudio.
#'
#' @param valores vector de valores tal como vienen de la plataforma.
#' @param cfg config de aulas universitarias.
#' @return vector con `"F"`, `"M"` o `""`.
#' @export
monitoreo_aulas_sexo_key <- function(valores, cfg = list()) {
  mapping <- (cfg %||% list())[["source_mapping"]] %||% list()
  clave <- function(x) tolower(trimws(as.character(x)))
  fem <- clave(unlist(mapping[["sex_female_values"]] %||% list(), use.names = FALSE))
  masc <- clave(unlist(mapping[["sex_male_values"]] %||% list(), use.names = FALSE))
  out <- .maac_sexo_key(valores)
  k <- clave(valores)
  if (length(fem)) out[k %in% fem] <- "F"
  if (length(masc)) out[k %in% masc] <- "M"
  out
}
