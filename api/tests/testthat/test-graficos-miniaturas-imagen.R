test_that("el lote guarda la imagen completa de la lámina, no sólo la miniatura reducida", {
  raiz <- withr::local_tempdir()
  hash <- "h-imagen"
  dir.create(.mini_entrada(raiz, hash)$dir, recursive = TRUE, showWarnings = FALSE)
  tmp <- withr::local_tempfile(fileext = ".png")
  png::writePNG(array(0.5, c(60, 900, 3)), tmp)
  b64 <- paste0("data:image/png;base64,", jsonlite::base64_enc(readBin(tmp, "raw", file.size(tmp))))
  sp <- list(list(png_base64 = b64))

  ruta <- .mini_imagen_png(raiz, hash, sp, quality = "quick", renderer_id = "r1")
  expect_true(file.exists(ruta))
  expect_identical(unname(.mini_png_dims(ruta)), c(900L, 60L))
  mini <- .mini_miniatura_png(raiz, hash, sp, quality = "quick", renderer_id = "r1")
  expect_identical(unname(.mini_png_dims(mini))[1], .MINIATURA_ANCHO)

  expect_identical(.mini_imagen_png(raiz, hash, list(), renderer_id = "r1"), NA_character_)
  expect_identical(.mini_imagen_png(raiz, hash, sp, renderer_id = NA_character_), NA_character_)
})
