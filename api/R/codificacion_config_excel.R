.codif_excel_scalar <- function(x, default = "") {
  .codif_config_scalar(x, default)
}

.codif_excel_nonempty <- function(x) {
  x <- trimws(as.character(x %||% ""))
  x[!is.na(x) & nzchar(x)]
}

.codif_excel_sheet_base_id <- function(sheet) {
  norm <- .codif_config_norm(sheet)
  aliases <- list(
    telecomunicaciones = "telecomunicaciones",
    electronica = "electronica",
    geologica = "geologica",
    informatica = "informatica",
    mecanica = "mecanica",
    mecatronica = "mecatronica",
    industrial = "industrial",
    civil = "civil",
    minas = "minas"
  )
  aliases[[norm]] %||% norm
}

.codif_excel_recat_cols <- function(cols) {
  norms <- vapply(cols, .codif_config_norm, character(1))
  which(grepl("recat|recategorizado|recategorizada|categoria_de_puesto|categoria_de_funcion", norms))
}

.codif_excel_source_col_for_recat <- function(cols, recat_idx) {
  if (recat_idx <= 1L) return(NA_integer_)
  recat_norm <- .codif_config_norm(cols[[recat_idx]])
  prev_idx <- recat_idx - 1L
  prev_norm <- .codif_config_norm(cols[[prev_idx]])
  if (grepl("puesto", recat_norm)) {
    candidates <- which(grepl("puesto", vapply(cols, .codif_config_norm, character(1))) &
      seq_along(cols) < recat_idx)
    if (length(candidates)) return(candidates[[length(candidates)]])
  }
  if (grepl("principal", recat_norm)) {
    candidates <- which(grepl("funcion.*principal|funcion_?1", vapply(cols, .codif_config_norm, character(1))) &
      seq_along(cols) < recat_idx)
    if (length(candidates)) return(candidates[[length(candidates)]])
  }
  prev_idx
}

.codif_excel_pair_key <- function(label) {
  norm <- .codif_config_norm(label)
  if (grepl("puesto", norm)) return("puesto")
  if (grepl("funcion.*principal|funcion_?principal|funcion_?1", norm)) return("funcion_1")
  hit <- regmatches(norm, regexpr("funcion_?[2-5]", norm))
  if (length(hit) && nzchar(hit)) return(gsub("funcion_?", "funcion_", hit))
  if (grepl("mejoras?.*carrera|mejorar.*carrera|p35", norm)) return("p35")
  ""
}

.codif_excel_inventory_key <- function(item) {
  label_norm <- .codif_config_norm(item$label)
  name_norm <- .codif_config_norm(item$name)
  if (grepl("puesto.*actual", label_norm) || identical(name_norm, "p23")) return("puesto")
  for (i in 1:5) {
    if (grepl(sprintf("funcion_?%s", i), label_norm) ||
        identical(name_norm, sprintf("p24_%s", i))) {
      return(sprintf("funcion_%s", i))
    }
  }
  if (grepl("mejorar.*carrera|mejoras?.*carrera", label_norm) ||
      identical(name_norm, "p35")) return("p35")
  ""
}

.codif_excel_best_target_base <- function(source_base, target_bases) {
  exact <- target_bases[vapply(target_bases, function(target_base) {
    .codif_config_base_matches(source_base, target_base, allow_alias = FALSE)
  }, logical(1))]
  if (length(exact)) return(exact[[1]])
  aliases <- target_bases[vapply(target_bases, function(target_base) {
    .codif_config_base_matches(source_base, target_base, allow_alias = TRUE)
  }, logical(1))]
  if (length(aliases) == 1L) aliases[[1]] else ""
}

.codif_excel_match_variable <- function(sid, target_base, source_label) {
  inv <- .codif_config_inventory_for_source(sid, target_base)
  if (!length(inv)) return(NULL)
  key <- .codif_excel_pair_key(source_label)
  if (nzchar(key)) {
    keyed <- Filter(function(item) identical(.codif_excel_inventory_key(item), key), inv)
    if (length(keyed)) return(keyed[[1]])
  }

  source_norm <- .codif_config_norm(source_label)
  if (!nzchar(source_norm)) return(NULL)
  scored <- lapply(inv, function(item) {
    label_norm <- .codif_config_norm(item$label)
    name_norm <- .codif_config_norm(item$name)
    score <- 0L
    if (identical(source_norm, label_norm)) score <- 100L
    else if (grepl(source_norm, label_norm, fixed = TRUE) || grepl(label_norm, source_norm, fixed = TRUE)) score <- 75L
    else if (identical(source_norm, name_norm)) score <- 60L
    c(item, list(score = score))
  })
  scored <- scored[vapply(scored, function(x) as.integer(x$score %||% 0L) > 0L, logical(1))]
  if (!length(scored)) return(NULL)
  scored[[which.max(vapply(scored, function(x) as.integer(x$score), integer(1)))]]
}

.codif_excel_groups <- function(raw_values, category_values) {
  raw_values <- trimws(as.character(raw_values))
  category_values <- trimws(as.character(category_values))
  keep <- !is.na(raw_values) & nzchar(raw_values) &
    !is.na(category_values) & nzchar(category_values)
  raw_values <- raw_values[keep]
  category_values <- category_values[keep]
  if (!length(raw_values)) return(list())

  categories <- unique(category_values)
  lapply(seq_along(categories), function(i) {
    category <- categories[[i]]
    vals <- unique(raw_values[category_values == category])
    vals <- vals[!is.na(vals) & nzchar(vals)]
    list(
      codigo = as.character(i),
      etiqueta = category,
      origen = "nuevo",
      respuestas = as.list(vals)
    )
  })
}

.codif_excel_variable_from_groups <- function(source_base, target_base, variable, source_label, groups) {
  options <- variable$options %||% list()
  name <- .codif_excel_scalar(variable$name)
  label <- .codif_excel_scalar(variable$label, source_label)
  type <- .codif_excel_scalar(variable$type, "text")
  row <- list(
    use = TRUE,
    q_order = NA_integer_,
    tipo = type,
    modo_so = if (identical(type, "select_one")) "padre" else "",
    parent = name,
    parent_label = label,
    list_norm = "",
    parent_col = name,
    text_col = if (identical(type, "text")) name else "",
    other_dummy_col = ""
  )
  list(
    id = paste(source_base, name, sep = "::"),
    role = "external_categorization",
    base_id = source_base,
    base_label = target_base,
    scope = "base",
    name = name,
    label = label,
    type = type,
    list_norm = "",
    parent_col = name,
    text_col = if (identical(type, "text")) name else "",
    mode_so = row$modo_so,
    fingerprint = .codif_config_variable_fingerprint(name, label, type, target_base, options),
    options_fingerprint = .codif_config_hash(options),
    options = options,
    categories = .codif_config_categories(groups),
    rules = list(),
    recodes = .codif_config_recodes(groups),
    bins = list(),
    configuration = list(
      familias_row = row,
      grupos = groups,
      marcada = TRUE,
      respuestas_recod = as.list(unique(unlist(lapply(groups, function(g) g$respuestas %||% list()), use.names = FALSE)))
    )
  )
}

codif_config_bundle_from_categorization_xlsx <- function(sid, path, file_name = "") {
  if (!file.exists(path)) {
    stop_api(404, "E_CODIF_EXCEL_NOT_FOUND", sprintf("No existe el archivo: %s", path))
  }
  if (!requireNamespace("readxl", quietly = TRUE)) {
    stop_api(500, "E_NO_READXL", "El paquete R 'readxl' no está instalado.")
  }

  sheets <- readxl::excel_sheets(path)
  target_bases <- .codif_config_base_names(sid)
  variables <- list()
  sheet_summaries <- list()
  warnings <- list()

  for (sheet in sheets) {
    source_base <- .codif_excel_sheet_base_id(sheet)
    target_base <- .codif_excel_best_target_base(source_base, target_bases)
    if (!nzchar(target_base)) {
      warnings[[length(warnings) + 1L]] <- sprintf("Hoja '%s': no se encontró una base destino única.", sheet)
      next
    }

    df <- tryCatch(
      as.data.frame(readxl::read_excel(path, sheet = sheet, .name_repair = "unique"), stringsAsFactors = FALSE, check.names = FALSE),
      error = function(e) NULL
    )
    if (is.null(df) || !nrow(df) || !ncol(df)) next
    cols <- names(df)
    recat_cols <- .codif_excel_recat_cols(cols)
    sheet_count <- 0L
    for (recat_idx in recat_cols) {
      source_idx <- .codif_excel_source_col_for_recat(cols, recat_idx)
      if (is.na(source_idx) || source_idx < 1L || source_idx > length(cols)) next
      source_label <- .codif_excel_scalar(cols[[source_idx]])
      groups <- .codif_excel_groups(df[[source_idx]], df[[recat_idx]])
      if (!length(groups)) next

      variable <- .codif_excel_match_variable(sid, target_base, source_label)
      if (is.null(variable)) {
        warnings[[length(warnings) + 1L]] <- sprintf(
          "Hoja '%s': no se pudo mapear la columna '%s' a una variable del XLSForm.",
          sheet, source_label
        )
        next
      }
      variables[[length(variables) + 1L]] <- .codif_excel_variable_from_groups(
        source_base, target_base, variable, source_label, groups
      )
      sheet_count <- sheet_count + 1L
    }
    sheet_summaries[[length(sheet_summaries) + 1L]] <- list(
      sheet = sheet,
      base_id = source_base,
      target_base_id = target_base,
      variables = as.integer(sheet_count)
    )
  }

  source_file <- .codif_excel_scalar(file_name, "")
  if (!nzchar(source_file)) source_file <- basename(path)
  list(
    ok = TRUE,
    schema_version = CODIF_CONFIG_SCHEMA_VERSION,
    exported_at = .codif_config_now(),
    app_version = .codif_config_app_version(),
    project_label = tools::file_path_sans_ext(basename(source_file)),
    mode = if (length(target_bases) > 1L || length(unique(vapply(variables, function(v) .codif_excel_scalar(v$base_id), character(1)))) > 1L) {
      "multibase"
    } else {
      "unibase"
    },
    processing_mode = .codif_config_processing_mode(sid),
    suggested_filename = sub("\\.xlsx?$", ".json", basename(source_file), ignore.case = TRUE),
    variables = variables,
    metadata = list(
      source = "prosecnur_categorization_excel",
      notes = "Importado desde Excel de categorización: pares respuesta original / recategorización.",
      exported_bases = as.list(unique(vapply(variables, function(v) .codif_excel_scalar(v$base_id), character(1)))),
      contains_case_rows = FALSE,
      contains_response_match_values = TRUE,
      sheets = sheet_summaries,
      warnings = warnings
    )
  )
}

# ---- Matrices de codificacion (P35 + laborales) ----------------------------

.codif_matrix_sheet_aliases <- function() {
  list(
    civil = "ingenieria_civil",
    telecom = "ingenieria_de_las_telecomunicaciones",
    telecomunicaciones = "ingenieria_de_las_telecomunicaciones",
    electronica = "ingenieria_electronica",
    geologica = "ingenieria_geologica",
    informatica = "ingenieria_informatica",
    mecanica = "ingenieria_mecanica",
    mecatronica = "ingenieria_mecatronica",
    industrial = "ingenieria_industrial",
    minas = "ingenieria_de_minas"
  )
}

.codif_matrix_sheet_base <- function(sheet, target_bases) {
  norm <- .codif_config_norm(sheet)
  alias <- .codif_matrix_sheet_aliases()[[norm]] %||% norm
  target <- .codif_excel_best_target_base(alias, target_bases)
  if (nzchar(target)) target else ""
}

.codif_matrix_col_index <- function(cols, aliases) {
  norms <- vapply(cols, .codif_config_norm, character(1))
  aliases <- vapply(aliases, .codif_config_norm, character(1))
  hit <- which(norms %in% aliases)[1]
  if (!is.na(hit)) return(hit)
  for (alias in aliases) {
    hit <- which(grepl(alias, norms, fixed = TRUE))[1]
    if (!is.na(hit)) return(hit)
  }
  NA_integer_
}

.codif_matrix_text_aliases <- function() {
  c("texto_p35", "texto_original", "respuesta_original", "respuesta", "texto", "valor_original")
}

.codif_matrix_case_variable_names <- function(df, text_idx) {
  cols <- names(df)
  var_idx <- .codif_matrix_col_index(cols, c("variable", "pregunta", "variable_fuente", "variable_origen"))
  if (!is.na(var_idx)) {
    vars <- unique(trimws(as.character(df[[var_idx]])))
    vars <- vars[!is.na(vars) & nzchar(vars)]
    if (length(vars)) return(vars)
  }
  text_col <- .codif_config_norm(cols[[text_idx]] %||% "")
  if (grepl("^texto_", text_col)) {
    candidate <- sub("^texto_", "", text_col)
    if (nzchar(candidate)) return(candidate)
  }
  if (!text_col %in% .codif_matrix_text_aliases() && nzchar(text_col)) return(text_col)
  "p35"
}

.codif_matrix_case_filter_variable <- function(df, variable) {
  var_idx <- .codif_matrix_col_index(names(df), c("variable", "pregunta", "variable_fuente", "variable_origen"))
  if (is.na(var_idx)) return(df)
  keep <- trimws(as.character(df[[var_idx]])) == variable
  df[keep, , drop = FALSE]
}

.codif_matrix_norm_vec <- function(x) {
  x <- as.character(x %||% "")
  x[is.na(x)] <- ""
  x <- trimws(tolower(x))
  x <- if (requireNamespace("stringi", quietly = TRUE)) {
    stringi::stri_trans_general(x, "Latin-ASCII")
  } else {
    iconv(x, from = "", to = "ASCII//TRANSLIT", sub = "")
  }
  x[is.na(x)] <- ""
  gsub("_+", "_", gsub("^_+|_+$", "", gsub("[^a-z0-9]+", "_", x)))
}

.codif_matrix_is_review <- function(x) {
  identical(.codif_config_norm(x), "revision")
}

.codif_matrix_new_group <- function(code, label, responses, cases = list(), notes = list()) {
  list(
    codigo = .codif_config_scalar(code, ""),
    etiqueta = .codif_config_scalar(label, ""),
    origen = "nuevo",
    codif_origin = "matrix",
    matrix_import = TRUE,
    respuestas = as.list(unique(as.character(responses))),
    matrix_cases = cases %||% list(),
    matrix_notes = notes %||% list()
  )
}

.codif_matrix_tag_groups <- function(groups, layout, source_label = "") {
  lapply(groups %||% list(), function(g) {
    g$codif_origin <- "matrix"
    g$matrix_import <- TRUE
    g$matrix_layout <- .codif_config_scalar(layout, "")
    g$matrix_source_label <- .codif_config_scalar(source_label, "")
    g
  })
}

.codif_matrix_variable <- function(source_base, target_base, variable, source_label, groups,
                                   layout, rows_count = 0L, diagnostics = list()) {
  groups <- .codif_matrix_tag_groups(groups, layout, source_label)
  out <- .codif_excel_variable_from_groups(source_base, target_base, variable, source_label, groups)
  out$id <- paste(target_base, out$name, sep = "::")
  out$base_id <- target_base
  out$base_label <- source_base
  out$role <- "matrix_categorization"
  out$metadata <- c(list(
    matrix_layout = layout,
    matrix_rows = as.integer(rows_count),
    diagnostics = diagnostics
  ), out$metadata %||% list())
  out
}

.codif_matrix_case_code_groups <- function(df, sheet, warnings) {
  cols <- names(df)
  id_idx <- .codif_matrix_col_index(cols, c("id_caso", "case_id", "response_id"))
  text_idx <- .codif_matrix_col_index(cols, .codif_matrix_text_aliases())
  code_idx <- .codif_matrix_col_index(cols, c("codigo", "code"))
  label_idx <- .codif_matrix_col_index(cols, c("codificacion", "categoria", "etiqueta", "label"))
  obs_idx <- .codif_matrix_col_index(cols, c("obs", "observacion", "nota"))
  if (any(is.na(c(id_idx, text_idx, code_idx, label_idx)))) {
    return(list(groups = list(), diagnostics = list(), warnings = warnings))
  }

  case_id <- trimws(as.character(df[[id_idx]]))
  text <- trimws(as.character(df[[text_idx]]))
  code <- trimws(as.character(df[[code_idx]]))
  label <- trimws(as.character(df[[label_idx]]))
  obs <- if (!is.na(obs_idx)) trimws(as.character(df[[obs_idx]])) else rep("", nrow(df))
  obs[is.na(obs)] <- ""
  keep <- nzchar(case_id) & nzchar(text) & nzchar(code) & nzchar(label)
  case_id <- case_id[keep]
  text <- text[keep]
  code <- code[keep]
  label <- label[keep]
  obs <- obs[keep]

  if (!length(code)) {
    return(list(groups = list(), diagnostics = list(rows = 0L), warnings = warnings))
  }

  code_label_norm <- split(.codif_matrix_norm_vec(label), code)
  conflicts <- names(code_label_norm)[vapply(code_label_norm, function(x) length(unique(x[nzchar(x)])) > 1L, logical(1))]
  if (length(conflicts)) {
    warnings[[length(warnings) + 1L]] <- sprintf(
      "Hoja '%s': el/los código(s) %s tienen más de una etiqueta.",
      sheet,
      paste(conflicts, collapse = ", ")
    )
  }

  keys <- unique(code)
  groups <- vector("list", length(keys))
  for (i in seq_along(keys)) {
    k <- keys[[i]]
    idx <- which(code == k)
    label_first <- label[idx][which(nzchar(label[idx]))[1]]
    cases <- lapply(idx, function(j) {
      list(
        id_caso = case_id[[j]],
        respuesta = text[[j]],
        codigo = code[[j]],
        etiqueta = label[[j]],
        obs = obs[[j]]
      )
    })
    notes <- as.list(unique(obs[idx][nzchar(obs[idx])]))
    groups[[i]] <- .codif_matrix_new_group(k, label_first, text[idx], cases = cases, notes = notes)
  }

  duplicate_case_rows <- sum(duplicated(paste(case_id, text)))
  diagnostics <- list(
    rows = as.integer(length(code)),
    unique_cases = as.integer(length(unique(case_id))),
    unique_texts = as.integer(length(unique(text))),
    duplicate_case_rows = as.integer(duplicate_case_rows),
    code_label_conflicts = as.list(conflicts),
    blocking = length(conflicts) > 0L
  )
  list(groups = groups, diagnostics = diagnostics, warnings = warnings)
}

.codif_matrix_final_header_at <- function(raw, header_row, start_col) {
  if (is.null(raw) || !is.data.frame(raw) || header_row > nrow(raw) || start_col + 3L > ncol(raw)) {
    return(FALSE)
  }
  cell_norm <- function(col) .codif_config_norm(raw[[col]][[header_row]] %||% "")
  identical(cell_norm(start_col), "id_caso") &&
    identical(cell_norm(start_col + 1L), "respuesta") &&
    cell_norm(start_col + 2L) %in% c("codigo", "code") &&
    cell_norm(start_col + 3L) %in% c("categoria", "codificacion", "etiqueta")
}

.codif_matrix_final_work_blocks <- function(raw) {
  if (is.null(raw) || !is.data.frame(raw) || nrow(raw) < 3L || ncol(raw) < 4L) return(list())
  blocks <- list()
  for (header_row in seq_len(nrow(raw) - 1L)) {
    title_row <- header_row - 1L
    if (title_row < 1L) next
    for (start_col in seq_len(max(1L, ncol(raw) - 3L))) {
      if (!.codif_matrix_final_header_at(raw, header_row, start_col)) next
      title <- .codif_config_scalar(raw[[start_col]][[title_row]], "")
      if (!nzchar(title)) next
      has_obs <- start_col + 4L <= ncol(raw) &&
        .codif_config_norm(raw[[start_col + 4L]][[header_row]] %||% "") %in% c("observaciones", "obs", "observacion", "nota")
      end_col <- start_col + if (isTRUE(has_obs)) 4L else 3L
      data_start <- header_row + 1L
      if (data_start > nrow(raw)) next
      block <- raw[data_start:nrow(raw), start_col:end_col, drop = FALSE]
      names(block) <- if (isTRUE(has_obs)) {
        c("id_caso", "texto_original", "codigo", "codificacion", "obs")
      } else {
        c("id_caso", "texto_original", "codigo", "codificacion")
      }
      if (!"obs" %in% names(block)) block$obs <- ""
      block[] <- lapply(block, function(x) {
        x <- trimws(as.character(x))
        x[is.na(x)] <- ""
        x
      })
      keep <- apply(block, 1L, function(row) any(nzchar(row)))
      block <- block[keep, , drop = FALSE]
      if (!nrow(block)) next
      blocks[[length(blocks) + 1L]] <- list(
        label = title,
        data = block,
        rows = as.integer(nrow(block)),
        start_row = as.integer(header_row),
        start_col = as.integer(start_col)
      )
    }
  }
  blocks
}

.codif_matrix_case_coverage <- function(sid, target_base, groups, diagnostics) {
  rows <- unlist(lapply(groups %||% list(), function(g) g$matrix_cases %||% list()), recursive = FALSE)
  case_ids <- unique(vapply(rows, function(x) .codif_config_scalar(x$id_caso, ""), character(1)))
  case_ids <- case_ids[nzchar(case_ids)]
  if (!length(case_ids)) return(diagnostics)

  dat <- tryCatch(codif_data_cached(sid, target_base), error = function(e) NULL)
  if (is.null(dat) || !is.data.frame(dat)) return(c(diagnostics, list(case_match_available = FALSE)))
  candidates <- intersect(c("response_id", "respondent_id", "id_caso", "_uuid", "uuid", "_index"), names(dat))
  if (!length(candidates)) return(c(diagnostics, list(case_match_available = FALSE)))
  data_ids <- unique(unlist(lapply(candidates, function(nm) trimws(as.character(dat[[nm]]))), use.names = FALSE))
  data_ids <- data_ids[!is.na(data_ids) & nzchar(data_ids)]
  matched <- sum(case_ids %in% data_ids)
  c(diagnostics, list(
    case_match_available = TRUE,
    matched_cases = as.integer(matched),
    unmatched_cases = as.integer(length(case_ids) - matched)
  ))
}

.codif_matrix_pair_columns <- function(cols) {
  norms <- vapply(cols, .codif_config_norm, character(1))
  out <- list()
  add_pair <- function(variable, source_patterns, category_patterns) {
    src <- which(vapply(seq_along(norms), function(i) {
      any(vapply(source_patterns, function(p) grepl(p, norms[[i]]), logical(1))) &&
        !grepl("categoria", norms[[i]])
    }, logical(1)))[1]
    cat <- which(vapply(seq_along(norms), function(i) {
      any(vapply(category_patterns, function(p) grepl(p, norms[[i]]), logical(1)))
    }, logical(1)))[1]
    if (!is.na(src) && !is.na(cat)) {
      out[[length(out) + 1L]] <<- list(variable = variable, source_idx = src, category_idx = cat)
    }
  }
  add_pair("p23", c("puesto.*actual", "^puesto_actual$", "^puesto$"), c("categoria.*puesto"))
  add_pair("p24_1", c("funcion.*principal", "cual.*funcion.*principal"), c("categoria.*funcion.*principal"))
  for (i in 2:5) {
    add_pair(sprintf("p24_%s", i), c(sprintf("funcion.*%s", i)), c(sprintf("categoria.*funcion.*%s", i)))
  }
  out
}

.codif_matrix_pair_groups <- function(df, pair) {
  raw <- trimws(as.character(df[[pair$source_idx]]))
  cat <- trimws(as.character(df[[pair$category_idx]]))
  keep <- !is.na(raw) & nzchar(raw) & !is.na(cat) & nzchar(cat)
  review <- keep & vapply(cat, .codif_matrix_is_review, logical(1))
  usable <- keep & !review
  categories <- unique(cat[usable])
  groups <- lapply(seq_along(categories), function(i) {
    category <- categories[[i]]
    vals <- unique(raw[usable & cat == category])
    .codif_matrix_new_group(as.character(i), category, vals)
  })
  list(
    groups = groups,
    diagnostics = list(
      rows = as.integer(length(raw)),
      source_nonempty = as.integer(sum(nzchar(raw) & !is.na(raw))),
      categorized = as.integer(sum(usable)),
      review_rows = as.integer(sum(review)),
      blank_category = as.integer(sum(keep == FALSE & nzchar(raw) & !is.na(raw))),
      blocking = FALSE
    )
  )
}

.codif_matrix_detect_layout <- function(cols) {
  if (!is.na(.codif_matrix_col_index(cols, c("id_caso", "case_id", "response_id"))) &&
      !is.na(.codif_matrix_col_index(cols, .codif_matrix_text_aliases())) &&
      !is.na(.codif_matrix_col_index(cols, c("codigo", "code"))) &&
      !is.na(.codif_matrix_col_index(cols, c("codificacion", "categoria", "etiqueta", "label")))) {
    return("case_code_matrix")
  }
  if (length(.codif_matrix_pair_columns(cols)) > 0L) {
    return("paired_category_matrix")
  }
  "unknown"
}

.codif_matrix_summary_number <- function(x) {
  x <- suppressWarnings(as.numeric(as.character(x %||% NA_character_)))
  if (is.na(x)) 0L else as.integer(round(x))
}

.codif_matrix_resumen_summary <- function(path, sheets) {
  resumen <- sheets[vapply(sheets, .codif_config_norm, character(1)) == "resumen"][1]
  if (is.na(resumen) || !nzchar(resumen)) return(NULL)
  df <- tryCatch(
    as.data.frame(readxl::read_excel(path, sheet = resumen, col_names = FALSE, .name_repair = "minimal"), stringsAsFactors = FALSE, check.names = FALSE),
    error = function(e) NULL
  )
  if (is.null(df) || !nrow(df) || !ncol(df)) return(NULL)
  header_idx <- which(apply(df, 1L, function(row) any(vapply(row, .codif_config_norm, character(1)) == "carrera")))[1]
  if (is.na(header_idx)) return(NULL)
  headers <- vapply(df[header_idx, , drop = TRUE], .codif_config_norm, character(1))
  col <- function(alias) {
    idx <- match(alias, headers)
    if (is.na(idx)) integer(0) else idx
  }
  cell <- function(alias, i) {
    idx <- col(alias)
    if (!length(idx)) return(NA_character_)
    df[[idx]][[i]]
  }
  total_idx <- which(vapply(df[[1]], .codif_config_norm, character(1)) == "total")[1]
  row_payload <- function(i) {
    list(
      carrera = as.character(df[[1]][[i]] %||% ""),
      filas = .codif_matrix_summary_number(cell("filas_con_datos", i)),
      puestos_categorizados = .codif_matrix_summary_number(cell("puestos_categorizados", i)),
      puestos_revision = .codif_matrix_summary_number(cell("puestos_con_revision", i)),
      funciones_categorizadas = .codif_matrix_summary_number(cell("funciones_categorizadas", i)),
      funciones_revision = .codif_matrix_summary_number(cell("funciones_con_revision", i)),
      filas_revision = .codif_matrix_summary_number(cell("filas_con_revision", i))
    )
  }
  total <- if (!is.na(total_idx)) row_payload(total_idx) else NULL
  career_rows <- seq.int(header_idx + 1L, nrow(df))
  if (!is.na(total_idx)) career_rows <- career_rows[career_rows != total_idx]
  career_rows <- career_rows[nzchar(trimws(as.character(df[[1]][career_rows] %||% "")))]
  list(
    source_sheet = resumen,
    total = total,
    by_career = lapply(career_rows, row_payload)
  )
}

codif_matrix_bundle_from_excel <- function(sid, path, file_name = "") {
  if (!file.exists(path)) {
    stop_api(404, "E_CODIF_MATRIX_NOT_FOUND", sprintf("No existe el archivo: %s", path))
  }
  if (!requireNamespace("readxl", quietly = TRUE)) {
    stop_api(500, "E_NO_READXL", "El paquete R 'readxl' no está instalado.")
  }
  sheets <- readxl::excel_sheets(path)
  target_bases <- .codif_config_base_names(sid)
  variables <- list()
  sheet_summaries <- list()
  warnings <- list()
  layouts <- character()
  matrix_summary <- .codif_matrix_resumen_summary(path, sheets)

  for (sheet in sheets) {
    if (.codif_config_norm(sheet) %in% c("diccionario", "resumen")) next
    target_base <- .codif_matrix_sheet_base(sheet, target_bases)
    if (!nzchar(target_base)) {
      warnings[[length(warnings) + 1L]] <- sprintf("Hoja '%s': no se encontró una base destino única.", sheet)
      next
    }
    raw <- tryCatch(
      as.data.frame(readxl::read_excel(path, sheet = sheet, col_names = FALSE, .name_repair = "minimal"), stringsAsFactors = FALSE, check.names = FALSE),
      error = function(e) NULL
    )
    final_blocks <- .codif_matrix_final_work_blocks(raw)
    if (length(final_blocks)) {
      layout <- "final_work_matrix"
      layouts <- unique(c(layouts, layout))
      sheet_count <- 0L
      inv <- .codif_config_inventory_for_source(sid, target_base)
      for (block in final_blocks) {
        parsed <- .codif_matrix_case_code_groups(block$data, sprintf("%s · %s", sheet, block$label), warnings)
        warnings <- parsed$warnings
        variable <- .codif_excel_match_variable(sid, target_base, block$label) %||%
          (inv[[.codif_config_scalar(block$label, "")]] %||% NULL)
        if (is.null(variable)) {
          warnings[[length(warnings) + 1L]] <- sprintf(
            "Hoja '%s': no se encontró la pregunta '%s' en la base destino.",
            sheet,
            block$label
          )
        } else if (length(parsed$groups)) {
          diagnostics <- .codif_matrix_case_coverage(sid, target_base, parsed$groups, parsed$diagnostics)
          variables[[length(variables) + 1L]] <- .codif_matrix_variable(
            .codif_excel_sheet_base_id(sheet), target_base, variable, block$label,
            parsed$groups, layout, block$rows, diagnostics
          )
          sheet_count <- sheet_count + 1L
        }
      }
      sheet_summaries[[length(sheet_summaries) + 1L]] <- list(
        sheet = sheet,
        target_base_id = target_base,
        layout = layout,
        variables = as.integer(sheet_count)
      )
      next
    }
    df <- tryCatch(
      as.data.frame(readxl::read_excel(path, sheet = sheet, .name_repair = "unique"), stringsAsFactors = FALSE, check.names = FALSE),
      error = function(e) NULL
    )
    if (is.null(df) || !nrow(df) || !ncol(df)) next
    layout <- .codif_matrix_detect_layout(names(df))
    layouts <- unique(c(layouts, layout))
    sheet_count <- 0L

    if (identical(layout, "case_code_matrix")) {
      text_idx <- .codif_matrix_col_index(names(df), .codif_matrix_text_aliases())
      case_vars <- .codif_matrix_case_variable_names(df, text_idx)
      inv <- .codif_config_inventory_for_source(sid, target_base)
      for (case_var in case_vars) {
        df_var <- .codif_matrix_case_filter_variable(df, case_var)
        parsed <- .codif_matrix_case_code_groups(df_var, sheet, warnings)
        warnings <- parsed$warnings
        variable <- .codif_excel_match_variable(sid, target_base, case_var) %||%
          (inv[[case_var]] %||% NULL)
        if (is.null(variable)) {
          warnings[[length(warnings) + 1L]] <- sprintf(
            "Hoja '%s': no se encontró la variable '%s' en la base destino.",
            sheet, case_var
          )
        } else if (length(parsed$groups)) {
          diagnostics <- .codif_matrix_case_coverage(sid, target_base, parsed$groups, parsed$diagnostics)
          variables[[length(variables) + 1L]] <- .codif_matrix_variable(
            .codif_excel_sheet_base_id(sheet), target_base, variable, case_var,
            parsed$groups, layout, nrow(df_var), diagnostics
          )
          sheet_count <- sheet_count + 1L
        }
      }
    } else if (identical(layout, "paired_category_matrix")) {
      pairs <- .codif_matrix_pair_columns(names(df))
      for (pair in pairs) {
        parsed <- .codif_matrix_pair_groups(df, pair)
        if (!length(parsed$groups)) next
        variable <- .codif_config_inventory_for_source(sid, target_base)[[pair$variable]] %||%
          .codif_excel_match_variable(sid, target_base, names(df)[[pair$source_idx]])
        if (is.null(variable)) {
          warnings[[length(warnings) + 1L]] <- sprintf(
            "Hoja '%s': no se pudo mapear la columna '%s' a una variable del XLSForm.",
            sheet, names(df)[[pair$source_idx]]
          )
          next
        }
        variables[[length(variables) + 1L]] <- .codif_matrix_variable(
          .codif_excel_sheet_base_id(sheet), target_base, variable, names(df)[[pair$source_idx]],
          parsed$groups, layout, nrow(df), parsed$diagnostics
        )
        sheet_count <- sheet_count + 1L
      }
    } else {
      warnings[[length(warnings) + 1L]] <- sprintf("Hoja '%s': no tiene un formato de matriz reconocido.", sheet)
    }

    sheet_summaries[[length(sheet_summaries) + 1L]] <- list(
      sheet = sheet,
      target_base_id = target_base,
      layout = layout,
      variables = as.integer(sheet_count)
    )
  }

  source_file <- .codif_excel_scalar(file_name, "")
  if (!nzchar(source_file)) source_file <- basename(path)
  list(
    ok = TRUE,
    schema_version = CODIF_CONFIG_SCHEMA_VERSION,
    exported_at = .codif_config_now(),
    app_version = .codif_config_app_version(),
    project_label = tools::file_path_sans_ext(basename(source_file)),
    mode = if (length(target_bases) > 1L || length(unique(vapply(variables, function(v) .codif_excel_scalar(v$base_id), character(1)))) > 1L) {
      "multibase"
    } else {
      "unibase"
    },
    processing_mode = .codif_config_processing_mode(sid),
    suggested_filename = sub("\\.(xlsx|xlsm|xls)$", ".json", basename(source_file), ignore.case = TRUE),
    variables = variables,
    metadata = list(
      source = "prosecnur_matrix_excel",
      notes = "Importado desde matriz de codificación normalizada.",
      matrix_layouts = as.list(layouts),
      matrix_summary = matrix_summary,
      exported_bases = as.list(unique(vapply(variables, function(v) .codif_excel_scalar(v$base_id), character(1)))),
      contains_case_rows = any(vapply(variables, function(v) {
        metadata <- v$metadata %||% list()
        layout <- .codif_config_scalar(metadata$matrix_layout, "")
        has_cases <- any(vapply((v$configuration %||% list())$grupos %||% list(), function(g) {
          length(g$matrix_cases %||% list()) > 0L
        }, logical(1)))
        layout %in% c("case_code_matrix", "final_work_matrix") || has_cases
      }, logical(1))),
      contains_response_match_values = TRUE,
      sheets = sheet_summaries,
      warnings = warnings
    )
  )
}

.codif_matrix_annotate_preview <- function(preview, bundle) {
  by_id <- stats::setNames(bundle$variables %||% list(), vapply(bundle$variables %||% list(), function(v) .codif_config_scalar(v$id, ""), character(1)))
  for (i in seq_along(preview$items %||% list())) {
    item <- preview$items[[i]]
    exported <- by_id[[.codif_config_scalar(item$source$id, "")]]
    diagnostics <- ((exported %||% list())$metadata %||% list())$diagnostics %||% list()
    preview$items[[i]]$matrix_layout <- ((exported %||% list())$metadata %||% list())$matrix_layout %||% ""
    preview$items[[i]]$matrix_diagnostics <- diagnostics
    if (isTRUE(diagnostics$blocking)) {
      preview$items[[i]]$status <- "conflict"
      preview$items[[i]]$can_apply <- FALSE
      preview$items[[i]]$reason <- "La matriz tiene conflictos internos que deben resolverse antes de aplicar."
    }
  }
  preview$summary <- .codif_config_preview_summary(preview$items)
  preview
}

codif_matrix_preview <- function(sid, path, file_name = "") {
  bundle <- codif_matrix_bundle_from_excel(sid, path, file_name)
  preview <- codif_config_preview_import(sid, bundle, file_name)
  preview <- .codif_matrix_annotate_preview(preview, bundle)
  preview$matrix_summary <- (bundle$metadata %||% list())$matrix_summary %||% NULL
  list(ok = TRUE, source_format = "matrix_excel", bundle = bundle, preview = preview)
}

codif_matrix_apply_import <- function(sid, bundle, selections = list(), file_name = "") {
  blocked <- vapply(bundle$variables %||% list(), function(v) {
    diagnostics <- ((v$metadata %||% list())$diagnostics %||% list())
    isTRUE(diagnostics$blocking)
  }, logical(1))
  blocked_ids <- vapply(bundle$variables %||% list(), function(v) .codif_config_scalar(v$id, ""), character(1))[blocked]
  selected_ids <- vapply(selections %||% list(), function(sel) {
    item <- .codif_config_find_preview_item(codif_config_preview_import(sid, bundle, file_name)$items, .codif_config_scalar(sel$match_id, ""))
    .codif_config_scalar((item %||% list())$source$id, "")
  }, character(1))
  if (length(intersect(blocked_ids, selected_ids))) {
    stop_api(409, "E_CODIF_MATRIX_BLOCKED", "La selección incluye matrices con conflictos internos.")
  }
  codif_config_apply_import(sid, bundle, selections, file_name)
}

.codif_matrix_case_payload <- function(case) {
  list(
    id_caso = .codif_config_scalar(case$id_caso, ""),
    respuesta = .codif_config_scalar(case$respuesta, ""),
    codigo = .codif_config_scalar(case$codigo, ""),
    etiqueta = .codif_config_scalar(case$etiqueta, ""),
    obs = .codif_config_scalar(case$obs, "")
  )
}

.codif_matrix_group_is_tagged <- function(g) {
  isTRUE(g$matrix_import) ||
    identical(.codif_config_scalar(g$codif_origin, ""), "matrix") ||
    nzchar(.codif_config_scalar(g$matrix_layout, "")) ||
    nzchar(.codif_config_scalar(g$matrix_source_label, "")) ||
    length(g$matrix_cases %||% list()) > 0L
}

.codif_matrix_legacy_variable_signature <- function(var, groups) {
  var <- .codif_config_scalar(var, "")
  if (var %in% c("p23", "p35") || grepl("^p24(_[1-5])?$", var)) return(TRUE)
  labels <- .codif_matrix_norm_vec(vapply(groups %||% list(), function(g) .codif_config_scalar(g$etiqueta, ""), character(1)))
  job_hits <- sum(labels %in% .codif_matrix_norm_vec(c(
    "Asistente Junior", "Asistente Senior", "Analista Junior", "Analista Semi-Senior (SSR)",
    "Analista Senior (SR)", "Coordinador", "Jefatura", "Gerencia"
  )))
  function_hits <- sum(labels %in% .codif_matrix_norm_vec(c(
    "Análisis de Datos, BI e IA", "Desarrollo de Software, Datos e IA",
    "Infraestructura, Redes y Ciberseguridad", "Gestión de Proyectos y Transformación",
    "Operaciones, Producción y Mantenimiento"
  )))
  job_hits >= 3L || function_hits >= 3L
}

.codif_matrix_variable_is_matrix <- function(var, groups) {
  groups <- groups %||% list()
  if (!length(groups)) return(FALSE)
  any(vapply(groups, .codif_matrix_group_is_tagged, logical(1))) ||
    .codif_matrix_legacy_variable_signature(var, groups)
}

.codif_matrix_cases_for_group <- function(sid, base, var, group) {
  explicit <- group$matrix_cases %||% list()
  if (length(explicit)) return(lapply(explicit, .codif_matrix_case_payload))
  responses <- trimws(as.character(unlist(group$respuestas %||% list(), use.names = FALSE)))
  responses <- unique(responses[!is.na(responses) & nzchar(responses)])
  if (!length(responses)) return(list())
  dat <- tryCatch(codif_data_cached(sid, base), error = function(e) NULL)
  if (is.null(dat) || !is.data.frame(dat) || !var %in% names(dat)) return(list())
  values <- trimws(as.character(dat[[var]]))
  values[is.na(values)] <- ""
  response_norm <- .codif_matrix_norm_vec(responses)
  value_norm <- .codif_matrix_norm_vec(values)
  keep <- nzchar(values) & (values %in% responses | value_norm %in% response_norm)
  idx <- which(keep)
  if (!length(idx)) return(list())
  lapply(idx, function(i) {
    list(
      id_caso = .codif_matrix_case_id_for_row(dat, i),
      respuesta = values[[i]],
      codigo = .codif_config_scalar(group$codigo, ""),
      etiqueta = .codif_config_scalar(group$etiqueta, ""),
      obs = ""
    )
  })
}

codif_matrix_map <- function(sid, base = NULL) {
  bases <- .codif_matrix_selected_bases(sid, base)
  out <- lapply(bases, function(base) {
    st <- codif_snapshot(sid, base)
    groups <- st$grupos_recod %||% list()
    inv <- .codif_config_inventory_for_source(sid, base)
    vars <- lapply(names(groups), function(var) {
      gl <- groups[[var]] %||% list()
      if (!.codif_matrix_variable_is_matrix(var, gl)) return(NULL)
      variable_label <- .codif_matrix_var_label(sid, base, var)
      variable_kind <- .codif_matrix_variable_kind(sid, base, var, inv[[var]] %||% list(), gl)
      variable_case_ids <- character()
      variable_assignments <- 0L
      variable_observations <- 0L
      categories <- lapply(gl, function(g) {
        cases <- .codif_matrix_cases_for_group(sid, base, var, g)
        case_ids <- vapply(cases, function(case) .codif_config_scalar(case$id_caso, ""), character(1))
        case_ids <- case_ids[nzchar(case_ids)]
        responses <- vapply(cases, function(case) .codif_config_scalar(case$respuesta, ""), character(1))
        responses <- unique(responses[nzchar(responses)])
        observations <- sum(vapply(cases, function(case) nzchar(.codif_config_scalar(case$obs, "")), logical(1)))
        variable_case_ids <<- c(variable_case_ids, case_ids)
        variable_assignments <<- variable_assignments + length(cases)
        variable_observations <<- variable_observations + observations
        category_role <- .codif_matrix_category_role(g$etiqueta)
        list(
          codigo = .codif_config_scalar(g$codigo, ""),
          etiqueta = .codif_config_scalar(g$etiqueta, ""),
          category_role = category_role,
          category_role_label = .codif_matrix_category_role_label(category_role),
          n_respuestas = as.integer(length(responses)),
          n_casos = as.integer(length(unique(case_ids))),
          n_asignaciones = as.integer(length(cases)),
          n_observaciones = as.integer(observations),
          cases = lapply(utils::head(cases, 80L), .codif_matrix_case_payload)
        )
      })
      categories <- Filter(function(category) {
        nzchar(.codif_config_scalar(category$codigo, "")) ||
          nzchar(.codif_config_scalar(category$etiqueta, "")) ||
          as.integer(category$n_respuestas %||% 0L) > 0L ||
          as.integer(category$n_casos %||% 0L) > 0L
      }, categories)
      list(
        variable = var,
        variable_label = variable_label,
        variable_kind = variable_kind,
        variable_kind_label = .codif_matrix_variable_kind_label(variable_kind),
        n_categorias = as.integer(length(categories)),
        n_casos = as.integer(length(unique(variable_case_ids[nzchar(variable_case_ids)]))),
        n_asignaciones = as.integer(variable_assignments),
        n_observaciones = as.integer(variable_observations),
        categories = categories
      )
    })
    vars <- Filter(Negate(is.null), vars)
    list(base = base, variables = vars)
  })
  list(ok = TRUE, bases = out)
}

.codif_matrix_notes_for_case <- function(group, case_id = "", response = "") {
  cases <- group$matrix_cases %||% list()
  notes <- character()
  if (length(cases)) {
    matched_cases <- list()
    if (nzchar(case_id)) {
      matched_cases <- Filter(function(case) {
        identical(.codif_config_scalar(case$id_caso, ""), case_id)
      }, cases)
    }
    if (!length(matched_cases) && nzchar(response)) {
      response_norm <- .codif_matrix_norm_vec(response)
      matched_cases <- Filter(function(case) {
        identical(.codif_matrix_norm_vec(.codif_config_scalar(case$respuesta, "")), response_norm)
      }, cases)
    }
    if (length(matched_cases)) {
      for (case in matched_cases) {
        note <- .codif_config_scalar(case$obs, "")
        if (nzchar(note)) notes <- c(notes, note)
      }
      return(unique(notes))
    }
  }
  if (!length(notes)) {
    notes <- as.character(unlist(group$matrix_notes %||% list(), use.names = FALSE))
    notes <- notes[!is.na(notes) & nzchar(notes)]
  }
  unique(notes)
}

codif_matrix_patch_case <- function(sid, base, variable, id_caso, codigo, etiqueta, from_codigo = NULL) {
  base <- .codif_config_scalar(base, "")
  variable <- .codif_config_scalar(variable, "")
  id_caso <- .codif_config_scalar(id_caso, "")
  codigo <- .codif_config_scalar(codigo, "")
  etiqueta <- .codif_config_scalar(etiqueta, "")
  from_codigo <- .codif_config_scalar(from_codigo, "")
  if (!nzchar(base) || !nzchar(variable) || !nzchar(id_caso) || !nzchar(codigo) || !nzchar(etiqueta)) {
    stop_api(400, "E_CODIF_MATRIX_CASE_PATCH", "Faltan base, variable, id_caso, codigo o etiqueta.")
  }
  .codif_matrix_selected_bases(sid, base)
  all_grupos <- codif_get(sid, "grupos_recod", source = base) %||% list()
  groups <- all_grupos[[variable]] %||% list()
  if (!length(groups)) {
    stop_api(404, "E_CODIF_MATRIX_VARIABLE_NOT_FOUND", "La variable no tiene mapeo de matriz en esta base.")
  }

  moved <- list()
  for (i in seq_along(groups)) {
    group_code <- .codif_config_scalar(groups[[i]]$codigo, "")
    if (nzchar(from_codigo) && !identical(group_code, from_codigo)) next
    cases <- groups[[i]]$matrix_cases %||% list()
    keep <- list()
    group_moved <- list()
    for (case in cases) {
      if (identical(.codif_config_scalar(case$id_caso, ""), id_caso)) {
        next_case <- .codif_matrix_case_payload(case)
        moved[[length(moved) + 1L]] <- next_case
        group_moved[[length(group_moved) + 1L]] <- next_case
      } else {
        keep[[length(keep) + 1L]] <- case
      }
    }
    groups[[i]]$matrix_cases <- keep
    moved_responses <- unique(vapply(group_moved, function(case) .codif_config_scalar(case$respuesta, ""), character(1)))
    if (length(moved_responses)) {
      remaining <- unique(vapply(keep, function(case) .codif_config_scalar(case$respuesta, ""), character(1)))
      responses <- as.character(unlist(groups[[i]]$respuestas %||% list(), use.names = FALSE))
      responses <- responses[!is.na(responses) & nzchar(responses)]
      removable <- setdiff(moved_responses, remaining)
      groups[[i]]$respuestas <- as.list(setdiff(unique(responses), removable))
    }
  }
  if (!length(moved)) {
    stop_api(404, "E_CODIF_MATRIX_CASE_NOT_FOUND", "No se encontró ese caso en el mapeo de la base.")
  }

  target_idx <- NA_integer_
  for (i in seq_along(groups)) {
    if (identical(.codif_config_scalar(groups[[i]]$codigo, ""), codigo)) {
      target_idx <- i
      break
    }
  }
  if (is.na(target_idx)) {
    groups[[length(groups) + 1L]] <- .codif_matrix_new_group(codigo, etiqueta, character(), cases = list())
    target_idx <- length(groups)
  }
  groups[[target_idx]]$etiqueta <- etiqueta
  target_cases <- groups[[target_idx]]$matrix_cases %||% list()
  for (case in moved) {
    case$codigo <- codigo
    case$etiqueta <- etiqueta
    target_cases[[length(target_cases) + 1L]] <- case
  }
  groups[[target_idx]]$matrix_cases <- target_cases
  target_responses <- as.character(unlist(groups[[target_idx]]$respuestas %||% list(), use.names = FALSE))
  moved_responses <- vapply(moved, function(case) .codif_config_scalar(case$respuesta, ""), character(1))
  groups[[target_idx]]$respuestas <- as.list(unique(c(target_responses[nzchar(target_responses)], moved_responses[nzchar(moved_responses)])))

  all_grupos[[variable]] <- groups
  codif_set(sid, "grupos_recod", all_grupos, source = base)
  recod <- codif_get(sid, "respuestas_recod", source = base) %||% list()
  recod[[variable]] <- as.list(unique(as.character(unlist(lapply(groups, function(g) g$respuestas %||% list()), use.names = FALSE))))
  codif_set(sid, "respuestas_recod", recod, source = base)
  list(ok = TRUE, base = base, variable = variable, id_caso = id_caso, codigo = codigo, etiqueta = etiqueta, map = codif_matrix_map(sid, base = base))
}

.codif_matrix_selected_variables <- function(variables = NULL) {
  if (is.null(variables)) return(character())
  out <- as.character(unlist(variables, use.names = FALSE))
  out <- trimws(out)
  unique(out[!is.na(out) & nzchar(out)])
}

.codif_matrix_filter_var <- function(var, selected) {
  !length(selected) || identical(var, "") || var %in% selected
}

.codif_matrix_code_order <- function(x) {
  x_chr <- as.character(x %||% "")
  x_num <- suppressWarnings(as.numeric(x_chr))
  order(is.na(x_num), x_num, x_chr, na.last = TRUE)
}

# Lectura semantica solamente: las categorias nacen del Excel/manual de usuario.
# Prosecnur no inserta "Otro" ni "No contesta"; solo las reconoce si la etiqueta
# de categoria importada o existente dice eso.
.codif_matrix_category_role <- function(label) {
  norm <- .codif_config_norm(label)
  if (!nzchar(norm)) return("regular")
  no_contesta <- c(
    "no_contesta", "no_responde", "sin_respuesta", "no_respuesta",
    "no_declara", "ns_nr", "nsnr", "no_sabe_no_responde",
    "no_sabe_no_contesta"
  )
  otro <- c(
    "otro", "otros", "otra", "otras",
    "otro_especifique", "otros_especifique",
    "otra_especifique", "otras_especifique",
    "otro_por_favor_especificar", "otros_por_favor_especificar",
    "otra_por_favor_especificar", "otras_por_favor_especificar"
  )
  if (
    norm %in% no_contesta ||
      grepl("(^|_)no_(contesta|responde|respuesta|declara)($|_)", norm) ||
      grepl("(^|_)sin_respuesta($|_)", norm) ||
      grepl("(^|_)ns_?nr($|_)", norm) ||
      grepl("no_sabe_.*no_(responde|contesta)", norm)
  ) {
    return("no_contesta")
  }
  if (norm %in% otro || grepl("^(otro|otros|otra|otras)($|_)", norm)) return("otro")
  "regular"
}

.codif_matrix_category_role_label <- function(role) {
  role <- .codif_config_scalar(role, "regular")
  if (identical(role, "otro")) return("Otro")
  if (identical(role, "no_contesta")) return("No contesta")
  "Categoría"
}

.codif_matrix_variable_order_value <- function(x) {
  x <- as.character(x %||% "")
  known <- c(p23 = 1, p24_1 = 2, p24_2 = 3, p24_3 = 4, p24_4 = 5, p24_5 = 6, p35 = 7)
  out <- unname(known[x])
  out[is.na(out)] <- 999L
  as.integer(out)
}

.codif_matrix_selected_bases <- function(sid, base = NULL) {
  bases <- .codif_config_base_names(sid)
  requested <- trimws(as.character(unlist(base %||% character(), use.names = FALSE)))
  requested <- unique(requested[!is.na(requested) & nzchar(requested)])
  if (!length(requested)) return(bases)
  missing <- setdiff(requested, bases)
  if (length(missing)) {
    stop_api(404, "E_CODIF_MATRIX_BASE_NOT_FOUND", sprintf("La base '%s' no existe en este proyecto.", missing[[1]]))
  }
  requested[requested %in% bases]
}

.codif_matrix_case_id_for_row <- function(dat, i) {
  candidates <- intersect(c("response_id", "respondent_id", "id_caso", "_uuid", "uuid", "_index", "Codigo pulso", "Código pulso"), names(dat))
  for (candidate in candidates) {
    value <- trimws(as.character(dat[[candidate]][[i]] %||% ""))
    if (!is.na(value) && nzchar(value)) return(value)
  }
  as.character(i)
}

.codif_matrix_variable_display_label <- function(var, label = "") {
  var <- .codif_config_scalar(var, "")
  out <- trimws(.codif_config_scalar(label, var))
  out <- sub(":\\s*$", "", out)
  if (nzchar(out)) out else var
}

.codif_matrix_variable_kind <- function(sid, source, var, inv_item = NULL, groups = NULL) {
  var <- .codif_config_scalar(var, "")
  type <- .codif_config_scalar((inv_item %||% list())$type, "")
  rows <- (codif_snapshot(sid, source)$familias_draft %||% list())$rows %||% list()
  for (row in rows) {
    row_vars <- c(
      .codif_config_scalar(row$parent, ""),
      .codif_config_scalar(row$parent_col, ""),
      .codif_config_scalar(row$text_col, "")
    )
    if (var %in% row_vars) {
      row_type <- .codif_config_scalar(row$tipo, "")
      if (row_type %in% c("select_one", "select_multiple")) return(row_type)
    }
  }
  if (type %in% c("select_one", "select_multiple")) return(type)
  groups <- groups %||% list()
  case_ids <- unlist(lapply(groups, function(g) {
    vapply(g$matrix_cases %||% list(), function(case) .codif_config_scalar(case$id_caso, ""), character(1))
  }), use.names = FALSE)
  case_ids <- case_ids[!is.na(case_ids) & nzchar(case_ids)]
  if (length(case_ids) && any(duplicated(case_ids))) {
    if (identical(type, "text") || !nzchar(type)) return("text_select_multiple")
    return("select_multiple")
  }
  if (length(groups)) return("select_one")
  "text"
}

.codif_matrix_variable_kind_label <- function(kind) {
  kind <- .codif_config_scalar(kind, "text")
  if (identical(kind, "select_one")) return("Selección única")
  if (identical(kind, "select_multiple")) return("Selección múltiple")
  if (identical(kind, "text_select_multiple")) return("Texto abierto multicode")
  "Texto abierto"
}

.codif_matrix_styles_for_kind <- function(styles, kind) {
  kind <- .codif_config_scalar(kind, "text")
  if (identical(kind, "select_one")) {
    return(list(header = styles$header_so, subheader = styles$subheader_so))
  }
  if (identical(kind, "select_multiple")) {
    return(list(header = styles$header_sm, subheader = styles$subheader_sm))
  }
  if (identical(kind, "text_select_multiple")) {
    return(list(header = styles$header_text_sm, subheader = styles$subheader_text_sm))
  }
  list(header = styles$header, subheader = styles$subheader)
}

.codif_matrix_work_rows_for_source <- function(sid, source, selected) {
  inv <- .codif_config_inventory_for_source(sid, source)
  vars <- if (length(selected)) selected else names(inv)[vapply(inv, function(v) identical(v$type, "text"), logical(1))]
  dat <- tryCatch(codif_data_cached(sid, source), error = function(e) NULL)
  if (is.null(dat) || !is.data.frame(dat) || !length(vars)) {
    return(data.frame(
      id_caso = character(), variable = character(), variable_label = character(), texto_original = character(),
      codigo = character(), codificacion = character(), obs = character(),
      stringsAsFactors = FALSE
    ))
  }
  rows <- list()
  for (var in vars) {
    if (!var %in% names(dat)) next
    text <- trimws(as.character(dat[[var]]))
    keep <- !is.na(text) & nzchar(text)
    idx <- which(keep)
    label <- .codif_matrix_variable_display_label(var, (inv[[var]] %||% list())$label)
    for (i in idx) {
      rows[[length(rows) + 1L]] <- data.frame(
        id_caso = .codif_matrix_case_id_for_row(dat, i),
        variable = var,
        variable_label = label,
        texto_original = text[[i]],
        codigo = "",
        codificacion = "",
        obs = "",
        stringsAsFactors = FALSE
      )
    }
  }
  if (length(rows)) do.call(rbind, rows) else data.frame(
    id_caso = character(), variable = character(), variable_label = character(), texto_original = character(),
    codigo = character(), codificacion = character(), obs = character(),
    stringsAsFactors = FALSE
  )
}

.codif_matrix_split_select_multiple <- function(x) {
  x <- trimws(as.character(x %||% ""))
  if (!nzchar(x)) return(character())
  unique(unlist(strsplit(x, "\\s+|[,;|]+"), use.names = FALSE))
}

.codif_matrix_cell_coding <- function(groups, response, case_id) {
  response_norm <- .codif_matrix_norm_vec(response)
  hits <- list()
  case_matching_available <- nzchar(case_id) && any(vapply(groups %||% list(), function(g) {
    length(g$matrix_cases %||% list()) > 0L
  }, logical(1)))
  for (g in groups %||% list()) {
    matched <- FALSE
    cases <- g$matrix_cases %||% list()
    if (isTRUE(case_matching_available)) {
      case_ids <- vapply(cases, function(x) .codif_config_scalar(x$id_caso, ""), character(1))
      matched <- case_id %in% case_ids
    } else if (nzchar(response_norm)) {
      responses <- as.character(unlist(g$respuestas %||% list(), use.names = FALSE))
      matched <- response_norm %in% .codif_matrix_norm_vec(responses)
    }
    if (matched) hits[[length(hits) + 1L]] <- g
  }
  if (!length(hits)) {
    return(list(codigo = "", categoria = "", obs = ""))
  }
  codes <- vapply(hits, function(g) .codif_config_scalar(g$codigo, ""), character(1))
  order_idx <- .codif_matrix_code_order(codes)
  hits <- hits[order_idx]
  codes <- codes[order_idx]
  labels <- vapply(hits, function(g) .codif_config_scalar(g$etiqueta, ""), character(1))
  notes <- unique(unlist(lapply(hits, function(g) .codif_matrix_notes_for_case(g, case_id, response)), use.names = FALSE))
  notes <- notes[!is.na(notes) & nzchar(notes)]
  list(
    codigo = paste(codes[nzchar(codes)], collapse = "\n"),
    categoria = paste(labels[nzchar(labels)], collapse = "\n"),
    obs = paste(notes, collapse = "\n")
  )
}

.codif_matrix_row_codings <- function(groups, response, case_id) {
  response_norm <- .codif_matrix_norm_vec(response)
  hits <- list()
  case_matching_available <- nzchar(case_id) && any(vapply(groups %||% list(), function(g) {
    length(g$matrix_cases %||% list()) > 0L
  }, logical(1)))
  for (g in groups %||% list()) {
    matched <- FALSE
    cases <- g$matrix_cases %||% list()
    if (isTRUE(case_matching_available)) {
      case_ids <- vapply(cases, function(x) .codif_config_scalar(x$id_caso, ""), character(1))
      matched <- case_id %in% case_ids
    } else if (nzchar(response_norm)) {
      responses <- as.character(unlist(g$respuestas %||% list(), use.names = FALSE))
      matched <- response_norm %in% .codif_matrix_norm_vec(responses)
    }
    if (matched) hits[[length(hits) + 1L]] <- g
  }
  if (!length(hits)) {
    return(list(list(codigo = "", categoria = "", obs = "")))
  }
  codes <- vapply(hits, function(g) .codif_config_scalar(g$codigo, ""), character(1))
  hits <- hits[.codif_matrix_code_order(codes)]
  lapply(hits, function(g) {
    notes <- unique(.codif_matrix_notes_for_case(g, case_id, response))
    notes <- notes[!is.na(notes) & nzchar(notes)]
    list(
      codigo = .codif_config_scalar(g$codigo, ""),
      categoria = .codif_config_scalar(g$etiqueta, ""),
      obs = paste(notes, collapse = "\n")
    )
  })
}

.codif_matrix_work_matrix_for_source <- function(sid, source, selected) {
  inv <- .codif_config_inventory_for_source(sid, source)
  vars <- if (length(selected)) selected else names(inv)[vapply(inv, function(v) identical(v$type, "text"), logical(1))]
  vars <- vars[vars %in% names(inv)]
  vars <- vars[order(.codif_matrix_variable_order_value(vars), vars)]
  dat <- tryCatch(codif_data_cached(sid, source), error = function(e) NULL)
  if (is.null(dat) || !is.data.frame(dat) || !length(vars)) {
    return(list(vars = character(), labels = character(), tables = list(), summary = data.frame()))
  }
  vars <- vars[vars %in% names(dat)]
  case_ids <- vapply(seq_len(nrow(dat)), function(i) .codif_matrix_case_id_for_row(dat, i), character(1))
  groups_by_var <- (codif_snapshot(sid, source)$grupos_recod %||% list())
  labels <- character()
  kinds <- character()
  tables <- list()
  summaries <- list()
  for (var in vars) {
    label <- .codif_matrix_var_label(sid, source, var)
    response <- trimws(as.character(dat[[var]]))
    response[is.na(response)] <- ""
    groups <- groups_by_var[[var]] %||% list()
    kind <- .codif_matrix_variable_kind(sid, source, var, inv[[var]] %||% list(), groups)
    labels <- c(labels, label)
    kinds <- c(kinds, kind)
    rows <- list()
    nonempty_idx <- which(nzchar(response))
    for (i in nonempty_idx) {
      codings <- .codif_matrix_row_codings(groups, response[[i]], case_ids[[i]])
      for (coding in codings) {
        rows[[length(rows) + 1L]] <- data.frame(
          `ID caso` = case_ids[[i]],
          Respuesta = response[[i]],
          Código = .codif_config_scalar(coding$codigo, ""),
          Categoría = .codif_config_scalar(coding$categoria, ""),
          Observaciones = .codif_config_scalar(coding$obs, ""),
          check.names = FALSE,
          stringsAsFactors = FALSE
        )
      }
    }
    tbl <- if (length(rows)) {
      do.call(rbind, rows)
    } else {
      data.frame(`ID caso` = character(), Respuesta = character(), Código = character(), Categoría = character(), Observaciones = character(), check.names = FALSE)
    }
    tables[[var]] <- tbl
    summaries[[length(summaries) + 1L]] <- data.frame(
      base = source,
      base_label = .codif_matrix_dictionary_label(source),
      variable = var,
      variable_label = label,
      variable_kind = kind,
      variable_kind_label = .codif_matrix_variable_kind_label(kind),
      respuestas = length(nonempty_idx),
      filas_codificacion = nrow(tbl),
      categorias = length(unique(tbl$Código[nzchar(tbl$Código)])),
      stringsAsFactors = FALSE
    )
  }
  summary <- if (length(summaries)) do.call(rbind, summaries) else data.frame()
  list(vars = vars, labels = labels, kinds = kinds, tables = tables, summary = summary)
}

.codif_matrix_write_help_comment <- function(wb, sheet, col, row, text) {
  comment <- openxlsx::createComment(
    comment = text,
    author = "Prosecnur",
    visible = FALSE,
    width = 3.8,
    height = 3.2
  )
  openxlsx::writeComment(wb, sheet, col = col, row = row, comment = comment)
}

.codif_matrix_write_work_matrix_sheet <- function(wb, sheet, matrix, styles, include_obs = TRUE, include_help = FALSE) {
  openxlsx::addWorksheet(wb, sheet, gridLines = FALSE)
  n_vars <- length(matrix$labels)
  block_width <- if (isTRUE(include_obs)) 5L else 4L
  subheaders <- if (isTRUE(include_obs)) {
    c("ID caso", "Respuesta", "Código", "Categoría", "Observaciones")
  } else {
    c("ID caso", "Respuesta", "Código", "Categoría")
  }

  current_col <- 1L
  write_cols <- list()
  max_rows <- 0L
  for (i in seq_len(n_vars)) {
    label <- matrix$labels[[i]]
    kind_styles <- .codif_matrix_styles_for_kind(styles, (matrix$kinds %||% character())[[i]] %||% "text")
    block_cols <- current_col:(current_col + block_width - 1L)
    openxlsx::mergeCells(wb, sheet, cols = block_cols, rows = 1)
    openxlsx::writeData(wb, sheet, label, startRow = 1, startCol = current_col, colNames = FALSE)
    openxlsx::writeData(
      wb, sheet,
      matrix(subheaders, nrow = 1L),
      startRow = 2, startCol = current_col, colNames = FALSE
    )
    openxlsx::addStyle(wb, sheet, kind_styles$header, rows = 1, cols = block_cols, gridExpand = TRUE, stack = TRUE)
    openxlsx::addStyle(wb, sheet, kind_styles$subheader, rows = 2, cols = block_cols, gridExpand = TRUE, stack = TRUE)
    if (isTRUE(include_help)) {
      .codif_matrix_write_help_comment(
        wb, sheet, current_col, 2L,
        "No edites este valor. Prosecnur usa ID caso para vincular cada fila de la matriz con una respuesta del proyecto."
      )
      .codif_matrix_write_help_comment(
        wb, sheet, current_col + 1L, 2L,
        "Texto libre original. Sirve como evidencia para decidir el codigo y la categoria; no es necesario corregirlo aqui."
      )
      .codif_matrix_write_help_comment(
        wb, sheet, current_col + 2L, 2L,
        "Escribe o ajusta el codigo final de la categoria. Un mismo caso puede aparecer en varias filas si necesita varios codigos."
      )
      .codif_matrix_write_help_comment(
        wb, sheet, current_col + 3L, 2L,
        "Escribe la categoria final exactamente como quieres que quede en Prosecnur. 'Otro' y 'No contesta' son categorias validas si las defines aqui; Prosecnur no las agrega por su cuenta."
      )
      if (isTRUE(include_obs)) {
        .codif_matrix_write_help_comment(
          wb, sheet, current_col + 4L, 2L,
          "Campo interno para justificar decisiones, dudas o cambios puntuales. No se incluye en el Excel de cliente."
        )
      }
    }
    openxlsx::setColWidths(wb, sheet, cols = current_col, widths = 14.5)
    openxlsx::setColWidths(wb, sheet, cols = current_col + 1L, widths = 55)
    openxlsx::setColWidths(wb, sheet, cols = current_col + 2L, widths = 9)
    openxlsx::setColWidths(wb, sheet, cols = current_col + 3L, widths = 32)
    if (isTRUE(include_obs)) openxlsx::setColWidths(wb, sheet, cols = current_col + 4L, widths = 24)
    if (i < n_vars) openxlsx::setColWidths(wb, sheet, cols = current_col + block_width, widths = 2.63)
    write_cols[[i]] <- block_cols
    tbl <- matrix$tables[[matrix$vars[[i]]]] %||% data.frame()
    max_rows <- max(max_rows, nrow(tbl))
    current_col <- current_col + block_width + 1L
  }

  for (i in seq_len(n_vars)) {
    tbl <- matrix$tables[[matrix$vars[[i]]]] %||% data.frame()
    if (!isTRUE(include_obs) && "Observaciones" %in% names(tbl)) {
      tbl <- tbl[, setdiff(names(tbl), "Observaciones"), drop = FALSE]
    }
    if (nrow(tbl)) {
      rows <- 3:(nrow(tbl) + 2L)
      openxlsx::writeData(wb, sheet, tbl, startRow = 3, startCol = write_cols[[i]][[1]], colNames = FALSE)
      openxlsx::addStyle(wb, sheet, styles$body, rows = rows, cols = write_cols[[i]], gridExpand = TRUE, stack = TRUE)
      openxlsx::addStyle(wb, sheet, styles$body_center, rows = rows, cols = c(write_cols[[i]][[1]], write_cols[[i]][[3]]), gridExpand = TRUE, stack = TRUE)
    }
  }
  if (max_rows > 0L) openxlsx::setRowHeights(wb, sheet, rows = 3:(max_rows + 2L), heights = 45)

  openxlsx::setRowHeights(wb, sheet, rows = 1:2, heights = c(24, 22.5))
  openxlsx::freezePane(wb, sheet, firstActiveRow = 3)
  openxlsx::pageSetup(wb, sheet, orientation = "landscape", fitToWidth = TRUE, fitToHeight = FALSE)
  invisible(TRUE)
}

.codif_matrix_add_guide_sheet <- function(wb, styles, visibility = "work") {
  title <- if (identical(visibility, "internal")) "Guía interna de matriz de codificación" else "Guía de edición de matriz"
  note <- "Esta guía acompaña el Excel editable de Prosecnur. No se exporta en la versión para cliente."
  guide <- data.frame(
    Paso = c(
      "1. Elegir variables",
      "2. Editar por base",
      "3. Completar categorías",
      "4. Usar Otro / No contesta",
      "5. Mantener multicode",
      "6. Registrar observaciones",
      "7. Subir a Prosecnur"
    ),
    `Qué hacer` = c(
      "Desde Prosecnur selecciona las variables de texto libre que quieres codificar y genera esta matriz.",
      "Cada hoja representa una base/carrera. Cada bloque horizontal representa una variable abierta de esa base.",
      "En cada fila conserva ID caso y Respuesta; edita Código y Categoría con la decisión final.",
      "Otro y No contesta no son reglas automáticas: son categorías reales si las escribes en la columna Categoría.",
      "Si una respuesta necesita más de un código, conserva o repite ID caso y Respuesta en varias filas, una por código/categoría.",
      "Usa Observaciones para justificar decisiones, dudas o cambios manuales. Es una columna interna de trabajo.",
      "Al importar la matriz, Prosecnur lee ID caso, Respuesta, Código, Categoría y Observaciones; no usa colores ni formatos como fuente de verdad."
    ),
    `Clave para lectura` = c(
      "La selección de variables define qué bloques aparecen en el Excel.",
      "No cambies los encabezados ID caso, Respuesta, Código, Categoría y Observaciones.",
      "La categoría final sale del texto que escribas; el código solo agrupa esa categoría.",
      "El diferenciador es el texto de Categoría, no un código hardcodeado ni una variable específica.",
      "La matriz conserva varias asignaciones para el mismo ID caso cuando hay varias filas.",
      "Las observaciones se conservan en el flujo interno y ayudan a auditar la decisión.",
      "El Excel para cliente omite esta guía, comentarios internos y observaciones."
    ),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  .codif_matrix_add_table_sheet(wb, "Guía", title, note, guide, styles)
}

.codif_matrix_standard_styles <- function() {
  list(
    title = openxlsx::createStyle(
      textDecoration = "bold", fontSize = 13, fontName = "Calibri",
      fontColour = "#FFFFFF", fgFill = "#12355B",
      border = "TopBottomLeftRight", borderColour = "#B7D8E8",
      halign = "left", valign = "center", wrapText = TRUE
    ),
    note = openxlsx::createStyle(
      fontName = "Calibri", fontColour = "#12355B", fgFill = "#F6FAFC",
      border = "TopBottomLeftRight", borderColour = "#DDEAF1",
      valign = "top", wrapText = TRUE
    ),
    header = openxlsx::createStyle(
      textDecoration = "bold", fontName = "Calibri", fgFill = "#12355B",
      fontColour = "#FFFFFF", border = "TopBottomLeftRight",
      borderColour = "#B7D8E8", halign = "center", valign = "center",
      wrapText = TRUE
    ),
    header_so = openxlsx::createStyle(
      textDecoration = "bold", fontName = "Calibri", fgFill = "#174A7C",
      fontColour = "#FFFFFF", border = "TopBottomLeftRight",
      borderColour = "#B7D8E8", halign = "center", valign = "center",
      wrapText = TRUE
    ),
    header_sm = openxlsx::createStyle(
      textDecoration = "bold", fontName = "Calibri", fgFill = "#226B4B",
      fontColour = "#FFFFFF", border = "TopBottomLeftRight",
      borderColour = "#BFE3CF", halign = "center", valign = "center",
      wrapText = TRUE
    ),
    header_text_sm = openxlsx::createStyle(
      textDecoration = "bold", fontName = "Calibri", fgFill = "#7A6F16",
      fontColour = "#FFFFFF", border = "TopBottomLeftRight",
      borderColour = "#D8C977", halign = "center", valign = "center",
      wrapText = TRUE
    ),
    subheader = openxlsx::createStyle(
      textDecoration = "bold", fontName = "Calibri", fgFill = "#1D9BB2",
      fontColour = "#FFFFFF", border = "TopBottomLeftRight",
      borderColour = "#B7D8E8", halign = "center", valign = "center",
      wrapText = TRUE
    ),
    subheader_so = openxlsx::createStyle(
      textDecoration = "bold", fontName = "Calibri", fgFill = "#2B79A3",
      fontColour = "#FFFFFF", border = "TopBottomLeftRight",
      borderColour = "#B7D8E8", halign = "center", valign = "center",
      wrapText = TRUE
    ),
    subheader_sm = openxlsx::createStyle(
      textDecoration = "bold", fontName = "Calibri", fgFill = "#3D9367",
      fontColour = "#FFFFFF", border = "TopBottomLeftRight",
      borderColour = "#BFE3CF", halign = "center", valign = "center",
      wrapText = TRUE
    ),
    subheader_text_sm = openxlsx::createStyle(
      textDecoration = "bold", fontName = "Calibri", fgFill = "#A48B25",
      fontColour = "#FFFFFF", border = "TopBottomLeftRight",
      borderColour = "#D8C977", halign = "center", valign = "center",
      wrapText = TRUE
    ),
    body = openxlsx::createStyle(
      fontName = "Calibri", fontColour = "#12355B",
      border = "TopBottomLeftRight", borderColour = "#DDEAF1",
      valign = "top", wrapText = TRUE
    ),
    body_center = openxlsx::createStyle(
      fontName = "Calibri", fontColour = "#12355B",
      border = "TopBottomLeftRight", borderColour = "#DDEAF1",
      halign = "center", valign = "top", wrapText = TRUE
    )
  )
}

.codif_matrix_excel_widths <- function(cols) {
  norms <- vapply(cols, .codif_config_norm, character(1))
  vapply(norms, function(nm) {
    if (nm %in% c("id_caso", "id_caso", "case_id", "response_id")) return(14.5)
    if (nm %in% c("base", "carrera")) return(24)
    if (nm %in% c("variable", "variable_fuente")) return(16)
    if (nm %in% c("pregunta")) return(38)
    if (nm %in% c("variable_recodificada")) return(22)
    if (grepl("texto|respuesta_original", nm)) return(75.5)
    if (nm %in% c("codigo", "code")) return(10)
    if (grepl("codificacion|etiqueta_categoria|categoria", nm)) return(42)
    if (grepl("ejemplo|nota|observaciones|obs|motivo", nm)) return(32.75)
    if (grepl("^n_|total|valor|filas|variables|casos|categorias|mapeadas|respuestas_unicas|respuestas_codificadas|casos_vinculados", nm)) return(12)
    if (nm %in% c("estado", "origen_categoria", "fuente_codificacion")) return(22)
    18
  }, numeric(1))
}

.codif_matrix_center_cols <- function(cols) {
  norms <- vapply(cols, .codif_config_norm, character(1))
  which(norms %in% c(
    "codigo", "code", "n_respuestas", "n_respuestas_unicas", "n_casos",
    "categorias_total", "respuestas_mapeadas", "casos_mapeados",
    "n_filas", "valor", "filas", "variables", "categorias",
    "respuestas_unicas", "respuestas_codificadas", "casos_vinculados"
  ))
}

.codif_matrix_write_table <- function(wb, sheet, df, start_row = 1L, start_col = 1L) {
  if (nrow(df) > 0L) {
    openxlsx::writeDataTable(
      wb, sheet, df, startRow = start_row, startCol = start_col,
      withFilter = TRUE, tableStyle = "TableStyleMedium2"
    )
  } else {
    openxlsx::writeData(wb, sheet, df, startRow = start_row, startCol = start_col, withFilter = FALSE)
  }
}

.codif_matrix_apply_table_style <- function(wb, sheet, df, styles, header_row, body_start, body_height_override = NULL) {
  n_cols <- max(1L, ncol(df))
  openxlsx::addStyle(wb, sheet, styles$header, rows = header_row, cols = seq_len(n_cols), gridExpand = TRUE, stack = TRUE)
  openxlsx::setRowHeights(wb, sheet, rows = header_row, heights = 22.5)
  openxlsx::setColWidths(wb, sheet, cols = seq_len(n_cols), widths = .codif_matrix_excel_widths(names(df)))
  if (nrow(df) > 0L) {
    body_rows <- body_start:(body_start + nrow(df) - 1L)
    openxlsx::addStyle(wb, sheet, styles$body, rows = body_rows, cols = seq_len(n_cols), gridExpand = TRUE, stack = TRUE)
    center_cols <- .codif_matrix_center_cols(names(df))
    if (length(center_cols)) {
      openxlsx::addStyle(wb, sheet, styles$body_center, rows = body_rows, cols = center_cols, gridExpand = TRUE, stack = TRUE)
    }
    body_height <- body_height_override %||% if (any(grepl("texto|respuesta|codificacion|etiqueta|nota|obs|ejemplo", vapply(names(df), .codif_config_norm, character(1))))) 30 else 21
    openxlsx::setRowHeights(wb, sheet, rows = body_rows, heights = body_height)
  }
}

.codif_matrix_add_table_sheet <- function(wb, sheet, title, note, df, styles) {
  openxlsx::addWorksheet(wb, sheet, gridLines = FALSE)
  n_cols <- max(1L, ncol(df))
  title_cols <- max(4L, n_cols)
  openxlsx::mergeCells(wb, sheet, cols = seq_len(title_cols), rows = 1)
  openxlsx::mergeCells(wb, sheet, cols = seq_len(title_cols), rows = 2)
  openxlsx::writeData(wb, sheet, title, startRow = 1, startCol = 1, colNames = FALSE)
  openxlsx::writeData(wb, sheet, note, startRow = 2, startCol = 1, colNames = FALSE)
  .codif_matrix_write_table(wb, sheet, df, start_row = 4, start_col = 1)
  openxlsx::addStyle(wb, sheet, styles$title, rows = 1, cols = seq_len(title_cols), gridExpand = TRUE, stack = TRUE)
  openxlsx::addStyle(wb, sheet, styles$note, rows = 2, cols = seq_len(title_cols), gridExpand = TRUE, stack = TRUE)
  openxlsx::setRowHeights(wb, sheet, rows = 1, heights = 28)
  openxlsx::setRowHeights(wb, sheet, rows = 2, heights = 42)
  .codif_matrix_apply_table_style(wb, sheet, df, styles, header_row = 4L, body_start = 5L)
  openxlsx::freezePane(wb, sheet, firstActiveRow = 5)
  openxlsx::pageSetup(wb, sheet, orientation = "landscape", fitToWidth = TRUE, fitToHeight = FALSE)
}

.codif_matrix_logo_path <- function() {
  candidates <- c(
    system.file("www", "pulso-pucp-logo.png", package = "prosecnurapp"),
    file.path(getwd(), "api", "inst", "www", "pulso-pucp-logo.png"),
    file.path(getwd(), "frontend", "public", "pulso-pucp-logo.png"),
    file.path(getwd(), "api", "inst", "hojas_ruta", "assets", "logo_pulso.png")
  )
  candidates <- candidates[nzchar(candidates)]
  hit <- candidates[file.exists(candidates)][1]
  if (length(hit) && !is.na(hit)) hit else ""
}

.codif_matrix_add_matrix_summary_sheet <- function(wb, title, note, df, styles) {
  openxlsx::addWorksheet(wb, "Resumen", gridLines = FALSE)
  logo <- .codif_matrix_logo_path()
  if (nzchar(logo)) {
    try(openxlsx::insertImage(wb, "Resumen", logo, startRow = 1, startCol = 1, width = 2.1, height = 0.72), silent = TRUE)
  }
  openxlsx::mergeCells(wb, "Resumen", cols = 3:8, rows = 1)
  openxlsx::mergeCells(wb, "Resumen", cols = 3:8, rows = 2:3)
  openxlsx::writeData(wb, "Resumen", title, startRow = 1, startCol = 3, colNames = FALSE)
  openxlsx::writeData(wb, "Resumen", note, startRow = 2, startCol = 3, colNames = FALSE)
  openxlsx::addStyle(wb, "Resumen", styles$title, rows = 1, cols = 3:8, gridExpand = TRUE, stack = TRUE)
  openxlsx::addStyle(wb, "Resumen", styles$note, rows = 2:3, cols = 3:8, gridExpand = TRUE, stack = TRUE)
  openxlsx::setRowHeights(wb, "Resumen", rows = 1, heights = 28)
  openxlsx::setRowHeights(wb, "Resumen", rows = 2:3, heights = 26)

  summary <- df
  if (!is.null(summary) && nrow(summary)) {
    summary <- summary[order(
      as.character(summary$Carrera),
      .codif_matrix_variable_order_value(summary$variable %||% ""),
      as.character(summary$Pregunta)
    ), , drop = FALSE]
    summary$variable <- NULL
  }
  .codif_matrix_write_table(wb, "Resumen", summary, start_row = 6L, start_col = 1L)
  .codif_matrix_apply_table_style(wb, "Resumen", summary, styles, header_row = 6L, body_start = 7L)
  openxlsx::setColWidths(wb, "Resumen", cols = 1, widths = 24)
  openxlsx::setColWidths(wb, "Resumen", cols = 2, widths = 38)
  openxlsx::setColWidths(wb, "Resumen", cols = 3, widths = 20)
  openxlsx::setColWidths(wb, "Resumen", cols = 4:6, widths = 17)
  openxlsx::freezePane(wb, "Resumen", firstActiveRow = 7)
  openxlsx::pageSetup(wb, "Resumen", orientation = "landscape", fitToWidth = TRUE, fitToHeight = FALSE)
}

.codif_matrix_var_label <- function(sid, source, var) {
  inv <- .codif_config_inventory_for_source(sid, source)
  .codif_matrix_variable_display_label(var, (inv[[var]] %||% list())$label)
}

.codif_matrix_friendly_table <- function(df, kind = c("resumen", "variables", "categories", "mapping", "pendientes", "cases", "notas", "work")) {
  kind <- match.arg(kind)
  if (is.null(df) || !is.data.frame(df)) return(data.frame())
  pick <- function(cols) {
    available <- intersect(cols, names(df))
    out <- df[, available, drop = FALSE]
    out
  }
  rename <- function(out, names_new) {
    names(out) <- names_new[seq_along(out)]
    out
  }
  if (identical(kind, "resumen")) {
    return(rename(pick(c("indicador", "valor")), c("Indicador", "Valor")))
  }
  if (identical(kind, "variables")) {
    return(rename(
      pick(c("base_label", "variable_label", "estado", "categorias_total", "respuestas_mapeadas", "casos_mapeados")),
      c("Carrera", "Pregunta", "Estado", "Categorías", "Respuestas codificadas", "Casos vinculados")
    ))
  }
  if (identical(kind, "categories")) {
    return(rename(
      pick(c("base_label", "variable_label", "codigo", "tipo_categoria", "etiqueta_categoria", "n_respuestas_unicas", "n_casos", "respuestas_ejemplo")),
      c("Carrera", "Pregunta", "Código", "Tipo", "Categoría", "Respuestas únicas", "Casos vinculados", "Ejemplos")
    ))
  }
  if (identical(kind, "mapping")) {
    return(rename(
      pick(c("base_label", "variable_label", "respuesta_original", "n_filas", "codigo", "tipo_categoria", "etiqueta_categoria")),
      c("Carrera", "Pregunta", "Respuesta original", "Filas", "Código", "Tipo", "Categoría")
    ))
  }
  if (identical(kind, "pendientes")) {
    return(rename(
      pick(c("base_label", "variable_label", "respuesta_original", "n_filas", "motivo")),
      c("Carrera", "Pregunta", "Respuesta original", "Filas", "Motivo")
    ))
  }
  if (identical(kind, "cases")) {
    return(rename(
      pick(c("base_label", "variable_label", "id_caso", "respuesta_original", "codigo", "tipo_categoria", "etiqueta_categoria", "obs")),
      c("Carrera", "Pregunta", "ID caso", "Respuesta original", "Código", "Tipo", "Categoría", "Observaciones")
    ))
  }
  if (identical(kind, "work")) {
    return(rename(
      pick(c("id_caso", "variable_label", "texto_original", "codigo", "codificacion", "obs")),
      c("ID caso", "Pregunta", "Respuesta original", "Código", "Categoría", "Observaciones")
    ))
  }
  rename(pick(c("nota")), c("Nota"))
}

.codif_matrix_build_standard_tables <- function(sid, selected, visibility, bases = NULL) {
  bases <- bases %||% .codif_config_base_names(sid)
  variable_rows <- list()
  category_rows <- list()
  mapping_rows <- list()
  case_rows <- list()

  for (base in bases) {
    st <- codif_snapshot(sid, base)
    groups <- st$grupos_recod %||% list()
    for (var in names(groups)) {
      if (!.codif_matrix_filter_var(var, selected)) next
      gl <- groups[[var]] %||% list()
      base_label <- .codif_matrix_dictionary_label(base)
      var_label <- .codif_matrix_var_label(sid, base, var)
      responses_total <- sum(vapply(gl, function(g) length(g$respuestas %||% list()), integer(1)))
      cases_total <- sum(vapply(gl, function(g) length(g$matrix_cases %||% list()), integer(1)))
      variable_rows[[length(variable_rows) + 1L]] <- data.frame(
        base = base,
        base_label = base_label,
        variable = var,
        variable_label = var_label,
        variable_fuente = var,
        variable_recodificada = paste0(var, "_recod"),
        etiqueta = var_label,
        estado = if (length(gl)) "con categorías" else "sin categorías",
        categorias_total = length(gl),
        respuestas_mapeadas = responses_total,
        casos_mapeados = cases_total,
        stringsAsFactors = FALSE
      )
      for (g in gl) {
        responses <- as.character(unlist(g$respuestas %||% list(), use.names = FALSE))
        responses <- responses[!is.na(responses) & nzchar(responses)]
        cases <- g$matrix_cases %||% list()
        category_role <- .codif_matrix_category_role(g$etiqueta)
        category_rows[[length(category_rows) + 1L]] <- data.frame(
          base = base,
          base_label = base_label,
          variable = var,
          variable_label = var_label,
          variable_fuente = var,
          codigo = .codif_config_scalar(g$codigo, ""),
          etiqueta_categoria = .codif_config_scalar(g$etiqueta, ""),
          tipo_categoria = .codif_matrix_category_role_label(category_role),
          rol_categoria = category_role,
          origen_categoria = .codif_config_scalar(g$origen, "nuevo"),
          n_respuestas_unicas = length(unique(responses)),
          n_casos = length(cases),
          respuestas_ejemplo = paste(utils::head(unique(responses), 8), collapse = " | "),
          stringsAsFactors = FALSE
        )
        for (response in unique(responses)) {
          mapping_rows[[length(mapping_rows) + 1L]] <- data.frame(
            base = base,
            base_label = base_label,
            variable = var,
            variable_label = var_label,
            variable_fuente = var,
            variable_recodificada = paste0(var, "_recod"),
            respuesta_original = response,
            n_filas = sum(responses == response),
            codigo = .codif_config_scalar(g$codigo, ""),
            etiqueta_categoria = .codif_config_scalar(g$etiqueta, ""),
            tipo_categoria = .codif_matrix_category_role_label(category_role),
            origen_categoria = .codif_config_scalar(g$origen, "nuevo"),
            fuente_codificacion = if (length(cases)) "matriz caso-código" else "codificación Prosecnur",
            stringsAsFactors = FALSE
          )
        }
        if (identical(visibility, "internal") && length(cases)) {
          for (case in cases) {
            case_obs <- .codif_config_scalar(case$obs, "")
            if (!nzchar(case_obs)) {
              case_obs <- paste(as.character(unlist(g$matrix_notes %||% list(), use.names = FALSE)), collapse = " | ")
            }
            case_rows[[length(case_rows) + 1L]] <- data.frame(
              base = base,
              base_label = base_label,
              variable = var,
              variable_label = var_label,
              id_caso = .codif_config_scalar(case$id_caso, ""),
              respuesta_original = .codif_config_scalar(case$respuesta, ""),
              codigo = .codif_config_scalar(g$codigo, ""),
              etiqueta_categoria = .codif_config_scalar(g$etiqueta, ""),
              tipo_categoria = .codif_matrix_category_role_label(category_role),
              obs = case_obs,
              stringsAsFactors = FALSE
            )
          }
        }
      }
    }
  }

  bind_or_empty <- function(rows, cols) {
    if (length(rows)) return(do.call(rbind, rows))
    stats::setNames(as.data.frame(matrix(nrow = 0L, ncol = length(cols))), cols)
  }
  variables <- bind_or_empty(variable_rows, c(
    "base", "base_label", "variable", "variable_label", "variable_fuente", "variable_recodificada", "etiqueta",
    "estado", "categorias_total", "respuestas_mapeadas", "casos_mapeados"
  ))
  categories <- bind_or_empty(category_rows, c(
    "base", "base_label", "variable", "variable_label", "variable_fuente", "codigo", "etiqueta_categoria",
    "tipo_categoria", "rol_categoria", "origen_categoria", "n_respuestas_unicas", "n_casos", "respuestas_ejemplo"
  ))
  mapping <- bind_or_empty(mapping_rows, c(
    "base", "base_label", "variable", "variable_label", "variable_fuente", "variable_recodificada", "respuesta_original",
    "n_filas", "codigo", "etiqueta_categoria", "tipo_categoria", "origen_categoria", "fuente_codificacion"
  ))
  cases <- bind_or_empty(case_rows, c(
    "base", "base_label", "variable", "variable_label", "id_caso", "respuesta_original", "codigo", "etiqueta_categoria", "tipo_categoria", "obs"
  ))
  if (nrow(variables)) {
    variables <- variables[order(as.character(variables$base_label), .codif_matrix_variable_order_value(variables$variable), as.character(variables$variable_label)), , drop = FALSE]
  }
  if (nrow(categories)) {
    idx <- order(
      as.character(categories$base_label),
      .codif_matrix_variable_order_value(categories$variable),
      as.character(categories$variable_label),
      is.na(suppressWarnings(as.numeric(as.character(categories$codigo)))),
      suppressWarnings(as.numeric(as.character(categories$codigo))),
      as.character(categories$codigo)
    )
    categories <- categories[idx, , drop = FALSE]
  }
  if (nrow(mapping)) {
    idx <- order(
      as.character(mapping$base_label),
      .codif_matrix_variable_order_value(mapping$variable),
      as.character(mapping$variable_label),
      is.na(suppressWarnings(as.numeric(as.character(mapping$codigo)))),
      suppressWarnings(as.numeric(as.character(mapping$codigo))),
      as.character(mapping$codigo),
      as.character(mapping$respuesta_original)
    )
    mapping <- mapping[idx, , drop = FALSE]
  }
  if (nrow(cases)) {
    idx <- order(
      as.character(cases$base_label),
      .codif_matrix_variable_order_value(cases$variable),
      as.character(cases$variable_label),
      is.na(suppressWarnings(as.numeric(as.character(cases$codigo)))),
      suppressWarnings(as.numeric(as.character(cases$codigo))),
      as.character(cases$codigo),
      as.character(cases$id_caso)
    )
    cases <- cases[idx, , drop = FALSE]
  }
  pendientes <- stats::setNames(as.data.frame(matrix(nrow = 0L, ncol = 7L)), c(
    "base_label", "variable_label", "base", "variable", "respuesta_original", "n_filas", "motivo"
  ))
  resumen <- data.frame(
    indicador = c("bases", "variables", "categorias", "mapeos", "variables seleccionadas"),
    valor = c(length(bases), nrow(variables), nrow(categories), nrow(mapping), length(selected)),
    stringsAsFactors = FALSE
  )
  notas <- data.frame(
    nota = c(
      "La hoja Diccionario muestra la lista de códigos por carrera y pregunta.",
      "La hoja Respuestas muestra cómo se relaciona cada respuesta original con una categoría.",
      "La hoja Casos solo aparece en la versión interna cuando existe trazabilidad por ID de caso.",
      "La matriz de trabajo se puede completar directamente en Excel usando las columnas Código, Categoría y Observaciones."
    ),
    stringsAsFactors = FALSE
  )
  list(resumen = resumen, variables = variables, categories = categories, mapping = mapping, pendientes = pendientes, cases = cases, notas = notas)
}

.codif_matrix_dictionary_label <- function(base) {
  aliases <- .codif_matrix_sheet_aliases()
  hit <- names(aliases)[match(base, unlist(aliases, use.names = FALSE))]
  if (length(hit) && !is.na(hit[[1]])) {
    labels <- c(
      civil = "Civil",
      telecom = "Telecom",
      telecomunicaciones = "Telecom",
      electronica = "Electronica",
      geologica = "Geologica",
      informatica = "Informatica",
      mecanica = "Mecanica",
      mecatronica = "Mecatronica",
      industrial = "Industrial",
      minas = "Minas"
    )
    return(labels[[hit[[1]]]] %||% base)
  }
  base
}

.codif_matrix_safe_sheet_name <- function(label, used = character()) {
  out <- trimws(as.character(label %||% "Hoja"))
  out <- gsub("[\\[\\]\\*\\?/\\\\:]", "_", out)
  if (!nzchar(out)) out <- "Hoja"
  out <- substr(out, 1L, 31L)
  base <- out
  i <- 2L
  used_norm <- tolower(trimws(as.character(used %||% character())))
  while (tolower(out) %in% used_norm) {
    suffix <- paste0("_", i)
    out <- paste0(substr(base, 1L, max(1L, 31L - nchar(suffix))), suffix)
    i <- i + 1L
  }
  out
}

.codif_matrix_add_dictionary_sheet <- function(wb, categories, styles) {
  openxlsx::addWorksheet(wb, "Diccionario", gridLines = FALSE)
  cols <- c("Pregunta", "Código", "Tipo", "Categoría", "N respuestas")
  if (is.null(categories) || !nrow(categories)) {
    empty <- stats::setNames(as.data.frame(matrix(nrow = 0L, ncol = length(cols))), cols)
    .codif_matrix_write_table(wb, "Diccionario", empty, start_row = 1L, start_col = 1L)
    .codif_matrix_apply_table_style(wb, "Diccionario", empty, styles, header_row = 1L, body_start = 2L)
    return(invisible(TRUE))
  }

  bases <- unique(as.character(categories$base %||% character(0)))
  bases <- bases[nzchar(bases)]
  block_width <- 5L
  spacer <- 1L
  blocks_per_row <- 3L
  row <- 1L
  for (offset in seq(1L, length(bases), by = blocks_per_row)) {
    group <- bases[offset:min(offset + blocks_per_row - 1L, length(bases))]
    max_rows <- 0L
    for (j in seq_along(group)) {
      base <- group[[j]]
      start_col <- 1L + (j - 1L) * (block_width + spacer)
      block <- categories[as.character(categories$base) == base, , drop = FALSE]
      if (nrow(block)) {
        idx <- order(
          .codif_matrix_variable_order_value(block$variable %||% ""),
          as.character(block$variable_label %||% ""),
          is.na(suppressWarnings(as.numeric(as.character(block$codigo %||% "")))),
          suppressWarnings(as.numeric(as.character(block$codigo %||% ""))),
          as.character(block$codigo %||% "")
        )
        block <- block[idx, , drop = FALSE]
      }
      tbl <- data.frame(
        Pregunta = as.character(block$variable_label %||% ""),
        Código = as.character(block$codigo %||% ""),
        Tipo = as.character(block$tipo_categoria %||% ""),
        Categoría = as.character(block$etiqueta_categoria %||% ""),
        `N respuestas` = as.integer(block$n_respuestas_unicas %||% 0L),
        stringsAsFactors = FALSE
      )
      openxlsx::mergeCells(wb, "Diccionario", cols = start_col:(start_col + block_width - 1L), rows = row)
      openxlsx::writeData(wb, "Diccionario", .codif_matrix_dictionary_label(base), startRow = row, startCol = start_col, colNames = FALSE)
      openxlsx::writeData(wb, "Diccionario", tbl, startRow = row + 1L, startCol = start_col, withFilter = FALSE)
      openxlsx::addStyle(wb, "Diccionario", styles$title, rows = row, cols = start_col:(start_col + block_width - 1L), gridExpand = TRUE, stack = TRUE)
      openxlsx::addStyle(wb, "Diccionario", styles$subheader, rows = row + 1L, cols = start_col:(start_col + block_width - 1L), gridExpand = TRUE, stack = TRUE)
      if (nrow(tbl)) {
        body_rows <- (row + 2L):(row + nrow(tbl) + 1L)
        openxlsx::addStyle(wb, "Diccionario", styles$body, rows = body_rows, cols = start_col:(start_col + block_width - 1L), gridExpand = TRUE, stack = TRUE)
        openxlsx::addStyle(wb, "Diccionario", styles$body_center, rows = body_rows, cols = c(start_col + 1L, start_col + 2L, start_col + 4L), gridExpand = TRUE, stack = TRUE)
        openxlsx::setRowHeights(wb, "Diccionario", rows = body_rows, heights = 24)
      }
      openxlsx::setRowHeights(wb, "Diccionario", rows = row, heights = 22.5)
      openxlsx::setRowHeights(wb, "Diccionario", rows = row + 1L, heights = 21)
      openxlsx::setColWidths(wb, "Diccionario", cols = start_col, widths = 14.5)
      openxlsx::setColWidths(wb, "Diccionario", cols = start_col + 1L, widths = 7.13)
      openxlsx::setColWidths(wb, "Diccionario", cols = start_col + 2L, widths = 13.5)
      openxlsx::setColWidths(wb, "Diccionario", cols = start_col + 3L, widths = 55.5)
      openxlsx::setColWidths(wb, "Diccionario", cols = start_col + 4L, widths = 11.5)
      if (j < blocks_per_row) openxlsx::setColWidths(wb, "Diccionario", cols = start_col + 5L, widths = 2.63)
      max_rows <- max(max_rows, nrow(tbl))
    }
    row <- row + max_rows + 6L
  }
  openxlsx::freezePane(wb, "Diccionario", firstActiveRow = 3)
  openxlsx::pageSetup(wb, "Diccionario", orientation = "landscape", fitToWidth = TRUE, fitToHeight = FALSE)
  invisible(TRUE)
}

codif_matrix_export_xlsx <- function(sid, visibility = c("work", "internal", "client"), variables = NULL, base = NULL) {
  visibility <- match.arg(visibility)
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop_api(500, "E_NO_OPENXLSX", "El paquete R 'openxlsx' no está instalado.")
  }
  wb <- openxlsx::createWorkbook()
  styles <- .codif_matrix_standard_styles()
  selected <- .codif_matrix_selected_variables(variables)
  bases <- .codif_matrix_selected_bases(sid, base)

  if (identical(visibility, "work")) {
    tables <- .codif_matrix_build_standard_tables(sid, selected, "client", bases = bases)
    work_matrices_by_base <- list()
    for (base in bases) {
      matrix <- .codif_matrix_work_matrix_for_source(sid, base, selected)
      work_matrices_by_base[[base]] <- matrix
    }
    .codif_matrix_add_guide_sheet(wb, styles, visibility)
    .codif_matrix_add_dictionary_sheet(wb, tables$categories, styles)
    used_sheets <- openxlsx::sheets(wb)
    for (base in bases) {
      matrix <- work_matrices_by_base[[base]]
      sheet <- .codif_matrix_safe_sheet_name(.codif_matrix_dictionary_label(base), used_sheets)
      used_sheets <- c(used_sheets, sheet)
      .codif_matrix_write_work_matrix_sheet(wb, sheet, matrix, styles, include_help = TRUE)
    }
  } else if (identical(visibility, "client")) {
    tables <- .codif_matrix_build_standard_tables(sid, selected, "client", bases = bases)
    resumen_rows <- list()
    client_matrices_by_base <- list()
    for (base in bases) {
      matrix <- .codif_matrix_work_matrix_for_source(sid, base, selected)
      client_matrices_by_base[[base]] <- matrix
      if (nrow(matrix$summary)) resumen_rows[[length(resumen_rows) + 1L]] <- matrix$summary
    }
    resumen_raw <- if (length(resumen_rows)) {
      do.call(rbind, resumen_rows)
    } else {
      data.frame(base_label = character(), variable_label = character(), variable = character(), variable_kind_label = character(), respuestas = integer(), filas_codificacion = integer(), categorias = integer())
    }
    .codif_matrix_add_matrix_summary_sheet(
      wb,
      "Resumen de matriz para cliente",
      "Cada hoja de carrera contiene una tabla independiente por pregunta. Se conserva ID caso para revisión, y se omiten observaciones y comentarios internos.",
      data.frame(
        Carrera = resumen_raw$base_label,
        Pregunta = resumen_raw$variable_label,
        variable = resumen_raw$variable,
        Tipo = resumen_raw$variable_kind_label,
        Respuestas = resumen_raw$respuestas,
        `Filas de codificación` = resumen_raw$filas_codificacion,
        Categorías = resumen_raw$categorias,
        stringsAsFactors = FALSE
      ), styles
    )
    .codif_matrix_add_dictionary_sheet(wb, tables$categories, styles)
    used_sheets <- openxlsx::sheets(wb)
    for (base in bases) {
      matrix <- client_matrices_by_base[[base]]
      sheet <- .codif_matrix_safe_sheet_name(.codif_matrix_dictionary_label(base), used_sheets)
      used_sheets <- c(used_sheets, sheet)
      .codif_matrix_write_work_matrix_sheet(wb, sheet, matrix, styles, include_obs = FALSE)
    }
  } else {
    tables <- .codif_matrix_build_standard_tables(sid, selected, visibility, bases = bases)
    if (identical(visibility, "internal")) {
      .codif_matrix_add_guide_sheet(wb, styles, visibility)
    }
    .codif_matrix_add_table_sheet(wb, "Resumen", "Resumen de codificación", "Indicadores generales de la matriz exportada.", .codif_matrix_friendly_table(tables$resumen, "resumen"), styles)
    .codif_matrix_add_dictionary_sheet(wb, tables$categories, styles)
    .codif_matrix_add_table_sheet(wb, "Variables", "Preguntas codificadas", "Cada fila muestra una pregunta abierta dentro de una carrera y su avance de codificación.", .codif_matrix_friendly_table(tables$variables, "variables"), styles)
    .codif_matrix_add_table_sheet(wb, "Categorías", "Lista de codificación", "Categorías ordenadas por carrera, pregunta y código.", .codif_matrix_friendly_table(tables$categories, "categories"), styles)
    .codif_matrix_add_table_sheet(wb, "Respuestas", "Respuestas codificadas", "Relación entre respuesta original, código y categoría aplicable.", .codif_matrix_friendly_table(tables$mapping, "mapping"), styles)
    .codif_matrix_add_table_sheet(wb, "Pendientes", "Respuestas pendientes de codificación", "Respuestas no cubiertas por la relación disponible.", .codif_matrix_friendly_table(tables$pendientes, "pendientes"), styles)
    if (identical(visibility, "internal") && nrow(tables$cases) > 0L) {
      .codif_matrix_add_table_sheet(wb, "Casos", "Trazabilidad por caso", "Detalle interno con ID de caso conservado desde matrices caso-código.", .codif_matrix_friendly_table(tables$cases, "cases"), styles)
    }
    .codif_matrix_add_table_sheet(wb, "Notas", "Notas", "Notas de lectura y compatibilidad del workbook.", .codif_matrix_friendly_table(tables$notas, "notas"), styles)
  }

  s <- session_get(sid)
  dir.create(file.path(s$dir, "downloads"), recursive = TRUE, showWarnings = FALSE)
  out <- file.path(
    s$dir, "downloads",
    sprintf("matriz_codificacion_%s_%s.xlsx", visibility, uuid::UUIDgenerate())
  )
  openxlsx::saveWorkbook(wb, out, overwrite = TRUE)
  meta <- .register_output_file(sid, paste0("codificacion_matriz_", visibility), out)
  list(ok = TRUE, file_id = meta$file_id, size = meta$size, visibility = visibility)
}
