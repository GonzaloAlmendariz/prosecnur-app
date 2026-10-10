# =============================================================================
# reporte_plan_etiquetas_cortas.R — etiqueta corta de una pregunta o premisa en la lámina (K12a, dirección F6 §4.3c)
# =============================================================================
#
# Un enunciado de tres o cuatro líneas parte la lámina en «(cont.)»; el analista lo resuelve con una etiqueta corta,
# que es contenido de la lámina: el instrumento no cambia. El canal ya existía en las multi-apiladas por variable
# (`overrides$etiquetas_vars`, al que el constructor traduce `titulos_grupo`), pero el motor no lo oía en ningún otro
# gráfico: el rótulo de la variable sale de `.title_of_var` (reporte_plan_ppt.R), que le pasaba `labels_override = NULL`
# a `titulo_var`. Aquí el mismo `overrides$etiquetas_vars` de cualquier gráfico —{variable: etiqueta}— vale mientras
# se dibuja ese gráfico (`.plan_render_element_degradable`), cuando un compositor pide el rótulo del panel
# (`.plan_titulo_corto`) y cuando el Word titula la figura (`.word_title_for_element`); `.title_of_var` lo consulta.
# El Word lo hereda del mismo motor (`reporte_ppt_plan(solo_lista = TRUE)`).
#
# La clave es la variable (`p13`) o la referencia calificada de una base (`docentes$p13`); la calificada sólo vale
# para su base y gana a la simple.

#' Etiquetas cortas declaradas por un elemento del plan
#'
#' @return Lista nombrada {referencia: etiqueta} sin vacíos; vacía si el elemento no declara ninguna.
#' @keywords internal
.plan_etiquetas_cortas_de <- function(el) {
  m <- if (is.list(el)) (el$overrides %||% list())$etiquetas_vars else NULL
  if (is.null(m) || !length(m) || is.null(names(m))) return(list())
  m <- lapply(m, function(x) { x <- as.character(unlist(x))[1]; if (length(x) && !is.na(x) && nzchar(trimws(x))) x else NULL })
  m <- m[!vapply(m, is.null, logical(1)) & nzchar(trimws(names(m)))]
  stats::setNames(m, trimws(names(m)))
}

#' Evalúa `expr` (el dibujo de un elemento) con sus etiquetas cortas vigentes
#'
#' Un elemento anidado suma las suyas a las del que lo contiene. La opción vuelve a su valor al salir: nada queda
#' puesto para el elemento siguiente ni para el proceso.
#' @keywords internal
.plan_con_etiquetas_cortas <- function(el, expr) {
  propias <- .plan_etiquetas_cortas_de(el)
  if (!length(propias)) return(expr)
  viejo <- options(prosecnur.plan_etiquetas_cortas = utils::modifyList(getOption("prosecnur.plan_etiquetas_cortas") %||% list(), propias))
  on.exit(options(viejo), add = TRUE)
  expr
}

#' Rótulo de la variable de un gráfico con sus etiquetas cortas (para los compositores, que lo piden fuera del dibujo)
#' @keywords internal
.plan_titulo_corto <- function(titulo_de_var, el) .plan_con_etiquetas_cortas(el, titulo_de_var(el$var))

#' Etiquetas cortas vigentes para las variables de una base, en la forma de `labels_override` de `titulo_var`
#'
#' @param source Base de la variable (`NA` o vacío en una sola base).
#' @return Lista nombrada por variable sin calificar, o `NULL` si no hay ninguna (el rótulo sale del instrumento).
#' @keywords internal
.plan_etiquetas_cortas_vigentes <- function(source = NULL) {
  m <- getOption("prosecnur.plan_etiquetas_cortas")
  if (!length(m)) return(NULL)
  claves <- names(m)
  calificada <- grepl("$", claves, fixed = TRUE)
  out <- m[!calificada]
  src <- as.character(source %||% NA_character_)[1]
  if (!is.na(src) && nzchar(src) && any(calificada)) {
    de_esta <- calificada & startsWith(claves, paste0(src, "$"))
    propias <- stats::setNames(m[de_esta], substring(claves[de_esta], nchar(src) + 2L))
    out <- utils::modifyList(out, propias)
  }
  if (length(out)) out else NULL
}
