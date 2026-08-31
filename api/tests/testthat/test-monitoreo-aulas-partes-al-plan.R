# La direccion inversa de A1: los partes que entran DEL LIBRO llegan al plan,
# que es lo que la pestaña «Registro de campo» lee (`row.observed_students`,
# `row.applied_by`...). Sin este puente, importar un libro llenado en Excel
# dejaba los formularios de la app vacios: el parte quedaba en
# `monitoreo_aulas_partes_campo` y ningun eslabon lo copiaba al plan.
# Registrado como A10 en docs/qa/checklist-operativo-aulas-2026-08-31.md.

test_that("un parte del libro llena los campos del plan que lee la pestaña", {
  plan <- list(list(
    operational_code = "CH 1", classroom_id = "CH 1",
    sample_role = "titular", observed_students = NULL
  ))
  partes <- list(list(
    operational_code = "CH 1", intento = 1L,
    observed_students = 24, refusals = 1, duplicates = 0,
    effective_surveys = 23, applied_by = "Equipo B", actual_room = "N-101",
    applied_date = "2026-09-10", field_note = "corregido en excel"
  ))
  out <- monitoreo_aulas_plan_desde_partes(plan, partes)
  fila <- out[[1]]
  expect_identical(fila$observed_students, 24)
  expect_identical(fila$refusals, 1)
  expect_identical(fila$duplicates, 0)
  expect_identical(fila$effective_surveys, 23)
  expect_identical(fila$applied_by, "Equipo B")
  expect_identical(fila$actual_room, "N-101")
  # El plan guarda el momento con su nombre propio: `applied_at`.
  expect_identical(fila$applied_at, "2026-09-10")
  expect_identical(fila$field_note, "corregido en excel")
})

test_that("el parte en castellano (libro real) tambien llega, via alias", {
  plan <- list(list(operational_code = "CH 2", classroom_id = "CH 2"))
  partes <- list(list(
    operational_code = "CH 2", intento = 1L,
    asistentes = 30, rechazos = 2, efectivas = 28, aplicador = "Equipo C"
  ))
  fila <- monitoreo_aulas_plan_desde_partes(plan, partes)[[1]]
  expect_identical(fila$observed_students, 30)
  expect_identical(fila$refusals, 2)
  expect_identical(fila$effective_surveys, 28)
  expect_identical(fila$applied_by, "Equipo C")
})

test_that("una correccion del libro pisa el valor del plan, y el vacio no blanquea", {
  plan <- list(list(
    operational_code = "CH 1", classroom_id = "CH 1",
    observed_students = 25, applied_by = "Equipo A"
  ))
  partes <- list(list(
    operational_code = "CH 1", intento = 1L,
    observed_students = 24, applied_by = ""
  ))
  fila <- monitoreo_aulas_plan_desde_partes(plan, partes)[[1]]
  expect_identical(fila$observed_students, 24)
  expect_identical(fila$applied_by, "Equipo A")
})

test_that("el cero del parte es dato y llega al plan", {
  plan <- list(list(operational_code = "CH 1", classroom_id = "CH 1", refusals = 3))
  partes <- list(list(operational_code = "CH 1", intento = 1L, refusals = 0))
  expect_identical(monitoreo_aulas_plan_desde_partes(plan, partes)[[1]]$refusals, 0)
})

test_that("los reintentos (intento > 1) no tocan el plan", {
  plan <- list(list(operational_code = "CH 1", classroom_id = "CH 1", observed_students = 25))
  partes <- list(list(operational_code = "CH 1", intento = 2L, observed_students = 99))
  expect_identical(monitoreo_aulas_plan_desde_partes(plan, partes)[[1]]$observed_students, 25)
})

test_that("un aula sin parte queda intacta y una desconocida no rompe", {
  plan <- list(list(operational_code = "CH 1", classroom_id = "CH 1", label = "x"))
  partes <- list(list(operational_code = "CH 99", intento = 1L, asistentes = 10))
  out <- monitoreo_aulas_plan_desde_partes(plan, partes)
  expect_identical(out[[1]]$label, "x")
  expect_null(out[[1]]$observed_students)
})
