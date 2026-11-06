# «Cuentan» de Control › Equipo territorial (extensión de la decisión de 2h,
# Gonzalo 2026-11-01): efectivas validadas no anuladas, la misma base del avance.
# `valid_responses` sigue midiendo la efectiva de la plataforma para el impacto
# de una anulación.

test_that("advance_valid_responses cuenta advance_valid sin las anuladas", {
  audit <- data.frame(
    responsible_display = "P198 · Aplicador Uno",
    submitted_by = "p198",
    pulso_code = "P198",
    submission_date_iso = "2026-06-16",
    source_effective = c(TRUE, TRUE, TRUE, TRUE),
    advance_valid = c(TRUE, TRUE, FALSE, TRUE),
    production_annulled = c(FALSE, FALSE, FALSE, TRUE),
    stringsAsFactors = FALSE
  )
  r <- .monitoreo_territorial_responsibles_for_annulment(audit, list(), "field")
  expect_length(r, 1L)
  expect_identical(r[[1]]$valid_responses, 4L)
  expect_identical(r[[1]]$advance_valid_responses, 2L)
})

test_that("sin la columna de anuladas y con advance_valid NA no se cae ni cuenta de más", {
  audit <- data.frame(
    responsible_display = "P198 · Aplicador Uno", submitted_by = "p198", pulso_code = "P198",
    submission_date_iso = "2026-06-16", source_effective = TRUE,
    advance_valid = c(TRUE, NA, TRUE), stringsAsFactors = FALSE
  )
  r <- .monitoreo_territorial_responsibles_for_annulment(audit, list(), "field")
  expect_identical(r[[1]]$advance_valid_responses, 2L)
})
