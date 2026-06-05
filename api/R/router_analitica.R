.analitica_fuentes <- function(sid, cfg = NULL) {
  s <- session_get(sid)
  tiene_adaptados <- isTRUE(s$codif_aplicado) &&
                     !is.null(s$codif_inst_adaptado_fid) &&
                     !is.null(s$codif_data_adaptada_fid)

  # UI v3: solo hay dos fuentes visibles. `auto` se conserva como legacy
  # y equivale a "codificada si existe; si no, original".
  cfg <- cfg %||% s$analitica_config %||% list()
  pref <- as.character((cfg %||% list())$fuente_preferida %||% "adaptados")
  if (identical(pref, "auto")) pref <- "adaptados"
  if (!pref %in% c("originales", "adaptados")) pref <- "adaptados"

  usar_adaptados <- identical(pref, "adaptados") && tiene_adaptados

  if (usar_adaptados) {
    list(
      inst_path = get_file(sid, s$codif_inst_adaptado_fid)$path,
      data_meta = get_file(sid, s$codif_data_adaptada_fid),
      fuente = "adaptados"
    )
  } else {
    list(
      inst_path = .require_xlsform_path(sid)$path,
      data_meta = .require_data_path(sid),
      fuente = "originales"
    )
  }
}

.analitica_file_by_id <- function(s, file_id) {
  fid <- as.character(file_id %||% "")
  if (!nzchar(fid) || is.null(s$files[[fid]])) return(NULL)
  s$files[[fid]]
}

.analitica_last_file_by_kind <- function(s, kinds) {
  files <- s$files %||% list()
  hits <- Filter(function(f) as.character(f$kind %||% "") %in% kinds, files)
  if (!length(hits)) return(NULL)
  hits[[length(hits)]]
}

.analitica_file_kind <- function(meta) {
  as.character((meta %||% list())$kind %||% "")
}

.analitica_pair_is_adapted <- function(s, base_meta) {
  xls <- .analitica_file_by_id(s, base_meta$xlsform_file_id)
  dat <- .analitica_file_by_id(s, base_meta$data_file_id)
  identical(.analitica_file_kind(xls), "instrumento_adaptado") &&
    identical(.analitica_file_kind(dat), "data_adaptada")
}

.analitica_global_adapted_pair <- function(s) {
  if (!isTRUE(s$codif_aplicado)) return(NULL)
  xls <- .analitica_file_by_id(s, s$codif_inst_adaptado_fid)
  dat <- .analitica_file_by_id(s, s$codif_data_adaptada_fid)
  if (is.null(xls) || is.null(dat)) return(NULL)
  if (!identical(.analitica_file_kind(xls), "instrumento_adaptado") ||
      !identical(.analitica_file_kind(dat), "data_adaptada")) {
    return(NULL)
  }
  list(xls = xls, data = dat)
}

.analitica_base_can_use_global_adapted <- function(s, base_name = NULL) {
  bases <- names((s$estudio %||% list())$bases %||% list())
  if (length(bases) <= 1L) return(TRUE)
  if (identical(as.character((s$estudio %||% list())$processing_mode %||% ""), "independent_siblings")) {
    return(FALSE)
  }
  active <- as.character(s$codif_source_active %||% "")
  if (!nzchar(active)) active <- bases[1]
  !is.null(base_name) && nzchar(base_name) && identical(base_name, active)
}

.analitica_pair_for_base <- function(s, base_meta, fuente, base_name = NULL) {
  fuente <- as.character(fuente %||% "adaptados")
  if (identical(fuente, "originales")) {
    xls_id <- as.character(base_meta$original_xlsform_file_id %||% base_meta$xlsform_file_id %||% "")
    data_id <- as.character(base_meta$original_data_file_id %||% base_meta$data_file_id %||% "")
  } else {
    xls_id <- as.character(base_meta$xlsform_file_id %||% "")
    data_id <- as.character(base_meta$data_file_id %||% "")
  }
  xls <- .analitica_file_by_id(s, xls_id)
  dat <- .analitica_file_by_id(s, data_id)
  if (!identical(fuente, "originales") &&
      (!identical(.analitica_file_kind(xls), "instrumento_adaptado") ||
       !identical(.analitica_file_kind(dat), "data_adaptada")) &&
      .analitica_base_can_use_global_adapted(s, base_name)) {
    pair_global <- .analitica_global_adapted_pair(s)
    if (!is.null(pair_global)) return(pair_global)
  }
  if (identical(fuente, "originales") &&
      (identical(.analitica_file_kind(xls), "instrumento_adaptado") ||
       identical(.analitica_file_kind(dat), "data_adaptada"))) {
    xls <- .analitica_last_file_by_kind(s, "xlsform") %||% xls
    dat <- .analitica_last_file_by_kind(s, c("data", "sav")) %||% dat
  }
  if (is.null(xls) || is.null(dat)) return(NULL)
  list(xls = xls, data = dat)
}

.analitica_effective_source <- function(s, cfg) {
  pref <- as.character((cfg %||% list())$fuente_preferida %||% "adaptados")
  if (identical(pref, "auto")) pref <- "adaptados"
  if (!pref %in% c("originales", "adaptados")) pref <- "adaptados"
  if (identical(pref, "originales")) return("originales")

  bases <- (s$estudio %||% list())$bases %||% list()
  has_adapted <- if (length(bases) > 0L) {
    any(vapply(bases, function(b) .analitica_pair_is_adapted(s, b), logical(1))) ||
      !is.null(.analitica_global_adapted_pair(s))
  } else {
    isTRUE(s$codif_aplicado) &&
      !is.null(s$codif_inst_adaptado_fid) &&
      !is.null(s$codif_data_adaptada_fid)
  }
  if (isTRUE(has_adapted)) "adaptados" else "originales"
}

.analitica_non_data_types <- c(
  "begin_group", "end_group", "begin_repeat", "end_repeat",
  "note", "calculate", "start", "end", "today", "deviceid",
  "subscriberid", "phonenumber", "simserial", "username", "audit"
)

.analitica_type_base <- function(type) {
  out <- trimws(sub("\\s+.*$", "", as.character(type %||% "")))
  out[is.na(out)] <- ""
  out
}

.analitica_data_names_for_inst <- function(rp_inst) {
  sv <- rp_inst$survey %||% NULL
  if (is.null(sv) || !nrow(sv) || !"name" %in% names(sv)) return(character(0))
  names0 <- as.character(sv$name)
  names0[is.na(names0)] <- ""
  if ("type" %in% names(sv)) {
    types <- .analitica_type_base(sv$type)
    keep <- !(types %in% .analitica_non_data_types)
  } else {
    keep <- rep(TRUE, length(names0))
  }
  unique(names0[keep & nzchar(names0)])
}

.analitica_structural_names_for_inst <- function(rp_inst) {
  sv <- rp_inst$survey %||% NULL
  if (is.null(sv) || !nrow(sv) || !all(c("name", "type") %in% names(sv))) return(character(0))
  names0 <- as.character(sv$name)
  names0[is.na(names0)] <- ""
  types <- .analitica_type_base(sv$type)
  unique(names0[types %in% .analitica_non_data_types & nzchar(names0)])
}

.analitica_filter_data_to_inst <- function(data, rp_inst) {
  if (!is.data.frame(data) || !length(names(data))) return(data)
  data_names <- names(data)
  data_vars <- .analitica_data_names_for_inst(rp_inst)
  structural <- .analitica_structural_names_for_inst(rp_inst)
  extras <- setdiff(data_names, c(data_vars, structural))
  extras <- extras[!grepl("^Pag[0-9]+$", extras)]
  extras <- extras[!grepl("^(nota|note)_", extras, ignore.case = TRUE)]
  cols <- unique(c(intersect(data_vars, data_names), extras))
  if (!length(cols)) return(data[, 0, drop = FALSE])
  out <- data[, cols, drop = FALSE]
  for (nm in setdiff(names(attributes(data)), c("names", "row.names", "class"))) {
    attr(out, nm) <- attr(data, nm)
  }
  out
}

.analitica_read_data_file <- function(meta) {
  ext <- tolower(as.character((meta %||% list())$ext %||% ""))
  if (!nzchar(ext)) ext <- tolower(tools::file_ext(as.character((meta %||% list())$path %||% "")))
  switch(ext,
    xlsx = readxl::read_excel(meta$path),
    xls  = readxl::read_excel(meta$path),
    csv  = utils::read.csv(meta$path, stringsAsFactors = FALSE),
    sav  = haven::read_sav(meta$path),
    stop_api(400, "E_UNSUPPORTED_EXT", sprintf("Ext no soportada: %s", ext))
  )
}

.analitica_write_plain_xlsx <- function(df, path) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) stop("Se requiere openxlsx.", call. = FALSE)
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "datos")
  openxlsx::writeData(wb, "datos", df, withFilter = TRUE)
  openxlsx::freezePane(wb, "datos", firstRow = TRUE)
  if (ncol(df)) openxlsx::setColWidths(wb, "datos", cols = seq_len(ncol(df)), widths = "auto")
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
}

.analitica_scalar <- function(x, fallback = "") {
  if (is.null(x) || !length(x)) return(fallback)
  out <- as.character(x[[1]])
  if (is.na(out) || !nzchar(out)) fallback else out
}

.analitica_integrated_key_list_name <- function(key_name) {
  if (exists(".mi_origin_key_list_name", mode = "function")) {
    return(.mi_origin_key_list_name(key_name))
  }
  base <- tolower(iconv(.analitica_scalar(key_name, "origen"), to = "ASCII//TRANSLIT", sub = ""))
  base <- gsub("[^a-z0-9_]+", "_", base)
  base <- gsub("^_+|_+$", "", base)
  if (!nzchar(base)) base <- "origen"
  paste0(base, "_opciones")
}

.analitica_integrated_key_spec <- function(base_meta) {
  mi <- (base_meta %||% list())$multi_integrated %||% NULL
  if (is.null(mi)) return(NULL)
  key_name <- .analitica_scalar(mi$origin_key_name, "")
  if (!nzchar(key_name)) return(NULL)
  origins <- mi$origins %||% list()
  if (!length(origins)) return(NULL)
  values <- vapply(origins, function(origin) {
    .analitica_scalar(origin$key_value %||% origin$origin %||% origin$pais, "")
  }, character(1))
  labels <- vapply(seq_along(origins), function(i) {
    origin <- origins[[i]]
    value <- .analitica_scalar(values[[i]], "")
    .analitica_scalar(origin$key_label %||% origin$key_value %||% value, value)
  }, character(1))
  keep <- nzchar(values) & !duplicated(values)
  values <- values[keep]
  labels <- labels[keep]
  if (!length(values)) return(NULL)
  list(
    key_name = key_name,
    key_label = key_name,
    list_name = .analitica_integrated_key_list_name(key_name),
    values = values,
    labels = labels
  )
}

.analitica_patch_integrated_key_survey <- function(survey, spec, raw = FALSE) {
  if (is.null(survey) || !is.data.frame(survey) || is.null(spec)) return(survey)
  survey <- as.data.frame(survey, stringsAsFactors = FALSE, check.names = FALSE)
  for (col in c("type", "name", "label")) {
    if (!col %in% names(survey)) survey[[col]] <- character(nrow(survey))
  }
  if (!raw && !"list_name" %in% names(survey)) survey$list_name <- NA_character_
  idx <- which(as.character(survey$name %||% "") == spec$key_name)
  if (!length(idx)) {
    row <- as.data.frame(as.list(stats::setNames(rep(NA_character_, length(names(survey))), names(survey))),
      stringsAsFactors = FALSE, check.names = FALSE)
    survey <- rbind(row, survey)
    idx <- 1L
  }
  idx <- idx[1L]
  if (raw && !"list_name" %in% names(survey)) {
    survey$type[idx] <- paste("select_one", spec$list_name)
  } else {
    survey$type[idx] <- "select_one"
    survey$list_name[idx] <- spec$list_name
  }
  survey$name[idx] <- spec$key_name
  label_cols <- grep("^label", names(survey), value = TRUE, ignore.case = TRUE)
  if (!length(label_cols)) label_cols <- "label"
  for (col in label_cols) {
    if (!col %in% names(survey)) survey[[col]] <- character(nrow(survey))
    current <- .analitica_scalar(survey[[col]][idx], "")
    if (!nzchar(current) || identical(current, spec$key_name)) survey[[col]][idx] <- spec$key_label
  }
  if ("measure_sugerida" %in% names(survey)) survey$measure_sugerida[idx] <- "nominal"
  survey
}

.analitica_patch_integrated_key_choices <- function(choices, spec) {
  if (is.null(spec)) return(choices)
  if (is.null(choices) || !is.data.frame(choices)) choices <- data.frame()
  choices <- as.data.frame(choices, stringsAsFactors = FALSE, check.names = FALSE)
  for (col in c("list_name", "name", "label")) {
    if (!col %in% names(choices)) choices[[col]] <- character(nrow(choices))
  }
  choices <- choices[as.character(choices$list_name %||% "") != spec$list_name, , drop = FALSE]
  label_cols <- grep("^label", names(choices), value = TRUE, ignore.case = TRUE)
  if (!length(label_cols)) label_cols <- "label"
  rows <- lapply(seq_along(spec$values), function(i) {
    row <- as.data.frame(as.list(stats::setNames(rep(NA_character_, length(names(choices))), names(choices))),
      stringsAsFactors = FALSE, check.names = FALSE)
    row$list_name[1] <- spec$list_name
    row$name[1] <- spec$values[[i]]
    for (col in label_cols) row[[col]][1] <- spec$labels[[i]]
    row
  })
  if (!length(rows)) return(choices)
  rbind(choices, do.call(rbind, rows))
}

.analitica_apply_integrated_key <- function(rp_inst, base_meta = NULL) {
  spec <- .analitica_integrated_key_spec(base_meta)
  if (is.null(spec) || is.null(rp_inst)) return(rp_inst)
  rp_inst$survey <- .analitica_patch_integrated_key_survey(rp_inst$survey, spec, raw = FALSE)
  rp_inst$choices <- .analitica_patch_integrated_key_choices(rp_inst$choices, spec)

  code_to_label <- stats::setNames(as.character(spec$labels), as.character(spec$values))
  label_to_code <- stats::setNames(as.character(spec$values), as.character(spec$labels))
  rp_inst$dicc_code_to_label <- rp_inst$dicc_code_to_label %||% list()
  rp_inst$dicc_label_to_code <- rp_inst$dicc_label_to_code %||% list()
  rp_inst$dicc_code_to_label[[spec$list_name]] <- code_to_label
  rp_inst$dicc_label_to_code[[spec$list_name]] <- label_to_code

  rp_inst$orders_list <- rp_inst$orders_list %||% list()
  rp_inst$orders_list[[spec$key_name]] <- list(
    names = as.character(spec$values),
    labels = as.character(spec$labels),
    label = spec$key_label,
    var_label = spec$key_label
  )

  rp_inst$var_labels <- rp_inst$var_labels %||% character(0)
  rp_inst$var_labels[[spec$key_name]] <- spec$key_label

  mr <- rp_inst$measure_rules %||% data.frame(name = character(), type = character(), list_name = character(), measure_sugerida = character())
  if (!"name" %in% names(mr)) mr$name <- character(nrow(mr))
  idx <- which(as.character(mr$name %||% "") == spec$key_name)
  if (!length(idx)) {
    row <- as.data.frame(as.list(stats::setNames(rep(NA_character_, length(names(mr))), names(mr))),
      stringsAsFactors = FALSE, check.names = FALSE)
    row$name[1] <- spec$key_name
    mr <- rbind(row, mr)
    idx <- 1L
  }
  for (col in c("type", "list_name", "measure_sugerida")) if (!col %in% names(mr)) mr[[col]] <- NA_character_
  mr$type[idx[1L]] <- "select_one"
  mr$list_name[idx[1L]] <- spec$list_name
  mr$measure_sugerida[idx[1L]] <- "nominal"
  rp_inst$measure_rules <- mr
  rp_inst
}

.analitica_apply_integrated_key_to_data <- function(rp_data, rp_inst, base_meta = NULL) {
  spec <- .analitica_integrated_key_spec(base_meta)
  if (is.null(spec) || is.null(rp_data) || !is.data.frame(rp_data)) return(rp_data)
  if (spec$key_name %in% names(rp_data)) {
    attr(rp_data[[spec$key_name]], "label") <- spec$key_label
    attr(rp_data[[spec$key_name]], "labels") <- stats::setNames(
      as.character(spec$labels),
      nm = as.character(spec$values)
    )
    attr(rp_data[[spec$key_name]], "measure") <- "nominal"
  }
  attr(rp_data, "instrumento_reporte") <- rp_inst
  rp_data
}

.analitica_single_base_meta <- function(sid) {
  s <- session_get(sid, required = FALSE)
  bases <- (s$estudio %||% list())$bases %||% list()
  if (length(bases) == 1L) return(bases[[1L]])
  active_estudio <- if (exists("estudio_active_base", mode = "function")) estudio_active_base(sid) else NULL
  if (!is.null(active_estudio) && nzchar(active_estudio) && !is.null(bases[[active_estudio]])) {
    return(bases[[active_estudio]])
  }
  active <- .analitica_scalar(s$codif_source_active, "")
  if (nzchar(active) && !is.null(bases[[active]])) return(bases[[active]])
  NULL
}

.analitica_scope_bases <- function(sid, bases) {
  bases <- bases %||% list()
  if (!length(bases) || !exists("estudio_is_independent_siblings", mode = "function") ||
      !estudio_is_independent_siblings(sid)) {
    return(bases)
  }
  active <- estudio_active_base(sid)
  if (is.null(active) || !nzchar(active) || is.null(bases[[active]])) {
    stop_api(409, "E_ACTIVE_BASE_MISSING",
             "Selecciona una base activa valida para procesar este estudio.")
  }
  stats::setNames(list(bases[[active]]), active)
}

.analitica_patch_inst_sources_integrated <- function(sid, inst_sources) {
  if (!length(inst_sources)) return(inst_sources)
  s <- session_get(sid, required = FALSE)
  bases <- (s$estudio %||% list())$bases %||% list()
  for (nombre in names(inst_sources)) {
    base_meta <- bases[[nombre]] %||% if (length(inst_sources) == 1L) .analitica_single_base_meta(sid) else NULL
    inst_sources[[nombre]] <- .analitica_apply_integrated_key(inst_sources[[nombre]], base_meta)
  }
  inst_sources
}

.analitica_patch_data_sources_integrated <- function(sid, data_sources, inst_sources) {
  if (!length(data_sources)) return(data_sources)
  s <- session_get(sid, required = FALSE)
  bases <- (s$estudio %||% list())$bases %||% list()
  for (nombre in names(data_sources)) {
    base_meta <- bases[[nombre]] %||% if (length(data_sources) == 1L) .analitica_single_base_meta(sid) else NULL
    data_sources[[nombre]] <- .analitica_apply_integrated_key_to_data(
      data_sources[[nombre]],
      inst_sources[[nombre]] %||% NULL,
      base_meta
    )
  }
  data_sources
}

.analitica_write_xlsform_frames <- function(survey, choices, settings, path) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) stop("Se requiere openxlsx.", call. = FALSE)
  wb <- openxlsx::createWorkbook()
  for (sheet in c("survey", "choices", "settings")) {
    df <- switch(sheet, survey = survey, choices = choices, settings = settings)
    if (is.null(df)) df <- data.frame()
    openxlsx::addWorksheet(wb, sheet)
    openxlsx::writeData(wb, sheet, df)
    openxlsx::freezePane(wb, sheet, firstRow = TRUE)
    if (ncol(df)) openxlsx::setColWidths(wb, sheet, cols = seq_len(ncol(df)), widths = "auto")
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
}

.analitica_patch_xlsform_file_for_integrated_key <- function(path_in, path_out, base_meta) {
  spec <- .analitica_integrated_key_spec(base_meta)
  if (is.null(spec)) {
    ok <- file.copy(path_in, path_out, overwrite = TRUE)
    if (!isTRUE(ok)) stop("No se pudo copiar el XLSForm.", call. = FALSE)
    return(invisible(path_out))
  }
  survey <- readxl::read_excel(path_in, sheet = "survey")
  choices <- readxl::read_excel(path_in, sheet = "choices")
  settings <- tryCatch(readxl::read_excel(path_in, sheet = "settings"), error = function(e) data.frame())
  survey <- .analitica_patch_integrated_key_survey(survey, spec, raw = TRUE)
  choices <- .analitica_patch_integrated_key_choices(choices, spec)
  .analitica_write_xlsform_frames(survey, choices, settings, path_out)
  invisible(path_out)
}

.analitica_read_pair <- function(pair, base_meta = NULL) {
  rp_inst <- reporte_instrumento(path = pair$xls$path)
  rp_inst <- .analitica_apply_integrated_key(rp_inst, base_meta)
  dat_raw <- .analitica_read_data_file(pair$data)
  dat_raw <- normalize_data_for_xlsform(dat_raw, rp_inst)
  dat_raw <- .analitica_filter_data_to_inst(dat_raw, rp_inst)
  .carga_assert_data_xlsform_compatible(dat_raw, rp_inst)
  rp_data <- reporte_data(dat_raw, instrumento = rp_inst)
  rp_data <- .analitica_apply_integrated_key_to_data(rp_data, rp_inst, base_meta)
  list(inst = rp_inst, data = rp_data)
}

.analitica_prepare_context <- function(sid, cfg) {
  s <- session_get(sid)
  fuente <- .analitica_effective_source(s, cfg)
  bases <- (s$estudio %||% list())$bases %||% list()
  bases <- .analitica_scope_bases(sid, bases)

  if (length(bases) > 0L) {
    data_sources <- list()
    inst_sources <- list()
    for (nombre in names(bases)) {
      pair <- .analitica_pair_for_base(s, bases[[nombre]], fuente, nombre)
      if (is.null(pair) && identical(fuente, "adaptados")) {
        pair <- .analitica_pair_for_base(s, bases[[nombre]], "originales", nombre)
      }
      if (is.null(pair)) {
        stop_api(409, "E_ANALITICA_SOURCE_MISSING",
          sprintf("No se pudo resolver el par XLSForm/Data para la base '%s'.", nombre))
      }
      parsed <- .analitica_read_pair(pair, bases[[nombre]])
      data_sources[[nombre]] <- parsed$data
      inst_sources[[nombre]] <- parsed$inst
    }
    first <- names(data_sources)[1]
    return(list(
      fuente = fuente,
      rp_data = data_sources[[first]],
      rp_inst = inst_sources[[first]],
      data_sources = data_sources,
      inst_sources = inst_sources
    ))
  }

  src <- .analitica_fuentes(sid, cfg)
  parsed <- .analitica_read_pair(list(
    xls = list(path = src$inst_path),
    data = src$data_meta
  ), NULL)
  list(
    fuente = src$fuente,
    rp_data = parsed$data,
    rp_inst = parsed$inst,
    data_sources = list(default = parsed$data),
    inst_sources = list(default = parsed$inst)
  )
}

.analitica_source_pairs <- function(sid, cfg = NULL) {
  s <- session_get(sid)
  cfg <- cfg %||% .analitica_get_config(sid)
  fuente <- .analitica_effective_source(s, cfg)
  bases <- (s$estudio %||% list())$bases %||% list()
  bases <- .analitica_scope_bases(sid, bases)

  if (length(bases) > 0L) {
    pairs <- list()
    for (nombre in names(bases)) {
      pair <- .analitica_pair_for_base(s, bases[[nombre]], fuente, nombre)
      if (is.null(pair) && identical(fuente, "adaptados")) {
        pair <- .analitica_pair_for_base(s, bases[[nombre]], "originales", nombre)
      }
      if (is.null(pair)) {
        stop_api(409, "E_ANALITICA_SOURCE_MISSING",
          sprintf("No se pudo resolver el par XLSForm/Data para la base '%s'.", nombre))
      }
      pairs[[nombre]] <- pair
    }
    return(list(fuente = fuente, pairs = pairs))
  }

  src <- .analitica_fuentes(sid, cfg)
  xls_meta <- if (identical(src$fuente, "adaptados")) {
    .analitica_file_by_id(s, s$codif_inst_adaptado_fid)
  } else {
    .require_xlsform_path(sid)
  }
  if (is.null(xls_meta)) {
    xls_meta <- list(
      path = src$inst_path,
      ext = tools::file_ext(src$inst_path),
      kind = if (identical(src$fuente, "adaptados")) "instrumento_adaptado" else "xlsform"
    )
  }

  list(
    fuente = src$fuente,
    pairs = list(default = list(xls = xls_meta, data = src$data_meta))
  )
}

.analitica_source_file_ext <- function(meta) {
  ext <- tolower(as.character((meta %||% list())$ext %||% ""))
  if (!nzchar(ext)) ext <- tolower(tools::file_ext(as.character((meta %||% list())$path %||% "")))
  if (!nzchar(ext)) "xlsx" else ext
}

.analitica_source_file_kind <- function(meta, role) {
  kind <- .analitica_file_kind(meta)
  role <- as.character(role %||% "data")
  if (identical(role, "instrumento")) {
    if (identical(kind, "instrumento_adaptado")) "bases_instrumento_codificado" else "bases_instrumento"
  } else {
    if (identical(kind, "data_adaptada")) "bases_data_codificada" else "bases_data"
  }
}

.analitica_source_zip_kind <- function(kinds, role) {
  role <- as.character(role %||% "data")
  if (identical(role, "instrumento")) {
    if (all(kinds == "bases_instrumento_codificado")) "bases_instrumento_codificado_zip" else "bases_instrumento_zip"
  } else {
    if (all(kinds == "bases_data_codificada")) "bases_data_codificada_zip" else "bases_data_zip"
  }
}

.analitica_export_source_files <- function(sid, role = c("data", "instrumento"), cfg = NULL) {
  role <- match.arg(role)
  s <- session_get(sid)
  bases <- (s$estudio %||% list())$bases %||% list()
  resolved <- .analitica_source_pairs(sid, cfg)
  pairs <- resolved$pairs
  if (length(pairs) == 0L) {
    stop_api(409, "E_ANALITICA_SOURCE_MISSING", "No hay archivos fuente para exportar.")
  }

  outputs <- list()
  kinds <- character(0)
  for (nombre in names(pairs)) {
    meta_in <- if (identical(role, "instrumento")) pairs[[nombre]]$xls else pairs[[nombre]]$data
    path_in <- as.character((meta_in %||% list())$path %||% "")
    if (!nzchar(path_in) || !file.exists(path_in)) {
      stop_api(409, "E_ANALITICA_SOURCE_MISSING",
        sprintf("No se encontró el archivo %s para la base '%s'.", role, nombre))
    }

    kind <- .analitica_source_file_kind(meta_in, role)
    kinds <- c(kinds, kind)
    ext <- .analitica_source_file_ext(meta_in)
    solo_una <- length(pairs) == 1L && nombre %in% c("default", "giz", "generic")
    fname <- if (solo_una) {
      .export_filename(sid, kind, ext)
    } else {
      .export_filename(sid, kind, ext, base = nombre)
    }
    path_out <- .session_tmp(sid, sprintf("%s_%s", uuid::UUIDgenerate(), fname))
    base_meta <- bases[[nombre]] %||% NULL
    is_integrated_data <- identical(role, "data") &&
      !is.null((base_meta %||% list())$multi_integrated) &&
      !identical(kind, "bases_data_codificada")
    is_integrated_instrument <- identical(role, "instrumento") &&
      !is.null((base_meta %||% list())$multi_integrated) &&
      !identical(kind, "bases_instrumento_codificado")
    if (isTRUE(is_integrated_data)) {
      rp_inst <- reporte_instrumento(path = pairs[[nombre]]$xls$path)
      rp_inst <- .analitica_apply_integrated_key(rp_inst, base_meta)
      data_df <- .analitica_read_data_file(meta_in)
      data_df <- normalize_data_for_xlsform(data_df, rp_inst)
      data_df <- .analitica_filter_data_to_inst(data_df, rp_inst)
      ext <- "xlsx"
      fname <- sub("\\.[^.]+$", ".xlsx", fname)
      path_out <- .session_tmp(sid, sprintf("%s_%s", uuid::UUIDgenerate(), fname))
      .analitica_write_plain_xlsx(data_df, path_out)
    } else if (isTRUE(is_integrated_instrument)) {
      ext <- "xlsx"
      fname <- sub("\\.[^.]+$", ".xlsx", fname)
      path_out <- .session_tmp(sid, sprintf("%s_%s", uuid::UUIDgenerate(), fname))
      .analitica_patch_xlsform_file_for_integrated_key(path_in, path_out, base_meta)
    } else {
      copied <- file.copy(path_in, path_out, overwrite = TRUE)
      if (!isTRUE(copied)) {
        stop_api(500, "E_EXPORT_COPY_FAILED",
          sprintf("No se pudo preparar la descarga para la base '%s'.", nombre))
      }
    }

    meta_out <- .register_output_file(sid, kind, path_out, original_name = fname)
    outputs[[length(outputs) + 1L]] <- list(
      nombre = nombre,
      file_id = meta_out$file_id,
      filename = meta_out$original_name,
      size = meta_out$size,
      path = path_out
    )
  }

  if (length(outputs) == 1L) {
    o <- outputs[[1]]
    return(list(
      ok = TRUE,
      n_bases = 1L,
      fuente = resolved$fuente,
      file_id = o$file_id,
      filename = o$filename,
      size = o$size,
      bases = list(o[setdiff(names(o), "path")])
    ))
  }

  zip_kind <- .analitica_source_zip_kind(kinds, role)
  zip_name <- .export_filename(sid, zip_kind, "zip")
  zip_path <- .session_tmp(sid, sprintf("%s_%s", uuid::UUIDgenerate(), zip_name))
  .zip_files(
    zip_path,
    files = vapply(outputs, function(o) o$path, character(1)),
    names_in_zip = vapply(outputs, function(o) o$filename, character(1))
  )
  meta_zip <- .register_output_file(sid, zip_kind, zip_path, original_name = zip_name)
  list(
    ok = TRUE,
    n_bases = length(outputs),
    fuente = resolved$fuente,
    zip = list(file_id = meta_zip$file_id, filename = meta_zip$original_name, size = meta_zip$size),
    bases = lapply(outputs, function(o) o[setdiff(names(o), "path")])
  )
}

.analitica_base_alias <- function(base_meta, nombre) {
  value <- base_meta$source_alias %||% base_meta$alias %||%
    base_meta$source_title %||% base_meta$label %||% nombre
  value <- trimws(as.character(value %||% nombre)[1])
  if (is.na(value) || !nzchar(value)) as.character(nombre) else value
}

.analitica_base_id_slug <- function(value) {
  value <- tolower(iconv(as.character(value %||% "base"), from = "", to = "ASCII//TRANSLIT", sub = ""))
  value <- gsub("[^a-z0-9]+", "_", value)
  value <- gsub("^_+|_+$", "", value)
  if (!nzchar(value)) "base" else value
}

.analitica_origin_id_col <- function(df) {
  if (is.null(df) || !is.data.frame(df) || !length(names(df))) return(NULL)
  norm <- function(x) {
    x <- tolower(trimws(as.character(x)))
    x <- gsub("[^a-z0-9]+", "_", x)
    gsub("^_+|_+$", "", x)
  }
  names_raw <- names(df)
  names_norm <- norm(names_raw)
  preferred <- c(
    "response_id", "respondent_id", "respondent", "survey_response_id",
    "submission_id", "_submission_id", "case_uid", "case_id",
    "uuid", "_uuid", "id", "_id", "codigo_pucp", "codigo"
  )
  for (candidate in preferred) {
    hit <- which(names_norm == norm(candidate))[1]
    if (!is.na(hit)) return(names_raw[hit])
  }
  NULL
}

.analitica_plain_col <- function(x) {
  if (inherits(x, c("haven_labelled", "haven_labelled_spss"))) {
    lab <- attr(x, "label", exact = TRUE)
    x <- unclass(x)
    attributes(x) <- NULL
    if (!is.null(lab)) attr(x, "label") <- lab
    return(x)
  }
  if (is.factor(x)) return(as.character(x))
  if (is.list(x) && !is.data.frame(x)) {
    return(vapply(x, function(item) {
      if (is.null(item) || length(item) == 0L) return(NA_character_)
      paste(as.character(item), collapse = " | ")
    }, character(1)))
  }
  x
}

.analitica_unified_align <- function(dfs, cols, labels) {
  lapply(dfs, function(df) {
    for (col in cols) {
      if (!(col %in% names(df))) df[[col]] <- NA
    }
    df <- df[, cols, drop = FALSE]
    for (col in names(df)) {
      df[[col]] <- .analitica_plain_col(df[[col]])
      lab <- labels[[col]] %||% NULL
      if (!is.null(lab) && nzchar(as.character(lab))) attr(df[[col]], "label") <- as.character(lab)
    }
    df
  })
}

.analitica_write_unified_xlsx <- function(df_cod, df_lab, common_df, omitted_df,
                                          bases_df, path, valores = "ambos") {
  if (!requireNamespace("openxlsx", quietly = TRUE)) stop("Se requiere openxlsx.", call. = FALSE)
  wb <- openxlsx::createWorkbook()

  write_data_sheet <- function(sheet_name, data) {
    openxlsx::addWorksheet(wb, sheet_name)
    openxlsx::writeData(wb, sheet_name, as.data.frame(as.list(names(data)), stringsAsFactors = FALSE), colNames = FALSE, startRow = 1L)
    var_labels <- vapply(data, function(c) {
      l <- attr(c, "label", exact = TRUE)
      if (is.null(l)) "" else as.character(l)
    }, character(1))
    openxlsx::writeData(wb, sheet_name, as.data.frame(as.list(var_labels), stringsAsFactors = FALSE), colNames = FALSE, startRow = 2L)
    for (v in names(data)) data[[v]] <- .analitica_plain_col(data[[v]])
    openxlsx::writeData(wb, sheet_name, data, startRow = 3L, colNames = FALSE)
    header1 <- openxlsx::createStyle(textDecoration = "bold", fgFill = "#E8EAED", halign = "left")
    header2 <- openxlsx::createStyle(textDecoration = "italic", fontColour = "#5F6368", fgFill = "#F6F7F9")
    openxlsx::addStyle(wb, sheet_name, header1, rows = 1L, cols = seq_along(data), gridExpand = TRUE)
    openxlsx::addStyle(wb, sheet_name, header2, rows = 2L, cols = seq_along(data), gridExpand = TRUE)
    openxlsx::freezePane(wb, sheet_name, firstActiveRow = 3L)
    openxlsx::setColWidths(wb, sheet_name, cols = seq_along(data), widths = "auto")
  }

  write_meta_sheet <- function(sheet_name, data) {
    openxlsx::addWorksheet(wb, sheet_name)
    openxlsx::writeData(wb, sheet_name, data)
    header <- openxlsx::createStyle(textDecoration = "bold", fgFill = "#E8EAED")
    if (ncol(data)) {
      openxlsx::addStyle(wb, sheet_name, header, rows = 1L, cols = seq_len(ncol(data)), gridExpand = TRUE)
      openxlsx::setColWidths(wb, sheet_name, cols = seq_len(ncol(data)), widths = "auto")
      openxlsx::freezePane(wb, sheet_name, firstRow = TRUE)
    }
  }

  if (identical(valores, "ambos")) {
    write_data_sheet("completa_codigos", df_cod)
    write_data_sheet("completa_etiquetas", df_lab)
  } else if (identical(valores, "etiquetas")) {
    write_data_sheet("completa_etiquetas", df_lab)
  } else {
    write_data_sheet("completa_codigos", df_cod)
  }
  write_meta_sheet("variables_comunes", common_df)
  write_meta_sheet("variables_no_comunes", omitted_df)
  write_meta_sheet("bases", bases_df)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.analitica_unified_independent_xlsx <- function(sid, cfg, valores = "ambos",
                                                multi_select = "dummy_01") {
  if (!exists("estudio_is_independent_siblings", mode = "function") ||
      !estudio_is_independent_siblings(sid)) {
    stop_api(409, "E_NOT_INDEPENDENT_SIBLINGS",
             "La base unificada solo esta disponible para bases hermanas independientes.")
  }

  s <- session_get(sid)
  bases <- (s$estudio %||% list())$bases %||% list()
  if (length(bases) < 2L) {
    stop_api(409, "E_NOT_ENOUGH_BASES",
             "Se necesitan al menos dos bases hermanas para construir una base unificada.")
  }

  fuente <- .analitica_effective_source(s, cfg)
  excluidas <- .as_chr_vec(cfg$variables_excluidas)
  alias_var <- "base_hermana"
  origin_id_var <- "registro_origen_id"
  uid_var <- "registro_unificado_id"
  dfs_cod <- list()
  dfs_lab <- list()
  labels <- list(
    base_hermana = "Base hermana / carrera",
    registro_origen_id = "Identificador original del registro en su base",
    registro_unificado_id = "Identificador único del registro unificado"
  )
  labels_by_base <- list()
  bases_rows <- list()

  for (nombre in names(bases)) {
    pair <- .analitica_pair_for_base(s, bases[[nombre]], fuente, nombre)
    if (is.null(pair) && identical(fuente, "adaptados")) {
      pair <- .analitica_pair_for_base(s, bases[[nombre]], "originales", nombre)
    }
    if (is.null(pair)) {
      stop_api(409, "E_ANALITICA_SOURCE_MISSING",
        sprintf("No se pudo resolver el par XLSForm/Data para la base '%s'.", nombre))
    }
    parsed <- .analitica_read_pair(pair, bases[[nombre]])
    reviewed <- .analitica_apply_data_review(parsed$data, parsed$inst, cfg)
    rp_data <- .excluir_cols(reviewed$data, excluidas)
    rp_inst <- reviewed$inst
    if (multi_select == "dummy_01") rp_data <- .expand_multiselect(rp_data, rp_inst)

    alias <- .analitica_base_alias(bases[[nombre]], nombre)
    alias_col <- rep(alias, nrow(rp_data))
    attr(alias_col, "label") <- "Base hermana / carrera"
    origin_col_name <- .analitica_origin_id_col(rp_data)
    origin_col <- if (!is.null(origin_col_name) && origin_col_name %in% names(rp_data)) {
      as.character(rp_data[[origin_col_name]])
    } else {
      rep(NA_character_, nrow(rp_data))
    }
    origin_col[is.na(origin_col)] <- ""
    attr(origin_col, "label") <- "Identificador original del registro en su base"
    uid_prefix <- .analitica_base_id_slug(nombre)
    uid_col <- sprintf("%s_%06d", uid_prefix, seq_len(nrow(rp_data)))
    attr(uid_col, "label") <- "Identificador único del registro unificado"
    rp_data[[alias_var]] <- alias_col
    rp_data[[origin_id_var]] <- origin_col
    rp_data[[uid_var]] <- uid_col
    rp_data <- rp_data[, c(alias_var, origin_id_var, uid_var, setdiff(names(rp_data), c(alias_var, origin_id_var, uid_var))), drop = FALSE]

    for (col in names(rp_data)) {
      lab <- attr(rp_data[[col]], "label", exact = TRUE)
      if (!is.null(lab) && nzchar(as.character(lab)) && is.null(labels[[col]])) {
        labels[[col]] <- as.character(lab)
      }
      current_labels <- labels_by_base[[col]] %||% list()
      current_labels[[nombre]] <- as.character(lab %||% "")
      labels_by_base[[col]] <- current_labels
    }

    df_cod <- .aplicar_etiquetas(rp_data, rp_inst, valores = "codigos", multi_select = multi_select)
    df_lab <- .aplicar_etiquetas(rp_data, rp_inst, valores = "etiquetas", multi_select = multi_select)
    dfs_cod[[nombre]] <- df_cod
    dfs_lab[[nombre]] <- df_lab
    bases_rows[[length(bases_rows) + 1L]] <- data.frame(
      base_nombre = nombre,
      alias = alias,
      source_title = as.character((bases[[nombre]] %||% list())$source_title %||% ""),
      n_filas = as.integer(nrow(rp_data)),
      n_columnas = as.integer(ncol(rp_data)),
      stringsAsFactors = FALSE
    )
  }

  present_cols <- lapply(dfs_cod, names)
  union_cols <- unique(c(alias_var, origin_id_var, uid_var, unlist(present_cols, use.names = FALSE)))
  common_cols <- Reduce(intersect, present_cols)
  common_cols <- setdiff(common_cols, c(alias_var, origin_id_var, uid_var))
  omitted_cols <- setdiff(union_cols, c(alias_var, origin_id_var, uid_var, common_cols))

  common_df <- if (length(common_cols)) {
    do.call(rbind, lapply(common_cols, function(col) {
      labs <- labels_by_base[[col]] %||% list()
      labs_nonempty <- unique(as.character(unlist(labs, use.names = FALSE)))
      labs_nonempty <- labs_nonempty[nzchar(labs_nonempty)]
      data.frame(
        variable = col,
        label = as.character(labels[[col]] %||% ""),
        n_bases = as.integer(length(bases)),
        label_consistente = length(unique(labs_nonempty)) <= 1L,
        stringsAsFactors = FALSE
      )
    }))
  } else {
    data.frame(variable = character(), label = character(), n_bases = integer(),
               label_consistente = logical(), stringsAsFactors = FALSE)
  }

  omitted_df <- if (length(omitted_cols)) {
    do.call(rbind, lapply(omitted_cols, function(col) {
      present <- names(Filter(function(cols) col %in% cols, present_cols))
      missing <- setdiff(names(bases), present)
      data.frame(
        variable = col,
        label = as.character(labels[[col]] %||% ""),
        presente_en = paste(present, collapse = ", "),
        falta_en = paste(missing, collapse = ", "),
        n_bases_presentes = as.integer(length(present)),
        stringsAsFactors = FALSE
      )
    }))
  } else {
    data.frame(variable = character(), label = character(), presente_en = character(),
               falta_en = character(), n_bases_presentes = integer(),
               stringsAsFactors = FALSE)
  }
  bases_df <- do.call(rbind, bases_rows)

  aligned_cod <- .analitica_unified_align(dfs_cod, union_cols, labels)
  aligned_lab <- .analitica_unified_align(dfs_lab, union_cols, labels)
  df_cod <- do.call(rbind, aligned_cod)
  df_lab <- do.call(rbind, aligned_lab)
  rownames(df_cod) <- NULL
  rownames(df_lab) <- NULL
  for (col in intersect(names(labels), names(df_cod))) {
    lab <- labels[[col]] %||% NULL
    if (!is.null(lab) && nzchar(as.character(lab))) {
      attr(df_cod[[col]], "label") <- as.character(lab)
      if (col %in% names(df_lab)) attr(df_lab[[col]], "label") <- as.character(lab)
    }
  }

  out_name <- .export_filename(sid, "bases_unificadas", "xlsx")
  out_path <- .session_tmp(sid, sprintf("%s_%s", uuid::UUIDgenerate(), out_name))
  .analitica_write_unified_xlsx(df_cod, df_lab, common_df, omitted_df,
                                bases_df, out_path, valores = valores)
  meta <- .register_output_file(sid, "bases_unificadas", out_path, original_name = out_name)
  list(
    ok = TRUE,
    n_bases = length(bases),
    fuente = fuente,
    file_id = meta$file_id,
    filename = meta$original_name,
    size = meta$size,
    unified = list(
      alias_var = alias_var,
      origin_id_var = origin_id_var,
      unique_id_var = uid_var,
      n_filas = as.integer(nrow(df_cod)),
      n_columnas = as.integer(ncol(df_cod)),
      n_variables_comunes = as.integer(nrow(common_df)),
      n_variables_no_comunes = as.integer(nrow(omitted_df))
    )
  )
}

.secciones_desde_instrumento <- function(rp_inst) {
  survey <- rp_inst$survey
  if (is.null(survey) || !"name" %in% names(survey)) return(NULL)
  grupo <- if ("group_name" %in% names(survey)) {
    as.character(survey$group_name)
  } else if ("section" %in% names(survey)) {
    as.character(survey$section)
  } else {
    rep("general", nrow(survey))
  }
  grupo[is.na(grupo) | !nzchar(grupo)] <- "general"
  ok <- !is.na(survey$name) & nzchar(survey$name)
  tapply(survey$name[ok], grupo[ok], function(v) unique(v), simplify = FALSE) |>
    as.list()
}

# Walk survey$type en orden y construye secciones desde begin_group /
# end_group con etiqueta en español preferida (misma lógica que
# `.section_map` de router_codificacion.R pero devolviendo secciones
# en el shape que la UI consume: [{id, nombre, variables, orden}]).
# Preserva orden, soporta nesting (usamos el group más interno por var).
.detect_secciones_analitica <- function(rp_inst) {
  sv <- rp_inst$survey
  if (is.null(sv) || nrow(sv) == 0L || !"name" %in% names(sv)) return(list())

  # Label preference: survey_raw's label::Spanish si existe.
  label_raw <- rep("", nrow(sv))
  if (!is.null(rp_inst$survey_raw)) {
    lab_idx <- grep("^label", tolower(names(rp_inst$survey_raw)))
    if (length(lab_idx) > 0L) {
      sp_idx <- grep("spanish|español", tolower(names(rp_inst$survey_raw)[lab_idx]))
      pick <- if (length(sp_idx) > 0L) lab_idx[sp_idx[1]] else lab_idx[1]
      lab_col <- as.character(rp_inst$survey_raw[[pick]])
      if (length(lab_col) == nrow(sv)) label_raw <- lab_col
    }
  }
  if (all(label_raw == "") && "label" %in% names(sv)) label_raw <- as.character(sv$label)
  label_raw[is.na(label_raw)] <- ""
  Encoding(label_raw) <- "UTF-8"

  # Walk para asignar cada variable al group más interno (stack approach).
  stack_name <- character(0)
  stack_label <- character(0)
  seccion_orden <- list()   # id -> {nombre, variables, orden}
  orden_counter <- 0L

  for (i in seq_len(nrow(sv))) {
    t <- as.character(sv$type[i] %||% "")
    nm <- as.character(sv$name[i] %||% "")
    lb <- label_raw[i]
    if (t == "begin_group" || t == "begin_repeat") {
      stack_name <- c(stack_name, nm)
      stack_label <- c(stack_label, if (nzchar(lb)) lb else nm)
    } else if (t == "end_group" || t == "end_repeat") {
      if (length(stack_name) > 0L) {
        stack_name <- stack_name[-length(stack_name)]
        stack_label <- stack_label[-length(stack_label)]
      }
    } else if (nzchar(nm)) {
      # Variable data: asignarla al group más interno actual (o "general"
      # si estamos en top-level).
      seccion_id <- if (length(stack_name) > 0L) stack_name[length(stack_name)] else "general"
      seccion_lb <- if (length(stack_label) > 0L) stack_label[length(stack_label)] else "General"
      if (is.null(seccion_orden[[seccion_id]])) {
        orden_counter <- orden_counter + 1L
        seccion_orden[[seccion_id]] <- list(
          nombre = seccion_lb,
          variables = character(0),
          orden = orden_counter - 1L  # 0-indexed para frontend
        )
      }
      seccion_orden[[seccion_id]]$variables <- c(
        seccion_orden[[seccion_id]]$variables, nm
      )
    }
  }

  # Convertir a lista de secciones ordenadas por `orden`.
  if (length(seccion_orden) == 0L) return(list())
  ids <- names(seccion_orden)
  ordenes <- vapply(seccion_orden, function(x) as.integer(x$orden), integer(1))
  ids <- ids[order(ordenes)]
  lapply(ids, function(id) {
    s <- seccion_orden[[id]]
    list(
      id = id,
      nombre = s$nombre,
      variables = as.list(unique(s$variables)),
      oculto = FALSE,
      orden = as.integer(s$orden)
    )
  })
}

# Lista de variables del instrumento para alimentar dropdowns de la UI.
# Filtra filas que no son data (begin_group, end_group, note).
.variables_desde_instrumento <- function(rp_inst) {
  sv <- rp_inst$survey
  if (is.null(sv) || nrow(sv) == 0L || !"name" %in% names(sv)) return(list())
  label_raw <- rep("", nrow(sv))
  if (!is.null(rp_inst$survey_raw)) {
    lab_idx <- grep("^label", tolower(names(rp_inst$survey_raw)))
    if (length(lab_idx) > 0L) {
      sp_idx <- grep("spanish|español", tolower(names(rp_inst$survey_raw)[lab_idx]))
      pick <- if (length(sp_idx) > 0L) lab_idx[sp_idx[1]] else lab_idx[1]
      lab_col <- as.character(rp_inst$survey_raw[[pick]])
      if (length(lab_col) == nrow(sv)) label_raw <- lab_col
    }
  }
  if (all(label_raw == "") && "label" %in% names(sv)) label_raw <- as.character(sv$label)
  label_raw[is.na(label_raw)] <- ""
  Encoding(label_raw) <- "UTF-8"

  tipos <- as.character(sv$type %||% "")
  base_tipos <- sub("\\s.*$", "", tipos)
  list_names <- trimws(sub("^\\S+\\s*", "", tipos))

  keep <- !is.na(sv$name) & nzchar(sv$name) &
          !base_tipos %in% c("begin_group","end_group","begin_repeat","end_repeat","note","calculate","start","end","deviceid","today")
  idx <- which(keep)
  lapply(idx, function(i) {
    es_categorica <- base_tipos[i] %in% c("select_one", "select_multiple")
    es_numerica <- base_tipos[i] %in% c("integer", "decimal")
    list(
      name = as.character(sv$name[i]),
      label = label_raw[i],
      tipo = base_tipos[i],
      list_name = list_names[i],
      categorica = es_categorica,
      numerica = es_numerica,
      analisis = es_categorica || es_numerica
    )
  })
}

.analitica_catalogo <- function(rp_inst) {
  vars <- .variables_desde_instrumento(rp_inst)
  if (length(vars) == 0L) {
    return(data.frame(
      name = character(0), tipo = character(0),
      categorica = logical(0), numerica = logical(0),
      stringsAsFactors = FALSE
    ))
  }
  data.frame(
    name = vapply(vars, function(v) as.character(v$name %||% ""), character(1)),
    tipo = vapply(vars, function(v) as.character(v$tipo %||% ""), character(1)),
    categorica = vapply(vars, function(v) isTRUE(v$categorica), logical(1)),
    numerica = vapply(vars, function(v) isTRUE(v$numerica), logical(1)),
    stringsAsFactors = FALSE
  )
}

.analitica_declared_numericas <- function(cfg, override_frecuencias = TRUE) {
  fc <- cfg$frecuencias %||% list()
  global <- .as_chr_vec(cfg$numericas)
  if (isTRUE(override_frecuencias) && "numericas_override" %in% names(fc)) {
    return(unique(.as_chr_vec(fc$numericas_override)))
  }
  unique(c(global, .as_chr_vec(fc$numericas_override)))
}

.analitica_allowed_vars <- function(rp_inst, numericas = character(0)) {
  cat <- .analitica_catalogo(rp_inst)
  if (nrow(cat) == 0L) return(character(0))
  numericas_ok <- intersect(.as_chr_vec(numericas), cat$name[cat$numerica])
  unique(c(cat$name[cat$categorica], numericas_ok))
}

.analitica_filter_sections <- function(secs, rp_inst, numericas = character(0), excluidas = character(0)) {
  allowed <- .analitica_allowed_vars(rp_inst, numericas)
  allowed <- setdiff(allowed, .as_chr_vec(excluidas))
  if (length(allowed) == 0L) return(NULL)
  has_recod <- function(v, allowed_vars) {
    if (is.na(v) || !nzchar(v)) return(NA_character_)
    recod <- paste0(v, "_recod")
    if (recod %in% allowed_vars) return(recod)
    NA_character_
  }
  if (is.null(secs) || !is.list(secs) || length(secs) == 0L) {
    secs <- .secciones_desde_instrumento(rp_inst)
  }
  if (is.null(secs) || !is.list(secs) || length(secs) == 0L) return(NULL)
  secs <- lapply(secs, function(v) {
    vars <- as.character(v)
    out <- character(0)
    for (var in vars) {
      if (is.na(var) || identical(var, "")) next
      if (var %in% allowed) {
        out <- c(out, var)
      } else {
        recod <- has_recod(var, allowed)
        if (!is.na(recod)) out <- c(out, recod)
      }
    }
    unique(out)
  })
  secs <- secs[vapply(secs, length, integer(1)) > 0L]
  if (length(secs) == 0L) return(NULL)
  secs
}

.analitica_filter_data <- function(data, rp_inst, numericas = character(0), excluidas = character(0)) {
  allowed <- .analitica_allowed_vars(rp_inst, numericas)
  keep <- setdiff(intersect(names(data), allowed), .as_chr_vec(excluidas))
  out <- data[, keep, drop = FALSE]
  for (nm in setdiff(names(attributes(data)), c("names","row.names","class"))) {
    attr(out, nm) <- attr(data, nm)
  }
  out
}

.analitica_categoricas <- function(rp_inst) {
  cat <- .analitica_catalogo(rp_inst)
  if (nrow(cat) == 0L) return(character(0))
  cat$name[cat$categorica]
}

.analitica_has_structural_cols <- function(data) {
  if (!is.data.frame(data) || !length(names(data))) return(FALSE)
  any(grepl("^Pag[0-9]+$", names(data))) ||
    any(grepl("^(nota|note)_", names(data), ignore.case = TRUE))
}

.analitica_context_usable <- function(data, inst) {
  basic_ok <- is.data.frame(data) &&
    ncol(data) > 0L &&
    length(.variables_desde_instrumento(inst)) > 0L &&
    !.analitica_has_structural_cols(data)
  if (!isTRUE(basic_ok)) return(FALSE)

  compat <- attr(data, "xlsform_compatibility", exact = TRUE)
  if (!is.null(compat) && !isTRUE(compat$ok)) {
    missing_prev <- compat$missing_columns %||% compat$missing_variables %||% character(0)
    if (!.analitica_missing_ok_as_sm_dummies(data, inst, missing_prev)) return(FALSE)
  }

  compat_now <- tryCatch(
    validate_data_xlsform_compatibility(data, inst),
    error = function(e) NULL
  )
  if (is.null(compat_now) || isTRUE(compat_now$ok)) return(TRUE)
  .analitica_missing_ok_as_sm_dummies(
    data,
    inst,
    compat_now$missing_columns %||% compat_now$missing_variables %||% character(0)
  )
}

.analitica_sources_usable <- function(data_sources, inst_sources) {
  if (!length(data_sources) || !length(inst_sources)) return(FALSE)
  if (length(setdiff(names(data_sources), names(inst_sources))) > 0L) return(FALSE)
  all(vapply(names(data_sources), function(nm) {
    .analitica_context_usable(data_sources[[nm]], inst_sources[[nm]])
  }, logical(1)))
}

.analitica_missing_ok_as_sm_dummies <- function(data, inst, missing) {
  missing <- as.character(missing %||% character(0))
  missing <- missing[!is.na(missing) & nzchar(missing)]
  if (!length(missing)) return(TRUE)
  if (!is.data.frame(data) || is.null(inst$survey) || !is.data.frame(inst$survey)) {
    return(FALSE)
  }
  survey <- inst$survey
  if (!all(c("name", "type") %in% names(survey))) return(FALSE)
  names_s <- as.character(survey$name %||% character(0))
  type_base <- .analitica_type_base(survey$type)
  sm_vars <- names_s[type_base == "select_multiple"]
  sm_vars <- sm_vars[!is.na(sm_vars) & nzchar(sm_vars)]
  all(vapply(missing, function(v) {
    v %in% sm_vars && (
      any(startsWith(names(data), paste0(v, "/"))) ||
        any(grepl(paste0("^", gsub("([\\W])", "\\\\\\1", v), "\\.[^\\.]+$"), names(data), perl = TRUE))
    )
  }, logical(1)))
}

.analitica_cached_source_matches <- function(s, fuente) {
  actual <- as.character((s %||% list())$analitica_fuente %||% "")
  nzchar(actual) && identical(actual, as.character(fuente %||% ""))
}

.analitica_source_cache_key <- function(sid, fuente) {
  key <- as.character(fuente %||% "")
  if (exists("estudio_is_independent_siblings", mode = "function") &&
      estudio_is_independent_siblings(sid)) {
    active <- if (exists("estudio_active_base", mode = "function")) estudio_active_base(sid) else NULL
    key <- paste(key, as.character(active %||% ""), sep = ":")
  }
  key
}

.analitica_active_export_base <- function(sid) {
  if (exists("estudio_is_independent_siblings", mode = "function") &&
      estudio_is_independent_siblings(sid) &&
      exists("estudio_active_base", mode = "function")) {
    active <- estudio_active_base(sid)
    if (!is.null(active) && nzchar(active)) return(active)
  }
  NULL
}

.analitica_export_filename <- function(sid, label, ext, base = NULL) {
  base <- base %||% .analitica_active_export_base(sid)
  .export_filename(sid, label, ext, base = base)
}

.analitica_repair_project_context <- function(sid) {
  changed <- FALSE
  if (exists(".pulso_repair_multibase_variant_xlsforms", mode = "function")) {
    changed <- isTRUE(tryCatch(
      .pulso_repair_multibase_variant_xlsforms(sid),
      error = function(e) FALSE
    ))
  }
  if (exists(".pulso_repair_parent_recod_columns", mode = "function")) {
    changed <- isTRUE(changed || tryCatch(
      .pulso_repair_parent_recod_columns(sid),
      error = function(e) FALSE
    ))
  }
  if (isTRUE(changed) && exists(".pulso_renormalize_after_load", mode = "function")) {
    tryCatch(.pulso_renormalize_after_load(sid), error = function(e) NULL)
  }
  invisible(isTRUE(changed))
}

.analitica_prepare_and_cache <- function(sid) {
  .analitica_repair_project_context(sid)
  cfg <- .analitica_get_config(sid)
  ctx <- .analitica_prepare_context(sid, cfg)
  session_set(sid, "analitica_rp_inst", ctx$rp_inst)
  session_set(sid, "analitica_rp_data", ctx$rp_data)
  session_set(sid, "analitica_rp_inst_sources", ctx$inst_sources)
  session_set(sid, "analitica_rp_data_sources", ctx$data_sources)
  .analitica_status_set(sid, "analitica_prep_ok", TRUE)
  session_set(sid, "analitica_fuente", .analitica_source_cache_key(sid, ctx$fuente))
  ctx
}

.load_rp_data <- function(sid) {
  .analitica_repair_project_context(sid)
  s <- session_get(sid)
  cfg <- .analitica_get_config(sid)
  fuente <- .analitica_effective_source(s, cfg)
  cache_matches <- .analitica_cached_source_matches(s, .analitica_source_cache_key(sid, fuente))
  if (!is.null(s$analitica_rp_data) && !is.null(s$analitica_rp_inst) &&
      isTRUE(cache_matches) &&
      .analitica_context_usable(s$analitica_rp_data, s$analitica_rp_inst)) {
    base_meta <- .analitica_single_base_meta(sid)
    rp_inst <- .analitica_apply_integrated_key(s$analitica_rp_inst, base_meta)
    return(list(
      rp_inst = rp_inst,
      rp_data = .analitica_apply_integrated_key_to_data(s$analitica_rp_data, rp_inst, base_meta)
    ))
  }
  bases <- (s$estudio %||% list())$bases %||% list()
  can_use_base_cache <- !length(bases) && !isTRUE(s$codif_aplicado)
  if (isTRUE(can_use_base_cache) &&
      !is.null(s$rp_data) && !is.null(s$rp_inst) &&
      .analitica_context_usable(s$rp_data, s$rp_inst)) {
    base_meta <- .analitica_single_base_meta(sid)
    rp_inst <- .analitica_apply_integrated_key(s$rp_inst, base_meta)
    return(list(
      rp_inst = rp_inst,
      rp_data = .analitica_apply_integrated_key_to_data(s$rp_data, rp_inst, base_meta)
    ))
  }
  prepared <- tryCatch(.analitica_prepare_and_cache(sid), error = function(e) NULL)
  if (!is.null(prepared)) {
    return(list(rp_inst = prepared$rp_inst, rp_data = prepared$rp_data))
  }
  stop_api(409, "E_ANALITICA_NO_PREP", "Primero corre el Paso 1 (Preparar datos para reporte).")
}

.load_rp_sources <- function(sid) {
  .analitica_repair_project_context(sid)
  s <- session_get(sid, required = FALSE)
  cfg <- .analitica_get_config(sid)
  fuente <- .analitica_effective_source(s, cfg)
  cache_matches <- .analitica_cached_source_matches(s, .analitica_source_cache_key(sid, fuente))
  data_sources <- if (isTRUE(cache_matches) &&
                      !is.null(s$analitica_rp_data_sources) &&
                      length(s$analitica_rp_data_sources) > 0L) {
    s$analitica_rp_data_sources
  } else {
    list()
  }
  inst_sources <- if (isTRUE(cache_matches) &&
                      !is.null(s$analitica_rp_inst_sources) &&
                      length(s$analitica_rp_inst_sources) > 0L) {
    s$analitica_rp_inst_sources
  } else {
    list()
  }
  if (!.analitica_sources_usable(data_sources, inst_sources)) {
    prepared <- tryCatch(.analitica_prepare_and_cache(sid), error = function(e) NULL)
    if (!is.null(prepared)) {
      data_sources <- prepared$data_sources
      inst_sources <- prepared$inst_sources
    }
  }
  if (length(data_sources) == 0L) {
    stop_api(409, "E_NO_RP_DATA",
      "El estudio no tiene base analítica preparada. Reingresa a Analítica para preparar la fuente activa.")
  }
  missing_inst <- setdiff(names(data_sources), names(inst_sources))
  if (length(missing_inst) > 0L) {
    stop_api(409, "E_NO_RP_INST",
      sprintf("Falta el XLSForm analítico para: %s.", paste(missing_inst, collapse = ", ")))
  }
  inst_sources <- .analitica_patch_inst_sources_integrated(sid, inst_sources[names(data_sources)])
  data_sources <- .analitica_patch_data_sources_integrated(sid, data_sources, inst_sources)
  list(data_sources = data_sources, inst_sources = inst_sources)
}

.zip_files <- function(zip_path, files, names_in_zip = NULL) {
  names_in_zip <- names_in_zip %||% basename(files)
  old <- getwd()
  td <- tempfile()
  dir.create(td)
  on.exit({ setwd(old); unlink(td, recursive = TRUE) }, add = TRUE)
  for (i in seq_along(files)) file.copy(files[i], file.path(td, names_in_zip[i]))
  setwd(td)
  zip::zip(zip_path, files = names_in_zip)
  zip_path
}

.analitica_scoped_base <- function(sid) {
  if (exists("estudio_is_independent_siblings", mode = "function") &&
      estudio_is_independent_siblings(sid) &&
      exists("estudio_active_base", mode = "function")) {
    active <- as.character(estudio_active_base(sid) %||% "")
    if (nzchar(active)) return(active)
  }
  ""
}

.analitica_config_get <- function(sid, s = NULL) {
  s <- s %||% session_get(sid, required = FALSE)
  if (is.null(s)) return(.analitica_default_config())
  active <- .analitica_scoped_base(sid)
  if (nzchar(active)) {
    configs <- s$analitica_config_por_base
    if (is.list(configs) && !is.null(configs[[active]])) {
      return(configs[[active]])
    }
    # Migracion conservadora: si el proyecto tenia una unica config
    # analitica global, se asigna solo a la base activa inicial.
    if ((is.null(configs) || length(configs) == 0L) && !is.null(s$analitica_config)) {
      configs <- list()
      configs[[active]] <- s$analitica_config
      session_set(sid, "analitica_config_por_base", configs)
      return(s$analitica_config)
    }
    return(.analitica_default_config())
  }
  s$analitica_config %||% .analitica_default_config()
}

.analitica_config_set <- function(sid, cfg) {
  active <- .analitica_scoped_base(sid)
  if (nzchar(active)) {
    s <- session_get(sid)
    configs <- s$analitica_config_por_base
    if (is.null(configs) || !is.list(configs)) configs <- list()
    configs[[active]] <- cfg
    session_set(sid, "analitica_config_por_base", configs)
    return(invisible(cfg))
  }
  session_set(sid, "analitica_config", cfg)
  invisible(cfg)
}

.analitica_status_set <- function(sid, key, value = TRUE) {
  session_set(sid, key, value)
  active <- .analitica_scoped_base(sid)
  if (!nzchar(active)) return(invisible(value))
  s <- session_get(sid)
  statuses <- s$analitica_status_por_base
  if (is.null(statuses) || !is.list(statuses)) statuses <- list()
  current <- statuses[[active]]
  if (is.null(current) || !is.list(current)) current <- list()
  current[[key]] <- value
  statuses[[active]] <- current
  session_set(sid, "analitica_status_por_base", statuses)
  invisible(value)
}

# Lee la sub-configuracion analitica_config de la sesión (store del
# frontend autosaveado). En hermanos independientes apunta a la base activa.
.analitica_get_config <- function(sid) {
  .analitica_config_get(sid)
}

# Traduce las secciones del store (lista de {id, nombre, variables,
# oculto, orden}) a la forma que reporte_frecuencias/cruces
# espera: lista nombrada `list(Nombre1 = c("v1","v2"), ...)`.
# Respeta `oculto` y `secciones_activas` (si se pasa un filtro).
.secciones_from_config <- function(cfg, activas_filter = NULL) {
  secs <- cfg$secciones %||% list()
  if (length(secs) == 0L) return(NULL)
  out <- list()
  # Preservar orden según `orden` si está presente.
  ord <- vapply(secs, function(s) as.integer(s$orden %||% 0L), integer(1))
  secs <- secs[order(ord)]
  for (s in secs) {
    id <- as.character(s$id %||% "")
    if (!nzchar(id)) next
    if (isTRUE(s$oculto)) next
    if (!is.null(activas_filter) && length(activas_filter) > 0L &&
        !id %in% activas_filter) next
    nombre <- as.character(s$nombre %||% id)
    vars <- unlist(s$variables %||% list())
    vars <- as.character(vars)
    vars <- vars[!is.na(vars) & nzchar(vars)]
    if (length(vars) == 0L) next
    # En caso improbable de colisión de nombres, desambiguar con id.
    key <- nombre
    if (key %in% names(out)) key <- paste0(nombre, " (", id, ")")
    out[[key]] <- unique(vars)
  }
  if (length(out) == 0L) return(NULL)
  out
}

# Extrae un vector character de un list/vector JSON. Util para cruces_vars,
# cols_corte, codigos_solo_si_presentes, etc. — jsonlite devuelve list()
# para arrays vacíos y simplifyVector=FALSE mantiene list-of-string.
.as_chr_vec <- function(x) {
  if (is.null(x)) return(character(0))
  v <- unlist(x, use.names = FALSE)
  if (is.null(v)) return(character(0))
  out <- as.character(v)
  out[!is.na(out) & nzchar(out)]
}

.as_int_vec <- function(x) {
  if (is.null(x)) return(integer(0))
  v <- unlist(x, use.names = FALSE)
  if (is.null(v)) return(integer(0))
  suppressWarnings(as.integer(v))
}

# Filtra columnas del data frame según lista de nombres a excluir.
# Preserva atributos de nivel top del data frame (importante para
# haven_labelled / reporte_data). Ignora silenciosamente nombres que
# no existen.
.excluir_cols <- function(data, excluidas) {
  if (length(excluidas) == 0L) return(data)
  drop <- intersect(as.character(excluidas), names(data))
  if (length(drop) == 0L) return(data)
  keep <- setdiff(names(data), drop)
  out <- data[, keep, drop = FALSE]
  # Preserva atributos top-level (instrumento_reporte, etc.)
  for (nm in setdiff(names(attributes(data)), c("names","row.names","class"))) {
    attr(out, nm) <- attr(data, nm)
  }
  out
}

.analitica_named_chr_map <- function(x) {
  if (is.null(x) || !is.list(x) || is.null(names(x))) return(list())
  out <- list()
  for (nm in names(x)) {
    if (is.na(nm) || !nzchar(nm)) next
    val <- as.character(x[[nm]] %||% "")
    if (!length(val) || is.na(val[1]) || !nzchar(trimws(val[1]))) next
    out[[nm]] <- enc2utf8(trimws(val[1]))
  }
  out
}

.analitica_datos_config <- function(cfg) {
  datos <- cfg$datos %||% list()
  list(
    variable_labels = .analitica_named_chr_map(datos$variable_labels),
    value_labels = if (is.list(datos$value_labels)) datos$value_labels else list()
  )
}

.analitica_label_map_from_attr <- function(col) {
  labs <- attr(col, "labels", exact = TRUE)
  if (is.null(labs) || !length(labs)) return(stats::setNames(character(0), character(0)))
  nms <- names(labs)
  vals <- as.character(unname(labs))
  if (is.null(nms)) return(stats::setNames(vals, vals))
  nms <- as.character(nms)
  vals_num <- suppressWarnings(as.numeric(vals))
  nms_num <- suppressWarnings(as.numeric(nms))
  if (all(!is.na(vals_num))) return(stats::setNames(nms, vals))
  if (all(!is.na(nms_num))) return(stats::setNames(vals, nms))
  stats::setNames(vals, nms)
}

.analitica_survey_row <- function(rp_inst, var) {
  sv <- rp_inst$survey
  if (is.null(sv) || !"name" %in% names(sv)) return(NA_integer_)
  which(as.character(sv$name) == as.character(var))[1]
}

.analitica_list_name_for_var <- function(rp_inst, var) {
  i <- .analitica_survey_row(rp_inst, var)
  if (is.na(i)) return("")
  sv <- rp_inst$survey
  ln <- if ("list_name" %in% names(sv)) as.character(sv$list_name[i] %||% "") else ""
  if (!nzchar(ln) && "type" %in% names(sv)) {
    type <- trimws(as.character(sv$type[i] %||% ""))
    if (grepl("^select_(one|multiple)\\b", type)) {
      m <- regmatches(type, regexec("^select_(?:one|multiple)\\s+(\\S+)", type, perl = TRUE))[[1]]
      ln <- if (length(m) >= 2L) m[2] else ""
    }
  }
  ln
}

.analitica_apply_data_review <- function(rp_data, rp_inst, cfg) {
  datos <- .analitica_datos_config(cfg)
  data <- rp_data
  inst <- rp_inst

  for (var in names(datos$variable_labels)) {
    label <- datos$variable_labels[[var]]
    if (var %in% names(data)) attr(data[[var]], "label") <- label
    if (!is.null(inst$var_labels)) inst$var_labels[var] <- label
    i <- .analitica_survey_row(inst, var)
    if (!is.na(i) && "label" %in% names(inst$survey)) inst$survey$label[i] <- label
    if (!is.null(inst$survey_raw) && "name" %in% names(inst$survey_raw)) {
      raw_i <- which(as.character(inst$survey_raw$name) == as.character(var))[1]
      if (!is.na(raw_i)) {
        lab_cols <- grep("^label", tolower(names(inst$survey_raw)), value = TRUE)
        for (col in lab_cols) inst$survey_raw[[col]][raw_i] <- label
      }
    }
    if (!is.null(inst$orders_list) && !is.null(inst$orders_list[[var]])) {
      inst$orders_list[[var]]$label <- label
      inst$orders_list[[var]]$var_label <- label
    }
  }

  if (is.list(datos$value_labels) && length(datos$value_labels) > 0L) {
    for (var in names(datos$value_labels)) {
      overrides <- .analitica_named_chr_map(datos$value_labels[[var]])
      if (!length(overrides)) next

      if (var %in% names(data)) {
        current <- .analitica_label_map_from_attr(data[[var]])
        for (code in names(overrides)) current[code] <- overrides[[code]]
        attr(data[[var]], "labels") <- stats::setNames(as.character(current), names(current))
      }

      ln <- .analitica_list_name_for_var(inst, var)
      if (nzchar(ln)) {
        if (!is.null(inst$choices) && all(c("list_name", "name") %in% names(inst$choices))) {
          for (code in names(overrides)) {
            rows <- which(as.character(inst$choices$list_name) == ln & as.character(inst$choices$name) == code)
            if (length(rows) && "label" %in% names(inst$choices)) inst$choices$label[rows] <- overrides[[code]]
          }
        }
        if (!is.null(inst$choices_raw) && all(c("list_name", "name") %in% names(inst$choices_raw))) {
          label_cols <- grep("^label", tolower(names(inst$choices_raw)), value = TRUE)
          for (code in names(overrides)) {
            rows <- which(as.character(inst$choices_raw$list_name) == ln & as.character(inst$choices_raw$name) == code)
            for (col in label_cols) if (length(rows)) inst$choices_raw[[col]][rows] <- overrides[[code]]
          }
        }
        if (!is.null(inst$dicc_code_to_label) && !is.null(inst$dicc_code_to_label[[ln]])) {
          for (code in names(overrides)) inst$dicc_code_to_label[[ln]][code] <- overrides[[code]]
        }
        if (!is.null(inst$dicc_label_to_code) && !is.null(inst$dicc_code_to_label[[ln]])) {
          inst$dicc_label_to_code[[ln]] <- stats::setNames(
            names(inst$dicc_code_to_label[[ln]]),
            as.character(unname(inst$dicc_code_to_label[[ln]]))
          )
        }
      }

      if (!is.null(inst$orders_list) && !is.null(inst$orders_list[[var]])) {
        ord <- inst$orders_list[[var]]
        if (!is.null(ord$names) && !is.null(ord$labels)) {
          labels <- as.character(ord$labels)
          for (code in names(overrides)) {
            hit <- which(as.character(ord$names) == code)
            if (length(hit)) labels[hit] <- overrides[[code]]
          }
          inst$orders_list[[var]]$labels <- labels
        }
      }
    }
  }

  dummy_lookup <- .analitica_select_multiple_dummy_lookup(data, inst)
  if (length(dummy_lookup)) {
    for (col in names(dummy_lookup)) {
      if (!col %in% names(data)) next
      meta <- dummy_lookup[[col]]
      opt_label <- as.character(meta$dummy_option_label %||% "")
      if (nzchar(opt_label)) attr(data[[col]], "label") <- opt_label
    }
  }

  list(data = data, inst = inst)
}

.analitica_clean_dummy_name <- function(x) {
  base <- gsub("/", ".", as.character(x))
  base <- iconv(base, from = "", to = "ASCII//TRANSLIT")
  base <- tolower(base)
  base <- gsub(" ", ".", base)
  base <- gsub("[^a-z0-9._]", "_", base)
  base <- gsub("_+", "_", base)
  base <- gsub("\\.+", ".", base)
  gsub("^[_\\.]+|[_\\.]+$", "", base)
}

.analitica_slug_dummy_code <- function(x) {
  out <- iconv(as.character(x), from = "", to = "ASCII//TRANSLIT", sub = "")
  out <- tolower(out)
  out <- gsub("[^a-z0-9]+", "_", out)
  out <- gsub("^_+|_+$", "", out)
  out[!nzchar(out)] <- "na"
  out
}

.analitica_find_dummy_col <- function(data_names, parent, code) {
  parent <- as.character(parent %||% "")
  code <- as.character(code %||% "")
  if (!nzchar(parent) || !nzchar(code) || !length(data_names)) return(NA_character_)
  candidates <- unique(c(
    .analitica_clean_dummy_name(paste0(parent, "/", code)),
    .analitica_clean_dummy_name(paste0(parent, ".", code)),
    paste0(parent, "___", .analitica_slug_dummy_code(code)),
    paste0(tolower(parent), "___", .analitica_slug_dummy_code(code))
  ))
  hit <- intersect(candidates, data_names)[1] %||% NA_character_
  if (!is.na(hit) && nzchar(hit)) return(hit)
  data_lower <- stats::setNames(data_names, tolower(data_names))
  hit_lower <- intersect(tolower(candidates), names(data_lower))[1] %||% NA_character_
  if (!is.na(hit_lower) && nzchar(hit_lower)) return(unname(data_lower[[hit_lower]]))
  NA_character_
}

.analitica_var_label <- function(inst, var) {
  var <- as.character(var %||% "")
  if (!nzchar(var)) return("")
  if (!is.null(inst$var_labels) && var %in% names(inst$var_labels)) {
    lab <- as.character(inst$var_labels[[var]])
    if (nzchar(lab)) return(lab)
  }
  i <- .analitica_survey_row(inst, var)
  if (!is.na(i) && !is.null(inst$survey) && "label" %in% names(inst$survey)) {
    lab <- as.character(inst$survey$label[i] %||% "")
    if (!is.na(lab) && nzchar(lab)) return(lab)
  }
  var
}

.analitica_select_multiple_dummy_lookup <- function(data, inst) {
  sv <- inst$survey %||% NULL
  if (is.null(sv) || !nrow(sv) || !all(c("name", "type") %in% names(sv))) return(list())
  data_names <- names(data)
  if (!length(data_names)) return(list())
  tipos <- as.character(sv$type %||% "")
  sm_idx <- which(grepl("^select_multiple(\\s|$)", tipos, perl = TRUE))
  if (!length(sm_idx)) return(list())

  out <- list()
  for (i in sm_idx) {
    parent <- as.character(sv$name[i] %||% "")
    if (!nzchar(parent)) next
    list_name <- .analitica_list_name_for_var(inst, parent)
    choices <- if (nzchar(list_name)) {
      .choices_desde_instrumento(inst, list_name)
    } else {
      data.frame(name = character(0), label = character(0), stringsAsFactors = FALSE)
    }
    if (!nrow(choices)) next
    parent_label <- .analitica_var_label(inst, parent)
    for (j in seq_len(nrow(choices))) {
      code <- as.character(choices$name[j] %||% "")
      if (!nzchar(code)) next
      col <- .analitica_find_dummy_col(data_names, parent, code)
      if (is.na(col) || !nzchar(col) || !col %in% data_names) next
      option_label <- as.character(choices$label[j] %||% "")
      if (!nzchar(option_label)) {
        option_label <- as.character(attr(data[[col]], "label", exact = TRUE) %||% code)
      }
      out[[col]] <- list(
        dummy_parent = parent,
        dummy_parent_label = parent_label,
        dummy_option_code = code,
        dummy_option_label = option_label
      )
    }
  }
  out
}

.analitica_data_review_payload <- function(rp_data, rp_inst, cfg) {
  reviewed <- .analitica_apply_data_review(rp_data, rp_inst, cfg)
  data <- reviewed$data
  inst <- reviewed$inst
  dummy_lookup <- .analitica_select_multiple_dummy_lookup(data, inst)
  vars <- .variables_desde_instrumento(inst)
  by_name <- list()
  for (v in vars) by_name[[as.character(v$name %||% "")]] <- v

  secs <- .detect_secciones_analitica(inst)
  section_by_var <- list()
  for (sec in secs) {
    vars_sec <- .as_chr_vec(sec$variables)
    for (v in vars_sec) section_by_var[[v]] <- as.character(sec$nombre %||% "General")
  }

  cfg_excluidas <- .as_chr_vec(cfg$variables_excluidas)
  known_extra_cols <- c(
    "survey_id", "collector_id", "respondent_id", "response_id", "case_uid",
    "source_title", "response_status", "collection_mode", "date_created",
    "date_modified", "empresa_source_code", "empresa_source_label", "empresa_uid"
  )
  var_names <- vapply(vars, function(v) as.character(v$name %||% ""), character(1))
  data_extra <- setdiff(names(data), c(var_names, names(dummy_lookup)))
  data_extra <- data_extra[!data_extra %in% known_extra_cols]
  data_extra <- data_extra[!grepl("^Pag[0-9]+$", data_extra)]
  data_extra <- data_extra[!grepl("^(nota|note)_", data_extra, ignore.case = TRUE)]
  data_extra <- data_extra[vapply(data_extra, function(nm) {
    col <- data[[nm]]
    any(!is.na(col) & nzchar(as.character(col)))
  }, logical(1))]
  all_names <- unique(c(var_names, names(dummy_lookup), data_extra))
  all_names <- all_names[nzchar(all_names)]
  lapply(all_names, function(nm) {
    col <- if (nm %in% names(data)) data[[nm]] else NULL
    dummy_meta <- dummy_lookup[[nm]] %||% NULL
    vmeta <- by_name[[nm]] %||% list(name = nm, label = "", tipo = "", list_name = "")
    original_label <- if (!is.null(col)) attr(col, "label", exact = TRUE) %||% "" else ""
    if (!is.null(dummy_meta) && !nzchar(as.character(original_label))) {
      original_label <- as.character(dummy_meta$dummy_option_label %||% "")
    }
    if (!nzchar(as.character(original_label))) original_label <- as.character(vmeta$label %||% "")
    if (!nzchar(original_label)) original_label <- nm
    tipo_xlsform <- as.character(vmeta$tipo %||% "")
    if (!nzchar(tipo_xlsform) && !is.null(dummy_meta)) tipo_xlsform <- "dummy_select_multiple"
    is_select_one <- grepl("^select_one(\\s|$)", tipo_xlsform)
    is_select_multiple <- grepl("^select_multiple(\\s|$)", tipo_xlsform)
    map <- if ((is_select_one || is_select_multiple) && !is.null(col)) {
      .analitica_label_map_from_attr(col)
    } else {
      stats::setNames(character(0), character(0))
    }
    counts <- if ((is_select_one || is_select_multiple) && !is.null(col)) {
      vals <- as.character(col)
      vals <- vals[!is.na(vals) & nzchar(vals)]
      if (is_select_multiple) {
        vals <- unlist(strsplit(vals, "\\s+"), use.names = FALSE)
        vals <- vals[nzchar(vals)]
      }
      table(vals, useNA = "no")
    } else integer(0)
    codes <- if (is_select_one || is_select_multiple) unique(c(names(map), names(counts))) else character(0)
    opts <- lapply(codes, function(code) {
      count <- if (code %in% names(counts)) as.integer(counts[[code]]) else 0L
      label <- if (code %in% names(map)) as.character(map[[code]]) else ""
      list(
        code = as.character(code),
        label = label,
        count = count
      )
    })
    if (length(opts) > 80L) {
      opts_present <- Filter(function(opt) isTRUE(as.integer(opt$count %||% 0L) > 0L), opts)
      opts <- if (length(opts_present) > 0L) opts_present else utils::head(opts, 80L)
    }
    list(
      name = nm,
      tipo_xlsform = tipo_xlsform,
      seccion = as.character(
        if (!is.null(dummy_meta)) {
          section_by_var[[as.character(dummy_meta$dummy_parent %||% "")]] %||% "General"
        } else {
          section_by_var[[nm]] %||% "General"
        }
      ),
      included = !nm %in% cfg_excluidas,
      label_actual = as.character(attr(col, "label", exact = TRUE) %||% original_label),
      label_original = as.character(original_label),
      n_non_missing = if (!is.null(col)) as.integer(sum(!is.na(col) & nzchar(as.character(col)))) else 0L,
      n_missing = if (!is.null(col)) as.integer(sum(is.na(col) | !nzchar(as.character(col)))) else 0L,
      opciones = opts,
      dummy_parent = if (!is.null(dummy_meta)) as.character(dummy_meta$dummy_parent %||% "") else NA_character_,
      dummy_parent_label = if (!is.null(dummy_meta)) as.character(dummy_meta$dummy_parent_label %||% "") else NA_character_,
      dummy_option_code = if (!is.null(dummy_meta)) as.character(dummy_meta$dummy_option_code %||% "") else NA_character_,
      dummy_option_label = if (!is.null(dummy_meta)) as.character(dummy_meta$dummy_option_label %||% "") else NA_character_
    )
  })
}

.analitica_xlsform_sheet_df <- function(x, fallback_cols = character(0)) {
  if (is.null(x)) {
    if (length(fallback_cols) == 0L) return(data.frame())
    return(as.data.frame(stats::setNames(rep(list(character(0)), length(fallback_cols)), fallback_cols), stringsAsFactors = FALSE))
  }
  df <- as.data.frame(x, stringsAsFactors = FALSE)
  if (ncol(df) == 0L && length(fallback_cols) > 0L) {
    for (col in fallback_cols) df[[col]] <- character(0)
  }
  for (col in names(df)) {
    if (is.list(df[[col]])) {
      df[[col]] <- vapply(df[[col]], function(v) {
        if (is.null(v)) return("")
        if (length(v) == 1L) return(as.character(v))
        jsonlite::toJSON(v, auto_unbox = TRUE, null = "null")
      }, character(1))
    } else {
      df[[col]] <- as.character(df[[col]])
      df[[col]][is.na(df[[col]])] <- ""
    }
  }
  df
}

.analitica_survey_list_names <- function(survey) {
  if (is.null(survey) || nrow(survey) == 0L) return(character(0))
  out <- character(0)
  if ("list_name" %in% names(survey)) {
    out <- c(out, as.character(survey$list_name))
  }
  if ("type" %in% names(survey)) {
    type <- trimws(as.character(survey$type))
    hit <- grepl("^select_(one|multiple)\\s+", type)
    parsed <- vapply(type[hit], function(tp) {
      m <- regmatches(tp, regexec("^select_(?:one|multiple)\\s+(\\S+)", tp, perl = TRUE))[[1]]
      if (length(m) >= 2L) m[2] else ""
    }, character(1))
    out <- c(out, parsed)
  }
  unique(out[!is.na(out) & nzchar(out)])
}

.analitica_filter_xlsform_inst <- function(rp_inst, excluidas = character(0)) {
  excluidas <- .as_chr_vec(excluidas)
  if (length(excluidas) == 0L) return(rp_inst)
  inst <- rp_inst

  filter_survey <- function(df) {
    if (is.null(df) || !"name" %in% names(df)) return(df)
    df[!as.character(df$name) %in% excluidas, , drop = FALSE]
  }
  inst$survey <- filter_survey(inst$survey)
  inst$survey_raw <- filter_survey(inst$survey_raw)

  used_lists <- unique(c(
    .analitica_survey_list_names(inst$survey),
    .analitica_survey_list_names(inst$survey_raw)
  ))
  filter_choices <- function(df) {
    if (is.null(df) || !"list_name" %in% names(df)) return(df)
    if (length(used_lists) == 0L) return(df[0, , drop = FALSE])
    df[as.character(df$list_name) %in% used_lists, , drop = FALSE]
  }
  inst$choices <- filter_choices(inst$choices)
  inst$choices_raw <- filter_choices(inst$choices_raw)

  if (!is.null(inst$var_labels)) inst$var_labels <- inst$var_labels[setdiff(names(inst$var_labels), excluidas)]
  if (!is.null(inst$orders_list) && length(inst$orders_list) > 0L) {
    inst$orders_list <- inst$orders_list[setdiff(names(inst$orders_list), excluidas)]
  }
  inst
}

.analitica_write_final_xlsform <- function(rp_inst, path) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop("El paquete 'openxlsx' es necesario para exportar el XLSForm final.", call. = FALSE)
  }
  survey <- .analitica_xlsform_sheet_df(rp_inst$survey_raw %||% rp_inst$survey, c("type", "name", "label"))
  choices <- .analitica_xlsform_sheet_df(rp_inst$choices_raw %||% rp_inst$choices, c("list_name", "name", "label"))
  settings <- .analitica_xlsform_sheet_df(rp_inst$settings, c("form_title", "form_id"))

  wb <- openxlsx::createWorkbook(creator = "prosecnur")
  header_style <- openxlsx::createStyle(textDecoration = "bold", fgFill = "#E8EAED")
  text_style <- openxlsx::createStyle(numFmt = "@")
  sheets <- list(survey = survey, choices = choices, settings = settings)
  for (sheet in names(sheets)) {
    df <- sheets[[sheet]]
    openxlsx::addWorksheet(wb, sheet)
    openxlsx::writeData(wb, sheet, df, withFilter = nrow(df) > 0L, headerStyle = header_style)
    if (ncol(df) > 0L) {
      openxlsx::addStyle(wb, sheet, text_style, rows = seq_len(max(1L, nrow(df) + 1L)), cols = seq_len(ncol(df)), gridExpand = TRUE, stack = TRUE)
      openxlsx::freezePane(wb, sheet, firstRow = TRUE)
      openxlsx::setColWidths(wb, sheet, cols = seq_len(ncol(df)), widths = "auto")
    }
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  invisible(path)
}

# Lee `cruces_vars` de la config (schema v2 o v1 legacy) y devuelve
# una lista `list(name -> c(valores_excluidos))`. Para v1 las excluidas
# son siempre vacías.
.cruces_vars_parse <- function(raw) {
  if (is.null(raw) || length(raw) == 0L) return(list())
  out <- list()
  for (el in raw) {
    if (is.character(el)) {
      nm <- as.character(el)[1]
      if (nzchar(nm)) out[[nm]] <- character(0)
    } else if (is.list(el)) {
      nm <- as.character(el$name %||% "")
      if (!nzchar(nm)) next
      excl <- .as_chr_vec(el$excluidas)
      out[[nm]] <- excl
    }
  }
  out
}

# Aplica las exclusiones por variable de cruce (filtra filas). Nota: es
# un filtro GLOBAL — los casos con valor excluido en una variable no
# aparecerán en ninguna tabla. Esto se comunica al usuario desde la UI.
.excluir_cruce_rows <- function(data, cruces_map) {
  if (length(cruces_map) == 0L) return(data)
  keep <- rep(TRUE, nrow(data))
  for (nm in names(cruces_map)) {
    excl <- cruces_map[[nm]]
    if (length(excl) == 0L) next
    if (!nm %in% names(data)) next
    vals <- as.character(data[[nm]])
    keep <- keep & !(vals %in% excl)
  }
  if (all(keep)) return(data)
  data[keep, , drop = FALSE]
}

# Default de configuración (mirrors defaults del frontend store.ts).
# Se usa cuando el session store no tiene aún una config grabada.
.analitica_default_config <- function() {
	    list(
	      version = 3L,
	    fuente_preferida = "adaptados",
	    secciones = list(),
	    numericas = list(),
	    variables_excluidas = list(),
	    datos = list(
	      variable_labels = list(),
	      value_labels = list()
	    ),
	    codebook = list(
      codigos_solo_si_presentes = as.list(c(96L, 97L, 98L, 99L))
    ),
	    bases = list(
	      sav  = list(incluir_sps = FALSE),
	      csv  = list(valores = "etiquetas", separador = ",", multi_select = "dummy_01"),
	      xlsx = list(valores = "ambos", multi_select = "dummy_01"),
	      overrides = list()
	    ),
    frecuencias = list(
      secciones_activas = list(),
      orden = "original",
      mostrar_todo = FALSE,
      incluir_titulos = TRUE,
      incluir_secciones = TRUE
    ),
    multibase = list(
      global = list(
        incluir_porcentajes = TRUE,
        incluir_secciones = TRUE
      ),
      origenes = list(
        incluir_porcentajes = TRUE,
        incluir_secciones = TRUE
      )
    ),
    cruces = list(
      cruces_vars = list(),
      modo = "estandar",
      show_sig = TRUE,
      alpha = 0.05,
      incluir_total = TRUE,
      incluir_titulos = TRUE,
      incluir_secciones = TRUE,
      brecha = list(filas = FALSE, cols = FALSE),
      semaforo = list(
        activo = FALSE,
        cortes = as.list(c(50L, 75L)),
        modo = "grupos",
        colores = list(rojo = "#F8D7DA", amarillo = "#FFF3CD", verde = "#D4EDDA")
      )
    ),
    enumeradores = list(
      col_enumerador = "Enumerator_name",
      cols_corte = list(),
      modalidades_esperadas = as.list(c("Presencial", "Telefónica")),
      mostrar_vacias = FALSE,
      titulo = "Producción de Enumeradores",
      min_encuestas = 0L,
      ordenar_por = "total",
      modalidad_reglas = list(),
      modalidad_default = "Presencial"
    ),
    dimensiones = .dimensiones_default_config()
  )
}

mount_analitica <- function(pr) {
  pr |>
    plumber::pr_get("/api/analitica/config", wrap_endpoint(function(req, res) {
      # Devuelve la config persistida (o defaults). La UI la hidrata en su
      # store al montarse `AnaliticaPage` y escribe cambios vía autosave
      # contra POST /config.
      sid <- session_header(req)
      s <- session_get(sid)
      cfg <- .analitica_config_get(sid, s)
      list(ok = TRUE, config = cfg)
    })) |>
    plumber::pr_post("/api/analitica/config", wrap_endpoint(function(req, res, ...) {
      # Recibe la config completa desde el autosave del frontend. No
      # validamos schema aquí (el frontend ya lo garantiza); el backend
      # es un "kv store" para esta sub-clave.
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      cfg <- parsed$config
      if (is.null(cfg)) stop_api(400, "E_NO_CONFIG", "Body debe incluir 'config'.")
      s_prev <- session_get(sid)
      prev_fuente <- as.character((.analitica_config_get(sid, s_prev) %||% list())$fuente_preferida %||% "")
      next_fuente <- as.character((cfg %||% list())$fuente_preferida %||% "")
      .analitica_config_set(sid, cfg)
      if (!identical(prev_fuente, next_fuente)) {
        .analitica_status_set(sid, "analitica_prep_ok", FALSE)
        .analitica_status_set(sid, "analitica_codebook_ok", FALSE)
        .analitica_status_set(sid, "analitica_frecuencias_ok", FALSE)
        .analitica_status_set(sid, "analitica_cruces_ok", FALSE)
        .analitica_status_set(sid, "analitica_spss_ok", FALSE)
        .analitica_status_set(sid, "analitica_dim_ok", FALSE)
        session_set(sid, "analitica_rp_inst", NULL)
        session_set(sid, "analitica_rp_data", NULL)
        session_set(sid, "analitica_rp_inst_sources", list())
        session_set(sid, "analitica_rp_data_sources", list())
        session_set(sid, "analitica_multibase_available", FALSE)
      }
      list(ok = TRUE, saved_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
    })) |>
    plumber::pr_get("/api/analitica/config/export", wrap_endpoint(function(req, res) {
      # Export del estado completo (config + flags de generación) para que
      # el analista pueda guardarlo a disco / compartirlo. Mismo patrón que
      # Fase 3 /api/codificacion/export-json.
      sid <- session_header(req)
      s <- session_get(sid)
      list(
        ok = TRUE,
        version = "analitica/1.0",
        exported_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
        config = .analitica_config_get(sid, s)
      )
    })) |>
    plumber::pr_post("/api/analitica/detect-secciones", wrap_endpoint(function(req, res) {
      # Devuelve las secciones detectadas desde begin_group/end_group del
      # XLSForm ya preparado. Respeta orden del instrumento. Requiere
      # haber corrido /preparar antes.
      sid <- session_header(req)
      ctx <- .load_rp_data(sid)
      secciones <- .detect_secciones_analitica(ctx$rp_inst)
      list(ok = TRUE, secciones = secciones)
    })) |>
    plumber::pr_get("/api/analitica/variables", wrap_endpoint(function(req, res) {
      # Lista las variables del instrumento para alimentar dropdowns /
      # multiselects del frontend. Cada entry trae name + label + tipo +
      # list_name, filtrando filas estructurales (begin_group, note,
	      # calculate, etc.).
	      sid <- session_header(req)
	      ctx <- .load_rp_data(sid)
	      cfg <- .analitica_get_config(sid)
	      reviewed <- .analitica_apply_data_review(ctx$rp_data, ctx$rp_inst, cfg)
	      variables <- .variables_desde_instrumento(reviewed$inst)
	      numericas_decl <- .analitica_declared_numericas(cfg, override_frecuencias = FALSE)
      variables <- lapply(variables, function(v) {
        v$declarada_numerica <- isTRUE(v$numerica) && as.character(v$name %||% "") %in% numericas_decl
        v$analisis <- isTRUE(v$categorica) || isTRUE(v$declarada_numerica)
        v
	      })
	      list(ok = TRUE, variables = variables)
	    })) |>
	    plumber::pr_get("/api/analitica/data-review", wrap_endpoint(function(req, res) {
	      sid <- session_header(req)
	      ctx <- .load_rp_data(sid)
	      cfg <- .analitica_get_config(sid)
	      list(ok = TRUE, variables = .analitica_data_review_payload(ctx$rp_data, ctx$rp_inst, cfg))
	    })) |>
	    plumber::pr_get("/api/analitica/column-values", wrap_endpoint(function(req, res, name = NULL) {
      # Devuelve valores únicos de una columna del data preparado, con
      # sus labels si la columna es select_one/select_multiple (usa los
      # value_labels aplicados por reporte_data). Alimenta el query
      # builder de reglas en EnumeradoresPane.
	      sid <- session_header(req)
	      ctx <- .load_rp_data(sid)
	      cfg <- .analitica_get_config(sid)
	      reviewed <- .analitica_apply_data_review(ctx$rp_data, ctx$rp_inst, cfg)
	      ctx$rp_data <- reviewed$data
	      col <- as.character(name %||% "")
      if (!nzchar(col)) stop_api(400, "E_NO_COL", "Falta query param `name`.")
      if (!col %in% names(ctx$rp_data)) {
        stop_api(404, "E_COL_NOT_FOUND", sprintf("La columna '%s' no existe en la data.", col))
      }
      v <- ctx$rp_data[[col]]
      # Labels si es factor / haven_labelled.
      lbls <- NULL
      if (inherits(v, "haven_labelled")) {
        lab_attr <- attr(v, "labels")
        if (!is.null(lab_attr)) {
          lbls <- setNames(names(lab_attr), as.character(lab_attr))
        }
      } else if (is.factor(v)) {
        lbls <- setNames(levels(v), as.character(seq_along(levels(v))))
      }
      v_chr <- as.character(v)
      v_chr <- v_chr[!is.na(v_chr) & nzchar(v_chr)]
      uniq <- unique(v_chr)
      # Ordenar: numéricos si se puede, si no alfabético.
      num_sort <- suppressWarnings(as.numeric(uniq))
      uniq <- if (all(!is.na(num_sort))) uniq[order(num_sort)] else sort(uniq)
      # Cap: máximo 200 valores únicos (más allá no aporta para un picker).
      truncated <- length(uniq) > 200L
      if (truncated) uniq <- head(uniq, 200L)
      values <- lapply(uniq, function(x) {
        lab <- if (!is.null(lbls) && x %in% names(lbls)) as.character(lbls[[x]]) else ""
        Encoding(lab) <- "UTF-8"
        list(value = x, label = lab)
      })
      list(
        ok = TRUE, column = col, n_total = length(unique(v_chr)),
        truncated = truncated, values = values
      )
    })) |>
    plumber::pr_post("/api/analitica/config/import", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      v <- as.character(parsed$version %||% "")
      if (!startsWith(v, "analitica/")) {
        stop_api(400, "E_BAD_VERSION",
          sprintf("JSON no es de analítica (version='%s'). Se espera 'analitica/1.x'.", v))
      }
      cfg <- parsed$config
      if (is.null(cfg)) stop_api(400, "E_NO_CONFIG", "El JSON no trae 'config'.")
      .analitica_config_set(sid, cfg)
      list(ok = TRUE, imported_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
    })) |>
    plumber::pr_post("/api/analitica/preparar", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      ctx <- .analitica_prepare_and_cache(sid)
      session_set(sid, "analitica_multibase_available", .analitica_multibase_available(sid))
      list(
        ok = TRUE,
        fuente = ctx$fuente,
        n_filas = nrow(ctx$rp_data),
        n_columnas = ncol(ctx$rp_data)
      )
    })) |>
    plumber::pr_post("/api/analitica/codebook", wrap_endpoint(function(req, res) {
      # Codebook multi-base (v0.2+): itera sobre todas las bases del
      # estudio y genera un xlsx por cada una. Con 1 base → xlsx directo
      # como antes. Con N → zip con N archivos prefijados por nombre
      # de base (docentes__codebook.xlsx, ...).
      #
      # Config: `codigos_solo_si_presentes` y `variables_excluidas` son
      # globales al estudio (no varían por base, el QMD trabaja con la
      # misma política de codificación para todas).
      sid <- session_header(req)
      cfg <- .analitica_get_config(sid)
      cb_cfg <- cfg$codebook %||% list()
      codes <- .as_int_vec(cb_cfg$codigos_solo_si_presentes)
      excluidas <- .as_chr_vec(cfg$variables_excluidas)
      numericas_arg <- .analitica_declared_numericas(cfg, override_frecuencias = FALSE)

      result <- run_report_multibase(
        sid           = sid,
        base_filename = "codebook",
        ext           = "xlsx",
	        kind_single   = "codebook",
	        kind_multi    = "codebook_zip",
	        fn = function(rp_data, rp_inst, out_path) {
	          reviewed <- .analitica_apply_data_review(rp_data, rp_inst, cfg)
	          data_out <- .analitica_filter_data(reviewed$data, reviewed$inst, numericas_arg, excluidas)
	          reporte_codebook(
	            data = data_out,
            path_xlsx = out_path,
            codigos_solo_si_presentes = if (length(codes) > 0L) codes else NULL
          )
        }
      )
      xlsform_result <- run_report_multibase(
        sid           = sid,
        base_filename = "xlsform_final",
        ext           = "xlsx",
        kind_single   = "xlsform_final",
        kind_multi    = "xlsform_final_zip",
        fn = function(rp_data, rp_inst, out_path) {
          reviewed <- .analitica_apply_data_review(rp_data, rp_inst, cfg)
          final_inst <- .analitica_filter_xlsform_inst(reviewed$inst, excluidas)
          .analitica_write_final_xlsform(final_inst, out_path)
        }
      )
      .analitica_status_set(sid, "analitica_codebook_ok", TRUE)
      result$xlsform <- xlsform_result
      result
    })) |>
    plumber::pr_post("/api/analitica/frecuencias", wrap_endpoint(function(req, res) {
      # Frecuencias multi-base (v0.2+): itera sobre todas las bases del
      # estudio. La config (secciones, orden, excluidas, numéricas,
      # codigos_solo_si_presentes) se aplica globalmente a TODAS las
      # bases. Las secciones provienen del config — si alguna variable
      # de la sección no existe en una base específica, el motor la
      # ignora en esa base (no rompe).
      sid <- session_header(req)
      cfg <- .analitica_get_config(sid)
      fc <- cfg$frecuencias %||% list()
      activas <- .as_chr_vec(fc$secciones_activas)
      secs_cfg <- .secciones_from_config(cfg, activas_filter = if (length(activas) > 0L) activas else NULL)

      orden <- as.character(fc$orden %||% "desc")
      if (!orden %in% c("desc","asc","original")) orden <- "desc"
      mostrar_todo <- isTRUE(fc$mostrar_todo)
      # Los títulos de variable/pregunta se conservan siempre. La opción UI
      # solo controla los separadores de sección.
      incluir_titulos <- TRUE
      incluir_secciones <- isTRUE(fc$incluir_secciones %||% TRUE)

      numericas_arg <- .analitica_declared_numericas(cfg, override_frecuencias = TRUE)

      codes_codebook <- .as_int_vec((cfg$codebook %||% list())$codigos_solo_si_presentes)
      excluidas <- .as_chr_vec(cfg$variables_excluidas)

      result <- run_report_multibase(
        sid           = sid,
        base_filename = "frecuencias",
        ext           = "xlsx",
	        kind_single   = "frecuencias",
	        kind_multi    = "frecuencias_zip",
	        fn = function(rp_data, rp_inst, out_path) {
	          reviewed <- .analitica_apply_data_review(rp_data, rp_inst, cfg)
	          rp_data <- reviewed$data
	          rp_inst <- reviewed$inst
	          data_out <- .excluir_cols(rp_data, excluidas)
	          # Secciones: usa las del config si las hay; sino, detecta
          # automáticamente las del instrumento de ESTA base.
          secs <- secs_cfg
          if (is.null(secs)) secs <- .secciones_desde_instrumento(rp_inst)
          secs <- .analitica_filter_sections(secs, rp_inst, numericas_arg, excluidas)
          reporte_frecuencias(
            data = data_out, instrumento = rp_inst,
            secciones = secs,
            path_xlsx = out_path,
            orden = orden,
            mostrar_todo = mostrar_todo,
            incluir_titulos = incluir_titulos,
            incluir_secciones = incluir_secciones,
            codigos_solo_si_presentes = if (length(codes_codebook) > 0L) codes_codebook else NULL,
            numericas = if (length(numericas_arg) > 0L) numericas_arg else NULL
          )
        }
      )
      .analitica_status_set(sid, "analitica_frecuencias_ok", TRUE)
      result
    })) |>
    plumber::pr_get("/api/analitica/multibase/info", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      .analitica_multibase_info(sid, .analitica_get_config(sid))
    })) |>
    plumber::pr_post("/api/analitica/multibase/tablas", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      cfg <- .analitica_get_config(sid)
      sources <- .load_rp_sources(sid)
      if (length(sources$data_sources) != 1L) {
        stop_api(409, "E_MULTIBASE_INTEGRATED_REQUIRED", "Este reporte requiere una base integrada unica.")
      }
      base_name <- names(sources$data_sources)[1]
      data <- sources$data_sources[[base_name]]
      inst <- sources$inst_sources[[base_name]]
      meta <- .amb_base_meta(sid, base_name)
      recod_roles <- .amb_recod_roles_for_base(sid, base_name)
      data_path <- job_save_rds(sid, "multibase_tablas_data", data)
      inst_path <- job_save_rds(sid, "multibase_tablas_inst", inst)
      cfg_path <- job_save_rds(sid, "multibase_tablas_cfg", cfg)
      meta_path <- job_save_rds(sid, "multibase_tablas_meta", meta)
      recod_roles_path <- job_save_rds(sid, "multibase_tablas_recod_roles", recod_roles)
      api_path <- .app_api_dir()

      job_id <- job_submit(
        sid = sid,
        kind = "analitica.multibase.tablas",
        func = function(data_path, inst_path, cfg_path, meta_path, recod_roles_path, base_name, api_path, result_path, progress_path = NULL) {
          if (requireNamespace("pkgload", quietly = TRUE)) {
            pkgload::load_all(api_path, quiet = TRUE)
          } else if (requireNamespace("devtools", quietly = TRUE)) {
            devtools::load_all(api_path, quiet = TRUE)
          }
          report <- if (exists("job_progress_writer", mode = "function")) {
            job_progress_writer(progress_path)
          } else {
            function(...) invisible(NULL)
          }
          report("loading", percent = 5, message = "Cargando base integrada y configuración...")
          data <- readRDS(data_path)
          inst <- readRDS(inst_path)
          cfg <- readRDS(cfg_path)
          meta <- readRDS(meta_path)
          recod_roles <- readRDS(recod_roles_path)
          .analitica_multibase_export_data(
            data = data,
            inst = inst,
            cfg = cfg,
            meta = meta,
            recod_roles = recod_roles,
            path_xlsx = result_path,
            base_name = base_name
          )
          report("export", percent = 99, message = "Archivo XLSX generado.")
          result_path
        },
        args = list(
          data_path = data_path,
          inst_path = inst_path,
          cfg_path = cfg_path,
          meta_path = meta_path,
          recod_roles_path = recod_roles_path,
          base_name = base_name,
          api_path = api_path
        ),
        result_filename = .export_filename(sid, "tablas_multibase", "xlsx"),
        on_complete = function(j) {
          .analitica_status_set(j$sid, "analitica_multibase_ok", TRUE)
          session_set(j$sid, "analitica_multibase_available", TRUE)
          out_name <- .export_filename(j$sid, "tablas_multibase", "xlsx")
          meta <- .register_output_file(j$sid, "tablas_multibase", j$result_path, original_name = out_name)
          list(
            ok = TRUE,
            n_bases = 1L,
            file_id = meta$file_id,
            filename = meta$original_name,
            size = meta$size,
            bases = list(list(
              nombre = (base_name %||% .analitica_multibase_info(j$sid)$base_name %||% "base_integrada"),
              file_id = meta$file_id,
              filename = meta$original_name,
              size = meta$size
            ))
          )
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "analitica.multibase.tablas")
    })) |>
    plumber::pr_post("/api/analitica/cruces", wrap_endpoint(function(req, res, cruces = NULL, modo = "estandar") {
      # Cruces lee del config del store: cruces_vars, modo, show_sig, alpha,
      # incluir_total, brecha, semaforo. Mantiene backcompat con el antiguo
      # `cruces=` query param para tests manuales; si viene en query, tiene
      # prioridad sobre el config.
	      sid <- session_header(req)
	      ctx <- .load_rp_data(sid)
	      cfg <- .analitica_get_config(sid)
	      reviewed_ctx <- .analitica_apply_data_review(ctx$rp_data, ctx$rp_inst, cfg)
	      ctx$rp_data <- reviewed_ctx$data
	      ctx$rp_inst <- reviewed_ctx$inst
	      cc <- cfg$cruces %||% list()

      # Resolver cruces_vars: query param > config. Schema v2 del config
      # es [{name, excluidas?}]; v1 era string[]. `.cruces_vars_parse`
      # acepta ambos y devuelve `list(name -> excluidas)`.
      cruces_map <- if (!is.null(cruces) && nzchar(as.character(cruces[[1]] %||% ""))) {
        raw_names <- if (length(cruces) == 1) as.character(cruces[[1]]) else as.character(cruces)
        setNames(replicate(length(raw_names), character(0), simplify = FALSE), raw_names)
      } else {
        .cruces_vars_parse(cc$cruces_vars)
      }
      cruces_val <- names(cruces_map)
      if (length(cruces_val) == 0L) {
        stop_api(400, "E_NO_CRUCES",
          "Agrega al menos una variable en Cruces antes de generar.")
      }

      modo_val <- as.character(modo %||% cc$modo %||% "estandar")
      if (!modo_val %in% c("estandar","dimensiones")) modo_val <- "estandar"

      secs <- .secciones_from_config(cfg)
      excluidas <- .as_chr_vec(cfg$variables_excluidas)
      numericas_arg <- .analitica_declared_numericas(cfg, override_frecuencias = FALSE)
	      secs <- .analitica_filter_sections(secs, ctx$rp_inst, numericas_arg, excluidas)

	      categoricas <- .analitica_categoricas(ctx$rp_inst)
	      cruces_val <- setdiff(intersect(cruces_val, categoricas), excluidas)
	      cruces_map <- cruces_map[names(cruces_map) %in% cruces_val]
      if (length(cruces_val) == 0L) {
        stop_api(400, "E_NO_CRUCES_ANALITICAS",
          "Agrega al menos una variable de selección única o múltiple para generar Cruces.")
      }

      show_sig <- isTRUE(cc$show_sig %||% TRUE)
      alpha <- suppressWarnings(as.numeric(cc$alpha %||% 0.05))
      if (!is.finite(alpha)) alpha <- 0.05
      incluir_total <- isTRUE(cc$incluir_total %||% TRUE)
      # Los títulos de variable/pregunta se conservan siempre. La opción UI
      # solo controla los separadores de sección.
      incluir_titulos <- TRUE
      incluir_secciones <- isTRUE(cc$incluir_secciones %||% TRUE)

      brecha <- cc$brecha %||% list()
      brecha_filas <- isTRUE(brecha$filas)
      brecha_cols <- isTRUE(brecha$cols)

      sem <- cc$semaforo %||% list()
      aplicar_sem <- isTRUE(sem$activo)
      sem_modo <- as.character(sem$modo %||% "grupos")
      if (!sem_modo %in% c("grupos", "degradado", "degradado_automatico", "degradado_manual")) sem_modo <- "grupos"
      sem_cortes <- .as_int_vec(sem$cortes)
      if (length(sem_cortes) == 0L) sem_cortes <- c(50L, 75L)
      sem_colores <- sem$colores %||% list()

      # Multi-base (v0.2+): filtramos cada base por `cruces_map` (las
      # exclusiones de categorías aplican a todas) y serializamos la
      # lista nombrada al RDS. El worker itera por base y empaqueta
      # los N xlsx en un zip si hay más de una.
	      sources <- .load_rp_sources(sid)
	      data_sources <- sources$data_sources
	      inst_sources <- sources$inst_sources
	      for (nombre in names(data_sources)) {
	        reviewed <- .analitica_apply_data_review(data_sources[[nombre]], inst_sources[[nombre]], cfg)
	        data_sources[[nombre]] <- .excluir_cols(reviewed$data, excluidas)
	        inst_sources[[nombre]] <- reviewed$inst
	      }
	      data_sources_filt <- lapply(data_sources, function(df) .excluir_cruce_rows(df, cruces_map))

      rp_data_path <- job_save_rds(sid, "rp_data_sources", data_sources_filt)
      rp_inst_path <- job_save_rds(sid, "rp_inst_sources", inst_sources)
      # api_path para que el worker callr pueda load_all(prosecnurapp).
      api_path <- .app_api_dir()

      job_id <- job_submit(
        sid = sid,
        kind = "analitica.cruces",
        func = function(rp_data_path, rp_inst_path, cruces_val, modo, secs, numericas_arg,
                        show_sig, alpha, incluir_total,
                        incluir_titulos, incluir_secciones,
                        brecha_filas, brecha_cols,
                        aplicar_sem, sem_modo, sem_cortes, sem_colores,
                        api_path, result_path, progress_path = NULL) {
          if (requireNamespace("pkgload", quietly = TRUE)) {
            pkgload::load_all(api_path, quiet = TRUE)
          } else if (requireNamespace("devtools", quietly = TRUE)) {
            devtools::load_all(api_path, quiet = TRUE)
          }
          report <- if (exists("job_progress_writer", mode = "function")) {
            job_progress_writer(progress_path)
          } else {
            function(...) invisible(NULL)
          }
          report("loading", percent = 2, message = "Cargando bases para cruces...")
          sem_colores_vec <- if (is.list(sem_colores) && length(sem_colores) > 0L) {
            unlist(lapply(c("rojo","amarillo","verde"), function(k) sem_colores[[k]]))
          } else NULL
          data_sources <- readRDS(rp_data_path)
          inst_sources <- readRDS(rp_inst_path)
          base_names <- names(data_sources)

          run_one <- function(nombre, out_path) {
            args <- list(
              data = data_sources[[nombre]],
              instrumento = inst_sources[[nombre]],
              SECCIONES = secs,
              cruces = cruces_val,
              modo = modo,
              path_xlsx = out_path,
              numericas = if (length(numericas_arg) > 0L) numericas_arg else NULL,
              show_sig = show_sig,
              alpha = alpha,
              incluir_total = incluir_total,
              incluir_titulos = incluir_titulos,
              incluir_secciones = incluir_secciones,
              brecha_filas = brecha_filas,
              brecha_cols = brecha_cols,
              aplicar_semaforo = aplicar_sem,
              semaforo_modo = sem_modo,
              semaforo_cortes = sem_cortes
            )
            if (!is.null(sem_colores_vec) && length(sem_colores_vec) == 3L &&
                all(nchar(sem_colores_vec) > 0L)) {
              names(sem_colores_vec) <- c("rojo","amarillo","verde")
              args$semaforo_colores <- sem_colores_vec
            }
            do.call(reporte_cruces, args)
          }

          if (length(base_names) == 1L) {
            # Single-base: escribe directo al result_path (xlsx).
            report("workbook", current = 1, total = 1, percent = 25, message = "Generando tabla de cruces...")
            run_one(base_names[1], result_path)
            report("export", percent = 95, message = "Guardando Excel...")
            return(list(mode = "single", path = result_path))
          }

          # Multi-base: genera N xlsx en un stage dir y los zipea al
          # result_path (que debe terminar en .zip).
          stage <- file.path(dirname(result_path),
                             paste0("cruces_stage_", basename(tempfile(""))))
          dir.create(stage, recursive = TRUE, showWarnings = FALSE)
          on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
          per_base <- lapply(seq_along(base_names), function(idx) {
            nombre <- base_names[[idx]]
            report(
              "workbook",
              current = idx,
              total = length(base_names),
              percent = 10 + round(75 * (idx - 1) / max(1, length(base_names))),
              message = sprintf("Generando cruces de %s...", nombre)
            )
            fname <- sprintf("%s__cruces.xlsx", nombre)
            p <- file.path(stage, fname)
            run_one(nombre, p)
            list(nombre = nombre, path = p, filename = fname,
                 size = as.integer(file.info(p)$size))
          })
          old_wd <- setwd(stage)
          on.exit(setwd(old_wd), add = TRUE)
          report("zip", percent = 92, message = "Empaquetando archivos...")
          zip::zip(result_path, files = vapply(per_base, function(o) o$filename, character(1)))
          setwd(old_wd)
          list(mode = "multi", path = result_path, bases = per_base)
        },
        args = list(
          rp_data_path = rp_data_path,
          rp_inst_path = rp_inst_path,
          cruces_val = cruces_val,
          modo = modo_val,
          secs = secs,
          numericas_arg = numericas_arg,
          show_sig = show_sig,
          alpha = alpha,
          incluir_total = incluir_total,
          incluir_titulos = incluir_titulos,
          incluir_secciones = incluir_secciones,
          brecha_filas = brecha_filas,
          brecha_cols = brecha_cols,
          aplicar_sem = aplicar_sem,
          sem_modo = sem_modo,
          sem_cortes = sem_cortes,
          sem_colores = sem_colores,
          api_path = api_path
        ),
        result_filename = if (length(data_sources) > 1L) {
          .export_filename(sid, "cruces", "zip")
        } else {
          .analitica_export_filename(sid, "cruces", "xlsx", base = names(data_sources)[1])
        },
        on_complete = function(j) {
          .analitica_status_set(j$sid, "analitica_cruces_ok", TRUE)
          if (identical(j$result_data$mode, "multi")) {
            zip_meta <- .register_output_file(j$sid, "cruces_zip", j$result_path)
            return(list(
              ok = TRUE,
              n_bases = length(j$result_data$bases),
              zip = list(file_id = zip_meta$file_id, filename = zip_meta$original_name,
                         size = zip_meta$size),
              bases = lapply(j$result_data$bases, function(o) list(
                nombre = o$nombre, filename = o$filename, size = o$size
              ))
            ))
          }
          meta <- .register_output_file(j$sid, "cruces", j$result_path)
          list(ok = TRUE, n_bases = 1L, file_id = meta$file_id,
               filename = meta$original_name, size = meta$size)
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "analitica.cruces")
    })) |>
    plumber::pr_get("/api/analitica/bases/metadata", wrap_endpoint(function(req, res) {
      # Devuelve la lista de variables con la inferencia de measure +
      # format.spss. La UI la muestra como tabla editable en BasesPane;
      # los overrides del usuario viven en `config$bases$overrides` y se
      # mergean client-side para display.
      sid <- session_header(req)
	      ctx <- .load_rp_data(sid)
	      cfg <- .analitica_get_config(sid)
	      overrides <- .bases_overrides_parse((cfg$bases %||% list())$overrides)
	      reviewed <- .analitica_apply_data_review(ctx$rp_data, ctx$rp_inst, cfg)
	      variables <- .bases_metadata_preview(reviewed$data, reviewed$inst)
	      py <- .bases_pyreadstat_python()
	      writer <- if (nzchar(py)) {
	        list(engine = "pyreadstat", ok = TRUE, python = py, fallback = FALSE)
	      } else {
	        list(
	          engine = "haven",
	          ok = FALSE,
	          python = NULL,
	          fallback = TRUE,
	          message = "pyreadstat no disponible; se usara haven como fallback."
	        )
	      }
	      list(ok = TRUE, variables = variables, overrides = overrides, sav_writer = writer)
	    })) |>
    plumber::pr_post("/api/analitica/bases/data", wrap_endpoint(function(req, res, ...) {
      # Descarga directa del archivo de datos de la fuente activa. Si la
      # fuente es Codificada, copiamos el output real del adaptador para
      # preservar hojas, formato y colores de columnas *_recod.
      sid <- session_header(req)
      cfg <- .analitica_get_config(sid)
      result <- .analitica_export_source_files(sid, role = "data", cfg = cfg)
      .analitica_status_set(sid, "analitica_bases_data_ok", TRUE)
      result
    })) |>
    plumber::pr_post("/api/analitica/bases/instrumento", wrap_endpoint(function(req, res, ...) {
      # Descarga directa del XLSForm de la fuente activa. El XLSForm
      # codificado ya trae los colores del paquete; no lo reescribimos.
      sid <- session_header(req)
      cfg <- .analitica_get_config(sid)
      result <- .analitica_export_source_files(sid, role = "instrumento", cfg = cfg)
      .analitica_status_set(sid, "analitica_bases_instrumento_ok", TRUE)
      result
    })) |>
    plumber::pr_post("/api/analitica/bases/sav", wrap_endpoint(function(req, res, ...) {
      # Exporta .sav multi-base (v0.2+). Cada base produce su propio
      # datos.sav (+ niveles_medida.sps si incluir_sps=TRUE). Con 1 base
      # y sin sps, devuelve el .sav directo. Con N bases O con sps,
      # empaqueta todo en un zip.
      sid <- session_header(req)
      cfg <- .analitica_get_config(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      body <- if (nzchar(body_raw)) {
        Encoding(body_raw) <- "UTF-8"
        tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
                 error = function(e) list())
      } else list()
      incluir_sps <- isTRUE(body$incluir_sps)
      overrides <- .bases_overrides_parse((cfg$bases %||% list())$overrides)

	      sources <- .load_rp_sources(sid)
	      ds <- sources$data_sources
	      is_ <- sources$inst_sources
	      if (length(ds) == 0L) stop_api(409, "E_NO_RP_DATA", "Estudio sin bases.")
	      excluidas <- .as_chr_vec(cfg$variables_excluidas)
	      for (nombre in names(ds)) {
	        reviewed <- .analitica_apply_data_review(ds[[nombre]], is_[[nombre]], cfg)
	        ds[[nombre]] <- .excluir_cols(reviewed$data, excluidas)
	        is_[[nombre]] <- reviewed$inst
	      }

      s <- session_get(sid)
      dir.create(file.path(s$dir, "downloads"), showWarnings = FALSE, recursive = TRUE)

      # Para single-base + sin sps: devuelve el .sav directo (legacy).
      if (length(ds) == 1L && !incluir_sps) {
        sav_name <- .analitica_export_filename(sid, "bases_sav", "sav", base = names(ds)[1])
        sav_path <- file.path(s$dir, "downloads", sprintf("%s_%s", uuid::UUIDgenerate(), sav_name))
        .bases_export_sav(ds[[1]], is_[[1]], sav_path, NULL, overrides = overrides)
        meta <- .register_output_file(sid, "bases_sav", sav_path, original_name = sav_name)
        .analitica_status_set(sid, "analitica_bases_sav_ok", TRUE)
        return(list(ok = TRUE, n_bases = 1L, file_id = meta$file_id,
                    filename = meta$original_name, size = meta$size))
      }

      # Multi-base o con sps: zip.
      stage <- tempfile("bases_sav_stage_")
      dir.create(stage, recursive = TRUE)
      on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
      per_base <- list()
      files_in_zip <- character(0)
      for (nombre in names(ds)) {
        # Prefijo por base si hay más de una; sino, nombres "limpios".
        prefix <- if (length(ds) > 1L || !is.null(.analitica_active_export_base(sid))) paste0(nombre, "__") else ""
        sav_path <- file.path(stage, paste0(prefix, "datos.sav"))
        sps_path <- if (incluir_sps) file.path(stage, paste0(prefix, "niveles_medida.sps")) else NULL
        .bases_export_sav(ds[[nombre]], is_[[nombre]], sav_path, sps_path, overrides = overrides)
        files_in_zip <- c(files_in_zip, basename(sav_path))
        if (!is.null(sps_path)) files_in_zip <- c(files_in_zip, basename(sps_path))
        per_base[[length(per_base) + 1L]] <- list(
          nombre = nombre,
          sav = basename(sav_path),
          sps = if (!is.null(sps_path)) basename(sps_path) else NULL
        )
      }
      zip_name <- .analitica_export_filename(
        sid,
        "bases_sav_bundle",
        "zip",
        base = if (length(ds) == 1L) names(ds)[1] else NULL
      )
      zip_path <- file.path(s$dir, "downloads", sprintf("%s_%s", uuid::UUIDgenerate(), zip_name))
      old_wd <- setwd(stage); on.exit(setwd(old_wd), add = TRUE)
      zip::zip(zip_path, files = files_in_zip)
      setwd(old_wd)
      meta <- .register_output_file(sid, "bases_sav_bundle", zip_path, original_name = zip_name)
      .analitica_status_set(sid, "analitica_bases_sav_ok", TRUE)
      list(ok = TRUE, n_bases = length(ds),
           zip = list(file_id = meta$file_id, filename = meta$original_name,
                      size = meta$size),
           bases = per_base)
    })) |>
	    plumber::pr_post("/api/analitica/bases/csv", wrap_endpoint(function(req, res, ...) {
	      # CSV multi-base: un csv por base, zip si N > 1.
	      sid <- session_header(req)
	      cfg <- .analitica_get_config(sid)
	      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      body <- if (nzchar(body_raw)) {
        Encoding(body_raw) <- "UTF-8"
        tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
                 error = function(e) list())
      } else list()
      valores <- as.character(body$valores %||% "etiquetas")
      if (!valores %in% c("codigos","etiquetas")) valores <- "etiquetas"
      separador <- as.character(body$separador %||% ",")
      if (!separador %in% c(",",";")) separador <- ","
      multi_select <- as.character(body$multi_select %||% "dummy_01")
      if (!multi_select %in% c("codigos_crudos","etiquetas_unidas","dummy_01")) multi_select <- "dummy_01"

      result <- run_report_multibase(
        sid           = sid,
        base_filename = "datos",
        ext           = "csv",
	        kind_single   = "bases_csv",
	        kind_multi    = "bases_csv_zip",
	        fn = function(rp_data, rp_inst, out_path) {
	          reviewed <- .analitica_apply_data_review(rp_data, rp_inst, cfg)
	          rp_data <- .excluir_cols(reviewed$data, .as_chr_vec(cfg$variables_excluidas))
	          rp_inst <- reviewed$inst
	          df <- rp_data
	          if (multi_select == "dummy_01") df <- .expand_multiselect(df, rp_inst)
          df <- .aplicar_etiquetas(df, rp_inst, valores = valores, multi_select = multi_select)
          .bases_write_csv(df, out_path, separador = separador)
        }
      )
      .analitica_status_set(sid, "analitica_bases_csv_ok", TRUE)
      result
    })) |>
	    plumber::pr_post("/api/analitica/bases/xlsx", wrap_endpoint(function(req, res, ...) {
	      # XLSX multi-base: un xlsx por base, zip si N > 1.
	      sid <- session_header(req)
	      cfg <- .analitica_get_config(sid)
	      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      body <- if (nzchar(body_raw)) {
        Encoding(body_raw) <- "UTF-8"
        tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
                 error = function(e) list())
      } else list()
      valores <- as.character(body$valores %||% "ambos")
      if (!valores %in% c("codigos","etiquetas","ambos")) valores <- "ambos"
      multi_select <- as.character(body$multi_select %||% "dummy_01")
      if (!multi_select %in% c("codigos_crudos","etiquetas_unidas","dummy_01")) multi_select <- "dummy_01"

      result <- run_report_multibase(
        sid           = sid,
        base_filename = "datos",
        ext           = "xlsx",
	        kind_single   = "bases_xlsx",
	        kind_multi    = "bases_xlsx_zip",
	        fn = function(rp_data, rp_inst, out_path) {
	          reviewed <- .analitica_apply_data_review(rp_data, rp_inst, cfg)
	          rp_data <- .excluir_cols(reviewed$data, .as_chr_vec(cfg$variables_excluidas))
	          rp_inst <- reviewed$inst
	          df_base <- rp_data
          if (multi_select == "dummy_01") df_base <- .expand_multiselect(df_base, rp_inst)
          df_cod <- .aplicar_etiquetas(df_base, rp_inst, valores = "codigos", multi_select = multi_select)
          df_lab <- if (valores == "codigos") df_cod
                    else .aplicar_etiquetas(df_base, rp_inst, valores = "etiquetas", multi_select = multi_select)
          .bases_write_xlsx(df_cod, df_lab, out_path, valores = valores)
        }
      )
      .analitica_status_set(sid, "analitica_bases_xlsx_ok", TRUE)
      result
    })) |>
    plumber::pr_post("/api/analitica/bases/xlsx-unificada", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      cfg <- .analitica_get_config(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      body <- if (nzchar(body_raw)) {
        Encoding(body_raw) <- "UTF-8"
        tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
                 error = function(e) list())
      } else list()
      valores <- as.character(body$valores %||% "ambos")
      if (!valores %in% c("codigos","etiquetas","ambos")) valores <- "ambos"
      multi_select <- as.character(body$multi_select %||% "dummy_01")
      if (!multi_select %in% c("codigos_crudos","etiquetas_unidas","dummy_01")) multi_select <- "dummy_01"

      result <- .analitica_unified_independent_xlsx(
        sid = sid,
        cfg = cfg,
        valores = valores,
        multi_select = multi_select
      )
      .analitica_status_set(sid, "analitica_bases_xlsx_ok", TRUE)
      result
    })) |>
    plumber::pr_post("/api/analitica/spss", wrap_endpoint(function(req, res) {
      # Alias de compatibilidad con el endpoint legacy. Mapea al nuevo
      # /bases/sav con incluir_sps=TRUE (comportamiento idéntico al viejo:
      # zip con .sav + niveles_medida.sps). Se mantiene una release para
      # no romper integraciones externas; el frontend nuevo ya no lo usa.
      sid <- session_header(req)
      s <- session_get(sid)
	      ctx <- .load_rp_data(sid)
	      cfg <- .analitica_get_config(sid)
	      overrides <- .bases_overrides_parse((cfg$bases %||% list())$overrides)
	      reviewed <- .analitica_apply_data_review(ctx$rp_data, ctx$rp_inst, cfg)
	      reviewed$data <- .excluir_cols(reviewed$data, .as_chr_vec(cfg$variables_excluidas))
	      td <- tempfile()
      dir.create(td)
      on.exit(unlink(td, recursive = TRUE), add = TRUE)
      sav_path <- file.path(td, "datos.sav")
      sps_path <- file.path(td, "niveles_medida.sps")
	      .bases_export_sav(reviewed$data, reviewed$inst, sav_path, sps_path, overrides = overrides)
      dir.create(file.path(s$dir, "downloads"), showWarnings = FALSE, recursive = TRUE)
      zip_name <- .analitica_export_filename(sid, "spss_bundle", "zip")
      zip_path <- file.path(s$dir, "downloads", sprintf("%s_%s", uuid::UUIDgenerate(), zip_name))
      old <- getwd(); on.exit({ setwd(old) }, add = TRUE)
      setwd(td)
      zip::zip(zip_path, files = c("datos.sav", "niveles_medida.sps"))
      meta <- .register_output_file(sid, "spss_bundle", zip_path, original_name = zip_name)
      .analitica_status_set(sid, "analitica_spss_ok", TRUE)
      list(ok = TRUE, file_id = meta$file_id, size = meta$size)
    })) |>
    plumber::pr_post("/api/analitica/enumeradores", wrap_endpoint(function(req, res, col_enumerador = NULL) {
      # Enumeradores lee del config: col_enumerador, cols_corte,
      # col_modalidad, modalidades_esperadas, modalidad_reglas,
      # modalidad_default, titulo, min_encuestas, ordenar_por,
      # mostrar_vacias. Query param `col_enumerador` tiene prioridad
      # (backcompat).
      sid <- session_header(req)
      ctx <- .load_rp_data(sid)
      cfg <- .analitica_get_config(sid)
      ec <- cfg$enumeradores %||% list()

      col_en <- if (!is.null(col_enumerador) && nzchar(as.character(col_enumerador))) {
        as.character(col_enumerador)
      } else {
        as.character(ec$col_enumerador %||% "")
      }
      if (!nzchar(col_en)) {
        stop_api(400, "E_NO_COL_ENUM",
          "Configura la columna del enumerador en Diseñar → Enumeradores.")
      }

      cols_corte <- .as_chr_vec(ec$cols_corte)
      col_modalidad <- as.character(ec$col_modalidad %||% "")
      modalidades_esp <- .as_chr_vec(ec$modalidades_esperadas)
      mostrar_vacias <- isTRUE(ec$mostrar_vacias)
      titulo <- as.character(ec$titulo %||% "Producción de Enumeradores")
      min_enc <- suppressWarnings(as.integer(ec$min_encuestas %||% 0L))
      if (!is.finite(min_enc) || min_enc < 0) min_enc <- 0L
      ordenar_por <- as.character(ec$ordenar_por %||% "total")
      if (!ordenar_por %in% c("total","nombre")) ordenar_por <- "total"
      modalidad_default <- as.character(ec$modalidad_default %||% "Presencial")

      # modalidad_reglas en el store usa el schema nuevo:
      #   { id, condiciones: [{columna, operador, valor}], modalidad }
      # Con fallback al schema legacy {patron, modalidad} para configs
      # pre-rediseño. Compilamos una `modalidad_fn(data)` que evalúa las
      # reglas en orden; la primera que matchea gana. Si no hay reglas
      # útiles, el pipeline cae en `col_modalidad` o `modalidad_default`.
      reglas_list <- ec$modalidad_reglas %||% list()
      modalidad_fn <- NULL
      modalidad_reglas_df <- NULL
      if (length(reglas_list) > 0L) {
        # Normalizar: si vienen reglas con `patron` (legacy), converlas a
        # una condición equivalente contra `col_enumerador`.
        reglas_norm <- list()
        for (r in reglas_list) {
          modalidad <- as.character(r$modalidad %||% "")
          if (!nzchar(modalidad)) next
          conds <- r$condiciones %||% list()
          if (length(conds) == 0L && nzchar(as.character(r$patron %||% ""))) {
            conds <- list(list(columna = col_en, operador = "==", valor = as.character(r$patron)))
          }
          # Validar condiciones: columna y operador obligatorios.
          conds_validas <- list()
          for (c in conds) {
            col_cond <- as.character(c$columna %||% "")
            op <- as.character(c$operador %||% "==")
            if (!nzchar(col_cond)) next
            if (!op %in% c("==","!=","in","not_in")) next
            # `valor` puede ser string o lista (para in/not_in).
            val_raw <- c$valor
            val <- if (is.list(val_raw)) unlist(val_raw, use.names = FALSE) else val_raw
            val <- as.character(val %||% "")
            val <- val[!is.na(val) & nzchar(val)]
            if (length(val) == 0L) next
            conds_validas[[length(conds_validas) + 1L]] <- list(
              columna = col_cond, operador = op, valor = val
            )
          }
          if (length(conds_validas) == 0L) next
          reglas_norm[[length(reglas_norm) + 1L]] <- list(
            condiciones = conds_validas, modalidad = modalidad
          )
        }
        if (length(reglas_norm) > 0L) {
          # Cerramos sobre las reglas normalizadas para producir una fn
          # que toma data y devuelve un vector character de modalidades.
          modalidad_fn <- local({
            reglas <- reglas_norm
            function(data) {
              n <- nrow(data)
              out <- rep(NA_character_, n)
              for (regla in reglas) {
                match_vec <- rep(TRUE, n)
                for (cond in regla$condiciones) {
                  col <- data[[cond$columna]]
                  if (is.null(col)) { match_vec <- rep(FALSE, n); break }
                  col_chr <- as.character(col)
                  valor <- as.character(cond$valor)
                  match_vec <- match_vec & switch(cond$operador,
                    "==" = col_chr == valor[1],
                    "!=" = col_chr != valor[1],
                    "in" = col_chr %in% valor,
                    "not_in" = !(col_chr %in% valor),
                    rep(FALSE, n)
                  )
                  if (!any(match_vec)) break
                }
                hit <- which(match_vec & is.na(out))
                if (length(hit)) out[hit] <- regla$modalidad
              }
              out
            }
          })
        }
      }

      # Multi-base (v0.2+): por cada base corre reporte_enumeradores y
      # produce un PDF. Las bases donde la columna `col_en` no existe
      # se omiten (con warning en la respuesta). Con 1 sola base:
      # result_path es un .pdf; con N: un .zip con N pdfs.
      data_sources <- .load_rp_sources(sid)$data_sources
      rp_data_path <- job_save_rds(sid, "rp_data_sources", data_sources)
      api_path <- .app_api_dir()
      multi <- length(data_sources) > 1L

      job_id <- job_submit(
        sid = sid,
        kind = "analitica.enumeradores",
        func = function(rp_data_path, col_en, cols_corte, col_modalidad,
                        modalidades_esp, mostrar_vacias, titulo, min_enc,
                        ordenar_por, modalidad_default, modalidad_fn,
                        api_path, result_path, progress_path = NULL) {
          if (requireNamespace("pkgload", quietly = TRUE)) {
            pkgload::load_all(api_path, quiet = TRUE)
          } else if (requireNamespace("devtools", quietly = TRUE)) {
            devtools::load_all(api_path, quiet = TRUE)
          }
          report <- if (exists("job_progress_writer", mode = "function")) {
            job_progress_writer(progress_path)
          } else {
            function(...) invisible(NULL)
          }
          report("loading", percent = 2, message = "Cargando bases de enumeradores...")
          data_sources <- readRDS(rp_data_path)
          base_names <- names(data_sources)

          run_one <- function(rp_data, out_pdf) {
            args <- list(
              data = rp_data,
              col_enumerador = col_en,
              output_file = out_pdf,
              titulo = titulo,
              min_encuestas = as.integer(min_enc),
              ordenar_por = ordenar_por,
              modalidad_default = modalidad_default,
              mostrar_modalidades_vacias = mostrar_vacias,
              quiet = TRUE
            )
            if (length(cols_corte) > 0L) args$cols_corte <- cols_corte
            if (nzchar(col_modalidad)) args$col_modalidad <- col_modalidad
            if (length(modalidades_esp) > 0L) args$modalidades_esperadas <- modalidades_esp
            if (!is.null(modalidad_fn)) args$modalidad_fn <- modalidad_fn
            do.call(reporte_enumeradores, args)
          }

          if (length(base_names) == 1L) {
            report("pdf", current = 1, total = 1, percent = 30, message = "Generando PDF de enumeradores...")
            run_one(data_sources[[1]], result_path)
            report("export", percent = 95, message = "Guardando PDF...")
            return(list(mode = "single", path = result_path))
          }

          stage <- file.path(dirname(result_path),
                             paste0("enum_stage_", basename(tempfile(""))))
          dir.create(stage, recursive = TRUE, showWarnings = FALSE)
          on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
          per_base <- list()
          for (idx in seq_along(base_names)) {
            nombre <- base_names[[idx]]
            report(
              "pdf",
              current = idx,
              total = length(base_names),
              percent = 10 + round(75 * (idx - 1) / max(1, length(base_names))),
              message = sprintf("Generando enumeradores de %s...", nombre)
            )
            rp_data <- data_sources[[nombre]]
            # Skip si la columna de enumerador no existe en esta base.
            if (!col_en %in% names(rp_data)) {
              per_base[[length(per_base) + 1L]] <- list(
                nombre = nombre, skipped = TRUE,
                reason = sprintf("columna '%s' no existe en esta base", col_en)
              )
              next
            }
            fname <- sprintf("%s__enumeradores.pdf", nombre)
            p <- file.path(stage, fname)
            run_one(rp_data, p)
            per_base[[length(per_base) + 1L]] <- list(
              nombre = nombre, path = p, filename = fname,
              size = as.integer(file.info(p)$size), skipped = FALSE
            )
          }
          ok_pdfs <- Filter(function(o) !isTRUE(o$skipped), per_base)
          if (length(ok_pdfs) == 0L) {
            stop(sprintf("Ninguna base tiene la columna '%s'; no hay PDFs para generar.", col_en))
          }
          old_wd <- setwd(stage)
          on.exit(setwd(old_wd), add = TRUE)
          report("zip", percent = 92, message = "Empaquetando PDFs...")
          zip::zip(result_path, files = vapply(ok_pdfs, function(o) o$filename, character(1)))
          setwd(old_wd)
          list(mode = "multi", path = result_path, bases = per_base)
        },
        args = list(
          rp_data_path = rp_data_path,
          col_en = col_en,
          cols_corte = cols_corte,
          col_modalidad = col_modalidad,
          modalidades_esp = modalidades_esp,
          mostrar_vacias = mostrar_vacias,
          titulo = titulo,
          min_enc = min_enc,
          ordenar_por = ordenar_por,
          modalidad_default = modalidad_default,
          modalidad_fn = modalidad_fn,
          api_path = api_path
        ),
        result_filename = if (multi) {
          .export_filename(sid, "enumeradores", "zip")
        } else {
          .export_filename(sid, "enumeradores", "pdf")
        },
        on_complete = function(j) {
          .analitica_status_set(j$sid, "analitica_enumeradores_ok", TRUE)
          if (identical(j$result_data$mode, "multi")) {
            zip_meta <- .register_output_file(j$sid, "enumeradores_zip", j$result_path)
            return(list(
              ok = TRUE,
              n_bases = length(Filter(function(o) !isTRUE(o$skipped), j$result_data$bases)),
              zip = list(file_id = zip_meta$file_id, filename = zip_meta$original_name,
                         size = zip_meta$size),
              bases = j$result_data$bases
            ))
          }
          meta <- .register_output_file(j$sid, "enumeradores", j$result_path)
          list(ok = TRUE, n_bases = 1L, file_id = meta$file_id,
               filename = meta$original_name, size = meta$size)
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "analitica.enumeradores")
    })) |>
    plumber::pr_get("/api/analitica/dimensiones/detect", wrap_endpoint(function(req, res) {
      # Escanea el instrumento para identificar variables select_one con
      # list_name en las "listas objetivo" (escalas tipo satisfacción /
      # acuerdo / si-no), y revisa si la base ya contiene columnas
      # `r100_*`, `sub_*` o `idx_*` (señal de que el proyecto pasó por una
      # construcción previa de dimensiones). La UI usa este endpoint para
      # decidir si arranca con "base detectada" o con "construir manual".
      sid <- session_header(req)
      ctx <- .load_rp_data(sid)
      cfg <- .analitica_get_config(sid)
      dim_cfg <- cfg$dimensiones %||% .dimensiones_default_config()
      escalas <- .dimensiones_detectar_escalas(ctx$rp_inst, dim_cfg$listas_objetivo)
      base <- .dimensiones_detectar_base_existente(ctx$rp_data)
      list(
        ok = TRUE,
        escalas = unname(escalas),
        base_dimensionada = base,
        listas_objetivo_disponibles = as.list(.dimensiones_listas_objetivo_default())
      )
    })) |>
    plumber::pr_post("/api/analitica/dimensiones/build", wrap_endpoint(function(req, res) {
      # Aplica la pipeline completa: recodifica → subcriterios → sub-índices
      # → índices → genera config (etiquetas + semáforo). Persiste la base
      # enriquecida en `s$rp_dim` y la config en `s$rp_dim_config`. Marca el
      # flag `analitica_dim_ok` para que río abajo (Cruces, Gráficos,
      # Tablero) pueda condicionar UI sin re-ejecutar.
      sid <- session_header(req)
      ctx <- .load_rp_data(sid)
      cfg <- .analitica_get_config(sid)
      dim_cfg <- cfg$dimensiones %||% .dimensiones_default_config()
      out <- .dimensiones_construir(ctx$rp_data, ctx$rp_inst, dim_cfg)
      session_set(sid, "rp_dim", out$data_dim)
      session_set(sid, "rp_dim_config", out$dim_cfg)
      .analitica_status_set(sid, "analitica_dim_ok", TRUE)
      list(
        ok = TRUE,
        n_filas = out$n_filas,
        n_r100 = length(out$vars_r100),
        n_sub = length(out$vars_sub),
        n_idx = length(out$vars_idx),
        vars_idx = as.list(out$vars_idx),
        vars_sub = as.list(out$vars_sub)
      )
    })) |>
    plumber::pr_get("/api/analitica/dimensiones/preview", wrap_endpoint(function(req, res) {
      # Devuelve primeras N filas + stats de cobertura por columna
      # `idx_*` / `sub_*`. Requiere haber corrido /build antes.
      sid <- session_header(req)
      s <- session_get(sid)
      if (is.null(s$rp_dim) || !isTRUE(s$analitica_dim_ok)) {
        stop_api(409, "E_NO_DIM",
          "Aún no se han construido dimensiones. Pulsa 'Generar dimensiones' primero.")
      }
      out <- .dimensiones_preview(s$rp_dim, max_rows = 10L)
      list(ok = TRUE, preview = out)
    })) |>
    plumber::pr_get("/api/analitica/dimensiones/status", wrap_endpoint(function(req, res) {
      # Estado liviano para que la UI sepa si hay dimensiones construidas
      # sin tener que pedir el preview. Útil al montar el pane.
      sid <- session_header(req)
      s <- session_get(sid)
      list(
        ok = TRUE,
        built = isTRUE(s$analitica_dim_ok),
        n_filas = if (!is.null(s$rp_dim)) nrow(s$rp_dim) else 0L,
        n_idx = if (!is.null(s$rp_dim)) length(grep("^idx_", names(s$rp_dim))) else 0L,
        n_sub = if (!is.null(s$rp_dim)) length(grep("^sub_", names(s$rp_dim))) else 0L
      )
    })) |>
    plumber::pr_get("/api/analitica/dimensiones/sugerir", wrap_endpoint(function(req, res) {
      # Step 3 del wizard: arranca un set inicial de bloques desde los
      # begin_group/end_group del XLSForm. El analista refina con drag-drop
      # encima de la sugerencia.
      sid <- session_header(req)
      ctx <- .load_rp_data(sid)
      cfg <- .analitica_get_config(sid)
      dim_cfg <- cfg$dimensiones %||% .dimensiones_default_config()
      bloques <- .dimensiones_sugerir_bloques(ctx$rp_inst, dim_cfg$listas_objetivo)
      list(ok = TRUE, bloques = bloques)
    })) |>
    plumber::pr_post("/api/analitica/dimensiones/validar-json", wrap_endpoint(function(req, res, ...) {
      # Step 1 del wizard ("Confirmar contra instrumento"): recibe el JSON
      # subido por el usuario y devuelve un reporte de coincidencias /
      # faltantes contra el rp_inst del proyecto activo. La UI usa este
      # reporte para mostrar ✓/⚠/✗ y dejar al analista decidir si continúa.
      #
      # Importante: la firma incluye `...` para absorber los args nombrados
      # que plumber intenta bindear desde las top-level keys del JSON
      # (`version`, `exported_at`, `_nota`, `config`, …). Sin `...` falla
      # con "unused arguments".
      sid <- session_header(req)
      ctx <- .load_rp_data(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      reporte <- .dimensiones_validar_contra_instrumento(parsed, ctx$rp_inst)
      list(ok = TRUE, reporte = reporte)
    }))
}
