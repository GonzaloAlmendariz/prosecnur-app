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
    do.call(rbind, lapply(records, as.data.frame, check.names = FALSE, stringsAsFactors = FALSE))
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
  sheets <- list(list(properties = list(sheetId = 1L, title = "Barrido")))
  set_google_api(function(url, method = "GET", body = NULL) {
    calls[[length(calls) + 1L]] <<- list(url = url, method = method, body = body)
    if (grepl("[?]fields=", url)) {
      return(list(spreadsheetId = "sheet_abc", sheets = sheets))
    }
    if (grepl(":batchUpdate$", url)) {
      for (request in body$requests %||% list()) {
        title <- request$addSheet$properties$title %||% ""
        if (nzchar(title)) {
          sheets[[length(sheets) + 1L]] <<- list(properties = list(sheetId = sheet_id, title = title))
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
  expect_equal(report$block_progress[[1]]$validas, 1L)
  expect_equal(report$response_audit[[1]]$submission_date, "1 Junio")
  expect_equal(report$response_audit[[1]]$submission_hour, "05:10am")
  expect_equal(report$daily[[1]]$date_label, "1 Junio")
  expect_equal(length(report$map$points), 4L)
  expect_equal(report$map$points[[1]]$lat, -12.1)
  expect_equal(report$map$points[[1]]$geo_estado, "geo_ok")
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
    `_geolocation` = c("", "", ""),
    consent = c("1", "1", "1"),
    `Core/E1_age` = c(25, 32, 40),
    `_status` = rep("submitted_via_web", 3),
    `_uuid` = c("a", "b", "c"),
    `_submitted_by` = c("enc1", "enc2", "enc1"),
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(monitoreo_profile = list(family = "territorial", status = "active")), data)
  context <- list(
    phase = "pilot",
    blocks = list(
      list(id_manzana = "150103042001", ubigeo = "150103", distrito = "ATE", zona = "04200", manzana = "001", entrevistas = 5, viviendas = 80, poblacion = 250, territorio_muestral = "150103-04200", hoja_num = 1, rango_inicio = 1, rango_fin = 5),
      list(id_manzana = "150108012001", ubigeo = "150108", distrito = "CHORRILLOS", zona = "01200", manzana = "001", entrevistas = 5, viviendas = 40, poblacion = 120, territorio_muestral = "150108-01200", hoja_num = 2, rango_inicio = 6, rango_fin = 10)
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
})
