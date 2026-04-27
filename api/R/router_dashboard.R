# Router del módulo Dashboard.
#
# Endpoints (Fase 1):
#   GET  /api/dashboard/manifest             — qué tabs aplican
#   GET  /api/dashboard/secciones            — secciones del cuestionario + kpi_vars
#   POST /api/dashboard/categorias-var       — catálogo de valores de una variable (para filtros)
#   POST /api/dashboard/resumen/seccion      — payload del tab Resumen
#   POST /api/dashboard/resumen/kpis         — KPIs del sidebar de Resumen
#   GET  /api/dashboard/config               — config visual del usuario
#   POST /api/dashboard/config               — guardar config visual
#   GET  /api/dashboard/curacion             — fase inicial de exclusiones
#   POST /api/dashboard/curacion             — confirmar exclusiones
#   GET  /api/dashboard/source               — fuente propia + candidatos
#   POST /api/dashboard/source/import        — cargar XLSForm + data al dashboard
#   GET  /api/dashboard/paletas-listas       — choices para paletas por lista
#
# Endpoints pendientes (fases siguientes):
#   POST /api/dashboard/relacion/cross       — Fase 4
#   GET  /api/dashboard/base-datos           — Fase 5
#   POST /api/dashboard/base-datos/descargar — Fase 5
#   POST /api/dashboard/publish              — Fase 7
#
# Helpers en `dashboard_pane.R`, `dashboard_curacion.R`,
# `dashboard_secciones.R`, `dashboard_resumen.R`.

mount_dashboard <- function(pr) {
  pr |>
    plumber::pr_get("/api/dashboard/manifest", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      list(
        ok = TRUE,
        manifest = .dashboard_manifest(s),
        theme_default = .dashboard_theme_default()
      )
    })) |>
    plumber::pr_get("/api/dashboard/source", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      list(ok = TRUE, payload = .dashboard_source_payload(s))
    })) |>
    plumber::pr_post("/api/dashboard/source/import", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .dashboard_parse_body(req)
      source <- .dashboard_import_source(sid, body)
      list(ok = TRUE, source = source, manifest = .dashboard_manifest(session_get(sid)))
    })) |>
    plumber::pr_get("/api/dashboard/paletas-listas", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      c(list(ok = TRUE), .dashboard_choice_lists_payload(s))
    })) |>
    plumber::pr_get("/api/dashboard/secciones", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      payload <- .dashboard_secciones_payload(s)
      list(ok = TRUE, secciones = payload$secciones, kpi_vars = payload$kpi_vars)
    })) |>
    plumber::pr_post("/api/dashboard/categorias-var", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      body <- .dashboard_parse_body(req)
      var <- as.character(body$var %||% "")[1]
      if (!nzchar(var)) stop_api(400, "E_BAD_REQUEST", "Falta 'var'.")
      s_ctx <- .dashboard_ctx(s)
      if (is.null(s_ctx$rp_data) || is.null(s_ctx$rp_inst)) {
        return(list(ok = TRUE, valores = list()))
      }
      vals <- .dashboard_categorias_var(var, s_ctx$rp_inst, s_ctx$rp_data)
      list(ok = TRUE, valores = vals)
    })) |>
    plumber::pr_post("/api/dashboard/resumen/seccion", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      body <- .dashboard_parse_body(req)
      seccion <- as.character(body$seccion %||% "")[1]
      if (!nzchar(seccion)) stop_api(400, "E_BAD_REQUEST", "Falta 'seccion'.")
      filtros <- body$filtros %||% list()
      payload <- .dashboard_resumen_payload(s, seccion, filtros)
      list(ok = TRUE, payload = payload)
    })) |>
    plumber::pr_post("/api/dashboard/resumen/kpis", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      body <- .dashboard_parse_body(req)
      filtros <- body$filtros %||% list()
      payload <- .dashboard_resumen_kpis(s, filtros)
      list(ok = TRUE, payload = payload)
    })) |>
    plumber::pr_get("/api/dashboard/config", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      list(ok = TRUE, config = s$dashboard_config %||% .dashboard_default_config())
    })) |>
    plumber::pr_post("/api/dashboard/config", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .dashboard_parse_body(req)
      cfg <- body$config
      if (is.null(cfg)) stop_api(400, "E_NO_CONFIG", "Body debe incluir 'config'.")
      session_set(sid, "dashboard_config", cfg)
      list(ok = TRUE, saved_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
    })) |>
    plumber::pr_get("/api/dashboard/curacion", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      list(ok = TRUE, payload = .dashboard_curacion_payload(s))
    })) |>
    plumber::pr_post("/api/dashboard/curacion", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .dashboard_parse_body(req)
      cur <- .dashboard_curacion_save(sid, body)
      list(ok = TRUE, curacion = cur)
    }))
}

# Helper privado para parsear el body JSON de un request POST.
# Mismo patrón que el viejo router_tablero.R (ver git history) y los
# demás routers del app.
.dashboard_parse_body <- function(req) {
  body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw)
              else (req$postBody %||% "")
  if (!nzchar(body_raw)) return(list())
  Encoding(body_raw) <- "UTF-8"
  tryCatch(
    jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
  )
}
