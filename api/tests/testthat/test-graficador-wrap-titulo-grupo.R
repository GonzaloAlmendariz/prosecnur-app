source("setup-load-all.R")

# R3 — la geometría se calcula, no se calibra.
#
# El wrap del título de bloque es hoy un factor ajustado a ojo contra UNA
# columna. Este helper mide el texto que se va a dibujar, a su tamaño, en vez de
# asumir un ancho medio de carácter. Está probado y NO cableado: falta trazar el
# `ancho` y el `size_titulos_grupo` reales del render, y conectarlo con insumos
# equivocados cambiaría una constante calibrada por un cálculo erróneo.

TXT <- paste("Considera usted que existe un equilibrio entre el número de",
             "estudiantes admitidos, las actividades desarrolladas en sus cursos")

test_that("mide el texto en vez de asumir un ancho de carácter", {
  # El estimador de siempre usa `size_pt * 0.52`; medido sobre este enunciado
  # ese factor sobreestima, así que en el mismo canal caben MÁS caracteres.
  asumido <- .barras_chars_en_canal(0.20, 12.75, 11)
  medido  <- .barras_wrap_titulo_grupo(TXT, 0.20, 12.75, 11)
  expect_gt(medido, asumido)
})

test_that("crece con el canal y con el cuerpo a la inversa", {
  # Dos propiedades que cualquier cálculo geométrico debe cumplir y que un
  # factor fijo también cumpliría: por eso no bastan solas, pero delatan un
  # helper que devuelva siempre lo mismo.
  expect_gt(.barras_wrap_titulo_grupo(TXT, 0.30, 12.75, 11),
            .barras_wrap_titulo_grupo(TXT, 0.13, 12.75, 11))
  expect_lt(.barras_wrap_titulo_grupo(TXT, 0.20, 12.75, 16),
            .barras_wrap_titulo_grupo(TXT, 0.20, 12.75, 9))
})

test_that("un texto ancho de verdad da menos caracteres que uno estrecho", {
  # ESTE es el aserto que un factor fijo NO puede pasar: mide el texto concreto.
  # Las mayúsculas son más anchas, así que en el mismo canal caben menos.
  ancho_real <- .barras_wrap_titulo_grupo(strrep("M", 60), 0.20, 12.75, 11)
  estrecho   <- .barras_wrap_titulo_grupo(strrep("i", 60), 0.20, 12.75, 11)
  expect_lt(ancho_real, estrecho)
})

test_that("entradas imposibles no dejan el título sin envolver", {
  expect_gte(.barras_wrap_titulo_grupo(TXT, 0, 12.75, 11), 10L)
  expect_gte(.barras_wrap_titulo_grupo(TXT, 0.20, NA, 11), 10L)
  expect_gte(.barras_wrap_titulo_grupo("", 0.20, 12.75, 11), 10L)
})
