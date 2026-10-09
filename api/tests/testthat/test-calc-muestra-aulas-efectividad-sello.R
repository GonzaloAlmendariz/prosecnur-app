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

# --- Segundo eslabón: del marco al estrato del cálculo ------------------------
#
# Los estratos viven en `comp$marco$estratos`. Un primer intento los buscó en
# `comp$estratos`, no encontró nada y se retiró por código muerto; este test
# fija la ruta para que el error no se repita.

.tau_estudio <- function(...) {
  list(componentes = list(list(marco = list(estratos = list(...)))))
}

test_that("la tasa del marco baja al estrato que no declara la suya", {
  frame <- list(tasas_efectividad_facultad = list(
    list(facultad = "DERECHO", tasa = 0.562),
    list(facultad = "ESTUDIOS GENERALES CIENCIAS", tasa = 0.436)
  ))
  est <- .tau_estudio(
    list(label = "DERECHO", tau = 0),
    list(label = "ESTUDIOS GENERALES CIENCIAS", tau = 0)
  )
  out <- calc_muestra_aulas_resolver_tau_estratos(est, frame)
  expect_equal(out$componentes[[1]]$marco$estratos[[1]]$tau, 0.562)
  expect_equal(out$componentes[[1]]$marco$estratos[[2]]$tau, 0.436)
})

test_that("no se escribe en comp$estratos, que es otra ruta", {
  # Si alguien mueve la lectura a `comp$estratos` este test lo caza: ahí no hay
  # estratos y el τ se quedaría en 0 para las quince facultades.
  frame <- list(tasas_efectividad_facultad = list(list(facultad = "DERECHO", tasa = 0.562)))
  est <- list(componentes = list(list(estratos = list(list(label = "DERECHO", tau = 0)))))
  out <- calc_muestra_aulas_resolver_tau_estratos(est, frame)
  expect_equal(out$componentes[[1]]$estratos[[1]]$tau, 0)
})

test_that("un estrato que ya declara su tau manda sobre el marco", {
  frame <- list(tasas_efectividad_facultad = list(list(facultad = "DERECHO", tasa = 0.562)))
  out <- calc_muestra_aulas_resolver_tau_estratos(.tau_estudio(list(label = "DERECHO", tau = 0.9)), frame)
  expect_equal(out$componentes[[1]]$marco$estratos[[1]]$tau, 0.9)
})

test_that("una facultad sin tasa publicada se queda en cero y cae al global", {
  frame <- list(tasas_efectividad_facultad = list(list(facultad = "DERECHO", tasa = 0.562)))
  out <- calc_muestra_aulas_resolver_tau_estratos(.tau_estudio(list(label = "PSICOLOGÍA", tau = 0)), frame)
  expect_equal(out$componentes[[1]]$marco$estratos[[1]]$tau, 0)
})

test_that("una tasa fuera de rango no se baja", {
  frame <- list(tasas_efectividad_facultad = list(
    list(facultad = "DERECHO", tasa = 1.4), list(facultad = "EDUCACION", tasa = 0)))
  out <- calc_muestra_aulas_resolver_tau_estratos(
    .tau_estudio(list(label = "DERECHO", tau = 0), list(label = "EDUCACION", tau = 0)), frame)
  expect_equal(out$componentes[[1]]$marco$estratos[[1]]$tau, 0)
  expect_equal(out$componentes[[1]]$marco$estratos[[2]]$tau, 0)
})

test_that("sin marco el estudio sale intacto", {
  est <- .tau_estudio(list(label = "DERECHO", tau = 0))
  expect_identical(calc_muestra_aulas_resolver_tau_estratos(est, NULL), est)
  expect_identical(calc_muestra_aulas_resolver_tau_estratos(est, list()), est)
})

# --- Una referencia sin cadenas de reemplazo no puede tumbar el endpoint ------
#
# `cadenas_reemplazo` no viene ausente cuando no hay datos: viene `NA`, un
# logical de longitud 1. `referencia$cadenas_reemplazo$filas` sobre eso no
# devuelve NULL — LANZA «$ operator is invalid for atomic vectors», y `%||%` no
# lo atrapa porque sólo mira el NULL.
#
# El sellador corre en `POST /api/calc-muestra/marco/construir` FUERA de sus dos
# tryCatch, así que el usuario recibía un 500 E_INTERNAL —sin mensaje, sólo un
# `error_id`— en cuanto había cargado la referencia histórica de asistencia. Es
# el caso normal de una base que trae asistencia y no reemplazos.

test_that("una referencia con `cadenas_reemplazo` atómico no lanza: devuelve la config intacta", {
  cfg <- list(efectividad = NULL, alumnos_por_ch = 30)
  for (valor in list(NA, NA_character_, "", 0L, c(1, 2), TRUE)) {
    ref <- list(periodo = "2025-II", cadenas_reemplazo = valor)
    expect_silent(out <- calc_muestra_aulas_sellar_efectividad(cfg, ref))
    expect_identical(out, cfg)
  }
  # Y el NULL de siempre sigue igual.
  expect_identical(
    calc_muestra_aulas_sellar_efectividad(cfg, list(cadenas_reemplazo = NULL)), cfg)
  expect_identical(calc_muestra_aulas_sellar_efectividad(cfg, NULL), cfg)
})
