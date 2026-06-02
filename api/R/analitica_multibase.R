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
  mi <- meta$multi_integrated %||% meta %||% list()
  origins <- (mi$origins %||% list())
  out <- list()
  for (origin in origins) {
    key <- .amb_scalar(origin$key_value %||% origin$origin %||% origin$key %||% origin$nombre %||% "", "")
    if (!nzchar(key)) next
    label <- .amb_scalar(origin$key_label %||% "", "")
    if (nzchar(label)) out[[key]] <- label
  }
  out
}

.amb_type_base <- function(type) {
  out <- trimws(sub("\\s+.*$", "", as.character(type %||% "")))
  out[is.na(out)] <- ""
  tolower(out)
}

.amb_empty_recod_roles <- function() {
  data.frame(
    role = character(0),
    tipo = character(0),
    modo_so = character(0),
    parent = character(0),
    parent_col = character(0),
    text_col = character(0),
    original = character(0),
    parent_recod = character(0),
    child_recod = character(0),
    target = character(0),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.amb_normalize_recod_roles <- function(roles) {
  cols <- names(.amb_empty_recod_roles())
  if (is.null(roles)) return(.amb_empty_recod_roles())
  if (is.data.frame(roles)) {
    out <- as.data.frame(roles, stringsAsFactors = FALSE, check.names = FALSE)
  } else if (is.list(roles) && length(roles)) {
    out <- tryCatch(
      do.call(rbind, lapply(roles, function(row) {
        row <- row %||% list()
        vals <- lapply(cols, function(col) as.character(row[[col]] %||% "")[1])
        names(vals) <- cols
        as.data.frame(vals, stringsAsFactors = FALSE, check.names = FALSE)
      })),
      error = function(e) .amb_empty_recod_roles()
    )
  } else {
    return(.amb_empty_recod_roles())
  }
  for (col in cols) {
    if (!col %in% names(out)) out[[col]] <- ""
    out[[col]] <- as.character(out[[col]])
    out[[col]][is.na(out[[col]])] <- ""
  }
  out <- out[, cols, drop = FALSE]
  out[out$role != "" | out$target != "" | out$original != "", , drop = FALSE]
}

.amb_recod_roles_from_draft <- function(draft) {
  rows <- (draft %||% list())$rows %||% list()
  if (!length(rows)) return(.amb_empty_recod_roles())

  out <- lapply(rows, function(r) {
    tipo <- tolower(trimws(as.character(r$tipo %||% "")))
    modo_so <- tolower(trimws(as.character(r$modo_so %||% "")))
    parent <- as.character(r$parent %||% "")
    parent_col <- as.character(r$parent_col %||% "")
    text_col <- as.character(r$text_col %||% "")
    if (!nzchar(parent_col)) parent_col <- parent
    original <- parent_col
    role <- ""
    target <- ""
    parent_recod <- if (nzchar(parent_col)) paste0(parent_col, "_recod") else ""
    child_recod <- if (nzchar(text_col)) paste0(text_col, "_recod") else ""

    if (identical(tipo, "select_one") && identical(modo_so, "padre")) {
      role <- "parent_recod"
      target <- parent_recod
      if (!nzchar(child_recod) && nzchar(parent_col)) child_recod <- paste0(parent_col, "_other_recod")
    } else if (identical(tipo, "select_one") && identical(modo_so, "hijo")) {
      role <- "other_child_recod"
      target <- child_recod
      if (!nzchar(original) && nzchar(text_col)) original <- text_col
    } else if (identical(tipo, "select_multiple")) {
      role <- "parent_recod"
      target <- parent_recod
      if (!nzchar(child_recod) && nzchar(parent_col)) child_recod <- paste0(parent_col, "_other_recod")
    } else if (identical(tipo, "text")) {
      role <- "text_recod"
      original <- if (nzchar(text_col)) text_col else parent_col
      target <- if (nzchar(original)) paste0(original, "_recod") else ""
      child_recod <- target
    } else if (identical(tipo, "integer")) {
      role <- "integer_recod"
      target <- parent_recod
      child_recod <- target
    }

    if (!nzchar(role) || !nzchar(target)) return(NULL)
    data.frame(
      role = role,
      tipo = tipo,
      modo_so = modo_so,
      parent = parent,
      parent_col = parent_col,
      text_col = text_col,
      original = original,
      parent_recod = parent_recod,
      child_recod = child_recod,
      target = target,
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  })
  out <- Filter(Negate(is.null), out)
  if (!length(out)) return(.amb_empty_recod_roles())
  .amb_normalize_recod_roles(do.call(rbind, out))
}

.amb_recod_roles_for_base <- function(sid, base_name = NULL) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s) || is.null(s$codif_por_base) || !length(s$codif_por_base)) {
    return(.amb_empty_recod_roles())
  }
  candidates <- unique(c(.amb_scalar(base_name, ""), .amb_scalar(s$codif_source_active, ""), names(s$codif_por_base)))
  candidates <- candidates[nzchar(candidates)]
  for (src in candidates) {
    draft <- (s$codif_por_base[[src]] %||% list())$familias_draft
    roles <- .amb_recod_roles_from_draft(draft)
    if (nrow(roles)) return(roles)
  }
  .amb_empty_recod_roles()
}

.amb_has_recod_roles <- function(recod_roles) {
  roles <- .amb_normalize_recod_roles(recod_roles)
  is.data.frame(roles) && nrow(roles) > 0L
}

.amb_recod_role_for_var <- function(var, recod_roles) {
  roles <- .amb_normalize_recod_roles(recod_roles)
  if (!nrow(roles)) return(NULL)
  v <- .amb_scalar(var, "")
  if (!nzchar(v)) return(NULL)
  priority <- c("child_recod", "text_col", "parent_recod", "target", "original", "parent_col", "parent")
  for (col in priority) {
    idx <- which(as.character(roles[[col]]) == v)
    if (length(idx)) return(roles[idx[1L], , drop = FALSE])
  }
  NULL
}

.amb_recod_role_target <- function(role, data, var = NULL) {
  if (is.null(role) || !nrow(role)) return("")
  kind <- .amb_scalar(role$role, "")
  v <- .amb_scalar(var, "")
  parent_names <- as.character(c(role$original, role$parent_col, role$parent))
  parent_names <- parent_names[!is.na(parent_names) & nzchar(parent_names)]
  candidates <- if (identical(kind, "other_child_recod") && nzchar(v) && v %in% parent_names) {
    c(role$original, role$parent_col, role$parent)
  } else if (identical(kind, "parent_recod")) {
    c(role$parent_recod, role$target, role$original, role$parent_col, role$parent)
  } else {
    c(role$target, role$child_recod, role$original, role$parent_col, role$parent)
  }
  candidates <- as.character(candidates)
  candidates <- candidates[!is.na(candidates) & nzchar(candidates)]
  if (is.data.frame(data)) {
    hit <- candidates[candidates %in% names(data)]
    if (length(hit)) return(hit[1L])
  }
  if (length(candidates)) candidates[1L] else ""
}

.amb_other_recod_to_parent <- function(parent, data, inst = NULL) {
  if (!nzchar(.amb_scalar(parent, ""))) return(FALSE)
  if (!(paste0(parent, "_other") %in% names(data))) return(FALSE)
  if (!(parent %in% names(data))) return(FALSE)
  if (is.null(inst$survey) || !is.data.frame(inst$survey)) return(FALSE)
  survey <- inst$survey
  names_s <- as.character(survey$name %||% character(0))
  i_parent <- match(parent, names_s)
  i_other <- match(paste0(parent, "_other"), names_s)
  if (is.na(i_parent) || is.na(i_other)) return(FALSE)

  type_parent <- .amb_type_base(survey$type[i_parent] %||% "")
  if (!type_parent %in% c("select_one", "select_multiple")) return(FALSE)

  type_other <- .amb_type_base(survey$type[i_other] %||% "text")
  if (nzchar(type_other) && !identical(type_other, "text")) return(FALSE)

  label_other <- iconv(as.character(survey$label[i_other] %||% ""), to = "ASCII//TRANSLIT", sub = "")
  if (!nzchar(label_other)) return(FALSE)
  grepl("otro|especifi|other", tolower(label_other), perl = TRUE)
}

.amb_multibase_resolve_var <- function(var, data, numericas = character(0), inst = NULL, recod_roles = NULL) {
  v <- .amb_scalar(var, "")
  if (!nzchar(v)) return("")

  numericas <- .as_chr_vec(numericas)
  if (v %in% numericas) return(v)

  role <- .amb_recod_role_for_var(v, recod_roles)
  if (!is.null(role)) {
    target <- .amb_recod_role_target(role, data, var = v)
    if (nzchar(target)) return(target)
  }

  has_roles <- .amb_has_recod_roles(recod_roles)

  # Si la variable de origen trae su propio texto de especificación
  # y existe un padre recodificado, esa especificación debe mostrarse
  # dentro de la pregunta padre. Si hay roles de Codificación, esos roles
  # mandan; la heurística queda solo para proyectos antiguos.
  if (!has_roles && grepl("_other$", v)) {
    parent <- sub("_other$", "", v)
    parent_recod <- paste0(parent, "_recod")
    other_recod <- paste0(v, "_recod")
    if (parent_recod %in% names(data) &&
        other_recod %in% names(data) &&
        .amb_other_recod_to_parent(parent, data, inst = inst)) {
      return(parent_recod)
    }
    if (other_recod %in% names(data) &&
        parent %in% names(data) &&
        .amb_other_recod_to_parent(parent, data, inst = inst)) {
      return(parent)
    }
  }
  if (!has_roles && grepl("_other_recod$", v)) {
    parent <- sub("_other_recod$", "", v)
    if (.amb_other_recod_to_parent(parent, data, inst = inst)) {
      parent_recod <- paste0(parent, "_recod")
      if (parent_recod %in% names(data)) {
        return(parent_recod)
      }
      return(parent)
    }
  }

  recod <- paste0(v, "_recod")
  if (recod %in% names(data)) return(recod)
  if (v %in% names(data)) return(v)
  ""
}

.amb_resolve_multibase_section <- function(secs, data, numericas = character(0), inst = NULL, recod_roles = NULL) {
  if (is.null(secs) || !is.list(secs) || !length(secs)) return(NULL)
  out <- lapply(secs, function(vars) {
    vars <- as.character(vars)
    if (!length(vars)) return(character(0))
    out_vars <- character(0)
    for (v in vars) {
      r <- .amb_multibase_resolve_var(v, data, numericas, inst = inst, recod_roles = recod_roles)
      if (!nzchar(r)) next
      if (!r %in% out_vars) out_vars <- c(out_vars, r)
    }
    out_vars
  })
  out <- out[vapply(out, length, integer(1)) > 0L]
  if (!length(out)) return(NULL)
  out
}

.amb_merge_other_recod <- function(data, var, inst = NULL, recod_roles = NULL) {
  if (!nzchar(.amb_scalar(var, ""))) return(data)

  role <- .amb_recod_role_for_var(var, recod_roles)
  has_roles <- .amb_has_recod_roles(recod_roles)
  if (!is.null(role)) {
    if (!identical(.amb_scalar(role$role, ""), "parent_recod")) return(data)
    parent <- .amb_scalar(role$original %||% role$parent_col %||% role$parent, "")
    other <- .amb_scalar(role$text_col, "")
    if (!nzchar(other) && nzchar(parent)) other <- paste0(parent, "_other")
    other_recod <- .amb_scalar(role$child_recod, "")
    if (!nzchar(other_recod) && nzchar(other)) other_recod <- paste0(other, "_recod")
    target <- .amb_recod_role_target(role, data)
  } else {
    if (has_roles) return(data)
    parent <- if (grepl("_other_recod$", var)) {
      sub("_other_recod$", "", var)
    } else if (grepl("_recod$", var)) {
      sub("_recod$", "", var)
    } else {
      var
    }
    other <- paste0(parent, "_other")
    other_recod <- paste0(other, "_recod")
    if (grepl("_other_recod$", var) && !.amb_other_recod_to_parent(parent, data, inst = inst)) {
      return(data)
    }
    if (grepl("_other$", var) && !.amb_other_recod_to_parent(parent, data, inst = inst)) {
      return(data)
    }
    target <- if (grepl("_other_recod$", var)) {
      parent_recod <- paste0(parent, "_recod")
      if (parent_recod %in% names(data)) parent_recod else parent
    } else if (grepl("_other$", var)) {
      parent_recod <- paste0(parent, "_recod")
      if (parent_recod %in% names(data)) parent_recod else var
    } else {
      var
    }
  }
  if (!(other %in% names(data)) || !(other_recod %in% names(data))) {
    return(data)
  }
  if (!target %in% names(data)) return(data)

  parent_vals <- as.character(data[[target]])
  other_txt <- as.character(data[[other]])
  other_rec <- as.character(data[[other_recod]])

  other_txt[is.na(other_txt)] <- ""
  other_rec[is.na(other_rec)] <- ""

  m_txt <- nzchar(trimws(other_txt))
  m_rec <- nzchar(trimws(other_rec))
  idx <- m_txt | m_rec
  if (!any(idx)) return(data)

  merged <- parent_vals
  merged[idx] <- ifelse(m_rec[idx], trimws(other_rec[idx]), parent_vals[idx])

  data_out <- data
  data_out[[target]] <- merged
  data_out
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
      if (!to %in% all_vars) next
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
    if (!to %in% all_vars) next
    out <- c(out, all_vars[all_vars == to | startsWith(all_vars, paste0(to, "_"))])
  }
  unique(out)
}

.amb_label_overrides_for_key <- function(meta, key_value) {
  standard <- .amb_global_label_overrides(meta)
  mi <- meta$multi_integrated %||% list()
  overrides <- mi$label_overrides_by_key %||% list()
  one <- overrides[[key_value]]
  one <- .amb_flat_label_overrides(one)
  if (!length(one)) return(standard)
  utils::modifyList(standard, one)
}

.amb_flat_label_overrides <- function(x) {
  if (is.null(x)) return(list())
  if (is.atomic(x) && !is.null(names(x))) x <- as.list(x)
  if (!is.list(x) || !length(x)) return(list())
  nms <- names(x)
  if (is.null(nms)) return(list())
  out <- list()
  for (nm in nms) {
    if (is.na(nm) || !nzchar(nm)) next
    val <- x[[nm]]
    if (is.null(val) || is.list(val)) next
    val <- .amb_scalar(val, "")
    if (nzchar(val)) out[[nm]] <- val
  }
  out
}

.amb_global_label_overrides <- function(meta) {
  mi <- (meta %||% list())$multi_integrated %||% list()
  for (field in c(
    "label_overrides_standard",
    "standard_label_overrides",
    "label_overrides",
    "labels_standard"
  )) {
    out <- .amb_flat_label_overrides(mi[[field]])
    if (length(out)) return(out)
  }

  # Compatibilidad con proyectos que guardaron el fraseo final como mapa plano
  # en `label_overrides_by_key` antes de separar "estandar" y "por origen".
  .amb_flat_label_overrides(mi$label_overrides_by_key %||% list())
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
  key_labels <- attr(data[[key_name]], "labels")

  key_label_map <- character(0)
  if (!is.null(key_labels) && length(key_labels)) {
    key_nms <- names(key_labels)
    if (length(key_nms) == length(key_labels) && !is.null(key_nms) && all(nzchar(key_nms))) {
      key_label_map <- stats::setNames(as.character(key_labels), as.character(key_nms))
    } else {
      key_label_map <- stats::setNames(as.character(key_labels), as.character(key_labels))
    }
  }

  lapply(values, function(value) {
    idx <- if (length(key_label_map)) match(value, names(key_label_map)) else NA_integer_
    fallback <- if (!length(idx) || is.na(idx)) value else .amb_scalar(key_label_map[[idx]], value)
    lbl <- label_map[[value]]
    list(
      value = value,
      label = .amb_scalar(lbl %||% fallback, fallback)
    )
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
  # En multibase preferimos la etiqueta del instrumento para evitar
  # arrastrar labels de origen (`_other_recod`/metadatos de fuente)
  # que pueden quedar definidos por una sola base.
  qlab <- label_variable(var, dic_vars, labels_override, NULL)
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
    out <- if (isTRUE(incluir_porcentajes)) {
      data.frame(n = as.numeric(n), pct = if (denom > 0) as.numeric(n) / denom else NA_real_, check.names = FALSE)
    } else {
      data.frame(n = as.numeric(n), check.names = FALSE)
    }
    attr(out, "denom") <- denom
    out
  }
  denom_by_n_col <- list()
  total_block <- add_block("Total", rep(TRUE, nrow(data)))
  names(total_block) <- if (isTRUE(incluir_porcentajes)) c("Total n", "Total %") else "Total n"
  denom_by_n_col[["Total n"]] <- attr(total_block, "denom", exact = TRUE)
  cuerpo <- cbind(cuerpo, total_block)
  key_vec <- as.character(data[[key_name]])
  for (kv in key_values) {
    block <- add_block(kv$label, !is.na(key_vec) & key_vec == kv$value)
    n_col <- paste(kv$label, "n")
    names(block) <- if (isTRUE(incluir_porcentajes)) c(n_col, paste(kv$label, "%")) else n_col
    denom_by_n_col[[n_col]] <- attr(block, "denom", exact = TRUE)
    cuerpo <- cbind(cuerpo, block)
  }

  if (!isTRUE(mostrar_todo)) {
    n_idx <- which(vapply(names(cuerpo), function(col) grepl("\\bn\\b$", col), logical(1)))
    if (length(n_idx)) {
      n_mat <- as.data.frame(cuerpo[, n_idx, drop = FALSE], stringsAsFactors = FALSE)
      n_mat[] <- lapply(n_mat, function(x) suppressWarnings(as.numeric(x)))
      has_any <- if (is.data.frame(n_mat)) rowSums(n_mat, na.rm = TRUE) > 0 else logical(0)
      if (length(has_any) && any(!has_any)) {
        cuerpo <- cuerpo[has_any, , drop = FALSE]
      }
    }
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
      # En select_multiple, las filas son menciones, pero el total de la
      # columna debe ser la base de casos válidos usada como denominador.
      # Sumar filas inflaría N cuando una persona marca más de una opción.
      n_name <- names(cuerpo)[j]
      denom <- denom_by_n_col[[n_name]]
      total_row[[j]] <- if (identical(tp, "sm") && !is.null(denom)) {
        round(as.numeric(denom), 0)
      } else {
        sum(suppressWarnings(as.numeric(cuerpo[[j]])), na.rm = TRUE)
      }
    }
  }
  cuerpo <- rbind(cuerpo, as.data.frame(total_row, check.names = FALSE))

  if (isTRUE(incluir_porcentajes)) {
    h1 <- c("", rep("Total", 2L))
    h2 <- c("N", "%")
    for (kv in key_values) {
      h1 <- c(h1, rep(kv$label, 2L))
      h2 <- c(h2, "N", "%")
    }
  } else {
    h1 <- c("", "Total", vapply(key_values, function(kv) kv$label, character(1)))
    h2 <- rep("N", length(h1) - 1L)
  }
  openxlsx::writeData(wb, sheet, t(h1), startRow = fila, startCol = 1, colNames = FALSE)
  openxlsx::writeData(wb, sheet, t(h2), startRow = fila + 1L, startCol = 2, colNames = FALSE)
  if (n_cols > 1L) {
    openxlsx::addStyle(wb, sheet, st$header, rows = fila, cols = 2:n_cols, gridExpand = TRUE, stack = TRUE)
    openxlsx::addStyle(wb, sheet, st$header, rows = fila + 1L, cols = 2:n_cols, gridExpand = TRUE, stack = TRUE)
  }
  openxlsx::addStyle(wb, sheet, st$table_end, rows = fila + 1L, cols = 1, gridExpand = TRUE, stack = TRUE)
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
                                  fuente = "Pulso PUCP",
                                  recod_roles = NULL) {
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
      data_to_use <- .amb_merge_other_recod(data, var, inst = inst, recod_roles = recod_roles)
      if (var %in% numericas) {
        fila <- write_one_numeric(
          wb, sheet, data = data_to_use, var = var, dic_vars = dic_vars,
          labels_override = labels_override, start_row = fila, start_col = 1,
          fuente = fuente, orders_list = orders_list, incluir_titulo = TRUE
        )
      } else {
        fila <- write_one_freq(
          wb, sheet, data = data_to_use, var = var, dic_vars = dic_vars, survey = survey,
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

.analitica_multibase_export_data <- function(data, inst, cfg = NULL, meta = NULL, path_xlsx, base_name = NULL, recod_roles = NULL) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop("El paquete 'openxlsx' es necesario.", call. = FALSE)
  }
  cfg <- cfg %||% list()
  reviewed <- .analitica_apply_data_review(data, inst, cfg)
  data <- reviewed$data
  inst <- reviewed$inst
  meta <- meta %||% list()
  recod_roles <- .amb_normalize_recod_roles(recod_roles %||% meta$codif_recod_roles)
  key_name <- .amb_detect_origin_key(data, meta)
  if (!nzchar(key_name)) {
    stop_api(409, "E_MULTIBASE_KEY", "No se pudo detectar la llave de origen de la base integrada.")
  }
  survey <- inst$survey %||% data.frame()
  if (key_name %in% names(data) && is.data.frame(survey) && nrow(survey) > 0L) {
    label_cols <- grep("^label", names(survey), value = TRUE, ignore.case = TRUE)
    if (!length(label_cols)) label_cols <- "label"
    key_row <- which(as.character(survey$name %||% "") == key_name)
    key_label <- NULL
    if (length(key_row)) {
      for (col in label_cols) {
        if (!col %in% names(survey)) next
        key_label <- as.character(survey[[col]][key_row[1L]])
        if (nzchar(key_label)) break
      }
    }
    if (!nzchar(.amb_scalar(key_label, ""))) {
      var_labels <- inst$var_labels %||% character(0)
      if (!is.null(names(var_labels)) && key_name %in% names(var_labels)) {
        key_label <- as.character(var_labels[[key_name]])
      }
    }
    if (!nzchar(.amb_scalar(key_label, ""))) key_label <- key_name
    attr(data[[key_name]], "label") <- key_label
  }
  key_values <- .amb_key_values(data, key_name, meta)
  if (length(key_values) < 2L) {
    stop_api(409, "E_MULTIBASE_ONE_KEY", "La llave de origen necesita al menos dos valores.")
  }
  global_labels_override <- .amb_global_label_overrides(meta)

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
  secs <- .amb_resolve_multibase_section(secs, data, numericas, inst = inst, recod_roles = recod_roles)
  all_keys <- vapply(key_values, function(kv) kv$value, character(1))
  all_vars <- names(data)
  global_variant_excl <- .amb_variant_vars(meta, all_vars)
  secs_global <- .analitica_filter_sections(
    .amb_sections_with_key_first(secs, key_name),
    inst,
    numericas,
    unique(c(excluidas_global, global_variant_excl))
  )
  secs_global <- .amb_resolve_multibase_section(secs_global, data, numericas, inst = inst, recod_roles = recod_roles)
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
    if (!length(vars_sec)) next
    vars_sec <- .amb_resolve_multibase_section(setNames(list(vars_sec), "tmp"), data, numericas, inst = inst, recod_roles = recod_roles)[["tmp"]]
    if (!length(vars_sec)) next
    if (.amb_bool(mb_global$incluir_secciones, TRUE)) {
      fila <- .amb_add_section_header(wb, sheet_global, sec, fila, ncols = max_cols)
    }
    for (var in vars_sec) {
      data_to_use <- .amb_merge_other_recod(data, var, inst = inst, recod_roles = recod_roles)
      if (identical(var, key_name)) {
        fila <- write_one_freq(
          wb, sheet_global, data = data, var = var, dic_vars = .amb_dic_vars(inst),
          survey = inst$survey,
          labels_override = global_labels_override,
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
          labels_override = global_labels_override,
          orders_list = .amb_orders_list(inst), incluir_titulo = TRUE
        )
      } else {
        fila <- .amb_write_global_cat(
          wb, sheet_global, data_to_use, var, key_name, key_values,
          dic_vars = .amb_dic_vars(inst), survey = inst$survey,
          orders_list = .amb_orders_list(inst),
          labels_override = global_labels_override,
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
    secs_key <- .amb_resolve_multibase_section(secs_key, data_k, numericas, inst = inst, recod_roles = recod_roles)
    if (length(variant_excl)) data_k <- .excluir_cols(data_k, variant_excl)
    .amb_write_freq_sheet(
      wb, sheet, data = data_k, inst = inst, sections = secs_key, numericas = numericas,
      labels_override = .amb_label_overrides_for_key(meta, key_value),
      incluir_porcentajes = .amb_bool(mb_origin$incluir_porcentajes, TRUE),
      incluir_secciones = .amb_bool(mb_origin$incluir_secciones, TRUE),
      orden = orden,
      mostrar_todo = mostrar_todo,
      codigos_solo_si_presentes = if (length(codes)) codes else NULL,
      recod_roles = recod_roles
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
  recod_roles <- .amb_recod_roles_for_base(sid, base_name)
  .analitica_multibase_export_data(
    data = data,
    inst = inst,
    cfg = cfg,
    meta = meta,
    base_name = base_name,
    path_xlsx = path_xlsx,
    recod_roles = recod_roles
  )
}
