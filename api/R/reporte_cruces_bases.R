# Qué bases entran a los cruces multibase.
#
# Las variables de cruce se eligen en la config de la base activa y el job las
# aplica a todas las bases del estudio. Una base que no trae ninguna (en
# HSyVbG los segmentos de cruce se declararon sólo para 2026) cortaba el job
# entero con «length(CRUZAR_CON) > 0 is not TRUE». Esa base se salta; si
# ninguna base trae las variables, el error lo dice en palabras.

#' Nombres de las bases que traen al menos una variable de cruce.
#' @keywords internal
.cruces_bases_con_variables <- function(data_sources, cruces_val) {
  bases <- names(data_sources) %||% character(0)
  tiene <- vapply(bases, function(b) {
    df <- data_sources[[b]]
    is.data.frame(df) && any(cruces_val %in% names(df))
  }, logical(1))
  if (length(bases) && !any(tiene)) {
    stop_api(400, "E_NO_CRUCES_ANALITICAS", sprintf(
      "Ninguna base trae las variables de cruce elegidas (%s). Revísalas en Analítica > Cruces o declara sus segmentos en Carga > Equivalencias.",
      paste(cruces_val, collapse = ", ")), list(cruces = as.list(cruces_val)))
  }
  bases[tiene]
}
