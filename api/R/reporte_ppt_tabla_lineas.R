#' Lineas que ocupa de verdad una celda de la tabla tecnica
#'
#' El alto de cada fila se repartia pesando por NUMERO DE CARACTERES. Eso mide
#' bien un parrafo corrido y mide mal una celda con saltos: en la ficha tecnica
#' de Contabilidad, «Tipo y tecnica» —338 caracteres de un tiron— se llevaba
#' 4.56 cm, y «Muestra» —cuatro publicos, uno por linea, 94 caracteres— se
#' quedaba con 1.24 cm y no cabia.
#'
#' Lo que ocupa una celda son sus LINEAS: cada salto explicito empieza una, y
#' cada parrafo largo se parte en tantas como haga falta. Un salto no suma
#' caracteres pero sí suma alto.
#'
#' @name reporte_ppt_tabla_lineas
NULL


# Caracteres que caben en una linea de la columna ancha, a cuerpo 14-15 en una
# tabla de ~25 cm. Es la misma referencia que usaba el peso por caracteres.
.TABLA_CHARS_POR_LINEA <- 92


#' Lineas que ocupa un texto con saltos
#'
#' @param texto Texto de la celda; `\n` separa lineas.
#' @param chars_linea Caracteres que caben en una linea.
#' @return Numero de lineas, minimo 1.
#' @keywords internal
.tabla_lineas_celda <- function(texto, chars_linea = .TABLA_CHARS_POR_LINEA) {
  t <- as.character(texto %||% "")[1]
  if (is.na(t)) t <- ""
  cl <- suppressWarnings(as.numeric(chars_linea)[1])
  if (!is.finite(cl) || cl <= 0) cl <- .TABLA_CHARS_POR_LINEA

  partes <- strsplit(t, "\n", fixed = TRUE)[[1]]
  if (!length(partes)) return(1L)
  # Una linea vacia sigue ocupando su alto: `max(1, ...)` por parte.
  as.integer(sum(vapply(partes, function(p) {
    max(1L, as.integer(ceiling(nchar(p, type = "width") / cl)))
  }, integer(1))))
}


#' Peso de una fila para repartir el alto de la tabla
#'
#' @param criterio Texto de la primera columna.
#' @param detalle Texto de la columna ancha.
#' @param chars_linea Caracteres por linea de la columna ancha.
#' @keywords internal
.tabla_peso_fila <- function(criterio, detalle,
                             chars_linea = .TABLA_CHARS_POR_LINEA) {
  # La primera columna es estrecha: se le da su propia referencia, mas corta.
  max(
    .tabla_lineas_celda(criterio, chars_linea = 18),
    .tabla_lineas_celda(detalle, chars_linea = chars_linea)
  )
}
