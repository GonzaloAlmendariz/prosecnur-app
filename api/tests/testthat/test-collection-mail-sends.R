# Correo E1k (ADR 0110): envíos dentro de la campaña. Invitación primera e
# imborrable, recordatorios con id del servidor estable y nunca reutilizado,
# PUT atómico con `noop`, plantilla efectiva con la apertura `__apertura` tras
# el saludo, uso de campos y export por envío. Fixtures sintéticos.

.cms_err <- function(expr) tryCatch({ force(expr); NULL }, api_error = function(e) e)
.cms_code <- function(expr) { e <- .cms_err(expr); if (is.null(e)) NA_character_ else e$code }
.cms_rev <- function(sid) collection_mail_campaigns_get(sid)$state_revision
.cms_codes <- function(v) vapply(v$problems, `[[`, "", "code")
.cms_tpl <- function() .cmail_template_normalize(.cmail_preset_recuperacion())

test_that("valor al leer: sin sends, solo la invitación; leer no escribe", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  collection_mail_campaign_create(sid, 0L, name = "Uno")
  s <- session_get(sid)
  s$collection_state$mail_campaigns$campaigns[[1]]$sends <- NULL
  .session_env[[sid]] <- s
  rev <- .cms_rev(sid)
  l <- collection_mail_campaigns_get(sid)
  expect_identical(l$campaigns[[1]]$sends, list(list(send_id = "invitacion", kind = "invitacion", label = "Invitación")))
  g <- collection_mail_template_get(sid, campaign_id = "uno")
  expect_identical(g$platform, "mailchimp")
  expect_identical(g$sends[[1]]$send_id, "invitacion")
  pv <- collection_mail_preview(sid, campaign_id = "uno")
  expect_identical(pv$send$send_id, "invitacion")
  expect_identical(pv$send$audience, "todos")
  expect_identical(.cms_rev(sid), rev)
  expect_null(session_get(sid)$collection_state$mail_campaigns$campaigns[[1]]$sends)
})

test_that("validación: invitación primera, tope 6, ids del servidor, fechas, apertura con enlaces y campos", {
  t <- .cms_tpl()
  v <- .cmail_sends_validate(list(list(send_id = "invitacion"), list(label = "R1", date = "2026-09-08"),
                                  list(audience = "ambos", opening = "Aún puede responder, **{{nombre}}**: [encuesta]({{enlace}}).")), t)
  expect_true(v$ok)
  expect_identical(vapply(v$sends, `[[`, "", "send_id"), c("invitacion", "recordatorio-1", "recordatorio-2"))
  expect_identical(v$sends[[3]]$label, "Recordatorio 2")
  expect_identical(v$sends[[2]]$audience, "sin_respuesta")
  expect_identical(v$seq, 2L)
  # Invitación que no es la primera, o que falta.
  expect_true("invitation_first" %in% .cms_codes(.cmail_sends_validate(list(list(kind = "recordatorio")), t)))
  expect_true("invitation_first" %in% .cms_codes(.cmail_sends_validate(list(list(), list(send_id = "invitacion")), t)))
  # Tope de 6.
  seven <- c(list(list()), rep(list(list()), 6L))
  expect_true("too_many_sends" %in% .cms_codes(.cmail_sends_validate(seven, t)))
  # Fecha, audiencia, etiqueta, campo desconocido, html y enlace en el asunto.
  bad <- .cmail_sends_validate(list(
    list(audience = "sin_respuesta"),
    list(date = "2026-02-30", audience = "todos", label = paste(rep("x", 41), collapse = ""),
         opening = "Hola {{desconocido}}", subject = "Ver [aquí](https://x.org)", extra = 1)
  ), t)
  expect_false(bad$ok)
  expect_true(all(c("bad_audience", "bad_date", "label_too_long", "unknown_field", "link_not_allowed", "unknown_key")
                  %in% .cms_codes(bad)))
  expect_true("label_email" %in% .cms_codes(.cmail_sends_validate(list(list(), list(label = "ana@ejemplo.org")), t)))
  long <- .cmail_sends_validate(list(list(), list(opening = strrep("a", 601))), t)
  expect_true("text_too_long" %in% .cms_codes(long))
  # Aviso de fechas (no bloquea).
  w <- .cmail_sends_validate(list(list(date = "2026-09-08"), list(date = "2026-09-02")), t)
  expect_true(w$ok)
  expect_identical(w$warnings[[1]]$code, "send_dates")
  # id estable: se conserva si existía; uno inventado se reasigna; nunca se reutiliza.
  prev <- v$sends
  v2 <- .cmail_sends_validate(list(prev[[1]], prev[[3]], list(send_id = "recordatorio-9")), t, previous = prev, seq = v$seq)
  expect_identical(vapply(v2$sends, `[[`, "", "send_id"), c("invitacion", "recordatorio-2", "recordatorio-3"))
  # La apertura necesita sitio bajo el tope de bloques.
  full <- t; full$blocks <- rep(t$blocks[2], 40L)
  full$blocks <- lapply(seq_along(full$blocks), function(i) { b <- full$blocks[[i]]; b$block_id <- paste0("p", i); b })
  expect_true("opening_no_room" %in% .cms_codes(.cmail_sends_validate(list(list(opening = "Hola")), full)))
})

test_that("PUT atómico: plantilla y envíos en UNA revisión; template.revision solo si cambió; noop sin cambios", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  a <- collection_mail_campaign_create(sid, 0L, name = "Uno")
  t <- a$campaign$template
  rev <- .cms_rev(sid)
  sends <- list(list(send_id = "invitacion", date = "2026-09-02"),
                list(label = "Recordatorio 1", date = "2026-09-08", subject = "Recordatorio: {{carrera}}",
                     opening = "Le recordamos que aún puede responder la encuesta hasta el **viernes 18 de setiembre**."))
  p <- collection_mail_template_put(sid, t, rev, campaign_id = "uno", sends = sends)
  expect_false(p$noop)
  expect_identical(p$state_revision, rev + 1L)
  expect_identical(p$template$revision, t$revision)
  expect_identical(vapply(p$sends, `[[`, "", "send_id"), c("invitacion", "recordatorio-1"))
  # Mismos envíos y misma plantilla: noop, sin subir revisión.
  again <- collection_mail_template_put(sid, t, p$state_revision, campaign_id = "uno", sends = p$sends)
  expect_true(again$noop)
  expect_identical(again$state_revision, p$state_revision)
  # Solo plantilla: sube template.revision y conserva los envíos.
  t2 <- t; t2$subject <- "Otro asunto"
  q <- collection_mail_template_put(sid, t2, p$state_revision, campaign_id = "uno")
  expect_identical(q$template$revision, t$revision + 1L)
  expect_identical(q$state_revision, p$state_revision + 1L)
  expect_identical(length(q$sends), 2L)
  # Envíos inválidos -> 422 sin escribir.
  e <- .cms_err(collection_mail_template_put(sid, t2, q$state_revision, campaign_id = "uno",
                                             sends = list(list(kind = "recordatorio"))))
  expect_identical(e$code, "E_COLLECTION_MAIL_SEND_INVALID")
  expect_equal(e$status, 422)
  expect_identical(.cms_rev(sid), q$state_revision)
  # Sin expected_revision vigente no escribe.
  expect_identical(.cms_code(collection_mail_template_put(sid, t2, 0L, campaign_id = "uno", sends = sends)),
                   "E_COLLECTION_STATE_STALE")
  # Quitar un recordatorio y agregar otro: el nuevo NO reutiliza recordatorio-1.
  r <- collection_mail_template_put(sid, NULL, q$state_revision, campaign_id = "uno",
                                    sends = list(list(send_id = "invitacion"), list(label = "Nuevo")))
  expect_identical(r$sends[[2]]$send_id, "recordatorio-2")
  expect_identical(r$template$revision, q$template$revision)
})

test_that("__apertura: plantilla efectiva tras el saludo, marcada en preview; un __x del usuario se rechaza", {
  t <- .cms_tpl()
  send <- list(send_id = "recordatorio-1", kind = "recordatorio", label = "Recordatorio 1", audience = "sin_respuesta",
               subject = "Recordatorio", preheader = "Aún puede responder.",
               opening = "Le recordamos que aún puede responder, {{nombre}}.")
  eff <- .cmail_template_for_send(t, send)
  expect_identical(vapply(eff$blocks, `[[`, "", "block_id")[1:2], c("saludo", "__apertura"))
  expect_identical(eff$blocks[[2]]$align, "justify")
  expect_identical(eff$subject, "Recordatorio")
  expect_true(collection_mail_template_validate(eff, allow_reserved_ids = TRUE)$ok)
  user <- t; user$blocks[[2]]$block_id <- "__x"
  expect_true("reserved_block_id" %in% vapply(collection_mail_template_validate(user)$problems, `[[`, "", "code"))
  pv <- collection_mail_render(eff, "preview", values = list(nombre = "Ana", fields = list()))$html
  expect_match(pv, '<tr data-pulso-block="__apertura" data-pulso-type="opening">', fixed = TRUE)
  expect_match(pv, 'data-pulso-prop="opening"', fixed = TRUE)
  mc <- collection_mail_render(eff, "export")$html
  expect_false(grepl("data-pulso", mc, fixed = TRUE))
  expect_match(mc, "Le recordamos que aún puede responder, *|FNAME|*.", fixed = TRUE)
  # Sin saludo, la apertura va al inicio.
  ng <- t; ng$blocks <- ng$blocks[-1]
  expect_identical(.cmail_template_for_send(ng, send)$blocks[[1]]$block_id, "__apertura")
  # Uso de campos: la apertura cuenta como cuerpo; el asunto del envío como asunto.
  send$subject <- "Para {{carrera}}"
  usage <- .cmail_key_usage(.cmail_template_for_send(t, send))
  expect_true("cuerpo" %in% usage$nombre)
  expect_true("asunto" %in% usage$carrera)
})

test_that("preview y review por envío: send_id, borrador y 404; export por envío con nombre y manifest.send", {
  skip_if_not_installed("zip")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  a <- collection_mail_campaign_create(sid, 0L, name = "Uno")
  p <- collection_mail_template_put(sid, NULL, .cms_rev(sid), campaign_id = "uno",
    sends = list(list(), list(date = "2026-09-08", subject = "Recordatorio: queda una semana",
                              opening = "Aún puede responder.")))
  pv <- collection_mail_preview(sid, campaign_id = "uno", send_id = "recordatorio-1")
  expect_identical(pv$subject, "Recordatorio: queda una semana")
  expect_identical(pv$send, list(send_id = "recordatorio-1", kind = "recordatorio", label = "Recordatorio 1",
                                 date = "2026-09-08", audience = "sin_respuesta"))
  expect_match(.cmail_fx_unmark(pv$html), "Aún puede responder.", fixed = TRUE)
  inv <- collection_mail_preview(sid, campaign_id = "uno")
  expect_false(grepl("Aún puede responder.", inv$html, fixed = TRUE))
  draft <- collection_mail_preview(sid, campaign_id = "uno", send = list(kind = "recordatorio", opening = "Borrador de apertura."))
  expect_match(.cmail_fx_unmark(draft$html), "Borrador de apertura.", fixed = TRUE)
  expect_null(draft$send$send_id)
  expect_identical(.cms_code(collection_mail_preview(sid, campaign_id = "uno", send = list(kind = "recordatorio", label = 5))),
                   "E_COLLECTION_MAIL_SEND_INVALID")
  nf <- .cms_err(collection_mail_preview(sid, campaign_id = "uno", send_id = "recordatorio-7"))
  expect_identical(nf$code, "E_COLLECTION_MAIL_SEND_NOT_FOUND")
  expect_equal(nf$status, 404)
  rv <- collection_mail_review(sid, campaign_id = "uno", send_id = "recordatorio-1", scope = "plantilla")
  expect_identical(rv$send_id, "recordatorio-1")
  expect_identical(rv$checks[[1]]$code, "subject")
  expect_identical(rv$checks[[1]]$value, nchar("Recordatorio: queda una semana"))

  ex <- collection_mail_export(sid, .cms_rev(sid), "uno", scope = "plantilla", send_id = "recordatorio-1")
  expect_match(ex$zip$filename, "^uno_recordatorio-1_plantilla-mailchimp_\\d{8}-\\d{6}\\.zip$")
  expect_identical(ex$send_id, "recordatorio-1")
  expect_identical(ex$manifest$send$send_id, "recordatorio-1")
  expect_identical(ex$manifest$send$subject, "Recordatorio: queda una semana")
  expect_identical(ex$manifest$send$date, "2026-09-08")
  # El ZIP importable trae el HTML del envío (asunto y apertura del recordatorio).
  path <- session_get(sid)$files[[ex$zip$file_id]]$path
  tmp <- tempfile(); on.exit(unlink(tmp, recursive = TRUE), add = TRUE)
  zip::unzip(path, exdir = tmp)
  html <- .cmail_fx_read_text(file.path(tmp, "uno.html"))
  expect_match(html, "Aún puede responder.", fixed = TRUE)
  expect_match(html, "<title>Recordatorio: queda una semana</title>", fixed = TRUE)
  # Nombre de 80 como máximo aun con un id de campaña de 40 y un recordatorio.
  expect_identical(nchar(.cmail_export_name(strrep("a", 40), "recordatorio-5", "mailchimp", stamp = "20261020-101010")) <= 80L, TRUE)
})

test_that("HTTP: PUT mail-template con sends y GET mail-campaigns con platform y sends", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  c <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-campaigns",
                      .cmail_fx_json(list(expected_revision = 0L, name = "Arte", platform = "surveymonkey")))
  expect_identical(c$status, 200L)
  expect_identical(c$body$campaign$platform, "surveymonkey")
  put <- .cmail_fx_call(pr, sid, "PUT", "/api/recopiladores/mail-template", .cmail_fx_json(list(
    expected_revision = c$body$state_revision, campaign_id = "arte", template = c$body$campaign$template,
    sends = list(list(send_id = "invitacion"), list(label = "Recordatorio 1", audience = "sin_respuesta")))))
  expect_identical(put$status, 200L)
  expect_identical(put$body$sends[[2]]$send_id, "recordatorio-1")
  g <- .cmail_fx_call(pr, sid, "GET", "/api/recopiladores/mail-campaigns")
  expect_identical(g$body$campaigns[[1]]$platform, "surveymonkey")
  expect_identical(vapply(g$body$campaigns[[1]]$sends, `[[`, "", "send_id"), c("invitacion", "recordatorio-1"))
  bad <- .cmail_fx_call(pr, sid, "PUT", "/api/recopiladores/mail-template", .cmail_fx_json(list(
    expected_revision = put$body$state_revision, campaign_id = "arte", template = put$body$template,
    sends = list(list(kind = "recordatorio")))))
  expect_identical(bad$status, 422L)
  expect_identical(bad$body$error$code, "E_COLLECTION_MAIL_SEND_INVALID")
})
