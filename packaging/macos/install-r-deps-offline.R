#!/usr/bin/env Rscript
# Hermano de packaging/windows/install-r-deps-offline.R pero para macOS:
# instala paquetes binarios .tgz desde una carpeta local en una library
# destino. Llamado por mac-bootstrap.cjs al primer arranque del .dmg.
#
# Uso:
#   Rscript install-r-deps-offline.R <packages-dir> <library-dir>

local({
  tryCatch(Sys.setlocale("LC_ALL", "es_PE.UTF-8"), error = function(e) NULL, warning = function(w) NULL)
  if (!isTRUE(l10n_info()[["UTF-8"]])) {
    tryCatch(Sys.setlocale("LC_ALL", "en_US.UTF-8"), error = function(e) NULL, warning = function(w) NULL)
  }
})
options(encoding = "UTF-8")

args <- commandArgs(trailingOnly = TRUE)
`%||%` <- function(a, b) if (length(a) == 0 || is.na(a) || !nzchar(a)) b else a

package_arg <- if (length(args) >= 1) args[[1]] else ""
library_arg <- if (length(args) >= 2) args[[2]] else ""
package_dir <- normalizePath(package_arg %||% "r-packages", mustWork = FALSE)
library_value <- library_arg %||% Sys.getenv("R_LIBS_USER")
if (is.na(library_value) || !nzchar(library_value)) {
  stop("R_LIBS_USER no esta definido y no se paso una libreria destino.", call. = FALSE)
}
library_dir <- normalizePath(library_value, mustWork = FALSE)

if (!dir.exists(package_dir)) {
  stop("No se encontro la carpeta de paquetes offline: ", package_dir, call. = FALSE)
}
dir.create(library_dir, recursive = TRUE, showWarnings = FALSE)
.libPaths(unique(c(library_dir, .libPaths())))

tgz_files <- list.files(package_dir, pattern = "\\.tgz$", full.names = TRUE)
if (!length(tgz_files)) {
  stop("No hay paquetes .tgz en: ", package_dir, call. = FALSE)
}

manifest_path <- file.path(package_dir, "manifest.csv")
if (!file.exists(manifest_path) || file.info(manifest_path)$size <= 0) {
  stop("Falta manifest.csv para verificar los paquetes offline.", call. = FALSE)
}
manifest <- utils::read.csv(
  manifest_path,
  colClasses = "character",
  check.names = FALSE,
  stringsAsFactors = FALSE
)
required_manifest_fields <- c("package", "version", "binary_md5", "file")
if (!nrow(manifest) || !all(required_manifest_fields %in% names(manifest))) {
  stop("manifest.csv no cumple el contrato de paquetes offline.", call. = FALSE)
}
if (
  anyNA(manifest[required_manifest_fields]) ||
  any(!nzchar(manifest$file)) ||
  anyDuplicated(manifest$file) ||
  any(basename(manifest$file) != manifest$file) ||
  any(!grepl("^[0-9A-Fa-f]{32}$", manifest$binary_md5))
) {
  stop("manifest.csv contiene entradas inválidas o duplicadas.", call. = FALSE)
}
expected_files <- sort(manifest$file)
actual_files <- sort(basename(tgz_files))
if (!identical(actual_files, expected_files)) {
  stop("El bundle macOS no coincide exactamente con manifest.csv.", call. = FALSE)
}
declared_md5 <- setNames(tolower(manifest$binary_md5), manifest$file)
actual_md5 <- unname(tools::md5sum(file.path(package_dir, expected_files)))
invalid_md5 <- expected_files[actual_md5 != unname(declared_md5[expected_files])]
if (length(invalid_md5)) {
  stop(
    "Checksum inválido en paquetes offline macOS: ",
    paste(invalid_md5, collapse = ", "),
    call. = FALSE
  )
}

cat("[Prosecnur] Libreria R offline: ", library_dir, "\n", sep = "")
cat("[Prosecnur] Instalando ", length(tgz_files), " paquetes mac desde bundle local...\n", sep = "")
utils::install.packages(tgz_files, repos = NULL, type = "mac.binary", lib = library_dir)

# Verificacion: las dependencias declaradas en api/DESCRIPTION cargan?
# En el .app empaquetado, api/DESCRIPTION vive en Contents/Resources/Internals/api/.
# Buscamos hacia arriba.
script_path <- normalizePath(sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE)[1] %||% ""), mustWork = FALSE)
script_dir <- dirname(script_path)
desc_candidates <- c(
  file.path(script_dir, "..", "api", "DESCRIPTION"),
  file.path(script_dir, "..", "..", "api", "DESCRIPTION"),
  file.path(dirname(library_dir), "..", "api", "DESCRIPTION")
)
desc_path <- NA_character_
for (cand in desc_candidates) {
  if (file.exists(cand)) { desc_path <- normalizePath(cand); break }
}

if (!is.na(desc_path)) {
  desc <- read.dcf(desc_path)[1, ]
  dependency_fields <- intersect(c("Depends", "Imports"), names(desc))
  dependency_text <- paste(stats::na.omit(desc[dependency_fields]), collapse = ",")
  required <- trimws(unlist(strsplit(dependency_text, ","), use.names = FALSE))
  required <- sub("\\s*\\(.*\\)$", "", required)
  required <- unique(c("pkgload", setdiff(required[nzchar(required)], c("R", "testthat"))))
  missing <- required[!vapply(required, requireNamespace, logical(1), quietly = TRUE)]
  if (length(missing)) {
    stop("Faltan paquetes R tras instalacion offline: ", paste(missing, collapse = ", "), call. = FALSE)
  }
}

cat("[Prosecnur] Dependencias R mac listas.\n")
