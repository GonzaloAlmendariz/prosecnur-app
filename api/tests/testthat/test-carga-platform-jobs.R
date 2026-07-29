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
                                                     libpath = NULL) {
    captured$kind <- kind
    captured$func <- func
    captured$args <- args
    captured$on_complete <- on_complete
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
