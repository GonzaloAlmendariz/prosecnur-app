# =============================================================================
# router_monitoreo_territorial_mapeo.R — mapeo manual de variables de interés
# =============================================================================
#
# Decisión 7 del goal visual: la app no debe depender de que el instrumento
# tenga la estructura estándar. Necesita las mismas variables, pero pueden
# venir en otro orden o escritas distinto, así que hay que poder asignarlas
# a mano.
#
# Contrato:
#   GET /api/monitoreo/territorial/mapeo
#     Devuelve las variables de interés con la columna a la que apuntan hoy,
#     el inventario de columnas reales de la base y el aviso de pendientes.
#
# La ESCRITURA no vive aquí: `POST /api/monitoreo/territorial/config` ya acepta
# un patch de `*_var` y lo aplica al mapeo de la fase activa. Duplicarla habría
# creado dos caminos de escritura para el mismo estado.
#
# Vive en archivo propio porque `router_monitoreo.R` está congelado a
# crecimiento (`agentic/manifest.json`), igual que `router_monitoreo_telefonico.R`.
# =============================================================================

# Frontera testeable: resuelve snapshot y config de la sesión y arma el payload.
# Separada del handler para fijar el contrato sin levantar plumber.
.monitoreo_territorial_mapeo_from_session <- function(sid) {
  s <- session_get(sid)
  snapshot <- s$monitoreo_snapshot %||% NULL
  data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
  monitoreo_territorial_mapeo_payload(
    config = cfg,
    data = data,
    fase = .monitoreo_scalar(cfg$territorial$active_route_phase, "")
  )
}

mount_monitoreo_territorial_mapeo <- function(pr) {
  pr |>
    plumber::pr_get("/api/monitoreo/territorial/mapeo", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      .monitoreo_territorial_mapeo_from_session(sid)
    }))
}
