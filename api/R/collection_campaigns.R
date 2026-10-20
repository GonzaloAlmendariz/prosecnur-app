# collection_campaigns.R — campañas tipadas de Material de campo (ADR 0111).
#
# La campaña es la entidad de primer nivel del módulo: tipo cerrado
# (`aulas`, `territorial`, `correo`), nombre y sus elementos.
#
# Registro `material_campaigns/v1` en `s$material_campaigns` (persistible,
# session_schema.R):
#
#   { schema, revision, campaigns: [ { id, tipo, name, created_at?, archived, ref } ] }
#
# Guarda SOLO lo que no tiene otro dueño: hoy, la campaña de aulas (su plan,
# deployment y traspaso siguen en `collection_state`, singulares: §6). Las de
# correo NO se guardan aquí: se PROYECTAN de `collection_state$mail_campaigns`
# (`.cmail_campaigns_of`), que sigue siendo su única fuente; su nombre, actor y
# plataforma se escriben con las funciones de collection_mail_campaigns.R.
#
# Migración en lectura, sin dirty (§5):
# - Un plan de aulas sin entrada en el registro se proyecta como
#   `aulas.principal` (`persisted = FALSE`), con nombre derivado del plan.
# - Cada campaña de correo es `correo.<campaign_id>`. La campaña aún en
#   migración desde `mail_template` (persisted FALSE en `.cmail_campaigns_of`)
#   se muestra si tiene contenido real; ver `.mcamp_correo_visible`.
#   La virtual `correo-1` de un proyecto sin correos nunca es tarjeta.
#
# Ids: `^(aulas|territorial|correo)\.[a-z0-9][a-z0-9-]{0,39}$`.
# Revisiones: `registry_revision` (este registro) y `state_revision`
# (collection_state). Las escrituras de aulas comparan la primera; las de
# correo delegan con la segunda.

MATERIAL_CAMPAIGNS_SCHEMA <- "material_campaigns/v1"
.MCAMP_ID_RE <- "^(aulas|territorial|correo)\\.[a-z0-9][a-z0-9-]{0,39}$"
.MCAMP_TIPOS <- c("aulas", "territorial", "correo")
.MCAMP_AULAS_ID <- "aulas.principal"
.MCAMP_TERRITORIAL_MOTIVO <- "Requiere leer las UMP de Hojas de ruta (E2)"
.MCAMP_ENTRY_KEYS <- c("id", "tipo", "name", "created_at", "archived", "ref")

# ---- lectura ------------------------------------------------------------------

# Registro tolerante: lo que no tenga forma de entrada se ignora al leer.
.mcamp_registry <- function(s) {
  reg <- s$material_campaigns
  if (!is.list(reg)) reg <- list()
  entries <- Filter(function(e) {
    is.list(e) && .mcamp_id_ok(e$id) && (e$tipo %||% "") %in% c("aulas", "territorial") &&
      startsWith(e$id, paste0(e$tipo, "."))
  }, unname(reg$campaigns %||% list()))
  rev <- suppressWarnings(as.integer(unlist(reg$revision)))
  list(schema = MATERIAL_CAMPAIGNS_SCHEMA,
       revision = if (length(rev) && !is.na(rev[[1]]) && rev[[1]] >= 0L) rev[[1]] else 0L,
       campaigns = entries)
}

.mcamp_id_ok <- function(x) {
  is.character(x) && length(x) == 1L && !is.na(x) && grepl(.MCAMP_ID_RE, x)
}

.mcamp_revision_of <- function(reg) {
  r <- reg$revision
  if (is.null(r) || is.na(r)) 0L else as.integer(r)
}

# Estado de Recopiladores sin validar (lectura de lista: no escribe y no debe
# costar la validación entera del plan).
.mcamp_state <- function(s) {
  state <- s$collection_state
  if (!is.list(state)) return(.collection_empty_state())
  state$state_revision <- as.integer(state$state_revision %||% 0L)
  state
}

# Nombre de la campaña de aulas proyectada, derivado del plan.
.mcamp_aulas_name_from_plan <- function(plan) {
  tipo <- .cm_aulas_scalar(plan$unit_type %||% "", "")
  switch(tipo,
         classroom_course_schedule = "Campo en aulas",
         "Campo en aulas")
}

.mcamp_aulas_estado <- function(s, state) {
  plan <- state$plan
  fichas <- tryCatch(.overview_fichas_facts(s), error = function(e) list())
  vig <- tryCatch(.collection_source_vigente(s, state), error = function(e) NULL)
  list(
    unidades = as.integer(if (is.list(plan)) length(plan$units %||% list()) else 0L),
    titulares = as.integer(fichas$titulares %||% 0L),
    con_enlace = as.integer(fichas$with_link %||% 0L),
    deployment_status = if (is.list(state$deployment)) .cm_aulas_scalar(state$deployment$status %||% "", "") else NA_character_,
    plan_desfasado = isTRUE(vig$desfasado)
  )
}

.mcamp_aulas_ref <- function(state) {
  plan <- state$plan
  list(store = "collection_state",
       plan_id = if (is.list(plan)) .cm_aulas_scalar(plan$plan_id %||% "", "") else NA_character_)
}

# La entrada de aulas: la del registro o la proyectada del plan. NULL si no hay.
.mcamp_aulas_entry <- function(s, state, reg) {
  stored <- Filter(function(e) identical(e$tipo, "aulas"), reg$campaigns)
  if (length(stored)) return(list(entry = stored[[1]], persisted = TRUE))
  if (.collection_tiene_plan(state)) {
    return(list(entry = list(id = .MCAMP_AULAS_ID, tipo = "aulas", name = .mcamp_aulas_name_from_plan(state$plan),
                             archived = FALSE),
                persisted = FALSE))
  }
  NULL
}

.mcamp_aulas_public <- function(s, state, hit) {
  e <- hit$entry
  list(id = e$id, tipo = "aulas", name = e$name, created_at = e$created_at %||% NA_character_,
       archived = isTRUE(e$archived), persisted = isTRUE(hit$persisted), ref = .mcamp_aulas_ref(state),
       estado = .mcamp_aulas_estado(s, state))
}

# La campaña de correo en migración (persisted FALSE) es tarjeta solo con
# contenido real. Evidencia (2026-10-20): `mail_template` lo escribía
# únicamente el PUT explícito del editor de E1f, cuyo «Guardar» estaba
# deshabilitado sin cambios respecto de la plantilla de fábrica; el export no
# guardaba. Así que en la práctica un `mail_template` legado siempre es trabajo
# del usuario. La regla igual se declara: si su material es idéntico a la
# plantilla de fábrica vigente, no hay contenido que mostrar.
.mcamp_correo_visible <- function(campaign, set) {
  if (isTRUE(set$persisted)) return(TRUE)
  tpl <- campaign$template
  if (!is.list(tpl)) return(FALSE)
  builtin <- .cmail_campaign_template(.cmail_builtin_template(), campaign$campaign_id)
  !identical(.cmail_template_material(tpl), .cmail_template_material(builtin))
}

.mcamp_correo_estado <- function(session, campaign) {
  summary <- .cmail_campaign_summary(session, campaign)
  sends <- .cmail_sends_of(campaign)
  list(
    platform = summary$platform,
    envios = length(sends),
    bloques = as.integer(summary$blocks %||% 0L),
    recipients_loaded = isTRUE(summary$recipients_loaded),
    envios_detalle = lapply(sends, function(x) list(
      send_id = x$send_id, label = x$label %||% "",
      last_export_at = .cmail_one(x$last_export_at) %||% NA_character_,
      last_export_platform = .cmail_one(x$last_export_platform) %||% NA_character_
    ))
  )
}

.mcamp_correo_public <- function(session, campaign, set) {
  list(id = paste0("correo.", campaign$campaign_id), tipo = "correo", name = campaign$name %||% "",
       actor = campaign$actor %||% "", created_at = campaign$created_at %||% NA_character_,
       archived = FALSE, persisted = isTRUE(set$persisted),
       ref = list(store = "collection_state.mail_campaigns", campaign_id = campaign$campaign_id),
       estado = .mcamp_correo_estado(session, campaign))
}

.mcamp_correo_visibles <- function(state) {
  set <- .cmail_campaigns_of(state)
  list(set = set, campaigns = Filter(function(c) .mcamp_correo_visible(c, set), set$campaigns))
}

.mcamp_tipos <- function(aulas_hit, n_correo) {
  list(
    if (is.null(aulas_hit)) list(tipo = "aulas", disponible = TRUE)
    else list(tipo = "aulas", disponible = FALSE,
              motivo = if (isTRUE(aulas_hit$entry$archived)) "El proyecto ya tiene su campaña de aulas (archivada): reábrela."
                       else "El proyecto ya tiene su campaña de aulas."),
    list(tipo = "territorial", disponible = FALSE, motivo = .MCAMP_TERRITORIAL_MOTIVO),
    if (n_correo < .CMAIL_CAMPAIGNS_MAX) list(tipo = "correo", disponible = TRUE)
    else list(tipo = "correo", disponible = FALSE,
              motivo = sprintf("Un proyecto admite hasta %d campañas de correo.", .CMAIL_CAMPAIGNS_MAX))
  )
}

# Lista proyectada de una sesión (pura: no escribe, no marca dirty).
.mcamp_list <- function(s) {
  state <- .mcamp_state(s)
  reg <- .mcamp_registry(s)
  aulas <- .mcamp_aulas_entry(s, state, reg)
  correo <- .mcamp_correo_visibles(state)
  campaigns <- c(
    if (!is.null(aulas)) list(.mcamp_aulas_public(s, state, aulas)),
    lapply(correo$campaigns, function(c) .mcamp_correo_public(s, c, correo$set))
  )
  list(state = state, reg = reg, aulas = aulas, correo = correo, campaigns = campaigns,
       tipos = .mcamp_tipos(aulas, length(correo$set$campaigns)))
}

#' Campañas del proyecto (ADR 0111): GET /api/recopiladores/campaigns.
#' @keywords internal
collection_campaigns_get <- function(sid) {
  l <- .mcamp_list(session_get(sid))
  list(ok = TRUE, schema = MATERIAL_CAMPAIGNS_SCHEMA,
       registry_revision = .mcamp_revision_of(l$reg),
       state_revision = as.integer(l$state$state_revision),
       campaigns = l$campaigns, tipos = l$tipos)
}

#' Resumen corto para la tarjeta del inicio del proyecto (ADR 0111 §9).
#' @keywords internal
.collection_campaigns_overview <- function(s) {
  lapply(.mcamp_list(s)$campaigns, function(c) {
    list(id = c$id, tipo = c$tipo, name = c$name, archived = isTRUE(c$archived), resumen = c$estado)
  })
}

# ---- escritura ----------------------------------------------------------------

.mcamp_tipo_arg <- function(tipo) {
  value <- .cmail_one(as.list(tipo %||% list(NA_character_)))
  if (is.null(value) || !(value %in% .MCAMP_TIPOS)) {
    stop_api(422, "E_COLLECTION_CAMPAIGN_TIPO", "tipo es aulas, territorial o correo.",
             details = list(tipos = as.list(.MCAMP_TIPOS)))
  }
  value
}

.mcamp_territorial_stop <- function() {
  stop_api(409, "E_COLLECTION_CAMPAIGN_TIPO_NO_DISPONIBLE",
           "Las campañas territoriales aún no están disponibles.",
           details = list(tipo = "territorial", motivo = .MCAMP_TERRITORIAL_MOTIVO))
}

.mcamp_assert_registry_revision <- function(reg, expected) {
  if (is.null(expected) || !length(expected)) return(invisible(TRUE))
  parsed <- suppressWarnings(as.integer(unlist(expected)[1]))
  current <- .mcamp_revision_of(reg)
  if (is.na(parsed) || !identical(parsed, current)) {
    stop_api(409, "E_COLLECTION_CAMPAIGN_STALE", "Las campañas cambiaron desde que se abrió la pantalla.",
             details = list(expected_registry_revision = if (is.na(parsed)) NULL else parsed,
                            current_registry_revision = current))
  }
  invisible(TRUE)
}

.mcamp_registry_commit <- function(sid, reg, entries) {
  next_reg <- list(schema = MATERIAL_CAMPAIGNS_SCHEMA, revision = .mcamp_revision_of(reg) + 1L,
                   campaigns = unname(lapply(entries, function(e) e[intersect(.MCAMP_ENTRY_KEYS, names(e))])))
  session_set(sid, "material_campaigns", next_reg)
  next_reg
}

.mcamp_bool_arg <- function(x, what) {
  v <- unlist(x)
  if (!is.logical(v) || length(v) != 1L || is.na(v)) {
    stop_api(422, "E_COLLECTION_CAMPAIGN_INVALID", sprintf("%s es verdadero o falso.", what))
  }
  v
}

.mcamp_id_arg <- function(id) {
  value <- .cmail_one(as.list(id %||% list(NA_character_)))
  if (is.null(value) || !.mcamp_id_ok(value)) {
    stop_api(404, "E_COLLECTION_CAMPAIGN_NOT_FOUND", "La campaña no existe en este proyecto.")
  }
  value
}

.mcamp_find_or_stop <- function(l, id) {
  for (c in l$campaigns) if (identical(c$id, id)) return(c)
  stop_api(404, "E_COLLECTION_CAMPAIGN_NOT_FOUND", "La campaña no existe en este proyecto.",
           details = list(id = id))
}

.mcamp_response <- function(sid, id) {
  out <- collection_campaigns_get(sid)
  campaign <- NULL
  for (c in out$campaigns) if (identical(c$id, id)) campaign <- c
  list(ok = TRUE, registry_revision = out$registry_revision, state_revision = out$state_revision,
       campaign = campaign)
}

#' Crea una campaña (POST /api/recopiladores/campaigns).
#'
#' `correo` delega en `collection_mail_campaign_create` (revisión de
#' collection_state); `aulas` escribe la entrada del registro (una sola por
#' proyecto); `territorial` no está disponible hasta E2.
#' @keywords internal
collection_campaign_create <- function(sid, tipo, name, actor = NULL, platform = NULL, preset_id = NULL,
                                       template = NULL, import_id = NULL, expected_state_revision = NULL,
                                       expected_registry_revision = NULL) {
  tipo <- .mcamp_tipo_arg(tipo)
  if (identical(tipo, "territorial")) .mcamp_territorial_stop()
  if (identical(tipo, "correo")) {
    created <- collection_mail_campaign_create(sid, expected_revision = expected_state_revision, name = name,
                                               actor = actor, preset_id = preset_id, platform = platform,
                                               template = template, import_id = import_id)
    out <- .mcamp_response(sid, paste0("correo.", created$campaign$campaign_id))
    out$recipients_purged_virtual <- isTRUE(created$recipients_purged_virtual)
    return(out)
  }
  # aulas
  s <- session_get(sid)
  l <- .mcamp_list(s)
  .mcamp_assert_registry_revision(l$reg, expected_registry_revision)
  if (!is.null(l$aulas)) {
    stop_api(409, "E_COLLECTION_CAMPAIGN_AULAS_UNICA",
             "El proyecto ya tiene su campaña de aulas; un proyecto tiene una sola mientras el plan sea único.",
             details = list(id = l$aulas$entry$id, archived = isTRUE(l$aulas$entry$archived)))
  }
  solo_correo <- list(actor = actor, platform = platform, preset_id = preset_id, template = template,
                      import_id = import_id)
  sobran <- names(Filter(Negate(is.null), solo_correo))
  if (length(sobran)) {
    stop_api(422, "E_COLLECTION_CAMPAIGN_INVALID",
             sprintf("%s solo aplica a campañas de correo.", paste0("`", sobran, "`", collapse = ", ")))
  }
  name <- .cmail_campaign_text(name, "name", 1L, 80L)
  entry <- list(id = .MCAMP_AULAS_ID, tipo = "aulas", name = name, created_at = .collection_now_iso(),
                archived = FALSE, ref = list(store = "collection_state"))
  .mcamp_registry_commit(sid, l$reg, c(l$reg$campaigns, list(entry)))
  .mcamp_response(sid, .MCAMP_AULAS_ID)
}

#' Renombra, cambia actor/plataforma o archiva (PUT /api/recopiladores/campaigns/meta).
#'
#' `correo` delega en `collection_mail_campaign_meta_put`; `archived` solo
#' aplica a aulas (un correo se borra con el endpoint existente). Escribir la
#' campaña de aulas proyectada la persiste en el registro.
#' @keywords internal
collection_campaign_meta_put <- function(sid, id, name = NULL, actor = NULL, platform = NULL, archived = NULL,
                                         expected_state_revision = NULL, expected_registry_revision = NULL) {
  id <- .mcamp_id_arg(id)
  tipo <- sub("\\..*$", "", id)
  if (identical(tipo, "territorial")) .mcamp_territorial_stop()
  l <- .mcamp_list(session_get(sid))
  .mcamp_find_or_stop(l, id)
  if (identical(tipo, "correo")) {
    if (!is.null(archived)) {
      stop_api(422, "E_COLLECTION_CAMPAIGN_INVALID",
               "Una campaña de correo no se archiva: se borra con su nombre como confirmación.")
    }
    collection_mail_campaign_meta_put(sid, expected_revision = expected_state_revision,
                                      campaign_id = sub("^correo\\.", "", id), name = name, actor = actor,
                                      platform = platform)
    return(.mcamp_response(sid, id))
  }
  # aulas
  .mcamp_assert_registry_revision(l$reg, expected_registry_revision)
  if (!is.null(actor) || !is.null(platform)) {
    stop_api(422, "E_COLLECTION_CAMPAIGN_INVALID", "actor y platform solo aplican a campañas de correo.")
  }
  entry <- l$aulas$entry
  next_entry <- entry
  if (!is.null(name)) next_entry$name <- .cmail_campaign_text(name, "name", 1L, 80L)
  if (!is.null(archived)) next_entry$archived <- .mcamp_bool_arg(archived, "archived")
  next_entry$archived <- isTRUE(next_entry$archived)
  if (is.null(next_entry$ref)) next_entry$ref <- list(store = "collection_state")
  if (isTRUE(l$aulas$persisted) && identical(next_entry, entry)) {
    out <- .mcamp_response(sid, id)
    out$noop <- TRUE
    return(out)
  }
  others <- Filter(function(e) !identical(e$id, id), l$reg$campaigns)
  .mcamp_registry_commit(sid, l$reg, c(list(next_entry), others))
  out <- .mcamp_response(sid, id)
  out$noop <- FALSE
  out
}
