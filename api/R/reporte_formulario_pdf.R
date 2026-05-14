# Generador de formularios en PDF para papel.
#
# Este motor no intenta reproducir Enketo/ODK. Toma el XLSForm como fuente
# de estructura y lo compila a una plantilla impresa Pulso: A4, tablas con
# codigos visibles, espacios para escribir y saltos como instrucciones.

.form_pdf_chr <- function(x, default = "") {
  if (is.null(x) || !length(x)) return(default)
  out <- as.character(x[[1]] %||% default)
  if (is.na(out)) default else out
}

.form_pdf_is_yes <- function(x) {
  tolower(trimws(.form_pdf_chr(x))) %in% c("1", "yes", "true", "si", "s\u00ed", "x")
}

.form_pdf_clean_text <- function(x) {
  x <- .form_pdf_chr(x)
  x <- gsub("\u00a0", " ", x, fixed = TRUE)
  x <- gsub("\u2013|\u2014|\u2212", "-", x, perl = TRUE)
  x <- gsub("\u2018|\u2019", "'", x, perl = TRUE)
  x <- gsub("\u201c|\u201d", "\"", x, perl = TRUE)
  x <- gsub("\\*\\*([^*]+)\\*\\*", "\\1", x, perl = TRUE)
  x <- gsub("__([^_]+)__", "\\1", x, perl = TRUE)
  x <- gsub("[`*]", "", x, perl = TRUE)
  x <- gsub("\\s+", " ", x, perl = TRUE)
  trimws(x)
}

.form_pdf_df <- function(df) {
  if (is.null(df)) return(data.frame(stringsAsFactors = FALSE, check.names = FALSE))
  out <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  names(out) <- as.character(names(out))
  for (nm in names(out)) {
    out[[nm]] <- as.character(out[[nm]])
    out[[nm]][is.na(out[[nm]])] <- ""
    Encoding(out[[nm]]) <- "UTF-8"
  }
  out
}

.form_pdf_ensure_cols <- function(df, cols) {
  df <- .form_pdf_df(df)
  for (col in cols) if (!col %in% names(df)) df[[col]] <- rep("", nrow(df))
  df
}

.form_pdf_cell <- function(df, row, col, default = "") {
  if (is.null(df) || !nrow(df) || !col %in% names(df) || row < 1L || row > nrow(df)) return(default)
  .form_pdf_chr(df[[col]][row], default)
}

.form_pdf_type_base <- function(type) {
  parts <- strsplit(trimws(.form_pdf_chr(type)), "\\s+")[[1]]
  if (!length(parts) || !nzchar(parts[1])) "" else parts[1]
}

.form_pdf_type_list <- function(type) {
  parts <- strsplit(trimws(.form_pdf_chr(type)), "\\s+")[[1]]
  if (length(parts) < 2L) "" else paste(parts[-1], collapse = " ")
}

.form_pdf_question_bases <- function() {
  c(
    "select_one", "select_multiple", "text", "integer", "decimal", "date", "time", "datetime",
    "geopoint", "geotrace", "geoshape", "barcode", "image", "audio", "video", "file", "acknowledge"
  )
}

.form_pdf_skip_bases <- function() {
  c(
    "", "start", "end", "today", "deviceid", "subscriberid", "simserial",
    "phonenumber", "username", "email", "audit", "calculate", "hidden",
    "end_group", "end_repeat"
  )
}

.form_pdf_setting <- function(settings, field, default = "") {
  if (is.null(settings) || !nrow(settings) || !field %in% names(settings)) return(default)
  .form_pdf_chr(settings[[field]][1], default)
}

.form_pdf_number_from_name <- function(name, fallback) {
  raw <- .form_pdf_chr(name)
  m <- regmatches(raw, regexec("^[A-Za-z_]*0*([0-9]+)(?:[_./-].*)?$", raw, perl = TRUE))[[1]]
  if (length(m) >= 2L) return(as.character(as.integer(m[2])))
  as.character(fallback)
}

.form_pdf_first_nonempty <- function(...) {
  vals <- list(...)
  for (val in vals) {
    txt <- .form_pdf_clean_text(val)
    if (nzchar(txt)) return(txt)
  }
  ""
}

.form_pdf_strip_leading_number <- function(label, number) {
  label <- .form_pdf_clean_text(label)
  number <- .form_pdf_clean_text(number)
  if (!nzchar(label)) return(label)
  if (nzchar(number)) {
    escaped <- gsub("([][{}()+*^$|\\\\?.])", "\\\\\\1", number, perl = TRUE)
    label <- gsub(paste0("^", escaped, "\\s*[).:-]?\\s+"), "", label, perl = TRUE)
  }
  trimws(gsub("^\\s*[0-9]+\\s*[).:-]\\s+", "", label, perl = TRUE))
}

.form_pdf_paper_text <- function(text, blank = "__________") {
  text <- .form_pdf_clean_text(text)
  if (!nzchar(text)) return(text)
  gsub("\\$\\{[^}]+\\}", blank, text, perl = TRUE)
}

.form_pdf_prefix <- function(name) {
  raw <- .form_pdf_chr(name)
  m <- regmatches(raw, regexec("^([A-Za-z_]*[0-9]+)[_./-].+$", raw, perl = TRUE))[[1]]
  if (length(m) >= 2L) m[2] else ""
}

.form_pdf_options_by_list <- function(choices) {
  choices <- .form_pdf_ensure_cols(choices, c("list_name", "name", "label", "paper_skip"))
  if (!nrow(choices)) return(list())
  rows <- split(choices, choices$list_name)
  rows <- rows[nzchar(names(rows))]
  lapply(rows, function(df) {
    lapply(seq_len(nrow(df)), function(i) {
      list(
        code = .form_pdf_chr(df$name[i]),
        label = .form_pdf_paper_text(df$label[i]),
        paper_skip = .form_pdf_clean_text(df$paper_skip[i])
      )
    })
  })
}

.form_pdf_parse_simple_relevant <- function(expr) {
  raw <- trimws(.form_pdf_chr(expr))
  if (!nzchar(raw)) return(NULL)

  m <- regmatches(raw, regexec("^selected\\(\\s*\\$\\{([^}]+)\\}\\s*,\\s*['\"]?([^'\")]+)['\"]?\\s*\\)$", raw, perl = TRUE))[[1]]
  if (length(m) >= 3L) {
    return(list(var = trimws(m[2]), value = trimws(m[3]), positive = TRUE, raw = raw))
  }

  m <- regmatches(raw, regexec("^\\$\\{([^}]+)\\}\\s*=\\s*['\"]?([^'\"]+)['\"]?$", raw, perl = TRUE))[[1]]
  if (length(m) >= 3L) {
    return(list(var = trimws(m[2]), value = trimws(m[3]), positive = TRUE, raw = raw))
  }

  m <- regmatches(raw, regexec("^\\$\\{([^}]+)\\}\\s*!=\\s*['\"]?([^'\"]+)['\"]?$", raw, perl = TRUE))[[1]]
  if (length(m) >= 3L) {
    return(list(var = trimws(m[2]), value = trimws(m[3]), positive = FALSE, raw = raw))
  }

  NULL
}

.form_pdf_display_numbers <- function(survey) {
  n <- nrow(survey)
  out <- rep("", n)
  last_num <- 0L
  for (i in seq_len(n)) {
    base <- .form_pdf_type_base(survey$type[i])
    explicit <- .form_pdf_clean_text(survey$paper_number[i])
    if (nzchar(explicit)) {
      out[i] <- explicit
      numeric_explicit <- suppressWarnings(as.integer(explicit))
      if (!is.na(numeric_explicit)) last_num <- max(last_num, numeric_explicit)
      next
    }
    if (!base %in% .form_pdf_question_bases()) next
    candidate <- suppressWarnings(as.integer(.form_pdf_number_from_name(survey$name[i], NA_integer_)))
    next_num <- if (!is.na(candidate) && candidate > last_num) candidate else last_num + 1L
    out[i] <- as.character(next_num)
    last_num <- next_num
  }
  out
}

.form_pdf_next_number_after <- function(survey, numbers, start_idx) {
  if (start_idx >= nrow(survey)) return("FIN")
  for (j in seq.int(start_idx + 1L, nrow(survey))) {
    if (nzchar(numbers[j])) return(numbers[j])
  }
  "FIN"
}

.form_pdf_infer_choice_skips <- function(survey, choices_by_list, numbers) {
  warnings <- character(0)
  skips <- list()
  name_to_row <- stats::setNames(seq_len(nrow(survey)), survey$name)
  manual_sources <- survey$name[nzchar(survey$paper_skip)]

  add_skip <- function(source, code, instruction) {
    if (!nzchar(source) || !nzchar(code) || source %in% manual_sources) return()
    current <- skips[[source]] %||% list()
    if (is.null(current[[code]]) || !nzchar(current[[code]])) {
      current[[code]] <- instruction
      skips[[source]] <<- current
    }
  }

  i <- 1L
  while (i <= nrow(survey)) {
    rel <- .form_pdf_clean_text(survey$relevant[i])
    if (!nzchar(rel)) {
      i <- i + 1L
      next
    }
    parsed <- .form_pdf_parse_simple_relevant(rel)
    if (is.null(parsed)) {
      warnings <- c(warnings, sprintf(
        "No se pudo inferir salto impreso para `%s`: relevant complejo.",
        .form_pdf_cell(survey, i, "name", sprintf("fila %d", i))
      ))
      i <- i + 1L
      next
    }

    source_row <- unname(name_to_row[parsed$var])
    if (!length(source_row) || is.na(source_row)) {
      warnings <- c(warnings, sprintf(
        "No se pudo inferir salto impreso para `%s`: variable origen `%s` no existe.",
        .form_pdf_cell(survey, i, "name", sprintf("fila %d", i)),
        parsed$var
      ))
      i <- i + 1L
      next
    }

    run_end <- i
    while (run_end + 1L <= nrow(survey) && identical(.form_pdf_clean_text(survey$relevant[run_end + 1L]), rel)) {
      run_end <- run_end + 1L
    }
    destination <- .form_pdf_next_number_after(survey, numbers, run_end)
    instruction <- if (identical(destination, "FIN")) "IR AL FINAL" else sprintf("IR A LA PREGUNTA %s", destination)

    list_name <- .form_pdf_type_list(survey$type[source_row])
    opts <- choices_by_list[[list_name]] %||% list()
    if (!length(opts)) {
      warnings <- c(warnings, sprintf(
        "No se pudo inferir salto impreso desde `%s`: no hay opciones en `%s`.",
        parsed$var,
        list_name
      ))
      i <- run_end + 1L
      next
    }

    for (opt in opts) {
      code <- opt$code
      should_show <- if (isTRUE(parsed$positive)) identical(code, parsed$value) else !identical(code, parsed$value)
      if (!should_show) add_skip(parsed$var, code, instruction)
    }
    i <- run_end + 1L
  }

  list(skips = skips, warnings = unique(warnings))
}

.form_pdf_matrix_keys <- function(survey) {
  n <- nrow(survey)
  keys <- rep("", n)
  explicit <- survey$paper_group
  keys[nzchar(explicit)] <- paste0("manual:", explicit[nzchar(explicit)])

  i <- 1L
  while (i <= n) {
    if (nzchar(keys[i])) {
      i <- i + 1L
      next
    }
    base <- .form_pdf_type_base(survey$type[i])
    list_name <- .form_pdf_type_list(survey$type[i])
    prefix <- .form_pdf_prefix(survey$name[i])
    if (!(base %in% c("select_one", "select_multiple")) || !nzchar(list_name) || !nzchar(prefix)) {
      i <- i + 1L
      next
    }
    j <- i
    while (
      j <= n &&
        !nzchar(keys[j]) &&
        identical(.form_pdf_type_base(survey$type[j]), base) &&
        identical(.form_pdf_type_list(survey$type[j]), list_name) &&
        identical(.form_pdf_prefix(survey$name[j]), prefix)
    ) {
      j <- j + 1L
    }
    if ((j - i) >= 3L) keys[i:(j - 1L)] <- paste0("auto:", prefix, ":", list_name)
    i <- max(j, i + 1L)
  }
  keys
}

formulario_pdf_build_model <- function(survey, choices, settings = NULL, paper = NULL, options = list()) {
  survey <- .form_pdf_ensure_cols(
    survey,
    c("type", "name", "label", "hint", "relevant", "appearance",
      "paper_number", "paper_label", "paper_layout", "paper_group",
      "paper_only", "paper_skip")
  )
  choices <- .form_pdf_ensure_cols(choices, c("list_name", "name", "label", "paper_skip"))
  settings <- .form_pdf_ensure_cols(settings, c("form_title", "form_id", "default_language"))
  paper <- .form_pdf_ensure_cols(paper, c("id", "kind", "position", "title", "body", "layout"))

  title <- .form_pdf_clean_text(options$title %||% "")
  if (!nzchar(title)) title <- .form_pdf_setting(settings, "form_title", "Formulario")
  if (!nzchar(title)) title <- "Formulario"
  footer_title <- .form_pdf_clean_text(options$footer_title %||% title)
  max_options_per_question <- suppressWarnings(as.integer(options$max_options_per_question %||% 18L))
  if (is.na(max_options_per_question) || max_options_per_question < 4L) max_options_per_question <- 18L

  choices_by_list <- .form_pdf_options_by_list(choices)
  numbers <- .form_pdf_display_numbers(survey)
  inferred <- .form_pdf_infer_choice_skips(survey, choices_by_list, numbers)
  matrix_keys <- .form_pdf_matrix_keys(survey)
  warnings <- inferred$warnings

  blocks <- list()
  add_block <- function(block) {
    blocks[[length(blocks) + 1L]] <<- block
  }

  if (nrow(paper)) {
    pos <- suppressWarnings(as.numeric(paper$position))
    pos[is.na(pos)] <- seq_along(pos)[is.na(pos)]
    paper <- paper[order(pos), , drop = FALSE]
    for (i in seq_len(nrow(paper))) {
      kind <- .form_pdf_clean_text(paper$kind[i])
      add_block(list(
        kind = "paper",
        paper_kind = if (nzchar(kind)) kind else "note",
        title = .form_pdf_paper_text(paper$title[i]),
        body = .form_pdf_paper_text(paper$body[i]),
        layout = .form_pdf_clean_text(paper$layout[i]),
        full_width = TRUE
      ))
    }
  } else {
    add_block(list(
      kind = "paper",
      paper_kind = "intro",
      title = "INSTRUCCIONES",
      body = "Use este cuestionario en papel siguiendo los saltos impresos. Registre codigos y marcas de forma legible.",
      layout = "intro",
      full_width = TRUE
    ))
  }

  i <- 1L
  while (i <= nrow(survey)) {
    base <- .form_pdf_type_base(survey$type[i])
    if (base %in% .form_pdf_skip_bases()) {
      i <- i + 1L
      next
    }

    key <- matrix_keys[i]
    if (nzchar(key)) {
      idx <- i
      while (idx[length(idx)] + 1L <= nrow(survey) && identical(matrix_keys[idx[length(idx)] + 1L], key)) {
        idx <- c(idx, idx[length(idx)] + 1L)
      }
      list_name <- .form_pdf_type_list(survey$type[i])
      add_block(list(
        kind = "matrix",
        number = numbers[i],
        name = .form_pdf_chr(survey$name[i]),
        title = .form_pdf_paper_text(.form_pdf_strip_leading_number(
          .form_pdf_first_nonempty(survey$paper_label[i], survey$label[i]),
          numbers[i]
        )),
        hint = .form_pdf_paper_text(survey$hint[i]),
        items = lapply(idx, function(r) list(
          number = numbers[r],
          name = .form_pdf_chr(survey$name[r]),
          label = .form_pdf_paper_text(.form_pdf_strip_leading_number(
            .form_pdf_first_nonempty(survey$paper_label[r], survey$label[r]),
            numbers[r]
          ))
        )),
        options = choices_by_list[[list_name]] %||% list(),
        skip = .form_pdf_clean_text(survey$paper_skip[i]),
        layout = .form_pdf_clean_text(survey$paper_layout[i]),
        full_width = TRUE
      ))
      i <- idx[length(idx)] + 1L
      next
    }

    if (base %in% c("begin_group", "begin_repeat")) {
      add_block(list(
        kind = "section",
        number = numbers[i],
        name = .form_pdf_chr(survey$name[i]),
        title = .form_pdf_paper_text(.form_pdf_strip_leading_number(
          .form_pdf_first_nonempty(survey$paper_label[i], survey$label[i]),
          numbers[i]
        )),
        hint = .form_pdf_paper_text(survey$hint[i]),
        skip = .form_pdf_clean_text(survey$paper_skip[i]),
        full_width = TRUE
      ))
      i <- i + 1L
      next
    }

    list_name <- .form_pdf_type_list(survey$type[i])
    source_skips <- inferred$skips[[.form_pdf_chr(survey$name[i])]] %||% list()
    opts <- choices_by_list[[list_name]] %||% list()
    if (length(opts)) {
      opts <- lapply(opts, function(opt) {
        manual <- .form_pdf_clean_text(opt$paper_skip)
        inferred_skip <- .form_pdf_clean_text(source_skips[[opt$code]] %||% "")
        opt$paper_skip <- if (nzchar(manual)) manual else inferred_skip
        opt
      })
    }
    label <- .form_pdf_first_nonempty(survey$paper_label[i], survey$label[i])
    label <- .form_pdf_strip_leading_number(label, numbers[i])
    label <- .form_pdf_paper_text(label)
    hint <- .form_pdf_paper_text(survey$hint[i])
    layout <- .form_pdf_clean_text(survey$paper_layout[i])
    force_all_choices <- layout %in% c("choices", "all_choices", "full_choices")
    coded_list <- base %in% c("select_one", "select_multiple") &&
      length(opts) > max_options_per_question &&
      !force_all_choices
    if (coded_list) {
      warnings <- c(warnings, sprintf(
        "La pregunta `%s` tiene %d opciones; se imprime como campo codificado. Use `paper_layout = 'all_choices'` para forzar la lista completa.",
        .form_pdf_chr(survey$name[i]),
        length(opts)
      ))
      opts <- list()
    }
    option_lines <- if (length(opts)) {
      sum(vapply(opts, function(opt) {
        max(1L, length(.form_pdf_wrap(paste(opt$label, opt$paper_skip), 44L)))
      }, numeric(1)))
    } else 0
    full <- (base == "note" && nchar(label) > 90) ||
      layout %in% c("full", "wide") ||
      nchar(label) > 230 ||
      length(opts) > 10L ||
      option_lines > 14L
    add_block(list(
      kind = "question",
      type = base,
      number = numbers[i],
      name = .form_pdf_chr(survey$name[i]),
      label = label,
      hint = hint,
      options = opts,
      skip = .form_pdf_clean_text(survey$paper_skip[i]),
      layout = layout,
      coded_list = coded_list,
      full_width = full
    ))
    i <- i + 1L
  }

  list(
    title = title,
    footer_title = footer_title,
    blocks = blocks,
    warnings = unique(warnings),
    summary = list(
      n_blocks = as.integer(length(blocks)),
      n_questions = as.integer(sum(vapply(blocks, function(b) b$kind %in% c("question", "matrix"), logical(1)))),
      n_sections = as.integer(sum(vapply(blocks, function(b) identical(b$kind, "section"), logical(1)))),
      n_matrices = as.integer(sum(vapply(blocks, function(b) identical(b$kind, "matrix"), logical(1))))
    )
  )
}

.form_pdf_wrap <- function(text, chars) {
  text <- .form_pdf_clean_text(text)
  if (!nzchar(text)) return(character(0))
  unlist(strwrap(text, width = max(12L, as.integer(chars)), simplify = FALSE), use.names = FALSE)
}

.form_pdf_lines_height <- function(lines, line_h = 0.015, min_h = 0) {
  max(min_h, length(lines) * line_h)
}

.form_pdf_block_height <- function(block, width) {
  chars <- if (isTRUE(block$full_width)) 118L else 56L
  if (identical(block$kind, "section")) return(0.052 + .form_pdf_lines_height(.form_pdf_wrap(block$title, chars), 0.014))
  if (identical(block$kind, "paper")) {
    return(0.042 + .form_pdf_lines_height(.form_pdf_wrap(block$title, 118), 0.014) +
             .form_pdf_lines_height(.form_pdf_wrap(block$body, 126), 0.012))
  }
  if (identical(block$kind, "matrix")) {
    rows <- length(block$items %||% list())
    return(0.075 + rows * 0.023 + .form_pdf_lines_height(.form_pdf_wrap(block$title, 118), 0.014))
  }
  label_h <- .form_pdf_lines_height(.form_pdf_wrap(block$label, chars), 0.014, 0.02)
  hint_h <- .form_pdf_lines_height(.form_pdf_wrap(block$hint, chars), 0.011)
  opt_count <- length(block$options %||% list())
  options_h <- if (opt_count) {
    sum(vapply(block$options, function(opt) {
      line_count <- max(1L, length(.form_pdf_wrap(paste(opt$label, opt$paper_skip), if (isTRUE(block$full_width)) 95L else 44L)))
      max(0.021, line_count * 0.013 + 0.008)
    }, numeric(1)))
  } else if (isTRUE(block$coded_list)) {
    0.044
  } else if ((block$type %||% "") %in% c("text", "integer", "decimal", "date", "time", "datetime")) {
    0.04
  } else {
    0.02
  }
  skip_h <- .form_pdf_lines_height(.form_pdf_wrap(block$skip, chars), 0.012)
  0.024 + label_h + hint_h + options_h + skip_h
}

.form_pdf_rect <- function(x, y, w, h, fill = NA, col = "black", lwd = 0.6) {
  grid::grid.rect(
    x = grid::unit(x + w / 2, "npc"),
    y = grid::unit(y - h / 2, "npc"),
    width = grid::unit(w, "npc"),
    height = grid::unit(h, "npc"),
    gp = grid::gpar(fill = fill, col = col, lwd = lwd)
  )
}

.form_pdf_text <- function(text, x, y, w, chars = NULL, fontsize = 8.4,
                           fontface = "plain", align = "left", col = "black",
                           line_h = 0.014) {
  if (is.null(chars)) chars <- max(12L, floor(w * 130))
  lines <- .form_pdf_wrap(text, chars)
  if (!length(lines)) return(y)
  just <- switch(align, center = c("center", "top"), right = c("right", "top"), c("left", "top"))
  tx <- switch(align, center = x + w / 2, right = x + w, x)
  grid::grid.text(
    paste(lines, collapse = "\n"),
    x = grid::unit(tx, "npc"),
    y = grid::unit(y, "npc"),
    just = just,
    gp = grid::gpar(fontsize = fontsize, fontface = fontface, col = col, lineheight = 1.05)
  )
  y - length(lines) * line_h
}

.form_pdf_header <- function(model, page_no) {
  # Logo textual liviano, para no depender de assets externos en el renderer.
  grid::grid.circle(
    x = grid::unit(0.065, "npc"), y = grid::unit(0.958, "npc"),
    r = grid::unit(0.018, "npc"),
    gp = grid::gpar(fill = "#0b2a5b", col = "#0b2a5b")
  )
  grid::grid.text("PULSO\nPUCP", x = grid::unit(0.092, "npc"), y = grid::unit(0.963, "npc"),
                  just = c("left", "center"),
                  gp = grid::gpar(fontsize = 9, fontface = "bold", col = "#0b2a5b", lineheight = 0.9))
  .form_pdf_text(toupper(model$title), 0.18, 0.966, 0.55, chars = 76, fontsize = 8.5,
                 fontface = "bold", align = "center", line_h = 0.012)
  grid::grid.text("Nro. de cuestionario", x = grid::unit(0.78, "npc"), y = grid::unit(0.954, "npc"),
                  gp = grid::gpar(fontsize = 7.5))
  for (i in 0:3) .form_pdf_rect(0.83 + i * 0.026, 0.975, 0.026, 0.031, fill = "white")
  invisible(page_no)
}

.form_pdf_footer <- function(model, page_no) {
  grid::grid.text(as.character(page_no), x = grid::unit(0.052, "npc"), y = grid::unit(0.034, "npc"),
                  gp = grid::gpar(fontsize = 8))
  .form_pdf_text(toupper(model$footer_title), 0.13, 0.039, 0.74, chars = 118,
                 fontsize = 6.2, align = "center", line_h = 0.008)
}

.form_pdf_draw_paper <- function(block, x, y, w) {
  if (nzchar(block$title %||% "")) {
    .form_pdf_rect(x, y, w, 0.02, fill = "black", col = "black", lwd = 0)
    y <- y - 0.028
    y <- .form_pdf_text(toupper(block$title), x + 0.006, y, w - 0.012, chars = 120,
                        fontsize = 8.8, fontface = "bold", line_h = 0.014)
  }
  if (nzchar(block$body %||% "")) {
    y <- y - 0.006
    y <- .form_pdf_text(block$body, x + 0.006, y, w - 0.012, chars = 126,
                        fontsize = 8.1, line_h = 0.012)
  }
  y - 0.012
}

.form_pdf_draw_section <- function(block, x, y, w) {
  .form_pdf_rect(x, y, w, 0.02, fill = "black", col = "black", lwd = 0)
  y <- y - 0.035
  label <- if (nzchar(block$number %||% "")) paste0(block$number, ". ", block$title) else block$title
  y <- .form_pdf_text(toupper(label), x + 0.006, y, w - 0.012, chars = 112,
                      fontsize = 8.7, fontface = "bold", line_h = 0.014)
  if (nzchar(block$hint %||% "")) {
    y <- .form_pdf_text(block$hint, x + 0.006, y - 0.004, w - 0.012, chars = 112,
                        fontsize = 7.5, fontface = "italic", line_h = 0.012)
  }
  y - 0.008
}

.form_pdf_draw_options <- function(options, x, y, w, multiple = FALSE) {
  if (!length(options)) return(y)
  code_visible <- vapply(options, function(opt) {
    code <- .form_pdf_clean_text(opt$code %||% "")
    label <- .form_pdf_clean_text(opt$label %||% "")
    nzchar(code) &&
      !identical(tolower(code), tolower(label)) &&
      nchar(code, type = "width") <= 8L &&
      !grepl("\\s", code)
  }, logical(1))
  show_code <- any(code_visible)
  max_code_chars <- max(1L, max(nchar(vapply(options, function(opt) .form_pdf_clean_text(opt$code %||% ""), character(1)), type = "width")))
  code_w <- if (show_code) min(0.072, max(0.04, max_code_chars * 0.011)) else 0
  mark_w <- if (multiple || !show_code) 0.028 else 0
  for (idx in seq_along(options)) {
    opt <- options[[idx]]
    text <- opt$label
    if (nzchar(opt$paper_skip %||% "")) text <- paste0(text, " -> ", opt$paper_skip)
    lines <- .form_pdf_wrap(text, floor((w - code_w - mark_w - 0.018) * 125))
    h <- max(0.022, length(lines) * 0.013 + 0.008)
    .form_pdf_rect(x, y, w, h, fill = "white")
    xx <- x
    if (mark_w > 0) {
      .form_pdf_rect(xx, y, mark_w, h, fill = "white")
      if (multiple) {
        .form_pdf_rect(xx + 0.008, y - 0.007, 0.011, 0.011, fill = "white")
      }
      xx <- xx + mark_w
    }
    if (show_code) {
      .form_pdf_rect(xx, y, code_w, h, fill = "white")
      if (isTRUE(code_visible[[idx]])) {
        grid::grid.text(opt$code, x = grid::unit(xx + code_w / 2, "npc"), y = grid::unit(y - h / 2, "npc"),
                        gp = grid::gpar(fontsize = 7.7))
      }
    }
    .form_pdf_text(text, xx + code_w + 0.006, y - 0.006, w - code_w - mark_w - 0.012,
                   chars = floor((w - code_w - mark_w) * 125), fontsize = 7.8, line_h = 0.012)
    y <- y - h
  }
  y
}

.form_pdf_draw_question <- function(block, x, y, w) {
  prefix <- if (nzchar(block$number %||% "")) paste0(block$number, ". ") else ""
  y <- .form_pdf_text(paste0(prefix, block$label), x + 0.006, y, w - 0.012,
                      chars = if (isTRUE(block$full_width)) 118 else 54,
                      fontsize = 8.3, fontface = "bold", line_h = 0.014)
  if (nzchar(block$hint %||% "")) {
    y <- .form_pdf_text(block$hint, x + 0.006, y - 0.002, w - 0.012,
                        chars = if (isTRUE(block$full_width)) 118 else 54,
                        fontsize = 7.3, fontface = "italic", line_h = 0.011)
  }
  y <- y - 0.006
  if (isTRUE(block$coded_list)) {
    .form_pdf_rect(x + 0.006, y, w - 0.012, 0.034, fill = "white")
    .form_pdf_text("Codigo / respuesta:", x + 0.012, y - 0.008, w - 0.024,
                   chars = if (isTRUE(block$full_width)) 112 else 48,
                   fontsize = 7.5, fontface = "italic", line_h = 0.011)
    y <- y - 0.034
  } else if ((block$type %||% "") %in% c("select_one", "select_multiple")) {
    y <- .form_pdf_draw_options(block$options, x + 0.006, y, w - 0.012, multiple = identical(block$type, "select_multiple"))
  } else if ((block$type %||% "") %in% c("text", "integer", "decimal", "date", "time", "datetime")) {
    h <- if (identical(block$type, "text")) 0.035 else 0.026
    .form_pdf_rect(x + 0.006, y, w - 0.012, h, fill = "white")
    y <- y - h
  } else if (identical(block$type, "note")) {
    # Solo texto informativo.
  } else {
    .form_pdf_rect(x + 0.006, y, w - 0.012, 0.026, fill = "white")
    y <- y - 0.026
  }
  if (nzchar(block$skip %||% "")) {
    y <- .form_pdf_text(paste0("[ ] ", block$skip), x + 0.012, y - 0.004, w - 0.024,
                        chars = if (isTRUE(block$full_width)) 112 else 48,
                        fontsize = 7.7, line_h = 0.012)
  }
  y - 0.014
}

.form_pdf_draw_matrix <- function(block, x, y, w) {
  prefix <- if (nzchar(block$number %||% "")) paste0(block$number, ". ") else ""
  y <- .form_pdf_text(paste0(prefix, block$title), x + 0.006, y, w - 0.012,
                      chars = 118, fontsize = 8.2, fontface = "bold", line_h = 0.014)
  if (nzchar(block$hint %||% "")) {
    y <- .form_pdf_text(block$hint, x + 0.006, y - 0.002, w - 0.012,
                        chars = 118, fontsize = 7.2, fontface = "italic", line_h = 0.011)
  }
  y <- y - 0.006
  opts <- block$options %||% list()
  opt_n <- min(length(opts), 7L)
  code_w <- if (opt_n) rep(0.052, opt_n) else numeric(0)
  label_w <- w - 0.012 - sum(code_w)
  .form_pdf_rect(x + 0.006, y, w - 0.012, 0.024, fill = "white")
  .form_pdf_text("REGISTRE LAS RESPUESTAS", x + 0.012, y - 0.006, label_w - 0.012,
                 chars = 52, fontsize = 7.3, fontface = "bold", line_h = 0.01)
  xx <- x + 0.006 + label_w
  if (opt_n) {
    for (k in seq_len(opt_n)) {
      .form_pdf_rect(xx, y, code_w[k], 0.024, fill = "white")
      grid::grid.text(opts[[k]]$label %||% opts[[k]]$code, x = grid::unit(xx + code_w[k] / 2, "npc"),
                      y = grid::unit(y - 0.012, "npc"),
                      gp = grid::gpar(fontsize = 6.8))
      xx <- xx + code_w[k]
    }
  }
  y <- y - 0.024
  for (item in block$items %||% list()) {
    lines <- .form_pdf_wrap(item$label, 64)
    h <- max(0.022, length(lines) * 0.012 + 0.007)
    .form_pdf_rect(x + 0.006, y, label_w, h, fill = "white")
    .form_pdf_text(item$label, x + 0.012, y - 0.005, label_w - 0.012,
                   chars = 64, fontsize = 7.5, line_h = 0.011)
    xx <- x + 0.006 + label_w
    if (opt_n) {
      for (k in seq_len(opt_n)) {
        .form_pdf_rect(xx, y, code_w[k], h, fill = "white")
        grid::grid.text(opts[[k]]$code, x = grid::unit(xx + code_w[k] / 2, "npc"),
                        y = grid::unit(y - h / 2, "npc"),
                        gp = grid::gpar(fontsize = 7.2))
        xx <- xx + code_w[k]
      }
    }
    y <- y - h
  }
  if (nzchar(block$skip %||% "")) {
    y <- .form_pdf_text(paste0("[ ] ", block$skip), x + 0.012, y - 0.004, w - 0.024,
                        chars = 112, fontsize = 7.7, line_h = 0.012)
  }
  y - 0.014
}

.form_pdf_draw_block <- function(block, x, y, w) {
  switch(
    block$kind,
    paper = .form_pdf_draw_paper(block, x, y, w),
    section = .form_pdf_draw_section(block, x, y, w),
    matrix = .form_pdf_draw_matrix(block, x, y, w),
    question = .form_pdf_draw_question(block, x, y, w),
    y
  )
}

formulario_pdf_render <- function(model, output_file) {
  grDevices::pdf(output_file, paper = "a4", width = 8.27, height = 11.69, onefile = TRUE)
  on.exit(grDevices::dev.off(), add = TRUE)

  page_no <- 0L
  y_top <- 0.885
  y_bottom <- 0.072
  col_x <- c(0.058, 0.525)
  col_w <- 0.405
  full_x <- 0.058
  full_w <- 0.875
  current_col <- 1L
  y <- c(y_top, y_top)
  divider_top <- NA_real_

  flush_divider <- function(bottom_y = y_bottom) {
    if (is.na(divider_top)) return(invisible(NULL))
    if ((divider_top - bottom_y) > 0.025) {
      grid::grid.lines(
        x = grid::unit(c(0.5, 0.5), "npc"),
        y = grid::unit(c(bottom_y, divider_top), "npc"),
        gp = grid::gpar(col = "#9ca3af", lwd = 0.5)
      )
    }
    divider_top <<- NA_real_
    invisible(NULL)
  }

  new_page <- function() {
    if (page_no > 0L) flush_divider(y_bottom)
    page_no <<- page_no + 1L
    grid::grid.newpage()
    .form_pdf_header(model, page_no)
    .form_pdf_footer(model, page_no)
    current_col <<- 1L
    y <<- c(y_top, y_top)
    divider_top <<- NA_real_
  }
  new_page()

  for (block in model$blocks) {
    h <- .form_pdf_block_height(block, if (isTRUE(block$full_width)) full_w else col_w)
    if (isTRUE(block$full_width)) {
      flush_divider(min(y))
      yy <- min(y)
      if (yy - h < y_bottom) {
        new_page()
        yy <- y_top
      }
      y_next <- .form_pdf_draw_block(block, full_x, yy, full_w)
      y <- c(y_next, y_next)
      current_col <- 1L
      next
    }

    if (y[current_col] - h < y_bottom) {
      if (current_col == 1L) {
        current_col <- 2L
      } else {
        new_page()
      }
    }
    if (y[current_col] - h < y_bottom) {
      # Bloque mas alto que una columna: dibujarlo igual en pagina nueva.
      if (current_col == 2L) new_page()
    }
    if (is.na(divider_top)) divider_top <- y[current_col]
    y[current_col] <- .form_pdf_draw_block(block, col_x[current_col], y[current_col], col_w)
  }

  flush_divider(y_bottom)
  invisible(output_file)
}

reporte_formulario_pdf <- function(survey, choices, settings = NULL, paper = NULL,
                                   output_file, options = list()) {
  model <- formulario_pdf_build_model(
    survey = survey,
    choices = choices,
    settings = settings,
    paper = paper,
    options = options
  )
  formulario_pdf_render(model, output_file)
  list(
    path = output_file,
    summary = model$summary,
    warnings = model$warnings
  )
}
