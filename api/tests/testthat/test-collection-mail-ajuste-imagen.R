# Imagen de producto sin pasos fuera de la app: quitar márgenes y tamaño en el
# Destacado (loop editor de correos, L5 y L11; collection_mail_ajuste_imagen.R). Sin red.

# Un producto de 60×30 en el centro de un lienzo de 200×100: con fondo blanco
# (sin alfa) o con aire transparente (con alfa).
.cmai_png <- function(id = "premio", alfa = FALSE) {
  path <- tempfile(fileext = ".png")
  px <- array(1, dim = c(100L, 200L, if (alfa) 4L else 3L))
  if (alfa) px[, , 4] <- 0
  px[36:65, 71:130, 1] <- 0; px[36:65, 71:130, 2] <- 0.3; px[36:65, 71:130, 3] <- 0.67
  if (alfa) px[36:65, 71:130, 4] <- 1
  png::writePNG(px, path)
  list(id = id, path = path, type = "png", size = list(width = 200L, height = 100L),
       bytes = as.numeric(file.info(path)$size), url = NULL, alt = "Premio", export_name = paste0(id, ".png"))
}

.cmai_feature <- function(...) {
  utils::modifyList(list(block_id = "dest", type = "feature", title = "Sorteo", image_ref = "premio", alt = "Tablet",
                         layout = "arriba", crop = list(ratio = "original")), list(...))
}

.cmai_tpl <- function(blocks) {
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  t$blocks <- append(t$blocks, blocks, after = 2L)
  t$images$premio <- list(alt = "Premio")
  t
}

test_that("la caja del contenido: lo que no es casi blanco (sin alfa) o lo que tiene alfa; nada si ya llega al borde", {
  for (alfa in c(FALSE, TRUE)) {
    px <- png::readPNG(.cmai_png(alfa = alfa)$path)
    expect_identical(.cmail_trim_box(px), list(x0 = 70L, y0 = 35L, w = 60L, h = 30L), label = paste("alfa", alfa))
  }
  lleno <- array(0.2, dim = c(10L, 10L, 3L))
  expect_null(.cmail_trim_box(lleno))
})

test_that("image_trim deriva un archivo ajustado que reemplaza al original en el bloque y en el ZIP", {
  for (alfa in c(FALSE, TRUE)) {
    t <- .cmai_tpl(list(.cmai_feature(image_trim = TRUE)))
    imgs <- .cmail_crop_apply(t, list(premio = .cmai_png(alfa = alfa)))
    tid <- imgs$premio$trimmed
    expect_match(tid, "^premio-t60x30-[0-9a-f]{6}$")
    expect_identical(dim(png::readPNG(imgs[[tid]]$path))[1:2], c(30L, 60L))
    expect_true(isTRUE(imgs$premio$superseded))
    expect_identical(.cmail_feature_img(.cmai_feature(image_trim = TRUE), list(images = imgs))$img$id, tid)
  }
})

test_that("sin image_trim la foto sale como siempre; el recorte de proporción se aplica sobre la ajustada", {
  imgs <- .cmail_crop_apply(.cmai_tpl(list(.cmai_feature())), list(premio = .cmai_png()))
  expect_null(imgs$premio$trimmed)
  expect_false(isTRUE(imgs$premio$superseded))
  b <- .cmai_feature(image_trim = TRUE, crop = list(ratio = "1:1"))
  imgs <- .cmail_crop_apply(.cmai_tpl(list(b)), list(premio = .cmai_png()))
  cut <- .cmail_feature_img(b, list(images = imgs))$img
  expect_identical(cut$size, list(width = 30L, height = 30L))
  expect_identical(cut$cropped_from, imgs$premio$trimmed)
})

test_that("image_size: tres cuartos y mitad de la ranura, centrada; en teléfono no se estira", {
  img <- list(size = list(width = 1200L, height = 600L))
  completa <- .cmail_feature_shown(.cmai_feature(), img)
  expect_identical(.cmail_feature_shown(.cmai_feature(image_size = "tres_cuartos"), img), as.integer(round(completa * 0.75)))
  expect_identical(.cmail_feature_shown(.cmai_feature(image_size = "mitad"), img), as.integer(round(completa * 0.5)))
  ctx <- list(pal = .cmail_theme_palette(.cmai_tpl(list()), "#0b1f54", "#0b1f54"), accent = "#0b1f54", width = 600L,
              images = list(premio = c(.cmai_png(), list(url = "https://pulso.pucp.edu.pe/p.png"))), export = FALSE)
  html <- .cmail_block_feature(.cmai_feature(image_size = "mitad"), ctx)
  expect_match(html, '<td align="center" style="padding:0 0 18px 0;', fixed = TRUE)
  expect_false(grepl("cmail-feature-img", html, fixed = TRUE))
})

test_that("image_size e image_trim son cerrados; image_trim vale también en el bloque Imagen", {
  codes <- function(t) vapply(collection_mail_template_validate(t)$problems, `[[`, "", "code")
  expect_true(collection_mail_template_validate(.cmai_tpl(list(.cmai_feature(image_size = "mitad", image_trim = TRUE))))$ok)
  expect_true("bad_image_size" %in% codes(.cmai_tpl(list(.cmai_feature(image_size = "enorme")))))
  expect_true("bad_flag" %in% codes(.cmai_tpl(list(.cmai_feature(image_trim = "si")))))
  img <- list(block_id = "i", type = "image", image_ref = "premio", alt = "Premio", image_trim = TRUE)
  expect_true(collection_mail_template_validate(.cmai_tpl(list(img)))$ok)
})
