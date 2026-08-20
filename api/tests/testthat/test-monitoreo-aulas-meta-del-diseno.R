test_that("la meta por aula sale de `efectivas_esperadas` del diseño, no de los elegibles", {
  # El cálculo de muestra calcula por curso-horario cuántas efectivas espera de
  # esa aula —elegibles x P(aplicada) x rendimiento—, y en el marco 2026 va de
  # 5,8 a 34,8. El handoff no reconocía la columna y caía a `eligible_n`, así
  # que la meta pasaba a ser el TOTAL de elegibles: un aula de 24 donde el
  # diseño espera 12 tenía que traer 24. De ahí «Llegaron a su meta: 0 de 194».
  plan <- monitoreo_aulas_normalize_plan(list(list(
    operational_code = "CH 1", classroom_id = "a1",
    eligible_n = 24, efectivas_esperadas = 12.1
  )))
  expect_equal(plan[[1]]$expected_valid, 12.1)
  # El control: sin la columna del diseño, el fallback sigue siendo los
  # elegibles —los planes viejos no se rompen— pero eso es un sustituto.
  viejo <- monitoreo_aulas_normalize_plan(list(list(
    operational_code = "CH 1", classroom_id = "a1", eligible_n = 24
  )))
  expect_equal(viejo[[1]]$expected_valid, 24)
})

test_that("una meta explícita gana a la del diseño", {
  # `expected_valid` va primero en la lista: si el estudio ya fijó la meta a
  # mano, el dato derivado no la pisa.
  plan <- monitoreo_aulas_normalize_plan(list(list(
    operational_code = "CH 1", classroom_id = "a1", eligible_n = 24,
    expected_valid = 15, efectivas_esperadas = 12.1
  )))
  expect_equal(plan[[1]]$expected_valid, 15)
})
