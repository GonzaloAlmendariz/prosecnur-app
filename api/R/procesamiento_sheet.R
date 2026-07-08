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
  col <- .procesamiento_sheet_scalar(col, "")
  if (!nzchar(col)) return(NULL)

  recod_dot <- regmatches(col, regexec("^(.+)_recod\\.([^./]+)$", col, perl = TRUE))[[1]]
  if (length(recod_dot) >= 3L) {
    parent <- recod_dot[2]
    code <- recod_dot[3]
    meta <- survey_meta[[parent]] %||% list(name = parent, label = parent, type = "", type_base = "")
    return(c(meta, list(dummy_parent = parent, dummy_code = code, dummy_recoded = TRUE)))
  }

  dot_dummy <- regmatches(col, regexec("^(.+)\\.([^./]+)$", col, perl = TRUE))[[1]]
  if (length(dot_dummy) >= 3L) {
    parent <- dot_dummy[2]
    code <- dot_dummy[3]
    meta <- survey_meta[[parent]] %||% NULL
    if (!is.null(meta) && identical(meta$type_base, "select_multiple")) {
      return(c(meta, list(dummy_parent = parent, dummy_code = code)))
    }
  }

  if (grepl("/", col, fixed = TRUE)) {
    parent <- sub("/.*$", "", col)
    code <- sub("^.*/", "", col)
    code_clean <- sub("_recod$", "", code, ignore.case = TRUE, perl = TRUE)
    candidates <- unique(c(
      parent,
      sub("(_recod|_sm|_filtro|_aux|_tmp)$", "", parent)
    ))
    for (candidate in candidates) {
      meta <- survey_meta[[candidate]] %||% NULL
      if (is.null(meta) || !identical(meta$type_base, "select_multiple")) next
      return(c(meta, list(
        dummy_parent = candidate,
        dummy_code = code_clean,
        dummy_recoded = grepl("_recod$", code, ignore.case = TRUE, perl = TRUE)
      )))
    }
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

# Mapas código->etiqueta por lista, tomados de la hoja `choices` del instrumento.
# Necesario porque la data de Kobo/promoción no siempre trae attr(,"labels"), y sin
# esto tanto el modo "Etiquetas" como las categorías del filtro mostrarían códigos.
.procesamiento_sheet_inst_choice_maps <- function(inst) {
  choices <- inst$choices %||% NULL
  if (is.null(choices) || !is.data.frame(choices) || !nrow(choices)) {
    return(list())
  }
  ln_col <- intersect(c("list_name", "list name", "listname"), names(choices))[1]
  nm_col <- intersect(c("name", "value"), names(choices))[1]
  lb_col <- grep("^label", names(choices), value = TRUE, ignore.case = TRUE)[1]
  if (is.na(ln_col) || is.na(nm_col) || is.na(lb_col)) return(list())
  lists <- as.character(choices[[ln_col]])
  out <- list()
  for (ln in unique(lists)) {
    if (is.na(ln) || !nzchar(ln)) next
    sub <- choices[lists == ln, , drop = FALSE]
    codes <- as.character(sub[[nm_col]])
    labs <- as.character(sub[[lb_col]])
    keep <- !is.na(codes) & nzchar(codes)
    out[[ln]] <- stats::setNames(labs[keep], codes[keep])
  }
  out
}

# Mapa código->etiqueta efectivo de una columna: attr(,"labels") primero (data),
# luego las choices del instrumento por su list_name (rellena lo que falte).
.procesamiento_sheet_col_label_map <- function(col_data, list_name = "", inst_maps = list()) {
  attr_map <- .procesamiento_sheet_label_map_from_attr(col_data)
  inst_map <- if (nzchar(list_name %||% "")) inst_maps[[list_name]] %||% NULL else NULL
  if (length(attr_map) && length(inst_map)) {
    miss <- setdiff(names(inst_map), names(attr_map))
    return(c(attr_map, inst_map[miss]))
  }
  if (length(attr_map)) return(attr_map)
  if (!is.null(inst_map) && length(inst_map)) return(inst_map)
  stats::setNames(character(0), character(0))
}

# Categorías presentes en una columna select_one/select_multiple, con etiqueta y
# conteo sobre TODA la base (no solo la página). Devuelve NULL si hay demasiadas
# categorías (el frontend cae a filtro de texto).
.procesamiento_sheet_categories <- function(col_data, label_map = NULL, max_n = 200L) {
  vals <- as.character(col_data)
  vals <- vals[!is.na(vals) & nzchar(vals)]
  if (!length(vals)) return(list())
  counts <- sort(table(vals), decreasing = TRUE)
  codes <- names(counts)
  if (length(codes) > max_n) return(NULL)
  lm <- label_map %||% .procesamiento_sheet_label_map_from_attr(col_data)
  lapply(codes, function(code) {
    lab <- if (length(lm)) unname(lm[code]) else NA_character_
    if (is.null(lab) || is.na(lab) || !nzchar(lab)) lab <- code
    list(code = code, label = lab, count = as.integer(counts[[code]]))
  })
}

.procesamiento_sheet_column_meta <- function(data, inst, coded = FALSE) {
  survey_meta <- .procesamiento_sheet_survey_meta(inst)
  inst_maps <- .procesamiento_sheet_inst_choice_maps(inst)
  lapply(names(data), function(col) {
    raw_parent <- .procesamiento_sheet_raw_parent_for_recod(col)
    direct <- survey_meta[[col]] %||% NULL
    dummy <- .procesamiento_sheet_dummy_meta(col, survey_meta)
    recoded_parent <- if (!is.null(raw_parent)) survey_meta[[raw_parent]] %||% NULL else NULL
    meta <- direct %||% dummy %||% recoded_parent %||% list(name = col, label = "", type = "", type_base = "")
    label <- attr(data[[col]], "label", exact = TRUE) %||% meta$label %||% col
    label <- .procesamiento_sheet_scalar(label, col)
    type_base <- meta$type_base %||% ""
    if (!is.null(dummy)) type_base <- "dummy_select_multiple"
    kind <- .procesamiento_sheet_type_kind(type_base, col)
    is_recoded <- !is.null(raw_parent) || isTRUE(dummy$dummy_recoded %||% FALSE)
    source_type_base <- ""
    if (!is.null(dummy)) source_type_base <- dummy$type_base %||% ""
    if (!is.null(raw_parent) && !is.null(recoded_parent)) {
      source_type_base <- recoded_parent$type_base %||% source_type_base
    }
    source_type_kind <- if (nzchar(source_type_base)) {
      .procesamiento_sheet_type_kind(source_type_base, raw_parent %||% "")
    } else {
      ""
    }
    # Filtros inteligentes: categorías para única/múltiple, rango para numéricas.
    list_name <- .procesamiento_sheet_scalar(meta$list_name %||% "", "")
    col_label_map <- .procesamiento_sheet_col_label_map(data[[col]], list_name, inst_maps)
    categories <- if (kind %in% c("so", "sm")) {
      .procesamiento_sheet_categories(data[[col]], label_map = col_label_map)
    } else NULL
    value_min <- NULL
    value_max <- NULL
    if (identical(kind, "integer")) {
      x <- suppressWarnings(as.numeric(as.character(data[[col]])))
      if (any(!is.na(x))) {
        value_min <- as.numeric(min(x, na.rm = TRUE))
        value_max <- as.numeric(max(x, na.rm = TRUE))
      }
    }
    list(
      key = col,
      label = label,
      type = meta$type %||% type_base,
      type_base = type_base,
      type_kind = kind,
      source_type_base = source_type_base,
      source_type_kind = source_type_kind,
      coded = is_recoded && kind %in% c("integer", "sm", "so", "text"),
      is_recoded = is_recoded,
      raw_parent = raw_parent %||% "",
      dummy_parent = dummy$dummy_parent %||% NULL,
      dummy_code = dummy$dummy_code %||% NULL,
      list_name = list_name,
      categories = categories,
      value_min = value_min,
      value_max = value_max,
      .label_map = col_label_map
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
      label_map <- col_meta$.label_map %||% .procesamiento_sheet_label_map_from_attr(data[[key]])
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

# Filtra `display` (valores en modo códigos/etiquetas). Los filtros por columna
# aceptan dos formas: (a) string → substring sobre el valor mostrado (retrocompat);
# (b) objeto estructurado {op}: "in" (set de categorías, sobre el código crudo),
# "range" (min/max numérico, sobre el crudo), "contains" (substring sobre lo mostrado).
# `raw` es la data cruda alineada por fila con `display` (mismo orden y nº de filas).
.procesamiento_sheet_filter_df <- function(display, raw = NULL, search = "", column_filters = list()) {
  if (!is.data.frame(display) || !nrow(display)) return(display)
  if (is.null(raw) || !is.data.frame(raw) || nrow(raw) != nrow(display)) raw <- display
  search <- trimws(as.character(search %||% "")[1])
  keep <- rep(TRUE, nrow(display))
  if (nzchar(search)) {
    needle <- tolower(search)
    any_col <- rep(FALSE, nrow(display))
    for (col in names(display)) {
      any_col <- any_col | grepl(needle, tolower(as.character(display[[col]])), fixed = TRUE)
    }
    keep <- keep & any_col
  }
  if (is.list(column_filters) && length(column_filters)) {
    for (col in names(column_filters)) {
      f <- column_filters[[col]]
      if (is.null(f)) next
      if (is.list(f) && !is.null(f$op)) {
        op <- as.character(f$op)[1]
        if (identical(op, "in")) {
          if (!col %in% names(raw)) next
          vals <- as.character(unlist(f$values %||% list(), use.names = FALSE))
          vals <- vals[!is.na(vals)]
          if (!length(vals)) next
          keep <- keep & (as.character(raw[[col]]) %in% vals)
        } else if (identical(op, "range")) {
          if (!col %in% names(raw)) next
          x <- suppressWarnings(as.numeric(as.character(raw[[col]])))
          mn <- suppressWarnings(as.numeric(f$min %||% NA))
          mx <- suppressWarnings(as.numeric(f$max %||% NA))
          if (!is.na(mn)) keep <- keep & (!is.na(x) & x >= mn)
          if (!is.na(mx)) keep <- keep & (!is.na(x) & x <= mx)
        } else if (identical(op, "contains")) {
          if (!col %in% names(display)) next
          needle <- trimws(as.character(f$value %||% "")[1])
          if (nzchar(needle)) {
            keep <- keep & grepl(tolower(needle), tolower(as.character(display[[col]])), fixed = TRUE)
          }
        }
      } else {
        if (!col %in% names(display)) next
        needle <- trimws(as.character(f %||% "")[1])
        if (!nzchar(needle)) next
        keep <- keep & grepl(tolower(needle), tolower(as.character(display[[col]])), fixed = TRUE)
      }
    }
  }
  display[keep, , drop = FALSE]
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
  display_df <- .procesamiento_sheet_filter_df(display_df, raw = data, search = search, column_filters = column_filters)
  display_df <- .procesamiento_sheet_sort_df(display_df, sort = sort)
  # `.label_map` es interno (para el modo Etiquetas); no viaja al frontend.
  columns <- lapply(columns, function(cm) { cm$.label_map <- NULL; cm })
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
