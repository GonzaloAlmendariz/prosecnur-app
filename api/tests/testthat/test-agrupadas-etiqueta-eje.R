# P42: la etiqueta de eje de dos lineas se monta sobre la fila vecina. En la
# lamina 13 del mazo de Conta —«Sueldo mensual bruto», cuatro paneles— «Entre
# 1500 y 3000 soles» parte en dos y su «soles» aterriza encima de «Entre 3001 y
# 4500», que se lee «Entre 3001 y 45soles».
#
# `barras_apiladas` lo resuelve con `needs_tall_label_slot`, que sube el alto de
# fila; `barras_agrupadas` no tiene NADA equivalente —cero apariciones contra
# diez—: envuelve la etiqueta y nunca mira el alto.

test_that("el numero de lineas sale del envoltorio real, no de dividir caracteres", {
  # `str_wrap` corta por PALABRAS, y por eso el conteo por caracteres se
  # equivoca en los dos sentidos. Medido sobre «Entre 1500 y 3000 soles», de 23
  # caracteres: con envoltorio 18 y con envoltorio 12 salen DOS lineas en los
  # dos casos —«Entre 1500 y» / «3000 soles»—, aunque la aritmetica dijera dos
  # y tres. Con 8 salen CUATRO, no tres: «Entre» / «1500 y» / «3000» / «soles».
  # Las dos expectativas de la primera version estaban mal, y las corrigio la
  # medicion —no al reves—.
  skip_if_not_installed("stringr")
  expect_equal(.agrupadas_lineas_eje("Entre 1500 y 3000 soles", 18), 2L)
  expect_equal(.agrupadas_lineas_eje("Entre 1500 y 3000 soles", 12), 2L)
  expect_equal(.agrupadas_lineas_eje("Entre 1500 y 3000 soles", 8), 4L)
  expect_equal(.agrupadas_lineas_eje("Entre 1500 y 3000 soles", 40), 1L)
})


test_that("se toma la etiqueta que MAS lineas produce, no la primera", {
  skip_if_not_installed("stringr")
  et <- c("Corta", "Entre 1500 y 3000 soles", "Otra")
  expect_equal(.agrupadas_lineas_eje(et, 18), 2L)
})


test_that("sin envoltorio no hay lineas que contar", {
  expect_equal(.agrupadas_lineas_eje("Lo que sea", NULL), 1L)
  expect_equal(.agrupadas_lineas_eje("Lo que sea", 0), 1L)
  expect_equal(.agrupadas_lineas_eje(character(0), 18), 1L)
})


test_that("una etiqueta de una sola linea no toca el cuerpo", {
  # El caso normal: no se encoge nada por si acaso.
  expect_equal(.agrupadas_size_que_cabe(13, 1, 6, alto_in = 6), 13)
})


test_that("varias lineas en una fila corta bajan el cuerpo hasta que caben", {
  # Tres lineas de 13 pt son 0.65 in; en un cajon de 3 in con 6 categorias la
  # fila da 0.31, asi que el texto tiene que ceder.
  s <- .agrupadas_size_que_cabe(13, 3, 6, alto_in = 3.0)
  expect_lt(s, 13)
  expect_gte(s, 8)
})


test_that("hay PISO: una etiqueta ilegible no es mejor que una solapada", {
  # Si ni al minimo cabe, se devuelve el minimo y el solape se ve —que es
  # informacion, no un fallo silencioso—.
  expect_equal(.agrupadas_size_que_cabe(13, 12, 10, alto_in = 2.0), 8)
})


test_that("sin datos utilizables se devuelve el cuerpo intacto", {
  expect_equal(.agrupadas_size_que_cabe(13, 3, 0, alto_in = 6), 13)
  expect_equal(.agrupadas_size_que_cabe(13, 3, 6, alto_in = NA), 13)
  expect_equal(.agrupadas_size_que_cabe(NA, 3, 6, alto_in = 6), NA)
})
