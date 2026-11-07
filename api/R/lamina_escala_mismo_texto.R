# =============================================================================
# lamina_escala_mismo_texto.R — ¿el encabezado de un bloque de escala repite el título de la lámina?
# =============================================================================
#
# Una multiapilada `var` de una sola pregunta encabeza su barra con la pregunta; si esa pregunta ya es el título de la
# lámina, el encabezado la repetía (CCSS 2026). La comparación ignora tildes, mayúsculas, signos («¿?», puntos, comas)
# y espacios dobles: el título suele llevar los signos de interrogación y la etiqueta del instrumento, no.

#' ¿Dos textos dicen lo mismo, salvo tildes, mayúsculas, signos y espacios?
#' @keywords internal
.lam_mismo_texto <- function(a, b) {
  norm <- function(x) {
    x <- as.character(x %||% "")[1]
    if (is.na(x)) return("")
    trimws(gsub("\\s+", " ", gsub("[^a-z0-9 ]", " ", .lam_clave(x))))
  }
  na <- norm(a); nb <- norm(b)
  nzchar(na) && identical(na, nb)
}
