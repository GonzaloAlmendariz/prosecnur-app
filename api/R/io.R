allowed_upload_kinds <- c("xlsform", "data", "sav", "sav_bundle", "plan_limpieza",
                          "plantilla_codif", "universo_muestra", "graficos_share",
                          "monitoreo_operational_package", "monitoreo_reference_drift",
                          "plan_trabajo", "equivalencias", "brand_logo",
                          # Imágenes de línea gráfica del correo (ADR 0110 §B):
                          # PNG o JPEG, validadas por sus bytes al subir.
                          "mail_image",
                          # El libro de aulas se sube por aqui y NO por su propio
                          # endpoint: `importar-libro` con `parsers = multi` recibia
                          # el archivo pero plumber moria al parsear el xlsx de
                          # dentro, y añadir `octet` hacia que dejara de llegar.
                          # Esta ruta ya sabe guardar binarios y devuelve un
                          # `file_id`, que es lo que el endpoint acepta.
                          "aulas_libro",
                          # B74 (dictado 2026-09-03): el excel de disponibilidad
                          # de aplicadores entra por la app — misma via de dos
                          # pasos que el libro (upload aqui, import por file_id).
                          "aulas_disponibilidad",
                          # El excel de matriculados del que sale el padron que
                          # traduce un codigo de alumno a su nivel. Misma via de
                          # dos pasos. Ojo: el archivo ORIGINAL trae PII (nombre,
                          # correo, codigo) y por eso no se guarda dentro del
                          # `.pulso` — de el solo se deriva la tabla minima, que
                          # se purga al exportar (monitoreo_aulas_padron_purga.R).
                          "aulas_padron")

ext_for_kind <- function(kind, original_name) {
  name <- trimws(as.character(original_name %||% ""))
  # macOS/Finder and some download flows can leave duplicated files as
  # "archivo.sav 2". It is still an SPSS file, but tools::file_ext()
  # returns "2", which later makes the data reader reject it.
  if (identical(kind, "sav") || grepl("\\.sav(?:\\s+\\d+)?$", name, ignore.case = TRUE)) {
    return("sav")
  }
  if (identical(kind, "sav_bundle") || identical(kind, "graficos_share") ||
      grepl("\\.zip$", name, ignore.case = TRUE)) {
    return("zip")
  }
  ext <- tolower(tools::file_ext(name))
  if (!nzchar(ext)) {
    ext <- switch(kind,
      xlsform = "xlsx", data = "xlsx", sav = "sav", sav_bundle = "zip",
      plan_limpieza = "xlsx", plantilla_codif = "xlsx",
      universo_muestra = "xlsx", graficos_share = "zip", brand_logo = "png", mail_image = "png",
      monitoreo_operational_package = "csv",
      monitoreo_reference_drift = "csv",
      plan_trabajo = "xlsx", "bin"
    )
  }
  ext
}

save_upload <- function(sid, kind, original_name, raw_bytes) {
  if (!(kind %in% allowed_upload_kinds)) {
    stop_api(400, "E_INVALID_KIND",
             sprintf("kind must be one of: %s", paste(allowed_upload_kinds, collapse = ", ")))
  }
  s <- session_get(sid)
  file_id <- uuid::UUIDgenerate()
  ext <- ext_for_kind(kind, original_name)
  # La imagen del correo se valida por sus bytes (tipo, peso, ancho) y guarda
  # la extensión real: el nombre «foto.png» de un JPEG no decide nada.
  if (identical(kind, "mail_image")) ext <- .cmail_image_upload_check(original_name, raw_bytes)$ext
  fname <- sprintf("%s.%s", file_id, ext)
  fpath <- file.path(s$dir, "uploads", fname)
  writeBin(raw_bytes, fpath)
  meta <- list(
    file_id = file_id, kind = kind, original_name = original_name,
    path = fpath, size = length(raw_bytes), ext = ext,
    uploaded_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  )
  files <- s$files
  files[[file_id]] <- meta
  session_set(sid, "files", files)
  meta
}

get_file <- function(sid, file_id) {
  s <- session_get(sid)
  meta <- s$files[[file_id]]
  if (is.null(meta)) stop_api(404, "E_NO_FILE", sprintf("file_id %s not found", file_id))
  meta
}

# webutils::parse_multipart recibe el boundary, no el Content-Type: llamarlo
# con `content_type =` fallaba siempre, y los dos respaldos que lo usaban
# nunca llegaron a funcionar (encontrado el 2026-09-24).
.multipart_boundary <- function(ctype) {
  b <- sub('.*boundary="?([^";]+)"?.*', "\\1", ctype)
  if (identical(b, ctype)) "" else b
}

parse_multipart_upload <- function(req) {
  body <- req$bodyRaw
  ctype <- req$HTTP_CONTENT_TYPE %||% req$CONTENT_TYPE %||% ""
  if (!grepl("multipart/form-data", ctype, fixed = TRUE)) {
    stop_api(400, "E_NOT_MULTIPART", "Expected multipart/form-data body")
  }
  webutils::parse_multipart(body, .multipart_boundary(ctype))
}

# Multipart text fields arrive inconsistently in plumber (as character, list, or
# empty list) depending on the client's Content-Type. This helper normalizes them
# by first reading the auto-parsed value and, if empty, re-parsing the raw body.
.extract_text_field <- function(value, req, field_name) {
  if (is.character(value) && length(value) >= 1 && nzchar(value[[1]])) return(as.character(value[[1]]))
  if (is.raw(value)) return(rawToChar(value))
  if (is.list(value) && length(value) > 0) {
    v <- value[[1]]
    if (is.character(v) && length(v) >= 1) return(as.character(v[[1]]))
    if (is.raw(v)) return(rawToChar(v))
  }
  body <- req$bodyRaw
  ctype <- req$HTTP_CONTENT_TYPE %||% req$CONTENT_TYPE %||% ""
  if (!grepl("multipart/form-data", ctype, fixed = TRUE) || is.null(body)) return("")
  parts <- tryCatch(webutils::parse_multipart(body, .multipart_boundary(ctype)), error = function(e) NULL)
  raw_val <- parts[[field_name]]
  if (is.null(raw_val)) return("")
  if (is.raw(raw_val)) return(rawToChar(raw_val))
  if (is.list(raw_val) && is.raw(raw_val$value)) return(rawToChar(raw_val$value))
  if (is.character(raw_val)) return(as.character(raw_val[[1]]))
  ""
}

# Filas máximas de una hoja de Excel (xlsx y xls >= 2007). Se usa como
# `guess_max` para que readxl adivine el tipo mirando la hoja ENTERA.
.EXCEL_MAX_ROWS <- 1048576L

# Lectura de Excel con inferencia de tipo sobre la hoja completa.
#
# `readxl::read_excel` adivina el tipo de cada columna con las primeras 1000
# filas (`guess_max` por defecto). Una columna vacía en esas filas sale
# `logical` y todo valor posterior se convierte en NA —un texto «Otro» se
# pierde, un 7 disperso se vuelve TRUE—, sin más rastro que un warning que los
# llamadores suelen silenciar. Con `guess_max` igual al tope de filas de Excel
# la adivinanza recorre la hoja completa; por debajo de `.Machine$integer.max
# %/% 100` readxl no avisa. Todo lo demás (sheet, col_names, na, col_types,
# .name_repair…) pasa tal cual.
#
# Para toda lectura donde readxl INFIERE el tipo (datos de respuestas, y también
# hojas de XLSForm leídas sin tipos fijos). No aporta nada donde se fija col_types.
.read_excel_data <- function(path, sheet = NULL, ..., guess_max = .EXCEL_MAX_ROWS) {
  readxl::read_excel(path, sheet = sheet, ..., guess_max = guess_max)
}
