# Helpers de `mount_monitoreo` — snapshot, dashboard, sync y reporte.
#
# Extraídos de `router_monitoreo.R`, que está congelado a crecimiento
# (`agentic/manifest.json` → `policy.frozen_growth_files`). Mismo paquete y
# mismo namespace: el traslado no cambia comportamiento, solo reparte el
# archivo. La lógica de dominio nueva va al engine, no aquí.

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
.monitoreo_dashboard_cache_token <- function(snapshot, data, cfg, report_scope = "full") {
  # Unidad 3.4b: al token entra solo la partición del config que afecta el
  # cálculo de reportes (ver monitoreo_perf_config_for_cache_token); editar
  # metadata de publicación/inspección ya no invalida los 7 scopes.
  cfg_json <- .monitoreo_dashboard_config_json(monitoreo_perf_config_for_cache_token(cfg))
  # Fingerprint barato en vez de sha256 de la data (ver monitoreo_perf.R).
  data_hash <- tryCatch(monitoreo_data_fingerprint(data, snapshot$synced_at %||% ""), error = function(e) "")
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
.monitoreo_dashboard_for_session <- function(sid, data, cfg, include_reports = TRUE, report_scope = "full", cached_acreditacion_reports = NULL) {
  .monitoreo_perf_note_dashboard_build()
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
.monitoreo_snapshot_unique_count <- function(data, column, source_id = "", collector_id = "") {
  values <- as.character(.monitoreo_snapshot_values(data, column, source_id, collector_id))
  values <- trimws(values[!is.na(values) & nzchar(trimws(values))])
  as.integer(length(unique(values)))
}
