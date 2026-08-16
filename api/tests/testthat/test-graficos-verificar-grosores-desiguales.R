# La forma que espera el detector del verificador: lleva `texto`, y el color
# tiene que ser uno de la rampa o del azul para que `.verif_segmentos()` lo
# reconozca como barra. Construirla a mano sin esos campos hacia que el filtro
# la descartara y la regla devolvia 0 siempre.
forma <- function(x, y, w, h, col) {
  list(x = x, y = y, w = w, h = h, col = col, texto = "")
}

# Una barra por fila, todas del mismo grosor: un grafico sano.
barras <- function(y0, alto, n = 3, col = "70AD47", x = 1) {
  lapply(seq_len(n), function(k) forma(x, y0 + (k - 1) * (alto * 2), 3, alto, col))
}


test_that("el fixture es una barra para el detector del verificador", {
  # Sin esto, los demas asserts pasarian sobre listas que el filtro descarta.
  expect_length(.verif_segmentos(barras(0, 0.40), .VERIF_RAMPA), 3L)
})


test_that("un solo grafico no tiene con que compararse", {
  expect_equal(.verif_grosores_desiguales(barras(0, 0.40)), 0)
  expect_equal(.verif_grosores_desiguales(list()), 0)
})


test_that("dos bloques del mismo grosor no son un hallazgo", {
  f <- c(barras(0, 0.40, x = 1), barras(0, 0.40, x = 9))
  expect_equal(.verif_grosores_desiguales(f), 0)
})


test_that("dos bloques de distinto grosor se miden en centimetros", {
  # El caso real de «MECANISMOS DE ADMISION»: escala a 1.19 cm y dicotomica a
  # 0.90 sobre la misma lamina.
  f <- c(barras(0, 1.19 / 2.54, col = "70AD47", x = 1),
         barras(0, 0.90 / 2.54, col = "081F5C", x = 9))
  expect_equal(.verif_grosores_desiguales(f), 0.29, tolerance = 0.02)
})


test_that("la diferencia se toma entre el mayor y el menor, no entre vecinos", {
  f <- c(barras(0, 0.20, x = 1), barras(0, 0.30, x = 9), barras(0, 0.50, x = 17))
  expect_equal(.verif_grosores_desiguales(f), (0.50 - 0.20) * 2.54, tolerance = 0.03)
})
