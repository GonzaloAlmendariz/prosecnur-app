# Router del plan que vincula revisiones publicadas con futuras bases hermanas.

.processing_intake_parse_body <- function(req) {
  body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "{}")
  Encoding(body_raw) <- "UTF-8"
  if (!nzchar(trimws(body_raw))) body_raw <- "{}"
  tryCatch(
    jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
  )
}

mount_processing_intake <- function(pr) {
  pr |>
    plumber::pr_get("/api/carga/processing-intake", wrap_endpoint(function(req, res) {
      processing_intake_get(session_header(req))
    })) |>
    plumber::pr_post("/api/carga/processing-intake/validate", wrap_endpoint(function(req, res, ...) {
      parsed <- .processing_intake_parse_body(req)
      processing_intake_validate(session_header(req), parsed$entries %||% list())
    })) |>
    plumber::pr_handle("PUT", "/api/carga/processing-intake", wrap_endpoint(function(req, res, ...) {
      parsed <- .processing_intake_parse_body(req)
      processing_intake_save(
        session_header(req),
        expected_revision = parsed$expected_revision,
        entries = parsed$entries %||% list()
      )
    }))
}
