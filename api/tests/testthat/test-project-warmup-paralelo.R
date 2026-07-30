# =============================================================================
# Warmup paralelo (unidad 5.2) — particion, aislamiento, merge y degradacion
# =============================================================================
# Los sub-workers reales se cubren con el benchmark sobre acnur_acg; aqui se
# prueba la logica del orquestador con stubs de jobs para que la suite no
# dependa de spawns `callr` (que exigen el paquete instalado).

.pwp_stub <- function(name, value) {
  env <- environment(.project_warmup_paralelo_iniciar)
  original <- get(name, envir = env)
  was_locked <- bindingIsLocked(name, env)
  if (was_locked) unlockBinding(name, env)
  assign(name, value, envir = env)
  function() {
    if (bindingIsLocked(name, env)) unlockBinding(name, env)
    assign(name, original, envir = env)
    if (was_locked) lockBinding(name, env)
  }
}

.pwp_session_territorial <- function() {
  sid <- session_create()
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "monitoreo_config", list(
    monitoreo_profile = list(family = "territorial"),
    territorial = list(active_route_phase = "field")
  ))
  session_set(sid, "monitoreo_snapshot", list(
    config = list(
      monitoreo_profile = list(family = "territorial"),
      territorial = list(active_route_phase = "field")
    )
  ))
  sid
}

.pwp_report_entry <- function(key, phase, scope, snapshot_hash = "hash-data-v1") {
  list(
    schema = .monitoreo_territorial_report_cache_schema,
    key = key,
    phase = phase,
    source_id = "src-1",
    report_scope = scope,
    snapshot_hash = snapshot_hash,
    route_hash = "route-hash-1",
    config_hash = "config-hash-1",
    dashboard = list(kind = "territorial", marker = key),
    build_ms = 10,
    payload_size = 100L,
    created_at = "2026-07-29T12:00:00Z"
  )
}

.pwp_report_cache <- function(entries) {
  list(schema = .monitoreo_territorial_report_cache_schema, entries = entries)
}

.pwp_map_cache <- function(phases) {
  list(
    schema = .monitoreo_territorial_map_cache_schema,
    updated_at = "2026-07-29T12:00:00Z",
    phases = phases
  )
}

.pwp_map_layer <- function(marker, status = "valid") {
  list(layer = "gps_points", status = status, hash = marker, created_at = "2026-07-29T12:00:00Z")
}

.pwp_scope_orden <- c("source", "route_summary", "advance_summary", "validation_summary", "queries_summary")

.pwp_jobs_spec <- function() {
  list(
    field_pesado = list(
      id = "job-pesado", worker = "field_pesado",
      tramos = list(list(phase = "field", scopes = c("advance_summary", "validation_summary", "queries_summary"))),
      map_phases = "field"
    ),
    resto = list(
      id = "job-resto", worker = "resto",
      tramos = list(
        list(phase = "field", scopes = c("source", "route_summary")),
        list(phase = "pilot", scopes = .pwp_scope_orden)
      ),
      map_phases = "pilot"
    )
  )
}

test_that("iniciar reparte DOS workers que comparten el mismo RDS de sesion", {
  sid <- .pwp_session_territorial()
  on.exit(session_delete(sid), add = TRUE)
  session_path <- tempfile(fileext = ".rds")
  saveRDS(list(id = sid), session_path)

  submitted <- list()
  restore <- .pwp_stub("job_submit", function(sid, kind, func, args = list(), ...) {
    submitted[[length(submitted) + 1L]] <<- list(kind = kind, func = func, args = args)
    sprintf("job-%d", length(submitted))
  })
  on.exit(restore(), add = TRUE)

  handle <- .project_warmup_paralelo_iniciar(
    sid,
    session_path = session_path,
    task_ids = c("project", "monitoreo", "monitoreo_territorial")
  )

  expect_true(is.environment(handle))
  expect_length(handle$jobs, 2L)
  expect_identical(names(handle$jobs), c("field_pesado", "resto"))

  # El camino critico (gps + base compartida de campo) arranca primero.
  pesado <- submitted[[1]]$args
  expect_length(pesado$tramos, 1L)
  expect_identical(pesado$tramos[[1]]$phase, "field")
  expect_setequal(
    pesado$tramos[[1]]$scopes,
    c("advance_summary", "validation_summary", "queries_summary")
  )
  expect_identical(pesado$map_phases, "field")

  # El resto encadena field ligero + pilot completo, SIN solape con el pesado.
  resto <- submitted[[2]]$args
  expect_length(resto$tramos, 2L)
  resto_field <- resto$tramos[[1]]
  expect_identical(resto_field$phase, "field")
  expect_length(intersect(resto_field$scopes, pesado$tramos[[1]]$scopes), 0L)
  expect_setequal(
    c(resto_field$scopes, pesado$tramos[[1]]$scopes),
    .project_warmup_paralelo_scope_orden
  )
  expect_identical(resto$tramos[[2]]$phase, "pilot")
  expect_setequal(resto$tramos[[2]]$scopes, .project_warmup_paralelo_scope_orden)
  expect_identical(resto$map_phases, "pilot")

  # La sesion se serializo UNA vez: ambos workers leen el mismo RDS.
  expect_identical(pesado$session_path, session_path)
  expect_identical(resto$session_path, session_path)
  for (item in submitted) {
    expect_identical(item$func, .project_warmup_paralelo_prewarm_job)
  }
})

test_that("iniciar declina sin familia territorial, sin task o con el toggle apagado", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "monitoreo_config", list(monitoreo_profile = list(family = "acreditacion")))
  session_path <- tempfile(fileext = ".rds")
  saveRDS(list(id = sid), session_path)

  expect_null(.project_warmup_paralelo_iniciar(sid, session_path, task_ids = "monitoreo_territorial"))

  sid_terr <- .pwp_session_territorial()
  on.exit(session_delete(sid_terr), add = TRUE)
  expect_null(.project_warmup_paralelo_iniciar(sid_terr, session_path, task_ids = c("project", "monitoreo")))
  expect_null(.project_warmup_paralelo_iniciar(sid_terr, "", task_ids = "monitoreo_territorial"))

  Sys.setenv(PULSO_WARMUP_PARALELO = "0")
  on.exit(Sys.unsetenv("PULSO_WARMUP_PARALELO"), add = TRUE)
  expect_null(.project_warmup_paralelo_iniciar(sid_terr, session_path, task_ids = "monitoreo_territorial"))
})

test_that("la familia rapida resuelve alias sin normalizar y cae al camino completo si falta", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))

  session_set(sid, "monitoreo_config", list(monitoreo_profile = list(family = "telephone_monitoring")))
  expect_identical(.project_warmup_monitoreo_family_rapida(sid), "telefonico")

  session_set(sid, "monitoreo_config", list(monitoreo_profile = list(family = "territorial_fieldwork")))
  expect_identical(.project_warmup_monitoreo_family_rapida(sid), "territorial")

  session_set(sid, "monitoreo_config", list(monitoreo_profile = list(family = "accreditation_monitoring")))
  expect_identical(.project_warmup_monitoreo_family_rapida(sid), "acreditacion")

  # Sin familia declarada: mismo resultado que el camino completo.
  session_set(sid, "monitoreo_config", list())
  expect_identical(
    .project_warmup_monitoreo_family_rapida(sid),
    .project_warmup_monitoreo_family(sid)
  )
})

test_that("cosechar en paralelo deja la MISMA sesion final que el merge serial equivalente", {
  sid <- .pwp_session_territorial()
  on.exit(session_delete(sid), add = TRUE)

  entry_adv <- .pwp_report_entry("k-field-advance", "field", "advance_summary")
  entry_val <- .pwp_report_entry("k-field-validation", "field", "validation_summary")
  entry_que <- .pwp_report_entry("k-field-queries", "field", "queries_summary")
  entry_src <- .pwp_report_entry("k-field-source", "field", "source")
  entry_rou <- .pwp_report_entry("k-field-route", "field", "route_summary")
  entry_pil <- .pwp_report_entry("k-pilot-advance", "pilot", "advance_summary")

  scopes_ready <- function(scopes) {
    lapply(scopes, function(scope) list(scope = scope, status = "ready", cache_hit = FALSE))
  }
  results <- list(
    "job-pesado" = list(
      ok = TRUE,
      tramos = list(list(
        phase = "field",
        scopes = scopes_ready(c("advance_summary", "validation_summary", "queries_summary")),
        map_cache = list(schema = .monitoreo_territorial_map_cache_schema, active_route_phase = "field")
      )),
      worker_ms = 900,
      session_patch = list(
        territorial_report_cache = .pwp_report_cache(list(
          "k-field-advance" = entry_adv,
          "k-field-validation" = entry_val,
          "k-field-queries" = entry_que
        )),
        territorial_map_cache = .pwp_map_cache(list(
          field = list(gps_points = .pwp_map_layer("gps-field-fresco"))
        ))
      )
    ),
    "job-resto" = list(
      ok = TRUE,
      tramos = list(
        list(
          phase = "field",
          scopes = scopes_ready(c("source", "route_summary")),
          map_cache = list()
        ),
        list(
          phase = "pilot",
          scopes = scopes_ready(.pwp_scope_orden),
          map_cache = list(schema = .monitoreo_territorial_map_cache_schema, active_route_phase = "pilot")
        )
      ),
      worker_ms = 400,
      session_patch = list(
        territorial_report_cache = .pwp_report_cache(list(
          "k-field-source" = entry_src,
          "k-field-route" = entry_rou,
          "k-pilot-advance" = entry_pil
        )),
        # El worker del resto arrastra una copia STALE de la fase field en su
        # map cache (venia en su RDS y su propio tramo field la reconstruyo
        # parcialmente): la poda por map_phases impide que pise el gps fresco
        # del worker pesado.
        territorial_map_cache = .pwp_map_cache(list(
          pilot = list(gps_points = .pwp_map_layer("gps-pilot-fresco")),
          field = list(gps_points = .pwp_map_layer("gps-field-STALE", status = "stale"))
        ))
      )
    )
  )

  restore_poll <- .pwp_stub("job_poll", function(job_id) {
    list(
      status = "done",
      result_data = results[[job_id]],
      started_at = Sys.time() - 2,
      finished_at = Sys.time()
    )
  })
  on.exit(restore_poll(), add = TRUE)

  handle <- new.env(parent = emptyenv())
  handle$jobs <- .pwp_jobs_spec()
  handle$harvested <- FALSE

  item <- .project_warmup_paralelo_cosechar(sid, handle, remaining_ms = 60000)

  expect_identical(item$status, "ready")
  expect_true(isTRUE(item$details$parallel))
  expect_identical(names(item$details$phases), c("field", "pilot"))
  field_scopes <- vapply(item$details$phases$field$scopes, `[[`, character(1), "scope")
  expect_identical(field_scopes, .project_warmup_paralelo_scope_orden)

  s_par <- session_get(sid)
  cache_par <- s_par$monitoreo_snapshot$territorial_report_cache
  expect_setequal(
    names(cache_par$entries),
    c("k-field-advance", "k-field-validation", "k-field-queries",
      "k-field-source", "k-field-route", "k-pilot-advance")
  )
  # El gps fresco de field sobrevive a la copia stale del worker del resto.
  map_par <- s_par$monitoreo_territorial_map_cache
  expect_identical(map_par$phases$field$gps_points$hash, "gps-field-fresco")
  expect_identical(map_par$phases$pilot$gps_points$hash, "gps-pilot-fresco")

  # El patch que sube al proceso principal trae todo lo mezclado.
  expect_setequal(
    names(item$session_patch$territorial_report_cache$entries),
    names(cache_par$entries)
  )

  # Paridad con el camino serial: un unico patch con todo produce la misma
  # sesion final (mismas claves de report cache, mismos layers de mapa).
  sid_serial <- .pwp_session_territorial()
  on.exit(session_delete(sid_serial), add = TRUE)
  serial_patch <- list(
    territorial_report_cache = .pwp_report_cache(list(
      "k-field-advance" = entry_adv,
      "k-field-validation" = entry_val,
      "k-field-queries" = entry_que,
      "k-field-source" = entry_src,
      "k-field-route" = entry_rou,
      "k-pilot-advance" = entry_pil
    )),
    territorial_map_cache = .pwp_map_cache(list(
      field = list(gps_points = .pwp_map_layer("gps-field-fresco")),
      pilot = list(gps_points = .pwp_map_layer("gps-pilot-fresco"))
    ))
  )
  .project_warmup_merge_session_patch(sid_serial, list(monitoreo_territorial = serial_patch))
  s_serial <- session_get(sid_serial)
  expect_setequal(
    names(s_serial$monitoreo_snapshot$territorial_report_cache$entries),
    names(cache_par$entries)
  )
  expect_identical(
    s_serial$monitoreo_territorial_map_cache$phases$field$gps_points$hash,
    map_par$phases$field$gps_points$hash
  )
})

test_that("una entrada mergeada con hash viejo nunca se sirve si la fuente cambio", {
  sid <- .pwp_session_territorial()
  on.exit(session_delete(sid), add = TRUE)

  entry_vieja <- .pwp_report_entry("k-viejo", "field", "advance_summary", snapshot_hash = "hash-data-v1")
  .project_warmup_merge_session_patch(sid, list(monitoreo_territorial = list(
    territorial_report_cache = .pwp_report_cache(list("k-viejo" = entry_vieja))
  )))

  snapshot <- session_get(sid)$monitoreo_snapshot
  expect_true("k-viejo" %in% names(snapshot$territorial_report_cache$entries))

  # La data cambio mientras corria el worker: la llave nueva no coincide y el
  # lookup descarta la entrada (mismo campo por campo que valida el runtime).
  key_nueva <- list(
    key = "k-nuevo",
    phase = "field",
    source_id = "src-1",
    report_scope = "advance_summary",
    snapshot_hash = "hash-data-v2",
    route_hash = "route-hash-1",
    config_hash = "config-hash-1"
  )
  expect_null(.monitoreo_territorial_report_cache_lookup(snapshot, key_nueva))

  # Incluso si otra entrada colisionara en la MISMA llave con hash viejo, el
  # lookup la rechaza porque valida snapshot_hash ademas de la llave.
  key_colision <- key_nueva
  key_colision$key <- "k-viejo"
  expect_null(.monitoreo_territorial_report_cache_lookup(snapshot, key_colision))

  # Un patch con schema desconocido se descarta entero.
  before <- names(snapshot$territorial_report_cache$entries)
  .project_warmup_merge_session_patch(sid, list(monitoreo_territorial = list(
    territorial_report_cache = list(schema = "schema_desconocido_v1", entries = list(
      "k-intruso" = .pwp_report_entry("k-intruso", "field", "advance_summary")
    ))
  )))
  after <- names(session_get(sid)$monitoreo_snapshot$territorial_report_cache$entries)
  expect_identical(after, before)
})

test_that("la poda restringe cada patch a los tramos y fases de mapa del worker", {
  patch <- list(
    territorial_report_cache = .pwp_report_cache(list(
      "k-field-source" = .pwp_report_entry("k-field-source", "field", "source"),
      "k-field-advance-ajeno" = .pwp_report_entry("k-field-advance-ajeno", "field", "advance_summary"),
      "k-pilot-source" = .pwp_report_entry("k-pilot-source", "pilot", "source")
    )),
    territorial_map_cache = .pwp_map_cache(list(
      field = list(gps_points = .pwp_map_layer("gps-field")),
      pilot = list(gps_points = .pwp_map_layer("gps-pilot"))
    ))
  )
  podado <- .project_warmup_paralelo_podar_patch(
    patch,
    tramos = list(
      list(phase = "field", scopes = c("source", "route_summary")),
      list(phase = "pilot", scopes = .pwp_scope_orden)
    ),
    map_phases = "pilot"
  )
  expect_setequal(
    names(podado$territorial_report_cache$entries),
    c("k-field-source", "k-pilot-source")
  )
  expect_identical(names(podado$territorial_map_cache$phases), "pilot")

  expect_null(.project_warmup_paralelo_podar_patch(list(), list(), character(0)))
})

test_that("el presupuesto agotado cancela los workers y degrada a timeout", {
  sid <- .pwp_session_territorial()
  on.exit(session_delete(sid), add = TRUE)

  cancelled <- character(0)
  restore_poll <- .pwp_stub("job_poll", function(job_id) {
    list(status = "running", started_at = Sys.time())
  })
  restore_cancel <- .pwp_stub("job_cancel", function(job_id) {
    cancelled <<- c(cancelled, job_id)
    TRUE
  })
  on.exit({
    restore_poll()
    restore_cancel()
  }, add = TRUE)

  handle <- new.env(parent = emptyenv())
  handle$jobs <- .pwp_jobs_spec()
  handle$harvested <- FALSE

  item <- .project_warmup_paralelo_cosechar(sid, handle, remaining_ms = 1700)

  expect_identical(item$status, "timeout")
  expect_setequal(cancelled, c("job-pesado", "job-resto"))
  statuses <- unlist(lapply(item$details$phases, function(phase) {
    vapply(phase$scopes, `[[`, character(1), "status")
  }), use.names = FALSE)
  expect_true(all(statuses == "timeout"))
  expect_true(isTRUE(handle$harvested))
})

test_that("abandonar cancela workers sin cosechar y es idempotente", {
  cancelled <- character(0)
  restore_cancel <- .pwp_stub("job_cancel", function(job_id) {
    cancelled <<- c(cancelled, job_id)
    TRUE
  })
  on.exit(restore_cancel(), add = TRUE)

  handle <- new.env(parent = emptyenv())
  handle$jobs <- list(a = list(id = "job-x"), b = list(id = "job-y"))
  handle$harvested <- FALSE

  expect_true(.project_warmup_paralelo_abandonar(handle))
  expect_setequal(cancelled, c("job-x", "job-y"))
  expect_false(.project_warmup_paralelo_abandonar(handle))
  expect_length(cancelled, 2L)

  expect_false(.project_warmup_paralelo_abandonar(NULL))
})
