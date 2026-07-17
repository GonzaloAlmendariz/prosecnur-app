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
