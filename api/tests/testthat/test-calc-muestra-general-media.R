# H21: tamaño para estimar una MEDIA con error relativo. A mano, con CV = 1,
# r = 0,05, z = 1,96, N = 1000: n0 = 3,8416/0,0025 = 1536,64;
# n = 1536,64 / (1 + 1535,64/1000) = 606,02 → 607; r alcanzado con 607 =
# 1,96 · √(393 / (607 · 999)) = 0,0499.

.media_comp <- function(tecnica = "prob_aleatorio_simple", N = 1000L, ...) {
  calc_muestra_normalize_componente(list(tecnica = tecnica,
    marco = list(marco_validado = N, universo_bruto = N, marco_contactable = N, estado = "validado"),
    parametros = utils::modifyList(list(tipo_indicador = "media", cv = 1, e = .05, z = 1.96, deff = 1,
                                        tasa_respuesta = 1, oversample_pct = 0), list(...))))
}

test_that("MAS de una media: n = 607 y error relativo 0,0499 (a mano)", {
  r <- calc_muestra_calcular_componente(.media_comp())
  expect_identical(as.integer(r$n_teorico), 607L)
  expect_equal(r$precision_alcanzada, 0.0499, tolerance = 1e-3)
  expect_identical(r$memoria_calculo$resultado[[2]], "606.017 → 607")
  expect_match(r$memoria_calculo$paso[[1]], "media", fixed = TRUE)
})

test_that("el CV mueve el n de una media y p no; en una proporción, al revés", {
  a <- calc_muestra_calcular_componente(.media_comp(cv = .5))$n_teorico
  b <- calc_muestra_calcular_componente(.media_comp(cv = .5, p = .1))$n_teorico
  expect_identical(a, b)
  expect_lt(a, 607L)
  prop <- calc_muestra_calcular_componente(.media_comp(tipo_indicador = "proporcion", cv = 3))
  expect_identical(as.integer(prop$n_teorico), 278L)
})

test_that("una proporción sigue igual con los parámetros nuevos (el default es proporción)", {
  comp <- calc_muestra_normalize_componente(list(tecnica = "prob_aleatorio_simple",
    marco = list(marco_validado = 5000L, universo_bruto = 5000L, marco_contactable = 5000L, estado = "validado")))
  expect_identical(comp$parametros$tipo_indicador, "proporcion")
  expect_identical(as.integer(calc_muestra_calcular_componente(comp)$n_teorico), 357L)
})

test_that("el estratificado de una media usa la fórmula global con el CV aunque haya p por estrato", {
  comp <- .media_comp("prob_estratificado", N = 1000L)
  comp$marco$estratos <- list(list(label = "A", N = 600L, p_facultad = .1), list(label = "B", N = 400L, p_facultad = .5))
  r <- calc_muestra_calcular_componente(calc_muestra_normalize_componente(comp))
  expect_identical(as.integer(r$n_teorico), 607L)
  expect_identical(r$formula_n, "media_global")
})

test_that("Monte Carlo: con n = 607 la media de una población lognormal (CV≈1) queda dentro de ±5 % ~95 %", {
  set.seed(11)
  N <- 1000L
  y <- stats::rlnorm(N, 0, sqrt(log(2)))   # CV teórico = 1
  n <- calc_muestra_calcular_componente(.media_comp(cv = stats::sd(y) / mean(y)))$n_objetivo
  mu <- mean(y)
  dentro <- mean(replicate(2000, { m <- mean(sample(y, n)); abs(m - mu) / mu <= .05 }))
  expect_gt(dentro, 0.93)
})
