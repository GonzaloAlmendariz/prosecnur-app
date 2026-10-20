# Fixtures SINTÉTICOS para los correos de Material de campo (ADR 0110 §2).
# Ningún dato sale de un estudio real: nombres, correos y carreras inventados.

.cmail_fx_recipients_csv <- function() {
  paste(
    "N°,Código,Apellidos y nombres,Correo institucional,Carrera,Enlace",
    "1,20260001,\"QUISPE MAMANI, ANA LUCIA\",ana.quispe@ejemplo.org,Sociología,https://ejemplo.org/e/1",
    "2,20260002,\"ROJAS VEGA, CARLOS\",carlos.rojas@ejemplo.org,,https://ejemplo.org/e/2",
    "3,20260003,LUZ TORRES,luz.torres@ejemplo.org,Antropología,https://ejemplo.org/e/3",
    "4,20260004,\"PAREDES, MARIA\",correo-invalido,Economía,https://ejemplo.org/e/4",
    "5,20260005,\"QUISPE MAMANI, ANA LUCIA\",ana.quispe@ejemplo.org,Sociología,https://ejemplo.org/e/1",
    sep = "\n"
  )
}

.cmail_fx_import <- function(sid, csv = .cmail_fx_recipients_csv(), mapping = NULL) {
  collection_mail_recipients_import(
    sid, file_name = "destinatarios.csv",
    content_base64 = jsonlite::base64_enc(charToRaw(enc2utf8(csv))),
    mapping = mapping
  )
}

# Logo PNG sintético registrado como brand_logo del proyecto.
.cmail_fx_logo <- function(sid, name, width = 160L, height = 46L) {
  s <- session_get(sid)
  path <- file.path(s$dir, "uploads", paste0(uuid::UUIDgenerate(), ".png"))
  img <- array(0.2, dim = c(height, width, 3))
  png::writePNG(img, path)
  files <- s$files
  id <- uuid::UUIDgenerate()
  files[[id]] <- list(file_id = id, kind = "brand_logo", original_name = name, path = path,
                      size = as.integer(file.info(path)$size), ext = "png")
  session_set(sid, "files", files)
  invisible(path)
}

.cmail_fx_session <- function(logos = TRUE) {
  sid <- session_create()
  if (logos) {
    .cmail_fx_logo(sid, "logo-cliente.png")
    .cmail_fx_logo(sid, "pulso.png")
  }
  sid
}

.cmail_fx_call <- function(pr, sid, method, path, body = "") {
  raw_body <- charToRaw(enc2utf8(body))
  input <- list(read = function(...) raw_body, rewind = function() invisible(0), read_lines = function(...) body)
  req <- as.environment(list(
    REQUEST_METHOD = method, PATH_INFO = path, QUERY_STRING = "",
    CONTENT_TYPE = "application/json",
    HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid), rook.input = input
  ))
  r <- pr$call(req)
  list(status = as.integer(r$status), raw = as.character(r$body),
       body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

.cmail_fx_json <- function(x) {
  as.character(jsonlite::toJSON(x, auto_unbox = TRUE, null = "null", na = "null", digits = NA))
}

# Revisión vigente del estado de Recopiladores (el export la exige: M1).
.cmail_fx_rev <- function(sid) collection_mail_template_get(sid)$state_revision

# Importa bytes crudos (para probar codificaciones).
.cmail_fx_import_raw <- function(sid, raw, file_name = "destinatarios.csv", mapping = NULL) {
  collection_mail_recipients_import(sid, file_raw = raw, file_name = file_name, mapping = mapping)
}

# Llamada HTTP real con un cuerpo crudo y su Content-Type (multipart incluido).
.cmail_fx_call_raw <- function(pr, sid, method, path, raw_body, content_type) {
  input <- list(read = function(...) raw_body, rewind = function() invisible(0),
                read_lines = function(...) rawToChar(raw_body))
  req <- as.environment(list(
    REQUEST_METHOD = method, PATH_INFO = path, QUERY_STRING = "",
    CONTENT_TYPE = content_type, HTTP_CONTENT_TYPE = content_type,
    HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid, `content-type` = content_type),
    rook.input = input
  ))
  r <- pr$call(req)
  list(status = as.integer(r$status), raw = as.character(r$body),
       body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

.cmail_fx_multipart <- function(boundary, file_raw, file_name, file_type, mapping_json = NULL) {
  c(
    charToRaw(paste0("--", boundary, "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"", file_name,
                     "\"\r\nContent-Type: ", file_type, "\r\n\r\n")),
    file_raw,
    charToRaw("\r\n"),
    if (!is.null(mapping_json)) charToRaw(enc2utf8(paste0(
      "--", boundary, "\r\nContent-Disposition: form-data; name=\"mapping\"\r\n\r\n", mapping_json, "\r\n"
    ))),
    charToRaw(paste0("--", boundary, "--\r\n"))
  )
}

# Logo con fecha de subida explícita (para «el más reciente gana»).
.cmail_fx_logo_at <- function(sid, name, uploaded_at, width = 160L, height = 46L) {
  path <- .cmail_fx_logo(sid, name, width = width, height = height)
  files <- session_get(sid)$files
  id <- names(files)[vapply(files, function(f) identical(f$path, path), NA)]
  files[[id]]$uploaded_at <- uploaded_at
  session_set(sid, "files", files)
  invisible(list(file_id = id, path = path))
}

# HTML de preview sin los <span data-pulso-field> que tiñen los valores (E1g):
# para buscar frases como las ve el lector.
.cmail_fx_unmark <- function(html) gsub('<span data-pulso-field="[^"]*" style="[^"]*">([^<]*)</span>', "\\1", html)

# Bytes de una imagen sintética (PNG o JPEG). `noise` la vuelve incompresible
# (para probar pesos).
.cmail_fx_image_raw <- function(width, height, type = c("png", "jpeg"), noise = FALSE) {
  type <- match.arg(type)
  img <- if (noise) array(stats::runif(height * width * 3), dim = c(height, width, 3)) else {
    a <- array(0.85, dim = c(height, width, 3)); a[, , 3] <- 0.35; a
  }
  tmp <- tempfile(fileext = paste0(".", type)); on.exit(unlink(tmp), add = TRUE)
  if (identical(type, "png")) png::writePNG(img, tmp) else jpeg::writeJPEG(img, tmp, quality = 0.95)
  readBin(tmp, "raw", file.info(tmp)$size)
}

# Sube una imagen de correo por la vía real (save_upload con kind mail_image).
.cmail_fx_mail_image <- function(sid, name, width = 600L, height = 200L, type = "png", noise = FALSE) {
  save_upload(sid, "mail_image", name, .cmail_fx_image_raw(width, height, type, noise))
}

# ---- E1j: paridad del dialecto mailchimp (huellas en fixtures/mail-import) ----
# Casos sintéticos cuyo HTML de Mailchimp se capturó ANTES de introducir el
# dialecto (commit bff880635). Las imágenes van resueltas a mano: sin archivos.
.cmail_fx_parity_images <- function() {
  list(
    `logo-cliente` = list(id = "logo-cliente", path = NULL, type = "png", size = list(width = 320L, height = 92L),
                          url = NULL, alt = "Unidad", export_name = "logo-cliente.png"),
    pulso = list(id = "pulso", path = NULL, type = "png", size = list(width = 300L, height = 92L),
                 url = "https://pulsopucp.github.io/correo-/pulso.png", alt = "Pulso PUCP", export_name = "pulso.png"),
    `linea-cierre` = list(id = "linea-cierre", path = NULL, type = "jpeg", size = list(width = 1200L, height = 400L),
                          url = NULL, alt = "", export_name = "linea-cierre.jpg"),
    banner = list(id = "banner", path = NULL, type = "png", size = list(width = 1200L, height = 600L),
                  url = "https://pulsopucp.github.io/correo-/Arte1-960.png", alt = "PULSO", export_name = "banner.png")
  )
}
.cmail_fx_parity_cases <- function() {
  rec <- .cmail_template_normalize(.cmail_preset_recuperacion())
  inv <- .cmail_template_normalize(.cmail_preset_invitacion())
  full <- rec
  full$theme$link <- "#1a56b8"
  full$blocks <- append(full$blocks, list(
    list(block_id = "titulo", type = "heading", text = "Hola {{carrera}}", level = "subtitulo", align = "center"),
    list(block_id = "sep", type = "divider", style = "linea", size = "l"),
    list(block_id = "esp", type = "divider", style = "espacio", size = "s"),
    list(block_id = "img-cierre", type = "image", image_ref = "linea-cierre", alt = "Gracias", width = 300L,
         align = "right", url = "{{enlace}}"),
    list(block_id = "img-sangre", type = "image", image_ref = "linea-cierre", alt = "Cierre", bleed = TRUE),
    list(block_id = "lista", type = "list", ordered = TRUE, items = list("Uno [web](https://pulso.pucp.edu.pe/)", "Dos **{{codigo}}**")),
    list(block_id = "tinte", type = "callout", variant = "tinte", title = "Nota", items = list("A", "B"))
  ), after = 2L)
  full$blocks[[2]]$text <- paste(full$blocks[[2]]$text, "Ver [la web](https://pulso.pucp.edu.pe/?a={{codigo}}).")
  full$blocks[[2]]$size <- "pequeno"; full$blocks[[2]]$tone <- "suave"
  full <- .cmail_template_normalize(full)
  ban <- inv
  ban$header <- list(kind = "banner", image_ref = "banner")
  ban$images <- list(banner = list(alt = "PULSO", url = "https://pulsopucp.github.io/correo-/Arte1-960.png"))
  ban$blocks[[8]]$fill <- "contorno"; ban$blocks[[8]]$size <- "compacto"; ban$blocks[[8]]$align <- "left"
  ban <- .cmail_template_normalize(ban)
  list(recuperacion = list(t = rec, images = list()),
       invitacion = list(t = inv, images = list()),
       recuperacion_img = list(t = rec, images = .cmail_fx_parity_images()),
       completo = list(t = full, images = .cmail_fx_parity_images()),
       banner = list(t = ban, images = .cmail_fx_parity_images()["banner"]))
}

.cmail_fx_sha <- function(x) paste0("sha256:", digest::digest(x, algo = "sha256", serialize = FALSE))

.cmail_fx_mail_import_path <- function(name) test_path("fixtures", "mail-import", name)

.cmail_fx_read_text <- function(path) {
  txt <- rawToChar(readBin(path, "raw", file.info(path)$size))
  Encoding(txt) <- "UTF-8"
  txt
}
