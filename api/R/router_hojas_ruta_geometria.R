# Geometría compacta por distrito para el lienzo de Hojas de ruta (ADR 0114 §7).
# Router delgado: valida el ubigeo y sirve el JSON ya armado por
# `hojas_ruta_geometria_compacta_json()` (hojas_ruta_geometria.R).

mount_hojas_ruta_geometria <- function(pr) {
  pr |>
    plumber::pr_get("/api/hojas-ruta/geometria", wrap_endpoint(function(req, res, ubigeo = NULL) {
      session_header(req)
      ubigeo <- trimws(as.character(ubigeo %||% ""))
      if (!nzchar(ubigeo) || !grepl("^[0-9]{6}$", ubigeo)) {
        stop_api(400, "E_NO_UBIGEO", "Falta el ubigeo del distrito.")
      }
      body <- hojas_ruta_geometria_compacta_json(ubigeo)
      res$setHeader("Content-Type", "application/json; charset=utf-8")
      res$setHeader("Content-Length", as.character(nchar(body, type = "bytes")))
      res$body <- body
      res
    }))
}
