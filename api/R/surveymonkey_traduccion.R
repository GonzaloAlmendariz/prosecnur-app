# =============================================================================
# Familia SurveyMonkey -> XLSForm de referencia -> data compatible con reporte
# =============================================================================

.sm_or <- function(x, y) if (is.null(x) || (length(x) == 1L && is.na(x))) y else x

.sm_chr <- function(x) {
  x <- as.character(x)
  x[is.na(x)] <- NA_character_
  x
}

.sm_norm_ws <- function(x) {
  x <- .sm_chr(x)
  x <- gsub("[[:space:]]+", " ", x)
  trimws(x)
}

.sm_nonempty <- function(x) {
  x <- .sm_chr(x)
  x[!is.na(x) & nzchar(trimws(x))]
}

.sm_first_nonempty <- function(x, fallback = NA_character_) {
  x <- .sm_nonempty(x)
  if (!length(x)) return(as.character(fallback)[1])
  x[1]
}

.sm_unique_nonempty <- function(x) {
  x <- .sm_norm_ws(x)
  x <- x[!is.na(x) & nzchar(x)]
  unique(x)
}

.sm_unique_codes <- function(labels) {
  codes <- .sm_safe_slug(labels)
  used <- character(0)
  out <- character(length(codes))

  for (i in seq_along(codes)) {
    out[i] <- .sm_unique_name(codes[i], used = used, suffix = "opt")
    used <- c(used, out[i])
  }

  out
}

.sm_text_label_set <- function(x) {
  labels <- .sm_unique_nonempty(x)
  if (length(labels) < 2L) return(character(0))
  stats::setNames(.sm_unique_codes(labels), labels)
}

.sm_mode_nonempty <- function(x, fallback = NA_character_) {
  x <- .sm_nonempty(x)
  if (!length(x)) return(as.character(fallback)[1])
  tb <- sort(table(x), decreasing = TRUE)
  names(tb)[1]
}

.sm_common_prefix <- function(x) {
  x <- unique(.sm_norm_ws(x))
  x <- x[!is.na(x) & nzchar(x)]
  if (!length(x)) return(NA_character_)
  if (length(x) == 1L) return(x[1])

  prefix <- x[1]
  for (i in seq_along(x)[-1]) {
    cur <- x[i]
    max_n <- min(nchar(prefix), nchar(cur))
    if (!max_n) return(NA_character_)

    j <- 0L
    while (j < max_n && substr(prefix, j + 1L, j + 1L) == substr(cur, j + 1L, j + 1L)) {
      j <- j + 1L
    }

    prefix <- substr(prefix, 1L, j)
    if (!nzchar(prefix)) return(NA_character_)
  }

  prefix
}

.sm_prompt_from_labels <- function(labels) {
  labels <- unique(.sm_norm_ws(labels))
  labels <- labels[!is.na(labels) & nzchar(labels)]
  if (!length(labels)) return(NA_character_)

  direct <- labels[grepl("\\?$", labels)]
  if (length(direct)) {
    direct <- direct[order(nchar(direct), direct)]
    return(direct[1])
  }

  prefix <- .sm_common_prefix(labels)
  if (is.na(prefix) || !nzchar(prefix)) return(NA_character_)

  prefix <- sub("\\s+[_:;,-]*\\s*$", "", prefix)
  if (!grepl("[\\?\\.:]$", prefix)) {
    prefix <- sub("\\s+\\S*$", "", prefix)
  }
  prefix <- .sm_norm_ws(prefix)

  words_n <- if (nzchar(prefix)) length(strsplit(prefix, "\\s+")[[1]]) else 0L
  if (!nzchar(prefix) || nchar(prefix) < 20L || words_n < 4L) {
    return(NA_character_)
  }

  prefix
}

.sm_safe_slug <- function(x) {
  x <- janitor::make_clean_names(as.character(x))
  x <- gsub("_+", "_", x)
  x <- gsub("^_|_$", "", x)
  ifelse(!nzchar(x), "var", x)
}

.sm_other_name <- function(group_guess, fallback = "other") {
  grp <- .sm_safe_slug(.sm_or(group_guess, fallback))[1]
  paste0(grp, "_other")
}

.sm_unique_name <- function(base, used, suffix = "x") {
  nm <- .sm_safe_slug(base)[1]
  if (!nm %in% used) return(nm)

  i <- 1L
  repeat {
    cand <- paste0(nm, "_", suffix, i)
    if (!cand %in% used) return(cand)
    i <- i + 1L
  }
}

.sm_parse_var_name <- function(nm) {
  nm <- as.character(nm)[1]
  low <- tolower(trimws(nm))

  if (grepl("^(.*?)[_.](o|other|otro)$", low, perl = TRUE)) {
    stem <- sub("^(.*?)[_.](o|other|otro)$", "\\1", low, perl = TRUE)
    return(list(stem = stem, suffix = "O", is_other = TRUE))
  }

  if (grepl("^(.*?)[_.]([0-9]+)$", low, perl = TRUE)) {
    stem <- sub("^(.*?)[_.]([0-9]+)$", "\\1", low, perl = TRUE)
    sfx  <- sub("^(.*?)[_.]([0-9]+)$", "\\2", low, perl = TRUE)
    return(list(stem = stem, suffix = sfx, is_other = FALSE))
  }

  list(stem = low, suffix = NA_character_, is_other = FALSE)
}

.sm_label_signature <- function(x) {
  labs <- attr(x, "labels", exact = TRUE)
  if (is.null(labs) || !length(labs)) return(NA_character_)
  paste0(names(labs), "=", unname(labs), collapse = " | ")
}

.sm_is_binary_like <- function(x) {
  labs <- attr(x, "labels", exact = TRUE)
  if (!is.null(labs) && length(labs) == 1L) return(TRUE)
  if (is.logical(x)) return(TRUE)

  x_chr <- trimws(as.character(x))
  x_chr <- x_chr[!is.na(x_chr) & nzchar(x_chr)]
  if (!length(x_chr)) return(FALSE)

  x_num <- suppressWarnings(as.numeric(x_chr))
  if (all(!is.na(x_num))) {
    return(all(unique(x_num) %in% c(0, 1)))
  }

  all(unique(tolower(x_chr)) %in% c("0", "1", "true", "false", "t", "f", "si", "sí", "no", "yes"))
}

.sm_is_text_select_one_like <- function(x) {
  if (!(is.character(x) || is.factor(x))) return(FALSE)

  vals <- .sm_unique_nonempty(x)
  n_vals <- length(vals)
  if (n_vals < 2L || n_vals > 8L) return(FALSE)
  if (any(nchar(vals) > 80L)) return(FALSE)

  x_chr <- .sm_norm_ws(x)
  x_chr <- x_chr[!is.na(x_chr) & nzchar(x_chr)]
  n_nonmiss <- length(x_chr)
  if (!n_nonmiss) return(FALSE)

  # Evita tratar textos realmente abiertos como categorías cuando casi todo es único.
  if (n_vals > max(3L, floor(n_nonmiss * 0.5))) return(FALSE)

  TRUE
}

.sm_is_dummy_selected <- function(x) {
  labs <- attr(x, "labels", exact = TRUE)
  x_chr <- as.character(x)
  selected <- rep(FALSE, length(x_chr))

  if (!is.null(labs) && length(labs) == 1L) {
    code <- as.character(unname(labs)[1])
    selected <- !is.na(x_chr) & trimws(x_chr) == trimws(code)
    return(selected)
  }

  x_num <- suppressWarnings(as.numeric(x_chr))
  if (!all(is.na(x_num))) {
    return(!is.na(x_num) & x_num == 1)
  }

  x_low <- tolower(trimws(x_chr))
  !is.na(x_low) & x_low %in% c("1", "true", "t", "si", "sí", "yes")
}

.sm_is_metadata_name <- function(nm) {
  low <- tolower(trimws(as.character(nm)[1]))
  low %in% c(
    "collectornm", "respondent_id", "collector_id", "date_created",
    "date_modified", "ip_address", "email_address", "first_name",
    "last_name"
  ) || grepl("^custom_[0-9]+$", low)
}

.sm_is_question_name <- function(nm) {
  low <- tolower(trimws(as.character(nm)[1]))
  grepl("^p[0-9]+([_.](?:[0-9]+|o|other|otro))?$", low, perl = TRUE)
}

.sm_infer_other_label <- function(other_row, choice_labels = character()) {
  choice_labels <- .sm_norm_ws(choice_labels)
  if (length(choice_labels)) {
    idx_other <- grep("^(otro|otra|other)(\\b|:)", tolower(choice_labels))
    if (length(idx_other)) {
      return(choice_labels[idx_other[1]])
    }
  }

  lab <- .sm_norm_ws(.sm_as_question_label(other_row))
  if (grepl("^other\\b", tolower(lab))) {
    return("Otro:")
  }

  lab
}

.sm_infer_other_label_from_group <- function(row, vars_tbl, label_sets) {
  siblings <- vars_tbl[
    vars_tbl$group_guess == row$group_guess &
      vars_tbl$name_raw != row$name_raw &
      vars_tbl$n_value_labels > 1L,
    ,
    drop = FALSE
  ]

  if (nrow(siblings)) {
    for (i in seq_len(nrow(siblings))) {
      labs <- .sm_or(label_sets[[siblings$name_raw[i]]], numeric(0))
      if (!length(labs)) next
      lbl <- .sm_infer_other_label(row, choice_labels = names(labs))
      if (!is.na(lbl) && nzchar(lbl)) {
        return(lbl)
      }
    }
  }

  .sm_infer_other_label(row)
}

.sm_ascii_lower <- function(x) {
  x <- .sm_norm_ws(x)
  out <- if (requireNamespace("stringi", quietly = TRUE)) {
    stringi::stri_trans_general(x, "Latin-ASCII")
  } else {
    iconv(x, from = "", to = "ASCII//TRANSLIT")
  }
  tolower(out)
}

.sm_choice_signature <- function(labs) {
  if (is.null(labs) || !length(labs)) return(NA_character_)
  ord <- order(unname(labs), seq_along(labs))
  codes <- as.character(unname(labs)[ord])
  labels <- .sm_ascii_lower(names(labs)[ord])
  paste(paste0(codes, ":", labels), collapse = " | ")
}

.sm_choice_family_base <- function(labs) {
  if (is.null(labs) || !length(labs)) return(NA_character_)

  ord <- order(unname(labs), seq_along(labs))
  codes <- unname(labs)[ord]
  labels <- .sm_ascii_lower(names(labs)[ord])

  miss_idx <- grepl(
    paste(
      c(
        "^sin\\s*inf",
        "sin informacion suficiente",
        "sin información suficiente",
        "no tiene informacion suficiente",
        "no tiene información suficiente",
        "^ns/?nr$",
        "no sabe",
        "no responde"
      ),
      collapse = "|"
    ),
    labels
  )

  core_labels <- labels[!miss_idx]
  core_codes <- codes[!miss_idx]

  if (identical(core_labels, c("si", "no")) && identical(as.numeric(core_codes), c(1, 2))) {
    return("si_no")
  }

  if (
    identical(
      core_labels,
      c("totalmente en desacuerdo", "en desacuerdo", "de acuerdo", "totalmente de acuerdo")
    )
  ) {
    return("acuerdo_4")
  }

  if (
    identical(
      core_labels,
      c("nada satisfecho", "poco satisfecho", "satisfecho", "muy satisfecho")
    )
  ) {
    return("satisfaccion_4")
  }

  if (
    identical(
      core_labels,
      c("muy insatisfecho", "insatisfecho", "satisfecho", "muy satisfecho")
    )
  ) {
    return("satisfaccion_4")
  }

  NA_character_
}

.sm_sort_group_rows <- function(df) {
  if (is.null(df) || !nrow(df) || !("suffix" %in% names(df))) return(df)
  suffix_num <- suppressWarnings(as.numeric(as.character(df$suffix)))
  if (all(!is.na(suffix_num))) {
    df <- df[order(suffix_num, df$order), , drop = FALSE]
  } else {
    df <- df[order(df$order), , drop = FALSE]
  }
  if ("order" %in% names(df)) {
    start_ord <- suppressWarnings(min(as.numeric(df$order), na.rm = TRUE))
    if (!is.finite(start_ord)) start_ord <- 1L
    df$order <- start_ord + seq_len(nrow(df)) - 1L
  }
  df
}

.sm_detect_datetime <- function(x, nm = NULL) {
  if (inherits(x, c("POSIXct", "POSIXlt"))) return(TRUE)

  nm_low <- tolower(trimws(as.character(.sm_or(nm, ""))[1]))
  x_chr <- trimws(as.character(x))
  x_chr <- x_chr[!is.na(x_chr) & nzchar(x_chr)]
  if (!length(x_chr)) return(FALSE)

  if (!(nm_low %in% c("date_created", "date_modified") ||
        grepl("date|fecha|time|hora", nm_low))) {
    return(FALSE)
  }

  formats <- c(
    "%m/%d/%Y %I:%M:%S %p",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%d/%m/%Y %H:%M:%S",
    "%d/%m/%Y %I:%M:%S %p"
  )

  ratios <- vapply(formats, function(fmt) {
    parsed <- as.POSIXct(x_chr, format = fmt, tz = "UTC")
    mean(!is.na(parsed))
  }, numeric(1))

  max(ratios, na.rm = TRUE) >= 0.8
}

.sm_storage_type_guess <- function(x, nm = NULL) {
  if (.sm_detect_datetime(x, nm = nm)) return("datetime")

  if (is.numeric(x) || inherits(x, "haven_labelled")) {
    x_num <- suppressWarnings(as.numeric(x))
    x_num <- x_num[!is.na(x_num)]
    if (!length(x_num)) return("integer")
    if (all(abs(x_num - round(x_num)) < 1e-8)) return("integer")
    return("decimal")
  }

  "text"
}

.sm_multi_groups <- function(vars_tbl) {
  grps <- split(vars_tbl, vars_tbl$group_guess)
  keep <- vapply(grps, function(df) {
    df2 <- df[!df$is_metadata & !df$is_other & df$is_question_like, , drop = FALSE]
    if (nrow(df2) < 2L) return(FALSE)
    if (any(is.na(df2$suffix) | !grepl("^[0-9]+$", df2$suffix))) return(FALSE)
    all(df2$n_value_labels == 1L | df2$binary_like)
  }, logical(1))
  names(grps)[keep]
}

.sm_battery_groups <- function(vars_tbl) {
  grps <- split(vars_tbl, vars_tbl$group_guess)
  keep <- vapply(grps, function(df) {
    df2 <- df[!df$is_metadata & !df$is_other & df$is_question_like, , drop = FALSE]
    if (nrow(df2) < 2L) return(FALSE)
    if (any(is.na(df2$suffix) | !grepl("^[0-9]+$", df2$suffix))) return(FALSE)
    if (any(df2$n_value_labels <= 1L)) return(FALSE)
    sig <- unique(df2$label_signature[!is.na(df2$label_signature)])
    length(sig) == 1L
  }, logical(1))
  names(grps)[keep]
}

.sm_build_read_object <- function(path, user_na = TRUE) {
  data_raw <- haven::read_sav(path, user_na = user_na)
  cols <- names(data_raw)
  parsed <- lapply(cols, .sm_parse_var_name)
  name_clean <- janitor::make_clean_names(cols)

  vars_tbl <- tibble::tibble(
    order = seq_along(cols),
    name_raw = cols,
    name_clean = name_clean,
    label = vapply(data_raw, function(v) .sm_first_nonempty(attr(v, "label", exact = TRUE), fallback = NA_character_), character(1)),
    class = vapply(data_raw, function(v) paste(class(v), collapse = ","), character(1)),
    n_value_labels = vapply(data_raw, function(v) length(.sm_or(attr(v, "labels", exact = TRUE), numeric(0))), integer(1)),
    is_labelled = vapply(data_raw, inherits, logical(1), what = "haven_labelled"),
    stem = vapply(parsed, `[[`, character(1), "stem"),
    suffix = vapply(parsed, `[[`, character(1), "suffix"),
    is_other = vapply(parsed, `[[`, logical(1), "is_other"),
    group_guess = vapply(parsed, function(z) .sm_safe_slug(z$stem), character(1)),
    is_metadata = vapply(cols, .sm_is_metadata_name, logical(1)),
    is_question_like = vapply(cols, .sm_is_question_name, logical(1)),
    label_signature = vapply(data_raw, .sm_label_signature, character(1)),
    binary_like = vapply(data_raw, .sm_is_binary_like, logical(1)),
    text_select_one_like = vapply(data_raw, .sm_is_text_select_one_like, logical(1)),
    storage_type_guess = vapply(seq_along(data_raw), function(i) .sm_storage_type_guess(data_raw[[i]], cols[i]), character(1))
  )
  vars_tbl$is_auxiliary <- !vars_tbl$is_metadata & !vars_tbl$is_question_like

  multi_groups <- .sm_multi_groups(vars_tbl)
  battery_groups <- .sm_battery_groups(vars_tbl)

  vars_tbl$kind_guess <- ifelse(
    vars_tbl$is_metadata, "metadata",
    ifelse(
      vars_tbl$is_other, "other_text",
      ifelse(
        vars_tbl$group_guess %in% multi_groups, "select_multiple_dummy",
        ifelse(
          vars_tbl$group_guess %in% battery_groups, "battery_item",
          ifelse(vars_tbl$n_value_labels > 1L | vars_tbl$text_select_one_like, "select_one", vars_tbl$storage_type_guess)
        )
      )
    )
  )

  label_sets <- stats::setNames(lapply(seq_along(data_raw), function(i) {
    labs <- attr(data_raw[[i]], "labels", exact = TRUE)
    if (!is.null(labs) && length(labs)) return(labs)
    if (isTRUE(vars_tbl$text_select_one_like[i])) return(.sm_text_label_set(data_raw[[i]]))
    character(0)
  }), cols)
  structure(
    list(
      data_raw = as.data.frame(data_raw, stringsAsFactors = FALSE),
      vars_tbl = vars_tbl,
      label_sets = label_sets,
      meta = list(
        path = normalizePath(path, winslash = "/", mustWork = TRUE),
        file_name = basename(path),
        n_rows = nrow(data_raw),
        n_cols = ncol(data_raw),
        multi_groups = multi_groups,
        battery_groups = battery_groups
      )
    ),
    class = "prosecnur_surveymonkey"
  )
}

.sm_as_question_label <- function(row) {
  .sm_first_nonempty(row$label, fallback = row$name_raw)
}

.sm_build_spec <- function(x, lang = "es") {
  if (!inherits(x, "prosecnur_surveymonkey")) {
    stop("`x` debe ser el resultado de `surveymonkey_leer()`.", call. = FALSE)
  }

  vars_tbl <- x$vars_tbl
  label_sets <- x$label_sets
  used_names <- character(0)
  used_lists <- character(0)
  question_specs <- list()
  multi_specs <- list()
  battery_specs <- list()

  metadata_section <- "survey_monkey_metadata"
  auxiliary_section <- "survey_monkey_auxiliary"
  list_registry_sig <- character(0)
  list_registry_name <- character(0)

  name_candidates <- vars_tbl$name_clean
  idx_other <- which(vars_tbl$kind_guess == "other_text")
  if (length(idx_other)) {
    name_candidates[idx_other] <- vapply(idx_other, function(i) {
      .sm_other_name(vars_tbl$group_guess[i], fallback = vars_tbl$name_clean[i])
    }, character(1))
  }

  vars_tbl$name_final <- NA_character_
  used_final_names <- character(0)
  for (i in seq_len(nrow(vars_tbl))) {
    vars_tbl$name_final[i] <- .sm_unique_name(
      name_candidates[i],
      used = used_final_names,
      suffix = "q"
    )
    used_final_names <- c(used_final_names, vars_tbl$name_final[i])
  }
  vars_tbl$list_name_final <- NA_character_
  vars_tbl$section_final <- ifelse(
    vars_tbl$is_metadata, metadata_section,
    ifelse(vars_tbl$is_auxiliary, auxiliary_section,
    ifelse(vars_tbl$kind_guess %in% c("battery_item", "select_multiple_dummy", "other_text"),
           vars_tbl$group_guess,
           "survey_monkey_main"))
  )

  alloc_choice_list_name <- function(labs, fallback_base) {
    sig <- .sm_choice_signature(labs)
    if (!is.na(sig) && sig %in% list_registry_sig) {
      return(list_registry_name[match(sig, list_registry_sig)])
    }

    base <- .sm_choice_family_base(labs)
    if (is.na(base) || !nzchar(base)) {
      base <- .sm_safe_slug(fallback_base)[1]
    }

    list_name <- .sm_unique_name(paste0("lst_", base), used_lists, suffix = "ln")
    used_lists <<- c(used_lists, list_name)

    if (!is.na(sig) && nzchar(sig)) {
      list_registry_sig <<- c(list_registry_sig, sig)
      list_registry_name <<- c(list_registry_name, list_name)
    }

    list_name
  }

  # -- precompute battery list names ---------------------------------------
  battery_groups <- unique(vars_tbl$group_guess[vars_tbl$kind_guess == "battery_item"])
  for (grp in battery_groups) {
    rows <- vars_tbl[vars_tbl$group_guess == grp & vars_tbl$kind_guess == "battery_item", , drop = FALSE]
    rows <- .sm_sort_group_rows(rows)
    prompt_label <- .sm_prompt_from_labels(rows$label)

    labs <- .sm_or(label_sets[[rows$name_raw[1]]], numeric(0))
    list_name <- alloc_choice_list_name(
      labs = labs,
      fallback_base = grp
    )
    vars_tbl$list_name_final[match(rows$name_raw, vars_tbl$name_raw)] <- list_name
    battery_specs[[grp]] <- list(
      group_name = .sm_unique_name(paste0("grp_", grp), character(0), suffix = "grp"),
      group_label = prompt_label,
      rows = rows,
      list_name = list_name,
      choices = tibble::tibble(
        list_name = list_name,
        name = as.character(unname(labs)),
        `label::es` = as.character(names(labs))
      )
    )
  }

  # -- precompute select_multiple groups -----------------------------------
  multi_groups <- unique(vars_tbl$group_guess[vars_tbl$kind_guess == "select_multiple_dummy"])
  non_multi_names <- vars_tbl$name_final[vars_tbl$kind_guess != "select_multiple_dummy"]
  for (grp in multi_groups) {
    rows <- vars_tbl[vars_tbl$group_guess == grp & vars_tbl$kind_guess == "select_multiple_dummy", , drop = FALSE]
    rows <- .sm_sort_group_rows(rows)
    others <- vars_tbl[vars_tbl$group_guess == grp & vars_tbl$kind_guess == "other_text", , drop = FALSE]

    mother_name <- .sm_unique_name(grp, c(non_multi_names, used_names), suffix = "sm")
    used_names <- c(used_names, mother_name)

    choice_labels <- vapply(seq_len(nrow(rows)), function(i) {
      labs <- .sm_or(label_sets[[rows$name_raw[i]]], numeric(0))
      if (length(labs) >= 1L) {
        as.character(names(labs)[1])
      } else {
        .sm_as_question_label(rows[i, , drop = FALSE])
      }
    }, character(1))
    question_label <- .sm_or(
      .sm_prompt_from_labels(rows$label),
      .sm_mode_nonempty(rows$label, fallback = grp)
    )
    labs_multi <- stats::setNames(as.character(rows$suffix), choice_labels)
    list_name <- alloc_choice_list_name(
      labs = labs_multi,
      fallback_base = grp
    )
    choice_rows <- lapply(seq_len(nrow(rows)), function(i) {
      tibble::tibble(
        list_name = list_name,
        name = as.character(rows$suffix[i]),
        `label::es` = choice_labels[i]
      )
    })

    other_specs <- if (nrow(others)) {
      lapply(seq_len(nrow(others)), function(i) {
        tibble::tibble(
          role = "other_text",
          raw_name = others$name_raw[i],
          name = others$name_final[i],
          label = .sm_infer_other_label(others[i, , drop = FALSE], choice_labels = choice_labels),
          type = "text",
          list_name = NA_character_,
          section = others$section_final[i],
          order = others$order[i],
          group_guess = grp
        )
      })
    } else {
      list()
    }

    multi_specs[[grp]] <- list(
      mother = tibble::tibble(
        role = "select_multiple",
        raw_name = NA_character_,
        name = mother_name,
        label = question_label,
        type = paste("select_multiple", list_name),
        list_name = list_name,
        section = rows$section_final[1],
        order = min(rows$order),
        group_guess = grp
      ),
      children = rows,
      others = others,
      questions = other_specs,
      choices = dplyr::bind_rows(choice_rows)
    )
  }

  # -- standalone question specs -------------------------------------------
  for (i in seq_len(nrow(vars_tbl))) {
    row <- vars_tbl[i, , drop = FALSE]
    if (row$kind_guess %in% c("select_multiple_dummy", "battery_item")) next
    if (row$kind_guess == "other_text" && row$group_guess %in% names(multi_specs)) next

    q_type <- switch(
      row$kind_guess,
      metadata = row$storage_type_guess,
      select_one = {
        labs <- .sm_or(label_sets[[row$name_raw]], numeric(0))
        list_name <- alloc_choice_list_name(
          labs = labs,
          fallback_base = row$group_guess
        )
        vars_tbl$list_name_final[i] <- list_name
        paste("select_one", list_name)
      },
      integer = "integer",
      decimal = "decimal",
      datetime = "datetime",
      other_text = "text",
      "text"
    )

    question_specs[[length(question_specs) + 1L]] <- tibble::tibble(
      role = row$kind_guess,
      raw_name = row$name_raw,
      name = row$name_final,
      label = if (row$kind_guess == "other_text") {
        .sm_infer_other_label_from_group(row, vars_tbl = vars_tbl, label_sets = label_sets)
      } else {
        .sm_as_question_label(row)
      },
      type = q_type,
      list_name = .sm_or(vars_tbl$list_name_final[i], NA_character_),
      section = row$section_final,
      order = row$order,
      group_guess = row$group_guess
    )
  }

  # -- battery items --------------------------------------------------------
  for (grp in names(battery_specs)) {
    rows <- battery_specs[[grp]]$rows
    list_name <- battery_specs[[grp]]$list_name
    for (i in seq_len(nrow(rows))) {
      question_specs[[length(question_specs) + 1L]] <- tibble::tibble(
        role = "battery_item",
        raw_name = rows$name_raw[i],
        name = rows$name_final[i],
        label = .sm_as_question_label(rows[i, , drop = FALSE]),
        type = paste("select_one", list_name),
        list_name = list_name,
        section = rows$section_final[i],
        order = rows$order[i],
        group_guess = grp
      )
    }
  }

  question_specs <- dplyr::bind_rows(question_specs)

  # -- choices for standalone select_one -----------------------------------
  choice_parts <- list()
  so_rows <- question_specs[question_specs$role == "select_one", , drop = FALSE]
  if (nrow(so_rows)) {
    for (i in seq_len(nrow(so_rows))) {
      raw_name <- so_rows$raw_name[i]
      labs <- .sm_or(label_sets[[raw_name]], numeric(0))
      if (!length(labs)) next
      choice_parts[[length(choice_parts) + 1L]] <- tibble::tibble(
        list_name = so_rows$list_name[i],
        name = as.character(unname(labs)),
        `label::es` = as.character(names(labs))
      )
    }
  }

  if (length(battery_specs)) {
    choice_parts <- c(choice_parts, lapply(battery_specs, `[[`, "choices"))
  }
  if (length(multi_specs)) {
    choice_parts <- c(choice_parts, lapply(multi_specs, `[[`, "choices"))
  }

  choices <- if (length(choice_parts)) {
    dplyr::bind_rows(choice_parts) |>
      dplyr::distinct(.data$list_name, .data$name, .keep_all = TRUE)
  } else {
    tibble::tibble(list_name = character(), name = character(), `label::es` = character())
  }

  # -- survey rows with begin/end groups -----------------------------------
  survey_rows <- list()
  seen_battery <- character(0)
  seen_multi <- character(0)
  metadata_open <- FALSE
  auxiliary_open <- FALSE

  vars_ordered <- vars_tbl[order(vars_tbl$order), , drop = FALSE]
  metadata_name <- metadata_section
  metadata_label <- "Metadata SurveyMonkey"
  auxiliary_name <- auxiliary_section
  auxiliary_label <- "Variables auxiliares SurveyMonkey"

  add_question_by_raw <- function(raw_name) {
    question_specs[question_specs$raw_name == raw_name, , drop = FALSE]
  }

  for (i in seq_len(nrow(vars_ordered))) {
    row <- vars_ordered[i, , drop = FALSE]

    if (row$is_metadata) {
      if (!metadata_open) {
        survey_rows[[length(survey_rows) + 1L]] <- tibble::tibble(
          type = "begin_group",
          name = metadata_name,
          `label::es` = metadata_label,
          required = NA_character_,
          relevant = NA_character_,
          constraint = NA_character_,
          calculation = NA_character_,
          choice_filter = NA_character_,
          section = metadata_name
        )
        metadata_open <- TRUE
      }

      survey_rows[[length(survey_rows) + 1L]] <- add_question_by_raw(row$name_raw) |>
        dplyr::transmute(
          type = .data$type,
          name = .data$name,
          `label::es` = .data$label,
          required = NA_character_,
          relevant = NA_character_,
          constraint = NA_character_,
          calculation = NA_character_,
          choice_filter = NA_character_,
          section = .data$section
        )

      next_is_meta <- i < nrow(vars_ordered) && isTRUE(vars_ordered$is_metadata[i + 1L])
      if (!next_is_meta) {
        survey_rows[[length(survey_rows) + 1L]] <- tibble::tibble(
          type = "end_group",
          name = NA_character_,
          `label::es` = NA_character_,
          required = NA_character_,
          relevant = NA_character_,
          constraint = NA_character_,
          calculation = NA_character_,
          choice_filter = NA_character_,
          section = metadata_name
        )
        metadata_open <- FALSE
      }
      next
    }

    if (row$is_auxiliary) {
      if (!auxiliary_open) {
        survey_rows[[length(survey_rows) + 1L]] <- tibble::tibble(
          type = "begin_group",
          name = auxiliary_name,
          `label::es` = auxiliary_label,
          required = NA_character_,
          relevant = NA_character_,
          constraint = NA_character_,
          calculation = NA_character_,
          choice_filter = NA_character_,
          section = auxiliary_name
        )
        auxiliary_open <- TRUE
      }

      survey_rows[[length(survey_rows) + 1L]] <- add_question_by_raw(row$name_raw) |>
        dplyr::transmute(
          type = .data$type,
          name = .data$name,
          `label::es` = .data$label,
          required = NA_character_,
          relevant = NA_character_,
          constraint = NA_character_,
          calculation = NA_character_,
          choice_filter = NA_character_,
          section = .data$section
        )

      next_is_aux <- i < nrow(vars_ordered) && isTRUE(vars_ordered$is_auxiliary[i + 1L])
      if (!next_is_aux) {
        survey_rows[[length(survey_rows) + 1L]] <- tibble::tibble(
          type = "end_group",
          name = NA_character_,
          `label::es` = NA_character_,
          required = NA_character_,
          relevant = NA_character_,
          constraint = NA_character_,
          calculation = NA_character_,
          choice_filter = NA_character_,
          section = auxiliary_name
        )
        auxiliary_open <- FALSE
      }
      next
    }

    if (row$kind_guess == "battery_item") {
      grp <- row$group_guess
      if (grp %in% seen_battery) next

      spec_grp <- battery_specs[[grp]]
      survey_rows[[length(survey_rows) + 1L]] <- tibble::tibble(
        type = "begin_group",
        name = spec_grp$group_name,
        `label::es` = .sm_or(spec_grp$group_label, NA_character_),
        required = NA_character_,
        relevant = NA_character_,
        constraint = NA_character_,
        calculation = NA_character_,
        choice_filter = NA_character_,
        section = grp
      )

      group_rows <- question_specs[question_specs$group_guess == grp & question_specs$role == "battery_item", , drop = FALSE]
      group_rows <- group_rows[order(group_rows$order), , drop = FALSE]
      survey_rows[[length(survey_rows) + 1L]] <- group_rows |>
        dplyr::transmute(
          type = .data$type,
          name = .data$name,
          `label::es` = .data$label,
          required = NA_character_,
          relevant = NA_character_,
          constraint = NA_character_,
          calculation = NA_character_,
          choice_filter = NA_character_,
          section = .data$section
        )

      survey_rows[[length(survey_rows) + 1L]] <- tibble::tibble(
        type = "end_group",
        name = NA_character_,
        `label::es` = NA_character_,
        required = NA_character_,
        relevant = NA_character_,
        constraint = NA_character_,
        calculation = NA_character_,
        choice_filter = NA_character_,
        section = grp
      )

      seen_battery <- c(seen_battery, grp)
      next
    }

    if (row$kind_guess == "select_multiple_dummy") {
      grp <- row$group_guess
      if (grp %in% seen_multi) next

      spec_grp <- multi_specs[[grp]]
      survey_rows[[length(survey_rows) + 1L]] <- spec_grp$mother |>
        dplyr::transmute(
          type = .data$type,
          name = .data$name,
          `label::es` = .data$label,
          required = NA_character_,
          relevant = NA_character_,
          constraint = NA_character_,
          calculation = NA_character_,
          choice_filter = NA_character_,
          section = .data$section
        )

      if (length(spec_grp$questions)) {
        survey_rows[[length(survey_rows) + 1L]] <- dplyr::bind_rows(spec_grp$questions) |>
          dplyr::arrange(.data$order) |>
          dplyr::transmute(
            type = .data$type,
            name = .data$name,
            `label::es` = .data$label,
            required = NA_character_,
            relevant = NA_character_,
            constraint = NA_character_,
            calculation = NA_character_,
            choice_filter = NA_character_,
            section = .data$section
          )
      }

      seen_multi <- c(seen_multi, grp)
      next
    }

    if (row$kind_guess == "other_text" && row$group_guess %in% names(multi_specs)) next

    survey_rows[[length(survey_rows) + 1L]] <- add_question_by_raw(row$name_raw) |>
      dplyr::transmute(
        type = .data$type,
        name = .data$name,
        `label::es` = .data$label,
        required = NA_character_,
        relevant = NA_character_,
        constraint = NA_character_,
        calculation = NA_character_,
        choice_filter = NA_character_,
        section = .data$section
      )
  }

  survey <- dplyr::bind_rows(survey_rows)

  settings <- tibble::tibble(
    form_title = paste("SurveyMonkey reference", tools::file_path_sans_ext(x$meta$file_name)),
    form_id = .sm_safe_slug(tools::file_path_sans_ext(x$meta$file_name)),
    default_language = lang,
    version = format(Sys.Date(), "%Y%m%d")
  )

  diagnostico <- vars_tbl |>
    dplyr::left_join(
      question_specs |>
        dplyr::select(
          .data$raw_name,
          name_final_ref = .data$name,
          type_final_ref = .data$type,
          list_name_final_ref = .data$list_name
        ),
      by = c("name_raw" = "raw_name")
    ) |>
    dplyr::mutate(
      name_final = dplyr::coalesce(.data$name_final_ref, .data$name_final, .data$name_clean),
      type_final = dplyr::coalesce(
        .data$type_final_ref,
        ifelse(.data$kind_guess == "select_multiple_dummy", "select_multiple (mother)", .data$storage_type_guess)
      ),
      list_name_final = dplyr::coalesce(.data$list_name_final_ref, .data$list_name_final)
    ) |>
    dplyr::select(
      .data$order,
      .data$name_raw,
      .data$name_clean,
      .data$name_final,
      .data$label,
      .data$kind_guess,
      .data$storage_type_guess,
      .data$type_final,
      .data$list_name_final,
      .data$section_final,
      .data$is_metadata,
      .data$is_auxiliary,
      .data$is_other,
      .data$is_question_like,
      .data$group_guess,
      .data$n_value_labels,
      .data$class
    )

  list(
    survey = survey,
    choices = choices,
    settings = settings,
    diagnostico = diagnostico,
    question_specs = question_specs,
    multi_specs = multi_specs,
    battery_specs = battery_specs
  )
}

#' Leer un export SPSS (.sav) de SurveyMonkey
#'
#' @param path Ruta al archivo `.sav`.
#' @param user_na Si `TRUE`, preserva los user missing de SPSS.
#' @return Objeto clase `prosecnur_surveymonkey`.
#' @family surveymonkey
#' @export
surveymonkey_leer <- function(path, user_na = TRUE) {
  if (!file.exists(path)) {
    stop("No existe el archivo: ", path, call. = FALSE)
  }
  .sm_build_read_object(path = path, user_na = user_na)
}

#' Generar un XLSForm de referencia desde SurveyMonkey
#'
#' @param x Objeto generado por [surveymonkey_leer()].
#' @param path Ruta opcional para escribir el workbook `.xlsx`.
#' @param lang Idioma del XLSForm de referencia.
#' @return Lista clase `prosecnur_surveymonkey_xlsform`.
#' @family surveymonkey
#' @export
surveymonkey_xlsform <- function(x, path = NULL, lang = "es") {
  spec <- .sm_build_spec(x = x, lang = lang)

  out <- structure(
    list(
      survey = spec$survey,
      choices = spec$choices,
      settings = spec$settings,
      diagnostico = spec$diagnostico
    ),
    class = "prosecnur_surveymonkey_xlsform"
  )

  if (!is.null(path)) {
    openxlsx::write.xlsx(
      x = list(
        survey = out$survey,
        choices = out$choices,
        settings = out$settings,
        diagnostico = out$diagnostico
      ),
      file = path,
      overwrite = TRUE
    )
  }

  out
}

#' Preparar data de SurveyMonkey para el flujo analítico
#'
#' @param x Objeto generado por [surveymonkey_leer()].
#' @param keep_raw_multi Si `TRUE`, conserva también las columnas dummy crudas
#'   originales tipo `parent_code`.
#' @param keep_metadata Si `TRUE`, conserva las variables técnicas de SurveyMonkey.
#' @return `data.frame` compatible con `reporte_instrumento()` + `reporte_data()`.
#' @family surveymonkey
#' @export
surveymonkey_data <- function(x, keep_raw_multi = FALSE, keep_metadata = TRUE) {
  spec <- .sm_build_spec(x = x, lang = "es")
  df <- x$data_raw
  out <- list()

  question_specs <- spec$question_specs[order(spec$question_specs$order), , drop = FALSE]

  recode_text_select_one <- function(values, labs) {
    if (!(is.character(values) || is.factor(values)) || is.null(labs) || !length(labs)) {
      return(values)
    }

    labels_norm <- .sm_norm_ws(names(labs))
    codes_chr <- as.character(unname(labs))
    map <- stats::setNames(codes_chr, labels_norm)

    values_norm <- .sm_norm_ws(values)
    out_vals <- unname(map[values_norm])
    out_vals[is.na(values_norm) | !nzchar(values_norm)] <- NA_character_
    out_vals[!is.na(values_norm) & nzchar(values_norm) & is.na(out_vals)] <- values_norm[!is.na(values_norm) & nzchar(values_norm) & is.na(out_vals)]
    out_vals
  }

  for (i in seq_len(nrow(question_specs))) {
    row <- question_specs[i, , drop = FALSE]
    row_role <- as.character(row$role[1])

    if (identical(row_role, "metadata") && !isTRUE(keep_metadata)) next

    if (!is.na(row$raw_name) && row$raw_name %in% names(df)) {
      values <- df[[row$raw_name]]
      if (identical(row_role, "select_one")) {
        values <- recode_text_select_one(values, x$label_sets[[row$raw_name]])
      }
      out[[row$name]] <- values
    }
  }

  if (length(spec$multi_specs)) {
    for (grp in names(spec$multi_specs)) {
      msp <- spec$multi_specs[[grp]]
      mother_name <- msp$mother$name[1]
      child_rows <- msp$children[order(msp$children$order), , drop = FALSE]
      codes <- as.character(child_rows$suffix)

      tokens <- lapply(seq_len(nrow(child_rows)), function(i) {
        sel <- .sm_is_dummy_selected(df[[child_rows$name_raw[i]]])
        ifelse(sel, codes[i], NA_character_)
      })

      token_mat <- do.call(cbind, tokens)
      if (is.null(dim(token_mat))) {
        token_mat <- matrix(token_mat, ncol = 1L)
      }

      mother <- apply(token_mat, 1, function(z) {
        z <- z[!is.na(z) & nzchar(z)]
        if (!length(z)) return(NA_character_)
        paste(z, collapse = " ")
      })
      out[[mother_name]] <- mother

      if (length(msp$questions)) {
        other_questions <- dplyr::bind_rows(msp$questions) |>
          dplyr::arrange(.data$order)
        for (i in seq_len(nrow(other_questions))) {
          out[[other_questions$name[i]]] <- df[[other_questions$raw_name[i]]]
        }
      }

      choice_labels <- msp$choices$`label::es`[match(codes, msp$choices$name)]

      for (i in seq_len(nrow(child_rows))) {
        slash_name <- paste0(mother_name, "/", codes[i])
        out[[slash_name]] <- df[[child_rows$name_raw[i]]]

        lbl_i <- .sm_or(choice_labels[i], .sm_as_question_label(child_rows[i, , drop = FALSE]))
        if (
          grepl("^(otro|otra|other)(\\b|:)", tolower(lbl_i)) &&
            !paste0(mother_name, "/Other") %in% names(out)
        ) {
          out[[paste0(mother_name, "/Other")]] <- df[[child_rows$name_raw[i]]]
        }
      }

      if (isTRUE(keep_raw_multi)) {
        for (i in seq_len(nrow(child_rows))) {
          out[[child_rows$name_final[i]]] <- df[[child_rows$name_raw[i]]]
        }
      }
    }
  }

  out_df <- as.data.frame(out, stringsAsFactors = FALSE, check.names = FALSE)

  # Reordenar según el survey generado, conservando extras opcionales al final.
  survey_names <- spec$survey$name[!is.na(spec$survey$name) & nzchar(spec$survey$name)]
  survey_names <- survey_names[survey_names %in% names(out_df)]
  extra_names <- setdiff(names(out_df), survey_names)
  ordered <- character(0)
  for (nm in survey_names) {
    ordered <- c(
      ordered,
      nm,
      extra_names[startsWith(extra_names, paste0(nm, "/"))],
      extra_names[startsWith(extra_names, paste0(nm, "_"))]
    )
  }
  ordered <- unique(c(ordered, setdiff(extra_names, ordered)))
  ordered <- ordered[ordered %in% names(out_df)]
  out_df[, ordered, drop = FALSE]
}
