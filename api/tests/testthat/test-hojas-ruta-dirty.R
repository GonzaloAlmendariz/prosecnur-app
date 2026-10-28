# L22: mirar Hojas de ruta no deja el proyecto «sin guardar». La página persiste
# el workspace tras cada cambio de UI; sólo un cambio que no sea la posición de
# la UI (ui_state) cuenta como edición.

.hr_sesion_con_proyecto <- function() {
  sid <- session_create()
  s <- session_get(sid)
  s$project_path <- tempfile(fileext = ".pulso")
  .session_env[[sid]] <- s
  sid
}

test_that("sembrar la corrida por defecto al leer no ensucia", {
  sid <- .hr_sesion_con_proyecto()
  on.exit(session_delete(sid))
  .hojas_ruta_ensure_runs(sid)
  expect_false(isTRUE(session_get(sid)$project_dirty))
})

test_that("cambiar sólo la etapa visible no ensucia; re-guardar la misma config tampoco", {
  sid <- .hr_sesion_con_proyecto()
  on.exit(session_delete(sid))
  activa <- .hojas_ruta_active_run(sid)
  .hojas_ruta_save_run(sid, activa$phase, ui_state = list(active_stage = "muestra"))
  expect_false(isTRUE(session_get(sid)$project_dirty))
  expect_identical(.hojas_ruta_active_run(sid)$run$ui_state$active_stage, "muestra")

  # Ida y vuelta por JSON, como llega del cliente.
  cfg <- jsonlite::fromJSON(jsonlite::toJSON(activa$run$config, auto_unbox = TRUE, null = "null"), simplifyVector = FALSE)
  .hojas_ruta_save_run(sid, activa$phase, config = cfg)
  expect_false(isTRUE(session_get(sid)$project_dirty))
})

test_that("cambiar la configuración sí ensucia y lo nombra", {
  sid <- .hr_sesion_con_proyecto()
  on.exit(session_delete(sid))
  activa <- .hojas_ruta_active_run(sid)
  cfg <- activa$run$config
  cfg$sampling_method <- if (identical(cfg$sampling_method, "pps")) "sistematico" else "pps"
  .hojas_ruta_save_run(sid, activa$phase, config = cfg)
  s <- session_get(sid)
  expect_true(isTRUE(s$project_dirty))
  expect_identical(names(s$project_dirty_reasons), "hojas_ruta_runs")
})
