# Dirección propia en el pie (Acreditación 2026): Mailchimp arma `*|LIST:ADDRESSLINE|*`
# con «·» y «Peru»; con `footer_legal.address` escrita, esa va sola y la de la lista no. Sin red.

.cmpd_tpl <- function(address = NULL) {
  t <- .cmail_template_normalize(.cmail_preset_invitacion_encuesta())
  i <- which(vapply(t$blocks, function(b) identical(b$type, "footer_legal"), NA))
  t$blocks[[i]]$address <- address
  .cmail_template_normalize(t)
}

test_that("con dirección propia el pie lleva esa sola y la baja; sin ella, la de la lista", {
  dir <- "PULSO PUCP, Av. Universitaria 1801, San Miguel, Lima 15088, Perú"
  html <- collection_mail_render(.cmpd_tpl(dir), mode = "export", dialect = "mailchimp")$html
  expect_match(html, dir, fixed = TRUE)
  expect_false(grepl("*|LIST:ADDRESSLINE|*", html, fixed = TRUE))
  expect_match(html, "*|UNSUB|*", fixed = TRUE)
  base <- collection_mail_render(.cmpd_tpl(), mode = "export", dialect = "mailchimp")$html
  expect_match(base, "*|LIST:ADDRESSLINE|*", fixed = TRUE)
})

test_that("la revisión acepta la dirección del pie en lugar de la etiqueta de la lista", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  rev <- as.integer(session_get(sid)$collection_state$state_revision %||% 0L)
  a <- collection_mail_campaign_create(sid, rev, name = "Pie", template = .cmpd_tpl("Av. Universitaria 1801, Lima, Perú"))
  r <- collection_mail_review(sid, campaign_id = a$campaign$campaign_id, scope = "plantilla")
  pie <- Filter(function(c) identical(c$code, "footer_unsub"), r$checks)[[1]]
  expect_identical(pie$status, "ok")
  expect_match(pie$detail, "dirección escrita en el pie", fixed = TRUE)
})
