#!/usr/bin/env Rscript

# Builds a compact per-district GeoJSON package from the INEI 2017 urban
# census street-axis shapefile for Lima Metropolitana y Callao.

options(stringsAsFactors = FALSE, warn = 1)

stop_if_missing <- function(pkg) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    stop(sprintf("Package '%s' is required.", pkg), call. = FALSE)
  }
}

stop_if_missing("sf")
stop_if_missing("jsonlite")

`%||%` <- function(x, y) if (is.null(x) || length(x) == 0L) y else x

script_path <- sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE)[1] %||% ".")
script_dir <- dirname(normalizePath(script_path, mustWork = FALSE))

source_root <- Sys.getenv(
  "HOJAS_RUTA_INEI2017_LIMA_CALLAO_DIR",
  "/Users/gonzaloalmendariz/Downloads/Lima Metropolitana y Callao"
)
source_shp <- Sys.getenv(
  "HOJAS_RUTA_INEI2017_STREETS_SHP",
  file.path(source_root, "mapas", "Ejv_LimaMetropolitana.shp")
)
out_dir <- Sys.getenv(
  "HOJAS_RUTA_INEI2017_STREETS_OUT_DIR",
  file.path(script_dir, "cartografia", "calles_inei2017_lima_callao")
)
manifest_path <- Sys.getenv(
  "HOJAS_RUTA_INEI2017_STREETS_MANIFEST",
  file.path(script_dir, "cartografia_calles_inei2017_lima_callao.json")
)

if (!file.exists(source_shp)) {
  stop(sprintf("No se encontro el shapefile INEI: %s", source_shp), call. = FALSE)
}

dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

clean_text <- function(x) {
  x <- trimws(as.character(x %||% ""))
  x[is.na(x)] <- ""
  gsub("\\s+", " ", x)
}

street_rank <- function(cat, name) {
  cat_upper <- toupper(clean_text(cat))
  name_upper <- toupper(clean_text(name))
  out <- rep(7L, length(cat_upper))
  out[cat_upper %in% c("CARRETERA")] <- 3L
  out[cat_upper %in% c("AV.", "AV", "AVENIDA")] <- 4L
  out[cat_upper %in% c("JR.", "JR", "JIRON")] <- 6L
  out[cat_upper %in% c("CAL.", "CAL", "CALLE")] <- 7L
  out[cat_upper %in% c("PSJ.", "PSJ", "PASAJE")] <- 8L
  out[grepl("PANAMERICANA|VIA EXPRESA|CIRCUITO|EVITAMIENTO", name_upper)] <- 2L
  as.integer(out)
}

street_highway <- function(cat, rank) {
  cat_upper <- toupper(clean_text(cat))
  out <- rep("residential", length(cat_upper))
  out[cat_upper %in% c("CARRETERA")] <- "primary"
  out[cat_upper %in% c("AV.", "AV", "AVENIDA")] <- "secondary"
  out[cat_upper %in% c("JR.", "JR", "JIRON")] <- "residential"
  out[cat_upper %in% c("PSJ.", "PSJ", "PASAJE")] <- "living_street"
  out[cat_upper %in% c("OTROS")] <- "unclassified"
  out[rank <= 2L] <- "trunk"
  out
}

street_class_group <- function(cat, rank) {
  cat_upper <- toupper(clean_text(cat))
  out <- rep("detail", length(cat_upper))
  out[cat_upper %in% c("CARRETERA", "AV.", "AV", "AVENIDA") | rank <= 5L] <- "major"
  out[cat_upper %in% c("OTROS")] <- "other"
  out
}

street_display_name <- function(cat, name) {
  cat <- clean_text(cat)
  name <- clean_text(name)
  out <- trimws(paste(cat, name))
  out[out == ""] <- name[out == ""]
  out
}

round_coords <- function(mat) {
  mat <- as.matrix(mat)
  mat <- mat[, seq_len(min(2L, ncol(mat))), drop = FALSE]
  mat <- mat[stats::complete.cases(mat), , drop = FALSE]
  if (!nrow(mat)) return(list())
  lapply(seq_len(nrow(mat)), function(i) as.numeric(round(mat[i, ], 7)))
}

geometry_to_geojson <- function(geom) {
  if (inherits(geom, "LINESTRING")) {
    return(list(type = "LineString", coordinates = round_coords(geom)))
  }
  if (inherits(geom, "MULTILINESTRING")) {
    parts <- lapply(seq_along(geom), function(i) round_coords(geom[[i]]))
    parts <- parts[vapply(parts, length, integer(1)) > 1L]
    if (length(parts) == 1L) {
      return(list(type = "LineString", coordinates = parts[[1L]]))
    }
    return(list(type = "MultiLineString", coordinates = parts))
  }
  list(type = "GeometryCollection", geometries = list())
}

write_geojson_gz <- function(collection, path) {
  con <- gzfile(path, open = "wt", encoding = "UTF-8")
  on.exit(close(con), add = TRUE)
  json <- jsonlite::toJSON(collection, auto_unbox = TRUE, null = "null", digits = 8)
  writeLines(enc2utf8(json), con, useBytes = TRUE)
}

message("Leyendo ejes viales INEI: ", source_shp)
streets <- sf::st_read(source_shp, quiet = TRUE, stringsAsFactors = FALSE)
streets <- sf::st_zm(streets, drop = TRUE, what = "ZM")
if (is.na(sf::st_crs(streets))) sf::st_crs(streets) <- 4326
streets <- sf::st_transform(streets, 4326)
streets$UBIGEO <- sprintf("%06s", as.character(streets$UBIGEO))

length_m <- suppressWarnings(as.numeric(sf::st_length(sf::st_transform(streets, 32718))))
rank <- street_rank(streets$NOMBRE_CAT, streets$NOMBRE_VIA)
highway <- street_highway(streets$NOMBRE_CAT, rank)
class_group <- street_class_group(streets$NOMBRE_CAT, rank)
display_name <- street_display_name(streets$NOMBRE_CAT, streets$NOMBRE_VIA)
avenue_like <- rank <= 5L | grepl("(^|\\b)(AV\\.?|AVENIDA|CARRETERA|VIA EXPRESA|CIRCUITO)(\\b|\\s)", display_name, ignore.case = TRUE)

geoms <- sf::st_geometry(streets)
ubigeos <- sort(unique(streets$UBIGEO[nzchar(streets$UBIGEO)]))
checksums <- list()
counts <- data.frame(ubigeo = character(0), features = integer(0), stringsAsFactors = FALSE)

for (ubigeo in ubigeos) {
  idx <- which(streets$UBIGEO == ubigeo)
  if (!length(idx)) next
  features <- vector("list", length(idx))
  for (j in seq_along(idx)) {
    i <- idx[[j]]
    features[[j]] <- list(
      type = "Feature",
      properties = list(
        inei_id = sprintf("INEI2017-%s-%06d", ubigeo, i),
        osm_id = sprintf("INEI2017-%s-%06d", ubigeo, i),
        name = clean_text(streets$NOMBRE_VIA[[i]]),
        highway = highway[[i]],
        class_group = class_group[[i]],
        rank = as.integer(rank[[i]]),
        avenue_like = isTRUE(avenue_like[[i]]),
        display_name = display_name[[i]],
        length_m = if (is.finite(length_m[[i]])) round(length_m[[i]], 2) else NA_real_,
        name_es = clean_text(streets$NOMBRE_VIA[[i]]),
        name_official = display_name[[i]],
        name_alt = "",
        name_ref = "",
        lanes = 0L,
        oneway = NA_character_,
        surface = NA_character_,
        maxspeed_kmh = NA_integer_,
        lit = NA,
        source = "inei2017",
        source_layer = "Ejv_LimaMetropolitana",
        street_category = clean_text(streets$NOMBRE_CAT[[i]]),
        ubigeo = ubigeo,
        distrito = clean_text(streets$NOMCCPP[[i]]),
        codccpp = clean_text(streets$CODCCPP[[i]]),
        overture_id = NA_character_
      ),
      geometry = geometry_to_geojson(geoms[[i]])
    )
  }
  features <- features[vapply(features, function(feature) {
    identical(feature$geometry$type, "LineString") ||
      identical(feature$geometry$type, "MultiLineString")
  }, logical(1))]
  collection <- list(
    type = "FeatureCollection",
    name = sprintf("calles_inei2017_%s", ubigeo),
    crs = list(
      type = "name",
      properties = list(name = "urn:ogc:def:crs:OGC:1.3:CRS84")
    ),
    properties = list(
      source = "INEI 2017",
      source_layer = "Ejv_LimaMetropolitana",
      ubigeo = ubigeo
    ),
    features = features
  )
  out_path <- file.path(out_dir, sprintf("%s.geojson.gz", ubigeo))
  write_geojson_gz(collection, out_path)
  checksums[[basename(out_path)]] <- as.character(tools::md5sum(out_path)[[1]])
  counts <- rbind(counts, data.frame(ubigeo = ubigeo, features = length(features), stringsAsFactors = FALSE))
  message(sprintf("  %s: %s ejes", ubigeo, format(length(features), big.mark = ",")))
}

manifest <- list(
  id = "inei2017-streets-lima-callao",
  version = "inei2017-streets-lima-callao-v1",
  schema_version = 1L,
  coverage = "Lima Metropolitana y Callao",
  provider = "Instituto Nacional de Estadistica e Informatica (INEI)",
  source = "Informacion Digital Urbano Censal Ciudad Lima Metropolitana 2017",
  source_url = "https://www.gob.pe/institucion/inei/informes-publicaciones/2392772-solicitud-de-impresion-de-planos-urbanos-y-mapas-distritales",
  source_layer = "Ejv_LimaMetropolitana",
  year = 2017L,
  geometry = "linea_vial",
  spatial_reference = "EPSG:4326 / WGS84",
  native_id_field = "INEI2017-{ubigeo}-{row}",
  class_field = "NOMBRE_CAT",
  name_field = "NOMBRE_VIA",
  packaging_mode = "local_only",
  compression = "gzip_por_distrito",
  packaged_scope = "Ejes viales INEI 2017 por distrito para croquis operativo de hojas de ruta",
  packaged_districts = as.integer(nrow(counts)),
  packaged_streets = as.integer(sum(counts$features)),
  packaged_length_km = round(sum(length_m, na.rm = TRUE) / 1000, 1),
  name_coverage_pct = round(mean(nzchar(clean_text(streets$NOMBRE_VIA))), 4),
  packaged_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  counts_by_district = stats::setNames(as.list(as.integer(counts$features)), counts$ubigeo),
  checksum = checksums,
  attribution = "Fuente: INEI, Informacion Digital Urbano Censal 2017",
  note = "Capa local primaria para rotulos y orientacion del croquis de campo; OSM/Overture queda como respaldo."
)

jsonlite::write_json(manifest, manifest_path, auto_unbox = TRUE, pretty = TRUE, null = "null")
message("Manifest escrito: ", manifest_path)
