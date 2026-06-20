.monitoreo_report_cache_test_data <- function(source_id = "src_pilot") {
  data <- data.frame(
    consent = c("yes", "yes"),
    `Core/E1_age` = c(32, 41),
    `Core/M5_district` = c("sjm", "sjm"),
    `_geolocation` = c("-12.1 -77.0", "-12.2 -77.1"),
    `_uuid` = c("resp-a", "resp-b"),
    `_status` = rep("submitted_via_web", 2),
    `_submission_time` = c("2026-06-01T10:00:00Z", "2026-06-01T11:00:00Z"),
    `_source_id` = rep(source_id, 2),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  data$.source_id <- source_id
  data
}

.monitoreo_report_cache_test_cfg <- function(data = .monitoreo_report_cache_test_data(), phase = "pilot") {
  monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial", status = "active"),
    territorial = list(
      active_route_phase = phase,
      phase_sources = list(
        pilot = list(source_id = "src_pilot", asset_uid = "asset_pilot"),
        field = list(source_id = "src_field", asset_uid = "asset_field")
      )
    )
  ), data)
}

.monitoreo_report_cache_test_routes <- function() {
  list(
    pilot = list(sample = list(blocks = list(
      list(id_manzana = "150133001001", ubigeo = "150133", distrito = "SAN JUAN DE MIRAFLORES", zona = "001", manzana = "001", entrevistas = 1)
    ))),
    field = list(sample = list(blocks = list(
      list(id_manzana = "150133001002", ubigeo = "150133", distrito = "SAN JUAN DE MIRAFLORES", zona = "001", manzana = "002", entrevistas = 1)
    )))
  )
}

.monitoreo_report_cache_test_session <- function(phase = "pilot") {
  sid <- session_create()
  data <- .monitoreo_report_cache_test_data(if (identical(phase, "field")) "src_field" else "src_pilot")
  cfg <- .monitoreo_report_cache_test_cfg(data, phase = phase)
  session_set(sid, "monitoreo_config", cfg)
  session_set(sid, "monitoreo_snapshot", list(
    data = data,
    config = cfg,
    synced_at = "2026-06-15T00:00:00Z"
  ))
  session_set(sid, "monitoreo_sources", list(list(
    id = if (identical(phase, "field")) "src_field" else "src_pilot",
    kind = "kobo",
    label = if (identical(phase, "field")) "Campo" else "Piloto",
    enabled = TRUE,
    role = "respuestas",
    asset_uid = if (identical(phase, "field")) "asset_field" else "asset_pilot",
    dimensions = list(territorial_phase = phase)
  )))
  session_set(sid, "hojas_ruta_runs", .monitoreo_report_cache_test_routes())
  sid
}

.monitoreo_report_cache_clear_runtime <- function(sid, scope) {
  s <- session_get(sid)
  s[[paste("monitoreo_dashboard_cache", scope, sep = "_")]] <- NULL
  s[[paste("monitoreo_dashboard_cache_token", scope, sep = "_")]] <- NULL
  .session_env[[sid]] <- s
}

test_that("cache persistida de reportes territoriales sirve hits por fase y scope", {
  sid <- .monitoreo_report_cache_test_session("pilot")
  on.exit(session_delete(sid), add = TRUE)

  first <- .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = "route_summary")
  expect_equal(first$territorial_report_cache$cache_source, "build")
  expect_false(isTRUE(first$territorial_report_cache$cache_hit))
  expect_equal(first$dashboard$territorial_reports$report_scope, "route_summary")

  cache <- session_get(sid)$monitoreo_snapshot$territorial_report_cache
  expect_identical(cache$schema, .monitoreo_territorial_report_cache_schema)
  expect_gt(length(cache$entries), 0L)

  .monitoreo_report_cache_clear_runtime(sid, "route_summary")
  second <- .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = "route_summary")
  expect_true(isTRUE(second$territorial_report_cache$cache_hit))
  expect_equal(second$territorial_report_cache$cache_source, "project")
  expect_equal(second$territorial_report_cache$key, first$territorial_report_cache$key)

  s <- session_get(sid)
  cfg_field <- .monitoreo_report_cache_test_cfg(.monitoreo_report_cache_test_data("src_field"), phase = "field")
  data_field <- .monitoreo_report_cache_test_data("src_field")
  s$monitoreo_config <- cfg_field
  s$monitoreo_snapshot$data <- data_field
  s$monitoreo_snapshot$config <- cfg_field
  .session_env[[sid]] <- s

  field <- .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = "route_summary")
  expect_equal(field$territorial_report_cache$phase, "field")
  expect_false(identical(field$territorial_report_cache$key, first$territorial_report_cache$key))
})

test_that("cambio de respuestas invalida reporte GPS sin invalidar hash de ruta", {
  sid <- .monitoreo_report_cache_test_session("pilot")
  on.exit(session_delete(sid), add = TRUE)

  first <- .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = "validation_summary")
  .monitoreo_report_cache_clear_runtime(sid, "validation_summary")

  s <- session_get(sid)
  s$monitoreo_snapshot$data$`_geolocation`[[2]] <- "-12.5 -77.5"
  .session_env[[sid]] <- s

  changed <- .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = "validation_summary")
  expect_equal(changed$territorial_report_cache$cache_source, "build")
  expect_false(isTRUE(changed$territorial_report_cache$cache_hit))
  expect_false(identical(changed$territorial_report_cache$key, first$territorial_report_cache$key))
  expect_equal(changed$territorial_report_cache$route_hash, first$territorial_report_cache$route_hash)
})

test_that("cambio de ruta invalida reportes dependientes de geometria", {
  sid <- .monitoreo_report_cache_test_session("pilot")
  on.exit(session_delete(sid), add = TRUE)

  first <- .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = "route_summary")
  .monitoreo_report_cache_clear_runtime(sid, "route_summary")

  s <- session_get(sid)
  s$hojas_ruta_runs$pilot$sample$blocks[[1]]$entrevistas <- 3
  .session_env[[sid]] <- s

  changed <- .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = "route_summary")
  expect_equal(changed$territorial_report_cache$cache_source, "build")
  expect_false(isTRUE(changed$territorial_report_cache$cache_hit))
  expect_false(identical(changed$territorial_report_cache$route_hash, first$territorial_report_cache$route_hash))
})

test_that("validacion reutiliza geo_results cacheado para no recalcular cruce GPS", {
  sid <- .monitoreo_report_cache_test_session("pilot")
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  data <- s$monitoreo_snapshot$data
  cfg <- s$monitoreo_config
  context <- .monitoreo_territorial_context(sid, cfg, phase = "pilot")
  route_hash <- .monitoreo_territorial_route_hash(context, phase = "pilot")
  gps_hash <- .monitoreo_territorial_gps_hash(data, cfg, context, route_hash, phase = "pilot")
  geo_results <- data.frame(
    response_id = c("resp-a", "resp-b"),
    lat = c(-12.1, -12.2),
    lon = c(-77.0, -77.1),
    gps_parseable = c(TRUE, TRUE),
    geo_estado = c("geo_ok", "geo_no_defendible"),
    distance_m = c(0, 999),
    nearest_block_id = c("150133001001", "150133001001"),
    nearest_block_type = c("titular", "titular"),
    geometry_match = c("cached_inside", "cached_far"),
    stringsAsFactors = FALSE
  )
  .monitoreo_territorial_map_cache_set_layer(sid, "pilot", "gps_points", list(
    layer = "gps_points",
    status = "valid",
    hash = gps_hash,
    route_hash = route_hash,
    geo_results = geo_results,
    created_at = .monitoreo_now_iso()
  ))

  dashboard <- .monitoreo_dashboard_for_session(sid, data, cfg, include_reports = TRUE, report_scope = "validation_summary")
  audit <- .monitoreo_territorial_rows_df(dashboard$territorial_reports$response_audit)

  expect_equal(audit$geo_estado, c("geo_ok", "geo_no_defendible"))
  expect_equal(audit$distance_m, c(0, 999))
  expect_equal(audit$geometry_match, c("cached_inside", "cached_far"))
})

test_that("inicio operativo de fase excluye solo registros claramente previos", {
  data <- data.frame(
    consent = c("yes", "yes", "yes"),
    `Core/M5_district` = c("sjm", "sjm", "sjm"),
    `_geolocation` = c("-12.1 -77.0", "-12.2 -77.1", "-12.3 -77.2"),
    `_uuid` = c("antes", "despues", "sin-fecha"),
    `_status` = rep("submitted_via_web", 3),
    `_submission_time` = c("2026-06-16T12:59:00Z", "2026-06-16T13:00:00Z", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  data$.source_id <- "src_field"
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial", status = "active"),
    territorial = list(
      active_route_phase = "field",
      phase_sources = list(field = list(source_id = "src_field", asset_uid = "asset_field")),
      phase_windows = list(field = list(start_at = "2026-06-16T13:00:00Z"))
    )
  ), data)

  filtered <- .monitoreo_territorial_filter_data_for_phase(data, cfg, phase = "field")

  expect_equal(filtered$`_uuid`, c("despues", "sin-fecha"))
})

test_that("consultas territoriales solo incluyen respuestas operativas accionables", {
  audit <- data.frame(
    response_id = c("ok-1", "sin-gps", "no-efectiva", "no-efectiva-sin-cruce"),
    row_index = 1:4,
    distrito = rep("SAN JUAN DE MIRAFLORES", 4),
    ubigeo = rep("150133", 4),
    declared_ump_raw = c("81", "81", "82", "83"),
    responsible_display = c("P842 - Persona A", "P842 - Persona A", "P100 - Persona B", "P100 - Persona B"),
    advance_valid = c(TRUE, TRUE, FALSE, FALSE),
    source_effective = c(TRUE, TRUE, FALSE, FALSE),
    geo_estado = c("geo_ok", "geo_sin_gps", "geo_ok", "geo_sin_cruce"),
    duration_status = c("ok", "ok", "ok", "ok"),
    validation_status = c("validada", "revision", "validada", "no_defendible"),
    validation_decision = c("", "", "", ""),
    observation_status = c("", "en_observacion", "", "no_valida"),
    stringsAsFactors = FALSE
  )

  cases <- .monitoreo_territorial_internal_review_cases(audit, list(), phase = "field")
  types <- vapply(cases, `[[`, character(1), "type")
  reasons <- vapply(cases, `[[`, character(1), "reason")

  expect_equal(length(cases), 1L)
  expect_equal(types, "gps")
  expect_equal(reasons, "gps_sin_gps")
  expect_false(any(reasons %in% c("sin_observacion", "registro_no_efectivo", "gps_sin_cruce")))
})

test_that("prewarm territorial batch cachea scopes iniciales y prepara GPS una sola vez", {
  sid <- .monitoreo_report_cache_test_session("pilot")
  on.exit(session_delete(sid), add = TRUE)

  scopes <- c("source", "route_summary", "validation_summary", "queries_summary", "advance_summary")
  gps_calls <- 0L
  env <- environment(.monitoreo_territorial_gps_entry)
  original_gps_entry <- get(".monitoreo_territorial_gps_entry", envir = env)
  was_locked <- bindingIsLocked(".monitoreo_territorial_gps_entry", env)
  if (was_locked) unlockBinding(".monitoreo_territorial_gps_entry", env)
  assign(".monitoreo_territorial_gps_entry", function(...) {
    gps_calls <<- gps_calls + 1L
    original_gps_entry(...)
  }, envir = env)
  on.exit({
    assign(".monitoreo_territorial_gps_entry", original_gps_entry, envir = env)
    if (was_locked) lockBinding(".monitoreo_territorial_gps_entry", env)
  }, add = TRUE)

  first <- .monitoreo_territorial_prewarm_scopes(sid, phase = "pilot", scopes = scopes)
  expect_true(isTRUE(first$ok))
  expect_equal(vapply(first$scopes, `[[`, character(1), "status"), rep("ready", length(scopes)))
  expect_equal(gps_calls, 1L)

  cache <- session_get(sid)$monitoreo_snapshot$territorial_report_cache
  cached_scopes <- sort(unique(vapply(cache$entries, function(entry) {
    .monitoreo_scalar(entry$report_scope, "")
  }, character(1))))
  expect_setequal(intersect(scopes, cached_scopes), scopes)

  second <- .monitoreo_territorial_prewarm_scopes(sid, phase = "pilot", scopes = scopes)
  expect_true(all(vapply(second$scopes, function(item) isTRUE(item$cache_hit), logical(1))))
  expect_false(any(vapply(second$scopes, function(item) identical(item$cache_source, "build"), logical(1))))
  expect_equal(gps_calls, 1L)
})
