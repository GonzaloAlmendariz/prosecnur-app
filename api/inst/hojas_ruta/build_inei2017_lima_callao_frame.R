#!/usr/bin/env Rscript

# Builds the local Hojas de ruta sampling frame by matching official
# INEI REDATAM 2017 manzana counts to the packaged district block geometry.

options(stringsAsFactors = FALSE, warn = 1)

stop_if_missing <- function(pkg) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    stop(sprintf("Package '%s' is required.", pkg), call. = FALSE)
  }
}

stop_if_missing("curl")
stop_if_missing("xml2")
stop_if_missing("jsonlite")

`%||%` <- function(x, y) if (is.null(x) || length(x) == 0L) y else x

script_path <- sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE)[1] %||% ".")
script_dir <- dirname(normalizePath(script_path, mustWork = FALSE))
repo_root <- normalizePath(file.path(script_dir, "..", "..", ".."), mustWork = FALSE)
carto_root <- file.path(script_dir, "cartografia")
district_geojson_path <- file.path(repo_root, "frontend", "src", "features", "hojasRuta", "limaDistrictCoverage.json")
out_path <- Sys.getenv(
  "HOJAS_RUTA_INEI_FRAME_OUT",
  file.path(script_dir, "inei2017_lima_callao_manzanas_full.csv.gz")
)
cache_dir <- Sys.getenv(
  "HOJAS_RUTA_REDDATAM_MANZANA_CACHE",
  file.path(script_dir, "redatam_manzana_cache")
)
dir.create(cache_dir, recursive = TRUE, showWarnings = FALSE)

clean_int <- function(x) {
  x <- trimws(as.character(x))
  x[x == "-" | x == ""] <- "0"
  as.integer(gsub("[^0-9-]", "", x))
}

read_json_any <- function(path) {
  if (grepl("[.]gz$", path)) {
    con <- gzfile(path, open = "rt", encoding = "UTF-8")
    on.exit(close(con), add = TRUE)
    txt <- paste(readLines(con, warn = FALSE), collapse = "\n")
    return(jsonlite::fromJSON(txt, simplifyVector = FALSE))
  }
  jsonlite::read_json(path, simplifyVector = FALSE)
}

geojson_path_for <- function(ubigeo) {
  dir_name <- if (startsWith(ubigeo, "1501")) "manzanas_lima_2017" else "manzanas_callao_2019"
  base <- file.path(carto_root, dir_name, paste0(ubigeo, ".geojson"))
  if (file.exists(base)) return(base)
  gz <- paste0(base, ".gz")
  if (file.exists(gz)) return(gz)
  stop(sprintf("No packaged GeoJSON for UBIGEO %s.", ubigeo), call. = FALSE)
}

coords_points <- function(geometry) {
  pts <- list()
  walk <- function(x) {
    if (is.numeric(x) && length(x) >= 2L) {
      pts[[length(pts) + 1L]] <<- c(as.numeric(x[[1]]), as.numeric(x[[2]]))
    } else if (is.list(x)) {
      for (item in x) walk(item)
    }
  }
  walk(geometry$coordinates)
  if (!length(pts)) return(matrix(numeric(0), ncol = 2))
  do.call(rbind, pts)
}

cartography_rows <- function(ubigeo) {
  geo <- read_json_any(geojson_path_for(ubigeo))
  rows <- lapply(geo$features %||% list(), function(feature) {
    props <- feature$properties %||% list()
    id <- as.character(props$ID_MANZANA %||% props$cartografia_id %||% "")
    pts <- coords_points(feature$geometry %||% list())
    area <- suppressWarnings(as.numeric(props$AREA_M2 %||% 0))
    data.frame(
      id_manzana = id,
      departamento = as.character(props$NOMBDEP %||% ""),
      provincia = as.character(props$NOMBPROV %||% ""),
      distrito = as.character(props$NOMBDIST %||% ""),
      ubigeo = ubigeo,
      zona = if (nchar(id) >= 11L) substr(id, 7L, 11L) else NA_character_,
      manzana = if (nchar(id) >= 15L) substr(id, 12L, 15L) else NA_character_,
      cartografia_id = id,
      cartografia_key = if (nchar(id) >= 14L) substr(id, 1L, 14L) else id,
      area_m2 = area,
      lat = if (nrow(pts)) mean(pts[, 2], na.rm = TRUE) else NA_real_,
      lon = if (nrow(pts)) mean(pts[, 1], na.rm = TRUE) else NA_real_,
      cartografia_fuente = as.character(props$FTE_MZNA %||% ""),
      cartografia_anio = suppressWarnings(as.integer(props$fuente_anio %||% NA_integer_)),
      stringsAsFactors = FALSE
    )
  })
  out <- if (length(rows)) do.call(rbind, rows) else data.frame()
  if (!nrow(out)) return(out)
  stats::aggregate(
    out[c("area_m2", "lat", "lon")],
    by = out[c("id_manzana", "departamento", "provincia", "distrito", "ubigeo",
               "zona", "manzana", "cartografia_id", "cartografia_key",
               "cartografia_fuente", "cartografia_anio")],
    FUN = function(x) if (all(is.na(x))) NA_real_ else mean(x, na.rm = TRUE)
  )
}

redatam_post <- function(params, timeout = 120) {
  h <- curl::new_handle()
  fields <- paste(
    utils::URLencode(names(params), reserved = TRUE),
    vapply(params, utils::URLencode, character(1), reserved = TRUE),
    sep = "=",
    collapse = "&"
  )
  curl::handle_setopt(
    h,
    post = TRUE,
    postfields = charToRaw(fields),
    timeout = timeout,
    connecttimeout = 20,
    useragent = "Mozilla/5.0 prosecnur-redatam-frame-builder"
  )
  curl::handle_setheaders(
    h,
    "Content-Type" = "application/x-www-form-urlencoded; charset=UTF-8",
    "Accept" = "text/html,application/xhtml+xml"
  )
  rawToChar(curl::curl_fetch_memory(
    "https://censos2017.inei.gob.pe/bininei2/RpWebStats.exe/CrossTab?",
    handle = h
  )$content)
}

html_table_matrix <- function(html) {
  doc <- xml2::read_html(html)
  rows <- xml2::xml_find_all(doc, ".//tr")
  cells <- lapply(rows, function(row) {
    trimws(xml2::xml_text(xml2::xml_find_all(row, "./th|./td")))
  })
  max_cols <- max(vapply(cells, length, integer(1)), 0L)
  if (!max_cols) return(data.frame())
  mat <- t(vapply(cells, function(x) {
    length(x) <- max_cols
    x[is.na(x)] <- ""
    x
  }, character(max_cols)))
  out <- as.data.frame(mat, stringsAsFactors = FALSE, check.names = FALSE)
  names(out) <- paste0("X", seq_len(ncol(out)))
  out
}

fetch_redatam_table <- function(ubigeo, row, column, retries = 3L) {
  cache_file <- file.path(cache_dir, sprintf("%s_%s_%s.csv", ubigeo, gsub("[^A-Za-z0-9]+", "_", row), gsub("[^A-Za-z0-9]+", "_", column)))
  if (file.exists(cache_file)) {
    return(utils::read.csv(cache_file, stringsAsFactors = FALSE, check.names = FALSE))
  }
  params <- c(
    MAIN = "WebServerMain.inl",
    BASE = "CPV2017",
    LANG = "esp",
    CODIGO = "XXUSUARIOXX",
    ITEM = "PIRAMI",
    MODE = "RUN",
    inputTitle = "Marco manzana",
    ROW = row,
    COLUMN = column,
    AREABREAK = "",
    SELECTION = sprintf("sels\\Distrito_%s.sel", ubigeo),
    FORMAT = "HTML",
    PERCENT = "OFF",
    UNIVERSE = "",
    FILTER = "",
    TEXT_FILTER = ""
  )
  last_error <- NULL
  for (attempt in seq_len(retries)) {
    html <- tryCatch(redatam_post(params), error = identity)
    if (!inherits(html, "error") && !grepl("Redatam Webserver Exception", html, fixed = TRUE)) {
      iframe <- tryCatch(xml2::xml_attr(xml2::xml_find_first(xml2::read_html(html), ".//iframe"), "src"), error = function(e) NA_character_)
      if (!is.na(iframe) && nzchar(iframe)) {
        table_html <- tryCatch(rawToChar(curl::curl_fetch_memory(
          iframe,
          handle = curl::new_handle(timeout = 120, connecttimeout = 20, useragent = "Mozilla/5.0 prosecnur-redatam-frame-builder")
        )$content), error = identity)
        if (!inherits(table_html, "error")) {
          out <- html_table_matrix(table_html)
          utils::write.csv(out, cache_file, row.names = FALSE, fileEncoding = "UTF-8")
          return(out)
        }
        last_error <- conditionMessage(table_html)
      } else {
        last_error <- "No iframe table returned."
      }
    } else {
      last_error <- if (inherits(html, "error")) conditionMessage(html) else substr(gsub("\\s+", " ", html), 1L, 400L)
    }
    if (attempt < retries) Sys.sleep(attempt * 2)
  }
  stop(sprintf("REDATAM failed for %s %s x %s: %s", ubigeo, row, column, last_error), call. = FALSE)
}

redatam_code_to_cartography <- function(code) {
  code <- trimws(sub(",.*$", "", as.character(code)))
  code <- gsub("\\s+", "", code)
  ok <- nchar(code) >= 18L
  out <- rep(NA_character_, length(code))
  if (any(ok)) {
    ubigeo <- substr(code[ok], 1L, 6L)
    zona <- substr(code[ok], 11L, 15L)
    mz <- substr(code[ok], 16L, nchar(code[ok]))
    mz <- ifelse(grepl("^[0-9]{3}$", mz), paste0(mz, "0"), mz)
    out[ok] <- paste0(ubigeo, zona, mz)
  }
  out
}

parse_population <- function(tab, ubigeo) {
  if (!nrow(tab) || !all(c("X2", "X3", "X4", "X5") %in% names(tab))) return(data.frame())
  keep <- startsWith(trimws(as.character(tab$X2)), ubigeo)
  out <- data.frame(
    cartografia_id_redatam = redatam_code_to_cartography(tab$X2[keep]),
    poblacion_h = clean_int(tab$X3[keep]),
    poblacion_m = clean_int(tab$X4[keep]),
    poblacion = clean_int(tab$X5[keep]),
    stringsAsFactors = FALSE
  )
  out$cartografia_key <- substr(out$cartografia_id_redatam, 1L, 14L)
  out[!is.na(out$cartografia_id_redatam), , drop = FALSE]
}

parse_housing <- function(tab, ubigeo) {
  if (!nrow(tab) || !all(c("X2", "X10") %in% names(tab))) return(data.frame())
  keep <- startsWith(trimws(as.character(tab$X2)), ubigeo)
  out <- data.frame(
    cartografia_id_redatam = redatam_code_to_cartography(tab$X2[keep]),
    viviendas = clean_int(tab$X10[keep]),
    stringsAsFactors = FALSE
  )
  out$cartografia_key <- substr(out$cartografia_id_redatam, 1L, 14L)
  out[!is.na(out$cartografia_id_redatam), , drop = FALSE]
}

allocate_integer <- function(weights, total) {
  total <- as.integer(total %||% 0L)
  if (!length(weights)) return(integer(0))
  weights <- suppressWarnings(as.numeric(weights))
  weights[is.na(weights) | weights <= 0] <- 1
  if (total <= 0L) return(rep(0L, length(weights)))
  raw <- total * weights / sum(weights)
  out <- floor(raw)
  rem <- total - sum(out)
  if (rem > 0L) {
    ord <- order(raw - out, weights, decreasing = TRUE)
    out[ord[seq_len(min(rem, length(ord)))]] <- out[ord[seq_len(min(rem, length(ord)))]] + 1L
  }
  as.integer(out)
}

attach_counts <- function(carto, pop, viv) {
  if (!nrow(carto)) return(carto)
  pop_by_key <- stats::aggregate(
    pop[c("poblacion_h", "poblacion_m", "poblacion")],
    by = pop["cartografia_key"],
    FUN = sum,
    na.rm = TRUE
  )
  viv_by_key <- stats::aggregate(viv["viviendas"], by = viv["cartografia_key"], FUN = sum, na.rm = TRUE)
  carto$poblacion_h <- 0L
  carto$poblacion_m <- 0L
  carto$poblacion <- 0L
  carto$viviendas <- 0L
  carto$conteo_fuente <- "INEI REDATAM CPV2017 - Manzana.NMANZ"

  for (key in unique(carto$cartografia_key)) {
    idx <- which(carto$cartografia_key == key)
    weights <- carto$area_m2[idx]
    p <- pop_by_key[pop_by_key$cartografia_key == key, , drop = FALSE]
    v <- viv_by_key[viv_by_key$cartografia_key == key, , drop = FALSE]
    if (nrow(p)) {
      carto$poblacion_h[idx] <- allocate_integer(weights, p$poblacion_h[[1]])
      carto$poblacion_m[idx] <- allocate_integer(weights, p$poblacion_m[[1]])
      carto$poblacion[idx] <- carto$poblacion_h[idx] + carto$poblacion_m[idx]
    }
    if (nrow(v)) {
      carto$viviendas[idx] <- allocate_integer(weights, v$viviendas[[1]])
    }
  }
  carto$match_level <- ifelse(carto$poblacion > 0 | carto$viviendas > 0, "cartografia_key", "sin_conteo_redatam")
  carto
}

district_features <- jsonlite::read_json(district_geojson_path, simplifyVector = FALSE)$features
districts <- do.call(rbind, lapply(district_features, function(feature) {
  p <- feature$properties
  data.frame(
    ubigeo = as.character(p$ubigeo),
    departamento = as.character(p$departamento %||% ""),
    provincia = as.character(p$provincia %||% ""),
    distrito = as.character(p$distrito %||% ""),
    stringsAsFactors = FALSE
  )
}))
districts <- districts[order(districts$ubigeo), , drop = FALSE]

ubigeos_arg <- Sys.getenv("HOJAS_RUTA_INEI_UBIGEOS", "")
if (nzchar(ubigeos_arg)) {
  wanted <- sprintf("%06s", trimws(strsplit(ubigeos_arg, ",", fixed = TRUE)[[1]]))
  districts <- districts[districts$ubigeo %in% wanted, , drop = FALSE]
}

message(sprintf("Building frame for %d district(s).", nrow(districts)))
parts <- list()
for (i in seq_len(nrow(districts))) {
  ubigeo <- districts$ubigeo[[i]]
  message(sprintf("[%d/%d] %s %s", i, nrow(districts), ubigeo, districts$distrito[[i]]))
  carto <- cartography_rows(ubigeo)
  pop <- parse_population(fetch_redatam_table(ubigeo, "Manzana.NMANZ", "Poblacio.SEXO"), ubigeo)
  viv <- parse_housing(fetch_redatam_table(ubigeo, "Manzana.NMANZ", "Vivienda.C2P2"), ubigeo)
  rows <- attach_counts(carto, pop, viv)
  rows$departamento <- districts$departamento[[i]]
  rows$provincia <- districts$provincia[[i]]
  rows$distrito <- districts$distrito[[i]]
  parts[[length(parts) + 1L]] <- rows
  if (i < nrow(districts)) Sys.sleep(0.4)
}

out <- do.call(rbind, parts)
out <- out[order(out$ubigeo, out$zona, out$manzana, out$id_manzana), , drop = FALSE]
out <- out[, c(
  "ubigeo", "departamento", "provincia", "distrito", "zona", "manzana",
  "id_manzana", "cartografia_id", "viviendas", "poblacion", "poblacion_h",
  "poblacion_m", "lat", "lon", "area_m2", "cartografia_fuente",
  "cartografia_anio", "conteo_fuente", "match_level"
)]
dir.create(dirname(out_path), recursive = TRUE, showWarnings = FALSE)
con <- gzfile(out_path, open = "wt", encoding = "UTF-8")
utils::write.csv(out, con, row.names = FALSE)
close(con)
message(sprintf("Wrote %s (%s rows).", normalizePath(out_path, mustWork = FALSE), format(nrow(out), big.mark = ",")))
