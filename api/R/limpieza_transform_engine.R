# =============================================================================
# Motor de transformaciones reutilizable para Limpieza / Normalizacion
# =============================================================================

.transform_chr <- function(x) {
  out <- as.character(x %||% character(0))
  out <- out[!is.na(out) & nzchar(trimws(out))]
  trimws(out)
}

.transform_tokenize_sm <- function(x) {
  if (is.null(x) || length(x) == 0L || is.na(x)) return(character(0))
  x <- trimws(as.character(x)[1])
  if (!nzchar(x) || identical(x, "NA")) return(character(0))
  unique(strsplit(x, "[[:space:],;|]+", perl = TRUE)[[1]])
}

.transform_order_tokens <- function(tokens, choice_order = character()) {
  tokens <- unique(.transform_chr(tokens))
  if (!length(tokens)) return(character(0))
  choice_order <- unique(.transform_chr(choice_order))
  if (!length(choice_order)) return(tokens)
  c(intersect(choice_order, tokens), setdiff(tokens, choice_order))
}

.transform_join_sm <- function(tokens, choice_order = character()) {
  tokens <- .transform_order_tokens(tokens, choice_order)
  if (!length(tokens)) return(NA_character_)
  paste(tokens, collapse = " ")
}

.transform_normalize_hierarchy_map <- function(hierarchy_map) {
  if (is.null(hierarchy_map) || !length(hierarchy_map)) return(list())

  if (is.data.frame(hierarchy_map)) {
    hierarchy_map <- lapply(seq_len(nrow(hierarchy_map)), function(i) {
      as.list(hierarchy_map[i, , drop = FALSE])
    })
  }

  out <- list()

  # Forma preferida: list("5" = c("1", "2", "3"), "7" = c(...)).
  nms <- names(hierarchy_map)
  if (!is.null(nms) && any(nzchar(nms))) {
    for (nm in nms) {
      if (!nzchar(nm)) next
      vals <- .transform_chr(unlist(hierarchy_map[[nm]], use.names = FALSE))
      vals <- vals[vals != nm]
      if (length(vals)) out[[as.character(nm)]] <- unique(vals)
    }
    return(out)
  }

  # Forma alternativa para integraciones futuras:
  # list(list(trigger = "5", add = c("1", "2"))).
  for (item in hierarchy_map) {
    if (!is.list(item)) next
    trigger <- .transform_chr(item$trigger %||% item$source %||% item$when)
    add <- .transform_chr(unlist(item$add %||% item$adds %||% item$required %||% list(), use.names = FALSE))
    if (!length(trigger) || !length(add)) next
    add <- add[add != trigger[1]]
    if (length(add)) out[[trigger[1]]] <- unique(add)
  }

  out
}

.transform_select_multiple_choices <- function(instrumento, target_variable) {
  empty <- data.frame(name = character(), label = character(), stringsAsFactors = FALSE)
  if (is.null(instrumento) || is.null(instrumento$survey) || is.null(instrumento$choices)) {
    return(empty)
  }
  survey <- instrumento$survey
  choices <- instrumento$choices
  if (!nrow(survey) || !nrow(choices) ||
      !all(c("name", "type") %in% names(survey)) ||
      !all(c("list_name", "name") %in% names(choices))) {
    return(empty)
  }

  survey_names <- as.character(survey$name %||% "")
  survey_names[is.na(survey_names)] <- ""
  row <- survey[survey_names == as.character(target_variable), , drop = FALSE]
  if (!nrow(row)) return(empty)
  type_raw <- trimws(as.character(row$type[1] %||% ""))
  type_base <- trimws(as.character(row$type_base[1] %||% sub("\\s+.*$", "", type_raw)))
  if (!identical(type_base, "select_multiple") && !grepl("^select_multiple\\b", type_raw, perl = TRUE)) {
    return(empty)
  }

  list_name <- if (exists(".dn_survey_list_name", mode = "function")) {
    .dn_survey_list_name(row)
  } else {
    ln <- as.character(row$list_name[1] %||% NA_character_)
    if (!is.na(ln) && nzchar(ln)) ln else sub("^select_multiple\\s+", "", type_raw)
  }
  if (is.na(list_name) || !nzchar(list_name)) return(empty)

  choices <- as.data.frame(choices, stringsAsFactors = FALSE, check.names = FALSE)
  label_col <- if (exists(".dn_choice_label_col", mode = "function")) {
    .dn_choice_label_col(choices)
  } else {
    c("label", "label::es", "label::Spanish (ES)", "label_spanish_es")[c("label", "label::es", "label::Spanish (ES)", "label_spanish_es") %in% names(choices)][1] %||% NA_character_
  }
  rows <- choices[as.character(choices$list_name) == as.character(list_name), , drop = FALSE]
  if (!nrow(rows)) return(empty)
  data.frame(
    name = as.character(rows$name),
    label = if (!is.na(label_col) && label_col %in% names(rows)) as.character(rows[[label_col]]) else as.character(rows$name),
    stringsAsFactors = FALSE
  )
}

.transform_dummy_code_from_name <- function(col, parent) {
  pat <- paste0("^", .dn_escape_regex(parent), "([_/.])(.+)$")
  if (!grepl(pat, col, perl = TRUE)) return(NA_character_)
  code <- sub(pat, "\\2", col, perl = TRUE)
  code <- sub("^0+([0-9]+)$", "\\1", code)
  if (!nzchar(code)) "0" else code
}

.transform_dummy_map <- function(data, target_variable, choices = NULL, choice_map = NULL) {
  if (!is.data.frame(data) || !length(names(data))) return(character(0))
  if (!is.null(choices) && is.data.frame(choices) && nrow(choices) &&
      exists(".dn_match_sm_dummy_columns", mode = "function")) {
    dummies <- .dn_match_sm_dummy_columns(data, target_variable, choices, choice_map = choice_map)
    dummies <- dummies[!is.na(dummies) & nzchar(dummies) & dummies %in% names(data)]
    return(dummies)
  }

  dummies <- if (exists(".find_select_multiple_dummies", mode = "function")) {
    .find_select_multiple_dummies(target_variable, names(data))
  } else {
    pat <- paste0("^", .dn_escape_regex(target_variable), "[_/.][^_/.]+$")
    names(data)[grepl(pat, names(data), perl = TRUE)]
  }
  codes <- vapply(dummies, .transform_dummy_code_from_name, character(1), parent = target_variable)
  ok <- !is.na(codes) & nzchar(codes)
  stats::setNames(dummies[ok], codes[ok])
}

.transform_dummy_selected_value <- function(col) {
  if (is.logical(col)) return(TRUE)
  labs <- attr(col, "labels", exact = TRUE)
  if (!is.null(labs) && length(labs) == 1L) {
    selected <- unname(labs)[1]
    if (is.numeric(col)) return(suppressWarnings(as.numeric(selected)))
    return(as.character(selected))
  }
  x_chr <- trimws(as.character(col))
  x_num <- suppressWarnings(as.numeric(x_chr))
  if (!all(is.na(x_num))) return(1)
  lower_vals <- unique(tolower(x_chr[!is.na(x_chr) & nzchar(x_chr)]))
  lower_vals_ascii <- suppressWarnings(iconv(lower_vals, from = "", to = "ASCII//TRANSLIT", sub = ""))
  if (any(lower_vals %in% "si") || any(lower_vals_ascii %in% "si")) return("Si")
  if (any(lower_vals %in% c("yes", "y", "true"))) return("Yes")
  "Si"
}

.transform_dummy_unselected_value <- function(col) {
  if (is.logical(col)) return(FALSE)
  if (is.numeric(col)) return(0)
  x_chr <- trimws(as.character(col))
  x_num <- suppressWarnings(as.numeric(x_chr))
  if (!all(is.na(x_num))) return(0)
  lower_vals <- unique(tolower(x_chr[!is.na(x_chr) & nzchar(x_chr)]))
  lower_vals_ascii <- suppressWarnings(iconv(lower_vals, from = "", to = "ASCII//TRANSLIT", sub = ""))
  if (any(lower_vals %in% "no") || any(lower_vals_ascii %in% "no")) return("No")
  "No"
}

#' Completar jerarquia manual de una pregunta select_multiple.
#'
#' `hierarchy_map` define, por codigo marcado, que codigos se deben agregar.
#' Ejemplo: list("5" = c("1", "2", "3")).
complete_select_multiple_hierarchy <- function(data,
                                               target_variable,
                                               hierarchy_map,
                                               rows = NULL,
                                               instrumento = NULL,
                                               case_ids = NULL,
                                               decision_id = "",
                                               source_id = "",
                                               rationale = "") {
  if (!is.data.frame(data)) {
    return(list(data = data, trace = tibble::tibble(), warnings = character(0),
                impact = list(cells_changed = 0L, transformations = 0L)))
  }
  target_variable <- as.character(target_variable %||% "")[1]
  map <- .transform_normalize_hierarchy_map(hierarchy_map)
  if (!nzchar(target_variable) || !length(map)) {
    return(list(data = data, trace = tibble::tibble(), warnings = character(0),
                impact = list(cells_changed = 0L, transformations = 0L)))
  }

  data_out <- data
  n <- nrow(data_out)
  if (is.null(rows)) rows <- rep(TRUE, n)
  rows <- as.logical(rows)
  rows[is.na(rows)] <- FALSE
  if (length(rows) != n) rows <- rep(FALSE, n)

  choices <- .transform_select_multiple_choices(instrumento, target_variable)
  choice_order <- choices$name
  all_codes <- unique(c(choice_order, names(map), unlist(map, use.names = FALSE)))
  if (!length(choice_order)) choice_order <- all_codes

  dummy_map <- .transform_dummy_map(data_out, target_variable, choices)
  has_mother <- target_variable %in% names(data_out)
  if (!has_mother && !length(dummy_map)) {
    warning_msg <- sprintf("No se encontro la variable '%s' ni columnas dummy asociadas.", target_variable)
    return(list(data = data_out, trace = tibble::tibble(), warnings = warning_msg,
                impact = list(cells_changed = 0L, transformations = 0L)))
  }

  trace_rows <- list()
  warnings <- character(0)
  cells_changed <- 0L

  idx_rows <- which(rows)
  for (i in idx_rows) {
    selected <- character(0)
    before_value <- NA_character_
    if (has_mother) {
      before_value <- as.character(data_out[[target_variable]][i])
      selected <- c(selected, .transform_tokenize_sm(before_value))
    }
    if (length(dummy_map)) {
      dummy_selected <- names(dummy_map)[vapply(dummy_map, function(col) {
        .dn_is_selected_dummy(data_out[[col]])[i]
      }, logical(1))]
      selected <- c(selected, dummy_selected)
      if (!has_mother) before_value <- paste(.transform_order_tokens(dummy_selected, choice_order), collapse = " ")
    }
    selected <- unique(.transform_chr(selected))

    triggers <- intersect(names(map), selected)
    if (!length(triggers)) next
    additions <- unique(.transform_chr(unlist(map[triggers], use.names = FALSE)))
    missing <- setdiff(additions, selected)
    if (!length(missing)) next

    after_tokens <- .transform_order_tokens(c(selected, missing), choice_order)
    after_value <- .transform_join_sm(after_tokens, choice_order)
    changed_cols <- character(0)

    if (has_mother && !identical(as.character(before_value), as.character(after_value))) {
      data_out[[target_variable]][i] <- after_value
      changed_cols <- c(changed_cols, target_variable)
    }

    missing_dummy_cols <- character(0)
    for (code in missing) {
      dummy_col <- if (code %in% names(dummy_map)) unname(dummy_map[[code]]) else NA_character_
      if (is.na(dummy_col) || !nzchar(dummy_col) || !(dummy_col %in% names(data_out))) {
        if (!has_mother || length(dummy_map)) {
          missing_dummy_cols <- c(missing_dummy_cols, code)
        }
        next
      }
      currently_selected <- .dn_is_selected_dummy(data_out[[dummy_col]])[i]
      if (isTRUE(currently_selected)) next
      data_out[[dummy_col]][i] <- .transform_dummy_selected_value(data_out[[dummy_col]])
      changed_cols <- c(changed_cols, dummy_col)
    }

    if (length(missing_dummy_cols)) {
      warnings <- c(warnings, sprintf(
        "%s: no hay columna dummy para codigo(s) %s.",
        target_variable,
        paste(unique(missing_dummy_cols), collapse = ", ")
      ))
    }
    if (!length(changed_cols)) next

    cells_changed <- cells_changed + length(unique(changed_cols))
    trace_rows[[length(trace_rows) + 1L]] <- tibble::tibble(
      decision_id = as.character(decision_id %||% ""),
      source_id = as.character(source_id %||% ""),
      target_variable = target_variable,
      action_type = "complete_select_multiple_hierarchy",
      case_id = as.character(if (!is.null(case_ids) && length(case_ids) >= i) case_ids[[i]] else i),
      before_value = as.character(before_value %||% ""),
      after_value = as.character(after_value %||% ""),
      trigger_codes = paste(triggers, collapse = " "),
      added_codes = paste(missing, collapse = " "),
      changed_columns = paste(unique(changed_cols), collapse = ", "),
      n_celdas = as.integer(length(unique(changed_cols))),
      rationale = as.character(rationale %||% "")
    )
  }

  trace <- if (length(trace_rows)) dplyr::bind_rows(trace_rows) else tibble::tibble()
  list(
    data = data_out,
    trace = trace,
    warnings = unique(warnings),
    impact = list(
      cells_changed = as.integer(cells_changed),
      transformations = as.integer(nrow(trace))
    )
  )
}

#' Ajustar manualmente una pregunta select_multiple.
#'
#' Permite agregar y/o quitar codigos en variable madre tokenizada y/o dummies.
adjust_select_multiple_values <- function(data,
                                          target_variable,
                                          add_codes = character(0),
                                          remove_codes = character(0),
                                          rows = NULL,
                                          instrumento = NULL,
                                          case_ids = NULL,
                                          decision_id = "",
                                          source_id = "",
                                          rationale = "") {
  if (!is.data.frame(data)) {
    return(list(data = data, trace = tibble::tibble(), warnings = character(0),
                impact = list(cells_changed = 0L, transformations = 0L)))
  }
  target_variable <- as.character(target_variable %||% "")[1]
  add_codes <- .transform_chr(add_codes)
  remove_codes <- .transform_chr(remove_codes)
  if (!nzchar(target_variable) || (!length(add_codes) && !length(remove_codes))) {
    return(list(data = data, trace = tibble::tibble(), warnings = character(0),
                impact = list(cells_changed = 0L, transformations = 0L)))
  }

  data_out <- data
  n <- nrow(data_out)
  if (is.null(rows)) rows <- rep(TRUE, n)
  rows <- as.logical(rows)
  rows[is.na(rows)] <- FALSE
  if (length(rows) != n) rows <- rep(FALSE, n)

  choices <- .transform_select_multiple_choices(instrumento, target_variable)
  choice_order <- choices$name
  all_codes <- unique(c(choice_order, add_codes, remove_codes))
  if (!length(choice_order)) choice_order <- all_codes

  dummy_map <- .transform_dummy_map(data_out, target_variable, choices)
  has_mother <- target_variable %in% names(data_out)
  if (!has_mother && !length(dummy_map)) {
    warning_msg <- sprintf("No se encontro la variable '%s' ni columnas dummy asociadas.", target_variable)
    return(list(data = data_out, trace = tibble::tibble(), warnings = warning_msg,
                impact = list(cells_changed = 0L, transformations = 0L)))
  }

  trace_rows <- list()
  warnings <- character(0)
  cells_changed <- 0L
  for (i in which(rows)) {
    selected <- character(0)
    before_value <- NA_character_
    if (has_mother) {
      before_value <- as.character(data_out[[target_variable]][i])
      selected <- c(selected, .transform_tokenize_sm(before_value))
    }
    if (length(dummy_map)) {
      dummy_selected <- names(dummy_map)[vapply(dummy_map, function(col) {
        .dn_is_selected_dummy(data_out[[col]])[i]
      }, logical(1))]
      selected <- c(selected, dummy_selected)
      if (!has_mother) before_value <- paste(.transform_order_tokens(dummy_selected, choice_order), collapse = " ")
    }
    selected <- unique(.transform_chr(selected))
    after_tokens <- setdiff(unique(c(selected, add_codes)), remove_codes)
    after_tokens <- .transform_order_tokens(after_tokens, choice_order)
    after_value <- .transform_join_sm(after_tokens, choice_order)
    changed_cols <- character(0)

    if (has_mother && !identical(as.character(before_value), as.character(after_value))) {
      data_out[[target_variable]][i] <- after_value
      changed_cols <- c(changed_cols, target_variable)
    }

    missing_dummy_cols <- character(0)
    for (code in add_codes) {
      dummy_col <- if (code %in% names(dummy_map)) unname(dummy_map[[code]]) else NA_character_
      if (is.na(dummy_col) || !nzchar(dummy_col) || !(dummy_col %in% names(data_out))) {
        if (!has_mother || length(dummy_map)) missing_dummy_cols <- c(missing_dummy_cols, code)
        next
      }
      if (!isTRUE(.dn_is_selected_dummy(data_out[[dummy_col]])[i])) {
        data_out[[dummy_col]][i] <- .transform_dummy_selected_value(data_out[[dummy_col]])
        changed_cols <- c(changed_cols, dummy_col)
      }
    }
    for (code in remove_codes) {
      dummy_col <- if (code %in% names(dummy_map)) unname(dummy_map[[code]]) else NA_character_
      if (is.na(dummy_col) || !nzchar(dummy_col) || !(dummy_col %in% names(data_out))) {
        if (!has_mother || length(dummy_map)) missing_dummy_cols <- c(missing_dummy_cols, code)
        next
      }
      if (isTRUE(.dn_is_selected_dummy(data_out[[dummy_col]])[i])) {
        data_out[[dummy_col]][i] <- .transform_dummy_unselected_value(data_out[[dummy_col]])
        changed_cols <- c(changed_cols, dummy_col)
      }
    }
    if (length(missing_dummy_cols)) {
      warnings <- c(warnings, sprintf(
        "%s: no hay columna dummy para codigo(s) %s.",
        target_variable,
        paste(unique(missing_dummy_cols), collapse = ", ")
      ))
    }
    if (!length(changed_cols)) next
    cells_changed <- cells_changed + length(unique(changed_cols))
    trace_rows[[length(trace_rows) + 1L]] <- tibble::tibble(
      decision_id = as.character(decision_id %||% ""),
      source_id = as.character(source_id %||% ""),
      target_variable = target_variable,
      action_type = "adjust_select_multiple",
      case_id = as.character(if (!is.null(case_ids) && length(case_ids) >= i) case_ids[[i]] else i),
      before_value = as.character(before_value %||% ""),
      after_value = as.character(after_value %||% ""),
      added_codes = paste(add_codes, collapse = " "),
      removed_codes = paste(remove_codes, collapse = " "),
      changed_columns = paste(unique(changed_cols), collapse = ", "),
      n_celdas = as.integer(length(unique(changed_cols))),
      rationale = as.character(rationale %||% "")
    )
  }

  trace <- if (length(trace_rows)) dplyr::bind_rows(trace_rows) else tibble::tibble()
  list(
    data = data_out,
    trace = trace,
    warnings = unique(warnings),
    impact = list(
      cells_changed = as.integer(cells_changed),
      transformations = as.integer(nrow(trace))
    )
  )
}
