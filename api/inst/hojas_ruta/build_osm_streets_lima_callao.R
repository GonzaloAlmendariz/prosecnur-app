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
overture_streets_module <- file.path(repo_root, "api", "R", "overture_streets.R")
if (file.exists(overture_streets_module)) source(overture_streets_module)

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

# Muchas avenidas grandes en Peru solo tienen el nombre en tags secundarios
# (name:es, ref, alt_name, old_name, official_name). Esos tags no vienen como
# columnas en sf::st_read por defecto: estan en `other_tags` como blob HSTORE
# del estilo "tag1"=>"valor1","tag2"=>"valor2". Los parseamos y los usamos como
# fallback cuando `name` viene vacio.
extract_hstore_tag <- function(blob, key) {
  if (!length(blob)) return(character(0))
  blob <- ifelse(is.na(blob), "", as.character(blob))
  patt <- sprintf('"%s"=>"((?:[^"\\\\]|\\\\.)*)"', key)
  out <- rep("", length(blob))
  # regexpr() devuelve -1 cuando no hay match; mantiene length == length(blob).
  # NOTA: NO usar regmatches() acá porque omite las posiciones sin match,
  # produciendo un vector más corto que desplaza todos los valores.
  m <- regexpr(patt, blob, perl = TRUE)
  hits <- which(m != -1L)
  if (!length(hits)) return(out)
  matched_strs <- substring(blob[hits], m[hits], m[hits] + attr(m, "match.length")[hits] - 1L)
  vals <- sub(patt, "\\1", matched_strs, perl = TRUE)
  vals <- gsub("\\\\\"", "\"", vals)
  vals <- gsub("\\\\\\\\", "\\\\", vals)
  out[hits] <- vals
  out
}
if (!"other_tags" %in% names(roads)) roads$other_tags <- rep("", nrow(roads))
roads$other_tags <- as.character(roads$other_tags)
roads$other_tags[is.na(roads$other_tags)] <- ""
roads$name_es        <- extract_hstore_tag(roads$other_tags, "name:es")
roads$name_short     <- extract_hstore_tag(roads$other_tags, "short_name")
roads$alt_name       <- extract_hstore_tag(roads$other_tags, "alt_name")
roads$old_name       <- extract_hstore_tag(roads$other_tags, "old_name")
roads$official_name  <- extract_hstore_tag(roads$other_tags, "official_name")
roads$ref_tag        <- extract_hstore_tag(roads$other_tags, "ref")
# Atributos físicos adicionales para enriquecer hojas de ruta
roads$lanes_tag      <- extract_hstore_tag(roads$other_tags, "lanes")
roads$oneway_tag     <- extract_hstore_tag(roads$other_tags, "oneway")
roads$surface_tag    <- extract_hstore_tag(roads$other_tags, "surface")
roads$maxspeed_tag   <- extract_hstore_tag(roads$other_tags, "maxspeed")
roads$lit_tag        <- extract_hstore_tag(roads$other_tags, "lit")

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

# Cascada de fallback: si name esta vacio, intentar name:es, official_name,
# alt_name, old_name, short_name, ref. Asi muchas avenidas grandes que solo
# tienen el nombre en tags secundarios sí aparecen rotuladas.
fallback_chain <- list(roads$name_es, roads$official_name, roads$alt_name,
                       roads$old_name, roads$name_short, roads$ref_tag)
for (alt in fallback_chain) {
  needs <- !nzchar(roads$name) & nzchar(alt)
  roads$name[needs] <- trimws(alt[needs])
}
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

# Construir campos finales del schema v3 a partir de los tags ya parseados.
# Los parsers viven en api/R/overture_streets.R cuando está disponible; si no,
# se usan fallbacks locales mínimos.
.norm_oneway <- function(s) {
  if (exists("parse_osm_oneway")) return(parse_osm_oneway(s))
  ifelse(s %in% c("yes", "true", "1"), "yes",
    ifelse(s %in% c("no", "false", "0"), "no",
      ifelse(s %in% c("-1", "reverse", "reversible", "alternating"), "reversible", NA_character_)))
}
.norm_lanes <- function(s) {
  if (exists("parse_osm_lanes")) return(parse_osm_lanes(s))
  v <- suppressWarnings(as.integer(round(as.numeric(s))))
  v[is.na(v) | v < 0L | v > 50L] <- 0L
  v
}
.norm_maxspeed <- function(s) {
  if (exists("parse_osm_maxspeed_kmh")) return(parse_osm_maxspeed_kmh(s))
  v <- suppressWarnings(as.numeric(gsub("[^0-9.]", "", s)))
  as.integer(round(v))
}
.norm_lit <- function(s) {
  if (exists("parse_osm_lit")) return(parse_osm_lit(s))
  ifelse(s %in% c("yes", "true", "24/7"), TRUE,
    ifelse(s %in% c("no", "false"), FALSE, NA))
}

roads$name_official <- roads$official_name
.alt_collapse <- function(a, b, c) {
  out <- character(length(a))
  for (i in seq_along(a)) {
    parts <- unique(c(a[[i]], b[[i]], c[[i]]))
    parts <- parts[nzchar(parts)]
    parts <- setdiff(parts, roads$name[[i]])
    out[[i]] <- if (length(parts)) paste(parts, collapse = " / ") else ""
  }
  out
}
roads$name_alt    <- .alt_collapse(roads$alt_name, roads$old_name, roads$name_short)
roads$name_ref    <- roads$ref_tag
roads$lanes       <- .norm_lanes(roads$lanes_tag)
roads$oneway      <- .norm_oneway(roads$oneway_tag)
roads$surface     <- ifelse(nzchar(roads$surface_tag), roads$surface_tag, NA_character_)
roads$maxspeed_kmh <- .norm_maxspeed(roads$maxspeed_tag)
roads$lit         <- .norm_lit(roads$lit_tag)
roads$source      <- "osm"
roads$overture_id <- NA_character_

roads <- sf::st_transform(sf::st_zm(roads, drop = TRUE, what = "ZM"), 32718)
roads <- suppressWarnings(sf::st_make_valid(roads))
roads <- suppressWarnings(sf::st_filter(roads, sf::st_union(districts), .predicate = sf::st_intersects))

# ---- Merge con Overture (opcional, controlado por env var) -------------------
include_overture <- !identical(toupper(Sys.getenv("HOJAS_RUTA_INCLUDE_OVERTURE", "TRUE")), "FALSE")
overture_release_used <- NA_character_
overture_segments_total <- 0L
overture_only_count <- 0L
merged_count <- 0L

if (include_overture && exists("overture_load_segments")) {
  overture_release_used <- overture_release_pinned()
  cache_dir <- Sys.getenv(
    "HOJAS_RUTA_OVERTURE_CACHE",
    file.path(path.expand("~"), ".prosecnurapp", "overture_cache")
  )
  parquet_path <- Sys.getenv("HOJAS_RUTA_OVERTURE_PARQUET", "")
  if (!nzchar(parquet_path)) {
    parquet_path <- file.path(cache_dir, sprintf("lima_callao_%s.parquet", overture_release_used))
  }
  if (file.exists(parquet_path)) {
    message("Overture parquet detectado: ", parquet_path, " — haciendo merge.")
    ov_raw <- tryCatch(overture_load_segments(parquet_path), error = function(e) {
      warning("No se pudo cargar Overture: ", conditionMessage(e), call. = FALSE)
      NULL
    })
    if (!is.null(ov_raw) && nrow(ov_raw)) {
      overture_segments_total <- nrow(ov_raw)
      ov_names <- parse_overture_names(ov_raw$names_json)
      ov <- sf::st_sf(
        id = as.character(ov_raw$id),
        osm_record_id = parse_overture_osm_id(ov_raw$sources_json),
        name_primary = ov_names$name_primary,
        name_es = ov_names$name_es,
        lanes = parse_overture_lanes(ov_raw$road_flags_json),
        oneway = parse_overture_oneway(ov_raw$access_restrictions_json),
        surface = parse_overture_surface(ov_raw$road_surface_json),
        maxspeed_kmh = parse_overture_speed_kmh(ov_raw$speed_limits_json),
        class = ov_raw$class,
        geometry = sf::st_geometry(ov_raw),
        crs = sf::st_crs(ov_raw)
      )
      ov <- sf::st_transform(ov, 32718)
      ov <- suppressWarnings(sf::st_make_valid(ov))
      ov <- suppressWarnings(sf::st_filter(ov, sf::st_union(districts), .predicate = sf::st_intersects))
      n_before <- nrow(roads)
      roads <- merge_osm_overture(roads, ov, hausdorff_max_m = 5, buffer_m = 2)
      overture_only_count <- as.integer(sum(roads$source == "overture", na.rm = TRUE))
      merged_count <- as.integer(sum(roads$source == "both", na.rm = TRUE))
      message(sprintf(
        "Merge OSM<->Overture: %d OSM + %d Overture-only, %d merged. Total: %d.",
        n_before, overture_only_count, merged_count, nrow(roads)
      ))
    }
  } else {
    message("Overture parquet no encontrado en ", parquet_path,
            " — corre build_overture_streets_lima_callao.R primero o exporta HOJAS_RUTA_INCLUDE_OVERTURE=FALSE.")
  }
} else {
  message("HOJAS_RUTA_INCLUDE_OVERTURE=FALSE o módulo overture_streets.R no disponible. Build solo OSM.")
}

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
total_named <- 0L
total_with_lanes <- 0L
total_with_surface <- 0L
total_features <- 0L

for (i in seq_len(nrow(districts))) {
  district <- districts[i, , drop = FALSE]
  ubigeo <- district$ubigeo[[1]]
  message("Packing streets for ", ubigeo, " ", district$distrito[[1]])
  sub <- suppressWarnings(sf::st_intersection(roads, sf::st_geometry(district)))
  sub <- sub[!sf::st_is_empty(sub), , drop = FALSE]

  if (nrow(sub) > 0L) {
    sub$length_m <- as.numeric(sf::st_length(sf::st_geometry(sub)))
    all_lengths <- all_lengths + sum(sub$length_m, na.rm = TRUE)
    total_features <- total_features + nrow(sub)
    total_named <- total_named + sum(nzchar(sub$name), na.rm = TRUE)
    total_with_lanes <- total_with_lanes + sum(sub$lanes > 0L, na.rm = TRUE)
    total_with_surface <- total_with_surface + sum(!is.na(sub$surface) & nzchar(sub$surface), na.rm = TRUE)
    tolerance <- ifelse(sub$rank <= 3, 0.75, ifelse(sub$class_group == "avenue", 1.25, 3))
    geom <- sf::st_geometry(sub)
    geom_simplified <- lapply(seq_along(geom), function(j) {
      sf::st_simplify(geom[[j]], dTolerance = tolerance[[j]], preserveTopology = TRUE)
    })
    sf::st_geometry(sub) <- sf::st_sfc(geom_simplified, crs = sf::st_crs(sub))
    sub <- sub[, c(
      "osm_id", "name", "highway", "class_group", "rank", "avenue_like",
      "display_name", "length_m",
      "name_es", "name_official", "name_alt", "name_ref",
      "lanes", "oneway", "surface", "maxspeed_kmh", "lit",
      "source", "overture_id"
    )]
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
      name_es = character(),
      name_official = character(),
      name_alt = character(),
      name_ref = character(),
      lanes = integer(),
      oneway = character(),
      surface = character(),
      maxspeed_kmh = integer(),
      lit = logical(),
      source = character(),
      overture_id = character(),
      geometry = sf::st_sfc(crs = 4326)
    )
  }

  out_file <- file.path(out_dir, sprintf("%s.geojson.gz", ubigeo))
  write_street_geojson(sub, out_file)
  counts <- rbind(counts, data.frame(ubigeo = ubigeo, streets = nrow(sub), stringsAsFactors = FALSE))
}

files <- list.files(out_dir, pattern = "[.]geojson[.]gz$", full.names = TRUE)
overture_active <- !is.na(overture_release_used) && overture_segments_total > 0L
manifest <- list(
  id = "osm-overture-streets-lima-callao",
  version = if (overture_active) "osm-overture-streets-lima-callao-v3" else "osm-geofabrik-peru-streets-lima-callao-v3",
  schema_version = 3L,
  coverage = "Lima Metropolitana y Callao",
  provider = if (overture_active) {
    "OpenStreetMap contributors / Geofabrik GmbH + Overture Maps Foundation"
  } else "OpenStreetMap contributors / Geofabrik GmbH",
  source = if (overture_active) {
    "OpenStreetMap Peru (Geofabrik) + Overture Maps Transportation segments"
  } else "OpenStreetMap Peru extract distributed by Geofabrik",
  source_url = "https://download.geofabrik.de/south-america/peru.html",
  extract_url = source_url,
  overture_release = overture_release_used,
  overture_segments_total = as.integer(overture_segments_total),
  overture_only_count = as.integer(overture_only_count),
  merged_count = as.integer(merged_count),
  license = if (overture_active) {
    "ODbL 1.0 (segmentos derivados de OSM) + CDLA-Permissive-2.0 (correcciones Overture)"
  } else "Open Database License (ODbL) 1.0",
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
  name_coverage_pct = if (total_features > 0L) round(total_named / total_features, 4) else 0,
  lanes_coverage_pct = if (total_features > 0L) round(total_with_lanes / total_features, 4) else 0,
  surface_coverage_pct = if (total_features > 0L) round(total_with_surface / total_features, 4) else 0,
  packaged_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  pbf_last_modified = as.character(file.info(pbf_path)$mtime),
  pbf_size = as.integer(file.info(pbf_path)$size),
  checksum = as.list(stats::setNames(unname(tools::md5sum(files)), basename(files))),
  attribution = if (overture_active) {
    "© OpenStreetMap contributors (ODbL) · © Overture Maps Foundation (ODbL/CDLA)"
  } else "© OpenStreetMap contributors · ODbL",
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
