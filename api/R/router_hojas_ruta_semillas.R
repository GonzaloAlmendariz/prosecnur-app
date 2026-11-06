# Comparar semillas del sorteo (U13). Router delgado: toma la config del cuerpo,
# la lleva a la de la fase activa (exclusiones del piloto incluidas) y sortea en
# seco. NO llama a .hojas_ruta_save_run ni toca las salidas: comparar no cambia nada.

mount_hojas_ruta_semillas <- function(pr) {
  pr |>
    plumber::pr_post("/api/hojas-ruta/sample-preview/comparar", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      cfg <- hojas_ruta_integrada_normalize_config(parsed$config %||% list())
      if (!length(unlist(cfg$territorios, use.names = FALSE))) {
        stop_api(400, "E_NO_TERRITORY", "Confirma al menos un distrito antes de comparar semillas.")
      }
      active <- .hojas_ruta_active_run(sid)
      efectiva <- .hojas_ruta_effective_config_for_phase(sid, cfg, active$phase)
      semillas <- suppressWarnings(as.integer(unlist(parsed$semillas %||% list(), use.names = FALSE)))
      nuevas <- max(0L, min(HOJAS_RUTA_SEMILLAS_MAX - 1L, as.integer(parsed$nuevas %||% 2L)))
      semillas <- c(semillas[!is.na(semillas)], hojas_ruta_semillas_nuevas(nuevas, evitar = c(as.integer(cfg$seed), semillas)))
      hojas_ruta_comparar_semillas(efectiva, semillas)
    }))
}
