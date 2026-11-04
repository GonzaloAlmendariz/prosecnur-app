# Metas de calibración desde el CPV 2025 (ADR 0131 paso 5). Router delgado: la
# lógica vive en ponderacion_metas_cpv2025.R; no toca la sesión.
#   GET  /api/analitica/ponderacion/cpv2025/distritos — ámbitos disponibles
#   POST /api/analitica/ponderacion/cpv2025/metas     — márgenes del ámbito pedido
mount_ponderacion_metas_cpv2025 <- function(pr) {
  pr |>
    plumber::pr_get("/api/analitica/ponderacion/cpv2025/distritos", wrap_endpoint(function(req, res, ...) {
      ponderacion_cpv2025_distritos()
    })) |>
    plumber::pr_post("/api/analitica/ponderacion/cpv2025/metas", wrap_endpoint(function(req, res, ...) {
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      params <- list()
      if (nzchar(body_raw)) {
        Encoding(body_raw) <- "UTF-8"
        params <- tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
                           error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e)))
      }
      ponderacion_cpv2025_metas(params)
    }))
}
