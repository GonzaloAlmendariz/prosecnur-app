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

test_that("stop_internal emite E_INTERNAL sin filtrar el detalle al cliente", {
  # Un motor que rompe una invariante propia (un artefacto que acaba de
  # escribir y no esta donde lo dejo) no debe propagar el path al wire.
  detalle <- "pulso_pdf_add_link_annotations: no existe el PDF a enlazar: /Users/gonzalo/privado/ficha.pdf"

  err <- NULL
  expect_message(
    { err <- tryCatch(stop_internal(detalle), error = function(e) e) },
    regexp = "\\[prosecnur-app\\] E_INTERNAL [0-9A-F]{8}: pulso_pdf_add_link_annotations"
  )

  expect_s3_class(err, "api_error")
  expect_equal(err$status, 500)
  expect_identical(err$code, "E_INTERNAL")

  # Pasa por el handler como cualquier api_error: sin re-derivar el id.
  res <- new.env(parent = emptyenv())
  payload <- handle_api_error(NULL, res, err)

  expect_equal(res$status, 500)
  expect_identical(payload$error$code, "E_INTERNAL")
  expect_match(payload$error$message, "^Error interno del servidor \\(ref\\. [0-9A-F]{8}\\)\\.$")
  expect_false(grepl("/Users/", payload$error$message, fixed = TRUE))
  expect_false(grepl("ficha.pdf", payload$error$message, fixed = TRUE))
  # El id viaja en details y coincide con el que se embebio en el mensaje.
  expect_match(payload$error$details$error_id, "^[0-9A-F]{8}$")
  expect_true(grepl(payload$error$details$error_id, payload$error$message, fixed = TRUE))
})

test_that("un PDF ausente rompe con E_INTERNAL y no con un stop crudo", {
  links <- list(list(page = 1, x0 = 0.1, y0 = 0.1, x1 = 0.4, y1 = 0.2, url = "https://pulso.pe"))
  faltante <- file.path(tempdir(), "no-existe-este-pdf-de-prueba.pdf")
  expect_false(file.exists(faltante))

  err <- suppressMessages(
    tryCatch(pulso_pdf_add_link_annotations(faltante, links), error = function(e) e)
  )
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_INTERNAL")
  expect_equal(err$status, 500)

  # Sin links no hay nada que anotar: sale antes de tocar el archivo.
  expect_identical(pulso_pdf_add_link_annotations(faltante, list()), invisible(0L))
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
