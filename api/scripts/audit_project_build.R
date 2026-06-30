#!/usr/bin/env Rscript

arg_value <- function(args, flag, default = NULL) {
  eq <- paste0(flag, "=")
  hit <- args[startsWith(args, eq)]
  if (length(hit)) return(sub(eq, "", hit[[1]], fixed = TRUE))
  idx <- match(flag, args)
  if (!is.na(idx) && idx < length(args)) return(args[[idx + 1L]])
  default
}

has_flag <- function(args, flag) {
  flag %in% args
}

script_path <- local({
  args <- commandArgs(trailingOnly = FALSE)
  hit <- args[startsWith(args, "--file=")]
  if (length(hit)) sub("--file=", "", hit[[1]]) else "api/scripts/audit_project_build.R"
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
out_dir <- arg_value(args, "--out", audit_project_default_seed_root())
project <- arg_value(args, "--project", NULL)

if (has_flag(args, "--all")) {
  res <- audit_project_build_all(out_dir = out_dir, overwrite = TRUE)
  cat(normalizePath(res$out_dir, mustWork = FALSE), "\n", sep = "")
} else {
  if (is.null(project) || !nzchar(project)) {
    stop("Uso: audit_project_build.R --project <slug> --out <dir> o --all --out <dir>", call. = FALSE)
  }
  res <- audit_project_build(project, out_dir = out_dir, overwrite = TRUE)
  cat(normalizePath(res$project_path, mustWork = FALSE), "\n", sep = "")
}
