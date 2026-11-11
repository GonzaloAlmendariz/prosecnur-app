# =============================================================================
# graficos_filas_estructurales.R — filas del formulario que se declaran select_one pero no son preguntas del informe
# =============================================================================
#
# El plan sugerido toma toda select_one con datos por una pregunta cerrada graficable. Dos formas de XLSForm no lo son
# (checklist-informe-acnur-2026-11-11, D7 y D8):
#
# - La fila de encabezados de una tabla de preguntas (`appearance = label`, con las filas en `list-nolabel`). Sólo
#   muestra las opciones; no tiene etiqueta y casi no tiene datos. El RMS 2026 sacaba una lámina sin título (`DIS01a`).
# - La select_one cuyas opciones salen de un grupo repetible (`select_one ${HH01_2_aux}`): las opciones son los nombres
#   de los miembros del hogar. Por ser "cerrada" se saltaba el filtro de identificadores y el informe graficaba los
#   nombres de las personas ("Nombre del encuestado(a)", RMS 2026).

#' ¿La fila del survey es el encabezado de una tabla de preguntas? (`appearance` con el token `label`)
#'
#' Sólo el token exacto: `list-nolabel` (las filas de la tabla, que sí son preguntas) no cuenta.
#' @keywords internal
.graficos_es_encabezado_tabla <- function(survey, i) {
  if (!is.data.frame(survey) || !"appearance" %in% names(survey)) return(FALSE)
  ap <- tolower(trimws(as.character(survey$appearance[[i]] %||% "")))
  if (is.na(ap) || !nzchar(ap)) return(FALSE)
  "label" %in% strsplit(ap, "[[:space:]]+")[[1]]
}

#' ¿Las opciones de la select salen de otro bloque del formulario? (`select_one ${campo}`)
#'
#' El lector del instrumento separa el tipo (`select_one`) de la lista (`${campo}`); se mira la lista y, si viene
#' sin separar, el tipo completo.
#' @keywords internal
.graficos_opciones_de_otro_bloque <- function(type, list_name = NULL) {
  ln <- trimws(as.character(list_name %||% "")[1])
  if (!is.na(ln) && startsWith(ln, "${")) return(TRUE)
  t <- as.character(type %||% "")[1]
  !is.na(t) && grepl("^\\s*select_(one|multiple)\\s+\\$\\{", t, perl = TRUE)
}
