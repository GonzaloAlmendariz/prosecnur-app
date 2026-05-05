#!/usr/bin/env Rscript

local({
  tryCatch(Sys.setlocale("LC_ALL", "English_United States.UTF-8"), error = function(e) NULL, warning = function(w) NULL)
  if (!isTRUE(l10n_info()[["UTF-8"]])) {
    tryCatch(Sys.setlocale("LC_ALL", "C.UTF-8"), error = function(e) NULL, warning = function(w) NULL)
  }
})
options(encoding = "UTF-8")

args <- commandArgs(trailingOnly = TRUE)
`%||%` <- function(a, b) {
  if (length(a) == 0 || is.na(a) || !nzchar(a)) b else a
}

package_arg <- if (length(args) >= 1) args[[1]] else ""
library_arg <- if (length(args) >= 2) args[[2]] else ""
package_dir <- normalizePath(package_arg %||% "runtime/r-packages", mustWork = FALSE)
library_value <- library_arg %||% Sys.getenv("R_LIBS_USER")
if (is.na(library_value) || !nzchar(library_value)) {
  stop("R_LIBS_USER no está definido y no se pasó una librería destino.", call. = FALSE)
}
library_dir <- normalizePath(library_value, mustWork = FALSE)

if (!dir.exists(package_dir)) {
  stop("No se encontró la carpeta de paquetes offline: ", package_dir, call. = FALSE)
}
dir.create(library_dir, recursive = TRUE, showWarnings = FALSE)
.libPaths(unique(c(library_dir, .libPaths())))

zip_files <- list.files(package_dir, pattern = "\\.zip$", full.names = TRUE)
if (!length(zip_files)) {
  stop("No hay paquetes .zip en: ", package_dir, call. = FALSE)
}

cat("[Prosecnur] Librería R offline: ", library_dir, "\n", sep = "")
cat("[Prosecnur] Instalando ", length(zip_files), " paquetes desde bundle local...\n", sep = "")
utils::install.packages(zip_files, repos = NULL, type = "win.binary", lib = library_dir)

file_arg <- grep("^--file=", commandArgs(FALSE), value = TRUE)[1] %||% NA_character_
script_path <- normalizePath(sub("^--file=", "", file_arg), mustWork = FALSE)
root <- normalizePath(file.path(dirname(script_path), ".."), mustWork = FALSE)
desc_path <- file.path(root, "api", "DESCRIPTION")
if (!file.exists(desc_path)) {
  stop("No se encontró api/DESCRIPTION dentro del bundle.", call. = FALSE)
}

desc <- read.dcf(desc_path)[1, ]
dependency_fields <- intersect(c("Depends", "Imports", "Suggests"), names(desc))
dependency_text <- paste(stats::na.omit(desc[dependency_fields]), collapse = ",")
required <- trimws(unlist(strsplit(dependency_text, ","), use.names = FALSE))
required <- sub("\\s*\\(.*\\)$", "", required)
required <- unique(c("pkgload", "quarto", setdiff(required[nzchar(required)], c("R", "testthat"))))

missing <- required[!vapply(required, requireNamespace, logical(1), quietly = TRUE)]
if (length(missing)) {
  stop("Faltan paquetes R tras instalación offline: ", paste(missing, collapse = ", "), call. = FALSE)
}

cat("[Prosecnur] Dependencias R offline listas.\n")
