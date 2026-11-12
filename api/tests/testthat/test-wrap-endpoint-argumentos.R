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

test_that("un handler sin ... sigue recibiendo los argumentos que declara por nombre (parámetro de ruta)", {
  # /api/files/<file_id>/download quedó en 404 cuando se dejaron de pasar todos los extras.
  f <- wrap_endpoint(function(req, res, file_id, sid = NULL) paste(file_id, sid %||% "-"))
  expect_identical(f(list(), list(), file_id = "abc", sid = "s1", otro = "x"), "abc s1")
  expect_identical(f(list(), list(), file_id = "abc"), "abc -")
})
