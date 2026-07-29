# carga_platform_jobs.R — camino async opt-in para imports/refresh de plataforma
# (Carga: Kobo/SurveyMonkey; SurveyMonkey multibase). Unidad 2.1 del plan de
# performance 2026-07.
#
# Problema: los imports de plataforma (fetch paginado + flatten + normalización
# + escritura XLSX) corren DENTRO del event loop de Plumber, que es de un solo
# hilo — un refresh multibase de un estudio real congela la app entera por
# minutos. Solución: con `async = TRUE` en el body, el endpoint responde de
# inmediato con el handle de un job `callr::r_bg` y todo el trabajo pesado
# ocurre en el worker. El default (sin `async`) sigue siendo la respuesta
# síncrona actual, byte a byte.
#
# Patrón (Unidad 3.11, monitoreo_sync_job_runner + on_complete con merge
# mínimo), generalizado para Carga como SANDBOX DE SESIÓN:
#
#   1. El hilo principal serializa un snapshot del estado de sesión + los
#      secretos efímeros de sesión a RDS (job_save_rds — los tokens NUNCA
#      viajan como args planos de callr).
#   2. El worker siembra su propio `.session_env[[sid]]` con el snapshot y
#      re-siembra los secretos efímeros; los perfiles persistidos se leen de
#      ~/.prosecnurapp/secrets directamente (mismo user/host ⇒ misma clave).
#      Con eso, la función de import EXISTENTE corre sin cambios: sus
#      session_set/estudio_* mutan la copia del worker y sus archivos van al
#      dir real de la sesión (path absoluto compartido vía snapshot).
#   3. El worker devuelve el payload del endpoint + el DIFF de claves top-level
#      de sesión (identical() es O(1) para las claves no tocadas porque
#      comparten SEXP con el snapshot).
#   4. `on_complete` (hilo principal) aplica solo las claves cambiadas — merge
#      mínimo — y publica el payload con la MISMA forma que la respuesta
#      síncrona. `project_dirty` viaja como una clave más del diff.
#
# Limitación documentada: si el usuario muta durante el job una clave que el
# import también toca, gana el import (last-write-wins por clave). Por eso el
# guard de concurrencia rechaza dos imports de plataforma simultáneos por
# sesión, y el apply se descarta si el proyecto abierto cambió (stale).

.CARGA_PLATFORM_JOB_ACTIONS <- c(
  "surveymonkey_import",
  "kobo_import",
  "kobo_import_independent",
  "kobo_refresh_independent",
  "sm_multibase_import",
  "sm_multibase_import_independent",
  "sm_multibase_refresh"
)

# ---------------------------------------------------------------------------
# Reporter de progreso instalable. En el camino síncrono nunca se instala y
# todos los hooks son no-op (cero cambio de comportamiento). En el worker, el
# runner instala el job_progress_writer del job y los imports reportan hitos
# reales: páginas de fetch, normalización, escritura, registro.
# ---------------------------------------------------------------------------

.carga_jobs_env <- new.env(parent = emptyenv())

.carga_job_progress_install <- function(report) {
  .carga_jobs_env$report <- report
  invisible(NULL)
}

.carga_job_progress_reset <- function() {
  if (exists("report", envir = .carga_jobs_env, inherits = FALSE)) {
    rm(list = "report", envir = .carga_jobs_env)
  }
  invisible(NULL)
}

# Hito puntual ("normalizando", "escribiendo", "registrando"). Nunca falla:
# el progreso jamás debe tumbar un import.
.carga_job_progress <- function(phase, message = NULL, current = NULL,
                                total = NULL, percent = NULL) {
  report <- .carga_jobs_env$report
  if (!is.function(report)) return(invisible(NULL))
  tryCatch(
    report(phase, current = current, total = total, percent = percent, message = message),
    error = function(e) NULL
  )
  invisible(NULL)
}

# Callback para los fetchers paginados (kobo_api_fetch_all_asset_data /
# sm_api_fetch_all_responses_bulk reciben `progress(current, total, msg)`).
# NULL cuando no hay reporter instalado.
.carga_job_fetch_progress <- function(label = "") {
  if (!is.function(.carga_jobs_env$report)) return(NULL)
  function(current, total, msg = NULL) {
    .carga_job_progress(
      "fetch",
      message = msg %||% sprintf("%s: descargando...", label),
      current = if (!is.null(current) && is.finite(current)) as.integer(current) else NULL,
      total = if (!is.null(total) && is.finite(total)) as.integer(total) else NULL
    )
  }
}

# Wrappers de fetch: agregan el hook de progreso SOLO cuando hay reporter
# instalado, para no romper la firma que los tests/mocks síncronos esperan.
.carga_platform_fetch_kobo <- function(asset_uid, token, base_url) {
  hook <- .carga_job_fetch_progress("Kobo")
  if (is.null(hook)) {
    kobo_api_fetch_all_asset_data(asset_uid, token, base_url = base_url)
  } else {
    kobo_api_fetch_all_asset_data(asset_uid, token, base_url = base_url, progress = hook)
  }
}

.carga_platform_fetch_sm_bulk <- function(survey_id, token,
                                          base_url = "https://api.surveymonkey.com/v3") {
  hook <- .carga_job_fetch_progress("SurveyMonkey")
  if (is.null(hook)) {
    sm_api_fetch_all_responses_bulk(survey_id, token, base_url = base_url)
  } else {
    sm_api_fetch_all_responses_bulk(survey_id, token, base_url = base_url, progress = hook)
  }
}

# ---------------------------------------------------------------------------
# Flag `async` del body. Default FALSE: la respuesta síncrona actual es el
# contrato vigente del frontend; el flip del default es otra unidad.
# ---------------------------------------------------------------------------

.carga_platform_async_flag <- function(parsed) {
  value <- parsed$async %||% NULL
  if (is.null(value)) return(FALSE)
  if (isTRUE(value)) return(TRUE)
  identical(tolower(trimws(as.character(value)[1])), "true")
}

# ---------------------------------------------------------------------------
# Dispatch compartido: el MISMO adaptador de argumentos sirve al camino
# síncrono (router) y al worker, para que async y sync no puedan divergir en
# el mapeo body → función de import. La resolución de token acá reproduce
# exactamente la que hacían los endpoints de surveymonkey_multibase.R.
# ---------------------------------------------------------------------------

.carga_platform_call_action <- function(sid, action, parsed) {
  switch(
    action,
    surveymonkey_import = .carga_import_surveymonkey(sid, parsed),
    kobo_import = .carga_import_kobo(sid, parsed),
    kobo_import_independent = .carga_import_kobo_independent(sid, parsed),
    kobo_refresh_independent = .carga_refresh_kobo_independent(sid, parsed),
    sm_multibase_import = {
      token <- .connections_token_require("surveymonkey", sid)
      sm_multibase_import(
        sid = sid,
        specs = parsed$surveys %||% list(),
        token = token,
        canonical_file_id = .sm_mb_scalar(parsed$canonical_xlsform_file_id, ""),
        base_name = .sm_mb_scalar(parsed$base_name, "surveymonkey_multibase"),
        wording_decisions = parsed$wording_decisions %||% list()
      )
    },
    sm_multibase_import_independent = {
      profile_id <- parsed$connection_profile_id %||% parsed$connectionProfileId %||%
        parsed$profile_id %||% parsed$profileId %||% NULL
      token <- .connections_token_require("surveymonkey", sid, profile_id = profile_id)
      sm_multibase_import_independent(
        sid = sid,
        specs = parsed$surveys %||% list(),
        token = token,
        response_statuses = .sm_mb_response_statuses(parsed$response_statuses),
        keep_missing_status = if (is.null(parsed$keep_missing_status)) TRUE else isTRUE(parsed$keep_missing_status),
        canonical_file_id = .sm_mb_scalar(parsed$canonical_xlsform_file_id, ""),
        use_canonical_xlsform_logic = isTRUE(parsed$use_canonical_xlsform_logic),
        logic_rules = .sm_mb_scalar(parsed$surveymonkey_logic_rules %||% parsed$logic_rules %||% parsed$reglas, ""),
        logic_rules_by_survey = parsed$surveymonkey_logic_rules_by_survey %||% parsed$logic_rules_by_survey %||% NULL,
        logic_pages = parsed$surveymonkey_logic_pages %||% parsed$logic_pages %||% parsed$paginas %||% NULL,
        choice_order_overrides = parsed$choice_order_overrides %||% NULL,
        choice_code_maps = parsed$choice_code_maps %||% NULL,
        replace_existing_logic = isTRUE(parsed$replace_existing_logic)
      )
    },
    sm_multibase_refresh = {
      token <- .connections_token_require("surveymonkey", sid)
      sm_multibase_refresh(
        sid = sid,
        token = token,
        bases = parsed$bases %||% list(),
        months = suppressWarnings(as.integer(parsed$months %||% 12L)),
        force_refresh = isTRUE(parsed$force_refresh),
        reapply_codificacion = if (is.null(parsed$reapply_codificacion)) TRUE else isTRUE(parsed$reapply_codificacion),
        regenerate_raw_snapshot = isTRUE(parsed$regenerate_raw_snapshot),
        raw_snapshot_only = isTRUE(parsed$raw_snapshot_only)
      )
    },
    stop_api(400, "E_CARGA_JOB_ACTION",
             sprintf("Import de plataforma no soportado en modo async: '%s'.", action))
  )
}

# ---------------------------------------------------------------------------
# Secretos efímeros de sesión que deben viajar al worker. Los tokens "solo
# por esta sesión" viven en memoria del proceso principal (.SESSION_SECRETS);
# el worker no los ve. Se serializan a RDS (mecanismo 3.11) y el runner los
# re-siembra para que .connections_token_require resuelva igual que en el
# camino síncrono. Los perfiles persistidos NO necesitan viajar.
# ---------------------------------------------------------------------------

.carga_platform_session_secrets <- function(sid) {
  out <- list()
  for (provider in c("surveymonkey", "kobo")) {
    name <- .connections_secret_name(provider)
    if (isTRUE(prosecnur_session_secret_exists(sid, name))) {
      token <- prosecnur_session_secret_load(sid, name)
      if (!is.na(token) && nzchar(token)) out[[name]] <- token
    }
  }
  out
}

# ---------------------------------------------------------------------------
# Guard de concurrencia: dos imports de plataforma a la vez sobre la misma
# sesión aplicarían diffs solapados (last-write-wins sobre estudio/files).
# Se cosecha primero con job_poll porque "running" es un status perezoso.
# ---------------------------------------------------------------------------

.carga_platform_job_running <- function(sid) {
  for (id in ls(.jobs)) {
    j <- .jobs[[id]]
    if (is.null(j) || !identical(j$sid, sid)) next
    if (!startsWith(as.character(j$kind %||% ""), "carga.platform.")) next
    if (!identical(j$status, "running")) next
    j <- tryCatch(job_poll(id), error = function(e) j)
    if (identical(j$status, "running")) return(TRUE)
  }
  FALSE
}

# ---------------------------------------------------------------------------
# Submit (hilo principal): snapshot + secretos + body a RDS, job callr y
# on_complete con merge mínimo. Devuelve el handle estándar de jobs.
# ---------------------------------------------------------------------------

.carga_platform_job_submit <- function(sid, action, parsed) {
  if (!(action %in% .CARGA_PLATFORM_JOB_ACTIONS)) {
    stop_api(400, "E_CARGA_JOB_ACTION",
             sprintf("Import de plataforma no soportado en modo async: '%s'.", action))
  }
  if (.carga_platform_job_running(sid)) {
    stop_api(409, "E_CARGA_JOB_RUNNING",
             "Ya hay un import o refresh de plataforma en curso para esta sesión. Espera a que termine antes de lanzar otro.")
  }
  s <- session_get(sid)
  # El body async no debe re-disparar async dentro del worker.
  parsed$async <- NULL
  state_path <- job_save_rds(sid, "carga_platform_state", s)
  secrets_path <- job_save_rds(sid, "carga_platform_secrets", .carga_platform_session_secrets(sid))
  parsed_path <- job_save_rds(sid, "carga_platform_body", parsed)
  project_path_before <- as.character(s$project_path %||% "")

  runner <- carga_platform_job_runner
  attr(runner, "prosecnur_job_function_name") <- "carga_platform_job_runner"
  kind <- paste0("carga.platform.", action)
  job_id <- job_submit(
    sid = sid,
    kind = kind,
    func = runner,
    args = list(
      sid = sid,
      action = action,
      state_path = state_path,
      parsed_path = parsed_path,
      secrets_path = secrets_path
    ),
    on_complete = function(j) {
      # Higiene primero: el RDS de secretos no debe sobrevivir al job.
      tryCatch(unlink(secrets_path), error = function(e) NULL)
      tryCatch(unlink(state_path), error = function(e) NULL)
      tryCatch(unlink(parsed_path), error = function(e) NULL)
      .carga_platform_job_apply(
        j$sid,
        j$result_data,
        project_path_before = project_path_before
      )
    }
  )
  list(ok = TRUE, async = TRUE, job_id = job_id, kind = kind)
}

# ---------------------------------------------------------------------------
# Runner (worker callr). El bootstrap de jobs.R ya cargó el paquete y fijó
# locale UTF-8; acá solo se siembra el sandbox y se corre el import real.
# ---------------------------------------------------------------------------

carga_platform_job_runner <- function(sid, action, state_path, parsed_path,
                                      secrets_path = NULL, progress_path = NULL) {
  report <- job_progress_writer(progress_path)
  report("prepare", percent = 1, message = "Preparando import en segundo plano...")

  snapshot <- readRDS(state_path)
  parsed <- readRDS(parsed_path)
  .session_env[[sid]] <- snapshot
  secrets <- if (!is.null(secrets_path) && file.exists(secrets_path)) {
    readRDS(secrets_path)
  } else {
    list()
  }
  for (name in names(secrets)) {
    prosecnur_session_secret_save(sid, name, secrets[[name]])
  }

  .carga_job_progress_install(report)
  on.exit(.carga_job_progress_reset(), add = TRUE)

  outcome <- tryCatch(
    list(ok = TRUE, payload = .carga_platform_call_action(sid, action, parsed)),
    api_error = function(e) {
      # El error de dominio viaja estructurado en el resultado del job (el
      # canal de error de callr solo conserva el message y perdería el E_*).
      list(ok = FALSE, error = list(
        code = as.character(e$code %||% "E_INTERNAL"),
        status = as.integer(e$status %||% 500L),
        message = conditionMessage(e),
        details = e$details
      ))
    }
  )
  if (!isTRUE(outcome$ok)) {
    return(list(ok = FALSE, action = action, error = outcome$error))
  }

  report("diff", percent = 97, message = "Consolidando cambios de sesión...")
  final <- .session_env[[sid]]
  changes <- list()
  for (key in names(final)) {
    if (!(key %in% names(snapshot)) || !identical(final[[key]], snapshot[[key]])) {
      # `changes[key] <- list(...)`: conserva el nombre cuando el valor nuevo
      # es NULL (mismo idioma que session_store; `[[<-` lo borraría).
      changes[key] <- list(final[[key]])
    }
  }
  removed <- setdiff(names(snapshot), names(final))
  list(
    ok = TRUE,
    action = action,
    payload = outcome$payload,
    session_changes = changes,
    session_removed = removed
  )
}
attr(carga_platform_job_runner, "prosecnur_job_function_name") <- "carga_platform_job_runner"

# ---------------------------------------------------------------------------
# Apply (hilo principal, dentro de on_complete): merge mínimo del diff sobre
# la sesión viva. Devuelve el payload público del job — con éxito, la MISMA
# forma que la respuesta síncrona del endpoint; con error de dominio, un
# objeto {ok:FALSE, error:{code,status,message,details}}.
# ---------------------------------------------------------------------------

.carga_platform_job_apply <- function(sid, result, project_path_before = "") {
  if (is.null(result) || !is.list(result)) {
    return(list(ok = FALSE, error = list(
      code = "E_CARGA_JOB_FAILED",
      message = "El import en segundo plano no devolvió resultado."
    )))
  }
  if (!isTRUE(result$ok)) {
    return(list(ok = FALSE, error = result$error %||% list(
      code = "E_CARGA_JOB_FAILED",
      message = "El import en segundo plano falló sin detalle."
    )))
  }
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) {
    return(list(ok = FALSE, error = list(
      code = "E_CARGA_JOB_STALE_SESSION",
      message = "La sesión ya no existe; se descartó el resultado del import."
    )))
  }
  # Si el usuario cambió de proyecto mientras corría el job, aplicar el diff
  # inyectaría bases del proyecto anterior en el nuevo. Se descarta.
  if (!identical(as.character(s$project_path %||% ""), as.character(project_path_before %||% ""))) {
    return(list(ok = FALSE, error = list(
      code = "E_CARGA_JOB_STALE_SESSION",
      message = "El proyecto abierto cambió durante el import; el resultado se descartó."
    )))
  }
  changes <- result$session_changes %||% list()
  for (key in names(changes)) {
    # Mismo idioma anti partial-matching de session_store: conservar el
    # nombre aunque el valor sea NULL.
    s[key] <- list(changes[[key]])
  }
  removed <- as.character(result$session_removed %||% character(0))
  if (length(removed)) s <- .session_state_clear(s, removed)
  .session_env[[sid]] <- s
  result$payload
}

# ---------------------------------------------------------------------------
# Gate único para los endpoints: async=TRUE ⇒ handle de job; default ⇒ el
# camino síncrono actual, sin cambios.
# ---------------------------------------------------------------------------

.carga_platform_endpoint <- function(sid, action, parsed) {
  if (.carga_platform_async_flag(parsed)) {
    .carga_platform_job_submit(sid, action, parsed)
  } else {
    .carga_platform_call_action(sid, action, parsed)
  }
}
