.hojas_ruta_parse_body <- function(req) {
  body_raw <- if (!is.null(req$bodyRaw) && length(req$bodyRaw) > 0L) {
    rawToChar(req$bodyRaw)
  } else {
    req$postBody %||% ""
  }
  if (!nzchar(body_raw)) return(list())
  tryCatch(
    jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_BAD_JSON", "Body JSON invalido.")
  )
}

.hojas_ruta_data_activa <- function(sid) {
  s <- session_get(sid)
  bases <- names(s$estudio$bases %||% list())
  if (length(bases) == 0L && is.null(s$rp_data)) {
    stop_api(409, "E_NO_DATA", "Carga una base Prosecnur antes de generar hojas de ruta.")
  }
  source <- if (length(bases) > 0L) codif_source_active(sid) else NULL
  if (!is.null(source)) {
    return(codif_data_cached(sid, source = source))
  }
  meta <- .require_data_path(sid)
  .read_data_any(meta)
}

.hojas_ruta_ui_state_normalize <- function(ui = list(), cfg = NULL, frame_summary = NULL) {
  if (is.null(ui) || !is.list(ui)) ui <- list()
  if (is.null(cfg)) cfg <- hojas_ruta_integrada_normalize_config(list())

  stages <- c("territorio", "poblacion", "muestra", "manzanas", "entrega")
  active_stage <- .hojas_ruta_scalar(ui$active_stage %||% ui$activeStage,
                                     "territorio")
  if (!active_stage %in% stages) active_stage <- "territorio"

  if (is.null(frame_summary)) {
    frame_summary <- tryCatch(
      hojas_ruta_inei_frame_summary(cfg$frame_source %||% "current"),
      error = function(e) NULL
    )
  }
  allowed_ubigeos <- if (!is.null(frame_summary)) {
    unique(vapply(frame_summary$territories %||% list(), function(item) {
      as.character(item$ubigeo %||% "")
    }, character(1)))
  } else {
    character(0)
  }

  confirmed <- .hojas_ruta_chr_vec(cfg$territorios %||% list())
  draft <- .hojas_ruta_chr_vec(
    ui$draft_territories %||% ui$draftTerritories %||% confirmed
  )
  if (length(allowed_ubigeos)) draft <- intersect(draft, allowed_ubigeos)

  map_ubigeo <- .hojas_ruta_scalar(ui$map_ubigeo %||% ui$mapUbigeo, "")
  if (!nzchar(map_ubigeo) ||
      (length(allowed_ubigeos) && !map_ubigeo %in% allowed_ubigeos)) {
    map_ubigeo <- ""
  }
  map_zona <- .hojas_ruta_scalar(ui$map_zona %||% ui$mapZona, "")
  if (nzchar(map_zona) && nzchar(map_ubigeo)) {
    zones_by_ubigeo <- frame_summary$zones_by_ubigeo %||% list()
    allowed_zones <- as.character(zones_by_ubigeo[[map_ubigeo]] %||% character(0))
    if (length(allowed_zones)) {
      if (!map_zona %in% allowed_zones) map_zona <- ""
    } else {
      frame <- tryCatch(hojas_ruta_inei_frame(cfg$frame_source %||% "current"), error = function(e) NULL)
      if (!is.null(frame) && nrow(frame)) {
        allowed_zones <- unique(as.character(frame$zona[frame$ubigeo == map_ubigeo]))
        if (!map_zona %in% allowed_zones) map_zona <- ""
      } else {
        map_zona <- ""
      }
    }
  } else if (!nzchar(map_ubigeo)) {
    map_zona <- ""
  }
  map_level <- .hojas_ruta_scalar(ui$map_level %||% ui$mapLevel, "")
  if (!map_level %in% c("distritos", "zonas", "manzanas")) {
    map_level <- if (nzchar(map_zona)) "manzanas" else if (nzchar(map_ubigeo)) "zonas" else "distritos"
  }
  if (!nzchar(map_ubigeo)) map_level <- "distritos"
  if (identical(map_level, "manzanas") && !nzchar(map_zona)) map_level <- "zonas"
  route_history <- ui$route_history %||% ui$routeHistory %||% list()
  if (is.null(route_history) || !is.list(route_history)) route_history <- list()
  if (is.data.frame(route_history)) {
    route_history <- lapply(seq_len(nrow(route_history)), function(i) as.list(route_history[i, , drop = FALSE]))
  }
  route_history <- Filter(is.list, route_history)
  if (length(route_history) > 12L) route_history <- route_history[seq_len(12L)]

  list(
    active_stage = active_stage,
    draft_territories = as.list(draft),
    map_ubigeo = map_ubigeo,
    map_zona = map_zona,
    map_level = map_level,
    map_selection_mode = .hojas_ruta_bool(
      ui$map_selection_mode %||% ui$mapSelectionMode,
      FALSE
    ),
    route_history = route_history
  )
}

.hojas_ruta_list_get <- function(x = list(), name) {
  if (is.null(x) || !is.list(x) || !name %in% names(x)) return(NULL)
  x[[name]]
}

.hojas_ruta_workspace_outputs_normalize <- function(outputs = list()) {
  if (is.null(outputs) || !is.list(outputs)) outputs <- list()
  out <- list(
    population = .hojas_ruta_list_get(outputs, "population") %||%
      .hojas_ruta_list_get(outputs, "population_preview") %||%
      .hojas_ruta_list_get(outputs, "populationPreview") %||% NULL,
    sample_size_preview = .hojas_ruta_list_get(outputs, "sample_size_preview") %||%
      .hojas_ruta_list_get(outputs, "sampleSizePreview") %||% NULL,
    quota = .hojas_ruta_list_get(outputs, "quota") %||%
      .hojas_ruta_list_get(outputs, "quota_preview") %||%
      .hojas_ruta_list_get(outputs, "quotaPreview") %||% NULL,
    sample = .hojas_ruta_list_get(outputs, "sample") %||%
      .hojas_ruta_list_get(outputs, "sample_preview") %||%
      .hojas_ruta_list_get(outputs, "samplePreview") %||% NULL
  )
  Filter(Negate(is.null), out)
}

.hojas_ruta_payload_has_rows <- function(x) {
  if (is.null(x)) return(FALSE)
  if (is.data.frame(x)) return(nrow(x) > 0L)
  if (is.list(x)) return(length(x) > 0L)
  length(x) > 0L
}

.hojas_ruta_workspace_outputs_has_data <- function(outputs = list()) {
  outputs <- .hojas_ruta_workspace_outputs_normalize(outputs)
  sample <- outputs$sample %||% list()
  has_sample_blocks <- .hojas_ruta_payload_has_rows(sample$blocks %||% NULL) ||
    .hojas_ruta_payload_has_rows(sample$replacement_blocks %||% NULL) ||
    .hojas_ruta_payload_has_rows(sample$sample %||% NULL)
  has_sample_meta <- !is.null(sample$total_entrevistas) || !is.null(sample$total_manzanas)
  has_sample_blocks ||
    isTRUE(has_sample_meta) ||
    .hojas_ruta_payload_has_rows(outputs$quota %||% NULL) ||
    .hojas_ruta_payload_has_rows(outputs$population %||% NULL) ||
    .hojas_ruta_payload_has_rows(outputs$sample_size_preview %||% NULL)
}

.hojas_ruta_phase_normalize <- function(phase = NULL, default = "field") {
  phase <- .hojas_ruta_scalar(phase, default)
  phase <- tolower(trimws(phase))
  phase <- switch(
    phase,
    piloto = "pilot",
    pilot = "pilot",
    real = "field",
    campo = "field",
    campo_real = "field",
    field = "field",
    default
  )
  if (!phase %in% c("pilot", "field")) phase <- default
  phase
}

.hojas_ruta_pilot_exclusion_mode_normalize <- function(mode = NULL, default = "exclude_titulars") {
  mode <- .hojas_ruta_scalar(mode, default)
  mode <- tolower(trimws(mode))
  mode <- switch(
    mode,
    excluir = "exclude_titulars",
    excluir_titulares = "exclude_titulars",
    exclude = "exclude_titulars",
    exclude_pilot = "exclude_titulars",
    exclude_titulars = "exclude_titulars",
    ignorar = "ignore",
    ignore = "ignore",
    default
  )
  if (!mode %in% c("exclude_titulars", "ignore")) mode <- default
  mode
}

.hojas_ruta_workspace_outputs_for_field_from_pilot <- function(outputs = list()) {
  out <- .hojas_ruta_workspace_outputs_normalize(outputs)
  out$sample_size_preview <- NULL
  out$quota <- NULL
  out$sample <- NULL
  out
}

.hojas_ruta_field_ui_from_pilot <- function(ui = list()) {
  out <- ui
  if (out$active_stage %in% c("muestra", "manzanas", "entrega")) out$active_stage <- "muestra"
  out
}

.hojas_ruta_field_config_from_pilot <- function(config = list()) {
  cfg <- hojas_ruta_integrada_normalize_config(config)
  defaults <- hojas_ruta_integrada_normalize_config(list())
  cfg$n_objetivo <- defaults$n_objetivo
  cfg$n_mode <- defaults$n_mode
  cfg$n_por_distrito <- defaults$n_por_distrito
  cfg$sample_size_mode <- defaults$sample_size_mode
  cfg
}

.hojas_ruta_workspace_output <- function(outputs = list(), name) {
  .hojas_ruta_list_get(outputs, name)
}

.hojas_ruta_sample_titular_ids <- function(sample = NULL) {
  if (is.null(sample) || !is.list(sample)) return(character(0))
  blocks <- tryCatch(.hojas_ruta_rows_df(sample$blocks %||% list()), error = function(e) data.frame())
  if (!nrow(blocks) || !"id_manzana" %in% names(blocks)) return(character(0))
  ids <- unique(as.character(blocks$id_manzana))
  ids[nzchar(ids)]
}

.hojas_ruta_run_normalize <- function(run = list(), role = "field",
                                      fallback_config = list(),
                                      fallback_ui_state = list(),
                                      fallback_outputs = list()) {
  if (is.null(run) || !is.list(run)) run <- list()
  role <- .hojas_ruta_phase_normalize(role, default = "field")
  cfg <- hojas_ruta_integrada_normalize_config(run$config %||% fallback_config %||% list())
  ui <- .hojas_ruta_ui_state_normalize(run$ui_state %||% run$uiState %||% fallback_ui_state %||% list(), cfg)
  outputs <- .hojas_ruta_workspace_outputs_normalize(
    run$workspace_outputs %||% run$workspaceOutputs %||% run$outputs %||% fallback_outputs %||% list()
  )
  out <- list(
    config = cfg,
    ui_state = ui,
    workspace_outputs = outputs,
    locked = if (identical(role, "pilot")) TRUE else isTRUE(run$locked),
    role = role
  )
  if (identical(role, "field")) {
    out$pilot_exclusion_mode <- .hojas_ruta_pilot_exclusion_mode_normalize(
      run$pilot_exclusion_mode %||% run$pilotExclusionMode,
      "exclude_titulars"
    )
  }
  out
}

.hojas_ruta_store_runs <- function(sid, runs, active_phase = "field", notice = NULL) {
  active_phase <- .hojas_ruta_phase_normalize(active_phase, default = "field")
  if (is.null(runs[[active_phase]])) active_phase <- "field"
  if (is.null(runs[[active_phase]])) active_phase <- names(runs)[[1]]
  active <- runs[[active_phase]]
  s <- session_get(sid)
  s$hojas_ruta_runs <- runs
  s$hojas_ruta_active_phase <- active_phase
  if (!is.null(notice)) s$hojas_ruta_phase_notice <- notice
  s$hojas_ruta_config <- active$config
  s$hojas_ruta_ui_state <- active$ui_state
  s$hojas_ruta_workspace_outputs <- active$workspace_outputs
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(s)
}

.hojas_ruta_ensure_runs <- function(sid) {
  s <- session_get(sid)
  legacy_cfg <- s$hojas_ruta_config %||% list()
  legacy_ui <- s$hojas_ruta_ui_state %||% list()
  legacy_outputs <- .hojas_ruta_workspace_outputs_normalize(s$hojas_ruta_workspace_outputs %||% list())
  active_phase <- .hojas_ruta_phase_normalize(s$hojas_ruta_active_phase %||% "field", default = "field")
  notice <- NULL
  changed <- FALSE

  if (is.list(s$hojas_ruta_runs) && length(s$hojas_ruta_runs)) {
    runs <- list()
    if (!is.null(s$hojas_ruta_runs$pilot)) {
      runs$pilot <- .hojas_ruta_run_normalize(s$hojas_ruta_runs$pilot, "pilot")
    }
    if (!is.null(s$hojas_ruta_runs$field)) {
      runs$field <- .hojas_ruta_run_normalize(s$hojas_ruta_runs$field, "field")
    }
    if (is.null(runs$field)) {
      runs$field <- .hojas_ruta_run_normalize(list(), "field", legacy_cfg, legacy_ui, legacy_outputs)
      changed <- TRUE
    }
  } else if (!is.null(.hojas_ruta_workspace_output(legacy_outputs, "sample"))) {
    legacy_sample <- .hojas_ruta_workspace_output(legacy_outputs, "sample")
    pilot_cfg <- hojas_ruta_integrada_normalize_config(legacy_cfg)
    pilot_ui <- .hojas_ruta_ui_state_normalize(legacy_ui, pilot_cfg)
    field_cfg <- .hojas_ruta_field_config_from_pilot(pilot_cfg)
    field_ui <- .hojas_ruta_field_ui_from_pilot(pilot_ui)
    runs <- list(
      pilot = .hojas_ruta_run_normalize(
        list(locked = TRUE),
        "pilot",
        pilot_cfg,
        pilot_ui,
        legacy_outputs
      ),
      field = .hojas_ruta_run_normalize(
        list(pilot_exclusion_mode = "exclude_titulars"),
        "field",
        field_cfg,
        field_ui,
        .hojas_ruta_workspace_outputs_for_field_from_pilot(legacy_outputs)
      )
    )
    active_phase <- "field"
    changed <- TRUE
    notice <- list(
      kind = "legacy_sample_migrated",
      message = "La corrida de 30 entrevistas quedó guardada como Piloto.",
      migrated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
      pilot_total_entrevistas = as.integer(legacy_sample$total_entrevistas %||% 0L),
      pilot_titulars = as.integer(length(.hojas_ruta_sample_titular_ids(legacy_sample)))
    )
  } else {
    runs <- list(
      field = .hojas_ruta_run_normalize(
        list(pilot_exclusion_mode = "ignore"),
        "field",
        legacy_cfg,
        legacy_ui,
        legacy_outputs
      )
    )
    active_phase <- "field"
    changed <- TRUE
  }

  if (isTRUE(changed)) {
    .hojas_ruta_store_runs(sid, runs, active_phase, notice)
    return(session_get(sid))
  }
  s
}

.hojas_ruta_active_run <- function(sid, phase = NULL) {
  s <- .hojas_ruta_ensure_runs(sid)
  phase <- .hojas_ruta_phase_normalize(phase %||% s$hojas_ruta_active_phase %||% "field", default = "field")
  if (is.null(s$hojas_ruta_runs[[phase]])) phase <- "field"
  list(
    session = s,
    phase = phase,
    run = s$hojas_ruta_runs[[phase]]
  )
}

.hojas_ruta_save_run <- function(sid, phase, config = NULL, ui_state = NULL,
                                 workspace_outputs = NULL,
                                 pilot_exclusion_mode = NULL) {
  current <- .hojas_ruta_active_run(sid, phase)
  runs <- current$session$hojas_ruta_runs
  phase <- current$phase
  run <- current$run
  if (!is.null(config) && !(identical(phase, "pilot") && isTRUE(run$locked))) {
    run$config <- hojas_ruta_integrada_normalize_config(config)
  }
  if (!is.null(ui_state)) {
    run$ui_state <- .hojas_ruta_ui_state_normalize(ui_state, run$config)
  }
  if (!is.null(workspace_outputs) && !(identical(phase, "pilot") && isTRUE(run$locked))) {
    run$workspace_outputs <- .hojas_ruta_workspace_outputs_normalize(workspace_outputs)
  }
  if (identical(phase, "field")) {
    run$pilot_exclusion_mode <- .hojas_ruta_pilot_exclusion_mode_normalize(
      pilot_exclusion_mode %||% run$pilot_exclusion_mode,
      "exclude_titulars"
    )
  }
  runs[[phase]] <- .hojas_ruta_run_normalize(run, phase)
  .hojas_ruta_store_runs(sid, runs, phase)
  runs[[phase]]
}

.hojas_ruta_effective_config_for_phase <- function(sid, config, phase = NULL) {
  current <- .hojas_ruta_active_run(sid, phase)
  cfg <- hojas_ruta_integrada_normalize_config(config)
  cfg$excluded_titular_ids <- list()
  if (!identical(current$phase, "field")) return(cfg)
  mode <- .hojas_ruta_pilot_exclusion_mode_normalize(current$run$pilot_exclusion_mode, "exclude_titulars")
  if (!identical(mode, "exclude_titulars")) return(cfg)
  pilot <- current$session$hojas_ruta_runs$pilot %||% NULL
  if (is.null(pilot)) return(cfg)
  ids <- .hojas_ruta_sample_titular_ids(.hojas_ruta_workspace_output(pilot$workspace_outputs, "sample"))
  cfg$excluded_titular_ids <- as.list(ids)
  cfg
}

.hojas_ruta_workspace_outputs_update <- function(sid, patch = list(), clear = character()) {
  active <- .hojas_ruta_active_run(sid)
  current <- .hojas_ruta_workspace_outputs_normalize(active$run$workspace_outputs %||% list())
  if (length(clear)) {
    current[intersect(names(current), clear)] <- NULL
  }
  if (length(patch)) {
    for (name in names(patch)) {
      current[[name]] <- patch[[name]]
    }
  }
  current <- .hojas_ruta_workspace_outputs_normalize(current)
  .hojas_ruta_save_run(sid, active$phase, workspace_outputs = current)
  current
}

.hojas_ruta_warmup_ubigeos <- function(ui_state = list(),
                                       cfg = list(),
                                       runs = list(),
                                       frame_summary = NULL,
                                       max_ubigeos = 8L) {
  run_values <- if (is.list(runs)) unname(runs) else list()
  candidates <- c(
    as.character(ui_state$map_ubigeo %||% ""),
    unlist(ui_state$draft_territories %||% list(), use.names = FALSE),
    unlist(cfg$territorios %||% list(), use.names = FALSE),
    unlist(lapply(run_values, function(run) {
      if (!is.list(run)) return(character(0))
      run_ui <- run$ui_state %||% list()
      run_cfg <- run$config %||% list()
      run_outputs <- run$workspace_outputs %||% run$outputs %||% list()
      c(
        run_ui$map_ubigeo %||% "",
        unlist(run_ui$draft_territories %||% list(), use.names = FALSE),
        unlist(run_cfg$territorios %||% list(), use.names = FALSE),
        unlist(lapply(run_outputs$sample$blocks %||% list(), function(block) block$ubigeo %||% ""), use.names = FALSE),
        unlist(lapply(run_outputs$sample$replacement_blocks %||% list(), function(block) block$ubigeo %||% ""), use.names = FALSE)
      )
    }), use.names = FALSE)
  )
  candidates <- unique(trimws(as.character(candidates)))
  candidates <- candidates[!is.na(candidates) & nzchar(candidates)]
  if (!length(candidates)) {
    candidates <- unique(vapply(frame_summary$territories %||% list(), function(item) {
      as.character(item$ubigeo %||% "")
    }, character(1)))
    candidates <- candidates[nzchar(candidates)]
  }
  max_ubigeos <- suppressWarnings(as.integer(max_ubigeos %||% 8L))
  if (!length(max_ubigeos) || !is.finite(max_ubigeos[[1]]) || max_ubigeos[[1]] <= 0L) max_ubigeos <- 8L
  max_ubigeos <- max_ubigeos[[1]]
  candidates[seq_len(min(length(candidates), max_ubigeos))]
}

.hojas_ruta_warmup_targets_payload <- function(sid, max_ubigeos = 8L) {
  active <- .hojas_ruta_active_run(sid)
  s <- active$session
  cfg <- hojas_ruta_integrada_normalize_config(active$run$config %||% list())
  frame_summary <- tryCatch(
    hojas_ruta_inei_frame_summary(cfg$frame_source %||% "current"),
    error = function(e) NULL
  )
  ui_state <- .hojas_ruta_ui_state_normalize(
    active$run$ui_state %||% list(),
    cfg,
    frame_summary = frame_summary
  )
  workspace_outputs <- .hojas_ruta_workspace_outputs_normalize(active$run$workspace_outputs %||% list())
  bases <- names(s$estudio$bases %||% list())
  ubigeos <- .hojas_ruta_warmup_ubigeos(
    ui_state = ui_state,
    cfg = cfg,
    runs = s$hojas_ruta_runs %||% list(),
    frame_summary = frame_summary,
    max_ubigeos = max_ubigeos
  )
  list(
    ok = TRUE,
    frame_ok = !is.null(frame_summary),
    has_data = length(bases) > 0L ||
      !is.null(s$rp_data) ||
      length(s$rp_data_sources %||% list()) > 0L ||
      .hojas_ruta_workspace_outputs_has_data(workspace_outputs),
    active_phase = active$phase,
    ubigeos = as.list(ubigeos),
    territories_count = length(frame_summary$territories %||% list())
  )
}

.hojas_ruta_state_payload <- function(sid) {
  data <- tryCatch(.hojas_ruta_data_activa(sid), error = function(e) NULL)
  active <- .hojas_ruta_active_run(sid)
  s <- active$session
  legacy_cfg <- hojas_ruta_normalize_config(active$run$config %||% list())
  cfg <- hojas_ruta_integrada_normalize_config(active$run$config %||% list())
  frame_summary <- tryCatch(
    hojas_ruta_inei_frame_summary(cfg$frame_source %||% "current"),
    error = function(e) NULL
  )
  ui_state <- .hojas_ruta_ui_state_normalize(active$run$ui_state %||% list(), cfg, frame_summary = frame_summary)
  workspace_outputs <- .hojas_ruta_workspace_outputs_normalize(active$run$workspace_outputs %||% list())
  reporte_meta_raw <- s$hojas_ruta_reporte_decisional %||% list(disponible = FALSE)
  reporte_meta <- list(
    disponible   = isTRUE(reporte_meta_raw$disponible),
    generated_at = reporte_meta_raw$generated_at %||% NULL,
    formato      = reporte_meta_raw$formato %||% NULL,
    job_id       = reporte_meta_raw$job_id %||% NULL
  )
  has_sample_size <- !is.null(workspace_outputs$sample_size_preview)
  has_workspace_outputs <- .hojas_ruta_workspace_outputs_has_data(workspace_outputs)
  frame_meta <- if (!is.null(frame_summary)) {
    .hojas_ruta_frame_meta_from_summary(frame_summary, cfg$frame_source %||% "current")
  } else {
    list(ok = FALSE)
  }
  territories <- frame_summary$territories %||% list()
  if (is.null(data)) {
    return(list(
      ok = isTRUE(frame_meta$ok),
      has_data = has_workspace_outputs,
      cache_dir = hojas_ruta_cache_dir(),
      config = legacy_cfg,
      integrated_config = cfg,
      ui_state = ui_state,
      workspace_outputs = workspace_outputs,
      runs = s$hojas_ruta_runs %||% list(),
      active_phase = active$phase,
      phase_notice = s$hojas_ruta_phase_notice %||% NULL,
      frame_meta = frame_meta,
      territories = territories,
      campos = NULL,
      variables = list(),
      reporte_decisional = reporte_meta,
      reporte_decisional_listo_para_generar = has_sample_size
    ))
  }
  campos <- hojas_ruta_detectar_campos(data)
  list(
    ok = isTRUE(frame_meta$ok),
    has_data = TRUE,
    cache_dir = hojas_ruta_cache_dir(),
    config = legacy_cfg,
    integrated_config = cfg,
    ui_state = ui_state,
    workspace_outputs = workspace_outputs,
    runs = s$hojas_ruta_runs %||% list(),
    active_phase = active$phase,
    phase_notice = s$hojas_ruta_phase_notice %||% NULL,
    frame_meta = frame_meta,
    territories = territories,
    campos = campos,
    variables = hojas_ruta_variables_disponibles(data),
    reporte_decisional = reporte_meta,
    reporte_decisional_listo_para_generar = has_sample_size
  )
}

mount_hojas_ruta <- function(pr) {
  pr |>
    plumber::pr_get("/api/hojas-ruta/warmup-targets", wrap_endpoint(function(req, res, max_ubigeos = NULL, ...) {
      sid <- session_header(req)
      .hojas_ruta_warmup_targets_payload(sid, max_ubigeos = max_ubigeos %||% 8L)
    })) |>
    plumber::pr_get("/api/hojas-ruta/state", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      started_at <- Sys.time()
      out <- .hojas_ruta_state_payload(sid)
      message(sprintf(
        "[hojas_ruta] state has_data=%s territories=%s total_ms=%s",
        isTRUE(out$has_data),
        length(out$territories %||% list()),
        as.integer(round(as.numeric(difftime(Sys.time(), started_at, units = "secs")) * 1000))
      ))
      out
    })) |>
    plumber::pr_post("/api/hojas-ruta/config", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_normalize_config(parsed$config %||% parsed)
      active <- .hojas_ruta_active_run(sid)
      .hojas_ruta_save_run(sid, active$phase, config = cfg)
      list(ok = TRUE, config = cfg)
    })) |>
    plumber::pr_post("/api/hojas-ruta/workspace", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      phase_raw <- parsed$phase %||% parsed$active_phase %||% parsed$activePhase %||% NULL
      phase <- if (is.null(phase_raw)) {
        .hojas_ruta_active_run(sid)$phase
      } else {
        .hojas_ruta_phase_normalize(phase_raw, "field")
      }
      active <- .hojas_ruta_active_run(sid, phase)
      current <- active$run$config %||% list()
      cfg <- hojas_ruta_integrada_normalize_config(parsed$config %||% current)
      ui_state <- .hojas_ruta_ui_state_normalize(
        parsed$ui_state %||% parsed$uiState %||% list(),
        cfg
      )
      has_outputs <- any(c("workspace_outputs", "workspaceOutputs", "outputs") %in% names(parsed))
      workspace_outputs <- if (has_outputs) {
        .hojas_ruta_workspace_outputs_normalize(
          parsed$workspace_outputs %||% parsed$workspaceOutputs %||% parsed$outputs %||% list()
        )
      } else {
        .hojas_ruta_workspace_outputs_normalize(
          active$run$workspace_outputs %||% list()
        )
      }
      run <- .hojas_ruta_save_run(
        sid,
        active$phase,
        config = cfg,
        ui_state = ui_state,
        workspace_outputs = workspace_outputs,
        pilot_exclusion_mode = parsed$pilot_exclusion_mode %||% parsed$pilotExclusionMode
      )
      list(
        ok = TRUE,
        integrated_config = run$config,
        ui_state = run$ui_state,
        workspace_outputs = run$workspace_outputs,
        active_phase = active$phase,
        runs = session_get(sid)$hojas_ruta_runs %||% list()
      )
    })) |>
    plumber::pr_post("/api/hojas-ruta/phase", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      current <- .hojas_ruta_active_run(sid, parsed$phase %||% parsed$active_phase %||% parsed$activePhase)
      .hojas_ruta_store_runs(sid, current$session$hojas_ruta_runs, current$phase)
      .hojas_ruta_state_payload(sid)
    })) |>
    plumber::pr_post("/api/hojas-ruta/field/from-pilot", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      current <- .hojas_ruta_active_run(sid)
      runs <- current$session$hojas_ruta_runs
      pilot <- runs$pilot %||% NULL
      if (is.null(pilot)) {
        stop_api(409, "E_NO_PILOT_RUN", "No hay una piloto historica desde la cual crear campo real.")
      }
      mode <- .hojas_ruta_pilot_exclusion_mode_normalize(
        parsed$pilot_exclusion_mode %||% parsed$pilotExclusionMode,
        "exclude_titulars"
      )
      runs$field <- .hojas_ruta_run_normalize(
        list(pilot_exclusion_mode = mode),
        "field",
        .hojas_ruta_field_config_from_pilot(pilot$config),
        .hojas_ruta_field_ui_from_pilot(pilot$ui_state),
        .hojas_ruta_workspace_outputs_for_field_from_pilot(pilot$workspace_outputs)
      )
      .hojas_ruta_store_runs(sid, runs, "field")
      .hojas_ruta_state_payload(sid)
    })) |>
    plumber::pr_post("/api/hojas-ruta/preview", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_normalize_config(parsed$config %||% parsed)
      data <- .hojas_ruta_data_activa(sid)
      active <- .hojas_ruta_active_run(sid)
      .hojas_ruta_save_run(sid, active$phase, config = cfg)
      hojas_ruta_preview(data, cfg)
    })) |>
    plumber::pr_post("/api/hojas-ruta/population-preview", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_integrada_normalize_config(parsed$config %||% parsed)
      active <- .hojas_ruta_active_run(sid)
      .hojas_ruta_save_run(sid, active$phase, config = cfg)
      result <- hojas_ruta_population_preview_integrado(cfg)
      .hojas_ruta_workspace_outputs_update(
        sid,
        patch = list(population = result),
        clear = c("sample_size_preview", "quota", "sample")
      )
      result
    })) |>
    plumber::pr_post("/api/hojas-ruta/population-export", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_integrada_normalize_config(parsed$config %||% parsed)
      active <- .hojas_ruta_active_run(sid)
      .hojas_ruta_save_run(sid, active$phase, config = cfg)
      out_path <- tempfile(fileext = ".xlsx")
      summary <- hojas_ruta_exportar_matriz_poblacional(cfg, out_path)
      out_name <- .export_filename(sid, "hojas_ruta_population_matrix", "xlsx")
      meta <- .register_output_file(sid, "hojas_ruta_population_matrix", out_path, original_name = out_name)
      list(
        ok = TRUE,
        file_id = meta$file_id,
        filename = meta$original_name,
        size = meta$size,
        total_poblacion = summary$total_poblacion,
        n_territorios = summary$n_territorios,
        n_cells = summary$n_cells
      )
    })) |>
    plumber::pr_post("/api/hojas-ruta/quota-preview", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_integrada_normalize_config(parsed$config %||% parsed)
      active <- .hojas_ruta_active_run(sid)
      .hojas_ruta_save_run(sid, active$phase, config = cfg)
      result <- hojas_ruta_quota_preview_integrado(cfg)
      .hojas_ruta_workspace_outputs_update(
        sid,
        patch = list(quota = result),
        clear = "sample"
      )
      result
    })) |>
    plumber::pr_post("/api/hojas-ruta/sample-size-preview", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_integrada_normalize_config(parsed$config %||% parsed)
      active <- .hojas_ruta_active_run(sid)
      .hojas_ruta_save_run(sid, active$phase, config = cfg)
      result <- hojas_ruta_sample_size_preview(cfg)
      .hojas_ruta_workspace_outputs_update(
        sid,
        patch = list(sample_size_preview = result),
        clear = c("quota", "sample")
      )
      result
    })) |>
    plumber::pr_post("/api/hojas-ruta/sample-preview", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_integrada_normalize_config(parsed$config %||% parsed)
      active <- .hojas_ruta_active_run(sid)
      .hojas_ruta_save_run(sid, active$phase, config = cfg)
      effective_cfg <- .hojas_ruta_effective_config_for_phase(sid, cfg, active$phase)
      result <- hojas_ruta_sample_preview_integrado(effective_cfg)
      .hojas_ruta_workspace_outputs_update(sid, patch = list(sample = result))
      result
    })) |>
    plumber::pr_post("/api/hojas-ruta/random-pdf", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      payload_config <- parsed$config
      if (!is.list(payload_config)) payload_config <- list()
      random_preference <- .hojas_ruta_scalar(
        parsed$random_preference %||%
          parsed$randomPreference %||%
          payload_config$random_preference %||%
          payload_config$randomPreference,
        "balanced"
      )
      cfg <- hojas_ruta_integrada_normalize_config(parsed$config %||% parsed)
      cfg$random_preference <- random_preference
      active <- .hojas_ruta_active_run(sid)
      .hojas_ruta_save_run(sid, active$phase, config = cfg)
      cfg <- .hojas_ruta_effective_config_for_phase(sid, cfg, active$phase)
      out_path <- tempfile(fileext = ".pdf")
      summary <- hojas_ruta_generar_pdf_aleatorio_integrado(cfg, out_path)
      out_name <- sprintf(
        "HojaRuta_Prueba_%s_Zona_%s_Mz_%s.pdf",
        hojas_ruta_sanitize_filename(summary$distrito),
        hojas_ruta_sanitize_filename(summary$zona),
        hojas_ruta_sanitize_filename(summary$manzana %||% summary$id_manzana)
      )
      meta <- .register_output_file(sid, "hojas_ruta_random_pdf", out_path, original_name = out_name)
      list(
        ok = TRUE,
        file_id = meta$file_id,
        filename = meta$original_name,
        size = meta$size,
        distrito = summary$distrito,
        ubigeo = summary$ubigeo,
        zona = summary$zona,
        manzana = summary$manzana,
        id_manzana = summary$id_manzana,
        entrevistas = as.integer(summary$entrevistas %||% 0L),
        hoja_num = as.integer(summary$hoja_num %||% 0L),
        rango_inicio = as.integer(summary$rango_inicio %||% 0L),
        rango_fin = as.integer(summary$rango_fin %||% 0L),
        frame_version = summary$frame_version %||% NA_character_,
        random_preference = summary$random_preference %||% "balanced",
        alerts = summary$alerts %||% list()
      )
    })) |>
    plumber::pr_get("/api/hojas-ruta/block-map", wrap_endpoint(function(req, res, ubigeo = NULL, limit = "1200", refresh = "0", allow_online = "0") {
      session_header(req)
      if (is.null(ubigeo) || !nzchar(as.character(ubigeo))) {
        stop_api(400, "E_NO_UBIGEO", "Falta el ubigeo del distrito.")
      }
      body <- hojas_ruta_block_map_preview_json(
        ubigeo = ubigeo,
        limit = .hojas_ruta_int(limit, 1200L),
        refresh = identical(as.character(refresh), "1"),
        allow_online = identical(as.character(allow_online), "1")
      )
      res$setHeader("Content-Type", "application/json; charset=utf-8")
      res$setHeader("Content-Length", as.character(length(body)))
      res$body <- body
      res
    })) |>
    plumber::pr_get("/api/hojas-ruta/zone-map", wrap_endpoint(function(req, res, ubigeo = NULL) {
      session_header(req)
      if (is.null(ubigeo) || !nzchar(as.character(ubigeo))) {
        stop_api(400, "E_NO_UBIGEO", "Falta el ubigeo del distrito.")
      }
      body <- hojas_ruta_zone_map_preview_json(ubigeo = ubigeo)
      res$setHeader("Content-Type", "application/json; charset=utf-8")
      res$setHeader("Content-Length", as.character(length(body)))
      res$body <- body
      res
    })) |>
    plumber::pr_get("/api/hojas-ruta/street-map", wrap_endpoint(function(req, res, ubigeo = NULL) {
      session_header(req)
      if (is.null(ubigeo) || !nzchar(as.character(ubigeo))) {
        stop_api(400, "E_NO_UBIGEO", "Falta el ubigeo del distrito.")
      }
      body <- hojas_ruta_street_map_preview_json(ubigeo = ubigeo)
      res$setHeader("Content-Type", "application/json; charset=utf-8")
      res$setHeader("Content-Length", as.character(length(body)))
      res$body <- body
      res
    })) |>
    plumber::pr_get("/api/hojas-ruta/context-map", wrap_endpoint(function(req, res, ubigeo = NULL) {
      session_header(req)
      if (is.null(ubigeo) || !nzchar(as.character(ubigeo))) {
        stop_api(400, "E_NO_UBIGEO", "Falta el ubigeo del distrito.")
      }
      body <- hojas_ruta_context_map_preview_json(ubigeo = ubigeo)
      res$setHeader("Content-Type", "application/json; charset=utf-8")
      res$setHeader("Content-Length", as.character(length(body)))
      res$body <- body
      res
    })) |>
    plumber::pr_post("/api/hojas-ruta/manual-replacements-pdf", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_integrada_normalize_config(parsed$config %||% parsed)
      active <- .hojas_ruta_active_run(sid)
      .hojas_ruta_save_run(sid, active$phase, config = cfg)
      cfg <- .hojas_ruta_effective_config_for_phase(sid, cfg, active$phase)
      outputs <- .hojas_ruta_workspace_outputs_normalize(
        .hojas_ruta_active_run(sid, active$phase)$run$workspace_outputs %||% list()
      )
      sample_override <- parsed$sample %||% parsed$sample_snapshot %||% parsed$sampleSnapshot %||% outputs$sample %||% NULL
      if (is.null(sample_override) || !is.list(sample_override)) {
        stop_api(409, "E_NO_SAMPLE", "Primero genera una seleccion de manzanas antes de pedir reemplazos puntuales.")
      }
      titular_ids <- .hojas_ruta_chr_vec(
        parsed$titular_ids %||%
          parsed$titularIds %||%
          parsed$id_manzanas %||%
          parsed$idManzanas %||%
          parsed$manzanas
      )
      if (!length(titular_ids)) {
        stop_api(400, "E_NO_TITULAR_IDS", "Selecciona al menos una manzana titular.")
      }
      replacements_per_titular <- min(
        10L,
        max(
          1L,
          .hojas_ruta_int(
            parsed$replacements_per_titular %||%
              parsed$replacementsPerTitular %||%
              parsed$n_reemplazos %||%
              parsed$nReemplazos,
            1L
          )
        )
      )
      cfg_path <- job_save_rds(sid, "hojas_ruta_config", cfg)
      sample_path <- job_save_rds(sid, "hojas_ruta_sample_snapshot", sample_override)
      api_path <- .app_api_dir()

      job_id <- job_submit(
        sid = sid,
        kind = "hojas_ruta.manual_replacements_pdf",
        func = function(cfg_path, api_path, sample_path, titular_ids, replacements_per_titular, result_path, progress_path = NULL) {
          if (requireNamespace("pkgload", quietly = TRUE)) {
            pkgload::load_all(api_path, quiet = TRUE)
          } else if (requireNamespace("devtools", quietly = TRUE)) {
            devtools::load_all(api_path, quiet = TRUE)
          }
          cfg <- readRDS(cfg_path)
          sample <- readRDS(sample_path)
          hojas_ruta_generar_reemplazos_manual_pdf(
            cfg,
            sample = sample,
            titular_ids = titular_ids,
            replacements_per_titular = replacements_per_titular,
            result_path = result_path,
            progress_path = progress_path
          )
        },
        args = list(
          cfg_path = cfg_path,
          api_path = api_path,
          sample_path = sample_path,
          titular_ids = titular_ids,
          replacements_per_titular = replacements_per_titular
        ),
        result_filename = .export_filename(sid, "hojas_ruta_reemplazos_puntuales", "pdf"),
        on_complete = function(j) {
          meta <- .register_output_file(j$sid, "hojas_ruta_reemplazos_puntuales", j$result_path)
          list(
            ok = TRUE,
            file_id = meta$file_id,
            filename = meta$original_name,
            size = meta$size,
            n_titulars = as.integer(j$result_data$n_titulars %||% 0L),
            n_replacement_blocks = as.integer(j$result_data$n_replacement_blocks %||% 0L),
            replacements_per_titular = as.integer(j$result_data$replacements_per_titular %||% replacements_per_titular),
            replacement_blocks = j$result_data$replacement_blocks %||% list(),
            alerts = j$result_data$alerts %||% list(),
            frame_version = j$result_data$frame_version %||% NA_character_
          )
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "hojas_ruta.manual_replacements_pdf")
    })) |>
    plumber::pr_post("/api/hojas-ruta/route-workbook", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_integrada_normalize_config(parsed$config %||% parsed)
      active <- .hojas_ruta_active_run(sid)
      .hojas_ruta_save_run(sid, active$phase, config = cfg)
      cfg <- .hojas_ruta_effective_config_for_phase(sid, cfg, active$phase)
      outputs <- .hojas_ruta_workspace_outputs_normalize(
        .hojas_ruta_active_run(sid, active$phase)$run$workspace_outputs %||% list()
      )
      sample_override <- parsed$sample %||% parsed$sample_snapshot %||% parsed$sampleSnapshot %||% outputs$sample %||% NULL
      out_path <- tempfile(fileext = ".xlsx")
      summary <- hojas_ruta_generar_excel_operativo_integrado(
        cfg,
        out_path,
        sample_override = sample_override
      )
      out_name <- .export_filename(sid, "hojas_ruta_operativo", "xlsx")
      meta <- .register_output_file(sid, "hojas_ruta_operativo", out_path, original_name = out_name)
      list(
        ok = TRUE,
        file_id = meta$file_id,
        filename = meta$original_name,
        size = meta$size,
        n_blocks = as.integer(summary$n_blocks %||% 0L),
        n_replacement_blocks = as.integer(summary$n_replacement_blocks %||% 0L),
        total_entrevistas = as.integer(summary$total_entrevistas %||% 0L),
        total_replacement_interviews = as.integer(summary$total_replacement_interviews %||% 0L),
        frame_version = summary$frame_version %||% NA_character_,
        alerts = summary$alerts %||% list()
      )
    })) |>
    plumber::pr_post("/api/hojas-ruta/generate", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_integrada_normalize_config(parsed$config %||% parsed)
      active <- .hojas_ruta_active_run(sid)
      .hojas_ruta_save_run(sid, active$phase, config = cfg)
      cfg <- .hojas_ruta_effective_config_for_phase(sid, cfg, active$phase)
      sample_override <- parsed$sample %||% parsed$sample_snapshot %||% parsed$sampleSnapshot %||% NULL

      cfg_path <- job_save_rds(sid, "hojas_ruta_config", cfg)
      sample_path <- if (is.null(sample_override) || !is.list(sample_override)) {
        NULL
      } else {
        job_save_rds(sid, "hojas_ruta_sample_snapshot", sample_override)
      }
      api_path <- .app_api_dir()

      job_id <- job_submit(
        sid = sid,
        kind = "hojas_ruta.generate",
        func = function(cfg_path, api_path, sample_path = NULL, result_path, progress_path = NULL) {
          if (requireNamespace("pkgload", quietly = TRUE)) {
            pkgload::load_all(api_path, quiet = TRUE)
          } else if (requireNamespace("devtools", quietly = TRUE)) {
            devtools::load_all(api_path, quiet = TRUE)
          }
          cfg <- readRDS(cfg_path)
          sample_override <- if (!is.null(sample_path) && file.exists(sample_path)) readRDS(sample_path) else NULL
          hojas_ruta_generar_zip_integrado(
            cfg,
            result_path,
            progress_path = progress_path,
            sample_override = sample_override
          )
        },
        args = list(cfg_path = cfg_path, api_path = api_path, sample_path = sample_path),
        result_filename = .export_filename(sid, "hojas_ruta_zip", "zip"),
        on_complete = function(j) {
          session_set(j$sid, "hojas_ruta_ok", TRUE)
          meta <- .register_output_file(j$sid, "hojas_ruta_zip", j$result_path)
          list(
            ok = TRUE,
            file_id = meta$file_id,
            filename = meta$original_name,
            size = meta$size,
            n_pdfs = as.integer(j$result_data$n_pdfs %||% 0L),
            n_zone_pdfs = as.integer(j$result_data$n_zone_pdfs %||% 0L),
            n_blocks = as.integer(j$result_data$n_blocks %||% 0L),
            n_replacement_blocks = as.integer(j$result_data$n_replacement_blocks %||% 0L),
            n_zones = as.integer(j$result_data$n_zones %||% 0L),
            total_entrevistas = as.integer(j$result_data$total_entrevistas %||% 0L),
            total_replacement_interviews = as.integer(j$result_data$total_replacement_interviews %||% 0L),
            frame_version = j$result_data$frame_version %||% NA_character_,
            alerts = j$result_data$alerts %||% list(),
            mapas_faltantes = 0L
          )
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "hojas_ruta.generate")
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/hojas-ruta/reporte-decisional — genera la propuesta muestral
    # Toma el estado actual (config + workspace_outputs) y arma un reporte
    # Quarto al mismo estilo que el del modulo de aulas universitarias.
    # Body: { formato: "html" | "pdf" }
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/hojas-ruta/reporte-decisional",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      formato <- as.character(parsed$formato %||% "html")
      if (!formato %in% c("html", "pdf")) {
        stop_api(400, "E_FORMATO_INVALIDO",
                 "formato debe ser 'html' o 'pdf'.")
      }
      active <- .hojas_ruta_active_run(sid)
      cfg <- hojas_ruta_integrada_normalize_config(active$run$config %||% list())
      outputs <- .hojas_ruta_workspace_outputs_normalize(
        active$run$workspace_outputs %||% list()
      )
      # Validacion minima: necesitamos al menos sample_size_preview para
      # que el reporte tenga contenido util.
      if (is.null(outputs$sample_size_preview)) {
        stop_api(409, "E_NO_SAMPLE_SIZE",
                 "Ejecuta el calculo de tamano muestral en Hojas de Ruta antes de generar el reporte.")
      }
      frame <- tryCatch(hojas_ruta_inei_frame(), error = function(e) NULL)
      territorios_all <- if (!is.null(frame)) .hojas_ruta_territories(frame) else list()
      ubigeos_sel <- cfg$territorios %||% list()
      territorios_sel <- if (length(ubigeos_sel) > 0L && length(territorios_all) > 0L) {
        Filter(function(t) (t$ubigeo %||% "") %in% as.character(ubigeos_sel),
               territorios_all)
      } else {
        territorios_all
      }

      ext <- if (formato == "pdf") "pdf" else "html"
      filename <- sprintf("reporte_muestra_territorial.%s", ext)

      sid_capt <- sid
      on_complete <- function(j) {
        if (identical(j$status, "done") &&
            !is.null(j$result_path) && file.exists(j$result_path)) {
          s_now <- session_get(sid_capt, required = FALSE)
          if (is.null(s_now)) return(j$result_data)
          meta_now <- list(
            disponible   = TRUE,
            path         = j$result_path,
            formato      = formato,
            generated_at = format(j$finished_at,
                                  "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
          )
          session_set(sid_capt, "hojas_ruta_reporte_decisional", meta_now)
        }
        j$result_data
      }

      job_id <- job_submit(
        sid    = sid,
        kind   = "hojas_ruta_reporte_decisional",
        func   = muestra_territorial_render_job,
        args   = list(
          config              = cfg,
          territorios         = territorios_sel,
          population          = outputs$population,
          sample_size_preview = outputs$sample_size_preview,
          quota               = outputs$quota,
          decision_log        = NULL,
          formato             = formato
        ),
        result_filename = filename,
        on_complete = on_complete
      )

      session_set(sid, "hojas_ruta_reporte_decisional", list(
        disponible = FALSE,
        formato    = formato,
        job_id     = job_id
      ))

      list(ok = TRUE, job_id = job_id, formato = formato)
    })) |>

    # -----------------------------------------------------------------------
    # GET /api/hojas-ruta/reporte-decisional/descargar — binario del reporte.
    # Soporta ?sid=... (link) y ?inline=1 (iframe preview). El `t=` se
    # acepta como cache-buster.
    # -----------------------------------------------------------------------
    plumber::pr_get("/api/hojas-ruta/reporte-decisional/descargar",
                    wrap_endpoint(function(req, res, sid = NULL,
                                           inline = NULL, t = NULL) {
      effective_sid <- session_header(req)
      if (is.null(effective_sid) && is.character(sid) &&
          length(sid) >= 1 && nzchar(sid[[1]])) {
        effective_sid <- as.character(sid[[1]])
      }
      s <- session_get(effective_sid)
      meta <- s$hojas_ruta_reporte_decisional
      if (is.null(meta) || !isTRUE(meta$disponible) ||
          is.null(meta$path) || !file.exists(meta$path)) {
        # Fallback: si el job termino pero on_complete no actualizo el
        # meta (caso raro), reintentar via job_id.
        if (!is.null(meta$job_id)) {
          j <- tryCatch(job_poll(meta$job_id), error = function(e) NULL)
          if (!is.null(j) && identical(j$status, "done") &&
              !is.null(j$result_path) && file.exists(j$result_path)) {
            meta$path <- j$result_path
            meta$disponible <- TRUE
            meta$generated_at <- format(j$finished_at,
                                        "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
            session_set(effective_sid, "hojas_ruta_reporte_decisional", meta)
          }
        }
        if (is.null(meta$path) || !file.exists(meta$path)) {
          stop_api(404, "E_NO_REPORTE",
                   "No hay reporte decisional generado todavia.")
        }
      }
      n <- file.info(meta$path)$size
      bytes <- readBin(meta$path, what = "raw", n = n)
      res$setHeader("Content-Type", mime::guess_type(meta$path))
      res$setHeader("Content-Length", as.character(n))
      modo <- if (is.character(inline) && length(inline) >= 1 &&
                  inline[[1]] %in% c("1", "true", "TRUE")) "inline"
              else "attachment"
      res$setHeader("Content-Disposition",
                    sprintf('%s; filename="%s"', modo, basename(meta$path)))
      res$body <- bytes
      res
    }))
}
