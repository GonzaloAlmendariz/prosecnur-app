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
      list(filters = list(distrito = "Norte"), meta = 5L),
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
  expect_equal(out$q0001, "Norte")
  expect_equal(out$cv_enumerador, "Ana")
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

test_that("pulso persiste monitoreo sin tokens", {
  sid <- session_create()
  session_set(sid, "monitoreo_sources", monitoreo_normalize_sources(list(list(
    kind = "kobo",
    label = "Campo",
    asset_uid = "asset123",
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
  expect_equal(saved$monitoreo_sources[[1]]$dimensions$actor, "Vecinos")
})
