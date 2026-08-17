# El radar salia con un cuadro vacio entre el grafico y su tabla, y la tabla
# pegada al borde derecho fuera del marco. Lo vio Gonzalo en el PDF; la vara
# marcaba 22 y no señalaba nada de esto.
#
# El sitio se pedia DOS veces: el canvas del radar reservaba un panel vacio al
# lado del grafico Y el renderer colocaba la tabla en el mismo cajon via
# `geom_frac`. Ahora el canvas no reserva y el slot del grafico se recorta.

test_that("el slot se recorta hasta donde empieza la tabla", {
  slot <- list(loc = list(left = 0.5, top = 1, width = 12, height = 5))
  geom <- list(left = 7.5, top = 1, width = 5, height = 5)
  expect_equal(.plot_slot_recortado_por_tabla(slot, geom)$loc$width, 7)
})


test_that("sin tabla el slot no se toca", {
  slot <- list(loc = list(left = 0.5, top = 1, width = 12, height = 5))
  expect_equal(.plot_slot_recortado_por_tabla(slot, NULL)$loc$width, 12)
})


test_that("un recorte que deja al grafico sin sitio se rechaza", {
  # Por debajo de un tercio del cajon se prefiere el solape: al menos deja ver
  # las dos piezas. Un recorte asi no es un recorte, es borrar el grafico.
  slot <- list(loc = list(left = 0.5, top = 1, width = 12, height = 5))
  geom <- list(left = 2.0, top = 1, width = 10, height = 5)
  expect_equal(.plot_slot_recortado_por_tabla(slot, geom)$loc$width, 12)
})


test_that("una tabla que empieza fuera del cajon no recorta", {
  slot <- list(loc = list(left = 0.5, top = 1, width = 12, height = 5))
  geom <- list(left = 20, top = 1, width = 5, height = 5)
  expect_equal(.plot_slot_recortado_por_tabla(slot, geom)$loc$width, 12)
})


test_that("lo ilegible devuelve el slot intacto", {
  slot <- list(loc = list(left = 0.5, top = 1, width = 12, height = 5))
  expect_equal(.plot_slot_recortado_por_tabla(slot, list(left = NA))$loc$width, 12)
  expect_null(.plot_slot_recortado_por_tabla(NULL, list(left = 5)))
  expect_equal(.plot_slot_recortado_por_tabla(list(), list(left = 5)), list())
})


test_that("el canvas del radar ya NO reserva hueco para su tabla", {
  # Reservarlo aqui Y en el renderer es lo que producia el cuadro vacio. Pero
  # `geom_frac` SE CONSERVA: sin el, `.tabla_nativa_geom()` devuelve NULL, el
  # renderer cae al camino de «solo tabla» y el radar desaparece entero —medido
  # en un intento anterior—.
  f <- paste(readLines(
    testthat::test_path("..", "..", "R", "graficos_radar_multibase.R"),
    warn = FALSE
  ), collapse = "\n")
  bloque <- sub(".*if \\(isTRUE\\(tabla_nativa\\)\\) \\{", "", f)
  bloque <- substr(bloque, 1, 1800)
  expect_false(grepl("plot_grid(grafico, NULL", bloque, fixed = TRUE))
  expect_true(grepl("geom_frac", bloque, fixed = TRUE))
})
