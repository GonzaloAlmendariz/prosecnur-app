# callr deja en el tempdir del backend el resultado serializado de cada worker
# (callr-res-*, más el func y los scripts) y sólo lo borra cuando el objeto
# r_process se recolecta. El registro `.jobs` conserva `j$rx` para siempre, así
# que nada se borraba: un warm start deja ~713 MB por corrida y un backend de
# una mañana acumuló 16 GB (2026-10-30, disco lleno en una semana).

.esperar_job <- function(job_id, segundos = 30) {
  deadline <- Sys.time() + segundos
  repeat {
    job <- job_poll(job_id)
    if (!identical(job$status, "running")) return(job)
    if (Sys.time() > deadline) fail("El job de prueba no terminó a tiempo.")
    Sys.sleep(0.2)
  }
}

.temporales_callr <- function(job) {
  as.character(job$rx$.__enclos_env__$private$options$tmp_files %||% character(0))
}

.con_api_dir <- function(env = parent.frame()) {
  old_api_dir <- Sys.getenv("PULSO_API_DIR", unset = NA_character_)
  Sys.setenv(PULSO_API_DIR = normalizePath(".", mustWork = TRUE))
  withr::defer({
    if (is.na(old_api_dir)) Sys.unsetenv("PULSO_API_DIR") else Sys.setenv(PULSO_API_DIR = old_api_dir)
    jobs_kill_all()
  }, envir = env)
}

test_that("cosechar un job borra los temporales de callr, resultado incluido", {
  skip_if_not_installed("callr")
  .con_api_dir()

  sid <- session_create()
  job_id <- job_submit(
    sid = sid,
    kind = "unit.temporales_callr",
    func = function(n) list(ok = TRUE, carga = rep(1, n)),
    args = list(n = 1e5)
  )
  rx_tmp <- .temporales_callr(.jobs[[job_id]])
  expect_true(any(grepl("callr-res-", rx_tmp)))

  job <- .esperar_job(job_id)

  expect_equal(job$status, "done")
  expect_length(job$result_data$carga, 1e5)
  expect_false(any(file.exists(rx_tmp)), info = paste(rx_tmp[file.exists(rx_tmp)], collapse = ", "))
})

test_that("un worker que falla también suelta sus temporales", {
  skip_if_not_installed("callr")
  .con_api_dir()

  sid <- session_create()
  job_id <- job_submit(
    sid = sid,
    kind = "unit.temporales_callr_error",
    func = function() stop("falla adrede"),
    args = list()
  )
  rx_tmp <- .temporales_callr(.jobs[[job_id]])
  expect_true(any(grepl("callr-res-", rx_tmp)))

  job <- .esperar_job(job_id)

  expect_equal(job$status, "error")
  expect_false(any(file.exists(rx_tmp)))
})

test_that("cancelar un job en curso suelta sus temporales", {
  skip_if_not_installed("callr")
  .con_api_dir()

  sid <- session_create()
  job_id <- job_submit(
    sid = sid,
    kind = "unit.temporales_callr_cancel",
    func = function() { Sys.sleep(30); list(ok = TRUE) },
    args = list()
  )
  rx_tmp <- .temporales_callr(.jobs[[job_id]])
  expect_true(any(grepl("callr-res-", rx_tmp)))

  expect_true(job_cancel(job_id))

  expect_equal(.jobs[[job_id]]$status, "cancelled")
  expect_false(any(file.exists(rx_tmp)))
})

test_that("retener_resultado = FALSE suelta result_data tras on_complete y conserva lo público", {
  skip_if_not_installed("callr")
  .con_api_dir()

  sid <- session_create()
  visto <- NULL
  job_id <- job_submit(
    sid = sid,
    kind = "unit.sin_retener",
    func = function() list(ok = TRUE, session_patch = list(pesado = rep(1, 1e5))),
    args = list(),
    on_complete = function(j) {
      visto <<- length(j$result_data$session_patch$pesado)
      list(ok = TRUE, aplicado = TRUE)
    },
    retener_resultado = FALSE
  )

  job <- .esperar_job(job_id)

  expect_equal(job$status, "done")
  expect_equal(visto, 1e5)
  expect_null(job$result_data)
  expect_null(.jobs[[job_id]]$result_data)
  expect_true(isTRUE(job_snapshot(job)$result_data$aplicado))
})

test_that("por defecto result_data se retiene para quien lo lea después", {
  skip_if_not_installed("callr")
  .con_api_dir()

  sid <- session_create()
  job_id <- job_submit(
    sid = sid,
    kind = "unit.retener",
    func = function() list(ok = TRUE, valor = 7L),
    args = list(),
    on_complete = function(j) list(ok = TRUE)
  )

  job <- .esperar_job(job_id)

  expect_equal(job$result_data$valor, 7L)
})

test_that("el warm start del proyecto no retiene su session_patch en el registro de jobs", {
  cuerpo <- paste(deparse(.project_warmup_start), collapse = "\n")
  expect_match(cuerpo, "retener_resultado = FALSE", fixed = TRUE)
})
