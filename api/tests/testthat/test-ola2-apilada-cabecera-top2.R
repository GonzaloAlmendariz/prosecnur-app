# Ola 2, E4 (fix3/after3/p-1.png): en la apilada con cruce de una lámina de dos gráficos en vertical, la cifra «4%» de un
# segmento chico de la primera fila sale «arriba» de la barra, junto a la cabecera «TOP TWO BOX» de la columna extra, y
# las dos cajas quedan pegadas (aire vertical de 0.001 in). La fila de arriba no reserva aire para una cifra elevada
# cuando hay cabecera extra.
#
# Contrato: si una cifra queda a menos de 0.3 in en x de la cabecera «TOP TWO BOX», entre las dos hay al menos 0.05 in
# de aire vertical.

test_that("E4: una cifra cercana en x a la cabecera «TOP TWO BOX» no se le pega en vertical", {
  skip_if_not_installed("officer")
  fx <- .ola2_familias()
  t2 <- list(top2box_labels = c("De acuerdo", "Totalmente de acuerdo"))
  sl <- list(p_slide_2_graficos_vertical(
    titulo = "2 vertical apilada", superior = p_barras_agrupadas(var = "doc$p18"),
    inferior = p_barras_apiladas(var = "doc$q19", cruces = "doc$ded", overrides = t2)))
  pth <- .ola2_pptx(fx, sl)
  cajas <- .ola2_cajas(pth, 1L)
  cab <- cajas[cajas$texto == "TOP TWO BOX", , drop = FALSE]   # G5: una sola forma, la del estándar
  expect_identical(nrow(cab), 1L)
  # E5: el eje lleva las etiquetas del instrumento, no los códigos.
  expect_true(all(c("Tiempo completo (TC)", "Tiempo parcial por asignaturas (TPA)") %in% cajas$texto))

  cifras <- cajas[.ola2_es_cifra(cajas$texto), , drop = FALSE]
  expect_gt(nrow(cifras), 0L)
  malas <- character(0)
  for (i in seq_len(nrow(cifras))) {
    a <- cifras[i, ]
    dx <- .ola2_dist_x(a, cab); ay <- .ola2_aire_y(a, cab)
    if (dx < 0.3 && ay < 0.05) malas <- c(malas, sprintf("%s: %.3f in en x, %.3f in de aire vertical", a$texto, dx, ay))
  }
  expect_identical(malas, character(0))
})
