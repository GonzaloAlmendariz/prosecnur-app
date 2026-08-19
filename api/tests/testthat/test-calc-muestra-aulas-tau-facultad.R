# EF8b-1 — τ diferenciado por facultad: espejo EXACTO del sustento (D1).
#
# Paridad verificada sobre el payload vivo (2026-08-19): 6 facultades
# publicables con cifras identicas al frontend (DERECHO 0.5620 k=16,
# EGC 0.4279 k=26, EGL 0.4435 k=23, C&I 0.5380 k=40, CCSS 0.5498 k=17,
# A&D 0.5186 k=12); las k<12 caen al global DECLARANDOLO.

.tf_cadena <- function(facultad, escalones) {
  list(facultad = facultad, escalones = escalones)
}
.tf_esc <- function(estado, efectivas, elegibles) {
  list(estado = estado, efectivas = efectivas, elegibles = elegibles)
}

test_that("suma solo escalones APLICADOS y publica con k >= 12", {
  aplicados <- lapply(1:12, function(i) .tf_esc("aplicado", 10, 20))
  con_caida <- c(aplicados, list(.tf_esc("caido", 999, 999)))
  taus <- .cm_tau_por_facultad(list(.tf_cadena("DERECHO", con_caida)))
  expect_named(taus, "derecho")
  # 12 x 10/ 12 x 20 = 0.5 — el caido con 999 NO contamina.
  expect_equal(taus$derecho$tau, 0.5)
  expect_equal(taus$derecho$k, 12L)
})

test_that("con k = 11 no publica: un tau de pocas aulas es ruido", {
  once <- lapply(1:11, function(i) .tf_esc("aplicado", 10, 20))
  taus <- .cm_tau_por_facultad(list(.tf_cadena("PSICOLOGÍA", once)))
  expect_length(taus, 0L)
})

test_that("elegibles <= 0 o no numericos se descartan, nunca dividen", {
  esc <- c(
    lapply(1:12, function(i) .tf_esc("aplicado", 10, 20)),
    list(.tf_esc("aplicado", 5, 0), .tf_esc("aplicado", 5, NULL))
  )
  taus <- .cm_tau_por_facultad(list(.tf_cadena("DERECHO", esc)))
  expect_equal(taus$derecho$k, 12L)
  expect_equal(taus$derecho$tau, 0.5)
})

test_that("el dimensionador usa el propio cuando existe y DECLARA el fallback", {
  aplicados <- lapply(1:12, function(i) .tf_esc("aplicado", 12, 20))
  taus <- .cm_tau_por_facultad(list(.tf_cadena("DERECHO", aplicados)))
  propio <- .cm_tau_para_dimensionar("DERECHO", taus, 0.53)
  expect_identical(propio$fuente, "propio_2025")
  expect_equal(propio$tau, 0.6)
  global <- .cm_tau_para_dimensionar("ARQUITECTURA Y URBANISMO", taus, 0.53)
  expect_identical(global$fuente, "global")
  expect_equal(global$tau, 0.53)
})

test_that("la clave de facultad tolera tildes y variantes (misma clave que criterios)", {
  aplicados <- lapply(1:12, function(i) .tf_esc("aplicado", 10, 20))
  taus <- .cm_tau_por_facultad(list(.tf_cadena("PSICOLOGÍA", aplicados)))
  expect_named(taus, "psicologia")
  expect_identical(.cm_tau_para_dimensionar("psicología", taus, 0.53)$fuente, "propio_2025")
})
