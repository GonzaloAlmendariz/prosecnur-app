# Versión para el celular del bloque Imagen (GOAL editor de correos profesional,
# L12; collection_mail_movil.R): contrato, render, ZIP y comportamiento sin
# media queries. Sin red.

.cmmv_png <- function(w, h, id) {
  path <- tempfile(fileext = ".png")
  png::writePNG(array(0.6, dim = c(h, w, 3)), path)
  list(id = id, path = path, type = "png", size = list(width = w, height = h),
       bytes = as.numeric(file.info(path)$size), url = NULL, alt = id, export_name = paste0(id, ".png"))
}

.cmmv_tpl <- function(b) {
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  t$blocks <- append(t$blocks, list(b), after = 2L)
  .cmail_template_normalize(t)
}

.cmmv_bloque <- function(...) {
  utils::modifyList(list(block_id = "afiche", type = "image", image_ref = "afiche", alt = "Afiche del sorteo", bleed = TRUE,
                         mobile_ref = "afiche-movil"), list(...))
}

test_that("mobile_ref valida como id de imagen y es opcional", {
  expect_true(collection_mail_template_validate(.cmmv_tpl(.cmmv_bloque()))$ok)
  expect_true(collection_mail_template_validate(.cmmv_tpl(.cmmv_bloque(mobile_ref = NULL)))$ok)
  codes <- vapply(collection_mail_template_validate(.cmmv_tpl(.cmmv_bloque(mobile_ref = "Afiche_Móvil")))$problems, `[[`, "", "code")
  expect_true("bad_image_ref" %in% codes)
})

test_that("el correo lleva las dos: la del celular oculta por defecto y fuera de Outlook; la media query las cambia", {
  t <- .cmmv_tpl(.cmmv_bloque())
  imgs <- list(afiche = .cmmv_png(1200, 1600, "afiche"), `afiche-movil` = .cmmv_png(654, 1400, "afiche-movil"))
  html <- collection_mail_render(t, "export", "mailchimp", images = imgs)$html
  expect_match(html, '<img class="cmail-pc" src="afiche.png"', fixed = TRUE)
  expect_match(html, '<!--[if !mso]><!--><div class="cmail-movil" style="display:none;max-height:0;overflow:hidden;mso-hide:all;"><img src="afiche-movil.png"', fixed = TRUE)
  expect_match(html, "<!--<![endif]-->", fixed = TRUE)
  expect_match(html, ".cmail-pc{display:none !important;", fixed = TRUE)
  expect_match(html, ".cmail-movil{display:block !important;", fixed = TRUE)
  # Comparte el texto alternativo del bloque.
  expect_match(html, 'src="afiche-movil.png" width="[0-9]+" alt="Afiche del sorteo"')
  # Las dos viajan en el ZIP.
  ids <- .cmail_image_ids(t)
  expect_true(all(c("afiche", "afiche-movil") %in% ids))
})

test_that("sin versión para el celular, o sin su archivo, el bloque sale como siempre", {
  imgs <- list(afiche = .cmmv_png(1200, 1600, "afiche"))
  sin <- collection_mail_render(.cmmv_tpl(.cmmv_bloque(mobile_ref = NULL)), "export", "mailchimp", images = imgs)$html
  expect_false(grepl("cmail-pc", sin, fixed = TRUE))
  expect_false(grepl("cmail-movil", sin, fixed = TRUE))
  # SurveyMonkey sin URL de la del celular: no hay src que dar; queda la de PC sola, sin ocultarla.
  sm_imgs <- list(afiche = utils::modifyList(.cmmv_png(1200, 1600, "afiche"), list(url = "https://x.pe/afiche.png")),
                  `afiche-movil` = .cmmv_png(654, 1400, "afiche-movil"))
  sm <- collection_mail_render(.cmmv_tpl(.cmmv_bloque()), "export", "surveymonkey", images = sm_imgs)$html
  expect_false(grepl("cmail-movil", sm, fixed = TRUE))
  expect_false(grepl('class="cmail-pc"', sm, fixed = TRUE))
})

test_that("un recorte de la de PC no deja fuera del ZIP a la del celular", {
  imgs <- list(afiche = .cmmv_png(1200, 1600, "afiche"), `afiche-movil` = .cmmv_png(654, 1400, "afiche-movil"))
  t <- .cmmv_tpl(.cmmv_bloque(bleed = NULL, crop = list(ratio = "4:3")))
  out <- .cmail_crop_apply(t, imgs)
  expect_false(isTRUE(out[["afiche-movil"]]$superseded))
  expect_true(isTRUE(out$afiche$superseded))
})

# Como la deja `.cmail_images_resolve` cuando no hay archivo ni URL.
.cmmv_sin_archivo <- function(id, url = NULL) {
  list(id = id, path = NULL, type = NULL, size = NULL, bytes = NULL, url = url, alt = id, export_name = paste0(id, ".png"))
}

test_that("si falta la versión del celular, la revisión lleva al bloque; su alt no se cuenta dos veces", {
  t <- .cmmv_tpl(.cmmv_bloque())
  imgs <- list(afiche = .cmmv_png(1200, 1600, "afiche"), `afiche-movil` = .cmmv_sin_archivo("afiche-movil"))
  html <- collection_mail_render(t, "export", "mailchimp", images = imgs)$html
  checks <- list(); push <- function(x) { checks[[length(checks) + 1L]] <<- x; invisible(push) }
  .cmail_image_checks(t, imgs, html, nchar(html, type = "bytes"), push, "mailchimp")
  falta <- Filter(function(c) identical(c$code, "images_available"), checks)[[1]]
  expect_identical(falta$status, "error")
  expect_true("afiche-movil" %in% unlist(falta$items))
  expect_true(any(vapply(falta$targets, function(x) identical(x$block_id, "afiche") && identical(x$prop, "mobile_ref"), NA)))
  sin_alt <- .cmmv_tpl(.cmmv_bloque(alt = ""))
  checks <- list()
  .cmail_image_checks_common(sin_alt, imgs, .cmail_image_uses(sin_alt), push)
  alt <- Filter(function(c) identical(c$code, "images_alt"), checks)[[1]]
  expect_identical(alt$value, 1L)
})

test_that("en SurveyMonkey, la versión del celular sin URL https se marca en su bloque (y con URL sale)", {
  t <- .cmmv_tpl(.cmmv_bloque())
  imgs <- list(afiche = .cmmv_sin_archivo("afiche", "https://x.pe/afiche.png"), `afiche-movil` = .cmmv_png(654, 1400, "afiche-movil"))
  checks <- list(); push <- function(x) { checks[[length(checks) + 1L]] <<- x; invisible(push) }
  .cmail_image_checks_sm(t, imgs, push)
  url <- Filter(function(c) identical(c$code, "images_public_url"), checks)[[1]]
  expect_identical(url$status, "error")
  expect_true(any(vapply(url$targets, function(x) identical(x$prop, "mobile_ref"), NA)))
  imgs[["afiche-movil"]]$url <- "https://x.pe/afiche-movil.png"
  sm <- collection_mail_render(t, "export", "surveymonkey", images = imgs)$html
  expect_match(sm, 'src="https://x.pe/afiche-movil.png"', fixed = TRUE)
})
