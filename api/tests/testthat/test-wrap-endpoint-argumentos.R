# Plumber pasa los parámetros de consulta y los campos del cuerpo como argumentos con nombre.
# Un handler sin `...` no debe reventar con "unused argument" (500 en el panel de actualizar una
# fuente y en /instrumento/estado?base_nombre=, 2026-11-12).

test_that("un handler sin ... recibe solo req y res aunque lleguen argumentos extra", {
  f <- wrap_endpoint(function(req, res) "ok")
  expect_identical(f(list(), list(), nombre = "base_1", data_file_id = "x"), "ok")
})

test_that("un handler con ... sigue recibiendo los argumentos extra", {
  f <- wrap_endpoint(function(req, res, ...) list(...)$nombre)
  expect_identical(f(list(), list(), nombre = "base_1"), "base_1")
})
