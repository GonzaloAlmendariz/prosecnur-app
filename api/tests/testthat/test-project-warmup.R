test_that("project warmup reports module tasks without generating deliverables", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  project_path <- tempfile(fileext = ".pulso")
  session_set(sid, "project_path", project_path)

  before_files <- names(session_get(sid)$files %||% list())
  before_downloads <- list.files(file.path(session_get(sid)$dir, "downloads"), all.files = TRUE, no.. = TRUE)

  result <- .project_warmup_run(sid, mode = "full", budget_ms = 5000)

  expect_true(isTRUE(result$ok))
  expect_equal(result$kind, "project.warmup")
  expect_true(is.list(result$tasks))

  ids <- vapply(result$tasks, `[[`, character(1), "id")
  expect_setequal(
    intersect(.project_warmup_modules, ids),
    .project_warmup_modules
  )
  expect_true(all(vapply(result$tasks, function(task) {
    task$status %in% c("ready", "skipped", "timeout", "error")
  }, logical(1))))

  after_session <- session_get(sid)
  expect_identical(names(after_session$files %||% list()), before_files)
  after_downloads <- list.files(file.path(after_session$dir, "downloads"), all.files = TRUE, no.. = TRUE)
  expect_identical(after_downloads, before_downloads)
})

test_that("project warmup implementation does not call external sync, full reports or final artifact APIs", {
  candidates <- c(
    "R/project_warmup.R",
    file.path("api", "R", "project_warmup.R"),
    file.path("..", "..", "R", "project_warmup.R"),
    testthat::test_path("..", "..", "R", "project_warmup.R")
  )
  path <- candidates[file.exists(candidates)][1]
  expect_true(!is.na(path) && file.exists(path))
  source_text <- paste(readLines(path, warn = FALSE), collapse = "\n")

  expect_false(grepl("monitoreo_sync_sources\\s*\\(", source_text))
  expect_false(grepl("dashboard_publish", source_text, fixed = TRUE))
  expect_false(grepl("build_pulso\\s*\\(", source_text))
  expect_false(grepl("\\.register_output_file\\s*\\(", source_text))
  expect_false(grepl("report_scope\\s*=\\s*[\"']full[\"']", source_text))
  expect_true(grepl("report_scope\\s*=\\s*[\"']advance_summary[\"']", source_text))
})

test_that("project warmup plan selects concrete profile modules", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "monitoreo_config", list(
    monitoreo_profile = list(family = "acreditacion")
  ))
  session_set(sid, "hojas_ruta_config", list(enabled = TRUE))

  plan <- .project_warmup_plan(sid)
  backend_modules <- unlist(plan$backend_modules, use.names = FALSE)
  frontend_modules <- unlist(plan$frontend_modules, use.names = FALSE)

  expect_true(isTRUE(plan$ok))
  expect_true(all(backend_modules %in% .project_warmup_modules))
  expect_true("project" %in% backend_modules)
  expect_true("monitoreo" %in% backend_modules)
  expect_true("hojas_ruta" %in% backend_modules)
  expect_true("monitoreo_datos" %in% frontend_modules)
  expect_true("hojas_ruta_datos" %in% frontend_modules)
})

test_that("territorial warmup keeps hojas ruta complete out when only cartography is needed", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "monitoreo_config", list(
    monitoreo_profile = list(family = "territorial"),
    territorial = list(active_route_phase = "field")
  ))

  plan <- .project_warmup_plan(sid)
  backend_modules <- unlist(plan$backend_modules, use.names = FALSE)
  frontend_modules <- unlist(plan$frontend_modules, use.names = FALSE)

  expect_true("monitoreo" %in% backend_modules)
  expect_true("monitoreo_territorial" %in% backend_modules)
  expect_true("hojas_ruta_cartografia" %in% backend_modules)
  expect_false("hojas_ruta" %in% backend_modules)
  expect_true("hojas_ruta_cartografia" %in% frontend_modules)
  expect_false("hojas_ruta_datos" %in% frontend_modules)
})

test_that("hojas ruta warmup targets stay compact", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))

  targets <- .hojas_ruta_warmup_targets_payload(sid, max_ubigeos = 3L)

  expect_true(isTRUE(targets$ok))
  expect_true(isTRUE(targets$frame_ok))
  expect_lte(length(targets$ubigeos), 3L)
  expect_gt(targets$territories_count, 0L)
})

test_that("hojas ruta state counts active sample outputs as local data", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "hojas_ruta_active_phase", "field")
  session_set(sid, "hojas_ruta_runs", list(
    field = list(
      config = list(territorios = list("150103"), n_objetivo = 8L),
      ui_state = list(active_stage = "manzanas"),
      workspace_outputs = list(
        sample = list(
          total_entrevistas = 8L,
          blocks = list(list(
            id_manzana = "150103011000260",
            ubigeo = "150103",
            distrito = "ATE",
            zona = "01100",
            manzana = "0260",
            entrevistas = 8L
          ))
        )
      )
    )
  ))

  state <- .hojas_ruta_state_payload(sid)

  expect_true(isTRUE(state$has_data))
  expect_equal(state$active_phase, "field")
  expect_equal(length(state$workspace_outputs$sample$blocks), 1L)
})
