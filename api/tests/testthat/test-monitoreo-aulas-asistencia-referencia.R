# El embudo de asistencia del estudio de referencia, traido desde calc-muestra.

referencia <- function(filas) list(
  unidad = "encuentro_en_curso_horario_aplicado",
  denominador = "elegibles_presentes",
  estudio = list(label = "HSVBG2025_referencia_para_motor.xlsx"),
  embudos = list(
    list(dimension_key = "rango_horario", filas = list(list(celda_label = "07-09"))),
    list(dimension_key = "facultad", filas = filas)
  ))

fila <- function(label, k, eleg, asis, pres, efec) list(
  celda_label = label, k = k, elegibles = eleg, asistentes = asis,
  elegibles_presentes = pres, efectivas = efec,
  pct_ausencia = 1 - asis / eleg, pct_ya_medidas = 0, pct_rechazo = 1 - efec / pres,
  efectividad = efec / pres, rendimiento = efec / eleg)

test_that("trae la dimension FACULTAD y no las otras cinco", {
  # El embudo viene por seis dimensiones —facultad, rango horario, tipo de
  # sesion, condicion del curso, nivel y tipo de docente— y el tablero usa la de
  # facultad. Copiar las seis metería otra vez en el .pulso un bloque que ya
  # vive en calc-muestra.
  r <- monitoreo_aulas_asistencia_referencia(referencia(list(
    fila("ARQUITECTURA Y URBANISMO", 7, 237, 215, 203, 171),
    fila("DERECHO", 16, 100, 90, 85, 60)
  )))
  expect_identical(names(r$facultades), c("ARQUITECTURA Y URBANISMO", "DERECHO"))
  expect_identical(r$facultades[["ARQUITECTURA Y URBANISMO"]]$elegibles, 237)
  expect_identical(r$facultades[["ARQUITECTURA Y URBANISMO"]]$asistentes, 215)
  expect_identical(r$facultades[["ARQUITECTURA Y URBANISMO"]]$elegibles_presentes, 203)
  expect_identical(r$facultades[["ARQUITECTURA Y URBANISMO"]]$efectivas, 171)
})

test_that("conserva las DOS tasas con sus dos nombres", {
  # `efectividad` es sobre los elegibles PRESENTES y `rendimiento` sobre los
  # elegibles del aula: no son la misma y traerlas por separado evita que el
  # tablero elija una y la rotule con la palabra de la otra.
  r <- monitoreo_aulas_asistencia_referencia(referencia(list(
    fila("DERECHO", 16, 200, 180, 160, 120)
  )))
  d <- r$facultades[["DERECHO"]]
  expect_equal(d$efectividad, 120 / 160)
  expect_equal(d$rendimiento, 120 / 200)
  expect_false(isTRUE(all.equal(d$efectividad, d$rendimiento)))
})

test_that("guarda la evidencia de cada celda: sin k, una tasa de un aula pesa igual que una de cuarenta", {
  r <- monitoreo_aulas_asistencia_referencia(referencia(list(fila("LETRAS", 3, 50, 45, 40, 30))))
  expect_identical(r$facultades[["LETRAS"]]$k, 3L)
})

test_that("dice de que estudio sale, para que no se lea como del operativo de hoy", {
  r <- monitoreo_aulas_asistencia_referencia(referencia(list(fila("LETRAS", 3, 50, 45, 40, 30))))
  expect_identical(r$estudio, "HSVBG2025_referencia_para_motor.xlsx")
  expect_identical(r$denominador, "elegibles_presentes")
})

test_that("sin referencia, sin embudo o sin dimension de facultad devuelve NULL", {
  expect_null(monitoreo_aulas_asistencia_referencia(NULL))
  expect_null(monitoreo_aulas_asistencia_referencia(list()))
  expect_null(monitoreo_aulas_asistencia_referencia(list(embudos = list(
    list(dimension_key = "nivel_curso", filas = list(list(celda_label = "1")))
  ))))
  # Y una dimension de facultad con filas sin nombre tampoco cuela.
  expect_null(monitoreo_aulas_asistencia_referencia(referencia(list(fila("", 3, 50, 45, 40, 30)))))
})
