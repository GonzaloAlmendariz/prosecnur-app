# =============================================================================
# Archivos de proyecto .pulso — serialización y carga
# =============================================================================
# Un `.pulso` es un archivo zip con:
#   manifest.json   # metadata (version, timestamps, app_version, project_name)
#   state.rds       # saveRDS del env de sesión filtrado (sin caches)
#   files/          # copias de los INPUTS del proyecto (xlsform, data,
#                   # familias.xlsx editable, plantilla de codificación
#                   # editada). Los OUTPUTS / entregables NO van acá —
#                   # esos se exportan como archivos independientes al
#                   # directorio del .pulso vía /api/fs/save-to-project
#                   # con el nombre que el analista decide.
#
# El formato es zip porque R tiene `zip::zip/unzip` nativo, el contenido es
# inspeccionable con `unzip -l`, y si el state.rds se corrompe los inputs
# siguen en files/ para re-derivar todo el pipeline. Los paths absolutos
# de `s$files[[*]]$path` se reescriben al tempdir de la sesión destino al
# cargar, así el .pulso viaja entre máquinas sin problema.
#
# Campos excluidos del state.rds (se excluyen del save, se regeneran al load):
#   - s$codif_por_base[[*]]$inst  — cache del XLSForm parseado
#   - s$codif_por_base[[*]]$data  — cache del dataframe crudo
#   - s$estudio$bases[[*]]$validacion$explorador_cache — hashes de views
#   - s$dashboard_rp_inst / s$dashboard_rp_data — caches del dashboard,
#       derivables de s$dashboard_source$(xlsform|data)_file_id
# Esto evita serializar objetos gordos (tibbles con 50k filas) que son
# derivables de los file_id que sí están en el zip.

# -----------------------------------------------------------------------------
# Helpers de filtrado
# -----------------------------------------------------------------------------

# Devuelve una copia del session state sin los caches derivables. NO toca
# el env original — solo construye la versión "liviana" para saveRDS.
.pulso_strip_caches <- function(s) {
  if (!is.null(s$codif_por_base) && is.list(s$codif_por_base)) {
    for (src in names(s$codif_por_base)) {
      s$codif_por_base[[src]]$inst <- NULL
      s$codif_por_base[[src]]$data <- NULL
    }
  }
  if (!is.null(s$estudio) && is.list(s$estudio$bases)) {
    for (bname in names(s$estudio$bases)) {
      # La validación de base tiene un explorador_cache que se regenera.
      if (!is.null(s$estudio$bases[[bname]]$validacion)) {
        s$estudio$bases[[bname]]$validacion$explorador_cache <- NULL
      }
    }
  }
  # Dashboard: el rp_inst y rp_data son tibbles gordos derivables del par
  # XLSForm + data referenciado en s$dashboard_source. Al cargar se
  # re-importan vía .dashboard_rebuild_after_load.
  s$dashboard_rp_inst <- NULL
  s$dashboard_rp_data <- NULL
  # Catálogos externos cacheados durante la sesión. Son metadata regenerable
  # desde la integración y no deben viajar como contrato persistente del .pulso.
  s$surveymonkey_survey_catalog <- NULL
  if (!is.null(s$estudio) && is.list(s$estudio$bases) && length(s$estudio$bases)) {
    # En proyectos multi/base integrada, estos objetos son caches runtime
    # derivados de los file_id canónicos de cada base. Persistirlos puede
    # congelar un XLSForm/data anterior al archivo real que viaja en el .pulso.
    s$rp_inst <- NULL
    s$rp_data <- NULL
    s$rp_inst_sources <- list()
    s$rp_data_sources <- list()
    s$data_xlsform_compatibility <- NULL
    s$analitica_rp_inst <- NULL
    s$analitica_rp_data <- NULL
    s$analitica_rp_inst_sources <- list()
    s$analitica_rp_data_sources <- list()
    s$analitica_prep_ok <- FALSE
    s$analitica_multibase_available <- FALSE
  }
  # Hojas de ruta: los PDFs/ZIP son entregables regenerables desde
  # hojas_ruta_config + marco INEI local; no forman parte del .pulso.
  s$hojas_ruta_ok <- NULL
  # Dashboard ctx: contiene CLOSURES (`label_var`, `label_idx`, `label_sub`,
  # `label_ind`, `label_data`) que capturan `.dim_nm_get` en su environment.
  # Al deserializar en otro proceso R (ej. deploy en HF Space), esas
  # closures fallan con "could not find function .dim_nm_get". Lo
  # invalidamos: la próxima llamada a .dashboard_dim_ctx() lo reconstruye
  # con el namespace activo, donde sí existe.
  s$dashboard_dim_ctx <- NULL
  s
}

# Tras un load_pulso, si el state restaurado tiene `dashboard_source` con
# file_ids válidos, regeneramos los caches `dashboard_rp_inst` y
# `dashboard_rp_data` reusando .dashboard_import_source. Esto cierra la
# brecha entre lo persistido (paths + meta) y lo que el dashboard necesita
# para renderizar. Si el rebuild falla, dejamos los caches vacíos (el
# dashboard pedirá al usuario re-importar la fuente).
.dashboard_rebuild_after_load <- function(sid) {
  s <- session_get(sid)
  if (is.null(s$dashboard_source)) return(invisible(NULL))
  xls_fid <- as.character(s$dashboard_source$xlsform_file_id %||% "")[1]
  dat_fid <- as.character(s$dashboard_source$data_file_id %||% "")[1]
  if (!nzchar(xls_fid) || !nzchar(dat_fid)) return(invisible(NULL))
  tryCatch(
    .dashboard_import_source(
      sid,
      list(xlsform_file_id = xls_fid, data_file_id = dat_fid),
      keep_curacion = TRUE
    ),
    error = function(e) {
      # No-op: el dashboard mostrará "carga la fuente" en la UI.
      invisible(NULL)
    }
  )
}

.pulso_valid_inst_cache <- function(x) {
  is.list(x) && !is.null(x$survey) && is.data.frame(x$survey)
}

.pulso_valid_data_cache <- function(x) {
  is.data.frame(x)
}

.pulso_read_data_file <- function(path, ext = NULL) {
  ext <- tolower(as.character(ext %||% tools::file_ext(path)))
  if (ext %in% c("xlsx", "xls")) {
    return(as.data.frame(readxl::read_excel(path), stringsAsFactors = FALSE, check.names = FALSE))
  }
  if (identical(ext, "csv")) {
    return(utils::read.csv(path, stringsAsFactors = FALSE, fileEncoding = "UTF-8", check.names = FALSE))
  }
  if (identical(ext, "sav")) {
    if (!requireNamespace("haven", quietly = TRUE)) stop("haven no está disponible para leer .sav")
    return(as.data.frame(haven::read_sav(path), stringsAsFactors = FALSE, check.names = FALSE))
  }
  stop(sprintf("Extensión no soportada: %s", ext), call. = FALSE)
}

.pulso_source_cache_candidate <- function(source_map, mirror, base_name, predicate) {
  hit <- source_map[[base_name]] %||% NULL
  if (isTRUE(predicate(hit))) return(hit)
  if (isTRUE(predicate(mirror))) return(mirror)
  nested <- tryCatch(mirror[[base_name]], error = function(e) NULL)
  if (isTRUE(predicate(nested))) return(nested)
  NULL
}

.pulso_load_choice_maps <- function(sid) {
  if (!exists(".carga_editor_choice_code_maps", mode = "function")) return(list())
  tryCatch(.carga_editor_choice_code_maps(sid), error = function(e) list())
}

# Los .pulso guardados por versiones intermedias podían conservar los archivos
# canónicos de una base integrada, pero perder o malformar los caches runtime
# `rp_data_sources` / `rp_inst_sources`. Validación consume esos maps por base,
# así que al abrir el proyecto los re-derivamos desde los file_id persistidos.
.pulso_rebuild_estudio_runtime_sources <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s) || is.null(s$estudio) || !length(s$estudio$bases)) return(invisible(FALSE))

  if (is.null(s$rp_data_sources) || !is.list(s$rp_data_sources)) s$rp_data_sources <- list()
  if (is.null(s$rp_inst_sources) || !is.list(s$rp_inst_sources)) s$rp_inst_sources <- list()

  changed <- FALSE
  for (base_name in names(s$estudio$bases)) {
    base <- s$estudio$bases[[base_name]]
    xls_fid <- as.character(base$xlsform_file_id %||% "")
    data_fid <- as.character(base$data_file_id %||% "")
    xls_meta <- if (nzchar(xls_fid)) s$files[[xls_fid]] else NULL
    data_meta <- if (nzchar(data_fid)) s$files[[data_fid]] else NULL

    inst <- NULL
    inst_from_file <- FALSE
    if (!is.null(xls_meta) && !is.null(xls_meta$path) && file.exists(xls_meta$path)) {
      inst <- tryCatch(reporte_instrumento(path = xls_meta$path), error = function(e) NULL)
      inst_from_file <- .pulso_valid_inst_cache(inst)
    }
    if (!.pulso_valid_inst_cache(inst)) {
      inst <- .pulso_source_cache_candidate(
        s$rp_inst_sources, s$rp_inst, base_name, .pulso_valid_inst_cache
      )
    }
    if (.pulso_valid_inst_cache(inst) &&
        (isTRUE(inst_from_file) || !.pulso_valid_inst_cache(s$rp_inst_sources[[base_name]]))) {
      s$rp_inst_sources[[base_name]] <- inst
      changed <- TRUE
    }
    if (!.pulso_valid_inst_cache(inst)) next

    data_cache <- NULL
    data_from_file <- FALSE
    if (!is.null(data_meta) && !is.null(data_meta$path) && file.exists(data_meta$path)) {
      raw_df <- tryCatch(
        .pulso_read_data_file(data_meta$path, data_meta$ext %||% base$data_ext),
        error = function(e) NULL
      )
      if (!is.null(raw_df)) {
        choice_maps <- .pulso_load_choice_maps(sid)
        data_norm <- tryCatch(
          normalize_data_for_xlsform(raw_df, inst, choice_code_maps = choice_maps),
          error = function(e) raw_df
        )
        data_cache <- tryCatch(
          reporte_data(data_norm, instrumento = inst),
          error = function(e) data_norm
        )
        normalized_attr <- attr(data_norm, "xlsform_normalized", exact = TRUE)
        if (!is.null(normalized_attr)) {
          attr(data_cache, "xlsform_normalized") <- normalized_attr
        }
        compat <- tryCatch(
          validate_data_xlsform_compatibility(data_norm, inst),
          error = function(e) NULL
        )
        if (!is.null(compat)) {
          attr(data_cache, "xlsform_compatibility") <- compat
          base$compatibilidad <- compat
        }
        base$n_filas <- as.integer(nrow(data_norm))
        base$n_columnas <- as.integer(ncol(data_norm))
        data_from_file <- .pulso_valid_data_cache(data_cache)
      }
    }
    if (!.pulso_valid_data_cache(data_cache)) {
      data_cache <- .pulso_source_cache_candidate(
        s$rp_data_sources, s$rp_data, base_name, .pulso_valid_data_cache
      )
    }
    if (.pulso_valid_data_cache(data_cache) &&
        (isTRUE(data_from_file) || !.pulso_valid_data_cache(s$rp_data_sources[[base_name]]))) {
      s$rp_data_sources[[base_name]] <- data_cache
      changed <- TRUE
    }
    s$estudio$bases[[base_name]] <- base
  }

  first <- names(s$estudio$bases)[1] %||% NA_character_
  if (!is.na(first) && nzchar(first)) {
    first_data <- s$rp_data_sources[[first]]
    first_inst <- s$rp_inst_sources[[first]]
    if (.pulso_valid_data_cache(first_data)) {
      s$rp_data <- first_data
      s$data_xlsform_compatibility <- attr(first_data, "xlsform_compatibility", exact = TRUE)
      changed <- TRUE
    }
    if (.pulso_valid_inst_cache(first_inst)) {
      s$rp_inst <- first_inst
      changed <- TRUE
    }
  }

  if (isTRUE(changed)) .session_env[[sid]] <- s
  invisible(isTRUE(changed))
}

.pulso_xlsform_label_col <- function(df) {
  nms <- names(df)
  hit <- which(tolower(nms) %in% c("label", "label::spanish (es)", "label::es", "label_spanish_es"))[1]
  if (is.na(hit)) NA_character_ else nms[hit]
}

.pulso_write_xlsform_frames <- function(path, survey, choices, settings = NULL) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) return(FALSE)
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", survey)
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", choices)
  if (!is.null(settings) && is.data.frame(settings)) {
    openxlsx::addWorksheet(wb, "settings")
    openxlsx::writeData(wb, "settings", settings)
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  TRUE
}

.pulso_blank_value <- function(x) {
  x_chr <- trimws(as.character(x))
  is.na(x) | is.na(x_chr) | !nzchar(x_chr)
}

.pulso_list_name_from_survey_row <- function(row) {
  if ("list_name" %in% names(row)) {
    ln <- as.character(row$list_name[[1]] %||% "")
    if (!is.na(ln) && nzchar(ln)) return(ln)
  }
  type <- as.character(row$type[[1]] %||% "")
  ln <- trimws(sub("^\\S+\\s*", "", type))
  if (!is.na(ln) && nzchar(ln) && !identical(ln, type)) ln else ""
}

.pulso_norm_label <- function(x) {
  x <- trimws(as.character(x %||% ""))
  x <- iconv(x, from = "", to = "ASCII//TRANSLIT", sub = "")
  tolower(x)
}

.pulso_next_free_code <- function(used) {
  used <- unique(as.character(used %||% character(0)))
  nums <- suppressWarnings(as.integer(used))
  candidate <- if (any(!is.na(nums))) max(nums[!is.na(nums)], na.rm = TRUE) + 1L else 1L
  while (as.character(candidate) %in% used) candidate <- candidate + 1L
  as.character(candidate)
}

.pulso_repair_parent_recod_df <- function(df, parent, text_col, code_map = NULL) {
  parent <- as.character(parent %||% "")
  text_col <- as.character(text_col %||% "")
  if (!nzchar(parent) || !parent %in% names(df)) return(list(data = df, changed = FALSE))
  if (!nzchar(text_col)) text_col <- paste0(parent, "_other")
  other_recod <- paste0(text_col, "_recod")
  parent_recod <- paste0(parent, "_recod")

  parent_vals <- as.character(df[[parent]])
  has_other_recod_col <- other_recod %in% names(df)
  rec_vals <- if (has_other_recod_col) as.character(df[[other_recod]]) else rep(NA_character_, nrow(df))
  text_vals <- if (text_col %in% names(df)) as.character(df[[text_col]]) else rep("", nrow(df))
  has_text <- !.pulso_blank_value(text_vals)
  has_rec <- !.pulso_blank_value(rec_vals)

  if (!is.null(code_map) && length(code_map)) {
    map <- as.character(code_map)
    names(map) <- as.character(names(code_map))
    idx <- has_rec & rec_vals %in% names(map)
    rec_vals[idx] <- unname(map[rec_vals[idx]])
  }

  old_names <- names(df)
  old_vals <- if (parent_recod %in% names(df)) as.character(df[[parent_recod]]) else NULL
  out_vals <- if (!is.null(old_vals)) old_vals else parent_vals
  fill_parent <- .pulso_blank_value(out_vals) &
    (!has_text | !isTRUE(has_other_recod_col)) &
    !.pulso_blank_value(parent_vals)
  out_vals[fill_parent] <- parent_vals[fill_parent]
  if (isTRUE(has_other_recod_col)) out_vals[has_text & !has_rec] <- NA_character_
  out_vals[has_rec] <- rec_vals[has_rec]
  out_vals[.pulso_blank_value(out_vals)] <- NA_character_

  df[[parent_recod]] <- out_vals
  nms <- names(df)
  nms_no_recod <- nms[nms != parent_recod]
  parent_pos <- match(parent, nms_no_recod)
  if (!is.na(parent_pos)) {
    nms_new <- append(nms_no_recod, parent_recod, after = parent_pos)
    df <- df[, nms_new, drop = FALSE]
  }
  changed_values <- is.null(old_vals) || !identical(old_vals, out_vals)
  changed_order <- !identical(old_names, names(df))
  list(data = df, changed = isTRUE(changed_values || changed_order))
}

.pulso_write_xlsx_sheets <- function(path, sheets_data) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) return(FALSE)
  wb <- openxlsx::createWorkbook()
  for (sheet in names(sheets_data)) {
    openxlsx::addWorksheet(wb, sheet)
    openxlsx::writeData(wb, sheet, sheets_data[[sheet]], withFilter = TRUE)
    openxlsx::freezePane(wb, sheet, firstRow = TRUE)
    if (ncol(sheets_data[[sheet]])) {
      openxlsx::setColWidths(wb, sheet, cols = seq_len(ncol(sheets_data[[sheet]])), widths = "auto")
    }
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  TRUE
}

.pulso_repair_parent_recod_xlsform <- function(path, repairs) {
  if (!length(repairs) || is.null(path) || !file.exists(path)) {
    return(list(changed = FALSE, repairs = repairs))
  }
  sheets <- tryCatch(readxl::excel_sheets(path), error = function(e) character(0))
  if (!all(c("survey", "choices") %in% sheets)) return(list(changed = FALSE, repairs = repairs))
  survey <- tryCatch(readxl::read_excel(path, sheet = "survey"), error = function(e) NULL)
  choices <- tryCatch(readxl::read_excel(path, sheet = "choices"), error = function(e) NULL)
  settings <- if ("settings" %in% sheets) {
    tryCatch(readxl::read_excel(path, sheet = "settings"), error = function(e) NULL)
  } else NULL
  if (is.null(survey) || is.null(choices) || !"name" %in% names(survey) || !"type" %in% names(survey)) {
    return(list(changed = FALSE, repairs = repairs))
  }
  if (!all(c("list_name", "name") %in% names(choices))) {
    return(list(changed = FALSE, repairs = repairs))
  }

  lab_col_s <- .pulso_xlsform_label_col(survey)
  lab_col_c <- .pulso_xlsform_label_col(choices)
  if (is.na(lab_col_s)) {
    survey$label <- NA_character_
    lab_col_s <- "label"
  }
  if (is.na(lab_col_c)) {
    choices$label <- NA_character_
    lab_col_c <- "label"
  }

  changed <- FALSE
  out_repairs <- list()
  for (rep in repairs) {
    parent <- as.character(rep$parent %||% "")
    text_col <- as.character(rep$text_col %||% "")
    if (!nzchar(parent)) next
    parent_recod <- paste0(parent, "_recod")
    text_recod <- if (nzchar(text_col)) paste0(text_col, "_recod") else paste0(parent, "_other_recod")
    parent_idx <- which(as.character(survey$name) == parent)[1]
    if (is.na(parent_idx)) next
    parent_row <- survey[parent_idx, , drop = FALSE]
    type_base <- trimws(sub("\\s+.*$", "", as.character(parent_row$type[[1]] %||% "")))
    if (!type_base %in% c("select_one", "select_multiple")) next
    parent_list <- .pulso_list_name_from_survey_row(parent_row)
    if (!nzchar(parent_list)) next
    recod_list <- paste0(parent_list, "_recod")

    parent_choices <- choices[as.character(choices$list_name) == parent_list, , drop = FALSE]
    existing_recod <- choices[as.character(choices$list_name) == recod_list, , drop = FALSE]
    child_idx <- which(as.character(survey$name) == text_recod)[1]
    child_choices <- choices[0, , drop = FALSE]
    if (!is.na(child_idx)) {
      child_list <- .pulso_list_name_from_survey_row(survey[child_idx, , drop = FALSE])
      if (nzchar(child_list)) {
        child_choices <- choices[as.character(choices$list_name) == child_list, , drop = FALSE]
      }
    }

    parent_codes <- as.character(parent_choices$name %||% character(0))
    parent_labels <- as.character(parent_choices[[lab_col_c]] %||% rep("", nrow(parent_choices)))
    names(parent_labels) <- parent_codes
    parent_label_keys <- .pulso_norm_label(parent_labels)
    names(parent_label_keys) <- parent_codes
    code_map <- character(0)
    used_codes <- unique(c(parent_codes, as.character(existing_recod$name %||% character(0))))

    recod_rows <- parent_choices
    if (nrow(recod_rows)) recod_rows$list_name <- recod_list

    add_source_rows <- function(src) {
      if (is.null(src) || !nrow(src)) return()
      for (i in seq_len(nrow(src))) {
        raw_code <- as.character(src$name[[i]] %||% "")
        if (!nzchar(raw_code) || raw_code %in% names(code_map)) next
        raw_label <- as.character(src[[lab_col_c]][[i]] %||% raw_code)
        raw_key <- .pulso_norm_label(raw_label)

        same_label_code <- names(parent_label_keys)[parent_label_keys == raw_key][1]
        if (!is.na(same_label_code) && nzchar(same_label_code)) {
          target_code <- same_label_code
          needs_row <- FALSE
        } else if (raw_code %in% parent_codes) {
          parent_label <- as.character(parent_labels[[raw_code]] %||% "")
          if (identical(.pulso_norm_label(parent_label), raw_key)) {
            target_code <- raw_code
            needs_row <- FALSE
          } else {
            target_code <- .pulso_next_free_code(used_codes)
            needs_row <- TRUE
          }
        } else if (raw_code %in% used_codes) {
          target_code <- .pulso_next_free_code(used_codes)
          needs_row <- TRUE
        } else {
          target_code <- raw_code
          needs_row <- TRUE
        }

        code_map <<- c(code_map, stats::setNames(target_code, raw_code))
        used_codes <<- unique(c(used_codes, target_code))
        if (isTRUE(needs_row)) {
          new_choice <- src[i, names(choices), drop = FALSE]
          new_choice$list_name <- recod_list
          new_choice$name <- target_code
          new_choice[[lab_col_c]] <- raw_label
          recod_rows <<- rbind(recod_rows, new_choice)
          parent_label_keys <<- c(parent_label_keys, stats::setNames(raw_key, target_code))
        }
      }
    }

    add_source_rows(child_choices)
    if (nrow(existing_recod)) {
      extra_existing <- existing_recod[!as.character(existing_recod$name) %in% parent_codes, , drop = FALSE]
      add_source_rows(extra_existing)
    }

    recod_names <- as.character(recod_rows$name %||% character(0))
    if (length(recod_names)) recod_rows <- recod_rows[!duplicated(recod_names), , drop = FALSE]

    recod_idx <- which(as.character(survey$name) == parent_recod)[1]
    if (is.na(recod_idx)) {
      new_row <- parent_row
      new_row$name <- parent_recod
      new_row$type <- paste(type_base, recod_list)
      if ("list_name" %in% names(new_row)) new_row$list_name <- recod_list
      label <- as.character(new_row[[lab_col_s]][[1]] %||% parent)
      if (!grepl("recod", label, ignore.case = TRUE)) label <- paste(label, "recodificada")
      new_row[[lab_col_s]] <- label
      before <- survey[seq_len(parent_idx), , drop = FALSE]
      after <- if (parent_idx < nrow(survey)) survey[(parent_idx + 1L):nrow(survey), , drop = FALSE] else survey[0, , drop = FALSE]
      survey <- rbind(before, new_row[, names(survey), drop = FALSE], after)
      changed <- TRUE
    } else {
      old_type <- as.character(survey$type[[recod_idx]] %||% "")
      new_type <- paste(type_base, recod_list)
      if (!identical(old_type, new_type)) {
        survey$type[[recod_idx]] <- new_type
        changed <- TRUE
      }
      if ("list_name" %in% names(survey) &&
          !identical(as.character(survey$list_name[[recod_idx]] %||% ""), recod_list)) {
        survey$list_name[[recod_idx]] <- recod_list
        changed <- TRUE
      }
    }

    old_recod <- choices[as.character(choices$list_name) == recod_list, , drop = FALSE]
    comparable <- function(df) {
      if (is.null(df) || !nrow(df)) return(data.frame())
      as.data.frame(df[, intersect(c("list_name", "name", lab_col_c), names(df)), drop = FALSE],
                    stringsAsFactors = FALSE, check.names = FALSE)
    }
    if (!identical(comparable(old_recod), comparable(recod_rows))) {
      choices <- choices[as.character(choices$list_name) != recod_list, , drop = FALSE]
      choices <- rbind(choices, recod_rows[, names(choices), drop = FALSE])
      changed <- TRUE
    }

    rep$code_map <- code_map
    out_repairs[[length(out_repairs) + 1L]] <- rep
  }

  if (changed) .pulso_write_xlsform_frames(path, survey, choices, settings)
  list(changed = isTRUE(changed), repairs = out_repairs)
}

.pulso_parent_recod_repairs <- function(s, base_name) {
  draft <- ((s$codif_por_base[[base_name]] %||% list())$familias_draft %||% list())$rows %||% list()
  if (!length(draft)) return(list())
  out <- list()
  for (row in draft) {
    tipo <- tolower(trimws(as.character(row$tipo %||% "")))
    modo_so <- tolower(trimws(as.character(row$modo_so %||% "")))
    if (!identical(tipo, "select_one") || !identical(modo_so, "padre")) next
    parent <- as.character(row$parent_col %||% "")
    if (!nzchar(parent)) parent <- as.character(row$parent %||% "")
    text_col <- as.character(row$text_col %||% "")
    if (!nzchar(parent)) next
    out[[length(out) + 1L]] <- list(parent = parent, text_col = text_col)
  }
  out
}

.pulso_repair_parent_recod_columns <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s) || is.null(s$estudio) || !length(s$estudio$bases)) return(invisible(FALSE))
  changed <- FALSE

  for (base_name in names(s$estudio$bases)) {
    repairs <- .pulso_parent_recod_repairs(s, base_name)
    if (!length(repairs)) next
    base <- s$estudio$bases[[base_name]]
    data_meta <- s$files[[as.character(base$data_file_id %||% "")]]
    xls_meta <- s$files[[as.character(base$xlsform_file_id %||% "")]]
    if (is.null(data_meta) || is.null(data_meta$path) || !file.exists(data_meta$path)) next
    if (!tolower(tools::file_ext(data_meta$path)) %in% c("xlsx", "xls")) next

    if (!is.null(xls_meta) && !is.null(xls_meta$path) && file.exists(xls_meta$path)) {
      xls_fixed <- .pulso_repair_parent_recod_xlsform(xls_meta$path, repairs)
      repairs <- xls_fixed$repairs %||% repairs
      if (isTRUE(xls_fixed$changed)) changed <- TRUE
    }

    sheets <- tryCatch(readxl::excel_sheets(data_meta$path), error = function(e) character(0))
    if (!length(sheets)) next
    sheets_data <- stats::setNames(lapply(sheets, function(sheet) {
      as.data.frame(readxl::read_excel(data_meta$path, sheet = sheet), stringsAsFactors = FALSE, check.names = FALSE)
    }), sheets)

    data_changed <- FALSE
    for (sheet in names(sheets_data)) {
      df <- sheets_data[[sheet]]
      for (rep in repairs) {
        fixed <- .pulso_repair_parent_recod_df(df, rep$parent, rep$text_col, rep$code_map)
        df <- fixed$data
        data_changed <- isTRUE(data_changed || fixed$changed)
      }
      sheets_data[[sheet]] <- df
    }
    if (isTRUE(data_changed) && .pulso_write_xlsx_sheets(data_meta$path, sheets_data)) {
      changed <- TRUE
    }

    if (isTRUE(data_changed)) {
      if (!is.null(s$rp_data_sources[[base_name]])) s$rp_data_sources[[base_name]] <- NULL
      if (!is.null(s$analitica_rp_data_sources[[base_name]])) s$analitica_rp_data_sources[[base_name]] <- NULL
    }
  }

  if (changed) {
    s$rp_data <- NULL
    s$rp_inst <- NULL
    s$analitica_rp_data <- NULL
    s$analitica_rp_inst <- NULL
    s$analitica_rp_data_sources <- list()
    s$analitica_rp_inst_sources <- list()
    s$analitica_prep_ok <- FALSE
    s$analitica_multibase_available <- FALSE
    s$data_xlsform_compatibility <- NULL
    .session_env[[sid]] <- s
  }
  invisible(isTRUE(changed))
}

.pulso_data_columns <- function(meta) {
  if (is.null(meta) || is.null(meta$path) || !file.exists(meta$path)) return(character(0))
  ext <- tolower(as.character(meta$ext %||% tools::file_ext(meta$path)))
  out <- tryCatch({
    if (ext %in% c("xlsx", "xls")) {
      names(readxl::read_excel(meta$path, n_max = 0))
    } else if (identical(ext, "csv")) {
      names(utils::read.csv(meta$path, nrows = 0, check.names = FALSE))
    } else if (identical(ext, "sav")) {
      names(haven::read_sav(meta$path))
    } else {
      character(0)
    }
  }, error = function(e) character(0))
  as.character(out)
}

.pulso_template_choices <- function(s, base_name) {
  fid <- as.character(
    (s$codif_por_base[[base_name]] %||% list())$plantilla_codigos_file_id %||% ""
  )
  meta <- if (nzchar(fid)) s$files[[fid]] else NULL
  if (is.null(meta) || is.null(meta$path) || !file.exists(meta$path)) return(NULL)
  sheets <- tryCatch(readxl::excel_sheets(meta$path), error = function(e) character(0))
  if (!"CHOICES" %in% sheets) return(NULL)
  tryCatch(readxl::read_excel(meta$path, sheet = "CHOICES"), error = function(e) NULL)
}

.pulso_safe_list_name <- function(x) {
  out <- tolower(gsub("[^A-Za-z0-9]+", "_", as.character(x)))
  out <- gsub("^_+|_+$", "", out)
  if (!nzchar(out)) out <- "lista"
  paste0(out, "_list")
}

.pulso_origin_relevant <- function(key_name, key_value) {
  sprintf("${%s} = '%s'", key_name, gsub("'", "\\\\'", as.character(key_value)))
}

.pulso_and_relevant <- function(existing, condition) {
  existing <- trimws(as.character(existing %||% ""))
  existing[is.na(existing)] <- ""
  if (!nzchar(condition)) return(existing)
  if (!nzchar(existing)) return(condition)
  paste0("(", existing, ") and (", condition, ")")
}

.pulso_repair_multibase_variant_xlsforms <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s) || is.null(s$estudio) || !length(s$estudio$bases)) return(invisible(FALSE))
  changed <- FALSE

  for (base_name in names(s$estudio$bases)) {
    base <- s$estudio$bases[[base_name]]
    multi <- base$multi_integrated %||% list()
    variant_map <- multi$variant_map %||% list()
    if (!length(variant_map)) next

    xls_meta <- s$files[[as.character(base$xlsform_file_id %||% "")]]
    data_meta <- s$files[[as.character(base$data_file_id %||% "")]]
    if (is.null(xls_meta) || is.null(data_meta) ||
        is.null(xls_meta$path) || !file.exists(xls_meta$path)) next

    data_cols <- .pulso_data_columns(data_meta)
    if (!length(data_cols)) next

    sheets <- tryCatch(readxl::excel_sheets(xls_meta$path), error = function(e) character(0))
    if (!all(c("survey", "choices") %in% sheets)) next
    survey <- tryCatch(readxl::read_excel(xls_meta$path, sheet = "survey"), error = function(e) NULL)
    choices <- tryCatch(readxl::read_excel(xls_meta$path, sheet = "choices"), error = function(e) NULL)
    settings <- if ("settings" %in% sheets) {
      tryCatch(readxl::read_excel(xls_meta$path, sheet = "settings"), error = function(e) NULL)
    } else NULL
    if (is.null(survey) || is.null(choices) || !"name" %in% names(survey)) next

    template_choices <- .pulso_template_choices(s, base_name)
    lab_col_s <- .pulso_xlsform_label_col(survey)
    lab_col_c <- .pulso_xlsform_label_col(choices)
    if (is.na(lab_col_s)) {
      survey$label <- NA_character_
      lab_col_s <- "label"
    }
    if (is.na(lab_col_c)) {
      choices$label <- NA_character_
      lab_col_c <- "label"
    }

    key_name <- as.character(multi$origin_key_name %||% "origen")
    origins <- unique(vapply(variant_map, function(v) as.character(v$origin_key %||% ""), character(1)))
    origins <- origins[nzchar(origins)]
    if (nzchar(key_name) && key_name %in% as.character(survey$name)) {
      key_list <- .pulso_safe_list_name(key_name)
      key_idx <- which(as.character(survey$name) == key_name)[1]
      survey$type[key_idx] <- paste("select_one", key_list)
      if (length(origins)) {
        old_key_rows <- if ("list_name" %in% names(choices)) as.character(choices$list_name) == key_list else rep(FALSE, nrow(choices))
        choices <- choices[!old_key_rows, , drop = FALSE]
        add_key <- choices[0, , drop = FALSE]
        for (key in origins) {
          row <- add_key[1, , drop = FALSE]
          if (!nrow(row)) row <- as.data.frame(as.list(stats::setNames(rep(NA_character_, length(names(choices))), names(choices))), stringsAsFactors = FALSE)
          row$list_name <- key_list
          row$name <- key
          row[[lab_col_c]] <- key
          add_key <- rbind(add_key, row)
        }
        choices <- rbind(choices, add_key)
      }
    }

    source_vars <- unique(vapply(variant_map, function(v) as.character(v$from %||% ""), character(1)))
    source_vars <- source_vars[nzchar(source_vars)]
    source_to_variants <- lapply(source_vars, function(src) {
      Filter(function(v) identical(as.character(v$from %||% ""), src), variant_map)
    })
    names(source_to_variants) <- source_vars

    survey_names <- as.character(survey$name)
    repaired_sources <- character(0)
    added_rows <- survey[0, , drop = FALSE]
    added_choices <- choices[0, , drop = FALSE]

    for (src in source_vars) {
      vars <- source_to_variants[[src]]
      variant_names <- unique(vapply(vars, function(v) as.character(v$to %||% ""), character(1)))
      variant_names <- variant_names[nzchar(variant_names)]
      if (!length(variant_names) || !any(variant_names %in% data_cols)) next
      if (!src %in% survey_names) next

      source_missing <- !src %in% data_cols
      source_other <- paste0(src, "_other")
      variant_other_names <- paste0(variant_names, "_other")
      if (!source_missing && !any(variant_other_names %in% data_cols)) next

      src_idx <- which(survey_names == src)[1]
      src_row <- survey[src_idx, , drop = FALSE]
      other_idx <- which(survey_names == source_other)[1]
      other_row <- if (!is.na(other_idx)) survey[other_idx, , drop = FALSE] else NULL

      for (v in vars) {
        to <- as.character(v$to %||% "")
        if (!nzchar(to) || !to %in% data_cols || to %in% survey_names) next
        origin_key <- as.character(v$origin_key %||% "")
        condition <- if (nzchar(key_name) && nzchar(origin_key)) .pulso_origin_relevant(key_name, origin_key) else ""

        tpl_rows <- if (!is.null(template_choices) && "parent_col" %in% names(template_choices)) {
          template_choices[as.character(template_choices$parent_col) == to, , drop = FALSE]
        } else NULL
        list_name <- if (!is.null(tpl_rows) && nrow(tpl_rows) && "list_name" %in% names(tpl_rows)) {
          as.character(tpl_rows$list_name[1])
        } else {
          .pulso_safe_list_name(to)
        }

        row <- src_row
        row$name <- to
        row$type <- if (grepl("^select_multiple\\b", as.character(row$type))) {
          paste("select_multiple", list_name)
        } else if (grepl("^select_one\\b", as.character(row$type))) {
          paste("select_one", list_name)
        } else {
          as.character(row$type)
        }
        row$relevant <- .pulso_and_relevant(row$relevant, condition)
        label_val <- if (!is.null(tpl_rows) && nrow(tpl_rows) && "variable_label" %in% names(tpl_rows)) {
          as.character(tpl_rows$variable_label[1])
        } else {
          paste(as.character(src_row[[lab_col_s]][1] %||% src), origin_key, sep = " - ")
        }
        row[[lab_col_s]] <- label_val
        added_rows <- rbind(added_rows, row)

        if (!is.null(tpl_rows) && nrow(tpl_rows) && all(c("code", "label") %in% names(tpl_rows))) {
          old_rows <- if ("list_name" %in% names(choices)) as.character(choices$list_name) == list_name else rep(FALSE, nrow(choices))
          choices <- choices[!old_rows, , drop = FALSE]
          for (i in seq_len(nrow(tpl_rows))) {
            crow <- choices[0, , drop = FALSE]
            if (!nrow(crow)) {
              crow <- as.data.frame(as.list(stats::setNames(rep(NA_character_, length(names(choices))), names(choices))), stringsAsFactors = FALSE)
            } else {
              crow <- crow[1, , drop = FALSE]
            }
            crow$list_name <- list_name
            crow$name <- as.character(tpl_rows$code[i])
            crow[[lab_col_c]] <- as.character(tpl_rows$label[i])
            added_choices <- rbind(added_choices, crow)
          }
        }

        to_other <- paste0(to, "_other")
        if (!is.null(other_row) && to_other %in% data_cols && !to_other %in% survey_names) {
          orow <- other_row
          orow$name <- to_other
          orow$relevant <- gsub(sprintf("\\$\\{%s\\}", src), sprintf("${%s}", to), as.character(orow$relevant %||% ""))
          orow$relevant <- .pulso_and_relevant(orow$relevant, condition)
          added_rows <- rbind(added_rows, orow)
        }
      }
      repaired_sources <- c(repaired_sources, src, source_other)
    }

    if (!nrow(added_rows)) next
    drop_names <- unique(repaired_sources[nzchar(repaired_sources)])
    survey <- survey[!as.character(survey$name) %in% drop_names, , drop = FALSE]
    insert_at <- min(match(source_vars[source_vars %in% survey_names], survey_names), na.rm = TRUE)
    if (!is.finite(insert_at)) insert_at <- nrow(survey) + 1L
    before <- survey[seq_len(max(0, min(insert_at - 1L, nrow(survey)))), , drop = FALSE]
    after <- if (insert_at <= nrow(survey)) survey[insert_at:nrow(survey), , drop = FALSE] else survey[0, , drop = FALSE]
    survey <- rbind(before, added_rows[, names(survey), drop = FALSE], after)
    if (nrow(added_choices)) choices <- rbind(choices, added_choices[, names(choices), drop = FALSE])

    if (.pulso_write_xlsform_frames(xls_meta$path, survey, choices, settings)) {
      inst_new <- tryCatch(reporte_instrumento(path = xls_meta$path), error = function(e) NULL)
      if (!is.null(inst_new)) {
        s$rp_inst <- inst_new
        if (is.null(s$rp_inst_sources)) s$rp_inst_sources <- list()
        s$rp_inst_sources[[base_name]] <- inst_new
        if (!is.null(s$analitica_rp_inst)) {
          s$analitica_rp_inst <- inst_new
        }
        if (!is.null(s$analitica_rp_inst_sources[[base_name]])) {
          s$analitica_rp_inst_sources[[base_name]] <- inst_new
        }
      }
      # El instrumento reparado cambia el contrato data/XLSForm; cualquier
      # compatibilidad cacheada contra el XLSForm viejo queda inválida.
      if (!is.null(s$rp_data)) {
        attr(s$rp_data, "xlsform_compatibility") <- NULL
      }
      if (!is.null(s$rp_data_sources[[base_name]])) {
        attr(s$rp_data_sources[[base_name]], "xlsform_compatibility") <- NULL
      }
      if (!is.null(s$analitica_rp_data)) {
        attr(s$analitica_rp_data, "xlsform_compatibility") <- NULL
      }
      if (!is.null(s$analitica_rp_data_sources[[base_name]])) {
        attr(s$analitica_rp_data_sources[[base_name]], "xlsform_compatibility") <- NULL
      }
      s$data_xlsform_compatibility <- NULL
      if (!is.null(s$estudio$bases[[base_name]])) {
        s$estudio$bases[[base_name]]$compatibilidad <- NULL
      }
      s$analitica_prep_ok <- FALSE
      changed <- TRUE
    }
  }

  if (changed) {
    .session_env[[sid]] <- s
  }
  invisible(changed)
}

# Re-normaliza la data restaurada de un .pulso viejo. Los .pulso guardados
# antes de v0.14 cachean `rp_data` (single-base) y `rp_data_sources[[base]]`
# (multi-base) sin pasar por `normalize_data_for_xlsform` — entonces sus
# select_multiple siguen como dummies sueltas (`q0007_0001..0007`), las
# preguntas SM aparecen como `q0001` en vez de `p1`, y el evaluador reporta
# decenas de "no aplicable" + falsos positivos.
#
# Detección barata: `attr(rp_data, "xlsform_normalized")` es NULL. Si es así,
# corremos el normalizador y reescribimos el cache en sesión. También
# invalidamos `evaluacion` para forzar re-auditoría (los flags están escritos
# contra los nombres viejos).
.pulso_renormalize_after_load <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(invisible(NULL))
  inst <- s$rp_inst %||% s$instrumento
  changed <- FALSE

  renorm_one <- function(data, instrumento) {
    if (is.null(data) || is.null(instrumento)) return(NULL)
    compat_prev <- attr(data, "xlsform_compatibility", exact = TRUE)
    already_normalized <- !is.null(attr(data, "xlsform_normalized"))
    out <- if (already_normalized) {
      data
    } else {
      tryCatch(
        normalize_data_for_xlsform(data, instrumento),
        error = function(e) NULL
      )
    }
    if (is.null(out)) return(NULL)
    compat <- tryCatch(
      validate_data_xlsform_compatibility(out, instrumento),
      error = function(e) NULL
    )
    if (!is.null(compat)) {
      attr(out, "xlsform_compatibility") <- compat
      if (!isTRUE(compat$ok)) {
        message("[pulso] data/XLSForm incompatibles tras normalizar .pulso: ", compat$message)
      }
    }
    if (already_normalized && !is.null(compat_prev) && !is.null(compat)) {
      same_ok <- identical(isTRUE(compat_prev$ok), isTRUE(compat$ok))
      same_missing <- setequal(
        as.character(compat_prev$missing_columns %||% compat_prev$missing_variables %||% character(0)),
        as.character(compat$missing_columns %||% compat$missing_variables %||% character(0))
      )
      if (isTRUE(same_ok) && isTRUE(same_missing)) return(NULL)
    }
    if (!already_normalized && is.null(attr(out, "xlsform_normalized")) && is.null(compat)) {
      return(NULL)
    }
    out
  }

  if (!is.null(s$rp_data) && !is.null(inst)) {
    new_rp <- renorm_one(s$rp_data, inst)
    if (!is.null(new_rp)) {
      s$rp_data <- new_rp
      s$data_xlsform_compatibility <- attr(new_rp, "xlsform_compatibility", exact = TRUE)
      changed <- TRUE
    }
  }

  # Multi-base: cada base del estudio tiene su propio rp_data + rp_inst.
  if (length(s$rp_data_sources) && length(s$estudio$bases)) {
    for (b in names(s$rp_data_sources)) {
      base_inst <- s$rp_inst_sources[[b]] %||% inst
      if (is.null(base_inst)) next
      new_b <- renorm_one(s$rp_data_sources[[b]], base_inst)
      if (!is.null(new_b)) {
        s$rp_data_sources[[b]] <- new_b
        if (!is.null(s$estudio$bases[[b]])) {
          s$estudio$bases[[b]]$compatibilidad <- attr(new_b, "xlsform_compatibility", exact = TRUE)
        }
        changed <- TRUE
      }
    }
  }

  if (!changed) return(invisible(NULL))

  # La auditoría cacheada está escrita contra los nombres viejos: invalidar
  # para que la próxima visita a Validación corra una auditoría fresca con
  # la data ya normalizada.
  s$evaluacion <- NULL
  if (length(s$estudio$bases)) {
    for (b in names(s$estudio$bases)) {
      if (!is.null(s$estudio$bases[[b]]$validacion)) {
        s$estudio$bases[[b]]$validacion$evaluacion <- NULL
      }
    }
  }

  .session_env[[sid]] <- s
  invisible(NULL)
}

# Recolecta los file_ids que son INPUTS del proyecto — los que el state
# referencia explícitamente desde sus campos canónicos. Excluye outputs
# generados por el pipeline (codebooks, reportes, planes exportados,
# data_adaptada, etc.) que vivirán como archivos independientes al lado
# del .pulso. Devuelve un vector de file_ids únicos.
.pulso_collect_input_fids <- function(s) {
  out <- character(0)

  # Multi-base: cada base referencia su xlsform y su data.
  if (!is.null(s$estudio) && length(s$estudio$bases) > 0L) {
    for (b in s$estudio$bases) {
      if (!is.null(b$xlsform_file_id) && nzchar(b$xlsform_file_id)) {
        out <- c(out, b$xlsform_file_id)
      }
      if (!is.null(b$data_file_id) && nzchar(b$data_file_id)) {
        out <- c(out, b$data_file_id)
      }
      if (!is.null(b$original_xlsform_file_id) && nzchar(b$original_xlsform_file_id)) {
        out <- c(out, b$original_xlsform_file_id)
      }
      if (!is.null(b$original_data_file_id) && nzchar(b$original_data_file_id)) {
        out <- c(out, b$original_data_file_id)
      }
      multi <- b$multi_integrated %||% list()
      if (!is.null(multi$guide_xlsform_file_id) && nzchar(multi$guide_xlsform_file_id)) {
        out <- c(out, multi$guide_xlsform_file_id)
      }
      for (origin in (multi$origins %||% list())) {
        fid_x <- as.character(origin$xlsform_file_id %||% "")
        fid_d <- as.character(origin$data_file_id %||% "")
        if (nzchar(fid_x)) out <- c(out, fid_x)
        if (nzchar(fid_d)) out <- c(out, fid_d)
      }
    }
  }
  # Codificación: el xlsx de familias y la plantilla de códigos editada
  # por el analista son inputs (los outputs como data_adaptada NO).
  if (!is.null(s$codif_por_base) && length(s$codif_por_base) > 0L) {
    for (sub in s$codif_por_base) {
      if (!is.null(sub$familias_file_id) && nzchar(sub$familias_file_id)) {
        out <- c(out, sub$familias_file_id)
      }
      if (!is.null(sub$plantilla_codigos_file_id) &&
          nzchar(sub$plantilla_codigos_file_id)) {
        out <- c(out, sub$plantilla_codigos_file_id)
      }
    }
  }
  # Legacy single-base: data_raw_meta apunta al file_id de data.
  if (!is.null(s$data_raw_meta) && !is.null(s$data_raw_meta$file_id) &&
      nzchar(s$data_raw_meta$file_id)) {
    out <- c(out, s$data_raw_meta$file_id)
  }
  # Dashboard autónomo: su importador guarda su propio par XLSForm+data.
  # Si el proyecto se guarda, estos inputs deben viajar en el .pulso.
  if (!is.null(s$dashboard_source)) {
    if (!is.null(s$dashboard_source$xlsform_file_id) &&
        nzchar(s$dashboard_source$xlsform_file_id)) {
      out <- c(out, s$dashboard_source$xlsform_file_id)
    }
    if (!is.null(s$dashboard_source$data_file_id) &&
        nzchar(s$dashboard_source$data_file_id)) {
      out <- c(out, s$dashboard_source$data_file_id)
    }
  }
  # Borrador del flujo "integrar instrumentos hermanos". Antes de importar,
  # estos file_id todavía no pertenecen a una base del estudio, pero sí son
  # insumos reales del proyecto y deben viajar con el .pulso.
  if (!is.null(s$multi_integrated_draft) && is.list(s$multi_integrated_draft)) {
    draft <- s$multi_integrated_draft
    add_fid <- function(x) {
      x <- as.character(x %||% "")
      x <- x[nzchar(x)]
      if (length(x)) out <<- c(out, x)
    }
    add_fid(draft$guide_xlsform_file_id)
    guide_options <- draft$guide_options %||% list()
    if (is.data.frame(guide_options)) {
      for (i in seq_len(nrow(guide_options))) {
        add_fid(guide_options$file_id[i] %||% guide_options$fileId[i])
      }
    } else if (length(guide_options)) {
      for (opt in guide_options) {
        add_fid(opt$file_id %||% opt$fileId)
      }
    }
    draft_rows <- draft$rows %||% list()
    if (is.data.frame(draft_rows)) {
      for (i in seq_len(nrow(draft_rows))) {
        add_fid(draft_rows$xlsform_file_id[i] %||% draft_rows$xlsformFileId[i])
        add_fid(draft_rows$data_file_id[i] %||% draft_rows$dataFileId[i])
      }
    } else if (length(draft_rows)) {
      for (row in draft_rows) {
        add_fid(row$xlsform_file_id %||% row$xlsformFileId)
        add_fid(row$data_file_id %||% row$dataFileId)
      }
    }
  }
  # Defensivo: si la sesión tiene un xlsform en s$files pero no está
  # referenciado por ninguna base (ej. el user lo cargó pero no llamó a
  # estudio_init_default_base por algún edge case), igual lo incluimos
  # para que el .pulso sea reabrible. Solo el último xlsform — los
  # anteriores son obsoletos.
  if (!is.null(s$files) && length(s$files) > 0L) {
    xls_fids <- character(0)
    for (fid in names(s$files)) {
      f <- s$files[[fid]]
      if (identical(f$kind, "xlsform")) xls_fids <- c(xls_fids, fid)
    }
    if (length(xls_fids) > 0L) {
      out <- c(out, xls_fids[length(xls_fids)])
    }
  }

  unique(out)
}

# Reescribe s$files[[*]]$path para que apunten al nuevo tempdir de sesión
# tras un load_pulso. Los files físicos ya fueron copiados por el caller a
# `uploads_dir`.
.pulso_rewrite_paths <- function(s, uploads_dir) {
  if (is.null(s$files) || !length(s$files)) return(s)
  for (fid in names(s$files)) {
    meta <- s$files[[fid]]
    if (is.null(meta) || is.null(meta$ext)) next
    new_path <- file.path(uploads_dir, sprintf("%s.%s", fid, meta$ext))
    if (file.exists(new_path)) {
      s$files[[fid]]$path <- new_path
    }
    # Si no existe el archivo físico en el nuevo dir, dejamos el path NULL
    # para que los routers detecten el missing y muestren error claro.
  }
  # Algunos campos de sesión también guardan paths cacheados. Los dejamos
  # consistentes con el files store.
  if (!is.null(s$data_raw_meta) && !is.null(s$data_raw_meta$file_id)) {
    fid <- s$data_raw_meta$file_id
    if (!is.null(s$files[[fid]])) {
      s$data_raw_meta$path <- s$files[[fid]]$path
    }
  }
  s
}

# -----------------------------------------------------------------------------
# build_pulso — guarda la sesión actual a un .pulso
# -----------------------------------------------------------------------------
# Args:
#   sid         — session id activa
#   dest_path   — path absoluto del .pulso (se crea o reemplaza)
#   project_name — nombre humano para el manifest (opcional)
# Retorna list(ok=TRUE, size, saved_at).
build_pulso <- function(sid, dest_path, project_name = NULL) {
  if (!requireNamespace("zip", quietly = TRUE)) {
    stop_api(500, "E_NO_ZIP", "El paquete R 'zip' no está instalado.")
  }
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    stop_api(500, "E_NO_JSONLITE", "El paquete R 'jsonlite' no está instalado.")
  }

  s <- session_get(sid)

  # Staging temp para armar el zip.
  stage_dir <- tempfile("pulso_stage_")
  dir.create(stage_dir, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(stage_dir, recursive = TRUE, force = TRUE), add = TRUE)

  # 1) Recolectar los file_ids que son INPUTS del proyecto (referenciados
  #    desde el state). Excluye los outputs/entregables generados por el
  #    pipeline — esos son archivos independientes que el analista guarda
  #    al lado del .pulso vía /api/fs/save-to-project.
  needed_fids <- .pulso_collect_input_fids(s)

  # 2) Copiar solo los files referenciados (nombre estable <fid>__<orig>)
  files_dir <- file.path(stage_dir, "files")
  dir.create(files_dir, recursive = TRUE, showWarnings = FALSE)
  if (!is.null(s$files) && length(s$files) > 0L && length(needed_fids) > 0L) {
    for (fid in needed_fids) {
      meta <- s$files[[fid]]
      if (is.null(meta) || is.null(meta$path) || !file.exists(meta$path)) next
      # Doble underscore como separador — improbable en nombres reales,
      # se splittea sin ambigüedad en load.
      safe_name <- gsub("[/\\\\]", "_", as.character(meta$original_name %||% "file"))
      dst <- file.path(files_dir, sprintf("%s__%s", fid, safe_name))
      file.copy(meta$path, dst, overwrite = TRUE)
    }
    # Recortar s$files al subset que efectivamente viaja, para que al
    # reabrir el state no queden referencias colgantes a archivos que
    # ya no existen (los outputs viejos del tempdir original quedan
    # inalcanzables tras el reopen).
    s$files <- s$files[intersect(needed_fids, names(s$files))]
  } else {
    s$files <- list()
  }

  # 2) Serializar estado (sin caches) a state.rds
  s_clean <- .pulso_strip_caches(s)
  # No persistimos estos campos transient:
  s_clean$dir <- NULL                # tempdir cambia entre sesiones
  s_clean$project_path <- NULL        # lo setea el load
  s_clean$project_dirty <- NULL
  s_clean$project_last_saved_at <- NULL
  saveRDS(s_clean, file = file.path(stage_dir, "state.rds"),
          version = 3, compress = "xz")

  # 3) Manifest JSON
  app_version <- tryCatch(
    as.character(utils::packageVersion("prosecnurapp")),
    error = function(e) "dev"
  )
  n_bases <- length(s$estudio$bases %||% list())
  manifest <- list(
    format_version    = 1L,
    app_version       = app_version,
    project_name      = project_name %||% (s$estudio$nombre %||% NA_character_),
    processing_mode   = (s$estudio %||% list())$processing_mode %||% "multibase",
    active_base       = (s$estudio %||% list())$active_base %||% NA_character_,
    n_bases           = n_bases,
    n_files           = length(s$files %||% list()),
    created_at        = format(s$created_at %||% Sys.time(),
                                "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    saved_at          = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  )
  writeLines(
    jsonlite::toJSON(manifest, auto_unbox = TRUE, pretty = TRUE),
    con = file.path(stage_dir, "manifest.json"), useBytes = TRUE
  )

  # 4) Zip staging → dest_path (atomic: primero a .tmp, luego rename)
  dest_dir <- dirname(dest_path)
  if (!dir.exists(dest_dir)) dir.create(dest_dir, recursive = TRUE, showWarnings = FALSE)
  tmp_out <- paste0(dest_path, ".tmp")
  old_wd <- getwd()
  setwd(stage_dir)
  on.exit(setwd(old_wd), add = TRUE)
  tryCatch({
    entries <- list.files(".", recursive = TRUE, all.files = FALSE)
    zip::zip(tmp_out, files = entries)
  }, error = function(e) {
    unlink(tmp_out, force = TRUE)
    stop_api(500, "E_PULSO_ZIP_FAILED",
             sprintf("No se pudo crear el .pulso: %s", conditionMessage(e)))
  })
  setwd(old_wd)
  # Rename atómico
  file.rename(tmp_out, dest_path)

  # Actualizar estado en la sesión
  now_iso <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  s$project_path <- dest_path
  s$project_dirty <- FALSE
  s$project_last_saved_at <- now_iso
  .session_env[[sid]] <- s

  list(
    ok        = TRUE,
    path      = dest_path,
    size      = as.integer(file.info(dest_path)$size),
    saved_at  = now_iso
  )
}

# -----------------------------------------------------------------------------
# load_pulso — abre un .pulso y restaura la sesión
# -----------------------------------------------------------------------------
# Crea una sesión NUEVA (sid fresco + tempdir fresco), copia los files/ del
# zip al uploads/ de esa sesión, carga el state.rds con reescritura de paths,
# y setea project_path. Devuelve list(sid, project_path, manifest).
load_pulso <- function(src_path) {
  if (!file.exists(src_path)) {
    stop_api(404, "E_PULSO_NOT_FOUND",
             sprintf("No existe el archivo: %s", src_path))
  }
  if (!requireNamespace("zip", quietly = TRUE)) {
    stop_api(500, "E_NO_ZIP", "El paquete R 'zip' no está instalado.")
  }
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    stop_api(500, "E_NO_JSONLITE", "El paquete R 'jsonlite' no está instalado.")
  }

  # 1) Descomprimir a staging
  stage_dir <- tempfile("pulso_load_")
  dir.create(stage_dir, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(stage_dir, recursive = TRUE, force = TRUE), add = TRUE)

  zip::unzip(src_path, exdir = stage_dir)

  # 2) Leer manifest (tolerante — si no hay, asumimos format 1)
  manifest_path <- file.path(stage_dir, "manifest.json")
  manifest <- if (file.exists(manifest_path)) {
    tryCatch(jsonlite::fromJSON(manifest_path, simplifyVector = TRUE),
             error = function(e) list(format_version = 1L))
  } else list(format_version = 1L)

  # 3) Validar state.rds presente
  state_path <- file.path(stage_dir, "state.rds")
  if (!file.exists(state_path)) {
    stop_api(400, "E_PULSO_CORRUPT",
             "El .pulso no contiene state.rds. ¿Archivo corrupto?")
  }
  s_saved <- tryCatch(readRDS(state_path), error = function(e) {
    stop_api(400, "E_PULSO_READ_FAILED",
             sprintf("No se pudo leer state.rds: %s", conditionMessage(e)))
  })

  # 4) Crear sesión fresca (sid nuevo, tempdir propio)
  new_sid <- session_create()
  new_sess <- session_get(new_sid)
  uploads_dir <- file.path(new_sess$dir, "uploads")
  dir.create(uploads_dir, recursive = TRUE, showWarnings = FALSE)

  # 5) Copiar files/ del zip a uploads/ del nuevo sess, con path canónico
  #    <file_id>.<ext>  (para que la reescritura de paths matchee).
  zip_files_dir <- file.path(stage_dir, "files")
  if (dir.exists(zip_files_dir) && !is.null(s_saved$files)) {
    zip_entries <- list.files(zip_files_dir, full.names = TRUE)
    for (fid in names(s_saved$files)) {
      meta <- s_saved$files[[fid]]
      if (is.null(meta$ext)) next
      # Match por prefijo "<fid>__"
      matching <- zip_entries[startsWith(basename(zip_entries),
                                           paste0(fid, "__"))]
      if (length(matching) > 0L) {
        src <- matching[1]
        dst <- file.path(uploads_dir, sprintf("%s.%s", fid, meta$ext))
        file.copy(src, dst, overwrite = TRUE)
      }
    }
  }

  # 6) Reescribir paths en s_saved$files y fusionar con el sess fresco
  s_saved <- .pulso_rewrite_paths(s_saved, uploads_dir)
  s_saved$id  <- new_sid           # preservar sid nuevo
  s_saved$dir <- new_sess$dir      # preservar tempdir nuevo
  s_saved$project_path <- normalizePath(src_path, mustWork = FALSE)
  s_saved$project_dirty <- FALSE
  s_saved$project_last_saved_at <- as.character(
    manifest$saved_at %||% format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  )
  # Invalidar ctx del dashboard: contiene closures (`label_var`, etc.)
  # que capturan `.dim_nm_get` en su environment original. En otro
  # proceso R esas closures fallan; reconstruir lazy en próxima llamada.
  # Compat con .pulso viejos que persistían el ctx antes de que
  # `_strip_caches` lo invalidara.
  s_saved$dashboard_dim_ctx <- NULL
  .session_env[[new_sid]] <- s_saved

  # 7) Rebuild de caches dashboard (rp_inst / rp_data) a partir de los
  #    file_ids persistidos en dashboard_source. No falla si no hay fuente.
  .dashboard_rebuild_after_load(new_sid)
  .pulso_repair_multibase_variant_xlsforms(new_sid)
  .pulso_repair_parent_recod_columns(new_sid)
  .pulso_rebuild_estudio_runtime_sources(new_sid)
  .pulso_renormalize_after_load(new_sid)

  list(
    ok            = TRUE,
    session_id    = new_sid,
    project_path  = s_saved$project_path,
    manifest      = manifest
  )
}

# -----------------------------------------------------------------------------
# project_status — lectura ligera del estado del proyecto activo
# -----------------------------------------------------------------------------
project_status <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) {
    return(list(
      has_project = FALSE,
      path = NA_character_,
      dirty = FALSE,
      last_saved_at = NA_character_
    ))
  }
  has <- !is.null(s$project_path) && nzchar(s$project_path)
  list(
    has_project   = has,
    path          = if (has) as.character(s$project_path) else NA_character_,
    name          = if (has) tools::file_path_sans_ext(basename(s$project_path))
                     else NA_character_,
    dirty         = isTRUE(s$project_dirty),
    last_saved_at = s$project_last_saved_at %||% NA_character_
  )
}

# -----------------------------------------------------------------------------
# project_close — limpia project_path sin cerrar la sesión
# -----------------------------------------------------------------------------
project_close <- function(sid) {
  s <- session_get(sid)
  s$project_path <- NULL
  s$project_dirty <- FALSE
  s$project_last_saved_at <- NULL
  .session_env[[sid]] <- s
  invisible(TRUE)
}
