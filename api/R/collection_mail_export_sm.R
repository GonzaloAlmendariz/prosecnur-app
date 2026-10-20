# collection_mail_export_sm.R — exportación de un envío para SurveyMonkey
# (ADR 0110, etapa E1j). El HTML lo escribe el MISMO render, en dialecto
# surveymonkey (collection_mail_dialects.R); aquí solo se empaqueta.
#
#   <campaign_id>_<send_id>_surveymonkey_<stamp>.zip     sensitivity none, role deliverable
#   ├── <campaign_id>-<send_id>.html   para pegar en «Formato HTML personalizado»; src https; [..] en href
#   ├── LEEME.txt                      asunto, fecha prevista, a quién, pasos, campo → [CustomDataN], plan Enterprise
#   └── manifest.json                  además registrado aparte (role manifest, uno solo)
#
# No hay audiencia: los contactos viven en el recopilador de SurveyMonkey. El
# HTML se verifica con `.cmail_sm_html_verify` antes de empaquetarlo.

.CMAIL_SM_AUDIENCE_SEND_TO <- c(sin_respuesta = "No response", parcial = "Partial response", ambos = "Both")

.cmail_leeme_sm <- function(tpl, send, subject, html_name) {
  fields <- .cmail_field_index(tpl)
  used <- setdiff(.cmail_used_keys(tpl), "nombre")
  rows <- vapply(used, function(k) sprintf("   {{%s}} (%s) -> [%s]", k, fields[[k]]$label %||% k, fields[[k]]$sm %||% "sin etiqueta"), "")
  reminder <- identical(send$kind, "recordatorio")
  c(
    "Correo para SurveyMonkey — cómo usar este paquete",
    "",
    .cmail_leeme_send(send, subject),
    "Requisito: el formato «HTML personalizado» de las invitaciones por correo es de los planes Enterprise.",
    "",
    if (!reminder) c(
      "1. En SurveyMonkey abre la encuesta > Recopilar respuestas > Invitación por correo electrónico (el recopilador).",
      "2. En Mensaje, elige el formato «HTML personalizado».",
      sprintf("3. Abre %s con un editor de texto, copia todo su contenido y pégalo en el mensaje.", html_name),
      "4. Escribe el asunto tal como figura arriba."
    ) else c(
      "1. En el mismo recopilador de la invitación, abre Seguimiento > Enviar recordatorio.",
      sprintf("2. En «Enviar a» elige «%s».", .CMAIL_SM_AUDIENCE_SEND_TO[[send$audience %||% "sin_respuesta"]] %||% "No response"),
      sprintf("3. Elige el formato «HTML personalizado» y pega el contenido de %s.", html_name),
      "4. Escribe el asunto tal como figura arriba."
    ),
    "5. Envía una prueba a tu propio correo antes de enviar o programar.",
    "",
    "Etiquetas: [FirstName] sale del nombre del contacto; [SurveyLink] es el enlace personal a la encuesta;",
    "[OptOutLink] y [PrivacyLink] los exige SurveyMonkey en el pie.",
    if (length(rows)) c("Campos del correo y su dato en Contactos de SurveyMonkey:", rows),
    "SurveyMonkey no tiene texto de respaldo: un contacto sin el dato verá un espacio vacío.",
    "",
    "Las imágenes se cargan desde su URL https pública; SurveyMonkey no las aloja para el HTML personalizado."
  )
}

#' Paquete de un envío para SurveyMonkey. Lo llama `collection_mail_export`
#' con la revisión ya aprobada.
#' @keywords internal
.cmail_export_surveymonkey <- function(sid, session, campaign, base_tpl, tpl, send, r, summary, slug) {
  html <- r$rendered$html
  verify <- .cmail_sm_html_verify(html)
  if (!isTRUE(verify$ok)) {
    stop_api(422, "E_COLLECTION_MAIL_REVIEW_BLOCKING", "El HTML para SurveyMonkey no pasa la verificación estructural.",
             details = list(problems = verify$problems))
  }
  work <- tempfile("cmail-export-sm-", tmpdir = file.path(session$dir, "downloads"))
  dir.create(work, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(work, recursive = TRUE, force = TRUE), add = TRUE)
  html_name <- paste0(substr(slug, 1L, 40L), "-", send$send_id, ".html")
  writeBin(charToRaw(enc2utf8(html)), file.path(work, html_name))
  writeLines(enc2utf8(.cmail_leeme_sm(tpl, send, r$rendered$subject, html_name)), file.path(work, "LEEME.txt"), useBytes = TRUE)
  entries <- c(html_name, "LEEME.txt")
  sha <- function(p) paste0("sha256:", tolower(digest::digest(file = p, algo = "sha256")))
  fields <- .cmail_field_index(tpl)
  used <- setdiff(.cmail_used_keys(tpl), "nombre")
  manifest <- list(
    schema = "collection_mail_export/v1",
    generated_at = .collection_now_iso(),
    audience = "client",
    sensitivity = "none",
    scope = "plantilla",
    platform = "surveymonkey",
    locale = "es-PE",
    generated_deliverables_outside_pulso = TRUE,
    secrets_included = FALSE,
    campaign = list(campaign_id = campaign$campaign_id, name = campaign$name %||% "", actor = campaign$actor %||% ""),
    send = .cmail_manifest_send(send, r$rendered$subject),
    template = list(template_id = base_tpl$template_id, preset_id = base_tpl$preset_id %||% "",
                    revision = as.integer(base_tpl$revision), template_sha256 = base_tpl$template_sha256),
    html = list(path = html_name, bytes = r$rendered$bytes, sha256 = sha(file.path(work, html_name)),
                verify = verify),
    images = unname(lapply(r$images, function(i) .cmc_drop_nulls_deep(list(
      id = i$id, hosted_url = i$url, type = i$type, width = i$size$width, height = i$size$height
    )))),
    tags = lapply(used, function(k) list(key = k, sm = fields[[k]]$sm)),
    checks = r$checks,
    files = lapply(entries, function(e) list(path = e, size_bytes = as.integer(file.info(file.path(work, e))$size),
                                             sha256 = sha(file.path(work, e)))),
    review = summary
  )
  manifest <- .cmail_mask_pii(.cmc_drop_nulls_deep(manifest))
  manifest_path <- file.path(work, "manifest.json")
  writeLines(jsonlite::toJSON(manifest, auto_unbox = TRUE, pretty = TRUE, null = "null"), manifest_path, useBytes = TRUE)

  stamp <- format(Sys.time(), "%Y%m%d-%H%M%S")
  zip_name <- .cmail_export_name(slug, send$send_id, "surveymonkey", stamp = stamp)
  zip_path <- file.path(session$dir, "downloads", paste0(uuid::UUIDgenerate(), "__", zip_name))
  zip::zip(zip_path, files = c(entries, "manifest.json"), root = work, mode = "mirror")
  manifest_name <- .cmail_export_name(slug, send$send_id, "surveymonkey_manifest", ext = "json")
  manifest_out <- file.path(session$dir, "downloads", paste0(uuid::UUIDgenerate(), "__", manifest_name))
  file.copy(manifest_path, manifest_out, overwrite = TRUE)
  artifacts <- list(
    .cmail_register_artifact(sid, zip_path, "collection_mail_sm_zip", zip_name, "deliverable", "application/zip", "none"),
    .cmail_register_artifact(sid, manifest_out, "collection_mail_manifest", manifest_name, "manifest", "application/json", "none")
  )
  list(
    ok = TRUE,
    campaign_id = campaign$campaign_id,
    platform = "surveymonkey",
    send_id = send$send_id,
    scope = "plantilla",
    artifacts = artifacts,
    zip = artifacts[[1]],
    html = list(name = html_name, bytes = r$rendered$bytes),
    manifest = manifest,
    review = summary
  )
}
