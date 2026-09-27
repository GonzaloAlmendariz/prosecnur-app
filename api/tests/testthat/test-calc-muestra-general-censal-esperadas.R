# Intención censal con respuesta menor que la cobertura pedida (L18 del loop
# de mejoras, 2026-09-27). Con N = 2000 y cobertura .8 la meta es 1600 y se
# aborda a todos; con respuesta .7 vuelven 1400. La tasa no movía nada y el
# aviso llamaba «cobertura esperada» a la pedida.

.cen_comp <- function(cobertura = .8, tasa = .7, N = 2000L) {
  list(
    actor = "Censo", actor_id = "censo", actor_categoria = "otros",
    tecnica = "intencion_censal", origen_tamano = "formula",
    marco = list(universo_bruto = N, marco_validado = N, marco_contactable = N,
                 estado = "validado", estratos = list()),
    parametros = list(cobertura_objetivo = cobertura, tasa_respuesta = tasa)
  )
}

test_that("L18: con respuesta .7 se esperan 1400 de las 1600 que pide la cobertura", {
  r <- calc_muestra_calcular_componente(.cen_comp())
  expect_identical(as.integer(r$n_objetivo), 1600L)
  expect_identical(as.integer(r$n_operativo), 2000L)
  expect_equal(r$n_completas_esperadas, 1400)
  expect_match(r$advertencia, "se esperan 1400 de las 1600 que pide la cobertura del 80", fixed = TRUE)
  expect_match(r$advertencia, "cobertura esperada del 70 %", fixed = TRUE)
  expect_false(grepl("cobertura esperada del 80", r$advertencia, fixed = TRUE))
})

test_that("L18: la tasa mueve las esperadas (con .3, 600)", {
  r <- calc_muestra_calcular_componente(.cen_comp(tasa = .3))
  expect_equal(r$n_completas_esperadas, 600)
})

test_that("L18: si la respuesta alcanza la cobertura, no hay aviso de meta", {
  r <- calc_muestra_calcular_componente(.cen_comp(cobertura = .6, tasa = .7))
  expect_null(r$n_completas_esperadas)
  expect_false(grepl("se esperan", r$advertencia, fixed = TRUE))
})
