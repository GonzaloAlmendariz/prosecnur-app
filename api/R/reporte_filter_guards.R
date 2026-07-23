# =============================================================================
# Guardas de filtros declarativos para el motor de reportes (PPT/Word).
# =============================================================================
#
# Origen (bug vivo, ACNUR PDM — estudio multibase madre + repeat). Al armar el
# PPT, el plan viaja como JSON y plumber lo parsea con `simplifyDataFrame`. Ese
# parseo RECTANGULARIZA el arreglo de slides: la columna `filtros` de unas
# laminas se "rellena" en otras. En concreto, las laminas POR SERVICIO de la
# base hija repeat llevan `filtros = list(current_code = <codigo>)`; al
# rectangularizar, las laminas de la base MADRE (que no tenian filtros) heredan
# un `current_code = NA` fantasma. Al renderizar, ese filtro se aplica sobre la
# fuente de la madre — que no tiene la columna `current_code` — y un `stop()`
# crudo mataba las 85 laminas del reporte completo.
#
# Dos invariantes que fija este archivo (helpers que el motor congelado llama):
#   1) Un filtro cuyo valor es vacio/NA no restringe nada: es un NO-OP, jamas un
#      error (se resuelve en `.apply_named_filters`, reporte_filter_helpers.R).
#   2) Un filtro con valor REAL sobre una columna ausente en la fuente resuelta
#      degrada ESA lamina (0 filas -> canvas "Sin datos"), sin abortar el
#      reporte. Se implementa con una condicion clasificada recuperable que el
#      motor captura por-lamina via `.apply_named_filters_safe`.
#
# No es un `try()` silencioso: la degradacion emite `warning()` para dejar
# rastro en el log del job. No usa `stop_api` porque no es un error de la API
# sino una condicion interna de render que el propio motor resuelve.

#' Valores presentes (no vacios/NA) de un filtro declarativo.
#' @keywords internal
.filter_values_present <- function(x) {
  vals <- as.character(x)
  vals <- trimws(vals[!is.na(vals)])
  vals[nzchar(vals)]
}

#' Aborta con una condicion clasificada recuperable cuando un filtro con valor
#' real referencia una columna ausente en la fuente resuelta. La clase
#' `pulso_filter_missing_column` permite al motor degradar la lamina en vez de
#' matar el reporte. Mantiene el mismo mensaje que el `stop()` historico.
#' @keywords internal
.filter_abort_missing_column <- function(nm, arg_name = "filtros") {
  cond <- structure(
    class = c("pulso_filter_missing_column", "error", "condition"),
    list(
      message = paste0("La variable de filtro `", nm, "` no existe en `data`."),
      call = NULL,
      variable = as.character(nm)[1],
      arg_name = as.character(arg_name)[1]
    )
  )
  stop(cond)
}

#' Envuelve `.apply_named_filters` con la defensa en profundidad: si un filtro
#' con valor real apunta a una columna ausente en la fuente resuelta, en vez de
#' propagar el error (que mataria el reporte entero) degrada devolviendo la data
#' con 0 filas — el renderer cae naturalmente en su rama "Sin datos" y produce
#' un canvas en blanco para ESA lamina. Emite `warning()` para trazabilidad.
#' @keywords internal
.apply_named_filters_safe <- function(df, filters = list(), arg_name = "filtros") {
  tryCatch(
    .apply_named_filters(df, filters = filters, arg_name = arg_name),
    pulso_filter_missing_column = function(cnd) {
      warning(sprintf(
        paste0("Filtro `%s` referencia una columna ausente en la fuente resuelta; ",
               "la lamina se degrada a canvas en blanco."),
        cnd$variable
      ), call. = FALSE)
      df[0, , drop = FALSE]
    }
  )
}
