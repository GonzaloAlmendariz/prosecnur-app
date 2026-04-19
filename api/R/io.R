allowed_upload_kinds <- c("xlsform", "data", "sav", "plan_limpieza", "plantilla_codif")

ext_for_kind <- function(kind, original_name) {
  ext <- tolower(tools::file_ext(original_name))
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
