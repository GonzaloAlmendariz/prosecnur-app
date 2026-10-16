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
