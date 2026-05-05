#!/usr/bin/env Rscript

# Builds a lightweight offline street-reference layer for Hojas de ruta.
# Source: OpenStreetMap extract for Peru distributed by Geofabrik.

options(stringsAsFactors = FALSE, warn = 1)

stop_if_missing <- function(pkg) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    stop(sprintf("Package '%s' is required.", pkg), call. = FALSE)
  }
}

stop_if_missing("curl")
stop_if_missing("jsonlite")
stop_if_missing("sf")

`%||%` <- function(x, y) if (is.null(x) || length(x) == 0L) y else x

script_path <- sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE)[1] %||% ".")
script_dir <- dirname(normalizePath(script_path, mustWork = FALSE))
repo_root <- normalizePath(file.path(script_dir, "..", "..", ".."), mustWork = FALSE)
district_geojson_path <- file.path(repo_root, "frontend", "src", "features", "hojasRuta", "limaDistrictCoverage.json")

source_url <- "https://download.geofabrik.de/south-america/peru-latest.osm.pbf"
pbf_path <- Sys.getenv("HOJAS_RUTA_OSM_PBF", "")
if (!nzchar(pbf_path)) {
  cache_dir <- Sys.getenv(
    "HOJAS_RUTA_OSM_CACHE",
    file.path(path.expand("~"), ".prosecnurapp", "osm_cache")
  )
  dir.create(cache_dir, recursive = TRUE, showWarnings = FALSE)
  pbf_path <- file.path(cache_dir, "peru-latest.osm.pbf")
}
if (!file.exists(pbf_path) || isTRUE(as.logical(Sys.getenv("HOJAS_RUTA_OSM_REFRESH", "FALSE")))) {
  message("Downloading ", source_url)
  curl::curl_download(source_url, pbf_path, quiet = FALSE, mode = "wb")
}

out_dir <- Sys.getenv(
  "HOJAS_RUTA_OSM_STREETS_OUT_DIR",
  file.path(script_dir, "cartografia", "calles_osm_lima_callao")
)
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

manifest_path <- Sys.getenv(
  "HOJAS_RUTA_OSM_STREETS_MANIFEST",
  file.path(script_dir, "cartografia_calles_osm_lima_callao.json")
)

sf::sf_use_s2(FALSE)

osmconf <- system.file("gdal", "osmconf.ini", package = "sf")
if (nzchar(osmconf) && !nzchar(Sys.getenv("OSM_CONFIG_FILE"))) {
  Sys.setenv(OSM_CONFIG_FILE = osmconf)
}

districts <- sf::st_read(district_geojson_path, quiet = TRUE)
districts$ubigeo <- as.character(districts$ubigeo)
districts$distrito <- as.character(districts$distrito)
districts <- sf::st_transform(sf::st_make_valid(districts), 32718)

message("Reading OSM lines from ", pbf_path)
roads <- sf::st_read(
  pbf_path,
  layer = "lines",
  quiet = TRUE
)

major_highways <- c(
  "motorway", "motorway_link",
  "trunk", "trunk_link",
  "primary", "primary_link",
  "secondary", "secondary_link"
)
detail_highways <- c("tertiary", "tertiary_link", "unclassified", "residential", "living_street")
keep_highways <- c(major_highways, detail_highways)

roads$highway <- as.character(roads$highway)
if (!"name" %in% names(roads)) roads$name <- rep("", nrow(roads))
roads$name <- trimws(as.character(roads$name))
roads$name[is.na(roads$name)] <- ""
roads <- roads[roads$highway %in% keep_highways, , drop = FALSE]
roads <- roads[
  roads$highway %in% c(major_highways, "tertiary", "tertiary_link") |
    nzchar(roads$name),
  ,
  drop = FALSE
]

normalize_ascii <- function(x) {
  x <- iconv(x, from = "", to = "ASCII//TRANSLIT")
  tolower(trimws(x %||% ""))
}

street_name_norm <- normalize_ascii(roads$name)
roads$avenue_like <- grepl("(^|\\b)(av[.]?|avenida|via expresa|circuito)(\\b|[[:space:]])", street_name_norm)
roads$class_group <- ifelse(
  roads$highway %in% major_highways,
  "major",
  ifelse(roads$avenue_like | roads$highway %in% c("tertiary", "tertiary_link"), "avenue", "detail")
)
roads$rank <- ifelse(grepl("^motorway|^trunk", roads$highway), 1L,
  ifelse(grepl("^primary", roads$highway), 2L,
    ifelse(grepl("^secondary", roads$highway), 3L,
      ifelse(grepl("^tertiary", roads$highway), 4L, ifelse(roads$avenue_like, 5L, 7L))
    )
  )
)
roads$display_name <- ifelse(nzchar(roads$name), roads$name, "")
roads <- sf::st_transform(sf::st_zm(roads, drop = TRUE, what = "ZM"), 32718)
roads <- suppressWarnings(sf::st_make_valid(roads))
roads <- suppressWarnings(sf::st_filter(roads, sf::st_union(districts), .predicate = sf::st_intersects))

write_gzip_text <- function(text, path) {
  con <- gzfile(path, open = "wt", encoding = "UTF-8", compression = 9)
  on.exit(close(con), add = TRUE)
  writeLines(text, con = con, useBytes = TRUE)
}

write_street_geojson <- function(sf_obj, path) {
  tmp <- tempfile(fileext = ".geojson")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  sf::st_write(sf_obj, tmp, driver = "GeoJSON", delete_dsn = TRUE, quiet = TRUE)
  txt <- paste(readLines(tmp, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  write_gzip_text(txt, path)
}

counts <- data.frame(ubigeo = character(), streets = integer(), stringsAsFactors = FALSE)
all_lengths <- 0

for (i in seq_len(nrow(districts))) {
  district <- districts[i, , drop = FALSE]
  ubigeo <- district$ubigeo[[1]]
  message("Packing streets for ", ubigeo, " ", district$distrito[[1]])
  sub <- suppressWarnings(sf::st_intersection(roads, sf::st_geometry(district)))
  sub <- sub[!sf::st_is_empty(sub), , drop = FALSE]

  if (nrow(sub) > 0L) {
    sub$length_m <- as.numeric(sf::st_length(sf::st_geometry(sub)))
    all_lengths <- all_lengths + sum(sub$length_m, na.rm = TRUE)
    tolerance <- ifelse(sub$rank <= 3, 0.75, ifelse(sub$class_group == "avenue", 1.25, 3))
    geom <- sf::st_geometry(sub)
    geom_simplified <- lapply(seq_along(geom), function(j) {
      sf::st_simplify(geom[[j]], dTolerance = tolerance[[j]], preserveTopology = TRUE)
    })
    sf::st_geometry(sub) <- sf::st_sfc(geom_simplified, crs = sf::st_crs(sub))
    sub <- sub[, c("osm_id", "name", "highway", "class_group", "rank", "avenue_like", "display_name", "length_m")]
    sub <- sf::st_transform(sub, 4326)
  } else {
    sub <- sf::st_sf(
      osm_id = character(),
      name = character(),
      highway = character(),
      class_group = character(),
      rank = integer(),
      avenue_like = logical(),
      display_name = character(),
      length_m = numeric(),
      geometry = sf::st_sfc(crs = 4326)
    )
  }

  out_file <- file.path(out_dir, sprintf("%s.geojson.gz", ubigeo))
  write_street_geojson(sub, out_file)
  counts <- rbind(counts, data.frame(ubigeo = ubigeo, streets = nrow(sub), stringsAsFactors = FALSE))
}

files <- list.files(out_dir, pattern = "[.]geojson[.]gz$", full.names = TRUE)
manifest <- list(
  id = "osm-geofabrik-peru-streets-lima-callao",
  version = "osm-geofabrik-peru-streets-lima-callao-v2",
  coverage = "Lima Metropolitana y Callao",
  provider = "OpenStreetMap contributors / Geofabrik GmbH",
  source = "OpenStreetMap Peru extract distributed by Geofabrik",
  source_url = "https://download.geofabrik.de/south-america/peru.html",
  extract_url = source_url,
  license = "Open Database License (ODbL) 1.0",
  license_url = "https://www.openstreetmap.org/copyright",
  geometry = "linea_vial",
  spatial_reference_api = "EPSG:4326",
  native_id_field = "osm_id",
  class_field = "highway",
  name_field = "name",
  packaging_mode = "local_only",
  compression = "gzip_por_distrito",
  packaged_scope = "Vias principales, avenidas por nombre y detalle nombrado por distrito para Lima Metropolitana y Callao",
  included_highways = keep_highways,
  excluded_highways = c("service", "path", "footway", "cycleway", "track", "steps", "pedestrian"),
  packaged_districts = as.integer(nrow(counts)),
  packaged_streets = as.integer(sum(counts$streets, na.rm = TRUE)),
  packaged_length_km = round(all_lengths / 1000, 1),
  packaged_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  pbf_last_modified = as.character(file.info(pbf_path)$mtime),
  pbf_size = as.integer(file.info(pbf_path)$size),
  checksum = as.list(stats::setNames(unname(tools::md5sum(files)), basename(files))),
  attribution = "© OpenStreetMap contributors · ODbL",
  note = paste(
    "Capa de referencia para orientacion en campo con jerarquia visual de avenidas.",
    "No reemplaza cartografia censal ni rutas de navegacion."
  )
)

writeLines(
  jsonlite::toJSON(manifest, auto_unbox = TRUE, pretty = TRUE, null = "null"),
  con = manifest_path,
  useBytes = TRUE
)

message("Wrote ", nrow(counts), " districts, ", sum(counts$streets), " street features.")
