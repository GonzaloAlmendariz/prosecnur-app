# collection_mail_sends.R — envíos de una campaña de correo: la invitación y
# sus recordatorios (ADR 0110, etapa E1k).
#
# Un recordatorio NO es otra plantilla: el cuerpo es común (H-k1). Cada envío
# puede cambiar solo su asunto, su preheader y sumar una apertura; la plantilla
# efectiva sale de `.cmail_template_for_send()` sin un segundo render.
#
# Modelo (`campaign.sends`, entre 1 y 6):
#   { send_id, kind, label, date?, audience, subject?, preheader?, opening?, collector_label?,
#     last_export_at?, last_export_platform? }   (las dos últimas, del servidor: ADR 0111 §8,
#                                                 collection_mail_export_registro.R)
#
# - El primero es siempre la invitación (`send_id = kind = "invitacion"`): no
#   se borra ni se mueve.
# - Los demás son `kind = "recordatorio"` con `send_id = recordatorio-<k>`, que
#   asigna el servidor, es estable y no se reutiliza (`campaign.send_seq` guarda
#   el mayor `k` que se usó).
# - `label` 1-40 sin correo («Recordatorio N» por defecto); `date` YYYY-MM-DD
#   (solo planificación: programar envíos sigue fuera de alcance); `audience`
#   `todos` en la invitación y `sin_respuesta | parcial | ambos` en los
#   recordatorios (los rótulos de «Send To» de SurveyMonkey; en Mailchimp solo
#   se informa en el LEEME).
# - `subject`/`preheader` null usan los de la plantilla; `opening` (≤ 600) sigue
#   las reglas de `paragraph.text` (negrita, campos y enlaces).
# - `collector_label` (≤ 80, sin correo ni campos): el nombre o id del
#   recopilador de SurveyMonkey por el que sale el envío; queda en el manifest
#   para saber «a quién» se mandó (no es dato personal).
# - Sin `sends` guardados (campañas anteriores), la campaña tiene solo la
#   invitación: es una lectura, no se escribe nada.

.CMAIL_OPENING_ID <- "__apertura"
.CMAIL_SENDS_MAX <- 6L
.CMAIL_SEND_KEYS <- c("send_id", "kind", "label", "date", "audience", "subject", "preheader", "opening", "collector_label")
.CMAIL_SEND_AUDIENCES <- c("sin_respuesta", "parcial", "ambos")
.CMAIL_SEND_INVITATION <- "invitacion"
.CMAIL_SEND_REMINDER_RE <- "^recordatorio-([0-9]{1,4})$"
.CMAIL_OPENING_MAX <- 600L

.cmail_send_invitation_default <- function() {
  list(send_id = .CMAIL_SEND_INVITATION, kind = "invitacion", label = "Invitación", audience = "todos")
}

#' Envíos de una campaña (sin guardar, solo la invitación).
#' @keywords internal
.cmail_sends_of <- function(campaign) {
  sends <- campaign$sends
  if (is.list(sends) && length(sends)) return(unname(sends))
  list(.cmail_send_invitation_default())
}

# Mayor `k` de recordatorio usado alguna vez en la campaña.
.cmail_send_seq <- function(campaign) {
  ks <- vapply(.cmail_sends_of(campaign), function(s) {
    id <- .cmail_one(s$send_id) %||% ""
    if (grepl(.CMAIL_SEND_REMINDER_RE, id)) as.integer(sub(.CMAIL_SEND_REMINDER_RE, "\\1", id)) else 0L
  }, integer(1))
  max(c(0L, ks, suppressWarnings(as.integer(unlist(campaign$send_seq)[1])) %||% 0L), na.rm = TRUE)
}

# Resumen público de un envío (lista de campañas y respuesta de la preview).
.cmail_send_brief <- function(send, with_audience = TRUE) {
  keys <- c("send_id", "kind", "label", "date", if (with_audience) "audience")
  .cmc_drop_nulls_deep(send[intersect(keys, names(send))])
}

.cmail_opt_text <- function(x) {
  v <- .cmail_one(x)
  if (is.null(v) || !nzchar(trimws(v))) NULL else v
}

# Un envío contra las reglas; `i` es su posición (1 = la invitación).
.cmail_send_check <- function(s, i, keys, reminder_pos) {
  path <- sprintf("sends[%d]", i)
  p <- list()
  add <- function(x) p <<- c(p, x)
  if (!is.list(s) || (length(s) && is.null(names(s)))) {
    return(list(send = NULL, problems = list(.cmail_problem(path, "not_object", "Cada envío es un objeto."))))
  }
  # Las claves de servidor (registro de exportación) se aceptan y se descartan:
  # las arrastra `.cmail_sends_validate()` desde lo guardado.
  for (k in setdiff(names(s), c(.CMAIL_SEND_KEYS, .CMAIL_SEND_SERVER_KEYS))) {
    add(list(.cmail_problem(paste0(path, ".", k), "unknown_key", sprintf("`%s` no pertenece a un envío.", k))))
  }
  invitation <- i == 1L
  kind <- .cmail_one(s$kind)
  id <- .cmail_one(s$send_id)
  if (invitation) {
    if ((!is.null(kind) && !identical(kind, "invitacion")) || (!is.null(id) && !identical(id, .CMAIL_SEND_INVITATION))) {
      add(list(.cmail_problem(path, "invitation_first", "El primer envío es siempre la invitación.")))
    }
  } else if (identical(kind, "invitacion") || identical(id, .CMAIL_SEND_INVITATION)) {
    add(list(.cmail_problem(path, "invitation_first", "La invitación es solo el primer envío; los demás son recordatorios.")))
  } else if (!is.null(kind) && !identical(kind, "recordatorio")) {
    add(list(.cmail_problem(paste0(path, ".kind"), "bad_kind", "kind es invitacion o recordatorio.")))
  }
  out <- list(send_id = if (invitation) .CMAIL_SEND_INVITATION else id,
              kind = if (invitation) "invitacion" else "recordatorio")

  label <- .cmail_opt_text(s$label)
  if (!is.null(s$label) && is.null(.cmail_one(s$label))) {
    add(list(.cmail_problem(paste0(path, ".label"), "not_text", "Debe ser un texto.")))
  } else if (!is.null(label)) {
    label <- trimws(gsub("[[:cntrl:]]+", " ", label))
    if (nchar(label) > 40L) add(list(.cmail_problem(paste0(path, ".label"), "label_too_long", "La etiqueta va de 1 a 40 caracteres.")))
    if (grepl(.CMAIL_EMAIL_LIKE_RE, label)) add(list(.cmail_problem(paste0(path, ".label"), "label_email", "La etiqueta no puede llevar una dirección de correo.")))
    add(.cmail_text_problems(label, paste0(path, ".label"), character(0)))
    if (length(.cmail_tokens(label))) add(list(.cmail_problem(paste0(path, ".label"), "label_field", "La etiqueta no admite {{campos}}.")))
  }
  out$label <- label %||% (if (invitation) "Invitación" else sprintf("Recordatorio %d", reminder_pos))

  date <- .cmail_opt_text(s$date)
  if (!is.null(date)) {
    d <- if (grepl("^[0-9]{4}-[0-9]{2}-[0-9]{2}$", date)) suppressWarnings(as.Date(date, format = "%Y-%m-%d")) else NA
    if (is.na(d) || !identical(format(d, "%Y-%m-%d"), date)) {
      add(list(.cmail_problem(paste0(path, ".date"), "bad_date", "La fecha prevista va como AAAA-MM-DD.")))
    }
    out$date <- date
  }

  audience <- .cmail_opt_text(s$audience)
  if (invitation) {
    if (!is.null(audience) && !identical(audience, "todos")) {
      add(list(.cmail_problem(paste0(path, ".audience"), "bad_audience", "La invitación va a todos.")))
    }
    out$audience <- "todos"
  } else {
    if (!is.null(audience) && !(audience %in% .CMAIL_SEND_AUDIENCES)) {
      add(list(.cmail_problem(paste0(path, ".audience"), "bad_audience",
        "Un recordatorio va a sin_respuesta, parcial o ambos.")))
    }
    out$audience <- audience %||% "sin_respuesta"
  }

  for (k in c("subject", "preheader")) {
    v <- .cmail_opt_text(s[[k]])
    if (!is.null(s[[k]]) && is.null(.cmail_one(s[[k]]))) {
      add(list(.cmail_problem(paste0(path, ".", k), "not_text", "Debe ser un texto.")))
      next
    }
    if (is.null(v)) next
    add(.cmail_text_problems(v, paste0(path, ".", k), keys))
    add(.cmail_link_problems(v, paste0(path, ".", k), keys, FALSE))
    out[[k]] <- v
  }

  collector <- .cmail_opt_text(s$collector_label)
  if (!is.null(s$collector_label) && is.null(.cmail_one(s$collector_label))) {
    add(list(.cmail_problem(paste0(path, ".collector_label"), "not_text", "Debe ser un texto.")))
  } else if (!is.null(collector)) {
    collector <- trimws(gsub("[[:cntrl:]]+", " ", collector))
    if (nchar(collector) > 80L) add(list(.cmail_problem(paste0(path, ".collector_label"), "label_too_long", "El recopilador va de 1 a 80 caracteres.")))
    if (grepl(.CMAIL_EMAIL_LIKE_RE, collector)) add(list(.cmail_problem(paste0(path, ".collector_label"), "label_email", "El recopilador no puede llevar una dirección de correo.")))
    add(.cmail_text_problems(collector, paste0(path, ".collector_label"), character(0)))
    if (length(.cmail_tokens(collector))) add(list(.cmail_problem(paste0(path, ".collector_label"), "label_field", "El recopilador no admite {{campos}}.")))
    out$collector_label <- collector
  }

  opening <- .cmail_opt_text(s$opening)
  if (!is.null(s$opening) && is.null(.cmail_one(s$opening))) {
    add(list(.cmail_problem(paste0(path, ".opening"), "not_text", "Debe ser un texto.")))
  } else if (!is.null(opening)) {
    if (nchar(opening) > .CMAIL_OPENING_MAX) {
      add(list(.cmail_problem(paste0(path, ".opening"), "text_too_long", sprintf("La apertura supera %d caracteres.", .CMAIL_OPENING_MAX))))
    }
    add(.cmail_text_problems(opening, paste0(path, ".opening"), keys))
    add(.cmail_link_problems(opening, paste0(path, ".opening"), keys, TRUE))
    out$opening <- opening
  }
  list(send = .cmc_drop_nulls_deep(out[intersect(.CMAIL_SEND_KEYS, names(out))]), problems = p)
}

#' Valida y normaliza la lista de envíos de una campaña.
#'
#' Asigna `recordatorio-<k>` a los recordatorios nuevos (sin `send_id` o con uno
#' que la campaña no conoce): un id solo se conserva si ya existía.
#'
#' @param previous envíos guardados (decide qué ids se conservan).
#' @param seq mayor `k` usado alguna vez.
#' @return list(ok, sends, problems, warnings, seq).
#' @keywords internal
.cmail_sends_validate <- function(sends, template, previous = NULL, seq = 0L) {
  keys <- vapply(template$fields %||% list(), function(f) as.character(f$key %||% ""), "")
  if (!is.list(sends) || !length(sends) || !is.null(names(sends))) {
    return(list(ok = FALSE, sends = list(), warnings = list(), seq = seq,
                problems = list(.cmail_problem("sends", "not_list", "sends es una lista de 1 a 6 envíos; el primero es la invitación."))))
  }
  problems <- list()
  if (length(sends) > .CMAIL_SENDS_MAX) {
    problems <- c(problems, list(.cmail_problem("sends", "too_many_sends",
      sprintf("Una campaña tiene hasta %d envíos (la invitación y %d recordatorios).", .CMAIL_SENDS_MAX, .CMAIL_SENDS_MAX - 1L))))
  }
  known <- vapply(previous %||% list(), function(s) .cmail_one(s$send_id) %||% "", "")
  out <- list()
  used <- character(0)
  for (i in seq_along(sends)) {
    r <- .cmail_send_check(sends[[i]], i, keys, i - 1L)
    problems <- c(problems, r$problems)
    s <- r$send
    if (is.null(s)) next
    if (i > 1L) {
      id <- .cmail_one(s$send_id)
      if (is.null(id) || !(id %in% known) || !grepl(.CMAIL_SEND_REMINDER_RE, id) || id %in% used) {
        seq <- seq + 1L
        id <- sprintf("recordatorio-%d", seq)
      }
      s$send_id <- id
      s <- s[intersect(.CMAIL_SEND_KEYS, names(s))]
    }
    used <- c(used, s$send_id)
    out[[length(out) + 1L]] <- s
  }
  out <- .cmail_sends_carry_exports(out, previous)
  # La apertura es un bloque más del envío: tiene que caber bajo el tope.
  if (any(vapply(out, function(s) !is.null(s$opening), NA)) && length(template$blocks %||% list()) >= .CMAIL_MAX_BLOCKS) {
    problems <- c(problems, list(.cmail_problem("sends", "opening_no_room",
      sprintf("La plantilla ya tiene %d bloques: no cabe la apertura de un envío.", .CMAIL_MAX_BLOCKS))))
  }
  # Aviso (no bloquea): un recordatorio con fecha que no viene después del envío previo.
  warnings <- list()
  for (i in seq_along(out)[-1]) {
    cur <- out[[i]]$date; prev <- out[[i - 1L]]$date
    if (!is.null(cur) && !is.null(prev) && cur <= prev) {
      warnings[[length(warnings) + 1L]] <- list(
        code = "send_dates", send_id = out[[i]]$send_id,
        detail = sprintf("%s tiene fecha %s, que no es posterior a la del envío anterior (%s).", out[[i]]$label, cur, prev)
      )
    }
  }
  list(ok = !length(problems), sends = out, problems = problems, warnings = warnings, seq = as.integer(seq))
}

.cmail_sends_or_stop <- function(sends, template, previous = NULL, seq = 0L) {
  v <- .cmail_sends_validate(sends, template, previous, seq)
  if (!isTRUE(v$ok)) {
    stop_api(422, "E_COLLECTION_MAIL_SEND_INVALID", "Los envíos de la campaña no cumplen las reglas.",
             details = list(problems = v$problems))
  }
  v
}

#' Plantilla efectiva de un envío: asunto, preheader y apertura del envío sobre
#' el cuerpo común. La apertura entra como párrafo `__apertura` justo después
#' del saludo (o al inicio), con la alineación del primer párrafo.
#' @keywords internal
.cmail_template_for_send <- function(tpl, send) {
  if (is.null(send)) return(tpl)
  t <- tpl
  if (!is.null(.cmail_opt_text(send$subject))) t$subject <- send$subject
  if (!is.null(.cmail_opt_text(send$preheader))) t$preheader <- send$preheader
  opening <- .cmail_opt_text(send$opening)
  if (!is.null(opening)) {
    blocks <- t$blocks %||% list()
    types <- vapply(blocks, function(b) as.character(b$type %||% ""), "")
    first_par <- which(types == "paragraph")[1]
    align <- if (!is.na(first_par)) .cmail_one(blocks[[first_par]]$align) else NULL
    block <- .cmc_drop_nulls_deep(list(block_id = .CMAIL_OPENING_ID, type = "paragraph", text = opening, align = align))
    at <- which(types == "greeting")[1]
    t$blocks <- append(blocks, list(block), after = if (is.na(at)) 0L else at)
  }
  t
}

#' Envío de un pedido: un borrador (`send`) o uno guardado (`send_id`; sin él, la invitación).
#' @return list(send, draft).
#' @keywords internal
.cmail_send_pick <- function(campaign, template, send_id = NULL, send = NULL) {
  sends <- .cmail_sends_of(campaign)
  if (is.list(send) && length(send)) {
    id <- .cmail_one(send$send_id)
    kind <- .cmail_one(send$kind)
    invitation <- identical(id, .CMAIL_SEND_INVITATION) || identical(kind, "invitacion")
    keys <- vapply(template$fields %||% list(), function(f) as.character(f$key %||% ""), "")
    pos <- if (!is.null(id)) match(id, vapply(sends, function(s) s$send_id, "")) else NA_integer_
    r <- .cmail_send_check(send, if (invitation) 1L else 2L, keys, if (is.na(pos)) length(sends) else pos - 1L)
    if (length(r$problems)) {
      stop_api(422, "E_COLLECTION_MAIL_SEND_INVALID", "El envío no cumple las reglas.",
               details = list(problems = r$problems))
    }
    out <- r$send
    if (!invitation) out$send_id <- if (!is.null(id) && grepl(.CMAIL_SEND_REMINDER_RE, id)) id else NULL
    return(list(send = out, draft = TRUE))
  }
  id <- .cmail_one(as.list(send_id %||% list(.CMAIL_SEND_INVITATION))) %||% .CMAIL_SEND_INVITATION
  for (s in sends) if (identical(s$send_id, id)) return(list(send = s, draft = FALSE))
  stop_api(404, "E_COLLECTION_MAIL_SEND_NOT_FOUND", "El envío no existe en esta campaña.",
           details = list(send_id = if (grepl("^[a-z0-9-]{1,40}$", id)) id else NULL,
                          sends = as.list(vapply(sends, function(s) s$send_id, ""))))
}
