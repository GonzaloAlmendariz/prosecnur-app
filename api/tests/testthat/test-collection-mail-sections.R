# «Mis secciones» del correo (GOAL editor profesional, L9; ADR 0113: viven en
# el estudio): guardar, listar y borrar; el bloque guardado es una copia
# válida; tope, nombre y revisión; viaje en el .pulso y por HTTP. Sin red.

.cms_err <- function(expr) tryCatch({ force(expr); NULL }, api_error = function(e) e)
.cms_code <- function(expr) { e <- .cms_err(expr); if (is.null(e)) NA_character_ else e$code }
.cms_rev <- function(sid) as.integer(session_get(sid)$collection_state$state_revision %||% 0L)

.cms_destacado <- function() {
  list(block_id = "feature-1", type = "feature", eyebrow = "Sorteo", title = "Participa por unos audífonos, {{nombre}}",
       text = "Sorteamos 5.", image_ref = "premio", alt = "Audífonos", layout = "derecha", box = list(bg = "tinte"),
       guardado = list(name = "oculto"))
}

test_that("guardar una sección copia el bloque sin su id ni lo guardado, con la descripción y URL de su foto", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  out <- collection_mail_section_create(sid, .cms_rev(sid), name = "Sorteo de audífonos", block = .cms_destacado(),
                                        images = list(premio = list(alt = "Audífonos", url = "https://x.pe/p.png"),
                                                      otra = list(alt = "No es de este bloque")),
                                        campaign_id = "recuperacion")
  s <- out$section
  expect_identical(s$section_id, "sorteo-de-audifonos")
  expect_null(s$block$block_id)
  expect_null(s$block$guardado)
  expect_identical(s$block$title, "Participa por unos audífonos, {{nombre}}")
  expect_identical(s$block$box, list(bg = "tinte"))
  expect_identical(names(s$images), "premio")
  expect_identical(s$images$premio$url, "https://x.pe/p.png")
  expect_identical(s$campaign_id, "recuperacion")
  l <- collection_mail_sections_get(sid)
  expect_identical(l$state_revision, out$state_revision)
  expect_identical(vapply(l$sections, `[[`, "", "section_id"), "sorteo-de-audifonos")
  # Un segundo con el mismo nombre no pisa al primero.
  out2 <- collection_mail_section_create(sid, out$state_revision, name = "Sorteo de audífonos", block = .cms_destacado())
  expect_identical(out2$section$section_id, "sorteo-de-audifonos-2")
})

test_that("rechaza un bloque inválido, el pie legal, un nombre con correo o vacío, la revisión vieja y pasar el tope", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  r <- .cms_rev(sid)
  sin_titulo <- .cms_destacado(); sin_titulo$title <- NULL
  e <- .cms_err(collection_mail_section_create(sid, r, name = "X", block = sin_titulo))
  expect_identical(e$code, "E_COLLECTION_MAIL_SECTION_INVALID")
  expect_true(length(e$details$problems) >= 1L)
  expect_identical(.cms_code(collection_mail_section_create(sid, r, name = "X", block = list(type = "footer_legal"))),
                   "E_COLLECTION_MAIL_SECTION_INVALID")
  expect_identical(.cms_code(collection_mail_section_create(sid, r, name = "X", block = list(type = "otro"))),
                   "E_COLLECTION_MAIL_SECTION_INVALID")
  expect_identical(.cms_code(collection_mail_section_create(sid, r, name = "de ana@pucp.edu.pe", block = .cms_destacado())),
                   "E_COLLECTION_MAIL_SECTION_NAME")
  expect_identical(.cms_code(collection_mail_section_create(sid, r, name = "  ", block = .cms_destacado())),
                   "E_COLLECTION_MAIL_SECTION_NAME")
  expect_false(is.na(.cms_code(collection_mail_section_create(sid, r - 1L, name = "X", block = .cms_destacado()))))
  for (i in seq_len(.CMAIL_SECTIONS_MAX)) r <- collection_mail_section_create(sid, r, name = sprintf("S %d", i), block = .cms_destacado())$state_revision
  expect_identical(.cms_code(collection_mail_section_create(sid, r, name = "Una más", block = .cms_destacado())),
                   "E_COLLECTION_MAIL_SECTION_LIMIT")
})

test_that("borrar quita sólo esa sección; una que no está es 404", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  a <- collection_mail_section_create(sid, .cms_rev(sid), name = "Uno", block = .cms_destacado())
  b <- collection_mail_section_create(sid, a$state_revision, name = "Dos", block = .cms_destacado())
  d <- collection_mail_section_delete(sid, b$state_revision, "uno")
  expect_identical(vapply(collection_mail_sections_get(sid)$sections, `[[`, "", "section_id"), "dos")
  expect_identical(.cms_code(collection_mail_section_delete(sid, d$state_revision, "uno")), "E_COLLECTION_MAIL_SECTION_NOT_FOUND")
})

test_that("las secciones viajan en el .pulso y sobreviven a rehacer el plan", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  collection_mail_section_create(sid, .cms_rev(sid), name = "Sorteo", block = .cms_destacado())
  expect_true("mail_sections" %in% .COLLECTION_RESEED_CONSERVA)
  tmp <- tempfile(fileext = ".pulso"); on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(sid, tmp, project_name = "Secciones")
  loaded <- load_pulso(tmp); on.exit(session_delete(loaded$session_id), add = TRUE)
  l <- collection_mail_sections_get(loaded$session_id)
  expect_identical(vapply(l$sections, `[[`, "", "name"), "Sorteo")
  expect_identical(l$sections[[1]]$block$title, "Participa por unos audífonos, {{nombre}}")
})

test_that("HTTP: listar, guardar y borrar con el serializador de producción", {
  testthat::skip_if_not_installed("plumber")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  l0 <- .cmail_fx_call(pr, sid, "GET", "/api/recopiladores/mail-sections")
  expect_identical(l0$status, 200L)
  expect_length(l0$body$sections, 0L)
  c1 <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-sections",
                       .cmail_fx_json(list(expected_revision = l0$body$state_revision, name = "Pasos",
                                           block = list(type = "steps", title = "Cómo responder",
                                                        entries = list(list(title = "Abre tu enlace"))))))
  expect_identical(c1$status, 200L)
  expect_identical(c1$body$section$block$entries[[1]]$title, "Abre tu enlace")
  # Una sola entrada sigue siendo una lista (no se desarma en el JSON).
  expect_match(c1$raw, '"entries":\\[\\{', perl = TRUE)
  d <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-sections/delete",
                      .cmail_fx_json(list(expected_revision = c1$body$state_revision, section_id = "pasos")))
  expect_identical(d$status, 200L)
  bad <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-sections",
                        .cmail_fx_json(list(expected_revision = d$body$state_revision, name = "X", block = list(type = "footer_legal"))))
  expect_identical(bad$status, 422L)
  expect_identical(bad$body$error$code, "E_COLLECTION_MAIL_SECTION_INVALID")
})
