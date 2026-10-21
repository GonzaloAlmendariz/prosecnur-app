# =============================================================================
# Material de campo › Correos › «Actualizar quién respondió» (Mailchimp)
#
# Mailchimp no sabe quién terminó la encuesta: el enlace es un recopilador web
# de SurveyMonkey con la variable `t` (token aleatorio por persona). Para que un
# recordatorio llegue solo a quien no respondió, esta pieza:
#
#   1. lee las respuestas de la encuesta en SurveyMonkey (`custom_variables$t`);
#   2. cruza cada token con los destinatarios de la campaña (el token va dentro
#      del enlace personal, `?t=...`, en alguno de sus campos);
#   3. pone una etiqueta («Respondió» por defecto) a esos correos en la
#      audiencia de Mailchimp, por su API.
#
# En Mailchimp, el recordatorio se envía al segmento «no tiene la etiqueta
# Respondió». La etiqueta de Mailchimp es un segmento estático: se agrega en
# lotes de 500 correos con `members_to_add`, sin una llamada por persona.
#
# La clave de Mailchimp vive en el almacén de secretos (`mailchimp_key`), fuera
# del .pulso, como las de SurveyMonkey y Kobo. Nada de esto devuelve correos a
# la UI: solo conteos.
# =============================================================================

.MC_TAG_DEFAULT <- "Respondió"
.MC_BATCH <- 500L
.MC_KEY_RE <- "^[0-9a-f]{32}-[a-z]{2,4}[0-9]{1,3}$"

# Datacenter de la clave: «…-us21» → «us21». La API vive en ese subdominio.
.mc_dc <- function(key) {
  key <- trimws(as.character(key %||% "")[1])
  if (!grepl(.MC_KEY_RE, key)) {
    stop_api(400, "E_MAILCHIMP_TOKEN",
             "La clave de Mailchimp no tiene la forma esperada (32 caracteres, un guion y el servidor, por ejemplo «…-us21»).")
  }
  sub("^.*-", "", key)
}

#' Una llamada HTTP a la API de Mailchimp. Aislada para poder reemplazarla en
#' los tests (sin red).
#' @keywords internal
.mc_http <- function(method, url, key, body = NULL) {
  h <- curl::new_handle()
  curl::handle_setopt(h, customrequest = method, userpwd = paste0("prosecnur:", key), httpauth = 1L,
                      timeout = 60L, connecttimeout = 15L)
  if (!is.null(body)) {
    curl::handle_setheaders(h, "Content-Type" = "application/json")
    curl::handle_setopt(h, copypostfields = jsonlite::toJSON(body, auto_unbox = TRUE))
  }
  res <- curl::curl_fetch_memory(url, handle = h)
  txt <- rawToChar(res$content); Encoding(txt) <- "UTF-8"
  list(status = res$status_code, body = if (nzchar(txt)) jsonlite::fromJSON(txt, simplifyVector = FALSE) else list())
}

.mc_call <- function(method, path, key, body = NULL, query = list()) {
  url <- sprintf("https://%s.api.mailchimp.com/3.0%s", .mc_dc(key), path)
  if (length(query)) {
    url <- paste0(url, "?", paste(names(query), vapply(query, function(v) utils::URLencode(as.character(v), reserved = TRUE), ""),
                                  sep = "=", collapse = "&"))
  }
  res <- tryCatch(.mc_http(method, url, key, body),
                  error = function(e) stop_api(502, "E_MAILCHIMP_API", paste("No se pudo conectar con Mailchimp:", conditionMessage(e))))
  if (res$status %in% c(401L, 403L)) {
    stop_api(400, "E_MAILCHIMP_TOKEN", "Mailchimp rechazó la clave: revisa que esté vigente y completa.")
  }
  if (res$status >= 400L) {
    detalle <- as.character(res$body$detail %||% res$body$title %||% "")[1]
    detalle <- gsub("[^[:space:]]+@[^[:space:]]+", "[correo]", detalle)  # nunca un correo hacia la UI
    stop_api(502, "E_MAILCHIMP_API", sprintf("Mailchimp respondió con un error (HTTP %d). %s", res$status, detalle))
  }
  res$body
}

#' Comprueba la clave contra Mailchimp. @keywords internal
mailchimp_api_ping <- function(key) {
  .mc_call("GET", "/ping", key)
  list(ok = TRUE, provider = "mailchimp", status_code = 200L)
}

#' Audiencias de la cuenta: id, nombre y contactos. @keywords internal
mailchimp_api_lists <- function(key) {
  body <- .mc_call("GET", "/lists", key, query = list(count = 100, fields = "lists.id,lists.name,lists.stats.member_count"))
  lapply(body$lists %||% list(), function(l) list(
    id = as.character(l$id), name = as.character(l$name %||% ""),
    member_count = as.integer(l$stats$member_count %||% NA_integer_)
  ))
}

# Id de la etiqueta (segmento estático) por nombre; la crea si no existe.
.mc_tag_id <- function(key, list_id, tag) {
  body <- .mc_call("GET", sprintf("/lists/%s/segments", list_id), key,
                   query = list(type = "static", count = 1000, fields = "segments.id,segments.name"))
  for (s in body$segments %||% list()) if (identical(as.character(s$name), tag)) return(as.character(s$id))
  created <- .mc_call("POST", sprintf("/lists/%s/segments", list_id), key, body = list(name = tag, static_segment = list()))
  as.character(created$id)
}

# Agrega correos a la etiqueta en lotes. Devuelve cuántos quedaron etiquetados y
# cuántos no están en la audiencia (Mailchimp no los crea por esta vía).
.mc_tag_emails <- function(key, list_id, tag_id, emails) {
  added <- 0L; not_found <- 0L
  if (!length(emails)) return(list(added = 0L, not_in_audience = 0L))
  for (chunk in split(emails, ceiling(seq_along(emails) / .MC_BATCH))) {
    body <- .mc_call("POST", sprintf("/lists/%s/segments/%s", list_id, tag_id), key,
                     body = list(members_to_add = as.list(unname(chunk))))
    added <- added + as.integer(body$total_added %||% 0L)
    not_found <- not_found + length(body$errors %||% list()) + length(body$members_not_found %||% list())
  }
  list(added = added, not_in_audience = not_found)
}

# Token de la variable `t` dentro de un texto con un enlace («…/r/ABC?t=xyz»).
.mc_token_of <- function(x) {
  x <- as.character(x %||% "")
  m <- regmatches(x, regexpr("[?&]t=[A-Za-z0-9_-]{4,}", x))
  if (!length(m)) return(NA_character_)
  sub("^[?&]t=", "", m[[1]])
}

# token → correo, a partir de los destinatarios importados en la campaña.
.mc_token_index <- function(store, template) {
  resolved <- .cmail_recipients_resolve(store, template)
  cols <- unlist(store$mapping$fields %||% list(), use.names = FALSE)
  idx <- character()
  for (i in resolved$rows) {
    for (col in cols) {
      t <- .mc_token_of(store$rows[[col]][[i]])
      if (!is.na(t)) { idx[[t]] <- tolower(resolved$email[[i]]); break }
    }
  }
  list(index = idx, recipients = length(resolved$rows))
}

#' Cruza las respuestas de SurveyMonkey con la campaña y etiqueta en Mailchimp a
#' quien respondió.
#'
#' @param survey_id encuesta de SurveyMonkey cuyas respuestas traen la variable `t`.
#' @param list_id audiencia de Mailchimp donde están los destinatarios.
#' @param dry_run TRUE cuenta sin tocar Mailchimp.
#' @keywords internal
collection_mail_mailchimp_sync <- function(sid, campaign_id = NULL, survey_id, list_id, tag = .MC_TAG_DEFAULT,
                                           dry_run = FALSE) {
  session <- session_get(sid)
  ct <- .cmail_campaign_template_for_session(session, campaign_id)
  survey_id <- trimws(as.character(survey_id %||% "")[1])
  list_id <- trimws(as.character(list_id %||% "")[1])
  tag <- trimws(as.character(tag %||% .MC_TAG_DEFAULT)[1]); if (!nzchar(tag)) tag <- .MC_TAG_DEFAULT
  if (!nzchar(survey_id)) stop_api(422, "E_COLLECTION_MAIL_SYNC_INPUT", "Elige la encuesta de SurveyMonkey.")
  if (!isTRUE(dry_run) && !nzchar(list_id)) stop_api(422, "E_COLLECTION_MAIL_SYNC_INPUT", "Elige la audiencia de Mailchimp.")

  store <- .cmail_recipients_load(session, ct$campaign_id)
  if (is.null(store)) {
    stop_api(409, "E_COLLECTION_MAIL_SYNC_NO_RECIPIENTS",
             "Importa primero los destinatarios de la campaña: de ahí sale el token de cada persona.")
  }
  ti <- .mc_token_index(store, ct$template)
  if (!length(ti$index)) {
    stop_api(409, "E_COLLECTION_MAIL_SYNC_NO_TOKENS",
             "Ningún destinatario tiene un enlace con «?t=». Revisa que la columna del enlace personal esté asociada a un campo.")
  }

  sm_token <- .connections_token_require("surveymonkey", sid)
  responses <- tryCatch(sm_api_fetch_all_responses_bulk(survey_id, sm_token)$data,
                        error = function(e) stop_api(502, "E_MAILCHIMP_SYNC_SURVEYMONKEY", paste("No se pudieron leer las respuestas de SurveyMonkey:", conditionMessage(e))))
  st <- vapply(responses, function(r) as.character(r$response_status %||% "")[1], "")
  tk <- vapply(responses, function(r) .mc_token_of(paste0("?t=", as.character(r$custom_variables$t %||% "")[1])), "")
  completed <- st == "completed"
  has_token <- !is.na(tk)
  in_campaign <- has_token & tk %in% names(ti$index)
  emails <- unique(unname(ti$index[tk[completed & in_campaign]]))

  out <- list(
    ok = TRUE, campaign_id = ct$campaign_id, survey_id = survey_id, list_id = list_id, tag = tag,
    recipients = ti$recipients, recipients_with_token = length(ti$index),
    responses = length(responses), completed = sum(completed), partial = sum(st == "partial"),
    without_token = sum(!has_token), from_other_campaign = sum(has_token & !in_campaign),
    respondents = length(emails), pending = length(ti$index) - length(emails),
    tagged = 0L, not_in_audience = 0L, dry_run = isTRUE(dry_run),
    synced_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z")
  )
  if (isTRUE(dry_run)) return(out)
  key <- .connections_token_require("mailchimp", sid)
  tag_id <- .mc_tag_id(key, list_id, tag)
  res <- .mc_tag_emails(key, list_id, tag_id, emails)
  out$tagged <- res$added
  out$not_in_audience <- res$not_in_audience
  out
}

#' Lo que la UI necesita para elegir: encuestas de SurveyMonkey y audiencias de
#' Mailchimp, con el estado de cada conexión. @keywords internal
collection_mail_mailchimp_options <- function(sid) {
  sm_state <- .connections_token_state("surveymonkey", sid)
  mc_state <- .connections_token_state("mailchimp", sid)
  surveys <- if (nzchar(sm_state$token)) tryCatch(sm_api_list_surveys(sm_state$token, per_page = 50L), error = function(e) NULL) else NULL
  audiences <- if (nzchar(mc_state$token)) tryCatch(mailchimp_api_lists(mc_state$token), error = function(e) NULL) else NULL
  list(
    ok = TRUE,
    surveymonkey = list(connected = nzchar(sm_state$token), error = nzchar(sm_state$token) && is.null(surveys),
                        surveys = lapply(surveys %||% list(), function(s) s[c("id", "title", "response_count")])),
    mailchimp = list(connected = nzchar(mc_state$token), masked = mc_state$status$masked_token,
                     error = nzchar(mc_state$token) && is.null(audiences), audiences = audiences %||% list())
  )
}
