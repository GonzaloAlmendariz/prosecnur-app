# =============================================================================
# graficos_rotulo_de_fila.R: el enunciado de una pregunta del instrumento para el plan de gráficos
# =============================================================================
#
# Ítem 48 (checklist-validacion-practicante, RMS 2026 con la plantilla ACNUR): una pregunta recodificada en Codificación
# ("REF16_recod") llega con el nombre de la variable en `label` ("REF16") y el enunciado en `label::Español (es)`. El plan
# tomaba sólo `label` y la lámina salía titulada "REF16". Si `label` está vacío o repite el nombre de la variable (o el
# de la pregunta de origen), se usa la primera columna de idioma con texto, el español primero. Sin ninguna, queda lo que
# había.

#' Enunciado de la fila `i` del instrumento
#' @param survey Hoja `survey` del instrumento (data frame).
#' @param i Fila.
#' @param nm Nombre de la variable de la fila.
#' @return Texto del enunciado; el nombre de la variable sólo si el instrumento no trae otro.
#' @keywords internal
.graficos_rotulo_de_fila <- function(survey, i, nm) {
  nombres <- unique(c(nm, sub("_recod$", "", nm)))
  util <- function(x) nzchar(x) && !(x %in% nombres)
  propio <- if ("label" %in% names(survey)) .graficos_scalar_chr(survey[["label"]][i], "") else ""
  if (util(propio)) return(propio)
  cols <- grep("^label::", names(survey), value = TRUE)
  cols <- cols[order(!grepl("espa|spanish|\\(es\\)", cols, ignore.case = TRUE))]
  for (cc in cols) {
    v <- .graficos_scalar_chr(survey[[cc]][i], "")
    if (util(v)) return(v)
  }
  if (nzchar(propio)) propio else nm
}
