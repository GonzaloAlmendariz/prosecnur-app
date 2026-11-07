# «Enviar a Material» (ADR 0118 §3, F1). Router delgado: la fase del cuerpo
# (opcional; por defecto la activa), el tipo de envío y la llamada al engine. La muestra la toma el
# servidor de su propio run: lo que traiga el cuerpo además de `fase` se ignora.

mount_hojas_ruta_envio <- function(pr) {
  pr |>
    plumber::pr_post("/api/hojas-ruta/envio", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      # `kind`: «ump» (la muestra sorteada, por defecto) o «cuotas» (zonas con su cuota, ADR 0125 §2).
      kind <- tolower(trimws(as.character(parsed[["kind"]] %||% "ump")[1]))
      if (!kind %in% HOJAS_RUTA_ENVIO_KINDS) {
        stop_api(422, "E_HOJAS_RUTA_ENVIO_KIND", "El envío es «ump» o «cuotas».", details = list(kinds = as.list(HOJAS_RUTA_ENVIO_KINDS)))
      }
      fase <- parsed[["fase"]] %||% parsed[["phase"]]
      if (identical(kind, "cuotas")) hojas_ruta_enviar_cuotas(sid, fase) else hojas_ruta_enviar(sid, fase)
    }))
}
