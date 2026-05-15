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

.hojas_ruta_ui_state_normalize <- function(ui = list(), cfg = NULL) {
  if (is.null(ui) || !is.list(ui)) ui <- list()
  if (is.null(cfg)) cfg <- hojas_ruta_integrada_normalize_config(list())

  stages <- c("territorio", "poblacion", "muestra", "manzanas", "entrega")
  active_stage <- .hojas_ruta_scalar(ui$active_stage %||% ui$activeStage,
                                     "territorio")
  if (!active_stage %in% stages) active_stage <- "territorio"

  frame <- tryCatch(hojas_ruta_inei_frame(), error = function(e) NULL)
  allowed_ubigeos <- if (!is.null(frame)) unique(frame$ubigeo) else character(0)

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
  if (nzchar(map_zona) && !is.null(frame) && nrow(frame) && nzchar(map_ubigeo)) {
    allowed_zones <- unique(as.character(frame$zona[frame$ubigeo == map_ubigeo]))
    if (!map_zona %in% allowed_zones) map_zona <- ""
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

.hojas_ruta_workspace_outputs_normalize <- function(outputs = list()) {
  if (is.null(outputs) || !is.list(outputs)) outputs <- list()
  out <- list(
    population = outputs$population %||% outputs$population_preview %||% outputs$populationPreview %||% NULL,
    sample_size_preview = outputs$sample_size_preview %||% outputs$sampleSizePreview %||% NULL,
    quota = outputs$quota %||% outputs$quota_preview %||% outputs$quotaPreview %||% NULL,
    sample = outputs$sample %||% outputs$sample_preview %||% outputs$samplePreview %||% NULL
  )
  Filter(Negate(is.null), out)
}

.hojas_ruta_workspace_outputs_update <- function(sid, patch = list(), clear = character()) {
  current <- .hojas_ruta_workspace_outputs_normalize(
    session_get(sid)$hojas_ruta_workspace_outputs %||% list()
  )
  if (length(clear)) {
    current[intersect(names(current), clear)] <- NULL
  }
  if (length(patch)) {
    for (name in names(patch)) {
      current[[name]] <- patch[[name]]
    }
  }
  current <- .hojas_ruta_workspace_outputs_normalize(current)
  session_set(sid, "hojas_ruta_workspace_outputs", current)
  current
}

.hojas_ruta_state_payload <- function(sid) {
  data <- tryCatch(.hojas_ruta_data_activa(sid), error = function(e) NULL)
  s <- session_get(sid)
  legacy_cfg <- hojas_ruta_normalize_config(s$hojas_ruta_config %||% list())
  cfg <- hojas_ruta_integrada_normalize_config(s$hojas_ruta_config %||% list())
  ui_state <- .hojas_ruta_ui_state_normalize(s$hojas_ruta_ui_state %||% list(), cfg)
  workspace_outputs <- .hojas_ruta_workspace_outputs_normalize(s$hojas_ruta_workspace_outputs %||% list())
  frame <- tryCatch(hojas_ruta_inei_frame(), error = function(e) NULL)
  frame_meta <- if (!is.null(frame)) .hojas_ruta_frame_meta(frame) else list(ok = FALSE)
  territories <- if (!is.null(frame)) .hojas_ruta_territories(frame) else list()
  if (is.null(data)) {
    return(list(
      ok = isTRUE(frame_meta$ok),
      has_data = FALSE,
      cache_dir = hojas_ruta_cache_dir(),
      config = legacy_cfg,
      integrated_config = cfg,
      ui_state = ui_state,
      workspace_outputs = workspace_outputs,
      frame_meta = frame_meta,
      territories = territories,
      campos = NULL,
      variables = list()
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
    frame_meta = frame_meta,
    territories = territories,
    campos = campos,
    variables = hojas_ruta_variables_disponibles(data)
  )
}

mount_hojas_ruta <- function(pr) {
  pr |>
    plumber::pr_get("/api/hojas-ruta/state", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      .hojas_ruta_state_payload(sid)
    })) |>
    plumber::pr_post("/api/hojas-ruta/config", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_normalize_config(parsed$config %||% parsed)
      session_set(sid, "hojas_ruta_config", cfg)
      list(ok = TRUE, config = cfg)
    })) |>
    plumber::pr_post("/api/hojas-ruta/workspace", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      current <- session_get(sid)$hojas_ruta_config %||% list()
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
          session_get(sid)$hojas_ruta_workspace_outputs %||% list()
        )
      }
      session_set(sid, "hojas_ruta_config", cfg)
      session_set(sid, "hojas_ruta_ui_state", ui_state)
      session_set(sid, "hojas_ruta_workspace_outputs", workspace_outputs)
      list(ok = TRUE, integrated_config = cfg, ui_state = ui_state, workspace_outputs = workspace_outputs)
    })) |>
    plumber::pr_post("/api/hojas-ruta/preview", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_normalize_config(parsed$config %||% parsed)
      data <- .hojas_ruta_data_activa(sid)
      session_set(sid, "hojas_ruta_config", cfg)
      hojas_ruta_preview(data, cfg)
    })) |>
    plumber::pr_post("/api/hojas-ruta/population-preview", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_integrada_normalize_config(parsed$config %||% parsed)
      session_set(sid, "hojas_ruta_config", cfg)
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
      session_set(sid, "hojas_ruta_config", cfg)
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
      session_set(sid, "hojas_ruta_config", cfg)
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
      session_set(sid, "hojas_ruta_config", cfg)
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
      session_set(sid, "hojas_ruta_config", cfg)
      result <- hojas_ruta_sample_preview_integrado(cfg)
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
      session_set(sid, "hojas_ruta_config", cfg)
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
    plumber::pr_post("/api/hojas-ruta/generate", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_integrada_normalize_config(parsed$config %||% parsed)
      session_set(sid, "hojas_ruta_config", cfg)
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
    }))
}
