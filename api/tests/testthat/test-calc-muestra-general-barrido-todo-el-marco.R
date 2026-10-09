# Barrido: se aborda todo el marco (L19 del loop de mejoras, 2026-09-27).
# Publicaba n a campo = ⌈N·cobertura⌉ (1600 con N=2000, cobertura .8) mientras
# Selección sorteaba el marco entero (2000, π=1). Decisión de Gonzalo (a):
# el barrido aborda a todos, como la cobertura censal (L18),
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

test_that("L30: las unidades a barrer son todas las del marco, en la misma base que el n a campo", {
  # N = 2000 personas en unidades de 30: ⌈2000/30⌉ = 67 unidades, todas. La
  # asistencia no cambia cuántas se visitan (sólo cuántas completas vuelven) y
  # no hay unidades de reserva fuera del marco.
  r <- calc_muestra_calcular_componente(.bar_comp())
  expect_identical(as.integer(r$unidades_base), 67L)
  expect_identical(as.integer(r$unidades_refuerzo), 0L)
  expect_identical(as.integer(r$unidades_operativas), 67L)
  otra_tau <- calc_muestra_calcular_componente(.bar_comp(tau = .4))
  expect_identical(as.integer(otra_tau$unidades_operativas), 67L)
})

test_that("L30: el barrido ya no declara la sobremuestra, que no mueve nada", {
  claves <- vapply(calc_muestra_parametros_tecnica("barrido")$parametros, `[[`, "", "clave")
  expect_false("oversample_pct" %in% claves)
  expect_true(all(c("cobertura_objetivo", "tau", "promedio_conglomerado") %in% claves))
})
