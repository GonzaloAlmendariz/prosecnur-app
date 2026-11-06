# Personas asignables del padrón, bajo demanda (Control › Por resolver).
#
#   GET /api/monitoreo/acreditacion/assignment-pool?key=<assignment_pool_key>
#
# El cruce arma, una vez por público, la lista de personas del universo a las
# que el supervisor puede asignar una respuesta (`internal_queries$
# assignment_pool`, ver `monitoreo_acreditacion_cruce_escala.R`). Viajaba en
# cada carga del scope `queries_summary`: con las 45 120 personas de
# Acreditación Institucional PUCP 2026 eran 4.6 MB de los 16.4 MB del scope, y
# sólo las usa el panel de un caso. En acreditación ya no viajan
# (`.monitoreo_acreditacion_dashboard_para_cliente`); el panel las pide aquí.
#
# Contrato:
#   - `key` es el `assisted_review$assignment_pool_key` del caso (el actor
#     normalizado, o `_todos`).
#   - 200 `{ ok, preparando: TRUE, key, total: 0, personas: NULL }` mientras la
#     sesión aún no tiene las consultas del corte (warm start en curso).
#   - 200 `{ ok, preparando: FALSE, key, total, personas }`; `personas` va en
#     el transporte `columnas_v1` de los casos, en el orden del padrón.
#   - 400 `E_MONITOREO_POOL_KEY` sin `key`.
#   - 404 `E_MONITOREO_POOL_NOT_FOUND` si el corte no tiene ese público.
#
# Se lee la caché de sesión que sirvió el último `queries_summary`, no se
# recalcula: es la misma foto que tiene la página abierta. La validación al
# guardar la decisión (`.monitoreo_acreditacion_apply_case_reconciliation`)
# sigue reconstruyendo el pool por su cuenta, así que una persona que ya no es
# asignable se rechaza igual que antes.

# Consultas internas del último corte servido, sin transporte (registros).
.monitoreo_acreditacion_consultas_en_sesion <- function(sid) {
  s <- session_get(sid)
  for (clave in c("monitoreo_dashboard_cache_queries_summary", "monitoreo_dashboard_cache_full", "monitoreo_dashboard_cache")) {
    queries <- s[[clave]]$acreditacion_reports$internal_queries
    if (is.list(queries) && is.list(queries$cases) && length(queries$cases)) return(queries)
  }
  NULL
}

monitoreo_acreditacion_pool_asignable <- function(sid, key) {
  key <- .monitoreo_scalar(key, "")
  if (!nzchar(key)) stop_api(400, "E_MONITOREO_POOL_KEY", "Falta el público cuyo padrón se quiere consultar.")
  queries <- .monitoreo_acreditacion_consultas_en_sesion(sid)
  if (is.null(queries)) return(list(ok = TRUE, preparando = TRUE, key = key, total = 0L, personas = NULL))
  pool <- queries$assignment_pool %||% list()
  if (!key %in% names(pool)) {
    stop_api(404, "E_MONITOREO_POOL_NOT_FOUND", "El corte no tiene personas asignables para ese público; vuelve a cargar Monitoreo.")
  }
  personas <- pool[[key]] %||% list()
  list(
    ok = TRUE,
    preparando = FALSE,
    key = key,
    total = length(personas),
    personas = .monitoreo_transporte_columnas(personas)
  )
}

mount_monitoreo_acreditacion_pool <- function(pr) {
  pr |>
    plumber::pr_get("/api/monitoreo/acreditacion/assignment-pool", wrap_endpoint(function(req, res, key = NULL, ...) {
      monitoreo_acreditacion_pool_asignable(.monitoreo_session(req, res), key)
    }))
}
