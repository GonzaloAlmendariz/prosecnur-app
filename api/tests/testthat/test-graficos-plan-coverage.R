test_that("inventario de graficos prioriza recodificadas e integra campos other", {
  inst <- list(
    survey = data.frame(
      type_base = c("text", "select_one", "text", "text", "select_multiple"),
      type = c("text", "select_one lst_inst", "text", "text", "select_multiple lst_multi"),
      name = c("p9", "p9_recod", "p9_other", "correo", "p19"),
      label = c("Institucion abierta", "Institucion recodificada", "Otra institucion", "Correo electronico", "Herramientas"),
      group_name = c("Perfil", "Perfil", "Perfil", "Perfil", "IA"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_inst", "lst_inst", "lst_multi", "lst_multi"),
      name = c("pucp", "otros", "a", "b"),
      label = c("PUCP", "Otros", "A", "B"),
      stringsAsFactors = FALSE
    )
  )
  data <- data.frame(
    p9 = c("PUCP", "UNI", ""),
    p9_recod = c("pucp", "otros", "pucp"),
    p9_other = c("", "UNI", ""),
    correo = c("a@b.com", "", ""),
    p19 = c("a b", "a", ""),
    stringsAsFactors = FALSE
  )

  vars <- .graficos_extract_vars_from_inst(inst, data = data, source_kind = "kobo")
  by_name <- stats::setNames(vars, vapply(vars, `[[`, character(1), "name"))

  expect_false(isTRUE(by_name$p9$is_preferred))
  expect_equal(by_name$p9$covered_by, "p9_recod")
  expect_true(isTRUE(by_name$p9_recod$graphable))
  expect_true(isTRUE(by_name$p9_recod$is_preferred))
  expect_equal(by_name$p9_other$integrated_in, "p9_recod")
  expect_false(isTRUE(by_name$correo$graphable))
  expect_match(by_name$correo$exclusion_reason, "identificador|contacto")
  expect_true(isTRUE(by_name$p19$graphable))
  expect_true(isTRUE(by_name$p19$section_reliable))
})

test_that("el auto-plan excluye metadata/QA/control operativo y conserva preguntas reales y _recod", {
  # El clasificador de control operativo aísla las preguntas de introducción del
  # formulario (consentimiento, QA entrevista real vs. prueba, tamizaje de
  # disponibilidad) sin capturar preguntas sustantivas ni recodificadas. `timing`
  # ("¿cuánto tiempo le tomó llegar?") NO es metadata: es acceso, y se grafica.
  meta <- list(
    c("testreal", "¿Es una entrevista real o una prueba?"),
    c("Consent", "¿Acepta continuar con la encuesta?"),
    c("Registered_person_available",
      "En estos momentos, ¿Algún miembro mayor de edad está disponible para responder esta encuesta?")
  )
  for (m in meta) {
    expect_true(.graficos_is_operational_metadata(m[[1]], m[[2]]),
                info = paste("debía excluirse:", m[[1]]))
  }
  reales <- list(
    c("transport", "¿Qué medio de transporte utilizó para llegar?"),
    c("reason_edp", "¿Cuáles fueron los motivos principales?"),
    c("Feel_safe_reporting", "¿Se sentiría seguro/a dando retroalimentación?"),
    c("censo_2025_inei", "¿Su hogar participó en el Censo Nacional 2025?"),
    c("transport_recod", "Medio de transporte (recodificado)"),
    c("timing", "¿Cuánto tiempo le tomó aproximadamente llegar al Espacio de Protección?")
  )
  for (r in reales) {
    expect_false(.graficos_is_operational_metadata(r[[1]], r[[2]]),
                 info = paste("no debía excluirse:", r[[1]]))
  }

  inst <- list(
    survey = data.frame(
      type = c("select_one Yes_no", "select_one testreal", "select_one acceso",
               "select_one acceso", "select_one acceso"),
      type_base = rep("select_one", 5),
      name = c("Consent", "testreal", "transport", "transport_recod", "timing"),
      label = c("¿Acepta continuar con la encuesta?", "¿Es una entrevista real o una prueba?",
                "¿Qué medio de transporte utilizó?", "Transporte (recodificado)",
                "¿Cuánto tiempo le tomó llegar?"),
      group_name = c("Intro", "Intro", "Acceso", "Acceso", "Acceso"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("Yes_no", "Yes_no", "testreal", "testreal", "acceso", "acceso"),
      name = c("1", "0", "1", "0", "bus", "pie"),
      label = c("Sí", "No", "Real", "Prueba", "Bus", "A pie"),
      stringsAsFactors = FALSE
    )
  )
  data <- data.frame(
    Consent = c("1", "1", "1"),
    testreal = c("1", "1", "0"),
    transport = c("bus", "pie", "bus"),
    transport_recod = c("bus", "pie", "bus"),
    timing = c("bus", "pie", "bus"),
    stringsAsFactors = FALSE
  )
  vars <- .graficos_extract_vars_from_inst(inst, data = data, source_kind = "kobo")
  by_name <- stats::setNames(vars, vapply(vars, `[[`, character(1), "name"))

  expect_false(isTRUE(by_name$Consent$graphable))
  expect_match(by_name$Consent$exclusion_reason, "metadato|operativo")
  expect_false(isTRUE(by_name$testreal$graphable))
  expect_true(isTRUE(by_name$timing$graphable))
  expect_true(isTRUE(by_name$transport_recod$graphable))
})

test_that("inventario reconoce una recodificada multiple almacenada solo en dummies", {
  inst <- list(
    survey = data.frame(
      type = c("select_multiple original", "select_multiple recod"),
      type_base = c("select_multiple", "select_multiple"),
      name = c("D1_information", "D1_information_recod"),
      label = c("Información recibida", "Información recibida recodificada"),
      list_name = c("original", "recod"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("original", "recod", "recod"),
      name = c("1", "1", "2"),
      label = c("Original", "Categoría 1", "Categoría 2"),
      stringsAsFactors = FALSE
    )
  )
  data <- data.frame(
    D1_information = c("1", "", "1"),
    d1_information_recod.1 = c(1, 0, 0),
    d1_information_recod.2 = c(0, 1, 0),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  aligned <- .graficos_align_recoded_dummy_names(data, inst)
  expect_true(all(c("D1_information_recod.1", "D1_information_recod.2") %in% names(aligned)))
  vars <- .graficos_extract_vars_from_inst(inst, data = aligned, source_kind = "kobo")
  by_name <- stats::setNames(vars, vapply(vars, `[[`, character(1), "name"))

  expect_equal(by_name$D1_information_recod$n_non_empty, 2L)
  expect_true(isTRUE(by_name$D1_information_recod$is_preferred))
  expect_false(isTRUE(by_name$D1_information$is_preferred))
  expect_equal(by_name$D1_information$covered_by, "D1_information_recod")
})

test_that("actividad territorial distingue planificacion, recorrido y efectividad", {
  progress <- data.frame(
    id_manzana = c("A", "B", "C"),
    ubigeo = rep("150133", 3),
    zona = c("001", "002", "003"),
    validas = c(0, 0, 1),
    revision = c(0, 0, 0),
    no_defendibles = c(0, 1, 0),
    avance_pct = c(0, 0, 25),
    stringsAsFactors = FALSE
  )

  expect_equal(.graficos_fieldwork_activity_mask(progress, "planned"), c(TRUE, TRUE, TRUE))
  expect_equal(.graficos_fieldwork_activity_mask(progress, "visited"), c(FALSE, TRUE, TRUE))
  expect_equal(.graficos_fieldwork_activity_mask(progress, "effective"), c(FALSE, FALSE, TRUE))

  sets <- .graficos_zone_sets(list(block_progress = progress))
  expect_setequal(sets$planned, paste("150133", progress$zona, sep = "::"))
  expect_setequal(sets$visited, paste("150133", progress$zona[2:3], sep = "::"))
  expect_identical(sets$effective, "150133::003")
})

test_that("cobertura extrae variables desde graficadores y bloques", {
  plan <- list(slides = list(
    list(
      id = "s1",
      tipo = "p_slide_2_graficos",
      payload = list(
        izquierda = list(graficador = "p_barras_agrupadas", args = list(var = "base$p19")),
        derecha = list(graficador = "p_barras_apiladas", args = list(var = "p32", cruces = "sexo"))
      )
    ),
    list(
      id = "s2",
      tipo = "p_slide_1_grafico",
      payload = list(
        grafico = list(
          graficador = "p_barras_multiapiladas",
          args = list(modo = "var", vars = list("p33_1", "p33_2"), bloques = list(list(vars = list("p34_recod"))))
        )
      )
    )
  ))

  refs <- .graficos_collect_plan_refs(plan)
  expect_setequal(refs, c("base$p19", "p32", "sexo", "p33_1", "p33_2", "p34_recod"))
})

.graficos_acnur_test_session <- function() {
  sid <- session_create()
  estudio_ensure(sid)

  survey <- data.frame(
    type = c(
      "begin_group",
      "select_one district_list",
      "select_one yesno",
      "select_multiple topics",
      "note",
      "calculate",
      "geopoint",
      "text",
      "end_group"
    ),
    name = c(
      "datos_hogar",
      "Core/M5_district",
      "p1",
      "p2",
      "intro_note",
      "calc_score",
      "gps_raw",
      "email",
      "datos_hogar"
    ),
    label = c(
      "Datos del hogar",
      "Distrito",
      "Acceso a servicios",
      "Temas prioritarios",
      "Nota introductoria",
      "Calculo interno",
      "GPS crudo",
      "Correo electronico",
      "Datos del hogar"
    ),
    group_path = c("", rep("Datos del hogar", 7), ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  choices <- data.frame(
    list_name = c(
      rep("district_list", 3),
      rep("yesno", 2),
      rep("topics", 2)
    ),
    name = c("150132", "150103", "150117", "yes", "no", "a", "b"),
    label = c(
      "San Juan de Lurigancho",
      "Ate",
      "Los Olivos",
      "Si",
      "No",
      "Educacion",
      "Salud"
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  data <- data.frame(
    `Core/M5_district` = c("150132", "150103", "150117", ""),
    p1 = c("yes", "no", "yes", ""),
    p2 = c("a b", "a", "b", ""),
    gps_raw = c("-12 -77", "-12 -76", "", ""),
    email = c("a@example.org", "", "", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  s <- session_get(sid)
  s$estudio$bases <- list(default = list(nombre = "default", source_kind = "kobo"))
  s$rp_inst <- list(survey = survey, choices = choices)
  s$rp_data <- data
  .session_env[[sid]] <- s
  sid
}

.graficos_acnur_seed_territorial_capabilities <- function(sid) {
  s <- session_get(sid)
  s$hojas_ruta_ok <- TRUE
  s$hojas_ruta_workspace_outputs <- list(
    sample = list(
      blocks = list(list(ubigeo = "150132", zona = "Z01", manzanas = 12))
    )
  )
  s$monitoreo_snapshot <- list(
    territorial_reports = list(
      response_audit = list(list(ubigeo = "150132", zona = "Z01", advance_valid = TRUE)),
      route_blocks = list(list(ubigeo = "150132", zona = "Z01", total_manzanas = 12))
    )
  )
  .session_env[[sid]] <- s
  invisible(sid)
}

.graficos_plan_graph_specs <- function(plan) {
  slides <- (plan %||% list())$slides %||% list()
  unlist(lapply(slides, function(slide) {
    payload <- (slide %||% list())$payload %||% list()
    candidates <- list(
      payload$grafico,
      payload$izquierda,
      payload$derecha,
      payload$superior_izquierda,
      payload$superior_derecha,
      payload$inferior_izquierda,
      payload$inferior_derecha
    )
    Filter(function(graf) is.list(graf) && !is.null(graf$graficador), candidates)
  }), recursive = FALSE)
}

.graficos_acreditacion_multibase_test_session <- function() {
  sid <- session_create()
  estudio_ensure(sid)

  likert4 <- function(list_name, names = c("1", "2", "3", "4")) {
    data.frame(
      list_name = rep(list_name, 4),
      name = names,
      label = c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho"),
      stringsAsFactors = FALSE
    )
  }
  yesno <- function(list_name, names = c("si", "no")) {
    data.frame(
      list_name = rep(list_name, 2),
      name = names,
      label = c("Si", "No"),
      stringsAsFactors = FALSE
    )
  }
  make_inst <- function(names, labels, lists, choices) {
    list(
      survey = data.frame(
        type = c(paste("select_one", lists), "text"),
        type_base = c(rep("select_one", length(names)), "text"),
        name = c(names, "codigo_pulso"),
        label = c(labels, "Codigo pulso"),
        list_name = c(lists, ""),
        stringsAsFactors = FALSE,
        check.names = FALSE
      ),
      choices = choices
    )
  }

  labels <- c(
    "Satisfaccion con la carrera",
    "Conoce la mision institucional",
    "Atencion administrativa"
  )
  inst_est <- make_inst(
    c("p_sat", "p_mision", "p_incompatible"),
    labels,
    c("likert4", "yesno", "likert4"),
    rbind(likert4("likert4"), yesno("yesno"))
  )
  inst_doc <- make_inst(
    c("p_sat", "p_mision", "p_incompatible"),
    labels,
    c("likert4_doc", "yesno_doc", "yesno_doc"),
    rbind(likert4("likert4_doc"), yesno("yesno_doc"))
  )
  inst_adm <- make_inst(
    c("q_sat", "q_mision"),
    labels[1:2],
    c("escala_adm", "yesno_adm"),
    rbind(likert4("escala_adm"), yesno("yesno_adm"))
  )

  data_est <- data.frame(
    p_sat = c("3", "4", "2", ""),
    p_mision = c("si", "no", "si", ""),
    p_incompatible = c("3", "4", "3", ""),
    codigo_pulso = c("A1", "A2", "A3", ""),
    stringsAsFactors = FALSE
  )
  data_doc <- data.frame(
    p_sat = c("2", "3", "4", ""),
    p_mision = c("si", "si", "no", ""),
    p_incompatible = c("si", "no", "si", ""),
    codigo_pulso = c("D1", "D2", "D3", ""),
    stringsAsFactors = FALSE
  )
  data_adm <- data.frame(
    q_sat = c("3", "4", "2", ""),
    q_mision = c("si", "no", "si", ""),
    codigo_pulso = c("X1", "X2", "X3", ""),
    stringsAsFactors = FALSE
  )

  s <- session_get(sid)
  s$monitoreo_config <- list(monitoreo_profile = list(family = "acreditacion"))
  s$estudio$processing_mode <- "independent_siblings"
  s$estudio$active_base <- "estudiantes"
  s$codif_source_active <- "estudiantes"
  s$estudio$independent_siblings <- list(
    version = 1L,
    sibling_family_id = "acr-test",
    template_base = "estudiantes",
    logic_policy = "shared_template",
    shared_logic = TRUE,
    status = "ready"
  )
  s$estudio$bases <- list(
    estudiantes = list(nombre = "estudiantes", source_kind = "surveymonkey", project_kind = "acreditacion", profile_family = "acreditacion"),
    docentes = list(nombre = "docentes", source_kind = "surveymonkey", project_kind = "acreditacion", profile_family = "acreditacion"),
    administrativos = list(nombre = "administrativos", source_kind = "surveymonkey", project_kind = "acreditacion", profile_family = "acreditacion")
  )
  s$rp_data_sources <- list(estudiantes = data_est, docentes = data_doc, administrativos = data_adm)
  s$rp_inst_sources <- list(estudiantes = inst_est, docentes = inst_doc, administrativos = inst_adm)
  s$rp_data <- data_est
  s$rp_inst <- inst_est
  .session_env[[sid]] <- s
  sid
}

test_that("cobertura territorial usa block_progress cuando route_blocks esta vacio", {
  reports <- list(
    route_blocks = list(),
    response_audit = list(),
    block_progress = data.frame(
      ubigeo = c("150132", "150132"),
      zona = c("00100", "00200"),
      validas = c(8, 0),
      avance_pct = c(100, 0),
      stringsAsFactors = FALSE
    )
  )

  sets <- .graficos_zone_sets(reports)

  expect_setequal(sets$route, c("150132::00100", "150132::00200"))
  expect_equal(sets$effective, "150132::00100")
})

.graficos_var_cruce_blocks <- function(plan) {
  grafs <- .graficos_plan_graph_specs(plan)
  out <- list()
  for (graf in grafs) {
    if (!identical(graf$graficador, "p_barras_multiapiladas")) next
    if (!identical((graf$args %||% list())$modo, "var_cruce")) next
    vars <- (graf$args %||% list())$vars %||% list()
    for (nm in names(vars)) out[[nm]] <- vars[[nm]]
  }
  out
}

test_that("plan sugerido de acreditacion multibase agrega comparativos por actor", {
  sid <- .graficos_acreditacion_multibase_test_session()
  on.exit(session_delete(sid), add = TRUE)

  suggested <- .graficos_suggested_plan(sid, config = list())
  blocks <- .graficos_var_cruce_blocks(suggested$plan)
  titles <- vapply(suggested$plan$slides, function(slide) {
    .graficos_scalar_chr(((slide %||% list())$payload %||% list())$titulo, "")
  }, character(1))
  compare_refs <- unique(unlist(lapply(blocks, as.character), use.names = FALSE))

  expect_true(suggested$ok)
  expect_true("Comparativo por actor" %in% titles)
  expect_setequal(
    blocks$satisfaccion_con_la_carrera,
    c("estudiantes$p_sat", "docentes$p_sat", "administrativos$q_sat")
  )
  expect_setequal(
    blocks$conoce_la_mision_institucional,
    c("estudiantes$p_mision", "docentes$p_mision", "administrativos$q_mision")
  )
  expect_false(any(c("estudiantes$p_incompatible", "docentes$p_incompatible") %in% compare_refs))
  expect_equal(length(suggested$coverage$sources), 3L)
  expect_null(suggested$report_inputs)
})

test_that("comparativos multibase fijan el canvas visual por escala sin fusionar candidatos", {
  sid <- .graficos_acreditacion_multibase_test_session()
  on.exit(session_delete(sid), add = TRUE)

  suggested <- .graficos_suggested_plan(sid, config = list())
  slides <- Filter(function(slide) {
    grafico <- ((slide %||% list())$payload %||% list())$grafico %||% list()
    identical(grafico$graficador, "p_barras_multiapiladas") &&
      identical((grafico$args %||% list())$modo, "var_cruce")
  }, suggested$plan$slides %||% list())
  by_candidate <- stats::setNames(slides, vapply(slides, function(slide) {
    vars <- (((slide %||% list())$payload %||% list())$grafico$args %||% list())$vars %||% list()
    if (length(vars) == 1L && length(names(vars)) == 1L) names(vars)[[1]] else ""
  }, character(1)))

  expect_setequal(
    names(by_candidate),
    c("satisfaccion_con_la_carrera", "conoce_la_mision_institucional")
  )
  expect_equal(
    lapply(by_candidate[c("satisfaccion_con_la_carrera", "conoce_la_mision_institucional")], function(slide) {
      unname((((slide %||% list())$payload %||% list())$grafico$args %||% list())$vars[[1]])
    }),
    list(
      satisfaccion_con_la_carrera = c("estudiantes$p_sat", "docentes$p_sat", "administrativos$q_sat"),
      conoce_la_mision_institucional = c("estudiantes$p_mision", "docentes$p_mision", "administrativos$q_mision")
    )
  )

  visual_contract <- function(slide) {
    payload <- (slide %||% list())$payload %||% list()
    args <- (payload$grafico %||% list())$args %||% list()
    overrides <- args$overrides %||% list()
    at_least <- function(value, minimum) {
      is.numeric(value) && length(value) == 1L && !is.na(value) && value >= minimum
    }
    list(
      tipo = slide$tipo %||% NULL,
      texto = payload$texto %||% "",
      titulo = args$titulo %||% NULL,
      canvas_w_grupo = overrides$canvas_w_grupo %||% NULL,
      canvas_w_buf_grupo_etq = overrides$canvas_w_buf_grupo_etq %||% NULL,
      canvas_w_etiquetas = overrides$canvas_w_etiquetas %||% NULL,
      canvas_w_buf_etq_bars = overrides$canvas_w_buf_etq_bars %||% NULL,
      canvas_h_caption_in = overrides$canvas_h_caption_in %||% NULL,
      nota_pie = overrides$nota_pie %||% NULL,
      size_ejes_ok = at_least(overrides$size_ejes, 19),
      size_texto_barras_ok = at_least(overrides$size_texto_barras, 7),
      size_leyenda_ok = at_least(overrides$size_leyenda, 18),
      top2box = args$top2box %||% NULL,
      canvas_w_bars = overrides$canvas_w_bars %||% NULL,
      canvas_w_buf_bars_extra = overrides$canvas_w_buf_bars_extra %||% NULL,
      canvas_w_extra = overrides$canvas_w_extra %||% NULL,
      mostrar_barra_extra = overrides$mostrar_barra_extra %||% NULL
    )
  }
  common <- list(
    tipo = "p_slide_1_grafico",
    texto = "",
    titulo = "",
    canvas_w_grupo = 0,
    canvas_w_buf_grupo_etq = 0,
    canvas_w_etiquetas = 0.18,
    canvas_w_buf_etq_bars = 0.02,
    canvas_h_caption_in = 0,
    nota_pie = "",
    size_ejes_ok = TRUE,
    size_texto_barras_ok = TRUE,
    size_leyenda_ok = TRUE
  )
  expected <- list(
    satisfaccion_con_la_carrera = c(common, list(
      top2box = TRUE,
      canvas_w_bars = 0.66,
      canvas_w_buf_bars_extra = 0.02,
      canvas_w_extra = 0.12,
      mostrar_barra_extra = TRUE
    )),
    conoce_la_mision_institucional = c(common, list(
      top2box = FALSE,
      canvas_w_bars = 0.80,
      canvas_w_buf_bars_extra = 0,
      canvas_w_extra = 0,
      mostrar_barra_extra = FALSE
    ))
  )

  expect_equal(
    lapply(by_candidate[names(expected)], visual_contract),
    expected
  )
})

test_that("plan sugerido permite desactivar comparativos multi-actor", {
  sid <- .graficos_acreditacion_multibase_test_session()
  on.exit(session_delete(sid), add = TRUE)

  suggested <- .graficos_suggested_plan(sid, config = list(multi_actor_comparisons = FALSE))

  expect_length(.graficos_var_cruce_blocks(suggested$plan), 0L)
  expect_equal(length(suggested$coverage$sources), 1L)
})

test_that("plan ACNUR general usa barras agrupadas sin mapa ni comparativo", {
  sid <- .graficos_acnur_test_session()
  on.exit(session_delete(sid), add = TRUE)
  .graficos_acnur_seed_territorial_capabilities(sid)

  suggested <- .graficos_suggested_plan(
    sid,
    config = list(profile_id = "acnur_kobo_cruncher_plus")
  )
  grafs <- .graficos_plan_graph_specs(suggested$plan)
  refs <- .graficos_collect_plan_refs(suggested$plan)
  titles <- vapply(suggested$plan$slides, function(slide) {
    .graficos_scalar_chr(((slide %||% list())$payload %||% list())$titulo, "")
  }, character(1))

  expect_equal(sum(vapply(grafs, function(graf) {
    identical(graf$graficador, "p_mapa_cobertura_territorial")
  }, logical(1))), 0L)
  expect_false("__koica_group" %in% refs)
  expect_false("__district" %in% refs)
  expect_false("Diseno de intervencion y comparacion" %in% titles)
  expect_true(length(grafs) > 0L)
  expect_true(all(vapply(grafs, function(graf) {
    identical(graf$graficador, "p_barras_agrupadas")
  }, logical(1))))
})

test_that("perfil ACNUR/Kobo agrega variables virtuales territoriales sin exponerlas como preguntas", {
  sid <- .graficos_acnur_test_session()
  on.exit(session_delete(sid), add = TRUE)

  sources <- .graficos_processing_sources(sid)
  data <- sources$data_sources$default
  inst <- sources$inst_sources$default
  vars <- .graficos_extract_vars_from_inst(inst, data = data, source_kind = "kobo")

  expect_true("__koica_group" %in% names(data))
  expect_true("__district" %in% names(data))
  expect_true("__territory_pair" %in% names(data))
  expect_true("__age_group" %in% names(data))
  expect_equal(
    as.character(data$`__koica_group`[1:3]),
    c("Intervención territorial", "Comparación territorial", "Comparación territorial")
  )
  expect_equal(
    as.character(data$`__territory_pair`[1:3]),
    c("Lima Este", "Lima Este", "Lima Norte")
  )
  expect_false("__koica_group" %in% vapply(vars, `[[`, character(1), "name"))
  expect_false("__district" %in% vapply(vars, `[[`, character(1), "name"))
  expect_false("__territory_pair" %in% vapply(vars, `[[`, character(1), "name"))
  expect_false("__age_group" %in% vapply(vars, `[[`, character(1), "name"))
})

test_that("perfil territorial agrega sexo y edad sin repetir la pregunta de sexo", {
  sid <- .graficos_acnur_test_session()
  on.exit(session_delete(sid), add = TRUE)
  state <- session_get(sid)
  state$rp_inst$survey <- rbind(
    state$rp_inst$survey,
    data.frame(
      type = c("select_one sex_list", "calculate"),
      name = c("E2_sex", "E1_age_calc"),
      label = c("¿Cuál es su sexo?", "Rango etario"),
      group_path = c("Datos del hogar", "Datos del hogar"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  state$rp_inst$choices <- rbind(
    state$rp_inst$choices,
    data.frame(
      list_name = rep("sex_list", 3L),
      name = c("1", "2", "3"),
      label = c("Hombre", "Mujer", "Otro"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  state$rp_data$E2_sex <- c("1", "2", "1", "2")
  state$rp_data$E1_age_calc <- c("18 a 29 años", "30 a 44 años", "45 a 59 años", "60 años o más")
  .session_env[[sid]] <- state

  suggested <- .graficos_suggested_plan(
    sid,
    config = list(
      profile_id = "acnur_kobo_cruncher_plus",
      acnur_mode = "territorial",
      include_coverage_maps = FALSE,
      comparison_mode = "paired_district"
    )
  )
  profile <- Filter(function(slide) {
    identical(.graficos_scalar_chr(slide$tipo, ""), "p_slide_2_graficos") &&
      identical(.graficos_scalar_chr((slide$payload %||% list())$titulo, ""), "Perfil de las personas encuestadas")
  }, suggested$plan$slides %||% list())
  specs <- .graficos_plan_graph_specs(suggested$plan)
  sex_specs <- Filter(function(graf) {
    identical(.graficos_scalar_chr((graf$args %||% list())$var, ""), "E2_sex")
  }, specs)

  expect_length(profile, 1L)
  expect_equal(.graficos_scalar_chr(profile[[1L]]$payload$izquierda$graficador, ""), "p_pie")
  expect_equal(.graficos_scalar_chr(profile[[1L]]$payload$derecha$graficador, ""), "p_barras_agrupadas")
  expect_equal(.graficos_scalar_chr(profile[[1L]]$payload$derecha$args$var, ""), "__age_group")
  expect_equal(.graficos_scalar_chr(profile[[1L]]$payload$derecha$args$cruces, ""), "__territory_pair")
  expect_equal(
    profile[[1L]]$payload$derecha$args$overrides$orden_categorias_manual,
    c("18 a 29 años", "30 a 44 años", "45 a 59 años", "60 años o más")
  )
  expect_equal(.graficos_scalar_chr(profile[[1L]]$payload$derecha$args$overrides$leyenda_posicion, ""), "abajo")
  expect_match(.graficos_scalar_chr(profile[[1L]]$payload$base, ""), "^Base: 4 personas$")
  expect_match(
    .graficos_scalar_chr(profile[[1L]]$payload$pie, ""),
    "Hombre 2.*Mujer 2"
  )
  expect_equal(.graficos_scalar_chr(profile[[1L]]$payload$izquierda$args$overrides$nota_pie, "x"), "")
  expect_equal(.graficos_scalar_chr(profile[[1L]]$payload$izquierda$args$overrides$leyenda_posicion, ""), "derecha")
  expect_length(sex_specs, 1L)
  expect_equal(.graficos_scalar_chr(sex_specs[[1L]]$graficador, ""), "p_pie")
})

test_that("catalogo ACNUR define tres pares territoriales sin agregarlos", {
  pairs <- .graficos_acnur_koica_pairs()

  expect_equal(vapply(pairs, `[[`, character(1), "label"), c("Lima Norte", "Lima Este", "Lima Sur"))
  expect_equal(vapply(pairs, function(x) x$intervention$distrito, character(1)), c(
    "San Martín de Porres", "San Juan de Lurigancho", "Chorrillos"
  ))
  expect_equal(vapply(pairs, function(x) x$comparison$distrito, character(1)), c(
    "Los Olivos", "Ate", "San Juan de Miraflores"
  ))
  expect_true(all(vapply(pairs, function(x) length(x$districts) == 2L, logical(1))))
})

test_that("plan ACNUR pagina categorias extensas sin perder opciones", {
  choices <- lapply(seq_len(13), function(i) {
    list(name = paste0("c", i), label = paste("Categoria", i))
  })

  pages <- .graficos_acnur_choice_pages(list(choices = choices), max_per_slide = 8L)

  expect_length(pages, 2L)
  expect_equal(vapply(pages, `[[`, integer(1), "page"), 1:2)
  expect_equal(vapply(pages, `[[`, integer(1), "pages"), c(2L, 2L))
  expect_true(all(c("c9", "Categoria 9", "c13", "Categoria 13") %in% pages[[1]]$exclude_options))
  expect_true(all(c("c1", "Categoria 1", "c7", "Categoria 7") %in% pages[[2]]$exclude_options))
  expect_equal(.graficos_acnur_page_subtitle("Lima Norte", pages[[1]]), "Lima Norte · 1 de 2")
  expect_equal(.graficos_acnur_page_subtitle("Lima Norte", pages[[2]]), "Lima Norte · 2 de 2")
})

test_that("paginacion ACNUR trata Otro y Otros como la misma categoria", {
  choices <- lapply(seq_len(13), function(i) {
    if (i == 13L) return(list(name = "96", label = "Otro"))
    list(name = paste0("c", i), label = paste("Categoria", i))
  })

  pages <- .graficos_acnur_choice_pages(list(choices = choices), max_per_slide = 8L)

  expect_true(all(c("Otro", "Otros", "Otra", "Otras", "Other", "Others") %in% pages[[1]]$exclude_options))
  expect_false(any(c("Otro", "Otros", "Otra", "Otras", "Other", "Others") %in% pages[[2]]$exclude_options))
})

test_that("plan ACNUR compara cada pregunta por tres pares de dos distritos", {
  sid <- .graficos_acnur_test_session()
  on.exit(session_delete(sid), add = TRUE)

  suggested <- .graficos_suggested_plan(
    sid,
    config = list(
      profile_id = "acnur_kobo_cruncher_plus",
      acnur_mode = "territorial",
      include_coverage_maps = FALSE,
      comparison_mode = "paired_district"
    )
  )
  specs <- .graficos_plan_graph_specs(suggested$plan)
  paired <- Filter(function(graf) {
    args <- graf$args %||% list()
    filters <- args$filtros %||% list()
    identical(args$cruces %||% "", "__district") && length(filters$`__district` %||% character(0)) == 2L
  }, specs)

  expect_length(paired, 6L)
  filters <- lapply(paired, function(graf) unname((graf$args$filtros %||% list())$`__district`))
  expected <- lapply(.graficos_acnur_koica_pairs(), `[[`, "districts")
  expect_equal(filters[1:3], expected)
  expect_equal(filters[4:6], expected)
  expect_equal(
    vapply(paired[1:3], function(graf) (graf$args$overrides %||% list())$subtitulo %||% "", character(1)),
    c("Lima Norte", "Lima Este", "Lima Sur")
  )
  expect_true(all(vapply(paired, function(graf) {
    overrides <- graf$args$overrides %||% list()
    colors <- overrides$colores_series %||% character(0)
    identical(unname(colors), c("#0072BC", "#00A98F")) &&
      isTRUE(graf$args$mostrar_ceros) &&
      identical(overrides$minimo_cero_visual %||% 0, 0.005) &&
      identical(overrides$color_fondo %||% "", "#FFFFFF") &&
      identical(overrides$unidad_base %||% "", "personas") &&
      isTRUE(overrides$base_por_grupo) &&
      isTRUE(overrides$invertir_series) &&
      isTRUE(overrides$invertir_leyenda) &&
      identical(overrides$legend_espaciado %||% 0, 5)
  }, logical(1))))
  expect_false("__koica_group" %in% .graficos_collect_plan_refs(suggested$plan))
})

test_that("plan ACNUR/Kobo coloca mapas al inicio y omite variables no graficables", {
  sid <- .graficos_acnur_test_session()
  on.exit(session_delete(sid), add = TRUE)
  .graficos_acnur_seed_territorial_capabilities(sid)

  suggested <- .graficos_suggested_plan(
    sid,
    config = list(
      profile_id = "acnur_kobo_cruncher_plus",
      acnur_mode = "territorial",
      include_coverage_maps = TRUE,
      comparison_mode = "paired_district"
    )
  )
  slides <- suggested$plan$slides
  map_idx <- which(vapply(slides, function(slide) {
    graf <- (slide$payload %||% list())$grafico %||% list()
    identical(graf$graficador, "p_mapa_cobertura_territorial")
  }, logical(1)))
  section_idx <- which(vapply(slides, function(slide) identical(slide$tipo, "p_slide_seccion"), logical(1)))
  refs <- .graficos_collect_plan_refs(suggested$plan)
  visible_text <- paste(unlist(lapply(slides, function(slide) {
    payload <- (slide %||% list())$payload %||% list()
    graf <- payload$grafico %||% list()
    args <- graf$args %||% list()
    contexto <- args$contexto %||% list()
    list(payload$titulo, payload$texto, payload$filas, args$titulo, contexto$titulo,
         contexto$district_labels)
  }), use.names = FALSE), collapse = " ")

  expect_equal(map_idx, 5L)
  map_args <- ((slides[[map_idx]]$payload %||% list())$grafico %||% list())$args %||% list()
  map_payload <- slides[[map_idx]]$payload %||% list()
  expect_identical((map_args$contexto %||% list())$titulo %||% "", "")
  expect_identical((map_args$contexto %||% list())$subtitle %||% "", "")
  expect_false(isTRUE((map_args$contexto %||% list())$mostrar_titulo %||% TRUE))
  expect_identical(((map_args$overrides %||% list())$titulo %||% ""), "")
  expect_equal((map_payload$meta %||% list())$plot_extra_height_cm, 0)
  map_plot <- graficar_mapa_cobertura_territorial(contexto = map_args$contexto %||% list())
  expect_identical(attr(map_plot, "pulso_mapa_layout"), "overview_zoom_pair_key")
  expect_false(isTRUE(attr(map_plot, "pulso_mapa_has_inset")))
  expect_identical(attr(map_plot, "pulso_mapa_pair_count"), 3L)
  expect_identical(attr(map_plot, "pulso_mapa_district_count"), 6L)
  expect_length((map_args$contexto %||% list())$study_districts %||% list(), 6L)
  expect_true(length(section_idx) > 0L)
  expect_true(max(map_idx) < min(section_idx))
  expect_true("__district" %in% refs)
  expect_false("__koica_group" %in% refs)
  expect_false(any(c("intro_note", "calc_score", "gps_raw", "email") %in% refs))
  expect_false(grepl("KOICA", visible_text, ignore.case = TRUE))
  expect_match(visible_text, "ACNUR territorial")
  expect_match(visible_text, "Lima Norte")
  expect_match(visible_text, "San Martín de Porres.*Los Olivos")
})

test_that("plan ACNUR/Kobo omite mapas territoriales si faltan Hojas de Ruta o Monitoreo", {
  sid <- .graficos_acnur_test_session()
  on.exit(session_delete(sid), add = TRUE)

  suggested <- .graficos_suggested_plan(
    sid,
    config = list(
      profile_id = "acnur_kobo_cruncher_plus",
      acnur_mode = "territorial",
      include_coverage_maps = TRUE,
      comparison_mode = "paired_district"
    )
  )
  map_count <- sum(vapply(suggested$plan$slides, function(slide) {
    graf <- (slide$payload %||% list())$grafico %||% list()
    identical(graf$graficador, "p_mapa_cobertura_territorial")
  }, logical(1)))

  expect_equal(map_count, 0L)
  expect_match(paste(unlist(suggested$warnings), collapse = " "), "Hojas de Ruta")
  expect_match(paste(unlist(suggested$warnings), collapse = " "), "Monitoreo territorial")
})

test_that("plan ACNUR/Kobo respeta opciones explicitas de mapas y comparativo", {
  sid <- .graficos_acnur_test_session()
  on.exit(session_delete(sid), add = TRUE)

  suggested <- .graficos_suggested_plan(
    sid,
    config = list(
      profile_id = "acnur_kobo_cruncher_plus",
      acnur_mode = "territorial",
      include_coverage_maps = FALSE,
      comparison_mode = "none"
    )
  )
  refs <- .graficos_collect_plan_refs(suggested$plan)
  map_count <- sum(vapply(suggested$plan$slides, function(slide) {
    graf <- (slide$payload %||% list())$grafico %||% list()
    identical(graf$graficador, "p_mapa_cobertura_territorial")
  }, logical(1)))

  expect_equal(map_count, 0L)
  expect_false("__koica_group" %in% refs)
  expect_false("__district" %in% refs)
  expect_true(is.list(suggested$report_inputs))
  expect_false(suggested$report_inputs$map_included)
  expect_equal(suggested$report_inputs$comparison_mode, "none")
  expect_setequal(
    vapply(suggested$report_inputs$derived_variables, `[[`, character(1), "name"),
    c("__district", "__territory_pair")
  )
  expect_identical(suggested$report_inputs$profile, list(available = FALSE))
})
