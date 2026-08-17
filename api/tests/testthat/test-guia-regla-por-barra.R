# «Que la guia coja la regla y te la ponga barra por barra y te diga cuanto esta
# midiendo cada una». La nota de la caja canta UN grosor, y una cifra unica no
# puede desmentirse a si misma: si dos barras difieren, la nota sigue cantando
# un solo numero.

test_that("cada barra recibe su cota cuando difieren", {
  g <- .guia_regla_por_barra(c(0.2, 0.5, 0.8), c(0.08, 0.08, 0.12), alto_in = 6)
  # 4 grobs por barra: linea, topes, halo y cifra.
  expect_equal(length(g), 3L * 4L)
})


test_that("con las barras iguales la regla NO aparece", {
  # Repetir cinco veces la misma cifra sobre los porcentajes es ruido: la guia
  # estorbaria en vez de medir. La nota de la caja ya lo dice una vez.
  expect_length(.guia_regla_por_barra(c(0.2, 0.5, 0.8), 0.08, alto_in = 6), 0L)
})


test_that("el umbral de aparicion es el mismo que usa B3", {
  # Medio milimetro: por debajo es redondeo del render y por encima se ve. Si
  # los dos valores divergen, la guia y la vara dirian cosas distintas sobre la
  # misma lamina.
  expect_equal(.GUIA_REGLA_DISPERSION_MIN_CM, 0.05)
})


test_that("una diferencia por debajo del umbral no dispara la regla", {
  # 0.02 cm sobre un canvas de 6 in.
  g <- 0.08
  delta <- 0.02 / 2.54 / 6
  expect_length(
    .guia_regla_por_barra(c(0.3, 0.7), c(g, g + delta), alto_in = 6), 0L
  )
})


test_that("una barra sola se acota igual", {
  # No hay con que compararla, pero su medida sigue siendo el dato que se busca.
  expect_length(.guia_regla_por_barra(0.5, 0.08, alto_in = 6), 4L)
})


test_that("con las barras amontonadas la regla se retira", {
  # Las cifras se montarian unas sobre otras y dejaria de leerse, que es lo
  # contrario de lo que viene a hacer. El limite sale del cuerpo de la cifra.
  y <- seq(0.05, 0.95, length.out = 90)
  g <- rep(0.006, 90); g[1] <- 0.01
  expect_length(.guia_regla_por_barra(y, g, alto_in = 6), 0L)
})


test_that("hasta cuarenta barras todavia se acota", {
  y <- seq(0.05, 0.95, length.out = 40)
  g <- rep(0.015, 40); g[1] <- 0.019
  expect_gt(length(.guia_regla_por_barra(y, g, alto_in = 6)), 0L)
})


test_that("lo ausente no rompe y no borra lo que si se sabe", {
  # Con una barra ilegible se acota la otra: descartar la medida buena por no
  # tener la de al lado seria perder el dato que se busca.
  expect_length(.guia_regla_por_barra(c(0.2, 0.8), c(0.08, NA), 6), 4L)
})


test_that("sin nada que medir no se dibuja nada", {
  expect_length(.guia_regla_por_barra(numeric(0), 0.08, 6), 0L)
  expect_length(.guia_regla_por_barra(c(0.2, 0.8), 0.08, NA_real_), 0L)
  # Grosores y centros que no casan: no se puede saber cual es de cual.
  expect_length(.guia_regla_por_barra(c(0.2, 0.8), c(0.08, 0.09, 0.1), 6), 0L)
})
