# collection_mail_sections.R — «Mis secciones» del correo (GOAL editor de
# correos profesional, L9; ADR 0113: viven en el estudio).
#
# Contrato `collection_mail_sections/v1`, en `collection_state$mail_sections`:
#
#   { schema, sections: [ { section_id, name, block, images, campaign_id?,
#                           created_at, updated_at } ] }
#
# - `block` es un bloque de correo válido sin `block_id` ni lo `guardado` por
#   «Cambiar por»: una copia de su texto, su imagen y su estilo. Usarlo inserta
#   otra copia (el editor le da un id nuevo); cambiar la sección no toca los
#   correos que ya la usan.
# - `images` son las entradas de `template.images` de las fotos del bloque
#   (descripción y URL pública): las fotos son del proyecto y viajan en el
#   `.pulso` aunque nadie las use (`.cmail_image_fids`).
# - `name` (1-80) rechaza todo texto con forma de correo, como una campaña.
# - Máximo 50 secciones. Toda escritura exige `expected_revision` (global).

COLLECTION_MAIL_SECTIONS_SCHEMA <- "collection_mail_sections/v1"
.CMAIL_SECTIONS_MAX <- 50L

# ---- lectura ------------------------------------------------------------------

.cmail_sections_of <- function(state) {
  s <- state$mail_sections
  if (!is.list(s) || !is.list(s$sections)) return(list())
  Filter(function(x) is.list(x) && is.character(x$section_id), s$sections)
}

.cmail_section_public <- function(x) {
  x[intersect(c("section_id", "name", "block", "images", "campaign_id", "created_at", "updated_at"), names(x))]
}

# ---- validación ---------------------------------------------------------------

# Las fotos que nombra un bloque (las mismas ranuras que `.cmail_image_ids`).
.cmail_section_image_ids <- function(block) {
  ids <- c(.cmail_one(block$image_ref), .cmail_one(block$mobile_ref), .cmail_one(block$left), .cmail_one(block$right))
  unique(as.character(ids[nzchar(ids)]))
}

#' El bloque listo para guardarse: sin id ni `guardado`, y válido como bloque de
#' correo (se valida dentro de una plantilla de fábrica, como lo vería el render).
#' @keywords internal
.cmail_section_block <- function(block) {
  if (!is.list(block) || is.null(names(block)) || is.null(.cmail_one(block$type))) {
    stop_api(422, "E_COLLECTION_MAIL_SECTION_INVALID", "La sección necesita un bloque de correo.")
  }
  type <- .cmail_one(block$type)
  if (identical(type, "footer_legal") || !(type %in% names(.CMAIL_BLOCK_KEYS))) {
    stop_api(422, "E_COLLECTION_MAIL_SECTION_INVALID", "Ese bloque no se puede guardar como sección.")
  }
  block$block_id <- NULL
  block$guardado <- NULL
  probe <- .cmail_template_normalize(.cmail_preset_recuperacion())
  probe$blocks <- append(probe$blocks, list(c(list(block_id = "seccion-guardada"), block)), after = 1L)
  v <- collection_mail_template_validate(.cmail_template_normalize(probe))
  propios <- Filter(function(p) identical(p$path, "template.blocks[2]") || startsWith(p$path, "template.blocks[2]."), v$problems)
  if (length(propios)) {
    stop_api(422, "E_COLLECTION_MAIL_SECTION_INVALID", "El bloque tiene problemas: corrígelos antes de guardarlo.",
             details = list(problems = lapply(propios, function(p) p[c("path", "code", "detail")])))
  }
  block
}

# Las entradas de `template.images` de sus fotos: sólo descripción y URL.
.cmail_section_images <- function(images, block) {
  out <- list()
  for (id in .cmail_section_image_ids(block)) {
    e <- if (is.list(images)) images[[id]] else NULL
    if (!is.list(e)) next
    keep <- list(alt = .cmail_one(e$alt), url = .cmail_one(e$url))
    keep <- Filter(Negate(is.null), keep)
    if (length(keep)) out[[id]] <- keep
  }
  out
}

# Nombre de 1 a 80 caracteres, sin forma de correo (llegaría al `.pulso`). No se cita el valor.
.cmail_section_name <- function(x) {
  value <- .cmail_one(as.list(x %||% list(NA_character_)))
  value <- if (is.null(value)) "" else trimws(gsub("[[:cntrl:]]+", " ", value))
  if (nchar(value) < 1L || nchar(value) > 80L) {
    stop_api(422, "E_COLLECTION_MAIL_SECTION_NAME", "El nombre de la sección va de 1 a 80 caracteres.")
  }
  if (grepl(.CMAIL_EMAIL_LIKE_RE, value)) {
    stop_api(422, "E_COLLECTION_MAIL_SECTION_NAME", "El nombre de la sección no puede llevar una dirección de correo.")
  }
  value
}

.cmail_section_id <- function(name, taken) {
  base <- .cmail_campaign_slug(name)
  .cmail_campaign_unique_id(if (nzchar(base)) base else "seccion", taken)
}

.cmail_sections_commit <- function(sid, current, sections) {
  next_state <- current
  next_state$mail_sections <- list(schema = COLLECTION_MAIL_SECTIONS_SCHEMA, sections = unname(sections))
  next_state$state_revision <- as.integer(current$state_revision) + 1L
  .collection_store(sid, next_state)
  next_state
}

# ---- API ----------------------------------------------------------------------

#' «Mis secciones» del estudio.
#' @keywords internal
collection_mail_sections_get <- function(sid) {
  state <- .collection_current(session_get(sid))
  list(ok = TRUE, state_revision = as.integer(state$state_revision),
       sections = lapply(.cmail_sections_of(state), .cmail_section_public))
}

#' Guarda un bloque como sección del estudio (una copia).
#' @keywords internal
collection_mail_section_create <- function(sid, expected_revision, name, block, images = NULL, campaign_id = NULL) {
  session <- session_get(sid)
  current <- .collection_current(session)
  .collection_assert_revision(current, expected_revision)
  name <- .cmail_section_name(name)
  block <- .cmail_section_block(block)
  sections <- .cmail_sections_of(current)
  if (length(sections) >= .CMAIL_SECTIONS_MAX) {
    stop_api(409, "E_COLLECTION_MAIL_SECTION_LIMIT", sprintf("Un estudio guarda hasta %d secciones.", .CMAIL_SECTIONS_MAX))
  }
  now <- .collection_now_iso()
  section <- list(section_id = .cmail_section_id(name, vapply(sections, function(x) x$section_id, "")),
                  name = name, block = block, images = .cmail_section_images(images, block),
                  created_at = now, updated_at = now)
  campaign <- .cmail_one(campaign_id)
  if (!is.null(campaign) && .cmail_campaign_id_ok(campaign)) section$campaign_id <- campaign
  sections[[length(sections) + 1L]] <- section
  next_state <- .cmail_sections_commit(sid, current, sections)
  list(ok = TRUE, state_revision = next_state$state_revision, section = .cmail_section_public(section))
}

#' Borra una sección guardada (los correos que ya la usan no cambian).
#' @keywords internal
collection_mail_section_delete <- function(sid, expected_revision, section_id) {
  session <- session_get(sid)
  current <- .collection_current(session)
  .collection_assert_revision(current, expected_revision)
  id <- .cmail_one(section_id)
  sections <- .cmail_sections_of(current)
  at <- match(id %||% "", vapply(sections, function(x) x$section_id, ""))
  if (is.na(at)) stop_api(404, "E_COLLECTION_MAIL_SECTION_NOT_FOUND", "Esa sección ya no está en el estudio.")
  next_state <- .cmail_sections_commit(sid, current, sections[-at])
  list(ok = TRUE, state_revision = next_state$state_revision)
}
