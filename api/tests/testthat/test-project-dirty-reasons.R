# L22: «sin guardar» dice QUÉ cambió. `project_dirty_reasons` acumula un motivo
# por clave de sesión (o por función que marcó) y se vacía al guardar.

test_that("session_set anota la clave como motivo y el guardado lo vacía", {
  setup <- list(sid = session_create())
  on.exit(session_delete(setup$sid))
  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(setup$sid, tmp)
  expect_identical(project_status(setup$sid)$dirty_reasons, list())

  session_set(setup$sid, "codif_source_active", "a")
  session_set(setup$sid, "codif_source_active", "b")
  st <- project_status(setup$sid)
  expect_true(st$dirty)
  expect_length(st$dirty_reasons, 1L)
  expect_identical(st$dirty_reasons[[1]]$motivo, "codif_source_active")
  expect_identical(st$dirty_reasons[[1]]$veces, 2L)

  build_pulso(setup$sid, tmp)
  st2 <- project_status(setup$sid)
  expect_false(st2$dirty)
  expect_identical(st2$dirty_reasons, list())
  expect_null(session_get(setup$sid)$project_dirty_reasons)
})

test_that("sin motivo explícito se anota la función que marcó", {
  setup <- list(sid = session_create())
  on.exit(session_delete(setup$sid))
  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(setup$sid, tmp)

  marcar_desde_un_motor <- function(sid) {
    s <- session_get(sid)
    s <- .mark_project_dirty(s)
    .session_env[[sid]] <- s
  }
  marcar_desde_un_motor(setup$sid)
  motivos <- vapply(project_status(setup$sid)$dirty_reasons, `[[`, "", "motivo")
  expect_identical(motivos, "marcar_desde_un_motor")
})

test_that("sin proyecto abierto no se anota nada", {
  setup <- list(sid = session_create())
  on.exit(session_delete(setup$sid))
  session_set(setup$sid, "codif_source_active", "a")
  expect_null(session_get(setup$sid)$project_dirty_reasons)
})
