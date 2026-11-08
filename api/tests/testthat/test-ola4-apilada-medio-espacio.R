# Ola 4, A1 (captura «I. Cuatro gráficos con exclusión», panel de arriba a la izquierda): la apilada de cinco grupos con Top
# Two Box, de respaldo en medio espacio, montaba sus cifras de fuera («8%8%», «2%2%»), dibujaba la leyenda a 7 pt y dejaba
# la barra bajo el piso sin decir nada. Ahora: (a) las cifras de una fila se separan por su tinta; (b) la leyenda no baja
# del cuerpo del estándar y el alto sale del panel; (c) si la barra no llega al piso de media lámina, el motor AVISA.
# Fixture `.ola4_clima()` (helper-ola4-laminas.R).

test_that("A1a: las cifras de fuera de una misma fila no se montan en el respaldo de medio espacio", {
  skip_if_not_installed("officer"); skip_if_not_installed("ggplot2")
  r <- .ola4_lamina_i()
  cj <- .ola2_cajas(r$pptx, 1L)
  izq <- cj[cj$x1 < 6.7 & cj$y0 > 1.7 & cj$y1 < 4.4 & .ola2_es_cifra(cj$texto), , drop = FALSE]
  expect_gte(nrow(izq), 8L)
  # Ninguna pareja de cifras del panel se cruza (las cajas de la apilada de respaldo son su tinta).
  expect_length(.ola2_solapes(izq), 0L)
  # Las de la fila de «Asociado» (8 % y 8 % del lado negativo) quedan con aire entre sí.
  ochos <- izq[izq$texto == "8%", , drop = FALSE]
  ochos <- ochos[order(ochos$y0, ochos$x0), , drop = FALSE]
  if (nrow(ochos) >= 2L && abs(ochos$y0[1] - ochos$y0[2]) < 0.01) expect_gte(ochos$x0[2] - ochos$x1[1], 0.02)
})

test_that("A1b: la leyenda del respaldo no baja del cuerpo del estándar", {
  skip_if_not_installed("officer"); skip_if_not_installed("ggplot2")
  r <- .ola4_lamina_i()
  cj <- .ola2_cajas(r$pptx, 1L)
  ley <- cj[cj$x1 < 6.7 & cj$texto %in% c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF"), ,
            drop = FALSE]
  expect_gte(nrow(ley), 5L)
  expect_true(all(ley$pt >= .std_pt("leyenda") - 0.05))
  expect_identical(.apiladas_leyenda_piso_pt(16), as.numeric(.std_pt("leyenda")))   # 16 puede ceder hasta el estándar, no más
  expect_identical(.apiladas_leyenda_piso_pt(9), 9)                                  # lo pedido menor manda
  # Sin cupo, cede el panel y no cabecera, leyenda ni pie.
  x <- .apiladas_panel_cede_alto(0.5, 3.0, 0.6, 0.2, 2.4)
  expect_true(x$cedio); expect_equal(x$h_total_in, 2.4); expect_equal(x$h_panel_in, 1.1)
  expect_false(.apiladas_panel_cede_alto(0.5, 1, 0.6, 0.2, 2.4)$cedio)               # cabe: no se toca
  expect_false(.apiladas_panel_cede_alto(0.5, 3.5, 1.5, 0.2, 2.4)$cedio)             # el panel quedaría inútil: no se toca
})

test_that("A1c: si la barra no llega al piso de media lámina, el motor avisa y no parte la lámina", {
  skip_if_not_installed("officer"); skip_if_not_installed("ggplot2")
  r <- .ola4_lamina_i()
  av <- grep("no cabe en medio espacio", r$avisos, value = TRUE)
  expect_false(anyDuplicated(av) > 0)                                                  # una vez por gráfico, no por pasada
  expect_true(any(grepl("El gráfico «Existe un buen clima laboral en la Unidad.» no cabe en medio espacio a tamaño estándar: conviene una lámina propia.",
                        av, fixed = TRUE)))
  expect_true(all(startsWith(av, .PULSO_AVISO_SELLO)))
  expect_identical(length(officer::read_pptx(r$pptx)), 1L)                            # sigue siendo una lámina
  expect_length(suppressMessages(.lam_respaldo_avisar_medio_espacio(c(`Una` = 1))), 0L) # sobre el piso: no avisa
})
