#!/usr/bin/env Rscript

# Extracts official INEI 2017 single-year age by sex from REDATAM WebStats.
#
# Output schema:
# ubigeo, departamento, provincia, distrito, edad, sexo, poblacion,
# fuente_base, variable_edad, variable_sexo, selection, fetched_at, redatam_table_url

options(stringsAsFactors = FALSE, warn = 1)

stop_if_missing <- function(pkg) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    stop(sprintf("Package '%s' is required.", pkg), call. = FALSE)
  }
}

stop_if_missing("curl")
stop_if_missing("xml2")

`%||%` <- function(x, y) if (is.null(x) || length(x) == 0L || is.na(x[[1]])) y else x

redatam_post <- function(url, params, timeout = 90) {
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
    useragent = "Mozilla/5.0 prosecnur-redatam-extractor"
  )
  curl::handle_setheaders(
    h,
    "Content-Type" = "application/x-www-form-urlencoded; charset=UTF-8",
    "Accept" = "text/html,application/xhtml+xml"
  )
  res <- curl::curl_fetch_memory(url, handle = h)
  rawToChar(res$content)
}

redatam_get <- function(url, timeout = 90) {
  h <- curl::new_handle(timeout = timeout, connecttimeout = 20,
                        useragent = "Mozilla/5.0 prosecnur-redatam-extractor")
  res <- curl::curl_fetch_memory(url, handle = h)
  rawToChar(res$content)
}

extract_iframe_url <- function(html) {
  doc <- xml2::read_html(html)
  node <- xml2::xml_find_first(doc, ".//iframe")
  if (inherits(node, "xml_missing")) return(NA_character_)
  xml2::xml_attr(node, "src") %||% NA_character_
}

clean_int <- function(x) {
  x <- trimws(as.character(x))
  x[x == "-" | x == ""] <- "0"
  as.integer(gsub("[^0-9-]", "", x))
}

parse_age_table <- function(html, ubigeo, geo) {
  doc <- xml2::read_html(html)
  rows <- xml2::xml_find_all(doc, ".//tr")
  out <- list()
  for (row in rows) {
    cells <- trimws(xml2::xml_text(xml2::xml_find_all(row, "./td")))
    if (length(cells) < 5L) next
    m <- regexec("^Edad ([0-9]+)", cells[[2]])
    age_match <- regmatches(cells[[2]], m)[[1]]
    if (length(age_match) < 2L) next
    edad <- as.integer(age_match[[2]])
    out[[length(out) + 1L]] <- data.frame(
      ubigeo = ubigeo,
      departamento = geo$departamento,
      provincia = geo$provincia,
      distrito = geo$distrito,
      edad = edad,
      sexo = c("Hombre", "Mujer"),
      poblacion = clean_int(c(cells[[3]], cells[[4]])),
      stringsAsFactors = FALSE
    )
  }
  if (!length(out)) {
    stop(sprintf("No single-year age rows found for UBIGEO %s.", ubigeo), call. = FALSE)
  }
  do.call(rbind, out)
}

fetch_district_age_simple <- function(ubigeo, geo, retries = 3L, sleep_seconds = 2) {
  endpoint <- "https://censos2017.inei.gob.pe/bininei2/RpWebStats.exe/CrossTab?"
  selection <- sprintf("sels\\Distrito_%s.sel", ubigeo)
  params <- c(
    MAIN = "WebServerMain.inl",
    BASE = "CPV2017",
    LANG = "esp",
    CODIGO = "XXUSUARIOXX",
    ITEM = "PIRAMI",
    MODE = "RUN",
    inputTitle = "Edad simple por sexo",
    ROW = "Poblacio.C5P41",
    COLUMN = "Poblacio.SEXO",
    AREABREAK = "",
    SELECTION = selection,
    FORMAT = "HTML",
    PERCENT = "OFF",
    UNIVERSE = "",
    FILTER = "",
    TEXT_FILTER = ""
  )
  last_error <- NULL
  for (attempt in seq_len(retries)) {
    html <- tryCatch(redatam_post(endpoint, params), error = identity)
    if (!inherits(html, "error")) {
      iframe <- extract_iframe_url(html)
      if (!is.na(iframe) && nzchar(iframe)) {
        table_html <- tryCatch(redatam_get(iframe), error = identity)
        if (!inherits(table_html, "error")) {
          parsed <- parse_age_table(table_html, ubigeo, geo)
          parsed$fuente_base <- "INEI REDATAM CPV2017 - Manzana"
          parsed$variable_edad <- "Poblacio.C5P41"
          parsed$variable_sexo <- "Poblacio.SEXO"
          parsed$selection <- selection
          parsed$fetched_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z")
          parsed$redatam_table_url <- iframe
          return(parsed)
        }
        last_error <- conditionMessage(table_html)
      } else {
        last_error <- sub("\\s+", " ", substr(html, 1L, 400L))
      }
    } else {
      last_error <- conditionMessage(html)
    }
    if (attempt < retries) Sys.sleep(sleep_seconds * attempt)
  }
  stop(sprintf("Could not fetch UBIGEO %s: %s", ubigeo, last_error), call. = FALSE)
}

read_pilot_geography <- function(path) {
  frame <- utils::read.csv(path, stringsAsFactors = FALSE, check.names = FALSE,
                           fileEncoding = "UTF-8")
  frame$ubigeo <- sprintf("%06s", as.character(frame$ubigeo))
  geo <- unique(frame[c("ubigeo", "departamento", "provincia", "distrito")])
  geo[order(geo$departamento, geo$provincia, geo$distrito), , drop = FALSE]
}

cmd_args <- commandArgs(trailingOnly = FALSE)
file_arg <- grep("^--file=", cmd_args, value = TRUE)
script_path <- if (length(file_arg)) sub("^--file=", "", file_arg[[1]]) else "."
script_dir <- dirname(normalizePath(script_path, mustWork = FALSE))
default_frame <- file.path(script_dir, "inei2017_lima_callao_manzanas.csv")
default_out <- file.path(script_dir, "inei2017_lima_callao_edad_simple_distrito.csv")

frame_path <- Sys.getenv("HOJAS_RUTA_INEI_FRAME", default_frame)
out_path <- Sys.getenv("HOJAS_RUTA_INEI_AGE_OUT", default_out)
ubigeos_arg <- Sys.getenv("HOJAS_RUTA_INEI_UBIGEOS", "")

geo <- read_pilot_geography(frame_path)
if (nzchar(ubigeos_arg)) {
  wanted <- strsplit(ubigeos_arg, ",", fixed = TRUE)[[1]]
  wanted <- sprintf("%06s", trimws(wanted))
  geo <- geo[geo$ubigeo %in% wanted, , drop = FALSE]
}
if (!nrow(geo)) stop("No UBIGEOs to extract.", call. = FALSE)

message(sprintf("Extracting %d district(s) from official INEI REDATAM CPV2017...", nrow(geo)))
parts <- list()
for (i in seq_len(nrow(geo))) {
  g <- as.list(geo[i, , drop = FALSE])
  g[] <- lapply(g, function(x) x[[1]])
  message(sprintf("[%d/%d] %s %s", i, nrow(geo), g$ubigeo, g$distrito))
  parts[[length(parts) + 1L]] <- fetch_district_age_simple(g$ubigeo, g)
  if (i < nrow(geo)) Sys.sleep(1.5)
}

out <- do.call(rbind, parts)
out <- out[order(out$ubigeo, out$sexo, out$edad), , drop = FALSE]
dir.create(dirname(out_path), recursive = TRUE, showWarnings = FALSE)
utils::write.csv(out, out_path, row.names = FALSE, fileEncoding = "UTF-8")
message(sprintf("Wrote %s (%d rows).", normalizePath(out_path, mustWork = FALSE), nrow(out)))
