# Un subcapítulo de la app entra al Word como sección N.M, no como capítulo propio (decisión de Gonzalo, 2026-10-15).

test_that("el nivel explícito manda; si no, el subcapítulo es nivel 2 y el resto capítulo", {
  expect_identical(.word_nivel_seccion(list()), 1L)
  expect_identical(.word_nivel_seccion(NULL), 1L)
  expect_identical(.word_nivel_seccion(list(nivel = "capitulo")), 1L)
  expect_identical(.word_nivel_seccion(list(nivel = "subcapitulo")), 2L)
  expect_identical(.word_nivel_seccion(list(nivel = list("subcapitulo"))), 2L)   # escalar de Plumber
  expect_identical(.word_nivel_seccion(list(nivel = "subcapitulo", word_heading_level = 1)), 1L)
  expect_identical(.word_nivel_seccion(list(word_heading_level = 2)), 2L)
  expect_identical(.word_nivel_seccion(list(word_heading_level = "x", nivel = "subcapitulo")), 2L)
})
