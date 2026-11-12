# Plumber pasa cada parámetro de consulta como argumento con nombre al handler.
# Un handler `function(req, res)` sin `...` revienta con "unused argument" en
# cuanto el cliente manda `?base_nombre=` (500 en GET /instrumento/estado,
# visto el 2026-11-12). Toda ruta de Validación acepta argumentos libres.

rutas_sin_argumentos_libres <- function(path) {
  lineas <- readLines(path, warn = FALSE)
  grep("wrap_endpoint\\(function\\(req, res\\)", lineas)
}

test_that("las rutas de Validación aceptan parámetros de consulta", {
  path <- testthat::test_path("..", "..", "R", "router_validacion.R")
  skip_if_not(file.exists(path), "router_validacion.R no está en el árbol")
  expect_identical(rutas_sin_argumentos_libres(path), integer(0))
})

test_that("un handler con `...` responde aunque llegue base_nombre por consulta", {
  f <- wrap_endpoint(function(req, res, ...) "ok")
  expect_identical(f(list(), list(), base_nombre = "base_1"), "ok")
})
