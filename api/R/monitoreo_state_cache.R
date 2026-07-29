# monitoreo_state_cache.R — Unidad 3.1 (Plan de perf 2026-07): un GET de
# /api/monitoreo/state con cache hit deja de pagar recomputación.
#
# Antes de este archivo, CADA state payload —incluido el polling de la UI—
# ejecutaba .monitoreo_apply_source_metadata_to_data (copia y anota la base
# completa) y monitoreo_normalize_config (re-localiza columnas por contenido)
# ANTES de siquiera mirar el token del dashboard. Con varios scopes en poll
# eran 100–500 ms por request quemados en el hilo único aunque nada cambió.
#
# La pieza central es un token BARATO de derivación que se evalúa antes de
# tocar la base. Equivalencia (por qué el token barato alcanza):
#
#   data_anotada    = f(data_cruda, sources)             — determinista
#   cfg_normalizado = g(cfg_crudo, data_anotada)         — determinista
#   display_data    = h(data_anotada, cfg_normalizado)   — determinista
#
# de modo que los cuatro derivados quedan determinados por la tripleta
# (data_cruda, sources, cfg_crudo). La data cruda entra al token por su
# fingerprint (dims + nombres + synced_at, ver monitoreo_data_fingerprint)
# bajo el MISMO supuesto de frescura ya documentado en monitoreo_perf.R: el
# contenido del snapshot solo muta por rutas que actualizan synced_at o que
# invalidan explícitamente vía .monitoreo_invalidate_dashboard_caches (cuya
# cascada, monitoreo_perf_variables_cache_invalidate, también limpia esta
# caché). sources y cfg_crudo entran por su JSON completo: son listas chicas
# y el token del dashboard ya serializa el config normalizado en cada
# request, así que esto no agrega una clase de costo nueva.
#
# Nota sobre la serialización JSON del payload (punto 3 del contrato de la
# unidad): NO se cachea aquí, deliberadamente. El payload de state embebe
# piezas volátiles que no viajan en este token (últimos eventos de
# publicación, historial territorial, snapshot de ocurrencias, coherencia de
# fase) y el serializer es global del router (serializer_unboxed_json en
# plumber_app.R); devolver un string pre-serializado exigiría un serializer
# condicional por endpoint y sumar todas esas señales a la key. El grueso
# del ahorro está en no recomputar los derivados de la base, que es lo que
# resuelve esta caché.

# Una entrada por sid (memoria acotada: se sobreescribe en cada cambio de
# key). Las columnas no anotadas del data.frame cacheado comparten memoria
# con snapshot$data (copy-on-write por columna), así que el costo residente
# real es solo las columnas de metadata.
.monitoreo_state_derived_cache <- new.env(parent = emptyenv())

# Contadores hit/miss: instrumentación para tests y para poder medir el
# ahorro real en sesión viva (viajan al log de timings del state).
.monitoreo_state_derived_stats <- new.env(parent = emptyenv())

.monitoreo_state_derived_note <- function(field) {
  actual <- get0(field, envir = .monitoreo_state_derived_stats, ifnotfound = 0L)
  assign(field, actual + 1L, envir = .monitoreo_state_derived_stats)
  invisible(NULL)
}

monitoreo_state_derived_stats <- function() {
  list(
    hits = get0("hits", envir = .monitoreo_state_derived_stats, ifnotfound = 0L),
    misses = get0("misses", envir = .monitoreo_state_derived_stats, ifnotfound = 0L)
  )
}

monitoreo_state_derived_reset_stats <- function() {
  assign("hits", 0L, envir = .monitoreo_state_derived_stats)
  assign("misses", 0L, envir = .monitoreo_state_derived_stats)
  invisible(NULL)
}

# Token de derivación. Devuelve "" (no cacheable) si algún insumo no se pudo
# serializar: un "" silencioso en cfg_json haría colisionar configs distintos.
monitoreo_state_derived_key <- function(s, sources) {
  snapshot <- s$monitoreo_snapshot %||% NULL
  raw_data <- if (is.list(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  synced_at <- .monitoreo_scalar(if (is.list(snapshot)) snapshot$synced_at %||% "" else "", "")
  cfg_raw <- s$monitoreo_config %||% list()
  cfg_json <- .monitoreo_dashboard_config_json(cfg_raw)
  if (!nzchar(cfg_json) && length(cfg_raw)) return("")
  sources_json <- .monitoreo_dashboard_config_json(sources)
  if (!nzchar(sources_json) && length(sources)) return("")
  paste(
    "sdv1",
    monitoreo_data_fingerprint(raw_data, synced_at),
    sources_json,
    cfg_json,
    sep = "|"
  )
}

# Derivados del state payload: data anotada, config normalizado, familia y
# display_data (filtro territorial por fase). Con hit no se toca la base.
# `sources` llega ya normalizado desde el caller (el payload lo sirve igual).
monitoreo_state_derived <- function(sid, s, sources) {
  started_at <- Sys.time()
  sid_key <- .monitoreo_scalar(sid, "")
  key <- if (nzchar(sid_key)) monitoreo_state_derived_key(s, sources) else ""
  if (nzchar(key)) {
    hit <- .monitoreo_state_derived_cache[[sid_key]]
    if (is.list(hit) && identical(hit$key, key)) {
      .monitoreo_state_derived_note("hits")
      out <- hit$value
      out$hit <- TRUE
      out$timing_label <- sprintf("hit:%dms", .monitoreo_timing_ms(started_at))
      return(out)
    }
  }
  .monitoreo_state_derived_note("misses")
  # Camino de miss: réplica exacta del pipeline histórico del state payload.
  snapshot <- s$monitoreo_snapshot %||% NULL
  data <- if (is.list(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  data <- .monitoreo_apply_source_metadata_to_data(data, sources)
  cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
  family <- cfg$monitoreo_profile$family %||% "acreditacion"
  display_data <- if (identical(family, "territorial")) {
    .monitoreo_territorial_filter_data_for_phase(data, cfg)
  } else {
    data
  }
  value <- list(data = data, cfg = cfg, family = family, display_data = display_data)
  if (nzchar(key)) {
    assign(sid_key, list(key = key, value = value), envir = .monitoreo_state_derived_cache)
  }
  value$hit <- FALSE
  value$timing_label <- sprintf("miss:%dms", .monitoreo_timing_ms(started_at))
  value
}

monitoreo_state_derived_invalidate <- function(sid = NULL) {
  if (is.null(sid)) {
    rm(
      list = ls(envir = .monitoreo_state_derived_cache),
      envir = .monitoreo_state_derived_cache
    )
  } else {
    sid_key <- .monitoreo_scalar(sid, "")
    if (nzchar(sid_key) && !is.null(.monitoreo_state_derived_cache[[sid_key]])) {
      rm(list = sid_key, envir = .monitoreo_state_derived_cache)
    }
  }
  invisible(NULL)
}
