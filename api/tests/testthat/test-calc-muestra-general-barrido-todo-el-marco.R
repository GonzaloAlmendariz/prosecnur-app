# Barrido: se aborda todo el marco (L19 del loop de mejoras, 2026-09-27).
# Publicaba n a campo = ⌈N·cobertura⌉ (1600 con N=2000, cobertura .8) mientras
# Selección sorteaba el marco entero (2000, π=1). Decisión provisional del
# loop, reversible: el barrido aborda a todos, como la cobertura censal (L18),
# y la cobertura es la meta; la asistencia (tau) dice cuántas vuelven.

.bar_comp <- function(cobertura = .8, tau = .75, N = 2000L) {
  list(actor = "Barrido", actor_id = "barrido", actor_categoria = "otros",
       tecnica = "barrido", origen_tamano = "cobertura_esperada",
       marco = list(universo_bruto = N, marco_validado = N, marco_contactable = N,
                    estado = "validado", estratos = list()),
       parametros = list(cobertura_objetivo = cobertura, tau = tau, promedio_conglomerado = 30,
                         oversample_pct = .1))
}

test_that("L19: el barrido aborda el marco entero, como su sorteo", {
  r <- calc_muestra_calcular_componente(.bar_comp())
  expect_identical(as.integer(r$n_objetivo), 1600L)
  expect_identical(as.integer(r$n_operativo), 2000L)
})

test_that("L19: con asistencia .75 vuelven 1500 de las 1600 que pide la cobertura", {
  r <- calc_muestra_calcular_componente(.bar_comp())
  expect_equal(r$n_completas_esperadas, 1500)
  expect_match(r$advertencia, "se esperan 1500 de las 1600", fixed = TRUE)
  ok <- calc_muestra_calcular_componente(.bar_comp(tau = .9))
  expect_null(ok$n_completas_esperadas)
})
