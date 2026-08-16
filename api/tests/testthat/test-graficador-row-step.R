test_that("con muchas categorias el paso no se infla", {
  expect_equal(.apiladas_row_step(5, 8), 1)
  expect_equal(.apiladas_row_step(10, 9), 1)
})


test_that("con etiquetas cortas tampoco se infla", {
  expect_equal(.apiladas_row_step(3, 4), 1)
  expect_equal(.apiladas_row_step(2, 1), 1)
})


test_that("pocas categorias con etiquetas largas inflan el paso", {
  # La condicion real del graficador: n <= 4 y al menos 5 lineas de etiqueta.
  expect_gt(.apiladas_row_step(3, 5), 1)
  expect_equal(.apiladas_row_step(3, 5), 1.16 + 5 * 0.28)
})


test_that("el inflado tiene tope", {
  expect_equal(.apiladas_row_step(2, 40), 3.20)
})


test_that("las etiquetas arriba suben el paso base", {
  expect_equal(.apiladas_row_step(6, 2, etiquetas_arriba = TRUE), 1.72)
  # Y el inflado nunca deja el paso por debajo de su base.
  expect_gte(.apiladas_row_step(3, 5, etiquetas_arriba = TRUE), 1.72)
})


test_that("un dato no numerico devuelve el paso base", {
  expect_equal(.apiladas_row_step(NA, 5), 1)
  expect_equal(.apiladas_row_step(3, NULL), 1)
})


test_that("el paso comun es el MAYOR de los bloques", {
  # El caso de «Mecanismos de admision»: un bloque infla y el otro no. Con el
  # menor, la etiqueta del que infla se queda sin sitio.
  expect_equal(.apiladas_row_step_comun(c(1, 2.56)), 2.56)
  expect_equal(.apiladas_row_step_comun(list(1, 1)), 1)
})


test_that("sin pasos utilizables no se fuerza nada", {
  # `NULL` significa «que cada bloque decida», que es el comportamiento previo.
  expect_null(.apiladas_row_step_comun(numeric(0)))
  expect_null(.apiladas_row_step_comun(c(NA, NA)))
  expect_null(.apiladas_row_step_comun(c(0, -1)))
})
