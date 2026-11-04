# =============================================================================
# graficos_base_word.R — la figura del Word de una dona o un pie lleva su línea de base
# =============================================================================
#
# En el PPT la base de una dona o un pie va en la lámina, y `.base_auto_from_element_impl` (reporte_plan_ppt.R) la
# suprime para no repetirla junto al rótulo que el gráfico dibuja. El Word no tiene esa lámina: la figura se arma con
# rótulo, imagen y una línea «Base: … Fuente: …» que sale de `render_meta[[i]]$base`. Con la supresión, las donas del
# Word salían sin base (CCSS v6.2: 4 de 91 figuras, todas donas). Mientras se calcula la base de una figura del Word
# la supresión no aplica a donas y pies; las categóricas siguen igual porque ya llegan con su base por otro camino.

#' ¿Se está calculando la base de una figura del Word?
#' @keywords internal
.base_es_para_word <- function() isTRUE(getOption("prosecnur.base_para_word", FALSE))

#' Evalúa el cálculo de la base de una figura del Word sin la supresión de donas y pies
#' @keywords internal
.base_para_word <- function(expr) {
  previa <- options(prosecnur.base_para_word = TRUE)
  on.exit(options(previa), add = TRUE)
  expr
}
