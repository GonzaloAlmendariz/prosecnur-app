test_that("la tabla de rutas de la hoja de zona pone las titulares primero y dice a quién reemplaza cada R", {
  zb <- data.frame(
    id_manzana = c("150108003000450", "150132073000410", "150108003000550"),
    tipo_manzana = c("reemplazo", "titular", "reemplazo"),
    orden_seleccion = c(2L, 1L, 1L),
    hoja_num = c(NA, 76L, NA),
    replacement_order = c(1L, NA, 1L),
    titular_hoja_num = c(47L, NA, 28L),
    manzana = c("0450", "0410", "0550"),
    rango_inicio = c(369L, 601L, 217L),
    rango_fin = c(376L, 608L, 224L),
    viviendas = c(69L, 61L, 72L),
    stringsAsFactors = FALSE
  )
  filas <- .hojas_ruta_hoja_zona_filas(zb)
  expect_length(filas, 3L)
  expect_false(filas[[1]]$reemplazo)
  expect_equal(filas[[1]]$manzana, "0410")
  expect_equal(filas[[1]]$encuestas, "601–608")
  expect_equal(filas[[1]]$reemplaza, "—")
  expect_true(all(vapply(filas[2:3], `[[`, FALSE, "reemplazo")))
  expect_setequal(vapply(filas[2:3], `[[`, "", "reemplaza"), c("UMP 47", "UMP 28"))
})

test_that("sin rutas la tabla queda vacía", {
  expect_length(.hojas_ruta_hoja_zona_filas(data.frame()), 0L)
})

test_that("la hoja de una zona con titulares no lleva sus reemplazos; sin titulares, los reemplazos", {
  zb <- data.frame(
    id_manzana = c("150108003000450", "150132073000410", "150132073000420"),
    tipo_manzana = c("reemplazo", "titular", "titular"),
    orden_seleccion = c(1L, 1L, 2L),
    hoja_num = c(NA, 76L, 77L),
    titular_hoja_num = c(47L, NA, NA),
    manzana = c("0450", "0410", "0420"),
    rango_inicio = c(369L, 601L, 609L),
    rango_fin = c(376L, 608L, 616L),
    viviendas = c(69L, 61L, 40L),
    stringsAsFactors = FALSE
  )
  rutas <- .hojas_ruta_hoja_zona_rutas(zb)
  expect_equal(vapply(rutas, `[[`, "", "manzana"), c("0410", "0420"))
  expect_equal(sum(vapply(rutas, `[[`, 0L, "encuestas_n")), 16L)
  solo_r <- .hojas_ruta_hoja_zona_rutas(zb[1, , drop = FALSE])
  expect_length(solo_r, 1L)
  expect_true(solo_r[[1]]$reemplazo)
})

test_that("el resumen abrevia la lista de rutas", {
  expect_equal(.hojas_ruta_hz_lista_rutas(c("UMP 1", "UMP 2", "UMP 5")), "UMP 1, 2, 5")
  expect_equal(.hojas_ruta_hz_lista_rutas(paste("UMP", 1:8)), "UMP 1, 2, 3, 4, 5, 6 y 2 más")
  expect_equal(.hojas_ruta_hz_lista_rutas(character(0)), "—")
})
