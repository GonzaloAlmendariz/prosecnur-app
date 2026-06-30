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

test_that("preflight territorial interno explica estado de paquete operacional", {
  base_args <- list(
    family = "territorial",
    audience = "internal",
    project = "ACNURCG",
    cut = "2026-06-26",
    source = "Sheet validado ACNURCG",
    confirmed_full_data = TRUE,
    completeness = list(ok = TRUE),
    canonical_counts = list(required = FALSE),
    sheets = list(required = c("Portada", "Resumen territorial"), present = c("Portada", "Resumen territorial"), evidence = TRUE),
    format_validation = list(ok = TRUE, evidence = TRUE),
    pdf_validation = list(required = FALSE, evidence = TRUE),
    drift = list(status = "blocked", critical = TRUE, blocks_publication = TRUE)
  )

  missing_review <- do.call(monitoreo_deliverables_preflight, base_args)
  missing_codes <- vapply(missing_review$blocking_issues, `[[`, character(1), "code")
  expect_true("territorial_operational_package_review_missing" %in% missing_codes)
  expect_false(missing_review$checks$territorial_operational_package)

  partial_review <- base_args
  partial_review$operational_package_review <- list(
    status = "blocked",
    publication_gate = "critical_reference_drift",
    blocks_publication = TRUE,
    apply_ready = FALSE,
    requires_revalidation = FALSE,
    publication_ready = FALSE,
    safe_to_apply = FALSE,
    coverage = list(missing_ump_items = list("ump_subsanada:UMP 101"), missing_tachas = 0L),
    application_plan = list(status = "ready", payload_ready = TRUE, ready_rows = 19L, blocked_rows = 0L)
  )
  partial <- do.call(monitoreo_deliverables_preflight, partial_review)
  partial_codes <- vapply(partial$blocking_issues, `[[`, character(1), "code")
  expect_true("territorial_operational_package_not_ready" %in% partial_codes)
  expect_false(partial$checks$territorial_operational_package)
  expect_equal(partial$evidence$operational_package_review$coverage$missing_ump_items[[1]], "ump_subsanada:UMP 101")

  reviewed_not_applied <- base_args
  reviewed_not_applied$operational_package_review <- list(
    status = "review_ready",
    publication_gate = "operational_package_review_ready",
    blocks_publication = TRUE,
    apply_ready = TRUE,
    requires_revalidation = TRUE,
    publication_ready = FALSE,
    safe_to_apply = TRUE,
    coverage = list(missing_ump_items = list(), missing_tachas = 0L),
    application_plan = list(status = "ready", payload_ready = TRUE, ready_rows = 31L, blocked_rows = 0L)
  )
  not_applied <- do.call(monitoreo_deliverables_preflight, reviewed_not_applied)
  not_applied_codes <- vapply(not_applied$blocking_issues, `[[`, character(1), "code")
  expect_true("territorial_operational_package_not_applied" %in% not_applied_codes)
  expect_false(not_applied$checks$territorial_operational_package)
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
  expect_true(file.exists(file.path(out_dir, "manifest.json")))
  expect_true(file.exists(file.path(out_dir, "cut-snapshot.json")))
  expect_true(file.exists(file.path(out_dir, "operational-package-status.json")))
  expect_true(file.exists(file.path(out_dir, "operational-package-request.json")))
  expect_true(file.exists(file.path(out_dir, "operational-package-request.csv")))
  expect_true(file.exists(file.path(out_dir, "publication-decision.json")))
  expect_true(file.exists(file.path(out_dir, "reference-validation.json")))
  expect_true(file.exists(file.path(out_dir, "generated.xlsx")))
  expect_true(file.exists(file.path(out_dir, "generated.pdf")))
  expect_true(file.exists(pack$cut_snapshot))
  expect_true(file.exists(pack$operational_package_status))
  expect_true(file.exists(pack$operational_package_request))
  expect_true(file.exists(pack$operational_package_request_csv))
  expect_true(file.exists(pack$publication_decision))
  expect_true(file.exists(pack$format_validation))
  expect_true(file.exists(pack$data_validation))
  expect_true(file.exists(pack$reference_validation))
  expect_true(file.exists(pack$performance))
  report <- jsonlite::fromJSON(pack$report_json, simplifyVector = FALSE)
  expect_equal(report$preflight$status, "ready")
  expect_equal(report$manifest, "manifest.json")
  expect_equal(report$cut_snapshot, "cut-snapshot.json")
  expect_equal(report$operational_package_status, "operational-package-status.json")
  expect_equal(report$operational_package_request$json, "operational-package-request.json")
  expect_equal(report$operational_package_request$csv, "operational-package-request.csv")
  expect_equal(report$publication_decision, "publication-decision.json")
  expect_equal(report$reference_validation, "reference-validation.json")
  expect_equal(basename(report$artifacts$generated_xlsx), "generated.xlsx")
  expect_equal(basename(report$artifacts$generated_pdf), "generated.pdf")
  snapshot <- jsonlite::fromJSON(pack$cut_snapshot, simplifyVector = FALSE)
  expect_equal(snapshot$schema, "monitoreo_deliverables_cut_snapshot_v1")
  expect_equal(snapshot$project, "ACRDCONTA")
  expect_equal(snapshot$audience, "client")
  expect_equal(snapshot$cut, "2026-06-28")
  expect_equal(snapshot$status, "ready")
  expect_true(snapshot$persistence$generated_deliverables_outside_pulso)
  expect_false(snapshot$persistence$secrets_included)
  expect_false(snapshot$persistence$raw_data_included)
  expect_equal(snapshot$validation_files$reference, "reference-validation.json")
  package_status <- jsonlite::fromJSON(pack$operational_package_status, simplifyVector = FALSE)
  expect_equal(package_status$schema, "monitoreo_deliverables_operational_package_status_v1")
  expect_equal(package_status$status, "not_applicable")
  expect_false(package_status$applicable)
  expect_false(package_status$blocks_publication)
  package_request <- jsonlite::fromJSON(pack$operational_package_request, simplifyVector = FALSE)
  expect_equal(package_request$schema, "monitoreo_deliverables_operational_package_request_v1")
  expect_equal(package_request$status, "no_missing_payload_rows")
  expect_equal(package_request$row_count, 0L)
  expect_false(package_request$would_mutate_pulso)
  decision <- jsonlite::fromJSON(pack$publication_decision, simplifyVector = FALSE)
  expect_equal(decision$schema, "monitoreo_deliverables_publication_decision_v1")
  expect_equal(decision$decision, "ready_to_publish")
  expect_true(decision$may_publish)
  expect_false(decision$requires_review)
  expect_equal(decision$preflight_status, "ready")
  expect_equal(decision$reference_status, "ready")
  reference <- jsonlite::fromJSON(pack$reference_validation, simplifyVector = FALSE)
  expect_equal(reference$schema, "monitoreo_deliverables_reference_validation_v1")
  expect_equal(reference$status, "ready")
  expect_equal(reference$preflight_status, "ready")
  manifest <- jsonlite::fromJSON(pack$manifest, simplifyVector = FALSE)
  expect_equal(manifest$schema, "monitoreo_deliverables_evidence_manifest_v1")
  manifest_paths <- vapply(manifest$files, `[[`, character(1), "path")
  expect_equal(manifest$file_count, length(manifest_paths))
  expect_equal(manifest$file_count_scope, "payload_files_excluding_manifest")
  expect_equal(manifest$expected_zip_file_count, length(manifest_paths) + 1L)
  expect_true(manifest$manifest_included)
  expect_false(manifest$manifest_self_hash_included)
  expect_equal(manifest$total_bytes_scope, "payload_files_excluding_manifest")
  expect_true("report.json" %in% manifest_paths)
  expect_true("cut-snapshot.json" %in% manifest_paths)
  expect_true("operational-package-status.json" %in% manifest_paths)
  expect_true("operational-package-request.json" %in% manifest_paths)
  expect_true("operational-package-request.csv" %in% manifest_paths)
  expect_true("publication-decision.json" %in% manifest_paths)
  expect_true("reference-validation.json" %in% manifest_paths)
  expect_true("generated.xlsx" %in% manifest_paths)
  expect_true("generated.pdf" %in% manifest_paths)
  xlsx_manifest <- manifest$files[[match("generated.xlsx", manifest_paths)]]
  expect_true(nzchar(xlsx_manifest$sha256))
  expect_gt(xlsx_manifest$size, 0)
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
  expect_true(is.list(result$files))
  expect_true("operational_package_request_csv" %in% names(result$files))
  expect_true("operational_package_request" %in% names(result$files))
  expect_true("operational_package_status" %in% names(result$files))
  expect_true("publication_decision" %in% names(result$files))
  request_csv_meta <- get_file(sid, result$files$operational_package_request_csv$file_id)
  request_json_meta <- get_file(sid, result$files$operational_package_request$file_id)
  status_meta <- get_file(sid, result$files$operational_package_status$file_id)
  decision_meta <- get_file(sid, result$files$publication_decision$file_id)
  expect_true(file.exists(request_csv_meta$path))
  expect_true(file.exists(request_json_meta$path))
  expect_true(file.exists(status_meta$path))
  expect_true(file.exists(decision_meta$path))
  expect_match(request_csv_meta$original_name, "operational-package-request.csv", fixed = TRUE)
  expect_match(request_json_meta$original_name, "operational-package-request.json", fixed = TRUE)
  expect_match(status_meta$original_name, "operational-package-status.json", fixed = TRUE)
  expect_match(decision_meta$original_name, "publication-decision.json", fixed = TRUE)
  expect_identical(normalizePath(request_csv_meta$path), normalizePath(result$evidence_pack$operational_package_request_csv))
  expect_identical(normalizePath(request_json_meta$path), normalizePath(result$evidence_pack$operational_package_request))
  entries <- zip::zip_list(meta$path)$filename
  expect_true("report.json" %in% entries)
  expect_true("report.md" %in% entries)
  expect_true("manifest.json" %in% entries)
  expect_true("cut-snapshot.json" %in% entries)
  expect_true("operational-package-status.json" %in% entries)
  expect_true("operational-package-request.json" %in% entries)
  expect_true("operational-package-request.csv" %in% entries)
  expect_true("publication-decision.json" %in% entries)
  expect_true("generated.xlsx" %in% entries)
  expect_true("format-validation.json" %in% entries)
  expect_true("data-validation.json" %in% entries)
  expect_true("reference-validation.json" %in% entries)
  expect_true("performance.json" %in% entries)
  report <- jsonlite::fromJSON(result$evidence_pack$report_json, simplifyVector = FALSE)
  expect_true(report$preflight$status %in% c("ready", "warnings"))
  expect_false(identical(report$preflight$status, "blocked"))
  expect_equal(basename(report$artifacts$generated_xlsx), "generated.xlsx")
  snapshot <- jsonlite::fromJSON(result$evidence_pack$cut_snapshot, simplifyVector = FALSE)
  expect_equal(snapshot$schema, "monitoreo_deliverables_cut_snapshot_v1")
  expect_equal(snapshot$project, "Evidence Pack Fixture")
  expect_equal(snapshot$audience, "internal")
  expect_true(snapshot$status %in% c("ready", "warnings"))
  expect_false(identical(snapshot$status, "blocked"))
  expect_true(snapshot$persistence$generated_deliverables_outside_pulso)
  expect_false(snapshot$persistence$secrets_included)
  expect_false(snapshot$persistence$raw_data_included)
  expect_true("Resumen" %in% unlist(snapshot$source_evidence$tabs, use.names = FALSE))
  package_status <- jsonlite::fromJSON(result$evidence_pack$operational_package_status, simplifyVector = FALSE)
  expect_equal(package_status$schema, "monitoreo_deliverables_operational_package_status_v1")
  expect_equal(package_status$status, "not_applicable")
  expect_false(package_status$applicable)
  package_request <- jsonlite::fromJSON(result$evidence_pack$operational_package_request, simplifyVector = FALSE)
  expect_equal(package_request$schema, "monitoreo_deliverables_operational_package_request_v1")
  expect_equal(package_request$row_count, 0L)
  decision <- jsonlite::fromJSON(result$evidence_pack$publication_decision, simplifyVector = FALSE)
  expect_true(decision$decision %in% c("ready_to_publish", "requires_review"))
  expect_false(identical(decision$decision, "blocked"))
  expect_identical(decision$may_publish, identical(decision$decision, "ready_to_publish"))
  expect_equal(decision$preflight_status, report$preflight$status)
  reference <- jsonlite::fromJSON(result$evidence_pack$reference_validation, simplifyVector = FALSE)
  expect_true(reference$status %in% c("ready", "warnings"))
  expect_false(identical(reference$status, "blocked"))
  manifest <- jsonlite::fromJSON(result$evidence_pack$manifest, simplifyVector = FALSE)
  manifest_paths <- vapply(manifest$files, `[[`, character(1), "path")
  expect_true("generated.xlsx" %in% manifest_paths)
  expect_true("cut-snapshot.json" %in% manifest_paths)
  expect_true("operational-package-status.json" %in% manifest_paths)
  expect_true("operational-package-request.json" %in% manifest_paths)
  expect_true("operational-package-request.csv" %in% manifest_paths)
  expect_true("publication-decision.json" %in% manifest_paths)
  expect_true("reference-validation.json" %in% manifest_paths)
  expect_true("performance.json" %in% manifest_paths)
  expect_true(nzchar(manifest$files[[match("generated.xlsx", manifest_paths)]]$sha256))
})

test_that("publication decision no permite override optimista cuando el preflight esta bloqueado", {
  out_dir <- tempfile("monitoreo_decision_pack_")
  preflight <- monitoreo_deliverables_preflight(
    family = "territorial",
    audience = "internal",
    project = "ACNURCG",
    cut = "2026-06-26",
    source = "Sheet validado ACNURCG",
    confirmed_full_data = TRUE,
    completeness = list(ok = TRUE),
    canonical_counts = list(required = FALSE),
    sheets = list(required = c("Portada", "Resumen territorial"), present = c("Portada", "Resumen territorial"), evidence = TRUE),
    format_validation = list(ok = TRUE, evidence = TRUE),
    pdf_validation = list(required = FALSE, evidence = TRUE),
    drift = list(status = "blocked", critical = TRUE, blocks_publication = TRUE),
    operational_package_review = list(
      status = "blocked",
      publication_gate = "critical_reference_drift",
      blocks_publication = TRUE,
      apply_ready = FALSE,
      requires_revalidation = FALSE,
      publication_ready = FALSE,
      safe_to_apply = FALSE,
      coverage = list(
        missing_ump_items = list("ump_subsanada:UMP 101", "ump_subsanada:UMP 112"),
        missing_tachas = 0L
      ),
      application_plan = list(
        schema = "monitoreo_deliverables_territorial_application_plan_v1",
        status = "partial_package",
        payload_ready = FALSE,
        ready_rows = 19L,
        blocked_rows = 0L,
        would_mutate_pulso = FALSE
      )
    )
  )

  pack <- monitoreo_deliverables_evidence_pack(
    out_dir = out_dir,
    preflight = preflight,
    format_validation = list(ok = TRUE),
    data_validation = list(ok = FALSE),
    reference_validation = list(status = "blocked"),
    publication_decision = list(decision = "ready_to_publish", reviewer = "fixture")
  )

  decision <- jsonlite::fromJSON(pack$publication_decision, simplifyVector = FALSE)
  expect_equal(decision$schema, "monitoreo_deliverables_publication_decision_v1")
  expect_equal(decision$decision, "blocked")
  expect_false(decision$may_publish)
  expect_true(decision$requires_review)
  expect_equal(decision$requested_decision, "ready_to_publish")
  expect_true(decision$requested_decision_conflict)
  expect_true("critical_reference_drift" %in% unlist(decision$blocking_codes, use.names = FALSE))
  expect_match(decision$next_action, "drift", ignore.case = TRUE)
  package_status <- jsonlite::fromJSON(pack$operational_package_status, simplifyVector = FALSE)
  expect_equal(package_status$schema, "monitoreo_deliverables_operational_package_status_v1")
  expect_equal(package_status$status, "blocked")
  expect_true(package_status$applicable)
  expect_true(package_status$blocks_publication)
  expect_true(package_status$diagnostic_only)
  expect_false(package_status$publication_ready)
  expect_equal(package_status$unresolved$missing_ump_count, 2L)
  expect_true("ump_subsanada:UMP 101" %in% unlist(package_status$unresolved$missing_ump_items, use.names = FALSE))
  expect_equal(package_status$application_plan$ready_rows, 19L)
  expect_false(package_status$application_plan$would_mutate_pulso)
  expect_match(package_status$guardrail, "Diagnostic artifact only", fixed = TRUE)
  package_request <- jsonlite::fromJSON(pack$operational_package_request, simplifyVector = FALSE)
  expect_equal(package_request$schema, "monitoreo_deliverables_operational_package_request_v1")
  expect_equal(package_request$status, "requires_payload")
  expect_equal(package_request$row_count, 2L)
  expect_true(package_request$blocks_publication)
  expect_false(package_request$would_mutate_pulso)
  request_csv <- utils::read.csv(pack$operational_package_request_csv, stringsAsFactors = FALSE)
  expect_equal(nrow(request_csv), 2L)
  expect_true("ump_subsanada:UMP 101" %in% request_csv$package_item)
  expect_true(all(request_csv$payload_requirement == "endpoint_ready_movement_payload"))
  expect_true(all(grepl("source_block_id", request_csv$required_fields, fixed = TRUE)))
  expect_true(all(request_csv$would_mutate_pulso == "FALSE" | request_csv$would_mutate_pulso == FALSE))
  expect_match(package_request$guardrail, "must not mutate .pulso", fixed = TRUE)
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
  expect_false(incomplete$apply_ready)
  expect_false(incomplete$requires_revalidation)
  expect_false(incomplete$publication_ready)
  expect_false(incomplete$safe_to_apply)
  expect_true("ump_subsanada:UMP 102" %in% unlist(incomplete$coverage$missing_ump_items, use.names = FALSE))
  expect_equal(incomplete$coverage$missing_tachas, 1L)
  expect_true(file.exists(incomplete$template_csv))
  template <- utils::read.csv(incomplete$template_csv, stringsAsFactors = FALSE)
  expect_true("ump_subsanada:UMP 102" %in% template$package_item)
  expect_true(any(template$package_type == "tacha"))

  partial_payload_ready <- data.frame(
    package_item = c("ump_subsanada:UMP 101", "tacha:P446"),
    package_type = c("ump_subsanada", "tacha"),
    validated_sheet_row_or_range = c("Resumen territorial!A10:K10", "Anulaciones!A5:K5"),
    target_ump_or_replacement_id = c("UMP 101", "P446"),
    source_cut = c("2026-06-26", "2026-06-26"),
    safe_adjustment_action = c("persist_operational_adjustment", "register_active_tacha"),
    operator_or_owner = c("QA", "QA"),
    reason_or_note = c("validated Sheet row", "validated Sheet tacha"),
    created_or_validated_at = c("2026-06-28", "2026-06-28"),
    source_block_id = c("src-101", ""),
    target_block_id = c("dst-101", ""),
    district = c("ATE", ""),
    sex = c("Mujer", ""),
    age_group = c("18-29", ""),
    source_response_ids = c("resp-101-a;resp-101-b", ""),
    responsible_key = c("", "P446"),
    responsible_label = c("", "P446 - QA"),
    stringsAsFactors = FALSE
  )
  reference_audit_probe <- data.frame(
    package_item = c("ump_subsanada:UMP 101", "ump_subsanada:UMP 102"),
    target_ump_number = c("101", "102"),
    reference_validas = c(9L, 8L),
    exact_audit_rows_found = c(9L, 7L),
    relation_to_reference_validas = c("matches_reference_validas", "fewer_than_reference_validas"),
    can_reconstruct_payload_from_live_audit = c(FALSE, FALSE),
    blocks_publication = c(TRUE, TRUE),
    stringsAsFactors = FALSE
  )
  partial <- monitoreo_deliverables_territorial_operational_package_review(
    package_rows = partial_payload_ready,
    drift = drift,
    out_dir = out_dir,
    source = "Sheet validado ACNURCG",
    cut = "2026-06-26",
    project = "ACNURCG",
    reference_audit_probe = reference_audit_probe
  )
  expect_equal(partial$status, "blocked")
  expect_equal(partial$publication_gate, "critical_reference_drift")
  expect_false(partial$apply_ready)
  expect_false(partial$requires_revalidation)
  expect_false(partial$publication_ready)
  expect_false(partial$safe_to_apply)
  expect_equal(unlist(partial$coverage$missing_ump_items, use.names = FALSE), "ump_subsanada:UMP 102")
  expect_equal(partial$coverage$missing_tachas, 0L)
  expect_equal(partial$application_plan$status, "ready")
  expect_true(partial$application_plan$payload_ready)
  expect_equal(partial$application_plan$ready_rows, 2L)
  expect_equal(partial$application_plan$blocked_rows, 0L)
  expect_equal(partial$reference_audit_probe$status, "diagnostic_only")
  expect_equal(partial$reference_audit_probe$rows_checked, 2L)
  expect_equal(partial$reference_audit_probe$rows_with_live_audit_rows, 2L)
  expect_equal(partial$reference_audit_probe$row_count_matches_reference_validas, 1L)
  expect_equal(partial$reference_audit_probe$row_count_fewer_than_reference_validas, 1L)
  expect_false(partial$reference_audit_probe$can_reconstruct_endpoint_payload)
  partial_md <- paste(readLines(partial$markdown, warn = FALSE), collapse = "\n")
  expect_match(partial_md, "Reference audit probe", fixed = TRUE)
  expect_match(partial_md, "diagnostic only", fixed = TRUE)
  expect_match(partial_md, "Probe blocks publication: yes", fixed = TRUE)
  expect_match(partial_md, "must not be applied as an operational package", fixed = TRUE)

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
  expect_false(ready$apply_ready)
  expect_false(ready$requires_revalidation)
  expect_false(ready$publication_ready)
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
  expect_true(payload_ready$apply_ready)
  expect_true(payload_ready$requires_revalidation)
  expect_false(payload_ready$publication_ready)
  expect_equal(payload_ready$publication_gate, "operational_package_review_ready")
  expect_equal(payload_ready$application_plan$status, "ready")
  expect_true(payload_ready$application_plan$payload_ready)
  expect_equal(payload_ready$application_plan$ready_rows, 3L)
  expect_equal(payload_ready$application_plan$blocked_rows, 0L)

  probe_only_drift <- drift
  probe_only_drift$status <- "ready"
  probe_only_drift$blocks_publication <- FALSE
  payload_reconstructible_probe <- reference_audit_probe
  payload_reconstructible_probe$can_reconstruct_payload_from_live_audit <- TRUE
  payload_reconstructible <- monitoreo_deliverables_territorial_operational_package_review(
    package_rows = payload_ready_rows,
    drift = probe_only_drift,
    out_dir = out_dir,
    source = "Sheet validado ACNURCG",
    cut = "2026-06-26",
    project = "ACNURCG",
    reference_audit_probe = payload_reconstructible_probe
  )
  expect_equal(payload_reconstructible$reference_audit_probe$status, "payload_reconstructible")
  expect_true(payload_reconstructible$safe_to_apply)
  expect_true(payload_reconstructible$apply_ready)
  expect_true(payload_reconstructible$requires_revalidation)
  expect_false(payload_reconstructible$publication_ready)
  expect_true(payload_reconstructible$blocks_publication)
  expect_equal(payload_reconstructible$publication_gate, "operational_package_review_ready")
  expect_false(identical(payload_reconstructible$publication_gate, "ready"))

  publish_ready_drift <- drift
  publish_ready_drift$status <- "ready"
  publish_ready_drift$blocks_publication <- FALSE
  publish_ready <- monitoreo_deliverables_territorial_operational_package_review(
    package_rows = payload_ready_rows,
    drift = publish_ready_drift,
    out_dir = out_dir,
    source = "Sheet validado ACNURCG",
    cut = "2026-06-26",
    project = "ACNURCG"
  )
  expect_equal(publish_ready$status, "review_ready")
  expect_equal(publish_ready$publication_gate, "ready")
  expect_true(publish_ready$safe_to_apply)
  expect_true(publish_ready$apply_ready)
  expect_false(publish_ready$requires_revalidation)
  expect_true(publish_ready$publication_ready)
  expect_false(publish_ready$blocks_publication)
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
  meta_in <- save_upload(sid, "monitoreo_operational_package", "operational-package", charToRaw(csv))
  expect_equal(meta_in$kind, "monitoreo_operational_package")
  expect_equal(meta_in$ext, "csv")
  drift_bytes <- readBin(drift$csv, what = "raw", n = file.info(drift$csv)$size)
  meta_drift <- save_upload(sid, "monitoreo_reference_drift", "territorial-drift-report", drift_bytes)
  expect_equal(meta_drift$kind, "monitoreo_reference_drift")
  expect_equal(meta_drift$ext, "csv")

  result <- .monitoreo_territorial_operational_package_review_payload(
    sid,
    parsed = list(
      package_file_id = meta_in$file_id,
      drift_file_id = meta_drift$file_id,
      required_operational_package = drift$required_operational_package,
      source = "Sheet validado ACNURCG",
      cut = "2026-06-26",
      project = "ACNURCG",
      out_dir = out_dir
    )
  )

  expect_true(result$ok)
  expect_equal(result$status, "review_ready")
  expect_false(result$safe_to_apply)
  expect_false(result$apply_ready)
  expect_false(result$requires_revalidation)
  expect_false(result$publication_ready)
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

test_that("preflight puede resolver drift de referencia desde file_id y review operacional", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  out_dir <- tempfile("monitoreo_preflight_reference_file_")
  drift_csv <- paste(
    "ump_expected,sheet_state,local_state,difference,required_package_item,blocks_publication",
    "UMP 101,subsanada_validada,missing_in_local_project,validated_sheet_state_not_persisted_locally,ump_subsanada:UMP 101,TRUE",
    sep = "\n"
  )
  drift_csv <- paste0(drift_csv, "\n")
  meta_drift <- save_upload(sid, "monitoreo_reference_drift", "territorial-drift-report", charToRaw(drift_csv))

  drift <- .monitoreo_publication_reference_drift_from_request(
    sid,
    parsed = list(
      reference_drift_file_id = meta_drift$file_id,
      required_tachas = 1L
    ),
    out_dir = out_dir,
    source = "Sheet validado ACNURCG",
    cut = "2026-06-26",
    project = "ACNURCG"
  )

  expect_equal(drift$status, "blocked")
  expect_true(drift$blocks_publication)
  expect_equal(drift$required_operational_package$tachas, 1L)
  expect_equal(drift$rows[[1]]$required_package_item, "ump_subsanada:UMP 101")

  review <- list(
    schema = "monitoreo_deliverables_territorial_operational_package_review_v1",
    status = "review_ready",
    publication_gate = "operational_package_review_ready",
    blocks_publication = TRUE,
    apply_ready = TRUE,
    requires_revalidation = TRUE,
    publication_ready = FALSE,
    safe_to_apply = TRUE,
    coverage = list(missing_ump_items = list(), missing_tachas = 0L),
    application_plan = list(status = "ready", payload_ready = TRUE, ready_rows = 1L, blocked_rows = 0L)
  )
  preflight <- .monitoreo_publication_preflight_from_tabs(
    list(
      "Portada" = data.frame(A = "ok"),
      "Resumen territorial" = data.frame(A = "ok")
    ),
    family = "territorial",
    audience = "internal",
    project = "ACNURCG",
    cut = "2026-06-26",
    source = "Sheet validado ACNURCG",
    confirmed_full_data = TRUE,
    drift = drift,
    operational_package_review = review
  )
  codes <- vapply(preflight$blocking_issues, `[[`, character(1), "code")
  expect_true("critical_reference_drift" %in% codes)
  expect_true("territorial_operational_package_not_applied" %in% codes)
  expect_false("territorial_operational_package_review_missing" %in% codes)
  expect_false(preflight$checks$territorial_operational_package)
  expect_equal(preflight$evidence$operational_package_review$publication_ready, FALSE)
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
