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
  expect_match(html, ">Propuesta uno</figcaption>", fixed = TRUE)
  expect_match(html, ">Propuesta dos</figcaption>", fixed = TRUE)
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
