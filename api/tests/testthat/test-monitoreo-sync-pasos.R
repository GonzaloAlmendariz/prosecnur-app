# =============================================================================
# El sync de Monitoreo dice en qué paso va (Meta B, L38 y estándar §2b)
# =============================================================================
#
# La píldora de la barra del modo dice «Actualizando, paso N de M». El job ya
# escribía `current`/`total`, pero dentro de una fuente esos dos números son
# registros de Kobo o de SurveyMonkey, no fuentes: no servían para contar pasos.
# El progreso lleva ahora `step`/`steps`, aditivos: las N fuentes son los pasos
# 1..N y el paso N + 1 une el snapshot y recalcula.

test_that("job_progress_writer escribe step y steps cuando se pasan", {
  path <- tempfile(fileext = ".progress")
  report <- job_progress_writer(path)
  report("sheets_fetch", percent = 20, message = "Leyendo", step = 2, steps = 4)
  got <- jsonlite::fromJSON(paste(readLines(path, warn = FALSE), collapse = "\n"))
  expect_identical(got$step, 2L)
  expect_identical(got$steps, 4L)
  expect_identical(got$phase, "sheets_fetch")
})

test_that("job_progress_writer sin pasos escribe lo mismo que antes", {
  path <- tempfile(fileext = ".progress")
  report <- job_progress_writer(path)
  report("running", percent = 50)
  got <- jsonlite::fromJSON(paste(readLines(path, warn = FALSE), collapse = "\n"))
  expect_false("step" %in% names(got))
  expect_false("steps" %in% names(got))
  expect_identical(got$percent, 50L)
})

test_that("monitoreo_sync_sources numera una fuente por paso y recalcula en el último", {
  llamadas <- list()
  testthat::local_mocked_bindings(
    job_progress_writer = function(progress_path) {
      function(phase = "running", current = NULL, total = NULL, percent = NULL,
               message = NULL, step = NULL, steps = NULL) {
        llamadas[[length(llamadas) + 1L]] <<- list(phase = phase, step = step, steps = steps)
        invisible(NULL)
      }
    },
    monitoreo_sync_source = function(src, since = NULL, progress = NULL, ...) {
      # Un avance interno con `current`/`total` de registros, como Kobo.
      if (is.function(progress)) progress(10, 400, "Descargando respuestas")
      if (identical(src$id, "b")) stop("sin acceso")
      data.frame(`_id` = c("1", "2"), .source_id = src$id, check.names = FALSE)
    }
  )
  fuentes <- list(
    list(id = "a", kind = "google_sheets", label = "Universo", enabled = TRUE),
    list(id = "b", kind = "kobo", label = "Kobo", enabled = TRUE),
    list(id = "c", kind = "google_sheets", label = "Barrido", enabled = TRUE)
  )
  monitoreo_sync_sources(fuentes, config = list(), progress_path = "simulado", build_dashboard = FALSE)

  con_paso <- Filter(function(x) !is.null(x$step), llamadas)
  expect_true(length(con_paso) > 0)
  expect_true(all(vapply(con_paso, function(x) identical(as.integer(x$steps), 4L), logical(1))))
  pasos <- vapply(con_paso, function(x) as.integer(x$step), integer(1))
  # Nunca retrocede y llega al paso de recalcular.
  expect_identical(pasos, cummax(pasos))
  expect_identical(max(pasos), 4L)
  # El avance interno de una fuente lleva el paso de su fuente, no el de sus registros.
  internos <- Filter(function(x) identical(x$phase, "sheets_fetch") || identical(x$phase, "kobo_fetch"), con_paso)
  expect_true(all(vapply(internos, function(x) x$step <= 3L, logical(1))))
  # La fuente que falla también cuenta su paso.
  error <- Filter(function(x) identical(x$phase, "source_error"), con_paso)
  expect_identical(as.integer(error[[1]]$step), 2L)
})
