# ============================================================
# Fuente propia del Dashboard.
#
# El Dashboard no depende de Procesamiento para renderizar. Mantiene su
# propio par `dashboard_rp_inst` + `dashboard_rp_data`, derivado desde:
# - archivos detectados en la carpeta del proyecto, o
# - archivos subidos directamente desde /tablero.
# ============================================================

.dashboard_ctx <- function(s) {
  s$rp_inst <- s$dashboard_rp_inst %||% NULL
  s$rp_data <- s$dashboard_rp_data %||% NULL
  s
}

.dashboard_has_source <- function(s) {
  !is.null(s$dashboard_rp_inst) && !is.null(s$dashboard_rp_data)
}

.dashboard_source_meta <- function(s) {
  s$dashboard_source %||% list(
    ready = FALSE,
    source_kind = NA_character_,
    xlsform_name = NA_character_,
    data_name = NA_character_,
    n_filas = NA_integer_,
    n_columnas = NA_integer_,
    loaded_at = NA_character_
  )
}

.dashboard_project_dir <- function(s) {
  if (is.null(s$project_path) || !nzchar(s$project_path)) return(NULL)
  d <- dirname(s$project_path)
  if (!dir.exists(d)) return(NULL)
  normalizePath(d, mustWork = TRUE)
}

.dashboard_candidate_item <- function(path = NULL, meta = NULL, kind, origin,
                                      project_dir = NULL) {
  if (!is.null(meta)) {
    return(list(
      id = paste(origin, kind, meta$file_id, sep = ":"),
      origin = origin,
      kind = kind,
      file_id = meta$file_id,
      path = NA_character_,
      name = as.character(meta$original_name %||% basename(meta$path %||% "")),
      ext = tolower(as.character(meta$ext %||% "")),
      size = as.integer(meta$size %||% NA_integer_),
      modified_at = as.character(meta$uploaded_at %||% NA_character_),
      suggested = TRUE
    ))
  }

  info <- file.info(path)
  nm <- basename(path)
  nm_l <- tolower(nm)
  ext <- tolower(tools::file_ext(path))
  suggested <- if (identical(kind, "xlsform")) {
    grepl("xlsform|instrumento|formulario|survey|form", nm_l)
  } else {
    grepl("data|datos|base|bd|respuestas|responses|survey", nm_l) &&
      !grepl("xlsform|instrumento|formulario", nm_l)
  }

  rel <- if (!is.null(project_dir) && startsWith(path, paste0(project_dir, .Platform$file.sep))) {
    substring(path, nchar(project_dir) + 2L)
  } else {
    nm
  }

  list(
    id = paste(origin, kind, rel, sep = ":"),
    origin = origin,
    kind = kind,
    file_id = NA_character_,
    path = path,
    name = rel,
    ext = ext,
    size = as.integer(info$size %||% NA_integer_),
    modified_at = format(info$mtime, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    suggested = isTRUE(suggested)
  )
}

.dashboard_project_candidates <- function(s) {
  project_dir <- .dashboard_project_dir(s)
  if (is.null(project_dir)) {
    return(list(project_dir = NA_character_, xlsforms = list(), data = list()))
  }

  files <- list.files(project_dir, full.names = TRUE, recursive = FALSE,
                      include.dirs = FALSE, no.. = TRUE)
  files <- files[!startsWith(basename(files), ".")]
  files <- files[file.exists(files)]
  exts <- tolower(tools::file_ext(files))

  xls_paths <- files[exts %in% c("xlsx", "xls")]
  data_paths <- files[exts %in% c("xlsx", "xls", "csv", "sav")]

  order_candidates <- function(items) {
    if (!length(items)) return(list())
    items <- items[order(
      !vapply(items, function(x) isTRUE(x$suggested), logical(1)),
      tolower(vapply(items, function(x) x$name, character(1)))
    )]
    items
  }

  list(
    project_dir = project_dir,
    xlsforms = order_candidates(lapply(
      xls_paths,
      .dashboard_candidate_item,
      kind = "xlsform",
      origin = "project",
      project_dir = project_dir
    )),
    data = order_candidates(lapply(
      data_paths,
      .dashboard_candidate_item,
      kind = "data",
      origin = "project",
      project_dir = project_dir
    ))
  )
}

.dashboard_session_candidates <- function(s) {
  files <- s$files %||% list()
  xls <- Filter(function(f) identical(f$kind, "xlsform"), files)
  dat <- Filter(function(f) f$kind %in% c("data", "sav"), files)
  # IMPORTANTE: lapply(xls, .dashboard_candidate_item, ...) pasaría el item
  # como PRIMER argumento posicional (= `path`), no como `meta`. Eso disparaba
  # `file.info(path)` con una lista y devolvía "[E_INTERNAL] invalid filename
  # argument" cuando el usuario abría "Datos" con archivos ya subidos.
  list(
    xlsforms = lapply(xls, function(f) .dashboard_candidate_item(
      meta = f, kind = "xlsform", origin = "session"
    )),
    data = lapply(dat, function(f) .dashboard_candidate_item(
      meta = f, kind = "data", origin = "session"
    ))
  )
}

.dashboard_source_payload <- function(s) {
  project <- .dashboard_project_candidates(s)
  session <- .dashboard_session_candidates(s)
  list(
    has_source = .dashboard_has_source(s),
    source = .dashboard_source_meta(s),
    project_dir = project$project_dir,
    candidates = list(
      project = list(xlsforms = project$xlsforms, data = project$data),
      session = list(xlsforms = session$xlsforms, data = session$data)
    )
  )
}

.dashboard_assert_project_path <- function(s, path) {
  project_dir <- .dashboard_project_dir(s)
  if (is.null(project_dir)) {
    stop_api(409, "E_NO_PROJECT_DIR", "No hay carpeta de proyecto activa.")
  }
  p <- normalizePath(path, mustWork = TRUE)
  if (!startsWith(p, paste0(project_dir, .Platform$file.sep))) {
    stop_api(400, "E_PATH_OUTSIDE_PROJECT", "El archivo debe estar en la carpeta del proyecto.")
  }
  p
}

.dashboard_upload_from_project_path <- function(sid, path, kind) {
  size <- file.info(path)$size
  if (is.na(size) || size <= 0) {
    stop_api(400, "E_EMPTY_FILE", sprintf("Archivo vacío o ilegible: %s", basename(path)))
  }
  save_upload(
    sid = sid,
    kind = kind,
    original_name = basename(path),
    raw_bytes = readBin(path, what = "raw", n = size)
  )
}

.dashboard_import_source <- function(sid, body, keep_curacion = FALSE) {
  s <- session_get(sid)

  xls_meta <- NULL
  dat_meta <- NULL
  source_kind <- "upload"

  xls_fid <- as.character(body$xlsform_file_id %||% "")[1]
  dat_fid <- as.character(body$data_file_id %||% "")[1]
  xls_path <- as.character(body$xlsform_path %||% "")[1]
  dat_path <- as.character(body$data_path %||% "")[1]

  if (nzchar(xls_fid) || nzchar(dat_fid)) {
    if (!nzchar(xls_fid) || !nzchar(dat_fid)) {
      stop_api(400, "E_INCOMPLETE_SOURCE", "Falta XLSForm o data.")
    }
    xls_meta <- get_file(sid, xls_fid)
    dat_meta <- get_file(sid, dat_fid)
    source_kind <- "session"
  } else {
    if (!nzchar(xls_path) || !nzchar(dat_path)) {
      stop_api(400, "E_INCOMPLETE_SOURCE", "Falta XLSForm o data.")
    }
    xls_path <- .dashboard_assert_project_path(s, xls_path)
    dat_path <- .dashboard_assert_project_path(s, dat_path)
    xls_meta <- .dashboard_upload_from_project_path(sid, xls_path, "xlsform")
    data_ext <- ext_for_kind(if (grepl("\\.sav(?:\\s+\\d+)?$", dat_path, ignore.case = TRUE)) "sav" else "data",
                             dat_path)
    dat_meta <- .dashboard_upload_from_project_path(
      sid,
      dat_path,
      if (identical(data_ext, "sav")) "sav" else "data"
    )
    source_kind <- "project"
  }

  if (!identical(xls_meta$kind, "xlsform")) {
    stop_api(400, "E_WRONG_XLSFORM", "El archivo de instrumento debe ser XLSForm.")
  }
  if (!(dat_meta$kind %in% c("data", "sav"))) {
    stop_api(400, "E_WRONG_DATA", "El archivo de data debe ser xlsx, csv o sav.")
  }

  rp_inst <- reporte_instrumento(path = xls_meta$path)
  data_df <- .read_data_any_path(dat_meta$path, dat_meta$ext)
  rp_data <- reporte_data(data_df, instrumento = rp_inst)

  source <- list(
    ready = TRUE,
    source_kind = source_kind,
    xlsform_file_id = xls_meta$file_id,
    data_file_id = dat_meta$file_id,
    xlsform_name = xls_meta$original_name,
    data_name = dat_meta$original_name,
    data_ext = dat_meta$ext,
    n_filas = as.integer(nrow(data_df)),
    n_columnas = as.integer(ncol(data_df)),
    loaded_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  )

  session_set(sid, "dashboard_rp_inst", rp_inst)
  session_set(sid, "dashboard_rp_data", rp_data)
  session_set(sid, "dashboard_source", source)
  # Una importación nueva invalida la curaduría previa (las variables
  # disponibles cambian con el XLSForm). Excepción: el rebuild tras
  # load_pulso usa el mismo XLSForm y debe preservar la curaduría que
  # ya viajaba en el .pulso.
  if (!isTRUE(keep_curacion)) {
    session_set(sid, "dashboard_curacion", NULL)
  }
  source
}

.dashboard_choice_lists_payload <- function(s) {
  s <- .dashboard_ctx(s)
  if (is.null(s$rp_inst)) return(list(listas = list()))
  choices <- s$rp_inst$choices
  if (is.null(choices) || nrow(choices) == 0L) return(list(listas = list()))

  list_names <- unique(as.character(choices$list_name %||% ""))
  list_names <- list_names[nzchar(list_names)]
  listas <- lapply(list_names, function(ln) {
    rows <- choices[as.character(choices$list_name) == ln, , drop = FALSE]
    items <- lapply(seq_len(nrow(rows)), function(i) {
      list(
        name = as.character(rows$name[i] %||% ""),
        label = as.character(rows$label[i] %||% rows$name[i])
      )
    })
    list(list_name = ln, choices = items)
  })
  list(listas = listas)
}

.dashboard_list_name_for_var <- function(var, rp_inst) {
  sv <- rp_inst$survey
  if (is.null(sv) || !"name" %in% names(sv) || !"list_name" %in% names(sv)) return("")
  idx <- which(!is.na(sv$name) & as.character(sv$name) == var)[1]
  if (is.na(idx)) return("")
  as.character(sv$list_name[idx] %||% "")
}

.dashboard_palette_for_var <- function(var, rp_inst, s) {
  list_name <- .dashboard_list_name_for_var(var, rp_inst)
  if (!nzchar(list_name)) return(NULL)
  cfg <- .dashboard_config_with_defaults(s$dashboard_config)
  paletas <- cfg$paletas_listas %||% list()
  pal <- paletas[[list_name]]
  if (!is.list(pal) || !length(pal)) return(NULL)
  pal
}

.dashboard_color_for_label <- function(label, palette) {
  if (is.null(palette) || !is.list(palette)) return(NULL)
  color <- palette[[as.character(label)]]
  if (is.null(color) || !is.character(color) || !nzchar(color[1])) return(NULL)
  as.character(color[1])
}
