.shutdown_flag <- new.env(parent = emptyenv())
.shutdown_flag$value <- FALSE

shutdown_requested <- function() isTRUE(.shutdown_flag$value)

mount_sistema <- function(pr) {
  pr |>
    plumber::pr_get("/api/system/health", wrap_endpoint(function(req, res) {
      list(
        ok = TRUE,
        version = as.character(utils::packageVersion("prosecnurapp")),
        prosecnur_version = as.character(utils::packageVersion("prosecnur")),
        time = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
      )
    })) |>
    plumber::pr_post("/api/system/shutdown", wrap_endpoint(function(req, res) {
      .shutdown_flag$value <- TRUE
      list(ok = TRUE, message = "Shutdown requested")
    })) |>
    plumber::pr_post("/api/session", wrap_endpoint(function(req, res) {
      existing <- session_header(req)
      if (!is.null(existing) && !is.null(session_get(existing, required = FALSE))) {
        return(list(session_id = existing, reused = TRUE))
      }
      sid <- session_create()
      res$setHeader("X-Pulso-Session", sid)
      list(session_id = sid, reused = FALSE)
    })) |>
    plumber::pr_delete("/api/session", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      ok <- session_delete(sid)
      list(ok = ok)
    })) |>
    plumber::pr_get("/api/session/state", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid, required = FALSE)
      if (is.null(s)) {
        res$status <- 404
        return(list(error = list(code = "E_NO_SESSION", message = "Session not found")))
      }
      files_by_kind <- split(
        unname(s$files),
        vapply(s$files, function(f) f$kind, character(1))
      )
      list(
        session_id = s$id,
        created_at = format(s$created_at, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
        xlsform = !is.null(files_by_kind$xlsform) && length(files_by_kind$xlsform) > 0,
        data = (!is.null(files_by_kind$data) || !is.null(files_by_kind$sav)),
        instrumento_parsed = !is.null(s$instrumento),
        data_previewed = !is.null(s$data_raw_meta),
        plan_built = !is.null(s$plan_result),
        auditoria_run = !is.null(s$evaluacion)
      )
    })) |>
    plumber::pr_post("/api/files/upload", wrap_endpoint(function(req, res, file = NULL, kind = NULL) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      if (is.null(file)) stop_api(400, "E_NO_FILE_FIELD", "Missing 'file' field in multipart body")

      extracted <- if (is.raw(file)) {
        list(bytes = file, original = "upload.bin")
      } else if (is.list(file) && length(file) >= 1 && is.raw(file[[1]])) {
        list(bytes = file[[1]], original = names(file)[1] %||% "upload.bin")
      } else if (is.list(file) && is.raw(file$value)) {
        list(bytes = file$value, original = file$filename %||% "upload.bin")
      } else {
        stop_api(400, "E_BAD_FILE", "Could not extract file bytes from multipart payload")
      }

      kind_str <- if (is.character(kind) && length(kind) >= 1 && nzchar(kind[[1]])) {
        as.character(kind[[1]])
      } else {
        q <- req$args %||% list()
        as.character(q$kind %||% req$QUERY_STRING %||% "")
      }
      if (!nzchar(kind_str)) {
        stop_api(400, "E_NO_KIND_FIELD",
          "Missing 'kind'. Pass it as query param (?kind=xlsform) or form field with Content-Type: text/plain.")
      }
      meta <- save_upload(sid, kind_str, extracted$original, extracted$bytes)
      res$status <- 201
      meta
    })) |>
    plumber::pr_get("/api/files/<file_id>/download", wrap_endpoint(function(req, res, file_id) {
      sid <- session_header(req)
      meta <- get_file(sid, file_id)
      plumber::include_file(meta$path, res, content_type = mime::guess_type(meta$path))
    }))
}
