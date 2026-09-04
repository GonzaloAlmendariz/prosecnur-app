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

#' Efectivas por aula Y POR SEXO, indexadas por codigo operativo.
#'
#' Dictado de Gonzalo (2026-09-04): «poder mapear facilmente cuantas se
#' esperaban en total y en hombres y en mujeres y cuanto obtuvimos». Lo
#' esperado ya lo reparte `.mac_esperadas_por_sexo()`; esto es la otra mitad.
#'
#' **Exige que el estudio DECLARE su variable de sexo** (`source_mapping$sex_var`).
#' Sin ella devuelve `NULL` y la columna calla, en vez de adivinar cual de las
#' variables de la base es el sexo: ese error ya costo una lectura aqui
#' —`sub_a` es el sexo MAS FRECUENTE del aula, no las mujeres— y una cifra
#' inventada por sexo es peor que ninguna.
#'
#' Las etiquetas son las del DATO, tal como vienen: no se traducen ni se
#' ordenan a «hombres, mujeres», porque el padron de cada estudio las escribe a
#' su manera y renombrarlas aqui seria la segunda verdad.
#'
#' @param plan filas del plan (formato largo de Monitoreo).
#' @param responses `data.frame` de respuestas de la plataforma.
#' @param cfg config de aulas universitarias, con sus filtros y su `sex_var`.
#' @return lista por codigo operativo, cada una un vector con nombre por sexo;
#'   `NULL` si no hay variable declarada o no hay con que contar.
#' @export
monitoreo_aulas_efectivas_por_sexo <- function(plan, responses, cfg = list()) {
  if (!length(plan) || !is.data.frame(responses) || !nrow(responses)) return(NULL)
  var_sexo <- .monitoreo_scalar(
    (cfg[["source_mapping"]] %||% list())[["sex_var"]] %||% "", "")
  if (!nzchar(var_sexo) || !(var_sexo %in% names(responses))) return(NULL)
  plan_df <- .monitoreo_aulas_df(monitoreo_aulas_normalize_plan(plan), "plan")
  if (!nrow(plan_df)) return(NULL)

  valid <- .monitoreo_aulas_valid_response(responses, cfg)
  aula <- .monitoreo_aulas_response_classroom(responses, cfg)
  sexo <- trimws(as.character(responses[[var_sexo]]))
  sexo[is.na(sexo) | !nzchar(sexo)] <- "Sin declarar"

  # Un conteo por sexo, cada uno con la MISMA maquinaria que el total: asi el
  # reparto por sexo suma exactamente el total y no dos cuentas distintas.
  etiquetas <- sort(unique(sexo[valid]), method = "radix")
  if (!length(etiquetas)) return(NULL)
  por_etiqueta <- lapply(etiquetas, function(e) {
    conteo <- .monitoreo_aulas_named_counts(aula, valid & sexo == e)
    .monitoreo_aulas_contar_por_fila(plan_df, conteo)
  })
  names(por_etiqueta) <- etiquetas

  salida <- lapply(seq_len(nrow(plan_df)), function(i) {
    v <- vapply(etiquetas, function(e) as.numeric(por_etiqueta[[e]][[i]]), numeric(1))
    v[v > 0]
  })
  stats::setNames(salida, plan_df$operational_code)
}
