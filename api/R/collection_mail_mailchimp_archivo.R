# =============================================================================
# Material de campo › Correo › Seguimiento: archivar en Mailchimp a quien ya
# respondió y etiquetar "Respondió" sólo a los suscriptores activos.
#
# Archivar es `DELETE /lists/{id}/members/{hash}` (hash = md5 del correo en
# minúsculas). Mailchimp lo deja recuperable y no lo cobra como contacto. Se
# manda en lote por `/batches` (una operación por correo) y se espera a que el
# lote termine leyendo `GET /batches/{id}`.
#
# Un contacto archivado o dado de baja hace fallar con HTTP 400 el
# `members_to_add` de un segmento estático. Por eso, antes de etiquetar, se
# leen los correos suscritos de la audiencia (paginado, sólo el correo) y se
# etiqueta y archiva únicamente a esos.
#
# Cada persona puede tener dos correos en la audiencia: el de la lista de la
# campaña y su segundo correo (correo personal, collection_mail_correo_personal.R).
# Quien responde se archiva con los dos.
#
# Nada de esto devuelve correos: sólo conteos.
# =============================================================================

.MC_MEMBERS_PAGE <- 1000L
.MC_BATCH_OPS <- 5000L
.MC_BATCH_POLL_SECONDS <- 5
.MC_BATCH_POLL_MAX <- 240L  # 20 minutos por lote

# Hash con que Mailchimp nombra a un contacto en la ruta.
.mc_member_hash <- function(email) {
  vapply(tolower(trimws(as.character(email))), function(e) digest::digest(e, algo = "md5", serialize = FALSE), "",
         USE.NAMES = FALSE)
}

#' Correos suscritos (activos) de la audiencia, en minúscula.
#' @keywords internal
.mc_active_emails <- function(key, list_id, report = NULL) {
  out <- character(0); offset <- 0L; total <- NA_integer_
  repeat {
    body <- .mc_call("GET", sprintf("/lists/%s/members", list_id), key,
                     query = list(count = .MC_MEMBERS_PAGE, offset = offset, status = "subscribed",
                                  fields = "members.email_address,total_items"))
    members <- body$members %||% list()
    out <- c(out, tolower(vapply(members, function(m) as.character(m$email_address %||% "")[1], "")))
    total <- as.integer(body$total_items %||% length(out))
    offset <- offset + .MC_MEMBERS_PAGE
    if (is.function(report)) report(min(offset, total), total)
    if (!length(members) || offset >= total) break
  }
  unique(out[nzchar(out)])
}

# Espera a que un lote de `/batches` termine. Devuelve el último estado.
.mc_batch_wait <- function(key, batch_id) {
  for (i in seq_len(.MC_BATCH_POLL_MAX)) {
    st <- .mc_call("GET", sprintf("/batches/%s", batch_id), key,
                   query = list(fields = "id,status,total_operations,finished_operations,errored_operations"))
    if (identical(as.character(st$status %||% "")[1], "finished")) return(st)
    .mc_sleep(.MC_BATCH_POLL_SECONDS)
  }
  stop_api(502, "E_MAILCHIMP_BATCH",
           "Mailchimp no terminó de archivar en 20 minutos. El lote sigue allá: vuelve a correr la actualización más tarde.")
}

#' Archiva correos de la audiencia en lotes de `/batches`.
#' @return list(archived, errored).
#' @keywords internal
.mc_archive_emails <- function(key, list_id, emails, report = NULL) {
  emails <- unique(tolower(emails[nzchar(emails)]))
  if (!length(emails)) return(list(archived = 0L, errored = 0L))
  archived <- 0L; errored <- 0L; done <- 0L
  for (chunk in split(emails, ceiling(seq_along(emails) / .MC_BATCH_OPS))) {
    ops <- lapply(.mc_member_hash(chunk), function(h) list(method = "DELETE", path = sprintf("/lists/%s/members/%s", list_id, h)))
    b <- .mc_call("POST", "/batches", key, body = list(operations = ops))
    st <- .mc_batch_wait(key, as.character(b$id %||% "")[1])
    err <- as.integer(st$errored_operations %||% 0L)
    archived <- archived + as.integer(st$finished_operations %||% length(chunk)) - err
    errored <- errored + err
    done <- done + length(chunk)
    if (is.function(report)) report(done, length(emails))
  }
  list(archived = archived, errored = errored)
}

# Segundos correos cargados de una campaña: token -> correo personal. Sólo los
# del brazo que recibe en el correo personal y que Mailchimp aceptó.
.mc_linked_emails <- function(store) {
  sc <- store$segundo_correo
  if (!is.data.frame(sc) || !nrow(sc)) return(stats::setNames(character(0), character(0)))
  tokens <- store$tokens %||% character(0)
  ok <- sc$brazo == "personal" & sc$estado %in% c("cargado", "por_cargar") & sc$clave %in% names(tokens)
  stats::setNames(tolower(sc$correo[ok]), unname(tokens[sc$clave[ok]]))
}

# Después de leer SurveyMonkey: etiqueta "Respondió" a los activos y, si se
# pidió, archiva a los activos que respondieron (con su segundo correo).
# `activos` se pasa cuando se procesan varias campañas sobre la misma audiencia.
.mc_tag_and_archive <- function(input, emails, linked, report, activos = NULL) {
  if (is.null(activos)) {
    report("mailchimp", percent = 10, message = "Mailchimp: leyendo los contactos activos...")
    activos <- .mc_active_emails(input$mc_key, input$list_id)
  }
  emails <- unique(tolower(emails))
  tag_these <- intersect(emails, activos)
  report("mailchimp", current = 0L, total = length(tag_these), message = .mc_progress_label(0L, length(tag_these)))
  tag_id <- .mc_tag_id(input$mc_key, input$list_id, input$tag)
  res <- .mc_tag_emails(input$mc_key, input$list_id, tag_id, tag_these,
                        report = function(done, total) report("mailchimp", current = done, total = total,
                                                              message = .mc_progress_label(done, total)))
  out <- list(tagged = res$added, not_in_audience = res$not_in_audience,
              inactive = length(setdiff(emails, activos)), archived = 0L, archive_errors = 0L,
              archived_second = 0L)
  if (isTRUE(input$archive)) {
    second <- intersect(unique(tolower(linked)), activos)
    targets <- unique(c(tag_these, second))
    report("archivo", current = 0L, total = length(targets), message = sprintf("Archivando: 0 de %d", length(targets)))
    ar <- .mc_archive_emails(input$mc_key, input$list_id, targets, report = function(done, total)
      report("archivo", current = done, total = total, message = sprintf("Archivando: %s de %s", done, total)))
    out$archived <- ar$archived
    out$archive_errors <- ar$errored
    out$archived_second <- length(second)
  }
  out
}

# ---- antes de cada envío ------------------------------------------------------

#' Campañas programadas en Mailchimp (sin correos). El listado de campañas
#' devuelve el total de destinatarios en 0: el real se lee con el GET de cada una.
#' @keywords internal
.mc_scheduled_campaigns <- function(key, list_id = NULL) {
  body <- .mc_call("GET", "/campaigns", key, query = list(
    status = "schedule", count = 100,
    fields = "campaigns.id,campaigns.settings.title,campaigns.send_time,campaigns.recipients.list_id"))
  out <- list()
  for (c in body$campaigns %||% list()) {
    lid <- as.character(c$recipients$list_id %||% "")[1]
    if (!is.null(list_id) && nzchar(list_id) && !identical(lid, list_id)) next
    id <- as.character(c$id %||% "")[1]
    info <- .mc_call("GET", sprintf("/campaigns/%s", id), key, query = list(fields = "recipients.recipient_count"))
    out[[length(out) + 1L]] <- list(
      id = id, titulo = as.character(c$settings$title %||% "")[1], send_time = as.character(c$send_time %||% "")[1],
      destinatarios = as.integer(info$recipients$recipient_count %||% NA_integer_)
    )
  }
  ord <- order(vapply(out, function(x) x$send_time, ""))
  out[ord]
}

.mc_parse_time <- function(x) {
  x <- as.character(x %||% "")[1]
  if (is.na(x) || !nzchar(x)) return(as.POSIXct(NA))
  x <- sub("Z$", "+0000", sub("([+-][0-9]{2}):([0-9]{2})$", "\\1\\2", x))
  as.POSIXct(x, format = "%Y-%m-%dT%H:%M:%S%z", tz = "UTC")
}

#' ¿Toca actualizar ahora? Puro. Toca cuando falta `minutos` o menos para la
#' próxima campaña programada y no se corrió ya para esa hora de envío.
#' @return list(lanzar, para, proximo).
#' @keywords internal
.mc_antes_de_envio_decidir <- function(programadas, ahora, minutos, ultima_para = NULL) {
  ahora <- as.POSIXct(ahora, tz = "UTC")
  horas <- vapply(programadas, function(p) as.numeric(.mc_parse_time(p$send_time)), 0)
  futuras <- which(!is.na(horas) & horas > as.numeric(ahora))
  if (!length(futuras)) return(list(lanzar = FALSE, para = NULL, proximo = NULL))
  i <- futuras[which.min(horas[futuras])]
  prox <- programadas[[i]]
  falta_min <- (horas[[i]] - as.numeric(ahora)) / 60
  ya <- !is.null(ultima_para) && identical(as.character(ultima_para), prox$send_time)
  list(lanzar = falta_min <= minutos && !ya, para = prox$send_time, proximo = prox)
}
