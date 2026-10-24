# Recorte de la foto a una proporción fija (GOAL editor de correos profesional,
# L7; collection_mail_recorte.R): geometría, validación, archivo derivado, ZIP,
# render y nitidez. Sin red.

.cmrc_jpeg <- function(w, h, id = "premio") {
  path <- tempfile(fileext = ".jpg")
  px <- array(0, dim = c(h, w, 3))
  px[, , 1] <- matrix(seq(0, 1, length.out = w), nrow = h, ncol = w, byrow = TRUE)  # rojo crece hacia la derecha
  px[, , 2] <- matrix(seq(0, 1, length.out = h), nrow = h, ncol = w)                 # verde crece hacia abajo
  jpeg::writeJPEG(px, path, quality = 0.95)
  list(id = id, path = path, type = "jpeg", size = list(width = w, height = h),
       bytes = as.numeric(file.info(path)$size), url = NULL, alt = "Premio", export_name = paste0(id, ".jpg"))
}

.cmrc_feature <- function(...) {
  utils::modifyList(list(block_id = "dest", type = "feature", title = "Sorteo MARCA", image_ref = "premio",
                         alt = "Audífonos"), list(...))
}

.cmrc_tpl <- function(blocks) {
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  t$blocks <- append(t$blocks, blocks, after = 2L)
  t$images$premio <- list(alt = "Premio")
  .cmail_template_normalize(t)
}

# ---- geometría ------------------------------------------------------------------

test_that("sin crop: 1:1 con la foto a un lado, 2:1 arriba; «original» no recorta", {
  expect_identical(.cmail_crop_of(.cmrc_feature())$ratio, "1:1")
  expect_identical(.cmail_crop_of(.cmrc_feature(layout = "derecha"))$ratio, "1:1")
  expect_identical(.cmail_crop_of(.cmrc_feature(layout = "arriba"))$ratio, "2:1")
  expect_null(.cmail_crop_of(.cmrc_feature(crop = list(ratio = "original"))))
})

test_that("el rectángulo respeta la proporción, el centro y el zoom, sin salirse de la foto", {
  apaisada <- list(width = 1200, height = 800)
  expect_identical(.cmail_crop_rect(apaisada, .cmail_crop_of(.cmrc_feature())), list(x0 = 200L, y0 = 0L, w = 800L, h = 800L))
  # Centro a la izquierda: el recorte se pega al borde, no se sale.
  expect_identical(.cmail_crop_rect(apaisada, .cmail_crop_of(.cmrc_feature(crop = list(x = 0))))$x0, 0L)
  expect_identical(.cmail_crop_rect(apaisada, .cmail_crop_of(.cmrc_feature(crop = list(x = 1))))$x0, 400L)
  # Zoom 2: la mitad del lado.
  expect_identical(.cmail_crop_rect(apaisada, .cmail_crop_of(.cmrc_feature(crop = list(zoom = 2))))[c("w", "h")], list(w = 400L, h = 400L))
  # Un borde que cae en una mitad redondea hacia arriba, igual que el editor (modeloRecorte.ts).
  expect_identical(.cmail_crop_rect(apaisada, .cmail_crop_of(.cmrc_feature(crop = list(ratio = "4:3", y = 0, zoom = 1.5)))),
                   list(x0 = 245L, y0 = 0L, w = 711L, h = 533L))
  # 2:1 en una cuadrada: toda la anchura, la mitad de alto, centrada.
  expect_identical(.cmail_crop_rect(list(width = 1000, height = 1000), .cmail_crop_of(.cmrc_feature(layout = "arriba"))),
                   list(x0 = 0L, y0 = 250L, w = 1000L, h = 500L))
})

test_that("la validación acepta lo cerrado y rechaza lo demás", {
  ok <- .cmrc_tpl(list(.cmrc_feature(crop = list(ratio = "4:3", x = 0.3, y = 0.7, zoom = 1.5))))
  v <- collection_mail_template_validate(ok)
  expect_true(v$ok, info = paste(vapply(v$problems, `[[`, "", "detail"), collapse = "; "))
  codes <- function(crop) vapply(collection_mail_template_validate(.cmrc_tpl(list(.cmrc_feature(crop = crop))))$problems, `[[`, "", "code")
  expect_true("bad_crop_ratio" %in% codes(list(ratio = "3:2")))
  expect_true("bad_crop_x" %in% codes(list(x = 1.4)))
  expect_true("bad_crop_zoom" %in% codes(list(zoom = 5)))
  expect_true("unknown_key" %in% codes(list(ratio = "1:1", css = "object-fit:cover")))
  expect_true("bad_crop" %in% codes("1:1"))
})

# ---- archivo derivado, ZIP y render ---------------------------------------------------

test_that("el recorte es un archivo nuevo, de la proporción pedida y sin reescalar; el original ya no viaja", {
  original <- .cmrc_jpeg(300L, 200L)
  t <- .cmrc_tpl(list(.cmrc_feature()))
  imgs <- .cmail_crop_apply(t, list(premio = original))
  cut_id <- imgs$premio$crops[[1]]
  expect_match(cut_id, "^premio-r200x200-[0-9a-f]{6}$")
  cut <- imgs[[cut_id]]
  expect_identical(cut$size, list(width = 200L, height = 200L))
  px <- jpeg::readJPEG(cut$path)
  expect_identical(dim(px)[1:2], c(200L, 200L))
  # Del centro: el rojo del primer píxel es el de la columna 51 del original (≈ 50/299), no el borde.
  expect_gt(px[1, 1, 1], 0.1)
  expect_true(isTRUE(imgs$premio$superseded))
  zipeables <- vapply(.cmail_import_images(imgs), `[[`, "", "id")
  expect_true(cut_id %in% zipeables)
  expect_false("premio" %in% zipeables)
})

test_that("si otro bloque usa la foto entera, el original sigue viajando", {
  original <- .cmrc_jpeg(300L, 200L)
  t <- .cmrc_tpl(list(.cmrc_feature(), list(block_id = "img", type = "image", image_ref = "premio", alt = "Premio")))
  imgs <- .cmail_crop_apply(t, list(premio = original))
  expect_false(isTRUE(imgs$premio$superseded))
})

test_that("el Destacado muestra el recorte: cuadrado a un lado, 2:1 arriba, y la nitidez se mide sobre él", {
  original <- .cmrc_jpeg(300L, 200L)
  lado <- .cmrc_feature()
  arriba <- .cmrc_feature(block_id = "arr", layout = "arriba")
  t <- .cmrc_tpl(list(lado, arriba))
  imgs <- .cmail_crop_apply(t, list(premio = original))
  ctx <- list(pal = .cmail_theme_palette(t, "#0b1f54", "#0b1f54"), accent = "#0b1f54", width = 600L, images = imgs, export = FALSE)
  expect_match(.cmail_block_feature(lado, ctx), '<img [^>]*width="200" height="200"')
  expect_match(.cmail_block_feature(arriba, ctx), '<img [^>]*width="300" height="150"')
  # Original: la foto entera a su proporción.
  entero <- .cmail_block_feature(.cmrc_feature(crop = list(ratio = "original")), ctx)
  expect_match(entero, '<img [^>]*width="216" height="144"')
  # Nitidez: el recorte de 200 px mostrado a 200 pide 400 a 2x → borrosa, y la revisión lo dice.
  checks <- list(); push <- function(x) { checks[[length(checks) + 1L]] <<- x; invisible(push) }
  .cmail_image_checks_common(t, imgs, .cmail_image_uses(t), push)
  w <- Filter(function(c) identical(c$code, "image_width"), checks)[[1]]
  expect_identical(w$status, "warning")
  expect_true(any(vapply(w$items, function(x) identical(as.integer(x$natural), 200L), logical(1))))
})

test_that("una foto sólo con URL (sin archivo) sale entera: no se puede recortar y no rompe", {
  t <- .cmrc_tpl(list(.cmrc_feature()))
  url_only <- list(premio = list(id = "premio", path = NULL, type = NULL, size = list(width = 1200L, height = 800L),
                                 url = "https://pulso.pucp.edu.pe/p.jpg", alt = "Premio", export_name = "premio.jpg"))
  imgs <- .cmail_crop_apply(t, url_only)
  expect_null(imgs$premio$crops)
  expect_false(isTRUE(imgs$premio$superseded))
  ctx <- list(pal = .cmail_theme_palette(t, "#0b1f54", "#0b1f54"), accent = "#0b1f54", width = 600L, images = imgs, export = FALSE)
  expect_match(.cmail_block_feature(.cmrc_feature(), ctx), '<img [^>]*width="216" height="144"')
})

test_that("la vista previa del editor lleva la foto entera para encuadrar; el correo exportado no", {
  original <- .cmrc_jpeg(300L, 200L)
  t <- .cmrc_tpl(list(.cmrc_feature()))
  imgs <- .cmail_crop_apply(t, list(premio = original))
  prev <- collection_mail_render(t, "preview", "mailchimp", images = imgs)$html
  expect_match(prev, 'data-pulso-original="data:image/jpeg;base64,', fixed = TRUE)
  exp <- collection_mail_render(t, "export", "mailchimp", images = imgs)$html
  expect_false(grepl("data-pulso-original", exp, fixed = TRUE))
  # Y el correo exportado nombra el recorte, no el original.
  expect_match(exp, imgs$premio$crops[[1]], fixed = TRUE)
})

# ---- bloque Imagen ----------------------------------------------------------------

.cmrc_image <- function(...) {
  utils::modifyList(list(block_id = "img", type = "image", image_ref = "premio", alt = "Premio"), list(...))
}

test_that("un bloque Imagen sin crop sale entero, como siempre", {
  expect_null(.cmail_crop_of(.cmrc_image()))
  original <- .cmrc_jpeg(300L, 200L)
  t <- .cmrc_tpl(list(.cmrc_image()))
  imgs <- .cmail_crop_apply(t, list(premio = original))
  expect_null(imgs$premio$crops)
  expect_false(isTRUE(imgs$premio$superseded))
})

test_that("un bloque Imagen con crop valida, se recorta y muestra el recorte, con la foto entera sólo en la vista previa", {
  b <- .cmrc_image(crop = list(ratio = "16:9", y = 0.2))
  t <- .cmrc_tpl(list(b))
  v <- collection_mail_template_validate(t)
  expect_true(v$ok, info = paste(vapply(v$problems, `[[`, "", "detail"), collapse = "; "))
  expect_true("bad_crop_ratio" %in% vapply(collection_mail_template_validate(.cmrc_tpl(list(.cmrc_image(crop = list(ratio = "5:4")))))$problems,
                                           `[[`, "", "code"))
  original <- .cmrc_jpeg(320L, 240L)
  imgs <- .cmail_crop_apply(t, list(premio = original))
  cut_id <- imgs$premio$crops[[1]]
  expect_match(cut_id, "^premio-r320x180-")
  expect_true(isTRUE(imgs$premio$superseded))
  ctx <- list(pal = .cmail_theme_palette(t, "#0b1f54", "#0b1f54"), accent = "#0b1f54", width = 600L, images = imgs, export = FALSE)
  # A la mitad del natural del recorte (160), no del original.
  expect_match(.cmail_block_image(b, ctx), '<img [^>]*width="160"')
  prev <- collection_mail_render(t, "preview", "mailchimp", images = imgs)$html
  expect_match(prev, 'data-pulso-original="data:image/jpeg;base64,', fixed = TRUE)
  exp <- collection_mail_render(t, "export", "mailchimp", images = imgs)$html
  expect_false(grepl("data-pulso-original", exp, fixed = TRUE))
  expect_match(exp, cut_id, fixed = TRUE)
  # Nitidez sobre el recorte: 320 px de ancho mostrados a 160 pasan justo a 2x.
  checks <- list(); push <- function(x) { checks[[length(checks) + 1L]] <<- x; invisible(push) }
  .cmail_image_checks_common(t, imgs, .cmail_image_uses(t), push)
  expect_identical(Filter(function(c) identical(c$code, "image_width"), checks)[[1]]$status, "ok")
})
