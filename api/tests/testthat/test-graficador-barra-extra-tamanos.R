# La columna extra no puede escribir más pequeño que el resto de la lámina.
#
# `size_barra_extra` y `size_titulo_extra` viven en DOS capas de defaults que
# estaban desconectadas: `.PRESETS_DEFAULT_PULSO` los declara a 16, pero esa sólo
# llega si el proyecto la trae en su config. Cuando no, se cae a los defaults
# de la firma del graficador —que eran 10 y 8.5— y la columna salía más pequeña
# que el gráfico que la acompaña. Eran 202 cifras a 10 pt y 38 títulos a 8.5,
# el residuo de tipografía más grande del mazo.

test_that("los defaults de la columna extra no bajan del umbral legible", {
  fmls <- formals(graficar_barras_apiladas)
  expect_gte(eval(fmls$size_barra_extra), 11)
  expect_gte(eval(fmls$size_titulo_extra), 11)
})

test_that("la columna extra no escribe mas grande que las barras", {
  # El texto de barra del entregable va a 14 pt: la columna acompaña, no compite.
  fmls <- formals(graficar_barras_apiladas)
  expect_lte(eval(fmls$size_barra_extra), 14)
  expect_lte(eval(fmls$size_titulo_extra), eval(fmls$size_barra_extra))
})

test_that("la capa de presets sigue declarando los suyos", {
  # Si un proyecto SÍ trae la config, manda ella. Este test existe para que
  # subir los defaults de firma no se confunda con haber tocado los presets.
  pr <- .PRESETS_DEFAULT_PULSO$multi_apiladas
  expect_gte(as.numeric(pr$size_barra_extra), 11)
  expect_gte(as.numeric(pr$size_titulo_extra), 11)
})
