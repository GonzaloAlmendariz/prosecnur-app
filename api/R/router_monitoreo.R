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

.monitoreo_dashboard_cache_key <- "monitoreo-dashboard-v20260610-territorial-v3"

.monitoreo_dashboard_config_json <- function(cfg) {
  tryCatch(
    jsonlite::toJSON(cfg, auto_unbox = TRUE, null = "null", dataframe = "rows"),
    error = function(e) ""
  )
}

.monitoreo_dashboard_cache_token <- function(snapshot, data, cfg) {
  cfg_json <- .monitoreo_dashboard_config_json(cfg)
  paste(
    .monitoreo_dashboard_cache_key,
    nrow(data),
    ncol(data),
    snapshot$synced_at %||% "",
    cfg_json,
    sep = "|"
  )
}

.monitoreo_snapshot_dashboard_valid <- function(snapshot, data, cfg, cache_token) {
  if (!is.list(snapshot) || !is.list(snapshot$dashboard)) return(FALSE)
  if (!identical(snapshot$dashboard_cache_key %||% "", .monitoreo_dashboard_cache_key)) return(FALSE)
  saved_token <- snapshot$dashboard_cache_token %||% ""
  if (nzchar(saved_token) && identical(saved_token, cache_token)) return(TRUE)
  if (!is.list(snapshot$config)) return(FALSE)
  snapshot_cfg <- monitoreo_normalize_config(snapshot$config, data)
  identical(.monitoreo_dashboard_config_json(snapshot_cfg), .monitoreo_dashboard_config_json(cfg))
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

.monitoreo_public_dashboard <- function(dashboard, include_reports = TRUE) {
  if (is.null(dashboard) || !is.list(dashboard)) return(NULL)
  out <- list(
    ok = isTRUE(dashboard$ok),
    kpis = dashboard$kpis %||% list(),
    progress = .monitoreo_df_records(dashboard$progress),
    production = .monitoreo_df_records(dashboard$production),
    inconsistencies = .monitoreo_df_records(dashboard$inconsistencies)
  )
  if (isTRUE(include_reports) && !is.null(dashboard$acreditacion_reports)) {
    out$acreditacion_reports <- dashboard$acreditacion_reports
  }
  if (isTRUE(include_reports) && !is.null(dashboard$territorial_reports)) {
    out$territorial_reports <- dashboard$territorial_reports
  }
  out
}

.monitoreo_territorial_source <- function(sources, cfg = list(), source_id = "") {
  sources <- monitoreo_normalize_sources(sources)
  source_id <- .monitoreo_scalar(source_id %||% cfg$territorial$source_id, "")
  if (nzchar(source_id)) {
    hit <- Filter(function(src) identical(.monitoreo_scalar(src$id, ""), source_id), sources)
    if (length(hit)) return(hit[[1]])
  }
  asset_uid <- .monitoreo_scalar(cfg$territorial$asset_uid, "")
  if (nzchar(asset_uid)) {
    hit <- Filter(function(src) identical(.monitoreo_scalar(src$asset_uid, ""), asset_uid), sources)
    if (length(hit)) return(hit[[1]])
  }
  hit <- Filter(function(src) identical(.monitoreo_scalar(src$kind, ""), "kobo") && isTRUE(src$enabled), sources)
  if (length(hit)) return(hit[[1]])
  hit <- Filter(function(src) identical(.monitoreo_scalar(src$kind, ""), "kobo"), sources)
  if (length(hit)) return(hit[[1]])
  NULL
}

.monitoreo_territorial_context <- function(sid, cfg = list(), phase = NULL) {
  s <- session_get(sid)
  tcfg <- cfg$territorial %||% monitoreo_territorial_default_config()
  requested_phase <- .monitoreo_scalar(phase %||% tcfg$active_route_phase, "pilot")
  if (!requested_phase %in% c("pilot", "field")) requested_phase <- "pilot"
  runs <- s$hojas_ruta_runs %||% list()
  if (exists(".hojas_ruta_ensure_runs", mode = "function")) {
    s <- tryCatch(.hojas_ruta_ensure_runs(sid), error = function(e) s)
    runs <- s$hojas_ruta_runs %||% runs
  }
  if (is.null(runs[[requested_phase]]) && requested_phase == "pilot" && !is.null(runs$field)) requested_phase <- "field"
  if (is.null(runs[[requested_phase]]) && requested_phase == "field" && !is.null(runs$pilot)) requested_phase <- "pilot"
  run <- runs[[requested_phase]] %||% list()
  outputs <- run$workspace_outputs %||% run$outputs %||% list()
  population <- outputs$population %||% outputs$population_preview %||% outputs$populationPreview %||% NULL
  sample_size_preview <- outputs$sample_size_preview %||% outputs$sampleSizePreview %||% NULL
  quota <- outputs$quota %||% outputs$quota_preview %||% outputs$quotaPreview %||% NULL
  sample <- outputs$sample %||% outputs$sample_preview %||% outputs$samplePreview %||% run$sample %||% list()
  blocks <- tryCatch(.monitoreo_territorial_rows_df(sample$blocks %||% list()), error = function(e) data.frame())
  replacements <- tryCatch(.monitoreo_territorial_rows_df(sample$replacement_blocks %||% list()), error = function(e) data.frame())
  phase_note <- if (identical(requested_phase, "pilot") && !is.null(runs$field)) {
    "Piloto operativo activo; campo real queda disponible como referencia/preparacion."
  } else {
    ""
  }
  list(
    phase = requested_phase,
    phase_note = phase_note,
    run_locked = isTRUE(run$locked),
    phases_available = names(runs),
    config = run$config %||% list(),
    blocks = blocks,
    replacement_blocks = replacements,
    population = population,
    sample_size_preview = sample_size_preview,
    quota = quota,
    sample = sample,
    total_entrevistas = as.integer(sample$total_entrevistas %||% sum(suppressWarnings(as.integer(blocks$entrevistas)), na.rm = TRUE)),
    total_replacement_interviews = as.integer(sample$total_replacement_interviews %||% sum(suppressWarnings(as.integer(replacements$entrevistas)), na.rm = TRUE)),
    n_blocks = as.integer(nrow(blocks)),
    n_replacement_blocks = as.integer(nrow(replacements))
  )
}

.monitoreo_dashboard_for_session <- function(sid, data, cfg, include_reports = TRUE) {
  family <- cfg$monitoreo_profile$family %||% "acreditacion"
  territorial_context <- NULL
  kobo_schema <- NULL
  if (identical(family, "territorial")) {
    territorial_context <- .monitoreo_territorial_context(sid, cfg)
    kobo_schema <- session_get(sid)$monitoreo_kobo_schema %||% NULL
  }
  monitoreo_build_dashboard(
    data,
    cfg,
    include_reports = include_reports,
    territorial_context = territorial_context,
    kobo_schema = kobo_schema
  )
}

.monitoreo_kobo_asset_detail <- function(asset_uid, token, base_url) {
  uid <- trimws(as.character(asset_uid %||% "")[1])
  if (!nzchar(uid)) stop_api(400, "E_KOBO_ASSET", "Falta asset_uid de Kobo.")
  url <- sprintf(
    "%s/api/v2/assets/%s/?format=json",
    .kobo_api_trim_base_url(base_url),
    utils::URLencode(uid, reserved = TRUE)
  )
  .kobo_api_fetch_json(url, token)
}

.monitoreo_kobo_schema_from_asset <- function(detail) {
  survey <- detail$content$survey %||% list()
  choices <- detail$content$choices %||% list()
  row_value <- function(row, name, default = "") .monitoreo_scalar(row[[name]], default)
  row_label <- function(row, fallback = "") {
    if (!is.list(row)) return(.monitoreo_scalar(fallback, ""))
    label_names <- names(row)
    label_key <- intersect(label_names, c("label", "label::Espanol (es)", "label::Español (es)", "label::Spanish (es)", "label::English (en)"))[1]
    if (is.na(label_key) || !nzchar(label_key)) label_key <- grep("^label", label_names, value = TRUE)[1]
    label <- if (!is.na(label_key) && nzchar(label_key)) row[[label_key]] else ""
    if (is.list(label)) label <- unlist(label, use.names = FALSE)[1] %||% ""
    .monitoreo_scalar(label, fallback)
  }
  survey_fields <- list()
  for (row in survey) {
    if (!is.list(row)) next
    name <- row_value(row, "name")
    type <- row_value(row, "type")
    if (!nzchar(name) || grepl("^(begin_|end_|note$|calculate$)", type)) next
    list_name <- row_value(row, "select_from_list_name",
      if (grepl("^select_(one|multiple)\\s+", type, perl = TRUE)) sub("^select_(one|multiple)\\s+", "", type, perl = TRUE) else ""
    )
    survey_fields[[length(survey_fields) + 1L]] <- list(
      name = name,
      xpath = row_value(row, "$xpath", name),
      type = type,
      list_name = list_name,
      label = row_label(row, name)
    )
  }
  choices_by_list <- list()
  for (choice in choices) {
    if (!is.list(choice)) next
    list_key <- row_value(choice, "list_name")
    if (!nzchar(list_key)) next
    if (is.null(choices_by_list[[list_key]])) choices_by_list[[list_key]] <- list()
    choices_by_list[[list_key]][[length(choices_by_list[[list_key]]) + 1L]] <- list(
      name = row_value(choice, "name"),
      label = row_label(choice, row_value(choice, "name"))
    )
  }
  district_row <- NULL
  for (row in survey) {
    if (!is.list(row)) next
    name <- row_value(row, "name")
    xpath <- row_value(row, "$xpath")
    if (identical(name, "M5_district") || identical(xpath, "Core/M5_district") || grepl("district", name, ignore.case = TRUE)) {
      district_row <- row
      break
    }
  }
  district_field <- if (!is.null(district_row)) row_value(district_row, "$xpath", row_value(district_row, "name", "Core/M5_district")) else "Core/M5_district"
  list_name <- if (!is.null(district_row)) {
    row_value(district_row, "select_from_list_name",
      sub("^select_one\\s+", "", row_value(district_row, "type", "district"), perl = TRUE)
    )
  } else {
    "district"
  }
  district_choices <- choices_by_list[[list_name]] %||% list()
  list(
    asset_uid = .monitoreo_scalar(detail$uid %||% detail$asset_uid, ""),
    name = .monitoreo_scalar(detail$name %||% detail$title, ""),
    version_id = .monitoreo_scalar(detail$version_id %||% detail$deployed_version_id %||% detail$deployment__version_id, ""),
    date_modified = .monitoreo_scalar(detail$date_modified, ""),
    deployment_active = isTRUE(detail$deployment__active %||% detail$deployment_active %||% FALSE),
    survey_count = as.integer(length(survey)),
    choices_count = as.integer(length(choices)),
    district_field = district_field,
    district_list_name = list_name,
    district_choices = district_choices,
    survey_fields = survey_fields,
    choices_by_list = choices_by_list
  )
}

.monitoreo_state_payload <- function(sid, include_reports = TRUE) {
  s <- session_get(sid)
  sources <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
  snapshot <- s$monitoreo_snapshot %||% NULL
  data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
  cache_token <- .monitoreo_dashboard_cache_token(snapshot %||% list(), data, cfg)
  dashboard <- snapshot$dashboard %||% NULL
  family <- cfg$monitoreo_profile$family %||% "acreditacion"
  should_build_dashboard <- nrow(data) > 0L ||
    (isTRUE(include_reports) && identical(family, "territorial"))
  if (isTRUE(should_build_dashboard)) {
    cache_field <- if (isTRUE(include_reports)) "monitoreo_dashboard_cache" else "monitoreo_dashboard_light_cache"
    cache_token_field <- if (isTRUE(include_reports)) "monitoreo_dashboard_cache_token" else "monitoreo_dashboard_light_cache_token"
    cache_valid <- !is.null(s[[cache_field]]) &&
      identical(s[[cache_token_field]] %||% NULL, cache_token)
    if (isTRUE(cache_valid)) {
      dashboard <- s[[cache_field]]
    } else if (.monitoreo_snapshot_dashboard_valid(snapshot, data, cfg, cache_token)) {
      dashboard <- snapshot$dashboard
      s[[cache_field]] <- dashboard
      s[[cache_token_field]] <- cache_token
      .session_env[[sid]] <- s
    } else {
      dashboard <- .monitoreo_dashboard_for_session(sid, data, cfg, include_reports = include_reports)
      if (isTRUE(include_reports) && is.list(snapshot)) {
        snapshot$config <- cfg
        snapshot$dashboard <- dashboard
        snapshot$dashboard_cache_key <- .monitoreo_dashboard_cache_key
        snapshot$dashboard_cache_token <- cache_token
        session_set(sid, "monitoreo_snapshot", snapshot)
      }
      s <- session_get(sid)
      s[[cache_field]] <- dashboard
      s[[cache_token_field]] <- cache_token
      .session_env[[sid]] <- s
    }
  }
  list(
    ok = TRUE,
    sources = sources,
    config = cfg,
    monitoreo_profile = cfg$monitoreo_profile %||% monitoreo_normalize_profile(list()),
    has_snapshot = nrow(data) > 0L,
    synced_at = snapshot$synced_at %||% "",
    n_rows = as.integer(nrow(data)),
    variables = if (nrow(data)) monitoreo_variables(data) else list(),
    dashboard = .monitoreo_public_dashboard(dashboard, include_reports = include_reports),
    territorial_update_history = .monitoreo_territorial_history(sid),
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
    snapshot$dashboard <- .monitoreo_dashboard_for_session(sid, data, cfg)
    snapshot$dashboard_cache_key <- .monitoreo_dashboard_cache_key
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
    profile_id <- .monitoreo_scalar(source$connection_profile_id %||% source$profile_id, "")
    token <- .connections_token_require("kobo", sid, profile_id = profile_id)
    if (!nzchar(source$asset_uid)) stop_api(400, "E_KOBO_ASSET", "Falta asset_uid de Kobo.")
    base_url <- .monitoreo_scalar(source$base_url, "")
    if (!nzchar(base_url)) base_url <- .connections_profile_base_url("kobo", profile_id)
    if (!nzchar(base_url)) base_url <- kobo_api_default_base_url()
    probe <- tryCatch(
      kobo_api_fetch_asset_data(source$asset_uid, token, base_url = base_url, page = 1L, page_size = 1L),
      error = function(e) stop_api(400, "E_KOBO_API_FAILED", conditionMessage(e))
    )
    list(ok = TRUE, count = as.integer(probe$count %||% 0L))
  } else if (identical(kind, "google_sheets")) {
    binding <- source$sheet_binding %||% list()
    if (!nzchar(.monitoreo_scalar(binding$spreadsheet_id, ""))) {
      stop_api(400, "E_SHEETS_SPREADSHEET", "Falta spreadsheet_id de Google Sheets.")
    }
    if (!nzchar(.monitoreo_scalar(binding$sheet_name, ""))) {
      stop_api(400, "E_SHEETS_TAB", "Falta sheet_name de Google Sheets.")
    }
    list(
      ok = TRUE,
      spreadsheet_id = binding$spreadsheet_id,
      sheet_name = binding$sheet_name,
      mode = source$integration_mode %||% "connected_read"
    )
  } else {
    stop_api(400, "E_SOURCE_KIND", "Fuente de monitoreo no soportada.")
  }
}

.monitoreo_source_from_payload <- function(parsed) {
  kind <- .monitoreo_scalar(parsed$kind, "")
  if (!kind %in% c("kobo", "surveymonkey", "google_sheets")) {
    stop_api(400, "E_SOURCE_KIND", "kind debe ser 'kobo', 'surveymonkey' o 'google_sheets'.")
  }
  label_raw <- .monitoreo_scalar(parsed$label, "")
  source <- list(
    id = parsed$id %||% "",
    kind = kind,
    label = if (nzchar(label_raw)) label_raw else if (identical(kind, "kobo")) "Kobo" else if (identical(kind, "surveymonkey")) "SurveyMonkey" else "Google Sheets",
    enabled = parsed$enabled %||% TRUE,
    asset_uid = parsed$asset_uid %||% parsed$assetUid %||% "",
    survey_id = parsed$survey_id %||% parsed$surveyId %||% "",
    survey_title = parsed$survey_title %||% parsed$surveyTitle %||% "",
    base_url = parsed$base_url %||% parsed$baseUrl %||% if (identical(kind, "kobo")) kobo_api_default_base_url() else if (identical(kind, "surveymonkey")) "https://api.surveymonkey.com/v3" else "",
    connection_profile_id = parsed$connection_profile_id %||% parsed$connectionProfileId %||% parsed$profile_id %||% parsed$profileId %||% "",
    role = parsed$role %||% parsed$rol %||% NULL,
    integration_mode = parsed$integration_mode %||% parsed$integrationMode %||% NULL,
    sheet_binding = parsed$sheet_binding %||% parsed$sheetBinding %||% parsed,
    dimensions = parsed$dimensions %||% parsed$dimensiones %||% list(
      actor = parsed$actor %||% "",
      servicio = parsed$servicio %||% "",
      municipalidad = parsed$municipalidad %||% ""
    )
  )
  source <- monitoreo_normalize_sources(list(source))[[1]]
  attr(source, "label_raw") <- label_raw
  source
}

.monitoreo_sheets_stop <- function(e) {
  stop_api(400, "E_GOOGLE_SHEETS", conditionMessage(e))
}

.monitoreo_html_escape <- function(x) {
  x <- as.character(x %||% "")
  x <- gsub("&", "&amp;", x, fixed = TRUE)
  x <- gsub("<", "&lt;", x, fixed = TRUE)
  x <- gsub(">", "&gt;", x, fixed = TRUE)
  x <- gsub('"', "&quot;", x, fixed = TRUE)
  x
}

.monitoreo_sheets_source_from_body <- function(parsed) {
  binding <- .monitoreo_sheet_binding(parsed$sheet_binding %||% parsed)
  list(
    id = parsed$id %||% "",
    kind = "google_sheets",
    label = parsed$label %||% parsed$name %||% binding$sheet_name %||% "Google Sheets",
    enabled = parsed$enabled %||% TRUE,
    role = parsed$role %||% "barrido",
    integration_mode = parsed$integration_mode %||% "connected_read",
    sheet_binding = binding,
    dimensions = parsed$dimensions %||% parsed$dimensiones %||% list()
  )
}

.monitoreo_store_sheet_source <- function(sid, source) {
  source <- monitoreo_normalize_sources(list(source))[[1]]
  validation <- .monitoreo_validate_source(source, sid)
  sources <- monitoreo_upsert_source(session_get(sid)$monitoreo_sources %||% list(), source)
  session_set(sid, "monitoreo_sources", sources)
  list(ok = TRUE, source = source, validation = validation, state = .monitoreo_state_payload(sid))
}

.monitoreo_report_sheet_by_id <- function(reports, id) {
  for (sheet in reports$sheets %||% list()) {
    if (identical(as.character(sheet$id %||% ""), id)) return(sheet)
  }
  NULL
}

.monitoreo_report_sheet_rows <- function(sheet, fallback_title = "") {
  if (is.null(sheet) || !is.list(sheet)) return(list(c(fallback_title)))
  rows <- list(c(as.character(sheet$title %||% fallback_title)))
  desc <- as.character(sheet$description %||% "")
  if (nzchar(desc)) rows[[length(rows) + 1L]] <- c(desc)
  rows[[length(rows) + 1L]] <- character(0)
  for (block in sheet$blocks %||% list()) {
    rows[[length(rows) + 1L]] <- c(as.character(block$title %||% "Bloque"))
    columns <- as.character(unlist(block$columns %||% list(), use.names = FALSE))
    if (length(columns)) rows[[length(rows) + 1L]] <- columns
    for (row in block$rows %||% list()) {
      rows[[length(rows) + 1L]] <- vapply(columns, function(col) as.character(row[[col]] %||% ""), character(1))
    }
    note <- as.character(block$note %||% "")
    if (nzchar(note)) rows[[length(rows) + 1L]] <- c("Nota", note)
    rows[[length(rows) + 1L]] <- character(0)
  }
  rows
}

.monitoreo_sheets_publish_payload <- function(snapshot, cfg) {
  dashboard <- snapshot$dashboard %||% NULL
  reports <- dashboard$acreditacion_reports %||% NULL
  if (is.list(reports) && length(reports$sheets %||% list())) {
    return(list(
      "Prosecnur - Resumen" = .monitoreo_report_sheet_rows(.monitoreo_report_sheet_by_id(reports, "resumen"), "Resumen"),
      "Prosecnur - Alertas" = .monitoreo_report_sheet_rows(.monitoreo_report_sheet_by_id(reports, "alertas"), "Alertas"),
      "Prosecnur - Auditoria" = .monitoreo_report_sheet_rows(.monitoreo_report_sheet_by_id(reports, "monitoreo_telefonico"), "Auditoria"),
      "Prosecnur - Reporte" = .monitoreo_report_sheet_rows(.monitoreo_report_sheet_by_id(reports, "reporte"), "Reporte")
    ))
  }
  acr <- cfg$acreditacion %||% monitoreo_normalize_acreditacion(list())
  rows_summary <- list(c("Indicador", "Valor"))
  if (!is.null(dashboard$kpis)) {
    for (nm in names(dashboard$kpis)) rows_summary[[length(rows_summary) + 1L]] <- c(nm, as.character(dashboard$kpis[[nm]] %||% ""))
  }
  rows_alerts <- list(c("Nivel", "Tipo", "Detalle"))
  for (a in acr$dashboard$alertas %||% list()) {
    rows_alerts[[length(rows_alerts) + 1L]] <- c(
      as.character(a$severidad %||% ""),
      as.character(a$tipo %||% ""),
      as.character(a$mensaje %||% "")
    )
  }
  rows_audit <- list(
    c("Campo", "Valor"),
    c("synced_at", as.character(snapshot$synced_at %||% "")),
    c("rows", as.character(nrow(snapshot$data %||% data.frame()))),
    c("profile", as.character(cfg$monitoreo_profile$family %||% "")),
    c("variant", as.character(cfg$monitoreo_profile$variant %||% ""))
  )
  rows_report <- rows_summary
  list(
    "Prosecnur - Resumen" = rows_summary,
    "Prosecnur - Alertas" = rows_alerts,
    "Prosecnur - Auditoria" = rows_audit,
    "Prosecnur - Reporte" = rows_report
  )
}

.monitoreo_sheets_publish_local <- function(spreadsheet_id, tabs) {
  monitoreo_sheets_publish_tabs(spreadsheet_id, tabs)
}

.monitoreo_client_report_model_for_snapshot <- function(snapshot, cfg, include_targets = FALSE) {
  if (is.null(snapshot) || !is.data.frame(snapshot$data) || !nrow(snapshot$data)) {
    stop_api(409, "E_NO_MONITOREO_DATA", "Sincroniza datos antes de generar el reporte a cliente.")
  }
  cfg <- monitoreo_normalize_config(cfg, snapshot$data)
  model <- monitoreo_acreditacion_client_report_model(snapshot$data, cfg)
  model$sheets <- monitoreo_acreditacion_client_report_sheets(model, include_targets = isTRUE(include_targets))
  model
}

.monitoreo_client_report_tabs_payload <- function(model) {
  sheets <- model$sheets %||% list()
  if (!length(sheets)) sheets <- monitoreo_acreditacion_client_report_sheets(model, include_targets = FALSE)
  tabs <- list()
  for (sheet in sheets) {
    if (!identical(as.character(sheet$scope %||% ""), "cliente")) next
    title <- as.character(sheet$title %||% sheet$id %||% "")
    if (!nzchar(title)) next
    tabs[[title]] <- .monitoreo_report_sheet_rows(sheet, title)
  }
  tabs
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

.monitoreo_territorial_history <- function(sid) {
  s <- session_get(sid)
  raw <- s$monitoreo_territorial_update_history %||% list()
  if (!is.list(raw)) return(list())
  entries <- lapply(raw, function(entry) {
    if (!is.list(entry)) entry <- list()
    list(
      id = .monitoreo_scalar(entry$id, ""),
      type = .monitoreo_scalar(entry$type, "sync"),
      asset_uid = .monitoreo_scalar(entry$asset_uid, ""),
      asset_name = .monitoreo_scalar(entry$asset_name, ""),
      version_id = .monitoreo_scalar(entry$version_id, ""),
      source_id = .monitoreo_scalar(entry$source_id, ""),
      response_count = as.integer(.monitoreo_num(entry$response_count, 0)),
      status = .monitoreo_scalar(entry$status, "ok"),
      message = .monitoreo_scalar(entry$message, ""),
      created_at = .monitoreo_scalar(entry$created_at, "")
    )
  })
  Filter(function(entry) nzchar(entry$id) || nzchar(entry$created_at), entries)
}

.monitoreo_territorial_history_add <- function(sid, entry) {
  if (!is.list(entry)) entry <- list()
  now <- .monitoreo_now_iso()
  clean <- list(
    id = .monitoreo_scalar(entry$id, paste0("territorial-", as.integer(Sys.time()), "-", sample.int(999999L, 1L))),
    type = .monitoreo_scalar(entry$type, "sync"),
    asset_uid = .monitoreo_scalar(entry$asset_uid, ""),
    asset_name = .monitoreo_scalar(entry$asset_name, ""),
    version_id = .monitoreo_scalar(entry$version_id, ""),
    source_id = .monitoreo_scalar(entry$source_id, ""),
    response_count = as.integer(.monitoreo_num(entry$response_count, 0)),
    status = .monitoreo_scalar(entry$status, "ok"),
    message = .monitoreo_scalar(entry$message, ""),
    created_at = .monitoreo_scalar(entry$created_at, now)
  )
  history <- c(list(clean), .monitoreo_territorial_history(sid))
  if (length(history) > 50L) history <- history[seq_len(50L)]
  session_set(sid, "monitoreo_territorial_update_history", history)
  invisible(history)
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
    plumber::pr_get("/api/monitoreo/state", wrap_endpoint(function(req, res, include_reports = NULL, includeReports = NULL, ...) {
      sid <- .monitoreo_session(req, res)
      include_reports <- .monitoreo_bool(include_reports %||% includeReports, TRUE)
      .monitoreo_state_payload(sid, include_reports = include_reports)
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
    plumber::pr_get("/api/monitoreo/sheets/status", wrap_endpoint(function(req, res) {
      monitoreo_sheets_oauth_status()
    })) |>
    plumber::pr_post("/api/monitoreo/sheets/connect", wrap_endpoint(function(req, res, ...) {
      stop_api(410, "E_CONNECTION_GLOBAL", "Google Sheets se autoriza en Configuracion global. Usa /api/connections/google_sheets/oauth.")
    })) |>
    plumber::pr_post("/api/monitoreo/sheets/oauth/exchange", wrap_endpoint(function(req, res, ...) {
      stop_api(410, "E_CONNECTION_GLOBAL", "Google Sheets se autoriza en Configuracion global. Usa /api/connections/google_sheets/oauth.")
    })) |>
    plumber::pr_get("/api/monitoreo/sheets/oauth/callback", function(req, res, code = NULL, state = NULL, error = NULL, ...) {
      "<!doctype html><meta charset='utf-8'><title>Prosecnur OAuth</title><body><h1>Autorizacion movida a Configuracion global</h1><p>Vuelve a Prosecnur, abre Configuracion > Conexiones y autoriza Google Sheets desde ahi.</p></body>"
    }) |>
    plumber::pr_post("/api/monitoreo/sheets/list", wrap_endpoint(function(req, res, ...) {
      parsed <- .monitoreo_parse_body(req)
      tryCatch(
        monitoreo_sheets_list_spreadsheets(limit = parsed$limit %||% 50L),
        error = .monitoreo_sheets_stop
      )
    })) |>
    plumber::pr_post("/api/monitoreo/sheets/inspect", wrap_endpoint(function(req, res, ...) {
      parsed <- .monitoreo_parse_body(req)
      binding <- .monitoreo_sheet_binding(parsed$sheet_binding %||% parsed)
      tryCatch(
        monitoreo_sheets_inspect(
          spreadsheet_id = binding$spreadsheet_id,
          sheet_name = binding$sheet_name,
          header_row = binding$header_row,
          range = binding$range
        ),
        error = .monitoreo_sheets_stop
      )
    })) |>
    plumber::pr_post("/api/monitoreo/sheets/source", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      .monitoreo_store_sheet_source(sid, .monitoreo_sheets_source_from_body(parsed))
    })) |>
    plumber::pr_post("/api/monitoreo/sheets/sync", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      sources <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
      sources <- Filter(function(src) identical(src$kind, "google_sheets") && isTRUE(src$enabled), sources)
      if (length(parsed$source_ids %||% list())) {
        wanted <- .monitoreo_chr_vec(parsed$source_ids)
        sources <- Filter(function(src) src$id %in% wanted, sources)
      }
      cfg <- monitoreo_normalize_config(parsed$config %||% s$monitoreo_config %||% list())
      result <- tryCatch(
        monitoreo_sync_sources(sources, cfg, since = NULL),
        error = .monitoreo_sheets_stop
      )
      result$dashboard <- .monitoreo_dashboard_for_session(sid, result$data, result$config)
      snapshot <- list(
        synced_at = result$synced_at,
        data = result$data,
        config = result$config,
        dashboard = result$dashboard,
        variables = result$variables,
        errors = result$errors
      )
      session_set(sid, "monitoreo_sources", result$sources)
      session_set(sid, "monitoreo_config", result$config)
      session_set(sid, "monitoreo_snapshot", snapshot)
      list(
        ok = TRUE,
        synced_at = result$synced_at,
        n_rows = as.integer(result$n_rows),
        n_sources = as.integer(result$n_sources),
        state = .monitoreo_state_payload(sid)
      )
    })) |>
    plumber::pr_post("/api/monitoreo/sheets/publish", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      if (is.null(snapshot) || !is.data.frame(snapshot$data)) {
        stop_api(409, "E_NO_MONITOREO_DATA", "Sincroniza datos antes de publicar pestanas Prosecnur.")
      }
      cfg <- monitoreo_normalize_config(parsed$config %||% s$monitoreo_config %||% list(), snapshot$data)
      spreadsheet_id <- .monitoreo_extract_spreadsheet_id(parsed$spreadsheet_id %||% parsed$spreadsheetId %||% "")
      if (!nzchar(spreadsheet_id)) {
        sources <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
        writable <- Filter(function(src) identical(src$kind, "google_sheets") && identical(src$integration_mode, "controlled_write"), sources)
        if (length(writable)) spreadsheet_id <- writable[[1]]$sheet_binding$spreadsheet_id %||% ""
      }
      if (!nzchar(spreadsheet_id)) stop_api(400, "E_SHEETS_SPREADSHEET", "Falta spreadsheet_id destino.")
      tabs <- .monitoreo_sheets_publish_payload(snapshot, cfg)
      published <- tryCatch(.monitoreo_sheets_publish_local(spreadsheet_id, tabs), error = .monitoreo_sheets_stop)
      session_set(sid, "monitoreo_sheet_publish_events", c(
        s$monitoreo_sheet_publish_events %||% list(),
        list(c(published, list(tabs = names(tabs))))
      ))
      published
    })) |>
    plumber::pr_post("/api/monitoreo/client-report/sheets/publish", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      cfg <- monitoreo_normalize_config(parsed$config %||% s$monitoreo_config %||% list(), snapshot$data %||% data.frame())
      include_targets <- .monitoreo_bool(parsed$include_targets %||% parsed$includeTargets, FALSE)
      model <- .monitoreo_client_report_model_for_snapshot(snapshot, cfg, include_targets = include_targets)
      spreadsheet_id <- .monitoreo_extract_spreadsheet_id(parsed$spreadsheet_id %||% parsed$spreadsheetId %||% "")
      if (!nzchar(spreadsheet_id)) {
        sources <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
        writable <- Filter(function(src) identical(src$kind, "google_sheets") && identical(src$integration_mode, "controlled_write"), sources)
        if (length(writable)) spreadsheet_id <- writable[[1]]$sheet_binding$spreadsheet_id %||% ""
      }
      if (!nzchar(spreadsheet_id)) stop_api(400, "E_SHEETS_SPREADSHEET", "Falta spreadsheet_id destino para el reporte a cliente.")
      tabs <- .monitoreo_client_report_tabs_payload(model)
      published <- tryCatch(.monitoreo_sheets_publish_local(spreadsheet_id, tabs), error = .monitoreo_sheets_stop)
      session_set(sid, "monitoreo_client_report_sheet_events", c(
        s$monitoreo_client_report_sheet_events %||% list(),
        list(c(published, list(tabs = names(tabs), include_targets = include_targets)))
      ))
      published
    })) |>
    plumber::pr_post("/api/monitoreo/client-report/pdf", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      cfg <- monitoreo_normalize_config(parsed$config %||% s$monitoreo_config %||% list(), snapshot$data %||% data.frame())
      include_targets <- .monitoreo_bool(parsed$include_targets %||% parsed$includeTargets, FALSE)
      model <- .monitoreo_client_report_model_for_snapshot(snapshot, cfg, include_targets = include_targets)
      model_path <- job_save_rds(sid, "monitoreo_client_report_model", model)
      filename <- .export_filename(sid, "reporte_cliente_monitoreo", "pdf")
      job_id <- job_submit(
        sid = sid,
        kind = "monitoreo.client_report_pdf",
        func = function(model_path, include_targets = FALSE, result_path = NULL, progress_path = NULL) {
          report <- if (!is.null(progress_path)) job_progress_writer(progress_path) else function(...) invisible(NULL)
          report("prepare", percent = 15, message = "Preparando reporte a cliente...")
          model <- readRDS(model_path)
          report("render", percent = 55, message = "Renderizando PDF ejecutivo...")
          monitoreo_acreditacion_client_report_pdf(model, result_path, include_targets = include_targets)
          report("export", percent = 95, message = "Guardando PDF...")
          list(ok = TRUE, size = as.numeric(file.info(result_path)$size %||% 0), filename = basename(result_path))
        },
        args = list(model_path = model_path, include_targets = include_targets),
        result_filename = filename,
        on_complete = function(j) {
          if (identical(j$status, "done") && !is.null(j$result_path) && file.exists(j$result_path)) {
            session_set(j$sid, "monitoreo_client_report_pdf", list(
              disponible = TRUE,
              path = j$result_path,
              generated_at = format(j$finished_at, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
              include_targets = include_targets
            ))
          }
          j$result_data
        }
      )
      session_set(sid, "monitoreo_client_report_pdf", list(
        disponible = FALSE,
        job_id = job_id,
        generated_at = NULL,
        include_targets = include_targets
      ))
      list(ok = TRUE, job_id = job_id, kind = "monitoreo.client_report_pdf")
    })) |>
    plumber::pr_get("/api/monitoreo/client-report/pdf/download", wrap_endpoint(function(req, res, sid = NULL, inline = NULL, ...) {
      effective_sid <- session_header(req)
      if ((is.null(effective_sid) || !nzchar(effective_sid)) && is.character(sid) && length(sid) >= 1L && nzchar(sid[[1]])) {
        effective_sid <- sid[[1]]
      }
      s <- session_get(effective_sid)
      meta <- s$monitoreo_client_report_pdf %||% NULL
      if (is.null(meta) || !isTRUE(meta$disponible) || is.null(meta$path) || !file.exists(meta$path)) {
        if (!is.null(meta$job_id)) {
          j <- tryCatch(job_poll(meta$job_id), error = function(e) NULL)
          if (!is.null(j) && identical(j$status, "done") && !is.null(j$result_path) && file.exists(j$result_path)) {
            meta$path <- j$result_path
            meta$disponible <- TRUE
            meta$generated_at <- format(j$finished_at, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
            session_set(effective_sid, "monitoreo_client_report_pdf", meta)
          }
        }
      }
      if (is.null(meta) || !isTRUE(meta$disponible) || is.null(meta$path) || !file.exists(meta$path)) {
        stop_api(404, "E_NO_REPORTE_CLIENTE", "No hay PDF de reporte a cliente generado todavía.")
      }
      n <- file.info(meta$path)$size
      bytes <- readBin(meta$path, what = "raw", n = n)
      res$setHeader("Content-Type", "application/pdf")
      res$setHeader("Content-Length", as.character(n))
      modo <- if (is.character(inline) && length(inline) >= 1L && inline[[1]] %in% c("1", "true", "TRUE")) "inline" else "attachment"
      res$setHeader("Content-Disposition", sprintf('%s; filename="%s"', modo, basename(meta$path)))
      res$body <- bytes
      res
    })) |>
    plumber::pr_post("/api/monitoreo/kobo/assets", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      profile_id <- parsed$connection_profile_id %||% parsed$connectionProfileId %||% parsed$profile_id %||% parsed$profileId %||% NULL
      token <- .connections_token_require("kobo", sid, profile_id = profile_id)
      base_url <- parsed$base_url %||% parsed$baseUrl %||% .connections_profile_base_url("kobo", profile_id)
      kobo_api_fetch_assets(
        token,
        base_url = if (nzchar(as.character(base_url %||% "")[1])) base_url else kobo_api_default_base_url(),
        limit = parsed$limit %||% 100L
      )
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/inspect-kobo", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(parsed$config %||% s$monitoreo_config %||% list(), data)
      sources <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
      source <- .monitoreo_territorial_source(sources, cfg, parsed$source_id %||% parsed$sourceId %||% "")
      asset_uid <- .monitoreo_scalar(parsed$asset_uid %||% parsed$assetUid %||% source$asset_uid %||% cfg$territorial$asset_uid, "")
      profile_id <- parsed$connection_profile_id %||% parsed$connectionProfileId %||% parsed$profile_id %||% parsed$profileId %||% source$connection_profile_id %||% NULL
      token <- .connections_token_require("kobo", sid, profile_id = profile_id)
      base_url <- parsed$base_url %||% parsed$baseUrl %||% source$base_url %||% .connections_profile_base_url("kobo", profile_id)
      if (!nzchar(.monitoreo_scalar(base_url, ""))) base_url <- kobo_api_default_base_url()
      detail <- tryCatch(
        .monitoreo_kobo_asset_detail(asset_uid, token, base_url),
        error = function(e) stop_api(400, "E_KOBO_ASSET_DETAIL", conditionMessage(e))
      )
      schema <- .monitoreo_kobo_schema_from_asset(detail)
      schema$base_url <- .kobo_api_trim_base_url(base_url)
      schema$inspected_at <- .monitoreo_now_iso()
      crosswalk <- .monitoreo_territorial_crosswalk_df(cfg$territorial$district_crosswalk)
      live_codes <- vapply(schema$district_choices %||% list(), function(x) .monitoreo_safe_name(x$name %||% ""), character(1))
      schema$district_crosswalk <- unname(lapply(seq_len(nrow(crosswalk)), function(i) {
        code <- .monitoreo_safe_name(crosswalk$kobo_code[[i]])
        list(
          kobo_code = crosswalk$kobo_code[[i]],
          kobo_label = crosswalk$kobo_label[[i]],
          ubigeo = crosswalk$ubigeo[[i]],
          distrito = crosswalk$distrito[[i]],
          present_in_kobo = code %in% live_codes
        )
      }))
      schema$assertions <- list(
        district_field = identical(schema$district_field, "Core/M5_district"),
        has_sjm = "sjm" %in% live_codes,
        has_vmt = "vmt" %in% live_codes,
        kobo_is_canonical = TRUE
      )
      tcfg <- cfg$territorial
      tcfg$asset_uid <- schema$asset_uid
      tcfg$kobo_asset_name <- schema$name
      tcfg$kobo_version_id <- schema$version_id
      tcfg$district_var <- schema$district_field
      tcfg$inspected_at <- schema$inspected_at
      if (!is.null(source)) tcfg$source_id <- source$id
      cfg$territorial <- monitoreo_territorial_normalize_config(tcfg, data)
      session_set(sid, "monitoreo_kobo_schema", schema)
      session_set(sid, "monitoreo_config", cfg)
      .monitoreo_territorial_history_add(sid, list(
        type = "inspect",
        asset_uid = schema$asset_uid,
        asset_name = schema$name,
        version_id = schema$version_id,
        source_id = .monitoreo_scalar(tcfg$source_id, ""),
        response_count = .monitoreo_snapshot_count(data, .monitoreo_scalar(tcfg$source_id, "")),
        status = "ok",
        message = "Formulario Kobo inspeccionado."
      ))
      list(ok = TRUE, schema = schema, config = cfg, state = .monitoreo_state_payload(sid))
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/config", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      patch <- parsed$territorial %||% parsed$config %||% parsed
      tcfg <- cfg$territorial
      for (nm in names(patch)) tcfg[[nm]] <- patch[[nm]]
      cfg$territorial <- monitoreo_territorial_normalize_config(tcfg, data)
      profile <- cfg$monitoreo_profile %||% monitoreo_normalize_profile(list())
      profile$family <- "territorial"
      profile$status <- "active"
      profile$route_selected <- TRUE
      cfg$monitoreo_profile <- monitoreo_normalize_profile(profile, acreditacion = cfg$acreditacion)
      cfg <- .monitoreo_store_config(sid, cfg)
      list(ok = TRUE, config = cfg, state = .monitoreo_state_payload(sid))
    })) |>
    plumber::pr_get("/api/monitoreo/territorial/map", wrap_endpoint(function(req, res, phase = NULL, ubigeo = NULL, ...) {
      sid <- .monitoreo_session(req, res)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      context <- .monitoreo_territorial_context(sid, cfg, phase = phase)
      payload <- monitoreo_territorial_map_payload(
        data,
        cfg,
        context,
        s$monitoreo_kobo_schema %||% NULL,
        ubigeo = ubigeo %||% ""
      )
      list(ok = TRUE, payload = payload)
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
      # Las credenciales globales viven en /api/connections; Monitoreo solo
      # registra fuentes operativas y bindings persistibles en .pulso.
      source <- .monitoreo_source_from_payload(parsed)
      kind <- source$kind
      label_raw <- attr(source, "label_raw", exact = TRUE) %||% ""
      validation <- .monitoreo_validate_source(source, sid)
      if (identical(kind, "surveymonkey") && !nzchar(source$survey_title %||% "") && nzchar(validation$title %||% "")) {
        source$survey_title <- validation$title
      }
      if (identical(kind, "surveymonkey") && !nzchar(label_raw) && nzchar(validation$title %||% "")) {
        source$label <- validation$title
      }
      sources <- monitoreo_upsert_source(session_get(sid)$monitoreo_sources %||% list(), source)
      session_set(sid, "monitoreo_sources", sources)
      list(ok = TRUE, source = source, validation = validation, state = .monitoreo_state_payload(sid))
    })) |>
    plumber::pr_post("/api/monitoreo/sources", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      raw_sources <- parsed$sources %||% parsed$items %||% list()
      if (is.data.frame(raw_sources)) {
        raw_sources <- lapply(seq_len(nrow(raw_sources)), function(i) as.list(raw_sources[i, , drop = FALSE]))
      }
      if (!is.list(raw_sources) || !length(raw_sources)) {
        stop_api(400, "E_NO_SOURCES", "Pasa sources con una o más fuentes de monitoreo.")
      }
      sources <- session_get(sid)$monitoreo_sources %||% list()
      added <- list()
      validations <- list()
      for (item in raw_sources) {
        if (is.data.frame(item)) item <- as.list(item[1, , drop = FALSE])
        if (!is.list(item)) next
        source <- .monitoreo_source_from_payload(item)
        kind <- source$kind
        label_raw <- attr(source, "label_raw", exact = TRUE) %||% ""
        validation <- .monitoreo_validate_source(source, sid)
        if (identical(kind, "surveymonkey") && !nzchar(source$survey_title %||% "") && nzchar(validation$title %||% "")) {
          source$survey_title <- validation$title
        }
        if (identical(kind, "surveymonkey") && !nzchar(label_raw) && nzchar(validation$title %||% "")) {
          source$label <- validation$title
        }
        sources <- monitoreo_upsert_source(sources, source)
        added[[length(added) + 1L]] <- source
        validations[[source$id %||% as.character(length(validations) + 1L)]] <- validation
      }
      session_set(sid, "monitoreo_sources", sources)
      list(ok = TRUE, sources = added, validations = validations, state = .monitoreo_state_payload(sid))
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
          result$dashboard <- .monitoreo_dashboard_for_session(j$sid, result$data, result$config)
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
          sources_now <- monitoreo_normalize_sources(result$sources %||% s_now$monitoreo_sources %||% list())
          ids <- unique(as.character(result$data$.source_id %||% character(0)))
          sources_now <- lapply(sources_now, function(src) {
            if (src$id %in% ids) src$last_sync_at <- result$synced_at
            src
          })
          session_set(j$sid, "monitoreo_sources", sources_now)
          family <- result$config$monitoreo_profile$family %||% ""
          if (identical(family, "territorial")) {
            synced_kobo <- Filter(function(src) {
              identical(src$kind, "kobo") && (!length(ids) || src$id %in% ids)
            }, sources_now)
            if (length(synced_kobo)) {
              for (src in synced_kobo) {
                .monitoreo_territorial_history_add(j$sid, list(
                  type = "sync",
                  asset_uid = .monitoreo_scalar(src$asset_uid %||% result$config$territorial$asset_uid, ""),
                  asset_name = .monitoreo_scalar(src$label %||% result$config$territorial$kobo_asset_name, ""),
                  version_id = .monitoreo_scalar(result$config$territorial$kobo_version_id, ""),
                  source_id = .monitoreo_scalar(src$id, ""),
                  response_count = .monitoreo_snapshot_count(result$data, .monitoreo_scalar(src$id, "")),
                  status = if (length(result$errors %||% list())) "warning" else "ok",
                  message = if (length(result$errors %||% list())) "Sincronización Kobo completada con alertas." else "Respuestas Kobo sincronizadas."
                ))
              }
            }
          }
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
