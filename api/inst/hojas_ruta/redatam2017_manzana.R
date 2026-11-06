# Cliente REDATAM CPV 2017 por manzana, compartido por los builders de Hojas de ruta.
# Copia literal de build_inei2017_lima_callao_frame.R (que aún lo define en línea);
# el builder de ciudades lo usa con `source()`. Requiere `cache_dir` y `%||%` definidos.

clean_int <- function(x) {
  x <- trimws(as.character(x))
  x[x == "-" | x == ""] <- "0"
  as.integer(gsub("[^0-9-]", "", x))
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

