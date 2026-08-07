source("setup-load-all.R")

# Medido con `debug_ph_bordes` sobre el mazo de equivalencias: el hueco de la
# lamina mide 6 pulgadas de alto y el canvas se armaba con 3.56, asi que el 41 %
# quedaba en blanco bajo el grafico. De ese sobrante, la leyenda se llevaba 0.75
# fijas para dibujar UNA linea de texto.

test_that("la banda de leyenda mide lo que sus filas, no un fijo", {
  escala <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo",
              "Totalmente de acuerdo", "SIN INF")
  # Ancha: la escala entra en una fila y la banda es minima.
  expect_equal(.barras_leyenda_filas(escala, 9, 12.5), 1L)
  ancha <- .barras_leyenda_alto_in(escala, 9, 12.5)
  # Estrecha: la misma escala necesita mas filas y la banda crece con ellas.
  estrecha <- .barras_leyenda_alto_in(escala, 9, 4)
  expect_gt(.barras_leyenda_filas(escala, 9, 4), 1L)
  expect_gt(estrecha, ancha)
  # Y en el caso ancho es bastante menor que el fijo que habia (0.75).
  expect_lt(ancha, 0.5)

  # Sin leyenda no hay banda.
  expect_equal(.barras_leyenda_alto_in(character(0), 9, 12.5), 0)
})

test_that("el sobrante del hueco fisico engorda las filas, con tope", {
  # 5 filas de 0.478 = 2.39 de panel en un hueco de 6: sobran casi dos pulgadas y
  # media. Se reparten a las filas.
  ajustado <- .barras_alto_fila_ajustado(0.478, 5, alto_fisico_in = 6,
                                         alto_fijo_in = 0.32 + 0.85)
  expect_gt(ajustado, 0.478)
  # El tope existe porque una lamina de dos barras estirada a pantalla completa
  # se lee como un error de maquetacion, no como un grafico.
  expect_lte(ajustado, .BARRAS_ALTO_FILA_MAX_IN)
  expect_equal(.barras_alto_fila_ajustado(0.478, 2, 6, 1.17), .BARRAS_ALTO_FILA_MAX_IN)
})

test_that("solo se crece: un hueco chico no aprieta las barras dos veces", {
  # Si el hueco es menor que el contenido, el canvas ya se encoge al colocarse.
  expect_equal(.barras_alto_fila_ajustado(0.60, 10, alto_fisico_in = 2), 0.60)
  # Y una entrada invalida devuelve lo que habia, en vez de tumbar el dibujo.
  expect_equal(.barras_alto_fila_ajustado(0.48, 5, alto_fisico_in = NA), 0.48)
  expect_equal(.barras_alto_fila_ajustado(0.48, 0, alto_fisico_in = 6), 0.48)
})
