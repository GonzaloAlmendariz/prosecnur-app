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

test_that("template XLSForm logic can be applied to siblings added later", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  write_xlsform <- function(path, survey, choices) {
    wb <- openxlsx::createWorkbook()
    openxlsx::addWorksheet(wb, "survey")
    openxlsx::writeData(wb, "survey", survey)
    openxlsx::addWorksheet(wb, "choices")
    openxlsx::writeData(wb, "choices", choices)
    openxlsx::addWorksheet(wb, "settings")
    openxlsx::writeData(wb, "settings", data.frame(form_title = "Ingenieria", form_id = "ing", stringsAsFactors = FALSE))
    openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  }
  write_data <- function(path, df) {
    wb <- openxlsx::createWorkbook()
    openxlsx::addWorksheet(wb, "data")
    openxlsx::writeData(wb, "data", df)
    openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  }
  save_local <- function(sid, kind, name, path) {
    save_upload(sid, kind, name, readBin(path, "raw", n = file.info(path)$size))
  }

  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  template_survey <- data.frame(
    type = c("select_one yesno", "text", "text", "select_multiple work", "text"),
    name = c("p1", "p2", "p3", "p27", "p27_other"),
    label = c("Continuar", "Comentario", "Solo Civil", "Actividad", "Otros"),
    relevant = c("", "${p1} = '1'", "${missing_var} = '1'", "", "selected(${p27}, '9')"),
    constraint = c("", "string-length(${p2}) > 0", "", "", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  target_survey <- data.frame(
    type = c("select_one yesno", "text", "select_multiple work", "text"),
    name = c("p1", "p2", "p27", "p27_other"),
    label = c("Continuar", "Comentario", "Actividad", "Otros"),
    relevant = c("", "", "", ""),
    constraint = c("", "", "", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  template_choices <- data.frame(
    list_name = c("yesno", "yesno", "work", "work"),
    name = c("1", "0", "8", "9"),
    label = c("Si", "No", "No trabaja", "Otros"),
    stringsAsFactors = FALSE
  )
  target_choices <- data.frame(
    list_name = c("yesno", "yesno", "work", "work"),
    name = c("1", "0", "8", "9"),
    label = c("Si", "No", "Otros", "No trabaja"),
    stringsAsFactors = FALSE
  )
  data_df <- data.frame(p1 = "1", p2 = "ok", p27 = "8", p27_other = "docente", stringsAsFactors = FALSE)

  template_xlsx <- tempfile(fileext = ".xlsx")
  target_xlsx <- tempfile(fileext = ".xlsx")
  data_xlsx <- tempfile(fileext = ".xlsx")
  write_xlsform(template_xlsx, template_survey, template_choices)
  write_xlsform(target_xlsx, target_survey, target_choices)
  write_data(data_xlsx, data_df)

  template_xmeta <- save_local(sid, "xlsform", "civil.xlsx", template_xlsx)
  target_xmeta <- save_local(sid, "xlsform", "industrial.xlsx", target_xlsx)
  template_dmeta <- save_local(sid, "data", "civil_data.xlsx", data_xlsx)
  target_dmeta <- save_local(sid, "data", "industrial_data.xlsx", data_xlsx)
  template_inst <- reporte_instrumento(path = template_xmeta$path)
  target_inst <- reporte_instrumento(path = target_xmeta$path)
  template_data <- normalize_data_for_xlsform(data_df, template_inst)
  target_data <- normalize_data_for_xlsform(data_df, target_inst)

  estudio_set_processing_mode(sid, "independent_siblings")
  estudio_add_base(
    sid,
    nombre = "ingenieria_civil",
    xlsform_file_id = template_xmeta$file_id,
    data_file_id = template_dmeta$file_id,
    data_ext = "xlsx",
    rp_data = reporte_data(template_data, instrumento = template_inst),
    rp_inst = template_inst,
    n_filas = nrow(template_data),
    n_columnas = ncol(template_data),
    extra_meta = list(processing_mode = "independent_siblings", source_alias = "Ingenieria Civil")
  )
  estudio_add_base(
    sid,
    nombre = "ingenieria_industrial",
    xlsform_file_id = target_xmeta$file_id,
    data_file_id = target_dmeta$file_id,
    data_ext = "xlsx",
    rp_data = reporte_data(target_data, instrumento = target_inst),
    rp_inst = target_inst,
    n_filas = nrow(target_data),
    n_columnas = ncol(target_data),
    extra_meta = list(processing_mode = "independent_siblings", source_alias = "Ingenieria Industrial")
  )
  estudio_mark_independent_shared_logic(sid, template_base = "ingenieria_civil", status = "template_ready")

  result <- estudio_apply_template_xlsform_logic(
    sid,
    template_base = "ingenieria_civil",
    targets = "ingenieria_industrial"
  )

  expect_true(result$ok)
  expect_equal(result$template_base, "ingenieria_civil")
  expect_equal(result$n_updated_bases, 1L)
  expect_equal(result$results[[1]]$n_applied_variables, 2L)
  expect_equal(result$results[[1]]$skipped_missing_variables[[1]], "p3")
  expect_equal(result$results[[1]]$n_remapped_choices, 1L)

  s <- session_get(sid)
  target_meta <- s$estudio$bases$ingenieria_industrial
  expect_false(identical(target_meta$xlsform_file_id, target_xmeta$file_id))
  expect_equal(target_meta$data_file_id, target_dmeta$file_id)
  expect_equal(target_meta$logic_template_base, "ingenieria_civil")
  expect_equal(s$estudio$independent_siblings$logic_sync$kind, "xlsform_logic")

  updated_meta <- get_file(sid, target_meta$xlsform_file_id)
  updated_survey <- as.data.frame(readxl::read_excel(updated_meta$path, sheet = "survey", .name_repair = "minimal"), stringsAsFactors = FALSE)
  expect_equal(updated_survey$relevant[updated_survey$name == "p2"], "${p1} = '1'")
  expect_equal(updated_survey$constraint[updated_survey$name == "p2"], "string-length(${p2}) > 0")
  expect_equal(updated_survey$relevant[updated_survey$name == "p27_other"], "selected(${p27}, '8')")
  expect_false("p3" %in% updated_survey$name)
})
