source("setup-load-all.R")

test_that("una base repeat vacia sigue contando como importada", {
  meta <- list(
    nombre = "rep_servicios",
    source_kind = "kobo_repeat",
    parent_base = "madre",
    repeat_group = "rep_servicios",
    xlsform_file_id = "xls-repeat",
    data_file_id = "data-repeat",
    n_filas = 0L
  )

  status <- .estudio_base_status_payload(meta, s = list(files = list()))

  expect_true(status$imported)
})

test_that("una base sin el par instrumento-data no cuenta como importada", {
  meta <- list(
    nombre = "incompleta",
    xlsform_file_id = "xls-only",
    data_file_id = "",
    n_filas = 10L
  )

  status <- .estudio_base_status_payload(meta, s = list(files = list()))

  expect_false(status$imported)
})
