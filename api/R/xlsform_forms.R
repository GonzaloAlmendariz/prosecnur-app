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
  source <- state$source %||% list()
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
    source = entry$source,
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
      source = e$source %||% list(),
      saved_at = as.character(e$saved_at %||% "")[1],
      n_questions = counts$n_questions,
      n_sections = counts$n_sections,
      active = identical(id, active)
    )
  })
}

# Entrada completa (con workbook) o NULL.
.xlsform_forms_get <- function(s, id) {
  forms <- s$xlsform_forms %||% list()
  id <- as.character(id %||% "")[1]
  if (!nzchar(id)) return(NULL)
  forms[[id]]
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

# Borra una entrada. Si era la activa, reasigna al más reciente por saved_at
# (o limpia el espejo si la colección queda vacía).
.xlsform_forms_delete <- function(s, id) {
  forms <- s$xlsform_forms %||% list()
  id <- as.character(id %||% "")[1]
  if (!nzchar(id) || is.null(forms[[id]])) return(s)

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
  # Idempotente: si ya existe la colección (aunque esté vacía), no toca nada.
  if (!is.null(s$xlsform_forms)) return(s)
  st <- s$xlsform_state
  if (is.null(st) || !is.list(st) || is.null(st$workbook)) return(s)

  entry <- .xlsform_forms_as_entry(st)
  s$xlsform_forms <- stats::setNames(list(entry), entry$id)
  .xlsform_forms_set_active(s, entry$id)
}
