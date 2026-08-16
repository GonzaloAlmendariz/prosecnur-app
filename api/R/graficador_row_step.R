#' Paso entre filas de una barra apilada
#'
#' El paso crece cuando hay pocas categorias con etiquetas de eje largas: la
#' fila necesita alto para que quepa el texto. Eso esta bien en un grafico
#' suelto y es un problema en una lamina `multilista`, porque **cada bloque lo
#' decide por su cuenta**: en «Mecanismos de admision» el bloque de arriba
#' inflaba su paso y el de abajo no, y las barras salian a 1.19 y 0.90 cm sobre
#' la misma lamina —la fraccion era 0.33 contra 0.26—.
#'
#' Aqui el calculo vive aparte para poder pedirselo a todos los bloques ANTES de
#' renderizar ninguno, quedarse con el mayor y pasarselo a todos. Un paso comun
#' no cambia lo que cada bloque necesita para su texto: el mayor cubre al resto.
#'
#' @name graficador_row_step
NULL


# Paso base, sin inflar.
.ROW_STEP_BASE <- 1
# Paso base cuando las etiquetas van arriba de su barra.
.ROW_STEP_ETIQUETAS_ARRIBA <- 1.72
# Tope del inflado: por encima los bloques quedan a una distancia que se come
# la leyenda.
.ROW_STEP_TOPE <- 3.20


#' @param n_categorias Numero de filas del bloque.
#' @param max_lineas_eje_y Lineas de la etiqueta de eje mas larga.
#' @param etiquetas_arriba `TRUE` si las etiquetas van sobre la barra.
#' @return Paso entre filas, en unidades de la escala Y.
#' @keywords internal
.apiladas_row_step <- function(n_categorias, max_lineas_eje_y,
                               etiquetas_arriba = FALSE) {
  base <- if (isTRUE(etiquetas_arriba)) .ROW_STEP_ETIQUETAS_ARRIBA else .ROW_STEP_BASE

  n <- suppressWarnings(as.numeric(n_categorias)[1])
  lineas <- suppressWarnings(as.numeric(max_lineas_eje_y)[1])
  if (!is.finite(n) || !is.finite(lineas)) return(base)

  # Solo con POCAS categorias: con muchas, la fila ya es corta y el texto se
  # resuelve por otro lado.
  if (n > 4 || lineas < 5) return(base)
  max(base, min(.ROW_STEP_TOPE, 1.16 + lineas * 0.28))
}


#' Paso comun para un conjunto de bloques
#'
#' El mayor de todos: es el unico que cubre las necesidades de texto de cada
#' uno. Quedarse con el menor dejaria alguna etiqueta sin sitio.
#'
#' @param pasos Vector de pasos, uno por bloque.
#' @return El paso comun, o `NULL` si no hay ninguno utilizable.
#' @keywords internal
.apiladas_row_step_comun <- function(pasos) {
  p <- suppressWarnings(as.numeric(unlist(pasos)))
  p <- p[is.finite(p) & p > 0]
  if (!length(p)) return(NULL)
  max(p)
}
