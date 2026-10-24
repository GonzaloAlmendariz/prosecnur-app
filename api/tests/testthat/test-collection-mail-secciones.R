# Resto del catálogo de secciones (GOAL editor de correos profesional, L6;
# collection_mail_secciones.R): contrato, render seguro para correo, fotos y
# teléfono. Sin red.

.cmsc_tpl <- function(blocks) {
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  t$blocks <- append(t$blocks, blocks, after = 2L)
  .cmail_template_normalize(t)
}

.cmsc_problems <- function(b) {
  vapply(collection_mail_template_validate(.cmsc_tpl(list(b)))$problems, `[[`, "", "code")
}

.cmsc_ok <- function(b) {
  v <- collection_mail_template_validate(.cmsc_tpl(list(b)))
  expect_true(v$ok, info = paste(vapply(v$problems, function(p) paste(p$path, p$detail), ""), collapse = "; "))
}

.cmsc_entries <- function(n, icon = NULL) {
  lapply(seq_len(n), function(i) c(list(title = sprintf("Paso %d", i), text = sprintf("Texto %d", i)),
                                   if (!is.null(icon)) list(icon = icon)))
}

# modifyList funde las listas sin nombre (las entradas): aquí se reemplaza.
.cmsc_con <- function(b, x) {
  for (k in names(x)) if (is.null(x[[k]])) b[[k]] <- NULL else b[k] <- list(x[[k]])
  b
}

.cmsc_html <- function(b, mode = "export") collection_mail_render(.cmsc_tpl(list(b)), mode, "mailchimp")$html

.cmsc <- list(
  steps = list(block_id = "pasos", type = "steps", title = "Cómo responder", entries = .cmsc_entries(3)),
  deadline = list(block_id = "fecha", type = "deadline", eyebrow = "La encuesta cierra el", title = "Viernes 7 de noviembre",
                  text = "Quedan quince días", button_text = "Responder ahora", url = "https://pulso.pucp.edu.pe/e"),
  benefits = list(block_id = "benef", type = "benefits", title = "Por qué responder", entries = .cmsc_entries(3, icon = "candado")),
  quote = list(block_id = "cita", type = "quote", text = "Leemos todas las respuestas.", name = "Lucía Ramos", role = "Dirección"),
  faq = list(block_id = "faq", type = "faq", title = "Preguntas frecuentes", entries = .cmsc_entries(2)),
  contact = list(block_id = "contacto", type = "contact", eyebrow = "¿Dudas? Escríbele a", name = "Lucía Ramos",
                 role = "Coordinación", email = "encuesta@pucp.edu.pe", phone = "01 626 2000", text = "De 9:00 a 18:00")
)

test_that("las seis secciones validan y salen en el correo con su texto", {
  for (type in names(.cmsc)) {
    b <- .cmsc[[type]]
    .cmsc_ok(b)
    html <- .cmsc_html(b)
    for (k in intersect(c("title", "text", "name", "eyebrow"), names(b))) expect_match(html, b[[k]], fixed = TRUE, info = paste(type, k))
  }
  expect_match(.cmsc_html(.cmsc$contact), 'href="mailto:encuesta@pucp.edu.pe"', fixed = TRUE)
})

test_that("las entradas tienen su rango, sus claves cerradas y el ícono sólo en beneficios", {
  expect_true("entries_count" %in% .cmsc_problems(.cmsc_con(.cmsc$steps, list(entries = .cmsc_entries(7)))))
  expect_true("entries_count" %in% .cmsc_problems(.cmsc_con(.cmsc$benefits, list(entries = .cmsc_entries(1, "candado")))))
  expect_true("bad_entries" %in% .cmsc_problems(.cmsc_con(.cmsc$faq, list(entries = list(title = "x")))))
  expect_true("unknown_key" %in% .cmsc_problems(.cmsc_con(.cmsc$steps, list(entries = list(list(title = "a", css = "x"))))))
  # Una pregunta sin respuesta vale: sale sola (L8: Beneficios → Preguntas no frena la vista previa).
  expect_false("missing_text" %in% .cmsc_problems(.cmsc_con(.cmsc$faq, list(entries = list(list(title = "¿Quién?"))))))
  expect_true("unknown_key" %in% .cmsc_problems(.cmsc_con(.cmsc$steps, list(entries = .cmsc_entries(2, "candado")))))
  expect_true("bad_icon" %in% .cmsc_problems(.cmsc_con(.cmsc$benefits, list(entries = .cmsc_entries(2, "cohete")))))
  expect_true("bad_email" %in% .cmsc_problems(.cmsc_con(.cmsc$contact, list(email = "sin arroba"))))
  # El correo de ejemplo con que nace la sección es un dato por llenar, no un error (visto en vivo, frenaba la vista previa).
  expect_false("bad_email" %in% .cmsc_problems(.cmsc_con(.cmsc$contact, list(email = "[correo@dominio]"))))
  expect_true("missing_text" %in% .cmsc_problems(list(block_id = "c", type = "quote", text = "Algo")))
  expect_true("missing_button_text" %in% .cmsc_problems(.cmsc_con(.cmsc$deadline, list(button_text = NULL))))
  expect_true("bad_style_value" %in% .cmsc_problems(.cmsc_con(.cmsc$steps, list(layout = "rejilla"))) ||
              any(grepl("layout", .cmsc_problems(.cmsc_con(.cmsc$steps, list(layout = "rejilla"))))))
})

test_that("pasos: hasta tres a lo ancho, también en el celular; cuatro o «lista» van uno debajo de otro", {
  cols <- .cmsc_html(.cmsc$steps)
  # A lo ancho siempre: ninguna celda apilable.
  expect_false(grepl(sprintf('class="%s"', .CMAIL_STACK_CLASS), cols, fixed = TRUE))
  expect_match(cols, ">3</td>", fixed = TRUE)
  lista <- .cmsc_html(.cmsc_con(.cmsc$steps, list(entries = .cmsc_entries(4))))
  expect_false(grepl(sprintf('class="%s"', .CMAIL_STACK_CLASS), lista, fixed = TRUE))
  expect_match(lista, ">4</td>", fixed = TRUE)
})

test_that("beneficios: se apilan en el celular; ícono del color del tema; sin ícono, sólo el texto", {
  apil <- .cmsc_html(.cmsc$benefits)
  expect_identical(lengths(regmatches(apil, gregexpr(sprintf('class="%s"', .CMAIL_STACK_CLASS), apil, fixed = TRUE)))[[1]], 3L)
  t <- .cmsc_tpl(list(.cmsc$benefits))
  gen <- .cmail_piezas_images(t)
  expect_true(any(startsWith(names(gen), "icono-candado-")))
  html <- collection_mail_render(t, "export", "mailchimp")$html
  expect_match(html, "icono-candado-", fixed = TRUE)
  sin <- .cmsc_html(.cmsc_con(.cmsc$benefits, list(entries = .cmsc_entries(2))))
  expect_false(grepl("icono-", sin, fixed = TRUE))
})

test_that("contacto sin foto muestra las iniciales; con un campo en el nombre, nada", {
  expect_identical(.cmail_initials("Lucía Ramos Pérez"), "LR")
  expect_identical(.cmail_initials("{{responsable}}"), "")
  # El nombre de ejemplo es un dato por llenar: sin corchetes (visto en vivo: salía «[R»).
  expect_identical(.cmail_initials("[Quién responde]"), "QR")
  expect_identical(.cmail_initials("Ñusta Huamán-Quispe"), "ÑH")
  expect_match(.cmsc_html(.cmsc$contact), ">LR</td>", fixed = TRUE)
})

test_that("cita y contacto con retrato: alt obligatorio, recorte 1:1 de 96 px y redondo; pasos con foto 2:1", {
  expect_true("missing_alt" %in% .cmsc_problems(.cmsc_con(.cmsc$quote, list(image_ref = "retrato"))))
  path <- tempfile(fileext = ".jpg")
  jpeg::writeJPEG(array(0.5, dim = c(300, 400, 3)), path)
  img <- list(id = "retrato", path = path, type = "jpeg", size = list(width = 400L, height = 300L),
              bytes = as.numeric(file.info(path)$size), url = NULL, alt = "Retrato", export_name = "retrato.jpg")
  for (type in c("quote", "contact")) {
    b <- .cmsc_con(.cmsc[[type]], list(image_ref = "retrato", alt = "Retrato de Lucía"))
    .cmsc_ok(b)
    t <- .cmsc_tpl(list(b))
    imgs <- .cmail_crop_apply(t, list(retrato = img))
    # La «c»: el retrato se hornea redondo (L13, test de abajo).
    expect_match(imgs$retrato$crops[[1]], "^retrato-r192x192c-", info = type)
    html <- collection_mail_render(t, "export", "mailchimp", images = imgs)$html
    expect_match(html, '<img [^>]*width="96" height="96"[^>]*border-radius:50%', info = type)
    expect_false(grepl(">LR</td>", html, fixed = TRUE))
  }
  pasos <- .cmsc_con(.cmsc$steps, list(image_ref = "retrato", alt = "Sala de lectura"))
  t <- .cmsc_tpl(list(pasos))
  imgs <- .cmail_crop_apply(t, list(retrato = img))
  expect_match(imgs$retrato$crops[[1]], "^retrato-r400x200-")
  expect_true("retrato" %in% .cmail_image_ids(t))
  # Nitidez: 400 px mostrados a 400 (la columna da 504) piden 800 → la revisión lo avisa.
  checks <- list(); push <- function(x) { checks[[length(checks) + 1L]] <<- x; invisible(push) }
  .cmail_image_checks_common(t, imgs, .cmail_image_uses(t), push)
  expect_identical(Filter(function(c) identical(c$code, "image_width"), checks)[[1]]$status, "warning")
})

test_that("la fecha límite sale centrada y su botón lleva el enlace; dentro de una caja de acento se lee", {
  b <- .cmsc_con(.cmsc$deadline, list(box = list(bg = "acento")))
  .cmsc_ok(b)
  html <- .cmsc_html(b)
  expect_match(html, 'href="https://pulso.pucp.edu.pe/e"', fixed = TRUE)
  expect_match(html, "text-align:center", fixed = TRUE)
})

test_that("la vista previa marca las propiedades de cada sección para editarlas en el lienzo", {
  prev <- .cmsc_html(.cmsc$faq, mode = "preview")
  expect_match(prev, 'data-pulso-block="faq"', fixed = TRUE)
  expect_match(prev, 'data-pulso-prop="entries.1.text"', fixed = TRUE)
})

test_that("lo guardado por «Cambiar por» valida su forma, no se muestra y sus campos no cuentan como usados", {
  b <- .cmsc_con(.cmsc$deadline, list(guardado = list(image_ref = "premio", alt = "Audífonos", feature_layout = "derecha",
                                                       text = "Hola {{carrera}}", `_relleno` = list(title = "x"))))
  .cmsc_ok(b)
  html <- .cmsc_html(b)
  expect_false(grepl("premio", html, fixed = TRUE))
  expect_false(grepl("Audífonos", html, fixed = TRUE))
  t <- .cmsc_tpl(list(b))
  expect_false("premio" %in% .cmail_image_ids(t))
  expect_false(any(vapply(.cmail_key_targets(t, "carrera"), function(x) identical(x$block_id, "fecha"), NA)))
  expect_true("bad_guardado" %in% .cmsc_problems(.cmsc_con(.cmsc$deadline, list(guardado = list("a", "b")))))
  expect_true("unknown_key" %in% vapply(collection_mail_template_validate(.cmsc_tpl(list(
    list(block_id = "p", type = "paragraph", text = "Hola", guardado = list(x = "y")))))$problems, `[[`, "", "code"))
})

test_that("el retrato de Cita y Contacto lleva el círculo horneado (Outlook ignora border-radius); una foto de Destacado no", {
  path <- tempfile(fileext = ".jpg")
  jpeg::writeJPEG(array(0.4, dim = c(300, 400, 3)), path)
  img <- list(id = "retrato", path = path, type = "jpeg", size = list(width = 400L, height = 300L),
              bytes = as.numeric(file.info(path)$size), url = NULL, alt = "Retrato", export_name = "retrato.jpg")
  for (type in c("quote", "contact")) {
    t <- .cmsc_tpl(list(.cmsc_con(.cmsc[[type]], list(image_ref = "retrato", alt = "Retrato de Lucía"))))
    imgs <- .cmail_crop_apply(t, list(retrato = img))
    cut <- imgs[[imgs$retrato$crops[[1]]]]
    expect_match(cut$id, "^retrato-r192x192c-", info = type)
    expect_identical(cut$type, "png")
    expect_match(cut$export_name, "\\.png$")
    px <- png::readPNG(cut$path)
    # Reducido a 2× lo que se muestra (96 px): un PNG sin pérdida de toda la foto no cabe en el ZIP.
    expect_identical(dim(px), c(192L, 192L, 4L))
    expect_identical(cut$size, list(width = 192L, height = 192L))
    expect_identical(px[1, 1, 4], 0)          # esquina: transparente
    expect_identical(px[96, 96, 4], 1)        # centro: opaco
    # El borde se suaviza (no es un escalón): hay píxeles a medias, todos en el contorno.
    medios <- which(px[, , 4] > 0 & px[, , 4] < 1, arr.ind = TRUE)
    expect_gt(nrow(medios), 60L)
    d <- sqrt((medios[, 1] - 96.5)^2 + (medios[, 2] - 96.5)^2)
    expect_true(all(abs(d - 96) <= 1))
    # El correo nombra el PNG redondo.
    html <- collection_mail_render(t, "export", "mailchimp", images = imgs)$html
    expect_match(html, paste0(cut$id, ".png"), fixed = TRUE, info = type)
  }
  # Con «original» no hay círculo que hornear (la foto no es cuadrada): sale como estaba.
  orig <- .cmsc_tpl(list(.cmsc_con(.cmsc$quote, list(image_ref = "retrato", alt = "R", crop = list(ratio = "original")))))
  expect_null(.cmail_crop_apply(orig, list(retrato = img))$retrato$crops)
  # Un Destacado no se hornea: su recorte sigue en JPEG.
  dest <- .cmsc_tpl(list(list(block_id = "d", type = "feature", title = "T", image_ref = "retrato", alt = "R")))
  di <- .cmail_crop_apply(dest, list(retrato = img))
  expect_identical(di[[di$retrato$crops[[1]]]]$type, "jpeg")
})

test_that("un retrato de tamaño real horneado redondo no bloquea el ZIP de Mailchimp (lo encontró el verificador)", {
  set.seed(7)
  path <- tempfile(fileext = ".jpg")
  px <- array(runif(1600 * 1200 * 3), dim = c(1600, 1200, 3))  # ruido: lo peor para un PNG
  jpeg::writeJPEG(px, path, quality = 0.85)
  img <- list(id = "retrato", path = path, type = "jpeg", size = list(width = 1200L, height = 1600L),
              bytes = as.numeric(file.info(path)$size), url = NULL, alt = "Retrato", export_name = "retrato.jpg")
  t <- .cmsc_tpl(list(.cmsc_con(.cmsc$contact, list(image_ref = "retrato", alt = "Retrato de Lucía"))))
  imgs <- .cmail_crop_apply(t, list(retrato = img))
  cut <- imgs[[imgs$retrato$crops[[1]]]]
  expect_lt(cut$bytes, 150000)
  checks <- list(); push <- function(x) { checks[[length(checks) + 1L]] <<- x; invisible(push) }
  html <- collection_mail_render(t, "export", "mailchimp", images = imgs)$html
  .cmail_image_checks(t, imgs, html, nchar(html, type = "bytes"), push, "mailchimp")
  expect_true(any(vapply(checks, function(c) identical(c$code, "import_zip_weight"), NA)))
  zip <- Filter(function(c) identical(c$code, "import_zip_weight"), checks)
  expect_false(identical(zip[[1]]$status, "error"))
  # Nitidez: 192 px mostrados a 96 cumplen el 2x.
  w <- Filter(function(c) identical(c$code, "image_width"), checks)
  expect_true(length(w) == 0L || !any(vapply(w[[1]]$items %||% list(), function(x) identical(x$id, "retrato"), NA)))
})

test_that("un PNG gris con transparencia conserva su alfa al hornearse redondo", {
  px <- array(0, dim = c(200, 200, 2)); px[, , 1] <- 0.5; px[, , 2] <- 0.5
  out <- .cmail_circle_alpha(px)
  expect_identical(dim(out), c(200L, 200L, 4L))
  expect_equal(out[100, 100, 4], 0.5)
  expect_equal(out[100, 100, 1:3], rep(0.5, 3))
})
