#!/usr/bin/env Rscript
# Launcher for prosecnur-app.
# Run from the repo root: `Rscript launcher/launch.R`
# or via the OS wrappers in launcher/ (.command, .sh, .bat).

repo_root <- normalizePath(file.path(dirname(sys.frame(1)$ofile %||% "."), ".."), mustWork = FALSE)
if (!dir.exists(repo_root)) repo_root <- normalizePath(".", mustWork = FALSE)

`%||%` <- function(a, b) if (is.null(a)) b else a

Sys.setenv(PULSO_REPO_ROOT = repo_root)

api_dir <- file.path(repo_root, "api")
static_dir <- file.path(repo_root, "api", "inst", "www")

cat(sprintf("[prosecnur-app] repo_root = %s\n", repo_root))

if (requireNamespace("devtools", quietly = TRUE)) {
  devtools::load_all(api_dir, quiet = TRUE)
} else if (requireNamespace("pkgload", quietly = TRUE)) {
  pkgload::load_all(api_dir, quiet = TRUE)
} else {
  stop("Need 'devtools' or 'pkgload' installed to run in dev mode. Install with: install.packages('pkgload')")
}

port <- as.integer(Sys.getenv("PULSO_PORT", "8787"))
host <- Sys.getenv("PULSO_HOST", "127.0.0.1")

run_app(host = host, port = port, static_dir = static_dir, open_browser = TRUE)
