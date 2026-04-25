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

# -----------------------------------------------------------------------------
# Validador estructural del workbook editor (Sub-PR 9 del revamp)
# -----------------------------------------------------------------------------
# Recibe los tres data.frames (survey/choices/settings) y devuelve un vector
# de diagnostics tipados para que el frontend los muestre en el
# `DiagnosticsBadge`. No incluye validación AST de expresiones (relevant /
# constraint / calculation) — eso es Fase 2 cuando reusemos
# `odk_parse_to_ast()`. En Fase 1 solo verificamos:
#   1. `name` por fila cumple ^[a-zA-Z_][a-zA-Z0-9_]*$
#   2. No hay duplicados de `name` en survey (excepto end_*).
#   3. Cada select_one X / select_multiple X tiene X en choices.list_name.
#   4. Balance estricto de begin_group/end_group y begin_repeat/end_repeat.
#   5. settings.form_id no vacío y con formato slug.
# -----------------------------------------------------------------------------

.xlsform_editor_diag <- function(id, level, title, detail, row_index = NULL, catalog_name = NULL) {
  out <- list(
    id = as.character(id)[1],
    level = as.character(level)[1],
    title = as.character(title)[1],
    detail = as.character(detail)[1]
  )
  if (!is.null(row_index)) out$rowIndex <- as.integer(row_index)[1]
  if (!is.null(catalog_name)) out$catalogName <- as.character(catalog_name)[1]
  out
}

.xlsform_editor_name_is_valid <- function(value) {
  v <- as.character(value)[1]
  if (is.na(v) || !nzchar(v)) return(FALSE)
  grepl("^[a-zA-Z_][a-zA-Z0-9_]*$", v)
}

.xlsform_editor_form_id_is_valid <- function(value) {
  v <- as.character(value)[1]
  if (is.na(v) || !nzchar(v)) return(FALSE)
  grepl("^[a-zA-Z_][a-zA-Z0-9_-]*$", v)
}

xlsform_editor_validate <- function(survey, choices, settings) {
  diagnostics <- list()

  # ---- Survey ---------------------------------------------------------------
  if (is.null(survey$type)) survey$type <- character(nrow(survey))
  if (is.null(survey$name)) survey$name <- character(nrow(survey))

  type_col <- as.character(survey$type %||% character(nrow(survey)))
  name_col <- as.character(survey$name %||% character(nrow(survey)))

  # 1. names inválidos
  for (i in seq_along(name_col)) {
    nm <- trimws(name_col[i])
    base <- trimws(strsplit(type_col[i] %||% "", "\\s+")[[1]][1] %||% "")
    if (!nzchar(nm)) {
      # Filas de marcador end_group/end_repeat tienen name vacío en muchos
      # archivos; las saltamos. Igualmente saltamos start/end/today/etc.
      if (base %in% c("end_group", "end_repeat", "start", "end", "today", "deviceid", "username", "")) next
      diagnostics[[length(diagnostics) + 1]] <- .xlsform_editor_diag(
        id = paste0("name-empty-", i - 1L),
        level = "warn",
        title = "Pregunta sin nombre interno",
        detail = "Cada pregunta necesita un identificador. Asignalo desde el inspector.",
        row_index = i - 1L
      )
      next
    }
    if (!.xlsform_editor_name_is_valid(nm)) {
      diagnostics[[length(diagnostics) + 1]] <- .xlsform_editor_diag(
        id = paste0("name-invalid-", i - 1L),
        level = "warn",
        title = sprintf("Nombre inválido: \"%s\"", nm),
        detail = "Usa solo letras, números y guion bajo. Empieza con letra.",
        row_index = i - 1L
      )
    }
  }

  # 2. duplicados en survey (excepto si están vacíos)
  trimmed_names <- trimws(name_col)
  bases <- vapply(type_col, function(x) trimws(strsplit(x %||% "", "\\s+")[[1]][1] %||% ""), character(1))
  for (nm in unique(trimmed_names)) {
    if (!nzchar(nm)) next
    idxs <- which(trimmed_names == nm & !(bases %in% c("end_group", "end_repeat")))
    if (length(idxs) > 1) {
      diagnostics[[length(diagnostics) + 1]] <- .xlsform_editor_diag(
        id = paste0("name-duplicate-", nm),
        level = "warn",
        title = sprintf("Nombre duplicado: \"%s\"", nm),
        detail = sprintf("El identificador \"%s\" se usa en %d filas. Cada pregunta debe tener un nombre único.", nm, length(idxs)),
        row_index = idxs[1] - 1L
      )
    }
  }

  # 3. select_one/multiple sin lista en choices
  if (!is.null(choices) && !is.null(choices$list_name)) {
    list_names <- unique(trimws(as.character(choices$list_name)))
    list_names <- list_names[nzchar(list_names)]
  } else {
    list_names <- character(0)
  }
  for (i in seq_along(type_col)) {
    raw <- as.character(type_col[i] %||% "")
    parts <- trimws(strsplit(raw, "\\s+")[[1]])
    base <- parts[1] %||% ""
    if (base %in% c("select_one", "select_multiple")) {
      list_ref <- if (length(parts) >= 2) paste(parts[-1], collapse = " ") else ""
      list_ref <- trimws(list_ref)
      if (!nzchar(list_ref)) {
        diagnostics[[length(diagnostics) + 1]] <- .xlsform_editor_diag(
          id = paste0("select-no-list-", i - 1L),
          level = "warn",
          title = "Pregunta de selección sin catálogo",
          detail = "Asigna un catálogo desde el inspector para que la pregunta tenga opciones.",
          row_index = i - 1L
        )
      } else if (!(list_ref %in% list_names)) {
        diagnostics[[length(diagnostics) + 1]] <- .xlsform_editor_diag(
          id = paste0("select-missing-list-", i - 1L, "-", list_ref),
          level = "warn",
          title = sprintf("Catálogo \"%s\" no existe", list_ref),
          detail = "La pregunta referencia un catálogo que no está definido en la hoja choices.",
          row_index = i - 1L,
          catalog_name = list_ref
        )
      }
    }
  }

  # 4. balance group/repeat
  stack_kind <- character(0)
  stack_row <- integer(0)
  for (i in seq_along(type_col)) {
    base <- bases[i]
    if (base %in% c("begin_group", "begin_repeat")) {
      stack_kind <- c(stack_kind, base)
      stack_row <- c(stack_row, i - 1L)
    } else if (base %in% c("end_group", "end_repeat")) {
      expected <- if (base == "end_group") "begin_group" else "begin_repeat"
      if (!length(stack_kind)) {
        diagnostics[[length(diagnostics) + 1]] <- .xlsform_editor_diag(
          id = paste0("orphan-end-", i - 1L),
          level = "warn",
          title = sprintf("\"%s\" sin apertura previa", base),
          detail = "Esta fila cierra un bloque pero no hay un begin_* correspondiente arriba.",
          row_index = i - 1L
        )
      } else {
        top_kind <- stack_kind[length(stack_kind)]
        top_row <- stack_row[length(stack_row)]
        stack_kind <- stack_kind[-length(stack_kind)]
        stack_row <- stack_row[-length(stack_row)]
        if (top_kind != expected) {
          diagnostics[[length(diagnostics) + 1]] <- .xlsform_editor_diag(
            id = paste0("mismatch-end-", i - 1L),
            level = "warn",
            title = "Cierre cruzado de bloque",
            detail = sprintf("Un \"%s\" abrió pero llegó \"%s\" antes de cerrarlo.", top_kind, base),
            row_index = top_row
          )
        }
      }
    }
  }
  for (k in seq_along(stack_kind)) {
    diagnostics[[length(diagnostics) + 1]] <- .xlsform_editor_diag(
      id = paste0("unclosed-", stack_row[k]),
      level = "warn",
      title = sprintf("\"%s\" sin cierre", stack_kind[k]),
      detail = "Este bloque no tiene su end_* correspondiente. El XLSForm no se exportará bien.",
      row_index = stack_row[k]
    )
  }

  # 5. settings.form_id
  form_id_val <- ""
  if (!is.null(settings$form_id) && nrow(settings) >= 1L) {
    form_id_val <- as.character(settings$form_id[1])
  }
  if (!nzchar(trimws(form_id_val))) {
    diagnostics[[length(diagnostics) + 1]] <- .xlsform_editor_diag(
      id = "settings-form-id-empty",
      level = "warn",
      title = "Formulario sin ID",
      detail = "Define un form_id en la pestaña de configuración. Es obligatorio para publicar."
    )
  } else if (!.xlsform_editor_form_id_is_valid(form_id_val)) {
    diagnostics[[length(diagnostics) + 1]] <- .xlsform_editor_diag(
      id = "settings-form-id-invalid",
      level = "warn",
      title = sprintf("form_id \"%s\" inválido", form_id_val),
      detail = "Usa solo letras, números, guion y guion bajo. Debe empezar con letra o _."
    )
  }

  # 6. AST de cada expresión lógica — usamos `odk_parse_to_ast` (Fase 2).
  #    Si el parseo cae al escape hatch raw (degraded_to_raw=TRUE) y el
  #    origen NO es "pulldata" (que se descarta a propósito), emitimos
  #    diagnostic warn con la fila afectada.
  diagnostics <- c(
    diagnostics,
    .xlsform_editor_validate_expressions(survey, name_col, type_col)
  )

  diagnostics
}

# -----------------------------------------------------------------------------
# Validador de expresiones via odk_parse_to_ast (F2-7)
# -----------------------------------------------------------------------------
.xlsform_editor_validate_expressions <- function(survey, name_col, type_col) {
  out <- list()
  if (!exists("odk_parse_to_ast", mode = "function")) return(out)

  # Set de names válidos en el survey — para detectar referencias a
  # variables que no existen.
  valid_names <- unique(trimws(name_col))
  valid_names <- valid_names[nzchar(valid_names)]

  fields <- list(
    list(col = "relevant", context = "relevant", title = "Visibilidad"),
    list(col = "constraint", context = "constraint", title = "Validación"),
    list(col = "calculation", context = "calculate", title = "Fórmula"),
    list(col = "choice_filter", context = "choice_filter", title = "Filtro de catálogo")
  )

  for (field in fields) {
    col_data <- survey[[field$col]]
    if (is.null(col_data)) next
    col_data <- as.character(col_data)
    for (i in seq_along(col_data)) {
      raw <- trimws(col_data[i] %||% "")
      if (!nzchar(raw)) next
      self_var <- if (field$context == "constraint") trimws(name_col[i] %||% "") else NULL
      parsed <- tryCatch(
        odk_parse_to_ast(raw, context = field$context, self_var = self_var),
        error = function(e) NULL
      )
      if (is.null(parsed)) next
      degraded <- isTRUE(parsed$degraded_to_raw)
      origin <- tryCatch(
        as.character(parsed$ast$origin %||% ""),
        error = function(e) ""
      )
      # Pulldata se descarta a propósito — no lo reportamos.
      if (degraded && !grepl("^pulldata", origin)) {
        out[[length(out) + 1]] <- .xlsform_editor_diag(
          id = sprintf("ast-unparseable-%s-%d", field$col, i - 1L),
          level = "warn",
          title = sprintf("%s no se pudo interpretar", field$title),
          detail = sprintf(
            "La expresión \"%s\" no encaja en la sintaxis ODK estándar. Pulso la conserva al exportar pero el editor visual no la podrá editar.",
            substr(raw, 1L, 80L)
          ),
          row_index = i - 1L
        )
        next
      }

      # Si parseó OK, miramos si referencia variables que no existen.
      missing <- .xlsform_editor_collect_missing_refs(parsed$ast, valid_names)
      for (ref in missing) {
        out[[length(out) + 1]] <- .xlsform_editor_diag(
          id = sprintf("ast-missing-ref-%s-%d-%s", field$col, i - 1L, ref),
          level = "warn",
          title = sprintf("Referencia a variable inexistente: \"%s\"", ref),
          detail = sprintf(
            "El campo \"%s\" usa ${%s} pero esa pregunta no existe en el formulario.",
            field$title, ref
          ),
          row_index = i - 1L
        )
      }
    }
  }
  out
}

# Recorre un AST devuelto por odk_parse_to_ast (estilo `vd_ast` del paquete)
# y devuelve los nombres de variables `${var}` referenciadas que no están
# en valid_names. Los AST primitives usan campos `var`, `var_a`, `var_b`,
# `vars` (vector), `host_var`, `repeat_name`, `cols` (vector). Recorrido
# defensivo — para nodos desconocidos seguimos bajando por args/condition/
# consequence.
.xlsform_editor_collect_missing_refs <- function(ast, valid_names) {
  if (is.null(ast)) return(character(0))
  vars <- character(0)
  walk <- function(node) {
    if (is.null(node) || !is.list(node)) return()
    # Campos escalares con nombre de variable.
    for (key in c("var", "var_a", "var_b", "host_var", "repeat_name")) {
      v <- node[[key]]
      if (is.character(v) && length(v) == 1 && nzchar(v)) {
        vars[length(vars) + 1L] <<- v
      }
    }
    # Campos vector con varios nombres.
    for (key in c("vars", "cols")) {
      v <- node[[key]]
      if (is.character(v) && length(v) >= 1) {
        for (vi in v) if (nzchar(vi)) vars[length(vars) + 1L] <<- vi
      }
    }
    # Recursión a ramas conocidas.
    for (key in c("args", "condition", "consequence")) {
      child <- node[[key]]
      if (is.list(child)) {
        if (inherits(child, "vd_ast")) {
          walk(child)
        } else {
          for (k in child) if (is.list(k)) walk(k)
        }
      }
    }
  }
  walk(ast)
  vars <- unique(vars[!is.na(vars) & nzchar(vars)])
  vars[!(vars %in% valid_names)]
}

# Atajo legible cuando ya tenemos el workbook serializado del frontend.
.xlsform_editor_validate_workbook <- function(workbook) {
  survey <- .xlsform_editor_payload_to_df(workbook$survey, "survey")
  choices <- .xlsform_editor_payload_to_df(workbook$choices, "choices")
  settings <- .xlsform_editor_payload_to_df(workbook$settings, "settings")
  xlsform_editor_validate(survey, choices, settings)
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
    })) |>
    plumber::pr_post("/api/xlsform-editor/validate", wrap_endpoint(function(req, res, ...) {
      # Validador estructural ligero. El frontend lo invoca debounced (cada
      # ~1s tras una edición) para refrescar el DiagnosticsBadge. Devuelve
      # SIEMPRE 200 con la lista de diagnostics — los problemas son del
      # contenido del workbook, no del request.
      parsed <- .xlsform_editor_parse_body(req)
      workbook <- parsed$workbook %||% list()
      diagnostics <- .xlsform_editor_validate_workbook(workbook)
      list(
        ok = TRUE,
        diagnostics = diagnostics,
        count = length(diagnostics)
      )
    }))
}
