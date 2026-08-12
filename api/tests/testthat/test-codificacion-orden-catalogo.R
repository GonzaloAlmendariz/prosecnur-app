source("setup-load-all.R")

# `.add_recoded_q()` sólo ordenaba el catálogo con `choices_order =
# "alphabetical"`. Con el default el orden era el de aparición en los DATOS.
# Medido en «Conta 11-08»: `lst_p4_recod` —una lista que ni siquiera existe en
# el instrumento original, la crea la adaptación— salía 3, 1, 2, 4, y en el mazo
# se leía «De 30 a 35 · De 22 a 25 · De 26 a 29 · De 36 años a más».

test_that("con códigos numéricos manda el valor, no el orden de aparición", {
  # El caso real que lo destapó.
  o <- .codificacion_orden_catalogo(c("3", "1", "2", "4"))
  expect_equal(o, c(2L, 3L, 1L, 4L))
  expect_equal(c("3","1","2","4")[o], c("1","2","3","4"))
})

test_that("un catálogo ya ordenado no se mueve", {
  # El control: si reordenara siempre, no distinguiría el caso bueno del malo.
  expect_equal(.codificacion_orden_catalogo(c("1","2","3")), 1:3)
})

test_that("ordena por VALOR y no por texto", {
  # Es la diferencia que importa: como texto, "10" va antes que "2".
  o <- .codificacion_orden_catalogo(c("2", "10", "1"))
  expect_equal(c("2","10","1")[o], c("1","2","10"))
})

test_that("los códigos no numéricos conservan su orden de aparición", {
  # Ahí el número no ordena nada y reordenar sería inventar un criterio.
  codes <- c("sí", "no", "ns_nr")
  expect_equal(.codificacion_orden_catalogo(codes), 1:3)
})

test_that("`alphabetical` sigue mandando cuando el analista lo pide", {
  codes <- c("b", "a", "c")
  expect_equal(codes[.codificacion_orden_catalogo(codes, "alphabetical")], c("a","b","c"))
  # Y también sobre numéricos, donde alfabético y numérico difieren.
  n <- c("2", "10", "1")
  expect_equal(n[.codificacion_orden_catalogo(n, "alphabetical")], c("1","10","2"))
})

test_that("casos degenerados devuelven un orden usable", {
  expect_equal(.codificacion_orden_catalogo(character(0)), integer(0))
  expect_equal(.codificacion_orden_catalogo("7"), 1L)
})

test_that("los valores especiales los sigue mandando al final el bloque posterior", {
  # El orden numérico pondría el 96 en medio; el bloque de especiales de
  # `.add_recoded_q()` lo empuja al final después. Aquí sólo se comprueba que
  # esta función no interfiere: entrega el orden numérico y no toca esa regla.
  o <- .codificacion_orden_catalogo(c("96", "1", "2"))
  expect_equal(c("96","1","2")[o], c("1","2","96"))
})
