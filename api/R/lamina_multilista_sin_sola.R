# lamina_multilista_sin_sola.R — una multilista partida no deja una barra sola en su última lámina
#
# Gonzalo, 2026-10-29 (checklist-arte-vs-conta, ítem 17): «es mejor que no queden barras solas». En Arte, «Proceso
# formativo» no cabe en una lámina (6,4 in contra 4,6) y el corte entre bloques dejaba el Sí/No de estudiantes solo en
# la lámina siguiente. Si la última parte trae una sola barra, se lleva la última pregunta del bloque de arriba (con sus
# públicos), siempre que las dos partes sigan cabiendo; si no caben, la partición queda como estaba.

#' Rebalancea la partición para que la última lámina no quede con una sola barra
#' @param partes Partición de `.lam_multilista_planear` (lista de láminas; cada una, lista de bloques).
#' @param cabe Función `function(parte)` que dice si una parte cabe en una lámina.
#' @return La partición, rebalanceada o como llegó.
#' @keywords internal
.lam_multilista_sin_barra_sola <- function(partes, cabe) {
  n <- length(partes)
  if (n < 2L || .lam_escala_n_barras(partes[[n]]) != 1L) return(partes)
  prev <- partes[[n - 1L]]; it <- prev[[length(prev)]]
  if (length(it$premisas) < 2L) return(partes)
  k <- length(it$premisas)
  arriba <- it; arriba$premisas <- it$premisas[-k]
  abajo <- it; abajo$premisas <- it$premisas[k]   # baja una pregunta entera con sus públicos: no lleva «(cont.)» (M1)
  nueva_prev <- c(prev[-length(prev)], list(arriba)); nueva_ult <- c(list(abajo), partes[[n]])
  if (!cabe(nueva_prev) || !cabe(nueva_ult)) return(partes)
  partes[[n - 1L]] <- nueva_prev; partes[[n]] <- nueva_ult
  partes
}
