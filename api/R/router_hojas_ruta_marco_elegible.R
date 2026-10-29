# Marco elegible de Hojas de ruta (ADR 0115 §3). Router delgado: lee la config
# del cuerpo, la lleva a la de la fase activa (como /sample-preview) y devuelve
# la vista previa armada por `hojas_ruta_marco_elegible_preview()`. No guarda
# nada: ver la cobertura o las zonas que no alcanzan no cambia el run.

mount_hojas_ruta_marco_elegible <- function(pr) {
  pr |>
    plumber::pr_post("/api/hojas-ruta/marco-elegible/preview", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_integrada_normalize_config(parsed$config %||% parsed)
      if (!length(unlist(cfg$territorios, use.names = FALSE))) {
        stop_api(400, "E_NO_TERRITORY", "Confirma al menos un distrito antes de revisar el marco elegible.")
      }
      active <- .hojas_ruta_active_run(sid)
      hojas_ruta_marco_elegible_preview(.hojas_ruta_effective_config_for_phase(sid, cfg, active$phase))
    }))
}
