#!/usr/bin/env Rscript

# Builds optional INEI 2017 operational layers for Hojas de ruta:
# official Lima/Callao block frame, official block geometries, NSE enrichment,
# census zones, and an audit against the current packaged frame.

options(stringsAsFactors = FALSE, warn = 1)

stop_if_missing <- function(pkg) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    stop(sprintf("Package '%s' is required.", pkg), call. = FALSE)
  }
}

stop_if_missing("sf")
stop_if_missing("haven")
stop_if_missing("readxl")
stop_if_missing("jsonlite")

`%||%` <- function(x, y) if (is.null(x) || length(x) == 0L) y else x

script_path <- sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE)[1] %||% ".")
script_dir <- dirname(normalizePath(script_path, mustWork = FALSE))
repo_root <- normalizePath(file.path(script_dir, "..", "..", ".."), mustWork = FALSE)
drive_root <- Sys.getenv(
  "HOJAS_RUTA_INEI_DRIVE_ROOT",
  "/Users/gonzaloalmendariz/Documents/Pulso/GIZ/drive_insumos_descarga_relevante"
)

carto_dir <- file.path(
  drive_root,
  "CARTOGRAFÍAS CENSO 2017 INEI",
  "CENSO INEI 2017",
  "Cartografía INEI 2017",
  "Lima Metropolitana y Callao"
)
map_dir <- file.path(carto_dir, "mapas")
datos_dir <- file.path(carto_dir, "datos")
sav_path <- file.path(
  drive_root,
  "CARTOGRAFÍAS CENSO 2017 INEI",
  "MARCOS MUESTRALES INEI 2017",
  "MANZANAS LIMA-CALLAO CENSO 2017 13.01.2021.sav"
)
nse_path <- file.path(drive_root, "NSE Lima INEI", "NSE.xlsx")

out_frame <- file.path(script_dir, "inei2017_lima_callao_manzanas_oficial.csv.gz")
out_nse <- file.path(script_dir, "nse_inei2017_lima_manzanas.csv.gz")
out_audit <- file.path(script_dir, "auditoria_frame_inei2017_lima_callao.csv.gz")
out_audit_summary <- file.path(script_dir, "auditoria_frame_inei2017_lima_callao.json")
out_blocks_dir <- file.path(script_dir, "cartografia", "manzanas_inei2017_lima_callao")
out_zones_dir <- file.path(script_dir, "cartografia", "zonas_inei2017_lima_callao")
out_blocks_manifest <- file.path(script_dir, "cartografia_manzanas_inei2017_lima_callao.json")
out_zones_manifest <- file.path(script_dir, "cartografia_zonas_inei2017_lima_callao.json")
out_nse_manifest <- file.path(script_dir, "nse_inei2017_lima_manzanas.json")

required_files <- c(
  file.path(map_dir, "Mz_LimaMetropolitana.shp"),
  file.path(map_dir, "Zo_LimaMetropolitana.shp"),
  file.path(datos_dir, "Poblacion_1.xlsx"),
  file.path(datos_dir, "vivienda.xlsx"),
  sav_path,
  nse_path
)
missing_files <- required_files[!file.exists(required_files)]
if (length(missing_files)) {
  stop("Missing source files:\n", paste(missing_files, collapse = "\n"), call. = FALSE)
}

dir.create(out_blocks_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(out_zones_dir, recursive = TRUE, showWarnings = FALSE)

clean_num <- function(x) {
  x <- trimws(as.character(x))
  x[x %in% c("", "-", "NA", "NaN")] <- NA_character_
  suppressWarnings(as.numeric(gsub("[^0-9.-]", "", x)))
}

normalize_id_manzana <- function(id) {
  id <- toupper(gsub("[^0-9A-ZÑ]", "", as.character(id %||% "")))
  out <- rep(NA_character_, length(id))
  ok <- nchar(id) >= 12L
  if (any(ok)) {
    ubigeo <- substr(id[ok], 1L, 6L)
    zona <- substr(id[ok], 7L, 11L)
    mz <- substr(id[ok], 12L, nchar(id[ok]))
    mz <- ifelse(grepl("^[0-9]{4}$", mz) & grepl("0$", mz), substr(mz, 1L, 3L), mz)
    out[ok] <- paste0(ubigeo, zona, mz)
  }
  out
}

first_nonempty <- function(x) {
  x <- as.character(x)
  x <- x[!is.na(x) & nzchar(trimws(x))]
  if (length(x)) x[[1]] else NA_character_
}

write_csv_gz <- function(df, path) {
  con <- gzfile(path, open = "wt", encoding = "UTF-8")
  on.exit(close(con), add = TRUE)
  utils::write.csv(df, con, row.names = FALSE, fileEncoding = "UTF-8")
  invisible(path)
}

write_json <- function(x, path) {
  jsonlite::write_json(x, path, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null")
  invisible(path)
}

write_geojson_gz <- function(sf_obj, path) {
  tmp <- tempfile(fileext = ".geojson")
  if (file.exists(tmp)) unlink(tmp)
  sf::st_write(sf_obj, tmp, driver = "GeoJSON", quiet = TRUE, delete_dsn = TRUE)
  in_con <- file(tmp, open = "rb")
  on.exit(close(in_con), add = TRUE)
  out_con <- gzfile(path, open = "wb")
  on.exit(close(out_con), add = TRUE)
  repeat {
    chunk <- readBin(in_con, "raw", n = 1024 * 1024)
    if (!length(chunk)) break
    writeBin(chunk, out_con)
  }
  unlink(tmp)
  invisible(path)
}

read_inei_simple_excel <- function(path, value_col) {
  raw <- readxl::read_excel(path, col_types = "text")
  if (nrow(raw) > 0L && identical(as.character(raw[[1]][[1]]), "Idmanzana")) {
    raw <- raw[-1L, , drop = FALSE]
  }
  out <- data.frame(
    id_manzana = as.character(raw[["...1"]]),
    ubigeo = paste0(raw[["1"]], raw[["3"]], raw[["5"]]),
    zona = as.character(raw[["7"]]),
    manzana = as.character(raw[["8"]]),
    value = clean_num(raw[[value_col]]),
    stringsAsFactors = FALSE
  )
  out <- out[!is.na(out$id_manzana) & nzchar(out$id_manzana), , drop = FALSE]
  out$id_manzana_norm <- normalize_id_manzana(out$id_manzana)
  out
}

centroid_lonlat <- function(x) {
  pts <- suppressWarnings(sf::st_point_on_surface(sf::st_transform(x, 32718)))
  pts <- sf::st_transform(pts, 4326)
  coords <- sf::st_coordinates(pts)
  list(lon = coords[, 1], lat = coords[, 2])
}

cat("Reading INEI block geometry...\n")
mz <- sf::st_read(file.path(map_dir, "Mz_LimaMetropolitana.shp"), quiet = TRUE, stringsAsFactors = FALSE)
mz <- sf::st_transform(mz, 4326)
mz$IDMANZANA <- as.character(mz$IDMANZANA)
mz$id_manzana_norm <- normalize_id_manzana(mz$IDMANZANA)
cent <- centroid_lonlat(mz)
area_m2 <- suppressWarnings(as.numeric(sf::st_area(sf::st_transform(mz, 32718))))

cat("Reading INEI counts...\n")
sav <- as.data.frame(haven::read_sav(sav_path), stringsAsFactors = FALSE)
sav$id_manzana <- as.character(sav$idmanzana)
sav$id_manzana_norm <- normalize_id_manzana(sav$id_manzana)
sav_viv <- clean_num(sav$VIVIENDAS)
sav_viv0 <- clean_num(sav$VIVIENDAS0)

pop <- read_inei_simple_excel(file.path(datos_dir, "Poblacion_1.xlsx"), "20")
viv <- read_inei_simple_excel(file.path(datos_dir, "vivienda.xlsx"), "9")

props <- sf::st_drop_geometry(mz)
idx_sav <- match(props$id_manzana_norm, sav$id_manzana_norm)
idx_pop <- match(props$id_manzana_norm, pop$id_manzana_norm)
idx_viv <- match(props$id_manzana_norm, viv$id_manzana_norm)

viviendas_sav <- sav_viv[idx_sav]
viviendas0_sav <- sav_viv0[idx_sav]
viviendas_xlsx <- viv$value[idx_viv]
poblacion_xlsx <- pop$value[idx_pop]

viviendas <- ifelse(!is.na(viviendas_sav), viviendas_sav, viviendas_xlsx)
viviendas <- ifelse(is.na(viviendas), 0, viviendas)
poblacion <- ifelse(is.na(poblacion_xlsx), 0, poblacion_xlsx)

frame <- data.frame(
  ubigeo = sprintf("%06s", as.character(props$UBIGEO)),
  departamento = as.character(props$NOMBDPTO),
  provincia = as.character(props$NOMBPROV),
  distrito = as.character(props$NOMBDIST),
  zona = ifelse(nchar(props$IDMANZANA) >= 11L, substr(props$IDMANZANA, 7L, 11L), as.character(props$CODZONA)),
  manzana = ifelse(nchar(props$IDMANZANA) > 11L, substr(props$IDMANZANA, 12L, nchar(props$IDMANZANA)), as.character(props$CODMZNA)),
  id_manzana = props$IDMANZANA,
  id_manzana_norm = props$id_manzana_norm,
  cartografia_id = props$IDMANZANA,
  viviendas = as.integer(round(viviendas)),
  viviendas0 = as.integer(round(ifelse(is.na(viviendas0_sav), viviendas, viviendas0_sav))),
  poblacion = as.integer(round(poblacion)),
  poblacion_h = NA_integer_,
  poblacion_m = NA_integer_,
  lat = cent$lat,
  lon = cent$lon,
  area_m2 = area_m2,
  cartografia_fuente = "INEI - CENSO 2017",
  cartografia_anio = 2017L,
  conteo_fuente = ifelse(!is.na(poblacion_xlsx), "INEI CPV2017 datos/Poblacion_1.xlsx", "INEI marco SAV/Cartografia"),
  match_level = ifelse(!is.na(idx_sav) | !is.na(idx_pop) | !is.na(idx_viv), "id_manzana_norm", "cartografia_only"),
  stringsAsFactors = FALSE
)
write_csv_gz(frame, out_frame)

cat("Writing official block GeoJSON packages...\n")
block_counts <- list()
for (ubigeo in sort(unique(frame$ubigeo))) {
  idx <- frame$ubigeo == ubigeo
  sf_sub <- mz[idx, , drop = FALSE]
  sf_sub <- sf_sub[, c(
    "IDMANZANA", "id_manzana_norm", "UBIGEO", "NOMBDPTO", "NOMBPROV", "NOMBDIST",
    "CODZONA", "SUFZONA", "CODMZNA", "SUFMZNA", "CODCCPP", "NOMCCPP"
  )]
  sf_sub$fuente_anio <- 2017L
  out_file <- file.path(out_blocks_dir, paste0(ubigeo, ".geojson.gz"))
  write_geojson_gz(sf_sub, out_file)
  block_counts[[ubigeo]] <- as.integer(nrow(sf_sub))
}

blocks_manifest <- list(
  id = "inei2017-official-blocks-lima-callao",
  version = "inei2017-official-blocks-lima-callao-v1",
  schema_version = 1L,
  provider = "Instituto Nacional de Estadistica e Informatica (INEI)",
  source = "Informacion Digital Urbano Censal Ciudad Lima Metropolitana 2017",
  source_layer = "Mz_LimaMetropolitana",
  year = 2017L,
  coverage = "Lima Metropolitana y Callao",
  geometry = "poligono_manzana",
  spatial_reference = "EPSG:4326 / WGS84",
  packaging_mode = "local_only_parallel_frame",
  compression = "gzip_por_distrito",
  packaged_districts = length(block_counts),
  packaged_blocks = nrow(frame),
  unique_block_ids = length(unique(frame$id_manzana_norm)),
  duplicate_block_ids = sum(duplicated(frame$id_manzana_norm)),
  viviendas = as.integer(sum(frame$viviendas, na.rm = TRUE)),
  poblacion = as.integer(sum(frame$poblacion, na.rm = TRUE)),
  packaged_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  counts_by_district = block_counts,
  checksum = as.list(tools::md5sum(list.files(out_blocks_dir, pattern = "[.]geojson[.]gz$", full.names = TRUE))),
  attribution = "Fuente: INEI, Informacion Digital Urbano Censal 2017"
)
write_json(blocks_manifest, out_blocks_manifest)

cat("Building NSE enrichment...\n")
nse <- as.data.frame(readxl::read_excel(nse_path, sheet = "Datos", col_types = "text"), stringsAsFactors = FALSE)
nse$CENTROID_LON <- clean_num(nse$CENTROID_LON)
nse$CENTROID_LAT <- clean_num(nse$CENTROID_LAT)
nse$COD_ESTRA <- as.character(nse$COD_ESTRA)
nse$NIV_ESTRA <- as.character(nse$NIV_ESTRA)
nse_pt <- sf::st_as_sf(nse, coords = c("CENTROID_LON", "CENTROID_LAT"), crs = 4326, remove = FALSE)
mz_lima <- mz[substr(mz$UBIGEO, 1L, 4L) == "1501", c("IDMANZANA", "id_manzana_norm", "UBIGEO", "NOMBDIST")]
within_idx <- sf::st_within(nse_pt, mz_lima)
match_i <- vapply(within_idx, function(x) if (length(x)) x[[1]] else NA_integer_, integer(1))
match_method <- ifelse(is.na(match_i), NA_character_, "within")
distance_m <- rep(0, nrow(nse_pt))

unmatched <- which(is.na(match_i))
if (length(unmatched)) {
  nse_utm <- sf::st_transform(nse_pt, 32718)
  mz_utm <- sf::st_transform(mz_lima, 32718)
  for (i in unmatched) {
    district <- as.character(nse$NOMBDIST[[i]])
    candidates <- which(as.character(mz_lima$NOMBDIST) == district)
    if (!length(candidates)) next
    nearest_rel <- sf::st_nearest_feature(nse_utm[i, ], mz_utm[candidates, ])
    nearest <- candidates[[nearest_rel]]
    dist <- as.numeric(sf::st_distance(nse_utm[i, ], mz_utm[nearest, ], by_element = TRUE))
    if (!is.na(dist) && dist <= 30) {
      match_i[[i]] <- nearest
      match_method[[i]] <- "nearest_30m_same_district"
      distance_m[[i]] <- dist
    }
  }
}

nse_out <- data.frame(
  id_manzana = NA_character_,
  id_manzana_norm = NA_character_,
  ubigeo = NA_character_,
  distrito = as.character(nse$NOMBDIST),
  nse_codigo = nse$COD_ESTRA,
  nse_nivel = nse$NIV_ESTRA,
  nse_match_method = match_method,
  nse_distance_m = round(distance_m, 3),
  nse_objectid = as.character(nse$OBJECTID),
  nse_records_for_manzana = 1L,
  stringsAsFactors = FALSE
)
matched <- !is.na(match_i)
nse_out$id_manzana[matched] <- as.character(mz_lima$IDMANZANA[match_i[matched]])
nse_out$id_manzana_norm[matched] <- as.character(mz_lima$id_manzana_norm[match_i[matched]])
nse_out$ubigeo[matched] <- sprintf("%06s", as.character(mz_lima$UBIGEO[match_i[matched]]))
nse_out <- nse_out[matched & !is.na(nse_out$id_manzana_norm) & nzchar(nse_out$id_manzana_norm), , drop = FALSE]
nse_out <- nse_out[order(nse_out$id_manzana_norm, nse_out$nse_match_method, nse_out$nse_distance_m), , drop = FALSE]
dup_counts <- table(nse_out$id_manzana_norm)
nse_out$nse_records_for_manzana <- as.integer(dup_counts[nse_out$id_manzana_norm])
nse_out <- nse_out[!duplicated(nse_out$id_manzana_norm), , drop = FALSE]
rownames(nse_out) <- NULL
write_csv_gz(nse_out, out_nse)

level_counts <- as.list(sort(table(nse$NIV_ESTRA), decreasing = TRUE))
nse_manifest <- list(
  id = "nse-inei2017-lima-manzanas",
  version = "nse-inei2017-lima-manzanas-v1",
  source = "NSE Lima INEI",
  source_file = normalizePath(nse_path, mustWork = FALSE),
  coverage = "Lima Metropolitana",
  year = 2017L,
  levels = level_counts,
  source_records = nrow(nse),
  matched_source_records = sum(!is.na(match_i)),
  matched_blocks = nrow(nse_out),
  match_rate = round(sum(!is.na(match_i)) / nrow(nse), 6),
  unmatched_source_records = sum(is.na(match_i)),
  duplicate_block_matches = sum(dup_counts > 1L),
  callao_available = FALSE,
  packaged_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
)
nse_manifest$checksum <- as.list(tools::md5sum(out_nse))
write_json(nse_manifest, out_nse_manifest)

cat("Writing official zone GeoJSON packages...\n")
zones <- sf::st_read(file.path(map_dir, "Zo_LimaMetropolitana.shp"), quiet = TRUE, stringsAsFactors = FALSE)
zones <- sf::st_transform(zones, 4326)
zone_counts <- list()
for (ubigeo in sort(unique(sprintf("%06s", as.character(zones$UBIGEO))))) {
  sf_sub <- zones[sprintf("%06s", as.character(zones$UBIGEO)) == ubigeo, , drop = FALSE]
  sf_sub <- sf_sub[, c(
    "IDZONA", "CODDPTO", "CODPROV", "CODDIST", "CODZONA", "SUFZONA",
    "UBIGEO", "NOMCCPP", "NOMBDPTO", "NOMBPROV", "NOMBDIST", "IDCCPP", "CIUDAD"
  )]
  sf_sub$UBIGEO <- sprintf("%06s", as.character(sf_sub$UBIGEO))
  sf_sub$fuente_anio <- 2017L
  out_file <- file.path(out_zones_dir, paste0(ubigeo, ".geojson.gz"))
  write_geojson_gz(sf_sub, out_file)
  zone_counts[[ubigeo]] <- as.integer(nrow(sf_sub))
}
zones_manifest <- list(
  id = "inei2017-zones-lima-callao",
  version = "inei2017-zones-lima-callao-v1",
  schema_version = 1L,
  provider = "Instituto Nacional de Estadistica e Informatica (INEI)",
  source = "Informacion Digital Urbano Censal Ciudad Lima Metropolitana 2017",
  source_layer = "Zo_LimaMetropolitana",
  year = 2017L,
  coverage = "Lima Metropolitana y Callao",
  geometry = "poligono_zona_censal",
  spatial_reference = "EPSG:4326 / WGS84",
  packaging_mode = "local_only",
  compression = "gzip_por_distrito",
  packaged_districts = length(zone_counts),
  packaged_zones = nrow(zones),
  packaged_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  counts_by_district = zone_counts,
  checksum = as.list(tools::md5sum(list.files(out_zones_dir, pattern = "[.]geojson[.]gz$", full.names = TRUE))),
  attribution = "Fuente: INEI, Informacion Digital Urbano Censal 2017"
)
write_json(zones_manifest, out_zones_manifest)

cat("Building current-vs-official audit...\n")
current_path <- file.path(script_dir, "inei2017_lima_callao_manzanas_full.csv.gz")
current <- utils::read.csv(gzfile(current_path), stringsAsFactors = FALSE, check.names = FALSE)
current$id_manzana_norm <- normalize_id_manzana(current$id_manzana)

collapse_frame <- function(df, prefix) {
  df$id_manzana_norm <- as.character(df$id_manzana_norm)
  df <- df[!is.na(df$id_manzana_norm) & nzchar(df$id_manzana_norm), , drop = FALSE]
  numeric <- stats::aggregate(
    df[c("viviendas", "poblacion")],
    by = list(id_manzana_norm = df$id_manzana_norm),
    FUN = sum,
    na.rm = TRUE
  )
  chars <- stats::aggregate(
    df[c("id_manzana", "ubigeo", "distrito", "zona", "cartografia_fuente")],
    by = list(id_manzana_norm = df$id_manzana_norm),
    FUN = first_nonempty
  )
  counts <- stats::aggregate(
    data.frame(n_records = rep(1L, nrow(df))),
    by = list(id_manzana_norm = df$id_manzana_norm),
    FUN = sum
  )
  out <- Reduce(function(x, y) merge(x, y, by = "id_manzana_norm", all = TRUE), list(chars, numeric, counts))
  names(out)[names(out) != "id_manzana_norm"] <- paste(prefix, names(out)[names(out) != "id_manzana_norm"], sep = "_")
  out
}

cur <- collapse_frame(current, "current")
off <- collapse_frame(frame, "official")
audit <- merge(cur, off, by = "id_manzana_norm", all = TRUE)
audit$status <- ifelse(!is.na(audit$current_id_manzana) & !is.na(audit$official_id_manzana), "both",
                       ifelse(!is.na(audit$current_id_manzana), "current_only", "official_only"))
audit$diff_viviendas <- audit$official_viviendas - audit$current_viviendas
audit$diff_poblacion <- audit$official_poblacion - audit$current_poblacion
audit <- audit[order(audit$status, audit$id_manzana_norm), , drop = FALSE]
write_csv_gz(audit, out_audit)

both <- audit[audit$status == "both", , drop = FALSE]
both$abs_diff_viviendas <- abs(both$diff_viviendas)
both$abs_diff_poblacion <- abs(both$diff_poblacion)
major <- both[order(-both$abs_diff_viviendas, -both$abs_diff_poblacion), , drop = FALSE]
major <- head(major, 50L)
summary <- list(
  id = "audit-current-vs-inei2017-official-frame",
  version = "audit-current-vs-inei2017-official-frame-v1",
  current_path = normalizePath(current_path, mustWork = FALSE),
  official_path = normalizePath(out_frame, mustWork = FALSE),
  rows = nrow(audit),
  status_counts = as.list(table(audit$status)),
  current = list(
    rows = nrow(current),
    unique_ids = length(unique(current$id_manzana_norm)),
    viviendas = as.integer(sum(current$viviendas, na.rm = TRUE)),
    poblacion = as.integer(sum(current$poblacion, na.rm = TRUE))
  ),
  official = list(
    rows = nrow(frame),
    unique_ids = length(unique(frame$id_manzana_norm)),
    viviendas = as.integer(sum(frame$viviendas, na.rm = TRUE)),
    poblacion = as.integer(sum(frame$poblacion, na.rm = TRUE))
  ),
  major_differences = lapply(seq_len(nrow(major)), function(i) as.list(major[i, , drop = FALSE])),
  packaged_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  audit_path = normalizePath(out_audit, mustWork = FALSE),
  checksum = as.list(tools::md5sum(out_audit))
)
write_json(summary, out_audit_summary)

cat("Done.\n")
cat(sprintf("Official frame: %s rows\n", format(nrow(frame), big.mark = ",")))
cat(sprintf("NSE matched blocks: %s\n", format(nrow(nse_out), big.mark = ",")))
cat(sprintf("Zones: %s\n", format(nrow(zones), big.mark = ",")))
