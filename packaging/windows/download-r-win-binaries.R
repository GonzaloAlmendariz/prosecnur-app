#!/usr/bin/env Rscript

args <- commandArgs(trailingOnly = TRUE)
out_arg <- if (length(args) >= 1) args[[1]] else ""
r_version <- if (length(args) >= 2) args[[2]] else ""
if (is.na(out_arg) || !nzchar(out_arg) || is.na(r_version) || !nzchar(r_version)) {
  stop("Uso: Rscript download-r-win-binaries.R <out-dir> <r-version>", call. = FALSE)
}
out_dir <- normalizePath(out_arg, mustWork = FALSE)

dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

repo <- "https://cloud.r-project.org"
r_minor <- sub("^(\\d+\\.\\d+).*$", "\\1", r_version)
contrib <- paste0(repo, "/bin/windows/contrib/", r_minor)

desc_path <- file.path(getwd(), "api", "DESCRIPTION")
if (!file.exists(desc_path)) {
  stop("Ejecuta este script desde la raíz del repo; no encontré api/DESCRIPTION.", call. = FALSE)
}

desc <- read.dcf(desc_path)[1, ]
dependency_fields <- intersect(c("Depends", "Imports", "Suggests"), names(desc))
dependency_text <- paste(stats::na.omit(desc[dependency_fields]), collapse = ",")
root_pkgs <- trimws(unlist(strsplit(dependency_text, ","), use.names = FALSE))
root_pkgs <- sub("\\s*\\(.*\\)$", "", root_pkgs)
root_pkgs <- unique(c("pkgload", "quarto", setdiff(root_pkgs[nzchar(root_pkgs)], c("R", "testthat"))))

cat("[Prosecnur] Leyendo índice CRAN Windows: ", contrib, "\n", sep = "")
db <- available.packages(contriburl = contrib)
deps <- tools::package_dependencies(root_pkgs, db = db, which = c("Depends", "Imports", "LinkingTo"), recursive = TRUE)
packages <- unique(c(root_pkgs, unlist(deps, use.names = FALSE)))
packages <- packages[packages %in% rownames(db)]
packages <- sort(packages)

missing <- setdiff(root_pkgs, c(packages, rownames(installed.packages(priority = c("base", "recommended")))))
if (length(missing)) {
  warning("No encontré estos paquetes en CRAN Windows: ", paste(missing, collapse = ", "))
}

cat("[Prosecnur] Paquetes Windows a descargar: ", length(packages), "\n", sep = "")
for (pkg in packages) {
  version <- db[pkg, "Version"]
  file <- sprintf("%s_%s.zip", pkg, version)
  dest <- file.path(out_dir, file)
  if (file.exists(dest) && file.info(dest)$size > 0) {
    cat("[cache] ", file, "\n", sep = "")
    next
  }
  url <- paste0(contrib, "/", file)
  cat("[download] ", url, "\n", sep = "")
  utils::download.file(url, dest, mode = "wb", quiet = TRUE)
}

manifest <- data.frame(
  package = packages,
  version = db[packages, "Version"],
  file = sprintf("%s_%s.zip", packages, db[packages, "Version"]),
  stringsAsFactors = FALSE
)
utils::write.csv(manifest, file.path(out_dir, "manifest.csv"), row.names = FALSE)
cat("[Prosecnur] Manifest: ", file.path(out_dir, "manifest.csv"), "\n", sep = "")
