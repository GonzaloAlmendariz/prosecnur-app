# `boxplot` y `media_rango` componen igual: acumulan `pieces` y `relh` y los
# apilan de una sola vez. Los dos se conformaban con un marco alrededor del
# CONJUNTO —una linea que no mide nada nuevo, porque el canvas entero ya se ve—
# en vez de la cota de cada banda, que es lo que hay que poder comprobar.

test_that("cada banda recibe SU alto, no el del canvas", {
  skip_if_not_installed("cowplot")
  g <- ggplot2::ggplot(data.frame(x = 1, y = 1), ggplot2::aes(x, y)) + ggplot2::geom_point()
  altos <- c()
  tr <- function(ancho_in, alto_in, ...) { altos <<- c(altos, alto_in); g }
  with_mocked_bindings(
    .guia_envolver_bloque = tr,
    .guia_envolver_bandas(list(g, g, g), c(0.2, 0.6, 0.2),
                          ancho_in = 8, alto_in = 5),
    .package = "prosecnurapp"
  )
  expect_equal(altos, c(1, 3, 1))
})


test_that("las proporciones se normalizan: `relh` no tiene por que sumar 1", {
  skip_if_not_installed("cowplot")
  g <- ggplot2::ggplot(data.frame(x = 1, y = 1), ggplot2::aes(x, y)) + ggplot2::geom_point()
  altos <- c()
  tr <- function(ancho_in, alto_in, ...) { altos <<- c(altos, alto_in); g }
  with_mocked_bindings(
    .guia_envolver_bloque = tr,
    .guia_envolver_bandas(list(g, g), c(3, 1), ancho_in = 8, alto_in = 4),
    .package = "prosecnurapp"
  )
  expect_equal(altos, c(3, 1))
})


test_that("una lista y unas alturas que no casan se devuelven intactas", {
  # Antes que acotar mal, no acotar: una banda con el alto de otra miente.
  g <- ggplot2::ggplot(data.frame(x = 1, y = 1), ggplot2::aes(x, y)) + ggplot2::geom_point()
  ps <- list(g, g, g)
  expect_identical(.guia_envolver_bandas(ps, c(0.5, 0.5), 8, 5), ps)
  expect_identical(.guia_envolver_bandas(list(), numeric(0), 8, 5), list())
})


test_that("alturas que suman cero no dividen entre cero", {
  g <- ggplot2::ggplot(data.frame(x = 1, y = 1), ggplot2::aes(x, y)) + ggplot2::geom_point()
  ps <- list(g, g)
  expect_identical(.guia_envolver_bandas(ps, c(0, 0), 8, 5), ps)
  expect_identical(.guia_envolver_bandas(ps, c(NA, NA), 8, 5), ps)
})


test_that("una lista de etiquetas corta no tumba las demas bandas", {
  # La banda sin nombre se queda con su marco y su medida.
  skip_if_not_installed("cowplot")
  g <- ggplot2::ggplot(data.frame(x = 1, y = 1), ggplot2::aes(x, y)) + ggplot2::geom_point()
  out <- .guia_envolver_bandas(list(g, g, g), c(1, 2, 1), 8, 5,
                               etiquetas = c("cabecera"))
  expect_length(out, 3L)
  expect_s3_class(out[[3]], "ggplot")
})
