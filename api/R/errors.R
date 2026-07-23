stop_api <- function(status, code, message, details = NULL) {
  err <- structure(
    list(status = status, code = code, message = message, details = details),
    class = c("api_error", "error", "condition")
  )
  stop(err)
}

# Id corto de correlación para errores internos. Derivado del timestamp con
# resolución de microsegundos (hex, 8 chars): único en la práctica dentro de
# una sesión de server y sin tocar el estado del RNG global.
.api_error_id <- function() {
  micros <- as.numeric(Sys.time()) * 1e6
  sprintf("%08X", as.integer(micros %% (.Machine$integer.max + 1)))
}

handle_api_error <- function(req, res, err) {
  if (inherits(err, "api_error")) {
    res$status <- err$status
    list(error = list(code = err$code, message = conditionMessage(err), details = err$details))
  } else {
    # E_INTERNAL nunca expone el conditionMessage crudo al cliente: puede
    # filtrar paths absolutos del usuario u otros detalles del sistema. Al
    # wire va un mensaje genérico + error_id; el detalle completo queda en
    # stderr del server, correlacionable por ese mismo id.
    res$status <- 500
    error_id <- .api_error_id()
    message(sprintf("[prosecnur-app] E_INTERNAL %s: %s", error_id, conditionMessage(err)))
    list(error = list(
      code = "E_INTERNAL",
      message = sprintf("Error interno del servidor (ref. %s).", error_id),
      error_id = error_id
    ))
  }
}

wrap_endpoint <- function(fn) {
  function(req, res, ...) {
    tryCatch(fn(req, res, ...), error = function(e) handle_api_error(req, res, e))
  }
}
