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
#   POST /api/calc-muestra/explicar            — memoria de cálculo (stateless)
#   POST /api/calc-muestra/recomendar          — recomienda técnica
#   POST /api/calc-muestra/iniciar-estudio     — inicia estudio por tipo
#   POST /api/calc-muestra/modo-trabajo        — transición de modo
#   POST /api/calc-muestra/marco/config        — configura marco de aulas
#   POST /api/calc-muestra/asistencia/referencia — calcula referencia histórica
#   POST /api/calc-muestra/marco/construir     — construye marco de aulas
#   POST /api/calc-muestra/aulas/comparar-metodos — compara motores
#   POST /api/calc-muestra/aulas/seleccionar   — selecciona aulas M1..Mk
#   POST /api/calc-muestra/aulas/simular-reemplazos — simula reservas
#   POST /api/calc-muestra/aulas/exportar      — exporta workbook de seleccion
#   POST /api/calc-muestra/solicitud-dti       — workbook de solicitud a la DTI
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

# Inyecta la selección por categorías del body en la config antes de
# normalizar: la UI puede mandarla al nivel superior del body
# (criterios_seleccion) o anidada en config. El nivel superior gana. Router
# delgado: la normalización y toda la semántica viven en el engine.
.cm_merge_criterios_seleccion <- function(config_input, body) {
  if (is.null(config_input) || !is.list(config_input)) config_input <- list()
  sel <- body$criterios_seleccion %||% body$criterios_marco %||% body$seleccion_criterios
  if (!is.null(sel)) config_input$criterios_seleccion <- sel
  config_input
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

# Umbral de aulas a partir del cual comparar/seleccionar corren como job
# asincrono (callr) en vez de bloquear el proceso principal de plumber.
# Medido: el overhead del worker (callr + load_all) es ~3s, y a escala real
# (3,063 aulas) la via sincrona congelaba el backend entero por minutos u
# horas. Con marcos chicos (< umbral) se mantiene la via sincrona historica.
.cm_aulas_job_threshold <- function() {
  raw <- suppressWarnings(as.integer(Sys.getenv("PULSO_CALC_MUESTRA_JOB_THRESHOLD", "500")))
  if (is.na(raw) || raw < 1L) 500L else raw
}

# F1: el gate por n de aulas dejaba una ventana (100-499 aulas) donde
# comparar/seleccionar corrian sincronos con Monte Carlo completo (4 metodos
# x 500 corridas) y congelaban plumber por minutos, sin progreso ni
# cancelacion. El gate ahora tambien mira el COSTO estimado en aula-corridas
# (aulas x corridas presupuestadas x metodos, ver .cm_aulas_*_estimated_cost):
# pedidos caros van a job aunque el marco sea chico. El default 150,000
# mantiene sync los flujos historicos livianos (marcos chicos con pocas
# corridas, o defaults en marcos de ~70 aulas o menos).
.cm_aulas_job_cost_threshold <- function() {
  raw <- suppressWarnings(as.numeric(Sys.getenv("PULSO_CALC_MUESTRA_JOB_COST_THRESHOLD", "150000")))
  if (is.na(raw) || raw <= 0) 150000 else raw
}

.cm_aulas_run_as_job <- function(frame_n, estimated_cost) {
  frame_n >= .cm_aulas_job_threshold() ||
    estimated_cost > .cm_aulas_job_cost_threshold()
}

# F4: hash del marco vigente en la sesion ("" si no hay marco). Un job de
# comparar/seleccionar/simular puede terminar DESPUES de que el usuario
# reconstruyo el marco; su on_complete solo persiste el resultado si este
# hash coincide con el capturado al submit.
.cm_aulas_frame_vigente_hash <- function(s) {
  frame <- s$calc_muestra_aulas_frame %||% NULL
  if (is.null(frame)) return("")
  .cm_aulas_scalar(frame$frame_hash %||% "", "")
}

# F4: nota de resultado obsoleto para la UI. El resultado completo sigue
# disponible en el job store (GET /api/jobs/<id>); la sesion solo registra
# que NO se aplico por marco desactualizado.
.cm_aulas_registrar_stale_job <- function(sid, j, frame_hash) {
  session_set(sid, "calc_muestra_aulas_stale_job_result", list(
    job_id = j$id,
    kind = j$kind,
    frame_hash = frame_hash,
    detected_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  ))
}

# F4: fabricas de los callbacks on_complete de los jobs de aulas. Extraidas
# de los handlers para poder testearlas sin HTTP: capturan sid/config/hash
# del marco al submit y devuelven el closure que consume job_poll.
.cm_aulas_comparar_on_complete <- function(sid, config, frame_hash) {
  function(j) {
    comparison <- j$result_data
    s_now <- session_get(sid, required = FALSE)
    fresh <- FALSE
    if (!is.null(s_now) && is.list(comparison)) {
      fresh <- identical(.cm_aulas_frame_vigente_hash(s_now), frame_hash)
      if (fresh) {
        session_set(sid, "calc_muestra_aulas_config", config)
        session_set(sid, "calc_muestra_aulas_method_comparison", comparison)
        session_set(sid, "calc_muestra_aulas_export", NULL)
        session_set(sid, "calc_muestra_aulas_stale_job_result", NULL)
      } else {
        .cm_aulas_registrar_stale_job(sid, j, frame_hash)
      }
    }
    # Payload liviano para el snapshot del job (el objeto completo queda
    # en la sesión y se lee via GET /api/calc-muestra/state).
    list(
      ok = TRUE,
      kind = "calc_muestra_aulas_comparar",
      stale_frame = !fresh,
      simulation_runs = comparison$simulation_runs %||% NULL,
      simulation_runs_executed = comparison$simulation_runs_executed %||% NULL,
      recommended_method = comparison$recommendation$method_id %||% NULL
    )
  }
}

.cm_aulas_seleccionar_on_complete <- function(sid, config, frame_hash) {
  function(j) {
    selection <- j$result_data
    s_now <- session_get(sid, required = FALSE)
    fresh <- FALSE
    if (!is.null(s_now) && is.list(selection)) {
      fresh <- identical(.cm_aulas_frame_vigente_hash(s_now), frame_hash)
      if (fresh) {
        comparison <- s_now$calc_muestra_aulas_method_comparison %||% NULL
        if (!is.null(comparison)) selection$method_comparison <- comparison
        session_set(sid, "calc_muestra_aulas_config", config)
        session_set(sid, "calc_muestra_aulas_selection", selection)
        session_set(sid, "calc_muestra_aulas_replacement_simulation", NULL)
        session_set(sid, "calc_muestra_aulas_export", NULL)
        session_set(sid, "calc_muestra_aulas_stale_job_result", NULL)
      } else {
        .cm_aulas_registrar_stale_job(sid, j, frame_hash)
      }
    }
    list(
      ok = TRUE,
      kind = "calc_muestra_aulas_seleccionar",
      stale_frame = !fresh,
      selection_run_id = selection$selection_run_id %||% NULL
    )
  }
}

# F10: ademas del marco, la simulacion de reemplazos depende de la seleccion:
# si el usuario re-sorteo durante el job, tampoco se persiste.
.cm_aulas_simular_on_complete <- function(sid, config, frame_hash, selection_run_id) {
  function(j) {
    replacement <- j$result_data
    s_now <- session_get(sid, required = FALSE)
    fresh <- FALSE
    if (!is.null(s_now) && is.list(replacement)) {
      selection_now <- s_now$calc_muestra_aulas_selection %||% NULL
      run_id_now <- .cm_aulas_scalar(selection_now$selection_run_id %||% "", "")
      fresh <- identical(.cm_aulas_frame_vigente_hash(s_now), frame_hash) &&
        identical(run_id_now, selection_run_id)
      if (fresh) {
        if (!is.null(selection_now)) {
          selection_now$replacement_simulation <- replacement
          session_set(sid, "calc_muestra_aulas_selection", selection_now)
        }
        session_set(sid, "calc_muestra_aulas_config", config)
        session_set(sid, "calc_muestra_aulas_replacement_simulation", replacement)
        session_set(sid, "calc_muestra_aulas_export", NULL)
        session_set(sid, "calc_muestra_aulas_stale_job_result", NULL)
      } else {
        .cm_aulas_registrar_stale_job(sid, j, frame_hash)
      }
    }
    list(
      ok = TRUE,
      kind = "calc_muestra_aulas_simular_reemplazos",
      stale_frame = !fresh,
      # Ojo: sin %||% aqui — el %||% del paquete evalua is.na() y no acepta
      # data.frames (length > 1).
      suggestions_n = if (is.list(replacement) && is.data.frame(replacement$suggestions)) nrow(replacement$suggestions) else NULL
    )
  }
}

.cm_state_payload <- function(sid) {
  s <- session_get(sid)
  estudio <- s$calc_muestra_estudio %||% calc_muestra_normalize_estudio(list())
  reporte_meta <- s$calc_muestra_reporte %||% list(disponible = FALSE)
  list(
    estudio = estudio,
    referencia_asistencia = s$calc_muestra_referencia_asistencia %||% NULL,
    aulas = list(
      config = s$calc_muestra_aulas_config %||% calc_muestra_aulas_default_config(),
      frame = s$calc_muestra_aulas_frame %||% NULL,
      selection = s$calc_muestra_aulas_selection %||% NULL,
      method_comparison = s$calc_muestra_aulas_method_comparison %||% NULL,
      replacement_simulation = s$calc_muestra_aulas_replacement_simulation %||% NULL,
      export = s$calc_muestra_aulas_export %||% NULL,
      # F4: nota de job cuyo resultado NO se aplico por marco desactualizado
      # ({job_id, kind, frame_hash, detected_at} o NULL). El resultado sigue
      # en el job store; la UI puede avisar y ofrecer re-ejecutar.
      stale_job_result = s$calc_muestra_aulas_stale_job_result %||% NULL
    ),
    reporte = list(
      disponible    = isTRUE(reporte_meta$disponible),
      generated_at  = reporte_meta$generated_at %||% NULL,
      formato       = reporte_meta$formato %||% NULL,
      job_id        = reporte_meta$job_id %||% NULL,
      # F5: TRUE cuando el estudio cambio despues de generar el reporte; la
      # descarga sigue disponible, la UI muestra "desactualizado".
      stale         = isTRUE(reporte_meta$stale)
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
      s <- session_get(sid)
      prev <- s$calc_muestra_estudio %||% NULL
      estudio <- calc_muestra_normalize_estudio(input)
      session_set(sid, "calc_muestra_estudio", estudio)
      # F5: el autosave (~2 s) pega a este endpoint con CUALQUIER edicion de
      # UI; borrar la meta aqui dejaba la descarga en 404 (perdia job_id/
      # path). La meta se preserva y solo se marca stale ante cambio
      # relevante (todo menos workspace). Logica en calc_muestra_engine.R.
      session_set(sid, "calc_muestra_reporte",
                  calc_muestra_reporte_meta_tras_estudio(
                    s$calc_muestra_reporte, prev, estudio))
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
      # F5: cambia contenido del reporte -> stale, preservando job_id/path.
      session_set(sid, "calc_muestra_reporte",
                  calc_muestra_reporte_meta_marcar_stale(s$calc_muestra_reporte))
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
      # F5: cambia contenido del reporte -> stale, preservando job_id/path.
      session_set(sid, "calc_muestra_reporte",
                  calc_muestra_reporte_meta_marcar_stale(s$calc_muestra_reporte))
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
      # F5: cambia contenido del reporte -> stale, preservando job_id/path.
      session_set(sid, "calc_muestra_reporte",
                  calc_muestra_reporte_meta_marcar_stale(s$calc_muestra_reporte))
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
    # POST /api/calc-muestra/explicar — memoria de cálculo explicada
    # Stateless: no toca la sesión. Body: { N, p?, e?, deff?, confianza?|z?,
    # oversample_pct?, meta_valor?, promedio_conglomerado?, tau? }
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/explicar",
                     wrap_endpoint(function(req, res, ...) {
      body <- .cm_parse_body(req)
      input <- body$parametros %||% body
      list(ok = TRUE, memoria = calc_muestra_explicar(input))
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
      # F5: cambia contenido del reporte -> stale, preservando job_id/path.
      session_set(sid, "calc_muestra_reporte",
                  calc_muestra_reporte_meta_marcar_stale(s$calc_muestra_reporte))
      # F4: el estado de aulas se reinicia abajo; cualquier nota de job
      # obsoleto tambien.
      session_set(sid, "calc_muestra_aulas_stale_job_result", NULL)
      aulas_demo <- iniciado$aulas_demo %||% NULL
      demo_warning <- NULL
      if (is.list(aulas_demo) && !is.null(aulas_demo$error)) {
        demo_warning <- aulas_demo$error
        aulas_demo <- NULL
      }
      if (is.list(aulas_demo) && !is.null(aulas_demo$frame) && !is.null(aulas_demo$selection)) {
        session_set(sid, "calc_muestra_aulas_config", aulas_demo$config %||% calc_muestra_aulas_default_config())
        session_set(sid, "calc_muestra_aulas_frame", aulas_demo$frame)
        session_set(sid, "calc_muestra_aulas_selection", aulas_demo$selection)
        session_set(sid, "calc_muestra_aulas_method_comparison", aulas_demo$method_comparison %||% NULL)
        session_set(sid, "calc_muestra_aulas_replacement_simulation", aulas_demo$replacement_simulation %||% NULL)
        session_set(sid, "calc_muestra_aulas_export", NULL)
      } else {
        session_set(sid, "calc_muestra_aulas_config", calc_muestra_aulas_default_config())
        session_set(sid, "calc_muestra_aulas_frame", NULL)
        session_set(sid, "calc_muestra_aulas_selection", NULL)
        session_set(sid, "calc_muestra_aulas_method_comparison", NULL)
        session_set(sid, "calc_muestra_aulas_replacement_simulation", NULL)
        session_set(sid, "calc_muestra_aulas_export", NULL)
      }
      list(ok = TRUE, estudio = estudio, state = .cm_state_payload(sid), demo_warning = demo_warning)
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
      config <- .cm_merge_criterios_seleccion(body$config %||% body, body)
      config <- calc_muestra_aulas_normalize_config(config)
      session_set(sid, "calc_muestra_aulas_config", config)
      list(ok = TRUE, config = config, state = .cm_state_payload(sid))
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/marco/inspeccionar-archivo — lista hojas y roles
    # Body: { file_id }
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/marco/inspeccionar-archivo",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      file_id <- calc_str(body$file_id %||% body$fileId, "")
      if (!nzchar(file_id)) {
        stop_api(400, "E_CALC_MUESTRA_FILE_REQUIRED", "Sube primero un archivo Excel o CSV.")
      }
      meta <- get_file(sid, file_id)
      inspection <- tryCatch(
        calc_muestra_aulas_inspect_workbook(meta$path),
        error = function(e) stop_api(400, "E_CALC_MUESTRA_FILE_INSPECT", conditionMessage(e))
      )
      list(
        ok = TRUE,
        file_id = file_id,
        original_name = meta$original_name,
        inspection = inspection
      )
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/asistencia/referencia — calcula y guarda el
    # agregado metodológico de un estudio histórico externo.
    # Body: { referencia_asistencia|referencia_asistencia_file_id,
    #         referencia_asistencia_sheet?, estudio?: {...}, workspace?: {...} }
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/asistencia/referencia",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      s <- session_get(sid)
      has_workspace <- "workspace" %in% names(body)
      if (has_workspace && !is.list(body$workspace)) {
        stop_api(
          400,
          "E_CALC_MUESTRA_ASISTENCIA_REFERENCE",
          "workspace debe ser una lista."
        )
      }

      estudio_vigente <- s$calc_muestra_estudio %||%
        calc_muestra_normalize_estudio(list())
      estudio_actualizado <- NULL
      reporte_actualizado <- NULL
      if (has_workspace) {
        propuesta <- estudio_vigente
        propuesta$workspace <- body$workspace
        estudio_actualizado <- calc_muestra_normalize_estudio(propuesta)
        reporte_actualizado <- calc_muestra_reporte_meta_tras_estudio(
          s$calc_muestra_reporte,
          estudio_vigente,
          estudio_actualizado
        )
      }

      estudio_input <- body$estudio %||% s$calc_muestra_estudio %||% list()
      estudio_referencia <- if (is.list(estudio_input)) {
        list(
          id = calc_str(estudio_input$id, ""),
          label = calc_str(estudio_input$label %||% estudio_input$titulo, ""),
          periodo = calc_str(estudio_input$periodo, ""),
          fuente = calc_str(estudio_input$fuente, "")
        )
      } else {
        estudio_input
      }
      referencia <- tryCatch({
        tabla <- .cm_table_from_payload(sid, body, "referencia_asistencia")
        calc_muestra_asistencia_referencia(tabla, estudio = estudio_referencia)
      }, error = function(e) {
        if (inherits(e, "api_error")) stop(e)
        stop_api(
          400,
          "E_CALC_MUESTRA_ASISTENCIA_REFERENCE",
          conditionMessage(e)
        )
      })

      if (has_workspace) {
        session_set_many(sid, list(
          calc_muestra_estudio = estudio_actualizado,
          calc_muestra_reporte = reporte_actualizado,
          calc_muestra_referencia_asistencia = referencia
        ))
      } else {
        # Compatibilidad v1: clientes previos publican solo la referencia.
        session_set(sid, "calc_muestra_referencia_asistencia", referencia)
      }

      state <- .cm_state_payload(sid)
      list(
        ok = TRUE,
        estudio = state$estudio,
        referencia_asistencia = referencia,
        state = state
      )
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/marco/construir — construye marco de aulas
    # Body: { base_madre|base_madre_file_id, estudiantes|estudiantes_file_id,
    #         inscripciones|inscripciones_file_id, catalogo_curso_horario,
    #         config }
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/marco/construir",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      s <- session_get(sid)
      config_input <- .cm_merge_criterios_seleccion(
        body$config %||% s$calc_muestra_aulas_config %||% list(), body
      )
      config <- calc_muestra_aulas_normalize_config(config_input)
      base_madre <- .cm_table_from_payload(sid, body, "base_madre")
      estudiantes <- .cm_table_from_payload(sid, body, "estudiantes")
      inscripciones <- .cm_table_from_payload(sid, body, "inscripciones")
      catalogo_curso_horario <- .cm_table_from_payload(sid, body, "catalogo_curso_horario")
      frame <- tryCatch(
        calc_muestra_aulas_construir(
          base_madre = base_madre,
          estudiantes = estudiantes,
          inscripciones = inscripciones,
          catalogo_curso_horario = catalogo_curso_horario,
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
      # F4: marco nuevo -> la nota de job obsoleto deja de ser relevante.
      session_set(sid, "calc_muestra_aulas_stale_job_result", NULL)
      list(ok = TRUE, frame = frame, state = .cm_state_payload(sid))
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/aulas/comparar-metodos — laboratorio comparativo
    # Body: { config?: {...}, frame?: {...}, methods?: [], simulation_runs?: n }
    # Respuesta:
    #   - marco chico (< umbral): { ok, mode: "sync", comparison, state }
    #   - marco grande:           { ok, mode: "job", job_id } — pollear
    #     GET /api/jobs/<id>; al terminar, el resultado queda en la sesión y
    #     el frontend refresca via GET /api/calc-muestra/state.
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
      methods <- body$methods %||% body$metodos %||% NULL
      simulation_runs <- body$simulation_runs %||% body$simulaciones %||% NULL

      # F1: gate sync/job por n de aulas Y por costo estimado (aula-corridas
      # presupuestadas x metodos). La ventana 100-499 aulas con MC pesado ya
      # no congela plumber: pasa a job con progreso y cancelacion.
      frame_n <- .cm_aulas_frame_n(frame)
      costo <- .cm_aulas_comparar_estimated_cost(frame_n, config,
                                                 methods = methods,
                                                 simulation_runs = simulation_runs)
      if (!.cm_aulas_run_as_job(frame_n, costo)) {
        comparison <- tryCatch(
          calc_muestra_aulas_comparar_metodos(
            frame,
            config,
            methods = methods,
            simulation_runs = simulation_runs
          ),
          error = function(e) stop_api(400, "E_CALC_MUESTRA_AULAS_COMPARE", conditionMessage(e))
        )
        session_set(sid, "calc_muestra_aulas_config", config)
        session_set(sid, "calc_muestra_aulas_method_comparison", comparison)
        session_set(sid, "calc_muestra_aulas_export", NULL)
        session_set(sid, "calc_muestra_aulas_stale_job_result", NULL)
        return(list(ok = TRUE, mode = "sync", comparison = comparison, state = .cm_state_payload(sid)))
      }

      job_id <- job_submit(
        sid = sid,
        kind = "calc_muestra_aulas_comparar",
        func = calc_muestra_aulas_comparar_job,
        args = list(
          frame = frame,
          config = config,
          methods = methods,
          simulation_runs = simulation_runs
        ),
        # F4: solo persiste en sesion si el marco vigente sigue siendo el
        # capturado al submit (ver .cm_aulas_comparar_on_complete).
        on_complete = .cm_aulas_comparar_on_complete(
          sid, config, .cm_aulas_scalar(frame$frame_hash %||% "", "")
        )
      )
      list(ok = TRUE, mode = "job", job_id = job_id)
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

      # F1/F2: gate por n de aulas Y por costo estimado. Con engines de
      # diseño prescrito (mc_runs = 0) el costo colapsa a una seleccion, asi
      # que el sorteo comun queda sync; pool_controlado con MC pesado va a job.
      frame_n <- .cm_aulas_frame_n(frame)
      costo <- .cm_aulas_seleccionar_estimated_cost(frame_n, config)
      if (!.cm_aulas_run_as_job(frame_n, costo)) {
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
        session_set(sid, "calc_muestra_aulas_stale_job_result", NULL)
        return(list(ok = TRUE, mode = "sync", selection = selection, state = .cm_state_payload(sid)))
      }

      # Marco grande o MC caro: job asincrono con progreso por etapas. La
      # selección es identica a la via sincrona con la misma semilla (el
      # callback de progreso no toca RNG); ver test e2e de paridad sync/job.
      # F4: el on_complete solo persiste si el marco vigente sigue siendo el
      # capturado al submit.
      job_id <- job_submit(
        sid = sid,
        kind = "calc_muestra_aulas_seleccionar",
        func = calc_muestra_aulas_seleccionar_job,
        args = list(frame = frame, config = config),
        on_complete = .cm_aulas_seleccionar_on_complete(
          sid, config, .cm_aulas_scalar(frame$frame_hash %||% "", "")
        )
      )
      list(ok = TRUE, mode = "job", job_id = job_id)
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/aulas/simular-reemplazos — impacto de reservas
    # Body: { config?: {...}, frame?: {...}, selection?: {...} }
    # F10: a 3,063 aulas esta simulación tardaba ~76s síncronos y bloqueaba
    # TODO el backend (plumber single-thread). Mismo patrón job que
    # comparar/seleccionar con el mismo umbral:
    #   - marco chico (< umbral): { ok, mode: "sync", replacement_simulation, state }
    #   - marco grande:           { ok, mode: "job", job_id } — pollear
    #     GET /api/jobs/<id> y refrescar via GET /api/calc-muestra/state.
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

      if (.cm_aulas_frame_n(frame) < .cm_aulas_job_threshold()) {
        replacement <- tryCatch(
          calc_muestra_aulas_simular_reemplazos(frame, selection, config),
          error = function(e) stop_api(400, "E_CALC_MUESTRA_AULAS_REPLACEMENTS", conditionMessage(e))
        )
        selection$replacement_simulation <- replacement
        session_set(sid, "calc_muestra_aulas_config", config)
        session_set(sid, "calc_muestra_aulas_selection", selection)
        session_set(sid, "calc_muestra_aulas_replacement_simulation", replacement)
        session_set(sid, "calc_muestra_aulas_export", NULL)
        session_set(sid, "calc_muestra_aulas_stale_job_result", NULL)
        return(list(ok = TRUE, mode = "sync", replacement_simulation = replacement, state = .cm_state_payload(sid)))
      }

      # F4/F10: el on_complete solo persiste si el marco Y la selección
      # vigentes siguen siendo los capturados al submit.
      job_id <- job_submit(
        sid = sid,
        kind = "calc_muestra_aulas_simular_reemplazos",
        func = calc_muestra_aulas_simular_reemplazos_job,
        args = list(frame = frame, selection = selection, config = config),
        on_complete = .cm_aulas_simular_on_complete(
          sid, config,
          .cm_aulas_scalar(frame$frame_hash %||% "", ""),
          .cm_aulas_scalar(selection$selection_run_id %||% "", "")
        )
      )
      list(ok = TRUE, mode = "job", job_id = job_id)
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
    # POST /api/calc-muestra/solicitud-dti — workbook de solicitud a la DTI
    # Body: { variables: [{rol, label, hoja, requerida, descripcion}...],
    #         notas?: [chr] }
    # La lista de variables es la fuente de verdad del frontend
    # (constants.ts); el backend solo valida forma y renderiza. Mismo patrón
    # de descarga que /aulas/exportar (archivo registrado + file_id).
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/solicitud-dti",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      out_path <- tempfile("calc_muestra_solicitud_dti_", fileext = ".xlsx")
      # La validación del payload (sin variables ⇒ E_CALC_MUESTRA_DTI_INPUT)
      # y el render viven en calc_muestra_solicitud_dti.R; stop_api propaga.
      calc_muestra_solicitud_dti_workbook(body, out_path)
      out_name <- .export_filename(sid, "solicitud_dti", "xlsx")
      meta <- .register_output_file(sid, "calc_muestra_solicitud_dti", out_path, original_name = out_name)
      list(ok = TRUE, export = list(
        ok = TRUE, file_id = meta$file_id, filename = meta$original_name, size = meta$size
      ))
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
        generated_at = NULL,
        # F5: generación fresca — el flag de desactualizado arranca limpio.
        stale        = FALSE
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
