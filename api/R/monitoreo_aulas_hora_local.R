# **La hora del aula es la LOCAL, y Kobo trae las dos.**
#
# Gonzalo, 2026-09-07: la «Base de control» decía «HORA DE APLICACIÓN 16:33»
# para un curso-horario agendado a las 11:30 am. Kobo publica `_submission_time`
# en UTC y `start`/`end` con el desfase del dispositivo —«2026-09-07T11:33:09
# -05:00»—, y toda la lectura temporal del perfil prefería el primero.
#
# No es sólo la hora: **con UTC un aula de la tarde cambia de DÍA.** Este
# operativo agenda hasta las 19:30 de Lima, que son las 00:30 UTC del día
# siguiente; su avance diario, su fecha de aplicación y su «último día de
# respuesta» habrían saltado a la jornada de mañana. Todavía no había pasado
# porque el primer día cerró a las 17:48.
#
# Por eso el orden de preferencia se invierte: manda la columna que trae su
# huso. `_submission_time` queda de último recurso —un export sin `start` sigue
# leyéndose— y se declara al usarlo.

#' Las columnas de fecha/hora de una base de respuestas, en orden de confianza.
#'
#' `start` y `end` los escribe el dispositivo del encuestador con su desfase;
#' `date` es la fecha ya resuelta del formulario; `_submission_time` es UTC del
#' servidor. La lista se lee de izquierda a derecha.
#' @export
MONITOREO_AULAS_COLUMNAS_TIEMPO <- c(
  "start", "end", "date", "fecha",
  "kobo_timestamp_iso", "_submission_time", "submission_time"
)

#' La fecha ISO de cada marca de tiempo, respetando el huso que traiga.
#'
#' No se convierte de zona: se toma la fecha TAL COMO la escribió el dispositivo,
#' que es la del salón. Convertirla exigiría saber el huso del estudio y
#' `start`/`end` ya lo llevan puesto.
#' @param x vector de marcas ISO.
#' @return vector `YYYY-MM-DD`, vacío donde no se reconoce.
#' @export
monitoreo_aulas_fecha_local <- function(x) {
  v <- trimws(as.character(x %||% character(0)))
  f <- substr(v, 1, 10)
  f[!grepl("^[0-9]{4}-[0-9]{2}-[0-9]{2}$", f)] <- ""
  f
}

#' La hora `HH:MM` de cada marca de tiempo, respetando su huso.
#' @param x vector de marcas ISO.
#' @return vector `HH:MM`, vacío donde no se reconoce.
#' @export
monitoreo_aulas_hora_local <- function(x) {
  v <- trimws(as.character(x %||% character(0)))
  h <- substr(v, 12, 16)
  h[!grepl("^[0-9]{2}:[0-9]{2}$", h)] <- ""
  h
}
