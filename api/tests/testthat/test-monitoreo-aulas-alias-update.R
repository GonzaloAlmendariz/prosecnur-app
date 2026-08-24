# El update de la agenda descartaba en silencio los nombres que el libro usa.
#
# `monitoreo_aulas_normalize_plan` resuelve la fecha de aplicacion con una lista
# de candidatos —`applied_at`, `fecha_aplicacion`, `hora_aplicacion`— asi que el
# plan normalizado solo tiene `applied_at`. El update, en cambio, hacia
# `if (!nm %in% names(plan_df)) next`: cualquier columna con otro nombre se
# perdia entera y sin aviso.
#
# `applied_date` es el nombre que trae el parte del libro —«FECHA DE
# APLICACION»—. Medido el 2026-08-24 simulando cinco dias de campo: las diez
# aulas quedaron «aplicada» con sus efectivas y su aplicador, y **sin una sola
# fecha**. El aviso de «cursos-horario vencidos sin aplicar» y el ritmo diario se
# calculan sobre esa fecha.

.mau_plan <- function() list(
  list(classroom_id = "c1", operational_code = "CH 1", faculty = "DERECHO",
       sample_role = "titular", stratum = "DERECHO / F / G1", eligible_n = 30, expected_valid = 20),
  list(classroom_id = "c2", operational_code = "CH 2", faculty = "DERECHO",
       sample_role = "titular", stratum = "DERECHO / M / G1", eligible_n = 28, expected_valid = 18)
)

.mau_ch1 <- function(plan) Filter(function(u) identical(as.character(u$operational_code), "CH 1"), plan)[[1]]

test_that("`applied_date` del libro llega a `applied_at` del plan", {
  n <- monitoreo_aulas_update_agenda(.mau_plan(), list(list(
    operational_code = "CH 1", operational_status = "aplicada", applied_date = "2026-09-01"
  )))
  expect_identical(.mau_ch1(n)$applied_at, "2026-09-01")
})

test_that("y los demas alias del vocabulario del libro tambien", {
  n <- monitoreo_aulas_update_agenda(.mau_plan(), list(list(
    operational_code = "CH 1", operational_status = "aplicada",
    fecha_aplicacion = "2026-09-02", observaciones = "El docente pidio el final",
    aplicador = "Perez, Ana"
  )))
  u <- .mau_ch1(n)
  expect_identical(u$applied_at, "2026-09-02")
  expect_identical(u$field_note, "El docente pidio el final")
  expect_identical(u$applied_by, "Perez, Ana")
})

test_that("el nombre canonico sigue funcionando igual", {
  # El alias no puede romper lo que ya entraba bien.
  n <- monitoreo_aulas_update_agenda(.mau_plan(), list(list(
    operational_code = "CH 1", operational_status = "aplicada", applied_at = "2026-09-03"
  )))
  expect_identical(.mau_ch1(n)$applied_at, "2026-09-03")
})

test_that("una columna que NO es alias de nada se sigue ignorando", {
  # La traduccion no es una puerta abierta: lo que el plan no tiene, no entra.
  n <- monitoreo_aulas_update_agenda(.mau_plan(), list(list(
    operational_code = "CH 1", columna_inventada = "x"
  )))
  expect_null(.mau_ch1(n)$columna_inventada)
})
