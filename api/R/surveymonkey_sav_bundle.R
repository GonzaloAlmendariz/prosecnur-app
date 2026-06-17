# =============================================================================
# SurveyMonkey ZIP SAV offline -> actualizacion controlada multibase
#
# Este importador parte de bases hermanas independientes existentes. Cada .sav
# del ZIP se normaliza contra el XLSForm efectivo de su base y reemplaza solo la
# data efectiva, dejando un plan de cambio auditable antes de mutar la sesion.
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
    file_col <- intersect(c("file", "filename", "sav_file", "source_file"), names(x))[1]
    if (is.na(file_col) || !"base" %in% names(x)) return(list())
    out <- as.list(as.character(x$base %||% ""))
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
  for (key in .sm_sav_entry_base_map_key(entry_safe)) {
    mapped <- .sm_mb_scalar(explicit_map[[key]], "")
    if (nzchar(mapped)) return(if (mapped %in% names(bases)) mapped else "")
  }
  mapped <- .sm_mb_scalar(
    explicit_map[[entry_raw]] %||%
      explicit_map[[basename(entry_raw)]] %||%
      explicit_map[[entry_safe]] %||%
      explicit_map[[basename(entry_safe)]],
    ""
  )
  if (nzchar(mapped)) return(if (mapped %in% names(bases)) mapped else "")

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

.sm_sav_convert_entry_data <- function(df, inst, base_name, base_meta, entry_name, missing_policy = "fill_blank_warn") {
  df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  raw_names <- names(df)
  expected <- .sm_sav_expected_variables(inst)
  normalized <- normalize_data_for_xlsform(df, inst)
  normalized_attr <- attr(normalized, "xlsform_normalized", exact = TRUE) %||% list()

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
  expected_present <- intersect(expected, names(normalized))
  all_empty_variables <- expected_present[vapply(expected_present, function(var) {
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

  survey_id <- .sm_mb_scalar(base_meta$survey_id %||% base_name, base_name)
  normalized$survey_id <- survey_id
  normalized$source_title <- .sm_mb_scalar(base_meta$source_title %||% base_meta$source_alias %||% base_name, base_name)
  normalized$source_channel <- "sav_zip_offline"
  normalized$case_uid <- paste(survey_id, as.character(normalized$response_id %||% seq_len(nrow(normalized))), sep = ":")

  normalized <- normalize_data_for_xlsform(normalized, inst)
  for (var in expected) {
    if (!var %in% names(normalized)) normalized[[var]] <- NA_character_
  }

  preferred <- unique(c(
    "survey_id", "response_id", "respondent_id", "case_uid", "response_status",
    "date_created", "date_modified", "collector_id", "collector_type",
    "collection_mode", "ip_address", "total_time", "email_address", "first_name",
    "last_name", "cv_id", "custom_value", "source_title", "source_channel",
    expected
  ))
  normalized <- normalized[, c(intersect(preferred, names(normalized)), setdiff(names(normalized), preferred)), drop = FALSE]

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
    dropped_columns = as.list(unname(normalized_attr$dropped_columns %||% character(0))),
    warnings = as.list(warnings)
  )

  list(data = normalized, audit = audit)
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

.sm_sav_save_snapshot <- function(sid, base_name, bundle_file_id, entry_name, audit, change_plan, source_spec = list(), policy = list()) {
  if (!requireNamespace("jsonlite", quietly = TRUE)) stop("Se requiere jsonlite.", call. = FALSE)
  payload <- list(
    version = "surveymonkey_sav_bundle_snapshot/1",
    created_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    base_name = .sm_mb_scalar(base_name, ""),
    bundle_file_id = .sm_mb_scalar(bundle_file_id, ""),
    entry_name = .sm_mb_scalar(.sm_sav_safe_text(entry_name), ""),
    source_spec = source_spec %||% list(),
    missing_required_policy = .sm_mb_scalar(policy$missing_required_policy %||% "fill_blank_warn", "fill_blank_warn"),
    audit = audit %||% list(),
    change_plan = change_plan %||% list()
  )
  json <- jsonlite::toJSON(payload, auto_unbox = TRUE, null = "null", pretty = FALSE)
  save_upload(
    sid,
    "data",
    paste0(.sm_mb_snapshot_slug(base_name), "_surveymonkey_sav_bundle_snapshot.json"),
    charToRaw(enc2utf8(as.character(json)))
  )
}

.sm_sav_update_base_import <- function(sid, base_name, bundle_file_id, entry_name, data_meta, snapshot_meta,
                                       rp_inst, rp_data, audit, change_plan, source_spec, response_filter) {
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
  base$source_kind <- "surveymonkey_sav_bundle"
  base$survey_id <- .sm_mb_scalar(source_spec$survey_id %||% base$survey_id %||% base_name, "")
  base$source_alias <- .sm_mb_scalar(source_spec$source_alias %||% base$source_alias %||% base_name, base_name)
  base$source_title <- .sm_mb_scalar(source_spec$source_title %||% base$source_title %||% base$source_alias %||% base_name, "")
  base$source_channel <- "sav_zip_offline"
  base$response_filter <- response_filter
  base$surveymonkey_source_spec <- source_spec
  base$surveymonkey_sav_bundle_file_id <- .sm_mb_scalar(bundle_file_id, "")
  base$surveymonkey_sav_bundle_snapshot_file_id <- .sm_mb_scalar(snapshot_meta$file_id, "")
  base$surveymonkey_effective_data_file_id <- .sm_mb_scalar(data_meta$file_id, "")
  base$surveymonkey_sav_bundle_import <- list(
    version = 1L,
    imported_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    bundle_file_id = .sm_mb_scalar(bundle_file_id, ""),
    snapshot_file_id = .sm_mb_scalar(snapshot_meta$file_id, ""),
    file_name = .sm_mb_scalar(.sm_sav_display_name(entry_name), ""),
    entry_name = .sm_mb_scalar(.sm_sav_safe_text(entry_name), ""),
    n_rows = as.integer(nrow(rp_data)),
    n_columns = as.integer(ncol(rp_data)),
    warnings = audit$warnings %||% list(),
    missing_variables = audit$missing_variables %||% list(),
    all_empty_variables = audit$all_empty_variables %||% list(),
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
  first <- names(s$estudio$bases)[1]
  if (identical(first, base_name)) {
    s$rp_inst <- s$rp_inst_sources[[base_name]]
    s$rp_data <- s$rp_data_sources[[base_name]]
  }
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(base)
}

sm_multibase_sav_bundle_inspect <- function(sid, file_id, file_base_map = list(), missing_policy = "fill_blank_warn") {
  s <- .sm_sav_require_session_project(sid)
  file_id <- .sm_mb_scalar(file_id, "")
  if (!nzchar(file_id)) stop_api(400, "E_SM_SAV_FILE_REQUIRED", "Debes subir un ZIP con archivos .sav.")
  meta <- get_file(sid, file_id)
  ext <- tolower(meta$ext %||% tools::file_ext(meta$path))
  if (!identical(ext, "zip")) {
    stop_api(400, "E_SM_SAV_FILE_UNSUPPORTED", "El archivo debe ser .zip.")
  }
  entries <- .sm_sav_zip_entries(meta$path)
  if (!nrow(entries)) stop_api(400, "E_SM_SAV_EMPTY_ZIP", "El ZIP no contiene archivos .sav.")

  explicit_map <- .sm_sav_file_base_map(file_base_map)
  rows <- list()
  warnings <- character(0)
  blocking <- character(0)
  used_bases <- character(0)

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
    inst <- reporte_instrumento(path = get_file(sid, xls_id)$path)
    df <- .sm_sav_read_entry(meta$path, entry_name, i)
    converted <- .sm_sav_convert_entry_data(df, inst, base_name, base, entry_name, missing_policy = missing_policy)
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
    item$warnings <- audit$warnings
    item$change_plan <- plan
    warnings <- c(warnings, unlist(audit$warnings %||% list(), use.names = FALSE))
    rows[[length(rows) + 1L]] <- item
  }

  list(
    ok = length(blocking) == 0L,
    file_id = file_id,
    filename = .sm_mb_scalar(meta$original_name %||% basename(meta$path), ""),
    n_files = as.integer(nrow(entries)),
    n_matched = as.integer(sum(vapply(rows, function(x) isTRUE(x$matched) && !isTRUE(x$blocking), logical(1)))),
    n_blocking = as.integer(length(blocking)),
    blocking_files = as.list(blocking),
    files = rows,
    change_plan = rows,
    warnings = as.list(unique(warnings))
  )
}

sm_multibase_sav_bundle_import <- function(sid, file_id, file_base_map = list(), missing_policy = "fill_blank_warn") {
  inspection <- sm_multibase_sav_bundle_inspect(
    sid = sid,
    file_id = file_id,
    file_base_map = file_base_map,
    missing_policy = missing_policy
  )
  if (!identical(inspection$ok, TRUE)) {
    stop_api(409, "E_SM_SAV_INSPECTION_BLOCKED", "Hay archivos SAV sin base o asignaciones bloqueantes. Revisa el mapeo antes de importar.")
  }
  s <- session_get(sid)
  meta <- get_file(sid, file_id)
  downloads_dir <- file.path(s$dir, "downloads")
  dir.create(downloads_dir, recursive = TRUE, showWarnings = FALSE)
  results <- list()

  for (idx in seq_along(inspection$files)) {
    file_item <- inspection$files[[idx]]
    entry_name <- .sm_mb_scalar(attr(file_item, "entry_name_raw", exact = TRUE) %||% file_item$entry_name, "")
    entry_name_safe <- .sm_mb_scalar(.sm_sav_safe_text(entry_name), "")
    base_name <- .sm_mb_scalar(file_item$base_name, "")
    if (!nzchar(entry_name) || !nzchar(base_name)) next
    s <- session_get(sid)
    base <- s$estudio$bases[[base_name]]
    inst <- reporte_instrumento(path = get_file(sid, base$xlsform_file_id)$path)
    df <- .sm_sav_read_entry(meta$path, entry_name, idx)
    converted <- .sm_sav_convert_entry_data(df, inst, base_name, base, entry_name, missing_policy = missing_policy)
    .carga_assert_data_xlsform_compatible(converted$data, inst)
    change_plan <- .sm_sav_change_plan(base, entry_name, converted$audit)

    data_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", .sm_mb_snapshot_slug(base_name), "_sav_bundle_data.xlsx"))
    .sm_mb_write_xlsx(converted$data, data_path)
    data_meta <- save_upload(sid, "data", paste0(.sm_mb_snapshot_slug(base_name), "_sav_bundle_data.xlsx"), readBin(data_path, "raw", n = file.info(data_path)$size))
    rp_data <- reporte_data(converted$data, instrumento = inst)
    source_spec <- list(
      version = 1L,
      source_kind = "surveymonkey_sav_bundle",
      survey_id = .sm_mb_scalar(base$survey_id %||% base_name, ""),
      source_alias = .sm_mb_scalar(base$source_alias %||% base_name, base_name),
      source_title = .sm_mb_scalar(base$source_title %||% base$source_alias %||% base_name, ""),
      source_channel = "sav_zip_offline",
      sav_bundle_file_id = .sm_mb_scalar(file_id, ""),
      sav_bundle_filename = .sm_mb_scalar(meta$original_name %||% basename(meta$path), ""),
      file_name = .sm_mb_scalar(.sm_sav_display_name(entry_name), ""),
      entry_name = entry_name_safe
    )
    response_filter <- .sm_sav_response_filter(entry_name, base_name, converted$audit)
    response_filter$survey_id <- source_spec$survey_id
    response_filter$source_title <- source_spec$source_title
    response_filter$source_alias <- source_spec$source_alias
    response_filter$source_channel <- source_spec$source_channel
    snapshot_meta <- .sm_sav_save_snapshot(
      sid,
      base_name = base_name,
      bundle_file_id = file_id,
      entry_name = entry_name,
      audit = converted$audit,
      change_plan = change_plan,
      source_spec = source_spec,
      policy = list(missing_required_policy = missing_policy)
    )
    updated_base <- .sm_sav_update_base_import(
      sid = sid,
      base_name = base_name,
      bundle_file_id = file_id,
      entry_name = entry_name,
      data_meta = data_meta,
      snapshot_meta = snapshot_meta,
      rp_inst = inst,
      rp_data = rp_data,
      audit = converted$audit,
      change_plan = change_plan,
      source_spec = source_spec,
      response_filter = response_filter
    )
    results[[length(results) + 1L]] <- list(
      base_name = base_name,
      file_name = .sm_mb_scalar(.sm_sav_display_name(entry_name), ""),
      entry_name = entry_name_safe,
      data_file_id = data_meta$file_id,
      snapshot_file_id = snapshot_meta$file_id,
      n_rows = as.integer(nrow(rp_data)),
      n_columns = as.integer(ncol(rp_data)),
      warnings = converted$audit$warnings %||% list(),
      change_plan = change_plan,
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
