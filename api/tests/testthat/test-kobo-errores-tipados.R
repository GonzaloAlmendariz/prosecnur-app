# Los errores de Kobo que el usuario puede resolver tienen que LLEGARLE.
#
# El defecto que motiva estas pruebas, medido el 2026-07-30 sobre monitoreo
# telefónico: «Ver mis formularios» respondía «Error interno del servidor
# (ref. 286B7740). · E_INTERNAL». La causa real era que el token no tenía
# permiso para listar assets, y el cliente de Kobo ya lo sabía —tenía el
# mensaje exacto—, pero lo lanzaba con `stop()` crudo. `handle_api_error`
# descarta a propósito el mensaje de los errores sin tipo, porque puede filtrar
# rutas del sistema, así que el diagnóstico moría ahí.
#
# Por eso no basta con comprobar el mensaje del `stop`: hay que comprobar que
# sobrevive al handler, que es donde se perdía.

.kbe_res <- function(status, body = "{}") {
  header_lines <- c(sprintf("HTTP/1.1 %d STATUS", as.integer(status)), "", "")
  list(
    status_code = as.integer(status),
    content = charToRaw(body),
    headers = charToRaw(paste(header_lines, collapse = "\r\n"))
  )
}

.kbe_capturar <- function(expr) {
  tryCatch({ force(expr); NULL }, error = function(e) e)
}

test_that("kobo: un 401 sale tipado y no como error genérico", {
  testthat::local_mocked_bindings(
    .kobo_api_http_fetch = function(url, handle) .kbe_res(401L)
  )
  err <- .kbe_capturar(kobo_api_fetch_assets("tok-kobo-fixture"))

  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_KOBO_TOKEN_REJECTED")
  expect_equal(err$status, 401)
  expect_match(conditionMessage(err), "Token rechazado", fixed = TRUE)
})

test_that("kobo: un 404 sale tipado", {
  testthat::local_mocked_bindings(
    .kobo_api_http_fetch = function(url, handle) .kbe_res(404L)
  )
  err <- .kbe_capturar(kobo_api_fetch_assets("tok-kobo-fixture"))

  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_KOBO_NOT_FOUND")
  expect_equal(err$status, 404)
})

test_that("kobo: sin token el código es el del vocabulario, no un stop suelto", {
  err <- .kbe_capturar(kobo_api_fetch_assets(""))

  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_KOBO_TOKEN")
})

# La prueba del defecto de verdad: qué le llega al cliente.
test_that("kobo: el handler entrega el diagnóstico y no «Error interno»", {
  testthat::local_mocked_bindings(
    .kobo_api_http_fetch = function(url, handle) .kbe_res(403L)
  )
  err <- .kbe_capturar(kobo_api_fetch_assets("tok-kobo-fixture"))

  res <- new.env()
  payload <- handle_api_error(list(), res, err)

  expect_equal(res$status, 401)
  expect_equal(payload$error$code, "E_KOBO_TOKEN_REJECTED")
  expect_match(payload$error$message, "Verifica permisos y servidor", fixed = TRUE)
  # Lo que pasaba antes y no debe volver a pasar.
  expect_false(identical(payload$error$code, "E_INTERNAL"))
  expect_false(grepl("Error interno del servidor", payload$error$message, fixed = TRUE))
})
