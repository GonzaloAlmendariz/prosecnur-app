# collection_mail_export.R — vista previa, revisión y exportación del correo
# para Mailchimp (ADR 0110 §2).
#
# Revisión antes de exportar: cada chequeo trae `code`, `status`
# (ok | warning | error) y su cifra (`value`). Un `error` bloquea la
# exportación; un `warning` se muestra y deja seguir.
#
# Exportación (síncrona; sobre 5 MB se rechaza), FUERA del `.pulso`, en
# `<session$dir>/downloads`. Con `scope = "completo"` (por defecto):
#   <campaign_id>_mailchimp_<stamp>.zip      sensitivity personal_data
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

.cmail_scope <- function(scope) {
  value <- .cmail_one(as.list(scope %||% list("completo")))
  if (is.null(value) || !(value %in% .CMAIL_SCOPES)) {
    stop_api(422, "E_COLLECTION_MAIL_MODE", "scope es completo o plantilla.")
  }
  value
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
#' @param mode "preview" (campos resueltos, imágenes incrustadas) o "mailchimp".
#' @param recipient_index posición (1..n) en la muestra de destinatarios; sin
#'   destinatarios o sin índice se usa un destinatario sintético.
#' @keywords internal
collection_mail_preview <- function(sid, mode = "preview", recipient_index = NULL, template = NULL,
                                    campaign_id = NULL) {
  mode <- .cmail_one(mode) %||% "preview"
  if (!(mode %in% c("preview", "mailchimp"))) {
    stop_api(422, "E_COLLECTION_MAIL_MODE", "mode es preview o mailchimp.")
  }
  session <- session_get(sid)
  pick <- .cmail_campaign_for(session, .cmail_read_state(session, template), campaign_id)
  tpl <- .cmail_working_template(pick$campaign, template)
  images <- .cmail_images_resolve(session, tpl)
  recipient <- list(source = "synthetic", index = NULL)
  values <- .cmail_synthetic_values(tpl)
  store <- .cmail_recipients_load(session, pick$campaign$campaign_id)
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
  rendered <- collection_mail_render(tpl, mode = mode, values = values, images = images)
  list(
    ok = TRUE,
    campaign_id = pick$campaign$campaign_id,
    mode = mode,
    html = rendered$html,
    subject = rendered$subject,
    preheader = rendered$preheader,
    bytes = rendered$bytes,
    recipient = .cmc_drop_nulls_deep(c(recipient, list(
      nombre = values$nombre,
      fields = if (length(values$fields)) values$fields else structure(list(), names = character(0))
    )))
  )
}

.cmail_review_checks <- function(session, tpl, campaign_id, scope = "completo") {
  images <- .cmail_images_resolve(session, tpl)
  rendered <- collection_mail_render(tpl, mode = "mailchimp", images = images)
  html <- rendered$html
  checks <- list()
  push <- function(x) checks[[length(checks) + 1L]] <<- x

  subject <- trimws(as.character(tpl$subject %||% ""))
  push(if (!nzchar(subject)) {
    .cmail_check("subject", "error", 0L, "Falta el asunto.")
  } else if (nchar(subject) > 80L) {
    .cmail_check("subject", "warning", nchar(subject), "El asunto supera 80 caracteres; los clientes lo cortan.")
  } else {
    .cmail_check("subject", "ok", nchar(subject), "Asunto presente.")
  })

  pre <- trimws(as.character(tpl$preheader %||% ""))
  push(if (!nzchar(pre)) {
    .cmail_check("preheader", "warning", 0L, "Sin texto de vista previa, el cliente muestra el inicio del cuerpo.")
  } else if (nchar(pre) > 140L) {
    .cmail_check("preheader", "warning", nchar(pre), "El texto de vista previa supera 140 caracteres.")
  } else {
    .cmail_check("preheader", "ok", nchar(pre), "Texto de vista previa presente.")
  })

  push(if (rendered$bytes >= .CMAIL_GMAIL_CLIP_BYTES) {
    .cmail_check("html_weight", "error", rendered$bytes, "El HTML supera 102 KB y Gmail lo recorta.")
  } else {
    .cmail_check("html_weight", "ok", rendered$bytes, "El HTML queda bajo el recorte de Gmail (102 KB).")
  })

  push <- .cmail_image_checks(tpl, images, html, rendered$bytes, push)

  footer_ok <- grepl("*|UNSUB|*", html, fixed = TRUE) && grepl("*|LIST:ADDRESSLINE|*", html, fixed = TRUE)
  push(.cmail_check("footer_unsub", if (footer_ok) "ok" else "error", as.integer(footer_ok),
                    if (footer_ok) "El pie lleva la baja (*|UNSUB|*) y la dirección de la lista." else "Falta *|UNSUB|* o *|LIST:ADDRESSLINE|* en el pie."))

  push(.cmail_accent_check(tpl))

  # Audiencia: con scope «plantilla» no hay audiencia que revisar.
  if (identical(scope, "plantilla")) return(list(checks = checks, rendered = rendered, images = images))
  store <- .cmail_recipients_load(session, campaign_id)
  used <- .cmail_used_keys(tpl)
  fields <- .cmail_field_index(tpl)
  if (is.null(store)) {
    push(.cmail_check("recipients", "error", 0L, "Importa los destinatarios para exportar la audiencia."))
    return(list(checks = checks, rendered = rendered, images = images))
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
    covers <- .cmail_fallback_covers(row$key, uses, fallback)
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
  list(checks = checks, rendered = rendered, images = images, store = store, resolved = resolved, tag_rows = tag_rows)
}

.cmail_review_summary <- function(checks) {
  st <- vapply(checks, function(c) c$status, "")
  list(ready = !any(st == "error"), errors = sum(st == "error"), warnings = sum(st == "warning"))
}

#' Revisión antes de exportar.
#' @keywords internal
collection_mail_review <- function(sid, template = NULL, campaign_id = NULL, scope = NULL) {
  scope <- .cmail_scope(scope)
  session <- session_get(sid)
  pick <- .cmail_campaign_for(session, .cmail_read_state(session, template), campaign_id)
  tpl <- .cmail_working_template(pick$campaign, template)
  r <- .cmail_review_checks(session, tpl, pick$campaign$campaign_id, scope)
  c(list(ok = TRUE, campaign_id = pick$campaign$campaign_id, scope = scope, template_sha256 = tpl$template_sha256),
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

.cmail_leeme <- function(images, counts = NULL, html_name) {
  hosted <- Filter(function(i) !is.null(i$url), images)
  c(
    "Correo para Mailchimp — cómo usar este paquete",
    "",
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
    "",
    if (!is.null(counts)) "audiencia.csv contiene datos personales: no lo compartas ni lo guardes dentro del proyecto .pulso."
  )
}

#' Exporta el paquete para Mailchimp (fuera del `.pulso`).
#'
#' @param scope "completo" (ZIP con el importable, la audiencia, LEEME y
#'   manifest) o "plantilla" (solo el ZIP importable, sin chequeos de audiencia).
#' @keywords internal
collection_mail_export <- function(sid, expected_revision = NULL, campaign_id = NULL, scope = NULL) {
  scope <- .cmail_scope(scope)
  session <- session_get(sid)
  state <- .collection_current(session)
  # Se exporta lo GUARDADO: la revisión que la pantalla vio es obligatoria.
  .collection_assert_revision(state, expected_revision)
  pick <- .cmail_campaign_for(session, state, campaign_id)
  campaign <- pick$campaign
  tpl <- .cmail_campaign_template_checked(campaign)
  r <- .cmail_review_checks(session, tpl, campaign$campaign_id, scope)
  summary <- .cmail_review_summary(r$checks)
  if (!isTRUE(summary$ready)) {
    stop_api(422, "E_COLLECTION_MAIL_REVIEW_BLOCKING", "La revisión tiene errores; corrígelos antes de exportar.",
             details = list(checks = Filter(function(c) identical(c$status, "error"), r$checks)))
  }
  completo <- identical(scope, "completo")
  work <- tempfile("cmail-export-", tmpdir = file.path(session$dir, "downloads"))
  dir.create(work, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(work, recursive = TRUE, force = TRUE), add = TRUE)

  # Nombre público ≤ 80 caracteres (O2): el slug es el campaign_id (≤ 40).
  slug <- gsub("^-+|-+$", "", substr(gsub("[^a-z0-9]+", "-", tolower(campaign$campaign_id %||% "correo")), 1L, 40L))
  if (!nzchar(slug)) slug <- "correo"
  html_name <- paste0(slug, ".html")
  importable <- .cmail_import_zip_build(work, r$rendered$html, r$images, html_name)

  sha <- function(p) paste0("sha256:", tolower(digest::digest(file = p, algo = "sha256")))
  entries <- .CMAIL_IMPORT_ZIP_NAME
  columns <- character(0)
  if (completo) {
    columns <- .cmail_write_audience(file.path(work, "audiencia.csv"), r$store, r$resolved, r$tag_rows)
    entries <- c(entries, "audiencia.csv")
  }
  writeLines(enc2utf8(.cmail_leeme(r$images, if (completo) r$resolved$counts, html_name)),
             file.path(work, "LEEME.txt"), useBytes = TRUE)
  entries <- c(entries, "LEEME.txt")
  sensitivity <- if (completo) "personal_data" else "none"

  manifest <- list(
    schema = "collection_mail_export/v1",
    generated_at = .collection_now_iso(),
    audience = "client",
    sensitivity = sensitivity,
    scope = scope,
    locale = "es-PE",
    generated_deliverables_outside_pulso = TRUE,
    secrets_included = FALSE,
    campaign = list(campaign_id = campaign$campaign_id, name = campaign$name %||% "", actor = campaign$actor %||% ""),
    template = list(template_id = tpl$template_id, preset_id = tpl$preset_id %||% "",
                    revision = as.integer(tpl$revision), template_sha256 = tpl$template_sha256),
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
    zip_name <- sprintf("%s_mailchimp_%s.zip", slug, stamp)
    zip_path <- file.path(session$dir, "downloads", paste0(uuid::UUIDgenerate(), "__", zip_name))
    zip::zip(zip_path, files = c(entries, "manifest.json"), root = work, mode = "mirror")
  } else {
    # Solo la plantilla: el entregable ES el ZIP importable, tal cual se verificó.
    zip_name <- sprintf("%s_plantilla-mailchimp_%s.zip", slug, stamp)
    zip_path <- file.path(session$dir, "downloads", paste0(uuid::UUIDgenerate(), "__", zip_name))
    file.copy(importable$path, zip_path, overwrite = TRUE)
  }
  size <- file.info(zip_path)$size
  if (size > .CMAIL_EXPORT_MAX_BYTES) {
    unlink(zip_path, force = TRUE)
    stop_api(413, "E_COLLECTION_MAIL_EXPORT_TOO_LARGE",
             "El paquete supera 5 MB (revisa el peso de las imágenes).", details = list(size_bytes = as.integer(size)))
  }
  manifest_out <- file.path(session$dir, "downloads", paste0(uuid::UUIDgenerate(), "__", slug, "_mailchimp_manifest.json"))
  file.copy(manifest_path, manifest_out, overwrite = TRUE)

  register <- function(path, kind, name, role, media_type) {
    meta <- .register_output_file(sid, kind, path, original_name = name)
    files <- session_get(sid)$files
    digest_value <- sha(path)
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
  artifacts <- list(
    register(zip_path, if (completo) "collection_mail_zip" else "collection_mail_template_zip", zip_name,
             "deliverable", "application/zip"),
    register(manifest_out, "collection_mail_manifest", sprintf("%s_mailchimp_manifest.json", slug), "manifest", "application/json")
  )
  list(
    ok = TRUE,
    campaign_id = campaign$campaign_id,
    scope = scope,
    artifacts = artifacts,
    zip = artifacts[[1]],
    import_zip = list(size_bytes = importable$size_bytes, entries = importable$entries, html = html_name),
    manifest = manifest,
    review = summary
  )
}
