# Los motivos que bloquean el margen de error formal dicen QUE VALOR lo incumple.
#
# `calc_muestra_validar_inferencia` decia la regla y nada mas:
#
#   "Falta marco validado (cantidad de unidades elegibles)."
#   "El estado del marco debe ser 'validado' o superior."
#   "deff debe ser >= 1 para conglomerados."
#   "Tasa de rendimiento τ debe estar en (0, 1]."
#
# Con eso el analista sabe que algo esta mal pero no QUE puso: si el deff es
# 0.99 o 0.2, si el tau es 1.4 o 0, si el marco esta en cero o en blanco. Y
# estos motivos son lo unico que explica por que su resultado sale sin margen
# de error formal, asi que sin la cifra la explicacion no se puede accionar.

.imv_comp <- function(...) {
  comp <- list(
    id = "cmp-1", actor = "estudiantes", actor_id = "estudiantes",
    actor_categoria = "otros", canal_recojo = "aula_qr",
    tecnica = "prob_conglomerado_multietapico",
    naturaleza = "probabilistica",
    marco = list(estado = "validado", marco_validado = 1000L, estratos = list()),
    parametros = list(p = 0.5, z = 1.96, e = 0.05, deff = 2, tau = 0.8,
                      promedio_conglomerado = 25, oversample_pct = 0)
  )
  utils::modifyList(comp, list(...))
}

.imv_motivos <- function(comp) calc_muestra_validar_inferencia(comp)$motivos

test_that("un componente sano no produce motivos", {
  out <- calc_muestra_validar_inferencia(.imv_comp())
  expect_true(isTRUE(out$permitido))
  expect_null(out$motivos)
})

test_that("el deff invalido dice cual es", {
  m <- .imv_motivos(.imv_comp(parametros = list(
    p = 0.5, z = 1.96, e = 0.05, deff = 0.8, tau = 0.8,
    promedio_conglomerado = 25, oversample_pct = 0
  )))
  expect_true(grepl("0.8", m, fixed = TRUE))
  expect_true(grepl(">= 1", m, fixed = TRUE))
  # Y no vuelve al texto ciego.
  expect_false(grepl("deff debe ser >= 1 para conglomerados.", m, fixed = TRUE))
})

test_that("dos deff invalidos distintos NO producen el mismo texto", {
  # EL punto del cambio: quedarse a un pelo (0.99) y quedarse lejos (0.2) piden
  # cosas distintas, y antes se escribian igual.
  apenas <- .imv_motivos(.imv_comp(parametros = list(
    p = 0.5, z = 1.96, e = 0.05, deff = 0.99, tau = 0.8,
    promedio_conglomerado = 25, oversample_pct = 0
  )))
  lejos <- .imv_motivos(.imv_comp(parametros = list(
    p = 0.5, z = 1.96, e = 0.05, deff = 0.2, tau = 0.8,
    promedio_conglomerado = 25, oversample_pct = 0
  )))
  expect_false(identical(apenas, lejos))
  expect_true(grepl("0.99", apenas, fixed = TRUE))
  expect_true(grepl("0.2", lejos, fixed = TRUE))
})

test_that("la tasa de rendimiento invalida dice cual es", {
  m <- .imv_motivos(.imv_comp(parametros = list(
    p = 0.5, z = 1.96, e = 0.05, deff = 2, tau = 1.4,
    promedio_conglomerado = 25, oversample_pct = 0
  )))
  expect_true(grepl("1.4", m, fixed = TRUE))
  expect_true(grepl("(0, 1]", m, fixed = TRUE))
})

test_that("el marco sin unidades dice cuantas trae", {
  m <- .imv_motivos(.imv_comp(marco = list(
    estado = "validado", marco_validado = 0L, estratos = list()
  )))
  expect_true(grepl("es 0", m, fixed = TRUE))
})

test_that("el estado del marco dice en cual esta", {
  m <- .imv_motivos(.imv_comp(marco = list(
    estado = "operativo", marco_validado = 1000L, estratos = list()
  )))
  expect_true(grepl("operativo", m, fixed = TRUE))
  expect_true(grepl("validado", m, fixed = TRUE))
})

test_that("varios motivos a la vez viajan juntos y cada uno con su cifra", {
  m <- .imv_motivos(.imv_comp(
    marco = list(estado = "operativo", marco_validado = 0L, estratos = list()),
    parametros = list(p = 0.5, z = 1.96, e = 0.05, deff = 0.5, tau = 2,
                      promedio_conglomerado = 25, oversample_pct = 0)
  ))
  expect_true(grepl("es 0", m, fixed = TRUE))
  expect_true(grepl("operativo", m, fixed = TRUE))
  expect_true(grepl("0.5", m, fixed = TRUE))
  expect_true(grepl("es 2", m, fixed = TRUE))
})
