# =============================================================================
# E_INTERNAL no filtra el conditionMessage crudo al cliente (unidad 5.8a)
# =============================================================================
# Un error no-api_error puede traer paths absolutos del usuario u otros
# detalles del sistema en su mensaje. El contrato es: al wire va un mensaje
# genérico + error_id corto (8 hex); el detalle completo va a stderr del
# server con ese mismo id para correlación. Los api_error siguen pasando su
# mensaje tal cual (passthrough intacto).

library(testthat)

test_that("api_error pasa intacto: code, message y details llegan al cliente", {
  err <- tryCatch(
    stop_api(422, "E_TEST_PASSTHROUGH", "mensaje visible para el cliente", details = list(campo = "edad")),
    error = function(e) e
  )
  res <- new.env(parent = emptyenv())
  payload <- handle_api_error(NULL, res, err)

  expect_equal(res$status, 422)
  expect_identical(payload$error$code, "E_TEST_PASSTHROUGH")
  expect_identical(payload$error$message, "mensaje visible para el cliente")
  expect_identical(payload$error$details, list(campo = "edad"))
  expect_null(payload$error$error_id)
})

test_that("error crudo -> E_INTERNAL generico con error_id; el detalle va al log", {
  # Mensaje con path absoluto: exactamente lo que NO debe llegar al cliente.
  err <- simpleError("cannot open file '/Users/gonzalo/privado/base_secreta.sav'")
  res <- new.env(parent = emptyenv())

  # El conditionMessage completo se emite via message() (stderr del server)
  # con el error_id para correlacion.
  payload <- NULL
  expect_message(
    { payload <- handle_api_error(NULL, res, err) },
    regexp = "\\[prosecnur-app\\] E_INTERNAL [0-9A-F]{8}: cannot open file '/Users/gonzalo/privado/base_secreta\\.sav'"
  )

  expect_equal(res$status, 500)
  expect_identical(payload$error$code, "E_INTERNAL")
  # Mensaje generico con la referencia embebida; nada del mensaje original.
  expect_match(payload$error$message, "^Error interno del servidor \\(ref\\. [0-9A-F]{8}\\)\\.$")
  expect_false(grepl("base_secreta", payload$error$message, fixed = TRUE))
  expect_false(grepl("/Users/", payload$error$message, fixed = TRUE))
  # error_id corto, correlacionable: presente en el campo y en el mensaje.
  expect_match(payload$error$error_id, "^[0-9A-F]{8}$")
  expect_true(grepl(payload$error$error_id, payload$error$message, fixed = TRUE))
})

test_that("wrap_endpoint mantiene el mismo shape {error:{code,message}} para errores crudos", {
  fn <- wrap_endpoint(function(req, res) stop("boom interno con detalle sensible"))
  res <- new.env(parent = emptyenv())

  payload <- suppressMessages(fn(NULL, res))

  expect_equal(res$status, 500)
  expect_identical(payload$error$code, "E_INTERNAL")
  expect_true(is.character(payload$error$message) && nzchar(payload$error$message))
  expect_false(grepl("boom interno", payload$error$message, fixed = TRUE))
})
