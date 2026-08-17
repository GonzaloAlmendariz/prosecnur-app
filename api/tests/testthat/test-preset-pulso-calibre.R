test_that("las cifras de barra salen a 14 pt, no a 16", {
  # `size_texto_barras` va en MILIMETROS —ggplot mide asi— y se convierte a
  # puntos multiplicando por 2.845. El 5.6 de siempre son 15.93 pt; el
  # entregable aprobado escribe sus 740 cifras de porcentaje a 14. Con 4.92 el
  # mazo sale a 13.99.
  expect_equal(.PRESETS_DEFAULT_PULSO$base$size_texto_barras * 2.845, 14,
               tolerance = 0.01)
})


test_that("las etiquetas de eje salen a 12 pt, no a 16", {
  # `size_ejes` ya va en puntos. El aprobado reparte sus etiquetas de texto
  # entre 12 (499) y 13 (311); el motor las sacaba todas a 16, un tercio mas
  # grandes, y ese exceso es el que empujaba los layouts.
  expect_equal(.PRESETS_DEFAULT_PULSO$base$size_ejes, 12)
})


test_that("los graficos con calibre propio conservan el suyo", {
  # `barras_numericas` (5.2), `histograma` (4.8) y el `size_ejes` de 10.5 no
  # valian 5.6 ni 16: son decisiones aparte y un reemplazo por patron los
  # aplastaria sin que ninguna medicion lo notase.
  expect_equal(.PRESETS_DEFAULT_PULSO$barras_numericas$size_texto_barras, 5.2)
  expect_equal(.PRESETS_DEFAULT_PULSO$histograma$size_texto_barras, 4.8)
})


test_that("el calibre es uno solo en todas las familias que lo comparten", {
  # Seis familias declaran `size_texto_barras` a 5.6 y tres `size_ejes` a 16.
  # Si una se queda atras, dos laminas del mismo mazo escriben distinto.
  familias <- c("base", "barras_apiladas", "multi_apiladas", "barras_categoricas")
  for (f in familias) {
    v <- .PRESETS_DEFAULT_PULSO[[f]]$size_texto_barras
    if (!is.null(v)) expect_equal(v, 4.92, info = f)
    e <- .PRESETS_DEFAULT_PULSO[[f]]$size_ejes
    if (!is.null(e)) expect_equal(e, 12, info = f)
  }
})


test_that("la leyenda sale a 12 pt, como las etiquetas", {
  # El defecto mas visible del render de PowerPoint: la leyenda no cabia en su
  # caja en 48 de 48 laminas —contra 8 de 53 del aprobado— y se partia encima
  # del enunciado y de las etiquetas de eje. La causa estaba en la columna del
  # tamano: 15.99 pt contra los 12.0 del aprobado. Al bajar `size_ejes` en el
  # calibre anterior, `size_leyenda` se quedo atras.
  expect_equal(.PRESETS_DEFAULT_PULSO$base$size_leyenda, 12)
  for (f in c("barras_apiladas", "multi_apiladas")) {
    v <- .PRESETS_DEFAULT_PULSO[[f]]$size_leyenda
    if (!is.null(v)) expect_equal(v, 12, info = f)
  }
})


test_that("las leyendas con calibre propio conservan el suyo", {
  # `histograma` (10) y `pie` (12) no valian 16: no entran en el reemplazo.
  expect_equal(.PRESETS_DEFAULT_PULSO$histograma$size_leyenda, 10)
  expect_equal(.PRESETS_DEFAULT_PULSO$pie$size_leyenda, 12)
})
