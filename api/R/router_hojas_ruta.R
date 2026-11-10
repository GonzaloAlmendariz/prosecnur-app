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

  stages <- c("territorio", "poblacion", "muestra", "manzanas", "seleccion")
  active_stage <- .hojas_ruta_scalar(ui$active_stage %||% ui$activeStage,
                                     "territorio")
  # ADR 0108 §5: «Entrega» se renombró «Selección»; un .pulso viejo no cae a
  # territorio.
  if (identical(active_stage, "entrega")) active_stage <- "seleccion"
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
  # Instantáneas sin su muestra, con huella y firmas (hojas_ruta_route_history.R).
  route_history <- .hojas_ruta_route_history_normalizar(ui$route_history %||% ui$routeHistory)

  list(
    active_stage = active_stage,
    draft_territories = as.list(draft),
    # Plan R3: ciudades agregadas o quitadas en Territorio antes de confirmar (lista cerrada:
    # sin esta línea el autosave las perdería).
    draft_ciudades = if (is.null(ui[["draft_ciudades"]])) NULL else as.list(intersect(.hojas_ruta_ciudades_pedidas(ui[["draft_ciudades"]]), .hojas_ruta_ciudades_validas())),
    map_ubigeo = map_ubigeo,
    map_zona = map_zona,
    map_level = map_level,
    map_selection_mode = .hojas_ruta_bool(
      ui$map_selection_mode %||% ui$mapSelectionMode,
      FALSE
    ),
    route_history = route_history,
    # U14: supuestos del plan de campo (lista cerrada: sin esta línea se perderían al guardar).
    plan_campo = hojas_ruta_plan_campo_supuestos(ui$plan_campo %||% list())
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
  if (out$active_stage %in% c("muestra", "manzanas", "seleccion", "entrega")) out$active_stage <- "muestra"
  out
}

.hojas_ruta_field_config_from_pilot <- function(config = list()) {
  cfg <- hojas_ruta_integrada_normalize_config(config)
  defaults <- hojas_ruta_integrada_normalize_config(list())
  cfg$n_objetivo <- defaults$n_objetivo
  cfg$n_mode <- defaults$n_mode
  cfg$n_por_distrito <- defaults$n_por_distrito
  cfg$sample_size_mode <- defaults$sample_size_mode
  # ADR 0115: Campo real escribe el marco elegible explícito (mínimo 1 si el piloto era legacy).
  cfg$marco_elegible <- hojas_ruta_marco_elegible_para_campo(cfg$marco_elegible)$marco
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
  # ADR 0118 §3: la foto enviada a Material viaja con el run (lista cerrada: sin esto se borra al guardar).
  out$envio <- .hojas_ruta_envio_normalize(run[["envio"]])
  if (identical(role, "field")) {
    out$pilot_exclusion_mode <- .hojas_ruta_pilot_exclusion_mode_normalize(
      run$pilot_exclusion_mode %||% run$pilotExclusionMode,
      "exclude_titulars"
    )
  }
  out
}

# Huella de las corridas SIN su ui_state: lo que cambia el proyecto. La página
# persiste el workspace 600 ms después de cada cambio de UI (al hidratar, al
# pasar de etapa, al desmontar) y antes cada persistencia marcaba «sin guardar»:
# mirar Hojas › Muestra ensuciaba el proyecto (L22). La posición de la UI se
# sigue guardando, pero sola no es una edición. Se compara por JSON porque el
# ida y vuelta por el cliente cambia tipos (1L/1, vector/lista) sin cambiar nada.
.hojas_ruta_runs_huella <- function(runs) {
  if (!is.list(runs) || !length(runs)) return("")
  sin_ui <- lapply(runs, function(run) {
    if (is.list(run)) {
      run$ui_state <- NULL
      # La config se compara normalizada: un .pulso anterior a una clave nueva
      # (marco_elegible, los campos de no respuesta de sample_size) la recibe con su
      # valor por defecto al primer guardado, y eso es migración derivable, no una
      # edición que deba marcar el proyecto «sin guardar».
      if (is.list(run$config)) run$config <- hojas_ruta_integrada_normalize_config(run$config)
    }
    run
  })
  as.character(jsonlite::toJSON(sin_ui, auto_unbox = TRUE, digits = NA, null = "null", na = "null"))
}

.hojas_ruta_store_runs <- function(sid, runs, active_phase = "field", notice = NULL) {
  active_phase <- .hojas_ruta_phase_normalize(active_phase, default = "field")
  if (is.null(runs[[active_phase]])) active_phase <- "field"
  if (is.null(runs[[active_phase]])) active_phase <- names(runs)[[1]]
  active <- runs[[active_phase]]
  s <- session_get(sid)
  previas <- s$hojas_ruta_runs
  # Sin corridas previas y sin aviso de migración, esto es la corrida vacía por
  # defecto que se siembra al leer: derivable, no una edición.
  sembrada <- (!is.list(previas) || !length(previas)) && is.null(notice)
  cambio_real <- !sembrada && (
    !is.null(notice) ||
      !identical(as.character(s$hojas_ruta_active_phase %||% ""), active_phase) ||
      !identical(.hojas_ruta_runs_huella(previas), .hojas_ruta_runs_huella(runs))
  )
  s$hojas_ruta_runs <- runs
  s$hojas_ruta_active_phase <- active_phase
  if (!is.null(notice)) s$hojas_ruta_phase_notice <- notice
  s$hojas_ruta_config <- active$config
  s$hojas_ruta_ui_state <- active$ui_state
  s$hojas_ruta_workspace_outputs <- active$workspace_outputs
  if (cambio_real) {
    s <- .mark_project_dirty(s, if (is.null(notice)) "hojas_ruta_runs" else "hojas_ruta_runs (corrida antigua migrada a Piloto)")
  }
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
    # El historial con muestras enteras se migra en las tres ubicaciones al leer.
    changed <- .hojas_ruta_route_history_por_migrar(s)
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
    # La muestra lleva la fecha de su sorteo junto a la semilla (hojas_ruta_sorteo_fecha.R).
    run$workspace_outputs <- .hojas_ruta_sellar_sorteo(run$workspace_outputs,
                                                       .hojas_ruta_workspace_outputs_normalize(workspace_outputs))
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
  # La corrida que se ve es la de Hojas; la etapa del Planner sólo avisa (ADR 0123 §6, hojas_ruta_etapa.R).
  active <- .hojas_ruta_active_run(sid)
  etapa <- .hojas_ruta_etapa(session_get(sid))
  s <- active$session
  legacy_cfg <- hojas_ruta_normalize_config(active$run$config %||% list())
  cfg <- hojas_ruta_integrada_normalize_config(active$run$config %||% list())
  frame_summary <- tryCatch(
    hojas_ruta_inei_frame_summary(cfg$frame_source %||% "current"),
    error = function(e) NULL
  )
  ui_state <- .hojas_ruta_ui_state_normalize(active$run$ui_state %||% list(), cfg, frame_summary = frame_summary)
  workspace_outputs <- .hojas_ruta_workspace_outputs_normalize(active$run$workspace_outputs %||% list())
  # ADR 0117: una muestra sin firma se sorteó con v1; se avisa, nunca se re-sortea.
  if (!is.null(workspace_outputs$sample)) {
    workspace_outputs$sample <- tryCatch(hojas_ruta_sorteo_aviso_v1(workspace_outputs$sample), error = function(e) workspace_outputs$sample)
  }
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
      runs = .hojas_ruta_runs_publicos(s$hojas_ruta_runs),
      envio_meta = hojas_ruta_envio_meta(active$run),
      active_phase = active$phase,
      etapa = etapa,
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
    runs = .hojas_ruta_runs_publicos(s$hojas_ruta_runs),
    envio_meta = hojas_ruta_envio_meta(active$run),
    active_phase = active$phase,
    etapa = etapa,
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
      # Checklist F1: un ui_state ausente conserva el guardado (antes se normalizaba vacío y se
      # perdía el historial de ruteos). Ningún llamador lo omitía; el lienzo lo omite al cambiar ciudades.
      ui_raw <- parsed$ui_state %||% parsed$uiState
      ui_state <- .hojas_ruta_ui_state_normalize(
        if (is.null(ui_raw)) active$run$ui_state %||% list() else ui_raw,
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
      # U17: un cambio de territorio queda en la bitácora.
      antes <- sort(as.character(unlist(current$territorios %||% list(), use.names = FALSE)))
      ahora <- sort(as.character(unlist(cfg$territorios %||% list(), use.names = FALSE)))
      if (length(ahora) && !identical(antes, ahora)) {
        .hojas_ruta_bitacora_intentar(sid, "territorio_confirmado", sprintf("Territorio: %d distrito(s).", length(ahora)), list(ubigeos = as.list(ahora), antes = as.list(antes)))
      }
      # Plan R3: una ciudad que no existe en el registro se descarta, y se dice.
      descartadas <- .hojas_ruta_ciudades_descartadas(parsed$config[["ciudades"]], cfg)
      alerts <- if (length(descartadas)) list(list(level = "warn", code = "W_HOJAS_RUTA_CIUDAD_DESCARTADA", message = sprintf("Sin cartografía para: %s.", paste(descartadas, collapse = ", ")), codigos = as.list(descartadas))) else list()
      # Checklist F1: `ligero` devuelve sólo lo que cambia; la respuesta completa pesa ~3 MB
      # (historial de ruteos y salidas de cada fase) y la página clásica y Material la usan.
      if (isTRUE(parsed$ligero)) {
        return(list(ok = TRUE, integrated_config = run$config, active_phase = active$phase, alerts = alerts))
      }
      list(
        ok = TRUE,
        integrated_config = run$config,
        ui_state = run$ui_state,
        workspace_outputs = run$workspace_outputs,
        active_phase = active$phase,
        runs = .hojas_ruta_runs_publicos(session_get(sid)$hojas_ruta_runs),
        alerts = alerts
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
      # Crear campo desde el piloto reemplaza la corrida de campo entera: con muestra o envío, sólo
      # si se pide explícitamente (revisión de guardian-contratos de la P1, B2).
      reemplazable <- .hojas_ruta_campo_reemplazable(runs$field)
      if (!reemplazable$ok && !isTRUE(as.logical(unlist(parsed$reemplazar %||% FALSE))[1])) {
        stop_api(409, "E_HOJAS_RUTA_CAMPO_CON_MUESTRA",
                 "Campo real ya tiene una muestra sorteada o enviada a Material: crearlo desde el piloto la reemplazaría.",
                 details = list(tiene_muestra = reemplazable$tiene_muestra, tiene_envio = reemplazable$tiene_envio))
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
      # Separador de generación: las entradas de campo anteriores son de la corrida descartada.
      .hojas_ruta_bitacora_intentar(sid, "campo_desde_piloto", sprintf("Campo real creado desde la piloto (%s).", mode))
      payload <- .hojas_ruta_state_payload(sid)
      aviso_marco <- hojas_ruta_marco_elegible_para_campo(hojas_ruta_integrada_normalize_config(pilot$config)$marco_elegible)$alertas
      if (length(aviso_marco)) payload$alerts <- c(payload$alerts %||% list(), aviso_marco)
      payload
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
      .hojas_ruta_bitacora_intentar(sid, "poblacion_calculada", sprintf("Población objetivo: %s personas en %d rango(s) de edad.", format(round(as.numeric(result$total_poblacion %||% 0)), big.mark = ","), length(cfg$age_ranges %||% list())), origen = parsed$origen)
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
      # Exportar es leer (B50 del checklist de brecha): no guarda la config ni deja el
      # proyecto «sin guardar»; el archivo se registra como las vistas previas.
      out_path <- tempfile(fileext = ".xlsx")
      summary <- hojas_ruta_exportar_matriz_poblacional(cfg, out_path)
      out_name <- .export_filename(sid, "hojas_ruta_population_matrix", "xlsx")
      meta <- .hojas_ruta_vp_registrar(sid, "hojas_ruta_population_matrix", out_path, original_name = out_name)
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
      # ADR 0116 §2: un ICC aplicado recalcula el DEFF con el k actual antes de calcular el N.
      cfg$sample_size <- hojas_ruta_icc_reconciliar(cfg$sample_size, .hojas_ruta_route_size(cfg))
      active <- .hojas_ruta_active_run(sid)
      .hojas_ruta_save_run(sid, active$phase, config = cfg)
      result <- hojas_ruta_sample_size_preview(cfg)
      # ADR 0116: visitas, contactos, procedencia del DEFF y sus avisos.
      result <- hojas_ruta_tamano_extras_completar(result, cfg)
      .hojas_ruta_bitacora_intentar(sid, "tamano_calculado", sprintf(
        "Tamaño: N = %d, margen total %s, DEFF %s (%s).",
        as.integer(result$n_used %||% 0L), .hojas_ruta_bitacora_margen(result$margin_total_estimated), format(cfg$sample_size$design_effect %||% 1),
        as.character(cfg$sample_size$design_effect_fuente %||% "legado")
      ), list(icc_aplicado = cfg$sample_size$icc_aplicado), origen = parsed$origen)
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
      marco_anterior <- active$run$config$marco_elegible %||% NULL
      .hojas_ruta_save_run(sid, active$phase, config = cfg)
      effective_cfg <- .hojas_ruta_effective_config_for_phase(sid, cfg, active$phase)
      result <- hojas_ruta_sample_preview_integrado(effective_cfg)
      # ADR 0115 §3, §5: nada de n perdida en silencio, y π y hashes del marco elegible.
      avisos_marco <- c(
        attr(hojas_ruta_marco_elegible_normalizar((parsed$config %||% parsed)$marco_elegible), "alertas"),
        hojas_ruta_marco_elegible_aviso_adopcion(marco_anterior, cfg$marco_elegible)
      )
      result <- hojas_ruta_marco_elegible_completar(result, effective_cfg, avisos = avisos_marco)
      # ADR 0116 §1: el salto que imprime la hoja se calcula sobre visitas, no sobre entrevistas.
      result <- hojas_ruta_tamano_extras_salto_muestra(result, effective_cfg)
      # ADR 0115 §4 (enmienda U17): estado de la decisión de cobertura; el sorteo no se bloquea.
      result <- hojas_ruta_decision_cobertura_en_muestra(result, effective_cfg$marco_elegible, session_get(sid)$hojas_ruta_bitacora)
      if (any(vapply(avisos_marco, function(a) identical(a$code, "W_FRAME_CHANGED_BY_ELIGIBILITY"), logical(1)))) {
        .hojas_ruta_bitacora_intentar(sid, "marco_elegible_adoptado", "Se adopta el marco elegible.", hojas_ruta_bitacora_detalle_marco(cfg$marco_elegible), origen = parsed$origen)
      }
      .hojas_ruta_bitacora_intentar(sid, "sorteo", hojas_ruta_bitacora_resumen_sorteo(result, effective_cfg), list(seed = result$seed, n_blocks = result$n_blocks), origen = parsed$origen)
      # La instantánea del historial guarda esta huella en vez de la muestra.
      result$sample_fingerprint <- .hojas_ruta_sample_fingerprint(result)
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
      .hojas_ruta_exigir_decision_cobertura(sid)
      out_path <- tempfile(fileext = ".pdf")
      summary <- hojas_ruta_generar_pdf_aleatorio_integrado(cfg, out_path)
      meta <- .register_output_file(sid, "hojas_ruta_random_pdf", out_path,
        detalle = .hojas_ruta_vp_detalle_manzana(summary$distrito, summary$zona, summary$manzana %||% summary$id_manzana))
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
      .hojas_ruta_exigir_decision_cobertura(sid)
      outputs <- .hojas_ruta_workspace_outputs_normalize(
        .hojas_ruta_active_run(sid, active$phase)$run$workspace_outputs %||% list()
      )
      sample_override <- parsed$sample %||% parsed$sample_snapshot %||% parsed$sampleSnapshot %||% outputs$sample %||% NULL
      if (is.null(sample_override) || !is.list(sample_override)) {
        stop_api(409, "E_NO_SAMPLE", "Primero genera una seleccion de manzanas antes de pedir reemplazos puntuales.")
      }
      # ADR 0115 §5: los reemplazos puntuales salen del marco elegible con el que se sorteó.
      marco_muestra <- hojas_ruta_marco_elegible_de_la_muestra(cfg, sample_override)
      cfg <- marco_muestra$config
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
          entregable_respuesta(list(
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
          ), meta)
        }
      )
      .hojas_ruta_bitacora_intentar(sid, "reemplazos_puntuales", sprintf("Reemplazos puntuales para %d titular(es), %d por titular.", length(titular_ids), as.integer(replacements_per_titular)), list(titulares = as.list(titular_ids)))
      list(ok = TRUE, job_id = job_id, kind = "hojas_ruta.manual_replacements_pdf", alerts = marco_muestra$alertas)
    })) |>
    plumber::pr_post("/api/hojas-ruta/route-workbook", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_integrada_normalize_config(parsed$config %||% parsed)
      active <- .hojas_ruta_active_run(sid)
      .hojas_ruta_save_run(sid, active$phase, config = cfg)
      cfg <- .hojas_ruta_effective_config_for_phase(sid, cfg, active$phase)
      .hojas_ruta_exigir_decision_cobertura(sid)
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
      entregable_respuesta(list(
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
      ), meta)
    })) |>
    plumber::pr_post("/api/hojas-ruta/generate", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_integrada_normalize_config(parsed$config %||% parsed)
      active <- .hojas_ruta_active_run(sid)
      .hojas_ruta_save_run(sid, active$phase, config = cfg)
      cfg <- .hojas_ruta_effective_config_for_phase(sid, cfg, active$phase)
      .hojas_ruta_exigir_decision_cobertura(sid)
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
          entregable_respuesta(list(
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
          ), meta)
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

      # U16: bitácora, decisión de cobertura, plan y NSE se calculan aquí; el
      # worker callr no lee la sesión.
      insumos_marco <- .reporte_mt_insumos_sesion(sid, active, cfg, outputs$sample %||% list())

      ext <- if (formato == "pdf") "pdf" else "html"
      # ADR 0133 §3: el nombre del job es el del entregable (la descarga lo hereda del path).
      filename <- .export_filename(sid, "reporte_muestra_territorial", ext)

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
          formato             = formato,
          insumos_marco       = insumos_marco
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
      res$setHeader("Content-Disposition", .content_disposition(modo, basename(meta$path)))
      res$body <- bytes
      res
    }))
}
