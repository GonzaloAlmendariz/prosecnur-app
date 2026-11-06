# Ítem 17 de checklist-arte-vs-conta (Gonzalo, 2026-10-29: «es mejor que no queden barras solas»): la última lámina de
# una multilista partida no se queda con una sola barra si la pregunta de arriba puede bajar con ella.

.it_ss <- function(filas_por_premisa) list(premisas = lapply(filas_por_premisa, function(n) list(texto = "p", filas = as.list(seq_len(n)))))

test_that("la barra sola de la última lámina se lleva la última pregunta del bloque de arriba", {
  partes <- list(list(.it_ss(c(2, 1, 2))), list(.it_ss(1)))
  r <- .lam_multilista_sin_barra_sola(partes, function(x) TRUE)
  expect_equal(.lam_escala_n_barras(r[[1]]), 3)
  expect_equal(.lam_escala_n_barras(r[[2]]), 3)
  expect_false(isTRUE(r[[2]][[1]]$continua))   # pregunta entera: sin «(cont.)»
})

test_that("si al rebalancear algo no cabe, o arriba hay una sola pregunta, la partición queda igual", {
  partes <- list(list(.it_ss(c(2, 1, 2))), list(.it_ss(1)))
  expect_identical(.lam_multilista_sin_barra_sola(partes, function(x) .lam_escala_n_barras(x) <= 2), partes)
  una <- list(list(.it_ss(3)), list(.it_ss(1)))
  expect_identical(.lam_multilista_sin_barra_sola(una, function(x) TRUE), una)
  dos <- list(list(.it_ss(c(2, 2))), list(.it_ss(2)))
  expect_identical(.lam_multilista_sin_barra_sola(dos, function(x) TRUE), dos)
})
