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
  # Sin palabra elegida, la clave de la base sin sus guiones bajos: «140 estudiantes 2018», no «estudiantes_2018»
  # (Gonzalo, 2026-10-14).
  if (is.character(propio) && length(propio) == 1L && nzchar(propio)) propio else gsub("_+", " ", trimws(src))
}

#' El nombre de una base tal como puede verse en una lámina
#'
#' «default» es el nombre INTERNO de la base única (o de la primera que el usuario no nombró): nunca se escribe en un
#' rótulo («325 default») ni en el pie («Base: 397 default»). Una base con nombre propio («docentes») sí se nombra.
#' Devuelve "" cuando el nombre no debe verse.
#' @keywords internal
.base_nombre_visible <- function(nombre) {
  x <- trimws(as.character(nombre %||% "")[1])
  if (is.na(x) || !nzchar(x) || identical(tolower(x), "default")) "" else x
}
