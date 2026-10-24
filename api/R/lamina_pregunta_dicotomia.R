# La pregunta que encabeza el panel de la dicotomía partida (lámina «Sí/No de un público»).
#
# CCSS Perfil 2026 (informe, láminas 14, 21, 22 y 54): `p_dicotomica(titulo = "Gestión del colegio")` mostraba el enunciado
# completo del instrumento terminado en «(Recodificada)». El `titulo` que el analista declara en el gráfico manda; sin él,
# el enunciado sale sin el sufijo « (Recodificada)» que añade la recodificación (el Word ya lo quita en
# `.word_clean_inferred_title`).

#' Quita de un enunciado el sufijo « (Recodificada)» que añade la recodificación
#' @keywords internal
.lam_quitar_sufijo_recodificada <- function(x) {
  if (is.null(x) || !length(x)) return(x)
  gsub("\\s*\\(\\s*Recodificada\\s*\\)\\s*$", "", as.character(x), ignore.case = TRUE, perl = TRUE)
}

#' Pregunta del panel de la dicotomía: el `titulo` del gráfico o, si no hay, el enunciado sin «(Recodificada)»
#'
#' @param el_plot Elemento del plan (`ppt_element`).
#' @param titulo_de_var Función `(ref)` -> enunciado de la variable.
#' @return Texto, o `NULL` si no hay nada que mostrar.
#' @keywords internal
.lam_pregunta_dicotomia <- function(el_plot, titulo_de_var) {
  texto <- function(x) { x <- trimws(as.character(x %||% "")[1]); if (is.na(x) || !nzchar(x)) NULL else x }
  propio <- texto((el_plot$overrides %||% list())$titulo) %||% texto(el_plot$title_slide)
  if (!is.null(propio)) return(texto(.lam_quitar_sufijo_recodificada(propio)))
  if (!is.function(titulo_de_var) || is.null(el_plot$var)) return(NULL)
  q <- tryCatch(texto(.plan_titulo_corto(titulo_de_var, el_plot)), error = function(e) NULL)
  texto(.lam_quitar_sufijo_recodificada(q))
}
