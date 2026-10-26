# Arranque común de las barras en las apiladas y multiapiladas del Word.
#
# Gonzalo (2026-10-26): las figuras con el mismo tipo de rótulo de fila —los públicos de un perfil, «Docentes · Estudiantes
# · Administrativos»— deben arrancar las barras en el mismo punto de la página. Cada escala medía su propia columna de
# rótulos (`.word_xmin()`), así que la de un solo público, sin rótulo, arrancaba en el borde izquierdo y la de tres públicos
# más a la derecha. El documento mide una vez la columna de todas sus escalas y las de rótulo corto (o sin rótulo) toman la
# más ancha de ellas; las de rótulo largo (las premisas) conservan la suya, porque igualarlas a ellas comería la barra.

#' Hasta qué ancho (pulgadas) un rótulo de fila es «corto»: un público con sus casos, «Administrativos (14)», cabe holgado
#' @keywords internal
.WORD_ROTULO_CORTO_IN <- 1.6

#' Los rótulos de fila de una escala como los dibuja el Word: en su orden, con «(N)» si «Casos junto al porcentaje» lo
#' pide, y partidos en líneas
#' @keywords internal
.word_escala_rotulos_fila <- function(espec, envolver = .WORD_ESCALA_ENVOLTURA) {
  orden <- espec$orden$aplicado %||% seq_len(nrow(espec$filas))
  F <- espec$filas[orden, , drop = FALSE]
  rot <- ifelse(is.na(F$rotulo) | !nzchar(F$rotulo), "", F$rotulo)
  # «Casos junto al porcentaje»: el Word no lleva «N respuestas» por fila como la lámina; si el ajuste lo pide, el grupo
  # dice sus casos en el rótulo («Administrativos (14)»).
  casos <- suppressWarnings(as.numeric(.espec_casos(F)))
  if (.casos_junto_muestra(.espec_casos(espec$filas), espec$casos_junto) && any(is.finite(casos))) {
    con <- nzchar(rot) & is.finite(casos)
    rot[con] <- sprintf("%s (%d)", rot[con], as.integer(round(casos[con])))
  }
  .word_escala_rotulos_envueltos(rot, envolver)
}

#' Ancho de columna de rótulos (pulgadas) de una escala del Word, como lo reserva `.word_xmin()`
#' @keywords internal
.word_escala_rotulo_in <- function(espec) {
  .word_rotulo_in(.word_escala_rotulos_fila(espec), .WORD_ESCALA_PT$rotulo_fila + .word_desplazo("rotulo"))
}

#' Columna común de rótulos de las escalas cortas de un documento, o `NULL` si no hay ninguna
#' @param especs Especs de las figuras del documento; las que no son escala se ignoran.
#' @return Pulgadas: la columna más ancha entre las escalas de rótulo corto o sin rótulo.
#' @keywords internal
.word_rotulo_comun <- function(especs) {
  es_escala <- function(e) is.list(e) && identical(as.character(e$tipo %||% "")[1], "escala") && NROW(e$filas) > 0L
  L <- vapply(Filter(es_escala, especs), function(e) tryCatch(.word_escala_rotulo_in(e), error = function(err) NA_real_), 0)
  L <- L[is.finite(L) & L <= .WORD_ROTULO_CORTO_IN]
  if (!length(L)) NULL else max(L)
}

#' La columna con que dibuja una escala: la común del documento si la suya es corta, o la suya
#' @keywords internal
.word_escala_columna <- function(propia, comun = getOption("prosecnur.word_rotulo_comun")) {
  comun <- suppressWarnings(as.numeric(comun %||% NA_real_)[1])
  if (is.finite(comun) && propia <= .WORD_ROTULO_CORTO_IN) max(propia, comun) else propia
}
