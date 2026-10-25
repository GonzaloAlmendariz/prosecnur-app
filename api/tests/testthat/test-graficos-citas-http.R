# O3b-a: `GET /api/graficos/citas-candidatas` por el wire (Plumber en subproceso, helper-http-contract.R): la ruta está
# montada en la app real, desenvuelve escalares, ignora parámetros extra (el handler acepta `...`) y tipa sus errores.
# El fixture no tiene comentarios de 40 caracteres o más: responde 200 con la lista de candidatas vacía.

test_that("GET /api/graficos/citas-candidatas responde por el wire y tipa sus errores", {
  .http_contract_skip_if_unavailable()
  srv <- http_contract_server()
  base <- http_contract_upload_base(srv)
  r <- http_get(srv, "/api/graficos/citas-candidatas?variable=region&otro=1", sid = base$sid)
  expect_identical(r$status, 200L)
  expect_true(isTRUE(r$json$ok))
  expect_identical(r$json$variable, "region")
  expect_identical(r$json$comentarios, 8L)
  expect_length(r$json$candidatas, 0L)
  expect_false(isTRUE(r$json$diccionario))
  e <- http_get(srv, "/api/graficos/citas-candidatas?variable=no_existe", sid = base$sid)
  expect_identical(e$status, 404L)
  expect_identical(e$json$error$code, "E_CITAS_VARIABLE_NO_EXISTE")
  e <- http_get(srv, "/api/graficos/citas-candidatas", sid = base$sid)
  expect_identical(e$status, 400L)
  expect_identical(e$json$error$code, "E_CITAS_SIN_VARIABLE")
})

test_that("`?var=` es alias de `variable` y no muere por casar parcialmente con dos argumentos (TXT-19)", {
  .http_contract_skip_if_unavailable()
  srv <- http_contract_server()
  base <- http_contract_upload_base(srv)
  r <- http_get(srv, "/api/graficos/citas-candidatas?var=region", sid = base$sid)
  expect_identical(r$status, 200L)
  expect_true(isTRUE(r$json$ok) || is.list(r$json$candidatas))
})
