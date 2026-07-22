.graficos_consolidado_body <- function(req) {
  raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else req$postBody %||% ""
  if (!nzchar(raw)) return(list())
  Encoding(raw) <- "UTF-8"
  tryCatch(jsonlite::fromJSON(raw, simplifyVector = FALSE), error = function(e) {
    stop_api(400, "E_BAD_JSON", conditionMessage(e))
  })
}

mount_graficos_consolidado <- function(pr) {
  pr |>
    plumber::pr_get("/api/graficos/consolidado/draft", wrap_endpoint(function(req, res) {
      graficos_consolidado_draft_get(session_header(req))
    })) |>
    plumber::pr_post("/api/graficos/consolidado/draft", wrap_endpoint(function(req, res, ...) {
      parsed <- .graficos_consolidado_body(req)
      graficos_consolidado_draft_set(
        session_header(req),
        config = parsed$config,
        expected_revision = parsed$expected_revision
      )
    })) |>
    plumber::pr_get("/api/graficos/consolidado/preflight", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      preview <- graficos_consolidado_preflight(
        sid,
        config = graficos_consolidado_draft_get(sid)$config
      )
      preview$sources <- NULL
      preview$plan <- NULL
      preview$config <- NULL
      preview
    })) |>
    plumber::pr_post("/api/graficos/consolidado/ppt", wrap_endpoint(function(req, res, ...) {
      parsed <- .graficos_consolidado_body(req)
      graficos_consolidado_start(
        session_header(req),
        presets = parsed$presets %||% list(),
        expected_revision = .graficos_consolidado_expected_revision(parsed$expected_revision)
      )
    }))
}
