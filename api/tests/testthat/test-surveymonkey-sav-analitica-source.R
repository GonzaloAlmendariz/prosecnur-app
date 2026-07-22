library(testthat)

.sav_analitica_file <- function(file_id, kind) {
  list(
    file_id = file_id,
    kind = kind,
    path = tempfile(fileext = if (identical(kind, "sav")) ".sav" else ".xlsx")
  )
}

.sav_analitica_state <- function(files, base) {
  list(
    files = setNames(files, vapply(files, `[[`, character(1), "file_id")),
    estudio = list(bases = list(actor = base))
  )
}

test_that("Analitica usa el SAV vigente tras reemplazar los datos de la base", {
  instrument <- .sav_analitica_file("xls_vigente", "xlsform")
  previous_data <- .sav_analitica_file("data_previo", "data")
  current_sav <- .sav_analitica_file("sav_vigente", "sav")
  base <- list(
    xlsform_file_id = instrument$file_id,
    original_xlsform_file_id = instrument$file_id,
    data_file_id = current_sav$file_id,
    original_data_file_id = previous_data$file_id,
    source_kind = "surveymonkey_sav_bundle"
  )
  state <- .sav_analitica_state(
    list(instrument, previous_data, current_sav),
    base
  )

  resolved <- .analitica_pair_for_base(
    state,
    base,
    fuente = "originales",
    base_name = "actor"
  )

  expect_identical(resolved$data$file_id, current_sav$file_id)
})

test_that("Analitica usa el instrumento vigente cuando no esta adaptado", {
  previous_instrument <- .sav_analitica_file("xls_previo", "xlsform")
  current_instrument <- .sav_analitica_file("xls_vigente", "xlsform")
  current_sav <- .sav_analitica_file("sav_vigente", "sav")
  base <- list(
    xlsform_file_id = current_instrument$file_id,
    original_xlsform_file_id = previous_instrument$file_id,
    data_file_id = current_sav$file_id,
    original_data_file_id = current_sav$file_id
  )
  state <- .sav_analitica_state(
    list(previous_instrument, current_instrument, current_sav),
    base
  )

  resolved <- .analitica_pair_for_base(
    state,
    base,
    fuente = "originales",
    base_name = "actor"
  )

  expect_identical(resolved$xls$file_id, current_instrument$file_id)
})

test_that("Analitica conserva los IDs originales de una base adaptada", {
  original_instrument <- .sav_analitica_file("xls_original", "xlsform")
  adapted_instrument <- .sav_analitica_file("xls_adaptado", "instrumento_adaptado")
  original_data <- .sav_analitica_file("data_original", "sav")
  adapted_data <- .sav_analitica_file("data_adaptada", "data_adaptada")
  base <- list(
    xlsform_file_id = adapted_instrument$file_id,
    original_xlsform_file_id = original_instrument$file_id,
    data_file_id = adapted_data$file_id,
    original_data_file_id = original_data$file_id
  )
  state <- .sav_analitica_state(
    list(original_instrument, adapted_instrument, original_data, adapted_data),
    base
  )

  resolved <- .analitica_pair_for_base(
    state,
    base,
    fuente = "originales",
    base_name = "actor"
  )

  expect_identical(
    c(xls = resolved$xls$file_id, data = resolved$data$file_id),
    c(xls = original_instrument$file_id, data = original_data$file_id)
  )
})
