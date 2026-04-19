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
    plumber::pr_post("/api/files/upload", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      parts <- parse_multipart_upload(req)
      if (is.null(parts$file)) stop_api(400, "E_NO_FILE_FIELD", "Missing 'file' field in multipart body")
      if (is.null(parts$kind)) stop_api(400, "E_NO_KIND_FIELD", "Missing 'kind' field in multipart body")
      kind <- as.character(parts$kind)
      file_part <- parts$file
      original <- file_part$filename %||% "upload.bin"
      meta <- save_upload(sid, kind, original, file_part$value)
      res$status <- 201
      meta
    })) |>
    plumber::pr_get("/api/files/<file_id>/download", wrap_endpoint(function(req, res, file_id) {
      sid <- session_header(req)
      meta <- get_file(sid, file_id)
      plumber::include_file(meta$path, res, content_type = mime::guess_type(meta$path))
    }))
}
