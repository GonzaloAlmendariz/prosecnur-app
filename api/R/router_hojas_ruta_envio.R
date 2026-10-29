# «Enviar a Material» (ADR 0118 §3, F1). Router delgado: la fase del cuerpo
# (opcional; por defecto la activa) y la llamada al engine. La muestra la toma el
# servidor de su propio run: lo que traiga el cuerpo además de `fase` se ignora.

mount_hojas_ruta_envio <- function(pr) {
  pr |>
    plumber::pr_post("/api/hojas-ruta/envio", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      hojas_ruta_enviar(sid, parsed$fase %||% parsed$phase)
    }))
}
