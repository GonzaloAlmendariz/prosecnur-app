# =============================================================================
# Monitoreo › Correo: lectura incremental de un envío ya leído
#
# La lectura completa baja, por cada envío, a todos sus destinatarios dos veces
# (`sent-to` y `email-activity`). En Acreditación son ~45 mil personas en seis
# envíos y tardaba ~6 minutos (Gonzalo, 30/10). Mientras el campo está vivo lo
# que se mueve de un envío ya leído son las aperturas y los clics; la entrega
# (enviados y rebotes) casi no cambia.
#
# Si la entrega no cambió, se conservan los destinatarios guardados y se pide
# solo la actividad posterior a la última lectura (`email-activity?since=`).
# Las pocas personas con actividad nueva se identifican por su token pidiendo su
# ficha en la audiencia (`/lists/{id}/members/{email_id}`, el `email_id` del
# reporte es el hash del miembro). Los correos y sus hashes se usan solo en
# memoria, como en la lectura completa (ADR 0005, ADR 0112).
# =============================================================================

# Lo que cambia la lista de destinatarios de un envío: si esto se mueve, se relee entero.
.mcm_firma_entrega <- function(reporte) {
  paste(.mcm_int(reporte$emails_sent), .mcm_int(reporte$bounces$hard_bounces), .mcm_int(reporte$bounces$soft_bounces), sep = "|")
}

# La del envío guardado; las lecturas anteriores a este archivo no la traían y se
# reconstruye con sus enviados y rebotes, así la primera lectura tras actualizar
# la app ya es incremental.
.mcm_firma_entrega_guardada <- function(anterior) {
  guardada <- .mcm_chr(anterior$firma_entrega)
  if (nzchar(guardada)) return(guardada)
  paste(.mcm_int(anterior$enviados), .mcm_int(anterior$rebotes_duros), .mcm_int(anterior$rebotes_blandos), sep = "|")
}

# Margen para la actividad que Mailchimp registra con algo de retraso.
.MCM_MARGEN_SEGUNDOS <- 15L * 60L

# `leido_at` («2026-10-30T12:25:38-0500») menos el margen, en UTC ISO 8601; "" si no se puede leer.
.mcm_desde <- function(leido_at) {
  texto <- .mcm_chr(leido_at)
  if (!nzchar(texto)) return("")
  instante <- suppressWarnings(as.POSIXct(texto, format = "%Y-%m-%dT%H:%M:%S%z", tz = "UTC"))
  if (is.na(instante)) instante <- suppressWarnings(as.POSIXct(sub("Z$", "+0000", texto), format = "%Y-%m-%dT%H:%M:%S%z", tz = "UTC"))
  if (is.na(instante)) return("")
  format(instante - .MCM_MARGEN_SEGUNDOS, "%Y-%m-%dT%H:%M:%S+00:00", tz = "UTC")
}

# Token de cada `email_id`, pidiendo la ficha de cada miembro en paralelo.
.mcm_tokens_de_miembros <- function(key, list_id, email_ids) {
  email_ids <- unique(email_ids[nzchar(email_ids)])
  if (!length(email_ids)) return(stats::setNames(character(0), character(0)))
  out <- stats::setNames(rep("", length(email_ids)), email_ids)
  for (lote in split(email_ids, ceiling(seq_along(email_ids) / 8L))) {
    rutas <- sprintf("/lists/%s/members/%s", list_id, lote)
    consulta <- list(fields = "merge_fields")
    respuestas <- if (length(rutas) > 1L) .mcm_http_varias(vapply(rutas, function(r) .mcm_url(key, r, consulta), character(1)), key) else list(NULL)
    for (k in seq_along(lote)) {
      res <- respuestas[[k]]
      cuerpo <- if (is.list(res) && identical(as.integer(res$status %||% 0L), 200L)) res$body
        else tryCatch(.mc_call("GET", rutas[[k]], key, query = consulta), error = function(e) NULL)
      out[[lote[[k]]]] <- if (is.list(cuerpo)) .mcm_token_de_campos(cuerpo$merge_fields) else ""
    }
  }
  out
}

#' Suma a los destinatarios guardados de un envío la actividad posterior a `desde`.
#' Nadie pierde una apertura o un clic ya registrados: la actividad nueva solo agrega.
#' @keywords internal
.mcm_actualizar_personas <- function(key, list_id, campaign_id, previas, desde, avance = NULL) {
  actividad <- .mcm_paginas(key, sprintf("/reports/%s/email-activity", campaign_id), "emails",
                            fields = "emails.email_id,emails.activity", query = list(since = desde), avance = avance)
  if (!length(actividad)) return(previas)
  email_id <- vapply(actividad, function(p) .mcm_chr(p$email_id), character(1))
  tokens <- .mcm_tokens_de_miembros(key, list_id, email_id)
  for (persona in actividad) {
    token <- tokens[[.mcm_chr(persona$email_id)]] %||% ""
    if (!nzchar(token)) next
    i <- which(previas$token == token)
    if (!length(i)) next
    acciones <- persona$activity %||% list()
    if (any(vapply(acciones, function(a) identical(.mcm_chr(a$action), "open"), logical(1)))) previas$abrio[i] <- TRUE
    clics <- Filter(function(a) identical(.mcm_chr(a$action), "click") && .mcm_clic_en_encuesta(a$url), acciones)
    if (!length(clics)) next
    primero <- min(vapply(clics, function(a) .mcm_chr(a$timestamp), character(1)))
    previas$clic[i] <- TRUE
    previas$clic_at[i] <- ifelse(nzchar(previas$clic_at[i]) & previas$clic_at[i] < primero, previas$clic_at[i], primero)
  }
  previas
}
