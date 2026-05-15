# Cliente minimo para KoboToolbox API v2 usado por Monitoreo.

kobo_api_default_base_url <- function() {
  "https://kf.kobotoolbox.org"
}

.kobo_api_trim_base_url <- function(base_url = NULL) {
  base <- as.character(base_url %||% kobo_api_default_base_url())[1]
  if (!nzchar(base)) base <- kobo_api_default_base_url()
  sub("/+$", "", base)
}

.kobo_api_fetch_json <- function(url, token) {
  if (!nzchar(token)) stop("Falta el token de KoboToolbox.", call. = FALSE)
  if (!requireNamespace("curl", quietly = TRUE)) {
    stop("El paquete R 'curl' no esta instalado.", call. = FALSE)
  }
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    stop("El paquete R 'jsonlite' no esta instalado.", call. = FALSE)
  }

  h <- curl::new_handle()
  curl::handle_setheaders(h,
    "Authorization" = paste("Token", token),
    "Accept" = "application/json"
  )
  res <- curl::curl_fetch_memory(url, handle = h)
  body <- rawToChar(res$content)
  Encoding(body) <- "UTF-8"

  if (res$status_code == 401L || res$status_code == 403L) {
    stop("Token rechazado por KoboToolbox. Verifica permisos y servidor.", call. = FALSE)
  }
  if (res$status_code == 404L) {
    stop("Proyecto Kobo no encontrado. Verifica el asset UID.", call. = FALSE)
  }
  if (res$status_code >= 400L) {
    stop(sprintf("KoboToolbox devolvio HTTP %d: %s", res$status_code, body), call. = FALSE)
  }

  jsonlite::fromJSON(body, simplifyVector = FALSE)
}

#' Descargar una pagina de submissions Kobo v2
#'
#' @param asset_uid UID del proyecto Kobo.
#' @param token Token API de Kobo.
#' @param base_url Host KPI, por defecto `https://kf.kobotoolbox.org`.
#' @param page Pagina a descargar.
#' @param page_size Tamano de pagina.
#' @return Lista JSON de Kobo con `count`, `next`, `previous`, `results`.
#' @export
kobo_api_fetch_asset_data <- function(asset_uid,
                                      token,
                                      base_url = kobo_api_default_base_url(),
                                      page = 1L,
                                      page_size = 1000L) {
  uid <- trimws(as.character(asset_uid %||% "")[1])
  if (!nzchar(uid)) stop("Falta el asset UID de Kobo.", call. = FALSE)
  page <- suppressWarnings(as.integer(page %||% 1L))
  page_size <- suppressWarnings(as.integer(page_size %||% 1000L))
  if (!is.finite(page) || page < 1L) page <- 1L
  if (!is.finite(page_size) || page_size < 1L) page_size <- 1000L
  page_size <- min(page_size, 1000L)

  url <- sprintf(
    "%s/api/v2/assets/%s/data/?format=json&page=%d&page_size=%d",
    .kobo_api_trim_base_url(base_url),
    utils::URLencode(uid, reserved = TRUE),
    page,
    page_size
  )
  .kobo_api_fetch_json(url, token)
}

#' Descargar todas las submissions Kobo v2 siguiendo paginacion
#'
#' @param progress Funcion opcional `function(current,total,message)`.
#' @export
kobo_api_fetch_all_asset_data <- function(asset_uid,
                                          token,
                                          base_url = kobo_api_default_base_url(),
                                          page_size = 1000L,
                                          max_pages = 500L,
                                          progress = NULL) {
  page <- 1L
  out <- list()
  total <- NA_integer_
  next_url <- NULL

  repeat {
    payload <- if (is.null(next_url)) {
      kobo_api_fetch_asset_data(asset_uid, token, base_url, page = page, page_size = page_size)
    } else {
      .kobo_api_fetch_json(next_url, token)
    }
    rows <- payload$results %||% list()
    if (length(rows)) out <- c(out, rows)
    total <- suppressWarnings(as.integer(payload$count %||% total))
    if (!is.null(progress)) {
      progress(length(out), if (is.finite(total)) total else NA_integer_,
               sprintf("Kobo: %d registros", length(out)))
    }
    next_url <- payload[["next"]] %||% NULL
    if (is.null(next_url) || !nzchar(as.character(next_url))) break
    page <- page + 1L
    if (page > max_pages) {
      stop("Se alcanzo el limite de paginas configurado para Kobo.", call. = FALSE)
    }
  }

  list(
    ok = TRUE,
    count = as.integer(length(out)),
    total = if (is.finite(total)) as.integer(total) else as.integer(length(out)),
    results = out
  )
}

kobo_api_flatten_results <- function(results) {
  if (is.null(results) || !length(results)) return(data.frame())
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    stop("El paquete R 'jsonlite' no esta instalado.", call. = FALSE)
  }
  df <- tryCatch(
    jsonlite::fromJSON(
      jsonlite::toJSON(results, auto_unbox = TRUE, null = "null"),
      flatten = TRUE
    ),
    error = function(e) {
      json <- jsonlite::toJSON(results, auto_unbox = TRUE, null = "null")
      jsonlite::fromJSON(json, flatten = TRUE)
    }
  )
  df <- as.data.frame(df, stringsAsFactors = FALSE, optional = TRUE)
  for (nm in names(df)) {
    if (is.list(df[[nm]]) && !is.data.frame(df[[nm]])) {
      df[[nm]] <- vapply(df[[nm]], function(x) {
        if (is.null(x)) return(NA_character_)
        jsonlite::toJSON(x, auto_unbox = TRUE, null = "null")
      }, character(1))
    }
  }
  df
}
