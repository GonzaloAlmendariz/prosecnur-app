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
  if (length(hit)) sub("--file=", "", hit[[1]]) else "api/scripts/audit_reference_build.R"
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
out_dir <- arg_value(args, "--out", audit_reference_dir())
project <- arg_value(args, "--project", audit_reference_project_path(out_dir))

res <- audit_reference_build(dir = out_dir, project_path = project, overwrite = TRUE)
cat(normalizePath(res$project_path, mustWork = FALSE), "\n", sep = "")
