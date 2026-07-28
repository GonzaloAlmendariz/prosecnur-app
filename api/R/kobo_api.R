# Cliente minimo para KoboToolbox API v2 usado por Monitoreo.

kobo_api_default_base_url <- function() {
  "https://kf.kobotoolbox.org"
}

.kobo_api_trim_base_url <- function(base_url = NULL) {
  base <- as.character(base_url %||% kobo_api_default_base_url())[1]
  if (!nzchar(base)) base <- kobo_api_default_base_url()
  sub("/+$", "", base)
}

# Timeouts del transporte Kobo (unidad 3.8): antes el handle iba sin timeout
# y un socket colgado dejaba el sync infinito. Overridables por env.
.kobo_api_timeout_seconds <- function(value = Sys.getenv("PROSECNUR_KOBO_TIMEOUT_SECONDS", unset = ""),
                                      default = 120,
                                      min_seconds = 5,
                                      max_seconds = 600) {
  seconds <- suppressWarnings(as.numeric(value %||% default))
  if (!is.finite(seconds) || seconds <= 0) seconds <- default
  min(max_seconds, max(min_seconds, seconds))
}

.kobo_api_connect_timeout_seconds <- function(timeout_seconds = .kobo_api_timeout_seconds(),
                                              value = Sys.getenv("PROSECNUR_KOBO_CONNECT_TIMEOUT_SECONDS", unset = "")) {
  timeout_seconds <- .kobo_api_timeout_seconds(timeout_seconds)
  seconds <- suppressWarnings(as.numeric(value %||% min(10, timeout_seconds)))
  if (!is.finite(seconds) || seconds <= 0) seconds <- min(10, timeout_seconds)
  min(timeout_seconds, max(1, seconds))
}

.kobo_api_new_handle <- function() {
  h <- curl::new_handle()
  timeout <- .kobo_api_timeout_seconds()
  curl::handle_setopt(
    h,
    timeout = timeout,
    connecttimeout = .kobo_api_connect_timeout_seconds(timeout)
  )
  h
}

.kobo_api_auth_handle <- function(token) {
  h <- .kobo_api_new_handle()
  curl::handle_setheaders(h,
    "Authorization" = paste("Token", token),
    "Accept" = "application/json"
  )
  h
}

# Seam de transporte GET (mockeable en tests, sin red).
.kobo_api_http_fetch <- function(url, handle) {
  curl::curl_fetch_memory(url, handle = handle)
}

# Seam de espera entre reintentos (mockeable en tests).
.kobo_api_retry_sleep <- function(seconds) {
  seconds <- suppressWarnings(as.numeric(seconds)[1])
  if (is.finite(seconds) && seconds > 0) Sys.sleep(min(seconds, 30))
  invisible(NULL)
}

# GET con reintento simple (max 2 reintentos) para la paginacion de datos:
# reintenta errores de transporte (socket/timeout) y HTTP 429/5xx; los 4xx
# de auth/no-encontrado no se reintentan. Los POST/PATCH (import/deploy) no
# pasan por aca: no son idempotentes.
.kobo_api_fetch_with_retry <- function(url, build_handle, max_retries = 2L) {
  attempt <- 0L
  repeat {
    res <- tryCatch(.kobo_api_http_fetch(url, build_handle()), error = function(e) e)
    transient <- inherits(res, "error") ||
      as.integer(res$status_code) %in% c(429L, 500L, 502L, 503L, 504L)
    if (!isTRUE(transient)) return(res)
    if (attempt >= max_retries) {
      if (inherits(res, "error")) stop(res)
      return(res)
    }
    attempt <- attempt + 1L
    .kobo_api_retry_sleep(attempt)
  }
}

.kobo_api_fetch_json <- function(url, token) {
  if (!nzchar(token)) stop("Falta el token de KoboToolbox.", call. = FALSE)
  if (!requireNamespace("curl", quietly = TRUE)) {
    stop("El paquete R 'curl' no esta instalado.", call. = FALSE)
  }
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    stop("El paquete R 'jsonlite' no esta instalado.", call. = FALSE)
  }

  res <- .kobo_api_fetch_with_retry(url, function() .kobo_api_auth_handle(token))
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

.kobo_api_request_json <- function(url,
                                   token,
                                   method = "GET",
                                   form = NULL,
                                   json_body = NULL,
                                   fail = TRUE) {
  if (!nzchar(token)) stop("Falta el token de KoboToolbox.", call. = FALSE)
  if (!requireNamespace("curl", quietly = TRUE)) {
    stop("El paquete R 'curl' no esta instalado.", call. = FALSE)
  }
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    stop("El paquete R 'jsonlite' no esta instalado.", call. = FALSE)
  }

  h <- .kobo_api_auth_handle(token)
  method <- toupper(as.character(method %||% "GET")[1])
  if (!identical(method, "GET")) curl::handle_setopt(h, customrequest = method)
  if (!is.null(form)) {
    curl::handle_setform(h, .list = form)
  } else if (!is.null(json_body)) {
    body <- jsonlite::toJSON(json_body, auto_unbox = TRUE, null = "null")
    curl::handle_setheaders(h,
      "Authorization" = paste("Token", token),
      "Accept" = "application/json",
      "Content-Type" = "application/json"
    )
    curl::handle_setopt(h, postfields = body)
  }
  res <- curl::curl_fetch_memory(url, handle = h)
  body <- rawToChar(res$content)
  Encoding(body) <- "UTF-8"
  parsed <- if (nzchar(body)) {
    tryCatch(jsonlite::fromJSON(body, simplifyVector = FALSE), error = function(e) NULL)
  } else {
    NULL
  }
  ok <- res$status_code < 400L
  if (!ok && isTRUE(fail)) {
    if (res$status_code == 401L || res$status_code == 403L) {
      stop("Token rechazado por KoboToolbox. Verifica permisos y servidor.", call. = FALSE)
    }
    if (res$status_code == 404L) {
      stop("Proyecto o endpoint Kobo no encontrado.", call. = FALSE)
    }
    stop(sprintf("KoboToolbox devolvio HTTP %d: %s", res$status_code, body), call. = FALSE)
  }
  list(ok = ok, status_code = as.integer(res$status_code), body = body, parsed = parsed, url = url)
}

.kobo_api_absolute_url <- function(url, base_url = kobo_api_default_base_url()) {
  value <- as.character(url %||% "")[1]
  if (!nzchar(value)) return("")
  if (grepl("^https?://", value, ignore.case = TRUE)) return(value)
  paste0(.kobo_api_trim_base_url(base_url), "/", sub("^/+", "", value))
}

.kobo_api_query_json <- function(query = NULL) {
  if (is.null(query)) return("")
  if (is.character(query)) {
    value <- trimws(as.character(query)[1])
    return(ifelse(is.na(value), "", value))
  }
  if (!is.list(query)) return("")
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    stop("El paquete R 'jsonlite' no esta instalado.", call. = FALSE)
  }
  as.character(jsonlite::toJSON(query, auto_unbox = TRUE, null = "null"))
}

kobo_api_asset_data_url <- function(asset_uid,
                                    base_url = kobo_api_default_base_url(),
                                    page = 1L,
                                    page_size = 1000L,
                                    query = NULL) {
  uid <- trimws(as.character(asset_uid %||% "")[1])
  if (!nzchar(uid)) stop("Falta el asset UID de Kobo.", call. = FALSE)
  page <- suppressWarnings(as.integer(page %||% 1L))
  page_size <- suppressWarnings(as.integer(page_size %||% 1000L))
  if (!is.finite(page) || page < 1L) page <- 1L
  if (!is.finite(page_size) || page_size < 1L) page_size <- 1000L
  page_size <- min(page_size, 1000L)
  query_json <- .kobo_api_query_json(query)
  query_part <- if (nzchar(query_json)) {
    paste0("&query=", utils::URLencode(query_json, reserved = TRUE))
  } else {
    ""
  }
  sprintf(
    "%s/api/v2/assets/%s/data/?format=json&page=%d&page_size=%d%s",
    .kobo_api_trim_base_url(base_url),
    utils::URLencode(uid, reserved = TRUE),
    page,
    page_size,
    query_part
  )
}

kobo_api_import_xlsform <- function(path,
                                    token,
                                    base_url = kobo_api_default_base_url(),
                                    destination = "",
                                    library = FALSE) {
  if (!file.exists(path)) stop("No existe el XLSForm a subir a Kobo.", call. = FALSE)
  endpoints <- c("/api/v2/imports/", "/imports/")
  errors <- character(0)
  for (endpoint in endpoints) {
    form <- list(
      file = curl::form_file(path),
      library = if (isTRUE(library)) "true" else "false"
    )
    destination <- trimws(as.character(destination %||% "")[1])
    if (nzchar(destination)) form$destination <- destination
    url <- paste0(.kobo_api_trim_base_url(base_url), endpoint)
    res <- .kobo_api_request_json(url, token, method = "POST", form = form, fail = FALSE)
    if (isTRUE(res$ok)) {
      parsed <- res$parsed %||% list()
      parsed$endpoint_url <- url
      return(parsed)
    }
    errors <- c(errors, sprintf("%s HTTP %s: %s", endpoint, res$status_code, res$body))
    if (!res$status_code %in% c(404L, 405L)) break
  }
  stop(paste("Kobo no acepto la importacion XLSForm.", paste(errors, collapse = " | ")), call. = FALSE)
}

kobo_api_poll_import <- function(import_payload,
                                 token,
                                 base_url = kobo_api_default_base_url(),
                                 max_tries = 20L,
                                 delay_sec = 1) {
  payload <- import_payload %||% list()
  status_url <- .kobo_api_absolute_url(
    payload$url %||% payload$detail_url %||% payload$status_url %||% payload$uid %||% payload$id,
    base_url
  )
  if (!nzchar(status_url)) return(payload)
  max_tries <- max(1L, suppressWarnings(as.integer(max_tries %||% 20L)))
  for (i in seq_len(max_tries)) {
    res <- .kobo_api_request_json(status_url, token, method = "GET", fail = FALSE)
    if (isTRUE(res$ok) && is.list(res$parsed)) {
      payload <- res$parsed
      payload$status_url <- status_url
      status <- tolower(as.character(payload$status %||% payload$state %||% "")[1])
      asset_uid <- kobo_api_import_asset_uid(payload)
      if (nzchar(asset_uid) || status %in% c("complete", "completed", "success", "successful", "done", "error", "failed", "failure")) {
        return(payload)
      }
    }
    if (i < max_tries) Sys.sleep(delay_sec)
  }
  payload
}

kobo_api_import_asset_uid <- function(payload) {
  if (is.null(payload) || !is.list(payload)) return("")
  first_uid <- function(x) {
    if (!is.list(x) || !length(x) || !is.list(x[[1]])) return(NULL)
    x[[1]]$uid %||% x[[1]]$asset_uid %||% NULL
  }
  candidates <- c(
    payload$asset_uid,
    payload$assetUid,
    payload$asset$uid,
    first_uid(payload$messages$created %||% list()),
    first_uid(payload$messages$updated %||% list()),
    payload$uid
  )
  out <- trimws(as.character(unlist(candidates, use.names = FALSE)))
  out <- out[!is.na(out) & nzchar(out)]
  if (length(out)) out[[1]] else ""
}

kobo_api_deploy_asset <- function(asset_uid,
                                  token,
                                  base_url = kobo_api_default_base_url(),
                                  version_id = "") {
  uid <- trimws(as.character(asset_uid %||% "")[1])
  if (!nzchar(uid)) stop("Falta asset UID para desplegar en Kobo.", call. = FALSE)
  url <- sprintf(
    "%s/api/v2/assets/%s/deployment/",
    .kobo_api_trim_base_url(base_url),
    utils::URLencode(uid, reserved = TRUE)
  )
  form <- list(active = "true")
  version_id <- trimws(as.character(version_id %||% "")[1])
  if (nzchar(version_id)) form$version_id <- version_id
  res <- .kobo_api_request_json(url, token, method = "POST", form = form, fail = FALSE)
  if (!isTRUE(res$ok) && res$status_code == 405L) {
    res <- .kobo_api_request_json(url, token, method = "PATCH", form = form, fail = TRUE)
  } else if (!isTRUE(res$ok)) {
    .kobo_api_request_json(url, token, method = "POST", form = form, fail = TRUE)
  }
  res$parsed %||% list(ok = TRUE)
}

#' URL administrativa del proyecto en Kobo.
#'
#' Es la pantalla de gestión del asset, no un formulario de captura: sirve para
#' "abrir el proyecto en Kobo" y nunca debe viajar como `survey_url` ni recibir
#' parámetros `d[]`. Ver [capture_url_issue()].
kobo_api_asset_url <- function(asset_uid,
                               base_url = kobo_api_default_base_url()) {
  uid <- trimws(as.character(asset_uid %||% "")[1])
  if (!nzchar(uid)) return("")
  sprintf(
    "%s/#/forms/%s/landing",
    .kobo_api_trim_base_url(base_url),
    utils::URLencode(uid, reserved = TRUE)
  )
}

kobo_api_survey_url <- function(asset_uid,
                                base_url = kobo_api_default_base_url(),
                                detail = list(),
                                deployment = list()) {
  collect_urls <- function(x, path = "") {
    if (is.null(x)) return(list())
    if (is.character(x) && length(x)) {
      values <- trimws(as.character(x))
      values <- values[!is.na(values) & nzchar(values)]
      values <- values[grepl("^(https?://|/)", values, ignore.case = TRUE)]
      return(lapply(values, function(value) list(path = path, url = value)))
    }
    if (!is.list(x) || !length(x)) return(list())
    out <- list()
    nms <- names(x)
    if (is.null(nms)) nms <- rep("", length(x))
    for (i in seq_along(x)) {
      key <- nms[[i]]
      child_path <- if (nzchar(path) && nzchar(key)) paste(path, key, sep = ".") else key
      out <- c(out, collect_urls(x[[i]], child_path))
    }
    out
  }
  candidates <- c(collect_urls(deployment, "deployment"), collect_urls(detail, "detail"))
  if (!length(candidates)) return("")
  df <- do.call(rbind, lapply(candidates, function(item) {
    data.frame(path = item$path, url = .kobo_api_absolute_url(item$url, base_url), stringsAsFactors = FALSE)
  }))
  df <- df[nzchar(df$url), , drop = FALSE]
  df <- df[!duplicated(df$url), , drop = FALSE]
  # Una candidata con fragmento no puede recibir `d[]`: se descarta antes de
  # puntuar para que nunca gane por ausencia de rivales.
  df <- df[vapply(df$url, capture_url_ok, logical(1), USE.NAMES = FALSE), , drop = FALSE]
  if (!nrow(df)) return("")

  path <- tolower(df$path)
  url <- tolower(df$url)
  score <- rep(0L, nrow(df))
  score <- score + ifelse(grepl("single|enketo|iframe|form_url|survey", path), 80L, 0L)
  score <- score + ifelse(grepl("enketo|ee\\.|/x/|/single", url), 60L, 0L)
  score <- score - ifelse(grepl("preview|api/v2|submission|data", path) | grepl("preview|api/v2|submission|data", url), 50L, 0L)
  df <- df[order(score, decreasing = TRUE), , drop = FALSE]
  if (nrow(df) && score[order(score, decreasing = TRUE)][[1]] > 0L) return(df$url[[1]])
  # Sin candidata reconocible se devuelve vacío: la landing administrativa no es
  # un sustituto, y decir "no resuelto" es lo único honesto que se puede decir.
  ""
}

kobo_api_fetch_assets <- function(token,
                                  base_url = kobo_api_default_base_url(),
                                  limit = 100L) {
  limit <- suppressWarnings(as.integer(limit %||% 100L))
  if (!is.finite(limit) || limit < 1L) limit <- 100L
  limit <- min(limit, 500L)
  url <- sprintf(
    "%s/api/v2/assets/?format=json&limit=%d",
    .kobo_api_trim_base_url(base_url),
    limit
  )
  payload <- .kobo_api_fetch_json(url, token)
  rows <- payload$results %||% list()
  assets <- list()
  for (i in seq_along(rows)) {
    item <- rows[[i]]
    if (!is.list(item)) next
    uid <- as.character(item$uid %||% item$asset_uid %||% item$id %||% "")[1]
    name <- as.character(item$name %||% item$label %||% item$title %||% uid)[1]
    if (!nzchar(uid)) next
    assets[[length(assets) + 1L]] <- list(
      uid = uid,
      name = if (nzchar(name)) name else uid,
      version_id = as.character(
        item$version_id %||%
          item$deployed_version_id %||%
          item$deployment__version_id %||%
          item$latest_deployed_version_id %||%
          ""
      )[1],
      date_modified = as.character(item$date_modified %||% item$dateModified %||% "")[1],
      deployment_active = isTRUE(item$deployment__active %||% item$deployment_active %||% FALSE)
    )
  }
  list(
    ok = TRUE,
    count = as.integer(payload$count %||% length(assets)),
    assets = assets
  )
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
                                      page_size = 1000L,
                                      query = NULL) {
  url <- kobo_api_asset_data_url(asset_uid, base_url, page, page_size, query)
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
                                          query = NULL,
                                          min_id = NULL,
                                          progress = NULL) {
  page <- 1L
  out <- list()
  total <- NA_integer_
  next_url <- NULL
  min_id <- suppressWarnings(as.numeric(min_id %||% NA_real_))
  if (is.finite(min_id)) {
    query <- list(`_id` = list(`$gt` = min_id))
  }
  if (!is.null(progress)) {
    msg <- if (is.finite(min_id)) {
      "Kobo: consultando respuestas nuevas"
    } else {
      "Kobo: consultando respuestas"
    }
    progress(0L, NA_integer_, msg)
  }

  repeat {
    payload <- if (is.null(next_url)) {
      kobo_api_fetch_asset_data(asset_uid, token, base_url, page = page, page_size = page_size, query = query)
    } else {
      .kobo_api_fetch_json(next_url, token)
    }
    rows <- payload$results %||% list()
    if (length(rows)) out <- c(out, rows)
    total <- suppressWarnings(as.integer(payload$count %||% total))
    if (!is.null(progress)) {
      progress(length(out), if (is.finite(total)) total else NA_integer_,
               sprintf("Kobo: pagina %d, %d registros recibidos", page, length(out)))
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
