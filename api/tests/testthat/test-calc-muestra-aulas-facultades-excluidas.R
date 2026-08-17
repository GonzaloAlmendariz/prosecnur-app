# Las facultades que no participan del estudio se declaran, no se deducen.
#
# Medido sobre HSVG2026: `exclude_level_patterns` busca «posgrado», «maestria» o
# «doctorado» dentro de la columna `level`, y ahi `level` es un numero de ciclo
# ("1".."9"), asi que el patron no coincide nunca y NO excluye ni una sola aula.
# Lo que dejaba fuera a 850 de las 852 aulas de posgrado era, de rebote,
# `min_eligible_per_class = 15`: son aulas pequeñas. Las dos que superaban el
# minimo entraron al marco con `exclude_reason` vacia.
#
# Excluir por tamaño no es excluir por diseño: basta bajar el minimo para que
# posgrado vuelva a entrar y pueda salir sorteado.

test_that("una facultad listada no aporta ninguna fila elegible", {
  claves <- .cm_aulas_facultad_excluida(
    c("ESCUELA DE POSGRADO", "DERECHO", "ESCUELA DE POSGRADO"),
    list("ESCUELA DE POSGRADO")
  )
  expect_equal(claves, c(TRUE, FALSE, TRUE))
})

test_that("la comparacion aguanta acentos, mayusculas y espacios de mas", {
  # La lista la escribe una persona y la base la escribe la universidad.
  expect_true(all(.cm_aulas_facultad_excluida(
    c("Escuela de Posgrado", "ESCUELA  DE POSGRADO ", "escuela de posgrado"),
    list("ESCUELA DE POSGRADO")
  )))
  expect_true(.cm_aulas_facultad_excluida("PSICOLOGÍA", list("PSICOLOGIA")))
})

test_that("con la lista vacia no se excluye a nadie", {
  # Default vacio: ningun proyecto existente cambia de comportamiento.
  faculty <- c("DERECHO", "ESCUELA DE POSGRADO", "PSICOLOGIA")
  expect_false(any(.cm_aulas_facultad_excluida(faculty, list())))
  expect_false(any(.cm_aulas_facultad_excluida(faculty, NULL)))
  # Una entrada en blanco tampoco excluye: es ausencia, no una facultad.
  expect_false(any(.cm_aulas_facultad_excluida(faculty, list("", "   "))))
})

test_that("una facultad que no esta en la lista sigue entrando", {
  # Control: el filtro no puede volverse un cedazo que se lo lleve todo.
  expect_false(.cm_aulas_facultad_excluida("DERECHO", list("ESCUELA DE POSGRADO")))
})

test_that("el filtro viaja en la config con default vacio", {
  cfg <- calc_muestra_aulas_default_config()
  expect_true("excluded_faculties" %in% names(cfg$filters))
  expect_length(cfg$filters$excluded_faculties, 0L)
})

test_that("la config normalizada conserva lo que el usuario declaro", {
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(excluded_faculties = list("ESCUELA DE POSGRADO", "ESCUELA DE ESTUDIOS ESPECIALES"))
  ))
  expect_equal(
    unlist(cfg$filters$excluded_faculties, use.names = FALSE),
    c("ESCUELA DE POSGRADO", "ESCUELA DE ESTUDIOS ESPECIALES")
  )
})

test_that("el alias en castellano tambien se acepta", {
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(facultades_excluidas = list("ESCUELA DE POSGRADO"))
  ))
  expect_equal(unlist(cfg$filters$excluded_faculties, use.names = FALSE), "ESCUELA DE POSGRADO")
})
