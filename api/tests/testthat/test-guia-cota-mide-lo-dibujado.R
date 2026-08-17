# La guia es la herramienta con la que se verifica el mazo. Una cota que no mide
# lo dibujado no es un decimal de mas: convierte el instrumento en ruido, y fue
# exactamente el sintoma reportado —«no se si te estas guiando de ellas porque
# veo demasiadas cosas que difieren en el mismo tipo de grafico y slide»—.
#
# Historia en dos pasos:
#
# 1. La nota reportaba `grosor_eff * alto_por_cat_grosor`, el alto NOMINAL. El
#    panel se estira despues para llenar el hueco, asi que cantaba ~1.29 cm en
#    casi todas las laminas mientras el mazo dibujaba de 0.693 a 2.068. Medido:
#    la correlacion entre lo que cantaba y lo que se dibujaba era NEGATIVA
#    (-0.353); con `alto_por_cat_eff` paso a +0.588.
# 2. Al poner la regla barra por barra aparecio una segunda discrepancia: la
#    nota cantaba 1.48 cm donde la regla medía 1.36 sobre la MISMA lamina. La
#    regla lee la posicion real en el canvas; la nota, un producto. Ahora las
#    dos usan el mismo calculo.

.linea_nota_barra <- function() {
  f <- readLines(
    testthat::test_path("..", "..", "R", "graficador_barras_apiladas.R"),
    warn = FALSE
  )
  i <- grep("barra_in = ", f)
  expect_length(i, 1L)
  paste(f[i:min(length(f), i + 1L)], collapse = " ")
}


test_that("la nota NO usa el alto nominal", {
  # `alto_por_cat_grosor` es el alto con que se calibro la fraccion, no el que
  # se dibuja.
  expect_false(grepl("alto_por_cat_grosor", .linea_nota_barra(), fixed = TRUE))
})


test_that("la nota usa el mismo calculo que la regla barra por barra", {
  # Dos cifras distintas para lo mismo en la misma lamina es lo que hace
  # criptica a una guia. La regla parte de `(grosor_eff / den) * h_bars_area`,
  # que es la posicion real en el canvas.
  nota <- .linea_nota_barra()
  expect_true(grepl("grosor_eff / den", nota, fixed = TRUE))
  expect_true(grepl("h_bars_area", nota, fixed = TRUE))
})


test_that("la regla barra por barra parte de la misma expresion", {
  f <- readLines(
    testthat::test_path("..", "..", "R", "graficador_barras_apiladas.R"),
    warn = FALSE
  )
  i <- grep("grosor_npc_barra <-", f)
  expect_length(i, 1L)
  expect_true(grepl("(grosor_eff / den) * h_bars_area", f[i], fixed = TRUE))
})


test_that("el titulo de grupo sigue leyendo el alto estirado", {
  # Ya lo hacia, con el comentario «el alto de fila que de verdad se dibujo».
  # Era el unico consumidor que acertaba, y sirvio de pista.
  f <- readLines(
    testthat::test_path("..", "..", "R", "graficador_barras_apiladas.R"),
    warn = FALSE
  )
  expect_length(grep("alto_fila_in = alto_por_cat_eff", f, fixed = TRUE), 1L)
})
