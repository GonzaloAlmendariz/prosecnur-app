# Preset «Invitación a encuesta» (H4, loop del editor de correo): la plantilla
# más común, tomada de las invitaciones reales de Acreditación. Va primero en
# «Empieza desde», valida, pasa la revisión salvo lo que depende de la lista y
# de los logos, y se exporta en los dos dialectos sin colores propios.

.cmpe_t <- function() .cmail_template_normalize(.cmail_preset_invitacion_encuesta())
.cmpe_block <- function(t, id) Filter(function(b) identical(b$block_id, id), t$blocks)[[1]]
.cmpe_hex <- function(x) sort(unique(tolower(regmatches(x, gregexpr("#[0-9a-fA-F]{6}\\b", x))[[1]])))

test_that("invitacion_encuesta_v1 valida y va primero en el listado de presets (también por HTTP)", {
  t <- .cmpe_t()
  v <- collection_mail_template_validate(t)
  expect_true(v$ok, info = paste(vapply(v$problems, `[[`, "", "detail"), collapse = "; "))
  expect_identical(t$preset_id, "invitacion_encuesta_v1")
  expect_identical(t$title, "Invitación a encuesta")
  expect_identical(t$subject, "[Nombre del estudio]: le invitamos a responder la encuesta")
  expect_false(grepl("\n", t$preheader, fixed = TRUE))
  expect_true(nzchar(t$preheader))

  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  ids <- vapply(collection_mail_presets_get(sid)$presets, `[[`, "", "preset_id")
  expect_identical(ids[[1]], "invitacion_encuesta_v1")

  pr_app <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  res <- .cmail_fx_call(pr_app, sid, "GET", "/api/recopiladores/mail-presets")
  expect_identical(res$status, 200L)
  first <- res$body$presets[[1]]
  expect_identical(first$preset_id, "invitacion_encuesta_v1")
  expect_identical(first$title, "Invitación a encuesta")
})

test_that("estructura: saludo por sexo, tres párrafos sin align, botón a la encuesta, aviso de tres puntos, firma", {
  t <- .cmpe_t()
  types <- vapply(t$blocks, `[[`, "", "type")
  expect_identical(types, c("greeting", "paragraph", "paragraph", "paragraph", "button", "callout",
                            "signature", "footer_legal"))
  g <- t$blocks[[1]]
  expect_identical(g$text, "Estimado(a) {{nombre}}:")
  expect_identical(g$trato$modo, "por_sexo")
  expect_null(g$trato$columna)

  # Los párrafos siguen al estilo: ninguno fija align (ni el tema text_align).
  for (b in t$blocks[types == "paragraph"]) expect_null(b$align, label = b$block_id)
  expect_null(t$theme$text_align)
  expect_identical(names(t$theme), "accent")
  expect_identical(t$theme$accent, .CMAIL_DEFAULT_ACCENT)
  expect_match(.cmpe_block(t, "contexto")$text, "*estudio de opinión*", fixed = TRUE)
  expect_match(.cmpe_block(t, "motivo")$text, "**aproximadamente [15] minutos**", fixed = TRUE)
  expect_match(.cmpe_block(t, "plazo")$text, "Puede participar hasta el **[fecha límite]**.", fixed = TRUE)

  btn <- .cmpe_block(t, "accion")
  expect_identical(btn$text, "Empezar aquí")
  expect_identical(btn$url, "{{enlace}}")
  f <- Filter(function(x) identical(x$key, "enlace"), t$fields)
  expect_length(f, 1L)
  expect_identical(f[[1]]$destino, "encuesta")
  expect_identical(f[[1]]$sm, "SurveyLink")
  expect_identical(vapply(t$fields, `[[`, "", "key"), "enlace")

  imp <- .cmpe_block(t, "importante")
  expect_identical(imp$title, "Importante:")
  items <- unlist(imp$items)
  expect_length(items, 3L)
  expect_match(items[[1]], "única y personal", fixed = TRUE)
  expect_match(items[[1]], "no la reenvíe", fixed = TRUE)
  expect_match(items[[2]], "la complete en su totalidad", fixed = TRUE)
  expect_match(items[[3]], "confidencial", fixed = TRUE)
  expect_match(items[[3]], "forma agregada", fixed = TRUE)

  firma <- .cmpe_block(t, "firma")
  expect_identical(firma$closing, "Saludos cordiales,")
  expect_identical(firma$name, "PULSO PUCP")
  expect_identical(unlist(firma$lines), "Instituto de Analítica Social e Inteligencia Estratégica")
  expect_identical(t$header$kind, "logos")
  expect_identical(unlist(t$header$logo_ids), c("logo-cliente", "pulso"))
})

test_that("render export Mailchimp y SurveyMonkey sin errores; botón al enlace de la encuesta", {
  t <- .cmpe_t()
  mc <- collection_mail_render(t, "export", "mailchimp")$html
  expect_match(mc, 'href="*|ENLACE|*"', fixed = TRUE)
  expect_match(mc, "Empezar aquí", fixed = TRUE)
  expect_match(mc, "*|UNSUB|*", fixed = TRUE)
  expect_match(mc, '<em style="font-style:italic;">estudio de opinión</em>', fixed = TRUE)
  for (bad in c("{{", "[SurveyLink]", "data-pulso")) expect_false(grepl(bad, mc, fixed = TRUE), label = bad)
  # Tres puntos en el aviso, uno por fila.
  expect_match(mc, "única y personal", fixed = TRUE)
  expect_match(mc, "la complete en su totalidad", fixed = TRUE)

  sm <- collection_mail_render(t, "export", "surveymonkey")$html
  expect_match(sm, 'href="[SurveyLink]"', fixed = TRUE)
  expect_match(sm, "Estimado(a) [FirstName]:", fixed = TRUE)
  expect_match(sm, 'href="[OptOutLink]"', fixed = TRUE)
  for (bad in c("*|", "{{", "data-pulso")) expect_false(grepl(bad, sm, fixed = TRUE), label = bad)
  # Con los logos alojados, el HTML de SurveyMonkey pasa la verificación estructural.
  imgs <- list(`logo-cliente` = list(url = "https://x.org/a.png", width = 160L, height = 46L, alt = "[Unidad solicitante]"),
               pulso = list(url = "https://x.org/b.png", width = 160L, height = 46L, alt = "Pulso PUCP"))
  v <- .cmail_sm_html_verify(collection_mail_render(t, "export", "surveymonkey", images = imgs)$html)
  expect_true(v$ok, info = paste(unlist(v$problems), collapse = "; "))
})

test_that("ningún color fuera del acento y de las constantes de la casa", {
  t <- .cmpe_t()
  pal <- .cmail_theme_palette(t, .CMAIL_DEFAULT_ACCENT, .CMAIL_DEFAULT_ACCENT)
  pal_hex <- unlist(Filter(function(x) is.character(x) && length(x) == 1L && grepl("^#", x), pal))
  house <- c(tolower(pal_hex), .CMAIL_TEXT_COLOR, .CMAIL_BORDER, .CMAIL_MUTED, .CMAIL_PAGE_BG,
             .CMAIL_FOOTER_TEXT, "#ffffff", "#f3f3f3", "#555555")
  for (d in c("mailchimp", "surveymonkey")) {
    html <- collection_mail_render(t, "export", d)$html
    expect_identical(setdiff(.cmpe_hex(html), tolower(house)), character(0), label = d)
  }
})

# El relleno entre corchetes («[fecha límite]») bloquea por diseño: el preset
# trae frases para completar (placeholders_pending, collection_mail_pendientes.R).
test_that("revisión: solo falla el relleno por completar y lo que depende de la lista (y del logo en SurveyMonkey)", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  rv <- collection_mail_review(sid, template = .cmpe_t())
  bad <- Filter(function(c) identical(c$status, "error"), rv$checks)
  expect_identical(vapply(bad, `[[`, "", "code"), c("placeholders_pending", "recipients"))

  c <- collection_mail_campaign_create(sid, collection_mail_campaigns_get(sid)$state_revision,
                                       name = "Acreditación", preset_id = "invitacion_encuesta_v1")
  expect_identical(c$campaign$template$preset_id, "invitacion_encuesta_v1")
  r <- collection_mail_review(sid, campaign_id = c$campaign$campaign_id)
  errs <- vapply(Filter(function(x) identical(x$status, "error"), r$checks), `[[`, "", "code")
  expect_true(all(errs %in% c("placeholders_pending", "recipients")), info = paste(errs, collapse = ", "))
  warns <- vapply(Filter(function(x) identical(x$status, "warning"), r$checks), `[[`, "", "code")
  expect_true(all(warns %in% c("greeting_trato", "recipients", "images_hosted")), info = paste(warns, collapse = ", "))

  s <- collection_mail_campaign_create(sid, collection_mail_campaigns_get(sid)$state_revision,
                                       name = "Acreditación SM", preset_id = "invitacion_encuesta_v1",
                                       platform = "surveymonkey")
  rs <- collection_mail_review(sid, campaign_id = s$campaign$campaign_id)
  by <- setNames(rs$checks, vapply(rs$checks, `[[`, "", "code"))
  expect_false(identical(by$survey_link$status, "error"))
  errs_sm <- vapply(Filter(function(x) identical(x$status, "error"), rs$checks), `[[`, "", "code")
  # En SurveyMonkey los logos deben estar alojados (URL https): depende de los logos.
  expect_true(all(errs_sm %in% c("placeholders_pending", "images_public_url", "images_hosted")), info = paste(errs_sm, collapse = ", "))
})
