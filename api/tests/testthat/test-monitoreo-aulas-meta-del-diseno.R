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

test_that("cada aula usa SU meta, aunque el marco traiga la columna a medias", {
  # **El defecto que esto fija.** `getn` toma la primera columna que EXISTA y su
  # default se aplica a las filas vacias de esa columna. Con `efectivas_esperadas`
  # delante y default 0, cualquier fila sin esperado —los reemplazos, o un plan a
  # medio anotar— se quedaba con **meta 0**, que en un veredicto significa que el
  # aula cumple siempre. Y el fallback tampoco la rescataba: 0 es finito.
  plan <- monitoreo_aulas_normalize_plan(list(
    list(operational_code = "A", classroom_id = "a", eligible_n = 24, efectivas_esperadas = 12.1),
    list(operational_code = "B", classroom_id = "b", eligible_n = 24, expected_valid = 15),
    list(operational_code = "C", classroom_id = "c", eligible_n = 24)
  ))
  expect_equal(vapply(plan, function(f) f$expected_valid, numeric(1)), c(12.1, 15, 24))
  # Ninguna se queda en cero, que es la forma que tenia el defecto.
  expect_false(any(vapply(plan, function(f) f$expected_valid == 0, logical(1))))
})

test_that("la meta dice DE DONDE viene, y lo declarado por el productor manda", {
  # `expected_valid` colapsaba tres cosas en un numero: lo que el diseño calculo
  # para ESA aula, lo que alguien declaro a mano, y el total de elegibles cuando
  # no habia ninguna. La pantalla decia «la meta que el calculo de muestra
  # calculo» sobre filas que no venian de ningun diseño.
  plan <- monitoreo_aulas_normalize_plan(list(
    list(operational_code = "A", classroom_id = "a", eligible_n = 24, efectivas_esperadas = 12.1),
    list(operational_code = "B", classroom_id = "b", eligible_n = 24, expected_valid = 15),
    list(operational_code = "C", classroom_id = "c", eligible_n = 24),
    # El calculo de muestra escribe `meta_origen` junto a `efectivas_esperadas`;
    # lo que el productor declara no se recalcula.
    list(operational_code = "D", classroom_id = "d", eligible_n = 30,
         efectivas_esperadas = 9, meta_origen = "diseno")
  ))
  expect_identical(vapply(plan, function(f) f$meta_origen, character(1)),
                   c("diseno", "declarada", "elegibles", "diseno"))
})

test_that("lo que el productor declara NO se recalcula", {
  # **Este caso mato un mutante que el de arriba dejaba vivo.** Alli la fila con
  # `meta_origen` traia ademas `efectivas_esperadas`, asi que derivar y respetar
  # daban lo mismo y el aserto no distinguia cual estaba implementado.
  #
  # Aqui el productor dice «diseno» sobre una fila que llega por el alias: la
  # derivacion diria «declarada» y lo declarado tiene que ganar. Es el caso de un
  # handoff que renombra el campo pero conserva su procedencia.
  plan <- monitoreo_aulas_normalize_plan(list(
    list(operational_code = "A", classroom_id = "a", eligible_n = 24,
         expected_valid = 12.1, meta_origen = "diseno")
  ))
  expect_identical(plan[[1]]$meta_origen, "diseno")
})

test_that("sin elegibles y sin meta, el origen lo dice en vez de fingir una", {
  plan <- monitoreo_aulas_normalize_plan(list(
    list(operational_code = "A", classroom_id = "a")
  ))
  expect_identical(plan[[1]]$meta_origen, "sin_meta")
})
