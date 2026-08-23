# Elegir «Monitoreo de cursos-horario» reventaba con E_INTERNAL.
#
# El ciclo se cerraba solo: el payload de estado ANADE `plan_rows` a la config de
# aulas para que la UI lo lea; el front reenvia esa misma config entera al elegir
# el modo; y aqui `config$plan` —con `$`, que parcial-matchea— no encontraba
# `plan` y devolvia el ENTERO `plan_rows`, que no es una tabla de filas.
#
# Reproducido con curl contra la API: reenviar sin tocar nada la config que el
# propio backend acababa de devolver bastaba para el 500.
#
# El repo ya conocia esta trampa por `config$plan`/`plan_rows` en otro punto. Aqui
# seguia viva, y `control` vs `control_sin_nombre` era la siguiente esperando.

test_that("una config con plan_rows y sin plan no se lee como plan", {
  # El caso exacto que llegaba del front.
  cfg <- monitoreo_aulas_normalize_config(list(enabled = TRUE, plan_rows = 0L))
  expect_true(is.list(cfg$plan))
  expect_length(cfg$plan, 0L)
})

test_that("plan_rows con valor no inventa un plan", {
  cfg <- monitoreo_aulas_normalize_config(list(plan_rows = 7L))
  expect_length(cfg$plan, 0L)
})

test_that("control_sin_nombre no se lee como control", {
  # La misma trampa, un campo mas alla: `control` no viene y `control_sin_nombre`
  # si. Con `$` habria entrado un entero donde se espera una tabla.
  cfg <- monitoreo_aulas_normalize_config(list(control_sin_nombre = 3L))
  expect_true(is.list(cfg$control) || is.data.frame(cfg$control))
  expect_equal(as.integer(cfg$control_sin_nombre), 3L)
})

test_that("`plan_rows` no cambia el resultado de un plan presente", {
  # El contrato exacto de la reparacion, y no «cuantas filas sobreviven»:
  # `monitoreo_aulas_normalize_plan()` tiene sus propios filtros —una fila con
  # dos campos no le basta— y atarse a ellos aqui haria que este test hablara de
  # otra cosa. Lo que se defiende es que la PRESENCIA de `plan_rows` sea
  # irrelevante.
  filas <- list(list(operational_code = "CH 1", faculty = "SOCIALES"))
  con <- monitoreo_aulas_normalize_config(list(plan = filas, plan_rows = 99L))
  sin <- monitoreo_aulas_normalize_config(list(plan = filas))
  expect_identical(con$plan, sin$plan)
})

test_that("el alias `agenda` se sigue leyendo con `plan_rows` delante", {
  filas <- list(list(operational_code = "CH 2", faculty = "DERECHO"))
  con <- monitoreo_aulas_normalize_config(list(agenda = filas, plan_rows = 5L))
  sin <- monitoreo_aulas_normalize_config(list(agenda = filas))
  expect_identical(con$plan, sin$plan)
})
