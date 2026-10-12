test_that("cada base lleva su palabra; sin palabra propia queda el nombre de la base", {
  old <- options(prosecnur.base_sufijos = NULL)
  on.exit(options(old))
  expect_identical(.base_sufijo_de_fuente("estudiantes"), "estudiantes")
  prev <- .base_sufijos_fijar(list(base = list(sufijo_por_base = list(estudiantes = " alumnos ", docentes = "", egresados = NULL))))
  expect_identical(.base_sufijo_de_fuente("estudiantes"), "alumnos")
  expect_identical(.base_sufijo_de_fuente("docentes"), "docentes")
  expect_identical(.base_sufijo_de_fuente("egresados"), "egresados")
  options(prev)
  expect_identical(.base_sufijo_de_fuente("estudiantes"), "estudiantes")
})

test_that("sin palabras declaradas no toca nada", {
  expect_identical(.base_sufijos_fijar(list(base = list(formato = "Base: %s"))), list())
  expect_identical(.base_sufijos_fijar(list()), list())
})
