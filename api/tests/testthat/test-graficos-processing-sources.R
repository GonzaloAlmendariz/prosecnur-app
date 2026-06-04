library(testthat)

if (!exists("session_create", mode = "function")) {
  setup_path <- if (file.exists("setup-load-all.R")) {
    "setup-load-all.R"
  } else {
    file.path("tests", "testthat", "setup-load-all.R")
  }
  source(setup_path)
}

test_that("graficos recupera la fuente single-base cuando rp_data_sources quedo invalido", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  inst <- list(
    survey = data.frame(
      name = "p1_recod",
      type = "select_one lst_p1",
      label = "Pregunta recodificada",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "lst_p1",
      name = "1",
      label = "Categoria",
      stringsAsFactors = FALSE
    )
  )
  data <- data.frame(p1_recod = "1", stringsAsFactors = FALSE)

  estudio_add_base(
    sid,
    nombre = "default",
    xlsform_file_id = "xls-demo",
    data_file_id = "data-demo",
    data_ext = "xlsx",
    rp_data = data,
    rp_inst = inst,
    n_filas = 1L,
    n_columnas = 1L
  )

  s <- session_get(sid)
  s$rp_data <- data
  s$rp_inst <- inst
  s$rp_data_sources <- list(default = list(no_es_data_frame = TRUE))
  s$rp_inst_sources <- list(default = inst)
  .session_env[[sid]] <- s

  sources <- .graficos_processing_sources(sid)

  expect_equal(names(sources$data_sources), "default")
  expect_s3_class(sources$data_sources$default, "data.frame")
  expect_equal(sources$data_sources$default$p1_recod, "1")
  expect_no_error(.require_rp_data(sid))
})

test_that("graficos no deja pasar una lista invalida hasta reporte_ppt_plan", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  session_set(sid, "rp_data_sources", list(default = list(no_es_data_frame = TRUE)))
  session_set(sid, "rp_inst_sources", list(default = list(survey = NULL)))

  sources <- .graficos_processing_sources(sid)
  expect_length(sources$data_sources, 0)
  expect_length(sources$inst_sources, 0)

  err <- tryCatch(
    {
      .require_rp_data(sid)
      NULL
    },
    error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_NO_VALID_RP_DATA")
})
