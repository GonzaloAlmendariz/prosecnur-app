# Regresión G2 (CCSS Perfil 2026-II): `p_cifra` no aceptaba una select_multiple (`A12_recod`).
#
# La madre de una SM no existe en la data: sólo sus dummies `A12_recod.<código>`. La cifra se calcula sobre la dummy de
# la categoría y la base son los casos que tienen alguna dummy respondida.

data_sm <- data.frame(
  A12_recod.1 = c(1, 0, 1, NA, 0),
  A12_recod.3 = c(1, 1, 0, NA, 0),
  check.names = FALSE
)
inst_sm <- list(
  survey = data.frame(type = "select_multiple lst_a12", name = "A12_recod", stringsAsFactors = FALSE),
  orders_list = list(A12_recod = list(names = c("1", "3"), labels = c("Biblioteca", "Laboratorio")))
)

test_that("el porcentaje de una categoría de una SM sale sobre quienes respondieron", {
  out <- prosecnurapp:::.cifra_desde_datos(data_sm, "A12_recod", "porcentaje", categoria = "3", rotulo = "Laboratorio")
  # 4 casos respondieron (el cuarto tiene todo NA); 2 marcaron la opción 3.
  expect_equal(out$valor, "50%")
  expect_equal(out$base, 4L)
  expect_equal(out$detalle, "2 de 4")
})

test_that("la categoría de una SM también se casa por su etiqueta", {
  out <- prosecnurapp:::.cifra_desde_datos(data_sm, "A12_recod", "porcentaje", categoria = "Biblioteca",
                                           instrumento = inst_sm, rotulo = "Biblioteca")
  expect_equal(out$valor, "50%")
})

test_that("una SM da su n de respuestas y rechaza la media con un mensaje claro", {
  expect_equal(prosecnurapp:::.cifra_desde_datos(data_sm, "A12_recod", "n", rotulo = "x")$valor, "4")
  expect_error(prosecnurapp:::.cifra_desde_datos(data_sm, "A12_recod", "media", rotulo = "x"), "opción múltiple")
  expect_error(prosecnurapp:::.cifra_desde_datos(data_sm, "A12_recod", "porcentaje", categoria = "9", rotulo = "x"),
               "no es una opción")
})
