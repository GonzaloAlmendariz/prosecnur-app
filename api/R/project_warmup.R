# =============================================================================
# Project warmup — arranque con proyecto obligatorio
# =============================================================================
# Prepara caches locales compactas despues de abrir/crear un .pulso. No
# sincroniza fuentes externas, no genera entregables y no lee secretos.

.project_warmup_modules <- c(
  "project",
  "carga",
  "validacion",
  "codificacion",
  "analitica",
  "graficos",
  "hojas_ruta",
  "hojas_ruta_cartografia",
  "calc_muestra",
  "monitoreo",
  "monitoreo_territorial",
  "dashboard",
  "editor_xlsform",
  "enciclopedia"
)

.project_warmup_default_budget_ms <- 90000L

.project_warmup_budget_ms <- function(budget_ms = .project_warmup_default_budget_ms) {
  value <- suppressWarnings(as.numeric(budget_ms %||% .project_warmup_default_budget_ms))
  if (!is.finite(value) || value <= 0) value <- .project_warmup_default_budget_ms
  as.integer(min(.project_warmup_default_budget_ms, max(5000, round(value))))
}

.project_warmup_mode <- function(mode = "full") {
  mode <- as.character(mode %||% "full")
  if (!nzchar(mode) || !mode %in% c("full")) "full" else mode
}

.project_warmup_elapsed_ms <- function(started_at) {
  as.integer(max(0, round(as.numeric(difftime(Sys.time(), started_at, units = "secs")) * 1000)))
}

.project_warmup_compact <- function(x, max_chars = 120) {
  txt <- tryCatch(as.character(x %||% ""), error = function(e) "")
  txt <- txt[1] %||% ""
  if (nchar(txt, type = "chars") > max_chars) {
    paste0(substr(txt, 1, max_chars - 1), "...")
  } else {
    txt
  }
}

.project_warmup_item <- function(id,
                                 module,
                                 status,
                                 started_at,
                                 message = NULL,
                                 details = list(),
                                 error = NULL) {
  out <- list(
    id = id,
    module = module,
    status = status,
    elapsed_ms = .project_warmup_elapsed_ms(started_at),
    message = message,
    details = details,
    error = error
  )
  out[!vapply(out, is.null, logical(1))]
}

.project_warmup_skip <- function(reason) {
  list(status = "skipped", message = reason)
}

.project_warmup_ready <- function(message = NULL, details = list()) {
  list(status = "ready", message = message, details = details)
}

.project_warmup_with_elapsed_limit <- function(expr, remaining_ms, reserve_ms = 1500L) {
  remaining_ms <- suppressWarnings(as.numeric(remaining_ms %||% 0L))
  reserve_ms <- suppressWarnings(as.numeric(reserve_ms %||% 0L))
  if (!is.finite(remaining_ms) || remaining_ms <= reserve_ms) {
    stop("Sin tiempo suficiente para preparar este bloque.", call. = FALSE)
  }
  seconds <- max(1, (remaining_ms - reserve_ms) / 1000)
  setTimeLimit(elapsed = seconds, transient = TRUE)
  on.exit(setTimeLimit(cpu = Inf, elapsed = Inf, transient = FALSE), add = TRUE)
  force(expr)
}

.project_warmup_session_summary <- function(sid) {
  s <- session_get(sid)
  bases <- names(s$estudio$bases %||% list())
  list(
    has_project = !is.null(s$project_path) && nzchar(s$project_path),
    project_path = s$project_path %||% NULL,
    project_name = if (!is.null(s$project_path) && nzchar(s$project_path)) {
      tools::file_path_sans_ext(basename(s$project_path))
    } else {
      NULL
    },
    n_files = length(s$files %||% list()),
    n_bases = length(bases),
    active_base = s$estudio$active_base %||% NULL,
    has_data = !is.null(s$rp_data) || length(s$rp_data_sources %||% list()) > 0L,
    has_instrument = !is.null(s$rp_inst) || length(s$rp_inst_sources %||% list()) > 0L
  )
}

.project_warmup_ubigeos <- function(state = list(), max_ubigeos = NULL) {
  ui <- state$ui_state %||% list()
  cfg <- state$integrated_config %||% state$config %||% list()
  runs <- state$runs %||% list()
  run_values <- if (is.list(runs)) unname(runs) else list()
  candidates <- c(
    as.character(ui$map_ubigeo %||% ""),
    unlist(ui$draft_territories %||% list(), use.names = FALSE),
    unlist(cfg$territorios %||% list(), use.names = FALSE),
    unlist(lapply(run_values, function(run) {
      if (!is.list(run)) return(character(0))
      run_ui <- run$ui_state %||% list()
      run_cfg <- run$config %||% list()
      run_outputs <- run$workspace_outputs %||% list()
      c(
        run_ui$map_ubigeo %||% "",
        unlist(run_ui$draft_territories %||% list(), use.names = FALSE),
        unlist(run_cfg$territorios %||% list(), use.names = FALSE),
        unlist(lapply(run_outputs$sample$blocks %||% list(), function(block) block$ubigeo %||% ""), use.names = FALSE),
        unlist(lapply(run_outputs$sample$replacement_blocks %||% list(), function(block) block$ubigeo %||% ""), use.names = FALSE)
      )
    }), use.names = FALSE),
    unlist(lapply(state$territories %||% list(), function(item) item$ubigeo %||% ""), use.names = FALSE)
  )
  candidates <- unique(trimws(as.character(candidates)))
  candidates <- candidates[!is.na(candidates) & nzchar(candidates)]
  if (!length(candidates)) return(character(0))
  limit <- suppressWarnings(as.numeric(max_ubigeos %||% NA_real_))
  if (length(limit) && is.finite(limit) && limit > 0) {
    return(candidates[seq_len(min(length(candidates), as.integer(limit)))])
  }
  candidates
}

.project_warmup_layer_call <- function(layer, expr, timeout_ms = 4500L) {
  started_at <- Sys.time()
  tryCatch({
    timeout_ms <- suppressWarnings(as.numeric(timeout_ms %||% 4500L))
    if (is.finite(timeout_ms) && timeout_ms > 0) {
      setTimeLimit(elapsed = max(1, timeout_ms / 1000), transient = TRUE)
      on.exit(setTimeLimit(cpu = Inf, elapsed = Inf, transient = FALSE), add = TRUE)
    }
    value <- force(expr)
    size <- tryCatch({
      if (is.raw(value)) {
        length(value)
      } else {
        nchar(as.character(value %||% ""), type = "bytes")
      }
    }, error = function(e) NA_integer_)
    list(
      layer = layer,
      status = "ready",
      elapsed_ms = .project_warmup_elapsed_ms(started_at),
      bytes = as.integer(size %||% NA_integer_)
    )
  }, error = function(e) {
    list(
      layer = layer,
      status = "error",
      elapsed_ms = .project_warmup_elapsed_ms(started_at),
      error = .project_warmup_compact(conditionMessage(e), 180)
    )
  })
}

.project_warmup_hojas_ruta_cartography <- function(sid, remaining_ms = .project_warmup_default_budget_ms) {
  if (!exists(".hojas_ruta_warmup_targets_payload", mode = "function") &&
      !exists(".hojas_ruta_state_payload", mode = "function")) {
    return(.project_warmup_skip("Hojas de ruta no esta disponible en este build."))
  }
  targets <- if (exists(".hojas_ruta_warmup_targets_payload", mode = "function")) {
    .hojas_ruta_warmup_targets_payload(sid, max_ubigeos = 8L)
  } else {
    state <- .hojas_ruta_state_payload(sid)
    list(
      ubigeos = as.list(.project_warmup_ubigeos(state, max_ubigeos = 8L)),
      frame_ok = isTRUE(state$frame_meta$ok),
      active_phase = state$active_phase %||% NULL
    )
  }
  ubigeos <- unique(trimws(as.character(unlist(targets$ubigeos %||% list(), use.names = FALSE))))
  ubigeos <- ubigeos[!is.na(ubigeos) & nzchar(ubigeos)]
  if (!length(ubigeos)) {
    return(.project_warmup_skip("Sin ubigeos seleccionados para cartografia local."))
  }

  started_at <- Sys.time()
  task_budget_ms <- min(as.integer(remaining_ms %||% 0L), 18000L)
  if (!is.finite(task_budget_ms) || task_budget_ms <= 0L) task_budget_ms <- 18000L
  results <- lapply(ubigeos, function(ubigeo) {
    elapsed_ms <- .project_warmup_elapsed_ms(started_at)
    if (elapsed_ms >= task_budget_ms) {
      return(list(ubigeo = ubigeo, status = "timeout", layers = list()))
    }
    layer_budget <- function() max(750L, min(4500L, task_budget_ms - .project_warmup_elapsed_ms(started_at)))
    layers <- list(
      .project_warmup_layer_call(
        "manzanas",
        hojas_ruta_block_map_preview_json(
          ubigeo = ubigeo,
          limit = 0L,
          refresh = FALSE,
          allow_online = FALSE
        ),
        timeout_ms = layer_budget()
      ),
      .project_warmup_layer_call(
        "zonas",
        hojas_ruta_zone_map_preview_json(ubigeo = ubigeo),
        timeout_ms = layer_budget()
      ),
      .project_warmup_layer_call(
        "contexto",
        hojas_ruta_context_map_preview_json(ubigeo = ubigeo),
        timeout_ms = layer_budget()
      )
    )
    status_values <- vapply(layers, function(x) as.character(x$status %||% ""), character(1))
    list(
      ubigeo = ubigeo,
      status = if (any(status_values == "ready")) "ready" else "error",
      partial = any(status_values == "error"),
      layers = layers
    )
  })

  status_values <- vapply(results, function(x) as.character(x$status %||% ""), character(1))
  status <- if (any(status_values == "ready")) "ready" else if (any(status_values == "timeout")) "timeout" else "error"
  list(
    status = status,
    message = sprintf("Cartografia local revisada para %s distrito(s).", length(results)),
    details = list(
      active_phase = targets$active_phase %||% NULL,
      frame_ok = isTRUE(targets$frame_ok),
      ubigeos = results
    )
  )
}

.project_warmup_monitoreo_family <- function(sid) {
  s <- session_get(sid)
  snapshot <- s$monitoreo_snapshot %||% NULL
  data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  cfg <- tryCatch(
    monitoreo_normalize_config(s$monitoreo_config %||% snapshot$config %||% list(), data),
    error = function(e) list()
  )
  as.character(cfg$monitoreo_profile$family %||% "")
}

.project_warmup_has_processing_state <- function(s) {
  !is.null(s$rp_data) || !is.null(s$rp_inst) ||
    length(s$rp_data_sources %||% list()) > 0L ||
    length(s$rp_inst_sources %||% list()) > 0L ||
    length(s$estudio$bases %||% list()) > 0L ||
    isTRUE(s$auditoria_run) ||
    isTRUE(s$data_previewed) ||
    isTRUE(s$plan_built) ||
    isTRUE(s$codif_familias_generated) ||
    isTRUE(s$analitica_prep_ok)
}

.project_warmup_plan <- function(sid) {
  s <- session_get(sid)
  add_module <- function(ids, reasons, id, reason) {
    if (!id %in% ids) {
      ids <- c(ids, id)
      reasons[[id]] <- reason
    }
    list(ids = ids, reasons = reasons)
  }
  ids <- "project"
  reasons <- list(project = "Proyecto activo")

  processing <- .project_warmup_has_processing_state(s)
  if (isTRUE(processing)) {
    for (id in c("carga", "validacion", "codificacion", "analitica")) {
      added <- add_module(ids, reasons, id, "Estado de procesamiento presente")
      ids <- added$ids
      reasons <- added$reasons
    }
  }
  if (is.list(s$graficos_config) || is.list(s$graficos_plan) ||
      isTRUE(s$graficos_ppt_ok) || isTRUE(s$graficos_word_ok)) {
    added <- add_module(ids, reasons, "graficos", "Configuracion de graficos presente")
    ids <- added$ids
    reasons <- added$reasons
  }
  has_hojas_ruta <- is.list(s$hojas_ruta_config) ||
    is.list(s$hojas_ruta_ui_state) ||
    is.list(s$hojas_ruta_workspace_outputs) ||
    length(s$hojas_ruta_runs %||% list()) > 0L
  family <- .project_warmup_monitoreo_family(sid)
  if (isTRUE(has_hojas_ruta)) {
    for (id in c("hojas_ruta", "hojas_ruta_cartografia")) {
      added <- add_module(ids, reasons, id, "Hojas de ruta presente en el proyecto")
      ids <- added$ids
      reasons <- added$reasons
    }
  } else if (identical(family, "territorial")) {
    added <- add_module(ids, reasons, "hojas_ruta_cartografia", "Cartografia requerida por monitoreo territorial")
    ids <- added$ids
    reasons <- added$reasons
  }
  has_calc <- is.list(s$calc_muestra_state) ||
    is.list(s$calc_muestra_config) ||
    is.list(s$cm_state) ||
    is.list(s$calc_muestra_aulas)
  if (isTRUE(has_calc)) {
    added <- add_module(ids, reasons, "calc_muestra", "Estado de calculo de muestra presente")
    ids <- added$ids
    reasons <- added$reasons
  }
  if (is.list(s$monitoreo_config) || is.list(s$monitoreo_snapshot) ||
      length(s$monitoreo_sources %||% list()) > 0L) {
    added <- add_module(ids, reasons, "monitoreo", "Configuracion de monitoreo presente")
    ids <- added$ids
    reasons <- added$reasons
    if (identical(family, "territorial")) {
      added <- add_module(ids, reasons, "monitoreo_territorial", "Perfil territorial presente")
      ids <- added$ids
      reasons <- added$reasons
    }
  }
  if (is.list(s$dashboard_config) || is.list(s$dashboard_source) ||
      is.list(s$dashboard_curation) || isTRUE(s$dashboard_imported)) {
    added <- add_module(ids, reasons, "dashboard", "Dashboard configurado en el proyecto")
    ids <- added$ids
    reasons <- added$reasons
  }
  if (is.list(s$xlsform_state)) {
    added <- add_module(ids, reasons, "editor_xlsform", "Formulario editable guardado")
    ids <- added$ids
    reasons <- added$reasons
  }

  frontend_map <- list(
    project = c("home"),
    carga = c("procesamiento", "carga"),
    validacion = c("procesamiento", "validacion"),
    codificacion = c("procesamiento", "codificacion"),
    analitica = c("procesamiento", "analitica"),
    graficos = c("procesamiento", "graficos", "graficos_datos", "plotly"),
    hojas_ruta = c("hojas_ruta", "hojas_ruta_datos"),
    hojas_ruta_cartografia = c("hojas_ruta_cartografia"),
    calc_muestra = c("calc_muestra"),
    monitoreo = c("monitoreo", "monitoreo_datos"),
    monitoreo_territorial = c("monitoreo", "monitoreo_datos"),
    dashboard = c("dashboard", "dashboard_datos", "plotly", "html_to_image"),
    editor_xlsform = c("editor_xlsform"),
    enciclopedia = c("enciclopedia")
  )
  frontend <- unique(unlist(frontend_map[ids], use.names = FALSE))
  list(
    ok = TRUE,
    kind = "project.warmup_plan",
    backend_modules = as.list(ids),
    frontend_modules = as.list(frontend),
    reasons = reasons,
    profile = list(
      processing = isTRUE(processing),
      monitoreo_family = family %||% "",
      has_hojas_ruta = isTRUE(has_hojas_ruta),
      has_dashboard = "dashboard" %in% ids
    )
  )
}

.project_warmup_restore_territorial_phase <- function(sid, phase) {
  if (!nzchar(as.character(phase %||% ""))) return(invisible(FALSE))
  s <- session_get(sid)
  changed <- FALSE
  if (is.list(s$monitoreo_config)) {
    cfg <- s$monitoreo_config
    if (!is.list(cfg$territorial)) cfg$territorial <- list()
    cfg$territorial$active_route_phase <- phase
    session_set(sid, "monitoreo_config", cfg)
    changed <- TRUE
  }
  s <- session_get(sid)
  if (is.list(s$monitoreo_snapshot)) {
    snapshot <- s$monitoreo_snapshot
    cfg <- snapshot$config %||% s$monitoreo_config %||% list()
    if (!is.list(cfg$territorial)) cfg$territorial <- list()
    cfg$territorial$active_route_phase <- phase
    snapshot$config <- cfg
    session_set(sid, "monitoreo_snapshot", snapshot)
    changed <- TRUE
  }
  invisible(changed)
}

.project_warmup_monitoreo_territorial <- function(sid) {
  family <- .project_warmup_monitoreo_family(sid)
  if (!identical(family, "territorial")) {
    return(.project_warmup_skip("El proyecto no usa perfil territorial."))
  }
  if (!exists(".monitoreo_territorial_prewarm_scopes", mode = "function")) {
    return(.project_warmup_skip("Prewarm territorial no disponible."))
  }
  s_initial <- session_get(sid)
  snapshot_initial <- s_initial$monitoreo_snapshot %||% NULL
  data_initial <- if (!is.null(snapshot_initial) && is.data.frame(snapshot_initial$data)) snapshot_initial$data else data.frame()
  cfg_initial <- tryCatch(
    monitoreo_normalize_config(s_initial$monitoreo_config %||% snapshot_initial$config %||% list(), data_initial),
    error = function(e) list(territorial = list(active_route_phase = "pilot"))
  )
  original_phase <- as.character(cfg_initial$territorial$active_route_phase %||% "pilot")
  scopes <- c("source", "route_summary", "advance_summary", "validation_summary", "queries_summary")
  phases <- unique(c("field", original_phase, "pilot"))
  phases <- phases[phases %in% c("pilot", "field")]
  if (!length(phases)) phases <- c("pilot", "field")

  results <- setNames(vector("list", length(phases)), phases)
  on.exit(.project_warmup_restore_territorial_phase(sid, original_phase), add = TRUE)
  for (phase in phases) {
    results[[phase]] <- .monitoreo_territorial_prewarm_scopes(
      sid,
      phase = phase,
      scopes = scopes,
      progress_path = NULL
    )
  }
  .project_warmup_restore_territorial_phase(sid, original_phase)

  scope_status <- unlist(lapply(results, function(result) {
    vapply(result$scopes %||% list(), function(item) {
      as.character(item$status %||% "skipped")
    }, character(1))
  }), use.names = FALSE)
  s_final <- session_get(sid)
  snapshot_final <- s_final$monitoreo_snapshot %||% list()
  list(
    status = if (any(scope_status == "ready")) "ready" else "skipped",
    message = "Monitoreo territorial local preparado.",
    details = list(
      phases = lapply(results, function(result) {
        list(
          phase = result$phase %||% NULL,
          scopes = result$scopes %||% list(),
          map_cache = result$map_cache %||% list()
        )
      })
    ),
    session_patch = list(
      territorial_report_cache = snapshot_final$territorial_report_cache %||% NULL,
      territorial_map_cache = s_final$monitoreo_territorial_map_cache %||% NULL
    )
  )
}

.project_warmup_monitoreo <- function(sid, remaining_ms = .project_warmup_default_budget_ms) {
  if (!exists(".monitoreo_state_payload", mode = "function")) {
    return(.project_warmup_skip("Modulo no disponible."))
  }
  s <- session_get(sid)
  if (is.null(s$monitoreo_config) && is.null(s$monitoreo_snapshot)) {
    return(.project_warmup_skip("Sin configuracion local de monitoreo."))
  }
  family <- .project_warmup_monitoreo_family(sid)
  if (identical(family, "acreditacion")) {
    started_at <- Sys.time()
    light_state <- tryCatch(
      .project_warmup_with_elapsed_limit(
        .monitoreo_state_payload(sid, include_reports = FALSE),
        remaining_ms,
        reserve_ms = 4000L
      ),
      error = function(e) NULL
    )
    state <- .project_warmup_with_elapsed_limit(
      .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = "advance_summary"),
      remaining_ms - .project_warmup_elapsed_ms(started_at),
      reserve_ms = 1500L
    )
    reports <- state$dashboard$acreditacion_reports %||% list()
    client_report <- reports$client_report %||% list()
    summary <- client_report$summary %||% list()
    actors <- client_report$actors %||% list()
    daily_general <- client_report$daily_general %||% list()
    s_final <- session_get(sid)
    return(list(
      status = "ready",
      message = "Avance de monitoreo preparado.",
      details = list(
      family = family,
      scope = reports$report_scope %||% "advance_summary",
      n_rows = as.integer(state$n_rows %||% light_state$n_rows %||% 0L),
      summary_ready = length(summary) > 0L,
      actors_ready = length(actors) > 0L,
      daily_general_ready = length(daily_general) > 0L
      ),
      session_patch = list(
        monitoreo = list(
          monitoreo_dashboard_light_cache = s_final$monitoreo_dashboard_light_cache %||% NULL,
          monitoreo_dashboard_light_cache_token = s_final$monitoreo_dashboard_light_cache_token %||% NULL,
          monitoreo_dashboard_cache_advance_summary = s_final$monitoreo_dashboard_cache_advance_summary %||% NULL,
          monitoreo_dashboard_cache_token_advance_summary = s_final$monitoreo_dashboard_cache_token_advance_summary %||% NULL
        )
      )
    ))
  }
  .project_warmup_ready("Configuracion local de monitoreo disponible.", list(
    family = family,
    has_snapshot = !is.null(s$monitoreo_snapshot),
    hydrated_by_frontend = !identical(family, "territorial"),
    full_reports_ready = FALSE,
    full_reports_skipped = TRUE
  ))
}

.project_warmup_tasks <- function() {
  list(
    list(
      id = "project",
      module = "Proyecto",
      run = function(sid, remaining_ms) {
        s <- session_get(sid)
        if (is.null(s$project_path) || !nzchar(s$project_path)) {
          stop("Abre o crea un proyecto .pulso antes del warmup.", call. = FALSE)
        }
        .project_warmup_ready(
          "Proyecto activo verificado.",
          list(
            path = s$project_path,
            name = tools::file_path_sans_ext(basename(s$project_path)),
            dirty = isTRUE(s$project_dirty)
          )
        )
      }
    ),
    list(
      id = "carga",
      module = "Carga",
      run = function(sid, remaining_ms) {
        summary <- .project_warmup_session_summary(sid)
        if (!isTRUE(summary$has_data) && !isTRUE(summary$has_instrument)) {
          return(.project_warmup_skip("Sin base o instrumento local cargado."))
        }
        .project_warmup_ready("Estado de carga disponible.", summary)
      }
    ),
    list(
      id = "validacion",
      module = "Validacion",
      run = function(sid, remaining_ms) {
        s <- session_get(sid)
        flags <- list(
          auditoria_run = isTRUE(s$auditoria_run),
          data_previewed = isTRUE(s$data_previewed),
          plan_built = isTRUE(s$plan_built)
        )
        if (!any(unlist(flags, use.names = FALSE))) {
          return(.project_warmup_skip("Sin validacion local que hidratar."))
        }
        .project_warmup_ready("Flags de validacion hidratados.", flags)
      }
    ),
    list(
      id = "codificacion",
      module = "Codificacion",
      run = function(sid, remaining_ms) {
        s <- session_get(sid)
        flags <- list(
          familias_generated = isTRUE(s$codif_familias_generated),
          familias_loaded = isTRUE(s$codif_familias_loaded),
          plantilla_template = isTRUE(s$codif_plantilla_template),
          aplicado = isTRUE(s$codif_aplicado)
        )
        if (!any(unlist(flags, use.names = FALSE))) {
          return(.project_warmup_skip("Sin estado de codificacion local que preparar."))
        }
        .project_warmup_ready("Estado de codificacion disponible.", flags)
      }
    ),
    list(
      id = "analitica",
      module = "Analitica",
      run = function(sid, remaining_ms) {
        s <- session_get(sid)
        flags <- list(
          prep_ok = isTRUE(s$analitica_prep_ok),
          frecuencias_ok = isTRUE(s$analitica_frecuencias_ok),
          cruces_ok = isTRUE(s$analitica_cruces_ok),
          panel_ok = isTRUE(s$analitica_panel_ok),
          multibase_ok = isTRUE(s$analitica_multibase_ok)
        )
        if (!any(unlist(flags, use.names = FALSE))) {
          return(.project_warmup_skip("Sin caches analiticos locales persistidos."))
        }
        .project_warmup_ready("Estado analitico disponible.", flags)
      }
    ),
    list(
      id = "graficos",
      module = "Graficos",
      run = function(sid, remaining_ms) {
        s <- session_get(sid)
        has_config <- is.list(s$graficos_config) || is.list(s$graficos_plan) ||
          isTRUE(s$graficos_ppt_ok) || isTRUE(s$graficos_word_ok)
        if (!isTRUE(has_config)) {
          return(.project_warmup_skip("Sin configuracion local de graficos que hidratar."))
        }
        .project_warmup_ready("Configuracion local de graficos disponible.", list(
          ppt_ok = isTRUE(s$graficos_ppt_ok),
          word_ok = isTRUE(s$graficos_word_ok)
        ))
      }
    ),
    list(
      id = "hojas_ruta",
      module = "Hojas de ruta",
      run = function(sid, remaining_ms) {
        if (!exists(".hojas_ruta_state_payload", mode = "function")) {
          return(.project_warmup_skip("Modulo no disponible."))
        }
        state <- .hojas_ruta_state_payload(sid)
        .project_warmup_ready("Estado y frame local de hojas de ruta listos.", list(
          has_data = isTRUE(state$has_data),
          frame_ok = isTRUE(state$frame_meta$ok),
          n_territories = length(state$territories %||% list()),
          active_phase = state$active_phase %||% NULL
        ))
      }
    ),
    list(
      id = "hojas_ruta_cartografia",
      module = "Hojas de ruta / mapas",
      run = function(sid, remaining_ms) {
        .project_warmup_hojas_ruta_cartography(sid, remaining_ms = remaining_ms)
      }
    ),
    list(
      id = "calc_muestra",
      module = "Calculo de muestra",
      run = function(sid, remaining_ms) {
        if (!exists(".cm_state_payload", mode = "function")) {
          return(.project_warmup_skip("Modulo no disponible."))
        }
        state <- .cm_state_payload(sid)
        .project_warmup_ready("Estado de calculo de muestra hidratado.", list(
          has_estudio = is.list(state$estudio),
          has_aulas_frame = !is.null(state$aulas$frame),
          has_selection = !is.null(state$aulas$selection)
        ))
      }
    ),
    list(
      id = "monitoreo",
      module = "Monitoreo",
      run = function(sid, remaining_ms) {
        .project_warmup_monitoreo(sid, remaining_ms = remaining_ms)
      }
    ),
    list(
      id = "monitoreo_territorial",
      module = "Monitoreo territorial",
      run = function(sid, remaining_ms) {
        .project_warmup_monitoreo_territorial(sid)
      }
    ),
    list(
      id = "dashboard",
      module = "Dashboard",
      run = function(sid, remaining_ms) {
        if (!exists(".dashboard_manifest", mode = "function")) {
          return(.project_warmup_skip("Dashboard no disponible."))
        }
        s <- session_get(sid)
        manifest <- .dashboard_manifest(s)
        source <- if (exists(".dashboard_source_payload", mode = "function")) {
          tryCatch(.dashboard_source_payload(s), error = function(e) NULL)
        } else {
          NULL
        }
        .project_warmup_ready("Manifest de dashboard hidratado.", list(
          tabs = names(manifest %||% list()),
          has_source = is.list(source)
        ))
      }
    ),
    list(
      id = "editor_xlsform",
      module = "Editor XLSForm",
      run = function(sid, remaining_ms) {
        s <- session_get(sid)
        if (is.null(s$xlsform_state)) {
          return(.project_warmup_skip("Sin XLSForm editable guardado en el proyecto."))
        }
        .project_warmup_ready("Estado del editor XLSForm disponible.", list(
          has_workbook = is.list(s$xlsform_state$workbook %||% NULL)
        ))
      }
    ),
    list(
      id = "enciclopedia",
      module = "Enciclopedia",
      run = function(sid, remaining_ms) {
        if (!exists(".enc_load", mode = "function")) {
          return(.project_warmup_skip("Catalogos metodologicos no disponibles."))
        }
        catalogo <- .enc_load("catalogo_metodologias.json")
        glosario <- .enc_load("glosario.json")
        .project_warmup_ready("Catalogos metodologicos leidos desde disco.", list(
          n_metodologias = length(catalogo$metodologias %||% list()),
          n_glosario = length(glosario$terminos %||% list())
        ))
      }
    )
  )
}

.project_warmup_execute_task <- function(task, sid, remaining_ms) {
  task_started <- Sys.time()
  tryCatch({
    raw <- task$run(sid, remaining_ms)
    status <- as.character(raw$status %||% "ready")
    if (!status %in% c("ready", "skipped", "timeout", "error")) status <- "ready"
    details <- raw$details %||% raw
    details$status <- NULL
    details$message <- NULL
    details$session_patch <- NULL
    item <- .project_warmup_item(
      id = task$id,
      module = task$module,
      status = status,
      started_at = task_started,
      message = raw$message %||% NULL,
      details = details
    )
    list(item = item, session_patch = raw$session_patch %||% NULL)
  }, error = function(e) {
    list(
      item = .project_warmup_item(
        id = task$id,
        module = task$module,
        status = "error",
        started_at = task_started,
        message = "No se pudo preparar este modulo.",
        details = list(),
        error = .project_warmup_compact(conditionMessage(e), 220)
      ),
      session_patch = NULL
    )
  })
}

.project_warmup_run <- function(sid,
                                mode = "full",
                                budget_ms = .project_warmup_default_budget_ms,
                                modules = NULL,
                                progress_path = NULL) {
  mode <- .project_warmup_mode(mode)
  budget_ms <- .project_warmup_budget_ms(budget_ms)
  started_at <- Sys.time()
  report <- if (!is.null(progress_path)) job_progress_writer(progress_path) else function(...) invisible(NULL)
  tasks <- .project_warmup_tasks()
  module_ids <- unique(as.character(unlist(modules %||% character(0), use.names = FALSE)))
  module_ids <- module_ids[nzchar(module_ids)]
  if (length(module_ids)) {
    tasks <- Filter(function(task) task$id %in% module_ids, tasks)
    if (!length(tasks)) tasks <- .project_warmup_tasks()[1]
  }
  total <- length(tasks)
  results <- list()
  session_patch <- list()

  report("running", current = 0L, total = total, percent = 1, message = "Preparando proyecto local...")
  for (idx in seq_along(tasks)) {
    elapsed <- .project_warmup_elapsed_ms(started_at)
    remaining <- budget_ms - elapsed
    if (remaining <= 0) {
      for (j in idx:length(tasks)) {
        t <- tasks[[j]]
        results[[t$id]] <- .project_warmup_item(
          id = t$id,
          module = t$module,
          status = "timeout",
          started_at = Sys.time(),
          message = "Quedo para background al agotarse el presupuesto inicial.",
          details = list()
        )
      }
      break
    }

    report(
      "running",
      current = idx,
      total = total,
      percent = round(5 + 90 * (idx - 1) / max(total, 1L)),
      message = sprintf("Preparando %s...", tasks[[idx]]$module)
    )
    executed <- .project_warmup_execute_task(tasks[[idx]], sid, remaining_ms = remaining)
    results[[tasks[[idx]]$id]] <- executed$item
    if (is.list(executed$session_patch) && length(executed$session_patch)) {
      session_patch[[tasks[[idx]]$id]] <- executed$session_patch
    }
  }

  status_values <- vapply(results, function(item) as.character(item$status %||% ""), character(1))
  report(
    "done",
    current = length(results),
    total = total,
    percent = 100,
    message = "Warmup inicial completado."
  )
  list(
    ok = TRUE,
    kind = "project.warmup",
    mode = mode,
    budget_ms = budget_ms,
    project_path = session_get(sid)$project_path %||% "",
    elapsed_ms = .project_warmup_elapsed_ms(started_at),
    complete = !any(status_values %in% c("timeout", "error")),
    tasks = unname(results),
    session_patch = session_patch
  )
}

.project_warmup_job <- function(session_path,
                                mode = "full",
                                budget_ms = .project_warmup_default_budget_ms,
                                modules = NULL,
                                progress_path = NULL) {
  s <- readRDS(session_path)
  sid <- as.character(s$id %||% "")
  if (!nzchar(sid)) stop("Sesion invalida para warmup de proyecto.", call. = FALSE)
  .session_env[[sid]] <- s
  .project_warmup_run(
    sid = sid,
    mode = mode,
    budget_ms = budget_ms,
    modules = modules,
    progress_path = progress_path
  )
}
attr(.project_warmup_job, "prosecnur_job_function_name") <- ".project_warmup_job"

.project_warmup_public_result <- function(result) {
  if (!is.list(result)) return(result)
  result$session_patch <- NULL
  result
}

.project_warmup_flatten_session_patch <- function(patch = list()) {
  if (!is.list(patch) || !length(patch)) return(list())
  flat <- list()
  merge_child <- function(key, value) {
    if (!is.list(value) || !length(value)) return(invisible(NULL))
    current <- flat[[key]] %||% list()
    flat[[key]] <<- utils::modifyList(current, value, keep.null = TRUE)
    invisible(NULL)
  }
  collect_patch <- function(value) {
    if (!is.list(value) || !length(value)) return(invisible(NULL))
    monitoreo_keys <- c(
      "monitoreo_dashboard_light_cache",
      "monitoreo_dashboard_light_cache_token",
      "monitoreo_dashboard_cache_source",
      "monitoreo_dashboard_cache_token_source",
      "monitoreo_dashboard_cache_advance_summary",
      "monitoreo_dashboard_cache_token_advance_summary",
      "monitoreo_dashboard_cache_queries_summary",
      "monitoreo_dashboard_cache_token_queries_summary"
    )
    territorial_keys <- c("territorial_report_cache", "territorial_map_cache")
    if (any(monitoreo_keys %in% names(value))) {
      merge_child("monitoreo", value)
    }
    if (any(territorial_keys %in% names(value))) {
      merge_child("monitoreo_territorial", value)
    }
    merge_child("monitoreo", value$monitoreo %||% NULL)
    territorial <- value$monitoreo_territorial %||% NULL
    if (is.list(territorial)) {
      if (any(territorial_keys %in% names(territorial))) {
        merge_child("monitoreo_territorial", territorial)
      } else {
        collect_patch(territorial)
      }
    }
    invisible(NULL)
  }
  collect_patch(patch)
  for (module_patch in patch) {
    collect_patch(module_patch)
  }
  flat
}

.project_warmup_merge_session_patch <- function(sid, patch = list()) {
  patch <- .project_warmup_flatten_session_patch(patch)
  if (!is.list(patch) || !length(patch)) return(FALSE)
  changed <- FALSE
  monitoreo <- patch$monitoreo %||% list()
  if (is.list(monitoreo) && length(monitoreo)) {
    s_current <- session_get(sid)
    cache_keys <- c(
      "monitoreo_dashboard_light_cache",
      "monitoreo_dashboard_light_cache_token",
      "monitoreo_dashboard_cache_source",
      "monitoreo_dashboard_cache_token_source",
      "monitoreo_dashboard_cache_advance_summary",
      "monitoreo_dashboard_cache_token_advance_summary",
      "monitoreo_dashboard_cache_queries_summary",
      "monitoreo_dashboard_cache_token_queries_summary"
    )
    for (key in cache_keys) {
      if (key %in% names(monitoreo) && !is.null(monitoreo[[key]])) {
        s_current[[key]] <- monitoreo[[key]]
        changed <- TRUE
      }
    }
    .session_env[[sid]] <- s_current
  }
  territorial <- patch$monitoreo_territorial %||% list()
  if (is.list(territorial) && length(territorial)) {
    s_current <- session_get(sid)
    incoming_report_cache <- territorial$territorial_report_cache %||% NULL
    if (is.list(incoming_report_cache) &&
        exists(".monitoreo_territorial_report_cache_merge", mode = "function")) {
      snapshot_current <- s_current$monitoreo_snapshot %||% list()
      snapshot_current <- .monitoreo_territorial_report_cache_merge(
        snapshot_current,
        incoming_report_cache
      )
      session_set(sid, "monitoreo_snapshot", snapshot_current)
      changed <- TRUE
      s_current <- session_get(sid)
    }
    incoming_map_cache <- territorial$territorial_map_cache %||% NULL
    if (is.list(incoming_map_cache) &&
        exists(".monitoreo_territorial_map_cache_merge", mode = "function")) {
      merged_map_cache <- .monitoreo_territorial_map_cache_merge(
        s_current$monitoreo_territorial_map_cache %||% list(),
        incoming_map_cache
      )
      session_set(sid, "monitoreo_territorial_map_cache", merged_map_cache)
      changed <- TRUE
    }
  }
  changed
}

.project_warmup_on_complete <- function(j) {
  result <- j$result_data
  if (!is.list(result)) return(result)
  current <- session_get(j$sid, required = FALSE)
  result_project_path <- as.character(result$project_path %||% "")
  current_project_path <- as.character(current$project_path %||% "")
  if (is.null(current) ||
      (nzchar(result_project_path) && nzchar(current_project_path) && !identical(result_project_path, current_project_path))) {
    result$merge_skipped <- TRUE
    result$merge_reason <- "El proyecto activo cambio antes de terminar el warmup."
    return(.project_warmup_public_result(result))
  }
  changed <- .project_warmup_merge_session_patch(j$sid, result$session_patch %||% list())
  if (isTRUE(changed) && exists(".monitoreo_mark_project_dirty_if_open", mode = "function")) {
    tryCatch(.monitoreo_mark_project_dirty_if_open(j$sid), error = function(e) NULL)
  }
  .project_warmup_public_result(result)
}

.project_warmup_start <- function(sid, mode = "full", budget_ms = .project_warmup_default_budget_ms, modules = NULL) {
  s <- session_get(sid)
  if (is.null(s$project_path) || !nzchar(s$project_path)) {
    stop_api(409, "E_NO_PROJECT", "Abre o crea un proyecto .pulso antes de precargar la app.")
  }
  mode <- .project_warmup_mode(mode)
  budget_ms <- .project_warmup_budget_ms(budget_ms)
  module_ids <- unique(as.character(unlist(modules %||% character(0), use.names = FALSE)))
  module_ids <- module_ids[nzchar(module_ids) & module_ids %in% vapply(.project_warmup_tasks(), `[[`, character(1), "id")]
  session_path <- job_save_rds(sid, "project_warmup_session", s)
  job_id <- tryCatch(
    job_submit(
      sid = sid,
      kind = "project.warmup",
      func = .project_warmup_job,
      args = list(
        session_path = session_path,
        mode = mode,
        budget_ms = budget_ms,
        modules = module_ids
      ),
      on_complete = .project_warmup_on_complete
    ),
    error = function(e) e
  )
  if (inherits(job_id, "error")) {
    job_id <- job_submit_completed(
      sid = sid,
      kind = "project.warmup",
      result_data = list(),
      status = "error",
      error = conditionMessage(job_id)
    )
  }
  list(ok = TRUE, job_id = job_id, kind = "project.warmup")
}
