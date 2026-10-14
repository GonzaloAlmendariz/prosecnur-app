# =============================================================================
# Rótulo de una sección: el título del grupo, no su nombre interno
# =============================================================================
# El XLSForm nombra cada grupo con una clave («pag2») y le da un título
# («Datos generales (p2-p6)»). Procesamiento mostraba la clave en los selectores
# de preguntas de Gráficos y de Equivalencias, así que el analista leía «Pag2»
# donde el formulario dice «Datos generales». Se resuelve aquí una sola vez.
# =============================================================================

#' Mapa clave de grupo -> título, leído de las filas `begin_group`/`begin_repeat`
#' @keywords internal
.inst_rotulos_de_grupo <- function(survey) {
  if (is.null(survey) || !NROW(survey) || !all(c("type", "name") %in% names(survey))) return(character(0))
  tipo <- tolower(trimws(sub("\\s.*$", "", as.character(survey$type))))
  es_grupo <- tipo %in% c("begin_group", "begin", "begin_repeat")
  if (!any(es_grupo)) return(character(0))
  claves <- as.character(survey$name)[es_grupo]
  col_label <- if ("label" %in% names(survey)) "label" else grep("^label", names(survey), value = TRUE)[1]
  titulos <- if (!is.na(col_label %||% NA)) as.character(survey[[col_label]])[es_grupo] else claves
  titulos <- trimws(gsub("<[^>]+>", "", titulos))
  sin_titulo <- is.na(titulos) | !nzchar(titulos)
  titulos[sin_titulo] <- claves[sin_titulo]
  keep <- !is.na(claves) & nzchar(claves) & !duplicated(claves)
  stats::setNames(titulos[keep], claves[keep])
}

#' Título de las secciones `claves` según `mapa`; lo que no es un grupo conocido queda igual
#' @keywords internal
.inst_rotulo_seccion <- function(claves, mapa) {
  claves <- as.character(claves)
  if (!length(mapa)) return(claves)
  hit <- !is.na(claves) & claves %in% names(mapa)
  claves[hit] <- unname(mapa[claves[hit]])
  claves
}
