#!/usr/bin/env Rscript
# Genera el .pulso del catálogo del recetario (docs/qa/checklist-catalogo-recetario-2026-10-14.md).
# Uso, desde la raíz del repo: Rscript api/scripts/catalogo_recetario_build.R [--out <carpeta>]
Sys.setlocale("LC_ALL", "en_US.UTF-8")
args <- commandArgs(trailingOnly = TRUE)
i <- match("--out", args)
repo_root <- normalizePath(".", mustWork = TRUE)
Sys.setenv(PULSO_REPO_ROOT = repo_root)
suppressMessages(pkgload::load_all(file.path(repo_root, "api"), quiet = TRUE, export_all = TRUE))
out <- if (!is.na(i) && i < length(args)) args[[i + 1L]] else catalogo_recetario_dir()
res <- catalogo_recetario_build(out)
cat(res$project_path, " · ", res$n_laminas, " láminas\n", sep = "")
