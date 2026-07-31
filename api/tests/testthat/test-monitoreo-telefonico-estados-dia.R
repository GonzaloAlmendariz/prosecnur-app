# Estados telefónicos por cuota y día.
#
# La vista de cuotas pintaba el apilado global bajo el rótulo de cada cuota, que
# afirma algo falso: ese no es el barrido de esa cuota.

test_that("desglosa por actor conservando la partición del bloque global", {
  actors <- c("A", "A", "A", "B", "B")
  status <- c("Efectivo", "No contesta", "Efectivo", "Efectivo", "Rechazo")
  dates <- c("2026-08-04", "2026-08-04", "2026-08-05", "2026-08-04", "2026-08-05")
  fechas <- c("2026-08-04", "2026-08-05")

  out <- .monitoreo_phone_status_actor_day(
    actors, status, dates,
    status_labels = c("Efectivo", "No contesta", "Rechazo"),
    dates_sorted = fechas
  )

  expect_setequal(unique(out$Actor), c("A", "B"))
  # La suma de las cuotas reproduce el total del estudio: 5 casos barridos.
  expect_equal(sum(out$Total), 5L)

  efectivo_a <- out[out$Actor == "A" & out$Estado == "Efectivo", , drop = FALSE]
  expect_equal(efectivo_a$`2026-08-04`, 1L)
  expect_equal(efectivo_a$`2026-08-05`, 1L)
  expect_equal(efectivo_a$Total, 2L)
})

test_that("todas las filas traen las mismas columnas de fecha", {
  # Un actor sin casos un día trae cero, no se salta la columna: si no, las
  # series de dos cuotas quedarían desalineadas entre sí.
  out <- .monitoreo_phone_status_actor_day(
    actors = c("A", "B"),
    status = c("Efectivo", "Rechazo"),
    dates = c("2026-08-04", "2026-08-05"),
    status_labels = c("Efectivo", "Rechazo"),
    dates_sorted = c("2026-08-04", "2026-08-05")
  )

  expect_true(all(c("2026-08-04", "2026-08-05") %in% names(out)))
  expect_equal(out$`2026-08-05`[out$Actor == "A"], 0L)
})

test_that("un estado que el actor no registró no aporta una fila de ceros", {
  out <- .monitoreo_phone_status_actor_day(
    actors = c("A", "A"),
    status = c("Efectivo", "Efectivo"),
    dates = c("2026-08-04", "2026-08-04"),
    status_labels = c("Efectivo", "Rechazo", "Apagado"),
    dates_sorted = "2026-08-04"
  )

  expect_equal(nrow(out), 1L)
  expect_identical(out$Estado, "Efectivo")
})

test_that("sin estados o sin fechas devuelve una tabla vacía con su forma", {
  vacio <- .monitoreo_phone_status_actor_day(character(0), character(0), character(0), character(0), character(0))
  expect_equal(nrow(vacio), 0L)
  expect_true(all(c("Actor", "Estado", "Total") %in% names(vacio)))
})

test_that("los actores sin nombre no producen una cuota fantasma", {
  out <- .monitoreo_phone_status_actor_day(
    actors = c("A", "", NA_character_),
    status = c("Efectivo", "Efectivo", "Efectivo"),
    dates = rep("2026-08-04", 3L),
    status_labels = "Efectivo",
    dates_sorted = "2026-08-04"
  )

  expect_identical(unique(out$Actor), "A")
})
