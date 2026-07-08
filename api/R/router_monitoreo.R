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

.monitoreo_dashboard_cache_key <- "monitoreo-dashboard-v20260704-territorial-route-responsible-v1"

.monitoreo_dashboard_config_json <- function(cfg) {
  tryCatch(
    jsonlite::toJSON(cfg, auto_unbox = TRUE, null = "null", dataframe = "rows"),
    error = function(e) ""
  )
}

.monitoreo_report_scope <- function(value = "full") {
  scope <- .monitoreo_scalar(value, "full")
  if (!scope %in% c("light", "source", "route_summary", "advance_summary", "validation_summary", "queries_summary", "phone_summary", "full")) scope <- "full"
  scope
}

.monitoreo_timing_ms <- function(start) {
  as.integer(round(as.numeric(difftime(Sys.time(), start, units = "secs")) * 1000))
}

.monitoreo_log_timing <- function(event, fields = list()) {
  enabled <- tolower(Sys.getenv("PULSO_MONITOREO_TIMINGS", unset = "1"))
  if (!enabled %in% c("1", "true", "yes", "si", "sí")) return(invisible(NULL))
  safe <- vapply(names(fields), function(key) {
    value <- fields[[key]]
    value <- if (is.null(value) || length(value) == 0L) "" else as.character(value[[1]])
    value <- gsub("[\r\n\t]+", " ", value)
    sprintf("%s=%s", key, value)
  }, character(1))
  message(sprintf("[monitoreo] %s %s", event, paste(safe, collapse = " ")))
  invisible(NULL)
}

.monitoreo_dashboard_cache_token <- function(snapshot, data, cfg, report_scope = "full") {
  cfg_json <- .monitoreo_dashboard_config_json(cfg)
  data_hash <- tryCatch(monitoreo_snapshot_hash(data), error = function(e) "")
  report_schema <- if (identical(cfg$monitoreo_profile$family %||% "", "territorial")) {
    get0(".monitoreo_territorial_report_cache_schema", ifnotfound = "")
  } else {
    ""
  }
  paste(
    .monitoreo_dashboard_cache_key,
    report_schema,
    .monitoreo_report_scope(report_scope),
    nrow(data),
    ncol(data),
    data_hash,
    snapshot$synced_at %||% "",
    cfg_json,
    sep = "|"
  )
}

.monitoreo_snapshot_dashboard_valid <- function(snapshot, data, cfg, cache_token, report_scope = "full") {
  if (!is.list(snapshot) || !is.list(snapshot$dashboard)) return(FALSE)
  if (!identical(snapshot$dashboard_cache_key %||% "", .monitoreo_dashboard_cache_key)) return(FALSE)
  snapshot_scope <- .monitoreo_report_scope(snapshot$dashboard_report_scope %||% "full")
  if (!identical(snapshot_scope, .monitoreo_report_scope(report_scope))) return(FALSE)
  family <- cfg$monitoreo_profile$family %||% ""
  if (identical(family, "territorial") && report_scope %in% c("full", "validation_summary")) {
    audit_rows <- snapshot$dashboard$territorial_reports$response_audit %||% list()
    audit_n <- if (is.data.frame(audit_rows)) nrow(audit_rows) else if (is.list(audit_rows)) length(audit_rows) else 0L
    annulled_rows <- snapshot$dashboard$territorial_reports$production_annulments$rows %||% list()
    annulled_n <- if (is.data.frame(annulled_rows)) nrow(annulled_rows) else if (is.list(annulled_rows)) length(annulled_rows) else 0L
    expected_n <- if (is.data.frame(data)) nrow(data) else 0L
    if (expected_n > 0L && (audit_n + annulled_n) < expected_n) return(FALSE)
  }
  saved_token <- snapshot$dashboard_cache_token %||% ""
  if (nzchar(saved_token) && identical(saved_token, cache_token)) return(TRUE)
  if (nzchar(saved_token)) return(FALSE)
  if (identical(family, "acreditacion")) return(FALSE)
  if (!is.list(snapshot$config)) return(FALSE)
  snapshot_cfg <- monitoreo_normalize_config(snapshot$config, data)
  identical(.monitoreo_dashboard_config_json(snapshot_cfg), .monitoreo_dashboard_config_json(cfg))
}

.monitoreo_invalidate_dashboard_caches <- function(sid, snapshot = NULL) {
  s <- session_get(sid)
  for (scope in c("source", "route_summary", "advance_summary", "validation_summary", "queries_summary", "phone_summary", "full")) {
    s[[paste("monitoreo_dashboard_cache", scope, sep = "_")]] <- NULL
    s[[paste("monitoreo_dashboard_cache_token", scope, sep = "_")]] <- NULL
  }
  s$monitoreo_dashboard_cache <- NULL
  s$monitoreo_dashboard_cache_token <- NULL
  s$monitoreo_dashboard_light_cache <- NULL
  s$monitoreo_dashboard_light_cache_token <- NULL
  if (is.null(snapshot)) snapshot <- s$monitoreo_snapshot %||% NULL
  if (is.list(snapshot)) {
    snapshot$dashboard_cache_token <- NULL
    snapshot$dashboard_report_scope <- NULL
    s$monitoreo_snapshot <- snapshot
  }
  .session_env[[sid]] <- s
  invisible(snapshot)
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
  if (isTRUE(include_reports) && !is.null(dashboard$aulas_universitarias_reports)) {
    out$aulas_universitarias_reports <- dashboard$aulas_universitarias_reports
  }
  out
}

.monitoreo_public_select_records <- function(rows, fields, max_rows = Inf) {
  if (is.null(rows)) return(list())
  if (is.data.frame(rows)) {
    rows <- .monitoreo_df_records(rows)
  } else if (!is.list(rows)) {
    return(list())
  }
  rows <- Filter(is.list, rows)
  if (!length(rows)) return(list())
  if (is.finite(max_rows)) rows <- utils::head(rows, max_rows)
  unname(lapply(rows, function(row) {
    present <- intersect(fields, names(row))
    out <- row[present]
    out[!vapply(out, is.null, logical(1))]
  }))
}

.monitoreo_public_profile <- function(profile = list()) {
  list(
    family = .monitoreo_scalar(profile$family, ""),
    variant = .monitoreo_scalar(profile$variant, ""),
    status = .monitoreo_scalar(profile$status, "")
  )
}

.monitoreo_public_audience <- function(value = NULL) {
  audience <- tolower(.monitoreo_scalar(value, "client"))
  if (!audience %in% c("client", "internal")) "client" else audience
}

.monitoreo_last_publication_event <- function(events = list()) {
  if (!is.list(events) || !length(events)) return(NULL)
  events[[length(events)]]
}

.monitoreo_publication_sheet_event_key <- function(audience = "client") {
  paste0("monitoreo_publication_sheet_events_", .monitoreo_public_audience(audience))
}

.monitoreo_last_publication_spreadsheet_id <- function(s, audience = "client") {
  event <- .monitoreo_last_publication_event(s[[.monitoreo_publication_sheet_event_key(audience)]] %||% list())
  if (!is.list(event)) return("")
  .monitoreo_extract_spreadsheet_id(
    event$spreadsheet_id %||%
      event$spreadsheetId %||%
      event$spreadsheet_url %||%
      event$spreadsheetUrl %||%
      ""
  )
}

.monitoreo_resolve_publication_spreadsheet_id <- function(parsed, s, audience = "client") {
  requested <- parsed$spreadsheet_id %||% parsed$spreadsheetId %||% ""
  has_requested <- nzchar(trimws(.monitoreo_scalar(requested, "")))
  spreadsheet_id <- .monitoreo_extract_spreadsheet_id(requested)
  if (nzchar(spreadsheet_id)) return(spreadsheet_id)
  if (isTRUE(has_requested)) return("")
  spreadsheet_id <- .monitoreo_last_publication_spreadsheet_id(s, audience)
  if (nzchar(spreadsheet_id)) return(spreadsheet_id)
  ""
}

.monitoreo_publication_confirmed_full_data <- function(parsed = list()) {
  .monitoreo_bool(
    parsed$confirmed_full_data %||%
      parsed$confirmedFullData %||%
      parsed$confirm_internal %||%
      parsed$confirmInternal,
    FALSE
  )
}

.monitoreo_require_internal_publication_confirmation <- function(audience, parsed = list(), channel = "salida") {
  if (!identical(.monitoreo_public_audience(audience), "internal")) return(invisible(TRUE))
  if (.monitoreo_publication_confirmed_full_data(parsed)) return(invisible(TRUE))
  stop_api(
    400,
    "E_MONITOREO_INTERNAL_CONFIRMATION",
    sprintf("Confirma manualmente que la %s interna contiene datos completos antes de publicarla.", channel)
  )
}

.monitoreo_publication_project_label <- function(parsed = list(), s = list(), cfg = list()) {
  values <- list(
    parsed$project,
    parsed$project_name,
    parsed$projectName,
    cfg$project_name,
    cfg$nombre_proyecto,
    cfg$nombre,
    cfg$study_name,
    cfg$titulo,
    s$estudio$nombre
  )
  for (value in values) {
    label <- trimws(.monitoreo_scalar(value, ""))
    if (nzchar(label)) return(label)
  }
  project_path <- .monitoreo_scalar(s$project_path, "")
  if (nzchar(project_path)) return(tools::file_path_sans_ext(basename(project_path)))
  "Proyecto Monitoreo"
}

.monitoreo_publication_source_label <- function(s = list(), snapshot = list(), cfg = list(), parsed = list()) {
  requested <- trimws(.monitoreo_scalar(parsed$source %||% parsed$fuente, ""))
  if (nzchar(requested)) return(requested)
  sources <- s$monitoreo_sources %||% snapshot$sources %||% cfg$sources %||% cfg$fuentes %||% list()
  if (is.data.frame(sources)) sources <- .monitoreo_df_records(sources)
  labels <- character(0)
  if (is.list(sources) && length(sources)) {
    labels <- vapply(sources, function(item) {
      if (is.list(item)) {
        return(.monitoreo_scalar(
          item$title %||% item$name %||% item$label %||% item$id %||% item$source_id %||% item$kind,
          ""
        ))
      }
      .monitoreo_scalar(item, "")
    }, character(1))
  }
  labels <- unique(labels[!is.na(labels) & nzchar(trimws(labels))])
  if (length(labels)) {
    shown <- utils::head(labels, 3L)
    suffix <- if (length(labels) > 3L) sprintf(" +%d", length(labels) - 3L) else ""
    return(paste0(paste(shown, collapse = ", "), suffix))
  }
  "Motor canónico Prosecnur"
}

.monitoreo_publication_tab_columns <- function(tabs = list()) {
  columns <- character(0)
  if (!is.list(tabs) || !length(tabs)) return(columns)
  for (tab in tabs) {
    if (is.data.frame(tab)) {
      columns <- c(columns, names(tab))
    } else if (is.list(tab)) {
      columns <- c(columns, names(tab))
    }
  }
  columns <- as.character(columns)
  unique(columns[!is.na(columns) & nzchar(trimws(columns))])
}

.monitoreo_publication_report_scope <- function(family = "acreditacion", audience = "client") {
  audience <- .monitoreo_public_audience(audience)
  family_key <- .monitoreo_publication_family_key(family)
  engine_family <- .monitoreo_publication_engine_family(family_key)
  if (identical(audience, "internal")) return("full")
  if (identical(family_key, "telefonico")) return("phone_summary")
  if (identical(engine_family, "territorial")) "advance_summary" else "full"
}

.monitoreo_publication_preflight_from_tabs <- function(tabs,
                                                       family = "acreditacion",
                                                       audience = "client",
                                                       project = "",
                                                       cut = "",
                                                       source = "",
                                                       confirmed_full_data = FALSE,
                                                       canonical_counts = list(required = FALSE),
                                                       drift = list(status = "not_checked"),
                                                       performance = list(),
                                                       evidence = list(),
                                                       format_validation = list(ok = TRUE, evidence = TRUE, available = TRUE),
                                                       pdf_validation = list(required = FALSE),
                                                       operational_package_review = NULL) {
  required_tabs <- unname(.monitoreo_publication_sheet_tab_names(family, audience))
  present_tabs <- names(tabs %||% list())
  completeness <- list(
    ok = length(present_tabs) > 0L,
    n_tabs = as.integer(length(present_tabs))
  )
  monitoreo_deliverables_preflight(
    family = family,
    audience = audience,
    project = project,
    cut = cut,
    source = source,
    confirmed_full_data = confirmed_full_data,
    completeness = completeness,
    canonical_counts = canonical_counts %||% list(required = FALSE),
    sheets = list(required = required_tabs, present = present_tabs, evidence = TRUE),
    format_validation = format_validation %||% list(ok = TRUE, evidence = TRUE, available = TRUE),
    pdf_validation = pdf_validation %||% list(required = FALSE),
    drift = drift %||% list(status = "not_checked"),
    operational_package_review = operational_package_review,
    performance = performance %||% list(),
    client_columns = .monitoreo_publication_tab_columns(tabs),
    evidence = evidence %||% list()
  )
}

.monitoreo_publication_reference_drift_from_request <- function(sid,
                                                                parsed = list(),
                                                                out_dir = file.path("tmp", "qa", "monitoreo-deliverables"),
                                                                source = "",
                                                                cut = "",
                                                                project = "") {
  if (!is.list(parsed)) parsed <- list()
  drift <- parsed$drift %||%
    parsed$reference_drift %||%
    parsed$referenceDrift
  if (is.list(drift) && length(drift)) return(drift)

  drift_file_id <- parsed$drift_file_id %||%
    parsed$driftFileId %||%
    parsed$reference_drift_file_id %||%
    parsed$referenceDriftFileId
  if (!is.null(drift_file_id)) {
    drift_payload <- parsed
    drift_payload$sid <- sid
    drift_payload$drift_file_id <- drift_file_id
    return(.monitoreo_territorial_drift_from_payload(
      drift_payload,
      out_dir = out_dir,
      source = source,
      cut = cut,
      project = project
    ))
  }

  list(status = "not_checked")
}

.monitoreo_publication_preflight_bundle <- function(sid,
                                                    s,
                                                    snapshot,
                                                    parsed = list(),
                                                    audience = NULL,
                                                    spreadsheet_id = "") {
  if (is.null(snapshot) || !is.data.frame(snapshot$data) || !nrow(snapshot$data)) {
    stop_api(409, "E_NO_MONITOREO_DATA", "Sincroniza datos antes de revisar o publicar el ejecutivo en Sheets.")
  }
  started <- Sys.time()
  audience <- .monitoreo_public_audience(audience %||% parsed$audience %||% parsed$public_audience %||% parsed$publicAudience)
  raw_config <- parsed$config %||% s$monitoreo_config %||% snapshot$config %||% list()
  cfg <- monitoreo_normalize_config(raw_config, snapshot$data)
  include_targets <- .monitoreo_bool(parsed$include_targets %||% parsed$includeTargets, FALSE)
  publication_family <- detect_monitoreo_family(config = raw_config, data = snapshot$data)
  engine_family <- .monitoreo_publication_engine_family(publication_family)
  report_scope <- .monitoreo_publication_report_scope(publication_family, audience)
  dashboard <- snapshot$dashboard %||% NULL
  if (is.null(dashboard) || !is.list(dashboard)) {
    dashboard <- .monitoreo_dashboard_for_session(
      sid,
      snapshot$data,
      cfg,
      include_reports = TRUE,
      report_scope = report_scope
    )
  }
  if (identical(engine_family, "territorial") && identical(audience, "internal")) {
    if (is.null(dashboard$territorial_reports) || !is.list(dashboard$territorial_reports)) {
      dashboard$territorial_reports <- list()
    }
    dashboard$territorial_reports$field_occurrences <- .monitoreo_territorial_occurrences_dashboard(sid, cfg, dashboard$territorial_reports)
  }
  spreadsheet_id <- .monitoreo_scalar(spreadsheet_id, "")
  spreadsheet_url <- if (nzchar(spreadsheet_id)) paste0("https://docs.google.com/spreadsheets/d/", spreadsheet_id, "/edit") else ""
  project_label <- .monitoreo_publication_project_label(parsed, s, cfg)
  cut_label <- .monitoreo_scalar(snapshot$synced_at %||% snapshot$generated_at, .monitoreo_now_iso())
  source_label <- .monitoreo_publication_source_label(s, snapshot, cfg, parsed)
  drift <- .monitoreo_publication_reference_drift_from_request(
    sid,
    parsed,
    out_dir = file.path(
      "tmp",
      "qa",
      "monitoreo-deliverables",
      paste(
        .monitoreo_publication_evidence_slug(project_label, "project"),
        .monitoreo_publication_evidence_slug(audience, "audience"),
        .monitoreo_publication_evidence_slug(cut_label, format(Sys.Date(), "%Y-%m-%d")),
        "preflight-reference",
        sep = "-"
      )
    ),
    source = source_label,
    cut = cut_label,
    project = project_label
  )
  tabs <- monitoreo_publication_sheets_tabs(
    snapshot$data,
    cfg,
    audience = audience,
    include_targets = include_targets,
    dashboard = dashboard,
    synced_at = snapshot$synced_at %||% "",
    context = list(session_id = sid, spreadsheet_id = spreadsheet_id, spreadsheet_url = spreadsheet_url, family = publication_family)
  )
  elapsed <- as.numeric(difftime(Sys.time(), started, units = "secs"))
  performance <- parsed$performance %||% parsed$performance_items %||% list()
  if (!is.list(performance)) performance <- list()
  performance <- c(performance, list(list(
    name = "publication_preflight_model",
    elapsed_sec = round(elapsed, 3L),
    threshold_sec = 30
  )))
  preflight <- .monitoreo_publication_preflight_from_tabs(
    tabs,
    family = publication_family,
    audience = audience,
    project = project_label,
    cut = cut_label,
    source = source_label,
    confirmed_full_data = .monitoreo_publication_confirmed_full_data(parsed),
    canonical_counts = parsed$canonical_counts %||% parsed$canonicalCounts %||% list(required = FALSE),
    drift = drift,
    operational_package_review = parsed$operational_package_review %||%
      parsed$operationalPackageReview %||%
      parsed$package_review %||%
      parsed$packageReview %||%
      NULL,
    performance = performance,
    evidence = list(
      n_rows = as.integer(nrow(snapshot$data)),
      n_tabs = as.integer(length(tabs)),
      tabs = as.list(names(tabs)),
      spreadsheet_id = spreadsheet_id,
      spreadsheet_url = spreadsheet_url
    ),
    format_validation = parsed$format_validation %||% parsed$formatValidation %||% list(ok = TRUE, evidence = TRUE, available = TRUE),
    pdf_validation = parsed$pdf_validation %||% parsed$pdfValidation %||% list(required = FALSE)
  )
  list(
    audience = audience,
    cfg = cfg,
    include_targets = include_targets,
    publication_family = publication_family,
    engine_family = engine_family,
    report_scope = report_scope,
    dashboard = dashboard,
    tabs = tabs,
    preflight = preflight
  )
}

.monitoreo_publication_evidence_slug <- function(value, fallback = "monitoreo") {
  value <- trimws(.monitoreo_scalar(value, fallback))
  if (!nzchar(value)) value <- fallback
  value <- iconv(value, from = "", to = "ASCII//TRANSLIT", sub = "")
  value <- tolower(value)
  value <- gsub("[^a-z0-9]+", "-", value)
  value <- gsub("^-+|-+$", "", value)
  if (!nzchar(value)) fallback else value
}

.monitoreo_publication_evidence_zip_dir <- function(out_dir, zip_path) {
  entries <- list.files(out_dir, recursive = TRUE, all.files = FALSE, no.. = TRUE)
  if (!length(entries)) {
    stop_api(500, "E_MONITOREO_EVIDENCE_EMPTY", "El evidence pack no contiene archivos para comprimir.")
  }
  old <- getwd()
  on.exit(setwd(old), add = TRUE)
  dir.create(dirname(zip_path), recursive = TRUE, showWarnings = FALSE)
  if (file.exists(zip_path)) unlink(zip_path, force = TRUE)
  setwd(out_dir)
  zip::zip(zipfile = zip_path, files = entries)
  zip_path
}

.monitoreo_publication_evidence_pack <- function(sid,
                                                 s,
                                                 snapshot,
                                                 parsed = list(),
                                                 audience = NULL,
                                                 spreadsheet_id = "") {
  started <- Sys.time()
  bundle <- .monitoreo_publication_preflight_bundle(
    sid,
    s,
    snapshot,
    parsed,
    audience = audience,
    spreadsheet_id = spreadsheet_id
  )
  project_slug <- .monitoreo_publication_evidence_slug(bundle$preflight$project, "monitoreo")
  audience_slug <- .monitoreo_publication_evidence_slug(bundle$audience, "client")
  cut_slug <- .monitoreo_publication_evidence_slug(bundle$preflight$cut, format(Sys.Date(), "%Y-%m-%d"))
  out_dir <- file.path("tmp", "qa", "monitoreo-deliverables", paste(project_slug, audience_slug, cut_slug, sep = "-"))
  if (dir.exists(out_dir)) unlink(out_dir, recursive = TRUE, force = TRUE)

  xlsx_started <- Sys.time()
  xlsx_name <- paste(project_slug, audience_slug, "publication.xlsx", sep = "-")
  xlsx_path <- .session_tmp(sid, sprintf("%s_%s", uuid::UUIDgenerate(), xlsx_name))
  monitoreo_publication_workbook(
    snapshot$data,
    bundle$cfg,
    path = xlsx_path,
    audience = bundle$audience,
    include_targets = bundle$include_targets,
    context = list(
      session_id = sid,
      spreadsheet_id = spreadsheet_id,
      spreadsheet_url = if (nzchar(spreadsheet_id)) paste0("https://docs.google.com/spreadsheets/d/", spreadsheet_id, "/edit") else "",
      family = bundle$publication_family
    ),
    dashboard = bundle$dashboard,
    synced_at = snapshot$synced_at %||% "",
    sheets = bundle$tabs
  )
  xlsx_elapsed <- as.numeric(difftime(Sys.time(), xlsx_started, units = "secs"))

  format_validation <- parsed$format_validation %||% parsed$formatValidation %||% list()
  format_validation$schema <- "monitoreo_publication_format_validation_v1"
  format_validation$ok <- isTRUE(format_validation$ok %||% TRUE)
  format_validation$evidence <- TRUE
  format_validation$workbook <- "generated.xlsx"
  format_validation$workbook_exists <- file.exists(xlsx_path)
  format_validation$tabs <- as.list(names(bundle$tabs))
  format_validation$n_tabs <- as.integer(length(bundle$tabs))
  data_validation <- parsed$data_validation %||% parsed$dataValidation %||% list()
  data_validation$schema <- "monitoreo_publication_data_validation_v1"
  data_validation$ok <- !identical(bundle$preflight$status, "blocked")
  data_validation$preflight_status <- bundle$preflight$status
  data_validation$preflight_score <- bundle$preflight$score
  data_validation$audience <- bundle$audience
  data_validation$family <- bundle$publication_family
  data_validation$rows <- as.integer(nrow(snapshot$data))
  data_validation$blocking_issues <- bundle$preflight$blocking_issues %||% list()
  data_validation$warnings <- bundle$preflight$warnings %||% list()
  total_elapsed <- as.numeric(difftime(Sys.time(), started, units = "secs"))
  raw_performance <- parsed$performance %||% parsed$performance_items %||% list()
  performance_items <- if (is.list(raw_performance) && is.list(raw_performance$items)) raw_performance$items else raw_performance
  if (!is.list(performance_items)) performance_items <- list()
  performance <- list(
    schema = "monitoreo_publication_evidence_performance_v1",
    generated_at = .monitoreo_now_iso(),
    items = c(
      performance_items,
      list(
        list(name = "publication_evidence_workbook", elapsed_sec = round(xlsx_elapsed, 3L), threshold_sec = 30),
        list(name = "publication_evidence_pack", elapsed_sec = round(total_elapsed, 3L), threshold_sec = 60)
      )
    )
  )

  pack <- monitoreo_deliverables_evidence_pack(
    out_dir = out_dir,
    preflight = bundle$preflight,
    generated_xlsx = xlsx_path,
    generated_pdf = parsed$generated_pdf %||% parsed$generatedPdf %||% parsed$pdf_path %||% parsed$pdfPath %||% NULL,
    format_validation = format_validation,
    data_validation = data_validation,
    reference_validation = parsed$reference_validation %||% parsed$referenceValidation %||% NULL,
    cut_snapshot = parsed$cut_snapshot %||% parsed$cutSnapshot %||% NULL,
    operational_package_status = parsed$operational_package_status %||% parsed$operationalPackageStatus %||% NULL,
    publication_decision = parsed$publication_decision %||% parsed$publicationDecision %||% NULL,
    performance = performance
  )

  pack_file_specs <- list(
    operational_package_request_csv = list(
      path = pack$operational_package_request_csv,
      kind = "monitoreo_publication_operational_package_request_csv",
      filename = paste(project_slug, audience_slug, "operational-package-request.csv", sep = "-")
    ),
    operational_package_request = list(
      path = pack$operational_package_request,
      kind = "monitoreo_publication_operational_package_request_json",
      filename = paste(project_slug, audience_slug, "operational-package-request.json", sep = "-")
    ),
    operational_package_status = list(
      path = pack$operational_package_status,
      kind = "monitoreo_publication_operational_package_status",
      filename = paste(project_slug, audience_slug, "operational-package-status.json", sep = "-")
    ),
    publication_decision = list(
      path = pack$publication_decision,
      kind = "monitoreo_publication_decision",
      filename = paste(project_slug, audience_slug, "publication-decision.json", sep = "-")
    )
  )
  pack_files <- lapply(pack_file_specs, function(spec) {
    path <- .monitoreo_scalar(spec$path, "")
    if (!nzchar(path) || !file.exists(path)) return(NULL)
    file_meta <- .register_output_file(sid, spec$kind, path, original_name = spec$filename)
    list(file_id = file_meta$file_id, filename = file_meta$original_name, size = file_meta$size)
  })
  pack_files <- pack_files[!vapply(pack_files, is.null, logical(1))]

  zip_filename <- paste(project_slug, audience_slug, "evidence-pack", cut_slug, sep = "-")
  zip_filename <- paste0(zip_filename, ".zip")
  zip_path <- .session_tmp(sid, sprintf("%s_%s", uuid::UUIDgenerate(), zip_filename))
  .monitoreo_publication_evidence_zip_dir(pack$out_dir, zip_path)
  meta <- .register_output_file(sid, "monitoreo_publication_evidence_pack", zip_path, original_name = zip_filename)
  list(
    ok = TRUE,
    audience = bundle$audience,
    family = bundle$publication_family,
    report_scope = bundle$report_scope,
    tabs = names(bundle$tabs),
    preflight = bundle$preflight,
    evidence_pack = pack,
    files = pack_files,
    zip = list(file_id = meta$file_id, filename = meta$original_name, size = meta$size),
    file_id = meta$file_id,
    filename = meta$original_name,
    size = meta$size
  )
}

.monitoreo_territorial_package_rows_from_file <- function(sid, file_id) {
  file_id <- .monitoreo_scalar(file_id, "")
  if (!nzchar(file_id)) return(data.frame())
  meta <- get_file(sid, file_id)
  ext <- tolower(.monitoreo_scalar(meta$ext %||% tools::file_ext(meta$original_name %||% meta$path), ""))
  if (identical(ext, "csv")) {
    return(utils::read.csv(meta$path, stringsAsFactors = FALSE, fileEncoding = "UTF-8"))
  }
  if (ext %in% c("xlsx", "xls")) {
    if (!requireNamespace("openxlsx", quietly = TRUE)) {
      stop_api(500, "E_TERRITORIAL_PACKAGE_XLSX_READER", "El paquete XLSX requiere el paquete R 'openxlsx'.")
    }
    return(openxlsx::read.xlsx(meta$path, sheet = 1))
  }
  stop_api(
    400,
    "E_TERRITORIAL_PACKAGE_FILE_TYPE",
    "El paquete operacional debe ser CSV o XLSX."
  )
}

.monitoreo_territorial_package_rows_from_payload <- function(sid, parsed = list()) {
  if (!is.list(parsed)) parsed <- list()
  rows <- parsed[["package_rows"]] %||% parsed[["packageRows"]] %||% parsed[["rows"]] %||% parsed[["package"]]
  if (!is.null(rows)) return(.monitoreo_workbook_df(rows))
  file_id <- parsed[["package_file_id"]] %||% parsed[["packageFileId"]] %||% parsed[["file_id"]] %||% parsed[["fileId"]]
  .monitoreo_territorial_package_rows_from_file(sid, file_id)
}

.monitoreo_territorial_drift_from_payload <- function(parsed = list(),
                                                      out_dir = file.path("tmp", "qa", "monitoreo-deliverables"),
                                                      source = "",
                                                      cut = "",
                                                      project = "") {
  if (!is.list(parsed)) parsed <- list()
  drift <- parsed[["drift"]] %||% parsed[["reference_drift"]] %||% parsed[["referenceDrift"]]
  if (is.list(drift) && length(drift)) return(drift)

  expected_umps <- parsed[["expected_umps"]] %||% parsed[["expectedUmps"]]
  metrics <- parsed[["metrics"]] %||% parsed[["reference_metrics"]] %||% parsed[["referenceMetrics"]]
  if (!is.null(expected_umps) || !is.null(metrics)) {
    return(monitoreo_deliverables_territorial_drift_report(
      expected_umps = .monitoreo_workbook_df(expected_umps %||% data.frame()),
      metrics = .monitoreo_workbook_df(metrics %||% data.frame()),
      out_dir = out_dir,
      source = source,
      cut = cut,
      project = project
    ))
  }

  drift_rows <- parsed[["drift_rows"]] %||% parsed[["driftRows"]]
  drift_file_id <- parsed[["drift_file_id"]] %||% parsed[["driftFileId"]]
  if (!is.null(drift_rows) || !is.null(drift_file_id)) {
    rows <- if (!is.null(drift_rows)) {
      .monitoreo_workbook_df(drift_rows)
    } else {
      .monitoreo_territorial_package_rows_from_file(parsed$sid %||% "", drift_file_id)
    }
    return(list(
      schema = "monitoreo_deliverables_territorial_drift_report_v1",
      generated_at = .monitoreo_now_iso(),
      status = .monitoreo_scalar(parsed$drift_status %||% parsed$driftStatus, "blocked"),
      blocks_publication = .monitoreo_bool(parsed$blocks_publication %||% parsed$blocksPublication, TRUE),
      rows = .monitoreo_df_records(rows),
      required_operational_package = parsed[["required_operational_package"]] %||%
        parsed[["requiredOperationalPackage"]] %||%
        list(tachas = .monitoreo_int(parsed[["required_tachas"]] %||% parsed[["requiredTachas"]], 0L))
    ))
  }

  stop_api(
    400,
    "E_TERRITORIAL_PACKAGE_DRIFT_REQUIRED",
    "Adjunta el drift report, sus filas, o expected_umps/metrics antes de revisar el paquete operacional."
  )
}

.monitoreo_territorial_operational_package_review_payload <- function(sid,
                                                                      parsed = list(),
                                                                      s = NULL) {
  if (!is.list(parsed)) parsed <- list()
  s <- s %||% session_get(sid)
  raw_cfg <- parsed$config %||% s$monitoreo_config %||% list()
  snapshot <- s$monitoreo_snapshot %||% NULL
  data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  cfg <- monitoreo_normalize_config(raw_cfg, data)
  source <- .monitoreo_scalar(parsed$source %||% parsed$fuente %||% "Referencia validada territorial", "")
  cut <- .monitoreo_scalar(parsed$cut %||% parsed$corte %||% snapshot$synced_at %||% snapshot$generated_at, "")
  project <- .monitoreo_publication_project_label(parsed, s, cfg)
  out_dir <- parsed$out_dir %||% parsed$outDir %||% file.path(
    "tmp",
    "qa",
    "monitoreo-deliverables",
    paste(
      .monitoreo_publication_evidence_slug(project, "territorial"),
      "operational-package-review",
      .monitoreo_publication_evidence_slug(cut, format(Sys.Date(), "%Y-%m-%d")),
      sep = "-"
    )
  )
  out_dir <- normalizePath(out_dir, mustWork = FALSE)
  drift_payload <- parsed
  drift_payload$sid <- sid
  drift <- .monitoreo_territorial_drift_from_payload(
    drift_payload,
    out_dir = out_dir,
    source = source,
    cut = cut,
    project = project
  )
  package_rows <- .monitoreo_territorial_package_rows_from_payload(sid, parsed)
  review <- monitoreo_deliverables_territorial_operational_package_review(
    package_rows = package_rows,
    drift = drift,
    out_dir = out_dir,
    source = source,
    cut = cut,
    project = project,
    reference_audit_probe = parsed$reference_audit_probe %||%
      parsed$referenceAuditProbe %||%
      parsed$audit_probe %||%
      parsed$auditProbe %||%
      NULL
  )
  template_name <- paste0(.monitoreo_publication_evidence_slug(project, "territorial"), "-operational-package-template.csv")
  review_name <- paste0(.monitoreo_publication_evidence_slug(project, "territorial"), "-operational-package-review.csv")
  json_name <- paste0(.monitoreo_publication_evidence_slug(project, "territorial"), "-operational-package-review.json")
  md_name <- paste0(.monitoreo_publication_evidence_slug(project, "territorial"), "-operational-package-review.md")
  template_meta <- .register_output_file(sid, "monitoreo_territorial_operational_package_template", review$template_csv, original_name = template_name)
  review_meta <- .register_output_file(sid, "monitoreo_territorial_operational_package_review_csv", review$review_csv, original_name = review_name)
  json_meta <- .register_output_file(sid, "monitoreo_territorial_operational_package_review_json", review$json, original_name = json_name)
  md_meta <- .register_output_file(sid, "monitoreo_territorial_operational_package_review_md", review$markdown, original_name = md_name)
  files <- list(
    template = list(file_id = template_meta$file_id, filename = template_meta$original_name, size = template_meta$size),
    review_csv = list(file_id = review_meta$file_id, filename = review_meta$original_name, size = review_meta$size),
    report_json = list(file_id = json_meta$file_id, filename = json_meta$original_name, size = json_meta$size),
    report_md = list(file_id = md_meta$file_id, filename = md_meta$original_name, size = md_meta$size)
  )
  list(
    ok = TRUE,
    review = review,
    files = files,
    status = review$status,
    publication_gate = review$publication_gate,
    blocks_publication = review$blocks_publication,
    apply_ready = review$apply_ready,
    requires_revalidation = review$requires_revalidation,
    publication_ready = review$publication_ready,
    safe_to_apply = review$safe_to_apply,
    would_mutate_pulso = FALSE
  )
}

.monitoreo_processing_handoff_universe <- function(value = "processable") {
  universe <- .monitoreo_safe_name(.monitoreo_scalar(value, "processable"))
  if (universe %in% c("strict", "strict_validada", "validada", "validas", "solo_validada")) {
    return("strict_validada")
  }
  "processable"
}

.monitoreo_processing_handoff_statuses <- function(universe = "processable") {
  if (identical(.monitoreo_processing_handoff_universe(universe), "strict_validada")) "validada" else c("validada", "revision")
}

.monitoreo_processing_handoff_plain_df <- function(df) {
  df <- as.data.frame(df %||% data.frame(), stringsAsFactors = FALSE, check.names = FALSE)
  if (!ncol(df)) return(df)
  for (nm in names(df)) {
    value <- df[[nm]]
    if (is.list(value) && !is.data.frame(value)) {
      df[[nm]] <- vapply(value, function(item) {
        if (is.null(item) || length(item) == 0L) return("")
        if (is.atomic(item) && length(item) == 1L) return(as.character(item))
        jsonlite::toJSON(item, auto_unbox = TRUE, null = "null")
      }, character(1))
    } else if (inherits(value, c("POSIXct", "POSIXt", "Date"))) {
      df[[nm]] <- as.character(value)
    }
  }
  df
}

.monitoreo_processing_handoff_write_xlsx <- function(data, audit, manifest_rows, path) {
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "datos")
  openxlsx::writeData(wb, "datos", .monitoreo_processing_handoff_plain_df(data))
  openxlsx::freezePane(wb, "datos", firstActiveRow = 2)
  if (ncol(data)) openxlsx::setColWidths(wb, "datos", cols = seq_len(ncol(data)), widths = "auto")

  openxlsx::addWorksheet(wb, "audit_prosecnur")
  openxlsx::writeData(wb, "audit_prosecnur", .monitoreo_processing_handoff_plain_df(audit))
  openxlsx::freezePane(wb, "audit_prosecnur", firstActiveRow = 2)
  if (ncol(audit)) openxlsx::setColWidths(wb, "audit_prosecnur", cols = seq_len(ncol(audit)), widths = "auto")

  openxlsx::addWorksheet(wb, "manifest")
  openxlsx::writeData(wb, "manifest", manifest_rows)
  openxlsx::freezePane(wb, "manifest", firstActiveRow = 2)
  openxlsx::setColWidths(wb, "manifest", cols = seq_len(ncol(manifest_rows)), widths = "auto")
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
}

.monitoreo_processing_handoff_write_xlsform_state <- function(workbook, path) {
  if (!is.list(workbook) || is.null(workbook$survey)) return(FALSE)
  survey <- .xlsform_editor_payload_to_df(workbook$survey, "survey")
  choices <- .xlsform_editor_payload_to_df(workbook$choices, "choices")
  settings <- .xlsform_editor_payload_to_df(workbook$settings, "settings")
  paper <- if (!is.null(workbook$paper)) .xlsform_editor_payload_to_df(workbook$paper, "paper") else NULL
  diagnostico <- if (!is.null(workbook$diagnostico)) .xlsform_editor_payload_to_df(workbook$diagnostico, "diagnostico") else NULL

  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", survey)
  openxlsx::freezePane(wb, "survey", firstActiveRow = 2)
  if (ncol(survey)) openxlsx::setColWidths(wb, "survey", cols = seq_len(ncol(survey)), widths = "auto")

  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", choices)
  openxlsx::freezePane(wb, "choices", firstActiveRow = 2)
  if (ncol(choices)) openxlsx::setColWidths(wb, "choices", cols = seq_len(ncol(choices)), widths = "auto")

  openxlsx::addWorksheet(wb, "settings")
  openxlsx::writeData(wb, "settings", settings)
  openxlsx::freezePane(wb, "settings", firstActiveRow = 2)
  if (ncol(settings)) openxlsx::setColWidths(wb, "settings", cols = seq_len(ncol(settings)), widths = "auto")

  if (!is.null(paper) && (ncol(paper) > 0L || nrow(paper) > 0L)) {
    openxlsx::addWorksheet(wb, "paper")
    openxlsx::writeData(wb, "paper", paper)
    openxlsx::freezePane(wb, "paper", firstActiveRow = 2)
    if (ncol(paper)) openxlsx::setColWidths(wb, "paper", cols = seq_len(ncol(paper)), widths = "auto")
  }
  if (!is.null(diagnostico) && (ncol(diagnostico) > 0L || nrow(diagnostico) > 0L)) {
    openxlsx::addWorksheet(wb, "diagnostico")
    openxlsx::writeData(wb, "diagnostico", diagnostico)
    openxlsx::freezePane(wb, "diagnostico", firstActiveRow = 2)
    if (ncol(diagnostico)) openxlsx::setColWidths(wb, "diagnostico", cols = seq_len(ncol(diagnostico)), widths = "auto")
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  TRUE
}

.monitoreo_processing_handoff_xlsform_score <- function(path, data = NULL) {
  if (!file.exists(path)) {
    return(list(ok = FALSE, status = "missing_file", matched = 0L, missing = Inf, extra = 0L, message = "Archivo no existe."))
  }
  if (!is.data.frame(data) || !nrow(data)) {
    return(list(ok = TRUE, status = "unchecked", matched = 0L, missing = 0L, extra = 0L, message = "Sin data para contrastar."))
  }
  inst <- tryCatch(leer_instrumento_xlsform(path), error = function(e) e)
  if (inherits(inst, "error")) {
    return(list(ok = FALSE, status = "read_error", matched = 0L, missing = Inf, extra = 0L, message = conditionMessage(inst)))
  }
  compat <- tryCatch(validate_data_xlsform_compatibility(data, inst), error = function(e) e)
  if (inherits(compat, "error")) {
    return(list(ok = FALSE, status = "compat_error", matched = 0L, missing = Inf, extra = 0L, message = conditionMessage(compat)))
  }
  list(
    ok = isTRUE(compat$ok),
    status = .monitoreo_scalar(compat$status, ""),
    matched = as.integer(compat$matched_columns %||% 0L),
    missing = length(compat$missing_columns %||% character(0)),
    extra = length(compat$extra_columns %||% character(0)),
    message = .monitoreo_scalar(compat$message, "")
  )
}

.monitoreo_processing_handoff_complete_expected_columns <- function(data, instrumento) {
  data <- as.data.frame(data %||% data.frame(), stringsAsFactors = FALSE, check.names = FALSE)
  expected <- .carga_data_survey_names(instrumento)
  missing <- setdiff(expected, names(data))
  if (length(missing)) {
    for (nm in missing) data[[nm]] <- NA_character_
  }
  data
}

.monitoreo_processing_handoff_kobo_detail <- function(sid, s, cfg = NULL) {
  cfg <- cfg %||% s$monitoreo_config %||% list()
  tcfg <- cfg$territorial %||% list()
  phase <- .monitoreo_territorial_phase(tcfg$active_route_phase, "field")
  phase_source <- tcfg$phase_sources[[phase]] %||% list()
  asset_uid <- .monitoreo_scalar(phase_source$asset_uid %||% tcfg$asset_uid, "")
  if (!nzchar(asset_uid)) return(NULL)

  cached_details <- s$monitoreo_kobo_asset_details %||% list()
  cached <- cached_details[[phase]] %||% cached_details[[asset_uid]] %||% NULL
  if (is.list(cached) && length(cached$content$survey %||% list())) {
    cached_uid <- .monitoreo_scalar(cached$uid %||% cached$asset_uid, asset_uid)
    if (!nzchar(cached_uid) || identical(cached_uid, asset_uid)) {
      return(list(detail = cached, source = "kobo_api_cache", asset_uid = asset_uid, phase = phase))
    }
  }

  profile_id <- phase_source$connection_profile_id %||% tcfg$connection_profile_id %||% NULL
  base_url <- .monitoreo_scalar(phase_source$base_url %||% tcfg$base_url, "")
  if (!nzchar(base_url)) base_url <- .connections_profile_base_url("kobo", profile_id)
  if (!nzchar(base_url)) base_url <- kobo_api_default_base_url()
  token <- .connections_token_require("kobo", sid, profile_id = profile_id, base_url = base_url)
  detail <- .monitoreo_kobo_asset_detail(asset_uid, token, base_url)
  if (!is.list(detail) || !length(detail$content$survey %||% list())) return(NULL)
  list(
    detail = detail,
    source = "kobo_api",
    asset_uid = asset_uid,
    phase = phase,
    base_url = .kobo_api_trim_base_url(base_url)
  )
}

.monitoreo_processing_handoff_write_kobo_detail_xlsform <- function(detail, path) {
  if (!is.list(detail) || !length(detail$content$survey %||% list())) return(FALSE)
  xls_model <- .carga_kobo_xlsform_model(detail)
  if (is.null(xls_model$survey) || !nrow(xls_model$survey)) return(FALSE)
  .carga_write_xlsform_model(xls_model, path)
  TRUE
}

.monitoreo_processing_handoff_xlsform <- function(sid, s, out_path, data = NULL, cfg = NULL) {
  candidates <- list()
  add_candidate <- function(path, source, filename = basename(path), priority = 100L, exact = TRUE) {
    if (!nzchar(.monitoreo_scalar(path, "")) || !file.exists(path)) return(invisible(NULL))
    candidates[[length(candidates) + 1L]] <<- list(
      path = path,
      source = source,
      filename = filename,
      priority = as.integer(priority),
      exact = isTRUE(exact)
    )
    invisible(NULL)
  }

  base <- NULL
  active_base <- tryCatch(estudio_active_base(sid), error = function(e) "")
  if (nzchar(.monitoreo_scalar(active_base, ""))) {
    base <- s$estudio$bases[[active_base]] %||% NULL
  }
  if (is.null(base) && length(s$estudio$bases %||% list())) {
    base <- (s$estudio$bases %||% list())[[1]]
  }
  xlsform_id <- .monitoreo_scalar(base$xlsform_file_id %||% base$original_xlsform_file_id, "")
  if (nzchar(xlsform_id) && !is.null(s$files[[xlsform_id]]) && file.exists(s$files[[xlsform_id]]$path)) {
    add_candidate(s$files[[xlsform_id]]$path, "estudio", s$files[[xlsform_id]]$original_name %||% basename(out_path), 10L)
  }

  kobo_detail <- tryCatch(.monitoreo_processing_handoff_kobo_detail(sid, s, cfg), error = function(e) {
    attr(e, "prosecnur_handoff_source") <- "kobo_api"
    e
  })
  if (inherits(kobo_detail, "error")) {
    kobo_detail_error <- conditionMessage(kobo_detail)
  } else {
    kobo_detail_error <- ""
    if (is.list(kobo_detail)) {
      kobo_path <- tempfile("monitoreo_handoff_kobo_exact_", fileext = ".xlsx")
      if (.monitoreo_processing_handoff_write_kobo_detail_xlsform(kobo_detail$detail, kobo_path)) {
        add_candidate(kobo_path, kobo_detail$source %||% "kobo_api", basename(out_path), 5L)
      }
    }
  }

  file_candidates <- Filter(function(meta) {
    identical(.monitoreo_scalar(meta$kind, ""), "xlsform") && file.exists(meta$path)
  }, s$files %||% list())
  if (length(file_candidates)) {
    for (meta in file_candidates) {
      add_candidate(meta$path, "file_store", meta$original_name %||% basename(out_path), 40L)
    }
  }

  if (length(candidates)) {
    exact_candidates <- Filter(function(item) isTRUE(item$exact), candidates)
    if (!length(exact_candidates)) {
      stop_api(
        409,
        "E_MONITOREO_PROCESSING_HANDOFF_XLSFORM_EXACT",
        "No hay XLSForm exacto para Procesamiento. Conecta Kobo para descargar el instrumento original o carga el XLSForm exacto antes de exportar."
      )
    }
    scored <- lapply(seq_along(exact_candidates), function(i) {
      score <- .monitoreo_processing_handoff_xlsform_score(exact_candidates[[i]]$path, data)
      c(exact_candidates[[i]], score = list(score))
    })
    ok <- vapply(scored, function(item) isTRUE(item$score$ok), logical(1))
    if (any(ok)) {
      ok_idx <- which(ok)
      matched <- vapply(scored[ok_idx], function(item) as.integer(item$score$matched %||% 0L), integer(1))
      priority <- vapply(scored[ok_idx], function(item) as.integer(item$priority %||% 100L), integer(1))
      best <- scored[[ok_idx[order(-matched, priority)[1]]]]
      file.copy(best$path, out_path, overwrite = TRUE)
      return(list(
        path = out_path,
        source = best$source,
        filename = best$filename %||% basename(out_path),
        compatibility = best$score
      ))
    }
    best <- scored[[order(
      vapply(scored, function(item) as.numeric(item$score$missing %||% Inf), numeric(1)),
      -vapply(scored, function(item) as.integer(item$score$matched %||% 0L), integer(1))
    )[1]]]
    stop_api(
      409,
      "E_MONITOREO_PROCESSING_HANDOFF_XLSFORM_INCOMPATIBLE",
      sprintf(
        "No se encontro un XLSForm compatible con la data procesable. Mejor candidato: %s (%s).",
        .monitoreo_scalar(best$source, "desconocido"),
        .monitoreo_scalar(best$score$message, "incompatible")
      )
    )
  }

  stop_api(
    409,
    "E_MONITOREO_PROCESSING_HANDOFF_XLSFORM",
    paste(
      "No se encontro un XLSForm exacto para empaquetar.",
      "Conecta Kobo para descargar el instrumento original o carga el XLSForm exacto antes de generar el paquete.",
      if (nzchar(kobo_detail_error %||% "")) paste("Detalle Kobo:", kobo_detail_error) else ""
    )
  )
}

.monitoreo_processing_handoff_prepare <- function(sid, parsed = list()) {
  if (!is.list(parsed)) parsed <- list()
  s <- session_get(sid)
  snapshot <- s$monitoreo_snapshot %||% NULL
  if (is.null(snapshot) || !is.data.frame(snapshot$data) || !nrow(snapshot$data)) {
    stop_api(409, "E_NO_MONITOREO_DATA", "Sincroniza datos antes de exportar el paquete para Procesamiento.")
  }
  cfg <- monitoreo_normalize_config(parsed$config %||% s$monitoreo_config %||% list(), snapshot$data)
  family <- .monitoreo_scalar(cfg$monitoreo_profile$family, "")
  if (!identical(family, "territorial")) {
    stop_api(400, "E_MONITOREO_PROCESSING_HANDOFF_FAMILY", "El paquete manual para Procesamiento esta disponible para Monitoreo territorial.")
  }
  universe <- .monitoreo_processing_handoff_universe(parsed$universe %||% parsed$universo)
  statuses <- .monitoreo_processing_handoff_statuses(universe)
  dashboard <- .monitoreo_dashboard_for_session(
    sid,
    snapshot$data,
    cfg,
    include_reports = TRUE,
    report_scope = "validation_summary"
  )
  reports <- dashboard$territorial_reports %||% list()
  audit <- .monitoreo_territorial_rows_df(reports$response_audit %||% list())
  if (!nrow(audit)) {
    stop_api(409, "E_MONITOREO_PROCESSING_HANDOFF_AUDIT", "No hay auditoria territorial vigente para seleccionar casos procesables.")
  }
  status <- tolower(trimws(as.character(audit$validation_status %||% "")))
  keep <- status %in% statuses
  audit_keep <- audit[keep, , drop = FALSE]
  if (!nrow(audit_keep)) {
    stop_api(409, "E_MONITOREO_PROCESSING_HANDOFF_EMPTY", "No hay casos procesables con el universo seleccionado.")
  }
  audit_keys <- .monitoreo_territorial_response_candidate_keys(audit_keep)
  response_ids <- unique(as.vector(audit_keys))
  response_ids <- response_ids[nzchar(response_ids)]
  if (!length(response_ids)) {
    stop_api(409, "E_MONITOREO_PROCESSING_HANDOFF_IDS", "La auditoria territorial no tiene UUID/ID de respuesta para emparejar la data cruda.")
  }
  data_keys <- .monitoreo_territorial_response_candidate_keys(snapshot$data)
  if (!length(data_keys)) {
    stop_api(409, "E_MONITOREO_PROCESSING_HANDOFF_RAW_IDS", "La data cruda no tiene UUID/ID de respuesta para preparar el paquete.")
  }
  data_keep <- apply(data_keys, 1, function(row) any(row %in% response_ids))
  data_out <- snapshot$data[data_keep, , drop = FALSE]
  if (!nrow(data_out)) {
    stop_api(409, "E_MONITOREO_PROCESSING_HANDOFF_RAW_EMPTY", "No se encontraron filas crudas para los casos procesables.")
  }

  audit_cols <- intersect(c(
    "response_id", "validation_status", "issues", "responsible_display", "pulso_code",
    "distrito", "advance_block_ump", "advance_block_manzana", "submission_date_iso",
    "source_effective", "production_annulled", "production_annulment_status"
  ), names(audit_keep))
  audit_export <- audit_keep[, audit_cols, drop = FALSE]
  counts <- list(
    raw_rows = as.integer(nrow(snapshot$data)),
    audit_rows = as.integer(nrow(audit)),
    exported_rows = as.integer(nrow(data_out)),
    selected_audit_rows = as.integer(nrow(audit_keep)),
    validada = as.integer(sum(status == "validada", na.rm = TRUE)),
    revision = as.integer(sum(status == "revision", na.rm = TRUE)),
    no_defendible = as.integer(sum(status == "no_defendible", na.rm = TRUE)),
    missing_raw_matches = as.integer(max(0L, nrow(audit_keep) - nrow(data_out))),
    active_annulments = as.integer(reports$production_annulments$summary$active %||% 0L),
    annulled_responses = as.integer(reports$production_annulments$summary$annulled_responses %||% 0L)
  )

  dir.create(file.path(s$dir, "downloads"), showWarnings = FALSE, recursive = TRUE)
  project <- .monitoreo_publication_project_label(parsed, s, cfg)
  project_slug <- .monitoreo_publication_evidence_slug(project, "monitoreo")
  cut_slug <- .monitoreo_publication_evidence_slug(snapshot$synced_at %||% snapshot$generated_at %||% format(Sys.Date(), "%Y-%m-%d"))
  universe_slug <- if (identical(universe, "strict_validada")) "validada" else "procesable"
  stage_dir <- file.path(s$dir, "downloads", paste(project_slug, "processing-handoff", universe_slug, uuid::UUIDgenerate(), sep = "-"))
  dir.create(stage_dir, recursive = TRUE, showWarnings = FALSE)

  data_xlsx_name <- paste(project_slug, universe_slug, "data-procesamiento.xlsx", sep = "-")
  data_csv_name <- paste(project_slug, universe_slug, "data-procesamiento.csv", sep = "-")
  audit_csv_name <- paste(project_slug, universe_slug, "audit-prosecnur.csv", sep = "-")
  xlsform_name <- paste(project_slug, "xlsform.xlsx", sep = "-")
  manifest_name <- "manifest.json"
  readme_name <- "README.md"
  data_xlsx_path <- file.path(stage_dir, data_xlsx_name)
  data_csv_path <- file.path(stage_dir, data_csv_name)
  audit_csv_path <- file.path(stage_dir, audit_csv_name)
  xlsform_path <- file.path(stage_dir, xlsform_name)
  manifest_path <- file.path(stage_dir, manifest_name)
  readme_path <- file.path(stage_dir, readme_name)

  manifest_rows <- data.frame(
    campo = c("proyecto", "universo", "estatus_incluidos", "filas_exportadas", "filas_auditoria_seleccionadas", "tachas_activas", "respuestas_tachadas_excluidas", "corte"),
    valor = c(project, universe, paste(statuses, collapse = " + "), counts$exported_rows, counts$selected_audit_rows, counts$active_annulments, counts$annulled_responses, snapshot$synced_at %||% ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  xlsform_meta <- .monitoreo_processing_handoff_xlsform(sid, s, xlsform_path, cfg = cfg)
  handoff_inst <- tryCatch(leer_instrumento_xlsform(xlsform_path), error = function(e) NULL)
  if (!is.null(handoff_inst)) {
    data_out <- .carga_align_kobo_data(data_out, handoff_inst)
    data_out <- .monitoreo_processing_handoff_complete_expected_columns(data_out, handoff_inst)
    data_out <- .carga_reorder_data_columns(data_out, handoff_inst)
    compatibility <- .monitoreo_processing_handoff_xlsform_score(xlsform_path, data_out)
    if (!isTRUE(compatibility$ok)) {
      stop_api(
        409,
        "E_MONITOREO_PROCESSING_HANDOFF_XLSFORM_INCOMPATIBLE",
        sprintf(
          "El XLSForm exacto no calza con la data procesable despues de alinear columnas: %s",
          .monitoreo_scalar(compatibility$message, "incompatible")
        )
      )
    }
    xlsform_meta$compatibility <- compatibility
  }
  list(
    s = s, cfg = cfg, family = family, snapshot = snapshot,
    universe = universe, statuses = statuses,
    audit = audit, audit_keep = audit_keep, audit_export = audit_export,
    data_out = data_out, counts = counts,
    project = project, project_slug = project_slug, cut_slug = cut_slug, universe_slug = universe_slug,
    stage_dir = stage_dir,
    data_xlsx_name = data_xlsx_name, data_csv_name = data_csv_name, audit_csv_name = audit_csv_name,
    xlsform_name = xlsform_name, manifest_name = manifest_name, readme_name = readme_name,
    data_xlsx_path = data_xlsx_path, data_csv_path = data_csv_path, audit_csv_path = audit_csv_path,
    xlsform_path = xlsform_path, manifest_path = manifest_path, readme_path = readme_path,
    manifest_rows = manifest_rows, xlsform_meta = xlsform_meta
  )
}

.monitoreo_processing_handoff_export <- function(sid, parsed = list()) {
  prep <- .monitoreo_processing_handoff_prepare(sid, parsed)
  s <- prep$s; cfg <- prep$cfg; family <- prep$family; snapshot <- prep$snapshot
  universe <- prep$universe; statuses <- prep$statuses; counts <- prep$counts
  audit_export <- prep$audit_export; data_out <- prep$data_out
  project <- prep$project; project_slug <- prep$project_slug; cut_slug <- prep$cut_slug; universe_slug <- prep$universe_slug
  stage_dir <- prep$stage_dir
  data_xlsx_name <- prep$data_xlsx_name; data_csv_name <- prep$data_csv_name; audit_csv_name <- prep$audit_csv_name
  xlsform_name <- prep$xlsform_name; manifest_name <- prep$manifest_name; readme_name <- prep$readme_name
  data_xlsx_path <- prep$data_xlsx_path; data_csv_path <- prep$data_csv_path; audit_csv_path <- prep$audit_csv_path
  xlsform_path <- prep$xlsform_path; manifest_path <- prep$manifest_path; readme_path <- prep$readme_path
  manifest_rows <- prep$manifest_rows; xlsform_meta <- prep$xlsform_meta
  .monitoreo_processing_handoff_write_xlsx(data_out, audit_export, manifest_rows, data_xlsx_path)
  utils::write.csv(.monitoreo_processing_handoff_plain_df(data_out), data_csv_path, row.names = FALSE, na = "", fileEncoding = "UTF-8")
  utils::write.csv(.monitoreo_processing_handoff_plain_df(audit_export), audit_csv_path, row.names = FALSE, na = "", fileEncoding = "UTF-8")

  manifest <- list(
    schema = "monitoreo_processing_handoff_v1",
    generated_at = .monitoreo_now_iso(),
    project = project,
    family = family,
    universe = universe,
    included_statuses = as.list(statuses),
    default_for_processing = identical(universe, "processable"),
    counts = counts,
    files = list(
      data_xlsx = data_xlsx_name,
      data_csv = data_csv_name,
      audit_csv = audit_csv_name,
      xlsform = xlsform_name
    ),
    xlsform_source = xlsform_meta$source,
    notes = list(
      "La hoja 'datos' del XLSX contiene la data filtrada y alineada al XLSForm exacto para Procesamiento.",
      "El universo procesable incluye validada + revision y excluye no_defendible y tachas/anulaciones activas.",
      "El archivo no modifica el .pulso ni carga automaticamente Procesamiento."
    )
  )
  jsonlite::write_json(manifest, manifest_path, auto_unbox = TRUE, pretty = TRUE, null = "null")
  writeLines(c(
    "# Paquete manual para Procesamiento",
    "",
    "Contenido:",
    sprintf("- `%s`: XLSX principal. Cargar esta data en Prosecnur > Carga/Procesamiento.", data_xlsx_name),
    sprintf("- `%s`: la misma data en CSV.", data_csv_name),
    sprintf("- `%s`: XLSForm/instrumento para cargar junto con la data.", xlsform_name),
    sprintf("- `%s`: auditoria Prosecnur de los casos incluidos.", audit_csv_name),
    "- `manifest.json`: conteos, universo y metadatos del corte.",
    "",
    sprintf("Universo exportado: `%s` (%s).", universe, paste(statuses, collapse = " + ")),
    sprintf("Filas exportadas: %s.", counts$exported_rows),
    sprintf("Tachas/anulaciones activas excluidas: %s; respuestas tachadas excluidas: %s.", counts$active_annulments, counts$annulled_responses),
    "",
    "Uso manual sugerido:",
    "1. En la otra PC, abrir Prosecnur.",
    "2. Cargar el XLSForm de este paquete.",
    "3. Cargar el XLSX principal como data.",
    "4. Continuar el flujo de Procesamiento/Validacion/Codificacion segun corresponda."
  ), readme_path, useBytes = TRUE)

  zip_name <- paste(project_slug, universe_slug, "processing-handoff", cut_slug, sep = "-")
  zip_name <- paste0(zip_name, ".zip")
  zip_path <- file.path(s$dir, "downloads", sprintf("%s_%s", uuid::UUIDgenerate(), zip_name))
  old_wd <- getwd()
  on.exit(setwd(old_wd), add = TRUE)
  setwd(stage_dir)
  zip::zip(zipfile = zip_path, files = c(data_xlsx_name, data_csv_name, audit_csv_name, xlsform_name, manifest_name, readme_name))
  setwd(old_wd)

  data_meta <- .register_output_file(sid, "monitoreo_processing_handoff_data", data_xlsx_path, original_name = data_xlsx_name)
  xls_meta <- .register_output_file(sid, "monitoreo_processing_handoff_xlsform", xlsform_path, original_name = xlsform_name)
  zip_meta <- .register_output_file(sid, "monitoreo_processing_handoff_zip", zip_path, original_name = zip_name)
  list(
    ok = TRUE,
    schema = "monitoreo_processing_handoff_v1",
    universe = universe,
    included_statuses = as.list(statuses),
    counts = counts,
    file_id = zip_meta$file_id,
    filename = zip_meta$original_name,
    size = zip_meta$size,
    files = list(
      package = list(file_id = zip_meta$file_id, filename = zip_meta$original_name, size = zip_meta$size),
      data_xlsx = list(file_id = data_meta$file_id, filename = data_meta$original_name, size = data_meta$size),
      xlsform = list(
        file_id = xls_meta$file_id,
        filename = xls_meta$original_name,
        size = xls_meta$size,
        source = xlsform_meta$source,
        compatibility = xlsform_meta$compatibility %||% NULL
      )
    ),
    would_mutate_pulso = FALSE
  )
}

# Persiste el resultado del handoff como una base de Procesamiento del proyecto:
# XLSForm fidedigno (traido de Kobo) + BBDD filtrada al universo valido. Reusa el
# helper .monitoreo_processing_handoff_prepare y el patron canonico de creacion de
# bases (save_upload -> normalize/compat -> estudio_add_base -> active).
.monitoreo_processing_handoff_promote <- function(sid, parsed = list()) {
  if (!is.list(parsed)) parsed <- list()
  prep <- .monitoreo_processing_handoff_prepare(sid, parsed)
  cfg <- prep$cfg
  tcfg <- cfg$territorial %||% list()
  base_nombre <- .monitoreo_scalar(parsed$base_nombre %||% parsed$nombre, "Monitoreo territorial")
  if (!nzchar(base_nombre)) base_nombre <- "Monitoreo territorial"
  base_nombre <- gsub("$", "", base_nombre, fixed = TRUE)

  # 1. Escribir la BBDD filtrada a un xlsx de una sola hoja (data limpia para la base).
  stage_dir <- prep$stage_dir
  data_base_path <- file.path(stage_dir, paste(prep$project_slug, prep$universe_slug, "base-data.xlsx", sep = "-"))
  openxlsx::write.xlsx(.monitoreo_processing_handoff_plain_df(prep$data_out), data_base_path, overwrite = TRUE)

  # 2. Registrar XLSForm fidedigno + data como INPUTS canonicos en s$files (uploads/).
  inst_original <- paste(prep$project_slug, "xlsform-fidedigno.xlsx", sep = "-")
  data_original <- paste(prep$project_slug, prep$universe_slug, "data-procesamiento.xlsx", sep = "-")
  inst_meta <- save_upload(sid, "xlsform", inst_original,
                           readBin(prep$xlsform_path, "raw", n = file.info(prep$xlsform_path)$size))
  data_meta <- save_upload(sid, "data", data_original,
                           readBin(data_base_path, "raw", n = file.info(data_base_path)$size))

  # 3. Parsear instrumento + data, normalizar y validar compatibilidad (patron Carga).
  rp_inst <- reporte_instrumento(path = inst_meta$path)
  data_df <- .read_data_any_path(data_meta$path, data_meta$ext)
  data_df <- normalize_data_for_xlsform(data_df, rp_inst)
  .carga_assert_data_xlsform_compatible(data_df, rp_inst)
  rp_data <- reporte_data(data_df, instrumento = rp_inst)

  # 4. Reporte del filtro (transparencia de que entra / que sale).
  counts <- prep$counts
  filter_report <- list(
    universe = prep$universe,
    included_statuses = as.list(prep$statuses),
    validada = counts$validada,
    revision = counts$revision,
    no_defendible_excluidos = counts$no_defendible,
    filas_incluidas = counts$exported_rows,
    tachas_activas_excluidas = counts$active_annulments,
    respuestas_tachadas_excluidas = counts$annulled_responses
  )
  extra_meta <- list(
    source_kind = "monitoreo_territorial",
    response_filter = list(universe = prep$universe, statuses = as.list(prep$statuses)),
    kobo_asset_uid = .monitoreo_scalar(tcfg$asset_uid %||% prep$xlsform_meta$asset_uid, ""),
    kobo_version_id = .monitoreo_scalar(tcfg$kobo_version_id, ""),
    xlsform_source = .monitoreo_scalar(prep$xlsform_meta$source, ""),
    filter_report = filter_report,
    imported_at = .monitoreo_now_iso()
  )

  # 5. Crear o reemplazar la base persistida y marcarla activa.
  estudio_ensure(sid)
  s_now <- session_get(sid)
  exists_base <- !is.null((s_now$estudio$bases %||% list())[[base_nombre]])
  if (exists_base) {
    estudio_replace_base_files(sid, base_nombre,
                               xlsform_file_id = inst_meta$file_id,
                               data_file_id = data_meta$file_id,
                               data_ext = data_meta$ext,
                               rp_data = rp_data, rp_inst = rp_inst,
                               n_filas = nrow(data_df), n_columnas = ncol(data_df))
    estudio_update_base_metadata(sid, base_nombre, extra_meta)
  } else {
    estudio_add_base(sid, nombre = base_nombre,
                     xlsform_file_id = inst_meta$file_id,
                     data_file_id = data_meta$file_id,
                     data_ext = data_meta$ext,
                     rp_data = rp_data, rp_inst = rp_inst,
                     n_filas = nrow(data_df), n_columnas = ncol(data_df),
                     extra_meta = extra_meta)
  }
  estudio_active_base_set(sid, base_nombre)

  list(
    ok = TRUE,
    schema = "monitoreo_processing_handoff_promote_v1",
    base_nombre = base_nombre,
    universe = prep$universe,
    included_statuses = as.list(prep$statuses),
    counts = counts,
    filter_report = filter_report,
    xlsform = list(file_id = inst_meta$file_id, source = .monitoreo_scalar(prep$xlsform_meta$source, "")),
    data = list(file_id = data_meta$file_id, n_filas = nrow(data_df), n_columnas = ncol(data_df)),
    would_mutate_pulso = TRUE
  )
}

.monitoreo_public_internal_payload <- function(data, cfg, snapshot, dashboard, family, base) {
  reports <- if (identical(family, "territorial")) {
    dashboard$territorial_reports %||% list()
  } else {
    dashboard$acreditacion_reports %||% list()
  }
  base$internal <- list(
    schema = "monitoreo_internal_full_report_v1",
    family = family,
    generated_at = base$generated_at,
    synced_at = base$synced_at,
    n_rows = as.integer(nrow(data)),
    dashboard = .monitoreo_public_dashboard(dashboard, include_reports = TRUE),
    reports = reports,
    config = cfg,
    snapshot = list(
      synced_at = .monitoreo_scalar(snapshot$synced_at, ""),
      errors = snapshot$errors %||% list(),
      rows = .monitoreo_df_records(data)
    )
  )
  if (identical(family, "acreditacion")) {
    client <- reports$client_report %||% monitoreo_acreditacion_client_report_model(data, cfg)
    base$accreditation <- list(
      schema = "monitoreo_internal_accreditation_report_v1",
      title = .monitoreo_scalar(client$title, "Reporte interno de monitoreo"),
      generated_at = .monitoreo_scalar(client$generated_at, base$generated_at),
      has_targets = isTRUE(client$has_targets),
      summary = client$summary %||% list(),
      actors = client$actors %||% list(),
      daily_general = client$daily_general %||% list(),
      daily_actor = client$daily_actor %||% list(),
      sources = client$sources %||% list(),
      client_report = client,
      reports = reports,
      internal_queries = reports$internal_queries %||% list(),
      sheets = reports$sheets %||% list(),
      snapshot_rows = .monitoreo_df_records(data)
    )
  } else {
    base$territorial <- c(
      list(
        schema = "monitoreo_internal_territorial_report_v1",
        generated_at = .monitoreo_scalar(reports$generated_at, base$generated_at)
      ),
      reports,
      list(snapshot_rows = .monitoreo_df_records(data))
    )
  }
  base
}

.monitoreo_public_report_payload <- function(sid, audience = NULL) {
  s <- session_get(sid)
  embedded <- s$public_artifact_payload$monitoreo_report %||% NULL
  if (is.list(embedded)) return(embedded)
  snapshot <- s$monitoreo_snapshot %||% NULL
  sources <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
  data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  data <- .monitoreo_apply_source_metadata_to_data(data, sources)
  if (!nrow(data)) {
    stop_api(409, "E_NO_MONITOREO_DATA", "No hay un corte de monitoreo publicado.")
  }
  cfg <- monitoreo_normalize_config(s$monitoreo_config %||% snapshot$config %||% list(), data)
  profile <- cfg$monitoreo_profile %||% monitoreo_normalize_profile(list())
  publication_family <- detect_monitoreo_family(config = s$monitoreo_config %||% snapshot$config %||% list(), data = data)
  family <- .monitoreo_publication_engine_family(publication_family)
  audience <- .monitoreo_public_audience(audience %||% s$public_artifact$audience %||% "client")
  report_scope <- .monitoreo_publication_report_scope(publication_family, audience)
  dashboard <- .monitoreo_dashboard_for_session(
    sid,
    data,
    cfg,
    include_reports = TRUE,
    report_scope = report_scope
  )
  base <- list(
    ok = TRUE,
    generated_at = .monitoreo_now_iso(),
    synced_at = .monitoreo_scalar(snapshot$synced_at, ""),
    n_rows = as.integer(nrow(data)),
    audience = audience,
    profile = .monitoreo_public_profile(modifyList(profile, list(family = family)))
  )
  base$publication_model <- monitoreo_publication_model(
    data,
    cfg,
    audience = audience,
    include_targets = FALSE,
    dashboard = dashboard,
    synced_at = base$synced_at,
      context = list(session_id = sid, family = publication_family)
  )

  if (identical(audience, "internal")) {
    return(.monitoreo_public_internal_payload(data, cfg, snapshot, dashboard, family, base))
  }

  if (identical(family, "acreditacion")) {
    reports <- dashboard$acreditacion_reports %||% list()
    client <- reports$client_report %||% monitoreo_acreditacion_client_report_model(data, cfg)
    client_actor_records <- .monitoreo_public_select_records(client$actors, c(
      "Actor", "Universo", "Efectivas", "Parciales", "Rechazos plataforma",
      "Rechazo", "Sin respuesta plataforma", "Sin respuesta", "Referencia operativa",
      "Referencia etiqueta", "Avance universo", "Primer día", "Última efectiva",
      "Origen avance"
    ))
    client_actor_records <- lapply(client_actor_records, function(row) {
      row$Rechazo <- row$Rechazo %||% row$`Rechazos plataforma` %||% 0L
      row$`Rechazos plataforma` <- NULL
      row
    })
    base$generated_at <- .monitoreo_scalar(client$generated_at, base$generated_at)
    base$accreditation <- list(
      schema = "monitoreo_public_accreditation_report_v1",
      title = .monitoreo_scalar(client$title, "Reporte de avance"),
      generated_at = .monitoreo_scalar(client$generated_at, base$generated_at),
      has_targets = FALSE,
      summary = .monitoreo_public_select_records(client$summary, c("Indicador", "Valor")),
      actors = client_actor_records,
      daily_general = .monitoreo_public_select_records(client$daily_general, c(
        "Fecha", "Efectivas", "Total respuestas", "Acumulado"
      )),
      daily_actor = .monitoreo_public_select_records(client$daily_actor, c(
        "Actor", "Fecha", "Efectivas", "Total respuestas", "Acumulado"
      )),
      sources = .monitoreo_public_select_records(client$sources, c(
        "Actor", "Canal", "Fuente", "Efectivas",
        "Total respuestas", "Primer día", "Última respuesta", "Última efectiva"
      ))
    )
    return(base)
  }

  if (identical(family, "territorial")) {
    report <- dashboard$territorial_reports %||% list()
    advance <- report$advance %||% list()
    district_progress <- advance$district_progress %||% report$district_progress %||% list()
    daily <- advance$daily %||% report$daily %||% list()
    quota <- report$route_quota_progress %||% list()
    base$generated_at <- .monitoreo_scalar(report$generated_at, base$generated_at)
    base$territorial <- list(
      schema = "monitoreo_public_territorial_report_v1",
      generated_at = .monitoreo_scalar(report$generated_at, base$generated_at),
      active_route_phase = .monitoreo_scalar(report$active_route_phase, cfg$territorial$active_route_phase %||% ""),
      phase_note = .monitoreo_scalar(report$phase_note, ""),
      kpis = report$kpis %||% list(),
      advance = list(
        total_respuestas = as.integer(advance$total_respuestas %||% report$kpis$total_respuestas %||% 0L),
        validas = as.integer(advance$validas %||% report$kpis$validas %||% 0L),
        meta = advance$meta %||% report$kpis$meta %||% NA,
        avance_pct = advance$avance_pct %||% report$kpis$avance_pct %||% NA,
        brecha = advance$brecha %||% NA
      ),
      district_progress = .monitoreo_public_select_records(district_progress, c(
        "ubigeo", "distrito", "meta", "total", "validas", "avance_pct", "brecha"
      )),
      daily = .monitoreo_public_select_records(daily, c(
        "date", "date_label", "total", "validas"
      )),
      route_quota_progress = list(
        configured = isTRUE(quota$configured),
        summary = quota$summary %||% NULL,
        district_summary = quota$district_summary %||% NULL,
        districts = .monitoreo_public_select_records(quota$districts %||% list(), c(
          "ubigeo", "distrito", "configured", "status", "target", "validas", "missing_total"
        ), max_rows = 200L)
      )
    )
    return(base)
  }

  stop_api(
    409,
    "E_MONITOREO_PUBLIC_PROFILE",
    "El reporte publico de Monitoreo soporta acreditacion y territorial."
  )
}

.monitoreo_source_territorial_phase <- function(source = list()) {
  dims <- source$dimensions %||% list()
  phase <- .monitoreo_scalar(dims$territorial_phase %||% dims$route_phase %||% dims$phase, "")
  if (phase %in% c("pilot", "field")) phase else ""
}

.monitoreo_kobo_schema_for_phase <- function(sid, cfg = list(), phase = NULL) {
  s <- session_get(sid)
  phase <- .monitoreo_territorial_phase(phase %||% cfg$territorial$active_route_phase, "pilot")
  schemas <- s$monitoreo_kobo_schemas %||% list()
  schema <- schemas[[phase]] %||% NULL
  if (!is.null(schema)) return(schema)
  legacy <- s$monitoreo_kobo_schema %||% NULL
  if (is.null(legacy)) return(NULL)
  phase_src <- .monitoreo_territorial_phase_source(cfg$territorial %||% list(), phase)
  if (!nzchar(.monitoreo_scalar(phase_src$asset_uid, "")) &&
      !nzchar(.monitoreo_scalar(phase_src$source_id, ""))) {
    return(NULL)
  }
  if (nzchar(.monitoreo_scalar(phase_src$asset_uid, "")) &&
      !identical(.monitoreo_scalar(legacy$asset_uid, ""), .monitoreo_scalar(phase_src$asset_uid, ""))) {
    return(NULL)
  }
  legacy
}

.monitoreo_territorial_source <- function(sources, cfg = list(), source_id = "", phase = NULL) {
  sources <- monitoreo_normalize_sources(sources)
  sources <- Filter(function(src) !identical(.monitoreo_scalar(src$role, ""), "ocurrencias_campo"), sources)
  phase <- .monitoreo_territorial_phase(phase %||% cfg$territorial$active_route_phase, "pilot")
  phase_source <- .monitoreo_territorial_phase_source(cfg$territorial %||% list(), phase)
  source_id <- .monitoreo_scalar(source_id, "")
  if (!nzchar(source_id)) source_id <- .monitoreo_scalar(phase_source$source_id, "")
  if (nzchar(source_id)) {
    hit <- Filter(function(src) identical(.monitoreo_scalar(src$id, ""), source_id), sources)
    if (length(hit)) return(hit[[1]])
  }
  asset_uid <- .monitoreo_scalar(phase_source$asset_uid, "")
  if (nzchar(asset_uid)) {
    hit <- Filter(function(src) {
      source_phase <- .monitoreo_source_territorial_phase(src)
      identical(.monitoreo_scalar(src$asset_uid, ""), asset_uid) &&
        (!nzchar(source_phase) || identical(source_phase, phase))
    }, sources)
    if (length(hit)) return(hit[[1]])
  }
  hit <- Filter(function(src) {
    identical(.monitoreo_scalar(src$kind, ""), "kobo") &&
      identical(.monitoreo_source_territorial_phase(src), phase) &&
      isTRUE(src$enabled)
  }, sources)
  if (length(hit)) return(hit[[1]])
  hit <- Filter(function(src) {
    identical(.monitoreo_scalar(src$kind, ""), "kobo") &&
      identical(.monitoreo_source_territorial_phase(src), phase)
  }, sources)
  if (length(hit)) return(hit[[1]])
  NULL
}

.monitoreo_territorial_filter_data_for_phase <- function(data, cfg = list(), phase = NULL) {
  if (is.null(data) || !is.data.frame(data)) return(data.frame())
  phase <- .monitoreo_territorial_phase(phase %||% cfg$territorial$active_route_phase, "pilot")
  phase_source <- .monitoreo_territorial_phase_source(cfg$territorial %||% list(), phase)
  source_id <- .monitoreo_scalar(phase_source$source_id, "")
  if (!".source_id" %in% names(data)) return(data)
  source_ids <- trimws(as.character(data$.source_id %||% ""))
  source_ids[is.na(source_ids)] <- ""
  source_roles <- if (".source_role" %in% names(data)) trimws(as.character(data$.source_role %||% "")) else rep("", nrow(data))
  source_roles[is.na(source_roles)] <- ""
  source_role_keys <- vapply(source_roles, .monitoreo_safe_name, character(1))
  sheet_phase <- if ("dim_territorial_phase" %in% names(data)) trimws(as.character(data$dim_territorial_phase %||% "")) else rep("", nrow(data))
  sheet_phase[is.na(sheet_phase)] <- ""
  route_sheet_mask <- source_role_keys %in% c("hojaruta", "hoja_ruta") & (!nzchar(sheet_phase) | sheet_phase == phase)
  if (!nzchar(source_id)) return(data[route_sheet_mask, , drop = FALSE])
  phase_mask <- source_ids == source_id
  phase_data <- data[phase_mask, , drop = FALSE]
  if (!nrow(phase_data)) return(data[route_sheet_mask, , drop = FALSE])

  tcfg_raw <- cfg$territorial %||% list()
  tcfg_raw$active_route_phase <- phase
  tcfg <- monitoreo_territorial_normalize_config(tcfg_raw, phase_data)
  phase_window <- .monitoreo_territorial_phase_window(tcfg, phase)
  start_at <- .monitoreo_scalar(phase_window$start_at, "")
  if (!nzchar(start_at)) return(data[phase_mask | route_sheet_mask, , drop = FALSE])
  start_time <- suppressWarnings(.monitoreo_parse_time_vec(start_at))
  if (!length(start_time) || is.na(start_time[[1]])) return(data[phase_mask | route_sheet_mask, , drop = FALSE])

  submitted <- .monitoreo_territorial_submission_time_values(phase_data, tcfg)
  submitted_time <- suppressWarnings(.monitoreo_parse_time_vec(submitted$values))
  if (!length(submitted_time) || !any(!is.na(submitted_time))) return(data[phase_mask | route_sheet_mask, , drop = FALSE])
  keep <- is.na(submitted_time) | submitted_time >= start_time[[1]]
  phase_mask[phase_mask] <- keep %in% TRUE
  data[phase_mask | route_sheet_mask, , drop = FALSE]
}

.monitoreo_territorial_phase_label <- function(phase) {
  if (identical(.monitoreo_territorial_phase(phase, "pilot"), "field")) "Campo" else "Piloto"
}

.monitoreo_territorial_phase_coherence <- function(data,
                                                   cfg = list(),
                                                   sources = list(),
                                                   dashboard = NULL,
                                                   synced_at = "",
                                                   errors = list()) {
  if (is.null(data) || !is.data.frame(data)) data <- data.frame()
  cfg <- monitoreo_normalize_config(cfg %||% list(), data)
  sources <- monitoreo_normalize_sources(sources)
  tcfg <- cfg$territorial %||% monitoreo_territorial_default_config()
  phase_sources <- .monitoreo_territorial_normalize_phase_sources(tcfg)
  source_ids_in_snapshot <- if (nrow(data) && ".source_id" %in% names(data)) {
    unique(as.character(data$.source_id %||% character(0)))
  } else {
    character(0)
  }
  source_ids_in_snapshot <- source_ids_in_snapshot[nzchar(source_ids_in_snapshot)]
  source_by_id <- function(id) {
    if (!nzchar(id)) return(NULL)
    hit <- Filter(function(src) identical(.monitoreo_scalar(src$id, ""), id), sources)
    if (length(hit)) hit[[1]] else NULL
  }
  dashboard_reports <- dashboard$territorial_reports %||% list()
  dashboard_phase <- .monitoreo_scalar(dashboard_reports$active_route_phase, "")
  if (dashboard_phase %in% c("pilot", "field")) {
    dashboard_phase <- .monitoreo_territorial_phase(dashboard_phase, "pilot")
  } else {
    dashboard_phase <- ""
  }
  dashboard_rows <- function(phase) {
    if (!identical(phase, dashboard_phase)) return(NA_integer_)
    value <- suppressWarnings(as.integer(
      dashboard_reports$source_validity$total_responses %||%
        dashboard_reports$kpis$total_respuestas %||%
        dashboard$kpis$total %||%
        NA_integer_
    ))
    if (length(value) && is.finite(value[[1]])) value[[1]] else NA_integer_
  }
  dashboard_asset <- .monitoreo_scalar(
    dashboard_reports$source_coherence$asset_uid %||% dashboard_reports$asset_uid,
    ""
  )
  has_error_for_source <- function(source_id) {
    if (!nzchar(source_id) || !length(errors)) return(FALSE)
    any(vapply(errors, function(err) {
      is.list(err) && identical(.monitoreo_scalar(err$source_id, ""), source_id)
    }, logical(1)))
  }
  phases <- setNames(lapply(c("pilot", "field"), function(phase) {
    phase_source <- phase_sources[[phase]] %||% .monitoreo_territorial_empty_phase_source()
    source_id <- .monitoreo_scalar(phase_source$source_id, "")
    asset_uid <- .monitoreo_scalar(phase_source$asset_uid, "")
    version_id <- .monitoreo_scalar(phase_source$kobo_version_id, "")
    asset_name <- .monitoreo_scalar(phase_source$kobo_asset_name, "")
    source <- source_by_id(source_id)
    if (is.null(source) && nzchar(asset_uid)) {
      hit <- Filter(function(src) {
        source_phase <- .monitoreo_source_territorial_phase(src)
        identical(.monitoreo_scalar(src$asset_uid, ""), asset_uid) &&
          (!nzchar(source_phase) || identical(source_phase, phase))
      }, sources)
      if (length(hit)) source <- hit[[1]]
    }
    local_rows <- if (nzchar(source_id)) .monitoreo_snapshot_count(data, source_id) else 0L
    report_rows <- local_rows
    if (nzchar(source_id) && nrow(data)) {
      phase_report_data <- .monitoreo_territorial_filter_data_for_phase(data, cfg, phase)
      if (is.data.frame(phase_report_data) && nrow(phase_report_data) && ".source_id" %in% names(phase_report_data)) {
        phase_report_source_ids <- trimws(as.character(phase_report_data$.source_id %||% ""))
        phase_report_source_ids[is.na(phase_report_source_ids)] <- ""
        report_rows <- sum(phase_report_source_ids == source_id, na.rm = TRUE)
      } else {
        report_rows <- 0L
      }
    }
    source_asset <- .monitoreo_scalar(source$asset_uid, "")
    source_exists <- !is.null(source)
    source_applied <- nzchar(asset_uid) || nzchar(source_id)
    snapshot_has_source <- nzchar(source_id) && source_id %in% source_ids_in_snapshot
    last_sync_at <- .monitoreo_scalar(source$last_sync_at, "")
    if (!nzchar(last_sync_at) && local_rows > 0L) last_sync_at <- .monitoreo_scalar(synced_at, "")
    dash_rows <- dashboard_rows(phase)
    dashboard_active <- identical(phase, dashboard_phase)
    dashboard_matches <- if (dashboard_active && is.finite(dash_rows)) {
      identical(as.integer(dash_rows), as.integer(report_rows)) &&
        (!nzchar(asset_uid) || !nzchar(dashboard_asset) || identical(asset_uid, dashboard_asset))
    } else {
      NA
    }
    source_asset_mismatch <- source_exists && nzchar(asset_uid) && nzchar(source_asset) && !identical(asset_uid, source_asset)
    status <- if (has_error_for_source(source_id)) {
      "sync_error"
    } else if (!source_applied) {
      "source_not_applied"
    } else if (isTRUE(source_asset_mismatch) || (nzchar(source_id) && !source_exists)) {
      "source_snapshot_mismatch"
    } else if (isTRUE(dashboard_active) && isFALSE(dashboard_matches)) {
      "dashboard_stale"
    } else if (local_rows > 0L) {
      "source_synced_with_rows"
    } else if (nzchar(last_sync_at)) {
      "source_synced_zero_rows"
    } else {
      "source_applied_not_synced"
    }
    label <- .monitoreo_territorial_phase_label(phase)
    message <- switch(
      status,
      source_not_applied = sprintf("%s no tiene formulario aplicado.", label),
      source_applied_not_synced = sprintf("%s tiene un formulario aplicado, pero todavia no hay respuestas sincronizadas localmente. Usa Actualizar %s para traer las respuestas de esa fuente.", label, label),
      source_synced_with_rows = sprintf("%s tiene %s respuestas locales sincronizadas.", label, format(local_rows, big.mark = ",", scientific = FALSE)),
      source_synced_zero_rows = sprintf("%s fue sincronizado y Kobo devolvio 0 respuestas para la fuente aplicada.", label),
      dashboard_stale = sprintf("%s tiene datos locales, pero el tablero no coincide con la fuente aplicada. Actualiza %s para reconstruir el corte.", label, label),
      source_snapshot_mismatch = sprintf("%s tiene una desalineacion entre fuente aplicada, source_id y snapshot local.", label),
      sync_error = sprintf("La ultima sincronizacion de %s termino con error; se conserva la fuente aplicada.", label),
      sprintf("%s seleccionado.", label)
    )
    out <- list(
      phase = phase,
      label = label,
      status = status,
      message = message,
      source_applied = isTRUE(source_applied),
      source_exists = isTRUE(source_exists),
      asset_uid = asset_uid,
      version_id = version_id,
      asset_name = asset_name,
      source_id = source_id,
      source_asset_uid = source_asset,
      local_rows = as.integer(local_rows),
      report_rows = as.integer(report_rows),
      snapshot_total_rows = as.integer(nrow(data)),
      snapshot_synced_at = .monitoreo_scalar(synced_at, ""),
      last_sync_at = last_sync_at,
      snapshot_has_source = isTRUE(snapshot_has_source),
      snapshot_matches_source = isTRUE(snapshot_has_source) && local_rows > 0L,
      dashboard_active_phase = isTRUE(dashboard_active),
      dashboard_matches_source = dashboard_matches
    )
    if (is.finite(dash_rows)) out$dashboard_rows <- as.integer(dash_rows)
    out
  }), c("pilot", "field"))
  active_phase <- .monitoreo_territorial_phase(tcfg$active_route_phase, "pilot")
  list(
    schema = "monitoreo_territorial_phase_coherence_v1",
    generated_at = .monitoreo_now_iso(),
    active_route_phase = active_phase,
    snapshot_total_rows = as.integer(nrow(data)),
    snapshot_synced_at = .monitoreo_scalar(synced_at, ""),
    phases = phases,
    active = phases[[active_phase]]
  )
}

.monitoreo_prune_snapshot_source_ids <- function(sid, source_ids, cfg = NULL) {
  source_ids <- unique(.monitoreo_chr_vec(source_ids))
  source_ids <- source_ids[nzchar(source_ids)]
  if (!length(source_ids)) return(0L)
  s <- session_get(sid)
  snapshot <- s$monitoreo_snapshot %||% NULL
  if (is.null(snapshot) || !is.data.frame(snapshot$data) || !nrow(snapshot$data) || !".source_id" %in% names(snapshot$data)) {
    return(0L)
  }
  data <- snapshot$data
  keep <- !as.character(data$.source_id %||% "") %in% source_ids
  removed <- sum(!keep, na.rm = TRUE)
  if (!removed) return(0L)
  next_data <- data[keep, , drop = FALSE]
  cfg <- monitoreo_normalize_config(cfg %||% s$monitoreo_config %||% list(), next_data)
  snapshot$data <- next_data
  snapshot$config <- cfg
  snapshot$dashboard <- .monitoreo_dashboard_for_session(sid, next_data, cfg)
  snapshot$variables <- if (nrow(next_data)) monitoreo_variables(next_data) else list()
  snapshot$dashboard_cache_key <- .monitoreo_dashboard_cache_key
  snapshot$dashboard_cache_token <- NULL
  session_set(sid, "monitoreo_config", cfg)
  session_set(sid, "monitoreo_snapshot", snapshot)
  s <- session_get(sid)
  s$monitoreo_dashboard_cache <- NULL
  s$monitoreo_dashboard_cache_token <- NULL
  s$monitoreo_dashboard_light_cache <- NULL
  s$monitoreo_dashboard_light_cache_token <- NULL
  .session_env[[sid]] <- s
  .monitoreo_territorial_invalidate_map_cache(sid, layers = "gps_points", reason = "snapshot_source_pruned")
  as.integer(removed)
}

.monitoreo_sync_incremental_source_ids <- function(sync_summary = list()) {
  if (is.null(sync_summary) || !is.list(sync_summary) || !length(sync_summary)) return(character(0))
  ids <- vapply(sync_summary, function(item) {
    if (!is.list(item)) return("")
    mode <- .monitoreo_scalar(item$mode, "")
    if (!identical(mode, "incremental")) return("")
    .monitoreo_scalar(item$source_id, "")
  }, character(1))
  unique(ids[nzchar(ids)])
}

.monitoreo_sync_successful_source_ids <- function(sync_summary = list(), result_data = data.frame()) {
  ids <- character(0)
  if (is.list(sync_summary) && length(sync_summary)) {
    ids <- vapply(sync_summary, function(item) {
      if (!is.list(item)) return("")
      .monitoreo_scalar(item$source_id, "")
    }, character(1))
  }
  ids <- unique(ids[nzchar(ids)])
  if (length(ids)) return(ids)
  if (is.data.frame(result_data) && nrow(result_data) && ".source_id" %in% names(result_data)) {
    ids <- unique(as.character(result_data$.source_id %||% ""))
    ids <- ids[nzchar(ids)]
  }
  ids
}

.monitoreo_sync_stable_row_key <- function(data) {
  if (is.null(data) || !is.data.frame(data) || !nrow(data)) return(character(0))
  source <- if (".source_id" %in% names(data)) as.character(data$.source_id %||% "") else rep("", nrow(data))
  id_col <- c("_id", "_uuid", "meta.instanceID", "meta/instanceID", "response_id", "submission_id", "uuid")
  id_col <- id_col[id_col %in% names(data)]
  if (!length(id_col)) return(rep("", nrow(data)))
  values <- as.character(data[[id_col[[1]]]])
  values[is.na(values)] <- ""
  has_key <- nzchar(source) & nzchar(values)
  out <- rep("", nrow(data))
  out[has_key] <- paste(source[has_key], id_col[[1]], values[has_key], sep = "\r")
  out
}

.monitoreo_merge_sync_result_data <- function(prev_data,
                                              result_data,
                                              synced_source_ids = character(0),
                                              incremental_source_ids = character(0)) {
  if (is.null(prev_data) || !is.data.frame(prev_data)) prev_data <- data.frame()
  if (is.null(result_data) || !is.data.frame(result_data)) result_data <- data.frame()
  synced_source_ids <- unique(.monitoreo_chr_vec(synced_source_ids))
  synced_source_ids <- synced_source_ids[nzchar(synced_source_ids)]
  incremental_source_ids <- intersect(unique(.monitoreo_chr_vec(incremental_source_ids)), synced_source_ids)
  full_source_ids <- setdiff(synced_source_ids, incremental_source_ids)

  base <- prev_data
  if (nrow(base) && length(full_source_ids) && ".source_id" %in% names(base)) {
    base <- base[!as.character(base$.source_id %||% "") %in% full_source_ids, , drop = FALSE]
  }
  combined <- .monitoreo_bind_rows(list(base, result_data))
  if (!nrow(combined) || !length(incremental_source_ids) || !".source_id" %in% names(combined)) return(combined)

  source <- as.character(combined$.source_id %||% "")
  keys <- .monitoreo_sync_stable_row_key(combined)
  can_upsert <- source %in% incremental_source_ids & nzchar(keys)
  if (!any(can_upsert)) return(combined)
  keep <- rep(TRUE, nrow(combined))
  keep[can_upsert] <- !duplicated(keys[can_upsert], fromLast = TRUE)
  combined[keep, , drop = FALSE]
}

.monitoreo_territorial_map_cache_schema <- "monitoreo_territorial_map_cache_v1"
.monitoreo_territorial_gps_points_schema <- "gps_points_declared_ump_v6_effective_gps_cross_status"
.monitoreo_territorial_map_cache_layers <- c("route_geometry", "gps_points")

.monitoreo_cache_digest <- function(value) {
  if (requireNamespace("digest", quietly = TRUE)) {
    return(digest::digest(value, algo = "sha256"))
  }
  tryCatch(
    jsonlite::toJSON(value, auto_unbox = TRUE, null = "null", dataframe = "rows", digits = 8),
    error = function(e) as.character(utils::object.size(value))
  )
}

.monitoreo_territorial_map_cache_empty <- function() {
  list(
    schema = .monitoreo_territorial_map_cache_schema,
    updated_at = "",
    phases = list(pilot = list(), field = list())
  )
}

.monitoreo_territorial_map_cache_get <- function(sid) {
  cache <- session_get(sid)$monitoreo_territorial_map_cache %||% list()
  if (!is.list(cache) || !identical(.monitoreo_scalar(cache$schema, ""), .monitoreo_territorial_map_cache_schema)) {
    cache <- .monitoreo_territorial_map_cache_empty()
  }
  if (is.null(cache$phases) || !is.list(cache$phases)) cache$phases <- list()
  for (phase in c("pilot", "field")) {
    if (is.null(cache$phases[[phase]]) || !is.list(cache$phases[[phase]])) {
      cache$phases[[phase]] <- list()
    }
  }
  cache
}

.monitoreo_territorial_map_cache_set_layer <- function(sid, phase, layer, value) {
  phase <- .monitoreo_territorial_phase(phase, "pilot")
  if (!layer %in% .monitoreo_territorial_map_cache_layers) return(invisible(NULL))
  cache <- .monitoreo_territorial_map_cache_get(sid)
  cache$phases[[phase]][[layer]] <- value
  cache$updated_at <- .monitoreo_now_iso()
  session_set(sid, "monitoreo_territorial_map_cache", cache)
  invisible(cache)
}

.monitoreo_territorial_invalidate_map_cache <- function(sid, phase = NULL, layers = .monitoreo_territorial_map_cache_layers, reason = "") {
  layers <- intersect(.monitoreo_chr_vec(layers), .monitoreo_territorial_map_cache_layers)
  if (!length(layers)) return(invisible(NULL))
  phases <- if (is.null(phase)) c("pilot", "field") else .monitoreo_territorial_phase(phase, "pilot")
  cache <- .monitoreo_territorial_map_cache_get(sid)
  changed <- FALSE
  for (ph in phases) {
    for (layer in layers) {
      entry <- cache$phases[[ph]][[layer]] %||% NULL
      if (!is.list(entry)) next
      entry$status <- "stale"
      entry$invalidated_at <- .monitoreo_now_iso()
      entry$invalidated_reason <- .monitoreo_scalar(reason, "invalidated")
      cache$phases[[ph]][[layer]] <- entry
      changed <- TRUE
    }
  }
  if (isTRUE(changed)) {
    cache$updated_at <- .monitoreo_now_iso()
    session_set(sid, "monitoreo_territorial_map_cache", cache)
  }
  invisible(cache)
}

.monitoreo_territorial_route_blocks_for_cache <- function(context) {
  blocks <- tryCatch(.monitoreo_territorial_block_goal_df(context, include_replacements = TRUE), error = function(e) data.frame())
  if (is.null(blocks) || !is.data.frame(blocks)) blocks <- data.frame()
  blocks
}

.monitoreo_territorial_hashable_df <- function(df, cols = NULL) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(data.frame())
  if (is.null(cols)) cols <- names(df)
  cols <- intersect(cols, names(df))
  if (!length(cols)) return(data.frame())
  out <- df[, cols, drop = FALSE]
  for (nm in names(out)) {
    if (is.factor(out[[nm]])) out[[nm]] <- as.character(out[[nm]])
  }
  sort_cols <- intersect(c("ubigeo", "zona", "manzana", "id_manzana", "tipo_manzana", "ump"), names(out))
  if (length(sort_cols)) {
    ord <- do.call(order, c(out[sort_cols], list(na.last = TRUE)))
    out <- out[ord, , drop = FALSE]
  }
  rownames(out) <- NULL
  out
}

.monitoreo_territorial_route_hash <- function(context, phase = NULL) {
  blocks <- .monitoreo_territorial_route_blocks_for_cache(context)
  cols <- c(
    "id_manzana", "ubigeo", "distrito", "zona", "manzana", "entrevistas",
    "tipo_manzana", "titular_id_manzana", "replacement_order",
    "hoja_num", "rango_inicio", "rango_fin", "territorio_muestral", "ump"
  )
  .monitoreo_cache_digest(list(
    schema = .monitoreo_territorial_map_cache_schema,
    layer = "route_geometry",
    phase = .monitoreo_territorial_phase(phase %||% context$phase, "pilot"),
    total_entrevistas = as.integer(context$total_entrevistas %||% 0L),
    total_replacement_interviews = as.integer(context$total_replacement_interviews %||% 0L),
    run_locked = isTRUE(context$run_locked),
    blocks = .monitoreo_territorial_hashable_df(blocks, cols)
  ))
}

.monitoreo_territorial_gps_hash <- function(data, cfg, context, route_hash, phase = NULL) {
  if (is.null(data) || !is.data.frame(data)) data <- data.frame()
  cfg <- monitoreo_normalize_config(cfg %||% list(), data)
  tcfg <- cfg$territorial %||% monitoreo_territorial_default_config(data)
  phase <- .monitoreo_territorial_phase(phase %||% context$phase %||% tcfg$active_route_phase, "pilot")
  phase_source <- .monitoreo_territorial_phase_source(tcfg, phase)
  mapping <- tcfg[intersect(c(
    "district_var", "ump_var", "pulso_code_var", "gps_var", "consent_var",
    "age_var", "sex_var", "status_var", "id_var", "submitted_by_var",
    "submission_time_var", "start_var", "end_var", "duration_var",
    "platform_effective_var", "platform_effective_values", "variable_refs",
    "valid_statuses", "district_crosswalk", "geo_thresholds_m",
    "validation_decisions", "enumerator_roster", "enumerator_code_reconciliation",
    "ump_reconciliation", "production_annulments"
  ), names(tcfg))]
  .monitoreo_cache_digest(list(
    schema = .monitoreo_territorial_map_cache_schema,
    layer = "gps_points",
    point_schema = .monitoreo_territorial_gps_points_schema,
    phase = phase,
    source_id = .monitoreo_scalar(phase_source$source_id, ""),
    asset_uid = .monitoreo_scalar(phase_source$asset_uid, ""),
    version_id = .monitoreo_scalar(phase_source$kobo_version_id, ""),
    route_hash = .monitoreo_scalar(route_hash, ""),
    data_hash = monitoreo_snapshot_hash(data),
    mapping = mapping
  ))
}

.monitoreo_territorial_bounds_from_points <- function(lat, lon) {
  lat <- suppressWarnings(as.numeric(lat))
  lon <- suppressWarnings(as.numeric(lon))
  ok <- is.finite(lat) & is.finite(lon)
  if (!any(ok)) return(list())
  list(
    min_lat = round(min(lat[ok], na.rm = TRUE), 7),
    min_lon = round(min(lon[ok], na.rm = TRUE), 7),
    max_lat = round(max(lat[ok], na.rm = TRUE), 7),
    max_lon = round(max(lon[ok], na.rm = TRUE), 7)
  )
}

.monitoreo_territorial_route_entry <- function(context, route_hash, phase = NULL) {
  phase <- .monitoreo_territorial_phase(phase %||% context$phase, "pilot")
  blocks <- .monitoreo_territorial_route_blocks_for_cache(context)
  titular <- if (nrow(blocks) && "tipo_manzana" %in% names(blocks)) {
    sum(as.character(blocks$tipo_manzana %||% "") != "reemplazo", na.rm = TRUE)
  } else {
    nrow(blocks)
  }
  replacements <- max(0L, nrow(blocks) - titular)
  ump_cols <- intersect(c("id_manzana", "ubigeo", "distrito", "zona", "manzana", "tipo_manzana", "ump", "titular_id_manzana"), names(blocks))
  ump_index <- if (length(ump_cols)) .monitoreo_territorial_df_rows(blocks[, ump_cols, drop = FALSE]) else list()
  list(
    layer = "route_geometry",
    status = "valid",
    hash = .monitoreo_scalar(route_hash, ""),
    created_at = .monitoreo_now_iso(),
    phase = phase,
    bounds = list(),
    counts = list(
      blocks = as.integer(nrow(blocks)),
      titular = as.integer(titular),
      replacements = as.integer(replacements)
    ),
    ubigeos = as.list(sort(unique(as.character(blocks$ubigeo %||% character(0))))),
    blocks = .monitoreo_territorial_df_rows(blocks),
    features = list(),
    ump_index = ump_index,
    source_versions = list(
      phases_available = as.list(context$phases_available %||% list()),
      run_locked = isTRUE(context$run_locked)
    )
  )
}

.monitoreo_territorial_response_ubigeo <- function(data, tcfg) {
  if (is.null(data) || !is.data.frame(data) || !nrow(data)) return(character(0))
  crosswalk <- .monitoreo_territorial_crosswalk_df(tcfg$district_crosswalk)
  district_raw <- .monitoreo_territorial_source_value(data, tcfg$district_var)
  district_key <- vapply(district_raw, .monitoreo_safe_name, character(1))
  cw_idx <- match(district_key, crosswalk$kobo_key)
  ifelse(!is.na(cw_idx), crosswalk$ubigeo[cw_idx], "")
}

.monitoreo_territorial_gps_entry <- function(data, cfg, context, route_hash, gps_hash, phase = NULL) {
  if (is.null(data) || !is.data.frame(data)) data <- data.frame()
  cfg <- monitoreo_normalize_config(cfg %||% list(), data)
  tcfg <- cfg$territorial %||% monitoreo_territorial_default_config(data)
  phase <- .monitoreo_territorial_phase(phase %||% context$phase %||% tcfg$active_route_phase, "pilot")
  phase_source <- .monitoreo_territorial_phase_source(tcfg, phase)
  n <- nrow(data)
  crosswalk <- .monitoreo_territorial_crosswalk_df(tcfg$district_crosswalk)
  district_raw <- .monitoreo_territorial_source_value(data, tcfg$district_var)
  district_key <- vapply(district_raw, .monitoreo_safe_name, character(1))
  cw_idx <- match(district_key, crosswalk$kobo_key)
  ubigeo <- ifelse(!is.na(cw_idx), crosswalk$ubigeo[cw_idx], "")
  distrito <- ifelse(!is.na(cw_idx), crosswalk$distrito[cw_idx], "")
  geo <- .monitoreo_territorial_geo_status(data, tcfg, ubigeo, context)
  response_identity <- .monitoreo_territorial_response_identity(data, tcfg)
  geo$response_id <- response_identity$id %||% rep("", nrow(geo))
  geo$ubigeo <- ubigeo
  geo$distrito <- distrito
  submitted_by <- .monitoreo_territorial_source_value(data, tcfg$submitted_by_var, "Sin encuestador asignado")
  submitted_by[is.na(submitted_by) | !nzchar(trimws(submitted_by))] <- "Sin encuestador asignado"
  geo$submitted_by <- submitted_by
  consent_raw <- .monitoreo_territorial_source_value(data, tcfg$consent_var)
  consent_key <- vapply(consent_raw, .monitoreo_safe_name, character(1))
  consent_yes <- consent_key %in% c("1", "si", "sí", "yes", "true", "acepta", "acepto", "accepted")
  geo$age <- suppressWarnings(as.numeric(.monitoreo_territorial_source_value(data, tcfg$age_var)))
  geo$sex <- .monitoreo_territorial_source_value(data, tcfg$sex_var)
  effective_mask <- .monitoreo_territorial_effective_mask(data, tcfg, consent_yes)
  geo$advance_valid <- effective_mask %in% TRUE
  geo$validation_status <- ifelse(geo$advance_valid, "validada", "no_defendible")
  geo$observation_status <- ifelse(geo$advance_valid & geo$geo_estado %in% c("geo_revision", "geo_no_defendible", "geo_sin_cruce", "geo_sin_gps"), "en_observacion", ifelse(geo$advance_valid, "sin_observacion", "no_valida"))
  submission_time_pick <- .monitoreo_territorial_submission_time_values(data, tcfg)
  submission_time <- submission_time_pick$values
  date_values <- .monitoreo_parse_time_vec(submission_time)
  geo$submission_time_source <- rep(.monitoreo_scalar(submission_time_pick$source, ""), n)
  geo$submission_date_iso <- .monitoreo_date_iso_vec(date_values, submission_time)
  geo$submission_date <- .monitoreo_format_date_label_vec(date_values, submission_time)
  geo$submission_hour <- .monitoreo_format_time_label_vec(date_values, submission_time)
  geo$submission_datetime <- .monitoreo_format_datetime_label_vec(date_values, submission_time)
  ump_raw <- .monitoreo_territorial_source_value(data, tcfg$ump_var, "", ref = tcfg$variable_refs$ump %||% NULL)
  declared_ump_match <- .monitoreo_territorial_declared_ump_matches(
    ump_raw,
    .monitoreo_territorial_block_goal_df(context, include_replacements = TRUE),
    ubigeo = geo$ubigeo,
    distrito = geo$distrito,
    reconciliations = tcfg$ump_reconciliation %||% list(),
    phase = phase,
    response_id = response_identity$id,
    response_id_field = response_identity$field
  )
  for (col in names(declared_ump_match)) {
    if (length(declared_ump_match[[col]]) == n) geo[[col]] <- declared_ump_match[[col]]
  }
  point_cols <- intersect(c(
    "response_id", "submitted_by", "submission_time_source", "submission_date_iso",
    "submission_date", "submission_hour", "submission_datetime", "ubigeo", "distrito",
    "age", "sex",
    "lat", "lon", "gps_parseable", "geo_estado", "distance_m",
    "nearest_block_id", "nearest_block_type", "geometry_match",
    "gps_primary_source", "gps_primary_lat", "gps_primary_lon", "gps_primary_altitude",
    "gps_primary_accuracy_m", "gps_primary_parseable", "gps_primary_estado",
    "gps_primary_distance_m", "gps_primary_nearest_block_id", "gps_primary_nearest_block_type",
    "gps_primary_geometry_match", "gps_effective_source", "gps_effective_lat",
    "gps_effective_lon", "gps_effective_altitude", "gps_effective_accuracy_m",
    "gps_effective_estado", "gps_effective_distance_m", "gps_effective_nearest_block_id",
    "gps_effective_nearest_block_type", "gps_effective_geometry_match", "gps_reclassified",
    "gps_reclassification_note",
    "declared_ump_raw", "declared_ump_normalized", "advance_block_id",
    "advance_block_ump", "advance_block_ubigeo", "advance_block_distrito",
    "advance_block_zona", "advance_block_manzana", "advance_block_type",
    "advance_block_match", "advance_block_match_status", "advance_block_match_source", "advance_block_reconciliation_scope", "advance_valid",
    "observation_status", "validation_status"
  ), names(geo))
  list(
    layer = "gps_points",
    point_schema = .monitoreo_territorial_gps_points_schema,
    status = "valid",
    hash = .monitoreo_scalar(gps_hash, ""),
    route_hash = .monitoreo_scalar(route_hash, ""),
    created_at = .monitoreo_now_iso(),
    phase = phase,
    source_id = .monitoreo_scalar(phase_source$source_id, ""),
    asset_uid = .monitoreo_scalar(phase_source$asset_uid, ""),
    version_id = .monitoreo_scalar(phase_source$kobo_version_id, ""),
    bounds = .monitoreo_territorial_bounds_from_points(geo$lat, geo$lon),
    counts = list(
      points = as.integer(nrow(geo)),
      gps_parseable = as.integer(sum(geo$gps_parseable %in% TRUE, na.rm = TRUE)),
      geo_ok = as.integer(sum(geo$geo_estado == "geo_ok", na.rm = TRUE)),
      geo_revision = as.integer(sum(geo$geo_estado %in% c("geo_cerca", "geo_revision"), na.rm = TRUE)),
      geo_no_defendible = as.integer(sum(geo$geo_estado == "geo_no_defendible", na.rm = TRUE))
    ),
    points = if (length(point_cols)) .monitoreo_territorial_df_rows(geo[, point_cols, drop = FALSE]) else list(),
    geo_results = geo
  )
}

.monitoreo_territorial_layer_meta <- function(entry, expected_hash = "", route_hash = "") {
  if (!is.list(entry)) {
    return(list(status = "missing", hash = "", expected_hash = .monitoreo_scalar(expected_hash, ""), created_at = "", stale = FALSE, usable = FALSE))
  }
  hash <- .monitoreo_scalar(entry$hash, "")
  valid <- nzchar(hash) && nzchar(.monitoreo_scalar(expected_hash, "")) && identical(hash, .monitoreo_scalar(expected_hash, ""))
  expected_point_schema <- ""
  if (identical(.monitoreo_scalar(entry$layer, ""), "gps_points") && nzchar(.monitoreo_scalar(route_hash, ""))) {
    valid <- valid && identical(.monitoreo_scalar(entry$route_hash, ""), .monitoreo_scalar(route_hash, ""))
    expected_point_schema <- .monitoreo_territorial_gps_points_schema
    valid <- valid && identical(.monitoreo_scalar(entry$point_schema, ""), expected_point_schema)
  }
  status <- if (isTRUE(valid) && !identical(.monitoreo_scalar(entry$status, ""), "stale")) "valid" else "stale"
  list(
    layer = .monitoreo_scalar(entry$layer, ""),
    status = status,
    hash = hash,
    expected_hash = .monitoreo_scalar(expected_hash, ""),
    route_hash = .monitoreo_scalar(entry$route_hash, ""),
    expected_route_hash = .monitoreo_scalar(route_hash, ""),
    point_schema = .monitoreo_scalar(entry$point_schema, ""),
    expected_point_schema = expected_point_schema,
    created_at = .monitoreo_scalar(entry$created_at, ""),
    invalidated_at = .monitoreo_scalar(entry$invalidated_at, ""),
    invalidated_reason = .monitoreo_scalar(entry$invalidated_reason, ""),
    stale = !isTRUE(valid),
    usable = TRUE,
    bounds = entry$bounds %||% list(),
    counts = entry$counts %||% list()
  )
}

.monitoreo_territorial_cached_geo_results <- function(data, tcfg, entry, expected_hash = "", route_hash = "", allow_stale = FALSE) {
  meta <- .monitoreo_territorial_layer_meta(entry, expected_hash, route_hash)
  if (identical(meta$status, "missing")) return(NULL)
  if (!identical(meta$status, "valid") && !isTRUE(allow_stale)) return(NULL)
  geo <- entry$geo_results %||% NULL
  if (!is.data.frame(geo)) return(NULL)
  if (is.null(data) || !is.data.frame(data)) data <- data.frame()
  if (!nrow(data) && !nrow(geo)) return(geo)
  ids <- .monitoreo_territorial_response_identity(data, tcfg)$id %||% character(0)
  if ("response_id" %in% names(geo) && length(ids) == nrow(data)) {
    idx <- match(ids, as.character(geo$response_id %||% ""))
    if (any(is.na(idx))) return(NULL)
    geo <- geo[idx, , drop = FALSE]
    rownames(geo) <- NULL
    return(geo)
  }
  if (nrow(geo) == nrow(data)) return(geo)
  NULL
}

.monitoreo_territorial_map_cache_meta <- function(sid, cfg, data = NULL) {
  if (is.null(data) || !is.data.frame(data)) data <- data.frame()
  cfg <- monitoreo_normalize_config(cfg %||% list(), data)
  cache <- .monitoreo_territorial_map_cache_get(sid)
  phases <- setNames(lapply(c("pilot", "field"), function(phase) {
    phase_data <- .monitoreo_territorial_filter_data_for_phase(data, cfg, phase = phase)
    context <- .monitoreo_territorial_context(sid, cfg, phase = phase)
    route_hash <- .monitoreo_territorial_route_hash(context, phase = phase)
    gps_hash <- .monitoreo_territorial_gps_hash(phase_data, cfg, context, route_hash, phase = phase)
    phase_cache <- cache$phases[[phase]] %||% list()
    route_meta <- .monitoreo_territorial_layer_meta(phase_cache$route_geometry %||% NULL, route_hash)
    gps_meta <- .monitoreo_territorial_layer_meta(phase_cache$gps_points %||% NULL, gps_hash, route_hash)
    list(
      phase = phase,
      route_geometry = route_meta,
      gps_points = gps_meta
    )
  }), c("pilot", "field"))
  active_phase <- .monitoreo_territorial_phase(cfg$territorial$active_route_phase, "pilot")
  list(
    schema = .monitoreo_territorial_map_cache_schema,
    generated_at = .monitoreo_now_iso(),
    active_route_phase = active_phase,
    phases = phases,
    active = phases[[active_phase]]
  )
}

.monitoreo_territorial_prepare_map_cache <- function(sid,
                                                     cfg,
                                                     data = NULL,
                                                     phase = NULL,
                                                     layers = .monitoreo_territorial_map_cache_layers,
                                                     force = FALSE) {
  if (is.null(data) || !is.data.frame(data)) data <- data.frame()
  cfg <- monitoreo_normalize_config(cfg %||% list(), data)
  phase <- .monitoreo_territorial_phase(phase %||% cfg$territorial$active_route_phase, "pilot")
  layers <- intersect(.monitoreo_chr_vec(layers), .monitoreo_territorial_map_cache_layers)
  if (!length(layers)) layers <- .monitoreo_territorial_map_cache_layers
  phase_data <- .monitoreo_territorial_filter_data_for_phase(data, cfg, phase = phase)
  context <- .monitoreo_territorial_context(sid, cfg, phase = phase)
  route_hash <- .monitoreo_territorial_route_hash(context, phase = phase)
  cache <- .monitoreo_territorial_map_cache_get(sid)
  phase_cache <- cache$phases[[phase]] %||% list()
  route_entry <- phase_cache$route_geometry %||% NULL
  route_meta <- .monitoreo_territorial_layer_meta(route_entry, route_hash)
  if ((("route_geometry" %in% layers) || ("gps_points" %in% layers)) &&
      (isTRUE(force) || !identical(route_meta$status, "valid"))) {
    route_entry <- .monitoreo_territorial_route_entry(context, route_hash, phase = phase)
    .monitoreo_territorial_map_cache_set_layer(sid, phase, "route_geometry", route_entry)
    cache <- .monitoreo_territorial_map_cache_get(sid)
    phase_cache <- cache$phases[[phase]] %||% list()
  }
  gps_hash <- .monitoreo_territorial_gps_hash(phase_data, cfg, context, route_hash, phase = phase)
  gps_entry <- phase_cache$gps_points %||% NULL
  gps_meta <- .monitoreo_territorial_layer_meta(gps_entry, gps_hash, route_hash)
  if ("gps_points" %in% layers && (isTRUE(force) || !identical(gps_meta$status, "valid"))) {
    gps_entry <- .monitoreo_territorial_gps_entry(phase_data, cfg, context, route_hash, gps_hash, phase = phase)
    .monitoreo_territorial_map_cache_set_layer(sid, phase, "gps_points", gps_entry)
  }
  .monitoreo_territorial_map_cache_meta(sid, cfg, data)
}

.monitoreo_territorial_context_with_map_cache <- function(sid,
                                                         cfg,
                                                         data = NULL,
                                                         phase = NULL,
                                                         report_scope = "full",
                                                         allow_stale = TRUE,
                                                         prepare_missing = TRUE) {
  if (is.null(data) || !is.data.frame(data)) data <- data.frame()
  cfg <- monitoreo_normalize_config(cfg %||% list(), data)
  phase <- .monitoreo_territorial_phase(phase %||% cfg$territorial$active_route_phase, "pilot")
  context <- .monitoreo_territorial_context(sid, cfg, phase = phase)
  route_hash <- .monitoreo_territorial_route_hash(context, phase = phase)
  cache <- .monitoreo_territorial_map_cache_get(sid)
  phase_cache <- cache$phases[[phase]] %||% list()
  route_entry <- phase_cache$route_geometry %||% NULL
  route_meta <- .monitoreo_territorial_layer_meta(route_entry, route_hash)
  if (isTRUE(prepare_missing) && !identical(route_meta$status, "valid")) {
    route_entry <- .monitoreo_territorial_route_entry(context, route_hash, phase = phase)
    .monitoreo_territorial_map_cache_set_layer(sid, phase, "route_geometry", route_entry)
    route_meta <- .monitoreo_territorial_layer_meta(route_entry, route_hash)
  }
  gps_hash <- .monitoreo_territorial_gps_hash(data, cfg, context, route_hash, phase = phase)
  gps_entry <- phase_cache$gps_points %||% NULL
  gps_meta <- .monitoreo_territorial_layer_meta(gps_entry, gps_hash, route_hash)
  needs_gps <- .monitoreo_report_scope(report_scope) %in% c("validation_summary", "queries_summary", "full")
  if (isTRUE(needs_gps)) {
    cached_geo <- .monitoreo_territorial_cached_geo_results(
      data,
      cfg$territorial %||% monitoreo_territorial_default_config(data),
      gps_entry,
      expected_hash = gps_hash,
      route_hash = route_hash,
      allow_stale = allow_stale
    )
    if (is.data.frame(cached_geo)) {
      context$geo_results <- cached_geo
    } else if (isTRUE(prepare_missing)) {
      gps_entry <- .monitoreo_territorial_gps_entry(data, cfg, context, route_hash, gps_hash, phase = phase)
      .monitoreo_territorial_map_cache_set_layer(sid, phase, "gps_points", gps_entry)
      gps_meta <- .monitoreo_territorial_layer_meta(gps_entry, gps_hash, route_hash)
      context$geo_results <- gps_entry$geo_results
    }
  }
  context$map_cache <- list(
    phase = phase,
    route_geometry = route_meta,
    gps_points = gps_meta
  )
  context
}

.monitoreo_territorial_report_cache_schema <- "monitoreo_territorial_report_cache_v26"
.monitoreo_territorial_report_cache_limit <- 18L

.monitoreo_territorial_report_cache_key_info <- function(sid, snapshot, data, cfg, report_scope = "full") {
  phase <- .monitoreo_territorial_phase(cfg$territorial$active_route_phase %||% "pilot", "pilot")
  scope <- .monitoreo_report_scope(report_scope)
  phase_data <- .monitoreo_territorial_filter_data_for_phase(data, cfg, phase = phase)
  source <- .monitoreo_territorial_phase_source(cfg$territorial, phase)
  source_id <- .monitoreo_scalar(source$source_id, "")
  route_hash <- ""
  if (!scope %in% c("light", "source")) {
    context <- .monitoreo_territorial_context(sid, cfg, phase = phase)
    route_hash <- .monitoreo_territorial_route_hash(context, phase = phase)
  }
  snapshot_hash <- monitoreo_snapshot_hash(phase_data)
  config_hash <- .monitoreo_cache_digest(list(
    profile = cfg$monitoreo_profile %||% list(),
    territorial = cfg$territorial %||% list(),
    objetivo_total = cfg$objetivo_total %||% NULL
  ))
  key <- .monitoreo_cache_digest(list(
    schema = .monitoreo_territorial_report_cache_schema,
    phase = phase,
    source_id = source_id,
    report_scope = scope,
    snapshot_hash = snapshot_hash,
    route_hash = route_hash,
    config_hash = config_hash
  ))
  list(
    key = key,
    phase = phase,
    source_id = source_id,
    report_scope = scope,
    snapshot_hash = snapshot_hash,
    route_hash = route_hash,
    config_hash = config_hash
  )
}

.monitoreo_territorial_report_cache_get <- function(snapshot) {
  cache <- snapshot$territorial_report_cache
  if (!is.list(cache) || !identical(.monitoreo_scalar(cache$schema, ""), .monitoreo_territorial_report_cache_schema)) {
    cache <- list(schema = .monitoreo_territorial_report_cache_schema, entries = list())
  }
  if (!is.list(cache$entries)) cache$entries <- list()
  cache
}

.monitoreo_territorial_report_payload_size <- function(dashboard) {
  size <- tryCatch({
    public <- .monitoreo_public_dashboard(dashboard, include_reports = TRUE)
    nchar(jsonlite::toJSON(public, auto_unbox = TRUE, null = "null", dataframe = "rows"), type = "bytes")
  }, error = function(e) NA_integer_)
  as.integer(size %||% NA_integer_)
}

.monitoreo_territorial_report_cache_lookup <- function(snapshot, key_info) {
  if (!is.list(snapshot) || !is.list(key_info) || !nzchar(.monitoreo_scalar(key_info$key, ""))) {
    return(NULL)
  }
  cache <- .monitoreo_territorial_report_cache_get(snapshot)
  entry <- cache$entries[[key_info$key]]
  if (!is.list(entry) || !identical(entry$key, key_info$key) || !is.list(entry$dashboard)) {
    return(NULL)
  }
  if (!identical(entry$phase, key_info$phase) ||
      !identical(entry$source_id, key_info$source_id) ||
      !identical(entry$report_scope, key_info$report_scope) ||
      !identical(entry$snapshot_hash, key_info$snapshot_hash) ||
      !identical(entry$route_hash, key_info$route_hash) ||
      !identical(entry$config_hash, key_info$config_hash)) {
    return(NULL)
  }
  entry
}

.monitoreo_territorial_report_cache_prune <- function(entries) {
  if (!is.list(entries) || length(entries) <= .monitoreo_territorial_report_cache_limit) {
    return(entries)
  }
  created <- vapply(entries, function(entry) {
    .monitoreo_scalar(entry$created_at, "")
  }, character(1))
  keep <- names(sort(created, decreasing = TRUE))[seq_len(.monitoreo_territorial_report_cache_limit)]
  entries[keep]
}

.monitoreo_territorial_report_cache_store <- function(snapshot, key_info, dashboard, build_ms = NA_real_, payload_size = NULL) {
  if (!is.list(snapshot) || !is.list(key_info) || !is.list(dashboard)) {
    return(snapshot)
  }
  cache <- .monitoreo_territorial_report_cache_get(snapshot)
  payload_size <- payload_size %||% .monitoreo_territorial_report_payload_size(dashboard)
  entry <- list(
    schema = .monitoreo_territorial_report_cache_schema,
    key = key_info$key,
    phase = key_info$phase,
    source_id = key_info$source_id,
    report_scope = key_info$report_scope,
    snapshot_hash = key_info$snapshot_hash,
    route_hash = key_info$route_hash,
    config_hash = key_info$config_hash,
    dashboard = dashboard,
    build_ms = as.numeric(build_ms %||% NA_real_),
    payload_size = as.integer(payload_size %||% NA_integer_),
    created_at = .monitoreo_now_iso()
  )
  cache$entries[[key_info$key]] <- entry
  cache$entries <- .monitoreo_territorial_report_cache_prune(cache$entries)
  snapshot$territorial_report_cache <- cache
  snapshot
}

.monitoreo_territorial_report_cache_meta <- function(key_info = NULL,
                                                     entry = NULL,
                                                     cache_source = "build",
                                                     cache_hit = FALSE,
                                                     backend_ms = NULL,
                                                     payload_size = NULL) {
  source_entry <- if (is.list(entry)) entry else list()
  source_key <- if (is.list(key_info)) key_info else source_entry
  list(
    schema = .monitoreo_territorial_report_cache_schema,
    status = if (isTRUE(cache_hit)) "hit" else "miss",
    cache_hit = isTRUE(cache_hit),
    cache_source = .monitoreo_scalar(cache_source, "build"),
    key = .monitoreo_scalar(source_key$key, ""),
    phase = .monitoreo_scalar(source_key$phase, ""),
    source_id = .monitoreo_scalar(source_key$source_id, ""),
    report_scope = .monitoreo_scalar(source_key$report_scope, ""),
    snapshot_hash = .monitoreo_scalar(source_key$snapshot_hash, ""),
    route_hash = .monitoreo_scalar(source_key$route_hash, ""),
    config_hash = .monitoreo_scalar(source_key$config_hash, ""),
    backend_ms = as.numeric(backend_ms %||% source_entry$build_ms %||% 0),
    payload_size = as.integer(payload_size %||% source_entry$payload_size %||% NA_integer_),
    created_at = .monitoreo_scalar(source_entry$created_at, "")
  )
}

.monitoreo_territorial_report_cache_merge <- function(snapshot, incoming_cache) {
  if (!is.list(snapshot) || !is.list(incoming_cache) ||
      !identical(.monitoreo_scalar(incoming_cache$schema, ""), .monitoreo_territorial_report_cache_schema)) {
    return(snapshot)
  }
  incoming_entries <- incoming_cache$entries %||% list()
  if (!is.list(incoming_entries) || !length(incoming_entries)) return(snapshot)
  cache <- .monitoreo_territorial_report_cache_get(snapshot)
  for (key in names(incoming_entries)) {
    entry <- incoming_entries[[key]]
    if (!is.list(entry) || !identical(.monitoreo_scalar(entry$schema, ""), .monitoreo_territorial_report_cache_schema)) next
    entry_key <- .monitoreo_scalar(entry$key, key)
    if (!nzchar(entry_key)) next
    cache$entries[[entry_key]] <- entry
  }
  cache$entries <- .monitoreo_territorial_report_cache_prune(cache$entries)
  snapshot$territorial_report_cache <- cache
  snapshot
}

.monitoreo_territorial_map_cache_merge <- function(current_cache, incoming_cache, phase = NULL) {
  if (!is.list(incoming_cache) ||
      !identical(.monitoreo_scalar(incoming_cache$schema, ""), .monitoreo_territorial_map_cache_schema)) {
    return(current_cache %||% .monitoreo_territorial_map_cache_empty())
  }
  out <- current_cache
  if (!is.list(out) || !identical(.monitoreo_scalar(out$schema, ""), .monitoreo_territorial_map_cache_schema)) {
    out <- .monitoreo_territorial_map_cache_empty()
  }
  if (!is.list(out$phases)) out$phases <- list()
  phases <- if (!is.null(phase) && nzchar(.monitoreo_scalar(phase, ""))) {
    .monitoreo_territorial_phase(phase, "pilot")
  } else {
    intersect(names(incoming_cache$phases %||% list()), c("pilot", "field"))
  }
  if (!length(phases)) phases <- c("pilot", "field")
  for (ph in phases) {
    incoming_phase <- incoming_cache$phases[[ph]] %||% list()
    if (!is.list(incoming_phase)) next
    if (!is.list(out$phases[[ph]])) out$phases[[ph]] <- list()
    for (layer in .monitoreo_territorial_map_cache_layers) {
      entry <- incoming_phase[[layer]] %||% NULL
      if (is.list(entry)) out$phases[[ph]][[layer]] <- entry
    }
  }
  out$updated_at <- .monitoreo_scalar(incoming_cache$updated_at, .monitoreo_now_iso())
  out
}

.monitoreo_territorial_prewarm_cache_ready <- function(sid,
                                                       snapshot,
                                                       data,
                                                       cfg,
                                                       phase,
                                                       scopes) {
  empty_plan <- function() list(ready = FALSE, key_infos = list(), cached_entries = list(), map_cache = list())
  if (!is.list(snapshot)) return(empty_plan())
  scopes <- .monitoreo_chr_vec(scopes)
  if (!length(scopes)) return(empty_plan())
  key_infos <- setNames(lapply(scopes, function(scope) {
    .monitoreo_territorial_report_cache_key_info(sid, snapshot, data, cfg, report_scope = scope)
  }), scopes)
  cached_entries <- setNames(lapply(scopes, function(scope) {
    .monitoreo_territorial_report_cache_lookup(snapshot, key_infos[[scope]])
  }), scopes)
  all_reports_cached <- all(vapply(seq_along(scopes), function(idx) {
    is.list(cached_entries[[idx]])
  }, logical(1)))
  if (!isTRUE(all_reports_cached)) {
    return(list(ready = FALSE, key_infos = key_infos, cached_entries = cached_entries, map_cache = list()))
  }

  needs_map <- any(scopes %in% c("route_summary", "advance_summary", "validation_summary", "queries_summary"))
  if (!isTRUE(needs_map)) {
    return(list(ready = TRUE, key_infos = key_infos, cached_entries = cached_entries, map_cache = list(skipped = TRUE)))
  }
  layers <- c("route_geometry", if (any(scopes %in% c("advance_summary", "validation_summary", "queries_summary"))) "gps_points")
  cache <- .monitoreo_territorial_map_cache_get(sid)
  phase_cache <- cache$phases[[.monitoreo_territorial_phase(phase, "pilot")]] %||% list()
  map_ready <- all(vapply(layers, function(layer) {
    entry <- phase_cache[[layer]] %||% NULL
    is.list(entry) && identical(.monitoreo_scalar(entry$status, ""), "valid")
  }, logical(1)))
  list(
    ready = isTRUE(map_ready),
    key_infos = key_infos,
    cached_entries = cached_entries,
    map_cache = list(
      schema = .monitoreo_territorial_map_cache_schema,
      active_route_phase = .monitoreo_territorial_phase(phase, "pilot"),
      cache_hit = isTRUE(map_ready),
      skipped = isTRUE(map_ready)
    )
  )
}

.monitoreo_territorial_prewarm_scopes <- function(sid,
                                                  phase = NULL,
                                                  scopes = NULL,
                                                  progress_path = NULL,
                                                  progress = NULL) {
  report <- if (is.function(progress)) {
    progress
  } else if (!is.null(progress_path)) {
    job_progress_writer(progress_path)
  } else {
    function(...) invisible(NULL)
  }
  s <- session_get(sid)
  snapshot <- s$monitoreo_snapshot %||% NULL
  sources <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
  data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  data <- .monitoreo_apply_source_metadata_to_data(data, sources)
  cfg <- monitoreo_normalize_config(s$monitoreo_config %||% snapshot$config %||% list(), data)
  family <- cfg$monitoreo_profile$family %||% "acreditacion"
  if (!identical(family, "territorial")) {
    stop("El precalentamiento territorial requiere un monitoreo territorial.", call. = FALSE)
  }
  active_phase <- .monitoreo_territorial_phase(phase %||% cfg$territorial$active_route_phase, "pilot")
  cfg$territorial$active_route_phase <- active_phase
  if (is.list(snapshot)) {
    snapshot$config <- cfg
    session_set(sid, "monitoreo_snapshot", snapshot)
  }
  session_set(sid, "monitoreo_config", cfg)

  default_scopes <- c("source", "route_summary", "validation_summary", "queries_summary", "advance_summary")
  scope_vec <- unique(vapply(.monitoreo_chr_vec(scopes %||% default_scopes), .monitoreo_report_scope, character(1)))
  scope_vec <- scope_vec[scope_vec %in% default_scopes]
  if (!length(scope_vec)) scope_vec <- default_scopes
  map_layers_for_scopes <- function(scope_values) {
    scope_values <- .monitoreo_chr_vec(scope_values)
    layers <- character()
    if (any(scope_values %in% c("route_summary", "advance_summary", "validation_summary", "queries_summary"))) {
      layers <- c(layers, "route_geometry")
    }
    if (any(scope_values %in% c("advance_summary", "validation_summary", "queries_summary"))) {
      layers <- c(layers, "gps_points")
    }
    unique(intersect(layers, .monitoreo_territorial_map_cache_layers))
  }
  needed_map_layers <- map_layers_for_scopes(scope_vec)
  scope_labels <- c(
    source = "Fuente",
    route_summary = "Hojas de ruta",
    validation_summary = "Validación",
    queries_summary = "Consultas internas",
    advance_summary = "Avance territorial"
  )
  total <- length(scope_vec)

  report("prepare", current = 0L, total = total, percent = 2, message = "Revisando caché territorial...")
  snapshot <- session_get(sid)$monitoreo_snapshot %||% list()
  display_data <- .monitoreo_territorial_filter_data_for_phase(data, cfg, phase = active_phase)
  key_infos <- setNames(lapply(scope_vec, function(scope) {
    .monitoreo_territorial_report_cache_key_info(sid, snapshot, data, cfg, report_scope = scope)
  }), scope_vec)
  cached_entries <- setNames(lapply(scope_vec, function(scope) {
    .monitoreo_territorial_report_cache_lookup(snapshot, key_infos[[scope]])
  }), scope_vec)
  all_scopes_cached <- all(vapply(cached_entries, is.list, logical(1)))
  existing_map_cache <- .monitoreo_territorial_map_cache_get(sid)
  phase_cache <- existing_map_cache$phases[[active_phase]] %||% list()
  map_cache_ready <- !length(needed_map_layers) || all(vapply(needed_map_layers, function(layer) {
    entry <- phase_cache[[layer]] %||% NULL
    is.list(entry) && identical(.monitoreo_scalar(entry$status, ""), "valid")
  }, logical(1)))
  map_cache <- if (!length(needed_map_layers)) {
    list(
      schema = .monitoreo_territorial_map_cache_schema,
      active_route_phase = active_phase,
      cache_hit = TRUE,
      skipped = TRUE
    )
  } else if (isTRUE(all_scopes_cached) && isTRUE(map_cache_ready)) {
    list(
      schema = .monitoreo_territorial_map_cache_schema,
      active_route_phase = active_phase,
      cache_hit = TRUE,
      skipped = TRUE
    )
  } else {
    report("prepare", current = 0L, total = total, percent = 2, message = "Preparando cache de mapa local...")
    tryCatch(
      .monitoreo_territorial_prepare_map_cache(
        sid,
        cfg,
        data,
        phase = active_phase,
        layers = needed_map_layers,
        force = FALSE
      ),
      error = function(e) list(error = conditionMessage(e))
    )
  }
  snapshot_box <- new.env(parent = emptyenv())
  snapshot_box$value <- snapshot
  shared_scopes <- c("validation_summary", "queries_summary", "advance_summary")
  shared_base_dashboard <- NULL
  shared_base_build_ms <- 0

  set_scope_session_cache <- function(scope, dashboard) {
    if (!is.list(dashboard)) return(invisible(NULL))
    cache_field <- paste("monitoreo_dashboard_cache", scope, sep = "_")
    cache_token_field <- paste("monitoreo_dashboard_cache_token", scope, sep = "_")
    cache_token <- .monitoreo_dashboard_cache_token(snapshot_box$value, display_data, cfg, report_scope = scope)
    s_cache <- session_get(sid)
    s_cache[[cache_field]] <- dashboard
    s_cache[[cache_token_field]] <- cache_token
    .session_env[[sid]] <- s_cache
    invisible(NULL)
  }

  store_scope_dashboard <- function(scope, dashboard, build_ms) {
    payload_size <- .monitoreo_territorial_report_payload_size(dashboard)
    snapshot_box$value <<- .monitoreo_territorial_report_cache_store(
      snapshot_box$value,
      key_infos[[scope]],
      dashboard,
      build_ms = build_ms,
      payload_size = payload_size
    )
    entry <- .monitoreo_territorial_report_cache_lookup(snapshot_box$value, key_infos[[scope]])
    if (is.list(entry) && is.list(entry$dashboard)) {
      set_scope_session_cache(scope, entry$dashboard)
    } else {
      set_scope_session_cache(scope, dashboard)
    }
    list(entry = entry, payload_size = payload_size)
  }

  build_shared_scope_dashboard <- function(scope) {
    base_built <- FALSE
    if (!is.list(shared_base_dashboard)) {
      base_started <- Sys.time()
      shared_base_dashboard <<- .monitoreo_dashboard_for_session(
        sid,
        data,
        cfg,
        include_reports = TRUE,
        report_scope = "prewarm_base"
      )
      shared_base_build_ms <<- .monitoreo_timing_ms(base_started)
      base_built <- TRUE
    }
    if (!is.list(shared_base_dashboard) || !is.list(shared_base_dashboard$territorial_reports)) {
      stop("No se pudo construir la base auditada territorial.", call. = FALSE)
    }
    scoped_dashboard <- shared_base_dashboard
    scoped_dashboard$territorial_reports <- monitoreo_territorial_scope_report(
      shared_base_dashboard$territorial_reports,
      report_scope = scope
    )
    list(
      dashboard = scoped_dashboard,
      build_ms = if (isTRUE(base_built)) shared_base_build_ms else 0L
    )
  }

  results <- vector("list", length(scope_vec))
  names(results) <- scope_vec
  for (idx in seq_along(scope_vec)) {
    scope <- scope_vec[[idx]]
    report(
      "running",
      current = idx,
      total = total,
      percent = round(5 + 90 * (idx - 0.5) / max(total, 1L)),
      message = sprintf("Preparando %s...", scope_labels[[scope]] %||% scope)
    )
    started <- Sys.time()
    item <- tryCatch({
      entry <- cached_entries[[scope]]
      cache_source <- "project"
      cache_hit <- is.list(entry)
      backend_ms <- 0
      payload_size <- as.integer(entry$payload_size %||% NA_integer_)
      if (!is.list(entry)) {
        build_started <- Sys.time()
        built <- if (scope %in% shared_scopes) {
          build_shared_scope_dashboard(scope)
        } else {
          scoped_dashboard <- .monitoreo_dashboard_for_session(
            sid,
            data,
            cfg,
            include_reports = TRUE,
            report_scope = scope
          )
          list(dashboard = scoped_dashboard, build_ms = .monitoreo_timing_ms(build_started))
        }
        stored <- store_scope_dashboard(scope, built$dashboard, built$build_ms)
        entry <- stored$entry
        payload_size <- stored$payload_size
        cache_source <- "build"
        cache_hit <- FALSE
        backend_ms <- built$build_ms
      }
      if (is.list(entry) && is.list(entry$dashboard)) {
        set_scope_session_cache(scope, entry$dashboard)
      }
      list(
        scope = scope,
        status = "ready",
        cache_hit = isTRUE(cache_hit),
        cache_source = cache_source,
        backend_ms = as.numeric(backend_ms %||% .monitoreo_timing_ms(started)),
        total_ms = as.numeric(.monitoreo_timing_ms(started)),
        payload_size = as.integer(payload_size %||% NA_integer_)
      )
    }, error = function(e) {
      list(
        scope = scope,
        status = "error",
        cache_hit = FALSE,
        cache_source = "error",
        backend_ms = as.numeric(.monitoreo_timing_ms(started)),
        total_ms = as.numeric(.monitoreo_timing_ms(started)),
        payload_size = NA_integer_,
        error = conditionMessage(e)
      )
    })
    results[[idx]] <- item
  }
  snapshot <- snapshot_box$value
  if (is.list(snapshot)) {
    snapshot$config <- cfg
    session_set(sid, "monitoreo_snapshot", snapshot)
  }
  report("done", current = total, total = total, percent = 100, message = "Monitoreo territorial listo.")

  s_final <- session_get(sid)
  snapshot_final <- s_final$monitoreo_snapshot %||% list()
  state_light <- tryCatch(.monitoreo_state_payload(sid, include_reports = FALSE), error = function(e) NULL)
  list(
    ok = TRUE,
    phase = active_phase,
    scopes = unname(results),
    map_cache = map_cache,
    state = state_light,
    session_patch = list(
      territorial_report_cache = snapshot_final$territorial_report_cache %||% NULL,
      territorial_map_cache = s_final$monitoreo_territorial_map_cache %||% NULL
    )
  )
}

.monitoreo_territorial_prewarm_job <- function(session_path,
                                               phase = NULL,
                                               scopes = NULL,
                                               progress_path = NULL) {
  s <- readRDS(session_path)
  sid <- .monitoreo_scalar(s$id, "")
  if (!nzchar(sid)) stop("Sesión inválida para precalentar monitoreo territorial.", call. = FALSE)
  .session_env[[sid]] <- s
  .monitoreo_territorial_prewarm_scopes(
    sid,
    phase = phase,
    scopes = scopes,
    progress_path = progress_path
  )
}

.monitoreo_territorial_prewarm_public_result <- function(result) {
  if (!is.list(result)) return(result)
  result$session_patch <- NULL
  result
}

.monitoreo_territorial_map_prepare_job <- function(session_path,
                                                   phase = NULL,
                                                   layers = NULL,
                                                   force = FALSE,
                                                   progress_path = NULL) {
  s <- readRDS(session_path)
  sid <- .monitoreo_scalar(s$id, "")
  if (!nzchar(sid)) stop("Sesion invalida para preparar mapa territorial.", call. = FALSE)
  .session_env[[sid]] <- s
  report <- if (!is.null(progress_path)) job_progress_writer(progress_path) else function(...) invisible(NULL)
  report("prepare", current = 0L, total = 1L, percent = 5, message = "Preparando mapa territorial...")

  snapshot <- s$monitoreo_snapshot %||% NULL
  data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  cfg <- monitoreo_normalize_config(s$monitoreo_config %||% snapshot$config %||% list(), data)
  family <- cfg$monitoreo_profile$family %||% "acreditacion"
  if (!identical(family, "territorial")) {
    stop("La preparacion de mapa requiere un monitoreo territorial.", call. = FALSE)
  }
  active_phase <- .monitoreo_territorial_phase(phase %||% cfg$territorial$active_route_phase, "pilot")
  layer_vec <- intersect(.monitoreo_chr_vec(layers %||% .monitoreo_territorial_map_cache_layers), .monitoreo_territorial_map_cache_layers)
  if (!length(layer_vec)) layer_vec <- .monitoreo_territorial_map_cache_layers

  report("running", current = 1L, total = length(layer_vec), percent = 45, message = "Preparando capas del mapa...")
  meta <- .monitoreo_territorial_prepare_map_cache(
    sid,
    cfg,
    data,
    phase = active_phase,
    layers = layer_vec,
    force = isTRUE(force)
  )
  report("done", current = length(layer_vec), total = length(layer_vec), percent = 100, message = "Mapa territorial listo.")

  s_final <- session_get(sid)
  list(
    ok = TRUE,
    phase = active_phase,
    layers = as.list(layer_vec),
    map_cache = meta,
    session_patch = list(
      territorial_map_cache = s_final$monitoreo_territorial_map_cache %||% NULL
    )
  )
}

attr(.monitoreo_territorial_map_prepare_job, "prosecnur_job_function_name") <- ".monitoreo_territorial_map_prepare_job"

.monitoreo_territorial_map_prepare_public_result <- function(result) {
  if (!is.list(result)) return(result)
  result$session_patch <- NULL
  result
}

.monitoreo_territorial_map_prepare_on_complete <- function(j) {
  result <- j$result_data
  if (!is.list(result)) return(result)
  patch <- result$session_patch %||% list()
  s_current <- session_get(j$sid, required = FALSE)
  if (!is.null(s_current)) {
    incoming_map_cache <- patch$territorial_map_cache %||% NULL
    if (is.list(incoming_map_cache)) {
      merged_map_cache <- .monitoreo_territorial_map_cache_merge(
        s_current$monitoreo_territorial_map_cache %||% list(),
        incoming_map_cache,
        phase = result$phase %||% NULL
      )
      session_set(j$sid, "monitoreo_territorial_map_cache", merged_map_cache)
      tryCatch(.monitoreo_mark_project_dirty_if_open(j$sid), error = function(e) NULL)
    }
  }
  .monitoreo_territorial_map_prepare_public_result(result)
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
  } else if (identical(requested_phase, "field") && is.null(runs$field)) {
    "Campo seleccionado; falta generar o cargar la ruta de campo."
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

.monitoreo_dashboard_for_session <- function(sid, data, cfg, include_reports = TRUE, report_scope = "full", cached_acreditacion_reports = NULL) {
  family <- cfg$monitoreo_profile$family %||% "acreditacion"
  territorial_context <- NULL
  kobo_schema <- NULL
  if (identical(family, "territorial")) {
    phase <- .monitoreo_territorial_phase(cfg$territorial$active_route_phase, "pilot")
    data <- .monitoreo_territorial_filter_data_for_phase(data, cfg, phase = phase)
    territorial_context <- .monitoreo_territorial_context_with_map_cache(
      sid,
      cfg,
      data,
      phase = phase,
      report_scope = report_scope,
      allow_stale = TRUE,
      prepare_missing = isTRUE(include_reports)
    )
    kobo_schema <- .monitoreo_kobo_schema_for_phase(sid, cfg)
  }
  monitoreo_build_dashboard(
    data,
    cfg,
    include_reports = include_reports,
    territorial_context = territorial_context,
    kobo_schema = kobo_schema,
    report_scope = report_scope,
    cached_acreditacion_reports = cached_acreditacion_reports
  )
}

.monitoreo_acreditacion_case_base_actor <- function(item) {
  base_source <- .monitoreo_text_key(item$base_source %||% "")
  if (!nzchar(base_source)) return("")
  actors <- c("administrativos", "docentes", "egresados", "estudiantes")
  hit <- actors[vapply(actors, function(actor) grepl(actor, base_source, fixed = TRUE), logical(1))]
  if (length(hit)) hit[[1]] else ""
}

.monitoreo_acreditacion_cached_case_actor_mismatch <- function(item) {
  if (!is.list(item)) return(FALSE)
  actor <- .monitoreo_text_key(item$actor %||% "")
  base_actor <- .monitoreo_acreditacion_case_base_actor(item)
  if (!nzchar(actor) || !nzchar(base_actor) || identical(actor, base_actor)) return(FALSE)
  identical(.monitoreo_text_key(item$advancement %||% ""), "effective") &&
    identical(.monitoreo_text_key(item$issue_type %||% ""), "efectiva_real")
}

.monitoreo_acreditacion_repair_cached_case <- function(item) {
  if (!.monitoreo_acreditacion_cached_case_actor_mismatch(item)) return(item)
  previous_base_source <- .monitoreo_scalar(item$base_source %||% "", "")
  previous_base_record <- .monitoreo_scalar(item$base_record %||% "", "")
  item$base_result <- "Fuera de base"
  item$base_source <- "Sin base operativa"
  item$base_status <- "Fuera de base"
  item$decision <- "Excluido del avance"
  item$decision_reason <- "La llave cruzaba contra una base de otro actor; queda fuera hasta revisar o decidir incluir con salvedad."
  item$advancement <- "excluded"
  item$issue_type <- "fuera_base"
  item$rule <- "Llave detectada fuera de la base del actor; queda fuera hasta corregir o decidir incluir con salvedad."
  item$pending_exit <- FALSE
  item$base_record <- previous_base_record
  item$cross_actor_base_source <- previous_base_source
  item
}

.monitoreo_acreditacion_group_total <- function(cases, field, fallback, output_field = field) {
  cases <- Filter(is.list, cases %||% list())
  if (!length(cases)) return(list())
  values <- vapply(cases, function(item) {
    value <- .monitoreo_scalar(item[[field]] %||% "", "")
    if (nzchar(value)) value else fallback
  }, character(1))
  values <- unique(values)
  lapply(values, function(value) {
    group_cases <- Filter(function(item) {
      current <- .monitoreo_scalar(item[[field]] %||% "", "")
      if (!nzchar(current)) current <- fallback
      identical(current, value)
    }, cases)
    advancement <- vapply(group_cases, function(item) .monitoreo_scalar(item$advancement %||% "", ""), character(1))
    out <- list(
      total = as.integer(length(group_cases)),
      efectivas = as.integer(sum(advancement == "effective", na.rm = TRUE)),
      parciales = as.integer(sum(advancement == "partial", na.rm = TRUE)),
      rechazos = as.integer(sum(advancement == "refusal", na.rm = TRUE)),
      pendientes = as.integer(sum(advancement == "pending", na.rm = TRUE)),
      revision = as.integer(sum(advancement == "excluded", na.rm = TRUE)),
      salen_de_pendientes = as.integer(sum(vapply(group_cases, function(item) isTRUE(item$pending_exit), logical(1)), na.rm = TRUE))
    )
    c(setNames(list(value), output_field), out)
  })
}

.monitoreo_acreditacion_repair_internal_queries <- function(internal_queries) {
  if (!is.list(internal_queries) || !is.list(internal_queries$cases)) return(internal_queries)
  repaired_cases <- lapply(internal_queries$cases, .monitoreo_acreditacion_repair_cached_case)
  changed <- sum(vapply(seq_along(repaired_cases), function(idx) {
    !identical(repaired_cases[[idx]]$advancement %||% "", internal_queries$cases[[idx]]$advancement %||% "")
  }, logical(1)))
  if (!changed) return(internal_queries)
  internal_queries$cases <- repaired_cases
  internal_queries$totals <- list(
    actor = .monitoreo_acreditacion_group_total(repaired_cases, "actor", "Sin actor"),
    date = .monitoreo_acreditacion_group_total(repaired_cases, "date", "Sin fecha"),
    channel = .monitoreo_acreditacion_group_total(repaired_cases, "channel", "Sin canal"),
    source = .monitoreo_acreditacion_group_total(repaired_cases, "source_label", "Sin fuente", "source"),
    collector = .monitoreo_acreditacion_group_total(repaired_cases, "collector_name", "Sin responsable", "collector")
  )
  internal_queries$cache_repair <- list(
    schema = "monitoreo_acreditacion_internal_queries_cache_repair_v1",
    cross_actor_effectives_reclassified = as.integer(changed)
  )
  internal_queries
}

.monitoreo_acreditacion_repair_cached_dashboard <- function(dashboard) {
  if (!is.list(dashboard) || !is.list(dashboard$acreditacion_reports)) return(dashboard)
  reports <- dashboard$acreditacion_reports
  reports$internal_queries <- .monitoreo_acreditacion_repair_internal_queries(reports$internal_queries %||% list())
  dashboard$acreditacion_reports <- reports
  dashboard
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

.monitoreo_kobo_deployment_detail <- function(asset_uid, token, base_url) {
  uid <- trimws(as.character(asset_uid %||% "")[1])
  if (!nzchar(uid)) stop_api(400, "E_KOBO_ASSET", "Falta asset_uid de Kobo.")
  url <- sprintf(
    "%s/api/v2/assets/%s/deployment/?format=json",
    .kobo_api_trim_base_url(base_url),
    utils::URLencode(uid, reserved = TRUE)
  )
  .kobo_api_fetch_json(url, token)
}

.monitoreo_kobo_resolve_survey_link <- function(asset_uid, token, base_url) {
  uid <- trimws(as.character(asset_uid %||% "")[1])
  base_url <- .kobo_api_trim_base_url(base_url)
  detail <- .monitoreo_kobo_asset_detail(uid, token, base_url)
  deployment <- tryCatch(
    .monitoreo_kobo_deployment_detail(uid, token, base_url),
    error = function(e) list()
  )
  landing_url <- kobo_api_asset_url(uid, base_url = base_url)
  survey_url <- kobo_api_survey_url(uid, base_url = base_url, detail = detail, deployment = deployment)
  if (!nzchar(survey_url)) survey_url <- landing_url
  list(
    ok = TRUE,
    asset_uid = uid,
    name = .monitoreo_scalar(detail$name %||% detail$label %||% detail$title, uid),
    base_url = base_url,
    survey_url = survey_url,
    landing_url = landing_url,
    version_id = .monitoreo_scalar(
      detail$version_id %||%
        detail$deployed_version_id %||%
        detail$deployment__version_id %||%
        deployment$version_id,
      ""
    ),
    deployment_active = isTRUE(
      detail$deployment__active %||%
        detail$deployment_active %||%
        deployment$active %||%
        FALSE
    ),
    resolved_from = if (identical(survey_url, landing_url)) "landing" else "deployment"
  )
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
  all_fields <- list()
  for (row in survey) {
    if (!is.list(row)) next
    name <- row_value(row, "name")
    type <- row_value(row, "type")
    if (!nzchar(name)) next
    list_name <- row_value(row, "select_from_list_name",
      if (grepl("^select_(one|multiple)\\s+", type, perl = TRUE)) sub("^select_(one|multiple)\\s+", "", type, perl = TRUE) else ""
    )
    field <- list(
      name = name,
      xpath = row_value(row, "$xpath", name),
      type = type,
      list_name = list_name,
      label = row_label(row, name)
    )
    if (!grepl("^(begin_|end_|note$)", type)) all_fields[[length(all_fields) + 1L]] <- field
    if (grepl("^(begin_|end_|note$|calculate$)", type)) next
    survey_fields[[length(survey_fields) + 1L]] <- field
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
    all_fields = all_fields,
    choices_by_list = choices_by_list
  )
}

.monitoreo_territorial_occurrences_schema_check <- function(schema) {
  fields <- schema$all_fields %||% schema$survey_fields %||% list()
  schema_key_variants <- function(values) {
    values <- unique(.monitoreo_chr_vec(values))
    out <- character(0)
    add <- function(value) {
      value <- trimws(as.character(value %||% ""))
      if (!nzchar(value)) return()
      value <- gsub("\\\\", "/", value)
      out <<- c(
        out,
        tolower(value),
        .monitoreo_territorial_col_key(value),
        .monitoreo_territorial_col_last_key(value)
      )
      parts <- strsplit(.monitoreo_territorial_col_key(value), "/", fixed = TRUE)[[1]]
      parts <- parts[nzchar(parts)]
      if (length(parts) > 1L) {
        out <<- c(out, parts[[length(parts)]], paste(utils::tail(parts, 2L), collapse = "/"))
      }
    }
    for (value in values) add(value)
    unique(out[nzchar(out)])
  }
  field_candidates <- lapply(fields, function(field) {
    name <- .monitoreo_scalar(field$name, "")
    xpath <- .monitoreo_scalar(field$xpath, "")
    keys <- schema_key_variants(c(name, xpath))
    list(field = field, keys = keys[nzchar(keys)])
  })
  find_field <- function(aliases) {
    wanted <- schema_key_variants(aliases)
    wanted <- wanted[nzchar(wanted)]
    if (!length(wanted)) return(NULL)
    for (candidate in field_candidates) {
      if (any(candidate$keys %in% wanted)) return(candidate$field)
    }
    NULL
  }
  item <- function(key, label, aliases, required = TRUE, note = "") {
    aliases <- .monitoreo_territorial_occurrence_field_aliases(aliases)
    field <- find_field(aliases)
    list(
      key = key,
      label = label,
      required = isTRUE(required),
      ok = !is.null(field),
      found_name = .monitoreo_scalar(field$name, ""),
      found_type = .monitoreo_scalar(field$type, ""),
      expected = as.list(.monitoreo_chr_vec(aliases)),
      note = note
    )
  }
  outcomes <- .monitoreo_territorial_occurrence_outcomes()
  outcome_items <- lapply(outcomes, function(outcome) {
    item(.monitoreo_scalar(outcome$name, ""), .monitoreo_scalar(outcome$label, ""), .monitoreo_scalar(outcome$name, ""))
  })
  outcome_ok <- all(vapply(outcome_items, function(x) isTRUE(x$ok), logical(1)))
  no_effective_total <- item("total_no_efectivas", "Total no efectivas", "total_no_efectivas", required = FALSE, note = "Se puede calcular si todos los estados no efectivos existen.")
  if (!isTRUE(no_effective_total$ok) && isTRUE(outcome_ok)) {
    no_effective_total$ok <- TRUE
    no_effective_total$note <- "Derivable desde los estados no efectivos."
  }
  total_attempts <- item("total_intentos", "Total intentos", "total_intentos", required = FALSE, note = "Se puede calcular con no efectivas + efectivas.")
  if (!isTRUE(total_attempts$ok) && (isTRUE(no_effective_total$ok) || isTRUE(outcome_ok))) {
    effective <- find_field("encuestas_efectivas")
    if (!is.null(effective)) {
      total_attempts$ok <- TRUE
      total_attempts$note <- "Derivable desde no efectivas + encuestas efectivas."
    }
  }
  checks <- c(
    list(
      item("codigo_pulso", "Codigo Pulso", c("codigo_pulso", "cod_pulso", "codigo", "pulso_codigo")),
      item("ump", "UMP", c("ump", "manzana")),
      item("start", "Inicio automatico", c("start", "hora_inicio", "start_time")),
      item("end", "Fin automatico", c("end", "hora_final", "end_time")),
      item("encuestas_efectivas", "Encuestas efectivas", "encuestas_efectivas")
    ),
    outcome_items,
    list(
      no_effective_total,
      total_attempts,
      item("fase", "Fase", "fase", required = FALSE),
      item("observaciones", "Observaciones", "observaciones", required = FALSE)
    )
  )
  missing_required <- vapply(Filter(function(x) isTRUE(x$required) && !isTRUE(x$ok), checks), function(x) .monitoreo_scalar(x$label, ""), character(1))
  required_ok <- !length(missing_required)
  list(
    status = if (isTRUE(required_ok)) "ready" else "missing_required",
    ok = isTRUE(required_ok),
    required_ok = isTRUE(required_ok),
    message = if (isTRUE(required_ok)) "Campos principales listos para sincronizar ocurrencias." else paste("Faltan campos requeridos:", paste(missing_required, collapse = ", ")),
    field_count = as.integer(length(fields)),
    missing_required = as.list(missing_required),
    items = checks
  )
}

.monitoreo_state_payload <- function(sid, include_reports = TRUE, report_scope = "full") {
  started_at <- Sys.time()
  dashboard_source <- "none"
  dashboard_build_ms <- 0L
  territorial_report_cache_info <- NULL
  territorial_report_cache_entry <- NULL
  territorial_report_cache_meta <- NULL
  territorial_report_cache_built <- FALSE
  report_scope <- if (isTRUE(include_reports)) .monitoreo_report_scope(report_scope) else "light"
  s <- session_get(sid)
  sources <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
  snapshot <- s$monitoreo_snapshot %||% NULL
  data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  data <- .monitoreo_apply_source_metadata_to_data(data, sources)
  cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
  family <- cfg$monitoreo_profile$family %||% "acreditacion"
  territorial_light_state <- identical(family, "territorial") && !isTRUE(include_reports)
  display_data <- if (identical(family, "territorial")) .monitoreo_territorial_filter_data_for_phase(data, cfg) else data
  if (isTRUE(include_reports) && identical(family, "territorial") && !identical(report_scope, "light")) {
    territorial_report_cache_info <- .monitoreo_territorial_report_cache_key_info(sid, snapshot %||% list(), data, cfg, report_scope = report_scope)
  }
  cache_token <- .monitoreo_dashboard_cache_token(snapshot %||% list(), display_data, cfg, report_scope = report_scope)
  dashboard <- if (isTRUE(territorial_light_state)) NULL else snapshot$dashboard %||% NULL
  cached_acreditacion_reports <- if (
    isTRUE(include_reports) &&
      family %in% c("acreditacion", "telefonico") &&
      report_scope %in% c("source", "advance_summary", "queries_summary", "phone_summary") &&
      is.list(snapshot) &&
      is.list(snapshot$dashboard) &&
      is.list(snapshot$dashboard$acreditacion_reports) &&
      .monitoreo_snapshot_dashboard_valid(
        snapshot,
        display_data,
        cfg,
        .monitoreo_dashboard_cache_token(snapshot %||% list(), display_data, cfg, report_scope = "full"),
        report_scope = "full"
      )
  ) {
    snapshot$dashboard$acreditacion_reports
  } else {
    NULL
  }
  should_build_dashboard <- !isTRUE(territorial_light_state) && (
    nrow(display_data) > 0L ||
      (isTRUE(include_reports) && identical(family, "territorial"))
  )
  if (isTRUE(should_build_dashboard)) {
    cache_field <- if (isTRUE(include_reports)) paste("monitoreo_dashboard_cache", report_scope, sep = "_") else "monitoreo_dashboard_light_cache"
    cache_token_field <- if (isTRUE(include_reports)) paste("monitoreo_dashboard_cache_token", report_scope, sep = "_") else "monitoreo_dashboard_light_cache_token"
    cache_valid <- !is.null(s[[cache_field]]) &&
      identical(s[[cache_token_field]] %||% NULL, cache_token)
    if (isTRUE(cache_valid)) {
      dashboard <- s[[cache_field]]
      dashboard_source <- "cache"
      if (!is.null(territorial_report_cache_info)) {
        territorial_report_cache_meta <- .monitoreo_territorial_report_cache_meta(
          territorial_report_cache_info,
          cache_source = "session",
          cache_hit = TRUE,
          backend_ms = 0
        )
      }
    } else if (.monitoreo_snapshot_dashboard_valid(snapshot, display_data, cfg, cache_token, report_scope = report_scope)) {
      dashboard <- snapshot$dashboard
      dashboard_source <- "snapshot"
      if (!is.null(territorial_report_cache_info)) {
        territorial_report_cache_meta <- .monitoreo_territorial_report_cache_meta(
          territorial_report_cache_info,
          cache_source = "snapshot",
          cache_hit = TRUE,
          backend_ms = 0,
          payload_size = .monitoreo_territorial_report_payload_size(dashboard)
        )
      }
      s[[cache_field]] <- dashboard
      s[[cache_token_field]] <- cache_token
      .session_env[[sid]] <- s
    } else {
      territorial_report_cache_entry <- .monitoreo_territorial_report_cache_lookup(snapshot %||% list(), territorial_report_cache_info)
      if (!is.null(territorial_report_cache_entry)) {
        dashboard <- territorial_report_cache_entry$dashboard
        dashboard_source <- "project"
        territorial_report_cache_meta <- .monitoreo_territorial_report_cache_meta(
          territorial_report_cache_info,
          territorial_report_cache_entry,
          cache_source = "project",
          cache_hit = TRUE,
          backend_ms = 0
        )
      } else {
        build_started_at <- Sys.time()
        dashboard <- .monitoreo_dashboard_for_session(
          sid,
          data,
          cfg,
          include_reports = include_reports,
          report_scope = report_scope,
          cached_acreditacion_reports = cached_acreditacion_reports
        )
        dashboard_build_ms <- .monitoreo_timing_ms(build_started_at)
        dashboard_source <- "build"
        payload_size <- if (isTRUE(include_reports) && identical(family, "territorial")) {
          .monitoreo_territorial_report_payload_size(dashboard)
        } else {
          NA_integer_
        }
        if (is.list(snapshot)) {
          snapshot$config <- cfg
          if (isTRUE(include_reports) && identical(report_scope, "full")) {
            snapshot$dashboard <- dashboard
            snapshot$dashboard_cache_key <- .monitoreo_dashboard_cache_key
            snapshot$dashboard_cache_token <- cache_token
            snapshot$dashboard_report_scope <- report_scope
          }
          if (!is.null(territorial_report_cache_info)) {
            snapshot <- .monitoreo_territorial_report_cache_store(
              snapshot,
              territorial_report_cache_info,
              dashboard,
              build_ms = dashboard_build_ms,
              payload_size = payload_size
            )
            territorial_report_cache_entry <- .monitoreo_territorial_report_cache_lookup(snapshot, territorial_report_cache_info)
            territorial_report_cache_meta <- .monitoreo_territorial_report_cache_meta(
              territorial_report_cache_info,
              territorial_report_cache_entry,
              cache_source = "build",
              cache_hit = FALSE,
              backend_ms = dashboard_build_ms,
              payload_size = payload_size
            )
            if (report_scope %in% c("source", "route_summary", "advance_summary", "validation_summary", "queries_summary", "full")) {
              territorial_report_cache_built <- TRUE
            }
          }
          session_set(sid, "monitoreo_snapshot", snapshot)
        }
      }
      s <- session_get(sid)
      s[[cache_field]] <- dashboard
      s[[cache_token_field]] <- cache_token
      .session_env[[sid]] <- s
    }
  }
  if (isTRUE(include_reports) && identical(family, "territorial") && report_scope %in% c("queries_summary", "full")) {
    if (is.null(dashboard) || !is.list(dashboard)) dashboard <- list(ok = TRUE)
    if (is.null(dashboard$territorial_reports) || !is.list(dashboard$territorial_reports)) {
      dashboard$territorial_reports <- list()
    }
    dashboard$territorial_reports$field_occurrences <- .monitoreo_territorial_occurrences_dashboard(sid, cfg, dashboard$territorial_reports)
  }
  territorial_phase_coherence <- if (identical(family, "territorial")) {
    .monitoreo_territorial_phase_coherence(
      data = data,
      cfg = cfg,
      sources = sources,
      dashboard = dashboard,
      synced_at = .monitoreo_scalar(snapshot$synced_at, ""),
      errors = snapshot$errors %||% list()
    )
  } else {
    NULL
  }
  if (!is.null(territorial_phase_coherence) && is.list(dashboard)) {
    if (is.null(dashboard$territorial_reports) || !is.list(dashboard$territorial_reports)) {
      dashboard$territorial_reports <- list()
    }
    dashboard$territorial_reports$phase_coherence <- territorial_phase_coherence
  }
  needs_territorial_map_meta <- identical(family, "territorial") &&
    isTRUE(include_reports) &&
    report_scope %in% c("route_summary", "advance_summary", "validation_summary", "queries_summary", "full")
  territorial_map_cache <- if (isTRUE(needs_territorial_map_meta)) {
    .monitoreo_territorial_map_cache_meta(sid, cfg, data)
  } else {
    NULL
  }
  if (!is.null(territorial_map_cache) && is.list(dashboard) && is.list(dashboard$territorial_reports)) {
    dashboard$territorial_reports$map_cache <- territorial_map_cache$active %||% territorial_map_cache
  }
  if (family %in% c("acreditacion", "telefonico")) {
    dashboard <- .monitoreo_acreditacion_repair_cached_dashboard(dashboard)
  }
  if (identical(family, "aulas_universitarias")) {
    aulas_cfg <- cfg$aulas_universitarias %||% monitoreo_aulas_default_config()
    aulas_plan <- s$monitoreo_aulas_plan %||% aulas_cfg$plan %||% list()
    aulas_dashboard <- monitoreo_aulas_dashboard(aulas_plan, display_data, aulas_cfg)
    if (is.null(dashboard) || !is.list(dashboard)) {
      dashboard <- list(ok = TRUE, kpis = list(), progress = data.frame(), production = data.frame(), inconsistencies = data.frame())
    }
    dashboard$aulas_universitarias_reports <- aulas_dashboard
    dashboard$kpis$aulas_total <- aulas_dashboard$kpis$total_aulas %||% 0L
    dashboard$kpis$aulas_aplicadas <- aulas_dashboard$kpis$aulas_aplicadas %||% 0L
    dashboard$kpis$respuestas_validas_aulas <- aulas_dashboard$kpis$respuestas_validas %||% 0L
  }
  .monitoreo_log_timing("state", list(
    family = family,
    scope = report_scope,
    include_reports = if (isTRUE(include_reports)) "1" else "0",
    rows = nrow(display_data),
    dashboard = dashboard_source,
    build_ms = dashboard_build_ms,
    report_cache = territorial_report_cache_meta$cache_source %||% "",
    cache_hit = if (isTRUE(territorial_report_cache_meta$cache_hit)) "1" else "0",
    total_ms = .monitoreo_timing_ms(started_at)
  ))
  if (!is.null(territorial_report_cache_meta)) {
    territorial_report_cache_meta$total_ms <- .monitoreo_timing_ms(started_at)
  }
  if (isTRUE(territorial_report_cache_built)) {
    tryCatch(.monitoreo_mark_project_dirty_if_open(sid), error = function(e) NULL)
  }
  include_snapshot_artifacts <- isTRUE(include_reports) && !identical(family, "territorial")
  list(
    ok = TRUE,
    sources = sources,
    config = cfg,
    monitoreo_profile = cfg$monitoreo_profile %||% monitoreo_normalize_profile(list()),
    has_snapshot = nrow(display_data) > 0L || (identical(family, "aulas_universitarias") && length((cfg$aulas_universitarias %||% list())$plan %||% list()) > 0L),
    synced_at = snapshot$synced_at %||% "",
    generated_at = snapshot$generated_at %||% snapshot$synced_at %||% "",
    generation_version = snapshot$generation_version %||% "",
    generation_status = snapshot$generation_status %||% if (nrow(display_data) > 0L) "stale" else "",
    source_metadata = if (isTRUE(include_snapshot_artifacts)) snapshot$source_metadata %||% NULL else NULL,
    reports = if (isTRUE(include_snapshot_artifacts)) snapshot$reports %||% NULL else NULL,
    chart_models = if (isTRUE(include_snapshot_artifacts)) snapshot$chart_models %||% NULL else NULL,
    sync_errors = snapshot$sync_errors %||% snapshot$errors %||% list(),
    pending_regeneration = isTRUE(snapshot$pending_regeneration),
    n_rows = as.integer(nrow(display_data)),
    variables = if (nrow(display_data)) monitoreo_variables(display_data) else list(),
    dashboard = .monitoreo_public_dashboard(dashboard, include_reports = include_reports),
    territorial_phase_coherence = territorial_phase_coherence,
    territorial_map_cache = territorial_map_cache,
    territorial_report_cache = territorial_report_cache_meta,
    monitoreo_perf = if (!is.null(territorial_report_cache_meta)) list(
      view = "",
      phase = territorial_report_cache_meta$phase,
      source_id = territorial_report_cache_meta$source_id,
      report_scope = territorial_report_cache_meta$report_scope,
      cache_hit = territorial_report_cache_meta$cache_hit,
      cache_source = territorial_report_cache_meta$cache_source,
      backend_ms = territorial_report_cache_meta$backend_ms,
      total_ms = territorial_report_cache_meta$total_ms %||% .monitoreo_timing_ms(started_at),
      payload_size = territorial_report_cache_meta$payload_size
    ) else NULL,
    territorial_update_history = .monitoreo_territorial_history(sid),
    publication = list(
      client_last_sheets = .monitoreo_last_publication_event(s$monitoreo_publication_sheet_events_client %||% list()),
      internal_last_sheets = .monitoreo_last_publication_event(s$monitoreo_publication_sheet_events_internal %||% list())
    ),
    acreditacion = cfg$acreditacion %||% monitoreo_normalize_acreditacion(list()),
    aulas_universitarias = cfg$aulas_universitarias %||% monitoreo_aulas_default_config(),
    errors = snapshot$errors %||% list()
  )
}

.monitoreo_store_config <- function(sid, cfg, rebuild_dashboard = TRUE) {
  s <- session_get(sid)
  snapshot <- s$monitoreo_snapshot %||% NULL
  raw_data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  sources <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
  data <- .monitoreo_apply_source_metadata_to_data(raw_data, sources)
  cfg <- monitoreo_normalize_config(cfg, data)
  session_set(sid, "monitoreo_config", cfg)
  if (isTRUE(rebuild_dashboard) && !is.null(snapshot) && nrow(data)) {
    snapshot$config <- cfg
    snapshot$dashboard <- .monitoreo_dashboard_for_session(sid, data, cfg)
    snapshot$dashboard_cache_key <- .monitoreo_dashboard_cache_key
    snapshot$dashboard_cache_token <- .monitoreo_dashboard_cache_token(snapshot, data, cfg, report_scope = "full")
    snapshot$dashboard_report_scope <- "full"
    if (nzchar(.monitoreo_scalar(snapshot$generated_at, ""))) {
      snapshot$generation_status <- "stale"
      snapshot$pending_regeneration <- TRUE
    }
    session_set(sid, "monitoreo_snapshot", snapshot)
  }
  .monitoreo_invalidate_dashboard_caches(sid)
  cfg
}

.monitoreo_request_config <- function(incoming = NULL, previous = NULL, data = NULL) {
  if (is.null(previous) || !is.list(previous)) previous <- list()
  if (is.null(incoming)) {
    return(monitoreo_normalize_config(previous, data))
  }
  if (!is.list(incoming)) incoming <- list()
  merged <- previous
  if (!is.list(merged)) merged <- list()
  for (nm in names(incoming)) {
    if (identical(nm, "territorial") && is.list(incoming[[nm]]) && is.list(previous$territorial)) {
      tcfg <- previous$territorial
      for (tnm in names(incoming[[nm]])) tcfg[[tnm]] <- incoming[[nm]][[tnm]]
      merged$territorial <- tcfg
    } else if (identical(nm, "monitoreo_territorial") && is.list(incoming[[nm]]) && is.list(previous$territorial)) {
      tcfg <- previous$territorial
      for (tnm in names(incoming[[nm]])) tcfg[[tnm]] <- incoming[[nm]][[tnm]]
      merged$territorial <- tcfg
    } else {
      merged[[nm]] <- incoming[[nm]]
    }
  }
  monitoreo_normalize_config(merged, data, previous_config = previous)
}

.monitoreo_mark_project_dirty_if_open <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(NULL)
  project_path <- .monitoreo_scalar(s$project_path, "")
  if (!nzchar(project_path)) return(NULL)
  session_set(sid, "project_dirty", TRUE)
  NULL
}

.monitoreo_territorial_code_reconciliation_context <- function(tcfg = list()) {
  roster <- tcfg$enumerator_roster %||% list()
  roster_format <- .monitoreo_territorial_code_format(roster$code_format %||% "PXXX")
  assignments <- roster$assignments %||% list()
  if (is.data.frame(assignments)) {
    assignments <- lapply(seq_len(nrow(assignments)), function(i) as.list(assignments[i, , drop = FALSE]))
  }
  if (!is.list(assignments) || !length(assignments)) {
    stop_api(409, "E_ENUMERATOR_ROSTER_EMPTY", "Sube o genera primero la lista de encuestadores con codigos Pulso.")
  }
  assignment_map <- list()
  for (assignment in assignments) {
    if (!is.list(assignment)) next
    code <- .monitoreo_territorial_clean_code(
      assignment$codigo_pulso %||% assignment$codigoPulso %||% assignment$code,
      roster_format
    )
    if (!nzchar(code)) next
    name <- .monitoreo_scalar(
      assignment$nombre %||%
        assignment$name %||%
        assignment$encuestador %||%
        assignment$responsable %||%
        assignment$nombre_completo %||%
        assignment$nombreCompleto,
      code
    )
    assignment_map[[code]] <- name
  }
  list(roster_format = roster_format, assignment_map = assignment_map)
}

.monitoreo_territorial_apply_code_reconciliation <- function(tcfg = list(),
                                                             payload = list(),
                                                             phase = NULL,
                                                             code_context = NULL) {
  if (!is.list(payload)) payload <- list()
  phase <- .monitoreo_territorial_phase(payload$phase %||% payload$fase %||% phase %||% tcfg$active_route_phase, "pilot")
  code_context <- code_context %||% .monitoreo_territorial_code_reconciliation_context(tcfg)
  roster_format <- code_context$roster_format %||% "PXXX"
  assignment_map <- code_context$assignment_map %||% list()
  assigned_code <- .monitoreo_territorial_clean_code(
    payload$assigned_code %||% payload$assignedCode %||% payload$codigo_pulso %||% payload$codigoPulso,
    roster_format
  )
  if (!nzchar(assigned_code)) {
    stop_api(400, "E_ENUMERATOR_RECONCILE_ASSIGNED_CODE", "Falta el codigo Pulso asignado.")
  }
  if (is.null(assignment_map[[assigned_code]])) {
    stop_api(400, "E_ENUMERATOR_RECONCILE_UNKNOWN_CODE", "El codigo Pulso asignado no existe en la lista de encuestadores.")
  }

  raw_code <- .monitoreo_territorial_raw_code(payload$raw_code %||% payload$rawCode %||% payload$raw %||% payload$code)
  normalized_code <- .monitoreo_territorial_clean_code(
    payload$normalized_code %||% payload$normalizedCode %||% payload$normalized %||% raw_code,
    roster_format
  )
  if (!nzchar(normalized_code)) {
    stop_api(400, "E_ENUMERATOR_RECONCILE_RAW_CODE", "Falta el codigo de Kobo que quieres conciliar.")
  }
  if (!nzchar(raw_code)) raw_code <- normalized_code

  scope <- .monitoreo_scalar(payload$scope %||% payload$alcance, "")
  if (identical(scope, "code")) scope <- "code_legacy"
  response_id <- trimws(.monitoreo_scalar(payload$response_id %||% payload$responseId %||% payload$id_respuesta, ""))
  if (!scope %in% c("response", "code_legacy")) {
    scope <- if (nzchar(response_id)) "response" else "code_legacy"
  }
  if (identical(scope, "code_legacy")) response_id <- ""
  if (identical(scope, "response") && !nzchar(response_id)) {
    stop_api(400, "E_ENUMERATOR_RECONCILE_RESPONSE_ID", "Falta response_id para conciliar solo esta respuesta.")
  }

  current <- .monitoreo_territorial_normalize_code_reconciliation(
    tcfg$enumerator_code_reconciliation %||% list(),
    code_format = roster_format,
    active_phase = phase
  )
  phase_entries <- current[[phase]] %||% list()
  entry <- list(
    response_id = response_id,
    response_id_field = if (identical(scope, "response")) .monitoreo_scalar(payload$response_id_field %||% payload$responseIdField, "row_index") else "",
    raw_code = raw_code,
    normalized_code = normalized_code,
    assigned_code = assigned_code,
    assigned_name = .monitoreo_scalar(payload$assigned_name %||% payload$assignedName, assignment_map[[assigned_code]] %||% assigned_code),
    ump = .monitoreo_scalar(payload$ump %||% payload$manzana, ""),
    district = .monitoreo_scalar(payload$district %||% payload$distrito, ""),
    phase = phase,
    note = .monitoreo_scalar(payload$note %||% payload$nota, if (identical(scope, "response")) "Reconciliado manualmente por respuesta" else "Reconciliado manualmente por codigo"),
    created_at = .monitoreo_scalar(payload$created_at %||% payload$createdAt, .monitoreo_now_iso()),
    scope = scope
  )
  phase_entries <- Filter(function(item) {
    if (!is.list(item)) return(FALSE)
    item_response_id <- trimws(.monitoreo_scalar(item$response_id, ""))
    item_normalized <- .monitoreo_territorial_clean_code(item$normalized_code %||% item$raw_code, roster_format)
    if (identical(scope, "response")) {
      return(!identical(item_response_id, response_id))
    }
    nzchar(item_response_id) || !identical(item_normalized, normalized_code)
  }, phase_entries)
  current[[phase]] <- c(phase_entries, list(entry))
  tcfg$active_route_phase <- phase
  tcfg$enumerator_code_reconciliation <- current
  list(tcfg = tcfg, reconciliation = entry, phase = phase)
}

.monitoreo_territorial_ump_reconciliation_context <- function(sid, cfg = list(), phase = "pilot") {
  context <- .monitoreo_territorial_context(sid, cfg, phase = phase)
  route_blocks <- .monitoreo_territorial_block_goal_df(context, include_replacements = TRUE)
  list(route_lookup = .monitoreo_territorial_route_ump_lookup(route_blocks))
}

.monitoreo_territorial_apply_ump_reconciliation <- function(tcfg = list(),
                                                            payload = list(),
                                                            phase = NULL,
                                                            ump_context = NULL) {
  if (!is.list(payload)) payload <- list()
  phase <- .monitoreo_territorial_phase(payload$phase %||% payload$fase %||% phase %||% tcfg$active_route_phase, "pilot")
  raw_ump <- .monitoreo_territorial_raw_ump(payload$raw_ump %||% payload$rawUmp %||% payload$raw %||% payload$ump)
  if (!nzchar(raw_ump)) {
    stop_api(400, "E_TERRITORIAL_UMP_RECONCILE_RAW", "Falta la UMP literal de Kobo que quieres conciliar.")
  }
  assigned_block_id <- .monitoreo_territorial_raw_ump(
    payload$assigned_block_id %||% payload$assignedBlockId %||% payload$id_manzana %||% payload$block_id
  )
  if (!nzchar(assigned_block_id)) {
    stop_api(400, "E_TERRITORIAL_UMP_RECONCILE_BLOCK", "Falta la manzana/UMP de ruta asignada.")
  }
  if (!is.list(ump_context) || !is.list(ump_context$route_lookup)) {
    stop_api(500, "E_TERRITORIAL_UMP_RECONCILE_CONTEXT", "No se pudo preparar la ruta activa para reconciliar UMP.")
  }

  target_ubigeo <- .monitoreo_scalar(payload$assigned_ubigeo %||% payload$assignedUbigeo %||% payload$ubigeo, "")
  target_district <- .monitoreo_scalar(payload$assigned_district %||% payload$assignedDistrict %||% payload$distrito, "")
  route_entries <- ump_context$route_lookup$by_block_literal[[assigned_block_id]] %||% list()
  route_entry <- .monitoreo_territorial_pick_route_entry(
    route_entries,
    target_ubigeo = target_ubigeo,
    target_distrito_key = if (nzchar(target_district)) .monitoreo_safe_name(target_district) else "",
    strict_scope = FALSE
  )
  if (!is.list(route_entry)) {
    stop_api(400, "E_TERRITORIAL_UMP_RECONCILE_UNKNOWN_BLOCK", "La manzana/UMP asignada no existe en la ruta activa.")
  }

  assigned_ump <- .monitoreo_territorial_raw_ump(route_entry$route_ump %||% payload$assigned_ump %||% payload$assignedUmp)
  if (!nzchar(assigned_ump)) {
    stop_api(400, "E_TERRITORIAL_UMP_RECONCILE_ASSIGNED_UMP", "La ruta asignada no tiene UMP disponible.")
  }
  scope <- .monitoreo_scalar(payload$scope %||% payload$alcance, "")
  response_id <- trimws(.monitoreo_scalar(payload$response_id %||% payload$responseId %||% payload$id_respuesta, ""))
  if (!scope %in% c("response", "ump_value")) {
    scope <- if (nzchar(response_id)) "response" else "ump_value"
  }
  if (identical(scope, "ump_value")) response_id <- ""
  if (identical(scope, "response") && !nzchar(response_id)) {
    stop_api(400, "E_TERRITORIAL_UMP_RECONCILE_RESPONSE_ID", "Falta response_id para conciliar solo esta respuesta.")
  }

  current <- .monitoreo_territorial_normalize_ump_reconciliation(
    tcfg$ump_reconciliation %||% list(),
    active_phase = phase
  )
  phase_entries <- current[[phase]] %||% list()
  entry <- list(
    response_id = response_id,
    response_id_field = if (identical(scope, "response")) .monitoreo_scalar(payload$response_id_field %||% payload$responseIdField, "row_index") else "",
    raw_ump = raw_ump,
    assigned_block_id = .monitoreo_scalar(route_entry$id_manzana, assigned_block_id),
    assigned_ump = assigned_ump,
    assigned_district = .monitoreo_scalar(route_entry$distrito, target_district),
    assigned_ubigeo = .monitoreo_scalar(route_entry$ubigeo, target_ubigeo),
    phase = phase,
    note = .monitoreo_scalar(payload$note %||% payload$nota, if (identical(scope, "response")) "Reconciliado manualmente por respuesta" else "Reconciliado manualmente por UMP literal"),
    created_at = .monitoreo_scalar(payload$created_at %||% payload$createdAt, .monitoreo_now_iso()),
    scope = scope
  )
  phase_entries <- Filter(function(item) {
    if (!is.list(item)) return(FALSE)
    item_scope <- .monitoreo_scalar(item$scope, "")
    item_response_id <- trimws(.monitoreo_scalar(item$response_id, ""))
    item_raw <- .monitoreo_territorial_raw_ump(item$raw_ump)
    if (identical(scope, "response")) {
      return(!identical(item_response_id, response_id))
    }
    nzchar(item_response_id) || !identical(item_raw, raw_ump) || identical(item_scope, "response")
  }, phase_entries)
  current[[phase]] <- c(phase_entries, list(entry))
  tcfg$active_route_phase <- phase
  tcfg$ump_reconciliation <- current
  list(tcfg = tcfg, reconciliation = entry, phase = phase)
}

.monitoreo_territorial_dismiss_spatial_reconciliation <- function(tcfg = list(),
                                                                  payload = list(),
                                                                  phase = NULL,
                                                                  scope = "candidate") {
  if (!is.list(payload)) payload <- list()
  if (!is.list(tcfg)) tcfg <- list()
  scope <- .monitoreo_scalar(scope, "candidate")
  if (!scope %in% c("candidate", "pattern")) scope <- "candidate"
  phase <- .monitoreo_territorial_phase(payload$phase %||% payload$fase %||% phase %||% tcfg$active_route_phase, "pilot")
  candidate_id <- .monitoreo_scalar(payload$candidate_id %||% payload$candidateId %||% payload$id, "")
  pattern_key <- .monitoreo_scalar(payload$pattern_key %||% payload$patternKey %||% payload$key, "")
  if (identical(scope, "candidate") && !nzchar(candidate_id)) {
    stop_api(400, "E_TERRITORIAL_SPATIAL_DISMISS_CANDIDATE", "Falta candidate_id para descartar la sugerencia espacial.")
  }
  if (identical(scope, "pattern") && !nzchar(pattern_key)) {
    stop_api(400, "E_TERRITORIAL_SPATIAL_DISMISS_PATTERN", "Falta pattern_key para descartar el patron espacial.")
  }
  evidence_hash <- .monitoreo_scalar(payload$evidence_hash %||% payload$evidenceHash %||% payload$hash, "")
  entry <- list(
    candidate_id = candidate_id,
    pattern_key = pattern_key,
    phase = phase,
    reason = .monitoreo_scalar(payload$reason %||% payload$motivo, "Descartado manualmente"),
    evidence_hash = evidence_hash,
    dismissed_at = .monitoreo_now_iso(),
    scope = scope
  )
  current <- .monitoreo_territorial_normalize_spatial_reconciliation(
    tcfg$spatial_reconciliation %||% list(),
    active_phase = phase
  )
  bucket <- if (identical(scope, "candidate")) "dismissed_candidates" else "dismissed_patterns"
  phase_entries <- current[[phase]][[bucket]] %||% list()
  phase_entries <- Filter(function(item) {
    if (!is.list(item)) return(FALSE)
    if (identical(scope, "candidate")) {
      return(!identical(.monitoreo_scalar(item$candidate_id, ""), candidate_id))
    }
    !identical(.monitoreo_scalar(item$pattern_key, ""), pattern_key)
  }, phase_entries)
  current[[phase]][[bucket]] <- c(phase_entries, list(entry))
  tcfg$active_route_phase <- phase
  tcfg$spatial_reconciliation <- current
  list(tcfg = tcfg, dismissal = entry, phase = phase)
}

.monitoreo_territorial_apply_operational_adjustment <- function(tcfg = list(),
                                                                payload = list(),
                                                                phase = NULL) {
  if (!is.list(payload)) payload <- list()
  if (!is.list(tcfg)) tcfg <- list()
  phase <- .monitoreo_territorial_phase(payload$phase %||% payload$fase %||% phase %||% tcfg$active_route_phase, "field")
  response_ids <- .monitoreo_chr_vec(payload$source_response_ids %||% payload$response_ids %||% payload$responseIds %||% list())
  source_block_id <- .monitoreo_scalar(payload$source_block_id %||% payload$sourceBlockId, "")
  target_block_id <- .monitoreo_scalar(payload$target_block_id %||% payload$targetBlockId, "")
  district <- .monitoreo_scalar(payload$district %||% payload$distrito, "")
  sex <- .monitoreo_scalar(payload$sex %||% payload$sexo, "")
  age_group <- .monitoreo_scalar(payload$age_group %||% payload$ageGroup %||% payload$rango_edad, "")
  count <- .monitoreo_int(payload$count %||% payload$n %||% length(response_ids), 0L)
  if (!nzchar(source_block_id) || !nzchar(target_block_id)) {
    stop_api(400, "E_TERRITORIAL_OPERATIONAL_ADJUSTMENT_BLOCKS", "Falta la manzana origen o destino para la subsanacion operativa.")
  }
  if (identical(.monitoreo_safe_name(source_block_id), .monitoreo_safe_name(target_block_id))) {
    stop_api(400, "E_TERRITORIAL_OPERATIONAL_ADJUSTMENT_SAME_BLOCK", "La subsanacion debe mover excedente hacia otra manzana.")
  }
  if (!nzchar(district) || !nzchar(sex) || !nzchar(age_group)) {
    stop_api(400, "E_TERRITORIAL_OPERATIONAL_ADJUSTMENT_CELL", "La subsanacion requiere distrito, sexo y rango de edad.")
  }
  if (count <= 0L || !length(response_ids)) {
    stop_api(400, "E_TERRITORIAL_OPERATIONAL_ADJUSTMENT_RESPONSES", "La subsanacion necesita al menos una respuesta excedente defendible.")
  }
  current <- .monitoreo_territorial_normalize_operational_adjustments(
    tcfg$operational_adjustments %||% list(),
    active_phase = phase
  )
  active_response_ids <- unique(unlist(lapply(current[[phase]] %||% list(), function(item) {
    if (!identical(.monitoreo_scalar(item$status, "active"), "active")) return(character(0))
    .monitoreo_chr_vec(item$source_response_ids %||% list())
  }), use.names = FALSE))
  active_response_ids <- active_response_ids[nzchar(active_response_ids)]
  duplicated_ids <- intersect(response_ids, active_response_ids)
  if (length(duplicated_ids)) {
    stop_api(409, "E_TERRITORIAL_OPERATIONAL_ADJUSTMENT_DUPLICATE", "Una o mas respuestas ya fueron usadas en otra subsanacion activa.")
  }
  entry <- .monitoreo_territorial_normalize_operational_adjustment_entry(
    modifyList(payload, list(status = "active", phase = phase, source_response_ids = as.list(response_ids), count = count)),
    phase = phase
  )
  if (is.null(entry)) {
    stop_api(400, "E_TERRITORIAL_OPERATIONAL_ADJUSTMENT_INVALID", "No se pudo normalizar la subsanacion operativa.")
  }
  phase_entries <- current[[phase]] %||% list()
  entry_id <- .monitoreo_scalar(entry$id, "")
  same_id <- vapply(phase_entries, function(item) {
    identical(.monitoreo_scalar(item$id, ""), entry_id)
  }, logical(1))
  same_id_reverted <- same_id & vapply(phase_entries, function(item) {
    !identical(.monitoreo_scalar(item$status, "active"), "active")
  }, logical(1))
  if (nzchar(entry_id) && any(same_id_reverted, na.rm = TRUE)) {
    existing_ids <- vapply(phase_entries, function(item) .monitoreo_scalar(item$id, ""), character(1))
    seed <- paste(
      entry_id,
      phase,
      .monitoreo_scalar(entry$source_block_id, ""),
      .monitoreo_scalar(entry$target_block_id, ""),
      paste(.monitoreo_chr_vec(entry$source_response_ids %||% list()), collapse = "|"),
      sep = "::"
    )
    suffix <- substr(digest::digest(seed, algo = "sha1"), 1, 8)
    candidate_id <- paste(entry_id, suffix, sep = "__")
    counter <- 1L
    while (candidate_id %in% existing_ids) {
      counter <- counter + 1L
      candidate_id <- paste(entry_id, suffix, counter, sep = "__")
    }
    entry$original_id <- entry_id
    entry$id <- candidate_id
  }
  phase_entries <- Filter(function(item) {
    !(
      identical(.monitoreo_scalar(item$id, ""), entry_id) &&
        identical(.monitoreo_scalar(item$status, "active"), "active")
    )
  }, phase_entries)
  current[[phase]] <- c(phase_entries, list(entry))
  tcfg$active_route_phase <- phase
  tcfg$operational_adjustments <- current
  list(tcfg = tcfg, adjustment = entry, phase = phase)
}

.monitoreo_territorial_apply_operational_adjustment_package <- function(tcfg = list(),
                                                                        payload = list(),
                                                                        phase = NULL) {
  if (!is.list(payload)) payload <- list()
  adjustments <- payload$adjustments %||% payload$movements %||% payload$componentes %||% list()
  if (!is.list(adjustments) || !length(adjustments)) {
    return(.monitoreo_territorial_apply_operational_adjustment(tcfg, payload, phase = phase))
  }
  phase <- .monitoreo_territorial_phase(payload$phase %||% payload$fase %||% phase %||% tcfg$active_route_phase, "field")
  package_id <- .monitoreo_scalar(payload$id %||% payload$package_id %||% payload$packageId, "")
  if (!nzchar(package_id)) {
    package_seed <- paste(
      phase,
      paste(vapply(adjustments, function(item) {
        if (!is.list(item)) return("")
        paste(
          .monitoreo_scalar(item$source_block_id %||% item$sourceBlockId, ""),
          .monitoreo_scalar(item$target_block_id %||% item$targetBlockId, ""),
          paste(.monitoreo_chr_vec(item$source_response_ids %||% item$response_ids %||% item$responseIds %||% list()), collapse = "|"),
          sep = "::"
        )
      }, character(1)), collapse = "||"),
      sep = "::"
    )
    package_id <- paste0("oppkg_", substr(digest::digest(package_seed, algo = "sha1"), 1, 16))
  }
  package_note <- .monitoreo_scalar(payload$note %||% payload$nota %||% "", "")
  package_reason <- .monitoreo_scalar(payload$reason %||% payload$motivo %||% "Paquete de subsanacion operativa", "Paquete de subsanacion operativa")
  applied_items <- list()
  current_tcfg <- tcfg
  for (idx in seq_along(adjustments)) {
    item <- adjustments[[idx]]
    if (!is.list(item)) next
    item <- modifyList(item, list(
      phase = phase,
      package_id = package_id,
      completion_package = TRUE,
      package_index = as.integer(idx),
      reason = package_reason,
      note = package_note
    ))
    applied <- .monitoreo_territorial_apply_operational_adjustment(current_tcfg, item, phase = phase)
    current_tcfg <- applied$tcfg
    applied_items[[length(applied_items) + 1L]] <- applied$adjustment
  }
  if (!length(applied_items)) {
    stop_api(400, "E_TERRITORIAL_OPERATIONAL_ADJUSTMENT_PACKAGE_EMPTY", "El paquete de subsanacion no contiene movimientos validos.")
  }
  package_entry <- modifyList(payload, list(
    phase = phase,
    status = "active",
    package_id = package_id,
    applied_adjustment_ids = as.list(vapply(applied_items, function(item) .monitoreo_scalar(item$id, ""), character(1))),
    adjustments = applied_items,
    count = as.integer(sum(vapply(applied_items, function(item) .monitoreo_int(item$count, 0L), integer(1)), na.rm = TRUE)),
    note = package_note,
    reason = package_reason
  ))
  list(tcfg = current_tcfg, adjustment = package_entry, adjustments = applied_items, phase = phase)
}

.monitoreo_territorial_reset_operational_adjustments <- function(tcfg = list(),
                                                                 payload = list(),
                                                                 phase = NULL) {
  if (!is.list(tcfg)) tcfg <- list()
  if (!is.list(payload)) payload <- list()
  phase <- .monitoreo_territorial_phase(payload$phase %||% payload$fase %||% phase %||% tcfg$active_route_phase, "field")
  current <- .monitoreo_territorial_normalize_operational_adjustments(
    tcfg$operational_adjustments %||% list(),
    active_phase = phase
  )
  active_before <- sum(vapply(current[[phase]] %||% list(), function(item) {
    identical(.monitoreo_scalar(item$status, "active"), "active")
  }, logical(1)), na.rm = TRUE)
  reset_reason <- .monitoreo_scalar(
    payload$reason %||% payload$motivo,
    "Revertida por reconstruccion de subsanaciones desde excedentes reales"
  )
  reset_at <- .monitoreo_now_iso()
  current[[phase]] <- lapply(current[[phase]] %||% list(), function(item) {
    if (!identical(.monitoreo_scalar(item$status, "active"), "active")) return(item)
    item$status <- "reverted"
    item$reverted_at <- reset_at
    item$revert_reason <- reset_reason
    item
  })
  tcfg$active_route_phase <- phase
  tcfg$operational_adjustments <- current
  list(tcfg = tcfg, phase = phase, active_before = as.integer(active_before))
}

.monitoreo_territorial_revert_operational_adjustment <- function(tcfg = list(),
                                                                 payload = list(),
                                                                 phase = NULL) {
  if (!is.list(payload)) payload <- list()
  if (!is.list(tcfg)) tcfg <- list()
  phase <- .monitoreo_territorial_phase(payload$phase %||% payload$fase %||% phase %||% tcfg$active_route_phase, "field")
  id <- .monitoreo_scalar(payload$id %||% payload$adjustment_id %||% payload$adjustmentId, "")
  if (!nzchar(id)) {
    stop_api(400, "E_TERRITORIAL_OPERATIONAL_ADJUSTMENT_ID", "Falta el identificador de la subsanacion.")
  }
  current <- .monitoreo_territorial_normalize_operational_adjustments(
    tcfg$operational_adjustments %||% list(),
    active_phase = phase
  )
  found <- FALSE
  current[[phase]] <- lapply(current[[phase]] %||% list(), function(item) {
    if (!identical(.monitoreo_scalar(item$id, ""), id)) return(item)
    found <<- TRUE
    item$status <- "reverted"
    item$reverted_at <- .monitoreo_now_iso()
    item$revert_reason <- .monitoreo_scalar(payload$reason %||% payload$motivo, "Revertida desde Consultas")
    item
  })
  if (!found) {
    stop_api(404, "E_TERRITORIAL_OPERATIONAL_ADJUSTMENT_NOT_FOUND", "No se encontro la subsanacion para revertir.")
  }
  tcfg$active_route_phase <- phase
  tcfg$operational_adjustments <- current
  list(tcfg = tcfg, adjustment_id = id, phase = phase)
}

.monitoreo_territorial_annulment_entry_from_payload <- function(tcfg = list(),
                                                                payload = list(),
                                                                phase = NULL,
                                                                require_reason = FALSE) {
  if (!is.list(payload)) payload <- list()
  if (!is.list(tcfg)) tcfg <- list()
  phase <- .monitoreo_territorial_phase(payload$phase %||% payload$fase %||% phase %||% tcfg$active_route_phase, "field")
  scope <- .monitoreo_territorial_production_annulment_scope(payload$scope %||% payload$ambito)
  responsible_label <- .monitoreo_scalar(
    payload$responsible_label %||% payload$responsibleLabel %||% payload$responsible %||% payload$responsable,
    ""
  )
  responsible_key_raw <- .monitoreo_scalar(
    payload$responsible_key %||% payload$responsibleKey %||% payload$responsible_id %||% payload$responsibleId,
    ""
  )
  responsible_key <- .monitoreo_territorial_production_annulment_key(
    if (nzchar(responsible_key_raw)) responsible_key_raw else responsible_label
  )
  response_id <- .monitoreo_scalar(.monitoreo_territorial_production_annulment_response_key(
    payload$response_id %||% payload$responseId %||% payload$uuid %||% payload$`_uuid` %||% payload$id_respuesta
  ), "")
  response_label <- .monitoreo_scalar(payload$response_label %||% payload$responseLabel %||% payload$case_label %||% payload$caso_label, "")
  response_id_field <- .monitoreo_scalar(payload$response_id_field %||% payload$responseIdField %||% payload$campo_uuid, "")
  if (identical(scope, "response") && !nzchar(response_id)) {
    stop_api(400, "E_TERRITORIAL_PRODUCTION_ANNULMENT_RESPONSE", "Ingresa el UUID o ID de respuesta del caso que quieres anular.")
  }
  if (!identical(scope, "response") && !nzchar(responsible_key)) {
    stop_api(400, "E_TERRITORIAL_PRODUCTION_ANNULMENT_RESPONSIBLE", "Selecciona un Responsable Pulso para anular su produccion.")
  }
  reason <- .monitoreo_scalar(payload$reason %||% payload$motivo, "")
  if (isTRUE(require_reason) && !nzchar(trimws(reason))) {
    stop_api(400, "E_TERRITORIAL_PRODUCTION_ANNULMENT_REASON", "La anulacion requiere un motivo obligatorio.")
  }
  if (!identical(scope, "response") && !nzchar(responsible_label)) responsible_label <- responsible_key
  if (identical(scope, "response") && !nzchar(response_label)) response_label <- response_id
  created_at <- .monitoreo_scalar(payload$created_at %||% payload$createdAt, .monitoreo_now_iso())
  entry <- .monitoreo_territorial_normalize_production_annulment_entry(
    modifyList(payload, list(
      status = "active",
      phase = phase,
      scope = scope,
      responsible_key = responsible_key,
      responsible_label = responsible_label,
      response_id = response_id,
      response_id_field = response_id_field,
      response_label = response_label,
      reason = reason,
      created_at = created_at
    )),
    phase = phase
  )
  if (is.null(entry)) {
    stop_api(400, "E_TERRITORIAL_PRODUCTION_ANNULMENT_INVALID", "No se pudo preparar la anulacion.")
  }
  list(entry = entry, phase = phase, scope = scope, responsible_key = responsible_key, response_id = response_id)
}

.monitoreo_territorial_annulment_report_dashboard <- function(sid, data, cfg, report_scope = "validation_summary") {
  .monitoreo_dashboard_for_session(
    sid,
    data,
    cfg,
    include_reports = TRUE,
    report_scope = report_scope
  )
}

.monitoreo_territorial_production_annulment_filter_rows <- function(rows, entry) {
  rows <- .monitoreo_territorial_rows_df(rows)
  if (!nrow(rows)) return(rows)
  scope <- .monitoreo_territorial_production_annulment_scope(entry$scope)
  if (identical(scope, "response")) {
    response_id <- .monitoreo_scalar(entry$response_id, "")
    if (!nzchar(response_id)) return(rows[0, , drop = FALSE])
    candidates <- .monitoreo_territorial_response_candidate_keys(rows)
    keep <- if (length(candidates)) apply(candidates, 1, function(row) any(row %in% response_id)) else rep(FALSE, nrow(rows))
    return(rows[keep, , drop = FALSE])
  }
  key <- .monitoreo_scalar(entry$responsible_key, "")
  if (!nzchar(key)) return(rows[0, , drop = FALSE])
  candidates <- .monitoreo_territorial_responsible_candidate_keys(rows)
  keep <- if (length(candidates)) apply(candidates, 1, function(row) any(row %in% key)) else rep(FALSE, nrow(rows))
  rows[keep, , drop = FALSE]
}

.monitoreo_territorial_production_annulment_block_state <- function(reports = list()) {
  blocks <- .monitoreo_territorial_rows_df(reports$route_quota_progress$blocks %||% reports$block_progress %||% list())
  if (!nrow(blocks)) return(blocks)
  ensure_col <- function(name, default = "") {
    if (!name %in% names(blocks)) blocks[[name]] <<- default
  }
  ensure_col("id_manzana", "")
  ensure_col("ump", "")
  ensure_col("manzana", "")
  ensure_col("distrito", "")
  ensure_col("zona", "")
  ensure_col("tipo_manzana", "")
  ensure_col("responsable", "")
  ensure_col("status", "")
  ensure_col("validas", 0L)
  ensure_col("target", 0L)
  ensure_col("missing_total", 0L)
  blocks
}

.monitoreo_territorial_production_annulment_impact <- function(before_dashboard = list(),
                                                              after_dashboard = list(),
                                                              entry = list()) {
  before_reports <- before_dashboard$territorial_reports %||% list()
  after_reports <- after_dashboard$territorial_reports %||% list()
  rows <- .monitoreo_territorial_production_annulment_filter_rows(after_reports$production_annulments$rows %||% list(), entry)
  response_ids <- unique(as.character(rows$response_id %||% ""))
  response_ids <- response_ids[nzchar(response_ids)]
  umps <- unique(.monitoreo_territorial_annulment_ump(rows))
  umps <- umps[nzchar(umps)]
  row_block_keys <- .monitoreo_territorial_annulment_block(rows)
  block_ids <- unique(row_block_keys)
  block_ids <- block_ids[nzchar(block_ids)]
  before_blocks <- .monitoreo_territorial_production_annulment_block_state(before_reports)
  after_blocks <- .monitoreo_territorial_production_annulment_block_state(after_reports)
  block_row <- function(df, id) {
    if (!is.data.frame(df) || !nrow(df)) return(list())
    ids <- as.character(df$id_manzana %||% "")
    hit <- which(ids %in% id)
    if (!length(hit)) return(list())
    as.list(df[hit[[1]], , drop = FALSE])
  }
  block_impact <- lapply(block_ids, function(id) {
    before <- block_row(before_blocks, id)
    after <- block_row(after_blocks, id)
    row_hit <- rows[row_block_keys %in% id, , drop = FALSE]
    has_route_state <- length(before) > 0L || length(after) > 0L
    list(
      id_manzana = id,
      ump = .monitoreo_scalar(.monitoreo_territorial_annulment_format_ump(before$ump %||% after$ump %||% .monitoreo_territorial_annulment_ump(row_hit)[[1]] %||% "")[[1]], ""),
      manzana = .monitoreo_scalar(before$manzana %||% after$manzana %||% .monitoreo_territorial_annulment_manzana(row_hit)[[1]] %||% "", ""),
      distrito = .monitoreo_scalar(before$distrito %||% after$distrito %||% .monitoreo_territorial_annulment_district(row_hit)[[1]] %||% "", ""),
      tipo_manzana = .monitoreo_scalar(before$tipo_manzana %||% after$tipo_manzana %||% "", ""),
      responsable = .monitoreo_scalar(before$responsable %||% after$responsable %||% row_hit$responsible_display[[1]] %||% "", ""),
      respuestas_anuladas = as.integer(nrow(row_hit)),
      validas_anuladas = as.integer(sum(row_hit$source_effective %in% TRUE, na.rm = TRUE)),
      estado_antes = .monitoreo_scalar(before$status %||% if (!has_route_state) "sin_cruce_ruta" else "", ""),
      estado_despues = .monitoreo_scalar(after$status %||% if (!has_route_state) "sin_cruce_ruta" else "", ""),
      validas_antes = as.integer(.monitoreo_int(before$validas %||% 0L, 0L)),
      validas_despues = as.integer(.monitoreo_int(after$validas %||% 0L, 0L)),
      meta = as.integer(.monitoreo_int(before$target %||% after$target %||% 0L, 0L)),
      brecha_despues = as.integer(.monitoreo_int(after$missing_total %||% 0L, 0L))
    )
  })
  list(
    schema = "territorial.production_annulment_impact.v1",
    scope = .monitoreo_territorial_production_annulment_scope(entry$scope),
    responsible_key = .monitoreo_scalar(entry$responsible_key, ""),
    responsible_label = .monitoreo_scalar(entry$responsible_label, ""),
    response_id = .monitoreo_scalar(entry$response_id, ""),
    response_label = .monitoreo_scalar(entry$response_label, ""),
    responses_excluded = as.integer(length(response_ids)),
    valid_responses_excluded = as.integer(sum(rows$source_effective %in% TRUE, na.rm = TRUE)),
    umps_affected = as.integer(length(umps)),
    blocks_affected = as.integer(length(block_ids)),
    before = list(
      total_responses = as.integer(before_reports$kpis$total_respuestas %||% 0L),
      valid_responses = as.integer(before_reports$kpis$validas %||% 0L),
      progress_pct = before_reports$kpis$avance_pct %||% NA_real_
    ),
    after = list(
      total_responses = as.integer(after_reports$kpis$total_respuestas %||% 0L),
      valid_responses = as.integer(after_reports$kpis$validas %||% 0L),
      progress_pct = after_reports$kpis$avance_pct %||% NA_real_
    ),
    blocks = block_impact,
    rows = .monitoreo_df_records(rows)
  )
}

.monitoreo_territorial_preview_production_annulment <- function(sid, payload = list()) {
  s <- session_get(sid)
  snapshot <- s$monitoreo_snapshot %||% NULL
  data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
  tcfg <- cfg$territorial %||% monitoreo_territorial_default_config(data)
  prepared <- .monitoreo_territorial_annulment_entry_from_payload(tcfg, payload, require_reason = FALSE)
  current <- .monitoreo_territorial_normalize_production_annulments(
    tcfg$production_annulments %||% list(),
    active_phase = prepared$phase
  )
  preview_entry <- prepared$entry
  preview_identity <- if (identical(prepared$scope, "response")) prepared$response_id else prepared$responsible_key
  preview_entry$id <- paste0("preview_", substr(digest::digest(paste(prepared$phase, prepared$scope, preview_identity, Sys.time()), algo = "sha1"), 1, 12))
  preview_entry$impact <- list()
  current[[prepared$phase]] <- c(current[[prepared$phase]] %||% list(), list(preview_entry))
  cfg_after <- cfg
  cfg_after$territorial$active_route_phase <- prepared$phase
  cfg_after$territorial$production_annulments <- current
  before_dashboard <- .monitoreo_territorial_annulment_report_dashboard(sid, data, cfg, report_scope = "validation_summary")
  after_dashboard <- .monitoreo_territorial_annulment_report_dashboard(sid, data, cfg_after, report_scope = "validation_summary")
  impact <- .monitoreo_territorial_production_annulment_impact(before_dashboard, after_dashboard, preview_entry)
  list(
    ok = TRUE,
    annulment_id = preview_entry$id,
    impact = impact,
    production_annulments = after_dashboard$territorial_reports$production_annulments %||% list()
  )
}

.monitoreo_territorial_apply_production_annulment <- function(sid, payload = list()) {
  s <- session_get(sid)
  snapshot <- s$monitoreo_snapshot %||% NULL
  data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
  tcfg <- cfg$territorial %||% monitoreo_territorial_default_config(data)
  prepared <- .monitoreo_territorial_annulment_entry_from_payload(tcfg, payload, require_reason = TRUE)
  current <- .monitoreo_territorial_normalize_production_annulments(
    tcfg$production_annulments %||% list(),
    active_phase = prepared$phase
  )
  active_duplicate <- any(vapply(current[[prepared$phase]] %||% list(), function(item) {
    if (!identical(.monitoreo_scalar(item$status, ""), "active")) return(FALSE)
    item_scope <- .monitoreo_territorial_production_annulment_scope(item$scope)
    if (!identical(item_scope, prepared$scope)) return(FALSE)
    if (identical(prepared$scope, "response")) {
      return(identical(.monitoreo_scalar(item$response_id, ""), prepared$response_id))
    }
    identical(.monitoreo_scalar(item$responsible_key, ""), prepared$responsible_key)
  }, logical(1)))
  if (isTRUE(active_duplicate)) {
    duplicate_message <- if (identical(prepared$scope, "response")) "Ese caso ya tiene una anulacion activa." else "Ese Responsable Pulso ya tiene una anulacion activa."
    stop_api(409, "E_TERRITORIAL_PRODUCTION_ANNULMENT_DUPLICATE", duplicate_message)
  }
  before_dashboard <- .monitoreo_territorial_annulment_report_dashboard(sid, data, cfg, report_scope = "validation_summary")
  if (identical(prepared$scope, "response")) {
    already_annulled_rows <- .monitoreo_territorial_production_annulment_filter_rows(
      before_dashboard$territorial_reports$production_annulments$rows %||% list(),
      prepared$entry
    )
    if (nrow(already_annulled_rows)) {
      stop_api(409, "E_TERRITORIAL_PRODUCTION_ANNULMENT_DUPLICATE", "Ese caso ya esta excluido por una anulacion activa.")
    }
  }
  cfg_after <- cfg
  current[[prepared$phase]] <- c(current[[prepared$phase]] %||% list(), list(prepared$entry))
  cfg_after$territorial$active_route_phase <- prepared$phase
  cfg_after$territorial$production_annulments <- current
  after_dashboard <- .monitoreo_territorial_annulment_report_dashboard(sid, data, cfg_after, report_scope = "validation_summary")
  impact <- .monitoreo_territorial_production_annulment_impact(before_dashboard, after_dashboard, prepared$entry)
  if (identical(prepared$scope, "response") && .monitoreo_int(impact$responses_excluded, 0L) < 1L) {
    stop_api(404, "E_TERRITORIAL_PRODUCTION_ANNULMENT_RESPONSE_NOT_FOUND", "No se encontro ese UUID en la auditoria territorial vigente.")
  }
  prepared$entry$impact <- impact
  current[[prepared$phase]][[length(current[[prepared$phase]])]] <- prepared$entry
  cfg$territorial$active_route_phase <- prepared$phase
  cfg$territorial$production_annulments <- current
  cfg$territorial <- monitoreo_territorial_normalize_config(cfg$territorial, data)
  cfg <- .monitoreo_store_config(sid, cfg, rebuild_dashboard = FALSE)
  .monitoreo_territorial_invalidate_map_cache(sid, phase = prepared$phase, layers = "gps_points", reason = "production_annulment_apply")
  saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
  list(
    ok = TRUE,
    annulment_id = prepared$entry$id,
    impact = impact,
    annulment = prepared$entry,
    config = cfg,
    state = .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = "validation_summary"),
    saved_project = !is.null(saved_project)
  )
}

.monitoreo_territorial_revert_production_annulment <- function(sid, payload = list()) {
  if (!is.list(payload)) payload <- list()
  s <- session_get(sid)
  snapshot <- s$monitoreo_snapshot %||% NULL
  data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
  tcfg <- cfg$territorial %||% monitoreo_territorial_default_config(data)
  phase <- .monitoreo_territorial_phase(payload$phase %||% payload$fase %||% tcfg$active_route_phase, "field")
  id <- .monitoreo_scalar(payload$id %||% payload$annulment_id %||% payload$annulmentId, "")
  if (!nzchar(id)) {
    stop_api(400, "E_TERRITORIAL_PRODUCTION_ANNULMENT_ID", "Falta el identificador de la anulacion.")
  }
  current <- .monitoreo_territorial_normalize_production_annulments(
    tcfg$production_annulments %||% list(),
    active_phase = phase
  )
  found <- FALSE
  current[[phase]] <- lapply(current[[phase]] %||% list(), function(item) {
    if (!identical(.monitoreo_scalar(item$id, ""), id)) return(item)
    found <<- TRUE
    item$status <- "reverted"
    item$reverted_at <- .monitoreo_now_iso()
    item$reverted_by <- "local"
    item$revert_reason <- .monitoreo_scalar(payload$reason %||% payload$motivo, "Revertida desde Anulacion")
    item
  })
  if (!found) {
    stop_api(404, "E_TERRITORIAL_PRODUCTION_ANNULMENT_NOT_FOUND", "No se encontro la anulacion para revertir.")
  }
  cfg$territorial$active_route_phase <- phase
  cfg$territorial$production_annulments <- current
  cfg$territorial <- monitoreo_territorial_normalize_config(cfg$territorial, data)
  cfg <- .monitoreo_store_config(sid, cfg, rebuild_dashboard = FALSE)
  .monitoreo_territorial_invalidate_map_cache(sid, phase = phase, layers = "gps_points", reason = "production_annulment_revert")
  saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
  state <- .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = "validation_summary")
  list(
    ok = TRUE,
    annulment_id = id,
    impact = list(schema = "territorial.production_annulment_revert.v1", restored = TRUE),
    config = cfg,
    state = state,
    saved_project = !is.null(saved_project)
  )
}

.monitoreo_territorial_batch_failure <- function(client_id, kind, err) {
  code <- if (inherits(err, "api_error")) err$code %||% "E_RECONCILIATION_BATCH_ITEM" else "E_RECONCILIATION_BATCH_ITEM"
  list(
    client_id = .monitoreo_scalar(client_id, ""),
    kind = .monitoreo_scalar(kind, ""),
    code = .monitoreo_scalar(code, "E_RECONCILIATION_BATCH_ITEM"),
    message = conditionMessage(err)
  )
}

.monitoreo_territorial_apply_reconciliation_batch <- function(tcfg = list(),
                                                              changes = list(),
                                                              sid = NULL,
                                                              cfg = list(),
                                                              ump_context_builder = NULL) {
  if (!is.list(changes) || !length(changes)) {
    stop_api(400, "E_TERRITORIAL_RECONCILIATION_BATCH_EMPTY", "No hay reconciliaciones pendientes para aplicar.")
  }
  if (!is.list(tcfg)) tcfg <- list()
  if (!is.list(cfg)) cfg <- list()
  applied <- list()
  failed <- list()
  changed_phases <- character()
  code_context <- NULL
  ump_contexts <- list()
  build_ump_context <- ump_context_builder
  if (is.null(build_ump_context)) {
    build_ump_context <- function(phase, current_tcfg, current_cfg) {
      cfg_for_context <- current_cfg
      if (!is.list(cfg_for_context)) cfg_for_context <- list()
      cfg_for_context$territorial <- current_tcfg
      .monitoreo_territorial_ump_reconciliation_context(sid, cfg_for_context, phase = phase)
    }
  }

  for (i in seq_along(changes)) {
    change <- changes[[i]]
    if (!is.list(change)) change <- list()
    kind <- .monitoreo_scalar(change$kind %||% change$type, "")
    client_id <- .monitoreo_scalar(change$client_id %||% change$clientId %||% change$id, sprintf("change-%s", i))
    payload <- change$reconciliation %||% change$payload %||% list()
    if (!is.list(payload)) payload <- list()

    item <- tryCatch({
      if (identical(kind, "code")) {
        if (is.null(code_context)) {
          code_context <- .monitoreo_territorial_code_reconciliation_context(tcfg)
        }
        result <- .monitoreo_territorial_apply_code_reconciliation(tcfg, payload, code_context = code_context)
      } else if (identical(kind, "ump")) {
        phase <- .monitoreo_territorial_phase(payload$phase %||% payload$fase %||% tcfg$active_route_phase, "pilot")
        if (is.null(ump_contexts[[phase]])) {
          ump_contexts[[phase]] <- build_ump_context(phase, tcfg, cfg)
        }
        result <- .monitoreo_territorial_apply_ump_reconciliation(tcfg, payload, phase = phase, ump_context = ump_contexts[[phase]])
      } else {
        stop_api(400, "E_TERRITORIAL_RECONCILIATION_BATCH_KIND", "Tipo de reconciliacion no soportado en el lote.")
      }
      list(ok = TRUE, result = result)
    }, api_error = function(e) {
      list(ok = FALSE, failure = .monitoreo_territorial_batch_failure(client_id, kind, e))
    }, error = function(e) {
      list(ok = FALSE, failure = .monitoreo_territorial_batch_failure(client_id, kind, e))
    })

    if (isTRUE(item$ok)) {
      tcfg <- item$result$tcfg
      phase <- item$result$phase
      changed_phases <- unique(c(changed_phases, phase))
      applied[[length(applied) + 1L]] <- list(
        client_id = client_id,
        kind = kind,
        reconciliation = item$result$reconciliation
      )
    } else {
      failed[[length(failed) + 1L]] <- item$failure
    }
  }

  list(
    tcfg = tcfg,
    applied = applied,
    failed = failed,
    changed_phases = unique(changed_phases)
  )
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
    if (!nzchar(source$asset_uid)) stop_api(400, "E_KOBO_ASSET", "Falta asset_uid de Kobo.")
    base_url <- .monitoreo_scalar(source$base_url, "")
    if (!nzchar(base_url)) base_url <- .connections_profile_base_url("kobo", profile_id)
    if (!nzchar(base_url)) base_url <- kobo_api_default_base_url()
    token <- .connections_token_require("kobo", sid, profile_id = profile_id, base_url = base_url)
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
    declared_person_code_var = parsed$declared_person_code_var %||%
      parsed$declaredPersonCodeVar %||%
      parsed$declared_pucp_code_var %||%
      parsed$declaredPucpCodeVar %||%
      parsed$codigo_pucp_var %||%
      parsed$codigoPucpVar %||%
      "",
    declared_person_code_label = parsed$declared_person_code_label %||%
      parsed$declaredPersonCodeLabel %||%
      parsed$declared_pucp_code_label %||%
      parsed$declaredPucpCodeLabel %||%
      parsed$codigo_pucp_label %||%
      parsed$codigoPucpLabel %||%
      "",
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

.monitoreo_source_match <- function(sources, source) {
  if (!is.list(sources) || !is.list(source)) return(NULL)
  source_id <- .monitoreo_scalar(source$id, "")
  survey_id <- .monitoreo_scalar(source$survey_id, "")
  for (candidate in sources) {
    if (!is.list(candidate)) next
    same_id <- nzchar(source_id) && identical(.monitoreo_scalar(candidate$id, ""), source_id)
    same_survey <- nzchar(survey_id) && identical(.monitoreo_scalar(candidate$survey_id, ""), survey_id)
    if (isTRUE(same_id) || isTRUE(same_survey)) return(candidate)
  }
  NULL
}

.monitoreo_preserve_source_operational_metadata <- function(source, previous = NULL) {
  if (!is.list(source) || !is.list(previous)) return(source)
  source$created_at <- .monitoreo_scalar(previous$created_at, source$created_at %||% .monitoreo_now_iso())
  if (!nzchar(.monitoreo_scalar(source$last_sync_at, ""))) {
    source$last_sync_at <- .monitoreo_scalar(previous$last_sync_at, "")
  }
  if (!nzchar(.monitoreo_scalar(source$last_sync_mode, ""))) {
    source$last_sync_mode <- .monitoreo_scalar(previous$last_sync_mode %||% previous$lastSyncMode, "")
  }
  if (!nzchar(.monitoreo_scalar(source$declared_person_code_var, ""))) {
    source$declared_person_code_var <- .monitoreo_scalar(
      previous$declared_person_code_var %||%
        previous$declaredPersonCodeVar %||%
        previous$declared_pucp_code_var %||%
        previous$declaredPucpCodeVar %||%
        previous$codigo_pucp_var %||%
        previous$codigoPucpVar,
      ""
    )
  }
  if (!nzchar(.monitoreo_scalar(source$declared_person_code_label, ""))) {
    source$declared_person_code_label <- .monitoreo_scalar(
      previous$declared_person_code_label %||%
        previous$declaredPersonCodeLabel %||%
        previous$declared_pucp_code_label %||%
        previous$declaredPucpCodeLabel %||%
        previous$codigo_pucp_label %||%
        previous$codigoPucpLabel,
      ""
    )
  }
  if (!length(source$sync_cursor %||% list())) {
    source$sync_cursor <- .monitoreo_normalize_sync_cursor(previous$sync_cursor %||% previous$syncCursor)
  }
  if (!length(source$collectors %||% list())) {
    source$collectors <- .monitoreo_normalize_source_collectors(
      previous$collectors %||% previous$survey_collectors %||% previous$surveyCollectors
    )
  }
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

.monitoreo_territorial_source_id_for_asset <- function(asset_uid, phase, sources = list(), current = NULL) {
  if (is.list(current) && nzchar(.monitoreo_scalar(current$id, ""))) {
    return(.monitoreo_scalar(current$id, ""))
  }
  base <- paste("kobo", .monitoreo_safe_name(asset_uid), sep = "_")
  if (!nzchar(base) || identical(base, "kobo_")) base <- paste("kobo", phase, uuid::UUIDgenerate(), sep = "_")
  sources <- monitoreo_normalize_sources(sources)
  ids <- vapply(sources, function(src) .monitoreo_scalar(src$id, ""), character(1))
  idx <- match(base, ids)
  if (!is.na(idx) && is.finite(idx) && idx > 0L) {
    existing_phase <- .monitoreo_source_territorial_phase(sources[[idx]])
    if (!identical(existing_phase, phase)) {
      return(paste(base, phase, sep = "_"))
    }
  }
  base
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
  publication_family <- detect_monitoreo_family(config = cfg, data = snapshot$data)
  engine_family <- .monitoreo_publication_engine_family(publication_family)
  if (identical(engine_family, "territorial")) {
    dashboard <- snapshot$dashboard %||% NULL
    reports <- if (is.list(dashboard)) dashboard$territorial_reports %||% list() else list()
    if (!length(reports) || is.null(reports$advance)) {
      dashboard <- monitoreo_build_dashboard(
        snapshot$data,
        cfg,
        include_reports = TRUE,
        report_scope = "advance_summary"
      )
    }
    model <- monitoreo_publication_model(
      snapshot$data,
      cfg,
      audience = "internal",
      include_targets = include_targets,
      dashboard = dashboard,
      synced_at = snapshot$synced_at %||% "",
      context = list(family = publication_family)
    )
    model$report_kind <- "territorial_advance_pdf"
    return(model)
  }
  dashboard <- snapshot$dashboard %||% NULL
  reports <- if (is.list(dashboard)) dashboard$acreditacion_reports %||% list() else list()
  model <- reports$client_report %||% NULL
  if (is.null(model) || !is.list(model) || !length(model$actors %||% list())) {
    model <- monitoreo_acreditacion_client_report_model(snapshot$data, cfg)
  }
  model$sheets <- monitoreo_acreditacion_client_report_sheets(model, include_targets = isTRUE(include_targets))
  model$report_kind <- "acreditacion_client_report_pdf"
  model
}

.monitoreo_production_report_model_for_snapshot <- function(snapshot, cfg, include_targets = FALSE) {
  if (is.null(snapshot) || !is.data.frame(snapshot$data) || !nrow(snapshot$data)) {
    stop_api(409, "E_NO_MONITOREO_DATA", "Sincroniza datos antes de generar el reporte de producción.")
  }
  cfg <- monitoreo_normalize_config(cfg, snapshot$data)
  publication_family <- detect_monitoreo_family(config = cfg, data = snapshot$data)
  dashboard <- snapshot$dashboard %||% NULL
  if (is.null(dashboard) || !is.list(dashboard)) {
    dashboard <- monitoreo_build_dashboard(
      snapshot$data,
      cfg,
      include_reports = TRUE,
      report_scope = .monitoreo_publication_report_scope(publication_family, "internal")
    )
  }
  model <- monitoreo_publication_model(
    snapshot$data,
    cfg,
    audience = "internal",
    include_targets = include_targets,
    dashboard = dashboard,
    synced_at = snapshot$synced_at %||% "",
    context = list(family = publication_family)
  )
  model$report_kind <- "production_report_pdf"
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

.monitoreo_territorial_occurrences_history <- function(sid) {
  s <- session_get(sid)
  raw <- s$monitoreo_territorial_occurrences_history %||% list()
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

.monitoreo_territorial_occurrences_history_add <- function(sid, entry) {
  if (!is.list(entry)) entry <- list()
  now <- .monitoreo_now_iso()
  clean <- list(
    id = .monitoreo_scalar(entry$id, paste0("occurrences-", as.integer(Sys.time()), "-", sample.int(999999L, 1L))),
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
  history <- c(list(clean), .monitoreo_territorial_occurrences_history(sid))
  if (length(history) > 50L) history <- history[seq_len(50L)]
  session_set(sid, "monitoreo_territorial_occurrences_history", history)
  invisible(history)
}

.monitoreo_territorial_occurrences_dashboard <- function(sid, cfg, territorial_reports = NULL) {
  s <- session_get(sid)
  cfg <- monitoreo_normalize_config(cfg %||% s$monitoreo_config %||% list())
  tcfg <- cfg$territorial$field_occurrences %||% list()
  phase <- .monitoreo_scalar(tcfg$route_phase %||% "field", "field")
  if (!phase %in% c("pilot", "field")) phase <- "field"
  context <- .monitoreo_territorial_context(sid, cfg, phase = phase)
  if (is.null(territorial_reports) || !is.list(territorial_reports)) {
    snapshot_main <- s$monitoreo_snapshot %||% list()
    main_data <- if (is.list(snapshot_main) && is.data.frame(snapshot_main$data)) snapshot_main$data else data.frame()
    territorial_reports <- if (nrow(main_data)) {
      tryCatch(monitoreo_territorial_reportes(main_data, cfg, list(phase = phase)), error = function(e) NULL)
    } else {
      NULL
    }
  }
  if (is.list(territorial_reports)) {
    context$reports <- territorial_reports
  }
  snapshot <- s$monitoreo_territorial_occurrences_snapshot %||% list()
  data <- if (is.list(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  report <- monitoreo_territorial_occurrences_report(data, cfg, context)
  report$snapshot <- list(
    synced_at = .monitoreo_scalar(snapshot$synced_at, ""),
    n_rows = as.integer(nrow(data)),
    source_id = .monitoreo_scalar(snapshot$source_id, .monitoreo_scalar(tcfg$source_id, "")),
    asset_uid = .monitoreo_scalar(snapshot$asset_uid, .monitoreo_scalar(tcfg$asset_uid, ""))
  )
  report$history <- .monitoreo_territorial_occurrences_history(sid)
  report
}

# ---------------------------------------------------------------------------
# Export xlsx de UMPs (ocurrencias): estados por UMP + hoja por responsable,
# con filtros por "faltantes" (sin reporte) y por responsable. Formato agradable.
# ---------------------------------------------------------------------------
.MONITOREO_UMP_MISSING_STATES <- c(
  "sin_reporte", "iniciada_sin_reporte", "incompleta_sin_reporte", "completa_sin_reporte"
)

.monitoreo_ump_estado_label <- function(estado) {
  switch(as.character(estado %||% ""),
    sin_reporte = "Sin reporte",
    iniciada_sin_reporte = "Iniciada sin reporte",
    incompleta_sin_reporte = "Incompleta sin reporte",
    completa_sin_reporte = "Completa sin reporte",
    revisar_cruce = "Revisar cruce",
    reportada_no_efectiva = "Reportada (no efectiva)",
    reportada_efectiva = "Reportada (efectiva)",
    .monitoreo_scalar(estado, "")
  )
}

.monitoreo_ump_export_rows <- function(by_ump, only_missing = FALSE, responsable = "", distrito = "") {
  if (is.null(by_ump) || !length(by_ump)) return(data.frame())
  responsable <- trimws(.monitoreo_scalar(responsable, ""))
  distrito <- trimws(.monitoreo_scalar(distrito, ""))
  keep <- Filter(function(it) {
    # Solo las UMP DETERMINADAS (universo de ruta, las 150). Excluye reemplazos y
    # UMP fuera de ruta (una UMP cubierta por su reemplazo aparece en su slot titular).
    if (isTRUE(it$outside)) return(FALSE)
    if (identical(.monitoreo_scalar(it$route_match_status, ""), "ump_no_esperada")) return(FALSE)
    tiene <- isTRUE(it$has_report)
    if (isTRUE(only_missing) && tiene) return(FALSE)
    if (nzchar(responsable) && !identical(trimws(.monitoreo_scalar(it$responsable, "")), responsable)) return(FALSE)
    if (nzchar(distrito) && !identical(trimws(tolower(.monitoreo_scalar(it$distrito, ""))), tolower(distrito))) return(FALSE)
    TRUE
  }, by_ump)
  if (!length(keep)) return(data.frame())
  do.call(rbind, lapply(keep, function(it) {
    tiene <- isTRUE(it$has_report)
    data.frame(
      Distrito = .monitoreo_scalar(it$distrito, ""),
      UMP = .monitoreo_scalar(it$ump, .monitoreo_scalar(it$key, "")),
      Responsable = .monitoreo_scalar(it$responsable, "Sin responsable"),
      `¿Tiene ocurrencias?` = if (tiene) "Sí" else "No",
      Fecha = if (tiene) .monitoreo_scalar(it$ultimo_reporte, "") else "",
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  }))
}

.monitoreo_ump_export_write_workbook <- function(ump_df, path, meta = list()) {
  wb <- openxlsx::createWorkbook()
  sheet <- "UMP"
  openxlsx::addWorksheet(wb, sheet)
  title_style <- openxlsx::createStyle(fontSize = 14, textDecoration = "bold", fontColour = "#17212F")
  meta_style <- openxlsx::createStyle(fontSize = 9, fontColour = "#5F6B7A")
  header_style <- openxlsx::createStyle(
    textDecoration = "bold", fgFill = "#BE123C", fontColour = "#FFFFFF",
    border = "TopBottomLeftRight", borderColour = "#E2E7F0",
    halign = "left", valign = "center", wrapText = TRUE
  )
  yes_style <- openxlsx::createStyle(fgFill = "#DCFCE7", fontColour = "#166534", textDecoration = "bold", halign = "center")
  no_style <- openxlsx::createStyle(fgFill = "#FEE2E2", fontColour = "#991B1B", textDecoration = "bold", halign = "center")

  openxlsx::writeData(wb, sheet, "UMP determinadas y su estado de ocurrencias", startRow = 1, startCol = 1)
  openxlsx::addStyle(wb, sheet, title_style, rows = 1, cols = 1, stack = TRUE)
  if (length(meta)) {
    meta_txt <- paste(vapply(names(meta), function(k) sprintf("%s: %s", k, meta[[k]]), character(1)), collapse = "   ·   ")
    openxlsx::writeData(wb, sheet, meta_txt, startRow = 2, startCol = 1)
    openxlsx::addStyle(wb, sheet, meta_style, rows = 2, cols = 1, stack = TRUE)
  }
  header_row <- 4L
  if (!nrow(ump_df)) {
    openxlsx::writeData(wb, sheet, "Sin UMP para los filtros seleccionados.", startRow = header_row, startCol = 1)
    openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
    return(invisible(path))
  }
  n_cols <- ncol(ump_df)
  openxlsx::writeData(wb, sheet, ump_df, startRow = header_row, startCol = 1, headerStyle = header_style)
  openxlsx::freezePane(wb, sheet, firstActiveRow = header_row + 1L)
  # Autofiltro en los encabezados de la tabla.
  openxlsx::addFilter(wb, sheet, rows = header_row, cols = seq_len(n_cols))
  openxlsx::setColWidths(wb, sheet, cols = seq_len(n_cols), widths = c(22, 16, 34, 20, 22)[seq_len(n_cols)])
  # Color condicional en "¿Tiene ocurrencias?": verde = tiene, rojo = no.
  oc_col <- which(names(ump_df) == "¿Tiene ocurrencias?")
  if (length(oc_col)) {
    yes_rows <- which(ump_df[[oc_col]] == "Sí")
    no_rows <- which(ump_df[[oc_col]] == "No")
    if (length(yes_rows)) openxlsx::addStyle(wb, sheet, yes_style, rows = header_row + yes_rows, cols = oc_col, gridExpand = TRUE, stack = TRUE)
    if (length(no_rows)) openxlsx::addStyle(wb, sheet, no_style, rows = header_row + no_rows, cols = oc_col, gridExpand = TRUE, stack = TRUE)
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  invisible(path)
}

.monitoreo_ump_export <- function(sid, parsed = list()) {
  if (!is.list(parsed)) parsed <- list()
  s <- session_get(sid)
  main_data <- (s$monitoreo_snapshot %||% list())$data %||% data.frame()
  cfg <- monitoreo_normalize_config(parsed$config %||% s$monitoreo_config %||% list(), main_data)
  family <- .monitoreo_scalar(cfg$monitoreo_profile$family, "")
  if (!identical(family, "territorial")) {
    stop_api(400, "E_MONITOREO_UMP_EXPORT_FAMILY", "El export de UMPs esta disponible para Monitoreo territorial.")
  }
  report <- .monitoreo_territorial_occurrences_dashboard(sid, cfg)
  by_ump <- report$by_ump %||% list()
  if (!length(by_ump)) {
    stop_api(409, "E_MONITOREO_UMP_EXPORT_EMPTY", "No hay UMPs para exportar. Sincroniza las ocurrencias de campo primero.")
  }
  only_missing <- isTRUE(parsed$only_missing %||% parsed$onlyMissing %||% parsed$faltantes)
  responsable <- .monitoreo_scalar(parsed$responsable, "")
  distrito <- .monitoreo_scalar(parsed$distrito, "")
  ump_df <- .monitoreo_ump_export_rows(by_ump, only_missing = only_missing, responsable = responsable, distrito = distrito)

  dir.create(file.path(s$dir, "downloads"), showWarnings = FALSE, recursive = TRUE)
  project <- .monitoreo_publication_project_label(parsed, s, cfg)
  project_slug <- .monitoreo_publication_evidence_slug(project, "monitoreo")
  suffix <- if (only_missing) "faltantes" else if (nzchar(responsable)) "responsable" else "determinadas"
  out_name <- paste0(paste(project_slug, "umps", suffix, sep = "-"), ".xlsx")
  out_path <- file.path(s$dir, "downloads", sprintf("%s_%s", uuid::UUIDgenerate(), out_name))
  sin_oc <- if (nrow(ump_df)) sum(ump_df[["¿Tiene ocurrencias?"]] == "No") else 0L
  meta <- list(
    Universo = if (only_missing) "Solo faltantes (sin ocurrencias)" else "UMP determinadas",
    Responsable = if (nzchar(responsable)) responsable else "Todos",
    UMP = nrow(ump_df),
    Corte = .monitoreo_scalar((report$snapshot %||% list())$synced_at, "")
  )
  .monitoreo_ump_export_write_workbook(ump_df, out_path, meta = meta)
  file_meta <- .register_output_file(sid, "monitoreo_ump_export", out_path, original_name = out_name)
  list(
    ok = TRUE,
    file_id = file_meta$file_id,
    filename = file_meta$original_name,
    size = file_meta$size,
    counts = list(
      ump = as.integer(nrow(ump_df)),
      sin_ocurrencias = as.integer(sin_oc)
    ),
    filters = list(only_missing = only_missing, responsable = responsable, distrito = distrito)
  )
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

.monitoreo_snapshot_first_text <- function(data, aliases, source_id = "", collector_id = "") {
  aliases <- unique(.monitoreo_chr_vec(aliases))
  aliases <- aliases[nzchar(aliases)]
  if (is.null(data) || !is.data.frame(data) || !nrow(data) || !length(aliases)) return("")
  for (column in intersect(aliases, names(data))) {
    values <- as.character(.monitoreo_snapshot_values(data, column, source_id, collector_id))
    values <- trimws(values[!is.na(values) & nzchar(trimws(values))])
    if (length(values)) return(values[[1]])
  }
  ""
}

.monitoreo_collector_label_is_technical <- function(value, collector_id = "") {
  value <- trimws(.monitoreo_scalar(value, ""))
  collector_id <- trimws(.monitoreo_scalar(collector_id, ""))
  label <- tolower(iconv(value, to = "ASCII//TRANSLIT", sub = ""))
  id <- tolower(iconv(collector_id, to = "ASCII//TRANSLIT", sub = ""))
  if (!nzchar(label)) return(TRUE)
  if (nzchar(id) && identical(label, id)) return(TRUE)
  if (grepl("^\\d{5,}$", label)) return(TRUE)
  if (grepl("^(id\\s*)?(collector|colector|recopilador|enlace|link|web link)\\s*[:#-]?\\s*\\d{4,}$", label)) return(TRUE)
  if (grepl("^(collector|colector|recopilador)\\s*[:#-]?\\s*[a-z0-9_-]{5,}$", label) && grepl("\\d", label)) return(TRUE)
  if (grepl("^recopilador\\s+.+\\s*[·.-]\\s*(correo|whatsapp|telefonico|ficha\\s*qr|qr|sms|mixto|web)$", label)) return(TRUE)
  FALSE
}

.monitoreo_best_collector_name <- function(primary, fallback = "", collector_id = "") {
  primary <- trimws(.monitoreo_scalar(primary, ""))
  fallback <- trimws(.monitoreo_scalar(fallback, ""))
  collector_id <- trimws(.monitoreo_scalar(collector_id, ""))
  if (nzchar(primary) && !.monitoreo_collector_label_is_technical(primary, collector_id)) return(primary)
  if (nzchar(fallback) && !.monitoreo_collector_label_is_technical(fallback, collector_id)) return(fallback)
  if (nzchar(primary)) return(primary)
  fallback
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

.monitoreo_public_collector_source_channel <- function(source) {
  dims <- source$dimensions %||% list()
  channel <- .monitoreo_scalar(
    dims$canal %||% dims$channel %||% dims$modalidad %||% source$channel %||% source$canal,
    ""
  )
  if (nzchar(channel)) return(channel)
  text <- .monitoreo_text_key(paste(source$label %||% "", source$survey_id %||% ""))
  if (grepl("whatsapp", text)) return("WhatsApp")
  if (grepl("telefon|phone", text)) return("Telefónico")
  if (grepl("qr|presencial|ficha", text)) return("Ficha QR")
  if (grepl("sms", text)) return("SMS")
  if (grepl("correo|email|mail|web|online", text)) return("Correo")
  ""
}

.monitoreo_public_collector_modality_from_channel <- function(channel) {
  key <- .monitoreo_text_key(channel)
  if (grepl("whatsapp", key)) return("whatsapp")
  if (grepl("sms", key)) return("sms")
  if (grepl("telefon", key)) return("telefono")
  if (grepl("qr|presencial|ficha", key)) return("presencial")
  if (grepl("correo|email|mail|web|online", key)) return("email")
  "mixto"
}

.monitoreo_public_collector <- function(source, collector, detail, recipient_summary, saved, data) {
  detail <- detail %||% list()
  saved <- saved %||% list()
  collector_id <- .monitoreo_scalar(detail$id %||% collector$id %||% collector$collector_id, "")
  collector_type <- tolower(.monitoreo_scalar(detail$type %||% collector$type, ""))
  raw_collector_name <- .monitoreo_scalar(
    detail$name %||%
      detail$title %||%
      detail$collector_name %||%
      detail$display_name %||%
      detail$nickname %||%
      collector$name %||%
      collector$title %||%
      collector$collector_name %||%
      collector$display_name %||%
      collector$nickname,
    ""
  )
  saved_collector_name <- .monitoreo_scalar(saved$collector_name %||% saved$label %||% saved$nombre, "")
  collector_name <- .monitoreo_best_collector_name(raw_collector_name, saved_collector_name, collector_id)
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
  channel <- .monitoreo_scalar(saved$channel %||% saved$canal, "")
  source_channel <- .monitoreo_public_collector_source_channel(source)
  if (!nzchar(channel)) {
    channel <- source_channel
  }
  if (!nzchar(channel)) {
    channel <- switch(modality, email = "Correo", whatsapp = "WhatsApp", sms = "SMS", telefono = "Telefónico", presencial = "Ficha QR", "Mixto")
  }
  if (identical(modality, "mixto") && nzchar(source_channel)) {
    modality <- .monitoreo_public_collector_modality_from_channel(channel)
  }
  enabled <- .monitoreo_bool(saved$enabled %||% saved$activo %||% saved$included %||% saved$incluido, TRUE)
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
    enabled = enabled,
    channel = channel,
    operational_use = configured_use,
    configured_use = configured_use,
    suggested_use = suggested_use,
    modality = modality,
    roster_required = roster_required,
    response_count = if (is.finite(response_count)) as.integer(response_count) else 0L,
    active_response_count = active_response_count,
    url_present = url_present,
    recipient_summary = recipient_summary,
    metadata_source = "surveymonkey_sync",
    warnings = as.list(unique(warnings))
  )
}

monitoreo_sync_job_runner <- function(sources_path,
                                      cfg_path,
                                      connection_tokens_path = NULL,
                                      since = NULL,
                                      sid = NULL,
                                      sync_mode = "full",
                                      progress_path = NULL) {
  sources <- readRDS(sources_path)
  cfg <- readRDS(cfg_path)
  sync_mode <- .monitoreo_sync_mode(sync_mode)
  connection_tokens <- if (!is.null(connection_tokens_path) && file.exists(connection_tokens_path)) {
    readRDS(connection_tokens_path)
  } else {
    list()
  }
  sync_fun <- if (exists("monitoreo_sync_sources", mode = "function")) {
    monitoreo_sync_sources
  } else {
    getFromNamespace("monitoreo_sync_sources", "prosecnurapp")
  }
  sync_args <- list(
    sources = sources,
    config = cfg,
    since = since,
    progress_path = progress_path,
    build_dashboard = FALSE
  )
  sync_formals <- tryCatch(names(formals(sync_fun)), error = function(e) character(0))
  if ("sid" %in% sync_formals) sync_args$sid <- sid
  if ("connection_tokens" %in% sync_formals) sync_args$connection_tokens <- connection_tokens
  if ("sync_mode" %in% sync_formals) sync_args$sync_mode <- sync_mode
  do.call(sync_fun, sync_args)
}

monitoreo_client_report_pdf_job_runner <- function(model_path,
                                                   include_targets = FALSE,
                                                   result_path = NULL,
                                                   progress_path = NULL) {
  report <- if (!is.null(progress_path)) job_progress_writer(progress_path) else function(...) invisible(NULL)
  report("prepare", percent = 15, message = "Preparando reporte...")
  model <- readRDS(model_path)
  report_kind <- .monitoreo_scalar(model$report_kind, "")
  family <- .monitoreo_publication_family_key(model$family %||% "")
  if (identical(report_kind, "territorial_advance_pdf") || identical(family, "territorial")) {
    report("render", percent = 55, message = "Renderizando avance territorial...")
    monitoreo_territorial_advance_report_pdf(model, result_path, include_targets = include_targets)
  } else {
    report("render", percent = 55, message = "Renderizando PDF ejecutivo...")
    monitoreo_acreditacion_client_report_pdf(model, result_path, include_targets = include_targets)
  }
  report("export", percent = 95, message = "Guardando PDF...")
  list(ok = TRUE, size = as.numeric(file.info(result_path)$size %||% 0), filename = basename(result_path))
}

monitoreo_production_report_pdf_job_runner <- function(model_path,
                                                       include_targets = FALSE,
                                                       report_title = NULL,
                                                       result_path = NULL,
                                                       progress_path = NULL) {
  report <- if (!is.null(progress_path)) job_progress_writer(progress_path) else function(...) invisible(NULL)
  report("prepare", percent = 15, message = "Preparando producción...")
  model <- readRDS(model_path)
  report("render", percent = 55, message = "Renderizando PDF de producción...")
  title <- .monitoreo_scalar(report_title %||% model$display_title %||% "", "")
  monitoreo_production_report_pdf(model, result_path, title = if (nzchar(title)) title else NULL)
  report("export", percent = 95, message = "Guardando PDF...")
  list(ok = TRUE, size = as.numeric(file.info(result_path)$size %||% 0), filename = basename(result_path))
}

.monitoreo_fetch_surveymonkey_collectors_for_source <- function(sid, source) {
  if (!identical(.monitoreo_scalar(source$kind, ""), "surveymonkey")) return(list())
  survey_id <- .monitoreo_scalar(source$survey_id, "")
  if (!nzchar(survey_id)) return(list())
  base_url <- .monitoreo_scalar(source$base_url, "https://api.surveymonkey.com/v3")
  profile_id <- .monitoreo_scalar(source$connection_profile_id %||% source$profile_id, "")
  token_candidates <- tryCatch(
    .monitoreo_surveymonkey_token_candidates(
      sid = sid,
      preferred_profile_id = profile_id,
      connection_token = ""
    ),
    error = function(e) list()
  )
  for (candidate in token_candidates) {
    token <- .monitoreo_scalar(candidate$token, "")
    if (!nzchar(token)) next
    fetched <- tryCatch({
      collectors <- sm_api_fetch_collectors(survey_id, token, base_url = base_url)
      out <- list()
      for (collector in collectors$data %||% list()) {
        collector_id <- .monitoreo_scalar(collector$id %||% collector$collector_id, "")
        if (!nzchar(collector_id)) next
        detail <- tryCatch(
          sm_api_fetch_collector_detail(collector_id, token, base_url = base_url),
          error = function(e) collector
        )
        out[[collector_id]] <- list(
          id = collector_id,
          collector_id = collector_id,
          name = .monitoreo_scalar(
            detail$name %||% detail$title %||% detail$collector_name %||% detail$collectorName %||%
              detail$display_name %||% detail$displayName %||% detail$nickname %||%
              collector$name %||% collector$title %||% collector$collector_name %||% collector$collectorName %||%
              collector$display_name %||% collector$displayName %||% collector$nickname,
            ""
          ),
          type = .monitoreo_scalar(detail$type %||% detail$collector_type %||% detail$collectorType %||% collector$type, ""),
          url = .monitoreo_scalar(detail$url %||% collector$url %||% detail$href %||% collector$href, ""),
          response_count = as.integer(.monitoreo_num(detail$response_count %||% collector$response_count, 0)),
          synced_at = .monitoreo_now_iso()
        )
      }
      .monitoreo_normalize_source_collectors(unname(out))
    }, error = function(e) NULL)
    if (is.list(fetched) && length(fetched)) return(fetched)
  }
  list()
}

.monitoreo_hydrate_missing_surveymonkey_collectors <- function(sid, sources, synced_source_ids = character(0), sync_summary = list()) {
  sources <- monitoreo_normalize_sources(sources)
  if (!length(sources)) return(sources)
  synced_source_ids <- as.character(synced_source_ids %||% character(0))
  for (i in seq_along(sources)) {
    source <- sources[[i]]
    source_id <- .monitoreo_scalar(source$id, "")
    if (!identical(.monitoreo_scalar(source$kind, ""), "surveymonkey")) next
    if (length(synced_source_ids) && !source_id %in% synced_source_ids) next
    summary <- (sync_summary %||% list())[[source_id]] %||% list()
    if (identical(.monitoreo_scalar(summary$mode, ""), "advance")) next
    if (length(.monitoreo_normalize_source_collectors(source$collectors %||% list()))) next
    collectors <- .monitoreo_fetch_surveymonkey_collectors_for_source(sid, source)
    if (length(collectors)) sources[[i]]$collectors <- collectors
  }
  sources
}

.monitoreo_acreditacion_apply_case_reconciliation <- function(data, config = list(), payload = list()) {
  if (!is.list(payload)) payload <- list()
  response_id <- .monitoreo_scalar(payload$response_id %||% payload$responseId, "")
  action <- .monitoreo_scalar(payload$action %||% payload$accion, "")
  if (!nzchar(response_id)) stop_api(400, "E_MONITOREO_RESPONSE_ID", "Falta response_id para guardar la decision.")
  if (!action %in% c("keep_excluded", "include_with_caveat")) {
    stop_api(400, "E_MONITOREO_DECISION_ACTION", "action debe ser keep_excluded o include_with_caveat.")
  }
  if (!is.data.frame(data) || !nrow(data)) {
    stop_api(409, "E_MONITOREO_NO_SNAPSHOT", "No hay snapshot local de monitoreo para auditar el caso.")
  }

  cfg <- monitoreo_normalize_config(config %||% list(), data)
  profile <- cfg$monitoreo_profile %||% monitoreo_normalize_profile(list())
  queries <- .monitoreo_acreditacion_internal_queries(data, profile)
  cases <- queries$cases %||% list()
  hits <- Filter(function(item) identical(.monitoreo_scalar(item$response_id, ""), response_id), cases)
  if (!length(hits)) stop_api(404, "E_MONITOREO_CASE_NOT_FOUND", "No se encontro el response_id en los casos del corte.")
  item <- hits[[1]]
  assisted <- item$assisted_review %||% list()
  reviewable_case <- .monitoreo_text_key(item$base_result %||% "") %in% c("sin cruce", "sin llave") ||
    .monitoreo_text_key(item$issue_type %||% "") %in% c("fuera_base", "sin_llave", "incluido_con_salvedad")
  if (!isTRUE(assisted$eligible) && is.null(assisted$manual_decision) && !isTRUE(reviewable_case)) {
    stop_api(409, "E_MONITOREO_CASE_NOT_REVIEWABLE", "Este caso no tiene evidencia secundaria para revision asistida.")
  }

  note <- .monitoreo_scalar(payload$note %||% payload$nota, "")
  candidate_id <- .monitoreo_scalar(payload$candidate_id %||% payload$candidateId %||% payload$assigned_case_key, "")
  selected <- NULL
  if (identical(action, "include_with_caveat")) {
    state_key <- .monitoreo_text_key(item$platform_state %||% "")
    if (!state_key %in% c("completa", "parcial")) {
      stop_api(409, "E_MONITOREO_CASE_NOT_VALIDATABLE", "Solo una respuesta completa o parcial revisable puede incluirse con salvedad en el avance.")
    }
    if (!nzchar(candidate_id)) stop_api(400, "E_MONITOREO_CANDIDATE_REQUIRED", "Selecciona una persona del universo para incluir con salvedad.")
    candidates <- c(assisted$candidates %||% list(), assisted$assignment_candidates %||% list())
    matches <- Filter(function(candidate) {
      identical(.monitoreo_scalar(candidate$candidate_id, ""), candidate_id) ||
        identical(.monitoreo_scalar(candidate$case_key, ""), candidate_id)
    }, candidates)
    if (!length(matches)) stop_api(400, "E_MONITOREO_CANDIDATE_INVALID", "La coincidencia seleccionada ya no existe en el universo actual.")
    selected <- matches[[1]]
    if (isTRUE(.monitoreo_bool(selected$already_effective %||% selected$already_answered, FALSE))) {
      stop_api(409, "E_MONITOREO_CANDIDATE_ALREADY_ANSWERED", "La persona seleccionada ya tiene una respuesta reconciliada; selecciona una persona pendiente del universo.")
    }
    warnings <- .monitoreo_chr_vec(assisted$warnings %||% list())
    has_contradiction <- any(grepl("codigo declarado no coincide|código declarado no coincide", .monitoreo_text_key(warnings)))
    selected_evidence_level <- .monitoreo_scalar(selected$evidence_level, "")
    manual_assignment <- identical(.monitoreo_scalar(selected$match_type, ""), "manual_pending") ||
      selected_evidence_level %in% c("", "manual")
    weak_assignment <- selected_evidence_level %in% c("possible")
    partial_assignment <- identical(state_key, "parcial")
    if ((isTRUE(partial_assignment) || isTRUE(has_contradiction) || isTRUE(manual_assignment) || isTRUE(weak_assignment)) && !nzchar(note)) {
      stop_api(400, "E_MONITOREO_NOTE_REQUIRED", "Agrega una nota para incluir con salvedad cuando la asignacion no nace de una coincidencia exacta o cuando codigo y correo se contradicen.")
    }
  }

  recon <- profile$reconciliation_decisions %||% list()
  include_ids <- unique(.monitoreo_chr_vec(recon$include_response_ids))
  exclude_ids <- unique(.monitoreo_chr_vec(recon$exclude_response_ids))
  if (identical(action, "include_with_caveat")) {
    include_ids <- unique(c(include_ids, response_id))
    exclude_ids <- setdiff(exclude_ids, response_id)
  } else {
    include_ids <- setdiff(include_ids, response_id)
    exclude_ids <- unique(c(exclude_ids, response_id))
  }
  manual <- .monitoreo_normalize_manual_case_reconciliations(recon$manual_case_reconciliations %||% list())
  decision <- list(
    response_id = response_id,
    actor = .monitoreo_scalar(item$actor, ""),
    action = action,
    declared_code = .monitoreo_scalar(assisted$declared_code, ""),
    declared_email = .monitoreo_scalar(assisted$declared_email, ""),
    assigned_person_label = if (is.null(selected)) "" else .monitoreo_scalar(selected$person_label, ""),
    assigned_case_key = if (is.null(selected)) "" else .monitoreo_scalar(selected$case_key, ""),
    assigned_base_source = if (is.null(selected)) "" else .monitoreo_scalar(selected$base_source, ""),
    assigned_base_row = if (is.null(selected)) 0L else .monitoreo_int(selected$base_row, 0L),
    match_type = if (is.null(selected)) "none" else .monitoreo_scalar(selected$match_type, ""),
    previous_status = .monitoreo_scalar(item$advancement, ""),
    new_status = if (identical(action, "include_with_caveat")) "included_with_caveat" else "excluded",
    note = note,
    decided_at = .monitoreo_now_iso()
  )
  manual[[response_id]] <- decision
  profile$reconciliation_decisions <- list(
    include_response_ids = as.list(include_ids),
    exclude_response_ids = as.list(exclude_ids),
    manual_case_reconciliations = manual
  )
  cfg$monitoreo_profile <- monitoreo_normalize_profile(profile, acreditacion = cfg$acreditacion)
  list(config = cfg, decision = decision, case = item, selected = selected)
}

mount_monitoreo <- function(pr) {
  pr |>
    plumber::pr_get("/api/monitoreo/state", wrap_endpoint(function(req, res, include_reports = NULL, includeReports = NULL, report_scope = NULL, reportScope = NULL, ...) {
      sid <- .monitoreo_session(req, res)
      include_reports <- .monitoreo_bool(include_reports %||% includeReports, TRUE)
      .monitoreo_state_payload(
        sid,
        include_reports = include_reports,
        report_scope = report_scope %||% reportScope %||% "full"
      )
    })) |>
    plumber::pr_get("/api/monitoreo/public-report", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        bootstrap_sid <- Sys.getenv("PULSO_BOOTSTRAP_SID", "")
        if (nzchar(bootstrap_sid)) sid <- bootstrap_sid
      }
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- .monitoreo_session(req, res)
      }
      .monitoreo_public_report_payload(sid)
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/prewarm", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% snapshot$config %||% list(), data)
      if (!identical(cfg$monitoreo_profile$family %||% "acreditacion", "territorial")) {
        stop_api(409, "E_MONITOREO_TERRITORIAL_REQUIRED", "El precalentamiento requiere un monitoreo territorial activo.")
      }
      phase <- .monitoreo_territorial_phase(parsed$phase %||% parsed$route_phase %||% parsed$routePhase %||% cfg$territorial$active_route_phase, "pilot")
      scopes <- .monitoreo_chr_vec(parsed$scopes %||% parsed$scope %||% list())
      scopes <- unique(vapply(scopes, .monitoreo_report_scope, character(1)))
      scopes <- scopes[scopes %in% c("source", "route_summary", "validation_summary", "queries_summary", "advance_summary")]
      if (!length(scopes)) {
        scopes <- c("source", "route_summary", "validation_summary", "queries_summary", "advance_summary")
      }
      cfg$territorial$active_route_phase <- phase
      if (is.list(snapshot)) {
        snapshot$config <- cfg
        session_set(sid, "monitoreo_snapshot", snapshot)
      }
      session_set(sid, "monitoreo_config", cfg)
      cache_plan <- .monitoreo_territorial_prewarm_cache_ready(sid, snapshot, data, cfg, phase, scopes)
      if (isTRUE(cache_plan$ready)) {
        cached_scopes <- unname(lapply(scopes, function(scope) {
          entry <- cache_plan$cached_entries[[scope]] %||% list()
          list(
            scope = scope,
            status = "ready",
            cache_hit = TRUE,
            cache_source = "project",
            backend_ms = 0,
            total_ms = 0,
            payload_size = as.integer(entry$payload_size %||% NA_integer_)
          )
        }))
        public <- list(
          ok = TRUE,
          phase = phase,
          scopes = cached_scopes,
          map_cache = cache_plan$map_cache %||% list(skipped = TRUE)
        )
        job_id <- job_submit_completed(
          sid = sid,
          kind = "monitoreo.territorial_prewarm",
          result_data = public
        )
        return(list(ok = TRUE, job_id = job_id, kind = "monitoreo.territorial_prewarm", cache_hit = TRUE))
      }
      session_path <- job_save_rds(sid, "monitoreo_territorial_prewarm_session", s)
      job_id <- job_submit(
        sid = sid,
        kind = "monitoreo.territorial_prewarm",
        func = .monitoreo_territorial_prewarm_job,
        args = list(
          session_path = session_path,
          phase = phase,
          scopes = scopes
        ),
        on_complete = function(j) {
          result <- j$result_data
          if (!is.list(result)) return(result)
          patch <- result$session_patch %||% list()
          s_current <- session_get(j$sid)
          snapshot_current <- s_current$monitoreo_snapshot %||% list()
          incoming_report_cache <- patch$territorial_report_cache %||% NULL
          if (is.list(incoming_report_cache)) {
            snapshot_current <- .monitoreo_territorial_report_cache_merge(snapshot_current, incoming_report_cache)
            session_set(j$sid, "monitoreo_snapshot", snapshot_current)
          }
          incoming_map_cache <- patch$territorial_map_cache %||% NULL
          if (is.list(incoming_map_cache)) {
            merged_map_cache <- .monitoreo_territorial_map_cache_merge(
              s_current$monitoreo_territorial_map_cache %||% list(),
              incoming_map_cache,
              phase = result$phase %||% phase
            )
            session_set(j$sid, "monitoreo_territorial_map_cache", merged_map_cache)
          }
          should_autosave_cache <- any(vapply(result$scopes %||% list(), function(item) {
            is.list(item) && !isTRUE(item$cache_hit)
          }, logical(1))) || !isTRUE(result$map_cache$skipped)
          if (isTRUE(should_autosave_cache)) {
            tryCatch(.monitoreo_mark_project_dirty_if_open(j$sid), error = function(e) NULL)
          }
          public <- .monitoreo_territorial_prewarm_public_result(result)
          public$state <- tryCatch(
            .monitoreo_state_payload(j$sid, include_reports = FALSE),
            error = function(e) public$state %||% NULL
          )
          public
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "monitoreo.territorial_prewarm")
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
      sources_before <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
      sources <- sources_before
      sources <- Filter(function(src) identical(src$kind, "google_sheets") && isTRUE(src$enabled), sources)
      if (length(parsed$source_ids %||% list())) {
        wanted <- .monitoreo_chr_vec(parsed$source_ids)
        sources <- Filter(function(src) src$id %in% wanted, sources)
      }
      sources <- Filter(function(src) !identical(.monitoreo_scalar(src$role, ""), "ocurrencias_campo"), sources)
      if (!length(sources)) {
        stop_api(409, "E_NO_MONITOREO_SOURCES", "No hay fuentes activas de encuesta principal para sincronizar.")
      }
      cfg <- .monitoreo_request_config(parsed$config %||% NULL, s$monitoreo_config %||% list(), data.frame())
      result <- tryCatch(
        monitoreo_sync_sources(sources, cfg, since = NULL, sid = sid),
        error = .monitoreo_sheets_stop
      )
      s_current <- session_get(sid)
      prev_snapshot <- s_current$monitoreo_snapshot %||% NULL
      prev_data <- if (!is.null(prev_snapshot) && is.data.frame(prev_snapshot$data)) prev_snapshot$data else data.frame()
      synced_source_ids <- .monitoreo_sync_successful_source_ids(
        result$sync_summary %||% list(),
        result$data
      )
      incremental_source_ids <- .monitoreo_sync_incremental_source_ids(result$sync_summary %||% list())
      combined_data <- .monitoreo_merge_sync_result_data(
        prev_data,
        result$data,
        synced_source_ids = synced_source_ids,
        incremental_source_ids = incremental_source_ids
      )
      current_cfg <- .monitoreo_request_config(NULL, s_current$monitoreo_config %||% list(), combined_data)
      result$config <- monitoreo_normalize_config(result$config, combined_data, previous_config = current_cfg)
      current_family <- current_cfg$monitoreo_profile$family %||% ""
      result_family <- result$config$monitoreo_profile$family %||% ""
      if (identical(result_family, "territorial") && identical(current_family, "territorial")) {
        current_phase <- .monitoreo_territorial_phase(current_cfg$territorial$active_route_phase, "pilot")
        result$config$territorial$active_route_phase <- current_phase
        result$config$territorial$phase_sources <- current_cfg$territorial$phase_sources
        result$config$territorial <- monitoreo_territorial_normalize_config(
          result$config$territorial,
          result$data,
          previous = current_cfg$territorial
        )
      }
      result$dashboard <- .monitoreo_dashboard_for_session(sid, combined_data, result$config)
      synced_sources <- monitoreo_normalize_sources(result$sources %||% list())
      sources_now <- sources_before
      if (length(synced_sources)) {
        source_ids_now <- vapply(sources_now, function(src) .monitoreo_scalar(src$id, ""), character(1))
        for (src in synced_sources) {
          sid_src <- .monitoreo_scalar(src$id, "")
          if (!nzchar(sid_src)) next
          idx <- match(sid_src, source_ids_now)
          if (!is.na(idx) && is.finite(idx) && idx > 0L) {
            sources_now[[idx]] <- utils::modifyList(sources_now[[idx]], src)
          } else {
            sources_now[[length(sources_now) + 1L]] <- src
            source_ids_now <- c(source_ids_now, sid_src)
          }
        }
      }
      ids <- synced_source_ids
      if (!length(ids)) ids <- unique(as.character(result$data$.source_id %||% character(0)))
      sources_now <- lapply(sources_now, function(src) {
        sid_src <- .monitoreo_scalar(src$id, "")
        if (nzchar(sid_src) && sid_src %in% ids) src$last_sync_at <- result$synced_at
        src
      })
      artifacts <- monitoreo_snapshot_artifacts(
        combined_data,
        result$config,
        sources = sources_now,
        dashboard = result$dashboard,
        synced_at = result$synced_at,
        errors = result$errors,
        sync_summary = result$sync_summary %||% list()
      )
      snapshot <- c(list(
        synced_at = result$synced_at,
        data = combined_data,
        config = result$config,
        dashboard = result$dashboard,
        variables = if (nrow(combined_data)) monitoreo_variables(combined_data) else list(),
        errors = result$errors
      ), artifacts)
      session_set(sid, "monitoreo_sources", sources_now)
      session_set(sid, "monitoreo_config", result$config)
      session_set(sid, "monitoreo_snapshot", snapshot)
      tryCatch(.monitoreo_mark_project_dirty_if_open(sid), error = function(e) NULL)
      list(
        ok = TRUE,
        synced_at = result$synced_at,
        n_rows = as.integer(nrow(combined_data)),
        n_sources = as.integer(length(sources_now)),
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
      spreadsheet_id <- .monitoreo_resolve_publication_spreadsheet_id(parsed, s, "internal")
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
      spreadsheet_id <- .monitoreo_resolve_publication_spreadsheet_id(parsed, s, "client")
      if (!nzchar(spreadsheet_id)) stop_api(400, "E_SHEETS_SPREADSHEET", "Falta spreadsheet_id destino para el reporte a cliente.")
      tabs <- .monitoreo_client_report_tabs_payload(model)
      published <- tryCatch(.monitoreo_sheets_publish_local(spreadsheet_id, tabs), error = .monitoreo_sheets_stop)
      session_set(sid, "monitoreo_client_report_sheet_events", c(
        s$monitoreo_client_report_sheet_events %||% list(),
        list(c(published, list(tabs = names(tabs), include_targets = include_targets)))
      ))
      published
    })) |>
    plumber::pr_post("/api/monitoreo/publish", wrap_endpoint(function(req, res, ...) {
      stop_api(
        410,
        "E_MONITOREO_HF_DISABLED",
        "Monitoreo ya no publica en Hugging Face. Publica las tablas cliente e internas en Google Sheets."
      )
    })) |>
    plumber::pr_post("/api/monitoreo/publication/preflight", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      audience <- .monitoreo_public_audience(parsed$audience %||% parsed$public_audience %||% parsed$publicAudience)
      spreadsheet_id <- .monitoreo_resolve_publication_spreadsheet_id(parsed, s, audience)
      bundle <- .monitoreo_publication_preflight_bundle(
        sid,
        s,
        snapshot,
        parsed,
        audience = audience,
        spreadsheet_id = spreadsheet_id
      )
      event_key <- paste0("monitoreo_publication_preflight_events_", audience)
      session_set(sid, event_key, c(
        s[[event_key]] %||% list(),
        list(list(
          generated_at = bundle$preflight$generated_at,
          audience = audience,
          family = bundle$publication_family,
          status = bundle$preflight$status,
          score = bundle$preflight$score,
          tabs = names(bundle$tabs)
        ))
      ))
      list(
        ok = TRUE,
        audience = audience,
        family = bundle$publication_family,
        report_scope = bundle$report_scope,
        tabs = names(bundle$tabs),
        preflight = bundle$preflight
      )
    })) |>
    plumber::pr_post("/api/monitoreo/publication/evidence-pack", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      audience <- .monitoreo_public_audience(parsed$audience %||% parsed$public_audience %||% parsed$publicAudience)
      spreadsheet_id <- .monitoreo_resolve_publication_spreadsheet_id(parsed, s, audience)
      result <- .monitoreo_publication_evidence_pack(
        sid,
        s,
        snapshot,
        parsed,
        audience = audience,
        spreadsheet_id = spreadsheet_id
      )
      event_key <- paste0("monitoreo_publication_evidence_pack_events_", audience)
      current <- session_get(sid)
      session_set(sid, event_key, c(
        current[[event_key]] %||% list(),
        list(list(
          generated_at = result$preflight$generated_at,
          audience = audience,
          family = result$family,
          status = result$preflight$status,
          score = result$preflight$score,
          tabs = result$tabs,
          file_id = result$file_id,
          filename = result$filename,
          size = result$size
        ))
      ))
      result
    })) |>
    plumber::pr_post("/api/monitoreo/publication/sheets", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      if (is.null(snapshot) || !is.data.frame(snapshot$data) || !nrow(snapshot$data)) {
        stop_api(409, "E_NO_MONITOREO_DATA", "Sincroniza datos antes de publicar el ejecutivo en Sheets.")
      }
      audience <- .monitoreo_public_audience(parsed$audience %||% parsed$public_audience %||% parsed$publicAudience)
      spreadsheet_id <- .monitoreo_resolve_publication_spreadsheet_id(parsed, s, audience)
      if (!nzchar(spreadsheet_id)) stop_api(400, "E_SHEETS_SPREADSHEET", "Falta spreadsheet_id destino para publicar el ejecutivo en Sheets.")
      bundle <- .monitoreo_publication_preflight_bundle(
        sid,
        s,
        snapshot,
        parsed,
        audience = audience,
        spreadsheet_id = spreadsheet_id
      )
      if (identical(bundle$preflight$status, "blocked")) {
        stop_api(
          409,
          "E_MONITOREO_PREFLIGHT_BLOCKED",
          "El preflight de entregables bloquea esta publicación.",
          details = list(preflight = bundle$preflight)
        )
      }
      tabs <- bundle$tabs
      published <- tryCatch(.monitoreo_sheets_publish_local(spreadsheet_id, tabs), error = .monitoreo_sheets_stop)
      event_key <- paste0("monitoreo_publication_sheet_events_", audience)
      session_set(sid, event_key, c(
        s[[event_key]] %||% list(),
        list(c(published, list(
          audience = audience,
          tabs = names(tabs),
          include_targets = bundle$include_targets,
          confirmed_full_data = .monitoreo_publication_confirmed_full_data(parsed),
          preflight = bundle$preflight$scorecard
        )))
      ))
      c(published, list(audience = audience, preflight = bundle$preflight))
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
      is_territorial_pdf <- identical(.monitoreo_scalar(model$report_kind, ""), "territorial_advance_pdf") ||
        identical(.monitoreo_publication_family_key(model$family %||% ""), "territorial")
      filename <- .export_filename(sid, if (isTRUE(is_territorial_pdf)) "avance_territorial_monitoreo" else "reporte_cliente_monitoreo", "pdf")
      pdf_job_runner <- monitoreo_client_report_pdf_job_runner
      attr(pdf_job_runner, "prosecnur_job_function_name") <- "monitoreo_client_report_pdf_job_runner"
      job_id <- job_submit(
        sid = sid,
        kind = if (isTRUE(is_territorial_pdf)) "monitoreo.territorial_advance_pdf" else "monitoreo.client_report_pdf",
        func = pdf_job_runner,
        args = list(model_path = model_path, include_targets = include_targets),
        result_filename = filename,
        on_complete = function(j) {
          if (identical(j$status, "done") && !is.null(j$result_path) && file.exists(j$result_path)) {
            session_set(j$sid, "monitoreo_client_report_pdf", list(
              disponible = TRUE,
              path = j$result_path,
              generated_at = format(j$finished_at, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
              include_targets = include_targets,
              report_kind = model$report_kind %||% ""
            ))
          }
          j$result_data
        }
      )
      session_set(sid, "monitoreo_client_report_pdf", list(
        disponible = FALSE,
        job_id = job_id,
        generated_at = NULL,
        include_targets = include_targets,
        report_kind = model$report_kind %||% ""
      ))
      list(ok = TRUE, job_id = job_id, kind = if (isTRUE(is_territorial_pdf)) "monitoreo.territorial_advance_pdf" else "monitoreo.client_report_pdf")
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
    plumber::pr_post("/api/monitoreo/production-report/pdf", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      cfg <- monitoreo_normalize_config(parsed$config %||% s$monitoreo_config %||% list(), snapshot$data %||% data.frame())
      include_targets <- .monitoreo_bool(parsed$include_targets %||% parsed$includeTargets, FALSE)
      model <- .monitoreo_production_report_model_for_snapshot(snapshot, cfg, include_targets = include_targets)
      report_title <- .monitoreo_scalar(parsed$title %||% parsed$report_title %||% parsed$reportTitle, "")
      if (nzchar(report_title)) model$display_title <- report_title
      model_path <- job_save_rds(sid, "monitoreo_production_report_model", model)
      filename <- .export_filename(sid, "produccion_responsable_monitoreo", "pdf")
      pdf_job_runner <- monitoreo_production_report_pdf_job_runner
      attr(pdf_job_runner, "prosecnur_job_function_name") <- "monitoreo_production_report_pdf_job_runner"
      job_id <- job_submit(
        sid = sid,
        kind = "monitoreo.production_report_pdf",
        func = pdf_job_runner,
        args = list(model_path = model_path, include_targets = include_targets, report_title = report_title),
        result_filename = filename,
        on_complete = function(j) {
          if (identical(j$status, "done") && !is.null(j$result_path) && file.exists(j$result_path)) {
            session_set(j$sid, "monitoreo_production_report_pdf", list(
              disponible = TRUE,
              path = j$result_path,
              generated_at = format(j$finished_at, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
              include_targets = include_targets,
              title = report_title,
              report_kind = model$report_kind %||% ""
            ))
          }
          j$result_data
        }
      )
      session_set(sid, "monitoreo_production_report_pdf", list(
        disponible = FALSE,
        job_id = job_id,
        generated_at = NULL,
        include_targets = include_targets,
        title = report_title,
        report_kind = model$report_kind %||% ""
      ))
      list(ok = TRUE, job_id = job_id, kind = "monitoreo.production_report_pdf")
    })) |>
    plumber::pr_get("/api/monitoreo/production-report/pdf/download", wrap_endpoint(function(req, res, sid = NULL, inline = NULL, ...) {
      effective_sid <- session_header(req)
      if ((is.null(effective_sid) || !nzchar(effective_sid)) && is.character(sid) && length(sid) >= 1L && nzchar(sid[[1]])) {
        effective_sid <- sid[[1]]
      }
      s <- session_get(effective_sid)
      meta <- s$monitoreo_production_report_pdf %||% NULL
      if (is.null(meta) || !isTRUE(meta$disponible) || is.null(meta$path) || !file.exists(meta$path)) {
        if (!is.null(meta$job_id)) {
          j <- tryCatch(job_poll(meta$job_id), error = function(e) NULL)
          if (!is.null(j) && identical(j$status, "done") && !is.null(j$result_path) && file.exists(j$result_path)) {
            meta$path <- j$result_path
            meta$disponible <- TRUE
            meta$generated_at <- format(j$finished_at, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
            session_set(effective_sid, "monitoreo_production_report_pdf", meta)
          }
        }
      }
      if (is.null(meta) || !isTRUE(meta$disponible) || is.null(meta$path) || !file.exists(meta$path)) {
        stop_api(404, "E_NO_PRODUCCION_PDF", "No hay PDF de producción generado todavía.")
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
      base_url <- .monitoreo_scalar(parsed$base_url %||% parsed$baseUrl, "")
      if (!nzchar(base_url)) base_url <- .connections_profile_base_url("kobo", profile_id)
      if (!nzchar(base_url)) base_url <- kobo_api_default_base_url()
      token <- .connections_token_require("kobo", sid, profile_id = profile_id, base_url = base_url)
      kobo_api_fetch_assets(
        token,
        base_url = base_url,
        limit = parsed$limit %||% 100L
      )
    })) |>
    plumber::pr_post("/api/monitoreo/kobo/survey-link", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      asset_uid <- .monitoreo_scalar(parsed$asset_uid %||% parsed$assetUid %||% parsed$uid, "")
      if (!nzchar(asset_uid)) stop_api(400, "E_KOBO_ASSET", "Selecciona un formulario Kobo.")
      profile_id <- parsed$connection_profile_id %||% parsed$connectionProfileId %||% parsed$profile_id %||% parsed$profileId %||% NULL
      base_url <- .monitoreo_scalar(parsed$base_url %||% parsed$baseUrl, "")
      if (!nzchar(base_url)) base_url <- .connections_profile_base_url("kobo", profile_id)
      if (!nzchar(base_url)) base_url <- kobo_api_default_base_url()
      token <- .connections_token_require("kobo", sid, profile_id = profile_id, base_url = base_url)
      .monitoreo_kobo_resolve_survey_link(asset_uid, token, base_url)
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/inspect-kobo", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
	      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
		      cfg <- .monitoreo_request_config(parsed$config %||% NULL, s$monitoreo_config %||% list(), data)
	      sources <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
	      phase <- .monitoreo_territorial_phase(parsed$phase %||% parsed$route_phase %||% parsed$routePhase %||% cfg$territorial$active_route_phase, "pilot")
	      source <- .monitoreo_territorial_source(sources, cfg, parsed$source_id %||% parsed$sourceId %||% "", phase = phase)
	      phase_source <- .monitoreo_territorial_phase_source(cfg$territorial, phase)
	      asset_uid <- .monitoreo_scalar(parsed$asset_uid %||% parsed$assetUid %||% source$asset_uid %||% phase_source$asset_uid, "")
	      if (!nzchar(asset_uid)) {
	        stop_api(400, "E_KOBO_ASSET_REQUIRED", "Selecciona primero un formulario Kobo para esta fase.")
      }
      profile_id <- parsed$connection_profile_id %||% parsed$connectionProfileId %||% parsed$profile_id %||% parsed$profileId %||% source$connection_profile_id %||% NULL
      base_url <- .monitoreo_scalar(parsed$base_url %||% parsed$baseUrl, "")
      if (!nzchar(base_url)) base_url <- .monitoreo_scalar(source$base_url, "")
      if (!nzchar(base_url)) base_url <- .connections_profile_base_url("kobo", profile_id)
      if (!nzchar(.monitoreo_scalar(base_url, ""))) base_url <- kobo_api_default_base_url()
      token <- .connections_token_require("kobo", sid, profile_id = profile_id, base_url = base_url)
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
	      tcfg$district_var <- schema$district_field
	      tcfg <- .monitoreo_territorial_set_phase_source(tcfg, phase, list(
	        asset_uid = schema$asset_uid,
	        kobo_asset_name = schema$name,
	        kobo_version_id = schema$version_id,
	        source_id = if (!is.null(source)) source$id else .monitoreo_scalar(phase_source$source_id, ""),
	        inspected_at = schema$inspected_at,
	        base_url = schema$base_url,
	        connection_profile_id = .monitoreo_scalar(profile_id, "")
	      ))
	      cfg$territorial <- monitoreo_territorial_normalize_config(tcfg, data)
	      schemas <- s$monitoreo_kobo_schemas %||% list()
	      schemas[[phase]] <- schema
	      session_set(sid, "monitoreo_kobo_schemas", schemas)
	      if (identical(cfg$territorial$active_route_phase, phase)) {
	        session_set(sid, "monitoreo_kobo_schema", schema)
	      }
      session_set(sid, "monitoreo_config", cfg)
      logged_phase_source <- cfg$territorial$phase_sources[[phase]] %||% list()
      logged_source_id <- .monitoreo_scalar(logged_phase_source$source_id, "")
      .monitoreo_territorial_history_add(sid, list(
        type = "inspect",
        asset_uid = schema$asset_uid,
        asset_name = schema$name,
        version_id = schema$version_id,
	        source_id = logged_source_id,
	        response_count = .monitoreo_snapshot_count(data, logged_source_id),
        status = "ok",
        message = "Formulario Kobo inspeccionado."
      ))
      list(ok = TRUE, schema = schema, config = cfg, state = .monitoreo_state_payload(sid))
	    })) |>
    plumber::pr_post("/api/monitoreo/territorial/phase", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      requested_phase <- .monitoreo_scalar(
        parsed$active_route_phase %||% parsed$activeRoutePhase %||% parsed$phase %||% parsed$route_phase %||% parsed$routePhase,
        ""
      )
      if (!requested_phase %in% c("pilot", "field")) {
        stop_api(400, "E_MONITOREO_ROUTE_PHASE", "active_route_phase debe ser 'pilot' o 'field'.")
      }
      cfg <- .monitoreo_request_config(
        list(territorial = list(active_route_phase = requested_phase)),
        s$monitoreo_config %||% list(),
        data
      )
      profile <- cfg$monitoreo_profile %||% monitoreo_normalize_profile(list())
      profile$family <- "territorial"
      profile$status <- "active"
      profile$route_selected <- TRUE
      cfg$monitoreo_profile <- monitoreo_normalize_profile(profile, acreditacion = cfg$acreditacion)
      cfg <- .monitoreo_store_config(sid, cfg, rebuild_dashboard = FALSE)
      status <- monitoreo_territorial_phase_source_status(cfg$territorial, cfg$territorial$active_route_phase)
      list(
        ok = TRUE,
        config = cfg,
        active_route_phase = cfg$territorial$active_route_phase,
        phase_source_status = status$phase_source_status,
        message = status$message
      )
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/source", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      phase <- .monitoreo_territorial_phase(
        parsed$phase %||% parsed$route_phase %||% parsed$routePhase %||% parsed$active_route_phase %||% parsed$activeRoutePhase,
        "pilot"
      )
      asset_uid <- .monitoreo_scalar(parsed$asset_uid %||% parsed$assetUid %||% parsed$uid, "")
      if (!nzchar(asset_uid)) {
        stop_api(400, "E_KOBO_ASSET_REQUIRED", "Selecciona un formulario Kobo para aplicar a la fase.")
      }
	      sources_before <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
	      previous_cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
	      previous_phase_source <- .monitoreo_territorial_phase_source(previous_cfg$territorial %||% list(), phase)
	      cfg <- .monitoreo_request_config(
	        list(territorial = list(active_route_phase = phase)),
	        s$monitoreo_config %||% list(),
	        data
	      )
      current_source <- .monitoreo_territorial_source(sources_before, cfg, parsed$source_id %||% parsed$sourceId %||% "", phase = phase)
      source_id <- .monitoreo_scalar(
        parsed$source_id %||% parsed$sourceId,
        .monitoreo_territorial_source_id_for_asset(asset_uid, phase, sources_before, current_source)
      )
      label <- .monitoreo_scalar(
        parsed$label %||% parsed$name %||% parsed$asset_name %||% parsed$assetName,
        if (identical(phase, "field")) "Formulario Kobo Campo" else "Formulario Kobo Piloto"
      )
      base_url <- .monitoreo_scalar(
        parsed$base_url %||% parsed$baseUrl %||% current_source$base_url,
        ""
      )
      profile_id <- .monitoreo_scalar(
        parsed$connection_profile_id %||% parsed$connectionProfileId %||% parsed$profile_id %||% parsed$profileId %||% current_source$connection_profile_id,
        ""
      )
      if (!nzchar(base_url)) base_url <- .connections_profile_base_url("kobo", profile_id)
      if (!nzchar(base_url)) base_url <- kobo_api_default_base_url()
      version_id <- .monitoreo_scalar(
        parsed$kobo_version_id %||% parsed$koboVersionId %||% parsed$version_id %||% parsed$versionId,
        ""
      )
      dimensions <- current_source$dimensions %||% list()
      if (!is.list(dimensions)) dimensions <- list()
      dimensions$territorial_phase <- phase
      source <- monitoreo_normalize_sources(list(list(
        id = source_id,
        kind = "kobo",
        label = label,
        enabled = TRUE,
        asset_uid = asset_uid,
        base_url = base_url,
        connection_profile_id = profile_id,
        role = "respuestas",
        integration_mode = "connected_read",
        dimensions = dimensions,
        created_at = .monitoreo_scalar(current_source$created_at, .monitoreo_now_iso()),
        last_sync_at = if (identical(.monitoreo_scalar(current_source$asset_uid, ""), asset_uid)) {
          .monitoreo_scalar(current_source$last_sync_at, "")
        } else {
          ""
        }
      )))[[1]]
      sources <- monitoreo_upsert_source(sources_before, source)
      session_set(sid, "monitoreo_sources", sources)

      tcfg <- cfg$territorial
      tcfg$active_route_phase <- phase
      tcfg <- .monitoreo_territorial_set_phase_source(tcfg, phase, list(
        asset_uid = asset_uid,
        kobo_asset_name = label,
        kobo_version_id = version_id,
        source_id = source$id,
        inspected_at = .monitoreo_scalar(parsed$inspected_at %||% parsed$inspectedAt, ""),
        base_url = source$base_url,
        connection_profile_id = source$connection_profile_id
      ))
      cfg$territorial <- monitoreo_territorial_normalize_config(tcfg, data, previous = cfg$territorial)
      profile <- cfg$monitoreo_profile %||% monitoreo_normalize_profile(list())
	      profile$family <- "territorial"
	      profile$status <- "active"
	      profile$route_selected <- TRUE
	      cfg$monitoreo_profile <- monitoreo_normalize_profile(profile, acreditacion = cfg$acreditacion)
	      previous_asset_uid <- .monitoreo_scalar(previous_phase_source$asset_uid, "")
	      previous_version_id <- .monitoreo_scalar(previous_phase_source$kobo_version_id, "")
	      source_changed <- (nzchar(previous_asset_uid) && !identical(previous_asset_uid, asset_uid)) ||
	        (nzchar(previous_version_id) && nzchar(version_id) && !identical(previous_version_id, version_id))
	      cfg <- .monitoreo_store_config(sid, cfg, rebuild_dashboard = FALSE)
	      pruned_rows <- 0L
	      if (isTRUE(source_changed)) {
	        other_phase <- if (identical(phase, "field")) "pilot" else "field"
	        protected_ids <- .monitoreo_scalar(cfg$territorial$phase_sources[[other_phase]]$source_id, "")
	        prune_ids <- unique(c(.monitoreo_scalar(previous_phase_source$source_id, ""), source$id))
	        prune_ids <- prune_ids[nzchar(prune_ids) & !prune_ids %in% protected_ids]
	        pruned_rows <- .monitoreo_prune_snapshot_source_ids(sid, prune_ids, cfg)
	        s_after_prune <- session_get(sid)
	        cfg <- s_after_prune$monitoreo_config %||% cfg
	        snapshot_after_prune <- s_after_prune$monitoreo_snapshot %||% NULL
	        data <- if (!is.null(snapshot_after_prune) && is.data.frame(snapshot_after_prune$data)) snapshot_after_prune$data else data.frame()
	      }
	      status <- monitoreo_territorial_phase_source_status(cfg$territorial, phase)
	      .monitoreo_territorial_history_add(sid, list(
	        type = "apply_source",
	        asset_uid = source$asset_uid,
	        asset_name = source$label,
	        version_id = version_id,
	        source_id = source$id,
	        response_count = .monitoreo_snapshot_count(data, source$id),
	        status = "ok",
	        message = if (pruned_rows > 0L) {
	          sprintf("Formulario Kobo aplicado a %s; se invalidaron %s filas locales de la fuente anterior.", if (identical(phase, "field")) "Campo" else "Piloto", pruned_rows)
	        } else {
	          sprintf("Formulario Kobo aplicado a %s.", if (identical(phase, "field")) "Campo" else "Piloto")
		        }
		      ))
	      .monitoreo_territorial_invalidate_map_cache(
	        sid,
	        phase = phase,
	        layers = "gps_points",
	        reason = if (isTRUE(source_changed)) "territorial_source_changed" else "territorial_source_applied"
	      )
      saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
      list(
        ok = TRUE,
        source = source,
        config = cfg,
        state = .monitoreo_state_payload(sid),
        active_route_phase = cfg$territorial$active_route_phase,
        phase_source_status = status$phase_source_status,
        message = status$message,
        saved_project = !is.null(saved_project)
      )
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
	      should_autosave <- any(names(patch) %in% c(
	        "phase_windows", "phaseWindows",
	        "field_start_at", "fieldStartAt", "campo_start_at", "campoStartAt", "inicio_campo_at", "inicioCampoAt",
	        "pilot_start_at", "pilotStartAt", "inicio_piloto_at", "inicioPilotoAt"
	      ))
	      saved_project <- if (isTRUE(should_autosave)) .monitoreo_mark_project_dirty_if_open(sid) else NULL
	      list(ok = TRUE, config = cfg, state = .monitoreo_state_payload(sid), saved_project = !is.null(saved_project))
	    })) |>
    plumber::pr_post("/api/monitoreo/territorial/enumerators/upload", wrap_endpoint(function(req, res, file = NULL, code_var = NULL, ump_var = NULL, code_format = NULL, ...) {
      sid <- .monitoreo_session(req, res)
      if (is.null(file)) stop_api(400, "E_NO_FILE_FIELD", "Falta el campo 'file' con el Excel de encuestadores.")
      extracted <- if (is.raw(file)) {
        list(bytes = file, original = "encuestadores.xlsx")
      } else if (is.list(file) && length(file) >= 1 && is.raw(file[[1]])) {
        list(bytes = file[[1]], original = names(file)[1] %||% "encuestadores.xlsx")
      } else if (is.list(file) && is.raw(file$value)) {
        list(bytes = file$value, original = file$filename %||% "encuestadores.xlsx")
      } else {
        stop_api(400, "E_BAD_FILE", "No se pudo leer el Excel subido.")
      }
      original <- .monitoreo_scalar(extracted$original, "encuestadores.xlsx")
      ext <- tolower(tools::file_ext(original))
      if (!ext %in% c("xls", "xlsx", "xlsm")) {
        stop_api(400, "E_BAD_FILE_TYPE", "Sube un archivo Excel (.xls, .xlsx o .xlsm) con AP PATERNO, AP MATERNO y NOMBRES.")
      }
      meta <- save_upload(sid, "data", original, extracted$bytes)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      text_field <- function(value, name, default = "") {
        out <- .monitoreo_scalar(value, "")
        if (!nzchar(out) && exists(".extract_text_field", mode = "function")) {
          out <- .extract_text_field(value, req, name)
        }
        if (nzchar(out)) out else default
      }
      current_roster <- cfg$territorial$enumerator_roster %||% list()
      roster <- tryCatch(
        monitoreo_territorial_enumerator_roster_from_excel(
          .monitoreo_scalar(meta$path, ""),
          previous = current_roster,
          file_name = .monitoreo_scalar(meta$original_name, original),
          source_file_id = .monitoreo_scalar(meta$file_id, ""),
          code_var = text_field(code_var, "code_var", .monitoreo_scalar(current_roster$code_var, "codigo_pulso")),
          ump_var = text_field(ump_var, "ump_var", .monitoreo_scalar(current_roster$ump_var, "ump")),
          code_format = text_field(code_format, "code_format", .monitoreo_scalar(current_roster$code_format, "PXXX"))
        ),
        error = function(e) stop_api(400, "E_ENUMERATOR_ROSTER", conditionMessage(e))
      )
      tcfg <- cfg$territorial
      tcfg$enumerator_roster <- roster
      cfg$territorial <- monitoreo_territorial_normalize_config(tcfg, data)
      profile <- cfg$monitoreo_profile %||% monitoreo_normalize_profile(list())
      profile$family <- "territorial"
      profile$status <- "active"
      cfg$monitoreo_profile <- monitoreo_normalize_profile(profile, acreditacion = cfg$acreditacion)
      cfg <- .monitoreo_store_config(sid, cfg)
      saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
      list(
        ok = TRUE,
        enumerator_roster = cfg$territorial$enumerator_roster,
        config = cfg,
        state = .monitoreo_state_payload(sid),
        saved_project = !is.null(saved_project)
      )
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/enumerators/template", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      out <- file.path(tempdir(), sprintf("plantilla_encuestadores_pulso_%s.xlsx", format(Sys.time(), "%Y%m%d%H%M%S")))
      result <- tryCatch(
        monitoreo_territorial_enumerator_roster_template(out),
        error = function(e) stop_api(400, "E_ENUMERATOR_TEMPLATE", conditionMessage(e))
      )
      n <- file.info(out)$size
      bytes <- readBin(out, what = "raw", n = n)
      meta <- save_upload(sid, "data", "plantilla_encuestadores_pulso.xlsx", bytes)
      res$status <- 201
      list(
        ok = TRUE,
        file_id = .monitoreo_scalar(meta$file_id, ""),
        filename = .monitoreo_scalar(meta$original_name, result$filename %||% "plantilla_encuestadores_pulso.xlsx"),
        size = as.integer(meta$size %||% n),
        rows = as.integer(result$rows %||% 0L)
      )
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/enumerators/codes", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      roster <- cfg$territorial$enumerator_roster %||% list()
      out <- file.path(tempdir(), sprintf("codigos_pulso_encuestadores_%s.xlsx", format(Sys.time(), "%Y%m%d%H%M%S")))
      result <- tryCatch(
        monitoreo_territorial_enumerator_codes_workbook(out, roster),
        error = function(e) stop_api(400, "E_ENUMERATOR_CODES", conditionMessage(e))
      )
      n <- file.info(out)$size
      bytes <- readBin(out, what = "raw", n = n)
      meta <- save_upload(sid, "data", "codigos_pulso_encuestadores.xlsx", bytes)
      res$status <- 201
      list(
        ok = TRUE,
        file_id = .monitoreo_scalar(meta$file_id, ""),
        filename = .monitoreo_scalar(meta$original_name, result$filename %||% "codigos_pulso_encuestadores.xlsx"),
        size = as.integer(meta$size %||% n),
        rows = as.integer(result$rows %||% 0L)
      )
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/enumerators/reconcile-code", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      payload <- parsed$reconciliation %||% parsed
      if (!is.list(payload)) payload <- list()

      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      tcfg <- cfg$territorial %||% monitoreo_territorial_default_config(data)
      applied <- .monitoreo_territorial_apply_code_reconciliation(tcfg, payload)
      tcfg <- applied$tcfg
      entry <- applied$reconciliation
      phase <- applied$phase
      cfg$territorial <- monitoreo_territorial_normalize_config(tcfg, data)
      cfg <- .monitoreo_store_config(sid, cfg, rebuild_dashboard = FALSE)
      .monitoreo_territorial_invalidate_map_cache(
        sid,
        phase = phase,
        layers = "gps_points",
        reason = "enumerator_code_reconciliation"
      )
      saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
      list(
        ok = TRUE,
        reconciliation = entry,
        config = cfg,
        state = .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = "source"),
        saved_project = !is.null(saved_project)
      )
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/umps/reconcile", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      payload <- parsed$reconciliation %||% parsed
      if (!is.list(payload)) payload <- list()

      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      tcfg <- cfg$territorial %||% monitoreo_territorial_default_config(data)
      phase <- .monitoreo_territorial_phase(payload$phase %||% payload$fase %||% tcfg$active_route_phase, "pilot")
      ump_context <- .monitoreo_territorial_ump_reconciliation_context(sid, cfg, phase = phase)
      applied <- .monitoreo_territorial_apply_ump_reconciliation(tcfg, payload, phase = phase, ump_context = ump_context)
      tcfg <- applied$tcfg
      entry <- applied$reconciliation
      phase <- applied$phase
      cfg$territorial <- monitoreo_territorial_normalize_config(tcfg, data)
      cfg <- .monitoreo_store_config(sid, cfg, rebuild_dashboard = FALSE)
      .monitoreo_territorial_invalidate_map_cache(
        sid,
        phase = phase,
        layers = "gps_points",
        reason = "ump_reconciliation"
      )
      saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
      list(
        ok = TRUE,
        reconciliation = entry,
        config = cfg,
        state = .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = "source"),
        saved_project = !is.null(saved_project)
      )
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/reconciliation/batch", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      changes <- parsed$changes %||% parsed$items %||% list()
      if (!is.list(changes) || !length(changes)) {
        stop_api(400, "E_TERRITORIAL_RECONCILIATION_BATCH_EMPTY", "No hay reconciliaciones pendientes para aplicar.")
      }

      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      tcfg <- cfg$territorial %||% monitoreo_territorial_default_config(data)
      batch <- .monitoreo_territorial_apply_reconciliation_batch(tcfg, changes, sid = sid, cfg = cfg)
      tcfg <- batch$tcfg
      applied <- batch$applied
      failed <- batch$failed
      changed_phases <- batch$changed_phases

      if (!length(applied)) {
        return(list(
          ok = TRUE,
          applied = applied,
          failed = failed,
          config = cfg,
          state = NULL,
          saved_project = FALSE
        ))
      }

      cfg$territorial <- monitoreo_territorial_normalize_config(tcfg, data)
      cfg <- .monitoreo_store_config(sid, cfg, rebuild_dashboard = FALSE)
      for (phase in unique(changed_phases)) {
        .monitoreo_territorial_invalidate_map_cache(
          sid,
          phase = phase,
          layers = "gps_points",
          reason = "territorial_reconciliation_batch"
        )
      }
      saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
      list(
        ok = TRUE,
        applied = applied,
        failed = failed,
        config = cfg,
        state = .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = "source"),
        saved_project = !is.null(saved_project)
      )
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/spatial-reconciliation/dismiss", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      payload <- parsed$dismissal %||% parsed$candidate %||% parsed
      if (!is.list(payload)) payload <- list()

      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      tcfg <- cfg$territorial %||% monitoreo_territorial_default_config(data)
      dismissed <- .monitoreo_territorial_dismiss_spatial_reconciliation(tcfg, payload, scope = "candidate")
      cfg$territorial <- monitoreo_territorial_normalize_config(dismissed$tcfg, data)
      cfg <- .monitoreo_store_config(sid, cfg, rebuild_dashboard = FALSE)
      saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
      list(
        ok = TRUE,
        dismissal = dismissed$dismissal,
        config = cfg,
        state = .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = "validation_summary"),
        saved_project = !is.null(saved_project)
      )
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/spatial-reconciliation/dismiss-pattern", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      payload <- parsed$dismissal %||% parsed$pattern %||% parsed
      if (!is.list(payload)) payload <- list()

      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      tcfg <- cfg$territorial %||% monitoreo_territorial_default_config(data)
      dismissed <- .monitoreo_territorial_dismiss_spatial_reconciliation(tcfg, payload, scope = "pattern")
      cfg$territorial <- monitoreo_territorial_normalize_config(dismissed$tcfg, data)
      cfg <- .monitoreo_store_config(sid, cfg, rebuild_dashboard = FALSE)
      saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
      list(
        ok = TRUE,
        dismissal = dismissed$dismissal,
        config = cfg,
        state = .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = "validation_summary"),
        saved_project = !is.null(saved_project)
      )
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/operational-package/review", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      result <- .monitoreo_territorial_operational_package_review_payload(sid, parsed, s)
      session_set(sid, "monitoreo_territorial_operational_package_review_events", c(
        s$monitoreo_territorial_operational_package_review_events %||% list(),
        list(list(
          generated_at = result$review$generated_at,
          status = result$status,
          publication_gate = result$publication_gate,
          blocks_publication = result$blocks_publication,
          safe_to_apply = result$safe_to_apply,
          template_file_id = result$files$template$file_id,
          review_file_id = result$files$review_csv$file_id
        ))
      ))
      result
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/operational-adjustments/apply", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      payload <- parsed$adjustment %||% parsed$suggestion %||% parsed
      if (!is.list(payload)) payload <- list()

      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      tcfg <- cfg$territorial %||% monitoreo_territorial_default_config(data)
      applied <- .monitoreo_territorial_apply_operational_adjustment_package(tcfg, payload)
      cfg$territorial <- monitoreo_territorial_normalize_config(applied$tcfg, data)
      cfg <- .monitoreo_store_config(sid, cfg, rebuild_dashboard = FALSE)
      saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
      list(
        ok = TRUE,
        adjustment = applied$adjustment,
        adjustments = applied$adjustments %||% list(applied$adjustment),
        config = cfg,
        state = .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = "advance_summary"),
        saved_project = !is.null(saved_project)
      )
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/operational-adjustments/reset", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      payload <- parsed$adjustment %||% parsed
      if (!is.list(payload)) payload <- list()

      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      tcfg <- cfg$territorial %||% monitoreo_territorial_default_config(data)
      reset <- .monitoreo_territorial_reset_operational_adjustments(tcfg, payload)
      cfg$territorial <- monitoreo_territorial_normalize_config(reset$tcfg, data)
      cfg <- .monitoreo_store_config(sid, cfg, rebuild_dashboard = FALSE)
      saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
      list(
        ok = TRUE,
        phase = reset$phase,
        active_before = reset$active_before,
        config = cfg,
        state = .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = "advance_summary"),
        saved_project = !is.null(saved_project)
      )
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/operational-adjustments/revert", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      payload <- parsed$adjustment %||% parsed
      if (!is.list(payload)) payload <- list()

      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      tcfg <- cfg$territorial %||% monitoreo_territorial_default_config(data)
      reverted <- .monitoreo_territorial_revert_operational_adjustment(tcfg, payload)
      cfg$territorial <- monitoreo_territorial_normalize_config(reverted$tcfg, data)
      cfg <- .monitoreo_store_config(sid, cfg, rebuild_dashboard = FALSE)
      saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
      list(
        ok = TRUE,
        adjustment_id = reverted$adjustment_id,
        config = cfg,
        state = .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = "advance_summary"),
        saved_project = !is.null(saved_project)
      )
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/annulments/preview", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      payload <- parsed$annulment %||% parsed
      if (!is.list(payload)) payload <- list()
      .monitoreo_territorial_preview_production_annulment(sid, payload)
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/annulments/apply", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      payload <- parsed$annulment %||% parsed
      if (!is.list(payload)) payload <- list()
      .monitoreo_territorial_apply_production_annulment(sid, payload)
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/annulments/revert", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      payload <- parsed$annulment %||% parsed
      if (!is.list(payload)) payload <- list()
      .monitoreo_territorial_revert_production_annulment(sid, payload)
    })) |>
    plumber::pr_get("/api/monitoreo/territorial/map", wrap_endpoint(function(req, res, phase = NULL, ubigeo = NULL, layer = NULL, hash = NULL, allow_stale = NULL, prepare = NULL, ...) {
      sid <- .monitoreo_session(req, res)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      phase <- .monitoreo_territorial_phase(phase %||% cfg$territorial$active_route_phase, "pilot")
      data <- .monitoreo_territorial_filter_data_for_phase(data, cfg, phase = phase)
      layer <- .monitoreo_scalar(layer, "full")
      if (!layer %in% c("route_geometry", "gps_points", "full")) layer <- "full"
      allow_stale <- .monitoreo_bool(allow_stale, TRUE)
      prepare_missing <- .monitoreo_bool(prepare, FALSE)
      if (identical(layer, "route_geometry")) {
        if (isTRUE(prepare_missing)) {
          .monitoreo_territorial_prepare_map_cache(sid, cfg, data, phase = phase, layers = "route_geometry")
        }
        cache <- .monitoreo_territorial_map_cache_get(sid)
        context <- .monitoreo_territorial_context(sid, cfg, phase = phase)
        route_hash <- .monitoreo_territorial_route_hash(context, phase = phase)
        entry <- cache$phases[[phase]]$route_geometry %||% NULL
        meta <- .monitoreo_territorial_layer_meta(entry, route_hash)
        if (nzchar(.monitoreo_scalar(hash, "")) && identical(.monitoreo_scalar(hash, ""), .monitoreo_scalar(meta$hash, "")) && identical(meta$status, "valid")) {
          return(list(ok = TRUE, not_modified = TRUE, cache = meta, payload = list(phase = phase, blocks = list(), points = list(), alerts = list(), legend = list())))
        }
        return(list(
          ok = TRUE,
          layer = layer,
          cache = meta,
          payload = list(
            phase = phase,
            blocks = entry$blocks %||% list(),
            features = entry$features %||% list(),
            bounds = entry$bounds %||% list(),
            ump_index = entry$ump_index %||% list(),
            points = list(),
            alerts = list(),
            legend = list()
          )
        ))
      }
      if (identical(layer, "gps_points")) {
        if (isTRUE(prepare_missing)) {
          .monitoreo_territorial_prepare_map_cache(sid, cfg, data, phase = phase, layers = "gps_points")
        }
        cache <- .monitoreo_territorial_map_cache_get(sid)
        context <- .monitoreo_territorial_context(sid, cfg, phase = phase)
        route_hash <- .monitoreo_territorial_route_hash(context, phase = phase)
        gps_hash <- .monitoreo_territorial_gps_hash(data, cfg, context, route_hash, phase = phase)
        entry <- cache$phases[[phase]]$gps_points %||% NULL
        meta <- .monitoreo_territorial_layer_meta(entry, gps_hash, route_hash)
        if (!identical(meta$status, "valid") && !isTRUE(allow_stale)) {
          entry <- list(points = list(), bounds = list())
        }
        if (nzchar(.monitoreo_scalar(hash, "")) && identical(.monitoreo_scalar(hash, ""), .monitoreo_scalar(meta$hash, "")) && identical(meta$status, "valid")) {
          return(list(ok = TRUE, not_modified = TRUE, cache = meta, payload = list(phase = phase, blocks = list(), points = list(), alerts = list(), legend = list())))
        }
        return(list(
          ok = TRUE,
          layer = layer,
          cache = meta,
          payload = list(
            phase = phase,
            blocks = list(),
            points = entry$points %||% list(),
            bounds = entry$bounds %||% list(),
            alerts = list(),
            legend = list()
          )
        ))
      }
      context <- .monitoreo_territorial_context_with_map_cache(
        sid,
        cfg,
        data,
        phase = phase,
        report_scope = "validation_summary",
        allow_stale = allow_stale,
        prepare_missing = prepare_missing
      )
      payload <- monitoreo_territorial_map_payload(
        data,
        cfg,
        context,
        .monitoreo_kobo_schema_for_phase(sid, cfg, phase = phase),
        ubigeo = ubigeo %||% ""
      )
      list(ok = TRUE, layer = layer, cache = context$map_cache %||% list(), payload = payload)
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/map/prepare", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      phase <- .monitoreo_territorial_phase(parsed$phase %||% parsed$route_phase %||% parsed$routePhase %||% cfg$territorial$active_route_phase, "pilot")
      layers <- .monitoreo_chr_vec(parsed$layers %||% parsed$layer %||% .monitoreo_territorial_map_cache_layers)
      layers <- intersect(layers, .monitoreo_territorial_map_cache_layers)
      if (!length(layers)) layers <- .monitoreo_territorial_map_cache_layers
      cache <- .monitoreo_territorial_map_cache_get(sid)
      phase_cache <- cache$phases[[phase]] %||% list()
      if (!isTRUE(.monitoreo_bool(parsed$force, FALSE))) {
        ready <- all(vapply(layers, function(layer) {
          entry <- phase_cache[[layer]] %||% NULL
          is.list(entry) && identical(.monitoreo_scalar(entry$status, ""), "valid")
        }, logical(1)))
        if (isTRUE(ready)) {
          public <- list(
            ok = TRUE,
            phase = phase,
            layers = as.list(layers),
            map_cache = .monitoreo_territorial_map_cache_meta(sid, cfg, data)
          )
          job_id <- job_submit_completed(
            sid = sid,
            kind = "monitoreo.territorial_map_prepare",
            result_data = public
          )
          return(list(ok = TRUE, job_id = job_id, kind = "monitoreo.territorial_map_prepare", cache_hit = TRUE))
        }
      }
      session_path <- job_save_rds(sid, "monitoreo_territorial_map_prepare_session", s)
      job_id <- job_submit(
        sid = sid,
        kind = "monitoreo.territorial_map_prepare",
        func = .monitoreo_territorial_map_prepare_job,
        args = list(
          session_path = session_path,
          phase = phase,
          layers = layers,
          force = .monitoreo_bool(parsed$force, FALSE)
        ),
        on_complete = .monitoreo_territorial_map_prepare_on_complete
      )
      list(ok = TRUE, job_id = job_id, kind = "monitoreo.territorial_map_prepare")
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/occurrences/config", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      patch <- parsed$field_occurrences %||% parsed$occurrences %||% parsed$config %||% parsed
      tcfg <- cfg$territorial
      occ <- tcfg$field_occurrences %||% list()
      for (nm in names(patch)) occ[[nm]] <- patch[[nm]]
      tcfg$field_occurrences <- occ
      cfg$territorial <- monitoreo_territorial_normalize_config(tcfg, data)
      occ <- cfg$territorial$field_occurrences %||% list()
      asset_uid <- .monitoreo_scalar(occ$asset_uid, "")
      if (nzchar(asset_uid)) {
        profile_id <- .monitoreo_scalar(occ$connection_profile_id, "")
        base_url <- .monitoreo_scalar(occ$base_url, "")
        if (!nzchar(base_url)) base_url <- .connections_profile_base_url("kobo", profile_id)
        if (!nzchar(.monitoreo_scalar(base_url, ""))) base_url <- kobo_api_default_base_url()
        base_url <- .kobo_api_trim_base_url(base_url)
        asset_name <- .monitoreo_scalar(occ$asset_name %||% occ$form_title, "Ocurrencias de campo")
        asset_url <- .monitoreo_scalar(occ$asset_url, "")
        if (!nzchar(asset_url)) asset_url <- .monitoreo_scalar(occ$survey_url, "")
        if (!nzchar(asset_url)) asset_url <- kobo_api_asset_url(asset_uid, base_url = base_url)
        survey_url <- .monitoreo_scalar(occ$survey_url, "")
        if (!nzchar(survey_url)) survey_url <- asset_url
        source_id <- .monitoreo_scalar(occ$source_id, "")
        if (!nzchar(source_id)) source_id <- paste0("kobo_occurrences_", .monitoreo_safe_name(asset_uid))
        source <- list(
          id = source_id,
          kind = "kobo",
          label = asset_name,
          enabled = TRUE,
          role = "ocurrencias_campo",
          integration_mode = "connected_read",
          asset_uid = asset_uid,
          base_url = base_url,
          survey_url = survey_url,
          asset_url = asset_url,
          connection_profile_id = profile_id
        )
        sources <- monitoreo_upsert_source(s$monitoreo_sources %||% list(), source)
        session_set(sid, "monitoreo_sources", sources)
        occ$enabled <- TRUE
        occ$asset_uid <- asset_uid
        occ$asset_name <- asset_name
        occ$source_id <- source_id
        occ$base_url <- base_url
        occ$survey_url <- survey_url
        occ$asset_url <- asset_url
        occ$connection_profile_id <- profile_id
        status <- .monitoreo_scalar(occ$status, "")
        if (!nzchar(status) || identical(status, "not_configured")) occ$status <- "configured"
        tcfg <- cfg$territorial
        tcfg$field_occurrences <- occ
        cfg$territorial <- monitoreo_territorial_normalize_config(tcfg, data)
      }
      cfg <- .monitoreo_store_config(sid, cfg)
      saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
      list(
        ok = TRUE,
        config = cfg,
        field_occurrences = .monitoreo_territorial_occurrences_dashboard(sid, cfg),
        state = .monitoreo_state_payload(sid),
        saved_project = !is.null(saved_project)
      )
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/occurrences/inspect", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      sources <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
      source_id <- .monitoreo_scalar(parsed$source_id %||% parsed$sourceId %||% cfg$territorial$field_occurrences$source_id, "")
      asset_uid <- .monitoreo_scalar(parsed$asset_uid %||% parsed$assetUid %||% cfg$territorial$field_occurrences$asset_uid, "")
      source <- NULL
      if (nzchar(source_id)) {
        hit <- Filter(function(src) identical(.monitoreo_scalar(src$id, ""), source_id), sources)
        if (length(hit)) source <- hit[[1]]
      }
      if (is.null(source) && nzchar(asset_uid)) {
        hit <- Filter(function(src) {
          identical(.monitoreo_scalar(src$asset_uid, ""), asset_uid) &&
            identical(.monitoreo_scalar(src$role, ""), "ocurrencias_campo")
        }, sources)
        if (length(hit)) source <- hit[[1]]
      }
      if (!nzchar(asset_uid)) asset_uid <- .monitoreo_scalar(source$asset_uid, "")
      if (!nzchar(asset_uid)) {
        stop_api(400, "E_OCCURRENCES_ASSET_REQUIRED", "Selecciona primero un formulario Kobo para ocurrencias.")
      }
      profile_id <- parsed$connection_profile_id %||% parsed$connectionProfileId %||% parsed$profile_id %||% parsed$profileId %||%
        source$connection_profile_id %||% cfg$territorial$field_occurrences$connection_profile_id %||% NULL
      base_url <- .monitoreo_scalar(parsed$base_url %||% parsed$baseUrl, "")
      if (!nzchar(base_url)) base_url <- .monitoreo_scalar(source$base_url, "")
      if (!nzchar(base_url)) base_url <- .monitoreo_scalar(cfg$territorial$field_occurrences$base_url, "")
      if (!nzchar(base_url)) base_url <- .connections_profile_base_url("kobo", profile_id)
      if (!nzchar(.monitoreo_scalar(base_url, ""))) base_url <- kobo_api_default_base_url()
      token <- .connections_token_require("kobo", sid, profile_id = profile_id, base_url = base_url)
      detail <- tryCatch(
        .monitoreo_kobo_asset_detail(asset_uid, token, base_url),
        error = function(e) stop_api(400, "E_KOBO_OCCURRENCES_SCHEMA", conditionMessage(e))
      )
      schema <- .monitoreo_kobo_schema_from_asset(detail)
      schema$base_url <- .kobo_api_trim_base_url(base_url)
      schema$inspected_at <- .monitoreo_now_iso()
      field_check <- .monitoreo_territorial_occurrences_schema_check(schema)
      list(
        ok = TRUE,
        asset_uid = asset_uid,
        base_url = .kobo_api_trim_base_url(base_url),
        inspected_at = schema$inspected_at,
        schema = schema,
        field_check = field_check
      )
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/occurrences/xlsform", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      phase <- .monitoreo_scalar(parsed$phase %||% parsed$route_phase %||% parsed$routePhase, "field")
      if (!phase %in% c("pilot", "field")) phase <- "field"
      context <- .monitoreo_territorial_context(sid, cfg, phase = phase)
      title <- .monitoreo_scalar(parsed$form_title %||% parsed$formTitle %||% cfg$territorial$field_occurrences$form_title, "OCURRENCIAS DE TRABAJO DE CAMPO")
      form_id <- .monitoreo_scalar(parsed$form_id %||% parsed$formId %||% cfg$territorial$field_occurrences$form_id, "ocurrencias_trabajo_campo")
      filename <- paste0(.monitoreo_safe_name(form_id), "_", format(Sys.time(), "%Y%m%d%H%M%S", tz = "UTC"), ".xlsx")
      out_path <- file.path(tempdir(), paste0(uuid::UUIDgenerate(), "_", filename))
      xls <- tryCatch(
        monitoreo_territorial_occurrences_xlsform(
          context,
          out_path,
          title = title,
          form_id = form_id,
          enumerator_roster = cfg$territorial$enumerator_roster %||% list()
        ),
        error = function(e) stop_api(400, "E_OCCURRENCES_XLSFORM", conditionMessage(e))
      )
      meta <- .register_output_file(sid, "monitoreo_ocurrencias_xlsform", out_path, original_name = basename(xls$filename))
      tcfg <- cfg$territorial
      occ <- tcfg$field_occurrences %||% list()
      occ$form_title <- xls$form_title
      occ$form_id <- xls$form_id
      occ$status <- "generated"
      occ$generated_at <- .monitoreo_now_iso()
      occ$xlsform_file_id <- meta$file_id
      occ$xlsform_filename <- meta$original_name
      occ$route_phase <- xls$route_phase
      occ$route_choices <- xls$route_choices
      tcfg$field_occurrences <- occ
      cfg$territorial <- monitoreo_territorial_normalize_config(tcfg, data)
      cfg <- .monitoreo_store_config(sid, cfg)
      .monitoreo_territorial_occurrences_history_add(sid, list(
        type = "xlsform",
        asset_uid = "",
        asset_name = xls$form_title,
        version_id = xls$version,
        source_id = "",
        response_count = 0L,
        status = "ok",
        message = "XLSForm de ocurrencias generado desde Hojas de Ruta."
      ))
      saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
      list(
        ok = TRUE,
        file = meta,
        xlsform = xls,
        config = cfg,
        field_occurrences = .monitoreo_territorial_occurrences_dashboard(sid, cfg),
        state = .monitoreo_state_payload(sid),
        saved_project = !is.null(saved_project)
      )
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/occurrences/upload-kobo", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      phase <- .monitoreo_scalar(parsed$phase %||% parsed$route_phase %||% parsed$routePhase, "field")
      if (!phase %in% c("pilot", "field")) phase <- "field"
      context <- .monitoreo_territorial_context(sid, cfg, phase = phase)
      title <- .monitoreo_scalar(parsed$form_title %||% parsed$formTitle %||% cfg$territorial$field_occurrences$form_title, "OCURRENCIAS DE TRABAJO DE CAMPO")
      form_id <- .monitoreo_scalar(parsed$form_id %||% parsed$formId %||% cfg$territorial$field_occurrences$form_id, "ocurrencias_trabajo_campo")
      requested_file_id <- .monitoreo_scalar(
        parsed$xlsform_file_id %||% parsed$xlsformFileId %||% cfg$territorial$field_occurrences$xlsform_file_id,
        ""
      )
      file_meta <- NULL
      out_path <- ""
      route_choices <- cfg$territorial$field_occurrences$route_choices %||% list()
      xls <- NULL
      if (nzchar(requested_file_id)) {
        file_meta <- tryCatch(
          get_file(sid, requested_file_id),
          error = function(e) stop_api(404, "E_OCCURRENCES_XLSFORM_FILE", "No se encontro el XLSForm generado para subir a Kobo.")
        )
        out_path <- .monitoreo_scalar(file_meta$path, "")
        if (!nzchar(out_path) || !file.exists(out_path)) {
          stop_api(404, "E_OCCURRENCES_XLSFORM_FILE", "El XLSForm generado ya no esta disponible en el disco local.")
        }
        xls <- list(
          form_title = title,
          form_id = .monitoreo_safe_name(form_id),
          route_phase = phase,
          route_choices = route_choices
        )
      } else {
        filename <- paste0(.monitoreo_safe_name(form_id), "_", format(Sys.time(), "%Y%m%d%H%M%S", tz = "UTC"), ".xlsx")
        out_path <- file.path(tempdir(), paste0(uuid::UUIDgenerate(), "_", filename))
        xls <- tryCatch(
          monitoreo_territorial_occurrences_xlsform(
            context,
            out_path,
            title = title,
            form_id = form_id,
            enumerator_roster = cfg$territorial$enumerator_roster %||% list()
          ),
          error = function(e) stop_api(400, "E_OCCURRENCES_XLSFORM", conditionMessage(e))
        )
        route_choices <- xls$route_choices
        file_meta <- .register_output_file(sid, "monitoreo_ocurrencias_xlsform", out_path, original_name = basename(xls$filename))
      }
      profile_id <- parsed$connection_profile_id %||% parsed$connectionProfileId %||% parsed$profile_id %||% parsed$profileId %||% cfg$territorial$field_occurrences$connection_profile_id %||% NULL
      base_url <- .monitoreo_scalar(parsed$base_url %||% parsed$baseUrl, "")
      if (!nzchar(base_url)) base_url <- .monitoreo_scalar(cfg$territorial$field_occurrences$base_url, "")
      if (!nzchar(base_url)) base_url <- .connections_profile_base_url("kobo", profile_id)
      if (!nzchar(.monitoreo_scalar(base_url, ""))) base_url <- kobo_api_default_base_url()
      token <- .connections_token_require("kobo", sid, profile_id = profile_id, base_url = base_url)
      imported <- tryCatch(
        kobo_api_import_xlsform(out_path, token, base_url = base_url),
        error = function(e) stop_api(400, "E_KOBO_OCCURRENCES_IMPORT", conditionMessage(e))
      )
      polled <- tryCatch(
        kobo_api_poll_import(imported, token, base_url = base_url),
        error = function(e) imported
      )
      asset_uid <- kobo_api_import_asset_uid(polled)
      if (!nzchar(asset_uid)) {
        stop_api(400, "E_KOBO_OCCURRENCES_ASSET", "Kobo importo el XLSForm, pero no devolvio un asset UID desplegable.")
      }
      deployment <- tryCatch(
        kobo_api_deploy_asset(asset_uid, token, base_url = base_url),
        error = function(e) stop_api(400, "E_KOBO_OCCURRENCES_DEPLOY", conditionMessage(e))
      )
      detail <- tryCatch(.monitoreo_kobo_asset_detail(asset_uid, token, base_url), error = function(e) list(uid = asset_uid, name = title))
      schema <- .monitoreo_kobo_schema_from_asset(detail)
      survey_url <- kobo_api_survey_url(asset_uid, base_url = base_url, detail = detail, deployment = deployment)
      asset_url <- kobo_api_asset_url(asset_uid, base_url = base_url)
      source_id <- .monitoreo_scalar(cfg$territorial$field_occurrences$source_id, paste0("kobo_occurrences_", .monitoreo_safe_name(asset_uid)))
      source <- list(
        id = source_id,
        kind = "kobo",
        label = .monitoreo_scalar(schema$name, title),
        enabled = TRUE,
        role = "ocurrencias_campo",
        integration_mode = "connected_read",
        asset_uid = asset_uid,
        base_url = .kobo_api_trim_base_url(base_url),
        survey_url = survey_url,
        asset_url = asset_url,
        connection_profile_id = .monitoreo_scalar(profile_id, "")
      )
      sources <- monitoreo_upsert_source(s$monitoreo_sources %||% list(), source)
      session_set(sid, "monitoreo_sources", sources)
      tcfg <- cfg$territorial
      occ <- tcfg$field_occurrences %||% list()
      occ$enabled <- TRUE
      occ$form_title <- title
      occ$form_id <- xls$form_id
      occ$asset_uid <- asset_uid
      occ$asset_name <- .monitoreo_scalar(schema$name, title)
      occ$version_id <- .monitoreo_scalar(schema$version_id %||% deployment$version_id %||% deployment$uid, "")
      occ$source_id <- source_id
      occ$base_url <- .kobo_api_trim_base_url(base_url)
      occ$survey_url <- survey_url
      occ$asset_url <- asset_url
      occ$connection_profile_id <- .monitoreo_scalar(profile_id, "")
      occ$status <- "deployed"
      if (!nzchar(.monitoreo_scalar(occ$generated_at, ""))) occ$generated_at <- .monitoreo_now_iso()
      occ$uploaded_at <- .monitoreo_now_iso()
      occ$xlsform_file_id <- file_meta$file_id
      occ$xlsform_filename <- file_meta$original_name
      occ$route_phase <- xls$route_phase
      occ$route_choices <- route_choices
      tcfg$field_occurrences <- occ
      cfg$territorial <- monitoreo_territorial_normalize_config(tcfg, data)
      cfg <- .monitoreo_store_config(sid, cfg)
      .monitoreo_territorial_occurrences_history_add(sid, list(
        type = "upload",
        asset_uid = asset_uid,
        asset_name = occ$asset_name,
        version_id = occ$version_id,
        source_id = source_id,
        response_count = 0L,
        status = "ok",
        message = "Formulario de ocurrencias subido y desplegado en Kobo."
      ))
      list(
        ok = TRUE,
        file = file_meta,
        upload = list(asset_uid = asset_uid, version_id = occ$version_id, survey_url = survey_url, asset_url = asset_url, deployment = deployment),
        source = source,
        config = cfg,
        field_occurrences = .monitoreo_territorial_occurrences_dashboard(sid, cfg),
        state = .monitoreo_state_payload(sid)
      )
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/occurrences/ump-export", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      .monitoreo_ump_export(sid, parsed)
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/occurrences/sync", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      main_data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), main_data)
      sources <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
      source_id <- .monitoreo_scalar(parsed$source_id %||% parsed$sourceId %||% cfg$territorial$field_occurrences$source_id, "")
      asset_uid <- .monitoreo_scalar(parsed$asset_uid %||% parsed$assetUid %||% cfg$territorial$field_occurrences$asset_uid, "")
      source <- NULL
      if (nzchar(source_id)) {
        hit <- Filter(function(src) identical(.monitoreo_scalar(src$id, ""), source_id), sources)
        if (length(hit)) source <- hit[[1]]
      }
      if (is.null(source) && nzchar(asset_uid)) {
        hit <- Filter(function(src) identical(.monitoreo_scalar(src$asset_uid, ""), asset_uid) && identical(.monitoreo_scalar(src$role, ""), "ocurrencias_campo"), sources)
        if (length(hit)) source <- hit[[1]]
      }
      if (is.null(source) && nzchar(asset_uid)) {
        source <- list(
          id = if (nzchar(source_id)) source_id else paste0("kobo_occurrences_", .monitoreo_safe_name(asset_uid)),
          kind = "kobo",
          label = .monitoreo_scalar(cfg$territorial$field_occurrences$asset_name %||% cfg$territorial$field_occurrences$form_title, "Ocurrencias de campo"),
          enabled = TRUE,
          role = "ocurrencias_campo",
          integration_mode = "connected_read",
          asset_uid = asset_uid,
          base_url = .monitoreo_scalar(cfg$territorial$field_occurrences$base_url, kobo_api_default_base_url()),
          survey_url = .monitoreo_scalar(cfg$territorial$field_occurrences$survey_url, ""),
          asset_url = .monitoreo_scalar(cfg$territorial$field_occurrences$asset_url, ""),
          connection_profile_id = .monitoreo_scalar(cfg$territorial$field_occurrences$connection_profile_id, "")
        )
      }
      if (is.null(source) || !nzchar(.monitoreo_scalar(source$asset_uid, ""))) {
        stop_api(409, "E_OCCURRENCES_SOURCE", "Primero sube o configura el formulario Kobo de ocurrencias.")
      }
      profile_id <- .monitoreo_scalar(source$connection_profile_id %||% parsed$connection_profile_id %||% parsed$connectionProfileId, "")
      base_url <- .monitoreo_scalar(source$base_url, "")
      if (!nzchar(base_url)) base_url <- .monitoreo_scalar(parsed$base_url %||% parsed$baseUrl, "")
      if (!nzchar(base_url)) base_url <- .connections_profile_base_url("kobo", profile_id)
      if (!nzchar(base_url)) base_url <- kobo_api_default_base_url()
      token <- .connections_token_require("kobo", sid, profile_id = profile_id, base_url = base_url)
      if (!nzchar(.monitoreo_scalar(source$asset_url, ""))) {
        source$asset_url <- kobo_api_asset_url(source$asset_uid, base_url = base_url)
      }
      if (!nzchar(.monitoreo_scalar(source$survey_url, ""))) {
        source$survey_url <- .monitoreo_scalar(cfg$territorial$field_occurrences$survey_url, source$asset_url)
      }
      payload <- tryCatch(
        kobo_api_fetch_all_asset_data(source$asset_uid, token, base_url = base_url),
        error = function(e) stop_api(400, "E_KOBO_OCCURRENCES_SYNC", conditionMessage(e))
      )
      data <- kobo_api_flatten_results(payload$results)
      data <- tryCatch(monitoreo_enrich_kobo_datetime_columns(data), error = function(e) data)
      data <- .monitoreo_add_source_columns(data, source)
      synced_at <- .monitoreo_now_iso()
      source$last_sync_at <- synced_at
      sources <- monitoreo_upsert_source(sources, source)
      session_set(sid, "monitoreo_sources", sources)
      tcfg <- cfg$territorial
      occ <- tcfg$field_occurrences %||% list()
      occ$enabled <- TRUE
      occ$asset_uid <- .monitoreo_scalar(source$asset_uid, "")
      occ$asset_name <- .monitoreo_scalar(source$label, occ$form_title %||% "Ocurrencias de campo")
      occ$source_id <- .monitoreo_scalar(source$id, "")
      occ$base_url <- .kobo_api_trim_base_url(base_url)
      occ$survey_url <- .monitoreo_scalar(source$survey_url, "")
      occ$asset_url <- .monitoreo_scalar(source$asset_url, "")
      occ$connection_profile_id <- profile_id
      occ$last_sync_at <- synced_at
      occ$status <- "synced"
      tcfg$field_occurrences <- occ
      cfg$territorial <- monitoreo_territorial_normalize_config(tcfg, main_data)
      cfg <- .monitoreo_store_config(sid, cfg)
      session_set(sid, "monitoreo_territorial_occurrences_snapshot", list(
        synced_at = synced_at,
        data = data,
        source_id = source$id,
        asset_uid = source$asset_uid
      ))
      report <- .monitoreo_territorial_occurrences_dashboard(sid, cfg)
      .monitoreo_territorial_occurrences_history_add(sid, list(
        type = "sync",
        asset_uid = source$asset_uid,
        asset_name = source$label,
        version_id = .monitoreo_scalar(occ$version_id, ""),
        source_id = source$id,
        response_count = nrow(data),
        status = "ok",
        message = "Ocurrencias Kobo sincronizadas."
      ))
      list(
        ok = TRUE,
        synced_at = synced_at,
        n_rows = as.integer(nrow(data)),
        field_occurrences = report,
        state = .monitoreo_state_payload(sid)
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
            snapshot_name <- .monitoreo_snapshot_first_text(
              data,
              c(
                "collector_name", "Nombre recopilador", "nombre_recopilador", "Nombre del recopilador",
                "Recopilador", "recopilador", "Collector Name", "Collector", "collector"
              ),
              .monitoreo_scalar(source$id, ""),
              collector_id
            )
            saved_name <- .monitoreo_scalar(saved$collector_name %||% saved$label %||% saved$nombre, "")
            fallback_name <- .monitoreo_best_collector_name(snapshot_name, saved_name, collector_id)
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

        profile_id <- .monitoreo_source_connection_profile_id(source, parsed, "surveymonkey")
        token <- .connections_token_require("surveymonkey", sid, profile_id = profile_id)
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
      previous_sources <- session_get(sid)$monitoreo_sources %||% list()
      previous_match <- .monitoreo_source_match(previous_sources, source)
      if (identical(kind, "surveymonkey") && !nzchar(source$survey_title %||% "") && !is.null(previous_match)) {
        source$survey_title <- .monitoreo_scalar(previous_match$survey_title %||% previous_match$label, "")
      }
      local_surveymonkey_update <- identical(kind, "surveymonkey") &&
        !isTRUE(.monitoreo_bool(parsed$validate %||% parsed$force_validate %||% parsed$forceValidate, FALSE)) &&
        (nzchar(source$survey_title %||% "") || !is.null(previous_match))
      validation <- if (isTRUE(local_surveymonkey_update)) {
        list(
          ok = TRUE,
          title = .monitoreo_scalar(source$survey_title %||% source$label, ""),
          responses_scope = list(ok = NA, skipped = TRUE, reason = "local_source_update")
        )
      } else {
        .monitoreo_validate_source(source, sid)
      }
      if (identical(kind, "surveymonkey") && !nzchar(source$survey_title %||% "") && nzchar(validation$title %||% "")) {
        source$survey_title <- validation$title
      }
      if (identical(kind, "surveymonkey") && !nzchar(label_raw) && nzchar(validation$title %||% "")) {
        source$label <- validation$title
      }
      source <- .monitoreo_preserve_source_operational_metadata(source, previous_match)
      sources <- monitoreo_upsert_source(previous_sources, source)
      session_set(sid, "monitoreo_sources", sources)
      snapshot <- session_get(sid)$monitoreo_snapshot %||% NULL
      if (is.list(snapshot) && nzchar(.monitoreo_scalar(snapshot$generated_at, ""))) {
        snapshot$generation_status <- "stale"
        snapshot$pending_regeneration <- TRUE
        session_set(sid, "monitoreo_snapshot", snapshot)
      }
      .monitoreo_invalidate_dashboard_caches(sid)
      list(ok = TRUE, source = source, validation = validation, state = .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = "source"))
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
        previous_match <- .monitoreo_source_match(sources, source)
        if (identical(kind, "surveymonkey") && !nzchar(source$survey_title %||% "") && !is.null(previous_match)) {
          source$survey_title <- .monitoreo_scalar(previous_match$survey_title %||% previous_match$label, "")
        }
        local_surveymonkey_update <- identical(kind, "surveymonkey") &&
          !isTRUE(.monitoreo_bool(item$validate %||% item$force_validate %||% item$forceValidate, FALSE)) &&
          (nzchar(source$survey_title %||% "") || !is.null(previous_match))
        validation <- if (isTRUE(local_surveymonkey_update)) {
          list(
            ok = TRUE,
            title = .monitoreo_scalar(source$survey_title %||% source$label, ""),
            responses_scope = list(ok = NA, skipped = TRUE, reason = "local_source_import")
          )
        } else {
          .monitoreo_validate_source(source, sid)
        }
        if (identical(kind, "surveymonkey") && !nzchar(source$survey_title %||% "") && nzchar(validation$title %||% "")) {
          source$survey_title <- validation$title
        }
        if (identical(kind, "surveymonkey") && !nzchar(label_raw) && nzchar(validation$title %||% "")) {
          source$label <- validation$title
        }
        source <- .monitoreo_preserve_source_operational_metadata(source, previous_match)
        sources <- monitoreo_upsert_source(sources, source)
        added[[length(added) + 1L]] <- source
        validations[[source$id %||% as.character(length(validations) + 1L)]] <- validation
      }
      session_set(sid, "monitoreo_sources", sources)
      snapshot <- session_get(sid)$monitoreo_snapshot %||% NULL
      if (is.list(snapshot) && nzchar(.monitoreo_scalar(snapshot$generated_at, ""))) {
        snapshot$generation_status <- "stale"
        snapshot$pending_regeneration <- TRUE
        session_set(sid, "monitoreo_snapshot", snapshot)
      }
      .monitoreo_invalidate_dashboard_caches(sid)
      list(ok = TRUE, sources = added, validations = validations, state = .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = "source"))
    })) |>
    plumber::pr_post("/api/monitoreo/config", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      data <- .monitoreo_apply_source_metadata_to_data(data, monitoreo_normalize_sources(s$monitoreo_sources %||% list()))
      cfg <- .monitoreo_request_config(parsed$config %||% parsed, s$monitoreo_config %||% list(), data)
      cfg <- .monitoreo_store_config(sid, cfg)
      list(ok = TRUE, config = cfg, state = .monitoreo_state_payload(sid))
    })) |>
    plumber::pr_post("/api/monitoreo/acreditacion/case-reconciliation", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      payload <- parsed$decision %||% parsed
      response_id <- .monitoreo_scalar(payload$response_id %||% payload$responseId, "")
      action <- .monitoreo_scalar(payload$action %||% payload$accion, "")
      if (!nzchar(response_id)) stop_api(400, "E_MONITOREO_RESPONSE_ID", "Falta response_id para guardar la decision.")
      if (!action %in% c("keep_excluded", "include_with_caveat")) {
        stop_api(400, "E_MONITOREO_DECISION_ACTION", "action debe ser keep_excluded o include_with_caveat.")
      }

      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      data <- .monitoreo_apply_source_metadata_to_data(data, monitoreo_normalize_sources(s$monitoreo_sources %||% list()))
      applied <- .monitoreo_acreditacion_apply_case_reconciliation(data, s$monitoreo_config %||% list(), payload)
      cfg <- .monitoreo_store_config(sid, applied$config)
      saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
      list(ok = TRUE, decision = applied$decision, config = cfg, state = .monitoreo_state_payload(sid), saved_project = !is.null(saved_project))
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
    plumber::pr_post("/api/monitoreo/aulas/import-from-calc-muestra", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      estudio <- parsed$estudio %||% s$calc_muestra_estudio %||% NULL
      selection <- parsed$selection %||% s$calc_muestra_aulas_selection %||% NULL
      frame <- parsed$frame %||% s$calc_muestra_aulas_frame %||% NULL
      if (is.null(selection)) {
        stop_api(409, "E_NO_CALC_MUESTRA_AULAS",
                 "No hay seleccion de aulas de calc-muestra para importar.")
      }
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      aulas <- tryCatch(
        monitoreo_aulas_from_calc(estudio, selection, frame, parsed$config %||% cfg$aulas_universitarias %||% list()),
        error = function(e) stop_api(400, "E_AULAS_IMPORT", conditionMessage(e))
      )
      cfg$monitoreo_profile <- monitoreo_normalize_profile(list(
        family = "aulas_universitarias",
        variant = "multi_actor",
        status = "active",
        route_selected = TRUE,
        locked_at = .monitoreo_now_iso()
      ))
      cfg$aulas_universitarias <- aulas
      session_set(sid, "monitoreo_aulas_plan", aulas$plan)
      session_set(sid, "monitoreo_aulas_publication", list(
        publication_family = "university_classroom_fieldwork",
        imported_at = aulas$imported_at,
        selection_run_id = aulas$selection_run_id,
        frame_hash = aulas$frame_hash
      ))
      cfg <- .monitoreo_store_config(sid, cfg, rebuild_dashboard = TRUE)
      dashboard <- monitoreo_aulas_dashboard(aulas$plan, data, aulas)
      session_set(sid, "monitoreo_aulas_snapshot", list(
        synced_at = .monitoreo_now_iso(),
        dashboard = dashboard,
        response_rows = as.integer(nrow(data))
      ))
      saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
      list(ok = TRUE, aulas_universitarias = cfg$aulas_universitarias, state = .monitoreo_state_payload(sid), saved_project = !is.null(saved_project))
    })) |>
    plumber::pr_post("/api/monitoreo/aulas/config", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      incoming <- parsed$config %||% parsed$aulas_universitarias %||% parsed
      current <- cfg$aulas_universitarias %||% monitoreo_aulas_default_config()
      if (!is.list(incoming)) incoming <- list()
      for (nm in names(incoming)) current[[nm]] <- incoming[[nm]]
      cfg$aulas_universitarias <- monitoreo_aulas_normalize_config(current)
      profile <- cfg$monitoreo_profile %||% list()
      profile$family <- "aulas_universitarias"
      profile$status <- "active"
      profile$route_selected <- TRUE
      cfg$monitoreo_profile <- monitoreo_normalize_profile(profile)
      session_set(sid, "monitoreo_aulas_plan", cfg$aulas_universitarias$plan)
      cfg <- .monitoreo_store_config(sid, cfg, rebuild_dashboard = TRUE)
      saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
      list(ok = TRUE, aulas_universitarias = cfg$aulas_universitarias, config = cfg, state = .monitoreo_state_payload(sid), saved_project = !is.null(saved_project))
    })) |>
    plumber::pr_post("/api/monitoreo/aulas/agenda", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      updates <- parsed$updates %||% parsed$agenda %||% parsed$plan %||% parsed
      plan <- tryCatch(
        monitoreo_aulas_update_agenda(cfg$aulas_universitarias$plan %||% list(), updates),
        error = function(e) stop_api(400, "E_AULAS_AGENDA", conditionMessage(e))
      )
      cfg$aulas_universitarias$enabled <- TRUE
      cfg$aulas_universitarias$plan <- plan
      profile <- cfg$monitoreo_profile %||% list()
      profile$family <- "aulas_universitarias"
      profile$status <- "active"
      profile$route_selected <- TRUE
      cfg$monitoreo_profile <- monitoreo_normalize_profile(profile)
      session_set(sid, "monitoreo_aulas_plan", plan)
      cfg <- .monitoreo_store_config(sid, cfg, rebuild_dashboard = TRUE)
      saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
      list(ok = TRUE, agenda = plan, aulas_universitarias = cfg$aulas_universitarias, state = .monitoreo_state_payload(sid), saved_project = !is.null(saved_project))
    })) |>
    plumber::pr_post("/api/monitoreo/aulas/reemplazo", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      plan <- tryCatch(
        monitoreo_aulas_apply_replacement(
          cfg$aulas_universitarias$plan %||% list(),
          parsed$classroom_id %||% parsed$aula_caida %||% parsed$aulaCaida,
          parsed$replacement_id %||% parsed$reserva_usada %||% parsed$reservaUsada,
          parsed$reason %||% parsed$motivo %||% "otro",
          parsed$note %||% parsed$nota %||% ""
        ),
        error = function(e) stop_api(400, "E_AULAS_REEMPLAZO", conditionMessage(e))
      )
      cfg$aulas_universitarias$enabled <- TRUE
      cfg$aulas_universitarias$plan <- plan
      profile <- cfg$monitoreo_profile %||% list()
      profile$family <- "aulas_universitarias"
      profile$status <- "active"
      profile$route_selected <- TRUE
      cfg$monitoreo_profile <- monitoreo_normalize_profile(profile)
      session_set(sid, "monitoreo_aulas_plan", plan)
      cfg <- .monitoreo_store_config(sid, cfg, rebuild_dashboard = TRUE)
      saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
      list(ok = TRUE, agenda = plan, aulas_universitarias = cfg$aulas_universitarias, state = .monitoreo_state_payload(sid), saved_project = !is.null(saved_project))
    })) |>
    plumber::pr_post("/api/monitoreo/aulas/sync", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      current_snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(parsed$responses)) {
        .monitoreo_aulas_df(parsed$responses, "responses")
      } else if (!is.null(current_snapshot) && is.data.frame(current_snapshot$data)) {
        current_snapshot$data
      } else {
        data.frame()
      }
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      profile <- cfg$monitoreo_profile %||% list()
      profile$family <- "aulas_universitarias"
      profile$status <- "active"
      profile$route_selected <- TRUE
      cfg$monitoreo_profile <- monitoreo_normalize_profile(profile)
      cfg$aulas_universitarias$enabled <- TRUE
      dashboard <- monitoreo_build_dashboard(data, cfg, include_reports = TRUE)
      snapshot <- current_snapshot %||% list()
      snapshot$data <- data
      snapshot$config <- cfg
      snapshot$dashboard <- dashboard
      snapshot$synced_at <- .monitoreo_now_iso()
      session_set(sid, "monitoreo_config", cfg)
      session_set(sid, "monitoreo_snapshot", snapshot)
      session_set(sid, "monitoreo_aulas_snapshot", list(
        synced_at = snapshot$synced_at,
        dashboard = dashboard$aulas_universitarias_reports %||% list(),
        response_rows = as.integer(nrow(data))
      ))
      saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
      list(ok = TRUE, synced_at = snapshot$synced_at, dashboard = dashboard$aulas_universitarias_reports, state = .monitoreo_state_payload(sid), saved_project = !is.null(saved_project))
    })) |>
    plumber::pr_get("/api/monitoreo/aulas/state", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      .monitoreo_state_payload(sid)
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
      sync_mode <- .monitoreo_sync_mode(parsed$sync_mode %||% parsed$syncMode %||% parsed$mode %||% "full")
      s <- session_get(sid)
      sources <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
      if (length(parsed$source_ids %||% list())) {
        wanted <- .monitoreo_chr_vec(parsed$source_ids)
        sources <- Filter(function(src) src$id %in% wanted, sources)
      }
      sources <- Filter(function(src) !identical(.monitoreo_scalar(src$role, ""), "ocurrencias_campo"), sources)
      if (.monitoreo_sync_mode_is_advance(sync_mode)) {
        sources <- Filter(function(src) .monitoreo_scalar(src$kind, "") %in% c("surveymonkey", "kobo"), sources)
      }
      if (!length(sources)) {
        message <- if (.monitoreo_sync_mode_is_advance(sync_mode)) {
          "No hay fuentes activas de respuestas para actualizar avance."
        } else {
          "No hay fuentes activas de encuesta principal para sincronizar."
        }
        stop_api(409, "E_NO_MONITOREO_SOURCES", message)
      }
      cfg <- .monitoreo_request_config(parsed$config %||% NULL, s$monitoreo_config %||% list(), data.frame())
      since <- parsed$since %||% NULL
      connection_tokens <- list()
      for (src in sources) {
        source_id <- .monitoreo_scalar(src$id, "")
        if (!nzchar(source_id)) next
        kind <- .monitoreo_scalar(src$kind, "")
        profile_id <- .monitoreo_source_connection_profile_id(src, parsed, kind)
        token <- if (identical(kind, "surveymonkey")) {
          tryCatch(.connections_token_require("surveymonkey", sid, profile_id = profile_id), error = function(e) "")
        } else if (identical(kind, "kobo")) {
          base_url <- .monitoreo_scalar(src$base_url, "")
          if (!nzchar(base_url)) base_url <- .connections_profile_base_url("kobo", profile_id)
          if (!nzchar(base_url)) base_url <- kobo_api_default_base_url()
          tryCatch(.connections_token_require("kobo", sid, profile_id = profile_id, base_url = base_url), error = function(e) "")
        } else {
          ""
        }
        if (nzchar(token)) connection_tokens[[source_id]] <- token
      }
      sources_path <- job_save_rds(sid, "monitoreo_sources", sources)
      cfg_path <- job_save_rds(sid, "monitoreo_config", cfg)
      connection_tokens_path <- job_save_rds(sid, "monitoreo_connection_tokens", connection_tokens)
      sync_job_runner <- monitoreo_sync_job_runner
      attr(sync_job_runner, "prosecnur_job_function_name") <- "monitoreo_sync_job_runner"
      job_id <- job_submit(
        sid = sid,
        kind = "monitoreo.sync",
	        func = sync_job_runner,
	        args = list(sources_path = sources_path, cfg_path = cfg_path, connection_tokens_path = connection_tokens_path, since = since, sid = sid, sync_mode = sync_mode),
	        on_complete = function(j) {
	          complete_report <- if (!is.null(j$progress_path)) job_progress_writer(j$progress_path) else function(...) invisible(NULL)
	          tryCatch(unlink(connection_tokens_path), error = function(e) NULL)
	          result <- j$result_data
	          family <- result$config$monitoreo_profile$family %||% ""
	          complete_report("merge", percent = 82, message = "Uniendo respuestas nuevas...")
	          synced_source_ids <- .monitoreo_sync_successful_source_ids(
	            result$sync_summary %||% list(),
	            result$data
	          )
	          s_prev <- session_get(j$sid)
	          prev_snapshot <- s_prev$monitoreo_snapshot %||% NULL
	          prev_data <- if (!is.null(prev_snapshot) && is.data.frame(prev_snapshot$data)) prev_snapshot$data else data.frame()
	          incremental_source_ids <- .monitoreo_sync_incremental_source_ids(result$sync_summary %||% list())
	          combined_data <- .monitoreo_merge_sync_result_data(
	            prev_data,
	            result$data,
	            synced_source_ids = synced_source_ids,
	            incremental_source_ids = incremental_source_ids
	          )
	          s_current <- session_get(j$sid)
	          current_cfg <- .monitoreo_request_config(NULL, s_current$monitoreo_config %||% list(), combined_data)
	          result$config <- monitoreo_normalize_config(result$config, combined_data, previous_config = current_cfg)
	          current_family <- current_cfg$monitoreo_profile$family %||% ""
	          family <- result$config$monitoreo_profile$family %||% family
	          if (identical(family, "territorial") && identical(current_family, "territorial")) {
	            current_phase <- .monitoreo_territorial_phase(current_cfg$territorial$active_route_phase, "pilot")
	            result$config$territorial$active_route_phase <- current_phase
	            result$config$territorial$phase_sources <- current_cfg$territorial$phase_sources
	            result$config$territorial <- monitoreo_territorial_normalize_config(
	              result$config$territorial,
	              combined_data,
	              previous = current_cfg$territorial
	            )
	          }
	          report_scope <- if (.monitoreo_sync_mode_is_advance(sync_mode)) "advance_summary" else "full"
	          session_set(j$sid, "monitoreo_config", result$config)
	          s_now <- session_get(j$sid)
	          synced_sources <- monitoreo_normalize_sources(result$sources %||% list())
	          sources_now <- monitoreo_normalize_sources(s_now$monitoreo_sources %||% list())
	          if (length(synced_sources)) {
	            source_ids_now <- vapply(sources_now, function(src) .monitoreo_scalar(src$id, ""), character(1))
	            for (src in synced_sources) {
	              sid_src <- .monitoreo_scalar(src$id, "")
	              if (!nzchar(sid_src)) next
	              idx <- match(sid_src, source_ids_now)
	              if (!is.na(idx) && is.finite(idx) && idx > 0L) {
	                sources_now[[idx]] <- utils::modifyList(sources_now[[idx]], src)
	              } else {
	                sources_now[[length(sources_now) + 1L]] <- src
	                source_ids_now <- c(source_ids_now, sid_src)
	              }
	            }
	          }
	          ids <- synced_source_ids
	          if (!length(ids)) ids <- unique(as.character(result$data$.source_id %||% character(0)))
	          sources_now <- lapply(sources_now, function(src) {
	            if (src$id %in% ids) src$last_sync_at <- result$synced_at
	            src
	          })
	          sources_now <- .monitoreo_hydrate_missing_surveymonkey_collectors(
	            j$sid,
	            sources_now,
	            synced_source_ids = ids,
	            sync_summary = result$sync_summary %||% list()
	          )
	          session_set(j$sid, "monitoreo_sources", sources_now)
	          dashboard_data <- .monitoreo_apply_source_metadata_to_data(combined_data, sources_now)
	          complete_report("dashboard", percent = 90, message = if (identical(report_scope, "advance_summary")) {
	            "Preparando avance y gráficos..."
	          } else {
	            "Preparando tablero local..."
	          })
	          result$dashboard <- .monitoreo_dashboard_for_session(
	            j$sid,
	            dashboard_data,
	            result$config,
	            include_reports = TRUE,
	            report_scope = report_scope
	          )
	          artifacts <- monitoreo_snapshot_artifacts(
	            dashboard_data,
	            result$config,
	            sources = sources_now,
	            dashboard = result$dashboard,
	            synced_at = result$synced_at,
	            errors = result$errors,
	            sync_summary = result$sync_summary %||% list()
	          )
	          display_data_for_token <- if (identical(family, "territorial")) {
	            .monitoreo_territorial_filter_data_for_phase(dashboard_data, result$config)
	          } else {
	            dashboard_data
	          }
	          dashboard_cache_token <- .monitoreo_dashboard_cache_token(
	            list(synced_at = result$synced_at),
	            display_data_for_token,
	            result$config,
	            report_scope = report_scope
	          )
	          snapshot <- c(list(
	            synced_at = result$synced_at,
	            data = combined_data,
	            config = result$config,
	            dashboard = result$dashboard,
	            dashboard_cache_key = .monitoreo_dashboard_cache_key,
	            dashboard_cache_token = dashboard_cache_token,
	            dashboard_report_scope = report_scope,
	            variables = if (nrow(dashboard_data)) monitoreo_variables(dashboard_data) else list(),
	            errors = result$errors
	          ), artifacts)
	          session_set(j$sid, "monitoreo_snapshot", snapshot)
	          session_set(j$sid, paste("monitoreo_dashboard_cache", report_scope, sep = "_"), result$dashboard)
	          session_set(j$sid, paste("monitoreo_dashboard_cache_token", report_scope, sep = "_"), dashboard_cache_token)
	          complete_report("save", percent = 98, message = "Guardando cambios del proyecto...")
	          tryCatch(.monitoreo_mark_project_dirty_if_open(j$sid), error = function(e) NULL)
	          if (identical(family, "territorial")) {
	            synced_kobo <- Filter(function(src) {
	              identical(src$kind, "kobo") &&
	                !identical(.monitoreo_scalar(src$role, ""), "ocurrencias_campo") &&
                (!length(ids) || src$id %in% ids)
            }, sources_now)
	            if (length(synced_kobo)) {
	              for (src in synced_kobo) {
	                phase <- .monitoreo_source_territorial_phase(src)
	                if (!phase %in% c("pilot", "field")) phase <- .monitoreo_territorial_phase(result$config$territorial$active_route_phase, "pilot")
	                phase_src <- .monitoreo_territorial_phase_source(result$config$territorial, phase)
	                .monitoreo_territorial_history_add(j$sid, list(
	                  type = "sync",
	                  asset_uid = .monitoreo_scalar(src$asset_uid %||% phase_src$asset_uid, ""),
	                  asset_name = .monitoreo_scalar(src$label %||% phase_src$kobo_asset_name, ""),
	                  version_id = .monitoreo_scalar(phase_src$kobo_version_id, ""),
	                  source_id = .monitoreo_scalar(src$id, ""),
	                  response_count = .monitoreo_snapshot_count(combined_data, .monitoreo_scalar(src$id, "")),
	                  status = if (length(result$errors %||% list())) "warning" else "ok",
	                  message = if (length(result$errors %||% list())) "Sincronización Kobo completada con alertas." else "Respuestas Kobo sincronizadas."
                ))
              }
            }
          }
	          list(
	            ok = TRUE,
	            synced_at = result$synced_at,
	            n_rows = as.integer(if (identical(family, "territorial")) {
	              nrow(.monitoreo_territorial_filter_data_for_phase(dashboard_data, result$config))
	            } else {
	              nrow(dashboard_data)
	            }),
            n_sources = as.integer(result$n_sources),
	            dashboard = .monitoreo_public_dashboard(result$dashboard),
            sync_mode = sync_mode,
            report_scope = report_scope,
            errors = result$errors,
            sync_summary = result$sync_summary %||% list()
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
    plumber::pr_post("/api/monitoreo/processing-handoff/export", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      .monitoreo_processing_handoff_export(sid, parsed)
    })) |>
    plumber::pr_post("/api/monitoreo/processing-handoff/promote", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      .monitoreo_processing_handoff_promote(sid, parsed)
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
