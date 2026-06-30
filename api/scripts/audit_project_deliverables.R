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
  if (length(hit)) sub("--file=", "", hit[[1]]) else "api/scripts/audit_project_deliverables.R"
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
out_dir <- arg_value(args, "--out", file.path(repo_root, "outputs", "audit-projects", "deliverables", project %||% ""))
seed_project <- arg_value(args, "--seed", NULL)
seed_root <- arg_value(args, "--seed-root", NULL)

if (is.null(project) || !nzchar(project)) {
  stop("Uso: audit_project_deliverables.R --project <slug> --out <dir> [--seed <project.pulso>]", call. = FALSE)
}

res <- audit_project_deliverables(project, out_dir = out_dir, seed_project = seed_project, seed_root = seed_root)
cat(normalizePath(file.path(out_dir, "report.json"), mustWork = FALSE), "\n", sep = "")
if (!isTRUE(res$ok)) quit(status = 1L)
