test_that("job_submit no rompe workers antiguos sin progress_path", {
  skip_if_not_installed("callr")

  old_api_dir <- Sys.getenv("PULSO_API_DIR", unset = NA_character_)
  Sys.setenv(PULSO_API_DIR = normalizePath(".", mustWork = TRUE))
  on.exit({
    if (is.na(old_api_dir)) {
      Sys.unsetenv("PULSO_API_DIR")
    } else {
      Sys.setenv(PULSO_API_DIR = old_api_dir)
    }
    jobs_kill_all()
  }, add = TRUE)

  sid <- session_create()
  job_id <- job_submit(
    sid = sid,
    kind = "unit.legacy_worker",
    func = function(value) {
      list(ok = TRUE, value = value)
    },
    args = list(value = 42L)
  )

  deadline <- Sys.time() + 15
  repeat {
    job <- job_poll(job_id)
    if (!identical(job$status, "running")) break
    if (Sys.time() > deadline) fail("El job de prueba no termino a tiempo.")
    Sys.sleep(0.2)
  }

  expect_equal(job$status, "done")
  expect_true(isTRUE(job$result_data$ok))
  expect_equal(job$result_data$value, 42L)
  expect_equal(job_snapshot(job)$progress$percent, 100)
})
