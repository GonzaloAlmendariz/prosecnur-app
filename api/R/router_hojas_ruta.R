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

  list(
    active_stage = active_stage,
    draft_territories = as.list(draft),
    map_ubigeo = map_ubigeo,
    map_zona = map_zona,
    map_level = map_level,
    map_selection_mode = .hojas_ruta_bool(
      ui$map_selection_mode %||% ui$mapSelectionMode,
      FALSE
    )
  )
}

.hojas_ruta_state_payload <- function(sid) {
  data <- tryCatch(.hojas_ruta_data_activa(sid), error = function(e) NULL)
  s <- session_get(sid)
  legacy_cfg <- hojas_ruta_normalize_config(s$hojas_ruta_config %||% list())
  cfg <- hojas_ruta_integrada_normalize_config(s$hojas_ruta_config %||% list())
  ui_state <- .hojas_ruta_ui_state_normalize(s$hojas_ruta_ui_state %||% list(), cfg)
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
      session_set(sid, "hojas_ruta_config", cfg)
      session_set(sid, "hojas_ruta_ui_state", ui_state)
      list(ok = TRUE, integrated_config = cfg, ui_state = ui_state)
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
      hojas_ruta_population_preview_integrado(cfg)
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
      hojas_ruta_quota_preview_integrado(cfg)
    })) |>
    plumber::pr_post("/api/hojas-ruta/sample-size-preview", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_integrada_normalize_config(parsed$config %||% parsed)
      session_set(sid, "hojas_ruta_config", cfg)
      hojas_ruta_sample_size_preview(cfg)
    })) |>
    plumber::pr_post("/api/hojas-ruta/sample-preview", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_integrada_normalize_config(parsed$config %||% parsed)
      session_set(sid, "hojas_ruta_config", cfg)
      hojas_ruta_sample_preview_integrado(cfg)
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

      cfg_path <- job_save_rds(sid, "hojas_ruta_config", cfg)
      api_path <- .app_api_dir()

      job_id <- job_submit(
        sid = sid,
        kind = "hojas_ruta.generate",
        func = function(cfg_path, api_path, result_path, progress_path = NULL) {
          if (requireNamespace("pkgload", quietly = TRUE)) {
            pkgload::load_all(api_path, quiet = TRUE)
          } else if (requireNamespace("devtools", quietly = TRUE)) {
            devtools::load_all(api_path, quiet = TRUE)
          }
          cfg <- readRDS(cfg_path)
          hojas_ruta_generar_zip_integrado(cfg, result_path, progress_path = progress_path)
        },
        args = list(cfg_path = cfg_path, api_path = api_path),
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
            n_zones = as.integer(j$result_data$n_zones %||% 0L),
            total_entrevistas = as.integer(j$result_data$total_entrevistas %||% 0L),
            frame_version = j$result_data$frame_version %||% NA_character_,
            alerts = j$result_data$alerts %||% list(),
            mapas_faltantes = 0L
          )
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "hojas_ruta.generate")
    }))
}
