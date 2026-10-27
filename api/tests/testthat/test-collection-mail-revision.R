# Vista para revisión (loop editor de correos, L9; collection_mail_revision.R). Sin red.

test_that("arma un HTML con cada campaña en una columna, en computadora y en celular, sin marcas ni datos personales", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  rev <- as.integer(session_get(sid)$collection_state$state_revision %||% 0L)
  a <- collection_mail_campaign_create(sid, rev, name = "Propuesta uno", preset_id = "invitacion_encuesta_v1")
  b <- collection_mail_campaign_create(sid, a$state_revision, name = "Propuesta dos", preset_id = "recuperacion_estudiantes_v1")
  r <- collection_mail_revision(sid, list(a$campaign$campaign_id, b$campaign$campaign_id), ejemplo = "masculino",
                                titulo = "Correo de invitación")
  expect_true(r$ok)
  f <- session_get(sid)$files[[r$file$file_id]]
  expect_true(file.exists(f$path))
  expect_identical(r$file$media_type, "text/html")
  expect_identical(r$file$sensitivity, "internal")
  html <- paste(readLines(f$path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  # Dos campañas × computadora y celular.
  expect_identical(lengths(regmatches(html, gregexpr("<iframe class=\"computadora\"", html, fixed = TRUE))), 2L)
  expect_identical(lengths(regmatches(html, gregexpr("<iframe class=\"celular\"", html, fixed = TRUE))), 2L)
  expect_match(html, "width:760px", fixed = TRUE)
  expect_match(html, "width:390px", fixed = TRUE)
  expect_match(html, ">Propuesta uno<small>Primer correo</small>", fixed = TRUE)
  expect_match(html, ">Propuesta dos<small>Primer correo</small>", fixed = TRUE)
  expect_match(html, "<span>Asunto: ", fixed = TRUE)
  # Persona de ejemplo y sin el tinte de los campos del editor.
  expect_match(html, "Luis", fixed = TRUE)
  expect_false(grepl("data-pulso-field", html, fixed = TRUE))
  expect_false(grepl("·", html, fixed = TRUE))
})

test_that("pide de 1 a 6 campañas que existan", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)
  expect_identical(code(collection_mail_revision(sid, list())), "E_COLLECTION_MAIL_REVISION")
  expect_identical(code(collection_mail_revision(sid, list("no-existe"))), "E_COLLECTION_MAIL_REVISION")
})

test_that("muestra un recordatorio o el último, sin numerarlos; sin recordatorios, el primer correo (L17)", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  rev <- as.integer(session_get(sid)$collection_state$state_revision %||% 0L)
  a <- collection_mail_campaign_create(sid, rev, name = "Profesores", preset_id = "invitacion_encuesta_v1")
  b <- collection_mail_campaign_create(sid, a$state_revision, name = "Sin recordatorios", preset_id = "invitacion_encuesta_v1")
  envios <- list(list(send_id = "invitacion", kind = "invitacion", label = "Invitación", audience = "todos"),
                 list(kind = "recordatorio", label = "R uno", audience = "ambos", subject = "Recordatorio: aún puede responder"),
                 list(kind = "recordatorio", label = "R dos", audience = "ambos", subject = "Recordatorio: última semana"))
  put <- collection_mail_template_put(sid, a$campaign$template, b$state_revision, campaign_id = a$campaign$campaign_id, sends = envios)
  expect_true(isTRUE(put$ok))
  leer <- function(r) {
    force(r)  # la revisión registra su archivo al evaluarse: antes de leer la lista de archivos
    paste(readLines(session_get(sid)$files[[r$file$file_id]]$path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  }
  ids <- list(a$campaign$campaign_id, b$campaign$campaign_id)
  rec <- leer(collection_mail_revision(sid, ids, envio = "recordatorio"))
  expect_match(rec, ">Profesores<small>Recordatorio</small><span>Asunto: Recordatorio: aún puede responder</span>", fixed = TRUE)
  expect_match(rec, ">Sin recordatorios<small>Primer correo</small>", fixed = TRUE)
  ult <- leer(collection_mail_revision(sid, ids, envio = "ultimo"))
  expect_match(ult, ">Profesores<small>Último recordatorio</small><span>Asunto: Recordatorio: última semana</span>", fixed = TRUE)
  expect_false(grepl("Recordatorio [0-9]", ult))
  code <- tryCatch({ collection_mail_revision(sid, ids, envio = "tercero"); NA_character_ }, api_error = function(e) e$code)
  expect_identical(code, "E_COLLECTION_MAIL_REVISION")
})

test_that("cada imagen en base64 va una sola vez en la página aunque se repita en vistas y campañas (L18)", {
  png1 <- paste0("data:image/png;base64,", strrep("A", 4000), "&#10;", strrep("B", 76), "\n")
  png2 <- paste0("data:image/jpeg;base64,", strrep("C", 3000))
  correo <- function(n) list(nombre = n, subject = "Asunto", envio = "Primer correo",
                             html = sprintf('<p>x</p><img src="%s" alt="a"><img src="%s" alt="b">', png1, png2))
  im <- .cmail_revision_imagenes(list(correo("Uno"), correo("Dos")))
  expect_length(im$mapa, 2L)
  expect_identical(im$mapa[["i1"]], paste0("data:image/png;base64,", strrep("A", 4000), strrep("B", 76)))
  expect_false(grepl("base64", im$correos[[2]]$html, fixed = TRUE))
  expect_match(im$correos[[2]]$html, '<img data-cmail-img="i1" alt="a"><img data-cmail-img="i2" alt="b">', fixed = TRUE)
  pagina <- .cmail_revision_pagina("T", list(correo("Uno"), correo("Dos")))
  # Una vez en el mapa, no cuatro (2 campañas × 2 vistas).
  expect_identical(lengths(regmatches(pagina, gregexpr(strrep("A", 4000), pagina, fixed = TRUE))), 1L)
  expect_match(pagina, "var CMAIL_IMG=", fixed = TRUE)
  # Sin imágenes, el mapa queda vacío y no falla.
  expect_length(.cmail_revision_imagenes(list(list(nombre = "x", html = "<p>sin</p>")))$mapa, 0L)
})
