# L36 · DOC.0b — el papel deja de imprimir marcos vacíos y bloques de la
# plataforma (docs/qa/l36-doc0-direccion-cuestionario-2026-11-01.md).

.doc0b_survey <- function() {
  data.frame(
    type = c(
      "begin_group", "text", "text", "end_group",
      "begin_group", "select_one acuerdo", "select_one acuerdo", "end_group",
      "begin_group", "integer", "end_group"
    ),
    name = c(
      "survey_monkey_metadata", "respondent_id", "collector_id", "",
      "grp_p8", "p8_1", "p8_2", "",
      "grp_edad", "p9", ""
    ),
    label = c(
      "Metadata SurveyMonkey", "respondent_id", "collector_id", "",
      NA, "Servicio de Salud", "Bienestar", "",
      "Datos generales", "¿Cuántos años tiene?", ""
    ),
    stringsAsFactors = FALSE
  )
}

.doc0b_choices <- function() {
  data.frame(list_name = "acuerdo", name = c("1", "2"), label = c("Sí", "No"), stringsAsFactors = FALSE)
}

test_that("un grupo sin nada que decir no dibuja banda de sección (D-L36-2)", {
  model <- formulario_pdf_build_model(.doc0b_survey(), .doc0b_choices(), list(form_title = "Prueba"))
  secciones <- Filter(function(b) identical(b$kind, "section"), model$blocks)
  titulos <- vapply(secciones, function(b) b$title %||% "", character(1))
  expect_false(any(!nzchar(trimws(titulos))))
  expect_true("Datos generales" %in% titulos)
})

test_that("los bloques de la plataforma no se imprimen y queda el aviso (D-L36-1)", {
  model <- formulario_pdf_build_model(.doc0b_survey(), .doc0b_choices(), list(form_title = "Prueba"))
  nombres <- unlist(lapply(model$blocks, function(b) {
    c(b$name %||% character(0), vapply(b$items %||% list(), function(it) it$name %||% "", character(1)))
  }))
  expect_false(any(c("respondent_id", "collector_id", "survey_monkey_metadata") %in% nombres))
  expect_true(any(grepl("Bloques de la plataforma.*Metadata SurveyMonkey", model$warnings)))
})

test_that("una sección sin título pero repetible o con pista se conserva", {
  expect_true(.form_pdf_seccion_dice_algo(list(title = "", repeatable = TRUE)))
  expect_true(.form_pdf_seccion_dice_algo(list(title = "", hint = "Responda por cada hijo")))
  expect_false(.form_pdf_seccion_dice_algo(list(title = "  ", hint = NA, skip = "", opening_condition = "")))
})
