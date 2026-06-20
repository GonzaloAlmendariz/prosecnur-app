# =============================================================================
# Endpoints HTTP del módulo "Calculador de Muestra" (calc-muestra)
# =============================================================================
#
# Implementa la API canónica del nuevo calculador multi-componente.
# Patrón espejo de `router_muestra_aulas.R`: el router orquesta, la lógica
# vive en `calc_muestra_engine.R` y la generación de reporte en
# `reporte_calc_muestra.R`.
#
# Endpoints:
#   GET  /api/calc-muestra/state               — snapshot completo
#   POST /api/calc-muestra/estudio             — crea/actualiza el estudio
#   POST /api/calc-muestra/componente          — CRUD de componente (add/update)
#   DELETE /api/calc-muestra/componente        — elimina componente
#   POST /api/calc-muestra/calcular            — ejecuta cálculo
#   POST /api/calc-muestra/recomendar          — recomienda técnica
#   POST /api/calc-muestra/iniciar-estudio     — inicia estudio por tipo
#   POST /api/calc-muestra/modo-trabajo        — transición de modo
#   POST /api/calc-muestra/marco/config        — configura marco de aulas
#   POST /api/calc-muestra/marco/construir     — construye marco de aulas
#   POST /api/calc-muestra/aulas/comparar-metodos — compara motores
#   POST /api/calc-muestra/aulas/seleccionar   — selecciona aulas M1..Mk
#   POST /api/calc-muestra/aulas/simular-reemplazos — simula reservas
#   POST /api/calc-muestra/aulas/exportar      — exporta workbook de seleccion
#   POST /api/calc-muestra/reporte             — encola job Quarto
#   GET  /api/calc-muestra/reporte/descargar   — descarga reporte binario
#
# El seguimiento de campo y el cierre con brechas viven en el módulo
# Monitoreo (/api/monitoreo/*).

.cm_parse_body <- function(req) {
  raw <- if (!is.null(req$bodyRaw) && length(req$bodyRaw) > 0L) {
    rawToChar(req$bodyRaw)
  } else {
    req$postBody %||% ""
  }
  if (!nzchar(raw)) return(list())
  tryCatch(
    jsonlite::fromJSON(raw, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_BAD_JSON", "Body JSON inválido.")
  )
}

.cm_table_from_payload <- function(sid, body, key) {
  direct <- body[[key]] %||% NULL
  if (!is.null(direct)) return(.cm_aulas_as_df(direct, key))
  file_key <- paste0(key, "_file_id")
  file_id <- calc_str(body[[file_key]] %||% body[[paste0(key, "FileId")]], "")
  if (!nzchar(file_id)) return(data.frame(stringsAsFactors = FALSE))
  meta <- get_file(sid, file_id)
  sheet <- body[[paste0(key, "_sheet")]] %||% body[[paste0(key, "Sheet")]] %||% NULL
  .cm_aulas_read_table(meta$path, sheet = sheet)
}

.cm_state_payload <- function(sid) {
  s <- session_get(sid)
  estudio <- s$calc_muestra_estudio %||% calc_muestra_normalize_estudio(list())
  reporte_meta <- s$calc_muestra_reporte %||% list(disponible = FALSE)
  list(
    estudio = estudio,
    aulas = list(
      config = s$calc_muestra_aulas_config %||% calc_muestra_aulas_default_config(),
      frame = s$calc_muestra_aulas_frame %||% NULL,
      selection = s$calc_muestra_aulas_selection %||% NULL,
      method_comparison = s$calc_muestra_aulas_method_comparison %||% NULL,
      replacement_simulation = s$calc_muestra_aulas_replacement_simulation %||% NULL,
      export = s$calc_muestra_aulas_export %||% NULL
    ),
    reporte = list(
      disponible    = isTRUE(reporte_meta$disponible),
      generated_at  = reporte_meta$generated_at %||% NULL,
      formato       = reporte_meta$formato %||% NULL,
      job_id        = reporte_meta$job_id %||% NULL
    )
  )
}

mount_calc_muestra <- function(pr) {
  pr |>
    # -----------------------------------------------------------------------
    # GET /api/calc-muestra/state — snapshot completo del módulo
    # -----------------------------------------------------------------------
    plumber::pr_get("/api/calc-muestra/state",
                    wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      .cm_state_payload(sid)
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/estudio — crea/actualiza el estudio completo
    # Body: { estudio: {...} }
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/estudio",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      input <- body$estudio %||% body
      estudio <- calc_muestra_normalize_estudio(input)
      session_set(sid, "calc_muestra_estudio", estudio)
      session_set(sid, "calc_muestra_reporte", list(disponible = FALSE))
      list(ok = TRUE, estudio = estudio)
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/componente — add o update de un componente
    # Body: { componente: {...}, op: "add"|"update" }
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/componente",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      op <- calc_str(body$op, "add")
      input <- body$componente %||% list()
      comp <- calc_muestra_normalize_componente(input)
      s <- session_get(sid)
      estudio <- s$calc_muestra_estudio %||% calc_muestra_normalize_estudio(list())
      comps <- estudio$componentes
      if (identical(op, "update") && nzchar(comp$id)) {
        ids <- vapply(comps, function(c) c$id, character(1))
        idx <- match(comp$id, ids)
        if (is.na(idx)) {
          comps <- c(comps, list(comp))
        } else {
          comps[[idx]] <- comp
        }
      } else {
        if (!nzchar(comp$id)) comp$id <- paste0("cmp-",
                                                 paste(sample(c(0:9, letters), 8,
                                                              replace = TRUE),
                                                       collapse = ""))
        comps <- c(comps, list(comp))
      }
      estudio$componentes <- comps
      session_set(sid, "calc_muestra_estudio", estudio)
      session_set(sid, "calc_muestra_reporte", list(disponible = FALSE))
      list(ok = TRUE, componente = comp, estudio = estudio)
    })) |>

    # -----------------------------------------------------------------------
    # DELETE /api/calc-muestra/componente — elimina componente por id
    # Body: { id: "cmp-xxxxxxxx" }
    # -----------------------------------------------------------------------
    plumber::pr_delete("/api/calc-muestra/componente",
                       wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      cid <- calc_str(body$id, "")
      if (!nzchar(cid)) {
        stop_api(400, "E_NO_ID", "Falta id del componente a eliminar.")
      }
      s <- session_get(sid)
      estudio <- s$calc_muestra_estudio %||% calc_muestra_normalize_estudio(list())
      ids <- vapply(estudio$componentes, function(c) c$id, character(1))
      estudio$componentes <- estudio$componentes[ids != cid]
      session_set(sid, "calc_muestra_estudio", estudio)
      session_set(sid, "calc_muestra_reporte", list(disponible = FALSE))
      list(ok = TRUE, estudio = estudio)
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/calcular — ejecuta cálculo para todos los componentes
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/calcular",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      estudio <- s$calc_muestra_estudio
      if (is.null(estudio)) {
        stop_api(409, "E_SIN_ESTUDIO",
                 "No hay estudio cargado. Crea uno antes de calcular.")
      }
      estudio_calc <- calc_muestra_calcular_estudio(estudio)
      session_set(sid, "calc_muestra_estudio", estudio_calc)
      session_set(sid, "calc_muestra_reporte", list(disponible = FALSE))
      list(ok = TRUE, estudio = estudio_calc)
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/recomendar — recomienda técnica para un diagnostico
    # Body: { diagnostico: {...} }
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/recomendar",
                     wrap_endpoint(function(req, res, ...) {
      body <- .cm_parse_body(req)
      diag <- body$diagnostico %||% body
      list(ok = TRUE, recomendacion = calc_muestra_recomendar(diag))
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/iniciar-estudio — inicia estudio por tipo
    # Body: { tipo: "acreditacion"|"hsvg_universitario"|"territorial"|
    #              "linea_base_servicios"|"listado_telefonico"|"estudio_propio",
    #         variante: "vacio"|"modelo_universitario" }
    # La UI solo ofrece plantillas calculables. `territorial` y
    # `listado_telefonico` se conservan por compatibilidad legacy.
    # Reemplaza los componentes del estudio actual con la estructura del tipo.
    # Por defecto crea componentes vacíos que el usuario completa por UI.
    # La variante universitaria de referencia pre-puebla estratos editables
    # de facultades como punto de partida, sin acoplar el motor a una institución.
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/iniciar-estudio",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      tipo <- calc_str(body$tipo, "estudio_propio")
      variante <- calc_str(body$variante, "vacio")
      iniciado <- calc_muestra_iniciar_estudio(tipo, variante)
      s <- session_get(sid)
      estudio <- s$calc_muestra_estudio %||% calc_muestra_normalize_estudio(list())
      estudio$macro_familia <- iniciado$macro_familia
      estudio$componentes <- iniciado$componentes
      session_set(sid, "calc_muestra_estudio", estudio)
      session_set(sid, "calc_muestra_reporte", list(disponible = FALSE))
      list(ok = TRUE, estudio = estudio)
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/modo-trabajo — alterna entre estimación
    # preliminar (propuesta inicial sin bases finales) y diseño validado
    # (propuesta cerrada con marcos confirmados).
    # Body: { modo: "estimacion_preliminar"|"diseno_validado" }
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/modo-trabajo",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      modo <- calc_enum(body$modo,
                        c("estimacion_preliminar", "diseno_validado"),
                        "estimacion_preliminar")
      s <- session_get(sid)
      estudio <- s$calc_muestra_estudio %||% calc_muestra_normalize_estudio(list())
      estudio$modo_trabajo <- modo
      session_set(sid, "calc_muestra_estudio", estudio)
      list(ok = TRUE, modo_trabajo = modo, estudio = estudio)
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/marco/config — guarda configuracion de marco
    # Body: { config: {...} }
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/marco/config",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      config <- calc_muestra_aulas_normalize_config(body$config %||% body)
      session_set(sid, "calc_muestra_aulas_config", config)
      list(ok = TRUE, config = config, state = .cm_state_payload(sid))
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/marco/construir — construye marco de aulas
    # Body: { base_madre|base_madre_file_id, estudiantes|estudiantes_file_id,
    #         inscripciones|inscripciones_file_id, config }
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/marco/construir",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      s <- session_get(sid)
      config <- calc_muestra_aulas_normalize_config(body$config %||% s$calc_muestra_aulas_config %||% list())
      base_madre <- .cm_table_from_payload(sid, body, "base_madre")
      estudiantes <- .cm_table_from_payload(sid, body, "estudiantes")
      inscripciones <- .cm_table_from_payload(sid, body, "inscripciones")
      frame <- tryCatch(
        calc_muestra_aulas_construir(
          base_madre = base_madre,
          estudiantes = estudiantes,
          inscripciones = inscripciones,
          config = config
        ),
        error = function(e) stop_api(400, "E_CALC_MUESTRA_AULAS_FRAME", conditionMessage(e))
      )
      session_set(sid, "calc_muestra_aulas_config", frame$config)
      session_set(sid, "calc_muestra_aulas_frame", frame)
      session_set(sid, "calc_muestra_aulas_selection", NULL)
      session_set(sid, "calc_muestra_aulas_method_comparison", NULL)
      session_set(sid, "calc_muestra_aulas_replacement_simulation", NULL)
      session_set(sid, "calc_muestra_aulas_export", NULL)
      list(ok = TRUE, frame = frame, state = .cm_state_payload(sid))
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/aulas/comparar-metodos — laboratorio comparativo
    # Body: { config?: {...}, frame?: {...}, methods?: [], simulation_runs?: n }
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/aulas/comparar-metodos",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      s <- session_get(sid)
      frame <- body$frame %||% s$calc_muestra_aulas_frame %||% NULL
      if (is.null(frame)) {
        stop_api(409, "E_SIN_MARCO_AULAS", "Construye el marco de aulas antes de comparar métodos.")
      }
      base_config <- frame$config %||% s$calc_muestra_aulas_config %||% list()
      config_input <- body$config %||% base_config
      if (!is.null(body$objective_config) || !is.null(body$objetivo_representatividad)) {
        config_input$objective <- body$objective_config %||% body$objetivo_representatividad
      }
      config <- calc_muestra_aulas_normalize_config(config_input)
      comparison <- tryCatch(
        calc_muestra_aulas_comparar_metodos(
          frame,
          config,
          methods = body$methods %||% body$metodos %||% NULL,
          simulation_runs = body$simulation_runs %||% body$simulaciones %||% NULL
        ),
        error = function(e) stop_api(400, "E_CALC_MUESTRA_AULAS_COMPARE", conditionMessage(e))
      )
      session_set(sid, "calc_muestra_aulas_config", config)
      session_set(sid, "calc_muestra_aulas_method_comparison", comparison)
      session_set(sid, "calc_muestra_aulas_export", NULL)
      list(ok = TRUE, comparison = comparison, state = .cm_state_payload(sid))
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/aulas/seleccionar — selecciona M1 y reemplazos
    # Body: { config?: {...}, frame?: {...}, method_id?: "cube_balanceado" }
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/aulas/seleccionar",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      s <- session_get(sid)
      frame <- body$frame %||% s$calc_muestra_aulas_frame %||% NULL
      if (is.null(frame)) {
        stop_api(409, "E_SIN_MARCO_AULAS", "Construye el marco de aulas antes de seleccionar.")
      }
      base_config <- frame$config %||% s$calc_muestra_aulas_config %||% list()
      config_input <- body$config %||% base_config
      if (!is.null(body$objective_config) || !is.null(body$objetivo_representatividad)) {
        config_input$objective <- body$objective_config %||% body$objetivo_representatividad
      }
      config <- calc_muestra_aulas_normalize_config(config_input)
      method_id <- calc_str(body$method_id %||% body$selector_engine %||% body$comparison_method %||% "", "")
      if (nzchar(method_id)) {
        config$selector$selector_engine <- .cm_aulas_engine_key(method_id)
        config$selector$method_family <- .cm_aulas_method_family(config$selector$selector_engine)
      }
      selection <- tryCatch(
        calc_muestra_aulas_seleccionar(frame, config),
        error = function(e) stop_api(400, "E_CALC_MUESTRA_AULAS_SELECTION", conditionMessage(e))
      )
      comparison <- s$calc_muestra_aulas_method_comparison %||% NULL
      if (!is.null(comparison)) selection$method_comparison <- comparison
      session_set(sid, "calc_muestra_aulas_config", config)
      session_set(sid, "calc_muestra_aulas_selection", selection)
      session_set(sid, "calc_muestra_aulas_replacement_simulation", NULL)
      session_set(sid, "calc_muestra_aulas_export", NULL)
      list(ok = TRUE, selection = selection, state = .cm_state_payload(sid))
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/aulas/simular-reemplazos — impacto de reservas
    # Body: { config?: {...}, frame?: {...}, selection?: {...} }
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/aulas/simular-reemplazos",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      s <- session_get(sid)
      frame <- body$frame %||% s$calc_muestra_aulas_frame %||% NULL
      selection <- body$selection %||% s$calc_muestra_aulas_selection %||% NULL
      if (is.null(frame) || is.null(selection)) {
        stop_api(409, "E_SIN_SELECCION_AULAS", "Selecciona aulas antes de simular reemplazos.")
      }
      base_config <- frame$config %||% s$calc_muestra_aulas_config %||% list()
      config_input <- body$config %||% base_config
      if (!is.null(body$objective_config) || !is.null(body$objetivo_representatividad)) {
        config_input$objective <- body$objective_config %||% body$objetivo_representatividad
      }
      config <- calc_muestra_aulas_normalize_config(config_input)
      replacement <- tryCatch(
        calc_muestra_aulas_simular_reemplazos(frame, selection, config),
        error = function(e) stop_api(400, "E_CALC_MUESTRA_AULAS_REPLACEMENTS", conditionMessage(e))
      )
      selection$replacement_simulation <- replacement
      session_set(sid, "calc_muestra_aulas_config", config)
      session_set(sid, "calc_muestra_aulas_selection", selection)
      session_set(sid, "calc_muestra_aulas_replacement_simulation", replacement)
      session_set(sid, "calc_muestra_aulas_export", NULL)
      list(ok = TRUE, replacement_simulation = replacement, state = .cm_state_payload(sid))
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/aulas/exportar — workbook de seleccion
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/aulas/exportar",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      frame <- s$calc_muestra_aulas_frame %||% NULL
      selection <- s$calc_muestra_aulas_selection %||% NULL
      if (is.null(frame) || is.null(selection)) {
        stop_api(409, "E_SIN_SELECCION_AULAS", "Construye el marco y selecciona aulas antes de exportar.")
      }
      out_path <- tempfile("calc_muestra_aulas_", fileext = ".xlsx")
      tryCatch(
        calc_muestra_aulas_exportar_workbook(
          frame,
          selection,
          out_path,
          comparison = s$calc_muestra_aulas_method_comparison %||% NULL,
          replacement_simulation = s$calc_muestra_aulas_replacement_simulation %||% NULL
        ),
        error = function(e) stop_api(400, "E_CALC_MUESTRA_AULAS_EXPORT", conditionMessage(e))
      )
      out_name <- .export_filename(sid, "calc_muestra_aulas_seleccion", "xlsx")
      meta <- .register_output_file(sid, "calc_muestra_aulas_seleccion", out_path, original_name = out_name)
      export <- list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name, size = meta$size)
      session_set(sid, "calc_muestra_aulas_export", export)
      list(ok = TRUE, export = export, state = .cm_state_payload(sid))
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/reporte — encola job Quarto
    # Body: { formato: "html"|"pdf" }
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/reporte",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      formato <- calc_enum(body$formato, c("html", "pdf"), "html")
      s <- session_get(sid)
      estudio <- s$calc_muestra_estudio
      if (is.null(estudio) || length(estudio$componentes) == 0L) {
        stop_api(409, "E_SIN_ESTUDIO",
                 "El estudio está vacío. Agrega componentes y calcula antes de generar el reporte.")
      }
      tiene_resultados <- any(vapply(estudio$componentes,
                                     function(c) !is.null(c$resultado),
                                     logical(1)))
      if (!tiene_resultados) {
        stop_api(409, "E_SIN_RESULTADOS",
                 "Ejecuta el cálculo antes de generar el reporte.")
      }

      ext <- if (formato == "pdf") "pdf" else "html"
      filename <- sprintf("reporte_calc_muestra.%s", ext)

      sid_capt <- sid
      on_complete <- function(j) {
        if (identical(j$status, "done") &&
            !is.null(j$result_path) && file.exists(j$result_path)) {
          s_now <- session_get(sid_capt, required = FALSE)
          if (is.null(s_now)) return(j$result_data)
          meta_now <- s_now$calc_muestra_reporte %||% list()
          meta_now$disponible   <- TRUE
          meta_now$path         <- j$result_path
          meta_now$generated_at <- format(j$finished_at,
                                          "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
          session_set(sid_capt, "calc_muestra_reporte", meta_now)
        }
        j$result_data
      }

      job_id <- job_submit(
        sid    = sid,
        kind   = "calc_muestra_reporte",
        func   = calc_muestra_render_job,
        args   = list(estudio = estudio, formato = formato),
        result_filename = filename,
        on_complete = on_complete
      )

      session_set(sid, "calc_muestra_reporte", list(
        disponible   = FALSE,
        formato      = formato,
        job_id       = job_id,
        generated_at = NULL
      ))

      list(ok = TRUE, job_id = job_id, formato = formato)
    })) |>

    # -----------------------------------------------------------------------
    # GET /api/calc-muestra/reporte/descargar — descarga el último reporte
    # -----------------------------------------------------------------------
    plumber::pr_get("/api/calc-muestra/reporte/descargar",
                    wrap_endpoint(function(req, res, sid = NULL, inline = NULL,
                                           t = NULL) {
      effective_sid <- session_header(req)
      if (is.null(effective_sid) && is.character(sid) &&
          length(sid) >= 1 && nzchar(sid[[1]])) {
        effective_sid <- as.character(sid[[1]])
      }
      s <- session_get(effective_sid)
      meta <- s$calc_muestra_reporte
      if (is.null(meta) || !isTRUE(meta$disponible) ||
          is.null(meta$path) || !file.exists(meta$path)) {
        if (!is.null(meta$job_id)) {
          j <- tryCatch(job_poll(meta$job_id), error = function(e) NULL)
          if (!is.null(j) && identical(j$status, "done") &&
              !is.null(j$result_path) && file.exists(j$result_path)) {
            meta$path <- j$result_path
            meta$disponible <- TRUE
            meta$generated_at <- format(j$finished_at,
                                        "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
            session_set(effective_sid, "calc_muestra_reporte", meta)
          }
        }
        if (is.null(meta$path) || !file.exists(meta$path)) {
          stop_api(404, "E_NO_REPORTE",
                   "No hay reporte generado todavía.")
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
