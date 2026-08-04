# B36/G-2: una apilada de UNA sola fila real (dicotomica tipica) no puede
# quedar como cinta enclenque. Las filas virtuales (min_filas_layout = 2)
# evitan la "barra gigante aislada", pero el grosor auto interpolado para 2
# filas dejaba la banda en ~22% del panel. El piso de 0.95 recupera cuerpo
# editorial sin tocar los casos multi-fila.

test_that("una fila real con filas virtuales recibe el piso de grosor", {
  # n virtual 2 (min_filas_layout) pero una sola categoria real.
  ancho <- .auto_bar_width_apiladas(2, n_reales = 1)
  expect_gte(ancho, 0.95)
})

test_that("el multiplicador del usuario sigue mandando sobre el piso", {
  base <- .auto_bar_width_apiladas(2, n_reales = 1)
  ampliado <- .auto_bar_width_apiladas(2, grosor_barras_mult = 1.2, n_reales = 1)
  expect_gt(ampliado, base)
  expect_lte(ampliado, 1.20)
})

test_that("dos o mas filas reales no cambian su calibracion", {
  expect_equal(
    .auto_bar_width_apiladas(2, n_reales = 2),
    .auto_bar_width_apiladas(2)
  )
  expect_equal(
    .auto_bar_width_apiladas(5, n_reales = 5),
    .auto_bar_width_apiladas(5)
  )
})

test_that("una fila real SIN filas virtuales conserva la calibracion base", {
  # Fuera de canvas no hay filas virtuales (n_eff == n_reales): ahi la barra
  # ya ocupa su banda completa y el piso no aplica.
  expect_equal(
    .auto_bar_width_apiladas(1, n_reales = 1),
    .auto_bar_width_apiladas(1)
  )
})

test_that("la reserva del pie va en su propio carril (B44)", {
  # Sin nota_pie, la banda se reserva en canvas_h_reserva_pie_in — la fila
  # caption desaparece cuando no hay caption y reservar ahi era un no-op.
  out <- .reservar_pie_para_base_slide(list(), min_in = 0.5)
  expect_equal(out$canvas_h_reserva_pie_in, 0.5)
  expect_null(out$canvas_h_caption_in)
  # Con caption propio no se reserva nada.
  con_caption <- .reservar_pie_para_base_slide(list(nota_pie = "Base: 10"), min_in = 0.5)
  expect_null(con_caption$canvas_h_reserva_pie_in)
  # Una reserva explicita mayor se respeta.
  mayor <- .reservar_pie_para_base_slide(list(canvas_h_reserva_pie_in = 0.8))
  expect_equal(mayor$canvas_h_reserva_pie_in, 0.8)
})
