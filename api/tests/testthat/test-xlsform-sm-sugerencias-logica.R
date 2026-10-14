# Sugerencias de lógica al importar desde SurveyMonkey (xlsform_sm_sugerencias_logica.R): la API no trae los saltos,
# pero el corte del consentimiento se reconoce y se SUGIERE. Sin red.

inst_desde_modelo <- function(survey, choices) {
  p <- tempfile(fileext = ".xlsx")
  .sm_mb_write_xlsform_model(list(survey = survey, choices = choices, settings = data.frame(form_title = "x")), p)
  reporte_instrumento(path = p)
}

choices_sino <- function(si = "Sí", no = "No", orden = c("si", "no")) {
  etiquetas <- c(si = si, no = no)[orden]
  data.frame(list_name = "lst_p1", name = as.character(seq_along(etiquetas)), `label::es` = unname(etiquetas),
             check.names = FALSE)
}

test_that("la pregunta de consentimiento se sugiere como fin de encuesta con la opción negativa", {
  inst <- inst_desde_modelo(
    data.frame(type = c("select_one lst_p1", "integer"), name = c("p1", "p2"),
               `label::es` = c("Hecha esta aclaración ¿desea continuar con la encuesta?", "¿Cuántos años tiene?"),
               check.names = FALSE),
    choices_sino()
  )
  s <- .xlsform_sm_sugerencia_consentimiento(inst)
  expect_identical(s$tipo, "fin_de_encuesta")
  expect_identical(s$variable, "p1")
  expect_identical(vapply(s$opciones_que_cortan, `[[`, "", "codigo"), "2")
})

test_that("el «no» se reconoce por la etiqueta aunque venga primero", {
  inst <- inst_desde_modelo(
    data.frame(type = "select_one lst_p1", name = "p1",
               `label::es` = "¿Acepta participar en la encuesta?", check.names = FALSE),
    choices_sino(si = "Sí, acepto", no = "No acepto", orden = c("no", "si"))
  )
  s <- .xlsform_sm_sugerencia_consentimiento(inst)
  expect_identical(vapply(s$opciones_que_cortan, `[[`, "", "etiqueta"), "No acepto")
  expect_identical(vapply(s$opciones_que_cortan, `[[`, "", "codigo"), "1")
})

test_that("sin pregunta de consentimiento no hay sugerencia", {
  inst <- inst_desde_modelo(
    data.frame(type = "select_one lst_p1", name = "p1", `label::es` = "¿Conoce la misión de la PUCP?", check.names = FALSE),
    choices_sino()
  )
  expect_null(.xlsform_sm_sugerencia_consentimiento(inst))
})

test_that("el endpoint avisa que la API no trae la lógica y entrega la sugerencia", {
  local_mocked_bindings(
    .connections_token_require = function(...) "tok",
    sm_api_fetch_survey_details = function(id, token, ...) list(id = id),
    .sm_mb_inst_generado = function(details, ...) inst_desde_modelo(
      data.frame(type = "select_one lst_p1", name = "p1", `label::es` = "¿Desea continuar con la encuesta?",
                 check.names = FALSE),
      choices_sino()
    )
  )
  r <- xlsform_sm_sugerencias_logica("sid", "123")
  expect_false(r$logica_disponible_en_api)
  expect_length(r$sugerencias, 1L)
  expect_match(r$aviso, "no comparte la lógica")
})
