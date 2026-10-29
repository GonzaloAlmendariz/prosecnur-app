# Biblioteca de ICC de Hojas de ruta (ADR 0116 §2). Router delgado: la biblioteca es
# local a la app (fuera de los .pulso) y aplicar una entrada devuelve el
# `sample_size` nuevo sin guardarlo: el front lo pone en el borrador de Muestra.

mount_hojas_ruta_icc <- function(pr) {
  pr |>
    plumber::pr_get("/api/hojas-ruta/icc", wrap_endpoint(function(req, res) {
      session_header(req)
      entradas <- hojas_ruta_icc_biblioteca_leer()
      list(ok = TRUE, entradas = lapply(entradas, function(e) c(e, list(aplicable = hojas_ruta_icc_validar(e)))))
    })) |>
    plumber::pr_post("/api/hojas-ruta/icc", wrap_endpoint(function(req, res, ...) {
      session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      entrada <- parsed$entrada %||% parsed
      if (!is.list(entrada) || !nzchar(as.character(entrada$id %||% "")[1])) {
        stop_api(400, "E_BAD_REQUEST", "La entrada del ICC necesita un id.")
      }
      hojas_ruta_icc_biblioteca_guardar(entrada)
      list(ok = TRUE, aplicable = hojas_ruta_icc_validar(entrada))
    })) |>
    plumber::pr_post("/api/hojas-ruta/icc/aplicar", wrap_endpoint(function(req, res, ...) {
      session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_integrada_normalize_config(parsed$config %||% list())
      id <- as.character(parsed$id %||% "")[1]
      entrada <- Find(function(e) identical(as.character(e$id %||% ""), id), hojas_ruta_icc_biblioteca_leer())
      if (is.null(entrada)) stop_api(404, "E_NOT_FOUND", "No hay un ICC con ese id en la biblioteca.")
      r <- hojas_ruta_icc_aplicar(cfg$sample_size, entrada, .hojas_ruta_route_size(cfg))
      if (!isTRUE(r$ok)) stop_api(409, "E_ICC_NOT_APPLICABLE", r$motivo)
      list(ok = TRUE, sample_size = r$sample_size, alerts = r$avisos, distritos_con_override = as.list(r$distritos_con_override))
    }))
}
