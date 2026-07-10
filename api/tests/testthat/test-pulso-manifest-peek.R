test_that("manifest peek tolera rutas inexistentes", {
  out <- .pulso_manifest_peek(tempfile(fileext = ".pulso"))
  expect_false(out$exists)
  expect_false(out$readable)
  expect_true(is.na(out$project_name))
})

test_that("manifest peek lee solo el manifest de un .pulso", {
  skip_if_not_installed("zip")
  stage <- tempfile("peek_stage_")
  dir.create(stage, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)

  manifest <- list(
    format_version = 1L,
    project_name = "Proyecto Peek",
    processing_mode = "multibase",
    n_bases = 3L,
    n_files = 5L,
    saved_at = "2026-07-05T12:00:00Z"
  )
  writeLines(
    jsonlite::toJSON(manifest, auto_unbox = TRUE),
    con = file.path(stage, "manifest.json"), useBytes = TRUE
  )
  # state.rds voluminoso que NO debe leerse en el peek.
  saveRDS(list(dummy = seq_len(1000L)), file.path(stage, "state.rds"))

  dest <- tempfile(fileext = ".pulso")
  old_wd <- getwd()
  setwd(stage)
  on.exit(setwd(old_wd), add = TRUE)
  zip::zip(dest, files = list.files(".", recursive = TRUE))
  setwd(old_wd)

  out <- .pulso_manifest_peek(dest)
  expect_true(out$exists)
  expect_true(out$readable)
  expect_equal(out$project_name, "Proyecto Peek")
  expect_equal(out$processing_mode, "multibase")
  expect_equal(out$n_bases, 3L)
  expect_equal(out$n_files, 5L)
  expect_equal(out$saved_at, "2026-07-05T12:00:00Z")
})
