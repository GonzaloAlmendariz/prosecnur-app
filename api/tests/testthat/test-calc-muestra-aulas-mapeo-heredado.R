# Un proyecto guardado congelaba los candidatos del motor y nunca se enteraba
# de que el motor habia aprendido nombres nuevos.
#
# El `.pulso` persiste `config$mapping` entero y ahi no se distingue lo que el
# analista eligio a mano de la lista de candidatos que el motor puso por defecto
# aquel dia. Como el ADR 0035 hace EXCLUSIVO todo rol mapeado —no une los
# defaults, a proposito—, el proyecto se queda con la lista de entonces para
# siempre: ampliar los candidatos del motor no arregla ningun proyecto existente.
#
# Medido en HSVG2026, guardado el 2026-08-06: su `mapping$session_type` es
# `session_type, tipo_sesion, tipo_clase, actividad` —la lista por defecto de
# entonces, no una eleccion de nadie— y con ella la columna real de la base,
# «Tipo Curso», resuelve a "". El criterio de tipo de sesion, que es el que
# define el marco, llevaba meses sin poder declararse en ese proyecto.
#
# La distincion no toca el ADR 0035: un mapeo DE VERDAD nombra UNA columna; una
# copia de los defaults es una lista de varios candidatos genericos que ya estan
# todos en los defaults de hoy.

.mh_cols <- function(...) {
  cols <- c(...)
  as.data.frame(setNames(rep(list("x"), length(cols)), cols), check.names = FALSE)
}

.mh_map <- function(mapping) calc_muestra_aulas_normalize_config(list(mapping = mapping))$mapping

test_that("una copia vieja de los defaults se refresca con los de hoy", {
  # Exactamente lo que HSVG2026 tiene guardado.
  viejo <- c("session_type", "tipo_sesion", "tipo_clase", "actividad")
  m <- .mh_map(list(session_type = viejo))
  expect_true("tipo_curso" %in% m$session_type)
  # Y con eso la columna real de la base ya resuelve.
  base <- .mh_cols("Codigo PUCP", "Facultad", "Curso", "Modalidad", "Tipo Curso")
  expect_equal(.cm_aulas_col(base, m$session_type), "Tipo Curso")
})

test_that("CONTROL: con la lista vieja, sin refrescar, no resolvia", {
  # Si esto resolviera igual, el test de arriba pasaria sin probar nada.
  base <- .mh_cols("Codigo PUCP", "Facultad", "Curso", "Modalidad", "Tipo Curso")
  expect_equal(
    .cm_aulas_col(base, c("session_type", "tipo_sesion", "tipo_clase", "actividad")),
    ""
  )
})

test_that("un mapeo a mano de UNA columna sigue siendo exclusivo (ADR 0035)", {
  # Es la garantia que no se puede romper: el rol elegido a mano no une los
  # defaults, para que el resolver no le robe la columna al analista.
  m <- .mh_map(list(session_type = "Mi Columna Rara"))
  expect_equal(m$session_type, "Mi Columna Rara")
  m2 <- .mh_map(list(faculty = "Facultad del Curso"))
  expect_equal(m2$faculty, "Facultad del Curso")
})

test_that("una lista de dos columnas propias tampoco se toca", {
  # Dos nombres que NO son candidatos del motor son una eleccion, no una copia.
  m <- .mh_map(list(session_type = c("Mi Columna", "Otra Columna")))
  expect_equal(m$session_type, c("Mi Columna", "Otra Columna"))
})

test_that("una copia PARCIAL de los defaults tambien se refresca", {
  # Un proyecto aun mas viejo pudo guardar menos candidatos de los que habia.
  m <- .mh_map(list(teacher_type = c("teacher_type", "tipo_docente")))
  expect_true("tipo_de_docente" %in% m$teacher_type)
})

test_that("una lista que mezcla un default con una columna propia se respeta", {
  # No es una copia: hay una decision dentro. Se conserva tal cual.
  m <- .mh_map(list(session_type = c("tipo_sesion", "Mi Columna")))
  expect_equal(m$session_type, c("tipo_sesion", "Mi Columna"))
})

test_that("el refresco alcanza a los demas roles, no solo a session_type", {
  viejo_curso <- c("course_level", "nivel_curso")
  m <- .mh_map(list(course_level = viejo_curso))
  expect_true(length(m$course_level) > length(viejo_curso))
  expect_true(all(viejo_curso %in% m$course_level))
})

test_that("sin mapping guardado no cambia nada", {
  # Control de que el refresco no inventa roles.
  m <- .mh_map(list())
  expect_true("tipo_curso" %in% m$session_type)
  expect_true("tipo_de_docente" %in% m$teacher_type)
})

test_that("el predicado distingue copia de eleccion", {
  defaults <- c("session_type", "tipo_sesion", "tipo_clase", "actividad", "tipo_curso")
  expect_true(.cm_aulas_mapeo_es_copia_de_defaults(c("session_type", "tipo_sesion"), defaults))
  # Una sola columna nunca es copia, aunque coincida con un candidato.
  expect_false(.cm_aulas_mapeo_es_copia_de_defaults("tipo_sesion", defaults))
  # Con algo de fuera, tampoco.
  expect_false(.cm_aulas_mapeo_es_copia_de_defaults(c("tipo_sesion", "Mi Columna"), defaults))
  expect_false(.cm_aulas_mapeo_es_copia_de_defaults(character(0), defaults))
})
