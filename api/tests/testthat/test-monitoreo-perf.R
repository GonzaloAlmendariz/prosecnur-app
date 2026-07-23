# Fase 3 del plan de mejoras 2026-07: rebuilds lazy del dashboard de Monitoreo
# (unidad 3.1) y fingerprint barato del token de caché (unidad 3.2).
# Ver api/R/monitoreo_perf.R.

.monitoreo_perf_test_data <- function(n = 4L) {
  data.frame(
    id = paste0("caso-", seq_len(n)),
    enumerador = rep(c("Ana", "Luis"), length.out = n),
    distrito = rep(c("Norte", "Sur"), length.out = n),
    estado = rep("completed", n),
    fecha = rep("2026-05-01T10:00:00Z", n),
    duracion = rep(600, n),
    stringsAsFactors = FALSE
  )
}

.monitoreo_perf_test_cfg <- function(data, extra = list()) {
  base <- list(
    id_var = "id",
    enumerator_var = "enumerador",
    date_var = "fecha",
    duration_var = "duracion",
    status_var = "estado",
    valid_statuses = c("completed"),
    control_vars = c("distrito")
  )
  monitoreo_normalize_config(modifyList(base, extra), data)
}

.monitoreo_perf_test_session <- function() {
  sid <- session_create()
  data <- .monitoreo_perf_test_data()
  cfg <- .monitoreo_perf_test_cfg(data)
  session_set(sid, "monitoreo_config", cfg)
  session_set(sid, "monitoreo_snapshot", list(
    data = data,
    config = cfg,
    synced_at = "2026-06-15T00:00:00Z"
  ))
  sid
}

test_that("store_config con rebuild ya no construye el dashboard inline (build lazy)", {
  sid <- .monitoreo_perf_test_session()
  on.exit(session_delete(sid), add = TRUE)

  cfg <- session_get(sid)$monitoreo_config
  cfg$critical_vars <- c("distrito")

  monitoreo_perf_reset_dashboard_build_count()
  cfg_guardada <- .monitoreo_store_config(sid, cfg, rebuild_dashboard = TRUE)

  # Cero builds durante la mutación: el POST ya no paga el dashboard inline.
  expect_identical(monitoreo_perf_dashboard_build_count(), 0L)
  s <- session_get(sid)
  expect_null(s$monitoreo_dashboard_cache_full)
  expect_null(s$monitoreo_snapshot$dashboard_cache_token)
  expect_identical(unlist(cfg_guardada$critical_vars, use.names = FALSE), "distrito")

  # El siguiente state payload (mismo request o GET posterior) construye UNA vez
  # y deja el token válido persistido en el snapshot.
  state <- .monitoreo_state_payload(sid)
  expect_identical(monitoreo_perf_dashboard_build_count(), 1L)
  expect_true(is.list(state$dashboard))
  expect_true(isTRUE(state$dashboard$ok))

  s <- session_get(sid)
  token <- s$monitoreo_snapshot$dashboard_cache_token %||% ""
  expect_true(nzchar(token))
  data_render <- .monitoreo_apply_source_metadata_to_data(
    s$monitoreo_snapshot$data,
    monitoreo_normalize_sources(s$monitoreo_sources %||% list())
  )
  cfg_render <- monitoreo_normalize_config(s$monitoreo_config, data_render)
  expect_true(.monitoreo_snapshot_dashboard_valid(
    s$monitoreo_snapshot,
    data_render,
    cfg_render,
    .monitoreo_dashboard_cache_token(s$monitoreo_snapshot, data_render, cfg_render)
  ))
})

test_that("el doble-rebuild del POST de config quedó eliminado (un solo build por request)", {
  sid <- .monitoreo_perf_test_session()
  on.exit(session_delete(sid), add = TRUE)

  # Réplica de la secuencia del endpoint POST /api/monitoreo/config:
  # store_config + state payload en la misma respuesta. Antes esto costaba DOS
  # builds full en familia acreditación (inline + cache-miss del state).
  cfg <- session_get(sid)$monitoreo_config
  cfg$min_duration_seconds <- 60

  monitoreo_perf_reset_dashboard_build_count()
  cfg <- .monitoreo_store_config(sid, cfg)
  state <- .monitoreo_state_payload(sid)
  expect_identical(monitoreo_perf_dashboard_build_count(), 1L)
  expect_true(is.list(state$dashboard))

  # Un GET de state posterior es cache hit: sigue en un solo build.
  state2 <- .monitoreo_state_payload(sid)
  expect_identical(monitoreo_perf_dashboard_build_count(), 1L)
  expect_true(is.list(state2$dashboard))
})

test_that("store_config marca stale la generación sin reconstruir nada", {
  sid <- .monitoreo_perf_test_session()
  on.exit(session_delete(sid), add = TRUE)

  s <- session_get(sid)
  snapshot <- s$monitoreo_snapshot
  snapshot$generated_at <- "2026-06-16T00:00:00Z"
  snapshot$generation_status <- "fresh"
  session_set(sid, "monitoreo_snapshot", snapshot)

  monitoreo_perf_reset_dashboard_build_count()
  .monitoreo_store_config(sid, session_get(sid)$monitoreo_config, rebuild_dashboard = TRUE)
  expect_identical(monitoreo_perf_dashboard_build_count(), 0L)
  s <- session_get(sid)
  expect_identical(s$monitoreo_snapshot$generation_status, "stale")
  expect_true(isTRUE(s$monitoreo_snapshot$pending_regeneration))
})

test_that("el fingerprint es estable, sensible a dims/nombres/synced_at y no hashea contenido", {
  df <- data.frame(a = seq_len(500), b = rep(letters[1:5], 100), stringsAsFactors = FALSE)
  fp <- monitoreo_data_fingerprint(df, "2026-06-15T00:00:00Z")
  expect_true(nzchar(fp))

  # Estable ante la misma data.
  expect_identical(fp, monitoreo_data_fingerprint(df, "2026-06-15T00:00:00Z"))

  # Prueba directa de que NO paga hash del contenido: mutar celdas con mismas
  # dims/nombres/synced_at produce el mismo fingerprint (la frescura de
  # contenido viaja por synced_at o por invalidación explícita de caches).
  df_mutada <- df
  df_mutada$a[1] <- 999999L
  expect_identical(fp, monitoreo_data_fingerprint(df_mutada, "2026-06-15T00:00:00Z"))

  # Cambia con nrow, con nombres de columnas y con synced_at.
  expect_false(identical(fp, monitoreo_data_fingerprint(df[-1, , drop = FALSE], "2026-06-15T00:00:00Z")))
  df_renombrada <- df
  names(df_renombrada) <- c("a", "z")
  expect_false(identical(fp, monitoreo_data_fingerprint(df_renombrada, "2026-06-15T00:00:00Z")))
  expect_false(identical(fp, monitoreo_data_fingerprint(df, "2026-06-16T00:00:00Z")))

  # Bordes: sin data no hay fingerprint.
  expect_identical(monitoreo_data_fingerprint(NULL), "")
  expect_identical(monitoreo_data_fingerprint(list(a = 1)), "")
})

test_that("el token del dashboard usa el fingerprint barato y respeta la frescura por config", {
  data <- .monitoreo_perf_test_data()
  cfg <- .monitoreo_perf_test_cfg(data)
  snapshot <- list(synced_at = "2026-06-15T00:00:00Z", data = data, config = cfg)

  token <- .monitoreo_dashboard_cache_token(snapshot, data, cfg)

  # Mutar contenido con mismas dims/nombres no cambia el token (ya no hay
  # sha256 del dataframe completo por request).
  data_mutada <- data
  data_mutada$enumerador[1] <- "Otra"
  expect_identical(token, .monitoreo_dashboard_cache_token(snapshot, data_mutada, cfg))

  # Un sync nuevo (synced_at) o un cambio de config sí invalidan.
  snapshot_resync <- snapshot
  snapshot_resync$synced_at <- "2026-06-16T00:00:00Z"
  expect_false(identical(token, .monitoreo_dashboard_cache_token(snapshot_resync, data, cfg)))
  cfg_distinta <- .monitoreo_perf_test_cfg(data, list(valid_statuses = c("completed", "partial")))
  expect_false(identical(token, .monitoreo_dashboard_cache_token(snapshot, data, cfg_distinta)))

  # Y un cambio de esquema de la data (columna nueva) también.
  data_ampliada <- data
  data_ampliada$telefono <- "1"
  expect_false(identical(token, .monitoreo_dashboard_cache_token(snapshot, data_ampliada, cfg)))
})
