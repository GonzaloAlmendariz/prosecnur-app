.smruf_write_xlsx <- function(data, sheet) {
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, sheet)
  openxlsx::writeData(wb, sheet, data)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.smruf_fixture <- function() {
  sid <- session_create()
  initial <- data.frame(
    testreal = c("real", "real", "test"),
    value = 1:3,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  survey <- data.frame(
    type = c("text", "integer"),
    name = c("testreal", "value"),
    label = c("Tipo de entrevista", "Valor"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  choices <- data.frame(
    list_name = character(), name = character(), label = character(),
    stringsAsFactors = FALSE
  )
  data_path <- .smruf_write_xlsx(initial, "datos")
  inst_path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", survey)
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", choices)
  openxlsx::saveWorkbook(wb, inst_path, overwrite = TRUE)

  data_meta <- save_upload(
    sid, "data", "sm_inicial.xlsx",
    readBin(data_path, "raw", n = file.info(data_path)$size)
  )
  inst_meta <- save_upload(
    sid, "xlsform", "sm_formulario.xlsx",
    readBin(inst_path, "raw", n = file.info(inst_path)$size)
  )
  rp_inst <- reporte_instrumento(inst_meta$path)
  estudio_ensure(sid)
  estudio_add_base(
    sid, "sm_base", inst_meta$file_id, data_meta$file_id, "xlsx",
    reporte_data(initial, instrumento = rp_inst), rp_inst,
    nrow(initial), ncol(initial),
    extra_meta = list(source_kind = "surveymonkey_api", survey_id = "survey-1")
  )
  list(sid = sid, inst_meta = inst_meta, rp_inst = rp_inst)
}

.smruf_refresh <- function(fixture, refreshed) {
  data_path <- .smruf_write_xlsx(refreshed, "datos")
  data_meta <- save_upload(
    fixture$sid, "data", "sm_refresh.xlsx",
    readBin(data_path, "raw", n = file.info(data_path)$size)
  )
  .sm_mb_update_base_refresh_files(
    sid = fixture$sid,
    base_name = "sm_base",
    inst_meta = fixture$inst_meta,
    data_meta = data_meta,
    rp_inst = fixture$rp_inst,
    rp_data = reporte_data(refreshed, instrumento = fixture$rp_inst),
    spec = list(survey_id = "survey-1", source_alias = "Base SM"),
    response_filter = list(kind = "surveymonkey_response_filter"),
    source_kind = "surveymonkey_api",
    n_new = 1L
  )
  data_meta
}

test_that("refresh SurveyMonkey reaplica universe_filter sobre la fuente nueva", {
  skip_if_not_installed("openxlsx")
  fixture <- .smruf_fixture()
  on.exit(session_delete(fixture$sid), add = TRUE)
  config <- list(
    version = 1L,
    enabled = TRUE,
    variable = "testreal",
    real_values = list("real"),
    test_values = list("test"),
    missing_policy = "exclude",
    unassigned_policy = "unclassified"
  )
  carga_universe_filter_apply(fixture$sid, "sm_base", config)
  before <- session_get(fixture$sid)$estudio$bases$sm_base
  expect_equal(before$universe_filter$audit$included, 2L)

  refreshed <- data.frame(
    testreal = c("real", "real", "test", "test"),
    value = 1:4,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  source_meta <- .smruf_refresh(fixture, refreshed)
  s <- session_get(fixture$sid)
  base <- s$estudio$bases$sm_base

  expect_equal(base$original_data_file_id, source_meta$file_id)
  expect_equal(base$universe_filter$source_data_file_id, source_meta$file_id)
  expect_equal(base$data_file_id, base$universe_filter$effective_data_file_id)
  expect_false(identical(base$data_file_id, source_meta$file_id))
  expect_equal(nrow(.cuf_file_df(s, source_meta$file_id)$data), 4L)
  expect_equal(nrow(.cuf_file_df(s, base$data_file_id)$data), 2L)
  expect_equal(base$universe_filter$audit, list(
    total = 4L,
    included = 2L,
    excluded_test = 2L,
    excluded_unclassified = 0L
  ))
  expect_equal(base$n_filas, 2L)
})

test_that("refresh SurveyMonkey revierte la sesion si universe_filter no puede reaplicarse", {
  skip_if_not_installed("openxlsx")
  fixture <- .smruf_fixture()
  on.exit(session_delete(fixture$sid), add = TRUE)
  config <- list(
    version = 1L,
    enabled = TRUE,
    variable = "testreal",
    real_values = list("real"),
    test_values = list("test"),
    missing_policy = "exclude",
    unassigned_policy = "unclassified"
  )
  carga_universe_filter_apply(fixture$sid, "sm_base", config)
  before <- session_get(fixture$sid)
  before_base <- before$estudio$bases$sm_base
  before_rp_data <- before$rp_data_sources$sm_base

  only_tests <- data.frame(
    testreal = rep("test", 4L),
    value = 1:4,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  expect_error(
    .smruf_refresh(fixture, only_tests),
    "no incluye ninguna entrevista real",
    class = "api_error"
  )

  after <- session_get(fixture$sid)
  expect_identical(after$estudio$bases$sm_base, before_base)
  expect_identical(after$rp_data_sources$sm_base, before_rp_data)
  expect_identical(after$rp_data, before$rp_data)
  expect_equal(after$estudio$bases$sm_base$data_file_id,
               before_base$universe_filter$effective_data_file_id)
})

test_that("decision apply SurveyMonkey revierte todo si universe_filter falla", {
  skip_if_not_installed("openxlsx")
  fixture <- .smruf_fixture()
  on.exit(session_delete(fixture$sid), add = TRUE)
  config <- list(
    version = 1L,
    enabled = TRUE,
    variable = "testreal",
    real_values = list("real"),
    test_values = list("test"),
    missing_policy = "exclude",
    unassigned_policy = "unclassified"
  )
  carga_universe_filter_apply(fixture$sid, "sm_base", config)
  before <- session_get(fixture$sid)
  decision_data <- data.frame(
    testreal = rep("test", 4L),
    value = 1:4,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  testthat::local_mocked_bindings(
    .sm_mb_build_effective_from_snapshot = function(...) list(
      data = decision_data,
      inst = fixture$rp_inst,
      policy = list(version = 1L),
      audit = list(included = as.integer(nrow(decision_data)))
    ),
    .package = "prosecnurapp"
  )

  expect_error(
    sm_multibase_decision_apply(fixture$sid, "sm_base"),
    "no incluye ninguna entrevista real",
    class = "api_error"
  )
  after_error <- session_get(fixture$sid)
  expect_identical(after_error$estudio$bases$sm_base,
                   before$estudio$bases$sm_base)
  expect_identical(after_error$rp_data_sources$sm_base,
                   before$rp_data_sources$sm_base)
  expect_identical(after_error$rp_data, before$rp_data)
  expect_identical(after_error$files, before$files)

  decision_data <- data.frame(
    testreal = c("real", "test"),
    value = 1:2,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  applied <- sm_multibase_decision_apply(fixture$sid, "sm_base")
  after_success <- session_get(fixture$sid)$estudio$bases$sm_base
  expect_true(applied$ok)
  expect_equal(after_success$universe_filter$source_data_file_id,
               applied$generated_file_id)
  expect_equal(after_success$data_file_id,
               after_success$universe_filter$effective_data_file_id)
  expect_equal(after_success$universe_filter$audit$included, 1L)
})

test_that("refresh SurveyMonkey sin universe_filter conserva la ruta directa", {
  skip_if_not_installed("openxlsx")
  fixture <- .smruf_fixture()
  on.exit(session_delete(fixture$sid), add = TRUE)
  refreshed <- data.frame(
    testreal = c("real", "real", "test", "test"),
    value = 1:4,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  source_meta <- .smruf_refresh(fixture, refreshed)
  base <- session_get(fixture$sid)$estudio$bases$sm_base

  expect_equal(base$data_file_id, source_meta$file_id)
  expect_equal(base$original_data_file_id, source_meta$file_id)
  expect_null(base$universe_filter)
  expect_equal(base$n_filas, 4L)
})
