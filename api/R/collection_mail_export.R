# collection_mail_export.R — vista previa, revisión y exportación del correo
# (ADR 0110 §2). Por campaña, por envío (E1k) y en el dialecto de la plataforma
# de la campaña (E1j): Mailchimp aquí; SurveyMonkey en collection_mail_export_sm.R.
#
# Revisión antes de exportar: cada chequeo trae `code`, `status`
# (ok | warning | error) y su cifra (`value`). Un `error` bloquea la
# exportación; un `warning` se muestra y deja seguir.
#
# Exportación (síncrona; sobre 5 MB se rechaza), FUERA del `.pulso`, en
# `<session$dir>/downloads`. Con `scope = "completo"` (por defecto):
#   <campaign_id>_<send_id>_mailchimp_<stamp>.zip   sensitivity personal_data
#   ├── plantilla-mailchimp.zip              importable («Import ZIP»), sin datos personales
#   │   ├── <campaign_id>.html               src relativos o URL https declarada
#   │   └── <id>.png / <id>.jpg              en la raíz (collection_mail_import_zip.R)
#   ├── audiencia.csv                        Email Address, First Name, una columna por etiqueta
#   ├── LEEME.txt
#   └── manifest.json                        huellas, conteos y procedencia (sin correos)
# Con `scope = "plantilla"` se omiten los chequeos de audiencia y el entregable
# es solo el ZIP importable (sin datos personales).
# Siempre dos artefactos con `.register_output_file()`: el entregable
# (role = deliverable) y su manifest (role = manifest, exactamente uno).

.CMAIL_GMAIL_CLIP_BYTES <- 102L * 1024L
.CMAIL_EXPORT_MAX_BYTES <- 5L * 1024L * 1024L

.cmail_check <- function(code, status, value = NULL, detail = "", extra = NULL, targets = NULL) {
  out <- list(code = code, status = status, value = value, detail = detail)
  if (!is.null(extra)) out$items <- extra
  # Dónde se ve el chequeo en el correo (E1g §3): [{block_id, prop?}].
  if (length(targets)) out$targets <- targets
  .cmc_drop_nulls_deep(out)
}

.CMAIL_SCOPES <- c("completo", "plantilla")

# Con SurveyMonkey no hay audiencia que exportar (los contactos viven en su
# recopilador): el alcance por defecto es «plantilla» y «completo» es un 422.
.cmail_scope <- function(scope, platform = .CMAIL_PLATFORM_DEFAULT, default = NULL) {
  default <- default %||% if (identical(platform, "surveymonkey")) "plantilla" else "completo"
  value <- .cmail_one(as.list(scope %||% list(default)))
  if (is.null(value) || !(value %in% .CMAIL_SCOPES)) {
    stop_api(422, "E_COLLECTION_MAIL_MODE", "scope es completo o plantilla.")
  }
  if (identical(platform, "surveymonkey") && identical(value, "completo")) {
    stop_api(422, "E_COLLECTION_MAIL_PLATFORM",
             "Con SurveyMonkey los contactos viven en su recopilador: se exporta solo la plantilla (scope plantilla).",
             details = list(platform = "surveymonkey"))
  }
  value
}

# Campaña, plantilla y plataforma de una lectura (vista previa y revisión).
# Con la plantilla en el cuerpo, sin campaign_id y con dos o más campañas, se
# trabaja SIN campaña: es la miniatura de un preset (dialecto mailchimp, sin
# destinatarios). Con cero o una campaña, como siempre.
.cmail_work_for <- function(session, state, campaign_id, template) {
  if (!is.null(template) && is.null(.cmail_campaign_arg(campaign_id)) &&
      length(.cmail_campaigns_of(state)$campaigns) >= 2L) {
    return(list(campaign = NULL, template = .cmail_template_or_stop(template), platform = .CMAIL_PLATFORM_DEFAULT))
  }
  pick <- .cmail_campaign_for(session, state, campaign_id)
  list(campaign = pick$campaign, template = .cmail_working_template(pick$campaign, template),
       platform = .cmail_platform_of(pick$campaign))
}

# Recordatorio en Mailchimp (revisión metodológica E1jkl): la app no sabe quién
# respondió, así que audiencia.csv trae la población entera; el filtro se hace a
# mano en Mailchimp (un segmento). «parcial» no tiene sentido ahí: Mailchimp no
# sabe quién dejó la encuesta a medias.
.cmail_reminder_audience_check <- function(send, n_valid = NULL) {
  if (identical(send$audience, "parcial")) {
    return(.cmail_check("reminder_audience", "error", 0L,
      "En Mailchimp no se puede saber quién dejó la encuesta a medias: elige «sin_respuesta» o «ambos» y arma el segmento en Mailchimp."))
  }
  who <- if (is.null(n_valid)) "la audiencia de Mailchimp" else sprintf("audiencia.csv trae a los %d destinatarios", as.integer(n_valid))
  .cmail_check("reminder_audience", "warning", if (is.null(n_valid)) NULL else as.integer(n_valid),
               sprintf("Es un recordatorio y %s: la app no cruza con las respuestas. Excluye en Mailchimp, con un segmento, a quienes ya respondieron; si el enlace no es de un solo uso, deduplica luego en la base.", who))
}

# Cómo se aplicó la audiencia del envío (manifest `send.audience_applied`).
.cmail_audience_applied <- function(platform, send) {
  if (identical(platform, "surveymonkey")) {
    if (identical(send$kind, "recordatorio")) "filtro_de_la_plataforma" else "recopilador"
  } else if (identical(send$kind, "recordatorio")) "manual_en_plataforma" else "lista_importada"
}

# Campo `campaign_id` de una respuesta (se omite al trabajar sin campaña).
.cmail_with_campaign <- function(out, campaign) {
  if (is.null(campaign)) return(out)
  append(out, list(campaign_id = campaign$campaign_id), after = 1L)
}

# Plantilla de trabajo de una campaña: la del cuerpo (borrador sin guardar) o
# la guardada. El borrador recibe el `template_id` de la campaña, igual que al
# guardarlo, para que su huella sea la que tendría guardado.
.cmail_working_template <- function(campaign, template = NULL) {
  if (is.null(template)) return(.cmail_campaign_template_checked(campaign))
  if (is.list(template)) template$template_id <- campaign$campaign_id
  .cmail_template_or_stop(template)
}

# Estado para leer: con la plantilla en el cuerpo no hace falta validar el
# estado entero (H-e, 2 s con 2.373 unidades en cada pausa de tecleo).
.cmail_read_state <- function(session, template = NULL) {
  if (is.null(template)) .collection_current(session) else .cmail_state_light(session)
}

.cmail_synthetic_values <- function(template) {
  used_in_url <- unique(unlist(lapply(template$blocks %||% list(), function(b) {
    c(.cmail_tokens(.cmail_one(b$url) %||% ""))
  }), use.names = FALSE))
  fields <- list()
  for (f in template$fields %||% list()) {
    key <- as.character(f$key)
    fields[[key]] <- if (key %in% used_in_url) "https://example.org/" else sprintf("[%s]", f$label %||% key)
  }
  list(nombre = "Ana", fields = fields)
}

#' Vista previa del correo.
#'
#' @param mode "preview" (campos resueltos, imágenes incrustadas, pie del
#'   dialecto simulado), "export" (el HTML que sale, en el dialecto de la
#'   campaña) o "mailchimp" (alias: export en dialecto mailchimp).
#' @param recipient_index posición (1..n) en la muestra de destinatarios; sin
#'   destinatarios o sin índice se usa un destinatario sintético.
#' @param send_id envío guardado (sin él, la invitación); `send` un borrador.
#' @keywords internal
collection_mail_preview <- function(sid, mode = "preview", recipient_index = NULL, template = NULL,
                                    campaign_id = NULL, send_id = NULL, send = NULL) {
  mode <- .cmail_one(as.list(mode %||% list("preview"))) %||% "preview"
  if (!(mode %in% c("preview", "export", "mailchimp"))) {
    stop_api(422, "E_COLLECTION_MAIL_MODE", "mode es preview, export o mailchimp.")
  }
  session <- session_get(sid)
  work <- .cmail_work_for(session, .cmail_read_state(session, template), campaign_id, template)
  campaign <- work$campaign
  sp <- .cmail_send_pick(campaign %||% list(), work$template, send_id, send)
  tpl <- .cmail_template_for_send(work$template, sp$send)
  dialect <- if (identical(mode, "mailchimp")) "mailchimp" else work$platform
  images <- .cmail_images_resolve(session, tpl)
  recipient <- list(source = "synthetic", index = NULL)
  values <- .cmail_synthetic_values(tpl)
  store <- if (!is.null(campaign)) .cmail_recipients_load(session, campaign$campaign_id)
  if (identical(mode, "preview") && !is.null(store) && !is.null(recipient_index)) {
    resolved <- .cmail_recipients_resolve(store, tpl)
    idx <- suppressWarnings(as.integer(unlist(recipient_index)[[1]]))
    if (is.na(idx) || idx < 1L || idx > length(resolved$rows)) {
      stop_api(422, "E_COLLECTION_MAIL_RECIPIENT_INDEX",
               sprintf("recipient_index va de 1 a %d.", length(resolved$rows)))
    }
    # D6: ningún valor con forma de correo llega a la vista, ni al HTML de la vista previa.
    values <- .cmail_mask_pii(.cmail_recipient_values(store, resolved, resolved$rows[[idx]]))
    recipient <- list(source = "imported", index = idx)
  }
  rendered <- collection_mail_render(tpl, mode = if (identical(mode, "preview")) "preview" else "export",
                                     dialect = dialect, values = values, images = images)
  .cmail_with_campaign(list(
    ok = TRUE,
    mode = mode,
    platform = work$platform,
    dialect = dialect,
    send = .cmail_send_brief(sp$send),
    html = rendered$html,
    subject = rendered$subject,
    preheader = rendered$preheader,
    bytes = rendered$bytes,
    recipient = .cmc_drop_nulls_deep(c(recipient, list(
      nombre = values$nombre,
      fields = if (length(values$fields)) values$fields else structure(list(), names = character(0))
    )))
  ), campaign)
}

.cmail_text_check <- function(code, text, max_chars, empty_status, empty_detail, long_detail, ok_detail) {
  value <- trimws(as.character(text %||% ""))
  if (!nzchar(value)) return(.cmail_check(code, empty_status, 0L, empty_detail))
  if (nchar(value) > max_chars) return(.cmail_check(code, "warning", nchar(value), long_detail))
  .cmail_check(code, "ok", nchar(value), ok_detail)
}

#' Chequeos de la revisión de un envío.
#'
#' @param tpl plantilla EFECTIVA del envío (`.cmail_template_for_send`).
#' @param campaign campaña (NULL al trabajar sin campaña): decide el dialecto y
#'   de dónde se leen los destinatarios.
#' @keywords internal
.cmail_review_checks <- function(session, tpl, campaign, scope = "completo", send = NULL) {
  dialect <- if (is.null(campaign)) .CMAIL_PLATFORM_DEFAULT else .cmail_platform_of(campaign)
  campaign_id <- campaign$campaign_id
  images <- .cmail_images_resolve(session, tpl)
  rendered <- collection_mail_render(tpl, mode = "export", dialect = dialect, images = images)
  html <- rendered$html
  checks <- list()
  push <- function(x) checks[[length(checks) + 1L]] <<- x

  push(.cmail_text_check("subject", tpl$subject, 80L, "error", "Falta el asunto.",
                         "El asunto supera 80 caracteres; los clientes lo cortan.", "Asunto presente."))
  push(.cmail_text_check("preheader", tpl$preheader, 140L, "warning",
                         "Sin texto de vista previa, el cliente muestra el inicio del cuerpo.",
                         "El texto de vista previa supera 140 caracteres.", "Texto de vista previa presente."))

  push(if (rendered$bytes >= .CMAIL_GMAIL_CLIP_BYTES) {
    .cmail_check("html_weight", "error", rendered$bytes, "El HTML supera 102 KB y Gmail lo recorta.")
  } else {
    .cmail_check("html_weight", "ok", rendered$bytes, "El HTML queda bajo el recorte de Gmail (102 KB).")
  })

  push <- .cmail_image_checks(tpl, images, html, rendered$bytes, push, dialect)
  base <- list(rendered = rendered, images = images, dialect = dialect)
  send_warn <- if (!is.null(campaign)) .cmail_sends_validate(.cmail_sends_of(campaign), tpl)$warnings else list()
  push_send_dates <- function() {
    if (length(send_warn)) {
      push(.cmail_check("send_dates", "warning", length(send_warn),
                        paste(vapply(send_warn, `[[`, "", "detail"), collapse = " "),
                        extra = lapply(send_warn, function(w) list(send_id = w$send_id))))
    }
  }

  if (identical(dialect, "surveymonkey")) {
    push <- .cmail_sm_checks(tpl, html, push)
    push(.cmail_accent_check(tpl))
    push_send_dates()
    return(c(list(checks = checks), base))
  }

  footer_ok <- grepl("*|UNSUB|*", html, fixed = TRUE) && grepl("*|LIST:ADDRESSLINE|*", html, fixed = TRUE)
  push(.cmail_check("footer_unsub", if (footer_ok) "ok" else "error", as.integer(footer_ok),
                    if (footer_ok) "El pie lleva la baja (*|UNSUB|*) y la dirección de la lista." else "Falta *|UNSUB|* o *|LIST:ADDRESSLINE|* en el pie."))

  push(.cmail_accent_check(tpl))
  push_send_dates()
  if (identical(send$kind, "recordatorio")) {
    n_valid <- NULL
    if (!identical(scope, "plantilla") && !is.null(campaign)) {
      st <- .cmail_recipients_load(session, campaign_id)
      if (!is.null(st)) n_valid <- .cmail_recipients_resolve(st, tpl)$counts$valid
    }
    push(.cmail_reminder_audience_check(send, n_valid))
  }

  # Audiencia: con scope «plantilla» (o sin campaña) no hay audiencia que revisar.
  if (identical(scope, "plantilla") || is.null(campaign)) return(c(list(checks = checks), base))
  store <- .cmail_recipients_load(session, campaign_id)
  used <- .cmail_used_keys(tpl)
  fields <- .cmail_field_index(tpl)
  if (is.null(store)) {
    push(.cmail_check("recipients", "error", 0L, "Importa los destinatarios para exportar la audiencia."))
    return(c(list(checks = checks), base))
  }
  resolved <- .cmail_recipients_resolve(store, tpl)
  m <- store$mapping
  cn <- resolved$counts
  blank_note <- if (cn$rows_blank_dropped > 0L) sprintf(" Se descartaron %d filas vacías.", cn$rows_blank_dropped) else ""
  push(if (is.null(m$email_column)) {
    .cmail_check("recipients", "error", 0L, "Elige la columna del correo.")
  } else if (!cn$valid) {
    .cmail_check("recipients", "error", 0L, "Ningún destinatario tiene un correo válido.")
  } else if (cn$invalid_email + cn$without_email + cn$duplicated > 0L) {
    .cmail_check("recipients", "warning", cn$valid,
                 sprintf("%d de %d destinatarios reciben el correo; quedan fuera %d sin correo, %d con correo inválido y %d repetidos.%s",
                         cn$valid, cn$total, cn$without_email, cn$invalid_email, cn$duplicated, blank_note))
  } else {
    .cmail_check("recipients", "ok", cn$valid, sprintf("%d destinatarios válidos.%s", cn$valid, blank_note))
  })

  tag_rows <- list()
  missing_cols <- character(0)
  for (k in used) {
    if (identical(k, "nombre")) {
      tag <- "FNAME"; col <- m$name_column
    } else {
      tag <- fields[[k]]$tag; col <- m$fields[[k]]
    }
    if (is.null(col)) missing_cols <- c(missing_cols, tag)
    tag_rows[[length(tag_rows) + 1L]] <- list(key = k, tag = tag, column = col)
  }
  push(if (length(missing_cols)) {
    .cmail_check("tags_have_columns", "error", length(missing_cols),
                 sprintf("Etiquetas sin columna en la audiencia: %s.", paste(missing_cols, collapse = ", ")),
                 extra = lapply(tag_rows, .cmc_drop_nulls_deep))
  } else {
    .cmail_check("tags_have_columns", "ok", 0L, "Cada etiqueta usada tiene su columna en la audiencia.",
                 extra = lapply(tag_rows, .cmc_drop_nulls_deep))
  })

  # Sin dato (D4-D5), sobre los efectivos. El respaldo se evalúa donde se usa
  # el campo (collection_mail_usage.R): en un enlace no hay respaldo y un vacío
  # bloquea; en asunto/preheader y {{nombre}} fuera del saludo, tampoco.
  usage <- .cmail_key_usage(tpl)
  greeting_fb <- NULL
  for (b in tpl$blocks %||% list()) if (identical(b$type, "greeting")) { greeting_fb <- .cmail_one(b$fallback); break }
  empty_rows <- list()
  url_blocking <- character(0)
  uncovered <- FALSE
  uncovered_person <- rep(FALSE, length(resolved$rows))
  for (row in tag_rows) {
    if (is.null(row$column)) next
    values <- if (identical(row$key, "nombre")) resolved$first_name[resolved$rows] else .cmail_value(store$rows[[row$column]][resolved$rows])
    empty <- as.integer(sum(!nzchar(values)))
    uses <- usage[[row$key]] %||% character(0)
    fallback <- if (identical(row$key, "nombre")) greeting_fb else fields[[row$key]]$fallback
    covers <- .cmail_fallback_covers(row$key, uses, fallback, dialect)
    in_url <- "url" %in% uses
    if (empty > 0L && in_url) url_blocking <- c(url_blocking, row$tag)
    if (empty > 0L && !covers) {
      uncovered <- TRUE
      uncovered_person <- uncovered_person | !nzchar(values)
    }
    empty_rows[[length(empty_rows) + 1L]] <- .cmc_drop_nulls_deep(list(
      tag = row$tag, key = row$key, empty = empty, fallback = fallback,
      uses = as.list(uses), in_url = in_url, fallback_covers = covers
    ))
  }
  total_empty <- sum(vapply(empty_rows, function(r) r$empty, integer(1)))
  rule <- sprintf(" Cuenta como vacío una celda vacía, solo espacios o %s; el denominador son los %d destinatarios efectivos.",
                  .CMAIL_EMPTY_MARKERS_LABEL, cn$valid)
  push(.cmail_check(
    "fields_empty",
    if (length(url_blocking)) "error" else if (uncovered) "warning" else "ok",
    as.integer(total_empty),
    paste0(
      if (length(url_blocking)) {
        sprintf("%s va dentro de un enlace y le falta a algún destinatario: el enlace saldría roto. Completa la columna o quita a esas personas.",
                paste(url_blocking, collapse = ", "))
      } else if (uncovered) {
        sprintf("%d destinatarios no tienen dato en un campo que se usa sin respaldo (asunto, preheader, {{nombre}} fuera del saludo o campo sin respaldo): verán el espacio vacío.",
                as.integer(sum(uncovered_person)))
      } else if (!cn$valid) {
        "Sin destinatarios efectivos: no hay a quién revisar los campos."
      } else if (total_empty) {
        "Los destinatarios sin dato reciben el texto de respaldo en todos los lugares donde se usa el campo."
      } else {
        "Todos los destinatarios tienen dato en cada campo."
      },
      rule
    ),
    extra = empty_rows,
    targets = .cmail_key_targets(tpl, vapply(Filter(function(r) isTRUE(r$empty > 0L), empty_rows), `[[`, "", "key"))
  ))

  # Mismo correo, otro dato: el correo sale con la primera fila. En un enlace
  # (p. ej. un ENLACE personal) no se sabe cuál es el correcto: bloquea.
  conflicts <- resolved$conflicts
  url_keys <- names(Filter(function(u) "url" %in% u, usage))
  conflict_url <- any(vapply(conflicts, function(cf) any(unlist(cf$keys) %in% url_keys), NA))
  push(if (!length(conflicts)) {
    .cmail_check("duplicates_conflicting", "ok", 0L,
                 if (cn$duplicated) "Los correos repetidos traen los mismos datos; se usa la primera fila." else "No hay correos repetidos.")
  } else {
    .cmail_check("duplicates_conflicting", if (conflict_url) "error" else "warning", as.integer(length(conflicts)),
                 if (conflict_url) sprintf("%d correos repetidos traen otro valor en un campo de enlace: decide cuál vale y corrige el archivo.", length(conflicts))
                 else sprintf("%d correos repetidos traen datos distintos; se usa la primera fila de cada uno.", length(conflicts)),
                 extra = lapply(conflicts, function(cf) list(row = cf$row, first_row = cf$first_row, tags = cf$tags)))
  })

  n_unsplit <- resolved$counts$names_unsplit
  if (identical(m$name_format, "apellidos_coma_nombres")) {
    push(.cmail_check("names_unsplit", if (n_unsplit > 0L) "warning" else "ok", as.integer(n_unsplit),
                      if (n_unsplit > 0L) sprintf("%d nombres sin separar: el saludo usará el nombre completo.", n_unsplit)
                      else "Todos los nombres se separaron en apellidos y nombres."))
  } else if (n_unsplit > 0L) {
    push(.cmail_check("names_unsplit", "warning", as.integer(n_unsplit),
                      sprintf("%d nombres traen una coma: el saludo usará la cadena entera. Si son «APELLIDOS, NOMBRES», cambia el formato del nombre.", n_unsplit)))
  }
  c(list(checks = checks), base, list(store = store, resolved = resolved, tag_rows = tag_rows))
}

.cmail_review_summary <- function(checks) {
  st <- vapply(checks, function(c) c$status, "")
  list(ready = !any(st == "error"), errors = sum(st == "error"), warnings = sum(st == "warning"))
}

#' Revisión antes de exportar, del envío pedido y en el dialecto de la campaña.
#' @keywords internal
collection_mail_review <- function(sid, template = NULL, campaign_id = NULL, scope = NULL,
                                   send_id = NULL, send = NULL) {
  session <- session_get(sid)
  work <- .cmail_work_for(session, .cmail_read_state(session, template), campaign_id, template)
  scope <- .cmail_scope(scope, work$platform, default = if (is.null(work$campaign)) "plantilla")
  sp <- .cmail_send_pick(work$campaign %||% list(), work$template, send_id, send)
  r <- .cmail_review_checks(session, .cmail_template_for_send(work$template, sp$send), work$campaign, scope, sp$send)
  c(.cmail_with_campaign(.cmc_drop_nulls_deep(list(ok = TRUE, platform = work$platform, send_id = sp$send$send_id,
                                                  scope = scope, template_sha256 = work$template$template_sha256)),
                         work$campaign),
    .cmail_review_summary(r$checks), list(checks = r$checks))
}

.cmail_csv_cell <- function(x) {
  x <- enc2utf8(as.character(x))
  x[is.na(x)] <- ""
  paste0('"', gsub('"', '""', x, fixed = TRUE), '"')
}

.cmail_write_audience <- function(path, store, resolved, tag_rows) {
  extra <- Filter(function(r) !identical(r$key, "nombre"), tag_rows)
  header <- c("Email Address", "First Name", vapply(extra, function(r) r$tag, ""))
  rows <- resolved$rows
  cols <- list(resolved$email[rows], resolved$first_name[rows])
  # Un marcador de «sin dato» sale vacío: así Mailchimp aplica el respaldo (*|IF:TAG|*).
  for (r in extra) cols[[length(cols) + 1L]] <- .cmail_value(store$rows[[r$column]][rows])
  lines <- c(
    paste(.cmail_csv_cell(header), collapse = ","),
    if (length(rows)) do.call(paste, c(lapply(cols, .cmail_csv_cell), sep = ","))
  )
  con <- file(path, open = "wb"); on.exit(close(con))
  writeBin(charToRaw(enc2utf8(paste0(paste(lines, collapse = "\r\n"), "\r\n"))), con)
  header
}

.CMAIL_AUDIENCE_LABELS <- c(todos = "todos los contactos", sin_respuesta = "quienes no respondieron",
                            parcial = "quienes dejaron la encuesta a medias", ambos = "quienes no respondieron o la dejaron a medias")

# Líneas del LEEME que describen el envío (asunto, fecha prevista, a quién).
.cmail_leeme_send <- function(send, subject) {
  c(
    sprintf("Envío: %s.", send$label %||% "Invitación"),
    sprintf("Asunto: %s", subject %||% ""),
    if (!is.null(send$date)) sprintf("Fecha prevista: %s (solo planificación: el envío se programa en la plataforma).", send$date),
    sprintf("A quién: %s.", .CMAIL_AUDIENCE_LABELS[[send$audience %||% "todos"]] %||% send$audience),
    ""
  )
}

.cmail_leeme <- function(images, counts = NULL, html_name, send = NULL, subject = NULL) {
  hosted <- Filter(function(i) !is.null(i$url), images)
  reminder <- identical(send$kind, "recordatorio")
  c(
    "Correo para Mailchimp — cómo usar este paquete",
    "",
    if (!is.null(send)) .cmail_leeme_send(send, subject),
    if (!is.null(counts)) c(sprintf(paste0("Cifras: %d destinatarios en audiencia.csv de %d filas importadas ",
                   "(%d sin correo, %d con correo inválido, %d repetidos; %d filas vacías descartadas)."),
            counts$valid, counts$total, counts$without_email, counts$invalid_email, counts$duplicated,
            counts$rows_blank_dropped), ""),
    if (!is.null(counts)) c(
      "1. En Mailchimp, abre Audiencia > Importar contactos y sube audiencia.csv.",
      "   Cada columna corresponde a una etiqueta de combinación (First Name = FNAME).",
      "   Crea en la audiencia los campos que falten con la MISMA etiqueta del encabezado."
    ) else "1. Este paquete trae solo la plantilla: la audiencia se importa aparte.",
    sprintf("2. En Mailchimp, crea la plantilla con «Code your own» > «Import ZIP» y sube %s.", .CMAIL_IMPORT_ZIP_NAME),
    "   Mailchimp sube las imágenes a Content Studio y reescribe las rutas solo.",
    sprintf("   Dentro va un único HTML (%s) con las imágenes en la raíz.", html_name),
    if (length(hosted)) sprintf("   %d imágenes ya apuntan a su URL pública y no van en el ZIP.", length(hosted)),
    "3. Envía una prueba antes de programar la campaña.",
    if (reminder) c(
      "",
      if (!is.null(counts)) sprintf("Recordatorio: audiencia.csv trae a los %d destinatarios de la lista, no solo a quienes faltan.", counts$valid),
      "Recordatorio: Mailchimp no sabe quién ya respondió la encuesta. Envíalo a un segmento de la audiencia",
      "que excluya a quienes ya respondieron (la app no cruza la audiencia con las respuestas)."
    ),
    "",
    if (!is.null(counts)) "audiencia.csv contiene datos personales: no lo compartas ni lo guardes dentro del proyecto .pulso."
  )
}

# Nombre público de un artefacto, ≤ 80 caracteres (O2): recorta el slug si hace falta.
.cmail_export_name <- function(slug, send_id, suffix, ext = "zip", stamp = NULL) {
  tail <- paste0("_", send_id, "_", suffix, if (!is.null(stamp)) paste0("_", stamp), ".", ext)
  room <- max(1L, 80L - nchar(tail))
  paste0(gsub("-+$", "", substr(slug, 1L, room)), tail)
}

# Registra un artefacto de la exportación con sus metadatos de entregable.
.cmail_register_artifact <- function(sid, path, kind, name, role, media_type, sensitivity) {
  meta <- .register_output_file(sid, kind, path, original_name = name)
  files <- session_get(sid)$files
  digest_value <- paste0("sha256:", tolower(digest::digest(file = path, algo = "sha256")))
  files[[meta$file_id]]$sha256 <- digest_value
  files[[meta$file_id]]$media_type <- media_type
  files[[meta$file_id]]$role <- role
  files[[meta$file_id]]$audience <- "client"
  files[[meta$file_id]]$sensitivity <- sensitivity
  session_set(sid, "files", files)
  list(file_id = meta$file_id, role = role, filename = name, media_type = media_type,
       size_bytes = as.integer(meta$size), sha256 = digest_value,
       audience = "client", sensitivity = sensitivity)
}

# Bloque `send` del manifest: qué envío es y la huella de su definición.
.cmail_manifest_send <- function(send, subject, platform = .CMAIL_PLATFORM_DEFAULT) {
  .cmc_drop_nulls_deep(list(
    send_id = send$send_id, kind = send$kind, label = send$label, date = send$date,
    audience = send$audience, audience_applied = .cmail_audience_applied(platform, send),
    collector_label = send$collector_label,
    subject = subject, send_sha256 = collection_fingerprint(send)
  ))
}

#' Exporta un envío de la campaña (fuera del `.pulso`): el paquete para
#' Mailchimp o, si la campaña es de SurveyMonkey, el HTML personalizado
#' (collection_mail_export_sm.R).
#'
#' @param scope "completo" (ZIP con el importable, la audiencia, LEEME y
#'   manifest) o "plantilla" (solo el ZIP importable, sin chequeos de audiencia).
#'   Con SurveyMonkey solo «plantilla».
#' @param send_id envío (sin él, la invitación).
#' @keywords internal
collection_mail_export <- function(sid, expected_revision = NULL, campaign_id = NULL, scope = NULL, send_id = NULL) {
  session <- session_get(sid)
  state <- .collection_current(session)
  # Se exporta lo GUARDADO: la revisión que la pantalla vio es obligatoria.
  .collection_assert_revision(state, expected_revision)
  pick <- .cmail_campaign_for(session, state, campaign_id)
  campaign <- pick$campaign
  platform <- .cmail_platform_of(campaign)
  scope <- .cmail_scope(scope, platform)
  base_tpl <- .cmail_campaign_template_checked(campaign)
  send <- .cmail_send_pick(campaign, base_tpl, send_id)$send
  tpl <- .cmail_template_for_send(base_tpl, send)
  r <- .cmail_review_checks(session, tpl, campaign, scope, send)
  summary <- .cmail_review_summary(r$checks)
  if (!isTRUE(summary$ready)) {
    stop_api(422, "E_COLLECTION_MAIL_REVIEW_BLOCKING", "La revisión tiene errores; corrígelos antes de exportar.",
             details = list(checks = Filter(function(c) identical(c$status, "error"), r$checks)))
  }
  # Nombre público ≤ 80 caracteres (O2): el slug es el campaign_id (≤ 40).
  slug <- gsub("^-+|-+$", "", substr(gsub("[^a-z0-9]+", "-", tolower(campaign$campaign_id %||% "correo")), 1L, 40L))
  if (!nzchar(slug)) slug <- "correo"
  if (identical(platform, "surveymonkey")) {
    return(.cmail_export_with_record(sid, pick,
                                     .cmail_export_surveymonkey(sid, session, campaign, base_tpl, tpl, send, r, summary, slug)))
  }
  completo <- identical(scope, "completo")
  work <- tempfile("cmail-export-", tmpdir = file.path(session$dir, "downloads"))
  dir.create(work, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(work, recursive = TRUE, force = TRUE), add = TRUE)

  html_name <- paste0(slug, ".html")
  importable <- .cmail_import_zip_build(work, r$rendered$html, r$images, html_name)

  sha <- function(p) paste0("sha256:", tolower(digest::digest(file = p, algo = "sha256")))
  entries <- .CMAIL_IMPORT_ZIP_NAME
  columns <- character(0)
  if (completo) {
    columns <- .cmail_write_audience(file.path(work, "audiencia.csv"), r$store, r$resolved, r$tag_rows)
    entries <- c(entries, "audiencia.csv")
  }
  writeLines(enc2utf8(.cmail_leeme(r$images, if (completo) r$resolved$counts, html_name, send, r$rendered$subject)),
             file.path(work, "LEEME.txt"), useBytes = TRUE)
  entries <- c(entries, "LEEME.txt")
  sensitivity <- if (completo) "personal_data" else "none"

  manifest <- list(
    schema = "collection_mail_export/v1",
    generated_at = .collection_now_iso(),
    audience = "client",
    sensitivity = sensitivity,
    scope = scope,
    platform = "mailchimp",
    app_version = .audit_reference_app_version(),
    locale = "es-PE",
    generated_deliverables_outside_pulso = TRUE,
    secrets_included = FALSE,
    campaign = list(campaign_id = campaign$campaign_id, name = campaign$name %||% "", actor = campaign$actor %||% ""),
    send = .cmail_manifest_send(send, r$rendered$subject, "mailchimp"),
    template = list(template_id = base_tpl$template_id, preset_id = base_tpl$preset_id %||% "",
                    revision = as.integer(base_tpl$revision), template_sha256 = base_tpl$template_sha256),
    html_bytes = r$rendered$bytes,
    import_zip = list(path = .CMAIL_IMPORT_ZIP_NAME, size_bytes = importable$size_bytes,
                      sha256 = sha(importable$path), entries = importable$entries, html = html_name),
    images = unname(lapply(r$images, function(i) .cmc_drop_nulls_deep(list(
      id = i$id, file = if (is.null(i$url) && !is.null(i$path)) i$export_name, hosted_url = i$url,
      type = i$type, width = i$size$width, height = i$size$height
    )))),
    recipients = if (completo) list(
      rows = r$resolved$counts$valid,
      excluded = r$resolved$counts$total - r$resolved$counts$valid,
      source_file = r$store$file_name,
      imported_at = r$store$imported_at,
      source_sha256 = r$store$source_sha256,
      encoding = r$store$encoding,
      mapping = .cmc_drop_nulls_deep(r$store$mapping),
      name_format = r$store$mapping$name_format,
      counts = r$resolved$counts
    ),
    audience_columns = as.list(columns),
    tags = as.list(vapply(r$tag_rows %||% list(), function(t) t$tag, "")),
    checks = r$checks,
    files = lapply(entries, function(e) list(path = e, size_bytes = as.integer(file.info(file.path(work, e))$size),
                                             sha256 = sha(file.path(work, e)))),
    review = summary
  )
  manifest <- .cmc_drop_nulls_deep(manifest)
  # D6: el manifest nunca lleva un correo, venga de donde venga (p. ej. un encabezado).
  manifest <- .cmail_mask_pii(manifest)
  manifest_path <- file.path(work, "manifest.json")
  writeLines(jsonlite::toJSON(manifest, auto_unbox = TRUE, pretty = TRUE, null = "null"), manifest_path, useBytes = TRUE)

  stamp <- format(Sys.time(), "%Y%m%d-%H%M%S")
  if (completo) {
    zip_name <- .cmail_export_name(slug, send$send_id, "mailchimp", stamp = stamp)
    zip_path <- file.path(session$dir, "downloads", paste0(uuid::UUIDgenerate(), "__", zip_name))
    zip::zip(zip_path, files = c(entries, "manifest.json"), root = work, mode = "mirror")
  } else {
    # Solo la plantilla: el entregable ES el ZIP importable, tal cual se verificó.
    zip_name <- .cmail_export_name(slug, send$send_id, "plantilla-mailchimp", stamp = stamp)
    zip_path <- file.path(session$dir, "downloads", paste0(uuid::UUIDgenerate(), "__", zip_name))
    file.copy(importable$path, zip_path, overwrite = TRUE)
  }
  size <- file.info(zip_path)$size
  if (size > .CMAIL_EXPORT_MAX_BYTES) {
    unlink(zip_path, force = TRUE)
    stop_api(413, "E_COLLECTION_MAIL_EXPORT_TOO_LARGE",
             "El paquete supera 5 MB (revisa el peso de las imágenes).", details = list(size_bytes = as.integer(size)))
  }
  manifest_name <- .cmail_export_name(slug, send$send_id, "mailchimp_manifest", ext = "json")
  manifest_out <- file.path(session$dir, "downloads", paste0(uuid::UUIDgenerate(), "__", manifest_name))
  file.copy(manifest_path, manifest_out, overwrite = TRUE)

  artifacts <- list(
    .cmail_register_artifact(sid, zip_path, if (completo) "collection_mail_zip" else "collection_mail_template_zip",
                             zip_name, "deliverable", "application/zip", sensitivity),
    .cmail_register_artifact(sid, manifest_out, "collection_mail_manifest", manifest_name, "manifest",
                             "application/json", sensitivity)
  )
  # ADR 0111 §8: el envío anota cuándo y por dónde salió (collection_mail_export_registro.R).
  .cmail_export_with_record(sid, pick, list(
    ok = TRUE,
    campaign_id = campaign$campaign_id,
    platform = "mailchimp",
    send_id = send$send_id,
    scope = scope,
    artifacts = artifacts,
    zip = artifacts[[1]],
    import_zip = list(size_bytes = importable$size_bytes, entries = importable$entries, html = html_name),
    manifest = manifest,
    review = summary
  ))
}
