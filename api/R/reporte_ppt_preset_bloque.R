#' Normaliza un bloque de preset a la forma `list(args = ...)`
#'
#' Un bloque puede llegar de dos maneras: con las claves sueltas —`list(grosor
#' barras = 1, canvas_w_bars = 0.6)`— o ya envuelto en `args`. La normalizacion
#' antigua decidia por presencia: si habia `args`, devolvia el bloque tal cual;
#' si no, envolvia todo.
#'
#' El problema es el caso MIXTO, que es el que guarda la UI: un bloque con
#' claves sueltas Y ademas un `args`. Ahi se devolvia tal cual, y como el render
#' solo lee `$args`, **todas las claves sueltas se perdian sin aviso**. En el
#' preset de `barras_agrupadas` de Contabilidad se perdian ocho —`grosor_barras`,
#' `canvas_w_bars`, `alto_por_categoria`, `canvas_h_header_in`…— y llegaba una
#' sola: el analista configuraba y el mazo salia con los defaults.
#'
#' Se fusionan las dos fuentes. `args` gana sobre la clave suelta del mismo
#' nombre por ser la forma explicita.
#'
#' @name reporte_ppt_preset_bloque
NULL


#' @param x Bloque de preset, o `NULL`.
#' @return Lista con `args` y el resto de campos del bloque conservados.
#' @keywords internal
.preset_bloque_normalizado <- function(x) {
  if (is.null(x)) return(list(args = list()))
  if (!is.list(x)) {
    .plan_input_abort("Cada preset debe ser una lista.")
  }

  args <- x$args
  if (is.null(args)) return(list(args = x))
  if (!is.list(args)) .plan_input_abort("`args` debe ser una lista.")

  sueltas <- x[setdiff(names(x), "args")]
  if (!length(sueltas)) return(x)

  # `args` manda: es la forma explicita, y una clave repetida en los dos sitios
  # significa que alguien la escribio ahi a proposito.
  fusion <- utils::modifyList(sueltas, args)
  out <- list(args = fusion)
  out
}
