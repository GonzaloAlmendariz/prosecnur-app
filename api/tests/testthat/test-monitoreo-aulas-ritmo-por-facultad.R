# El ritmo diario repartido por facultad: la serie global no sabia de facultades
# y el panel de Resumen seguia diciendo el total del operativo con una facultad
# puesta en el selector.

fixture_respuestas <- function() {
  data.frame(
    end = c(
      "2026-09-07T10:00:00", "2026-09-07T11:00:00", "2026-09-08T09:00:00",
      "2026-09-09T18:00:00", "2026-09-09T19:00:00", "2026-09-10T08:00:00"
    ),
    stringsAsFactors = FALSE
  )
}

# PSICOLOGIA: 07, 09, 09   ·   DERECHO: 07, 08   ·   CIENCIAS: 10
fixture_facultades <- function() {
  c("PSICOLOGÍA", "DERECHO", "DERECHO", "PSICOLOGÍA", "PSICOLOGÍA", "CIENCIAS")
}

fixture_cuota <- function() {
  list(facultades = list(
    list(facultad = "PSICOLOGÍA", faculty_key = .cm_criterios_fac_key("PSICOLOGÍA"),
         cuota = 120, brecha = 40),
    list(facultad = "DERECHO", faculty_key = .cm_criterios_fac_key("DERECHO"),
         cuota = 90, brecha = 0)
  ))
}

test_that("reparte las respuestas por facultad y no pierde ninguna", {
  out <- monitoreo_aulas_ritmo_por_facultad(
    fixture_respuestas(), rep(TRUE, 6), fixture_facultades(), fixture_cuota()
  )
  expect_equal(length(out), 3L)
  total <- sum(vapply(out, function(f) sum(vapply(f$dias, function(d) d$validas, integer(1))), numeric(1)))
  expect_equal(total, 6)
})

test_that("la facultad en foco lleva SU serie, no la del operativo", {
  out <- monitoreo_aulas_ritmo_por_facultad(
    fixture_respuestas(), rep(TRUE, 6), fixture_facultades(), fixture_cuota()
  )
  psi <- Filter(function(f) f$facultad == "PSICOLOGÍA", out)[[1]]
  por_dia <- stats::setNames(
    vapply(psi$dias, function(d) d$validas, integer(1)),
    vapply(psi$dias, function(d) d$fecha, character(1))
  )
  expect_equal(unname(por_dia[["2026-09-07"]]), 1L)
  expect_equal(unname(por_dia[["2026-09-08"]]), 0L)
  expect_equal(unname(por_dia[["2026-09-09"]]), 2L)
  expect_equal(psi$mejor_dia$fecha, "2026-09-09")
  expect_equal(psi$mejor_dia$validas, 2L)
  expect_equal(psi$dias_con_campo, 2L)
})

test_that("la meta y la brecha se TOMAN de avance_cuota, no se recalculan", {
  out <- monitoreo_aulas_ritmo_por_facultad(
    fixture_respuestas(), rep(TRUE, 6), fixture_facultades(), fixture_cuota()
  )
  psi <- Filter(function(f) f$facultad == "PSICOLOGÍA", out)[[1]]
  expect_equal(psi$meta, 120)
  # 120 - 3 = 117 si la resta mandara. Manda la suma de las celdas de sexo.
  expect_equal(psi$brecha, 40)
})

test_that("una facultad con cuota CERO de brecha no la confunde con ausente", {
  out <- monitoreo_aulas_ritmo_por_facultad(
    fixture_respuestas(), rep(TRUE, 6), fixture_facultades(), fixture_cuota()
  )
  der <- Filter(function(f) f$facultad == "DERECHO", out)[[1]]
  expect_equal(der$brecha, 0)
})

test_that("una facultad que avance_cuota no lista se publica igual, sin meta", {
  out <- monitoreo_aulas_ritmo_por_facultad(
    fixture_respuestas(), rep(TRUE, 6), fixture_facultades(), fixture_cuota()
  )
  claves <- vapply(out, function(f) f$facultad, character(1))
  expect_true("CIENCIAS" %in% claves)
  cie <- Filter(function(f) f$facultad == "CIENCIAS", out)[[1]]
  expect_equal(cie$meta, 0)
  expect_true(is.na(cie$brecha))
})

test_that("todas las series comparten el eje que se les pide", {
  out <- monitoreo_aulas_ritmo_por_facultad(
    fixture_respuestas(), rep(TRUE, 6), fixture_facultades(), fixture_cuota(),
    desde = "2026-09-07", hasta = "2026-09-10"
  )
  for (f in out) {
    fechas <- vapply(f$dias, function(d) d$fecha, character(1))
    expect_equal(fechas, c("2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10"))
  }
})

test_that("las respuestas que no cuentan no entran a ninguna serie", {
  valid <- c(TRUE, TRUE, FALSE, TRUE, TRUE, TRUE)
  out <- monitoreo_aulas_ritmo_por_facultad(
    fixture_respuestas(), valid, fixture_facultades(), fixture_cuota()
  )
  total <- sum(vapply(out, function(f) sum(vapply(f$dias, function(d) d$validas, integer(1))), numeric(1)))
  expect_equal(total, 5)
})

test_that("sin respuestas, o con el vector de facultades descuadrado, devuelve vacio", {
  expect_equal(monitoreo_aulas_ritmo_por_facultad(), list())
  expect_equal(
    monitoreo_aulas_ritmo_por_facultad(fixture_respuestas(), rep(TRUE, 6), c("A", "B"), fixture_cuota()),
    list()
  )
})

test_that("un eje pedido mas estrecho que los datos NO descarta dias", {
  out <- monitoreo_aulas_ritmo_por_facultad(
    fixture_respuestas(), rep(TRUE, 6), fixture_facultades(), fixture_cuota(),
    desde = "2026-09-09", hasta = "2026-09-09"
  )
  psi <- Filter(function(f) f$facultad == "PSICOLOGÍA", out)[[1]]
  fechas <- vapply(psi$dias, function(d) d$fecha, character(1))
  expect_true("2026-09-07" %in% fechas)
  expect_equal(sum(vapply(psi$dias, function(d) d$validas, integer(1))), 3L)
})
