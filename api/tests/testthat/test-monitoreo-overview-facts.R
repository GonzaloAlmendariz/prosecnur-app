# Coherencia del avance territorial entre el home de proyecto y la vista viva de
# "Avance territorial". Regresion del bug: el home leia
# snapshot$dashboard$territorial_reports$kpis (tablero "full" congelado) mientras
# la vista viva servia KPIs frescos de scope "advance_summary". Ver
# api/R/monitoreo_overview_facts.R.

test_that("monitoreo_territorial_overview_facts extrae los KPIs del tablero servido", {
  dashboard <- list(territorial_reports = list(kpis = list(
    total_respuestas = 1693L, validas = 1283L, meta = 1200L, avance_pct = 107,
    revision = 11L, geo_no_defendible = 4L, gps_crossable = 900L
  )))
  facts <- monitoreo_territorial_overview_facts(dashboard)
  expect_equal(facts$validas, 1283L)
  expect_equal(facts$meta, 1200L)
  expect_equal(facts$avance_pct, 107)
  expect_equal(facts$total_respuestas, 1693L)
  expect_equal(facts$revision, 11L)
  expect_equal(facts$geo_no_defendible, 4L)
  # Solo espeja el subconjunto que consume la tarjeta (no arrastra gps_crossable).
  expect_setequal(names(facts), .MONITOREO_OVERVIEW_TERRITORIAL_KEYS)
})

test_that("monitoreo_territorial_overview_facts degrada a NULL sin KPIs territoriales", {
  expect_null(monitoreo_territorial_overview_facts(NULL))
  expect_null(monitoreo_territorial_overview_facts(list()))
  expect_null(monitoreo_territorial_overview_facts(list(kpis = list(total = 10L))))
  expect_null(monitoreo_territorial_overview_facts(list(territorial_reports = list(kpis = list()))))
})

test_that("monitoreo_snapshot_refresh_territorial_facts solo marca changed cuando cambia", {
  snapshot <- list(dashboard = list())
  dashboard <- list(territorial_reports = list(kpis = list(
    total_respuestas = 100L, validas = 80L, meta = 200L, avance_pct = 40,
    revision = 5L, geo_no_defendible = 2L
  )))
  first <- monitoreo_snapshot_refresh_territorial_facts(snapshot, dashboard)
  expect_true(first$changed)
  expect_equal(first$snapshot$territorial_overview_facts$validas, 80L)

  # Segundo pase con el mismo tablero: no debe reescribir.
  again <- monitoreo_snapshot_refresh_territorial_facts(first$snapshot, dashboard)
  expect_false(again$changed)

  # Un tablero no territorial no toca el campo (no-op).
  noop <- monitoreo_snapshot_refresh_territorial_facts(first$snapshot, list(kpis = list(total = 1L)))
  expect_false(noop$changed)
  expect_equal(noop$snapshot$territorial_overview_facts$validas, 80L)
})

test_that("el home refleja el avance vivo tras refrescar el fact territorial", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "monitoreo_config", list(monitoreo_profile = list(family = "territorial")))

  # Tablero "full" congelado en el snapshot (lo que el home leia antes del fix).
  stale_dashboard <- list(territorial_reports = list(kpis = list(
    total_respuestas = 1200L, validas = 1028L, meta = 1351L, avance_pct = 85.7,
    revision = 6L, geo_no_defendible = 3L
  )))
  session_set(sid, "monitoreo_snapshot", list(
    synced_at = "2026-07-09T07:24:00Z",
    dashboard = stale_dashboard
  ))

  # Sin fact fresco, el home cae al tablero congelado (compat hacia atras).
  mon_stale <- .project_overview_payload(sid)$facts$monitoreo
  expect_equal(mon_stale$valid, 1028L)
  expect_equal(mon_stale$target, 1351L)
  expect_equal(mon_stale$avance_pct, 85.7)

  # La vista viva de "Avance territorial" sirve un tablero fresco (scope
  # advance_summary): esto es exactamente lo que el modulo muestra al usuario.
  live_dashboard <- list(territorial_reports = list(kpis = list(
    total_respuestas = 1693L, validas = 1283L, meta = 1200L, avance_pct = 107,
    revision = 11L, geo_no_defendible = 4L
  )))
  module_kpis <- .monitoreo_public_dashboard(live_dashboard)$territorial_reports$kpis

  # El backend espeja esos KPIs al snapshot (lo que hace .monitoreo_state_payload).
  s <- session_get(sid)
  refreshed <- monitoreo_snapshot_refresh_territorial_facts(s$monitoreo_snapshot, live_dashboard)
  expect_true(refreshed$changed)
  session_set(sid, "monitoreo_snapshot", refreshed$snapshot)

  # Ahora el home debe coincidir EXACTAMENTE con lo que sirve el modulo.
  mon_live <- .project_overview_payload(sid)$facts$monitoreo
  expect_equal(mon_live$valid, as.integer(module_kpis$validas))
  expect_equal(mon_live$target, as.integer(module_kpis$meta))
  expect_equal(mon_live$collected, as.integer(module_kpis$total_respuestas))
  expect_equal(mon_live$avance_pct, module_kpis$avance_pct)
  expect_equal(mon_live$alerts, as.integer(module_kpis$revision + module_kpis$geo_no_defendible))
  # Ya no queda rastro del avance congelado.
  expect_equal(mon_live$avance_pct, 107)
})
