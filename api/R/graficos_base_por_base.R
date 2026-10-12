# Palabra que sigue al número en el texto de la base cuando el informe usa varias bases («Base: 172 estudiantes»).
# Antes salía siempre el nombre interno de la base; ahora el usuario elige la palabra de cada una en Estilo del
# informe › Base y notas (`presets$base$sufijo_por_base`, nombre de la base → palabra). Una base sin palabra propia
# sigue mostrando su nombre. Se fija como opción durante la exportación, igual que «Casos junto al porcentaje».

#' Fija las palabras por base declaradas en los presets; devuelve las opciones previas para restaurarlas
#' @keywords internal
.base_sufijos_fijar <- function(presets) {
  declarado <- presets$base$args$sufijo_por_base %||% presets$base$sufijo_por_base
  if (!is.list(declarado) && !is.character(declarado)) return(list())
  limpio <- list()
  for (nm in names(declarado)) {
    v <- trimws(as.character(declarado[[nm]] %||% "")[1])
    if (nzchar(nm) && !is.na(v) && nzchar(v)) limpio[[nm]] <- v
  }
  options(prosecnur.base_sufijos = limpio)
}

#' La palabra de una base: la elegida por el usuario o, si no hay, el nombre de la base
#' @keywords internal
.base_sufijo_de_fuente <- function(src) {
  propio <- getOption("prosecnur.base_sufijos", list())[[src]]
  if (is.character(propio) && length(propio) == 1L && nzchar(propio)) propio else src
}
