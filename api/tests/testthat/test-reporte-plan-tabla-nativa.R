source("setup-load-all.R")

# ADR 0072: toda tabla del entregable va nativa. La de apoyo del radar se
# dibujaba dentro del canvas de ggplot, con una veintena de parámetros de
# padding, wrap, autofit y clip para resolver a mano lo que un motor de tablas
# resuelve solo. El barrido del mazo de acreditación daba 0 elementos `<a:tbl>`.

test_that("el slot se parte en gráfico y tabla sin salirse", {
  spec <- list(loc = list(left = 0.4, top = 1.2, width = 12.5, height = 5.5))
  out <- .tabla_nativa_partir_slot(spec, frac_tabla = 0.40, gap_in = 0.15)
  expect_named(out, c("grafico", "tabla"))
  # Los dos caben en el ancho original, con su aire.
  expect_equal(out$grafico$loc$width + 0.15 + out$tabla$loc$width, 12.5)
  # La tabla arranca donde acaba el gráfico más el aire.
  expect_equal(out$tabla$loc$left, out$grafico$loc$left + out$grafico$loc$width + 0.15)
  # El alto y el borde superior no se tocan.
  expect_equal(out$tabla$loc$top, spec$loc$top)
  expect_equal(out$tabla$loc$height, spec$loc$height)
})

test_that("la fracción manda sobre el reparto", {
  spec <- list(loc = list(left = 0, top = 0, width = 10, height = 5))
  ancha <- .tabla_nativa_partir_slot(spec, frac_tabla = 0.60, gap_in = 0)
  angosta <- .tabla_nativa_partir_slot(spec, frac_tabla = 0.20, gap_in = 0)
  expect_equal(ancha$tabla$loc$width, 6)
  expect_equal(angosta$tabla$loc$width, 2)
  # El control: si la fracción no gobernara, las dos darían lo mismo.
  expect_gt(ancha$tabla$loc$width, angosta$tabla$loc$width)
})

test_that("un slot no partible devuelve NULL y el llamador dibuja como antes", {
  expect_null(.tabla_nativa_partir_slot(NULL))
  expect_null(.tabla_nativa_partir_slot(list()))
  expect_null(.tabla_nativa_partir_slot(list(loc = list(left = 0, top = 0))))
  # El aire no puede comerse el slot entero.
  expect_null(.tabla_nativa_partir_slot(list(loc = list(left = 0, top = 0, width = 1, height = 3)),
                                        gap_in = 2))
})

test_that("acepta el loc en forma de vector", {
  out <- .tabla_nativa_partir_slot(list(loc = c(0.5, 1, 12, 5)), frac_tabla = 0.5, gap_in = 0)
  expect_equal(out$grafico$loc$width, 6)
  expect_equal(out$tabla$loc$left, 6.5)
})

test_that("la tabla nativa conserva su encabezado", {
  # La ficha técnica borra el suyo con `delete_part()` porque su primera columna
  # ya nombra cada fila; aquí el encabezado lleva los públicos comparados y es
  # parte del dato.
  skip_if_not_installed("flextable")
  df <- data.frame(Tema = c("Auditoría", "Finanzas"),
                   docentes = c("96%", "96%"), egresados = c("98%", "93%"),
                   stringsAsFactors = FALSE, check.names = FALSE)
  ft <- .tabla_nativa_flextable(df, ancho_in = 4.2)
  expect_s3_class(ft, "flextable")
  expect_equal(nrow(ft$header$dataset), 1L)
  expect_equal(nrow(ft$body$dataset), 2L)
  expect_equal(names(ft$body$dataset), c("Tema", "docentes", "egresados"))
})

test_that("un data.frame vacío no produce tabla", {
  skip_if_not_installed("flextable")
  expect_null(.tabla_nativa_flextable(data.frame(), ancho_in = 4))
})
