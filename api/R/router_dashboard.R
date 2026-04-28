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
# Endpoints (Fase 4-5):
#   POST /api/dashboard/relacion/cross           — payload de cruce + iteración
#   POST /api/dashboard/relacion/descargar       — Excel del cruce (multi-hoja si itera)
#   GET  /api/dashboard/base-datos               — estructura de secciones/variables
#   POST /api/dashboard/base-datos/data          — data paginada (modo + filtros + sort + search)
#   POST /api/dashboard/base-datos/descargar     — CSV/XLSX de la vista actual
#   GET  /api/dashboard/base-datos/diccionario   — opciones código→etiqueta de una variable
#
# Endpoints pendientes (fases siguientes):
#   POST /api/dashboard/publish              — Fase 7
#
# Helpers en `dashboard_pane.R`, `dashboard_curacion.R`,
# `dashboard_secciones.R`, `dashboard_resumen.R`,
# `dashboard_relacion.R`, `dashboard_base_datos.R`.

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
      list(ok = TRUE, config = .dashboard_config_with_defaults(s$dashboard_config))
    })) |>
    plumber::pr_post("/api/dashboard/config", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .dashboard_parse_body(req)
      cfg <- body$config
      if (is.null(cfg)) stop_api(400, "E_NO_CONFIG", "Body debe incluir 'config'.")
      session_set(sid, "dashboard_config", .dashboard_config_with_defaults(cfg))
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
    })) |>
    plumber::pr_post("/api/dashboard/relacion/cross", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      body <- .dashboard_parse_body(req)
      var_p <- as.character(body$var_principal %||% "")[1]
      var_s <- as.character(body$var_segmento %||% "")[1]
      if (!nzchar(var_p) || !nzchar(var_s)) {
        stop_api(400, "E_BAD_REQUEST", "Faltan 'var_principal' o 'var_segmento'.")
      }
      filtros <- body$filtros %||% list()
      iterar <- body$iterar
      payload <- .dashboard_relacion_payload(s, var_p, var_s, filtros, iterar)
      list(ok = TRUE, payload = payload)
    })) |>
    plumber::pr_post("/api/dashboard/relacion/descargar", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      body <- .dashboard_parse_body(req)
      var_p <- as.character(body$var_principal %||% "")[1]
      var_s <- as.character(body$var_segmento %||% "")[1]
      if (!nzchar(var_p) || !nzchar(var_s)) {
        stop_api(400, "E_BAD_REQUEST", "Faltan 'var_principal' o 'var_segmento'.")
      }
      filtros <- body$filtros %||% list()
      iterar <- body$iterar
      path <- .dashboard_relacion_descargar(s, var_p, var_s, filtros, iterar)
      n <- file.info(path)$size
      bytes <- readBin(path, what = "raw", n = n)
      filename <- sprintf("relacion_%s_x_%s_%s.xlsx",
                          gsub("[^A-Za-z0-9_-]", "_", var_p),
                          gsub("[^A-Za-z0-9_-]", "_", var_s),
                          format(Sys.time(), "%Y%m%d_%H%M%S"))
      res$setHeader("Content-Type",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      res$setHeader("Content-Length", as.character(n))
      res$setHeader("Content-Disposition",
                    sprintf('attachment; filename="%s"', filename))
      res$body <- bytes
      res
    })) |>
    plumber::pr_get("/api/dashboard/base-datos", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      list(ok = TRUE, payload = .dashboard_base_datos_estructura(s))
    })) |>
    plumber::pr_post("/api/dashboard/base-datos/data", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      body <- .dashboard_parse_body(req)
      modo <- as.character(body$modo %||% "codigos")[1]
      variables <- body$variables %||% list()
      page <- as.integer(body$page %||% 1L)
      page_size <- as.integer(body$page_size %||% 25L)
      search <- as.character(body$search %||% "")
      sort <- body$sort
      payload <- .dashboard_base_datos_data(s, modo, variables, page, page_size, search, sort)
      list(ok = TRUE, payload = payload)
    })) |>
    plumber::pr_post("/api/dashboard/base-datos/descargar", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      body <- .dashboard_parse_body(req)
      modo <- as.character(body$modo %||% "codigos")[1]
      variables <- body$variables %||% list()
      formato <- as.character(body$formato %||% "xlsx")[1]
      result <- .dashboard_base_datos_descargar(s, modo, variables, formato)
      n <- file.info(result$path)$size
      bytes <- readBin(result$path, what = "raw", n = n)
      ts <- format(Sys.time(), "%Y%m%d_%H%M%S")
      if (identical(result$formato, "csv")) {
        filename <- sprintf("base_datos_%s.csv", ts)
        res$setHeader("Content-Type", "text/csv; charset=utf-8")
      } else {
        filename <- sprintf("base_datos_%s.xlsx", ts)
        res$setHeader("Content-Type",
                      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      }
      res$setHeader("Content-Length", as.character(n))
      res$setHeader("Content-Disposition",
                    sprintf('attachment; filename="%s"', filename))
      res$body <- bytes
      res
    })) |>
    plumber::pr_get("/api/dashboard/base-datos/diccionario", wrap_endpoint(function(req, res, variable = NULL) {
      sid <- session_header(req)
      s <- session_get(sid)
      var <- if (!is.null(variable) && length(variable) >= 1) {
        as.character(variable)[[1]]
      } else ""
      if (!nzchar(var)) stop_api(400, "E_BAD_REQUEST", "Falta query 'variable'.")
      list(ok = TRUE, payload = .dashboard_base_datos_diccionario(s, var))
    })) |>
    plumber::pr_get("/api/dashboard/dimensiones/catalogo", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      list(ok = TRUE, payload = .dashboard_dim_catalogo(s))
    })) |>
    plumber::pr_get("/api/dashboard/dimensiones/secciones-vars", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      list(ok = TRUE, payload = .dashboard_dim_secciones_vars(s))
    })) |>
    plumber::pr_post("/api/dashboard/dimensiones/payload", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      body <- .dashboard_parse_body(req)
      modo <- as.character(body$modo %||% "general")[1]
      objetivo <- as.character(body$objetivo %||% "")[1]
      if (!nzchar(objetivo)) stop_api(400, "E_BAD_REQUEST", "Falta 'objetivo'.")
      cruce <- as.character(body$cruce %||% "")[1]
      incluir_total <- if (is.null(body$incluir_total)) NULL else isTRUE(body$incluir_total)
      iter <- body$iter
      filtros <- body$filtros %||% list()
      payload <- .dashboard_dim_payload(s, modo, objetivo, cruce, incluir_total, iter, filtros)
      list(ok = TRUE, payload = payload)
    })) |>
    plumber::pr_post("/api/dashboard/dimensiones/categorias-var", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      body <- .dashboard_parse_body(req)
      var <- as.character(body$var %||% "")[1]
      if (!nzchar(var)) stop_api(400, "E_BAD_REQUEST", "Falta 'var'.")
      list(ok = TRUE, valores = .dashboard_dim_categorias_var(s, var))
    })) |>
    plumber::pr_post("/api/dashboard/dimensiones/foda", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      body <- .dashboard_parse_body(req)
      modo <- as.character(body$modo %||% "general")[1]
      objetivo <- as.character(body$objetivo %||% "")[1]
      if (!nzchar(objetivo)) stop_api(400, "E_BAD_REQUEST", "Falta 'objetivo'.")
      cruce <- as.character(body$cruce %||% "")[1]
      incluir_total <- if (is.null(body$incluir_total)) NULL else isTRUE(body$incluir_total)
      iter <- body$iter
      filtros <- body$filtros %||% list()
      foda_config <- body$foda_config %||% NULL
      payload <- .dashboard_dim_foda(s, modo, objetivo, cruce, incluir_total, iter, filtros, foda_config)
      list(ok = TRUE, payload = payload)
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
