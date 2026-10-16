# Endurecimiento de destinatarios, revisión y exportación del correo (ADR 0110
# §2, revisiones metodológica y de contratos de E1f). Fixtures sintéticos.

.cmh_code <- function(expr) {
  e <- tryCatch({ force(expr); NULL }, api_error = function(e) e)
  if (is.null(e)) NA_character_ else e$code
}
.cmh_err <- function(expr) tryCatch({ force(expr); NULL }, api_error = function(e) e)
.cmh_by <- function(r) setNames(r$checks, vapply(r$checks, `[[`, "", "code"))
.cmh_partition_ok <- function(cn) {
  identical(cn$total, cn$valid + cn$without_email + cn$invalid_email + cn$duplicated)
}

test_that("CSV de Excel Windows (CP1252) con «Ñ» se lee entero y bien", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  csv <- paste(
    "Apellidos y nombres;Correo institucional;Carrera;Enlace",
    "\"QUISPE, ANA\";ana@ejemplo.org;Sociología;https://ejemplo.org/e/1",
    "\"NÚÑEZ PEÑA, IÑIGO\";inigo@ejemplo.org;Ingeniería;https://ejemplo.org/e/2",
    "\"ROJAS, LUZ\";luz@ejemplo.org;Economía;https://ejemplo.org/e/3",
    "\"VEGA, JOSÉ\";jose@ejemplo.org;Antropología;https://ejemplo.org/e/4",
    sep = "\r\n"
  )
  raw <- iconv(csv, "UTF-8", "CP1252", toRaw = TRUE)[[1]]
  expect_false(isTRUE(stringi::stri_enc_isutf8(raw)))
  out <- .cmail_fx_import_raw(sid, raw)
  expect_identical(out$row_count, 4L)
  expect_identical(out$encoding, "windows-1252")
  expect_identical(out$counts$valid, 4L)
  expect_identical(vapply(out$sample, `[[`, "", "nombre")[[2]], "Iñigo")
  expect_identical(out$sample[[2]]$fields$carrera, "Ingeniería")

  # UTF-16 con BOM (Excel «Texto Unicode», separado por tabuladores).
  tsv <- "Nombre\tCorreo\nAna Ñahui\tana@ejemplo.org\n"
  raw16 <- c(as.raw(c(0xFF, 0xFE)), iconv(tsv, "UTF-8", "UTF-16LE", toRaw = TRUE)[[1]])
  out16 <- .cmail_fx_import_raw(sid, raw16, file_name = "lista.txt")
  expect_identical(out16$encoding, "utf-16")
  expect_identical(out16$sample[[1]]$nombre, "Ana Ñahui")

  # Bytes sin carácter en Windows-1252: no se adivina.
  bad <- c(charToRaw("Nombre,Correo\nAna"), as.raw(0x81), charToRaw(",a@b.org\n"))
  expect_identical(.cmh_code(.cmail_fx_import_raw(sid, bad)), "E_COLLECTION_MAIL_RECIPIENTS_ENCODING")
})

test_that("un aviso del lector es error con motivo fijo, sin el mensaje crudo (M4)", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  raw <- charToRaw("Nombre,Correo\n\"Ana,ana@ejemplo.org\nLuz,luz@ejemplo.org\n")
  e <- NULL
  msgs <- utils::capture.output(e <- .cmh_err(.cmail_fx_import_raw(sid, raw)), type = "message")
  expect_identical(e$code, "E_COLLECTION_MAIL_RECIPIENTS_UNREADABLE")
  expect_true(e$details$reason %in% c("parse_warning", "parse_error"))
  expect_match(e$details$error_id, "^[0-9A-F]{8}$")
  expect_identical(sort(names(e$details)), c("error_id", "reason"))
  expect_false(any(grepl("ana@ejemplo.org", msgs, fixed = TRUE)))
})

test_that("NBSP e invisibles se limpian: el correo vale y se deduplica sin distinguir mayúsculas", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  csv <- paste0(
    "Nombre,Correo,Enlace\n",
    "Ana, ana@ejemplo.org​,https://e.org/1\n",
    "Ana,ANA@EJEMPLO.ORG,https://e.org/1\n",
    "Luz,mailto:luz@ejemplo.org,https://e.org/2\n"
  )
  out <- .cmail_fx_import(sid, csv = csv)
  expect_identical(out$counts$valid, 2L)
  expect_identical(out$counts$duplicated, 1L)
  expect_identical(out$counts$duplicated_conflicting, 0L)
  expect_true(.cmh_partition_ok(out$counts))
  r <- .cmail_recipients_resolve(.cmail_recipients_load(session_get(sid)))
  expect_identical(r$email[r$rows], c("ana@ejemplo.org", "luz@ejemplo.org"))
})

test_that("validador estricto de correo: tabla de aceptados y rechazados", {
  ok <- c("ana@ejemplo.org", "a.b+c@sub.dominio.pe", "x_y-z@uni.edu.pe", "o'neil@e.co")
  ko <- c("a@b.com.", "a@b..com", "a..b@c.com", ".a@c.com", "a.@c.com", "a@b", "a@-b.com", "a b@c.com",
          "a@@b.com", "@b.com", "a@b.c", "correo-invalido", "ana@ejemplo.org,luz@e.org")
  expect_true(all(.cmail_email_valid(.cmail_email_normalize(ok))))
  expect_false(any(.cmail_email_valid(.cmail_email_normalize(ko))))
  expect_identical(.cmail_email_normalize("mailto:ana@e.org"), "ana@e.org")
  expect_identical(.cmail_email_normalize(" #N/A "), "")
})

test_that("partición disjunta y exhaustiva; las filas vacías se cuentan aparte", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  csv <- paste(
    "Nombre,Correo,Enlace",
    "Ana,ana@e.org,https://e.org/1",
    ",,",
    "",
    "Luz,,https://e.org/2",
    "Eva,#N/A,https://e.org/3",
    "Ivo,ivo@,https://e.org/4",
    "Ana,ana@e.org,https://e.org/1",
    sep = "\n"
  )
  out <- .cmail_fx_import(sid, csv = csv)
  cn <- out$counts
  expect_identical(cn$total, 5L)
  expect_identical(cn$rows_blank_dropped, 2L)
  expect_identical(c(cn$valid, cn$without_email, cn$invalid_email, cn$duplicated), c(1L, 2L, 1L, 1L))
  expect_true(.cmh_partition_ok(cn))
})

test_that("duplicado con ENLACE distinto: se cuenta, bloquea con las filas; otro campo distinto avisa", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  csv <- paste(
    "Apellidos y nombres,Correo institucional,Carrera,Código,Enlace",
    "\"QUISPE, ANA\",ana@ejemplo.org,Sociología,1,https://ejemplo.org/e/1",
    "\"ROJAS, LUZ\",luz@ejemplo.org,Economía,2,https://ejemplo.org/e/2",
    "\"QUISPE, ANA\",ana@ejemplo.org,Sociología,1,https://ejemplo.org/e/OTRO",
    sep = "\n"
  )
  out <- .cmail_fx_import(sid, csv = csv)
  expect_identical(out$counts$duplicated, 1L)
  expect_identical(out$counts$duplicated_conflicting, 1L)
  by <- .cmh_by(collection_mail_review(sid))
  expect_identical(by$duplicates_conflicting$status, "error")
  expect_identical(by$duplicates_conflicting$items[[1]]$row, 4L)
  expect_identical(by$duplicates_conflicting$items[[1]]$first_row, 2L)
  expect_identical(unlist(by$duplicates_conflicting$items[[1]]$tags), "ENLACE")
  expect_false(grepl("@", jsonlite::toJSON(by$duplicates_conflicting, auto_unbox = TRUE), fixed = TRUE))
  expect_identical(.cmh_code(collection_mail_export(sid, .cmail_fx_rev(sid))), "E_COLLECTION_MAIL_REVIEW_BLOCKING")

  csv2 <- sub("Sociología,1,https://ejemplo.org/e/OTRO", "Filosofía,1,https://ejemplo.org/e/1", csv, fixed = TRUE)
  .cmail_fx_import(sid, csv = csv2)
  by2 <- .cmh_by(collection_mail_review(sid))
  expect_identical(by2$duplicates_conflicting$status, "warning")
  expect_identical(unlist(by2$duplicates_conflicting$items[[1]]$tags), "CARRERA")
})

test_that("ENLACE vacío (o «#N/A») en un efectivo bloquea; el respaldo se evalúa por uso", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  csv <- paste(
    "Apellidos y nombres,Correo institucional,Carrera,Código,Enlace",
    "\"QUISPE, ANA\",ana@ejemplo.org,Sociología,1,https://ejemplo.org/e/1",
    "\"ROJAS, LUZ\",luz@ejemplo.org,N/A,2,#N/A",
    "\"VEGA, EVA\",eva@ejemplo.org,-,3,https://ejemplo.org/e/3",
    sep = "\n"
  )
  out <- .cmail_fx_import(sid, csv = csv)
  expect_identical(out$counts$persons_with_any_empty, 2L)
  by <- .cmh_by(collection_mail_review(sid))
  fe <- by$fields_empty
  expect_identical(fe$status, "error")
  expect_match(fe$detail, "ENLACE", fixed = TRUE)
  expect_match(fe$detail, "#N/A", fixed = TRUE)
  items <- setNames(fe$items, vapply(fe$items, `[[`, "", "tag"))
  expect_identical(items$ENLACE$empty, 1L)
  expect_true(items$ENLACE$in_url)
  expect_false(items$ENLACE$fallback_covers)
  expect_identical(items$CARRERA$empty, 2L)
  expect_true(items$CARRERA$fallback_covers)
  expect_identical(.cmh_code(collection_mail_export(sid, .cmail_fx_rev(sid))), "E_COLLECTION_MAIL_REVIEW_BLOCKING")

  # El mismo campo con respaldo, pero también en el asunto: ahí el respaldo no se aplica.
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  t$subject <- "Encuesta para {{carrera}}"
  t$blocks[[3]]$text <- paste(t$blocks[[3]]$text, "Gracias, {{nombre}}.")
  fe2 <- .cmh_by(collection_mail_review(sid, template = t))$fields_empty
  items2 <- setNames(fe2$items, vapply(fe2$items, `[[`, "", "tag"))
  expect_false(items2$CARRERA$fallback_covers)
  expect_true("asunto" %in% unlist(items2$CARRERA$uses))
  expect_false(items2$FNAME$fallback_covers)
  expect_true(all(c("saludo", "cuerpo") %in% unlist(items2$FNAME$uses)))
})

test_that("nombre de pila: formato por contenido, dos comas sin separar, partículas, y no «Nombre de la carrera»", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  csv <- paste(
    "Nombre de la carrera,Estudiante,Correo,Enlace",
    "Sociología,\"PEREZ GOMEZ, MARIA DE LOS ANGELES\",a@e.org,https://e.org/1",
    "Economía,\"ROJAS, LUZ\",b@e.org,https://e.org/2",
    "Derecho,\"VEGA, ANA, MARIA\",c@e.org,https://e.org/3",
    sep = "\n"
  )
  out <- .cmail_fx_import(sid, csv = csv)
  expect_identical(out$mapping$name_column, "Estudiante")
  expect_identical(out$mapping$name_format, "apellidos_coma_nombres")
  expect_identical(vapply(out$sample, `[[`, "", "nombre"),
                   c("Maria de los Angeles", "Luz", "Vega Ana Maria"))
  expect_identical(out$counts$names_unsplit, 1L)
  # Con mapeo explícito sin name_format, el formato también sale del contenido.
  ex <- collection_mail_recipients_mapping_put(sid, list(email_column = "Correo", name_column = "Estudiante"))
  expect_identical(ex$mapping$name_format, "apellidos_coma_nombres")
  expect_identical(.cmail_first_name("JUAN DE LA CRUZ", "nombre")$name, "Juan de la Cruz")
  expect_identical(.cmail_guess_mapping(data.frame(`Nombre de la carrera` = "x", check.names = FALSE),
                                        .cmail_builtin_template())$name_column, NULL)
})

test_that("I1: el mapeo no puede llevar la columna del correo a otra etiqueta; la vista oculta correos", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  .cmail_fx_import(sid)
  e <- .cmh_err(collection_mail_recipients_mapping_put(sid, list(
    email_column = "Correo institucional", name_column = "Apellidos y nombres",
    fields = list(enlace = "Correo institucional")
  )))
  expect_identical(e$code, "E_COLLECTION_MAIL_MAPPING_INVALID")
  expect_identical(.cmh_code(collection_mail_recipients_mapping_put(sid, list(
    email_column = "Correo institucional", name_column = "Correo institucional"
  ))), "E_COLLECTION_MAIL_MAPPING_INVALID")

  # Un correo que llega por otra columna se oculta en la muestra y la vista previa.
  csv <- paste(
    "Apellidos y nombres,Correo institucional,Carrera,Código,Enlace",
    "\"QUISPE, ANA\",ana@ejemplo.org,Sociología,otra.ana@personal.com,https://ejemplo.org/e/1",
    sep = "\n"
  )
  out <- .cmail_fx_import(sid, csv = csv)
  expect_identical(out$sample[[1]]$fields$codigo, "[correo oculto]")
  expect_false(any(grepl("@", unlist(out), fixed = TRUE)))
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  t$blocks[[3]]$text <- paste(t$blocks[[3]]$text, "Su código es {{codigo}}.")
  pv <- collection_mail_preview(sid, "preview", recipient_index = 1L, template = t)
  expect_false(grepl("personal.com", pv$html, fixed = TRUE))
  expect_false(any(grepl("@", unlist(pv$recipient), fixed = TRUE)))
})

test_that("6: un logo re-subido con el mismo nombre usa el más reciente por uploaded_at", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  new <- .cmail_fx_logo_at(sid, "logo-cliente.png", "2026-10-16T10:00:00Z")
  old <- .cmail_fx_logo_at(sid, "LOGO-CLIENTE.png", "2026-10-15T10:00:00Z")
  .cmail_fx_logo(sid, "pulso.png")
  imgs <- .cmail_images_resolve(session_get(sid), .cmail_builtin_template())
  expect_identical(imgs[["logo-cliente"]]$path, new$path)
  expect_identical(.cm_brand_assets_map(session_get(sid), "logo-cliente")[["logo-cliente"]], new$path)
  expect_false(old$file_id %in% .cm_brand_logo_fids(session_get(sid)))
})

test_that("I2: los logos viajan en el .pulso y la cabecera los encuentra al reabrir", {
  skip_if_not_installed("zip")
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  collection_state_seed(sid)
  new <- .cmail_fx_logo_at(sid, "logo-cliente.png", "2026-10-16T10:00:00Z")
  old <- .cmail_fx_logo_at(sid, "logo-cliente.png", "2026-10-15T10:00:00Z")
  .cmail_fx_logo_at(sid, "pulso.png", "2026-10-16T10:00:00Z")
  tmp <- tempfile(fileext = ".pulso"); on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(sid, tmp, project_name = "Logos")
  entries <- zip::zip_list(tmp)$filename
  expect_true(any(grepl(paste0("^files/", new$file_id, "__"), entries)))
  expect_false(any(grepl(old$file_id, entries, fixed = TRUE)))
  loaded <- load_pulso(tmp); on.exit(session_delete(loaded$session_id), add = TRUE)
  s2 <- session_get(loaded$session_id)
  imgs <- .cmail_images_resolve(s2, .cmail_builtin_template())
  expect_true(all(vapply(imgs, function(i) !is.null(i$path) && file.exists(i$path), NA)))
  expect_identical(.cmh_by(collection_mail_review(loaded$session_id))$images_available$status, "ok")
})

test_that("6: manifest con procedencia y cifras completas, sin correos; LEEME con cifras; ZIP ≤ 80", {
  skip_if_not_installed("zip")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  collection_state_seed(sid)
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  t$template_id <- paste0("correo-", strrep("x", 52))
  collection_mail_template_put(sid, t, .cmail_fx_rev(sid))
  .cmail_fx_import(sid)
  res <- collection_mail_export(sid, .cmail_fx_rev(sid))
  expect_lte(nchar(res$zip$filename), 80L)
  expect_lte(nchar(res$artifacts[[2]]$filename), 80L)
  expect_identical(vapply(res$artifacts, `[[`, "", "role"), c("deliverable", "manifest"))
  expect_identical(res$zip$media_type, "application/zip")

  meta <- session_get(sid)$files[[res$zip$file_id]]
  ex <- tempfile("cmh-zip-"); on.exit(unlink(ex, recursive = TRUE), add = TRUE)
  utils::unzip(meta$path, exdir = ex)
  man_txt <- paste(readLines(file.path(ex, "manifest.json"), warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_false(grepl("@", man_txt, fixed = TRUE))
  man <- jsonlite::fromJSON(man_txt, simplifyVector = FALSE)
  rc <- man$recipients
  cn <- rc$counts
  expect_identical(c(cn$total, cn$valid, cn$invalid_email, cn$duplicated, cn$without_email), c(5L, 3L, 1L, 1L, 0L))
  expect_true(.cmh_partition_ok(cn))
  expect_true(all(c("duplicated_conflicting", "names_unsplit", "persons_with_any_empty", "rows_blank_dropped") %in% names(cn)))
  expect_identical(rc$source_file, "destinatarios.csv")
  expect_match(rc$source_sha256, "^sha256:[0-9a-f]{64}$")
  expect_false(is.null(rc$imported_at))
  expect_identical(rc$name_format, "apellidos_coma_nombres")
  expect_identical(rc$mapping$email_column, "Correo institucional")
  expect_true(all(c("FNAME", "CARRERA", "ENLACE") %in% unlist(man$tags)))
  expect_true("fields_empty" %in% vapply(man$checks, `[[`, "", "code"))
  leeme <- readLines(file.path(ex, "LEEME.txt"), encoding = "UTF-8", warn = FALSE)
  expect_true(any(grepl("^Cifras: 3 destinatarios en audiencia.csv de 5 filas", leeme)))
  expect_true(any(grepl("IMAGEN_logo-cliente.png\\s+\\| imagenes/logo-cliente.png", leeme)))
})

test_that("M1 y M3: el export exige la revisión; una plantilla guardada inválida no llega al render", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  .cmail_fx_import(sid)
  expect_identical(.cmh_code(collection_mail_export(sid)), "E_COLLECTION_EXPECTED_REVISION")
  expect_identical(.cmh_code(collection_mail_export(sid, .cmail_fx_rev(sid) + 5L)), "E_COLLECTION_STATE_STALE")

  collection_state_seed(sid)
  collection_mail_template_put(sid, .cmail_template_normalize(.cmail_preset_invitacion()), .cmail_fx_rev(sid))
  s <- session_get(sid)
  s$collection_state$mail_template$blocks[[1]]$type <- "html_crudo"
  session_set(sid, "collection_state", s$collection_state)
  expect_identical(.cmh_code(collection_mail_review(sid)), "E_COLLECTION_MAIL_TEMPLATE_STORED_INVALID")
  g <- collection_mail_template_get(sid)
  expect_true(length(g$stored_problems) > 0L)
  # Se puede reemplazar desde el editor.
  ok <- collection_mail_template_put(sid, .cmail_template_normalize(.cmail_preset_recuperacion()), g$state_revision)
  expect_false(ok$noop)
  expect_true(collection_mail_review(sid)$ok)
})

test_that("HTTP real: import multipart (CSV y XLSX) con el parser de plumber", {
  testthat::skip_if_not_installed("plumber")
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  b <- "PulsoBoundary7MA4YWxk"
  ct <- paste0("multipart/form-data; boundary=", b)
  csv_raw <- iconv(.cmail_fx_recipients_csv(), "UTF-8", "CP1252", toRaw = TRUE)[[1]]
  map <- '{"email_column":"Correo institucional","name_column":"Apellidos y nombres","fields":{"carrera":"Carrera","enlace":"Enlace"}}'
  r <- .cmail_fx_call_raw(pr, sid, "POST", "/api/recopiladores/mail-recipients/import",
                          .cmail_fx_multipart(b, csv_raw, "destinatarios.csv", "text/csv", map), ct)
  expect_identical(r$status, 200L, info = substr(r$raw, 1, 500))
  expect_identical(unlist(r$body$counts$valid), 3L)
  expect_identical(unlist(r$body$encoding), "windows-1252")
  expect_identical(unlist(r$body$sample[[1]]$fields$carrera), "Sociología")
  expect_false(grepl("@", r$raw, fixed = TRUE))

  df <- utils::read.csv(text = .cmail_fx_recipients_csv(), colClasses = "character", check.names = FALSE)
  path <- tempfile(fileext = ".xlsx"); on.exit(unlink(path), add = TRUE)
  openxlsx::write.xlsx(df, path)
  xr <- .cmail_fx_call_raw(pr, sid, "POST", "/api/recopiladores/mail-recipients/import",
                           .cmail_fx_multipart(b, readBin(path, "raw", file.info(path)$size), "destinatarios.xlsx",
                                               "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), ct)
  expect_identical(xr$status, 200L, info = substr(xr$raw, 1, 500))
  expect_identical(unlist(xr$body$counts$valid), 3L)

  bad <- .cmail_fx_call_raw(pr, sid, "PUT", "/api/recopiladores/mail-recipients/mapping",
                            charToRaw(.cmail_fx_json(list(mapping = list(email_column = "Correo institucional",
                                                                         fields = list(enlace = "Correo institucional"))))),
                            "application/json")
  expect_identical(bad$status, 422L)
  expect_identical(unlist(bad$body$error$code), "E_COLLECTION_MAIL_MAPPING_INVALID")
})

test_that("modo público: las rutas de correo quedan bloqueadas", {
  routes <- c(
    "GET /api/recopiladores/mail-presets", "GET /api/recopiladores/mail-template",
    "PUT /api/recopiladores/mail-template", "POST /api/recopiladores/mail-template/preview",
    "POST /api/recopiladores/mail-template/review", "POST /api/recopiladores/mail-template/export",
    "POST /api/recopiladores/mail-recipients/import", "GET /api/recopiladores/mail-recipients",
    "PUT /api/recopiladores/mail-recipients/mapping", "DELETE /api/recopiladores/mail-recipients"
  )
  parts <- strsplit(routes, " ", fixed = TRUE)
  expect_false(any(vapply(parts, function(p) public_request_allowed(p[[1]], p[[2]]), NA)))

  testthat::skip_if_not_installed("plumber")
  old <- Sys.getenv("PULSO_PUBLIC_MODE", unset = NA)
  Sys.setenv(PULSO_PUBLIC_MODE = "1")
  on.exit(if (is.na(old)) Sys.unsetenv("PULSO_PUBLIC_MODE") else Sys.setenv(PULSO_PUBLIC_MODE = old), add = TRUE)
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  pr <- suppressMessages(apply_public_mode_filter(
    mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  ))
  r <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-template/export", .cmail_fx_json(list(expected_revision = 0L)))
  expect_identical(r$status, 403L)
  expect_identical(unlist(r$body$error$code), "E_FORBIDDEN_PUBLIC")
})

test_that("M6: abrir otro proyecto in_place borra los datos personales de la sesión reemplazada", {
  skip_if_not_installed("zip")
  testthat::skip_if_not_installed("plumber")
  src <- session_create(); on.exit(session_delete(src), add = TRUE)
  collection_state_seed(src)
  tmp <- tempfile(fileext = ".pulso"); on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(src, tmp, project_name = "Otro")

  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  .cmail_fx_import(sid)
  res <- collection_mail_export(sid, .cmail_fx_rev(sid))
  old <- session_get(sid)
  zip_path <- old$files[[res$zip$file_id]]$path
  expect_true(file.exists(.cmail_recipients_path(old)))
  expect_true(file.exists(zip_path))

  pr <- mount_proyecto(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  r <- .cmail_fx_call(pr, sid, "POST", "/api/project/open", .cmail_fx_json(list(path = tmp, in_place = TRUE)))
  expect_identical(r$status, 200L, info = substr(r$raw, 1, 500))
  expect_false(file.exists(.cmail_recipients_path(old)))
  expect_false(file.exists(zip_path))
  expect_false(collection_mail_recipients_get(sid)$loaded)
})
