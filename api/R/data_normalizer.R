# =============================================================================
# Normalizacion de data contra XLSForm
# =============================================================================

.dn_norm_text <- function(x) {
  x <- as.character(x)
  x[is.na(x)] <- ""
  x <- trimws(x)
  x <- if (requireNamespace("stringi", quietly = TRUE)) {
    stringi::stri_trans_general(x, "Latin-ASCII")
  } else {
    iconv(x, from = "", to = "ASCII//TRANSLIT")
  }
  x <- tolower(x)
  x <- gsub("[^a-z0-9]+", " ", x)
  trimws(gsub("\\s+", " ", x))
}

.dn_escape_regex <- function(x) {
  gsub("([][{}()+*^$|\\\\?.])", "\\\\\\1", x)
}

.dn_survey_list_name <- function(row) {
  ln <- as.character(row$list_name %||% NA_character_)[1]
  if (!is.na(ln) && nzchar(trimws(ln))) return(trimws(ln))
  tp <- trimws(as.character(row$type %||% "")[1])
  if (grepl("^select_(one|multiple)\\b", tp)) {
    m <- regmatches(tp, regexec("^select_(?:one|multiple)\\s+(\\S+)", tp, perl = TRUE))[[1]]
    if (length(m) >= 2L && nzchar(m[2])) return(m[2])
  }
  NA_character_
}

.dn_choice_label_col <- function(choices) {
  candidates <- c("label", "label::es", "label::Spanish (ES)", "label_spanish_es")
  hit <- candidates[candidates %in% names(choices)][1]
  hit %||% NA_character_
}

.dn_is_other_label <- function(x) {
  x_norm <- .dn_norm_text(x)
  nzchar(x_norm) & grepl("\\b(otro|otra|other|especificar|specify)\\b", x_norm, perl = TRUE)
}

.dn_source_code_from_column <- function(col, parent) {
  col <- as.character(col %||% "")[1]
  parent <- as.character(parent %||% "")[1]
  if (!nzchar(col) || !nzchar(parent)) return(NA_character_)
  pat <- paste0("^", .dn_escape_regex(parent), "([_/.])(.+)$")
  if (!grepl(pat, col, perl = TRUE)) return(NA_character_)
  suffix <- sub(pat, "\\2", col, perl = TRUE)
  suffix <- sub("^0+([0-9]+)$", "\\1", suffix)
  if (!nzchar(suffix)) "0" else suffix
}

.dn_alias_source_column <- function(col, aliases = character()) {
  col <- as.character(col %||% "")[1]
  if (!nzchar(col) || !length(aliases)) return(col)
  src <- unname(aliases[[col]] %||% NA_character_)
  if (!is.na(src) && nzchar(src)) src else col
}

.dn_choice_map_payload <- function(parent, row, list_name, type_kind, items) {
  if (!length(items)) return(NULL)
  mismatched <- vapply(items, function(x) {
    !identical(as.character(x$source_code %||% ""), as.character(x$xls_code %||% ""))
  }, logical(1))
  weak <- vapply(items, function(x) {
    !(as.character(x$match %||% "") %in% c("label", "label_unique"))
  }, logical(1))
  if (!any(mismatched) && !any(weak)) return(NULL)
  label <- as.character(row$label %||% parent)[1]
  list(
    variable = parent,
    label = label,
    type = type_kind,
    list_name = list_name,
    status = if (any(mismatched)) "order_or_code_mismatch" else "match_review",
    high_confidence = !any(weak),
    requires_confirmation = TRUE,
    mappings = items
  )
}

.dn_choice_code_maps_list <- function(choice_code_maps) {
  if (is.null(choice_code_maps) || !length(choice_code_maps)) return(list())
  if (!is.null(choice_code_maps$maps)) return(choice_code_maps$maps %||% list())
  if (is.list(choice_code_maps) && length(choice_code_maps) &&
      all(c("variable", "mappings") %in% names(choice_code_maps))) {
    return(list(choice_code_maps))
  }
  choice_code_maps
}

.dn_choice_code_maps_named <- function(choice_code_maps) {
  maps <- .dn_choice_code_maps_list(choice_code_maps)
  if (!length(maps)) return(list())
  out <- list()
  for (idx in seq_along(maps)) {
    mp <- maps[[idx]]
    if (is.null(mp)) next
    variable <- as.character(mp$variable %||% names(maps)[idx] %||% "")[1]
    if (!nzchar(variable)) next
    mp$variable <- variable
    out[[variable]] <- mp
  }
  out
}

.dn_choice_map_items <- function(mp) {
  mappings <- mp$mappings %||% list()
  if (is.data.frame(mappings)) {
    return(lapply(seq_len(nrow(mappings)), function(i) as.list(mappings[i, , drop = FALSE])))
  }
  if (is.list(mappings) && length(mappings) &&
      all(c("source_code", "xls_code") %in% names(mappings))) {
    return(list(mappings))
  }
  mappings
}

.dn_merge_choice_maps <- function(preferred, detected) {
  out <- preferred
  for (nm in names(detected)) {
    if (!nzchar(nm)) next
    if (!is.null(out[[nm]])) next
    out[[nm]] <- detected[[nm]]
  }
  out
}

.dn_choice_code_maps <- function(data, survey, choices, aliases = character(), choice_code_maps = NULL) {
  maps <- list()
  preferred_maps <- .dn_choice_code_maps_named(choice_code_maps)
  if (is.null(survey) || !nrow(survey) || is.null(choices) || !nrow(choices) ||
      !all(c("name", "type") %in% names(survey)) ||
      !all(c("list_name", "name") %in% names(choices))) {
    return(preferred_maps)
  }

  choices <- as.data.frame(choices, stringsAsFactors = FALSE)
  label_col <- .dn_choice_label_col(choices)
  choices$label <- if (is.na(label_col)) as.character(choices$name) else as.character(choices[[label_col]])
  survey_names <- .dn_survey_names(survey)
  type_raw <- .dn_survey_type_raw(survey)
  type_base <- .dn_survey_type_base(survey)

  for (i in seq_len(nrow(survey))) {
    parent <- survey_names[i]
    if (!nzchar(parent)) next
    ln <- .dn_survey_list_name(survey[i, , drop = FALSE])
    if (is.na(ln) || !nzchar(ln)) next
    ch <- choices[as.character(choices$list_name) == ln, c("name", "label"), drop = FALSE]
    if (!nrow(ch)) next
    ch$name <- as.character(ch$name)
    ch$label <- as.character(ch$label)
    preferred_map <- preferred_maps[[parent]]
    if (!is.null(preferred_map)) {
      if (identical(type_base[i], "select_multiple") || grepl("^select_multiple\\b", type_raw[i], perl = TRUE)) {
        preferred_map$type <- "select_multiple"
      } else if (identical(type_base[i], "select_one") || grepl("^select_one\\b", type_raw[i], perl = TRUE)) {
        preferred_map$type <- "select_one"
      }
      preferred_map$list_name <- as.character(preferred_map$list_name %||% ln)
      preferred_maps[[parent]] <- preferred_map
    }

    if (identical(type_base[i], "select_multiple") || grepl("^select_multiple\\b", type_raw[i], perl = TRUE)) {
      dummies <- .dn_match_sm_dummy_columns(
        data,
        parent,
        ch,
        choice_map = preferred_map,
        protected_names = .dn_survey_protected_dummy_names(survey, parent, ch, ln)
      )
      dummies <- dummies[!is.na(dummies) & nzchar(dummies) & dummies %in% names(data)]
      if (!length(dummies)) next
      items <- lapply(names(dummies), function(xls_code) {
        dummy_col <- unname(dummies[[xls_code]])
        source_col <- .dn_alias_source_column(dummy_col, aliases)
        source_code <- .dn_source_code_from_column(dummy_col, parent)
        xls_label <- as.character(ch$label[match(xls_code, ch$name)] %||% xls_code)
        source_label <- as.character(.dn_dummy_option_label(data[[dummy_col]]) %||% "")
        matched_by <- if (nzchar(source_label) && .dn_norm_text(source_label) == .dn_norm_text(xls_label)) {
          "label"
        } else if (!is.na(source_code) && identical(source_code, as.character(xls_code))) {
          "code"
        } else {
          "order"
        }
        list(
          source_code = as.character(source_code %||% ""),
          source_column = source_col,
          source_label = if (nzchar(source_label)) source_label else xls_label,
          xls_code = as.character(xls_code),
          xls_label = xls_label,
          match = matched_by
        )
      })
      payload <- .dn_choice_map_payload(parent, survey[i, , drop = FALSE], ln, "select_multiple", items)
      if (!is.null(payload)) maps[[parent]] <- payload
      next
    }

    if (identical(type_base[i], "select_one") || grepl("^select_one\\b", type_raw[i], perl = TRUE)) {
      if (!(parent %in% names(data))) next
      labs <- attr(data[[parent]], "labels", exact = TRUE)
      if (is.null(labs) || !length(labs)) next
      lab_names <- names(labs)
      lab_codes <- as.character(unname(labs))
      items <- list()
      for (j in seq_len(nrow(ch))) {
        xls_code <- as.character(ch$name[j])
        xls_label <- as.character(ch$label[j])
        hit <- which(.dn_norm_text(lab_names) == .dn_norm_text(xls_label))
        if (!length(hit)) next
        source_code <- lab_codes[hit[1]]
        items[[length(items) + 1L]] <- list(
          source_code = as.character(source_code),
          source_column = parent,
          source_label = as.character(lab_names[hit[1]]),
          xls_code = xls_code,
          xls_label = xls_label,
          match = "label"
        )
      }
      payload <- .dn_choice_map_payload(parent, survey[i, , drop = FALSE], ln, "select_one", items)
      if (!is.null(payload)) maps[[parent]] <- payload
    }
  }

  .dn_merge_choice_maps(preferred_maps, maps)
}

.dn_recode_select_one_choice_maps <- function(data, choice_code_maps) {
  out <- data
  recoded <- character(0)
  if (!length(choice_code_maps)) return(list(data = out, recoded = recoded))
  for (parent in names(choice_code_maps)) {
    mp <- choice_code_maps[[parent]]
    if (!identical(as.character(mp$type %||% ""), "select_one")) next
    if (!(parent %in% names(out))) next
    mappings <- .dn_choice_map_items(mp)
    if (!length(mappings)) next
    x <- trimws(as.character(out[[parent]]))
    changed <- FALSE
    changed_sources <- character(0)
    placeholders <- character(0)
    for (item in mappings) {
      src <- as.character(item$source_code %||% "")
      dst <- as.character(item$xls_code %||% "")
      if (!nzchar(src) || !nzchar(dst) || identical(src, dst)) next
      ph <- paste0("__PULSO_CHOICE_MAP_", length(placeholders) + 1L, "__")
      placeholders[ph] <- dst
      hit <- !is.na(x) & x == src
      if (any(hit)) {
        x[hit] <- ph
        changed <- TRUE
        changed_sources <- c(changed_sources, src)
      }
    }
    if (!changed) next
    for (ph in names(placeholders)) {
      x[x == ph] <- placeholders[[ph]]
    }
    out[[parent]] <- x
    recoded <- c(recoded, stats::setNames(paste(unique(changed_sources), collapse = ","), parent))
  }
  if (length(recoded)) {
    keys <- names(recoded)
    if (is.null(keys)) keys <- rep("", length(recoded))
    keys[is.na(keys) | !nzchar(keys)] <- unname(recoded[is.na(keys) | !nzchar(keys)])
    recoded <- recoded[!duplicated(keys)]
  }
  list(data = out, recoded = recoded)
}

.dn_recode_sm_select_one_other <- function(data, survey, choices) {
  out <- data
  recoded <- character(0)
  if (is.null(survey) || !nrow(survey) || is.null(choices) || !nrow(choices) ||
      !all(c("name", "type") %in% names(survey)) ||
      !all(c("list_name", "name") %in% names(choices))) {
    return(list(data = out, recoded = recoded))
  }

  type_raw <- .dn_survey_type_raw(survey)
  type_base <- .dn_survey_type_base(survey)
  survey_names <- .dn_survey_names(survey)
  label_col <- .dn_choice_label_col(choices)
  if (is.na(label_col)) {
    choices$label <- as.character(choices$name)
  } else {
    choices$label <- as.character(choices[[label_col]])
  }

  rows <- which(type_base == "select_one" | grepl("^select_one\\b", type_raw, perl = TRUE))
  for (i in rows) {
    parent <- survey_names[i]
    if (!nzchar(parent) || !(parent %in% names(out))) next

    ln <- .dn_survey_list_name(survey[i, , drop = FALSE])
    if (is.na(ln) || !nzchar(ln)) next
    ch <- choices[as.character(choices$list_name) == ln, c("name", "label"), drop = FALSE]
    if (!nrow(ch)) next

    other_rows <- which(.dn_is_other_label(ch$label))
    if (length(other_rows) != 1L) next
    other_code <- as.character(ch$name[other_rows[1]])
    if (!nzchar(other_code) || identical(other_code, "0")) next

    labs <- attr(out[[parent]], "labels", exact = TRUE)
    has_sm_zero_other <- FALSE
    if (!is.null(labs) && length(labs)) {
      has_sm_zero_other <- any(trimws(as.character(unname(labs))) == "0" & .dn_is_other_label(names(labs)))
    }
    other_text_col <- paste0(parent, "_other")
    if (!isTRUE(has_sm_zero_other) && !(other_text_col %in% names(out))) next

    x_chr <- trimws(as.character(out[[parent]]))
    hit <- !is.na(x_chr) & x_chr == "0"
    if (!any(hit)) next

    other_num <- suppressWarnings(as.numeric(other_code))
    if (!is.na(other_num) && is.numeric(out[[parent]])) {
      out[[parent]][hit] <- other_num
    } else {
      replacement <- as.character(out[[parent]])
      replacement[hit] <- other_code
      out[[parent]] <- replacement
    }
    recoded <- c(recoded, stats::setNames("0", parent))
  }

  list(data = out, recoded = recoded)
}

.dn_is_selected_dummy <- function(x) {
  if (is.logical(x)) return(!is.na(x) & x)
  x_chr <- trimws(as.character(x))
  labs <- attr(x, "labels", exact = TRUE)
  if (!is.null(labs) && length(labs) == 1L) {
    selected_code <- trimws(as.character(unname(labs)[1]))
    return(!is.na(x_chr) & nzchar(x_chr) & x_chr == selected_code)
  }
  x_num <- suppressWarnings(as.numeric(x_chr))
  if (!all(is.na(x_num))) {
    return(!is.na(x_num) & x_num == 1)
  }
  tolower(x_chr) %in% c("1", "true", "t", "yes", "y", "si", "sí")
}

.dn_dummy_option_label <- function(x) {
  labs <- attr(x, "labels", exact = TRUE)
  if (!is.null(labs) && length(labs) == 1L) {
    return(as.character(names(labs)[1]))
  }
  NA_character_
}

.dn_q_to_p_name <- function(name) {
  m <- regmatches(name, regexec("^[qQ]0*([0-9]+)(.*)$", name))[[1]]
  if (length(m) < 3L) return(NA_character_)
  rest <- m[3]
  if (grepl("^_0*[0-9]+$", rest, perl = TRUE)) {
    rest_num <- suppressWarnings(as.integer(sub("^_0*([0-9]+)$", "\\1", rest, perl = TRUE)))
    if (!is.na(rest_num)) rest <- paste0("_", rest_num)
  }
  paste0("p", as.integer(m[2]), rest)
}

.dn_pad_numeric_suffix_name <- function(name) {
  if (!grepl("^(.*_)([0-9]+)$", name, perl = TRUE)) return(NA_character_)
  prefix <- sub("^(.*_)([0-9]+)$", "\\1", name, perl = TRUE)
  suffix <- suppressWarnings(as.integer(sub("^(.*_)([0-9]+)$", "\\2", name, perl = TRUE)))
  if (is.na(suffix)) return(NA_character_)
  paste0(prefix, sprintf("%04d", suffix))
}

.dn_unpad_numeric_suffix_name <- function(name) {
  if (!grepl("^(.*_)([0-9]+)$", name, perl = TRUE)) return(NA_character_)
  prefix <- sub("^(.*_)([0-9]+)$", "\\1", name, perl = TRUE)
  suffix <- suppressWarnings(as.integer(sub("^(.*_)([0-9]+)$", "\\2", name, perl = TRUE)))
  if (is.na(suffix)) return(NA_character_)
  paste0(prefix, suffix)
}

.dn_match_sm_dummy_columns <- function(data, parent, choices_sub, choice_map = NULL, protected_names = character()) {
  data_names <- names(data)
  if (!length(data_names) || is.na(parent) || !nzchar(parent)) {
    return(stats::setNames(rep(NA_character_, nrow(choices_sub)), choices_sub$name))
  }

  prefix_pat <- paste0("^", .dn_escape_regex(parent), "([_/.])(.+)$")
  candidates <- data_names[grepl(prefix_pat, data_names, perl = TRUE)]
  candidates <- candidates[!grepl("([_/.])(other|otro|otra|specify|texto)$", candidates, ignore.case = TRUE)]
  protected_names <- as.character(protected_names %||% character())
  protected_names <- protected_names[!is.na(protected_names) & nzchar(protected_names)]
  if (length(protected_names)) {
    candidates <- setdiff(candidates, protected_names)
  }
  # En data ya recodificada, `<parent>_recod` es una madre analítica, no
  # una dummy de opción de `<parent>`. Si la dejamos como candidata, el
  # normalizador puede usarla como dummy y luego eliminarla.
  if (length(candidates)) {
    suffix_probe <- sub(prefix_pat, "\\2", candidates, perl = TRUE)
    is_recod_output <- tolower(suffix_probe) == "recod" |
      grepl("_recod$", suffix_probe, ignore.case = TRUE)
    candidates <- candidates[!is_recod_output]
  }
  if (!length(candidates)) {
    return(stats::setNames(rep(NA_character_, nrow(choices_sub)), choices_sub$name))
  }

  suffix <- sub(prefix_pat, "\\2", candidates, perl = TRUE)
  suffix_unpadded <- sub("^0+([0-9]+)$", "\\1", suffix)
  suffix_unpadded[!nzchar(suffix_unpadded)] <- "0"
  choice_names <- as.character(choices_sub$name)

  out <- stats::setNames(rep(NA_character_, length(choice_names)), choice_names)

  # 0. Si el editor XLSForm ya trae un mapa confirmado C{n} -> código XLSForm,
  #    ese mapa gobierna antes que etiquetas/orden detectados en el SAV/SPSS.
  #    Esto permite que la data se adapte al contrato que decidió el usuario.
  if (!is.null(choice_map) && length(.dn_choice_map_items(choice_map))) {
    for (item in .dn_choice_map_items(choice_map)) {
      source_code <- as.character(item$source_code %||% "")
      xls_code <- as.character(item$xls_code %||% "")
      if (!nzchar(source_code) || !nzchar(xls_code) || !(xls_code %in% names(out))) next
      source_unpadded <- sub("^0+([0-9]+)$", "\\1", source_code)
      if (!nzchar(source_unpadded)) source_unpadded <- "0"
      hit <- which(suffix == source_code | suffix_unpadded == source_unpadded)
      if (length(hit)) out[[xls_code]] <- candidates[hit[1]]
    }
  }

  # 1. Match por etiqueta de opcion del dummy SPSS vs label del XLSForm.
  choice_labels <- .dn_norm_text(choices_sub$label)
  dummy_labels <- .dn_norm_text(vapply(candidates, function(nm) .dn_dummy_option_label(data[[nm]]), character(1)))
  for (i in seq_along(choice_names)) {
    if (!is.na(out[[i]]) && nzchar(out[[i]])) next
    if (!nzchar(choice_labels[i])) next
    hit <- which(dummy_labels == choice_labels[i])
    if (length(hit)) out[[i]] <- candidates[hit[1]]
  }

  # 2. Match por codigo literal o codigo sin padding.
  for (i in seq_along(choice_names)) {
    if (!is.na(out[[i]]) && nzchar(out[[i]])) next
    code <- choice_names[i]
    code_unpadded <- sub("^0+([0-9]+)$", "\\1", code)
    if (!nzchar(code_unpadded)) code_unpadded <- "0"
    hit <- which(suffix == code | suffix_unpadded == code_unpadded)
    if (length(hit)) out[[i]] <- candidates[hit[1]]
  }

  # 3. Fallback por orden solo para opciones no resueltas.
  remaining_choices <- which(is.na(out) | !nzchar(out))
  remaining_dummies <- setdiff(candidates, out[!is.na(out) & nzchar(out)])
  if (length(remaining_choices) && length(remaining_dummies)) {
    ord_num <- suppressWarnings(as.numeric(sub(prefix_pat, "\\2", remaining_dummies, perl = TRUE)))
    remaining_dummies <- remaining_dummies[order(is.na(ord_num), ord_num, remaining_dummies)]
    n <- min(length(remaining_choices), length(remaining_dummies))
    out[remaining_choices[seq_len(n)]] <- remaining_dummies[seq_len(n)]
  }

  out
}

# Si la data viene con nombres SM crudos (`q0001`, `q0007_0001`) y el
# XLSForm ya está renombrado a `p1, p7` (post-importador), aliasamos las
# columnas q* a sus equivalentes p* para que el resto del normalizador y
# del pipeline encuentren las columnas. Toma las columnas del XLSForm como
# fuente de verdad: solo aliasa columnas para las que existe un equivalente
# `p<N>` en survey.
.dn_alias_q_to_p_columns <- function(data, survey) {
  if (!nrow(survey) || !"name" %in% names(survey)) {
    return(list(data = data, aliased = character(0), dropped = character(0)))
  }
  survey_names <- as.character(survey$name)
  survey_names <- survey_names[!is.na(survey_names) & nzchar(survey_names)]
  out <- data
  aliased <- character(0)
  dropped <- character(0)
  for (col in names(out)) {
    # Solo nombres con prefijo q<digits> calificarían como SM legacy.
    p_equiv <- .dn_q_to_p_name(col)
    if (is.na(p_equiv) || !nzchar(p_equiv)) next
    if (p_equiv == col) next
    target <- p_equiv
    padded_equiv <- .dn_pad_numeric_suffix_name(p_equiv)
    if (!(target %in% survey_names) && !is.na(padded_equiv) && padded_equiv %in% survey_names) {
      target <- padded_equiv
    }
    if (!(target %in% survey_names)) {
      # También podría ser una dummy `p7_1` cuyo padre `p7` está en survey.
      mp <- regmatches(p_equiv, regexec("^(p[0-9]+)(_.*)?$", p_equiv))[[1]]
      if (length(mp) < 2L) next
      parent_p <- mp[2]
      if (!(parent_p %in% survey_names)) next
      target <- p_equiv
    }
    if (target %in% names(out)) next
    out[[target]] <- out[[col]]
    aliased <- c(aliased, stats::setNames(col, target))
    dropped <- c(dropped, col)
  }
  list(data = out, aliased = aliased, dropped = unique(dropped))
}

.dn_alias_padded_survey_columns <- function(data, survey) {
  out <- data
  aliased <- character(0)
  dropped <- character(0)
  if (!nrow(survey) || !"name" %in% names(survey)) {
    return(list(data = out, aliased = aliased, dropped = dropped))
  }

  survey_names <- as.character(survey$name)
  survey_names <- survey_names[!is.na(survey_names) & nzchar(survey_names)]
  for (nm in survey_names) {
    if (nm %in% names(out)) next
    if (!grepl("^(.*_)([0-9]+)$", nm, perl = TRUE)) next
    candidates <- unique(c(
      .dn_unpad_numeric_suffix_name(nm),
      .dn_pad_numeric_suffix_name(nm)
    ))
    candidates <- candidates[!is.na(candidates) & nzchar(candidates) & candidates != nm]
    hit <- candidates[candidates %in% names(out)][1]
    if (!is.na(hit) && nzchar(hit)) {
      out[[nm]] <- out[[hit]]
      aliased <- c(aliased, stats::setNames(hit, nm))
      dropped <- c(dropped, hit)
    }
  }
  list(data = out, aliased = aliased, dropped = unique(dropped))
}

.dn_survey_type_raw <- function(survey) {
  n <- if (is.null(survey)) 0L else nrow(survey)
  if (!n) return(character(0))
  out <- if ("type" %in% names(survey)) as.character(survey$type) else rep("", n)
  out[is.na(out)] <- ""
  trimws(out)
}

.dn_survey_type_base <- function(survey) {
  type_raw <- .dn_survey_type_raw(survey)
  n <- length(type_raw)
  if (!n) return(character(0))
  if ("type_base" %in% names(survey)) {
    out <- as.character(survey$type_base)
    out[is.na(out)] <- ""
    out <- trimws(out)
    missing <- !nzchar(out)
    out[missing] <- sub("\\s+.*$", "", type_raw[missing])
    return(out)
  }
  sub("\\s+.*$", "", type_raw)
}

.dn_survey_appearance <- function(survey) {
  n <- if (is.null(survey)) 0L else nrow(survey)
  if (!n) return(character(0))
  out <- if ("appearance" %in% names(survey)) as.character(survey$appearance) else rep("", n)
  out[is.na(out)] <- ""
  trimws(out)
}

# Profundidad de repeat por fila del survey. 0 = tope; >0 = la fila vive dentro
# de uno o más `begin_repeat` abiertos. Las propias filas marcadoras
# begin_repeat/end_repeat quedan en la profundidad "externa" (no se cuentan a sí
# mismas), de modo que sólo las PREGUNTAS anidadas reciben profundidad > 0. Se
# usa para excluir de la base ancha las preguntas que viven en un repeat de Kobo
# (jsonlite flatten=TRUE devuelve el repeat como un blob JSON, no expandido).
.dn_survey_repeat_depth <- function(survey) {
  type_base <- .dn_survey_type_base(survey)
  n <- length(type_base)
  depth <- integer(n)
  cur <- 0L
  for (i in seq_len(n)) {
    tb <- type_base[i]
    if (identical(tb, "end_repeat")) {
      cur <- max(0L, cur - 1L)
      depth[i] <- cur
      next
    }
    depth[i] <- cur
    if (identical(tb, "begin_repeat")) {
      cur <- cur + 1L
    }
  }
  depth
}

# Posiciones (índices de fila) en la base MADRE para cada fila de la base HIJA,
# resolviendo el enlace repeat por la llave primaria (`_parent_index`↔`_index`)
# con fallback (`_submission__id`↔`_id`). Devuelve un vector integer alineado a
# las filas de `child` (NA donde no hay match). Es un enlace many-to-one por
# construcción (`match` toma la PRIMERA fila madre que casa), así que NO duplica
# filas de la hija. Helper compartido (ADR 0030): lo consumen la herencia de
# columnas de validación (`.inherit_parent_columns`, Fase 2) y el enriquecimiento
# hija×madre de analítica (`.analitica_enrich_child_pair`, Fase 3), para no
# duplicar la lógica de enlace.
.dn_repeat_parent_row_positions <- function(child, parent,
                                            link_key = "_parent_index",
                                            parent_index_key = "_index",
                                            fallback_child_key = NULL,
                                            fallback_parent_key = NULL) {
  if (!is.data.frame(child) || !is.data.frame(parent) || !nrow(child)) {
    return(integer(0))
  }
  pos <- rep(NA_integer_, nrow(child))
  if (!is.null(link_key) && nzchar(link_key) && link_key %in% names(child) &&
      !is.null(parent_index_key) && nzchar(parent_index_key) &&
      parent_index_key %in% names(parent)) {
    pos <- match(as.character(child[[link_key]]),
                 as.character(parent[[parent_index_key]]))
  }
  # Fallback SOLO para las filas que la llave primaria no resolvió (preserva el
  # enlace primario donde existe y rescata las demás por `_submission__id`↔`_id`).
  need <- is.na(pos)
  if (any(need) &&
      !is.null(fallback_child_key) && nzchar(fallback_child_key) &&
      fallback_child_key %in% names(child) &&
      !is.null(fallback_parent_key) && nzchar(fallback_parent_key) &&
      fallback_parent_key %in% names(parent)) {
    pos[need] <- match(as.character(child[[fallback_child_key]])[need],
                       as.character(parent[[fallback_parent_key]]))
  }
  pos
}

.dn_survey_names <- function(survey) {
  if (is.null(survey) || !"name" %in% names(survey) || !nrow(survey)) {
    return(character(0))
  }
  out <- as.character(survey$name)
  out[is.na(out)] <- ""
  trimws(out)
}

.dn_survey_protected_dummy_names <- function(survey, parent, choices_sub, list_name = NA_character_) {
  survey_names_all <- .dn_survey_names(survey)
  keep <- !is.na(survey_names_all) & nzchar(survey_names_all)
  survey_names <- survey_names_all[keep]
  if (!length(survey_names) || is.na(parent) || !nzchar(parent)) {
    return(survey_names)
  }

  type_base_all <- .dn_survey_type_base(survey)
  type_base <- rep("", length(survey_names_all))
  n_type <- min(length(type_base_all), length(type_base))
  if (n_type > 0L) {
    type_base[seq_len(n_type)] <- type_base_all[seq_len(n_type)]
  }
  type_base <- type_base[keep]
  row_list_names_all <- vapply(seq_len(nrow(survey)), function(i) {
    .dn_survey_list_name(survey[i, , drop = FALSE])
  }, character(1))
  row_list_names <- row_list_names_all[keep]
  row_list_names[is.na(row_list_names)] <- ""
  prefix_pat <- paste0("^", .dn_escape_regex(parent), "([_/.])(.+)$")
  is_child_name <- grepl(prefix_pat, survey_names, perl = TRUE)
  suffix <- rep(NA_character_, length(survey_names))
  suffix[is_child_name] <- sub(prefix_pat, "\\2", survey_names[is_child_name], perl = TRUE)
  suffix_unpadded <- sub("^0+([0-9]+)$", "\\1", suffix)
  suffix_unpadded[!nzchar(suffix_unpadded)] <- "0"
  choice_names <- as.character(choices_sub$name %||% character())
  choice_unpadded <- sub("^0+([0-9]+)$", "\\1", choice_names)
  choice_unpadded[!nzchar(choice_unpadded)] <- "0"
  same_list <- rep(TRUE, length(survey_names))
  if (!is.na(list_name) && nzchar(list_name)) {
    same_list <- row_list_names == list_name
  }

  is_matrix_child <- type_base == "select_one" &
    same_list &
    is_child_name &
    (suffix %in% choice_names | suffix_unpadded %in% choice_unpadded)
  survey_names[!is_matrix_child]
}

.dn_expected_data_names <- function(instrumento) {
  survey <- instrumento$survey
  if (is.null(survey) || !nrow(survey) || !"name" %in% names(survey)) {
    return(character(0))
  }
  type_raw <- .dn_survey_type_raw(survey)
  type_base <- .dn_survey_type_base(survey)
  names_raw <- .dn_survey_names(survey)
  skip_types <- c(
    "begin_group", "end_group", "begin_repeat", "end_repeat",
    "note", "calculate", "start", "end", "today", "deviceid",
    "subscriberid", "phonenumber", "simserial", "username", "audit"
  )
  # Dos patrones de Kobo que NO producen columnas en la base ancha aplanada:
  #
  # 1. Preguntas anidadas dentro de un `begin_repeat`: Kobo devuelve el repeat
  #    como UNA columna JSON-string (jsonlite flatten=TRUE no lo expande), así
  #    que la base ancha no puede representar sus preguntas. Van a su base hija
  #    (ver carga_kobo_repeats.R). Se detectan por profundidad de repeat > 0.
  # 2. Headers de matriz Likert: en un grupo `appearance=field-list`, la fila
  #    `select_one` con `appearance="label"` sólo muestra las etiquetas de
  #    columna y NUNCA guarda dato (sus hermanas usan `list-nolabel` y sí calzan).
  repeat_depth <- .dn_survey_repeat_depth(survey)
  appearance <- .dn_survey_appearance(survey)
  is_label_appearance <- vapply(
    strsplit(tolower(appearance), "\\s+"),
    function(tokens) "label" %in% tokens,
    logical(1)
  )
  is_matrix_header <- type_base == "select_one" & is_label_appearance
  keep <- nzchar(names_raw) &
    !(type_base %in% skip_types) &
    !(type_raw %in% skip_types) &
    repeat_depth == 0L &
    !is_matrix_header
  unique(names_raw[keep])
}

# Rellena en `data` las columnas `expected` ausentes como NA_character_. En los
# imports por API / handoff de Monitoreo, el XLSForm y la data salen del MISMO
# asset: una columna esperada que no aparece = pregunta sin respuestas (la
# plataforma omite columnas 100% vacías), no un desajuste de versión. El SET de
# nombres esperados lo decide el caller (base ancha vs contrato del handoff), por
# eso se recibe `expected` y no el instrumento. Helper compartido (ADR 0030 Fase
# 1) que consolida el backfill antes duplicado en `.carga_backfill_missing_expected`
# (router_carga.R) y `.monitoreo_processing_handoff_complete_expected_columns`
# (router_monitoreo.R).
.dn_backfill_missing_columns <- function(data, expected) {
  data <- as.data.frame(data %||% data.frame(), stringsAsFactors = FALSE, check.names = FALSE)
  expected <- as.character(expected %||% character(0))
  missing <- setdiff(expected, names(data))
  if (length(missing)) {
    n <- nrow(data)
    for (nm in missing) data[[nm]] <- rep(NA_character_, n)
  }
  data
}

.dn_collapse_single_child_columns <- function(data, survey) {
  out <- data
  collapsed <- character(0)
  dropped <- character(0)
  if (is.null(survey) || !nrow(survey) || !"name" %in% names(survey)) {
    return(list(data = out, collapsed = collapsed, dropped = dropped))
  }

  survey_names <- .dn_survey_names(survey)
  type_raw <- .dn_survey_type_raw(survey)
  type_base <- .dn_survey_type_base(survey)

  for (i in seq_len(nrow(survey))) {
    parent <- survey_names[i]
    if (is.na(parent) || !nzchar(parent)) next
    if (!grepl("^p[0-9]+$", parent, perl = TRUE)) next
    if (parent %in% names(out)) next
    if (identical(type_base[i], "select_multiple") ||
        grepl("^select_multiple\\b", type_raw[i], perl = TRUE)) {
      next
    }

    child_pat <- paste0("^", .dn_escape_regex(parent), "_[0-9]+$")
    candidates <- names(out)[grepl(child_pat, names(out), perl = TRUE)]
    if (length(candidates) != 1L) next

    child <- candidates[[1]]
    if (child %in% survey_names) next

    out[[parent]] <- out[[child]]
    if ("label" %in% names(survey)) {
      attr(out[[parent]], "label") <- as.character(survey$label[i] %||% parent)
    }
    collapsed <- c(collapsed, stats::setNames(child, parent))
    dropped <- c(dropped, child)
  }

  list(data = out, collapsed = collapsed, dropped = unique(dropped))
}

#' Normalizar data cruda al contrato canónico del XLSForm.
#'
#' Convierte exports SurveyMonkey/SPSS de `select_multiple` desplegados como
#' columnas dummy (`q0007_0001`, `q0007_0002`, ...) a la columna madre ODK
#' normalizada (`p7 = "1 3 5"`). Usa `instrumento` como fuente de verdad para saber qué
#' preguntas son `select_multiple` y cuáles son sus opciones.
#'
#' @export
normalize_data_for_xlsform <- function(data,
                                       instrumento,
                                       drop_source_dummies = TRUE,
                                       add_metadata = TRUE,
                                       choice_code_maps = NULL) {
  if (!is.data.frame(data) || is.null(instrumento) || is.null(instrumento$survey)) {
    return(data)
  }
  survey <- instrumento$survey
  choices <- instrumento$choices %||% data.frame()
  if (!nrow(survey) || !all(c("name", "type") %in% names(survey))) {
    return(data)
  }

  out <- as.data.frame(data, stringsAsFactors = FALSE, check.names = FALSE)
  # 1. Si el XLSForm usa convención `p<N>` (post-importador SM) y la data
  #    aún viene con nombres `q<N>...`, aliasamos q* → p* primero.
  q2p_info <- .dn_alias_q_to_p_columns(out, survey)
  out <- q2p_info$data
  # 2. Alias de padding para datos que aún llegan como p7_0001 frente a un XLSForm p7_1.
  alias_info <- .dn_alias_padded_survey_columns(out, survey)
  out <- alias_info$data
  # 3. SurveyMonkey exporta algunas matrices/escalas de una sola fila como
  #    q0017_0001 -> p17_1 aunque el XLSForm canonico espera p17.
  collapse_info <- .dn_collapse_single_child_columns(out, survey)
  out <- collapse_info$data
  # 4. Si el SAV y el XLSForm usan codigos distintos para las mismas etiquetas,
  #    construimos un mapa SAV/API -> XLSForm. En select_multiple ese mapa se
  #    usa al reconstruir la madre; en select_one recodificamos aqui.
  choice_code_maps <- .dn_choice_code_maps(out, survey, choices,
    aliases = q2p_info$aliased,
    choice_code_maps = choice_code_maps
  )
  choice_map_recode <- .dn_recode_select_one_choice_maps(out, choice_code_maps)
  out <- choice_map_recode$data
  # 5. SurveyMonkey codifica la opción "Other/Otra" de select_one como 0 en
  #    el SAV, aunque el XLSForm traducido la catalogue con su código final
  #    (por ejemplo 14). Reescribimos ese 0 al código del XLSForm para que
  #    relevant como `${p12} = '14'` calce con la data real.
  other_recode_info <- .dn_recode_sm_select_one_other(out, survey, choices)
  out <- other_recode_info$data
  sm_rows <- survey[grepl("^select_multiple\\b", as.character(survey$type)), , drop = FALSE]

  dropped <- unique(c(q2p_info$dropped, alias_info$dropped, collapse_info$dropped))
  aliased_combined <- c(q2p_info$aliased, alias_info$aliased)
  single_child_collapses <- collapse_info$collapsed
  select_one_other_recodes <- c(choice_map_recode$recoded, other_recode_info$recoded)
  if (length(select_one_other_recodes)) {
    recode_keys <- names(select_one_other_recodes)
    if (is.null(recode_keys)) recode_keys <- rep("", length(select_one_other_recodes))
    recode_keys[is.na(recode_keys) | !nzchar(recode_keys)] <- unname(select_one_other_recodes[is.na(recode_keys) | !nzchar(recode_keys)])
    select_one_other_recodes <- select_one_other_recodes[!duplicated(recode_keys)]
  }
  normalized <- list()

  choices_ok <- nrow(choices) > 0L && all(c("list_name", "name") %in% names(choices))
  if (choices_ok) {
    lab_col <- .dn_choice_label_col(choices)
    if (is.na(lab_col)) choices$label <- as.character(choices$name) else choices$label <- as.character(choices[[lab_col]])
  } else {
    sm_rows <- sm_rows[0, , drop = FALSE]
  }

  for (i in seq_len(nrow(sm_rows))) {
    parent <- as.character(sm_rows$name[i])
    if (is.na(parent) || !nzchar(parent)) next
    ln <- .dn_survey_list_name(sm_rows[i, , drop = FALSE])
    if (is.na(ln) || !nzchar(ln)) next
    ch <- choices[as.character(choices$list_name) == ln, c("name", "label"), drop = FALSE]
    if (!nrow(ch)) next
    ch$name <- as.character(ch$name)
    dummies <- .dn_match_sm_dummy_columns(
      out,
      parent,
      ch,
      choice_map = choice_code_maps[[parent]],
      protected_names = .dn_survey_protected_dummy_names(survey, parent, ch, ln)
    )
    dummies <- dummies[!is.na(dummies) & nzchar(dummies) & dummies %in% names(out)]
    if (!length(dummies)) next

    token_mat <- vapply(names(dummies), function(code) {
      ifelse(.dn_is_selected_dummy(out[[dummies[[code]]]]), code, NA_character_)
    }, character(nrow(out)))
    if (is.null(dim(token_mat))) {
      token_mat <- matrix(token_mat, ncol = 1L)
      colnames(token_mat) <- names(dummies)
    }
    mother <- apply(token_mat, 1L, function(z) {
      z <- z[!is.na(z) & nzchar(z)]
      if (!length(z)) return(NA_character_)
      paste(z, collapse = " ")
    })
    out[[parent]] <- mother
    attr(out[[parent]], "label") <- as.character(sm_rows$label[i] %||% parent)
    normalized[[parent]] <- unname(dummies)
    dropped <- unique(c(dropped, unname(dummies)))
  }

  if (isTRUE(drop_source_dummies) && length(dropped)) {
    out <- out[, setdiff(names(out), dropped), drop = FALSE]
  }

  if (isTRUE(add_metadata) &&
      (length(normalized) || length(aliased_combined) ||
       length(single_child_collapses) || length(select_one_other_recodes) ||
       length(choice_code_maps))) {
    attr(out, "xlsform_normalized") <- list(
      normalized_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
      select_multiple = normalized,
      aliases = aliased_combined,
      single_child_collapses = single_child_collapses,
      select_one_other_recodes = select_one_other_recodes,
      choice_code_maps = choice_code_maps,
      dropped_columns = if (isTRUE(drop_source_dummies)) dropped else character(0)
    )
  }

  out
}

#' Validar compatibilidad estricta entre data normalizada y XLSForm.
#'
#' El XLSForm es la fuente de verdad: todas las variables analizables del
#' `survey` deben existir como columnas en la data ya normalizada. Columnas
#' extra (metadata SurveyMonkey u otros campos auxiliares) se permiten y se
#' reportan para que la normalizacion no sea silenciosa.
#'
#' @export
validate_data_xlsform_compatibility <- function(data, instrumento) {
  expected <- .dn_expected_data_names(instrumento)
  data_names <- if (is.data.frame(data)) names(data) else character(0)
  matched <- intersect(expected, data_names)
  missing <- setdiff(expected, data_names)
  extra <- setdiff(data_names, expected)
  ok <- length(missing) == 0L
  msg <- if (ok) {
    sprintf(
      "La data normalizada calza con el XLSForm: %d/%d variables esperadas presentes; %d columna(s) extra permitida(s).",
      length(matched), length(expected), length(extra)
    )
  } else {
    sprintf(
      "La data normalizada no calza con el XLSForm: faltan %d de %d variable(s) esperada(s).",
      length(missing), length(expected)
    )
  }
  structure(
    list(
      ok = ok,
      status = if (ok) "compatible" else "incompatible",
      expected_columns = as.integer(length(expected)),
      matched_columns = as.integer(length(matched)),
      missing_columns = missing,
      extra_columns = extra,
      n_missing = as.integer(length(missing)),
      n_extra = as.integer(length(extra)),
      message = msg
    ),
    class = "pulso_data_xlsform_compatibility"
  )
}
