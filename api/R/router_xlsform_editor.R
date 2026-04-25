# Router del editor de XLSForms.
#
# Expone un MVP útil para:
#   - importar un XLSForm existente al editor
#   - traducir un export .sav de SurveyMonkey a un XLSForm editable
#   - exportar nuevamente el workbook editado a .xlsx dentro de la sesión

.xlsform_editor_default_columns <- function(sheet_name) {
  switch(
    tolower(as.character(sheet_name)[1] %||% ""),
    survey = c("type", "name", "label", "required", "relevant", "constraint", "calculation", "choice_filter", "appearance"),
    choices = c("list_name", "name", "label"),
    settings = c("form_title", "form_id", "version", "default_language"),
    diagnostico = character(0),
    character(0)
  )
}

.xlsform_editor_empty_df <- function(columns = character(0)) {
  cols <- as.character(columns %||% character(0))
  out <- as.data.frame(
    stats::setNames(vector("list", length(cols)), cols),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  for (nm in names(out)) out[[nm]] <- as.character(out[[nm]])
  out
}

.xlsform_editor_df_to_char <- function(df) {
  if (is.null(df)) return(.xlsform_editor_empty_df())
  out <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  if (!ncol(out)) return(out)
  names(out) <- as.character(names(out))
  for (nm in names(out)) {
    x <- out[[nm]]
    if (inherits(x, c("Date", "POSIXct", "POSIXt"))) x <- as.character(x)
    x <- as.character(x)
    x[is.na(x)] <- ""
    Encoding(x) <- "UTF-8"
    out[[nm]] <- x
  }
  out
}

.xlsform_editor_read_sheet <- function(path, sheet_name, default_columns = NULL) {
  sheets <- tryCatch(readxl::excel_sheets(path), error = function(e) character(0))
  hit <- which(tolower(sheets) == tolower(as.character(sheet_name)[1] %||% ""))
  if (!length(hit)) {
    return(.xlsform_editor_empty_df(default_columns %||% .xlsform_editor_default_columns(sheet_name)))
  }
  df <- tryCatch(
    readxl::read_excel(
      path,
      sheet = sheets[hit[1]],
      col_types = "text",
      .name_repair = "minimal"
    ),
    error = function(e) NULL
  )
  df <- .xlsform_editor_df_to_char(df)
  if (!ncol(df) && length(default_columns %||% character(0))) {
    df <- .xlsform_editor_empty_df(default_columns %||% .xlsform_editor_default_columns(sheet_name))
  }
  df
}

.xlsform_editor_sheet_payload <- function(df, name = NULL) {
  df <- .xlsform_editor_df_to_char(df)
  columns <- as.character(names(df))
  rows <- if (nrow(df)) {
    lapply(seq_len(nrow(df)), function(i) unname(as.character(df[i, , drop = TRUE])))
  } else {
    list()
  }
  list(
    name = if (is.null(name)) NA_character_ else as.character(name)[1],
    columns = columns,
    rows = rows
  )
}

.xlsform_editor_as_chr_vec <- function(x) {
  if (is.null(x)) return(character(0))
  if (is.atomic(x) && !is.list(x)) return(as.character(x))
  as.character(unlist(x, recursive = FALSE, use.names = FALSE))
}

.xlsform_editor_payload_to_df <- function(sheet, fallback_name = NA_character_) {
  sheet <- sheet %||% list()
  columns <- .xlsform_editor_as_chr_vec(sheet$columns)
  rows_raw <- sheet$rows %||% list()

  if (!length(columns)) {
    columns <- .xlsform_editor_default_columns(fallback_name)
  }
  if (!length(columns)) {
    return(.xlsform_editor_empty_df())
  }

  if (!length(rows_raw)) {
    return(.xlsform_editor_empty_df(columns))
  }

  rows <- lapply(rows_raw, function(row) {
    vals <- .xlsform_editor_as_chr_vec(row)
    if (length(vals) < length(columns)) {
      vals <- c(vals, rep("", length(columns) - length(vals)))
    }
    vals <- vals[seq_len(length(columns))]
    vals[is.na(vals)] <- ""
    as.character(vals)
  })

  mat <- do.call(rbind, rows)
  if (is.null(dim(mat))) {
    mat <- matrix(mat, nrow = 1L)
  }
  df <- as.data.frame(mat, stringsAsFactors = FALSE, check.names = FALSE)
  names(df) <- columns
  for (nm in names(df)) df[[nm]] <- as.character(df[[nm]])
  df
}

.xlsform_editor_workbook_payload <- function(sheets, source_kind = NA_character_, source_name = NA_character_, warnings = list()) {
  survey <- sheets$survey %||% .xlsform_editor_empty_df(.xlsform_editor_default_columns("survey"))
  choices <- sheets$choices %||% .xlsform_editor_empty_df(.xlsform_editor_default_columns("choices"))
  settings <- sheets$settings %||% .xlsform_editor_empty_df(.xlsform_editor_default_columns("settings"))
  diagnostico <- sheets$diagnostico

  workbook <- list(
    survey = .xlsform_editor_sheet_payload(survey, "survey"),
    choices = .xlsform_editor_sheet_payload(choices, "choices"),
    settings = .xlsform_editor_sheet_payload(settings, "settings")
  )
  if (!is.null(diagnostico)) {
    workbook$diagnostico <- .xlsform_editor_sheet_payload(diagnostico, "diagnostico")
  }

  list(
    ok = TRUE,
    workbook = workbook,
    summary = list(
      survey_rows = as.integer(nrow(survey)),
      choices_rows = as.integer(nrow(choices)),
      settings_rows = as.integer(nrow(settings)),
      diagnostico_rows = as.integer(if (is.null(diagnostico)) 0L else nrow(diagnostico))
    ),
    source = list(
      kind = if (is.null(source_kind) || !nzchar(source_kind)) NA_character_ else as.character(source_kind)[1],
      original_name = if (is.null(source_name) || !nzchar(source_name)) NA_character_ else as.character(source_name)[1]
    ),
    warnings = warnings %||% list()
  )
}

.xlsform_editor_parse_body <- function(req) {
  body_raw <- if (!is.null(req$bodyRaw) && length(req$bodyRaw) > 0L) {
    rawToChar(req$bodyRaw)
  } else {
    req$postBody %||% ""
  }
  if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
  Encoding(body_raw) <- "UTF-8"
  tryCatch(
    jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
  )
}

.xlsform_editor_validate_meta <- function(meta, expected_kind, code, message) {
  if (is.null(meta) || !identical(as.character(meta$kind), expected_kind)) {
    stop_api(400, code, message)
  }
  meta
}

mount_xlsform_editor <- function(pr) {
  pr |>
    plumber::pr_post("/api/xlsform-editor/import", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .xlsform_editor_parse_body(req)
      file_id <- as.character(parsed$file_id %||% "")
      if (!nzchar(file_id)) stop_api(400, "E_MISSING_FILE_ID", "Falta 'file_id'.")

      meta <- get_file(sid, file_id)
      .xlsform_editor_validate_meta(
        meta,
        expected_kind = "xlsform",
        code = "E_BAD_EDITOR_SOURCE",
        message = "El editor espera un archivo subido con kind='xlsform'."
      )

      survey <- .xlsform_editor_read_sheet(meta$path, "survey")
      choices <- .xlsform_editor_read_sheet(meta$path, "choices", .xlsform_editor_default_columns("choices"))
      settings <- .xlsform_editor_read_sheet(meta$path, "settings", .xlsform_editor_default_columns("settings"))

      .xlsform_editor_workbook_payload(
        sheets = list(survey = survey, choices = choices, settings = settings),
        source_kind = "xlsform",
        source_name = meta$original_name
      )
    })) |>
    plumber::pr_post("/api/xlsform-editor/import-surveymonkey", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .xlsform_editor_parse_body(req)
      file_id <- as.character(parsed$file_id %||% "")
      lang <- as.character(parsed$lang %||% "es")
      if (!nzchar(file_id)) stop_api(400, "E_MISSING_FILE_ID", "Falta 'file_id'.")

      meta <- get_file(sid, file_id)
      .xlsform_editor_validate_meta(
        meta,
        expected_kind = "sav",
        code = "E_BAD_SURVEYMONKEY_SOURCE",
        message = "La importación SurveyMonkey espera un archivo .sav subido con kind='sav'."
      )

      sm <- surveymonkey_leer(meta$path)
      out <- surveymonkey_xlsform(sm, lang = lang)

      .xlsform_editor_workbook_payload(
        sheets = list(
          survey = out$survey,
          choices = out$choices,
          settings = out$settings,
          diagnostico = out$diagnostico
        ),
        source_kind = "surveymonkey",
        source_name = meta$original_name
      )
    })) |>
    plumber::pr_post("/api/xlsform-editor/export", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }

      parsed <- .xlsform_editor_parse_body(req)
      workbook <- parsed$workbook %||% list()
      filename <- as.character(parsed$filename %||% "instrumento_editado.xlsx")
      if (!grepl("\\.xlsx$", filename, ignore.case = TRUE)) {
        filename <- paste0(filename, ".xlsx")
      }

      survey <- .xlsform_editor_payload_to_df(workbook$survey, "survey")
      choices <- .xlsform_editor_payload_to_df(workbook$choices, "choices")
      settings <- .xlsform_editor_payload_to_df(workbook$settings, "settings")
      diagnostico <- if (!is.null(workbook$diagnostico)) {
        .xlsform_editor_payload_to_df(workbook$diagnostico, "diagnostico")
      } else NULL

      wb <- openxlsx::createWorkbook()
      openxlsx::addWorksheet(wb, "survey")
      openxlsx::writeData(wb, "survey", survey)
      openxlsx::freezePane(wb, "survey", firstActiveRow = 2)
      if (ncol(survey)) openxlsx::setColWidths(wb, "survey", cols = seq_len(ncol(survey)), widths = "auto")

      openxlsx::addWorksheet(wb, "choices")
      openxlsx::writeData(wb, "choices", choices)
      openxlsx::freezePane(wb, "choices", firstActiveRow = 2)
      if (ncol(choices)) openxlsx::setColWidths(wb, "choices", cols = seq_len(ncol(choices)), widths = "auto")

      openxlsx::addWorksheet(wb, "settings")
      openxlsx::writeData(wb, "settings", settings)
      openxlsx::freezePane(wb, "settings", firstActiveRow = 2)
      if (ncol(settings)) openxlsx::setColWidths(wb, "settings", cols = seq_len(ncol(settings)), widths = "auto")

      if (!is.null(diagnostico) && (ncol(diagnostico) > 0L || nrow(diagnostico) > 0L)) {
        openxlsx::addWorksheet(wb, "diagnostico")
        openxlsx::writeData(wb, "diagnostico", diagnostico)
        openxlsx::freezePane(wb, "diagnostico", firstActiveRow = 2)
        if (ncol(diagnostico)) openxlsx::setColWidths(wb, "diagnostico", cols = seq_len(ncol(diagnostico)), widths = "auto")
      }

      tmp <- tempfile("xlsform_editor_", fileext = ".xlsx")
      on.exit(unlink(tmp), add = TRUE)
      openxlsx::saveWorkbook(wb, tmp, overwrite = TRUE)
      bytes <- readBin(tmp, what = "raw", n = file.info(tmp)$size)
      meta <- save_upload(sid, kind = "xlsform", original_name = filename, raw_bytes = bytes)

      list(
        ok = TRUE,
        file_id = meta$file_id,
        original_name = meta$original_name,
        size = meta$size
      )
    }))
}
