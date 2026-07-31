# Cache territorial del router: mapa, rutas, GPS, reportes y prewarm.
#
# Por qué existe este archivo. `router_monitoreo.R` está congelado a
# crecimiento (`agentic/manifest.json`), y aun así creció 104 líneas sobre su
# línea base durante la tanda de pulido de julio. La causa no fue un cambio
# grande sino la falta de un hogar: cada arreglo de caché territorial se
# escribía donde ya vivían sus vecinos, en el router, porque no había otro
# sitio. Esas 1.030 líneas eran el bloque contiguo más grande del archivo y un
# solo tema, así que se mudan enteras.
#
# Qué vive aquí: las cuatro capas de caché que necesita el mapa territorial,
# de la más barata a la más cara.
#
#   1. Caché de mapa por fase (`_map_cache_*`): geometría de ruta y puntos GPS,
#      guardados por `pilot`/`field` dentro de la sesión y del `.pulso`.
#   2. Hashes de invalidación (`_route_hash`, `_gps_hash`, `_hashable_df`): lo
#      que decide si una capa sigue siendo válida. Se calculan sobre las
#      columnas que de verdad mueven el mapa, no sobre el data.frame entero.
#   3. Caché de reportes por scope (`_report_cache_*`): el patrón que
#      `monitoreo_acreditacion_cache.R` replicó después para su familia.
#   4. Prewarm y preparación en job (`_prewarm_*`, `_map_prepare_*`): el
#      trabajo que se adelanta a subproceso para que abrir el módulo no
#      congele la interfaz.
#
# Qué NO vive aquí, y por qué:
#
#   - `.monitoreo_cache_digest()` se queda en el router: lo comparte
#     `monitoreo_acreditacion_cache.R` y no es territorial. Mudarlo es una
#     decisión sobre dónde viven los helpers de caché compartidos, no parte de
#     esta extracción.
#   - `.monitoreo_territorial_context()` se queda en el router: construye el
#     contexto desde las hojas de ruta y solo consulta este caché. La frontera
#     es esa —quien guarda y quien invalida está aquí; quien arma el payload,
#     no—.
#
# La extracción es un movimiento literal: las funciones se mudaron sin cambiar
# una línea de su cuerpo. El paquete no declara `Collate`, así que la colación
# es alfabética y estas definiciones quedan disponibles igual que antes.

.monitoreo_territorial_map_cache_schema <- "monitoreo_territorial_map_cache_v1"
.monitoreo_territorial_gps_points_schema <- "gps_points_declared_ump_v6_effective_gps_cross_status"
.monitoreo_territorial_map_cache_layers <- c("route_geometry", "gps_points")

.monitoreo_territorial_map_cache_empty <- function() {
  list(
    schema = .monitoreo_territorial_map_cache_schema,
    updated_at = "",
    phases = list(pilot = list(), field = list())
  )
}

.monitoreo_territorial_map_cache_get <- function(sid) {
  cache <- session_get(sid)$monitoreo_territorial_map_cache %||% list()
  if (!is.list(cache) || !identical(.monitoreo_scalar(cache$schema, ""), .monitoreo_territorial_map_cache_schema)) {
    cache <- .monitoreo_territorial_map_cache_empty()
  }
  if (is.null(cache$phases) || !is.list(cache$phases)) cache$phases <- list()
  for (phase in c("pilot", "field")) {
    if (is.null(cache$phases[[phase]]) || !is.list(cache$phases[[phase]])) {
      cache$phases[[phase]] <- list()
    }
  }
  cache
}

.monitoreo_territorial_map_cache_set_layer <- function(sid, phase, layer, value) {
  phase <- .monitoreo_territorial_phase(phase, "pilot")
  if (!layer %in% .monitoreo_territorial_map_cache_layers) return(invisible(NULL))
  cache <- .monitoreo_territorial_map_cache_get(sid)
  cache$phases[[phase]][[layer]] <- value
  cache$updated_at <- .monitoreo_now_iso()
  session_set(sid, "monitoreo_territorial_map_cache", cache)
  invisible(cache)
}

.monitoreo_territorial_invalidate_map_cache <- function(sid, phase = NULL, layers = .monitoreo_territorial_map_cache_layers, reason = "") {
  layers <- intersect(.monitoreo_chr_vec(layers), .monitoreo_territorial_map_cache_layers)
  if (!length(layers)) return(invisible(NULL))
  phases <- if (is.null(phase)) c("pilot", "field") else .monitoreo_territorial_phase(phase, "pilot")
  cache <- .monitoreo_territorial_map_cache_get(sid)
  changed <- FALSE
  for (ph in phases) {
    for (layer in layers) {
      entry <- cache$phases[[ph]][[layer]] %||% NULL
      if (!is.list(entry)) next
      entry$status <- "stale"
      entry$invalidated_at <- .monitoreo_now_iso()
      entry$invalidated_reason <- .monitoreo_scalar(reason, "invalidated")
      cache$phases[[ph]][[layer]] <- entry
      changed <- TRUE
    }
  }
  if (isTRUE(changed)) {
    cache$updated_at <- .monitoreo_now_iso()
    session_set(sid, "monitoreo_territorial_map_cache", cache)
  }
  invisible(cache)
}

.monitoreo_territorial_route_blocks_for_cache <- function(context) {
  blocks <- tryCatch(.monitoreo_territorial_block_goal_df(context, include_replacements = TRUE), error = function(e) data.frame())
  if (is.null(blocks) || !is.data.frame(blocks)) blocks <- data.frame()
  blocks
}

.monitoreo_territorial_hashable_df <- function(df, cols = NULL) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(data.frame())
  if (is.null(cols)) cols <- names(df)
  cols <- intersect(cols, names(df))
  if (!length(cols)) return(data.frame())
  out <- df[, cols, drop = FALSE]
  for (nm in names(out)) {
    if (is.factor(out[[nm]])) out[[nm]] <- as.character(out[[nm]])
  }
  sort_cols <- intersect(c("ubigeo", "zona", "manzana", "id_manzana", "tipo_manzana", "ump"), names(out))
  if (length(sort_cols)) {
    ord <- do.call(order, c(out[sort_cols], list(na.last = TRUE)))
    out <- out[ord, , drop = FALSE]
  }
  rownames(out) <- NULL
  out
}

.monitoreo_territorial_route_hash <- function(context, phase = NULL) {
  blocks <- .monitoreo_territorial_route_blocks_for_cache(context)
  cols <- c(
    "id_manzana", "ubigeo", "distrito", "zona", "manzana", "entrevistas",
    "tipo_manzana", "titular_id_manzana", "replacement_order",
    "hoja_num", "rango_inicio", "rango_fin", "territorio_muestral", "ump"
  )
  .monitoreo_cache_digest(list(
    schema = .monitoreo_territorial_map_cache_schema,
    layer = "route_geometry",
    phase = .monitoreo_territorial_phase(phase %||% context$phase, "pilot"),
    total_entrevistas = as.integer(context$total_entrevistas %||% 0L),
    total_replacement_interviews = as.integer(context$total_replacement_interviews %||% 0L),
    run_locked = isTRUE(context$run_locked),
    blocks = .monitoreo_territorial_hashable_df(blocks, cols)
  ))
}

.monitoreo_territorial_gps_hash <- function(data, cfg, context, route_hash, phase = NULL) {
  if (is.null(data) || !is.data.frame(data)) data <- data.frame()
  cfg <- monitoreo_normalize_config(cfg %||% list(), data)
  tcfg <- cfg$territorial %||% monitoreo_territorial_default_config(data)
  phase <- .monitoreo_territorial_phase(phase %||% context$phase %||% tcfg$active_route_phase, "pilot")
  phase_source <- .monitoreo_territorial_phase_source(tcfg, phase)
  mapping <- tcfg[intersect(c(
    "district_var", "ump_var", "pulso_code_var", "gps_var", "consent_var",
    "age_var", "sex_var", "status_var", "id_var", "submitted_by_var",
    "submission_time_var", "start_var", "end_var", "duration_var",
    "platform_effective_var", "platform_effective_values", "variable_refs",
    "valid_statuses", "district_crosswalk", "geo_thresholds_m",
    "validation_decisions", "enumerator_roster", "enumerator_code_reconciliation",
    "ump_reconciliation", "production_annulments"
  ), names(tcfg))]
  .monitoreo_cache_digest(list(
    schema = .monitoreo_territorial_map_cache_schema,
    layer = "gps_points",
    point_schema = .monitoreo_territorial_gps_points_schema,
    phase = phase,
    source_id = .monitoreo_scalar(phase_source$source_id, ""),
    asset_uid = .monitoreo_scalar(phase_source$asset_uid, ""),
    version_id = .monitoreo_scalar(phase_source$kobo_version_id, ""),
    route_hash = .monitoreo_scalar(route_hash, ""),
    data_hash = monitoreo_snapshot_hash(data),
    mapping = mapping
  ))
}

.monitoreo_territorial_bounds_from_points <- function(lat, lon) {
  lat <- suppressWarnings(as.numeric(lat))
  lon <- suppressWarnings(as.numeric(lon))
  ok <- is.finite(lat) & is.finite(lon)
  if (!any(ok)) return(list())
  list(
    min_lat = round(min(lat[ok], na.rm = TRUE), 7),
    min_lon = round(min(lon[ok], na.rm = TRUE), 7),
    max_lat = round(max(lat[ok], na.rm = TRUE), 7),
    max_lon = round(max(lon[ok], na.rm = TRUE), 7)
  )
}

.monitoreo_territorial_route_entry <- function(context, route_hash, phase = NULL) {
  phase <- .monitoreo_territorial_phase(phase %||% context$phase, "pilot")
  blocks <- .monitoreo_territorial_route_blocks_for_cache(context)
  titular <- if (nrow(blocks) && "tipo_manzana" %in% names(blocks)) {
    sum(as.character(blocks$tipo_manzana %||% "") != "reemplazo", na.rm = TRUE)
  } else {
    nrow(blocks)
  }
  replacements <- max(0L, nrow(blocks) - titular)
  ump_cols <- intersect(c("id_manzana", "ubigeo", "distrito", "zona", "manzana", "tipo_manzana", "ump", "titular_id_manzana"), names(blocks))
  ump_index <- if (length(ump_cols)) .monitoreo_territorial_df_rows(blocks[, ump_cols, drop = FALSE]) else list()
  list(
    layer = "route_geometry",
    status = "valid",
    hash = .monitoreo_scalar(route_hash, ""),
    created_at = .monitoreo_now_iso(),
    phase = phase,
    bounds = list(),
    counts = list(
      blocks = as.integer(nrow(blocks)),
      titular = as.integer(titular),
      replacements = as.integer(replacements)
    ),
    ubigeos = as.list(sort(unique(as.character(blocks$ubigeo %||% character(0))))),
    blocks = .monitoreo_territorial_df_rows(blocks),
    features = list(),
    ump_index = ump_index,
    source_versions = list(
      phases_available = as.list(context$phases_available %||% list()),
      run_locked = isTRUE(context$run_locked)
    )
  )
}

.monitoreo_territorial_response_ubigeo <- function(data, tcfg) {
  if (is.null(data) || !is.data.frame(data) || !nrow(data)) return(character(0))
  crosswalk <- .monitoreo_territorial_crosswalk_df(tcfg$district_crosswalk)
  district_raw <- .monitoreo_territorial_source_value(data, tcfg$district_var)
  district_key <- vapply(district_raw, .monitoreo_safe_name, character(1))
  cw_idx <- match(district_key, crosswalk$kobo_key)
  ifelse(!is.na(cw_idx), crosswalk$ubigeo[cw_idx], "")
}

.monitoreo_territorial_gps_entry <- function(data, cfg, context, route_hash, gps_hash, phase = NULL) {
  if (is.null(data) || !is.data.frame(data)) data <- data.frame()
  cfg <- monitoreo_normalize_config(cfg %||% list(), data)
  tcfg <- cfg$territorial %||% monitoreo_territorial_default_config(data)
  phase <- .monitoreo_territorial_phase(phase %||% context$phase %||% tcfg$active_route_phase, "pilot")
  phase_source <- .monitoreo_territorial_phase_source(tcfg, phase)
  n <- nrow(data)
  crosswalk <- .monitoreo_territorial_crosswalk_df(tcfg$district_crosswalk)
  district_raw <- .monitoreo_territorial_source_value(data, tcfg$district_var)
  district_key <- vapply(district_raw, .monitoreo_safe_name, character(1))
  cw_idx <- match(district_key, crosswalk$kobo_key)
  ubigeo <- ifelse(!is.na(cw_idx), crosswalk$ubigeo[cw_idx], "")
  distrito <- ifelse(!is.na(cw_idx), crosswalk$distrito[cw_idx], "")
  geo <- .monitoreo_territorial_geo_status(data, tcfg, ubigeo, context)
  response_identity <- .monitoreo_territorial_response_identity(data, tcfg)
  geo$response_id <- response_identity$id %||% rep("", nrow(geo))
  geo$ubigeo <- ubigeo
  geo$distrito <- distrito
  submitted_by <- .monitoreo_territorial_source_value(data, tcfg$submitted_by_var, "Sin encuestador asignado")
  submitted_by[is.na(submitted_by) | !nzchar(trimws(submitted_by))] <- "Sin encuestador asignado"
  geo$submitted_by <- submitted_by
  consent_raw <- .monitoreo_territorial_source_value(data, tcfg$consent_var)
  consent_key <- vapply(consent_raw, .monitoreo_safe_name, character(1))
  consent_yes <- consent_key %in% c("1", "si", "sí", "yes", "true", "acepta", "acepto", "accepted")
  geo$age <- suppressWarnings(as.numeric(.monitoreo_territorial_source_value(data, tcfg$age_var)))
  geo$sex <- .monitoreo_territorial_source_value(data, tcfg$sex_var)
  effective_mask <- .monitoreo_territorial_effective_mask(data, tcfg, consent_yes)
  geo$advance_valid <- effective_mask %in% TRUE
  geo$validation_status <- ifelse(geo$advance_valid, "validada", "no_defendible")
  geo$observation_status <- ifelse(geo$advance_valid & geo$geo_estado %in% c("geo_revision", "geo_no_defendible", "geo_sin_cruce", "geo_sin_gps"), "en_observacion", ifelse(geo$advance_valid, "sin_observacion", "no_valida"))
  submission_time_pick <- .monitoreo_territorial_submission_time_values(data, tcfg)
  submission_time <- submission_time_pick$values
  date_values <- .monitoreo_parse_time_vec(submission_time)
  geo$submission_time_source <- rep(.monitoreo_scalar(submission_time_pick$source, ""), n)
  geo$submission_date_iso <- .monitoreo_date_iso_vec(date_values, submission_time)
  geo$submission_date <- .monitoreo_format_date_label_vec(date_values, submission_time)
  geo$submission_hour <- .monitoreo_format_time_label_vec(date_values, submission_time)
  geo$submission_datetime <- .monitoreo_format_datetime_label_vec(date_values, submission_time)
  ump_raw <- .monitoreo_territorial_source_value(data, tcfg$ump_var, "", ref = tcfg$variable_refs$ump %||% NULL)
  declared_ump_match <- .monitoreo_territorial_declared_ump_matches(
    ump_raw,
    .monitoreo_territorial_block_goal_df(context, include_replacements = TRUE),
    ubigeo = geo$ubigeo,
    distrito = geo$distrito,
    reconciliations = tcfg$ump_reconciliation %||% list(),
    phase = phase,
    response_id = response_identity$id,
    response_id_field = response_identity$field
  )
  for (col in names(declared_ump_match)) {
    if (length(declared_ump_match[[col]]) == n) geo[[col]] <- declared_ump_match[[col]]
  }
  point_cols <- intersect(c(
    "response_id", "submitted_by", "submission_time_source", "submission_date_iso",
    "submission_date", "submission_hour", "submission_datetime", "ubigeo", "distrito",
    "age", "sex",
    "lat", "lon", "gps_parseable", "geo_estado", "distance_m",
    "nearest_block_id", "nearest_block_type", "geometry_match",
    "gps_primary_source", "gps_primary_lat", "gps_primary_lon", "gps_primary_altitude",
    "gps_primary_accuracy_m", "gps_primary_parseable", "gps_primary_estado",
    "gps_primary_distance_m", "gps_primary_nearest_block_id", "gps_primary_nearest_block_type",
    "gps_primary_geometry_match", "gps_effective_source", "gps_effective_lat",
    "gps_effective_lon", "gps_effective_altitude", "gps_effective_accuracy_m",
    "gps_effective_estado", "gps_effective_distance_m", "gps_effective_nearest_block_id",
    "gps_effective_nearest_block_type", "gps_effective_geometry_match", "gps_reclassified",
    "gps_reclassification_note",
    "declared_ump_raw", "declared_ump_normalized", "advance_block_id",
    "advance_block_ump", "advance_block_ubigeo", "advance_block_distrito",
    "advance_block_zona", "advance_block_manzana", "advance_block_type",
    "advance_block_match", "advance_block_match_status", "advance_block_match_source", "advance_block_reconciliation_scope", "advance_valid",
    "observation_status", "validation_status"
  ), names(geo))
  list(
    layer = "gps_points",
    point_schema = .monitoreo_territorial_gps_points_schema,
    status = "valid",
    hash = .monitoreo_scalar(gps_hash, ""),
    route_hash = .monitoreo_scalar(route_hash, ""),
    created_at = .monitoreo_now_iso(),
    phase = phase,
    source_id = .monitoreo_scalar(phase_source$source_id, ""),
    asset_uid = .monitoreo_scalar(phase_source$asset_uid, ""),
    version_id = .monitoreo_scalar(phase_source$kobo_version_id, ""),
    bounds = .monitoreo_territorial_bounds_from_points(geo$lat, geo$lon),
    counts = list(
      points = as.integer(nrow(geo)),
      gps_parseable = as.integer(sum(geo$gps_parseable %in% TRUE, na.rm = TRUE)),
      geo_ok = as.integer(sum(geo$geo_estado == "geo_ok", na.rm = TRUE)),
      geo_revision = as.integer(sum(geo$geo_estado %in% c("geo_cerca", "geo_revision"), na.rm = TRUE)),
      geo_no_defendible = as.integer(sum(geo$geo_estado == "geo_no_defendible", na.rm = TRUE))
    ),
    points = if (length(point_cols)) .monitoreo_territorial_df_rows(geo[, point_cols, drop = FALSE]) else list(),
    geo_results = geo
  )
}

.monitoreo_territorial_layer_meta <- function(entry, expected_hash = "", route_hash = "") {
  if (!is.list(entry)) {
    return(list(status = "missing", hash = "", expected_hash = .monitoreo_scalar(expected_hash, ""), created_at = "", stale = FALSE, usable = FALSE))
  }
  hash <- .monitoreo_scalar(entry$hash, "")
  valid <- nzchar(hash) && nzchar(.monitoreo_scalar(expected_hash, "")) && identical(hash, .monitoreo_scalar(expected_hash, ""))
  expected_point_schema <- ""
  if (identical(.monitoreo_scalar(entry$layer, ""), "gps_points") && nzchar(.monitoreo_scalar(route_hash, ""))) {
    valid <- valid && identical(.monitoreo_scalar(entry$route_hash, ""), .monitoreo_scalar(route_hash, ""))
    expected_point_schema <- .monitoreo_territorial_gps_points_schema
    valid <- valid && identical(.monitoreo_scalar(entry$point_schema, ""), expected_point_schema)
  }
  status <- if (isTRUE(valid) && !identical(.monitoreo_scalar(entry$status, ""), "stale")) "valid" else "stale"
  list(
    layer = .monitoreo_scalar(entry$layer, ""),
    status = status,
    hash = hash,
    expected_hash = .monitoreo_scalar(expected_hash, ""),
    route_hash = .monitoreo_scalar(entry$route_hash, ""),
    expected_route_hash = .monitoreo_scalar(route_hash, ""),
    point_schema = .monitoreo_scalar(entry$point_schema, ""),
    expected_point_schema = expected_point_schema,
    created_at = .monitoreo_scalar(entry$created_at, ""),
    invalidated_at = .monitoreo_scalar(entry$invalidated_at, ""),
    invalidated_reason = .monitoreo_scalar(entry$invalidated_reason, ""),
    stale = !isTRUE(valid),
    usable = TRUE,
    bounds = entry$bounds %||% list(),
    counts = entry$counts %||% list()
  )
}

.monitoreo_territorial_cached_geo_results <- function(data, tcfg, entry, expected_hash = "", route_hash = "", allow_stale = FALSE) {
  meta <- .monitoreo_territorial_layer_meta(entry, expected_hash, route_hash)
  if (identical(meta$status, "missing")) return(NULL)
  if (!identical(meta$status, "valid") && !isTRUE(allow_stale)) return(NULL)
  geo <- entry$geo_results %||% NULL
  if (!is.data.frame(geo)) return(NULL)
  if (is.null(data) || !is.data.frame(data)) data <- data.frame()
  if (!nrow(data) && !nrow(geo)) return(geo)
  ids <- .monitoreo_territorial_response_identity(data, tcfg)$id %||% character(0)
  if ("response_id" %in% names(geo) && length(ids) == nrow(data)) {
    idx <- match(ids, as.character(geo$response_id %||% ""))
    if (any(is.na(idx))) return(NULL)
    geo <- geo[idx, , drop = FALSE]
    rownames(geo) <- NULL
    return(geo)
  }
  if (nrow(geo) == nrow(data)) return(geo)
  NULL
}

.monitoreo_territorial_map_cache_meta <- function(sid, cfg, data = NULL) {
  if (is.null(data) || !is.data.frame(data)) data <- data.frame()
  cfg <- monitoreo_normalize_config(cfg %||% list(), data)
  cache <- .monitoreo_territorial_map_cache_get(sid)
  phases <- setNames(lapply(c("pilot", "field"), function(phase) {
    phase_data <- .monitoreo_territorial_filter_data_for_phase(data, cfg, phase = phase)
    context <- .monitoreo_territorial_context(sid, cfg, phase = phase)
    route_hash <- .monitoreo_territorial_route_hash(context, phase = phase)
    gps_hash <- .monitoreo_territorial_gps_hash(phase_data, cfg, context, route_hash, phase = phase)
    phase_cache <- cache$phases[[phase]] %||% list()
    route_meta <- .monitoreo_territorial_layer_meta(phase_cache$route_geometry %||% NULL, route_hash)
    gps_meta <- .monitoreo_territorial_layer_meta(phase_cache$gps_points %||% NULL, gps_hash, route_hash)
    list(
      phase = phase,
      route_geometry = route_meta,
      gps_points = gps_meta
    )
  }), c("pilot", "field"))
  active_phase <- .monitoreo_territorial_phase(cfg$territorial$active_route_phase, "pilot")
  list(
    schema = .monitoreo_territorial_map_cache_schema,
    generated_at = .monitoreo_now_iso(),
    active_route_phase = active_phase,
    phases = phases,
    active = phases[[active_phase]]
  )
}

.monitoreo_territorial_prepare_map_cache <- function(sid,
                                                     cfg,
                                                     data = NULL,
                                                     phase = NULL,
                                                     layers = .monitoreo_territorial_map_cache_layers,
                                                     force = FALSE) {
  if (is.null(data) || !is.data.frame(data)) data <- data.frame()
  cfg <- monitoreo_normalize_config(cfg %||% list(), data)
  phase <- .monitoreo_territorial_phase(phase %||% cfg$territorial$active_route_phase, "pilot")
  layers <- intersect(.monitoreo_chr_vec(layers), .monitoreo_territorial_map_cache_layers)
  if (!length(layers)) layers <- .monitoreo_territorial_map_cache_layers
  phase_data <- .monitoreo_territorial_filter_data_for_phase(data, cfg, phase = phase)
  context <- .monitoreo_territorial_context(sid, cfg, phase = phase)
  route_hash <- .monitoreo_territorial_route_hash(context, phase = phase)
  cache <- .monitoreo_territorial_map_cache_get(sid)
  phase_cache <- cache$phases[[phase]] %||% list()
  route_entry <- phase_cache$route_geometry %||% NULL
  route_meta <- .monitoreo_territorial_layer_meta(route_entry, route_hash)
  if ((("route_geometry" %in% layers) || ("gps_points" %in% layers)) &&
      (isTRUE(force) || !identical(route_meta$status, "valid"))) {
    route_entry <- .monitoreo_territorial_route_entry(context, route_hash, phase = phase)
    .monitoreo_territorial_map_cache_set_layer(sid, phase, "route_geometry", route_entry)
    cache <- .monitoreo_territorial_map_cache_get(sid)
    phase_cache <- cache$phases[[phase]] %||% list()
  }
  gps_hash <- .monitoreo_territorial_gps_hash(phase_data, cfg, context, route_hash, phase = phase)
  gps_entry <- phase_cache$gps_points %||% NULL
  gps_meta <- .monitoreo_territorial_layer_meta(gps_entry, gps_hash, route_hash)
  if ("gps_points" %in% layers && (isTRUE(force) || !identical(gps_meta$status, "valid"))) {
    gps_entry <- .monitoreo_territorial_gps_entry(phase_data, cfg, context, route_hash, gps_hash, phase = phase)
    .monitoreo_territorial_map_cache_set_layer(sid, phase, "gps_points", gps_entry)
  }
  .monitoreo_territorial_map_cache_meta(sid, cfg, data)
}

.monitoreo_territorial_context_with_map_cache <- function(sid,
                                                         cfg,
                                                         data = NULL,
                                                         phase = NULL,
                                                         report_scope = "full",
                                                         allow_stale = TRUE,
                                                         prepare_missing = TRUE) {
  if (is.null(data) || !is.data.frame(data)) data <- data.frame()
  cfg <- monitoreo_normalize_config(cfg %||% list(), data)
  phase <- .monitoreo_territorial_phase(phase %||% cfg$territorial$active_route_phase, "pilot")
  context <- .monitoreo_territorial_context(sid, cfg, phase = phase)
  route_hash <- .monitoreo_territorial_route_hash(context, phase = phase)
  cache <- .monitoreo_territorial_map_cache_get(sid)
  phase_cache <- cache$phases[[phase]] %||% list()
  route_entry <- phase_cache$route_geometry %||% NULL
  route_meta <- .monitoreo_territorial_layer_meta(route_entry, route_hash)
  if (isTRUE(prepare_missing) && !identical(route_meta$status, "valid")) {
    route_entry <- .monitoreo_territorial_route_entry(context, route_hash, phase = phase)
    .monitoreo_territorial_map_cache_set_layer(sid, phase, "route_geometry", route_entry)
    route_meta <- .monitoreo_territorial_layer_meta(route_entry, route_hash)
  }
  gps_hash <- .monitoreo_territorial_gps_hash(data, cfg, context, route_hash, phase = phase)
  gps_entry <- phase_cache$gps_points %||% NULL
  gps_meta <- .monitoreo_territorial_layer_meta(gps_entry, gps_hash, route_hash)
  needs_gps <- .monitoreo_report_scope(report_scope) %in% c("validation_summary", "queries_summary", "full")
  if (isTRUE(needs_gps)) {
    cached_geo <- .monitoreo_territorial_cached_geo_results(
      data,
      cfg$territorial %||% monitoreo_territorial_default_config(data),
      gps_entry,
      expected_hash = gps_hash,
      route_hash = route_hash,
      allow_stale = allow_stale
    )
    if (is.data.frame(cached_geo)) {
      context$geo_results <- cached_geo
    } else if (isTRUE(prepare_missing)) {
      gps_entry <- .monitoreo_territorial_gps_entry(data, cfg, context, route_hash, gps_hash, phase = phase)
      .monitoreo_territorial_map_cache_set_layer(sid, phase, "gps_points", gps_entry)
      gps_meta <- .monitoreo_territorial_layer_meta(gps_entry, gps_hash, route_hash)
      context$geo_results <- gps_entry$geo_results
    }
  }
  context$map_cache <- list(
    phase = phase,
    route_geometry = route_meta,
    gps_points = gps_meta
  )
  context
}

# v27: la llave pasó de sha256(data) a monitoreo_data_fingerprint().
.monitoreo_territorial_report_cache_schema <- "monitoreo_territorial_report_cache_v27"
.monitoreo_territorial_report_cache_limit <- 18L

.monitoreo_territorial_report_cache_key_info <- function(sid, snapshot, data, cfg, report_scope = "full") {
  phase <- .monitoreo_territorial_phase(cfg$territorial$active_route_phase %||% "pilot", "pilot")
  scope <- .monitoreo_report_scope(report_scope)
  phase_data <- .monitoreo_territorial_filter_data_for_phase(data, cfg, phase = phase)
  source <- .monitoreo_territorial_phase_source(cfg$territorial, phase)
  source_id <- .monitoreo_scalar(source$source_id, "")
  route_hash <- ""
  if (!scope %in% c("light", "source")) {
    context <- .monitoreo_territorial_context(sid, cfg, phase = phase)
    route_hash <- .monitoreo_territorial_route_hash(context, phase = phase)
  }
  # Fingerprint barato de la data por fase (ver monitoreo_perf.R).
  snapshot_hash <- monitoreo_data_fingerprint(phase_data, snapshot$synced_at %||% "")
  config_hash <- .monitoreo_cache_digest(list(
    profile = cfg$monitoreo_profile %||% list(),
    territorial = cfg$territorial %||% list(),
    objetivo_total = cfg$objetivo_total %||% NULL
  ))
  key <- .monitoreo_cache_digest(list(
    schema = .monitoreo_territorial_report_cache_schema,
    phase = phase,
    source_id = source_id,
    report_scope = scope,
    snapshot_hash = snapshot_hash,
    route_hash = route_hash,
    config_hash = config_hash
  ))
  list(
    key = key,
    phase = phase,
    source_id = source_id,
    report_scope = scope,
    snapshot_hash = snapshot_hash,
    route_hash = route_hash,
    config_hash = config_hash
  )
}

.monitoreo_territorial_report_cache_get <- function(snapshot) {
  cache <- snapshot$territorial_report_cache
  if (!is.list(cache) || !identical(.monitoreo_scalar(cache$schema, ""), .monitoreo_territorial_report_cache_schema)) {
    cache <- list(schema = .monitoreo_territorial_report_cache_schema, entries = list())
  }
  if (!is.list(cache$entries)) cache$entries <- list()
  cache
}

.monitoreo_territorial_report_payload_size <- function(dashboard) {
  size <- tryCatch({
    public <- .monitoreo_public_dashboard(dashboard, include_reports = TRUE)
    nchar(jsonlite::toJSON(public, auto_unbox = TRUE, null = "null", dataframe = "rows"), type = "bytes")
  }, error = function(e) NA_integer_)
  as.integer(size %||% NA_integer_)
}

.monitoreo_territorial_report_cache_lookup <- function(snapshot, key_info) {
  if (!is.list(snapshot) || !is.list(key_info) || !nzchar(.monitoreo_scalar(key_info$key, ""))) {
    return(NULL)
  }
  cache <- .monitoreo_territorial_report_cache_get(snapshot)
  entry <- cache$entries[[key_info$key]]
  if (!is.list(entry) || !identical(entry$key, key_info$key) || !is.list(entry$dashboard)) {
    return(NULL)
  }
  if (!identical(entry$phase, key_info$phase) ||
      !identical(entry$source_id, key_info$source_id) ||
      !identical(entry$report_scope, key_info$report_scope) ||
      !identical(entry$snapshot_hash, key_info$snapshot_hash) ||
      !identical(entry$route_hash, key_info$route_hash) ||
      !identical(entry$config_hash, key_info$config_hash)) {
    return(NULL)
  }
  entry
}

.monitoreo_territorial_report_cache_prune <- function(entries) {
  if (!is.list(entries) || length(entries) <= .monitoreo_territorial_report_cache_limit) {
    return(entries)
  }
  created <- vapply(entries, function(entry) {
    .monitoreo_scalar(entry$created_at, "")
  }, character(1))
  keep <- names(sort(created, decreasing = TRUE))[seq_len(.monitoreo_territorial_report_cache_limit)]
  entries[keep]
}

.monitoreo_territorial_report_cache_store <- function(snapshot, key_info, dashboard, build_ms = NA_real_, payload_size = NULL) {
  if (!is.list(snapshot) || !is.list(key_info) || !is.list(dashboard)) {
    return(snapshot)
  }
  cache <- .monitoreo_territorial_report_cache_get(snapshot)
  payload_size <- payload_size %||% .monitoreo_territorial_report_payload_size(dashboard)
  entry <- list(
    schema = .monitoreo_territorial_report_cache_schema,
    key = key_info$key,
    phase = key_info$phase,
    source_id = key_info$source_id,
    report_scope = key_info$report_scope,
    snapshot_hash = key_info$snapshot_hash,
    route_hash = key_info$route_hash,
    config_hash = key_info$config_hash,
    dashboard = dashboard,
    build_ms = as.numeric(build_ms %||% NA_real_),
    payload_size = as.integer(payload_size %||% NA_integer_),
    created_at = .monitoreo_now_iso()
  )
  cache$entries[[key_info$key]] <- entry
  cache$entries <- .monitoreo_territorial_report_cache_prune(cache$entries)
  snapshot$territorial_report_cache <- cache
  snapshot
}

.monitoreo_territorial_report_cache_meta <- function(key_info = NULL,
                                                     entry = NULL,
                                                     cache_source = "build",
                                                     cache_hit = FALSE,
                                                     backend_ms = NULL,
                                                     payload_size = NULL) {
  source_entry <- if (is.list(entry)) entry else list()
  source_key <- if (is.list(key_info)) key_info else source_entry
  list(
    schema = .monitoreo_territorial_report_cache_schema,
    status = if (isTRUE(cache_hit)) "hit" else "miss",
    cache_hit = isTRUE(cache_hit),
    cache_source = .monitoreo_scalar(cache_source, "build"),
    key = .monitoreo_scalar(source_key$key, ""),
    phase = .monitoreo_scalar(source_key$phase, ""),
    source_id = .monitoreo_scalar(source_key$source_id, ""),
    report_scope = .monitoreo_scalar(source_key$report_scope, ""),
    snapshot_hash = .monitoreo_scalar(source_key$snapshot_hash, ""),
    route_hash = .monitoreo_scalar(source_key$route_hash, ""),
    config_hash = .monitoreo_scalar(source_key$config_hash, ""),
    backend_ms = as.numeric(backend_ms %||% source_entry$build_ms %||% 0),
    payload_size = as.integer(payload_size %||% source_entry$payload_size %||% NA_integer_),
    created_at = .monitoreo_scalar(source_entry$created_at, "")
  )
}

.monitoreo_territorial_report_cache_merge <- function(snapshot, incoming_cache) {
  if (!is.list(snapshot) || !is.list(incoming_cache) ||
      !identical(.monitoreo_scalar(incoming_cache$schema, ""), .monitoreo_territorial_report_cache_schema)) {
    return(snapshot)
  }
  incoming_entries <- incoming_cache$entries %||% list()
  if (!is.list(incoming_entries) || !length(incoming_entries)) return(snapshot)
  cache <- .monitoreo_territorial_report_cache_get(snapshot)
  for (key in names(incoming_entries)) {
    entry <- incoming_entries[[key]]
    if (!is.list(entry) || !identical(.monitoreo_scalar(entry$schema, ""), .monitoreo_territorial_report_cache_schema)) next
    entry_key <- .monitoreo_scalar(entry$key, key)
    if (!nzchar(entry_key)) next
    cache$entries[[entry_key]] <- entry
  }
  cache$entries <- .monitoreo_territorial_report_cache_prune(cache$entries)
  snapshot$territorial_report_cache <- cache
  snapshot
}

.monitoreo_territorial_map_cache_merge <- function(current_cache, incoming_cache, phase = NULL) {
  if (!is.list(incoming_cache) ||
      !identical(.monitoreo_scalar(incoming_cache$schema, ""), .monitoreo_territorial_map_cache_schema)) {
    return(current_cache %||% .monitoreo_territorial_map_cache_empty())
  }
  out <- current_cache
  if (!is.list(out) || !identical(.monitoreo_scalar(out$schema, ""), .monitoreo_territorial_map_cache_schema)) {
    out <- .monitoreo_territorial_map_cache_empty()
  }
  if (!is.list(out$phases)) out$phases <- list()
  phases <- if (!is.null(phase) && nzchar(.monitoreo_scalar(phase, ""))) {
    .monitoreo_territorial_phase(phase, "pilot")
  } else {
    intersect(names(incoming_cache$phases %||% list()), c("pilot", "field"))
  }
  if (!length(phases)) phases <- c("pilot", "field")
  for (ph in phases) {
    incoming_phase <- incoming_cache$phases[[ph]] %||% list()
    if (!is.list(incoming_phase)) next
    if (!is.list(out$phases[[ph]])) out$phases[[ph]] <- list()
    for (layer in .monitoreo_territorial_map_cache_layers) {
      entry <- incoming_phase[[layer]] %||% NULL
      if (is.list(entry)) out$phases[[ph]][[layer]] <- entry
    }
  }
  out$updated_at <- .monitoreo_scalar(incoming_cache$updated_at, .monitoreo_now_iso())
  out
}

.monitoreo_territorial_prewarm_cache_ready <- function(sid,
                                                       snapshot,
                                                       data,
                                                       cfg,
                                                       phase,
                                                       scopes) {
  empty_plan <- function() list(ready = FALSE, key_infos = list(), cached_entries = list(), map_cache = list())
  if (!is.list(snapshot)) return(empty_plan())
  scopes <- .monitoreo_chr_vec(scopes)
  if (!length(scopes)) return(empty_plan())
  key_infos <- setNames(lapply(scopes, function(scope) {
    .monitoreo_territorial_report_cache_key_info(sid, snapshot, data, cfg, report_scope = scope)
  }), scopes)
  cached_entries <- setNames(lapply(scopes, function(scope) {
    .monitoreo_territorial_report_cache_lookup(snapshot, key_infos[[scope]])
  }), scopes)
  all_reports_cached <- all(vapply(seq_along(scopes), function(idx) {
    is.list(cached_entries[[idx]])
  }, logical(1)))
  if (!isTRUE(all_reports_cached)) {
    return(list(ready = FALSE, key_infos = key_infos, cached_entries = cached_entries, map_cache = list()))
  }

  needs_map <- any(scopes %in% c("route_summary", "advance_summary", "validation_summary", "queries_summary"))
  if (!isTRUE(needs_map)) {
    return(list(ready = TRUE, key_infos = key_infos, cached_entries = cached_entries, map_cache = list(skipped = TRUE)))
  }
  layers <- c("route_geometry", if (any(scopes %in% c("advance_summary", "validation_summary", "queries_summary"))) "gps_points")
  cache <- .monitoreo_territorial_map_cache_get(sid)
  phase_cache <- cache$phases[[.monitoreo_territorial_phase(phase, "pilot")]] %||% list()
  map_ready <- all(vapply(layers, function(layer) {
    entry <- phase_cache[[layer]] %||% NULL
    is.list(entry) && identical(.monitoreo_scalar(entry$status, ""), "valid")
  }, logical(1)))
  list(
    ready = isTRUE(map_ready),
    key_infos = key_infos,
    cached_entries = cached_entries,
    map_cache = list(
      schema = .monitoreo_territorial_map_cache_schema,
      active_route_phase = .monitoreo_territorial_phase(phase, "pilot"),
      cache_hit = isTRUE(map_ready),
      skipped = isTRUE(map_ready)
    )
  )
}

.monitoreo_territorial_prewarm_scopes <- function(sid,
                                                  phase = NULL,
                                                  scopes = NULL,
                                                  progress_path = NULL,
                                                  progress = NULL) {
  report <- if (is.function(progress)) {
    progress
  } else if (!is.null(progress_path)) {
    job_progress_writer(progress_path)
  } else {
    function(...) invisible(NULL)
  }
  s <- session_get(sid)
  snapshot <- s$monitoreo_snapshot %||% NULL
  sources <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
  data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  data <- .monitoreo_apply_source_metadata_to_data(data, sources)
  cfg <- monitoreo_normalize_config(s$monitoreo_config %||% snapshot$config %||% list(), data)
  family <- cfg$monitoreo_profile$family %||% "acreditacion"
  if (!identical(family, "territorial")) {
    stop("El precalentamiento territorial requiere un monitoreo territorial.", call. = FALSE)
  }
  active_phase <- .monitoreo_territorial_phase(phase %||% cfg$territorial$active_route_phase, "pilot")
  cfg$territorial$active_route_phase <- active_phase
  if (is.list(snapshot)) {
    snapshot$config <- cfg
    session_set(sid, "monitoreo_snapshot", snapshot)
  }
  session_set(sid, "monitoreo_config", cfg)

  default_scopes <- c("source", "route_summary", "validation_summary", "queries_summary", "advance_summary")
  scope_vec <- unique(vapply(.monitoreo_chr_vec(scopes %||% default_scopes), .monitoreo_report_scope, character(1)))
  scope_vec <- scope_vec[scope_vec %in% default_scopes]
  if (!length(scope_vec)) scope_vec <- default_scopes
  map_layers_for_scopes <- function(scope_values) {
    scope_values <- .monitoreo_chr_vec(scope_values)
    layers <- character()
    if (any(scope_values %in% c("route_summary", "advance_summary", "validation_summary", "queries_summary"))) {
      layers <- c(layers, "route_geometry")
    }
    if (any(scope_values %in% c("advance_summary", "validation_summary", "queries_summary"))) {
      layers <- c(layers, "gps_points")
    }
    unique(intersect(layers, .monitoreo_territorial_map_cache_layers))
  }
  needed_map_layers <- map_layers_for_scopes(scope_vec)
  scope_labels <- c(
    source = "Fuente",
    route_summary = "Hojas de ruta",
    validation_summary = "Validación",
    queries_summary = "Consultas internas",
    advance_summary = "Avance territorial"
  )
  total <- length(scope_vec)

  report("prepare", current = 0L, total = total, percent = 2, message = "Revisando caché territorial...")
  snapshot <- session_get(sid)$monitoreo_snapshot %||% list()
  display_data <- .monitoreo_territorial_filter_data_for_phase(data, cfg, phase = active_phase)
  key_infos <- setNames(lapply(scope_vec, function(scope) {
    .monitoreo_territorial_report_cache_key_info(sid, snapshot, data, cfg, report_scope = scope)
  }), scope_vec)
  cached_entries <- setNames(lapply(scope_vec, function(scope) {
    .monitoreo_territorial_report_cache_lookup(snapshot, key_infos[[scope]])
  }), scope_vec)
  all_scopes_cached <- all(vapply(cached_entries, is.list, logical(1)))
  existing_map_cache <- .monitoreo_territorial_map_cache_get(sid)
  phase_cache <- existing_map_cache$phases[[active_phase]] %||% list()
  map_cache_ready <- !length(needed_map_layers) || all(vapply(needed_map_layers, function(layer) {
    entry <- phase_cache[[layer]] %||% NULL
    is.list(entry) && identical(.monitoreo_scalar(entry$status, ""), "valid")
  }, logical(1)))
  map_cache <- if (!length(needed_map_layers)) {
    list(
      schema = .monitoreo_territorial_map_cache_schema,
      active_route_phase = active_phase,
      cache_hit = TRUE,
      skipped = TRUE
    )
  } else if (isTRUE(all_scopes_cached) && isTRUE(map_cache_ready)) {
    list(
      schema = .monitoreo_territorial_map_cache_schema,
      active_route_phase = active_phase,
      cache_hit = TRUE,
      skipped = TRUE
    )
  } else {
    report("prepare", current = 0L, total = total, percent = 2, message = "Preparando cache de mapa local...")
    tryCatch(
      .monitoreo_territorial_prepare_map_cache(
        sid,
        cfg,
        data,
        phase = active_phase,
        layers = needed_map_layers,
        force = FALSE
      ),
      error = function(e) list(error = conditionMessage(e))
    )
  }
  snapshot_box <- new.env(parent = emptyenv())
  snapshot_box$value <- snapshot
  shared_scopes <- c("validation_summary", "queries_summary", "advance_summary")
  shared_base_dashboard <- NULL
  shared_base_build_ms <- 0

  set_scope_session_cache <- function(scope, dashboard) {
    if (!is.list(dashboard)) return(invisible(NULL))
    cache_field <- paste("monitoreo_dashboard_cache", scope, sep = "_")
    cache_token_field <- paste("monitoreo_dashboard_cache_token", scope, sep = "_")
    cache_token <- .monitoreo_dashboard_cache_token(snapshot_box$value, display_data, cfg, report_scope = scope)
    s_cache <- session_get(sid)
    s_cache[[cache_field]] <- dashboard
    s_cache[[cache_token_field]] <- cache_token
    .session_env[[sid]] <- s_cache
    invisible(NULL)
  }

  store_scope_dashboard <- function(scope, dashboard, build_ms) {
    payload_size <- .monitoreo_territorial_report_payload_size(dashboard)
    snapshot_box$value <<- .monitoreo_territorial_report_cache_store(
      snapshot_box$value,
      key_infos[[scope]],
      dashboard,
      build_ms = build_ms,
      payload_size = payload_size
    )
    entry <- .monitoreo_territorial_report_cache_lookup(snapshot_box$value, key_infos[[scope]])
    if (is.list(entry) && is.list(entry$dashboard)) {
      set_scope_session_cache(scope, entry$dashboard)
    } else {
      set_scope_session_cache(scope, dashboard)
    }
    list(entry = entry, payload_size = payload_size)
  }

  build_shared_scope_dashboard <- function(scope) {
    base_built <- FALSE
    if (!is.list(shared_base_dashboard)) {
      base_started <- Sys.time()
      shared_base_dashboard <<- .monitoreo_dashboard_for_session(
        sid,
        data,
        cfg,
        include_reports = TRUE,
        report_scope = "prewarm_base"
      )
      shared_base_build_ms <<- .monitoreo_timing_ms(base_started)
      base_built <- TRUE
    }
    if (!is.list(shared_base_dashboard) || !is.list(shared_base_dashboard$territorial_reports)) {
      stop("No se pudo construir la base auditada territorial.", call. = FALSE)
    }
    scoped_dashboard <- shared_base_dashboard
    scoped_dashboard$territorial_reports <- monitoreo_territorial_scope_report(
      shared_base_dashboard$territorial_reports,
      report_scope = scope
    )
    list(
      dashboard = scoped_dashboard,
      build_ms = if (isTRUE(base_built)) shared_base_build_ms else 0L
    )
  }

  results <- vector("list", length(scope_vec))
  names(results) <- scope_vec
  for (idx in seq_along(scope_vec)) {
    scope <- scope_vec[[idx]]
    report(
      "running",
      current = idx,
      total = total,
      percent = round(5 + 90 * (idx - 0.5) / max(total, 1L)),
      message = sprintf("Preparando %s...", scope_labels[[scope]] %||% scope)
    )
    started <- Sys.time()
    item <- tryCatch({
      entry <- cached_entries[[scope]]
      cache_source <- "project"
      cache_hit <- is.list(entry)
      backend_ms <- 0
      payload_size <- as.integer(entry$payload_size %||% NA_integer_)
      if (!is.list(entry)) {
        build_started <- Sys.time()
        built <- if (scope %in% shared_scopes) {
          build_shared_scope_dashboard(scope)
        } else {
          scoped_dashboard <- .monitoreo_dashboard_for_session(
            sid,
            data,
            cfg,
            include_reports = TRUE,
            report_scope = scope
          )
          list(dashboard = scoped_dashboard, build_ms = .monitoreo_timing_ms(build_started))
        }
        stored <- store_scope_dashboard(scope, built$dashboard, built$build_ms)
        entry <- stored$entry
        payload_size <- stored$payload_size
        cache_source <- "build"
        cache_hit <- FALSE
        backend_ms <- built$build_ms
      }
      if (is.list(entry) && is.list(entry$dashboard)) {
        set_scope_session_cache(scope, entry$dashboard)
      }
      list(
        scope = scope,
        status = "ready",
        cache_hit = isTRUE(cache_hit),
        cache_source = cache_source,
        backend_ms = as.numeric(backend_ms %||% .monitoreo_timing_ms(started)),
        total_ms = as.numeric(.monitoreo_timing_ms(started)),
        payload_size = as.integer(payload_size %||% NA_integer_)
      )
    }, error = function(e) {
      list(
        scope = scope,
        status = "error",
        cache_hit = FALSE,
        cache_source = "error",
        backend_ms = as.numeric(.monitoreo_timing_ms(started)),
        total_ms = as.numeric(.monitoreo_timing_ms(started)),
        payload_size = NA_integer_,
        error = conditionMessage(e)
      )
    })
    results[[idx]] <- item
  }
  snapshot <- snapshot_box$value
  if (is.list(snapshot)) {
    snapshot$config <- cfg
    session_set(sid, "monitoreo_snapshot", snapshot)
  }
  report("done", current = total, total = total, percent = 100, message = "Monitoreo territorial listo.")

  s_final <- session_get(sid)
  snapshot_final <- s_final$monitoreo_snapshot %||% list()
  state_light <- tryCatch(.monitoreo_state_payload(sid, include_reports = FALSE), error = function(e) NULL)
  list(
    ok = TRUE,
    phase = active_phase,
    scopes = unname(results),
    map_cache = map_cache,
    state = state_light,
    session_patch = list(
      territorial_report_cache = snapshot_final$territorial_report_cache %||% NULL,
      territorial_map_cache = s_final$monitoreo_territorial_map_cache %||% NULL
    )
  )
}

.monitoreo_territorial_prewarm_job <- function(session_path,
                                               phase = NULL,
                                               scopes = NULL,
                                               progress_path = NULL) {
  s <- readRDS(session_path)
  sid <- .monitoreo_scalar(s$id, "")
  if (!nzchar(sid)) stop("Sesión inválida para precalentar monitoreo territorial.", call. = FALSE)
  .session_env[[sid]] <- s
  .monitoreo_territorial_prewarm_scopes(
    sid,
    phase = phase,
    scopes = scopes,
    progress_path = progress_path
  )
}

.monitoreo_territorial_prewarm_public_result <- function(result) {
  if (!is.list(result)) return(result)
  result$session_patch <- NULL
  result
}

.monitoreo_territorial_map_prepare_job <- function(session_path,
                                                   phase = NULL,
                                                   layers = NULL,
                                                   force = FALSE,
                                                   progress_path = NULL) {
  s <- readRDS(session_path)
  sid <- .monitoreo_scalar(s$id, "")
  if (!nzchar(sid)) stop("Sesion invalida para preparar mapa territorial.", call. = FALSE)
  .session_env[[sid]] <- s
  report <- if (!is.null(progress_path)) job_progress_writer(progress_path) else function(...) invisible(NULL)
  report("prepare", current = 0L, total = 1L, percent = 5, message = "Preparando mapa territorial...")

  snapshot <- s$monitoreo_snapshot %||% NULL
  data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  cfg <- monitoreo_normalize_config(s$monitoreo_config %||% snapshot$config %||% list(), data)
  family <- cfg$monitoreo_profile$family %||% "acreditacion"
  if (!identical(family, "territorial")) {
    stop("La preparacion de mapa requiere un monitoreo territorial.", call. = FALSE)
  }
  active_phase <- .monitoreo_territorial_phase(phase %||% cfg$territorial$active_route_phase, "pilot")
  layer_vec <- intersect(.monitoreo_chr_vec(layers %||% .monitoreo_territorial_map_cache_layers), .monitoreo_territorial_map_cache_layers)
  if (!length(layer_vec)) layer_vec <- .monitoreo_territorial_map_cache_layers

  report("running", current = 1L, total = length(layer_vec), percent = 45, message = "Preparando capas del mapa...")
  meta <- .monitoreo_territorial_prepare_map_cache(
    sid,
    cfg,
    data,
    phase = active_phase,
    layers = layer_vec,
    force = isTRUE(force)
  )
  report("done", current = length(layer_vec), total = length(layer_vec), percent = 100, message = "Mapa territorial listo.")

  s_final <- session_get(sid)
  list(
    ok = TRUE,
    phase = active_phase,
    layers = as.list(layer_vec),
    map_cache = meta,
    session_patch = list(
      territorial_map_cache = s_final$monitoreo_territorial_map_cache %||% NULL
    )
  )
}

attr(.monitoreo_territorial_map_prepare_job, "prosecnur_job_function_name") <- ".monitoreo_territorial_map_prepare_job"

.monitoreo_territorial_map_prepare_public_result <- function(result) {
  if (!is.list(result)) return(result)
  result$session_patch <- NULL
  result
}

.monitoreo_territorial_map_prepare_on_complete <- function(j) {
  result <- j$result_data
  if (!is.list(result)) return(result)
  patch <- result$session_patch %||% list()
  s_current <- session_get(j$sid, required = FALSE)
  if (!is.null(s_current)) {
    incoming_map_cache <- patch$territorial_map_cache %||% NULL
    if (is.list(incoming_map_cache)) {
      merged_map_cache <- .monitoreo_territorial_map_cache_merge(
        s_current$monitoreo_territorial_map_cache %||% list(),
        incoming_map_cache,
        phase = result$phase %||% NULL
      )
      session_set(j$sid, "monitoreo_territorial_map_cache", merged_map_cache)
      tryCatch(.monitoreo_mark_project_dirty_if_open(j$sid), error = function(e) NULL)
    }
  }
  .monitoreo_territorial_map_prepare_public_result(result)
}

