# Un CSV subido desde el navegador llega con Content-Type text/csv, y plumber
# aplica a esa parte del multipart su parser de texto: `file` deja de ser raw
# y la ruta respondía 400 E_BAD_FILE («Could not extract file bytes»).
# curl manda octet-stream y por eso los tests por curl nunca lo vieron.
# Encontrado en el recorrido de usuario nuevo de Muestra general (2026-09-24).

test_that("un CSV subido como text/csv entra con sus bytes intactos", {
  srv <- http_contract_server()
  sid <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))$json$session_id
  path <- tempfile(fileext = ".csv")
  withr::defer(unlink(path))
  writeLines(c("codigo,distrito,personas", "H00001,Cayma,3", "H00002,Cercado,5", "H00003,Año Nuevo,2"),
             path, useBytes = TRUE)
  subida <- http_post_multipart(srv, "/api/files/upload?kind=data",
                                fields = list(file = curl::form_file(path, type = "text/csv")), sid = sid)
  expect_identical(subida$status, 201L)
  expect_identical(as.integer(subida$json$size), as.integer(file.size(path)))
})

test_that("el helper del multipart crudo encuentra el boundary", {
  expect_identical(.multipart_boundary("multipart/form-data; boundary=----abc123"), "----abc123")
  expect_identical(.multipart_boundary('multipart/form-data; boundary="x-y"'), "x-y")
  expect_identical(.multipart_boundary("application/json"), "")
})
