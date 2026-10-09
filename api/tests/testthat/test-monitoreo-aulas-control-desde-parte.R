# La Base de control de la app toma del parte lo que la fila leída no trae —
# A11 del loop de mejora estética y técnica (2026-09-07).
#
# Medido con el estado real del día 1 de campo: 9 filas de control en la app,
# 7 partes en sesión con `observed_students`, y 6 de esas filas con ALUMNOS EN
# AULA vacío —y con él «% ASISTENCIA» y «ALUMNOS QUE NO RESPONDIERON»— porque
# la fila se LEYÓ del libro antes de que el parte entrara. El publicador ya lo
# resuelve al escribir la hoja (`carga_aulas_libro_generar.R`: «si hay parte
# manda el parte»), así que la Base de control publicada y la de la app decían
# cosas distintas de la misma aula. Una definición por pregunta: la app
# completa con el parte lo que la fila no trae, y NUNCA pisa lo que el equipo
# tecleó.

.cdp_fila <- function(code, ...) c(list(operational_code = code, classroom_id = code,
                                        eligible_n = 30, efectivas_obtenidas = 20), list(...))

test_that("una fila leída sin ALUMNOS EN AULA la toma del parte, con sus derivadas", {
  filas <- list(.cdp_fila("CH 1"))
  partes <- list(list(operational_code = "CH 1", observed_students = 53, effective_surveys = 23))
  out <- monitoreo_aulas_control_completar_con_partes(filas, partes)
  expect_length(out, 1L)
  expect_identical(as.numeric(out[[1]]$observed_students), 53)
  # Las derivadas, con la MISMA regla del publicador: asistencia sobre
  # elegibles y no respondieron = asistentes − efectivas de plataforma.
  expect_identical(as.numeric(out[[1]]$attendance_pct), round(53 / 30, 3))
  expect_identical(as.numeric(out[[1]]$non_respondents), 33)
})

test_that("lo que el equipo tecleó manda: un parte distinto no lo pisa", {
  filas <- list(.cdp_fila("CH 2", observed_students = 40, attendance_pct = 0.8, non_respondents = 5))
  partes <- list(list(operational_code = "CH 2", observed_students = 53))
  out <- monitoreo_aulas_control_completar_con_partes(filas, partes)
  expect_identical(as.numeric(out[[1]]$observed_students), 40)
  expect_identical(as.numeric(out[[1]]$attendance_pct), 0.8)
  expect_identical(as.numeric(out[[1]]$non_respondents), 5)
})

test_that("sin parte no se inventa nada, y el parte se casa por clave canónica", {
  filas <- list(.cdp_fila("CH 3"), .cdp_fila("CH 4"))
  partes <- list(list(operational_code = "ch 4 ", asistentes = "18"))
  out <- monitoreo_aulas_control_completar_con_partes(filas, partes)
  expect_false(.mac_con_dato(out[[1]]$observed_students))
  expect_identical(as.numeric(out[[2]]$observed_students), 18)
  # Sin elegibles ni efectivas no hay derivada que calcular: quedan vacías.
  fila_sola <- list(list(operational_code = "CH 5"))
  out2 <- monitoreo_aulas_control_completar_con_partes(fila_sola, list(list(operational_code = "CH 5", observed_students = 10)))
  expect_identical(as.numeric(out2[[1]]$observed_students), 10)
  expect_false(.mac_con_dato(out2[[1]]$attendance_pct))
  expect_false(.mac_con_dato(out2[[1]]$non_respondents))
})

test_that("el tablero enseña la fila completada: la app dice lo mismo que la hoja publicada", {
  plan <- list(list(
    classroom_id = "CH 1", operational_code = "CH 1", faculty = "Ciencias",
    eligible_n = 30, expected_valid = 20, sample_role = "titular",
    sample_status = "AGENDADA"
  ))
  cfg <- list(
    control = list(list(operational_code = "CH 1", classroom_id = "CH 1",
                        eligible_n = 30, efectivas_obtenidas = 20, sent_total = 25)),
    partes_campo = list(list(operational_code = "CH 1", observed_students = 53,
                             effective_surveys = 23, applied_by = "Equipo A"))
  )
  d <- monitoreo_aulas_dashboard(plan, data.frame(), cfg)
  expect_length(d$control_calidad, 1L)
  expect_identical(as.numeric(d$control_calidad[[1]]$observed_students), 53)
  expect_identical(as.numeric(d$control_calidad[[1]]$non_respondents), 33)
})
