estudio_con <- function(escenarios, componentes) {
  list(workspace = list(escenarios = escenarios), componentes = componentes)
}

test_that("toma el objetivo del escenario ACTIVO, no del primero ni del mayor", {
  e <- estudio_con(
    escenarios = list(
      list(id = "facultades", label = "Nivel facultad", activo = FALSE, component_id = "cmp-fac"),
      list(id = "total", label = "Nivel universidad", activo = TRUE, component_id = "cmp-uni")
    ),
    componentes = list(
      # El inactivo es el PRIMERO y el MAYOR: si se eligiera por orden o por
      # tamano, ganaria este. En HSVG2026 son 4 050 contra 2 500.
      list(id = "cmp-fac", resultado = list(n_objetivo = 4050, n_operativo = 4860)),
      list(id = "cmp-uni", resultado = list(n_objetivo = 2500, n_operativo = 3750))
    )
  )
  r <- monitoreo_aulas_objetivo_estudio(e)
  expect_equal(r$objetivo, 2500)
  expect_equal(r$operativo, 3750)
  expect_equal(r$component_id, "cmp-uni")
  expect_equal(r$escenario, "Nivel universidad")
  expect_equal(r$origen, "escenario_activo")
})

test_that("sin escenario activo NO elige uno por descarte", {
  # Un estudio a medio configurar. Devolver el unico componente seria comodo y
  # seria inventar una meta: en pantalla se leeria igual que una declarada.
  e <- estudio_con(
    escenarios = list(list(id = "total", activo = FALSE, component_id = "cmp-uni")),
    componentes = list(list(id = "cmp-uni", resultado = list(n_objetivo = 2500)))
  )
  r <- monitoreo_aulas_objetivo_estudio(e)
  expect_true(is.na(r$objetivo))
  expect_equal(r$origen, "sin_escenario_activo")
})

test_that("un escenario que apunta a un componente inexistente se declara", {
  e <- estudio_con(
    escenarios = list(list(id = "total", activo = TRUE, component_id = "cmp-que-no-esta")),
    componentes = list(list(id = "cmp-uni", resultado = list(n_objetivo = 2500)))
  )
  r <- monitoreo_aulas_objetivo_estudio(e)
  expect_true(is.na(r$objetivo))
  expect_equal(r$origen, "componente_no_encontrado")
})

test_that("cae a meta$valor cuando el resultado no trae n_objetivo", {
  e <- estudio_con(
    escenarios = list(list(id = "total", activo = TRUE, component_id = "cmp-uni")),
    componentes = list(list(id = "cmp-uni", meta = list(valor = 2500), resultado = list()))
  )
  r <- monitoreo_aulas_objetivo_estudio(e)
  expect_equal(r$objetivo, 2500)
})

test_that("un objetivo de cero o negativo no es un objetivo", {
  # `0` es la clase de valor que un estudio a medio llenar deja por ahi, y
  # dividir por el daria Inf en la vista de avance.
  for (malo in list(0, -10, NA_real_, "")) {
    e <- estudio_con(
      escenarios = list(list(id = "t", activo = TRUE, component_id = "c")),
      componentes = list(list(id = "c", resultado = list(n_objetivo = malo)))
    )
    r <- monitoreo_aulas_objetivo_estudio(e)
    expect_true(is.na(r$objetivo))
    expect_equal(r$origen, "escenario_sin_objetivo")
  }
})

test_that("un estudio ausente o vacio se declara, no revienta", {
  for (nada in list(NULL, list(), "no soy un estudio")) {
    r <- monitoreo_aulas_objetivo_estudio(nada)
    expect_true(is.na(r$objetivo))
    expect_equal(r$origen, "sin_estudio")
  }
})

test_that("el operativo puede faltar sin arrastrar al objetivo", {
  e <- estudio_con(
    escenarios = list(list(id = "t", activo = TRUE, component_id = "c")),
    componentes = list(list(id = "c", resultado = list(n_objetivo = 2500)))
  )
  r <- monitoreo_aulas_objetivo_estudio(e)
  expect_equal(r$objetivo, 2500)
  expect_true(is.na(r$operativo))
})
