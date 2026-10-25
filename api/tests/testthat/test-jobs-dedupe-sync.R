# M7 de Meta B (L38): un sync de Monitoreo a la vez por sesión.
#
# El front apaga «Actualizar» mientras corre uno, pero dos pestañas o una
# llamada directa a la API lanzaban un segundo job sobre el mismo snapshot. Con
# `dedupe_key` (opt-in) job_submit devuelve el job vivo marcado `ya_en_curso` en
# vez de lanzar otro; un job terminado, fallido, cancelado, huérfano (proceso
# muerto) o pasado de tope libera la clave.
#
# Sin worker real: `callr::r_bg` se sustituye por un proceso falso cuyo
# is_alive() controla el test. No hace falta `R CMD INSTALL`.

.dedupe_proceso_falso <- function(vivo = TRUE, resultado = list(ok = TRUE)) {
  p <- new.env(parent = emptyenv())
  p$vivo <- vivo
  p$matado <- FALSE
  p$is_alive <- function() p$vivo
  p$get_result <- function() resultado
  p$kill <- function() {
    p$matado <- TRUE
    p$vivo <- FALSE
    invisible(TRUE)
  }
  p
}

# Sustituye callr::r_bg y cuenta los lanzamientos; devuelve el registro.
.dedupe_simular_workers <- function(env = parent.frame()) {
  registro <- new.env(parent = emptyenv())
  registro$lanzados <- list()
  testthat::local_mocked_bindings(
    r_bg = function(...) {
      p <- .dedupe_proceso_falso()
      registro$lanzados[[length(registro$lanzados) + 1L]] <- p
      p
    },
    .package = "callr",
    .env = env
  )
  withr::defer(jobs_kill_all(), envir = env)
  registro
}

.dedupe_fuente_kobo <- list(
  id = "kobo_demo", kind = "kobo", label = "Demo", asset_uid = "aDemo",
  base_url = "http://127.0.0.1:9", role = "principal", active = TRUE
)

# Llama al handler real de POST /api/monitoreo/sync en proceso (mismo wrap_endpoint).
.dedupe_post_sync <- function(sid, body = list()) {
  pr <- mount_monitoreo(plumber::pr())
  ep <- NULL
  for (grupo in pr$endpoints) for (e in grupo) {
    if (identical(e$path, "/api/monitoreo/sync") && "POST" %in% e$verbs) ep <- e
  }
  stopifnot(!is.null(ep))
  req <- new.env()
  req$HTTP_X_PULSO_SESSION <- sid
  req$postBody <- as.character(jsonlite::toJSON(body, auto_unbox = TRUE))
  res <- new.env()
  res$status <- 200L
  res$headers <- list()
  res$setHeader <- function(name, value) res$headers[[name]] <- value
  out <- ep$getFunc()(req = req, res = res)
  if (!identical(as.integer(res$status), 200L)) stop(sprintf("HTTP %s: %s", res$status, paste(capture.output(str(out)), collapse = " ")))
  out
}

test_that("dos POST /api/monitoreo/sync de la misma sesión: el segundo devuelve el job en curso", {
  registro <- .dedupe_simular_workers()
  sid <- session_create()
  session_set(sid, "monitoreo_sources", list(.dedupe_fuente_kobo))

  primero <- .dedupe_post_sync(sid)
  segundo <- .dedupe_post_sync(sid)

  expect_identical(length(registro$lanzados), 1L)
  expect_identical(segundo$job_id, primero$job_id)
  expect_identical(segundo$kind, "monitoreo.sync")
  expect_false(isTRUE(primero$ya_en_curso))
  expect_true(isTRUE(segundo$ya_en_curso))
  # La respuesta sigue siendo un JobStart (no 409): el job_id es un escalar sin atributos.
  expect_null(attributes(segundo$job_id))

  # El segundo pedido no deja sus insumos (tokens incluidos) en jobs/inputs (ADR 0005).
  inputs <- list.files(file.path(session_get(sid)$dir, "jobs", "inputs"))
  expect_identical(length(grep("^monitoreo_connection_tokens_", inputs)), 1L)
  expect_identical(length(grep("^monitoreo_sources_", inputs)), 1L)
})

test_that("otra sesión no queda bloqueada por el sync de la primera", {
  registro <- .dedupe_simular_workers()
  a <- session_create()
  b <- session_create()
  ja <- job_submit(a, "monitoreo.sync", function() NULL, dedupe_key = "monitoreo.sync")
  jb <- job_submit(b, "monitoreo.sync", function() NULL, dedupe_key = "monitoreo.sync")
  expect_false(identical(as.character(ja), as.character(jb)))
  expect_identical(length(registro$lanzados), 2L)
  expect_false(job_ya_en_curso(jb))
})

test_that("sin dedupe_key el comportamiento no cambia: cada submit lanza su job", {
  registro <- .dedupe_simular_workers()
  sid <- session_create()
  j1 <- job_submit(sid, "monitoreo.client_report_pdf", function() NULL)
  j2 <- job_submit(sid, "monitoreo.client_report_pdf", function() NULL)
  expect_false(identical(j1, j2))
  expect_identical(length(registro$lanzados), 2L)
  expect_null(attributes(j1))
})

test_that("un job terminado, fallido o cancelado libera la clave", {
  registro <- .dedupe_simular_workers()
  sid <- session_create()
  clave <- "monitoreo.sync"

  # Terminado (cosechado por el poll).
  j1 <- job_submit(sid, "monitoreo.sync", function() NULL, dedupe_key = clave)
  registro$lanzados[[1]]$vivo <- FALSE
  expect_identical(job_poll(j1)$status, "done")
  j2 <- job_submit(sid, "monitoreo.sync", function() NULL, dedupe_key = clave)
  expect_false(job_ya_en_curso(j2))
  expect_false(identical(as.character(j1), as.character(j2)))

  # Cancelado.
  expect_true(job_cancel(j2))
  j3 <- job_submit(sid, "monitoreo.sync", function() NULL, dedupe_key = clave)
  expect_false(job_ya_en_curso(j3))

  # Fallido: el worker devuelve un error al cosechar.
  registro$lanzados[[3]]$vivo <- FALSE
  registro$lanzados[[3]]$get_result <- function() stop("falló el worker")
  expect_identical(job_poll(j3)$status, "error")
  j4 <- job_submit(sid, "monitoreo.sync", function() NULL, dedupe_key = clave)
  expect_false(job_ya_en_curso(j4))
  expect_identical(length(registro$lanzados), 4L)
})

test_that("un huérfano (proceso muerto sin poll) no bloquea: se cosecha y se lanza otro", {
  registro <- .dedupe_simular_workers()
  sid <- session_create()
  aplicado <- new.env(parent = emptyenv())
  aplicado$n <- 0L
  j1 <- job_submit(sid, "monitoreo.sync", function() NULL, dedupe_key = "monitoreo.sync",
                   on_complete = function(j) { aplicado$n <- aplicado$n + 1L; NULL })
  registro$lanzados[[1]]$vivo <- FALSE   # murió; nadie polleó
  j2 <- job_submit(sid, "monitoreo.sync", function() NULL, dedupe_key = "monitoreo.sync")
  expect_false(job_ya_en_curso(j2))
  expect_identical(job_get(j1)$status, "done")   # su resultado no se perdió
  expect_identical(aplicado$n, 1L)
})

test_that("un job vivo pasado del tope se da por colgado: se cancela y libera la clave", {
  registro <- .dedupe_simular_workers()
  withr::local_options(prosecnurapp.jobs_dedupe_tope_secs = 60)
  sid <- session_create()
  j1 <- job_submit(sid, "monitoreo.sync", function() NULL, dedupe_key = "monitoreo.sync")
  viejo <- prosecnurapp:::.jobs[[j1]]
  viejo$started_at <- Sys.time() - 120
  assign(j1, viejo, envir = prosecnurapp:::.jobs)

  j2 <- job_submit(sid, "monitoreo.sync", function() NULL, dedupe_key = "monitoreo.sync")
  expect_false(job_ya_en_curso(j2))
  expect_identical(job_get(j1)$status, "cancelled")
  expect_true(registro$lanzados[[1]]$matado)
})

test_that("el sync async de hojas se deduplica con su propia clave", {
  registro <- .dedupe_simular_workers()
  sid <- session_create()
  a <- monitoreo_sheets_sync_submit_job(sid, list(), list())
  b <- monitoreo_sheets_sync_submit_job(sid, list(), list())
  expect_identical(b$job_id, a$job_id)
  expect_true(isTRUE(b$ya_en_curso))
  expect_identical(length(registro$lanzados), 1L)
})
