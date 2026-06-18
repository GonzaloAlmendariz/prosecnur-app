#!/usr/bin/env Rscript

args <- commandArgs(trailingOnly = TRUE)

arg_value <- function(flag, default = "") {
  hit <- which(args == flag)
  if (!length(hit) || hit[[1]] >= length(args)) return(default)
  args[[hit[[1]] + 1L]]
}

arg_has <- function(flag) {
  flag %in% args
}

file_arg <- grep("^--file=", commandArgs(FALSE), value = TRUE)
script_path <- if (length(file_arg)) sub("^--file=", "", file_arg[[1]]) else file.path("scripts", "monitoreo-publish-qa.R")
repo_root <- normalizePath(file.path(dirname(normalizePath(script_path, mustWork = FALSE)), ".."), mustWork = FALSE)
if (!file.exists(file.path(repo_root, "api", "tests", "testthat", "setup-load-all.R"))) {
  repo_root <- normalizePath(getwd(), mustWork = FALSE)
}

source(file.path(repo_root, "api", "tests", "testthat", "setup-load-all.R"))

split_arg <- function(value, default) {
  if (!nzchar(value)) return(default)
  out <- trimws(strsplit(value, ",", fixed = TRUE)[[1]])
  out[nzchar(out)]
}

out_dir <- arg_value("--out", file.path(repo_root, "tmp", "visual-qa", "monitoreo-publish-qa"))
families <- split_arg(arg_value("--families", ""), c("territorial", "acreditacion"))
audiences <- split_arg(arg_value("--audiences", ""), c("client", "internal"))

report <- monitoreo_publish_qa_generate(
  out_dir = out_dir,
  families = families,
  audiences = audiences,
  write_workbooks = !arg_has("--no-workbooks"),
  render_spaces = !arg_has("--no-spaces")
)

cat(jsonlite::toJSON(report, auto_unbox = TRUE, null = "null", dataframe = "rows", pretty = TRUE), "\n")
if (!isTRUE(report$ok) && arg_has("--fail-on-issues")) quit(status = 1L)
