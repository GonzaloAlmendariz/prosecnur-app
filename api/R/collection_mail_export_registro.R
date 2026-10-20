# collection_mail_export_registro.R — cada exportación de un envío deja registro
# (ADR 0111 §8, decisión 2026-10-20: «Registrar cada exportación»).
#
# Dos claves de SERVIDOR en el envío de `collection_state$mail_campaigns`:
#   last_export_at        ISO 8601 UTC del último export exitoso de ese envío
#   last_export_platform  mailchimp | surveymonkey (la del dialecto exportado)
# No guarda destinatarios, conteos ni direcciones: solo cuándo y por dónde.
#
# Son del servidor, no del cliente:
# - `.cmail_send_check()` las acepta en el cuerpo (un cliente que devuelve los
#   envíos tal como los leyó no recibe `unknown_key`), pero las descarta.
# - `.cmail_sends_validate()` las arrastra desde el envío GUARDADO con el mismo
#   `send_id`: guardar los envíos nunca borra ni inventa un registro.
# - Duplicar una campaña no las copia (la copia no se exportó nunca).
#
# Escribir el registro NO sube `state_revision`. Decisión de diseño: es
# metadato que el usuario no edita y que se conserva por arrastre, así que no
# hay actualización perdida posible; subir la revisión dejaría obsoleto el
# editor abierto tras cada exportación (el siguiente «Guardar» daría 409). Sí
# marca `project_dirty`: el registro viaja en el `.pulso`.

.CMAIL_SEND_SERVER_KEYS <- c("last_export_at", "last_export_platform")

# Envíos sin las claves de servidor (duplicar una campaña).
.cmail_sends_without_exports <- function(sends) {
  lapply(sends, function(s) {
    if (!is.list(s)) return(s)
    s[setdiff(names(s), .CMAIL_SEND_SERVER_KEYS)]
  })
}

# Arrastra el registro de exportación del envío guardado con el mismo send_id.
.cmail_sends_carry_exports <- function(sends, previous) {
  if (!length(previous)) return(sends)
  prev_ids <- vapply(previous, function(s) .cmail_one(s$send_id) %||% "", "")
  lapply(sends, function(s) {
    at <- match(s$send_id %||% "", prev_ids)
    if (is.na(at)) return(s)
    for (k in .CMAIL_SEND_SERVER_KEYS) {
      v <- previous[[at]][[k]]
      if (!is.null(v)) s[[k]] <- v
    }
    s
  })
}

#' Anota en el envío exportado cuándo y por qué plataforma salió.
#'
#' Lee la sesión fresca (después del render) y escribe solo `mail_campaigns`.
#' La campaña virtual `correo-1` (proyecto sin campañas) no se registra:
#' anotarla crearía una campaña que el usuario nunca creó. Una campaña aún en
#' migración (`mail_template`) se persiste como lista al registrarse.
#'
#' @return list(send_id, last_export_at, last_export_platform) o NULL.
#' @keywords internal
.cmail_export_record <- function(sid, campaign_id, send_id, platform) {
  session <- session_get(sid)
  state <- session$collection_state
  if (!is.list(state)) return(NULL)
  set <- .cmail_campaigns_of(state)
  ids <- vapply(set$campaigns, function(c) as.character(c$campaign_id), "")
  at <- match(campaign_id, ids)
  if (is.na(at)) return(NULL)
  campaign <- set$campaigns[[at]]
  sends <- .cmail_sends_of(campaign)
  send_ids <- vapply(sends, function(s) .cmail_one(s$send_id) %||% "", "")
  pos <- match(send_id, send_ids)
  if (is.na(pos)) return(NULL)
  now <- .collection_now_iso()
  sends[[pos]]$last_export_at <- now
  sends[[pos]]$last_export_platform <- platform
  campaign$sends <- sends
  campaigns <- set$campaigns
  campaigns[[at]] <- campaign
  state$mail_campaigns <- list(schema = COLLECTION_MAIL_CAMPAIGNS_SCHEMA, campaigns = unname(campaigns))
  state$mail_template <- NULL
  session$collection_state <- state
  session <- .mark_project_dirty(session)
  .session_env[[sid]] <- session
  list(send_id = send_id, last_export_at = now, last_export_platform = platform)
}

# Engancha el registro a la respuesta de un export exitoso.
.cmail_export_with_record <- function(sid, pick, result) {
  # `force` antes de leer la sesión: `result` es una promesa que, al evaluarse,
  # registra los artefactos en `session$files`. Leer la sesión primero y
  # escribirla después borraría ese registro.
  force(result)
  if (isTRUE(pick$virtual)) return(result)
  rec <- .cmail_export_record(sid, result$campaign_id, result$send_id, result$platform)
  if (!is.null(rec)) result$export_recorded <- rec
  result
}
