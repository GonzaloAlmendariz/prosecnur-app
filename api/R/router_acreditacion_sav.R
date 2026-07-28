# Router de la escotilla "bases de acreditación desde SAV". Delgado: parsea el
# body, delega en el engine (carga_acreditacion_sav.R) y serializa.

.acreditacion_sav_parse_body <- function(req) {
  body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "{}")
  Encoding(body_raw) <- "UTF-8"
  if (!nzchar(trimws(body_raw))) body_raw <- "{}"
  tryCatch(
    jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
  )
}

mount_acreditacion_sav <- function(pr) {
  pr |>
    plumber::pr_post("/api/acreditacion/sav/preview", wrap_endpoint(function(req, res, ...) {
      parsed <- .acreditacion_sav_parse_body(req)
      acreditacion_sav_preview(session_header(req), parsed$files %||% list())
    })) |>
    plumber::pr_post("/api/acreditacion/sav/promote", wrap_endpoint(function(req, res, ...) {
      parsed <- .acreditacion_sav_parse_body(req)
      acreditacion_sav_promote(
        session_header(req),
        files = parsed$files %||% list(),
        preview_fingerprint = parsed$preview_fingerprint,
        confirm_replacement = parsed$confirm_replacement %||% FALSE
      )
    }))
}
