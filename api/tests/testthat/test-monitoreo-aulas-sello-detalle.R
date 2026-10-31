# El sello de la publicación del libro guarda qué pasó con cada hoja, para que
# Avance › Salidas lo muestre sin recalcular el juego de hojas.

test_that("el detalle copia hoja, acción y filas del recibo y descarta lo que no tiene hoja", {
  d <- .malp_sello_detalle(list(
    list(hoja = "Base de control", accion = "actualizada", filas = 1392),
    list(hoja = "Aulas Agendadas", accion = "respetada", filas = "190"),
    list(hoja = "", accion = "actualizada", filas = 3),
    "basura",
    list(hoja = "Plan del día", accion = "sin_cambios")
  ))
  expect_length(d, 3L)
  expect_identical(vapply(d, `[[`, "", "hoja"), c("Base de control", "Aulas Agendadas", "Plan del día"))
  expect_identical(vapply(d, `[[`, "", "accion"), c("actualizada", "respetada", "sin_cambios"))
  expect_identical(vapply(d, `[[`, 0L, "filas"), c(1392L, 190L, 0L))
})

test_that("sin recibo el detalle es una lista vacía", {
  expect_identical(.malp_sello_detalle(NULL), list())
  expect_identical(.malp_sello_detalle(list()), list())
})
