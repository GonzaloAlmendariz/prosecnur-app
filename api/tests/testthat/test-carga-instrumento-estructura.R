test_that("estructura_instrumento conserva filas calculate y expone formula", {
  inst <- list(
    survey = data.frame(
      type = c("integer", "calculate"),
      type_base = c("integer", "calculate"),
      name = c("edad", "edad_doble"),
      label = c("Edad", "Edad doble"),
      required = c("yes", ""),
      relevant = c("", ""),
      constraint = c("", ""),
      calculation = c("", "${edad} * 2"),
      choice_filter = c("", ""),
      appearance = c("", ""),
      hint = c("", ""),
      list_name = c("", ""),
      group_name = c("datos", "datos"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = character(),
      name = character(),
      label = character(),
      stringsAsFactors = FALSE
    ),
    meta = list(
      section_map = data.frame(
        group_name = "datos",
        group_label = "Datos",
        is_repeat = FALSE,
        is_conditional = FALSE,
        group_relevant = NA_character_,
        prefix = "",
        stringsAsFactors = FALSE
      )
    )
  )

  out <- estructura_instrumento(inst)
  names <- vapply(out$preguntas, `[[`, character(1), "name")

  expect_equal(names, c("edad", "edad_doble"))
  expect_identical(out$preguntas[[2]]$tipo, "calculate")
  expect_true(out$preguntas[[2]]$calculate)
  expect_equal(out$preguntas[[2]]$calculation_expr, "${edad} * 2")

  resumen <- summarize_instrumento(inst)
  expect_equal(resumen$n_preguntas, 1L)
  expect_equal(resumen$n_calculos, 1L)
  expect_equal(resumen$n_filas_survey, 2L)
  expect_equal(.carga_data_survey_names(inst), c("edad", "edad_doble"))
})

test_that("estructura_instrumento extrae list_name desde type sin columna list_name", {
  inst <- list(
    survey = data.frame(
      type = "select_one lst_p1",
      type_base = "select_one",
      name = "p1",
      label = "Pregunta 1",
      required = "yes",
      relevant = "",
      constraint = "",
      calculation = "",
      choice_filter = "",
      appearance = "",
      hint = "",
      group_name = "datos",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_p1", "lst_p1"),
      name = c("1", "2"),
      label = c("Sí", "No"),
      stringsAsFactors = FALSE
    ),
    meta = list(section_map = data.frame())
  )

  out <- estructura_instrumento(inst)

  expect_equal(out$preguntas[[1]]$list_name, "lst_p1")
  expect_equal(vapply(out$preguntas[[1]]$choices, `[[`, character(1), "label"), c("Sí", "No"))
})
