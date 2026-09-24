# =============================================================================
# Un docente que ya dijo que no, no se vuelve a proponer como refuerzo
# =============================================================================
#
# Stefano, 2026-09-24, sobre la lista de refuerzos de CCSS: «R 5.1, que rechazó
# estando como titular en el curso CH 17 — Profesor: VILLAVICENCIO VASQUEZ,
# JULIO ALBERTO». La app proponía (y se marcó) una reserva cuyo docente ya
# había rechazado otro curso-horario: pedírselo otra vez gasta un refuerzo de
# los pocos que hay en una llamada que ya tiene respuesta.
#
# El rechazo es del DOCENTE, no del curso: se compara por nombre normalizado
# (mayúsculas, sin tildes ni espacios dobles), que es lo que el plan trae en
# todas las filas.

#' Nombre de docente comparable.
#' @keywords internal
.madr_clave <- function(x) {
  v <- toupper(trimws(as.character(x %||% "")))
  v[is.na(v)] <- ""
  v <- iconv(v, to = "ASCII//TRANSLIT", sub = "")
  v[is.na(v)] <- ""
  trimws(gsub("[^A-Z, ]", "", gsub("[[:space:]]+", " ", v)))
}

#' Los docentes que ya rechazaron algún curso-horario del plan.
#'
#' @param plan filas del plan (lista o data.frame con `teacher` y `sample_status`).
#' @return vector de claves de docente (ver `.madr_clave`).
#' @keywords internal
monitoreo_aulas_docentes_que_rechazaron <- function(plan = list()) {
  if (is.data.frame(plan)) {
    doc <- plan$teacher %||% character(0)
    st <- plan$sample_status %||% character(0)
  } else {
    filas <- plan %||% list()
    doc <- vapply(filas, function(u) .monitoreo_scalar(u$teacher, ""), character(1))
    st <- vapply(filas, function(u) .monitoreo_scalar(u$sample_status, ""), character(1))
  }
  if (!length(doc)) return(character(0))
  rech <- vapply(st, monitoreo_aulas_estado_muestra, character(1), USE.NAMES = FALSE) == "rechazo"
  k <- .madr_clave(doc[rech])
  unique(k[nzchar(k)])
}

#' Si el docente de cada fila ya rechazó otro curso-horario.
#' @keywords internal
.madr_docente_rechazo <- function(docentes, que_rechazaron) {
  k <- .madr_clave(docentes)
  nzchar(k) & k %in% que_rechazaron
}
