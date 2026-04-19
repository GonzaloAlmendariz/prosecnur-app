#' Build the Plumber app with all routers mounted.
#'
#' @param static_dir Path to the directory containing the frontend build
#'   (typically `api/inst/www`). SPA fallback is wired to `index.html`.
#' @return A `plumber` object.
#' @export
build_plumber_app <- function(static_dir = system.file("www", package = "prosecnurapp")) {
  pr <- plumber::pr() |>
    plumber::pr_set_serializer(plumber::serializer_unboxed_json()) |>
    plumber::pr_set_error(function(req, res, err) handle_api_error(req, res, err))

  pr <- mount_sistema(pr)
  pr <- mount_carga(pr)
  pr <- mount_validacion(pr)

  if (nzchar(static_dir) && dir.exists(static_dir)) {
    pr <- plumber::pr_static(pr, "/", static_dir)
    pr <- plumber::pr_get(pr, "/<path:path>", function(req, res, path) {
      if (startsWith(path, "api/")) {
        res$status <- 404
        return(list(error = list(code = "E_NOT_FOUND", message = "Unknown API route")))
      }
      index <- file.path(static_dir, "index.html")
      if (file.exists(index)) plumber::include_file(index, res, content_type = "text/html")
      else {
        res$status <- 404
        list(error = list(code = "E_NO_FRONTEND", message = "Frontend build not found"))
      }
    })
  }

  pr
}

#' Run the app on localhost.
#'
#' @param host Host to bind. Default `"127.0.0.1"`.
#' @param port Port. Default `8787`.
#' @param static_dir Path to frontend build.
#' @param open_browser If TRUE, opens the default browser after boot.
#' @export
run_app <- function(host = "127.0.0.1", port = 8787L,
                    static_dir = system.file("www", package = "prosecnurapp"),
                    open_browser = TRUE) {
  pr <- build_plumber_app(static_dir = static_dir)
  url <- sprintf("http://%s:%d/", host, port)

  if (open_browser) {
    later::later(function() utils::browseURL(url), delay = 1.5)
  }

  message(sprintf("[prosecnur-app] Listening on %s", url))
  plumber::pr_set_docs(pr, FALSE)
  plumber::pr_run(pr, host = host, port = port, quiet = FALSE)
}
