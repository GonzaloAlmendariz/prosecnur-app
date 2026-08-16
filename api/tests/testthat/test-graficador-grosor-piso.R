# El piso de grosor se declara en pulgadas, no en fracción de fila.

test_that("el alto de fila por defecto es el declarado", {
  expect_equal(.grosor_alto_por_categoria(), 0.42)
  expect_equal(.grosor_alto_por_categoria(0.55), 0.55)
  expect_equal(.grosor_alto_por_categoria(NULL), 0.42)
  # Un alto inválido cae al de por defecto en vez de propagar el disparate.
  expect_equal(.grosor_alto_por_categoria(-1), 0.42)
  expect_equal(.grosor_alto_por_categoria(NA), 0.42)
})

test_that("las etiquetas de varias lineas ensanchan la fila", {
  expect_equal(.grosor_alto_por_categoria(0.42, TRUE, 5L), 0.96)
  expect_equal(.grosor_alto_por_categoria(0.42, TRUE, 8L), 1.06)
  # Y nunca la encogen por debajo de lo declarado.
  expect_equal(.grosor_alto_por_categoria(1.20, TRUE, 8L), 1.20)
})

test_that("el piso sube el grosor hasta alcanzar las pulgadas pedidas", {
  # Fila de 0.42 in: para 0.32 in de barra hace falta el 76 % de la fila.
  g <- .grosor_con_piso_in(0.60, 0.42, 0.32)
  expect_equal(g, 0.32 / 0.42)
  expect_gte(.grosor_en_pulgadas(g, 0.42), 0.32)
})

test_that("un grosor que ya cumple no se toca", {
  # 0.85 de una fila de 0.42 son 0.357 in, por encima del piso.
  expect_equal(.grosor_con_piso_in(0.85, 0.42, 0.32), 0.85)
  # El piso nunca adelgaza una barra.
  expect_gte(.grosor_con_piso_in(0.90, 0.42, 0.10), 0.90)
})

test_that("una fila demasiado corta llega al tope y no mas", {
  # Fila de 0.20 in: ni la barra entera alcanza 0.32. Se topa en 0.92 en vez
  # de pegar las barras unas con otras.
  g <- .grosor_con_piso_in(0.60, 0.20, 0.32)
  expect_equal(g, .GROSOR_TOPE_FRACCION)
  expect_lt(.grosor_en_pulgadas(g, 0.20), 0.32)
})

test_that("el piso se puede desactivar", {
  expect_equal(.grosor_con_piso_in(0.60, 0.42, NULL), 0.60)
  expect_equal(.grosor_con_piso_in(0.60, 0.42, 0), 0.60)
  expect_equal(.grosor_con_piso_in(0.60, 0.42, NA), 0.60)
})

test_that("entradas invalidas devuelven el grosor sin tocar", {
  expect_equal(.grosor_con_piso_in(0.60, NA, 0.32), 0.60)
  expect_equal(.grosor_con_piso_in(0.60, 0, 0.32), 0.60)
})


test_that("el techo recorta una barra que se pasa", {
  # Cuadrante de dos barras que estira su panel: pedia 1.68 cm y el aprobado no
  # pasa de 1.0 en ninguna lamina.
  alto <- 2.0
  g <- .grosor_con_techo_in(0.90, alto, techo_in = 0.394)
  expect_equal(.grosor_en_pulgadas(g, alto), 0.394, tolerance = 1e-9)
})


test_that("una barra por debajo del techo no se toca", {
  expect_equal(.grosor_con_techo_in(0.30, 0.60, techo_in = 0.394), 0.30)
})


test_that("el techo se cumple siempre, a diferencia del piso", {
  # Recortar nunca crea un problema de espacio, asi que no hay caso en que el
  # techo se quede sin aplicar.
  for (alto in c(0.5, 1, 2, 4)) {
    g <- .grosor_con_techo_in(0.92, alto, techo_in = 0.394)
    expect_lte(.grosor_en_pulgadas(g, alto), 0.394 + 1e-9)
  }
})


test_that("un techo invalido deja el grosor como estaba", {
  expect_equal(.grosor_con_techo_in(0.7, 1, techo_in = NULL), 0.7)
  expect_equal(.grosor_con_techo_in(0.7, 1, techo_in = 0), 0.7)
  expect_equal(.grosor_con_techo_in(0.7, NA, techo_in = 0.394), 0.7)
})


test_that("piso y techo se pueden componer sin pelearse", {
  alto <- 0.42
  g <- .grosor_con_piso_in(0.30, alto, piso_in = 0.256)
  g <- .grosor_con_techo_in(g, alto, techo_in = 0.394)
  medido <- .grosor_en_pulgadas(g, alto)
  expect_gte(medido, 0.256 - 1e-9)
  expect_lte(medido, 0.394 + 1e-9)
})
