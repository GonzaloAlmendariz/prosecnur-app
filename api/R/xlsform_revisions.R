# =============================================================================
# Revisiones inmutables de instrumentos nacidos en el Editor XLSForm
# =============================================================================
#
# `s$xlsform_forms` conserva borradores mutables. Este engine publica snapshots
# locales e inmutables sin depender del formulario activo. El hash representa
# solo el instrumento procesable (survey/choices/settings), no los bytes XLSX:
# openxlsx puede introducir metadata variable dentro del ZIP.

.XLSFORM_REVISION_SCHEMA <- "instrument_revision/v1"
.XLSFORM_CANONICAL_SCHEMA <- "xlsform_canonical/v1"

.xlsform_revision_utf8_cell <- function(value) {
  if (is.null(value) || !length(value)) return("")
  value <- as.character(value[[1]])
  if (is.na(value)) value <- ""
  enc2utf8(value)
}

.xlsform_revision_sheet <- function(workbook, sheet_name) {
  sheet <- (workbook %||% list())[[sheet_name]] %||% list()
  columns <- sheet$columns %||% character(0)
  if (is.list(columns)) {
    columns <- unlist(columns, recursive = FALSE, use.names = FALSE)
  }
  columns <- vapply(as.list(columns), .xlsform_revision_utf8_cell, character(1))

  # `paper_*` pertenece a la capa de edición/entregables, no al instrumento
  # ODK que consumen Validación, Codificación y Analítica.
  keep <- !grepl("^paper_", columns, ignore.case = TRUE)
  columns_kept <- columns[keep]
  rows_raw <- sheet$rows %||% list()
  rows <- lapply(rows_raw, function(row) {
    row <- row %||% list()
    if (!is.list(row)) row <- as.list(row)
    values <- vapply(row, .xlsform_revision_utf8_cell, character(1))
    if (length(values) < length(columns)) {
      values <- c(values, rep("", length(columns) - length(values)))
    }
    if (length(values) > length(columns)) {
      values <- values[seq_len(length(columns))]
    }
    if (length(columns)) values <- values[keep]
    unname(as.list(values))
  })

  list(
    columns = unname(as.list(columns_kept)),
    rows = unname(rows)
  )
}

.xlsform_revision_canonical <- function(workbook) {
  list(
    schema = .XLSFORM_CANONICAL_SCHEMA,
    survey = .xlsform_revision_sheet(workbook, "survey"),
    choices = .xlsform_revision_sheet(workbook, "choices"),
    settings = .xlsform_revision_sheet(workbook, "settings")
  )
}

.xlsform_revision_hash <- function(workbook) {
  if (!requireNamespace("digest", quietly = TRUE)) {
    stop_api(500, "E_NO_SHA256", "El runtime no dispone del motor SHA-256 requerido.")
  }
  canonical_json <- jsonlite::toJSON(
    .xlsform_revision_canonical(workbook),
    auto_unbox = TRUE,
    null = "null",
    na = "null",
    pretty = FALSE
  )
  tolower(digest::digest(
    charToRaw(enc2utf8(as.character(canonical_json))),
    algo = "sha256",
    serialize = FALSE
  ))
}

.xlsform_revision_for_form <- function(s, form_id) {
  revisions <- s$instrument_revisions %||% list()
  if (!length(revisions)) return(list())
  form_id <- as.character(form_id %||% "")[1]
  out <- Filter(
    function(item) identical(as.character(item$form_id %||% "")[1], form_id),
    unname(revisions)
  )
  if (!length(out)) return(list())
  ord <- order(
    vapply(out, function(item) as.integer(item$revision_no %||% 0L), integer(1)),
    decreasing = TRUE
  )
  unname(out[ord])
}

.xlsform_revision_latest <- function(s, form_id) {
  revisions <- .xlsform_revision_for_form(s, form_id)
  if (!length(revisions)) return(NULL)
  revisions[[1]]
}

.xlsform_revision_diagnostics <- function(workbook) {
  diagnostics <- .xlsform_editor_validate_workbook(workbook)
  diagnostics <- diagnostics %||% list()
  warning <- vapply(diagnostics, function(item) {
    startsWith(as.character(item$id %||% "")[1], "ast-unparseable-")
  }, logical(1))
  list(
    blockers = unname(diagnostics[!warning]),
    warnings = unname(diagnostics[warning])
  )
}

.xlsform_revision_source_canonical <- function(value) {
  value <- .xlsform_forms_sanitize_source(value)
  canonicalize <- function(node) {
    if (!is.list(node)) {
      keys <- names(node)
      if (!is.null(keys) && length(keys)) node <- node[order(keys)]
      return(node)
    }
    keys <- names(node)
    if (is.null(keys) || !length(keys) || any(!nzchar(keys))) {
      return(unname(lapply(node, canonicalize)))
    }
    node <- node[order(keys)]
    lapply(node, canonicalize)
  }
  canonicalize(value)
}

.xlsform_revision_source_hash <- function(source) {
  if (!requireNamespace("digest", quietly = TRUE)) {
    stop_api(500, "E_NO_SHA256", "El runtime no dispone del motor SHA-256 requerido.")
  }
  canonical_json <- jsonlite::toJSON(
    .xlsform_revision_source_canonical(source),
    auto_unbox = TRUE,
    null = "null",
    na = "null",
    pretty = FALSE
  )
  tolower(digest::digest(
    charToRaw(enc2utf8(as.character(canonical_json))),
    algo = "sha256",
    serialize = FALSE
  ))
}

.xlsform_revision_choice_code_maps <- function(workbook) {
  maps <- ((workbook %||% list())$surveyMonkeyLogic %||% list())$choice_code_maps %||% list()
  if (!is.list(maps)) return(list())
  .xlsform_forms_sanitize_source(maps)
}

.xlsform_revision_choice_code_maps_hash <- function(workbook) {
  .xlsform_editor_sm_hash(.xlsform_revision_choice_code_maps(workbook))
}

.xlsform_revision_stored_choice_code_maps_hash <- function(revision) {
  revision <- revision %||% list()
  stored <- as.character(
    revision$choice_code_maps_sha256 %||%
      (revision$logic_audit %||% list())$choice_code_maps_sha256 %||%
      ""
  )[1]
  if (nzchar(stored)) return(stored)
  maps <- revision$choice_code_maps %||% list()
  .xlsform_editor_sm_hash(if (is.list(maps)) maps else list())
}

.xlsform_revision_logic_blockers <- function(source, content_sha256, workbook = list()) {
  source <- .xlsform_forms_sanitize_source(source)
  logic_status <- as.character(source$logic_status %||% "")[1]
  if (identical(logic_status, "pending_manual_confirmation")) {
    detail <- trimws(as.character(source$publication_guard %||% "")[1])
    if (is.na(detail) || !nzchar(detail)) {
      detail <- "Confirma manualmente la lógica antes de publicar."
    }
    return(list(list(
      id = "logic_pending_manual_confirmation",
      level = "error",
      title = "Lógica pendiente de confirmación",
      detail = detail
    )))
  }

  blockers <- list()
  if (!identical(logic_status, "confirmed")) return(blockers)

  logic_review <- source$logic_review %||% list()
  reviewed_hash <- as.character(logic_review$content_sha256 %||% "")[1]
  choice_code_maps <- .xlsform_revision_choice_code_maps(workbook)
  choice_code_maps_sha256 <- .xlsform_revision_choice_code_maps_hash(workbook)
  reviewed_maps_sha256 <- as.character(
    logic_review$choice_code_maps_sha256 %||% ""
  )[1]
  current_definition <- as.character(source$definition_sha256 %||% "")[1]
  reviewed_definition <- as.character(logic_review$definition_sha256 %||% "")[1]
  maps_stale <- if (nzchar(reviewed_maps_sha256)) {
    !identical(reviewed_maps_sha256, choice_code_maps_sha256)
  } else {
    length(choice_code_maps) > 0L
  }
  top_level_stale <- !identical(reviewed_hash, content_sha256) ||
    (nzchar(current_definition) &&
      !identical(reviewed_definition, current_definition)) ||
    maps_stale
  if (top_level_stale) {
    blockers <- c(blockers, list(list(
      id = "logic_confirmation_stale",
      level = "error",
      title = "Confirmación de lógica desactualizada",
      detail = "El instrumento cambió después de la revisión manual. Confirma nuevamente la lógica antes de publicar."
    )))
  }

  variants <- source$variants %||% list()
  if (!is.list(variants) || !length(variants)) return(blockers)
  variant_pending <- any(vapply(variants, function(variant) {
    if (!is.list(variant)) return(TRUE)
    !identical(
      as.character(variant$review_status %||% "")[1],
      "confirmed"
    )
  }, logical(1)))
  if (variant_pending) {
    blockers <- c(blockers, list(list(
      id = "logic_variant_pending_manual_confirmation",
      level = "error",
      title = "Variante pendiente de confirmación",
      detail = "Confirma manualmente la lógica de todas las variantes SurveyMonkey antes de publicar."
    )))
  }

  variant_stale <- any(vapply(variants, function(variant) {
    if (!is.list(variant) ||
        !identical(as.character(variant$review_status %||% "")[1], "confirmed")) {
      return(FALSE)
    }
    logic_review <- variant$logic_review %||% list()
    sealed_content <- as.character(logic_review$content_sha256 %||% "")[1]
    sealed_definition <- as.character(logic_review$definition_sha256 %||% "")[1]
    current_definition <- as.character(variant$definition_sha256 %||% "")[1]
    !identical(sealed_content, content_sha256) ||
      !identical(sealed_definition, current_definition)
  }, logical(1)))
  if (variant_stale) {
    blockers <- c(blockers, list(list(
      id = "logic_variant_confirmation_stale",
      level = "error",
      title = "Confirmación de variante desactualizada",
      detail = "El instrumento o una definición SurveyMonkey cambió después de la revisión manual. Confirma nuevamente la lógica antes de publicar."
    )))
  }
  blockers
}

.xlsform_revision_logic_audit <- function(source, content_sha256, source_sha256,
                                           choice_code_maps_sha256,
                                           warnings, validated_at) {
  source <- .xlsform_forms_sanitize_source(source)
  list(
    status = as.character(source$logic_status %||% "legacy_untracked")[1],
    confirmed_at = source$logic_confirmed_at %||% NULL,
    method = source$logic_confirmation_method %||% NULL,
    content_sha256 = content_sha256,
    source_sha256 = source_sha256,
    choice_code_maps_sha256 = choice_code_maps_sha256,
    diagnostics = warnings %||% list(),
    validated_at = validated_at
  )
}

.xlsform_revision_has_substantive_questions <- function(workbook) {
  survey <- (workbook %||% list())$survey %||% list()
  columns <- vapply(
    survey$columns %||% list(),
    .xlsform_revision_utf8_cell,
    character(1)
  )
  type_index <- match("type", tolower(trimws(columns)))
  rows <- survey$rows %||% list()
  if (is.na(type_index) || !length(rows)) return(FALSE)

  excluded <- c(
    "begin_group", "end_group", "begin_repeat", "end_repeat",
    "note", "calculate", "hidden",
    "start", "end", "today", "deviceid", "subscriberid", "simserial",
    "phonenumber", "username", "email", "audit", "background-audio",
    "instanceid"
  )
  any(vapply(rows, function(row) {
    row <- row %||% list()
    if (!is.list(row)) row <- as.list(row)
    type <- if (length(row) >= type_index) {
      .xlsform_revision_utf8_cell(row[[type_index]])
    } else {
      ""
    }
    base <- tolower(trimws(sub("\\s.*$", "", type)))
    nzchar(base) && !(base %in% excluded)
  }, logical(1)))
}

.xlsform_revision_domain_blockers <- function(s, workbook, source) {
  blockers <- list()
  if (!.xlsform_revision_has_substantive_questions(workbook)) {
    blockers[[length(blockers) + 1L]] <- list(
      id = "no_substantive_questions",
      level = "error",
      title = "Instrumento sin preguntas sustantivas",
      detail = paste0(
        "Agrega al menos una pregunta antes de publicar; grupos, metadata, ",
        "notas, cálculos y campos ocultos no cuentan como preguntas."
      )
    )
  }

  if (!.acreditacion_actor_profile_active(s) &&
      !.acreditacion_actor_instrument(source)) {
    return(blockers)
  }
  actor_key <- .estudio_scalar((source %||% list())$actor_key, "")
  if (!nzchar(actor_key) || identical(actor_key, "sin_actor")) {
    blockers[[length(blockers) + 1L]] <- list(
      id = "actor_required",
      level = "error",
      title = "Actor de acreditación obligatorio",
      detail = "Asigna un actor del catálogo de Monitoreo antes de publicar."
    )
    return(blockers)
  }

  catalog <- .acreditacion_actor_catalog(s)
  if (length(catalog) && !(actor_key %in% catalog)) {
    blockers[[length(blockers) + 1L]] <- list(
      id = "actor_not_in_catalog",
      level = "error",
      title = "Actor fuera del catálogo",
      detail = paste0(
        "El público asignado ya no pertenece a las fuentes activas de ",
        "acreditación en Monitoreo."
      )
    )
  }
  blockers
}

.xlsform_revision_publication <- function(s, entry) {
  form_id <- as.character(entry$id %||% "")[1]
  draft_hash <- .xlsform_revision_hash(entry$workbook %||% list())
  draft_source_hash <- .xlsform_revision_source_hash(entry$source %||% list())
  draft_maps_hash <- .xlsform_revision_choice_code_maps_hash(entry$workbook %||% list())
  diagnostics <- .xlsform_revision_diagnostics(entry$workbook %||% list())
  logic_blockers <- .xlsform_revision_logic_blockers(
    entry$source,
    draft_hash,
    entry$workbook %||% list()
  )
  domain_blockers <- .xlsform_revision_domain_blockers(
    s,
    entry$workbook %||% list(),
    entry$source
  )
  blockers <- c(logic_blockers, domain_blockers, diagnostics$blockers)
  latest <- .xlsform_revision_latest(s, form_id)

  status <- if (length(blockers)) {
    "blocked"
  } else if (is.null(latest)) {
    "draft"
  } else if (
    identical(as.character(latest$content_sha256 %||% "")[1], draft_hash) &&
      identical(
        as.character((latest$logic_audit %||% list())$source_sha256 %||% "")[1],
        draft_source_hash
      ) &&
      identical(
        as.character(
          latest$choice_code_maps_sha256 %||%
            (latest$logic_audit %||% list())$choice_code_maps_sha256 %||%
            .xlsform_editor_sm_hash(list())
        )[1],
        draft_maps_hash
      )
  ) {
    "published"
  } else {
    "changes_pending"
  }

  list(
    status = status,
    draft_content_sha256 = draft_hash,
    draft_source_sha256 = draft_source_hash,
    draft_choice_code_maps_sha256 = draft_maps_hash,
    latest_revision = latest,
    blockers = blockers,
    warnings = diagnostics$warnings,
    can_publish = !length(blockers) && !identical(status, "published"),
    can_delete = is.null(latest)
  )
}

.xlsform_revision_sheet_df <- function(canonical_sheet) {
  columns <- vapply(canonical_sheet$columns %||% list(), as.character, character(1))
  rows <- canonical_sheet$rows %||% list()
  if (!length(columns)) return(data.frame())
  if (!length(rows)) {
    out <- as.data.frame(
      stats::setNames(vector("list", length(columns)), columns),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
    for (nm in names(out)) out[[nm]] <- character(0)
    return(out)
  }
  matrix_rows <- lapply(rows, function(row) {
    values <- vapply(row, as.character, character(1))
    if (length(values) < length(columns)) {
      values <- c(values, rep("", length(columns) - length(values)))
    }
    values[seq_len(length(columns))]
  })
  out <- as.data.frame(
    do.call(rbind, matrix_rows),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  names(out) <- columns
  out
}

.xlsform_revision_materialize <- function(workbook) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop_api(500, "E_XLSFORM_MATERIALIZE_FAILED", "No está disponible el motor XLSX local.")
  }
  canonical <- .xlsform_revision_canonical(workbook)
  tmp <- tempfile("xlsform_revision_", fileext = ".xlsx")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)

  tryCatch({
    wb <- openxlsx::createWorkbook()
    for (sheet_name in c("survey", "choices", "settings")) {
      data <- .xlsform_revision_sheet_df(canonical[[sheet_name]])
      openxlsx::addWorksheet(wb, sheet_name)
      openxlsx::writeData(wb, sheet_name, data)
      openxlsx::freezePane(wb, sheet_name, firstActiveRow = 2)
    }
    openxlsx::saveWorkbook(wb, tmp, overwrite = TRUE)
  }, error = function(e) {
    stop_api(
      500,
      "E_XLSFORM_MATERIALIZE_FAILED",
      "No se pudo materializar la revisión XLSForm.",
      details = list(reason = conditionMessage(e))
    )
  })
  readBin(tmp, what = "raw", n = file.info(tmp)$size)
}

.xlsform_revision_stage <- function(s, revision_id, raw_bytes) {
  file_id <- uuid::UUIDgenerate()
  final_path <- file.path(s$dir, "uploads", sprintf("%s.xlsx", file_id))
  pending_path <- file.path(s$dir, "uploads", sprintf(".pending-%s.xlsx", file_id))
  dir.create(dirname(pending_path), recursive = TRUE, showWarnings = FALSE)
  ok <- tryCatch({
    writeBin(raw_bytes, pending_path)
    TRUE
  }, error = function(e) FALSE)
  if (!ok || !file.exists(pending_path)) {
    unlink(pending_path, force = TRUE)
    stop_api(500, "E_INSTRUMENT_REVISION_COMMIT_FAILED", "No se pudo preparar el snapshot local del instrumento.")
  }
  list(
    pending_path = pending_path,
    final_path = final_path,
    meta = list(
      file_id = file_id,
      kind = "xlsform",
      original_name = sprintf("instrumento_revision_%s.xlsx", revision_id),
      path = final_path,
      size = length(raw_bytes),
      ext = "xlsx",
      uploaded_at = .xlsform_forms_now()
    )
  )
}

.xlsform_revision_assign <- function(sid, state) {
  .session_env[[sid]] <- state
  invisible(state)
}

xlsform_revision_publish <- function(sid, form_id, expected_content_sha256) {
  expected <- as.character(expected_content_sha256 %||% "")[1]
  if (is.na(expected) || !grepl("^[0-9a-f]{64}$", expected)) {
    stop_api(400, "E_REVISION_EXPECTED_HASH", "expected_content_sha256 debe ser un SHA-256 lowercase de 64 caracteres.")
  }

  s <- session_get(sid, required = FALSE)
  form_id <- as.character(form_id %||% "")[1]
  entry <- if (is.null(s)) NULL else .xlsform_forms_get(s, form_id)
  if (is.null(entry)) {
    stop_api(404, "E_FORM_NOT_FOUND", sprintf("No existe el formulario '%s'.", form_id))
  }

  current_hash <- .xlsform_revision_hash(entry$workbook %||% list())
  if (!identical(current_hash, expected)) {
    stop_api(409, "E_FORM_DRAFT_STALE", "El borrador cambió desde que se calculó el hash esperado.")
  }
  source <- .xlsform_forms_sanitize_source(entry$source %||% list())
  source_hash <- .xlsform_revision_source_hash(source)
  choice_code_maps_hash <- .xlsform_revision_choice_code_maps_hash(entry$workbook %||% list())
  diagnostics <- .xlsform_revision_diagnostics(entry$workbook %||% list())
  blockers <- c(
    .xlsform_revision_logic_blockers(source, current_hash, entry$workbook %||% list()),
    .xlsform_revision_domain_blockers(s, entry$workbook %||% list(), source),
    diagnostics$blockers
  )
  if (length(blockers)) {
    stop_api(
      422,
      "E_XLSFORM_NOT_PUBLISHABLE",
      "El XLSForm contiene diagnósticos o una revisión de lógica bloqueantes.",
      details = list(blockers = blockers, warnings = diagnostics$warnings)
    )
  }

  latest <- .xlsform_revision_latest(s, form_id)
  latest_source_hash <- as.character((latest$logic_audit %||% list())$source_sha256 %||% "")[1]
  if (!is.null(latest) && identical(latest$content_sha256, current_hash) &&
      identical(latest_source_hash, source_hash) &&
      identical(.xlsform_revision_stored_choice_code_maps_hash(latest), choice_code_maps_hash)) {
    meta <- (s$files %||% list())[[as.character(latest$xlsform_file_id %||% "")[1]]]
    if (is.null(meta) || is.null(meta$path) || !file.exists(meta$path)) {
      stop_api(500, "E_INSTRUMENT_REVISION_COMMIT_FAILED", "La última revisión registrada no conserva su snapshot XLSX.")
    }
    return(list(created = FALSE, revision = latest))
  }

  bytes <- .xlsform_revision_materialize(entry$workbook %||% list())
  revision_id <- uuid::UUIDgenerate()
  staged <- .xlsform_revision_stage(s, revision_id, bytes)
  committed <- FALSE
  on.exit({
    if (!committed) {
      unlink(staged$pending_path, force = TRUE)
      unlink(staged$final_path, force = TRUE)
    }
  }, add = TRUE)

  # Releer y volver a comparar justo antes del commit evita publicar un
  # borrador distinto si dos requests se intercalan.
  fresh <- session_get(sid)
  fresh_entry <- .xlsform_forms_get(fresh, form_id)
  fresh_hash <- if (is.null(fresh_entry)) "" else .xlsform_revision_hash(fresh_entry$workbook %||% list())
  if (!identical(fresh_hash, expected)) {
    stop_api(409, "E_FORM_DRAFT_STALE", "El borrador cambió durante la publicación.")
  }
  fresh_source <- .xlsform_forms_sanitize_source(fresh_entry$source %||% list())
  fresh_source_hash <- .xlsform_revision_source_hash(fresh_source)
  fresh_choice_code_maps <- .xlsform_revision_choice_code_maps(fresh_entry$workbook %||% list())
  fresh_choice_code_maps_hash <- .xlsform_revision_choice_code_maps_hash(fresh_entry$workbook %||% list())
  if (!identical(fresh_source_hash, source_hash)) {
    stop_api(409, "E_FORM_DRAFT_STALE", "La procedencia del formulario cambió durante la publicación.")
  }
  fresh_diagnostics <- .xlsform_revision_diagnostics(fresh_entry$workbook %||% list())
  fresh_blockers <- c(
    .xlsform_revision_logic_blockers(
      fresh_source,
      fresh_hash,
      fresh_entry$workbook %||% list()
    ),
    .xlsform_revision_domain_blockers(
      fresh,
      fresh_entry$workbook %||% list(),
      fresh_source
    ),
    fresh_diagnostics$blockers
  )
  if (length(fresh_blockers)) {
    stop_api(
      422,
      "E_XLSFORM_NOT_PUBLISHABLE",
      "El XLSForm contiene diagnósticos o una revisión de lógica bloqueantes.",
      details = list(blockers = fresh_blockers, warnings = fresh_diagnostics$warnings)
    )
  }
  latest <- .xlsform_revision_latest(fresh, form_id)
  latest_source_hash <- as.character((latest$logic_audit %||% list())$source_sha256 %||% "")[1]
  if (!is.null(latest) && identical(latest$content_sha256, fresh_hash) &&
      identical(latest_source_hash, fresh_source_hash) &&
      identical(
        .xlsform_revision_stored_choice_code_maps_hash(latest),
        fresh_choice_code_maps_hash
      )) {
    committed <- TRUE
    unlink(staged$pending_path, force = TRUE)
    return(list(created = FALSE, revision = latest))
  }

  revisions <- .xlsform_revision_for_form(fresh, form_id)
  revision_no <- if (length(revisions)) {
    max(vapply(revisions, function(item) as.integer(item$revision_no), integer(1))) + 1L
  } else 1L
  now <- .xlsform_forms_now()
  revision <- list(
    schema = .XLSFORM_REVISION_SCHEMA,
    revision_id = revision_id,
    form_id = form_id,
    revision_no = as.integer(revision_no),
    content_sha256 = fresh_hash,
    choice_code_maps = fresh_choice_code_maps,
    choice_code_maps_sha256 = fresh_choice_code_maps_hash,
    xlsform_file_id = staged$meta$file_id,
    source = fresh_source,
    logic_audit = .xlsform_revision_logic_audit(
      fresh_source,
      content_sha256 = fresh_hash,
      source_sha256 = fresh_source_hash,
      choice_code_maps_sha256 = fresh_choice_code_maps_hash,
      warnings = fresh_diagnostics$warnings,
      validated_at = now
    ),
    published_at = now
  )

  next_state <- fresh
  next_state$files <- next_state$files %||% list()
  next_state$files[[staged$meta$file_id]] <- staged$meta
  next_state$instrument_revisions <- next_state$instrument_revisions %||% list()
  next_state$instrument_revisions[[revision_id]] <- revision
  next_state <- .mark_project_dirty(next_state)

  if (!isTRUE(file.rename(staged$pending_path, staged$final_path))) {
    stop_api(500, "E_INSTRUMENT_REVISION_COMMIT_FAILED", "No se pudo confirmar el snapshot XLSX de la revisión.")
  }
  assigned <- tryCatch({
    .xlsform_revision_assign(sid, next_state)
    TRUE
  }, error = function(e) FALSE)
  if (!assigned) {
    stop_api(500, "E_INSTRUMENT_REVISION_COMMIT_FAILED", "No se pudo registrar la revisión en el proyecto.")
  }
  committed <- TRUE
  list(created = TRUE, revision = revision)
}
