# Router del editor de XLSForms.
#
# Expone un MVP útil para:
#   - importar un XLSForm existente al editor
#   - traducir un formulario SurveyMonkey vía API a un XLSForm editable
#   - exportar nuevamente el workbook editado a .xlsx dentro de la sesión

.xlsform_editor_default_columns <- function(sheet_name) {
  switch(
    tolower(as.character(sheet_name)[1] %||% ""),
    survey = c("type", "name", "label", "required", "relevant", "constraint", "calculation", "choice_filter", "appearance"),
    choices = c("list_name", "name", "label"),
    settings = c("form_title", "form_id", "version", "default_language"),
    paper = c("id", "kind", "position", "title", "body", "layout"),
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
  paper <- sheets$paper
  diagnostico <- sheets$diagnostico

  workbook <- list(
    survey = .xlsform_editor_sheet_payload(survey, "survey"),
    choices = .xlsform_editor_sheet_payload(choices, "choices"),
    settings = .xlsform_editor_sheet_payload(settings, "settings")
  )
  if (!is.null(paper)) {
    workbook$paper <- .xlsform_editor_sheet_payload(paper, "paper")
  }
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
      paper_rows = as.integer(if (is.null(paper)) 0L else nrow(paper)),
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
# Safe gates — el archivo a importar tiene que verse como un XLSForm real.
# -----------------------------------------------------------------------------
# Antes del rediseño, si el .xlsx no tenía la hoja `survey` ni `choices`
# (ej. instrumentos Pulso/GIZ propios con `Plan`/`Diccionario`/etc.) el
# backend devolvía un workbook con 0 columnas y el frontend se colgaba al
# intentar renderizarlo. Ahora cortamos en el endpoint con un error claro.
#
# Mínimo aceptable:
#   - Hoja `survey` con al menos las columnas `type` y `name`.
#   - Hoja `choices` (puede no existir si el instrumento no usa selects, pero
#     si existe debe tener al menos `list_name` y `name`).
# Settings es opcional; si no está la creamos vacía con defaults.
# -----------------------------------------------------------------------------

.xlsform_editor_assert_xlsform_shape <- function(path) {
  sheets <- tryCatch(readxl::excel_sheets(path), error = function(e) character(0))
  sheets_lower <- tolower(sheets)

  # ¿Tiene `survey`?
  if (!("survey" %in% sheets_lower)) {
    detected <- if (length(sheets)) {
      sprintf(" Hojas detectadas: %s.", paste(sheets, collapse = ", "))
    } else {
      ""
    }
    # Heurística: si tiene "Plan"/"Diccionario"/"Resumen" etc. es muy
    # probable que sea un Plan Pulso, no un XLSForm — mensaje específico.
    pulso_hints <- c("plan", "diccionario", "resumen", "secciones", "leyenda")
    looks_like_pulso <- any(pulso_hints %in% sheets_lower)
    if (looks_like_pulso) {
      stop_api(
        400, "E_NOT_AN_XLSFORM",
        paste0(
          "Este archivo parece un Plan/Diccionario de Pulso, no un XLSForm. ",
          "El editor abre archivos en formato ODK / KoBoToolbox con hojas ",
          "`survey` y `choices` (en minúsculas).",
          detected
        )
      )
    }
    stop_api(
      400, "E_NOT_AN_XLSFORM",
      paste0(
        "El archivo no tiene la hoja `survey` que el formato XLSForm requiere. ",
        "Asegúrate de que el .xlsx siga el estándar ODK / KoBoToolbox.",
        detected
      )
    )
  }

  # Verifico que survey tenga al menos `type` y `name`. Leo con .name_repair
  # para aceptar nombres con espacios pero verifico la presencia case-insensitive.
  survey_idx <- which(sheets_lower == "survey")[1]
  survey_df <- tryCatch(
    readxl::read_excel(
      path,
      sheet = sheets[survey_idx],
      col_types = "text",
      .name_repair = "minimal",
      n_max = 1L  # solo necesitamos los nombres de columna
    ),
    error = function(e) NULL
  )
  if (is.null(survey_df)) {
    stop_api(
      400, "E_NOT_AN_XLSFORM",
      "No pude leer la hoja `survey`. ¿El archivo está corrupto o protegido?"
    )
  }
  survey_cols <- tolower(as.character(names(survey_df)))
  needed <- c("type", "name")
  missing <- setdiff(needed, survey_cols)
  if (length(missing) > 0) {
    stop_api(
      400, "E_NOT_AN_XLSFORM",
      sprintf(
        "La hoja `survey` no tiene las columnas mínimas (%s). XLSForm requiere al menos `type` y `name`.",
        paste(missing, collapse = ", ")
      )
    )
  }

  # Si tiene hoja `choices`, verifico también su shape mínimo.
  if ("choices" %in% sheets_lower) {
    choices_idx <- which(sheets_lower == "choices")[1]
    choices_df <- tryCatch(
      readxl::read_excel(
        path,
        sheet = sheets[choices_idx],
        col_types = "text",
        .name_repair = "minimal",
        n_max = 1L
      ),
      error = function(e) NULL
    )
    if (!is.null(choices_df)) {
      choices_cols <- tolower(as.character(names(choices_df)))
      needed_ch <- c("list_name", "name")
      missing_ch <- setdiff(needed_ch, choices_cols)
      if (length(missing_ch) > 0) {
        stop_api(
          400, "E_NOT_AN_XLSFORM",
          sprintf(
            "La hoja `choices` no tiene las columnas mínimas (%s). XLSForm requiere `list_name` y `name`.",
            paste(missing_ch, collapse = ", ")
          )
        )
      }
    }
  }

  invisible(TRUE)
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

.xlsform_editor_sm_pages_from_survey <- function(survey) {
  survey <- as.data.frame(survey, stringsAsFactors = FALSE)
  if (!nrow(survey)) return(list())
  for (col in c("type", "name", "section")) if (!col %in% names(survey)) survey[[col]] <- NA_character_
  out <- list()
  current <- NULL
  page_from_name <- function(nm) {
    m <- regmatches(nm, regexec("^(?:section_pag_|Pag)([0-9]+)$", nm, perl = TRUE))[[1]]
    if (length(m) == 2L) m[2] else NULL
  }
  qref <- function(nm) {
    m <- regmatches(nm, regexec("^[pPqQ]0*([0-9]+)", nm, perl = TRUE))[[1]]
    if (length(m) == 2L) paste0("Q", as.integer(m[2])) else NA_character_
  }
  for (i in seq_len(nrow(survey))) {
    tp <- as.character(survey$type[i] %||% "")
    nm <- as.character(survey$name[i] %||% "")
    if (identical(tp, "begin_group")) {
      pg <- page_from_name(nm)
      if (!is.null(pg)) {
        current <- pg
        if (is.null(out[[pg]])) out[[pg]] <- character(0)
      }
      next
    }
    if (identical(tp, "end_group")) {
      current <- NULL
      next
    }
    if (is.null(current) || !nzchar(nm) || identical(tp, "note")) next
    q <- qref(nm)
    if (!is.na(q)) out[[current]] <- unique(c(out[[current]], q))
  }
  out
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

      # Safe gate: aborta con mensaje claro si el archivo no parece XLSForm.
      # Sin esto, archivos como los Plan de Pulso/GIZ (con hojas Plan,
      # Diccionario, Resumen, etc.) producían un workbook con 0 columnas
      # que colgaba al frontend.
      .xlsform_editor_assert_xlsform_shape(meta$path)

      survey <- .xlsform_editor_read_sheet(meta$path, "survey", .xlsform_editor_default_columns("survey"))
      choices <- .xlsform_editor_read_sheet(meta$path, "choices", .xlsform_editor_default_columns("choices"))
      settings <- .xlsform_editor_read_sheet(meta$path, "settings", .xlsform_editor_default_columns("settings"))
      paper <- .xlsform_editor_read_sheet(meta$path, "paper", .xlsform_editor_default_columns("paper"))

      .xlsform_editor_workbook_payload(
        sheets = list(survey = survey, choices = choices, settings = settings, paper = paper),
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

      sm <- tryCatch(
        surveymonkey_leer(meta$path),
        api_error = function(e) stop(e),
        error = function(e) {
          stop_api(
            400, "E_SAV_READ_FAILED",
            sprintf(
              "No pude leer el archivo .sav de SurveyMonkey: %s. Verifica que sea un export SPSS válido (no .csv ni .xlsx) y que no esté corrupto.",
              conditionMessage(e)
            )
          )
        }
      )
      out <- tryCatch(
        surveymonkey_xlsform(sm, lang = lang),
        api_error = function(e) stop(e),
        error = function(e) {
          stop_api(
            500, "E_SM_TRANSLATE_FAILED",
            sprintf("La traducción a XLSForm falló: %s", conditionMessage(e))
          )
        }
      )

      .xlsform_editor_workbook_payload(
        sheets = list(
          survey = out$survey,
          choices = out$choices,
          settings = out$settings,
          paper = .xlsform_editor_empty_df(.xlsform_editor_default_columns("paper")),
          diagnostico = out$diagnostico
        ),
        source_kind = "surveymonkey",
        source_name = meta$original_name
      )
    })) |>
    plumber::pr_post("/api/xlsform-editor/sav-meta", wrap_endpoint(function(req, res, ...) {
      # Devuelve la lista de preguntas + choices del .sav para poblar los
      # dropdowns del modal de aplicación de lógica condicional.
      sid <- session_header(req)
      parsed <- .xlsform_editor_parse_body(req)
      file_id <- as.character(parsed$file_id %||% "")
      if (!nzchar(file_id)) stop_api(400, "E_MISSING_FILE_ID", "Falta 'file_id'.")

      meta <- get_file(sid, file_id)
      .xlsform_editor_validate_meta(
        meta,
        expected_kind = "sav",
        code = "E_BAD_SURVEYMONKEY_SOURCE",
        message = "El endpoint sav-meta espera un archivo .sav."
      )

      sm <- tryCatch(
        surveymonkey_leer(meta$path),
        error = function(e) {
          stop_api(400, "E_SAV_READ_FAILED",
            sprintf("No pude leer el .sav: %s", conditionMessage(e)))
        }
      )

      vars <- sm$vars_tbl
      preguntas <- list()
      for (i in seq_len(nrow(vars))) {
        if (vars$is_metadata[i] || vars$is_other[i]) next
        # Solo expongo el padre (no los _1, _2 internos de batteries/multi)
        # Heurística: si el name_raw tiene sufijo numérico o alfabético,
        # tomo solo el primer item del grupo (suffix mínimo).
        name_raw <- vars$name_raw[i]
        suffix <- vars$suffix[i]
        group <- vars$group_guess[i]
        if (!is.na(suffix) && nzchar(suffix)) {
          # Solo exponer el primer item del grupo
          group_rows <- vars[vars$group_guess == group & !is.na(vars$suffix) & nzchar(vars$suffix), ]
          first_in_group <- group_rows$name_raw[1]
          if (name_raw != first_in_group) next
        }
        labs <- sm$label_sets[[name_raw]]
        choices <- if (length(labs)) {
          lapply(seq_along(labs), function(j) list(
            code = as.character(unname(labs)[j]),
            label = as.character(names(labs)[j])
          ))
        } else list()

        # Para batteries/multi, exporto el grupo entero como una "pregunta"
        display_name <- if (!is.na(suffix) && nzchar(suffix)) toupper(group) else toupper(name_raw)
        preguntas[[length(preguntas) + 1L]] <- list(
          name = display_name,
          name_raw = name_raw,
          group = group,
          label = .sm_or(vars$label[i], NA_character_),
          kind = vars$kind_guess[i],
          choices = choices
        )
      }

      list(
        ok = TRUE,
        n_filas = as.integer(nrow(sm$data_raw)),
        preguntas = preguntas
      )
    })) |>
    plumber::pr_get("/api/xlsform-editor/sm-token", wrap_endpoint(function(req, res, ...) {
      # Lee el token cifrado del disco (~/.prosecnurapp/secrets/sm_token.dat).
      token <- prosecnur_secret_load("sm_token")
      list(
        ok = TRUE,
        has_token = prosecnur_secret_exists("sm_token"),
        token = if (is.na(token)) "" else token
      )
    })) |>
    plumber::pr_post("/api/xlsform-editor/sm-token", wrap_endpoint(function(req, res, ...) {
      # Guarda el token cifrado en disco. Body: {token: "..."}.
      parsed <- .xlsform_editor_parse_body(req)
      token <- as.character(parsed$token %||% "")
      prosecnur_secret_save("sm_token", token)
      list(ok = TRUE, has_token = nzchar(token))
    })) |>
    plumber::pr_delete("/api/xlsform-editor/sm-token", wrap_endpoint(function(req, res, ...) {
      prosecnur_secret_clear("sm_token")
      list(ok = TRUE)
    })) |>
    plumber::pr_post("/api/xlsform-editor/sm-check-token", wrap_endpoint(function(req, res, ...) {
      # Verifica que el token sea válido contra GET /users/me. Útil para que
      # el frontend confirme al cargar (con un token persistido en
      # localStorage) que sigue funcionando, antes de hacer requests más
      # caros como listar surveys.
      parsed <- .xlsform_editor_parse_body(req)
      token <- as.character(parsed$token %||% "")
      if (!nzchar(token)) stop_api(400, "E_MISSING_TOKEN", "Falta 'token'.")

      info <- tryCatch(
        sm_api_check_token(token),
        error = function(e) list(ok = FALSE, error = conditionMessage(e))
      )
      info
    })) |>
    plumber::pr_post("/api/xlsform-editor/sm-list-surveys", wrap_endpoint(function(req, res, ...) {
      # Lista los surveys del usuario autenticado por el token, para que
      # pueda elegir el ID en lugar de extraerlo manualmente de URLs
      # (las de SurveyMonkey suelen tener tokens encriptados que no
      # exponen el ID numérico real).
      parsed <- .xlsform_editor_parse_body(req)
      token <- as.character(parsed$token %||% "")
      if (!nzchar(token)) stop_api(400, "E_MISSING_TOKEN", "Falta 'token' de la API SurveyMonkey.")

      surveys <- tryCatch(
        sm_api_list_surveys(token),
        error = function(e) stop_api(400, "E_SM_API_FAILED", conditionMessage(e))
      )
      list(ok = TRUE, surveys = surveys, count = length(surveys))
    })) |>
    plumber::pr_post("/api/xlsform-editor/sm-fetch-survey-info", wrap_endpoint(function(req, res, ...) {
      # Vía 3: trae estructura del cuestionario desde la API v3 de SurveyMonkey
      # (mapeo de páginas + family/subtype + validation/required) que el .sav
      # no preserva. Requiere token del usuario (Personal Access Token).
      sid <- session_header(req)
      parsed <- .xlsform_editor_parse_body(req)
      file_id <- as.character(parsed$file_id %||% "")
      survey_id <- as.character(parsed$survey_id %||% "")
      token <- as.character(parsed$token %||% "")

      if (!nzchar(survey_id)) stop_api(400, "E_MISSING_SURVEY_ID", "Falta 'survey_id' del survey en SurveyMonkey.")
      if (!nzchar(token)) stop_api(400, "E_MISSING_TOKEN", "Falta 'token' de la API SurveyMonkey.")

      # Si viene un .sav legacy, detectamos su convención. En el flujo nuevo
      # API-only usamos nombres internos q0001, q0002... como convención estable.
      style <- .sm_api_default_style()
      if (nzchar(file_id)) {
        meta <- get_file(sid, file_id)
        .xlsform_editor_validate_meta(
          meta, expected_kind = "sav",
          code = "E_BAD_SURVEYMONKEY_SOURCE",
          message = "Espera un archivo .sav."
        )
        sm <- tryCatch(
          surveymonkey_leer(meta$path),
          error = function(e) stop_api(400, "E_SAV_READ_FAILED",
            sprintf("No pude leer el .sav: %s", conditionMessage(e)))
        )
        style <- .sm_detect_naming_style(sm$vars_tbl$name_raw)
      }

      details <- tryCatch(
        sm_api_fetch_survey_details(survey_id, token),
        error = function(e) stop_api(400, "E_SM_API_FAILED", conditionMessage(e))
      )

      paginas <- sm_api_extract_paginas(details, style = style)
      pages <- sm_api_extract_pages(details, style = style)
      summary <- sm_api_summary(details)

      list(
        ok = TRUE,
        paginas = paginas,
        pages = pages,
        summary = summary,
        style = list(prefix = style$prefix, pad = as.integer(style$pad))
      )
    })) |>
    plumber::pr_get("/api/xlsform-editor/state", wrap_endpoint(function(req, res, ...) {
      # Lee el state persistido del editor xlsform de la sesión activa.
      # Si hay proyecto .pulso abierto y este state está guardado, viaja
      # con el zip vía build_pulso → load_pulso.
      sid <- session_header(req)
      s <- session_get(sid, required = FALSE)
      if (is.null(s)) return(list(ok = TRUE, has_state = FALSE))
      st <- s$xlsform_state
      if (is.null(st)) return(list(ok = TRUE, has_state = FALSE))
      list(ok = TRUE, has_state = TRUE, state = st)
    })) |>
    plumber::pr_post("/api/xlsform-editor/state", wrap_endpoint(function(req, res, ...) {
      # Guarda/actualiza el state del editor xlsform en la sesión.
      # Body: { workbook: {...}, source: {...}, hallazgos: [...], saved_at: <ts> }
      # Marca el proyecto como dirty para que el autosave del .pulso lo recoja.
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      parsed <- .xlsform_editor_parse_body(req)
      # Aceptamos arbitrary JSON en `state` — el frontend define su shape;
      # el backend solo lo persiste opaco y lo devuelve igual al cargar.
      s <- session_get(sid)
      s$xlsform_state <- parsed
      # Marcar dirty solo si hay proyecto activo.
      if (!is.null(s$project_path) && nzchar(s$project_path)) {
        s$project_dirty <- TRUE
      }
      .session_env[[sid]] <- s
      list(ok = TRUE, saved_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
    })) |>
    plumber::pr_delete("/api/xlsform-editor/state", wrap_endpoint(function(req, res, ...) {
      # Limpia el state del editor xlsform (por ej. al "Cerrar formulario").
      sid <- session_header(req)
      if (is.null(sid)) return(list(ok = TRUE))
      s <- session_get(sid, required = FALSE)
      if (is.null(s)) return(list(ok = TRUE))
      s$xlsform_state <- NULL
      if (!is.null(s$project_path) && nzchar(s$project_path)) {
        s$project_dirty <- TRUE
      }
      .session_env[[sid]] <- s
      list(ok = TRUE)
    })) |>
    plumber::pr_post("/api/xlsform-editor/sm-interpret-rule", wrap_endpoint(function(req, res, ...) {
      # Wizard paso-a-paso: el usuario pega UNA regla, le devolvemos su
      # interpretación humana + diagrama para que confirme antes de aplicarla.
      # Reusa los details de la API si vinieron (resuelve labels reales);
      # si no, devuelve interpretación literal.
      parsed <- .xlsform_editor_parse_body(req)
      regla <- as.character(parsed$regla %||% "")
      workbook <- parsed$workbook
      survey_id <- as.character(parsed$survey_id %||% "")
      token <- as.character(parsed$token %||% "")
      paginas_in <- parsed$paginas
      paginas_labels_in <- parsed$paginas_labels
      overrides_in <- parsed$choice_order_overrides

      paginas <- NULL
      if (!is.null(paginas_in) && length(paginas_in)) {
        paginas <- lapply(paginas_in, function(qs) as.character(unlist(qs)))
        names(paginas) <- as.character(names(paginas_in))
      }
      paginas_labels <- NULL
      if (!is.null(paginas_labels_in) && length(paginas_labels_in)) {
        paginas_labels <- as.list(vapply(paginas_labels_in, as.character, character(1)))
        names(paginas_labels) <- as.character(names(paginas_labels_in))
      }
      # `choice_order_overrides`: { "27": ["Emprendimiento", "Investigación", ...] }
      # — keys son posición global de la pregunta (string), values son listas
      # de labels en el orden que el usuario quiere asignar a C1, C2, ...
      choice_order_overrides <- NULL
      if (!is.null(overrides_in) && length(overrides_in)) {
        choice_order_overrides <- lapply(overrides_in, function(lbls) as.character(unlist(lbls)))
        names(choice_order_overrides) <- as.character(names(overrides_in))
      }

      details <- NULL
      if (nzchar(survey_id) && nzchar(token)) {
        details <- tryCatch(
          sm_api_fetch_survey_details(survey_id, token),
          error = function(e) NULL
        )
      }

      xlsform <- NULL
      sm <- NULL
      if (!is.null(workbook) && length(workbook)) {
        xlsform <- list(
          survey = .xlsform_editor_payload_to_df(workbook$survey, "survey"),
          choices = .xlsform_editor_payload_to_df(workbook$choices, "choices"),
          settings = .xlsform_editor_payload_to_df(workbook$settings, "settings")
        )
        sm <- .sm_logic_context_from_xlsform(xlsform)
        if (is.null(paginas) || !length(paginas)) {
          paginas <- .xlsform_editor_sm_pages_from_survey(xlsform$survey)
        }
      }

      tryCatch(
        surveymonkey_interpretar_regla(regla, details = details,
          xlsform = xlsform, sm = sm,
          paginas = paginas, paginas_labels = paginas_labels,
          choice_order_overrides = choice_order_overrides),
        error = function(e) list(ok = FALSE, error = conditionMessage(e))
      )
    })) |>
    plumber::pr_post("/api/xlsform-editor/sm-apply-logic", wrap_endpoint(function(req, res, ...) {
      parsed <- .xlsform_editor_parse_body(req)
      workbook <- parsed$workbook %||% list()
      reglas_text <- as.character(parsed$reglas %||% "")
      paginas_in <- parsed$paginas
      overrides_in <- parsed$choice_order_overrides
      source_name <- as.character(parsed$source_name %||% "XLSForm actual")

      survey <- .xlsform_editor_payload_to_df(workbook$survey, "survey")
      choices <- .xlsform_editor_payload_to_df(workbook$choices, "choices")
      settings <- .xlsform_editor_payload_to_df(workbook$settings, "settings")
      xlsform <- list(survey = survey, choices = choices, settings = settings)
      sm <- .sm_logic_context_from_xlsform(xlsform)

      paginas <- NULL
      if (!is.null(paginas_in) && length(paginas_in)) {
        paginas <- lapply(paginas_in, function(qs) as.character(unlist(qs)))
        names(paginas) <- as.character(names(paginas_in))
      }
      if (is.null(paginas) || !length(paginas)) {
        paginas <- .xlsform_editor_sm_pages_from_survey(survey)
      }

      choice_order_overrides <- NULL
      if (!is.null(overrides_in) && length(overrides_in)) {
        choice_order_overrides <- lapply(overrides_in, function(lbls) as.character(unlist(lbls)))
        names(choice_order_overrides) <- as.character(names(overrides_in))
      }

      if (nzchar(trimws(reglas_text))) {
        xlsform <- tryCatch(
          surveymonkey_aplicar_logica(xlsform, reglas_text, sm, paginas = paginas,
            choice_order_overrides = choice_order_overrides),
          error = function(e) stop_api(400, "E_LOGIC_APPLY_FAILED",
            sprintf("Aplicación de lógica falló: %s", conditionMessage(e)))
        )
      }

      .xlsform_editor_workbook_payload(
        sheets = list(
          survey = xlsform$survey,
          choices = xlsform$choices,
          settings = xlsform$settings,
          paper = .xlsform_editor_empty_df(.xlsform_editor_default_columns("paper"))
        ),
        source_kind = "surveymonkey",
        source_name = source_name
      )
    })) |>
    plumber::pr_post("/api/xlsform-editor/import-surveymonkey-with-logic", wrap_endpoint(function(req, res, ...) {
      # Import SurveyMonkey API-only: el .sav puede venir como contexto legacy
      # del frontend, pero no define estructura del XLSForm. La API es fuente
      # de verdad para tipos, etiquetas, secciones, opciones y lógica.
      parsed <- .xlsform_editor_parse_body(req)
      lang <- as.character(parsed$lang %||% "es")
      reglas_text <- as.character(parsed$reglas %||% "")
      paginas_in <- parsed$paginas
      paginas_labels_in <- parsed$paginas_labels
      overrides_in <- parsed$choice_order_overrides
      survey_id <- as.character(parsed$survey_id %||% "")
      token <- as.character(parsed$token %||% "")

      if (!nzchar(survey_id) || !nzchar(token)) {
        stop_api(400, "E_MISSING_SURVEYMONKEY_API", "Falta conectar SurveyMonkey con survey_id y token.")
      }

      # paginas_in viene como JSON: { "16": ["Q24"], "17": ["Q25", ...] }
      paginas <- NULL
      if (!is.null(paginas_in) && length(paginas_in)) {
        paginas <- lapply(paginas_in, function(qs) as.character(unlist(qs)))
        names(paginas) <- as.character(names(paginas_in))
      }
      paginas_labels <- NULL
      if (!is.null(paginas_labels_in) && length(paginas_labels_in)) {
        paginas_labels <- vapply(paginas_labels_in, as.character, character(1))
      }
      # Mapeo opcional `{ "27": ["LabelA", "LabelB", ...] }` para reordenar
      # las choices de una pregunta cuando el usuario detectó que la API
      # no las trajo en el orden visual del constructor.
      choice_order_overrides <- NULL
      if (!is.null(overrides_in) && length(overrides_in)) {
        choice_order_overrides <- lapply(overrides_in, function(lbls) as.character(unlist(lbls)))
        names(choice_order_overrides) <- as.character(names(overrides_in))
      }

      details <- tryCatch(
        sm_api_fetch_survey_details(survey_id, token),
        error = function(e) stop_api(400, "E_SM_API_FAILED", conditionMessage(e))
      )
      out <- tryCatch(
        sm_api_xlsform(details, style = .sm_api_default_style(), lang = lang),
        error = function(e) stop_api(500, "E_SM_API_TRANSLATE_FAILED",
          sprintf("Traducción desde API SurveyMonkey falló: %s", conditionMessage(e)))
      )
      source_name <- .sm_first_nonempty(.sm_or(details$title, NA_character_), fallback = "SurveyMonkey API")
      sm <- out$sm_logic

      # Aplicar reglas si vinieron
      hallazgos <- list()
      if (nzchar(trimws(reglas_text))) {
        out <- tryCatch(
          surveymonkey_aplicar_logica(out, reglas_text, sm, paginas = paginas,
            choice_order_overrides = choice_order_overrides),
          error = function(e) stop_api(400, "E_LOGIC_APPLY_FAILED",
            sprintf("Aplicación de lógica falló: %s", conditionMessage(e)))
        )
      }

      payload <- .xlsform_editor_workbook_payload(
        sheets = list(
          survey = out$survey,
          choices = out$choices,
          settings = out$settings,
          paper = .xlsform_editor_empty_df(.xlsform_editor_default_columns("paper")),
          diagnostico = out$diagnostico
        ),
        source_kind = "surveymonkey",
        source_name = source_name
      )
      payload$hallazgos <- hallazgos
      payload
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
      paper <- if (!is.null(workbook$paper)) {
        .xlsform_editor_payload_to_df(workbook$paper, "paper")
      } else NULL
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

      if (!is.null(paper) && (ncol(paper) > 0L || nrow(paper) > 0L)) {
        openxlsx::addWorksheet(wb, "paper")
        openxlsx::writeData(wb, "paper", paper)
        openxlsx::freezePane(wb, "paper", firstActiveRow = 2)
        if (ncol(paper)) openxlsx::setColWidths(wb, "paper", cols = seq_len(ncol(paper)), widths = "auto")
      }

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
    plumber::pr_post("/api/xlsform-editor/export-pdf", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }

      parsed <- .xlsform_editor_parse_body(req)
      workbook <- parsed$workbook %||% list()
      filename <- as.character(parsed$filename %||% "formulario_impreso.pdf")
      if (!grepl("\\.pdf$", filename, ignore.case = TRUE)) {
        filename <- paste0(filename, ".pdf")
      }

      survey <- .xlsform_editor_payload_to_df(workbook$survey, "survey")
      choices <- .xlsform_editor_payload_to_df(workbook$choices, "choices")
      settings <- .xlsform_editor_payload_to_df(workbook$settings, "settings")
      paper <- if (!is.null(workbook$paper)) {
        .xlsform_editor_payload_to_df(workbook$paper, "paper")
      } else {
        .xlsform_editor_empty_df(.xlsform_editor_default_columns("paper"))
      }
      options <- parsed$options %||% list()
      if (!nzchar(as.character(options$title %||% ""))) {
        fallback_title <- tools::file_path_sans_ext(basename(filename))
        fallback_title <- gsub("(_papel|_editado)$", "", fallback_title, ignore.case = TRUE)
        fallback_title <- gsub("[_-]+", " ", fallback_title)
        options$title <- fallback_title
      }
      if (!nzchar(as.character(options$footer_title %||% ""))) {
        options$footer_title <- options$title
      }

      s <- session_get(sid)
      out_path <- file.path(s$dir, "downloads", paste0(uuid::UUIDgenerate(), ".pdf"))
      result <- tryCatch(
        reporte_formulario_pdf(
          survey = survey,
          choices = choices,
          settings = settings,
          paper = paper,
          output_file = out_path,
          options = options
        ),
        error = function(e) {
          stop_api(500, "E_PDF_EXPORT_FAILED",
                   sprintf("No pude generar el PDF del formulario: %s", conditionMessage(e)))
        }
      )
      meta <- .register_output_file(sid, "formulario_pdf", out_path, original_name = filename)

      list(
        ok = TRUE,
        file_id = meta$file_id,
        original_name = meta$original_name,
        size = meta$size,
        summary = result$summary,
        warnings = result$warnings %||% character(0)
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
