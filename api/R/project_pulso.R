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
# Excepción deliberada:
#   - s$monitoreo_territorial_map_cache — cache compacta de geometría de ruta
#     y GPS clasificado por fase. Viaja en el .pulso para evitar recomputar
#     cruces sf costosos al reabrir proyectos territoriales.
#   - s$monitoreo_snapshot$territorial_report_cache — reportes territoriales
#     derivados por fase/fuente/scope. Viajan en el .pulso para que Hojas,
#     Consultas y Validación reabran desde el estado local ya preparado.
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
  s$monitoreo_dashboard_cache <- NULL
  s$monitoreo_dashboard_cache_token <- NULL
  s$monitoreo_dashboard_light_cache <- NULL
  s$monitoreo_dashboard_light_cache_token <- NULL
  if (!is.null(s$calc_muestra_aulas_frame) && is.list(s$calc_muestra_aulas_frame)) {
    frame <- s$calc_muestra_aulas_frame
    if (is.data.frame(frame$aula_frame) && nrow(frame$aula_frame)) {
      pii_cols <- intersect(c("unique_student_ids"), names(frame$aula_frame))
      frame$aula_frame[pii_cols] <- NULL
    }
    frame$population <- NULL
    frame$exclusions <- NULL
    s$calc_muestra_aulas_frame <- frame
  }
  if (!is.null(s$calc_muestra_aulas_selection) && is.list(s$calc_muestra_aulas_selection)) {
    selection <- s$calc_muestra_aulas_selection
    if (is.data.frame(selection$selection) && nrow(selection$selection)) {
      pii_cols <- intersect(c("unique_student_ids"), names(selection$selection))
      selection$selection[pii_cols] <- NULL
    }
    s$calc_muestra_aulas_selection <- selection
  }
  # No limpiar s$monitoreo_territorial_map_cache ni
  # s$monitoreo_snapshot$territorial_report_cache: son caches persistentes,
  # versionadas y acotadas para acelerar Monitoreo territorial al abrir un
  # .pulso.
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
  .pulso_sanitize_graficos_consolidado_state(s)
}

.pulso_sanitize_graficos_consolidado_state <- function(s) {
  files <- s$files %||% list()
  draft <- s$graficos_consolidado_draft
  if (is.list(draft)) {
    draft$config <- .graficos_consolidado_portable_config(draft$config, files)
    s$graficos_consolidado_draft <- draft
  }
  recipe <- s$graficos_consolidado
  if (is.list(recipe)) {
    s$graficos_consolidado <- .graficos_consolidado_portable_recipe(recipe, files)
  }
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

.pulso_restore_active_stage_flags_after_load <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s) || is.null(s$estudio) || !length(s$estudio$bases %||% list())) {
    return(invisible(FALSE))
  }
  active <- .estudio_active_base_name(s, fallback_first = TRUE)
  if (is.null(active) || !nzchar(as.character(active))) return(invisible(FALSE))

  # `_pulso_strip_caches()` pone en FALSE algunos mirrors globales de Analítica
  # porque sus objetos runtime no viajan en el ZIP. En un estudio de bases
  # independientes, el estado autoritativo sí persiste por base; al abrir hay
  # que reproyectarlo sobre la base activa sin ensuciar el proyecto.
  #
  # `capture` ANTES de `apply` es el patrón canónico (ver `estudio_active_base_set`
  # y la promoción a independent_siblings): sin la captura previa, `apply`
  # trataría como FALSE cualquier flag que sólo vivía en el mirror global
  # persistido —p. ej. `analitica_dim_ok` de proyectos de base única o de la
  # referencia de auditoría— y lo borraría al reabrir. Con la captura, ese flag
  # se promueve al mapa por base y `apply` lo devuelve idéntico, mientras los
  # flags que sí viven por base se siguen reproyectando.
  restored <- .estudio_capture_stage_flags(s, active)
  restored <- .estudio_apply_stage_flags(restored, active)
  .session_env[[sid]] <- restored
  invisible(TRUE)
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

  # Asegura el override de etiquetas activo para las construcciones de esta
  # reconstrucción (también se llama fuera de load_pulso, p. ej. desde
  # Validación/Gráficos). NO-OP sin override persistido.
  if (exists(".label_overrides_activate", mode = "function")) {
    tryCatch(.label_overrides_activate(s$label_overrides), error = function(e) NULL)
  }

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
        norm_ok <- TRUE
        data_norm <- tryCatch(
          normalize_data_for_xlsform(raw_df, inst, choice_code_maps = choice_maps),
          error = function(e) { norm_ok <<- FALSE; raw_df }
        )
        data_cache <- tryCatch(
          reporte_data(data_norm, instrumento = inst),
          error = function(e) data_norm
        )
        # CURA (frente B): esta es la RECONSTRUCCIÓN canónica de `rp_data` desde
        # el archivo persistido; alimenta Validación, Analítica, Gráficos y
        # Dashboard. Sanear acá cura las bases del handoff ya guardadas (dups
        # group-prefixed, `.integration_mode`, universo vacío) de forma uniforme
        # en un solo punto, en paridad con "Ver base" (misma `sanitize_base_data`).
        if (exists("sanitize_base_data", mode = "function")) {
          data_cache <- tryCatch(
            sanitize_base_data(
              data_cache, inst,
              monitoreo_handoff = .base_hygiene_is_monitoreo_kind(base$source_kind %||% "")
            ),
            error = function(e) data_cache
          )
        }
        # Marcar `data_cache` como ya normalizado por el pipeline de ESTE load.
        # `normalize_data_for_xlsform` solo deja el atributo `xlsform_normalized`
        # cuando realmente colapsa dummies/aliases; si la data cruda ya venía en
        # forma "madre" (select_multiple con tokens separados por espacio, sin
        # columnas dummy) no hay trabajo de colapso y el atributo NO se setea,
        # aunque la data SÍ quedó canónicamente normalizada. Sin ese marcador,
        # `.pulso_renormalize_after_load` cree que la base está sin normalizar y
        # RE-EJECUTA `normalize_data_for_xlsform` sobre la salida de `reporte_data`
        # (que ya expandió los select_multiple a dummies `var.opcion`); esa segunda
        # pasada vuelve a colapsar los dummies a la madre y los dropea, destruyendo
        # la distribución (bug: `obstacle` mostraba solo `other`). Por eso, cuando
        # normalize corrió sin error, propagamos el atributo existente o dejamos un
        # marcador mínimo idempotente para que el paso post-load respete la base.
        if (isTRUE(norm_ok)) {
          normalized_attr <- attr(data_norm, "xlsform_normalized", exact = TRUE)
          if (is.null(normalized_attr)) {
            normalized_attr <- list(
              normalized_at          = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
              select_multiple        = list(),
              aliases                = list(),
              single_child_collapses = list(),
              select_one_other_recodes = list(),
              choice_code_maps       = list(),
              dropped_columns        = character(0)
            )
          }
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
  x <- as.character(x %||% "")
  x[is.na(x)] <- ""
  x <- trimws(x)
  x <- if (requireNamespace("stringi", quietly = TRUE)) {
    stringi::stri_trans_general(x, "Latin-ASCII")
  } else {
    iconv(x, from = "", to = "ASCII//TRANSLIT", sub = "")
  }
  x[is.na(x)] <- ""
  x <- tolower(x)
  x <- gsub("['`^~\"]", "", x)
  trimws(gsub("\\s+", " ", x))
}

.pulso_next_free_code <- function(used) {
  used <- unique(as.character(used %||% character(0)))
  nums <- suppressWarnings(as.integer(used))
  candidate <- if (any(!is.na(nums))) max(nums[!is.na(nums)], na.rm = TRUE) + 1L else 1L
  while (as.character(candidate) %in% used) candidate <- candidate + 1L
  as.character(candidate)
}

.pulso_repair_parent_recod_df <- function(df, parent, text_col, code_map = NULL, groups = NULL) {
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

  group_vals <- rep(NA_character_, nrow(df))
  has_group_vals <- rep(FALSE, nrow(df))
  if (!is.null(groups) && length(groups) && text_col %in% names(df)) {
    lookup <- new.env(parent = emptyenv())
    for (g in groups) {
      code <- as.character(g$codigo %||% "")
      if (!nzchar(code)) next
      if (!is.null(code_map) && length(code_map) && code %in% names(code_map)) {
        code <- as.character(code_map[[code]])
      }
      for (resp in (g$respuestas %||% list())) {
        key <- .pulso_norm_label(resp)
        if (nzchar(key)) assign(key, code, envir = lookup)
      }
    }
    for (i in seq_along(text_vals)) {
      if (!has_text[i]) next
      key <- .pulso_norm_label(text_vals[[i]])
      if (nzchar(key) && exists(key, envir = lookup, inherits = FALSE)) {
        group_vals[[i]] <- get(key, envir = lookup, inherits = FALSE)
        has_group_vals[[i]] <- !.pulso_blank_value(group_vals[[i]])
      }
    }
  }

  old_names <- names(df)
  old_vals <- if (parent_recod %in% names(df)) as.character(df[[parent_recod]]) else NULL
  out_vals <- if (!is.null(old_vals)) old_vals else parent_vals
  fill_parent <- .pulso_blank_value(out_vals) &
    (!has_text | !isTRUE(has_other_recod_col)) &
    !.pulso_blank_value(parent_vals)
  out_vals[fill_parent] <- parent_vals[fill_parent]
  if (isTRUE(has_other_recod_col)) out_vals[has_text & !has_rec] <- NA_character_
  if (any(has_group_vals)) {
    out_vals[has_text] <- NA_character_
    out_vals[has_group_vals] <- group_vals[has_group_vals]
  }
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
    group_choices <- choices[0, , drop = FALSE]
    groups <- rep$groups %||% list()
    if (length(groups)) {
      for (g in groups) {
        code <- as.character(g$codigo %||% "")
        if (!nzchar(code)) next
        label <- as.character(g$etiqueta %||% "")
        if (is.na(label) || !nzchar(trimws(label))) label <- code
        if (identical(as.character(g$origen %||% ""), "existente")) {
          code_map <- c(code_map, stats::setNames(code, code))
          next
        }
        row <- choices[0, , drop = FALSE]
        if (!nrow(row)) {
          row <- as.data.frame(
            as.list(stats::setNames(rep(NA_character_, length(names(choices))), names(choices))),
            stringsAsFactors = FALSE,
            check.names = FALSE
          )
        } else {
          row <- row[1, , drop = FALSE]
        }
        row$list_name <- recod_list
        row$name <- code
        row[[lab_col_c]] <- label
        group_choices <- rbind(group_choices, row[, names(group_choices), drop = FALSE])
      }
      add_source_rows(group_choices)
    }
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
  codif_state <- s$codif_por_base[[base_name]] %||% list()
  draft <- (codif_state$familias_draft %||% list())$rows %||% list()
  groups_map <- codif_state$grupos_recod %||% list()
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
    groups <- groups_map[[parent]] %||%
      groups_map[[as.character(row$parent %||% "")]] %||%
      groups_map[[text_col]] %||%
      list()
    out[[length(out) + 1L]] <- list(parent = parent, text_col = text_col, groups = groups)
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
        fixed <- .pulso_repair_parent_recod_df(df, rep$parent, rep$text_col, rep$code_map, rep$groups)
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
  validation_inputs_changed <- FALSE

  renorm_one <- function(data, instrumento) {
    if (is.null(data) || is.null(instrumento)) return(NULL)
    compat_prev <- attr(data, "xlsform_compatibility", exact = TRUE)
    already_normalized <- !is.null(attr(data, "xlsform_normalized"))
    # El rebuild de este mismo load coloca el sello después de normalizar el
    # archivo canónico y antes de expandirlo para reportes. Validar otra vez la
    # forma expandida contra el XLSForm produce falsos `missing_columns` (la
    # madre de un select_multiple ya fue sustituida por dummies) y no mide un
    # cambio real del input. El sello es, por tanto, el guard idempotente.
    if (already_normalized) return(NULL)
    out <- tryCatch(
      normalize_data_for_xlsform(data, instrumento),
      error = function(e) NULL
    )
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

  normalize_pair <- function(data, instrumento) {
    if (is.null(data) || is.null(instrumento)) return(NULL)
    out_data <- renorm_one(data, instrumento)
    # `NULL` significa que el cache ya es canónico y su compatibilidad no
    # cambió. No vuelvas a aplicar el contexto de reporte: además de ser
    # redundante, algunos instrumentos producen diferencias de atributos que
    # marcaban `changed = TRUE` y borraban auditorías/releases válidas al
    # reabrir el mismo `.pulso`.
    if (is.null(out_data)) return(NULL)
    out_inst <- instrumento
    if (exists(".bases_normalize_report_context", mode = "function")) {
      ctx <- tryCatch(
        .bases_normalize_report_context(out_data, out_inst),
        error = function(e) NULL
      )
      if (!is.null(ctx)) {
        out_data <- ctx$data
        out_inst <- ctx$inst
      }
    }
    if (identical(out_data, data) && identical(out_inst, instrumento)) return(NULL)
    list(data = out_data, inst = out_inst)
  }

  if (!is.null(s$rp_data) && !is.null(inst)) {
    new_rp <- normalize_pair(s$rp_data, inst)
    if (!is.null(new_rp)) {
      s$rp_data <- new_rp$data
      s$rp_inst <- new_rp$inst
      inst <- new_rp$inst
      s$data_xlsform_compatibility <- attr(new_rp$data, "xlsform_compatibility", exact = TRUE)
      changed <- TRUE
      validation_inputs_changed <- TRUE
    }
  }

  # Multi-base: cada base del estudio tiene su propio rp_data + rp_inst.
  if (length(s$rp_data_sources) && length(s$estudio$bases)) {
    for (b in names(s$rp_data_sources)) {
      base_inst <- s$rp_inst_sources[[b]] %||% inst
      if (is.null(base_inst)) next
      old_b <- s$rp_data_sources[[b]]
      new_b <- normalize_pair(old_b, base_inst)
      if (!is.null(new_b)) {
        was_primary <- identical(s$rp_data, old_b) || identical(s$rp_inst, base_inst)
        s$rp_data_sources[[b]] <- new_b$data
        s$rp_inst_sources[[b]] <- new_b$inst
        if (isTRUE(was_primary)) {
          s$rp_data <- new_b$data
          s$rp_inst <- new_b$inst
        }
        if (!is.null(s$estudio$bases[[b]])) {
          s$estudio$bases[[b]]$compatibilidad <- attr(new_b$data, "xlsform_compatibility", exact = TRUE)
        }
        changed <- TRUE
        validation_inputs_changed <- TRUE
      }
    }
  }

  if (!is.null(s$analitica_rp_data) && !is.null(s$analitica_rp_inst)) {
    new_an <- normalize_pair(s$analitica_rp_data, s$analitica_rp_inst)
    if (!is.null(new_an)) {
      s$analitica_rp_data <- new_an$data
      s$analitica_rp_inst <- new_an$inst
      changed <- TRUE
    }
  }

  if (length(s$analitica_rp_data_sources) && length(s$analitica_rp_inst_sources)) {
    for (b in intersect(names(s$analitica_rp_data_sources), names(s$analitica_rp_inst_sources))) {
      new_b <- normalize_pair(s$analitica_rp_data_sources[[b]], s$analitica_rp_inst_sources[[b]])
      if (!is.null(new_b)) {
        s$analitica_rp_data_sources[[b]] <- new_b$data
        s$analitica_rp_inst_sources[[b]] <- new_b$inst
        changed <- TRUE
      }
    }
  }

  if (!is.null(s$dashboard_rp_data) && !is.null(s$dashboard_rp_inst)) {
    new_dash <- normalize_pair(s$dashboard_rp_data, s$dashboard_rp_inst)
    if (!is.null(new_dash)) {
      s$dashboard_rp_data <- new_dash$data
      s$dashboard_rp_inst <- new_dash$inst
      changed <- TRUE
    }
  }

  if (!changed) return(invisible(NULL))

  # Solo un cambio en las fuentes que consume Validación invalida su
  # auditoría. Renormalizar caches de Analítica o Dashboard no cambia aquello
  # que Validación revisó y no debe volver stale releases independientes.
  if (isTRUE(validation_inputs_changed)) {
    s$evaluacion <- NULL
    if (length(s$estudio$bases)) {
      for (b in names(s$estudio$bases)) {
        if (!is.null(s$estudio$bases[[b]]$validacion)) {
          s$estudio$bases[[b]]$validacion$evaluacion <- NULL
        }
      }
    }
  }

  .session_env[[sid]] <- s
  invisible(NULL)
}

# Cálculo de muestra puede declarar bases institucionales antes de construir
# el marco. Esas bases son inputs canónicos aunque no pertenezcan a
# s$estudio$bases, así que deben viajar dentro del .pulso.
.pulso_collect_calc_muestra_fids <- function(s) {
  out <- character(0)
  add_fid <- function(value) {
    value <- as.character(value %||% "")
    value <- value[!is.na(value) & nzchar(value)]
    if (length(value)) out <<- c(out, value)
  }
  collect_binding <- function(binding) {
    if (is.null(binding)) return(invisible(NULL))
    if (is.data.frame(binding)) {
      if ("file_id" %in% names(binding)) {
        for (value in binding$file_id) add_fid(value)
      }
      if ("fileId" %in% names(binding)) {
        for (value in binding$fileId) add_fid(value)
      }
      return(invisible(NULL))
    }
    if (!is.list(binding)) return(invisible(NULL))
    add_fid(binding$file_id %||% binding$fileId)
    invisible(NULL)
  }

  estudio <- s$calc_muestra_estudio %||% NULL
  workspace <- if (is.list(estudio)) estudio$workspace %||% NULL else NULL
  bindings <- if (is.list(workspace)) workspace$source_bindings %||% list() else list()
  if (is.data.frame(bindings)) {
    collect_binding(bindings)
  } else if (length(bindings)) {
    for (binding in bindings) collect_binding(binding)
  }

  unique(out)
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
      universe_filter <- b$universe_filter %||% list()
      for (fid in c(universe_filter$source_data_file_id,
                    universe_filter$effective_data_file_id)) {
        fid <- as.character(fid %||% "")
        if (length(fid) && nzchar(fid[1])) out <- c(out, fid[1])
      }
      if (!is.null(b$surveymonkey_raw_snapshot_file_id) && nzchar(b$surveymonkey_raw_snapshot_file_id)) {
        out <- c(out, b$surveymonkey_raw_snapshot_file_id)
      }
      if (!is.null(b$surveymonkey_effective_data_file_id) && nzchar(b$surveymonkey_effective_data_file_id)) {
        out <- c(out, b$surveymonkey_effective_data_file_id)
      }
      if (!is.null(b$surveymonkey_workbook_file_id) && nzchar(b$surveymonkey_workbook_file_id)) {
        out <- c(out, b$surveymonkey_workbook_file_id)
      }
      if (!is.null(b$surveymonkey_workbook_snapshot_file_id) && nzchar(b$surveymonkey_workbook_snapshot_file_id)) {
        out <- c(out, b$surveymonkey_workbook_snapshot_file_id)
      }
      if (!is.null(b$surveymonkey_sav_bundle_file_id) && nzchar(b$surveymonkey_sav_bundle_file_id)) {
        out <- c(out, b$surveymonkey_sav_bundle_file_id)
      }
      if (!is.null(b$surveymonkey_sav_bundle_snapshot_file_id) && nzchar(b$surveymonkey_sav_bundle_snapshot_file_id)) {
        out <- c(out, b$surveymonkey_sav_bundle_snapshot_file_id)
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
  # Editor XLSForm: cada revisión publicada es un input inmutable y su archivo
  # debe sobrevivir aunque todavía no esté enlazado a una base de Procesamiento.
  # El registro viaja en state.rds; aquí preservamos todos los XLSX que refiere.
  if (!is.null(s$instrument_revisions) && length(s$instrument_revisions)) {
    for (revision in unname(s$instrument_revisions)) {
      fid <- as.character(revision$xlsform_file_id %||% "")[1]
      if (nzchar(fid)) out <- c(out, fid)
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
  # El draft y la receta consolidada guardan identidades de iconos por
  # file_id. Esos PNG son inputs editables del plan y deben viajar en el ZIP.
  add_consolidated_icon_fids <- function(config) {
    iconos <- (config %||% list())$iconos %||% list()
    if (!is.list(iconos)) return()
    for (icono in iconos) {
      if (!is.list(icono)) next
      fid <- as.character((icono %||% list())$file_id %||% "")
      fid <- fid[!is.na(fid) & nzchar(fid)]
      if (length(fid)) out <<- c(out, fid[[1]])
    }
  }
  add_consolidated_icon_fids((s$graficos_consolidado_draft %||% list())$config)
  add_consolidated_icon_fids((s$graficos_consolidado %||% list())$config)
  out <- c(out, .pulso_collect_calc_muestra_fids(s))
  # Monitoreo territorial: algunos insumos nacen dentro de Monitoreo, pero
  # luego son referencia canónica del proyecto. Si no viajan en el .pulso,
  # al reabrir quedan referencias colgantes aunque la configuración exista.
  if (!is.null(s$monitoreo_config) && is.list(s$monitoreo_config)) {
    add_mon_fid <- function(value) {
      value <- as.character(value %||% "")
      value <- value[nzchar(value)]
      if (length(value)) out <<- c(out, value)
    }
    territorial <- s$monitoreo_config$territorial %||% list()
    roster <- territorial$enumerator_roster %||%
      territorial$encuestadores_pulso %||%
      territorial$encuestadores %||%
      list()
    if (is.list(roster)) {
      add_mon_fid(roster$source_file_id %||% roster$sourceFileId)
    }
    occurrences <- territorial$field_occurrences %||%
      territorial$ocurrencias_campo %||%
      list()
    if (is.list(occurrences)) {
      add_mon_fid(occurrences$xlsform_file_id %||% occurrences$xlsformFileId)
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

.pulso_snapshot_has_content <- function(snapshot) {
  if (is.null(snapshot) || !is.list(snapshot)) return(FALSE)
  data <- snapshot$data %||% NULL
  if (is.data.frame(data) && nrow(data) > 0L) return(TRUE)
  if (length(snapshot$territorial_report_cache %||% list()) > 0L) return(TRUE)
  if (length(snapshot$dashboard %||% list()) > 0L) return(TRUE)
  if (length(snapshot$variables %||% list()) > 0L) return(TRUE)
  FALSE
}

.pulso_calc_muestra_has_content <- function(s) {
  if (is.null(s) || !is.list(s)) return(FALSE)
  estudio <- s$calc_muestra_estudio %||% NULL
  if (is.list(estudio)) {
    macro <- as.character(estudio$macro_familia %||% "")[1]
    if (isTRUE(nzchar(macro)) && !identical(macro, "estudio_propio")) return(TRUE)
    if (length(estudio$componentes %||% list()) > 0L) return(TRUE)
    titulo <- trimws(as.character(estudio$titulo %||% "")[1])
    if (isTRUE(nzchar(titulo)) && !identical(titulo, "Estudio sin título")) return(TRUE)
    workspace <- estudio$workspace %||% NULL
    if (is.list(workspace)) {
      frame_mode <- as.character(workspace$frame_mode %||% "")[1]
      if (isTRUE(nzchar(frame_mode)) && !identical(frame_mode, "sin_definir")) return(TRUE)
      if (length(workspace$source_bindings %||% list()) > 0L) return(TRUE)
      if (length(workspace$variable_mappings %||% list()) > 0L) return(TRUE)
      if (length(workspace$publication_config %||% list()) > 0L) return(TRUE)
    }
  }
  !is.null(s$calc_muestra_aulas_frame) ||
    !is.null(s$calc_muestra_aulas_selection) ||
    !is.null(s$calc_muestra_aulas_method_comparison) ||
    !is.null(s$calc_muestra_aulas_replacement_simulation)
}

.pulso_state_has_project_content <- function(s) {
  if (is.null(s) || !is.list(s)) return(FALSE)
  files <- s$files %||% list()
  bases <- (s$estudio %||% list())$bases %||% list()
  length(files) > 0L ||
    length(bases) > 0L ||
    .pulso_calc_muestra_has_content(s) ||
    length(s$monitoreo_sources %||% list()) > 0L ||
    .pulso_snapshot_has_content(s$monitoreo_snapshot %||% NULL) ||
    .pulso_snapshot_has_content(s$monitoreo_aulas_snapshot %||% NULL) ||
    length(s$monitoreo_aulas_plan %||% list()) > 0L ||
    length(s$monitoreo_territorial_map_cache %||% list()) > 0L
}

.pulso_existing_project_summary <- function(path) {
  info <- file.info(path)
  out <- list(
    exists = isTRUE(file.exists(path)),
    readable = FALSE,
    size = if (!is.na(info$size %||% NA_real_)) as.numeric(info$size) else NA_real_,
    manifest_n_files = NA_integer_,
    manifest_n_bases = NA_integer_,
    manifest_significant = FALSE,
    state_significant = FALSE,
    significant = FALSE
  )
  if (!isTRUE(out$exists)) return(out)

  stage_dir <- tempfile("pulso_guard_")
  dir.create(stage_dir, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(stage_dir, recursive = TRUE, force = TRUE), add = TRUE)

  ok <- tryCatch({
    utils::unzip(path, exdir = stage_dir)
    TRUE
  }, error = function(e) FALSE)
  if (!isTRUE(ok)) {
    out$significant <- is.finite(out$size) && out$size > 4096
    return(out)
  }
  out$readable <- TRUE

  manifest_path <- file.path(stage_dir, "manifest.json")
  if (file.exists(manifest_path)) {
    manifest <- tryCatch(jsonlite::fromJSON(manifest_path, simplifyVector = TRUE), error = function(e) list())
    out$manifest_n_files <- suppressWarnings(as.integer(manifest$n_files %||% NA_integer_))
    out$manifest_n_bases <- suppressWarnings(as.integer(manifest$n_bases %||% NA_integer_))
    out$manifest_significant <- isTRUE(out$manifest_n_files > 0L) || isTRUE(out$manifest_n_bases > 0L)
  }

  state_path <- file.path(stage_dir, "state.rds")
  if (file.exists(state_path)) {
    state <- tryCatch(readRDS(state_path), error = function(e) NULL)
    out$state_significant <- .pulso_state_has_project_content(state)
  }

  out$significant <- isTRUE(out$manifest_significant) || isTRUE(out$state_significant)
  out
}

# Lectura barata para las tarjetas de "proyectos recientes" del selector:
# descomprime SOLO manifest.json (nunca state.rds) y devuelve metadata liviana.
# Tolerante a rutas inexistentes o .pulso corruptos: siempre retorna una lista.
.pulso_manifest_peek <- function(path) {
  path <- as.character(path %||% "")[1]
  info <- if (nzchar(path)) file.info(path) else list(size = NA_real_)
  out <- list(
    path = path,
    exists = nzchar(path) && isTRUE(file.exists(path)),
    readable = FALSE,
    project_name = NA_character_,
    processing_mode = NA_character_,
    n_bases = NA_integer_,
    n_files = NA_integer_,
    saved_at = NA_character_,
    size = if (!is.na(info$size %||% NA_real_)) as.numeric(info$size) else NA_real_
  )
  if (!isTRUE(out$exists)) return(out)

  stage_dir <- tempfile("pulso_peek_")
  dir.create(stage_dir, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(stage_dir, recursive = TRUE, force = TRUE), add = TRUE)

  ok <- tryCatch({
    utils::unzip(path, files = "manifest.json", exdir = stage_dir)
    TRUE
  }, error = function(e) FALSE)
  manifest_path <- file.path(stage_dir, "manifest.json")
  if (!isTRUE(ok) || !file.exists(manifest_path)) return(out)
  out$readable <- TRUE

  manifest <- tryCatch(jsonlite::fromJSON(manifest_path, simplifyVector = TRUE),
                       error = function(e) list())
  out$project_name <- .peek_chr(manifest$project_name)
  out$processing_mode <- .peek_chr(manifest$processing_mode)
  out$saved_at <- .peek_chr(manifest$saved_at)
  out$n_bases <- suppressWarnings(as.integer(manifest$n_bases %||% NA_integer_))
  out$n_files <- suppressWarnings(as.integer(manifest$n_files %||% NA_integer_))
  ms <- manifest$modules_summary
  if (!is.null(ms) && length(ms)) {
    summary <- list(version = suppressWarnings(as.integer(ms$version %||% 1L)))
    states <- ms$states
    if (length(states)) {
      # as.list: fromJSON simplifica states a vector nombrado y jsonlite
      # serializa vectores nombrados como array (pierde las claves).
      summary$states <- as.list(setNames(as.character(unlist(states)), names(states)))
    }
    added <- ms$added
    if (!is.null(added) && length(added)) summary$added <- I(as.character(unlist(added)))
    out$modules_summary <- summary
  }
  out
}

.peek_chr <- function(value) {
  if (is.null(value) || length(value) == 0L) return(NA_character_)
  out <- suppressWarnings(as.character(value[[1]]))
  if (is.na(out) || !nzchar(trimws(out))) NA_character_ else out
}

.pulso_refuse_empty_project_overwrite <- function(s, dest_path, allow_empty_overwrite = FALSE) {
  if (isTRUE(allow_empty_overwrite)) return(invisible(FALSE))
  existing <- .pulso_existing_project_summary(dest_path)
  if (!isTRUE(existing$exists) || !isTRUE(existing$significant)) return(invisible(FALSE))
  if (.pulso_state_has_project_content(s)) return(invisible(FALSE))
  stop_api(
    409,
    "E_REFUSE_EMPTY_PROJECT_OVERWRITE",
    sprintf(
      "Prosecnur no sobrescribió '%s' porque el archivo existente contiene estado de proyecto y la sesión actual está vacía.",
      basename(dest_path)
    ),
    details = existing
  )
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

# Resumen compacto por módulo primario que viaja en manifest.json para que la
# torre de control (chooser de BootGate) pinte los módulos vivos de cada
# proyecto SIN abrirlo. Slugs sincronizados con lib/modules.ts; estados con la
# taxonomía ready/active/warning/pending de .diseno_module_statuses. Los
# sub-estados de procesamiento (carga..graficos) se agregan a un solo slug.
.pulso_manifest_modules_summary <- function(s) {
  protocol <- tryCatch(.diseno_protocol_summary(s), error = function(e) NULL)
  if (is.null(protocol)) return(NULL)
  statuses <- tryCatch(.diseno_module_statuses(s, protocol), error = function(e) NULL)
  if (is.null(statuses)) return(NULL)
  by_id <- list()
  for (item in statuses) by_id[[item$id]] <- item$state

  state_of <- function(ids) {
    states <- unlist(by_id[ids], use.names = FALSE)
    if (is.null(states) || !length(states)) return("pending")
    if (any(states == "warning")) return("warning")
    if (all(states == "ready")) return("ready")
    if (any(states %in% c("ready", "active"))) return("active")
    "pending"
  }

  bitacora_state <- state_of("plan-trabajo")
  if (bitacora_state == "pending" && length(.diseno_bitacora_entries(s)) > 0L) {
    bitacora_state <- "ready"
  }

  states <- list(
    "diseno-estudio" = bitacora_state,
    "calc-muestra"   = state_of("calc-muestra"),
    "editor-xlsform" = state_of("editor-xlsform"),
    "hojas-ruta"     = state_of("hojas-ruta"),
    "recopiladores"  = state_of("recopiladores"),
    "monitoreo"      = state_of("monitoreo"),
    "procesamiento"  = state_of(c("carga", "validacion", "codificacion", "analitica", "graficos")),
    "dashboard"      = state_of("dashboard")
  )

  out <- list(version = 1L, states = states)
  # added solo si el proyecto curó su lista; I() fuerza array JSON aunque
  # haya un solo slug (auto_unbox lo colapsaría a string).
  added <- tryCatch(.project_added_modules(s), error = function(e) NULL)
  if (!is.null(added)) out$added <- I(as.character(unlist(added)))
  out
}

# -----------------------------------------------------------------------------
# build_pulso — guarda la sesión actual a un .pulso
# -----------------------------------------------------------------------------
# Args:
#   sid         — session id activa
#   dest_path   — path absoluto del .pulso (se crea o reemplaza)
#   project_name — nombre humano para el manifest (opcional)
# Retorna list(ok=TRUE, size, saved_at).
build_pulso <- function(sid, dest_path, project_name = NULL, allow_empty_overwrite = FALSE) {
  if (!requireNamespace("zip", quietly = TRUE)) {
    stop_api(500, "E_NO_ZIP", "El paquete R 'zip' no está instalado.")
  }
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    stop_api(500, "E_NO_JSONLITE", "El paquete R 'jsonlite' no está instalado.")
  }

  s <- session_get(sid)
  .pulso_refuse_empty_project_overwrite(s, dest_path, allow_empty_overwrite = allow_empty_overwrite)
  # Convierte referencias legacy path-only a file_id antes de decidir qué
  # inputs viajan. Opera sobre una copia y no altera la sesión abierta.
  s <- .pulso_sanitize_graficos_consolidado_state(s)

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
  persisted_files <- list()
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
    # El state.rds persistido recorta files al subset que efectivamente
    # viaja, para que al reabrir no queden referencias colgantes a archivos
    # que ya no existen. IMPORTANTE: solo se recorta la COPIA persistida
    # (s_clean), nunca el registro en vivo de la sesión — recortar s$files
    # en memoria hacía desaparecer los outputs recién exportados (xlsx de
    # anexos, etc.) cuando un autosave corría entre el POST del export y el
    # GET de descarga, produciendo 404 E_NO_FILE intermitentes.
    persisted_files <- s$files[intersect(needed_fids, names(s$files))]
  }

  # 2) Serializar estado (sin caches) a state.rds
  s_clean <- .pulso_strip_caches(s)
  s_clean$files <- persisted_files
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
    n_files           = length(persisted_files),
    created_at        = format(s$created_at %||% Sys.time(),
                                "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    saved_at          = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  )
  modules_summary <- .pulso_manifest_modules_summary(s)
  if (!is.null(modules_summary)) manifest$modules_summary <- modules_summary
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

  # 6) Convertir referencias legacy mientras todavía coinciden con los paths
  # guardados, reescribir el file store y fusionar con la sesión fresca.
  s_saved <- .pulso_sanitize_graficos_consolidado_state(s_saved)
  s_saved <- .pulso_rewrite_paths(s_saved, uploads_dir)
  s_saved <- .pulso_sanitize_graficos_consolidado_state(s_saved)
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

  # Publica el override de etiquetas del proyecto en el env ambiente ANTES de
  # reconstruir las fuentes runtime (rebuild llama reporte_data/instrumento, que
  # aplican el override en la capa de instrumento). Sin override persistido es
  # NO-OP y limpia cualquier override de un proyecto abierto previamente.
  if (exists(".label_overrides_activate", mode = "function")) {
    tryCatch(.label_overrides_activate(s_saved$label_overrides), error = function(e) NULL)
  }

  public_kind <- as.character(s_saved$public_artifact$kind %||% "")[1]
  if (
    isTRUE(is_public_mode()) &&
    identical(public_kind, "monitoreo") &&
    is.list(s_saved$public_artifact_payload$monitoreo_report %||% NULL)
  ) {
    return(list(
      ok            = TRUE,
      session_id    = new_sid,
      project_path  = s_saved$project_path,
      manifest      = manifest
    ))
  }

  # 7) Rebuild de caches dashboard (rp_inst / rp_data) a partir de los
  #    file_ids persistidos en dashboard_source. No falla si no hay fuente.
  .dashboard_rebuild_after_load(new_sid)
  # Migración multi-formulario del editor XLSForm: proyectos viejos traen solo
  # `xlsform_state` (mono-formulario). Sembramos la colección `xlsform_forms`
  # con esa única entrada como activa, en runtime, sin pérdida de datos. Es
  # idempotente: si el .pulso ya trae la colección, no toca nada.
  local({
    s_seed <- .xlsform_forms_seed_from_legacy(session_get(new_sid))
    .session_env[[new_sid]] <- s_seed
  })
  .pulso_repair_multibase_variant_xlsforms(new_sid)
  .pulso_repair_parent_recod_columns(new_sid)
  .pulso_rebuild_estudio_runtime_sources(new_sid)
  .pulso_repair_xlsx_repeat_bases(new_sid)
  if (exists("estudio_sync_shared_xlsform_logic_if_needed", mode = "function")) {
    tryCatch(
      estudio_sync_shared_xlsform_logic_if_needed(new_sid),
      error = function(e) NULL
    )
  }
  .pulso_renormalize_after_load(new_sid)
  .pulso_restore_active_stage_flags_after_load(new_sid)

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
