# Las encuestas EFECTIVAS de cada aula, tal como las define el estudio.
#
# Gonzalo, fijando el vocabulario: «un elegible efectivo o solo efectivo es una
# respuesta efectiva de la plataforma, es decir es una encuesta que se completa
# y pasa los filtros».
#
# Es decir: **la efectiva se define en la plataforma, no en el parte**. Lo que
# el aplicador anota al salir del aula (`effective_surveys`) es su cuenta de
# campo y sirve para otras cosas —cuadrar el parte, ver si se perdieron envios—
# pero la efectiva del estudio es la respuesta que llego y paso los filtros
# declarados.
#
# Esta funcion existe para que el LIBRO pueda escribir esa cifra sin
# reimplementar la cadena. Envuelve los cuatro helpers que ya usa el motor
# —criterio de validez, identificador del aula, conteo y emparejamiento— en vez
# de repetir su logica: el emparejamiento es por `classroom_id` con
# `collection_unit_id` de respaldo, y una segunda copia se separaria de la
# primera en cuanto una cambie.

#' Efectivas por aula, indexadas por codigo operativo.
#'
#' @param plan filas del plan (formato largo de Monitoreo).
#' @param responses `data.frame` de respuestas de la plataforma.
#' @param cfg config de aulas universitarias, con sus filtros de validez.
#' @return vector numerico con nombre; `NULL` si no hay con que contar.
#' @export
monitoreo_aulas_efectivas_por_aula <- function(plan, responses, cfg = list()) {
  if (!length(plan) || !is.data.frame(responses) || !nrow(responses)) return(NULL)
  plan_df <- .monitoreo_aulas_df(monitoreo_aulas_normalize_plan(plan), "plan")
  if (!nrow(plan_df)) return(NULL)
  valid <- .monitoreo_aulas_valid_response(responses, cfg)
  aula <- .monitoreo_aulas_response_classroom(responses, cfg)
  conteo <- .monitoreo_aulas_named_counts(aula, valid)
  stats::setNames(
    .monitoreo_aulas_contar_por_fila(plan_df, conteo),
    plan_df$operational_code
  )
}
