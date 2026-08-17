# La lamina metodologica del aprobado promete que «en los casos en que una
# pregunta presenta un numero de respuestas menor al total de la base, esta
# cifra se muestra directamente en el grafico». El motor emitia esa frase y
# tenia CERO anotaciones «N = …» dentro de graficos, contra ONCE del aprobado.

test_that("solo se anota la fila que NO cuadra con la base", {
  # Ese «solo» es lo que la hace util: en todas las filas seria ruido, y lo que
  # hay que ver es justo la que no cuadra con el pie.
  expect_equal(
    .n_barra_procede(c(178, 178, 12), n_base = 178),
    c(FALSE, FALSE, TRUE)
  )
})


test_that("una diferencia de un caso no se anota", {
  # Un caso sobre una base de 178 es redondeo del filtrado, no un salto del
  # cuestionario; el aprobado no lo anota.
  expect_false(.n_barra_procede(177, n_base = 178))
  expect_true(.n_barra_procede(176, n_base = 178))
})


test_that("una fila con MAS que la base no se anota", {
  # No es un salto del cuestionario: es un error de calculo, y anotarlo aqui lo
  # disfrazaria de nota metodologica en vez de dejarlo salir por donde debe.
  expect_false(.n_barra_procede(200, n_base = 178))
})


test_that("sin base utilizable no se anota nada", {
  expect_false(any(.n_barra_procede(c(10, 20), n_base = NA)))
  expect_false(any(.n_barra_procede(c(10, 20), n_base = 0)))
  expect_false(any(.n_barra_procede(c(10, 20), n_base = -5)))
})


test_that("una N ausente o cero no se anota", {
  expect_equal(
    .n_barra_procede(c(NA, 0, 12), n_base = 178),
    c(FALSE, FALSE, TRUE)
  )
})


test_that("el texto lleva el espacio a los dos lados del igual", {
  # El aprobado escribe «N= 178» y «N = 12»; se toma la forma espaciada, que es
  # la de su patron dominante —siete de sus once—.
  expect_equal(.n_barra_texto(12), "N = 12")
  expect_equal(.n_barra_texto(178), "N = 178")
})


test_that("una N con decimales se redondea: no hay medias respuestas", {
  expect_equal(.n_barra_texto(11.6), "N = 12")
})


test_that("una N ilegible da texto vacio en vez de «N = NA»", {
  expect_equal(.n_barra_texto(NA), "")
  expect_equal(.n_barra_texto("x"), "")
})


test_that("sin filas que anotar NO se devuelve capa", {
  # El caso normal. Devolver una capa vacia obligaria a cada consumidor a
  # comprobarla, y una capa de cero filas rompe algunos geoms.
  expect_null(.n_barra_capa(c(1, 2, 3), c(178, 178, 178), n_base = 178))
})


test_that("con filas que anotar se devuelve una capa de ggplot", {
  capa <- .n_barra_capa(c(1, 2, 3), c(178, 178, 12), n_base = 178)
  expect_s3_class(capa, "Layer")
  expect_equal(nrow(capa$data), 1L)
  expect_equal(capa$data$.lab, "N = 12")
})


test_that("la capa lleva el cuerpo y la cursiva del aprobado", {
  # 8 pt en cursiva. ggplot mide `size` en milimetros: a puntos, x 2.845.
  capa <- .n_barra_capa(c(1, 2), c(178, 12), n_base = 178)
  expect_equal(capa$aes_params$size * 2.845, .N_BARRA_SIZE_PT, tolerance = 0.01)
  expect_equal(capa$aes_params$fontface, "italic")
  expect_equal(capa$aes_params$family, "Arial")
})


test_that("posiciones y enes que no casan no producen capa", {
  expect_null(.n_barra_capa(c(1, 2), c(178, 12, 4), n_base = 178))
})
