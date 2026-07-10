# Orientación código/etiqueta en `.bases_label_pairs` (helpers_bases.R).
#
# Bug histórico: la heurística asumía que los códigos son SIEMPRE numéricos, e
# invertía las listas con códigos de TEXTO (p.ej. `likert_more_less`, código
# `Han_disminuido`, etiqueta "Han disminuido"), dejando el libro de códigos con
# Código/Etiqueta cambiados. Convención correcta del dicc/labels: names = código,
# values = etiqueta. Señal robusta: los códigos ODK/XLSForm no llevan espacios.

library(testthat)

test_that("select_one con códigos de TEXTO conserva código/etiqueta (no invierte)", {
  labs <- stats::setNames(
    c("Han disminuido", "Se mantienen igual", "Han aumentado"),   # values = etiquetas (con espacios)
    c("Han_disminuido", "Se_mantienen_igual", "Han_aumentado")    # names  = códigos (sin espacios)
  )
  pairs <- .bases_label_pairs(labs)
  expect_equal(pairs$code,  c("Han_disminuido", "Se_mantienen_igual", "Han_aumentado"))
  expect_equal(pairs$label, c("Han disminuido", "Se mantienen igual", "Han aumentado"))
})

test_that("select_one con códigos numéricos sigue correcto", {
  labs <- stats::setNames(c("Totalmente en desacuerdo", "De acuerdo"), c("1", "4"))
  pairs <- .bases_label_pairs(labs)
  expect_equal(pairs$code,  c("1", "4"))
  expect_equal(pairs$label, c("Totalmente en desacuerdo", "De acuerdo"))
})

test_that("input invertido (names con espacios = etiquetas) se detecta y corrige", {
  # names = etiquetas (con espacios), values = códigos (sin espacios).
  labs <- stats::setNames(
    c("Han_disminuido", "Han_aumentado"),      # values = códigos
    c("Han disminuido", "Han aumentado")       # names  = etiquetas
  )
  pairs <- .bases_label_pairs(labs)
  expect_equal(pairs$code,  c("Han_disminuido", "Han_aumentado"))
  expect_equal(pairs$label, c("Han disminuido", "Han aumentado"))
})
