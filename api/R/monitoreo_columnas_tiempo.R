# Columnas de inicio, fin y duración de una respuesta: patrones anclados a la
# palabra completa y, para inicio y fin, la comprobación de que sus valores sean
# instantes.
#
# Con patrones por subcadena («fin», «inicio», «tiempo»), Acreditación 2026
# autodetectó como fin la pregunta «q0007__los_fines_y_prop_ositos_de_la_
# universidad» («fines» contiene «fin»), y la validación de tiempos del
# entregable la rotulaba «Fin». Hoy no movía cifras porque no había inicio,
# pero en cuanto uno apareciera la duración saldría de restar una opinión.

# Sin «hora_inicio»/«hora_fin»: traen horas sueltas («10:30»), que no son instantes.
.MONITOREO_PATRONES_INICIO <- c("^start$", "^inicio$", "^fecha_inicio$", "^start_?time$")
.MONITOREO_PATRONES_FIN <- c("^end$", "^fin$", "^fecha_fin$", "^end_?time$")
.MONITOREO_PATRONES_DURACION <- c("^total_time$", "^duration$", "^duracion$", "^duration_s(ec)?$", "^tiempo$", "^tiempo_total$")

# Una columna de inicio o fin sólo vale si al menos la mitad de sus valores
# (de una muestra) se leen como instantes; si no, se descarta y queda vacía.
# Sin datos con qué comprobar, se respeta lo declarado.
.monitoreo_columna_de_tiempo <- function(columna, data) {
  columna <- .monitoreo_scalar(columna, "")
  if (!nzchar(columna) || !is.data.frame(data) || !columna %in% names(data)) return(columna)
  # Basta una muestra: se lee hasta encontrar 200 valores no vacíos, sin convertir la columna entera.
  columna_cruda <- data[[columna]]
  valores <- character(0)
  for (inicio in seq(1L, length(columna_cruda), by = 1000L)) {
    tramo <- as.character(columna_cruda[inicio:min(length(columna_cruda), inicio + 999L)])
    valores <- c(valores, tramo[!is.na(tramo) & nzchar(trimws(tramo))])
    if (length(valores) >= 200L) break
  }
  if (!length(valores)) return(columna)
  leidos <- .monitoreo_parse_time_vec(utils::head(valores, 200L))
  if (mean(!is.na(leidos)) >= 0.5) columna else ""
}
