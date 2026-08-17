# La guia es la herramienta con la que se verifica el mazo. Una cota que no mide
# lo dibujado no es un decimal de mas: convierte el instrumento en ruido, y fue
# exactamente el sintoma reportado —«no se si te estas guiando de ellas porque
# veo demasiadas cosas que difieren en el mismo tipo de grafico y slide»—.

test_that("la cota de barras usa el alto de fila ESTIRADO, no el nominal", {
  # `alto_por_cat_grosor` es el alto con que se calibro la fraccion. Despues, el
  # bloque «el sobrante va al panel» estira el panel para llenar el hueco y
  # `alto_por_cat_eff` pasa a ser el alto real de la fila. Con el nominal la
  # guia cantaba ~1.29 cm en casi todas las laminas mientras el mazo dibujaba de
  # 0.693 a 2.068.
  f <- readLines(
    testthat::test_path("..", "..", "R", "graficador_barras_apiladas.R"),
    warn = FALSE
  )
  i <- grep("barra_in = grosor_eff", f)
  expect_length(i, 1L)
  expect_true(grepl("alto_por_cat_eff", f[i], fixed = TRUE))
  expect_false(grepl("alto_por_cat_grosor", f[i], fixed = TRUE))
})


test_that("la cota y el titulo de grupo leen el MISMO alto", {
  # `.barras_acotar_titulo_grupo()` ya usaba el estirado, con el comentario «el
  # alto de fila que de verdad se dibujo». Que dos consumidores del mismo dato
  # leyeran altos distintos es lo que hacia divergir la guia del dibujo.
  f <- readLines(
    testthat::test_path("..", "..", "R", "graficador_barras_apiladas.R"),
    warn = FALSE
  )
  cota <- f[grep("barra_in = grosor_eff", f)]
  titulo <- f[grep("alto_fila_in = alto_por_cat_eff", f)]
  expect_length(titulo, 1L)
  expect_true(grepl("alto_por_cat_eff", cota, fixed = TRUE))
})
