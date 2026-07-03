test_that("catalogo de proyectos canonicos cubre las familias V1", {
  catalog <- audit_project_catalog()
  expect_equal(
    catalog$slug,
    c(
      "territorial_lima_manzanas",
      "acreditacion_multiactor",
      "procesamiento_multibase",
      "telefonico_cuotas"
    )
  )
  expect_equal(catalog$family, c("territorial", "acreditacion", "procesamiento", "telefonico"))
  expect_true(all(catalog$canonical_order == seq_len(nrow(catalog))))
})

test_that("proyectos canonicos generan .pulso portables con centinelas y fuentes API-like", {
  out_dir <- tempfile("audit-projects-")
  dir.create(out_dir, recursive = TRUE)
  on.exit(unlink(out_dir, recursive = TRUE, force = TRUE))

  built <- audit_project_build_all(out_dir = out_dir)
  expect_true(isTRUE(built$ok))
  expect_named(
    built$projects,
    c(
      "territorial_lima_manzanas",
      "acreditacion_multiactor",
      "procesamiento_multibase",
      "telefonico_cuotas"
    )
  )

  api_like_cols <- c(
    "response_id", "collector_id", "recipient_id", "date_modified",
    "response_status", "_id", "_uuid", "submission_date",
    "_submission_time", "source_channel"
  )

  for (slug in names(built$projects)) {
    project <- built$projects[[slug]]
    manifest_path <- file.path(dirname(project$project_path), "manifest.json")
    expect_true(file.exists(project$project_path), info = slug)
    expect_true(file.exists(manifest_path), info = slug)
    expect_match(project$project_sha256, "^[0-9a-f]{64}$", info = slug)

    zip_index <- zip::zip_list(project$project_path)
    expect_true(all(c("manifest.json", "state.rds") %in% zip_index$filename), info = slug)
    seed_manifest <- jsonlite::fromJSON(manifest_path, simplifyVector = FALSE)
    expect_equal(seed_manifest$schema, AUDIT_PROJECT_SEED_MANIFEST_SCHEMA, info = slug)
    expect_equal(seed_manifest$audit_project_schema, AUDIT_PROJECT_SCHEMA, info = slug)
    expect_equal(seed_manifest$slug, slug, info = slug)
    expect_equal(seed_manifest$project_sha256, .audit_project_sha256(project$project_path), info = slug)
    expect_equal(as.integer(seed_manifest$pulso_file_count), nrow(zip_index), info = slug)
    expect_true(all(c("manifest.json", "state.rds") %in% unlist(seed_manifest$pulso_required_entries, use.names = FALSE)), info = slug)
    expect_true(isTRUE(seed_manifest$synthetic), info = slug)
    expect_false(isTRUE(seed_manifest$copied_private_data), info = slug)
    expect_false(isTRUE(seed_manifest$secrets_included), info = slug)
    expect_false(isTRUE(seed_manifest$pulso_contains_generated_deliverables), info = slug)
    expect_true(isTRUE(seed_manifest$generated_deliverables_outside_pulso), info = slug)
    expect_equal(unlist(seed_manifest$canonical_flow, use.names = FALSE), AUDIT_PROJECT_CANONICAL_FLOW, info = slug)
    expect_equal(as.integer(seed_manifest$input_file_count), length(seed_manifest$inputs), info = slug)
    expect_true(all(vapply(seed_manifest$inputs, function(input) {
      file.exists(input$path %||% "") &&
        nzchar(input$role %||% "") &&
        nzchar(input$sha256 %||% "") &&
        identical(input$sha256, .audit_project_sha256(input$path))
    }, logical(1))), info = slug)
    forbidden <- grepl(
      "generated[.]xlsx|generated[.]pdf|evidence-pack|deliverables|validation-report[.]html",
      zip_index$filename,
      ignore.case = TRUE
    )
    expect_false(any(forbidden), info = slug)

    unzip_dir <- tempfile("audit-project-unzip-")
    utils::unzip(project$project_path, exdir = unzip_dir)
    on.exit(unlink(unzip_dir, recursive = TRUE, force = TRUE), add = TRUE)
    saved_state <- readRDS(file.path(unzip_dir, "state.rds"))
    saved_kinds <- vapply(saved_state$files, function(meta) as.character(meta$kind %||% ""), character(1))
    expect_true(all(saved_kinds %in% c("xlsform", "data")), info = slug)
    expect_false("connection_tokens" %in% names(saved_state), info = slug)
    expect_true(isTRUE(saved_state$audit_project$synthetic), info = slug)
    expect_false(isTRUE(saved_state$audit_project$copied_private_data), info = slug)
    expect_equal(unlist(saved_state$audit_project$module_order, use.names = FALSE), AUDIT_PROJECT_CANONICAL_FLOW, info = slug)
    expect_equal(saved_state$audit_project$coverage$family, seed_manifest$family, info = slug)

    load_a <- load_pulso(project$project_path)
    load_b <- load_pulso(project$project_path)
    on.exit(session_delete(load_a$session_id), add = TRUE)
    on.exit(session_delete(load_b$session_id), add = TRUE)
    expect_false(identical(load_a$session_id, load_b$session_id), info = slug)

    s <- session_get(load_a$session_id)
    expect_equal(s$audit_project$schema, AUDIT_PROJECT_SCHEMA, info = slug)
    expect_equal(s$audit_project$slug, slug, info = slug)
    expect_equal(unlist(s$audit_project$module_order, use.names = FALSE), AUDIT_PROJECT_CANONICAL_FLOW, info = slug)
    expect_equal(s$audit_project$coverage$family, seed_manifest$family, info = slug)
    expect_true(length(s$audit_project$sentinels) > 0L, info = slug)
    expect_true(length(s$audit_project$coverage) > 0L, info = slug)
    expect_true(isTRUE(s$audit_project$coverage$dashboard), info = slug)
    expect_true(is.list(s$dashboard_source), info = slug)
    expect_true(isTRUE(s$dashboard_source$ready), info = slug)
    expect_true(as.integer(s$dashboard_source$n_filas %||% 0L) > 0L, info = slug)
    expect_true(is.list(s$dashboard_config), info = slug)
    expect_equal(s$dashboard_config$titulo, s$audit_project$title, info = slug)
    expect_true(isTRUE(s$dashboard_curacion$confirmed), info = slug)
    expect_true(isTRUE(s$audit_project_sheets$simulated), info = slug)
    expect_true(isTRUE(s$audit_project_sheets$no_credentials), info = slug)
    expect_gt(length(s$audit_project_sheets$sources), 0L)
    source_manifest <- seed_manifest$source_manifest
    expect_equal(source_manifest$schema, AUDIT_PROJECT_SOURCE_MANIFEST_SCHEMA, info = slug)
    expect_equal(source_manifest$audit_project_sheets_schema, s$audit_project_sheets$schema, info = slug)
    expect_true(isTRUE(source_manifest$simulated), info = slug)
    expect_true(isTRUE(source_manifest$no_credentials), info = slug)
    expect_false(isTRUE(source_manifest$requires_credentials), info = slug)
    expect_equal(as.integer(seed_manifest$simulated_source_count), length(s$monitoreo_sources %||% list()), info = slug)
    expect_equal(as.integer(source_manifest$source_count), length(s$monitoreo_sources %||% list()), info = slug)
    expect_equal(as.integer(seed_manifest$simulated_google_sheets_source_count), length(s$audit_project_sheets$sources), info = slug)
    expect_equal(as.integer(source_manifest$google_sheets_source_count), length(s$audit_project_sheets$sources), info = slug)
    expect_equal(
      sort(unlist(source_manifest$source_kinds, use.names = FALSE)),
      sort(unique(vapply(s$monitoreo_sources %||% list(), function(src) as.character(src$kind %||% ""), character(1)))),
      info = slug
    )
    expect_true(all(vapply(source_manifest$sources, function(src) {
      isTRUE(src$simulated) &&
        isFALSE(src$requires_credentials) &&
        nzchar(src$id %||% "") &&
        nzchar(src$kind %||% "") &&
        nzchar(src$role %||% "")
    }, logical(1))), info = slug)
    expect_true(all(vapply(source_manifest$google_sheets, function(src) {
      nzchar(src$spreadsheet_id %||% "") &&
        nzchar(src$sheet_name %||% "") &&
        nzchar(src$range %||% "") &&
        nzchar(src$role %||% "") &&
        nzchar(src$mode %||% "") &&
        isFALSE(src$requires_credentials)
    }, logical(1))), info = slug)
    expect_true(all(vapply(s$audit_project_sheets$sources, function(src) {
      nzchar(src$spreadsheet_id %||% "") &&
        nzchar(src$spreadsheet_url %||% "") &&
        nzchar(src$sheet_name %||% "") &&
        nzchar(src$range %||% "") &&
        nzchar(src$role %||% "") &&
        nzchar(src$integration_mode %||% "") &&
        identical(src$mode %||% "", src$integration_mode %||% "") &&
        isFALSE(src$requires_credentials)
    }, logical(1))), info = slug)
    sheet_sources <- Filter(function(src) identical(src$kind, "google_sheets"), s$monitoreo_sources %||% list())
    expect_gt(length(sheet_sources), 0L)
    expect_true(all(vapply(sheet_sources, function(src) {
      nzchar(src$sheet_binding$spreadsheet_id %||% "") &&
        nzchar(src$sheet_binding$sheet_name %||% "")
    }, logical(1))), info = slug)
    expect_equal(unlist(s$audit_project$canonical_flow, use.names = FALSE), AUDIT_PROJECT_CANONICAL_FLOW, info = slug)
    expect_equal(length(s$audit_project$canonical_flow), 11L, info = slug)

    for (base_name in names(s$estudio$bases)) {
      df <- s$rp_data_sources[[base_name]]
      expect_true(inherits(df, "data.frame"), info = paste(slug, base_name))
      expect_true(all(api_like_cols %in% names(df)), info = paste(slug, base_name))
    }

    if (identical(slug, "territorial_lima_manzanas")) {
      expect_equal(s$monitoreo_config$monitoreo_profile$family, "territorial")
      expect_true(is.data.frame(s$monitoreo_snapshot$data))
      terr_data <- s$monitoreo_snapshot$data
      expect_true(any(grepl("^TER-RAW-", s$monitoreo_snapshot$data$response_id)))
      expect_true(any(is.na(s$monitoreo_snapshot$data$lat)))
      expect_true(all(c("_id", "submission_date", "_submission_time", "consent") %in% names(terr_data)))
      expect_equal(s$monitoreo_config$territorial$consent_var, "consent")
      expect_equal(s$monitoreo_config$territorial$platform_effective_var, "consent")
      expect_equal(unlist(s$monitoreo_config$territorial$platform_effective_values, use.names = FALSE), "1")
      expect_true(all(c("0", "1") %in% unique(as.character(terr_data$consent))))
      expect_equal(as.character(terr_data$consent[match("TER-RAW-0007", terr_data$response_id)]), "0")
      expect_equal(s$audit_project$coverage$reduced_from, "ACGACNUR")
      expect_true(any(vapply(s$monitoreo_sources %||% list(), function(src) {
        identical(src$id %||% "", "qa_kobo_territorial_ocurrencias")
      }, logical(1))))
      expect_true(isTRUE(s$hojas_ruta_workspace_outputs$sample$ok))
      expect_equal(s$audit_project$sentinels$incomplete_ump, "UMP-202")
      graph_cfg <- .graficos_config_get(load_a$session_id, s)
      expect_equal(length(graph_cfg$plan$slides), 7L)
      expect_equal(graph_cfg$selected_slide_id, "territorial-base")
      graph_titles <- vapply(graph_cfg$plan$slides, function(slide) {
        as.character(slide$payload$titulo %||% "")
      }, character(1))
      expect_true(any(grepl("base territorial", graph_titles, ignore.case = TRUE)))
      graph_coverage <- .graficos_plan_coverage(load_a$session_id, plan = graph_cfg$plan, config = graph_cfg)
      expect_equal(
        as.integer(graph_coverage$summary$included_graphable),
        as.integer(graph_coverage$summary$graphable_variables)
      )
      expect_equal(as.integer(graph_coverage$summary$unused_graphable), 0L)
    }

    if (identical(slug, "acreditacion_multiactor")) {
      expect_equal(s$monitoreo_config$monitoreo_profile$family, "acreditacion")
      acr_data <- s$monitoreo_snapshot$data
      expect_true(any(!nzchar(as.character(acr_data$fecha %||% ""))))
      expect_true(any(!nzchar(as.character(acr_data$dim_actor %||% ""))))
      expect_true(all(c(
        "q0001", "collector_id", "recipient_id", "date_modified",
        "response_status", "email_address", "custom_value", "cv_id",
        "link_personalizado"
      ) %in% names(acr_data)))
      expect_true(any(identical(acr_data$q0001, "No") | as.character(acr_data$q0001) == "No"))
      expect_true(is.data.frame(s$rp_data))
      expect_true(!is.null(s$rp_inst))
      expect_true("source_channel" %in% names(acr_data))
      expect_true("Telefónico" %in% unique(as.character(acr_data$source_channel)))
      expect_true(all(c("dim_actor", "carrera", "source_channel") %in% s$monitoreo_config$control_vars))
      rules <- s$monitoreo_config$monitoreo_profile$rejection_rules %||% list()
      expect_true(any(vapply(rules, function(rule) {
        "q0001" %in% unlist(rule$question_patterns %||% list(), use.names = FALSE) &&
          "No" %in% unlist(rule$rejection_answers %||% list(), use.names = FALSE)
      }, logical(1))))
      phone_entries <- .monitoreo_report_phone_config_entries(s$monitoreo_config)
      phone_source_ids <- sort(vapply(phone_entries, function(entry) as.character(entry$source_id %||% ""), character(1)))
      expect_equal(phone_source_ids, c("qa_source_docentes", "qa_source_egresados"))
      source_labels <- vapply(s$monitoreo_sources %||% list(), function(src) as.character(src$label %||% ""), character(1))
      expect_true("QA Docentes Personalizado" %in% source_labels)
      sheet_names <- vapply(Filter(function(src) identical(src$kind, "google_sheets"), s$monitoreo_sources %||% list()), function(src) {
        as.character(src$sheet_binding$sheet_name %||% "")
      }, character(1))
      expect_true(all(c("Estudiantes", "Docentes", "Egresados", "Empleadores", "Docentes Personalizado") %in% sheet_names))
      phone_reports <- monitoreo_acreditacion_reportes(
        acr_data,
        s$monitoreo_config,
        report_scope = "phone_summary"
      )
      phone_sheet <- Filter(function(sheet) identical(sheet$id, "monitoreo_telefonico"), phone_reports$sheets)[[1]]
      phone_blocks <- stats::setNames(
        phone_sheet$blocks,
        vapply(phone_sheet$blocks, function(block) block$id %||% "", character(1))
      )
      quota_rows <- .monitoreo_internal_records_to_df(phone_blocks$cuotas_variable$rows)
      expect_equal(sort(unique(quota_rows$Actor)), c("Docentes", "Egresados"))
      expect_equal(sort(unique(quota_rows$Variable)), c("carrera", "dim_actor", "source_channel"))
      expect_true(all(is.finite(suppressWarnings(as.numeric(quota_rows$Meta)))))
      expect_false(any(quota_rows$Valor == "Sin dato"))
      graph_cfg <- .graficos_config_get(load_a$session_id, s)
      expect_equal(length(graph_cfg$plan$slides), 7L)
      expect_equal(graph_cfg$selected_slide_id, "acreditacion-base")
      graph_coverage <- .graficos_plan_coverage(load_a$session_id, plan = graph_cfg$plan, config = graph_cfg)
      expect_equal(
        as.integer(graph_coverage$summary$included_graphable),
        as.integer(graph_coverage$summary$graphable_variables)
      )
      expect_equal(as.integer(graph_coverage$summary$unused_graphable), 0L)
      expect_equal(s$audit_project$coverage$reduced_from, "ACRCONTA")
      expect_true(is.list(s$calc_muestra_estudio))
      expect_equal(s$audit_project$sentinels$actor_missing_date, "ACR-RAW-MISSING-DATE")
    }

    if (identical(slug, "procesamiento_multibase")) {
      expect_equal(length(s$estudio$bases), 3L)
      expect_true(isTRUE(s$analitica_panel_ok))
      expect_true(is.list(s$dashboard_config))
      expect_true(is.list(s$codif_por_base$surveymonkey_api))
      expect_true(isTRUE(s$audit_project$coverage$dashboard))
      graph_cfg <- .graficos_config_get(load_a$session_id, s)
      expect_equal(length(graph_cfg$plan$slides), 17L)
      graph_coverage <- .graficos_plan_coverage(load_a$session_id, plan = graph_cfg$plan, config = graph_cfg)
      expect_equal(
        as.integer(graph_coverage$summary$included_graphable),
        as.integer(graph_coverage$summary$graphable_variables)
      )
      expect_equal(as.integer(graph_coverage$summary$unused_graphable), 0L)
    }

    if (identical(slug, "telefonico_cuotas")) {
      expect_equal(s$monitoreo_config$monitoreo_profile$family, "telefonico")
      expect_true("No contesta" %in% s$monitoreo_snapshot$data$estado)
      expect_true("Rechazo" %in% s$monitoreo_snapshot$data$estado)
      expect_true("link_personalizado" %in% names(s$monitoreo_snapshot$data))
      expect_equal(s$monitoreo_snapshot$dashboard$acreditacion_reports$report_scope, "phone_summary")
      expect_true(all(c(".source_role", "distrito", "grupo", "dim_actor", "responsable") %in% names(s$dashboard_rp_data)))
      expect_equal(sum(as.character(s$dashboard_rp_data$.source_role %||% "") == "barrido"), 48L)
      expect_true(all(c("distrito", "grupo", "dim_actor") %in% s$monitoreo_config$control_vars))

      phone_reports <- monitoreo_acreditacion_reportes(
        s$dashboard_rp_data,
        s$monitoreo_config,
        report_scope = "phone_summary"
      )
      phone_sheet <- Filter(function(sheet) identical(sheet$id, "monitoreo_telefonico"), phone_reports$sheets)[[1]]
      phone_blocks <- stats::setNames(
        phone_sheet$blocks,
        vapply(phone_sheet$blocks, function(block) block$id %||% "", character(1))
      )
      summary_rows <- .monitoreo_internal_records_to_df(phone_blocks$resumen_telefonico$rows)
      quota_rows <- .monitoreo_internal_records_to_df(phone_blocks$cuotas_variable$rows)
      expect_equal(as.integer(summary_rows$Casos[summary_rows$Indicador == "Total telefónico"]), 48L)
      expect_equal(sort(unique(quota_rows$Variable)), c("dim_actor", "distrito", "grupo"))
      expect_true(all(c("Docentes", "Egresados") %in% unique(quota_rows$Actor)))
      expect_true(any(is.finite(suppressWarnings(as.numeric(quota_rows$Meta)))))
      expect_false(any(quota_rows$Valor == "Sin dato"))

      graph_cfg <- .graficos_config_get(load_a$session_id, s)
      expect_equal(length(graph_cfg$plan$slides), 7L)
      expect_equal(graph_cfg$selected_slide_id, "phone-base")
      graph_titles <- vapply(graph_cfg$plan$slides, function(slide) {
        as.character(slide$payload$titulo %||% "")
      }, character(1))
      expect_true(any(grepl("barrido telefonico", graph_titles, ignore.case = TRUE)))
      graph_coverage <- .graficos_plan_coverage(load_a$session_id, plan = graph_cfg$plan, config = graph_cfg)
      expect_equal(
        as.integer(graph_coverage$summary$included_graphable),
        as.integer(graph_coverage$summary$graphable_variables)
      )
      expect_equal(as.integer(graph_coverage$summary$unused_graphable), 0L)
    }
  }
})

test_that("prepare_run copia una semilla canonica y fija manifest de corrida", {
  out_dir <- tempfile("audit-projects-")
  run_root <- tempfile("audit-project-runs-")
  dir.create(out_dir, recursive = TRUE)
  on.exit(unlink(c(out_dir, run_root), recursive = TRUE, force = TRUE))

  built <- audit_project_build("telefonico_cuotas", out_dir = out_dir)
  manifest_path <- audit_project_prepare_run(
    "telefonico_cuotas",
    runs_root = run_root,
    seed_project = built$project_path,
    run_id = "test-run"
  )
  manifest <- jsonlite::fromJSON(manifest_path, simplifyVector = FALSE)

  expect_true(file.exists(manifest$project_path))
  expect_false(identical(normalizePath(manifest$project_path), normalizePath(built$project_path)))
  expect_equal(manifest$schema, AUDIT_PROJECT_RUN_MANIFEST_SCHEMA)
  expect_equal(manifest$audit_project_schema, AUDIT_PROJECT_SCHEMA)
  expect_equal(manifest$audit_project_slug, "telefonico_cuotas")
  expect_equal(manifest$audit_project_family, "telefonico")
  expect_true(isTRUE(manifest$synthetic))
  expect_false(isTRUE(manifest$copied_private_data))
  expect_false(isTRUE(manifest$secrets_included))
  expect_true(isTRUE(manifest$generated_deliverables_outside_pulso))
  expect_false(isTRUE(manifest$pulso_contains_generated_deliverables))
  expect_equal(unlist(manifest$canonical_flow, use.names = FALSE), AUDIT_PROJECT_CANONICAL_FLOW)
  expect_equal(manifest$seed_project_sha256, built$project_sha256)
  expect_equal(manifest$seed_project$sha256, built$project_sha256)
  expect_equal(manifest$seed_project$source, "canonical_seed")
  expect_equal(manifest$project_sha256, built$project_sha256)
  expect_true(isTRUE(manifest$project_copied_from_seed))
  expect_equal(as.integer(manifest$pulso_file_count), nrow(zip::zip_list(manifest$project_path)))
  expect_true(all(c("manifest.json", "state.rds") %in% unlist(manifest$pulso_required_entries, use.names = FALSE)))
})

test_that("build y entregables aceptan rutas relativas usadas por scripts y Make", {
  cwd <- getwd()
  work_dir <- tempfile("audit-project-relative-")
  dir.create(work_dir, recursive = TRUE)
  on.exit({
    setwd(cwd)
    unlink(work_dir, recursive = TRUE, force = TRUE)
  }, add = TRUE)
  setwd(work_dir)

  built <- audit_project_build("territorial_lima_manzanas", out_dir = "seeds")
  expect_true(file.exists(built$project_path))
  expect_true(file.exists(file.path("seeds", "territorial_lima_manzanas", "manifest.json")))

  deliverables <- audit_project_deliverables("procesamiento_multibase", out_dir = "deliverables")
  expect_true(isTRUE(deliverables$ok))
  expect_true(file.exists(file.path("deliverables", "procesamiento_multibase-processing-evidence-pack.zip")))
  expect_true(file.exists(deliverables$seed_project$path))
  expect_equal(deliverables$seed_project$sha256, .audit_project_sha256(deliverables$seed_project$path))
  expect_equal(deliverables$seed_project$source, "built")
})

test_that("entregables canonicos generan paquetes con file_id, checksums y artefactos fuera del .pulso", {
  testthat::skip_if_not_installed("openxlsx")
  testthat::skip_if_not_installed("zip")

  out_root <- tempfile("audit-project-deliverables-")
  dir.create(out_root, recursive = TRUE)
  on.exit(unlink(out_root, recursive = TRUE, force = TRUE))
  expect_validation_html_contract <- function(result, slug, family) {
    html_records <- Filter(function(artifact) identical(artifact$role %||% "", "validation_html"), result$artifacts)
    expect_equal(length(html_records), 1L, info = slug)
    html_path <- html_records[[1]]$path
    expect_true(file.exists(html_path), info = slug)
    html <- paste(readLines(html_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
    expect_false(grepl("<style", html, fixed = TRUE), info = slug)
    expect_true(grepl("prosecnur.audit_project_validation_report.v1", html, fixed = TRUE), info = slug)
    expect_true(grepl(slug, html, fixed = TRUE), info = slug)
    expect_true(grepl(family, html, fixed = TRUE), info = slug)
    expect_true(grepl("generated_deliverables_outside_pulso", html, fixed = TRUE), info = slug)
    expect_true(grepl("secrets_included", html, fixed = TRUE), info = slug)
    expect_true(grepl("false", html, fixed = TRUE), info = slug)
    expect_true(grepl(result$seed_project$sha256, html, fixed = TRUE), info = slug)
  }
  expect_report_artifacts_registered <- function(result, slug) {
    file_ids <- vapply(result$artifacts, function(artifact) artifact$file_id %||% "", character(1))
    expect_true(all(nzchar(file_ids)), info = slug)
    manifest_records <- Filter(function(artifact) identical(artifact$role %||% "", "manifest"), result$artifacts)
    expect_equal(length(manifest_records), 1L, info = slug)
    expect_true(nzchar(manifest_records[[1]]$file_id %||% ""), info = slug)
  }

  territorial <- audit_project_deliverables(
    "territorial_lima_manzanas",
    out_dir = file.path(out_root, "territorial")
  )
  expect_true(isTRUE(territorial$ok))
  expect_true(file.exists(territorial$seed_project$path))
  expect_equal(territorial$seed_project$sha256, .audit_project_sha256(territorial$seed_project$path))
  expect_named(territorial$evidence_packs, c("client", "internal"))
  expect_true(nzchar(territorial$evidence_packs$client$file_id))
  expect_true(nzchar(territorial$evidence_packs$internal$file_id))
  terr_files <- vapply(territorial$artifacts, `[[`, character(1), "filename")
  expect_true("territorial_lima_manzanas-client-evidence-pack.zip" %in% terr_files)
  expect_true("territorial_lima_manzanas-internal-evidence-pack.zip" %in% terr_files)
  expect_true("validation-report.html" %in% terr_files)
  expect_true("manifest.json" %in% terr_files)
  expect_validation_html_contract(territorial, "territorial_lima_manzanas", "territorial")
  expect_report_artifacts_registered(territorial, "territorial_lima_manzanas")
  terr_zip <- territorial$evidence_packs$internal$zip$path
  expect_true(file.exists(terr_zip))
  expect_true(all(c("manifest.json", "generated.xlsx", "report.json") %in% zip::zip_list(terr_zip)$filename))
  expect_true(all(nzchar(vapply(territorial$artifacts, `[[`, character(1), "sha256"))))

  terr_client_zip <- territorial$evidence_packs$client$zip$path
  terr_client_entries <- zip::zip_list(terr_client_zip)$filename
  expect_true(all(c("generated.xlsx", "generated.pdf", "manifest.json", "report.json", "sentinel-audit.json") %in% terr_client_entries))
  terr_client_dir <- tempfile("audit-project-territorial-client-")
  dir.create(terr_client_dir, recursive = TRUE)
  on.exit(unlink(terr_client_dir, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(terr_client_zip, files = c("generated.xlsx", "generated.pdf", "sentinel-audit.json", "manifest.json"), exdir = terr_client_dir)
  terr_sentinel_audit <- jsonlite::fromJSON(file.path(terr_client_dir, "sentinel-audit.json"), simplifyVector = FALSE)
  expect_true(isTRUE(terr_sentinel_audit$synthetic))
  expect_equal(terr_sentinel_audit$schema, "prosecnur.audit_project_sentinel_audit.v1")
  expect_true(all(c("consent", "TER-RAW-0007", "qa_kobo_territorial_ocurrencias") %in% unlist(terr_sentinel_audit$sentinels, use.names = FALSE)))
  terr_pack_manifest <- jsonlite::fromJSON(file.path(terr_client_dir, "manifest.json"), simplifyVector = FALSE)
  expect_true(isTRUE(terr_pack_manifest$sentinel_audit_included))
  expect_equal(as.integer(terr_pack_manifest$expected_zip_file_count), nrow(zip::zip_list(terr_client_zip)))
  expect_gt(file.info(file.path(terr_client_dir, "generated.pdf"))$size, 1000)
  pdftotext <- Sys.which("pdftotext")
  if (nzchar(pdftotext)) {
    terr_pdf_text <- paste(system2(pdftotext, c(file.path(terr_client_dir, "generated.pdf"), "-"), stdout = TRUE), collapse = "\n")
    expect_true(grepl("Avance territorial", terr_pdf_text, fixed = TRUE))
    expect_true(grepl("2/3", terr_pdf_text, fixed = TRUE))
    expect_true(grepl("SAN JUAN", terr_pdf_text, fixed = TRUE))
    expect_true(grepl("SAN MART", terr_pdf_text, fixed = TRUE))
    expect_true(grepl("CHORRILLOS", terr_pdf_text, fixed = TRUE))
  }
  terr_resumen <- openxlsx::read.xlsx(file.path(terr_client_dir, "generated.xlsx"), sheet = "Resumen territorial")
  terr_values <- stats::setNames(as.character(terr_resumen$Valor), as.character(terr_resumen$Indicador))
  expect_equal(terr_values[["Registros procesados"]], "36")
  expect_equal(terr_values[["Efectivas"]], "22")
  expect_equal(terr_values[["Meta"]], "31")

  acreditacion <- audit_project_deliverables(
    "acreditacion_multiactor",
    out_dir = file.path(out_root, "acreditacion")
  )
  expect_true(isTRUE(acreditacion$ok))
  expect_validation_html_contract(acreditacion, "acreditacion_multiactor", "acreditacion")
  expect_report_artifacts_registered(acreditacion, "acreditacion_multiactor")
  acr_client_zip <- acreditacion$evidence_packs$client$zip$path
  expect_true(all(c("generated.xlsx", "generated.pdf", "manifest.json", "report.json", "sentinel-audit.json") %in% zip::zip_list(acr_client_zip)$filename))
  acr_client_dir <- tempfile("audit-project-acreditacion-client-")
  dir.create(acr_client_dir, recursive = TRUE)
  on.exit(unlink(acr_client_dir, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(acr_client_zip, files = c("generated.xlsx", "generated.pdf", "sentinel-audit.json"), exdir = acr_client_dir)
  acr_pdf <- file.path(acr_client_dir, "generated.pdf")
  acr_xlsx <- file.path(acr_client_dir, "generated.xlsx")
  acr_sentinel_audit <- jsonlite::fromJSON(file.path(acr_client_dir, "sentinel-audit.json"), simplifyVector = FALSE)
  expect_true(all(c("SurveyMonkey + telefonico + correo", "q0001 == No", "qa_source_docentes", "qa_source_egresados") %in% unlist(acr_sentinel_audit$sentinels, use.names = FALSE)))
  expect_gt(file.info(acr_pdf)$size, 1000)
  acr_report_cells <- as.character(unlist(openxlsx::read.xlsx(acr_xlsx, sheet = "Reporte", colNames = FALSE), use.names = FALSE))
  expect_true(any(acr_report_cells == "76"))
  expect_true(any(acr_report_cells == "176"))
  expect_true(any(grepl("Completas", acr_report_cells, fixed = TRUE)))
  pdftotext <- Sys.which("pdftotext")
  if (nzchar(pdftotext)) {
    acr_pdf_text <- paste(system2(pdftotext, c(acr_pdf, "-"), stdout = TRUE), collapse = "\n")
    expect_false(grepl("0 efectivas de 0", acr_pdf_text, fixed = TRUE))
    expect_true(grepl("76", acr_pdf_text, fixed = TRUE) || grepl("38 efectivas de 80", acr_pdf_text, fixed = TRUE))
  }

  procesamiento <- audit_project_deliverables(
    "procesamiento_multibase",
    out_dir = file.path(out_root, "procesamiento")
  )
  expect_true(isTRUE(procesamiento$ok))
  expect_named(procesamiento$evidence_packs, "processing")
  proc_files <- vapply(procesamiento$artifacts, `[[`, character(1), "filename")
  expect_true("analitica-summary.csv" %in% proc_files)
  expect_true("processing-summary.xlsx" %in% proc_files)
  expect_true("validation-report.html" %in% proc_files)
  expect_true("procesamiento_multibase-processing-evidence-pack.zip" %in% proc_files)
  expect_validation_html_contract(procesamiento, "procesamiento_multibase", "procesamiento")
  expect_report_artifacts_registered(procesamiento, "procesamiento_multibase")
  expect_true(nzchar(procesamiento$evidence_packs$processing$file_id))
  proc_csv <- utils::read.csv(file.path(out_root, "procesamiento", "analitica-summary.csv"), check.names = FALSE, stringsAsFactors = FALSE)
  expected_processing_channels <- c("Google Sheets controlado", "Kobo API", "SurveyMonkey API")
  expect_equal(sort(proc_csv$source_channel), expected_processing_channels)
  proc_xlsx_bases <- openxlsx::read.xlsx(file.path(out_root, "procesamiento", "processing-summary.xlsx"), sheet = "Bases")
  expect_equal(sort(proc_xlsx_bases$source_channel), expected_processing_channels)
  proc_zip <- procesamiento$evidence_packs$processing$zip$path
  expect_true(file.exists(proc_zip))
  expect_true(all(c("analitica-summary.csv", "processing-summary.xlsx", "validation-report.html") %in% zip::zip_list(proc_zip)$filename))

  telefonico <- audit_project_deliverables(
    "telefonico_cuotas",
    out_dir = file.path(out_root, "telefonico")
  )
  expect_true(isTRUE(telefonico$ok))
  expect_named(telefonico$evidence_packs, c("client", "internal"))
  expect_validation_html_contract(telefonico, "telefonico_cuotas", "telefonico")
  expect_report_artifacts_registered(telefonico, "telefonico_cuotas")
  expect_equal(telefonico$evidence_packs$client$family, "telephone_monitoring")
  expect_equal(telefonico$evidence_packs$client$report_scope, "phone_summary")
  expect_equal(telefonico$evidence_packs$client$status, "ready")
  tel_client_zip <- telefonico$evidence_packs$client$zip$path
  tel_client_entries <- zip::zip_list(tel_client_zip)$filename
  expect_true(all(c("generated.xlsx", "manifest.json", "report.json", "sentinel-audit.json") %in% tel_client_entries))
  tel_client_dir <- tempfile("audit-project-telefonico-client-")
  dir.create(tel_client_dir, recursive = TRUE)
  on.exit(unlink(tel_client_dir, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(tel_client_zip, files = c("generated.xlsx", "sentinel-audit.json"), exdir = tel_client_dir)
  tel_client_sentinel <- jsonlite::fromJSON(file.path(tel_client_dir, "sentinel-audit.json"), simplifyVector = FALSE)
  expect_equal(tel_client_sentinel$schema, "prosecnur.audit_project_sentinel_audit.v1")
  expect_equal(tel_client_sentinel$family, "telefonico")
  expect_true(isTRUE(tel_client_sentinel$synthetic))
  expect_true(all(c("No contesta", "Villa Sur", "Rechazo", "link_personalizado") %in% unlist(tel_client_sentinel$sentinels, use.names = FALSE)))
  tel_xlsx <- file.path(tel_client_dir, "generated.xlsx")
  expect_equal(
    openxlsx::getSheetNames(tel_xlsx),
    c("Reporte telefónico", "Monitoreo telefónico", "Alertas", "Corte y fuentes")
  )
  tel_cells <- as.character(unlist(lapply(openxlsx::getSheetNames(tel_xlsx), function(sheet) {
    openxlsx::read.xlsx(tel_xlsx, sheet = sheet, colNames = FALSE)
  }), use.names = FALSE))
  tel_cells <- tel_cells[!is.na(tel_cells)]
  expect_true(any(grepl("Monitoreo telefónico", tel_cells, fixed = TRUE)))
  expect_true(any(grepl("Total telefónico", tel_cells, fixed = TRUE)))
  expect_true(any(grepl("No contesta", tel_cells, fixed = TRUE)))
  expect_true(any(grepl("Rechazo", tel_cells, fixed = TRUE)))
  expect_false(any(grepl("Acreditación", tel_cells, fixed = TRUE)))
  expect_false(any(grepl("Sin universo configurado", tel_cells, fixed = TRUE)))
  expect_false(any(grepl("CodPulso", tel_cells, fixed = TRUE)))

  tel_internal_zip <- telefonico$evidence_packs$internal$zip$path
  tel_internal_entries <- zip::zip_list(tel_internal_zip)$filename
  expect_true("sentinel-audit.json" %in% tel_internal_entries)
  tel_internal_dir <- tempfile("audit-project-telefonico-internal-")
  dir.create(tel_internal_dir, recursive = TRUE)
  on.exit(unlink(tel_internal_dir, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(tel_internal_zip, files = c("generated.xlsx", "sentinel-audit.json"), exdir = tel_internal_dir)
  tel_internal_sentinel <- jsonlite::fromJSON(file.path(tel_internal_dir, "sentinel-audit.json"), simplifyVector = FALSE)
  expect_equal(tel_internal_sentinel$schema, "prosecnur.audit_project_sentinel_audit.v1")
  expect_equal(tel_internal_sentinel$family, "telefonico")
  expect_true(isTRUE(tel_internal_sentinel$synthetic))
  expect_true(all(c("No contesta", "Villa Sur", "Rechazo", "link_personalizado") %in% unlist(tel_internal_sentinel$sentinels, use.names = FALSE)))
  tel_internal_xlsx <- file.path(tel_internal_dir, "generated.xlsx")
  expect_true("Seguimiento telefónico" %in% openxlsx::getSheetNames(tel_internal_xlsx))
  tel_internal_portada <- as.character(unlist(openxlsx::read.xlsx(
    tel_internal_xlsx,
    sheet = "Portada",
    colNames = FALSE
  ), use.names = FALSE))
  tel_internal_portada <- tel_internal_portada[!is.na(tel_internal_portada)]
  expect_true(any(grepl("Monitoreo telefónico", tel_internal_portada, fixed = TRUE)))
  expect_true(any(grepl("Casos telefónicos", tel_internal_portada, fixed = TRUE)))
  expect_false(any(grepl("Acreditación", tel_internal_portada, fixed = TRUE)))
  expect_false(any(grepl("Actores monitoreados", tel_internal_portada, fixed = TRUE)))
})
