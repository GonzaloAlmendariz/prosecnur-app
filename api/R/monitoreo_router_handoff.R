# Helpers de `mount_monitoreo` — handoff de procesamiento.
#
# Extraídos de `router_monitoreo.R`, que está congelado a crecimiento
# (`agentic/manifest.json` → `policy.frozen_growth_files`). Mismo paquete y
# mismo namespace: el traslado no cambia comportamiento, solo reparte el
# archivo. La lógica de dominio nueva va al engine, no aquí.

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
  # ADR 0030 Fase 1: delega en el helper compartido .dn_backfill_missing_columns
  # (consolida el backfill duplicado con .carga_backfill_missing_expected). Aquí el
  # set esperado es el contrato del handoff (.carga_data_survey_names), que incluye
  # calculate/matrix-header, no la base ancha estricta.
  .dn_backfill_missing_columns(data, .carga_data_survey_names(instrumento))
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

  # Contrato Monitoreo->Procesamiento: el instrumento SIEMPRE sale del XLSForm
  # LOCAL que subio el usuario (ultima version descargada de Kobo), NUNCA de la
  # API de Kobo. El pull multi-version de la API arrastraba columnas fantasma, y
  # para Kobo todo es local (bajar la ultima version del formulario es trivial).
  # Por eso NO se candidatea el instrumento de la API aca; el candidato de la base
  # del estudio (arriba) y los del file store (abajo) cubren el caso, y el scoring
  # de compatibilidad form<->data se mantiene intacto. La descarga
  # `.monitoreo_processing_handoff_kobo_detail` sigue existiendo para otros usos.
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
        "No hay XLSForm exacto para Procesamiento. Sube el XLSForm del formulario (la ultima version descargada de Kobo) antes de traer la data a Procesamiento."
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
      "Sube el XLSForm del formulario (la ultima version descargada de Kobo) antes de generar el paquete."
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
