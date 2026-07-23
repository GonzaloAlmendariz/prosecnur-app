# Fase 3 del plan de mejoras 2026-07: rebuilds lazy del dashboard de Monitoreo
# (unidad 3.1), fingerprint barato del token de caché (unidad 3.2), caché de
# monitoreo_variables + transpose vectorizado (unidad 3.3) y caps de payload
# (unidad 3.5). Ver api/R/monitoreo_perf.R.

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

# --- Unidad 3.3b: transpose vectorizado --------------------------------------

# Réplicas literales de las implementaciones históricas (router:119-130 y
# engine:7000-7010 antes de la unidad 3.3) para el golden de equivalencia.
.perf_old_df_records <- function(x) {
  if (is.null(x)) return(list())
  if (!is.data.frame(x)) x <- as.data.frame(x, stringsAsFactors = FALSE)
  if (!nrow(x)) return(list())
  unname(lapply(seq_len(nrow(x)), function(i) {
    row <- as.list(x[i, , drop = FALSE])
    lapply(row, function(v) {
      if (length(v) == 0L) return(NA)
      v[[1]]
    })
  }))
}

.perf_old_territorial_df_rows <- function(df) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(list())
  unname(lapply(seq_len(nrow(df)), function(i) {
    row <- as.list(df[i, , drop = FALSE])
    lapply(row, function(v) {
      if (length(v) == 0L) return(NA)
      v <- v[[1]]
      if (is.factor(v)) as.character(v) else v
    })
  }))
}

# Data sintética con los bordes reales del snapshot: NA, UTF-8 con tildes/ñ,
# tipos mixtos (int/double/lógico/factor/POSIXct) y list-columns con NULL.
.perf_df_mixta <- function() {
  df <- data.frame(
    id = 1:4,
    texto = c("Ñandú", "acción", NA, ""),
    valor = c(1.5, NA, -3.25, 0),
    flag = c(TRUE, FALSE, NA, TRUE),
    nivel = factor(c("alto", "bajo", NA, "alto")),
    fecha = as.POSIXct("2026-05-01 08:00:00", tz = "UTC") + c(0, 3600, NA, 7200),
    stringsAsFactors = FALSE
  )
  df$anidada <- list(NULL, c(1, 2), "z", list(a = 1))
  df
}

test_that("golden: el transpose vectorizado replica el shape histórico exacto", {
  df <- .perf_df_mixta()

  expect_identical(monitoreo_perf_df_records(df), .perf_old_df_records(df))
  expect_identical(monitoreo_perf_df_rows(df), .perf_old_territorial_df_rows(df))

  # Y a través de los wrappers reales de router/engine.
  expect_identical(.monitoreo_df_records(df), .perf_old_df_records(df))
  expect_identical(.monitoreo_territorial_df_rows(df), .perf_old_territorial_df_rows(df))

  # Bordes: NULL, no-df, 0 filas.
  expect_identical(monitoreo_perf_df_records(NULL), list())
  expect_identical(monitoreo_perf_df_rows(NULL), list())
  expect_identical(monitoreo_perf_df_rows(list(a = 1)), list())
  expect_identical(monitoreo_perf_df_records(df[0, , drop = FALSE]), list())
  expect_identical(monitoreo_perf_df_rows(df[0, , drop = FALSE]), list())
  expect_identical(
    monitoreo_perf_df_records(list(a = 1:2, b = c("x", "y"))),
    .perf_old_df_records(list(a = 1:2, b = c("x", "y")))
  )

  # df sin columnas: un registro vacío por fila, como el histórico.
  sin_cols <- df
  sin_cols[names(sin_cols)] <- NULL
  expect_identical(monitoreo_perf_df_records(sin_cols), .perf_old_df_records(sin_cols))

  # Columna con dim() (matriz embebida): cae al fallback fila-por-fila.
  con_matriz <- data.frame(id = 1:2)
  con_matriz$gps <- matrix(c(1, 2, 3, 4), nrow = 2)
  expect_identical(monitoreo_perf_df_records(con_matriz), .perf_old_df_records(con_matriz))
  expect_identical(monitoreo_perf_df_rows(con_matriz), .perf_old_territorial_df_rows(con_matriz))
})

# --- Unidad 3.3a: caché de monitoreo_variables --------------------------------

test_that("monitoreo_variables_cached: hit por fingerprint, miss por sync/esquema, invalidación explícita", {
  on.exit(monitoreo_perf_variables_cache_invalidate(), add = TRUE)
  sid <- "sid-perf-variables"
  data <- .monitoreo_perf_test_data(6L)
  cfg <- .monitoreo_perf_test_cfg(data)

  base <- monitoreo_variables_cached(sid, data, "2026-06-15T00:00:00Z", cfg)
  expect_identical(base, monitoreo_variables(data))

  # HIT probado por comportamiento: mutar contenido con mismas dims/synced_at
  # sirve el valor cacheado (la frescura de contenido viaja por synced_at o
  # por invalidación explícita, igual que el token del dashboard).
  data_mutada <- data
  data_mutada$distrito[1] <- "Este"
  expect_identical(monitoreo_variables_cached(sid, data_mutada, "2026-06-15T00:00:00Z", cfg), base)

  # MISS por re-sync: el synced_at nuevo recomputa y ve el contenido nuevo.
  con_sync <- monitoreo_variables_cached(sid, data_mutada, "2026-06-16T00:00:00Z", cfg)
  expect_identical(con_sync, monitoreo_variables(data_mutada))
  expect_false(identical(con_sync, base))

  # MISS por esquema: una columna nueva cambia el fingerprint.
  data_ampliada <- data
  data_ampliada$telefono <- "1"
  expect_identical(
    monitoreo_variables_cached(sid, data_ampliada, "2026-06-16T00:00:00Z", cfg),
    monitoreo_variables(data_ampliada)
  )

  # MISS por invalidación explícita (la ruta de .monitoreo_invalidate_dashboard_caches).
  monitoreo_variables_cached(sid, data, "2026-06-15T00:00:00Z", cfg)
  monitoreo_variables_cached(sid, data_mutada, "2026-06-15T00:00:00Z", cfg) # hit stale a propósito
  monitoreo_perf_variables_cache_invalidate(sid)
  expect_identical(
    monitoreo_variables_cached(sid, data_mutada, "2026-06-15T00:00:00Z", cfg),
    monitoreo_variables(data_mutada)
  )

  # La fase territorial discrimina la key aunque las dims coincidan.
  cfg_pilot <- cfg
  cfg_pilot$monitoreo_profile$family <- "territorial"
  cfg_pilot$territorial <- list(active_route_phase = "pilot")
  cfg_field <- cfg_pilot
  cfg_field$territorial$active_route_phase <- "field"
  monitoreo_variables_cached(sid, data, "2026-06-15T00:00:00Z", cfg_pilot)
  expect_identical(
    monitoreo_variables_cached(sid, data_mutada, "2026-06-15T00:00:00Z", cfg_field),
    monitoreo_variables(data_mutada)
  )

  # Bordes: sin filas no hay caché ni error; sin sid computa directo.
  expect_identical(monitoreo_variables_cached(sid, data[0, , drop = FALSE], "x", cfg), list())
  expect_identical(monitoreo_variables_cached(NULL, data, "x", cfg), monitoreo_variables(data))
})

test_that("el state payload sirve variables desde la caché y la invalidación de caches la limpia", {
  sid <- .monitoreo_perf_test_session()
  on.exit(session_delete(sid), add = TRUE)
  on.exit(monitoreo_perf_variables_cache_invalidate(), add = TRUE)

  state <- .monitoreo_state_payload(sid)
  esperado <- monitoreo_variables(session_get(sid)$monitoreo_snapshot$data)
  expect_identical(state$variables, esperado)

  # Segundo state: hit (mismo valor, entrada cacheada presente).
  expect_false(is.null(.monitoreo_perf_variables_cache[[sid]]))
  state2 <- .monitoreo_state_payload(sid)
  expect_identical(state2$variables, esperado)

  # La invalidación nuclear del dashboard también limpia esta caché.
  .monitoreo_invalidate_dashboard_caches(sid)
  expect_null(.monitoreo_perf_variables_cache[[sid]])
})

# --- Unidad 3.5: caps de payload en la frontera pública ----------------------

test_that("cap territorial: recorta response_audit y map$points con campos aditivos", {
  filas <- function(n) unname(lapply(seq_len(n), function(i) list(response_id = paste0("r", i))))
  reports <- list(
    response_audit = filas(7L),
    map = list(phase = "field", points = filas(9L), legend = list()),
    team = filas(3L)
  )

  capped <- monitoreo_perf_cap_territorial_reports(reports, cap = 5L)
  expect_length(capped$response_audit, 5L)
  expect_identical(capped$response_audit_total_rows, 7L)
  expect_true(capped$response_audit_truncated)
  expect_length(capped$map$points, 5L)
  expect_identical(capped$map$points_total_rows, 9L)
  expect_true(capped$map$points_truncated)
  # El resto del shape no se toca (aditivo).
  expect_identical(capped$team, reports$team)
  expect_identical(capped$map$phase, "field")
  expect_identical(capped$response_audit[[1]], reports$response_audit[[1]])

  # Bajo el cap: reporta totales sin truncar.
  chico <- monitoreo_perf_cap_territorial_reports(reports, cap = 50L)
  expect_length(chico$response_audit, 7L)
  expect_false(chico$response_audit_truncated)
  expect_identical(chico$map$points_total_rows, 9L)

  # Scopes que vacían el payload no ganan campos con totales engañosos.
  vacio <- monitoreo_perf_cap_territorial_reports(list(response_audit = list(), map = list(points = list())), cap = 5L)
  expect_null(vacio$response_audit_total_rows)
  expect_null(vacio$map$points_truncated)

  # También acepta data.frames (paths de fixtures) y reportes NULL.
  df_reports <- list(response_audit = data.frame(id = 1:8), map = list(points = data.frame(id = 1:2)))
  df_capped <- monitoreo_perf_cap_territorial_reports(df_reports, cap = 5L)
  expect_identical(nrow(df_capped$response_audit), 5L)
  expect_identical(df_capped$response_audit_total_rows, 8L)
  expect_true(df_capped$response_audit_truncated)
  expect_false(df_capped$map$points_truncated)
  expect_null(monitoreo_perf_cap_territorial_reports(NULL))
})

test_that("el dashboard público aplica el cap sin mutar el dashboard almacenado", {
  n <- 5203L
  filas <- unname(lapply(seq_len(n), function(i) list(response_id = paste0("r", i))))
  dashboard <- list(
    ok = TRUE,
    kpis = list(total = n),
    progress = data.frame(),
    production = data.frame(),
    inconsistencies = data.frame(),
    territorial_reports = list(
      response_audit = filas,
      map = list(phase = "field", points = filas)
    )
  )

  publico <- .monitoreo_public_dashboard(dashboard, include_reports = TRUE)
  expect_length(publico$territorial_reports$response_audit, 5000L)
  expect_identical(publico$territorial_reports$response_audit_total_rows, n)
  expect_true(publico$territorial_reports$response_audit_truncated)
  expect_length(publico$territorial_reports$map$points, 5000L)
  expect_identical(publico$territorial_reports$map$points_total_rows, n)
  expect_true(publico$territorial_reports$map$points_truncated)

  # El dashboard fuente (el que persiste en el snapshot y alimenta los
  # entregables) conserva TODAS las filas: el cap vive solo en la frontera.
  expect_length(dashboard$territorial_reports$response_audit, n)
  expect_null(dashboard$territorial_reports$response_audit_truncated)
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
