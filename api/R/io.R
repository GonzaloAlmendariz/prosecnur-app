allowed_upload_kinds <- c("xlsform", "data", "sav", "plan_limpieza", "plantilla_codif")

ext_for_kind <- function(kind, original_name) {
  name <- trimws(as.character(original_name %||% ""))
  # macOS/Finder and some download flows can leave duplicated files as
  # "archivo.sav 2". It is still an SPSS file, but tools::file_ext()
  # returns "2", which later makes the data reader reject it.
  if (identical(kind, "sav") || grepl("\\.sav(?:\\s+\\d+)?$", name, ignore.case = TRUE)) {
    return("sav")
  }
  ext <- tolower(tools::file_ext(name))
  if (!nzchar(ext)) {
    ext <- switch(kind,
      xlsform = "xlsx", data = "xlsx", sav = "sav",
      plan_limpieza = "xlsx", plantilla_codif = "xlsx", "bin"
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

parse_multipart_upload <- function(req) {
  body <- req$bodyRaw
  ctype <- req$HTTP_CONTENT_TYPE %||% req$CONTENT_TYPE %||% ""
  if (!grepl("multipart/form-data", ctype, fixed = TRUE)) {
    stop_api(400, "E_NOT_MULTIPART", "Expected multipart/form-data body")
  }
  parsed <- webutils::parse_multipart(body, content_type = ctype)
  parsed
}

`%||%` <- function(a, b) if (is.null(a)) b else a

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
  parts <- tryCatch(webutils::parse_multipart(body, content_type = ctype), error = function(e) NULL)
  raw_val <- parts[[field_name]]
  if (is.null(raw_val)) return("")
  if (is.raw(raw_val)) return(rawToChar(raw_val))
  if (is.list(raw_val) && is.raw(raw_val$value)) return(rawToChar(raw_val$value))
  if (is.character(raw_val)) return(as.character(raw_val[[1]]))
  ""
}
