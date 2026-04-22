#!/usr/bin/env Rscript
# Instala las dependencias R necesarias para correr Prosecnur desde una
# carpeta local empaquetada o desde el repo de desarrollo.

local({
  tryCatch(Sys.setlocale("LC_ALL", "en_US.UTF-8"), error = function(e) NULL, warning = function(w) NULL)
  if (!isTRUE(l10n_info()[["UTF-8"]])) {
    tryCatch(Sys.setlocale("LC_ALL", "C.UTF-8"), error = function(e) NULL, warning = function(w) NULL)
  }
})
options(encoding = "UTF-8")

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

desc_path <- file.path(repo_root, "api", "DESCRIPTION")
if (!file.exists(desc_path)) {
  stop("No se encontró api/DESCRIPTION. Ejecutá este script desde la carpeta de Prosecnur.", call. = FALSE)
}

cat(sprintf("[Prosecnur] carpeta = %s\n", repo_root))

repos <- getOption("repos")
if (is.null(repos) || is.na(repos["CRAN"]) || identical(unname(repos["CRAN"]), "@CRAN@")) {
  options(repos = c(CRAN = "https://cloud.r-project.org"))
}

desc <- read.dcf(desc_path)[1, ]
dependency_fields <- intersect(c("Depends", "Imports"), names(desc))
dependency_text <- paste(stats::na.omit(desc[dependency_fields]), collapse = ",")
pkgs <- trimws(unlist(strsplit(dependency_text, ","), use.names = FALSE))
pkgs <- sub("\\s*\\(.*\\)$", "", pkgs)
pkgs <- unique(c("pkgload", pkgs))
pkgs <- setdiff(pkgs[nzchar(pkgs)], "R")

missing <- pkgs[!vapply(pkgs, requireNamespace, logical(1), quietly = TRUE)]

if (length(missing) == 0) {
  cat("[Prosecnur] Dependencias R listas.\n")
  quit(save = "no", status = 0)
}

cat("[Prosecnur] Instalando paquetes R faltantes:\n")
cat(paste(sprintf("  - %s", missing), collapse = "\n"), "\n", sep = "")
install.packages(missing)

still_missing <- missing[!vapply(missing, requireNamespace, logical(1), quietly = TRUE)]
if (length(still_missing) > 0) {
  stop(
    "No se pudieron instalar estas dependencias: ",
    paste(still_missing, collapse = ", "),
    call. = FALSE
  )
}

cat("[Prosecnur] Dependencias R instaladas correctamente.\n")
