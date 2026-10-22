# =============================================================================
# Material de campo › Correos › Cargar la audiencia en Mailchimp por API (1.3)
#
# Sube los destinatarios efectivos de la campaña a una audiencia de Mailchimp:
# los mismos de audiencia.csv (`.cmail_audience_table`, que también escribe el
# CSV del ZIP), con sus campos como merge fields y la etiqueta del público.
#
#   1. `GET /lists/{id}/merge-fields`; se crea cada etiqueta que falte
#      (`{tag, name, type: "text"}`), así ninguna columna llega como MMERGE7.
#   2. `POST /lists/{id}` en lotes de 500 con `update_existing: true`.
#   3. La etiqueta del público (por defecto el actor de la campaña o, sin él, su
#      nombre) a todos, con `.mc_tag_emails`.
#
# Corre como job (`collection_mail_mailchimp_audience_job`): la preparación lee
# la sesión en el proceso de la API y el worker solo hace la red. El resultado
# no lleva correos: solo conteos y errores agrupados por `error_code`.
# =============================================================================

# Chequeos de la revisión que definen la audiencia: con uno en error no se sabe
# qué subir (falta la lista, una etiqueta no tiene columna, un enlace saldría
# roto o un correo repetido trae otro valor en un enlace). Los demás errores
# (asunto, pie…) son del correo, no de la audiencia, y no frenan la carga.
.MC_AUDIENCE_CHECKS <- c("recipients", "tags_have_columns", "fields_empty", "duplicates_conflicting")

# Etiqueta del público: la pedida, o el actor de la campaña, o su nombre.
.mc_audience_tag <- function(campaign, tag = NULL) {
  pick <- function(x) { x <- trimws(as.character(x %||% "")[1]); if (is.na(x)) "" else x }
  for (cand in list(tag, campaign$actor, campaign$name)) {
    v <- pick(cand)
    if (nzchar(v)) return(v)
  }
  stop_api(422, "E_COLLECTION_MAIL_SYNC_INPUT", "Indica la etiqueta del público en Mailchimp.")
}

# Campaña de Mailchimp del pedido (las de SurveyMonkey no tienen audiencia aquí).
.mc_mailchimp_campaign <- function(session, campaign_id) {
  pick <- .cmail_campaign_for(session, .collection_current(session), campaign_id)
  if (!identical(.cmail_platform_of(pick$campaign), "mailchimp")) {
    stop_api(409, "E_COLLECTION_MAIL_SYNC_PLATFORM",
             "La campaña se envía por SurveyMonkey: la carga a Mailchimp solo aplica a campañas de Mailchimp.")
  }
  pick$campaign
}

# Nombre visible de cada merge field (Mailchimp admite hasta 50 caracteres).
.mc_merge_field_names <- function(tags, tpl) {
  fields <- .cmail_field_index(tpl)
  by_tag <- stats::setNames(vapply(fields, function(f) f$label, ""), vapply(fields, function(f) f$tag, ""))
  vapply(tags, function(t) {
    nm <- if (identical(t, "FNAME")) "First Name" else if (identical(t, .CMAIL_TRATO_TAG)) "Saludo" else by_tag[[t]] %||% t
    if (is.null(nm) || is.na(nm) || !nzchar(nm)) nm <- t
    substr(nm, 1L, 50L)
  }, "", USE.NAMES = FALSE)
}

# Tabla de la audiencia de la campaña. La base es la invitación (el mismo
# audiencia.csv que su export); si un recordatorio usa un campo más (en su
# asunto o su apertura), se suma su columna para que el merge field exista.
.mc_audience_build <- function(session, campaign) {
  base_tpl <- .cmail_campaign_template_checked(campaign)
  sends <- .cmail_sends_of(campaign)
  primary <- NULL
  tag_rows <- list()
  blocking <- list()
  for (send in sends) {
    tpl <- .cmail_template_for_send(base_tpl, send)
    r <- .cmail_review_checks(session, tpl, campaign, "completo", send)
    errs <- Filter(function(c) identical(c$status, "error") && c$code %in% .MC_AUDIENCE_CHECKS, r$checks)
    blocking <- c(blocking, errs)
    if (is.null(primary)) primary <- list(r = r, tpl = tpl)
    known <- vapply(tag_rows, function(t) t$tag, "")
    for (t in r$tag_rows %||% list()) if (!(t$tag %in% known)) { tag_rows[[length(tag_rows) + 1L]] <- t; known <- c(known, t$tag) }
  }
  if (length(blocking)) {
    masked <- .cmail_mask_pii(blocking)
    motivo <- paste(vapply(masked, function(c) as.character(c$detail %||% "")[1], ""), collapse = " ")
    stop_api(422, "E_COLLECTION_MAIL_REVIEW_BLOCKING",
             trimws(paste("No se puede cargar la audiencia.", motivo)),
             details = list(checks = masked))
  }
  r <- primary$r
  tres <- .cmail_trato_resolve(r$store, primary$tpl, r$resolved)
  tab <- .cmail_audience_table(r$store, r$resolved, tag_rows, tres)
  # «Email Address» → email_address; «First Name» → FNAME; el resto, su etiqueta.
  merge_tags <- c("FNAME", tab$header[-(1:2)])
  merge <- stats::setNames(tab$cols[-1], merge_tags)
  list(
    emails = as.character(tab$cols[[1]]),
    merge = lapply(merge, function(v) { v <- as.character(v); v[is.na(v)] <- ""; v }),
    merge_names = .mc_merge_field_names(merge_tags, primary$tpl),
    n = tab$n
  )
}

#' Prepara la carga (proceso de la API): valida, arma la tabla y resuelve la clave.
#' @keywords internal
.mc_audience_prepare <- function(sid, campaign_id = NULL, list_id, tag = NULL) {
  session <- session_get(sid)
  list_id <- trimws(as.character(list_id %||% "")[1])
  if (is.na(list_id) || !nzchar(list_id)) stop_api(422, "E_COLLECTION_MAIL_SYNC_INPUT", "Elige la audiencia de Mailchimp.")
  campaign <- .mc_mailchimp_campaign(session, campaign_id)
  tag <- .mc_audience_tag(campaign, tag)
  if (is.null(.cmail_recipients_load(session, campaign$campaign_id))) {
    stop_api(409, "E_COLLECTION_MAIL_SYNC_NO_RECIPIENTS", "Importa primero los destinatarios de la campaña.")
  }
  aud <- .mc_audience_build(session, campaign)
  if (!aud$n) {
    stop_api(409, "E_COLLECTION_MAIL_SYNC_NO_RECIPIENTS", "La campaña no tiene destinatarios efectivos que cargar.")
  }
  c(list(campaign_id = campaign$campaign_id, list_id = list_id, tag = tag,
         mc_key = .connections_token_require("mailchimp", sid)), aud)
}

# Crea las etiquetas que la audiencia no tiene. Devuelve las creadas.
.mc_merge_fields_ensure <- function(key, list_id, tags, names) {
  body <- .mc_call("GET", sprintf("/lists/%s/merge-fields", list_id), key,
                   query = list(count = 1000, fields = "merge_fields.tag,merge_fields.name"))
  have <- toupper(vapply(body$merge_fields %||% list(), function(f) as.character(f$tag %||% ""), ""))
  created <- character(0)
  for (i in seq_along(tags)) {
    if (toupper(tags[[i]]) %in% have) next
    .mc_call("POST", sprintf("/lists/%s/merge-fields", list_id), key,
             body = list(tag = tags[[i]], name = names[[i]], type = "text"))
    created <- c(created, tags[[i]])
  }
  created
}

# Sube los contactos en lotes de 500. Los errores se cuentan por `error_code`;
# los correos que Mailchimp devuelve en `new_members`/`errors` no salen de aquí.
.mc_members_upload <- function(key, list_id, emails, merge, report = NULL) {
  created <- 0L; updated <- 0L; failed <- 0L; by_reason <- list(); done <- 0L
  tags <- names(merge)
  for (idx in split(seq_along(emails), ceiling(seq_along(emails) / .MC_BATCH))) {
    members <- lapply(idx, function(i) list(
      email_address = emails[[i]], status_if_new = "subscribed",
      merge_fields = stats::setNames(lapply(tags, function(t) merge[[t]][[i]]), tags)
    ))
    body <- .mc_call("POST", sprintf("/lists/%s", list_id), key,
                     body = list(members = members, update_existing = TRUE))
    created <- created + as.integer(body$total_created %||% length(body$new_members %||% list()))
    updated <- updated + as.integer(body$total_updated %||% length(body$updated_members %||% list()))
    errs <- body$errors %||% list()
    failed <- failed + as.integer(body$error_count %||% length(errs))
    for (e in errs) {
      code <- as.character(e$error_code %||% "")[1]
      if (is.na(code) || !nzchar(code)) code <- "desconocido"
      by_reason[[code]] <- as.integer(by_reason[[code]] %||% 0L) + 1L
    }
    done <- done + length(idx)
    if (is.function(report)) report(done, length(emails))
  }
  if (!length(by_reason)) by_reason <- stats::setNames(list(), character(0))
  list(created = created, updated = updated, failed = failed, by_reason = by_reason)
}

#' Carga en Mailchimp (worker, sin sesión).
#' @keywords internal
.mc_audience_run <- function(input, report = function(...) invisible(NULL)) {
  key <- input$mc_key
  total <- length(input$emails)
  report("merge_fields", percent = 2, message = "Mailchimp: revisando los campos de la audiencia...")
  created_fields <- .mc_merge_fields_ensure(key, input$list_id, names(input$merge), input$merge_names)
  # Subir pesa más que etiquetar: 0–80 % la subida, 80–100 % la etiqueta.
  report("upload", current = 0L, total = total, percent = 5, message = .mc_progress_label(0L, total))
  up <- .mc_members_upload(key, input$list_id, input$emails, input$merge, report = function(done, n) {
    report("upload", current = done, total = n, percent = round(5 + 75 * done / n), message = .mc_progress_label(done, n))
  })
  report("tag", percent = 80, message = sprintf("Mailchimp: etiquetando «%s»...", input$tag))
  tag_id <- .mc_tag_id(key, input$list_id, input$tag)
  tg <- .mc_tag_emails(key, input$list_id, tag_id, input$emails, report = function(done, n) {
    report("tag", current = done, total = n, percent = round(80 + 19 * done / n),
           message = sprintf("Etiqueta «%s»: %s", input$tag, .mc_progress_label(done, n)))
  })
  list(
    ok = TRUE, campaign_id = input$campaign_id, list_id = input$list_id, tag = input$tag,
    recipients = as.integer(total), created = up$created, updated = up$updated, failed = up$failed,
    failed_by_reason = up$by_reason, tagged = tg$added,
    merge_fields_created = as.list(created_fields),
    uploaded_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z")
  )
}

#' Worker del job «Cargar la audiencia en Mailchimp» (corre en callr).
#' @param sid sesión (solo para trazabilidad: el worker no lee la sesión).
#' @param input_path RDS de `.mc_audience_prepare`.
#' @keywords internal
collection_mail_mailchimp_audience_job <- function(sid, input_path, progress_path = NULL) {
  .mc_job_run(input_path, progress_path, .mc_audience_run)
}

#' `POST /api/recopiladores/mail-sync/audience`: valida en el acto y lanza el job.
#' @return list(ok, job_id).
#' @keywords internal
collection_mail_mailchimp_audience_submit <- function(sid, campaign_id = NULL, list_id, tag = NULL) {
  input <- .mc_audience_prepare(sid, campaign_id, list_id, tag)
  .mc_job_submit(sid, "recopiladores.mail_audience", "collection_mail_mailchimp_audience_job", input)
}
