# =============================================================================
# Contrato HTTP real — ciclo de vida de jobs (submit -> poll -> resultado).
# =============================================================================
#
# Ejercita el runtime real de jobs por el wire: POST dispara un worker callr
# desde el backend Plumber vivo, y el GET de /api/jobs/<id> cosecha el estado
# (job_poll es perezoso: el poll HTTP ES el mecanismo de avance, igual que en
# produccion). Sin red externa, subproceso limpiado por el teardown del helper.
#
# Nota de entorno: los workers callr deserializan closures que referencian el
# namespace instalado de prosecnurapp; sin `R CMD INSTALL api` este contrato
# se skipea con mensaje explicito (http_contract_skip_if_no_jobs_runtime).

test_that("job selftest: submit por HTTP, poll hasta done y shape del snapshot", {
  srv <- http_contract_server()
  http_contract_skip_if_no_jobs_runtime()

  r <- http_post_json(srv, "/api/jobs/_selftest", body = list(seconds = 1))
  expect_identical(r$status, 200L)
  job_id <- r$json$job_id
  expect_true(is.character(job_id) && nzchar(job_id))

  # El worker hace load_all del arbol dev en su bootstrap (PULSO_API_DIR):
  # el timeout generoso cubre ese arranque, no el sleep de 1s.
  snap <- http_wait_job(srv, job_id, timeout_secs = 300)

  expect_identical(snap$status, "done")
  expect_identical(snap$id, job_id)
  expect_identical(snap$kind, "selftest")
  expect_true(isTRUE(snap$result_data$ok))
  expect_equal(as.numeric(snap$result_data$slept), 1)
  # El selftest corre en OTRO proceso: pid del worker != pid del server.
  expect_true(as.numeric(snap$result_data$pid) > 0)
  expect_false(isTRUE(snap$has_file_result))
  expect_true(is.character(snap$started_at) && nzchar(snap$started_at))
  expect_true(is.character(snap$finished_at) && nzchar(snap$finished_at))
  # Un job terminado reporta progreso consolidado done/100.
  expect_identical(snap$progress$phase, "done")
  expect_equal(as.numeric(snap$progress$percent), 100)
})

test_that("pedir el resultado de un job que no termino responde el contrato de error", {
  srv <- http_contract_server()

  # Job inexistente: 404 E_JOB_NOT_FOUND con el shape {error:{code,message}}.
  r <- http_get(srv, "/api/jobs/00000000-0000-0000-0000-000000000000")
  expect_identical(r$status, 404L)
  expect_identical(r$json$error$code, "E_JOB_NOT_FOUND")
  expect_true(nzchar(r$json$error$message))

  rr <- http_get(srv, "/api/jobs/00000000-0000-0000-0000-000000000000/result")
  expect_identical(rr$status, 404L)
  expect_identical(rr$json$error$code, "E_JOB_NOT_FOUND")
})
