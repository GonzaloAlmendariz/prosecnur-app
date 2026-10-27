# Logos de la franja oscura en blanco y franja sin línea entre logos (loop editor
# de correos, L1 y L2; collection_mail_logo_blanco.R). Sin red.

# Un logo azul oscuro sobre fondo blanco SIN alfa (como logo_pucp.png): la mitad
# izquierda de tinta, la derecha blanca.
.cmlb_png <- function(id = "logo-cliente", w = 40L, h = 20L) {
  path <- tempfile(fileext = ".png")
  px <- array(1, dim = c(h, w, 3))
  px[, seq_len(w %/% 2), 1] <- 0.04; px[, seq_len(w %/% 2), 2] <- 0.12; px[, seq_len(w %/% 2), 3] <- 0.33
  png::writePNG(px, path)
  list(id = id, path = path, type = "png", size = list(width = w, height = h),
       bytes = as.numeric(file.info(path)$size), url = NULL, alt = "Cliente", export_name = paste0(id, ".png"))
}

.cmlb_tpl <- function(...) {
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  t$header <- utils::modifyList(list(kind = "logos", logo_ids = list("logo-cliente", "pulso"), background = "dark"), list(...))
  t
}

.cmlb_images <- function(t) {
  imgs <- list(`logo-cliente` = .cmlb_png("logo-cliente"), pulso = .cmlb_png("pulso"))
  .cmail_logo_white_apply(t, imgs)
}

.cmlb_header <- function(t, images) {
  ctx <- list(pal = .cmail_theme_palette(t, "#0b1f54", "#0b1f54"), accent = "#0b1f54", width = 600L,
              images = images, export = FALSE)
  .cmail_header_html(t, ctx)
}

test_that("la silueta blanca: lo oscuro sale blanco opaco y el fondo blanco sin alfa sale transparente", {
  px <- png::readPNG(.cmlb_png()$path)
  s <- .cmail_white_silhouette(px)
  expect_identical(dim(s), c(20L, 40L, 4L))
  expect_true(all(s[, , 1:3] == 1))
  expect_equal(s[10, 5, 4], 1)     # tinta → opaco
  expect_equal(s[10, 35, 4], 0)    # fondo blanco → transparente (no un rectángulo blanco)
})

test_that("con logo_tone blanco en franja oscura cada logo usa su derivado blanco, que viaja en el ZIP y reemplaza al original", {
  t <- .cmlb_tpl(logo_tone = "blanco")
  imgs <- .cmlb_images(t)
  blanco <- imgs[["logo-cliente"]]$white
  expect_match(blanco, "^logo-cliente-blanco-[0-9a-f]{6}$")
  expect_true(file.exists(imgs[[blanco]]$path))
  expect_true(isTRUE(imgs[["logo-cliente"]]$superseded))
  # La franja dibuja el derivado: la vista previa lo incrusta, así que se compara con la de los originales.
  ctx <- list(images = imgs)
  expect_identical(.cmail_header_logo(ctx, "logo-cliente", TRUE)$id, blanco)
  expect_false(identical(.cmlb_header(t, imgs), .cmlb_header(.cmlb_tpl(), .cmlb_images(.cmlb_tpl()))))
  # El derivado es un PNG con alfa.
  expect_identical(dim(png::readPNG(imgs[[blanco]]$path))[3], 4L)
})

test_that("sin logo_tone, con original o sobre franja clara, los logos salen como siempre", {
  for (t in list(.cmlb_tpl(), .cmlb_tpl(logo_tone = "original"), .cmlb_tpl(logo_tone = "blanco", background = "light"))) {
    imgs <- .cmlb_images(t)
    expect_null(imgs[["logo-cliente"]]$white)
    expect_false(grepl("-blanco-", .cmlb_header(t, imgs)))
  }
})

test_that("un logo que además va en un bloque del cuerpo no queda reemplazado", {
  t <- .cmlb_tpl(logo_tone = "blanco")
  t$blocks <- append(t$blocks, list(list(block_id = "img", type = "image", image_ref = "pulso", alt = "Pulso")), after = 1L)
  imgs <- .cmlb_images(t)
  expect_false(isTRUE(imgs$pulso$superseded))
  expect_true(isTRUE(imgs[["logo-cliente"]]$superseded))
})

test_that("divider = FALSE quita la línea entre logos y conserva el aire; por defecto la línea sigue", {
  con <- .cmlb_header(.cmlb_tpl(), .cmlb_images(.cmlb_tpl()))
  sin <- .cmlb_header(.cmlb_tpl(divider = FALSE), .cmlb_images(.cmlb_tpl(divider = FALSE)))
  expect_match(con, "background-color:#5a6a94;line-height", fixed = TRUE)
  expect_false(grepl("background-color:#5a6a94;line-height", sin, fixed = TRUE))
  expect_match(sin, 'style="padding:0 18px;"', fixed = TRUE)
})

test_that("logo_tone y divider son cerrados y sólo existen en la franja de logos", {
  codes <- function(t) vapply(collection_mail_template_validate(t)$problems, `[[`, "", "code")
  expect_true(collection_mail_template_validate(.cmlb_tpl(logo_tone = "blanco", divider = FALSE))$ok)
  expect_true("bad_logo_tone" %in% codes(.cmlb_tpl(logo_tone = "negro")))
  expect_true("bad_divider" %in% codes(.cmlb_tpl(divider = "no")))
  b <- .cmlb_tpl(); b$header <- list(kind = "banner", image_ref = "logo-cliente", logo_tone = "blanco")
  expect_true("unknown_key" %in% codes(b))
})
