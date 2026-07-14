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
  # Numeracion secuencial de nivel superior: cada pregunta y cada fila de matriz
  # toma el siguiente entero correlativo (la subnumeracion N.j que a veces trae la
  # referencia es codificacion manual del autor, no se genera automaticamente).
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
    instruction <- if (identical(destination, "FIN")) "Salto al final" else sprintf("Salto a la %s", destination)

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

# Construye `matrix_keys` a partir de una agrupacion EXPLICITA enviada por el
# frontend (`options$matrix_groups`): lista de grupos, cada uno un vector de
# `name`s que deben renderizarse como UNA matriz. Valida existencia, contiguidad
# y >=2 miembros; grupos invalidos/parciales se ignoran con warning.
.form_pdf_matrix_keys_from_groups <- function(survey, groups) {
  n <- nrow(survey)
  keys <- rep("", n)
  warnings <- character(0)
  if (is.null(groups) || !length(groups)) return(list(keys = keys, warnings = warnings))
  name_to_row <- stats::setNames(seq_len(n), survey$name)
  gi <- 0L
  for (g in groups) {
    members <- as.character(unlist(g))
    members <- members[nzchar(members)]
    if (!length(members)) next
    rows <- unname(name_to_row[members])
    if (anyNA(rows)) {
      warnings <- c(warnings, sprintf(
        "Grupo de matriz ignorado: preguntas inexistentes (%s).",
        paste(members[is.na(rows)], collapse = ", ")))
      next
    }
    rows <- sort(unique(rows))
    if (length(rows) < 2L) {
      warnings <- c(warnings, sprintf(
        "Grupo de matriz ignorado: requiere al menos 2 preguntas (%s).",
        paste(members, collapse = ", ")))
      next
    }
    if (!identical(rows, seq.int(rows[1], rows[length(rows)]))) {
      warnings <- c(warnings, sprintf(
        "Grupo de matriz ignorado: las preguntas no son contiguas (%s).",
        paste(members, collapse = ", ")))
      next
    }
    if (any(nzchar(keys[rows]))) {
      warnings <- c(warnings, sprintf(
        "Grupo de matriz ignorado: solapa con otro grupo (%s).",
        paste(members, collapse = ", ")))
      next
    }
    gi <- gi + 1L
    keys[rows] <- paste0("group:", gi)
  }
  list(keys = keys, warnings = warnings)
}

# Reescribe el verbo de salto legacy ("IR A LA PREGUNTA"/"IR AL FINAL") a la
# redaccion nueva ("Salto a la"/"Salto al final") en textos de salto manuales.
.form_pdf_rephrase_skip <- function(text) {
  t <- .form_pdf_clean_text(text)
  if (!nzchar(t)) return(t)
  t <- gsub("IR\\s+A\\s+LA\\s+PREGUNTA", "Salto a la", t, ignore.case = TRUE, perl = TRUE)
  t <- gsub("IR\\s+AL\\s+FINAL", "Salto al final", t, ignore.case = TRUE, perl = TRUE)
  t
}

# Redacta una "apertura de condición" a partir de un `relevant` simple. Resuelve
# var->numero de pregunta y value->etiqueta de la opcion. Devuelve list(text, warning).
.form_pdf_render_condition <- function(rel, nm, survey, choices_by_list, numbers, name_to_row) {
  parsed <- .form_pdf_parse_simple_relevant(rel)
  if (is.null(parsed)) {
    return(list(text = "", warning = sprintf(
      "No se pudo enunciar la condicion para `%s`: relevant complejo.", nm)))
  }
  src <- unname(name_to_row[parsed$var])
  if (!length(src) || is.na(src)) {
    return(list(text = "", warning = sprintf(
      "No se pudo enunciar la condicion para `%s`: variable origen `%s` no existe.",
      nm, parsed$var)))
  }
  qnum <- .form_pdf_clean_text(numbers[src])
  ref <- if (nzchar(qnum)) paste0("la P.", qnum) else paste0("`", parsed$var, "`")
  list_name <- .form_pdf_type_list(survey$type[src])
  opts <- choices_by_list[[list_name]] %||% list()
  lbl <- parsed$value
  for (o in opts) {
    if (identical(.form_pdf_clean_text(o$code), .form_pdf_clean_text(parsed$value))) {
      cand <- .form_pdf_clean_text(o$label %||% "")
      if (nzchar(cand)) lbl <- cand
      break
    }
  }
  verb <- if (isTRUE(parsed$positive)) "haber respondido" else "NO haber respondido"
  list(text = sprintf("En caso de %s «%s» en %s:", verb, lbl, ref), warning = "")
}

# Calcula la apertura de condicion por fila del survey (modo "condiciones"),
# deduplicando herencia de grupo y corridas del mismo relevant. Devuelve un vector
# alineado a las filas del survey (secciones y preguntas) + warnings.
.form_pdf_compute_openings <- function(survey, choices_by_list, numbers) {
  n <- nrow(survey)
  openings <- rep("", n)
  warnings <- character(0)
  name_to_row <- stats::setNames(seq_len(n), survey$name)
  stack <- character(0)     # relevants de los grupos abiertos (puede incluir "")
  prev_relevant <- ""       # para dedup de corridas de preguntas consecutivas

  inherited_set <- function() unique(stack[nzchar(stack)])
  emit <- function(rel, nm) {
    r <- .form_pdf_render_condition(rel, nm, survey, choices_by_list, numbers, name_to_row)
    if (nzchar(r$warning)) warnings <<- c(warnings, r$warning)
    r$text
  }

  for (i in seq_len(n)) {
    base <- .form_pdf_type_base(survey$type[i])
    rel <- .form_pdf_clean_text(survey$relevant[i])
    nm <- .form_pdf_cell(survey, i, "name", sprintf("fila %d", i))

    if (base %in% c("begin_group", "begin_repeat")) {
      inh <- inherited_set()
      if (nzchar(rel) && !(rel %in% inh)) openings[i] <- emit(rel, nm)
      stack <- c(stack, rel)
      prev_relevant <- ""
      next
    }
    if (base %in% c("end_group", "end_repeat")) {
      if (length(stack)) stack <- stack[-length(stack)]
      prev_relevant <- ""
      next
    }
    if (base %in% .form_pdf_skip_bases()) next

    if (!nzchar(rel)) { prev_relevant <- ""; next }
    if (rel %in% inherited_set()) { prev_relevant <- rel; next }  # heredado del grupo
    if (identical(rel, prev_relevant)) next                       # corrida: solo la 1a
    openings[i] <- emit(rel, nm)
    prev_relevant <- rel
  }

  list(openings = openings, warnings = unique(warnings))
}

.form_pdf_resolve_label_cols <- function(df, lang) {
  # Materializa `label` (y `hint` si el instrumento la trae) desde columnas
  # localizadas `label::es`, `hint::es`, etc., prefiriendo español. Sin esto los
  # XLSForms multilingües / SurveyMonkey salen con los numeros pero sin texto.
  df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  if (!nrow(df)) return(df)
  df$label <- xlsform_coalesce_label(df, lang, "label")
  if ("hint" %in% names(df) || length(grep("^hint(::|_)", names(df), ignore.case = TRUE))) {
    df$hint <- xlsform_coalesce_label(df, lang, "hint")
  }
  df
}

formulario_pdf_build_model <- function(survey, choices, settings = NULL, paper = NULL, options = list()) {
  settings <- .form_pdf_ensure_cols(settings, c("form_title", "form_id", "default_language"))
  lang <- tolower(trimws(.form_pdf_setting(settings, "default_language", "es")))
  if (!nzchar(lang)) lang <- "es"
  survey <- .form_pdf_resolve_label_cols(survey, lang)
  choices <- .form_pdf_resolve_label_cols(choices, lang)

  survey <- .form_pdf_ensure_cols(
    survey,
    c("type", "name", "label", "hint", "relevant", "appearance",
      "paper_number", "paper_label", "paper_layout", "paper_group",
      "paper_only", "paper_skip", "repeat_count")
  )
  choices <- .form_pdf_ensure_cols(choices, c("list_name", "name", "label", "paper_skip"))
  paper <- .form_pdf_ensure_cols(paper, c("id", "kind", "position", "title", "body", "layout"))

  title <- .form_pdf_clean_text(options$title %||% "")
  if (!nzchar(title)) title <- .form_pdf_setting(settings, "form_title", "Formulario")
  if (!nzchar(title)) title <- "Formulario"
  footer_title <- .form_pdf_clean_text(options$footer_title %||% title)
  max_options_per_question <- suppressWarnings(as.integer(options$max_options_per_question %||% 18L))
  if (is.na(max_options_per_question) || max_options_per_question < 4L) max_options_per_question <- 18L
  # Toggle 1 o 2 columnas al exportar (default 2 = comportamiento historico).
  columns <- suppressWarnings(as.integer(options$columns %||% 2L))
  if (is.na(columns) || !columns %in% c(1L, 2L)) columns <- 2L
  # Lenguaje de logica: "saltos" (flechas IR/Salto) o "condiciones" (aperturas).
  logic_language <- tolower(trimws(.form_pdf_chr(options$logic_language %||% "saltos")))
  if (!logic_language %in% c("saltos", "condiciones")) logic_language <- "saltos"
  condiciones <- identical(logic_language, "condiciones")
  # Recuadros "N.º de cuestionario" en el header: opcional (default TRUE).
  sqn <- options$show_questionnaire_number
  show_qnum <- if (is.null(sqn)) TRUE
    else if (is.logical(sqn)) isTRUE(sqn[[1]])
    else !(tolower(trimws(as.character(sqn)[[1]])) %in% c("false", "0", "no", "f", "n"))

  choices_by_list <- .form_pdf_options_by_list(choices)
  numbers <- .form_pdf_display_numbers(survey)
  # Agrupacion de matrices: si el frontend manda `matrix_groups` (aunque sea []),
  # se respeta EXACTAMENTE y se ignora la autodeteccion; si esta AUSENTE, autodetecta.
  group_warnings <- character(0)
  if (!is.null(options$matrix_groups)) {
    mg <- .form_pdf_matrix_keys_from_groups(survey, options$matrix_groups)
    matrix_keys <- mg$keys
    group_warnings <- mg$warnings
  } else {
    matrix_keys <- .form_pdf_matrix_keys(survey)
  }
  if (condiciones) {
    inferred <- list(skips = list(), warnings = character(0))
    opened <- .form_pdf_compute_openings(survey, choices_by_list, numbers)
    openings <- opened$openings
    warnings <- c(group_warnings, opened$warnings)
  } else {
    inferred <- .form_pdf_infer_choice_skips(survey, choices_by_list, numbers)
    openings <- rep("", nrow(survey))
    warnings <- c(group_warnings, inferred$warnings)
  }

  blocks <- list()
  add_block <- function(block) {
    blocks[[length(blocks) + 1L]] <<- block
  }

  # Portada: titulo prominente centrado en la primera pagina, sobre las
  # instrucciones (jerarquia tipo referencia Word).
  add_block(list(kind = "cover", title = title, full_width = TRUE))

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
        # Numeracion secuencial: cada fila toma su propio entero correlativo.
        items = lapply(idx, function(r) list(
          number = numbers[r],
          name = .form_pdf_chr(survey$name[r]),
          label = .form_pdf_paper_text(.form_pdf_strip_leading_number(
            .form_pdf_first_nonempty(survey$paper_label[r], survey$label[r]),
            numbers[r]
          ))
        )),
        options = choices_by_list[[list_name]] %||% list(),
        skip = if (condiciones) "" else .form_pdf_clean_text(survey$paper_skip[i]),
        opening_condition = openings[i],
        layout = .form_pdf_clean_text(survey$paper_layout[i]),
        full_width = TRUE
      ))
      i <- idx[length(idx)] + 1L
      next
    }

    if (base %in% c("begin_group", "begin_repeat")) {
      # Cardinalidad de repeat (ADR 0030, Fase 4): distinguir begin_repeat de
      # begin_group para marcar la sección como repetible (one-to-many/roster) y,
      # si el instrumento lo trae, su repeat_count.
      is_repeat <- identical(base, "begin_repeat")
      add_block(list(
        kind = "section",
        number = numbers[i],
        name = .form_pdf_chr(survey$name[i]),
        title = .form_pdf_paper_text(.form_pdf_strip_leading_number(
          .form_pdf_first_nonempty(survey$paper_label[i], survey$label[i]),
          numbers[i]
        )),
        hint = .form_pdf_paper_text(survey$hint[i]),
        skip = if (condiciones) "" else .form_pdf_rephrase_skip(survey$paper_skip[i]),
        opening_condition = openings[i],
        repeatable = is_repeat,
        repeat_count = if (is_repeat) .form_pdf_clean_text(survey$repeat_count[i]) else "",
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
        if (condiciones) {
          opt$paper_skip <- ""  # en condiciones no se mezclan lenguajes
        } else {
          manual <- .form_pdf_rephrase_skip(opt$paper_skip)
          inferred_skip <- .form_pdf_clean_text(source_skips[[opt$code]] %||% "")
          opt$paper_skip <- if (nzchar(manual)) manual else inferred_skip
        }
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
      skip = if (condiciones) "" else .form_pdf_rephrase_skip(survey$paper_skip[i]),
      opening_condition = openings[i],
      layout = layout,
      coded_list = coded_list,
      full_width = full
    ))
    i <- i + 1L
  }

  # Indice de seccion corrido (para el kicker "SECCION N").
  sec_i <- 0L
  for (bi in seq_along(blocks)) {
    if (identical(blocks[[bi]]$kind, "section")) {
      sec_i <- sec_i + 1L
      blocks[[bi]]$section_index <- sec_i
    }
  }

  # Columna unica: tratar TODOS los bloques como full_width y reutilizar la
  # maquinaria de ancho completo del render (sin divisor central ni 2a columna).
  if (columns == 1L) {
    blocks <- lapply(blocks, function(b) { b$full_width <- TRUE; b })
  }

  list(
    title = title,
    footer_title = footer_title,
    columns = columns,
    logic_language = logic_language,
    show_questionnaire_number = show_qnum,
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

.form_pdf_opening_height <- function(text, chars = 112L) {
  if (!nzchar(text %||% "")) return(0)
  .form_pdf_lines_height(.form_pdf_wrap(text, chars), 0.0118) + 0.009
}

.form_pdf_block_height <- function(block, width) {
  chars <- if (isTRUE(block$full_width)) 118L else 56L
  if (identical(block$kind, "cover")) {
    return(0.030 + .form_pdf_lines_height(.form_pdf_wrap(block$title, 46), 0.026) + 0.026)
  }
  if (identical(block$kind, "section")) {
    return(0.058 + .form_pdf_lines_height(.form_pdf_wrap(block$title, chars), 0.014) +
             .form_pdf_opening_height(block$opening_condition, chars))
  }
  if (identical(block$kind, "paper")) {
    return(0.042 + .form_pdf_lines_height(.form_pdf_wrap(block$title, 118), 0.014) +
             .form_pdf_lines_height(.form_pdf_wrap(block$body, 126), 0.012))
  }
  if (identical(block$kind, "matrix")) {
    # Mide las filas reales (etiqueta con su numero) para no subestimar la altura
    # cuando los items envuelven a varias lineas.
    label_w <- max(0.05, (width - 0.012) * 0.47)
    lbl_chars <- max(20L, floor((label_w - 0.012) * 120))
    rows_h <- sum(vapply(block$items %||% list(), function(it) {
      num <- .form_pdf_clean_text(it$number %||% "")
      lbl <- if (nzchar(num)) paste0(num, ".  ", it$label) else (it$label %||% "")
      max(0.018, length(.form_pdf_wrap(lbl, lbl_chars)) * 0.012 + 0.007)
    }, numeric(1)))
    header_h <- 0.050  # cabecera de anclas (hasta ~3 lineas) + margenes
    return(header_h + rows_h + 0.022 +
             .form_pdf_lines_height(.form_pdf_wrap(block$title, 118), 0.014) +
             .form_pdf_lines_height(.form_pdf_wrap(block$hint, 118), 0.011) +
             .form_pdf_opening_height(block$opening_condition, 112L))
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
  0.024 + label_h + hint_h + options_h + skip_h +
    .form_pdf_opening_height(block$opening_condition, chars)
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

.form_pdf_logo_path <- function() {
  cands <- c(
    system.file("hojas_ruta/assets/logo_pulso.png", package = "prosecnurapp"),
    file.path(getwd(), "api", "inst", "hojas_ruta", "assets", "logo_pulso.png"),
    file.path(getwd(), "inst", "hojas_ruta", "assets", "logo_pulso.png")
  )
  cands <- cands[nzchar(cands) & file.exists(cands)]
  if (length(cands)) cands[[1]] else NA_character_
}

.form_pdf_draw_logo <- function(x, y, width_npc = 0.115) {
  path <- .form_pdf_logo_path()
  if (!is.na(path) && requireNamespace("png", quietly = TRUE)) {
    img <- tryCatch(png::readPNG(path), error = function(e) NULL)
    if (!is.null(img)) {
      img_h <- dim(img)[1]; img_w <- dim(img)[2]
      h_npc <- width_npc * (img_h / img_w) * (8.27 / 11.69)
      grid::grid.raster(img, x = grid::unit(x, "npc"), y = grid::unit(y, "npc"),
                        just = c("left", "center"), interpolate = TRUE,
                        width = grid::unit(width_npc, "npc"),
                        height = grid::unit(h_npc, "npc"))
      return(invisible(TRUE))
    }
  }
  grid::grid.text("PULSO PUCP", x = grid::unit(x, "npc"), y = grid::unit(y, "npc"),
                  just = c("left", "center"),
                  gp = grid::gpar(fontsize = 8.5, fontface = "bold", col = pulso_pdf_tokens()$navy))
  invisible(FALSE)
}

.form_pdf_header <- function(model, page_no) {
  tk <- pulso_pdf_tokens()
  .form_pdf_draw_logo(0.052, 0.962, width_npc = 0.115)
  .form_pdf_text(toupper(model$title), 0.190, 0.976, 0.480, chars = 62, fontsize = 8.4,
                 fontface = "bold", col = tk$navy, line_h = 0.012)
  if (!identical(model$show_questionnaire_number, FALSE)) {
    grid::grid.text("N.º de cuestionario", x = grid::unit(0.878, "npc"), y = grid::unit(0.938, "npc"),
                    just = c("center", "center"), gp = grid::gpar(fontsize = 6.6, col = tk$soft))
    for (i in 0:3) .form_pdf_rect(0.826 + i * 0.026, 0.982, 0.026, 0.031, fill = "white", col = tk$ink, lwd = 0.7)
  }
  grid::grid.lines(x = grid::unit(c(0.052, 0.930), "npc"), y = grid::unit(0.922, "npc"),
                   gp = grid::gpar(col = tk$navy, lwd = 1.1))
  invisible(page_no)
}

.form_pdf_footer <- function(model, page_no) {
  tk <- pulso_pdf_tokens()
  grid::grid.lines(x = grid::unit(c(0.052, 0.930), "npc"), y = grid::unit(0.056, "npc"),
                   gp = grid::gpar(col = tk$line, lwd = 0.7))
  grid::grid.text(as.character(page_no), x = grid::unit(0.052, "npc"), y = grid::unit(0.034, "npc"),
                  just = c("left", "center"), gp = grid::gpar(fontsize = 8, col = tk$soft))
  .form_pdf_text(toupper(model$footer_title), 0.16, 0.039, 0.58, chars = 105,
                 fontsize = 6.2, align = "center", col = tk$soft, line_h = 0.008)
  grid::grid.text("PULSO PUCP", x = grid::unit(0.930, "npc"), y = grid::unit(0.034, "npc"),
                  just = c("right", "center"),
                  gp = grid::gpar(fontsize = 6.6, fontface = "bold", col = tk$navy))
}

.form_pdf_band <- function(title, x, y, w, chars, kicker = "") {
  # Banda navy fina con un filo de acento a la izquierda; titulo en blanco.
  tk <- pulso_pdf_tokens()
  lines <- .form_pdf_wrap(toupper(title), chars)
  if (!length(lines)) return(y)
  if (nzchar(kicker)) {
    grid::grid.text(toupper(kicker), x = grid::unit(x + 0.002, "npc"),
                    y = grid::unit(y - 0.006, "npc"), just = c("left", "center"),
                    gp = grid::gpar(fontsize = 6.2, fontface = "bold", col = tk$soft))
    y <- y - 0.013
  }
  band_h <- length(lines) * 0.0138 + 0.011
  .form_pdf_rect(x, y, w, band_h, fill = tk$navy, col = NA, lwd = 0)
  # filo de acento (mismo navy mas claro simulado con hairline blanca fina)
  .form_pdf_text(paste(lines, collapse = " "), x + 0.010, y - 0.0088, w - 0.018,
                 chars = chars, fontsize = 8.5, fontface = "bold", col = "white", line_h = 0.0138)
  y - band_h
}

.form_pdf_draw_opening <- function(text, x, y, w, chars_factor = 112) {
  if (!nzchar(text %||% "")) return(y)
  tk <- pulso_pdf_tokens()
  cw <- max(24L, floor((w - 0.020) * chars_factor))
  lines <- .form_pdf_wrap(text, cw)
  if (!length(lines)) return(y)
  h <- length(lines) * 0.0118 + 0.005
  grid::grid.rect(x = grid::unit(x + 0.008, "npc"),
                  y = grid::unit(y - h / 2 + 0.001, "npc"),
                  width = grid::unit(0.0018, "npc"),
                  height = grid::unit(max(0.006, h - 0.003), "npc"),
                  gp = grid::gpar(fill = tk$navy, col = NA))
  yy <- .form_pdf_text(paste(lines, collapse = "\n"), x + 0.015, y - 0.001, w - 0.021,
                       chars = cw, fontsize = 7.3, fontface = "italic",
                       col = tk$soft, line_h = 0.0118)
  yy - 0.004
}

.form_pdf_draw_cover <- function(block, x, y, w) {
  tk <- pulso_pdf_tokens()
  cx <- x + w / 2
  y <- y - 0.018
  lines <- .form_pdf_wrap(block$title, 46)
  grid::grid.text(paste(lines, collapse = "\n"), x = grid::unit(cx, "npc"),
                  y = grid::unit(y, "npc"), just = c("center", "top"),
                  gp = grid::gpar(fontsize = 16.5, fontface = "bold", col = tk$navy, lineheight = 1.06))
  y <- y - length(lines) * 0.026 - 0.008
  grid::grid.lines(x = grid::unit(c(cx - 0.055, cx + 0.055), "npc"),
                   y = grid::unit(y, "npc"), gp = grid::gpar(col = tk$navy, lwd = 1.4))
  y - 0.018
}

.form_pdf_draw_paper <- function(block, x, y, w) {
  if (nzchar(block$title %||% "")) {
    y <- .form_pdf_band(block$title, x, y, w, chars = 118)
    y <- y - 0.008
  }
  if (nzchar(block$body %||% "")) {
    y <- .form_pdf_text(block$body, x + 0.008, y, w - 0.016, chars = 122,
                        fontsize = 8.1, col = pulso_pdf_tokens()$ink, line_h = 0.012)
  }
  y - 0.012
}

.form_pdf_draw_section <- function(block, x, y, w) {
  label <- block$title
  # Marca textual de sección repetible (ADR 0030, Fase 4).
  label <- paste0(label, .repeat_pdf_section_suffix(isTRUE(block$repeatable), block$repeat_count))
  kicker <- if (!is.null(block$section_index)) sprintf("Sección %d", block$section_index) else ""
  y <- .form_pdf_band(label, x, y, w, chars = 112, kicker = kicker)
  if (nzchar(block$opening_condition %||% "")) {
    y <- .form_pdf_draw_opening(block$opening_condition, x, y - 0.006, w)
  }
  if (nzchar(block$hint %||% "")) {
    y <- .form_pdf_text(block$hint, x + 0.008, y - 0.006, w - 0.016, chars = 112,
                        fontsize = 7.5, fontface = "italic", col = pulso_pdf_tokens()$soft, line_h = 0.012)
  }
  y - 0.008
}

.form_pdf_draw_options <- function(options, x, y, w, multiple = FALSE) {
  if (!length(options)) return(y)
  tk <- pulso_pdf_tokens()
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
  code_w <- if (show_code) min(0.070, max(0.038, max_code_chars * 0.011)) else 0
  mark_w <- if (multiple || !show_code) 0.026 else 0
  y_start <- y
  for (idx in seq_along(options)) {
    opt <- options[[idx]]
    text <- opt$label
    if (nzchar(opt$paper_skip %||% "")) text <- paste0(text, "  -> ", opt$paper_skip)
    lines <- .form_pdf_wrap(text, floor((w - code_w - mark_w - 0.018) * 125))
    h <- max(0.021, length(lines) * 0.013 + 0.008)
    # Zebra sutil en filas pares (patron codebook).
    if (idx %% 2L == 0L) .form_pdf_rect(x, y, w, h, fill = tk$tbl_zebra, col = NA, lwd = 0)
    xx <- x
    if (mark_w > 0) {
      # casilla de marca (checkbox) alineada con la primera linea
      bx <- xx + 0.006
      grid::grid.rect(x = grid::unit(bx + 0.006, "npc"), y = grid::unit(y - 0.0095, "npc"),
                      width = grid::unit(0.011, "npc"), height = grid::unit(0.011, "npc"),
                      gp = grid::gpar(fill = tk$surface, col = tk$tbl_frame, lwd = 0.5))
      xx <- xx + mark_w
    }
    if (show_code) {
      if (isTRUE(code_visible[[idx]])) {
        grid::grid.text(opt$code, x = grid::unit(xx + code_w / 2, "npc"),
                        y = grid::unit(y - 0.010, "npc"),
                        gp = grid::gpar(fontsize = 7.7, fontface = "bold", col = tk$navy))
      }
    }
    .form_pdf_text(text, xx + code_w + 0.004, y - 0.005, w - code_w - mark_w - 0.010,
                   chars = floor((w - code_w - mark_w) * 125), fontsize = 7.9,
                   col = tk$ink, line_h = 0.012)
    y <- y - h
  }
  # Marco exterior fino + divisor bajo el codigo.
  grid::grid.rect(x = grid::unit(x + w / 2, "npc"), y = grid::unit((y_start + y) / 2, "npc"),
                  width = grid::unit(w, "npc"), height = grid::unit(y_start - y, "npc"),
                  gp = grid::gpar(fill = NA, col = tk$tbl_frame, lwd = 0.5))
  if (show_code || mark_w > 0) {
    div_x <- x + mark_w + code_w
    grid::grid.lines(x = grid::unit(c(div_x, div_x), "npc"),
                     y = grid::unit(c(y, y_start), "npc"),
                     gp = grid::gpar(col = tk$tbl_div, lwd = 0.4))
  }
  y
}

.form_pdf_draw_question <- function(block, x, y, w) {
  tk <- pulso_pdf_tokens()
  chars_lbl <- if (isTRUE(block$full_width)) 118 else 54
  if (nzchar(block$opening_condition %||% "")) {
    y <- .form_pdf_draw_opening(block$opening_condition, x, y, w,
                                chars_factor = if (isTRUE(block$full_width)) 112 else 108)
    y <- y - 0.002
  }
  prefix <- if (nzchar(block$number %||% "")) paste0(block$number, ".  ") else ""
  y <- .form_pdf_text(paste0(prefix, block$label), x + 0.006, y, w - 0.012,
                      chars = chars_lbl,
                      fontsize = 8.4, fontface = "bold", col = tk$ink, line_h = 0.0142)
  if (nzchar(block$hint %||% "")) {
    y <- .form_pdf_text(block$hint, x + 0.006, y - 0.002, w - 0.012,
                        chars = chars_lbl,
                        fontsize = 7.3, fontface = "italic", col = tk$soft, line_h = 0.011)
  }
  y <- y - 0.007
  if (isTRUE(block$coded_list)) {
    grid::grid.rect(x = grid::unit(x + 0.006 + (w - 0.012) / 2, "npc"), y = grid::unit(y - 0.017, "npc"),
                    width = grid::unit(w - 0.012, "npc"), height = grid::unit(0.034, "npc"),
                    gp = grid::gpar(fill = tk$tbl_zebra, col = tk$tbl_frame, lwd = 0.5))
    .form_pdf_text("Codigo / respuesta:", x + 0.012, y - 0.008, w - 0.024,
                   chars = if (isTRUE(block$full_width)) 112 else 48,
                   fontsize = 7.5, fontface = "italic", col = tk$soft, line_h = 0.011)
    y <- y - 0.034
  } else if ((block$type %||% "") %in% c("select_one", "select_multiple")) {
    y <- .form_pdf_draw_options(block$options, x + 0.006, y, w - 0.012, multiple = identical(block$type, "select_multiple"))
  } else if ((block$type %||% "") %in% c("text", "integer", "decimal", "date", "time", "datetime")) {
    h <- if (identical(block$type, "text")) 0.034 else 0.025
    grid::grid.rect(x = grid::unit(x + 0.006 + (w - 0.012) / 2, "npc"), y = grid::unit(y - h / 2, "npc"),
                    width = grid::unit(w - 0.012, "npc"), height = grid::unit(h, "npc"),
                    gp = grid::gpar(fill = NA, col = tk$tbl_frame, lwd = 0.5))
    y <- y - h
  } else if (identical(block$type, "note")) {
    # Solo texto informativo.
  } else {
    grid::grid.rect(x = grid::unit(x + 0.006 + (w - 0.012) / 2, "npc"), y = grid::unit(y - 0.0125, "npc"),
                    width = grid::unit(w - 0.012, "npc"), height = grid::unit(0.025, "npc"),
                    gp = grid::gpar(fill = NA, col = tk$tbl_frame, lwd = 0.5))
    y <- y - 0.025
  }
  if (nzchar(block$skip %||% "")) {
    y <- .form_pdf_text(block$skip, x + 0.012, y - 0.006, w - 0.024,
                        chars = if (isTRUE(block$full_width)) 112 else 48,
                        fontsize = 7.6, fontface = "italic", col = tk$navy, line_h = 0.012)
  }
  y - 0.013
}

.form_pdf_option_is_special <- function(opt) {
  code <- .form_pdf_clean_text(opt$code %||% "")
  label <- tolower(.form_pdf_clean_text(opt$label %||% ""))
  # Codigos canonicos de valores especiales (estandar Pulso + "9"/"SIN INF" de la
  # referencia): perdido/NS-NR/no aplica/no votó/blanco.
  if (code %in% c("9", "77", "88", "90", "94", "95", "96", "97", "98", "99")) return(TRUE)
  grepl("^(sin\\b|sin inf|ns\\b|ns/nr|no sabe|no aplica|no responde|no informa|valor perdido|blanco|viciado|no vot|no piensa)",
        label, perl = TRUE)
}

# Divide las opciones de una matriz en la escala ordenada y una unica opcion
# especial (p. ej. "SIN INF" = 9), preservando el orden original de la escala.
.form_pdf_matrix_partition_options <- function(options) {
  options <- options %||% list()
  if (!length(options)) return(list(scale = list(), special = NULL))
  is_special <- vapply(options, .form_pdf_option_is_special, logical(1))
  special <- if (any(is_special)) options[[which(is_special)[1]]] else NULL
  scale <- options[!is_special]
  # Salvaguarda: si TODO se clasifica como especial, tratarlo como escala.
  if (!length(scale)) return(list(scale = options, special = NULL))
  list(scale = scale, special = special)
}

.form_pdf_draw_matrix <- function(block, x, y, w) {
  tk <- pulso_pdf_tokens()
  if (nzchar(block$opening_condition %||% "")) {
    y <- .form_pdf_draw_opening(block$opening_condition, x, y, w)
    y <- y - 0.002
  }
  prefix <- if (nzchar(block$number %||% "")) paste0(block$number, ".  ") else ""
  y <- .form_pdf_text(paste0(prefix, block$title), x + 0.006, y, w - 0.012,
                      chars = 118, fontsize = 8.4, fontface = "bold", col = tk$ink, line_h = 0.0142)
  if (nzchar(block$hint %||% "")) {
    y <- .form_pdf_text(block$hint, x + 0.006, y - 0.002, w - 0.012,
                        chars = 118, fontsize = 7.2, fontface = "italic", col = tk$soft, line_h = 0.011)
  }
  y <- y - 0.007

  part <- .form_pdf_matrix_partition_options(block$options)
  scale <- part$scale
  special <- part$special
  n_scale <- length(scale)
  has_special <- !is.null(special)
  total_cols <- n_scale + (if (has_special) 1L else 0L)

  inner <- w - 0.012
  x0 <- x + 0.006

  # Etiqueta ~47% del bloque; el resto repartido entre columnas de escala + especial.
  label_w <- if (total_cols > 0L) inner * 0.47 else inner
  scale_area <- inner - label_w
  col_w <- if (total_cols > 0L) scale_area / total_cols else 0
  scale_x0 <- x0 + label_w
  scale_w <- n_scale * col_w
  y_top_tbl <- y

  code_y_off <- 0.010  # los codigos se alinean con la primera linea del item

  if (total_cols > 0L) {
    # --- Cabecera: anclas nombradas SOBRE sus columnas (extremos + especial) ---
    anchor_cw <- max(8L, floor(2 * col_w * 118))
    special_cw <- max(6L, floor(col_w * 100))
    left_lines <- if (n_scale >= 1L) .form_pdf_wrap(scale[[1]]$label %||% scale[[1]]$code, anchor_cw) else character(0)
    right_lines <- if (n_scale >= 2L) .form_pdf_wrap(scale[[n_scale]]$label %||% scale[[n_scale]]$code, anchor_cw) else character(0)
    special_lines <- if (has_special) .form_pdf_wrap(toupper(.form_pdf_clean_text(special$label %||% special$code)), special_cw) else character(0)
    hdr_lines <- max(1L, length(left_lines), length(right_lines), length(special_lines))
    header_h <- hdr_lines * 0.0110 + 0.010

    grid::grid.rect(x = grid::unit(x0 + inner / 2, "npc"), y = grid::unit(y - header_h / 2, "npc"),
                    width = grid::unit(inner, "npc"), height = grid::unit(header_h, "npc"),
                    gp = grid::gpar(fill = tk$tbl_header, col = NA))
    .form_pdf_text("Encierre una respuesta por fila", x0 + 0.006, y - 0.006, label_w - 0.010,
                   chars = max(20L, floor((label_w - 0.010) * 120)), fontsize = 6.7,
                   fontface = "bold", col = tk$soft, line_h = 0.009)
    if (length(left_lines)) {
      grid::grid.text(paste(left_lines, collapse = "\n"), x = grid::unit(scale_x0 + 0.005, "npc"),
                      y = grid::unit(y - 0.006, "npc"), just = c("left", "top"),
                      gp = grid::gpar(fontsize = 6.2, fontface = "bold", col = tk$navy, lineheight = 0.95))
    }
    if (length(right_lines)) {
      grid::grid.text(paste(right_lines, collapse = "\n"), x = grid::unit(scale_x0 + scale_w - 0.005, "npc"),
                      y = grid::unit(y - 0.006, "npc"), just = c("right", "top"),
                      gp = grid::gpar(fontsize = 6.2, fontface = "bold", col = tk$navy, lineheight = 0.95))
    }
    if (length(special_lines)) {
      grid::grid.text(paste(special_lines, collapse = "\n"),
                      x = grid::unit(scale_x0 + scale_w + col_w / 2, "npc"),
                      y = grid::unit(y - 0.006, "npc"), just = c("center", "top"),
                      gp = grid::gpar(fontsize = 5.8, fontface = "bold", col = tk$soft, lineheight = 0.9))
    }
    y <- y - header_h
  } else {
    header_h <- 0
  }
  y_body_top <- y

  # --- Filas de items: etiqueta ancha + el CODIGO impreso en cada columna ---
  row_idx <- 0L
  for (item in block$items %||% list()) {
    row_idx <- row_idx + 1L
    lbl_chars <- max(20L, floor((label_w - 0.012) * 120))
    num <- .form_pdf_clean_text(item$number %||% "")
    lbl <- if (nzchar(num)) paste0(num, ".  ", item$label) else item$label
    lines <- .form_pdf_wrap(lbl, lbl_chars)
    h <- max(0.018, length(lines) * 0.012 + 0.007)
    if (row_idx %% 2L == 0L) {
      grid::grid.rect(x = grid::unit(x0 + inner / 2, "npc"), y = grid::unit(y - h / 2, "npc"),
                      width = grid::unit(inner, "npc"), height = grid::unit(h, "npc"),
                      gp = grid::gpar(fill = tk$tbl_zebra, col = NA))
    }
    .form_pdf_text(lbl, x0 + 0.006, y - 0.004, label_w - 0.012,
                   chars = lbl_chars, fontsize = 7.3, col = tk$ink, line_h = 0.012)
    if (total_cols > 0L) {
      cy <- y - min(code_y_off, h / 2)
      xx <- scale_x0
      for (k in seq_len(n_scale)) {
        grid::grid.text(.form_pdf_clean_text(scale[[k]]$code), x = grid::unit(xx + col_w / 2, "npc"),
                        y = grid::unit(cy, "npc"),
                        gp = grid::gpar(fontsize = 7.4, col = tk$ink))
        xx <- xx + col_w
      }
      if (has_special) {
        grid::grid.text(.form_pdf_clean_text(special$code), x = grid::unit(xx + col_w / 2, "npc"),
                        y = grid::unit(cy, "npc"),
                        gp = grid::gpar(fontsize = 7.4, col = tk$soft))
      }
    }
    y <- y - h
  }

  # Marco exterior + reglas (marco fino; divisores de escala punteados suaves;
  # divisor mas marcado antes de la columna especial).
  tbl_bottom <- y
  grid::grid.rect(x = grid::unit(x0 + inner / 2, "npc"), y = grid::unit((y_top_tbl + tbl_bottom) / 2, "npc"),
                  width = grid::unit(inner, "npc"), height = grid::unit(y_top_tbl - tbl_bottom, "npc"),
                  gp = grid::gpar(fill = NA, col = tk$tbl_frame, lwd = 0.5))
  if (total_cols > 0L) {
    # divisor etiqueta | escala (solido)
    grid::grid.lines(x = grid::unit(c(scale_x0, scale_x0), "npc"),
                     y = grid::unit(c(tbl_bottom, y_top_tbl), "npc"),
                     gp = grid::gpar(col = tk$tbl_frame, lwd = 0.5))
    # divisores internos entre columnas de escala (punteados suaves)
    if (n_scale >= 2L) {
      for (k in seq_len(n_scale - 1L)) {
        dx <- scale_x0 + col_w * k
        grid::grid.lines(x = grid::unit(c(dx, dx), "npc"), y = grid::unit(c(tbl_bottom, y_top_tbl), "npc"),
                         gp = grid::gpar(col = tk$tbl_div, lwd = 0.4, lty = "dotted"))
      }
    }
    # divisor mas marcado antes de la columna especial
    if (has_special) {
      sdx <- scale_x0 + scale_w
      grid::grid.lines(x = grid::unit(c(sdx, sdx), "npc"), y = grid::unit(c(tbl_bottom, y_top_tbl), "npc"),
                       gp = grid::gpar(col = tk$tbl_frame, lwd = 0.5))
    }
    # regla bajo la cabecera
    grid::grid.lines(x = grid::unit(c(x0, x0 + inner), "npc"),
                     y = grid::unit(c(y_body_top, y_body_top), "npc"),
                     gp = grid::gpar(col = tk$tbl_frame, lwd = 0.5))
  }
  y <- tbl_bottom
  if (nzchar(block$skip %||% "")) {
    y <- .form_pdf_text(block$skip, x + 0.012, y - 0.006, w - 0.024,
                        chars = 112, fontsize = 7.6, fontface = "italic", col = tk$navy, line_h = 0.012)
  }
  y - 0.014
}

.form_pdf_draw_block <- function(block, x, y, w) {
  switch(
    block$kind,
    cover = .form_pdf_draw_cover(block, x, y, w),
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
        gp = grid::gpar(col = pulso_pdf_tokens()$faint, lwd = 0.5)
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

  blocks <- model$blocks
  for (bi in seq_along(blocks)) {
    block <- blocks[[bi]]
    nxt <- if (bi < length(blocks)) blocks[[bi + 1L]] else NULL
    h <- .form_pdf_block_height(block, if (isTRUE(block$full_width)) full_w else col_w)
    if (isTRUE(block$full_width)) {
      flush_divider(min(y))
      yy <- min(y)
      # Control de viudas/huerfanas: una banda de seccion no debe quedar sola al
      # pie; debe caber con el inicio de su primer bloque siguiente.
      keep <- h
      if (identical(block$kind, "section") && !is.null(nxt)) {
        nxt_h <- .form_pdf_block_height(nxt, full_w)
        keep <- h + min(nxt_h, 0.085)
      }
      if (yy - h < y_bottom || (yy - keep < y_bottom && yy < (y_top - 0.001))) {
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
