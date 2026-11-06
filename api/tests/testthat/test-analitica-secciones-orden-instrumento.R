# Las secciones detectadas del instrumento siguen el orden del cuestionario.
#
# Sin secciones configuradas, Frecuencias toma las páginas del instrumento. Con
# nombres de página tipo SurveyMonkey (PAG1, PAG2, …, PAG10) el detector las
# devolvía en orden alfabético —PAG1, PAG10, PAG11, …, PAG2— y el anexo de
# frecuencias de Arte 2026 salía con las preguntas desordenadas (2026-11-04).

test_that("las secciones automáticas respetan el orden del cuestionario, no el alfabético", {
  paginas <- c("PAG1", "PAG2", "PAG3", "PAG10", "PAG11")
  rp_inst <- list(survey = data.frame(
    name = c("p1", "p2", "p3", "p10", "p11", "p11b"),
    group_name = c(paginas, "PAG11"),
    stringsAsFactors = FALSE
  ))

  secs <- .secciones_desde_instrumento(rp_inst)

  expect_identical(names(secs), paginas)
  expect_identical(secs[["PAG11"]], c("p11", "p11b"))
})

test_that("una variable sin grupo cae en «general» en el lugar donde aparece", {
  rp_inst <- list(survey = data.frame(
    name = c("p1", "gedad", "p2"),
    group_name = c("PAG2", NA, "PAG10"),
    stringsAsFactors = FALSE
  ))

  expect_identical(names(.secciones_desde_instrumento(rp_inst)), c("PAG2", "general", "PAG10"))
})
