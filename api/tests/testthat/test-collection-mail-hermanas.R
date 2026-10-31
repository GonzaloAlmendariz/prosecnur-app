# Un correo, varios públicos (GOAL editor de correos, L16): tú/usted con
# `[[tú|usted]]` (collection_mail_registro.R) y «Aplicar a las campañas
# hermanas» (collection_mail_hermanas.R). Sin red.

.cmh_tpl <- function(registro = NULL) {
  t <- .cmail_template_normalize(.cmail_preset_invitacion_encuesta())
  t$subject <- "[[Tu|Su]] opinión cuenta"
  t$constants <- list(list(key = "premios", label = "Premios", value = "una tablet"))
  t$blocks <- append(t$blocks, list(list(block_id = "sorteo", type = "paragraph",
    text = "[[Responde|Responda]] y participa en el sorteo de {{premios}}. [[Tus|Sus]] respuestas son confidenciales.")), after = 1L)
  t$registro <- registro
  .cmail_template_normalize(t)
}

.cmh_codes <- function(t) vapply(collection_mail_template_validate(t)$problems, `[[`, "", "code")
.cmh_text <- function(t, id) Filter(function(b) identical(b$block_id, id), t$blocks)[[1]]$text

test_that("las variantes se escriben según el trato: usted por defecto, tú cuando la campaña lo pide", {
  usted <- .cmail_template_for_send(.cmh_tpl(), NULL)
  expect_identical(usted$subject, "Su opinión cuenta")
  expect_identical(.cmh_text(usted, "sorteo"), "Responda y participa en el sorteo de una tablet. Sus respuestas son confidenciales.")
  tu <- .cmail_template_for_send(.cmh_tpl("tu"), list(send_id = "recordatorio-1", kind = "recordatorio", label = "R1",
                                                      audience = "ambos", opening = "[[Te|Le]] recordamos."))
  expect_identical(tu$subject, "Tu opinión cuenta")
  expect_identical(.cmh_text(tu, .CMAIL_OPENING_ID), "Te recordamos.")
  html <- collection_mail_render(tu, mode = "export", dialect = "mailchimp")$html
  expect_match(html, "Responde y participa", fixed = TRUE)
  expect_false(grepl("[[", html, fixed = TRUE))
  # Una forma vacía y una variante dentro de un dato de campaña.
  t <- .cmh_tpl("tu"); t$constants[[1]]$value <- "una tablet[[| para usted]]"
  expect_identical(.cmh_text(.cmail_template_for_send(t, NULL), "sorteo"),
                   "Responde y participa en el sorteo de una tablet. Tus respuestas son confidenciales.")
  expect_identical(.cmail_registro_variantes(t), 4L)
})

test_that("sin variantes el correo sale igual que antes", {
  t <- .cmail_template_normalize(.cmail_preset_invitacion_encuesta())
  expect_identical(.cmail_registro_apply(t), t)
  expect_identical(.cmail_template_for_send(t, NULL), .cmail_constants_apply(t))
})

test_that("el trato es tu o usted y una variante mal cerrada no valida", {
  expect_true(collection_mail_template_validate(.cmh_tpl("tu"))$ok)
  expect_true("bad_registro" %in% .cmh_codes(.cmh_tpl("vos")))
  for (mal in c("[[Responde]] ya", "[[Responde|Responda ya", "Responde|Responda]] ya", "[[a|b|c]]")) {
    t <- .cmh_tpl(); t$blocks[[2]]$text <- mal
    expect_true("bad_variante" %in% .cmh_codes(t), label = mal)
  }
})

.cmh_proyecto <- function() {
  sid <- .cmail_fx_session()
  rev <- as.integer(session_get(sid)$collection_state$state_revision %||% 0L)
  a <- collection_mail_campaign_create(sid, rev, name = "Profesores", template = .cmh_tpl())
  b <- collection_mail_campaign_duplicate(sid, a$state_revision, "profesores", name = "Estudiantes de pregrado")
  # La hermana es suya: se tutea, su enlace es otro, su premio también y tiene un recordatorio.
  t <- b$campaign$template
  t$registro <- "tu"
  t$fields[[1]]$tag <- "ENLPRE"
  t$constants[[1]]$value <- "seis iPads"
  sends <- list(b$campaign$sends[[1]], list(kind = "recordatorio", label = "Recordatorio 1", audience = "ambos",
                                            subject = "Aún puedes", date = "2026-11-05"))
  p <- collection_mail_template_put(sid, t, b$state_revision, campaign_id = "estudiantes-de-pregrado", sends = sends)
  list(sid = sid, rev = p$state_revision)
}

test_that("aplicar copia el cuerpo y los envíos y deja a la hermana su trato, su enlace y sus datos", {
  px <- .cmh_proyecto(); on.exit(session_delete(px$sid), add = TRUE)
  # Cambia el origen: asunto, un bloque nuevo, un campo y un dato nuevos, dos envíos.
  t <- collection_mail_template_get(px$sid, campaign_id = "profesores")$template
  t$subject <- "[[Tu|Su]] voz para la acreditación"
  t$fields <- c(t$fields, list(list(key = "facultad", tag = "FACULTAD", label = "Facultad")))
  t$constants <- c(t$constants, list(list(key = "duracion", label = "Duración", value = "10 minutos")))
  t$blocks <- append(t$blocks, list(list(block_id = "dato", type = "paragraph", text = "De {{facultad}}, toma {{duracion}}.")), after = 2L)
  sends <- list(list(send_id = "invitacion", kind = "invitacion", label = "Invitación", audience = "todos", subject = "Invitación"),
                list(kind = "recordatorio", label = "Recordatorio 1", audience = "sin_respuesta", subject = "[[Recuerda|Recuerde]]"),
                list(kind = "recordatorio", label = "Recordatorio 2", audience = "ambos", subject = "Última semana"))
  p <- collection_mail_template_put(px$sid, t, px$rev, campaign_id = "profesores", sends = sends)

  sim <- collection_mail_campaigns_apply_siblings(px$sid, p$state_revision, "profesores", list("estudiantes-de-pregrado"),
                                                  dry_run = TRUE)
  h <- sim$hermanas[[1]]
  # Asunto, bloque «sorteo» (2) y el asunto del recordatorio 1.
  expect_identical(sim$variantes_origen, 4L)
  expect_true(all(c("Asunto", "Bloques") %in% unlist(h$cambios)))
  expect_true(any(grepl("^Recordatorio 2: se agrega", unlist(h$cambios))))
  expect_identical(unlist(h$campos_agregados), "facultad")
  expect_identical(unlist(h$datos_agregados), "duracion")
  expect_identical(h$conserva$registro, "tu")
  expect_identical(unlist(h$conserva$enlaces), "ENLPRE")
  # La simulación no escribe.
  expect_identical(as.integer(session_get(px$sid)$collection_state$state_revision), p$state_revision)

  ok <- collection_mail_campaigns_apply_siblings(px$sid, p$state_revision, "profesores", list("estudiantes-de-pregrado"))
  expect_identical(ok$state_revision, p$state_revision + 1L)
  g <- collection_mail_template_get(px$sid, campaign_id = "estudiantes-de-pregrado")
  ht <- g$template
  expect_identical(ht$registro, "tu")
  expect_identical(ht$fields[[1]]$tag, "ENLPRE")
  expect_identical(ht$constants[[1]]$value, "seis iPads")
  expect_identical(ht$constants[[2]]$value, "10 minutos")
  expect_identical(.cmail_template_for_send(ht, NULL)$subject, "Tu voz para la acreditación")
  expect_true("dato" %in% vapply(ht$blocks, `[[`, "", "block_id"))
  expect_length(g$sends, 3L)
  expect_identical(g$sends[[2]]$subject, "[[Recuerda|Recuerde]]")
  expect_identical(g$sends[[2]]$audience, "sin_respuesta")
  expect_identical(g$sends[[2]]$date, "2026-11-05")   # la fecha es de la hermana
  expect_identical(g$sends[[3]]$label, "Recordatorio 2")
  # El origen no cambia.
  expect_null(collection_mail_template_get(px$sid, campaign_id = "profesores")$template$registro)
})

test_that("sólo el cuerpo deja los envíos; destino vacío, partes raras o una hermana inválida no escriben", {
  px <- .cmh_proyecto(); on.exit(session_delete(px$sid), add = TRUE)
  r <- collection_mail_campaigns_apply_siblings(px$sid, px$rev, "profesores", list("estudiantes-de-pregrado"), partes = list("cuerpo"))
  g <- collection_mail_template_get(px$sid, campaign_id = "estudiantes-de-pregrado")
  expect_identical(g$sends[[2]]$subject, "Aún puedes")
  expect_error(collection_mail_campaigns_apply_siblings(px$sid, r$state_revision, "profesores", list("profesores")),
               class = "api_error")
  e <- tryCatch(collection_mail_campaigns_apply_siblings(px$sid, r$state_revision, "profesores", list()), error = identity)
  expect_identical(e$code, "E_COLLECTION_MAIL_HERMANAS_SIN_DESTINO")
  e <- tryCatch(collection_mail_campaigns_apply_siblings(px$sid, r$state_revision, "profesores", list("estudiantes-de-pregrado"),
                                                         partes = list("todo")), error = identity)
  expect_identical(e$code, "E_COLLECTION_MAIL_HERMANAS_PARTES")
  e <- tryCatch(collection_mail_campaigns_apply_siblings(px$sid, r$state_revision, "profesores", list("no-existe")), error = identity)
  expect_identical(e$code, "E_COLLECTION_MAIL_CAMPAIGN_NOT_FOUND")
  # Con una variante rota en la hermana (su dato), la hermana quedaría inválida: no se escribe nada.
  st <- session_get(px$sid)$collection_state
  i <- which(vapply(st$mail_campaigns$campaigns, `[[`, "", "campaign_id") == "estudiantes-de-pregrado")
  st$mail_campaigns$campaigns[[i]]$template$constants[[1]]$value <- "seis [[iPads"
  st$state_revision <- r$state_revision + 1L
  .collection_store(px$sid, st)
  e <- tryCatch(collection_mail_campaigns_apply_siblings(px$sid, st$state_revision, "profesores", list("estudiantes-de-pregrado")),
                error = identity)
  expect_identical(e$code, "E_COLLECTION_MAIL_TEMPLATE_INVALID")
  expect_identical(as.integer(session_get(px$sid)$collection_state$state_revision), st$state_revision)
})

test_that("una variante rota en un envío no valida y no llega a la exportación", {
  t <- .cmh_tpl()
  for (k in c("subject", "preheader", "opening")) {
    s <- list(send_id = "invitacion", kind = "invitacion", label = "Invitación", audience = "todos")
    s[[k]] <- "[[Te|Le escribimos"
    v <- .cmail_sends_validate(list(s), t)
    expect_true("bad_variante" %in% vapply(v$problems, `[[`, "", "code"), label = k)
  }
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  rev <- as.integer(session_get(sid)$collection_state$state_revision %||% 0L)
  a <- collection_mail_campaign_create(sid, rev, name = "Profesores", template = t)
  sends <- list(list(send_id = "invitacion", kind = "invitacion", label = "Invitación", audience = "todos", subject = "[[Responde ya"))
  e <- tryCatch(collection_mail_template_put(sid, t, a$state_revision, campaign_id = "profesores", sends = sends), error = identity)
  expect_identical(e$code, "E_COLLECTION_MAIL_SEND_INVALID")
})

test_that("el asunto repetido se compara con el trato de la campaña", {
  for (r in c("tu", "usted")) {
    t <- .cmh_tpl(r)
    t$subject <- "[[Responde|Responda]] hoy"
    camp <- list(template = t, sends = list(
      list(send_id = "invitacion", kind = "invitacion", label = "Invitación", audience = "todos"),
      list(send_id = "recordatorio-1", kind = "recordatorio", label = "R1", audience = "ambos", subject = "[[Responde|Responda]] hoy")))
    ef <- .cmail_template_for_send(t, camp$sends[[2]])
    chk <- .cmail_subject_repeat_check(camp, camp$sends[[2]], ef)
    expect_identical(chk$status, "warning", label = r)
  }
})

test_that("cada hermana conserva su saludo (vocativo y trato por sexo)", {
  px <- .cmh_proyecto(); on.exit(session_delete(px$sid), add = TRUE)
  g <- collection_mail_template_get(px$sid, campaign_id = "estudiantes-de-pregrado")
  t <- g$template
  i <- which(vapply(t$blocks, `[[`, "", "type") == "greeting")
  t$blocks[[i]]$text <- "Estimado(a) estudiante {{nombre}}:"
  p <- collection_mail_template_put(px$sid, t, px$rev, campaign_id = "estudiantes-de-pregrado")
  sim <- collection_mail_campaigns_apply_siblings(px$sid, p$state_revision, "profesores", list("estudiantes-de-pregrado"),
                                                  partes = list("cuerpo"), dry_run = TRUE)
  expect_true(isTRUE(sim$hermanas[[1]]$conserva$saludo))
  ok <- collection_mail_campaigns_apply_siblings(px$sid, p$state_revision, "profesores", list("estudiantes-de-pregrado"), partes = list("cuerpo"))
  ht <- collection_mail_template_get(px$sid, campaign_id = "estudiantes-de-pregrado")$template
  s <- Filter(function(b) identical(b$type, "greeting"), ht$blocks)[[1]]
  expect_identical(s$text, "Estimado(a) estudiante {{nombre}}:")
  # Lo demás sí viene del origen: el bloque «sorteo» está.
  expect_true("sorteo" %in% vapply(ht$blocks, `[[`, "", "block_id"))
})

test_that("si el origen no tiene saludo, la hermana conserva el suyo de verdad", {
  px <- .cmh_proyecto(); on.exit(session_delete(px$sid), add = TRUE)
  t <- collection_mail_template_get(px$sid, campaign_id = "profesores")$template
  t$blocks <- Filter(function(b) !identical(b$type, "greeting"), t$blocks)
  p <- collection_mail_template_put(px$sid, t, px$rev, campaign_id = "profesores")
  ok <- collection_mail_campaigns_apply_siblings(px$sid, p$state_revision, "profesores", list("estudiantes-de-pregrado"), partes = list("cuerpo"))
  expect_true(isTRUE(ok$hermanas[[1]]$conserva$saludo))
  ht <- collection_mail_template_get(px$sid, campaign_id = "estudiantes-de-pregrado")$template
  tipos <- vapply(ht$blocks, `[[`, "", "type")
  expect_identical(sum(tipos == "greeting"), 1L)
  expect_identical(tipos[[1]], "greeting")
})
