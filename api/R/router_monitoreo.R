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
  dashboard <- if (nrow(data)) monitoreo_build_dashboard(data, cfg) else snapshot$dashboard %||% NULL
  list(
    ok = TRUE,
    sources = sources,
    config = cfg,
    has_snapshot = nrow(data) > 0L,
    synced_at = snapshot$synced_at %||% "",
    n_rows = as.integer(nrow(data)),
    variables = if (nrow(data)) monitoreo_variables(data) else list(),
    dashboard = .monitoreo_public_dashboard(dashboard),
    acreditacion = cfg$acreditacion %||% monitoreo_normalize_acreditacion(list()),
    errors = snapshot$errors %||% list()
  )
}

.monitoreo_store_config <- function(sid, cfg) {
  s <- session_get(sid)
  snapshot <- s$monitoreo_snapshot %||% NULL
  data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  cfg <- monitoreo_normalize_config(cfg, data)
  session_set(sid, "monitoreo_config", cfg)
  if (!is.null(snapshot) && nrow(data)) {
    snapshot$config <- cfg
    snapshot$dashboard <- monitoreo_build_dashboard(data, cfg)
    session_set(sid, "monitoreo_snapshot", snapshot)
  }
  cfg
}

.monitoreo_validate_source <- function(source, sid = NULL) {
  kind <- source$kind
  if (identical(kind, "surveymonkey")) {
    token <- .connections_token_require("surveymonkey", sid)
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
    token <- .connections_token_require("kobo", sid)
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

.monitoreo_named_counts <- function(x) {
  x <- as.character(unlist(x, use.names = FALSE))
  x <- trimws(x[!is.na(x) & nzchar(trimws(x))])
  if (!length(x)) return(list())
  tab <- sort(table(x), decreasing = TRUE)
  out <- as.list(as.integer(tab))
  names(out) <- names(tab)
  out
}

.monitoreo_snapshot_count <- function(data, source_id = "", collector_id = "") {
  if (is.null(data) || !is.data.frame(data) || !nrow(data)) return(0L)
  ok <- rep(TRUE, nrow(data))
  if (nzchar(source_id) && ".source_id" %in% names(data)) {
    ok <- ok & as.character(data$.source_id) == source_id
  }
  if (nzchar(collector_id) && "collector_id" %in% names(data)) {
    ok <- ok & as.character(data$collector_id) == collector_id
  }
  as.integer(sum(ok, na.rm = TRUE))
}

.monitoreo_snapshot_values <- function(data, column, source_id = "", collector_id = "") {
  if (is.null(data) || !is.data.frame(data) || !nrow(data) || !column %in% names(data)) {
    return(character(0))
  }
  ok <- rep(TRUE, nrow(data))
  if (nzchar(source_id) && ".source_id" %in% names(data)) {
    ok <- ok & as.character(data$.source_id) == source_id
  }
  if (nzchar(collector_id) && "collector_id" %in% names(data)) {
    ok <- ok & as.character(data$collector_id) == collector_id
  }
  data[[column]][ok]
}

.monitoreo_snapshot_unique_count <- function(data, column, source_id = "", collector_id = "") {
  values <- as.character(.monitoreo_snapshot_values(data, column, source_id, collector_id))
  values <- trimws(values[!is.na(values) & nzchar(trimws(values))])
  as.integer(length(unique(values)))
}

.monitoreo_local_recipient_summary <- function(data, source_id = "", collector_id = "") {
  active_recipients <- .monitoreo_snapshot_unique_count(data, "recipient_id", source_id, collector_id)
  list(
    available = FALSE,
    total = active_recipients,
    scanned = 0L,
    truncated = FALSE,
    personalized_link_count = active_recipients,
    mail_status_counts = list(),
    response_status_counts = .monitoreo_named_counts(.monitoreo_snapshot_values(data, "response_status", source_id, collector_id))
  )
}

.monitoreo_collector_use_modality <- function(use) {
  switch(use,
    correo_autoaplicado = "email",
    telefono_asistido = "telefono",
    presencial_qr = "presencial",
    sms = "sms",
    mixto = "mixto",
    enlace_abierto = "mixto",
    "mixto"
  )
}

.monitoreo_collector_suggest_use <- function(collector_type, recipient_summary = list(), url_present = FALSE) {
  typ <- tolower(trimws(as.character(collector_type %||% "")[1]))
  recipients <- suppressWarnings(as.integer(recipient_summary$total %||% 0L))
  if (typ %in% c("email", "collector_email") || recipients > 0L) return("correo_autoaplicado")
  if (typ %in% c("sms", "text_message")) return("sms")
  if (typ %in% c("weblink", "web_link", "web", "link") && isTRUE(url_present)) return("presencial_qr")
  if (isTRUE(url_present)) return("enlace_abierto")
  "sin_clasificar"
}

.monitoreo_collector_config_map <- function(configured) {
  configured <- configured %||% list()
  if (is.data.frame(configured)) {
    configured <- lapply(seq_len(nrow(configured)), function(i) as.list(configured[i, , drop = FALSE]))
  }
  out <- list()
  if (!is.list(configured)) return(out)
  for (item in configured) {
    if (!is.list(item)) next
    source_id <- .monitoreo_scalar(item$source_id, "")
    collector_id <- .monitoreo_scalar(item$collector_id, "")
    if (!nzchar(collector_id)) next
    out[[paste(source_id, collector_id, sep = "::")]] <- item
    if (is.null(out[[collector_id]])) out[[collector_id]] <- item
  }
  out
}

.monitoreo_public_collector <- function(source, collector, detail, recipient_summary, saved, data) {
  detail <- detail %||% list()
  saved <- saved %||% list()
  collector_id <- .monitoreo_scalar(detail$id %||% collector$id %||% collector$collector_id, "")
  collector_type <- tolower(.monitoreo_scalar(detail$type %||% collector$type, ""))
  collector_name <- .monitoreo_scalar(detail$name %||% collector$name, collector_id)
  url_present <- nzchar(.monitoreo_scalar(detail$url %||% collector$url, ""))
  active_response_count <- .monitoreo_snapshot_count(data, .monitoreo_scalar(source$id, ""), collector_id)
  suggested_use <- .monitoreo_collector_suggest_use(collector_type, recipient_summary, url_present)
  if (identical(suggested_use, "sin_clasificar") &&
      active_response_count > 0L &&
      as.integer(recipient_summary$total %||% 0L) == 0L) {
    suggested_use <- "enlace_abierto"
  }
  configured_use <- .monitoreo_scalar(saved$operational_use %||% saved$uso_operativo, "")
  if (!configured_use %in% c("correo_autoaplicado", "telefono_asistido", "presencial_qr", "enlace_abierto", "sms", "mixto", "sin_clasificar")) {
    configured_use <- suggested_use
  }
  modality <- .monitoreo_scalar(saved$modality %||% saved$modalidad, .monitoreo_collector_use_modality(configured_use))
  if (!modality %in% c("email", "whatsapp", "sms", "telefono", "presencial", "mixto")) {
    modality <- .monitoreo_collector_use_modality(configured_use)
  }
  roster_required <- .monitoreo_bool(saved$roster_required %||% saved$requiere_base_casos, identical(configured_use, "telefono_asistido"))
  response_count <- suppressWarnings(as.integer(detail$response_count %||% collector$response_count %||% 0L))
  warnings <- character(0)
  if (identical(configured_use, "telefono_asistido") && isTRUE(recipient_summary$available) && as.integer(recipient_summary$total %||% 0L) == 0L) {
    warnings <- c(warnings, "Telefono asistido necesita destinatarios o base de casos.")
  }
  if (identical(configured_use, "telefono_asistido") && isTRUE(roster_required)) {
    warnings <- c(warnings, "Requiere base operativa para intentos, responsable y estado de llamada.")
  }

  list(
    id = paste(.monitoreo_scalar(source$id, ""), collector_id, sep = "::"),
    source_id = .monitoreo_scalar(source$id, ""),
    source_label = .monitoreo_scalar(source$label, ""),
    survey_id = .monitoreo_scalar(source$survey_id, ""),
    collector_id = collector_id,
    collector_name = collector_name,
    collector_type = collector_type,
    operational_use = configured_use,
    configured_use = configured_use,
    suggested_use = suggested_use,
    modality = modality,
    roster_required = roster_required,
    response_count = if (is.finite(response_count)) as.integer(response_count) else 0L,
    active_response_count = active_response_count,
    url_present = url_present,
    recipient_summary = recipient_summary,
    warnings = as.list(unique(warnings))
  )
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
    plumber::pr_post("/api/monitoreo/kobo/assets", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      token <- .connections_token_require("kobo", sid)
      kobo_api_fetch_assets(
        token,
        base_url = parsed$base_url %||% parsed$baseUrl %||% kobo_api_default_base_url(),
        limit = parsed$limit %||% 100L
      )
    })) |>
    plumber::pr_post("/api/monitoreo/surveymonkey/collectors", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      sources <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
      wanted <- .monitoreo_chr_vec(parsed$source_ids %||% parsed$sourceIds)
      sources <- Filter(function(src) {
        identical(src$kind, "surveymonkey") &&
          isTRUE(src$enabled) &&
          nzchar(src$survey_id) &&
          (!length(wanted) || src$id %in% wanted)
      }, sources)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      remote <- .monitoreo_bool(parsed$remote %||% parsed$refresh %||% parsed$include_remote %||% parsed$includeRemote, FALSE)
      include_recipients <- .monitoreo_bool(parsed$include_recipients %||% parsed$includeRecipients, FALSE)
      include_details <- .monitoreo_bool(parsed$include_details %||% parsed$includeDetails, FALSE)
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      saved_map <- .monitoreo_collector_config_map(cfg$operational_model$link_collectors %||% list())
      out <- list()
      for (source in sources) {
        if (!isTRUE(remote)) {
          collector_ids <- unique(trimws(as.character(.monitoreo_snapshot_values(data, "collector_id", source$id, ""))))
          collector_ids <- collector_ids[!is.na(collector_ids) & nzchar(collector_ids)]
          configured <- cfg$operational_model$link_collectors %||% list()
          if (is.data.frame(configured)) {
            configured <- lapply(seq_len(nrow(configured)), function(i) as.list(configured[i, , drop = FALSE]))
          }
          if (is.list(configured)) {
            for (item in configured) {
              if (!is.list(item)) next
              if (!identical(.monitoreo_scalar(item$source_id, ""), .monitoreo_scalar(source$id, ""))) next
              configured_id <- .monitoreo_scalar(item$collector_id %||% item$collectorId, "")
              if (nzchar(configured_id)) collector_ids <- unique(c(collector_ids, configured_id))
            }
          }
          for (collector_id in collector_ids) {
            saved <- saved_map[[paste(source$id, collector_id, sep = "::")]] %||% saved_map[[collector_id]] %||% list()
            fallback_name <- if (nzchar(.monitoreo_scalar(saved$collector_name %||% saved$label, ""))) {
              .monitoreo_scalar(saved$collector_name %||% saved$label, "")
            } else {
              paste("Colector", collector_id)
            }
            collector <- list(
              id = collector_id,
              name = fallback_name,
              type = .monitoreo_scalar(saved$collector_type %||% saved$tipo_colector, "")
            )
            out[[length(out) + 1L]] <- .monitoreo_public_collector(
              source,
              collector,
              collector,
              .monitoreo_local_recipient_summary(data, source$id, collector_id),
              saved,
              data
            )
          }
          next
        }

        token <- .connections_token_require("surveymonkey", sid)
        collectors <- tryCatch(
          sm_api_fetch_collectors(source$survey_id, token, base_url = source$base_url %||% "https://api.surveymonkey.com/v3"),
          error = function(e) stop_api(400, "E_SM_COLLECTORS", conditionMessage(e))
        )
        for (collector in collectors$data %||% list()) {
          collector_id <- .monitoreo_scalar(collector$id %||% collector$collector_id, "")
          if (!nzchar(collector_id)) next
          detail <- if (isTRUE(include_details)) {
            tryCatch(
              sm_api_fetch_collector_detail(collector_id, token, base_url = source$base_url %||% "https://api.surveymonkey.com/v3"),
              error = function(e) collector
            )
          } else {
            collector
          }
          recipient_summary <- if (isTRUE(include_recipients)) {
            tryCatch(
              sm_api_collector_recipient_summary(collector_id, token, base_url = source$base_url %||% "https://api.surveymonkey.com/v3"),
              error = function(e) list(
                available = FALSE,
                total = 0L,
                scanned = 0L,
                truncated = FALSE,
                personalized_link_count = 0L,
                mail_status_counts = list(),
                response_status_counts = list(),
                error = conditionMessage(e)
              )
            )
          } else {
            .monitoreo_local_recipient_summary(data, source$id, collector_id)
          }
          saved <- saved_map[[paste(source$id, collector_id, sep = "::")]] %||% saved_map[[collector_id]] %||% list()
          out[[length(out) + 1L]] <- .monitoreo_public_collector(source, collector, detail, recipient_summary, saved, data)
        }
      }
      list(
        ok = TRUE,
        generated_at = .monitoreo_now_iso(),
        mode = if (isTRUE(remote)) "surveymonkey" else "local_snapshot",
        source_count = as.integer(length(sources)),
        collectors = out
      )
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
        if (nzchar(token)) .connections_token_save("surveymonkey", token, persist = TRUE, sid = sid, res = res)
      } else {
        token <- .monitoreo_scalar(parsed$token, "")
        if (nzchar(token)) .connections_token_save("kobo", token, persist = TRUE, sid = sid, res = res)
      }
      label_raw <- .monitoreo_scalar(parsed$label, "")
      source <- list(
        id = parsed$id %||% "",
        kind = kind,
        label = if (nzchar(label_raw)) label_raw else if (identical(kind, "kobo")) "Kobo" else "SurveyMonkey",
        enabled = parsed$enabled %||% TRUE,
        asset_uid = parsed$asset_uid %||% parsed$assetUid %||% "",
        survey_id = parsed$survey_id %||% parsed$surveyId %||% "",
        base_url = parsed$base_url %||% parsed$baseUrl %||% if (identical(kind, "kobo")) kobo_api_default_base_url() else "https://api.surveymonkey.com/v3",
        dimensions = parsed$dimensions %||% parsed$dimensiones %||% list(
          actor = parsed$actor %||% "",
          servicio = parsed$servicio %||% "",
          municipalidad = parsed$municipalidad %||% ""
        )
      )
      source <- monitoreo_normalize_sources(list(source))[[1]]
      validation <- .monitoreo_validate_source(source, sid)
      if (identical(kind, "surveymonkey") && !nzchar(label_raw) && nzchar(validation$title %||% "")) {
        source$label <- validation$title
      }
      sources <- monitoreo_upsert_source(session_get(sid)$monitoreo_sources %||% list(), source)
      session_set(sid, "monitoreo_sources", sources)
      list(ok = TRUE, source = source, validation = validation, state = .monitoreo_state_payload(sid))
    })) |>
    plumber::pr_post("/api/monitoreo/config", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      cfg <- .monitoreo_store_config(sid, parsed$config %||% parsed)
      list(ok = TRUE, config = cfg, state = .monitoreo_state_payload(sid))
    })) |>
    plumber::pr_post("/api/monitoreo/collectors/config", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      op <- cfg$operational_model %||% list()
      op$link_collectors <- parsed$collectors %||% parsed$link_collectors %||% list()
      cfg$operational_model <- op
      cfg <- .monitoreo_store_config(sid, cfg)
      list(ok = TRUE, config = cfg, state = .monitoreo_state_payload(sid))
    })) |>
    plumber::pr_post("/api/monitoreo/import-from-calc-muestra", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      estudio <- parsed$estudio %||% s$calc_muestra_estudio %||% NULL
      if (is.null(estudio)) {
        stop_api(409, "E_NO_CALC_MUESTRA",
                 "No hay estudio de calculador para importar.")
      }
      acr <- tryCatch(
        monitoreo_acreditacion_from_calc(estudio),
        error = function(e) stop_api(400, "E_ACREDITACION_IMPORT", conditionMessage(e))
      )
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      cfg$acreditacion <- acr
      cfg <- .monitoreo_store_config(sid, cfg)
      list(ok = TRUE, acreditacion = cfg$acreditacion, state = .monitoreo_state_payload(sid))
    })) |>
    plumber::pr_post("/api/monitoreo/acreditacion/seguimiento", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      if (!isTRUE(cfg$acreditacion$enabled)) {
        stop_api(409, "E_NO_ACREDITACION",
                 "No hay seguimiento de acreditacion activo.")
      }
      acr <- tryCatch(
        monitoreo_acreditacion_update_seguimiento(cfg$acreditacion, parsed$seguimiento %||% parsed),
        error = function(e) stop_api(400, "E_ACREDITACION_SEGUIMIENTO", conditionMessage(e))
      )
      cfg$acreditacion <- acr
      cfg <- .monitoreo_store_config(sid, cfg)
      list(ok = TRUE, acreditacion = cfg$acreditacion, state = .monitoreo_state_payload(sid))
    })) |>
    plumber::pr_post("/api/monitoreo/cierre", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      if (!isTRUE(cfg$acreditacion$enabled)) {
        stop_api(409, "E_NO_ACREDITACION",
                 "No hay seguimiento de acreditacion activo.")
      }
      acr <- tryCatch(
        monitoreo_acreditacion_cerrar(
          cfg$acreditacion,
          plan_refuerzo = parsed$plan_refuerzo %||% "",
          aprobar_brechas = .monitoreo_bool(parsed$aprobar_brechas, FALSE)
        ),
        error = function(e) stop_api(409, "E_CIERRE_BLOQUEADO", conditionMessage(e))
      )
      cfg$acreditacion <- acr
      cfg <- .monitoreo_store_config(sid, cfg)
      list(ok = TRUE, acreditacion = cfg$acreditacion, state = .monitoreo_state_payload(sid))
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
