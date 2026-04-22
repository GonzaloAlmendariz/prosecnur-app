estructura_instrumento <- function(inst) {
  sm <- inst$meta$section_map
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
  skip_types <- c("begin_group", "end_group", "begin_repeat", "end_repeat",
                  "start", "end", "today", "deviceid", "note", "calculate")
  has_value <- function(x) !is.na(x) & nzchar(trimws(as.character(x)))

  preguntas <- list()
  if (!is.null(survey) && nrow(survey) > 0) {
    for (i in seq_len(nrow(survey))) {
      tb <- as.character(survey$type_base[i] %||% "")
      tt <- as.character(survey$type[i] %||% "")
      if (tb %in% skip_types || tt %in% skip_types) next
      if (!nzchar(as.character(survey$name[i] %||% ""))) next
      preguntas[[length(preguntas) + 1]] <- list(
        name = as.character(survey$name[i]),
        label = as.character(survey$label[i] %||% survey$name[i]),
        tipo = tb,
        seccion = as.character(survey$group_name[i] %||% ""),
        required = has_value(survey$required[i]) && tolower(trimws(as.character(survey$required[i]))) %in%
          c("true", "true()", "yes", "si", "s"),
        relevant = has_value(survey$relevant[i]),
        constraint = has_value(survey$constraint[i]),
        calculate = has_value(survey$calculation[i])
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

read_data_preview <- function(path, ext, n_preview = 100L) {
  df <- switch(
    ext,
    xlsx = readxl::read_excel(path),
    xls  = readxl::read_excel(path),
    csv  = utils::read.csv(path, stringsAsFactors = FALSE),
    sav  = haven::read_sav(path),
    stop_api(400, "E_UNSUPPORTED_EXT", sprintf("Unsupported data extension: %s", ext))
  )
  n <- nrow(df)
  head_df <- utils::head(df, n_preview)
  list(
    n_filas = as.integer(n),
    n_columnas = ncol(df),
    columnas = lapply(names(df), function(col) {
      list(nombre = col, tipo = paste(class(df[[col]]), collapse = "/"))
    }),
    preview_filas = jsonlite::toJSON(head_df, na = "null", dataframe = "rows", auto_unbox = TRUE) |>
      jsonlite::fromJSON(simplifyVector = FALSE)
  )
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
      preview <- read_data_preview(meta$path, meta$ext)
      session_set(sid, "data_raw_meta", list(file_id = file_id, path = meta$path, ext = meta$ext))
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
