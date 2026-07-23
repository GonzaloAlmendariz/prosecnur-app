# =============================================================================
# Contrato HTTP real — helpers de la suite test-http-contract-*.R
# =============================================================================
#
# Por que existe esta capa: hay una clase entera de bugs que NO reproduce
# in-process (llamando los engines directo) porque vive en la serializacion
# HTTP real. Caso historico: el `current_code` fantasma — plumber parsea el
# body con jsonlite/simplifyDataFrame, RECTANGULARIZA el arreglo de slides y
# filtra un current_code=NA a laminas que nunca lo tuvieron; el render moria
# con las 85 laminas del reporte (fix en reporte_filter_guards.R, v0.5.19).
#
# Estos helpers levantan el backend Plumber REAL (build_plumber_app) en un
# subproceso callr sobre un puerto efimero de 127.0.0.1, esperan readiness
# contra /api/system/health y exponen un mini-cliente HTTP via curl. Sin red
# externa: todo es localhost.
#
# Trampas conocidas que este archivo respeta:
#   - Locale UTF-8 explicito en el subproceso (load_all muere parseando .R
#     con tildes bajo locale "C").
#   - PULSO_API_DIR apuntando al arbol dev, para que los jobs callr que el
#     server dispare hagan load_all del codigo fuente y no del instalado.
#   - PULSO_PUBLIC_MODE vaciado: en modo publico el app monta otra cosa.

.http_contract_state <- new.env(parent = emptyenv())

# Directorio raiz del paquete (api/). El working dir de testthat es
# api/tests/testthat, pero cubrimos tambien corridas desde la raiz del repo.
.http_contract_api_dir <- function() {
  candidates <- c(file.path("..", ".."), "api", ".")
  for (cand in candidates) {
    desc <- file.path(cand, "DESCRIPTION")
    if (file.exists(desc) && dir.exists(file.path(cand, "R")) &&
        any(grepl("^Package: *prosecnurapp", readLines(desc, warn = FALSE)))) {
      return(normalizePath(cand, winslash = "/", mustWork = TRUE))
    }
  }
  NULL
}

# Skips de entorno: la suite corre de verdad en local y CI linux, y se
# apaga limpio donde no hay subprocesos/puertos disponibles.
.http_contract_skip_if_unavailable <- function() {
  # Sin skip_on_cran: este paquete no se publica en CRAN y NOT_CRAN no esta
  # seteado bajo `testthat::test_file` directo (skipearia la suite entera,
  # tambien en CI). El opt-out explicito es la env var de abajo.
  if (identical(Sys.getenv("PROSECNUR_SKIP_HTTP_CONTRACT"), "1")) {
    testthat::skip("PROSECNUR_SKIP_HTTP_CONTRACT=1: suite de contrato HTTP desactivada.")
  }
  for (pkg in c("callr", "curl", "jsonlite", "httpuv", "plumber", "pkgload", "withr")) {
    testthat::skip_if_not_installed(pkg)
  }
  if (is.null(.http_contract_api_dir())) {
    testthat::skip("No se encontro el paquete prosecnurapp (DESCRIPTION + R/) desde el working dir de tests.")
  }
  invisible(TRUE)
}

# Los jobs callr del backend deserializan closures cuyo environment referencia
# `namespace:prosecnurapp`; ese deserialize solo resuelve si el paquete esta
# INSTALADO en .libPaths del worker (trampa conocida: "jobs callr cargan el
# paquete instalado"). Sin instalacion, todo job muere al arrancar — eso es
# una limitacion del entorno, no del contrato, asi que se skipea con mensaje.
.http_contract_jobs_runtime_ok <- function() {
  any(vapply(.libPaths(), function(lib) {
    dir.exists(file.path(lib, "prosecnurapp"))
  }, logical(1)))
}

http_contract_skip_if_no_jobs_runtime <- function() {
  if (!.http_contract_jobs_runtime_ok()) {
    testthat::skip(paste(
      "Runtime de jobs no disponible: los workers callr requieren prosecnurapp",
      "instalado en .libPaths (`R CMD INSTALL api`)."
    ))
  }
  invisible(TRUE)
}

# Ultimas lineas de un archivo de log, para diagnostico cuando el boot falla.
.http_contract_tail <- function(path, n = 30) {
  if (is.null(path) || !file.exists(path)) return("<sin log>")
  lines <- tryCatch(readLines(path, warn = FALSE), error = function(e) character(0))
  if (!length(lines)) return("<log vacio>")
  paste(utils::tail(lines, n), collapse = "\n")
}

# Arranca UNA instancia del backend real y espera readiness. Devuelve el
# handle {url, port, proc, err_file, out_file} o lanza error con el tail del
# stderr del subproceso (el que llama decide si eso es skip o fail).
.http_contract_boot_once <- function(api_dir, timeout_secs = 180) {
  port <- httpuv::randomPort()
  out_file <- tempfile("pulso-http-contract-", fileext = ".out")
  err_file <- tempfile("pulso-http-contract-", fileext = ".err")
  lc <- "en_US.UTF-8"

  proc <- callr::r_bg(
    func = function(api_dir, port) {
      # Locale UTF-8 primero que todo: load_all parsea .R con tildes.
      tryCatch(Sys.setlocale("LC_ALL", "en_US.UTF-8"),
               error = function(e) NULL, warning = function(w) NULL)
      if (!isTRUE(l10n_info()[["UTF-8"]])) {
        tryCatch(Sys.setlocale("LC_ALL", "C.UTF-8"),
                 error = function(e) NULL, warning = function(w) NULL)
      }
      options(encoding = "UTF-8")
      suppressMessages(pkgload::load_all(api_dir, quiet = TRUE))
      build <- get("build_plumber_app", envir = asNamespace("prosecnurapp"))
      # static_dir = "": sin frontend build; solo la superficie /api/*.
      pr <- build(static_dir = "")
      pr <- plumber::pr_set_docs(pr, FALSE)
      plumber::pr_run(pr, host = "127.0.0.1", port = port, quiet = TRUE)
    },
    args = list(api_dir = api_dir, port = port),
    stdout = out_file,
    stderr = err_file,
    supervise = TRUE,
    env = c(
      callr::rcmd_safe_env(),
      LC_ALL = lc,
      LANG = lc,
      PULSO_API_DIR = api_dir,
      PULSO_PUBLIC_MODE = "",
      PULSO_BOOTSTRAP_SID = ""
    )
  )

  url <- sprintf("http://127.0.0.1:%d", port)
  deadline <- Sys.time() + timeout_secs
  ready <- FALSE
  while (Sys.time() < deadline) {
    if (!proc$is_alive()) break
    ok <- tryCatch({
      h <- curl::new_handle(timeout = 5)
      resp <- curl::curl_fetch_memory(paste0(url, "/api/system/health"), handle = h)
      identical(as.integer(resp$status_code), 200L)
    }, error = function(e) FALSE)
    if (isTRUE(ok)) {
      ready <- TRUE
      break
    }
    Sys.sleep(0.5)
  }

  if (!ready) {
    diag <- .http_contract_tail(err_file)
    try(proc$kill(), silent = TRUE)
    stop(sprintf(
      "El backend real no levanto en %ds (puerto %d). Tail de stderr:\n%s",
      timeout_secs, port, diag
    ), call. = FALSE)
  }

  list(url = url, port = port, proc = proc, out_file = out_file, err_file = err_file)
}

# Server compartido dentro del archivo de test. Cacheado en el estado del
# helper; si el proceso murio (o lo mato el teardown del archivo anterior),
# se rebootea. El teardown del archivo que lo arranco lo apaga siempre.
http_contract_server <- function() {
  .http_contract_skip_if_unavailable()
  st <- .http_contract_state
  if (!is.null(st$boot_error)) {
    testthat::skip(st$boot_error)
  }
  srv <- st$server
  if (!is.null(srv) &&
      isTRUE(tryCatch(srv$proc$is_alive(), error = function(e) FALSE))) {
    return(srv)
  }
  st$server <- NULL

  api_dir <- .http_contract_api_dir()
  boot <- NULL
  # Dos intentos: cubre la carrera (rarisima) de randomPort vs bind.
  for (intento in 1:2) {
    boot <- tryCatch(.http_contract_boot_once(api_dir), error = function(e) e)
    if (!inherits(boot, "error")) break
  }
  if (inherits(boot, "error")) {
    st$boot_error <- paste("No se pudo levantar el backend real:", conditionMessage(boot))
    testthat::skip(st$boot_error)
  }

  st$server <- boot
  withr::defer({
    cur <- .http_contract_state$server
    if (!is.null(cur)) {
      try(cur$proc$kill(), silent = TRUE)
      .http_contract_state$server <- NULL
    }
  }, envir = testthat::teardown_env())
  boot
}

# --- Mini-cliente HTTP (curl) ------------------------------------------------
#
# El parse del lado cliente usa simplifyVector = FALSE a proposito: queremos
# assertar el shape EXACTO que el backend serializo, sin que jsonlite del
# cliente "arregle" nada.
.http_contract_parse_response <- function(resp) {
  # rawToChar falla con binarios (pptx trae NULs embebidos): en ese caso el
  # consumidor usa $raw y $json queda NULL.
  content_txt <- tryCatch({
    txt <- rawToChar(resp$content)
    Encoding(txt) <- "UTF-8"
    txt
  }, error = function(e) NA_character_)
  parsed <- if (!is.na(content_txt) && nzchar(content_txt)) {
    tryCatch(jsonlite::fromJSON(content_txt, simplifyVector = FALSE), error = function(e) NULL)
  } else {
    NULL
  }
  list(
    status = as.integer(resp$status_code),
    json = parsed,
    raw = resp$content,
    content_type = as.character(resp$type)
  )
}

.http_contract_request <- function(srv, path, method = "GET",
                                   body = NULL, sid = NULL, timeout = 120) {
  h <- curl::new_handle(timeout = timeout)
  headers <- c(Accept = "application/json")
  if (!is.null(sid)) headers <- c(headers, "X-Pulso-Session" = sid)
  if (identical(method, "POST")) {
    json <- if (is.null(body)) {
      "{}"
    } else {
      as.character(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null", na = "null"))
    }
    payload <- charToRaw(enc2utf8(json))
    curl::handle_setopt(h, post = TRUE, postfieldsize = length(payload), postfields = payload)
    headers <- c(headers, "Content-Type" = "application/json; charset=utf-8")
  }
  curl::handle_setheaders(h, .list = as.list(headers))
  .http_contract_parse_response(curl::curl_fetch_memory(paste0(srv$url, path), handle = h))
}

# Multipart real (el mismo que usa el frontend para subir archivos).
http_post_multipart <- function(srv, path, fields, sid = NULL, timeout = 120) {
  h <- curl::new_handle(timeout = timeout)
  headers <- c(Accept = "application/json")
  if (!is.null(sid)) headers <- c(headers, "X-Pulso-Session" = sid)
  curl::handle_setheaders(h, .list = as.list(headers))
  curl::handle_setform(h, .list = fields)
  .http_contract_parse_response(curl::curl_fetch_memory(paste0(srv$url, path), handle = h))
}

http_get <- function(srv, path, sid = NULL, timeout = 120) {
  .http_contract_request(srv, path, "GET", sid = sid, timeout = timeout)
}

http_post_json <- function(srv, path, body = NULL, sid = NULL, timeout = 120) {
  .http_contract_request(srv, path, "POST", body = body, sid = sid, timeout = timeout)
}

# Poll de /api/jobs/<id> hasta estado terminal. El GET mismo cosecha el
# resultado (job_poll es perezoso en el backend), no hace falta tick loop.
http_wait_job <- function(srv, job_id, timeout_secs = 300, poll_secs = 1) {
  deadline <- Sys.time() + timeout_secs
  last <- NULL
  while (Sys.time() < deadline) {
    r <- http_get(srv, paste0("/api/jobs/", job_id))
    if (!identical(r$status, 200L)) {
      stop(sprintf("Poll del job %s fallo con HTTP %d.", job_id, r$status), call. = FALSE)
    }
    last <- r$json
    if (as.character(last$status) %in% c("done", "error", "cancelled")) {
      return(last)
    }
    Sys.sleep(poll_secs)
  }
  last_status <- if (is.null(last)) "<sin poll>" else as.character(last$status)
  stop(sprintf(
    "Timeout (%ds) esperando el job %s; ultimo estado: %s",
    timeout_secs, job_id, last_status
  ), call. = FALSE)
}

# --- Base minima de fixture -------------------------------------------------
#
# XLSForm + data generados al vuelo (openxlsx), compatibles por construccion.
# No usamos los demos empaquetados (/api/system/demo): hoy giz, ops_salud y
# acreditacion fallan la guardia E_DATA_XLSFORM_INCOMPATIBLE (samples
# desalineados del instrumento — hallazgo aparte de esta suite).
.http_contract_fixture_paths <- function() {
  survey <- data.frame(
    type  = c("select_one lst_region", "select_one lst_clar", "integer"),
    name  = c("region", "claridad", "edad"),
    label = c("Region del servicio", "Claridad de la informacion", "Edad"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("lst_region", "lst_region", "lst_clar", "lst_clar"),
    name      = c("norte", "sur", "clara", "confusa"),
    label     = c("Norte", "Sur", "Clara", "Confusa"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  data <- data.frame(
    region   = c("norte", "sur", "norte", "norte", "sur", "sur", "norte", "sur"),
    claridad = c("clara", "clara", "confusa", "clara", "confusa", "clara", "clara", "confusa"),
    edad     = c(23L, 34L, 45L, 29L, 51L, 38L, 41L, 27L),
    stringsAsFactors = FALSE, check.names = FALSE
  )

  inst_path <- tempfile("http-contract-inst-", fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", survey)
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", choices)
  openxlsx::saveWorkbook(wb, inst_path, overwrite = TRUE)

  data_path <- tempfile("http-contract-data-", fileext = ".xlsx")
  openxlsx::write.xlsx(data, data_path, overwrite = TRUE)

  list(inst = inst_path, data = data_path, n_filas = nrow(data))
}

.http_contract_stop_http <- function(what, r) {
  stop(sprintf(
    "%s fallo con HTTP %d: %s",
    what, r$status, paste(deparse(r$json), collapse = " ")
  ), call. = FALSE)
}

# Sube la base minima por el flujo REAL de carga (multipart + endpoints de
# Fase 1) sobre una sesion fresca. Devuelve list(sid, n_filas, uploads).
http_contract_upload_base <- function(srv) {
  testthat::skip_if_not_installed("openxlsx")
  fx <- .http_contract_fixture_paths()
  withr::defer(unlink(c(fx$inst, fx$data), force = TRUE), envir = parent.frame())

  r <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  if (!identical(r$status, 200L)) .http_contract_stop_http("POST /api/session", r)
  sid <- r$json$session_id

  up_inst <- http_post_multipart(
    srv, "/api/files/upload?kind=xlsform",
    fields = list(file = curl::form_file(fx$inst)), sid = sid
  )
  if (!identical(up_inst$status, 201L)) .http_contract_stop_http("upload xlsform", up_inst)

  r_inst <- http_post_json(srv, "/api/carga/instrumento",
                           body = list(file_id = up_inst$json$file_id), sid = sid)
  if (!identical(r_inst$status, 200L)) .http_contract_stop_http("POST /api/carga/instrumento", r_inst)

  up_data <- http_post_multipart(
    srv, "/api/files/upload?kind=data",
    fields = list(file = curl::form_file(fx$data)), sid = sid
  )
  if (!identical(up_data$status, 201L)) .http_contract_stop_http("upload data", up_data)

  r_data <- http_post_json(srv, "/api/carga/data",
                           body = list(file_id = up_data$json$file_id), sid = sid)
  if (!identical(r_data$status, 200L)) .http_contract_stop_http("POST /api/carga/data", r_data)

  list(
    sid = sid,
    n_filas = fx$n_filas,
    instrumento_resumen = r_inst$json$resumen,
    data_preview = r_data$json$preview
  )
}
