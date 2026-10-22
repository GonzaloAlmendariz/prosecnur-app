# =============================================================================
# Material de campo › Correos › Crear la campaña como BORRADOR en Mailchimp (2.1)
#
# Arma en Mailchimp la campaña de un envío con el mismo render que su export
# (`.cmail_template_for_send` + `.cmail_review_checks(..., "plantilla", send)`):
#
#   1. sube cada imagen local al File Manager y cambia su `src` relativo por la
#      `full_size_url` (una imagen con URL https declarada se deja tal cual);
#   2. `POST /campaigns` (regular) con el segmento: tiene la etiqueta del público
#      (`static_is`) y, en un recordatorio, NO tiene «Respondió» (`static_not`);
#   3. `PUT /campaigns/{id}/content` con el HTML y un `GET` para leer a cuántos
#      llegaría.
#
# Es síncrono (pocas llamadas). La app NUNCA envía ni programa: el botón «Send»
# se pulsa en Mailchimp, desde el `edit_url` que devuelve esta función.
# =============================================================================

.MC_REPLY_TO_RE <- "^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$"

.mc_text_arg <- function(x) {
  x <- trimws(as.character(x %||% "")[1])
  if (is.na(x)) "" else x
}

# Etiqueta a excluir: la pedida o, en un recordatorio, «Respondió». Un valor
# vacío cuenta como no dado: un recordatorio sin exclusión le llegaría a quien
# ya respondió, que es justo lo que este flujo existe para evitar.
.mc_exclude_tag <- function(send, exclude_tag = NULL) {
  v <- .mc_text_arg(exclude_tag)
  if (nzchar(v)) return(v)
  if (identical(send$kind, "recordatorio")) .MC_TAG_DEFAULT else NULL
}

# Segmento de la campaña: con la etiqueta del público y, si hay, sin la excluida.
.mc_segment_opts <- function(tag_id, exclude_id = NULL) {
  cond <- function(op, value) {
    num <- suppressWarnings(as.integer(value))  # Mailchimp espera el id numérico
    list(condition_type = "StaticSegment", field = "static_segment", op = op,
         value = if (is.na(num)) value else num)
  }
  conditions <- list(cond("static_is", tag_id))
  if (!is.null(exclude_id)) conditions[[2L]] <- cond("static_not", exclude_id)
  list(match = "all", conditions = conditions)
}

# Sube las imágenes locales al File Manager y reescribe su `src` en el HTML.
.mc_images_host <- function(key, html, images, prefix) {
  uploaded <- 0L
  for (img in .cmail_import_images(images)) {
    raw <- readBin(img$path, "raw", file.info(img$path)$size)
    body <- .mc_call("POST", "/file-manager/files", key,
                     body = list(name = paste0(prefix, "-", img$export_name), file_data = jsonlite::base64_enc(raw)))
    url <- as.character(body$full_size_url %||% "")[1]
    if (is.na(url) || !nzchar(url)) {
      stop_api(502, "E_MAILCHIMP_API", sprintf("Mailchimp no devolvió la dirección de la imagen «%s».", img$id))
    }
    html <- gsub(sprintf('src="%s"', img$export_name), sprintf('src="%s"', url), html, fixed = TRUE)
    uploaded <- uploaded + 1L
  }
  list(html = html, uploaded = uploaded)
}

#' Crea el borrador de un envío en Mailchimp (`POST /api/recopiladores/mail-sync/campaign`).
#'
#' @param send_id envío de la campaña (sin él, la invitación).
#' @param list_id audiencia de Mailchimp.
#' @param from_name,reply_to remitente que verá el destinatario.
#' @param tag etiqueta del público (por defecto, la de la carga de audiencia).
#' @param exclude_tag etiqueta a excluir (por defecto «Respondió» en un recordatorio).
#' @return list(ok, mailchimp_campaign_id, web_id, edit_url, recipient_count,
#'   subject, title, images_uploaded). Sin correos.
#' @keywords internal
collection_mail_mailchimp_campaign_draft <- function(sid, campaign_id = NULL, send_id = NULL, list_id,
                                                     from_name, reply_to, tag = NULL, exclude_tag = NULL) {
  session <- session_get(sid)
  list_id <- .mc_text_arg(list_id)
  from_name <- .mc_text_arg(from_name)
  reply_to <- .mc_text_arg(reply_to)
  if (!nzchar(list_id)) stop_api(422, "E_COLLECTION_MAIL_SYNC_CAMPAIGN_INPUT", "Elige la audiencia de Mailchimp.")
  if (!nzchar(from_name) || nchar(from_name) > 100L) {
    stop_api(422, "E_COLLECTION_MAIL_SYNC_CAMPAIGN_INPUT", "Escribe el nombre del remitente (hasta 100 caracteres).")
  }
  if (!grepl(.MC_REPLY_TO_RE, reply_to)) {
    stop_api(422, "E_COLLECTION_MAIL_SYNC_CAMPAIGN_INPUT", "El correo de respuesta no tiene la forma de una dirección.")
  }
  campaign <- .mc_mailchimp_campaign(session, campaign_id)
  base_tpl <- .cmail_campaign_template_checked(campaign)
  send_id <- .mc_text_arg(send_id)
  send <- .cmail_send_pick(campaign, base_tpl, if (nzchar(send_id)) send_id)$send
  tpl <- .cmail_template_for_send(base_tpl, send)
  r <- .cmail_review_checks(session, tpl, campaign, "plantilla", send)
  if (!isTRUE(.cmail_review_summary(r$checks)$ready)) {
    errores <- .cmail_mask_pii(Filter(function(c) identical(c$status, "error"), r$checks))
    motivo <- paste(vapply(errores, function(c) as.character(c$detail %||% "")[1], ""), collapse = " ")
    stop_api(422, "E_COLLECTION_MAIL_REVIEW_BLOCKING", trimws(paste("No se puede crear el borrador.", motivo)),
             details = list(checks = errores))
  }
  tag <- .mc_audience_tag(campaign, tag)
  exclude <- .mc_exclude_tag(send, exclude_tag)

  key <- .connections_token_require("mailchimp", sid)
  tag_id <- .mc_tag_id(key, list_id, tag, create = FALSE)
  if (is.null(tag_id)) {
    stop_api(409, "E_COLLECTION_MAIL_SYNC_NO_AUDIENCE_TAG",
             sprintf("La audiencia no tiene la etiqueta «%s»: carga primero la audiencia de la campaña.", tag))
  }
  # La excluida puede no existir aún (nadie respondió): se crea vacía y el
  # segmento no excluye a nadie, que es lo correcto.
  exclude_id <- if (!is.null(exclude)) .mc_tag_id(key, list_id, exclude, create = TRUE)

  hosted <- .mc_images_host(key, r$rendered$html, r$images, campaign$campaign_id)
  title <- sprintf("%s · %s", campaign$name %||% campaign$campaign_id, send$label %||% send$send_id)
  subject <- as.character(r$rendered$subject %||% tpl$subject %||% "")[1]
  created <- .mc_call("POST", "/campaigns", key, body = list(
    type = "regular",
    recipients = list(list_id = list_id, segment_opts = .mc_segment_opts(tag_id, exclude_id)),
    settings = list(subject_line = subject, preview_text = as.character(r$rendered$preheader %||% "")[1],
                    title = title, from_name = from_name, reply_to = reply_to)
  ))
  mc_id <- as.character(created$id %||% "")[1]
  web_id <- as.character(created$web_id %||% "")[1]
  .mc_call("PUT", sprintf("/campaigns/%s/content", mc_id), key, body = list(html = hosted$html))
  info <- .mc_call("GET", sprintf("/campaigns/%s", mc_id), key, query = list(fields = "recipients.recipient_count,web_id"))
  if (!nzchar(web_id)) web_id <- as.character(info$web_id %||% "")[1]
  list(
    ok = TRUE,
    mailchimp_campaign_id = mc_id,
    web_id = web_id,
    edit_url = sprintf("https://%s.admin.mailchimp.com/campaigns/edit?id=%s", .mc_dc(key), web_id),
    recipient_count = as.integer(info$recipients$recipient_count %||% NA_integer_),
    subject = subject,
    title = title,
    images_uploaded = hosted$uploaded
  )
}
