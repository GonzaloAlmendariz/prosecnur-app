# El `kind` de /api/files/upload no puede tumbar el endpoint.
#
# Medido el 2026-08-21 subiendo una base con `curl -F "kind=data"` — sin
# Content-Type: text/plain, que es como lo manda cualquier cliente que no lo
# fije a mano. El parser entrega el campo en una forma que el endpoint no
# cubria, `kind_str` quedaba de longitud cero y `nzchar()` sobre eso lanza
# «argument is of length zero»: un E_INTERNAL 500 opaco, con error_id y todo,
# en vez del E_NO_KIND_FIELD que el propio endpoint tiene escrito Y que ademas
# documenta esa via en su mensaje.
#
# Regla de la casa: nada que llegue al cliente sale como error crudo de R, y
# E_INTERNAL no se gasta en un input malformado.

test_that("un kind en forma inesperada da 400 con instrucciones, nunca 500", {
  skip_if_not_installed("curl")
  srv <- http_contract_server()

  r <- http_post_multipart(
    srv, "/api/files/upload",
    fields = list(
      kind = "data",  # sin Content-Type: text/plain — el caso que reventaba
      file = curl::form_file(system.file("DESCRIPTION", package = "prosecnurapp"))
    )
  )
  expect_false(identical(r$status, 500L), info = "el endpoint devolvio E_INTERNAL por un kind mal formado")
  expect_identical(r$status, 400L)
  expect_identical(r$json$error$code, "E_NO_KIND_FIELD")
  # El mensaje tiene que decir COMO arreglarlo, no solo que falta.
  expect_true(grepl("query param", r$json$error$message, fixed = TRUE))
})

test_that("sin kind sigue dando el mismo 400, y con kind valido sube", {
  skip_if_not_installed("curl")
  srv <- http_contract_server()
  archivo <- system.file("DESCRIPTION", package = "prosecnurapp")

  sin_kind <- http_post_multipart(
    srv, "/api/files/upload",
    fields = list(file = curl::form_file(archivo))
  )
  expect_identical(sin_kind$status, 400L)
  expect_identical(sin_kind$json$error$code, "E_NO_KIND_FIELD")

  # La via documentada que si funciona: kind como query param.
  ok <- http_post_multipart(
    srv, "/api/files/upload?kind=data",
    fields = list(file = curl::form_file(archivo))
  )
  expect_identical(ok$status, 201L)
  expect_true(nzchar(ok$json$file_id))
  expect_identical(ok$json$kind, "data")
})

# Medido el 2026-10-20: `?kind=` en la consulta Y un campo `kind` en el
# multipart hacían que plumber pasara `kind` dos veces al handler y R abortara
# antes del cuerpo («formal argument "kind" matched by multiple actual
# arguments») -> E_INTERNAL 500. Regla: mismo valor vale; valores distintos son
# 400 E_KIND_CONFLICT (elegir uno en silencio subiría el archivo como otra cosa).
test_that("kind en consulta y en formulario: igual sube, distinto es 400 E_KIND_CONFLICT, nunca 500", {
  skip_if_not_installed("curl")
  srv <- http_contract_server()
  archivo <- system.file("DESCRIPTION", package = "prosecnurapp")

  igual <- http_post_multipart(
    srv, "/api/files/upload?kind=data",
    fields = list(kind = curl::form_data("data", "text/plain"), file = curl::form_file(archivo))
  )
  expect_identical(igual$status, 201L)
  expect_identical(igual$json$kind, "data")

  distinto <- http_post_multipart(
    srv, "/api/files/upload?kind=data",
    fields = list(kind = curl::form_data("xlsform", "text/plain"), file = curl::form_file(archivo))
  )
  expect_identical(distinto$status, 400L)
  expect_identical(distinto$json$error$code, "E_KIND_CONFLICT")

  # El campo sin text/plain que el parser no lee no choca con la consulta.
  sin_tipo <- http_post_multipart(
    srv, "/api/files/upload?kind=data",
    fields = list(kind = "data", file = curl::form_file(archivo))
  )
  expect_false(identical(sin_tipo$status, 500L))
  expect_identical(sin_tipo$status, 201L)
})
