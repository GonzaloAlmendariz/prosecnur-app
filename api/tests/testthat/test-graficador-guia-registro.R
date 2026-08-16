test_that("la primera caja de una banda escribe en su sitio", {
  nivel <- .guia_registro_notas()
  expect_equal(nivel(0.90), 0L)
})


test_that("dos cajas que comparten borde superior no escriben en la misma banda", {
  # El defecto real: la nota del panel y la del area de barras arrancaban en el
  # mismo `top` y se montaban una sobre otra.
  nivel <- .guia_registro_notas()
  expect_equal(nivel(0.90), 0L)
  expect_equal(nivel(0.90), 1L)
  expect_equal(nivel(0.90), 2L)
})


test_that("cajas separadas conservan el nivel cero", {
  nivel <- .guia_registro_notas()
  expect_equal(nivel(0.95), 0L)
  expect_equal(nivel(0.50), 0L)
  expect_equal(nivel(0.10), 0L)
})


test_that("dos laminas no comparten bandas", {
  # El registro es estado de una lamina. Si fuera del proceso, la segunda
  # lamina empezaria bajando notas sin motivo.
  a <- .guia_registro_notas(); b <- .guia_registro_notas()
  expect_equal(a(0.90), 0L)
  expect_equal(b(0.90), 0L)
})


test_that("un top no finito no desplaza ni ocupa banda", {
  nivel <- .guia_registro_notas()
  expect_equal(nivel(NA_real_), 0L)
  expect_equal(nivel(NULL), 0L)
  expect_equal(nivel(0.90), 0L)
})


test_that("el desplazamiento tiene tope y no se va de la caja", {
  nivel <- .guia_registro_notas()
  for (k in 1:10) nivel(0.90)
  expect_lte(nivel(0.90), 7L)
})
