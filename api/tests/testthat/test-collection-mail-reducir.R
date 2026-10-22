# La imagen del correo más ancha que 1.200 px o más pesada que 1 MB se reduce
# sola al subirla (collection_mail_reducir.R). Fixtures sintéticos con las
# medidas de los banners reales de PUCP (Derecho 3201×1801 / 6,6 MB, Contabilidad
# 1201×810); los archivos del cliente no entran al repo.

.cmr_dims <- function(raw) {
  type <- .cmail_image_type_raw(raw)
  s <- if (identical(type, "png")) .cmail_png_size_raw(raw) else .cmail_jpeg_size_raw(raw)
  c(width = as.integer(s$width), height = as.integer(s$height))
}

.cmr_png <- function(img) png::writePNG(img)

# Banner tipo «Derecho - Encabezado Mailing»: RGBA opaco, degradado con grano
# fotográfico y una franja de color sólido. ~6,6 MB a 3201×1801.
.cmr_derecho_raw <- function() {
  set.seed(7)
  w <- 3201L; h <- 1801L
  x <- matrix(rep(seq(0, 1, length.out = w), each = h), h)
  y <- matrix(rep(seq(0, 1, length.out = h), w), h)
  img <- array(1, dim = c(h, w, 4))
  img[, , 1] <- 0.2 + 0.6 * x; img[, , 2] <- 0.3 + 0.5 * y; img[, , 3] <- 0.5
  for (k in 1:3) img[, , k] <- pmin(pmax(img[, , k] + 0.012 * (stats::runif(h * w) - 0.5), 0), 1)
  img[300:420, 200:1400, 1:3] <- rep(c(0.05, 0.2, 0.6), each = 121 * 1201)
  .cmr_png(img)
}

# Promedio de área de referencia, a fuerza bruta: cobertura fraccionaria exacta
# de cada píxel de entrada sobre cada píxel de salida.
.cmr_area_brute <- function(m, new_w, new_h) {
  cover <- function(n, k) {
    e <- seq(0, n, length.out = k + 1L)
    W <- matrix(0, k, n)
    for (i in seq_len(k)) for (j in seq_len(n)) W[i, j] <- max(0, min(e[i + 1L], j) - max(e[i], j - 1))
    W / rowSums(W)
  }
  cover(nrow(m), new_h) %*% m %*% t(cover(ncol(m), new_w))
}

test_that("Derecho 3201x1801 de 6,6 MB sale a 1200x675, bajo 1 MB y en un tiempo razonable", {
  raw <- .cmr_derecho_raw()
  expect_gt(length(raw), 6e6)
  expect_identical(unname(.cmr_dims(raw)), c(3201L, 1801L))
  t <- system.time(p <- .cmail_image_upload_prepare("Derecho - Encabezado Mailing.png", raw))[["elapsed"]]
  expect_lt(t, 20)
  expect_identical(unname(.cmr_dims(p$raw)), c(1200L, 675L))
  expect_lte(length(p$raw), .CMAIL_IMAGE_MAX_BYTES)
  expect_identical(c(p$width, p$height), c(1200L, 675L))
  expect_true(p$reduccion$reducida)
  expect_identical(p$reduccion$de, "3201×1801")
  expect_identical(p$reduccion$a, "1200×675")
  expect_identical(p$reduccion$peso_antes, length(raw))
  expect_identical(p$reduccion$peso_despues, length(p$raw))
  expect_identical(p$image_id, "derecho-encabezado-mailing")
  # Lo guardado vuelve a pasar la validación estricta de siempre.
  expect_equal(.cmail_image_upload_check("derecho.png", p$raw)$width, 1200)
})

test_that("Contabilidad 1201x810 sale a 1200x809 en PNG", {
  raw <- .cmail_fx_image_raw(1201L, 810L)
  p <- .cmail_image_upload_prepare("Contabilidad - MAILLING_3.png", raw)
  expect_identical(unname(.cmr_dims(p$raw)), c(1200L, 809L))
  expect_identical(p$ext, "png")
  expect_identical(p$type, "png")
  expect_false(p$reduccion$convertida)
  expect_null(p$reduccion$aviso)
})

test_that("1200x600 bajo 1 MB queda intacta byte a byte", {
  raw <- .cmail_fx_image_raw(1200L, 600L)
  p <- .cmail_image_upload_prepare("banner.png", raw)
  expect_identical(p$raw, raw)
  expect_false(p$reduccion$reducida)
  expect_identical(p$reduccion$de, p$reduccion$a)
  jraw <- .cmail_fx_image_raw(900L, 300L, type = "jpeg")
  pj <- .cmail_image_upload_prepare("banner.jpg", jraw)
  expect_identical(pj$raw, jraw)
  expect_identical(pj$ext, "jpg")
})

test_that("nada se deforma: alto = round(1200 * alto/ancho) con +-1 px", {
  casos <- list(c(3201L, 1801L), c(1201L, 810L), c(1200L, 600L), c(4000L, 400L))
  for (cs in casos) {
    raw <- .cmail_fx_image_raw(cs[[1]], cs[[2]])
    p <- .cmail_image_upload_prepare("prop.png", raw)
    d <- .cmr_dims(p$raw)
    esperado <- if (cs[[1]] <= 1200L) cs[[2]] else round(1200 * cs[[2]] / cs[[1]])
    expect_identical(d[["width"]], min(cs[[1]], 1200L), info = paste(cs, collapse = "x"))
    expect_lte(abs(d[["height"]] - esperado), 1, label = paste(cs, collapse = "x"))
    expect_lte(abs(d[["width"]] / d[["height"]] - cs[[1]] / cs[[2]]) * d[["height"]], 1)
  }
  expect_identical(unname(.cmail_reducir_dims(4000L, 400L)), c(1200L, 120L))
})

test_that("JPEG ancho queda JPEG reducido", {
  raw <- .cmail_fx_image_raw(2000L, 1000L, type = "jpeg")
  p <- .cmail_image_upload_prepare("foto.png", raw)
  expect_identical(p$type, "jpeg"); expect_identical(p$ext, "jpg")
  expect_identical(.cmail_image_type_raw(p$raw), "jpeg")
  expect_identical(unname(.cmr_dims(p$raw)), c(1200L, 600L))
  expect_false(p$reduccion$convertida)
})

test_that("PNG fotográfico que sigue pesando más de 1 MB a 1200 px pasa a JPEG 85 y lo avisa", {
  set.seed(3)
  raw <- .cmail_fx_image_raw(1600L, 800L, noise = TRUE)
  p <- .cmail_image_upload_prepare("foto-campus.png", raw)
  expect_identical(.cmail_image_type_raw(p$raw), "jpeg")
  expect_identical(p$ext, "jpg")
  expect_identical(unname(.cmr_dims(p$raw)), c(1200L, 600L))
  expect_lte(length(p$raw), .CMAIL_IMAGE_MAX_BYTES)
  expect_true(p$reduccion$convertida)
  expect_identical(p$reduccion$formato_antes, "png")
  expect_identical(p$reduccion$formato_despues, "jpeg")
  expect_match(p$reduccion$aviso, "JPEG (calidad 85)", fixed = TRUE)
  # Un PNG de 1.200 px pero pesado también se convierte (no hace falta reducir).
  p2 <- .cmail_image_upload_prepare("pesada.png", .cmail_fx_image_raw(1200L, 400L, noise = TRUE))
  expect_identical(p2$type, "jpeg")
  expect_identical(unname(.cmr_dims(p2$raw)), c(1200L, 400L))
})

test_that("la transparencia de un logo ancho se conserva en PNG; el alfa opaco se descarta", {
  img <- array(0, dim = c(200, 2400, 4)); img[, , 1] <- 0.1; img[, 600:1800, 4] <- 1
  p <- .cmail_image_upload_prepare("logo.png", .cmr_png(img))
  out <- png::readPNG(p$raw)
  expect_identical(dim(out), c(100L, 1200L, 4L))
  expect_equal(out[50, 100, 4], 0)
  expect_equal(out[50, 600, 4], 1)
  expect_lte(abs(out[50, 600, 1] - 0.1), 1 / 255)
  opaco <- array(0.5, dim = c(100, 2400, 4)); opaco[, , 4] <- 1
  expect_identical(dim(png::readPNG(.cmail_image_upload_prepare("op.png", .cmr_png(opaco))$raw)), c(50L, 1200L, 3L))
})

test_that("la respuesta de la subida dice qué pasó (contrato para el front)", {
  p <- .cmail_image_upload_prepare("Banner Ancho.png", .cmail_fx_image_raw(2400L, 600L))
  r <- p$reduccion
  expect_setequal(names(r), c("reducida", "convertida", "de", "a", "peso_antes", "peso_despues",
                              "formato_antes", "formato_despues", "aviso"))
  json <- jsonlite::fromJSON(jsonlite::toJSON(r, auto_unbox = TRUE, null = "null"))
  expect_true(json$reducida)
  expect_identical(json$de, "2400×600")
  expect_identical(json$a, "1200×300")
  expect_true(is.numeric(json$peso_antes) && is.numeric(json$peso_despues))
  expect_null(json$aviso)
  expect_named(p, c("raw", "ext", "type", "width", "height", "image_id", "reduccion"))
})

test_that("los mínimos y los errores siguen claros", {
  err <- function(expr) tryCatch({ expr; NULL }, error = function(e) e)
  e <- err(.cmail_image_upload_prepare("angosta.png", .cmail_fx_image_raw(30L, 30L)))
  expect_identical(e$code, "E_COLLECTION_MAIL_IMAGE_INVALID"); expect_identical(e$details$reason, "width")
  e <- err(.cmail_image_upload_prepare("x.gif", c(charToRaw("GIF89a"), as.raw(rep(0, 20)))))
  expect_identical(e$details$reason, "format")
  e <- err(.cmail_image_upload_prepare("___.png", .cmail_fx_image_raw(2000L, 100L)))
  expect_identical(e$details$reason, "name")
  # Cabecera PNG válida (5000x4000 = 20 MP) sin cuerpo: no se intenta decodificar.
  be32 <- function(n) as.raw(c(n %/% 16777216, (n %/% 65536) %% 256, (n %/% 256) %% 256, n %% 256))
  hdr <- c(as.raw(c(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), be32(13), charToRaw("IHDR"),
           be32(5000), be32(4000), as.raw(c(8, 6, 0, 0, 0)), as.raw(rep(0, 4)))
  e <- err(.cmail_image_upload_prepare("enorme.png", hdr))
  expect_identical(e$details$reason, "too_large")
  expect_match(conditionMessage(e), "demasiado grande", fixed = TRUE)
  # Cabecera ancha válida, cuerpo corrupto: ilegible con un mensaje que dice qué hacer.
  hdr2 <- c(as.raw(c(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), be32(13), charToRaw("IHDR"),
            be32(2000), be32(1000), as.raw(c(8, 2, 0, 0, 0)), as.raw(rep(0, 4)), as.raw(rep(7, 200)))
  e <- err(.cmail_image_upload_prepare("rota.png", hdr2))
  expect_identical(e$details$reason, "unreadable")
  expect_match(conditionMessage(e), "vuelve a exportarla", fixed = TRUE)
})

test_that("nitidez: el remuestreo es el promedio de área exacto, no el vecino más cercano", {
  # Factor no entero contra la referencia a fuerza bruta.
  set.seed(11)
  m <- matrix(stats::runif(37 * 83), 37, 83)
  ref <- .cmr_area_brute(m, 50L, 22L)
  expect_lt(max(abs(.cmail_area_resample(m, 50L, 22L) - ref)), 1e-9)
  # Texto de logo: trazos verticales de 1 px a 2400 px reducidos a 1200 px.
  img <- array(1, dim = c(60, 2400, 3)); img[, seq(1, 2400, by = 3), ] <- 0
  out <- .cmail_resample_image(img, 1200L, 30L)
  ref <- array(0, dim = c(30, 1200, 3))
  for (k in 1:3) ref[, , k] <- .cmr_area_brute(img[1:6, 1:60, k], 30L, 3L)[rep(1:3, 10), rep(1:30, 40)]
  err_area <- sqrt(mean((out - ref)^2))
  nn <- img[seq(1, 60, by = 2), seq(1, 2400, by = 2), , drop = FALSE]
  err_nn <- sqrt(mean((nn - ref)^2))
  expect_lt(err_area, 1 / 255)
  expect_gt(err_nn, 0.2)
  # Tras codificar en PNG de 8 bits el error sigue bajo medio nivel.
  p <- .cmail_image_upload_prepare("trazos.png", .cmr_png(img))
  expect_lt(max(abs(png::readPNG(p$raw) - ref)), 1 / 255)
})
