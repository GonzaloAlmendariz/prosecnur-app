# Correo E1j (ADR 0110): plataforma por campaña. Un solo render con dialecto
# (mailchimp | surveymonkey), paridad de bytes en Mailchimp contra la huella
# capturada antes del cambio, revisión y export por dialecto, `fields[].sm`,
# `theme.band`, `raw_platform_tag` y destinatarios fuera con SurveyMonkey.
# Fixtures sintéticos.

.cmd_err <- function(expr) tryCatch({ force(expr); NULL }, api_error = function(e) e)
.cmd_code <- function(expr) { e <- .cmd_err(expr); if (is.null(e)) NA_character_ else e$code }
.cmd_by <- function(r) setNames(r$checks, vapply(r$checks, `[[`, "", "code"))
.cmd_codes <- function(t) vapply(collection_mail_template_validate(.cmail_template_normalize(t))$problems, `[[`, "", "code")
.cmd_rev <- function(sid) collection_mail_campaigns_get(sid)$state_revision

# Campaña SurveyMonkey con las imágenes del preset alojadas y los campos mapeados.
.cmd_sm_campaign <- function(sid, name = "Arte FG", map_all = TRUE) {
  c <- collection_mail_campaign_create(sid, .cmd_rev(sid), name = name, platform = "surveymonkey")
  t <- c$campaign$template
  t$images$`logo-cliente`$url <- "https://pulsopucp.github.io/correo-/logo-cliente.png"
  t$images$pulso$url <- "https://pulsopucp.github.io/correo-/pulso.png"
  if (map_all) {
    for (i in seq_along(t$fields)) {
      if (identical(t$fields[[i]]$key, "carrera")) t$fields[[i]]$sm <- "CustomData1"
      if (identical(t$fields[[i]]$key, "codigo")) t$fields[[i]]$sm <- "CustomData2"
    }
  }
  p <- collection_mail_template_put(sid, t, .cmd_rev(sid), campaign_id = c$campaign$campaign_id)
  list(id = c$campaign$campaign_id, template = p$template)
}

test_that("paridad: export/mailchimp da el MISMO SHA256 que el render anterior (huella capturada)", {
  fx <- jsonlite::fromJSON(.cmail_fx_mail_import_path("paridad-mailchimp-sha256.json"), simplifyVector = FALSE)
  cases <- .cmail_fx_parity_cases()
  expect_setequal(names(cases), names(fx$sha256))
  for (n in names(cases)) {
    c <- cases[[n]]
    new <- collection_mail_render(c$t, "export", "mailchimp", images = c$images)$html
    alias <- collection_mail_render(c$t, "mailchimp", images = c$images)$html
    expect_identical(.cmail_fx_sha(new), fx$sha256[[n]], label = paste("export/mailchimp", n))
    expect_identical(alias, new, label = paste("alias mode = mailchimp", n))
    pv <- collection_mail_render(c$t, "preview", values = fx$preview_values, images = c$images)$html
    expect_identical(.cmail_fx_sha(pv), fx$preview_sha256[[n]], label = paste("preview mailchimp", n))
  }
  # Los dos presets reales, como los sirve la app hoy (con `sm` en el enlace).
  for (id in c("recuperacion", "invitacion")) {
    expect_identical(.cmail_fx_sha(collection_mail_render(cases[[id]]$t, "export")$html), fx$sha256[[id]])
  }
})

test_that("surveymonkey: el mismo {{enlace}} sale [SurveyLink]; [FirstName] sin condicional; pie con [OptOutLink]", {
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  for (i in seq_along(t$fields)) if (t$fields[[i]]$key == "carrera") t$fields[[i]]$sm <- "CustomData1"
  imgs <- .cmail_fx_parity_images()
  html <- collection_mail_render(t, "export", "surveymonkey", images = imgs)$html
  expect_match(html, 'href="[SurveyLink]"', fixed = TRUE)
  expect_match(html, "Estimado(a) [FirstName]:", fixed = TRUE)
  expect_match(html, "[CustomData1]", fixed = TRUE)
  expect_match(html, 'href="[PrivacyLink]"', fixed = TRUE)
  expect_match(html, 'href="[OptOutLink]"', fixed = TRUE)
  for (bad in c("*|", "IF:", "data:", "data-pulso", "{{")) expect_false(grepl(bad, html, fixed = TRUE), label = bad)
  # Imagen sin URL: src vacío (lo bloquea images_public_url); con URL https, la URL.
  expect_match(html, 'src="https://pulsopucp.github.io/correo-/pulso.png"', fixed = TRUE)
  expect_match(html, '<img src="" width=', fixed = TRUE)
  # Un campo sin `sm` sale vacío (lo bloquea sm_fields_mapped).
  expect_match(html, "en la que usted se encuentra matriculado(a) como estudiante de [CustomData1].", fixed = TRUE)
  # La preview pinta el pie del dialecto con enlaces simulados, sin etiquetas.
  pv <- collection_mail_render(t, "preview", "surveymonkey", values = list(nombre = "Ana"))$html
  expect_match(pv, "Si desea darse de baja de esta encuesta", fixed = TRUE)
  expect_false(grepl("[OptOutLink]", pv, fixed = TRUE))
  # Verificación estructural.
  v <- .cmail_sm_html_verify(collection_mail_render(t, "export", "surveymonkey",
    images = lapply(imgs, function(i) { i$url <- i$url %||% "https://x.org/a.png"; i }))$html)
  expect_true(v$ok)
  bad <- .cmail_sm_html_verify('<a href="*|UNSUB|*">x</a><img src="data:image/png;base64,AA"> {{x}} data-pulso')
  expect_false(bad$ok)
  expect_length(bad$problems, 7L)
})

test_that("theme.band: franja de cierre acento o suave; por defecto, la de siempre", {
  t <- .cmail_template_normalize(.cmail_preset_invitacion())
  base <- collection_mail_render(t, "export")$html
  expect_match(base, 'bgcolor="#f3f3f3" style="background-color:#f3f3f3;height:20px', fixed = TRUE)
  t$theme$band <- "acento"
  expect_length(.cmd_codes(t), 0L)
  expect_match(collection_mail_render(.cmail_template_normalize(t), "export")$html,
               'bgcolor="#0b1f54" style="background-color:#0b1f54;height:20px', fixed = TRUE)
  t$theme$band <- "neon"
  expect_true("bad_band" %in% .cmd_codes(t))
})

test_that("fields[].sm: en rango, único; raw_platform_tag rechaza [SurveyLink] y admite [Nombre del estudio]", {
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  expect_identical(t$fields[[3]]$sm, "SurveyLink")
  expect_length(.cmd_codes(t), 0L)
  t2 <- t; t2$fields[[1]]$sm <- "CustomData51"
  expect_true("bad_sm" %in% .cmd_codes(t2))
  t2$fields[[1]]$sm <- "Email"
  expect_true("bad_sm" %in% .cmd_codes(t2))
  t2$fields[[1]]$sm <- "SurveyLink"
  expect_true("duplicate_sm" %in% .cmd_codes(t2))
  t2$fields[[1]]$sm <- "CustomData50"
  expect_length(.cmd_codes(t2), 0L)
  t3 <- t; t3$blocks[[2]]$text <- "Haga clic en [SurveyLink] para responder."
  expect_true("raw_platform_tag" %in% .cmd_codes(t3))
  t3$blocks[[2]]$text <- "Hola [FirstName]"
  expect_true("raw_platform_tag" %in% .cmd_codes(t3))
  t3$blocks[[2]]$text <- "Estudio **[Nombre del estudio]** para [unidad solicitante]."
  expect_length(.cmd_codes(t3), 0L)
  # El preset de capacitación no mapea su enlace: es a una sala virtual, no a una encuesta.
  inv <- .cmail_template_normalize(.cmail_preset_invitacion())
  expect_null(inv$fields[[1]]$sm)
})

test_that("plataforma por campaña: por defecto mailchimp sin escribir; meta la cambia y purga destinatarios", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  a <- collection_mail_campaign_create(sid, 0L, name = "Uno")
  expect_identical(a$campaign$platform, "mailchimp")
  # Una campaña guardada sin `platform` (E1h) se lee como mailchimp, sin escribir.
  s <- session_get(sid)
  s$collection_state$mail_campaigns$campaigns[[1]]$platform <- NULL
  s$collection_state$mail_campaigns$campaigns[[1]]$sends <- NULL
  .session_env[[sid]] <- s
  rev0 <- .cmd_rev(sid)
  l <- collection_mail_campaigns_get(sid)
  expect_identical(l$campaigns[[1]]$platform, "mailchimp")
  expect_identical(l$campaigns[[1]]$sends[[1]]$send_id, "invitacion")
  expect_identical(collection_mail_template_get(sid)$state_revision, rev0)
  expect_null(session_get(sid)$collection_state$mail_campaigns$campaigns[[1]]$platform)

  .cmail_fx_import(sid)
  expect_true(collection_mail_recipients_get(sid)$loaded)
  m <- collection_mail_campaign_meta_put(sid, rev0, "uno", platform = "surveymonkey")
  expect_true(m$recipients_purged)
  expect_identical(m$campaign$platform, "surveymonkey")
  expect_false(collection_mail_recipients_get(sid)$loaded)
  e <- .cmd_err(.cmail_fx_import(sid))
  expect_identical(e$code, "E_COLLECTION_MAIL_PLATFORM")
  expect_equal(e$status, 422)
  expect_identical(.cmd_code(collection_mail_campaign_meta_put(sid, .cmd_rev(sid), "uno", platform = "fax")),
                   "E_COLLECTION_MAIL_PLATFORM")
  # Volver a mailchimp no purga nada (no hay qué) y deja importar.
  back <- collection_mail_campaign_meta_put(sid, .cmd_rev(sid), "uno", platform = "mailchimp")
  expect_false(back$recipients_purged)
  expect_true(.cmail_fx_import(sid)$loaded)
})

test_that("duplicar copia platform y sends; no copia imported_from ni destinatarios", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  imp <- collection_mail_import_html(sid, html = .cmail_fx_read_text(.cmail_fx_mail_import_path("arte-diseno-invitacion.html")),
                                     file_name = "arte.html", subject = "Invitación")
  c <- collection_mail_campaign_create(sid, 0L, name = "Arte", platform = "surveymonkey",
                                       template = imp$template, import_id = imp$import_id)
  expect_identical(c$campaign$imported_from$sha256, imp$sha256)
  p <- collection_mail_template_put(sid, NULL, .cmd_rev(sid), campaign_id = "arte",
    sends = list(list(send_id = "invitacion"), list(label = "Recordatorio", date = "2026-09-08")))
  d <- collection_mail_campaign_duplicate(sid, .cmd_rev(sid), "arte", name = "Arte 2")
  expect_identical(d$campaign$platform, "surveymonkey")
  expect_identical(vapply(d$campaign$sends, `[[`, "", "send_id"), c("invitacion", "recordatorio-1"))
  expect_null(d$campaign$imported_from)
  expect_false(d$recipients_copied)
})

test_that("revisión SurveyMonkey: survey_link, footer_optout, images_public_url, sm_fields_mapped, avisos; sin audiencia", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  sm <- .cmd_sm_campaign(sid, map_all = FALSE)
  r <- collection_mail_review(sid, campaign_id = sm$id)
  expect_identical(r$platform, "surveymonkey")
  expect_identical(r$scope, "plantilla")
  by <- .cmd_by(r)
  expect_false(any(c("images_hosted", "images_available", "import_zip_weight", "banner_size", "footer_unsub",
                     "recipients", "fields_empty", "tags_have_columns") %in% names(by)))
  for (code in c("subject", "preheader", "html_weight", "images_alt", "accent_contrast")) expect_true(code %in% names(by), label = code)
  expect_identical(by$survey_link$status, "ok")
  expect_identical(by$footer_optout$status, "ok")
  expect_identical(by$images_public_url$status, "ok")
  expect_identical(by$sm_fields_mapped$status, "error")
  expect_identical(unlist(by$sm_fields_mapped$items), "carrera")
  expect_true(any(vapply(by$sm_fields_mapped$targets, function(x) identical(x$block_id, "motivo"), NA)))
  expect_identical(by$sm_fallback$status, "warning")
  expect_true("nombre" %in% unlist(by$sm_fallback$items))
  expect_false(r$ready)

  # Imagen sin URL -> images_public_url error con targets.
  t <- sm$template
  t$images$pulso$url <- NULL
  for (i in seq_along(t$fields)) t$fields[[i]]$sm <- c("CustomData7", "CustomData2", "SurveyLink")[[i]]
  r2 <- .cmd_by(collection_mail_review(sid, template = t, campaign_id = sm$id))
  expect_identical(r2$images_public_url$status, "error")
  expect_identical(unlist(r2$images_public_url$items), "pulso")
  expect_identical(r2$images_public_url$targets[[1]]$block_id, "__cabecera")
  expect_identical(r2$sm_fields_mapped$status, "ok")
  expect_identical(r2$sm_custom_limit$status, "warning")

  # Sin enlace a la encuesta -> survey_link error.
  t3 <- t; t3$blocks <- Filter(function(b) !identical(b$type, "button"), t3$blocks)
  expect_identical(.cmd_by(collection_mail_review(sid, template = t3, campaign_id = sm$id))$survey_link$status, "error")
  # scope completo -> 422 E_COLLECTION_MAIL_PLATFORM (los contactos viven en SurveyMonkey).
  e <- .cmd_err(collection_mail_review(sid, campaign_id = sm$id, scope = "completo"))
  expect_identical(e$code, "E_COLLECTION_MAIL_PLATFORM")
  expect_equal(e$status, 422)
  expect_identical(.cmd_code(collection_mail_export(sid, .cmd_rev(sid), sm$id, scope = "completo")), "E_COLLECTION_MAIL_PLATFORM")
  # El respaldo no cubre en surveymonkey.
  expect_false(.cmail_fallback_covers("carrera", "cuerpo", "su carrera", "surveymonkey"))
  expect_true(.cmail_fallback_covers("carrera", "cuerpo", "su carrera", "mailchimp"))
})

test_that("export SurveyMonkey: ZIP con HTML verificado, LEEME y manifest; un solo role manifest; sin datos personales", {
  skip_if_not_installed("zip")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  sm <- .cmd_sm_campaign(sid)
  expect_identical(.cmd_code(collection_mail_export(sid, .cmd_rev(sid), sm$id, send_id = "nada")), "E_COLLECTION_MAIL_SEND_NOT_FOUND")
  ex <- collection_mail_export(sid, .cmd_rev(sid), sm$id)
  expect_identical(ex$platform, "surveymonkey")
  expect_identical(ex$send_id, "invitacion")
  expect_match(ex$zip$filename, "^arte-fg_invitacion_surveymonkey_\\d{8}-\\d{6}\\.zip$")
  expect_identical(vapply(ex$artifacts, `[[`, "", "role"), c("deliverable", "manifest"))
  expect_identical(unique(vapply(ex$artifacts, `[[`, "", "sensitivity")), "none")
  files <- session_get(sid)$files
  meta <- files[[ex$zip$file_id]]
  expect_true(file.exists(meta$path))
  expect_identical(meta$sha256, paste0("sha256:", tolower(digest::digest(file = meta$path, algo = "sha256"))))
  expect_identical(sum(vapply(files, function(f) identical(f$role, "manifest"), NA)), 1L)
  # Fuera del .pulso: en downloads/ de la sesión.
  expect_true(startsWith(normalizePath(meta$path), normalizePath(file.path(session_get(sid)$dir, "downloads"))))
  entries <- zip::zip_list(meta$path)$filename
  expect_setequal(entries, c("arte-fg-invitacion.html", "LEEME.txt", "manifest.json"))
  ex_dir <- tempfile(); on.exit(unlink(ex_dir, recursive = TRUE), add = TRUE)
  zip::unzip(meta$path, exdir = ex_dir)
  html <- .cmail_fx_read_text(file.path(ex_dir, "arte-fg-invitacion.html"))
  expect_true(.cmail_sm_html_verify(html)$ok)
  for (tag in c("[FirstName]", 'href="[SurveyLink]"', "[OptOutLink]", "[PrivacyLink]", "[CustomData1]")) {
    expect_true(grepl(tag, html, fixed = TRUE), label = tag)
  }
  leeme <- paste(readLines(file.path(ex_dir, "LEEME.txt"), encoding = "UTF-8"), collapse = "\n")
  expect_match(leeme, "Enterprise", fixed = TRUE)
  expect_match(leeme, "{{carrera}} (Carrera) -> [CustomData1]", fixed = TRUE)
  expect_match(leeme, "Asunto: [Nombre del estudio]: invitación a participar", fixed = TRUE)
  man <- jsonlite::fromJSON(file.path(ex_dir, "manifest.json"), simplifyVector = FALSE)
  expect_identical(man$schema, "collection_mail_export/v1")
  expect_identical(man$platform, "surveymonkey")
  expect_identical(man$send$send_id, "invitacion")
  expect_match(man$send$send_sha256, "^sha256:")
  expect_false(grepl("@", paste(unlist(man), collapse = " "), fixed = TRUE))
})

test_that("mailchimp: el export lleva el send_id en el nombre y manifest.send; el alias mode mailchimp sigue", {
  skip_if_not_installed("zip")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  a <- collection_mail_campaign_create(sid, 0L, name = "Uno")
  ex <- collection_mail_export(sid, .cmd_rev(sid), "uno", scope = "plantilla")
  expect_match(ex$zip$filename, "^uno_invitacion_plantilla-mailchimp_\\d{8}-\\d{6}\\.zip$")
  expect_identical(ex$manifest$platform, "mailchimp")
  expect_identical(ex$manifest$send$send_id, "invitacion")
  expect_identical(ex$artifacts[[2]]$filename, "uno_invitacion_mailchimp_manifest.json")
  pv <- collection_mail_preview(sid, mode = "mailchimp", campaign_id = "uno")
  expect_identical(pv$dialect, "mailchimp")
  expect_match(pv$html, "*|UNSUB|*", fixed = TRUE)
  ex2 <- collection_mail_preview(sid, mode = "export", campaign_id = "uno")
  expect_identical(ex2$html, pv$html)
  expect_identical(.cmd_code(collection_mail_preview(sid, mode = "pdf")), "E_COLLECTION_MAIL_MODE")
})

test_that("con 2+ campañas, preview/review con la plantilla en el cuerpo y sin campaign_id trabajan sin campaña", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  collection_mail_campaign_create(sid, 0L, name = "Uno")
  collection_mail_campaign_create(sid, 1L, name = "Dos", platform = "surveymonkey")
  pr <- collection_mail_presets_get(sid)$presets[[2]]$template
  pv <- collection_mail_preview(sid, template = pr)
  expect_true(pv$ok)
  expect_null(pv$campaign_id)
  expect_identical(pv$platform, "mailchimp")
  expect_identical(pv$recipient$source, "synthetic")
  rv <- collection_mail_review(sid, template = pr)
  expect_true(rv$ok)
  expect_null(rv$campaign_id)
  expect_identical(rv$scope, "plantilla")
  # Por HTTP: 200, no 422.
  pr_app <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  res <- .cmail_fx_call(pr_app, sid, "POST", "/api/recopiladores/mail-template/preview", .cmail_fx_json(list(template = pr)))
  expect_identical(res$status, 200L)
  # Sin plantilla en el cuerpo sigue exigiendo campaign_id.
  expect_identical(.cmd_code(collection_mail_preview(sid)), "E_COLLECTION_MAIL_CAMPAIGN_REQUIRED")
})

# ---- revisión metodológica E1jkl ------------------------------------------------

test_that("destino: un enlace que no es la encuesta no puede ser [SurveyLink]; la revisión no lo sugiere", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  c <- collection_mail_campaign_create(sid, 0L, name = "Capa", preset_id = "invitacion_capacitacion_v1", platform = "surveymonkey")
  t <- c$campaign$template
  expect_identical(t$fields[[1]]$destino, "otro")
  t$images$`logo-cliente`$url <- "https://x.org/a.png"; t$images$pulso$url <- "https://x.org/b.png"
  p <- collection_mail_template_put(sid, t, .cmd_rev(sid), campaign_id = "capa")
  r <- collection_mail_review(sid, campaign_id = "capa")
  expect_false(r$ready)
  by <- .cmd_by(r)
  expect_identical(by$survey_link$status, "error")
  expect_match(by$survey_link$detail, "SurveyMonkey no es la plataforma de este correo", fixed = TRUE)
  expect_false(grepl("con etiqueta SurveyLink)", by$sm_fields_mapped$detail, fixed = TRUE))
  expect_false(grepl("[SurveyLink]", by$sm_fields_mapped$detail, fixed = TRUE))
  expect_match(by$sm_fields_mapped$detail, "no es la plataforma", fixed = TRUE)
  # Seguir el consejo viejo (mapear la sala a SurveyLink) ya no pasa.
  t2 <- p$template; t2$fields[[1]]$sm <- "SurveyLink"
  e <- .cmd_err(collection_mail_template_put(sid, t2, .cmd_rev(sid), campaign_id = "capa"))
  expect_identical(e$code, "E_COLLECTION_MAIL_TEMPLATE_INVALID")
  expect_true("sm_destination_mismatch" %in% vapply(e$details$problems, `[[`, "", "code"))
  t3 <- t2; t3$fields[[1]]$destino <- "sitio"
  expect_true("bad_destino" %in% .cmd_codes(t3))
  # Un enlace vacío no pasa la verificación estructural.
  ok_html <- '<a href="[SurveyLink]">x</a><a href="[OptOutLink]">b</a>'
  expect_true(.cmail_sm_html_verify(ok_html)$ok)
  expect_false(.cmail_sm_html_verify(paste0(ok_html, '<a href="">Ingresar</a>'))$ok)
})

test_that("sm_fallback cita cómo sale sin dato y que el respaldo se descarta; sm_link_field_empty para enlaces", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  sm <- .cmd_sm_campaign(sid)
  by <- .cmd_by(collection_mail_review(sid, campaign_id = sm$id))
  expect_identical(by$sm_fallback$status, "warning")
  expect_match(by$sm_fallback$detail, "El saludo saldrá «Estimado(a) :»", fixed = TRUE)
  expect_match(by$sm_fallback$detail, "el respaldo «Estimado(a) estudiante:» no se usa", fixed = TRUE)
  expect_match(by$sm_fallback$detail, "{{carrera}} saldrá vacío; el respaldo «su carrera» no se usa.", fixed = TRUE)
  expect_false("enlace" %in% unlist(by$sm_fallback$items))
  expect_null(by$sm_link_field_empty)
  # Un dato del contacto dentro de una URL (sin respaldo): aviso propio.
  t <- sm$template
  t$fields <- c(t$fields, list(list(key = "dato", tag = "DATO", label = "Dato", sm = "CustomData3")))
  t$blocks <- append(t$blocks, list(list(block_id = "otro-boton", type = "button", text = "Ver", url = "https://x.org/?c={{dato}}")), after = 5L)
  by2 <- .cmd_by(collection_mail_review(sid, template = t, campaign_id = sm$id))
  expect_identical(by2$sm_link_field_empty$status, "warning")
  expect_identical(unlist(by2$sm_link_field_empty$items), "dato")
  expect_identical(by2$sm_link_field_empty$targets[[1]]$block_id, "otro-boton")
  expect_false("dato" %in% unlist(by2$sm_fallback$items))
})

test_that("manifest: app_version y audience_applied en los dos dialectos; collector_label sin PII", {
  skip_if_not_installed("zip")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  sm <- .cmd_sm_campaign(sid)
  p <- collection_mail_template_put(sid, NULL, .cmd_rev(sid), campaign_id = sm$id,
    sends = list(list(collector_label = "Recopilador Arte FG 2026"), list(audience = "parcial")))
  expect_identical(.cmd_code(collection_mail_template_put(sid, NULL, .cmd_rev(sid), campaign_id = sm$id,
    sends = list(list(collector_label = "de ana@ejemplo.org")))), "E_COLLECTION_MAIL_SEND_INVALID")
  ex <- collection_mail_export(sid, .cmd_rev(sid), sm$id)
  version <- as.character(utils::packageVersion("prosecnurapp"))
  expect_identical(ex$manifest$app_version, version)
  expect_identical(ex$manifest$send$audience_applied, "recopilador")
  expect_identical(ex$manifest$send$collector_label, "Recopilador Arte FG 2026")
  rec <- collection_mail_export(sid, .cmd_rev(sid), sm$id, send_id = "recordatorio-1")
  expect_identical(rec$manifest$send$audience_applied, "filtro_de_la_plataforma")
  expect_false(grepl("@", paste(unlist(rec$manifest), collapse = " "), fixed = TRUE))
  mc <- collection_mail_campaign_create(sid, .cmd_rev(sid), name = "Mc")
  em <- collection_mail_export(sid, .cmd_rev(sid), "mc", scope = "plantilla")
  expect_identical(em$manifest$app_version, version)
  expect_identical(em$manifest$send$audience_applied, "lista_importada")
})
