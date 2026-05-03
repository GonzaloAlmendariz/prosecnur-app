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
                  "start", "end", "today", "deviceid", "note", "calculate")
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
        list_name <- sub("^select_(one|multiple)\\s+([^\\s]+).*$", "\\2", tt)
        if (identical(list_name, tt)) list_name <- ""
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
        calculate = has_value(calculation_expr),
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
  secciones <- if (!is.null(survey) && "name" %in% names(survey)) {
    begins <- survey[grepl("^begin[_ ]group$", survey$type %||% "") |
                     grepl("^begin[_ ]repeat$", survey$type %||% ""), , drop = FALSE]
    if (nrow(begins) > 0) as.character(begins$name) else character()
  } else character()
  list(
    n_preguntas = if (!is.null(survey)) nrow(survey) else 0L,
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
  skip_types <- c("begin_group", "end_group", "begin_repeat", "end_repeat",
                  "note", "calculate")
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

read_data_preview <- function(path, ext, n_preview = 100L, instrumento = NULL) {
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
  if (!is.null(instrumento)) {
    df <- normalize_data_for_xlsform(df, instrumento)
    norm_attr <- attr(df, "xlsform_normalized")
    df <- .carga_reorder_data_columns(df, instrumento)
    if (!is.null(norm_attr)) {
      survey_cols <- intersect(.carga_data_survey_names(instrumento), names(df))
      normalized_info <- list(
        applied = TRUE,
        aliases = as.integer(length(norm_attr$aliases %||% character(0))),
        select_multiple = as.integer(length(norm_attr$select_multiple %||% list())),
        dropped_columns = as.integer(length(norm_attr$dropped_columns %||% character(0))),
        xlsform_columns = as.integer(length(survey_cols)),
        extra_columns = as.integer(ncol(df) - length(survey_cols))
      )
    }
  }
  if (is.null(normalized_info)) {
    normalized_info <- list(
      applied = FALSE,
      aliases = 0L,
      select_multiple = 0L,
      dropped_columns = 0L,
      xlsform_columns = 0L,
      extra_columns = 0L
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
    preview_filas = jsonlite::toJSON(head_df, na = "null", dataframe = "rows", auto_unbox = TRUE) |>
      jsonlite::fromJSON(simplifyVector = FALSE)
  )
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
  data_df <- normalize_data_for_xlsform(data_df, rp_inst)
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
      preview <- read_data_preview(meta$path, meta$ext, instrumento = preview_inst)
      session_set(sid, "data_raw_meta", list(file_id = file_id, path = meta$path, ext = meta$ext))
      # Si ya hay xlsform subido, este punto cierra el par y auto-crea la
      # base "default" — el caso típico cuando el user va Carga →
      # Validación sin pasar por Analítica primero.
      tryCatch(estudio_init_default_base(sid),
               error = function(e) {
                 message("[carga] estudio_init_default_base falló: ", conditionMessage(e))
               })
      list(ok = TRUE, preview = preview)
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
      # Si el estudio tiene bases, las vaciamos también — cada base
      # depende de su data. XLSForm sigue disponible para reconstruir.
      session_set(sid, "estudio",        NULL)
      session_set(sid, "analitica_prep_ok", FALSE)

      list(ok = TRUE)
    }))
}
