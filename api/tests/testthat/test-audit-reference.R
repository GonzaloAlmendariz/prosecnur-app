test_that("audit reference builds a portable .pulso and reopens in fresh sessions", {
  out_dir <- tempfile("audit-reference-")
  dir.create(out_dir, recursive = TRUE)
  on.exit(unlink(out_dir, recursive = TRUE, force = TRUE))

  built <- audit_reference_build(dir = out_dir)

  expect_true(file.exists(built$project_path))
  expect_true(file.exists(built$xlsform_path))
  expect_true(file.exists(built$data_path))
  expect_match(built$project_sha256, "^[0-9a-f]{64}$")

  zip_index <- zip::zip_list(built$project_path)
  expect_true(all(c("manifest.json", "state.rds") %in% zip_index$filename))
  expect_gte(sum(grepl("^files/", zip_index$filename)), 3L)

  unzip_dir <- tempfile("audit-reference-unzip-")
  utils::unzip(built$project_path, exdir = unzip_dir)
  on.exit(unlink(unzip_dir, recursive = TRUE, force = TRUE), add = TRUE)
  saved_state <- readRDS(file.path(unzip_dir, "state.rds"))
  expect_null(saved_state$dashboard_rp_data)
  expect_null(saved_state$dashboard_rp_inst)
  expect_true(is.list(saved_state$xlsform_state))
  expect_equal(saved_state$xlsform_state$source$kind, "xlsform")
  expect_gt(length(saved_state$xlsform_state$workbook$survey$rows), 20L)
  saved_kinds <- vapply(saved_state$files, function(meta) as.character(meta$kind %||% ""), character(1))
  expect_true(all(saved_kinds %in% c("xlsform", "data")))
  expect_equal(sum(saved_kinds == "xlsform"), 1L)
  expect_gte(sum(saved_kinds == "data"), 2L)

  load_a <- load_pulso(built$project_path)
  load_b <- load_pulso(built$project_path)
  on.exit(session_delete(load_a$session_id), add = TRUE)
  on.exit(session_delete(load_b$session_id), add = TRUE)

  expect_true(nzchar(load_a$session_id))
  expect_true(nzchar(load_b$session_id))
  expect_false(identical(load_a$session_id, load_b$session_id))

  s <- session_get(load_a$session_id)
  status <- project_status(load_a$session_id)
  expect_true(status$has_project)
  expect_equal(normalizePath(status$path, mustWork = FALSE), normalizePath(built$project_path, mustWork = FALSE))
  expect_equal(s$estudio$nombre, AUDIT_REFERENCE_NAME)
  expect_true(AUDIT_REFERENCE_BASE %in% names(s$estudio$bases))
  expect_true(AUDIT_REFERENCE_PANEL_BASE %in% names(s$estudio$bases))
  expect_true(is.list(s$dashboard_source))
  expect_true(isTRUE(s$dashboard_source$ready))
  expect_true(isTRUE(s$analitica_dim_ok))
  expect_s3_class(s$rp_dim, "data.frame")
  expect_true(any(grepl("^idx_", names(s$rp_dim))))
  panel_info <- .analitica_panel_info(load_a$session_id, .analitica_get_config(load_a$session_id))
  expect_true(isTRUE(panel_info$available))
  expect_equal(panel_info$key, "response_id")
  expect_gte(panel_info$n_bases, 2L)
  dash_manifest <- .dashboard_manifest(s)
  dim_tab <- Filter(function(tab) identical(tab$id, "dimensiones"), dash_manifest$tabs)[[1]]
  expect_true(isTRUE(dim_tab$available))
  expect_true(is.list(s$xlsform_state))
  expect_equal(s$xlsform_state$source$kind, "xlsform")
  expect_gt(length(s$xlsform_state$workbook$survey$rows), 20L)
  # Ver nota en test-audit-projects.R: la fuente del dashboard es lazy desde
  # que se movió al warmup, así que hay que pedir el estado fresco en vez de
  # asumir que `s` la trae desde el open.
  s <- .dashboard_fuente_lazy(s)
  expect_s3_class(s$dashboard_rp_data, "data.frame")
  expect_true(is.list(s$codif_por_base[[AUDIT_REFERENCE_BASE]]))
  expect_true("comentario_open" %in% names(s$codif_por_base[[AUDIT_REFERENCE_BASE]]$grupos_recod))
  graf_cfg <- .graficos_config_get(load_a$session_id)
  expect_true(is.list(graf_cfg))
  expect_gte(length(graf_cfg$plan$slides), 3L)
  expect_true(is.list(s$calc_muestra_estudio))
  expect_true(length(s$calc_muestra_estudio$componentes) >= 4L)
  expect_true(any(vapply(s$calc_muestra_estudio$componentes, function(comp) {
    !is.null(comp$resultado)
  }, logical(1))))
  expect_true(is.list(s$calc_muestra_aulas_frame))
  expect_true(is.list(s$calc_muestra_aulas_selection))
  expect_s3_class(s$calc_muestra_aulas_selection$selection, "data.frame")
  expect_gt(nrow(s$calc_muestra_aulas_selection$selection), 0L)
  expect_true(is.data.frame(s$monitoreo_snapshot$data))
  expect_gt(nrow(s$monitoreo_snapshot$data), 0L)
  expect_true(is.list(s$monitoreo_config))
  expect_equal(s$monitoreo_config$monitoreo_profile$family, "aulas_universitarias")
  expect_true(is.list(s$monitoreo_aulas_plan))
  expect_true(is.list(s$audit_reference$monitoreo_scenarios))
  expect_true(all(c("acreditacion", "territorial", "aulas_universitarias") %in% names(s$audit_reference$monitoreo_scenarios)))
  expect_true(is.list(s$hojas_ruta_workspace_outputs))
  expect_true(is.list(s$hojas_ruta_workspace_outputs$sample))
  expect_true(isTRUE(s$hojas_ruta_workspace_outputs$sample$ok))
  expect_equal(s$hojas_ruta_active_phase, "field")
  expect_true(is.list(s$hojas_ruta_runs$field))
})

test_that("audit run manifest pins project copy and accepts runtime sid update", {
  out_dir <- tempfile("audit-reference-")
  run_root <- tempfile("audit-runs-")
  dir.create(out_dir, recursive = TRUE)
  on.exit(unlink(c(out_dir, run_root), recursive = TRUE, force = TRUE))

  built <- audit_reference_build(dir = out_dir)
  manifest_path <- audit_reference_prepare_run(
    seed_project = built$project_path,
    runs_root = run_root,
    run_id = "test-run"
  )

  manifest <- jsonlite::fromJSON(manifest_path, simplifyVector = FALSE)
  expect_true(file.exists(manifest$project_path))
  expect_false(identical(normalizePath(manifest$project_path), normalizePath(built$project_path)))
  expect_equal(manifest$project_sha256, built$project_sha256)

  audit_reference_write_run_manifest(
    manifest_path,
    patch = list(status = "bootstrapped", sid = "sid-test", port = 8799L),
    project_path = manifest$project_path
  )
  updated <- jsonlite::fromJSON(manifest_path, simplifyVector = FALSE)
  expect_equal(updated$status, "bootstrapped")
  expect_equal(updated$sid, "sid-test")
  expect_equal(updated$port, 8799L)
  expect_equal(updated$project_path, normalizePath(manifest$project_path, mustWork = FALSE))
})
