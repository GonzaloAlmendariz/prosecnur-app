source("setup-load-all.R")

# `%||%` lo usa medio motor. Para un data frame `length()` es el numero de
# COLUMNAS, asi que uno de una sola columna entraba en la rama del NA escalar y
# `is.na(a)` devolvia una matriz: `&&` recibia un vector y abortaba con «invalid
# argument type». Las bases reales tienen decenas de columnas y nunca lo tocaban.

test_that("un data frame de una sola columna no revienta el operador", {
  d1 <- data.frame(x = 1:3)
  expect_identical(d1 %||% "defecto", d1)
  # Y uno vacio sigue siendo un valor, no un hueco.
  d0 <- data.frame(x = numeric(0))
  expect_identical(d0 %||% "defecto", d0)
  # Una lista de un elemento tampoco es ausencia.
  expect_identical(list(NA) %||% "defecto", list(NA))
})

test_that("la regla de siempre no cambia", {
  expect_equal(NULL %||% 5, 5)
  expect_equal(NA %||% 5, 5)
  expect_equal(NA_character_ %||% "x", "x")
  expect_equal(3 %||% 5, 3)
  expect_equal("a" %||% "b", "a")
  # Un vector con NAs NO es ausencia: solo el NA de longitud uno.
  expect_equal(c(NA, 2) %||% 9, c(NA, 2))
  expect_equal(character(0) %||% "x", character(0))
})
