# monitoreo_aulas_control_desde_parte.R — la Base de control de la app toma del
# parte lo que la fila leída no trae. Unidad A11 del loop de mejora estética y
# técnica (2026-09-07).
#
# Medido con el estado real del día 1 de campo: 9 filas de control en sesión,
# 7 partes con `observed_students`, y 6 de esas filas con ALUMNOS EN AULA vacío
# —y con él «% ASISTENCIA» y «ALUMNOS QUE NO RESPONDIERON»— porque la fila se
# LEYÓ del libro (`cfg$control`) antes de que el parte entrara. El publicador
# ya resuelve esto al escribir la hoja (`carga_aulas_libro_generar.R`, bloque
# de campo: «si hay parte, manda el parte»), así que la Base de control
# publicada y la que enseña la app decían cosas distintas de la misma aula.
#
# La regla es la del publicador, no una segunda: asistentes del parte cuando
# la fila no los trae; asistencia = asistentes / elegibles; no respondieron =
# asistentes − efectivas de plataforma. Y lo que el equipo TECLEÓ manda
# siempre: aquí sólo se llena lo vacío, nunca se pisa.

#' Completa las filas de control con el parte de campo de su curso-horario.
#'
#' @param filas filas de «Base de control» leídas del libro.
#' @param partes partes de campo en sesión (claves en castellano o inglés:
#'   `.MONITOREO_AULAS_PARTE_ALIAS`).
#' @return las mismas filas, en el mismo orden, con `observed_students`,
#'   `attendance_pct` y `non_respondents` llenos donde venían vacíos y el parte
#'   los sabe.
#' @keywords internal
monitoreo_aulas_control_completar_con_partes <- function(filas = list(), partes = list()) {
  if (!length(filas)) return(list())
  # El parte por clave canónica del código: «ch 4 » y «CH 4» son el mismo
  # curso-horario (misma clave que usan el tablero y las celdas de sexo). Con
  # varios partes del mismo código manda el último, como en el publicador.
  parte_de <- list()
  for (pt in (partes %||% list())) {
    if (!is.list(pt)) next
    cod <- .monitoreo_aulas_clave_colector(pt$operational_code %||% pt$classroom_id %||% "")
    if (length(cod) == 1L && nzchar(cod)) parte_de[[cod]] <- pt
  }
  if (!length(parte_de)) return(filas)
  lapply(filas, function(fila) {
    if (!is.list(fila)) return(fila)
    cod <- .monitoreo_aulas_clave_colector(fila$operational_code %||% fila$classroom_id %||% "")
    pt <- if (length(cod) == 1L && nzchar(cod)) parte_de[[cod]] else NULL
    if (is.null(pt)) return(fila)
    asist <- suppressWarnings(as.numeric(
      .monitoreo_aulas_parte_primero(pt, .MONITOREO_AULAS_PARTE_ALIAS$asistentes)))[1]
    if (!is.finite(asist)) return(fila)
    if (!.mac_con_dato(fila$observed_students)) fila$observed_students <- asist
    # Las derivadas sólo si la propia fila trae su denominador; si el equipo
    # ya tecleó la suya, se conserva.
    asist_fila <- .mac_num(fila$observed_students)
    eleg <- .mac_num(fila$eligible_n)
    if (!.mac_con_dato(fila$attendance_pct) && is.finite(asist_fila) && is.finite(eleg) && eleg > 0) {
      fila$attendance_pct <- round(asist_fila / eleg, 3L)
    }
    obtenidas <- .mac_num(fila$efectivas_obtenidas)
    if (!.mac_con_dato(fila$non_respondents) && is.finite(asist_fila) && is.finite(obtenidas)) {
      fila$non_respondents <- max(0, round(asist_fila - obtenidas))
    }
    fila
  })
}
