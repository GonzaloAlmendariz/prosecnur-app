# Campañas de correo (ADR 0110, E1h): varias plantillas por proyecto, la
# migración en lectura desde `mail_template`, destinatarios por campaña y la
# compatibilidad de los `mail-*` sin campaign_id. Fixtures sintéticos.

.cmc_err <- function(expr) tryCatch({ force(expr); NULL }, api_error = function(e) e)
.cmc_code <- function(expr) { e <- .cmc_err(expr); if (is.null(e)) NA_character_ else e$code }

# Estado de antes de E1h: una plantilla singular en collection_state$mail_template.
.cmc_legacy_session <- function(title = "Recuperación de estudiantes", logos = TRUE) {
  sid <- .cmail_fx_session(logos = logos)
  s <- session_get(sid)
  tpl <- .cmail_template_normalize(.cmail_preset_recuperacion(), revision = 3L)
  tpl$title <- title
  tpl <- .cmail_template_normalize(tpl)
  s$collection_state <- .collection_empty_state(7L)
  s$collection_state$mail_template <- tpl
  .session_env[[sid]] <- s
  sid
}

.cmc_rev <- function(sid) as.integer(session_get(sid)$collection_state$state_revision %||% 0L)

.cmc_two <- function(logos = TRUE) {
  sid <- .cmail_fx_session(logos = logos)
  a <- collection_mail_campaign_create(sid, .cmc_rev(sid), name = "Recuperación estudiantes", actor = "Estudiantes")
  b <- collection_mail_campaign_create(sid, a$state_revision, name = "Invitación docentes", actor = "Docentes",
                                       preset_id = "invitacion_capacitacion_v1")
  list(sid = sid, a = a$campaign, b = b$campaign)
}

# Store de destinatarios armado como lo dejaba la versión de una sola plantilla.
.cmc_write_legacy_recipients <- function(sid) {
  tmp <- session_create(); on.exit(session_delete(tmp), add = TRUE)
  .cmail_fx_import(tmp)
  store <- .cmail_recipients_load(session_get(tmp), "correo-1")
  root <- .cmail_recipients_root(session_get(sid))
  dir.create(root, recursive = TRUE, showWarnings = FALSE)
  saveRDS(store, file.path(root, "recipients.rds"))
  file.path(root, "recipients.rds")
}

test_that("migración en lectura: mail_template se lee como una campaña y no escribe nada", {
  sid <- .cmc_legacy_session(); on.exit(session_delete(sid), add = TRUE)
  before <- session_get(sid)$collection_state

  l <- collection_mail_campaigns_get(sid)
  expect_true(l$legacy_migrated)
  expect_identical(l$state_revision, 7L)
  expect_length(l$campaigns, 1L)
  c1 <- l$campaigns[[1]]
  expect_identical(c1$campaign_id, "recuperacion-de-estudiantes")
  expect_identical(c1$name, "Recuperación de estudiantes")
  expect_identical(c1$template_revision, 3L)
  expect_identical(c1$blocks, length(before$mail_template$blocks))
  expect_false(c1$recipients_loaded)
  expect_null(c1$template)

  g <- collection_mail_template_get(sid)
  expect_identical(g$campaign_id, "recuperacion-de-estudiantes")
  expect_identical(g$template$template_id, "recuperacion-de-estudiantes")
  expect_false(g$builtin)
  expect_identical(session_get(sid)$collection_state, before)

  # Sin título: correo-1 y nombre «Correo».
  sid2 <- .cmc_legacy_session(); on.exit(session_delete(sid2), add = TRUE)
  s <- session_get(sid2); s$collection_state$mail_template$title <- NULL; .session_env[[sid2]] <- s
  l2 <- collection_mail_campaigns_get(sid2)
  expect_identical(l2$campaigns[[1]]$campaign_id, "correo-1")
  expect_identical(l2$campaigns[[1]]$name, "Correo")
})

test_that("migración: la primera escritura persiste mail_campaigns y borra mail_template", {
  sid <- .cmc_legacy_session(); on.exit(session_delete(sid), add = TRUE)
  g <- collection_mail_template_get(sid)
  # Un PUT sin cambios no es escritura: sigue sin migrar.
  same <- collection_mail_template_put(sid, g$template, g$state_revision)
  expect_true(same$noop)
  expect_false(is.null(session_get(sid)$collection_state$mail_template))

  t <- g$template; t$subject <- "Otro asunto"
  put <- collection_mail_template_put(sid, t, g$state_revision)
  expect_false(put$noop)
  expect_identical(put$state_revision, 8L)
  expect_identical(put$template$revision, 4L)
  st <- session_get(sid)$collection_state
  expect_null(st$mail_template)
  expect_identical(st$mail_campaigns$schema, "collection_mail_campaigns/v1")
  expect_identical(st$mail_campaigns$campaigns[[1]]$campaign_id, "recuperacion-de-estudiantes")
  expect_match(st$mail_campaigns$campaigns[[1]]$created_at, "^\\d{4}-\\d{2}-\\d{2}T")
  expect_false(collection_mail_campaigns_get(sid)$legacy_migrated)
})

test_that("migración con recipients.rds antiguo en la raíz: se mueve a la carpeta de la campaña", {
  sid <- .cmc_legacy_session(); on.exit(session_delete(sid), add = TRUE)
  legacy <- .cmc_write_legacy_recipients(sid)
  expect_true(file.exists(legacy))

  l <- collection_mail_campaigns_get(sid)
  expect_true(l$campaigns[[1]]$recipients_loaded)
  expect_false(file.exists(legacy))
  target <- .cmail_recipients_path(session_get(sid), "recuperacion-de-estudiantes")
  expect_true(file.exists(target))
  r <- collection_mail_recipients_get(sid)
  expect_true(r$loaded)
  expect_identical(r$campaign_id, "recuperacion-de-estudiantes")
  expect_identical(r$counts$valid, 3L)

  # Y también al entrar por otro endpoint (preview), sin pasar por la lista.
  sid2 <- .cmc_legacy_session(); on.exit(session_delete(sid2), add = TRUE)
  legacy2 <- .cmc_write_legacy_recipients(sid2)
  pv <- collection_mail_preview(sid2, "preview", recipient_index = 1L)
  expect_identical(pv$recipient$source, "imported")
  expect_false(file.exists(legacy2))
})

test_that("compatibilidad sin campaign_id: cero campañas sirve la de fábrica y el PUT crea correo-1", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  l <- collection_mail_campaigns_get(sid)
  expect_length(l$campaigns, 0L)
  expect_false(l$legacy_migrated)
  g <- collection_mail_template_get(sid)
  expect_true(g$builtin)
  expect_identical(g$campaign_id, "correo-1")
  expect_identical(g$template$preset_id, "recuperacion_estudiantes_v1")
  # Importar antes de guardar: queda en la carpeta de correo-1.
  imp <- .cmail_fx_import(sid)
  expect_identical(imp$campaign_id, "correo-1")
  put <- collection_mail_template_put(sid, g$template, g$state_revision)
  expect_false(put$noop)
  expect_identical(put$campaign_id, "correo-1")
  expect_identical(put$template$revision, 1L)
  l <- collection_mail_campaigns_get(sid)
  expect_identical(vapply(l$campaigns, `[[`, "", "campaign_id"), "correo-1")
  expect_true(l$campaigns[[1]]$recipients_loaded)
  expect_false(collection_mail_template_get(sid)$builtin)
})

test_that("compatibilidad: con una campaña se usa esa; con dos o más se exige campaign_id", {
  fx <- .cmc_two(); on.exit(session_delete(fx$sid), add = TRUE)
  sid <- fx$sid
  for (code in list(
    .cmc_code(collection_mail_template_get(sid)),
    .cmc_code(collection_mail_template_put(sid, fx$a$template, .cmc_rev(sid))),
    .cmc_code(collection_mail_preview(sid)),
    .cmc_code(collection_mail_review(sid, template = fx$a$template)),
    .cmc_code(collection_mail_export(sid, .cmc_rev(sid))),
    .cmc_code(.cmail_fx_import(sid)),
    .cmc_code(collection_mail_recipients_get(sid)),
    .cmc_code(collection_mail_recipients_delete(sid))
  )) expect_identical(code, "E_COLLECTION_MAIL_CAMPAIGN_REQUIRED")
  e <- .cmc_err(collection_mail_template_get(sid))
  expect_equal(e$status, 422)

  gb <- collection_mail_template_get(sid, campaign_id = fx$b$campaign_id)
  expect_identical(gb$template$preset_id, "invitacion_capacitacion_v1")
  expect_identical(gb$template$template_id, "invitacion-docentes")
  nf <- .cmc_err(collection_mail_template_get(sid, campaign_id = "no-existe"))
  expect_identical(nf$code, "E_COLLECTION_MAIL_CAMPAIGN_NOT_FOUND")
  expect_equal(nf$status, 404)
  expect_identical(.cmc_code(collection_mail_template_get(sid, campaign_id = "../x")), "E_COLLECTION_MAIL_CAMPAIGN_NOT_FOUND")

  # Destinatarios separados por campaña.
  collection_mail_recipients_import(sid, file_name = "d.csv", campaign_id = fx$a$campaign_id,
    content_base64 = jsonlite::base64_enc(charToRaw(enc2utf8(.cmail_fx_recipients_csv()))))
  expect_true(collection_mail_recipients_get(sid, campaign_id = fx$a$campaign_id)$loaded)
  expect_false(collection_mail_recipients_get(sid, campaign_id = fx$b$campaign_id)$loaded)
  pa <- collection_mail_preview(sid, "preview", recipient_index = 1L, campaign_id = fx$a$campaign_id)
  expect_identical(pa$campaign_id, fx$a$campaign_id)
  expect_identical(pa$recipient$source, "imported")
  rb <- collection_mail_review(sid, campaign_id = fx$b$campaign_id)
  expect_identical(rb$campaign_id, fx$b$campaign_id)
  expect_false(rb$ready)

  # Con una sola (tras borrar la otra), vuelve a bastar sin campaign_id.
  collection_mail_campaign_delete(sid, .cmc_rev(sid), fx$b$campaign_id, confirm_name = fx$b$name)
  expect_identical(collection_mail_template_get(sid)$campaign_id, fx$a$campaign_id)
})

test_that("crear: id desde el nombre y único, preset, template_id := campaign_id, revisión global", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  a <- collection_mail_campaign_create(sid, 0L, name = "Invitación docentes", actor = "Docentes",
                                       preset_id = "invitacion_capacitacion_v1")
  expect_true(a$ok)
  expect_identical(a$state_revision, 1L)
  expect_identical(a$campaign$campaign_id, "invitacion-docentes")
  expect_identical(a$campaign$actor, "Docentes")
  expect_identical(a$campaign$template$template_id, "invitacion-docentes")
  expect_identical(a$campaign$template$preset_id, "invitacion_capacitacion_v1")
  expect_identical(a$campaign$template$revision, 1L)
  expect_true(isTRUE(collection_mail_template_validate(a$campaign$template)$ok))
  b <- collection_mail_campaign_create(sid, a$state_revision, name = "Invitación  docentes!")
  expect_identical(b$campaign$campaign_id, "invitacion-docentes-2")
  expect_identical(b$campaign$actor, "")
  # Sin preset: la de fábrica de recuperación.
  expect_identical(b$campaign$template$preset_id, "recuperacion_estudiantes_v1")
  expect_identical(.cmc_code(collection_mail_campaign_create(sid, 0L, name = "X")), "E_COLLECTION_STATE_STALE")
  expect_identical(.cmc_code(collection_mail_campaign_create(sid, NULL, name = "X")), "E_COLLECTION_EXPECTED_REVISION")
  expect_identical(.cmc_code(collection_mail_campaign_create(sid, b$state_revision, name = "X", preset_id = "otro")),
                   "E_COLLECTION_MAIL_TEMPLATE_INVALID")
  expect_identical(.cmc_code(collection_mail_campaign_create(sid, b$state_revision, name = "")), "E_COLLECTION_MAIL_CAMPAIGN_NAME")
  expect_identical(.cmc_code(collection_mail_campaign_create(sid, b$state_revision, name = strrep("a", 81))),
                   "E_COLLECTION_MAIL_CAMPAIGN_NAME")
  expect_identical(.cmc_code(collection_mail_campaign_create(sid, b$state_revision, name = "A", actor = strrep("a", 61))),
                   "E_COLLECTION_MAIL_CAMPAIGN_NAME")
  # Un nombre sin letras ASCII igual tiene id.
  c3 <- collection_mail_campaign_create(sid, b$state_revision, name = "¿¡…!?")
  expect_true(.cmail_campaign_id_ok(c3$campaign$campaign_id))
})

test_that("name o actor con forma de correo -> 422 sin citar el valor", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  e <- .cmc_err(collection_mail_campaign_create(sid, 0L, name = "Para ana.quispe@ejemplo.org"))
  expect_identical(e$code, "E_COLLECTION_MAIL_CAMPAIGN_NAME")
  expect_equal(e$status, 422)
  expect_false(grepl("ejemplo", conditionMessage(e), fixed = TRUE))
  expect_identical(.cmc_code(collection_mail_campaign_create(sid, 0L, name = "Ok", actor = "x@y.org")),
                   "E_COLLECTION_MAIL_CAMPAIGN_NAME")
  a <- collection_mail_campaign_create(sid, 0L, name = "Ok")
  expect_identical(.cmc_code(collection_mail_campaign_meta_put(sid, a$state_revision, a$campaign$campaign_id,
                                                                name = "luz@ejemplo.org")),
                   "E_COLLECTION_MAIL_CAMPAIGN_NAME")
  expect_identical(.cmc_code(collection_mail_campaign_duplicate(sid, a$state_revision, a$campaign$campaign_id,
                                                                 actor = "luz@ejemplo.org")),
                   "E_COLLECTION_MAIL_CAMPAIGN_NAME")
  expect_false(grepl("@", jsonlite::toJSON(session_get(sid)$collection_state, auto_unbox = TRUE), fixed = TRUE))
})

test_that("duplicar copia la plantilla y NO los destinatarios ni el mapeo", {
  fx <- .cmc_two(); on.exit(session_delete(fx$sid), add = TRUE)
  sid <- fx$sid
  collection_mail_recipients_import(sid, file_name = "d.csv", campaign_id = fx$b$campaign_id,
    content_base64 = jsonlite::base64_enc(charToRaw(enc2utf8(.cmail_fx_recipients_csv()))))
  t <- fx$b$template; t$subject <- "Asunto propio"
  put <- collection_mail_template_put(sid, t, .cmc_rev(sid), campaign_id = fx$b$campaign_id)
  d <- collection_mail_campaign_duplicate(sid, put$state_revision, fx$b$campaign_id)
  expect_false(d$recipients_copied)
  expect_identical(d$state_revision, put$state_revision + 1L)
  expect_identical(d$campaign$name, "Invitación docentes (copia)")
  expect_identical(d$campaign$actor, "Docentes")
  expect_identical(d$campaign$duplicated_from, fx$b$campaign_id)
  expect_identical(d$campaign$campaign_id, "invitacion-docentes-copia")
  expect_identical(d$campaign$template$subject, "Asunto propio")
  expect_identical(d$campaign$template$template_id, d$campaign$campaign_id)
  expect_identical(d$campaign$template$revision, 1L)
  expect_false(collection_mail_recipients_get(sid, campaign_id = d$campaign$campaign_id)$loaded)
  expect_false(dir.exists(.cmail_recipients_dir(session_get(sid), d$campaign$campaign_id)))
  expect_true(collection_mail_recipients_get(sid, campaign_id = fx$b$campaign_id)$loaded)

  d2 <- collection_mail_campaign_duplicate(sid, d$state_revision, fx$b$campaign_id,
                                          name = "Recordatorio directores", actor = "Directores")
  expect_identical(d2$campaign$campaign_id, "recordatorio-directores")
  expect_identical(d2$campaign$actor, "Directores")
  expect_identical(.cmc_code(collection_mail_campaign_duplicate(sid, d2$state_revision, NULL)),
                   "E_COLLECTION_MAIL_CAMPAIGN_REQUIRED")
  expect_identical(.cmc_code(collection_mail_campaign_duplicate(sid, d2$state_revision, "nada")),
                   "E_COLLECTION_MAIL_CAMPAIGN_NOT_FOUND")
})

test_that("renombrar sube solo state_revision: id, plantilla y su revisión no cambian", {
  fx <- .cmc_two(); on.exit(session_delete(fx$sid), add = TRUE)
  sid <- fx$sid
  rev <- .cmc_rev(sid)
  m <- collection_mail_campaign_meta_put(sid, rev, fx$a$campaign_id, name = "Recuperación 2026-2", actor = "Ingresantes")
  expect_false(m$noop)
  expect_identical(m$state_revision, rev + 1L)
  expect_identical(m$campaign$campaign_id, fx$a$campaign_id)
  expect_identical(m$campaign$name, "Recuperación 2026-2")
  expect_null(m$campaign$template)
  g <- collection_mail_template_get(sid, campaign_id = fx$a$campaign_id)
  expect_identical(g$template$revision, fx$a$template$revision)
  expect_identical(g$template$template_sha256, fx$a$template$template_sha256)
  same <- collection_mail_campaign_meta_put(sid, m$state_revision, fx$a$campaign_id, name = "Recuperación 2026-2")
  expect_true(same$noop)
  expect_identical(same$state_revision, m$state_revision)
  expect_identical(.cmc_code(collection_mail_campaign_meta_put(sid, rev, fx$a$campaign_id, name = "Z")),
                   "E_COLLECTION_STATE_STALE")
})

test_that("borrar exige confirm_name idéntico y purga la carpeta de destinatarios", {
  fx <- .cmc_two(); on.exit(session_delete(fx$sid), add = TRUE)
  sid <- fx$sid
  collection_mail_recipients_import(sid, file_name = "d.csv", campaign_id = fx$b$campaign_id,
    content_base64 = jsonlite::base64_enc(charToRaw(enc2utf8(.cmail_fx_recipients_csv()))))
  folder <- .cmail_recipients_dir(session_get(sid), fx$b$campaign_id)
  expect_true(dir.exists(folder))
  rev <- .cmc_rev(sid)
  for (bad in list(NULL, "invitación docentes", "Invitación docentes ")) {
    e <- .cmc_err(collection_mail_campaign_delete(sid, rev, fx$b$campaign_id, confirm_name = bad))
    expect_identical(e$code, "E_COLLECTION_MAIL_CAMPAIGN_CONFIRM")
    expect_equal(e$status, 422)
  }
  expect_true(dir.exists(folder))
  expect_identical(.cmc_rev(sid), rev)
  d <- collection_mail_campaign_delete(sid, rev, fx$b$campaign_id, confirm_name = "Invitación docentes")
  expect_identical(d$deleted, fx$b$campaign_id)
  expect_true(d$recipients_purged)
  expect_identical(d$state_revision, rev + 1L)
  expect_false(dir.exists(folder))
  expect_identical(vapply(collection_mail_campaigns_get(sid)$campaigns, `[[`, "", "campaign_id"), fx$a$campaign_id)
  expect_identical(.cmc_code(collection_mail_campaign_delete(sid, d$state_revision, fx$b$campaign_id,
                                                              confirm_name = "Invitación docentes")),
                   "E_COLLECTION_MAIL_CAMPAIGN_NOT_FOUND")

  # Borrar la última deja la lista vacía (no vuelve a migrar nada).
  d2 <- collection_mail_campaign_delete(sid, d$state_revision, fx$a$campaign_id, confirm_name = fx$a$name)
  st <- session_get(sid)$collection_state
  expect_length(st$mail_campaigns$campaigns, 0L)
  expect_null(st$mail_template)
  expect_true(collection_mail_template_get(sid)$builtin)
})

test_that("borrar la campaña migrada borra también el recipients.rds de la raíz", {
  sid <- .cmc_legacy_session(); on.exit(session_delete(sid), add = TRUE)
  legacy <- .cmc_write_legacy_recipients(sid)
  d <- collection_mail_campaign_delete(sid, 7L, "recuperacion-de-estudiantes", confirm_name = "Recuperación de estudiantes")
  expect_true(d$recipients_purged)
  expect_false(file.exists(legacy))
  expect_length(list.files(.cmail_recipients_root(session_get(sid)), recursive = TRUE), 0L)
})

test_that("límite de 20 campañas: crear y duplicar dan 409", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  rev <- 0L
  for (i in seq_len(20L)) rev <- collection_mail_campaign_create(sid, rev, name = sprintf("Campaña %d", i))$state_revision
  e <- .cmc_err(collection_mail_campaign_create(sid, rev, name = "Una más"))
  expect_identical(e$code, "E_COLLECTION_MAIL_CAMPAIGN_LIMIT")
  expect_equal(e$status, 409)
  expect_identical(.cmc_code(collection_mail_campaign_duplicate(sid, rev, "campana-1")), "E_COLLECTION_MAIL_CAMPAIGN_LIMIT")
  expect_length(collection_mail_campaigns_get(sid)$campaigns, 20L)
})

test_that("vista previa y revisión con plantilla en el cuerpo no validan el estado entero", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  a <- collection_mail_campaign_create(sid, 0L, name = "Uno")
  s <- session_get(sid)
  s$collection_state$schema <- "collection_state/v0-roto"
  .session_env[[sid]] <- s
  expect_identical(.cmc_code(collection_mail_preview(sid)), "E_COLLECTION_STATE_INVALID")
  pv <- collection_mail_preview(sid, template = a$campaign$template)
  expect_true(pv$ok)
  expect_identical(pv$campaign_id, "uno")
  rv <- collection_mail_review(sid, template = a$campaign$template)
  expect_true(rv$ok)
  # La huella del borrador es la de la campaña guardada (template_id forzado).
  draft <- a$campaign$template; draft$template_id <- "otro-id"
  expect_identical(collection_mail_review(sid, template = draft)$template_sha256, a$campaign$template$template_sha256)
  # Escribir sí valida.
  expect_identical(.cmc_code(collection_mail_campaign_create(sid, 1L, name = "Dos")), "E_COLLECTION_STATE_INVALID")
})

test_that("export por campaña: slug = campaign_id y manifest con campaign sin datos personales", {
  skip_if_not_installed("zip")
  fx <- .cmc_two(); on.exit(session_delete(fx$sid), add = TRUE)
  sid <- fx$sid
  collection_mail_recipients_import(sid, file_name = "d.csv", campaign_id = fx$b$campaign_id,
    content_base64 = jsonlite::base64_enc(charToRaw(enc2utf8(.cmail_fx_recipients_csv()))))
  ex <- collection_mail_export(sid, .cmc_rev(sid), campaign_id = fx$b$campaign_id)
  expect_identical(ex$campaign_id, fx$b$campaign_id)
  expect_match(ex$zip$filename, "^invitacion-docentes_mailchimp_\\d{8}-\\d{6}\\.zip$")
  expect_identical(ex$manifest$campaign, list(campaign_id = "invitacion-docentes", name = "Invitación docentes",
                                              actor = "Docentes"))
  expect_identical(ex$manifest$template$template_id, "invitacion-docentes")
  expect_identical(vapply(ex$artifacts, `[[`, "", "role"), c("deliverable", "manifest"))
  expect_false(grepl("@", jsonlite::toJSON(ex$manifest, auto_unbox = TRUE), fixed = TRUE))
  # La otra campaña no tiene destinatarios: su revisión bloquea.
  expect_identical(.cmc_code(collection_mail_export(sid, .cmc_rev(sid), campaign_id = fx$a$campaign_id)),
                   "E_COLLECTION_MAIL_REVIEW_BLOCKING")
})

test_that("el .pulso con dos campañas no contiene correos; las campañas viajan y los destinatarios no", {
  skip_if_not_installed("zip")
  fx <- .cmc_two(); on.exit(session_delete(fx$sid), add = TRUE)
  sid <- fx$sid
  for (id in c(fx$a$campaign_id, fx$b$campaign_id)) {
    collection_mail_recipients_import(sid, file_name = "d.csv", campaign_id = id,
      content_base64 = jsonlite::base64_enc(charToRaw(enc2utf8(.cmail_fx_recipients_csv()))))
    collection_mail_preview(sid, "preview", recipient_index = 1L, campaign_id = id)
  }
  collection_mail_export(sid, .cmc_rev(sid), campaign_id = fx$b$campaign_id)
  state_json <- jsonlite::toJSON(session_get(sid)$collection_state, auto_unbox = TRUE, null = "null")
  expect_false(grepl("@ejemplo.org|QUISPE|Quispe|Ana Lucia", state_json))
  expect_length(session_get(sid)$collection_state$mail_campaigns$campaigns, 2L)

  tmp <- tempfile(fileext = ".pulso"); on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(sid, tmp, project_name = "Dos campañas")
  ex <- tempfile("pulso-scan-"); on.exit(unlink(ex, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(tmp, exdir = ex)
  hits <- character(0)
  for (f in list.files(ex, recursive = TRUE, full.names = TRUE)) {
    txt <- if (grepl("\\.rds$", f)) {
      paste(utils::capture.output(str(readRDS(f), list.len = 1e5, nchar.max = 1e5)), collapse = "\n")
    } else {
      b <- readBin(f, "raw", file.info(f)$size); rawToChar(b[b != as.raw(0)])
    }
    if (grepl("ejemplo.org|QUISPE MAMANI|ana.quispe|recipients", txt, useBytes = TRUE)) hits <- c(hits, basename(f))
  }
  expect_length(hits, 0L)
  # Ni carpetas de destinatarios dentro del zip.
  expect_false(any(grepl("mail_recipients", list.files(ex, recursive = TRUE, include.dirs = TRUE))))

  loaded <- load_pulso(tmp); on.exit(session_delete(loaded$session_id), add = TRUE)
  l <- collection_mail_campaigns_get(loaded$session_id)
  expect_identical(vapply(l$campaigns, `[[`, "", "campaign_id"), c(fx$a$campaign_id, fx$b$campaign_id))
  expect_false(any(vapply(l$campaigns, `[[`, NA, "recipients_loaded")))
})

test_that("HTTP: campañas con el serializador de producción, campaign_id por consulta y por multipart", {
  testthat::skip_if_not_installed("plumber")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  call_q <- function(method, path, query) {
    req <- as.environment(list(
      REQUEST_METHOD = method, PATH_INFO = path, QUERY_STRING = query, CONTENT_TYPE = "application/json",
      HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid),
      rook.input = list(read = function(...) raw(0), rewind = function() invisible(0), read_lines = function(...) "")
    ))
    r <- pr$call(req)
    list(status = as.integer(r$status), raw = as.character(r$body),
         body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
  }

  l0 <- .cmail_fx_call(pr, sid, "GET", "/api/recopiladores/mail-campaigns")
  expect_identical(l0$status, 200L)
  expect_match(l0$raw, '"campaigns":[]', fixed = TRUE)
  c1 <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-campaigns",
                       .cmail_fx_json(list(expected_revision = 0L, name = "Invitación docentes", actor = "Docentes",
                                           preset_id = "invitacion_capacitacion_v1")))
  expect_identical(c1$status, 200L, info = substr(c1$raw, 1, 600))
  expect_identical(c1$body$campaign$campaign_id, "invitacion-docentes")
  expect_identical(c1$body$campaign$template$template_id, "invitacion-docentes")
  d <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-campaigns/duplicate",
                      .cmail_fx_json(list(expected_revision = 1L, campaign_id = "invitacion-docentes",
                                          name = "Recordatorio directores", actor = "Directores")))
  expect_identical(d$status, 200L, info = substr(d$raw, 1, 600))
  expect_false(isTRUE(d$body$recipients_copied))
  expect_identical(d$body$state_revision, 2L)

  req2 <- .cmail_fx_call(pr, sid, "GET", "/api/recopiladores/mail-template")
  expect_identical(req2$status, 422L)
  expect_identical(req2$body$error$code, "E_COLLECTION_MAIL_CAMPAIGN_REQUIRED")
  g <- call_q("GET", "/api/recopiladores/mail-template", "campaign_id=recordatorio-directores")
  expect_identical(g$status, 200L, info = substr(g$raw, 1, 600))
  expect_identical(g$body$campaign_id, "recordatorio-directores")
  # El JSON de la plantilla vuelve tal cual en el PUT (noop).
  put <- .cmail_fx_call(pr, sid, "PUT", "/api/recopiladores/mail-template",
                        .cmail_fx_json(list(template = g$body$template, expected_revision = 2L,
                                            campaign_id = "recordatorio-directores")))
  expect_identical(put$status, 200L, info = substr(put$raw, 1, 600))
  expect_true(isTRUE(put$body$noop))

  bnd <- "cmcBoundary"
  body <- c(
    charToRaw(paste0("--", bnd, "\r\nContent-Disposition: form-data; name=\"campaign_id\"\r\n\r\nrecordatorio-directores\r\n")),
    .cmail_fx_multipart(bnd, charToRaw(enc2utf8(.cmail_fx_recipients_csv())), "d.csv", "text/csv")
  )
  imp <- .cmail_fx_call_raw(pr, sid, "POST", "/api/recopiladores/mail-recipients/import", body,
                            paste0("multipart/form-data; boundary=", bnd))
  expect_identical(imp$status, 200L, info = substr(imp$raw, 1, 600))
  expect_identical(imp$body$campaign_id, "recordatorio-directores")
  r1 <- call_q("GET", "/api/recopiladores/mail-recipients", "campaign_id=recordatorio-directores")
  expect_true(isTRUE(r1$body$loaded))
  r2 <- call_q("GET", "/api/recopiladores/mail-recipients", "campaign_id=invitacion-docentes")
  expect_false(isTRUE(r2$body$loaded))

  l <- .cmail_fx_call(pr, sid, "GET", "/api/recopiladores/mail-campaigns")
  expect_identical(vapply(l$body$campaigns, function(c) isTRUE(c$recipients_loaded), NA), c(FALSE, TRUE))
  expect_true(all(c("campaign_id", "name", "actor", "preset_id", "subject", "blocks", "template_revision",
                    "template_sha256", "updated_at", "recipients_loaded") %in% names(l$body$campaigns[[1]])))
  expect_false(grepl("@", l$raw, fixed = TRUE))

  m <- .cmail_fx_call(pr, sid, "PUT", "/api/recopiladores/mail-campaigns/meta",
                      .cmail_fx_json(list(expected_revision = 2L, campaign_id = "invitacion-docentes", name = "Docentes 2026")))
  expect_identical(m$status, 200L, info = substr(m$raw, 1, 600))
  expect_null(m$body$campaign$template)
  bad <- .cmail_fx_call(pr, sid, "PUT", "/api/recopiladores/mail-campaigns/meta",
                        .cmail_fx_json(list(expected_revision = 3L, campaign_id = "invitacion-docentes", name = "a@b.org")))
  expect_identical(bad$status, 422L)
  expect_identical(bad$body$error$code, "E_COLLECTION_MAIL_CAMPAIGN_NAME")
  del_bad <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-campaigns/delete",
                            .cmail_fx_json(list(expected_revision = 3L, campaign_id = "recordatorio-directores",
                                                confirm_name = "otro")))
  expect_identical(del_bad$status, 422L)
  del <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-campaigns/delete",
                        .cmail_fx_json(list(expected_revision = 3L, campaign_id = "recordatorio-directores",
                                            confirm_name = "Recordatorio directores")))
  expect_identical(del$status, 200L, info = substr(del$raw, 1, 600))
  expect_true(isTRUE(del$body$recipients_purged))
  expect_identical(del$body$deleted, "recordatorio-directores")
  dr <- call_q("DELETE", "/api/recopiladores/mail-recipients", "campaign_id=invitacion-docentes")
  expect_identical(dr$status, 200L)
  expect_identical(dr$body$campaign_id, "invitacion-docentes")
})

test_that("modo público: las rutas de campañas quedan bloqueadas", {
  routes <- c("GET /api/recopiladores/mail-campaigns", "POST /api/recopiladores/mail-campaigns",
              "POST /api/recopiladores/mail-campaigns/duplicate", "PUT /api/recopiladores/mail-campaigns/meta",
              "POST /api/recopiladores/mail-campaigns/delete")
  parts <- strsplit(routes, " ", fixed = TRUE)
  expect_false(any(vapply(parts, function(p) public_request_allowed(p[[1]], p[[2]]), NA)))
})
