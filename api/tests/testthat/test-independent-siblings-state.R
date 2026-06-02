library(testthat)

test_that("independent siblings scope processing sources to the active base", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  inst_civil <- list(
    survey = data.frame(name = "p1", type = "text", label = "Civil", stringsAsFactors = FALSE),
    choices = data.frame()
  )
  inst_industrial <- list(
    survey = data.frame(name = "p2", type = "text", label = "Industrial", stringsAsFactors = FALSE),
    choices = data.frame()
  )
  data_civil <- data.frame(p1 = "a", stringsAsFactors = FALSE)
  data_industrial <- data.frame(p2 = "b", stringsAsFactors = FALSE)

  estudio_set_processing_mode(sid, "independent_siblings")
  estudio_add_base(
    sid,
    nombre = "ingenieria_civil",
    xlsform_file_id = "xls-civil",
    data_file_id = "data-civil",
    data_ext = "xlsx",
    rp_data = data_civil,
    rp_inst = inst_civil,
    n_filas = 1L,
    n_columnas = 1L
  )
  estudio_add_base(
    sid,
    nombre = "ingenieria_industrial",
    xlsform_file_id = "xls-industrial",
    data_file_id = "data-industrial",
    data_ext = "xlsx",
    rp_data = data_industrial,
    rp_inst = inst_industrial,
    n_filas = 1L,
    n_columnas = 1L
  )

  expect_equal(estudio_processing_mode(sid), "independent_siblings")
  expect_equal(estudio_active_base(sid), "ingenieria_civil")
  scoped <- estudio_processing_filter_sources(sid)
  expect_equal(names(scoped$data_sources), "ingenieria_civil")
  expect_equal(names(scoped$inst_sources), "ingenieria_civil")

  estudio_active_base_set(sid, "ingenieria_industrial")
  expect_equal(codif_source_active(sid), "ingenieria_industrial")
  scoped <- estudio_processing_filter_sources(sid)
  expect_equal(names(scoped$data_sources), "ingenieria_industrial")
  expect_equal(names(scoped$inst_sources), "ingenieria_industrial")
})

test_that("existing projects can be promoted to independent siblings without losing caches", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  inst <- list(
    survey = data.frame(name = "p1", type = "text", label = "Civil", stringsAsFactors = FALSE),
    choices = data.frame()
  )
  data <- data.frame(p1 = "a", stringsAsFactors = FALSE)

  estudio_add_base(
    sid,
    nombre = "default",
    xlsform_file_id = "xls-civil",
    data_file_id = "data-civil",
    data_ext = "xlsx",
    rp_data = data,
    rp_inst = inst,
    n_filas = 1L,
    n_columnas = 1L
  )
  session_set(sid, "analitica_rp_data_sources", list(default = data))
  session_set(sid, "analitica_rp_inst_sources", list(default = inst))
  session_set(sid, "analitica_fuente", "adaptados")

  estudio_promote_independent_siblings(
    sid,
    active_base = "default",
    nombre_nuevo = "ingenieria_civil",
    source_title = "Ingeniería Civil"
  )

  s <- session_get(sid)
  expect_equal(estudio_processing_mode(sid), "independent_siblings")
  expect_equal(estudio_active_base(sid), "ingenieria_civil")
  expect_true("ingenieria_civil" %in% names(s$estudio$bases))
  expect_false("default" %in% names(s$estudio$bases))
  expect_equal(names(s$analitica_rp_data_sources), "ingenieria_civil")
  expect_equal(names(s$analitica_rp_inst_sources), "ingenieria_civil")
  expect_equal(s$analitica_fuente, "adaptados:ingenieria_civil")
  expect_equal(s$estudio$bases$ingenieria_civil$source_title, "Ingeniería Civil")
  expect_equal(s$estudio$bases$ingenieria_civil$processing_mode, "independent_siblings")
})

test_that("shared codification logic can be propagated from a template base", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  inst <- list(
    survey = data.frame(name = "p1", type = "text", label = "Civil", stringsAsFactors = FALSE),
    choices = data.frame()
  )
  data <- data.frame(p1 = "a", stringsAsFactors = FALSE)

  estudio_set_processing_mode(sid, "independent_siblings")
  estudio_add_base(
    sid,
    nombre = "ingenieria_civil",
    xlsform_file_id = "xls-civil",
    data_file_id = "data-civil",
    data_ext = "xlsx",
    rp_data = data,
    rp_inst = inst,
    n_filas = 1L,
    n_columnas = 1L
  )
  estudio_add_base(
    sid,
    nombre = "ingenieria_minas",
    xlsform_file_id = "xls-minas",
    data_file_id = "data-minas",
    data_ext = "xlsx",
    rp_data = data,
    rp_inst = inst,
    n_filas = 1L,
    n_columnas = 1L
  )

  session_set(sid, "codif_por_base", list(
    ingenieria_civil = list(
      familias_draft = list(rows = list(list(parent = "p1", use = TRUE))),
      grupos_recod = list(p1 = list(list(code = "1", label = "Grupo"))),
      familias_split = list(stale = TRUE),
      familias_xlsx_path = "/tmp/stale.xlsx"
    )
  ))
  copied <- estudio_propagate_shared_codif_logic(
    sid,
    template_base = "ingenieria_civil",
    targets = "ingenieria_minas",
    overwrite = TRUE
  )

  s <- session_get(sid)
  expect_equal(copied, "ingenieria_minas")
  expect_equal(s$codif_por_base$ingenieria_minas$shared_logic_from, "ingenieria_civil")
  expect_null(s$codif_por_base$ingenieria_minas$familias_split)
  expect_null(s$codif_por_base$ingenieria_minas$familias_xlsx_path)
  expect_equal(s$codif_por_base$ingenieria_minas$grupos_recod$p1[[1]]$label, "Grupo")
})

test_that("independent sibling analytics and graphics config stay scoped by active base", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  inst <- list(
    survey = data.frame(name = "p1", type = "text", label = "Civil", stringsAsFactors = FALSE),
    choices = data.frame()
  )
  data <- data.frame(p1 = "a", stringsAsFactors = FALSE)

  estudio_set_processing_mode(sid, "independent_siblings")
  estudio_add_base(
    sid,
    nombre = "ingenieria_civil",
    xlsform_file_id = "xls-civil",
    data_file_id = "data-civil",
    data_ext = "xlsx",
    rp_data = data,
    rp_inst = inst,
    n_filas = 1L,
    n_columnas = 1L
  )
  estudio_add_base(
    sid,
    nombre = "ingenieria_industrial",
    xlsform_file_id = "xls-industrial",
    data_file_id = "data-industrial",
    data_ext = "xlsx",
    rp_data = data,
    rp_inst = inst,
    n_filas = 1L,
    n_columnas = 1L
  )

  .graficos_config_set(sid, .graficos_normalize_config(list(
    plan = list(slides = list(list(id = "civil-cover", tipo = "p_slide_portada", payload = list()))),
    presets = list()
  ), sid = sid))
  cfg_civil <- .analitica_default_config()
  cfg_civil$secciones <- list(list(id = "sec-civil", nombre = "Civil", variables = list("p1")))
  .analitica_config_set(sid, cfg_civil)
  .analitica_status_set(sid, "analitica_prep_ok", TRUE)
  .graficos_status_set(sid, "graficos_ppt_ok", TRUE)

  estudio_active_base_set(sid, "ingenieria_industrial")
  expect_length(.graficos_config_get(sid)$plan$slides, 0)
  expect_length(.analitica_config_get(sid)$secciones, 0)
  s <- session_get(sid)
  expect_false(isTRUE(s$analitica_prep_ok))
  expect_false(isTRUE(s$graficos_ppt_ok))

  .graficos_config_set(sid, .graficos_normalize_config(list(
    plan = list(slides = list(list(id = "industrial-cover", tipo = "p_slide_portada", payload = list()))),
    presets = list()
  ), sid = sid))

  estudio_active_base_set(sid, "ingenieria_civil")
  expect_equal(.graficos_config_get(sid)$plan$slides[[1]]$id, "civil-cover")
  expect_equal(.analitica_config_get(sid)$secciones[[1]]$id, "sec-civil")
  s <- session_get(sid)
  expect_true(isTRUE(s$analitica_prep_ok))
  expect_true(isTRUE(s$graficos_ppt_ok))

  estudio_active_base_set(sid, "ingenieria_industrial")
  expect_equal(.graficos_config_get(sid)$plan$slides[[1]]$id, "industrial-cover")
  expect_length(.analitica_config_get(sid)$secciones, 0)
})

test_that("SurveyMonkey independent response filters keep collector and cutoff metadata", {
  responses <- list(
    list(id = "r1", response_status = "completed", collector_id = "campo", date_modified = "2026-05-01T10:00:00+00:00"),
    list(id = "r2", response_status = "completed", collector_id = "campo", date_modified = "2026-05-01T23:30:00+00:00"),
    list(id = "r3", response_status = "completed", collector_id = "prueba", date_modified = "2026-05-01T10:00:00+00:00"),
    list(id = "r4", response_status = "partial", collector_id = "campo", date_modified = "2026-05-01T10:00:00+00:00")
  )

  filtered <- .sm_mb_filter_responses(
    responses,
    statuses = "completed",
    collector_ids = "campo",
    date_modified_lte = "2026-05-01T10:30:00+00:00"
  )
  info <- attr(filtered, "sm_response_filter", exact = TRUE)

  expect_length(filtered, 1)
  expect_equal(filtered[[1]]$id, "r1")
  expect_equal(info$original_rows, 4L)
  expect_equal(info$kept_rows, 1L)
  expect_equal(info$excluded_rows, 3L)
  expect_equal(unlist(info$collector_ids), "campo")
  expect_equal(info$date_modified_lte, "2026-05-01T10:30:00+00:00")
})

test_that("independent sibling specs can group multiple SurveyMonkey campaigns", {
  specs <- .sm_mb_normalize_survey_specs(list(list(
    survey_id = "principal",
    label = "Ingeniería Geológica",
    date_modified_lte = "2026-05-30T01:27:45+00:00",
    sources = list(
      list(survey_id = "principal", collector_id = "campo"),
      list(
        survey_id = "alterna",
        label = "Ingeniería Geológica campaña 2",
        response_statuses = c("completed", "partial")
      )
    )
  )))

  expect_length(specs, 1)
  expect_equal(specs[[1]]$survey_id, "principal")
  expect_length(specs[[1]]$sources, 2)
  expect_equal(specs[[1]]$sources[[1]]$collector_ids, "campo")
  expect_equal(specs[[1]]$sources[[2]]$survey_id, "alterna")
  expect_equal(specs[[1]]$sources[[2]]$response_statuses, c("completed", "partial"))
  expect_length(specs[[1]]$sources[[2]]$collector_ids, 0)
})
