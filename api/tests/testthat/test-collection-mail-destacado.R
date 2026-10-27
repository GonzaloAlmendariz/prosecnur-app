# Sección «Destacado con imagen» (`feature`; GOAL editor de correos profesional,
# L5; collection_mail_destacado.R). Sin red.

.cmft_tpl <- function(blocks = list(), images = list()) {
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  t$blocks <- append(t$blocks, blocks, after = 2L)
  for (id in names(images)) t$images[[id]] <- images[[id]]
  .cmail_template_normalize(t)
}

.cmft_feature <- function(id = "dest", ...) {
  utils::modifyList(list(block_id = id, type = "feature", eyebrow = "Sorteo", title = paste("Participa MARCA", id),
                         text = "Sorteamos 5 audífonos.", button_text = "Responder", url = "https://pulso.pucp.edu.pe/"), list(...))
}

.cmft_codes <- function(t) {
  v <- collection_mail_template_validate(t)
  vapply(v$problems, function(p) p$code, "")
}

.cmft_img <- function(width, height) list(premio = list(size = list(width = width, height = height),
                                                        url = "https://pulso.pucp.edu.pe/premio.jpg"))

.cmft_html <- function(b, images = .cmft_img(560L, 560L), width = 600L) {
  t <- .cmft_tpl()
  ctx <- list(pal = .cmail_theme_palette(t, "#0b1f54", "#0b1f54"), accent = "#0b1f54", width = width,
              images = images, export = FALSE)
  .cmail_block_feature(b, ctx)
}

# ---- validación -------------------------------------------------------------------

test_that("un Destacado completo valida, con o sin imagen, en sus tres formas", {
  t <- .cmft_tpl(list(
    .cmft_feature("a", image_ref = "premio", alt = "Audífonos inalámbricos", layout = "izquierda"),
    .cmft_feature("b", image_ref = "premio", alt = "Audífonos inalámbricos", layout = "derecha"),
    .cmft_feature("c", image_ref = "premio", alt = "Audífonos inalámbricos", layout = "arriba",
                  box = list(bg = "tinte")),
    .cmft_feature("d")
  ), images = list(premio = list(alt = "Audífonos")))
  v <- collection_mail_template_validate(t)
  expect_true(v$ok, info = paste(vapply(v$problems, `[[`, "", "detail"), collapse = "; "))
})

test_that("título obligatorio, alt obligatorio con imagen, botón con dirección y forma cerrada", {
  sin_titulo <- .cmft_feature(); sin_titulo$title <- NULL
  expect_true("missing_text" %in% .cmft_codes(.cmft_tpl(list(sin_titulo))) ||
                any(grepl("title", vapply(collection_mail_template_validate(.cmft_tpl(list(sin_titulo)))$problems, `[[`, "", "path"))))
  expect_true("missing_alt" %in% .cmft_codes(.cmft_tpl(list(.cmft_feature(image_ref = "premio")))))
  expect_true("bad_image_ref" %in% .cmft_codes(.cmft_tpl(list(.cmft_feature(image_ref = "mal_id", alt = "x")))))
  sin_url <- .cmft_feature(); sin_url$url <- NULL
  expect_true(any(grepl("url", vapply(collection_mail_template_validate(.cmft_tpl(list(sin_url)))$problems, `[[`, "", "path"))))
  sin_boton <- .cmft_feature(); sin_boton$button_text <- NULL
  expect_true("missing_button_text" %in% .cmft_codes(.cmft_tpl(list(sin_boton))))
  expect_true("bad_layout" %in% .cmft_codes(.cmft_tpl(list(.cmft_feature(layout = "abajo")))))
  # Enlaces sólo en el texto, no en el título ni en el botón.
  expect_true("link_not_allowed" %in% .cmft_codes(.cmft_tpl(list(.cmft_feature(title = "Mira [esto](https://x.pe)")))))
  expect_false("link_not_allowed" %in% .cmft_codes(.cmft_tpl(list(.cmft_feature(text = "Mira [esto](https://pulso.pucp.edu.pe/)")))))
})

# ---- render -----------------------------------------------------------------------

test_that("a la izquierda: la imagen va primero, 216 px con 600 de columna, y las dos celdas se apilan en teléfono", {
  html <- .cmft_html(.cmft_feature(image_ref = "premio", alt = "Audífonos", layout = "izquierda"))
  expect_lt(regexpr("<img ", html), regexpr("MARCA dest", html))
  expect_match(html, '<img [^>]*width="216" height="216"')
  expect_equal(lengths(regmatches(html, gregexpr(sprintf('class="%s"', .CMAIL_STACK_CLASS), html))), 2L)
})

test_that("a la derecha se dibuja de derecha a izquierda, con la imagen primero para que suba en teléfono; arriba ocupa la columna", {
  der <- .cmft_html(.cmft_feature(image_ref = "premio", alt = "Audífonos", layout = "derecha"))
  expect_lt(regexpr("<img ", der), regexpr("MARCA dest", der))
  expect_match(der, 'dir="rtl"', fixed = TRUE)
  expect_equal(lengths(regmatches(der, gregexpr('dir="ltr"', der))), 2L)
  izq <- .cmft_html(.cmft_feature(image_ref = "premio", alt = "Audífonos", layout = "izquierda"))
  expect_false(grepl('dir="rtl"', izq, fixed = TRUE))
  arr <- .cmft_html(.cmft_feature(image_ref = "premio", alt = "Audífonos", layout = "arriba"),
                    images = .cmft_img(1200L, 600L))
  expect_match(arr, '<img [^>]*width="504" height="252"')
  expect_false(grepl(.CMAIL_STACK_CLASS, arr, fixed = TRUE))
})

test_that("la imagen nunca se deforma ni se agranda: su proporción real y no más ancha que el archivo", {
  # Apaisada en la ranura cuadrada: 216 de ancho, alto por su proporción.
  ap <- .cmft_html(.cmft_feature(image_ref = "premio", alt = "Audífonos"), images = .cmft_img(1200L, 800L))
  expect_match(ap, '<img [^>]*width="216" height="144"')
  # Un archivo de 150 px no se estira a 216.
  ch <- .cmft_html(.cmft_feature(image_ref = "premio", alt = "Audífonos"), images = .cmft_img(150L, 150L))
  expect_match(ch, '<img [^>]*width="150" height="150"')
  # Ni en teléfono: una foto más angosta que la columna no lleva la clase que la estira.
  expect_false(grepl("cmail-feature-img", ch, fixed = TRUE))
  expect_match(.cmft_html(.cmft_feature(image_ref = "premio", alt = "Audífonos")), 'class="cmail-feature-img"', fixed = TRUE)
})

test_that("sin imagen sale el texto solo, sin hueco ni celda de imagen", {
  html <- .cmft_html(.cmft_feature())
  expect_false(grepl("<img ", html, fixed = TRUE))
  expect_false(grepl(.CMAIL_STACK_CLASS, html, fixed = TRUE))
  expect_match(html, "MARCA dest", fixed = TRUE)
  expect_match(html, ">SORTEO<|>Sorteo<")
  expect_match(html, ">Responder</a>")
})

test_that("en el correo entero: la foto entra a las imágenes de la plantilla y a la revisión de alt y nitidez", {
  t <- .cmft_tpl(list(.cmft_feature(image_ref = "premio", alt = "")), images = list(premio = list(alt = "x")))
  expect_true("premio" %in% .cmail_image_ids(t))
  uses <- .cmail_image_uses(t)
  u <- Filter(function(x) identical(x$id, "premio"), uses)[[1]]
  expect_identical(u$target$block_id, "dest")
  # Con un archivo de 300 px, mostrado a 216, a 2x pide 432: se avisa borroso.
  checks <- list(); push <- function(x) { checks[[length(checks) + 1L]] <<- x; invisible(push) }
  .cmail_image_checks_common(t, list(premio = list(id = "premio", size = list(width = 300L, height = 300L))), uses, push)
  codes <- vapply(checks, `[[`, "", "code")
  expect_identical(checks[[which(codes == "images_alt")]]$status, "error")
  expect_identical(checks[[which(codes == "image_width")]]$status, "warning")
  # Y el correo exportado se arma con la sección dentro.
  t$blocks[[3]]$alt <- "Audífonos inalámbricos"
  html <- collection_mail_render(.cmail_template_normalize(t), "export", "mailchimp")$html
  expect_match(html, "MARCA dest", fixed = TRUE)
  # La regla del teléfono sólo con una imagen de Destacado en el cuerpo.
  expect_match(html, ".cmail-feature-img{width:100% !important;height:auto !important;}", fixed = TRUE)
  sin <- collection_mail_render(.cmft_tpl(), "export", "mailchimp")$html
  expect_false(grepl("cmail-feature-img", sin, fixed = TRUE))
})

test_that("centrado: antetítulo, título, texto y botón van al centro; sin align todo sigue a la izquierda; align es cerrado", {
  arriba <- list(image_ref = "premio", alt = "Audífonos inalámbricos", layout = "arriba")
  centrado <- do.call(.cmft_feature, c(arriba, align = "center"))
  html <- .cmft_html(centrado)
  # Los tres párrafos (antetítulo, título y texto) llevan el centrado.
  expect_equal(lengths(regmatches(html, gregexpr('<p style="margin:[^"]*text-align:center;', html, perl = TRUE))), 3L)
  expect_match(html, '<table role="presentation" align="center"[^>]*style="margin:6px auto 0 auto;"', perl = TRUE)

  izquierda <- .cmft_html(do.call(.cmft_feature, arriba))
  expect_false(grepl("text-align:center", izquierda, fixed = TRUE))
  expect_match(izquierda, 'style="margin:6px 0 0 0;"', fixed = TRUE)

  # A un lado, la celda de texto también se centra.
  lado <- .cmft_html(.cmft_feature(image_ref = "premio", alt = "Audífonos inalámbricos", align = "center"))
  expect_match(lado, "vertical-align:middle;text-align:center;", fixed = TRUE)

  t <- .cmft_tpl(list(centrado), images = list(premio = list(alt = "Audífonos")))
  expect_true(collection_mail_template_validate(t)$ok)
  expect_true("bad_align" %in% .cmft_codes(.cmft_tpl(list(.cmft_feature(align = "justify")))))
})

test_that("botón grande y con color propio: 17 px y más relleno; la letra la elige el contraste; color y tamaño cerrados", {
  arriba <- list(image_ref = "premio", alt = "Audífonos inalámbricos", layout = "arriba", align = "center")
  normal <- .cmft_html(do.call(.cmft_feature, arriba))
  expect_match(normal, "padding:12px 22px;", fixed = TRUE)
  expect_match(normal, "font-size:15px;line-height:20px;font-weight:bold", fixed = TRUE)

  amarillo <- .cmft_html(do.call(.cmft_feature, c(arriba, button_size = "grande", button_color = "#FFB000")))
  expect_match(amarillo, "mso-padding-alt:16px 36px;", fixed = TRUE)
  expect_match(amarillo, "padding:16px 36px;", fixed = TRUE)
  expect_match(amarillo, "font-size:17px;line-height:22px;font-weight:bold;color:#0b1f3a;", fixed = TRUE)
  expect_match(amarillo, 'bgcolor="#ffb000"', fixed = TRUE)

  # Sobre un color oscuro la letra pasa a blanco.
  oscuro <- .cmft_html(do.call(.cmft_feature, c(arriba, button_color = "#123456")))
  expect_match(oscuro, "font-weight:bold;color:#ffffff;", fixed = TRUE)

  t <- .cmft_tpl(list(do.call(.cmft_feature, c(arriba, button_size = "grande", button_color = "#ffb000"))),
                 images = list(premio = list(alt = "Audífonos")))
  expect_true(collection_mail_template_validate(t)$ok)
  expect_true("bad_button_size" %in% .cmft_codes(.cmft_tpl(list(.cmft_feature(button_size = "enorme")))))
  expect_true("bad_button_color" %in% .cmft_codes(.cmft_tpl(list(.cmft_feature(button_color = "amarillo")))))
})
