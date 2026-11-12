# Subir la base de datos en lugar del formulario: el archivo no tiene hoja
# "survey". Respondía 500 E_INTERNAL y la pantalla no decía qué pasó.

test_that("un archivo sin hoja survey como formulario es un 400 que dice la causa", {
  dir <- withr::local_tempdir()
  base <- file.path(dir, "base_digitada.xlsx")
  openxlsx::write.xlsx(list(Datos = data.frame(id = 1:3, p1 = c(1, 2, 1))), base)

  err <- tryCatch(leer_instrumento_xlsform(base), error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_equal(err$status, 400)
  expect_identical(err$code, "E_XLSFORM_SURVEY_INVALIDO")
  expect_match(conditionMessage(err), "no tiene la hoja \"survey\"")
  expect_match(conditionMessage(err), "Datos")
})
