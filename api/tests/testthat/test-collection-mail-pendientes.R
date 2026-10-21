# placeholders_pending (collection_mail_pendientes.R): los textos de relleno
# entre corchetes de las plantillas de casa no se exportan sin completar.
# Hallazgo 2026-10-21: «Invitación a encuesta» pasaba la revisión con
# «[fecha límite]» en el cuerpo.

.cmpp_t <- function(preset = .cmail_preset_invitacion_encuesta) .cmail_template_normalize(preset())
.cmpp_check <- function(t) .cmail_placeholder_check(t)
.cmpp_targets <- function(ch) vapply(ch$targets, function(x) paste(x$block_id, x$prop %||% "", sep = "|"), "")
.cmpp_by <- function(r) setNames(r$checks, vapply(r$checks, `[[`, "", "code"))
.cmpp_paragraph <- function(text, id = "p") list(block_id = id, type = "paragraph", text = text)
.cmpp_min <- function(blocks, subject = "Asunto real", preheader = "Vista previa real") {
  list(subject = subject, preheader = preheader, header = list(kind = "logos", logo_ids = list()),
       images = list(), blocks = blocks)
}

test_that("invitacion_encuesta_v1: 8 textos de relleno (7 del cuerpo y la cabecera + el asunto), con sus frases y destinos", {
  ch <- .cmpp_check(.cmpp_t())
  expect_identical(ch$code, "placeholders_pending")
  expect_identical(ch$status, "error")
  expect_identical(ch$value, 8L)
  expect_identical(unlist(ch$items), c(
    "[Nombre del estudio]", "[unidad solicitante]", "[15]", "[Unidad solicitante]",
    "[proceso del estudio, por ejemplo: la acreditación de la carrera]", "[objetivo del estudio]",
    "[temas de la encuesta]", "[fecha límite]"
  ))
  expect_identical(ch$detail, "Quedan 8 textos entre corchetes por completar, como [Nombre del estudio].")
  # Una entrada por lugar donde aparece: asunto, preheader, alt del logo de la cabecera y tres párrafos.
  expect_identical(.cmpp_targets(ch), c("__sobre|subject", "__sobre|preheader", "__cabecera|",
                                        "contexto|text", "motivo|text", "plazo|text"))
})

test_that("las plantillas de casa también se marcan; items se corta en 10 pero value cuenta todas", {
  rec <- .cmpp_check(.cmpp_t(.cmail_preset_recuperacion))
  expect_identical(rec$status, "error")
  expect_identical(rec$value, 6L)
  expect_true("importante|items.1" %in% .cmpp_targets(rec))
  expect_true("[Incentivo, si lo hay: por ejemplo, un sorteo entre quienes completen la encuesta.]" %in% unlist(rec$items))

  cap <- .cmpp_check(.cmpp_t(.cmail_preset_invitacion))
  expect_identical(cap$status, "error")
  expect_identical(cap$value, 14L)
  expect_length(cap$items, 10L)
  expect_true(all(c("sesion-1|title", "sesion-2|items.0", "accion|note.0", "accion|note.1") %in% .cmpp_targets(cap)))
})

test_that("tras completar cada frase la revisión queda ok", {
  t <- .cmpp_t()
  for (ph in unlist(.cmpp_check(t)$items)) {
    t <- rapply(t, function(x) gsub(ph, "Facultad de Ciencias Sociales", x, fixed = TRUE), classes = "character", how = "replace")
  }
  ch <- .cmpp_check(t)
  expect_identical(ch$status, "ok")
  expect_identical(ch$value, 0L)
  expect_null(ch$targets)
  expect_null(ch$items)
})

test_that("no cuentan las etiquetas de SurveyMonkey, los enlaces [texto](url) ni corchetes sin letra o cifra", {
  t <- .cmpp_min(list(
    .cmpp_paragraph("Hola [FirstName] [LastName]: responde en [SurveyLink]. [PrivacyLink] [OptOutLink] [CustomData1] [CustomData12]", "tags"),
    .cmpp_paragraph("Lee [las bases del sorteo](https://pulso.pucp.edu.pe/bases) y [el **aviso**](https://ejemplo.org/a*b).", "enlace"),
    .cmpp_paragraph("Corchetes vacíos [] o con espacio [ ] o signos [-] no son relleno.", "vacios"),
    list(block_id = "firma", type = "signature", closing = "Saludos,", name = "PULSO PUCP",
         lines = list("Escríbenos en [la web](https://pulso.pucp.edu.pe/)"))
  ))
  ch <- .cmpp_check(t)
  expect_identical(ch$status, "ok", info = paste(unlist(ch$items), collapse = ", "))
  expect_identical(ch$value, 0L)

  # Un enlace y un relleno en el mismo texto: solo cuenta el relleno.
  t2 <- .cmpp_min(list(.cmpp_paragraph("Ver [la encuesta](https://ejemplo.org) antes del **[fecha límite]**.", "mix")))
  ch2 <- .cmpp_check(t2)
  expect_identical(ch2$value, 1L)
  expect_identical(unlist(ch2$items), "[fecha límite]")
  expect_identical(ch2$detail, "Queda 1 texto entre corchetes por completar: [fecha límite].")
  expect_identical(.cmpp_targets(ch2), "mix|text")
})

test_that("«[Describe la imagen]» lo cuenta images_alt, no placeholders_pending", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  t <- .cmail_fx_sin_relleno(.cmpp_t())
  t$images$`logo-cliente`$alt <- .CMAIL_ALT_MARKER
  expect_identical(.cmpp_check(t)$status, "ok")
  by <- .cmpp_by(collection_mail_review(sid, template = t))
  expect_identical(by$placeholders_pending$status, "ok")
  expect_identical(by$images_alt$status, "error")

  # Un alt de relleno distinto del marcador sí cuenta, con su destino.
  t$blocks <- append(t$blocks, list(list(block_id = "img-logo", type = "image", image_ref = "pulso",
                                         alt = "[Logo de la facultad]")), after = 2L)
  ch <- .cmpp_check(t)
  expect_identical(unlist(ch$items), "[Logo de la facultad]")
  expect_identical(.cmpp_targets(ch), "img-logo|alt")
})

test_that("cubre la apertura del envío, el aviso con sus items, el botón y la firma", {
  t <- .cmpp_min(list(
    list(block_id = "saludo", type = "greeting", text = "Estimado(a) {{nombre}}:", fallback = "Estimado(a) [público]:"),
    list(block_id = "titulo", type = "heading", text = "Resultados de [año]"),
    list(block_id = "aviso", type = "callout", variant = "box", title = "[Título del aviso]",
         items = list("Primer punto listo.", "[Segundo punto]")),
    list(block_id = "boton", type = "button", text = "[Texto del botón]", url = "https://ejemplo.org"),
    list(block_id = "firma", type = "signature", closing = "Saludos,", name = "[Nombre de quien firma]",
         lines = list("Cargo real", "[Cargo]"))
  ), subject = "Asunto sin relleno", preheader = "Hasta el [día]")
  t <- .cmail_template_for_send(t, list(opening = "Le recordamos que el plazo vence el [fecha]."))
  ch <- .cmpp_check(t)
  expect_identical(ch$value, 9L)
  expect_identical(.cmpp_targets(ch), c(
    "__sobre|preheader", "saludo|fallback", "__apertura|text", "titulo|text", "aviso|title", "aviso|items.1",
    "boton|text", "firma|name", "firma|lines.1"
  ))
})

test_that("revisión y export: el relleno bloquea en los dos dialectos y deja de bloquear al completarlo", {
  skip_if_not_installed("zip")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  c <- collection_mail_campaign_create(sid, collection_mail_campaigns_get(sid)$state_revision,
                                       name = "Acreditación", preset_id = "invitacion_encuesta_v1")
  id <- c$campaign$campaign_id
  r <- collection_mail_review(sid, campaign_id = id, scope = "plantilla")
  pp <- .cmpp_by(r)$placeholders_pending
  expect_identical(pp$status, "error")
  expect_identical(pp$value, 8L)
  expect_false(r$ready)
  e <- tryCatch(collection_mail_export(sid, collection_mail_campaigns_get(sid)$state_revision, id, scope = "plantilla"), api_error = function(e) e)
  expect_identical(e$code, "E_COLLECTION_MAIL_REVIEW_BLOCKING")
  expect_true("placeholders_pending" %in% vapply(e$details$checks, `[[`, "", "code"))

  s <- collection_mail_campaign_create(sid, collection_mail_campaigns_get(sid)$state_revision,
                                       name = "Acreditación SM", preset_id = "invitacion_encuesta_v1",
                                       platform = "surveymonkey")
  rs <- .cmpp_by(collection_mail_review(sid, campaign_id = s$campaign$campaign_id))
  expect_identical(rs$placeholders_pending$status, "error")
  expect_identical(rs$placeholders_pending$value, 8L)

  .cmail_fx_completar(sid, id)
  r2 <- collection_mail_review(sid, campaign_id = id, scope = "plantilla")
  expect_identical(.cmpp_by(r2)$placeholders_pending$status, "ok")
  expect_true(r2$ready, info = paste(vapply(Filter(function(x) x$status == "error", r2$checks), `[[`, "", "code"), collapse = ", "))
  ex <- collection_mail_export(sid, collection_mail_campaigns_get(sid)$state_revision, id, scope = "plantilla")
  expect_identical(ex$scope, "plantilla")
})

test_that("HTTP: la revisión publica placeholders_pending con items y targets", {
  testthat::skip_if_not_installed("plumber")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  collection_mail_campaign_create(sid, collection_mail_campaigns_get(sid)$state_revision,
                                  name = "Acreditación", preset_id = "invitacion_encuesta_v1")
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  rv <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-template/review",
                       .cmail_fx_json(list(campaign_id = "acreditacion", scope = "plantilla")))
  expect_identical(rv$status, 200L, info = substr(rv$raw, 1, 500))
  pp <- Filter(function(x) identical(x$code, "placeholders_pending"), rv$body$checks)[[1]]
  expect_identical(pp$status, "error")
  expect_identical(pp$value, 8L)
  expect_identical(pp$items[[8]], "[fecha límite]")
  expect_identical(pp$targets[[1]], list(block_id = "__sobre", prop = "subject"))
  expect_identical(pp$targets[[3]], list(block_id = "__cabecera"))
})
