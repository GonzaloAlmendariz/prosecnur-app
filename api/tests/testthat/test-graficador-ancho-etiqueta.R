test_that("sin ancho fisico no se inventa una medida", {
  # NULL significa «quedate con la estimacion de siempre». Devolver 0 haria que
  # toda etiqueta cupiera dentro, que es justo el defecto que se repara.
  expect_null(.ancho_etiqueta_por_fisica(5, 3, NA_real_))
  expect_null(.ancho_etiqueta_por_fisica(5, 3, 0))
  expect_null(.ancho_etiqueta_por_fisica(5, 3, -2))
})


test_that("una lamina completa conserva la estimacion calibrada", {
  # El umbral es 9 in: por encima, el panel es ancho y la constante por caracter
  # ya estaba bien. Cambiarlo ahi moveria etiquetas de decenas de laminas sanas.
  expect_null(.ancho_etiqueta_por_fisica(5, 3, 12.5))
  expect_null(.ancho_etiqueta_por_fisica(5, 3, 9))
  expect_false(is.null(.ancho_etiqueta_por_fisica(5, 3, 8.9)))
})


test_that("en un cuarto de lamina la etiqueta mide mas que la estimacion vieja", {
  # El caso real: '16.9%' son 5 caracteres a cuerpo 3 en un cajon de 6.1 in.
  # La estimacion vieja daba 0.075 y por eso la cifra entraba en una barra de
  # 0.169 sin caber.
  a <- .ancho_etiqueta_por_fisica(5, 3, 6.1, w_etiquetas = 0.38, base_max = 1)
  expect_true(a > 0.075)
  expect_true(a < 1)
})


test_that("mas caracteres miden mas, y a igual texto un cuerpo mayor mide mas", {
  chico <- .ancho_etiqueta_por_fisica(c(3, 6), 3, 6.1)
  expect_true(chico[[2]] > chico[[1]])
  grande <- .ancho_etiqueta_por_fisica(5, 4.5, 6.1)
  normal <- .ancho_etiqueta_por_fisica(5, 3, 6.1)
  expect_true(grande > normal)
})


test_that("un cajon mas angosto hace que el mismo texto pese mas", {
  ancho <- .ancho_etiqueta_por_fisica(5, 3, 8)
  angosto <- .ancho_etiqueta_por_fisica(5, 3, 4)
  expect_true(angosto > ancho)
})


test_that("nunca devuelve mas que el maximo del eje", {
  # Un texto larguisimo en un cajon minusculo no puede declarar que necesita
  # mas del 100% del eje: el consumidor lo compara contra valores del eje.
  a <- .ancho_etiqueta_por_fisica(200, 6, 2, base_max = 1)
  expect_lte(a, 1)
  b <- .ancho_etiqueta_por_fisica(200, 6, 2, base_max = 0.4)
  expect_lte(b, 0.4)
})


test_that("el resultado escala con el maximo del eje", {
  uno <- .ancho_etiqueta_por_fisica(5, 3, 6.1, base_max = 1)
  medio <- .ancho_etiqueta_por_fisica(5, 3, 6.1, base_max = 0.5)
  expect_equal(medio, uno * 0.5, tolerance = 1e-9)
})


test_that("una fraccion de etiquetas absurda cae al valor por defecto", {
  ok <- .ancho_etiqueta_por_fisica(5, 3, 6.1, w_etiquetas = 0.38)
  expect_equal(.ancho_etiqueta_por_fisica(5, 3, 6.1, w_etiquetas = 1.4), ok)
  expect_equal(.ancho_etiqueta_por_fisica(5, 3, 6.1, w_etiquetas = 0), ok)
})
