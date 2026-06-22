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
