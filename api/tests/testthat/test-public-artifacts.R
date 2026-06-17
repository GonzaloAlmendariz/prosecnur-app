test_that("snapshot publico de monitoreo guarda solo metadata y payload agregado", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "estudio", list(nombre = "Demo ACNUR", bases = list()))

  payload <- list(monitoreo_report = list(
    ok = TRUE,
    generated_at = "2026-06-16T00:00:00Z",
    synced_at = "2026-06-16T00:00:00Z",
    profile = list(family = "acreditacion"),
    accreditation = list(actors = list(), daily_general = list(), sources = list())
  ))
  snap <- .dashboard_publish_snapshot(
    sid,
    "Demo ACNUR",
    public_artifact = list(
      kind = "monitoreo",
      module = "monitoreo",
      title = "Demo ACNUR",
      public_scope = "aggregate",
      profile_family = "acreditacion",
      report_scope = "client_report"
    ),
    public_payload = payload
  )
  stage <- tempfile("pulso_public_test_")
  dir.create(stage, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(c(stage, snap$path), recursive = TRUE, force = TRUE), add = TRUE)
  zip::unzip(snap$path, files = "state.rds", exdir = stage)
  saved <- readRDS(file.path(stage, "state.rds"))

  expect_equal(saved$public_artifact$kind, "monitoreo")
  expect_equal(saved$public_artifact$public_scope, "aggregate")
  expect_true(isTRUE(saved$public_artifact_payload$monitoreo_report$ok))
  expect_equal(length(saved$files), 0L)
  expect_null(saved$monitoreo_snapshot)
  expect_null(saved$monitoreo_sources)
  expect_null(session_get(sid)$public_artifact)
  expect_null(session_get(sid)$public_artifact_payload)
})

test_that("staging de monitoreo usa runtime publico minimo", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  old_root <- Sys.getenv("PULSO_APP_ROOT", unset = NA_character_)
  repo_root <- normalizePath(file.path(testthat::test_path("..", ".."), ".."), mustWork = FALSE)
  Sys.setenv(PULSO_APP_ROOT = repo_root)
  on.exit({
    if (is.na(old_root)) Sys.unsetenv("PULSO_APP_ROOT") else Sys.setenv(PULSO_APP_ROOT = old_root)
  }, add = TRUE)
  session_set(sid, "estudio", list(nombre = "Demo ACNUR", bases = list()))

  prepared <- .dashboard_publish_prepare_space(
    sid = sid,
    repo_id = "pulso/demo-monitoreo",
    space_name = "demo-monitoreo",
    artifact = list(
      kind = "monitoreo",
      module = "monitoreo",
      title = "Demo ACNUR",
      public_scope = "aggregate",
      profile_family = "territorial",
      report_scope = "advance_summary"
    ),
    public_payload = list(monitoreo_report = list(ok = TRUE))
  )
  on.exit(unlink(prepared$stage, recursive = TRUE, force = TRUE), add = TRUE)

  expect_equal(prepared$artifact_kind, "monitoreo")
  expect_true(file.exists(file.path(prepared$stage, "api", "R", "public_runtime.R")))
  expect_true(file.exists(file.path(prepared$stage, "api", "inst", "www", "index.html")))
  expect_false(dir.exists(file.path(prepared$stage, "frontend")))
  expect_false(file.exists(file.path(prepared$stage, "api", "R", "router_dashboard.R")))
  expect_false(file.exists(file.path(prepared$stage, "api", "R", "router_carga.R")))
})

test_that("reporte publico de monitoreo prefiere payload embebido", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "public_artifact_payload", list(monitoreo_report = list(
    ok = TRUE,
    generated_at = "2026-06-16T00:00:00Z",
    synced_at = "2026-06-16T00:00:00Z",
    profile = list(family = "territorial"),
    territorial = list(district_progress = list())
  )))

  out <- .monitoreo_public_report_payload(sid)
  expect_true(isTRUE(out$ok))
  expect_equal(out$profile$family, "territorial")
})

test_that("builder publico de acreditacion no expone trazabilidad cruda", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  demo <- monitoreo_demo_payload(seed = 7L, n = 24L)
  session_set(sid, "monitoreo_sources", demo$sources)
  session_set(sid, "monitoreo_config", demo$config)
  session_set(sid, "monitoreo_snapshot", demo$snapshot)

  out <- .monitoreo_public_report_payload(sid)
  json <- as.character(jsonlite::toJSON(out, auto_unbox = TRUE, null = "null"))

  expect_true(isTRUE(out$ok))
  expect_false(grepl("\"(internal_queries|response_id|collector_id|source_id|_geolocation|lat|lon)\"\\s*:", json))
})

test_that("modo publico permite solo descriptor y reporte agregado de monitoreo", {
  old <- Sys.getenv("PULSO_PUBLIC_MODE", unset = NA_character_)
  on.exit({
    if (is.na(old)) Sys.unsetenv("PULSO_PUBLIC_MODE") else Sys.setenv(PULSO_PUBLIC_MODE = old)
  }, add = TRUE)
  Sys.setenv(PULSO_PUBLIC_MODE = "1")

  expect_true(public_request_allowed("GET", "/api/public/artifact"))
  expect_true(public_request_allowed("GET", "/api/monitoreo/public-report"))
  expect_false(public_request_allowed("POST", "/api/monitoreo/sync"))
  expect_false(public_request_allowed("POST", "/api/monitoreo/client-report/pdf"))
  expect_false(public_request_allowed("GET", "/api/monitoreo/client-report/pdf/download"))
})
