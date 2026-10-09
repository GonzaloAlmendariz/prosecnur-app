# **Quién tiene relevo, y cuál.**
#
# La tabla del margen decía quién rindió por debajo y ahí se paraba. Medido el
# 2026-09-10: de los 14 por debajo de lo esperado, 13 tenían una reserva de
# cadena viva. Sin ese dato la tabla es un informe; con él es una lista de
# trabajo.
#
# La trampa que este archivo también sujeta: el enlace es
# `titular_operational_code` y NO `replacement_for` —los dos campos existen—.
# Con el equivocado la medición dio «0 de 14», una alarma inventada.

.marc_titular <- function(cod) list(
  operational_code = cod, sample_role = "titular", sample_status = "aplicada")

.marc_reserva <- function(cod, titular, orden = 1, estado = "en_reserva", extra = list()) {
  c(list(operational_code = cod, sample_role = "chain_reserve",
         titular_operational_code = titular, replacement_order = orden,
         sample_status = estado), extra)
}

test_that("un titular con dos reservas vivas las cuenta y nombra la siguiente", {
  out <- monitoreo_aulas_reserva_de_la_cadena(list(
    .marc_titular("CH 1"),
    .marc_reserva("R 1.2", "CH 1", orden = 2),
    .marc_reserva("R 1.1", "CH 1", orden = 1)
  ))
  expect_identical(out[["CH 1"]]$disponibles, 2L)
  # La SIGUIENTE por orden de reemplazo, no la primera que apareció en la lista:
  # el orden del sorteo es parte del diseño, no una preferencia.
  expect_identical(out[["CH 1"]]$siguiente, "R 1.1")
})

test_that("una reserva ya gastada no cuenta como relevo", {
  for (muerto in c("aplicada", "retirada", "rechazo")) {
    out <- monitoreo_aulas_reserva_de_la_cadena(list(
      .marc_titular("CH 1"), .marc_reserva("R 1.1", "CH 1", estado = muerto)))
    expect_null(out[["CH 1"]], info = muerto)
  }
})

test_that("el enlace es `titular_operational_code`, no `replacement_for`", {
  # La trampa que costó una medición falsa: con `replacement_for` el titular se
  # quedaba sin relevo aunque lo tuviera.
  out <- monitoreo_aulas_reserva_de_la_cadena(list(
    .marc_titular("CH 1"),
    .marc_reserva("R 1.1", "CH 1", extra = list(replacement_for = "otra_cosa_1234"))
  ))
  expect_identical(out[["CH 1"]]$disponibles, 1L)
})

test_that("el banco de extras NO es relevo de cadena", {
  # `extra_reserve_pool` se elige por celda en déficit —eso es
  # `reserva_dirigida`— y no por cadena. Mezclarlos daría un bloque que
  # contesta a medias las dos preguntas.
  out <- monitoreo_aulas_reserva_de_la_cadena(list(
    .marc_titular("CH 1"),
    list(operational_code = "X 9", sample_role = "extra_reserve_pool",
         titular_operational_code = "CH 1", sample_status = "en_reserva")
  ))
  expect_length(out, 0L)
})

test_that("un titular SIN relevo no sale en el mapa", {
  # Y no sale con un cero: un cero se confunde con «no lo he calculado», y el
  # consumidor tiene que poder distinguir las dos cosas.
  out <- monitoreo_aulas_reserva_de_la_cadena(list(.marc_titular("CH 1")))
  expect_length(out, 0L)
})

test_that("una reserva sin titular declarado no cuelga de nadie", {
  out <- monitoreo_aulas_reserva_de_la_cadena(list(
    .marc_reserva("R 9.1", "")))
  expect_length(out, 0L)
})

test_that("sin orden de reemplazo la reserva va al final, no la primera", {
  out <- monitoreo_aulas_reserva_de_la_cadena(list(
    .marc_reserva("R 1.9", "CH 1", orden = NA),
    .marc_reserva("R 1.1", "CH 1", orden = 1)
  ))
  expect_identical(out[["CH 1"]]$siguiente, "R 1.1")
  expect_identical(out[["CH 1"]]$disponibles, 2L)
})

test_that("un plan vacío devuelve un mapa vacío, no un error", {
  expect_length(monitoreo_aulas_reserva_de_la_cadena(list()), 0L)
  expect_length(monitoreo_aulas_reserva_de_la_cadena(NULL), 0L)
})
