.procesamiento_sheet_scalar <- function(x, fallback = "") {
  if (is.null(x) || !length(x)) return(fallback)
  out <- as.character(x[[1]] %||% fallback)
  if (is.na(out)) fallback else out
}

.procesamiento_sheet_type_base <- function(type) {
  out <- trimws(sub("\\s+.*$", "", as.character(type %||% "")))
  out[is.na(out)] <- ""
  out
}

.procesamiento_sheet_label_col <- function(df) {
  if (is.null(df) || !length(names(df))) return(NA_character_)
  hit <- grep("^label($|::)", names(df), value = TRUE, ignore.case = TRUE)[1]
  if (is.na(hit)) NA_character_ else hit
}

.procesamiento_sheet_survey_meta <- function(inst) {
  survey <- inst$survey %||% data.frame()
  if (!is.data.frame(survey) || !"name" %in% names(survey)) return(list())
  label_col <- .procesamiento_sheet_label_col(survey)
  out <- list()
  for (i in seq_len(nrow(survey))) {
    name <- .procesamiento_sheet_scalar(survey$name[i], "")
    if (!nzchar(name)) next
    type_raw <- .procesamiento_sheet_scalar(survey$type[i], "")
    label <- if (!is.na(label_col) && label_col %in% names(survey)) {
      .procesamiento_sheet_scalar(survey[[label_col]][i], name)
    } else {
      name
    }
    list_name <- if ("list_name" %in% names(survey)) {
      .procesamiento_sheet_scalar(survey$list_name[i], "")
    } else ""
    if (!nzchar(list_name) && grepl("^select_(one|multiple)\\b", type_raw)) {
      m <- regmatches(type_raw, regexec("^select_(?:one|multiple)\\s+(\\S+)", type_raw, perl = TRUE))[[1]]
      list_name <- if (length(m) >= 2L) m[2] else ""
    }
    out[[name]] <- list(
      name = name,
      label = label,
      type = type_raw,
      type_base = .procesamiento_sheet_type_base(type_raw),
      list_name = list_name
    )
  }
  out
}

.procesamiento_sheet_dummy_meta <- function(col, survey_meta) {
  if (!grepl("/", col, fixed = TRUE)) return(NULL)
  parent <- sub("/.*$", "", col)
  code <- sub("^.*/", "", col)
  candidates <- unique(c(
    parent,
    sub("(_recod|_sm|_filtro|_aux|_tmp)$", "", parent)
  ))
  for (candidate in candidates) {
    meta <- survey_meta[[candidate]] %||% NULL
    if (is.null(meta) || !identical(meta$type_base, "select_multiple")) next
    return(c(meta, list(dummy_parent = candidate, dummy_code = code)))
  }
  NULL
}

.procesamiento_sheet_type_kind <- function(type_base, col = "") {
  type_base <- as.character(type_base %||% "")
  if (identical(type_base, "dummy_select_multiple") ||
      identical(type_base, "select_multiple") ||
      grepl("/", col, fixed = TRUE)) return("sm")
  if (identical(type_base, "select_one")) return("so")
  if (type_base %in% c("integer", "decimal")) return("integer")
  if (type_base %in% c("text", "string")) return("text")
  "other"
}

.procesamiento_sheet_is_recoded_col <- function(col) {
  col <- .procesamiento_sheet_scalar(col, "")
  nzchar(col) && grepl("(^|[/._-])recod($|[/._-])", col, ignore.case = TRUE, perl = TRUE)
}

.procesamiento_sheet_raw_parent_for_recod <- function(col) {
  col <- .procesamiento_sheet_scalar(col, "")
  if (!.procesamiento_sheet_is_recoded_col(col)) return(NULL)
  raw <- sub("([/._-])recod($|[/._-].*)$", "", col, ignore.case = TRUE, perl = TRUE)
  raw <- trimws(raw)
  if (!nzchar(raw) || identical(raw, col)) NULL else raw
}

.procesamiento_sheet_label_map_from_attr <- function(col) {
  if (exists(".analitica_label_map_from_attr", mode = "function")) {
    return(.analitica_label_map_from_attr(col))
  }
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

.procesamiento_sheet_column_meta <- function(data, inst, coded = FALSE) {
  survey_meta <- .procesamiento_sheet_survey_meta(inst)
  lapply(names(data), function(col) {
    direct <- survey_meta[[col]] %||% NULL
    dummy <- .procesamiento_sheet_dummy_meta(col, survey_meta)
    meta <- direct %||% dummy %||% list(name = col, label = "", type = "", type_base = "")
    label <- attr(data[[col]], "label", exact = TRUE) %||% meta$label %||% col
    label <- .procesamiento_sheet_scalar(label, col)
    type_base <- meta$type_base %||% ""
    if (!is.null(dummy)) type_base <- "dummy_select_multiple"
    kind <- .procesamiento_sheet_type_kind(type_base, col)
    raw_parent <- .procesamiento_sheet_raw_parent_for_recod(col)
    is_recoded <- isTRUE(coded) && !is.null(raw_parent)
    list(
      key = col,
      label = label,
      type = meta$type %||% type_base,
      type_base = type_base,
      type_kind = kind,
      coded = is_recoded && kind %in% c("integer", "sm", "so", "text"),
      is_recoded = is_recoded,
      raw_parent = raw_parent %||% "",
      dummy_parent = dummy$dummy_parent %||% NULL,
      dummy_code = dummy$dummy_code %||% NULL
    )
  })
}

.procesamiento_sheet_value <- function(value) {
  if (is.null(value) || !length(value)) return("")
  if (length(value) > 1L) value <- value[[1]]
  if (is.na(value)) return("")
  if (inherits(value, "Date")) return(format(value, "%Y-%m-%d"))
  if (inherits(value, "POSIXt")) return(format(value, "%Y-%m-%d %H:%M:%S"))
  as.character(value)
}

.procesamiento_sheet_display_df <- function(data, columns, modo = "codigos") {
  modo <- as.character(modo %||% "codigos")[1]
  out <- as.data.frame(data, stringsAsFactors = FALSE, check.names = FALSE)
  for (col_meta in columns) {
    key <- as.character(col_meta$key %||% "")
    if (!nzchar(key) || !key %in% names(out)) next
    values <- vapply(out[[key]], .procesamiento_sheet_value, character(1))
    if (identical(modo, "etiquetas")) {
      label_map <- .procesamiento_sheet_label_map_from_attr(data[[key]])
      if (length(label_map)) {
        mapped <- unname(label_map[values])
        hit <- !is.na(mapped) & nzchar(mapped)
        values[hit] <- mapped[hit]
      }
    }
    out[[key]] <- values
  }
  out
}

.procesamiento_sheet_filter_df <- function(df, search = "", column_filters = list()) {
  if (!is.data.frame(df) || !nrow(df)) return(df)
  search <- trimws(as.character(search %||% "")[1])
  keep <- rep(TRUE, nrow(df))
  if (nzchar(search)) {
    needle <- tolower(search)
    any_col <- rep(FALSE, nrow(df))
    for (col in names(df)) {
      any_col <- any_col | grepl(needle, tolower(as.character(df[[col]])), fixed = TRUE)
    }
    keep <- keep & any_col
  }
  if (is.list(column_filters) && length(column_filters)) {
    for (col in names(column_filters)) {
      if (!col %in% names(df)) next
      needle <- trimws(as.character(column_filters[[col]] %||% "")[1])
      if (!nzchar(needle)) next
      keep <- keep & grepl(tolower(needle), tolower(as.character(df[[col]])), fixed = TRUE)
    }
  }
  df[keep, , drop = FALSE]
}

.procesamiento_sheet_sort_df <- function(df, sort = NULL) {
  if (!is.data.frame(df) || !nrow(df) || !is.list(sort)) return(df)
  col <- as.character(sort$col %||% "")[1]
  if (!nzchar(col) || !col %in% names(df)) return(df)
  desc <- isTRUE(sort$desc)
  ord <- order(df[[col]], decreasing = desc, na.last = TRUE)
  df[ord, , drop = FALSE]
}

.procesamiento_sheet_rows <- function(df) {
  if (!is.data.frame(df) || !nrow(df)) return(list())
  lapply(seq_len(nrow(df)), function(i) as.list(df[i, , drop = FALSE]))
}

.procesamiento_sheet_payload <- function(data,
                                          inst,
                                          modo = "codigos",
                                          page = 1L,
                                          page_size = 50L,
                                          search = "",
                                          column_filters = list(),
                                          sort = NULL,
                                          coded = FALSE,
                                          source = "carga") {
  data <- as.data.frame(data %||% data.frame(), stringsAsFactors = FALSE, check.names = FALSE)
  columns <- .procesamiento_sheet_column_meta(data, inst %||% list(), coded = coded)
  display_df <- .procesamiento_sheet_display_df(data, columns, modo = modo)
  display_df <- .procesamiento_sheet_filter_df(display_df, search = search, column_filters = column_filters)
  display_df <- .procesamiento_sheet_sort_df(display_df, sort = sort)
  total <- nrow(display_df)
  page <- max(1L, as.integer(page %||% 1L))
  page_size <- max(10L, min(200L, as.integer(page_size %||% 50L)))
  start <- (page - 1L) * page_size + 1L
  end <- min(total, start + page_size - 1L)
  sliced <- if (total == 0L || start > total) {
    display_df[0, , drop = FALSE]
  } else {
    display_df[start:end, , drop = FALSE]
  }
  list(
    ok = TRUE,
    source = source,
    modo = modo,
    columns = columns,
    rows = .procesamiento_sheet_rows(sliced),
    total = as.integer(total),
    page = as.integer(page),
    page_size = as.integer(page_size),
    n_columns = as.integer(length(columns)),
    coded = isTRUE(coded)
  )
}
