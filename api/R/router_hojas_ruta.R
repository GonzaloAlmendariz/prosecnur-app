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
  reporte_meta_raw <- s$hojas_ruta_reporte_decisional %||% list(disponible = FALSE)
  reporte_meta <- list(
    disponible   = isTRUE(reporte_meta_raw$disponible),
    generated_at = reporte_meta_raw$generated_at %||% NULL,
    formato      = reporte_meta_raw$formato %||% NULL,
    job_id       = reporte_meta_raw$job_id %||% NULL
  )
  has_sample_size <- !is.null(workspace_outputs$sample_size_preview)
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
    plumber::pr_post("/api/hojas-ruta/manual-replacements-pdf", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_integrada_normalize_config(parsed$config %||% parsed)
      session_set(sid, "hojas_ruta_config", cfg)
      outputs <- .hojas_ruta_workspace_outputs_normalize(
        session_get(sid)$hojas_ruta_workspace_outputs %||% list()
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
      s <- session_get(sid)
      cfg <- hojas_ruta_integrada_normalize_config(s$hojas_ruta_config %||% list())
      outputs <- .hojas_ruta_workspace_outputs_normalize(
        s$hojas_ruta_workspace_outputs %||% list()
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
