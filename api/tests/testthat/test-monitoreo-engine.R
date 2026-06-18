test_that("monitoreo calcula KPIs, metas e inconsistencias", {
  data <- data.frame(
    id = c("a", "b", "b", "d"),
    enumerador = c("Ana", "Ana", "Luis", "Luis"),
    distrito = c("Norte", "Norte", "Sur", "Sur"),
    estado = c("completed", "completed", "rejected", "completed"),
    fecha = c("2026-05-01T10:00:00Z", "2026-05-01T11:00:00Z", "2026-05-02T10:00:00Z", "2026-05-02T10:30:00Z"),
    duracion = c(120, 20, 500, 8000),
    telefono = c("1", "", "3", "4"),
    stringsAsFactors = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    id_var = "id",
    enumerator_var = "enumerador",
    date_var = "fecha",
    duration_var = "duracion",
    status_var = "estado",
    valid_statuses = c("completed"),
    control_vars = c("distrito"),
    critical_vars = c("telefono"),
    goals = list(
      list(filters = list(distrito = "Norte"), meta = 5L, meta_pct = 50),
      list(filters = list(distrito = "Sur"), meta = 5L)
    ),
    min_duration_seconds = 60,
    max_duration_seconds = 7200
  ), data)

  dash <- monitoreo_build_dashboard(data, cfg)
  expect_equal(dash$kpis$total, 4L)
  expect_equal(dash$kpis$valid, 3L)
  expect_equal(dash$kpis$target, 10L)
  expect_equal(length(cfg$operational_model$targets), 2L)
  expect_equal(cfg$goals[[1]]$meta_pct, 50)
  expect_equal(dash$progress$observado[dash$progress$distrito == "Norte"], 2L)
  expect_true(any(dash$inconsistencies$tipo == "estado_invalido"))
  expect_true(any(dash$inconsistencies$tipo == "campo_critico_vacio"))
  expect_true(any(dash$inconsistencies$tipo == "id_duplicado"))
  expect_true(any(dash$inconsistencies$tipo == "duracion_muy_corta"))
  expect_true(any(dash$inconsistencies$tipo == "duracion_muy_larga"))
})

test_that("monitoreo usa dimensiones de fuente para avance multiformulario", {
  source <- monitoreo_normalize_sources(list(list(
    kind = "surveymonkey",
    label = "Acreditacion Contabilidad PUCP - Estudiantes",
    survey_id = "527327742",
    dimensions = list(actor = "Estudiantes", servicio = "Contabilidad PUCP")
  )))[[1]]
  data <- .monitoreo_add_source_columns(
    data.frame(estado = c("completed", "completed", "rejected"), stringsAsFactors = FALSE),
    source
  )

  expect_equal(source$dimensions$actor, "Estudiantes")
  expect_equal(data$dim_actor, rep("Estudiantes", 3))
  expect_equal(data$dim_servicio, rep("Contabilidad PUCP", 3))

  dash <- monitoreo_build_dashboard(data, list(
    status_var = "estado",
    valid_statuses = "completed",
    goals = list(list(filters = list(dim_actor = "Estudiantes"), meta = 5L))
  ))

  expect_true("dim_actor" %in% names(dash$progress))
  expect_equal(dash$progress$observado[dash$progress$dim_actor == "Estudiantes"], 2L)
  expect_equal(dash$progress$meta[dash$progress$dim_actor == "Estudiantes"], 5L)
})

test_that("monitoreo agrupa por dimensiones genericas cuando no hay control vars", {
  source <- monitoreo_normalize_sources(list(list(
    kind = "surveymonkey",
    label = "Encuesta de avance",
    survey_id = "sm_1",
    dimensions = list(segmento = "Grupo A", territorio = "Norte")
  )))[[1]]
  data <- .monitoreo_add_source_columns(
    data.frame(estado = c("completed", "rejected"), stringsAsFactors = FALSE),
    source
  )

  dash <- monitoreo_build_dashboard(data, list(
    status_var = "estado",
    valid_statuses = "completed",
    goals = list(list(filters = list(dim_segmento = "Grupo A"), meta = 3L))
  ))

  expect_true("dim_segmento" %in% names(dash$progress))
  expect_true("dim_territorio" %in% names(dash$progress))
  expect_equal(dash$progress$observado[dash$progress$dim_segmento == "Grupo A"], 1L)
  expect_equal(dash$progress$meta[dash$progress$dim_segmento == "Grupo A"], 3L)
})

test_that("Kobo arma URL incremental con query por _id", {
  url <- kobo_api_asset_data_url(
    "asset 1",
    base_url = "https://kobo.unhcr.org/",
    page = 2L,
    page_size = 2000L,
    query = list(`_id` = list(`$gt` = 123))
  )

  expect_match(url, "^https://kobo\\.unhcr\\.org/api/v2/assets/asset%201/data/")
  expect_match(url, "page=2", fixed = TRUE)
  expect_match(url, "page_size=1000", fixed = TRUE)
  expect_match(utils::URLdecode(url), '"_id":{"$gt":123', fixed = TRUE)
})

test_that("merge incremental de monitoreo preserva snapshot y actualiza filas Kobo", {
  prev <- data.frame(
    .source_id = c("kobo_field", "kobo_field", "sheet_meta"),
    `_id` = c(1, 2, 1),
    valor = c("antigua 1", "antigua 2", "meta"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  delta <- data.frame(
    .source_id = c("kobo_field", "kobo_field"),
    `_id` = c(2, 3),
    valor = c("actualizada 2", "nueva 3"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  merged <- .monitoreo_merge_sync_result_data(
    prev,
    delta,
    synced_source_ids = "kobo_field",
    incremental_source_ids = "kobo_field"
  )

  expect_equal(nrow(merged), 4L)
  expect_equal(merged$valor[merged$.source_id == "sheet_meta"], "meta")
  expect_equal(merged$valor[merged$.source_id == "kobo_field" & merged$`_id` == 1], "antigua 1")
  expect_equal(merged$valor[merged$.source_id == "kobo_field" & merged$`_id` == 2], "actualizada 2")
  expect_equal(merged$valor[merged$.source_id == "kobo_field" & merged$`_id` == 3], "nueva 3")
})

test_that("merge de monitoreo conserva fuentes que fallan en sync parcial", {
  prev <- data.frame(
    .source_id = c("sheet_base", "sm_docentes", "sm_estudiantes"),
    response_id = c("", "r1", "r2"),
    valor = c("base vieja", "docente previa", "estudiante previa"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  result <- data.frame(
    .source_id = "sheet_base",
    response_id = "",
    valor = "base nueva",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  sync_summary <- list(sheet_base = list(
    source_id = "sheet_base",
    source_label = "Base",
    kind = "google_sheets",
    mode = "full",
    rows = 1L
  ))
  synced <- .monitoreo_sync_successful_source_ids(sync_summary, result)

  merged <- .monitoreo_merge_sync_result_data(
    prev,
    result,
    synced_source_ids = synced
  )

  expect_equal(sort(unique(merged$.source_id)), c("sheet_base", "sm_docentes", "sm_estudiantes"))
  expect_equal(merged$valor[merged$.source_id == "sheet_base"], "base nueva")
  expect_equal(merged$valor[merged$.source_id == "sm_docentes"], "docente previa")
  expect_equal(merged$valor[merged$.source_id == "sm_estudiantes"], "estudiante previa")
})

test_that("inspeccion SurveyMonkey prepara columnas y filas de muestra", {
  df <- data.frame(
    response_id = c("r1", "r2"),
    p1 = c("Si", ""),
    p2 = c(NA_character_, "No"),
    stringsAsFactors = FALSE
  )
  columns <- .sm_mb_preview_columns(df)
  rows <- .sm_mb_preview_rows(df, limit = 1L)

  expect_equal(columns[[1]]$name, "response_id")
  expect_equal(columns[[2]]$non_empty, 1L)
  expect_equal(rows[[1]]$response_id, "r1")
  expect_equal(rows[[1]]$p2, "")
})

test_that("monitoreo normaliza fases de estrategia operativa", {
  cfg <- monitoreo_normalize_config(list(
    strategy_phases = list(
      list(
        id = "fase-1",
        stratum = "Egresados",
        modality = "telefono",
        start_week = 3L,
        end_week = 1L,
        target_rule = "Pendientes contactables",
        kpi_focus = c("contacto efectivo", "conversion"),
        kpi_modules = c("progress", "enumerator_activity", "non_effective_attempts", "no_existe"),
        breakdown_vars = c("anio_egreso", "tipo_docente"),
        attempts_var = "intentos",
        outcome_var = "resultado"
      ),
      list(modality = "no-existe", regla = "")
    )
  ))

  expect_equal(length(cfg$strategy_phases), 1L)
  expect_equal(cfg$strategy_phases[[1]]$stratum, "Egresados")
  expect_equal(cfg$strategy_phases[[1]]$modality, "telefono")
  expect_equal(cfg$strategy_phases[[1]]$end_week, 3L)
  expect_equal(cfg$strategy_phases[[1]]$kpi_focus[[1]], "contacto efectivo")
  expect_equal(cfg$strategy_phases[[1]]$kpi_modules, list("progress", "enumerator_activity", "non_effective_attempts"))
  expect_equal(cfg$strategy_phases[[1]]$breakdown_vars, list("anio_egreso", "tipo_docente"))
  expect_equal(cfg$strategy_phases[[1]]$attempts_var, "intentos")
  expect_equal(cfg$strategy_phases[[1]]$outcome_var, "resultado")
})

test_that("monitoreo filtra variables de fase contra columnas disponibles", {
  data <- data.frame(resultado = "no_contesta", anio_egreso = "2020", stringsAsFactors = FALSE)
  cfg <- monitoreo_normalize_config(list(
    strategy_phases = list(list(
      stratum = "Egresados",
      modality = "telefono",
      kpi_modules = c("progress", "contact_efficiency"),
      breakdown_vars = c("anio_egreso", "campo_inexistente"),
      attempts_var = "intentos",
      outcome_var = "resultado"
    ))
  ), data)

  phase <- cfg$strategy_phases[[1]]
  expect_equal(phase$breakdown_vars, list("anio_egreso"))
  expect_equal(phase$attempts_var, "")
  expect_equal(phase$outcome_var, "resultado")
})

test_that("acreditacion no infiere codigo desde preguntas SurveyMonkey genericas", {
  profile <- monitoreo_normalize_profile(list(
    family = "acreditacion",
    key_rules = list(
      response_fields = c("CodPulso", "Código PUCP", "Codigo PUCP", "email_address", "custom_value", "cv_id"),
      universe_fields = c("CodPulso", "Código", "correo"),
      automatic_detection = TRUE
    )
  ))
  response <- data.frame(
    .source_id = "sm-docentes",
    .source_role = "respuestas",
    dim_actor = "Docentes",
    response_id = "r1",
    response_status = "completed",
    q0003 = "02003102",
    q0004 = "64",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  attr(response, "variable_labels") <- c(
    q0003 = "¿Cuántos años tiene en la actualidad?",
    q0004 = "¿Cuál es su código PUCP ?"
  )

  details <- .monitoreo_report_key_details(response, profile, "respuesta")[[1]]
  expect_length(details, 0L)
})

test_that("acreditacion usa solo codigo explicito o etiqueta confiable por fuente", {
  profile <- monitoreo_normalize_profile(list(
    family = "acreditacion",
    key_rules = list(
      response_fields = c("CodPulso", "Código PUCP", "Codigo PUCP", "email_address", "custom_value", "cv_id"),
      universe_fields = c("CodPulso", "Código", "correo"),
      automatic_detection = TRUE
    )
  ))
  explicit <- data.frame(
    .source_id = "sm-docentes",
    .source_role = "respuestas",
    response_status = "completed",
    custom_value = "02003102",
    q0004 = "64",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  explicit_details <- .monitoreo_report_key_details(explicit, profile, "respuesta")[[1]]
  expect_true("codigo:02003102" %in% vapply(explicit_details, `[[`, character(1), "key"))
  expect_false("codigo:64" %in% vapply(explicit_details, `[[`, character(1), "key"))

  labelled <- data.frame(
    .source_id = "sm-docentes",
    .source_role = "respuestas",
    response_status = "completed",
    q0003 = "64",
    q0004 = "02003102",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  attr(labelled, "variable_labels") <- c(
    q0003 = "¿Cuál es su código PUCP ?",
    q0004 = "¿Cuántos años tiene en la actualidad?"
  )
  labelled <- .monitoreo_set_source_variable_labels(labelled, "sm-docentes", c(
    q0003 = "¿Cuántos años tiene en la actualidad?",
    q0004 = "¿Cuál es su código PUCP ?"
  ))
  labelled_details <- .monitoreo_report_key_details(labelled, profile, "respuesta")[[1]]
  expect_true("codigo:02003102" %in% vapply(labelled_details, `[[`, character(1), "key"))
  expect_false("codigo:64" %in% vapply(labelled_details, `[[`, character(1), "key"))
})

test_that("monitoreo territorial preserva fase activa previa cuando el payload la omite", {
  previous <- monitoreo_territorial_normalize_config(list(
    active_route_phase = "field",
    phase_sources = list(
      pilot = list(source_id = "src_pilot", asset_uid = "asset_pilot"),
      field = list(source_id = "src_field", asset_uid = "asset_field")
    )
  ))

  normalized <- monitoreo_territorial_normalize_config(
    list(phase_sources = list(pilot = list(source_id = "src_pilot_new", asset_uid = "asset_pilot_new"))),
    previous = previous
  )

  expect_equal(normalized$active_route_phase, "field")
  expect_equal(normalized$source_id, "src_field")
  expect_equal(normalized$phase_sources$field$source_id, "src_field")
  expect_equal(normalized$phase_sources$pilot$source_id, "src_pilot_new")

  full <- monitoreo_normalize_config(
    list(enumerator_var = "encuestador"),
    previous_config = list(territorial = previous)
  )
  expect_equal(full$territorial$active_route_phase, "field")
})

test_that("monitoreo territorial respeta cambio explicito de fase", {
  previous <- monitoreo_territorial_normalize_config(list(
    active_route_phase = "field",
    phase_sources = list(
      pilot = list(source_id = "src_pilot", asset_uid = "asset_pilot"),
      field = list(source_id = "src_field", asset_uid = "asset_field")
    )
  ))

  normalized <- monitoreo_territorial_normalize_config(
    list(active_route_phase = "pilot"),
    previous = previous
  )

  expect_equal(normalized$active_route_phase, "pilot")
  expect_equal(normalized$source_id, "src_pilot")
  expect_equal(normalized$phase_sources$field$source_id, "src_field")
})

test_that("monitoreo territorial guarda mapping operativo por fase", {
  previous <- monitoreo_territorial_normalize_config(list(
    active_route_phase = "pilot",
    district_var = "district_pilot",
    ump_var = "ump_pilot",
    pulso_code_var = "pulso_pilot",
    submitted_by_var = "user_pilot",
    platform_effective_var = "filter_pilot",
    platform_effective_values = list("ok_pilot")
  ))

  normalized <- monitoreo_territorial_normalize_config(
    list(
      active_route_phase = "field",
      district_var = "district_field",
      ump_var = "ump_field",
      pulso_code_var = "pulso_field",
      submitted_by_var = "user_field",
      platform_effective_var = "filter_field",
      platform_effective_values = list("ok_field")
    ),
    previous = previous
  )

  expect_equal(normalized$active_route_phase, "field")
  expect_equal(normalized$district_var, "district_field")
  expect_equal(normalized$phase_mappings$field$district_var, "district_field")
  expect_equal(normalized$phase_mappings$field$platform_effective_values, list("ok_field"))
  expect_equal(normalized$phase_mappings$pilot$district_var, "district_pilot")
  expect_equal(normalized$phase_mappings$pilot$ump_var, "ump_pilot")
  expect_equal(normalized$phase_mappings$pilot$pulso_code_var, "pulso_pilot")
  expect_equal(normalized$phase_mappings$pilot$submitted_by_var, "user_pilot")
  expect_equal(normalized$phase_mappings$pilot$platform_effective_var, "filter_pilot")
  expect_equal(normalized$phase_mappings$pilot$platform_effective_values, list("ok_pilot"))
})

test_that("monitoreo territorial acepta alias de codigo Pulso del encuestador", {
  data <- data.frame(
    district = "sjm",
    ump = "150133001001",
    gps = "-12 -77",
    code_enum = "P001",
    filtro = "si",
    check.names = FALSE
  )
  normalized <- monitoreo_territorial_normalize_config(
    list(
      active_route_phase = "field",
      district_var = "district",
      ump_var = "ump",
      gps_var = "gps",
      enumerator_pulso_code = "code_enum",
      platform_effective_var = "filtro",
      platform_effective_values = list("si"),
      invalid_value = "no"
    ),
    data = data
  )

  expect_equal(normalized$pulso_code_var, "code_enum")
  expect_equal(normalized$phase_mappings$field$pulso_code_var, "code_enum")
  expect_false("invalid_value" %in% names(normalized$phase_mappings$field))
})

test_that("monitoreo territorial advierte cuando codigo Pulso parece numero de encuesta", {
  operational_blocks <- data.frame(
    id_manzana = c("150135049000630", "15013503000001F"),
    ubigeo = c("150135", "150135"),
    tipo_manzana = c("titular", "reemplazo"),
    rango_inicio = c(1089L, 1089L),
    rango_fin = c(1096L, 1096L),
    titular_id_manzana = c("", "150135049000630"),
    titular_rango_inicio = c(NA_integer_, 1089L),
    titular_rango_fin = c(NA_integer_, 1096L),
    responsable = c("", ""),
    stringsAsFactors = FALSE
  )

  warned <- .monitoreo_territorial_code_range_warning(
    pulso_code_raw = c("1089", "1094_630", "P198", "1088"),
    pulso_code_recognized = c(FALSE, FALSE, TRUE, FALSE),
    nearest_block_id = rep("150135049000630", 4),
    operational_blocks = operational_blocks
  )

  expect_equal(warned, c(TRUE, TRUE, FALSE, FALSE))
})

test_that("monitoreo territorial no usa el rango para resolver responsables", {
  operational_blocks <- data.frame(
    id_manzana = "150135049000630",
    ubigeo = "150135",
    tipo_manzana = "titular",
    rango_inicio = 1089L,
    rango_fin = 1096L,
    responsable = "",
    stringsAsFactors = FALSE
  )

  warned <- .monitoreo_territorial_code_range_warning(
    pulso_code_raw = c("P101", "P102", "1089"),
    pulso_code_recognized = c(TRUE, TRUE, FALSE),
    nearest_block_id = rep("150135049000630", 3),
    operational_blocks = operational_blocks
  )

  expect_equal(warned, c(FALSE, FALSE, TRUE))
})

test_that("monitoreo territorial mantiene Campo aunque la fuente de Campo este vacia", {
  normalized <- monitoreo_territorial_normalize_config(list(
    active_route_phase = "field",
    phase_sources = list(
      pilot = list(source_id = "src_pilot", asset_uid = "asset_pilot"),
      field = list()
    )
  ))
  status <- monitoreo_territorial_phase_source_status(normalized, "field")

  expect_equal(normalized$active_route_phase, "field")
  expect_equal(normalized$source_id, "")
  expect_equal(status$phase_source_status, "missing_source")
})

test_that("monitoreo territorial cambia fuente activa sin borrar la otra fase", {
  cfg <- monitoreo_territorial_normalize_config(list(
    active_route_phase = "pilot",
    phase_sources = list(
      pilot = list(source_id = "src_pilot", asset_uid = "asset_pilot"),
      field = list(source_id = "src_field", asset_uid = "asset_field")
    )
  ))
  switched <- monitoreo_territorial_normalize_config(
    list(active_route_phase = "field"),
    previous = cfg
  )

  expect_equal(switched$active_route_phase, "field")
  expect_equal(switched$source_id, "src_field")
  expect_equal(switched$phase_sources$pilot$source_id, "src_pilot")
  expect_equal(switched$phase_sources$field$source_id, "src_field")
})

test_that("monitoreo territorial preserva fuente duplicada sin borrar la fase seleccionada", {
  normalized <- monitoreo_territorial_normalize_config(list(
    active_route_phase = "field",
    phase_sources = list(
      pilot = list(source_id = "src_same", asset_uid = "asset_same"),
      field = list(source_id = "src_same", asset_uid = "asset_same")
    )
  ))
  status <- monitoreo_territorial_phase_source_status(normalized, "field")

  expect_equal(normalized$active_route_phase, "field")
  expect_equal(normalized$phase_sources$field$source_id, "src_same")
  expect_equal(normalized$source_id, "src_same")
  expect_equal(status$phase_source_status, "configured")
})

test_that("monitoreo territorial no cruza fuente por asset entre piloto y campo", {
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial"),
    territorial = list(
      active_route_phase = "field",
      phase_sources = list(
        pilot = list(source_id = "src_pilot", asset_uid = "asset_shared", kobo_asset_name = "Piloto"),
        field = list(source_id = "", asset_uid = "asset_shared", kobo_asset_name = "Campo")
      )
    )
  ))
  sources <- monitoreo_normalize_sources(list(
    list(
      id = "src_pilot",
      kind = "kobo",
      label = "Piloto",
      enabled = TRUE,
      role = "respuestas",
      asset_uid = "asset_shared",
      dimensions = list(territorial_phase = "pilot")
    )
  ))

  source <- .monitoreo_territorial_source(sources, cfg, phase = "field")
  coherence <- .monitoreo_territorial_phase_coherence(
    data = data.frame(.source_id = "src_pilot", check.names = FALSE),
    cfg = cfg,
    sources = sources
  )

  expect_null(source)
  expect_false(coherence$phases$field$source_exists)
  expect_equal(coherence$phases$field$status, "source_applied_not_synced")
  expect_true(coherence$phases$pilot$source_exists)
})

test_that("monitoreo territorial diagnostica fuente aplicada pendiente de sincronizacion", {
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial"),
    territorial = list(
      active_route_phase = "field",
      phase_sources = list(
        pilot = list(source_id = "src_pilot", asset_uid = "asset_pilot", kobo_asset_name = "Piloto"),
        field = list(source_id = "src_field", asset_uid = "asset_field", kobo_asset_name = "Campo VF")
      )
    )
  ))
  sources <- monitoreo_normalize_sources(list(
    list(
      id = "src_pilot",
      kind = "kobo",
      label = "Piloto",
      enabled = TRUE,
      role = "respuestas",
      asset_uid = "asset_pilot",
      dimensions = list(territorial_phase = "pilot"),
      last_sync_at = "2026-06-01T00:00:00Z"
    ),
    list(
      id = "src_field",
      kind = "kobo",
      label = "Campo VF",
      enabled = TRUE,
      role = "respuestas",
      asset_uid = "asset_field",
      dimensions = list(territorial_phase = "field")
    )
  ))
  data <- data.frame(
    .source_id = c("src_pilot", "src_pilot"),
    `_uuid` = c("p1", "p2"),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )

  coherence <- .monitoreo_territorial_phase_coherence(
    data = data,
    cfg = cfg,
    sources = sources,
    synced_at = "2026-06-01T00:00:00Z"
  )

  expect_equal(coherence$phases$field$status, "source_applied_not_synced")
  expect_equal(coherence$phases$field$local_rows, 0L)
  expect_match(coherence$phases$field$message, "no hay respuestas sincronizadas localmente")
  expect_equal(coherence$phases$pilot$status, "source_synced_with_rows")
  expect_equal(coherence$phases$pilot$local_rows, 2L)
})

test_that("monitoreo territorial no marca stale cuando ventana de fase excluye filas locales", {
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial"),
    territorial = list(
      active_route_phase = "field",
      submission_time_var = "_submission_time",
      phase_windows = list(
        field = list(start_at = "2026-06-18T08:00:00Z")
      ),
      phase_sources = list(
        field = list(source_id = "src_field", asset_uid = "asset_field", kobo_asset_name = "Campo VF")
      )
    )
  ))
  sources <- monitoreo_normalize_sources(list(
    list(
      id = "src_field",
      kind = "kobo",
      label = "Campo VF",
      enabled = TRUE,
      role = "respuestas",
      asset_uid = "asset_field",
      dimensions = list(territorial_phase = "field"),
      last_sync_at = "2026-06-18T09:00:00Z"
    )
  ))
  data <- data.frame(
    .source_id = c("src_field", "src_field", "src_field"),
    `_submission_time` = c(
      "2026-06-18T07:59:00Z",
      "2026-06-18T08:01:00Z",
      "2026-06-18T08:02:00Z"
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  dashboard <- list(
    territorial_reports = list(
      active_route_phase = "field",
      source_validity = list(total_responses = 2L),
      source_coherence = list(asset_uid = "asset_field")
    )
  )

  coherence <- .monitoreo_territorial_phase_coherence(
    data = data,
    cfg = cfg,
    sources = sources,
    dashboard = dashboard
  )

  expect_equal(coherence$phases$field$local_rows, 3L)
  expect_equal(coherence$phases$field$report_rows, 2L)
  expect_true(isTRUE(coherence$phases$field$dashboard_matches_source))
  expect_equal(coherence$phases$field$status, "source_synced_with_rows")
})

test_that("monitoreo territorial invalida snapshot de una fase sin borrar la otra", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial"),
    territorial = list(
      active_route_phase = "field",
      phase_sources = list(
        pilot = list(source_id = "src_pilot", asset_uid = "asset_pilot", kobo_asset_name = "Piloto"),
        field = list(source_id = "src_field", asset_uid = "asset_old", kobo_asset_name = "Campo viejo")
      )
    )
  ))
  data <- data.frame(
    .source_id = c("src_pilot", "src_field", "src_field"),
    `_uuid` = c("p1", "f1", "f2"),
    estado = c("completed", "completed", "completed"),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  session_set(sid, "monitoreo_config", cfg)
  session_set(sid, "monitoreo_snapshot", list(
    synced_at = "2026-06-01T00:00:00Z",
    data = data,
    config = cfg,
    dashboard = monitoreo_build_dashboard(data, cfg),
    variables = monitoreo_variables(data),
    errors = list()
  ))

  removed <- .monitoreo_prune_snapshot_source_ids(sid, "src_field", cfg)
  remaining <- session_get(sid)$monitoreo_snapshot$data

  expect_equal(removed, 2L)
  expect_equal(nrow(remaining), 1L)
  expect_equal(unique(remaining$.source_id), "src_pilot")
})

test_that("monitoreo normaliza modelo operativo local", {
  cfg <- monitoreo_normalize_config(list())

  expect_equal(cfg$operational_model$schema_version, "monitoreo_operativo_v1")
  expect_equal(length(cfg$operational_model$targets), 0L)
  expect_true(length(cfg$operational_model$events) >= 8L)
  expect_true(length(cfg$operational_model$state_rules) >= 5L)
  expect_true(isTRUE(cfg$operational_model$privacy$local_sensitive))
  expect_equal(cfg$operational_model$privacy$export_policy, "aggregate_or_redacted")
})

test_that("monitoreo completa eventos y reglas base en modelos operativos antiguos", {
  cfg <- monitoreo_normalize_config(list(
    operational_model = list(
      events = list(list(
        id = "custom_whatsapp",
        label = "WhatsApp manual",
        modality = "whatsapp",
        outcome = "contactado",
        counts_attempt = TRUE
      )),
      state_rules = list(list(
        id = "custom_complete",
        label = "Efectiva local",
        final_state = "complete",
        outcome_values = c("efectiva")
      ))
    )
  ))

  event_ids <- vapply(cfg$operational_model$events, function(item) item$id, character(1))
  rule_ids <- vapply(cfg$operational_model$state_rules, function(item) item$id, character(1))

  expect_true("custom_whatsapp" %in% event_ids)
  expect_true("email_bounced" %in% event_ids)
  expect_true("custom_complete" %in% rule_ids)
  expect_true("non_effective_contact" %in% rule_ids)
})

test_that("monitoreo modelo operativo filtra variables sensibles contra columnas", {
  data <- data.frame(
    case_id = "c1",
    telefono = "999999999",
    estado = "completed",
    zona = "Urbano",
    stringsAsFactors = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    operational_model = list(
      strata = list(
        list(label = "Urbano", variable = "zona", value = "Urbano"),
        list(label = "Invalido", variable = "no_existe", value = "X")
      ),
      personas_o_casos = list(
        enabled = TRUE,
        case_id_var = "case_id",
        status_var = "estado",
        contact_vars = c("telefono", "correo_inexistente"),
        sensitive_vars = c("telefono", "nombre_inexistente"),
        roster_source = "responses"
      ),
      strategies = list(list(label = "Refuerzo", objective = "Cerrar brecha", status = "active")),
      eventos = list(list(label = "Llamada efectiva", modality = "telefono", counts_attempt = TRUE, counts_contact = TRUE)),
      reglas_de_estado = list(list(label = "Completa", final_state = "complete", outcome_values = c("completed"))),
      privacidad = list(local_sensitive = TRUE, export_policy = "allow_case_level_local")
    )
  ), data)

  model <- cfg$operational_model
  expect_equal(length(model$strata), 2L)
  expect_equal(model$strata[[1]]$variable, "zona")
  expect_equal(model$strata[[2]]$variable, "")
  expect_true(isTRUE(model$cases$enabled))
  expect_equal(model$cases$case_id_var, "case_id")
  expect_equal(model$cases$contact_vars, list("telefono"))
  expect_equal(model$cases$sensitive_vars, list("telefono"))
  expect_equal(model$cases$roster_source, "responses")
  expect_equal(model$strategies[[1]]$status, "active")
  expect_true(isTRUE(model$events[[1]]$counts_attempt))
  expect_true(isTRUE(model$events[[1]]$counts_contact))
  expect_equal(model$state_rules[[1]]$outcome_values, list("completed"))
  expect_equal(model$privacy$export_policy, "allow_case_level_local")
})

test_that("monitoreo supervision es reproducible", {
  data <- data.frame(
    id = sprintf("id_%02d", 1:10),
    estado = rep("completed", 10),
    duracion = c(10, rep(200, 9)),
    stringsAsFactors = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    id_var = "id",
    status_var = "estado",
    duration_var = "duracion",
    valid_statuses = "completed",
    min_duration_seconds = 60
  ), data)
  a <- monitoreo_supervision_sample(data, cfg, n = 4, seed = 7)
  b <- monitoreo_supervision_sample(data, cfg, n = 4, seed = 7)
  expect_equal(a$id, b$id)
  expect_equal(nrow(a), 4L)
})

test_that("monitoreo demo carga snapshot sin credenciales", {
  demo <- monitoreo_demo_payload(seed = 7L, n = 24L)
  expect_true(isTRUE(demo$ok))
  expect_equal(nrow(demo$snapshot$data), 24L)
  expect_equal(demo$config$id_var, "response_id")
  expect_true(all(!vapply(demo$sources, `[[`, logical(1), "enabled")))
  expect_true(demo$snapshot$dashboard$kpis$total >= 24L)
  expect_true(isTRUE(demo$config$acreditacion$enabled))
  expect_equal(length(demo$config$acreditacion$componentes), 4L)
  expect_false(any(vapply(demo$sources, function(src) "token" %in% names(src), logical(1))))
})

test_that("monitoreo acreditacion calcula cumplimiento y cierre", {
  expect_equal(monitoreo_estado_cumplimiento(100, 100)$estado, "cumple_meta")
  expect_equal(monitoreo_estado_cumplimiento(97, 100)$estado, "brecha_menor_documentada")
  expect_equal(monitoreo_estado_cumplimiento(80, 100)$estado, "brecha_relevante")
  expect_equal(monitoreo_estado_cumplimiento(10, NA)$estado, "sin_objetivo")

  estudio <- list(
    id = "est-1",
    titulo = "Acreditacion test",
    macro_familia = "acreditacion",
    contexto = list(cliente = "PUCP"),
    componentes = list(
      list(
        id = "cmp-estudiantes",
        actor = "Estudiantes",
        actor_id = "estudiantes",
        tecnica = "prob_conglomerado_multietapico",
        marco = list(universo_bruto = 4200L, marco_validado = 4100L, marco_contactable = 3900L),
        meta = list(tipo = "objetivo", valor = 100L, variable_control = "nivel_curricular"),
        resultado = list(n_objetivo = 100L, tecnica = "prob_conglomerado_multietapico")
      )
    )
  )

  acr <- monitoreo_acreditacion_from_calc(estudio)
  expect_true(isTRUE(acr$enabled))
  expect_equal(acr$estudio$titulo, "Acreditacion test")
  expect_equal(acr$componentes[[1]]$marco$marco_actualizado, 4100L)
  expect_equal(acr$componentes[[1]]$seguimiento$cumplimiento$estado, "brecha_relevante")
  expect_error(monitoreo_acreditacion_cerrar(acr), "brechas relevantes")

  acr <- monitoreo_acreditacion_update_seguimiento(acr, list(
    id = "cmp-estudiantes",
    n_efectivo = 97L,
    notas_campo = "Cierre con brecha documentada",
    intentos_canal = list(email = 100L, whatsapp = 40L)
  ))
  expect_equal(acr$componentes[[1]]$seguimiento$cumplimiento$estado, "brecha_menor_documentada")
  expect_equal(acr$componentes[[1]]$seguimiento$intentos_canal$email, 100L)
  expect_true(isTRUE(acr$dashboard$cierre_habilitado))

  cerrado <- monitoreo_acreditacion_cerrar(acr)
  expect_equal(cerrado$modo_trabajo, "cierre_campo")
  expect_true(nzchar(cerrado$cierre_at))
})

test_that("SurveyMonkey flatten convierte respuestas bulk a tabla", {
  details <- list(
    title = "Demo",
    pages = list(list(questions = list(list(
      id = "101",
      family = "single_choice",
      headings = list(list(heading = "Distrito")),
      answers = list(choices = list(
        list(id = "1", text = "Norte"),
        list(id = "2", text = "Sur")
      ))
    ))))
  )
  responses <- list(list(
    id = "r1",
    response_status = "completed",
    date_modified = "2026-05-01T10:00:00Z",
    custom_variables = list(enumerador = "Ana"),
    pages = list(list(questions = list(list(
      id = "101",
      answers = list(list(choice_id = "1"))
    ))))
  ))
  out <- sm_api_flatten_responses(details, responses)
  expect_equal(nrow(out), 1L)
  expect_equal(out$response_id, "r1")
  expect_equal(as.vector(out$q0001), "Norte")
  expect_equal(out$cv_enumerador, "Ana")
  expect_equal(attr(out, "variable_labels")[["q0001"]], "Distrito")
  expect_null(attr(out$q0001, "label"))

  source <- monitoreo_normalize_sources(list(list(
    kind = "surveymonkey",
    label = "Encuesta demo",
    survey_id = "demo"
  )))[[1]]
  merged <- .monitoreo_bind_rows(list(.monitoreo_add_source_columns(out, source)))
  variables <- monitoreo_variables(merged)
  q0001 <- variables[[match("q0001", vapply(variables, `[[`, character(1), "name"))]]
  expect_equal(q0001$label, "Distrito")
})

test_that("Kobo flatten tolera resultados anidados", {
  rows <- list(
    list(`_id` = 1, name = "Ana", group = list(district = "Norte")),
    list(`_id` = 2, name = "Luis", group = list(district = "Sur"))
  )
  out <- kobo_api_flatten_results(rows)
  expect_equal(nrow(out), 2L)
  expect_true("_id" %in% names(out))
  expect_true("group.district" %in% names(out))
})

test_that("Kobo normaliza fecha y hora para consumo transversal", {
  data <- data.frame(
    `_submission_time` = c("2026-06-07T20:15:00Z", "2026-06-08T03:05:00Z", "2026-06-09"),
    `_uuid` = c("a", "b", "c"),
    check.names = FALSE
  )

  out <- monitoreo_enrich_kobo_datetime_columns(data)

  expect_equal(as.character(out$kobo_fecha_iso), c("2026-06-07", "2026-06-07", "2026-06-09"))
  expect_equal(as.character(out$kobo_fecha), c("7 Junio", "7 Junio", "9 Junio"))
  expect_equal(as.character(out$kobo_hora), c("03:15pm", "10:05pm", ""))
  expect_equal(out$kobo_fecha_hora[[1]], "7 Junio 03:15pm")
  expect_equal(out$kobo_fecha_hora[[3]], "9 Junio")
  variables <- monitoreo_variables(out)
  fecha_var <- variables[[match("kobo_fecha", vapply(variables, `[[`, character(1), "name"))]]
  expect_equal(fecha_var$label, "Fecha Kobo")
})

test_that("Kobo sources preserve connection profile metadata without tokens", {
  source <- monitoreo_normalize_sources(list(list(
    kind = "kobo",
    label = "Kobo UNHCR",
    asset_uid = "asset_unhcr",
    base_url = "https://kobo.unhcr.org",
    connection_profile_id = "kobo_unhcr",
    token = "no-debe-persistir"
  )))[[1]]

  expect_equal(source$connection_profile_id, "kobo_unhcr")
  expect_equal(source$base_url, "https://kobo.unhcr.org")
  expect_false("token" %in% names(source))
})

test_that("pulso persiste monitoreo sin tokens", {
  sid <- session_create()
  session_set(sid, "monitoreo_sources", monitoreo_normalize_sources(list(list(
    kind = "kobo",
    label = "Campo",
    asset_uid = "asset123",
    connection_profile_id = "kobo_eu",
    base_url = "https://eu.kobotoolbox.org",
    token = "no-debe-persistir",
    dimensions = list(actor = "Vecinos")
  ))))
  session_set(sid, "monitoreo_config", monitoreo_normalize_config(list(objetivo_total = 10L)))
  dest <- tempfile(fileext = ".pulso")
  build_pulso(sid, dest, project_name = "Monitoreo")
  td <- tempfile("pulso_test_")
  dir.create(td)
  on.exit(unlink(td, recursive = TRUE, force = TRUE), add = TRUE)
  zip::unzip(dest, exdir = td)
  saved <- readRDS(file.path(td, "state.rds"))
  expect_false("token" %in% names(saved$monitoreo_sources[[1]]))
  expect_equal(saved$monitoreo_sources[[1]]$asset_uid, "asset123")
  expect_equal(saved$monitoreo_sources[[1]]$connection_profile_id, "kobo_eu")
  expect_equal(saved$monitoreo_sources[[1]]$base_url, "https://eu.kobotoolbox.org")
  expect_equal(saved$monitoreo_sources[[1]]$dimensions$actor, "Vecinos")
})

test_that("monitoreo normaliza Google Sheets con rol, modo y binding", {
  src <- monitoreo_normalize_sources(list(list(
    kind = "google_sheets",
    label = "Barrido egresados",
    role = "barrido",
    integration_mode = "connected_read",
    spreadsheet_id = "https://docs.google.com/spreadsheets/d/sheet_123/edit",
    sheet_name = "Barrido",
    header_row = 2L,
    range = "Barrido!A:Z"
  )))[[1]]

  expect_equal(src$kind, "google_sheets")
  expect_equal(src$role, "barrido")
  expect_equal(src$integration_mode, "connected_read")
  expect_equal(src$sheet_binding$spreadsheet_id, "sheet_123")
  expect_equal(src$sheet_binding$sheet_name, "Barrido")
  expect_equal(src$sheet_binding$header_row, 2L)
  expect_equal(src$sheet_binding$range, "Barrido!A:Z")
})

test_that("perfil acreditacion segmentada normaliza minimos y llaves", {
  profile <- monitoreo_normalize_profile(list(
    family = "acreditacion",
    variant = "segmentada_por_carrera",
    route_selected = TRUE,
    locked_at = "2026-06-06T00:00:00Z",
    segments = list(
      list(segment = "Civil", label = "Ingenieria Civil", actor = "Egresados", field = "ESPECIALIDAD", universe_value = "INGENIERIA CIVIL")
    ),
    minimums = list(list(segment = "Civil", minimum = 150L)),
    key_rules = list(
      universe_fields = c("CÓDIGO", "Correo"),
      response_fields = c("CodPulso"),
      use_name_fallback = FALSE,
      automatic_detection = FALSE
    )
  ))

  expect_equal(profile$family, "acreditacion")
  expect_equal(profile$variant, "segmentada_por_carrera")
  expect_true(profile$route_selected)
  expect_equal(profile$locked_at, "2026-06-06T00:00:00Z")
  expect_equal(profile$segments[[1]]$id, "Civil")
  expect_equal(profile$minimums$Civil, 150L)

  keys <- monitoreo_acreditacion_case_keys(
    list(`CÓDIGO` = "00123", Correo = "egresado@pucp.edu.pe"),
    profile,
    "universo"
  )
  expect_true("codigo:123" %in% keys)
  expect_true("email:egresado@pucp.edu.pe" %in% keys)
})

test_that("perfil acreditacion deduplica por prioridad y detecta rechazo", {
  profile <- monitoreo_normalize_profile(list(
    key_rules = list(response_fields = c("CodPulso"), automatic_detection = FALSE),
    rejection_rules = list(list(
      actor = "",
      question_patterns = c("acepta participar"),
      rejection_answers = c("no")
    ))
  ))
  rows <- list(
    list(CodPulso = "A1", Estado = "partial", response_id = "r1"),
    list(CodPulso = "A1", Estado = "completed", response_id = "r2"),
    list(CodPulso = "A2", Estado = "completed", `Acepta participar` = "No", response_id = "r3"),
    list(CodPulso = "A3", Estado = "partial", `Acepta participar` = "No", response_id = "r4")
  )

  dedup <- monitoreo_acreditacion_deduplicate(rows, profile)
  expect_equal(length(dedup), 3L)
  expect_equal(dedup[[1]]$response_id, "r2")
  expect_true(monitoreo_acreditacion_is_rejection(rows[[3]], profile))
  expect_false(monitoreo_acreditacion_is_rejection(rows[[4]], profile))
})

test_that("perfil acreditacion genera alertas de barrido y doble canal", {
  profile <- monitoreo_normalize_profile(list(
    key_rules = list(
      universe_fields = c("CodPulso"),
      response_fields = c("CodPulso"),
      automatic_detection = FALSE
    ),
    alerts = list(no_sweep_min_cases = 2L, no_sweep_pct = 0.5)
  ))
  barrido <- list(
    list(CodPulso = "A1", Responsable = "Ana", Status = "No barrido"),
    list(CodPulso = "A1", Responsable = "Ana", Status = "No barrido"),
    list(CodPulso = "", Responsable = "Sin responsable", Status = "No barrido")
  )
  respuestas <- list(
    list(CodPulso = "A1", Canal = "Correo", Estado = "completed"),
    list(CodPulso = "A1", Canal = "Telefonico", Estado = "completed"),
    list(CodPulso = "ZZ", Canal = "Telefonico", Estado = "completed")
  )

  alerts <- monitoreo_acreditacion_alerts(barrido, respuestas, profile)
  types <- vapply(alerts, `[[`, character(1), "type")
  expect_true("llave_duplicada_barrido" %in% types)
  expect_true("llave_faltante_barrido" %in% types)
  expect_true("doble_canal" %in% types)
  expect_true("respuesta_fuera_de_barrido" %in% types)
  expect_true("responsable_no_barridos" %in% types)
})

test_that("perfil acreditacion genera reportes tipo Apps Script desde snapshot Sheets", {
  data <- data.frame(
    CodPulso = c("C1", "C2", "C3", "C4", "C1"),
    Status = c("Efectivo", "No barrido", "Rechazo", "No contesta", "Efectivo"),
    Responsable = c("Ana", "Ana", "Luis", "Luis", "Ana"),
    Intentos = c(1, 0, 2, 3, 1),
    Fecha = c("2026-06-01", "2026-06-01", "2026-06-02", "2026-06-02", "2026-06-03"),
    `Ciclo de egreso` = c("2024-I", "2024-I", "2023-II", "2023-II", "2024-I"),
    .source_role = rep("barrido", 5),
    .source_label = rep("Barrido carrera - Civil", 5),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = "acreditacion",
      variant = "segmentada_por_carrera",
      segments = list(list(id = "Civil", label = "Civil", actor = "Egresados")),
      minimums = list(Civil = 2)
    )
  ), data)

  dashboard <- monitoreo_build_dashboard(data, cfg)
  reports <- dashboard$acreditacion_reports
  expect_true(is.list(reports))
  light_dashboard <- monitoreo_build_dashboard(data, cfg, include_reports = FALSE)
  expect_equal(light_dashboard$kpis$total, dashboard$kpis$total)
  expect_true(is.null(light_dashboard$acreditacion_reports))
  snapshot <- list(
    synced_at = "2026-06-03T00:00:00Z",
    data = data,
    config = cfg,
    dashboard = dashboard,
    dashboard_cache_key = .monitoreo_dashboard_cache_key
  )
  cache_token <- .monitoreo_dashboard_cache_token(snapshot, data, cfg)
  expect_true(.monitoreo_snapshot_dashboard_valid(snapshot, data, cfg, cache_token))
  stale_snapshot <- snapshot
  stale_snapshot$config <- modifyList(cfg, list(status_var = "otro_estado"))
  expect_false(.monitoreo_snapshot_dashboard_valid(stale_snapshot, data, cfg, cache_token))
  expect_equal(vapply(reports$sheets, `[[`, character(1), "id"), c(
    "resumen",
    "monitoreo_telefonico",
    "avance_encuesta",
    "alertas",
    "reporte",
    "cliente_reporte",
    "cliente_avance_actor",
    "cliente_efectivas_fecha",
    "cliente_fuentes_actor",
    "cliente_variables_control"
  ))
  resumen <- reports$sheets[[1]]$blocks[[1]]$rows[[1]]
  expect_equal(resumen$Unidad, "Civil")
  expect_equal(resumen$Universo, 5L)
  expect_equal(resumen$Completas, 2L)
  expect_equal(resumen$Efectivas, 2L)
  expect_equal(resumen$`Efectivas telefónicas`, 2L)
  expect_equal(resumen$`Rechazos telefónicos`, 1L)
  expect_equal(resumen$`Origen avance`, "Barrido telefónico")
  expect_equal(resumen$`Avance mínimo`, 1)
  expect_equal(resumen$`Avance total`, 0.4)
  resumen_block_ids <- vapply(reports$sheets[[1]]$blocks, `[[`, character(1), "id")
  expect_true("avance_efectivo_dia" %in% resumen_block_ids)
  expect_true("avance_general_dia" %in% resumen_block_ids)
  expect_true("avance_canal_dia" %in% resumen_block_ids)
  client_daily <- reports$client_report$daily_actor
  client_sources <- reports$client_report$sources
  expect_true(length(client_daily) > 0L)
  expect_true(length(client_sources) > 0L)
  expect_equal(unique(vapply(client_sources, function(row) row$Actor, character(1))), "Civil")
  phone_titles <- vapply(reports$sheets[[2]]$blocks, `[[`, character(1), "title")
  expect_true("Distribución por estatus" %in% phone_titles)
  phone_block_ids <- vapply(reports$sheets[[2]]$blocks, `[[`, character(1), "id")
  detail_block <- reports$sheets[[2]]$blocks[[which(phone_block_ids == "detalle_no_contesta")]]
  expect_equal(length(detail_block$rows), 1L)
  expect_equal(detail_block$rows[[1]]$Responsable, "Luis")
  expect_equal(detail_block$rows[[1]]$Intentos, 3L)
  expect_equal(detail_block$rows[[1]]$`Ratio insistencia`, 0.75)
  expect_true(length(reports$sheets[[4]]$blocks[[1]]$rows) >= 1L)
})

test_that("perfil acreditacion separa rechazos por origen y reconoce fechas de plataforma", {
  data <- data.frame(
    CodPulso = c("C1", "C2", "C3", "C3"),
    Status = c("Efectivo", "Rechazo", "No barrido", "completed"),
    Responsable = c("Ana", "Luis", "Ana", ""),
    Fecha = c("2026-06-01", "2026-06-01", "2026-06-01", "texto no fecha"),
    date_modified = c("", "", "", "2026-06-02T10:05:00+00:00"),
    `Acepta participar` = c("", "", "", "No"),
    .source_role = c("barrido", "barrido", "barrido", "respuestas"),
    .source_label = c(
      "Barrido carrera - Civil",
      "Barrido carrera - Civil",
      "Barrido carrera - Civil",
      "Encuesta Civil - Correo"
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = "acreditacion",
      variant = "segmentada_por_carrera",
      segments = list(list(id = "Civil", label = "Civil", actor = "Egresados")),
      key_rules = list(response_fields = c("CodPulso"), automatic_detection = FALSE),
      rejection_rules = list(list(
        question_patterns = c("acepta participar"),
        rejection_answers = c("no")
      ))
    )
  ), data)

  reports <- monitoreo_build_dashboard(data, cfg)$acreditacion_reports
  resumen <- reports$sheets[[1]]$blocks[[1]]$rows[[1]]
  expect_equal(resumen$Rechazos, 1L)
  expect_equal(resumen$`Rechazos plataforma`, 1L)
  expect_equal(resumen$`Rechazos telefónicos`, 1L)

  detalle <- do.call(rbind, lapply(reports$sheets[[1]]$blocks[[3]]$rows, as.data.frame, check.names = FALSE))
  rechazos <- detalle[detalle$Estado == "Rechazos plataforma", , drop = FALSE]
  expect_equal(rechazos[["2026-06-02"]], 1L)
})

test_that("rechazo de consentimiento cuenta aunque no tenga llave de base", {
  data <- data.frame(
    CodPulso = c("E1", "E2", "E1", "", ""),
    response_status = c("", "", "completed", "completed", "partial"),
    date_modified = c("", "", "2026-06-01T10:00:00+00:00", "2026-06-02T10:00:00+00:00", "2026-06-03T10:00:00+00:00"),
    `Acepta participar` = c("", "", "Sí", "No", "No"),
    .source_role = c("universo", "universo", "respuestas", "respuestas", "respuestas"),
    .source_label = c(
      "Base · Estudiantes",
      "Base · Estudiantes",
      "SurveyMonkey · Estudiantes · Web",
      "SurveyMonkey · Estudiantes · Web",
      "SurveyMonkey · Estudiantes · Web"
    ),
    dim_actor = "Estudiantes",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = "acreditacion",
      variant = "multi_actor",
      units = list(list(id = "Estudiantes", label = "Estudiantes")),
      key_rules = list(response_fields = c("CodPulso"), automatic_detection = FALSE),
      rejection_rules = list(list(
        question_patterns = c("acepta participar"),
        rejection_answers = c("no")
      ))
    )
  ), data)

  reports <- monitoreo_build_dashboard(data, cfg)$acreditacion_reports
  resumen <- reports$sheets[[1]]$blocks[[1]]$rows[[1]]
  expect_equal(resumen$Efectivas, 1L)
  expect_equal(resumen$Parciales, 0L)
  expect_equal(resumen$`Rechazos plataforma`, 1L)
  expect_equal(resumen$`Rechazos plataforma sin cruce base`, 1L)
  expect_equal(resumen$`Sin respuesta plataforma`, 0L)

  detalle <- do.call(rbind, lapply(reports$sheets[[1]]$blocks[[3]]$rows, as.data.frame, check.names = FALSE))
  rechazos <- detalle[detalle$Estado == "Rechazos plataforma", , drop = FALSE]
  expect_equal(rechazos[["2026-06-02"]], 1L)
  expect_false("2026-06-03" %in% names(rechazos) && rechazos[["2026-06-03"]] > 0L)
})

test_that("perfil acreditacion cuenta efectivas solo desde plataforma y concilia telefono", {
  data <- data.frame(
    CodPulso = c("A1", "A2", "A3", "A4", "", "", "", ""),
    cv_id = c("", "", "", "", "A1", "A2", "A3", ""),
    Status = c("Efectivo", "Efectivo", "Rechazo", "No barrido", "", "", "", ""),
    response_status = c("", "", "", "", "completed", "partial", "completed", "completed"),
    Responsable = c("Ana", "Ana", "Luis", "Luis", "", "", "", ""),
    Fecha = c("2026-06-01", "2026-06-01", "2026-06-01", "2026-06-01", "", "", "", ""),
    date_modified = c("", "", "", "", "2026-06-02T10:00:00+00:00", "2026-06-02T11:00:00+00:00", "2026-06-03T12:00:00+00:00", "2026-06-03T13:00:00+00:00"),
    .source_role = c(rep("barrido", 4), rep("respuestas", 4)),
    .source_label = c(rep("Barrido carrera - Civil", 4), rep("Encuesta Civil - Teléfono", 4)),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = "acreditacion",
      variant = "segmentada_por_carrera",
      segments = list(list(id = "Civil", label = "Civil", actor = "Egresados")),
      key_rules = list(
        universe_fields = c("CodPulso"),
        response_fields = c("cv_id"),
        automatic_detection = FALSE
      )
    )
  ), data)

  reports <- monitoreo_build_dashboard(data, cfg)$acreditacion_reports
  resumen <- reports$sheets[[1]]$blocks[[1]]$rows[[1]]
  expect_equal(resumen$Efectivas, 2L)
  expect_equal(resumen$Completas, 2L)
  expect_equal(resumen$Parciales, 1L)
  expect_equal(resumen$`Respondidas plataforma`, 3L)
  expect_equal(resumen$`Respuestas plataforma sin cruce base`, 1L)
  expect_equal(resumen$`Efectivas sin cruce base`, 1L)
  expect_equal(resumen$`Rechazos telefónicos`, 1L)
  expect_equal(resumen$`Efectivas telefónicas`, 2L)
  expect_equal(resumen$`Efectivas telefónicas conciliadas`, 1L)
  expect_equal(resumen$`Efectivas telefónicas sin plataforma completa`, 1L)

  detalle <- do.call(rbind, lapply(reports$sheets[[1]]$blocks[[3]]$rows, as.data.frame, check.names = FALSE))
  efectivas <- detalle[detalle$Estado == "Efectivas", , drop = FALSE]
  parciales <- detalle[detalle$Estado == "Parciales", , drop = FALSE]
  expect_equal(efectivas[["2026-06-02"]], 1L)
  expect_equal(efectivas[["2026-06-03"]], 1L)
  expect_equal(parciales[["2026-06-02"]], 1L)

  alertas <- reports$sheets[[4]]$blocks[[1]]$rows
  types <- vapply(alertas, function(row) row$`Tipo alerta`, character(1))
  expect_true("efectivo_telefonico_parcial_plataforma" %in% types)
  expect_true("rechazo_telefonico_con_respuesta" %in% types)
  expect_true("respuesta_sin_llave" %in% types)
  expect_true("parcial_plataforma" %in% types)
})

test_that("perfil acreditacion alerta respuestas con llave fuera de la base", {
  data <- data.frame(
    CodPulso = c("E1", "E2", "", "", ""),
    cv_id = c("", "", "E1", "E99", "E98"),
    response_status = c("", "", "completed", "completed", "partial"),
    date_modified = c("", "", "2026-06-01T10:00:00+00:00", "2026-06-01T11:00:00+00:00", "2026-06-02T12:00:00+00:00"),
    .source_role = c(rep("universo", 2), rep("respuestas", 3)),
    .source_label = c(rep("Base · Estudiantes", 2), rep("SurveyMonkey · Estudiantes · Correo", 3)),
    dim_actor = rep("Estudiantes", 5),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = "acreditacion",
      variant = "multi_actor",
      units = list(list(id = "Estudiantes", label = "Estudiantes")),
      key_rules = list(
        universe_fields = c("CodPulso"),
        response_fields = c("cv_id"),
        automatic_detection = FALSE
      )
    )
  ), data)

  reports <- monitoreo_build_dashboard(data, cfg)$acreditacion_reports
  resumen <- reports$sheets[[1]]$blocks[[1]]$rows[[1]]
  expect_equal(resumen$Efectivas, 1L)
  expect_equal(resumen$Parciales, 0L)
  expect_equal(resumen$`Respuestas plataforma sin cruce base`, 2L)
  expect_equal(resumen$`Efectivas sin cruce base`, 1L)
  expect_equal(resumen$`Parciales sin cruce base`, 1L)

  alertas <- reports$sheets[[4]]$blocks[[1]]$rows
  types <- vapply(alertas, function(row) row$`Tipo alerta`, character(1))
  expect_true("efectiva_sin_cruce_base" %in% types)
  expect_true("parcial_sin_cruce_base" %in% types)
  expect_false(any(grepl("E99", vapply(alertas, function(row) row$Detalle, character(1)), fixed = TRUE) & types == "respuesta_sin_llave"))
})

test_that("perfil acreditacion expone trazabilidad de cruce por columna", {
  data <- data.frame(
    CodPulso = c("A1", "A2", "", ""),
    cv_id = c("", "", "A1", "A99"),
    response_id = c("", "", "r-1", "r-2"),
    response_status = c("", "", "completed", "completed"),
    date_modified = c("", "", "2026-06-01T10:00:00+00:00", "2026-06-01T11:00:00+00:00"),
    .source_role = c("universo", "universo", "respuestas", "respuestas"),
    .source_label = c("Base · Estudiantes", "Base · Estudiantes", "SurveyMonkey · Estudiantes · Web", "SurveyMonkey · Estudiantes · Web"),
    dim_actor = c("Estudiantes", "Estudiantes", "Estudiantes", "Estudiantes"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = "acreditacion",
      variant = "multi_actor",
      units = list(list(id = "Estudiantes", label = "Estudiantes")),
      key_rules = list(
        universe_fields = c("CodPulso"),
        response_fields = c("cv_id"),
        automatic_detection = FALSE
      )
    )
  ), data)

  reports <- monitoreo_build_dashboard(data, cfg)$acreditacion_reports
  alert_sheet <- reports$sheets[[which(vapply(reports$sheets, `[[`, character(1), "id") == "alertas")]]
  trace_block <- alert_sheet$blocks[[which(vapply(alert_sheet$blocks, `[[`, character(1), "id") == "trazabilidad_cruce")]]
  trace <- do.call(rbind, lapply(trace_block$rows, as.data.frame, check.names = FALSE))

  expect_true(all(c("Resultado", "Llave usada", "Columna respuesta", "Columna base", "Valor respuesta", "Valor base", "Decision avance") %in% names(trace)))
  matched <- trace[trace$response_id == "r-1", , drop = FALSE]
  expect_equal(matched$Resultado, "Cruzó")
  expect_equal(matched$`Decision avance`, "Incluido en avance")
  expect_equal(matched$`Llave usada`, "codigo:A1")
  expect_equal(matched$`Columna respuesta`, "cv_id")
  expect_equal(matched$`Columna base`, "CodPulso")
  expect_equal(matched$`Valor respuesta`, "A1")
  expect_equal(matched$`Valor base`, "A1")

  outside <- trace[trace$response_id == "r-2", , drop = FALSE]
  expect_equal(outside$Resultado, "Sin cruce")
  expect_equal(outside$`Decision avance`, "Excluido del avance")
  expect_equal(outside$`Llave usada`, "codigo:A99")
  expect_equal(outside$`Columna respuesta`, "cv_id")
  expect_equal(outside$`Columna base`, "")
})

test_that("perfil acreditacion cruza codigo PUCP en pregunta SurveyMonkey generica etiquetada", {
  data <- data.frame(
    `Código PUCP` = c("20193331", "20192752", "", ""),
    q0004 = c("", "", "20193331", "99999999"),
    response_id = c("", "", "r-code", "r-outside"),
    response_status = c("", "", "completed", "completed"),
    date_modified = c("", "", "2026-06-01T10:00:00+00:00", "2026-06-01T11:00:00+00:00"),
    .source_role = c("universo", "universo", "respuestas", "respuestas"),
    .source_label = c("Base · Estudiantes", "Base · Estudiantes", "SurveyMonkey · Estudiantes · Web", "SurveyMonkey · Estudiantes · Web"),
    .source_id = c("base-estudiantes", "base-estudiantes", "sm-estudiantes-web", "sm-estudiantes-web"),
    dim_actor = c("Estudiantes", "Estudiantes", "Estudiantes", "Estudiantes"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  attr(data, "variable_labels") <- c(q0004 = "¿Cuál es su código PUCP ?")
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = "acreditacion",
      variant = "multi_actor",
      units = list(list(id = "Estudiantes", label = "Estudiantes")),
      key_rules = list(
        universe_fields = c("Código PUCP"),
        response_fields = c("Código PUCP"),
        automatic_detection = TRUE
      )
    )
  ), data)

  reports <- monitoreo_build_dashboard(data, cfg)$acreditacion_reports
  alert_sheet <- reports$sheets[[which(vapply(reports$sheets, `[[`, character(1), "id") == "alertas")]]
  trace_block <- alert_sheet$blocks[[which(vapply(alert_sheet$blocks, `[[`, character(1), "id") == "trazabilidad_cruce")]]
  trace <- do.call(rbind, lapply(trace_block$rows, as.data.frame, check.names = FALSE))

  matched <- trace[trace$response_id == "r-code", , drop = FALSE]
  expect_equal(matched$Resultado, "Cruzó")
  expect_equal(matched$`Llave usada`, "codigo:20193331")
  expect_equal(matched$`Columna respuesta`, "q0004")
  expect_equal(matched$`Valor respuesta`, "20193331")

  outside <- trace[trace$response_id == "r-outside", , drop = FALSE]
  expect_equal(outside$Resultado, "Sin cruce")
  expect_equal(outside$`Llave usada`, "codigo:99999999")
  expect_equal(outside$`Columna respuesta`, "q0004")
})

test_that("perfil acreditacion permite decision auditada de incluir respuestas sin cruce", {
  data <- data.frame(
    CodPulso = c("A1", ""),
    cv_id = c("", "A99"),
    response_id = c("", "r-decision"),
    response_status = c("", "completed"),
    date_modified = c("", "2026-06-01T10:00:00+00:00"),
    .source_role = c("universo", "respuestas"),
    .source_label = c("Base · Estudiantes", "SurveyMonkey · Estudiantes · Web"),
    dim_actor = c("Estudiantes", "Estudiantes"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  base_profile <- list(
    family = "acreditacion",
    variant = "multi_actor",
    units = list(list(id = "Estudiantes", label = "Estudiantes")),
    key_rules = list(
      universe_fields = c("CodPulso"),
      response_fields = c("cv_id"),
      automatic_detection = FALSE
    )
  )

  cfg_excluded <- monitoreo_normalize_config(list(monitoreo_profile = base_profile), data)
  reports_excluded <- monitoreo_build_dashboard(data, cfg_excluded)$acreditacion_reports
  resumen_excluded <- reports_excluded$sheets[[1]]$blocks[[1]]$rows[[1]]
  expect_equal(resumen_excluded$Efectivas, 0L)
  expect_equal(resumen_excluded$`Efectivas sin cruce base`, 1L)

  cfg_included <- monitoreo_normalize_config(list(
    monitoreo_profile = modifyList(base_profile, list(
      reconciliation_decisions = list(include_response_ids = c("r-decision"))
    ))
  ), data)
  reports_included <- monitoreo_build_dashboard(data, cfg_included)$acreditacion_reports
  resumen_included <- reports_included$sheets[[1]]$blocks[[1]]$rows[[1]]
  expect_equal(resumen_included$Efectivas, 1L)
  expect_equal(resumen_included$`Efectivas sin cruce base`, 0L)

  alert_sheet <- reports_included$sheets[[which(vapply(reports_included$sheets, `[[`, character(1), "id") == "alertas")]]
  trace_block <- alert_sheet$blocks[[which(vapply(alert_sheet$blocks, `[[`, character(1), "id") == "trazabilidad_cruce")]]
  trace <- do.call(rbind, lapply(trace_block$rows, as.data.frame, check.names = FALSE))
  decision <- trace[trace$response_id == "r-decision", , drop = FALSE]
  expect_equal(decision$Resultado, "Sin cruce")
  expect_equal(decision$`Decision avance`, "Incluido en avance")
})

.monitoreo_test_assisted_review_data <- function(actor = "Docentes", candidate_actor = actor) {
  data.frame(
    CodPulso = c("01999225", "", ""),
    Nombre = c("Franklin Duarte", "", ""),
    correo = c("fduarte@pucp.edu.pe", "", ""),
    cv_id = c("", "FDC", "01999225"),
    correo_declarado = c("", "fduarte@pucp.edu.pe", ""),
    response_id = c("", "r-fdc", "r-direct"),
    response_status = c("", "completed", "completed"),
    date_modified = c("", "2026-06-12T10:00:00+00:00", "2026-06-13T10:00:00+00:00"),
    .source_role = c("universo", "respuestas", "respuestas"),
    .source_label = c(
      "Base · Docentes",
      "SurveyMonkey · Docentes · Correo",
      "SurveyMonkey · Docentes · Correo"
    ),
    dim_actor = c(candidate_actor, actor, actor),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.monitoreo_test_assisted_review_profile <- function(reconciliation_decisions = list()) {
  monitoreo_normalize_profile(list(
    family = "acreditacion",
    variant = "multi_actor",
    units = list(list(id = "Docentes", label = "Docentes")),
    key_rules = list(
      universe_fields = c("CodPulso", "correo"),
      response_fields = c("cv_id"),
      automatic_detection = FALSE
    ),
    reconciliation_decisions = reconciliation_decisions
  ))
}

.monitoreo_test_records_df <- function(records) {
  if (!length(records)) return(data.frame())
  do.call(rbind, lapply(records, function(record) {
    record[] <- lapply(record, function(value) {
      if (is.list(value)) I(list(value)) else value
    })
    as.data.frame(record, check.names = FALSE, stringsAsFactors = FALSE)
  }))
}

test_that("perfil acreditacion sugiere candidato por correo exacto sin incluir automaticamente", {
  data <- .monitoreo_test_assisted_review_data()
  profile <- .monitoreo_test_assisted_review_profile()
  queries <- .monitoreo_acreditacion_internal_queries(data, profile)
  cases <- .monitoreo_test_records_df(queries$cases)
  reviewed <- cases[cases$response_id == "r-fdc", , drop = FALSE]

  expect_equal(nrow(reviewed), 1L)
  expect_equal(reviewed$base_result, "Sin cruce")
  expect_equal(reviewed$advancement, "excluded")
  expect_true(isTRUE(reviewed$assisted_review[[1]]$eligible))
  expect_equal(reviewed$assisted_review[[1]]$declared_email, "fduarte@pucp.edu.pe")
  expect_equal(length(reviewed$assisted_review[[1]]$candidates), 1L)
  expect_equal(reviewed$assisted_review[[1]]$candidates[[1]]$person_label, "Franklin Duarte")
  expect_equal(reviewed$assisted_review[[1]]$candidates[[1]]$case_key, "01999225")
  expect_true("email_exact" %in% reviewed$assisted_review[[1]]$candidates[[1]]$match_type)
})

test_that("perfil acreditacion detecta contradiccion entre codigo declarado y codigo oficial", {
  data <- .monitoreo_test_assisted_review_data()
  profile <- .monitoreo_test_assisted_review_profile()
  reviewed <- .monitoreo_test_records_df(.monitoreo_acreditacion_internal_queries(data, profile)$cases)
  reviewed <- reviewed[reviewed$response_id == "r-fdc", , drop = FALSE]
  warnings <- unlist(reviewed$assisted_review[[1]]$warnings, use.names = FALSE)

  expect_true(any(grepl("codigo declarado no coincide", .monitoreo_text_key(warnings), fixed = TRUE)))
})

test_that("perfil acreditacion marca pendiente por correo similar sin incluir automaticamente", {
  data <- data.frame(
    CodPulso = c("00002849", ""),
    Nombre = c("Javier Rosas", ""),
    correo = c("javier.rosas@pucp.edu.pe", ""),
    cv_id = c("", "19886218"),
    correo_declarado = c("", "javier.rosa@pucp.edu.pe"),
    response_id = c("", "r-javier"),
    response_status = c("", "completed"),
    date_modified = c("", "2026-06-13T10:00:00+00:00"),
    .source_role = c("universo", "respuestas"),
    .source_label = c("Base · Docentes", "SurveyMonkey · Docentes · WhatsApp"),
    dim_actor = c("Docentes", "Docentes"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  profile <- .monitoreo_test_assisted_review_profile()
  reviewed <- .monitoreo_test_records_df(.monitoreo_acreditacion_internal_queries(data, profile)$cases)
  reviewed <- reviewed[reviewed$response_id == "r-javier", , drop = FALSE]
  assisted <- reviewed$assisted_review[[1]]

  expect_equal(reviewed$base_result, "Sin cruce")
  expect_equal(reviewed$advancement, "excluded")
  expect_equal(length(assisted$candidates), 0L)
  expect_equal(length(assisted$assignment_candidates), 1L)
  expect_equal(assisted$assignment_candidates[[1]]$person_label, "Javier Rosas")
  expect_equal(assisted$assignment_candidates[[1]]$match_type, "email_similar")
  expect_equal(assisted$assignment_candidates[[1]]$evidence_level, "possible")
  expect_true(assisted$assignment_candidates[[1]]$evidence_score >= 72L)
})

test_that("perfil acreditacion no sugiere candidatos fuera del actor", {
  data <- .monitoreo_test_assisted_review_data(candidate_actor = "Administrativos")
  profile <- .monitoreo_test_assisted_review_profile()
  reviewed <- .monitoreo_test_records_df(.monitoreo_acreditacion_internal_queries(data, profile)$cases)
  reviewed <- reviewed[reviewed$response_id == "r-fdc", , drop = FALSE]

  expect_equal(length(reviewed$assisted_review[[1]]$candidates), 0L)
  expect_true(any(grepl("no se encontro coincidencia", .monitoreo_text_key(reviewed$assisted_review[[1]]$warnings), fixed = TRUE)))
})

test_that("perfil acreditacion no cruza respuestas contra bases de otro actor", {
  data <- data.frame(
    CodPulso = c("1145", ""),
    Nombre = c("Codigo en egresados", ""),
    cv_id = c("", "1145"),
    response_id = c("", "r-docente-1145"),
    response_status = c("", "completed"),
    date_modified = c("", "2026-06-13T10:00:00+00:00"),
    .source_role = c("universo", "respuestas"),
    .source_label = c("Base · Egresados", "SurveyMonkey · Docentes · Personalizado"),
    dim_actor = c("Egresados", "Docentes"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  profile <- .monitoreo_test_assisted_review_profile()
  reviewed <- .monitoreo_test_records_df(.monitoreo_acreditacion_internal_queries(data, profile)$cases)
  reviewed <- reviewed[reviewed$response_id == "r-docente-1145", , drop = FALSE]
  trace <- .monitoreo_report_reconciliation_trace_df(data, profile)
  traced <- trace[trace$response_id == "r-docente-1145", , drop = FALSE]

  expect_equal(reviewed$base_result, "Sin cruce")
  expect_equal(reviewed$advancement, "excluded")
  expect_equal(reviewed$base_source, "")
  expect_equal(traced$Resultado, "Sin cruce")
})

test_that("perfil acreditacion expone revision asistida para respuestas sin llave no completas", {
  data <- data.frame(
    CodPulso = c("A1", ""),
    cv_id = c("", ""),
    response_id = c("", "r-sin-llave"),
    response_status = c("", "partial"),
    date_modified = c("", "2026-06-12T10:00:00+00:00"),
    .source_role = c("universo", "respuestas"),
    .source_label = c("Base · Docentes", "SurveyMonkey · Docentes · Personalizado"),
    dim_actor = c("Docentes", "Docentes"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  profile <- .monitoreo_test_assisted_review_profile()
  reviewed <- .monitoreo_test_records_df(.monitoreo_acreditacion_internal_queries(data, profile)$cases)
  reviewed <- reviewed[reviewed$response_id == "r-sin-llave", , drop = FALSE]

  expect_equal(reviewed$base_result, "Sin llave")
  expect_equal(reviewed$advancement, "partial")
  expect_true(isTRUE(reviewed$assisted_review[[1]]$eligible))
  expect_equal(length(reviewed$assisted_review[[1]]$candidates), 0L)
})

test_that("perfil acreditacion ofrece pendientes del actor para asignacion manual", {
  data <- data.frame(
    CodPulso = c("01999225", "22222222", "", "01999225"),
    Nombre = c("Franklin Duarte", "Maria Pendiente", "", ""),
    correo = c("fduarte@pucp.edu.pe", "maria.pendiente@pucp.edu.pe", "", ""),
    cv_id = c("", "", "FDC", "01999225"),
    correo_declarado = c("", "", "fduarte@pucp.edu.pe", ""),
    response_id = c("", "", "r-fdc", "r-direct"),
    response_status = c("", "", "completed", "completed"),
    date_modified = c("", "", "2026-06-12T10:00:00+00:00", "2026-06-13T10:00:00+00:00"),
    .source_role = c("universo", "universo", "respuestas", "respuestas"),
    .source_label = c(
      "Base · Docentes",
      "Base · Docentes",
      "SurveyMonkey · Docentes · Correo",
      "SurveyMonkey · Docentes · Correo"
    ),
    dim_actor = c("Docentes", "Docentes", "Docentes", "Docentes"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  profile <- .monitoreo_test_assisted_review_profile()
  reviewed <- .monitoreo_test_records_df(.monitoreo_acreditacion_internal_queries(data, profile)$cases)
  reviewed <- reviewed[reviewed$response_id == "r-fdc", , drop = FALSE]
  assisted <- reviewed$assisted_review[[1]]

  expect_equal(length(assisted$candidates), 1L)
  expect_true(isTRUE(assisted$candidates[[1]]$already_effective))
  expect_equal(length(assisted$assignment_candidates), 1L)
  expect_equal(assisted$assignment_candidates[[1]]$person_label, "Maria Pendiente")
  expect_equal(assisted$assignment_candidates[[1]]$case_key, "22222222")
  expect_false(isTRUE(assisted$assignment_candidates[[1]]$already_effective))
})

test_that("perfil acreditacion inclusion manual puede asignar a pendiente no sugerido", {
  data <- data.frame(
    CodPulso = c("01999225", "22222222", "", "01999225"),
    Nombre = c("Franklin Duarte", "Maria Pendiente", "", ""),
    correo = c("fduarte@pucp.edu.pe", "maria.pendiente@pucp.edu.pe", "", ""),
    cv_id = c("", "", "FDC", "01999225"),
    correo_declarado = c("", "", "fduarte@pucp.edu.pe", ""),
    response_id = c("", "", "r-fdc", "r-direct"),
    response_status = c("", "", "completed", "completed"),
    date_modified = c("", "", "2026-06-12T10:00:00+00:00", "2026-06-13T10:00:00+00:00"),
    .source_role = c("universo", "universo", "respuestas", "respuestas"),
    .source_label = c(
      "Base · Docentes",
      "Base · Docentes",
      "SurveyMonkey · Docentes · Correo",
      "SurveyMonkey · Docentes · Correo"
    ),
    dim_actor = c("Docentes", "Docentes", "Docentes", "Docentes"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  profile <- .monitoreo_test_assisted_review_profile(list(
    include_response_ids = c("r-fdc"),
    manual_case_reconciliations = list(
      `r-fdc` = list(
        response_id = "r-fdc",
        actor = "Docentes",
        action = "include_with_caveat",
        declared_code = "FDC",
        declared_email = "fduarte@pucp.edu.pe",
        assigned_person_label = "Maria Pendiente",
        assigned_case_key = "22222222",
        assigned_base_source = "Base · Docentes",
        assigned_base_row = 2L,
        match_type = "manual_pending",
        previous_status = "excluded",
        new_status = "included_with_caveat",
        note = "Asignacion manual con evidencia externa.",
        decided_at = "2026-06-15T14:04:00-05:00"
      )
    )
  ))
  cases <- .monitoreo_test_records_df(.monitoreo_acreditacion_internal_queries(data, profile)$cases)
  reviewed <- cases[cases$response_id == "r-fdc", , drop = FALSE]

  expect_equal(reviewed$advancement, "effective")
  expect_equal(reviewed$issue_type, "incluido_con_salvedad")
  expect_equal(reviewed$assisted_review[[1]]$manual_decision$match_type, "manual_pending")
  expect_false(any(cases$response_id == "" & cases$person_label == "Maria Pendiente"))
})

test_that("perfil acreditacion inclusion manual actualiza avance sin borrar regla automatica", {
  data <- .monitoreo_test_assisted_review_data()
  profile <- .monitoreo_test_assisted_review_profile(list(
    include_response_ids = c("r-fdc"),
    manual_case_reconciliations = list(
      `r-fdc` = list(
        response_id = "r-fdc",
        actor = "Docentes",
        action = "include_with_caveat",
        declared_code = "FDC",
        declared_email = "fduarte@pucp.edu.pe",
        assigned_person_label = "Franklin Duarte",
        assigned_case_key = "01999225",
        assigned_base_source = "Base · Docentes",
        assigned_base_row = 1L,
        match_type = "email_exact",
        previous_status = "excluded",
        new_status = "included_with_caveat",
        note = "Correo declarado cruza con base.",
        decided_at = "2026-06-15T09:34:00-05:00"
      )
    )
  ))
  cases <- .monitoreo_test_records_df(.monitoreo_acreditacion_internal_queries(data, profile)$cases)
  reviewed <- cases[cases$response_id == "r-fdc", , drop = FALSE]

  expect_equal(reviewed$advancement, "effective")
  expect_equal(reviewed$issue_type, "incluido_con_salvedad")
  expect_equal(reviewed$decision, "Incluido en avance")
  expect_true(grepl("fuera de la base", reviewed$rule, fixed = TRUE))
  expect_equal(reviewed$assisted_review[[1]]$manual_decision$action, "include_with_caveat")
  expect_false(any(cases$response_id == "" & cases$person_label == "Franklin Duarte"))
})

test_that("perfil acreditacion normaliza decisiones manuales con perfiles antiguos", {
  profile <- monitoreo_normalize_profile(list(
    family = "acreditacion",
    reconciliation_decisions = list(
      include_response_ids = c("r-old"),
      exclude_response_ids = c("r-excluded"),
      manual_case_reconciliations = list(
        `r-old` = list(
          action = "include_with_caveat",
          actor = "Docentes",
          assigned_case_key = "01999225",
          decided_at = "2026-06-15T09:34:00-05:00"
        )
      )
    )
  ))

  expect_equal(profile$reconciliation_decisions$include_response_ids, list("r-old"))
  expect_equal(profile$reconciliation_decisions$exclude_response_ids, list("r-excluded"))
  expect_equal(profile$reconciliation_decisions$manual_case_reconciliations$`r-old`$response_id, "r-old")
  expect_equal(profile$reconciliation_decisions$manual_case_reconciliations$`r-old`$action, "include_with_caveat")
})

test_that("perfil acreditacion usa etiquetas SurveyMonkey para detectar llaves q", {
  data <- data.frame(
    CodPulso = c("20222716", ""),
    q0004 = c("", "20222716"),
    response_status = c("", "completed"),
    date_modified = c("", "2026-06-01T10:00:00+00:00"),
    .source_role = c("universo", "respuestas"),
    .source_label = c("Base · Estudiantes", "SurveyMonkey · Estudiantes · Web"),
    dim_actor = c("Estudiantes", "Estudiantes"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  attr(data, "variable_labels") <- c(q0004 = "¿Cuál es su código PUCP ?")
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = "acreditacion",
      variant = "multi_actor",
      units = list(list(id = "Estudiantes", label = "Estudiantes")),
      key_rules = list(
        universe_fields = c("CodPulso"),
        response_fields = c("Código PUCP"),
        automatic_detection = FALSE
      )
    )
  ), data)

  reports <- monitoreo_build_dashboard(data, cfg)$acreditacion_reports
  resumen <- reports$sheets[[1]]$blocks[[1]]$rows[[1]]
  expect_equal(resumen$Efectivas, 1L)
  expect_equal(resumen$`Efectivas sin cruce base`, 0L)
})

test_that("perfil acreditacion conserva etiquetas SurveyMonkey por fuente al unir encuestas", {
  base <- data.frame(
    CodPulso = "2003102",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  normal <- data.frame(
    q0003 = "52",
    q0004 = "20229999",
    response_id = "r-normal",
    response_status = "partial",
    date_modified = "2026-06-01T09:00:00+00:00",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  attr(normal, "variable_labels") <- c(
    q0003 = "¿Cuántos años tiene en la actualidad?",
    q0004 = "¿Cuál es su código PUCP ?"
  )
  personalizado <- data.frame(
    q0003 = "02003102",
    q0004 = "64",
    response_id = "r-personalizado",
    response_status = "completed",
    date_modified = "2026-06-01T10:00:00+00:00",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  attr(personalizado, "variable_labels") <- c(
    q0003 = "Indique su código PUCP",
    q0004 = "¿Cuántos años tiene en la actualidad?"
  )
  data <- .monitoreo_bind_rows(list(
    .monitoreo_add_source_columns(base, list(
      id = "base-docentes",
      kind = "google_sheets",
      label = "Base · Docentes",
      role = "universo",
      dimensions = list(actor = "Docentes")
    )),
    .monitoreo_add_source_columns(normal, list(
      id = "docentes-correo",
      kind = "surveymonkey",
      label = "SurveyMonkey · Docentes · Correo",
      role = "respuestas",
      dimensions = list(actor = "Docentes")
    )),
    .monitoreo_add_source_columns(personalizado, list(
      id = "docentes-personalizado",
      kind = "surveymonkey",
      label = "SurveyMonkey · Docentes · Personalizado",
      role = "respuestas",
      dimensions = list(actor = "Docentes")
    ))
  ))
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = "acreditacion",
      variant = "multi_actor",
      units = list(list(id = "Docentes", label = "Docentes")),
      key_rules = list(
        universe_fields = c("CodPulso"),
        response_fields = c("Código PUCP"),
        automatic_detection = FALSE
      )
    )
  ), data)

  reports <- monitoreo_build_dashboard(data, cfg)$acreditacion_reports
  resumen <- reports$sheets[[1]]$blocks[[1]]$rows[[1]]
  expect_equal(resumen$Efectivas, 1L)
  expect_equal(resumen$`Efectivas sin cruce base`, 0L)

  alert_sheet <- reports$sheets[[which(vapply(reports$sheets, `[[`, character(1), "id") == "alertas")]]
  trace_block <- alert_sheet$blocks[[which(vapply(alert_sheet$blocks, `[[`, character(1), "id") == "trazabilidad_cruce")]]
  trace <- do.call(rbind, lapply(trace_block$rows, as.data.frame, check.names = FALSE))
  matched <- trace[trace$response_id == "r-personalizado", , drop = FALSE]
  expect_equal(matched$Resultado, "Cruzó")
  expect_equal(matched$`Columna respuesta`, "q0003")
  expect_equal(matched$`Valor respuesta`, "02003102")
})

test_that("perfil acreditacion no usa correo opcional de resultados como llave", {
  data <- data.frame(
    email = c("persona@pucp.edu.pe", ""),
    q0002 = c("", "persona@pucp.edu.pe"),
    response_id = c("", "r-opcional"),
    response_status = c("", "completed"),
    date_modified = c("", "2026-06-01T10:00:00+00:00"),
    .source_role = c("universo", "respuestas"),
    .source_label = c("Base · Administrativos", "SurveyMonkey · Administrativos · Correo"),
    dim_actor = c("Administrativos", "Administrativos"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  attr(data, "variable_labels") <- c(
    q0002 = "En caso desee que se le envíen los resultados del estudio, por favor indique un correo electrónico"
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = "acreditacion",
      variant = "multi_actor",
      units = list(list(id = "Administrativos", label = "Administrativos")),
      key_rules = list(
        universe_fields = c("email"),
        response_fields = c("recipient_email", "email_address", "cv_id"),
        automatic_detection = FALSE
      )
    )
  ), data)

  reports <- monitoreo_build_dashboard(data, cfg)$acreditacion_reports
  resumen <- reports$sheets[[1]]$blocks[[1]]$rows[[1]]
  expect_equal(resumen$Efectivas, 0L)
  expect_equal(resumen$`Efectivas sin cruce base`, 1L)
})

test_that("perfil acreditacion cruza respuestas por email de destinatario SurveyMonkey", {
  data <- data.frame(
    email = c("persona@pucp.edu.pe", ""),
    recipient_email = c("", "persona@pucp.edu.pe"),
    recipient_id = c("", "10691362291"),
    response_id = c("", "r-recipient"),
    response_status = c("", "completed"),
    date_modified = c("", "2026-06-01T10:00:00+00:00"),
    .source_role = c("universo", "respuestas"),
    .source_label = c("Base · Administrativos", "SurveyMonkey · Administrativos · Correo"),
    dim_actor = c("Administrativos", "Administrativos"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = "acreditacion",
      variant = "multi_actor",
      units = list(list(id = "Administrativos", label = "Administrativos")),
      key_rules = list(
        universe_fields = c("email"),
        response_fields = c("recipient_email", "email_address", "cv_id"),
        automatic_detection = FALSE
      )
    )
  ), data)

  reports <- monitoreo_build_dashboard(data, cfg)$acreditacion_reports
  resumen <- reports$sheets[[1]]$blocks[[1]]$rows[[1]]
  expect_equal(resumen$Efectivas, 1L)
  expect_equal(resumen$`Efectivas sin cruce base`, 0L)

  alert_sheet <- reports$sheets[[which(vapply(reports$sheets, `[[`, character(1), "id") == "alertas")]]
  trace_block <- alert_sheet$blocks[[which(vapply(alert_sheet$blocks, `[[`, character(1), "id") == "trazabilidad_cruce")]]
  trace <- do.call(rbind, lapply(trace_block$rows, as.data.frame, check.names = FALSE))
  matched <- trace[trace$response_id == "r-recipient", , drop = FALSE]
  expect_equal(matched$Resultado, "Cruzó")
  expect_equal(matched$`Columna respuesta`, "recipient_email")
  expect_equal(matched$`Columna base`, "email")
})

test_that("perfil acreditacion no usa canales como unidades cuando existe dim_actor", {
  data <- data.frame(
    CodPulso = c("A1", "A2", "A3", "A4", "A5"),
    response_status = c("completed", "completed", "partial", "completed", "completed"),
    date_modified = c(
      "2026-06-01T10:00:00+00:00",
      "2026-06-01T11:00:00+00:00",
      "2026-06-02T12:00:00+00:00",
      "2026-06-02T13:00:00+00:00",
      "2026-06-03T14:00:00+00:00"
    ),
    .source_role = rep("respuestas", 5),
    .source_label = c(
      "SurveyMonkey · Estudiantes · Web",
      "SurveyMonkey · Egresados · Telefónico",
      "SurveyMonkey · Docentes · Personalizado",
      "SurveyMonkey · Administrativos · Web",
      "Correo completos · Egresados"
    ),
    .source_id = c("estudiantes-web", "egresados-telefono", "docentes-whatsapp", "administrativos-web", "egresados-correo"),
    collector_id = c("web-estudiantes", "tel-egresados", "wsp-docentes", "web-admin", "correo-egresados"),
    collector_name = c("Web estudiantes", "Llamadas Egresados", "WhatsApp docentes", "Administrativos web", "Correo egresados"),
    dim_actor = c("Estudiantes", "Egresados", "Docentes", "Administrativos", "Egresados"),
    dim_canal = c("Web", "Telefonico", "WhatsApp", "Web", "Web"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = "acreditacion",
      variant = "multi_actor"
    )
  ), data)

  reports <- monitoreo_build_dashboard(data, cfg)$acreditacion_reports
  daily <- reports$sheets[[1]]$blocks[[3]]$rows
  units <- sort(unique(vapply(daily, function(row) row$Unidad, character(1))))
  expect_equal(units, c("Administrativos", "Docentes", "Egresados", "Estudiantes"))
  expect_false(any(c("Web", "Telefónico", "Personalizado") %in% units))

  survey_sheet <- reports$sheets[[which(vapply(reports$sheets, `[[`, character(1), "id") == "avance_encuesta")]]
  survey_block <- survey_sheet$blocks[[which(vapply(survey_sheet$blocks, `[[`, character(1), "id") == "resumen_encuesta")]]
  survey_df <- do.call(rbind, lapply(survey_block$rows, as.data.frame, check.names = FALSE))
  expect_true("source_id" %in% names(survey_df))
  expect_true("egresados-correo" %in% survey_df$source_id)
  source_daily <- survey_sheet$blocks[[which(vapply(survey_sheet$blocks, `[[`, character(1), "id") == "avance_fuente_dia")]]$rows
  source_df <- do.call(rbind, lapply(source_daily, as.data.frame, check.names = FALSE))
  expect_true(all(c("source_id", "Fuente", "Actor", "Canal", "Estado") %in% names(source_df)))
  expect_true(all(c("egresados-telefono", "egresados-correo") %in% source_df$source_id))
  expect_equal(
    sort(unique(source_df$Fuente[source_df$Actor == "Egresados"])),
    c("Correo completos · Egresados", "SurveyMonkey · Egresados · Telefónico")
  )
  expect_equal(sum(source_df$Canal == "Correo" & source_df$Actor == "Egresados"), 1L)
  expect_equal(sum(source_df$Canal == "Telefónico" & source_df$Actor == "Egresados"), 1L)
  collector_daily <- survey_sheet$blocks[[which(vapply(survey_sheet$blocks, `[[`, character(1), "id") == "avance_recopilador_dia")]]$rows
  collector_df <- do.call(rbind, lapply(collector_daily, as.data.frame, check.names = FALSE))
  expect_true(all(c("source_id", "Fuente", "Recopilador", "collector_id", "Estado") %in% names(collector_df)))
  expect_true("Llamadas Egresados (tel-egresados)" %in% collector_df$Recopilador)
  expect_true("Correo egresados (correo-egresados)" %in% collector_df$Recopilador)
  expect_equal(sum(collector_df$Actor == "Egresados"), 2L)
})

test_that("reporte cliente usa solo efectivas y omite metadata operacional", {
  data <- data.frame(
    CodPulso = c("D1", "D2", "E1", "E2", "E3", "", "", "", "", ""),
    cv_id = c("", "", "", "", "", "D1", "D2", "E1", "E2", "E3"),
    response_status = c("", "", "", "", "", "completed", "partial", "completed", "rejected", "completed"),
    date_modified = c(
      "", "", "", "", "",
      "2026-06-01T10:00:00+00:00",
      "2026-06-01T11:00:00+00:00",
      "2026-06-02T12:00:00+00:00",
      "2026-06-02T13:00:00+00:00",
      "2026-06-03T14:00:00+00:00"
    ),
    .source_role = c(rep("universo", 5), rep("respuestas", 5)),
    .source_label = c(
      "Base · Docentes",
      "Base · Docentes",
      "Base · Egresados",
      "Base · Egresados",
      "Base · Egresados",
      "SurveyMonkey · Docentes · Correo",
      "SurveyMonkey · Docentes · Correo",
      "SurveyMonkey · Egresados · Teléfono",
      "SurveyMonkey · Egresados · Teléfono",
      "SurveyMonkey · Egresados · Correo"
    ),
    .source_id = c(
      "base-doc", "base-doc", "base-egr", "base-egr", "base-egr",
      "doc-correo", "doc-correo", "egr-tel", "egr-tel", "egr-correo"
    ),
    collector_id = c(rep("", 5), "c1", "c1", "c2", "c2", "c3"),
    dim_actor = c("Docentes", "Docentes", "Egresados", "Egresados", "Egresados", "Docentes", "Docentes", "Egresados", "Egresados", "Egresados"),
    dim_canal = c("Base", "Base", "Base", "Base", "Base", "Correo", "Correo", "Telefono", "Telefono", "Correo"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = "acreditacion",
      variant = "multi_actor",
      units = list(
        list(id = "Docentes", label = "Docentes"),
        list(id = "Egresados", label = "Egresados")
      ),
      minimums = list(Docentes = 2, Egresados = 2),
      key_rules = list(
        universe_fields = c("CodPulso"),
        response_fields = c("cv_id"),
        automatic_detection = FALSE
      )
    )
  ), data)

  reports <- monitoreo_build_dashboard(data, cfg)$acreditacion_reports
  model <- reports$client_report
  expect_equal(model$schema, "monitoreo_client_report_v1")

  actors <- do.call(rbind, lapply(model$actors, as.data.frame, check.names = FALSE))
  expect_equal(sum(actors$Efectivas), 3L)
  expect_true("Parciales" %in% names(actors))
  expect_true("Rechazos plataforma" %in% names(actors))
  expect_equal(actors$Efectivas[actors$Actor == "Docentes"], 1L)
  expect_equal(actors$Efectivas[actors$Actor == "Egresados"], 2L)
  expect_true(isTRUE(model$has_targets))

  client_sheets <- reports$sheets[vapply(reports$sheets, function(sheet) identical(sheet$scope, "cliente"), logical(1))]
  expect_equal(sort(vapply(client_sheets, `[[`, character(1), "title")), sort(c(
    "Reporte",
    "Avance por actor",
    "Efectivas por fecha",
    "Fuentes por actor",
    "Variables de control"
  )))
  serialized <- as.character(jsonlite::toJSON(client_sheets, auto_unbox = TRUE, null = "null"))
  expect_true(grepl("Parciales", serialized))
  expect_true(grepl("Rechazos plataforma", serialized))
  expect_false(grepl("Rechazos telef", serialized))
  expect_false(grepl("source_id|collector_id|cv_id|Concili", serialized))

  pdf_path <- tempfile(fileext = ".pdf")
  out <- monitoreo_acreditacion_client_report_pdf(model, pdf_path, include_targets = TRUE)
  expect_equal(out, pdf_path)
  expect_true(file.exists(pdf_path))
  expect_gt(file.info(pdf_path)$size, 1000)
})

test_that("consultas internas de acreditacion trazan faltantes, parciales, rechazos y duplicados", {
  data <- data.frame(
    CodPulso = c("A1", "A2", "A3", "A4", "A5", "A6", rep("", 8)),
    cv_id = c(rep("", 6), "A1", "A2", "A3", "", "A5", "A6", "A6", "A99"),
    response_id = c(rep("", 6), "r-aula", "r-faltantes", "r-parcial", "r-parcial-anon", "r-rechazo", "r-dup-partial", "r-dup-complete", "r-fuera"),
    Status = c(rep("No barrido", 6), rep("", 8)),
    response_status = c(rep("", 6), "completed", "completed", "partial", "partial", "completed", "partial", "completed", "completed"),
    date_modified = c(rep("", 6), "2026-06-05T10:00:00+00:00", "2026-06-08T10:00:00+00:00", "2026-06-08T11:00:00+00:00", "2026-06-08T12:00:00+00:00", "2026-06-08T13:00:00+00:00", "2026-06-08T14:00:00+00:00", "2026-06-08T15:00:00+00:00", "2026-06-08T16:00:00+00:00"),
    `Acepta participar` = c(rep("", 10), "No", "", "", ""),
    collector_id = c(rep("", 6), "QR_AULA_1", "Faltantes_presencial", "QR_AULA_1", "Docentes personalizado - Web Link 1", "QR_AULA_1", "QR_AULA_1", "QR_AULA_1", "QR_AULA_1"),
    collector_name = c(rep("", 6), "QR aula original", "Faltantes presencial", "QR aula original", "Docentes personalizado", "QR aula original", "QR aula original", "QR aula original", "QR aula original"),
    .source_role = c(rep("barrido", 6), rep("respuestas", 8)),
    .source_label = c(rep("Alumnos Sin Respuesta por Curso - Contabilidad", 6), rep("SurveyMonkey · Estudiantes · QR", 8)),
    dim_actor = rep("Estudiantes", 14),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = "acreditacion",
      variant = "multi_actor",
      units = list(list(id = "Estudiantes", label = "Estudiantes")),
      key_rules = list(
        universe_fields = c("CodPulso"),
        response_fields = c("cv_id"),
        automatic_detection = FALSE
      ),
      rejection_rules = list(list(
        question_patterns = c("acepta participar"),
        rejection_answers = c("no")
      ))
    )
  ), data)

  internal <- monitoreo_build_dashboard(data, cfg)$acreditacion_reports$internal_queries
  records_df <- function(records) {
    if (!length(records)) return(data.frame())
    do.call(rbind, lapply(records, function(record) {
      record[] <- lapply(record, function(value) {
        if (is.list(value)) I(list(value)) else value
      })
      as.data.frame(record, check.names = FALSE, stringsAsFactors = FALSE)
    }))
  }
  cases <- records_df(internal$cases)
  actor_totals <- records_df(internal$totals$actor)
  pending_exit <- records_df(internal$pending_exit)
  issues <- records_df(internal$issues)

  expect_equal(actor_totals$efectivas[actor_totals$actor == "Estudiantes"], 3L)
  expect_equal(actor_totals$parciales[actor_totals$actor == "Estudiantes"], 2L)
  expect_equal(actor_totals$rechazos[actor_totals$actor == "Estudiantes"], 1L)
  expect_true(any(pending_exit$response_id == "r-aula" & pending_exit$collector_id == "QR_AULA_1"))
  expect_true(any(pending_exit$collector_id == "Faltantes_presencial"))
  expect_true(any(issues$issue_type == "parcial_identificable" & issues$response_id == "r-parcial"))
  expect_true(any(issues$issue_type == "parcial_no_identificable" & issues$response_id == "r-parcial-anon"))
  expect_true(any(issues$issue_type == "duplicado_caso" & issues$case_key == "codigo:A6"))
  expect_false(any(cases$response_id == "r-rechazo" & cases$advancement == "effective"))
  expect_true(length(internal$flow$nodes) > 0L)
  expect_true(length(internal$flow$links) > 0L)
})

test_that("Google Sheets reset limpia filtros y reglas previas de pestanas controladas", {
  requests <- .monitoreo_sheets_reset_tab_requests(
    42L,
    list(
      row_count = 20L,
      column_count = 8L,
      has_basic_filter = TRUE,
      conditional_format_count = 3L
    ),
    list(c("Indicador", "Valor"), c("Total", "2"))
  )

  expect_true(any(vapply(requests, function(request) !is.null(request$clearBasicFilter), logical(1))))
  expect_true(any(vapply(requests, function(request) !is.null(request$unmergeCells), logical(1))))
  deleted_indices <- unlist(lapply(requests, function(request) {
    request$deleteConditionalFormatRule$index %||% NULL
  }), use.names = FALSE)
  expect_equal(deleted_indices, c(2L, 1L, 0L))
  expect_true(any(vapply(requests, function(request) !is.null(request$updateCells), logical(1))))
  resize <- Filter(function(request) !is.null(request$updateSheetProperties), requests)[[1]]
  expect_equal(resize$updateSheetProperties$properties$gridProperties$rowCount, 2L)
  expect_equal(resize$updateSheetProperties$properties$gridProperties$columnCount, 2L)
})

test_that("Google Sheets publica solo pestanas Prosecnur controladas", {
  expect_error(
    monitoreo_sheets_publish_tabs("sheet_abc", list(Barrido = list(c("A", "B")))),
    "solo puede escribir"
  )

  env <- environment(monitoreo_sheets_publish_tabs)
  old_api <- get(".monitoreo_google_api", envir = env)
  set_google_api <- function(value) {
    was_locked <- bindingIsLocked(".monitoreo_google_api", env)
    if (was_locked) unlockBinding(".monitoreo_google_api", env)
    assign(".monitoreo_google_api", value, envir = env)
    if (was_locked) lockBinding(".monitoreo_google_api", env)
  }
  on.exit(set_google_api(old_api), add = TRUE)

  calls <- list()
  sheet_id <- 10L
  sheets <- list(list(properties = list(sheetId = 1L, title = "Barrido", gridProperties = list(rowCount = 1000L, columnCount = 26L))))
  set_google_api(function(url, method = "GET", body = NULL) {
    calls[[length(calls) + 1L]] <<- list(url = url, method = method, body = body)
    if (grepl("[?]fields=", url)) {
      return(list(spreadsheetId = "sheet_abc", sheets = sheets))
    }
    if (grepl(":batchUpdate$", url)) {
      for (request in body$requests %||% list()) {
        title <- request$addSheet$properties$title %||% ""
        if (nzchar(title)) {
          sheets[[length(sheets) + 1L]] <<- list(properties = list(
            sheetId = sheet_id,
            title = title,
            gridProperties = list(rowCount = 1000L, columnCount = 26L)
          ))
          sheet_id <<- sheet_id + 1L
        }
      }
      return(list(replies = list()))
    }
    list()
  })

  payload <- list(
    "Prosecnur - Resumen" = list(c("Indicador", "Valor"), c("Total", "2")),
    "Prosecnur - Alertas" = list(c("Nivel", "Tipo", "Detalle")),
    "Prosecnur - Auditoria" = list(c("Campo", "Valor")),
    "Prosecnur - Reporte" = list(c("Indicador", "Valor"))
  )
  out <- monitoreo_sheets_publish_tabs("sheet_abc", payload)

  expect_true(out$ok)
  expect_equal(out$controlled_tabs, as.list(names(payload)))
  write_calls <- calls[vapply(calls, function(call) grepl("/values/", call$url), logical(1))]
  expect_equal(length(write_calls), 8L)
  expect_false(any(grepl("Barrido", vapply(write_calls, `[[`, character(1), "url"), fixed = TRUE)))
  expect_true(all(grepl("Prosecnur", vapply(write_calls, `[[`, character(1), "url"), fixed = TRUE)))
  clear_calls <- write_calls[vapply(write_calls, function(call) identical(call$method, "POST"), logical(1))]
  expect_equal(length(clear_calls), 4L)
  expect_equal(as.character(jsonlite::toJSON(clear_calls[[1]]$body, auto_unbox = TRUE, null = "null")), "{}")

  batch_calls <- calls[vapply(calls, function(call) grepl(":batchUpdate$", call$url), logical(1))]
  add_titles <- unlist(lapply(batch_calls[[1]]$body$requests, function(request) request$addSheet$properties$title %||% NULL), use.names = FALSE)
  metadata_keys <- unlist(lapply(batch_calls[[2]]$body$requests, function(request) {
    request$createDeveloperMetadata$developerMetadata$metadataKey %||% NULL
  }), use.names = FALSE)
  expect_equal(sort(add_titles), sort(names(payload)))
  expect_equal(metadata_keys, rep("prosecnur.owner", 4L))
  reset_requests <- batch_calls[[3]]$body$requests
  expect_true(any(vapply(reset_requests, function(request) !is.null(request$unmergeCells), logical(1))))
  expect_true(any(vapply(reset_requests, function(request) !is.null(request$updateCells), logical(1))))
  expect_true(any(vapply(reset_requests, function(request) {
    !is.null(request$updateSheetProperties$properties$gridProperties$rowCount)
  }, logical(1))))
  format_requests <- batch_calls[[4]]$body$requests
  frozen <- unlist(lapply(format_requests, function(request) {
    request$updateSheetProperties$properties$gridProperties$frozenRowCount %||% NULL
  }), use.names = FALSE)
  expect_true(length(frozen) >= 4L)
  expect_true(all(frozen == 1L))
  expect_true(any(vapply(format_requests, function(request) !is.null(request$setBasicFilter), logical(1))))

  first_batch_count <- length(batch_calls)
  out2 <- monitoreo_sheets_publish_tabs("sheet_abc", payload)
  expect_true(out2$ok)
  batch_calls2 <- calls[vapply(calls, function(call) grepl(":batchUpdate$", call$url), logical(1))]
  second_batch_calls <- batch_calls2[seq.int(first_batch_count + 1L, length(batch_calls2))]
  second_add_titles <- unlist(lapply(second_batch_calls, function(batch) {
    lapply(batch$body$requests %||% list(), function(request) request$addSheet$properties$title %||% NULL)
  }), use.names = FALSE)
  expect_length(second_add_titles, 0L)
  expect_true(any(vapply(unlist(lapply(second_batch_calls, function(batch) batch$body$requests %||% list()), recursive = FALSE), function(request) {
    !is.null(request$updateCells)
  }, logical(1))))
})

test_that("Google Sheets con encabezado vacio produce data frame vacio", {
  empty <- .monitoreo_values_to_dataframe(list(character(0)), header_row = 1L)
  expect_s3_class(empty, "data.frame")
  expect_equal(nrow(empty), 0L)
  expect_equal(ncol(empty), 0L)
})

test_that("monitoreo territorial usa Kobo vivo como canon de distritos", {
  cw <- .monitoreo_territorial_crosswalk_df()
  expect_true("sjm" %in% cw$kobo_code)
  expect_false("vmt" %in% cw$kobo_code)
  cfg <- monitoreo_normalize_config(list(monitoreo_profile = list(family = "territorial")))
  expect_equal(cfg$territorial$district_var, "Core/M5_district")
  expect_equal(cfg$territorial$active_route_phase, "pilot")
})

test_that("monitoreo territorial resuelve manzanas por id, cero operativo y fallback", {
  features <- data.frame(
    IDMANZANA = c("150135001001", "150135001002", "150135002003"),
    UBIGEO = "150135",
    CODZONA = c("001", "001", "002"),
    CODMZNA = c("001", "002", "003"),
    stringsAsFactors = FALSE
  )
  blocks <- data.frame(
    id_manzana = c("150135001001", "1501350010020", "sin-id"),
    ubigeo = "150135",
    zona = c("001", "001", "002"),
    manzana = c("001", "002", "003"),
    stringsAsFactors = FALSE
  )
  resolved <- .monitoreo_territorial_resolve_blocks(blocks, features)
  expect_equal(resolved$resolved_id_manzana[[1]], "150135001001")
  expect_equal(resolved$match_method[[1]], "id_manzana_exact")
  expect_equal(resolved$resolved_id_manzana[[2]], "150135001002")
  expect_equal(resolved$match_method[[2]], "id_manzana_drop_operational_zero")
  expect_equal(resolved$resolved_id_manzana[[3]], "150135002003")
  expect_equal(resolved$match_method[[3]], "ubigeo_zona_manzana")
  expect_false(any(resolved$geometry_unresolved))
})

test_that("monitoreo territorial valida respuestas y separa avance oficial", {
  data <- data.frame(
    `Core/M5_district` = c("sjm", "sjm", "sjm", "vmt"),
    `_geolocation` = c("-12.1 -77.0", "-12.1 -77.0", "-12.1 -77.0", "-12.1 -77.0"),
    consent = c("1", "1", "0", "1"),
    `Core/E1_age` = c(25, 25, 25, 25),
    `_status` = rep("submitted_via_web", 4),
    `_uuid` = c("a", "b", "c", "d"),
    `_submitted_by` = c("enc1", "enc1", "enc2", "enc2"),
    start = rep("2026-06-01T10:00:00Z", 4),
    end = c("2026-06-01T10:10:00Z", "2026-06-01T10:00:20Z", "2026-06-01T10:10:00Z", "2026-06-01T10:10:00Z"),
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(monitoreo_profile = list(family = "territorial", status = "active")), data)
  context <- list(
    phase = "pilot",
    blocks = list(list(id_manzana = "150133001001", ubigeo = "150133", distrito = "SAN JUAN DE MIRAFLORES", zona = "001", manzana = "001", entrevistas = 2)),
    geo_results = data.frame(
      lat = rep(-12.1, 4),
      lon = rep(-77, 4),
      gps_parseable = rep(TRUE, 4),
      geo_estado = c("geo_ok", "geo_revision", "geo_ok", "geo_no_defendible"),
      distance_m = c(0, 180, 0, 450),
      nearest_block_id = rep("150133001001", 4),
      nearest_block_type = rep("titular", 4),
      geometry_match = c("inside_selected_block", "review_150_300m", "inside_selected_block", "district_unresolved"),
      stringsAsFactors = FALSE
    )
  )
  report <- monitoreo_territorial_reportes(data, cfg, context)
  expect_equal(report$kpis$total_respuestas, 4L)
  expect_equal(report$kpis$validas, 1L)
  expect_equal(report$kpis$revision, 1L)
  expect_equal(report$kpis$no_defendibles, 2L)
  expect_equal(report$district_progress[[1]]$validas, 1L)
  expect_equal(report$block_progress[[1]]$validas, 0L)
  expect_equal(report$response_audit[[1]]$submission_date, "1 Junio")
  expect_equal(report$response_audit[[1]]$submission_hour, "05:10am")
  expect_equal(report$daily[[1]]$date_label, "1 Junio")
  expect_equal(length(report$map$points), 4L)
  expect_equal(report$map$points[[1]]$lat, -12.1)
  expect_equal(report$map$points[[1]]$geo_estado, "geo_ok")
})

test_that("monitoreo territorial recupera sexo y edad desde rutas alternativas", {
  data <- data.frame(
    `Core/M5_district` = c("sjm", "sjm"),
    `Core/M8_ump` = c("1", "1"),
    `_geolocation` = c("-12.1 -77.0", "-12.1 -77.0"),
    consent = c("1", "1"),
    `Core/E1_age` = c("", NA),
    `identificacion_consolidado/edad` = c("35 años", "42"),
    `Core/E2_sex` = c("", NA),
    `identificacion_consolidado/sexo` = c("Hombre", "Mujer"),
    `_status` = rep("submitted_via_web", 2),
    `_uuid` = c("sex-age-a", "sex-age-b"),
    `_submitted_by` = c("enc1", "enc1"),
    start = c("2026-06-01T10:00:00Z", "2026-06-01T10:20:00Z"),
    end = c("2026-06-01T10:10:00Z", "2026-06-01T10:30:00Z"),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial", status = "active"),
    territorial = list(
      district_var = "Core/M5_district",
      ump_var = "Core/M8_ump",
      age_var = "Core/E1_age",
      sex_var = "Core/E2_sex"
    )
  ), data)
  context <- list(
    phase = "pilot",
    blocks = list(list(
      id_manzana = "150133001001",
      ubigeo = "150133",
      distrito = "SAN JUAN DE MIRAFLORES",
      zona = "001",
      manzana = "001",
      hoja_num = 1,
      entrevistas = 2
    )),
    geo_results = data.frame(
      lat = c(-12.1, -12.1),
      lon = c(-77, -77),
      gps_parseable = c(TRUE, TRUE),
      geo_estado = c("geo_ok", "geo_ok"),
      distance_m = c(0, 0),
      nearest_block_id = rep("150133001001", 2),
      nearest_block_type = rep("titular", 2),
      geometry_match = rep("inside_selected_block", 2),
      stringsAsFactors = FALSE
    )
  )

  report <- monitoreo_territorial_reportes(data, cfg, context)
  audit <- .monitoreo_workbook_df(report$response_audit)
  expect_equal(suppressWarnings(as.numeric(audit$age)), c(35, 42))
  expect_equal(audit$sex, c("Hombre", "Mujer"))

  report$config <- cfg
  master <- .monitoreo_publication_territorial_master_df(data, report)
  master_by_uuid <- master[match(c("sex-age-a", "sex-age-b"), master$UUID), , drop = FALSE]
  expect_equal(master_by_uuid$Edad, c(35, 42))
  expect_equal(master_by_uuid$Sexo, c("Hombre", "Mujer"))
})

test_that("monitoreo territorial cuenta avance UMP por declaracion y no por GPS", {
  data <- data.frame(
    `Core/M5_district` = c("sjm", "sjm", "sjm"),
    `Core/M8_ump` = c("7", "7", ""),
    `_geolocation` = c("", "-12.1 -77.0", "-12.1 -77.0"),
    consent = c("1", "1", "1"),
    `Core/E1_age` = c(25, 25, 25),
    `_status` = rep("submitted_via_web", 3),
    `_uuid` = c("ump-no-gps", "ump-gps", "gps-only"),
    `_submitted_by` = c("enc1", "enc1", "enc2"),
    start = rep("2026-06-01T10:00:00Z", 3),
    end = rep("2026-06-01T10:10:00Z", 3),
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial", status = "active"),
    territorial = list(
      district_var = "Core/M5_district",
      ump_var = "Core/M8_ump"
    )
  ), data)
  context <- list(
    phase = "pilot",
    blocks = list(list(
      id_manzana = "150133001001",
      ubigeo = "150133",
      distrito = "SAN JUAN DE MIRAFLORES",
      zona = "001",
      manzana = "001",
      hoja_num = 7,
      orden_seleccion = 7,
      entrevistas = 3
    )),
    geo_results = data.frame(
      lat = c(NA_real_, -12.1, -12.1),
      lon = c(NA_real_, -77, -77),
      gps_parseable = c(FALSE, TRUE, TRUE),
      geo_estado = c("geo_sin_gps", "geo_ok", "geo_ok"),
      distance_m = c(NA_real_, 0, 0),
      nearest_block_id = c("", "150133001001", "150133001001"),
      nearest_block_type = c("", "titular", "titular"),
      geometry_match = c("", "inside_selected_block", "inside_selected_block"),
      stringsAsFactors = FALSE
    )
  )

  report <- monitoreo_territorial_reportes(data, cfg, context)
  light_report <- monitoreo_territorial_reportes(data, cfg, context, report_scope = "advance_summary")

  expect_equal(report$advance$validas, 2L)
  expect_equal(report$advance$no_validas, 1L)
  expect_equal(report$advance$block_progress[[1]]$validas, 2L)
  expect_equal(light_report$advance$validas, 2L)
  expect_equal(report$block_progress[[1]]$validas, 2L)
  expect_equal(light_report$advance$block_progress[[1]]$validas, 2L)
  expect_equal(report$response_audit[[1]]$advance_block_id, "150133001001")
  expect_equal(report$response_audit[[1]]$geo_estado, "geo_sin_gps")
  expect_equal(report$response_audit[[3]]$advance_block_id, "")
  expect_false(isTRUE(report$response_audit[[3]]$advance_valid))
  expect_match(report$response_audit[[3]]$issues, "ump_sin_cruce")
  expect_equal(report$map$blocks[[1]]$validas, 2L)
})

test_that("monitoreo territorial cruza UMP literal y no usa llaves normalizadas", {
  route_blocks <- data.frame(
    id_manzana = c("150103012000070", "150117030000290", "150117024000360", "150133047000220", "150135048000220"),
    ubigeo = c("150103", "150117", "150117", "150133", "150135"),
    distrito = c("ATE", "LOS OLIVOS", "LOS OLIVOS", "SAN JUAN DE MIRAFLORES", "SAN MARTIN DE PORRES"),
    zona = c("01200", "03000", "02400", "04700", "04800"),
    manzana = c("0070", "0290", "0360", "0220", "0220"),
    tipo_manzana = c("titular", "titular", "reemplazo", "titular", "titular"),
    hoja_num = c(6L, 70L, 70L, 124L, 136L),
    orden_seleccion = c(6L, 70L, 70L, 124L, 136L),
    titular_hoja_num = c(NA_integer_, NA_integer_, 70L, NA_integer_, NA_integer_),
    titular_id_manzana = c("", "", "150117030000290", "", ""),
    entrevistas = rep(8L, 5),
    stringsAsFactors = FALSE
  )

  lookup <- .monitoreo_territorial_route_ump_lookup(route_blocks)
  expect_true("70" %in% names(lookup$by_literal))
  expect_true("150135048000220" %in% names(lookup$by_block_literal))
  expect_equal(lookup$by_literal[["70"]][[1]]$id_manzana, "150117030000290")
  expect_equal(lookup$route_ump_count, 4L)

  resolved <- .monitoreo_territorial_declared_ump_matches(
    c("70", "0220", "0220", "0290", "150135048000220"),
    route_blocks,
    ubigeo = c("", "150135", "150133", "150117", ""),
    distrito = c("", "SAN MARTIN DE PORRES", "SAN JUAN DE MIRAFLORES", "LOS OLIVOS", "")
  )

  expect_equal(resolved$advance_block_id[[1]], "150117030000290")
  expect_equal(resolved$advance_block_ump[[1]], "70")
  expect_equal(resolved$advance_block_type[[1]], "titular")
  expect_equal(resolved$advance_block_match_source[[1]], "literal")
  expect_equal(resolved$advance_block_match_status[[1]], "recognized")
  expect_equal(resolved$advance_block_id[[2]], "")
  expect_equal(resolved$advance_block_match_status[[2]], "review")
  expect_equal(resolved$advance_block_id[[3]], "")
  expect_equal(resolved$advance_block_match_status[[3]], "review")
  expect_equal(resolved$advance_block_id[[4]], "")
  expect_equal(resolved$advance_block_match_status[[4]], "review")
  expect_equal(resolved$advance_block_id[[5]], "")
  expect_equal(resolved$advance_block_match_status[[5]], "review")
})

test_that("monitoreo territorial reconcilia UMP por respuesta y por valor literal", {
  route_blocks <- data.frame(
    id_manzana = "150117030000290",
    ubigeo = "150117",
    distrito = "LOS OLIVOS",
    zona = "03000",
    manzana = "0290",
    tipo_manzana = "titular",
    hoja_num = 70L,
    orden_seleccion = 70L,
    entrevistas = 8L,
    stringsAsFactors = FALSE
  )
  raw <- c("UMP 70", "UMP 70", "070", "70")
  response_id <- c("r-1", "r-2", "r-3", "r-4")

  unresolved <- .monitoreo_territorial_declared_ump_matches(raw, route_blocks, response_id = response_id, phase = "field")
  expect_equal(unresolved$advance_block_match_status, c("review", "review", "review", "recognized"))

  resolved <- .monitoreo_territorial_declared_ump_matches(
    raw,
    route_blocks,
    response_id = response_id,
    phase = "field",
    reconciliations = list(
      field = list(
        list(
          raw_ump = "UMP 70",
          assigned_block_id = "150117030000290",
          assigned_ump = "70",
          assigned_district = "LOS OLIVOS",
          assigned_ubigeo = "150117",
          scope = "ump_value"
        ),
        list(
          response_id = "r-3",
          raw_ump = "070",
          assigned_block_id = "150117030000290",
          assigned_ump = "70",
          assigned_district = "LOS OLIVOS",
          assigned_ubigeo = "150117",
          scope = "response"
        )
      )
    )
  )

  expect_equal(resolved$advance_block_match_status, c("reconciled", "reconciled", "reconciled", "recognized"))
  expect_equal(resolved$advance_block_reconciliation_scope[[1]], "ump_value")
  expect_equal(resolved$advance_block_reconciliation_scope[[3]], "response")
  expect_equal(resolved$advance_block_id, rep("150117030000290", 4))
})

test_that("monitoreo territorial expone responsable en resumen de reconciliacion UMP", {
  data <- data.frame(
    ump = c("70", "999"),
    codigo_pulso = c("P001", "P002"),
    `_uuid` = c("r-route", "r-code"),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  route_blocks <- data.frame(
    id_manzana = "150117030000290",
    ubigeo = "150117",
    distrito = "LOS OLIVOS",
    zona = "03000",
    manzana = "0290",
    tipo_manzana = "titular",
    hoja_num = 70L,
    orden_seleccion = 70L,
    responsable = "Ana Ruta",
    stringsAsFactors = FALSE
  )
  summary <- .monitoreo_territorial_declared_ump_summary(
    data,
    list(
      ump_var = "ump",
      active_route_phase = "field",
      variable_refs = list(),
      ump_reconciliation = list()
    ),
    route_blocks = route_blocks,
    enumerator_assigned = c("Ana Kobo", "Bruno Kobo"),
    phase = "field"
  )
  rows <- stats::setNames(summary$rows, vapply(summary$rows, function(row) as.character(row$raw_ump %||% ""), character(1)))

  expect_equal(rows[["70"]]$responsible, "Ana Ruta")
  expect_equal(rows[["70"]]$responsible_source, "route")
  expect_equal(rows[["70"]]$assigned_responsible, "Ana Ruta")
  expect_equal(rows[["999"]]$responsible, "Bruno Kobo")
  expect_equal(rows[["999"]]$responsible_source, "codigo_pulso")
})

test_that("monitoreo territorial prioriza timestamp Kobo sobre inicio de entrevista", {
  data <- data.frame(
    kobo_timestamp_iso = "2026-06-16T20:58:11Z",
    `_submission_time` = "2026-06-16T20:58:11",
    start = "2026-06-15T16:31:10.260-05:00",
    end = "2026-06-15T23:04:18.892-05:00",
    check.names = FALSE
  )
  pick <- .monitoreo_territorial_submission_time_values(
    data,
    list(submission_time_var = "_submission_time", start_var = "start", end_var = "end")
  )
  parsed <- .monitoreo_parse_time_vec(pick$values)

  expect_equal(pick$source, "kobo_timestamp_iso")
  expect_equal(.monitoreo_date_iso_vec(parsed, pick$values), "2026-06-16")
  expect_equal(.monitoreo_format_datetime_label_vec(parsed, pick$values), "16 Junio 03:58pm")
})

test_that("monitoreo territorial no confunde UMP 70 con manzana 0070", {
  data <- data.frame(
    `Core/M5_district` = "olivos",
    `Core/M8_ump` = "70",
    `_geolocation` = "",
    consent = "1",
    `Core/E1_age` = 25,
    `_status` = "submitted_via_web",
    `_uuid` = "ump-70",
    `_submitted_by` = "P702",
    start = "2026-06-16T20:50:00Z",
    end = "2026-06-16T21:00:00Z",
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial", status = "active"),
    territorial = list(
      district_var = "Core/M5_district",
      ump_var = "Core/M8_ump",
      district_crosswalk = list(
        list(kobo_code = "ate", kobo_label = "Ate", ubigeo = "150103", distrito = "ATE"),
        list(kobo_code = "olivos", kobo_label = "Los Olivos", ubigeo = "150117", distrito = "LOS OLIVOS")
      )
    )
  ), data)
  context <- list(
    phase = "field",
    blocks = list(
      list(id_manzana = "150103012000070", ubigeo = "150103", distrito = "ATE", zona = "01200", manzana = "0070", hoja_num = 6, orden_seleccion = 6, entrevistas = 8),
      list(id_manzana = "150117030000290", ubigeo = "150117", distrito = "LOS OLIVOS", zona = "03000", manzana = "0290", hoja_num = 70, orden_seleccion = 70, entrevistas = 8)
    )
  )

  report <- monitoreo_territorial_reportes(data, cfg, context)
  by_ump <- stats::setNames(report$block_progress, vapply(report$block_progress, function(block) as.character(block$ump %||% ""), character(1)))

  expect_equal(report$response_audit[[1]]$advance_block_id, "150117030000290")
  expect_equal(report$response_audit[[1]]$advance_block_ump, "70")
  expect_equal(by_ump[["6"]]$validas, 0L)
  expect_equal(by_ump[["70"]]$validas, 1L)
})

test_that("monitoreo territorial no normaliza UMP para avance y permite reconciliarla", {
  data <- data.frame(
    `Core/M5_district` = "olivos",
    `Core/M8_ump` = "UMP 70",
    `_geolocation` = "",
    consent = "1",
    `Core/E1_age` = 25,
    `_status` = "submitted_via_web",
    `_uuid` = "ump-70-prefix",
    `_submitted_by` = "P702",
    start = "2026-06-16T20:50:00Z",
    end = "2026-06-16T21:00:00Z",
    check.names = FALSE
  )
  base_cfg <- list(
    monitoreo_profile = list(family = "territorial", status = "active"),
    territorial = list(
      district_var = "Core/M5_district",
      ump_var = "Core/M8_ump",
      district_crosswalk = list(
        list(kobo_code = "olivos", kobo_label = "Los Olivos", ubigeo = "150117", distrito = "LOS OLIVOS")
      )
    )
  )
  context <- list(
    phase = "field",
    blocks = list(
      list(id_manzana = "150117030000290", ubigeo = "150117", distrito = "LOS OLIVOS", zona = "03000", manzana = "0290", hoja_num = 70, orden_seleccion = 70, entrevistas = 8)
    )
  )

  unresolved_report <- monitoreo_territorial_reportes(data, monitoreo_normalize_config(base_cfg, data), context)
  expect_equal(unresolved_report$response_audit[[1]]$advance_block_id, "")
  expect_false(isTRUE(unresolved_report$response_audit[[1]]$advance_valid))
  expect_match(unresolved_report$response_audit[[1]]$issues, "ump_sin_cruce")

  reconciled_cfg <- base_cfg
  reconciled_cfg$territorial$ump_reconciliation <- list(
    field = list(
      list(
        raw_ump = "UMP 70",
        assigned_block_id = "150117030000290",
        assigned_ump = "70",
        assigned_district = "LOS OLIVOS",
        assigned_ubigeo = "150117",
        scope = "ump_value"
      )
    )
  )
  resolved_report <- monitoreo_territorial_reportes(data, monitoreo_normalize_config(reconciled_cfg, data), context)
  expect_equal(resolved_report$response_audit[[1]]$advance_block_id, "150117030000290")
  expect_equal(resolved_report$response_audit[[1]]$advance_block_match_status, "reconciled")
  expect_true(isTRUE(resolved_report$response_audit[[1]]$advance_valid))
  expect_equal(resolved_report$advance$validas, 1L)
})

test_that("monitoreo territorial cuotas cruza Kobo por UMP declarada y no por GPS", {
  context <- list(
    phase = "pilot",
    config = list(
      age_range_mode = "manual",
      entrevistas_por_manzana = 4,
      age_ranges = list(
        list(id = "18_29", label = "18-29", min = 18L, max = 29L),
        list(id = "30_44", label = "30-44", min = 30L, max = 44L)
      )
    ),
    blocks = list(list(
      id_manzana = "150133001001",
      ubigeo = "150133",
      distrito = "SAN JUAN DE MIRAFLORES",
      zona = "001",
      manzana = "001",
      hoja_num = 7,
      entrevistas = 4,
      territorio_muestral = "150133-001",
      pob_18_24_h = 80,
      pob_18_24_m = 80,
      pob_25_34_h = 0,
      pob_25_34_m = 0,
      pob_35_44_h = 20,
      pob_35_44_m = 20
    )),
    quota = list(cells = list(
      list(ubigeo = "150133", territorio = "150133-001", rango_edad = "18-29", sexo = "Hombre", cuota = 2),
      list(ubigeo = "150133", territorio = "150133-001", rango_edad = "30-44", sexo = "Mujer", cuota = 2)
    ))
  )
  operational_blocks <- .monitoreo_territorial_block_goal_df(context, include_replacements = TRUE)
  audit <- data.frame(
    nearest_block_id = c("999999999999", "999999999999", "150133001001"),
    advance_block_id = c("", "", ""),
    declared_ump_raw = c("7", "UMP 7", ""),
    declared_ump_normalized = c("", "", ""),
    advance_block_ump = c("", "", ""),
    advance_valid = c(TRUE, TRUE, TRUE),
    sex = c("Hombre", "Mujer", "Hombre"),
    age = c(25, 40, 25),
    stringsAsFactors = FALSE
  )

  payload <- .monitoreo_territorial_quota_progress_payload(
    context,
    operational_blocks,
    audit,
    list(
      active_route_phase = "pilot",
      age_var = "Core/E1_age",
      sex_var = "sexo",
      ump_reconciliation = list(
        pilot = list(
          list(
            raw_ump = "UMP 7",
            assigned_block_id = "150133001001",
            assigned_ump = "7",
            assigned_district = "SAN JUAN DE MIRAFLORES",
            assigned_ubigeo = "150133",
            scope = "ump_value"
          )
        )
      )
    )
  )
  block <- payload$blocks[[1]]
  sex_achieved <- stats::setNames(
    vapply(block$sex, function(row) as.integer(row$achieved %||% 0L), integer(1)),
    vapply(block$sex, function(row) as.character(row$label %||% ""), character(1))
  )
  age_achieved <- stats::setNames(
    vapply(block$age, function(row) as.integer(row$achieved %||% 0L), integer(1)),
    vapply(block$age, function(row) as.character(row$label %||% ""), character(1))
  )

  expect_equal(block$validas, 2L)
  expect_equal(sex_achieved[["Hombre"]], 1L)
  expect_equal(sex_achieved[["Mujer"]], 1L)
  expect_equal(age_achieved[["18-29"]], 1L)
  expect_equal(age_achieved[["30-44"]], 1L)
})

.with_mocked_hojas_ruta_reference_quota_marginals <- function(value) {
  target_env <- environment(.monitoreo_territorial_route_quota_marginals_payload)
  name <- ".hojas_ruta_reference_quota_marginals"
  had_previous <- exists(name, envir = target_env, inherits = FALSE)
  previous <- if (had_previous) get(name, envir = target_env) else NULL
  was_locked <- had_previous && bindingIsLocked(name, target_env)
  if (was_locked) unlockBinding(name, target_env)
  assign(name, value, envir = target_env)
  if (was_locked) lockBinding(name, target_env)

  function() {
    exists_now <- exists(name, envir = target_env, inherits = FALSE)
    is_locked <- exists_now && bindingIsLocked(name, target_env)
    if (is_locked) unlockBinding(name, target_env)
    if (had_previous) {
      assign(name, previous, envir = target_env)
    } else if (exists_now) {
      rm(list = name, envir = target_env)
    }
    if (was_locked && exists(name, envir = target_env, inherits = FALSE)) {
      lockBinding(name, target_env)
    }
  }
}

test_that("monitoreo territorial cuotas expone llenado observado consentido por sexo y edad", {
  restore_quota_marginals <- .with_mocked_hojas_ruta_reference_quota_marginals(function(block, config) NULL)
  on.exit(restore_quota_marginals(), add = TRUE)

  context <- list(
    phase = "pilot",
    blocks = list(list(
      id_manzana = "150133001007",
      ubigeo = "150133",
      distrito = "SAN JUAN DE MIRAFLORES",
      zona = "001",
      manzana = "007",
      hoja_num = 7,
      entrevistas = 4,
      territorio_muestral = "150133-001"
    )),
    quota = list(cells = list(
      list(id_manzana = "150133001007", ubigeo = "150133", territorio = "150133-001", rango_edad = "18-29", sexo = "Hombre", cuota = 2),
      list(id_manzana = "150133001007", ubigeo = "150133", territorio = "150133-001", rango_edad = "30-44", sexo = "Mujer", cuota = 2)
    ))
  )
  operational_blocks <- .monitoreo_territorial_block_goal_df(context, include_replacements = TRUE)
  audit <- data.frame(
    advance_block_id = "",
    declared_ump_raw = c("7", "7", "7", "7"),
    declared_ump_normalized = "",
    advance_block_ump = "",
    ubigeo = "150133",
    advance_block_ubigeo = "150133",
    advance_valid = c(TRUE, TRUE, FALSE, TRUE),
    consent = c("1", "1", "0", "1"),
    sex = c("Hombre", "Mujer", "Hombre", ""),
    age = c(25, 40, 25, NA),
    stringsAsFactors = FALSE
  )

  payload <- .monitoreo_territorial_quota_progress_payload(
    context,
    operational_blocks,
    audit,
    list(age_var = "Core/E1_age", sex_var = "sexo")
  )
  block <- payload$blocks[[1]]
  cross <- block$observed_cross
  rows <- stats::setNames(cross$rows, vapply(cross$rows, function(row) as.character(row$label %||% ""), character(1)))
  columns <- stats::setNames(
    vapply(cross$columns, function(column) as.integer(column$total %||% 0L), integer(1)),
    vapply(cross$columns, function(column) as.character(column$label %||% ""), character(1))
  )
  hombre_cells <- stats::setNames(
    vapply(rows[["Hombre"]]$cells, function(cell) as.integer(cell$value %||% 0L), integer(1)),
    vapply(rows[["Hombre"]]$cells, function(cell) as.character(cell$label %||% ""), character(1))
  )
  mujer_cells <- stats::setNames(
    vapply(rows[["Mujer"]]$cells, function(cell) as.integer(cell$value %||% 0L), integer(1)),
    vapply(rows[["Mujer"]]$cells, function(cell) as.character(cell$label %||% ""), character(1))
  )
  sin_dato_cells <- stats::setNames(
    vapply(rows[["Sin dato"]]$cells, function(cell) as.integer(cell$value %||% 0L), integer(1)),
    vapply(rows[["Sin dato"]]$cells, function(cell) as.character(cell$label %||% ""), character(1))
  )

  expect_equal(cross$total_consentido, 3L)
  expect_equal(hombre_cells[["18-29"]], 1L)
  expect_equal(mujer_cells[["30-44"]], 1L)
  expect_equal(sin_dato_cells[["Sin dato"]], 1L)
  expect_equal(rows[["Hombre"]]$total, 1L)
  expect_equal(rows[["Mujer"]]$total, 1L)
  expect_equal(rows[["Sin dato"]]$total, 1L)
  expect_equal(columns[["18-29"]], 1L)
  expect_equal(columns[["30-44"]], 1L)
  expect_equal(columns[["Sin dato"]], 1L)

  audit_blank_consent <- audit
  audit_blank_consent$consent <- ""
  payload_blank_consent <- .monitoreo_territorial_quota_progress_payload(
    context,
    operational_blocks,
    audit_blank_consent,
    list(age_var = "Core/E1_age", sex_var = "sexo")
  )
  expect_equal(payload_blank_consent$blocks[[1]]$observed_cross$total_consentido, 3L)
})

test_that("monitoreo territorial cuotas prioriza marginales por manzana", {
  restore_quota_marginals <- .with_mocked_hojas_ruta_reference_quota_marginals(function(block, config) {
    list(
      defs = list(
        list(id = "18_29", label = "18-29", min = 18L, max = 29L),
        list(id = "30_44", label = "30-44", min = 30L, max = 44L)
      ),
      age_totals = c(3L, 1L),
      hombre_total = 3L,
      mujer_total = 1L,
      entrevistas = 4L
    )
  })
  on.exit(restore_quota_marginals(), add = TRUE)

  context <- list(
    phase = "pilot",
    blocks = list(list(
      id_manzana = "150133001004",
      ubigeo = "150133",
      distrito = "SAN JUAN DE MIRAFLORES",
      zona = "001",
      manzana = "004",
      hoja_num = 4,
      entrevistas = 4,
      territorio_muestral = "150133-001"
    )),
    quota = list(cells = list(
      list(ubigeo = "150133", territorio = "150133-001", rango_edad = "18-29", sexo = "Hombre", cuota = 4)
    ))
  )
  operational_blocks <- .monitoreo_territorial_block_goal_df(context, include_replacements = TRUE)
  audit <- data.frame(
    nearest_block_id = "",
    advance_block_id = "",
    declared_ump_raw = "4",
    declared_ump_normalized = "",
    advance_block_ump = "",
    ubigeo = "150133",
    advance_block_ubigeo = "150133",
    advance_valid = TRUE,
    sex = "Hombre",
    age = 25,
    stringsAsFactors = FALSE
  )

  payload <- .monitoreo_territorial_quota_progress_payload(
    context,
    operational_blocks,
    audit,
    list(age_var = "Core/E1_age", sex_var = "sexo")
  )
  block <- payload$blocks[[1]]
  age_target <- stats::setNames(
    vapply(block$age, function(row) as.integer(row$target %||% 0L), integer(1)),
    vapply(block$age, function(row) as.character(row$label %||% ""), character(1))
  )
  sex_target <- stats::setNames(
    vapply(block$sex, function(row) as.integer(row$target %||% 0L), integer(1)),
    vapply(block$sex, function(row) as.character(row$label %||% ""), character(1))
  )

  expect_equal(age_target[["18-29"]], 3L)
  expect_equal(age_target[["30-44"]], 1L)
  expect_equal(sex_target[["Hombre"]], 3L)
  expect_equal(sex_target[["Mujer"]], 1L)
})

test_that("monitoreo territorial interpreta rangos abiertos como 60+", {
  labels <- .monitoreo_territorial_quota_age_label(c(59, 60, 63, 75), c("45-59", "60+"))
  expect_equal(labels, c("45-59", "60+", "60+", "60+"))

  labels_text <- .monitoreo_territorial_quota_age_label(c(59, 60, 72), c("45-59", "60 a más"))
  expect_equal(labels_text, c("45-59", "60 a más", "60 a más"))
})

test_that("monitoreo territorial clasifica cuotas por actividad de campo", {
  restore_quota_marginals <- .with_mocked_hojas_ruta_reference_quota_marginals(function(block, config) NULL)
  on.exit(restore_quota_marginals(), add = TRUE)

  today <- as.character(as.Date(Sys.time(), tz = "America/Lima"))
  yesterday <- as.character(as.Date(Sys.time(), tz = "America/Lima") - 1)
  context <- list(
    phase = "pilot",
    blocks = list(
      list(id_manzana = "150133001001", ubigeo = "150133", distrito = "SAN JUAN DE MIRAFLORES", zona = "001", manzana = "001", hoja_num = 1, entrevistas = 2, responsable = "Ana Campo"),
      list(id_manzana = "150133001002", ubigeo = "150133", distrito = "SAN JUAN DE MIRAFLORES", zona = "001", manzana = "002", hoja_num = 2, entrevistas = 2, responsable = "Bruno Campo"),
      list(id_manzana = "150133001003", ubigeo = "150133", distrito = "SAN JUAN DE MIRAFLORES", zona = "001", manzana = "003", hoja_num = 3, entrevistas = 2, responsable = "Carla Campo"),
      list(id_manzana = "150133001004", ubigeo = "150133", distrito = "SAN JUAN DE MIRAFLORES", zona = "001", manzana = "004", hoja_num = 4, entrevistas = 2, responsable = "Diego Campo")
    ),
    quota = list(cells = list(
      list(id_manzana = "150133001001", ubigeo = "150133", territorio = "150133-001", rango_edad = "", sexo = "Hombre", cuota = 1),
      list(id_manzana = "150133001001", ubigeo = "150133", territorio = "150133-001", rango_edad = "", sexo = "Mujer", cuota = 1),
      list(id_manzana = "150133001002", ubigeo = "150133", territorio = "150133-001", rango_edad = "", sexo = "Hombre", cuota = 1),
      list(id_manzana = "150133001002", ubigeo = "150133", territorio = "150133-001", rango_edad = "", sexo = "Mujer", cuota = 1),
      list(id_manzana = "150133001003", ubigeo = "150133", territorio = "150133-001", rango_edad = "", sexo = "Hombre", cuota = 1),
      list(id_manzana = "150133001003", ubigeo = "150133", territorio = "150133-001", rango_edad = "", sexo = "Mujer", cuota = 1),
      list(id_manzana = "150133001004", ubigeo = "150133", territorio = "150133-001", rango_edad = "", sexo = "Hombre", cuota = 1),
      list(id_manzana = "150133001004", ubigeo = "150133", territorio = "150133-001", rango_edad = "", sexo = "Mujer", cuota = 1)
    ))
  )
  operational_blocks <- .monitoreo_territorial_block_goal_df(context, include_replacements = TRUE)
  audit <- data.frame(
    advance_block_id = "",
    declared_ump_raw = c("1", "2", "4", "4", "4"),
    declared_ump_normalized = "",
    advance_block_ump = "",
    ubigeo = "150133",
    advance_block_ubigeo = "150133",
    advance_valid = TRUE,
    sex = c("Hombre", "Hombre", "Hombre", "Mujer", "Mujer"),
    age = c(25, 30, 35, 36, 37),
    submission_date_iso = c(today, yesterday, today, today, today),
    submission_date = c("Fecha hoy", "Fecha ayer", "Fecha hoy", "Fecha hoy", "Fecha hoy"),
    submission_hour = c("03:34pm", "10:05am", "02:10pm", "02:20pm", "02:30pm"),
    responsible_display = c("Ana Kobo", "Bruno Kobo", "Diego Kobo", "Diego Kobo", "Diego Kobo"),
    stringsAsFactors = FALSE
  )

  payload <- .monitoreo_territorial_quota_progress_payload(
    context,
    operational_blocks,
    audit,
    list(age_var = "Core/E1_age", sex_var = "sexo")
  )
  statuses <- stats::setNames(
    vapply(payload$blocks, function(block) as.character(block$status %||% ""), character(1)),
    vapply(payload$blocks, function(block) as.character(block$ump %||% ""), character(1))
  )

  expect_identical(statuses[["1"]], "in_field")
  expect_identical(statuses[["2"]], "pending")
  expect_identical(statuses[["3"]], "missing")
  expect_identical(statuses[["4"]], "complete")
  expect_equal(payload$summary$sex_missing_total, 4L)
  expect_equal(payload$summary$age_missing_total, 0L)
  expect_equal(payload$summary$demographic_missing_total, 4L)
  expect_equal(payload$district_summary$sex_missing_total, 3L)
  expect_equal(payload$district_summary$demographic_missing_total, 3L)
  responsables <- stats::setNames(
    vapply(payload$blocks, function(block) as.character(block$responsable %||% ""), character(1)),
    vapply(payload$blocks, function(block) as.character(block$ump %||% ""), character(1))
  )
  expect_equal(responsables[["1"]], "Ana Kobo")
  expect_equal(responsables[["2"]], "Bruno Kobo")
  expect_equal(responsables[["3"]], "-")
  expect_equal(responsables[["4"]], "Diego Kobo")
  labels <- stats::setNames(
    vapply(payload$blocks, function(block) as.character(block$last_response_date_label %||% ""), character(1)),
    vapply(payload$blocks, function(block) as.character(block$ump %||% ""), character(1))
  )
  expect_equal(labels[["1"]], "Fecha hoy 3:34pm")
})

test_that("monitoreo territorial cuenta encuesta valida solo por filtro de fuente", {
  data <- data.frame(
    `Core/M5_district` = c("sjm", "sjm", "sjm", "sjm"),
    `_geolocation` = c("", "", "", ""),
    consent = c("0", "0", "0", "0"),
    `Core/E1_age` = c(16, 17, 15, 12),
    `_status` = rep("rechazada", 4),
    `_uuid` = c("a", "b", "c", "d"),
    filtro_fuente = c("apto", "no_apto", "", "apto"),
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial", status = "active"),
    territorial = list(platform_effective_var = "filtro_fuente", platform_effective_values = list("apto"))
  ), data)
  report <- monitoreo_territorial_reportes(data, cfg, list(phase = "pilot"))
  expect_equal(report$source_validity$field, "filtro_fuente")
  expect_equal(report$source_validity$effective_count, 2L)
  expect_equal(report$source_validity$non_effective_count, 1L)
  expect_equal(report$source_validity$missing_count, 1L)
  expect_equal(report$kpis$validas, 0L)

  pending_cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial", status = "active")
  ), data)
  pending <- monitoreo_territorial_reportes(data, pending_cfg, list(phase = "pilot"))
  expect_true(is.na(pending$source_validity$effective_count))
})

test_that("monitoreo ocurrencias cruza UMP y codigo Pulso desde grupos Kobo", {
  data <- data.frame(
    `_uuid` = c("occ-1", "occ-2", "occ-3"),
    start = c("2026-06-16T20:00:00Z", "2026-06-16T21:00:00Z", "2026-06-17T14:00:00Z"),
    end = c("2026-06-16T20:20:00Z", "2026-06-16T21:15:00Z", "2026-06-17T14:30:00Z"),
    `identificacion_consolidado/codigo_pulso` = c("P001", "P001", "P002"),
    `identificacion_consolidado/ump` = c("7", "7", "8"),
    fase = c("field", "field", "field"),
    `estados/no_queria_participar` = c("1", "2", "0"),
    `estados/hogar_ausente` = c("1", "0", "0"),
    `estados/encuestas_efectivas` = c("3", "2", "4"),
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial", status = "active"),
    territorial = list(
      field_occurrences = list(
        enabled = TRUE,
        asset_uid = "asset_ocurrencias",
        route_phase = "field"
      ),
      enumerator_roster = list(
        enabled = TRUE,
        code_format = "PXXX",
        assignments = list(
          list(codigo_pulso = "P001", nombre = "Ana Campo"),
          list(codigo_pulso = "P002", nombre = "Bruno Campo")
        )
      )
    )
  ), data.frame())
  context <- list(
    phase = "field",
    blocks = list(
      list(
        id_manzana = "150133001001",
        ubigeo = "150133",
        distrito = "SAN JUAN DE MIRAFLORES",
        zona = "001",
        manzana = "001",
        hoja_num = 7,
        orden_seleccion = 7,
        entrevistas = 4
      ),
      list(
        id_manzana = "150103002002",
        ubigeo = "150103",
        distrito = "ATE",
        zona = "002",
        manzana = "002",
        hoja_num = 8,
        orden_seleccion = 8,
        entrevistas = 4
      ),
      list(
        id_manzana = "150103002003",
        ubigeo = "150103",
        distrito = "ATE",
        zona = "002",
        manzana = "003",
        hoja_num = 9,
        orden_seleccion = 9,
        entrevistas = 4
      )
    )
  )

  report <- monitoreo_territorial_occurrences_report(data, cfg, context)

  expect_equal(report$summary$total_records, 3L)
  expect_equal(report$summary$responsables, 2L)
  expect_equal(report$summary$manzanas_reportadas, 2L)
  expect_equal(report$summary$efectivas, 9L)
  expect_equal(report$summary$no_efectivas, 4L)
  expect_equal(report$summary$intentos, 13L)
  expect_equal(report$records[[1]]$responsable, "Ana Campo")
  expect_equal(report$records[[1]]$ump, "7")
  expect_equal(report$records[[1]]$manzana, "001")
  expect_equal(report$records[[1]]$manzana_key, "m0001")
  expect_equal(length(report$alerts$outside_route), 0L)
  expect_equal(length(report$by_ump), 3L)
  expect_equal(report$by_ump[[1]]$ump, "7")
  expect_equal(report$by_ump[[1]]$manzana, "001")
  expect_equal(report$by_ump[[1]]$responsable, "Ana Campo")
  expect_true(report$by_ump[[1]]$has_report)
  expect_equal(report$by_ump[[1]]$estado_consolidado, "reportada_no_efectiva")
  expect_equal(report$by_ump[[1]]$motivo_principal, "No quería participar")
  expect_equal(report$by_ump[[1]]$reportes, 2L)
  expect_equal(report$by_ump[[1]]$efectivas, 5L)
  expect_equal(report$by_ump[[1]]$no_efectivas, 4L)
  expect_equal(report$by_ump[[1]]$intentos, 9L)
  by_ump <- stats::setNames(report$by_ump, vapply(report$by_ump, function(item) as.character(item$ump %||% ""), character(1)))
  expect_equal(by_ump[["8"]]$responsable, "Bruno Campo")
  expect_true(by_ump[["8"]]$has_report)
  expect_equal(by_ump[["8"]]$estado_consolidado, "reportada_efectiva")
  expect_false(by_ump[["9"]]$has_report)
  expect_equal(by_ump[["9"]]$estado_consolidado, "sin_reporte")
  ump_outcomes <- stats::setNames(
    vapply(report$by_ump[[1]]$outcomes, function(item) as.integer(item$total %||% 0L), integer(1)),
    vapply(report$by_ump[[1]]$outcomes, function(item) as.character(item$key %||% ""), character(1))
  )
  expect_equal(ump_outcomes[["no_queria_participar"]], 3L)
  expect_equal(ump_outcomes[["hogar_ausente"]], 1L)
  by_district <- stats::setNames(report$by_district, vapply(report$by_district, function(item) as.character(item$distrito %||% ""), character(1)))
  expect_equal(by_district[["SAN JUAN DE MIRAFLORES"]]$ump_reportadas, 1L)
  expect_equal(by_district[["SAN JUAN DE MIRAFLORES"]]$ump_sin_reporte, 0L)
  expect_equal(by_district[["SAN JUAN DE MIRAFLORES"]]$motivo_principal, "No quería participar")
  expect_equal(by_district[["ATE"]]$ump_reportadas, 1L)
  expect_equal(by_district[["ATE"]]$ump_sin_reporte, 1L)
  expect_equal(by_district[["ATE"]]$efectivas, 4L)

  published <- .monitoreo_publication_occurrences_df(list(field_occurrences = report), "internal")
  published_text <- paste(unlist(published, use.names = FALSE), collapse = "\n")
  expect_true(any(published$Bloque == "Resumen de ocurrencias", na.rm = TRUE))
  expect_true(any(published$Bloque == "Estado por UMP", na.rm = TRUE))
  expect_true(any(published$Bloque == "Ranking por categoría", na.rm = TRUE))
  expect_true(any(published$Bloque == "Qué se reporta cada día", na.rm = TRUE))
  expect_true(any(published$Bloque == "Reportes por distrito y día", na.rm = TRUE))
  expect_true(any(published$Bloque == "Resumen por distrito", na.rm = TRUE))
  expect_true(grepl("No quería participar", published_text, fixed = TRUE))
  expect_true(grepl("Reportada no efectiva", published_text, fixed = TRUE))
  expect_true(grepl("SAN JUAN DE MIRAFLORES", published_text, fixed = TRUE))
  summary_rows <- published[published$Bloque == "Resumen de ocurrencias", , drop = FALSE]
  report_row <- summary_rows[summary_rows$Indicador == "Reportes", , drop = FALSE]
  expect_equal(suppressWarnings(as.numeric(report_row$Valor[[1]])), 3)

  section_model <- list(ocurrencias_campo = .monitoreo_publication_section("ocurrencias_campo", "Ocurrencias de campo", published))
  sheet_rows <- .monitoreo_publication_territorial_internal_sheet_rows(section_model, "ocurrencias_campo")
  sheet_text <- paste(unlist(sheet_rows, use.names = FALSE), collapse = "\n")
  expect_true(grepl("ESTADO POR UMP", sheet_text, fixed = TRUE))
  expect_true(grepl("RITMO DIARIO DE OCURRENCIAS", sheet_text, fixed = TRUE))
  expect_true(grepl("RANKING POR CATEGORÍA", sheet_text, fixed = TRUE))
  expect_true(grepl("QUÉ SE REPORTA CADA DÍA", sheet_text, fixed = TRUE))
  expect_true(grepl("REPORTES POR DISTRITO Y DÍA", sheet_text, fixed = TRUE))
})

test_that("monitoreo ocurrencias advierte UMP no esperada sin inferir distrito", {
  data <- data.frame(
    `_uuid` = "occ-typo",
    start = "2026-06-16T20:00:00Z",
    end = "2026-06-16T20:20:00Z",
    `identificacion_consolidado/codigo_pulso` = "P001",
    `identificacion_consolidado/ump` = "1437",
    fase = "field",
    `estados/no_queria_participar` = "2",
    `estados/hogar_ausente` = "1",
    `estados/encuestas_efectivas` = "5",
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial", status = "active"),
    territorial = list(
      field_occurrences = list(enabled = TRUE, route_phase = "field"),
      enumerator_roster = list(
        enabled = TRUE,
        code_format = "PXXX",
        assignments = list(list(codigo_pulso = "P001", nombre = "Ana Campo"))
      )
    )
  ), data.frame())
  context <- list(
    phase = "field",
    blocks = list(
      list(
        id_manzana = "150135063000590",
        ubigeo = "150135",
        distrito = "SAN MARTIN DE PORRES",
        zona = "063",
        manzana = "0590",
        hoja_num = 143,
        orden_seleccion = 143,
        entrevistas = 8
      )
    )
  )

  report <- monitoreo_territorial_occurrences_report(data, cfg, context)
  by_ump <- stats::setNames(report$by_ump, vapply(report$by_ump, function(item) as.character(item$ump %||% ""), character(1)))
  invalid <- by_ump[["1437"]]
  expect_equal(invalid$estado_consolidado, "revisar_cruce")
  expect_equal(invalid$distrito, "")
  expect_equal(invalid$route_match_status, "ump_no_esperada")
  expect_match(invalid$route_label, "no está en las UMP esperadas")
  expect_equal(by_ump[["143"]]$estado_consolidado, "sin_reporte")

  by_district <- stats::setNames(report$by_district, vapply(report$by_district, function(item) as.character(item$distrito %||% ""), character(1)))
  expect_true("Sin cruce UMP" %in% names(by_district))
  expect_equal(by_district[["Sin cruce UMP"]]$ump_reportadas, 1L)
  expect_equal(by_district[["SAN MARTIN DE PORRES"]]$ump_sin_reporte, 1L)
  outside_umps <- vapply(report$alerts$outside_route, function(item) as.character(item$ump %||% ""), character(1))
  expect_true("1437" %in% outside_umps)
})

test_that("monitoreo ocurrencias XLSForm usa selector de UMP esperadas", {
  testthat::skip_if_not_installed("readxl")
  path <- tempfile(fileext = ".xlsx")
  context <- list(
    phase = "field",
    blocks = list(
      list(
        id_manzana = "150133001001",
        ubigeo = "150133",
        distrito = "SAN JUAN DE MIRAFLORES",
        zona = "001",
        manzana = "001",
        hoja_num = 7,
        orden_seleccion = 7,
        entrevistas = 4
      ),
      list(
        id_manzana = "150103002002",
        ubigeo = "150103",
        distrito = "ATE",
        zona = "002",
        manzana = "002",
        hoja_num = 8,
        orden_seleccion = 8,
        entrevistas = 4
      )
    )
  )

  monitoreo_territorial_occurrences_xlsform(
    context,
    path,
    enumerator_roster = list(assignments = list(list(codigo_pulso = "P001", nombre = "Ana Campo")))
  )
  survey <- as.data.frame(readxl::read_excel(path, sheet = "survey"), stringsAsFactors = FALSE)
  choices <- as.data.frame(readxl::read_excel(path, sheet = "choices"), stringsAsFactors = FALSE)
  ump_row <- survey[survey$name == "ump", , drop = FALSE]

  expect_equal(ump_row$type[[1]], "select_one ump")
  expect_equal(ump_row$name[[1]], "ump")
  expect_true(any(choices$list_name == "ump"))
  ump_choice_names <- as.character(choices$name[choices$list_name == "ump"])
  expect_true(all(c("7", "8") %in% ump_choice_names))
  expect_false("1437" %in% ump_choice_names)
})

test_that("monitoreo ocurrencias reconoce schema Kobo con campos dentro de grupos", {
  schema <- list(all_fields = list(
    list(name = "identificacion_consolidado/codigo_pulso", xpath = "", type = "select_one codigo_pulso"),
    list(name = "identificacion_consolidado/ump", xpath = "", type = "integer"),
    list(name = "start", xpath = "/ocurrencias_trabajo_campo/start", type = "start"),
    list(name = "end", xpath = "/ocurrencias_trabajo_campo/end", type = "end"),
    list(name = "estados/no_queria_participar", xpath = "", type = "integer"),
    list(name = "estados/vivienda_abandonada_inaccesible", xpath = "", type = "integer"),
    list(name = "estados/hogar_migrante_refugiado", xpath = "", type = "integer"),
    list(name = "estados/hogar_ausente", xpath = "", type = "integer"),
    list(name = "estados/no_cumple_criterios", xpath = "", type = "integer"),
    list(name = "estados/fuera_cuota", xpath = "", type = "integer"),
    list(name = "estados/encuesta_inconclusa", xpath = "", type = "integer"),
    list(name = "estados/encuestas_efectivas", xpath = "", type = "integer")
  ))

  check <- .monitoreo_territorial_occurrences_schema_check(schema)

  expect_true(check$ok)
  expect_equal(check$status, "ready")
  found <- stats::setNames(
    vapply(check$items, function(item) as.character(item$found_name %||% ""), character(1)),
    vapply(check$items, function(item) as.character(item$key %||% ""), character(1))
  )
  expect_equal(found[["codigo_pulso"]], "identificacion_consolidado/codigo_pulso")
  expect_equal(found[["ump"]], "identificacion_consolidado/ump")
  expect_equal(found[["encuestas_efectivas"]], "estados/encuestas_efectivas")
  expected <- stats::setNames(
    lapply(check$items, function(item) unlist(item$expected %||% list(), use.names = FALSE)),
    vapply(check$items, function(item) as.character(item$key %||% ""), character(1))
  )
  expect_equal(expected[["codigo_pulso"]][[1]], "identificacion_consolidado/codigo_pulso")
  expect_equal(expected[["ump"]][[1]], "identificacion_consolidado/ump")
  expect_equal(expected[["encuestas_efectivas"]][[1]], "estados/encuestas_efectivas")
})

test_that("monitoreo territorial cruza codigo Pulso de respuestas con encuestadores", {
  data <- data.frame(
    `Core/M5_district` = c("sjm", "sjm", "sjm", "sjm"),
    `Core/M8_ump` = c("m1", "m1", "m2", "m2"),
    `_geolocation` = c("-12.1 -77.0", "-12.1 -77.0", "-12.1 -77.0", "-12.1 -77.0"),
    codigo_encuestador = c("P001", "P002", "P999", ""),
    filtro_fuente = c("apto", "apto", "no_apto", "apto"),
    `_status` = rep("submitted_via_web", 4),
    `_uuid` = c("a", "b", "c", "d"),
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial", status = "active"),
    territorial = list(
      pulso_code_var = "codigo_encuestador",
      platform_effective_var = "filtro_fuente",
      platform_effective_values = list("apto"),
      enumerator_roster = list(
        enabled = TRUE,
        code_format = "PXXX",
        assignments = list(
          list(codigo_pulso = "P001", nombre = "Ana Campo"),
          list(codigo_pulso = "P002", nombre = "Luis Ruta")
        )
      )
    )
  ), data)
  report <- monitoreo_territorial_reportes(data, cfg, list(phase = "field"))

  expect_equal(report$source_validity$effective_count, 3L)
  expect_equal(report$source_validity$non_effective_count, 1L)
  expect_equal(report$enumerator_code_summary$recognized_code_count, 2L)
  expect_equal(report$enumerator_code_summary$unrecognized_code_count, 1L)
  expect_equal(report$enumerator_code_summary$missing_response_count, 1L)
  expect_equal(report$response_audit[[1]]$pulso_code, "P001")
  expect_equal(report$response_audit[[1]]$enumerator_assigned, "Ana Campo")
  expect_true(isTRUE(report$response_audit[[1]]$source_effective))
})

test_that("monitoreo territorial usa hoja de ruta operativa como diagnostico sin contarla como respuesta", {
  responses <- data.frame(
    `Core/M5_district` = "ate",
    `Core/M8_ump` = "2",
    codigo_pulso = "P002",
    `_geolocation` = "",
    consent = "1",
    `Core/E1_age` = 30,
    `_status` = "submitted_via_web",
    `_uuid` = "r-bob",
    `_submitted_by` = "bob",
    .source_id = "kobo-field",
    .source_kind = "kobo",
    .source_label = "Kobo campo",
    .source_role = "respuestas",
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  route_sheet <- data.frame(
    Ruta = c("R1", "R2"),
    Distrito = c("ATE", "ATE"),
    Zona = c("04200", "04200"),
    Manzana = c("001", "002"),
    `Codigo manzana` = c("150103042001", "150103042002"),
    Tipo = c("Titular", "Titular"),
    `Reemplaza a` = c("", ""),
    `Rango encuestas` = c("1-8", "9-16"),
    Encuestas = c(8, 8),
    UMP = c("1", "2"),
    Encuestador = c("Ana", "Bob"),
    `Fecha de Salida ` = c("", ""),
    `Fecha de entrega  ` = c("", ""),
    Estado = c("Pendiente", "Pendiente"),
    `Encuesta 1` = c("", ""),
    .source_id = "sheet-route",
    .source_kind = "google_sheets",
    .source_label = "Hoja de ruta operativa",
    .source_role = "hoja_ruta",
    dim_territorial_phase = "field",
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  data <- .monitoreo_bind_rows(list(responses, route_sheet))
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial", status = "active"),
    territorial = list(
      active_route_phase = "field",
      enumerator_roster = list(
        enabled = TRUE,
        code_format = "PXXX",
        assignments = list(
          list(codigo_pulso = "P001", nombre = "Ana"),
          list(codigo_pulso = "P002", nombre = "Bob")
        )
      )
    )
  ), responses)
  context <- list(
    phase = "field",
    blocks = list(
      list(id_manzana = "150103042001", ubigeo = "150103", distrito = "ATE", zona = "04200", manzana = "001", entrevistas = 8, hoja_num = 1),
      list(id_manzana = "150103042002", ubigeo = "150103", distrito = "ATE", zona = "04200", manzana = "002", entrevistas = 8, hoja_num = 2)
    )
  )

  report <- monitoreo_territorial_reportes(data, cfg, context)

  expect_equal(report$kpis$total_respuestas, 1L)
  expect_true(report$route_sheet$connected)
  expect_true(report$route_sheet$headers_ok)
  expect_equal(report$route_sheet$metrics$assignments, 2L)
  expect_equal(report$route_sheet$metrics$assigned_without_response, 1L)
  progress <- .monitoreo_territorial_rows_df(report$route_sheet$assignment_progress)
  expect_equal(progress$no_response[progress$encuestador == "Ana"], 1L)
  expect_equal(progress$started[progress$encuestador == "Bob"], 1L)
  expect_equal(length(report$internal_queries$route_sheet_assigned_no_response), 1L)
})

test_that("monitoreo territorial sugiere reconciliar UMP y Codigo Pulso desde hoja de ruta", {
  responses <- data.frame(
    `Core/M5_district` = c("ate", "ate"),
    `Core/M8_ump` = c("99", "2"),
    codigo_pulso = c("P001", "P001"),
    `_geolocation` = c("", ""),
    consent = c("1", "1"),
    `Core/E1_age` = c(30, 31),
    `_status` = c("submitted_via_web", "submitted_via_web"),
    `_uuid` = c("r-wrong-ump", "r-wrong-code"),
    `_submitted_by` = c("ana", "ana"),
    .source_id = "kobo-field",
    .source_kind = "kobo",
    .source_label = "Kobo campo",
    .source_role = "respuestas",
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  route_sheet <- data.frame(
    Ruta = c("R1", "R2"),
    Distrito = c("ATE", "ATE"),
    Zona = c("04200", "04200"),
    Manzana = c("001", "002"),
    `Codigo manzana` = c("150103042001", "150103042002"),
    Tipo = c("Titular", "Titular"),
    `Reemplaza a` = c("", ""),
    `Rango encuestas` = c("1-8", "9-16"),
    Encuestas = c(8, 8),
    UMP = c("1", "2"),
    Encuestador = c("Ana", "Bob"),
    `Fecha de Salida ` = c("", ""),
    `Fecha de entrega  ` = c("", ""),
    Estado = c("Pendiente", "Pendiente"),
    .source_id = "sheet-route",
    .source_kind = "google_sheets",
    .source_label = "Hoja de ruta operativa",
    .source_role = "hoja_ruta",
    dim_territorial_phase = "field",
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  data <- .monitoreo_bind_rows(list(responses, route_sheet))
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial", status = "active"),
    territorial = list(
      active_route_phase = "field",
      enumerator_roster = list(
        enabled = TRUE,
        code_format = "PXXX",
        assignments = list(
          list(codigo_pulso = "P001", nombre = "Ana"),
          list(codigo_pulso = "P002", nombre = "Bob")
        )
      )
    )
  ), responses)
  context <- list(
    phase = "field",
    blocks = list(
      list(id_manzana = "150103042001", ubigeo = "150103", distrito = "ATE", zona = "04200", manzana = "001", entrevistas = 8, hoja_num = 1),
      list(id_manzana = "150103042002", ubigeo = "150103", distrito = "ATE", zona = "04200", manzana = "002", entrevistas = 8, hoja_num = 2)
    )
  )

  report <- monitoreo_territorial_reportes(data, cfg, context)
  wrong_ump <- report$route_sheet$diagnostics$wrong_ump_candidates
  wrong_code <- report$route_sheet$diagnostics$wrong_code_candidates
  batch <- report$route_sheet$recommendations$batch

  expect_true(any(vapply(wrong_ump, function(item) identical(item$response_id, "r-wrong-ump") && identical(item$assigned_block_id, "150103042001"), logical(1))))
  expect_true(any(vapply(wrong_code, function(item) identical(item$response_id, "r-wrong-code") && identical(item$expected_code, "P002"), logical(1))))
  expect_true(any(vapply(batch, function(item) identical(item$kind, "ump") && identical(item$reconciliation$response_id, "r-wrong-ump"), logical(1))))
  expect_true(any(vapply(batch, function(item) identical(item$kind, "code") && identical(item$reconciliation$response_id, "r-wrong-code"), logical(1))))
})

test_that("monitoreo territorial conserva hoja_ruta al filtrar por fase", {
  data <- data.frame(
    .source_id = c("kobo-field", "sheet-route", "sheet-pilot"),
    .source_role = c("respuestas", "hoja_ruta", "hoja_ruta"),
    dim_territorial_phase = c("field", "field", "pilot"),
    value = c("respuesta", "hoja campo", "hoja piloto"),
    stringsAsFactors = FALSE
  )
  cfg <- list(
    monitoreo_profile = list(family = "territorial"),
    territorial = list(
      active_route_phase = "field",
      phase_sources = list(field = list(source_id = "kobo-field"))
    )
  )

  filtered <- .monitoreo_territorial_filter_data_for_phase(data, cfg, phase = "field")

  expect_equal(filtered$.source_id, c("kobo-field", "sheet-route"))
})

test_that("monitoreo territorial guarda reconciliacion Pulso y UMP por fase", {
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial", status = "active"),
    territorial = list(
      active_route_phase = "field",
      enumerator_roster = list(
        enabled = TRUE,
        code_format = "PXXX",
        assignments = list(list(codigo_pulso = "P191", nombre = "Ana Campo"))
      ),
      enumerator_code_reconciliation = list(
        field = list(list(raw_code = "191", normalized_code = "P191", assigned_code = "P191"))
      ),
      ump_reconciliation = list(
        field = list(list(raw_ump = "UMP 70", assigned_block_id = "mz-70", assigned_ump = "70", scope = "ump_value"))
      )
    )
  ), data.frame())

  expect_equal(cfg$territorial$enumerator_code_reconciliation$field[[1]]$phase, "field")
  expect_equal(cfg$territorial$ump_reconciliation$field[[1]]$phase, "field")
  expect_equal(cfg$territorial$ump_reconciliation$field[[1]]$raw_ump, "UMP 70")
  expect_equal(cfg$territorial$ump_reconciliation$field[[1]]$assigned_block_id, "mz-70")
  expect_equal(length(cfg$territorial$enumerator_code_reconciliation$pilot), 0L)
  expect_equal(length(cfg$territorial$ump_reconciliation$pilot), 0L)
})

test_that("monitoreo territorial aplica lote mixto de reconciliacion en memoria", {
  route_blocks <- data.frame(
    id_manzana = "150117030000290",
    ubigeo = "150117",
    distrito = "LOS OLIVOS",
    zona = "03000",
    manzana = "0290",
    tipo_manzana = "titular",
    hoja_num = 70L,
    orden_seleccion = 70L,
    entrevistas = 8L,
    stringsAsFactors = FALSE
  )
  tcfg <- monitoreo_territorial_normalize_config(list(
    active_route_phase = "field",
    enumerator_roster = list(
      enabled = TRUE,
      code_format = "PXXX",
      assignments = list(list(codigo_pulso = "P191", nombre = "Ana Campo"))
    )
  ), data.frame())
  batch <- .monitoreo_territorial_apply_reconciliation_batch(
    tcfg,
    list(
      list(
        client_id = "code-ok",
        kind = "code",
        reconciliation = list(
          phase = "field",
          scope = "response",
          response_id = "r-1",
          response_id_field = "_uuid",
          raw_code = "191",
          normalized_code = "P191",
          assigned_code = "P191"
        )
      ),
      list(
        client_id = "ump-ok",
        kind = "ump",
        reconciliation = list(
          phase = "field",
          scope = "ump_value",
          raw_ump = "UMP 70",
          assigned_block_id = "150117030000290",
          assigned_ump = "70",
          assigned_district = "LOS OLIVOS",
          assigned_ubigeo = "150117"
        )
      )
    ),
    cfg = list(territorial = tcfg),
    ump_context_builder = function(phase, current_tcfg, current_cfg) {
      list(route_lookup = .monitoreo_territorial_route_ump_lookup(route_blocks))
    }
  )

  expect_equal(vapply(batch$applied, `[[`, character(1), "client_id"), c("code-ok", "ump-ok"))
  expect_equal(batch$changed_phases, "field")
  expect_equal(batch$tcfg$enumerator_code_reconciliation$field[[1]]$assigned_code, "P191")
  expect_equal(batch$tcfg$enumerator_code_reconciliation$field[[1]]$response_id, "r-1")
  expect_equal(batch$tcfg$ump_reconciliation$field[[1]]$raw_ump, "UMP 70")
  expect_equal(batch$tcfg$ump_reconciliation$field[[1]]$assigned_block_id, "150117030000290")
})

test_that("monitoreo territorial lote parcial guarda exitosos y conserva fallos", {
  route_blocks <- data.frame(
    id_manzana = "150117030000290",
    ubigeo = "150117",
    distrito = "LOS OLIVOS",
    zona = "03000",
    manzana = "0290",
    tipo_manzana = "titular",
    hoja_num = 70L,
    orden_seleccion = 70L,
    entrevistas = 8L,
    stringsAsFactors = FALSE
  )
  tcfg <- monitoreo_territorial_normalize_config(list(
    active_route_phase = "field",
    enumerator_roster = list(
      enabled = TRUE,
      code_format = "PXXX",
      assignments = list(list(codigo_pulso = "P191", nombre = "Ana Campo"))
    )
  ), data.frame())
  batch <- .monitoreo_territorial_apply_reconciliation_batch(
    tcfg,
    list(
      list(
        client_id = "code-ok",
        kind = "code",
        reconciliation = list(
          phase = "field",
          scope = "code_legacy",
          raw_code = "191",
          normalized_code = "P191",
          assigned_code = "P191"
        )
      ),
      list(
        client_id = "ump-bad",
        kind = "ump",
        reconciliation = list(
          phase = "field",
          scope = "ump_value",
          raw_ump = "UMP 999",
          assigned_block_id = "no-existe",
          assigned_ump = "999",
          assigned_district = "LOS OLIVOS",
          assigned_ubigeo = "150117"
        )
      )
    ),
    cfg = list(territorial = tcfg),
    ump_context_builder = function(phase, current_tcfg, current_cfg) {
      list(route_lookup = .monitoreo_territorial_route_ump_lookup(route_blocks))
    }
  )

  expect_equal(length(batch$applied), 1L)
  expect_equal(batch$applied[[1]]$client_id, "code-ok")
  expect_equal(length(batch$failed), 1L)
  expect_equal(batch$failed[[1]]$client_id, "ump-bad")
  expect_equal(batch$failed[[1]]$code, "E_TERRITORIAL_UMP_RECONCILE_UNKNOWN_BLOCK")
  expect_equal(batch$tcfg$enumerator_code_reconciliation$field[[1]]$assigned_code, "P191")
  expect_equal(length(batch$tcfg$ump_reconciliation$field), 0L)
})

test_that("monitoreo territorial rechaza lote vacio de reconciliacion", {
  tcfg <- monitoreo_territorial_normalize_config(list(active_route_phase = "field"), data.frame())
  expect_error(
    .monitoreo_territorial_apply_reconciliation_batch(tcfg, list()),
    class = "api_error"
  )
})

test_that("monitoreo territorial reconcilia codigo Pulso por respuesta", {
  data <- data.frame(
    `Core/M5_district` = c("sjl", "smp", "sjl"),
    `closing_group.UMP` = c("150132073000410", "150132073000612", "150132073000410"),
    `_geolocation` = c("-12.1 -77.0", "-12.1 -77.0", "-12.1 -77.0"),
    codigo_encuestador = c("1091", "1091", "P001"),
    filtro_fuente = c("apto", "apto", "apto"),
    `_status` = rep("submitted_via_web", 3),
    `_uuid` = c("r-1", "r-2", "r-3"),
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial", status = "active"),
    territorial = list(
      district_var = "Core/M5_district",
      ump_var = "closing_group/UMP",
      pulso_code_var = "codigo_encuestador",
      platform_effective_var = "filtro_fuente",
      platform_effective_values = list("apto"),
      district_crosswalk = list(
        list(kobo_code = "sjl", kobo_label = "SJL", ubigeo = "150132", distrito = "San Juan de Lurigancho"),
        list(kobo_code = "smp", kobo_label = "SMP", ubigeo = "150135", distrito = "San Martin de Porres")
      ),
      variable_refs = list(
        ump = list(name = "closing_group/UMP", path = "closing_group/UMP")
      ),
      enumerator_roster = list(
        enabled = TRUE,
        code_format = "PXXX",
        assignments = list(
          list(codigo_pulso = "P001", nombre = "Ana Campo"),
          list(codigo_pulso = "P191", nombre = "Henman Riera Antonio Richard")
        )
      ),
      enumerator_code_reconciliation = list(
        field = list(
          list(
            response_id = "r-1",
            response_id_field = "_uuid",
            raw_code = "1091",
            normalized_code = "1091",
            assigned_code = "P191",
            assigned_name = "Henman Riera Antonio Richard",
            ump = "150132073000410",
            district = "San Juan de Lurigancho"
          )
        )
      )
    )
  ), data)
  report <- monitoreo_territorial_reportes(data, cfg, list(phase = "field"))
  rows <- report$enumerator_code_summary$reconciliation_responses
  by_id <- stats::setNames(rows, vapply(rows, function(row) row$response_id, character(1)))

  expect_equal(cfg$territorial$enumerator_code_reconciliation$field[[1]]$phase, "field")
  expect_equal(report$enumerator_code_summary$reconciliation_entries[[1]]$phase, "field")
  expect_equal(length(rows), 2L)
  expect_true(isTRUE(by_id[["r-1"]]$reconciled))
  expect_equal(by_id[["r-1"]]$assigned_code, "P191")
  expect_false(isTRUE(by_id[["r-2"]]$reconciled))
  expect_equal(by_id[["r-2"]]$ump, "150132073000612")
  expect_equal(by_id[["r-2"]]$district, "San Martin de Porres")
  expect_equal(report$enumerator_code_summary$reconciled_response_count, 1L)
  expect_equal(report$enumerator_code_summary$unrecognized_response_count, 1L)
})

test_that("monitoreo territorial reconcilia codigo Pulso mal escrito para todas sus respuestas", {
  data <- data.frame(
    `Core/M5_district` = c("smp", "smp", "sjl"),
    `closing_group.UMP` = c("137", "137", "96"),
    `_geolocation` = c("-12.1 -77.0", "-12.1 -77.0", "-12.2 -77.1"),
    codigo_encuestador = c("1094_630", "1094_630", "P001"),
    filtro_fuente = c("apto", "apto", "apto"),
    `_status` = rep("submitted_via_web", 3),
    `_uuid` = c("r-1", "r-2", "r-3"),
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial", status = "active"),
    territorial = list(
      district_var = "Core/M5_district",
      ump_var = "closing_group/UMP",
      pulso_code_var = "codigo_encuestador",
      platform_effective_var = "filtro_fuente",
      platform_effective_values = list("apto"),
      district_crosswalk = list(
        list(kobo_code = "sjl", kobo_label = "SJL", ubigeo = "150132", distrito = "San Juan de Lurigancho"),
        list(kobo_code = "smp", kobo_label = "SMP", ubigeo = "150135", distrito = "San Martin de Porres")
      ),
      variable_refs = list(
        ump = list(name = "closing_group/UMP", path = "closing_group/UMP")
      ),
      enumerator_roster = list(
        enabled = TRUE,
        code_format = "PXXX",
        assignments = list(
          list(codigo_pulso = "P001", nombre = "Ana Campo"),
          list(codigo_pulso = "P630", nombre = "Responsable corregido")
        )
      ),
      enumerator_code_reconciliation = list(
        field = list(
          list(
            raw_code = "1094_630",
            normalized_code = "1094630",
            assigned_code = "P630",
            assigned_name = "Responsable corregido",
            scope = "code_legacy"
          )
        )
      )
    )
  ), data)
  report <- monitoreo_territorial_reportes(data, cfg, list(phase = "field"))
  rows <- report$enumerator_code_summary$reconciliation_responses
  by_id <- stats::setNames(rows, vapply(rows, function(row) row$response_id, character(1)))

  expect_equal(length(rows), 2L)
  expect_true(isTRUE(by_id[["r-1"]]$reconciled))
  expect_true(isTRUE(by_id[["r-2"]]$reconciled))
  expect_equal(by_id[["r-1"]]$assigned_code, "P630")
  expect_equal(by_id[["r-2"]]$assigned_name, "Responsable corregido")
  expect_equal(report$enumerator_code_summary$reconciled_response_count, 2L)
  expect_equal(report$enumerator_code_summary$unrecognized_response_count, 0L)
})

test_that("monitoreo territorial resuelve path guardado de codigo Pulso contra snapshot local", {
  data <- data.frame(
    `Core.M5_district` = c("sjm", "sjm", "sjm"),
    `Core.M8_ump` = c("m1", "m1", "m2"),
    `_geolocation` = c("-12.1 -77.0", "-12.1 -77.0", "-12.1 -77.0"),
    `closing_group.code_pulso` = c("1", "052", "P999"),
    `closing_group.efectiva` = c("1", "0", "1"),
    `_status` = rep("submitted_via_web", 3),
    `_uuid` = c("a", "b", "c"),
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial", status = "active"),
    territorial = list(
      district_var = "Core/M5_district",
      ump_var = "Core/M8_ump",
      gps_var = "_geolocation",
      pulso_code_var = "closing_group/code_pulso",
      platform_effective_var = "closing_group/efectiva",
      platform_effective_values = list("1"),
      variable_refs = list(
        enumerator_pulso_code = list(
          name = "closing_group/code_pulso",
          original_name = "code_pulso",
          path = "closing_group/code_pulso",
          label = "Codigo PULSO",
          type = "text",
          group = "closing_group"
        ),
        valid_filter_question = list(
          name = "closing_group/efectiva",
          path = "closing_group/efectiva",
          label = "Encuesta efectiva",
          type = "select_one",
          group = "closing_group"
        )
      ),
      enumerator_roster = list(
        enabled = TRUE,
        code_format = "PXXX",
        assignments = list(
          list(codigo_pulso = "P001", nombre = "Ana Campo"),
          list(codigo_pulso = "P052", nombre = "Luis Ruta")
        )
      )
    )
  ), data)
  report <- monitoreo_territorial_reportes(data, cfg, list(phase = "field"))

  expect_equal(cfg$territorial$pulso_code_var, "closing_group.code_pulso")
  expect_equal(report$enumerator_code_summary$field, "closing_group.code_pulso")
  expect_equal(report$enumerator_code_summary$field_resolved, "closing_group.code_pulso")
  expect_equal(report$source_validity$field_resolved, "closing_group.efectiva")
  expect_equal(report$source_validity$effective_count, 2L)
  expect_equal(report$enumerator_code_summary$recognized_code_count, 2L)
  expect_equal(report$enumerator_code_summary$unrecognized_code_count, 1L)
  expect_equal(report$response_audit[[1]]$pulso_code, "P001")
  expect_equal(report$response_audit[[2]]$pulso_code, "P052")
  expect_equal(report$response_audit[[2]]$enumerator_assigned, "Luis Ruta")

  legacy_cfg <- cfg
  legacy_cfg$territorial$pulso_code_var <- "codigo_pulso"
  legacy_cfg$territorial$variable_refs$enumerator_pulso_code <- NULL
  legacy_cfg <- monitoreo_normalize_config(legacy_cfg, data)
  legacy_report <- monitoreo_territorial_reportes(data, legacy_cfg, list(phase = "field"))

  expect_equal(legacy_cfg$territorial$pulso_code_var, "closing_group.code_pulso")
  expect_equal(legacy_report$enumerator_code_summary$field_resolved, "closing_group.code_pulso")
  expect_equal(legacy_report$enumerator_code_summary$recognized_code_count, 2L)
  expect_equal(legacy_report$enumerator_code_summary$unrecognized_code_count, 1L)
})

test_that("monitoreo territorial separa avance operativo de observaciones GPS y tiempo", {
  data <- data.frame(
    `Core/M5_district` = c("sjm", "sjm", "sjm"),
    `_geolocation` = c("", "-12.2 -77.2", "-12.1 -77.0"),
    consent = c("1", "1", "1"),
    `Core/E1_age` = c(25, 30, 35),
    `_status` = rep("submitted_via_web", 3),
    `_uuid` = c("sin-gps", "gps-lejos", "tiempo-corto"),
    `_submitted_by` = c("enc1", "enc1", "enc2"),
    start = rep("2026-06-01T10:00:00Z", 3),
    end = c("2026-06-01T10:10:00Z", "2026-06-01T10:12:00Z", "2026-06-01T10:03:00Z"),
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(monitoreo_profile = list(family = "territorial", status = "active")), data)
  context <- list(
    phase = "pilot",
    blocks = list(list(id_manzana = "150133001001", ubigeo = "150133", distrito = "SAN JUAN DE MIRAFLORES", zona = "001", manzana = "001", entrevistas = 3)),
    geo_results = data.frame(
      lat = c(NA, -12.2, -12.1),
      lon = c(NA, -77.2, -77.0),
      gps_parseable = c(FALSE, TRUE, TRUE),
      geo_estado = c("geo_sin_gps", "geo_no_defendible", "geo_ok"),
      distance_m = c(NA, 650, 0),
      nearest_block_id = rep("150133001001", 3),
      nearest_block_type = rep("titular", 3),
      geometry_match = c("sin_gps", "far_gt_300m", "inside_selected_block"),
      stringsAsFactors = FALSE
    )
  )
  report <- monitoreo_territorial_reportes(data, cfg, context)
  expect_equal(report$advance$validas, 3L)
  expect_equal(report$advance$observacion, 3L)
  expect_equal(report$advance$no_validas, 0L)
  expect_equal(report$advance$avance_pct, 100)
  expect_equal(report$kpis$revision, 3L)
  expect_true(all(vapply(report$response_audit, `[[`, character(1), "observation_status") == "en_observacion"))
  audit <- .monitoreo_territorial_rows_df(report$response_audit)
  expect_equal(audit$duration_status[audit$response_id == "tiempo-corto"], "corta")
  expect_equal(audit$duration_operational_status[audit$response_id == "tiempo-corto"], "corto")
  expect_equal(audit$duration_operational_label[audit$response_id == "tiempo-corto"], "Corto")
  duration_review <- .monitoreo_territorial_rows_df(report$internal_queries$duration_review)
  expect_equal(duration_review$response_id, "tiempo-corto")
})

test_that("monitoreo territorial normaliza tiempo visible a tres estados operativos", {
  raw <- c("muy_corta", "muy_corto", "corta", "corto", "esperada", "larga", "extrema", "sin_dato", "", "malformado")
  expect_equal(
    .monitoreo_territorial_duration_operational_status(raw),
    c("muy_corto", "muy_corto", "corto", "corto", "normal", "normal", "normal", "normal", "normal", "normal")
  )
  expect_equal(
    .monitoreo_territorial_duration_operational_label(raw),
    c("Muy corto", "Muy corto", "Corto", "Corto", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal")
  )
})

test_that("monitoreo territorial visto bueno aprueba observacion sin cambiar avance", {
  data <- data.frame(
    `Core/M5_district` = c("sjm", "sjm"),
    `_geolocation` = c("-12.2 -77.2", "-12.1 -77.0"),
    consent = c("1", "1"),
    `Core/E1_age` = c(25, 30),
    `_status` = rep("submitted_via_web", 2),
    `_uuid` = c("gps-lejos", "tiempo-largo"),
    `_submitted_by` = c("enc1", "enc2"),
    start = rep("2026-06-01T10:00:00Z", 2),
    end = c("2026-06-01T10:12:00Z", "2026-06-01T13:00:00Z"),
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "territorial", status = "active"),
    territorial = list(
      validation_decisions = list(
        approved_response_ids = list("gps-lejos"),
        approval_reasons = list(`gps-lejos` = "geolocalizacion"),
        approved_at = list(`gps-lejos` = "2026-06-02T00:00:00Z")
      )
    )
  ), data)
  context <- list(
    phase = "pilot",
    blocks = list(list(id_manzana = "150133001001", ubigeo = "150133", distrito = "SAN JUAN DE MIRAFLORES", zona = "001", manzana = "001", entrevistas = 2)),
    geo_results = data.frame(
      lat = c(-12.2, -12.1),
      lon = c(-77.2, -77.0),
      gps_parseable = c(TRUE, TRUE),
      geo_estado = c("geo_no_defendible", "geo_ok"),
      distance_m = c(650, 0),
      nearest_block_id = rep("150133001001", 2),
      nearest_block_type = rep("titular", 2),
      geometry_match = c("far_gt_300m", "inside_selected_block"),
      stringsAsFactors = FALSE
    )
  )
  report <- monitoreo_territorial_reportes(data, cfg, context)
  audit <- .monitoreo_territorial_rows_df(report$response_audit)
  approved <- audit[audit$response_id == "gps-lejos", , drop = FALSE]
  expect_equal(report$advance$validas, 2L)
  expect_equal(report$advance$observacion, 0L)
  expect_equal(report$advance$observacion_aprobada, 1L)
  expect_equal(approved$observation_status[[1]], "aprobada")
  expect_equal(approved$validation_decision[[1]], "visto_bueno")
  expect_equal(approved$validation_status[[1]], "validada")
  expect_equal(audit$observation_status[audit$response_id == "tiempo-largo"], "sin_observacion")
  expect_equal(audit$duration_status[audit$response_id == "tiempo-largo"], "larga")
  expect_equal(audit$duration_operational_label[audit$response_id == "tiempo-largo"], "Normal")
  expect_equal(length(report$internal_queries$duration_review), 0L)
  review_reasons <- vapply(report$internal_queries$review_cases %||% list(), function(item) as.character(item$reason %||% ""), character(1))
  expect_false(any(review_reasons == "duracion_larga"))
})

test_that("monitoreo territorial cambia KPIs al alternar piloto y campo", {
  data <- data.frame(
    `Core/M5_district` = "sjm",
    `_geolocation` = "-12.1 -77.0",
    consent = "1",
    `Core/E1_age` = 25,
    `_status` = "submitted_via_web",
    `_uuid` = "a",
    `_submitted_by` = "enc",
    start = "2026-06-01T10:00:00Z",
    end = "2026-06-01T10:10:00Z",
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(monitoreo_profile = list(family = "territorial", status = "active")), data)
  geo_results <- data.frame(
    lat = -12.1,
    lon = -77,
    gps_parseable = TRUE,
    geo_estado = "geo_ok",
    distance_m = 0,
    nearest_block_id = "150133001001",
    nearest_block_type = "titular",
    geometry_match = "inside_selected_block",
    stringsAsFactors = FALSE
  )
  pilot <- monitoreo_territorial_reportes(data, cfg, list(
    phase = "pilot",
    blocks = list(list(id_manzana = "150133001001", ubigeo = "150133", distrito = "SAN JUAN DE MIRAFLORES", zona = "001", manzana = "001", entrevistas = 30)),
    geo_results = geo_results
  ))
  field <- monitoreo_territorial_reportes(data, cfg, list(
    phase = "field",
    blocks = list(list(id_manzana = "150133001001", ubigeo = "150133", distrito = "SAN JUAN DE MIRAFLORES", zona = "001", manzana = "001", entrevistas = 1200)),
    geo_results = geo_results
  ))
  expect_equal(pilot$kpis$meta, 30L)
  expect_equal(field$kpis$meta, 1200L)
  expect_gt(pilot$kpis$avance_pct, field$kpis$avance_pct)
})

test_that("monitoreo territorial expone payload operativo de Hojas de Ruta", {
  data <- data.frame(
    `Core/M5_district` = c("ate", "ate", "chorrillos"),
    `Core/M8_ump` = c("1", "1", "2"),
    `_geolocation` = c("", "", ""),
    consent = c("1", "1", "1"),
    `Core/E1_age` = c(25, 32, 40),
    sexo = c("Hombre", "Mujer", "Hombre"),
    `_status` = rep("submitted_via_web", 3),
    `_uuid` = c("a", "b", "c"),
    `_submitted_by` = c("enc1", "enc2", "enc1"),
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(monitoreo_profile = list(family = "territorial", status = "active")), data)
  cfg$territorial$sex_var <- "sexo"
  cfg$territorial$phase_mappings$pilot$sex_var <- "sexo"
  context <- list(
    phase = "pilot",
    config = list(
      age_range_mode = "manual",
      entrevistas_por_manzana = 5,
      age_ranges = list(
        list(id = "18_29", label = "18-29", min = 18L, max = 29L),
        list(id = "30_44", label = "30-44", min = 30L, max = 44L),
        list(id = "45_59", label = "45-59", min = 45L, max = 59L),
        list(id = "60_plus", label = "60+", min = 60L, max = NA_integer_)
      )
    ),
    blocks = list(
      list(id_manzana = "150103042001", ubigeo = "150103", distrito = "ATE", zona = "04200", manzana = "001", entrevistas = 5, viviendas = 80, poblacion = 250, territorio_muestral = "150103-04200", hoja_num = 1, rango_inicio = 1, rango_fin = 5, pob_18_24_h = 90, pob_18_24_m = 70, pob_25_34_h = 12, pob_25_34_m = 8, pob_35_44_h = 8, pob_35_44_m = 6, pob_45_54_h = 4, pob_45_54_m = 2, pob_55_64_h = 1, pob_55_64_m = 1, pob_65_plus_h = 1, pob_65_plus_m = 1),
      list(id_manzana = "150108012001", ubigeo = "150108", distrito = "CHORRILLOS", zona = "01200", manzana = "001", entrevistas = 5, viviendas = 40, poblacion = 120, territorio_muestral = "150108-01200", hoja_num = 2, rango_inicio = 6, rango_fin = 10, pob_18_24_h = 12, pob_18_24_m = 8, pob_25_34_h = 25, pob_25_34_m = 20, pob_35_44_h = 15, pob_35_44_m = 12, pob_45_54_h = 8, pob_45_54_m = 6, pob_55_64_h = 4, pob_55_64_m = 4, pob_65_plus_h = 3, pob_65_plus_m = 3)
    ),
    replacement_blocks = list(
      list(id_manzana = "150103042002", ubigeo = "150103", distrito = "ATE", zona = "04200", manzana = "002", entrevistas = 5, tipo_manzana = "reemplazo", titular_id_manzana = "150103042001", replacement_order = 1)
    ),
    population = list(cells = list(
      list(ubigeo = "150103", territorio = "150103-04200", rango_edad = "18-29", sexo = "Hombre", poblacion = 90),
      list(ubigeo = "150103", territorio = "150103-04200", rango_edad = "18-29", sexo = "Mujer", poblacion = 95)
    )),
    quota = list(cells = list(
      list(ubigeo = "150103", territorio = "150103-04200", rango_edad = "18-29", sexo = "Hombre", cuota = 2),
      list(ubigeo = "150103", territorio = "150103-04200", rango_edad = "18-29", sexo = "Mujer", cuota = 3)
    ))
  )
  report <- monitoreo_territorial_reportes(data, cfg, context)

  expect_equal(report$route_overview$route_count, 2L)
  expect_equal(report$route_overview$replacement_count, 1L)
  expect_equal(report$responsible_summary$distinct_count, 2L)
  expect_equal(length(report$route_blocks), 3L)
  expect_equal(report$route_blocks[[1]]$viviendas, 80L)
  expect_equal(report$route_blocks[[1]]$rango_inicio, 1L)
  expect_equal(report$route_blocks[[1]]$ump, "1")
  expect_equal(report$route_blocks[[1]]$territorio_muestral, "150103-04200")
  expect_equal(length(report$route_population$cells), 2L)
  expect_equal(length(report$route_quota$cells), 4L)
  quota_cells <- .monitoreo_territorial_rows_df(report$route_quota$cells)
  expect_true(all(c("id_manzana", "cuota") %in% names(quota_cells)))
  expect_equal(sum(as.integer(quota_cells$cuota[quota_cells$id_manzana == "150103042001"]), na.rm = TRUE), 5L)
  expect_equal(sum(as.integer(quota_cells$cuota[quota_cells$id_manzana == "150103042002"]), na.rm = TRUE), 5L)

  validation_report <- monitoreo_territorial_reportes(data, cfg, context, report_scope = "validation_summary")
  expect_true(validation_report$route_quota_progress$configured)
  expect_gt(length(validation_report$route_quota_progress$blocks), 0L)
  expect_equal(validation_report$route_quota$total_rows, 0L)
  expect_equal(length(validation_report$route_quota$cells), 0L)
  expect_true(any(vapply(validation_report$route_quota_progress$blocks, function(block) length(block$sex %||% list()) > 0L, logical(1))))
  expect_true(any(vapply(validation_report$route_quota_progress$blocks, function(block) length(block$age %||% list()) > 0L, logical(1))))
  quota_blocks <- validation_report$route_quota_progress$blocks
  ate_quota <- quota_blocks[[which(vapply(quota_blocks, function(block) identical(block$id_manzana, "150103042001"), logical(1)))[[1]]]]
  sex_achieved <- stats::setNames(
    vapply(ate_quota$sex, function(row) as.integer(row$achieved %||% 0L), integer(1)),
    vapply(ate_quota$sex, function(row) as.character(row$label %||% ""), character(1))
  )
  age_achieved <- stats::setNames(
    vapply(ate_quota$age, function(row) as.integer(row$achieved %||% 0L), integer(1)),
    vapply(ate_quota$age, function(row) as.character(row$label %||% ""), character(1))
  )
  expect_equal(ate_quota$validas, 2L)
  expect_equal(sex_achieved[["Hombre"]], 1L)
  expect_equal(sex_achieved[["Mujer"]], 1L)
  expect_equal(age_achieved[["18-29"]], 1L)
})

test_that("publicacion ejecutiva en Sheets separa hojas y datos por audiencia", {
  demo <- monitoreo_demo_payload(seed = 17L, n = 18L)
  data <- demo$snapshot$data
  data$telefono_contacto <- "PHONE-SHEETS-SENTINEL"
  data$email_contacto <- "sheets-sentinel@example.test"
  data$response_id <- paste0("RID-SHEETS-", seq_len(nrow(data)))

  client_tabs <- monitoreo_publication_sheets_tabs(data, demo$config, audience = "client")
  internal_tabs <- monitoreo_publication_sheets_tabs(data, demo$config, audience = "internal")

  expect_equal(names(client_tabs), c(
    "Portada", "Resumen ejecutivo", "Avance general", "Avance por actor",
    "Avance diario", "Avance por segmento", "Cobertura y pendientes",
    "Fuentes y actualización"
  ))
  expect_equal(names(internal_tabs), c(
    "Portada", "Resumen operativo", "Avance general", "Avance por actor",
    "Avance diario", "Avance por segmento", "Metas internas por actor", "Pendientes por actor",
    "Control de seguimiento", "Fuentes y actualización",
    "Auditoría técnica", "Base técnica"
  ))
  expect_silent(.monitoreo_sheets_validate_controlled_tabs(names(client_tabs)))
  expect_silent(.monitoreo_sheets_validate_controlled_tabs(names(internal_tabs)))

  client_text <- paste(unlist(client_tabs, use.names = FALSE), collapse = " ")
  expect_false(grepl("PHONE-SHEETS-SENTINEL|sheets-sentinel@example\\.test|RID-SHEETS-", client_text))
  expect_false(grepl("Acción sugerida|Recomendación|Comentario operativo|Próximo paso|Diagnóstico|Riesgo", client_text))

  internal_text <- paste(unlist(internal_tabs[["Base técnica"]], use.names = FALSE), collapse = " ")
  expect_true(grepl("PHONE-SHEETS-SENTINEL", internal_text, fixed = TRUE))
  expect_true(grepl("sheets-sentinel@example.test", internal_text, fixed = TRUE))
})

test_that("modelo publicable de Monitoreo arma workbook operacional compartido", {
  data <- data.frame(
    `_id` = c("RAW-ID-1", "RAW-ID-2"),
    `formhub/uuid` = c("UUID-SENTINEL-1", "UUID-SENTINEL-2"),
    start = c("2026-06-18T09:00:00", "malformed-start"),
    end = c("2026-06-18T09:00:30", ""),
    gps_inicio = c("-12.1 -77.1 0 5", "MALFORMED-GPS"),
    `Core/E1_age` = c(35, 42),
    `Core/E2_sex` = c("1", "2"),
    telefono_contacto = c("PHONE-MODEL-SENTINEL", "PHONE-MODEL-SENTINEL-2"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  audit <- data.frame(
    response_id = c("RAW-ID-1", "RAW-ID-2"),
    responsible_display = c("Ana Perez", ""),
    submitted_by = c("Ana Perez", ""),
    pulso_code = c("E001", ""),
    distrito = c("Distrito 1", "Distrito 1"),
    declared_ump_raw = c("UMP-1", ""),
    advance_block_ump = c("UMP-1", ""),
    advance_block_manzana = c("MZ-1", ""),
    advance_block_id = c("MZ-1", ""),
    submission_time = c("2026-06-18T09:00:00-05:00", "2026-06-18T10:15:00-05:00"),
    submission_date = c("18/06/2026", "18/06/2026"),
    submission_hour = c("09:00", "10:15"),
    age = c(35, 42),
    sex = c("1", "2"),
    duration_seconds = c(30, NA_real_),
    duration_status = c("muy_corta", ""),
    advance_valid = c(TRUE, FALSE),
    gps_parseable = c(TRUE, FALSE),
    geo_estado = c("geo_no_defendible", "geo_sin_gps"),
    lat = c(-12.1, NA_real_),
    lon = c(-77.1, NA_real_),
    issues = c("gps_no_defendible", "ump_sin_cruce"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  reports <- list(
    kpis = list(total_respuestas = 2L, validas = 1L, meta = 4L, avance_pct = 25),
    advance = list(district_progress = list(), block_progress = list(), daily = list()),
    route_overview = list(district_count = 1L, operational_block_count = 4L, responsible_count = 1L),
    route_quota_progress = list(blocks = list(
      list(distrito = "Distrito 1", ump = "UMP-1", manzana = "MZ-1", responsable = "Ana Perez", target = 2L, validas = 1L),
      list(distrito = "Distrito 1", ump = "UMP-2", manzana = "MZ-2", responsable = "Luis", target = 1L, validas = 0L),
      list(distrito = "Distrito 1", ump = "UMP-3", manzana = "MZ-3", responsable = "Luis", target = 1L, validas = 8L),
      list(distrito = "Distrito 1", ump = "UMP-4", manzana = "MZ-4", responsable = "Luis", target = 1L, validas = 9L),
      list(distrito = "Distrito 2", ump = "", manzana = "", responsable = "", target = 3L, validas = 0L),
      list(distrito = "Distrito 3", ump = "UMP-5", manzana = "MZ-5", responsable = "-", validas = 0L)
    )),
    response_audit = .monitoreo_df_records(audit),
    map = list(points = .monitoreo_df_records(audit), alerts = list(list(code = "geometry_unresolved", message = "Geometría incompleta"))),
    internal_queries = list(review_cases = list(list(
      reason = "duracion_menor_1_min",
      type = "duration",
      response_id = "RAW-ID-1",
      district = "Distrito 1",
      ump = "UMP-1",
      block_id = "MZ-1",
      responsible = "Ana Perez",
      pulso_code = "E001",
      issues = "duration_review"
    )))
  )
  dashboard <- list(kpis = reports$kpis, territorial_reports = reports)
  cfg <- list(monitoreo_profile = list(family = "territorial"), territorial = list(min_duration_seconds = 60, max_duration_seconds = 7200))

  model <- monitoreo_publication_model(
    data,
    cfg,
    audience = "internal",
    dashboard = dashboard,
    synced_at = "2026-06-18T12:00:00Z",
    context = list(session_id = "sid-test", spreadsheet_id = "sheet-test")
  )
  expect_equal(model$family, "territorial_fieldwork")
  expected_sections <- c(
    "portada", "tabla_maestra", "resumen_operativo", "avance_campo", "encuestadores_rutas", "responsables_rutas", "cuotas_ump",
    "validacion_tiempos", "ocurrencias_campo", "casos_accionables",
    "gps_territorio", "auditoria_tecnica", "base_tecnica"
  )
  expect_true(all(expected_sections %in% names(model)))
  expect_false("llenado_sexo_edad" %in% names(model))

  tabs <- monitoreo_publication_sheets_tabs(
    data,
    cfg,
    audience = "internal",
    dashboard = dashboard,
    synced_at = "2026-06-18T12:00:00Z",
    context = list(session_id = "sid-test", spreadsheet_id = "sheet-test")
  )
  expect_equal(names(tabs), c(
    "Portada", "Tabla maestra", "Resumen territorial", "Ritmo diario", "Manzanas y responsables", "Responsables y rutas", "Cuotas sexo y edad",
    "Validación de tiempos", "Ocurrencias de campo",
    "GPS y territorio", "Auditoría técnica", "Base técnica"
  ))
  expect_false(any(startsWith(names(tabs), "Interno - ")))
  master <- .monitoreo_publication_section_frame(model, "tabla_maestra")
  expect_equal(names(master), c(
    "Fecha", "Hora", "UMP", "Manzana", "Distrito", "Encuestador",
    "Sexo", "Edad", "Duración de tiempo", "Clasificación de tiempo",
    "Clasificación de GPS", "Longitud", "Latitud", "Altitud", "UUID"
  ))
  expect_equal(master$UUID[[1]], "UUID-SENTINEL-2")
  expect_equal(master$UUID[[2]], "UUID-SENTINEL-1")
  expect_equal(master$`Clasificación de tiempo`[[2]], "Muy corto")
  expect_equal(master$`Clasificación de GPS`[[2]], "Lejos")
  expect_equal(master$Sexo[[2]], "Hombre")
  master_header <- tabs[["Tabla maestra"]][[1]]
  expect_true(all(c("Sexo", "Clasificación de tiempo", "Clasificación de GPS") %in% master_header))
  expect_true(all(match(c("Sexo", "Clasificación de tiempo", "Clasificación de GPS"), master_header) %in% .monitoreo_sheets_status_columns(master_header)))
  expect_equal(tabs[["Validación de tiempos"]][[1]][[1]], "Responsable")

  rutas <- .monitoreo_publication_section_frame(model, "encuestadores_rutas")
  expect_true(all(c("UMP titular", "Manzana de referencia", "Responsable", "Estado UMP") %in% names(rutas)))
  expect_false(any(c("Responsable planificado", "Responsable observado", "Fuente del responsable") %in% names(rutas)))

  responsables <- .monitoreo_publication_section_frame(model, "responsables_rutas")
  expect_true("Bloque" %in% names(responsables))
  expect_true(any(responsables$Bloque == "Responsables observados por registros"))
  expect_true(any(responsables$Bloque == "Asignación planificada"))
  planned_assignment <- .monitoreo_publication_block_df(responsables, "Asignación planificada")
  expect_true(all(c("UMP", "Responsable asignado", "Encuestas válidas", paste("Encuesta", 1:8)) %in% names(planned_assignment)))
  expect_false("Encuestas extra" %in% names(planned_assignment))
  expect_false("UMP asignadas" %in% names(planned_assignment))
  expect_false(any(grepl(" estado$", names(planned_assignment), ignore.case = TRUE)))
  expect_equal(
    planned_assignment$UMP,
    planned_assignment$UMP[order(.monitoreo_publication_ump_sort_number(planned_assignment$UMP), planned_assignment$UMP)]
  )

  resumen <- .monitoreo_publication_section_frame(model, "resumen_operativo")
  expect_true(any(resumen$Bloque == "Tarjetas ejecutivas"))
  expect_true(any(resumen$Bloque == "Producción por encuestador"))
  avance_distrito <- .monitoreo_publication_block_df(resumen, "Avance por distrito")
  expect_true(all(c("Efectivas poblacionales", "UMP falta cuota", "UMP pendientes", "% UMP completas") %in% names(avance_distrito)))
  expect_false("Estado" %in% names(avance_distrito))
  expect_false(any(c("UMP por aplicar", "UMP con exceso", "UMP no iniciadas") %in% names(avance_distrito)))
  expect_true("TOTAL" %in% avance_distrito$Distrito)
  produccion <- .monitoreo_publication_block_df(resumen, "Producción por encuestador")
  expect_true(all(c("Responsable", "UMP completas cumpliendo cuota", "% avance poblacional") %in% names(produccion)))
  expect_true(any(suppressWarnings(as.numeric(produccion$`UMP completas cumpliendo cuota`)) > 0, na.rm = TRUE))
  expect_true(all(.monitoreo_publication_has_assigned_responsible(produccion$Responsable)))
  expect_false(any(trimws(as.character(produccion$Responsable)) %in% c("-", "Sin responsable", "Sin datos", "No asignado")))

  cuotas <- .monitoreo_publication_section_frame(model, "cuotas_ump")
  expect_true("Bloque" %in% names(cuotas))
  expect_true(any(cuotas$Bloque == "Resumen de cuotas UMP"))
  expect_true(any(cuotas$Bloque == "Cumplimiento por UMP"))
  expect_true(any(cuotas$Bloque == "Matriz esperada sexo/edad"))
  expect_false(any(cuotas$Bloque == "Matriz observada sexo/edad por UMP"))
  expect_false(any(cuotas$Bloque == "Edades exactas observadas"))
  cumplimiento <- .monitoreo_publication_block_df(cuotas, "Cumplimiento por UMP")
  expect_false(any(cumplimiento$`Estado cuota` == "Excedida", na.rm = TRUE))
  expect_false(any(grepl("exceso", names(cumplimiento), ignore.case = TRUE)))
  expect_true(all(c(
    "Distrito", "Zona", "UMP", "Manzana", "Último ingreso", "Tipo", "Responsable",
    "Efectivas (n)", "Avance (%)", "Estado cuota",
    "Hombre (n)", "Cuota hombre (n)", "Mujer (n)", "Cuota mujer (n)",
    "Edades hombre", "Edades mujer"
  ) %in% names(cumplimiento)))
  expect_false(any(c("Cumple cuota", "Criterio cuota") %in% names(cumplimiento)))
  expect_true(all(!is.na(cumplimiento$`Edades hombre`)))
  expect_true(all(!is.na(cumplimiento$`Edades mujer`)))
  expect_equal(
    cumplimiento$UMP,
    cumplimiento$UMP[order(.monitoreo_publication_ump_sort_number(cumplimiento$UMP), cumplimiento$UMP)]
  )

  tiempos <- .monitoreo_publication_section_frame(model, "validacion_tiempos")
  tiempo_labels <- unique(trimws(as.character(tiempos$Clasificación)))
  tiempo_labels <- tiempo_labels[nzchar(tiempo_labels)]
  expect_true(all(tiempo_labels %in% c("Normal", "Corto", "Muy corto")))
  expect_true(any(tiempos$Clasificación %in% c("Corto", "Muy corto")))
  expect_false("Regla aplicada" %in% names(tiempos))

  gps <- .monitoreo_publication_section_frame(model, "gps_territorio")
  expect_true(all(c("ID respuesta", "Estado GPS por respuesta", "Latitud", "Longitud") %in% names(gps)))
  expect_true(any(gps$`Estado GPS por respuesta` == "Lejos", na.rm = TRUE))
  expect_true(any(gps$`Estado GPS por respuesta` == "Sin GPS", na.rm = TRUE))
  expect_false(any(c("Casos con GPS", "Casos sin GPS", "GPS sospechoso", "Fuera de zona") %in% names(gps)))
  expect_false("Acción sugerida" %in% names(tiempos))
  expect_false("Acción sugerida" %in% names(.monitoreo_publication_section_frame(model, "casos_accionables")))

  audit_text <- paste(unlist(model$auditoria_tecnica$rows, use.names = FALSE), collapse = " ")
  base_text <- paste(unlist(model$base_tecnica$rows, use.names = FALSE), collapse = " ")
  expect_true(grepl("UUID-SENTINEL-1", audit_text, fixed = TRUE))
  expect_true(grepl("PHONE-MODEL-SENTINEL", base_text, fixed = TRUE))

  client_model <- monitoreo_publication_model(data, cfg, audience = "client", dashboard = dashboard)
  expect_equal(client_model$family, "territorial_fieldwork")
  expect_equal(client_model$tab_order, as.list(c(
    "Portada", "Resumen de avance", "Avance por distrito", "Avance por UMP",
    "Avance diario", "Avance por responsable", "Cuotas resumen",
    "Fuentes y actualización"
  )))
  expect_true(all(c("resumen_avance", "avance_por_distrito", "avance_por_ump", "cuotas_resumen") %in% names(client_model)))
  client_district <- .monitoreo_workbook_df(client_model$avance_por_distrito$rows)
  client_ump <- .monitoreo_workbook_df(client_model$avance_por_ump$rows)
  expect_false("Estado" %in% names(client_district))
  expect_true("Estado" %in% names(client_ump))
  expect_false(any(c("base_tecnica", "auditoria_tecnica", "validacion_tiempos", "ocurrencias_campo", "casos_accionables", "gps_territorio") %in% names(client_model)))
  client_text <- paste(unlist(client_model, use.names = FALSE), collapse = " ")
  expect_false(grepl("PHONE-MODEL-SENTINEL|UUID-SENTINEL-1|RAW-ID-1", client_text))
  expect_false(grepl("Acción sugerida|Recomendación|Comentario operativo|Próximo paso|Diagnóstico|Riesgo", client_text))
})

test_that("detectores separan familia y audiencia sin inferencias riesgosas", {
  expect_equal(detect_monitoreo_family(config = list(monitoreo_profile = list(family = "territorial"))), "territorial_fieldwork")
  expect_equal(detect_monitoreo_family(config = list(monitoreo_profile = list(family = "acreditacion"))), "accreditation_monitoring")
  expect_equal(detect_monitoreo_family(data = data.frame(distrito = "Lima", stringsAsFactors = FALSE)), "generic_monitoring")
  expect_equal(detect_monitoreo_family(data = data.frame(dim_actor = "Docentes", stringsAsFactors = FALSE)), "generic_monitoring")
  expect_equal(detect_monitoreo_family(data = data.frame(dim_actor = "Docentes", universo = 10L, stringsAsFactors = FALSE)), "accreditation_monitoring")
  expect_equal(detect_monitoreo_family(data = data.frame(distrito = "Lima", advance_block_ump = "1", manzana = "001", stringsAsFactors = FALSE)), "territorial_fieldwork")
  expect_equal(detect_publication_audience("client"), "client")
  expect_equal(detect_publication_audience("interno"), "internal")
  expect_equal(detect_publication_audience(destination = list(target = "Cliente")), "client")
  expect_equal(detect_publication_audience(), "internal")
})

test_that("modelo de acreditacion separa cliente progreso e interno operativo", {
  demo <- monitoreo_demo_payload(seed = 19L, n = 20L)
  data <- demo$snapshot$data
  data$response_id <- paste0("RID-ACC-", seq_len(nrow(data)))
  data$telefono_contacto <- "PHONE-ACC-SENTINEL"
  data$lat <- -12.1
  data$lon <- -77.1

  client_model <- monitoreo_publication_model(data, demo$config, audience = "client")
  expect_equal(client_model$family, "accreditation_monitoring")
  expect_equal(client_model$tab_order, as.list(c(
    "Portada", "Resumen ejecutivo", "Avance general", "Avance por actor",
    "Avance diario", "Avance por segmento", "Cobertura y pendientes",
    "Fuentes y actualización"
  )))
  expect_true(all(c("resumen_ejecutivo", "avance_general", "avance_por_actor", "avance_diario", "avance_por_segmento", "cobertura_pendientes") %in% names(client_model)))
  expect_false(any(c("pendientes_por_actor", "control_seguimiento", "casos_accionables", "auditoria_tecnica", "base_tecnica") %in% names(client_model)))
  client_actor_cols <- unlist(client_model$avance_por_actor$columns, use.names = FALSE)
  expect_true(all(c("Actor", "Universo", "Efectivas", "Pendientes", "% avance universo", "% cobertura", "Estado de avance") %in% client_actor_cols))
  expect_false(any(grepl("Mínimo|Minimo|Meta|Brecha|umbral|Referencia operativa", client_actor_cols, ignore.case = TRUE)))
  expect_true("client" %in% names(client_model$accreditation_progress))
  expect_false("internal" %in% names(client_model$accreditation_progress))
  expect_equal(client_model$daily_progress$target_reference$label, "Universo esperado")
  client_text <- paste(unlist(client_model, use.names = FALSE), collapse = " ")
  expect_false(grepl("PHONE-ACC-SENTINEL|RID-ACC-1|-12\\.1|-77\\.1", client_text))
  expect_false(grepl("Mínimo/meta|Meta alcanzada|Mínimo alcanzado|Cerca del mínimo|Sobre el mínimo|Brechas de cumplimiento", client_text))
  expect_false(grepl("Acción sugerida|Recomendación|Comentario operativo|Próximo paso|Diagnóstico|Riesgo", client_text))

  explicit_targets_model <- monitoreo_publication_model(data, demo$config, audience = "client", include_targets = TRUE)
  explicit_cols <- unlist(explicit_targets_model$avance_por_actor$columns, use.names = FALSE)
  expect_true(any(grepl("Referencia operativa|umbral interno", explicit_cols, ignore.case = TRUE)))
  expect_true("internal" %in% names(explicit_targets_model$accreditation_progress))

  internal_model <- monitoreo_publication_model(data, demo$config, audience = "internal")
  expect_equal(internal_model$family, "accreditation_monitoring")
  expect_true(all(c("resumen_operativo", "metas_internas_actor", "pendientes_por_actor", "control_seguimiento", "casos_accionables", "auditoria_tecnica", "base_tecnica") %in% names(internal_model)))
  internal_actor_cols <- unlist(internal_model$avance_por_actor$columns, use.names = FALSE)
  expect_true(all(c("Mínimo/meta operativa", "% sobre mínimo", "Brecha contra mínimo", "Estado interno") %in% internal_actor_cols))
  expect_true("internal" %in% names(internal_model$accreditation_progress))
  internal_text <- paste(unlist(internal_model$base_tecnica$rows, use.names = FALSE), collapse = " ")
  expect_true(grepl("PHONE-ACC-SENTINEL|RID-ACC-1|-12\\.1|-77\\.1", internal_text))
})

test_that("modelos cliente toleran campos faltantes sin inventar recomendaciones", {
  acc <- data.frame(
    dim_actor = c("Docentes", "Estudiantes"),
    universo = c(10L, 20L),
    efectiva = c(TRUE, FALSE),
    stringsAsFactors = FALSE
  )
  acc_cfg <- list(monitoreo_profile = list(family = "acreditacion", units = list(list(id = "doc", label = "Docentes"))))
  acc_model <- monitoreo_publication_model(acc, acc_cfg, audience = "client")
  expect_true("avance_diario" %in% names(acc_model))
  expect_true("cobertura_pendientes" %in% names(acc_model))

  terr <- data.frame(
    distrito = c("Norte", "Sur"),
    gps_inicio = c("", ""),
    stringsAsFactors = FALSE
  )
  terr_cfg <- list(monitoreo_profile = list(family = "territorial"), territorial = list())
  terr_model <- monitoreo_publication_model(terr, terr_cfg, audience = "client")
  expect_true("avance_por_ump" %in% names(terr_model))
  expect_false("gps_territorio" %in% names(terr_model))

  combined_text <- paste(unlist(list(acc_model, terr_model), use.names = FALSE), collapse = " ")
  expect_false(grepl("Acción sugerida|Recomendación|Comentario operativo|Próximo paso|Diagnóstico|Riesgo", combined_text))
})

test_that("modelo de avance diario cuenta estados, efectivas y acumulados sin inventar categorias", {
  acc <- data.frame(
    fecha = c("2026-06-17", "2026-06-17", "2026-06-18", "2026-06-18"),
    status = c("completed", "partial", "rejected", "misterio_externo"),
    dim_actor = c("Docentes", "Docentes", "Estudiantes", "Docentes"),
    carrera = c("A", "A", "B", "A"),
    stringsAsFactors = FALSE
  )
  status <- build_daily_status_table(acc, date_col = "fecha", status_col = "status", family = "acreditacion")
  expect_equal(sum(status$Casos), 4L)
  expect_true(all(c("Respondió", "Parcial", "Rechazo", "Sin clasificación") %in% status$Estado))
  expect_false("misterio_externo" %in% status$Estado)

  effective <- build_daily_effective_table(acc, date_col = "fecha", status_col = "status", family = "acreditacion")
  expect_equal(effective$`Nuevas efectivas`, c(1L, 0L))
  cumulative <- build_cumulative_progress_table(effective, target = 4L, universe = 10L)
  expect_equal(cumulative$`Efectivas acumuladas`, c(1L, 1L))
  expect_equal(cumulative$`Meta/referencia`, c(4L, 4L))
  expect_equal(cumulative$Brecha, c(3L, 3L))

  actor <- build_daily_actor_progress(
    acc,
    date_col = "fecha",
    actor_col = "dim_actor",
    status_col = "status",
    target_table = data.frame(Actor = c("Docentes", "Estudiantes"), `Mínimo/meta` = c(2L, 2L), check.names = FALSE)
  )
  expect_true(all(c("Fecha", "Actor", "Nuevas efectivas", "Efectivas acumuladas", "% avance mínimo", "Brecha") %in% names(actor)))
  expect_true(any(actor$Actor == "Docentes"))

  model <- build_daily_progress_model(
    acc,
    list(monitoreo_profile = list(family = "acreditacion")),
    "acreditacion",
    frames = list(
      avance_general = data.frame(Indicador = "Total", Universo = 10L, `Mínimo/meta` = 4L, Efectivas = 1L, check.names = FALSE),
      avance_por_actor = data.frame(Actor = c("Docentes", "Estudiantes"), `Mínimo/meta` = c(2L, 2L), check.names = FALSE)
    )
  )
  expect_equal(model$schema, "monitoreo_daily_progress_v1")
  expect_true(length(model$by_date_status) > 0L)
  expect_true(length(model$daily_effective) > 0L)
  expect_true(length(model$cumulative_effective) > 0L)
  expect_true(length(model$by_date_actor) > 0L)
  expect_true(isTRUE(model$target_reference$configured))
  expect_equal(model$target_reference$label, "Universo esperado")
  internal_daily <- build_daily_progress_model(
    acc,
    list(monitoreo_profile = list(family = "acreditacion")),
    "acreditacion",
    frames = list(
      avance_general = data.frame(Indicador = "Total", Universo = 10L, `Mínimo/meta operativa` = 4L, Efectivas = 1L, check.names = FALSE),
      avance_por_actor = data.frame(Actor = c("Docentes", "Estudiantes"), `Mínimo/meta operativa` = c(2L, 2L), check.names = FALSE)
    ),
    audience = "internal"
  )
  expect_equal(internal_daily$target_reference$label, "Referencia operativa")
  model_text <- paste(unlist(model, use.names = FALSE), collapse = " ")
  expect_false(grepl("Recomendación|Acción sugerida|Comentario operativo|Próximo paso|Diagnóstico|Riesgo", model_text))
})

test_that("modelo de avance diario maneja vacios y desagrega territorial por distrito y UMP", {
  missing_date <- build_daily_progress_model(
    data.frame(status = c("completed", "partial"), stringsAsFactors = FALSE),
    list(monitoreo_profile = list(family = "acreditacion")),
    "acreditacion"
  )
  expect_equal(missing_date$empty_state$date, "No hay fecha disponible para construir evolución diaria.")

  missing_status <- build_daily_progress_model(
    data.frame(fecha = c("2026-06-17", "2026-06-18"), stringsAsFactors = FALSE),
    list(monitoreo_profile = list(family = "territorial")),
    "territorial"
  )
  expect_equal(missing_status$empty_state$status, "No hay estados normalizados disponibles.")

  terr <- data.frame(
    submission_date_iso = c("2026-06-17", "2026-06-17", "2026-06-17", "2026-06-18"),
    validation_status = c("no_defendible", "validada", "no_defendible", "validada"),
    source_effective = c(TRUE, TRUE, FALSE, TRUE),
    advance_valid = c(FALSE, TRUE, FALSE, TRUE),
    distrito = c("ate", "ate", "sjl", "olivos"),
    advance_block_ump = c("UMP-01", "UMP-01", "UMP-02", "UMP-03"),
    responsable = c("Ana", "Ana", "-", "Bruno"),
    pulso_code = c("P001", "P001", "", "P002"),
    stringsAsFactors = FALSE
  )
  terr_model <- build_daily_progress_model(
    terr,
    list(monitoreo_profile = list(family = "territorial")),
    "territorial",
    frames = list(
      avance_por_distrito = data.frame(Distrito = c("Ate", "San Juan de Lurigancho", "Los Olivos"), Meta = c(1L, 1L, 1L), check.names = FALSE),
      avance_por_ump = data.frame(UMP = c("UMP-01", "UMP-02", "UMP-03"), Meta = c(1L, 1L, 1L), check.names = FALSE)
    ),
    reports = list(
      kpis = list(meta = 3L),
      route_quota_progress = list(blocks = list(
        list(distrito = "Ate", ump = "UMP-01", tipo_manzana = "titular"),
        list(distrito = "San Juan de Lurigancho", ump = "UMP-02", tipo_manzana = "titular"),
        list(distrito = "Los Olivos", ump = "UMP-03", tipo_manzana = "titular")
      ))
    )
  )
  expect_true(length(terr_model$by_date_status) > 0L)
  expect_true(length(terr_model$by_date_district) > 0L)
  expect_true(length(terr_model$by_date_responsible) > 0L)
  expect_true(length(terr_model$by_date_ump) > 0L)
  expect_true(isTRUE(terr_model$target_reference$configured))
  expect_equal(terr_model$target_reference$label, "Meta/cuota territorial")
  daily_ump <- .monitoreo_publication_records_df(terr_model$daily_effective)
  expect_equal(as.integer(daily_ump$`Nuevas UMP efectivas`), c(1L, 1L))
  expect_equal(daily_ump$`Fecha etiqueta`, c("17 Junio", "18 Junio"))
  cumulative_ump <- .monitoreo_publication_records_df(terr_model$cumulative_effective)
  expect_equal(as.integer(utils::tail(cumulative_ump$`UMP efectivas acumuladas`, 1L)), 2L)
  expect_equal(as.integer(cumulative_ump$`Meta UMP`), c(3L, 3L))
  status_ump <- .monitoreo_publication_records_df(terr_model$by_date_status)
  expect_equal(as.integer(status_ump$Casos[status_ump$Fecha == "2026-06-17" & status_ump$Estado == "Efectiva"]), 1L)
  expect_equal(as.integer(status_ump$Casos[status_ump$Fecha == "2026-06-17" & status_ump$Estado == "No efectiva"]), 1L)
  district_ump <- .monitoreo_publication_records_df(terr_model$by_date_district)
  expect_true("Ate" %in% district_ump$Distrito)
  expect_true("Los Olivos" %in% district_ump$Distrito)
  expect_false("ate" %in% district_ump$Distrito)
  responsible_ump <- .monitoreo_publication_records_df(terr_model$by_date_responsible)
  expect_true(all(c("Encuestador", "Nuevas UMP efectivas", "UMP efectivas acumuladas") %in% names(responsible_ump)))
  expect_true(any(grepl("P001", responsible_ump$Encuestador, fixed = TRUE)))
  expect_true(any(grepl("P002", responsible_ump$Encuestador, fixed = TRUE)))
  expect_false("-" %in% responsible_ump$Encuestador)
})

test_that("clasificacion operacional de duracion usa umbrales centralizados", {
  tcfg <- list(min_duration_seconds = 60, max_duration_seconds = 7200)
  expect_equal(.monitoreo_publication_duration_label("", NA_real_, tcfg), "")
  expect_equal(.monitoreo_publication_duration_label("malformed", NA_real_, tcfg), "")
  expect_equal(.monitoreo_publication_duration_label("", 30, tcfg), "Muy corto")
  expect_equal(.monitoreo_publication_duration_label("sin_dato", 30, tcfg), "Muy corto")
  expect_equal(.monitoreo_publication_duration_label("", 120, tcfg), "Corto")
  expect_equal(.monitoreo_publication_duration_label("", 1800, tcfg), "Normal")
  expect_equal(.monitoreo_publication_duration_label("", 8000, tcfg), "Normal")
  expect_equal(.monitoreo_publication_duration_label("", 50000, tcfg), "Normal")
  expect_equal(.monitoreo_publication_duration_label("esperada", NA_real_, tcfg), "Normal")
  expect_equal(.monitoreo_publication_duration_label("larga", NA_real_, tcfg), "Normal")
  expect_equal(.monitoreo_publication_duration_label("extrema", NA_real_, tcfg), "Normal")
  expect_equal(.monitoreo_publication_duration_label("sin_dato", NA_real_, tcfg), "")
})
