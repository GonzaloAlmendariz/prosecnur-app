# =============================================================================
# Monitoreo › Correo: lectura de Mailchimp (solo GET)
#
# Trae, para cada campaña enviada a la audiencia del estudio, lo que Monitoreo
# necesita para seguir el campo por correo: el reporte agregado, el estado de
# entrega de cada destinatario, quién abrió y quién hizo clic en el enlace de la
# encuesta, las bajas y las quejas; y de la audiencia, los correos que Mailchimp
# ya dio por inválidos (`cleaned`).
#
# La persona se identifica por el token de su enlace personal (`?t=`), que
# viaja en un campo de combinación: es la misma llave con la que Monitoreo
# cruza SurveyMonkey contra el universo. Los correos se usan solo en memoria
# para unir la actividad con el destinatario (por `email_id`) y no se guardan
# ni salen de aquí (ADR 0005, ADR 0112).
#
# Usa `.mc_call` y `.mc_job_submit` de `collection_mail_mailchimp.R` (con sus
# reintentos) sin tocarlos. Diseño y contrato:
# `docs/qa/checklist-monitoreo-mailchimp-t3-2026-10-22.md`.
# =============================================================================

.MCM_PAGINA <- 1000L

# Token del enlace personal en cualquier texto: `?t=abc` o `&t=abc`.
.mcm_token <- function(texto) {
  texto <- as.character(texto %||% "")
  m <- regmatches(texto, regexpr("[?&]t=([A-Za-z0-9_-]+)", texto))
  if (!length(m)) return("")
  sub("^[?&]t=", "", m[[1L]])
}

.mcm_token_de_campos <- function(merge_fields) {
  if (!is.list(merge_fields) || !length(merge_fields)) return("")
  for (valor in merge_fields) {
    tk <- .mcm_token(paste(unlist(valor, use.names = FALSE), collapse = " "))
    if (nzchar(tk)) return(tk)
  }
  ""
}

# Un clic cuenta como clic en la encuesta si el enlace es el campo de
# combinación del enlace personal (Mailchimp lo registra como `*|HTML:ENLACE|*`)
# o una URL de SurveyMonkey o con `?t=`; los demás enlaces del correo no.
.mcm_clic_en_encuesta <- function(url) {
  url <- as.character(url %||% "")
  grepl("^\\*\\|.*\\|\\*$", url) || grepl("surveymonkey|[?&]t=", url, ignore.case = TRUE)
}

.mcm_chr <- function(x, default = "") {
  x <- as.character(x %||% default)[1]
  if (is.na(x)) default else x
}

.mcm_int <- function(x) {
  x <- suppressWarnings(as.integer(x %||% 0L)[1])
  if (is.na(x)) 0L else x
}

# Todas las páginas de un recurso de Mailchimp.
.mcm_paginas <- function(key, path, item, fields = NULL, query = list(), avance = NULL) {
  out <- list()
  offset <- 0L
  repeat {
    q <- c(query, list(count = .MCM_PAGINA, offset = offset))
    if (!is.null(fields)) q$fields <- paste0(fields, ",total_items")
    body <- .mc_call("GET", path, key, query = q)
    items <- body[[item]] %||% list()
    out <- c(out, items)
    offset <- offset + length(items)
    total <- .mcm_int(body$total_items)
    if (is.function(avance)) avance(offset, total)
    if (!length(items) || offset >= total) break
  }
  out
}

# Campañas enviadas a la audiencia, de la más antigua a la más nueva.
.mcm_campanas_enviadas <- function(key, list_id) {
  campos <- paste(
    "campaigns.id", "campaigns.status", "campaigns.send_time", "campaigns.emails_sent",
    "campaigns.settings.title", "campaigns.settings.subject_line",
    "campaigns.recipients.list_id", "campaigns.recipients.segment_opts",
    sep = ","
  )
  todas <- .mcm_paginas(key, "/campaigns", "campaigns", fields = campos,
                        query = list(status = "sent", list_id = list_id, sort_field = "send_time", sort_dir = "ASC"))
  Filter(function(c) identical(.mcm_chr(c$recipients$list_id), list_id), todas)
}

.mcm_etiquetas <- function(key, list_id) {
  segs <- .mcm_paginas(key, sprintf("/lists/%s/segments", list_id), "segments",
                       fields = "segments.id,segments.name", query = list(type = "static"))
  stats::setNames(vapply(segs, function(s) .mcm_chr(s$name), character(1)),
                  vapply(segs, function(s) .mcm_chr(s$id), character(1)))
}

# Etiqueta del público y la excluida, desde las condiciones del segmento.
.mcm_segmento <- function(campana, etiquetas) {
  conds <- campana$recipients$segment_opts$conditions %||% list()
  incluye <- character(0)
  excluye <- character(0)
  for (cond in conds) {
    if (!identical(.mcm_chr(cond$condition_type), "StaticSegment")) next
    nombre <- unname(etiquetas[.mcm_chr(cond$value)])
    nombre <- if (length(nombre) && !is.na(nombre)) nombre else .mcm_chr(cond$value)
    if (identical(.mcm_chr(cond$op), "static_not")) excluye <- c(excluye, nombre) else incluye <- c(incluye, nombre)
  }
  list(etiqueta = paste(incluye, collapse = ", "), excluye = paste(excluye, collapse = ", "))
}

# Firma de un envío: si no cambió desde la última lectura, no se vuelve a leer
# destinatario por destinatario (un envío viejo deja de moverse en pocos días).
.mcm_firma <- function(reporte) {
  paste(
    .mcm_int(reporte$emails_sent), .mcm_int(reporte$bounces$hard_bounces), .mcm_int(reporte$bounces$soft_bounces),
    .mcm_int(reporte$unsubscribed), .mcm_int(reporte$abuse_reports),
    .mcm_int(reporte$opens$opens_total), .mcm_int(reporte$clicks$clicks_total),
    sep = "|"
  )
}

.mcm_resumen_reporte <- function(reporte) {
  list(
    enviados = .mcm_int(reporte$emails_sent),
    rebotes_duros = .mcm_int(reporte$bounces$hard_bounces),
    rebotes_blandos = .mcm_int(reporte$bounces$soft_bounces),
    bajas = .mcm_int(reporte$unsubscribed),
    quejas = .mcm_int(reporte$abuse_reports),
    aperturas_unicas = .mcm_int(reporte$opens$unique_opens),
    aperturas_sin_proxy = .mcm_int(reporte$opens$proxy_excluded_unique_opens %||% reporte$opens$unique_opens),
    clics_unicos = .mcm_int(reporte$clicks$unique_subscriber_clicks %||% reporte$clicks$unique_clicks)
  )
}

.mcm_df <- function(cols) as.data.frame(cols, stringsAsFactors = FALSE)

.mcm_personas_vacias <- function() {
  .mcm_df(list(campaign_id = character(0), token = character(0), entrega = character(0),
               abrio = logical(0), clic = logical(0), clic_at = character(0)))
}

# Destinatarios de un envío con su token, entrega, apertura y clic.
.mcm_leer_personas <- function(key, campaign_id, avance = NULL) {
  destinatarios <- .mcm_paginas(
    key, sprintf("/reports/%s/sent-to", campaign_id), "sent_to",
    fields = "sent_to.email_id,sent_to.status,sent_to.open_count,sent_to.merge_fields",
    avance = avance
  )
  if (!length(destinatarios)) return(.mcm_personas_vacias())
  email_id <- vapply(destinatarios, function(d) .mcm_chr(d$email_id), character(1))
  personas <- .mcm_df(list(
    campaign_id = rep(campaign_id, length(destinatarios)),
    token = vapply(destinatarios, function(d) .mcm_token_de_campos(d$merge_fields), character(1)),
    entrega = vapply(destinatarios, function(d) .mcm_chr(d$status, "sent"), character(1)),
    abrio = vapply(destinatarios, function(d) .mcm_int(d$open_count) > 0L, logical(1)),
    clic = rep(FALSE, length(destinatarios)),
    clic_at = rep("", length(destinatarios))
  ))
  actividad <- .mcm_paginas(key, sprintf("/reports/%s/email-activity", campaign_id), "emails",
                            fields = "emails.email_id,emails.activity")
  for (persona in actividad) {
    clics <- Filter(function(a) identical(.mcm_chr(a$action), "click") && .mcm_clic_en_encuesta(a$url), persona$activity %||% list())
    if (!length(clics)) next
    i <- match(.mcm_chr(persona$email_id), email_id)
    if (is.na(i)) next
    personas$clic[[i]] <- TRUE
    personas$clic_at[[i]] <- min(vapply(clics, function(a) .mcm_chr(a$timestamp), character(1)))
  }
  personas
}

.mcm_leer_bajas <- function(key, campaign_id) {
  filas <- .mcm_paginas(key, sprintf("/reports/%s/unsubscribed", campaign_id), "unsubscribes",
                        fields = "unsubscribes.merge_fields,unsubscribes.timestamp,unsubscribes.reason")
  .mcm_df(list(
    campaign_id = rep(campaign_id, length(filas)),
    token = vapply(filas, function(f) .mcm_token_de_campos(f$merge_fields), character(1)),
    fecha = vapply(filas, function(f) .mcm_chr(f$timestamp), character(1)),
    motivo = vapply(filas, function(f) .mcm_chr(f$reason), character(1))
  ))
}

.mcm_leer_quejas <- function(key, campaign_id) {
  filas <- .mcm_paginas(key, sprintf("/reports/%s/abuse-reports", campaign_id), "abuse_reports",
                        fields = "abuse_reports.merge_fields,abuse_reports.date")
  .mcm_df(list(
    campaign_id = rep(campaign_id, length(filas)),
    token = vapply(filas, function(f) .mcm_token_de_campos(f$merge_fields), character(1)),
    fecha = vapply(filas, function(f) .mcm_chr(f$date), character(1))
  ))
}

.mcm_leer_limpiados <- function(key, list_id) {
  filas <- .mcm_paginas(key, sprintf("/lists/%s/members", list_id), "members",
                        fields = "members.merge_fields,members.last_changed",
                        query = list(status = "cleaned"))
  .mcm_df(list(
    token = vapply(filas, function(f) .mcm_token_de_campos(f$merge_fields), character(1)),
    fecha = vapply(filas, function(f) .mcm_chr(f$last_changed), character(1)),
    motivo = rep("limpiado", length(filas))
  ))
}

#' Lectura completa (worker, sin sesión). `previo` es el snapshot guardado: los
#' envíos cuya firma no cambió se reutilizan tal cual.
#' @keywords internal
.mcm_leer <- function(key, list_id, previo = list(), report = function(...) invisible(NULL)) {
  report("campaigns", percent = 3, message = "Mailchimp: buscando los envíos de la audiencia...")
  campanas <- .mcm_campanas_enviadas(key, list_id)
  etiquetas <- .mcm_etiquetas(key, list_id)
  previos <- previo$envios %||% list()
  previas_personas <- previo$personas %||% .mcm_personas_vacias()
  envios <- list()
  personas <- list()
  bajas <- list()
  quejas <- list()
  n <- length(campanas)
  for (i in seq_along(campanas)) {
    campana <- campanas[[i]]
    id <- .mcm_chr(campana$id)
    titulo <- .mcm_chr(campana$settings$title)
    base_pct <- 5 + round(85 * (i - 1) / max(1L, n))
    report("campaign", current = i, total = n, percent = base_pct,
           message = sprintf("Mailchimp: envío %d de %d · %s", i, n, titulo))
    reporte <- .mc_call("GET", sprintf("/reports/%s", id), key)
    firma <- .mcm_firma(reporte)
    seg <- .mcm_segmento(campana, etiquetas)
    anterior <- previos[[id]]
    reutiliza <- !is.null(anterior) && identical(.mcm_chr(anterior$firma), firma) &&
      any(previas_personas$campaign_id == id)
    envios[[id]] <- c(
      list(
        campaign_id = id, titulo = titulo, asunto = .mcm_chr(campana$settings$subject_line),
        enviado_at = .mcm_chr(campana$send_time), etiqueta = seg$etiqueta, excluye = seg$excluye,
        tipo = if (nzchar(seg$excluye)) "recordatorio" else "invitacion",
        firma = firma
      ),
      .mcm_resumen_reporte(reporte)
    )
    if (reutiliza) {
      personas[[id]] <- previas_personas[previas_personas$campaign_id == id, , drop = FALSE]
      bajas[[id]] <- (previo$bajas %||% data.frame())[(previo$bajas$campaign_id %||% character(0)) == id, , drop = FALSE]
      quejas[[id]] <- (previo$quejas %||% data.frame())[(previo$quejas$campaign_id %||% character(0)) == id, , drop = FALSE]
      next
    }
    personas[[id]] <- .mcm_leer_personas(key, id, avance = function(hecho, total) {
      report("campaign", current = i, total = n, percent = base_pct,
             message = sprintf("Mailchimp: envío %d de %d · %s de %s destinatarios", i, n,
                               format(hecho, big.mark = ","), format(total, big.mark = ",")))
    })
    bajas[[id]] <- if (.mcm_int(reporte$unsubscribed) > 0L) .mcm_leer_bajas(key, id) else NULL
    quejas[[id]] <- if (.mcm_int(reporte$abuse_reports) > 0L) .mcm_leer_quejas(key, id) else NULL
  }
  report("cleaned", percent = 92, message = "Mailchimp: correos que la audiencia ya dio por inválidos...")
  limpiados <- .mcm_leer_limpiados(key, list_id)
  unir <- function(partes, vacio) {
    partes <- Filter(function(p) is.data.frame(p) && nrow(p), partes)
    if (!length(partes)) return(vacio)
    out <- do.call(rbind, unname(partes))
    rownames(out) <- NULL
    out
  }
  list(
    ok = TRUE,
    schema = "monitoreo_mailchimp_v1",
    list_id = list_id,
    leido_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"),
    envios = envios,
    personas = unir(personas, .mcm_personas_vacias()),
    bajas = unir(bajas, .mcm_df(list(campaign_id = character(0), token = character(0), fecha = character(0), motivo = character(0)))),
    quejas = unir(quejas, .mcm_df(list(campaign_id = character(0), token = character(0), fecha = character(0)))),
    limpiados = limpiados
  )
}

#' Worker del job «Actualizar desde Mailchimp» (corre en callr).
#' @param sid sesión (solo para trazabilidad: el worker no lee la sesión).
#' @param input_path RDS con la clave, la audiencia y el snapshot previo.
#' @keywords internal
monitoreo_mailchimp_sync_job <- function(sid, input_path, progress_path = NULL) {
  .mc_job_run(input_path, progress_path, function(input, report) {
    .mcm_leer(input$mc_key, input$list_id, previo = input$previo %||% list(), report = report)
  })
}
