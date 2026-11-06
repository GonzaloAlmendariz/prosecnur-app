# La base de control nunca se escribe en el documento del barrido (Gonzalo,
# 2026-11-02: «los enumeradores solo tienen acceso a la base de barrido no la
# de control»).

sesion_con_barrido <- function() {
  list(monitoreo_sources = list(
    list(id = "b", kind = "google_sheets", role = "barrido",
         sheet_binding = list(spreadsheet_id = "https://docs.google.com/spreadsheets/d/BARRIDO123/edit")),
    list(id = "u", kind = "google_sheets", role = "universo", sheet_binding = list(spreadsheet_id = "UNIVERSO9"))
  ))
}

test_that("publicar en el documento del barrido responde 409 E_MONITOREO_DESTINO_ES_BARRIDO", {
  err <- tryCatch(monitoreo_guarda_destino_no_barrido(sesion_con_barrido(), "BARRIDO123", "la base de control"),
                  api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_MONITOREO_DESTINO_ES_BARRIDO")
  expect_identical(as.integer(err$status), 409L)
  expect_match(conditionMessage(err), "enumeradores")
  # También con el enlace completo.
  expect_error(monitoreo_guarda_destino_no_barrido(sesion_con_barrido(),
                 "https://docs.google.com/spreadsheets/d/BARRIDO123/edit#gid=0"), class = "api_error")
})

test_that("otro documento, aunque sea fuente con otro rol, pasa", {
  expect_true(monitoreo_guarda_destino_no_barrido(sesion_con_barrido(), "CONTROL456"))
  expect_true(monitoreo_guarda_destino_no_barrido(sesion_con_barrido(), "UNIVERSO9"))
  expect_true(monitoreo_guarda_destino_no_barrido(list(), "BARRIDO123"))
})
