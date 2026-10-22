# collection_mail_campaigns.R — campañas de correo de Material de campo
# (ADR 0110, etapa E1h: «varios correos por proyecto»).
#
# Contrato `collection_mail_campaigns/v1`, en `collection_state$mail_campaigns`:
#
#   { schema, campaigns: [ { campaign_id, name, actor, created_at, updated_at,
#                            duplicated_from?, platform?, sends?, send_seq?,
#                            imported_from?, template } ] }
#
# Claves opcionales de E1j/E1k/E1l (sin cambio de esquema, H-k2):
# - `platform`: mailchimp | surveymonkey; sin ella, al leer vale mailchimp
#   (collection_mail_dialects.R). Pasar a surveymonkey ya NO purga los
#   destinatarios (ADR 0112 §1): siguen siendo los contactos de la campaña.
# - `contact_control`: variables de control de la pestaña Contactos (solo
#   nombres de columna; clave de servidor, collection_mail_contactos.R).
# - `sends` y `send_seq`: la invitación y sus recordatorios (collection_mail_sends.R).
# - `imported_from`: { sha256, imported_at, platform_detected, report } de un HTML
#   importado (collection_mail_import_html.R). El HTML crudo nunca se guarda.
#
# - `campaign_id` sale del nombre (`^[a-z0-9][a-z0-9-]{0,39}$`), es único y no
#   cambia al renombrar: es la llave de la carpeta de destinatarios y del ZIP.
# - `template` es la plantilla completa (`collection_mail_template/v1`) y su
#   `template_id` se fuerza a `campaign_id` en cada escritura.
# - `name` (1-80) y `actor` (0-60) son texto libre que rechaza todo valor con
#   forma de correo: un nombre de campaña viaja al manifest y al `.pulso`.
# - Máximo 20 campañas.
#
# **Migración en lectura.** Un estado anterior trae `mail_template` (singular).
# `.cmail_campaigns_of()` lo lee como UNA campaña sin escribir nada; la primera
# escritura persiste `mail_campaigns` y borra `mail_template`. Sin ninguna de
# las dos, la lista está vacía y la API sin `campaign_id` sirve la plantilla de
# fábrica bajo la campaña virtual `correo-1` (la que crea el primer PUT).
#
# **Destinatarios.** Por campaña, en `<session$dir>/mail_recipients/<id>/` (ver
# collection_mail_recipients.R) y, al guardar, en `files/contactos/<id>.rds`
# del `.pulso` (ADR 0112). Un `recipients.rds` de la raíz (sesión de una
# versión anterior) se mueve a la carpeta de la única campaña. Duplicar NO
# copia destinatarios, mapeo ni variables de control: son de la campaña. Borrar
# una campaña borra su carpeta.
#
# Revisión: toda escritura exige `expected_revision = state_revision` (global).

COLLECTION_MAIL_CAMPAIGNS_SCHEMA <- "collection_mail_campaigns/v1"
.CMAIL_CAMPAIGNS_MAX <- 20L
.CMAIL_CAMPAIGN_ID_RE <- "^[a-z0-9][a-z0-9-]{0,39}$"
.CMAIL_CAMPAIGN_DEFAULT_ID <- "correo-1"

# ---- lectura ------------------------------------------------------------------

# Estado sin `collection_state_validate` (H-e): para la vista previa y la
# revisión con la plantilla en el cuerpo, que no escriben ni leen la plantilla
# guardada. Escribir y exportar siguen pasando por `.collection_current`.
.cmail_state_light <- function(session) {
  state <- session$collection_state
  if (is.null(state)) return(.collection_empty_state())
  state$state_revision <- as.integer(state$state_revision %||% 0L)
  state
}

.cmail_campaign_id_ok <- function(x) {
  is.character(x) && length(x) == 1L && !is.na(x) && grepl(.CMAIL_CAMPAIGN_ID_RE, x)
}

# Id desde un texto: minúsculas ASCII, guiones, hasta 40. NULL si no queda nada.
.cmail_campaign_slug <- function(text) {
  value <- .cmail_one(text)
  if (is.null(value)) return(NULL)
  s <- stringi::stri_trans_general(tolower(value), "Latin-ASCII")
  s <- gsub("[^a-z0-9]+", "-", s)
  s <- gsub("^-+|-+$", "", s)
  s <- gsub("-+$", "", substr(s, 1L, 40L))
  if (!nzchar(s)) NULL else s
}

.cmail_campaign_unique_id <- function(base, taken) {
  base <- base %||% "correo"
  if (!(base %in% taken)) return(base)
  for (i in 2:999) {
    suffix <- paste0("-", i)
    cand <- paste0(gsub("-+$", "", substr(base, 1L, 40L - nchar(suffix))), suffix)
    if (!(cand %in% taken)) return(cand)
  }
  stop_api(409, "E_COLLECTION_MAIL_CAMPAIGN_LIMIT", "No quedan ids libres para la campaña.")
}

# Plantilla de una campaña: `template_id := campaign_id` y huella recalculada.
.cmail_campaign_template <- function(template, campaign_id, revision = NULL) {
  if (!is.list(template)) return(template)
  template$template_id <- campaign_id
  .cmail_template_normalize(template, revision = revision)
}

#' Campañas de un collection_state, con la migración en lectura.
#'
#' @return list(campaigns, legacy_migrated, persisted). `persisted` dice si
#'   `mail_campaigns` ya está escrito (FALSE en la migración y en el vacío).
#' @keywords internal
.cmail_campaigns_of <- function(state) {
  stored <- state$mail_campaigns
  if (is.list(stored)) {
    campaigns <- lapply(Filter(is.list, unname(stored$campaigns %||% list())), .cmail_campaign_upgrade)
    return(list(campaigns = campaigns, legacy_migrated = FALSE, persisted = TRUE))
  }
  legacy <- state$mail_template
  if (is.list(legacy)) {
    id <- .cmail_campaign_slug(legacy$title) %||% .CMAIL_CAMPAIGN_DEFAULT_ID
    name <- .cmail_one(legacy$title) %||% "Correo"
    campaign <- list(
      campaign_id = id,
      name = substr(name, 1L, 80L),
      actor = "",
      template = .cmail_campaign_template(legacy, id)
    )
    return(list(campaigns = list(campaign), legacy_migrated = TRUE, persisted = FALSE))
  }
  list(campaigns = list(), legacy_migrated = FALSE, persisted = FALSE)
}

# Una plantilla v1 guardada (E1h) se lee como v2: mismo contenido, huella nueva.
# Sin `platform` (campañas anteriores a E1j) vale mailchimp. Es una lectura: no
# se escribe nada.
.cmail_campaign_upgrade <- function(campaign) {
  t <- campaign$template
  if (is.list(t) && identical(t$schema, COLLECTION_MAIL_TEMPLATE_SCHEMA_V1)) {
    campaign$template <- .cmail_template_normalize(t)
  }
  campaign$platform <- .cmail_platform_of(campaign)
  campaign
}

# La campaña virtual del proyecto sin correos: la plantilla de fábrica.
.cmail_campaign_virtual <- function() {
  tpl <- .cmail_builtin_template()
  list(
    campaign_id = .CMAIL_CAMPAIGN_DEFAULT_ID,
    name = tpl$title %||% "Correo",
    actor = "",
    platform = .CMAIL_PLATFORM_DEFAULT,
    template = .cmail_campaign_template(tpl, .CMAIL_CAMPAIGN_DEFAULT_ID)
  )
}

.cmail_campaign_arg <- function(campaign_id) {
  if (is.null(campaign_id)) return(NULL)
  value <- .cmail_one(as.list(campaign_id))
  if (is.null(value) || !nzchar(trimws(value))) return(NULL)
  trimws(value)
}

#' Resuelve la campaña de un pedido.
#'
#' Con `campaign_id`, esa (404 si no existe). Sin él: con una sola, esa; con
#' ninguna, la virtual `correo-1`; con dos o más, 422.
#'
#' @return list(campaign, virtual, legacy_migrated, set).
#' @keywords internal
.cmail_campaign_pick <- function(state, campaign_id = NULL) {
  set <- .cmail_campaigns_of(state)
  id <- .cmail_campaign_arg(campaign_id)
  camps <- set$campaigns
  out <- function(campaign, virtual = FALSE) {
    list(campaign = campaign, virtual = virtual, legacy_migrated = set$legacy_migrated, set = set)
  }
  if (!is.null(id)) {
    for (c in camps) if (identical(c$campaign_id, id)) return(out(c))
    if (!length(camps) && identical(id, .CMAIL_CAMPAIGN_DEFAULT_ID)) return(out(.cmail_campaign_virtual(), TRUE))
    stop_api(404, "E_COLLECTION_MAIL_CAMPAIGN_NOT_FOUND", "La campaña de correo no existe en este proyecto.",
             details = list(campaign_id = if (.cmail_campaign_id_ok(id)) id else NULL))
  }
  if (length(camps) == 1L) return(out(camps[[1]]))
  if (!length(camps)) return(out(.cmail_campaign_virtual(), TRUE))
  stop_api(422, "E_COLLECTION_MAIL_CAMPAIGN_REQUIRED",
           "El proyecto tiene varias campañas de correo: indica campaign_id.",
           details = list(campaigns = as.list(vapply(camps, function(c) as.character(c$campaign_id), ""))))
}

# Resolución con sesión: además adopta el recipients.rds antiguo de la raíz
# cuando hay a lo sumo una campaña (la única a la que puede pertenecer).
.cmail_campaign_for <- function(session, state, campaign_id = NULL) {
  pick <- .cmail_campaign_pick(state, campaign_id)
  if (length(pick$set$campaigns) <= 1L) .cmail_recipients_adopt_legacy(session, pick$campaign$campaign_id)
  pick
}

# ---- escritura ----------------------------------------------------------------

.cmail_campaign_text <- function(x, what, min_chars, max_chars) {
  value <- .cmail_one(as.list(x %||% list(NA_character_)))
  if (is.null(value)) {
    stop_api(422, "E_COLLECTION_MAIL_CAMPAIGN_NAME", sprintf("%s debe ser un texto.", what))
  }
  value <- trimws(gsub("[[:cntrl:]]+", " ", value))
  if (nchar(value) < min_chars || nchar(value) > max_chars) {
    stop_api(422, "E_COLLECTION_MAIL_CAMPAIGN_NAME",
             sprintf("%s va de %d a %d caracteres.", what, min_chars, max_chars))
  }
  # Un correo en el nombre llegaría al manifest y al .pulso. No se cita el valor.
  if (grepl(.CMAIL_EMAIL_LIKE_RE, value)) {
    stop_api(422, "E_COLLECTION_MAIL_CAMPAIGN_NAME",
             sprintf("%s no puede llevar una dirección de correo.", what))
  }
  value
}

.cmail_campaign_assert_room <- function(campaigns) {
  if (length(campaigns) >= .CMAIL_CAMPAIGNS_MAX) {
    stop_api(409, "E_COLLECTION_MAIL_CAMPAIGN_LIMIT",
             sprintf("Un proyecto admite hasta %d campañas de correo.", .CMAIL_CAMPAIGNS_MAX))
  }
}

# Persiste la lista entera: escribe `mail_campaigns`, borra `mail_template`
# (la migración termina aquí) y sube la revisión global.
.cmail_campaigns_commit <- function(sid, current, campaigns) {
  next_state <- current
  next_state$mail_campaigns <- list(schema = COLLECTION_MAIL_CAMPAIGNS_SCHEMA, campaigns = unname(campaigns))
  next_state$mail_template <- NULL
  next_state$state_revision <- as.integer(current$state_revision) + 1L
  .collection_store(sid, next_state)
  next_state
}

# Reemplaza (o agrega) una campaña en la lista; la migrada recibe sus fechas.
.cmail_campaigns_upsert <- function(campaigns, campaign) {
  now <- .collection_now_iso()
  campaign$created_at <- campaign$created_at %||% now
  campaign$updated_at <- now
  ids <- vapply(campaigns, function(c) as.character(c$campaign_id), "")
  at <- match(campaign$campaign_id, ids)
  if (is.na(at)) campaigns[[length(campaigns) + 1L]] <- campaign else campaigns[[at]] <- campaign
  campaigns
}

.cmail_campaign_public <- function(campaign, with_template = TRUE) {
  out <- campaign[intersect(c("campaign_id", "name", "actor", "created_at", "updated_at", "duplicated_from",
                              "imported_from", "template"),
                            names(campaign))]
  out$platform <- .cmail_platform_of(campaign)
  out$sends <- .cmail_sends_of(campaign)
  if (!with_template) out$template <- NULL
  .cmc_drop_nulls_deep(out)
}

.cmail_campaign_summary <- function(session, campaign) {
  t <- campaign$template %||% list()
  .cmc_drop_nulls_deep(list(
    campaign_id = campaign$campaign_id,
    name = campaign$name,
    actor = campaign$actor %||% "",
    preset_id = t$preset_id,
    subject = t$subject %||% "",
    blocks = length(t$blocks %||% list()),
    template_revision = as.integer(t$revision %||% 1L),
    template_sha256 = t$template_sha256,
    platform = .cmail_platform_of(campaign),
    sends = lapply(.cmail_sends_of(campaign), .cmail_send_brief, with_audience = FALSE),
    updated_at = campaign$updated_at,
    # Solo si existe el archivo: ni conteos ni nombres (datos personales).
    recipients_loaded = file.exists(.cmail_recipients_path(session, campaign$campaign_id))
  ))
}

# ---- API ----------------------------------------------------------------------

#' Lista de campañas: solo el resumen, sin la plantilla completa.
#' @keywords internal
collection_mail_campaigns_get <- function(sid) {
  session <- session_get(sid)
  state <- .collection_current(session)
  set <- .cmail_campaigns_of(state)
  if (length(set$campaigns) == 1L) .cmail_recipients_adopt_legacy(session, set$campaigns[[1]]$campaign_id)
  list(
    ok = TRUE,
    state_revision = as.integer(state$state_revision),
    legacy_migrated = isTRUE(set$legacy_migrated),
    campaigns = lapply(set$campaigns, function(c) .cmail_campaign_summary(session, c))
  )
}

#' Crea una campaña desde un preset (por defecto, el de recuperación) o desde
#' una plantilla del cuerpo (p. ej. un HTML importado, con su `import_id`).
#' @keywords internal
collection_mail_campaign_create <- function(sid, expected_revision, name, actor = NULL, preset_id = NULL,
                                            platform = NULL, template = NULL, import_id = NULL) {
  session <- session_get(sid)
  current <- .collection_current(session)
  .collection_assert_revision(current, expected_revision)
  name <- .cmail_campaign_text(name, "name", 1L, 80L)
  actor <- if (is.null(actor)) "" else .cmail_campaign_text(actor, "actor", 0L, 60L)
  platform <- .cmail_platform_arg(platform) %||% .CMAIL_PLATFORM_DEFAULT
  if (!is.null(template) && !is.null(preset_id)) {
    stop_api(422, "E_COLLECTION_MAIL_TEMPLATE_INVALID", "Indica preset_id o template, no los dos.")
  }
  presets <- .cmail_presets()
  if (is.null(template)) {
    preset <- .cmail_one(as.list(preset_id %||% list("recuperacion_estudiantes_v1")))
    if (is.null(preset) || !(preset %in% names(presets))) {
      stop_api(422, "E_COLLECTION_MAIL_TEMPLATE_INVALID", "preset_id no es un preset de correo.",
               details = list(presets = as.list(names(presets))))
    }
  }
  imported <- if (!is.null(import_id)) .cmail_import_lookup(sid, import_id) else NULL
  set <- .cmail_campaigns_of(current)
  campaigns <- set$campaigns
  .cmail_campaign_assert_room(campaigns)
  ids <- vapply(campaigns, function(c) as.character(c$campaign_id), "")
  id <- .cmail_campaign_unique_id(.cmail_campaign_slug(name), ids)
  base <- if (is.null(template)) presets[[preset]]() else {
    if (is.list(template)) template$template_id <- id
    .cmail_template_or_stop(template)
  }
  campaign <- list(campaign_id = id, name = name, actor = actor, platform = platform,
                   sends = list(.cmail_send_invitation_default()),
                   template = .cmail_campaign_template(base, id, revision = 1L))
  if (!is.null(imported)) campaign$imported_from <- imported
  # Destinatarios importados con la campaña virtual `correo-1` (sin campañas
  # guardadas): al crear la primera campaña real se purgan y se dice, en vez de
  # adoptarlos en silencio en una campaña que no es la suya (decisión del lead).
  purged_virtual <- FALSE
  if (!length(campaigns)) {
    purged_virtual <- file.exists(.cmail_recipients_path(session, .CMAIL_CAMPAIGN_DEFAULT_ID))
    .cmail_recipients_forget(session, .CMAIL_CAMPAIGN_DEFAULT_ID)
  }
  # Una campaña nueva nunca hereda destinatarios de una carpeta vieja con su id.
  .cmail_recipients_forget(session, id)
  campaigns <- .cmail_campaigns_upsert(campaigns, campaign)
  next_state <- .cmail_campaigns_commit(sid, current, campaigns)
  created <- campaigns[[length(campaigns)]]
  list(ok = TRUE, state_revision = next_state$state_revision, campaign = .cmail_campaign_public(created),
       recipients_purged_virtual = purged_virtual)
}

#' Duplica una campaña: la plantilla sí, los destinatarios no.
#' @keywords internal
collection_mail_campaign_duplicate <- function(sid, expected_revision, campaign_id, name = NULL, actor = NULL) {
  session <- session_get(sid)
  current <- .collection_current(session)
  .collection_assert_revision(current, expected_revision)
  if (is.null(.cmail_campaign_arg(campaign_id))) {
    stop_api(422, "E_COLLECTION_MAIL_CAMPAIGN_REQUIRED", "Indica la campaña a duplicar (campaign_id).")
  }
  pick <- .cmail_campaign_pick(current, campaign_id)
  if (isTRUE(pick$virtual)) {
    stop_api(404, "E_COLLECTION_MAIL_CAMPAIGN_NOT_FOUND", "La campaña de correo no existe en este proyecto.")
  }
  source <- pick$campaign
  campaigns <- pick$set$campaigns
  .cmail_campaign_assert_room(campaigns)
  name <- if (is.null(name)) substr(paste0(source$name, " (copia)"), 1L, 80L) else name
  name <- .cmail_campaign_text(name, "name", 1L, 80L)
  actor <- if (is.null(actor)) (source$actor %||% "") else .cmail_campaign_text(actor, "actor", 0L, 60L)
  ids <- vapply(campaigns, function(c) as.character(c$campaign_id), "")
  id <- .cmail_campaign_unique_id(.cmail_campaign_slug(name), ids)
  # Copia plataforma y envíos; no copia imported_from ni destinatarios.
  campaign <- list(campaign_id = id, name = name, actor = actor, duplicated_from = source$campaign_id,
                   platform = .cmail_platform_of(source),
                   sends = .cmail_sends_without_exports(.cmail_sends_of(source)),
                   template = .cmail_campaign_template(source$template, id, revision = 1L))
  if (.cmail_send_seq(source) > 0L) campaign$send_seq <- .cmail_send_seq(source)
  .cmail_recipients_forget(session, id)
  campaigns <- .cmail_campaigns_upsert(campaigns, campaign)
  next_state <- .cmail_campaigns_commit(sid, current, campaigns)
  list(ok = TRUE, state_revision = next_state$state_revision,
       campaign = .cmail_campaign_public(campaigns[[length(campaigns)]]), recipients_copied = FALSE)
}

#' Renombra una campaña, cambia su actor o su plataforma. El id y la plantilla
#' no cambian. Desde ADR 0112 pasar a surveymonkey conserva los destinatarios
#' (`recipients_purged` queda en la respuesta, siempre FALSE, por compatibilidad).
#' @keywords internal
collection_mail_campaign_meta_put <- function(sid, expected_revision, campaign_id, name = NULL, actor = NULL,
                                              platform = NULL) {
  session <- session_get(sid)
  current <- .collection_current(session)
  .collection_assert_revision(current, expected_revision)
  if (is.null(.cmail_campaign_arg(campaign_id))) {
    stop_api(422, "E_COLLECTION_MAIL_CAMPAIGN_REQUIRED", "Indica la campaña (campaign_id).")
  }
  pick <- .cmail_campaign_pick(current, campaign_id)
  if (isTRUE(pick$virtual)) {
    stop_api(404, "E_COLLECTION_MAIL_CAMPAIGN_NOT_FOUND", "La campaña de correo no existe en este proyecto.")
  }
  campaign <- pick$campaign
  next_name <- if (is.null(name)) campaign$name else .cmail_campaign_text(name, "name", 1L, 80L)
  next_actor <- if (is.null(actor)) (campaign$actor %||% "") else .cmail_campaign_text(actor, "actor", 0L, 60L)
  prev_platform <- .cmail_platform_of(campaign)
  next_platform <- .cmail_platform_arg(platform) %||% prev_platform
  if (pick$set$persisted && identical(next_name, campaign$name) && identical(next_actor, campaign$actor %||% "") &&
      identical(next_platform, prev_platform)) {
    return(list(ok = TRUE, noop = TRUE, state_revision = as.integer(current$state_revision),
                campaign = .cmail_campaign_public(campaign, with_template = FALSE), recipients_purged = FALSE))
  }
  campaign$name <- next_name
  campaign$actor <- next_actor
  campaign$platform <- next_platform
  campaigns <- .cmail_campaigns_upsert(pick$set$campaigns, campaign)
  next_state <- .cmail_campaigns_commit(sid, current, campaigns)
  # ADR 0112 §1: la lista ya no se purga al pasar a SurveyMonkey; sigue siendo
  # de la campaña (contactos_surveymonkey.csv, enlace personal, quién respondió).
  purged <- FALSE
  saved <- campaigns[[match(campaign$campaign_id, vapply(campaigns, function(c) c$campaign_id, ""))]]
  list(ok = TRUE, noop = FALSE, state_revision = next_state$state_revision,
       campaign = .cmail_campaign_public(saved, with_template = FALSE), recipients_purged = purged)
}

#' Borra una campaña y sus destinatarios. `confirm_name` debe ser idéntico al
#' nombre: es la segunda confirmación, del lado del servidor.
#' @keywords internal
collection_mail_campaign_delete <- function(sid, expected_revision, campaign_id, confirm_name = NULL) {
  session <- session_get(sid)
  current <- .collection_current(session)
  .collection_assert_revision(current, expected_revision)
  if (is.null(.cmail_campaign_arg(campaign_id))) {
    stop_api(422, "E_COLLECTION_MAIL_CAMPAIGN_REQUIRED", "Indica la campaña a borrar (campaign_id).")
  }
  pick <- .cmail_campaign_pick(current, campaign_id)
  if (isTRUE(pick$virtual)) {
    stop_api(404, "E_COLLECTION_MAIL_CAMPAIGN_NOT_FOUND", "La campaña de correo no existe en este proyecto.")
  }
  campaign <- pick$campaign
  confirm <- .cmail_one(as.list(confirm_name %||% list(NA_character_)))
  if (is.null(confirm) || !identical(confirm, campaign$name)) {
    stop_api(422, "E_COLLECTION_MAIL_CAMPAIGN_CONFIRM",
             "Para borrar la campaña escribe su nombre exacto en confirm_name.")
  }
  keep <- Filter(function(c) !identical(c$campaign_id, campaign$campaign_id), pick$set$campaigns)
  next_state <- .cmail_campaigns_commit(sid, current, keep)
  # Una campaña migrada pudo dejar su archivo en la raíz: también se borra.
  if (isTRUE(pick$legacy_migrated)) .cmail_recipients_adopt_legacy(session, campaign$campaign_id)
  .cmail_recipients_forget(session, campaign$campaign_id)
  list(ok = TRUE, state_revision = next_state$state_revision, deleted = campaign$campaign_id,
       recipients_purged = !dir.exists(.cmail_recipients_dir(session, campaign$campaign_id)))
}

# `campaign_id` de un GET/DELETE, por consulta (`?campaign_id=`). Vive aquí y
# no en el router para que el router siga siendo forma HTTP + llamada.
.cmail_query_campaign <- function(req) {
  q <- req$argsQuery
  if (is.list(q) && !is.null(q$campaign_id)) return(q$campaign_id)
  qs <- as.character(req$QUERY_STRING %||% "")
  if (!length(qs) || !nzchar(qs[[1]])) return(NULL)
  pairs <- strsplit(sub("^\\?", "", qs[[1]]), "&", fixed = TRUE)[[1]]
  for (p in pairs) {
    kv <- strsplit(p, "=", fixed = TRUE)[[1]]
    if (length(kv) >= 1L && identical(kv[[1]], "campaign_id")) {
      return(utils::URLdecode(if (length(kv) >= 2L) kv[[2]] else ""))
    }
  }
  NULL
}
