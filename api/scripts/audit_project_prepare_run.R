#!/usr/bin/env Rscript

arg_value <- function(args, flag, default = NULL) {
  eq <- paste0(flag, "=")
  hit <- args[startsWith(args, eq)]
  if (length(hit)) return(sub(eq, "", hit[[1]], fixed = TRUE))
  idx <- match(flag, args)
  if (!is.na(idx) && idx < length(args)) return(args[[idx + 1L]])
  default
}

script_path <- local({
  args <- commandArgs(trailingOnly = FALSE)
  hit <- args[startsWith(args, "--file=")]
  if (length(hit)) sub("--file=", "", hit[[1]]) else "api/scripts/audit_project_prepare_run.R"
})
repo_root <- normalizePath(file.path(dirname(script_path), "..", ".."), mustWork = FALSE)
api_dir <- file.path(repo_root, "api")
Sys.setenv(PULSO_REPO_ROOT = repo_root, PULSO_API_DIR = api_dir)

if (requireNamespace("pkgload", quietly = TRUE)) {
  pkgload::load_all(api_dir, quiet = TRUE, export_all = TRUE)
} else if (requireNamespace("devtools", quietly = TRUE)) {
  devtools::load_all(api_dir, quiet = TRUE, export_all = TRUE)
} else {
  stop("Falta pkgload o devtools para cargar prosecnurapp.", call. = FALSE)
}

args <- commandArgs(trailingOnly = TRUE)
project <- arg_value(args, "--project", NULL)
root <- arg_value(args, "--root", file.path(repo_root, "outputs", "audit-runs"))
seed <- arg_value(args, "--seed", NULL)
run_id <- arg_value(args, "--run-id", format(Sys.time(), "%Y%m%dT%H%M%SZ", tz = "UTC"))

if (is.null(project) || !nzchar(project)) {
  stop("Uso: audit_project_prepare_run.R --project <slug> --root <dir> [--seed <pulso>]", call. = FALSE)
}

manifest <- audit_project_prepare_run(
  slug = project,
  runs_root = root,
  seed_project = seed,
  run_id = run_id
)
cat(normalizePath(manifest, mustWork = FALSE), "\n", sep = "")
