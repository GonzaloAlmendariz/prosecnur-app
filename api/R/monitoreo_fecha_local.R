# Día local de una respuesta.
#
# SurveyMonkey y Kobo sellan sus respuestas con zona (`2026-10-29T23:33:00+00:00`,
# `…-05:00`). `as.Date()` sobre ese instante da el día en UTC, así que en Perú
# toda respuesta después de las 19:00 caía al día siguiente: el 29/10/2026
# Acreditación Institucional mostró 613 respuestas ese día y 181 el «30 oct»,
# cuando las 794 fueron del 29 en Lima (y el corte era del 29 a las 19:33).
# El ritmo diario, el mejor día y el día de la semana salían corridos.
#
# Se pasa a la zona del estudio sólo lo que trae zona. Un valor sin ella
# («2026-10-29», «2026-10-29 19:00») ya es hora de pared local y se deja como
# está: convertirlo lo correría un día hacia atrás. Aulas ya hacía lo mismo en
# su ritmo (`monitoreo_aulas_report_ritmo.R`).

#' Zona horaria de las fechas de campo. Perú, salvo que la sesión diga otra.
.monitoreo_tz_campo <- function() {
  getOption("prosecnur.tz_campo", "America/Lima")
}

#' Día (YYYY-MM-DD) de cada instante: en la zona del estudio si el texto
#' original traía zona; si no, tal como venía.
.monitoreo_dia_local <- function(instantes, crudos) {
  crudos <- as.character(crudos %||% "")
  crudos[is.na(crudos)] <- ""
  # La zona va después de una hora: así el «-2026» de «29-10-2026» no se lee como huso.
  con_zona <- grepl("[0-9]{2}:[0-9]{2}(:[0-9]{2})?([.][0-9]+)?(Z|[+-][0-9]{2}:?[0-9]{2})$", trimws(crudos))
  dia_utc <- as.character(as.Date(instantes, tz = "UTC"))
  dia_local <- as.character(as.Date(instantes, tz = .monitoreo_tz_campo()))
  ifelse(con_zona, dia_local, dia_utc)
}
