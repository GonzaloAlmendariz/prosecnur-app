.graficos_consolidado_body <- function(req) {
  raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else req$postBody %||% ""
  if (!nzchar(raw)) return(list())
  Encoding(raw) <- "UTF-8"
  tryCatch(jsonlite::fromJSON(raw, simplifyVector = FALSE), error = function(e) {
    stop_api(400, "E_BAD_JSON", conditionMessage(e))
  })
}

# El preflight ya arma el plan sugerido para poder contarlo (`n_slides`), y
# hasta la unidad de siembra lo descartaba. El editor compartido lo necesita
# para aterrizar con laminas en vez de un lienzo vacio, pero recalcularlo
# cuesta ~7-9 s sobre cuatro bases reales y Plumber es de un solo hilo: pedirlo
# de nuevo bloquearia la app entera. Por eso viaja en la MISMA respuesta que ya
# se calcula, y opt-in: el menu de la barra solo muestra contadores (3.8 KB) y
# no debe cargar los ~48 KB del plan cada vez que se abre.
.graficos_consolidado_truthy <- function(value) {
  if (is.null(value) || !length(value)) return(FALSE)
  if (is.logical(value)) return(isTRUE(value[[1]]))
  tolower(trimws(as.character(value[[1]]))) %in% c("1", "true", "yes", "si", "sí")
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
    plumber::pr_get("/api/graficos/consolidado/preflight", wrap_endpoint(function(req, res, include_plan = NULL, includePlan = NULL) {
      sid <- session_header(req)
      preview <- graficos_consolidado_preflight(
        sid,
        config = graficos_consolidado_draft_get(sid)$config
      )
      preview$sources <- NULL
      if (!.graficos_consolidado_truthy(include_plan %||% includePlan)) preview$plan <- NULL
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
