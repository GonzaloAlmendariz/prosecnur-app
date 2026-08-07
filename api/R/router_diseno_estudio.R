# =============================================================================
# Endpoints HTTP de Diseno del Estudio
# =============================================================================
#
# El modulo compone un expediente metodologico vivo desde el estado local de la
# sesion. Es deliberadamente read-only: resume contratos de otros modulos sin
# mutar proyecto, sin serializar datos crudos y sin tocar secretos.

.diseno_now_iso <- function() {
  format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
}

.diseno_parse_body <- function(req) {
  body_raw <- req$postBody %||% "{}"
  if (!nzchar(trimws(body_raw))) return(list())
  tryCatch(
    jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_DISENO_JSON", "Body JSON invalido.")
  )
}

.diseno_scalar <- function(value, default = "") {
  if (is.null(value)) return(default)
  if (length(value) == 0L) return(default)
  out <- suppressWarnings(as.character(value[[1]]))
  if (is.na(out) || !nzchar(trimws(out))) default else out
}

.diseno_bool <- function(value) {
  isTRUE(value)
}

.diseno_num <- function(value, default = 0) {
  if (is.null(value) || length(value) == 0L) return(default)
  out <- suppressWarnings(as.numeric(value[[1]]))
  if (!is.finite(out)) default else out
}

.diseno_has_content <- function(value) {
  if (is.null(value)) return(FALSE)
  if (is.data.frame(value)) return(nrow(value) > 0L || ncol(value) > 0L)
  if (is.list(value)) return(length(value) > 0L)
  if (is.character(value)) return(any(nzchar(trimws(value))))
  if (is.logical(value)) return(any(value, na.rm = TRUE))
  length(value) > 0L
}

.diseno_chr_list <- function(values, max_items = 5L) {
  if (is.null(values)) return(list())
  if (is.list(values)) values <- unlist(values, recursive = FALSE, use.names = FALSE)
  values <- stats::na.omit(as.character(values))
  values <- values[nzchar(trimws(values))]
  as.list(utils::head(unique(values), max_items))
}

.diseno_file_basename <- function(path) {
  path <- .diseno_scalar(path, "")
  if (!nzchar(path)) "" else basename(path)
}

.diseno_limit_text <- function(value, max_chars = 600L) {
  out <- .diseno_scalar(value, "")
  out <- gsub("[\001-\010\013\014\016-\037\177]", "", out, perl = TRUE)
  out <- trimws(out)
  if (nchar(out, type = "chars") > max_chars) {
    out <- paste0(substr(out, 1L, max_chars), "...")
  }
  out
}

.diseno_status <- function(id, label, route, state, summary, evidence = list(),
                           owner = id, category = "metodologia") {
  state <- .diseno_scalar(state, "pending")
  if (!(state %in% c("ready", "active", "pending", "warning"))) state <- "pending"
  list(
    id = id,
    label = label,
    route = route,
    state = state,
    summary = summary,
    evidence = .diseno_chr_list(evidence, max_items = 6L),
    owner = owner,
    category = category
  )
}

.diseno_bitacora_tones <- c("nota", "decision", "riesgo", "bloqueo", "avance")

.diseno_bitacora_modules <- c(
  "diseno-estudio", "editor-xlsform", "carga", "validacion", "codificacion",
  "analitica", "graficos", "dashboard", "calc-muestra", "hojas-ruta",
  "plan-trabajo", "recopiladores", "monitoreo", "proyecto"
)

.diseno_bitacora_entry <- function(entry = list()) {
  if (is.null(entry) || !is.list(entry)) entry <- list()
  title <- .diseno_limit_text(entry$title %||% entry$titulo, 120L)
  body <- .diseno_limit_text(entry$body %||% entry$detalle %||% entry$text, 1600L)
  module_id <- .diseno_scalar(entry$module_id %||% entry$moduleId %||% entry$modulo, "diseno-estudio")
  if (!(module_id %in% .diseno_bitacora_modules)) module_id <- "diseno-estudio"
  tone <- .diseno_scalar(entry$tone %||% entry$tipo, "nota")
  if (!(tone %in% .diseno_bitacora_tones)) tone <- "nota"
  occurred_at <- .diseno_scalar(entry$occurred_at %||% entry$occurredAt, .diseno_now_iso())
  id <- .diseno_scalar(entry$id, "")
  if (!nzchar(id)) id <- uuid::UUIDgenerate()
  # ADR 0047: esta función re-normaliza la entrada en CADA lectura (ver
  # .diseno_bitacora_entries), así que todo campo que no se enumere acá se borra
  # solo en el GET siguiente. Los campos del subsistema tienen que estar en esta
  # lista o se pierden en silencio.
  list(
    id = id,
    module_id = module_id,
    tone = tone,
    title = if (nzchar(title)) title else "Nota de bitacora",
    body = body,
    occurred_at = occurred_at,
    created_at = .diseno_scalar(entry$created_at %||% entry$createdAt, .diseno_now_iso()),
    updated_at = .diseno_scalar(entry$updated_at %||% entry$updatedAt, ""),
    tags = .diseno_chr_list(entry$tags %||% list(), max_items = 6L),
    revisions = .bit_revisiones(entry$revisions),
    archived_at = .bit_marca(entry$archived_at %||% entry$archivedAt),
    links = .bit_vinculos(entry$links, origen = .bit_vinculo_clave("entrada", id))
  )
}

.diseno_bitacora_entries <- function(s) {
  raw <- s$diseno_estudio_bitacora %||% list()
  if (!is.list(raw) || length(raw) == 0L) return(list())
  entries <- lapply(raw, .diseno_bitacora_entry)
  entries <- entries[vapply(entries, function(entry) {
    nzchar(entry$title) || nzchar(entry$body)
  }, logical(1))]
  entries[order(vapply(entries, function(entry) entry$occurred_at, character(1)), decreasing = TRUE)]
}

.diseno_bitacora_save <- function(sid, entries) {
  entries <- lapply(entries %||% list(), .diseno_bitacora_entry)
  # Cupos separados para vivas y archivadas (bitacora_entradas.R): con un tope
  # único, las archivadas consumirían lugar y expulsarían entradas activas, que
  # es lo contrario de lo que archivar promete.
  entries <- .bit_entradas_cap(entries)
  session_set(sid, "diseno_estudio_bitacora", entries)
  entries
}

.diseno_bitacora_upsert <- function(sid, entry) {
  entries <- .diseno_bitacora_entries(session_get(sid))
  normalized <- .diseno_bitacora_entry(entry)
  existing_idx <- which(vapply(entries, function(item) identical(item$id, normalized$id), logical(1)))
  if (length(existing_idx) > 0L) {
    previa <- entries[[existing_idx[[1L]]]]
    normalized$created_at <- previa$created_at
    normalized$updated_at <- .diseno_now_iso()
    normalized$archived_at <- previa$archived_at
    # La bitácora es un registro, no un borrador: editar conserva lo que decía
    # antes (ADR 0047).
    normalized <- .bit_entrada_revisar(previa, normalized)
    entries[[existing_idx[[1L]]]] <- normalized
  } else {
    entries <- c(list(normalized), entries)
  }
  .diseno_bitacora_save(sid, entries)
}

.diseno_bitacora_delete <- function(sid, id) {
  id <- .diseno_scalar(id, "")
  if (!nzchar(id)) stop_api(400, "E_DISENO_BITACORA_ID", "Falta id de entrada.")
  entries <- .diseno_bitacora_entries(session_get(sid))
  next_entries <- Filter(function(item) !identical(item$id, id), entries)
  .diseno_bitacora_save(sid, next_entries)
}

.diseno_state_weight <- function(state) {
  switch(.diseno_scalar(state, "pending"),
    ready = 1,
    active = 0.62,
    warning = 0.42,
    pending = 0,
    0
  )
}

.diseno_data_rows <- function(s) {
  sources <- s$rp_data_sources %||% list()
  if (length(sources) > 0L) {
    return(as.integer(sum(vapply(sources, function(x) {
      if (is.data.frame(x)) nrow(x) else 0L
    }, integer(1)), na.rm = TRUE)))
  }
  if (is.data.frame(s$rp_data)) return(as.integer(nrow(s$rp_data)))
  if (is.data.frame(s$analitica_rp_data)) return(as.integer(nrow(s$analitica_rp_data)))
  0L
}

.diseno_data_cols <- function(s) {
  sources <- s$rp_data_sources %||% list()
  if (length(sources) > 0L) {
    return(as.integer(sum(vapply(sources, function(x) {
      if (is.data.frame(x)) ncol(x) else 0L
    }, integer(1)), na.rm = TRUE)))
  }
  if (is.data.frame(s$rp_data)) return(as.integer(ncol(s$rp_data)))
  if (is.data.frame(s$analitica_rp_data)) return(as.integer(ncol(s$analitica_rp_data)))
  0L
}

.diseno_bases_count <- function(s) {
  bases <- (s$estudio %||% list())$bases %||% list()
  if (length(bases) > 0L) return(length(bases))
  if (.diseno_has_content(s$rp_data)) return(1L)
  0L
}

.diseno_instruments_count <- function(s) {
  inst_sources <- s$rp_inst_sources %||% list()
  if (length(inst_sources) > 0L) return(length(inst_sources))
  if (.diseno_has_content(s$rp_inst) || .diseno_has_content(s$instrumento)) return(1L)
  0L
}

.diseno_calc_total <- function(estudio, key = "n_objetivo") {
  comps <- (estudio %||% list())$componentes %||% list()
  if (length(comps) == 0L) return(0L)
  vals <- vapply(comps, function(comp) {
    res <- (comp %||% list())$resultado %||% list()
    meta <- (comp %||% list())$meta %||% list()
    .diseno_num(res[[key]] %||% meta$valor, 0)
  }, numeric(1))
  vals <- vals[is.finite(vals) & vals > 0]
  as.integer(sum(vals))
}

.diseno_count_records_anywhere <- function(value) {
  if (is.null(value)) return(0L)
  if (is.data.frame(value)) return(as.integer(nrow(value)))
  if (!is.list(value)) return(0L)
  candidates <- c("rows", "plan", "selected", "selection", "aulas", "items", "records", "data")
  for (key in candidates) {
    item <- value[[key]]
    if (is.data.frame(item)) return(as.integer(nrow(item)))
    if (is.list(item) && length(item) > 0L && !is.data.frame(item)) return(length(item))
  }
  length(value)
}

.diseno_library_summary <- function() {
  catalog_path <- system.file("catalogos", "catalogo_metodologias.json", package = "prosecnurapp")
  tipos_path <- system.file("catalogos", "catalogo_tipos_estudio.json", package = "prosecnurapp")
  catalog <- if (nzchar(catalog_path) && file.exists(catalog_path)) {
    tryCatch(jsonlite::fromJSON(catalog_path, simplifyVector = FALSE), error = function(e) NULL)
  } else {
    NULL
  }
  tipos <- if (nzchar(tipos_path) && file.exists(tipos_path)) {
    tryCatch(jsonlite::fromJSON(tipos_path, simplifyVector = FALSE), error = function(e) NULL)
  } else {
    NULL
  }
  list(
    available = !is.null(catalog),
    methodologies_count = length((catalog %||% list())$metodologias %||% list()),
    study_families_count = length((tipos %||% list())$familias_estudio %||% list()),
    updated_at = .diseno_scalar((catalog %||% list())$actualizado_en, ""),
    source = .diseno_scalar((catalog %||% list())$fuente_canonica, "catalogos locales")
  )
}

.diseno_protocol_summary <- function(s) {
  calc <- s$calc_muestra_estudio %||% list()
  calc_context <- calc$contexto %||% list()
  estudio <- s$estudio %||% list()
  dashboard <- s$dashboard_config %||% list()
  rows <- .diseno_data_rows(s)
  cols <- .diseno_data_cols(s)
  bases <- .diseno_bases_count(s)
  instruments <- .diseno_instruments_count(s)
  sample_n <- .diseno_calc_total(calc, "n_objetivo")
  operational_n <- .diseno_calc_total(calc, "n_operativo")
  aulas_selection <- s$calc_muestra_aulas_selection %||% list()
  aulas_rows <- .diseno_count_records_anywhere(aulas_selection)
  hojas_outputs <- s$hojas_ruta_workspace_outputs %||% list()
  plan <- s$plan_trabajo %||% list()
  plan_tasks <- plan$tasks %||% list()
  plan_milestones <- plan$milestones %||% list()
  plan_windows <- plan$windows %||% list()
  monitoreo_sources <- s$monitoreo_sources %||% list()
  mon_cfg <- s$monitoreo_config %||% list()
  mon_profile <- mon_cfg$monitoreo_profile %||% mon_cfg$profile %||% list()

  list(
    title = .diseno_scalar(estudio$nombre %||% calc$titulo %||% dashboard$titulo, "Proyecto sin titulo"),
    client = .diseno_scalar(calc_context$cliente %||% dashboard$cliente, ""),
    client_type = .diseno_scalar(calc_context$tipo_cliente, ""),
    description = .diseno_scalar(calc_context$descripcion_libre %||% dashboard$subtitulo, ""),
    processing_mode = .diseno_scalar(estudio$processing_mode, "multibase"),
    active_base = .diseno_scalar(estudio$active_base, ""),
    bases_count = as.integer(bases),
    instruments_count = as.integer(instruments),
    records_count = as.integer(rows),
    variables_count = as.integer(cols),
    sample_components_count = length(calc$componentes %||% list()),
    sample_target_n = as.integer(sample_n),
    sample_operational_n = as.integer(operational_n),
    classroom_units_count = as.integer(aulas_rows),
    route_phase = .diseno_scalar(s$hojas_ruta_active_phase, ""),
    route_outputs_count = length(hojas_outputs),
    workplan_title = .diseno_scalar(plan$title, ""),
    workplan_tasks_count = length(plan_tasks),
    workplan_milestones_count = length(plan_milestones),
    workplan_windows_count = length(plan_windows),
    monitoring_family = .diseno_scalar(mon_profile$family %||% mon_cfg$family, ""),
    monitoring_sources_count = length(monitoreo_sources),
    project_file = .diseno_file_basename(s$project_path)
  )
}

.diseno_module_statuses <- function(s, protocol) {
  has_project <- nzchar(.diseno_scalar(s$project_path, ""))
  has_form <- protocol$instruments_count > 0L || .diseno_has_content(s$xlsform_state)
  has_data <- protocol$records_count > 0L || protocol$bases_count > 0L
  has_validation_plan <- .diseno_has_content(s$plan_result)
  has_validation_result <- .diseno_has_content(s$evaluacion)
  has_codif <- .diseno_has_content(s$codif_por_base) || .diseno_bool(s$codif_aplicado)
  has_analitica <- any(vapply(c(
    "analitica_prep_ok", "analitica_codebook_ok", "analitica_frecuencias_ok",
    "analitica_cruces_ok", "analitica_spss_ok", "analitica_enumeradores_ok",
    "analitica_dim_ok", "analitica_multibase_ok", "analitica_panel_ok",
    "analitica_ficha_tecnica_ok", "analitica_bases_data_ok",
    "analitica_bases_instrumento_ok", "analitica_bases_sav_ok",
    "analitica_bases_csv_ok", "analitica_bases_xlsx_ok"
  ), function(key) isTRUE(s[[key]]), logical(1))) || .diseno_has_content(s$analitica_config)
  has_graficos <- .diseno_has_content(s$graficos_config) ||
    isTRUE(s$graficos_ppt_ok) || isTRUE(s$graficos_word_ok)
  has_dashboard <- .diseno_has_content(s$dashboard_config) || .diseno_has_content(s$dashboard_curacion)
  has_calc <- .diseno_has_content(s$calc_muestra_estudio) &&
    length((s$calc_muestra_estudio %||% list())$componentes %||% list()) > 0L
  has_aulas <- .diseno_has_content(s$calc_muestra_aulas_selection)
  has_hojas <- .diseno_has_content(s$hojas_ruta_config) ||
    .diseno_has_content(s$hojas_ruta_workspace_outputs) ||
    .diseno_has_content(s$hojas_ruta_runs)
  has_plan <- .diseno_has_content(s$plan_trabajo) &&
    length((s$plan_trabajo %||% list())$tasks %||% list()) > 0L
  has_recop <- .diseno_has_content(s$monitoreo_aulas_publication) ||
    .diseno_has_content(s$monitoreo_aulas_plan)
  has_mon <- .diseno_has_content(s$monitoreo_sources) ||
    .diseno_has_content(s$monitoreo_snapshot) ||
    .diseno_has_content(s$monitoreo_config)

  list(
    .diseno_status(
      "proyecto", "Proyecto .pulso", "/", if (has_project) "ready" else "warning",
      if (has_project) paste("Archivo activo:", protocol$project_file) else "Sesion efimera o proyecto aun sin guardar.",
      c(if (has_project) "Guardado explicito disponible" else "Abrir o crear proyecto para trazabilidad"),
      category = "nucleo"
    ),
    .diseno_status(
      "editor-xlsform", "Formulario", "/editor-xlsform", if (has_form) "ready" else "pending",
      if (has_form) sprintf("%d instrumento(s) vinculados al estudio.", protocol$instruments_count) else "Sin instrumento asociado.",
      c("XLSForm", "SurveyMonkey/Kobo cuando aplica"),
      category = "insumos"
    ),
    .diseno_status(
      "carga", "Carga y bases", "/carga", if (has_data) "ready" else "pending",
      if (has_data) sprintf("%d base(s), %d registros y %d variables.", protocol$bases_count, protocol$records_count, protocol$variables_count) else "Sin base de datos cargada.",
      c(.diseno_scalar(s$analitica_fuente, ""), sprintf("%d base(s)", protocol$bases_count)),
      category = "insumos"
    ),
    .diseno_status(
      "validacion", "Validacion", "/validacion",
      if (has_validation_result) "ready" else if (has_validation_plan) "active" else "pending",
      if (has_validation_result) "Auditoria corrida y disponible para sustento." else if (has_validation_plan) "Plan de validacion construido; falta correr o revisar resultados." else "Sin plan de validacion.",
      c(if (has_validation_plan) "Plan construido" else "", if (has_validation_result) "Auditoria corrida" else ""),
      category = "calidad"
    ),
    .diseno_status(
      "codificacion", "Codificacion", "/codificacion", if (has_codif) "ready" else "pending",
      if (has_codif) "Decisiones de codificacion disponibles por base." else "Sin decisiones de codificacion registradas.",
      c(if (has_codif) "Preguntas abiertas tratadas" else ""),
      category = "procesamiento"
    ),
    .diseno_status(
      "analitica", "Analitica", "/analitica", if (has_analitica) "ready" else if (has_data) "active" else "pending",
      if (has_analitica) "Configuracion o salidas analiticas detectadas." else if (has_data) "Datos listos para preparar reportes." else "Requiere bases cargadas.",
      c(if (isTRUE(s$analitica_ficha_tecnica_ok)) "Ficha tecnica generada" else "", if (isTRUE(s$analitica_panel_ok)) "Panel wide listo" else ""),
      category = "entregables"
    ),
    .diseno_status(
      "graficos", "Graficos", "/graficos", if (has_graficos) "ready" else if (has_analitica) "active" else "pending",
      if (has_graficos) "Plan visual o exportaciones graficas detectadas." else "Sin plan de graficos.",
      c(if (isTRUE(s$graficos_ppt_ok)) "PPT generado" else "", if (isTRUE(s$graficos_word_ok)) "Word generado" else ""),
      category = "entregables"
    ),
    .diseno_status(
      "dashboard", "Dashboard", "/tablero", if (has_dashboard) "ready" else if (has_data) "active" else "pending",
      if (has_dashboard) "Configuracion o curacion de dashboard disponible." else "Dashboard aun sin curar.",
      c(if (.diseno_has_content(s$dashboard_curacion)) "Curacion registrada" else ""),
      category = "entregables"
    ),
    .diseno_status(
      "calc-muestra", "Calculo de muestra", "/calc-muestra", if (has_calc || has_aulas) "ready" else "pending",
      if (has_calc || has_aulas) sprintf("%d componente(s), n objetivo %d, %d unidad(es) de aulas.", protocol$sample_components_count, protocol$sample_target_n, protocol$classroom_units_count) else "Sin diseno muestral calculado.",
      c(if (has_aulas) "Selección de cursos-horario disponible" else "", if (protocol$sample_target_n > 0L) sprintf("n=%d", protocol$sample_target_n) else ""),
      category = "metodologia"
    ),
    .diseno_status(
      "hojas-ruta", "Hojas de ruta", "/hojas-ruta", if (has_hojas) "ready" else "pending",
      if (has_hojas) sprintf("Fase %s con %d bloque(s) de salida.", protocol$route_phase, protocol$route_outputs_count) else "Sin rutas o cartografia operativa.",
      c(.diseno_scalar(protocol$route_phase, ""), if (has_hojas) "Estado territorial local" else ""),
      category = "campo"
    ),
    .diseno_status(
      "plan-trabajo", "Cronograma", "/bitacora?seccion=cronograma", if (has_plan) "ready" else "pending",
      if (has_plan) sprintf("%d actividad(es), %d hito(s) y %d ventana(s) sincronizables.", protocol$workplan_tasks_count, protocol$workplan_milestones_count, protocol$workplan_windows_count) else "Sin cronograma operativo importado.",
      c(.diseno_scalar(protocol$workplan_title, ""), if (has_plan) "Cronograma normalizado" else ""),
      category = "campo"
    ),
    .diseno_status(
      "recopiladores", "Fichas QR", "/recopiladores", if (has_recop) "ready" else if (has_aulas) "active" else "pending",
      if (has_recop) "Agenda o publicación de fichas de cursos-horario conectada." else if (has_aulas) "Selección de cursos-horario lista para preparar fichas." else "Requiere selección de cursos-horario.",
      c(if (has_recop) "Agenda de aulas" else "", if (has_aulas) "Plan desde Calculo de muestra" else ""),
      category = "campo"
    ),
    .diseno_status(
      "monitoreo", "Monitoreo", "/monitoreo", if (has_mon) "ready" else "pending",
      if (has_mon) sprintf("%d fuente(s), familia %s.", protocol$monitoring_sources_count, protocol$monitoring_family) else "Sin fuentes ni snapshot de monitoreo.",
      c(if (protocol$monitoring_sources_count > 0L) sprintf("%d fuente(s)", protocol$monitoring_sources_count) else "", protocol$monitoring_family),
      category = "campo"
    )
  )
}

.diseno_decisions <- function(s, statuses, protocol) {
  out <- list()
  add <- function(title, detail, source, tone = "base") {
    out[[length(out) + 1L]] <<- list(title = title, detail = detail, source = source, tone = tone)
  }
  if (protocol$bases_count > 0L) {
    add("Base de estudio definida", sprintf("%d base(s) y %d registros forman el universo operativo cargado.", protocol$bases_count, protocol$records_count), "Carga", "ready")
  }
  if (protocol$sample_target_n > 0L) {
    add("Tamano muestral trazable", sprintf("El calculo declara n objetivo %d y n operativo %d.", protocol$sample_target_n, protocol$sample_operational_n), "Calculo de muestra", "ready")
  }
  if (protocol$classroom_units_count > 0L) {
    add("Agenda de aulas disponible", sprintf("%d unidad(es) de aula pueden fluir hacia fichas QR y monitoreo.", protocol$classroom_units_count), "Calculo de muestra", "ready")
  }
  if (.diseno_has_content(s$hojas_ruta_workspace_outputs)) {
    add("Territorio operativo documentado", "Hojas de ruta aporta configuracion, fase y salidas territoriales para campo.", "Hojas de ruta", "ready")
  }
  if (protocol$workplan_tasks_count > 0L) {
    add("Cronograma operativo importado", sprintf("Plan de Trabajo aporta %d actividad(es) y %d hito(s) para comparar planificado contra ejecutado.", protocol$workplan_tasks_count, protocol$workplan_milestones_count), "Plan de trabajo", "ready")
  }
  if (.diseno_has_content(s$monitoreo_snapshot) || .diseno_has_content(s$monitoreo_sources)) {
    add("Corte de campo conectable", "Monitoreo aporta fuentes, snapshot o familia operativa para controlar avance.", "Monitoreo", "ready")
  }
  if (length(out) == 0L) {
    add("Expediente en preparacion", "Carga datos o inicia el calculo metodologico para que el protocolo se complete automaticamente.", "Diseno del estudio", "warning")
  }
  out
}

.diseno_auto_timeline <- function(statuses, decisions, risks) {
  status_events <- lapply(statuses, function(item) {
    list(
      id = paste0("auto-source-", item$id),
      kind = "auto",
      module_id = item$id,
      tone = if (identical(item$state, "ready")) "avance" else if (identical(item$state, "warning")) "riesgo" else "nota",
      title = item$label,
      body = item$summary,
      occurred_at = "",
      route = item$route,
      source = "estado del modulo"
    )
  })
  decision_events <- lapply(seq_along(decisions), function(i) {
    item <- decisions[[i]]
    list(
      id = paste0("auto-decision-", i),
      kind = "auto",
      module_id = "diseno-estudio",
      tone = item$tone %||% "decision",
      title = item$title,
      body = item$detail,
      occurred_at = "",
      route = "/diseno-estudio",
      source = item$source
    )
  })
  risk_events <- lapply(seq_along(risks), function(i) {
    item <- risks[[i]]
    list(
      id = paste0("auto-risk-", i),
      kind = "auto",
      module_id = "diseno-estudio",
      tone = if (identical(item$severity, "ready")) "avance" else "riesgo",
      title = item$title,
      body = item$detail,
      occurred_at = "",
      route = item$route,
      source = "control de completitud"
    )
  })
  c(decision_events, risk_events, status_events)
}

.diseno_risks <- function(statuses, protocol) {
  out <- list()
  add <- function(title, detail, route, severity = "warning") {
    out[[length(out) + 1L]] <<- list(title = title, detail = detail, route = route, severity = severity)
  }
  by_id <- setNames(statuses, vapply(statuses, `[[`, character(1), "id"))
  if (identical(by_id$carga$state, "pending")) {
    add("Sin base cargada", "El protocolo no puede sostener poblacion, variables ni avance sin datos de estudio.", "/carga")
  }
  if (identical(by_id$validacion$state, "pending") && protocol$records_count > 0L) {
    add("Validacion pendiente", "La ficha puede explicar el estudio, pero falta evidencia de calidad de datos.", "/validacion")
  }
  if (identical(by_id[["calc-muestra"]]$state, "pending")) {
    add("Muestra sin sustento calculado", "Define componentes, marco o meta para que la seleccion quede trazable.", "/calc-muestra")
  }
  if (identical(by_id$monitoreo$state, "pending") && (protocol$classroom_units_count > 0L || protocol$route_outputs_count > 0L)) {
    add("Campo sin monitoreo conectado", "Hay insumos operativos, pero aun no existe fuente/snapshot para seguimiento.", "/monitoreo")
  }
  if (length(out) == 0L) {
    add("Sin riesgos criticos detectados", "El expediente tiene fuentes suficientes para revisar y continuar.", "/diseno-estudio", "ready")
  }
  out
}

.diseno_next_actions <- function(statuses) {
  pending <- Filter(function(item) !identical(item$state, "ready"), statuses)
  pending <- utils::head(pending, 5L)
  lapply(pending, function(item) {
    list(
      label = item$label,
      route = item$route,
      reason = item$summary,
      state = item$state
    )
  })
}

.diseno_estudio_state_payload <- function(sid) {
  s <- session_get(sid)
  protocol <- .diseno_protocol_summary(s)
  statuses <- .diseno_module_statuses(s, protocol)
  weights <- vapply(statuses, function(item) .diseno_state_weight(item$state), numeric(1))
  score <- as.integer(round(100 * sum(weights) / max(length(statuses), 1L)))
  ready_count <- sum(vapply(statuses, function(item) identical(item$state, "ready"), logical(1)))
  decisions <- .diseno_decisions(s, statuses, protocol)
  risks <- .diseno_risks(statuses, protocol)
  bitacora <- .diseno_bitacora_entries(s)
  manual_timeline <- lapply(bitacora, function(entry) {
    c(entry, list(kind = "manual", route = "/diseno-estudio", source = "bitacora del usuario"))
  })

  list(
    ok = TRUE,
    schema = "diseno_estudio_state_v1",
    generated_at = .diseno_now_iso(),
    protocol = protocol,
    readiness = list(
      score = score,
      ready_count = as.integer(ready_count),
      total_count = length(statuses),
      pending_count = as.integer(sum(vapply(statuses, function(item) identical(item$state, "pending"), logical(1)))),
      active_count = as.integer(sum(vapply(statuses, function(item) identical(item$state, "active"), logical(1)))),
      warning_count = as.integer(sum(vapply(statuses, function(item) identical(item$state, "warning"), logical(1))))
    ),
    sources = statuses,
    decisions = decisions,
    risks = risks,
    next_actions = .diseno_next_actions(statuses),
    bitacora = bitacora,
    timeline = c(manual_timeline, .diseno_auto_timeline(statuses, decisions, risks)),
    library = .diseno_library_summary()
  )
}

mount_diseno_estudio <- function(pr) {
  pr |>
    plumber::pr_get("/api/diseno-estudio/state",
                    wrap_endpoint(function(req, res) {
      .diseno_estudio_state_payload(session_header(req))
    })) |>
    plumber::pr_post("/api/diseno-estudio/bitacora",
                     wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      body <- .diseno_parse_body(req)
      entry <- .diseno_bitacora_entry(body$entry %||% body)
      .diseno_bitacora_upsert(sid, entry)
      .diseno_estudio_state_payload(sid)
    })) |>
    plumber::pr_delete("/api/diseno-estudio/bitacora/<id>",
                       wrap_endpoint(function(req, res, id) {
      sid <- session_header(req)
      .diseno_bitacora_delete(sid, id)
      .diseno_estudio_state_payload(sid)
    })) |>
    # Alias canonicos del modulo Bitacora. La clave persistente sigue siendo
    # `diseno_estudio_bitacora` (compat con .pulso existentes). El GET es liviano
    # (solo entradas) para que el modulo no cargue el payload de expediente.
    plumber::pr_get("/api/bitacora",
                    wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      list(
        ok = TRUE,
        schema = "bitacora_v1",
        generated_at = .diseno_now_iso(),
        bitacora = .diseno_bitacora_entries(session_get(sid))
      )
    })) |>
    plumber::pr_post("/api/bitacora",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .diseno_parse_body(req)
      entry <- .diseno_bitacora_entry(body$entry %||% body)
      entries <- .diseno_bitacora_upsert(sid, entry)
      list(ok = TRUE, schema = "bitacora_v1", generated_at = .diseno_now_iso(), bitacora = entries)
    })) |>
    plumber::pr_delete("/api/bitacora/<id>",
                       wrap_endpoint(function(req, res, id, ...) {
      sid <- session_header(req)
      entries <- .diseno_bitacora_delete(sid, id)
      list(ok = TRUE, schema = "bitacora_v1", generated_at = .diseno_now_iso(), bitacora = entries)
    }))
}
