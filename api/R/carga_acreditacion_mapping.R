# =============================================================================
# Carga acreditacion -- mapping sellado por fuente hacia el XLSForm canonico
# =============================================================================

.acm_scalar <- function(value, default = "") {
  if (is.null(value) || !length(value)) return(default)
  out <- trimws(as.character(value[[1]]))
  if (is.na(out) || !nzchar(out)) default else out
}

.acm_named_value <- function(value, key, default = NULL) {
  if (is.null(value) || !length(value)) return(default)
  value_names <- names(value)
  if (is.null(value_names)) return(default)
  key <- as.character(key %||% "")
  if (!length(key) || is.na(key[[1]]) || !nzchar(key[[1]])) return(default)
  hit <- match(key[[1]], value_names)
  if (is.na(hit)) default else value[[hit]]
}

.acm_fail <- function(code, message, details = NULL) {
  stop_api(422, code, message, details = details)
}

.acm_has_value <- function(value) {
  value <- as.character(value)
  !is.na(value) & nzchar(trimws(value))
}

.acm_safe_name <- function(value) {
  if (exists(".sm_api_safe_name", mode = "function")) return(.sm_api_safe_name(value))
  value <- tolower(trimws(as.character(value %||% "")))
  value <- iconv(value, to = "ASCII//TRANSLIT", sub = "")
  value <- gsub("[^a-z0-9]+", "_", value)
  value <- gsub("^_+|_+$", "", value)
  if (!nzchar(value)) "valor" else value
}

.acm_survey_labels <- function(instrumento) {
  survey <- instrumento$survey %||% data.frame()
  if (!is.data.frame(survey) || !nrow(survey) || !"name" %in% names(survey)) return(character(0))
  label_cols <- unique(c("label", grep("^label::", names(survey), value = TRUE)))
  label_cols <- label_cols[label_cols %in% names(survey)]
  labels <- rep("", nrow(survey))
  for (column in label_cols) {
    candidate <- as.character(survey[[column]])
    use <- !nzchar(labels) & !is.na(candidate) & nzchar(trimws(candidate))
    labels[use] <- trimws(candidate[use])
  }
  names(labels) <- as.character(survey$name)
  labels[!is.na(names(labels)) & nzchar(names(labels))]
}

.acm_source_index <- function(monitoreo_sources) {
  records <- monitoreo_sources %||% list()
  if (is.data.frame(records)) {
    records <- unname(lapply(seq_len(nrow(records)), function(i) as.list(records[i, , drop = FALSE])))
  }
  if (!is.list(records)) records <- list()
  if (length(intersect(names(records) %||% character(0), c("id", "source_id", "survey_id")))) {
    records <- list(records)
  }
  out <- list()
  for (record in records) {
    if (!is.list(record)) next
    source_id <- .acm_scalar(record$id %||% record$source_id)
    survey_id <- .acm_scalar(record$survey_id)
    if (!nzchar(source_id) || !nzchar(survey_id)) next
    previous <- .acm_scalar(out[[source_id]])
    if (nzchar(previous) && !identical(previous, survey_id)) {
      .acm_fail(
        "E_ACREDITACION_MAPPING_SOURCE_AMBIGUOUS",
        sprintf("La fuente '%s' declara mas de un survey_id.", source_id),
        details = list(source_id = source_id)
      )
    }
    out[[source_id]] <- survey_id
  }
  out
}

.acm_variant_for_survey <- function(variants, survey_id) {
  variants <- variants %||% list()
  if (!is.list(variants) || !length(variants)) return(NULL)
  variant_names <- names(variants) %||% rep("", length(variants))
  hits <- which(vapply(seq_along(variants), function(i) {
    variant <- variants[[i]]
    if (!is.list(variant)) return(FALSE)
    candidate <- .acm_scalar(variant$survey_id, .acm_scalar(variant_names[[i]]))
    identical(candidate, survey_id)
  }, logical(1)))
  if (length(hits) > 1L) {
    .acm_fail(
      "E_ACREDITACION_MAPPING_VARIANT_AMBIGUOUS",
      sprintf("La revision contiene mas de una variante para survey_id '%s'.", survey_id),
      details = list(survey_id = survey_id)
    )
  }
  if (!length(hits)) NULL else variants[[hits[[1]]]]
}

.acm_validate_variant <- function(variant, revision, survey_id) {
  review <- variant$logic_review %||% list()
  content_sha256 <- .acm_scalar(revision$content_sha256)
  definition_sha256 <- .acm_scalar(variant$definition_sha256)
  valid <- identical(.acm_scalar(variant$review_status), "confirmed") &&
    nzchar(content_sha256) &&
    identical(.acm_scalar(review$content_sha256), content_sha256) &&
    nzchar(definition_sha256) &&
    identical(.acm_scalar(review$definition_sha256), definition_sha256)
  if (!isTRUE(valid)) {
    .acm_fail(
      "E_ACREDITACION_MAPPING_VARIANT_STALE",
      sprintf("La variante SurveyMonkey '%s' no esta confirmada y sellada para esta revision.", survey_id),
      details = list(survey_id = survey_id)
    )
  }
  invisible(TRUE)
}

.acm_variant_lookup <- function(variant) {
  out <- list()
  for (item in variant$variant_map_draft %||% list()) {
    if (!is.list(item)) next
    from <- .acm_scalar(item$from)
    to <- .acm_scalar(item$to)
    if (!nzchar(from) || !nzchar(to)) next
    previous <- .acm_scalar(out[[from]])
    if (nzchar(previous) && !identical(previous, to)) {
      .acm_fail(
        "E_ACREDITACION_MAPPING_VARIANT_AMBIGUOUS",
        sprintf("La variante declara destinos incompatibles para '%s'.", from),
        details = list(source_variable = from)
      )
    }
    out[[from]] <- to
  }
  out
}

.acm_trace_only_parent <- function(variant) {
  resolution <- variant$person_code_resolution %||% list()
  excluded <- identical(resolution$analysis_included, FALSE) ||
    identical(.acm_scalar(resolution$role), "monitoring_trace_only")
  if (isTRUE(excluded)) .acm_scalar(resolution$source_question_name) else ""
}

.acm_matrix_target <- function(parent, slug, expected, labels, source_id, source_var) {
  prefix <- paste0(parent, "_")
  candidates <- expected[startsWith(expected, prefix)]
  candidates <- candidates[nzchar(substring(candidates, nchar(prefix) + 1L))]
  label_slugs <- vapply(candidates, function(candidate) {
    .acm_safe_name(labels[[candidate]] %||% "")
  }, character(1))
  matches <- candidates[label_slugs == slug]
  if (!length(matches)) {
    compact <- function(value) {
      tokens <- strsplit(value, "_", fixed = TRUE)[[1]]
      paste(tokens[!tokens %in% c("de", "del", "la", "las", "el", "los", "en", "y")], collapse = "_")
    }
    matches <- candidates[vapply(label_slugs, compact, character(1)) == compact(slug)]
  }
  if (length(matches) != 1L) {
    .acm_fail(
      if (length(matches)) "E_ACREDITACION_MAPPING_MATRIX_AMBIGUOUS" else "E_ACREDITACION_MAPPING_MATRIX_UNKNOWN",
      sprintf("No se pudo resolver de forma unica la fila matriz '%s' de la fuente '%s'.", source_var, source_id),
      details = list(
        source_id = source_id,
        source_variable = source_var,
        target_parent = parent,
        candidates = as.list(matches)
      )
    )
  }
  matches[[1]]
}

.acm_set_values <- function(data, rows, target, values, source_id, source_var) {
  if (!target %in% names(data)) data[[target]] <- rep(NA_character_, nrow(data))
  incoming <- as.character(values)
  present <- .acm_has_value(incoming)
  if (!any(present)) return(data)
  target_rows <- rows[present]
  current <- as.character(data[[target]][target_rows])
  conflict <- .acm_has_value(current) & trimws(current) != trimws(incoming[present])
  if (any(conflict)) {
    .acm_fail(
      "E_ACREDITACION_MAPPING_VALUE_CONFLICT",
      sprintf("La fuente '%s' produce valores incompatibles para '%s'.", source_id, target),
      details = list(source_id = source_id, source_variable = source_var, target_variable = target)
    )
  }
  assign <- !.acm_has_value(current)
  if (any(assign)) data[[target]][target_rows[assign]] <- incoming[present][assign]
  data
}

.acreditacion_mapping_apply <- function(data, instrumento, revision, monitoreo_sources) {
  if (!is.data.frame(data)) {
    .acm_fail("E_ACREDITACION_MAPPING_DATA", "La data de Monitoreo no es tabular.")
  }
  q_columns <- grep("^q[0-9]{4}(?:__.+)?$", names(data), value = TRUE, perl = TRUE)
  expected <- unique(as.character(.dn_expected_data_names(instrumento) %||% character(0)))
  expected <- expected[!is.na(expected) & nzchar(expected)]
  revision_id <- .acm_scalar(revision$revision_id)
  content_sha256 <- .acm_scalar(revision$content_sha256)
  if (!length(q_columns)) {
    audit <- list(list(action = "not_applicable", revision_id = revision_id, mapped_columns = 0L))
    fingerprint <- tolower(digest::digest(
      list(revision_id = revision_id, content_sha256 = content_sha256, audit = audit),
      algo = "sha256", serialize = TRUE
    ))
    out <- .dn_backfill_missing_columns(data, expected)
    attr(out, "acreditacion_source_mapping") <- list(audit = audit, fingerprint = fingerprint)
    return(list(data = out, audit = audit, fingerprint = fingerprint))
  }
  if (!".source_id" %in% names(data)) {
    .acm_fail(
      "E_ACREDITACION_MAPPING_SOURCE_MISSING",
      "La data SurveyMonkey no conserva .source_id para resolver su instrumento de origen."
    )
  }

  source_ids <- trimws(as.character(data$.source_id))
  relevant_rows <- Reduce(`|`, lapply(q_columns, function(column) .acm_has_value(data[[column]])))
  if (any(relevant_rows & (is.na(source_ids) | !nzchar(source_ids)))) {
    .acm_fail(
      "E_ACREDITACION_MAPPING_SOURCE_MISSING",
      "Hay respuestas SurveyMonkey sin .source_id trazable."
    )
  }

  source_index <- .acm_source_index(monitoreo_sources)
  canonical_survey_id <- .acm_scalar((revision$source %||% list())$survey_id)
  if (!nzchar(canonical_survey_id)) {
    .acm_fail("E_ACREDITACION_MAPPING_CANONICAL_SOURCE", "La revision no fija un survey_id canonico.")
  }
  labels <- .acm_survey_labels(instrumento)
  source_labels <- attr(data, "monitoreo_source_variable_labels", exact = TRUE) %||% list()
  original_variable_labels <- attr(data, "variable_labels", exact = TRUE) %||% character(0)
  out <- .dn_backfill_missing_columns(data, expected)
  audit <- list()

  active_sources <- sort(unique(source_ids[relevant_rows]))
  for (source_id in active_sources) {
    rows <- which(source_ids == source_id)
    survey_id <- .acm_scalar(source_index[[source_id]])
    if (!nzchar(survey_id)) {
      .acm_fail(
        "E_ACREDITACION_MAPPING_SOURCE_UNKNOWN",
        sprintf("La fuente '%s' no tiene survey_id declarado en Monitoreo.", source_id),
        details = list(source_id = source_id)
      )
    }
    canonical <- identical(survey_id, canonical_survey_id)
    variant <- if (canonical) NULL else .acm_variant_for_survey(
      (revision$source %||% list())$variants, survey_id
    )
    if (!canonical && is.null(variant)) {
      .acm_fail(
        "E_ACREDITACION_MAPPING_VARIANT_UNKNOWN",
        sprintf("El survey_id '%s' no pertenece a la revision publicada.", survey_id),
        details = list(source_id = source_id, survey_id = survey_id)
      )
    }
    if (!canonical) .acm_validate_variant(variant, revision, survey_id)
    lookup <- if (canonical) list() else .acm_variant_lookup(variant)
    trace_parent <- if (canonical) "" else .acm_trace_only_parent(variant)

    for (source_var in sort(q_columns)) {
      values <- data[[source_var]][rows]
      n_values <- sum(.acm_has_value(values))
      if (!n_values) next
      parts <- regmatches(source_var, regexec("^q([0-9]{4})(?:__(.+))?$", source_var, perl = TRUE))[[1]]
      position <- suppressWarnings(as.integer(parts[[2]]))
      source_parent <- paste0("p", position)
      slug <- if (length(parts) >= 3L) .acm_scalar(parts[[3]]) else ""
      source_label_map <- .acm_named_value(source_labels, source_id, list())
      source_label <- .acm_scalar(.acm_named_value(source_label_map, source_var))

      if (nzchar(trace_parent) && identical(source_parent, trace_parent)) {
        audit[[length(audit) + 1L]] <- list(
          action = "excluded_monitoring_trace",
          source_id = source_id,
          survey_id = survey_id,
          source_variable = source_var,
          source_label = source_label,
          rows = as.integer(n_values)
        )
        next
      }

      target_parent <- .acm_scalar(lookup[[source_parent]], source_parent)
      target <- if (nzchar(slug)) {
        .acm_matrix_target(target_parent, slug, expected, labels, source_id, source_var)
      } else target_parent
      if (!target %in% expected) {
        .acm_fail(
          "E_ACREDITACION_MAPPING_TARGET_UNKNOWN",
          sprintf("La variable '%s' de la fuente '%s' no tiene destino canonico.", source_var, source_id),
          details = list(
            source_id = source_id,
            survey_id = survey_id,
            source_variable = source_var,
            target_variable = target
          )
        )
      }
      out <- .acm_set_values(out, rows, target, values, source_id, source_var)
      audit[[length(audit) + 1L]] <- list(
        action = "mapped",
        source_id = source_id,
        survey_id = survey_id,
        source_variable = source_var,
        source_label = source_label,
        target_variable = target,
        rows = as.integer(n_values),
        variant = !canonical
      )
    }
  }

  out <- out[, setdiff(names(out), q_columns), drop = FALSE]
  variable_labels <- as.character(original_variable_labels)
  names(variable_labels) <- names(original_variable_labels)
  variable_labels <- variable_labels[names(variable_labels) %in% names(out)]
  instrument_labels <- labels[names(labels) %in% expected & nzchar(labels)]
  variable_labels[names(instrument_labels)] <- instrument_labels
  if (length(variable_labels)) {
    attr(out, "variable_labels") <- variable_labels
  }
  if (length(source_labels)) attr(out, "monitoreo_source_variable_labels") <- source_labels

  audit <- audit[order(
    vapply(audit, function(item) .acm_scalar(item$source_id), character(1)),
    vapply(audit, function(item) .acm_scalar(item$source_variable), character(1)),
    vapply(audit, function(item) .acm_scalar(item$target_variable), character(1))
  )]
  fingerprint <- tolower(digest::digest(
    list(
      revision_id = revision_id,
      content_sha256 = content_sha256,
      canonical_survey_id = canonical_survey_id,
      expected = expected,
      audit = audit
    ),
    algo = "sha256", serialize = TRUE
  ))
  attr(out, "acreditacion_source_mapping") <- list(audit = audit, fingerprint = fingerprint)
  list(data = out, audit = audit, fingerprint = fingerprint)
}
