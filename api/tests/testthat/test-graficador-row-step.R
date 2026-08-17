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


test_that("el piso de una fila procede solo si el bloque esta solo", {
  # El piso editorial sube al 0.95 la barra de un bloque de una fila, que sin el
  # sale al ~22 % del panel. Correcto cuando esa barra es lo unico de la lamina;
  # en una multilista la deja gorda al lado de vecinas al 0.78.
  expect_true(.apiladas_piso_una_fila_procede(1))
  expect_false(.apiladas_piso_una_fila_procede(2))
  expect_false(.apiladas_piso_una_fila_procede(4))
})


test_that("sin dato de bloques se conserva el comportamiento previo", {
  # Quitar el piso por no saber cuantos bloques hay devolveria la barra
  # enclenque que ese piso vino a arreglar.
  expect_true(.apiladas_piso_una_fila_procede(NULL))
  expect_true(.apiladas_piso_una_fila_procede(NA))
  expect_true(.apiladas_piso_una_fila_procede("x"))
})


test_that("el salto que produce el piso es el 1.20x medido", {
  # Los grosores fisicos del mazo son las combinaciones de los tres altos de
  # fila declarados por las DOS fracciones. Ese cociente es lo que separa las
  # laminas gemelas: 0.980 contra 1.173 cm, y 1.694 contra 2.068.
  expect_equal(.APILADAS_GROSOR_UNA_FILA / 0.78, 1.218, tolerance = 0.01)
})
