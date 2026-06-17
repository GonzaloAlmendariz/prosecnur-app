test_that("cache de mapas territoriales separa hashes de ruta y GPS", {
  data <- data.frame(
    `Core/M5_district` = c("sjm", "sjm"),
    `_geolocation` = c("-12.1 -77.0", "-12.2 -77.1"),
    `_uuid` = c("a", "b"),
    `_status` = rep("submitted_via_web", 2),
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial", status = "active"),
    territorial = list(phase_sources = list(pilot = list(source_id = "src_pilot", asset_uid = "asset_pilot")))
  ), data)
  context <- list(
    phase = "pilot",
    blocks = list(list(id_manzana = "150133001001", ubigeo = "150133", distrito = "SAN JUAN DE MIRAFLORES", zona = "001", manzana = "001", entrevistas = 2))
  )

  route_hash <- .monitoreo_territorial_route_hash(context, "pilot")
  gps_hash <- .monitoreo_territorial_gps_hash(data, cfg, context, route_hash, "pilot")
  data_changed <- data
  data_changed$`_geolocation`[[2]] <- "-12.3 -77.2"
  gps_hash_changed <- .monitoreo_territorial_gps_hash(data_changed, cfg, context, route_hash, "pilot")
  context_changed <- context
  context_changed$blocks[[1]]$entrevistas <- 4
  route_hash_changed <- .monitoreo_territorial_route_hash(context_changed, "pilot")

  expect_identical(.monitoreo_territorial_route_hash(context, "pilot"), route_hash)
  expect_false(identical(gps_hash, gps_hash_changed))
  expect_false(identical(route_hash, route_hash_changed))
})

test_that("cache territorial alinea geo_results por response_id antes de reutilizar", {
  data <- data.frame(
    `Core/M5_district` = c("sjm", "sjm"),
    `_geolocation` = c("-12.1 -77.0", "-12.2 -77.1"),
    `_uuid` = c("a", "b"),
    `_status` = rep("submitted_via_web", 2),
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(monitoreo_profile = list(family = "territorial", status = "active")), data)
  geo <- data.frame(
    response_id = c("b", "a"),
    lat = c(-12.2, -12.1),
    lon = c(-77.1, -77.0),
    gps_parseable = c(TRUE, TRUE),
    geo_estado = c("geo_revision", "geo_ok"),
    distance_m = c(180, 0),
    nearest_block_id = "150133001001",
    nearest_block_type = "titular",
    geometry_match = c("review_150_300m", "inside_selected_block"),
    stringsAsFactors = FALSE
  )
  entry <- list(
    layer = "gps_points",
    point_schema = .monitoreo_territorial_gps_points_schema,
    status = "valid",
    hash = "gps-hash",
    route_hash = "route-hash",
    geo_results = geo
  )

  aligned <- .monitoreo_territorial_cached_geo_results(
    data,
    cfg$territorial,
    entry,
    expected_hash = "gps-hash",
    route_hash = "route-hash"
  )

  expect_s3_class(aligned, "data.frame")
  expect_equal(aligned$response_id, c("a", "b"))
  expect_equal(aligned$geo_estado, c("geo_ok", "geo_revision"))
})

test_that("cache persistida marca GPS stale cuando cambia el snapshot sin invalidar ruta", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  data <- data.frame(
    `Core/M5_district` = "sjm",
    `_geolocation` = "-12.1 -77.0",
    `_uuid` = "a",
    `_status` = "submitted_via_web",
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial", status = "active"),
    territorial = list(phase_sources = list(pilot = list(source_id = "src_pilot")))
  ), data)
  data$.source_id <- "src_pilot"
  session_set(sid, "monitoreo_config", cfg)
  session_set(sid, "monitoreo_snapshot", list(data = data, config = cfg, synced_at = "2026-06-15T00:00:00Z"))
  session_set(sid, "hojas_ruta_runs", list(
    pilot = list(sample = list(blocks = list(
      list(id_manzana = "150133001001", ubigeo = "150133", distrito = "SAN JUAN DE MIRAFLORES", zona = "001", manzana = "001", entrevistas = 1)
    )))
  ))

  prepared <- .monitoreo_territorial_prepare_map_cache(sid, cfg, data, phase = "pilot")
  expect_equal(prepared$phases$pilot$route_geometry$status, "valid")
  expect_equal(prepared$phases$pilot$gps_points$status, "valid")

  data_changed <- data
  data_changed$`_geolocation` <- "-12.3 -77.2"
  meta <- .monitoreo_territorial_map_cache_meta(sid, cfg, data_changed)

  expect_equal(meta$phases$pilot$route_geometry$status, "valid")
  expect_equal(meta$phases$pilot$gps_points$status, "stale")
})
