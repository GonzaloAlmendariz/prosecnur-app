# =============================================================================
# Cliente HTTP de la API v3 de SurveyMonkey
#
# La API es la fuente de verdad para construir el XLSForm SurveyMonkey:
#   - Mapeo de páginas → preguntas.
#   - family/subtype exactos por pregunta.
#   - validation y required (llenan columnas del XLSForm).
# El .sav queda fuera de este traductor; solo se usa después como data de
# respuestas que debe adaptarse al contrato normalizado del XLSForm.
#
# La API NO expone display_logic / skip_logic en la documentación pública v3,
# así que la lógica condicional sigue requiriendo input manual del usuario.
#
# Requiere:
#   - Cuenta SurveyMonkey con plan que habilite API access (mayoría de pagos).
#   - Token de acceso (Personal Access Token) generado en
#     https://developer.surveymonkey.com/apps/
# =============================================================================

.sm_api_timeout_seconds <- function(value = Sys.getenv("PROSECNUR_SURVEYMONKEY_TIMEOUT_SECONDS", unset = ""),
                                    default = 20,
                                    min_seconds = 3,
                                    max_seconds = 120) {
  seconds <- suppressWarnings(as.numeric(value %||% default))
  if (!is.finite(seconds) || seconds <= 0) seconds <- default
  min(max_seconds, max(min_seconds, seconds))
}

.sm_api_connect_timeout_seconds <- function(timeout_seconds = .sm_api_timeout_seconds(),
                                            value = Sys.getenv("PROSECNUR_SURVEYMONKEY_CONNECT_TIMEOUT_SECONDS", unset = "")) {
  timeout_seconds <- .sm_api_timeout_seconds(timeout_seconds)
  seconds <- suppressWarnings(as.numeric(value %||% min(8, timeout_seconds)))
  if (!is.finite(seconds) || seconds <= 0) seconds <- min(8, timeout_seconds)
  min(timeout_seconds, max(1, seconds))
}

.sm_api_new_handle <- function() {
  h <- curl::new_handle()
  timeout <- .sm_api_timeout_seconds()
  curl::handle_setopt(
    h,
    timeout = timeout,
    connecttimeout = .sm_api_connect_timeout_seconds(timeout)
  )
  h
}

# Handle autenticado estándar del conector SM (headers Bearer + Accept JSON).
.sm_api_auth_handle <- function(token) {
  h <- .sm_api_new_handle()
  curl::handle_setheaders(h,
    "Authorization" = paste("Bearer", token),
    "Accept" = "application/json"
  )
  h
}

# Seam de transporte: única llamada real a curl del conector SM. Los tests
# la mockean (testthat::local_mocked_bindings) para simular la API sin red.
.sm_api_http_fetch <- function(url, handle) {
  curl::curl_fetch_memory(url, handle = handle)
}

.sm_api_max_retries <- function() 3L

# Seam de espera: mockeable en tests para registrar los backoffs sin dormir.
.sm_api_retry_sleep <- function(seconds) {
  seconds <- suppressWarnings(as.numeric(seconds)[1])
  if (is.finite(seconds) && seconds > 0) Sys.sleep(min(seconds, 60))
  invisible(NULL)
}

# Espera ante un 429: respeta Retry-After si viene; si no, backoff
# exponencial acotado (1s, 2s, 4s).
.sm_api_retry_after_seconds <- function(res, attempt) {
  headers <- tryCatch(curl::parse_headers_list(res$headers), error = function(e) list())
  retry_after <- suppressWarnings(as.numeric(headers[["retry-after"]] %||% NA_real_)[1])
  if (is.finite(retry_after) && retry_after >= 0) return(min(retry_after, 60))
  min(2^(max(1L, attempt) - 1L), 30)
}

# Transporte compartido por TODAS las llamadas SM: reintenta HTTP 429 con
# backoff (máx 3 reintentos) y luego falla con stop_api E_SM_RATE_LIMIT.
# `build_handle` es una closure que construye un handle fresco por intento
# (los handles curl no se reusan tras un fetch fallido).
.sm_api_fetch_with_retry <- function(url, build_handle) {
  attempt <- 1L
  repeat {
    res <- .sm_api_http_fetch(url, build_handle())
    if (!identical(as.integer(res$status_code), 429L)) return(res)
    if (attempt > .sm_api_max_retries()) {
      stop_api(
        429,
        "E_SM_RATE_LIMIT",
        paste(
          "SurveyMonkey limito la tasa de peticiones (HTTP 429) y se agotaron los reintentos.",
          "Espera unos minutos y vuelve a sincronizar."
        ),
        details = list(retries = .sm_api_max_retries())
      )
    }
    .sm_api_retry_sleep(.sm_api_retry_after_seconds(res, attempt))
    attempt <- attempt + 1L
  }
}

#' Trae la estructura completa de un survey desde la API v3 de SurveyMonkey.
#'
#' @param survey_id ID numérico del survey (visible en la URL del constructor).
#' @param token Personal Access Token de la API SurveyMonkey.
#' @param base_url Override opcional de la URL base (útil para tests con mocks).
#' @return Lista deserializada del JSON, con `pages[]`, `questions[]`, etc.
#' @export
sm_api_fetch_survey_details <- function(survey_id, token, base_url = "https://api.surveymonkey.com/v3") {
  if (!nzchar(survey_id)) stop("Falta 'survey_id'.", call. = FALSE)
  if (!nzchar(token)) stop("Falta el token de la API.", call. = FALSE)
  if (!requireNamespace("curl", quietly = TRUE)) {
    stop("El paquete R 'curl' no está instalado.", call. = FALSE)
  }
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    stop("El paquete R 'jsonlite' no está instalado.", call. = FALSE)
  }

  url <- sprintf("%s/surveys/%s/details", sub("/$", "", base_url), survey_id)
  res <- .sm_api_fetch_with_retry(url, function() .sm_api_auth_handle(token))
  body <- rawToChar(res$content)
  Encoding(body) <- "UTF-8"

  if (res$status_code == 401L) {
    stop("Token rechazado por SurveyMonkey (HTTP 401). Verifica que sea un Personal Access Token válido y con scope 'surveys.read'.", call. = FALSE)
  }
  if (res$status_code == 404L) {
    stop(sprintf("Survey '%s' no encontrado (HTTP 404). Verifica el ID en la URL del constructor.", survey_id), call. = FALSE)
  }
  if (res$status_code >= 400L) {
    stop(sprintf("API SurveyMonkey devolvió HTTP %d: %s", res$status_code, body), call. = FALSE)
  }

  parsed <- tryCatch(
    jsonlite::fromJSON(body, simplifyVector = FALSE),
    error = function(e) stop("No pude parsear la respuesta JSON: ", conditionMessage(e), call. = FALSE)
  )
  parsed
}

#' Verifica que el token funciona y tiene el scope mínimo necesario.
#'
#' Llama `GET /surveys?per_page=1` — usa el scope `surveys_read` que es el
#' que efectivamente necesitamos para auto-completar páginas. Esto evita
#' pedirle al usuario el scope `users_read` (View your user information)
#' que no es estrictamente necesario para nuestro flujo.
#'
#' Mapeo de respuestas:
#'   - HTTP 200 → token válido, scope OK.
#'   - HTTP 401 → token inválido o revocado.
#'   - HTTP 403 → token válido pero falta scope `surveys_read` (informativo).
#'   - Otros   → error genérico con detalle.
#'
#' @param token Personal Access Token de la API SurveyMonkey.
#' @param base_url Override opcional.
#' @return Lista con `ok` y, opcionalmente, `n_surveys_visible` cuando OK.
#' @export
sm_api_check_token <- function(token, base_url = "https://api.surveymonkey.com/v3") {
  if (!nzchar(token)) stop("Falta el token de la API.", call. = FALSE)
  if (!requireNamespace("curl", quietly = TRUE)) stop("Paquete 'curl' no instalado.", call. = FALSE)
  if (!requireNamespace("jsonlite", quietly = TRUE)) stop("Paquete 'jsonlite' no instalado.", call. = FALSE)

  url <- sprintf("%s/surveys?per_page=1", sub("/$", "", base_url))
  res <- .sm_api_fetch_with_retry(url, function() .sm_api_auth_handle(token))
  body <- rawToChar(res$content)
  Encoding(body) <- "UTF-8"

  if (res$status_code == 401L) {
    return(list(ok = FALSE, status_code = 401L,
      error = "Token inválido o revocado. Genera uno nuevo en developer.surveymonkey.com/apps."))
  }
  if (res$status_code == 403L) {
    return(list(ok = FALSE, status_code = 403L,
      error = "El token no tiene el scope 'View Surveys' (surveys_read). En tu app SurveyMonkey: Scopes → activa 'View Surveys' → guarda y regenera el Access Token."))
  }
  if (res$status_code >= 400L) {
    return(list(ok = FALSE, status_code = as.integer(res$status_code),
      error = sprintf("HTTP %d: %s", res$status_code, body)))
  }

  parsed <- tryCatch(
    jsonlite::fromJSON(body, simplifyVector = FALSE),
    error = function(e) list()
  )
  total <- .sm_or(parsed$total, NA_integer_)
  list(
    ok = TRUE,
    status_code = 200L,
    n_surveys_visible = if (is.na(total)) NA_integer_ else as.integer(total)
  )
}

#' Lista todos los surveys del usuario autenticado por el token.
#'
#' Útil cuando el usuario solo tiene la URL `/analyze/{token-encriptado}` y
#' no puede extraer el Survey ID numérico real desde el navegador.
#'
#' @param token Personal Access Token de la API SurveyMonkey.
#' @param base_url Override opcional de la URL base.
#' @param per_page Cuántos resultados por página (default 50, max 1000).
#' @return Lista de surveys con `id`, `title`, `nickname`, `href`,
#'   `date_modified`.
#' @export
sm_api_list_surveys <- function(token, base_url = "https://api.surveymonkey.com/v3", per_page = 20L) {
  if (!nzchar(token)) stop("Falta el token de la API.", call. = FALSE)
  if (!requireNamespace("curl", quietly = TRUE)) stop("Paquete 'curl' no instalado.", call. = FALSE)
  if (!requireNamespace("jsonlite", quietly = TRUE)) stop("Paquete 'jsonlite' no instalado.", call. = FALSE)

  # `sort_by=date_modified` + `sort_order=DESC` deja los más recientes al
  # tope. El default 20 cubre el uso típico (escoger un survey activo); si
  # alguien necesita más, llama con per_page distinto.
  url <- sprintf(
    "%s/surveys?per_page=%d&sort_by=date_modified&sort_order=DESC&include=date_modified,nickname,response_count",
    sub("/$", "", base_url), as.integer(per_page)
  )
  res <- .sm_api_fetch_with_retry(url, function() .sm_api_auth_handle(token))
  body <- rawToChar(res$content)
  Encoding(body) <- "UTF-8"

  if (res$status_code == 401L) {
    stop("Token rechazado por SurveyMonkey (HTTP 401). Verifica que tu Personal Access Token tenga scope 'surveys.read'.", call. = FALSE)
  }
  if (res$status_code >= 400L) {
    stop(sprintf("API SurveyMonkey devolvió HTTP %d: %s", res$status_code, body), call. = FALSE)
  }

  parsed <- tryCatch(
    jsonlite::fromJSON(body, simplifyVector = FALSE),
    error = function(e) stop("No pude parsear la respuesta JSON: ", conditionMessage(e), call. = FALSE)
  )
  data <- .sm_or(parsed$data, list())
  lapply(data, function(s) list(
    id = .sm_or(s$id, NA_character_),
    title = .sm_or(s$title, NA_character_),
    nickname = .sm_or(s$nickname, NA_character_),
    href = .sm_or(s$href, NA_character_),
    date_modified = .sm_or(s$date_modified, NA_character_),
    response_count = .sm_or(s$response_count, NA_integer_)
  ))
}

.sm_api_build_url <- function(path, base_url = "https://api.surveymonkey.com/v3", query = list()) {
  url <- if (grepl("^https?://", path)) {
    path
  } else {
    sprintf("%s/%s", sub("/$", "", base_url), sub("^/", "", path))
  }
  query <- query[!vapply(query, is.null, logical(1))]
  if (length(query)) {
    qs <- paste(
      utils::URLencode(names(query), reserved = TRUE),
      utils::URLencode(vapply(query, function(x) as.character(x)[1], character(1)), reserved = TRUE),
      sep = "=",
      collapse = "&"
    )
    url <- paste0(url, if (grepl("\\?", url)) "&" else "?", qs)
  }
  url
}

.sm_api_fetch_json <- function(path,
                               token,
                               base_url = "https://api.surveymonkey.com/v3",
                               query = list(),
                               allow_status = integer()) {
  token <- as.character(token %||% "")[1]
  if (!nzchar(token)) stop("Falta el token de la API.", call. = FALSE)
  if (!requireNamespace("curl", quietly = TRUE)) stop("Paquete 'curl' no instalado.", call. = FALSE)
  if (!requireNamespace("jsonlite", quietly = TRUE)) stop("Paquete 'jsonlite' no instalado.", call. = FALSE)

  res <- .sm_api_fetch_with_retry(
    .sm_api_build_url(path, base_url = base_url, query = query),
    function() .sm_api_auth_handle(token)
  )
  body <- rawToChar(res$content)
  Encoding(body) <- "UTF-8"

  if (res$status_code >= 400L && !res$status_code %in% allow_status) {
    if (res$status_code == 401L) {
      stop("Token rechazado por SurveyMonkey (HTTP 401).", call. = FALSE)
    }
    stop(sprintf("API SurveyMonkey devolvio HTTP %d: %s", res$status_code, body), call. = FALSE)
  }

  parsed <- if (nzchar(body)) {
    tryCatch(jsonlite::fromJSON(body, simplifyVector = FALSE), error = function(e) list())
  } else {
    list()
  }
  list(ok = res$status_code < 400L, status_code = as.integer(res$status_code), data = parsed, body = body)
}

.sm_api_count_values <- function(values) {
  values <- as.character(unlist(values, use.names = FALSE))
  values <- trimws(values[!is.na(values) & nzchar(trimws(values))])
  if (!length(values)) return(list())
  tab <- sort(table(values), decreasing = TRUE)
  out <- as.list(as.integer(tab))
  names(out) <- names(tab)
  out
}

#' Lista colectores de una encuesta de SurveyMonkey.
#'
#' Solo devuelve metadatos de colectores. No expone links de encuestados.
#' @export
sm_api_fetch_collectors <- function(survey_id,
                                    token,
                                    base_url = "https://api.surveymonkey.com/v3",
                                    per_page = 100L,
                                    max_pages = 50L) {
  survey_id <- trimws(as.character(survey_id %||% "")[1])
  if (!nzchar(survey_id)) stop("Falta 'survey_id'.", call. = FALSE)
  per_page <- suppressWarnings(as.integer(per_page %||% 100L))
  if (!is.finite(per_page)) per_page <- 100L
  per_page <- min(100L, max(1L, per_page))
  max_pages <- suppressWarnings(as.integer(max_pages %||% 50L))
  if (!is.finite(max_pages)) max_pages <- 50L
  max_pages <- max(1L, max_pages)
  page <- 1L
  out <- list()
  total <- NA_integer_
  repeat {
    res <- .sm_api_fetch_json(
      sprintf("/surveys/%s/collectors", utils::URLencode(survey_id, reserved = TRUE)),
      token = token,
      base_url = base_url,
      query = list(page = page, per_page = per_page)
    )
    payload <- res$data %||% list()
    rows <- payload$data %||% list()
    if (length(rows)) out <- c(out, rows)
    total <- suppressWarnings(as.integer(payload$total %||% total))
    if (length(rows) < per_page || page >= max_pages) break
    page <- page + 1L
  }
  list(ok = TRUE, total = if (is.finite(total)) total else length(out), data = out)
}

#' Trae detalle agregado de un colector SurveyMonkey.
#' @export
sm_api_fetch_collector_detail <- function(collector_id,
                                          token,
                                          base_url = "https://api.surveymonkey.com/v3") {
  collector_id <- trimws(as.character(collector_id %||% "")[1])
  if (!nzchar(collector_id)) stop("Falta 'collector_id'.", call. = FALSE)
  res <- .sm_api_fetch_json(
    sprintf("/collectors/%s", utils::URLencode(collector_id, reserved = TRUE)),
    token = token,
    base_url = base_url
  )
  res$data %||% list()
}

#' Lista destinatarios de un colector cuando la API lo permite.
#' @export
sm_api_fetch_collector_recipients <- function(collector_id,
                                              token,
                                              base_url = "https://api.surveymonkey.com/v3",
                                              per_page = 100L,
                                              max_pages = 50L) {
  collector_id <- trimws(as.character(collector_id %||% "")[1])
  if (!nzchar(collector_id)) stop("Falta 'collector_id'.", call. = FALSE)
  per_page <- suppressWarnings(as.integer(per_page %||% 100L))
  if (!is.finite(per_page)) per_page <- 100L
  per_page <- min(100L, max(1L, per_page))
  max_pages <- suppressWarnings(as.integer(max_pages %||% 50L))
  if (!is.finite(max_pages)) max_pages <- 50L
  max_pages <- max(1L, max_pages)
  page <- 1L
  out <- list()
  total <- NA_integer_
  repeat {
    res <- .sm_api_fetch_json(
      sprintf("/collectors/%s/recipients", utils::URLencode(collector_id, reserved = TRUE)),
      token = token,
      base_url = base_url,
      query = list(page = page, per_page = per_page),
      allow_status = c(404L)
    )
    if (!isTRUE(res$ok)) {
      return(list(ok = FALSE, available = FALSE, status_code = res$status_code, total = 0L, data = list()))
    }
    payload <- res$data %||% list()
    rows <- payload$data %||% list()
    if (length(rows)) out <- c(out, rows)
    total <- suppressWarnings(as.integer(payload$total %||% total))
    if (length(rows) < per_page || page >= max_pages) break
    page <- page + 1L
  }
  list(ok = TRUE, available = TRUE, total = if (is.finite(total)) total else length(out), data = out)
}

sm_api_fetch_collector_recipient_detail <- function(collector_id,
                                                    recipient_id,
                                                    token,
                                                    base_url = "https://api.surveymonkey.com/v3") {
  collector_id <- trimws(as.character(collector_id %||% "")[1])
  recipient_id <- trimws(as.character(recipient_id %||% "")[1])
  if (!nzchar(collector_id) || !nzchar(recipient_id)) return(NULL)
  res <- .sm_api_fetch_json(
    sprintf(
      "/collectors/%s/recipients/%s",
      utils::URLencode(collector_id, reserved = TRUE),
      utils::URLencode(recipient_id, reserved = TRUE)
    ),
    token = token,
    base_url = base_url,
    allow_status = c(404L)
  )
  if (!isTRUE(res$ok)) return(NULL)
  res$data %||% list()
}

.sm_api_recipient_scalar <- function(x, ...) {
  fields <- c(...)
  for (field in fields) {
    value <- x[[field]]
    if (is.null(value) || length(value) == 0L) next
    if (is.list(value)) next
    value <- trimws(as.character(value[[1]] %||% ""))
    if (!is.na(value) && nzchar(value)) return(value)
  }
  ""
}

.sm_api_recipient_custom_pairs <- function(x) {
  out <- list()
  append_pair <- function(name, value) {
    name <- trimws(as.character(name %||% "")[1])
    if (!nzchar(name)) return(invisible(NULL))
    value <- trimws(as.character(value %||% "")[1])
    if (is.na(value) || !nzchar(value)) return(invisible(NULL))
    out[[.sm_api_safe_name(name)]] <<- value
    invisible(NULL)
  }
  custom_variables <- x$custom_variables %||% x$customVariables %||% list()
  if (is.list(custom_variables) && length(custom_variables)) {
    for (nm in names(custom_variables)) append_pair(nm, custom_variables[[nm]])
  }
  custom_fields <- x$custom_fields %||% x$customFields %||% list()
  if (is.list(custom_fields) && length(custom_fields)) {
    for (item in custom_fields) {
      if (!is.list(item)) next
      append_pair(
        item$name %||% item$key %||% item$field_name %||% item$fieldName,
        item$value %||% item$field_value %||% item$fieldValue
      )
    }
  }
  out
}

.sm_api_recipient_row <- function(x) {
  if (is.null(x) || !is.list(x)) return(list())
  out <- list(
    recipient_id = .sm_api_recipient_scalar(x, "id", "recipient_id"),
    recipient_email = .sm_api_recipient_scalar(x, "email", "email_address", "emailAddress"),
    recipient_first_name = .sm_api_recipient_scalar(x, "first_name", "firstName"),
    recipient_last_name = .sm_api_recipient_scalar(x, "last_name", "lastName"),
    recipient_custom_value = .sm_api_recipient_scalar(x, "custom_value", "customValue", "custom_id", "customId"),
    recipient_status = .sm_api_recipient_scalar(x, "status", "mail_status"),
    recipient_response_status = .sm_api_recipient_scalar(x, "survey_response_status", "response_status")
  )
  custom_pairs <- .sm_api_recipient_custom_pairs(x)
  for (nm in names(custom_pairs)) {
    out[[paste0("recipient_cv_", nm)]] <- custom_pairs[[nm]]
  }
  out
}

sm_api_fetch_collector_recipient_rows <- function(collector_id,
                                                  token,
                                                  base_url = "https://api.surveymonkey.com/v3",
                                                  recipient_ids = NULL,
                                                  include_details = TRUE,
                                                  max_details = 1000L) {
  recipients <- sm_api_fetch_collector_recipients(collector_id, token, base_url = base_url)
  if (!isTRUE(recipients$available)) return(data.frame())
  rows <- recipients$data %||% list()
  wanted <- unique(trimws(as.character(recipient_ids %||% character(0))))
  wanted <- wanted[nzchar(wanted)]
  if (length(wanted)) {
    rows <- Filter(function(row) {
      rid <- trimws(as.character(row$id %||% row$recipient_id %||% ""))
      nzchar(rid) && rid %in% wanted
    }, rows)
  }
  max_details <- suppressWarnings(as.integer(max_details %||% 1000L))
  if (!is.finite(max_details)) max_details <- 1000L
  max_details <- max(0L, max_details)
  out <- list()
  detail_failures <- 0L
  for (i in seq_along(rows)) {
    row <- rows[[i]]
    rid <- trimws(as.character(row$id %||% row$recipient_id %||% ""))
    src <- row
    if (isTRUE(include_details) && nzchar(rid) && i <= max_details) {
      detail <- tryCatch(
        sm_api_fetch_collector_recipient_detail(collector_id, rid, token, base_url = base_url),
        error = function(e) {
          detail_failures <<- detail_failures + 1L
          NULL
        }
      )
      if (is.list(detail) && length(detail)) src <- utils::modifyList(row, detail)
    }
    out[[length(out) + 1L]] <- .sm_api_recipient_row(src)
  }
  if (detail_failures > 0L) {
    warning(
      sprintf(
        "SurveyMonkey: %d detalle(s) de destinatario del colector %s no se pudieron obtener; esas filas usan solo los datos del listado.",
        detail_failures, collector_id
      ),
      call. = FALSE
    )
  }
  if (!length(out)) return(data.frame())
  cols <- unique(unlist(lapply(out, names), use.names = FALSE))
  df <- do.call(rbind, lapply(out, function(row) {
    values <- lapply(cols, function(nm) {
      value <- row[[nm]]
      if (is.null(value) || !length(value)) return(NA_character_)
      as.character(value[[1]])[1]
    })
    names(values) <- cols
    as.data.frame(values, stringsAsFactors = FALSE, optional = TRUE)
  }))
  rownames(df) <- NULL
  df
}

# Cache de PROCESO de filas de destinatarios por colector (unidad 3.8,
# semantica congelada por el lead: cache derivable). NO vive en la sesion ni
# viaja en el .pulso: project_pulso.R (strip list) esta fuera del alcance de
# esta unidad, asi que el cache se guarda en un env del paquete — perderlo al
# reiniciar el proceso solo implica re-pedir detalles (benigno). No contiene
# tokens ni credenciales; solo las filas ya normalizadas del listado/detalle.
.sm_api_recipients_cache <- new.env(parent = emptyenv())

.sm_api_recipients_cache_key <- function(collector_id, base_url, include_details) {
  paste(
    trimws(as.character(base_url %||% "")[1]),
    trimws(as.character(collector_id %||% "")[1]),
    if (isTRUE(include_details)) "detail" else "listing",
    sep = "|"
  )
}

.sm_api_recipients_cache_get <- function(collector_id, base_url, include_details) {
  key <- .sm_api_recipients_cache_key(collector_id, base_url, include_details)
  value <- .sm_api_recipients_cache[[key]]
  if (is.data.frame(value)) value else data.frame()
}

.sm_api_recipients_cache_add <- function(collector_id, base_url, include_details, rows_df) {
  if (!is.data.frame(rows_df) || !nrow(rows_df) || !"recipient_id" %in% names(rows_df)) {
    return(invisible(NULL))
  }
  key <- .sm_api_recipients_cache_key(collector_id, base_url, include_details)
  current <- .sm_api_recipients_cache_get(collector_id, base_url, include_details)
  combined <- .sm_api_bind_recipient_rows(current, rows_df)
  if (nrow(combined)) {
    keep <- !duplicated(trimws(as.character(combined$recipient_id)), fromLast = TRUE)
    combined <- combined[keep, , drop = FALSE]
    rownames(combined) <- NULL
  }
  .sm_api_recipients_cache[[key]] <- combined
  invisible(NULL)
}

.sm_api_recipients_cache_clear <- function() {
  rm(list = ls(envir = .sm_api_recipients_cache), envir = .sm_api_recipients_cache)
  invisible(NULL)
}

# rbind con union de columnas (rellena NA) para filas de destinatarios que
# pueden traer sets distintos de columnas recipient_cv_*.
.sm_api_bind_recipient_rows <- function(a, b) {
  a <- if (is.data.frame(a)) a else data.frame()
  b <- if (is.data.frame(b)) b else data.frame()
  if (!nrow(a)) return(b)
  if (!nrow(b)) return(a)
  cols <- union(names(a), names(b))
  for (col in setdiff(cols, names(a))) a[[col]] <- NA_character_
  for (col in setdiff(cols, names(b))) b[[col]] <- NA_character_
  rbind(a[, cols, drop = FALSE], b[, cols, drop = FALSE])
}

sm_api_enrich_response_recipients <- function(data,
                                              token,
                                              base_url = "https://api.surveymonkey.com/v3",
                                              include_details = TRUE) {
  if (is.null(data) || !is.data.frame(data) || !nrow(data)) return(data)
  if (!all(c("collector_id", "recipient_id") %in% names(data))) return(data)
  collector_ids <- unique(trimws(as.character(data$collector_id)))
  collector_ids <- collector_ids[nzchar(collector_ids) & !is.na(collector_ids)]
  if (!length(collector_ids)) return(data)
  enriched <- data
  failed_collectors <- character(0)
  for (collector_id in collector_ids) {
    idx <- which(trimws(as.character(enriched$collector_id)) == collector_id)
    recipient_ids <- unique(trimws(as.character(enriched$recipient_id[idx])))
    recipient_ids <- recipient_ids[nzchar(recipient_ids) & !is.na(recipient_ids)]
    if (!length(recipient_ids)) next
    cached <- .sm_api_recipients_cache_get(collector_id, base_url, include_details)
    cached_ids <- if (nrow(cached) && "recipient_id" %in% names(cached)) {
      trimws(as.character(cached$recipient_id))
    } else {
      character(0)
    }
    missing_ids <- setdiff(recipient_ids, cached_ids)
    fetched <- data.frame()
    if (length(missing_ids)) {
      fetched <- tryCatch(
        sm_api_fetch_collector_recipient_rows(
          collector_id,
          token,
          base_url = base_url,
          recipient_ids = missing_ids,
          include_details = include_details
        ),
        error = function(e) {
          failed_collectors <<- c(failed_collectors, collector_id)
          data.frame()
        }
      )
      if (is.data.frame(fetched) && nrow(fetched)) {
        .sm_api_recipients_cache_add(collector_id, base_url, include_details, fetched)
      }
    }
    if (length(cached_ids)) {
      cached <- cached[cached_ids %in% recipient_ids, , drop = FALSE]
    }
    recipient_rows <- .sm_api_bind_recipient_rows(cached, fetched)
    if (!is.data.frame(recipient_rows) || !nrow(recipient_rows) || !"recipient_id" %in% names(recipient_rows)) next
    for (col in setdiff(names(recipient_rows), "recipient_id")) {
      if (!col %in% names(enriched)) enriched[[col]] <- NA_character_
    }
    match_pos <- match(trimws(as.character(enriched$recipient_id[idx])), trimws(as.character(recipient_rows$recipient_id)))
    has_match <- which(!is.na(match_pos))
    if (!length(has_match)) next
    for (col in setdiff(names(recipient_rows), "recipient_id")) {
      enriched[[col]][idx[has_match]] <- as.character(recipient_rows[[col]][match_pos[has_match]])
    }
  }
  if (length(failed_collectors)) {
    warning(
      sprintf(
        "SurveyMonkey: fallo el enriquecimiento de destinatarios en %d colector(es) (%s); esas filas quedan sin datos de destinatario.",
        length(unique(failed_collectors)), paste(unique(failed_collectors), collapse = ", ")
      ),
      call. = FALSE
    )
  }
  enriched
}

#' Resume destinatarios sin retornar datos personales ni links planos.
#' @export
sm_api_collector_recipient_summary <- function(collector_id,
                                               token,
                                               base_url = "https://api.surveymonkey.com/v3",
                                               detail_limit = 0L,
                                               include_details = FALSE) {
  recipients <- sm_api_fetch_collector_recipients(collector_id, token, base_url = base_url)
  if (!isTRUE(recipients$available)) {
    return(list(
      available = FALSE,
      total = 0L,
      scanned = 0L,
      truncated = FALSE,
      personalized_link_count = 0L,
      mail_status_counts = list(),
      response_status_counts = list()
    ))
  }
  rows <- recipients$data %||% list()
  total <- suppressWarnings(as.integer(recipients$total %||% length(rows)))
  if (!isTRUE(include_details)) {
    mail_status <- vapply(rows, function(row) as.character(row$mail_status %||% row$status %||% ""), character(1))
    response_status <- vapply(rows, function(row) as.character(row$survey_response_status %||% row$response_status %||% ""), character(1))
    direct_links <- vapply(rows, function(row) as.character(row$survey_link %||% ""), character(1))
    inferred_links <- if (length(rows)) {
      link_count <- sum(!is.na(direct_links) & nzchar(trimws(direct_links)))
      if (link_count > 0L) link_count else if (is.finite(total)) total else length(rows)
    } else {
      0L
    }
    return(list(
      available = TRUE,
      total = if (is.finite(total)) as.integer(total) else length(rows),
      scanned = as.integer(length(rows)),
      truncated = FALSE,
      personalized_link_count = as.integer(inferred_links),
      mail_status_counts = .sm_api_count_values(mail_status),
      response_status_counts = .sm_api_count_values(response_status)
    ))
  }
  detail_limit <- suppressWarnings(as.integer(detail_limit %||% 500L))
  if (!is.finite(detail_limit)) detail_limit <- 500L
  detail_limit <- max(0L, detail_limit)
  scan_n <- min(length(rows), detail_limit)

  mail_status <- character(0)
  response_status <- character(0)
  link_present <- logical(0)
  if (scan_n > 0L) {
    for (i in seq_len(scan_n)) {
      row <- rows[[i]]
      rid <- row$id %||% row$recipient_id %||% ""
      detail <- tryCatch(
        sm_api_fetch_collector_recipient_detail(collector_id, rid, token, base_url = base_url),
        error = function(e) NULL
      )
      src <- if (is.null(detail)) row else detail
      mail_status <- c(mail_status, as.character(src$mail_status %||% src$status %||% ""))
      response_status <- c(response_status, as.character(src$survey_response_status %||% src$response_status %||% ""))
      survey_link <- as.character(src$survey_link %||% "")
      link_present <- c(link_present, !is.na(survey_link) && nzchar(trimws(survey_link)))
    }
  }

  list(
    available = TRUE,
    total = if (is.finite(total)) as.integer(total) else length(rows),
    scanned = as.integer(scan_n),
    truncated = is.finite(total) && total > scan_n,
    personalized_link_count = as.integer(sum(link_present, na.rm = TRUE)),
    mail_status_counts = .sm_api_count_values(mail_status),
    response_status_counts = .sm_api_count_values(response_status)
  )
}

#' Descargar respuestas bulk de SurveyMonkey API v3
#'
#' Requiere scope `responses_read_detail`. El filtro `since` se aplica
#' localmente sobre `date_modified`. `start_modified_at` viaja al servidor
#' como query param del endpoint bulk (delta server-side); su operacion real
#' se verifica en el caller paginado (ver fallback detectable en
#' [sm_api_fetch_all_responses_bulk()]).
#'
#' @param survey_id ID numerico de SurveyMonkey.
#' @param token Personal Access Token.
#' @param page Pagina.
#' @param per_page Tamano de pagina.
#' @param since Fecha/hora minima opcional para `date_modified` (filtro local).
#' @param start_modified_at Cursor opcional enviado al servidor.
#' @param base_url URL base API.
#' @return Lista JSON de `/surveys/{id}/responses/bulk`.
#' @export
sm_api_fetch_responses_bulk <- function(survey_id,
                                        token,
                                        page = 1L,
                                        per_page = 100L,
                                        since = NULL,
                                        start_modified_at = NULL,
                                        base_url = "https://api.surveymonkey.com/v3") {
  survey_id <- trimws(as.character(survey_id %||% "")[1])
  token <- as.character(token %||% "")[1]
  if (!nzchar(survey_id)) stop("Falta 'survey_id'.", call. = FALSE)
  if (!nzchar(token)) stop("Falta el token de la API.", call. = FALSE)
  if (!requireNamespace("curl", quietly = TRUE)) stop("Paquete 'curl' no instalado.", call. = FALSE)
  if (!requireNamespace("jsonlite", quietly = TRUE)) stop("Paquete 'jsonlite' no instalado.", call. = FALSE)

  page <- suppressWarnings(as.integer(page %||% 1L))
  per_page <- suppressWarnings(as.integer(per_page %||% 100L))
  if (!is.finite(page) || page < 1L) page <- 1L
  if (!is.finite(per_page) || per_page < 1L) per_page <- 100L
  per_page <- min(per_page, 100L)

  url <- sprintf(
    "%s/surveys/%s/responses/bulk?page=%d&per_page=%d&sort_by=date_modified&sort_order=ASC",
    sub("/$", "", base_url),
    utils::URLencode(survey_id, reserved = TRUE),
    page,
    per_page
  )
  cursor <- trimws(as.character(start_modified_at %||% "")[1])
  if (nzchar(cursor) && !is.na(cursor)) {
    url <- paste0(url, "&start_modified_at=", utils::URLencode(cursor, reserved = TRUE))
  }
  res <- .sm_api_fetch_with_retry(url, function() .sm_api_auth_handle(token))
  body <- rawToChar(res$content)
  Encoding(body) <- "UTF-8"

  if (res$status_code == 401L) {
    stop("Token rechazado por SurveyMonkey (HTTP 401).", call. = FALSE)
  }
  if (res$status_code == 403L) {
    stop_api(
      403,
      "E_SM_RESPONSES_SCOPE",
      paste(
        "El token permite ver la estructura de la encuesta, pero no leer respuestas.",
        "Activa el permiso \"View Response Details\" (responses_read_detail) en SurveyMonkey",
        "y vuelve a guardar/probar el token, o sube las respuestas manualmente para esos origenes."
      ),
      details = list(scope = "responses_read_detail")
    )
  }
  if (res$status_code == 402L) {
    stop("SurveyMonkey rechazo el acceso a respuestas por limite del plan.", call. = FALSE)
  }
  if (res$status_code >= 400L) {
    stop(sprintf("API SurveyMonkey devolvio HTTP %d: %s", res$status_code, body), call. = FALSE)
  }

  parsed <- jsonlite::fromJSON(body, simplifyVector = FALSE)
  if (!is.null(since) && length(parsed$data %||% list())) {
    since_ts <- .sm_api_parse_time(since)
    if (!is.na(since_ts)) {
      parsed$data <- Filter(function(r) {
        mod <- .sm_api_parse_time(r$date_modified %||% r$date_created %||% NA_character_)
        is.na(mod) || mod >= since_ts
      }, parsed$data)
    }
  }
  parsed
}

# Feature flag del cursor server-side de SurveyMonkey (unidad 3.8). Default
# ON; PROSECNUR_SM_CURSOR=0 lo apaga. RIESGO documentado: `start_modified_at`
# no se pudo validar contra la API real en esta unidad (sin red permitida).
# La red de seguridad es doble: (1) fallback DETECTABLE — si la primera
# pagina trae items anteriores al cursor, el filtro remoto no opero y se emite
# warning; (2) el delta se re-filtra SIEMPRE localmente contra el cursor, asi
# los numeros no cambian aunque el servidor ignore el parametro.
.sm_cursor_flag_enabled <- function(value = Sys.getenv("PROSECNUR_SM_CURSOR", unset = "")) {
  !tolower(trimws(as.character(value %||% "")[1])) %in% c("0", "false", "off", "no")
}

# Mayor `date_modified` (string original) entre las respuestas crudas.
.sm_api_max_modified_at <- function(rows) {
  best_raw <- ""
  best_ts <- as.POSIXct(NA)
  for (r in rows %||% list()) {
    raw <- as.character(r$date_modified %||% r$date_created %||% "")[1]
    if (is.na(raw) || !nzchar(raw)) next
    ts <- .sm_api_parse_time(raw)
    if (is.na(ts)) next
    if (is.na(best_ts) || ts > best_ts) {
      best_ts <- ts
      best_raw <- raw
    }
  }
  best_raw
}

sm_api_fetch_all_responses_bulk <- function(survey_id,
                                            token,
                                            per_page = 100L,
                                            since = NULL,
                                            start_modified_at = NULL,
                                            max_pages = 500L,
                                            progress = NULL,
                                            base_url = "https://api.surveymonkey.com/v3") {
  cursor <- trimws(as.character(start_modified_at %||% "")[1])
  cursor_enabled <- nzchar(cursor) && !is.na(cursor) && .sm_cursor_flag_enabled()
  cursor_ts <- if (cursor_enabled) .sm_api_parse_time(cursor) else as.POSIXct(NA)
  cursor_applied <- cursor_enabled
  first_page_checked <- FALSE
  page <- 1L
  out <- list()
  total <- NA_integer_
  repeat {
    payload <- sm_api_fetch_responses_bulk(
      survey_id = survey_id,
      token = token,
      page = page,
      per_page = per_page,
      since = NULL,
      start_modified_at = if (cursor_enabled) cursor else NULL,
      base_url = base_url
    )
    rows <- payload$data %||% list()
    if (cursor_enabled && !first_page_checked) {
      first_page_checked <- TRUE
      if (!is.na(cursor_ts) && length(rows)) {
        stale <- vapply(rows, function(r) {
          mod <- .sm_api_parse_time(r$date_modified %||% r$date_created %||% NA_character_)
          !is.na(mod) && mod < cursor_ts
        }, logical(1))
        if (any(stale)) {
          cursor_applied <- FALSE
          warning(
            "SurveyMonkey ignoro 'start_modified_at'; se descargara el historial completo y el delta se filtrara localmente.",
            call. = FALSE
          )
        }
      }
    }
    if (length(rows)) out <- c(out, rows)
    total <- suppressWarnings(as.integer(payload$total %||% total))
    if (!is.null(progress)) {
      progress(length(out), if (is.finite(total)) total else NA_integer_,
               sprintf("SurveyMonkey: %d respuestas", length(out)))
    }
    if (length(rows) < min(per_page, 100L)) break
    page <- page + 1L
    if (page > max_pages) {
      stop("Se alcanzo el limite de paginas configurado para SurveyMonkey.", call. = FALSE)
    }
  }
  max_modified_at <- .sm_api_max_modified_at(out)
  # Cinturon local del delta: garantiza los mismos numeros aunque el servidor
  # haya ignorado el cursor. Con filtro remoto operativo es un no-op barato.
  if (cursor_enabled && is.null(since)) since <- cursor
  if (!is.null(since) && length(out)) {
    since_ts <- .sm_api_parse_time(since)
    if (!is.na(since_ts)) {
      out <- Filter(function(r) {
        mod <- .sm_api_parse_time(r$date_modified %||% r$date_created %||% NA_character_)
        is.na(mod) || mod >= since_ts
      }, out)
    }
  }
  list(
    ok = TRUE,
    count = length(out),
    total = if (is.finite(total)) total else length(out),
    data = out,
    cursor_requested = cursor,
    cursor_enabled = cursor_enabled,
    cursor_applied = cursor_enabled && cursor_applied,
    max_modified_at = max_modified_at
  )
}

sm_api_check_responses_scope <- function(survey_id, token, base_url = "https://api.surveymonkey.com/v3") {
  tryCatch({
    sm_api_fetch_responses_bulk(survey_id, token, page = 1L, per_page = 1L, base_url = base_url)
    list(ok = TRUE)
  }, error = function(e) {
    list(ok = FALSE, error = conditionMessage(e))
  })
}

sm_api_flatten_responses <- function(details, responses, style = .sm_api_default_style()) {
  if (is.null(responses) || !length(responses)) return(data.frame())
  if (!requireNamespace("jsonlite", quietly = TRUE)) stop("Paquete 'jsonlite' no instalado.", call. = FALSE)
  qmap <- .sm_api_response_question_map(details, style = style)

  rows <- lapply(responses, function(resp) {
    out <- list(
      response_id = .sm_api_scalar(resp$id %||% resp$response_id %||% NA_character_),
      collector_id = .sm_api_scalar(resp$collector_id %||% NA_character_),
      recipient_id = .sm_api_scalar(resp$recipient_id %||% NA_character_),
      response_status = .sm_api_scalar(resp$response_status %||% NA_character_),
      collection_mode = .sm_api_scalar(resp$collection_mode %||% NA_character_),
      date_created = .sm_api_scalar(resp$date_created %||% NA_character_),
      date_modified = .sm_api_scalar(resp$date_modified %||% NA_character_),
      total_time = suppressWarnings(as.numeric(resp$total_time %||% NA_real_)),
      ip_address = .sm_api_scalar(resp$ip_address %||% NA_character_),
      custom_value = .sm_api_scalar(resp$custom_value %||% NA_character_)
    )

    custom <- resp$custom_variables %||% list()
    if (length(custom)) {
      for (nm in names(custom)) {
        out[[paste0("cv_", .sm_api_safe_name(nm))]] <- .sm_api_scalar(custom[[nm]])
      }
    }

    pages <- resp$pages %||% list()
    for (page in pages) {
      questions <- page$questions %||% list()
      for (question in questions) {
        qid <- as.character(question$id %||% question$question_id %||% "")
        spec <- qmap$questions[[qid]] %||% list(name = paste0("q_", qid))
        answers <- question$answers %||% list()
        for (ans in answers) {
          var <- spec$name %||% paste0("q_", qid)
          if (!is.null(ans$row_id) && nzchar(as.character(ans$row_id))) {
            row_label <- qmap$rows[[as.character(ans$row_id)]] %||% as.character(ans$row_id)
            var <- paste(var, .sm_api_safe_name(row_label), sep = "__")
          }
          value <- .sm_api_answer_value(ans, qmap)
          if (!nzchar(as.character(value %||% ""))) next
          old <- out[[var]]
          out[[var]] <- if (is.null(old) || is.na(old) || !nzchar(as.character(old))) {
            value
          } else {
            paste(unique(c(strsplit(as.character(old), " \\| ", fixed = FALSE)[[1]], value)), collapse = " | ")
          }
        }
      }
    }
    out
  })

  cols <- unique(unlist(lapply(rows, names), use.names = FALSE))
  df <- do.call(rbind, lapply(rows, function(row) {
    vals <- lapply(cols, function(nm) {
      v <- row[[nm]]
      if (is.null(v) || length(v) == 0L) return(NA_character_)
      if (is.list(v)) return(jsonlite::toJSON(v, auto_unbox = TRUE, null = "null"))
      as.character(v)[1]
    })
    names(vals) <- cols
    as.data.frame(vals, stringsAsFactors = FALSE, optional = TRUE)
  }))
  names(df) <- cols
  rownames(df) <- NULL
  variable_labels <- .sm_api_response_variable_labels(qmap, names(df))
  if (length(variable_labels)) {
    attr(df, "variable_labels") <- variable_labels
  }
  df
}

.sm_api_parse_time <- function(x) {
  if (inherits(x, "POSIXt")) return(x[1])
  x <- as.character(x %||% "")[1]
  if (!nzchar(x) || is.na(x)) return(as.POSIXct(NA))
  fmts <- c(
    "%Y-%m-%dT%H:%M:%OSZ", "%Y-%m-%dT%H:%M:%S%z",
    "%Y-%m-%d %H:%M:%OS", "%Y-%m-%d"
  )
  for (fmt in fmts) {
    out <- suppressWarnings(as.POSIXct(x, format = fmt, tz = "UTC"))
    if (!is.na(out)) return(out)
  }
  suppressWarnings(as.POSIXct(x, tz = "UTC"))
}

.sm_api_scalar <- function(x) {
  if (is.null(x) || length(x) == 0L) return(NA_character_)
  if (is.list(x)) return(jsonlite::toJSON(x, auto_unbox = TRUE, null = "null"))
  as.character(x)[1]
}

.sm_api_safe_name <- function(x) {
  x <- tolower(trimws(as.character(x %||% "")))
  x <- iconv(x, to = "ASCII//TRANSLIT", sub = "")
  x <- gsub("[^a-z0-9]+", "_", x)
  x <- gsub("^_+|_+$", "", x)
  if (!nzchar(x)) "valor" else x
}

.sm_api_response_question_map <- function(details, style = .sm_api_default_style()) {
  pages <- details$pages %||% list()
  questions <- list()
  choices <- list()
  rows <- list()
  cols <- list()
  global_pos <- 0L
  for (page in pages) {
    for (q in page$questions %||% list()) {
      fam <- .sm_or(q$family, "")
      if (identical(fam, "presentation")) next
      global_pos <- global_pos + 1L
      qid <- as.character(q$id %||% "")
      q_name <- .sm_api_q_name(global_pos, style = style, upper = FALSE)
      questions[[qid]] <- list(
        id = qid,
        name = q_name,
        heading = .sm_api_question_heading(q),
        family = fam
      )
      ans <- q$answers %||% list()
      for (ch in ans$choices %||% list()) {
        cid <- as.character(ch$id %||% "")
        if (nzchar(cid)) choices[[cid]] <- .sm_api_clean_text(.sm_or(ch$text, cid))
      }
      for (r in ans$rows %||% list()) {
        rid <- as.character(r$id %||% "")
        if (nzchar(rid)) rows[[rid]] <- .sm_api_clean_text(.sm_or(r$text, rid))
      }
      for (c in ans$cols %||% ans$columns %||% list()) {
        cid <- as.character(c$id %||% "")
        if (nzchar(cid)) cols[[cid]] <- .sm_api_clean_text(.sm_or(c$text, cid))
      }
    }
  }
  list(questions = questions, choices = choices, rows = rows, cols = cols)
}

.sm_api_response_variable_labels <- function(qmap, data_names = character()) {
  questions <- qmap$questions %||% list()
  if (!length(questions)) return(character(0))
  data_names <- as.character(data_names %||% character(0))
  out <- character(0)
  for (spec in questions) {
    nm <- as.character(spec$name %||% "")[1]
    label <- as.character(spec$heading %||% "")[1]
    if (is.na(nm) || !nzchar(nm) || is.na(label) || !nzchar(label)) next
    if (length(data_names) && !(nm %in% data_names)) next
    out[[nm]] <- label
  }
  out
}

.sm_api_answer_value <- function(ans, qmap) {
  if (!is.null(ans$text) && nzchar(as.character(ans$text))) return(as.character(ans$text)[1])
  if (!is.null(ans$choice_id)) {
    cid <- as.character(ans$choice_id)
    return(qmap$choices[[cid]] %||% cid)
  }
  if (!is.null(ans$col_id)) {
    cid <- as.character(ans$col_id)
    return(qmap$cols[[cid]] %||% cid)
  }
  if (!is.null(ans$row_id)) {
    rid <- as.character(ans$row_id)
    return(qmap$rows[[rid]] %||% rid)
  }
  .sm_api_scalar(ans)
}

#' Extrae el mapeo página → preguntas a partir del response de la API.
#'
#' La heurística usa la posición global lineal de cada pregunta (excluyendo
#' tipo `presentation` que es texto informativo y no aparece en el .sav)
#' y la formatea como `Q{N}` con el padding del estilo dominante del dataset
#' (detectado con `.sm_detect_naming_style` sobre el .sav).
#'
#' @param details Lista retornada por [sm_api_fetch_survey_details()].
#' @param style Lista `list(prefix, pad)` retornada por `.sm_detect_naming_style`,
#'   o `NULL` para usar pad=0 (sin padding, convención P/Q corta).
#' @return Lista nombrada por número de página → vector de identificadores
#'   tipo "Q0001", "Q0002", listo para pasar como `paginas` argument.
#' @export
sm_api_extract_paginas <- function(details, style = NULL) {
  pages_info <- sm_api_extract_pages(details, style = style)
  if (!length(pages_info)) return(list())
  out <- lapply(pages_info, `[[`, "questions")
  names(out) <- vapply(pages_info, `[[`, character(1), "page_id")
  out
}

#' Extrae páginas con título, rango y preguntas desde `/surveys/{id}/details`.
#'
#' A diferencia de [sm_api_extract_paginas()], esta función conserva metadata
#' legible para UI: título de página, rango de preguntas y headings de cada
#' pregunta. El traductor sigue usando `questions`; el frontend usa lo demás
#' para mostrar secciones entendibles para personas no técnicas.
#'
#' @param details Lista retornada por [sm_api_fetch_survey_details()].
#' @param style Lista `list(prefix, pad)` retornada por `.sm_detect_naming_style`.
#' @return Lista de páginas con `page_id`, `title`, `range_label`, `questions`.
#' @export
sm_api_extract_pages <- function(details, style = NULL) {
  pages <- .sm_or(details$pages, list())
  if (!length(pages)) return(list())

  pad <- if (!is.null(style) && !is.null(style$pad)) as.integer(style$pad) else 0L
  out <- list()
  global_pos <- 0L

  for (p_idx in seq_along(pages)) {
    page <- pages[[p_idx]]
    page_num <- as.integer(.sm_or(page$position, p_idx))
    questions <- .sm_or(page$questions, list())
    page_qs <- character(0)
    question_info <- list()
    presentation_headings <- character(0)

    for (q in questions) {
      fam <- .sm_or(q$family, "")
      if (identical(fam, "presentation")) {
        h_pres <- .sm_api_question_heading(q)
        if (!is.na(h_pres) && nzchar(h_pres)) {
          presentation_headings <- c(presentation_headings, h_pres)
        }
        next  # Texto informativo, no exporta a .sav
      }
      global_pos <- global_pos + 1L
      q_name <- if (pad <= 1L) {
        sprintf("Q%d", global_pos)
      } else {
        sprintf("Q%s", formatC(global_pos, width = pad, flag = "0", format = "d"))
      }
      page_qs <- c(page_qs, q_name)
      answers <- .sm_or(q$answers, list())
      rows <- .sm_or(answers$rows, list())
      choices <- .sm_api_question_choices(q)
      child_rows <- list()
      if (identical(fam, "matrix")) {
        q_base <- .sm_q_to_p(tolower(q_name))
        if (is.na(q_base) || !nzchar(q_base)) q_base <- tolower(q_name)
        list_name <- if (length(choices)) paste0("lst_", q_base) else NA_character_
        single_scale <- !length(rows) || (
          length(rows) == 1L &&
            !nzchar(.sm_api_clean_text(.sm_or(rows[[1]]$text, NA_character_)) %||% "")
        )
        if (single_scale) {
          child_rows[[1L]] <- list(
            name = q_base,
            heading = .sm_api_question_heading(q),
            type = if (length(choices)) paste("select_one", list_name) else "select_one",
            list_name = list_name
          )
        } else {
          for (r_idx in seq_along(rows)) {
            row_label <- .sm_api_clean_text(.sm_or(rows[[r_idx]]$text, NA_character_))
            if (is.na(row_label) || !nzchar(row_label)) row_label <- paste("Fila", r_idx)
            child_rows[[length(child_rows) + 1L]] <- list(
              name = paste0(q_base, "_", r_idx),
              heading = row_label,
              type = if (length(choices)) paste("select_one", list_name) else "select_one",
              list_name = list_name
            )
          }
        }
      }
      question_info[[length(question_info) + 1L]] <- list(
        name = q_name,
        heading = .sm_api_question_heading(q),
        family = .sm_or(q$family, NA_character_),
        subtype = .sm_or(q$subtype, NA_character_),
        id = .sm_or(q$id, NA_character_),
        choices = choices,
        children = child_rows
      )
    }

    page_id <- as.character(page_num)
    raw_title <- .sm_api_page_title(page, presentation_headings)
      out[[length(out) + 1L]] <- list(
        page_id = page_id,
        title = raw_title,
        label = .sm_api_page_label(page_id, raw_title, page_qs),
        range_label = .sm_api_range_label(page_qs),
        questions = page_qs,
        question_count = length(page_qs),
        notes = presentation_headings,
        question_details = question_info
      )
  }
  out
}

.sm_api_default_style <- function() {
  list(prefix = "q", pad = 4L)
}

.sm_api_q_name <- function(pos, style = NULL, upper = FALSE) {
  if (is.null(style)) style <- .sm_api_default_style()
  prefix <- if (upper) toupper(.sm_or(style$prefix, "q")) else tolower(.sm_or(style$prefix, "q"))
  pad <- as.integer(.sm_or(style$pad, 4L))
  if (pad <= 1L) paste0(prefix, as.integer(pos)) else paste0(prefix, formatC(as.integer(pos), width = pad, flag = "0", format = "d"))
}

# Helper compartido: detecta si la API SM está exponiendo `position` como
# 0-indexed (`min == 0`) y devuelve el offset (+1) que hay que sumar para
# que el espacio visible al usuario quede 1-indexed (que es lo que muestra
# el constructor SM y lo que codifica SPSS export). Si la API ya es
# 1-indexed, devuelve 0.
#
# Solo usa los `choices` regulares — los campos especiales `other` y `none`
# de SM frecuentemente vienen con `position=0` como sentinela ("agregame al
# final") y NO reflejan posición real en el constructor. Si los incluyéramos
# acá, una pregunta con choices 1-indexed (1,2,3,4,5,6,7) + other (0) +
# none (0) se interpretaría falsamente como 0-indexed y nos correría todo
# el numbering una posición.
.sm_api_position_offset <- function(q) {
  choices <- .sm_or(.sm_or(q$answers, list())$choices, list())
  positions <- integer(0)
  for (ch in choices) {
    # Saltar "Ninguna de las opciones anteriores": SM lo embebe en `choices`
    # con `position=0` como sentinela ("ubícame al final visualmente").
    if (.sm_api_is_none_choice(ch, choices)) next
    p <- suppressWarnings(as.integer(.sm_or(ch$position, NA_integer_)))
    if (!is.na(p)) positions <- c(positions, p)
  }
  if (length(positions) > 0L && min(positions) == 0L) 1L else 0L
}

# Helper interno: ¿este choice es "Ninguna de las opciones anteriores"?
# SM v3 no expone un flag estable para distinguirlo de un choice regular,
# así que aplicamos dos señales:
#   1) Flag explícito `is_none_of_the_above` (cuando viene en el response).
#   2) Heurística posicional: choice con `position == 0` cuando AL MENOS
#      otro choice del mismo set tiene `position >= 1`. SM usa 0 como
#      sentinela "agregame al final" para los toggles especiales (Otros y
#      Ninguna). Si TODOS los choices son 0-indexed legítimos, el helper
#      no los marca como sentinela (porque ninguno tiene position >= 1).
.sm_api_is_none_choice <- function(ch, all_choices = NULL) {
  if (isTRUE(.sm_or(ch$is_none_of_the_above, FALSE))) return(TRUE)
  if (is.null(all_choices) || !length(all_choices)) return(FALSE)
  p <- suppressWarnings(as.integer(.sm_or(ch$position, NA_integer_)))
  if (is.na(p) || p != 0L) return(FALSE)
  # ¿Hay al menos un choice "regular" con position >= 1? Si sí, este 0 es
  # sentinela. Si no, todos son 0-indexed legítimos y este es un regular.
  for (other_ch in all_choices) {
    op <- suppressWarnings(as.integer(.sm_or(other_ch$position, NA_integer_)))
    if (!is.na(op) && op >= 1L) return(TRUE)
  }
  FALSE
}

.sm_api_question_choices <- function(q) {
  answers <- .sm_or(q$answers, list())
  choices <- .sm_or(answers$choices, list())
  other <- .sm_or(answers$other, NULL)
  none_top <- .sm_or(answers$none, NULL)
  offset <- .sm_api_position_offset(q)
  out <- list()
  pending_none_labels <- character(0)  # "Ninguna" embebidos dentro de `choices`
  # 1) Choices regulares — orden y posición tomada de la API (normalizada).
  if (length(choices)) {
    for (i in seq_along(choices)) {
      ch <- choices[[i]]
      label <- .sm_first_nonempty(
        c(.sm_api_clean_text(.sm_or(ch$text, NA_character_)), .sm_api_clean_text(.sm_or(ch$visible_text, NA_character_))),
        fallback = NA_character_
      )
      if (is.na(label) || !nzchar(label)) next
      # SM embebe "Ninguna de las opciones anteriores" dentro de `choices`
      # con flag y position=0. Lo apartamos para añadirlo al final en el
      # orden visible del constructor (tras "Otros:").
      if (.sm_api_is_none_choice(ch, choices)) {
        pending_none_labels <- c(pending_none_labels, label)
        next
      }
      raw_pos <- suppressWarnings(as.integer(.sm_or(ch$position, i - offset)))
      if (is.na(raw_pos)) raw_pos <- i - offset
      pos <- raw_pos + offset  # normalizado a 1-indexed (espacio del constructor SM)
      out[[length(out) + 1L]] <- list(
        code = as.character(pos),
        label = label,
        position = pos,
        is_other = FALSE,
        is_none = FALSE
      )
    }
  }
  # 2) "Otros:" (Add an 'Other' option) — siempre al final, ignorando la
  #    `position` que reporta la API (suele ser 0 como sentinela).
  if (!is.null(other) && length(other) > 0L) {
    is_visible <- isTRUE(.sm_or(other$is_answer_choice, .sm_or(other$visible, TRUE)))
    if (is_visible) {
      label <- .sm_api_clean_text(.sm_or(other$text, NA_character_))
      if (!is.na(label) && nzchar(label)) {
        pos <- length(out) + 1L
        out[[length(out) + 1L]] <- list(
          code = as.character(pos),
          label = label,
          position = pos,
          is_other = TRUE,
          is_none = FALSE
        )
      }
    }
  }
  # 3) "Ninguna de las opciones anteriores" — primero los embebidos en
  #    `choices` (case habitual), después el campo `answers$none` cuando
  #    SM lo expone aparte. Siempre van al final, después de "Otros:".
  none_labels <- pending_none_labels
  if (!is.null(none_top) && length(none_top) > 0L) {
    is_visible <- isTRUE(.sm_or(none_top$is_answer_choice, .sm_or(none_top$visible, TRUE)))
    if (is_visible) {
      label <- .sm_api_clean_text(.sm_or(none_top$text, NA_character_))
      if (!is.na(label) && nzchar(label)) none_labels <- c(none_labels, label)
    }
  }
  for (label in none_labels) {
    pos <- length(out) + 1L
    out[[length(out) + 1L]] <- list(
      code = as.character(pos),
      label = label,
      position = pos,
      is_other = FALSE,
      is_none = TRUE
    )
  }
  out[order(vapply(out, `[[`, integer(1), "position"))]
}

.sm_api_clean_text <- function(x) {
  x <- .sm_first_nonempty(x, fallback = NA_character_)
  if (is.na(x) || !nzchar(x)) return(NA_character_)
  x <- gsub("<br\\s*/?>", " ", x, ignore.case = TRUE, perl = TRUE)
  x <- gsub("<[^>]+>", " ", x, perl = TRUE)
  x <- gsub("&nbsp;", " ", x, fixed = TRUE)
  x <- gsub("&amp;", "&", x, fixed = TRUE)
  x <- gsub("&quot;", "\"", x, fixed = TRUE)
  x <- gsub("&#39;", "'", x, fixed = TRUE)
  .sm_norm_ws(x)
}

.sm_api_question_heading <- function(q) {
  headings <- .sm_or(q$headings, list())
  if (!length(headings)) return(NA_character_)
  .sm_api_clean_text(.sm_or(headings[[1]]$heading, NA_character_))
}

.sm_api_page_title <- function(page, presentation_headings = character()) {
  title <- .sm_api_clean_text(c(
    .sm_or(page$title, NA_character_),
    .sm_or(page$heading, NA_character_)
  ))
  if (!is.na(title) && nzchar(title)) return(title)
  presentation_headings <- presentation_headings[!is.na(presentation_headings) & nzchar(presentation_headings)]
  if (length(presentation_headings)) {
    fallback <- presentation_headings[1]
    if (nchar(fallback) > 80L) fallback <- paste0(substr(fallback, 1L, 77L), "...")
    return(fallback)
  }
  NA_character_
}

.sm_api_range_label <- function(qs) {
  if (!length(qs)) return("")
  pretty <- .sm_api_display_qref(qs)
  if (length(pretty) == 1L) return(pretty[1])
  paste0(pretty[1], "-", pretty[length(pretty)])
}

.sm_api_page_label <- function(page_id, title, qs) {
  range <- .sm_api_range_label(qs)
  title <- .sm_first_nonempty(title, fallback = paste("Página", page_id))
  if (nzchar(range)) paste0(title, " (", range, ")") else title
}

.sm_api_display_qref <- function(qs) {
  vapply(qs, function(q) {
    m <- regmatches(q, regexec(perl = TRUE, "^([QPqp])0*([0-9]+)$", q))[[1]]
    if (length(m) == 3L) paste0(toupper(m[2]), as.integer(m[3])) else q
  }, character(1))
}

#' Extrae etiquetas reales de catálogos desde `/surveys/{id}/details`.
#'
#' Devuelve una tabla por posición global de pregunta (excluyendo
#' `presentation`, igual que [sm_api_extract_paginas()]). No usa los IDs de
#' SurveyMonkey como códigos XLSForm porque esos IDs no necesariamente
#' coinciden con los value labels del `.sav`; solo se usan para reemplazar
#' labels por posición.
#'
#' @param details Lista retornada por [sm_api_fetch_survey_details()].
#' @param style Lista `list(prefix, pad)` retornada por `.sm_detect_naming_style`.
#' @return Tibble con columnas `q_ref`, `choice_pos`, `choice_label`.
#' @export
sm_api_extract_choice_labels <- function(details, style = NULL) {
  pages <- .sm_or(details$pages, list())
  if (!length(pages)) {
    return(tibble::tibble(
      q_ref = character(0),
      choice_pos = integer(0),
      choice_label = character(0)
    ))
  }

  pad <- if (!is.null(style) && !is.null(style$pad)) as.integer(style$pad) else 0L
  rows <- list()
  global_pos <- 0L

  for (page in pages) {
    questions <- .sm_or(page$questions, list())
    for (q in questions) {
      fam <- .sm_or(q$family, "")
      if (identical(fam, "presentation")) next
      global_pos <- global_pos + 1L

      q_ref <- if (pad <= 1L) {
        sprintf("Q%d", global_pos)
      } else {
        sprintf("Q%s", formatC(global_pos, width = pad, flag = "0", format = "d"))
      }

      choices <- .sm_or(.sm_or(q$answers, list())$choices, list())
      other <- .sm_or(.sm_or(q$answers, list())$other, NULL)
      fam <- .sm_or(q$family, "")
      if (!length(choices)) next

      offset <- .sm_api_position_offset(q)

      for (i in seq_along(choices)) {
        ch <- choices[[i]]
        label <- .sm_first_nonempty(
          c(.sm_or(ch$text, NA_character_), .sm_or(ch$visible_text, NA_character_)),
          fallback = NA_character_
        )
        if (is.na(label) || !nzchar(label)) next
        raw_pos <- suppressWarnings(as.integer(.sm_or(ch$position, i - offset)))
        if (is.na(raw_pos)) raw_pos <- i - offset
        pos <- raw_pos + offset
        rows[[length(rows) + 1L]] <- tibble::tibble(
          q_ref = q_ref,
          choice_pos = pos,
          choice_label = label
        )
      }
      if (!is.null(other) && isTRUE(.sm_or(other$is_answer_choice, FALSE))) {
        label <- .sm_api_clean_text(.sm_or(other$text, NA_character_))
        if (!is.na(label) && nzchar(label)) {
          raw_other <- suppressWarnings(as.integer(.sm_or(other$position, NA_integer_)))
          other_pos <- if (is.na(raw_other)) 0L else raw_other + offset
          if (identical(fam, "multiple_choice") || other_pos <= 0L) {
            other_pos <- max(
              vapply(choices, function(ch) {
                p <- suppressWarnings(as.integer(.sm_or(ch$position, 0L)))
                if (is.na(p)) 0L else p + offset
              }, integer(1)),
              0L
            ) + 1L
          }
          rows[[length(rows) + 1L]] <- tibble::tibble(
            q_ref = q_ref,
            choice_pos = other_pos,
            choice_label = label
          )
        }
      }
    }
  }

  if (!length(rows)) {
    return(tibble::tibble(
      q_ref = character(0),
      choice_pos = integer(0),
      choice_label = character(0)
    ))
  }
  dplyr::bind_rows(rows) |>
    dplyr::arrange(.data$q_ref, .data$choice_pos)
}

#' Reemplaza labels de `choices` XLSForm con los labels reales de la API.
#'
#' El enriquecimiento es conservador: solo actúa cuando la API y el XLSForm
#' tienen el mismo número de opciones para un `list_name`. Los códigos XLSForm
#' (`name`) no se tocan, así se preserva compatibilidad con los datos `.sav`.
#'
#' @param xlsform Lista retornada por [surveymonkey_xlsform()].
#' @param details Lista retornada por [sm_api_fetch_survey_details()].
#' @param sm Objeto retornado por [surveymonkey_leer()].
#' @param style Lista `list(prefix, pad)`. Si es `NULL`, se detecta desde `sm`.
#' @return `xlsform` con `choices$label::es` enriquecido cuando aplica.
#' @export
sm_api_enrich_xlsform_choices <- function(xlsform, details, sm, style = NULL) {
  if (is.null(xlsform$choices) || !nrow(xlsform$choices)) return(xlsform)
  if (is.null(xlsform$diagnostico) || !nrow(xlsform$diagnostico)) return(xlsform)
  if (is.null(style)) style <- .sm_detect_naming_style(sm$vars_tbl$name_raw)

  api_choices <- sm_api_extract_choice_labels(details, style = style)
  if (!nrow(api_choices)) return(xlsform)

  choices <- as.data.frame(xlsform$choices, stringsAsFactors = FALSE)
  diag <- as.data.frame(xlsform$diagnostico, stringsAsFactors = FALSE)
  if (!all(c("list_name", "label::es") %in% names(choices))) return(xlsform)
  if (!all(c("group_guess", "list_name_final") %in% names(diag))) return(xlsform)

  label_col <- "label::es"
  applied <- 0L
  skipped <- 0L
  q_refs <- unique(api_choices$q_ref)

  for (q_ref in q_refs) {
    group_guess <- .sm_api_q_ref_to_group(q_ref, style)
    list_names <- unique(diag$list_name_final[
      diag$group_guess == group_guess &
        !is.na(diag$list_name_final) &
        nzchar(diag$list_name_final)
    ])
    list_names <- list_names[!is.na(list_names) & nzchar(list_names)]
    if (!length(list_names)) next

    labels <- api_choices$choice_label[api_choices$q_ref == q_ref]
    labels <- labels[!is.na(labels) & nzchar(labels)]
    if (!length(labels)) next

    for (list_name in list_names) {
      idx <- which(choices$list_name == list_name)
      if (!length(idx)) next
      if (length(idx) != length(labels)) {
        skipped <- skipped + 1L
        next
      }
      choices[[label_col]][idx] <- labels
      applied <- applied + 1L
    }
  }

  xlsform$choices <- tibble::as_tibble(choices)
  xlsform$api_enrichment <- list(
    choices_relabelled_lists = applied,
    choices_skipped_mismatch = skipped
  )
  xlsform
}

.sm_api_question_specs <- function(details, style = NULL) {
  pages <- .sm_or(details$pages, list())
  if (!length(pages)) {
    return(tibble::tibble(
      q_ref = character(), group_guess = character(), family = character(),
      subtype = character(), heading = character(), required = logical(),
      validation = I(list()), row_labels = I(list())
    ))
  }

  pad <- if (!is.null(style) && !is.null(style$pad)) as.integer(style$pad) else 0L
  out <- list()
  global_pos <- 0L
  for (page in pages) {
    questions <- .sm_or(page$questions, list())
    for (q in questions) {
      fam <- .sm_or(q$family, "")
      if (identical(fam, "presentation")) next
      global_pos <- global_pos + 1L
      q_ref <- if (pad <= 1L) {
        sprintf("Q%d", global_pos)
      } else {
        sprintf("Q%s", formatC(global_pos, width = pad, flag = "0", format = "d"))
      }
      rows <- .sm_or(.sm_or(q$answers, list())$rows, list())
      row_labels <- if (length(rows)) {
        vapply(rows, function(r) .sm_api_clean_text(.sm_or(r$text, NA_character_)), character(1))
      } else character(0)
      out[[length(out) + 1L]] <- tibble::tibble(
        q_ref = q_ref,
        group_guess = .sm_api_q_ref_to_group(q_ref, style),
        family = .sm_or(q$family, NA_character_),
        subtype = .sm_or(q$subtype, NA_character_),
        heading = .sm_api_question_heading(q),
        required = .sm_api_is_required(q),
        validation = list(.sm_or(q$validation, list())),
        row_labels = list(row_labels)
      )
    }
  }
  dplyr::bind_rows(out)
}

.sm_api_is_required <- function(q) {
  req <- .sm_or(q$required, list())
  if (!length(req)) return(FALSE)
  type <- .sm_or(req$type, "")
  !identical(type, "none")
}

.sm_api_required_value <- function(q, row_idx = 1L, row_count = 1L, family = NULL) {
  if (!isTRUE(.sm_api_is_required(q))) return(NA_character_)
  family <- .sm_or(family, .sm_or(q$family, ""))
  row_idx <- suppressWarnings(as.integer(.sm_or(row_idx, 1L)))
  row_count <- suppressWarnings(as.integer(.sm_or(row_count, 1L)))
  if (is.na(row_idx) || row_idx < 1L) row_idx <- 1L
  if (is.na(row_count) || row_count < 1L) row_count <- 1L

  if (identical(family, "open_ended") && row_count > 1L) {
    req <- .sm_or(q$required, list())
    amount <- suppressWarnings(as.integer(.sm_or(req$amount, .sm_or(req$min, NA_integer_))))
    if (is.na(amount) || amount < 1L) amount <- 1L
    return(if (row_idx <= amount) "yes" else NA_character_)
  }

  "yes"
}

.sm_api_type_and_constraint <- function(family, subtype, validation = list()) {
  family <- .sm_or(family, "")
  subtype <- .sm_or(subtype, "")
  val_type <- .sm_or(validation$type, "")
  min_v <- .sm_or(validation$min, NA_character_)
  max_v <- .sm_or(validation$max, NA_character_)

  if (identical(family, "open_ended")) {
    type <- if (val_type %in% c("integer", "whole_number")) "integer" else if (val_type %in% c("decimal", "number")) "decimal" else "text"
    constraint <- character(0)
    if (type %in% c("integer", "decimal")) {
      if (!is.na(min_v) && nzchar(as.character(min_v))) constraint <- c(constraint, paste0(". >= ", min_v))
      if (!is.na(max_v) && nzchar(as.character(max_v))) constraint <- c(constraint, paste0(". <= ", max_v))
    } else if (identical(val_type, "email")) {
      constraint <- c(constraint, "regex(., '^[^@\\\\s]+@[^@\\\\s]+\\\\.[^@\\\\s]+$')")
    } else if (identical(val_type, "text_length")) {
      if (!is.na(min_v) && nzchar(as.character(min_v)) && as.numeric(min_v) > 0) {
        constraint <- c(constraint, paste0("string-length(.) >= ", min_v))
      }
      if (!is.na(max_v) && nzchar(as.character(max_v))) {
        constraint <- c(constraint, paste0("string-length(.) <= ", max_v))
      }
    }
    return(list(type = type, constraint = if (length(constraint)) paste(constraint, collapse = " and ") else NA_character_))
  }

  list(type = NA_character_, constraint = NA_character_)
}

#' Construye un XLSForm directamente desde `/surveys/{id}/details`.
#'
#' Esta ruta usa la API como fuente de verdad y no requiere export `.sav`.
#' Preserva páginas, textos informativos, tipos, opciones, required y
#' validations. La data cruda ya no participa en la construcción.
#'
#' @param details Lista retornada por [sm_api_fetch_survey_details()].
#' @param style Convención de nombres intermedia de la API. Se normaliza a `pN`.
#' @param lang Idioma por defecto del XLSForm.
#' @return Lista con `survey`, `choices`, `settings`, `diagnostico`.
#' @export
sm_api_xlsform <- function(details, style = .sm_api_default_style(), lang = "es") {
  pages <- .sm_or(details$pages, list())
  survey_rows <- list()
  choice_rows <- list()
  diag_rows <- list()
  label_sets <- list()
  vars_rows <- list()
  global_pos <- 0L

  add_survey <- function(type, name, label = NA_character_, required = NA_character_,
                         relevant = NA_character_, constraint = NA_character_,
                         calculation = NA_character_, choice_filter = NA_character_,
                         section = NA_character_) {
    survey_rows[[length(survey_rows) + 1L]] <<- tibble::tibble(
      type = type,
      name = name,
      `label::es` = label,
      required = required,
      relevant = relevant,
      constraint = constraint,
      calculation = calculation,
      choice_filter = choice_filter,
      section = section
    )
  }
  add_choice <- function(list_name, name, label) {
    choice_rows[[length(choice_rows) + 1L]] <<- tibble::tibble(
      list_name = list_name,
      name = as.character(name),
      `label::es` = label
    )
  }
  add_diag <- function(order, name, label, family, subtype, type_final, list_name = NA_character_, section = NA_character_) {
    diag_rows[[length(diag_rows) + 1L]] <<- tibble::tibble(
      order = order,
      name_raw = name,
      name_clean = name,
      name_final = name,
      label = label,
      kind_guess = paste(na.omit(c(family, subtype)), collapse = "/"),
      storage_type_guess = type_final,
      type_final = type_final,
      list_name_final = list_name,
      section_final = section,
      is_metadata = FALSE,
      is_auxiliary = FALSE,
      is_other = FALSE,
      is_question_like = TRUE,
      group_guess = name,
      n_value_labels = NA_integer_,
      class = "surveymonkey_api",
      aviso_tipo = NA_character_,
      aviso_mensaje = NA_character_
    )
  }

  for (p_idx in seq_along(pages)) {
    page <- pages[[p_idx]]
    page_num <- as.integer(.sm_or(page$position, p_idx))
    page_id <- as.character(page_num)
    questions <- .sm_or(page$questions, list())
    presentation_headings <- character(0)
    for (q in questions) {
      if (identical(.sm_or(q$family, ""), "presentation")) {
        h <- .sm_api_question_heading(q)
        if (!is.na(h) && nzchar(h)) presentation_headings <- c(presentation_headings, h)
      }
    }
    page_question_count <- sum(!vapply(questions, function(q) identical(.sm_or(q$family, ""), "presentation"), logical(1)))
    page_qs <- if (page_question_count > 0L) {
      vapply(seq_len(page_question_count), function(offset) {
        .sm_api_q_name(global_pos + offset, style = style, upper = TRUE)
      }, character(1))
    } else character(0)
    sec_name <- paste0("section_pag_", page_id)
    sec_label <- .sm_api_page_label(page_id, .sm_api_page_title(page, presentation_headings), page_qs)
    add_survey("begin_group", sec_name, sec_label, section = sec_name)

    note_idx <- 0L
    for (q in questions) {
      fam <- .sm_or(q$family, "")
      if (identical(fam, "presentation")) {
        note <- .sm_api_question_heading(q)
        if (!is.na(note) && nzchar(note)) {
          note_idx <- note_idx + 1L
          add_survey("note", paste0("nota_pag_", page_id, "_", note_idx), note, section = sec_name)
        }
        next
      }

      global_pos <- global_pos + 1L
      q_name <- .sm_api_q_name(global_pos, style = style, upper = FALSE)
      heading <- .sm_api_question_heading(q)
      if (is.na(heading) || !nzchar(heading)) heading <- paste("Pregunta", global_pos)
      subtype <- .sm_or(q$subtype, "")
      validation <- .sm_or(q$validation, list())
      required <- .sm_api_required_value(q, family = fam)
      answers <- .sm_or(q$answers, list())
      rows <- .sm_or(answers$rows, list())
      choices <- .sm_api_question_choices(q)
      list_name <- if (length(choices)) paste0("lst_", q_name) else NA_character_
      if (length(choices)) {
        for (ch in choices) add_choice(list_name, ch$code, ch$label)
        labs <- vapply(choices, `[[`, character(1), "code")
        names(labs) <- vapply(choices, `[[`, character(1), "label")
        label_sets[[q_name]] <- labs
      } else {
        label_sets[[q_name]] <- character(0)
      }

      type_final <- "text"
      constraint <- NA_character_
      if (identical(fam, "open_ended")) {
        tc <- .sm_api_type_and_constraint(fam, subtype, validation)
        type_final <- tc$type
        constraint <- tc$constraint
        if (length(rows)) {
          # SurveyMonkey muestra algunas preguntas abiertas como un bloque con
          # varias filas (ej. "Función 1...5"). En XLSForm deben quedar como
          # preguntas hermanas dentro de la página, no como secciones anidadas:
          # el begin_group de la página ya contiene el contexto suficiente.
          for (r_idx in seq_along(rows)) {
            row_label <- .sm_api_clean_text(.sm_or(rows[[r_idx]]$text, NA_character_))
            if (is.na(row_label) || !nzchar(row_label)) row_label <- paste("Respuesta", r_idx)
            row_required <- .sm_api_required_value(q, row_idx = r_idx, row_count = length(rows), family = fam)
            add_survey(type_final, paste0(q_name, "_", r_idx), row_label, row_required, constraint = constraint, section = sec_name)
          }
        } else {
          add_survey(type_final, q_name, heading, required, constraint = constraint, section = sec_name)
        }
      } else if (identical(fam, "single_choice")) {
        type_final <- paste("select_one", list_name)
        add_survey(type_final, q_name, heading, required, section = sec_name)
        other <- .sm_or(answers$other, NULL)
        if (!is.null(other) && isTRUE(.sm_or(other$is_answer_choice, .sm_or(other$visible, FALSE)))) {
          other_label <- .sm_api_clean_text(.sm_or(other$text, NA_character_))
          other_idx <- which(vapply(choices, function(ch) isTRUE(ch$is_other), logical(1)))[1]
          if (!is.na(other_idx) && !is.na(other_label) && nzchar(other_label)) {
            code <- choices[[other_idx]]$code
            add_survey("text", paste0(q_name, "_other"), paste0(other_label, ":"), NA_character_,
              relevant = .sm_other_relevant(q_name, code, parent_type = type_final), section = sec_name)
          }
        }
      } else if (identical(fam, "multiple_choice")) {
        type_final <- paste("select_multiple", list_name)
        add_survey(type_final, q_name, heading, required, section = sec_name)
        other <- .sm_or(answers$other, NULL)
        if (!is.null(other) && isTRUE(.sm_or(other$is_answer_choice, .sm_or(other$visible, FALSE)))) {
          other_label <- .sm_api_clean_text(.sm_or(other$text, NA_character_))
          other_idx <- which(vapply(choices, function(ch) isTRUE(ch$is_other), logical(1)))[1]
          if (!is.na(other_idx) && !is.na(other_label) && nzchar(other_label)) {
            code <- choices[[other_idx]]$code
            add_survey("text", paste0(q_name, "_other"), paste0(other_label, ":"), NA_character_,
              relevant = .sm_other_relevant(q_name, code, parent_type = type_final), section = sec_name)
          }
        }
      } else if (identical(fam, "matrix")) {
        type_final <- paste("select_one", list_name)
        single_scale <- !length(rows) || (
          length(rows) == 1L &&
            !nzchar(.sm_api_clean_text(.sm_or(rows[[1]]$text, NA_character_)) %||% "")
        )
        if (single_scale) {
          # SM representa algunas preguntas de escala como matriz de una fila.
          # En XLSForm se entiende mejor como una pregunta select_one normal:
          # p32 = "¿Cuán satisfecho...?", no p32_1 = "Ítem 1".
          add_survey(type_final, q_name, heading, required, section = sec_name)
        } else {
          # Matriz real: enunciado como nota y cada afirmación como select_one
          # hermana dentro de la misma página.
          add_survey("note", paste0("nota_", q_name), heading, section = sec_name)
          for (r_idx in seq_along(rows)) {
            row_label <- .sm_api_clean_text(.sm_or(rows[[r_idx]]$text, NA_character_))
            if (is.na(row_label) || !nzchar(row_label)) row_label <- paste("Fila", r_idx)
            add_survey(type_final, paste0(q_name, "_", r_idx), row_label, required, section = sec_name)
          }
        }
      } else {
        add_survey("text", q_name, heading, required, section = sec_name)
      }

      vars_rows[[length(vars_rows) + 1L]] <- tibble::tibble(
        name_raw = q_name,
        name_clean = q_name,
        group_guess = q_name,
        kind_guess = fam,
        suffix = NA_character_
      )
      add_diag(global_pos, q_name, heading, fam, subtype, type_final, list_name, sec_name)
    }
    add_survey("end_group", NA_character_, NA_character_)
  }

  title <- .sm_first_nonempty(.sm_or(details$title, NA_character_), fallback = "SurveyMonkey")
  settings <- tibble::tibble(
    form_title = title,
    form_id = .sm_safe_slug(title),
    default_language = lang,
    version = format(Sys.Date(), "%Y%m%d")
  )

  survey <- if (length(survey_rows)) dplyr::bind_rows(survey_rows) else tibble::tibble(
    type = character(), name = character(), `label::es` = character(), required = character(),
    relevant = character(), constraint = character(), calculation = character(),
    choice_filter = character(), section = character()
  )
  choices <- if (length(choice_rows)) dplyr::bind_rows(choice_rows) else tibble::tibble(
    list_name = character(), name = character(), `label::es` = character()
  )
  diagnostico <- if (length(diag_rows)) dplyr::bind_rows(diag_rows) else tibble::tibble()
  sm_logic <- list(
    vars_tbl = if (length(vars_rows)) dplyr::bind_rows(vars_rows) else tibble::tibble(name_raw = character(), name_clean = character()),
    label_sets = label_sets
  )

  spec_raw <- list(
    survey = survey,
    choices = choices,
    settings = settings,
    diagnostico = diagnostico
  )
  spec <- .sm_apply_remap_to_spec(spec_raw)
  spec$survey <- .sm_api_normalize_generated_note_names(spec$survey)
  spec$survey <- .sm_logic_normalize_final_expr_refs(spec$survey)

  sm_logic$name_remap <- spec$name_remap %||% character(0)
  sm_logic$page_remap <- spec$page_remap %||% character(0)

  structure(
    list(
      survey = spec$survey,
      choices = spec$choices,
      settings = settings,
      diagnostico = spec$diagnostico,
      sm_logic = sm_logic
    ),
    class = "prosecnur_surveymonkey_xlsform"
  )
}

.sm_api_normalize_generated_note_names <- function(survey) {
  if (is.null(survey) || !nrow(survey) || !"name" %in% names(survey)) return(survey)

  names_chr <- as.character(survey$name)
  is_note <- !is.na(survey$type) & survey$type == "note"
  is_generated <- is_note & !is.na(names_chr) & grepl("^nota_(pag|q)", names_chr, ignore.case = TRUE)
  if (!any(is_generated)) return(survey)

  used <- names_chr[!is.na(names_chr) & nzchar(names_chr)]
  normalize_one <- function(nm, section, idx) {
    out <- nm
    if (grepl("^nota_pag_\\d+_", out, ignore.case = TRUE)) {
      pag <- if (!is.na(section) && nzchar(section)) section else sub("^nota_pag_(\\d+)_.*$", "Pag\\1", out)
      out <- sub("^nota_pag_\\d+_", paste0("nota_", pag, "_"), out, ignore.case = TRUE)
    }
    if (grepl("^nota_[Qq]0*[0-9]+", out, perl = TRUE)) {
      n <- suppressWarnings(as.integer(sub("^nota_[Qq]0*([0-9]+).*$", "\\1", out, perl = TRUE)))
      if (!is.na(n)) out <- sub("^nota_[Qq]0*[0-9]+", paste0("nota_p", n), out, perl = TRUE)
    }
    out <- janitor::make_clean_names(out)
    out <- .sm_unique_name(out, used = setdiff(used, nm), suffix = "note")
    used <<- c(setdiff(used, nm), out)
    out
  }

  for (i in which(is_generated)) {
    names_chr[i] <- normalize_one(names_chr[i], as.character(survey$section[i] %||% NA_character_), i)
  }
  survey$name <- names_chr
  survey
}

#' Enriquecer estructura XLSForm con metadata real de SurveyMonkey API.
#'
#' Este paso corrige la mayor debilidad del traductor desde `.sav`: cuando el
#' SPSS no preserva el tipo estructural, la heurística puede convertir
#' respuestas abiertas en `select_one` a partir de valores observados. Con la
#' API conectada, `family/subtype/validation/required` son fuente de verdad.
#'
#' @param xlsform Lista retornada por [surveymonkey_xlsform()].
#' @param details Lista retornada por [sm_api_fetch_survey_details()].
#' @param sm Objeto retornado por [surveymonkey_leer()].
#' @param style Lista `list(prefix, pad)`. Si es `NULL`, se detecta desde `sm`.
#' @return `xlsform` con tipos, labels, required, constraints y choices limpios.
#' @export
sm_api_enrich_xlsform_structure <- function(xlsform, details, sm, style = NULL) {
  if (is.null(xlsform$survey) || !nrow(xlsform$survey)) return(xlsform)
  if (is.null(style)) style <- .sm_detect_naming_style(sm$vars_tbl$name_raw)

  specs <- .sm_api_question_specs(details, style = style)
  if (!nrow(specs)) return(xlsform)

  survey <- as.data.frame(xlsform$survey, stringsAsFactors = FALSE)
  for (col in c("type", "name", "label::es", "required", "constraint")) {
    if (!col %in% names(survey)) survey[[col]] <- NA_character_
  }

  for (i in seq_len(nrow(specs))) {
    spec <- specs[i, , drop = FALSE]
    group <- spec$group_guess[1]
    heading <- spec$heading[1]
    family <- spec$family[1]
    subtype <- spec$subtype[1]
    validation <- spec$validation[[1]]
    row_labels <- spec$row_labels[[1]]

    exact_idx <- which(survey$name == group)
    child_idx <- grep(paste0("^", group, "_"), survey$name %||% character(0))
    group_idx <- which(survey$name == paste0("grp_", group))
    target_idx <- unique(c(exact_idx, child_idx))

    if (length(group_idx) && !is.na(heading) && nzchar(heading)) {
      survey$`label::es`[group_idx] <- heading
    }

    if (identical(family, "open_ended")) {
      tc <- .sm_api_type_and_constraint(family, subtype, validation)
      if (length(exact_idx)) {
        survey$type[exact_idx] <- tc$type
        if (!is.na(heading) && nzchar(heading)) survey$`label::es`[exact_idx] <- heading
        survey$constraint[exact_idx] <- tc$constraint
      } else if (length(child_idx)) {
        survey$type[child_idx] <- tc$type
        if (length(row_labels) == length(child_idx)) {
          survey$`label::es`[child_idx] <- row_labels
        }
        survey$constraint[child_idx] <- tc$constraint
      }
    } else {
      if (length(exact_idx) && !is.na(heading) && nzchar(heading)) {
        survey$`label::es`[exact_idx] <- heading
      }
      if (length(child_idx) && length(row_labels) == length(child_idx)) {
        survey$`label::es`[child_idx] <- row_labels
      }
    }

    if (isTRUE(spec$required[1]) && length(target_idx)) {
      if (identical(family, "open_ended") && !length(exact_idx) && length(child_idx) > 1L) {
        survey$required[child_idx] <- NA_character_
        survey$required[child_idx[1]] <- "yes"
      } else {
        survey$required[target_idx] <- "yes"
      }
    }
  }

  xlsform$survey <- tibble::as_tibble(survey)
  xlsform$survey <- .sm_api_insert_presentation_notes(xlsform$survey, details, style = style)
  xlsform <- sm_api_enrich_xlsform_choices(xlsform, details, sm, style = style)
  xlsform <- .sm_api_apply_other_relevance(xlsform, details, sm, style = style)
  xlsform$choices <- .sm_api_prune_unreferenced_choices(xlsform$survey, xlsform$choices)
  xlsform
}

.sm_api_insert_presentation_notes <- function(survey, details, style = NULL) {
  pages <- sm_api_extract_pages(details, style = style)
  if (!length(pages) || is.null(survey) || !nrow(survey)) return(survey)
  survey <- as.data.frame(survey, stringsAsFactors = FALSE)
  template <- survey[0, , drop = FALSE]
  out <- list()

  for (i in seq_len(nrow(survey))) {
    out[[length(out) + 1L]] <- survey[i, , drop = FALSE]
    if (!identical(survey$type[i], "begin_group")) next
    sec <- as.character(survey$name[i])
    if (!grepl("^section_pag_", sec)) next
    page_id <- sub("^section_pag_", "", sec)
    page <- pages[[which(vapply(pages, `[[`, character(1), "page_id") == page_id)[1]]]
    if (is.null(page) || !length(page$notes)) next
    notes <- page$notes[!is.na(page$notes) & nzchar(page$notes)]
    if (!length(notes)) next
    for (j in seq_along(notes)) {
      row <- template[1, , drop = FALSE]
      row[] <- NA_character_
      row$type <- "note"
      row$name <- .sm_unique_name(paste0("nota_pag_", page_id, "_", j), survey$name, suffix = "note")
      row$`label::es` <- notes[j]
      if ("section" %in% names(row)) row$section <- sec
      out[[length(out) + 1L]] <- row
    }
  }
  tibble::as_tibble(dplyr::bind_rows(out))
}

.sm_api_apply_other_relevance <- function(xlsform, details, sm, style = NULL) {
  if (is.null(xlsform$survey) || !nrow(xlsform$survey)) return(xlsform)
  if (is.null(style)) style <- .sm_detect_naming_style(sm$vars_tbl$name_raw)
  specs <- .sm_api_question_specs(details, style = style)
  survey <- as.data.frame(xlsform$survey, stringsAsFactors = FALSE)
  choices <- as.data.frame(xlsform$choices, stringsAsFactors = FALSE)
  if (!"relevant" %in% names(survey)) survey$relevant <- NA_character_

  pages <- .sm_or(details$pages, list())
  q_idx <- 0L
  for (page in pages) {
    for (q in .sm_or(page$questions, list())) {
      if (identical(.sm_or(q$family, ""), "presentation")) next
      q_idx <- q_idx + 1L
      other <- .sm_or(.sm_or(q$answers, list())$other, NULL)
      if (is.null(other) || !isTRUE(.sm_or(other$is_answer_choice, FALSE))) next
      spec <- specs[q_idx, , drop = FALSE]
      group <- spec$group_guess[1]
      other_label <- .sm_api_clean_text(.sm_or(other$text, NA_character_))
      name_remap <- if (!is.null(xlsform$name_remap)) xlsform$name_remap else character(0)
      remapped_group <- if (group %in% names(name_remap)) name_remap[[group]] else NA_character_
      group_candidates <- unique(c(group, remapped_group, .sm_qp_variants(toupper(group), style)))
      group_candidates <- group_candidates[!is.na(group_candidates) & nzchar(group_candidates)]
      group_name <- group_candidates[group_candidates %in% survey$name][1]
      if (is.na(group_name) || !nzchar(group_name)) next
      other_row <- which(survey$name == paste0(group_name, "_other"))[1]
      parent_row <- which(survey$name == group_name)[1]
      if (is.na(other_row) || is.na(parent_row) || is.na(other_label) || !nzchar(other_label)) next
      parent_type <- survey$type[parent_row]
      list_name <- sub("^(select_one|select_multiple)\\s+", "", parent_type)
      ch <- choices[choices$list_name == list_name, , drop = FALSE]
      code <- ch$name[which(tolower(trimws(ch$`label::es`)) == tolower(trimws(other_label)))[1]]
      if (is.na(code) || !nzchar(code)) next
      other_relevant <- .sm_other_relevant(group_name, code, parent_type = parent_type)
      survey$relevant[other_row] <- .sm_combine_relevant(
        survey$relevant[other_row],
        survey$relevant[parent_row],
        other_relevant
      )
    }
  }

  xlsform$survey <- tibble::as_tibble(survey)
  xlsform
}

.sm_api_prune_unreferenced_choices <- function(survey, choices) {
  if (is.null(choices) || !nrow(choices) || !"list_name" %in% names(choices)) return(choices)
  if (is.null(survey) || !nrow(survey) || !"type" %in% names(survey)) return(choices)
  list_names <- unique(trimws(sub("^(select_one|select_multiple)\\s+", "", survey$type[
    grepl("^(select_one|select_multiple)\\s+", survey$type %||% "")
  ])))
  list_names <- list_names[nzchar(list_names) & !is.na(list_names)]
  choices[choices$list_name %in% list_names, , drop = FALSE]
}

.sm_api_q_ref_to_group <- function(q_ref, style) {
  m <- regmatches(q_ref, regexec(perl = TRUE, "^[QPqp]([0-9]+)$", q_ref))[[1]]
  if (length(m) != 2L) return(.sm_safe_slug(tolower(q_ref))[1])
  num <- as.integer(m[2])
  prefix <- .sm_or(style$prefix, "p")
  pad <- as.integer(.sm_or(style$pad, 0L))
  raw <- if (pad <= 1L) {
    paste0(prefix, num)
  } else {
    paste0(prefix, formatC(num, width = pad, flag = "0", format = "d"))
  }
  .sm_safe_slug(raw)[1]
}

# Construye mapeo group_guess → "Q{N padded}" siguiendo el mismo orden
# que `sm_api_extract_paginas` usaría. Tolera vars_tbl mínimos (sin
# columnas group_guess/is_metadata/is_other) — en ese caso, name_raw
# actúa como group_guess y se asume que ninguna fila es metadata/other.
.sm_build_group_to_qref <- function(vars_tbl, style = NULL) {
  out <- character(0)
  if (is.null(vars_tbl) || !nrow(vars_tbl)) return(out)
  pad <- if (!is.null(style) && !is.null(style$pad)) as.integer(style$pad) else 0L
  cols <- names(vars_tbl)
  has_group <- "group_guess" %in% cols
  has_meta <- "is_metadata" %in% cols
  has_other <- "is_other" %in% cols

  seen <- character(0)
  global_pos <- 0L
  for (i in seq_len(nrow(vars_tbl))) {
    if (has_meta && isTRUE(vars_tbl$is_metadata[i])) next
    if (has_other && isTRUE(vars_tbl$is_other[i])) next
    grp <- if (has_group) as.character(vars_tbl$group_guess[i]) else as.character(vars_tbl$name_raw[i])
    if (is.null(grp) || length(grp) == 0L) next
    if (is.na(grp) || !nzchar(grp)) next
    if (grp %in% seen) next
    seen <- c(seen, grp)
    global_pos <- global_pos + 1L
    qn <- if (pad <= 1L) sprintf("Q%d", global_pos)
          else sprintf("Q%s", formatC(global_pos, width = pad, flag = "0", format = "d"))
    out[grp] <- qn
  }
  out
}

# Construye mapeo name_raw → q_ref usando el group_to_qref previo.
.sm_build_raw_to_qref <- function(vars_tbl, group_to_qref) {
  out <- character(0)
  if (is.null(vars_tbl) || !nrow(vars_tbl)) return(out)
  cols <- names(vars_tbl)
  has_group <- "group_guess" %in% cols
  for (i in seq_len(nrow(vars_tbl))) {
    raw <- as.character(vars_tbl$name_raw[i])
    grp <- if (has_group) as.character(vars_tbl$group_guess[i]) else raw
    if (is.null(grp) || length(grp) == 0L || is.na(grp) || !nzchar(grp)) next
    qref <- group_to_qref[[grp]]
    if (!is.null(qref) && !is.na(qref)) out[raw] <- qref
  }
  out
}

#' Extrae los labels de las choices de cada pregunta del response API,
#' indexando por la `Q{N}` que `sm_api_extract_paginas` les asignaría.
#'
#' Devuelve representación "long": un vector `q_ref` y otro `choice_label`
#' del mismo largo, para hacer joins con el XLSForm que ya tenemos
#' (donde cada catálogo está mapeado a un `group_guess` que matchea el q_ref).
#'
#' @param details Lista del response /surveys/{id}/details.
#' @param style Lista `list(prefix, pad)` de la convención intermedia para referencias `Q`.
#' @return Lista con `q_ref` (chr) y `choice_label` (chr), del mismo largo.
#' @export
sm_api_extract_choice_labels <- function(details, style = NULL) {
  pages <- .sm_or(details$pages, list())
  pad <- if (!is.null(style) && !is.null(style$pad)) as.integer(style$pad) else 0L

  q_ref <- character(0)
  choice_label <- character(0)
  global_pos <- 0L

  for (page in pages) {
    questions <- .sm_or(page$questions, list())
    for (q in questions) {
      fam <- .sm_or(q$family, "")
      if (identical(fam, "presentation")) next
      global_pos <- global_pos + 1L
      qn <- if (pad <= 1L) {
        sprintf("Q%d", global_pos)
      } else {
        sprintf("Q%s", formatC(global_pos, width = pad, flag = "0", format = "d"))
      }
      choices <- .sm_or(q$answers$choices, list())
      if (!length(choices)) next
      for (ch in choices) {
        text <- .sm_or(ch$text, NA_character_)
        if (is.na(text)) next
        q_ref <- c(q_ref, qn)
        choice_label <- c(choice_label, text)
      }
    }
  }

  list(q_ref = q_ref, choice_label = choice_label)
}

#' Reemplaza las etiquetas (`label::es`) de los catálogos del XLSForm con
#' las que trae la API SurveyMonkey, sin tocar los `name` (códigos).
#'
#' Resuelve el bug "uba/uba_2" — cuando la pregunta era texto libre y el
#' traductor inventó codes desde los valores observados, los labels son
#' slugs feos. Si la API trae las choices reales, las usamos como labels
#' manteniendo los codes existentes (para no romper la consistencia con
#' los datos del .sav).
#'
#' Match: cada lista del XLSForm se relaciona con su pregunta vía
#' `xlsform$diagnostico$group_guess` + `list_name_final`. Si la cantidad
#' de choices NO coincide, la lista se salta (potencial mismatch).
#'
#' @param xlsform Lista con `survey`/`choices`/`diagnostico` (el que devuelve
#'   `surveymonkey_xlsform`).
#' @param details Response de la API.
#' @param sm Objeto del `surveymonkey_leer` (necesario para el style).
#' @param style Estilo precomputado, o NULL para detectarlo desde sm.
#' @return Lista con el `xlsform` modificado + `api_enrichment` con stats.
#' @export
sm_api_enrich_xlsform_choices <- function(xlsform, details, sm, style = NULL) {
  if (is.null(style)) {
    style <- .sm_detect_naming_style(.sm_or(sm$vars_tbl$name_raw, character(0)))
  }
  labels_long <- sm_api_extract_choice_labels(details, style = style)

  choices_df <- as.data.frame(xlsform$choices, stringsAsFactors = FALSE)
  diag_df <- as.data.frame(xlsform$diagnostico, stringsAsFactors = FALSE)

  relabelled_lists <- 0L
  skipped_mismatch <- 0L

  if (!nrow(choices_df) || !nrow(diag_df)) {
    xlsform$api_enrichment <- list(
      choices_relabelled_lists = relabelled_lists,
      choices_skipped_mismatch = skipped_mismatch
    )
    return(xlsform)
  }

  # Mapear cada list_name del XLSForm a su pregunta (group_guess) usando
  # el diagnostico técnico que ya construimos.
  list_to_group <- stats::setNames(
    diag_df$group_guess[!is.na(diag_df$list_name_final) & nzchar(diag_df$list_name_final)],
    diag_df$list_name_final[!is.na(diag_df$list_name_final) & nzchar(diag_df$list_name_final)]
  )
  list_to_group <- list_to_group[!duplicated(names(list_to_group))]

  # Mapear cada group_guess al q_ref que la API asignó (por posición global).
  group_to_qref <- .sm_build_group_to_qref(sm$vars_tbl, style)

  # Recorrer cada list_name único en choices y relabel si calza.
  list_names_unique <- unique(choices_df$list_name)
  for (lst in list_names_unique) {
    if (is.na(lst) || !nzchar(lst)) next
    grp <- list_to_group[[lst]]
    if (is.null(grp) || is.na(grp)) next
    qref <- group_to_qref[[grp]]
    if (is.null(qref) || is.na(qref)) next

    api_labels <- labels_long$choice_label[labels_long$q_ref == qref]
    rows_idx <- which(choices_df$list_name == lst)
    if (length(api_labels) != length(rows_idx)) {
      skipped_mismatch <- skipped_mismatch + 1L
      next
    }
    choices_df[["label::es"]][rows_idx] <- api_labels
    relabelled_lists <- relabelled_lists + 1L
  }

  xlsform$choices <- tibble::as_tibble(choices_df)
  xlsform$api_enrichment <- list(
    choices_relabelled_lists = relabelled_lists,
    choices_skipped_mismatch = skipped_mismatch
  )
  xlsform
}

#' Usa la API SurveyMonkey como fuente de verdad para preguntas abiertas:
#' cambia `type` (open_ended → integer/text), reescribe `label::es` con el
#' prompt original (`headings[0].heading`), llena `required` y construye
#' `constraint` desde `validation`.
#'
#' Cubre los casos típicos donde el .sav engaña al traductor heurístico:
#' una pregunta de "Edad" llega como texto libre con valores únicos
#' ("18", "25", ...) y la heurística la convierte en `select_one` con
#' codes inventados. La API dice que es `open_ended/numerical` con
#' validation 18-100 — la respetamos.
#'
#' Limpia los catálogos que dejaron de usarse después del cambio de tipo.
#'
#' @param xlsform Lista con `survey`/`choices`/`diagnostico`.
#' @param details Response de la API.
#' @param sm Objeto del `surveymonkey_leer`.
#' @param style Estilo precomputado, o NULL.
#' @return xlsform modificado.
#' @export
sm_api_enrich_xlsform_structure <- function(xlsform, details, sm, style = NULL) {
  if (is.null(style)) {
    style <- .sm_detect_naming_style(.sm_or(sm$vars_tbl$name_raw, character(0)))
  }
  pad <- if (!is.null(style$pad)) as.integer(style$pad) else 0L
  pages <- .sm_or(details$pages, list())

  # Mapear q_ref -> info enriquecida de la API
  api_info <- list()
  global_pos <- 0L
  for (page in pages) {
    questions <- .sm_or(page$questions, list())
    for (q in questions) {
      fam <- .sm_or(q$family, "")
      if (identical(fam, "presentation")) next
      global_pos <- global_pos + 1L
      qn <- if (pad <= 1L) sprintf("Q%d", global_pos)
            else sprintf("Q%s", formatC(global_pos, width = pad, flag = "0", format = "d"))
      api_info[[qn]] <- list(
        family = fam,
        subtype = .sm_or(q$subtype, NA_character_),
        heading = .sm_or(q$headings[[1]]$heading, NA_character_),
        required = .sm_api_is_required(q),
        validation = if (!is.null(q$validation) && length(q$validation) > 0L) q$validation else NULL
      )
    }
  }

  # Mapear group_guess y name_raw a q_ref. Para vars_tbl mínimos (solo
  # name_raw), name_raw == group_guess.
  group_to_qref <- .sm_build_group_to_qref(sm$vars_tbl, style)
  raw_to_qref <- .sm_build_raw_to_qref(sm$vars_tbl, group_to_qref)

  survey_df <- as.data.frame(xlsform$survey, stringsAsFactors = FALSE)
  choices_df <- as.data.frame(xlsform$choices, stringsAsFactors = FALSE)
  if (!"required" %in% names(survey_df)) survey_df$required <- NA_character_
  if (!"constraint" %in% names(survey_df)) survey_df$constraint <- NA_character_
  used_lists <- character(0)

  # Detectar lista asociada a un type (ej. "select_one lst_q0001" → "lst_q0001")
  list_from_type <- function(type_str) {
    m <- regmatches(type_str, regexec(perl = TRUE, "^select_(?:one|multiple)\\s+(\\S+)", type_str))[[1]]
    if (length(m) == 2L) m[2] else NA_character_
  }
  qref_for_name <- function(name) {
    name <- as.character(name)[1]
    if (is.na(name) || !nzchar(name)) return(NULL)
    if (name %in% names(raw_to_qref)) return(raw_to_qref[[name]])
    for (grp in names(group_to_qref)) {
      candidates <- unique(c(grp, .sm_qp_variants(toupper(grp), style)))
      candidates <- candidates[!is.na(candidates) & nzchar(candidates)]
      if (name %in% candidates) return(group_to_qref[[grp]])
    }
    NULL
  }
  required_open_seen <- new.env(parent = emptyenv())

  for (i in seq_len(nrow(survey_df))) {
    name <- as.character(survey_df$name[i])
    if (!is.na(name) && grepl("_other$", name)) next
    qref <- qref_for_name(name)
    if (is.null(qref) || is.na(qref)) {
      # No hay match con la API → preservar tipo y lista
      lst <- list_from_type(as.character(survey_df$type[i]))
      if (!is.na(lst)) used_lists <- c(used_lists, lst)
      next
    }
    info <- api_info[[qref]]
    if (is.null(info)) next

    is_open <- identical(info$family, "open_ended")
    if (is_open) {
      vt <- info$validation
      vt_type <- if (!is.null(vt)) .sm_or(vt$type, NA_character_) else NA_character_
      new_type <- "text"
      if (!is.na(vt_type) && vt_type %in% c("integer")) new_type <- "integer"
      if (!is.na(vt_type) && vt_type %in% c("decimal")) new_type <- "decimal"
      survey_df$type[i] <- new_type
      if (!is.na(info$heading)) survey_df[["label::es"]][i] <- info$heading
      if (info$required) {
        if (isTRUE(required_open_seen[[qref]])) {
          survey_df$required[i] <- NA_character_
        } else {
          survey_df$required[i] <- "yes"
          required_open_seen[[qref]] <- TRUE
        }
      }
      # Constraint
      cons <- NA_character_
      if (!is.null(vt)) {
        mn <- .sm_or(vt$min, NA_character_)
        mx <- .sm_or(vt$max, NA_character_)
        if (!is.na(vt_type) && vt_type %in% c("integer", "decimal")) {
          parts <- character(0)
          if (!is.na(mn)) parts <- c(parts, sprintf(". >= %s", mn))
          if (!is.na(mx)) parts <- c(parts, sprintf(". <= %s", mx))
          if (length(parts)) cons <- paste(parts, collapse = " and ")
        } else if (!is.na(vt_type) && vt_type == "email") {
          cons <- "regex(., '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\\\.[A-Za-z]{2,}$')"
        } else if (!is.na(vt_type) && vt_type == "regex") {
          rx <- .sm_or(vt$text, NA_character_)
          if (!is.na(rx)) cons <- sprintf("regex(., '%s')", rx)
        }
      }
      if (!is.na(cons)) survey_df$constraint[i] <- cons
    } else {
      # No es open_ended → preservar; la lista de choices sigue en uso si la había.
      lst <- list_from_type(as.character(survey_df$type[i]))
      if (!is.na(lst)) used_lists <- c(used_lists, lst)
      if (info$required) survey_df$required[i] <- "yes"
      if (!is.na(info$heading)) survey_df[["label::es"]][i] <- info$heading
    }
  }

  # Limpiar choices que ya no se referencian.
  if (nrow(choices_df)) {
    choices_df <- choices_df[choices_df$list_name %in% used_lists, , drop = FALSE]
  }

  xlsform$survey <- tibble::as_tibble(survey_df)
  xlsform$choices <- tibble::as_tibble(choices_df)
  xlsform <- .sm_api_apply_other_relevance(xlsform, details, sm, style = style)
  xlsform$choices <- .sm_api_prune_unreferenced_choices(xlsform$survey, xlsform$choices)
  xlsform
}

#' Calcula un resumen de lo que la API trae para mostrar al usuario antes
#' de aplicar el mapeo (qué se rescata vs. qué seguirá manual).
#'
#' @param details Lista retornada por [sm_api_fetch_survey_details()].
#' @return Lista con `n_paginas`, `n_preguntas` (excluyendo presentation),
#'   `title`, `language`, `tiene_required` (logical), `tiene_validation` (logical).
#' @export
sm_api_summary <- function(details) {
  pages <- .sm_or(details$pages, list())
  n_preg <- 0L
  n_required <- 0L
  n_validation <- 0L
  for (page in pages) {
    questions <- .sm_or(page$questions, list())
    for (q in questions) {
      fam <- .sm_or(q$family, "")
      if (identical(fam, "presentation")) next
      n_preg <- n_preg + 1L
      if (!is.null(q$required) && length(q$required) > 0L) n_required <- n_required + 1L
      if (!is.null(q$validation) && length(q$validation) > 0L) n_validation <- n_validation + 1L
    }
  }
  list(
    title = .sm_or(details$title, NA_character_),
    language = .sm_or(details$language, NA_character_),
    n_paginas = length(pages),
    n_preguntas = n_preg,
    n_required = n_required,
    n_validation = n_validation
  )
}
