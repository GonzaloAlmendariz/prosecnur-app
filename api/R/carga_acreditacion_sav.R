# =============================================================================
# Carga — escotilla "bases de acreditación desde SAV"
# =============================================================================
#
# Materializa las bases de un estudio de acreditación desde archivos .sav que el
# usuario ya limpió en SPSS, relacionándolos a los XLSForms publicados del intake
# (`processing_intake/v1`), SIN pasar por Monitoreo. Reusa el core compartido
# `.acreditacion_prepare_from_data` (ver carga_acreditacion_batch.R): la única
# diferencia con el batch es que `data_df` se lee del SAV en vez del snapshot de
# Monitoreo. Emite su propia superficie de códigos `E_ACREDITACION_SAV_*`.

.ACREDITACION_SAV_SCHEMA <- "accreditation_processing_sav/v1"
.ACREDITACION_SAV_SOURCE_KIND <- "sav_manual_acreditacion"
.ACREDITACION_SAV_BASE_SOURCE <- "sav_manual"

# Superficie de códigos que este puente le presta al core compartido (el juego
# gemelo del batch vive en carga_acreditacion_batch.R). Literales a propósito:
# ver la nota junto a `.ACB_CODES_BATCH` sobre el censo de errors_registry.R.
.ACB_CODES_SAV <- list(
  instrument           = "E_ACREDITACION_SAV_INSTRUMENT",
  data                 = "E_ACREDITACION_SAV_DATA",
  choice_map_hash      = "E_ACREDITACION_SAV_CHOICE_MAP_HASH",
  unsealed_choice_map  = "E_ACREDITACION_SAV_UNSEALED_CHOICE_MAP",
  unknown_choice_codes = "E_ACREDITACION_SAV_UNKNOWN_CHOICE_CODES"
)

.acsav_error <- function(status, code, message, details = NULL) {
  stop_api(status, code, message, details = details)
}

# Intake aprobado y validado. Devuelve las entradas decoradas indexadas por base
# y por actor_key para resolver los targets que trae cada archivo SAV.
.acsav_intake_context <- function(s) {
  intake <- .processing_intake_current(s)
  if (!identical(intake$schema, "processing_intake/v1") ||
      intake$revision < 1L || is.null(intake$family_id) || !nzchar(intake$family_id) ||
      !length(intake$entries)) {
    .acsav_error(409, "E_ACREDITACION_SAV_INTAKE",
                 "Primero guarda un processing_intake/v1 aprobado para los públicos del estudio.")
  }
  validation <- .processing_intake_validate_state(s, intake$entries, family_id = intake$family_id)
  if (!isTRUE(validation$valid)) {
    .acsav_error(422, "E_ACREDITACION_SAV_INTAKE_INVALID",
                 "El processing_intake contiene entradas bloqueadas.",
                 details = list(blockers = validation$blockers))
  }
  by_base <- list()
  by_actor <- list()
  for (entry in validation$entries) {
    base_key <- .acb_scalar(entry$base)
    actor_key <- .acb_scalar(entry$actor_key)
    if (nzchar(base_key)) by_base[[base_key]] <- entry
    if (nzchar(actor_key)) by_actor[[actor_key]] <- entry
  }
  list(intake = intake, entries = validation$entries, by_base = by_base, by_actor = by_actor)
}

# Normaliza el payload `files` a una lista de targets únicos, resolviendo cada
# uno a su entrada de intake y a su archivo físico en el file store.
.acsav_resolve_files <- function(s, files, intake_context) {
  if (is.null(files) || !is.list(files) || !length(files)) {
    .acsav_error(400, "E_ACREDITACION_SAV_FILES",
                 "Envía al menos un archivo SAV con su público destino.")
  }
  seen <- character(0)
  resolved <- lapply(seq_along(files), function(i) {
    item <- files[[i]]
    if (!is.list(item)) {
      .acsav_error(400, "E_ACREDITACION_SAV_FILES",
                   "Cada elemento de files debe ser un objeto { base|actor_key, file_id }.")
    }
    base_ref <- .acb_scalar(item$base)
    actor_ref <- .acb_scalar(item$actor_key)
    file_id <- .acb_scalar(item$file_id)
    if (!nzchar(file_id)) {
      .acsav_error(400, "E_ACREDITACION_SAV_FILES", "Cada archivo requiere un file_id.")
    }
    entry <- if (nzchar(base_ref)) {
      intake_context$by_base[[base_ref]] %||% NULL
    } else if (nzchar(actor_ref)) {
      intake_context$by_actor[[actor_ref]] %||% NULL
    } else {
      .acsav_error(400, "E_ACREDITACION_SAV_FILES",
                   "Cada archivo requiere `base` o `actor_key` para su público destino.")
    }
    if (is.null(entry)) {
      .acsav_error(422, "E_ACREDITACION_SAV_TARGET_UNKNOWN",
                   sprintf("El público destino '%s' no existe en el processing_intake aprobado.",
                           if (nzchar(base_ref)) base_ref else actor_ref))
    }
    status <- .acb_scalar(entry$status)
    if (identical(status, "stale") || !(status %in% c("instrument_ready", "materialized"))) {
      .acsav_error(409, "E_ACREDITACION_SAV_INTAKE_STALE",
                   sprintf("La entrada del público '%s' referencia una revisión no vigente.",
                           .acb_scalar(entry$base)))
    }
    base_key <- .acb_scalar(entry$base)
    if (base_key %in% seen) {
      .acsav_error(422, "E_ACREDITACION_SAV_TARGET_DUPLICATED",
                   sprintf("El público '%s' aparece en más de un archivo SAV.", base_key))
    }
    seen <<- c(seen, base_key)
    meta <- (s$files %||% list())[[file_id]] %||% NULL
    if (is.null(meta)) {
      .acsav_error(404, "E_ACREDITACION_SAV_FILE_NOT_FOUND",
                   sprintf("El archivo '%s' no existe en el proyecto.", file_id))
    }
    ext <- tolower(.acb_scalar(meta$ext))
    if (!identical(ext, "sav") && !(.acb_scalar(meta$kind) %in% c("sav", "data") && identical(ext, "sav"))) {
      .acsav_error(422, "E_ACREDITACION_SAV_FILE_KIND",
                   sprintf("El archivo '%s' no es un .sav.", file_id))
    }
    path <- .acb_scalar(meta$path)
    if (!nzchar(path) || !file.exists(path)) {
      .acsav_error(404, "E_ACREDITACION_SAV_FILE_NOT_FOUND",
                   sprintf("El .sav del público '%s' no está disponible en disco.", base_key))
    }
    list(entry = entry, file_meta = meta, file_id = file_id, path = path,
         file_sha256 = tolower(digest::digest(file = path, algo = "sha256")))
  })
  # Orden estable por base para que el fingerprint no dependa del orden de subida.
  bases <- vapply(resolved, function(r) .acb_scalar(r$entry$base), character(1))
  resolved[order(bases)]
}

.acsav_read_sav <- function(path, base_key) {
  data <- tryCatch(
    .read_data_any_path(path, "sav"),
    # Un api_error del lector (p.ej. E_NO_HAVEN) se re-señala tal cual; sólo los
    # errores crudos de lectura se traducen a la superficie de la escotilla.
    api_error = function(e) stop(e),
    error = function(e) {
      .acsav_error(422, "E_ACREDITACION_SAV_FILE_UNREADABLE",
                   sprintf("No se pudo leer el .sav del público '%s' como tabla.", base_key))
    }
  )
  if (!is.data.frame(data)) {
    .acsav_error(422, "E_ACREDITACION_SAV_FILE_UNREADABLE",
                 sprintf("El .sav del público '%s' no produjo una tabla.", base_key))
  }
  as.data.frame(data, stringsAsFactors = FALSE, check.names = FALSE)
}

# Prepara cada target recorriendo el pipeline compartido y agrega la trazabilidad
# propia del SAV (n_excluded=0 porque no hay exclusión de casos como en el batch).
.acsav_prepare <- function(s, resolved) {
  lapply(resolved, function(r) {
    data_df <- .acsav_read_sav(r$path, .acb_scalar(r$entry$base))
    prepared <- .acreditacion_prepare_from_data(
      s, r$entry, data_df,
      monitoreo_sources = list(),
      codes = .ACB_CODES_SAV
    )
    c(prepared, list(
      sav_file_id = r$file_id,
      sav_file_meta = r$file_meta,
      sav_file_sha256 = r$file_sha256,
      n_excluded = 0L,
      trace_checksum = .acb_hash(list(
        sav_file_id = r$file_id,
        sav_file_sha256 = r$file_sha256,
        data = prepared$data_checksum
      ))
    ))
  })
}

.acsav_preview_fingerprint <- function(intake, prepared) {
  entry_facts <- lapply(prepared, function(item) list(
    entry_id = .acb_scalar(item$intake$entry_id),
    base = .acb_scalar(item$intake$base),
    actor_key = .acb_scalar(item$intake$actor_key),
    instrument_revision_id = .acb_scalar(item$revision$revision_id),
    instrument_sha256 = .acb_scalar(item$revision$content_sha256),
    rows = item$n_filas,
    data_checksum = item$data_checksum,
    normalization_fingerprint = item$normalization_fingerprint,
    source_mapping_fingerprint = item$source_mapping_fingerprint,
    sav_file_sha256 = item$sav_file_sha256
  ))
  .acb_hash(list(
    schema = .ACREDITACION_SAV_SCHEMA,
    intake_revision = intake$revision,
    family_id = intake$family_id,
    entries = entry_facts
  ))
}

.acsav_prepare_state <- function(s, files) {
  intake_context <- .acsav_intake_context(s)
  resolved <- .acsav_resolve_files(s, files, intake_context)
  prepared <- .acsav_prepare(s, resolved)
  list(
    context = list(s = s),
    intake = intake_context$intake,
    resolved = resolved,
    prepared = prepared,
    preview_fingerprint = .acsav_preview_fingerprint(intake_context$intake, prepared)
  )
}

# Shape público por público. Superset del shape del batch (`.acb_public_preview`)
# más los campos explícitos del contrato de la escotilla (rows, cols, blocked,
# reasons) para que el frontend renderice la normalización idéntica.
.acsav_public_preview <- function(prep) {
  s <- prep$context$s %||% list()
  bases <- ((s$estudio %||% list())$bases %||% list())
  entries <- lapply(prep$prepared, function(item) {
    base <- .acb_scalar(item$intake$base)
    existing <- bases[[base]] %||% NULL
    same_identity <- !is.null(existing) &&
      identical(.acb_scalar(existing$processing_intake_entry_id), .acb_scalar(item$intake$entry_id)) &&
      identical(.acb_scalar(existing$sibling_family_id), prep$intake$family_id) &&
      identical(.acb_scalar(existing$instrument_revision_id), .acb_scalar(item$revision$revision_id))
    materialized <- isTRUE(same_identity) &&
      identical(.acb_scalar(existing$preview_fingerprint), prep$preview_fingerprint)
    identity_blocked <- !is.null(existing) && !isTRUE(same_identity)
    compatibility_blocked <- !isTRUE(item$compatibility$ok)
    blocked <- identity_blocked || compatibility_blocked
    reasons <- list()
    if (identity_blocked) {
      reasons <- append(reasons, list(list(
        code = "base_target_conflict",
        message = "La base destino existe con otra entrada, familia o revisión de instrumento."
      )))
    }
    if (compatibility_blocked) {
      reasons <- append(reasons, list(list(
        code = "instrument_data_incompatible",
        message = "La data del SAV no es compatible con el XLSForm publicado.",
        actor_key = .acb_scalar(item$intake$actor_key),
        missing_columns = as.list(item$compatibility$missing_columns %||% character(0))
      )))
    }
    extras <- if (is.data.frame(item$extras) && nrow(item$extras)) {
      unname(lapply(seq_len(nrow(item$extras)), function(i) list(
        name = as.character(item$extras$name[[i]]),
        fill_pct = as.numeric(item$extras$fill_pct[[i]]),
        n_fill = as.integer(item$extras$n_fill[[i]]),
        kind = as.character(item$extras$kind[[i]])
      )))
    } else list()
    compatibility <- item$compatibility
    list(
      entry_id = .acb_scalar(item$intake$entry_id),
      base = base,
      base_label = .acb_scalar(item$intake$base_label),
      actor = .acb_scalar(item$intake$actor),
      actor_key = .acb_scalar(item$intake$actor_key),
      instrument_revision_id = .acb_scalar(item$revision$revision_id),
      instrument_sha256 = .acb_scalar(item$revision$content_sha256),
      sav_file_id = item$sav_file_id,
      sav_original_name = .acb_scalar(item$sav_file_meta$original_name),
      rows = item$n_filas,
      cols = item$n_columnas,
      selected = item$n_filas,
      excluded = 0L,
      blocked = isTRUE(blocked),
      status = if (blocked) "blocked" else if (materialized) "already_materialized" else if (!is.null(existing)) "replacement_required" else "ready",
      compatibility = list(
        ok = isTRUE(compatibility$ok),
        message = .acb_scalar(compatibility$message),
        missing_columns = as.list(compatibility$missing_columns %||% character(0)),
        extra_columns = as.list(compatibility$extra_columns %||% character(0))
      ),
      extras = extras,
      extras_checksum = item$extras_checksum,
      reasons = reasons,
      blocking_reasons = reasons,
      data_checksum = item$data_checksum,
      normalization = item$normalization
    )
  })
  blockers <- unname(unlist(lapply(entries, `[[`, "blocking_reasons"), recursive = FALSE))
  already_materialized <- length(entries) > 0L &&
    all(vapply(entries, function(entry) identical(entry$status, "already_materialized"), logical(1)))
  replacement_required <- any(vapply(entries, function(entry) identical(entry$status, "replacement_required"), logical(1)))
  list(
    ok = TRUE,
    schema = .ACREDITACION_SAV_SCHEMA,
    detected = TRUE,
    ready = !length(blockers),
    replacement_required = replacement_required,
    already_materialized = already_materialized,
    blockers = blockers,
    pins = list(
      intake_revision = as.integer(prep$intake$revision),
      family_id = prep$intake$family_id,
      preview_fingerprint = prep$preview_fingerprint
    ),
    preview_fingerprint = prep$preview_fingerprint,
    entries = entries,
    totals = list(
      selected = as.integer(sum(vapply(entries, function(entry) entry$selected, integer(1)))),
      bases = length(entries)
    )
  )
}

acreditacion_sav_preview <- function(sid, files) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) .acsav_error(404, "E_NO_SESSION", "Sin sesión.")
  prep <- .acsav_prepare_state(s, files)
  prep$context$s <- s
  .acsav_public_preview(prep)
}

.acsav_assert_compatible <- function(prep) {
  incompatible <- Filter(function(item) !isTRUE(item$compatibility$ok), prep$prepared)
  if (length(incompatible)) {
    details <- unname(lapply(incompatible, function(item) list(
      base = .acb_scalar(item$intake$base),
      actor_key = .acb_scalar(item$intake$actor_key),
      missing_columns = as.list(item$compatibility$missing_columns %||% character(0)),
      extra_columns = as.list(item$compatibility$extra_columns %||% character(0))
    )))
    .acsav_error(422, "E_ACREDITACION_SAV_INCOMPATIBLE",
                 "Una o más bases SAV no son compatibles con su XLSForm publicado.",
                 details = list(entries = details))
  }
  invisible(TRUE)
}

.acsav_assert_fingerprint <- function(prep, supplied) {
  received <- .acb_scalar(supplied)
  if (!nzchar(received) || !identical(received, prep$preview_fingerprint)) {
    .acsav_error(409, "E_ACREDITACION_SAV_STALE",
                 "El preview o los archivos SAV cambiaron; vuelve a previsualizar.")
  }
  invisible(TRUE)
}

.acsav_base_matches <- function(base, item, family_id, fingerprint) {
  !is.null(base) &&
    identical(.acb_scalar(base$processing_intake_entry_id), .acb_scalar(item$intake$entry_id)) &&
    identical(.acb_scalar(base$sibling_family_id), family_id) &&
    identical(.acb_scalar(base$instrument_revision_id), .acb_scalar(item$revision$revision_id)) &&
    identical(.acb_scalar(base$preview_fingerprint), fingerprint)
}

# A diferencia del batch, la escotilla materializa el SUBSET de bases enviadas y
# no reclama por bases ajenas del estudio: sólo verifica que los targets no estén
# en un estado parcial inconsistente respecto al fingerprint vigente.
.acsav_existing_state <- function(s, prep) {
  bases <- ((s$estudio %||% list())$bases %||% list())
  target_names <- vapply(prep$prepared, function(item) .acb_scalar(item$intake$base), character(1))
  present <- target_names[target_names %in% names(bases)]
  matching <- vapply(prep$prepared, function(item) {
    name <- .acb_scalar(item$intake$base)
    .acsav_base_matches(bases[[name]], item, prep$intake$family_id, prep$preview_fingerprint)
  }, logical(1))
  if (any(matching) && !all(matching)) {
    .acsav_error(409, "E_ACREDITACION_SAV_PARTIAL_STATE",
                 "Se detectó una materialización parcial inconsistente; no se modificó el proyecto.")
  }
  # Una base destino que existe con identidad ajena (otra revisión/entrada) se
  # reporta como conflicto para no sobreescribir trabajo de otro origen.
  conflicting <- vapply(prep$prepared, function(item) {
    name <- .acb_scalar(item$intake$base)
    base <- bases[[name]] %||% NULL
    !is.null(base) &&
      !identical(.acb_scalar(base$processing_intake_entry_id), .acb_scalar(item$intake$entry_id))
  }, logical(1))
  if (any(conflicting)) {
    .acsav_error(409, "E_ACREDITACION_SAV_BASE_CONFLICT",
                 "Una base destino pertenece a otra entrada del intake; no se sobreescribirá implícitamente.")
  }
  list(bases = bases, targets = target_names, present = present, all_matching = length(target_names) > 0L && all(matching))
}

.acsav_state_with_materialization <- function(s, prep, file_items, now) {
  next_state <- s
  if (is.null(next_state$estudio)) {
    next_state$estudio <- list(nombre = NULL, bases = list(), processing_mode = "multibase", active_base = NULL)
  }
  next_state$estudio$bases <- next_state$estudio$bases %||% list()
  next_state$rp_data_sources <- next_state$rp_data_sources %||% list()
  next_state$rp_inst_sources <- next_state$rp_inst_sources %||% list()
  next_state$files <- next_state$files %||% list()

  for (i in seq_along(prep$prepared)) {
    item <- prep$prepared[[i]]
    registered <- file_items[[i]]
    entry <- item$intake
    base_name <- .acb_scalar(entry$base)
    previous <- next_state$estudio$bases[[base_name]] %||% NULL
    if (!is.null(previous)) next_state <- .invalidate_processing_state(next_state, base_name)
    metadata <- list(
      nombre = base_name,
      xlsform_file_id = .acb_scalar(item$instrument_file$file_id),
      data_file_id = registered$meta$file_id,
      data_ext = "xlsx",
      n_filas = item$n_filas,
      n_columnas = item$n_columnas,
      added_at = .acb_scalar((previous %||% list())$added_at, now),
      processing_mode = "independent_siblings",
      base_source = .ACREDITACION_SAV_BASE_SOURCE,
      processing_intake_entry_id = .acb_scalar(entry$entry_id),
      sibling_family_id = prep$intake$family_id,
      instrument_revision_id = .acb_scalar(item$revision$revision_id),
      instrument_revision_hash = .acb_scalar(item$revision$content_sha256),
      source_kind = .ACREDITACION_SAV_SOURCE_KIND,
      source_alias = .acb_scalar(entry$actor),
      source_title = .acb_scalar(entry$base_label, .acb_scalar(entry$actor)),
      preview_fingerprint = prep$preview_fingerprint,
      response_filter = list(
        source = "sav_manual",
        selected_rows = item$n_filas
      ),
      traceability = list(
        sav_file_id = item$sav_file_id,
        sav_file_sha256 = item$sav_file_sha256,
        sav_original_name = .acb_scalar(item$sav_file_meta$original_name),
        selection_sha256 = item$trace_checksum,
        source_mapping_sha256 = item$source_mapping_fingerprint,
        source_mapping = item$source_mapping_audit,
        normalization_sha256 = item$normalization_fingerprint
      ),
      normalization = item$normalization,
      variables_extra_incluidas = list(),
      variables_extra_checksum = item$extras_checksum,
      checksum = list(
        algorithm = "sha256",
        semantic = item$data_checksum,
        file = registered$file_sha256
      ),
      imported_at = now
    )
    next_state$estudio$bases[[base_name]] <- metadata
    next_state$rp_data_sources[[base_name]] <- item$rp_data
    next_state$rp_inst_sources[[base_name]] <- item$rp_inst
    next_state$files[[registered$meta$file_id]] <- registered$meta
  }

  target_names <- vapply(prep$prepared, function(item) .acb_scalar(item$intake$base), character(1))
  active_before <- .acb_scalar((s$estudio %||% list())$active_base)
  active <- if (active_before %in% names(next_state$estudio$bases)) active_before else names(next_state$estudio$bases)[[1]]
  first <- names(next_state$estudio$bases)[[1]]
  next_state$rp_data <- next_state$rp_data_sources[[first]]
  next_state$rp_inst <- next_state$rp_inst_sources[[first]]
  next_state$estudio$processing_mode <- "independent_siblings"
  next_state$estudio$active_base <- active
  next_state$estudio$sibling_family_id <- prep$intake$family_id
  next_state$estudio$independent_siblings <- list(
    version = 1L,
    sibling_family_id = prep$intake$family_id,
    template_base = NULL,
    logic_policy = "per_actor_instrument",
    shared_logic = FALSE,
    status = "accreditation_sav_materialized",
    updated_at = now
  )
  next_state$codif_source_active <- active
  next_state <- .mark_project_dirty(next_state)
  next_state
}

.acsav_promote_result <- function(sid, prep, already_materialized) {
  base_names <- vapply(prep$prepared, function(item) .acb_scalar(item$intake$base), character(1))
  counts <- stats::setNames(
    as.list(vapply(prep$prepared, function(item) item$n_filas, integer(1))),
    base_names
  )
  list(
    ok = TRUE,
    promoted = !isTRUE(already_materialized),
    already_materialized = isTRUE(already_materialized),
    batch_id = prep$preview_fingerprint,
    preview_fingerprint = prep$preview_fingerprint,
    base_names = as.list(base_names),
    counts = counts,
    estudio = .estudio_payload(sid)
  )
}

acreditacion_sav_promote <- function(sid, files, preview_fingerprint,
                                     confirm_replacement = FALSE) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) .acsav_error(404, "E_NO_SESSION", "Sin sesión.")
  prep <- .acsav_prepare_state(s, files)
  .acsav_assert_compatible(prep)
  .acsav_assert_fingerprint(prep, preview_fingerprint)
  existing <- .acsav_existing_state(s, prep)
  if (isTRUE(existing$all_matching)) {
    prep$context$s <- s
    return(.acsav_promote_result(sid, prep, already_materialized = TRUE))
  }
  if (length(existing$present) && !.acb_bool(confirm_replacement)) {
    .acsav_error(409, "E_ACREDITACION_SAV_CONFIRM_REPLACEMENT",
                 "Confirma explícitamente el reemplazo de las bases ya materializadas.")
  }

  stage_dir <- tempfile("acreditacion_sav_", tmpdir = file.path(s$dir, "downloads"))
  dir.create(stage_dir, recursive = TRUE, showWarnings = FALSE)
  final_paths <- character(0)
  committed <- FALSE
  on.exit({
    unlink(stage_dir, recursive = TRUE, force = TRUE)
    if (!isTRUE(committed) && length(final_paths)) unlink(final_paths, force = TRUE)
  }, add = TRUE)

  staged <- lapply(seq_along(prep$prepared), function(i) {
    item <- prep$prepared[[i]]
    path <- file.path(stage_dir, sprintf("%02d-%s.xlsx", i, .acb_scalar(item$intake$base)))
    openxlsx::write.xlsx(list(datos = item$data), path, overwrite = TRUE)
    list(path = path, file_sha256 = tolower(digest::digest(file = path, algo = "sha256")))
  })

  # Releer y re-preparar desde disco justo antes de asignar mantiene la guarda
  # atómica: el SAV es estable en disco, así que un fingerprint distinto delata
  # un cambio de intake/instrumento entre el preview y el commit.
  fresh <- session_get(sid)
  fresh_prep <- .acsav_prepare_state(fresh, files)
  .acsav_assert_compatible(fresh_prep)
  .acsav_assert_fingerprint(fresh_prep, preview_fingerprint)
  if (!identical(
    vapply(prep$prepared, `[[`, character(1), "data_checksum"),
    vapply(fresh_prep$prepared, `[[`, character(1), "data_checksum")
  )) {
    .acsav_error(409, "E_ACREDITACION_SAV_STALE",
                 "La data normalizada del SAV cambió durante la preparación.")
  }
  .acsav_existing_state(fresh, fresh_prep)

  uploads_dir <- file.path(fresh$dir, "uploads")
  dir.create(uploads_dir, recursive = TRUE, showWarnings = FALSE)
  now <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  file_items <- lapply(seq_along(staged), function(i) {
    file_id <- uuid::UUIDgenerate()
    final_path <- file.path(uploads_dir, paste0(file_id, ".xlsx"))
    if (!file.rename(staged[[i]]$path, final_path)) {
      .acsav_error(500, "E_ACREDITACION_SAV_FILE_COMMIT",
                   "No se pudo publicar uno de los archivos preparados.")
    }
    final_paths <<- c(final_paths, final_path)
    base_name <- .acb_scalar(fresh_prep$prepared[[i]]$intake$base)
    list(
      file_sha256 = staged[[i]]$file_sha256,
      meta = list(
        file_id = file_id,
        kind = "data",
        original_name = paste0(base_name, "_sav_acreditacion.xlsx"),
        path = final_path,
        size = as.numeric(file.info(final_path)$size),
        ext = "xlsx",
        uploaded_at = now
      )
    )
  })

  next_state <- .acsav_state_with_materialization(fresh, fresh_prep, file_items, now)
  .session_env[[sid]] <- next_state
  committed <- TRUE
  fresh_prep$context$s <- next_state
  .acsav_promote_result(sid, fresh_prep, already_materialized = FALSE)
}
