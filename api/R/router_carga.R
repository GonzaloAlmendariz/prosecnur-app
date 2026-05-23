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
      if (!(meta$kind %in% c("data", "sav"))) {
        stop_api(400, "E_WRONG_KIND", "file must have kind in {'data','sav'}")
	      }
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
        if (f$kind %in% c("data", "sav")) {
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
