# =============================================================================
# lamina_filas_hueco.R — filas de alto distinto con el mismo hueco entre ellas (P15)
# =============================================================================
#
# Prueba con el resumen de Arte (2026-11-09, láminas 4 y 6): las filas de dos o tres líneas abrían huecos y las de una
# quedaban apretadas, porque cada fila tomaba un paso común o lo que pedía su rótulo, lo que fuera mayor. Lo que se ve
# es el hueco ENTRE filas (del final del rótulo de una al comienzo del de la siguiente), y ése debe ser el mismo en toda
# la lámina: cada fila mide su contenido más un hueco común, no un paso común.

#' Altos de filas con el mismo hueco entre ellas
#'
#' @param contenido Alto del contenido de cada fila (su rótulo o lo que dibuja, lo mayor), en pulgadas.
#' @param disponible Alto para todas las filas. @param hueco_min,hueco_max Hueco admitido entre dos filas.
#' @return `list(alturas, hueco)` (cada fila = contenido + hueco, con el contenido centrado) o `NULL` si ni con el hueco
#'   mínimo caben.
#' @keywords internal
.lam_filas_hueco_uniforme <- function(contenido, disponible, hueco_min = 0.05, hueco_max = 0.3) {
  n <- length(contenido)
  if (!n) return(NULL)
  libre <- disponible - sum(contenido)
  if (libre < n * hueco_min - 1e-9) return(NULL)
  hueco <- max(hueco_min, min(hueco_max, libre / n))
  list(alturas = contenido + hueco, hueco = hueco)
}

#' Huecos visibles entre filas consecutivas (para verificar que son iguales): contenido centrado en su fila
#' @keywords internal
.lam_filas_huecos <- function(alturas, contenido) {
  n <- length(alturas)
  if (n < 2L) return(numeric(0))
  sobra <- (alturas - contenido) / 2
  sobra[-n] + sobra[-1L]
}
