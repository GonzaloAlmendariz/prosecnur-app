# La banda que el canvas reserva abajo existe para que la leyenda del grafico no
# choque con el texto de Base del SLIDE. Las tres llamadas del renderer pasaban
# 0.85 in sin justificacion escrita, y ese era el grueso de la mitad inferior
# vacia: el contenido moria al 85.7 % de la zona util contra el 96.5 % del
# entregable aprobado.

test_that("la reserva de las multibase es la medida, no la heredada", {
  # 0.85 dejaba el hueco entre grafico y pie en 1.28 in de mediana contra las
  # 0.78 del aprobado. Con 0.5 baja a 0.98 y la vara pasa de 21 a 18.
  expect_equal(.PLAN_RESERVA_PIE_MULTI_IN, 0.5)
  expect_lt(.PLAN_RESERVA_PIE_MULTI_IN, 0.85)
})


test_that("sin reserva declarada se impone el minimo", {
  args <- .reservar_pie_para_base_slide(list(), min_in = 0.5)
  expect_equal(args$canvas_h_reserva_pie_in, 0.5)
})


test_that("una reserva mayor del analista se conserva", {
  # El minimo es un piso, no un valor: quien pide mas aire lo mantiene.
  args <- .reservar_pie_para_base_slide(list(canvas_h_reserva_pie_in = 1.2), min_in = 0.5)
  expect_equal(args$canvas_h_reserva_pie_in, 1.2)
})


test_that("una reserva menor del analista sube al minimo", {
  args <- .reservar_pie_para_base_slide(list(canvas_h_reserva_pie_in = 0.1), min_in = 0.5)
  expect_equal(args$canvas_h_reserva_pie_in, 0.5)
})


test_that("con nota al pie propia no se reserva nada", {
  # Hay caption de verdad: la banda ya la ocupa el, no hay que abrir otra.
  args <- .reservar_pie_para_base_slide(list(nota_pie = "Fuente: encuesta"), min_in = 0.5)
  expect_null(args$canvas_h_reserva_pie_in)
})


test_that("en Word no se reserva: la Base es un parrafo del documento", {
  # `reporte_word_plan()` agrega la Base debajo de la imagen, asi que la banda
  # solo abriria aire muerto dentro del PNG.
  args <- .reservar_pie_para_base_slide(list(), min_in = 0.5, word_render = TRUE)
  expect_null(args$canvas_h_reserva_pie_in)
})
