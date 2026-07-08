# Tests de la memoria de cálculo explicada (/api/calc-muestra/explicar).
# La memoria debe reproducir EXACTAMENTE las funciones validadas del motor:
# calc_n_muestra + calc_e_desde_n_muestra. Es un envoltorio, no otra fórmula.

test_that("calc_muestra_explicar reproduce calc_n_muestra y calc_e_desde_n_muestra", {
  casos <- list(
    list(N = 28000, p = 0.5, confianza = 0.95, e = 0.025, deff = 2),
    list(N = 10000, p = 0.5, confianza = 0.95, e = 0.05, deff = 1),
    list(N = 5000, p = 0.3, confianza = 0.99, e = 0.03, deff = 1.5),
    list(N = 1200, p = 0.5, confianza = 0.90, e = 0.05, deff = 1.2)
  )
  for (caso in casos) {
    m <- calc_muestra_explicar(caso)
    z <- stats::qnorm(1 - (1 - caso$confianza) / 2)
    n_ref <- calc_n_muestra(N = caso$N, p = caso$p, z = z, e = caso$e, deff = caso$deff)
    e_ref <- calc_e_desde_n_muestra(n = n_ref, N = caso$N, p = caso$p, z = z, deff = caso$deff)
    expect_identical(m$n_teorico, as.integer(n_ref))
    expect_identical(m$n_objetivo, as.integer(n_ref))
    expect_equal(m$parametros$z_usado, z, tolerance = 1e-12)
    expect_equal(m$retrocalculo$precision_alcanzada, e_ref, tolerance = 1e-12)
    expect_true(m$retrocalculo$cumple)
    expect_equal(m$terminos$numerador, z^2 * caso$p * (1 - caso$p) * caso$deff,
                 tolerance = 1e-12)
    expect_equal(m$terminos$n0_sin_fpc, m$terminos$numerador / caso$e^2,
                 tolerance = 1e-12)
    expect_equal(m$terminos$fpc_denominador,
                 (caso$N - 1) * caso$e^2 + m$terminos$numerador,
                 tolerance = 1e-12)
  }
})

test_that("calc_muestra_explicar acepta z directo y deriva la confianza", {
  m <- calc_muestra_explicar(list(N = 10000, p = 0.5, z = 1.96, e = 0.05, deff = 1))
  expect_equal(m$parametros$z_usado, 1.96, tolerance = 1e-12)
  expect_equal(m$parametros$confianza, 2 * stats::pnorm(1.96) - 1, tolerance = 1e-12)
  expect_identical(m$n_teorico,
                   calc_n_muestra(N = 10000, p = 0.5, z = 1.96, e = 0.05, deff = 1))
})

test_that("calc_muestra_explicar aplica meta, sobremuestra y unidades operativas", {
  m <- calc_muestra_explicar(list(
    N = 28000, p = 0.5, confianza = 0.95, e = 0.025, deff = 2,
    meta_valor = 1800, oversample_pct = 0.5,
    promedio_conglomerado = 25, tau = 0.7
  ))
  expect_identical(m$n_objetivo, 1800L)
  expect_identical(m$sobremuestra, as.integer(ceiling(1800 * 0.5)))
  expect_identical(m$n_operativo, m$n_objetivo + m$sobremuestra)
  expect_identical(m$unidades_operativas, as.integer(ceiling(1800 / (25 * 0.7))))
  pasos <- vapply(m$decision_log, function(d) d$paso, character(1))
  expect_true(all(c("modelo", "confianza", "p", "deff", "fpc",
                    "objetivo", "sobremuestra", "retrocalculo") %in% pasos))
})

test_that("calc_muestra_explicar valida N requerido", {
  expect_error(calc_muestra_explicar(list(p = 0.5)), class = "api_error")
})
