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
#' los tests (sin red). Devuelve `list(status, body, headers)`; `headers` lleva
#' los nombres en minúscula (basta con `retry-after`).
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
  headers <- tryCatch(curl::parse_headers_list(res$headers), error = function(e) list())
  if (length(headers)) names(headers) <- tolower(names(headers))
  list(status = res$status_code,
       body = if (nzchar(txt)) jsonlite::fromJSON(txt, simplifyVector = FALSE) else list(),
       headers = headers)
}

# Pausa entre reintentos. Aislada para que los tests no esperen.
.mc_sleep <- function(seconds) Sys.sleep(seconds)

# Reintentos (1.1): hasta 4 intentos en total ante un error de red, 429 y
# 500/502/503/504. Espera `retry-after` si Mailchimp lo manda (con tope, para
# no colgar un job por un encabezado raro) y si no 1 s, 2 s y 4 s. Los 4xx de
# contenido (400, 401, 403, 404, 422) no se reintentan: repetirlos da lo mismo.
.MC_ATTEMPTS <- 4L
.MC_RETRY_STATUS <- c(429L, 500L, 502L, 503L, 504L)
.MC_BACKOFF <- c(1, 2, 4)
.MC_RETRY_AFTER_MAX <- 60

.mc_retry_wait <- function(res, attempt) {
  ra <- suppressWarnings(as.numeric(as.character((res$headers %||% list())[["retry-after"]] %||% NA)[1]))
  if (!is.na(ra) && ra >= 0) return(min(ra, .MC_RETRY_AFTER_MAX))
  .MC_BACKOFF[[min(attempt, length(.MC_BACKOFF))]]
}

.mc_call <- function(method, path, key, body = NULL, query = list()) {
  url <- sprintf("https://%s.api.mailchimp.com/3.0%s", .mc_dc(key), path)
  if (length(query)) {
    url <- paste0(url, "?", paste(names(query), vapply(query, function(v) utils::URLencode(as.character(v), reserved = TRUE), ""),
                                  sep = "=", collapse = "&"))
  }
  res <- NULL
  for (attempt in seq_len(.MC_ATTEMPTS)) {
    res <- tryCatch(.mc_http(method, url, key, body), error = function(e) e)
    last <- attempt == .MC_ATTEMPTS
    if (inherits(res, "error")) {
      if (last) {
        stop_api(502, "E_MAILCHIMP_API", paste("No se pudo conectar con Mailchimp:",
                                               gsub("[^[:space:]]+@[^[:space:]]+", "[correo]", conditionMessage(res))))
      }
      .mc_sleep(.MC_BACKOFF[[attempt]])
      next
    }
    if (!last && as.integer(res$status) %in% .MC_RETRY_STATUS) {
      .mc_sleep(.mc_retry_wait(res, attempt))
      next
    }
    break
  }
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

# Id de la etiqueta (segmento estático) por nombre. Con `create = TRUE` la crea
# si no existe; con `create = FALSE` devuelve NULL.
.mc_tag_id <- function(key, list_id, tag, create = TRUE) {
  body <- .mc_call("GET", sprintf("/lists/%s/segments", list_id), key,
                   query = list(type = "static", count = 1000, fields = "segments.id,segments.name"))
  for (s in body$segments %||% list()) if (identical(as.character(s$name), tag)) return(as.character(s$id))
  if (!isTRUE(create)) return(NULL)
  created <- .mc_call("POST", sprintf("/lists/%s/segments", list_id), key, body = list(name = tag, static_segment = list()))
  as.character(created$id)
}

# «1,500 de 45,078»: el avance de un lote, con separador de miles.
.mc_progress_label <- function(done, total) {
  fmt <- function(x) formatC(as.integer(x), big.mark = ",", format = "d")
  sprintf("Mailchimp: %s de %s", fmt(done), fmt(total))
}

# Agrega correos a la etiqueta en lotes. Devuelve cuántos quedaron etiquetados y
# cuántos no están en la audiencia (Mailchimp no los crea por esta vía).
# `report(done, total)` recibe el avance por lote.
.mc_tag_emails <- function(key, list_id, tag_id, emails, report = NULL) {
  added <- 0L; not_found <- 0L; done <- 0L
  if (!length(emails)) return(list(added = 0L, not_in_audience = 0L))
  for (chunk in split(emails, ceiling(seq_along(emails) / .MC_BATCH))) {
    body <- .mc_call("POST", sprintf("/lists/%s/segments/%s", list_id, tag_id), key,
                     body = list(members_to_add = as.list(unname(chunk))))
    added <- added + as.integer(body$total_added %||% 0L)
    not_found <- not_found + length(body$errors %||% list()) + length(body$members_not_found %||% list())
    done <- done + length(chunk)
    if (is.function(report)) report(done, length(emails))
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

# ---- «Actualizar quién respondió» -------------------------------------------
# Se parte en dos para el job (1.2): `.mc_sync_prepare` corre en el proceso de
# la API (lee la sesión, valida y resuelve las claves; los errores de entrada
# salen como HTTP 4xx en el acto) y `.mc_sync_run` hace la red (SurveyMonkey y
# Mailchimp) sin tocar la sesión, que el worker callr no tiene.

.mc_sync_prepare <- function(sid, campaign_id = NULL, survey_id, list_id, tag = .MC_TAG_DEFAULT, dry_run = FALSE) {
  session <- session_get(sid)
  ct <- .cmail_campaign_template_for_session(session, campaign_id)
  survey_id <- trimws(as.character(survey_id %||% "")[1])
  list_id <- trimws(as.character(list_id %||% "")[1])
  tag <- trimws(as.character(tag %||% .MC_TAG_DEFAULT)[1]); if (is.na(tag) || !nzchar(tag)) tag <- .MC_TAG_DEFAULT
  if (is.na(survey_id) || !nzchar(survey_id)) stop_api(422, "E_COLLECTION_MAIL_SYNC_INPUT", "Elige la encuesta de SurveyMonkey.")
  if (!isTRUE(dry_run) && (is.na(list_id) || !nzchar(list_id))) stop_api(422, "E_COLLECTION_MAIL_SYNC_INPUT", "Elige la audiencia de Mailchimp.")

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
  list(
    campaign_id = ct$campaign_id, survey_id = survey_id, list_id = list_id, tag = tag, dry_run = isTRUE(dry_run),
    index = ti$index, recipients = ti$recipients,
    sm_token = .connections_token_require("surveymonkey", sid),
    mc_key = if (!isTRUE(dry_run)) .connections_token_require("mailchimp", sid)
  )
}

.mc_sync_run <- function(input, report = function(...) invisible(NULL)) {
  force(input)
  report("surveymonkey", percent = 5, message = "Leyendo las respuestas de SurveyMonkey...")
  responses <- tryCatch(sm_api_fetch_all_responses_bulk(input$survey_id, input$sm_token)$data,
                        error = function(e) stop_api(502, "E_MAILCHIMP_SYNC_SURVEYMONKEY", paste("No se pudieron leer las respuestas de SurveyMonkey:", conditionMessage(e))))
  st <- vapply(responses, function(r) as.character(r$response_status %||% "")[1], "")
  tk <- vapply(responses, function(r) .mc_token_of(paste0("?t=", as.character(r$custom_variables$t %||% "")[1])), "")
  completed <- st == "completed"
  has_token <- !is.na(tk)
  in_campaign <- has_token & tk %in% names(input$index)
  emails <- unique(unname(input$index[tk[completed & in_campaign]]))

  out <- list(
    ok = TRUE, campaign_id = input$campaign_id, survey_id = input$survey_id, list_id = input$list_id, tag = input$tag,
    recipients = input$recipients, recipients_with_token = length(input$index),
    responses = length(responses), completed = sum(completed), partial = sum(st == "partial"),
    without_token = sum(!has_token), from_other_campaign = sum(has_token & !in_campaign),
    respondents = length(emails), pending = length(input$index) - length(emails),
    tagged = 0L, not_in_audience = 0L, dry_run = isTRUE(input$dry_run),
    synced_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z")
  )
  if (isTRUE(input$dry_run)) return(out)
  report("mailchimp", current = 0L, total = length(emails), message = .mc_progress_label(0L, length(emails)))
  tag_id <- .mc_tag_id(input$mc_key, input$list_id, input$tag)
  res <- .mc_tag_emails(input$mc_key, input$list_id, tag_id, emails,
                        report = function(done, total) report("mailchimp", current = done, total = total,
                                                              message = .mc_progress_label(done, total)))
  out$tagged <- res$added
  out$not_in_audience <- res$not_in_audience
  out
}

#' Cruza las respuestas de SurveyMonkey con la campaña y etiqueta en Mailchimp a
#' quien respondió (síncrono; la ruta usa el job `collection_mail_mailchimp_sync_submit`).
#'
#' @param survey_id encuesta de SurveyMonkey cuyas respuestas traen la variable `t`.
#' @param list_id audiencia de Mailchimp donde están los destinatarios.
#' @param dry_run TRUE cuenta sin tocar Mailchimp.
#' @keywords internal
collection_mail_mailchimp_sync <- function(sid, campaign_id = NULL, survey_id, list_id, tag = .MC_TAG_DEFAULT,
                                           dry_run = FALSE) {
  # Se evalúa antes: dentro de `.mc_sync_run` la promesa se forzaría dentro del
  # tryCatch de SurveyMonkey y un error de entrada saldría disfrazado de él.
  input <- .mc_sync_prepare(sid, campaign_id, survey_id, list_id, tag, dry_run)
  .mc_sync_run(input)
}

# ---- jobs (1.2, 1.3) ---------------------------------------------------------

# Error de dominio dentro de `result_data` (patrón `jobResultDomainError()`): un
# stop_api conserva código y mensaje; cualquier otro error sale como E_INTERNAL
# con su `error_id`, sin el mensaje técnico.
.mc_job_error <- function(e) {
  if (inherits(e, "api_error")) {
    return(list(ok = FALSE, error = list(code = e$code, status = as.integer(e$status %||% 500L),
                                         message = conditionMessage(e), details = e$details)))
  }
  error_id <- .api_error_id()
  message(sprintf("[prosecnur-app] E_INTERNAL %s (mailchimp): %s", error_id, conditionMessage(e)))
  list(ok = FALSE, error = list(code = "E_INTERNAL", status = 500L,
                                message = sprintf("Falló el trabajo con Mailchimp (ref. %s).", error_id),
                                details = list(error_id = error_id)))
}

# Corre un paso de red del worker leyendo su insumo del RDS.
.mc_job_run <- function(input_path, progress_path, run) {
  report <- if (!is.null(progress_path)) job_progress_writer(progress_path) else function(...) invisible(NULL)
  out <- tryCatch(run(readRDS(input_path), report), error = .mc_job_error)
  if (isTRUE(out$ok)) report("done", percent = 100, message = "Listo.")
  out
}

# Lanza el job: el insumo (con las claves y los correos) va a un RDS en
# jobs/inputs que se borra al terminar, en cualquier final. El worker es una
# función top-level con nombre: el bootstrap de jobs.R la vuelve a resolver
# en el namespace fresco. Nunca se serializa la sesión.
.mc_job_submit <- function(sid, kind, runner_name, input) {
  input_path <- job_save_rds(sid, gsub("[^a-z_]", "_", kind), input)
  runner <- get(runner_name, envir = asNamespace("prosecnurapp"), inherits = FALSE)
  attr(runner, "prosecnur_job_function_name") <- runner_name
  job_id <- job_submit(
    sid = sid, kind = kind, func = runner,
    args = list(sid = sid, input_path = input_path),
    on_cleanup = function(j) job_unlink_inputs(input_path)
  )
  list(ok = TRUE, job_id = job_id)
}

#' Worker del job «Actualizar quién respondió» (corre en callr).
#' @param sid sesión (solo para trazabilidad: el worker no lee la sesión).
#' @param input_path RDS de `.mc_sync_prepare`.
#' @keywords internal
collection_mail_mailchimp_sync_job <- function(sid, input_path, progress_path = NULL) {
  .mc_job_run(input_path, progress_path, .mc_sync_run)
}

#' `POST /api/recopiladores/mail-sync`: valida en el acto y lanza el job.
#' @return list(ok, job_id).
#' @keywords internal
collection_mail_mailchimp_sync_submit <- function(sid, campaign_id = NULL, survey_id, list_id,
                                                  tag = .MC_TAG_DEFAULT, dry_run = FALSE) {
  input <- .mc_sync_prepare(sid, campaign_id, survey_id, list_id, tag, dry_run)
  .mc_job_submit(sid, "recopiladores.mail_sync", "collection_mail_mailchimp_sync_job", input)
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
