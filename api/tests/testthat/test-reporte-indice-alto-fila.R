alto_cm <- function(n, style = list()) {
  secs <- paste("Seccion", seq_len(n))
  .indice_fit_layout(style, "ÍNDICE", secs, data.frame())$row_height * 2.54
}


test_that("cinco secciones separan lo que separa el entregable aprobado", {
  # El aprobado va de una entrada a la siguiente en 1.71 cm: 1.38 de cuadro mas
  # 0.33 de hueco. En una tabla el hueco es un borde DENTRO de la fila, asi que
  # la fila mide el paso entero. La formula antigua daba 1.19 cm.
  expect_equal(alto_cm(5), 1.71, tolerance = 0.02)
})


test_that("con pocas secciones el alto no cambia", {
  # Cuatro o menos ya usaban 0.55 in; el arreglo no debia moverlas.
  expect_equal(alto_cm(3), 0.55 * 2.54, tolerance = 1e-9)
  expect_equal(alto_cm(4), 0.55 * 2.54, tolerance = 1e-9)
})


test_that("con muchas secciones el alto sigue bajando", {
  # El tope existe para que un indice largo quepa: subirlo no puede desactivar
  # esa reduccion.
  expect_lt(alto_cm(8), alto_cm(6))
  expect_lt(alto_cm(6), alto_cm(5))
  # El piso del ajuste por escala es 0.26 in, mas bajo que el del punto de
  # partida: un indice muy largo se comprime por debajo de 0.34.
  expect_gte(alto_cm(20), 0.26 * 2.54 - 1e-9)
})


test_that("el alto nunca supera el paso del aprobado", {
  for (n in 5:15) expect_lte(alto_cm(n), 0.68 * 2.54 + 1e-9)
})


test_that("un `row_height` declarado gana sobre el calculado", {
  # El proyecto tiene que poder fijarlo: el default es un punto de partida.
  expect_equal(alto_cm(5, list(row_height = 0.40)), 0.40 * 2.54, tolerance = 1e-9)
})
