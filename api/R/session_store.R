.session_env <- new.env(parent = emptyenv())

session_root_dir <- function() {
  root <- file.path(tempdir(), "pulso-report")
  if (!dir.exists(root)) dir.create(root, recursive = TRUE)
  root
}

session_create <- function() {
  sid <- uuid::UUIDgenerate()
  sdir <- file.path(session_root_dir(), sid)
  for (sub in c("uploads", "state", "jobs", "downloads")) {
    dir.create(file.path(sdir, sub), recursive = TRUE, showWarnings = FALSE)
  }
  .session_env[[sid]] <- list(
    id = sid,
    created_at = Sys.time(),
    dir = sdir,
    files = list(),
    instrumento = NULL,
    data_raw = NULL
  )
  sid
}

session_get <- function(sid, required = TRUE) {
  if (is.null(sid) || !nzchar(sid)) {
    if (required) stop_api(404, "E_NO_SESSION", "Missing X-Pulso-Session header.")
    return(NULL)
  }
  s <- .session_env[[sid]]
  if (is.null(s) && required) {
    stop_api(404, "E_NO_SESSION", sprintf("Session %s not found.", sid))
  }
  s
}

session_set <- function(sid, key, value) {
  s <- session_get(sid)
  s[[key]] <- value
  .session_env[[sid]] <- s
  invisible(value)
}

session_delete <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(FALSE)
  unlink(s$dir, recursive = TRUE, force = TRUE)
  rm(list = sid, envir = .session_env)
  TRUE
}

session_header <- function(req) {
  h <- req$HTTP_X_PULSO_SESSION
  if (is.null(h) || !nzchar(h)) NULL else h
}
