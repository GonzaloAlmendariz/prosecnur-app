# /api/monitoreo/territorial/enumerators/upload recibe, junto al Excel, tres
# campos de texto: code_var, ump_var y code_format. El navegador los manda con
# FormData.append(nombre, string), es decir, como partes SIN Content-Type;
# plumber les aplica su parser de formulario y "DNI" llega como list() vacía.
# Entonces el endpoint cae en .extract_text_field, que relee el multipart crudo.
#
# Ese respaldo llamaba a webutils::parse_multipart(content_type = ...) con una
# firma que no existe: fallaba siempre, devolvía "" y el endpoint tomaba el
# valor del padrón anterior o el default. El selector PXXX/DNI de la consola
# territorial nunca surtió efecto (corregido en f425023ad, 2026-09-24).

.roster_excel <- function() {
  path <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(data.frame(
    "AP PATERNO" = c("Quispe", "Mamani", "Huamán"),
    "AP MATERNO" = c("Condori", "Flores", "Rojas"),
    "NOMBRES" = c("Ana", "Luis", "Rosa"),
    "DNI" = c("40123456", "40765432", "41234567"),
    check.names = FALSE
  ), path)
  path
}

.subir_roster <- function(srv, sid, path, campos) {
  http_post_multipart(
    srv, "/api/monitoreo/territorial/enumerators/upload",
    fields = c(list(file = curl::form_file(path, type = "application/octet-stream")), campos),
    sid = sid
  )
}

test_that("los campos de texto sin Content-Type (como los manda el navegador) llegan con su valor", {
  srv <- http_contract_server()
  sid <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))$json$session_id
  path <- .roster_excel()
  withr::defer(unlink(path))

  # Un character en handle_setform sale como parte sin Content-Type.
  r <- .subir_roster(srv, sid, path, list(code_format = "DNI", code_var = "cod_enc", ump_var = "manzana"))
  expect_identical(r$status, 200L)
  roster <- r$json$enumerator_roster
  expect_identical(roster$code_format, "DNI")
  expect_identical(roster$code_var, "cod_enc")
  expect_identical(roster$ump_var, "manzana")
  codigos <- vapply(roster$assignments, function(a) a$codigo_pulso, character(1))
  expect_setequal(codigos, c("40123456", "40765432", "41234567"))
})

test_that("los campos como text/plain también llegan con su valor", {
  srv <- http_contract_server()
  sid <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))$json$session_id
  path <- .roster_excel()
  withr::defer(unlink(path))

  r <- .subir_roster(srv, sid, path, list(
    code_format = curl::form_data("DNI", type = "text/plain"),
    code_var = curl::form_data("cod_enc", type = "text/plain; charset=utf-8"),
    ump_var = curl::form_data("manzana", type = "text/plain")
  ))
  expect_identical(r$status, 200L)
  roster <- r$json$enumerator_roster
  expect_identical(roster$code_format, "DNI")
  expect_identical(roster$code_var, "cod_enc")
  expect_identical(roster$ump_var, "manzana")
})

test_that("sin los campos se conserva el formato del padrón anterior", {
  # El "" sigue significando «no enviado»: sin campo, manda el padrón previo.
  srv <- http_contract_server()
  sid <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))$json$session_id
  path <- .roster_excel()
  withr::defer(unlink(path))

  primero <- .subir_roster(srv, sid, path, list(code_format = "DNI", code_var = "cod_enc"))
  expect_identical(primero$status, 200L)
  segundo <- .subir_roster(srv, sid, path, list())
  expect_identical(segundo$status, 200L)
  expect_identical(segundo$json$enumerator_roster$code_format, "DNI")
  expect_identical(segundo$json$enumerator_roster$code_var, "cod_enc")
  expect_identical(segundo$json$enumerator_roster$ump_var, "ump")
})
