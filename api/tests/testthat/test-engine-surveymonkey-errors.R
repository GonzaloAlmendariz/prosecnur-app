# Tests de error handling de surveymonkey_leer.
# Verifica que entradas inválidas o vacías producen mensajes diagnósticos
# útiles en vez de errores opacos de haven::read_sav.

test_that("surveymonkey_leer rechaza un archivo que no es .sav", {
  bad_path <- tempfile(fileext = ".sav")
  on.exit(unlink(bad_path), add = TRUE)
  writeLines("esto no es un archivo SPSS", bad_path)

  expect_error(
    surveymonkey_leer(bad_path),
    regexp = "no pude leer.*sav",
    ignore.case = TRUE
  )
})

test_that("surveymonkey_leer rechaza un .sav sin filas con mensaje claro", {
  empty_sav <- tempfile(fileext = ".sav")
  on.exit(unlink(empty_sav), add = TRUE)
  haven::write_sav(data.frame(P1 = character(0), P2 = integer(0)), empty_sav)

  expect_error(
    surveymonkey_leer(empty_sav),
    regexp = "no tiene filas|al menos una respuesta",
    ignore.case = TRUE
  )
})

test_that("surveymonkey_leer rechaza ruta inexistente", {
  expect_error(
    surveymonkey_leer("/tmp/no-existe-jamas-9c1f.sav"),
    regexp = "No existe el archivo"
  )
})
