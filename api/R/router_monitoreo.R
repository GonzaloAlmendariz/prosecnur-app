.monitoreo_parse_body <- function(req) {
  body_raw <- if (!is.null(req$bodyRaw) && length(req$bodyRaw) > 0L) {
    rawToChar(req$bodyRaw)
  } else {
    req$postBody %||% ""
  }
  if (!nzchar(body_raw)) return(list())
  tryCatch(
    jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_BAD_JSON", "Body JSON invalido.")
  )
}

.monitoreo_session <- function(req, res = NULL) {
  sid <- session_header(req)
  if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
    sid <- session_create()
    if (!is.null(res)) res$setHeader("X-Pulso-Session", sid)
  }
  sid
}

.monitoreo_df_records <- function(x) {
  if (is.null(x)) return(list())
  if (!is.data.frame(x)) x <- as.data.frame(x, stringsAsFactors = FALSE)
  if (!nrow(x)) return(list())
  unname(lapply(seq_len(nrow(x)), function(i) {
    row <- as.list(x[i, , drop = FALSE])
    lapply(row, function(v) {
      if (length(v) == 0L) return(NA)
      v[[1]]
    })
  }))
}

.monitoreo_public_dashboard <- function(dashboard) {
  if (is.null(dashboard) || !is.list(dashboard)) return(NULL)
  list(
    ok = isTRUE(dashboard$ok),
    kpis = dashboard$kpis %||% list(),
    progress = .monitoreo_df_records(dashboard$progress),
    production = .monitoreo_df_records(dashboard$production),
    inconsistencies = .monitoreo_df_records(dashboard$inconsistencies)
  )
}

.monitoreo_state_payload <- function(sid) {
  s <- session_get(sid)
  sources <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
  snapshot <- s$monitoreo_snapshot %||% NULL
  data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
  dashboard <- if (!is.null(snapshot$dashboard)) snapshot$dashboard else if (nrow(data)) monitoreo_build_dashboard(data, cfg) else NULL
  list(
    ok = TRUE,
    sources = sources,
    config = cfg,
    has_snapshot = nrow(data) > 0L,
    synced_at = snapshot$synced_at %||% "",
    n_rows = as.integer(nrow(data)),
    variables = if (nrow(data)) monitoreo_variables(data) else list(),
    dashboard = .monitoreo_public_dashboard(dashboard),
    errors = snapshot$errors %||% list()
  )
}

.monitoreo_validate_source <- function(source) {
  kind <- source$kind
  if (identical(kind, "surveymonkey")) {
    token <- prosecnur_secret_load("sm_token")
    if (is.na(token) || !nzchar(token)) stop_api(400, "E_SM_TOKEN", "Falta token SurveyMonkey guardado.")
    if (!nzchar(source$survey_id)) stop_api(400, "E_SM_SURVEY", "Falta survey_id de SurveyMonkey.")
    details <- tryCatch(
      sm_api_fetch_survey_details(source$survey_id, token, base_url = source$base_url %||% "https://api.surveymonkey.com/v3"),
      error = function(e) stop_api(400, "E_SM_API_FAILED", conditionMessage(e))
    )
    scope <- sm_api_check_responses_scope(source$survey_id, token, base_url = source$base_url %||% "https://api.surveymonkey.com/v3")
    list(
      ok = isTRUE(scope$ok),
      title = .sm_first_nonempty(.sm_or(details$title, NA_character_), fallback = source$label),
      responses_scope = scope
    )
  } else if (identical(kind, "kobo")) {
    token <- prosecnur_secret_load("kobo_token")
    if (is.na(token) || !nzchar(token)) stop_api(400, "E_KOBO_TOKEN", "Falta token Kobo guardado.")
    if (!nzchar(source$asset_uid)) stop_api(400, "E_KOBO_ASSET", "Falta asset_uid de Kobo.")
    probe <- tryCatch(
      kobo_api_fetch_asset_data(source$asset_uid, token, base_url = source$base_url, page = 1L, page_size = 1L),
      error = function(e) stop_api(400, "E_KOBO_API_FAILED", conditionMessage(e))
    )
    list(ok = TRUE, count = as.integer(probe$count %||% 0L))
  } else {
    stop_api(400, "E_SOURCE_KIND", "Fuente de monitoreo no soportada.")
  }
}

mount_monitoreo <- function(pr) {
  pr |>
    plumber::pr_get("/api/monitoreo/state", wrap_endpoint(function(req, res) {
      sid <- .monitoreo_session(req, res)
      .monitoreo_state_payload(sid)
    })) |>
    plumber::pr_post("/api/monitoreo/demo", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      demo <- monitoreo_demo_payload(
        seed = parsed$seed %||% 20260514L,
        n = parsed$n %||% 96L
      )
      session_set(sid, "monitoreo_sources", demo$sources)
      session_set(sid, "monitoreo_config", demo$config)
      session_set(sid, "monitoreo_snapshot", demo$snapshot)
      list(ok = TRUE, state = .monitoreo_state_payload(sid))
    })) |>
    plumber::pr_post("/api/monitoreo/source", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      kind <- .monitoreo_scalar(parsed$kind, "")
      if (!kind %in% c("kobo", "surveymonkey")) {
        stop_api(400, "E_SOURCE_KIND", "kind debe ser 'kobo' o 'surveymonkey'.")
      }
      if (identical(kind, "surveymonkey")) {
        token <- .monitoreo_scalar(parsed$token, "")
        if (nzchar(token)) prosecnur_secret_save("sm_token", token)
      } else {
        token <- .monitoreo_scalar(parsed$token, "")
        if (nzchar(token)) prosecnur_secret_save("kobo_token", token)
      }
      source <- list(
        id = parsed$id %||% "",
        kind = kind,
        label = parsed$label %||% if (identical(kind, "kobo")) "Kobo" else "SurveyMonkey",
        enabled = parsed$enabled %||% TRUE,
        asset_uid = parsed$asset_uid %||% parsed$assetUid %||% "",
        survey_id = parsed$survey_id %||% parsed$surveyId %||% "",
        base_url = parsed$base_url %||% parsed$baseUrl %||% if (identical(kind, "kobo")) kobo_api_default_base_url() else "https://api.surveymonkey.com/v3"
      )
      source <- monitoreo_normalize_sources(list(source))[[1]]
      validation <- .monitoreo_validate_source(source)
      if (identical(kind, "surveymonkey") && nzchar(validation$title %||% "")) {
        source$label <- validation$title
      }
      sources <- monitoreo_upsert_source(session_get(sid)$monitoreo_sources %||% list(), source)
      session_set(sid, "monitoreo_sources", sources)
      list(ok = TRUE, source = source, validation = validation, state = .monitoreo_state_payload(sid))
    })) |>
    plumber::pr_post("/api/monitoreo/config", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      current_snapshot <- session_get(sid)$monitoreo_snapshot %||% NULL
      data <- if (!is.null(current_snapshot) && is.data.frame(current_snapshot$data)) current_snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(parsed$config %||% parsed, data)
      session_set(sid, "monitoreo_config", cfg)
      if (nrow(data)) {
        current_snapshot$config <- cfg
        current_snapshot$dashboard <- monitoreo_build_dashboard(data, cfg)
        session_set(sid, "monitoreo_snapshot", current_snapshot)
      }
      list(ok = TRUE, config = cfg, state = .monitoreo_state_payload(sid))
    })) |>
    plumber::pr_post("/api/monitoreo/sync", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      sources <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
      if (length(parsed$source_ids %||% list())) {
        wanted <- .monitoreo_chr_vec(parsed$source_ids)
        sources <- Filter(function(src) src$id %in% wanted, sources)
      }
      cfg <- monitoreo_normalize_config(parsed$config %||% s$monitoreo_config %||% list())
      since <- parsed$since %||% NULL
      sources_path <- job_save_rds(sid, "monitoreo_sources", sources)
      cfg_path <- job_save_rds(sid, "monitoreo_config", cfg)
      job_id <- job_submit(
        sid = sid,
        kind = "monitoreo.sync",
        func = function(sources_path, cfg_path, since = NULL, progress_path = NULL) {
          sources <- readRDS(sources_path)
          cfg <- readRDS(cfg_path)
          monitoreo_sync_sources(sources, cfg, since = since, progress_path = progress_path)
        },
        args = list(sources_path = sources_path, cfg_path = cfg_path, since = since),
        on_complete = function(j) {
          result <- j$result_data
          snapshot <- list(
            synced_at = result$synced_at,
            data = result$data,
            config = result$config,
            dashboard = result$dashboard,
            variables = result$variables,
            errors = result$errors
          )
          session_set(j$sid, "monitoreo_config", result$config)
          session_set(j$sid, "monitoreo_snapshot", snapshot)
          s_now <- session_get(j$sid)
          sources_now <- monitoreo_normalize_sources(s_now$monitoreo_sources %||% list())
          ids <- unique(as.character(result$data$.source_id %||% character(0)))
          sources_now <- lapply(sources_now, function(src) {
            if (src$id %in% ids) src$last_sync_at <- result$synced_at
            src
          })
          session_set(j$sid, "monitoreo_sources", sources_now)
          list(
            ok = TRUE,
            synced_at = result$synced_at,
            n_rows = as.integer(result$n_rows),
            n_sources = as.integer(result$n_sources),
            dashboard = .monitoreo_public_dashboard(result$dashboard),
            errors = result$errors
          )
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "monitoreo.sync")
    })) |>
    plumber::pr_post("/api/monitoreo/supervision/sample", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      if (is.null(snapshot) || !is.data.frame(snapshot$data) || !nrow(snapshot$data)) {
        stop_api(409, "E_NO_MONITOREO_DATA", "Sincroniza datos antes de generar supervision.")
      }
      cfg <- monitoreo_normalize_config(parsed$config %||% s$monitoreo_config %||% list(), snapshot$data)
      sample <- monitoreo_supervision_sample(
        snapshot$data,
        cfg,
        n = parsed$n %||% NULL,
        seed = parsed$seed %||% NULL,
        only_risk = .monitoreo_bool(parsed$only_risk, FALSE)
      )
      list(ok = TRUE, sample = .monitoreo_df_records(sample), n = as.integer(nrow(sample)))
    })) |>
    plumber::pr_post("/api/monitoreo/export", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      if (is.null(snapshot) || !is.data.frame(snapshot$data) || !nrow(snapshot$data)) {
        stop_api(409, "E_NO_MONITOREO_DATA", "Sincroniza datos antes de exportar.")
      }
      cfg <- monitoreo_normalize_config(parsed$config %||% s$monitoreo_config %||% list(), snapshot$data)
      dir.create(file.path(s$dir, "downloads"), showWarnings = FALSE, recursive = TRUE)
      out_name <- .export_filename(sid, "monitoreo_reporte", "xlsx")
      out_path <- file.path(s$dir, "downloads", sprintf("%s_%s", uuid::UUIDgenerate(), out_name))
      monitoreo_export_workbook(snapshot$data, cfg, out_path)
      meta <- .register_output_file(sid, "monitoreo_reporte", out_path, original_name = out_name)
      list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name, size = meta$size)
    }))
}
