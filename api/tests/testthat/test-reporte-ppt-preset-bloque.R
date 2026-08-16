test_that("un bloque de claves sueltas se envuelve en args", {
  out <- .preset_bloque_normalizado(list(grosor_barras = 1, canvas_w_bars = 0.6))
  expect_equal(out$args$grosor_barras, 1)
  expect_equal(out$args$canvas_w_bars, 0.6)
})


test_that("un bloque que ya viene en args se respeta", {
  x <- list(args = list(grosor_barras = 1))
  expect_identical(.preset_bloque_normalizado(x), x)
})


test_that("el bloque MIXTO no pierde las claves sueltas", {
  # El defecto real: la UI guarda las decisiones sueltas y ademas un `args`.
  # Al existir `args`, las ocho claves sueltas del preset de agrupadas de
  # Contabilidad se descartaban y el mazo salia con los defaults del motor.
  x <- list(
    grosor_barras = 1,
    canvas_w_bars = 0.595,
    alto_por_categoria = 1.024,
    args = list(preservar_tamanos_texto = TRUE)
  )
  out <- .preset_bloque_normalizado(x)
  expect_equal(out$args$grosor_barras, 1)
  expect_equal(out$args$canvas_w_bars, 0.595)
  expect_equal(out$args$alto_por_categoria, 1.024)
  expect_true(out$args$preservar_tamanos_texto)
  # Y ya no quedan claves sueltas fuera de `args`, que es lo unico que el
  # render mira.
  expect_equal(setdiff(names(out), "args"), character(0))
})


test_that("ante la misma clave en los dos sitios manda args", {
  x <- list(grosor_barras = 1, args = list(grosor_barras = 2))
  expect_equal(.preset_bloque_normalizado(x)$args$grosor_barras, 2)
})


test_that("NULL y bloque vacio dan un args vacio", {
  expect_equal(.preset_bloque_normalizado(NULL), list(args = list()))
  expect_equal(.preset_bloque_normalizado(list()), list(args = list()))
})


test_that("un bloque que no es lista se rechaza", {
  expect_error(.preset_bloque_normalizado("grosor"))
  expect_error(.preset_bloque_normalizado(list(args = "no es lista")))
})
