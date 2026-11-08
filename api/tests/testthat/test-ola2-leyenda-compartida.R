# Ola 2, G7 (captura «I. Cuatro gráficos con exclusión»): los dos paneles de escala de arriba compartían leyenda y la
# lámina la dibujaba al pie, a todo el ancho, bajo las dos barras categóricas de abajo, que no usan esa escala. Uno de los
# dos paneles iba de respaldo y su imagen ya traía la leyenda.
#
# Contrato: ningún rótulo de la escala queda debajo de la fila de paneles categóricos; la escala conserva una leyenda en
# su fila.

test_that("G7: la leyenda de la escala no cruza bajo los gráficos categóricos que no la usan", {
  skip_if_not_installed("officer")
  pth <- .ola2_lamina_i()
  cajas <- .ola2_cajas(pth, 1L)
  fila_abajo <- min(cajas$y0[cajas$texto %in% c("Sexo", "¿Conoce el reglamento?")])
  ley <- cajas[cajas$texto %in% c("Totalmente en desacuerdo", "Totalmente de acuerdo", "SIN INF"), , drop = FALSE]
  expect_gt(nrow(ley), 0L)
  expect_true(all(ley$y0 < fila_abajo), info = paste(sprintf("%s en y=%.2f", ley$texto, ley$y0), collapse = "; "))
})
