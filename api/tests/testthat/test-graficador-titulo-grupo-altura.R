source("setup-load-all.R")

# `cowplot::draw_text` dibuja centrado y NO recorta: un titulo mas alto que su
# bloque invade los vecinos. Con enunciados completos como nombre de tema —el
# caso de la matriz de equivalencias— los titulos de tres bloques seguidos se
# escribian unos encima de otros y la columna izquierda quedaba ilegible.

test_that("el titulo se recorta a las lineas que su bloque sostiene", {
  titulo <- paste(paste0("linea", 1:12), collapse = "\n")
  # Un bloque de una barra sostiene tres lineas, no doce.
  corto <- .barras_acotar_titulo_grupo(titulo, n_filas = 1L)
  lineas <- strsplit(corto, "\n", fixed = TRUE)[[1]]
  expect_lt(length(lineas), 12L)
  # El corte se marca: un titulo que termina a media frase sin senal se lee como
  # un dato incompleto, no como un texto acortado.
  expect_true(endsWith(corto, "…"))
  # Las lineas que quedan son las primeras, en orden.
  expect_equal(lineas[1], "linea1")

  expect_equal(length(strsplit(corto, "\n", fixed = TRUE)[[1]]), 3L)
  # Un bloque de cuatro barras lo aguanta entero y no se toca.
  expect_equal(.barras_acotar_titulo_grupo(titulo, 4L), titulo)
})

test_that("siempre queda al menos una linea", {
  # Un bloque sin titulo no dice de que habla; es peor que uno recortado.
  titulo <- paste(paste0("l", 1:9), collapse = "\n")
  corto <- .barras_acotar_titulo_grupo(titulo, n_filas = 1L, lineas_por_fila = 0L)
  expect_equal(length(strsplit(corto, "\n", fixed = TRUE)[[1]]), 1L)
  expect_true(nzchar(corto))
})

test_that("lo que ya cabe pasa intacto", {
  expect_equal(.barras_acotar_titulo_grupo("Un tema corto", 1L), "Un tema corto")
  expect_equal(.barras_acotar_titulo_grupo("", 1L), "")
  expect_equal(.barras_acotar_titulo_grupo(NA, 1L), "")
  # Un numero de filas invalido no puede tumbar el dibujo: cuenta como una.
  expect_equal(.barras_acotar_titulo_grupo("a\nb\nc", NA), "a\nb\nc")
})

test_that("un bloque con mas barras sostiene mas titulo", {
  titulo <- paste(paste0("l", 1:20), collapse = "\n")
  n <- function(k) length(strsplit(.barras_acotar_titulo_grupo(titulo, k), "\n")[[1]])
  expect_equal(n(1L), 3L)
  expect_equal(n(2L), 6L)
  expect_gt(n(3L), n(2L))
})

test_that("un bloque de una sola barra tambien se acota", {
  # Medir la distancia entre la primera y la ultima categoria daba CERO en un
  # bloque de una barra, que el guard leia como «alto invalido» y dejaba pasar
  # el titulo entero — justo el caso donde invade a los vecinos: una diapositiva
  # con siete temas de un solo publico.
  titulo <- paste(paste0("l", 1:10), collapse = "\n")
  corto <- .barras_acotar_titulo_grupo(titulo, n_filas = 1L)
  expect_equal(length(strsplit(corto, "\n", fixed = TRUE)[[1]]), 3L)
})
