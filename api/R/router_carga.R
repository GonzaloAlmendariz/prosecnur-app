estructura_instrumento <- function(inst) {
  sm <- inst$meta$section_map
  has_value <- function(x) !is.na(x) & nzchar(trimws(as.character(x)))
  field <- function(df, col, i, fallback = NA_character_) {
    if (is.null(df) || !(col %in% names(df))) return(fallback)
    val <- df[[col]][i]
    if (length(val) == 0L || is.na(val)) fallback else as.character(val)
  }
  first_col <- function(df, candidates) {
    hit <- candidates[candidates %in% names(df)][1]
    hit %||% NA_character_
  }

  secciones <- if (is.null(sm) || nrow(sm) == 0) list() else {
    out <- vector("list", nrow(sm))
    for (i in seq_len(nrow(sm))) {
      out[[i]] <- list(
        name = as.character(sm$group_name[i]),
        label = as.character(sm$group_label[i] %||% sm$group_name[i]),
        is_repeat = isTRUE(sm$is_repeat[i]),
        is_conditional = isTRUE(sm$is_conditional[i]),
        relevant = if (is.na(sm$group_relevant[i])) NA else as.character(sm$group_relevant[i]),
        prefix = as.character(sm$prefix[i] %||% "")
      )
    }
    out
  }

  survey <- inst$survey
  choices <- inst$choices %||% data.frame()
  skip_types <- c("begin_group", "end_group", "begin_repeat", "end_repeat",
                  "start", "end", "today", "deviceid", "note")
  choice_label_col <- first_col(choices, c("label", "label::es", "label::Spanish (ES)", "label_spanish_es"))
  choice_items_for <- function(list_name) {
    if (is.null(choices) || !nrow(choices) || is.na(list_name) || !nzchar(list_name) ||
        !"list_name" %in% names(choices) || !"name" %in% names(choices)) {
      return(list())
    }
    rows <- choices[as.character(choices$list_name) == as.character(list_name), , drop = FALSE]
    if (!nrow(rows)) return(list())
    lapply(seq_len(nrow(rows)), function(j) {
      label <- if (!is.na(choice_label_col)) field(rows, choice_label_col, j, field(rows, "name", j, ""))
               else field(rows, "name", j, "")
      list(
        name = field(rows, "name", j, ""),
        label = label
      )
    })
  }

  preguntas <- list()
  if (!is.null(survey) && nrow(survey) > 0) {
    for (i in seq_len(nrow(survey))) {
      tb <- as.character(survey$type_base[i] %||% "")
      tt <- as.character(survey$type[i] %||% "")
      if (tb %in% skip_types || tt %in% skip_types) next
      if (!nzchar(as.character(survey$name[i] %||% ""))) next
      list_name <- field(survey, "list_name", i, "")
      if (!nzchar(list_name) && grepl("^select_(one|multiple)\\b", tt)) {
        m <- regmatches(tt, regexec("^select_(?:one|multiple)\\s+(\\S+)", tt, perl = TRUE))[[1]]
        list_name <- if (length(m) >= 2L) m[2] else ""
      }
      relevant_expr <- field(survey, "relevant", i, "")
      constraint_expr <- field(survey, "constraint", i, "")
      calculation_expr <- field(survey, "calculation", i, "")
      choice_filter_expr <- field(survey, "choice_filter", i, "")
      required_expr <- field(survey, "required", i, "")
      preguntas[[length(preguntas) + 1]] <- list(
        row_index = as.integer(i),
        name = field(survey, "name", i, ""),
        label = field(survey, "label", i, field(survey, "name", i, "")),
        hint = field(survey, "hint", i, ""),
        appearance = field(survey, "appearance", i, ""),
        tipo = tb,
        type_raw = tt,
        list_name = list_name,
        seccion = as.character(survey$group_name[i] %||% ""),
        required = has_value(required_expr) && tolower(trimws(as.character(required_expr))) %in%
          c("true", "true()", "yes", "si", "s"),
        relevant = has_value(relevant_expr),
        constraint = has_value(constraint_expr),
        calculate = identical(tb, "calculate") || identical(tt, "calculate") || has_value(calculation_expr),
        choice_filter = has_value(choice_filter_expr),
        relevant_expr = relevant_expr,
        constraint_expr = constraint_expr,
        calculation_expr = calculation_expr,
        choice_filter_expr = choice_filter_expr,
        choices = choice_items_for(list_name)
      )
    }
  }

  list(secciones = secciones, preguntas = preguntas)
}

summarize_instrumento <- function(inst) {
  survey <- inst$survey
  choices <- inst$choices
  type_raw <- if (!is.null(survey) && "type" %in% names(survey)) {
    trimws(as.character(survey$type %||% ""))
  } else character(0)
  type_base <- if (!is.null(survey) && "type_base" %in% names(survey)) {
    trimws(as.character(survey$type_base %||% type_raw))
  } else {
    sub("\\s+.*$", "", type_raw)
  }
  names_raw <- if (!is.null(survey) && "name" %in% names(survey)) {
    as.character(survey$name %||% character())
  } else character(0)
  has_name <- nzchar(names_raw)
  section_types <- c("begin_group", "begin_repeat")
  structural_types <- c("begin_group", "end_group", "begin_repeat", "end_repeat")
  non_question_types <- c(structural_types, "start", "end", "today", "deviceid", "note", "calculate")
  is_calculate <- has_name & (type_base == "calculate" | type_raw == "calculate")
  is_note <- has_name & (type_base == "note" | type_raw == "note")
  is_question <- has_name & !(type_base %in% non_question_types) & !(type_raw %in% non_question_types)
  secciones <- if (!is.null(survey) && "name" %in% names(survey)) {
    begins <- survey[type_base %in% section_types, , drop = FALSE]
    if (nrow(begins) > 0) as.character(begins$name) else character()
  } else character()
  list(
    n_preguntas = as.integer(sum(is_question, na.rm = TRUE)),
    n_calculos = as.integer(sum(is_calculate, na.rm = TRUE)),
    n_notas = as.integer(sum(is_note, na.rm = TRUE)),
    n_filas_survey = if (!is.null(survey)) as.integer(nrow(survey)) else 0L,
    n_secciones = length(secciones),
    secciones = secciones,
    n_listas_opciones = if (!is.null(choices)) length(unique(choices$list_name %||% character())) else 0L,
    meta = inst$meta %||% list()
  )
}

.carga_data_survey_names <- function(instrumento) {
  survey <- instrumento$survey
  if (is.null(survey) || !nrow(survey) || !all(c("type", "name") %in% names(survey))) {
    return(character(0))
  }
  skip_types <- c(
    "begin_group", "end_group", "begin_repeat", "end_repeat",
    "note", "start", "end", "today", "deviceid",
    "subscriberid", "phonenumber", "simserial", "username", "audit"
  )
  type_raw <- trimws(as.character(survey$type %||% ""))
  type_base <- if ("type_base" %in% names(survey)) {
    trimws(as.character(survey$type_base %||% type_raw))
  } else {
    sub("\\s+.*$", "", type_raw)
  }
  names_raw <- as.character(survey$name %||% character())
  keep <- nzchar(names_raw) & !(type_base %in% skip_types) & !(type_raw %in% skip_types)
  unique(names_raw[keep])
}

.carga_reorder_data_columns <- function(df, instrumento) {
  survey_names <- .carga_data_survey_names(instrumento)
  first <- intersect(survey_names, names(df))
  if (!length(first)) return(df)
  df[, c(first, setdiff(names(df), first)), drop = FALSE]
}

.carga_compatibility_payload <- function(df, instrumento) {
  if (is.null(instrumento) || is.null(instrumento$survey)) {
    return(list(
      applied = FALSE,
      ok = NA,
      status = "sin_instrumento",
      missing_columns = character(0),
      extra_columns = character(0),
      matched_columns = 0L,
      message = "Carga una data y un XLSForm para validar compatibilidad."
    ))
  }
  compat <- validate_data_xlsform_compatibility(df, instrumento)
  compat <- unclass(compat)
  compat$applied <- TRUE
  compat
}

.carga_choice_code_maps_payload <- function(norm_attr) {
  maps_raw <- norm_attr$choice_code_maps %||% list()
  if (!length(maps_raw)) {
    return(list(
      applied = FALSE,
      requires_confirmation = FALSE,
      n_questions = 0L,
      maps = list()
    ))
  }

  maps <- lapply(maps_raw, function(mp) {
    mappings <- mp$mappings %||% list()
    mappings <- lapply(mappings, function(item) {
      list(
        source_code = as.character(item$source_code %||% ""),
        source_column = as.character(item$source_column %||% ""),
        source_label = as.character(item$source_label %||% ""),
        xls_code = as.character(item$xls_code %||% ""),
        xls_label = as.character(item$xls_label %||% ""),
        match = as.character(item$match %||% "")
      )
    })
    list(
      variable = as.character(mp$variable %||% ""),
      label = as.character(mp$label %||% mp$variable %||% ""),
      type = as.character(mp$type %||% ""),
      list_name = as.character(mp$list_name %||% ""),
      status = as.character(mp$status %||% "match_review"),
      high_confidence = isTRUE(mp$high_confidence),
      requires_confirmation = isTRUE(mp$requires_confirmation),
      mappings = unname(mappings)
    )
  })

  list(
    applied = TRUE,
    requires_confirmation = any(vapply(maps, function(mp) isTRUE(mp$requires_confirmation), logical(1))),
    n_questions = as.integer(length(maps)),
    maps = unname(maps)
  )
}

.carga_store_choice_code_maps <- function(sid, maps_payload, confirmed = FALSE) {
  if (is.null(sid) || !nzchar(sid)) return(invisible(FALSE))
  if (is.null(maps_payload) || !isTRUE(maps_payload$applied) || !length(maps_payload$maps %||% list())) {
    session_set(sid, "choice_code_maps_pending", NULL)
    if (isTRUE(confirmed)) {
      session_set(sid, "choice_code_maps_confirmed", NULL)
    }
    return(invisible(FALSE))
  }

  payload <- list(
    confirmed = isTRUE(confirmed),
    confirmed_at = if (isTRUE(confirmed)) format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC") else NA_character_,
    n_questions = as.integer(maps_payload$n_questions %||% length(maps_payload$maps)),
    maps = maps_payload$maps
  )

  if (isTRUE(confirmed)) {
    session_set(sid, "choice_code_maps_confirmed", payload)
    session_set(sid, "choice_code_maps_pending", NULL)
  } else {
    session_set(sid, "choice_code_maps_pending", payload)
  }
  invisible(TRUE)
}

.carga_assert_data_xlsform_compatible <- function(df, instrumento) {
  compat <- validate_data_xlsform_compatibility(df, instrumento)
  if (!isTRUE(compat$ok)) {
    sample_missing <- utils::head(compat$missing_columns, 20L)
    suffix <- if (length(sample_missing)) {
      paste0(" Faltantes: ", paste(sample_missing, collapse = ", "),
             if (length(compat$missing_columns) > length(sample_missing)) ", ..." else "")
    } else {
      ""
    }
    stop_api(
      400,
      "E_DATA_XLSFORM_INCOMPATIBLE",
      paste0(compat$message, suffix)
    )
  }
  compat
}

read_data_preview <- function(path, ext, n_preview = 100L, instrumento = NULL, choice_code_maps = NULL) {
  # Envolvemos el read_excel en suppressWarnings porque readxl infiere
  # tipo por las primeras 1000 filas; cuando una columna tiene muchos
  # NA al comienzo y texto más abajo (caso típico en encuestas con
  # preguntas condicionales) imprime "Expecting logical in ..." ruidoso.
  # readxl igual devuelve NAs en las celdas que no puede convertir, así
  # que no perdemos datos, solo silencio.
  df <- switch(
    ext,
    xlsx = suppressWarnings(readxl::read_excel(path)),
    xls  = suppressWarnings(readxl::read_excel(path)),
    csv  = utils::read.csv(path, stringsAsFactors = FALSE),
    sav  = haven::read_sav(path),
    stop_api(400, "E_UNSUPPORTED_EXT", sprintf("Unsupported data extension: %s", ext))
  )
  normalized_info <- NULL
  compatibility_info <- .carga_compatibility_payload(df, NULL)
  if (!is.null(instrumento)) {
    df <- normalize_data_for_xlsform(df, instrumento, choice_code_maps = choice_code_maps)
    norm_attr <- attr(df, "xlsform_normalized")
    df <- .carga_reorder_data_columns(df, instrumento)
    compatibility_info <- .carga_compatibility_payload(df, instrumento)
    if (!is.null(norm_attr)) {
      survey_cols <- intersect(.carga_data_survey_names(instrumento), names(df))
      normalized_info <- list(
        applied = TRUE,
        aliases = as.integer(length(norm_attr$aliases %||% character(0))),
        select_multiple = as.integer(length(norm_attr$select_multiple %||% list())),
        single_child_collapses = as.integer(length(norm_attr$single_child_collapses %||% character(0))),
        dropped_columns = as.integer(length(norm_attr$dropped_columns %||% character(0))),
        xlsform_columns = as.integer(length(survey_cols)),
        extra_columns = as.integer(ncol(df) - length(survey_cols)),
        alias_columns = norm_attr$aliases %||% character(0),
        select_multiple_columns = norm_attr$select_multiple %||% list(),
        single_child_collapse_columns = norm_attr$single_child_collapses %||% character(0),
        choice_code_maps = .carga_choice_code_maps_payload(norm_attr)
      )
    }
  }
  if (is.null(normalized_info)) {
    normalized_info <- list(
      applied = FALSE,
      aliases = 0L,
      select_multiple = 0L,
      single_child_collapses = 0L,
      dropped_columns = 0L,
      xlsform_columns = 0L,
      extra_columns = 0L,
      choice_code_maps = .carga_choice_code_maps_payload(list())
    )
  }
  n <- nrow(df)
  head_df <- utils::head(df, n_preview)
  # Los .sav de SurveyMonkey llegan como haven_labelled. jsonlite puede
  # recursar sobre esos atributos y fallar con "C stack usage". La preview
  # solo necesita una muestra legible; los datos completos se guardan sin
  # tocar para reporte_data/validación.
  head_df <- as.data.frame(lapply(head_df, function(col) {
    if (inherits(col, "haven_labelled") || inherits(col, "labelled")) {
      return(as.character(haven::as_factor(col, levels = "default")))
    }
    if (inherits(col, c("POSIXct", "POSIXlt", "Date"))) {
      return(as.character(col))
    }
    col
  }), stringsAsFactors = FALSE, check.names = FALSE)
  survey_names <- .carga_data_survey_names(instrumento)
  list(
    n_filas = as.integer(n),
    n_columnas = ncol(df),
    columnas = lapply(names(df), function(col) {
      list(
        nombre = col,
        tipo = paste(class(df[[col]]), collapse = "/"),
        origen = if (col %in% survey_names) "xlsform" else "extra"
      )
    }),
    normalizacion = normalized_info,
    compatibilidad = compatibility_info,
    preview_filas = jsonlite::toJSON(head_df, na = "null", dataframe = "rows", auto_unbox = TRUE) |>
      jsonlite::fromJSON(simplifyVector = FALSE)
  )
}

.carga_editor_choice_code_maps <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(NULL)
  maps <- s$xlsform_state$workbook$surveyMonkeyLogic$choice_code_maps %||%
    s$xlsform_state$workbook$surveyMonkeyLogic$choiceCodeMaps %||%
    NULL
  if (!is.null(maps) && length(maps)) return(maps)
  confirmed <- s$choice_code_maps_confirmed %||% NULL
  if (isTRUE(confirmed$confirmed) && length(confirmed$maps %||% list())) {
    return(confirmed$maps)
  }
  NULL
}

.carga_current_instrumento_for_data <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(NULL)
  inst <- s$instrumento
  if (!is.null(inst) && !is.null(inst$survey)) return(inst)
  files <- s$files %||% list()
  xls_metas <- Filter(function(f) identical(f$kind, "xlsform"), files)
  if (!length(xls_metas)) return(NULL)
  meta <- xls_metas[[length(xls_metas)]]
  tryCatch(reporte_instrumento(path = meta$path), error = function(e) NULL)
}

.carga_single_sav_from_zip <- function(zip_path) {
  if (!requireNamespace("zip", quietly = TRUE)) {
    stop_api(500, "E_NO_ZIP", "El paquete R 'zip' no está disponible para leer ZIP con .sav.")
  }
  info <- tryCatch(
    zip::zip_list(zip_path),
    error = function(e) stop_api(400, "E_CARGA_SAV_ZIP_BAD", paste("No se pudo leer el ZIP:", conditionMessage(e)))
  )
  if (!nrow(info) || !"filename" %in% names(info)) {
    stop_api(400, "E_CARGA_SAV_ZIP_EMPTY", "El ZIP no contiene archivos .sav.")
  }
  entries <- info[grepl("\\.sav$", as.character(info$filename), ignore.case = TRUE, useBytes = TRUE), , drop = FALSE]
  if (!nrow(entries)) {
    stop_api(400, "E_CARGA_SAV_ZIP_EMPTY", "El ZIP no contiene archivos .sav.")
  }
  if (nrow(entries) > 1L) {
    stop_api(
      400,
      "E_CARGA_SAV_ZIP_MULTI",
      "Este flujo unicarga espera un ZIP con un solo .sav. Para varios .sav usa el flujo multibase."
    )
  }
  entry_name <- as.character(entries$filename[1])
  con <- NULL
  tryCatch({
    con <- unz(zip_path, entry_name, open = "rb")
    raw <- readBin(con, what = "raw", n = 1024L * 1024L * 1024L)
    list(filename = basename(entry_name), raw = raw)
  }, error = function(e) {
    stop_api(400, "E_CARGA_SAV_ZIP_EXTRACT_FAILED", sprintf(
      "No se pudo extraer '%s' del ZIP: %s",
      entry_name,
      conditionMessage(e)
    ))
  }, finally = {
    if (!is.null(con)) try(close(con), silent = TRUE)
  })
}

.carga_resolve_data_upload_meta <- function(sid, meta) {
  if (!identical(meta$kind, "sav_bundle")) return(meta)
  extracted <- .carga_single_sav_from_zip(meta$path)
  original_name <- extracted$filename
  if (!nzchar(original_name) || !grepl("\\.sav$", original_name, ignore.case = TRUE)) {
    original_name <- paste0(tools::file_path_sans_ext(meta$original_name %||% "base"), ".sav")
  }
  save_upload(sid, "sav", original_name, extracted$raw)
}

# Auto-init de la base "default" del estudio cuando el flujo single-base
# (Carga manual sin pasar por demo) sube un instrumento + data. Las features
# v2 (Validación, Codificación, Analítica multi-base) requieren que exista
# al menos una entrada en s$estudio$bases, sino disparan
# E_NO_DATA_INST / "no tiene XLSForm cargado".
#
# Idempotente: si la base "default" ya existe se reemplazan los archivos
# vía estudio_replace_base_files. Si falta xlsform o data en s$files,
# es no-op (esperar a que ambos estén listos).
.read_data_any_path <- function(path, ext) {
  ext <- tolower(ext %||% tools::file_ext(path))
  if (ext %in% c("xlsx", "xls")) return(suppressWarnings(readxl::read_excel(path)))
  if (ext == "csv") return(utils::read.csv(path, stringsAsFactors = FALSE, fileEncoding = "UTF-8"))
  if (ext == "sav") {
    if (!requireNamespace("haven", quietly = TRUE)) {
      stop_api(500, "E_NO_HAVEN", "haven no está disponible para leer .sav")
    }
    return(haven::read_sav(path))
  }
  stop_api(400, "E_UNSUPPORTED_EXT", sprintf("Extensión no soportada: %s", ext))
}

estudio_init_default_base <- function(sid) {
  s <- session_get(sid)

  # Detectar el último xlsform y data subidos.
  files <- s$files %||% list()
  xls_metas <- Filter(function(f) identical(f$kind, "xlsform"), files)
  dat_metas <- Filter(function(f) f$kind %in% c("data", "sav"), files)
  if (length(xls_metas) == 0L || length(dat_metas) == 0L) {
    return(invisible(FALSE))
  }
  # Última subida de cada tipo (orden de inserción del files store).
  xls_meta <- xls_metas[[length(xls_metas)]]
  dat_meta <- dat_metas[[length(dat_metas)]]

  # Computar reportes (caros: parsea xlsform + lee data completa).
  rp_inst <- reporte_instrumento(path = xls_meta$path)
  data_df <- .read_data_any_path(dat_meta$path, dat_meta$ext)
  data_df <- normalize_data_for_xlsform(
    data_df,
    rp_inst,
    choice_code_maps = .carga_editor_choice_code_maps(sid)
  )
  norm_attr <- attr(data_df, "xlsform_normalized")
  maps_payload <- .carga_choice_code_maps_payload(norm_attr %||% list())
  s_current <- session_get(sid, required = FALSE)
  if (isTRUE(maps_payload$applied) &&
      !isTRUE(s_current$choice_code_maps_confirmed$confirmed %||% FALSE)) {
    .carga_store_choice_code_maps(sid, maps_payload, confirmed = FALSE)
  }
  .carga_assert_data_xlsform_compatible(data_df, rp_inst)
  rp_data <- reporte_data(data_df, instrumento = rp_inst)

  estudio_ensure(sid)
  s2 <- session_get(sid)
  if (is.null(s2$estudio$bases$default)) {
    estudio_add_base(
      sid,
      nombre          = "default",
      xlsform_file_id = xls_meta$file_id,
      data_file_id    = dat_meta$file_id,
      data_ext        = as.character(dat_meta$ext),
      rp_data         = rp_data,
      rp_inst         = rp_inst,
      n_filas         = as.integer(nrow(data_df)),
      n_columnas      = as.integer(ncol(data_df))
    )
  } else {
    estudio_replace_base_files(
      sid,
      nombre          = "default",
      xlsform_file_id = xls_meta$file_id,
      data_file_id    = dat_meta$file_id,
      data_ext        = as.character(dat_meta$ext),
      rp_data         = rp_data,
      rp_inst         = rp_inst,
      n_filas         = as.integer(nrow(data_df)),
      n_columnas      = as.integer(ncol(data_df))
    )
  }
  invisible(TRUE)
}

.carga_resolve_export_files <- function(sid, base_nombre = NULL) {
  s <- session_get(sid)
  resolved <- tryCatch(.resolve_base_nombre(s, base_nombre), error = function(e) {
    stop_api(404, "E_BASE_NOT_FOUND", conditionMessage(e))
  })
  if (!is.null(resolved) && nzchar(resolved)) {
    base <- s$estudio$bases[[resolved]]
    return(list(
      base_nombre = resolved,
      xlsform = get_file(sid, base$xlsform_file_id),
      data = get_file(sid, base$data_file_id),
      data_ext = as.character(base$data_ext %||% "")
    ))
  }

  files <- s$files %||% list()
  xls_metas <- Filter(function(f) identical(f$kind, "xlsform"), files)
  dat_metas <- Filter(function(f) f$kind %in% c("data", "sav"), files)
  if (!length(xls_metas)) stop_api(409, "E_NO_XLSFORM", "No hay XLSForm cargado.")
  if (!length(dat_metas)) stop_api(409, "E_NO_DATA", "No hay base de datos cargada.")
  dat_meta <- dat_metas[[length(dat_metas)]]
  list(
    base_nombre = NULL,
    xlsform = xls_metas[[length(xls_metas)]],
    data = dat_meta,
    data_ext = as.character(dat_meta$ext %||% "")
  )
}

.carga_normalized_data_for_export <- function(sid, base_nombre = NULL) {
  files <- .carga_resolve_export_files(sid, base_nombre)
  inst <- reporte_instrumento(path = files$xlsform$path)
  df <- .read_data_any_path(files$data$path, files$data_ext %||% files$data$ext)
  df <- normalize_data_for_xlsform(
    df,
    inst,
    choice_code_maps = .carga_editor_choice_code_maps(sid)
  )
  df <- .carga_reorder_data_columns(df, inst)
  list(data = df, instrumento = inst, base_nombre = files$base_nombre)
}

.carga_export_normalized_data <- function(sid, base_nombre = NULL, format = "xlsx") {
  format <- tolower(as.character(format %||% "xlsx")[1])
  if (!(format %in% c("xlsx", "csv", "sav"))) {
    stop_api(400, "E_FORMATO_EXPORT", "Formato soportado: xlsx, csv o sav.")
  }
  payload <- .carga_normalized_data_for_export(sid, base_nombre)
  s <- session_get(sid)
  downloads_dir <- file.path(s$dir, "downloads")
  dir.create(downloads_dir, showWarnings = FALSE, recursive = TRUE)

  base <- payload$base_nombre %||% base_nombre
  out_name <- .export_filename(sid, "data_normalizada", format, base = base)
  out_path <- file.path(downloads_dir, sprintf("%s_%s", uuid::UUIDgenerate(), out_name))

  if (identical(format, "xlsx")) {
    .bases_write_xlsx(payload$data, payload$data, out_path, valores = "codigos")
  } else if (identical(format, "csv")) {
    .bases_write_csv(payload$data, out_path, separador = ",")
  } else {
    .bases_export_sav(payload$data, payload$instrumento, out_path)
  }

  .register_output_file(sid, "data_normalizada", out_path, original_name = out_name)
}

.carga_parse_json_body <- function(req) {
  body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "{}")
  Encoding(body_raw) <- "UTF-8"
  if (!nzchar(trimws(body_raw))) body_raw <- "{}"
  tryCatch(
    jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
  )
}

.carga_slug <- function(x, fallback = "fuente") {
  value <- trimws(as.character(x %||% "")[1])
  if (!nzchar(value)) value <- fallback
  value <- iconv(value, to = "ASCII//TRANSLIT", sub = "")
  value <- tolower(value)
  value <- gsub("[^a-z0-9]+", "_", value)
  value <- gsub("^_+|_+$", "", value)
  if (!nzchar(value)) fallback else substr(value, 1L, 72L)
}

.carga_write_xlsx_sheet <- function(df, path, sheet = "datos") {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop_api(500, "E_NO_OPENXLSX", "openxlsx no está disponible para escribir Excel.")
  }
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, sheet)
  openxlsx::writeData(wb, sheet, df, withFilter = ncol(df) > 0L && nrow(df) > 0L)
  openxlsx::freezePane(wb, sheet, firstRow = TRUE)
  if (ncol(df)) openxlsx::setColWidths(wb, sheet, cols = seq_len(ncol(df)), widths = "auto")
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
}

.carga_write_xlsform_model <- function(model, path) {
  if (exists(".sm_mb_write_xlsform_model", mode = "function")) {
    return(.sm_mb_write_xlsform_model(model, path))
  }
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop_api(500, "E_NO_OPENXLSX", "openxlsx no está disponible para escribir XLSForm.")
  }
  wb <- openxlsx::createWorkbook()
  for (sheet in c("survey", "choices", "settings")) {
    df <- model[[sheet]]
    if (is.null(df)) df <- data.frame()
    openxlsx::addWorksheet(wb, sheet)
    openxlsx::writeData(wb, sheet, df)
    openxlsx::freezePane(wb, sheet, firstRow = TRUE)
    if (ncol(df)) openxlsx::setColWidths(wb, sheet, cols = seq_len(ncol(df)), widths = "auto")
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
}

.carga_empty_data_for_instrument <- function(instrumento) {
  cols <- .carga_data_survey_names(instrumento)
  if (!length(cols)) return(data.frame())
  stats::setNames(
    as.data.frame(rep(list(character()), length(cols)), stringsAsFactors = FALSE, check.names = FALSE),
    cols
  )
}

.carga_scalar_cell <- function(value) {
  if (is.null(value) || !length(value)) return(NA_character_)
  if (is.atomic(value)) {
    out <- as.character(value)
    out <- out[!is.na(out) & nzchar(out)]
    if (!length(out)) return(NA_character_)
    return(paste(out, collapse = " "))
  }
  if (is.list(value)) {
    atomic_items <- unlist(value, recursive = FALSE, use.names = FALSE)
    if (length(atomic_items) && !any(vapply(atomic_items, is.list, logical(1)))) {
      out <- as.character(atomic_items)
      out <- out[!is.na(out) & nzchar(out)]
      if (length(out)) return(paste(out, collapse = " "))
    }
    return(as.character(jsonlite::toJSON(value, auto_unbox = TRUE, null = "null")))
  }
  as.character(value)
}

.carga_kobo_rows_df <- function(rows) {
  if (is.null(rows) || !length(rows)) return(data.frame())
  cols <- unique(unlist(lapply(rows, names), use.names = FALSE))
  cols <- cols[!is.na(cols) & nzchar(cols)]
  if (!length(cols)) return(data.frame())
  out <- as.data.frame(
    stats::setNames(rep(list(rep(NA_character_, length(rows))), length(cols)), cols),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  for (i in seq_along(rows)) {
    row <- rows[[i]]
    if (!is.list(row)) next
    for (nm in intersect(names(row), cols)) {
      out[[nm]][[i]] <- .carga_scalar_cell(row[[nm]])
    }
  }
  out
}

.carga_kobo_xlsform_model <- function(detail) {
  content <- detail$content %||% list()
  survey <- .carga_kobo_rows_df(content$survey %||% list())
  choices <- .carga_kobo_rows_df(content$choices %||% list())
  settings <- .carga_kobo_rows_df(content$settings %||% list())
  if (!nrow(settings)) {
    title <- as.character(detail$name %||% detail$settings$name %||% "KoboToolbox")
    settings <- data.frame(
      form_title = title,
      form_id = .carga_slug(title, "kobo_form"),
      version = format(Sys.Date(), "%Y%m%d"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  }
  if (nrow(survey) && all(c("type", "select_from_list_name") %in% names(survey))) {
    type <- trimws(as.character(survey$type %||% ""))
    list_name <- trimws(as.character(survey$select_from_list_name %||% ""))
    needs_list <- type %in% c("select_one", "select_multiple") & nzchar(list_name)
    survey$type[needs_list] <- paste(type[needs_list], list_name[needs_list])
  }
  list(survey = survey, choices = choices, settings = settings)
}

.carga_align_kobo_data <- function(df, rp_inst) {
  df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  for (nm in names(df)) {
    if (is.list(df[[nm]]) && !is.data.frame(df[[nm]])) {
      df[[nm]] <- vapply(df[[nm]], .carga_scalar_cell, character(1))
    }
  }
  expected <- .carga_data_survey_names(rp_inst)
  if (!length(expected) || !ncol(df)) return(df)
  leaf <- function(x) {
    out <- gsub("^.*[./]", "", as.character(x))
    tolower(out)
  }
  leaf_names <- leaf(names(df))
  for (var in expected) {
    if (var %in% names(df)) next
    hit <- which(leaf_names == tolower(var))
    if (length(hit) == 1L) df[[var]] <- df[[hit]]
  }
  df
}

.carga_chr1 <- function(x, default = "") {
  if (is.null(x) || !length(x)) return(default)
  out <- as.character(x[[1]] %||% default)
  if (is.na(out)) default else trimws(out)
}

.carga_bool1 <- function(x, default = FALSE) {
  if (is.null(x) || !length(x)) return(default)
  if (is.logical(x)) return(isTRUE(x[[1]]))
  txt <- tolower(trimws(as.character(x[[1]])))
  if (txt %in% c("true", "1", "yes", "si", "s")) TRUE else if (txt %in% c("false", "0", "no", "n")) FALSE else default
}

.carga_kobo_assets <- function(sid, parsed = list()) {
  profile_id <- parsed$connection_profile_id %||% parsed$connectionProfileId %||%
    parsed$profile_id %||% parsed$profileId %||% NULL
  base_url <- .carga_chr1(parsed$base_url %||% parsed$baseUrl, "")
  if (!nzchar(base_url)) base_url <- .connections_profile_base_url("kobo", profile_id)
  if (!nzchar(base_url)) base_url <- kobo_api_default_base_url()
  token <- .connections_token_require("kobo", sid, profile_id = profile_id, base_url = base_url)
  kobo_api_fetch_assets(
    token,
    base_url = base_url,
    limit = parsed$limit %||% 100L
  )
}

.carga_kobo_source_spec <- function(asset_uid,
                                    base_url,
                                    profile_id,
                                    detail,
                                    payload,
                                    inst_meta,
                                    data_meta,
                                    imported_at) {
  deployment <- detail$deployment %||% list()
  version_id <- .carga_chr1(
    detail$version_id %||%
      detail$deployed_version_id %||%
      detail$deployment__version_id %||%
      detail$latest_deployed_version_id %||%
      deployment$version_id,
    ""
  )
  deployment_active <- detail$deployment__active %||%
    detail$deployment_active %||%
    deployment$active %||%
    FALSE
  list(
    asset_uid = asset_uid,
    base_url = .kobo_api_trim_base_url(base_url),
    connection_profile_id = .carga_chr1(profile_id, ""),
    version_id = version_id,
    date_modified = .carga_chr1(detail$date_modified %||% detail$dateModified, ""),
    deployment_active = .carga_bool1(deployment_active, FALSE),
    total_remote = as.integer(payload$total %||% payload$count %||% 0L),
    imported_at = imported_at,
    xlsform_file_id = .carga_chr1(inst_meta$file_id, ""),
    data_file_id = .carga_chr1(data_meta$file_id, "")
  )
}

.carga_kobo_detected_source <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(list(ok = FALSE, detected = FALSE))
  cfg <- s$monitoreo_config %||% list()
  tcfg <- cfg$territorial %||% list()
  phase <- .carga_chr1(tcfg$active_route_phase %||% cfg$active_phase, "field")
  if (!phase %in% c("field", "pilot")) phase <- "field"

  phase_sources <- tcfg$phase_sources %||% tcfg$phaseSources %||% list()
  phase_source <- phase_sources[[phase]] %||% phase_sources$field %||% phase_sources$pilot %||% list()
  schemas <- s$monitoreo_kobo_schemas %||% list()
  schema <- schemas[[phase]] %||% s$monitoreo_kobo_schema %||% list()

  asset_uid <- .carga_chr1(
    phase_source$asset_uid %||% phase_source$assetUid %||%
      schema$asset_uid %||% schema$assetUid %||%
      tcfg$asset_uid %||% tcfg$assetUid,
    ""
  )
  if (!nzchar(asset_uid)) return(list(ok = FALSE, detected = FALSE))

  base_url <- .carga_chr1(
    phase_source$base_url %||% phase_source$baseUrl %||%
      schema$base_url %||% schema$baseUrl %||%
      tcfg$base_url %||% tcfg$baseUrl,
    ""
  )
  if (!nzchar(base_url)) base_url <- kobo_api_default_base_url()
  profile_id <- phase_source$connection_profile_id %||% phase_source$connectionProfileId %||%
    phase_source$profile_id %||% phase_source$profileId %||% NULL
  title <- .carga_chr1(
    schema$name %||% schema$title %||% phase_source$source_title %||%
      phase_source$title %||% tcfg$kobo_asset_name,
    asset_uid
  )

  list(
    ok = TRUE,
    detected = TRUE,
    provider = "kobo",
    phase = phase,
    asset_uid = asset_uid,
    name = title,
    source_title = title,
    base_url = .kobo_api_trim_base_url(base_url),
    connection_profile_id = .carga_chr1(profile_id, ""),
    version_id = .carga_chr1(schema$version_id %||% schema$versionId, ""),
    date_modified = .carga_chr1(schema$date_modified %||% schema$dateModified, ""),
    deployment_active = .carga_bool1(schema$deployment_active %||% schema$deploymentActive, FALSE),
    imported_at = "",
    xlsform_file_id = "",
    data_file_id = ""
  )
}

.carga_platform_finalize <- function(sid, inst_meta, data_meta, source_meta = list()) {
  inst <- leer_instrumento_xlsform(inst_meta$path)
  session_set(sid, "instrumento", inst)
  session_set(sid, "inst_limpieza", NULL)
  session_set(sid, "choice_code_maps_confirmed", NULL)
  preview_inst <- reporte_instrumento(path = inst_meta$path)
  preview <- read_data_preview(
    data_meta$path,
    data_meta$ext,
    instrumento = preview_inst,
    choice_code_maps = .carga_editor_choice_code_maps(sid)
  )
  .carga_store_choice_code_maps(
    sid,
    preview$normalizacion$choice_code_maps %||% list(),
    confirmed = FALSE
  )
  session_set(sid, "data_raw_meta", list(file_id = data_meta$file_id, path = data_meta$path, ext = data_meta$ext))
  estudio_init_default_base(sid)

  s <- session_get(sid)
  if (!is.null(s$estudio$bases$default) && length(source_meta)) {
    meta <- s$estudio$bases$default
    for (key in names(source_meta)) meta[[key]] <- source_meta[[key]]
    if (is.null(meta$imported_at) || !nzchar(as.character(meta$imported_at))) {
      meta$imported_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
    }
    s$estudio$bases$default <- meta
    s <- .mark_project_dirty(s)
    .session_env[[sid]] <- s
  }

  list(
    resumen = summarize_instrumento(inst),
    preview = preview,
    estudio = if (exists(".estudio_payload", mode = "function")) .estudio_payload(sid) else NULL
  )
}

.carga_import_surveymonkey <- function(sid, parsed) {
  survey_id <- trimws(as.character(parsed$survey_id %||% parsed$surveyId %||% ""))
  if (!nzchar(survey_id)) stop_api(400, "E_SM_SURVEY_REQUIRED", "Selecciona una encuesta SurveyMonkey.")
  base_url <- trimws(as.character(parsed$base_url %||% parsed$baseUrl %||% "https://api.surveymonkey.com/v3"))
  profile_id <- parsed$connection_profile_id %||% parsed$profile_id %||% parsed$profileId %||% NULL
  token <- .connections_token_require("surveymonkey", sid, profile_id = profile_id)
  statuses <- as.character(unlist(parsed$response_statuses %||% parsed$responseStatuses %||% list("completed"), use.names = FALSE))
  statuses <- statuses[!is.na(statuses) & nzchar(statuses)]
  if (!length(statuses)) statuses <- "completed"
  keep_missing <- isTRUE(parsed$keep_missing_status %||% parsed$keepMissingStatus)

  details <- sm_api_fetch_survey_details(survey_id, token, base_url = base_url)
  xls_model <- sm_api_xlsform(details, style = .sm_api_default_style(), lang = "es")
  downloads_dir <- file.path(session_get(sid)$dir, "downloads")
  dir.create(downloads_dir, recursive = TRUE, showWarnings = FALSE)

  title <- trimws(as.character(details$title %||% parsed$title %||% paste("SurveyMonkey", survey_id)))
  slug <- .carga_slug(title, paste0("surveymonkey_", survey_id))
  inst_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", slug, "_xlsform.xlsx"))
  .carga_write_xlsform_model(xls_model, inst_path)
  inst_meta <- save_upload(sid, "xlsform", paste0(slug, "_xlsform.xlsx"), readBin(inst_path, "raw", n = file.info(inst_path)$size))
  rp_inst <- reporte_instrumento(path = inst_meta$path)

  payload <- sm_api_fetch_all_responses_bulk(survey_id, token, base_url = base_url)
  data_df <- sm_multibase_api_responses_to_canonical_data(
    details = details,
    responses = payload$data %||% list(),
    inst = rp_inst,
    survey_id = survey_id,
    source_title = title,
    source_channel = as.character(parsed$source_channel %||% parsed$channel %||% ""),
    response_statuses = statuses,
    keep_missing_status = keep_missing
  )
  response_filter <- attr(data_df, "sm_response_filter", exact = TRUE) %||% list()
  data_df <- if (is.data.frame(data_df) && nrow(data_df)) {
    normalize_data_for_xlsform(data_df, rp_inst, choice_code_maps = .carga_editor_choice_code_maps(sid))
  } else {
    .carga_empty_data_for_instrument(rp_inst)
  }
  .carga_assert_data_xlsform_compatible(data_df, rp_inst)

  data_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", slug, "_data.xlsx"))
  .carga_write_xlsx_sheet(data_df, data_path, "datos")
  data_meta <- save_upload(sid, "data", paste0(slug, "_data.xlsx"), readBin(data_path, "raw", n = file.info(data_path)$size))

  source_spec <- list(
    survey_id = survey_id,
    source_title = title,
    source_alias = trimws(as.character(parsed$source_alias %||% parsed$label %||% title)),
    source_channel = as.character(parsed$source_channel %||% parsed$channel %||% ""),
    response_statuses = as.list(statuses),
    keep_missing_status = keep_missing,
    base_url = base_url,
    connection_profile_id = as.character(profile_id %||% "")
  )
  response_filter$kind <- "surveymonkey_api"
  response_filter$survey_id <- survey_id
  response_filter$source_title <- title
  response_filter$imported_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")

  finalized <- .carga_platform_finalize(sid, inst_meta, data_meta, list(
    source_kind = "surveymonkey",
    survey_id = survey_id,
    source_title = title,
    source_alias = source_spec$source_alias,
    source_channel = source_spec$source_channel,
    response_filter = response_filter,
    surveymonkey_source_spec = source_spec,
    surveymonkey_effective_data_file_id = data_meta$file_id
  ))
  c(list(
    ok = TRUE,
    provider = "surveymonkey",
    xlsform_file_id = inst_meta$file_id,
    data_file_id = data_meta$file_id,
    source = source_spec
  ), finalized)
}

.carga_import_kobo <- function(sid, parsed) {
  asset_uid <- trimws(as.character(parsed$asset_uid %||% parsed$assetUid %||% ""))
  if (!nzchar(asset_uid)) stop_api(400, "E_KOBO_ASSET_REQUIRED", "Selecciona un proyecto Kobo.")
  profile_id <- parsed$connection_profile_id %||% parsed$profile_id %||% parsed$profileId %||% NULL
  base_url <- trimws(as.character(parsed$base_url %||% parsed$baseUrl %||% ""))
  if (!nzchar(base_url)) base_url <- .connections_profile_base_url("kobo", profile_id)
  if (!nzchar(base_url)) base_url <- kobo_api_default_base_url()
  token <- .connections_token_require("kobo", sid, profile_id = profile_id, base_url = base_url)
  detail_url <- sprintf(
    "%s/api/v2/assets/%s/?format=json",
    .kobo_api_trim_base_url(base_url),
    utils::URLencode(asset_uid, reserved = TRUE)
  )
  detail <- .kobo_api_fetch_json(detail_url, token)
  xls_model <- .carga_kobo_xlsform_model(detail)

  downloads_dir <- file.path(session_get(sid)$dir, "downloads")
  dir.create(downloads_dir, recursive = TRUE, showWarnings = FALSE)
  title <- trimws(as.character(detail$name %||% parsed$title %||% parsed$name %||% paste("Kobo", asset_uid)))
  slug <- .carga_slug(title, paste0("kobo_", asset_uid))
  inst_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", slug, "_xlsform.xlsx"))
  .carga_write_xlsform_model(xls_model, inst_path)
  inst_meta <- save_upload(sid, "xlsform", paste0(slug, "_xlsform.xlsx"), readBin(inst_path, "raw", n = file.info(inst_path)$size))
  rp_inst <- reporte_instrumento(path = inst_meta$path)

  payload <- kobo_api_fetch_all_asset_data(asset_uid, token, base_url = base_url)
  data_df <- kobo_api_flatten_results(payload$results %||% list())
  data_df <- .carga_align_kobo_data(data_df, rp_inst)
  data_df <- if (is.data.frame(data_df) && nrow(data_df)) {
    normalize_data_for_xlsform(data_df, rp_inst, choice_code_maps = .carga_editor_choice_code_maps(sid))
  } else {
    .carga_empty_data_for_instrument(rp_inst)
  }
  .carga_assert_data_xlsform_compatible(data_df, rp_inst)

  data_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", slug, "_data.xlsx"))
  .carga_write_xlsx_sheet(data_df, data_path, "datos")
  data_meta <- save_upload(sid, "data", paste0(slug, "_data.xlsx"), readBin(data_path, "raw", n = file.info(data_path)$size))

  imported_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  source_spec <- .carga_kobo_source_spec(
    asset_uid = asset_uid,
    base_url = base_url,
    profile_id = profile_id,
    detail = detail,
    payload = payload,
    inst_meta = inst_meta,
    data_meta = data_meta,
    imported_at = imported_at
  )
  source_meta <- c(list(
    kind = "kobo_api",
    source_title = title,
    source_alias = title
  ), source_spec)
  finalized <- .carga_platform_finalize(sid, inst_meta, data_meta, list(
    source_kind = "kobo",
    survey_id = asset_uid,
    source_title = title,
    source_alias = title,
    response_filter = source_meta,
    kobo_source_spec = source_spec,
    kobo_effective_data_file_id = data_meta$file_id
  ))
  c(list(
    ok = TRUE,
    provider = "kobo",
    xlsform_file_id = inst_meta$file_id,
    data_file_id = data_meta$file_id,
    source = source_spec
  ), finalized)
}

mount_carga <- function(pr) {
  pr |>
    plumber::pr_post("/api/carga/instrumento", wrap_endpoint(function(req, res, file_id = NULL) {
      sid <- session_header(req)
      if (is.null(file_id) || !nzchar(file_id)) stop_api(400, "E_MISSING_FILE_ID", "Body must include file_id")
      meta <- get_file(sid, file_id)
      if (!(meta$kind %in% c("xlsform"))) {
        stop_api(400, "E_WRONG_KIND", "file must have kind='xlsform'")
      }
      inst <- leer_instrumento_xlsform(meta$path)
      session_set(sid, "instrumento", inst)
      session_set(sid, "inst_limpieza", NULL)
      # Si ya hay data subida, esto auto-crea/refresca la base "default"
      # del estudio para que las features v2 (Validación, Codificación)
      # encuentren el par xlsform+data sin requerir flujo multi-base
      # explícito. No-op si todavía falta la data.
      tryCatch(estudio_init_default_base(sid),
               error = function(e) {
                 message("[carga] estudio_init_default_base falló: ", conditionMessage(e))
               })
      resumen <- summarize_instrumento(inst)
      list(ok = TRUE, resumen = resumen)
    })) |>
    plumber::pr_get("/api/carga/instrumento/estructura", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      inst <- if (!is.null(s$inst_limpieza)) s$inst_limpieza else {
        meta_files <- Filter(function(f) f$kind == "xlsform", s$files)
        if (length(meta_files) == 0) stop_api(409, "E_NO_XLSFORM", "No XLSForm uploaded yet")
        x <- leer_xlsform_limpieza(meta_files[[length(meta_files)]]$path, verbose = FALSE)
        session_set(sid, "inst_limpieza", x)
        x
      }
      estructura_instrumento(inst)
    })) |>
    plumber::pr_post("/api/carga/data", wrap_endpoint(function(req, res, file_id = NULL) {
      sid <- session_header(req)
      if (is.null(file_id) || !nzchar(file_id)) stop_api(400, "E_MISSING_FILE_ID", "Body must include file_id")
      meta <- get_file(sid, file_id)
      if (!(meta$kind %in% c("data", "sav", "sav_bundle"))) {
        stop_api(400, "E_WRONG_KIND", "file must have kind in {'data','sav','sav_bundle'}")
	      }
	      meta <- .carga_resolve_data_upload_meta(sid, meta)
	      file_id <- meta$file_id
	      preview_inst <- .carga_current_instrumento_for_data(sid)
	      if (is.null(preview_inst)) {
	        stop_api(
	          409,
	          "E_XLSFORM_REQUIRED_FOR_DATA",
	          "Primero carga el XLSForm. La data se normaliza y valida usando ese formulario."
		        )
		      }
		      session_set(sid, "choice_code_maps_confirmed", NULL)
		      preview <- read_data_preview(
		        meta$path,
		        meta$ext,
		        instrumento = preview_inst,
		        choice_code_maps = .carga_editor_choice_code_maps(sid)
		      )
		      .carga_store_choice_code_maps(
		        sid,
		        preview$normalizacion$choice_code_maps %||% list(),
		        confirmed = FALSE
		      )
		      session_set(sid, "data_raw_meta", list(file_id = file_id, path = meta$path, ext = meta$ext))
		      # Si ya hay xlsform subido, este punto cierra el par y auto-crea la
		      # base "default" — el caso típico cuando el user va Carga →
		      # Validación sin pasar por Analítica primero.
		      estudio_init_default_base(sid)
		      list(ok = TRUE, preview = preview)
		    })) |>
    plumber::pr_post("/api/carga/choice-mapping/confirm", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      pending <- s$choice_code_maps_pending %||% NULL
      if (is.null(pending) || !length(pending$maps %||% list())) {
        return(list(ok = TRUE, confirmed = FALSE, message = "No hay mapeos pendientes por confirmar."))
      }
      maps_payload <- list(
        applied = TRUE,
        requires_confirmation = FALSE,
        n_questions = as.integer(pending$n_questions %||% length(pending$maps)),
        maps = pending$maps
      )
      .carga_store_choice_code_maps(sid, maps_payload, confirmed = TRUE)
      tryCatch(
        estudio_init_default_base(sid),
        error = function(e) {
          message("[carga] estudio_init_default_base tras confirmar mapeo falló: ", conditionMessage(e))
        }
      )
      confirmed <- session_get(sid)$choice_code_maps_confirmed
      list(
        ok = TRUE,
        confirmed = TRUE,
        n_questions = as.integer(confirmed$n_questions %||% 0L),
        confirmed_at = as.character(confirmed$confirmed_at %||% "")
      )
    })) |>

    plumber::pr_get("/api/carga/data/normalized-export", wrap_endpoint(function(req, res, format = "xlsx", base_nombre = NULL) {
      sid <- session_header(req)
      meta <- .carga_export_normalized_data(sid, base_nombre = base_nombre, format = format)
      list(
        ok = TRUE,
        file_id = meta$file_id,
        size = meta$size,
        original_name = meta$original_name,
        format = meta$ext
      )
    })) |>

    plumber::pr_post("/api/carga/platform/surveymonkey/import", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .carga_parse_json_body(req)
      .carga_import_surveymonkey(sid, parsed)
    })) |>

    plumber::pr_get("/api/carga/platform/kobo/detected-source", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      .carga_kobo_detected_source(sid)
    })) |>

    plumber::pr_post("/api/carga/platform/kobo/assets", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .carga_parse_json_body(req)
      .carga_kobo_assets(sid, parsed)
    })) |>

    plumber::pr_post("/api/carga/platform/kobo/import", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .carga_parse_json_body(req)
      .carga_import_kobo(sid, parsed)
    })) |>

    # DELETE /api/carga/instrumento — limpia XLSForm cargado.
    # También limpia los artefactos derivados (rp_inst, inst_limpieza,
    # estudio) porque sin instrumento toda la cadena pierde sentido:
    # la base parseada se hizo contra el instrumento, el estudio
    # depende del par. Equivale a un "reset parcial" que deja la
    # sesión intacta pero vacía de insumos.
    plumber::pr_delete("/api/carga/instrumento", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid, required = FALSE)
      if (is.null(s)) return(list(ok = TRUE))

      # 1) Remover archivos xlsform del file store.
      kept <- list()
      for (fid in names(s$files %||% list())) {
        f <- s$files[[fid]]
        if (identical(f$kind, "xlsform")) {
          tryCatch(unlink(f$path, force = TRUE), error = function(e) NULL)
        } else {
          kept[[fid]] <- f
        }
      }
      session_set(sid, "files", kept)

      # 2) Limpiar artefactos en memoria — el instrumento y todo lo
      #    que se deriva (rp_inst + rp_data del estudio).
      session_set(sid, "instrumento",    NULL)
      session_set(sid, "inst_limpieza",  NULL)
      session_set(sid, "rp_inst",        NULL)
      session_set(sid, "rp_data",        NULL)
      session_set(sid, "evaluacion",     NULL)  # validación ya no aplica
      session_set(sid, "plan_result",    NULL)
      session_set(sid, "estudio",        NULL)
      session_set(sid, "choice_code_maps_pending", NULL)
      session_set(sid, "choice_code_maps_confirmed", NULL)
      session_set(sid, "analitica_prep_ok", FALSE)

      list(ok = TRUE)
    })) |>

    # DELETE /api/carga/data — limpia la base de datos cargada.
    # El XLSForm NO se toca — el usuario puede reemplazar la data
    # manteniendo el instrumento (caso común: "probé con esta data,
    # ahora quiero probar con otra usando el mismo formulario").
    plumber::pr_delete("/api/carga/data", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid, required = FALSE)
      if (is.null(s)) return(list(ok = TRUE))

      # 1) Remover archivos data/sav del file store.
      kept <- list()
      for (fid in names(s$files %||% list())) {
        f <- s$files[[fid]]
        if (f$kind %in% c("data", "sav", "sav_bundle")) {
          tryCatch(unlink(f$path, force = TRUE), error = function(e) NULL)
        } else {
          kept[[fid]] <- f
        }
      }
      session_set(sid, "files", kept)

      # 2) Limpiar artefactos en memoria derivados de la data.
      session_set(sid, "data_raw_meta",  NULL)
      session_set(sid, "rp_data",        NULL)
      session_set(sid, "evaluacion",     NULL)  # validación necesitaba la data
      session_set(sid, "plan_result",    NULL)
      session_set(sid, "choice_code_maps_pending", NULL)
      session_set(sid, "choice_code_maps_confirmed", NULL)
      # Si el estudio tiene bases, las vaciamos también — cada base
      # depende de su data. XLSForm sigue disponible para reconstruir.
      session_set(sid, "estudio",        NULL)
      session_set(sid, "analitica_prep_ok", FALSE)

      list(ok = TRUE)
    }))
}
