# Aulas con marco de alumnos: las respuestas se atribuyen al alumno, no son
# anónimas (ADR 0125 §3; Gonzalo, 2026-11-02: «Sí, atribuir al marco»).
#
# Lo que atribuye ya existía: el código que declara el alumno
# (`source_mapping$student_code_var`) cruzado con el padrón. Lo que faltaba es
# que el rótulo lo dijera: en CCSS Perfil 2026-II el estudio pedía `cod_pucp` y
# seguía declarado de respuestas anónimas, y el cruce por carrera avisaba la
# contradicción. Con marco, `anonymous_responses` pasa a FALSE solo; sin marco,
# queda como esté declarado. No cambia ninguna cuenta: sólo el rótulo, el texto
# de Fuentes y el control de anonimato.

#' ¿El estudio de la sesión declara aulas con marco de alumnos? (Planner, `seleccion = "marco"`).
#' @keywords internal
.maam_con_marco_sesion <- function(sid) {
  if (!nzchar(sid %||% "")) return(FALSE)
  s <- session_get(sid, required = FALSE)
  if (!is.list(s)) return(FALSE)
  isTRUE(tryCatch(.planner_modos_de(.planner_payload_perfiles(s))$aulas$con_marco, error = function(e) FALSE))
}

#' La config de aulas con el anonimato que fija el marco.
#' @param cfg config de aulas.
#' @param con_marco si el estudio declara marco de alumnos.
#' @keywords internal
monitoreo_aulas_anonimato_por_marco <- function(cfg, con_marco = FALSE) {
  if (!is.list(cfg) || !isTRUE(con_marco)) return(cfg)
  cfg$anonymous_responses <- FALSE
  cfg$con_marco <- TRUE
  cfg
}

#' El control «anonymous_responses» del tablero: estado y detalle.
#'
#' Anónimo: ok. Con marco y una columna con el código del alumno: ok, la
#' respuesta se atribuye. Con marco y sin esa columna: a revisar, porque hay a
#' quién atribuir pero nada con qué cruzar. Declarado no anónimo sin marco: a
#' revisar, como antes.
#' @keywords internal
monitoreo_aulas_control_anonimato <- function(cfg) {
  codigo <- .monitoreo_scalar(((cfg %||% list())[["source_mapping"]] %||% list())[["student_code_var"]] %||% "", "")
  if (isTRUE(cfg$con_marco)) {
    if (nzchar(codigo)) {
      return(list(status = "ok", detail = sprintf(
        "Con marco de alumnos: cada respuesta se atribuye a su alumno por «%s», cruzado con el padrón.", codigo)))
    }
    return(list(status = "review", detail = paste(
      "El estudio tiene marco de alumnos pero ninguna columna con el código del alumno para cruzar.",
      "Se declara en Fuentes.")))
  }
  if (isTRUE(cfg$anonymous_responses)) {
    return(list(status = "ok", detail = "El tablero agrega por curso-horario, recopilador y enlace."))
  }
  list(status = "review", detail = "El tablero agrega por curso-horario, recopilador y enlace.")
}
