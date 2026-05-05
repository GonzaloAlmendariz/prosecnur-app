#!/usr/bin/env Rscript

# Builds an offline urban-context layer for Hojas de ruta.
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
  "HOJAS_RUTA_OSM_CONTEXT_OUT_DIR",
  file.path(script_dir, "cartografia", "contexto_osm_lima_callao")
)
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

manifest_path <- Sys.getenv(
  "HOJAS_RUTA_OSM_CONTEXT_MANIFEST",
  file.path(script_dir, "cartografia_contexto_osm_lima_callao.json")
)

sf::sf_use_s2(FALSE)

osmconf <- system.file("gdal", "osmconf.ini", package = "sf")
if (nzchar(osmconf) && !nzchar(Sys.getenv("OSM_CONFIG_FILE"))) {
  Sys.setenv(OSM_CONFIG_FILE = osmconf)
}

field <- function(x, nm, default = "") {
  if (!nm %in% names(x)) return(rep(default, nrow(x)))
  out <- as.character(x[[nm]])
  out[is.na(out)] <- default
  out
}

tag_value <- function(x, key) {
  x <- as.character(x %||% "")
  out <- rep("", length(x))
  pattern <- paste0('"', key, '"=>"(.*?)"')
  hit <- regexec(pattern, x)
  vals <- regmatches(x, hit)
  found <- lengths(vals) >= 2L
  out[found] <- vapply(vals[found], `[[`, character(1), 2L)
  out
}

coalesce_tag <- function(sf_obj, keys) {
  values <- rep("", nrow(sf_obj))
  for (key in keys) {
    candidate <- if (key %in% names(sf_obj)) field(sf_obj, key) else rep("", nrow(sf_obj))
    if ("other_tags" %in% names(sf_obj)) {
      other <- tag_value(sf_obj$other_tags, key)
      candidate[!nzchar(candidate)] <- other[!nzchar(candidate)]
    }
    values[!nzchar(values) & nzchar(candidate)] <- candidate[!nzchar(values) & nzchar(candidate)]
  }
  values
}

display_name <- function(name, fallback = "") {
  out <- trimws(as.character(name %||% ""))
  out[!nzchar(out)] <- fallback[!nzchar(out)]
  out
}

districts <- sf::st_read(district_geojson_path, quiet = TRUE)
districts$ubigeo <- as.character(districts$ubigeo)
districts$distrito <- as.character(districts$distrito)
districts <- sf::st_transform(sf::st_make_valid(districts), 32718)
district_union <- sf::st_union(districts)
district_context_union <- sf::st_buffer(district_union, 900)

message("Reading OSM multipolygons from ", pbf_path)
polygons <- sf::st_read(pbf_path, layer = "multipolygons", quiet = TRUE)
polygons <- sf::st_transform(sf::st_zm(polygons, drop = TRUE, what = "ZM"), 32718)
polygons <- suppressWarnings(sf::st_make_valid(polygons))
polygons <- suppressWarnings(sf::st_filter(polygons, district_context_union, .predicate = sf::st_intersects))

read_multipolygon_query <- function(where) {
  query <- paste("SELECT * FROM multipolygons WHERE", where)
  out <- tryCatch(sf::st_read(pbf_path, query = query, quiet = TRUE), error = function(e) NULL)
  if (is.null(out) || !nrow(out)) return(NULL)
  out <- sf::st_transform(sf::st_zm(out, drop = TRUE, what = "ZM"), 32718)
  out <- suppressWarnings(sf::st_make_valid(out))
  suppressWarnings(sf::st_filter(out, district_context_union, .predicate = sf::st_intersects))
}

extra_golf <- read_multipolygon_query("leisure = 'golf_course' OR other_tags LIKE '%\"golf\"=>%'")
if (!is.null(extra_golf) && nrow(extra_golf)) {
  polygons <- rbind(polygons, extra_golf)
  polygon_key <- paste(
    field(polygons, "osm_id"),
    field(polygons, "osm_way_id"),
    field(polygons, "name"),
    sf::st_as_text(sf::st_centroid(sf::st_geometry(polygons))),
    sep = "|"
  )
  polygons <- polygons[!duplicated(polygon_key), , drop = FALSE]
}

poly_name <- field(polygons, "name")
poly_leisure <- coalesce_tag(polygons, c("leisure"))
poly_landuse <- coalesce_tag(polygons, c("landuse"))
poly_natural <- coalesce_tag(polygons, c("natural"))
poly_water <- coalesce_tag(polygons, c("water"))
poly_amenity <- coalesce_tag(polygons, c("amenity"))
poly_tourism <- coalesce_tag(polygons, c("tourism"))
poly_place <- coalesce_tag(polygons, c("place"))
poly_building <- coalesce_tag(polygons, c("building"))
poly_highway <- coalesce_tag(polygons, c("highway"))

is_water <- poly_natural %in% c("water", "bay", "wetland", "beach") |
  poly_water %in% c("lake", "river", "pond", "reservoir", "basin", "canal", "lagoon", "reflecting_pool") |
  poly_landuse %in% c("reservoir", "basin") |
  poly_amenity %in% c("fountain")
is_green <- poly_leisure %in% c("park", "garden", "golf_course", "nature_reserve", "playground", "pitch", "sports_centre", "stadium", "recreation_ground") |
  poly_landuse %in% c("grass", "recreation_ground", "forest", "cemetery", "meadow", "village_green", "allotments") |
  poly_natural %in% c("wood", "scrub", "grassland", "heath")
is_square <- poly_place %in% c("square") | poly_highway %in% c("pedestrian")
is_public <- poly_amenity %in% c("hospital", "clinic", "police", "fire_station", "townhall", "courthouse", "marketplace", "library") |
  poly_tourism %in% c("museum") |
  (nzchar(poly_building) & nzchar(poly_name) & poly_amenity %in% c("public_building", "community_centre"))

poly_keep <- is_water | is_green | is_square | is_public
polygons <- polygons[poly_keep, , drop = FALSE]
if (nrow(polygons)) {
  kept_water <- is_water[poly_keep]
  kept_green <- is_green[poly_keep]
  kept_square <- is_square[poly_keep]
  kept_public <- is_public[poly_keep]
  polygons$feature_class <- ifelse(kept_water, "water",
    ifelse(kept_green, "green",
      ifelse(kept_square, "square", "landmark")
    )
  )
  polygons$kind <- ifelse(nzchar(poly_leisure[poly_keep]), poly_leisure[poly_keep],
    ifelse(nzchar(poly_landuse[poly_keep]), poly_landuse[poly_keep],
      ifelse(nzchar(poly_natural[poly_keep]), poly_natural[poly_keep],
        ifelse(nzchar(poly_amenity[poly_keep]), poly_amenity[poly_keep],
          ifelse(nzchar(poly_tourism[poly_keep]), poly_tourism[poly_keep], poly_place[poly_keep])
        )
      )
    )
  )
  polygons$display_name <- display_name(poly_name[poly_keep], polygons$kind)
  polygons$rank <- ifelse(polygons$feature_class == "water", 1L,
    ifelse(polygons$feature_class == "green", 2L,
      ifelse(nzchar(poly_name[poly_keep]), 3L, 5L)
    )
  )
  polygons$area_m2 <- as.numeric(sf::st_area(sf::st_geometry(polygons)))
  polygons <- polygons[polygons$area_m2 >= ifelse(polygons$feature_class %in% c("water", "green"), 120, 250), , drop = FALSE]
}

message("Reading OSM water/coast lines from ", pbf_path)
lines <- sf::st_read(pbf_path, layer = "lines", quiet = TRUE)
lines <- sf::st_transform(sf::st_zm(lines, drop = TRUE, what = "ZM"), 32718)
lines <- suppressWarnings(sf::st_make_valid(lines))
lines <- suppressWarnings(sf::st_filter(lines, district_context_union, .predicate = sf::st_intersects))
line_name <- field(lines, "name")
line_waterway <- coalesce_tag(lines, c("waterway"))
line_natural <- coalesce_tag(lines, c("natural"))
line_keep <- line_waterway %in% c("river", "stream", "canal", "drain") |
  line_natural %in% c("coastline")
lines <- lines[line_keep, , drop = FALSE]
if (nrow(lines)) {
  lines$feature_class <- ifelse(line_natural[line_keep] == "coastline", "coast", "waterway")
  lines$kind <- ifelse(nzchar(line_waterway[line_keep]), line_waterway[line_keep], line_natural[line_keep])
  lines$display_name <- display_name(line_name[line_keep], lines$kind)
  lines$rank <- ifelse(lines$feature_class == "coast", 1L, 2L)
  lines$length_m <- as.numeric(sf::st_length(sf::st_geometry(lines)))
  lines <- lines[lines$length_m >= 35, , drop = FALSE]
}

message("Reading OSM points from ", pbf_path)
points <- sf::st_read(pbf_path, layer = "points", quiet = TRUE)
points <- sf::st_transform(sf::st_zm(points, drop = TRUE, what = "ZM"), 32718)
points <- suppressWarnings(sf::st_make_valid(points))
points <- suppressWarnings(sf::st_filter(points, district_context_union, .predicate = sf::st_intersects))
point_name <- field(points, "name")
point_amenity <- coalesce_tag(points, c("amenity"))
point_tourism <- coalesce_tag(points, c("tourism"))
point_leisure <- coalesce_tag(points, c("leisure"))
point_place <- coalesce_tag(points, c("place"))

poi_keep <- nzchar(point_name) & (
  point_amenity %in% c("hospital", "clinic", "police", "fire_station", "townhall", "courthouse", "marketplace", "library") |
    point_tourism %in% c("museum") |
    point_leisure %in% c("park", "garden", "sports_centre") |
    point_place %in% c("square")
)
points <- points[poi_keep, , drop = FALSE]
if (nrow(points)) {
  points$feature_class <- ifelse(point_amenity[poi_keep] %in% c("hospital", "clinic", "police", "fire_station", "townhall", "courthouse", "library", "marketplace"), "public",
      ifelse(point_leisure[poi_keep] %in% c("park", "garden") | point_place[poi_keep] == "square", "green", "landmark")
  )
  points$kind <- ifelse(nzchar(point_amenity[poi_keep]), point_amenity[poi_keep],
    ifelse(nzchar(point_tourism[poi_keep]), point_tourism[poi_keep],
      ifelse(nzchar(point_leisure[poi_keep]), point_leisure[poi_keep], point_place[poi_keep])
    )
  )
  points$display_name <- display_name(point_name[poi_keep], points$kind)
  points$rank <- ifelse(points$feature_class == "green", 2L,
    ifelse(points$feature_class == "public", 3L,
      5L
    )
  )
}

write_gzip_text <- function(text, path) {
  con <- gzfile(path, open = "wt", encoding = "UTF-8", compression = 9)
  on.exit(close(con), add = TRUE)
  writeLines(text, con = con, useBytes = TRUE)
}

sf_features <- function(sf_obj) {
  if (is.null(sf_obj) || !nrow(sf_obj)) return(list())
  tmp <- tempfile(fileext = ".geojson")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  sf::st_write(sf_obj, tmp, driver = "GeoJSON", delete_dsn = TRUE, quiet = TRUE)
  jsonlite::read_json(tmp, simplifyVector = FALSE)$features %||% list()
}

prepare_layer <- function(sf_obj, cols, tolerance) {
  if (is.null(sf_obj) || !nrow(sf_obj)) return(NULL)
  out <- sf_obj[, intersect(cols, names(sf_obj)), drop = FALSE]
  geom <- sf::st_geometry(out)
  if (tolerance > 0) {
    geom_simplified <- lapply(seq_along(geom), function(j) {
      sf::st_simplify(geom[[j]], dTolerance = tolerance, preserveTopology = TRUE)
    })
    sf::st_geometry(out) <- sf::st_sfc(geom_simplified, crs = sf::st_crs(out))
  }
  sf::st_transform(out, 4326)
}

counts <- data.frame(ubigeo = character(), features = integer(), stringsAsFactors = FALSE)
class_counts <- list()
files <- character()

for (i in seq_len(nrow(districts))) {
  district <- districts[i, , drop = FALSE]
  ubigeo <- district$ubigeo[[1]]
  message("Packing context for ", ubigeo, " ", district$distrito[[1]])
  district_geom <- sf::st_buffer(sf::st_geometry(district), 650)

  sub_polys <- if (nrow(polygons)) suppressWarnings(sf::st_intersection(polygons, district_geom)) else polygons
  sub_lines <- if (nrow(lines)) suppressWarnings(sf::st_intersection(lines, district_geom)) else lines
  sub_points <- if (nrow(points)) suppressWarnings(sf::st_intersection(points, district_geom)) else points

  sub_polys <- sub_polys[!sf::st_is_empty(sub_polys), , drop = FALSE]
  sub_lines <- sub_lines[!sf::st_is_empty(sub_lines), , drop = FALSE]
  sub_points <- sub_points[!sf::st_is_empty(sub_points), , drop = FALSE]

  sub_polys <- prepare_layer(sub_polys, c("osm_id", "name", "display_name", "feature_class", "kind", "rank", "area_m2"), 1.5)
  sub_lines <- prepare_layer(sub_lines, c("osm_id", "name", "display_name", "feature_class", "kind", "rank", "length_m"), 0.9)
  sub_points <- prepare_layer(sub_points, c("osm_id", "name", "display_name", "feature_class", "kind", "rank"), 0)

  features <- c(sf_features(sub_polys), sf_features(sub_lines), sf_features(sub_points))
  out <- list(
    type = "FeatureCollection",
    properties = list(
      ubigeo = ubigeo,
      distrito = district$distrito[[1]],
      count = length(features),
      source = "OpenStreetMap / Geofabrik"
    ),
    features = features
  )
  out_file <- file.path(out_dir, sprintf("%s.geojson.gz", ubigeo))
  write_gzip_text(jsonlite::toJSON(out, auto_unbox = TRUE, null = "null", digits = 8), out_file)
  files <- c(files, out_file)
  counts <- rbind(counts, data.frame(ubigeo = ubigeo, features = length(features), stringsAsFactors = FALSE))
  classes <- vapply(features, function(f) as.character(f$properties$feature_class %||% "context"), character(1))
  if (length(classes)) {
    tab <- table(classes)
    for (nm in names(tab)) class_counts[[nm]] <- (class_counts[[nm]] %||% 0L) + as.integer(tab[[nm]])
  }
}

manifest <- list(
  id = "osm-geofabrik-peru-context-lima-callao",
  version = "osm-geofabrik-peru-context-lima-callao-v1",
  coverage = "Lima Metropolitana y Callao",
  provider = "OpenStreetMap contributors / Geofabrik GmbH",
  source = "OpenStreetMap Peru extract distributed by Geofabrik",
  source_url = "https://download.geofabrik.de/south-america/peru.html",
  extract_url = source_url,
  license = "Open Database License (ODbL) 1.0",
  license_url = "https://www.openstreetmap.org/copyright",
  geometry = "poligono_linea_punto_contexto",
  spatial_reference_api = "EPSG:4326",
  packaging_mode = "local_only",
  compression = "gzip_por_distrito",
  packaged_scope = "Agua/costa, areas verdes, plazas y hitos publicos por distrito para Lima Metropolitana y Callao",
  included_classes = c("water", "coast", "waterway", "green", "square", "public", "landmark"),
  packaged_districts = as.integer(nrow(counts)),
  packaged_features = as.integer(sum(counts$features, na.rm = TRUE)),
  counts_by_class = as.list(class_counts),
  packaged_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  pbf_last_modified = as.character(file.info(pbf_path)$mtime),
  pbf_size = as.integer(file.info(pbf_path)$size),
  checksum = as.list(stats::setNames(unname(tools::md5sum(files)), basename(files))),
  attribution = "© OpenStreetMap contributors · ODbL",
  note = paste(
    "Capa local de contexto urbano para orientacion en campo.",
    "No reemplaza cartografia censal ni navegacion puerta a puerta."
  )
)

writeLines(
  jsonlite::toJSON(manifest, auto_unbox = TRUE, pretty = TRUE, null = "null"),
  con = manifest_path,
  useBytes = TRUE
)

message("Wrote ", nrow(counts), " districts, ", sum(counts$features), " context features.")
