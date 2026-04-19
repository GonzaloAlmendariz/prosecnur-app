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
    list(error = list(code = err$code, message = conditionMessage(err), details = err$details))
  } else {
    res$status <- 500
    list(error = list(code = "E_INTERNAL", message = conditionMessage(err)))
  }
}

wrap_endpoint <- function(fn) {
  function(req, res, ...) {
    tryCatch(fn(req, res, ...), error = function(e) handle_api_error(req, res, e))
  }
}
