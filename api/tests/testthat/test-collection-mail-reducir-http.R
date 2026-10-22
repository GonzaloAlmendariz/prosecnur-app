# Contrato HTTP de la reducción automática: un banner ancho subido por
# /api/files/upload con kind mail_image responde 201, guarda la imagen a
# 1.200 px y la respuesta trae `reduccion` para que el front diga qué pasó.
# Banner sintético con las medidas de un banner real (los del cliente no entran
# al repo).

.cmrh_png_file <- function(width, height) {
  x <- matrix(rep(seq(0, 1, length.out = width), each = height), height)
  img <- array(1, dim = c(height, width, 4))
  img[, , 1] <- 0.2 + 0.6 * x; img[, , 2] <- 0.4; img[, , 3] <- 0.8 - 0.5 * x
  if (height >= 60 && width >= 900) img[20:60, 100:900, 1:3] <- 0.05
  path <- tempfile("Banner Ancho ", fileext = ".png")
  png::writePNG(img, path)
  path
}

test_that("POST /api/files/upload con un banner de 3201x1801 responde 201 con la reducción", {
  skip_if_not_installed("curl")
  srv <- http_contract_server()
  path <- .cmrh_png_file(3201L, 1801L); on.exit(unlink(path), add = TRUE)
  bytes_in <- file.info(path)$size
  sid <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))$json$session_id
  expect_true(is.character(sid) && nzchar(sid))

  r <- http_post_multipart(srv, "/api/files/upload?kind=mail_image", sid = sid,
                           fields = list(file = curl::form_file(path, type = "image/png")))
  expect_identical(r$status, 201L)
  expect_identical(r$json$kind, "mail_image")
  expect_identical(r$json$ext, "png")
  red <- r$json$reduccion
  expect_true(isTRUE(red$reducida))
  expect_false(isTRUE(red$convertida))
  expect_identical(red$de, "3201\u00d71801")
  expect_identical(red$a, "1200\u00d7675")
  expect_equal(red$peso_antes, bytes_in)
  expect_equal(red$peso_despues, r$json$size)
  expect_lte(r$json$size, 1024 * 1024)
  expect_identical(red$formato_antes, "png")
  expect_identical(red$formato_despues, "png")

  # Lo guardado mide 1200x675 de verdad: se baja por el mismo endpoint de archivos.
  got <- http_get(srv, paste0("/api/files/", r$json$file_id, "/download"), sid = sid)
  expect_identical(got$status, 200L)
  s <- .cmail_png_size_raw(got$raw)
  expect_identical(c(s$width, s$height), c(1200, 675))
})

test_that("POST /api/files/upload: una imagen angosta sigue siendo 422 width", {
  skip_if_not_installed("curl")
  srv <- http_contract_server()
  path <- .cmrh_png_file(30L, 30L); on.exit(unlink(path), add = TRUE)
  r <- http_post_multipart(srv, "/api/files/upload?kind=mail_image",
                           fields = list(file = curl::form_file(path, type = "image/png")))
  expect_identical(r$status, 422L)
  expect_identical(r$json$error$code, "E_COLLECTION_MAIL_IMAGE_INVALID")
  expect_identical(r$json$error$details$reason, "width")
})
