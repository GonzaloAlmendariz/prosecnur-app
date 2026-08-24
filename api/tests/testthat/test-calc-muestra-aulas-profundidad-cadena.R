# La profundidad de la cadena de reemplazo responde a una medicion, no a una
# constante comoda.
#
# Con la tasa de aplicacion sellada por tipo de docente, la probabilidad de que
# NINGUNA de las `1 + k` aulas de una cadena se aplique es `(1 - p)^(1 + k)`.

.pcad_cae_todo <- function(p, k) (1 - p)^(1 + k)

test_that("cinco reservas llevan al PEOR tipo de docente por encima del 99,9 %", {
  # Ordinario-principal es el que mas rechaza (0,730) y por tanto el que fija la
  # profundidad: si el peor caso esta cubierto, los demas tambien.
  expect_lt(.pcad_cae_todo(0.730, 5), 0.001)
  # Y CUATRO no alcanzan: sin esta linea, el 5 pareceria un numero elegido a ojo.
  expect_gt(.pcad_cae_todo(0.730, 4), 0.001)
  # Los otros dos tipos ya estaban cubiertos con tres.
  expect_lt(.pcad_cae_todo(0.865, 3), 0.001)
  expect_lt(.pcad_cae_todo(0.843, 3), 0.001)
})

test_that("las reservas 6 a 11 no compran seguridad, compran papel", {
  # Pasar de 5 a 11 mueve el peor caso de 0,039 % a 0,000015 %: dos ordenes de
  # magnitud por debajo de cualquier decision operativa, y seis cadenas mas que
  # alguien tiene que mantener, agendar y explicar.
  expect_lt(.pcad_cae_todo(0.730, 11) / .pcad_cae_todo(0.730, 5), 0.001)
})

test_that("el default del estudio es 5", {
  cfg <- calc_muestra_aulas_default_config()
  expect_identical(cfg$selector$replacement_waves, 5L)
})

test_that("un estudio que sella su profundidad la CONSERVA", {
  # Es la guarda que hace que bajar el default no reescriba un plan ya sorteado:
  # la resolucion lee el valor del estudio primero y solo cae al default cuando
  # el estudio no dice nada.
  sellado <- calc_muestra_aulas_normalize_config(list(selector = list(replacement_waves = 11L)))
  expect_identical(sellado$selector$replacement_waves, 11L)
  # El alias en castellano tambien manda sobre el default.
  alias <- calc_muestra_aulas_normalize_config(list(selector = list(bolsas_reemplazo = 8L)))
  expect_identical(alias$selector$replacement_waves, 8L)
  # Y un estudio que no dice nada recibe el default nuevo.
  mudo <- calc_muestra_aulas_normalize_config(list())
  expect_identical(mudo$selector$replacement_waves, 5L)
  # Cero es una profundidad valida —sin cadena— y no se confunde con «sin dato».
  cero <- calc_muestra_aulas_normalize_config(list(selector = list(replacement_waves = 0L)))
  expect_identical(cero$selector$replacement_waves, 0L)
})
