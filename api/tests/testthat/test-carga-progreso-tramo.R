test_that("las páginas de una encuesta avanzan dentro de su tramo: la barra no retrocede", {
  vistos <- numeric(0)
  viejo <- .carga_jobs_env$report
  on.exit(.carga_jobs_env$report <- viejo, add = TRUE)
  .carga_jobs_env$report <- function(phase, current = NULL, total = NULL, percent = NULL, message = NULL) {
    vistos <<- c(vistos, percent %||% NA_real_)
  }
  # Encuesta 2 de 2: sus páginas 1/3, 2/3 y 3/3 van de 50 % a 100 %, nunca por debajo.
  .cfp_con_progreso_tramo(2, 2, function() {
    for (p in 1:3) .carga_job_progress("fetch", current = p, total = 3)
  })
  expect_equal(vistos, c(67, 83, 100))
  # Al salir, el reporter original vuelve a su lugar.
  expect_true(is.function(.carga_jobs_env$report))
  # Sin reporter instalado la función sólo corre el trabajo.
  .carga_jobs_env$report <- NULL
  expect_identical(.cfp_con_progreso_tramo(1, 2, function() "ok"), "ok")
})
