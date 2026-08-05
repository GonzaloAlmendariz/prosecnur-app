#!/usr/bin/env Rscript
# Descarga los binarios Windows de las versiones exactas fijadas en
# api/renv.lock y falla si el índice CRAN ya no puede satisfacerlas.

args <- commandArgs(trailingOnly = TRUE)
out_arg <- if (length(args) >= 1) args[[1]] else ""
r_version <- if (length(args) >= 2) args[[2]] else ""
if (is.na(out_arg) || !nzchar(out_arg) || is.na(r_version) || !nzchar(r_version)) {
  stop("Uso: Rscript download-r-win-binaries.R <out-dir> <r-version>", call. = FALSE)
}
dir.create(out_arg, recursive = TRUE, showWarnings = FALSE)
out_dir <- normalizePath(out_arg, mustWork = TRUE)

r_minor <- sub("^(\\d+\\.\\d+).*$", "\\1", r_version)

# La fecha del snapshot vive en packaging/r-snapshot-date.txt, fuente única
# compartida con el descargador de macOS (ADR 0059): las dos plataformas leen
# el mismo calendario y lock + fecha avanzan juntos en el mismo commit.
read_snapshot_date <- function() {
  snapshot_path <- file.path(getwd(), "packaging", "r-snapshot-date.txt")
  if (!file.exists(snapshot_path)) {
    stop(
      "Ejecuta este script desde la raíz del repo; no encontré packaging/r-snapshot-date.txt.",
      call. = FALSE
    )
  }
  lines <- readLines(snapshot_path, warn = FALSE, encoding = "UTF-8")
  snapshot_date <- if (length(lines)) trimws(lines[[1]]) else ""
  if (!grepl("^[0-9]{4}-[0-9]{2}-[0-9]{2}$", snapshot_date) ||
      is.na(as.Date(snapshot_date, format = "%Y-%m-%d"))) {
    stop(
      "packaging/r-snapshot-date.txt debe contener una fecha ISO (AAAA-MM-DD) real.",
      call. = FALSE
    )
  }
  snapshot_date
}

test_repository <- Sys.getenv("PROSECNUR_BINARY_TEST_REPOSITORY")
if (nzchar(test_repository)) {
  if (!identical(Sys.getenv("PROSECNUR_BINARY_TEST_MODE"), "1")) {
    stop("PROSECNUR_BINARY_TEST_REPOSITORY solo se permite en modo de prueba.", call. = FALSE)
  }
  contrib <- sub("/+$", "", test_repository)
} else {
  # CRAN Windows no publica MD5 de binarios. El snapshot fechado de Posit
  # conserva exactamente las versiones del lock y expone un Hash MD5
  # autoritativo por archivo, requisito para aceptar cachés o descargas.
  contrib <- sprintf(
    "https://packagemanager.posit.co/cran/%s/bin/windows/contrib/%s",
    read_snapshot_date(),
    r_minor
  )
}

lock_path <- file.path(getwd(), "api", "renv.lock")
if (!file.exists(lock_path)) {
  stop("Ejecuta este script desde la raíz del repo; no encontré api/renv.lock.", call. = FALSE)
}

extract_field <- function(lines, field) {
  line <- lines[grepl(sprintf('^\\s*"%s"\\s*:', field), lines)]
  if (!length(line)) return(NA_character_)
  sub(sprintf('^\\s*"%s"\\s*:\\s*"([^"]+)".*$', field), "\\1", line[[1]])
}

read_lock_records <- function(file) {
  lines <- readLines(file, warn = FALSE, encoding = "UTF-8")
  packages_start <- grep('^  "Packages"\\s*:\\s*\\{', lines)
  if (length(packages_start) != 1) stop("api/renv.lock no contiene Packages.", call. = FALSE)
  r_lines <- lines[seq_len(packages_start - 1)]
  lock_r <- extract_field(r_lines, "Version")
  records <- list()
  current <- NULL
  block <- character()
  for (line in lines[(packages_start + 1):length(lines)]) {
    start <- regexec('^    "([^"]+)"\\s*:\\s*\\{$', line)
    captured <- regmatches(line, start)[[1]]
    if (length(captured) == 2) {
      current <- captured[[2]]
      block <- character()
      next
    }
    if (!is.null(current) && grepl("^    \\},?$", line)) {
      records[[current]] <- list(
        package = extract_field(block, "Package"),
        version = extract_field(block, "Version"),
        source = extract_field(block, "Source"),
        repository = extract_field(block, "Repository"),
        source_md5 = extract_field(block, "MD5sum")
      )
      current <- NULL
      next
    }
    if (!is.null(current)) block <- c(block, line)
  }
  list(r_version = lock_r, packages = records)
}

lock <- read_lock_records(lock_path)
if (!identical(r_version, lock$r_version) || as.character(getRversion()) != lock$r_version) {
  stop(
    "El lock, el argumento y el runtime deben usar R ", lock$r_version,
    " (argumento=", r_version, "; runtime=", as.character(getRversion()), ").",
    call. = FALSE
  )
}
packages <- sort(names(lock$packages))
invalid <- packages[!vapply(
  packages,
  function(package) {
    record <- lock$packages[[package]]
    identical(record$package, package) &&
      identical(record$source, "Repository") &&
      identical(record$repository, "CRAN") &&
      grepl("^[0-9a-f]{32}$", record$source_md5)
  },
  logical(1)
)]
if (length(invalid)) {
  stop("Registros inválidos en api/renv.lock: ", paste(invalid, collapse = ", "), call. = FALSE)
}

cat("[Prosecnur] Leyendo índice CRAN Windows: ", contrib, "\n", sep = "")
db <- available.packages(contriburl = contrib, fields = c("Hash", "MD5sum"))
missing <- setdiff(packages, rownames(db))
mismatched <- intersect(packages, rownames(db))
mismatched <- mismatched[vapply(
  mismatched,
  function(package) !identical(db[package, "Version"], lock$packages[[package]]$version),
  logical(1)
)]
if (length(missing) || length(mismatched)) {
  details <- c(
    if (length(missing)) paste0("ausentes: ", paste(missing, collapse = ", ")),
    if (length(mismatched)) paste0(
      "versión distinta: ",
      paste(sprintf(
        "%s lock=%s CRAN=%s",
        mismatched,
        vapply(lock$packages[mismatched], `[[`, character(1), "version"),
        db[mismatched, "Version"]
      ), collapse = ", ")
    )
  )
  stop("CRAN Windows no satisface el lock (", paste(details, collapse = "; "), ").", call. = FALSE)
}
if (identical(Sys.getenv("PROSECNUR_BINARY_CHECK_ONLY"), "1")) {
  cat("[Prosecnur] Lock satisfecho por CRAN Windows: ", length(packages), " paquetes exactos.\n", sep = "")
  quit(save = "no", status = 0)
}

expected_files <- sprintf(
  "%s_%s.zip",
  packages,
  vapply(lock$packages[packages], `[[`, character(1), "version")
)
cache_marker_name <- ".prosecnur-r-binary-cache"
cache_marker_value <- paste("prosecnur-r-binary-cache-v1", "windows", r_version, sep = ":")

claim_cache <- function(directory) {
  root <- normalizePath(directory, mustWork = TRUE)
  unsafe_roots <- unique(c(
    normalizePath("/", mustWork = TRUE),
    normalizePath(getwd(), mustWork = TRUE),
    normalizePath(path.expand("~"), mustWork = TRUE),
    normalizePath(tempdir(), mustWork = TRUE),
    normalizePath(dirname(tempdir()), mustWork = TRUE)
  ))
  if (root %in% unsafe_roots || identical(dirname(root), root)) {
    stop("Directorio de caché inseguro: ", root, call. = FALSE)
  }
  entries <- list.files(root, all.files = TRUE, no.. = TRUE, full.names = TRUE)
  marker <- file.path(root, cache_marker_name)
  if (marker %in% entries) {
    if (dir.exists(marker) || nzchar(Sys.readlink(marker))) {
      stop("Sentinel de caché inválido: ", marker, call. = FALSE)
    }
    marker_contents <- paste(readLines(marker, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
    if (!identical(marker_contents, cache_marker_value)) {
      stop("El sentinel no corresponde a este caché Windows.", call. = FALSE)
    }
    return(invisible(root))
  }
  if (length(entries)) {
    info <- file.info(entries)
    names <- basename(entries)
    known_legacy <- !is.na(info$isdir) &
      !info$isdir &
      !nzchar(Sys.readlink(entries)) &
      (names == "manifest.csv" | grepl("^[A-Za-z][A-Za-z0-9.]*_[0-9][A-Za-z0-9.-]*\\.zip$", names))
    if (!all(known_legacy)) {
      stop(
        "Caché sin sentinel contiene entradas ajenas; se rechaza sin borrar: ",
        paste(names[!known_legacy], collapse = ", "),
        call. = FALSE
      )
    }
  }
  writeLines(cache_marker_value, marker, useBytes = TRUE)
  if (!file.exists(marker)) stop("No se pudo crear el sentinel del caché.", call. = FALSE)
  invisible(root)
}

prune_cache <- function(directory, expected_names) {
  root <- normalizePath(directory, mustWork = TRUE)
  entries <- list.files(root, all.files = TRUE, no.. = TRUE, full.names = TRUE)
  expected_names <- c(expected_names, cache_marker_name)
  extras <- entries[!basename(entries) %in% expected_names]
  for (entry in extras) {
    if (!identical(normalizePath(dirname(entry), mustWork = TRUE), root)) {
      stop("Entrada fuera del caché durante la poda: ", entry, call. = FALSE)
    }
    unlink(entry, recursive = TRUE, force = TRUE)
    if (file.exists(entry) || dir.exists(entry)) {
      stop("No se pudo podar del caché: ", entry, call. = FALSE)
    }
  }
}

expected_binary_md5 <- function(package) {
  for (field in c("MD5sum", "Hash")) {
    if (!field %in% colnames(db)) next
    candidate <- as.character(db[package, field])
    if (!is.na(candidate) && grepl("^[0-9A-Fa-f]{32}$", candidate)) {
      return(tolower(candidate))
    }
  }
  stop(
    "El índice Windows no publica un checksum MD5 autoritativo para ",
    package,
    ".",
    call. = FALSE
  )
}

claim_cache(out_dir)
prune_cache(out_dir, expected_files)
cat("[Prosecnur] Paquetes Windows a descargar: ", length(packages), "\n", sep = "")
binary_md5 <- setNames(character(length(packages)), packages)
for (pkg in packages) {
  version <- lock$packages[[pkg]]$version
  file <- sprintf("%s_%s.zip", pkg, version)
  dest <- file.path(out_dir, file)
  expected_md5 <- expected_binary_md5(pkg)
  if (dir.exists(dest)) unlink(dest, recursive = TRUE, force = TRUE)
  if (file.exists(dest) && file.info(dest)$size > 0) {
    actual_md5 <- unname(tools::md5sum(dest))
    if (identical(actual_md5, expected_md5)) {
      cat("[cache] ", file, "\n", sep = "")
      binary_md5[[pkg]] <- actual_md5
      next
    }
    unlink(dest, force = TRUE)
  }
  url <- paste0(contrib, "/", file)
  cat("[download] ", url, "\n", sep = "")
  utils::download.file(url, dest, mode = "wb", quiet = TRUE)
  if (!file.exists(dest) || file.info(dest)$size <= 0) stop("Descarga vacía: ", url, call. = FALSE)
  actual_md5 <- unname(tools::md5sum(dest))
  if (!identical(actual_md5, expected_md5)) {
    unlink(dest, force = TRUE)
    stop("Checksum binario inválido para ", file, ".", call. = FALSE)
  }
  binary_md5[[pkg]] <- actual_md5
}

manifest <- data.frame(
  package = packages,
  version = vapply(lock$packages[packages], `[[`, character(1), "version"),
  source_md5 = vapply(lock$packages[packages], `[[`, character(1), "source_md5"),
  binary_md5 = unname(binary_md5[packages]),
  file = sprintf(
    "%s_%s.zip",
    packages,
    vapply(lock$packages[packages], `[[`, character(1), "version")
  ),
  stringsAsFactors = FALSE
)
utils::write.csv(manifest, file.path(out_dir, "manifest.csv"), row.names = FALSE)
actual_entries <- sort(list.files(out_dir, all.files = TRUE, no.. = TRUE))
expected_entries <- sort(c(expected_files, "manifest.csv", cache_marker_name))
if (!identical(actual_entries, expected_entries)) {
  stop("El caché Windows no coincide exactamente con el lock después de descargar.", call. = FALSE)
}
cat("[Prosecnur] Manifest: ", file.path(out_dir, "manifest.csv"), "\n", sep = "")
