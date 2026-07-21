# =============================================================================
# Editor XLSForm — colección multi-formulario con espejo del activo
# =============================================================================
# El editor XLSForm históricamente manejaba UN solo formulario por proyecto:
# `s$xlsform_state` con shape { workbook, source, hallazgos, saved_at }. Cinco
# consumidores externos leen `s$xlsform_state$workbook` (router_carga.R,
# router_monitoreo.R, project_overview.R, router_diseno_estudio.R,
# project_warmup.R) y NO deben cambiar.
#
# Para soportar varios formularios construimos una colección ALREDEDOR del
# contrato legacy, nunca DENTRO de él:
#   - s$xlsform_forms          lista NOMBRADA por id: cada entrada
#                              list(id, name, source, saved_at, hallazgos, workbook)
#   - s$xlsform_active_form_id id activo o NULL
#   - s$xlsform_state          ESPEJO materializado del activo (shape idéntico
#                              al legacy). Es un DERIVADO: la fuente de verdad
#                              es xlsform_forms + active_form_id.
#
# El ÚNICO mutador que re-deriva el espejo es `.xlsform_forms_set_active`.
# Invariante global: tras cualquier operación,
#   identical(s$xlsform_state$workbook, s$xlsform_forms[[active]]$workbook)
#
# Todos los helpers son PUROS sobre `s` (reciben el snapshot del session env y
# devuelven `s` mutado). El router los envuelve con el patrón habitual
# `s <- session_get(sid); ...; .session_env[[sid]] <- s`.

# Tope de formularios por proyecto. El editor multi-formulario está pensado
# para un puñado de instrumentos por estudio, no una biblioteca: el límite
# protege el payload del homepage y el tamaño del state.rds. Vive aquí, visible,
# para no dispersar el número mágico 6 por routers y tests.
.XLSFORM_FORMS_MAX <- 6L

# Timestamp ISO-UTC (mismo formato que el POST /state legacy).
.xlsform_forms_now <- function() {
  format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
}

# `source` viaja dentro del proyecto `.pulso`, por lo que solo puede contener
# procedencia reproducible. El filtrado es recursivo para cubrir tanto objetos
# JSON anidados como vectores nombrados que puedan llegar desde código legacy.
.xlsform_forms_sanitize_source <- function(value) {
  secret_key <- "token|secret|password|credential|authorization|api[_-]?key|cookie"
  sanitize <- function(node) {
    if (is.null(node)) return(NULL)
    if (is.environment(node) || is.function(node) || is.raw(node)) return(NULL)

    keys <- names(node)
    if (!is.null(keys)) {
      keep <- !grepl(secret_key, keys, ignore.case = TRUE)
      node <- node[keep]
    }
    if (!is.list(node)) return(node)
    lapply(node, sanitize)
  }
  out <- sanitize(value %||% list()) %||% list()
  if (!is.list(out)) list() else out
}

# Los autosaves antiguos enviaban solo `{kind, original_name}`. Fusionar el
# patch con la procedencia previa evita que ese payload parcial borre el survey
# remoto, sus hashes o la revisión manual de lógica. Las listas sin nombres
# (por ejemplo `variants`) son valores completos y se reemplazan como unidad.
.xlsform_forms_merge_source <- function(previous, patch) {
  previous <- .xlsform_forms_sanitize_source(previous)
  patch <- .xlsform_forms_sanitize_source(patch)
  if (!length(patch)) return(previous)
  if (!is.list(previous) || !is.list(patch)) return(patch)

  patch_names <- names(patch)
  if (is.null(patch_names) || any(!nzchar(patch_names))) return(patch)
  previous_names <- names(previous)
  out <- if (is.null(previous_names) || any(!nzchar(previous_names))) list() else previous
  for (key in patch_names) {
    prior_value <- out[[key]]
    next_value <- patch[[key]]
    if (is.list(prior_value) && is.list(next_value) &&
        length(names(prior_value) %||% character(0)) &&
        length(names(next_value) %||% character(0))) {
      out[[key]] <- .xlsform_forms_merge_source(prior_value, next_value)
    } else {
      out[[key]] <- next_value
    }
  }
  .xlsform_forms_sanitize_source(out)
}

# TRUE si `id` NO existe aún en la colección: es una CREACIÓN, no un upsert de
# actualización. Un id vacío/ausente también cuenta como creación (as_entry le
# generará un uuid nuevo).
.xlsform_forms_is_new_id <- function(s, id) {
  forms <- s$xlsform_forms %||% list()
  id <- as.character(id %||% "")[1]
  !nzchar(id) || is.null(forms[[id]])
}

# Guard del tope: lanza E_FORM_LIMIT SOLO si `id` es una creación nueva y la
# colección ya alcanzó el máximo. El upsert de un id existente —autosave,
# incluido el del 6º formulario— nunca se topa. No-op (devuelve `s` invisible)
# en caso contrario. Se testea directamente; el router solo lo invoca.
.xlsform_forms_guard_limit <- function(s, id) {
  if (.xlsform_forms_is_new_id(s, id) &&
      length(s$xlsform_forms %||% list()) >= .XLSFORM_FORMS_MAX) {
    stop_api(409, "E_FORM_LIMIT", sprintf(
      "Este proyecto ya alcanzó el máximo de %d formularios. Elimina uno para crear otro.",
      .XLSFORM_FORMS_MAX
    ))
  }
  invisible(s)
}

# Lee el valor de `settings.form_title` desde el payload del workbook. El
# workbook viaja como hojas `{ columns: [...], rows: [[...]] }` (shape que ya
# consumen project_overview.R y el resto del editor).
.xlsform_forms_settings_form_title <- function(workbook) {
  settings <- (workbook %||% list())$settings %||% list()
  cols <- as.character(unlist(settings$columns %||% list(), use.names = FALSE))
  rows <- settings$rows %||% list()
  if (!length(cols) || !length(rows)) return("")
  idx <- match("form_title", cols)
  if (is.na(idx)) return("")
  cells <- as.character(unlist(rows[[1]], use.names = FALSE))
  if (idx > length(cells)) return("")
  trimws(as.character(cells[[idx]]))
}

# Cascada del nombre del formulario:
#   override explícito → settings.form_title → source.original_name (sin
#   extensión) → fallback ("Formulario 1").
.xlsform_forms_derive_name <- function(workbook, source = list(), override = NULL,
                                       fallback = "Formulario 1") {
  ov <- trimws(as.character(override %||% "")[1])
  if (nzchar(ov) && !identical(tolower(ov), "na")) return(ov)

  title <- .xlsform_forms_settings_form_title(workbook)
  if (nzchar(title)) return(title)

  orig <- trimws(as.character((source %||% list())$original_name %||% "")[1])
  if (nzchar(orig) && !identical(tolower(orig), "na")) {
    return(tools::file_path_sans_ext(basename(orig)))
  }
  fallback
}

# Convierte un espejo de `xlsform_state` legacy en una entrada de la colección.
# Si falta id, genera uno con uuid (permitido en runtime R).
.xlsform_forms_as_entry <- function(state, id = NULL, name = NULL) {
  state <- state %||% list()
  workbook <- state$workbook %||% list()
  source <- .xlsform_forms_sanitize_source(state$source %||% list())
  hallazgos <- state$hallazgos %||% list()
  saved_at <- as.character(state$saved_at %||% "")[1]
  if (!nzchar(saved_at)) saved_at <- .xlsform_forms_now()

  id <- as.character(id %||% "")[1]
  if (!nzchar(id)) id <- uuid::UUIDgenerate()

  list(
    id = id,
    name = .xlsform_forms_derive_name(workbook, source, name),
    source = source,
    saved_at = saved_at,
    hallazgos = hallazgos,
    workbook = workbook
  )
}

# Materializa el espejo legacy `{ workbook, source, hallazgos, saved_at }` a
# partir de una entrada de la colección.
.xlsform_forms_entry_to_state <- function(entry) {
  list(
    workbook = entry$workbook,
    source = .xlsform_forms_sanitize_source(entry$source),
    hallazgos = entry$hallazgos,
    saved_at = entry$saved_at
  )
}

# Devuelve el id de la entrada más reciente (por saved_at; los timestamps ISO
# ordenan lexicográficamente). NULL si la colección está vacía.
.xlsform_forms_most_recent_id <- function(forms) {
  forms <- forms %||% list()
  if (!length(forms)) return(NULL)
  saved <- vapply(forms, function(e) as.character(e$saved_at %||% "")[1], character(1))
  names(forms)[order(saved, decreasing = TRUE)][1]
}

# -----------------------------------------------------------------------------
# API pública de la colección (todas puras sobre `s`).
# -----------------------------------------------------------------------------

# Metadatos de todos los formularios (SIN workbooks → payload liviano).
# Conteo ligero de preguntas/secciones sobre la hoja `survey` de un workbook
# (mismo criterio que el frontend `computeFormMetrics`): secciones = filas
# `begin_group`; preguntas = filas cuyo `type` base no es estructural
# (begin/end group/repeat) ni vacío. Filas posicionales alineadas a `columns`.
.xlsform_forms_survey_counts <- function(workbook) {
  survey <- workbook$survey %||% list()
  rows <- survey$rows %||% list()
  cols <- as.character(survey$columns %||% character(0))
  ti <- match("type", cols)
  if (is.na(ti) || !length(rows)) return(list(n_questions = 0L, n_sections = 0L))
  structural <- c("begin_group", "end_group", "begin_repeat", "end_repeat")
  nq <- 0L; ns <- 0L
  for (r in rows) {
    ty <- tryCatch(as.character(r[[ti]]), error = function(e) "")
    ty <- if (length(ty)) ty[1] else ""
    if (is.na(ty)) ty <- ""
    base <- tolower(trimws(sub("\\s.*$", "", ty)))
    if (!nzchar(base)) next
    if (identical(base, "begin_group")) ns <- ns + 1L
    if (!(base %in% structural)) nq <- nq + 1L
  }
  list(n_questions = nq, n_sections = ns)
}

.xlsform_forms_list <- function(s) {
  forms <- s$xlsform_forms %||% list()
  if (!length(forms)) return(list())
  active <- as.character(s$xlsform_active_form_id %||% "")[1]
  lapply(unname(forms), function(e) {
    id <- as.character(e$id %||% "")[1]
    counts <- .xlsform_forms_survey_counts(e$workbook %||% list())
    list(
      id = id,
      name = as.character(e$name %||% "")[1],
      source = .xlsform_forms_sanitize_source(e$source %||% list()),
      saved_at = as.character(e$saved_at %||% "")[1],
      n_questions = counts$n_questions,
      n_sections = counts$n_sections,
      active = identical(id, active),
      publication = .xlsform_revision_publication(s, e)
    )
  })
}

# Entrada completa (con workbook) o NULL.
.xlsform_forms_get <- function(s, id) {
  forms <- s$xlsform_forms %||% list()
  id <- as.character(id %||% "")[1]
  if (!nzchar(id)) return(NULL)
  entry <- forms[[id]]
  if (!is.null(entry)) {
    entry$source <- .xlsform_forms_sanitize_source(entry$source %||% list())
  }
  entry
}

# Único mutador que re-deriva el espejo `s$xlsform_state` desde la colección.
# Con id inválido/vacío limpia el activo y el espejo (colección sin activo).
.xlsform_forms_set_active <- function(s, id) {
  forms <- s$xlsform_forms %||% list()
  id <- as.character(id %||% "")[1]
  if (!nzchar(id) || is.null(forms[[id]])) {
    s$xlsform_active_form_id <- NULL
    s$xlsform_state <- NULL
    return(s)
  }
  s$xlsform_active_form_id <- id
  s$xlsform_state <- .xlsform_forms_entry_to_state(forms[[id]])
  s
}

# Inserta o actualiza una entrada por id. Si es el primer formulario (o no hay
# activo válido), lo marca activo. Si se actualiza el activo, re-deriva el
# espejo para conservar la invariante.
.xlsform_forms_upsert <- function(s, entry) {
  forms <- s$xlsform_forms %||% list()
  id <- as.character(entry$id %||% "")[1]
  if (!nzchar(id)) {
    id <- uuid::UUIDgenerate()
    entry$id <- id
  }
  previous <- forms[[id]]
  entry$source <- .xlsform_forms_merge_source(
    previous$source %||% list(),
    entry$source %||% list()
  )
  first <- length(forms) == 0L
  forms[[id]] <- entry
  s$xlsform_forms <- forms

  active <- as.character(s$xlsform_active_form_id %||% "")[1]
  if (first || !nzchar(active) || is.null(forms[[active]])) {
    s <- .xlsform_forms_set_active(s, id)
  } else if (identical(active, id)) {
    # Se reescribió el activo → re-derivar el espejo desde la nueva entrada.
    s <- .xlsform_forms_set_active(s, id)
  }
  s
}

# Confirma explícitamente que una persona revisó la lógica correspondiente al
# hash actual del workbook. La confirmación no se infiere de que existan reglas:
# queda ligada al contenido y se invalida automáticamente cuando este cambia.
xlsform_forms_confirm_logic <- function(sid, form_id, expected_content_sha256) {
  expected <- as.character(expected_content_sha256 %||% "")[1]
  if (is.na(expected) || !grepl("^[0-9a-f]{64}$", expected)) {
    stop_api(
      400,
      "E_REVISION_EXPECTED_HASH",
      "expected_content_sha256 debe ser un SHA-256 lowercase de 64 caracteres."
    )
  }

  s <- session_get(sid, required = FALSE)
  form_id <- as.character(form_id %||% "")[1]
  entry <- if (is.null(s)) NULL else .xlsform_forms_get(s, form_id)
  if (is.null(entry)) {
    stop_api(404, "E_FORM_NOT_FOUND", sprintf("No existe el formulario '%s'.", form_id))
  }

  content_sha256 <- .xlsform_revision_hash(entry$workbook %||% list())
  if (!identical(content_sha256, expected)) {
    stop_api(409, "E_FORM_DRAFT_STALE", "El borrador cambió desde que se calculó el hash esperado.")
  }

  now <- .xlsform_forms_now()
  source <- .xlsform_forms_sanitize_source(entry$source %||% list())
  source$logic_status <- "confirmed"
  source$logic_confirmed_at <- now
  source$logic_confirmation_method <- "editor_manual_review"
  source$logic_review <- .xlsform_forms_merge_source(
    source$logic_review %||% list(),
    list(content_sha256 = content_sha256)
  )
  if (is.list(source$variants) && length(source$variants)) {
    source$variants <- lapply(source$variants, function(variant) {
      if (!is.list(variant)) return(variant)
      definition_sha256 <- as.character(variant$definition_sha256 %||% "")[1]
      variant$review_status <- "confirmed"
      variant$logic_confirmed_at <- now
      variant$logic_confirmation_method <- "editor_manual_review"
      variant$logic_review <- .xlsform_forms_merge_source(
        variant$logic_review %||% list(),
        list(
          content_sha256 = content_sha256,
          definition_sha256 = definition_sha256
        )
      )
      variant
    })
  }
  entry$source <- source
  entry$saved_at <- now
  s <- .xlsform_forms_upsert(s, entry)
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s

  fresh_entry <- .xlsform_forms_get(s, form_id)
  list(
    source = fresh_entry$source,
    publication = .xlsform_revision_publication(s, fresh_entry)
  )
}

# Borra una entrada. Si era la activa, reasigna al más reciente por saved_at
# (o limpia el espejo si la colección queda vacía).
.xlsform_forms_delete <- function(s, id) {
  forms <- s$xlsform_forms %||% list()
  id <- as.character(id %||% "")[1]
  if (!nzchar(id) || is.null(forms[[id]])) return(s)
  if (length(.xlsform_revision_for_form(s, id))) {
    stop_api(
      409,
      "E_FORM_HAS_REVISIONS",
      "El formulario tiene revisiones publicadas y no puede eliminarse."
    )
  }

  was_active <- identical(as.character(s$xlsform_active_form_id %||% "")[1], id)
  forms[[id]] <- NULL
  s$xlsform_forms <- forms

  if (was_active) {
    # set_active(NULL) limpia el espejo si no queda nada.
    s <- .xlsform_forms_set_active(s, .xlsform_forms_most_recent_id(forms))
  }
  s
}

# Migración idempotente post-load: si el proyecto trae `xlsform_state` legacy
# pero NO la colección, la siembra con esa única entrada como activa. No pierde
# datos anidados (p. ej. workbook$surveyMonkeyLogic) porque copia el workbook
# tal cual.
.xlsform_forms_seed_from_legacy <- function(s) {
  # Una colección existente no necesita migrarse, pero sí se normaliza para
  # que proyectos creados antes del saneado no vuelvan a guardar secretos.
  if (!is.null(s$xlsform_forms)) {
    forms <- s$xlsform_forms %||% list()
    forms <- lapply(forms, function(entry) {
      entry$source <- .xlsform_forms_sanitize_source(entry$source %||% list())
      entry
    })
    s$xlsform_forms <- forms
    active <- as.character(s$xlsform_active_form_id %||% "")[1]
    if (nzchar(active) && !is.null(forms[[active]])) {
      return(.xlsform_forms_set_active(s, active))
    }
    if (!is.null(s$xlsform_state)) {
      s$xlsform_state$source <- .xlsform_forms_sanitize_source(
        s$xlsform_state$source %||% list()
      )
    }
    return(s)
  }
  st <- s$xlsform_state
  if (is.null(st) || !is.list(st) || is.null(st$workbook)) return(s)

  entry <- .xlsform_forms_as_entry(st)
  s$xlsform_forms <- stats::setNames(list(entry), entry$id)
  .xlsform_forms_set_active(s, entry$id)
}
