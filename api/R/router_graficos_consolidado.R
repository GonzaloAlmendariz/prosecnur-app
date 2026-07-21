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
    plumber::pr_get("/api/graficos/consolidado/preflight", wrap_endpoint(function(req, res) {
      preview <- graficos_consolidado_preflight(session_header(req), config = list())
      preview$sources <- NULL
      preview$plan <- NULL
      preview$config <- NULL
      preview
    })) |>
    plumber::pr_post("/api/graficos/consolidado/ppt", wrap_endpoint(function(req, res, ...) {
      parsed <- .graficos_consolidado_body(req)
      graficos_consolidado_start(
        session_header(req),
        config = parsed$config %||% list(),
        presets = parsed$presets %||% list()
      )
    }))
}
