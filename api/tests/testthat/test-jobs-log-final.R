# Cada job cosechado deja una línea en el log de la app (jobs.R, `.job_log_final`): sin ella, un export que fallaba o
# tardaba 10 minutos en Windows no dejaba rastro en el log que se manda a soporte (Arte, 2026-10-20).

test_that(".job_log_final registra tipo, estado, duración, fases y error", {
  t0 <- as.POSIXct("2026-10-20 12:00:00", tz = "UTC")
  ok <- list(kind = "graficos.ppt", status = "done", started_at = t0, finished_at = t0 + 61.5,
             result_data = list(tiempos_ms = list(armado = 1200L, render = 58000L)))
  expect_message(.job_log_final(ok), "[jobs] kind=graficos.ppt status=done total_ms=61500 armado_ms=1200 render_ms=58000", fixed = TRUE)

  falla <- list(kind = "graficos.ppt", status = "error", started_at = t0, finished_at = t0 + 2,
                error = "Base 'docentes': Lámina 33:\n p_radar_tabla(modo='box'): no usar `var`.")
  expect_message(.job_log_final(falla), "status=error total_ms=2000 error=Base 'docentes': Lámina 33: p_radar_tabla", fixed = TRUE)
})

test_that(".job_log_final calla las miniaturas que terminan bien, no las que fallan", {
  t0 <- Sys.time()
  expect_silent(.job_log_final(list(kind = "graficos.miniaturas", status = "done", started_at = t0, finished_at = t0)))
  expect_silent(.job_log_final(list(kind = "graficos.preview_slide", status = "done", started_at = t0, finished_at = t0)))
  expect_message(.job_log_final(list(kind = "graficos.miniaturas", status = "error", started_at = t0, finished_at = t0, error = "x")),
                 "kind=graficos.miniaturas status=error", fixed = TRUE)
})
