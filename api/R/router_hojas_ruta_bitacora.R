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
      # La huella y los distritos los pone el servidor: lo que mande el cliente no
      # decide qué marco quedó cubierto (ADR 0115 §4, enmienda U17).
      if (identical(accion, "decision_cobertura")) {
        est <- .hojas_ruta_decision_cobertura_sesion(sid)
        detalle$marco_hash <- est$huella
        # Los distritos que el servidor ve en la muestra guardada, más los que el equipo
        # nombró al decidir (puede decidir antes de volver a sortear).
        del_cliente <- vapply(Filter(is.list, detalle$distritos %||% list()), function(d) as.character(d$ubigeo %||% ""), character(1))
        detalle$ubigeos <- as.list(unique(c(vapply(est$exigida, `[[`, character(1), "ubigeo"), del_cliente[nzchar(del_cliente)])))
      }
      entrada <- hojas_ruta_bitacora_registrar(sid, accion, parsed$resumen, detalle)
      list(ok = TRUE, entrada = entrada)
    }))
}
