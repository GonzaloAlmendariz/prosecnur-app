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

lock_path <- file.path(repo_root, "api", "renv.lock")
if (!file.exists(lock_path)) {
  stop("No se encontró api/renv.lock; no se instalarán dependencias sin resolución exacta.", call. = FALSE)
}

cat(sprintf("[Prosecnur] carpeta = %s\n", repo_root))

target_r <- "4.5.1"
if (as.character(getRversion()) != target_r) {
  stop(
    "api/renv.lock exige R ", target_r,
    "; esta sesión usa R ", as.character(getRversion()), ".",
    call. = FALSE
  )
}

repo <- "https://cloud.r-project.org"
options(repos = c(CRAN = repo))

user_lib <- Sys.getenv("R_LIBS_USER", unset = "")
if (!nzchar(user_lib)) {
  user_lib <- file.path(path.expand("~"), "R", paste0("library-", target_r))
}
dir.create(user_lib, recursive = TRUE, showWarnings = FALSE)
.libPaths(unique(c(user_lib, .libPaths())))

extract_field <- function(block, field) {
  pattern <- sprintf('"%s"\\s*:\\s*"([^"]+)"', field)
  match <- regexec(pattern, block, perl = TRUE)
  value <- regmatches(block, match)[[1]]
  if (length(value) == 2) value[[2]] else NA_character_
}

canonical_package_version <- function(value) {
  tryCatch(
    as.character(base::package_version(value)),
    error = function(e) NA_character_
  )
}

lock_text <- paste(readLines(lock_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
renv_match <- regexpr('(?s)"renv"\\s*:\\s*\\{.*?\\n\\s*\\}', lock_text, perl = TRUE)
if (renv_match[[1]] == -1) {
  stop("api/renv.lock no fija el paquete bootstrap renv.", call. = FALSE)
}
renv_block <- regmatches(lock_text, renv_match)
renv_version <- extract_field(renv_block, "Version")
renv_md5 <- extract_field(renv_block, "MD5sum")
if (is.na(renv_version) || is.na(renv_md5) || !grepl("^[0-9a-f]{32}$", renv_md5)) {
  stop("El registro renv del lock no contiene Version y MD5sum verificables.", call. = FALSE)
}

renv_version_canonical <- canonical_package_version(renv_version)
installed_renv <- tryCatch(
  canonical_package_version(utils::packageVersion("renv")),
  error = function(e) NA_character_
)
if (!identical(installed_renv, renv_version_canonical)) {
  tarball <- tempfile(sprintf("renv_%s_", renv_version), fileext = ".tar.gz")
  urls <- c(
    sprintf("%s/src/contrib/renv_%s.tar.gz", repo, renv_version),
    sprintf("%s/src/contrib/Archive/renv/renv_%s.tar.gz", repo, renv_version)
  )
  downloaded <- FALSE
  for (url in urls) {
    status <- tryCatch(
      utils::download.file(url, tarball, mode = "wb", quiet = TRUE),
      error = function(e) 1L,
      warning = function(w) 1L
    )
    if (identical(status, 0L) && file.exists(tarball) && file.info(tarball)$size > 0) {
      downloaded <- TRUE
      break
    }
  }
  if (!downloaded) stop("No se pudo descargar renv ", renv_version, " desde CRAN.", call. = FALSE)
  actual_md5 <- unname(tools::md5sum(tarball))
  if (!identical(actual_md5, renv_md5)) {
    stop("Checksum inválido para el bootstrap renv: esperado ", renv_md5, ", recibido ", actual_md5, ".", call. = FALSE)
  }
  utils::install.packages(tarball, repos = NULL, type = "source", lib = user_lib)
}

if (!requireNamespace("renv", quietly = TRUE) ||
    canonical_package_version(utils::packageVersion("renv")) != renv_version_canonical) {
  stop("No se pudo activar renv ", renv_version, ".", call. = FALSE)
}

lock <- renv::lockfile_read(lock_path)
packages <- names(lock$Packages)
cat("[Prosecnur] Restaurando ", length(packages), " paquetes desde api/renv.lock.\n", sep = "")
renv::restore(
  project = repo_root,
  library = user_lib,
  lockfile = lock_path,
  packages = packages,
  repos = c(CRAN = repo),
  prompt = FALSE
)

versions <- vapply(
  packages,
  function(package) {
    tryCatch(
      canonical_package_version(utils::packageVersion(package)),
      error = function(e) NA_character_
    )
  },
  character(1)
)
expected_raw <- vapply(lock$Packages, `[[`, character(1), "Version")
expected <- vapply(expected_raw, canonical_package_version, character(1))
mismatch <- packages[is.na(versions) | versions != expected]
if (length(mismatch)) {
  details <- sprintf(
    "%s (esperado %s; instalado %s)",
    mismatch,
    expected_raw[mismatch],
    versions[mismatch]
  )
  stop("La restauración no coincide con el lock: ", paste(details, collapse = ", "), call. = FALSE)
}

cat("[Prosecnur] Dependencias R restauradas y verificadas contra api/renv.lock.\n")
