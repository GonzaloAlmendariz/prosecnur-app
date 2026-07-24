test_that("el copy metodológico de Aulas acentúa caídas en todas sus salidas", {
  sources <- prosecnurapp:::.cm_aulas_methodological_sources()
  nonresponse <- prosecnurapp:::.cm_aulas_nonresponse_template(list(
    nonresponse_policy = "disposition_codes_and_adjustments"
  ))

  source_copy <- paste(sources$implicancia_prosecnur, collapse = " ")
  nonresponse_copy <- paste(nonresponse$regla, collapse = " ")

  expect_match(source_copy, "Monitoreo mide caídas y sesgos")
  expect_match(nonresponse_copy, "si hay caídas diferenciales")
  expect_false(grepl("\\bcaidas\\b", source_copy, ignore.case = TRUE))
  expect_false(grepl("\\bcaidas\\b", nonresponse_copy, ignore.case = TRUE))
})
