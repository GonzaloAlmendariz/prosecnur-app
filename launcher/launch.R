#!/usr/bin/env Rscript
# Launcher for prosecnur-app.
# Run from the repo root: `Rscript launcher/launch.R`
# or via the OS wrappers in launcher/ (.command, .sh, .bat).

# Locale UTF-8. Sin esto, R lee los .R del paquete prosecnur (que tienen
# comentarios y strings con tildes) en locale C y el launcher rompe con
# "invalid input found on input connection". También afecta la salida
# JSON: strings como "descripción" se escapan a "<U+00F3>" en vez de UTF-8
# real. Fallback a C.UTF-8 si en_US.UTF-8 no está disponible (Linux
# minimalista, containers Alpine, etc.).
local({
  tryCatch(Sys.setlocale("LC_ALL", "en_US.UTF-8"), error = function(e) NULL, warning = function(w) NULL)
  if (!isTRUE(l10n_info()[["UTF-8"]])) {
    tryCatch(Sys.setlocale("LC_ALL", "C.UTF-8"), error = function(e) NULL, warning = function(w) NULL)
  }
})
options(encoding = "UTF-8")

`%||%` <- function(a, b) if (is.null(a)) b else a

.script_path <- local({
  args <- commandArgs(trailingOnly = FALSE)
  fmatch <- "--file="
  hit <- args[startsWith(args, fmatch)]
  if (length(hit) > 0) sub(fmatch, "", hit[1]) else NA_character_
})
repo_root <- if (!is.na(.script_path)) {
  normalizePath(file.path(dirname(.script_path), ".."), mustWork = FALSE)
} else {
  normalizePath(".", mustWork = FALSE)
}
if (!dir.exists(repo_root)) repo_root <- normalizePath(".", mustWork = FALSE)

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
