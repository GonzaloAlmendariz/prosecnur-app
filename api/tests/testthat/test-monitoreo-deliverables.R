source("setup-load-all.R")

test_that("preflight bloquea interno sin confirmed_full_data y drift critico", {
  preflight <- monitoreo_deliverables_preflight(
    family = "territorial",
    audience = "internal",
    project = "ACNURCG",
    cut = "2026-06-26",
    source = "Sheet validado ACNURCG",
    confirmed_full_data = FALSE,
    completeness = list(ok = TRUE),
    canonical_counts = list(required = FALSE),
    sheets = list(required = c("Resumen", "Corte y fuentes"), present = c("Resumen", "Corte y fuentes"), evidence = TRUE),
    format_validation = list(ok = TRUE, evidence = TRUE),
    pdf_validation = list(required = FALSE, evidence = TRUE),
    drift = list(status = "blocked", critical = TRUE, blocks_publication = TRUE)
  )

  expect_equal(preflight$status, "blocked")
  codes <- vapply(preflight$blocking_issues, `[[`, character(1), "code")
  expect_true("internal_requires_confirmed_full_data" %in% codes)
  expect_true("critical_reference_drift" %in% codes)
  expect_false(preflight$checks$confirmed_full_data)
  expect_false(preflight$checks$drift_reference)
})

test_that("preflight territorial interno exige revision explicita de referencia", {
  unchecked <- monitoreo_deliverables_preflight(
    family = "territorial",
    audience = "internal",
    project = "ACNURCG",
    cut = "2026-06-26",
    source = "Motor canónico Prosecnur",
    confirmed_full_data = TRUE,
    completeness = list(ok = TRUE),
    canonical_counts = list(required = FALSE),
    sheets = list(required = c("Portada", "Resumen territorial"), present = c("Portada", "Resumen territorial"), evidence = TRUE),
    format_validation = list(ok = TRUE, evidence = TRUE),
    pdf_validation = list(required = FALSE, evidence = TRUE),
    drift = list(status = "not_checked")
  )

  expect_equal(unchecked$status, "blocked")
  expect_false(unchecked$checks$drift_reference_checked)
  expect_true(unchecked$checks$drift_reference)
  expect_true("territorial_reference_drift_not_checked" %in% vapply(unchecked$blocking_issues, `[[`, character(1), "code"))

  not_applicable <- monitoreo_deliverables_preflight(
    family = "territorial",
    audience = "internal",
    project = "Territorial sin referencia validada",
    cut = "2026-06-26",
    source = "Motor canónico Prosecnur",
    confirmed_full_data = TRUE,
    completeness = list(ok = TRUE),
    canonical_counts = list(required = FALSE),
    sheets = list(required = c("Portada", "Resumen territorial"), present = c("Portada", "Resumen territorial"), evidence = TRUE),
    format_validation = list(ok = TRUE, evidence = TRUE),
    pdf_validation = list(required = FALSE, evidence = TRUE),
    drift = list(status = "not_applicable", no_reference = TRUE, reason = "No existe referencia territorial validada para este corte.")
  )

  expect_equal(not_applicable$status, "ready")
  expect_true(not_applicable$checks$drift_reference_checked)
  expect_true(not_applicable$checks$drift_reference)
})

test_that("preflight advierte performance fria, evidencia faltante y PII cliente", {
  canonical <- list(Egresados = list(universe = 270L, effective = 157L, partial = 5L, rejections = 0L, no_response = 108L))
  preflight <- monitoreo_deliverables_preflight(
    family = "acreditacion",
    audience = "client",
    project = "ACRDCONTA",
    cut = "2026-06-28",
    source = "BBDD oficial + SurveyMonkey",
    confirmed_full_data = FALSE,
    completeness = list(ok = TRUE),
    canonical_counts = list(expected = canonical, current = canonical),
    sheets = list(required = c("Reporte", "Detalle del avance", "Corte y fuentes"), present = c("Reporte", "Detalle del avance", "Corte y fuentes"), evidence = FALSE),
    format_validation = list(ok = TRUE, evidence = TRUE),
    pdf_validation = list(required = TRUE, evidence = FALSE),
    drift = list(status = "ready"),
    performance = list(list(name = "ACRDCONTA PDF metadata", elapsed_sec = 208, threshold_sec = 120)),
    client_columns = c("Actor", "Efectivas", "telefono_contacto", "_uuid")
  )

  expect_equal(preflight$status, "warnings")
  codes <- vapply(preflight$warnings, `[[`, character(1), "code")
  expect_true("cold_performance_over_threshold" %in% codes)
  expect_true("missing_sheets_evidence" %in% codes)
  expect_true("missing_pdf_evidence" %in% codes)
  expect_true("client_pii_or_internal_columns" %in% codes)
  expect_true(preflight$checks$canonical_counts)
  expect_false(preflight$checks$client_pii)
})

test_that("evidence pack genera reportes, validaciones y referencias XLSX/PDF", {
  out_dir <- tempfile("monitoreo_evidence_pack_")
  generated_xlsx <- tempfile(fileext = ".xlsx")
  generated_pdf <- tempfile(fileext = ".pdf")
  writeLines("xlsx placeholder", generated_xlsx, useBytes = TRUE)
  writeLines("pdf placeholder", generated_pdf, useBytes = TRUE)
  preflight <- monitoreo_deliverables_preflight(
    family = "acreditacion",
    audience = "client",
    project = "ACRDCONTA",
    cut = "2026-06-28",
    source = "BBDD oficial + SurveyMonkey",
    completeness = list(ok = TRUE),
    canonical_counts = list(required = FALSE),
    sheets = list(required = "Reporte", present = "Reporte", evidence = TRUE),
    format_validation = list(ok = TRUE, evidence = TRUE),
    pdf_validation = list(required = FALSE, evidence = TRUE)
  )

  pack <- monitoreo_deliverables_evidence_pack(
    out_dir = out_dir,
    preflight = preflight,
    generated_xlsx = generated_xlsx,
    generated_pdf = generated_pdf,
    format_validation = list(ok = TRUE, freeze = TRUE, filters = TRUE),
    data_validation = list(ok = TRUE, egresados = "270/157/5/0/108"),
    performance = list(items = list(list(name = "fixture", elapsed_sec = 1, threshold_sec = 10)))
  )

  expect_true(file.exists(file.path(out_dir, "report.json")))
  expect_true(file.exists(file.path(out_dir, "report.md")))
  expect_true(file.exists(file.path(out_dir, "generated.xlsx")))
  expect_true(file.exists(file.path(out_dir, "generated.pdf")))
  expect_true(file.exists(pack$format_validation))
  expect_true(file.exists(pack$data_validation))
  expect_true(file.exists(pack$performance))
  report <- jsonlite::fromJSON(pack$report_json, simplifyVector = FALSE)
  expect_equal(report$preflight$status, "ready")
  expect_equal(basename(report$artifacts$generated_xlsx), "generated.xlsx")
  expect_equal(basename(report$artifacts$generated_pdf), "generated.pdf")
})

test_that("publication evidence pack registra ZIP descargable con workbook generado", {
  testthat::skip_if_not_installed("openxlsx")
  testthat::skip_if_not_installed("zip")

  sid <- session_create()
  cleanup <- character()
  on.exit({
    unlink(cleanup, recursive = TRUE, force = TRUE)
    session_delete(sid)
  }, add = TRUE)

  fixture <- monitoreo_publish_qa_fixture("acreditacion")
  session_set(sid, "monitoreo_config", fixture$config)
  session_set(sid, "monitoreo_snapshot", list(
    data = fixture$data,
    config = fixture$config,
    synced_at = fixture$synced_at
  ))
  s <- session_get(sid)

  result <- .monitoreo_publication_evidence_pack(
    sid,
    s,
    s$monitoreo_snapshot,
    parsed = list(
      project = "Evidence Pack Fixture",
      cut = "2026-06-29T00:00:00Z",
      source = "Fixture local",
      confirmed_full_data = TRUE
    ),
    audience = "internal",
    spreadsheet_id = "sheet_evidence"
  )
  cleanup <- c(cleanup, result$evidence_pack$out_dir)

  expect_true(result$ok)
  expect_equal(result$audience, "internal")
  expect_true("Resumen" %in% result$tabs)
  expect_true(file.exists(file.path(result$evidence_pack$out_dir, "generated.xlsx")))
  expect_true(file.exists(result$evidence_pack$report_json))
  meta <- get_file(sid, result$file_id)
  expect_true(file.exists(meta$path))
  expect_equal(meta$original_name, result$filename)
  entries <- zip::zip_list(meta$path)$filename
  expect_true("report.json" %in% entries)
  expect_true("report.md" %in% entries)
  expect_true("generated.xlsx" %in% entries)
  expect_true("format-validation.json" %in% entries)
  expect_true("data-validation.json" %in% entries)
  expect_true("performance.json" %in% entries)
  report <- jsonlite::fromJSON(result$evidence_pack$report_json, simplifyVector = FALSE)
  expect_equal(report$preflight$status, "ready")
  expect_equal(basename(report$artifacts$generated_xlsx), "generated.xlsx")
})

test_that("territorial drift report bloquea UMP subsanadas y tacha faltante", {
  out_dir <- tempfile("monitoreo_drift_")
  expected <- data.frame(
    sheet_ump = c("UMP 101", "UMP 102"),
    sheet_state = c("subsanada_validada", "subsanada_validada"),
    idx = c("", "oppkg_123"),
    stringsAsFactors = FALSE
  )
  metrics <- data.frame(
    metric = c("ump_subsanadas", "annulments_active"),
    reference_sheet = c(30L, 2L),
    local_generated = c(0L, 1L),
    stringsAsFactors = FALSE
  )

  drift <- monitoreo_deliverables_territorial_drift_report(
    expected_umps = expected,
    metrics = metrics,
    out_dir = out_dir,
    source = "Sheet validado ACNURCG",
    cut = "2026-06-26",
    project = "ACNURCG"
  )

  expect_equal(drift$status, "blocked")
  expect_true(drift$blocks_publication)
  expect_equal(drift$missing_or_unpersisted_umps, 2L)
  expect_equal(drift$local_state_breakdown$missing_in_local_project, 1L)
  expect_equal(drift$local_state_breakdown$operational_suggestion_not_persisted, 1L)
  expect_equal(drift$tacha_difference, 1L)
  expect_equal(drift$tacha_gap$missing_active_tachas, 1L)
  expect_true(drift$tacha_gap$blocks_publication)
  expect_equal(drift$required_operational_package$ump_subsanadas, 2L)
  expect_equal(drift$required_operational_package$tachas, 1L)
  expect_true(file.exists(drift$csv))
  expect_true(file.exists(drift$markdown))
  csv <- utils::read.csv(drift$csv, stringsAsFactors = FALSE)
  expect_true(all(csv$blocks_publication))
  expect_true(all(csv$difference == "validated_sheet_state_not_persisted_locally"))
  expect_true(all(csv$publication_gate == "critical_reference_drift"))
  expect_true(all(nzchar(csv$required_package_item)))
  md <- paste(readLines(drift$markdown, warn = FALSE), collapse = "\n")
  expect_match(md, "Exact operational package required", fixed = TRUE)
  expect_match(md, "critical_reference_drift", fixed = TRUE)
  expect_match(md, "1 missing in local project", fixed = TRUE)
})

test_that("revision de paquete operacional territorial es read-only y no desbloquea publicacion", {
  out_dir <- tempfile("monitoreo_package_review_")
  drift <- monitoreo_deliverables_territorial_drift_report(
    expected_umps = data.frame(
      sheet_ump = c("UMP 101", "UMP 102"),
      sheet_state = c("subsanada_validada", "subsanada_validada"),
      idx = c("", "oppkg_123"),
      stringsAsFactors = FALSE
    ),
    metrics = data.frame(
      metric = c("ump_subsanadas", "annulments_active"),
      reference_sheet = c(30L, 2L),
      local_generated = c(0L, 1L),
      stringsAsFactors = FALSE
    ),
    out_dir = out_dir,
    source = "Sheet validado ACNURCG",
    cut = "2026-06-26",
    project = "ACNURCG"
  )

  incomplete <- monitoreo_deliverables_territorial_operational_package_review(
    package_rows = data.frame(
      package_item = "ump_subsanada:UMP 101",
      target_ump_or_replacement_id = "UMP 101",
      safe_adjustment_action = "persist_operational_adjustment",
      stringsAsFactors = FALSE
    ),
    drift = drift,
    out_dir = out_dir,
    source = "Sheet validado ACNURCG",
    cut = "2026-06-26",
    project = "ACNURCG"
  )

  expect_equal(incomplete$status, "blocked")
  expect_true(incomplete$blocks_publication)
  expect_false(incomplete$would_mutate_pulso)
  expect_false(incomplete$safe_to_apply)
  expect_true("ump_subsanada:UMP 102" %in% unlist(incomplete$coverage$missing_ump_items, use.names = FALSE))
  expect_equal(incomplete$coverage$missing_tachas, 1L)
  expect_true(file.exists(incomplete$template_csv))
  template <- utils::read.csv(incomplete$template_csv, stringsAsFactors = FALSE)
  expect_true("ump_subsanada:UMP 102" %in% template$package_item)
  expect_true(any(template$package_type == "tacha"))

  package_rows <- data.frame(
    package_item = c("ump_subsanada:UMP 101", "ump_subsanada:UMP 102", "tacha:P446"),
    package_type = c("ump_subsanada", "ump_subsanada", "tacha"),
    validated_sheet_row_or_range = c("Resumen territorial!A10:K10", "Resumen territorial!A11:K11", "Anulaciones!A5:K5"),
    target_ump_or_replacement_id = c("UMP 101", "UMP 102", "P446"),
    source_cut = c("2026-06-26", "2026-06-26", "2026-06-26"),
    safe_adjustment_action = c("persist_operational_adjustment", "persist_operational_adjustment", "register_active_tacha"),
    operator_or_owner = c("QA", "QA", "QA"),
    reason_or_note = c("validated Sheet row", "validated Sheet row", "validated Sheet tacha"),
    created_or_validated_at = c("2026-06-28", "2026-06-28", "2026-06-28"),
    stringsAsFactors = FALSE
  )
  ready <- monitoreo_deliverables_territorial_operational_package_review(
    package_rows = package_rows,
    drift = drift,
    out_dir = out_dir,
    source = "Sheet validado ACNURCG",
    cut = "2026-06-26",
    project = "ACNURCG"
  )

  expect_equal(ready$status, "review_ready")
  expect_false(ready$safe_to_apply)
  expect_true(ready$blocks_publication)
  expect_equal(ready$publication_gate, "critical_reference_drift")
  expect_false(ready$would_mutate_pulso)
  expect_equal(length(ready$coverage$missing_ump_items), 0L)
  expect_equal(ready$coverage$missing_tachas, 0L)
  expect_equal(ready$application_plan$status, "blocked")
  expect_false(ready$application_plan$payload_ready)
  expect_equal(ready$application_plan$blocked_rows, 2L)
  expect_true(any(grepl("source_response_ids", ready$rows[[1]]$application_missing_fields, fixed = TRUE)))
  expect_true(file.exists(ready$json))
  expect_true(file.exists(ready$markdown))
  md <- paste(readLines(ready$markdown, warn = FALSE), collapse = "\n")
  expect_match(md, "read-only", fixed = TRUE)
  expect_match(md, "Would mutate .pulso: no", fixed = TRUE)
  expect_match(md, "Safe to apply through endpoints: no", fixed = TRUE)

  payload_ready_rows <- package_rows
  payload_ready_rows$source_block_id <- c("src-101", "src-102", "")
  payload_ready_rows$target_block_id <- c("dst-101", "dst-102", "")
  payload_ready_rows$district <- c("ATE", "ATE", "")
  payload_ready_rows$sex <- c("Mujer", "Hombre", "")
  payload_ready_rows$age_group <- c("18-29", "30-44", "")
  payload_ready_rows$source_response_ids <- c("resp-101-a;resp-101-b", "resp-102-a", "")
  payload_ready_rows$responsible_key <- c("", "", "P446")
  payload_ready_rows$responsible_label <- c("", "", "P446 - QA")
  payload_ready <- monitoreo_deliverables_territorial_operational_package_review(
    package_rows = payload_ready_rows,
    drift = drift,
    out_dir = out_dir,
    source = "Sheet validado ACNURCG",
    cut = "2026-06-26",
    project = "ACNURCG"
  )
  expect_equal(payload_ready$status, "review_ready")
  expect_true(payload_ready$safe_to_apply)
  expect_equal(payload_ready$publication_gate, "operational_package_review_ready")
  expect_equal(payload_ready$application_plan$status, "ready")
  expect_true(payload_ready$application_plan$payload_ready)
  expect_equal(payload_ready$application_plan$ready_rows, 3L)
  expect_equal(payload_ready$application_plan$blocked_rows, 0L)
})

test_that("endpoint helper de paquete operacional revisa CSV subido sin aplicar cambios", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  out_dir <- tempfile("monitoreo_package_review_api_")
  drift <- monitoreo_deliverables_territorial_drift_report(
    expected_umps = data.frame(
      sheet_ump = "UMP 101",
      sheet_state = "subsanada_validada",
      idx = "",
      stringsAsFactors = FALSE
    ),
    metrics = data.frame(
      metric = c("ump_subsanadas", "annulments_active"),
      reference_sheet = c(30L, 2L),
      local_generated = c(0L, 1L),
      stringsAsFactors = FALSE
    ),
    out_dir = out_dir,
    source = "Sheet validado ACNURCG",
    cut = "2026-06-26",
    project = "ACNURCG"
  )
  csv <- paste(
    "package_item,package_type,validated_sheet_row_or_range,target_ump_or_replacement_id,source_cut,safe_adjustment_action,operator_or_owner,reason_or_note,created_or_validated_at",
    "ump_subsanada:UMP 101,ump_subsanada,Resumen territorial!A10:K10,UMP 101,2026-06-26,persist_operational_adjustment,QA,validated Sheet row,2026-06-28",
    "tacha:P446,tacha,Anulaciones!A5:K5,P446,2026-06-26,register_active_tacha,QA,validated Sheet tacha,2026-06-28",
    sep = "\n"
  )
  csv <- paste0(csv, "\n")
  meta_in <- save_upload(sid, "data", "operational-package.csv", charToRaw(csv))

  result <- .monitoreo_territorial_operational_package_review_payload(
    sid,
    parsed = list(
      package_file_id = meta_in$file_id,
      drift = drift,
      source = "Sheet validado ACNURCG",
      cut = "2026-06-26",
      project = "ACNURCG",
      out_dir = out_dir
    )
  )

  expect_true(result$ok)
  expect_equal(result$status, "review_ready")
  expect_false(result$safe_to_apply)
  expect_true(result$blocks_publication)
  expect_false(result$would_mutate_pulso)
  expect_equal(result$publication_gate, "critical_reference_drift")
  expect_equal(result$review$application_plan$status, "blocked")
  expect_equal(result$review$application_plan$blocked_rows, 1L)
  expect_equal(result$review$coverage$missing_tachas, 0L)
  expect_equal(length(result$review$coverage$missing_ump_items), 0L)
  expect_true(file.exists(result$review$template_csv))
  template_meta <- get_file(sid, result$files$template$file_id)
  review_meta <- get_file(sid, result$files$review_csv$file_id)
  json_meta <- get_file(sid, result$files$report_json$file_id)
  md_meta <- get_file(sid, result$files$report_md$file_id)
  expect_true(file.exists(template_meta$path))
  expect_true(file.exists(review_meta$path))
  expect_true(file.exists(json_meta$path))
  expect_true(file.exists(md_meta$path))
  expect_match(template_meta$original_name, "operational-package-template.csv", fixed = TRUE)
  expect_match(review_meta$original_name, "operational-package-review.csv", fixed = TRUE)
})

test_that("cache territorial interna conserva resumen observado por UMP", {
  reports <- list(
    route_blocks = list(
      list(distrito = "D1", zona = "Z1", ump = "UMP 101", manzana = "M1", responsable = "Plan A", validas = 1),
      list(distrito = "D1", zona = "Z1", ump = "UMP 102", manzana = "M2", responsable = "Plan B", validas = 0)
    ),
    response_audit = data.frame(
      distrito = c("D1", "D1", "D1"),
      ump = c("UMP 101", "UMP 101", "UMP 102"),
      manzana = c("M1", "M1", "M2"),
      responsable = c("Ana", "Ana", "Luis"),
      codigo_encuestador = c("E1", "E1", "E2"),
      fecha = c("2026-06-20", "2026-06-21", "2026-06-19"),
      sexo = c("Mujer", "Hombre", "Mujer"),
      edad = c(30, 31, 20),
      advance_valid = c(TRUE, FALSE, TRUE),
      estado_caso = c("valida", "pendiente", "valida"),
      stringsAsFactors = FALSE
    )
  )

  cache <- .monitoreo_publication_territorial_common_cache(reports)
  expect_true("observed_summary_map" %in% names(cache))
  expect_true(is.list(cache$observed_summary_map))
  expect_true("UMP 101" %in% names(cache$observed_summary_map))

  direct <- .monitoreo_publication_territorial_observed_summary(cache$audit_groups, "UMP 101")
  cached <- .monitoreo_publication_territorial_observed_summary(
    cache$audit_groups,
    "UMP 101",
    observed_map = cache$observed_summary_map
  )
  missing <- .monitoreo_publication_territorial_observed_summary(
    cache$audit_groups,
    "UMP 999",
    fallback_validas = 3,
    fallback_date = "2026-06-22",
    observed_map = cache$observed_summary_map
  )

  expect_equal(cached, direct)
  expect_equal(cached$responsible, "Ana")
  expect_equal(cached$validas, 1L)
  expect_equal(cached$last_activity, "21 Junio")
  expect_false(missing$has_records)
  expect_equal(missing$validas, 3L)
  expect_equal(missing$last_activity, "22 Junio")
})

test_that("preflight ACRDCONTA acepta 270/157/5/0/108 y bloquea resumen viejo", {
  canonical <- list(Egresados = list(universe = 270L, effective = 157L, partial = 5L, rejections = 0L, no_response = 108L))
  client <- monitoreo_deliverables_preflight(
    family = "acreditacion",
    audience = "client",
    project = "ACRDCONTA",
    cut = "2026-06-28",
    source = "BBDD oficial + SurveyMonkey",
    completeness = list(ok = TRUE),
    canonical_counts = list(expected = canonical, current = canonical, old_summary_present = FALSE),
    sheets = list(required = c("Reporte", "Detalle del avance", "Corte y fuentes"), present = c("Reporte", "Detalle del avance", "Corte y fuentes"), evidence = TRUE),
    format_validation = list(ok = TRUE, evidence = TRUE),
    pdf_validation = list(required = FALSE, evidence = TRUE)
  )
  internal <- monitoreo_deliverables_preflight(
    family = "acreditacion",
    audience = "internal",
    project = "ACRDCONTA",
    cut = "2026-06-28",
    source = "BBDD oficial + SurveyMonkey",
    confirmed_full_data = TRUE,
    completeness = list(ok = TRUE),
    canonical_counts = list(expected = canonical, current = canonical, old_summary_present = FALSE),
    sheets = list(required = c("Resumen", "Avance por encuesta", "Seguimiento", "Alertas", "Corte y fuentes"), present = c("Resumen", "Avance por encuesta", "Seguimiento", "Alertas", "Corte y fuentes"), evidence = TRUE),
    format_validation = list(ok = TRUE, evidence = TRUE),
    pdf_validation = list(required = FALSE, evidence = TRUE)
  )
  old <- monitoreo_deliverables_preflight(
    family = "acreditacion",
    audience = "client",
    project = "ACRDCONTA",
    cut = "2026-06-28",
    source = "BBDD oficial + SurveyMonkey",
    completeness = list(ok = TRUE),
    canonical_counts = list(
      expected = canonical,
      current = canonical,
      old_summary_present = TRUE
    ),
    sheets = list(required = "Reporte", present = "Reporte", evidence = TRUE),
    format_validation = list(ok = TRUE, evidence = TRUE),
    pdf_validation = list(required = FALSE, evidence = TRUE)
  )
  auto_complete_partial <- monitoreo_deliverables_preflight(
    family = "acreditacion",
    audience = "client",
    project = "ACRDCONTA",
    cut = "2026-06-28",
    source = "BBDD oficial + SurveyMonkey",
    completeness = list(ok = TRUE),
    canonical_counts = list(
      expected = canonical,
      current = list(Egresados = list(universe = 270L, effective = 162L, partial = 0L, rejections = 0L, no_response = 108L))
    ),
    sheets = list(required = "Reporte", present = "Reporte", evidence = TRUE),
    format_validation = list(ok = TRUE, evidence = TRUE),
    pdf_validation = list(required = FALSE, evidence = TRUE)
  )

  expect_equal(client$status, "ready")
  expect_equal(internal$status, "ready")
  expect_true(client$checks$canonical_counts)
  expect_true(internal$checks$confirmed_full_data)
  expect_equal(old$status, "blocked")
  expect_true("old_summary_present" %in% vapply(old$blocking_issues, `[[`, character(1), "code"))
  expect_equal(auto_complete_partial$status, "blocked")
  expect_true("canonical_counts_mismatch" %in% vapply(auto_complete_partial$blocking_issues, `[[`, character(1), "code"))
})

test_that("preflight de publicacion usa pestanas generadas sin confundir estados telefonicos con PII", {
  fixture <- monitoreo_publish_qa_fixture("acreditacion")
  client_tabs <- monitoreo_publication_sheets_tabs(
    fixture$data,
    fixture$config,
    audience = "client",
    dashboard = fixture$dashboard,
    synced_at = fixture$synced_at
  )
  client <- .monitoreo_publication_preflight_from_tabs(
    client_tabs,
    family = "acreditacion",
    audience = "client",
    project = "ACRDCONTA",
    cut = fixture$synced_at,
    source = "BBDD oficial + SurveyMonkey",
    canonical_counts = list(required = FALSE)
  )

  expect_equal(client$status, "ready")
  expect_true(client$checks$sheets_exist)
  expect_true(client$checks$client_pii)
  expect_false("client_pii_or_internal_columns" %in% vapply(client$warnings, `[[`, character(1), "code"))

  internal_tabs <- monitoreo_publication_sheets_tabs(
    fixture$data,
    fixture$config,
    audience = "internal",
    dashboard = fixture$dashboard,
    synced_at = fixture$synced_at
  )
  internal <- .monitoreo_publication_preflight_from_tabs(
    internal_tabs,
    family = "acreditacion",
    audience = "internal",
    project = "ACRDCONTA",
    cut = fixture$synced_at,
    source = "BBDD oficial + SurveyMonkey",
    confirmed_full_data = FALSE,
    canonical_counts = list(required = FALSE)
  )

  expect_equal(internal$status, "blocked")
  expect_true("internal_requires_confirmed_full_data" %in% vapply(internal$blocking_issues, `[[`, character(1), "code"))
})
