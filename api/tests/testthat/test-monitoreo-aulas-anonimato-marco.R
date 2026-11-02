# Aulas con marco de alumnos (ADR 0125 §3; Gonzalo, 2026-11-02: «Sí, atribuir al
# marco»): con marco el anonimato pasa a FALSE solo; sin marco queda como esté.

test_that("sin marco, el anonimato queda como esté declarado", {
  cfg <- list(anonymous_responses = TRUE, source_mapping = list(student_code_var = ""))
  expect_identical(monitoreo_aulas_anonimato_por_marco(cfg, FALSE), cfg)
  ctl <- monitoreo_aulas_control_anonimato(cfg)
  expect_identical(ctl$status, "ok")
  # Declarado no anónimo y sin marco: a revisar, como antes.
  expect_identical(monitoreo_aulas_control_anonimato(list(anonymous_responses = FALSE))$status, "review")
})

test_that("con marco, el anonimato pasa a FALSE solo y el control queda ok si hay código", {
  cfg <- list(anonymous_responses = TRUE, source_mapping = list(student_code_var = "cod_pucp"))
  con <- monitoreo_aulas_anonimato_por_marco(cfg, TRUE)
  expect_false(con$anonymous_responses)
  expect_true(con$con_marco)
  ctl <- monitoreo_aulas_control_anonimato(con)
  expect_identical(ctl$status, "ok")
  expect_match(ctl$detail, "cod_pucp")
})

test_that("con marco y sin columna de código, Monitoreo lo avisa", {
  con <- monitoreo_aulas_anonimato_por_marco(list(anonymous_responses = TRUE), TRUE)
  ctl <- monitoreo_aulas_control_anonimato(con)
  expect_identical(ctl$status, "review")
  expect_match(ctl$detail, "ninguna columna con el código")
})

test_that("la sesión dice si hay marco por lo que declara el Planner", {
  testthat::local_mocked_bindings(
    .planner_payload_perfiles = function(s) list(),
    .planner_modos_de = function(perfiles, ...) list(aulas = list(con_marco = TRUE))
  )
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  expect_true(.maam_con_marco_sesion(sid))
  expect_false(.maam_con_marco_sesion(""))
})
