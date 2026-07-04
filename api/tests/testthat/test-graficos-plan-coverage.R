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
  expect_equal(
    as.character(data$`__koica_group`[1:3]),
    c("Intervencion territorial", "Comparacion territorial", "Comparacion territorial")
  )
  expect_false("__koica_group" %in% vapply(vars, `[[`, character(1), "name"))
  expect_false("__district" %in% vapply(vars, `[[`, character(1), "name"))
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
      comparison_mode = "koica_group"
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
    list(payload$titulo, payload$texto, args$titulo, contexto$titulo)
  }), use.names = FALSE), collapse = " ")

  expect_equal(map_idx, 4:10)
  expect_true(length(section_idx) > 0L)
  expect_true(max(map_idx) < min(section_idx))
  expect_true("__koica_group" %in% refs)
  expect_false(any(c("intro_note", "calc_score", "gps_raw", "email") %in% refs))
  expect_false(grepl("KOICA", visible_text, ignore.case = TRUE))
  expect_match(visible_text, "ACNUR territorial")
  expect_match(visible_text, "Comparacion territorial")
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
      comparison_mode = "koica_group"
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
})
