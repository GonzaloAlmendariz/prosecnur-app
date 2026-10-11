# test-carga-platform-jobs.R — camino async opt-in de los imports de plataforma
# (carga_platform_jobs.R, unidad perf 2.1). Sin red: los fetchers Kobo/SM se
# mockean en el namespace y el runner se ejecuta in-process (el sandbox de
# sesión es el mismo mecanismo que usa el worker callr real).

library(testthat)

.cpj_mock_binding <- function(name, value) {
  target_env <- asNamespace("prosecnurapp")
  had_previous <- exists(name, envir = target_env, inherits = FALSE)
  previous <- if (had_previous) get(name, envir = target_env) else NULL
  was_locked <- had_previous && bindingIsLocked(name, target_env)
  if (was_locked) unlockBinding(name, target_env)
  assign(name, value, envir = target_env)
  if (was_locked) lockBinding(name, target_env)

  function() {
    exists_now <- exists(name, envir = target_env, inherits = FALSE)
    is_locked <- exists_now && bindingIsLocked(name, target_env)
    if (is_locked) unlockBinding(name, target_env)
    if (had_previous) {
      assign(name, previous, envir = target_env)
    } else if (exists_now) {
      rm(list = name, envir = target_env)
    }
    if (was_locked && exists(name, envir = target_env, inherits = FALSE)) {
      lockBinding(name, target_env)
    }
  }
}

.cpj_kobo_detail <- function(asset_uid) {
  list(
    uid = asset_uid,
    name = paste("Kobo", asset_uid),
    version_id = paste0("v-", asset_uid),
    date_modified = "2026-07-01T12:00:00Z",
    deployment = list(active = TRUE),
    content = list(
      survey = list(
        list(type = "text", name = "codigo_pulso", label = "Código Pulso"),
        list(type = "select_one", select_from_list_name = "sino", name = "q1", label = "Pregunta 1")
      ),
      # El finalize del import single-base parsea el XLSForm completo con
      # leer_instrumento_xlsform, que exige 'list_name' en la hoja choices.
      choices = list(
        list(list_name = "sino", name = "Si", label = "Sí"),
        list(list_name = "sino", name = "No", label = "No")
      ),
      settings = list(
        list(form_title = paste("Kobo", asset_uid),
             form_id = paste0("form_", asset_uid), version = "20260701")
      )
    )
  )
}

.cpj_kobo_mocks <- function() {
  list(
    .cpj_mock_binding(".connections_token_require", function(provider, sid = NULL, profile_id = NULL, base_url = NULL) {
      "cpj-test-token"
    }),
    .cpj_mock_binding(".kobo_api_fetch_json", function(url, token) {
      asset_uid <- sub("^.*/assets/([^/]+)/.*$", "\\1", url)
      .cpj_kobo_detail(utils::URLdecode(asset_uid))
    }),
    # Acepta `progress` (el hook async lo inyecta) y lo ejercita.
    .cpj_mock_binding("kobo_api_fetch_all_asset_data", function(asset_uid, token, base_url = NULL, ...) {
      dots <- list(...)
      if (is.function(dots$progress)) dots$progress(2L, 2L, "Kobo: pagina 1, 2 registros recibidos")
      list(
        total = 2L,
        results = list(
          list(codigo_pulso = paste0(asset_uid, "-001"), q1 = "Si"),
          list(codigo_pulso = paste0(asset_uid, "-002"), q1 = "No")
        )
      )
    }),
    .cpj_mock_binding("kobo_api_flatten_results", function(results) {
      data.frame(
        codigo_pulso = vapply(results, `[[`, character(1), "codigo_pulso"),
        q1 = vapply(results, `[[`, character(1), "q1"),
        stringsAsFactors = FALSE,
        check.names = FALSE
      )
    })
  )
}

.cpj_write_rds <- function(value) {
  path <- tempfile(fileext = ".rds")
  saveRDS(value, path, version = 3)
  path
}

test_that("el flag async del body es opt-in y default FALSE", {
  expect_false(.carga_platform_async_flag(list()))
  expect_false(.carga_platform_async_flag(list(async = FALSE)))
  expect_false(.carga_platform_async_flag(list(async = "no")))
  expect_true(.carga_platform_async_flag(list(async = TRUE)))
  expect_true(.carga_platform_async_flag(list(async = "true")))
})

test_that("los hooks de progreso son no-op en el camino síncrono", {
  .carga_job_progress_reset()
  expect_null(.carga_job_fetch_progress("Kobo"))
  # No debe fallar aunque no haya reporter instalado.
  expect_silent(.carga_job_progress("fetch", message = "x"))

  seen <- list()
  .carga_job_progress_install(function(phase, current = NULL, total = NULL, percent = NULL, message = NULL) {
    seen[[length(seen) + 1L]] <<- list(phase = phase, current = current, total = total, message = message)
  })
  on.exit(.carga_job_progress_reset(), add = TRUE)
  hook <- .carga_job_fetch_progress("Kobo")
  expect_true(is.function(hook))
  hook(3L, 10L, "pagina 1")
  .carga_job_progress("normalize", message = "Normalizando...")
  expect_length(seen, 2L)
  expect_equal(seen[[1]]$phase, "fetch")
  expect_equal(seen[[1]]$current, 3L)
  expect_equal(seen[[2]]$phase, "normalize")

  .carga_job_progress_reset()
  expect_null(.carga_job_fetch_progress("Kobo"))
})

test_that("runner kobo_import: sandbox de sesión, diff de claves y apply con merge mínimo", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  # Proyecto abierto: el import debe marcar project_dirty en el diff.
  session_set(sid, "project_path", file.path(tempdir(), "cpj_demo.pulso"))

  restores <- .cpj_kobo_mocks()
  on.exit(lapply(rev(restores), function(restore) restore()), add = TRUE)

  snapshot <- session_get(sid)
  state_path <- .cpj_write_rds(snapshot)
  parsed_path <- .cpj_write_rds(list(
    asset_uid = "asset_pdm",
    base_url = "https://kobo.unhcr.org",
    connection_profile_id = "kobo-test"
  ))
  secrets_path <- .cpj_write_rds(list(kobo_token = "cpj-ephemeral-token"))
  progress_path <- tempfile(fileext = ".progress")

  result <- carga_platform_job_runner(
    sid = sid,
    action = "kobo_import",
    state_path = state_path,
    parsed_path = parsed_path,
    secrets_path = secrets_path,
    progress_path = progress_path
  )

  expect_true(isTRUE(result$ok))
  expect_equal(result$action, "kobo_import")
  expect_equal(result$payload$provider, "kobo")
  expect_true(nzchar(result$payload$data_file_id))
  expect_true(nzchar(result$payload$xlsform_file_id))

  # Diff de claves: el import tocó estudio/files/instrumento y marcó dirty.
  changed <- names(result$session_changes %||% list())
  expect_true(all(c("estudio", "files", "instrumento", "project_dirty") %in% changed))
  expect_true(isTRUE(result$session_changes$project_dirty))
  expect_length(result$session_removed, 0L)

  # El secreto efímero se sembró en el worker (mismo mecanismo que 3.11).
  expect_true(prosecnur_session_secret_exists(sid, "kobo_token"))
  expect_equal(prosecnur_session_secret_load(sid, "kobo_token"), "cpj-ephemeral-token")

  # Progreso real: el archivo registra hitos (fetch/normalize/...), no queda vacío.
  expect_true(file.exists(progress_path))
  progress_raw <- paste(readLines(progress_path, warn = FALSE), collapse = "")
  expect_match(progress_raw, "phase")

  # Simular que el runner corrió en OTRO proceso: la sesión viva vuelve al
  # snapshot y el apply del on_complete hace el merge mínimo.
  .session_env[[sid]] <- snapshot
  expect_null(session_get(sid)$estudio)

  public <- .carga_platform_job_apply(
    sid,
    result,
    project_path_before = as.character(snapshot$project_path)
  )
  expect_equal(public$provider, "kobo")
  s_after <- session_get(sid)
  expect_true("default" %in% names(s_after$estudio$bases %||% list()))
  base_meta <- s_after$estudio$bases$default
  expect_equal(as.character(base_meta$source_kind), "kobo")
  expect_true(isTRUE(s_after$project_dirty))
  expect_true(length(s_after$files) >= 2L)
})

test_that("runner captura api_error como error estructurado y el apply no toca la sesión", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  restore <- .cpj_mock_binding(".connections_token_require", function(provider, sid = NULL, profile_id = NULL, base_url = NULL) {
    stop_api(400, "E_KOBO_TOKEN", "Falta token Kobo guardado.")
  })
  on.exit(restore(), add = TRUE)

  snapshot <- session_get(sid)
  result <- carga_platform_job_runner(
    sid = sid,
    action = "kobo_import",
    state_path = .cpj_write_rds(snapshot),
    parsed_path = .cpj_write_rds(list(asset_uid = "asset_x", base_url = "https://kobo.unhcr.org"))
  )
  expect_false(isTRUE(result$ok))
  expect_equal(result$error$code, "E_KOBO_TOKEN")
  expect_equal(result$error$status, 400L)
  expect_match(result$error$message, "token", ignore.case = TRUE)

  .session_env[[sid]] <- snapshot
  public <- .carga_platform_job_apply(sid, result, project_path_before = "")
  expect_false(isTRUE(public$ok))
  expect_equal(public$error$code, "E_KOBO_TOKEN")
  expect_null(session_get(sid)$estudio)
})

test_that("apply descarta el resultado si el proyecto abierto cambió (stale)", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  result <- list(
    ok = TRUE,
    payload = list(ok = TRUE),
    session_changes = list(analitica_prep_ok = TRUE),
    session_removed = character(0)
  )
  public <- .carga_platform_job_apply(sid, result, project_path_before = "/otro/proyecto.pulso")
  expect_false(isTRUE(public$ok))
  expect_equal(public$error$code, "E_CARGA_JOB_STALE_SESSION")
  expect_false(isTRUE(session_get(sid)$analitica_prep_ok))

  # Con el mismo proyecto (efímero en ambos lados) sí aplica.
  public_ok <- .carga_platform_job_apply(sid, result, project_path_before = "")
  expect_true(isTRUE(public_ok$ok))
  expect_true(isTRUE(session_get(sid)$analitica_prep_ok))
})

test_that("apply sin sesión viva devuelve error estructurado", {
  public <- .carga_platform_job_apply("sid-inexistente", list(
    ok = TRUE, payload = list(ok = TRUE), session_changes = list(), session_removed = character(0)
  ), project_path_before = "")
  expect_false(isTRUE(public$ok))
  expect_equal(public$error$code, "E_CARGA_JOB_STALE_SESSION")
})

test_that("submit devuelve el handle del job y el on_complete aplica el diff", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  captured <- new.env(parent = emptyenv())
  restore <- .cpj_mock_binding("job_submit", function(sid, kind, func, args = list(),
                                                     result_filename = NULL, on_complete = NULL,
                                                     libpath = NULL, on_cleanup = NULL) {
    captured$kind <- kind
    captured$func <- func
    captured$args <- args
    captured$on_complete <- on_complete
    captured$on_cleanup <- on_cleanup
    "job-cpj-fake"
  })
  on.exit(restore(), add = TRUE)

  handle <- .carga_platform_job_submit(sid, "kobo_import", list(asset_uid = "a1", async = TRUE))
  expect_true(isTRUE(handle$ok))
  expect_true(isTRUE(handle$async))
  expect_equal(handle$job_id, "job-cpj-fake")
  expect_equal(handle$kind, "carga.platform.kobo_import")

  expect_equal(
    attr(captured$func, "prosecnur_job_function_name", exact = TRUE),
    "carga_platform_job_runner"
  )
  expect_true(file.exists(captured$args$state_path))
  expect_true(file.exists(captured$args$secrets_path))
  # El flag async no viaja al worker (evita re-disparo dentro del sandbox).
  parsed_in_worker <- readRDS(captured$args$parsed_path)
  expect_null(parsed_in_worker$async)
  expect_equal(parsed_in_worker$asset_uid, "a1")

  # on_complete: aplica el diff y publica el payload síncrono; borra los RDS.
  fake_job <- list(
    sid = sid,
    progress_path = NULL,
    result_data = list(
      ok = TRUE,
      payload = list(ok = TRUE, provider = "kobo"),
      session_changes = list(analitica_prep_ok = TRUE),
      session_removed = character(0)
    )
  )
  public <- captured$on_complete(fake_job)
  expect_equal(public$provider, "kobo")
  expect_true(isTRUE(session_get(sid)$analitica_prep_ok))
  expect_false(file.exists(captured$args$state_path))
  expect_false(file.exists(captured$args$secrets_path))
  expect_false(file.exists(captured$args$parsed_path))
})

test_that("submit rechaza un segundo import de plataforma en curso para la misma sesión", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  fake_id <- "cpj-fake-running"
  .jobs[[fake_id]] <- list(
    id = fake_id,
    sid = sid,
    kind = "carga.platform.sm_multibase_refresh",
    rx = list(is_alive = function() TRUE),
    started_at = Sys.time(),
    finished_at = NULL,
    status = "running",
    result_path = NULL,
    progress_path = NULL,
    result_data = NULL,
    result_public = NULL,
    on_complete = NULL,
    error = NULL
  )
  on.exit(rm(list = fake_id, envir = .jobs), add = TRUE)

  err <- tryCatch(
    .carga_platform_job_submit(sid, "kobo_import", list(asset_uid = "a1")),
    api_error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_CARGA_JOB_RUNNING")
  expect_equal(err$status, 409)
})

test_that("acciones desconocidas fallan con E_CARGA_JOB_ACTION", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  err <- tryCatch(
    .carga_platform_job_submit(sid, "accion_inexistente", list()),
    api_error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_CARGA_JOB_ACTION")

  err2 <- tryCatch(
    .carga_platform_call_action(sid, "accion_inexistente", list()),
    api_error = function(e) e
  )
  expect_s3_class(err2, "api_error")
  expect_equal(err2$code, "E_CARGA_JOB_ACTION")
})

test_that("el dispatch multibase mapea el body igual que los endpoints síncronos", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  captured <- new.env(parent = emptyenv())
  restores <- list(
    .cpj_mock_binding(".connections_token_require", function(provider, sid = NULL, profile_id = NULL, base_url = NULL) {
      captured$provider <- provider
      captured$profile_id <- profile_id
      "sm-tok"
    }),
    .cpj_mock_binding("sm_multibase_refresh", function(sid, token, bases = list(), months = 12L,
                                                       force_refresh = FALSE, reapply_codificacion = TRUE,
                                                       regenerate_raw_snapshot = FALSE, raw_snapshot_only = FALSE) {
      captured$refresh <- list(
        token = token, bases = bases, months = months,
        force_refresh = force_refresh, reapply_codificacion = reapply_codificacion,
        regenerate_raw_snapshot = regenerate_raw_snapshot, raw_snapshot_only = raw_snapshot_only
      )
      list(ok = TRUE)
    }),
    .cpj_mock_binding("sm_multibase_import_independent", function(sid, specs, token, response_statuses = c("completed"),
                                                                  keep_missing_status = TRUE, canonical_file_id = "",
                                                                  use_canonical_xlsform_logic = FALSE, logic_rules = "",
                                                                  logic_rules_by_survey = NULL, logic_pages = NULL,
                                                                  choice_order_overrides = NULL, choice_code_maps = NULL,
                                                                  replace_existing_logic = FALSE) {
      captured$independent <- list(
        specs = specs, token = token, response_statuses = response_statuses,
        keep_missing_status = keep_missing_status, canonical_file_id = canonical_file_id,
        logic_rules = logic_rules, replace_existing_logic = replace_existing_logic
      )
      list(ok = TRUE)
    })
  )
  on.exit(lapply(rev(restores), function(restore) restore()), add = TRUE)

  out <- .carga_platform_call_action(sid, "sm_multibase_refresh", list(
    bases = list(list(base_name = "b1")),
    months = "6",
    force_refresh = TRUE,
    raw_snapshot_only = TRUE
  ))
  expect_true(isTRUE(out$ok))
  expect_equal(captured$refresh$token, "sm-tok")
  expect_equal(captured$refresh$months, 6L)
  expect_true(isTRUE(captured$refresh$force_refresh))
  expect_true(isTRUE(captured$refresh$reapply_codificacion))
  expect_true(isTRUE(captured$refresh$raw_snapshot_only))

  out2 <- .carga_platform_call_action(sid, "sm_multibase_import_independent", list(
    surveys = list(list(survey_id = "s1")),
    connection_profile_id = "perfil-x",
    keep_missing_status = FALSE,
    surveymonkey_logic_rules = "P1 -> P2",
    replace_existing_logic = TRUE
  ))
  expect_true(isTRUE(out2$ok))
  expect_equal(captured$provider, "surveymonkey")
  expect_equal(captured$profile_id, "perfil-x")
  expect_equal(captured$independent$token, "sm-tok")
  expect_false(isTRUE(captured$independent$keep_missing_status))
  expect_equal(captured$independent$logic_rules, "P1 -> P2")
  expect_true(isTRUE(captured$independent$replace_existing_logic))
})

# ---------------------------------------------------------------------------
# U-B0 · Higiene de insumos efímeros: cancelar o fallar NO deja el RDS de
# secretos/estado en jobs/inputs (ADR 0005). Sin callr: el handle se registra en
# `.jobs` con un rx falso y se ejerce el job_cancel/job_poll reales de jobs.R.
# ---------------------------------------------------------------------------

.cpj_inputs_left <- function(sid) {
  dir <- file.path(session_get(sid)$dir, "jobs", "inputs")
  if (!dir.exists(dir)) return(character(0))
  list.files(dir, pattern = "^carga_platform_.*\\.rds$")
}

# Lanza un submit real de carga con job_submit interceptado y registra en
# `.jobs` un handle con el rx dado (mismo shape que job_submit).
.cpj_submit_with_fake_rx <- function(sid, rx, action = "kobo_import",
                                     parsed = list(asset_uid = "a1", async = TRUE)) {
  captured <- new.env(parent = emptyenv())
  restore <- .cpj_mock_binding("job_submit", function(sid, kind, func, args = list(),
                                                     result_filename = NULL, on_complete = NULL,
                                                     libpath = NULL, on_cleanup = NULL) {
    id <- paste0("cpj-fake-", uuid::UUIDgenerate())
    .jobs[[id]] <- list(
      id = id, sid = sid, kind = kind, rx = rx,
      started_at = Sys.time(), finished_at = NULL, status = "running",
      result_path = NULL, progress_path = NULL,
      result_data = NULL, result_public = NULL,
      on_complete = on_complete, on_cleanup = on_cleanup, cleaned = FALSE,
      error = NULL
    )
    captured$args <- args
    id
  })
  on.exit(restore(), add = TRUE)
  handle <- .carga_platform_job_submit(sid, action, parsed)
  list(job_id = handle$job_id, args = captured$args)
}

test_that("cancelar un import de plataforma borra los RDS de secretos, estado y body", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  prosecnur_session_secret_save(sid, "kobo_token", "cpj-secreto-que-no-debe-quedar")
  on.exit(prosecnur_session_secret_clear(sid, "kobo_token"), add = TRUE)

  killed <- new.env(parent = emptyenv())
  killed$n <- 0L
  rx <- list(
    is_alive = function() killed$n == 0L,
    kill = function() { killed$n <- killed$n + 1L; invisible(TRUE) }
  )
  sub <- .cpj_submit_with_fake_rx(sid, rx)
  on.exit(rm(list = sub$job_id, envir = .jobs), add = TRUE)

  # Antes de cancelar los insumos existen (y el de secretos trae el token).
  expect_length(.cpj_inputs_left(sid), 3L)
  expect_equal(readRDS(sub$args$secrets_path)$kobo_token, "cpj-secreto-que-no-debe-quedar")

  expect_true(job_cancel(sub$job_id))
  j <- job_get(sub$job_id)
  expect_equal(j$status, "cancelled")
  expect_equal(killed$n, 1L)
  expect_true(isTRUE(j$cleaned))
  expect_length(.cpj_inputs_left(sid), 0L)
  expect_false(file.exists(sub$args$secrets_path))
  expect_false(file.exists(sub$args$state_path))
  expect_false(file.exists(sub$args$parsed_path))
  # Cancelar no aplica on_complete: la sesión no recibió ningún diff.
  expect_null(session_get(sid)$estudio)

  # Idempotente: un segundo cancel no vuelve a correr el cleanup ni falla.
  expect_true(job_cancel(sub$job_id))
})

test_that("si el spawn del worker falla, los RDS ya escritos se borran (no hay job ni on_cleanup)", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  prosecnur_session_secret_save(sid, "kobo_token", "cpj-secreto-spawn")
  on.exit(prosecnur_session_secret_clear(sid, "kobo_token"), add = TRUE)

  restore <- .cpj_mock_binding("job_submit", function(...) stop("callr: no se pudo lanzar el worker"))
  on.exit(restore(), add = TRUE)

  err <- tryCatch(
    .carga_platform_job_submit(sid, "kobo_import", list(asset_uid = "a1", async = TRUE)),
    error = function(e) e
  )
  expect_s3_class(err, "error")
  expect_match(conditionMessage(err), "no se pudo lanzar")
  expect_length(.cpj_inputs_left(sid), 0L)
})

test_that("un worker que muere con error también borra los RDS de insumos", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  rx <- list(
    is_alive = function() FALSE,
    get_result = function() stop("callr_error: el worker murió")
  )
  sub <- .cpj_submit_with_fake_rx(sid, rx, action = "sm_multibase_refresh",
                                  parsed = list(bases = list(), async = TRUE))
  on.exit(rm(list = sub$job_id, envir = .jobs), add = TRUE)
  expect_length(.cpj_inputs_left(sid), 3L)

  j <- job_poll(sub$job_id)
  expect_equal(j$status, "error")
  expect_match(j$error, "worker")
  expect_length(.cpj_inputs_left(sid), 0L)
})

test_that("un error de dominio cosechado como done también borra los insumos", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  rx <- list(
    is_alive = function() FALSE,
    get_result = function() list(ok = FALSE, action = "kobo_import", error = list(
      code = "E_KOBO_TOKEN", status = 400L, message = "Falta token Kobo guardado."
    ))
  )
  sub <- .cpj_submit_with_fake_rx(sid, rx)
  on.exit(rm(list = sub$job_id, envir = .jobs), add = TRUE)

  j <- job_poll(sub$job_id)
  expect_equal(j$status, "done")
  expect_equal(j$result_public$error$code, "E_KOBO_TOKEN")
  expect_length(.cpj_inputs_left(sid), 0L)
})

test_that("el runner borra el RDS de secretos apenas lo lee", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  restore <- .cpj_mock_binding(".connections_token_require", function(provider, sid = NULL, profile_id = NULL, base_url = NULL) {
    stop_api(400, "E_KOBO_TOKEN", "Falta token Kobo guardado.")
  })
  on.exit(restore(), add = TRUE)

  secrets_path <- .cpj_write_rds(list(kobo_token = "cpj-efimero"))
  carga_platform_job_runner(
    sid = sid,
    action = "kobo_import",
    state_path = .cpj_write_rds(session_get(sid)),
    parsed_path = .cpj_write_rds(list(asset_uid = "asset_x")),
    secrets_path = secrets_path
  )
  expect_false(file.exists(secrets_path))
})

# ---------------------------------------------------------------------------
# U-B0 · «Bases separadas»: surveymonkey_import_separate / kobo_import_separate
# agregan una base NUEVA con estudio_add_base y nunca escriben `default`.
# ---------------------------------------------------------------------------

.cpj_sm_mocks <- function() {
  list(
    .cpj_mock_binding(".connections_token_require", function(provider, sid = NULL, profile_id = NULL, base_url = NULL) {
      "cpj-sm-token"
    }),
    .cpj_mock_binding("sm_api_fetch_survey_details", function(survey_id, token, base_url = NULL, ...) {
      list(id = survey_id, title = paste("Encuesta", survey_id))
    }),
    # El modelo XLSForm del mock Kobo sirve igual: mismo shape que sm_api_xlsform.
    .cpj_mock_binding("sm_api_xlsform", function(details, style = NULL, lang = "es", ...) {
      .carga_kobo_xlsform_model(.cpj_kobo_detail(details$id))
    }),
    .cpj_mock_binding("sm_api_fetch_all_responses_bulk", function(survey_id, token, base_url = NULL, ...) {
      list(data = list(list(id = "r1"), list(id = "r2"), list(id = "r3")))
    }),
    .cpj_mock_binding("sm_multibase_api_responses_to_canonical_data", function(details, responses, inst, survey_id, ...) {
      data.frame(
        codigo_pulso = paste0(survey_id, "-", seq_along(responses)),
        q1 = rep(c("Si", "No"), length.out = length(responses)),
        stringsAsFactors = FALSE,
        check.names = FALSE
      )
    })
  )
}

test_that("kobo_import_separate agrega una base nueva y no toca `default` ni las hermanas", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  restores <- .cpj_kobo_mocks()
  on.exit(lapply(rev(restores), function(restore) restore()), add = TRUE)

  # Base única previa (camino de siempre): queda como `default`.
  .carga_import_kobo(sid, list(asset_uid = "asset_base", base_url = "https://kobo.unhcr.org"))
  default_before <- session_get(sid)$estudio$bases$default
  expect_false(is.null(default_before))

  out <- .carga_platform_endpoint(sid, "kobo_import_separate", list(
    asset_uid = "asset_dos",
    base_url = "https://kobo.unhcr.org",
    connection_profile_id = "kobo-perfil",
    base_name = "segunda"
  ))
  expect_true(isTRUE(out$ok))
  expect_equal(out$provider, "kobo")
  expect_equal(out$strategy, "separate")
  expect_equal(out$base_name, "segunda")
  expect_equal(out$n_bases, 2L)
  expect_equal(out$n_filas, 2L)
  expect_true(nzchar(out$xlsform_file_id))
  expect_true(nzchar(out$data_file_id))
  expect_equal(out$base$nombre, "segunda")

  s <- session_get(sid)
  expect_setequal(names(s$estudio$bases), c("default", "segunda"))
  # La hermana quedó intacta: mismos archivos, sigue activa.
  expect_identical(s$estudio$bases$default$data_file_id, default_before$data_file_id)
  expect_identical(s$estudio$bases$default$xlsform_file_id, default_before$xlsform_file_id)
  expect_equal(out$active_base, "default")
  expect_equal(as.character(s$estudio$processing_mode), "multibase")

  meta <- s$estudio$bases$segunda
  expect_equal(meta$data_file_id, out$data_file_id)
  expect_equal(meta$source_kind, "kobo")
  expect_equal(meta$survey_id, "asset_dos")
  expect_equal(meta$asset_uid, "asset_dos")
  expect_equal(meta$connection_profile_id, "kobo-perfil")
  expect_equal(meta$base_url, "https://kobo.unhcr.org")
  expect_true(nzchar(meta$imported_at))
  expect_equal(meta$kobo_source_spec$asset_uid, "asset_dos")
  expect_true(is.data.frame(s$rp_data_sources$segunda$data) || !is.null(s$rp_data_sources$segunda))
  expect_true(isTRUE(s$project_dirty) || is.null(s$project_path))
})

test_that("kobo_import_separate en un estudio vacío deriva el nombre y fija la fuente analítica", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  restores <- .cpj_kobo_mocks()
  on.exit(lapply(rev(restores), function(restore) restore()), add = TRUE)

  out <- .carga_import_kobo_separate(sid, list(asset_uid = "asset_a", base_url = "https://kobo.unhcr.org"))
  expect_false("default" %in% names(session_get(sid)$estudio$bases))
  expect_equal(out$n_bases, 1L)
  expect_true(nzchar(out$base_name))
  expect_equal(out$active_base, out$base_name)
  expect_true(isTRUE(session_get(sid)$analitica_prep_ok))
  expect_equal(session_get(sid)$analitica_fuente, paste0("estudio:", out$base_name))

  # El mismo asset otra vez sin nombre explícito: se desambigua, no pisa.
  out2 <- .carga_import_kobo_separate(sid, list(asset_uid = "asset_a", base_url = "https://kobo.unhcr.org"))
  expect_false(identical(out2$base_name, out$base_name))
  expect_equal(out2$n_bases, 2L)
  expect_equal(out2$active_base, out$base_name)
})

test_that("kobo_import_separate rechaza estudio independiente, nombre duplicado e inválido", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  restores <- .cpj_kobo_mocks()
  on.exit(lapply(rev(restores), function(restore) restore()), add = TRUE)

  .carga_import_kobo_separate(sid, list(asset_uid = "asset_a", base_name = "docentes"))
  files_antes <- names(session_get(sid)$files)

  dup <- tryCatch(
    .carga_import_kobo_separate(sid, list(asset_uid = "asset_b", base_name = "docentes")),
    api_error = function(e) e
  )
  expect_s3_class(dup, "api_error")
  expect_equal(dup$code, "E_BASE_DUP")

  bad <- tryCatch(
    .carga_import_kobo_separate(sid, list(asset_uid = "asset_b", base_name = "dos palabras")),
    api_error = function(e) e
  )
  expect_s3_class(bad, "api_error")
  expect_equal(bad$code, "E_BASE_NOMBRE_INVALIDO")
  # Rechazados antes del fetch: ningún upload huérfano en s$files.
  expect_identical(names(session_get(sid)$files), files_antes)

  missing <- tryCatch(
    .carga_import_kobo_separate(sid, list(base_name = "x")),
    api_error = function(e) e
  )
  expect_equal(missing$code, "E_KOBO_ASSET_REQUIRED")

  estudio_set_processing_mode(sid, "independent_siblings")
  conflict <- tryCatch(
    .carga_import_kobo_separate(sid, list(asset_uid = "asset_c")),
    api_error = function(e) e
  )
  expect_s3_class(conflict, "api_error")
  expect_equal(conflict$code, "E_ESTUDIO_MODE_CONFLICT")
  expect_equal(conflict$status, 409)
  expect_equal(names(session_get(sid)$estudio$bases), "docentes")
})

test_that("surveymonkey_import_separate agrega una base con la metadata de origen", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  restores <- c(.cpj_kobo_mocks(), .cpj_sm_mocks())
  on.exit(lapply(rev(restores), function(restore) restore()), add = TRUE)

  .carga_import_kobo_separate(sid, list(asset_uid = "asset_a", base_name = "docentes"))

  out <- .carga_platform_endpoint(sid, "surveymonkey_import_separate", list(
    survey_id = "sm123",
    connection_profile_id = "sm-perfil",
    base_name = "estudiantes"
  ))
  expect_true(isTRUE(out$ok))
  expect_equal(out$provider, "surveymonkey")
  expect_equal(out$strategy, "separate")
  expect_equal(out$base_name, "estudiantes")
  expect_equal(out$n_filas, 3L)
  expect_equal(out$n_bases, 2L)
  expect_equal(out$active_base, "docentes")
  expect_equal(out$source$survey_id, "sm123")

  s <- session_get(sid)
  expect_setequal(names(s$estudio$bases), c("docentes", "estudiantes"))
  meta <- s$estudio$bases$estudiantes
  expect_equal(meta$source_kind, "surveymonkey")
  expect_equal(meta$survey_id, "sm123")
  expect_equal(meta$connection_profile_id, "sm-perfil")
  expect_equal(meta$base_url, "https://api.surveymonkey.com/v3")
  expect_true(nzchar(meta$imported_at))
  expect_equal(meta$response_filter$kind, "surveymonkey_api")
  expect_equal(meta$surveymonkey_effective_data_file_id, out$data_file_id)
  # El instrumento single-base de la sesión no se reescribió.
  expect_null(s$instrumento)

  missing <- tryCatch(
    .carga_import_surveymonkey_separate(sid, list(base_name = "x")),
    api_error = function(e) e
  )
  expect_equal(missing$code, "E_SM_SURVEY_REQUIRED")
})

test_that("las acciones separadas corren en el worker y result_data = respuesta síncrona", {
  expect_true(all(c("surveymonkey_import_separate", "kobo_import_separate") %in% .CARGA_PLATFORM_JOB_ACTIONS))

  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  restores <- .cpj_kobo_mocks()
  on.exit(lapply(rev(restores), function(restore) restore()), add = TRUE)

  snapshot <- session_get(sid)
  result <- carga_platform_job_runner(
    sid = sid,
    action = "kobo_import_separate",
    state_path = .cpj_write_rds(snapshot),
    parsed_path = .cpj_write_rds(list(asset_uid = "asset_w", base_name = "worker_base"))
  )
  expect_true(isTRUE(result$ok))
  expect_true("estudio" %in% names(result$session_changes))

  # Simula el proceso principal: sesión en el snapshot, apply del on_complete.
  .session_env[[sid]] <- snapshot
  public <- .carga_platform_job_apply(sid, result, project_path_before = "")
  expect_identical(public, result$payload)
  expect_equal(public$strategy, "separate")
  expect_equal(public$base_name, "worker_base")
  expect_equal(names(session_get(sid)$estudio$bases), "worker_base")
})

test_that("contrato HTTP: POST import-separate existe y pasa por el gate async", {
  pr <- mount_carga(plumber::pr())
  eps <- pr$endpoints[[1]]
  paths <- vapply(eps, function(e) e$path, character(1))
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  for (provider in c("surveymonkey", "kobo")) {
    path <- sprintf("/api/carga/platform/%s/import-separate", provider)
    expect_true(path %in% paths, info = path)
    ep <- eps[[which(paths == path)[1]]]
    expect_equal(ep$verbs, "POST")

    captured <- new.env(parent = emptyenv())
    restore <- .cpj_mock_binding(".carga_platform_endpoint", function(sid, action, parsed) {
      captured$sid <- sid
      captured$action <- action
      captured$parsed <- parsed
      list(ok = TRUE, async = TRUE, job_id = "fake")
    })
    req <- list(
      HTTP_X_PULSO_SESSION = sid,
      bodyRaw = charToRaw('{"async":true,"base_name":"b1","asset_uid":"a","survey_id":"s"}')
    )
    out <- ep$getFunc()(req = req, res = plumber:::PlumberResponse$new())
    restore()
    expect_equal(out$job_id, "fake")
    expect_equal(captured$sid, sid)
    expect_equal(captured$action, sprintf("%s_import_separate", provider))
    expect_true(isTRUE(captured$parsed$async))
    expect_equal(captured$parsed$base_name, "b1")
  }
})

# ---------------------------------------------------------------------------
# N4 (revisión metodológica 2026-10-11): una base separada se normaliza solo
# con mapas de códigos de SU instrumento. Heredar los del formulario activo
# invertía Si↔No en silencio cuando dos encuestas comparten nombres.
# ---------------------------------------------------------------------------

.cpj_mapa_si_no_invertido <- function() {
  list(list(variable = "q1", type = "select_one", list_name = "sino_otro", mappings = list(
    list(source_code = "Si", xls_code = "No"),
    list(source_code = "No", xls_code = "Si")
  )))
}

.cpj_form_con_mapas <- function(survey_id) {
  list(source = list(survey_id = survey_id),
       workbook = list(surveyMonkeyLogic = list(choice_code_maps = .cpj_mapa_si_no_invertido())))
}

.cpj_q1_importado <- function(sid, out) {
  f <- session_get(sid)$files[[out$data_file_id]]
  readxl::read_excel(f$path)$q1
}

test_that("kobo_import_separate no hereda mapas de códigos del formulario activo", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  restores <- .cpj_kobo_mocks()
  on.exit(lapply(rev(restores), function(restore) restore()), add = TRUE)
  session_set(sid, "xlsform_state", .cpj_form_con_mapas("otro"))
  session_set(sid, "choice_code_maps_confirmed", list(confirmed = TRUE, maps = .cpj_mapa_si_no_invertido()))

  out <- .carga_import_kobo_separate(sid, list(asset_uid = "asset_a"))
  expect_equal(.cpj_q1_importado(sid, out), c("Si", "No"))
})

test_that("surveymonkey_import_separate nunca aplica mapas del editor: la API ya viene en códigos del instrumento", {
  restores <- .cpj_sm_mocks()
  on.exit(lapply(rev(restores), function(restore) restore()), add = TRUE)

  # Formulario activo de OTRA encuesta (y mapas confirmados de sesión): no aplican.
  sid <- session_create()
  session_set(sid, "xlsform_state", .cpj_form_con_mapas("sm_otra"))
  session_set(sid, "choice_code_maps_confirmed", list(confirmed = TRUE, maps = .cpj_mapa_si_no_invertido()))
  out <- .carga_import_surveymonkey_separate(sid, list(survey_id = "sm_1"))
  expect_equal(.cpj_q1_importado(sid, out), c("Si", "No", "Si"))
  session_delete(sid)

  # Ni siquiera el formulario de ESTA encuesta: su mapa traduce posición visual,
  # y la API ya resolvió cada respuesta por etiqueta al código del instrumento.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "xlsform_state", .cpj_form_con_mapas("sm_otra"))
  session_set(sid, "xlsform_forms", list(f2 = .cpj_form_con_mapas("sm_1")))
  out <- .carga_import_surveymonkey_separate(sid, list(survey_id = "sm_1"))
  expect_equal(.cpj_q1_importado(sid, out), c("Si", "No", "Si"))
})

test_that("base única: el import SM no aplica mapas del editor ni con el formulario de la misma encuesta (F1)", {
  restores <- .cpj_sm_mocks()
  on.exit(lapply(rev(restores), function(restore) restore()), add = TRUE)

  sid <- session_create()
  session_set(sid, "xlsform_state", .cpj_form_con_mapas("sm_otra"))
  out <- .carga_import_surveymonkey(sid, list(survey_id = "sm_1"))
  expect_equal(.cpj_q1_importado(sid, out), c("Si", "No", "Si"))
  session_delete(sid)

  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "xlsform_state", .cpj_form_con_mapas("sm_1"))
  out <- .carga_import_surveymonkey(sid, list(survey_id = "sm_1"))
  expect_equal(.cpj_q1_importado(sid, out), c("Si", "No", "Si"))
})

test_that("base única: el import Kobo no hereda mapas del formulario activo", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  restores <- .cpj_kobo_mocks()
  on.exit(lapply(rev(restores), function(restore) restore()), add = TRUE)
  session_set(sid, "xlsform_state", .cpj_form_con_mapas("otro"))

  out <- .carga_import_kobo(sid, list(asset_uid = "asset_a"))
  expect_equal(.cpj_q1_importado(sid, out), c("Si", "No"))
})

# ---------------------------------------------------------------------------
# Triple aplicación (traspaso 2026-10-11): el archivo de un import de
# plataforma se guarda YA recodificado. La preview, el rp_data de la base,
# «Ver base» y la reconstrucción al reabrir no pueden volver a aplicar los
# mapas: con mapas que se cruzan (Si↔No) invertían las categorías.
# ---------------------------------------------------------------------------

.cpj_q1_chr <- function(x) as.character(unlist(lapply(x, function(v) as.character(v))))

test_that("base única SM: la base default y «Ver base» no recodifican dos veces", {
  restores <- .cpj_sm_mocks()
  on.exit(lapply(rev(restores), function(restore) restore()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "xlsform_state", .cpj_form_con_mapas("sm_1"))

  out <- .carga_import_surveymonkey(sid, list(survey_id = "sm_1"))
  esperado <- c("Si", "No", "Si")
  expect_equal(.cpj_q1_importado(sid, out), esperado)
  s <- session_get(sid)
  expect_equal(.cpj_q1_chr(s$rp_data_sources$default$q1), esperado)
  expect_equal(.cpj_q1_chr(.carga_normalized_data_for_export(sid, "default")$data$q1), esperado)
  # La base marca que su archivo ya salió normalizado del import.
  expect_identical(s$estudio$bases$default$choice_codes_applied_data_file_id, s$estudio$bases$default$data_file_id)
})

test_that("base única SM: confirmar el mapeo y reabrir el .pulso no invierte categorías", {
  restores <- .cpj_sm_mocks()
  on.exit(lapply(rev(restores), function(restore) restore()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "xlsform_state", .cpj_form_con_mapas("sm_1"))
  .carga_import_surveymonkey(sid, list(survey_id = "sm_1"))

  estudio <- session_get(sid)$estudio
  estudio$bases$default$choice_code_mapping <- list(
    version = 1L, confirmed = TRUE, confirmed_at = "2026-10-11T00:00:00Z",
    n_questions = 1L, maps = .cpj_mapa_si_no_invertido()
  )
  session_set(sid, "estudio", estudio)
  esperado <- c("Si", "No", "Si")
  expect_equal(.cpj_q1_chr(.carga_normalized_data_for_export(sid, "default")$data$q1), esperado)

  destino <- tempfile(fileext = ".pulso")
  on.exit(unlink(destino), add = TRUE)
  build_pulso(sid, destino, project_name = "cpj-triple")
  reabierto <- load_pulso(destino)
  on.exit(session_delete(reabierto$session_id), add = TRUE)
  s2 <- session_get(reabierto$session_id)
  expect_equal(.cpj_q1_chr(s2$rp_data_sources$default$q1), esperado)
})

test_that("si el archivo de la base cambia, la marca de códigos aplicados deja de valer", {
  base <- list(data_file_id = "nuevo", choice_codes_applied_data_file_id = "viejo")
  expect_false(.carga_codigos_ya_aplicados(base))
  expect_true(.carga_codigos_ya_aplicados(list(data_file_id = "a", choice_codes_applied_data_file_id = "a")))
  expect_false(.carga_codigos_ya_aplicados(list(data_file_id = "a")))
})
