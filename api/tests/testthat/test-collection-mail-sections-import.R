# «Importar de otro estudio…» de «Mis secciones» (GOAL editor profesional, L9;
# ADR 0113): se lee otro .pulso sin abrirlo y se copian sus secciones con sus
# fotos. Sin red; estudios sintéticos.

.cmsi_err <- function(expr) tryCatch({ force(expr); NULL }, api_error = function(e) e)
.cmsi_code <- function(expr) { e <- .cmsi_err(expr); if (is.null(e)) NA_character_ else e$code }
.cmsi_rev <- function(sid) as.integer(session_get(sid)$collection_state$state_revision %||% 0L)

.cmsi_destacado <- function(foto = "premio") {
  list(type = "feature", eyebrow = "Sorteo", title = "Participa por unos audífonos, {{nombre}}",
       text = "Sorteamos 5.", image_ref = foto, alt = "Audífonos", layout = "derecha", box = list(bg = "tinte"))
}

# Un estudio de origen con dos secciones: una con foto propia y unos Pasos sin foto.
.cmsi_origen <- function(width = 600L) {
  sid <- .cmail_fx_session(logos = FALSE)
  .cmail_fx_mail_image(sid, "premio.png", width = width)
  r <- collection_mail_section_create(sid, .cmsi_rev(sid), name = "Sorteo", block = .cmsi_destacado(),
                                      images = list(premio = list(alt = "Audífonos", url = "https://x.pe/p.png")),
                                      campaign_id = "recuperacion")$state_revision
  collection_mail_section_create(sid, r, name = "Cómo responder",
                                 block = list(type = "steps", title = "Cómo responder", entries = list(list(title = "Abre tu enlace"))))
  path <- tempfile(fileext = ".pulso")
  build_pulso(sid, path, project_name = "Estudio de origen")
  session_delete(sid)
  path
}

test_that("peek lee el otro .pulso sin tocar este estudio y dice qué trae cada sección", {
  src <- .cmsi_origen(); on.exit(unlink(src, force = TRUE), add = TRUE)
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  r0 <- .cmsi_rev(sid)
  p <- collection_mail_sections_import_peek(sid, src)
  expect_identical(p$project_name, "Estudio de origen")
  expect_false(p$same_project)
  expect_identical(p$room, .CMAIL_SECTIONS_MAX)
  expect_identical(vapply(p$sections, `[[`, "", "name"), c("Sorteo", "Cómo responder"))
  expect_identical(vapply(p$sections, function(x) x$photos, 0L), c(1L, 0L))
  expect_identical(vapply(p$sections, function(x) x$photos_missing, 0L), c(0L, 0L))
  expect_true(all(vapply(p$sections, function(x) x$importable && !x$already_here, TRUE)))
  expect_identical(.cmsi_rev(sid), r0)
  expect_length(collection_mail_sections_get(sid)$sections, 0L)
})

test_that("importar copia las secciones elegidas con su foto, sin la campaña del otro estudio, y viajan en el .pulso", {
  src <- .cmsi_origen(); on.exit(unlink(src, force = TRUE), add = TRUE)
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  out <- collection_mail_sections_import(sid, .cmsi_rev(sid), src, list("sorteo"))
  expect_identical(out$imported, 1L)
  expect_identical(out$photos_missing, 0L)
  s <- out$sections[[1]]
  expect_identical(s$name, "Sorteo")
  expect_identical(s$block$image_ref, "premio")
  expect_identical(s$images$premio$url, "https://x.pe/p.png")
  expect_null(s$campaign_id)
  # La foto ahora es de este estudio y la resuelve el render.
  foto <- .cmail_image_latest(session_get(sid)$files)$premio
  expect_identical(foto$kind, "mail_image")
  expect_true(file.exists(foto$path))
  # Y viaja en el .pulso de este estudio.
  dest <- tempfile(fileext = ".pulso"); on.exit(unlink(dest, force = TRUE), add = TRUE)
  build_pulso(sid, dest, project_name = "Destino")
  loaded <- load_pulso(dest); on.exit(session_delete(loaded$session_id), add = TRUE)
  expect_identical(vapply(collection_mail_sections_get(loaded$session_id)$sections, `[[`, "", "name"), "Sorteo")
  expect_false(is.null(.cmail_image_latest(session_get(loaded$session_id)$files)$premio))
})

test_that("una foto con el mismo id: igual se reutiliza, distinta entra con id nuevo y el bloque la nombra", {
  src <- .cmsi_origen(); on.exit(unlink(src, force = TRUE), add = TRUE)
  # Este estudio ya tiene una «premio» distinta (otro ancho): no se pisa.
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  .cmail_fx_mail_image(sid, "premio.png", width = 400L)
  propia <- .cmail_image_latest(session_get(sid)$files)$premio$path
  out <- collection_mail_sections_import(sid, .cmsi_rev(sid), src, list("sorteo"))
  expect_identical(out$photos_renamed, 1L)
  s <- out$sections[[1]]
  expect_identical(s$block$image_ref, "premio-2")
  expect_identical(names(s$images), "premio-2")
  fotos <- .cmail_image_latest(session_get(sid)$files)
  expect_identical(fotos$premio$path, propia)
  expect_equal(.cmail_png_size(fotos$`premio-2`$path)$width, 600)
  # La misma foto (mismos bytes) no se duplica.
  sid2 <- .cmail_fx_session(); on.exit(session_delete(sid2), add = TRUE)
  .cmail_fx_mail_image(sid2, "premio.png")
  n0 <- length(session_get(sid2)$files)
  out2 <- collection_mail_sections_import(sid2, .cmsi_rev(sid2), src, list("sorteo"))
  expect_identical(out2$photos_renamed, 0L)
  expect_identical(out2$sections[[1]]$block$image_ref, "premio")
  expect_identical(length(session_get(sid2)$files), n0)
})

test_that("una sección que ya está no se duplica; volver a importar no suma nada", {
  src <- .cmsi_origen(); on.exit(unlink(src, force = TRUE), add = TRUE)
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  a <- collection_mail_sections_import(sid, .cmsi_rev(sid), src, list("sorteo", "como-responder"))
  expect_identical(a$imported, 2L)
  expect_true(all(vapply(collection_mail_sections_import_peek(sid, src)$sections, `[[`, TRUE, "already_here")))
  b <- collection_mail_sections_import(sid, a$state_revision, src, list("sorteo", "como-responder"))
  expect_identical(b$imported, 0L)
  expect_identical(b$already_here, 2L)
  expect_identical(b$state_revision, a$state_revision)
  expect_length(b$sections, 2L)
})

test_that("rechaza ruta vacía, archivo que no es .pulso, ninguna elegida, revisión vieja y pasar el tope", {
  src <- .cmsi_origen(); on.exit(unlink(src, force = TRUE), add = TRUE)
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  r <- .cmsi_rev(sid)
  expect_identical(.cmsi_code(collection_mail_sections_import_peek(sid, "")), "E_COLLECTION_MAIL_SECTIONS_IMPORT")
  expect_identical(.cmsi_code(collection_mail_sections_import_peek(sid, tempfile(fileext = ".pulso"))), "E_COLLECTION_MAIL_SECTIONS_IMPORT")
  txt <- tempfile(fileext = ".pulso"); writeLines("hola", txt); on.exit(unlink(txt), add = TRUE)
  expect_identical(.cmsi_code(collection_mail_sections_import_peek(sid, txt)), "E_COLLECTION_MAIL_SECTIONS_IMPORT")
  expect_identical(.cmsi_code(collection_mail_sections_import_peek(sid, sub("\\.pulso$", ".zip", src))), "E_COLLECTION_MAIL_SECTIONS_IMPORT")
  expect_identical(.cmsi_code(collection_mail_sections_import(sid, r, src, list())), "E_COLLECTION_MAIL_SECTIONS_IMPORT")
  expect_identical(.cmsi_code(collection_mail_sections_import(sid, r, src, list("no-existe"))), "E_COLLECTION_MAIL_SECTION_NOT_FOUND")
  expect_false(is.na(.cmsi_code(collection_mail_sections_import(sid, r - 1L, src, list("sorteo")))))
  for (i in seq_len(.CMAIL_SECTIONS_MAX - 1L)) {
    r <- collection_mail_section_create(sid, r, name = sprintf("S %d", i), block = .cmsi_destacado())$state_revision
  }
  # Caben 1 y se piden 2: no entra ninguna.
  expect_identical(.cmsi_code(collection_mail_sections_import(sid, r, src, list("sorteo", "como-responder"))),
                   "E_COLLECTION_MAIL_SECTION_LIMIT")
  expect_length(collection_mail_sections_get(sid)$sections, .CMAIL_SECTIONS_MAX - 1L)
})

test_that("HTTP: peek e importar con el serializador de producción", {
  testthat::skip_if_not_installed("plumber")
  src <- .cmsi_origen(); on.exit(unlink(src, force = TRUE), add = TRUE)
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  p <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-sections/import/peek", .cmail_fx_json(list(path = src)))
  expect_identical(p$status, 200L)
  expect_identical(p$body$project_name, "Estudio de origen")
  expect_length(p$body$sections, 2L)
  expect_match(p$raw, '"entries":\\[\\{', perl = TRUE)
  i <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-sections/import",
                      .cmail_fx_json(list(expected_revision = .cmsi_rev(sid), path = src, section_ids = list("como-responder"))))
  expect_identical(i$status, 200L)
  expect_identical(i$body$imported, 1L)
  expect_identical(i$body$sections[[1]]$block$entries[[1]]$title, "Abre tu enlace")
  bad <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-sections/import/peek", .cmail_fx_json(list(path = "")))
  expect_identical(bad$status, 422L)
  expect_identical(bad$body$error$code, "E_COLLECTION_MAIL_SECTIONS_IMPORT")
})

test_that("sin su foto en el origen, el bloque no nombra una foto ajena de este estudio con el mismo id", {
  # Origen cuya sección nombra «premio» sin tener el archivo.
  o <- .cmail_fx_session(logos = FALSE)
  collection_mail_section_create(o, .cmsi_rev(o), name = "Sorteo", block = .cmsi_destacado())
  src <- tempfile(fileext = ".pulso"); on.exit(unlink(src, force = TRUE), add = TRUE)
  build_pulso(o, src, project_name = "Sin foto"); session_delete(o)
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  .cmail_fx_mail_image(sid, "premio.png", width = 400L)
  p <- collection_mail_sections_import_peek(sid, src)
  expect_identical(p$sections[[1]]$photos_missing, 1L)
  out <- collection_mail_sections_import(sid, .cmsi_rev(sid), src, list("sorteo"))
  expect_identical(out$photos_missing, 1L)
  ref <- out$sections[[1]]$block$image_ref
  expect_false(identical(ref, "premio"))
  expect_null(.cmail_image_latest(session_get(sid)$files)[[ref]])
})

test_that("una foto que ya entró renombrada se reutiliza, y dos secciones iguales del origen entran una vez", {
  src <- .cmsi_origen(); on.exit(unlink(src, force = TRUE), add = TRUE)
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  .cmail_fx_mail_image(sid, "premio.png", width = 400L)
  a <- collection_mail_sections_import(sid, .cmsi_rev(sid), src, list("sorteo"))
  expect_identical(a$sections[[1]]$block$image_ref, "premio-2")
  # Se borra la sección y se vuelve a importar: la foto es la misma «premio-2», no una «premio-3».
  d <- collection_mail_section_delete(sid, a$state_revision, "sorteo")
  n0 <- length(session_get(sid)$files)
  b <- collection_mail_sections_import(sid, d$state_revision, src, list("sorteo"))
  expect_identical(b$sections[[1]]$block$image_ref, "premio-2")
  expect_identical(length(session_get(sid)$files), n0)
  # Origen con dos secciones idénticas (mismo nombre y bloque).
  o <- .cmail_fx_session(logos = FALSE)
  r <- collection_mail_section_create(o, .cmsi_rev(o), name = "Pasos", block = list(type = "steps", title = "T", entries = list(list(title = "A"))))$state_revision
  collection_mail_section_create(o, r, name = "Pasos", block = list(type = "steps", title = "T", entries = list(list(title = "A"))))
  dup <- tempfile(fileext = ".pulso"); on.exit(unlink(dup, force = TRUE), add = TRUE)
  build_pulso(o, dup, project_name = "Duplicadas"); session_delete(o)
  sid2 <- .cmail_fx_session(); on.exit(session_delete(sid2), add = TRUE)
  out <- collection_mail_sections_import(sid2, .cmsi_rev(sid2), dup, list("pasos", "pasos-2"))
  expect_identical(out$imported, 1L)
  expect_length(out$sections, 1L)
})
