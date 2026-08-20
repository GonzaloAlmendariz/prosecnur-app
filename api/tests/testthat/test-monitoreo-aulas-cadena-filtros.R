cfg_con <- function(...) monitoreo_aulas_normalize_config(list(
  source_mapping = list(valid_filters = list(...))
))

base <- data.frame(
  sexo = c("F", "F", "M", "M", "F", "M"),
  p01  = c("1", "2", "1", "1", "1", "2"),
  stringsAsFactors = FALSE
)

test_that("la cadena no cambia el veredicto: lo que queda es lo que ya valia", {
  # Es el invariante que sostiene todo el panel. Si la cadena contara distinto
  # que `.monitoreo_aulas_valid_response()`, la pantalla mostraria un total que
  # no es el que el resto del perfil usa —y el perfil entero cuenta 3 700—.
  cfg <- cfg_con(list(var = "sexo", values = "F"), list(var = "p01", values = "1"))
  cadena <- monitoreo_aulas_cadena_filtros(base, cfg)
  expect_equal(cadena$quedan, sum(.monitoreo_aulas_valid_response(base, cfg)))
  expect_equal(cadena$quedan, 2)
})

test_that("la cascada dice de cuantas parte cada filtro, no del total", {
  cfg <- cfg_con(list(var = "sexo", values = "F"), list(var = "p01", values = "1"))
  pasos <- monitoreo_aulas_cadena_filtros(base, cfg)$pasos
  expect_equal(length(pasos), 2L)
  expect_equal(pasos[[1]]$entran, 6)
  expect_equal(pasos[[1]]$caen, 3)
  expect_equal(pasos[[1]]$quedan, 3)
  # El segundo NO parte de 6: parte de las 3 que sobrevivieron al primero. Es la
  # diferencia entre una cadena y una lista de filtros sueltos.
  expect_equal(pasos[[2]]$entran, 3)
  expect_equal(pasos[[2]]$quedan, 2)
})

test_that("lo exclusivo no es lo que cae: son dos preguntas distintas", {
  # `caen` responde «cuantas tumba aqui»; `caen_solo_aqui`, «cuantas se
  # recuperarian si quitaramos este filtro». Con filtros que se solapan, los dos
  # numeros difieren, y llamarlos igual seria la trampa de una palabra para dos
  # cosas.
  cfg <- cfg_con(list(var = "sexo", values = "F"), list(var = "p01", values = "1"))
  pasos <- monitoreo_aulas_cadena_filtros(base, cfg)$pasos
  # Fila 3 y 4 son M con p01=1: sólo las tumba el filtro de sexo.
  expect_equal(pasos[[1]]$caen_solo_aqui, 2)
  # Fila 2 es F con p01=2: sólo la tumba el filtro de p01.
  expect_equal(pasos[[2]]$caen_solo_aqui, 1)
  # Y la fila 6 (M, p01=2) no es exclusiva de ninguno: la tumban los dos.
  expect_equal(pasos[[1]]$caen, 3)
})

test_that("un filtro cuya columna no esta en la base se declara y no se aplica", {
  # Es lo que ya hace el veredicto —descartar todo por una columna ausente seria
  # peor que contar de mas—, y la cadena tiene que contarlo igual o los dos
  # numeros se separarian.
  cfg <- cfg_con(list(var = "sexo", values = "F"), list(var = "no_existe", values = "x"))
  cadena <- monitoreo_aulas_cadena_filtros(base, cfg)
  expect_equal(cadena$declarados, 2L)
  expect_equal(cadena$aplicados, 1L)
  expect_equal(length(cadena$sin_columna), 1L)
  expect_equal(cadena$sin_columna[[1]]$variable, "no_existe")
  expect_equal(cadena$quedan, sum(.monitoreo_aulas_valid_response(base, cfg)))
})

test_that("sin filtros declarados no se inventa una cadena", {
  # Sin `valid_filters` manda el camino de `status_var`, que no es una cadena.
  vacia <- monitoreo_aulas_cadena_filtros(base, monitoreo_aulas_normalize_config(list()))
  expect_equal(vacia$declarados, 0L)
  expect_length(vacia$pasos, 0)
})

test_that("una base vacia no rompe la cadena", {
  cfg <- cfg_con(list(var = "sexo", values = "F"))
  r <- monitoreo_aulas_cadena_filtros(data.frame(), cfg)
  expect_equal(r$entran, 0L)
  expect_length(r$pasos, 0)
})

test_that("el orden de los filtros cambia la cascada pero no el total", {
  # Si el total dependiera del orden, el panel diria una cosa distinta segun
  # como se guardo la config.
  a <- monitoreo_aulas_cadena_filtros(base, cfg_con(
    list(var = "sexo", values = "F"), list(var = "p01", values = "1")))
  b <- monitoreo_aulas_cadena_filtros(base, cfg_con(
    list(var = "p01", values = "1"), list(var = "sexo", values = "F")))
  expect_equal(a$quedan, b$quedan)
  expect_false(identical(a$pasos[[1]]$caen, b$pasos[[1]]$caen))
  # Y lo exclusivo, que no depende del orden, se conserva.
  expect_equal(a$pasos[[1]]$caen_solo_aqui, b$pasos[[2]]$caen_solo_aqui)
})
