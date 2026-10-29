# Bitácora de decisiones (U17). Router delgado: leerla y anotar una decisión desde
# la interfaz (la de cobertura ≥ 10 % del ADR 0115 §4, una nota). Las entradas
# automáticas las escriben los endpoints que mutan, no este router.

mount_hojas_ruta_bitacora <- function(pr) {
  pr |>
    plumber::pr_get("/api/hojas-ruta/bitacora", wrap_endpoint(function(req, res, fase = NULL) {
      sid <- session_header(req)
      list(ok = TRUE, entradas = hojas_ruta_bitacora_leer(sid, fase))
    })) |>
    plumber::pr_post("/api/hojas-ruta/bitacora", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      accion <- as.character(parsed$accion %||% "nota")[1]
      if (!accion %in% c("decision_cobertura", "nota")) {
        stop_api(400, "E_BAD_REQUEST", "Desde la interfaz sólo se anotan decisiones de cobertura y notas.")
      }
      detalle <- if (is.list(parsed$detalle)) parsed$detalle else list()
      # El detalle no guarda polígonos (ADR 0115 §4, enmienda U17): un marco que llega
      # entero se reduce a su resumen.
      if (is.list(detalle$marco_elegible) && is.list(detalle$marco_elegible$areas_excluidas)) {
        detalle$marco_elegible <- hojas_ruta_bitacora_detalle_marco(detalle$marco_elegible)
      }
      entrada <- hojas_ruta_bitacora_registrar(sid, accion, parsed$resumen, detalle)
      list(ok = TRUE, entrada = entrada)
    }))
}
