# Unidad 3.1 (Plan de perf 2026-07): el GET de /api/monitoreo/state con cache
# hit deja de pagar la anotación de metadata y la normalización del config.
# Ver api/R/monitoreo_state_cache.R. Invariante duro: el payload de un hit es
# IDÉNTICO (byte a byte del JSON) al de un miss con el mismo estado, y toda
# mutación que hoy invalida (sync, config, fuentes) sigue invalidando.

.monitoreo_state_cache_test_data <- function(n = 6L) {
  df <- data.frame(
    id = paste0("caso-", seq_len(n)),
    source_id = rep("kobo_a1", n),
    enumerador = rep(c("Ana", "Luis"), length.out = n),
    distrito = rep(c("Norte", "Sur"), length.out = n),
    estado = rep("completed", n),
    fecha = rep("2026-05-01T10:00:00Z", n),
    duracion = rep(600, n),
    stringsAsFactors = FALSE
  )
  names(df)[names(df) == "source_id"] <- ".source_id"
  df
}

.monitoreo_state_cache_test_sources <- function(label = "Kobo campo") {
  list(list(
    id = "kobo_a1",
    kind = "kobo",
    label = label,
    asset_uid = "a1",
    declared_person_code_var = "id",
    declared_person_code_label = "Codigo declarado",
    created_at = "2026-05-01T00:00:00Z"
  ))
}

.monitoreo_state_cache_test_session <- function() {
  sid <- session_create()
  data <- .monitoreo_state_cache_test_data()
  cfg <- monitoreo_normalize_config(list(
    id_var = "id",
    enumerator_var = "enumerador",
    date_var = "fecha",
    duration_var = "duracion",
    status_var = "estado",
    valid_statuses = c("completed"),
    control_vars = c("distrito")
  ), data)
  session_set(sid, "monitoreo_config", cfg)
  session_set(sid, "monitoreo_sources", .monitoreo_state_cache_test_sources())
  session_set(sid, "monitoreo_snapshot", list(
    data = data,
    config = cfg,
    synced_at = "2026-06-15T00:00:00Z"
  ))
  sid
}

# Mismos flags que serializer_unboxed_json (plumber_app.R): la paridad se
# juzga sobre los bytes que viajarían por el cable.
.monitoreo_state_cache_json <- function(payload) {
  as.character(jsonlite::toJSON(payload, auto_unbox = TRUE))
}

test_that("hit del derived cache: payload byte a byte idéntico al miss y sin recomputar", {
  sid <- .monitoreo_state_cache_test_session()
  on.exit(session_delete(sid), add = TRUE)

  monitoreo_state_derived_reset_stats()
  state_miss <- .monitoreo_state_payload(sid)
  stats <- monitoreo_state_derived_stats()
  expect_identical(stats$misses, 1L)
  expect_identical(stats$hits, 0L)

  state_hit <- .monitoreo_state_payload(sid)
  stats <- monitoreo_state_derived_stats()
  expect_identical(stats$hits, 1L)
  expect_identical(stats$misses, 1L)

  # Paridad del JSON completo entre el primer miss y el hit siguiente.
  expect_identical(
    .monitoreo_state_cache_json(state_hit),
    .monitoreo_state_cache_json(state_miss)
  )

  # Paridad estricta hit vs miss con el MISMO estado: se invalida SOLO la
  # caché derivada (los caches de dashboard quedan) y se recomputa en frío.
  monitoreo_state_derived_invalidate(sid)
  state_miss2 <- .monitoreo_state_payload(sid)
  stats <- monitoreo_state_derived_stats()
  expect_identical(stats$misses, 2L)
  expect_identical(
    .monitoreo_state_cache_json(state_miss2),
    .monitoreo_state_cache_json(state_hit)
  )
})

test_that("la anotación de metadata sobrevive intacta en el camino cacheado", {
  sid <- .monitoreo_state_cache_test_session()
  on.exit(session_delete(sid), add = TRUE)

  s <- session_get(sid)
  sources <- monitoreo_normalize_sources(s$monitoreo_sources)
  frio <- monitoreo_state_derived(sid, s, sources)
  expect_false(isTRUE(frio$hit))
  caliente <- monitoreo_state_derived(sid, session_get(sid), sources)
  expect_true(isTRUE(caliente$hit))

  for (derived in list(frio, caliente)) {
    expect_true(".source_declared_person_code_var" %in% names(derived$data))
    expect_identical(unique(derived$data$.source_declared_person_code_var), "id")
    expect_identical(unique(derived$data$.source_declared_person_code_label), "Codigo declarado")
  }
  expect_identical(caliente$data, frio$data)
  expect_identical(caliente$cfg, frio$cfg)
  expect_identical(caliente$display_data, frio$display_data)
})

test_that("mutar el config invalida: store_config y session_set directo", {
  sid <- .monitoreo_state_cache_test_session()
  on.exit(session_delete(sid), add = TRUE)

  invisible(.monitoreo_state_payload(sid))
  monitoreo_state_derived_reset_stats()

  # Camino oficial: POST /api/monitoreo/config (invalidación nuclear + key).
  cfg <- session_get(sid)$monitoreo_config
  cfg$critical_vars <- c("distrito")
  .monitoreo_store_config(sid, cfg, rebuild_dashboard = TRUE)
  state <- .monitoreo_state_payload(sid)
  expect_identical(monitoreo_state_derived_stats()$misses, 1L)
  expect_identical(unlist(state$config$critical_vars, use.names = FALSE), "distrito")

  # Camino directo (p.ej. prewarm cambia la fase con session_set): la key
  # incluye el JSON del config crudo, así que también invalida sin nuclear.
  cfg <- session_get(sid)$monitoreo_config
  cfg$min_duration_seconds <- 61
  session_set(sid, "monitoreo_config", cfg)
  state <- .monitoreo_state_payload(sid)
  expect_identical(monitoreo_state_derived_stats()$misses, 2L)
  expect_identical(as.integer(state$config$min_duration_seconds), 61L)
})

test_that("un sync (data + synced_at nuevos) invalida y el payload lo refleja", {
  sid <- .monitoreo_state_cache_test_session()
  on.exit(session_delete(sid), add = TRUE)

  invisible(.monitoreo_state_payload(sid))
  monitoreo_state_derived_reset_stats()

  s <- session_get(sid)
  snapshot <- s$monitoreo_snapshot
  extra <- .monitoreo_state_cache_test_data(1L)
  extra$id <- "caso-999"
  snapshot$data <- rbind(snapshot$data, extra)
  snapshot$synced_at <- "2026-06-16T00:00:00Z"
  session_set(sid, "monitoreo_snapshot", snapshot)

  state <- .monitoreo_state_payload(sid)
  expect_identical(monitoreo_state_derived_stats()$misses, 1L)
  expect_identical(state$n_rows, 7L)
  expect_identical(state$synced_at, "2026-06-16T00:00:00Z")
})

test_that("mutar las fuentes invalida y la anotación se rehace", {
  sid <- .monitoreo_state_cache_test_session()
  on.exit(session_delete(sid), add = TRUE)

  invisible(.monitoreo_state_payload(sid))
  monitoreo_state_derived_reset_stats()

  session_set(sid, "monitoreo_sources", .monitoreo_state_cache_test_sources(label = "Kobo campo v2"))
  state <- .monitoreo_state_payload(sid)
  expect_identical(monitoreo_state_derived_stats()$misses, 1L)
  expect_identical(state$sources[[1]]$label, "Kobo campo v2")
})

test_that("la invalidación nuclear del dashboard también suelta los derivados", {
  sid <- .monitoreo_state_cache_test_session()
  on.exit(session_delete(sid), add = TRUE)

  invisible(.monitoreo_state_payload(sid))
  monitoreo_state_derived_reset_stats()

  .monitoreo_invalidate_dashboard_caches(sid)
  invisible(.monitoreo_state_payload(sid))
  stats <- monitoreo_state_derived_stats()
  expect_identical(stats$misses, 1L)
  expect_identical(stats$hits, 0L)
})

test_that("familia territorial en state light: hit con paridad y display_data cacheado", {
  sid <- .monitoreo_state_cache_test_session()
  on.exit(session_delete(sid), add = TRUE)

  cfg <- session_get(sid)$monitoreo_config
  cfg$monitoreo_profile <- list(family = "territorial")
  data <- session_get(sid)$monitoreo_snapshot$data
  cfg <- monitoreo_normalize_config(cfg, data)
  session_set(sid, "monitoreo_config", cfg)

  monitoreo_state_derived_reset_stats()
  state_miss <- .monitoreo_state_payload(sid, include_reports = FALSE)
  state_hit <- .monitoreo_state_payload(sid, include_reports = FALSE)
  stats <- monitoreo_state_derived_stats()
  expect_identical(stats$misses, 1L)
  expect_identical(stats$hits, 1L)
  # La coherencia de fase NO viaja en la caché derivada: se recomputa fresca
  # en cada request (hit y miss por igual) y trae un generated_at de reloj.
  # Se descuenta ese único campo volátil antes de exigir paridad byte a byte.
  state_miss$territorial_phase_coherence$generated_at <- NULL
  state_hit$territorial_phase_coherence$generated_at <- NULL
  expect_identical(
    .monitoreo_state_cache_json(state_hit),
    .monitoreo_state_cache_json(state_miss)
  )
})

test_that("la key de derivación discrimina data, fuentes y config; y es estable", {
  data <- .monitoreo_state_cache_test_data()
  sources <- monitoreo_normalize_sources(.monitoreo_state_cache_test_sources())
  cfg <- list(id_var = "id")
  s <- list(
    monitoreo_snapshot = list(data = data, synced_at = "2026-06-15T00:00:00Z"),
    monitoreo_config = cfg
  )
  key <- monitoreo_state_derived_key(s, sources)
  expect_true(nzchar(key))
  expect_identical(monitoreo_state_derived_key(s, sources), key)

  s_data <- s
  s_data$monitoreo_snapshot$synced_at <- "2026-06-16T00:00:00Z"
  expect_false(identical(monitoreo_state_derived_key(s_data, sources), key))

  s_cfg <- s
  s_cfg$monitoreo_config$id_var <- "distrito"
  expect_false(identical(monitoreo_state_derived_key(s_cfg, sources), key))

  sources_v2 <- monitoreo_normalize_sources(.monitoreo_state_cache_test_sources(label = "Otro"))
  expect_false(identical(monitoreo_state_derived_key(s, sources_v2), key))
})
