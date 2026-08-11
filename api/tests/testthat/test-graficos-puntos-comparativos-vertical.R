source("setup-load-all.R")

.pcv_inst <- function() {
  list(
    survey = data.frame(
      type = c("select_one respuesta", "select_one grupos", "decimal"),
      name = c("indicador", "grupo", "peso"),
      list_name = c("respuesta", "grupos", ""),
      label = c("Acceso a servicios", "Zona", "Peso"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("respuesta", "respuesta", "respuesta", "grupos", "grupos"),
      name = c("1", "2", "99", "B", "A"),
      label = c("Si", "No", "No sabe", "Grupo B", "Grupo A"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )
}

.pcv_data <- function() {
  data <- data.frame(
    indicador = c("1", "2", "1", "2"),
    grupo = c("A", "A", "B", "B"),
    peso = c(9, 1, 1, 1),
    stringsAsFactors = FALSE
  )
  attr(data, "var_peso") <- "peso"
  data
}

.pcv_plan <- function() {
  list(slides = list(list(
    id = "puntos-1",
    tipo = "p_slide_1_grafico",
    payload = list(
      titulo = "Comparacion territorial",
      grafico = list(
        graficador = "p_puntos_comparativos",
        args = list(var = "indicador", cruces = "grupo", corte = c("1", "2"))
      )
    )
  )))
}

.pcv_slide_registry <- function() {
  stats::setNames(
    lapply(.slide_names(), function(name) list(grafs = setdiff(.slide_slots(name), "icono"))),
    .slide_names()
  )
}


test_that("el mismo elemento se reconstruye y atraviesa jobs PPTX y DOCX reales", {
  skip_if_not_installed("ggplot2")
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  td <- tempfile("puntos_comparativos_vertical_")
  dir.create(td)
  on.exit(unlink(td, recursive = TRUE, force = TRUE), add = TRUE)
  test_env <- environment(.graficos_job_rebuild_slides)
  # `getExportedValue` es de base: en el CI el namespace del paquete esta
  # sellado por `R CMD INSTALL` y no admite bindings nuevos. La via canonica
  # de testthat mockea la funcion donde el rebuild la resuelve.
  testthat::local_mocked_bindings(
    getExportedValue = function(where, name) get(name, envir = test_env, inherits = TRUE),
    .package = "base"
  )
  local({
    plan <- .pcv_plan()
    qualified <- .graficos_calificar_refs_plan(plan, "principal")
    rebuilt <- .graficos_job_rebuild_slides(
      qualified,
      slide_registry = .pcv_slide_registry(),
      graficador_registry = .graf_names(),
      icon_registry = list()
    )
    elemento <- rebuilt[[1]]$slots$plot
    expect_s3_class(elemento, "ppt_element")
    expect_identical(elemento$.element_type, "puntos_comparativos")
    expect_identical(elemento$var, "principal$indicador")
    expect_identical(elemento$cruces, "principal$grupo")
    expect_identical(elemento$corte, c("1", "2"))

    data_path <- file.path(td, "data.rds")
    inst_path <- file.path(td, "inst.rds")
    saveRDS(list(principal = .pcv_data()), data_path)
    saveRDS(list(principal = .pcv_inst()), inst_path)

    pptx_path <- file.path(td, "puntos.pptx")
    pptx <- graficos_job_worker_ppt(
      rp_data_path = data_path,
      rp_inst_path = inst_path,
      plan = plan,
      presets = NULL,
      paletas = list(),
      slide_registry = .pcv_slide_registry(),
      graficador_registry = .graf_names(),
      icon_registry = list(),
      active_base = "principal",
      template_pptx = .graficos_resolve_template_pptx(config = list()),
      template_id = "generic_16_9",
      auto_otros_slides = FALSE,
      result_path = pptx_path,
      progress_path = file.path(td, "pptx-progress.json")
    )

    docx_path <- file.path(td, "puntos.docx")
    docx <- graficos_job_worker_word(
      rp_data_path = data_path,
      rp_inst_path = inst_path,
      plan = plan,
      presets = NULL,
      w_presets = NULL,
      paletas = list(),
      slide_registry = .pcv_slide_registry(),
      graficador_registry = .graf_names(),
      icon_registry = list(),
      active_base = "principal",
      result_path = docx_path,
      progress_path = file.path(td, "docx-progress.json")
    )

    expect_true(file.exists(pptx_path))
    expect_gt(file.info(pptx_path)$size, 0)
    expect_identical(pptx$n_slides, 1L)
    expect_length(officer::read_pptx(pptx_path), 1L)
    expect_true(file.exists(docx_path))
    expect_gt(file.info(docx_path)$size, 0)
    expect_identical(docx$n_slides, 1L)
  })
})
