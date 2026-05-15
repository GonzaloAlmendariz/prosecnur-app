#' Build the Plumber app with all routers mounted.
#'
#' @param static_dir Path to the directory containing the frontend build
#'   (typically `api/inst/www`). SPA fallback is wired to `index.html`.
#' @return A `plumber` object.
#' @export
build_plumber_app <- function(static_dir = system.file("www", package = "prosecnurapp")) {
  # Poblar el registry AST con los tipos de regla default. Hay que hacerlo
  # aquí (no al source de validacion_ast_registry.R) porque el package
  # carga sus archivos en orden alfabético y los constructores viven en
  # `validacion_ast_rules.R` — más tarde. Al arrancar la app ya están
  # todos disponibles.
  ensure_registry_populated()

  pr <- plumber::pr() |>
    plumber::pr_set_serializer(plumber::serializer_unboxed_json()) |>
    plumber::pr_set_error(function(req, res, err) handle_api_error(req, res, err))

  pr <- mount_sistema(pr)
  pr <- mount_jobs(pr)
  pr <- mount_proyecto(pr)
  pr <- mount_carga(pr)
  pr <- mount_xlsform_editor(pr)
  pr <- mount_estudio(pr)
  pr <- mount_validacion(pr)
  pr <- mount_codificacion(pr)
  pr <- mount_analitica(pr)
  pr <- mount_hojas_ruta(pr)
  pr <- mount_monitoreo(pr)
  pr <- mount_graficos(pr)
  pr <- mount_dashboard(pr)

  # Modo público (deploy web): filtro de whitelist para que solo pasen
  # endpoints read-only del dashboard. NO-OP cuando PULSO_PUBLIC_MODE
  # no está activo (Electron local).
  pr <- apply_public_mode_filter(pr)

  if (nzchar(static_dir) && dir.exists(static_dir)) {
    pr <- plumber::pr_filter(pr, "frontend_no_cache", function(req, res) {
      path <- req$PATH_INFO
      if (is.null(path)) path <- req$path
      if (is.null(path)) path <- ""
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
#' @param shutdown_grace_secs Segundos máximos para esperar jobs activos antes
#'   de matar el proceso cuando se recibe /api/system/shutdown.
#' @export
run_app <- function(host = "127.0.0.1", port = 8787L,
                    static_dir = system.file("www", package = "prosecnurapp"),
                    open_browser = TRUE,
                    shutdown_grace_secs = 5) {
  pr <- build_plumber_app(static_dir = static_dir)
  url <- sprintf("http://%s:%d/", host, port)

  if (open_browser) {
    later::later(function() utils::browseURL(url), delay = 1.5)
  }

  tick_interval <- 0.5
  shutdown_deadline <- NULL

  tick <- function() {
    job_poll_all()

    if (shutdown_requested()) {
      if (is.null(shutdown_deadline)) {
        shutdown_deadline <<- Sys.time() + shutdown_grace_secs
        message("[prosecnur-app] Shutdown requested — esperando hasta ",
                shutdown_grace_secs, "s a que terminen jobs activos.")
      }
      running <- jobs_count_running()
      past_deadline <- Sys.time() >= shutdown_deadline
      if (running == 0L || past_deadline) {
        if (running > 0L) {
          message(sprintf("[prosecnur-app] Timeout con %d job(s) activos, matando.", running))
          jobs_kill_all()
        }
        message("[prosecnur-app] Shutdown: quit().")
        quit(save = "no", status = 0)
      }
    }

    later::later(tick, delay = tick_interval)
  }
  later::later(tick, delay = tick_interval)

  message(sprintf("[prosecnur-app] Listening on %s", url))
  plumber::pr_set_docs(pr, FALSE)
  plumber::pr_run(pr, host = host, port = port, quiet = FALSE)
}
