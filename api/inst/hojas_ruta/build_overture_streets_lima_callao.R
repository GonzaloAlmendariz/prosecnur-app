#!/usr/bin/env Rscript

# Cachea localmente el slice Lima+Callao de Overture Maps Transportation.
# Se corre antes de build_osm_streets_lima_callao.R; ese script es el que
# hace el merge final OSM <-> Overture y produce los .geojson.gz por distrito.

options(stringsAsFactors = FALSE, warn = 1)

stop_if_missing <- function(pkg) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    stop(sprintf("Package '%s' is required.", pkg), call. = FALSE)
  }
}

stop_if_missing("DBI")
stop_if_missing("duckdb")
stop_if_missing("sf")
stop_if_missing("jsonlite")

`%||%` <- function(x, y) if (is.null(x) || length(x) == 0L) y else x

script_path <- sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE)[1] %||% ".")
script_dir <- dirname(normalizePath(script_path, mustWork = FALSE))
repo_root <- normalizePath(file.path(script_dir, "..", "..", ".."), mustWork = FALSE)
overture_streets_module <- file.path(repo_root, "api", "R", "overture_streets.R")
if (!file.exists(overture_streets_module)) {
  stop("No se encontró api/R/overture_streets.R", call. = FALSE)
}
source(overture_streets_module)

district_geojson_path <- file.path(repo_root, "frontend", "src", "features", "hojasRuta", "limaDistrictCoverage.json")
districts <- sf::st_read(district_geojson_path, quiet = TRUE)
districts <- sf::st_make_valid(districts)
bbox <- as.numeric(sf::st_bbox(districts))
# Padding 0.02° (~2.2 km) para incluir contexto de borde
pad <- 0.02
bbox <- c(bbox[[1]] - pad, bbox[[2]] - pad, bbox[[3]] + pad, bbox[[4]] + pad)
message(sprintf("BBox Lima+Callao (con padding): xmin=%.4f ymin=%.4f xmax=%.4f ymax=%.4f",
                bbox[[1]], bbox[[2]], bbox[[3]], bbox[[4]]))

release <- overture_release_pinned()
message("Overture release pin: ", release)

cache_dir <- Sys.getenv(
  "HOJAS_RUTA_OVERTURE_CACHE",
  file.path(path.expand("~"), ".prosecnurapp", "overture_cache")
)
dir.create(cache_dir, recursive = TRUE, showWarnings = FALSE)

cache_path <- Sys.getenv("HOJAS_RUTA_OVERTURE_PARQUET", "")
if (!nzchar(cache_path)) {
  cache_path <- file.path(cache_dir, sprintf("lima_callao_%s.parquet", release))
}

refresh <- isTRUE(as.logical(Sys.getenv("HOJAS_RUTA_OVERTURE_REFRESH", "FALSE")))

overture_fetch_segments_to_parquet(
  release = release,
  bbox = bbox,
  cache_path = cache_path,
  refresh = refresh
)

# Validación rápida: contar segmentos cacheados
con <- DBI::dbConnect(duckdb::duckdb())
on.exit(DBI::dbDisconnect(con, shutdown = TRUE), add = TRUE)
count <- DBI::dbGetQuery(con, sprintf("SELECT COUNT(*) AS n FROM read_parquet('%s')", cache_path))
message(sprintf("Overture segments cacheados: %d  (%.1f MB)",
                count$n,
                file.info(cache_path)$size / 1024 / 1024))
