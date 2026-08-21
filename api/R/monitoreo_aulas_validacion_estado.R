#' El estado de un control que pudo no tener nada que mirar.
#'
#' **«No se puede comprobar» NO es «correcto».** El motor ya lo decia en el
#' texto de cada control y lo callaba en el estado: con un estudio recien
#' importado —plan si, campo todavia no— la lista de validacion declaraba
#' **9 correctos de 11**, y siete de esos nueve explicaban en su propia frase
#' que no habian mirado nada: «No hay partes de campo que comprobar», «Ninguna
#' aula esta en las dos hojas a la vez», «Todavia no hay respuestas que contar».
#'
#' Es el «verde por AUSENCIA» que el Contrato de Superficie prohibe, cometido
#' dentro de la propia lista de validacion — y quien la lee de un vistazo se
#' lleva que el estudio esta limpio cuando lo cierto es que no se ha revisado.
#'
#' El vocabulario ya existia: `personal_identifiers` y `duplicate_responses` ya
#' devolvian `sin_datos`, y la UI lo pinta «SIN COMPROBAR». Lo que faltaba era
#' aplicarlo donde el detalle ya lo declaraba.
#'
#' Vive en archivo propio porque `monitoreo_aulas_universitarias.R` ronda las
#' 2 000 lineas: la decision es logica nueva y no engorda al grande.
#'
#' @param comprobable `TRUE` si habia con que comprobar. Cuando es `FALSE` el
#'   control no paso ni fallo: no se corrio.
#' @param hallazgo `TRUE` si el control encontro algo.
#' @param estado_hallazgo Que decir cuando lo hay: `"review"` cuando se arregla
#'   en la hoja o en la config, `"warning"` cuando es un aviso de campo.
#' @export
monitoreo_aulas_estado_control <- function(comprobable, hallazgo,
                                           estado_hallazgo = "review") {
  if (!isTRUE(comprobable)) return("sin_datos")
  if (isTRUE(hallazgo)) return(estado_hallazgo)
  "ok"
}
