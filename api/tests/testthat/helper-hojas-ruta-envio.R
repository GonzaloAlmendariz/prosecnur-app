# Fixtures del envío de Hojas de ruta a Material de campo (ADR 0118, F1).
# Muestras sintéticas mínimas: dos titulares y un reemplazo; sin red ni marco.

.hre_sample <- function(viviendas = 120L, seed = 2017L, prefijo = "1501010010") {
  list(
    seed = seed,
    algoritmo_sorteo = HOJAS_RUTA_ALGORITMO_SORTEO,
    blocks = list(
      list(id_manzana = paste0(prefijo, "01"), distrito = "Lima", ubigeo = "150101", zona = "00100",
           manzana = "001", hoja_num = 1L, orden_seleccion = 1L, rango_inicio = 1L, rango_fin = 5L,
           viviendas = viviendas, entrevistas = 5L, tipo_manzana = "titular"),
      list(id_manzana = paste0(prefijo, "02"), distrito = "Lima", ubigeo = "150101", zona = "00100",
           manzana = "002", hoja_num = 2L, orden_seleccion = 2L, rango_inicio = 6L, rango_fin = 10L,
           viviendas = 90L, entrevistas = 5L, tipo_manzana = "titular")
    ),
    replacement_blocks = list(
      list(id_manzana = paste0(prefijo, "09"), distrito = "Lima", ubigeo = "150101", zona = "00100",
           manzana = "009", titular_id_manzana = paste0(prefijo, "01"), titular_hoja_num = 1L,
           replacement_order = 1L, rango_inicio = 1L, rango_fin = 5L, viviendas = 80L,
           entrevistas = 5L, tipo_manzana = "reemplazo")
    ),
    alerts = list()
  )
}

# Sesión con proyecto (para que .mark_project_dirty marque) y corridas sembradas.
# `pilot` = muestra del piloto bloqueado (NULL: sin piloto).
.hre_session <- function(field = .hre_sample(), pilot = NULL, active = "field") {
  sid <- session_create()
  s <- session_get(sid)
  s$project_path <- tempfile(fileext = ".pulso")
  .session_env[[sid]] <- s
  runs <- list()
  if (!is.null(pilot)) {
    runs$pilot <- .hojas_ruta_run_normalize(list(locked = TRUE, workspace_outputs = list(sample = pilot)), "pilot")
  }
  runs$field <- .hojas_ruta_run_normalize(
    list(workspace_outputs = if (is.null(field)) list() else list(sample = field)), "field"
  )
  s <- session_get(sid)
  s$hojas_ruta_runs <- runs
  s$hojas_ruta_active_phase <- active
  s$project_dirty <- FALSE
  s$project_dirty_reasons <- NULL
  .session_env[[sid]] <- s
  sid
}

.hre_code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)
.hre_status <- function(expr) tryCatch({ force(expr); NA_integer_ }, api_error = function(e) as.integer(e$status))

# Llamada HTTP real a un router, con query string.
.hre_call <- function(pr, sid, method, path, body = "", query = "") {
  raw_body <- charToRaw(enc2utf8(body))
  input <- list(read = function(...) raw_body, rewind = function() invisible(0), read_lines = function(...) body)
  req <- as.environment(list(
    REQUEST_METHOD = method, PATH_INFO = path, QUERY_STRING = query,
    CONTENT_TYPE = "application/json",
    HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid), rook.input = input
  ))
  r <- pr$call(req)
  list(status = as.integer(r$status), raw = as.character(r$body),
       body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

.hre_json <- function(x) as.character(jsonlite::toJSON(x, auto_unbox = TRUE, null = "null", na = "null", digits = NA))
