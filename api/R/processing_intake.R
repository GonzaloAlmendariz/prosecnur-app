# =============================================================================
# Procesamiento > Carga — plan de ingreso de instrumentos publicados
# =============================================================================
#
# El plan vive fuera de `s$estudio`: una entrada acredita que un instrumento
# publicado está listo para recibir data, pero NO constituye todavía una base
# procesable. Los estados son siempre derivados al leer; publicar una revisión
# posterior puede volver `stale` un binding, pero nunca lo reemplaza.

.PROCESSING_INTAKE_SCHEMA <- "processing_intake/v1"
.PROCESSING_INTAKE_MODE <- "independent_siblings"
.PROCESSING_INTAKE_MAX_ENTRIES <- 10L

.processing_intake_scalar <- function(value, default = "") {
  if (is.null(value) || !length(value)) return(default)
  out <- as.character(value[[1]])
  if (is.na(out)) default else trimws(out)
}

.processing_intake_empty <- function() {
  list(
    schema = .PROCESSING_INTAKE_SCHEMA,
    processing_mode = .PROCESSING_INTAKE_MODE,
    family_id = NULL,
    revision = 0L,
    entries = list()
  )
}

.processing_intake_current <- function(s) {
  stored <- s$processing_intake %||% NULL
  if (is.null(stored)) return(.processing_intake_empty())
  if (!is.list(stored) ||
      !identical(.processing_intake_scalar(stored$schema), .PROCESSING_INTAKE_SCHEMA)) {
    stop_api(
      409,
      "E_PROCESSING_INTAKE_SCHEMA",
      "El plan de ingreso persistido usa un schema no compatible."
    )
  }
  revision <- suppressWarnings(as.integer(stored$revision %||% NA_integer_)[1])
  if (is.na(revision) || revision < 0L) {
    stop_api(409, "E_PROCESSING_INTAKE_SCHEMA", "La revisión persistida del plan no es válida.")
  }
  list(
    schema = .PROCESSING_INTAKE_SCHEMA,
    processing_mode = .PROCESSING_INTAKE_MODE,
    family_id = {
      value <- .processing_intake_scalar(stored$family_id)
      if (nzchar(value)) value else NULL
    },
    revision = revision,
    entries = .processing_intake_entries_list(stored$entries %||% list())
  )
}

.processing_intake_entries_list <- function(entries) {
  if (is.null(entries) || !length(entries)) return(list())
  if (is.data.frame(entries)) {
    return(unname(lapply(seq_len(nrow(entries)), function(i) as.list(entries[i, , drop = FALSE]))))
  }
  if (!is.list(entries)) return(list(entries))
  entry_fields <- c(
    "entry_id", "base", "base_label", "actor_key", "actor",
    "instrument_revision_id", "status"
  )
  if (length(intersect(names(entries) %||% character(0), entry_fields))) {
    return(list(entries))
  }
  unname(entries)
}

.processing_intake_issue <- function(code, message, index = NULL,
                                     entry_id = NULL, field = NULL) {
  out <- list(code = code, message = message)
  if (!is.null(index)) out$index <- as.integer(index)
  if (!is.null(entry_id) && nzchar(entry_id)) out$entry_id <- entry_id
  if (!is.null(field) && nzchar(field)) out$field <- field
  out
}

# `actor_required` distingue el estudio de acreditación multiactor —donde cada
# base ES un público y sin actor la entrada no significa nada— de cualquier
# otro estudio, donde el instrumento no se reparte entre actores. Cuando no es
# requerido, `actor_key`/`actor` pueden venir vacíos; si vienen con valor,
# igual se validan como identidades bien formadas.
.processing_intake_normalize_entry <- function(entry, index, actor_required = TRUE) {
  if (!is.list(entry)) entry <- list()
  normalized <- list(
    entry_id = .processing_intake_scalar(entry$entry_id),
    base = .processing_intake_scalar(entry$base),
    base_label = .processing_intake_scalar(entry$base_label),
    actor_key = .processing_intake_scalar(entry$actor_key),
    actor = .processing_intake_scalar(entry$actor),
    instrument_revision_id = .processing_intake_scalar(entry$instrument_revision_id)
  )
  blockers <- list()
  add <- function(code, message, field) {
    blockers[[length(blockers) + 1L]] <<- .processing_intake_issue(
      code, message, index, normalized$entry_id, field
    )
  }

  if (!grepl("^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$", normalized$entry_id)) {
    add("E_PROCESSING_INTAKE_ENTRY_ID", "entry_id debe ser una identidad técnica estable.", "entry_id")
  }
  if (!grepl("^[a-z0-9][a-z0-9_-]{0,71}$", normalized$base)) {
    add("E_PROCESSING_INTAKE_BASE", "base debe ser una clave técnica estable en minúsculas.", "base")
  }
  if (!nzchar(normalized$base_label) || nchar(normalized$base_label, type = "chars") > 160L) {
    add("E_PROCESSING_INTAKE_BASE_LABEL", "base_label es obligatorio y admite hasta 160 caracteres.", "base_label")
  }
  actor_declared <- nzchar(normalized$actor_key) || nzchar(normalized$actor)
  if (actor_required || actor_declared) {
    if (!grepl("^[a-z0-9][a-z0-9_-]{0,71}$", normalized$actor_key)) {
      add("E_PROCESSING_INTAKE_ACTOR_KEY", "actor_key debe ser una clave técnica estable en minúsculas.", "actor_key")
    }
    if (!nzchar(normalized$actor) || nchar(normalized$actor, type = "chars") > 160L) {
      add("E_PROCESSING_INTAKE_ACTOR", "actor es obligatorio y admite hasta 160 caracteres.", "actor")
    }
  }
  if (!nzchar(normalized$instrument_revision_id)) {
    add(
      "E_PROCESSING_INTAKE_INSTRUMENT_REVISION",
      "instrument_revision_id es obligatorio.",
      "instrument_revision_id"
    )
  }

  list(entry = normalized, blockers = blockers)
}

.processing_intake_revision <- function(s, revision_id) {
  revisions <- s$instrument_revisions %||% list()
  direct <- revisions[[revision_id]] %||% NULL
  if (!is.null(direct) &&
      identical(.processing_intake_scalar(direct$revision_id), revision_id)) {
    return(direct)
  }
  hits <- Filter(function(item) {
    identical(.processing_intake_scalar((item %||% list())$revision_id), revision_id)
  }, unname(revisions))
  if (length(hits)) hits[[1]] else NULL
}

.processing_intake_latest_revision <- function(s, form_id) {
  form_id <- .processing_intake_scalar(form_id)
  if (!nzchar(form_id)) return(NULL)
  revisions <- Filter(function(item) {
    identical(.processing_intake_scalar((item %||% list())$form_id), form_id)
  }, unname(s$instrument_revisions %||% list()))
  if (!length(revisions)) return(NULL)
  revision_no <- vapply(revisions, function(item) {
    value <- suppressWarnings(as.integer(item$revision_no %||% 0L)[1])
    if (is.na(value)) 0L else value
  }, integer(1))
  published <- vapply(revisions, function(item) {
    .processing_intake_scalar(item$published_at)
  }, character(1))
  revisions[[order(revision_no, published, decreasing = TRUE)[[1]]]]
}

# Leer un XLSForm físico como workbook canónico no es propio del plan de
# ingreso: el binding por hash de `instrument_revision_binding.R` necesita
# exactamente lo mismo. La implementación vive allá; acá queda el alias con el
# nombre que ya usan los llamadores de este archivo.
.processing_intake_physical_workbook <- function(path) {
  instrument_revision_workbook_from_xlsx(path)
}

.processing_intake_revision_health <- function(s, revision_id) {
  revision <- .processing_intake_revision(s, revision_id)
  reasons <- list()
  add <- function(code, message) {
    reasons[[length(reasons) + 1L]] <<- list(code = code, message = message)
  }
  if (is.null(revision)) {
    add("instrument_revision_not_found", "La revisión publicada ya no existe en el proyecto.")
    return(list(ok = FALSE, revision = NULL, file = NULL, reasons = reasons))
  }
  if (!identical(.processing_intake_scalar(revision$schema), "instrument_revision/v1")) {
    add("instrument_revision_schema", "La revisión usa un schema no compatible.")
  }
  if (!identical(.processing_intake_scalar(revision$revision_id), revision_id)) {
    add("instrument_revision_identity", "La identidad interna de la revisión no coincide.")
  }
  content_sha256 <- .processing_intake_scalar(revision$content_sha256)
  if (!grepl("^[0-9a-f]{64}$", content_sha256)) {
    add("instrument_revision_hash", "La revisión no conserva un hash canónico SHA-256 válido.")
  }
  file_id <- .processing_intake_scalar(revision$xlsform_file_id)
  meta <- (s$files %||% list())[[file_id]] %||% NULL
  if (!nzchar(file_id) || is.null(meta)) {
    add("instrument_snapshot_missing", "No existe el XLSForm local de la revisión.")
  } else {
    if (!identical(.processing_intake_scalar(meta$kind), "xlsform")) {
      add("instrument_snapshot_kind", "El archivo de la revisión no es un XLSForm.")
    }
    path <- .processing_intake_scalar(meta$path)
    if (!nzchar(path) || !file.exists(path)) {
      add("instrument_snapshot_file_missing", "El snapshot XLSForm no está disponible en disco.")
    } else {
      physical_hash <- tryCatch({
        .xlsform_revision_hash(.processing_intake_physical_workbook(path))
      }, error = function(e) e)
      if (inherits(physical_hash, "error")) {
        add("instrument_snapshot_unreadable", "El snapshot XLSForm no se puede leer como XLSForm válido.")
      } else if (!identical(physical_hash, content_sha256)) {
        add("instrument_snapshot_hash_mismatch", "El contenido físico no coincide con el hash canónico publicado.")
      }
    }
  }
  list(ok = !length(reasons), revision = revision, file = meta, reasons = reasons)
}

.processing_intake_is_acreditacion <- function(s) {
  .acreditacion_actor_profile_active(s)
}

.processing_intake_actor_binding_reasons <- function(s, entry, revision) {
  source <- revision$source %||% list()
  if (!is.list(source)) source <- list()
  source_actor_key <- .processing_intake_scalar(source$actor_key)
  source_schema <- .processing_intake_scalar(source$schema)

  if (nzchar(source_actor_key) && !identical(source_actor_key, entry$actor_key)) {
    return(list(list(
      code = "instrument_actor_mismatch",
      message = sprintf(
        "La revisión publicada corresponde al actor_key '%s', no a '%s'.",
        source_actor_key,
        entry$actor_key
      ),
      field = "actor_key"
    )))
  }
  if (!nzchar(source_actor_key) &&
      (identical(source_schema, .ACREDITACION_ACTOR_INSTRUMENT_SCHEMA) ||
       .processing_intake_is_acreditacion(s))) {
    return(list(list(
      code = "instrument_actor_required",
      message = "La revisión publicada de acreditación debe declarar source.actor_key.",
      field = "actor_key"
    )))
  }
  # Sin actor declarado y sin ser un estudio de acreditación no hay nada que
  # contrastar: el catálogo de Monitoreo puede existir por otras razones y no
  # gobierna a un instrumento que no se reparte entre públicos.
  if (!nzchar(entry$actor_key) && !.processing_intake_is_acreditacion(s)) {
    return(list())
  }
  catalog <- .acreditacion_actor_catalog(s)
  if (length(catalog) && !(entry$actor_key %in% catalog)) {
    return(list(list(
      code = "instrument_actor_not_in_catalog",
      message = paste0(
        "El público asignado ya no pertenece a las fuentes activas de ",
        "acreditación en Monitoreo."
      ),
      field = "actor_key"
    )))
  }
  list()
}

.processing_intake_derive_entry <- function(s, entry, family_id = NULL) {
  health <- .processing_intake_revision_health(s, entry$instrument_revision_id)
  revision <- health$revision %||% list()
  form_id <- .processing_intake_scalar(revision$form_id)
  latest <- .processing_intake_latest_revision(s, form_id)
  latest_id <- .processing_intake_scalar((latest %||% list())$revision_id)
  actor_binding_reasons <- .processing_intake_actor_binding_reasons(s, entry, revision)
  reasons <- c(health$reasons, actor_binding_reasons)
  status <- "instrument_ready"

  base <- (((s$estudio %||% list())$bases %||% list())[[entry$base]]) %||% NULL
  if (!isTRUE(health$ok) || length(actor_binding_reasons)) {
    status <- "blocked"
  } else if (!is.null(base)) {
    materialized_revision <- .processing_intake_scalar(base$instrument_revision_id)
    materialized_entry <- .processing_intake_scalar(base$processing_intake_entry_id)
    materialized_family <- .processing_intake_scalar(base$sibling_family_id)
    if (nzchar(.processing_intake_scalar(family_id)) &&
        identical(materialized_revision, entry$instrument_revision_id) &&
        identical(materialized_entry, entry$entry_id) &&
        identical(materialized_family, .processing_intake_scalar(family_id))) {
      status <- "materialized"
    } else {
      status <- "blocked"
      reasons[[length(reasons) + 1L]] <- list(
        code = "base_target_conflict",
        message = paste0(
          "La clave base ya pertenece a una base que no acredita conjuntamente ",
          "entry_id, sibling_family_id e instrument_revision_id."
        )
      )
    }
  } else if (nzchar(latest_id) && !identical(latest_id, entry$instrument_revision_id)) {
    status <- "stale"
  }

  c(entry, list(
    status = status,
    form_id = if (nzchar(form_id)) form_id else NULL,
    latest_revision_id = if (nzchar(latest_id)) latest_id else NULL,
    blocking_reasons = unname(reasons)
  ))
}

.processing_intake_catalog <- function(s) {
  revisions <- unname(s$instrument_revisions %||% list())
  if (!length(revisions)) return(list())
  forms <- s$xlsform_forms %||% list()
  rows <- lapply(revisions, function(revision) {
    revision_id <- .processing_intake_scalar(revision$revision_id)
    form_id <- .processing_intake_scalar(revision$form_id)
    form <- forms[[form_id]] %||% list()
    latest <- .processing_intake_latest_revision(s, form_id)
    health <- .processing_intake_revision_health(s, revision_id)
    source <- revision$source %||% list()
    if (exists(".xlsform_revision_sanitize_source", mode = "function")) {
      source <- .xlsform_revision_sanitize_source(source)
    }
    list(
      revision_id = revision_id,
      form_id = form_id,
      form_name = .processing_intake_scalar(form$name, form_id),
      revision_no = as.integer(revision$revision_no %||% 0L),
      content_sha256 = .processing_intake_scalar(revision$content_sha256),
      xlsform_file_id = .processing_intake_scalar(revision$xlsform_file_id),
      source = source,
      published_at = .processing_intake_scalar(revision$published_at),
      is_latest = identical(
        revision_id,
        .processing_intake_scalar((latest %||% list())$revision_id)
      ),
      available = isTRUE(health$ok),
      blocking_reasons = unname(health$reasons)
    )
  })
  ord <- order(
    vapply(rows, `[[`, character(1), "form_name"),
    -vapply(rows, `[[`, integer(1), "revision_no")
  )
  unname(rows[ord])
}

.processing_intake_validate_state <- function(s, entries, family_id = NULL) {
  entries <- .processing_intake_entries_list(entries)
  blockers <- list()
  warnings <- list()
  normalized <- list()

  if (length(entries) > .PROCESSING_INTAKE_MAX_ENTRIES) {
    blockers[[length(blockers) + 1L]] <- .processing_intake_issue(
      "E_PROCESSING_INTAKE_LIMIT",
      sprintf("El plan admite como máximo %d entradas.", .PROCESSING_INTAKE_MAX_ENTRIES)
    )
  }
  actor_required <- .processing_intake_is_acreditacion(s)
  if (length(entries)) {
    for (i in seq_along(entries)) {
      result <- .processing_intake_normalize_entry(entries[[i]], i, actor_required)
      normalized[[i]] <- result$entry
      blockers <- c(blockers, result$blockers)
    }
  }

  duplicate_issues <- function(values, field, code, label) {
    values <- as.character(values)
    duplicated_values <- unique(values[nzchar(values) & (duplicated(values) | duplicated(values, fromLast = TRUE))])
    lapply(duplicated_values, function(value) {
      .processing_intake_issue(code, sprintf("%s '%s' está repetido.", label, value), field = field)
    })
  }
  if (length(normalized)) {
    blockers <- c(blockers, duplicate_issues(
      vapply(normalized, `[[`, character(1), "entry_id"),
      "entry_id", "E_PROCESSING_INTAKE_ENTRY_DUPLICATED", "entry_id"
    ))
    blockers <- c(blockers, duplicate_issues(
      vapply(normalized, `[[`, character(1), "base"),
      "base", "E_PROCESSING_INTAKE_BASE_DUPLICATED", "base"
    ))
    blockers <- c(blockers, duplicate_issues(
      vapply(normalized, `[[`, character(1), "actor_key"),
      "actor_key", "E_PROCESSING_INTAKE_ACTOR_DUPLICATED", "actor_key"
    ))
  }

  decorated <- lapply(normalized, function(entry) {
    .processing_intake_derive_entry(s, entry, family_id = family_id)
  })
  for (i in seq_along(decorated)) {
    entry <- decorated[[i]]
    if (identical(entry$status, "blocked") && length(entry$blocking_reasons)) {
      for (reason in entry$blocking_reasons) {
        blockers[[length(blockers) + 1L]] <- .processing_intake_issue(
          paste0("E_PROCESSING_INTAKE_", toupper(reason$code %||% "BLOCKED")),
          .processing_intake_scalar(reason$message, "La entrada está bloqueada."),
          i,
          entry$entry_id,
          .processing_intake_scalar(reason$field, "instrument_revision_id")
        )
      }
    } else if (identical(entry$status, "stale")) {
      warnings[[length(warnings) + 1L]] <- .processing_intake_issue(
        "W_PROCESSING_INTAKE_STALE",
        "Existe una revisión posterior; el binding se conserva sin sustituirlo.",
        i,
        entry$entry_id,
        "instrument_revision_id"
      )
    }
  }

  list(
    valid = !length(blockers),
    blockers = unname(blockers),
    warnings = unname(warnings),
    entries = unname(decorated),
    max_entries = .PROCESSING_INTAKE_MAX_ENTRIES
  )
}

.processing_intake_payload_from_state <- function(s) {
  intake <- .processing_intake_current(s)
  validation <- .processing_intake_validate_state(s, intake$entries, family_id = intake$family_id)
  intake$entries <- validation$entries
  list(
    ok = TRUE,
    intake = intake,
    revisions = .processing_intake_catalog(s),
    validation = validation
  )
}

processing_intake_get <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) stop_api(404, "E_NO_SESSION", "Sin sesión.")
  .processing_intake_payload_from_state(s)
}

processing_intake_validate <- function(sid, entries) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) stop_api(404, "E_NO_SESSION", "Sin sesión.")
  current <- .processing_intake_current(s)
  validation <- .processing_intake_validate_state(s, entries, family_id = current$family_id)
  list(
    ok = TRUE,
    intake = current,
    revisions = .processing_intake_catalog(s),
    validation = validation
  )
}

.processing_intake_expected_revision <- function(value) {
  if (is.null(value) || !length(value)) {
    stop_api(400, "E_PROCESSING_INTAKE_EXPECTED_REVISION", "expected_revision es obligatorio.")
  }
  parsed <- suppressWarnings(as.integer(value[[1]]))
  raw <- suppressWarnings(as.numeric(value[[1]]))
  if (is.na(parsed) || is.na(raw) || parsed < 0L || raw != parsed) {
    stop_api(400, "E_PROCESSING_INTAKE_EXPECTED_REVISION", "expected_revision debe ser un entero no negativo.")
  }
  parsed
}

processing_intake_save <- function(sid, expected_revision, entries) {
  expected_revision <- .processing_intake_expected_revision(expected_revision)
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) stop_api(404, "E_NO_SESSION", "Sin sesión.")
  current <- .processing_intake_current(s)
  if (!identical(current$revision, expected_revision)) {
    stop_api(
      409,
      "E_PROCESSING_INTAKE_STALE",
      "El plan cambió desde que se abrió la pantalla.",
      details = list(expected_revision = expected_revision, current_revision = current$revision)
    )
  }

  validation <- .processing_intake_validate_state(s, entries, family_id = current$family_id)
  if (!isTRUE(validation$valid)) {
    stop_api(
      422,
      "E_PROCESSING_INTAKE_INVALID",
      "El plan de ingreso contiene entradas bloqueantes.",
      details = list(blockers = validation$blockers, warnings = validation$warnings)
    )
  }

  entry_fields <- c(
    "entry_id", "base", "base_label", "actor_key", "actor",
    "instrument_revision_id"
  )
  proposed_entries <- lapply(validation$entries, function(entry) entry[entry_fields])
  current_entries <- lapply(current$entries, function(entry) entry[entry_fields])
  if (identical(unname(proposed_entries), unname(current_entries))) {
    return(.processing_intake_payload_from_state(s))
  }

  # Releer justo antes de asignar mantiene la guarda explícita aun si el
  # runtime cambia a un modelo con requests intercalables.
  fresh <- session_get(sid)
  fresh_current <- .processing_intake_current(fresh)
  if (!identical(fresh_current$revision, expected_revision)) {
    stop_api(
      409,
      "E_PROCESSING_INTAKE_STALE",
      "El plan cambió durante el guardado.",
      details = list(expected_revision = expected_revision, current_revision = fresh_current$revision)
    )
  }
  fresh_validation <- .processing_intake_validate_state(
    fresh,
    proposed_entries,
    family_id = fresh_current$family_id
  )
  if (!isTRUE(fresh_validation$valid)) {
    stop_api(
      422,
      "E_PROCESSING_INTAKE_INVALID",
      "El plan de ingreso cambió a un estado bloqueante durante el guardado.",
      details = list(
        blockers = fresh_validation$blockers,
        warnings = fresh_validation$warnings
      )
    )
  }
  family_id <- fresh_current$family_id
  if (is.null(family_id) || !nzchar(family_id)) family_id <- uuid::UUIDgenerate()
  stored_entries <- proposed_entries
  next_state <- fresh
  next_state$processing_intake <- list(
    schema = .PROCESSING_INTAKE_SCHEMA,
    processing_mode = .PROCESSING_INTAKE_MODE,
    family_id = family_id,
    revision = expected_revision + 1L,
    entries = unname(stored_entries)
  )
  next_state <- .mark_project_dirty(next_state)
  .session_env[[sid]] <- next_state
  .processing_intake_payload_from_state(next_state)
}
