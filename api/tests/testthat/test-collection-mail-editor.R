# Correo E1g (ADR 0110 §1 y §B): marcas de edición solo en preview, plantilla
# v2 con estilos cerrados, bloques heading/divider/image, enlaces en el texto,
# claves no textuales únicas (H-d), targets en los chequeos, contraste del
# acento, imágenes mail_image (PNG/JPEG) y el ZIP importable de Mailchimp.
# Fixtures sintéticos.

.cme_err <- function(expr) tryCatch({ force(expr); NULL }, api_error = function(e) e)
.cme_code <- function(expr) { e <- .cme_err(expr); if (is.null(e)) NA_character_ else e$code }
.cme_base <- function() .cmail_template_normalize(.cmail_preset_recuperacion())
.cme_codes <- function(t) {
  vapply(collection_mail_template_validate(.cmail_template_normalize(t))$problems, `[[`, "", "code")
}
.cme_has <- function(targets, x) any(vapply(targets, identical, NA, x))
.cme_by <- function(r) setNames(r$checks, vapply(r$checks, `[[`, "", "code"))
.cme_add_blocks <- function(t, blocks, at = 3L) {
  t$blocks <- append(t$blocks, blocks, after = at - 1L)
  t
}
.cme_image_block <- function(id = "linea-cierre", ...) {
  c(list(block_id = paste0("img-", id), type = "image", image_ref = id, alt = "Gracias por participar"), list(...))
}

test_that("v2: la lectura acepta v1 y la sube sin tocar el contenido; otro esquema se rechaza", {
  v1 <- .cmail_preset_recuperacion(); v1$schema <- "collection_mail_template/v1"
  up <- .cmail_template_normalize(v1)
  expect_identical(up$schema, "collection_mail_template/v2")
  expect_identical(up$blocks, .cme_base()$blocks)
  expect_true(collection_mail_template_validate(up)$ok)
  otro <- v1; otro$schema <- "collection_mail_template/v0"
  expect_true("bad_schema" %in% .cme_codes(otro))

  # Una campaña guardada con v1 (E1h) se lee como v2; la migrada también.
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  a <- collection_mail_campaign_create(sid, 0L, name = "Uno")
  s <- session_get(sid)
  s$collection_state$mail_campaigns$campaigns[[1]]$template$schema <- "collection_mail_template/v1"
  .session_env[[sid]] <- s
  g <- collection_mail_template_get(sid)
  expect_identical(g$template$schema, "collection_mail_template/v2")
  expect_null(g$stored_problems)
  s$collection_state$mail_campaigns <- NULL
  s$collection_state$mail_template <- v1
  .session_env[[sid]] <- s
  expect_identical(collection_mail_template_get(sid)$template$schema, "collection_mail_template/v2")
})

test_that("marcas data-pulso solo en preview: bloques, cabecera, pie, props y campos", {
  t <- .cme_add_blocks(.cme_base(), list(
    list(block_id = "titulo", type = "heading", text = "Hola {{carrera}}", level = "titulo"),
    list(block_id = "sep", type = "divider", style = "linea", size = "m")
  ))
  values <- list(nombre = "Ana", fields = list(carrera = "Sociología", enlace = "https://ejemplo.org/e/1"))
  pv <- collection_mail_render(t, "preview", values = values)$html
  mc <- collection_mail_render(t, "mailchimp")$html
  expect_false(grepl("data-pulso", mc, fixed = TRUE))
  for (b in t$blocks) {
    expect_match(pv, sprintf('data-pulso-block="%s"', b$block_id), fixed = TRUE)
  }
  expect_match(pv, '<tr data-pulso-block="__cabecera" data-pulso-type="header">', fixed = TRUE)
  expect_match(pv, '<tr data-pulso-block="titulo" data-pulso-type="heading">', fixed = TRUE)
  expect_match(pv, 'data-pulso-block="pie" data-pulso-type="footer_legal"', fixed = TRUE)
  expect_match(pv, 'data-pulso-prop="items.0"', fixed = TRUE)
  expect_match(pv, 'data-pulso-prop="items.2"', fixed = TRUE)
  expect_match(pv, 'data-pulso-prop="title"', fixed = TRUE)
  expect_match(pv, '<span data-pulso-field="carrera" style="background:#eef3e8;border-radius:3px;">Sociología</span>', fixed = TRUE)
  expect_match(pv, '<span data-pulso-field="nombre"', fixed = TRUE)
  # En un enlace el valor no se tiñe: el href queda limpio.
  expect_match(pv, 'href="https://ejemplo.org/e/1"', fixed = TRUE)
  expect_false(grepl('href="<span', pv, fixed = TRUE))
})

test_that("estilos: solo enumeraciones cerradas; cualquier otra clave es unknown_key", {
  t <- .cme_base()
  t$blocks[[2]]$size <- "pequeno"; t$blocks[[2]]$tone <- "suave"
  t$blocks[[5]]$fill <- "contorno"; t$blocks[[5]]$size <- "grande"; t$blocks[[5]]$align <- "left"
  t$blocks[[6]]$variant <- "tinte"
  t$theme$link <- "#1a56b8"
  expect_length(.cme_codes(t), 0L)
  html <- collection_mail_render(.cmail_template_normalize(t), "mailchimp")$html
  expect_match(html, "font-size:13px;line-height:20px;color:#555555;", fixed = TRUE)
  expect_match(html, "padding:18px 60px", fixed = TRUE)
  expect_match(html, 'bgcolor="#ffffff" style="background-color:#ffffff;', fixed = TRUE)
  expect_match(html, .cmail_tint("#0b1f54"), fixed = TRUE)
  expect_identical(.cmail_tint("#0b1f54"), "#ebedf1")

  bad <- .cme_base()
  bad$blocks[[2]]$size <- "enorme"
  bad$blocks[[5]]$fill <- "degradado"
  bad$blocks[[6]]$variant <- "neon"
  bad$blocks[[2]]$color <- "red"
  bad$theme$link <- "azul"
  bad$theme$font <- "Comic"
  codes <- .cme_codes(bad)
  expect_true(all(c("bad_size", "bad_fill", "bad_variant", "unknown_key", "bad_color") %in% codes))
  expect_identical(sum(codes == "unknown_key"), 2L)
})

test_that("H-d: una sola lista de claves no textuales para used_keys y key_usage", {
  for (f in list(.cmail_used_keys, .cmail_key_usage)) {
    expect_true(any(grepl(".CMAIL_NON_TEXT_KEYS", deparse(body(f)), fixed = TRUE)))
  }
  t <- .cme_add_blocks(.cme_base(), list(.cme_image_block("linea-cierre", width = 300L, align = "center", bleed = FALSE)))
  t$blocks[[2]]$size <- "pequeno"
  t <- .cmail_template_normalize(t)
  expect_setequal(.cmail_used_keys(t), c("nombre", "carrera", "enlace"))
  usage <- .cmail_key_usage(t)
  expect_setequal(names(usage), c("nombre", "carrera", "enlace"))
})

test_that("enlace dentro del texto: válido en párrafo, uso «url», y un vacío bloquea", {
  t <- .cme_base()
  t$blocks[[4]]$text <- "Si prefieres, entra [desde aquí]({{enlace}}) o lee [las bases](https://ejemplo.org/bases?a=1&b=2)."
  t$blocks[[5]] <- NULL   # sin botón: el enlace del párrafo es el único uso de ENLACE
  t <- .cmail_template_normalize(t)
  expect_length(.cme_codes(t), 0L)
  mc <- collection_mail_render(t, "mailchimp")$html
  expect_match(mc, '<a href="*|ENLACE|*" target="_blank" style="color:#0b1f54;text-decoration:underline;">desde aquí</a>', fixed = TRUE)
  expect_match(mc, 'href="https://ejemplo.org/bases?a=1&amp;b=2"', fixed = TRUE)
  expect_true("url" %in% .cmail_key_usage(t)$enlace)

  for (where in c("subject", "greeting", "button")) {
    b <- .cme_base()
    if (where == "subject") b$subject <- "Mira [esto](https://ejemplo.org)"
    if (where == "greeting") b$blocks[[1]]$text <- "Hola [Ana](https://ejemplo.org) {{nombre}}:"
    if (where == "button") b$blocks[[5]]$text <- "[Ir](https://ejemplo.org)"
    expect_true("link_not_allowed" %in% .cme_codes(b), info = where)
  }
  b <- .cme_base(); b$blocks[[2]]$text <- "Ver [aquí](javascript:alert)"
  expect_true("bad_url" %in% .cme_codes(b))
  # Con paréntesis en la URL no hay enlace: queda como texto escapado.
  b <- .cme_base(); b$blocks[[2]]$text <- "Ver [aquí](javascript:alert(1))"
  expect_false(grepl("href=\"javascript", collection_mail_render(.cmail_template_normalize(b), "mailchimp")$html, fixed = TRUE))
  b <- .cme_base(); b$blocks[[2]]$text <- "Ver [aquí](ftp://x.org)"
  expect_true("bad_url" %in% .cme_codes(b))

  # Un vacío en ENLACE, usado solo dentro del texto, bloquea la exportación.
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  csv <- paste("Nombre,Correo,Carrera,Enlace", "Ana,ana@ejemplo.org,Socio,https://e.org/1", "Luz,luz@ejemplo.org,Eco,", sep = "\n")
  .cmail_fx_import(sid, csv = csv)
  r <- .cme_by(collection_mail_review(sid, template = t))
  expect_identical(r$fields_empty$status, "error")
  expect_true(.cme_has(r$fields_empty$targets, list(block_id = "tiempo", prop = "text")))
})

test_that("bloque image: alt obligatorio sin campos, ancho 40-600, ids sin _ y alineación cerrada", {
  ok <- .cme_add_blocks(.cme_base(), list(.cme_image_block("linea-cierre", width = 300L, align = "right", bleed = FALSE,
                                                           url = "{{enlace}}")))
  expect_length(.cme_codes(ok), 0L)
  for (case in list(
    list(alt = NULL, code = "missing_alt"), list(alt = "  ", code = "missing_alt"),
    list(alt = "Hola {{nombre}}", code = "alt_has_field"), list(width = 39L, code = "bad_width"),
    list(width = 601L, code = "bad_width"), list(width = 12.5, code = "bad_width"),
    list(image_ref = "linea_cierre", code = "bad_image_ref"), list(align = "justify", code = "bad_align"),
    list(bleed = "si", code = "bad_flag"), list(url = "javascript:x", code = "bad_url")
  )) {
    b <- .cme_image_block("linea-cierre")
    for (k in setdiff(names(case), "code")) b[k] <- list(case[[k]])
    expect_true(case$code %in% .cme_codes(.cme_add_blocks(.cme_base(), list(b))), info = case$code)
  }
  t <- .cme_base(); t$images$logo_cliente <- list(alt = "x")
  expect_true("bad_id" %in% .cme_codes(t))
})

test_that("mail_image: PNG y JPEG medidos por sus bytes; límites de subida con E_COLLECTION_MAIL_IMAGE_INVALID", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  png_meta <- .cmail_fx_mail_image(sid, "Línea Cierre.png", 1200L, 400L)
  expect_identical(png_meta$ext, "png")
  jpg_meta <- .cmail_fx_mail_image(sid, "banner-medio.png", 900L, 300L, type = "jpeg")
  expect_identical(jpg_meta$ext, "jpg")   # el nombre dice .png; los bytes, JPEG
  info <- .cmail_image_info(jpg_meta$path)
  expect_identical(info$type, "jpeg")
  expect_identical(c(info$width, info$height), c(900L, 300L))
  expect_identical(unlist(.cmail_image_info(png_meta$path)[c("width", "height")]), c(width = 1200, height = 400))

  gif <- c(charToRaw("GIF89a"), as.raw(rep(0, 20)))
  e <- .cme_err(save_upload(sid, "mail_image", "x.gif", gif))
  expect_identical(e$code, "E_COLLECTION_MAIL_IMAGE_INVALID"); expect_equal(e$status, 422)
  expect_identical(e$details$reason, "format")
  expect_identical(.cme_err(.cmail_fx_mail_image(sid, "ancha.png", 1300L, 100L))$details$reason, "width")
  expect_identical(.cme_err(.cmail_fx_mail_image(sid, "angosta.png", 30L, 30L))$details$reason, "width")
  expect_identical(.cme_err(.cmail_fx_mail_image(sid, "pesada.png", 1200L, 400L, noise = TRUE))$details$reason, "too_large")
  expect_identical(.cme_err(.cmail_fx_mail_image(sid, "___.png", 100L, 100L))$details$reason, "name")
  # Nada rechazado quedó registrado.
  kinds <- vapply(session_get(sid)$files, `[[`, "", "kind")
  expect_identical(sum(kinds == "mail_image"), 2L)
})

test_that("resolución: mail_image gana a brand_logo del mismo slug; preview con data URI del tipo real", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  .cmail_fx_mail_image(sid, "pulso.jpg", 400L, 116L, type = "jpeg")
  t <- .cme_base()
  imgs <- .cmail_images_resolve(session_get(sid), t)
  expect_identical(imgs$pulso$type, "jpeg")
  expect_identical(imgs$pulso$export_name, "pulso.jpg")
  expect_identical(imgs$`logo-cliente`$type, "png")
  pv <- collection_mail_render(t, "preview", values = .cmail_synthetic_values(t), images = imgs)$html
  expect_match(pv, "data:image/jpeg;base64,", fixed = TRUE)
  expect_match(pv, "data:image/png;base64,", fixed = TRUE)
  mc <- collection_mail_render(t, "mailchimp", images = imgs)$html
  expect_match(mc, 'src="pulso.jpg"', fixed = TRUE)
  expect_false(grepl("IMAGEN_", mc, fixed = TRUE))
})

test_that("las imágenes de correo viajan en el .pulso (el vigente de cada slug)", {
  skip_if_not_installed("zip")
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  .cmail_fx_mail_image(sid, "linea-cierre.png", 1200L, 400L)
  tmp <- tempfile(fileext = ".pulso"); on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(sid, tmp, project_name = "Imagenes")
  loaded <- load_pulso(tmp); on.exit(session_delete(loaded$session_id), add = TRUE)
  t <- .cme_add_blocks(.cme_base(), list(.cme_image_block("linea-cierre")))
  imgs <- .cmail_images_resolve(session_get(loaded$session_id), t)
  expect_false(is.null(imgs$`linea-cierre`$path))
  expect_true(file.exists(imgs$`linea-cierre`$path))
})

test_that("chequeos: targets, image_width, accent_contrast con umbrales 4,5 y 3", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  .cmail_fx_mail_image(sid, "medio.png", 400L, 200L)
  t <- .cme_add_blocks(.cme_base(), list(.cme_image_block("medio", width = 300L)))
  t$images$pulso$alt <- ""
  r <- .cme_by(collection_mail_review(sid, template = .cmail_template_normalize(t)))
  expect_identical(r$image_width$status, "warning")
  expect_identical(r$image_width$targets, list(list(block_id = "img-medio", prop = "width")))
  expect_identical(r$images_alt$status, "error")
  expect_true(.cme_has(r$images_alt$targets, list(block_id = "__cabecera")))
  expect_identical(r$accent_contrast$status, "ok")

  for (case in list(c("#ffcc00", "error"), c("#3a7bd5", "warning"), c("#0b1f54", "ok"))) {
    tt <- .cme_base(); tt$theme$accent <- case[[1]]
    a <- .cmail_accent_check(tt)
    expect_identical(a$status, case[[2]], info = case[[1]])
    if (case[[2]] != "ok") expect_setequal(vapply(a$targets, `[[`, "", "block_id"), c("__cabecera", "accion"))
  }
  # Sin botón sólido ni cabecera oscura no hay texto blanco sobre el acento.
  tt <- .cme_base(); tt$theme$accent <- "#ffcc00"; tt$header$background <- "light"; tt$blocks[[5]]$fill <- "contorno"
  expect_identical(.cmail_accent_check(tt)$status, "ok")
  expect_lt(abs(.cmail_contrast("#ffffff", "#000000") - 21), 1e-9)
})

test_that("import_zip_weight: aviso sobre 800 KB, error desde 1 MB; las imágenes con URL no cuentan", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  ids <- character(0)
  for (i in 1:3) {
    m <- .cmail_fx_mail_image(sid, sprintf("ruido-%d.png", i), 420L, 220L, noise = TRUE)
    ids <- c(ids, sprintf("ruido-%d", i))
  }
  sizes <- vapply(ids, function(id) as.numeric(file.info(.cmail_image_latest(session_get(sid)$files)[[id]]$path)$size), 0)
  t <- .cme_add_blocks(.cme_base(), lapply(ids, function(id) .cme_image_block(id)))
  r <- .cme_by(collection_mail_review(sid, template = .cmail_template_normalize(t)))
  total <- r$import_zip_weight$value
  expected <- if (total >= 1024 * 1024) "error" else if (total > 800 * 1024) "warning" else "ok"
  expect_identical(r$import_zip_weight$status, expected)
  expect_gt(total, sum(sizes))
  # Con URL https, esa imagen sale del ZIP.
  t2 <- t
  for (id in ids) t2$images[[id]] <- list(alt = "x", url = sprintf("https://cdn.ejemplo.org/%s.png", id))
  r2 <- .cme_by(collection_mail_review(sid, template = .cmail_template_normalize(t2)))
  expect_lt(r2$import_zip_weight$value, total - sum(sizes) + 1024)
  expect_identical(r2$import_zip_weight$status, "ok")
  # Umbrales directos: el chequeo lee el estimador (HTML + imágenes que entran).
  expect_identical(.cmail_import_zip_estimate(900 * 1024, list())$bytes, as.integer(900 * 1024))
  push_one <- function(bytes) {
    out <- NULL
    .cmail_image_checks(.cme_base(), list(), "", bytes, function(x) if (identical(x$code, "import_zip_weight")) out <<- x)
    out$status
  }
  expect_identical(push_one(700L * 1024L), "ok")
  expect_identical(push_one(900L * 1024L), "warning")
  expect_identical(push_one(1024L * 1024L), "error")
})

test_that("export completo: ZIP importable anidado, un HTML, src relativos o https, sin marcas ni IMAGEN_", {
  skip_if_not_installed("zip")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  .cmail_fx_mail_image(sid, "linea-cierre.jpg", 1200L, 400L, type = "jpeg")
  .cmail_fx_mail_image(sid, "banner-medio.png", 1200L, 300L)
  t <- .cme_add_blocks(.cme_base(), list(.cme_image_block("banner-medio", bleed = TRUE)), at = 4L)
  t$blocks <- append(t$blocks, list(.cme_image_block("linea-cierre", bleed = TRUE)), after = length(t$blocks) - 2L)
  t$images$pulso$url <- "https://cdn.ejemplo.org/pulso.png"
  a <- collection_mail_campaign_create(sid, 0L, name = "Cierre con imágenes")
  put <- collection_mail_template_put(sid, t, a$state_revision, campaign_id = "cierre-con-imagenes")
  .cmail_fx_import(sid)
  res <- collection_mail_export(sid, put$state_revision)
  expect_identical(res$scope, "completo")
  expect_setequal(unlist(res$import_zip$entries),
                  c("cierre-con-imagenes.html", "logo-cliente.png", "banner-medio.png", "linea-cierre.jpg"))
  expect_identical(vapply(res$artifacts, `[[`, "", "role"), c("deliverable", "manifest"))

  outer <- session_get(sid)$files[[res$zip$file_id]]$path
  ex <- tempfile("cme-"); on.exit(unlink(ex, recursive = TRUE), add = TRUE)
  utils::unzip(outer, exdir = ex)
  expect_setequal(list.files(ex), c("plantilla-mailchimp.zip", "audiencia.csv", "LEEME.txt", "manifest.json"))
  imp <- file.path(ex, "plantilla-mailchimp.zip")
  v <- .cmail_import_zip_verify(imp)
  expect_true(v$ok, info = paste(unlist(v$problems), collapse = "; "))
  expect_lt(v$size_bytes, 1024L * 1024L)
  listing <- zip::zip_list(imp)$filename
  expect_identical(sum(grepl("\\.html$", listing)), 1L)
  expect_false(any(grepl("/", listing, fixed = TRUE)))
  expect_true(all(grepl("^[a-z0-9][a-z0-9-]*\\.(html|png|jpg)$", listing)))
  utils::unzip(imp, exdir = file.path(ex, "imp"))
  html <- paste(readLines(file.path(ex, "imp", "cierre-con-imagenes.html"), warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  srcs <- sub('^src="(.*)"$', "\\1", regmatches(html, gregexpr('src="[^"]*"', html))[[1]])
  expect_setequal(srcs, c("logo-cliente.png", "https://cdn.ejemplo.org/pulso.png", "banner-medio.png", "linea-cierre.jpg"))
  expect_false(grepl("data-pulso|data:|IMAGEN_", html))
  # El importable no trae datos personales.
  for (f in list.files(file.path(ex, "imp"), full.names = TRUE)) {
    expect_false(grepl("ejemplo.org/e/|ana.quispe|QUISPE", rawToChar(readBin(f, "raw", file.info(f)$size)[readBin(f, "raw", file.info(f)$size) != as.raw(0)]), useBytes = TRUE))
  }
  man <- jsonlite::fromJSON(file.path(ex, "manifest.json"), simplifyVector = FALSE)
  expect_identical(man$scope, "completo")
  expect_identical(man$import_zip$html, "cierre-con-imagenes.html")
  expect_true(any(vapply(man$images, function(i) identical(i$hosted_url, "https://cdn.ejemplo.org/pulso.png"), NA)))
  leeme <- readLines(file.path(ex, "LEEME.txt"), warn = FALSE, encoding = "UTF-8")
  expect_true(any(grepl("Import ZIP", leeme, fixed = TRUE)))
  expect_false(any(grepl("IMAGEN_", leeme, fixed = TRUE)))
})

test_that("export scope plantilla: sin audiencia ni chequeos de audiencia; el entregable es el ZIP importable", {
  skip_if_not_installed("zip")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  rv <- collection_mail_review(sid, scope = "plantilla")
  expect_identical(rv$scope, "plantilla")
  expect_false("recipients" %in% names(.cme_by(rv)))
  expect_true(rv$ready)
  res <- collection_mail_export(sid, 0L, scope = "plantilla")
  expect_identical(res$scope, "plantilla")
  expect_match(res$zip$filename, "^correo-1_invitacion_plantilla-mailchimp_\\d{8}-\\d{6}\\.zip$")
  expect_identical(res$zip$sensitivity, "none")
  expect_identical(vapply(res$artifacts, `[[`, "", "role"), c("deliverable", "manifest"))
  path <- session_get(sid)$files[[res$zip$file_id]]$path
  expect_true(.cmail_import_zip_verify(path)$ok)
  expect_setequal(zip::zip_list(path)$filename, c("correo-1.html", "logo-cliente.png", "pulso.png"))
  expect_null(res$manifest$recipients)
  expect_identical(.cme_code(collection_mail_export(sid, 0L, scope = "otro")), "E_COLLECTION_MAIL_MODE")
})

test_that("export: un ZIP importable de 1 MB o más se rechaza con E_COLLECTION_MAIL_IMPORT_ZIP_TOO_LARGE", {
  skip_if_not_installed("zip")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  # Peso con bytes incompresibles (el HTML de texto comprime).
  raw <- .cmail_fx_image_raw(700L, 700L, noise = TRUE)
  p <- tempfile(fileext = ".png"); writeBin(raw, p)
  big <- list(a = list(id = "a", path = p, url = NULL, export_name = "a.png"),
              b = list(id = "b", path = p, url = NULL, export_name = "b.png"))
  e <- .cme_err(.cmail_import_zip_build(tempfile("cme-big2-"), '<html><img src="a.png"><img src="b.png"></html>', big, "c.html"))
  expect_identical(e$code, "E_COLLECTION_MAIL_IMPORT_ZIP_TOO_LARGE")
  expect_equal(e$status, 413)
})

test_that("crear la primera campaña purga los destinatarios de la virtual correo-1 y lo dice", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  .cmail_fx_import(sid)
  expect_true(file.exists(.cmail_recipients_path(session_get(sid), "correo-1")))
  a <- collection_mail_campaign_create(sid, 0L, name = "Invitación")
  expect_true(a$recipients_purged_virtual)
  expect_false(dir.exists(.cmail_recipients_dir(session_get(sid), "correo-1")))
  expect_false(collection_mail_recipients_get(sid)$loaded)
  b <- collection_mail_campaign_create(sid, a$state_revision, name = "Otra")
  expect_false(b$recipients_purged_virtual)
})

test_that("HTTP: review y export aceptan scope con el serializador de producción", {
  testthat::skip_if_not_installed("plumber")
  skip_if_not_installed("zip")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  rv <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-template/review", .cmail_fx_json(list(scope = "plantilla")))
  expect_identical(rv$status, 200L, info = substr(rv$raw, 1, 500))
  expect_identical(rv$body$scope, "plantilla")
  codes <- vapply(rv$body$checks, function(c) c$code, "")
  expect_true(all(c("import_zip_weight", "accent_contrast", "images_hosted") %in% codes))
  ex <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-template/export",
                       .cmail_fx_json(list(expected_revision = 0L, scope = "plantilla")))
  expect_identical(ex$status, 200L, info = substr(ex$raw, 1, 500))
  expect_identical(ex$body$scope, "plantilla")
  expect_identical(unlist(ex$body$import_zip$html), "correo-1.html")
})
