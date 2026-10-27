# Datos fijos de la campaña (loop editor de correos, L6; collection_mail_constantes.R):
# contrato, reemplazo en la plantilla efectiva (cuerpo, asunto, apertura de un
# envío), que no viajen como etiqueta de plataforma y que duplicar los copie. Sin red.

.cmct_tpl <- function(constants = list(list(key = "premios", label = "Premios", value = "**una tablet Samsung**"),
                                       list(key = "duracion", label = "Duración", value = "10 minutos"))) {
  t <- .cmail_template_normalize(.cmail_preset_invitacion_encuesta())
  t$constants <- constants
  t$subject <- "Sorteo de {{premios}}"
  t$blocks <- append(t$blocks, list(list(block_id = "sorteo", type = "paragraph",
                                         text = "Participe en el sorteo de {{premios}}. Toma {{ duracion }}.")), after = 1L)
  .cmail_template_normalize(t)
}

.cmct_codes <- function(t) vapply(collection_mail_template_validate(t)$problems, `[[`, "", "code")

test_that("una plantilla con datos de la campaña valida y sus claves cuentan como declaradas", {
  t <- .cmct_tpl()
  v <- collection_mail_template_validate(t)
  expect_true(v$ok, info = paste(vapply(v$problems, `[[`, "", "detail"), collapse = "; "))
  expect_setequal(.cmail_declared_keys(t), c("enlace", "premios", "duracion"))
  # Sin declarar, la misma clave es un campo desconocido.
  sin <- .cmct_tpl(); sin$constants <- NULL
  expect_false(collection_mail_template_validate(sin)$ok)
})

test_that("la plantilla efectiva lleva los valores en el cuerpo, el asunto y la apertura de un recordatorio", {
  t <- .cmct_tpl()
  ef <- .cmail_template_for_send(t, NULL)
  expect_identical(ef$subject, "Sorteo de **una tablet Samsung**")
  b <- Filter(function(x) identical(x$block_id, "sorteo"), ef$blocks)[[1]]
  expect_identical(b$text, "Participe en el sorteo de **una tablet Samsung**. Toma 10 minutos.")
  rec <- list(send_id = "recordatorio-1", kind = "recordatorio", label = "R1", audience = "ambos",
              subject = "Recordatorio: {{premios}}", opening = "Aún puede ganar {{premios}}.")
  ef2 <- .cmail_template_for_send(t, rec)
  expect_identical(ef2$subject, "Recordatorio: **una tablet Samsung**")
  ap <- Filter(function(x) identical(x$block_id, .CMAIL_OPENING_ID), ef2$blocks)[[1]]
  expect_identical(ap$text, "Aún puede ganar **una tablet Samsung**.")
  expect_true(collection_mail_template_validate(ef2, allow_reserved_ids = TRUE)$ok)
})

test_that("en el HTML sale el valor, nunca una etiqueta de Mailchimp ni de SurveyMonkey", {
  ef <- .cmail_template_for_send(.cmct_tpl(), NULL)
  for (d in c("mailchimp", "surveymonkey")) {
    html <- collection_mail_render(ef, mode = "export", dialect = d)$html
    expect_match(html, "<strong>una tablet Samsung</strong>", fixed = TRUE, label = d)
    expect_false(grepl("PREMIOS", html, fixed = TRUE), label = d)
    expect_false(grepl("{{premios}}", html, fixed = TRUE), label = d)
  }
  expect_false("premios" %in% .cmail_used_keys(ef))
})

test_that("el contrato es cerrado: clave válida y única, nombre y valor obligatorios, sin campos ni enlaces en el valor", {
  mal <- function(...) .cmct_tpl(list(utils::modifyList(list(key = "premios", label = "Premios", value = "una tablet"), list(...))))
  expect_true("bad_key" %in% .cmct_codes(mal(key = "Premios")))
  expect_true("reserved_key" %in% .cmct_codes(mal(key = "nombre")))
  expect_true("duplicate_key" %in% .cmct_codes(mal(key = "enlace")))
  expect_true("bad_label" %in% .cmct_codes(mal(label = "")))
  expect_true("missing_value" %in% .cmct_codes(mal(value = " ")))
  expect_true("too_long" %in% .cmct_codes(mal(value = strrep("x", 301))))
  # Un valor no puede pedir otro valor: el campo dentro del valor es desconocido ahí.
  dentro <- collection_mail_template_validate(mal(value = "{{enlace}}"))$problems
  expect_true(any(vapply(dentro, function(p) identical(p$path, "template.constants[1].value") && identical(p$code, "unknown_field"), logical(1))))
  expect_true("unknown_key" %in% .cmct_codes(mal(color = "rojo")))
  dos <- .cmct_tpl(list(list(key = "a", label = "A", value = "1"), list(key = "a", label = "B", value = "2")))
  expect_true("duplicate_key" %in% .cmct_codes(dos))
})

test_that("duplicar la campaña copia los datos; cambiarlos en la copia no toca la original", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  rev <- as.integer(session_get(sid)$collection_state$state_revision %||% 0L)
  a <- collection_mail_campaign_create(sid, rev, name = "Profesores", template = .cmct_tpl())
  d <- collection_mail_campaign_duplicate(sid, a$state_revision, a$campaign$campaign_id, name = "Administrativos")
  expect_identical(d$campaign$template$constants[[1]]$value, "**una tablet Samsung**")
  t <- d$campaign$template; t$constants[[2]]$value <- "5 minutos"
  put <- collection_mail_template_put(sid, t, d$state_revision, campaign_id = d$campaign$campaign_id)
  orig <- collection_mail_template_get(sid, campaign_id = a$campaign$campaign_id)$template
  expect_identical(orig$constants[[2]]$value, "10 minutos")
  expect_true(isTRUE(put$ok))
  expect_identical(collection_mail_template_get(sid, campaign_id = d$campaign$campaign_id)$template$constants[[2]]$value, "5 minutos")
})
