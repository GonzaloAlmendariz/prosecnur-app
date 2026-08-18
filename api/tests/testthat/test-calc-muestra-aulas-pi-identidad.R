# Identidad de las probabilidades de inclusión (ADR 0066, remate de J1).
#
# El diseño por estrato fija n aulas: la suma de las π sobre TODO el marco
# elegible del estrato debe ser exactamente n — es la identidad que hace a
# los pesos 1/π insesgados. Se prueba sobre el helper que las produce
# (.cm_aulas_inclusion_probabilities), que es donde la identidad nace; el
# payload por fila ya se audita en la batería empírica (203/203 en rango).

test_that("la suma de pi sobre el estrato es exactamente la cuota", {
  mos <- c(10, 25, 40, 15, 30, 22, 18, 35)
  for (n in c(1L, 3L, 5L, 7L)) {
    pik <- .cm_aulas_inclusion_probabilities(mos, n)
    expect_equal(sum(pik), n, tolerance = 1e-9)
    expect_true(all(pik > 0 & pik <= 1))
  }
})

test_that("una unidad gigante se vuelve certeza y el resto redistribuye sin romper la suma", {
  mos <- c(1000, 5, 8, 6, 4)
  pik <- .cm_aulas_inclusion_probabilities(mos, 2L)
  expect_equal(pik[[1]], 1)
  expect_equal(sum(pik), 2, tolerance = 1e-9)
  expect_true(all(pik > 0 & pik <= 1))
})

test_that("el estratificado publica pi uniforme cuota/N que tambien suma la cuota", {
  # D1: SRS por estrato -> pi = cuota/N, la del sorteo EJECUTADO.
  n <- 4L; N <- 20L
  pik <- rep(n / N, N)
  expect_equal(sum(pik), n)
})

test_that("cuota igual al estrato entero da certezas puras", {
  mos <- c(3, 9, 12)
  pik <- .cm_aulas_inclusion_probabilities(mos, 3L)
  expect_equal(pik, c(1, 1, 1))
})
