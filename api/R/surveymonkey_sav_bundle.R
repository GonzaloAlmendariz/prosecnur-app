# =============================================================================
# SurveyMonkey SAV/ZIP SAV offline -> actualizacion controlada multibase
#
# Este importador parte de bases hermanas independientes existentes. Cada .sav
# recibido directamente o dentro de un ZIP se normaliza contra el XLSForm
# efectivo de su base y reemplaza solo la data efectiva, dejando un plan de
# cambio auditable antes de mutar la sesion.
# =============================================================================

.sm_sav_require_session_project <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) stop_api(404, "E_NO_SESSION", "Sin sesión.")
  if (is.null(s$estudio) || !length(s$estudio$bases %||% list())) {
    stop_api(409, "E_SM_SAV_NO_PROJECT", "Abre un proyecto con bases existentes antes de importar el ZIP SAV.")
  }
  if (!estudio_is_independent_siblings(sid)) {
    stop_api(409, "E_SM_SAV_NOT_INDEPENDENT", "La actualización desde ZIP SAV requiere bases hermanas independientes.")
  }
  s
}

.sm_sav_file_base_map <- function(x) {
  if (is.null(x) || !length(x)) return(list())
  if (is.data.frame(x)) {
    file_col <- intersect(c("entry_name", "file", "filename", "sav_file", "source_file"), names(x))[1]
    base_col <- intersect(c("base_name", "base"), names(x))[1]
    if (is.na(file_col) || is.na(base_col)) return(list())
    out <- as.list(as.character(x[[base_col]] %||% ""))
    names(out) <- as.character(x[[file_col]] %||% "")
    return(out)
  }
  if (is.list(x) && !is.null(names(x))) return(x)
  list()
}

.sm_sav_safe_text <- function(x) {
  if (is.null(x) || !length(x)) return(character(0))
  x <- as.character(x)
  x[is.na(x)] <- ""
  out <- iconv(x, from = "", to = "UTF-8", sub = " ")
  out[is.na(out)] <- ""
  enc2utf8(out)
}

.sm_sav_display_name <- function(entry_name) {
  basename(.sm_sav_safe_text(entry_name))
}

.sm_sav_zip_entries <- function(path) {
  if (!requireNamespace("zip", quietly = TRUE)) {
    stop_api(500, "E_NO_ZIP", "El paquete R 'zip' no está disponible para leer el ZIP SAV.")
  }
  info <- tryCatch(
    zip::zip_list(path),
    error = function(e) stop_api(400, "E_SM_SAV_BAD_ZIP", paste("No se pudo leer el ZIP:", conditionMessage(e)))
  )
  if (!nrow(info) || !"filename" %in% names(info)) return(info[0, , drop = FALSE])
  entries <- info[grepl("\\.sav$", as.character(info$filename), ignore.case = TRUE, useBytes = TRUE), , drop = FALSE]
  entries
}

.sm_sav_source_entries <- function(meta) {
  ext <- tolower(.sm_mb_scalar(meta$ext %||% tools::file_ext(meta$path), ""))
  if (identical(ext, "zip")) return(.sm_sav_zip_entries(meta$path))
  if (identical(ext, "sav")) {
    return(data.frame(
      filename = .sm_mb_scalar(meta$original_name %||% basename(meta$path), "respuestas.sav"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ))
  }
  stop_api(400, "E_SM_SAV_FILE_UNSUPPORTED", "El archivo debe ser .sav o .zip.")
}

.sm_sav_safe_entry_path <- function(zip_path, entry_name, index) {
  entry_name <- .sm_mb_scalar(entry_name, "")
  if (!nzchar(entry_name)) stop_api(400, "E_SM_SAV_BAD_ENTRY", "El ZIP contiene una entrada sin nombre.")
  out <- file.path(tempdir(), sprintf("prosecnur_sm_sav_%s_%03d.sav", uuid::UUIDgenerate(), as.integer(index)))
  con <- NULL
  tryCatch({
    con <- unz(zip_path, entry_name, open = "rb")
    raw <- readBin(con, what = "raw", n = 1024L * 1024L * 1024L)
    writeBin(raw, out)
    out
  }, error = function(e) {
    stop_api(400, "E_SM_SAV_EXTRACT_FAILED", sprintf(
      "No se pudo extraer '%s' del ZIP: %s",
      entry_name,
      conditionMessage(e)
    ))
  }, finally = {
    if (!is.null(con)) try(close(con), silent = TRUE)
  })
}

.sm_sav_read_entry <- function(zip_path, entry_name, index) {
  if (!requireNamespace("haven", quietly = TRUE)) {
    stop_api(500, "E_NO_HAVEN", "haven no está disponible para leer .sav")
  }
  path <- .sm_sav_safe_entry_path(zip_path, entry_name, index)
  on.exit(unlink(path), add = TRUE)
  tryCatch(
    as.data.frame(haven::read_sav(path), stringsAsFactors = FALSE, check.names = FALSE),
    error = function(e) stop_api(400, "E_SM_SAV_READ_FAILED", sprintf(
      "No se pudo leer '%s' como SAV: %s",
      entry_name,
      conditionMessage(e)
    ))
  )
}

.sm_sav_read_source <- function(meta, entry_name, index) {
  ext <- tolower(.sm_mb_scalar(meta$ext %||% tools::file_ext(meta$path), ""))
  if (identical(ext, "zip")) return(.sm_sav_read_entry(meta$path, entry_name, index))
  if (!identical(ext, "sav")) {
    stop_api(400, "E_SM_SAV_FILE_UNSUPPORTED", "El archivo debe ser .sav o .zip.")
  }
  if (!requireNamespace("haven", quietly = TRUE)) {
    stop_api(500, "E_NO_HAVEN", "haven no está disponible para leer .sav")
  }
  tryCatch(
    as.data.frame(haven::read_sav(meta$path), stringsAsFactors = FALSE, check.names = FALSE),
    error = function(e) stop_api(400, "E_SM_SAV_READ_FAILED", sprintf(
      "No se pudo leer '%s' como SAV: %s",
      entry_name,
      conditionMessage(e)
    ))
  )
}

.sm_sav_entry_base_map_key <- function(entry_name) {
  safe_name <- .sm_sav_safe_text(entry_name)
  unique(c(
    .sm_wb_norm_key(safe_name),
    .sm_wb_norm_key(basename(safe_name)),
    .sm_mb_slug(safe_name),
    .sm_mb_slug(basename(safe_name))
  ))
}

.sm_sav_match_entry_to_base <- function(entry_name, bases, explicit_map = list()) {
  entry_raw <- .sm_mb_scalar(entry_name, "")
  entry_safe <- .sm_mb_scalar(.sm_sav_safe_text(entry_raw), "")
  full_keys <- unique(c(
    entry_raw,
    entry_safe,
    .sm_wb_norm_key(entry_safe),
    .sm_mb_slug(entry_safe)
  ))
  for (key in full_keys[nzchar(full_keys)]) {
    mapped <- .sm_mb_scalar(explicit_map[[key]], "")
    if (nzchar(mapped)) return(if (mapped %in% names(bases)) mapped else "")
  }
  basename_keys <- unique(c(
    basename(entry_raw),
    basename(entry_safe),
    .sm_wb_norm_key(basename(entry_safe)),
    .sm_mb_slug(basename(entry_safe))
  ))
  for (key in basename_keys[nzchar(basename_keys)]) {
    mapped <- .sm_mb_scalar(explicit_map[[key]], "")
    if (nzchar(mapped)) return(if (mapped %in% names(bases)) mapped else "")
  }

  entry_norm <- .sm_wb_norm_key(basename(entry_safe))
  career_tokens <- list(
    ingenieria_civil = c("civil"),
    ingenieria_electronica = c("electronica", "electronico"),
    ingenieria_geologica = c("geologica", "geologico", "geologia"),
    ingenieria_industrial = c("industrial"),
    ingenieria_informatica = c("informatica", "informativa"),
    ingenieria_mecanica = c("mecanica", "mecanico"),
    ingenieria_mecatronica = c("mecatronica", "mecatronico"),
    ingenieria_de_minas = c("minas"),
    ingenieria_de_las_telecomunicaciones = c("telecomunicaciones", "telecomunicacion")
  )
  for (base_name in names(bases)) {
    labels <- .sm_wb_base_label_candidates(base_name, bases[[base_name]])
    base_norms <- unique(c(.sm_wb_norm_key(labels), .sm_mb_slug(labels)))
    tokens <- career_tokens[[base_name]] %||% character(0)
    if (!length(tokens)) {
      token_guess <- setdiff(unlist(strsplit(.sm_wb_norm_key(base_name), " ", fixed = TRUE), use.names = FALSE), c("ingenieria", "de", "las"))
      tokens <- token_guess[nzchar(token_guess)]
    }
    if (any(vapply(tokens, function(token) {
      if (!nzchar(token) || !grepl(paste0("\\b", token, "\\b"), entry_norm, perl = TRUE)) {
        return(FALSE)
      }
      (base_name %in% names(career_tokens)) ||
        any(grepl(paste0("\\b", token, "\\b"), base_norms, perl = TRUE))
    }, logical(1)))) {
      return(base_name)
    }
  }

  # Reutiliza la heuristica hoja->base del Excel: el basename del .sav cumple
  # el mismo rol que una hoja visible para el usuario.
  .sm_wb_match_sheet_to_base(basename(entry_safe), bases, list())
}

.sm_sav_missing_policy <- function(value) {
  policy <- .sm_mb_scalar(value, "fill_blank_warn")
  allowed <- c("fill_blank_warn", "strict")
  if (!policy %in% allowed) {
    stop_api(
      400,
      "E_SM_SAV_MISSING_POLICY",
      "missing_required_policy debe ser 'fill_blank_warn' o 'strict'."
    )
  }
  policy
}

.sm_sav_expected_variables <- function(inst) {
  .sm_mb_expected_names(inst)
}

.sm_sav_metadata_columns <- function(df) {
  nms <- names(df)
  if (!length(nms)) return(character(0))
  norm <- .sm_wb_norm_key(nms)
  meta_pat <- paste(c(
    "^collector", "^respondent id$", "^response id$", "^date created$",
    "^date modified$", "^ip address$", "^email address$", "^first name$",
    "^last name$", "^custom", "^survey id$", "^source", "^case uid$",
    "^response status$", "^duration", "^total time$"
  ), collapse = "|")
  nms[grepl(meta_pat, norm, perl = TRUE)]
}

.sm_sav_review_label_column <- function(df) {
  if (is.null(df) || !is.data.frame(df) || !ncol(df)) return(NA_character_)
  candidates <- c(
    "label::Spanish (es)", "label::Spanish(es)", "label::Spanish",
    "label::es", "label_es", "label_spanish_es", "label"
  )
  lowered <- tolower(names(df))
  hit <- match(tolower(candidates), lowered, nomatch = 0L)
  hit <- hit[hit > 0L]
  if (!length(hit)) NA_character_ else names(df)[hit[[1]]]
}

.sm_sav_review_value <- function(value, default = "") {
  if (is.null(value) || !length(value) || is.na(value[[1]])) return(default)
  out <- trimws(as.character(value[[1]]))
  if (nzchar(out)) out else default
}

.sm_sav_review_source_columns <- function(columns, aliases, raw_names) {
  columns <- as.character(columns %||% character(0))
  columns <- columns[!is.na(columns) & nzchar(columns)]
  aliases <- aliases %||% character(0)
  resolve_one <- function(column) {
    current <- column
    visited <- character(0)
    while (length(aliases) && current %in% names(aliases) && !(current %in% visited)) {
      visited <- c(visited, current)
      source <- .sm_sav_review_value(aliases[[current]], "")
      if (!nzchar(source)) break
      current <- source
    }
    current
  }
  resolved <- unique(vapply(columns, resolve_one, character(1)))
  resolved[resolved %in% raw_names]
}

.sm_sav_review_catalog <- function(row, choices, choice_map, source_columns,
                                   recode_other_zero = FALSE) {
  list_name <- .dn_survey_list_name(row)
  if (is.na(list_name) || !nzchar(list_name) || !is.data.frame(choices) ||
      !nrow(choices) || !all(c("list_name", "name") %in% names(choices))) {
    return(NULL)
  }
  subset <- choices[as.character(choices$list_name) == list_name, , drop = FALSE]
  label_col <- .sm_sav_review_label_column(subset)
  choice_items <- lapply(seq_len(nrow(subset)), function(i) list(
    name = .sm_sav_review_value(subset$name[[i]], ""),
    label = if (is.na(label_col)) {
      .sm_sav_review_value(subset$name[[i]], "")
    } else {
      .sm_sav_review_value(subset[[label_col]][[i]], .sm_sav_review_value(subset$name[[i]], ""))
    }
  ))
  mappings <- lapply(.dn_choice_map_items(choice_map %||% list()), function(item) list(
    source_code = .sm_sav_review_value(item$source_code, ""),
    source_column = .sm_sav_review_value(item$source_column, ""),
    source_label = .sm_sav_review_value(item$source_label, ""),
    xls_code = .sm_sav_review_value(item$xls_code, ""),
    xls_label = .sm_sav_review_value(item$xls_label, ""),
    match = .sm_sav_review_value(item$match, "")
  ))
  if (isTRUE(recode_other_zero)) {
    labels <- vapply(choice_items, function(item) item$label, character(1))
    other <- which(.dn_is_other_label(labels))
    if (length(other)) {
      choice <- choice_items[[other[[1]]]]
      mappings[[length(mappings) + 1L]] <- list(
        source_code = "0",
        source_column = if (length(source_columns)) source_columns[[1]] else "",
        source_label = choice$label,
        xls_code = choice$name,
        xls_label = choice$label,
        match = "other_zero"
      )
    }
  }
  list(
    list_name = list_name,
    choices = choice_items,
    mappings = mappings
  )
}

.sm_sav_normalization_review <- function(raw_names, inst, normalized_attr,
                                         expected, missing_variables,
                                         metadata_columns) {
  survey <- (inst %||% list())$survey %||% data.frame()
  choices <- (inst %||% list())$choices %||% data.frame()
  raw_names <- as.character(raw_names %||% character(0))
  expected <- as.character(expected %||% character(0))
  missing_variables <- as.character(missing_variables %||% character(0))
  metadata_columns <- as.character(metadata_columns %||% character(0))
  aliases <- normalized_attr$aliases %||% character(0)
  collapses <- normalized_attr$single_child_collapses %||% character(0)
  select_multiple <- normalized_attr$select_multiple %||% list()
  dropped <- as.character(normalized_attr$dropped_columns %||% character(0))
  recoded <- normalized_attr$select_one_other_recodes %||% character(0)
  choice_maps <- .dn_choice_code_maps_named(normalized_attr$choice_code_maps %||% list())
  label_col <- .sm_sav_review_label_column(survey)
  type_base <- .dn_survey_type_base(survey)
  survey_names <- .dn_survey_names(survey)
  variables <- list()

  for (variable in expected) {
    row_index <- match(variable, survey_names)
    row <- if (is.na(row_index)) data.frame() else survey[row_index, , drop = FALSE]
    multi_sources <- select_multiple[[variable]] %||% character(0)
    collapse_source <- if (variable %in% names(collapses)) collapses[[variable]] else character(0)
    source_targets <- if (length(multi_sources)) {
      multi_sources
    } else if (length(collapse_source)) {
      collapse_source
    } else if (variable %in% names(aliases)) {
      variable
    } else if (variable %in% raw_names) {
      variable
    } else {
      character(0)
    }
    source_columns <- .sm_sav_review_source_columns(source_targets, aliases, raw_names)
    operations <- character(0)
    if (variable %in% raw_names && !length(multi_sources) && !length(collapse_source)) {
      operations <- c(operations, "direct")
    }
    alias_targets <- unique(c(variable, as.character(multi_sources), as.character(collapse_source)))
    if (any(alias_targets %in% names(aliases))) operations <- c(operations, "rename_source")
    if (length(collapse_source)) operations <- c(operations, "collapse_single_child")
    variable_map <- choice_maps[[variable]] %||% NULL
    was_recoded <- variable %in% names(recoded)
    map_type <- .sm_sav_review_value((variable_map %||% list())$type, "")
    recoded_sources <- if (was_recoded) {
      strsplit(.sm_sav_review_value(recoded[[variable]], ""), ",", fixed = TRUE)[[1]]
    } else {
      character(0)
    }
    map_items <- .dn_choice_map_items(variable_map %||% list())
    map_sources <- vapply(map_items, function(item) {
      source <- .sm_sav_review_value(item$source_code, "")
      target <- .sm_sav_review_value(item$xls_code, "")
      if (nzchar(source) && nzchar(target) && !identical(source, target)) source else ""
    }, character(1))
    map_sources <- map_sources[nzchar(map_sources)]
    map_recode <- !is.null(variable_map) && (
      identical(map_type, "select_multiple") || any(recoded_sources %in% map_sources)
    )
    if (map_recode) operations <- c(operations, "recode_choice_map")
    recode_other_zero <- "0" %in% recoded_sources && !("0" %in% map_sources)
    if (recode_other_zero) operations <- c(operations, "recode_other_zero")
    if (length(multi_sources)) operations <- c(operations, "rebuild_select_multiple")
    if (length(multi_sources) && any(as.character(multi_sources) %in% dropped)) {
      operations <- c(operations, "drop_source_dummies")
    }
    if (variable %in% missing_variables) operations <- c(operations, "fill_blank")
    operations <- unique(operations)
    status <- if (variable %in% missing_variables) {
      "warning"
    } else if (length(setdiff(operations, "direct"))) {
      "transformed"
    } else {
      "unchanged"
    }
    xlsform <- if (is.na(row_index)) NULL else list(
      name = variable,
      label = if (is.na(label_col)) variable else .sm_sav_review_value(survey[[label_col]][[row_index]], variable),
      type = .sm_sav_review_value(survey$type[[row_index]], ""),
      type_base = .sm_sav_review_value(type_base[[row_index]], ""),
      list_name = {
        value <- .dn_survey_list_name(row)
        if (is.na(value)) "" else value
      }
    )
    variables[[length(variables) + 1L]] <- list(
      variable = variable,
      source_columns = as.list(source_columns),
      status = status,
      operations = as.list(operations),
      xlsform = xlsform,
      catalog = if (is.null(xlsform) || !xlsform$type_base %in% c("select_one", "select_multiple")) {
        NULL
      } else {
        .sm_sav_review_catalog(row, choices, variable_map, source_columns, recode_other_zero)
      }
    )
  }

  used_sources <- unique(c(
    unlist(lapply(variables, function(item) item$source_columns), use.names = FALSE),
    intersect(raw_names, expected)
  ))
  source_only <- setdiff(raw_names, used_sources)
  for (variable in source_only) {
    is_metadata <- variable %in% metadata_columns
    variables[[length(variables) + 1L]] <- list(
      variable = variable,
      source_columns = as.list(variable),
      status = "source_only",
      operations = as.list(if (is_metadata) "preserve_metadata" else "preserve_extra"),
      xlsform = NULL,
      catalog = NULL
    )
  }

  metadata_source_only <- intersect(source_only, metadata_columns)
  extra_source_only <- setdiff(source_only, metadata_source_only)
  alerts <- list()
  add_alert <- function(code, severity, vars, message) {
    if (!length(vars)) return(invisible(NULL))
    alerts[[length(alerts) + 1L]] <<- list(
      code = code,
      severity = severity,
      count = as.integer(length(vars)),
      variables = as.list(vars),
      message = message
    )
    invisible(NULL)
  }
  add_alert(
    "missing_expected_columns", "warning", missing_variables,
    "Hay variables del XLSForm ausentes en el SAV; se completarán vacías."
  )
  add_alert(
    "preserved_metadata_columns", "info", metadata_source_only,
    "La metadata del SAV se preservará como columnas fuente adicionales."
  )
  add_alert(
    "preserved_extra_columns", "info", extra_source_only,
    "Las columnas fuente sin variable XLSForm se preservarán como extras."
  )

  statuses <- c("unchanged", "transformed", "warning", "source_only")
  status_values <- vapply(variables, function(item) item$status, character(1))
  status_counts <- stats::setNames(
    lapply(statuses, function(status) as.integer(sum(status_values == status))),
    statuses
  )
  operation_names <- c(
    "direct", "rename_source", "collapse_single_child", "recode_choice_map",
    "recode_other_zero", "rebuild_select_multiple", "drop_source_dummies",
    "fill_blank", "preserve_metadata", "preserve_extra"
  )
  operation_values <- unlist(lapply(variables, function(item) item$operations), use.names = FALSE)
  operation_counts <- stats::setNames(
    lapply(operation_names, function(operation) as.integer(sum(operation_values == operation))),
    operation_names
  )
  payload <- list(
    schema = "surveymonkey_sav_variable_review/v1",
    # El stage de reconciliación canónica (.dn_reconcile_canonical_names) es
    # ADITIVO al normalizador: es no-op sobre data ya bien calzada y sólo actúa
    # sobre mismatches de nombre (CamelCase/acentos de SM, dedup `_NNN` de Kobo).
    # Por eso el contrato NO sube a /v2 — esa decisión la toma el lead/usuario.
    normalizer_contract = "normalize_data_for_xlsform/v1",
    privacy = list(
      response_values_included = FALSE,
      direct_identifier_values_included = FALSE,
      free_text_values_included = FALSE,
      schema_names_included = TRUE,
      xlsform_labels_included = TRUE,
      choice_catalog_included = TRUE
    ),
    summary = list(
      total_variables = as.integer(length(variables)),
      expected_variables = as.integer(length(expected)),
      source_only_variables = as.integer(length(source_only)),
      status_counts = status_counts,
      operation_counts = operation_counts,
      alerts = as.integer(length(alerts))
    ),
    alerts = alerts,
    variables = variables
  )
  list(
    schema = payload$schema,
    normalizer_contract = payload$normalizer_contract,
    fingerprint = .processing_release_hash(payload),
    privacy = payload$privacy,
    summary = payload$summary,
    alerts = payload$alerts,
    variables = payload$variables
  )
}

.sm_sav_choice_domain_issues <- function(data, inst) {
  survey <- (inst %||% list())$survey %||% data.frame()
  choices <- (inst %||% list())$choices %||% data.frame()
  if (!is.data.frame(data) || !is.data.frame(survey) || !nrow(survey) ||
      !is.data.frame(choices) || !nrow(choices) ||
      !all(c("type", "name") %in% names(survey)) ||
      !all(c("list_name", "name") %in% names(choices))) {
    return(list())
  }

  issues <- list()
  for (i in seq_len(nrow(survey))) {
    type <- trimws(as.character(survey$type[[i]] %||% ""))
    kind <- if (grepl("^select_one\\b", type, perl = TRUE)) {
      "select_one"
    } else if (grepl("^select_multiple\\b", type, perl = TRUE)) {
      "select_multiple"
    } else {
      ""
    }
    if (!nzchar(kind)) next
    variable <- trimws(as.character(survey$name[[i]] %||% ""))
    if (!nzchar(variable) || !(variable %in% names(data))) next
    # `reporte_instrumento` mueve el nombre de la lista a su propia columna
    # `list_name` (el `type` queda como "select_one" a secas); un XLSForm crudo
    # la deja embebida en el `type` ("select_one sexo"). Preferir la columna
    # dedicada cuando existe y sólo parsear el `type` como fallback.
    list_name <- if ("list_name" %in% names(survey)) {
      trimws(as.character(survey$list_name[[i]] %||% ""))
    } else ""
    if (!nzchar(list_name)) {
      list_name <- sub("^(select_one|select_multiple)\\s+", "", type, perl = TRUE)
      list_name <- strsplit(list_name, "\\s+", perl = TRUE)[[1]][1] %||% ""
    }
    allowed <- unique(trimws(as.character(
      choices$name[as.character(choices$list_name) == list_name]
    )))
    allowed <- allowed[!is.na(allowed) & nzchar(allowed)]
    if (!length(allowed)) next

    observed <- trimws(as.character(data[[variable]]))
    observed <- observed[!is.na(observed) & nzchar(observed)]
    tokens <- if (identical(kind, "select_multiple")) {
      unlist(strsplit(observed, "\\s+", perl = TRUE), use.names = FALSE)
    } else {
      observed
    }
    unknown <- sort(unique(tokens[nzchar(tokens) & !(tokens %in% allowed)]))
    if (!length(unknown)) next
    issues[[length(issues) + 1L]] <- list(
      variable = variable,
      type = kind,
      list_name = list_name,
      values = as.list(unknown)
    )
  }
  issues
}

.sm_sav_instrument_context <- function(s, base_name) {
  base <- ((s$estudio %||% list())$bases %||% list())[[base_name]] %||% NULL
  if (is.null(base)) {
    return(list(
      ok = FALSE,
      file = NULL,
      revision = NULL,
      warnings = sprintf("La base '%s' ya no existe.", base_name),
      audit = list(status = "blocked", healthy = FALSE, reasons = as.list("base_not_found"))
    ))
  }

  current_xlsform_file_id <- .sm_mb_scalar(base$xlsform_file_id, "")
  original_xlsform_file_id <- .sm_mb_scalar(base$original_xlsform_file_id, "")
  revision_id <- .sm_mb_scalar(base$instrument_revision_id, "")
  if (!nzchar(revision_id)) {
    requires_certification <- identical(
      .sm_mb_scalar((s$estudio %||% list())$processing_mode, "multibase"),
      "independent_siblings"
    )
    warning <- if (requires_certification) {
      sprintf(
        "La base hermana '%s' no acredita instrument_revision_id publicado; la inspección SAV queda bloqueada.",
        base_name
      )
    } else {
      sprintf(
        "La base legacy '%s' no acredita instrument_revision_id; se normaliza contra su XLSForm actual como flujo no certificable.",
        base_name
      )
    }
    return(list(
      ok = !requires_certification && nzchar(current_xlsform_file_id),
      file = (s$files %||% list())[[current_xlsform_file_id]] %||% NULL,
      revision = NULL,
      warnings = warning,
      audit = list(
        status = if (requires_certification) "blocked" else "legacy_unpinned",
        healthy = FALSE,
        certifiable = FALSE,
        revision_id = "",
        revision_hash = "",
        base_xlsform_file_id = current_xlsform_file_id,
        base_current_xlsform_file_id = current_xlsform_file_id,
        base_original_xlsform_file_id = original_xlsform_file_id,
        revision_xlsform_file_id = "",
        reasons = as.list("instrument_revision_id_missing"),
        warning = warning
      )
    ))
  }

  health <- .processing_intake_revision_health(s, revision_id)
  revision <- health$revision %||% list()
  revision_file_id <- .sm_mb_scalar(revision$xlsform_file_id, "")
  revision_hash <- .sm_mb_scalar(revision$content_sha256, "")
  revision_choice_maps <- revision$choice_code_maps %||% list()
  if (!is.list(revision_choice_maps)) revision_choice_maps <- list()
  revision_choice_maps_hash <- .sm_mb_scalar(
    revision$choice_code_maps_sha256 %||%
      (revision$logic_audit %||% list())$choice_code_maps_sha256,
    ""
  )
  observed_choice_maps_hash <- .xlsform_editor_sm_hash(revision_choice_maps)
  base_hash <- .sm_mb_scalar(base$instrument_revision_hash, "")
  current_matches_revision <- identical(current_xlsform_file_id, revision_file_id)
  original_matches_revision <- nzchar(original_xlsform_file_id) &&
    identical(original_xlsform_file_id, revision_file_id)
  reasons <- character(0)
  if (!isTRUE(health$ok)) {
    health_reasons <- vapply(health$reasons %||% list(), function(item) {
      .sm_mb_scalar(item$message %||% item$code, "revisión no saludable")
    }, character(1))
    reasons <- c(reasons, health_reasons)
  }
  if (!nzchar(.sm_mb_scalar(revision$published_at, ""))) {
    reasons <- c(reasons, "La revisión referenciada no acredita publicación.")
  }
  if (!current_matches_revision && !original_matches_revision) {
    reasons <- c(
      reasons,
      "Ni el xlsform_file_id actual ni original_xlsform_file_id coinciden con el snapshot de la revisión publicada."
    )
  }
  if (!identical(base_hash, revision_hash)) {
    reasons <- c(reasons, "El instrument_revision_hash de la base no coincide con la revisión publicada.")
  }
  if (length(revision_choice_maps) && !nzchar(revision_choice_maps_hash)) {
    reasons <- c(reasons, "La revisión contiene mapas de códigos sin una huella verificable.")
  }
  if (nzchar(revision_choice_maps_hash) &&
      !identical(revision_choice_maps_hash, observed_choice_maps_hash)) {
    reasons <- c(reasons, "La huella de los mapas de códigos no coincide con la revisión publicada.")
  }
  reasons <- unique(reasons[nzchar(reasons)])
  ok <- !length(reasons)
  warnings <- if (ok) character(0) else sprintf(
    "La base '%s' no acredita su revisión publicada: %s",
    base_name,
    paste(reasons, collapse = " ")
  )
  list(
    ok = ok,
    file = health$file %||% NULL,
    revision = revision,
    warnings = warnings,
    audit = list(
      status = if (ok) "pinned_healthy" else "blocked",
      healthy = isTRUE(health$ok),
      certifiable = isTRUE(ok),
      revision_id = revision_id,
      revision_hash = revision_hash,
      choice_code_maps_sha256 = revision_choice_maps_hash,
      base_revision_hash = base_hash,
      base_xlsform_file_id = current_xlsform_file_id,
      base_current_xlsform_file_id = current_xlsform_file_id,
      base_original_xlsform_file_id = original_xlsform_file_id,
      revision_xlsform_file_id = revision_file_id,
      xlsform_match_source = if (current_matches_revision) {
        "current"
      } else if (original_matches_revision) {
        "original"
      } else {
        ""
      },
      reasons = as.list(reasons)
    )
  )
}

.sm_sav_convert_entry_data <- function(df, inst, base_name, base_meta, entry_name,
                                       missing_policy = "fill_blank_warn",
                                       choice_code_maps = NULL,
                                       choice_code_maps_certification = list()) {
  df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  raw_names <- names(df)
  expected <- .sm_sav_expected_variables(inst)
  normalized <- normalize_data_for_xlsform(
    df,
    inst,
    choice_code_maps = choice_code_maps
  )
  normalized_attr <- attr(normalized, "xlsform_normalized", exact = TRUE) %||% list()
  applied_choice_maps <- normalized_attr$choice_code_maps %||% list()
  if (!is.list(applied_choice_maps)) applied_choice_maps <- list()
  applied_choice_maps_named <- .dn_choice_code_maps_named(applied_choice_maps)
  sealed_choice_maps <- choice_code_maps %||% list()
  if (!is.list(sealed_choice_maps)) sealed_choice_maps <- list()
  sealed_choice_maps_named <- .dn_choice_code_maps_named(sealed_choice_maps)
  unsealed_variables <- setdiff(
    names(applied_choice_maps_named),
    names(sealed_choice_maps_named)
  )
  certified_maps <- isTRUE(choice_code_maps_certification$certified)
  if (certified_maps && length(unsealed_variables)) {
    stop_api(
      409,
      "E_SM_SAV_UNSEALED_CHOICE_MAP",
      sprintf(
        "El archivo '%s' requiere mapas de códigos que no están sellados en la revisión publicada.",
        .sm_sav_display_name(entry_name)
      ),
      details = list(
        variables = as.list(sort(unsealed_variables)),
        sealed_sha256 = .sm_mb_scalar(choice_code_maps_certification$sealed_sha256, ""),
        observed_sha256 = .xlsform_editor_sm_hash(applied_choice_maps)
      )
    )
  }
  choice_maps_origin <- if (!length(applied_choice_maps_named)) {
    "none"
  } else if (certified_maps) {
    "published_revision"
  } else {
    "inferred_legacy"
  }

  mapped_vars <- intersect(expected, names(normalized))
  missing_variables <- setdiff(expected, mapped_vars)
  if (length(missing_variables)) {
    if (!identical(.sm_mb_scalar(missing_policy, "fill_blank_warn"), "fill_blank_warn")) {
      stop_api(409, "E_SM_SAV_MISSING_VARIABLES", sprintf(
        "El archivo '%s' no trae variables esperadas: %s",
        .sm_sav_display_name(entry_name),
        paste(utils::head(missing_variables, 20L), collapse = ", ")
      ))
    }
    for (var in missing_variables) normalized[[var]] <- NA_character_
  }

  metadata_columns <- intersect(.sm_sav_metadata_columns(df), names(normalized))
  all_empty_variables <- mapped_vars[vapply(mapped_vars, function(var) {
    values <- normalized[[var]]
    all(is.na(values) | !nzchar(trimws(as.character(values))))
  }, logical(1))]

  if (!"response_id" %in% names(normalized) && "respondent_id" %in% names(normalized)) {
    normalized$response_id <- as.character(normalized$respondent_id)
  }
  if (!"respondent_id" %in% names(normalized) && "response_id" %in% names(normalized)) {
    normalized$respondent_id <- as.character(normalized$response_id)
  }
  if (!"response_id" %in% names(normalized)) normalized$response_id <- as.character(seq_len(nrow(normalized)))
  if (!"respondent_id" %in% names(normalized)) normalized$respondent_id <- normalized$response_id
  if (!"response_status" %in% names(normalized)) normalized$response_status <- rep("completed", nrow(normalized))

  choice_domain_issues <- .sm_sav_choice_domain_issues(normalized, inst)
  if (length(choice_domain_issues)) {
    stop_api(
      409,
      "E_SM_SAV_UNKNOWN_CHOICE_CODES",
      sprintf(
        "El archivo '%s' contiene códigos que no pertenecen al catálogo del XLSForm publicado.",
        .sm_sav_display_name(entry_name)
      ),
      details = list(variables = choice_domain_issues)
    )
  }

  survey_id <- .sm_mb_scalar(base_meta$survey_id %||% base_name, base_name)
  normalized$survey_id <- survey_id
  normalized$source_title <- .sm_mb_scalar(base_meta$source_title %||% base_meta$source_alias %||% base_name, base_name)
  normalized$source_channel <- "sav_zip_offline"
  normalized$case_uid <- paste(survey_id, as.character(normalized$response_id %||% seq_len(nrow(normalized))), sep = ":")

  preferred <- unique(c(
    "survey_id", "response_id", "respondent_id", "case_uid", "response_status",
    "date_created", "date_modified", "collector_id", "collector_type",
    "collection_mode", "ip_address", "total_time", "email_address", "first_name",
    "last_name", "cv_id", "custom_value", "source_title", "source_channel",
    expected
  ))
  normalized <- normalized[, c(intersect(preferred, names(normalized)), setdiff(names(normalized), preferred)), drop = FALSE]
  compatibility <- validate_data_xlsform_compatibility(normalized, inst)

  warnings <- character(0)
  if (length(missing_variables)) {
    warnings <- c(warnings, sprintf(
      "El archivo '%s' no trae %d variables esperadas; se completaron vacías.",
      .sm_sav_display_name(entry_name),
      length(missing_variables)
    ))
  }
  if (length(all_empty_variables)) {
    warnings <- c(warnings, sprintf(
      "El archivo '%s' tiene %d variables esperadas presentes pero completamente vacías.",
      .sm_sav_display_name(entry_name),
      length(all_empty_variables)
    ))
  }

  normalization_review <- .sm_sav_normalization_review(
    raw_names = raw_names,
    inst = inst,
    normalized_attr = normalized_attr,
    expected = expected,
    missing_variables = missing_variables,
    metadata_columns = metadata_columns
  )

  audit <- list(
    file_name = .sm_mb_scalar(.sm_sav_display_name(entry_name), ""),
    entry_name = .sm_mb_scalar(.sm_sav_safe_text(entry_name), ""),
    base_name = .sm_mb_scalar(base_name, ""),
    n_rows = as.integer(nrow(df)),
    n_columns = as.integer(ncol(df)),
    n_output_columns = as.integer(ncol(normalized)),
    expected_variables = as.integer(length(expected)),
    matched_variables = as.integer(length(mapped_vars)),
    mapped_variables = as.list(mapped_vars),
    missing_variables = as.list(missing_variables),
    blank_filled_variables = as.list(missing_variables),
    all_empty_variables = as.list(all_empty_variables),
    metadata_columns = as.list(metadata_columns),
    raw_columns = as.list(raw_names),
    aliases = as.list(unname(normalized_attr$aliases %||% character(0))),
    select_multiple = normalized_attr$select_multiple %||% list(),
    single_child_collapses = as.list(unname(normalized_attr$single_child_collapses %||% character(0))),
    select_one_other_recodes = as.list(normalized_attr$select_one_other_recodes %||% character(0)),
    choice_code_maps = list(
      origin = choice_maps_origin,
      sha256 = .xlsform_editor_sm_hash(applied_choice_maps),
      sealed_sha256 = .sm_mb_scalar(choice_code_maps_certification$sealed_sha256, ""),
      maps = unname(applied_choice_maps_named)
    ),
    dropped_columns = as.list(unname(normalized_attr$dropped_columns %||% character(0))),
    compatibility = unclass(compatibility),
    warnings = as.list(warnings)
  )

  list(data = normalized, audit = audit, normalization_review = normalization_review)
}

.sm_sav_change_plan <- function(base, entry_name, audit) {
  current_rows <- suppressWarnings(as.integer(base$n_filas %||% NA_integer_))
  current_cols <- suppressWarnings(as.integer(base$n_columnas %||% NA_integer_))
  incoming_rows <- as.integer(audit$n_rows %||% 0L)
  incoming_cols <- as.integer(audit$n_output_columns %||% 0L)
  list(
    action = "replace_data",
    base_name = .sm_mb_scalar(base$nombre, ""),
    source_file = .sm_mb_scalar(.sm_sav_display_name(entry_name), ""),
    current = list(
      n_rows = current_rows,
      n_columns = current_cols,
      data_file_id = .sm_mb_scalar(base$data_file_id, ""),
      xlsform_file_id = .sm_mb_scalar(base$xlsform_file_id, "")
    ),
    incoming = list(
      raw_rows = incoming_rows,
      raw_columns = as.integer(audit$n_columns %||% 0L),
      normalized_rows = incoming_rows,
      normalized_columns = incoming_cols
    ),
    impact = list(
      rows_delta = if (is.na(current_rows)) NA_integer_ else as.integer(incoming_rows - current_rows),
      columns_delta = if (is.na(current_cols)) NA_integer_ else as.integer(incoming_cols - current_cols),
      expected_variables = as.integer(audit$expected_variables %||% 0L),
      matched_variables = as.integer(audit$matched_variables %||% 0L),
      missing_variables = audit$missing_variables %||% list(),
      blank_filled_variables = audit$blank_filled_variables %||% list(),
      all_empty_variables = audit$all_empty_variables %||% list(),
      metadata_columns = audit$metadata_columns %||% list()
    ),
    effects = list(
      xlsform = "preserved",
      data = "replaced",
      invalidates = as.list(c("validacion", "analitica", "codificacion", "graficos"))
    )
  )
}

.sm_sav_plan_pins <- function(s, base_name, instrument_context = list()) {
  base <- ((s$estudio %||% list())$bases %||% list())[[base_name]] %||% list()
  xlsform_file_id <- .sm_mb_scalar(base$xlsform_file_id, "")
  original_xlsform_file_id <- .sm_mb_scalar(base$original_xlsform_file_id, "")
  revision_xlsform_file_id <- .sm_mb_scalar(
    (instrument_context$revision %||% list())$xlsform_file_id,
    ""
  )
  list(
    base = list(
      base_name = .sm_mb_scalar(base_name, ""),
      data_file_id = .sm_mb_scalar(base$data_file_id, ""),
      xlsform_file_id = xlsform_file_id,
      original_xlsform_file_id = original_xlsform_file_id,
      instrument_revision_id = .sm_mb_scalar(base$instrument_revision_id, ""),
      instrument_revision_hash = .sm_mb_scalar(base$instrument_revision_hash, ""),
      n_rows = suppressWarnings(as.integer(base$n_filas %||% NA_integer_)),
      n_columns = suppressWarnings(as.integer(base$n_columnas %||% NA_integer_)),
      survey_id = .sm_mb_scalar(base$survey_id %||% base_name, ""),
      source_alias = .sm_mb_scalar(base$source_alias %||% base_name, ""),
      source_title = .sm_mb_scalar(base$source_title %||% base$source_alias %||% base_name, "")
    ),
    instrument_revision = instrument_context$audit %||% list(),
    xlsform = .processing_release_file_pin(s, xlsform_file_id),
    xlsform_current = .processing_release_file_pin(s, xlsform_file_id),
    xlsform_original = .processing_release_file_pin(s, original_xlsform_file_id),
    xlsform_revision = .processing_release_file_pin(s, revision_xlsform_file_id)
  )
}

.sm_sav_inspection_fingerprint <- function(inspection) {
  files <- inspection$files %||% list()
  if (length(files)) {
    entry_names <- vapply(files, function(item) .sm_mb_scalar(item$entry_name, ""), character(1))
    files <- files[order(entry_names)]
  }
  plan_files <- unname(lapply(files, function(item) list(
    entry_name = .sm_mb_scalar(item$entry_name, ""),
    base_name = .sm_mb_scalar(item$base_name, ""),
    matched = isTRUE(item$matched),
    blocking = isTRUE(item$blocking),
    action = .sm_mb_scalar(item$action, ""),
    change_plan = item$change_plan %||% list(),
    pins = item$pins %||% list(),
    normalization_review_fingerprint = .sm_mb_scalar(
      (item$normalization_review %||% list())$fingerprint,
      ""
    )
  )))
  .processing_release_hash(list(
    schema = "surveymonkey_sav_bundle_inspection/v2",
    bundle = inspection$bundle_pin %||% list(),
    missing_required_policy = .sm_mb_scalar(inspection$missing_required_policy, ""),
    file_base_map = inspection$resolved_file_base_map %||% list(),
    files = plan_files
  ))
}

.sm_sav_assert_inspection_fingerprint <- function(expected, current) {
  expected <- .sm_mb_scalar(expected, "")
  if (!nzchar(expected) || !identical(expected, .sm_mb_scalar(current, ""))) {
    stop_api(
      409,
      "E_SM_SAV_STALE",
      "El plan inspeccionado cambió o no fue acreditado; vuelve a inspeccionar el ZIP SAV."
    )
  }
  invisible(TRUE)
}

.sm_sav_response_filter <- function(entry_name, base_name, audit) {
  list(
    kind = "surveymonkey_sav_bundle_response_filter",
    file_name = .sm_mb_scalar(.sm_sav_display_name(entry_name), ""),
    entry_name = .sm_mb_scalar(.sm_sav_safe_text(entry_name), ""),
    base_name = .sm_mb_scalar(base_name, ""),
    original_rows = as.integer(audit$n_rows %||% 0L),
    kept_rows = as.integer(audit$n_rows %||% 0L),
    excluded_rows = 0L,
    missing_variables = audit$missing_variables %||% list(),
    all_empty_variables = audit$all_empty_variables %||% list()
  )
}

.sm_sav_snapshot_raw <- function(base_name, bundle_file_id, entry_name, audit, change_plan,
                                 source_spec = list(), policy = list(), created_at = NULL,
                                 prior_import_history = list()) {
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    stop_api(500, "E_NO_JSONLITE", "Se requiere jsonlite para auditar la importación SAV.")
  }
  payload <- list(
    version = "surveymonkey_sav_bundle_snapshot/1",
    created_at = .sm_mb_scalar(created_at, format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")),
    base_name = .sm_mb_scalar(base_name, ""),
    bundle_file_id = .sm_mb_scalar(bundle_file_id, ""),
    entry_name = .sm_mb_scalar(.sm_sav_safe_text(entry_name), ""),
    source_spec = source_spec %||% list(),
    missing_required_policy = .sm_mb_scalar(policy$missing_required_policy %||% "fill_blank_warn", "fill_blank_warn"),
    audit = audit %||% list(),
    change_plan = change_plan %||% list(),
    prior_import_history = prior_import_history %||% list()
  )
  json <- jsonlite::toJSON(payload, auto_unbox = TRUE, null = "null", pretty = FALSE)
  charToRaw(enc2utf8(as.character(json)))
}

.sm_sav_compact_import_history <- function(base, limit = 20L) {
  base <- base %||% list()
  history <- base$surveymonkey_sav_bundle_history %||% list()
  if (!is.list(history)) history <- list()
  previous <- base$surveymonkey_sav_bundle_import %||% list()
  bundle_file_id <- .sm_mb_scalar(previous$bundle_file_id, "")
  if (nzchar(bundle_file_id)) {
    revision <- previous$instrument_revision %||% list()
    record <- list(
      bundle_file_id = bundle_file_id,
      snapshot_file_id = .sm_mb_scalar(previous$snapshot_file_id, ""),
      data_file_id = .sm_mb_scalar(
        previous$data_file_id %||%
          base$surveymonkey_effective_data_file_id %||%
          base$original_data_file_id,
        ""
      ),
      imported_at = .sm_mb_scalar(previous$imported_at, ""),
      file_name = .sm_mb_scalar(previous$file_name, ""),
      entry_name = .sm_mb_scalar(previous$entry_name, ""),
      instrument_revision_id = .sm_mb_scalar(revision$revision_id, "")
    )
    same_record <- vapply(history, function(item) {
      identical(.sm_mb_scalar((item %||% list())$bundle_file_id, ""), record$bundle_file_id) &&
        identical(.sm_mb_scalar((item %||% list())$snapshot_file_id, ""), record$snapshot_file_id) &&
        identical(.sm_mb_scalar((item %||% list())$data_file_id, ""), record$data_file_id)
    }, logical(1))
    if (!any(same_record)) history[[length(history) + 1L]] <- record
  }
  limit <- max(1L, suppressWarnings(as.integer(limit %||% 20L)))
  if (length(history) > limit) history <- utils::tail(history, limit)
  unname(history)
}

.sm_sav_state_with_base_import <- function(s, prepared, data_meta, snapshot_meta, imported_at) {
  base_name <- prepared$base_name
  entry_name <- prepared$entry_name
  bundle_file_id <- prepared$bundle_file_id
  rp_inst <- prepared$inst
  rp_data <- prepared$rp_data
  audit <- prepared$audit
  change_plan <- prepared$change_plan
  source_spec <- prepared$source_spec
  response_filter <- prepared$response_filter
  base <- s$estudio$bases[[base_name]]
  if (is.null(base)) stop_api(404, "E_BASE_NOT_FOUND", sprintf("Base '%s' no existe.", base_name))
  previous_data_file_id <- .sm_mb_scalar(base$data_file_id, "")
  previous_data_ext <- .sm_mb_scalar(base$data_ext, "")
  previous_original_data_file_id <- .sm_mb_scalar(base$original_data_file_id, "")
  previous_raw_snapshot_file_id <- .sm_mb_scalar(
    base$surveymonkey_raw_snapshot_file_id,
    ""
  )
  prior_import_history <- .sm_sav_compact_import_history(base)
  if (is.null(base$original_xlsform_file_id) || !nzchar(as.character(base$original_xlsform_file_id))) {
    base$original_xlsform_file_id <- base$xlsform_file_id
  }
  # El SAV importado pasa a ser la fuente original vigente. Los IDs previos
  # quedan solo como linaje historico; si se conservan en original_data_file_id,
  # Codificacion y Analitica volverian silenciosamente a la base reemplazada.
  base$original_data_file_id <- data_meta$file_id
  base$original_data_ext <- data_meta$ext
  base$data_file_id <- data_meta$file_id
  base$data_ext <- data_meta$ext
  base$n_filas <- as.integer(nrow(rp_data))
  base$n_columnas <- as.integer(ncol(rp_data))
  base$source_kind <- "surveymonkey_sav_bundle"
  base$survey_id <- .sm_mb_scalar(source_spec$survey_id %||% base$survey_id %||% base_name, "")
  base$source_alias <- .sm_mb_scalar(source_spec$source_alias %||% base$source_alias %||% base_name, base_name)
  base$source_title <- .sm_mb_scalar(source_spec$source_title %||% base$source_title %||% base$source_alias %||% base_name, "")
  base$source_channel <- .sm_mb_scalar(source_spec$source_channel, "sav_zip_offline")
  base$response_filter <- response_filter
  base$surveymonkey_source_spec <- source_spec
  base$surveymonkey_sav_bundle_file_id <- .sm_mb_scalar(bundle_file_id, "")
  base$surveymonkey_sav_bundle_snapshot_file_id <- .sm_mb_scalar(snapshot_meta$file_id, "")
  base$surveymonkey_effective_data_file_id <- .sm_mb_scalar(data_meta$file_id, "")
  base$surveymonkey_sav_bundle_history <- prior_import_history
  # El snapshot remoto y su auditoría describen la extracción API anterior.
  # Si quedan activos, la exportación analítica unificada los prioriza sobre el
  # SAV recién importado y reconstruye silenciosamente la base vieja.
  base$surveymonkey_raw_snapshot_file_id <- NULL
  base$surveymonkey_decision_audit <- response_filter
  base$surveymonkey_sav_bundle_import <- list(
    version = 1L,
    imported_at = imported_at,
    bundle_file_id = .sm_mb_scalar(bundle_file_id, ""),
    snapshot_file_id = .sm_mb_scalar(snapshot_meta$file_id, ""),
    data_file_id = .sm_mb_scalar(data_meta$file_id, ""),
    file_name = .sm_mb_scalar(.sm_sav_display_name(entry_name), ""),
    entry_name = .sm_mb_scalar(.sm_sav_safe_text(entry_name), ""),
    n_rows = as.integer(nrow(rp_data)),
    n_columns = as.integer(ncol(rp_data)),
    previous_data_file_id = previous_data_file_id,
    previous_data_ext = previous_data_ext,
    previous_original_data_file_id = previous_original_data_file_id,
    lineage = list(
      previous_data_file_id = previous_data_file_id,
      previous_data_ext = previous_data_ext,
      previous_original_data_file_id = previous_original_data_file_id,
      previous_raw_snapshot_file_id = previous_raw_snapshot_file_id,
      imported_original_data_file_id = .sm_mb_scalar(data_meta$file_id, "")
    ),
    warnings = audit$warnings %||% list(),
    missing_variables = audit$missing_variables %||% list(),
    all_empty_variables = audit$all_empty_variables %||% list(),
    choice_code_maps = audit$choice_code_maps %||% list(
      origin = "none",
      sha256 = .xlsform_editor_sm_hash(list()),
      maps = list()
    ),
    select_one_other_recodes = audit$select_one_other_recodes %||% list(),
    instrument_revision = audit$instrument_revision %||% list(),
    history = prior_import_history,
    change_plan = change_plan
  )
  base$surveymonkey_refreshed_at <- base$surveymonkey_sav_bundle_import$imported_at
  base$surveymonkey_last_refresh <- list(
    refreshed_at = base$surveymonkey_refreshed_at,
    n_new = as.integer(nrow(rp_data)),
    source_count = 1L,
    sav_bundle_import = TRUE,
    file_name = .sm_mb_scalar(.sm_sav_display_name(entry_name), "")
  )
  s$estudio$bases[[base_name]] <- base
  s$rp_inst_sources[[base_name]] <- rp_inst
  s$rp_data_sources[[base_name]] <- rp_data
  if (!is.null(s$codif_por_base) && !is.null(s$codif_por_base[[base_name]])) {
    s$codif_por_base[[base_name]]$inst <- NULL
    s$codif_por_base[[base_name]]$data <- NULL
  }
  s <- .invalidate_processing_state(s, base_name)
  s
}

.sm_sav_prepare_bundle <- function(sid, file_id, file_base_map = list(), missing_policy = "fill_blank_warn") {
  s <- .sm_sav_require_session_project(sid)
  missing_policy <- .sm_sav_missing_policy(missing_policy)
  file_id <- .sm_mb_scalar(file_id, "")
  if (!nzchar(file_id)) stop_api(400, "E_SM_SAV_FILE_REQUIRED", "Debes subir un archivo .sav o un ZIP con archivos .sav.")
  meta <- get_file(sid, file_id)
  ext <- tolower(meta$ext %||% tools::file_ext(meta$path))
  if (!(ext %in% c("sav", "zip"))) {
    stop_api(400, "E_SM_SAV_FILE_UNSUPPORTED", "El archivo debe ser .sav o .zip.")
  }
  entries <- .sm_sav_source_entries(meta)
  if (!nrow(entries)) stop_api(400, "E_SM_SAV_EMPTY_ZIP", "El archivo no contiene respuestas .sav.")

  explicit_map <- .sm_sav_file_base_map(file_base_map)
  rows <- list()
  warnings <- character(0)
  blocking <- character(0)
  used_bases <- character(0)
  prepared <- list()

  for (i in seq_len(nrow(entries))) {
    entry_name <- .sm_mb_scalar(entries$filename[i], "")
    entry_name_safe <- .sm_mb_scalar(.sm_sav_safe_text(entry_name), "")
    entry_display <- .sm_mb_scalar(.sm_sav_display_name(entry_name), "")
    base_name <- .sm_sav_match_entry_to_base(entry_name, s$estudio$bases, explicit_map)
    item <- list(
      file_name = entry_display,
      entry_name = entry_name_safe,
      base_name = if (nzchar(base_name)) base_name else NA_character_,
      matched = nzchar(base_name),
      blocking = !nzchar(base_name),
      action = "replace_data",
      n_rows = 0L,
      n_columns = 0L,
      n_output_columns = 0L,
      expected_variables = 0L,
      matched_variables = 0L,
      missing_variables = list(),
      blank_filled_variables = list(),
      all_empty_variables = list(),
      metadata_columns = list(),
      normalization_review = NULL,
      instrument_revision = list(),
      pins = list(),
      warnings = list(),
      change_plan = list()
    )
    attr(item, "entry_name_raw") <- entry_name
    if (!nzchar(base_name)) {
      msg <- sprintf("El archivo '%s' no coincide con ninguna base existente.", entry_display)
      item$warnings <- as.list(msg)
      warnings <- c(warnings, msg)
      blocking <- c(blocking, entry_name_safe)
      rows[[length(rows) + 1L]] <- item
      next
    }
    if (base_name %in% used_bases) {
      msg <- sprintf("La base '%s' fue asignada a más de un archivo SAV.", base_name)
      item$blocking <- TRUE
      item$warnings <- as.list(msg)
      warnings <- c(warnings, msg)
      blocking <- c(blocking, entry_name_safe)
      rows[[length(rows) + 1L]] <- item
      next
    }
    used_bases <- c(used_bases, base_name)
    base <- s$estudio$bases[[base_name]]
    item$pins <- .sm_sav_plan_pins(s, base_name)
    xls_id <- .sm_mb_scalar(base$xlsform_file_id, "")
    if (!nzchar(xls_id)) {
      msg <- sprintf("La base '%s' no tiene XLSForm para normalizar '%s'.", base_name, entry_display)
      item$blocking <- TRUE
      item$warnings <- as.list(msg)
      warnings <- c(warnings, msg)
      blocking <- c(blocking, entry_name_safe)
      rows[[length(rows) + 1L]] <- item
      next
    }
    instrument_context <- .sm_sav_instrument_context(s, base_name)
    item$instrument_revision <- instrument_context$audit
    item$pins <- .sm_sav_plan_pins(s, base_name, instrument_context)
    if (!isTRUE(instrument_context$ok)) {
      msg <- instrument_context$warnings
      item$blocking <- TRUE
      item$warnings <- as.list(msg)
      warnings <- c(warnings, msg)
      blocking <- c(blocking, entry_name_safe)
      rows[[length(rows) + 1L]] <- item
      next
    }
    xls_meta <- instrument_context$file %||% (s$files %||% list())[[xls_id]] %||% NULL
    if (is.null(xls_meta) || !nzchar(.sm_mb_scalar(xls_meta$path, "")) || !file.exists(xls_meta$path)) {
      msg <- sprintf("La base '%s' no conserva físicamente el XLSForm para normalizar '%s'.", base_name, entry_display)
      item$blocking <- TRUE
      item$warnings <- as.list(msg)
      warnings <- c(warnings, msg)
      blocking <- c(blocking, entry_name_safe)
      rows[[length(rows) + 1L]] <- item
      next
    }
    inst <- reporte_instrumento(path = xls_meta$path)
    df <- .sm_sav_read_source(meta, entry_name, i)
    converted <- .sm_sav_convert_entry_data(
      df,
      inst,
      base_name,
      base,
      entry_name,
      missing_policy = missing_policy,
      choice_code_maps = (instrument_context$revision %||% list())$choice_code_maps %||% NULL,
      choice_code_maps_certification = list(
        certified = identical(
          .sm_mb_scalar((instrument_context$audit %||% list())$status, ""),
          "pinned_healthy"
        ),
        origin = if (identical(
          .sm_mb_scalar((instrument_context$audit %||% list())$status, ""),
          "pinned_healthy"
        )) "published_revision" else "inferred_legacy",
        sealed_sha256 = .sm_mb_scalar(
          (instrument_context$audit %||% list())$choice_code_maps_sha256,
          ""
        )
      )
    )
    source_channel <- if (identical(ext, "zip")) "sav_zip_offline" else "sav_offline"
    converted$data$source_channel <- source_channel
    .carga_assert_data_xlsform_compatible(converted$data, inst)
    converted$audit$instrument_revision <- instrument_context$audit
    converted$audit$warnings <- as.list(unique(c(
      unlist(converted$audit$warnings %||% list(), use.names = FALSE),
      instrument_context$warnings
    )))
    audit <- converted$audit
    plan <- .sm_sav_change_plan(base, entry_name, audit)
    item$n_rows <- audit$n_rows
    item$n_columns <- audit$n_columns
    item$n_output_columns <- audit$n_output_columns
    item$expected_variables <- audit$expected_variables
    item$matched_variables <- audit$matched_variables
    item$missing_variables <- audit$missing_variables
    item$blank_filled_variables <- audit$blank_filled_variables
    item$all_empty_variables <- audit$all_empty_variables
    item$metadata_columns <- audit$metadata_columns
    item$normalization_review <- converted$normalization_review
    item$instrument_revision <- audit$instrument_revision
    item$pins <- .sm_sav_plan_pins(s, base_name, instrument_context)
    item$warnings <- audit$warnings
    item$change_plan <- plan
    warnings <- c(warnings, unlist(audit$warnings %||% list(), use.names = FALSE))
    rows[[length(rows) + 1L]] <- item

    rp_data <- reporte_data(converted$data, instrumento = inst)
    source_spec <- list(
      version = 1L,
      source_kind = "surveymonkey_sav_bundle",
      survey_id = .sm_mb_scalar(base$survey_id %||% base_name, ""),
      source_alias = .sm_mb_scalar(base$source_alias %||% base_name, base_name),
      source_title = .sm_mb_scalar(base$source_title %||% base$source_alias %||% base_name, ""),
      source_channel = source_channel,
      sav_bundle_file_id = file_id,
      sav_bundle_filename = .sm_mb_scalar(meta$original_name %||% basename(meta$path), ""),
      file_name = entry_display,
      entry_name = entry_name_safe,
      instrument_revision = instrument_context$audit
    )
    response_filter <- .sm_sav_response_filter(entry_name, base_name, audit)
    response_filter$survey_id <- source_spec$survey_id
    response_filter$source_title <- source_spec$source_title
    response_filter$source_alias <- source_spec$source_alias
    response_filter$source_channel <- source_spec$source_channel
    prepared[[length(prepared) + 1L]] <- list(
      base_name = base_name,
      base = base,
      bundle_file_id = file_id,
      entry_name = entry_name,
      entry_name_safe = entry_name_safe,
      inst = inst,
      data = converted$data,
      rp_data = rp_data,
      audit = audit,
      change_plan = plan,
      source_spec = source_spec,
      response_filter = response_filter,
      instrument_context = instrument_context
    )
  }

  resolved_map <- stats::setNames(
    lapply(rows, function(item) .sm_mb_scalar(item$base_name, "")),
    vapply(rows, function(item) .sm_mb_scalar(item$entry_name, ""), character(1))
  )
  if (length(resolved_map)) resolved_map <- resolved_map[order(names(resolved_map))]
  bundle_pin <- .processing_release_file_pin(s, file_id)
  bundle_pin$original_name <- .sm_mb_scalar(meta$original_name %||% basename(meta$path), "")
  inspection <- list(
    ok = length(blocking) == 0L,
    fingerprint_schema = "surveymonkey_sav_bundle_inspection/v2",
    file_id = file_id,
    filename = .sm_mb_scalar(meta$original_name %||% basename(meta$path), ""),
    bundle_pin = bundle_pin,
    missing_required_policy = missing_policy,
    resolved_file_base_map = resolved_map,
    n_files = as.integer(nrow(entries)),
    n_matched = as.integer(sum(vapply(rows, function(x) isTRUE(x$matched) && !isTRUE(x$blocking), logical(1)))),
    n_blocking = as.integer(length(blocking)),
    blocking_files = as.list(blocking),
    files = rows,
    change_plan = rows,
    warnings = as.list(unique(warnings))
  )
  inspection$inspection_fingerprint <- .sm_sav_inspection_fingerprint(inspection)
  list(inspection = inspection, prepared = prepared, session = s, bundle_meta = meta)
}

sm_multibase_sav_bundle_inspect <- function(sid, file_id, file_base_map = list(), missing_policy = "fill_blank_warn") {
  .sm_sav_prepare_bundle(
    sid = sid,
    file_id = file_id,
    file_base_map = file_base_map,
    missing_policy = missing_policy
  )$inspection
}

.sm_sav_commit_artifact <- function(staged_path, final_path) {
  if (!isTRUE(file.rename(staged_path, final_path))) {
    stop_api(500, "E_SM_SAV_FILE_COMMIT", "No se pudo publicar uno de los artefactos SAV preparados.")
  }
  invisible(TRUE)
}

.sm_sav_new_file_paths <- function(s, baseline_file_ids = character()) {
  files <- s$files %||% list()
  new_ids <- setdiff(names(files), baseline_file_ids)
  paths <- vapply(files[new_ids], function(meta) {
    .sm_mb_scalar((meta %||% list())$path, "")
  }, character(1))
  unique(paths[nzchar(paths)])
}

sm_multibase_sav_bundle_import <- function(sid, file_id, file_base_map = list(),
                                           missing_policy = "fill_blank_warn",
                                           expected_inspection_fingerprint = NULL) {
  batch <- .sm_sav_prepare_bundle(
    sid = sid,
    file_id = file_id,
    file_base_map = file_base_map,
    missing_policy = missing_policy
  )
  inspection <- batch$inspection
  .sm_sav_assert_inspection_fingerprint(
    expected_inspection_fingerprint,
    inspection$inspection_fingerprint
  )
  if (!identical(inspection$ok, TRUE)) {
    stop_api(409, "E_SM_SAV_INSPECTION_BLOCKED", "Hay archivos SAV sin base o asignaciones bloqueantes. Revisa el mapeo antes de importar.")
  }
  initial <- batch$session
  meta <- batch$bundle_meta
  stage_dir <- tempfile("sm_sav_bundle_", tmpdir = file.path(initial$dir, "downloads"))
  dir.create(stage_dir, recursive = TRUE, showWarnings = FALSE)
  final_paths <- character(0)
  rollback_state <- NULL
  reapply_downloads_dir <- file.path(initial$dir, "downloads")
  reapply_downloads_before <- character(0)
  reapply_cleanup_armed <- FALSE
  committed <- FALSE
  on.exit({
    unlink(stage_dir, recursive = TRUE, force = TRUE)
    if (!isTRUE(committed)) {
      created_downloads <- if (isTRUE(reapply_cleanup_armed)) {
        setdiff(
          list.files(
            reapply_downloads_dir,
            recursive = TRUE,
            full.names = TRUE,
            all.files = TRUE,
            no.. = TRUE
          ),
          reapply_downloads_before
        )
      } else {
        character(0)
      }
      cleanup_paths <- unique(c(final_paths, created_downloads))
      if (length(cleanup_paths)) unlink(cleanup_paths, recursive = TRUE, force = TRUE)
      if (!is.null(rollback_state) && nzchar(.sm_mb_scalar(sid, ""))) {
        .session_env[[sid]] <- rollback_state
      }
    }
  }, add = TRUE)

  imported_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  staged <- lapply(seq_along(batch$prepared), function(idx) {
    item <- batch$prepared[[idx]]
    slug <- .sm_mb_snapshot_slug(item$base_name)
    data_path <- file.path(stage_dir, sprintf("%02d_%s_data.xlsx", idx, slug))
    snapshot_path <- file.path(stage_dir, sprintf("%02d_%s_snapshot.json", idx, slug))
    .sm_mb_write_xlsx(item$data, data_path)
    snapshot_raw <- .sm_sav_snapshot_raw(
      base_name = item$base_name,
      bundle_file_id = file_id,
      entry_name = item$entry_name,
      audit = item$audit,
      change_plan = item$change_plan,
      source_spec = item$source_spec,
      policy = list(missing_required_policy = missing_policy),
      created_at = imported_at,
      prior_import_history = .sm_sav_compact_import_history(item$base)
    )
    writeBin(snapshot_raw, snapshot_path)
    list(data_path = data_path, snapshot_path = snapshot_path)
  })

  fresh_batch <- .sm_sav_prepare_bundle(
    sid = sid,
    file_id = file_id,
    file_base_map = file_base_map,
    missing_policy = missing_policy
  )
  .sm_sav_assert_inspection_fingerprint(
    expected_inspection_fingerprint,
    fresh_batch$inspection$inspection_fingerprint
  )
  fresh <- fresh_batch$session
  rollback_state <- fresh

  uploads_dir <- file.path(fresh$dir, "uploads")
  dir.create(uploads_dir, recursive = TRUE, showWarnings = FALSE)
  file_items <- lapply(seq_along(batch$prepared), function(idx) {
    item <- batch$prepared[[idx]]
    slug <- .sm_mb_snapshot_slug(item$base_name)
    make_meta <- function(staged_path, original_name, ext) {
      file_id_new <- uuid::UUIDgenerate()
      final_path <- file.path(uploads_dir, paste0(file_id_new, ".", ext))
      final_paths <<- c(final_paths, final_path)
      .sm_sav_commit_artifact(staged_path, final_path)
      list(
        file_id = file_id_new,
        kind = "data",
        original_name = original_name,
        path = final_path,
        size = as.numeric(file.info(final_path)$size),
        ext = ext,
        uploaded_at = imported_at
      )
    }
    list(
      data = make_meta(staged[[idx]]$data_path, paste0(slug, "_sav_bundle_data.xlsx"), "xlsx"),
      snapshot = make_meta(
        staged[[idx]]$snapshot_path,
        paste0(slug, "_surveymonkey_sav_bundle_snapshot.json"),
        "json"
      )
    )
  })

  next_state <- fresh
  next_state$files <- next_state$files %||% list()
  for (idx in seq_along(batch$prepared)) {
    item <- batch$prepared[[idx]]
    registered <- file_items[[idx]]
    next_state$files[[registered$data$file_id]] <- registered$data
    next_state$files[[registered$snapshot$file_id]] <- registered$snapshot
    next_state <- .sm_sav_state_with_base_import(
      next_state,
      prepared = item,
      data_meta = registered$data,
      snapshot_meta = registered$snapshot,
      imported_at = imported_at
    )
  }
  first <- names(next_state$estudio$bases)[1]
  next_state$rp_inst <- next_state$rp_inst_sources[[first]]
  next_state$rp_data <- next_state$rp_data_sources[[first]]
  next_state <- .mark_project_dirty(next_state)

  # Un filtro de universo materializa un archivo efectivo. Tras reemplazar la
  # fuente SAV hay que regenerarlo antes de publicar el lote; conservar sus IDs
  # anteriores haria que Analitica leyera filas del refresh previo.
  filter_roots <- unique(vapply(batch$prepared, function(item) {
    base <- next_state$estudio$bases[[item$base_name]] %||% list()
    filter <- base$universe_filter %||% list()
    if (isTRUE(filter$enabled) &&
        !identical(.sm_mb_scalar(filter$mode, ""), "inherited")) {
      item$base_name
    } else {
      ""
    }
  }, character(1)))
  filter_roots <- filter_roots[nzchar(filter_roots)]
  baseline_file_ids <- names(fresh$files %||% list())
  reapply_downloads_before <- list.files(
    reapply_downloads_dir,
    recursive = TRUE,
    full.names = TRUE,
    all.files = TRUE,
    no.. = TRUE
  )
  reapply_cleanup_armed <- TRUE
  if (length(filter_roots) &&
      !exists("carga_universe_filter_reapply", mode = "function")) {
    stop_api(
      500,
      "E_UNIVERSE_FILTER_REAPPLY_UNAVAILABLE",
      "No se pudo reaplicar el filtro de universo tras importar el bundle SAV."
    )
  }

  .session_env[[sid]] <- next_state
  reapply_error <- NULL
  reapply_ok <- tryCatch({
    for (base_name in filter_roots) {
      raw_id <- .sm_mb_scalar(
        next_state$estudio$bases[[base_name]]$original_data_file_id,
        ""
      )
      carga_universe_filter_reapply(sid, base_name, raw_id)
      next_state <- session_get(sid)
    }
    TRUE
  }, error = function(err) {
    transient <- session_get(sid, required = FALSE) %||% next_state
    final_paths <<- unique(c(
      final_paths,
      .sm_sav_new_file_paths(transient, baseline_file_ids)
    ))
    .session_env[[sid]] <- fresh
    reapply_error <<- err
    FALSE
  })
  if (!isTRUE(reapply_ok)) {
    .session_env[[sid]] <- fresh
    if (inherits(reapply_error, "api_error")) {
      stop_api(
        reapply_error$status %||% 500,
        reapply_error$code %||% "E_SM_SAV_UNIVERSE_REAPPLY",
        conditionMessage(reapply_error),
        details = reapply_error$details %||% NULL
      )
    }
    stop_api(
      500,
      "E_SM_SAV_UNIVERSE_REAPPLY",
      sprintf(
        "No se pudo reaplicar el universo del bundle SAV: %s",
        conditionMessage(reapply_error)
      )
    )
  }
  next_state <- session_get(sid)
  final_paths <- unique(c(
    final_paths,
    .sm_sav_new_file_paths(next_state, baseline_file_ids)
  ))
  committed <- TRUE

  results <- lapply(seq_along(batch$prepared), function(idx) {
    item <- batch$prepared[[idx]]
    registered <- file_items[[idx]]
    updated_base <- next_state$estudio$bases[[item$base_name]]
    list(
      base_name = item$base_name,
      file_name = .sm_mb_scalar(.sm_sav_display_name(item$entry_name), ""),
      entry_name = item$entry_name_safe,
      data_file_id = registered$data$file_id,
      snapshot_file_id = registered$snapshot$file_id,
      n_rows = as.integer(nrow(item$rp_data)),
      n_columns = as.integer(ncol(item$rp_data)),
      warnings = item$audit$warnings %||% list(),
      change_plan = item$change_plan,
      base = .estudio_base_payload(updated_base, next_state)
    )
  })

  list(
    ok = TRUE,
    file_id = file_id,
    filename = .sm_mb_scalar(meta$original_name %||% basename(meta$path), ""),
    imported_bases = as.integer(length(results)),
    results = results,
    inspection = inspection,
    estudio = .estudio_payload(sid)
  )
}
