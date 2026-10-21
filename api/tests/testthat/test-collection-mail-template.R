# Plantilla de correo (ADR 0110 §2, E1f): registro cerrado, campos de
# combinación, render preview/mailchimp, peso y round-trip HTTP.

.cmail_t_base <- function() .cmail_template_normalize(.cmail_preset_recuperacion())

.cmail_t_codes <- function(template) {
  v <- collection_mail_template_validate(.cmail_template_normalize(template))
  vapply(v$problems, function(p) p$code, "")
}

test_that("los presets built-in cumplen collection_mail_template/v2", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  out <- collection_mail_presets_get(sid)
  ids <- vapply(out$presets, `[[`, "", "preset_id")
  expect_identical(ids, c("invitacion_encuesta_v1", "recuperacion_estudiantes_v1", "invitacion_capacitacion_v1"))
  for (p in out$presets) {
    v <- collection_mail_template_validate(p$template)
    expect_true(v$ok, info = paste(p$preset_id, paste(vapply(v$problems, `[[`, "", "detail"), collapse = "; ")))
  }
  expect_setequal(unlist(out$block_types),
                  c("greeting", "heading", "paragraph", "button", "callout", "list", "divider", "image",
                    "signature", "footer_legal", "band", "ornament", "icon_text", "two_images"))
})

test_that("el registro cerrado rechaza HTML libre, etiquetas crudas, tipos y claves ajenas", {
  t <- .cmail_t_base()
  t$blocks[[2]]$text <- "Hola <b>mundo</b>"
  expect_true("html_not_allowed" %in% .cmail_t_codes(t))

  t <- .cmail_t_base()
  t$blocks[[2]]$text <- "Hola &nbsp; mundo"
  expect_true("html_not_allowed" %in% .cmail_t_codes(t))

  t <- .cmail_t_base()
  t$blocks[[2]]$text <- "Hola *|FNAME|*"
  expect_true("raw_merge_tag" %in% .cmail_t_codes(t))

  t <- .cmail_t_base()
  t$blocks[[2]]$text <- "Hola {{desconocido}}"
  expect_true("unknown_field" %in% .cmail_t_codes(t))

  t <- .cmail_t_base()
  t$blocks[[length(t$blocks) + 1L]] <- list(block_id = "raro", type = "html", html = "<div></div>")
  expect_true("unknown_block_type" %in% .cmail_t_codes(t))

  t <- .cmail_t_base()
  t$blocks[[2]]$style <- "color:red"
  expect_true("unknown_key" %in% .cmail_t_codes(t))

  t <- .cmail_t_base()
  t$blocks[[5]]$url <- "javascript:alert(1)"
  expect_true("bad_url" %in% .cmail_t_codes(t))

  t <- .cmail_t_base()
  t$images$pulso$url <- "data:image/png;base64,AAAA"
  expect_true("bad_image_url" %in% .cmail_t_codes(t))

  # Un saludo con campo sin respaldo deja sin saludo a quien no tiene el dato.
  t <- .cmail_t_base()
  t$blocks[[1]]$fallback <- NULL
  expect_true("missing_fallback" %in% .cmail_t_codes(t))
})

test_that("las etiquetas del estudio siguen la regla de Mailchimp y no pisan las reservadas", {
  with_tag <- function(tag, key = "carrera") {
    t <- .cmail_t_base()
    t$fields[[1]]$tag <- tag
    t$fields[[1]]$key <- key
    .cmail_t_codes(t)
  }
  expect_true("bad_tag" %in% with_tag("carrera"))
  expect_true("bad_tag" %in% with_tag("CARRERAPROFESIONAL"))
  expect_true("bad_tag" %in% with_tag("CARRE-RA"))
  for (reserved in c("FNAME", "EMAIL", "LNAME", "ADDRESS", "PHONE", "UNSUB", "LIST", "MC_FOO")) {
    expect_true("reserved_tag" %in% with_tag(reserved), info = reserved)
  }
  expect_true("duplicate_tag" %in% with_tag("CODIGO"))
  expect_true("reserved_key" %in% with_tag("CARRERA", key = "nombre"))
  expect_length(with_tag("CARRERA_1"), 0L)
})

test_that("preview resuelve los campos; mailchimp deja etiquetas, respaldo condicional y pie legal", {
  t <- .cmail_t_base()
  values <- list(nombre = "Ana", fields = list(carrera = "Sociología", enlace = "https://ejemplo.org/e/1"))
  pv <- collection_mail_render(t, "preview", values = values)
  mc <- collection_mail_render(t, "mailchimp")

  expect_false(grepl("*|", pv$html, fixed = TRUE))
  expect_match(.cmail_fx_unmark(pv$html), "Estimado(a) Ana:", fixed = TRUE)
  expect_match(pv$html, "Sociología", fixed = TRUE)
  expect_match(pv$html, 'href="https://ejemplo.org/e/1"', fixed = TRUE)

  expect_match(mc$html, "*|IF:FNAME|*Estimado(a) *|FNAME|*:*|ELSE:|*Estimado(a) estudiante:*|END:IF|*", fixed = TRUE)
  expect_match(mc$html, "*|IF:CARRERA|**|CARRERA|**|ELSE:|*su carrera*|END:IF|*", fixed = TRUE)
  expect_match(mc$html, 'href="*|ENLACE|*"', fixed = TRUE)
  expect_match(mc$html, 'href="*|UNSUB|*"', fixed = TRUE)
  expect_match(mc$html, "*|LIST:ADDRESSLINE|*", fixed = TRUE)
  expect_false(grepl("{{", mc$html, fixed = TRUE))

  # Sin nombre, el preview usa el respaldo.
  sin_nombre <- collection_mail_render(t, "preview", values = list(nombre = "", fields = list()))
  expect_match(sin_nombre$html, "Estimado(a) estudiante:", fixed = TRUE)
  expect_match(.cmail_fx_unmark(sin_nombre$html), "como estudiante de su carrera", fixed = TRUE)
})

test_that("el texto de usuario y los valores se escapan: el render es el único que escribe HTML", {
  t <- .cmail_t_base()
  t$blocks[[2]]$text <- "Uno & dos \"tres\" y **negrita**"
  values <- list(nombre = "<script>alert(1)</script>", fields = list(carrera = "<img src=x onerror=1>"))
  pv <- collection_mail_render(t, "preview", values = values)
  expect_false(grepl("<script", pv$html, fixed = TRUE))
  expect_false(grepl("<img src=x", pv$html, fixed = TRUE))
  expect_match(pv$html, "Uno &amp; dos &quot;tres&quot; y <strong>negrita</strong>", fixed = TRUE)
  expect_false(grepl("<script|javascript:|onerror=", collection_mail_render(t, "mailchimp")$html))
})

test_that("HTML de correo compatible: tablas de 600 px, botón bulletproof, alt en imágenes, sin data: en mailchimp", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  for (builder in list(.cmail_preset_recuperacion, .cmail_preset_invitacion)) {
    t <- .cmail_template_normalize(builder())
    images <- .cmail_images_resolve(session_get(sid), t)
    mc <- collection_mail_render(t, "mailchimp", images = images)
    pv <- collection_mail_render(t, "preview", values = .cmail_synthetic_values(t), images = images)
    expect_match(mc$html, 'role="presentation" width="600"', fixed = TRUE)
    expect_match(mc$html, "max-width:600px", fixed = TRUE)
    expect_match(mc$html, '<td align="center" bgcolor="#0b1f54"', fixed = TRUE)
    # CSS solo inline, salvo DOS reglas del <head>: el justificado baja a la
    # izquierda en teléfono por la clase cmail-justify (E1n) y los márgenes del
    # cuerpo bajan a 20 px por la clase cmail-pad (E1p).
    expect_match(mc$html, .cmail_justify_style('class="cmail-justify"'), fixed = TRUE)
    expect_match(mc$html, .cmail_pad_style(), fixed = TRUE)
    rest <- sub(.cmail_pad_style(), "", sub(.cmail_justify_style('class="cmail-justify"'), "", mc$html, fixed = TRUE), fixed = TRUE)
    rest <- gsub(' class="(cmail-justify cmail-pad|cmail-justify|cmail-pad)"', "", rest)
    expect_false(grepl("<script|<style|class=", rest))
    imgs <- regmatches(mc$html, gregexpr("<img [^>]*>", mc$html))[[1]]
    expect_length(imgs, 2L)
    expect_true(all(grepl('alt="[^"]+"', imgs)))
    # E1g: src RELATIVO al ZIP importable, nunca un marcador IMAGEN_.
    expect_true(all(grepl('src="(logo-cliente|pulso)\\.png"', imgs)))
    expect_false(grepl("IMAGEN_", mc$html, fixed = TRUE))
    expect_false(grepl("data:", mc$html, fixed = TRUE))
    # El preview de la app sí incrusta: nunca sale de la app.
    expect_match(pv$html, "data:image/png;base64,", fixed = TRUE)
    expect_lt(mc$bytes, 102L * 1024L)
  }
  # Con URL pública declarada, mailchimp la usa en vez del marcador.
  t <- .cmail_t_base()
  t$images$pulso$url <- "https://cdn.ejemplo.org/pulso.png"
  mc <- collection_mail_render(t, "mailchimp", images = .cmail_images_resolve(session_get(sid), t))
  expect_match(mc$html, 'src="https://cdn.ejemplo.org/pulso.png"', fixed = TRUE)
})

test_that("PUT mail-template exige revisión, guarda en collection_state y marca el noop", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  g <- collection_mail_template_get(sid)
  expect_true(g$builtin)
  expect_error(collection_mail_template_put(sid, g$template, g$state_revision + 5L), class = "api_error")
  inv <- .cmail_template_normalize(.cmail_preset_invitacion())
  put <- collection_mail_template_put(sid, inv, g$state_revision)
  expect_false(put$noop)
  expect_identical(put$state_revision, g$state_revision + 1L)
  st <- session_get(sid)$collection_state
  # E1h: la plantilla vive en su campaña (`correo-1` la crea el primer PUT) y
  # su template_id es el campaign_id.
  expect_null(st$mail_template)
  expect_identical(st$mail_campaigns$campaigns[[1]]$template$preset_id, "invitacion_capacitacion_v1")
  expect_identical(put$campaign_id, "correo-1")
  expect_identical(put$template$template_id, "correo-1")
  again <- collection_mail_template_put(sid, put$template, put$state_revision)
  expect_true(again$noop)
  bad <- inv; bad$blocks[[2]]$text <- "<p>hola</p>"
  err <- tryCatch(collection_mail_template_put(sid, bad, put$state_revision), error = function(e) e)
  expect_identical(err$code %||% err$body$code %||% NA_character_, "E_COLLECTION_MAIL_TEMPLATE_INVALID")
})

test_that("HTTP: GET -> JSON -> PUT de la plantilla y de cada preset con el serializador de producción", {
  testthat::skip_if_not_installed("plumber")
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))

  g <- .cmail_fx_call(pr, sid, "GET", "/api/recopiladores/mail-template")
  expect_identical(g$status, 200L)
  expect_false(grepl(':\\{\\}', gsub('"images":\\{\\}', "", g$raw)))
  p <- .cmail_fx_call(pr, sid, "GET", "/api/recopiladores/mail-presets")
  expect_identical(p$status, 200L)
  templates <- c(list(g$body$template), lapply(p$body$presets, `[[`, "template"))
  rev <- unlist(g$body$state_revision)
  for (i in seq_along(templates)) {
    tpl <- templates[[i]]
    if (i > 1L) tpl$subject <- paste(tpl$subject, i)   # evita el noop
    put <- .cmail_fx_call(pr, sid, "PUT", "/api/recopiladores/mail-template",
                          .cmail_fx_json(list(template = tpl, expected_revision = rev)))
    expect_identical(put$status, 200L, info = substr(put$raw, 1, 800))
    rev <- unlist(put$body$state_revision)
    back <- .cmail_fx_call(pr, sid, "GET", "/api/recopiladores/mail-template")
    again <- .cmail_fx_call(pr, sid, "PUT", "/api/recopiladores/mail-template",
                            .cmail_fx_json(list(template = back$body$template, expected_revision = rev)))
    expect_identical(again$status, 200L, info = substr(again$raw, 1, 800))
    expect_true(isTRUE(unlist(again$body$noop)), info = i)
  }

  stale <- .cmail_fx_call(pr, sid, "PUT", "/api/recopiladores/mail-template",
                          .cmail_fx_json(list(template = g$body$template, expected_revision = 0L)))
  expect_identical(stale$status, 409L)

  pv <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-template/preview", .cmail_fx_json(list(mode = "mailchimp")))
  expect_identical(pv$status, 200L)
  expect_match(unlist(pv$body$html), "*|UNSUB|*", fixed = TRUE)
  bad <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-template/preview", .cmail_fx_json(list(mode = "pdf")))
  expect_identical(bad$status, 422L)
})


test_that("banner: ocupa todo el ancho de la tarjeta (sin max-width) y conserva width=600 para Outlook", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  .cmail_fx_logo(sid, "banner-estudio.png", width = 1200L, height = 600L)
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  t$header <- list(kind = "banner", image_ref = "banner-estudio")
  t$images <- list(`banner-estudio` = list(alt = "Estudio"))
  images <- .cmail_images_resolve(session_get(sid), t)
  html <- collection_mail_render(t, "mailchimp", images = images)$html
  img <- regmatches(html, regexpr('<img [^>]*alt="Estudio"[^>]*>', html))
  expect_length(img, 1L)
  expect_match(img, 'width="600"', fixed = TRUE)
  expect_match(img, "width:100%;height:auto;", fixed = TRUE)
  expect_false(grepl("max-width", img, fixed = TRUE))
})

test_that("imagen a sangre bajo la franja de logos: llena la tarjeta y no deja raya blanca", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  .cmail_fx_logo(sid, "banner-estudio.png", width = 1200L, height = 600L)
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  t$images$`banner-estudio` <- list(alt = "Estudio")
  t$blocks <- c(list(list(block_id = "banner", type = "image", image_ref = "banner-estudio", alt = "Estudio", bleed = TRUE)), t$blocks)
  images <- .cmail_images_resolve(session_get(sid), t)
  html <- collection_mail_render(t, "mailchimp", images = images)$html
  img <- regmatches(html, regexpr('<img [^>]*alt="Estudio"[^>]*>', html))
  expect_match(img, 'width="600"', fixed = TRUE)
  expect_match(img, "width:100%;height:auto;", fixed = TRUE)
  expect_false(grepl("width:600px", img, fixed = TRUE))
  expect_false(grepl('height:8px;line-height:8px;font-size:0;">&nbsp;</td></tr>', html, fixed = TRUE))
  # Sin imagen a sangre al inicio, el aire bajo la cabecera sigue.
  t2 <- .cmail_template_normalize(.cmail_preset_recuperacion())
  expect_match(collection_mail_render(t2, "mailchimp", images = .cmail_images_resolve(session_get(sid), t2))$html,
               'height:8px;line-height:8px;font-size:0;">&nbsp;</td></tr>', fixed = TRUE)
})

test_that("banner: al menos 1200 px de ancho y forma de banner (4:3 a 2,4:1)", {
  for (dims in list(c(1201L, 810L, 1L), c(1200L, 600L, 1L), c(3201L, 1801L, 1L), c(1200L, 1300L, 0L),
                    c(800L, 400L, 0L), c(3000L, 1000L, 0L))) {
    sid <- session_create()
    .cmail_fx_logo(sid, "banner-estudio.png", width = dims[[1]], height = dims[[2]])
    t <- .cmail_template_normalize(.cmail_preset_recuperacion())
    t$header <- list(kind = "banner", image_ref = "banner-estudio")
    t$images <- list(`banner-estudio` = list(alt = "Estudio"))
    r <- collection_mail_review(sid, template = t)
    by <- setNames(r$checks, vapply(r$checks, `[[`, "", "code"))
    expect_identical(by$banner_size$status, if (dims[[3]] == 1L) "ok" else "error", label = paste(dims[1:2], collapse = "x"))
    session_delete(sid)
  }
})
