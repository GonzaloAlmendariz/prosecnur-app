# El multiplicador por facultad se sella desde el histórico.
#
# Antes de esto `cfg$efectividad` era NULL en los SEIS `.pulso` del repo y
# `factor_facultad` valía 1 en las 5.269 filas del marco: las quince facultades
# dimensionaban con la misma tasa mientras la UI afirmaba que el factor «YA está
# dentro de la tasa que dimensiona».

.sello_esc <- function(estado, efectivas, elegibles) {
  list(estado = estado, efectivas = efectivas, elegibles = elegibles)
}
.sello_cadena <- function(facultad, escalones) {
  list(facultad = facultad, escalones = escalones)
}
# k aulas idénticas de `elegibles` alumnos que rindieron `efectivas` cada una.
.sello_facultad <- function(nombre, k, elegibles, efectivas) {
  .sello_cadena(nombre, lapply(seq_len(k), function(i) .sello_esc("aplicado", efectivas, elegibles)))
}

test_that("el multiplicador es observado sobre esperado, ponderado por elegibles", {
  # Doce aulas de 30 elegibles que rindieron exactamente lo que la curva predice
  # para ese tamaño: el multiplicador tiene que ser 1, no «casi 1».
  esperado_30 <- .cm_efectividad_rendimiento(30)
  filas <- list(.sello_facultad("DERECHO", 12, 30, 30 * esperado_30))
  sello <- calc_muestra_aulas_sello_por_facultad(filas)
  expect_named(sello, "derecho")
  expect_equal(sello$derecho$tau, 1, tolerance = 1e-9)
  expect_identical(sello$derecho$k, 12L)
})

test_that("rendir por encima de la curva da un multiplicador mayor que uno", {
  esperado_30 <- .cm_efectividad_rendimiento(30)
  filas <- list(.sello_facultad("DERECHO", 12, 30, 30 * esperado_30 * 1.2))
  sello <- calc_muestra_aulas_sello_por_facultad(filas)
  expect_equal(sello$derecho$tau, 1.2, tolerance = 1e-6)
})

test_that("las aulas grandes pesan lo que aportan, no una por una", {
  # Una facultad con aulas de dos tamaños: si el esperado se promediara sin
  # ponderar, la de 5 alumnos pesaría igual que la de 100. El ponderado por
  # elegibles es la decisión de Gonzalo (2026-08-25).
  e5 <- .cm_efectividad_rendimiento(5)
  e100 <- .cm_efectividad_rendimiento(100)
  chicas <- lapply(seq_len(6), function(i) .sello_esc("aplicado", 5 * e5, 5))
  grandes <- lapply(seq_len(6), function(i) .sello_esc("aplicado", 100 * e100, 100))
  sello <- calc_muestra_aulas_sello_por_facultad(list(.sello_cadena("DERECHO", c(chicas, grandes))))
  # Cada aula rindió su esperado, así que el multiplicador es 1 con CUALQUIER
  # ponderación; lo que fija la aritmética es el esperado publicado.
  expect_equal(sello$derecho$tau, 1, tolerance = 1e-9)
  esperado_ponderado <- (6 * 5 * e5 + 6 * 100 * e100) / (6 * 5 + 6 * 100)
  expect_equal(sello$derecho$esperado, esperado_ponderado, tolerance = 1e-9)
})

test_that("con once aulas no se publica: el neutro es no llevar entrada", {
  esperado_30 <- .cm_efectividad_rendimiento(30)
  filas <- list(.sello_facultad("PSICOLOGÍA", 11, 30, 30 * esperado_30 * 1.5))
  expect_length(calc_muestra_aulas_sello_por_facultad(filas), 0L)
})

test_that("los escalones que no se aplicaron no contaminan", {
  esperado_30 <- .cm_efectividad_rendimiento(30)
  aplicados <- lapply(seq_len(12), function(i) .sello_esc("aplicado", 30 * esperado_30, 30))
  caido <- .sello_esc("caido", 999, 999)
  sello <- calc_muestra_aulas_sello_por_facultad(list(.sello_cadena("DERECHO", c(aplicados, list(caido)))))
  expect_equal(sello$derecho$tau, 1, tolerance = 1e-9)
  expect_identical(sello$derecho$k, 12L)
})

test_that("sellar deja tau_base en 1 porque lo guardado ES el multiplicador", {
  esperado_30 <- .cm_efectividad_rendimiento(30)
  ref <- list(cadenas_reemplazo = list(filas = list(
    .sello_facultad("DERECHO", 12, 30, 30 * esperado_30 * 1.1)
  )))
  cfg <- calc_muestra_aulas_sellar_efectividad(list(), ref)
  expect_identical(cfg$efectividad$fuente, "historico")
  expect_identical(cfg$efectividad$tau_base, 1)
  expect_length(cfg$efectividad$por_facultad, 1L)
  expect_equal(cfg$efectividad$por_facultad[[1]]$tau, 1.1, tolerance = 1e-6)
  expect_true(isTRUE(cfg$efectividad$por_facultad[[1]]$aplicar))
})

test_that("una declaracion explicita del estudio manda sobre la derivada", {
  esperado_30 <- .cm_efectividad_rendimiento(30)
  ref <- list(cadenas_reemplazo = list(filas = list(
    .sello_facultad("DERECHO", 12, 30, 30 * esperado_30 * 1.1)
  )))
  previa <- list(efectividad = list(
    fuente = "historico", tau_base = 1,
    por_facultad = list(list(facultad = "DERECHO", tau = 0.5, k = 99L, aplicar = TRUE))
  ))
  cfg <- calc_muestra_aulas_sellar_efectividad(previa, ref)
  expect_equal(cfg$efectividad$por_facultad[[1]]$tau, 0.5)
})

test_that("sin historico no se inventa sello", {
  expect_null(calc_muestra_aulas_sellar_efectividad(list(), NULL)$efectividad)
  expect_null(calc_muestra_aulas_sellar_efectividad(list(), list())$efectividad)
})
