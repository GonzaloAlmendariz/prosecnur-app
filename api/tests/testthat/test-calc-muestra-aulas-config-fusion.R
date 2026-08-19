# La config de marco se fusiona con la vigente: un body parcial no pisa nada.
#
# Medido el 2026-08-19 (HSVG2026): sellar el techo con un POST parcial devolvio
# n_aulas=30 y faculty_targets=0 donde habia 190 y 15; la cadena que mando el
# diseno sin techo lo borro a su vez. El ultimo en escribir destruia al
# anterior y el .pulso guardaba la destruccion.

test_that("una clave suelta se sella sin devolver el resto a defaults", {
  vigente <- calc_muestra_aulas_normalize_config(list(selector = list(
    n_aulas = 190L,
    faculty_targets = list(DERECHO = 20L, PSICOLOGIA = 7L),
    docente_unico = TRUE
  )))
  entrante <- list(selector = list(techo_aulas_visitadas = 200))
  out <- calc_muestra_aulas_normalize_config(
    calc_muestra_aulas_config_fusionar(vigente, entrante)
  )
  expect_identical(out$selector$techo_aulas_visitadas, 200L)
  expect_identical(out$selector$n_aulas, 190L)
  expect_identical(length(out$selector$faculty_targets), 2L)
  expect_true(out$selector$docente_unico)
})

test_that("el caso medido: el diseno completo sin techo YA NO lo borra", {
  con_techo <- calc_muestra_aulas_normalize_config(list(selector = list(
    techo_aulas_visitadas = 200L, n_aulas = 190L
  )))
  diseno_sin_techo <- list(selector = list(
    n_aulas = 190L,
    faculty_targets = list(DERECHO = 20L)
  ))
  out <- calc_muestra_aulas_normalize_config(
    calc_muestra_aulas_config_fusionar(con_techo, diseno_sin_techo)
  )
  expect_identical(out$selector$techo_aulas_visitadas, 200L)
  expect_identical(length(out$selector$faculty_targets), 1L)
})

test_that("faculty_targets se fusiona por facultad y un null explicito borra", {
  vigente <- list(selector = list(
    faculty_targets = list(DERECHO = 20L, PSICOLOGIA = 7L, EDUCACION = 2L)
  ))
  entrante <- list(selector = list(
    faculty_targets = list(DERECHO = 22L, EDUCACION = NULL)
  ))
  out <- calc_muestra_aulas_config_fusionar(vigente, entrante)
  ft <- out$selector$faculty_targets
  expect_identical(ft$DERECHO, 22L)
  expect_identical(ft$PSICOLOGIA, 7L)
  expect_false("EDUCACION" %in% names(ft))
})

test_that("las listas posicionales se reemplazan enteras, jamas por posicion", {
  vigente <- list(selector = list(strata_cols = list("facultad", "sexo", "grado")))
  entrante <- list(selector = list(strata_cols = list("facultad")))
  out <- calc_muestra_aulas_config_fusionar(vigente, entrante)
  expect_identical(out$selector$strata_cols, list("facultad"))
})

test_that("sin config vigente el entrante pasa tal cual (primera escritura)", {
  out <- calc_muestra_aulas_config_fusionar(NULL, list(selector = list(n_aulas = 10L)))
  expect_identical(out$selector$n_aulas, 10L)
  out2 <- calc_muestra_aulas_config_fusionar(list(), list(selector = list(n_aulas = 10L)))
  expect_identical(out2$selector$n_aulas, 10L)
})
