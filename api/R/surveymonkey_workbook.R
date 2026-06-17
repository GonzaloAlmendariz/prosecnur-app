# =============================================================================
# SurveyMonkey workbook offline -> data Kobo-like
#
# Este importador parte de un proyecto multibase existente: cada hoja del Excel
# exportado por SurveyMonkey se traduce contra el XLSForm de una base hermana y
# reemplaza solo la data efectiva de esa base.
# =============================================================================

.sm_wb_norm_key <- function(x) {
  out <- .sm_mb_norm(x)
  out[is.na(out)] <- ""
  out
}

.sm_wb_career_neutral_key <- function(x) {
  out <- .sm_wb_norm_key(x)
  if (!length(out)) return(out)
  careers <- c(
    "civil",
    "industrial",
    "electronica",
    "geologica",
    "geologica",
    "minas",
    "mecanica",
    "mecatronica",
    "informatica",
    "telecomunicaciones",
    "las telecomunicaciones",
    "de las telecomunicaciones",
    "de minas"
  )
  career_alt <- paste(careers, collapse = "|")
  out <- gsub(paste0("\\bingenieria (", career_alt, ")\\b"), "ingenieria carrera", out, perl = TRUE)
  out <- gsub(paste0("\\bingeniero a (", career_alt, ")\\b"), "ingeniero a carrera", out, perl = TRUE)
  out <- gsub(paste0("\\bingeniero\\(a\\) (", career_alt, ")\\b"), "ingeniero a carrera", out, perl = TRUE)
  out <- gsub("[[:space:]]+", " ", trimws(out))
  out
}

.sm_wb_key_variants <- function(x) {
  unique(c(.sm_wb_norm_key(x), .sm_wb_career_neutral_key(x)))
}

.sm_wb_cell_chr <- function(x) {
  if (length(x) == 0L || is.null(x) || is.na(x)) return(NA_character_)
  if (inherits(x, c("POSIXct", "POSIXt"))) return(format(x, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
  if (inherits(x, "Date")) return(format(x, "%Y-%m-%d"))
  if (is.logical(x)) return(if (isTRUE(x)) "true" else "false")
  if (is.numeric(x)) {
    if (!is.finite(x)) return(NA_character_)
    out <- format(x, scientific = FALSE, trim = TRUE, digits = 15L)
    out <- sub("\\.0+$", "", out)
    out <- sub("(\\.[0-9]*?)0+$", "\\1", out)
    return(out)
  }
  out <- .sm_mb_trim(as.character(x)[1])
  if (.sm_wb_is_excel_error_token(out)) return(NA_character_)
  if (!nzchar(out)) NA_character_ else out
}

.sm_wb_chr_vec <- function(x) {
  vapply(seq_along(x), function(i) .sm_wb_cell_chr(x[[i]]), character(1))
}

.sm_wb_excel_error_tokens <- function() {
  c(
    "#NULL!", "#DIV/0!", "#VALUE!", "#REF!", "#NAME?", "#NUM!", "#N/A",
    "#GETTING_DATA", "#SPILL!", "#CALC!", "#FIELD!", "#BLOCKED!",
    "#UNKNOWN!", "#CONNECT!", "#BUSY!"
  )
}

.sm_wb_is_excel_error_token <- function(x) {
  x <- toupper(trimws(as.character(x %||% "")))
  !is.na(x) & nzchar(x) & x %in% .sm_wb_excel_error_tokens()
}

.sm_wb_excel_error_mask <- function(x) {
  vapply(seq_along(x), function(i) .sm_wb_is_excel_error_token(x[[i]]), logical(1))
}

.sm_wb_read_sheet <- function(path, sheet) {
  if (!requireNamespace("readxl", quietly = TRUE)) stop("Se requiere readxl.", call. = FALSE)
  df <- suppressWarnings(readxl::read_excel(path, sheet = sheet, .name_repair = "minimal"))
  as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
}

.sm_wb_read_workbook_sheets <- function(path) {
  if (!requireNamespace("readxl", quietly = TRUE)) stop("Se requiere readxl.", call. = FALSE)
  readxl::excel_sheets(path)
}

.sm_wb_sheet_base_map <- function(x) {
  if (is.null(x) || !length(x)) return(list())
  if (is.data.frame(x)) {
    if (!all(c("sheet", "base") %in% names(x))) return(list())
    out <- as.list(as.character(x$base %||% ""))
    names(out) <- as.character(x$sheet %||% "")
    return(out)
  }
  if (is.list(x) && !is.null(names(x))) return(x)
  list()
}

.sm_wb_base_label_candidates <- function(base_name, base) {
  unique(.sm_mb_char_vector(c(
    base_name,
    base$nombre,
    base$source_alias,
    base$source_title,
    base$survey_id
  )))
}

.sm_wb_match_sheet_to_base <- function(sheet, bases, explicit_map = list()) {
  sheet <- .sm_mb_scalar(sheet, "")
  mapped <- .sm_mb_scalar(explicit_map[[sheet]] %||% explicit_map[[.sm_wb_norm_key(sheet)]], "")
  if (nzchar(mapped)) return(if (mapped %in% names(bases)) mapped else "")

  sheet_norm <- .sm_wb_norm_key(sheet)
  sheet_slug <- .sm_mb_slug(sheet)
  scores <- vapply(names(bases), function(base_name) {
    labels <- .sm_wb_base_label_candidates(base_name, bases[[base_name]])
    norms <- .sm_wb_norm_key(labels)
    slugs <- .sm_mb_slug(labels)
    score <- 0L
    if (sheet_norm %in% norms || sheet_slug %in% slugs) score <- max(score, 100L)
    if (any(endsWith(slugs, paste0("_", sheet_slug)) | endsWith(slugs, sheet_slug))) score <- max(score, 92L)
    if (any(grepl(paste0("\\b", gsub(" ", "\\\\s+", sheet_norm), "\\b"), norms))) score <- max(score, 88L)
    if (any(vapply(norms, function(norm) {
      nzchar(norm) && grepl(paste0("\\b", gsub(" ", "\\\\s+", norm), "\\b"), sheet_norm)
    }, logical(1)))) score <- max(score, 82L)
    score
  }, integer(1))
  hit <- names(scores)[which.max(scores)]
  if (!length(hit) || is.na(scores[[hit]]) || scores[[hit]] < 80L) "" else hit
}

.sm_wb_add_map <- function(map, key, value) {
  key_norms <- .sm_wb_key_variants(key)
  key_norms <- key_norms[nzchar(key_norms)]
  if (!length(key_norms)) return(map)
  for (key_norm in key_norms) {
    current <- map[[key_norm]] %||% list()
    current[[length(current) + 1L]] <- value
    map[[key_norm]] <- current
  }
  map
}

.sm_wb_unique_entry <- function(entries) {
  if (is.null(entries) || !length(entries)) return(NULL)
  keys <- vapply(entries, function(x) paste(.sm_mb_scalar(x$kind, ""), .sm_mb_scalar(x$variable, ""), .sm_mb_scalar(x$code, ""), sep = "::"), character(1))
  entries <- entries[!duplicated(keys)]
  if (length(entries) == 1L) entries[[1]] else structure(entries, class = "sm_wb_ambiguous")
}

.sm_wb_question_prompt_for_var <- function(var, note_prompts, current_prompt = "") {
  var <- .sm_mb_scalar(var, "")
  stem <- sub("_[^_]+$", "", var)
  prompt <- .sm_mb_scalar(note_prompts[[stem]], "")
  if (!nzchar(prompt)) prompt <- .sm_mb_scalar(note_prompts[[var]], "")
  if (!nzchar(prompt)) prompt <- .sm_mb_scalar(current_prompt, "")
  prompt
}

.sm_wb_build_header_maps <- function(inst) {
  survey <- inst$survey
  if (is.null(survey) || !is.data.frame(survey) || !nrow(survey)) {
    return(list(simple = list(), composite = list(), select_multiple = list(), child = list()))
  }
  lab_col <- .sm_mb_label_col(survey)
  labels <- if (!is.na(lab_col)) .sm_mb_trim(survey[[lab_col]]) else .sm_mb_trim(survey$name)
  names_raw <- as.character(survey$name %||% "")
  types <- as.character(survey$type %||% "")

  note_prompts <- list()
  current_prompt <- ""
  simple <- list()
  composite <- list()
  select_multiple <- list()
  child <- list()

  for (i in seq_len(nrow(survey))) {
    type_base <- .sm_mb_type_base(types[i])
    label <- .sm_mb_trim(labels[i])
    var <- .sm_mb_scalar(names_raw[i], "")
    if (identical(type_base, "note")) {
      current_prompt <- label
      note_target <- sub("^nota_", "", var)
      if (nzchar(note_target)) note_prompts[[note_target]] <- label
      next
    }
    if (type_base %in% .sm_mb_non_question_types) next
    if (!nzchar(var) || !nzchar(label)) next

    simple <- .sm_wb_add_map(simple, label, list(kind = "question", variable = var, type_base = type_base))
    child <- .sm_wb_add_map(child, label, list(kind = "question", variable = var, type_base = type_base))

    prompt <- .sm_wb_question_prompt_for_var(var, note_prompts, current_prompt)
    if (nzchar(prompt) && !identical(.sm_wb_norm_key(prompt), .sm_wb_norm_key(label))) {
      composite <- .sm_wb_add_map(composite, paste(prompt, label, sep = " | "), list(kind = "question", variable = var, type_base = type_base))
    }

    if (identical(type_base, "select_multiple")) {
      choices <- .sm_mb_choices_for_var(inst, var)
      if (nrow(choices)) {
        choice_labels <- if ("label" %in% names(choices)) choices$label else choices$name
        for (j in seq_len(nrow(choices))) {
          code <- .sm_mb_scalar(choices$name[j], "")
          choice_label <- .sm_mb_trim(choice_labels[j])
          if (!nzchar(code) || !nzchar(choice_label)) next
          select_multiple <- .sm_wb_add_map(
            select_multiple,
            paste(label, choice_label, sep = " | "),
            list(kind = "select_multiple", variable = var, code = code, type_base = type_base)
          )
          if (nzchar(prompt)) {
            select_multiple <- .sm_wb_add_map(
              select_multiple,
              paste(prompt, choice_label, sep = " | "),
              list(kind = "select_multiple", variable = var, code = code, type_base = type_base)
            )
          }
        }
      }
    }
  }

  list(
    simple = simple,
    composite = composite,
    select_multiple = select_multiple,
    child = child
  )
}

.sm_wb_metadata_map <- function(header) {
  key <- .sm_wb_norm_key(header)
  if (!length(key) || !nzchar(key)) return(NULL)
  map <- list(
    "response id" = list(kind = "metadata", columns = c("response_id", "respondent_id")),
    "respondent id" = list(kind = "metadata", columns = c("respondent_id", "response_id")),
    "date created" = list(kind = "metadata", columns = "date_created"),
    "fecha de creacion" = list(kind = "metadata", columns = "date_created"),
    "date modified" = list(kind = "metadata", columns = "date_modified"),
    "fecha de modificacion" = list(kind = "metadata", columns = "date_modified"),
    "response status" = list(kind = "metadata", columns = "response_status"),
    "estado de respuesta" = list(kind = "metadata", columns = "response_status"),
    "collector id" = list(kind = "metadata", columns = "collector_id"),
    "collector type" = list(kind = "metadata", columns = c("collector_type", "collection_mode")),
    "ip address" = list(kind = "metadata", columns = "ip_address"),
    "duration sec" = list(kind = "metadata", columns = "total_time"),
    "duration seconds" = list(kind = "metadata", columns = "total_time"),
    "id" = list(kind = "metadata", columns = c("cv_id", "custom_value"))
  )
  map[[key]] %||% NULL
}

.sm_wb_resolve_header <- function(header, maps) {
  meta <- .sm_wb_metadata_map(header)
  if (!is.null(meta)) return(meta)
  keys <- .sm_wb_key_variants(header)
  keys <- keys[nzchar(keys)]
  if (!length(keys)) return(NULL)

  for (bucket in c("select_multiple", "composite", "simple")) {
    for (key in keys) {
      hit <- .sm_wb_unique_entry(maps[[bucket]][[key]] %||% NULL)
      if (!is.null(hit)) return(hit)
    }
  }

  parts <- trimws(strsplit(.sm_mb_scalar(header, ""), "\\|", fixed = FALSE)[[1]])
  parts <- parts[nzchar(parts)]
  if (length(parts) >= 2L) {
    suffix <- parts[length(parts)]
    for (bucket in c("select_multiple", "composite")) {
      for (key in .sm_wb_key_variants(paste(parts[1], suffix, sep = " | "))) {
        hit <- .sm_wb_unique_entry(maps[[bucket]][[key]] %||% NULL)
        if (!is.null(hit)) return(hit)
      }
    }
    child_hit <- .sm_wb_unique_entry(maps$child[[.sm_wb_norm_key(suffix)]] %||% NULL)
    if (!is.null(child_hit)) return(child_hit)
  }

  NULL
}

.sm_wb_is_selected_dummy <- function(x) {
  if (exists(".dn_is_selected_dummy", mode = "function")) return(.dn_is_selected_dummy(x))
  vals <- .sm_wb_chr_vec(x)
  norm <- .sm_wb_norm_key(vals)
  !is.na(norm) & nzchar(norm) & !(norm %in% c("0", "false", "no", "n", "na"))
}

.sm_wb_code_for_value <- function(inst, var, value) {
  val <- .sm_wb_cell_chr(value)
  if (is.na(val) || !nzchar(val)) return(NA_character_)
  choices <- .sm_mb_choices_for_var(inst, var)
  if (!nrow(choices) || !"name" %in% names(choices)) return(val)
  codes <- as.character(choices$name)
  if (val %in% codes) return(val)
  labels <- if ("label" %in% names(choices)) choices$label else choices$name
  hit <- which(.sm_wb_norm_key(labels) == .sm_wb_norm_key(val))[1]
  if (!is.na(hit)) return(codes[hit])
  val
}

.sm_wb_response_filter <- function(sheet_name, base_name, audit) {
  list(
    kind = "surveymonkey_workbook_response_filter",
    sheet_name = .sm_mb_scalar(sheet_name, ""),
    base_name = .sm_mb_scalar(base_name, ""),
    original_rows = as.integer(audit$n_rows %||% 0L),
    kept_rows = as.integer(audit$n_rows %||% 0L),
    excluded_rows = 0L,
    missing_variables = as.list(audit$missing_variables %||% character(0)),
    unknown_headers = as.list(audit$unknown_headers %||% character(0)),
    ambiguous_headers = as.list(audit$ambiguous_headers %||% character(0))
  )
}

.sm_wb_convert_sheet_data <- function(df, inst, base_name, base_meta, sheet_name, missing_policy = "fill_blank_warn") {
  df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  n <- nrow(df)
  out <- data.frame(.pulso_row = seq_len(n))
  out$.pulso_row <- NULL
  maps <- .sm_wb_build_header_maps(inst)
  expected <- .sm_mb_expected_names(inst)
  mapped_vars <- character(0)
  mapped_headers <- list()
  unknown_headers <- character(0)
  ambiguous_headers <- character(0)
  cell_errors <- list()
  sm_acc <- list()

  headers <- names(df)
  for (j in seq_along(headers)) {
    header <- .sm_mb_trim(headers[j])
    if (!nzchar(header)) next
    error_mask <- .sm_wb_excel_error_mask(df[[j]])
    error_count <- sum(error_mask, na.rm = TRUE)
    error_rows <- which(error_mask)
    resolved <- .sm_wb_resolve_header(header, maps)
    if (is.null(resolved)) {
      if (error_count > 0L) {
        cell_errors[[length(cell_errors) + 1L]] <- list(
          source = header,
          kind = "unknown",
          variable = "",
          code = "",
          n_errors = as.integer(error_count),
          rows = as.list(as.integer(utils::head(error_rows, 20L)))
        )
      }
      unknown_headers <- c(unknown_headers, header)
      next
    }
    if (inherits(resolved, "sm_wb_ambiguous")) {
      if (error_count > 0L) {
        cell_errors[[length(cell_errors) + 1L]] <- list(
          source = header,
          kind = "ambiguous",
          variable = "",
          code = "",
          n_errors = as.integer(error_count),
          rows = as.list(as.integer(utils::head(error_rows, 20L)))
        )
      }
      ambiguous_headers <- c(ambiguous_headers, header)
      next
    }
    values <- .sm_wb_chr_vec(df[[j]])
    if (error_count > 0L) {
      cell_errors[[length(cell_errors) + 1L]] <- list(
        source = header,
        kind = .sm_mb_scalar(resolved$kind, ""),
        variable = .sm_mb_scalar(resolved$variable, ""),
        code = .sm_mb_scalar(resolved$code, ""),
        n_errors = as.integer(error_count),
        rows = as.list(as.integer(utils::head(error_rows, 20L)))
      )
    }
    mapped_headers[[length(mapped_headers) + 1L]] <- list(
      source = header,
      kind = .sm_mb_scalar(resolved$kind, ""),
      variable = .sm_mb_scalar(resolved$variable, ""),
      code = .sm_mb_scalar(resolved$code, ""),
      columns = as.list(as.character(resolved$columns %||% character(0)))
    )
    if (identical(resolved$kind, "metadata")) {
      for (col in as.character(resolved$columns %||% character(0))) out[[col]] <- values
      next
    }
    if (identical(resolved$kind, "select_multiple")) {
      var <- .sm_mb_scalar(resolved$variable, "")
      code <- .sm_mb_scalar(resolved$code, "")
      if (!nzchar(var) || !nzchar(code)) next
      selected <- .sm_wb_is_selected_dummy(df[[j]])
      if (is.null(sm_acc[[var]])) sm_acc[[var]] <- replicate(n, character(0), simplify = FALSE)
      for (i in seq_len(n)) {
        if (isTRUE(selected[i])) sm_acc[[var]][[i]] <- unique(c(sm_acc[[var]][[i]], code))
      }
      mapped_vars <- unique(c(mapped_vars, var))
      next
    }
    var <- .sm_mb_scalar(resolved$variable, "")
    if (!nzchar(var)) next
    row <- .sm_mb_survey_row(inst, var)
    type_base <- if (!is.null(row)) .sm_mb_type_base(row$type) else .sm_mb_scalar(resolved$type_base, "")
    if (startsWith(type_base, "select_one")) {
      out[[var]] <- vapply(values, function(value) .sm_wb_code_for_value(inst, var, value), character(1))
    } else {
      out[[var]] <- values
    }
    mapped_vars <- unique(c(mapped_vars, var))
  }

  for (var in names(sm_acc)) {
    out[[var]] <- vapply(sm_acc[[var]], function(tokens) {
      tokens <- tokens[!is.na(tokens) & nzchar(tokens)]
      if (!length(tokens)) NA_character_ else paste(unique(tokens), collapse = " ")
    }, character(1))
  }

  missing_variables <- setdiff(expected, mapped_vars)
  if (length(missing_variables)) {
    if (!identical(.sm_mb_scalar(missing_policy, "fill_blank_warn"), "fill_blank_warn")) {
      stop_api(409, "E_SM_WB_MISSING_VARIABLES", sprintf(
        "La hoja '%s' no trae variables esperadas: %s",
        sheet_name,
        paste(utils::head(missing_variables, 20L), collapse = ", ")
      ))
    }
    for (var in missing_variables) out[[var]] <- NA_character_
  }

  if (!"response_id" %in% names(out) && "respondent_id" %in% names(out)) out$response_id <- out$respondent_id
  if (!"respondent_id" %in% names(out) && "response_id" %in% names(out)) out$respondent_id <- out$response_id
  if (!"response_id" %in% names(out)) out$response_id <- as.character(seq_len(n))
  if (!"respondent_id" %in% names(out)) out$respondent_id <- out$response_id
  if (!"response_status" %in% names(out)) out$response_status <- rep("completed", n)
  if (!"collector_id" %in% names(out)) out$collector_id <- NA_character_

  survey_id <- .sm_mb_scalar(base_meta$survey_id %||% base_name, base_name)
  out$survey_id <- survey_id
  out$source_title <- .sm_mb_scalar(base_meta$source_title %||% base_meta$source_alias %||% base_name, base_name)
  out$source_channel <- .sm_mb_scalar(base_meta$source_channel, "")
  out$case_uid <- paste(survey_id, as.character(out$response_id %||% seq_len(n)), sep = ":")

  out <- normalize_data_for_xlsform(out, inst)
  for (var in expected) {
    if (!var %in% names(out)) out[[var]] <- NA_character_
  }
  preferred <- unique(c(
    "survey_id", "response_id", "respondent_id", "case_uid", "response_status",
    "date_created", "date_modified", "collector_id", "collector_type",
    "collection_mode", "ip_address", "total_time", "cv_id", "custom_value",
    "source_title", "source_channel",
    expected
  ))
  out <- out[, c(intersect(preferred, names(out)), setdiff(names(out), preferred)), drop = FALSE]

  warnings <- character(0)
  if (length(missing_variables)) {
    warnings <- c(warnings, sprintf(
      "La hoja '%s' no trae %d variables esperadas; se completaron vacías.",
      sheet_name,
      length(missing_variables)
    ))
  }
  if (length(unknown_headers)) {
    warnings <- c(warnings, sprintf(
      "La hoja '%s' tiene %d encabezados sin reconocer.",
      sheet_name,
      length(unique(unknown_headers))
    ))
  }
  if (length(ambiguous_headers)) {
    warnings <- c(warnings, sprintf(
      "La hoja '%s' tiene %d encabezados ambiguos.",
      sheet_name,
      length(unique(ambiguous_headers))
    ))
  }
  n_cell_errors <- sum(vapply(cell_errors, function(x) as.integer(x$n_errors %||% 0L), integer(1)), na.rm = TRUE)
  if (n_cell_errors > 0L) {
    warnings <- c(warnings, sprintf(
      "La hoja '%s' contiene %d celdas con errores de Excel (#REF!, #VALUE!, etc.); se trataron como vacías.",
      sheet_name,
      as.integer(n_cell_errors)
    ))
  }

  list(
    data = out,
    audit = list(
      sheet_name = .sm_mb_scalar(sheet_name, ""),
      base_name = .sm_mb_scalar(base_name, ""),
      n_rows = as.integer(nrow(df)),
      n_columns = as.integer(ncol(df)),
      n_output_columns = as.integer(ncol(out)),
      recognized_headers = as.integer(length(mapped_headers)),
      mapped_headers = mapped_headers,
      unknown_headers = as.list(unique(unknown_headers)),
      ambiguous_headers = as.list(unique(ambiguous_headers)),
      missing_variables = as.list(missing_variables),
      blank_filled_variables = as.list(missing_variables),
      cell_errors = cell_errors,
      n_cell_errors = as.integer(n_cell_errors),
      warnings = as.list(warnings)
    )
  )
}

.sm_wb_require_session_project <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) stop_api(404, "E_NO_SESSION", "Sin sesión.")
  if (is.null(s$estudio) || !length(s$estudio$bases %||% list())) {
    stop_api(409, "E_SM_WB_NO_PROJECT", "Abre un proyecto con bases existentes antes de importar el Excel.")
  }
  if (!estudio_is_independent_siblings(sid)) {
    stop_api(409, "E_SM_WB_NOT_INDEPENDENT", "La carga multibase offline requiere bases hermanas independientes.")
  }
  s
}

sm_multibase_workbook_inspect <- function(sid, file_id, sheet_base_map = list(), missing_policy = "fill_blank_warn") {
  s <- .sm_wb_require_session_project(sid)
  file_id <- .sm_mb_scalar(file_id, "")
  if (!nzchar(file_id)) stop_api(400, "E_SM_WB_FILE_REQUIRED", "Debes subir un Excel exportado por SurveyMonkey.")
  meta <- get_file(sid, file_id)
  ext <- tolower(meta$ext %||% tools::file_ext(meta$path))
  if (!ext %in% c("xlsx", "xls")) {
    stop_api(400, "E_SM_WB_FILE_UNSUPPORTED", "El archivo debe ser .xlsx o .xls.")
  }
  sheets <- .sm_wb_read_workbook_sheets(meta$path)
  explicit_map <- .sm_wb_sheet_base_map(sheet_base_map)
  rows <- list()
  warnings <- character(0)
  blocking <- character(0)
  used_bases <- character(0)

  for (sheet in sheets) {
    base_name <- .sm_wb_match_sheet_to_base(sheet, s$estudio$bases, explicit_map)
    item <- list(
      sheet_name = .sm_mb_scalar(sheet, ""),
      base_name = if (nzchar(base_name)) base_name else NA_character_,
      matched = nzchar(base_name),
      blocking = !nzchar(base_name),
      n_rows = 0L,
      n_columns = 0L,
      recognized_headers = 0L,
      unknown_headers = list(),
      ambiguous_headers = list(),
      missing_variables = list(),
      cell_errors = list(),
      n_cell_errors = 0L,
      warnings = list()
    )
    if (!nzchar(base_name)) {
      msg <- sprintf("La hoja '%s' no coincide con ninguna base existente.", sheet)
      item$warnings <- as.list(msg)
      warnings <- c(warnings, msg)
      blocking <- c(blocking, sheet)
      rows[[length(rows) + 1L]] <- item
      next
    }
    if (base_name %in% used_bases) {
      msg <- sprintf("La base '%s' fue asignada a más de una hoja.", base_name)
      item$blocking <- TRUE
      item$warnings <- as.list(msg)
      warnings <- c(warnings, msg)
      blocking <- c(blocking, sheet)
      rows[[length(rows) + 1L]] <- item
      next
    }
    used_bases <- c(used_bases, base_name)
    base <- s$estudio$bases[[base_name]]
    xls_id <- .sm_mb_scalar(base$xlsform_file_id, "")
    if (!nzchar(xls_id)) {
      msg <- sprintf("La base '%s' no tiene XLSForm para normalizar la hoja '%s'.", base_name, sheet)
      item$blocking <- TRUE
      item$warnings <- as.list(msg)
      warnings <- c(warnings, msg)
      blocking <- c(blocking, sheet)
      rows[[length(rows) + 1L]] <- item
      next
    }
    inst <- reporte_instrumento(path = get_file(sid, xls_id)$path)
    df <- .sm_wb_read_sheet(meta$path, sheet)
    converted <- .sm_wb_convert_sheet_data(df, inst, base_name, base, sheet, missing_policy = missing_policy)
    audit <- converted$audit
    item$n_rows <- audit$n_rows
    item$n_columns <- audit$n_columns
    item$n_output_columns <- audit$n_output_columns
    item$recognized_headers <- audit$recognized_headers
    item$mapped_headers <- audit$mapped_headers
    item$unknown_headers <- audit$unknown_headers
    item$ambiguous_headers <- audit$ambiguous_headers
    item$missing_variables <- audit$missing_variables
    item$blank_filled_variables <- audit$blank_filled_variables
    item$cell_errors <- audit$cell_errors %||% list()
    item$n_cell_errors <- as.integer(audit$n_cell_errors %||% 0L)
    item$warnings <- audit$warnings
    warnings <- c(warnings, unlist(audit$warnings %||% list(), use.names = FALSE))
    rows[[length(rows) + 1L]] <- item
  }

  list(
    ok = length(blocking) == 0L,
    file_id = file_id,
    filename = .sm_mb_scalar(meta$original_name %||% basename(meta$path), ""),
    n_sheets = as.integer(length(sheets)),
    n_matched = as.integer(sum(vapply(rows, function(x) isTRUE(x$matched) && !isTRUE(x$blocking), logical(1)))),
    n_blocking = as.integer(length(blocking)),
    blocking_sheets = as.list(blocking),
    sheets = rows,
    warnings = as.list(unique(warnings))
  )
}

.sm_wb_save_snapshot <- function(sid, base_name, workbook_file_id, sheet_name, audit, source_spec = list(), policy = list()) {
  if (!requireNamespace("jsonlite", quietly = TRUE)) stop("Se requiere jsonlite.", call. = FALSE)
  payload <- list(
    version = "surveymonkey_workbook_snapshot/1",
    created_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    base_name = .sm_mb_scalar(base_name, ""),
    workbook_file_id = .sm_mb_scalar(workbook_file_id, ""),
    sheet_name = .sm_mb_scalar(sheet_name, ""),
    source_spec = source_spec %||% list(),
    missing_required_policy = .sm_mb_scalar(policy$missing_required_policy %||% "fill_blank_warn", "fill_blank_warn"),
    audit = audit %||% list()
  )
  json <- jsonlite::toJSON(payload, auto_unbox = TRUE, null = "null", pretty = FALSE)
  save_upload(
    sid,
    "data",
    paste0(.sm_mb_snapshot_slug(base_name), "_surveymonkey_workbook_snapshot.json"),
    charToRaw(enc2utf8(as.character(json)))
  )
}

.sm_wb_update_base_import <- function(sid, base_name, workbook_file_id, sheet_name, data_meta, snapshot_meta,
                                      rp_inst, rp_data, audit, source_spec, response_filter) {
  s <- session_get(sid)
  base <- s$estudio$bases[[base_name]]
  if (is.null(base)) stop_api(404, "E_BASE_NOT_FOUND", sprintf("Base '%s' no existe.", base_name))
  if (is.null(base$original_xlsform_file_id) || !nzchar(as.character(base$original_xlsform_file_id))) {
    base$original_xlsform_file_id <- base$xlsform_file_id
  }
  if (is.null(base$original_data_file_id) || !nzchar(as.character(base$original_data_file_id))) {
    base$original_data_file_id <- base$data_file_id
    base$original_data_ext <- base$data_ext
  }
  base$data_file_id <- data_meta$file_id
  base$data_ext <- data_meta$ext
  base$n_filas <- as.integer(nrow(rp_data))
  base$n_columnas <- as.integer(ncol(rp_data))
  base$source_kind <- "surveymonkey_workbook"
  base$survey_id <- .sm_mb_scalar(source_spec$survey_id %||% base$survey_id %||% base_name, "")
  base$source_alias <- .sm_mb_scalar(source_spec$source_alias %||% base$source_alias %||% base_name, base_name)
  base$source_title <- .sm_mb_scalar(source_spec$source_title %||% base$source_title %||% base$source_alias %||% base_name, "")
  base$source_channel <- .sm_mb_scalar(source_spec$source_channel %||% base$source_channel, "excel_offline")
  if (!nzchar(base$source_channel)) base$source_channel <- "excel_offline"
  base$response_filter <- response_filter
  base$surveymonkey_source_spec <- source_spec
  base$surveymonkey_workbook_file_id <- .sm_mb_scalar(workbook_file_id, "")
  base$surveymonkey_workbook_snapshot_file_id <- .sm_mb_scalar(snapshot_meta$file_id, "")
  base$surveymonkey_effective_data_file_id <- .sm_mb_scalar(data_meta$file_id, "")
  base$surveymonkey_workbook_import <- list(
    version = 1L,
    imported_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    workbook_file_id = .sm_mb_scalar(workbook_file_id, ""),
    snapshot_file_id = .sm_mb_scalar(snapshot_meta$file_id, ""),
    sheet_name = .sm_mb_scalar(sheet_name, ""),
    n_rows = as.integer(nrow(rp_data)),
    n_columns = as.integer(ncol(rp_data)),
    warnings = audit$warnings %||% list(),
    missing_variables = audit$missing_variables %||% list(),
    unknown_headers = audit$unknown_headers %||% list(),
    cell_errors = audit$cell_errors %||% list(),
    n_cell_errors = as.integer(audit$n_cell_errors %||% 0L)
  )
  base$surveymonkey_refreshed_at <- base$surveymonkey_workbook_import$imported_at
  base$surveymonkey_last_refresh <- list(
    refreshed_at = base$surveymonkey_refreshed_at,
    n_new = as.integer(nrow(rp_data)),
    source_count = 1L,
    workbook_import = TRUE,
    sheet_name = .sm_mb_scalar(sheet_name, "")
  )
  s$estudio$bases[[base_name]] <- base
  s$rp_inst_sources[[base_name]] <- rp_inst
  s$rp_data_sources[[base_name]] <- rp_data
  if (!is.null(s$codif_por_base) && !is.null(s$codif_por_base[[base_name]])) {
    s$codif_por_base[[base_name]]$inst <- NULL
    s$codif_por_base[[base_name]]$data <- NULL
  }
  s <- .invalidate_processing_state(s, base_name)
  first <- names(s$estudio$bases)[1]
  if (identical(first, base_name)) {
    s$rp_inst <- s$rp_inst_sources[[base_name]]
    s$rp_data <- s$rp_data_sources[[base_name]]
  }
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(base)
}

sm_multibase_workbook_import <- function(sid, file_id, sheet_base_map = list(), missing_policy = "fill_blank_warn") {
  inspection <- sm_multibase_workbook_inspect(
    sid = sid,
    file_id = file_id,
    sheet_base_map = sheet_base_map,
    missing_policy = missing_policy
  )
  if (!identical(inspection$ok, TRUE)) {
    stop_api(409, "E_SM_WB_INSPECTION_BLOCKED", "Hay hojas sin base o asignaciones bloqueantes. Revisa el mapeo antes de importar.")
  }
  s <- session_get(sid)
  meta <- get_file(sid, file_id)
  downloads_dir <- file.path(s$dir, "downloads")
  dir.create(downloads_dir, recursive = TRUE, showWarnings = FALSE)
  results <- list()

  for (sheet_item in inspection$sheets) {
    sheet <- .sm_mb_scalar(sheet_item$sheet_name, "")
    base_name <- .sm_mb_scalar(sheet_item$base_name, "")
    if (!nzchar(sheet) || !nzchar(base_name)) next
    s <- session_get(sid)
    base <- s$estudio$bases[[base_name]]
    inst <- reporte_instrumento(path = get_file(sid, base$xlsform_file_id)$path)
    df <- .sm_wb_read_sheet(meta$path, sheet)
    converted <- .sm_wb_convert_sheet_data(df, inst, base_name, base, sheet, missing_policy = missing_policy)
    .carga_assert_data_xlsform_compatible(converted$data, inst)

    data_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", .sm_mb_snapshot_slug(base_name), "_workbook_data.xlsx"))
    .sm_mb_write_xlsx(converted$data, data_path)
    data_meta <- save_upload(sid, "data", paste0(.sm_mb_snapshot_slug(base_name), "_workbook_data.xlsx"), readBin(data_path, "raw", n = file.info(data_path)$size))
    rp_data <- reporte_data(converted$data, instrumento = inst)
    source_channel <- .sm_mb_scalar(base$source_channel, "")
    if (!nzchar(source_channel)) source_channel <- "excel_offline"
    source_spec <- list(
      version = 1L,
      source_kind = "surveymonkey_workbook",
      survey_id = .sm_mb_scalar(base$survey_id %||% base_name, ""),
      source_alias = .sm_mb_scalar(base$source_alias %||% base_name, base_name),
      source_title = .sm_mb_scalar(base$source_title %||% base$source_alias %||% base_name, ""),
      source_channel = source_channel,
      workbook_file_id = .sm_mb_scalar(file_id, ""),
      workbook_filename = .sm_mb_scalar(meta$original_name %||% basename(meta$path), ""),
      sheet_name = sheet
    )
    response_filter <- .sm_wb_response_filter(sheet, base_name, converted$audit)
    response_filter$survey_id <- source_spec$survey_id
    response_filter$source_title <- source_spec$source_title
    response_filter$source_alias <- source_spec$source_alias
    response_filter$source_channel <- source_spec$source_channel
    snapshot_meta <- .sm_wb_save_snapshot(
      sid,
      base_name = base_name,
      workbook_file_id = file_id,
      sheet_name = sheet,
      audit = converted$audit,
      source_spec = source_spec,
      policy = list(missing_required_policy = missing_policy)
    )
    updated_base <- .sm_wb_update_base_import(
      sid = sid,
      base_name = base_name,
      workbook_file_id = file_id,
      sheet_name = sheet,
      data_meta = data_meta,
      snapshot_meta = snapshot_meta,
      rp_inst = inst,
      rp_data = rp_data,
      audit = converted$audit,
      source_spec = source_spec,
      response_filter = response_filter
    )
    results[[length(results) + 1L]] <- list(
      base_name = base_name,
      sheet_name = sheet,
      data_file_id = data_meta$file_id,
      snapshot_file_id = snapshot_meta$file_id,
      n_rows = as.integer(nrow(rp_data)),
      n_columns = as.integer(ncol(rp_data)),
      warnings = converted$audit$warnings %||% list(),
      base = .estudio_base_payload(updated_base, session_get(sid, required = FALSE))
    )
  }

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
