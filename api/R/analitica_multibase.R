# Tablas multibase para una base integrada.

.amb_scalar <- function(x, fallback = "") {
  if (is.null(x) || length(x) == 0L) return(fallback)
  x <- as.character(x)[1]
  if (is.na(x)) fallback else x
}

.amb_chr <- function(x) {
  if (is.null(x)) return(character(0))
  out <- as.character(unlist(x, use.names = FALSE))
  out[!is.na(out) & nzchar(out)]
}

.amb_bool <- function(x, default = TRUE) {
  if (is.null(x)) return(default)
  isTRUE(x)
}

.amb_slug <- function(x, fallback = "valor") {
  if (exists(".mi_slug", mode = "function")) return(.mi_slug(x, fallback))
  out <- tolower(iconv(.amb_scalar(x, fallback), to = "ASCII//TRANSLIT", sub = ""))
  out <- gsub("[^a-z0-9]+", "_", out)
  out <- gsub("^_+|_+$", "", out)
  if (!nzchar(out)) fallback else out
}

.amb_sheet_name <- function(x, existing = character(), fallback = "Hoja") {
  raw <- .amb_scalar(x, fallback)
  raw <- gsub("[][*/?:\\\\]", " ", raw)
  raw <- gsub("[[:space:]]+", " ", trimws(raw))
  if (!nzchar(raw)) raw <- fallback
  raw <- substr(raw, 1L, 31L)
  if (!raw %in% existing) return(raw)
  stem <- substr(raw, 1L, 26L)
  i <- 2L
  repeat {
    candidate <- substr(paste0(stem, " ", i), 1L, 31L)
    if (!candidate %in% existing) return(candidate)
    i <- i + 1L
  }
}

.amb_base_meta <- function(sid, base_name = NULL) {
  s <- session_get(sid, required = FALSE)
  bases <- s$estudio$bases %||% list()
  if (!length(bases)) return(NULL)
  if (!is.null(base_name) && nzchar(base_name) && !is.null(bases[[base_name]])) return(bases[[base_name]])
  hits <- Filter(function(b) !is.null(b$multi_integrated), bases)
  if (length(hits)) return(hits[[1]])
  if (length(bases) == 1L) return(bases[[1]])
  NULL
}

.amb_origin_label_map <- function(meta) {
  origins <- (meta$multi_integrated %||% list())$origins %||% list()
  out <- list()
  for (origin in origins) {
    key <- .amb_scalar(origin$key_value, "")
    if (!nzchar(key)) next
    label <- .amb_scalar(origin$key_label, key)
    out[[key]] <- label
  }
  out
}

.amb_detect_origin_key <- function(data, meta = NULL) {
  mi <- meta$multi_integrated %||% list()
  candidates <- unique(c(
    .amb_scalar(mi$origin_key_name, ""),
    "pais",
    "origen",
    names(data)[1]
  ))
  candidates <- candidates[nzchar(candidates)]
  for (key in candidates) {
    if (!key %in% names(data)) next
    vals <- as.character(data[[key]])
    vals <- vals[!is.na(vals) & nzchar(vals)]
    n_vals <- length(unique(vals))
    if (n_vals >= 2L && n_vals <= 80L) return(key)
  }
  ""
}

.analitica_multibase_info <- function(sid, cfg = NULL) {
  sources <- tryCatch(.load_rp_sources(sid), error = function(e) NULL)
  if (is.null(sources) || length(sources$data_sources) != 1L) {
    return(list(ok = TRUE, available = FALSE, reason = "not_single_integrated"))
  }
  base_name <- names(sources$data_sources)[1]
  data <- sources$data_sources[[base_name]]
  meta <- .amb_base_meta(sid, base_name)
  key <- .amb_detect_origin_key(data, meta)
  if (!nzchar(key)) {
    return(list(ok = TRUE, available = FALSE, reason = "no_origin_key"))
  }
  vals_all <- as.character(data[[key]])
  vals <- vals_all[!is.na(vals_all) & nzchar(vals_all)]
  values <- unique(vals)
  if (length(values) < 2L) {
    return(list(ok = TRUE, available = FALSE, reason = "one_origin"))
  }
  label_map <- .amb_origin_label_map(meta)
  keys <- lapply(values, function(value) {
    list(
      value = value,
      label = .amb_scalar(label_map[[value]], value),
      n = as.integer(sum(vals_all == value, na.rm = TRUE))
    )
  })
  list(
    ok = TRUE,
    available = TRUE,
    base_name = base_name,
    origin_key_name = key,
    keys = keys,
    n_keys = length(keys),
    has_metadata = !is.null((meta %||% list())$multi_integrated)
  )
}

.analitica_multibase_available <- function(sid) {
  isTRUE(tryCatch(.analitica_multibase_info(sid)$available, error = function(e) FALSE))
}

.amb_orders_list <- function(inst) {
  orders <- inst$orders_list %||% list()
  if (exists(".augment_orders_list_from_choices", mode = "function")) {
    orders <- .augment_orders_list_from_choices(
      orders_list = orders,
      survey = inst$survey,
      choices = inst$choices
    )
  }
  orders
}

.amb_dic_vars <- function(inst) {
  survey <- inst$survey
  if (is.null(survey) || !all(c("name", "label") %in% names(survey))) {
    return(data.frame(name = character(0), label = character(0), stringsAsFactors = FALSE))
  }
  survey |>
    dplyr::filter(!is.na(.data$name), nzchar(as.character(.data$name))) |>
    dplyr::select(name, label) |>
    dplyr::mutate(label = trimws(as.character(.data$label))) |>
    dplyr::distinct(name, .keep_all = TRUE)
}

.amb_variants <- function(meta) {
  mi <- meta$multi_integrated %||% list()
  variants <- mi$variant_map %||% list()
  origins <- mi$origins %||% list()
  origin_keys <- setNames(
    vapply(origins, function(o) .amb_scalar(o$key_value, ""), character(1)),
    vapply(origins, function(o) .amb_scalar(o$id, ""), character(1))
  )
  lapply(variants, function(v) {
    key <- .amb_scalar(v$origin_key, "")
    if (!nzchar(key)) key <- .amb_scalar(origin_keys[[.amb_scalar(v$origin_id, "")]], "")
    list(
      origin_key = key,
      from = .amb_scalar(v$from, ""),
      to = .amb_scalar(v$to, "")
    )
  })
}

.amb_variant_exclusions_for_key <- function(meta, key_value, all_vars, all_keys = character()) {
  out <- character(0)
  variants <- .amb_variants(meta)
  for (v in variants) {
    to <- .amb_scalar(v$to, "")
    if (!nzchar(to)) next
    if (!identical(.amb_scalar(v$origin_key, ""), key_value)) {
      out <- c(out, all_vars[all_vars == to | startsWith(all_vars, paste0(to, "_"))])
    }
  }
  if (!length(variants) && length(all_keys)) {
    key_slug <- .amb_slug(key_value, "")
    other_slugs <- setdiff(vapply(all_keys, .amb_slug, character(1), fallback = ""), key_slug)
    other_slugs <- other_slugs[nzchar(other_slugs)]
    for (slug in other_slugs) {
      out <- c(out, all_vars[grepl(paste0("_", slug, "($|_)"), all_vars)])
    }
  }
  unique(out)
}

.amb_variant_vars <- function(meta, all_vars) {
  variants <- .amb_variants(meta)
  if (!length(variants)) return(character(0))
  out <- character(0)
  for (v in variants) {
    to <- .amb_scalar(v$to, "")
    if (!nzchar(to)) next
    out <- c(out, all_vars[all_vars == to | startsWith(all_vars, paste0(to, "_"))])
  }
  unique(out)
}

.amb_label_overrides_for_key <- function(meta, key_value) {
  mi <- meta$multi_integrated %||% list()
  overrides <- mi$label_overrides_by_key %||% list()
  one <- overrides[[key_value]]
  if (is.null(one)) list() else one
}

.amb_add_section_header <- function(wb, sheet, label, row, ncols = 3L) {
  st <- mk_styles_spss()
  openxlsx::writeData(wb, sheet, toupper(label), startRow = row, startCol = 1, colNames = FALSE)
  openxlsx::mergeCells(wb, sheet, cols = 1:max(1L, ncols), rows = row:row)
  openxlsx::addStyle(wb, sheet, st$sec_title, rows = row, cols = 1, gridExpand = TRUE, stack = TRUE)
  openxlsx::setRowHeights(
    wb, sheet, rows = row,
    heights = .auto_row_height(toupper(label), chars_per_line = 70, base = 28, per_line = 18)
  )
  row + 2L
}

.amb_key_values <- function(data, key_name, meta) {
  values <- as.character(data[[key_name]])
  values <- unique(values[!is.na(values) & nzchar(values)])
  label_map <- .amb_origin_label_map(meta)
  lapply(values, function(value) {
    list(value = value, label = .amb_scalar(label_map[[value]], value))
  })
}

.amb_sections_with_key_first <- function(sections, key_name) {
  key_name <- .amb_scalar(key_name, "")
  if (!nzchar(key_name)) return(sections)
  if (is.null(sections) || !is.list(sections) || !length(sections)) {
    return(stats::setNames(list(key_name), "General"))
  }
  sections <- lapply(sections, function(vars) setdiff(as.character(vars), key_name))
  nms <- names(sections)
  if (is.null(nms)) nms <- rep("", length(sections))
  blank <- !nzchar(nms)
  if (any(blank)) nms[blank] <- paste0("Seccion ", which(blank))
  names(sections) <- nms
  first <- names(sections)[1]
  sections[[first]] <- unique(c(key_name, sections[[first]]))
  sections
}

.amb_write_global_cat <- function(wb, sheet, data, var, key_name, key_values,
                                  dic_vars, survey, orders_list,
                                  labels_override = NULL,
                                  start_row = 1L,
                                  incluir_porcentajes = TRUE,
                                  orden = "original",
                                  mostrar_todo = FALSE,
                                  codigos_solo_si_presentes = NULL,
                                  fuente = "Pulso PUCP") {
  st <- mk_styles_cruces()
  body_int_center <- openxlsx::createStyle(
    fontSize = 10,
    numFmt = "#,##0",
    halign = "center",
    valign = "center",
    fgFill = "#FFFFFF",
    fontName = "Arial"
  )
  body_pct_center <- openxlsx::createStyle(
    fontSize = 10,
    numFmt = "0.0%",
    halign = "center",
    valign = "center",
    fgFill = "#FFFFFF",
    fontName = "Arial"
  )
  fila <- start_row
  qlab <- label_variable(var, dic_vars, labels_override, data)
  openxlsx::writeData(wb, sheet, qlab, startRow = fila, startCol = 1, colNames = FALSE)
  n_cols <- 1L + (length(key_values) + 1L) * if (isTRUE(incluir_porcentajes)) 2L else 1L
  openxlsx::mergeCells(wb, sheet, rows = fila, cols = 1:n_cols)
  openxlsx::addStyle(wb, sheet, st$q_title, rows = fila, cols = 1:n_cols, gridExpand = TRUE, stack = TRUE)
  openxlsx::addStyle(wb, sheet, st$table_end, rows = fila, cols = 1:n_cols, gridExpand = TRUE, stack = TRUE)
  openxlsx::setRowHeights(wb, sheet, rows = fila, heights = .calc_row_height(qlab, col_width = 70, font_size = 11))
  fila <- fila + 1L

  tp <- tipo_pregunta(var, survey = survey, sm_vars_force = NULL, data = data)
  cats <- get_categorias(var = var, data = data, survey = survey, orders_list = orders_list)
  opciones <- cats$labels
  codes <- cats$codes
  ok <- !is.na(opciones) & nzchar(opciones) & tolower(trimws(opciones)) != "total"
  opciones <- opciones[ok]
  codes <- codes[ok]

  if (!length(codes)) {
    openxlsx::writeData(wb, sheet, "Sin datos validos.", startRow = fila, startCol = 1)
    return(fila + 2L)
  }

  if (!is.null(codigos_solo_si_presentes) && length(codigos_solo_si_presentes)) {
    cond <- as.character(codigos_solo_si_presentes)
    n_all <- contar_por_opcion(data, var, codes, tp, rep(TRUE, nrow(data)))
    keep <- !(codes %in% cond & n_all == 0)
    opciones <- opciones[keep]
    codes <- codes[keep]
  }

  cuerpo <- data.frame(Opciones = opciones, stringsAsFactors = FALSE, check.names = FALSE)
  add_block <- function(label, mask) {
    denom <- denominador_validos(data, var, codes, tp, mask)
    n <- contar_por_opcion(data, var, codes, tp, mask)
    if (isTRUE(incluir_porcentajes)) {
      data.frame(n = as.numeric(n), pct = if (denom > 0) as.numeric(n) / denom else NA_real_, check.names = FALSE)
    } else {
      data.frame(n = as.numeric(n), check.names = FALSE)
    }
  }
  total_block <- add_block("Total", rep(TRUE, nrow(data)))
  names(total_block) <- if (isTRUE(incluir_porcentajes)) c("Total n", "Total %") else "Total n"
  cuerpo <- cbind(cuerpo, total_block)
  key_vec <- as.character(data[[key_name]])
  for (kv in key_values) {
    block <- add_block(kv$label, !is.na(key_vec) & key_vec == kv$value)
    names(block) <- if (isTRUE(incluir_porcentajes)) c(paste(kv$label, "n"), paste(kv$label, "%")) else paste(kv$label, "n")
    cuerpo <- cbind(cuerpo, block)
  }

  orden <- .amb_scalar(orden, "original")
  if (orden %in% c("asc", "desc") && nrow(cuerpo)) {
    ord <- order(cuerpo[["Total n"]], decreasing = identical(orden, "desc"), na.last = TRUE)
    cuerpo <- cuerpo[ord, , drop = FALSE]
  }

  total_row <- as.list(rep(NA, ncol(cuerpo)))
  names(total_row) <- names(cuerpo)
  total_row[[1]] <- "Total"
  for (j in seq.int(2L, ncol(cuerpo))) {
    if (isTRUE(incluir_porcentajes) && j %% 2L == 1L) {
      prev_n <- suppressWarnings(as.numeric(total_row[[j - 1L]] %||% NA_real_))
      total_row[[j]] <- if (!is.na(prev_n) && prev_n > 0) 1 else NA_real_
    } else {
      total_row[[j]] <- sum(suppressWarnings(as.numeric(cuerpo[[j]])), na.rm = TRUE)
    }
  }
  cuerpo <- rbind(cuerpo, as.data.frame(total_row, check.names = FALSE))

  if (isTRUE(incluir_porcentajes)) {
    h1 <- c("", rep("Total", 2L))
    h2 <- c("", "n", "%")
    for (kv in key_values) {
      h1 <- c(h1, rep(kv$label, 2L))
      h2 <- c(h2, "n", "%")
    }
  } else {
    h1 <- c("", "Total", vapply(key_values, function(kv) kv$label, character(1)))
    h2 <- c("", rep("n", length(h1) - 1L))
  }
  openxlsx::writeData(wb, sheet, t(h1), startRow = fila, startCol = 1, colNames = FALSE)
  openxlsx::writeData(wb, sheet, t(h2), startRow = fila + 1L, startCol = 1, colNames = FALSE)
  openxlsx::addStyle(wb, sheet, st$header, rows = fila:(fila + 1L), cols = 1:n_cols, gridExpand = TRUE, stack = TRUE)
  if (isTRUE(incluir_porcentajes)) {
    for (c1 in seq(2L, n_cols, by = 2L)) {
      openxlsx::mergeCells(wb, sheet, rows = fila, cols = c1:(c1 + 1L))
    }
  }
  fila <- fila + 2L

  openxlsx::writeData(wb, sheet, cuerpo, startRow = fila, startCol = 1, colNames = FALSE)
  r1 <- fila
  r2 <- fila + nrow(cuerpo) - 1L
  openxlsx::addStyle(wb, sheet, st$body_txt, rows = r1:r2, cols = 1, gridExpand = TRUE)
  n_cols_idx <- if (isTRUE(incluir_porcentajes)) seq(2L, n_cols, by = 2L) else 2L:n_cols
  openxlsx::addStyle(wb, sheet, body_int_center, rows = r1:r2, cols = n_cols_idx, gridExpand = TRUE)
  if (isTRUE(incluir_porcentajes)) {
    pct_cols <- seq(3L, n_cols, by = 2L)
    openxlsx::addStyle(wb, sheet, body_pct_center, rows = r1:r2, cols = pct_cols, gridExpand = TRUE)
  }
  openxlsx::addStyle(wb, sheet, st$total_bold, rows = r2, cols = 1:n_cols, gridExpand = TRUE, stack = TRUE)
  openxlsx::addStyle(wb, sheet, st$table_end, rows = r2, cols = 1:n_cols, gridExpand = TRUE, stack = TRUE)
  openxlsx::setColWidths(wb, sheet, cols = 1, widths = 55)
  if (n_cols > 1L) openxlsx::setColWidths(wb, sheet, cols = 2:n_cols, widths = 13)
  fila <- r2 + 1L
  openxlsx::writeData(wb, sheet, paste0("Fuente: ", fuente), startRow = fila, startCol = 1, colNames = FALSE)
  openxlsx::addStyle(wb, sheet, st$note, rows = fila, cols = 1, gridExpand = TRUE)
  fila + 2L
}

.amb_write_freq_sheet <- function(wb, sheet, data, inst, sections, numericas,
                                  labels_override = NULL,
                                  incluir_porcentajes = TRUE,
                                  incluir_secciones = TRUE,
                                  orden = "original",
                                  mostrar_todo = FALSE,
                                  codigos_solo_si_presentes = NULL,
                                  fuente = "Pulso PUCP") {
  survey <- inst$survey
  orders_list <- .amb_orders_list(inst)
  dic_vars <- .amb_dic_vars(inst)
  fila <- 1L
  for (sec in names(sections)) {
    vars_sec <- sections[[sec]]
    vars_sec <- vars_sec[vapply(vars_sec, function(v) .has_var_or_dummies(data, v), logical(1))]
    if (!length(vars_sec)) next
    if (isTRUE(incluir_secciones)) {
      fila <- .amb_add_section_header(
        wb, sheet, sec, fila,
        ncols = if (isTRUE(incluir_porcentajes)) 3L else 2L
      )
    }
    for (var in vars_sec) {
      if (var %in% numericas) {
        fila <- write_one_numeric(
          wb, sheet, data = data, var = var, dic_vars = dic_vars,
          labels_override = labels_override, start_row = fila, start_col = 1,
          fuente = fuente, orders_list = orders_list, incluir_titulo = TRUE
        )
      } else {
        fila <- write_one_freq(
          wb, sheet, data = data, var = var, dic_vars = dic_vars, survey = survey,
          labels_override = labels_override, start_row = fila, start_col = 1,
          fuente = fuente, orders_list = orders_list, mostrar_todo = mostrar_todo,
          codigos_solo_si_presentes = codigos_solo_si_presentes,
          incluir_titulo = TRUE,
          incluir_porcentajes = incluir_porcentajes,
          orden = orden
        )
      }
    }
  }
  invisible(fila)
}

.analitica_multibase_export_data <- function(data, inst, cfg = NULL, meta = NULL, path_xlsx, base_name = NULL) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop("El paquete 'openxlsx' es necesario.", call. = FALSE)
  }
  cfg <- cfg %||% list()
  reviewed <- .analitica_apply_data_review(data, inst, cfg)
  data <- reviewed$data
  inst <- reviewed$inst
  meta <- meta %||% list()
  key_name <- .amb_detect_origin_key(data, meta)
  if (!nzchar(key_name)) {
    stop_api(409, "E_MULTIBASE_KEY", "No se pudo detectar la llave de origen de la base integrada.")
  }
  key_values <- .amb_key_values(data, key_name, meta)
  if (length(key_values) < 2L) {
    stop_api(409, "E_MULTIBASE_ONE_KEY", "La llave de origen necesita al menos dos valores.")
  }

  frec <- cfg$frecuencias %||% list()
  mb <- cfg$multibase %||% list()
  mb_global <- mb$global %||% list()
  mb_origin <- mb$origenes %||% list()
  orden <- .amb_scalar(frec$orden, "original")
  if (!orden %in% c("desc", "asc", "original")) orden <- "original"
  mostrar_todo <- isTRUE(frec$mostrar_todo)
  codes <- .as_int_vec((cfg$codebook %||% list())$codigos_solo_si_presentes)
  excluidas_global <- setdiff(.as_chr_vec(cfg$variables_excluidas), key_name)
  excluidas_key <- unique(c(.as_chr_vec(cfg$variables_excluidas), key_name))
  numericas <- .analitica_declared_numericas(cfg, override_frecuencias = TRUE)
  secs <- .secciones_from_config(cfg)
  if (is.null(secs)) secs <- .secciones_desde_instrumento(inst)
  all_keys <- vapply(key_values, function(kv) kv$value, character(1))
  all_vars <- names(data)
  global_variant_excl <- .amb_variant_vars(meta, all_vars)
  secs_global <- .analitica_filter_sections(
    .amb_sections_with_key_first(secs, key_name),
    inst,
    numericas,
    unique(c(excluidas_global, global_variant_excl))
  )
  if (is.null(secs_global) || !length(secs_global)) {
    stop_api(409, "E_MULTIBASE_NO_VARS", "No hay variables analizables para generar tablas multibase.")
  }

  wb <- openxlsx::createWorkbook()
  existing_sheets <- character(0)
  add_sheet <- function(label) {
    sheet <- .amb_sheet_name(label, existing_sheets)
    existing_sheets <<- c(existing_sheets, sheet)
    openxlsx::addWorksheet(wb, sheet)
    .prepare_frecuencias_sheet(wb, sheet)
    sheet
  }

  sheet_global <- add_sheet("Global")
  fila <- 1L
  openxlsx::writeData(wb, sheet_global, paste0("GLOBAL POR ", toupper(key_name)), startRow = fila, startCol = 1, colNames = FALSE)
  st <- mk_styles_spss()
  max_cols <- 1L + (length(key_values) + 1L) * if (.amb_bool(mb_global$incluir_porcentajes, TRUE)) 2L else 1L
  openxlsx::mergeCells(wb, sheet_global, rows = fila, cols = 1:max_cols)
  openxlsx::addStyle(wb, sheet_global, st$sec_title, rows = fila, cols = 1, gridExpand = TRUE, stack = TRUE)
  fila <- fila + 2L
  for (sec in names(secs_global)) {
    vars_sec <- secs_global[[sec]]
    if (.amb_bool(mb_global$incluir_secciones, TRUE)) {
      fila <- .amb_add_section_header(wb, sheet_global, sec, fila, ncols = max_cols)
    }
    for (var in vars_sec) {
      if (identical(var, key_name)) {
        fila <- write_one_freq(
          wb, sheet_global, data = data, var = var, dic_vars = .amb_dic_vars(inst),
          survey = inst$survey,
          labels_override = NULL,
          start_row = fila,
          start_col = 1,
          fuente = "Pulso PUCP",
          orders_list = .amb_orders_list(inst),
          mostrar_todo = mostrar_todo,
          codigos_solo_si_presentes = if (length(codes)) codes else NULL,
          incluir_titulo = TRUE,
          incluir_porcentajes = .amb_bool(mb_global$incluir_porcentajes, TRUE),
          orden = orden
        )
        next
      }
      if (var %in% numericas) {
        fila <- write_one_numeric_cross(
          wb, sheet_global, data = data, var = var, dic_vars = .amb_dic_vars(inst),
          CRUZAR_CON = key_name, start_row = fila, start_col = 1,
          fuente = "Pulso PUCP", survey = inst$survey,
          orders_list = .amb_orders_list(inst), incluir_titulo = TRUE
        )
      } else {
        fila <- .amb_write_global_cat(
          wb, sheet_global, data, var, key_name, key_values,
          dic_vars = .amb_dic_vars(inst), survey = inst$survey,
          orders_list = .amb_orders_list(inst),
          start_row = fila,
          incluir_porcentajes = .amb_bool(mb_global$incluir_porcentajes, TRUE),
          orden = orden,
          mostrar_todo = mostrar_todo,
          codigos_solo_si_presentes = if (length(codes)) codes else NULL
        )
      }
    }
  }

  for (kv in key_values) {
    key_value <- kv$value
    sheet <- add_sheet(kv$label)
    data_k <- data[as.character(data[[key_name]]) == key_value, , drop = FALSE]
    variant_excl <- .amb_variant_exclusions_for_key(meta, key_value, all_vars, all_keys)
    excl_key <- unique(c(excluidas_key, variant_excl))
    secs_key <- .analitica_filter_sections(secs, inst, numericas, excl_key)
    if (is.null(secs_key) || !length(secs_key)) next
    if (length(variant_excl)) data_k <- .excluir_cols(data_k, variant_excl)
    .amb_write_freq_sheet(
      wb, sheet, data = data_k, inst = inst, sections = secs_key, numericas = numericas,
      labels_override = .amb_label_overrides_for_key(meta, key_value),
      incluir_porcentajes = .amb_bool(mb_origin$incluir_porcentajes, TRUE),
      incluir_secciones = .amb_bool(mb_origin$incluir_secciones, TRUE),
      orden = orden,
      mostrar_todo = mostrar_todo,
      codigos_solo_si_presentes = if (length(codes)) codes else NULL
    )
  }

  openxlsx::saveWorkbook(wb, path_xlsx, overwrite = TRUE)
  invisible(normalizePath(path_xlsx, winslash = "/"))
}

.analitica_multibase_export <- function(sid, path_xlsx, cfg = NULL) {
  cfg <- cfg %||% .analitica_get_config(sid)
  sources <- .load_rp_sources(sid)
  if (length(sources$data_sources) != 1L) {
    stop_api(409, "E_MULTIBASE_INTEGRATED_REQUIRED", "Este reporte requiere una base integrada unica.")
  }
  base_name <- names(sources$data_sources)[1]
  data <- sources$data_sources[[base_name]]
  inst <- sources$inst_sources[[base_name]]
  meta <- .amb_base_meta(sid, base_name)
  .analitica_multibase_export_data(
    data = data,
    inst = inst,
    cfg = cfg,
    meta = meta,
    base_name = base_name,
    path_xlsx = path_xlsx
  )
}
