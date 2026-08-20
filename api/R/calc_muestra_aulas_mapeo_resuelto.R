# Las columnas que el motor RESOLVIO por rol — publicadas en el frame.
#
# M9 (2026-08-20): la pestaña Datos/Variables decia «Sin asignar» en todos los
# roles mientras el marco estaba construido con el mapping sellado — la
# superficie mentia porque la resolucion real (candidatos del mapping contra
# las columnas de la base) vivia solo dentro del build, sin registro publico.
# Con esto el frame declara que columna uso cada rol, y la UI puede mostrar
# «resuelto por el motor: ALUMNO» SIN usurpar la confirmacion del usuario
# (§3.3.1: asignar es decision consciente; esto es informacion, no asignacion).

#' Resuelve el mapping contra la base y el catalogo y publica el resultado.
#'
#' @param base data.frame de la base madre (columnas originales).
#' @param catalogo data.frame del catalogo curso-horario; puede ser NULL.
#' @param mapping lista de candidatos por rol (config$mapping normalizada).
#' @return lista con `base` y `catalogo`: rol -> columna resuelta (solo los
#'   roles que resolvieron; la ausencia dice «no hay columna», jamas "").
calc_muestra_aulas_mapeo_resuelto <- function(base, catalogo, mapping) {
  roles <- c(
    "student_id", "classroom_id", "course_id", "course_name", "section",
    "schedule", "classroom_label", "faculty", "program", "level", "formation",
    "sex", "age", "condition", "modality", "session_type", "teacher",
    "teacher_email", "teacher_type", "condicion_curso", "campus",
    "enrolled_total"
  )
  resolver <- function(df) {
    if (!is.data.frame(df) || !nrow(df)) return(list())
    out <- list()
    for (rol in roles) {
      col <- .cm_aulas_col(df, mapping[[rol]])
      if (nzchar(col)) out[[rol]] <- col
    }
    out
  }
  list(
    schema = "cm_mapeo_resuelto_v1",
    base = resolver(base),
    catalogo = resolver(catalogo)
  )
}
