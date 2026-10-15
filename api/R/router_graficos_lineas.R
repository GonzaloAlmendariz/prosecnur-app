# =============================================================================
# router_graficos_lineas.R — líneas visuales propias de la app (ID3 del rediseño, decisión D7)
# =============================================================================
#
# Router delgado: sesión, cuerpo JSON y llamada al engine (`graficos_lineas_visuales.R`). Las líneas no dependen del
# estudio abierto —son de la app—, pero se exige sesión igual que el resto de /api/graficos.

mount_graficos_lineas <- function(pr) {
  leer_cuerpo <- function(req) {
    body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
    if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
    Encoding(body_raw) <- "UTF-8"
    tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
             error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e)))
  }
  pr |>
    plumber::pr_get("/api/graficos/lineas-visuales", wrap_endpoint(function(req, res) {
      session_get(session_header(req))
      list(ok = TRUE, lineas = .lv_leer())
    })) |>
    plumber::pr_put("/api/graficos/lineas-visuales/<id>", wrap_endpoint(function(req, res, id, ...) {
      session_get(session_header(req))
      list(ok = TRUE, linea = .lv_guardar(id, leer_cuerpo(req)))
    })) |>
    plumber::pr_delete("/api/graficos/lineas-visuales/<id>", wrap_endpoint(function(req, res, id, ...) {
      session_get(session_header(req))
      list(ok = TRUE, id = .lv_eliminar(id))
    }))
}
