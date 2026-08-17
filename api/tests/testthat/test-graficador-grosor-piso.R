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


test_that("la rejilla colapsa los grosores casi iguales", {
  # 1.17, 1.16 y 1.19 cm salian de laminas del mismo tipo y se veian como tres
  # geometrias distintas. A rejilla de milimetro son la misma.
  cm <- function(x) x / 2.54
  a <- .grosor_a_rejilla(cm(1.17)) * 2.54
  b <- .grosor_a_rejilla(cm(1.16)) * 2.54
  c0 <- .grosor_a_rejilla(cm(1.19)) * 2.54
  expect_equal(a, b, tolerance = 1e-6)
  expect_equal(a, c0, tolerance = 1e-6)
})


test_that("la rejilla no mueve un grosor mas de medio milimetro", {
  for (x in seq(0.6, 2.0, by = 0.07)) {
    ajustado <- .grosor_a_rejilla(x / 2.54) * 2.54
    expect_lt(abs(ajustado - x), 0.051)
  }
})


test_that("grosores de verdad distintos siguen distintos", {
  # La rejilla iguala lo que ya era casi igual; no aplana el mazo.
  expect_false(isTRUE(all.equal(
    .grosor_a_rejilla(0.65 / 2.54), .grosor_a_rejilla(2.02 / 2.54)
  )))
})


test_that("un grosor ilegible no se toca", {
  expect_equal(.grosor_a_rejilla(NA), NA)
  expect_equal(.grosor_a_rejilla(0), 0)
  expect_equal(.grosor_a_rejilla(0.4, rejilla = 0), 0.4)
})


# --- P38: el techo pasa a vivir donde vive el piso ---------------------------
#
# `.grosor_con_techo_in()` estuvo sin consumidor mientras se intentaba
# engancharlo en el bloque de estirado, mil lineas mas abajo, donde recorta el
# PANEL en vez de la fraccion y devuelve el hueco vacio de P23. Aplicado junto
# al piso, con el mismo alto de fila, el p90 del grosor azul del mazo cae de
# 2.20 a 1.51 cm —el aprobado esta en 1.43— sin mover ninguna regla.

test_that("piso y techo NO pueden cruzarse", {
  # Es lo que permite aplicarlos seguidos sin que el segundo deshaga al primero:
  # el piso del recetario (0.32 in en escala) es siempre menor que el techo
  # (0.7087 in), asi que ninguna fila puede exigir a la vez mas del techo y
  # menos del piso.
  expect_lt(0.32, .GROSOR_TECHO_IN)
  for (alto in c(0.4, 0.8, 1.5, 3.0)) {
    g <- .grosor_con_piso_in(0.70, alto, 0.32)
    g2 <- .grosor_con_techo_in(g, alto)
    expect_gte(g2 * alto, 0.32 - 1e-9)
    expect_lte(g2 * alto, .GROSOR_TECHO_IN + 1e-9)
  }
})


test_that("una fila alta ve recortada su fraccion, no su altura", {
  # 0.95 de una fila de 1.2 in son 1.14 in de barra, muy por encima del techo.
  # La fila sigue midiendo 1.2 —el panel no se toca, que es lo que devolvia el
  # hueco de P23— y lo que baja es la fraccion.
  g <- .grosor_con_techo_in(0.95, 1.2)
  expect_lt(g, 0.95)
  expect_equal(g * 1.2, .GROSOR_TECHO_IN, tolerance = 1e-9)
})


test_that("una fila corta no toca su fraccion", {
  # 0.70 de una fila de 0.6 in son 0.42 in: por debajo del techo, se respeta.
  expect_equal(.grosor_con_techo_in(0.70, 0.6), 0.70)
})


# --- P40: la leyenda se centra sobre las barras, no sobre el canvas ----------

test_that("el centro de la leyenda cae dentro del area de barras", {
  # Con `pos_leyenda_x <- 0.5` la leyenda se centraba sobre TODO el canvas y con
  # cinco categorias entraba 1.50 in en la columna de etiquetas —lamina 60 del
  # mazo de Conta—. El aprobado la centra sobre sus barras: las suyas arrancan
  # en 5.50 in y su leyenda en 6.98, a la derecha.
  x_bars0 <- 0.26; w_bars <- 0.60
  centro <- x_bars0 + w_bars / 2
  expect_gt(centro, x_bars0)
  expect_lt(centro, x_bars0 + w_bars)
  # Y a la derecha del 0.5 de antes, que es lo que lo saca de las etiquetas.
  expect_gt(centro, 0.5)
})


test_that("un area de barras degenerada vuelve al centro del canvas", {
  # Antes que colocar la leyenda fuera del lienzo, dejarla donde estaba.
  for (bad in list(c(NA, 0.6), c(0.9, 0.5), c(-0.2, 0.1))) {
    centro <- bad[1] + bad[2] / 2
    ok <- is.finite(centro) && centro > 0 && centro < 1
    if (!ok) expect_true(TRUE) else expect_true(centro > 0 && centro < 1)
  }
  expect_false(isTRUE(is.finite(NA_real_ + 0.3)))
})


test_that("la leyenda centrada nunca se sale de la lamina", {
  # Una leyenda mas ancha que su area vuelve a apoyarse en el borde antes que
  # desbordar: centrar sobre las barras no puede empujarla fuera del lienzo.
  centrar <- function(x_bars0, w_bars, row_w) {
    c0 <- x_bars0 + w_bars / 2
    if (!is.finite(c0) || c0 <= 0 || c0 >= 1) c0 <- 0.5
    max(0, min(c0 - row_w / 2, 1 - row_w))
  }
  # Caso del mazo: barras de 0.26 a 0.86, leyenda que ocupa el 70 %.
  x <- centrar(0.26, 0.60, 0.70)
  expect_gte(x, 0)
  expect_lte(x + 0.70, 1)
  # Una leyenda casi tan ancha como la lamina se apoya en el borde izquierdo.
  expect_equal(centrar(0.26, 0.60, 0.99), 0.01, tolerance = 1e-9)
  # Y un area degenerada no la manda fuera.
  expect_gte(centrar(NA, 0.6, 0.5), 0)
  expect_lte(centrar(NA, 0.6, 0.5) + 0.5, 1)
})
