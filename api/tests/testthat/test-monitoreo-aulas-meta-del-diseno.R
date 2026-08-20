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

test_that("la meta del diseño gana al alias de esta capa", {
  # `efectivas_esperadas` es el nombre CANONICO —lo escribe el motor de calculo
  # de muestra— y `expected_valid` es un alias de esta capa que aquel motor no
  # escribe nunca. Con el alias delante, un plan externo o una edicion a mano
  # pisaban la meta que calculo el diseño; ahora manda el diseño.
  plan <- monitoreo_aulas_normalize_plan(list(list(
    operational_code = "CH 1", classroom_id = "a1", eligible_n = 24,
    expected_valid = 15, efectivas_esperadas = 12.1
  )))
  expect_equal(plan[[1]]$expected_valid, 12.1)

  # Y sin la canonica, el alias sigue sirviendo: los planes que no vienen del
  # calculo de muestra no se quedan sin meta.
  externo <- monitoreo_aulas_normalize_plan(list(list(
    operational_code = "CH 1", classroom_id = "a1", eligible_n = 24, expected_valid = 15
  )))
  expect_equal(externo[[1]]$expected_valid, 15)
})
