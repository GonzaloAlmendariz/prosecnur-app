# =============================================================================
# Carga — materialización atómica del intake de acreditación desde Monitoreo
# =============================================================================

.ACREDITACION_BATCH_SCHEMA <- "accreditation_processing_batch/v1"
.ACREDITACION_BATCH_SOURCE_KIND <- "monitoreo_acreditacion_batch"

.acb_scalar <- function(value, default = "") {
  if (is.null(value) || !length(value)) return(default)
  out <- as.character(value[[1]])
  if (is.na(out)) default else trimws(out)
}

.acb_bool <- function(value) {
  if (is.logical(value) && length(value)) return(isTRUE(value[[1]]))
  tolower(.acb_scalar(value)) %in% c("true", "1", "yes", "si", "sí")
}

.acb_hash <- function(value) {
  tolower(digest::digest(value, algo = "sha256", serialize = TRUE))
}

.acb_records <- function(value) {
  if (is.null(value)) return(list())
  if (is.data.frame(value)) {
    return(unname(lapply(seq_len(nrow(value)), function(i) as.list(value[i, , drop = FALSE]))))
  }
  if (!is.list(value)) return(list())
  fields <- c("actor", "response_id", "response_row", "counts_in_advance",
              "platform_state", "advancement", "case_key")
  if (length(intersect(names(value) %||% character(0), fields))) return(list(value))
  unname(Filter(is.list, value))
}

.acb_error <- function(status, code, message, details = NULL) {
  stop_api(status, code, message, details = details)
}

# El core de preparación es compartido por dos puentes distintos hacia una base
# de acreditación: el batch desde Monitoreo y la escotilla SAV manual. Ambos
# recorren el MISMO pipeline de normalización, pero deben emitir códigos `E_*`
# propios de su superficie. Cada puente declara su juego completo y lo pasa como
# `codes`, de modo que la taxonomía no se acopla entre puentes.
#
# Los códigos van LITERALES a propósito: construirlos (sprintf con el prefijo del
# llamador) los volvía invisibles para el censo de api/R/errors_registry.R, que
# escanea literales en el AST. Con el prefijo dinámico los cuatro códigos de esta
# superficie quedaron registrados como huérfanos mientras seguían llegando al
# cliente, y sus gemelos SAV nunca entraron al vocabulario.
.ACB_CODES_BATCH <- list(
  instrument           = "E_ACREDITACION_BATCH_INSTRUMENT",
  data                 = "E_ACREDITACION_BATCH_DATA",
  choice_map_hash      = "E_ACREDITACION_BATCH_CHOICE_MAP_HASH",
  unsealed_choice_map  = "E_ACREDITACION_BATCH_UNSEALED_CHOICE_MAP",
  unknown_choice_codes = "E_ACREDITACION_BATCH_UNKNOWN_CHOICE_CODES"
)

.acb_empty_preview <- function() {
  list(
    ok = TRUE,
    schema = .ACREDITACION_BATCH_SCHEMA,
    detected = FALSE,
    ready = FALSE,
    replacement_required = FALSE,
    already_materialized = FALSE,
    blockers = list(),
    entries = list(),
    totals = list(selected = 0L, excluded = 0L, total_rollup = 0L),
    pins = list(
      intake_revision = NULL,
      family_id = NULL,
      cache_token = NULL,
      preview_fingerprint = NULL
    )
  )
}

.acb_cache_context <- function(s) {
  snapshot <- s$monitoreo_snapshot %||% NULL
  if (!is.list(snapshot) || !is.data.frame(snapshot$data) || !nrow(snapshot$data)) {
    .acb_error(409, "E_ACREDITACION_BATCH_NO_SNAPSHOT",
               "No hay un snapshot local de Monitoreo listo para materializar.")
  }
  sources <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
  data <- .monitoreo_apply_source_metadata_to_data(snapshot$data, sources)
  cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
  if (!identical(.acb_scalar((cfg$monitoreo_profile %||% list())$family), "acreditacion")) {
    .acb_error(409, "E_ACREDITACION_BATCH_FAMILY",
               "El batch sólo está disponible para un Monitoreo de acreditación.")
  }

  cache <- s$monitoreo_dashboard_cache_queries_summary %||% NULL
  saved_token <- .acb_scalar(s$monitoreo_dashboard_cache_token_queries_summary)
  expected_token <- .monitoreo_dashboard_cache_token(
    snapshot, data, cfg, report_scope = "queries_summary"
  )
  if (!is.list(cache) || !nzchar(saved_token) || !identical(saved_token, expected_token)) {
    .acb_error(
      409, "E_ACREDITACION_BATCH_CACHE_STALE",
      "La selección oficial de casos no corresponde al corte local vigente de Monitoreo."
    )
  }
  internal <- ((cache$acreditacion_reports %||% list())$internal_queries %||% NULL)
  if (!is.list(internal) ||
      !identical(.acb_scalar(internal$schema), "monitoreo_acreditacion_internal_queries_v1")) {
    .acb_error(409, "E_ACREDITACION_BATCH_CASE_ROLLUP",
               "El cache persistido no contiene un case_rollup oficial compatible.")
  }
  records <- .acb_records(internal$case_rollup %||% list())
  if (!length(records)) {
    .acb_error(409, "E_ACREDITACION_BATCH_EMPTY",
               "El case_rollup persistido no contiene casos efectivos materializables.")
  }
  list(
    snapshot = snapshot,
    data = data,
    cfg = cfg,
    cache_token = saved_token,
    cache_fingerprint = .acb_hash(saved_token),
    records = records
  )
}

.acb_selected_cases <- function(context) {
  rows <- lapply(context$records, function(record) {
    list(
      actor = .acb_scalar(record$actor),
      actor_key = .estudio_suggestion_slug(.acb_scalar(record$actor), "sin_actor"),
      response_id = .acb_scalar(record$response_id),
      response_row = suppressWarnings(as.numeric(record$response_row %||% NA_real_)[1]),
      case_key = .acb_scalar(record$case_key),
      counts_in_advance = .acb_bool(record$counts_in_advance),
      platform_state = .acb_scalar(record$platform_state),
      advancement = .acb_scalar(record$advancement)
    )
  })
  selected_mask <- vapply(rows, function(row) {
    isTRUE(row$counts_in_advance) &&
      identical(tolower(row$platform_state), "completa") &&
      identical(row$advancement, "effective")
  }, logical(1))
  selected <- rows[selected_mask]
  if (!length(selected)) {
    .acb_error(409, "E_ACREDITACION_BATCH_EMPTY",
               "No hay casos efectivos reconciliados que cuenten en el avance.")
  }

  response_rows <- vapply(selected, `[[`, numeric(1), "response_row")
  response_ids <- vapply(selected, `[[`, character(1), "response_id")
  actor_keys <- vapply(selected, `[[`, character(1), "actor_key")
  case_keys <- vapply(selected, `[[`, character(1), "case_key")
  actor_case_keys <- paste(actor_keys, case_keys, sep = "\r")
  n_snapshot <- nrow(context$data)
  valid_rows <- is.finite(response_rows) & response_rows == floor(response_rows) &
    response_rows >= 1 & response_rows <= n_snapshot
  if (!all(valid_rows) || anyDuplicated(as.integer(response_rows)) ||
      any(!nzchar(response_ids)) || anyDuplicated(response_ids) ||
      any(actor_keys == "sin_actor") || any(!nzchar(case_keys)) ||
      anyDuplicated(actor_case_keys)) {
    .acb_error(409, "E_ACREDITACION_BATCH_TRACE",
               "El case_rollup no conserva una traza única y válida hacia el snapshot.")
  }

  idx <- as.integer(response_rows)
  snapshot_rows <- context$data[idx, , drop = FALSE]
  actual_ids <- .monitoreo_report_response_ids(snapshot_rows)
  actual_actors <- .monitoreo_report_trace_actor_values(
    snapshot_rows, context$cfg$monitoreo_profile %||% list()
  )
  actual_actor_keys <- vapply(actual_actors, .estudio_suggestion_slug, character(1), fallback = "sin_actor")
  role_ok <- .monitoreo_report_role_mask(snapshot_rows, "respuestas")
  ids_match <- length(actual_ids) == length(response_ids) &&
    all(unname(actual_ids) == unname(response_ids))
  actors_match <- length(actual_actor_keys) == length(actor_keys) &&
    all(unname(actual_actor_keys) == unname(actor_keys))
  if (!isTRUE(ids_match) || !isTRUE(actors_match) || !all(role_ok)) {
    .acb_error(409, "E_ACREDITACION_BATCH_TRACE_MISMATCH",
               "La fila fijada por case_rollup ya no coincide con response_id, actor y rol del snapshot.")
  }

  selected_df <- data.frame(
    actor = vapply(selected, `[[`, character(1), "actor"),
    actor_key = actor_keys,
    response_id = response_ids,
    response_row = idx,
    case_key = vapply(selected, `[[`, character(1), "case_key"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  rollup_df <- data.frame(
    actor = vapply(rows, `[[`, character(1), "actor"),
    actor_key = vapply(rows, `[[`, character(1), "actor_key"),
    selected = selected_mask,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  list(
    selected = selected_df,
    rollup = rollup_df,
    total_rollup = as.integer(length(rows)),
    excluded = as.integer(sum(!selected_mask))
  )
}

.acb_intake_context <- function(s, actor_keys) {
  intake <- .processing_intake_current(s)
  if (!identical(intake$schema, "processing_intake/v1") ||
      intake$revision < 1L || is.null(intake$family_id) || !nzchar(intake$family_id) ||
      !length(intake$entries)) {
    .acb_error(409, "E_ACREDITACION_BATCH_INTAKE",
               "Primero guarda un processing_intake/v1 aprobado para los actores del corte.")
  }
  validation <- .processing_intake_validate_state(s, intake$entries, family_id = intake$family_id)
  if (!isTRUE(validation$valid)) {
    .acb_error(422, "E_ACREDITACION_BATCH_INTAKE_INVALID",
               "El processing_intake contiene entradas bloqueadas.",
               details = list(blockers = validation$blockers))
  }
  statuses <- vapply(validation$entries, function(entry) .acb_scalar(entry$status), character(1))
  if (any(statuses == "stale") || any(!statuses %in% c("instrument_ready", "materialized"))) {
    .acb_error(409, "E_ACREDITACION_BATCH_INTAKE_STALE",
               "El processing_intake cambió o referencia una revisión de instrumento no vigente.")
  }
  intake_keys <- vapply(validation$entries, function(entry) .acb_scalar(entry$actor_key), character(1))
  if (!setequal(unique(actor_keys), intake_keys) || anyDuplicated(intake_keys)) {
    .acb_error(422, "E_ACREDITACION_BATCH_ACTORS",
               "Los actores del intake no coinciden exactamente con los actores efectivos del case_rollup.")
  }
  ord <- match(sort(unique(actor_keys)), intake_keys)
  list(intake = intake, entries = validation$entries[ord])
}

.acb_revision_choice_maps <- function(revision, codes = .ACB_CODES_BATCH) {
  maps <- revision$choice_code_maps %||% list()
  if (!is.list(maps)) maps <- list()
  sealed_sha256 <- .acb_scalar(
    revision$choice_code_maps_sha256 %||%
      (revision$logic_audit %||% list())$choice_code_maps_sha256
  )
  computed_sha256 <- .xlsform_editor_sm_hash(maps)
  if (nzchar(sealed_sha256) && !identical(sealed_sha256, computed_sha256)) {
    .acb_error(
      422,
      codes$choice_map_hash,
      "Los mapas de códigos de la revisión publicada no coinciden con su sello SHA-256."
    )
  }
  list(
    maps = maps,
    sealed_sha256 = if (nzchar(sealed_sha256)) sealed_sha256 else computed_sha256
  )
}

.acb_normalization_audit <- function(normalization, revision_maps, compatibility,
                                     codes = .ACB_CODES_BATCH) {
  applied_maps <- normalization$choice_code_maps %||% list()
  applied_named <- .dn_choice_code_maps_named(applied_maps)
  sealed_named <- .dn_choice_code_maps_named(revision_maps$maps)
  unsealed <- setdiff(names(applied_named), names(sealed_named))
  if (length(unsealed)) {
    .acb_error(
      422,
      codes$unsealed_choice_map,
      "La data efectiva requiere mapas de códigos que no están sellados en la revisión publicada.",
      details = list(variables = as.list(sort(unsealed)))
    )
  }
  list(
    schema = "xlsform_normalization_audit/v1",
    aliases = as.list(unname(normalization$aliases %||% character(0))),
    select_multiple = normalization$select_multiple %||% list(),
    single_child_collapses = as.list(unname(normalization$single_child_collapses %||% character(0))),
    select_one_other_recodes = as.list(normalization$select_one_other_recodes %||% character(0)),
    dropped_columns = as.list(unname(normalization$dropped_columns %||% character(0))),
    choice_code_maps = list(
      origin = if (length(applied_named)) "published_revision" else "none",
      sealed_sha256 = revision_maps$sealed_sha256,
      applied_sha256 = .xlsform_editor_sm_hash(unname(applied_named)),
      variables = as.list(sort(names(applied_named)))
    ),
    compatibility = unclass(compatibility)
  )
}

# Core compartido: dada una `data_df` cruda (venga de Monitoreo o de un SAV) y la
# entrada de intake que fija su instrumento publicado, recorre el pipeline de
# normalización de acreditación y devuelve el item preparado (data normalizada +
# auditorías). `codes` decide la superficie de códigos `E_*` (.ACB_CODES_BATCH vs
# .ACB_CODES_SAV). `monitoreo_sources` sólo aplica al mapeo SurveyMonkey por
# q-columnas; el SAV manual pasa `list()` porque su data ya viene con nombres del
# instrumento.
.acreditacion_prepare_from_data <- function(s, intake_entry, data_df,
                                            monitoreo_sources = list(),
                                            codes = .ACB_CODES_BATCH) {
  actor_key <- .acb_scalar(intake_entry$actor_key)
  health <- .processing_intake_revision_health(s, .acb_scalar(intake_entry$instrument_revision_id))
  if (!isTRUE(health$ok)) {
    .acb_error(422, codes$instrument,
               sprintf("El instrumento aprobado para '%s' no está físicamente saludable.", actor_key))
  }
  if (!is.data.frame(data_df)) {
    .acb_error(422, codes$data,
               sprintf("La data de origen para '%s' no es tabular.", actor_key))
  }
  rp_inst <- reporte_instrumento(path = health$file$path)
  revision <- health$revision
  mapping <- .acreditacion_mapping_apply(
    data = data_df,
    instrumento = rp_inst,
    revision = revision,
    monitoreo_sources = monitoreo_sources
  )
  data_df <- mapping$data
  revision_maps <- .acb_revision_choice_maps(revision, codes = codes)
  data_df <- normalize_data_for_xlsform(
    data_df, rp_inst, choice_code_maps = revision_maps$maps
  )
  normalization <- attr(data_df, "xlsform_normalized") %||% list()
  data_df <- sanitize_base_data(data_df, rp_inst, monitoreo_handoff = TRUE)
  extras <- .reconciliacion_variables_extra(data_df, rp_inst, monitoreo_handoff = TRUE)
  data_df <- .carga_reorder_data_columns(data_df, rp_inst)
  compatibility <- validate_data_xlsform_compatibility(data_df, rp_inst)
  normalization_audit <- .acb_normalization_audit(
    normalization,
    revision_maps,
    compatibility,
    codes = codes
  )
  choice_domain_issues <- .sm_sav_choice_domain_issues(data_df, rp_inst)
  if (length(choice_domain_issues)) {
    .acb_error(
      422,
      codes$unknown_choice_codes,
      "La data efectiva contiene códigos que no pertenecen al catálogo de la revisión publicada.",
      details = list(variables = choice_domain_issues)
    )
  }
  list(
    intake = intake_entry,
    revision = revision,
    instrument_file = health$file,
    rp_inst = rp_inst,
    rp_data = reporte_data(data_df, instrumento = rp_inst),
    data = data_df,
    n_filas = as.integer(nrow(data_df)),
    n_columnas = as.integer(ncol(data_df)),
    data_checksum = .acb_hash(list(names = names(data_df), data = data_df)),
    source_mapping_audit = mapping$audit,
    source_mapping_fingerprint = mapping$fingerprint,
    extras = extras,
    extras_checksum = .acb_hash(extras),
    normalization = normalization_audit,
    normalization_fingerprint = .acb_hash(normalization_audit),
    compatibility = compatibility
  )
}

.acb_prepare_entry <- function(s, context, selection, intake_entry) {
  actor_key <- .acb_scalar(intake_entry$actor_key)
  actor_cases <- selection$selected[selection$selected$actor_key == actor_key, , drop = FALSE]
  actor_rollup <- selection$rollup[selection$rollup$actor_key == actor_key, , drop = FALSE]
  data_df <- context$data[actor_cases$response_row, , drop = FALSE]
  prepared <- .acreditacion_prepare_from_data(
    s, intake_entry, data_df,
    monitoreo_sources = s$monitoreo_sources %||% list(),
    codes = .ACB_CODES_BATCH
  )
  trace_checksum <- .acb_hash(actor_cases[order(actor_cases$response_row), c(
    "actor_key", "response_id", "response_row", "case_key"
  ), drop = FALSE])
  c(prepared, list(
    n_excluded = as.integer(sum(!actor_rollup$selected)),
    trace_checksum = trace_checksum
  ))
}

.acb_prepare_state <- function(s) {
  context <- .acb_cache_context(s)
  selection <- .acb_selected_cases(context)
  intake_context <- .acb_intake_context(s, selection$selected$actor_key)
  prepared <- lapply(intake_context$entries, function(entry) {
    .acb_prepare_entry(s, context, selection, entry)
  })
  entry_facts <- lapply(prepared, function(item) list(
    entry_id = .acb_scalar(item$intake$entry_id),
    base = .acb_scalar(item$intake$base),
    actor_key = .acb_scalar(item$intake$actor_key),
    instrument_revision_id = .acb_scalar(item$revision$revision_id),
    instrument_sha256 = .acb_scalar(item$revision$content_sha256),
    rows = item$n_filas,
    data_checksum = item$data_checksum,
    trace_checksum = item$trace_checksum,
    source_mapping_fingerprint = item$source_mapping_fingerprint,
    normalization_fingerprint = item$normalization_fingerprint
  ))
  preview_fingerprint <- .acb_hash(list(
    schema = .ACREDITACION_BATCH_SCHEMA,
    intake_revision = intake_context$intake$revision,
    family_id = intake_context$intake$family_id,
    cache_token = context$cache_token,
    entries = entry_facts
  ))
  list(
    context = context,
    selection = selection,
    intake = intake_context$intake,
    prepared = prepared,
    preview_fingerprint = preview_fingerprint
  )
}

.acb_assert_prepared_compatible <- function(prep) {
  incompatible <- Filter(
    function(item) !isTRUE(item$compatibility$ok),
    prep$prepared
  )
  if (length(incompatible)) {
    details <- unname(lapply(incompatible, function(item) list(
      actor_key = .acb_scalar(item$intake$actor_key),
      missing_columns = as.list(item$compatibility$missing_columns %||% character(0)),
      extra_columns = as.list(item$compatibility$extra_columns %||% character(0))
    )))
    .acb_error(
      422, "E_ACREDITACION_BATCH_INCOMPATIBLE",
      "Una o más bases efectivas no son compatibles con su XLSForm aprobado.",
      details = list(entries = details)
    )
  }
  invisible(TRUE)
}

.acb_public_preview <- function(prep) {
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
        message = "La data efectiva no es compatible con el XLSForm aprobado.",
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
      selected = item$n_filas,
      excluded = item$n_excluded,
      status = if (blocked) "blocked" else if (materialized) "already_materialized" else if (!is.null(existing)) "replacement_required" else "ready",
      compatibility = list(
        ok = isTRUE(compatibility$ok),
        message = .acb_scalar(compatibility$message),
        missing_columns = as.list(compatibility$missing_columns %||% character(0)),
        extra_columns = as.list(compatibility$extra_columns %||% character(0))
      ),
      extras = extras,
      extras_checksum = item$extras_checksum,
      blocking_reasons = reasons,
      data_checksum = item$data_checksum,
      trace_checksum = item$trace_checksum,
      source_mapping = list(
        fingerprint = item$source_mapping_fingerprint,
        audit = item$source_mapping_audit
      ),
      normalization = item$normalization
    )
  })
  blockers <- unname(unlist(lapply(entries, `[[`, "blocking_reasons"), recursive = FALSE))
  already_materialized <- length(entries) > 0L && all(vapply(entries, function(entry) identical(entry$status, "already_materialized"), logical(1)))
  replacement_required <- any(vapply(entries, function(entry) identical(entry$status, "replacement_required"), logical(1)))
  list(
    ok = TRUE,
    schema = .ACREDITACION_BATCH_SCHEMA,
    detected = TRUE,
    ready = !length(blockers),
    replacement_required = replacement_required,
    already_materialized = already_materialized,
    blockers = blockers,
    pins = list(
      intake_revision = as.integer(prep$intake$revision),
      family_id = prep$intake$family_id,
      cache_token = prep$context$cache_token,
      preview_fingerprint = prep$preview_fingerprint
    ),
    entries = entries,
    totals = list(
      selected = as.integer(sum(vapply(entries, function(entry) entry$selected, integer(1)))),
      excluded = prep$selection$excluded,
      total_rollup = prep$selection$total_rollup
    )
  )
}

carga_acreditacion_batch_preview <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) .acb_error(404, "E_NO_SESSION", "Sin sesión.")
  snapshot <- s$monitoreo_snapshot %||% NULL
  family <- .acb_scalar(((s$monitoreo_config %||% list())$monitoreo_profile %||% list())$family)
  if (!is.list(snapshot) || !is.data.frame(snapshot$data) || !nrow(snapshot$data) ||
      !identical(family, "acreditacion")) {
    return(.acb_empty_preview())
  }
  prep <- .acb_prepare_state(s)
  prep$context$s <- s
  .acb_public_preview(prep)
}

.acb_assert_pins <- function(prep, supplied) {
  pins <- supplied$pins %||% list()
  expected <- list(
    intake_revision = as.integer(prep$intake$revision),
    family_id = prep$intake$family_id,
    cache_token = prep$context$cache_token,
    preview_fingerprint = prep$preview_fingerprint
  )
  received_revision <- suppressWarnings(as.integer(
    supplied$expected_intake_revision %||% pins$intake_revision %||% NA_integer_
  )[1])
  matches <- identical(received_revision, expected$intake_revision) &&
    identical(.acb_scalar(supplied$expected_family_id %||% pins$family_id), expected$family_id) &&
    identical(.acb_scalar(supplied$expected_cache_token %||% pins$cache_token), expected$cache_token) &&
    identical(.acb_scalar(supplied$preview_fingerprint %||% pins$preview_fingerprint), expected$preview_fingerprint)
  if (!isTRUE(matches)) {
    .acb_error(409, "E_ACREDITACION_BATCH_STALE",
               "El preview o sus dependencias cambiaron; vuelve a previsualizar.")
  }
  invisible(expected)
}

.acb_base_matches <- function(base, item, family_id, fingerprint) {
  !is.null(base) &&
    identical(.acb_scalar(base$processing_intake_entry_id), .acb_scalar(item$intake$entry_id)) &&
    identical(.acb_scalar(base$sibling_family_id), family_id) &&
    identical(.acb_scalar(base$instrument_revision_id), .acb_scalar(item$revision$revision_id)) &&
    identical(.acb_scalar(base$preview_fingerprint), fingerprint)
}

.acb_promote_result <- function(sid, prep, already_materialized) {
  base_names <- vapply(prep$prepared, function(item) .acb_scalar(item$intake$base), character(1))
  counts <- stats::setNames(
    as.list(vapply(prep$prepared, function(item) item$n_filas, integer(1))),
    vapply(prep$prepared, function(item) .acb_scalar(item$intake$actor_key), character(1))
  )
  list(
    ok = TRUE,
    promoted = !isTRUE(already_materialized),
    already_materialized = isTRUE(already_materialized),
    batch_id = prep$preview_fingerprint,
    base_names = as.list(base_names),
    counts = counts,
    estudio = .estudio_payload(sid)
  )
}

.acb_existing_state <- function(s, prep) {
  bases <- ((s$estudio %||% list())$bases %||% list())
  target_names <- vapply(prep$prepared, function(item) .acb_scalar(item$intake$base), character(1))
  unrelated <- setdiff(names(bases), target_names)
  if (length(unrelated)) {
    .acb_error(409, "E_ACREDITACION_BATCH_BASE_CONFLICT",
               "El estudio contiene bases ajenas al intake; no se convertirán implícitamente.")
  }
  present <- target_names[target_names %in% names(bases)]
  matching <- vapply(prep$prepared, function(item) {
    name <- .acb_scalar(item$intake$base)
    .acb_base_matches(bases[[name]], item, prep$intake$family_id, prep$preview_fingerprint)
  }, logical(1))
  if (any(matching) && !all(matching)) {
    .acb_error(409, "E_ACREDITACION_BATCH_PARTIAL_STATE",
               "Se detectó una materialización parcial inconsistente; no se modificó el proyecto.")
  }
  list(bases = bases, targets = target_names, present = present, all_matching = all(matching))
}

.acb_state_with_materialization <- function(s, prep, file_items, now) {
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
      processing_intake_entry_id = .acb_scalar(entry$entry_id),
      sibling_family_id = prep$intake$family_id,
      instrument_revision_id = .acb_scalar(item$revision$revision_id),
      instrument_revision_hash = .acb_scalar(item$revision$content_sha256),
      source_kind = .ACREDITACION_BATCH_SOURCE_KIND,
      source_alias = .acb_scalar(entry$actor),
      source_title = .acb_scalar(entry$base_label, .acb_scalar(entry$actor)),
      batch_fingerprint = prep$preview_fingerprint,
      cache_fingerprint = prep$context$cache_fingerprint,
      preview_fingerprint = prep$preview_fingerprint,
      response_filter = list(
        source = "persisted_case_rollup",
        counts_in_advance = TRUE,
        platform_state = "Completa",
        advancement = "effective",
        selected_rows = item$n_filas
      ),
      traceability = list(
        snapshot_synced_at = .acb_scalar(prep$context$snapshot$synced_at),
        snapshot_hash = monitoreo_snapshot_hash(prep$context$data),
        cache_token_sha256 = prep$context$cache_fingerprint,
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
  active <- if (active_before %in% target_names) active_before else target_names[[1]]
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
    status = "accreditation_batch_materialized",
    batch_fingerprint = prep$preview_fingerprint,
    updated_at = now
  )
  next_state$codif_source_active <- active
  next_state <- .mark_project_dirty(next_state)
  next_state
}

carga_acreditacion_batch_promote <- function(sid, parsed = list()) {
  if (!is.list(parsed)) parsed <- list()
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) .acb_error(404, "E_NO_SESSION", "Sin sesión.")
  prep <- .acb_prepare_state(s)
  .acb_assert_prepared_compatible(prep)
  .acb_assert_pins(prep, parsed)
  existing <- .acb_existing_state(s, prep)
  if (isTRUE(existing$all_matching)) {
    return(.acb_promote_result(sid, prep, already_materialized = TRUE))
  }
  if (length(existing$present) && !.acb_bool(parsed$confirm_replacement)) {
    .acb_error(409, "E_ACREDITACION_BATCH_CONFIRM_REPLACEMENT",
               "Confirma explícitamente el reemplazo de las bases ya materializadas.")
  }

  stage_dir <- tempfile("acreditacion_batch_", tmpdir = file.path(s$dir, "downloads"))
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

  fresh <- session_get(sid)
  fresh_prep <- .acb_prepare_state(fresh)
  .acb_assert_prepared_compatible(fresh_prep)
  .acb_assert_pins(fresh_prep, parsed)
  if (!identical(
    vapply(prep$prepared, `[[`, character(1), "data_checksum"),
    vapply(fresh_prep$prepared, `[[`, character(1), "data_checksum")
  )) {
    .acb_error(409, "E_ACREDITACION_BATCH_STALE",
               "La data normalizada cambió durante la preparación del batch.")
  }
  .acb_existing_state(fresh, fresh_prep)

  uploads_dir <- file.path(fresh$dir, "uploads")
  dir.create(uploads_dir, recursive = TRUE, showWarnings = FALSE)
  now <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  file_items <- lapply(seq_along(staged), function(i) {
    file_id <- uuid::UUIDgenerate()
    final_path <- file.path(uploads_dir, paste0(file_id, ".xlsx"))
    if (!file.rename(staged[[i]]$path, final_path)) {
      .acb_error(500, "E_ACREDITACION_BATCH_FILE_COMMIT",
                 "No se pudo publicar uno de los archivos preparados.")
    }
    final_paths <<- c(final_paths, final_path)
    base_name <- .acb_scalar(fresh_prep$prepared[[i]]$intake$base)
    list(
      file_sha256 = staged[[i]]$file_sha256,
      meta = list(
        file_id = file_id,
        kind = "data",
        original_name = paste0(base_name, "_efectivas_acreditacion.xlsx"),
        path = final_path,
        size = as.numeric(file.info(final_path)$size),
        ext = "xlsx",
        uploaded_at = now
      )
    )
  })

  next_state <- .acb_state_with_materialization(fresh, fresh_prep, file_items, now)
  .session_env[[sid]] <- next_state
  committed <- TRUE
  .acb_promote_result(sid, fresh_prep, already_materialized = FALSE)
}
