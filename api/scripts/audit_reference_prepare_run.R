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
  if (length(hit)) sub("--file=", "", hit[[1]]) else "api/scripts/audit_reference_prepare_run.R"
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
seed <- arg_value(args, "--seed", audit_reference_project_path())
root <- arg_value(
  args,
  "--root",
  file.path(repo_root, "outputs", "audit-runs")
)
run_id <- arg_value(args, "--run-id", format(Sys.time(), "%Y%m%dT%H%M%SZ", tz = "UTC"))

manifest <- audit_reference_prepare_run(
  seed_project = seed,
  runs_root = root,
  run_id = run_id
)
cat(normalizePath(manifest, mustWork = FALSE), "\n", sep = "")
