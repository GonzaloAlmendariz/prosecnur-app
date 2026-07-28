# Helpers de `mount_monitoreo` — publicación a Sheets y preflight.
#
# Extraídos de `router_monitoreo.R`, que está congelado a crecimiento
# (`agentic/manifest.json` → `policy.frozen_growth_files`). Mismo paquete y
# mismo namespace: el traslado no cambia comportamiento, solo reparte el
# archivo. La lógica de dominio nueva va al engine, no aquí.

.monitoreo_publication_sheet_event_key <- function(audience = "client") {
  paste0("monitoreo_publication_sheet_events_", .monitoreo_public_audience(audience))
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
  # Unidad 3.8b: preflight y publish comparten el MISMO payload de tabs por
  # corte; la caché por token evita computarlo dos veces (ver monitoreo_perf.R).
  tabs_key <- monitoreo_perf_publication_tabs_key(sid, snapshot, cfg, audience, include_targets, report_scope, spreadsheet_id, publication_family)
  tabs <- monitoreo_perf_publication_tabs_cached(sid, audience, tabs_key, function() monitoreo_publication_sheets_tabs(
    snapshot$data,
    cfg,
    audience = audience,
    include_targets = include_targets,
    dashboard = dashboard,
    synced_at = snapshot$synced_at %||% "",
    context = list(session_id = sid, spreadsheet_id = spreadsheet_id, spreadsheet_url = spreadsheet_url, family = publication_family)
  ))
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
.monitoreo_sheets_stop <- function(e) {
  stop_api(400, "E_GOOGLE_SHEETS", conditionMessage(e))
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
