`%||%` <- function(a, b) if (is.null(a) || identical(a, "")) b else a

.session_env <- new.env(parent = emptyenv())

stop_api <- function(status, code, message, details = NULL) {
  err <- structure(
    list(status = status, code = code, message = message, details = details),
    class = c("api_error", "error", "condition")
  )
  stop(err)
}

handle_api_error <- function(req, res, err) {
  if (inherits(err, "api_error")) {
    res$status <- err$status
    return(list(error = list(code = err$code, message = conditionMessage(err), details = err$details)))
  }
  res$status <- 500L
  list(error = list(code = "E_INTERNAL", message = conditionMessage(err)))
}

wrap_endpoint <- function(fn) {
  function(req, res, ...) {
    tryCatch(fn(req, res, ...), error = function(e) handle_api_error(req, res, e))
  }
}

session_create <- function() {
  sid <- paste0(sample(c(letters, LETTERS, 0:9), 32L, replace = TRUE), collapse = "")
  .session_env[[sid]] <- list(
    id = sid,
    created_at = Sys.time(),
    dir = tempdir(),
    files = list(),
    project_path = NULL,
    project_dirty = FALSE,
    project_last_saved_at = NULL
  )
  sid
}

session_get <- function(sid, required = TRUE) {
  if (is.null(sid) || !nzchar(sid)) {
    if (required) stop_api(404, "E_NO_SESSION", "Missing X-Pulso-Session header.")
    return(NULL)
  }
  s <- .session_env[[sid]]
  if (is.null(s) && required) stop_api(404, "E_NO_SESSION", sprintf("Session %s not found.", sid))
  s
}

session_header <- function(req) {
  h <- req$HTTP_X_PULSO_SESSION
  if (is.null(h) || !nzchar(h)) NULL else h
}

.public_scalar <- function(x, default = "") {
  value <- as.character(x %||% default)[1]
  if (is.na(value) || !nzchar(value)) default else value
}

.public_artifact_normalize <- function(artifact = NULL, fallback_title = "Prosecnur") {
  artifact <- artifact %||% list()
  kind <- .public_scalar(artifact$kind, "dashboard")
  if (!kind %in% c("dashboard", "monitoreo")) kind <- "dashboard"
  list(
    kind = kind,
    title = .public_scalar(artifact$title, fallback_title),
    module = .public_scalar(artifact$module, kind),
    public_scope = .public_scalar(artifact$public_scope, if (identical(kind, "monitoreo")) "aggregate" else "dashboard"),
    profile_family = .public_scalar(artifact$profile_family, ""),
    report_scope = .public_scalar(artifact$report_scope, ""),
    published_at = .public_scalar(artifact$published_at, "")
  )
}

load_pulso <- function(src_path) {
  if (!file.exists(src_path)) {
    stop_api(404, "E_PULSO_NOT_FOUND", sprintf("No existe el archivo: %s", src_path))
  }
  stage_dir <- tempfile("pulso_public_load_")
  dir.create(stage_dir, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(stage_dir, recursive = TRUE, force = TRUE), add = TRUE)
  zip::unzip(src_path, exdir = stage_dir)

  manifest_path <- file.path(stage_dir, "manifest.json")
  manifest <- if (file.exists(manifest_path)) {
    tryCatch(jsonlite::fromJSON(manifest_path, simplifyVector = TRUE), error = function(e) list(format_version = 1L))
  } else {
    list(format_version = 1L)
  }
  state_path <- file.path(stage_dir, "state.rds")
  if (!file.exists(state_path)) {
    stop_api(400, "E_PULSO_CORRUPT", "El .pulso no contiene state.rds.")
  }
  s_saved <- tryCatch(readRDS(state_path), error = function(e) {
    stop_api(400, "E_PULSO_READ_FAILED", sprintf("No se pudo leer state.rds: %s", conditionMessage(e)))
  })
  sid <- session_create()
  fresh <- session_get(sid)
  s_saved$id <- sid
  s_saved$dir <- fresh$dir
  s_saved$project_path <- normalizePath(src_path, mustWork = FALSE)
  s_saved$project_dirty <- FALSE
  s_saved$project_last_saved_at <- as.character(manifest$saved_at %||% "")
  .session_env[[sid]] <- s_saved
  list(ok = TRUE, session_id = sid, project_path = s_saved$project_path, manifest = manifest)
}

is_public_mode <- function() {
  v <- Sys.getenv("PULSO_PUBLIC_MODE", "")
  nzchar(v) && !tolower(v) %in% c("0", "false", "no", "off")
}

PUBLIC_MODE_WHITELIST <- c(
  "GET /api/system/health",
  "GET /api/system/bootstrap",
  "GET /api/public/artifact",
  "GET /api/monitoreo/public-report"
)

public_request_allowed <- function(method, path) {
  if (!startsWith(path, "/api/")) return(TRUE)
  paste(toupper(method), path) %in% PUBLIC_MODE_WHITELIST
}

apply_public_mode_filter <- function(pr) {
  if (!is_public_mode()) return(pr)
  plumber::pr_filter(pr, "public_mode_guard", function(req, res) {
    method <- req$REQUEST_METHOD %||% "GET"
    path <- req$PATH_INFO %||% ""
    if (public_request_allowed(method, path)) {
      plumber::forward()
    } else {
      res$status <- 403L
      list(error = list(
        code = "E_FORBIDDEN_PUBLIC",
        message = sprintf("Endpoint '%s %s' no disponible en modo publico.", method, path)
      ))
    }
  })
}

.bootstrap_sid <- function() {
  sid <- Sys.getenv("PULSO_BOOTSTRAP_SID", "")
  if (nzchar(sid)) sid else NULL
}

.effective_sid <- function(req) {
  sid <- session_header(req)
  if (is.null(sid) || is.null(session_get(sid, required = FALSE))) sid <- .bootstrap_sid()
  sid
}

.public_artifact_descriptor <- function(sid) {
  s <- session_get(sid)
  .public_artifact_normalize(s$public_artifact %||% list(kind = "monitoreo"), "Reporte de avance")
}

.public_monitoreo_report <- function(sid) {
  s <- session_get(sid)
  payload <- s$public_artifact_payload$monitoreo_report %||% NULL
  if (!is.list(payload)) {
    stop_api(409, "E_NO_PUBLIC_PAYLOAD", "El artefacto publicado no contiene payload publico de Monitoreo.")
  }
  payload
}

build_plumber_app <- function(static_dir = system.file("www", package = "prosecnurapp")) {
  pr <- plumber::pr() |>
    plumber::pr_set_serializer(plumber::serializer_unboxed_json()) |>
    plumber::pr_set_error(function(req, res, err) handle_api_error(req, res, err))

  pr <- pr |>
    plumber::pr_get("/api/system/health", wrap_endpoint(function(req, res) {
      list(
        ok = TRUE,
        version = as.character(utils::packageVersion("prosecnurapp")),
        prosecnur_version = as.character(utils::packageVersion("prosecnurapp")),
        time = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
      )
    })) |>
    plumber::pr_get("/api/system/bootstrap", wrap_endpoint(function(req, res) {
      list(sid = .bootstrap_sid())
    })) |>
    plumber::pr_get("/api/public/artifact", wrap_endpoint(function(req, res) {
      .public_artifact_descriptor(.effective_sid(req))
    })) |>
    plumber::pr_get("/api/monitoreo/public-report", wrap_endpoint(function(req, res) {
      .public_monitoreo_report(.effective_sid(req))
    }))

  pr <- apply_public_mode_filter(pr)

  if (nzchar(static_dir) && dir.exists(static_dir)) {
    pr <- plumber::pr_filter(pr, "frontend_no_cache", function(req, res) {
      path <- req$PATH_INFO %||% req$path %||% ""
      if (!startsWith(path, "/api/")) {
        res$setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        res$setHeader("Pragma", "no-cache")
        res$setHeader("Expires", "0")
      }
      plumber::forward()
    })
    pr <- plumber::pr_static(pr, "/", static_dir)
    pr <- plumber::pr_get(pr, "/<path:path>", function(req, res, path) {
      if (startsWith(path, "api/")) {
        res$status <- 404L
        return(list(error = list(code = "E_NOT_FOUND", message = "Unknown API route")))
      }
      index <- file.path(static_dir, "index.html")
      if (file.exists(index)) plumber::include_file(index, res, content_type = "text/html") else {
        res$status <- 404L
        list(error = list(code = "E_NO_FRONTEND", message = "Frontend build not found"))
      }
    })
  }
  pr
}

run_app <- function(host = "0.0.0.0", port = 7860L, static_dir = system.file("www", package = "prosecnurapp")) {
  pr <- build_plumber_app(static_dir = static_dir)
  pr$run(host = host, port = port)
}
