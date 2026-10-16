# Destinatarios, revisión y exportación del correo para Mailchimp (ADR 0110 §2
# y Consecuencias). Fixtures sintéticos (helper-collection-mail.R).

.cmail_e_code <- function(expr) {
  e <- tryCatch({ force(expr); NULL }, api_error = function(e) e)
  if (is.null(e)) NA_character_ else e$code
}

test_that("importar adivina el mapeo, separa el nombre de pila y la vista no recibe correos", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  out <- .cmail_fx_import(sid)
  expect_true(out$loaded)
  expect_identical(out$row_count, 5L)
  expect_identical(out$mapping$email_column, "Correo institucional")
  expect_identical(out$mapping$name_column, "Apellidos y nombres")
  expect_identical(out$mapping$name_format, "apellidos_coma_nombres")
  expect_identical(out$mapping$fields$carrera, "Carrera")
  expect_identical(out$mapping$fields$codigo, "Código")
  expect_identical(out$mapping$fields$enlace, "Enlace")
  expect_identical(out$counts$valid, 3L)
  expect_identical(out$counts$invalid_email, 1L)
  expect_identical(out$counts$duplicated, 1L)
  expect_identical(out$counts$names_unsplit, 1L)
  expect_identical(vapply(out$sample, `[[`, "", "nombre"), c("Ana Lucia", "Carlos", "Luz Torres"))
  expect_false(any(grepl("@", unlist(out), fixed = TRUE)))
  expect_false(any(grepl("@", unlist(collection_mail_recipients_get(sid)), fixed = TRUE)))
  # Sin columna «apellidos», el nombre se toma entero y no hay aviso.
  expect_identical(.cmail_first_name("ANA LUCIA", "nombre")$name, "Ana Lucia")
  expect_false(.cmail_first_name("Ana", "nombre")$unsplit)
})

test_that("el mapeo explícito se valida contra las columnas y los campos de la plantilla", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  .cmail_fx_import(sid)
  expect_identical(.cmail_e_code(collection_mail_recipients_mapping_put(sid, list(email_column = "No existe"))),
                   "E_COLLECTION_MAIL_MAPPING_INVALID")
  expect_identical(.cmail_e_code(collection_mail_recipients_mapping_put(sid, list(fields = list(ajeno = "Carrera")))),
                   "E_COLLECTION_MAIL_MAPPING_INVALID")
  ok <- collection_mail_recipients_mapping_put(sid, list(
    email_column = "Correo institucional", name_column = "Apellidos y nombres",
    fields = list(carrera = "Carrera")
  ))
  expect_null(ok$mapping$fields$enlace)
  expect_identical(.cmail_e_code(.cmail_fx_import(sid, csv = "a,b\n")), "E_COLLECTION_MAIL_RECIPIENTS_EMPTY")
  expect_identical(.cmail_e_code(collection_mail_recipients_import(sid, file_name = "x.pdf",
                                                                   content_base64 = jsonlite::base64_enc(charToRaw("x")))),
                   "E_COLLECTION_MAIL_RECIPIENTS_FORMAT")
})

test_that("importar un XLSX funciona igual que el CSV", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  df <- utils::read.csv(text = .cmail_fx_recipients_csv(), colClasses = "character", check.names = FALSE)
  path <- tempfile(fileext = ".xlsx"); on.exit(unlink(path), add = TRUE)
  openxlsx::write.xlsx(df, path)
  raw <- readBin(path, "raw", file.info(path)$size)
  out <- collection_mail_recipients_import(sid, file_raw = raw, file_name = "destinatarios.xlsx")
  expect_identical(out$counts$valid, 3L)
  expect_identical(out$mapping$fields$carrera, "Carrera")
})

test_that("multipart: el archivo y el mapeo llegan por el formulario", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  b <- "XYZBOUNDARY"
  body <- paste0(
    "--", b, "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"d.csv\"\r\nContent-Type: text/csv\r\n\r\n",
    .cmail_fx_recipients_csv(), "\r\n",
    "--", b, "\r\nContent-Disposition: form-data; name=\"mapping\"\r\n\r\n",
    '{"email_column":"Correo institucional","name_column":"Apellidos y nombres","fields":{"carrera":"Carrera"}}', "\r\n",
    "--", b, "--\r\n"
  )
  req <- list(bodyRaw = charToRaw(enc2utf8(body)), CONTENT_TYPE = paste0("multipart/form-data; boundary=", b))
  input <- .cmail_import_request(req)
  expect_identical(input$file_name, "d.csv")
  out <- collection_mail_recipients_import(sid, file_raw = input$file_raw, file_name = input$file_name, mapping = input$mapping)
  expect_identical(out$counts$valid, 3L)
  expect_identical(names(out$mapping$fields), "carrera")
})

test_that("los correos no entran a collection_state ni al .pulso (scan del estado persistible)", {
  skip_if_not_installed("zip")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  collection_state_seed(sid)
  g <- collection_mail_template_get(sid)
  collection_mail_template_put(sid, .cmail_template_normalize(.cmail_preset_invitacion()), g$state_revision)
  .cmail_fx_import(sid)
  collection_mail_preview(sid, "preview", recipient_index = 1L)
  collection_mail_export(sid, .cmail_fx_rev(sid))

  state_json <- jsonlite::toJSON(session_get(sid)$collection_state, auto_unbox = TRUE, null = "null")
  expect_false(grepl("@ejemplo.org|QUISPE|Quispe|Ana Lucia", state_json))
  expect_false(is.null(session_get(sid)$collection_state$mail_template))

  tmp <- tempfile(fileext = ".pulso"); on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(sid, tmp, project_name = "Correo")
  ex <- tempfile("pulso-scan-"); on.exit(unlink(ex, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(tmp, exdir = ex)
  hits <- character(0)
  for (f in list.files(ex, recursive = TRUE, full.names = TRUE)) {
    txt <- if (grepl("\\.rds$", f)) {
      paste(utils::capture.output(str(readRDS(f), list.len = 1e5, nchar.max = 1e5)), collapse = "\n")
    } else {
      rawToChar(readBin(f, "raw", file.info(f)$size)[readBin(f, "raw", file.info(f)$size) != as.raw(0)])
    }
    if (grepl("ejemplo.org|QUISPE MAMANI|ana.quispe", txt, useBytes = TRUE)) hits <- c(hits, basename(f))
  }
  expect_length(hits, 0L)
  loaded <- load_pulso(tmp); on.exit(session_delete(loaded$session_id), add = TRUE)
  expect_identical(session_get(loaded$session_id)$collection_state$mail_template$preset_id, "invitacion_capacitacion_v1")
  expect_false(collection_mail_recipients_get(loaded$session_id)$loaded)
})

test_that("revisión: cifras de asunto, peso, imágenes, pie, etiquetas con columna y sin dato", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  r0 <- collection_mail_review(sid)
  by0 <- setNames(r0$checks, vapply(r0$checks, `[[`, "", "code"))
  expect_identical(by0$recipients$status, "error")
  expect_false(r0$ready)

  .cmail_fx_import(sid)
  r <- collection_mail_review(sid)
  by <- setNames(r$checks, vapply(r$checks, `[[`, "", "code"))
  expect_true(all(c("subject", "preheader", "html_weight", "images_hosted", "images_available", "images_alt",
                    "footer_unsub", "recipients", "tags_have_columns", "fields_empty", "names_unsplit") %in% names(by)))
  expect_identical(by$html_weight$status, "ok")
  expect_lt(by$html_weight$value, 102L * 1024L)
  expect_identical(by$images_hosted$status, "warning")
  expect_identical(by$images_hosted$value, 2L)
  expect_identical(by$footer_unsub$status, "ok")
  expect_identical(by$tags_have_columns$status, "ok")
  expect_identical(by$recipients$value, 3L)
  empty <- setNames(by$fields_empty$items, vapply(by$fields_empty$items, `[[`, "", "tag"))
  expect_identical(empty$CARRERA$empty, 1L)
  expect_identical(empty$CARRERA$fallback, "su carrera")
  expect_identical(by$names_unsplit$value, 1L)
  expect_true(r$ready)

  # Una etiqueta usada sin columna bloquea.
  collection_mail_recipients_mapping_put(sid, list(email_column = "Correo institucional",
                                                   name_column = "Apellidos y nombres",
                                                   fields = list(carrera = "Carrera")))
  r2 <- collection_mail_review(sid)
  by2 <- setNames(r2$checks, vapply(r2$checks, `[[`, "", "code"))
  expect_identical(by2$tags_have_columns$status, "error")
  expect_match(by2$tags_have_columns$detail, "ENLACE", fixed = TRUE)
  expect_false(r2$ready)
  expect_identical(.cmail_e_code(collection_mail_export(sid, .cmail_fx_rev(sid))), "E_COLLECTION_MAIL_REVIEW_BLOCKING")
})

test_that("revisión del banner: 1200 x 600 o error", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  .cmail_fx_logo(sid, "banner-estudio.png", width = 800L, height = 400L)
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  t$header <- list(kind = "banner", image_ref = "banner-estudio")
  t$images <- list(`banner-estudio` = list(alt = "Estudio"))
  r <- collection_mail_review(sid, template = t)
  by <- setNames(r$checks, vapply(r$checks, `[[`, "", "code"))
  expect_identical(by$banner_size$status, "error")
  expect_identical(by$banner_size$value, "800×400")
})

test_that("export: ZIP fuera del .pulso con plantilla, audiencia e imágenes; artefactos registrados", {
  skip_if_not_installed("zip")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  .cmail_fx_import(sid)
  res <- collection_mail_export(sid, .cmail_fx_rev(sid))

  # Patrón expect_report_artifacts_registered (test-audit-projects.R).
  file_ids <- vapply(res$artifacts, function(a) a$file_id %||% "", character(1))
  expect_true(all(nzchar(file_ids)))
  manifests <- Filter(function(a) identical(a$role %||% "", "manifest"), res$artifacts)
  expect_length(manifests, 1L)
  expect_true(all(vapply(res$artifacts, function(a) grepl("^sha256:[0-9a-f]{64}$", a$sha256), NA)))
  expect_true(all(vapply(res$artifacts, function(a) identical(a$audience, "client"), NA)))
  # Nunca una ruta local en la respuesta.
  expect_false(any(grepl(tempdir(), unlist(res), fixed = TRUE)))
  expect_null(res$zip$path)

  meta <- session_get(sid)$files[[res$zip$file_id]]
  expect_identical(meta$role, "deliverable")
  expect_identical(meta$sha256, res$zip$sha256)
  entries <- zip::zip_list(meta$path)$filename
  expect_true(all(c("mailchimp_template.html", "audiencia.csv", "imagenes/logo-cliente.png",
                    "imagenes/pulso.png", "LEEME.txt", "manifest.json") %in% entries))

  ex <- tempfile("cmail-zip-"); on.exit(unlink(ex, recursive = TRUE), add = TRUE)
  utils::unzip(meta$path, exdir = ex)
  html <- paste(readLines(file.path(ex, "mailchimp_template.html"), encoding = "UTF-8", warn = FALSE), collapse = "\n")
  expect_false(grepl("data:", html, fixed = TRUE))
  expect_match(html, "*|UNSUB|*", fixed = TRUE)
  expect_lt(file.info(file.path(ex, "mailchimp_template.html"))$size, 102L * 1024L)

  aud <- utils::read.csv(file.path(ex, "audiencia.csv"), check.names = FALSE, colClasses = "character", encoding = "UTF-8")
  # Paridad (ADR 0110 Cumplimiento): toda etiqueta del HTML tiene su columna, y nada más.
  tags_html <- unique(sub("^\\*\\|(?:IF:)?([A-Z0-9_]+)\\|\\*$", "\\1",
                          regmatches(html, gregexpr("\\*\\|(?:IF:)?[A-Z0-9_]+\\|\\*", html, perl = TRUE))[[1]], perl = TRUE))
  tags_html <- setdiff(tags_html, c("UNSUB", "ELSE", "END"))
  expect_identical(names(aud), c("Email Address", "First Name", "CARRERA", "ENLACE"))
  expect_setequal(c("FNAME", names(aud)[-(1:2)]), tags_html)
  expect_identical(nrow(aud), 3L)
  expect_identical(aud[["First Name"]], c("Ana Lucia", "Carlos", "Luz Torres"))
  expect_identical(aud$CARRERA[[2]], "")

  leeme <- readLines(file.path(ex, "LEEME.txt"), encoding = "UTF-8", warn = FALSE)
  expect_true(any(grepl("IMAGEN_pulso.png", leeme, fixed = TRUE)))
  man <- jsonlite::fromJSON(file.path(ex, "manifest.json"), simplifyVector = FALSE)
  expect_identical(man$audience, "client")
  expect_false(isTRUE(man$secrets_included))
  expect_identical(unlist(man$audience_columns), names(aud))
  expect_false(grepl("@", paste(readLines(file.path(ex, "manifest.json"), warn = FALSE), collapse = ""), fixed = TRUE))
})

test_that("preview con destinatario importado y fuera de rango", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  .cmail_fx_import(sid)
  pv <- collection_mail_preview(sid, "preview", recipient_index = 2L)
  expect_identical(pv$recipient$source, "imported")
  expect_identical(pv$recipient$nombre, "Carlos")
  expect_match(pv$html, "como estudiante de su carrera", fixed = TRUE)
  expect_false(grepl("carlos.rojas@", pv$html, fixed = TRUE))
  expect_identical(.cmail_e_code(collection_mail_preview(sid, "preview", recipient_index = 9L)),
                   "E_COLLECTION_MAIL_RECIPIENT_INDEX")
  syn <- collection_mail_preview(sid, "preview")
  expect_identical(syn$recipient$source, "synthetic")
  collection_mail_recipients_delete(sid)
  expect_false(collection_mail_recipients_get(sid)$loaded)
})
