.processing_release_parse_body <- function(req) {
  raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else req$postBody %||% ""
  if (!nzchar(raw)) return(list())
  Encoding(raw) <- "UTF-8"
  tryCatch(
    jsonlite::fromJSON(raw, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
  )
}

mount_processing_release <- function(pr) {
  pr |>
    plumber::pr_get("/api/processing/releases", wrap_endpoint(function(req, res) {
      processing_release_get(session_header(req))
    })) |>
    plumber::pr_post("/api/processing/releases/approve", wrap_endpoint(function(req, res, ...) {
      parsed <- .processing_release_parse_body(req)
      processing_release_approve(
        session_header(req),
        parsed$base,
        parsed$expected_input_fingerprint
      )
    }))
}
