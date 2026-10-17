# F14 — job_cancel descartaba resultados ya terminados.
#
# El status "running" es perezoso: solo job_poll lo actualiza. Si el worker
# termino y nadie polleo, cancel marcaba "cancelled" y el resultado (y su
# on_complete) se perdian. Ahora cancel cosecha primero: worker muerto =>
# job_poll; si termino bien queda "done" y no se cancela nada.

test_that("cancel sobre un job terminado sin poll cosecha el resultado como done", {
  skip_if_not_installed("callr")

  old_api_dir <- Sys.getenv("PULSO_API_DIR", unset = NA_character_)
  Sys.setenv(PULSO_API_DIR = normalizePath(".", mustWork = TRUE))
  on.exit({
    if (is.na(old_api_dir)) Sys.unsetenv("PULSO_API_DIR") else Sys.setenv(PULSO_API_DIR = old_api_dir)
    jobs_kill_all()
  }, add = TRUE)

  sid <- session_create()
  completado <- new.env(parent = emptyenv())
  completado$fired <- FALSE
  job_id <- job_submit(
    sid = sid,
    kind = "unit.cancel_after_done",
    func = function(value) list(ok = TRUE, value = value),
    args = list(value = 7L),
    on_complete = function(j) {
      completado$fired <- TRUE
      j$result_data
    }
  )

  # Esperar a que el WORKER muera sin pollear (job_poll marcaria done y el
  # test no probaria nada): miramos rx$is_alive() directo en el store.
  j <- prosecnurapp:::.jobs[[job_id]]
  deadline <- Sys.time() + 60
  repeat {
    alive <- tryCatch(j$rx$is_alive(), error = function(e) FALSE)
    if (!alive) break
    if (Sys.time() > deadline) fail("El worker de prueba no termino a tiempo.")
    Sys.sleep(0.2)
  }
  # Nadie polleo: el store todavia cree que corre.
  expect_equal(prosecnurapp:::.jobs[[job_id]]$status, "running")

  expect_true(job_cancel(job_id))

  cosechado <- job_get(job_id)
  expect_equal(cosechado$status, "done")      # NO "cancelled"
  expect_equal(cosechado$result_data$value, 7L)
  expect_true(isTRUE(completado$fired))       # el on_complete corrio
  expect_equal(job_snapshot(cosechado)$progress$percent, 100)
})

test_that("cancel sobre un job realmente vivo sigue cancelando", {
  skip_if_not_installed("callr")

  old_api_dir <- Sys.getenv("PULSO_API_DIR", unset = NA_character_)
  Sys.setenv(PULSO_API_DIR = normalizePath(".", mustWork = TRUE))
  on.exit({
    if (is.na(old_api_dir)) Sys.unsetenv("PULSO_API_DIR") else Sys.setenv(PULSO_API_DIR = old_api_dir)
    jobs_kill_all()
  }, add = TRUE)

  sid <- session_create()
  job_id <- job_submit(
    sid = sid,
    kind = "unit.cancel_running",
    func = function() {
      Sys.sleep(120)
      list(ok = TRUE)
    }
  )

  # El worker sigue vivo (dormido en el sleep o cargando el paquete).
  expect_true(job_cancel(job_id))
  j <- job_get(job_id)
  expect_equal(j$status, "cancelled")
  expect_false(tryCatch(j$rx$is_alive(), error = function(e) FALSE))
})

test_that("cancel de un job inexistente devuelve FALSE", {
  expect_false(job_cancel("no-existe-este-job"))
})

# U-B0 — on_cleanup: los insumos efímeros de un job (RDS con secretos/estado en
# jobs/inputs) se borran en TODO final, no solo cuando on_complete corre.

# Devuelve la función que restaura PULSO_API_DIR y mata los workers vivos.
.jc_with_api_dir <- function() {
  old_api_dir <- Sys.getenv("PULSO_API_DIR", unset = NA_character_)
  Sys.setenv(PULSO_API_DIR = normalizePath(".", mustWork = TRUE))
  function() {
    if (is.na(old_api_dir)) Sys.unsetenv("PULSO_API_DIR") else Sys.setenv(PULSO_API_DIR = old_api_dir)
    jobs_kill_all()
  }
}

.jc_wait_dead <- function(job_id, secs = 90) {
  j <- prosecnurapp:::.jobs[[job_id]]
  deadline <- Sys.time() + secs
  while (tryCatch(j$rx$is_alive(), error = function(e) FALSE)) {
    if (Sys.time() > deadline) fail("El worker de prueba no terminó a tiempo.")
    Sys.sleep(0.2)
  }
}

test_that("cancelar un job vivo corre on_cleanup y borra el RDS de insumos", {
  skip_if_not_installed("callr")
  restore_env <- .jc_with_api_dir()
  on.exit(restore_env(), add = TRUE)

  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  secret_path <- job_save_rds(sid, "unit_secretos", list(token = "no-debe-quedar"))
  calls <- new.env(parent = emptyenv())
  calls$n <- 0L
  job_id <- job_submit(
    sid = sid,
    kind = "unit.cancel_cleanup",
    func = function(secret_path) {
      Sys.sleep(120)
      list(ok = TRUE)
    },
    args = list(secret_path = secret_path),
    on_complete = function(j) stop("on_complete no debe correr al cancelar"),
    on_cleanup = function(j) {
      calls$n <- calls$n + 1L
      job_unlink_inputs(secret_path)
    }
  )
  expect_true(file.exists(secret_path))

  expect_true(job_cancel(job_id))
  expect_equal(job_get(job_id)$status, "cancelled")
  expect_false(file.exists(secret_path))
  expect_equal(calls$n, 1L)

  # Idempotente: cancelar/pollear de nuevo no repite el cleanup.
  job_cancel(job_id)
  job_poll(job_id)
  expect_equal(calls$n, 1L)
})

test_that("un worker que falla corre on_cleanup al cosecharse como error", {
  skip_if_not_installed("callr")
  restore_env <- .jc_with_api_dir()
  on.exit(restore_env(), add = TRUE)

  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  secret_path <- job_save_rds(sid, "unit_secretos", list(token = "no-debe-quedar"))
  job_id <- job_submit(
    sid = sid,
    kind = "unit.error_cleanup",
    func = function() stop("falla deliberada del worker"),
    on_cleanup = function(j) job_unlink_inputs(secret_path)
  )
  .jc_wait_dead(job_id)
  j <- job_poll(job_id)
  expect_equal(j$status, "error")
  expect_false(file.exists(secret_path))
})

test_that("cancelar un import de plataforma real no deja RDS de carga en jobs/inputs", {
  skip_if_not_installed("callr")
  restore_env <- .jc_with_api_dir()
  on.exit(restore_env(), add = TRUE)

  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  prosecnur_session_secret_save(sid, "kobo_token", "token-efimero-de-prueba")
  on.exit(prosecnur_session_secret_clear(sid, "kobo_token"), add = TRUE)

  inputs_dir <- file.path(session_get(sid)$dir, "jobs", "inputs")
  handle <- .carga_platform_job_submit(sid, "kobo_import_separate", list(
    asset_uid = "asset-sin-red", base_url = "http://127.0.0.1:9", async = TRUE
  ))
  expect_true(isTRUE(handle$async))
  expect_true(length(list.files(inputs_dir, pattern = "^carga_platform_")) >= 2L)

  expect_true(job_cancel(handle$job_id))
  expect_true(job_get(handle$job_id)$status %in% c("cancelled", "done", "error"))
  expect_length(list.files(inputs_dir, pattern = "^carga_platform_"), 0L)
  # Ni cancelado ni cosechado, el estudio recibió una base del job.
  expect_length(estudio_list_bases(sid), 0L)
})

test_that("un on_complete que falla deja el job en error con su mensaje, no en done", {
  skip_if_not_installed("callr")
  old_api_dir <- Sys.getenv("PULSO_API_DIR", unset = NA_character_)
  Sys.setenv(PULSO_API_DIR = normalizePath(".", mustWork = TRUE))
  on.exit({
    if (is.na(old_api_dir)) Sys.unsetenv("PULSO_API_DIR") else Sys.setenv(PULSO_API_DIR = old_api_dir)
    jobs_kill_all()
  }, add = TRUE)
  sid <- session_create()
  job_id <- job_submit(
    sid = sid,
    kind = "unit.on_complete_falla",
    func = function(value) list(ok = TRUE, value = value),
    args = list(value = 1L),
    on_complete = function(j) stop_api(409, "E_CODIF_RESPUESTAS_CAMBIARON", "Las respuestas cambiaron.")
  )
  deadline <- Sys.time() + 60
  repeat {
    j <- job_poll(job_id)
    if (!identical(j$status, "running")) break
    if (Sys.time() > deadline) fail("El worker de prueba no termino a tiempo.")
    Sys.sleep(0.2)
  }
  expect_equal(j$status, "error")
  expect_equal(j$error, "Las respuestas cambiaron.")
  expect_null(j$result_public)
})
