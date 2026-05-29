# =============================================================================
# SurveyMonkey multibase contra XLSForm canonico
#
# Este modulo no reemplaza el importador del editor XLSForm. Parte de un
# instrumento canonico ya revisado por el usuario y usa SurveyMonkey solo para:
#   - auditar compatibilidad entre surveys equivalentes,
#   - traer metadata/respuestas,
#   - apilar la data normalizada en una base integrada.
# =============================================================================

.sm_mb_scalar <- function(x, fallback = "") {
  if (is.null(x) || length(x) == 0L) return(fallback)
  x <- as.character(x)[1]
  if (is.na(x)) fallback else x
}

.sm_mb_trim <- function(x) {
  if (is.null(x) || length(x) == 0L) return("")
  x <- as.character(x)
  x[is.na(x)] <- ""
  x <- gsub("<br\\s*/?>", " ", x, ignore.case = TRUE, perl = TRUE)
  x <- gsub("<[^>]+>", " ", x, perl = TRUE)
  x <- gsub("&nbsp;", " ", x, fixed = TRUE)
  x <- gsub("&amp;", "&", x, fixed = TRUE)
  x <- gsub("[[:space:]]+", " ", x)
  trimws(x)
}

.sm_mb_norm <- function(x) {
  if (is.null(x) || length(x) == 0L) return(character(0))
  x <- tolower(.sm_mb_trim(x))
  x <- iconv(x, to = "ASCII//TRANSLIT", sub = "")
  x <- gsub("[^a-z0-9]+", " ", x)
  gsub("[[:space:]]+", " ", trimws(x))
}

.sm_mb_slug <- function(x) {
  out <- .sm_mb_norm(x)
  out <- gsub("[[:space:]]+", "_", out)
  out <- gsub("^_+|_+$", "", out)
  out[!nzchar(out) | is.na(out)] <- "valor"
  out
}

.sm_mb_label_col <- function(df) {
  candidates <- c("label", "label::es", "label::Spanish (ES)", "label_spanish_es")
  present <- candidates[candidates %in% names(df)]
  for (candidate in present) {
    values <- .sm_mb_trim(df[[candidate]])
    if (any(nzchar(values))) return(candidate)
  }
  hit <- present[1]
  if (is.na(hit)) NA_character_ else hit
}

.sm_mb_type_base <- function(type) {
  trimws(sub("\\s+.*$", "", as.character(type %||% "")))
}

.sm_mb_type_list <- function(type) {
  type <- trimws(as.character(type %||% ""))
  if (!grepl("^select_(one|multiple)\\s+", type)) return("")
  trimws(sub("^select_(one|multiple)\\s+", "", type))
}

.sm_mb_non_question_types <- c(
  "begin_group", "end_group", "begin_repeat", "end_repeat",
  "note", "start", "end", "today", "deviceid",
  "subscriberid", "phonenumber", "simserial", "username", "audit",
  "calculate"
)

.sm_mb_question_heading <- function(q) {
  .sm_api_question_heading(q) %||% ""
}

.sm_mb_item_labels <- function(items) {
  if (is.null(items) || !length(items)) return(character(0))
  vapply(items, function(x) .sm_mb_trim(x$text %||% x$heading %||% x$label %||% ""), character(1))
}

.sm_mb_item_ids <- function(items) {
  if (is.null(items) || !length(items)) return(character(0))
  vapply(items, function(x) .sm_mb_scalar(x$id, ""), character(1))
}

.sm_mb_validation_sig <- function(q) {
  validation <- q$validation %||% list()
  paste(
    .sm_mb_scalar(validation$type, ""),
    .sm_mb_scalar(validation$min, ""),
    .sm_mb_scalar(validation$max, ""),
    sep = ":"
  )
}

.sm_mb_question_table <- function(details) {
  pages <- details$pages %||% list()
  out <- list()
  pos <- 0L
  for (pi in seq_along(pages)) {
    page <- pages[[pi]]
    questions <- page$questions %||% list()
    for (q in questions) {
      fam <- .sm_mb_scalar(q$family, "")
      if (identical(fam, "presentation")) next
      pos <- pos + 1L
      ans <- q$answers %||% list()
      choices <- .sm_api_question_choices(q)
      rows <- ans$rows %||% list()
      cols <- ans$cols %||% ans$columns %||% list()
      required <- q$required %||% list()
      heading <- .sm_mb_question_heading(q)
      out[[length(out) + 1L]] <- data.frame(
        pos = pos,
        page = suppressWarnings(as.integer(page$position %||% pi)),
        qid = .sm_mb_scalar(q$id, ""),
        family = fam,
        subtype = .sm_mb_scalar(q$subtype, ""),
        heading = heading,
        heading_norm = .sm_mb_norm(heading),
        required = .sm_mb_scalar(required$type, ""),
        validation = .sm_mb_validation_sig(q),
        n_choices = length(choices),
        n_rows = length(rows),
        n_cols = length(cols),
        choice_signature = paste(.sm_mb_norm(vapply(choices, `[[`, character(1), "label")), collapse = " || "),
        row_signature = paste(.sm_mb_norm(.sm_mb_item_labels(rows)), collapse = " || "),
        col_signature = paste(.sm_mb_norm(.sm_mb_item_labels(cols)), collapse = " || "),
        stringsAsFactors = FALSE
      )
    }
  }
  if (!length(out)) {
    return(data.frame(
      pos = integer(), page = integer(), qid = character(), family = character(),
      subtype = character(), heading = character(), heading_norm = character(),
      required = character(), validation = character(), n_choices = integer(),
      n_rows = integer(), n_cols = integer(), choice_signature = character(),
      row_signature = character(), col_signature = character(),
      stringsAsFactors = FALSE
    ))
  }
  do.call(rbind, out)
}

.sm_mb_country_from_title <- function(title) {
  title_norm <- .sm_mb_norm(title)
  if (!nzchar(title_norm)) return("")
  country_aliases <- list(
    chile = c("chile"),
    colombia = c("colombia"),
    mexico = c("mexico", "mex"),
    peru = c("peru"),
    argentina = c("argentina"),
    ecuador = c("ecuador"),
    uruguay = c("uruguay"),
    paraguay = c("paraguay"),
    bolivia = c("bolivia")
  )
  map <- c(
    chile = "Chile",
    colombia = "Colombia",
    mexico = "Mexico",
    peru = "Peru",
    argentina = "Argentina",
    ecuador = "Ecuador",
    uruguay = "Uruguay",
    paraguay = "Paraguay",
    bolivia = "Bolivia"
  )
  for (k in names(country_aliases)) {
    if (any(grepl(paste0("\\b(", paste(country_aliases[[k]], collapse = "|"), ")\\b"), title_norm))) {
      return(map[[k]])
    }
  }
  for (k in names(map)) {
    if (grepl(paste0("\\b", k, "\\b"), title_norm)) return(map[[k]])
  }
  ""
}

.sm_mb_normalize_survey_specs <- function(items) {
  if (is.null(items) || !length(items)) return(list())
  lapply(seq_along(items), function(i) {
    x <- items[[i]]
    survey_id <- .sm_mb_scalar(x$survey_id %||% x$id, "")
    pais <- .sm_mb_trim(x$pais %||% x$country)
    label <- .sm_mb_scalar(x$label %||% x$title, "")
    data_file_id <- .sm_mb_scalar(x$data_file_id, "")
    if (!nzchar(survey_id)) stop_api(400, "E_SM_SURVEY_ID", "Cada encuesta necesita survey_id.")
    list(
      survey_id = survey_id,
      pais = pais,
      label = label,
      data_file_id = data_file_id
    )
  })
}

.sm_mb_canonical_inst <- function(sid, file_id = "") {
  if (nzchar(file_id)) {
    meta <- get_file(sid, file_id)
    return(list(path = meta$path, inst = reporte_instrumento(path = meta$path), meta = meta))
  }
  s <- session_get(sid)
  files <- s$files %||% list()
  xls <- Filter(function(f) identical(f$kind, "xlsform"), files)
  if (!length(xls)) {
    stop_api(409, "E_NO_CANONICAL_XLSFORM", "Carga o exporta primero el XLSForm canonico.")
  }
  meta <- xls[[length(xls)]]
  list(path = meta$path, inst = reporte_instrumento(path = meta$path), meta = meta)
}

.sm_mb_var_exists <- function(inst, name) {
  survey <- inst$survey
  !is.null(survey) && "name" %in% names(survey) && name %in% as.character(survey$name)
}

.sm_mb_var_for_pos <- function(inst, pos, row = NULL) {
  pos <- suppressWarnings(as.integer(pos))
  if (is.na(pos) || pos < 1L) return("")
  base <- paste0("p", pos)
  candidates <- if (is.null(row) || is.na(row) || row < 1L) {
    c(base, sprintf("q%04d", pos), paste0("q", pos))
  } else {
    c(paste0(base, "_", row), base, sprintf("q%04d_%04d", pos, row), paste0("q", pos, "_", row))
  }
  hit <- candidates[vapply(candidates, .sm_mb_var_exists, logical(1), inst = inst)][1]
  if (is.na(hit)) candidates[1] else hit
}

.sm_mb_question_pos_for_var <- function(var) {
  var <- .sm_mb_scalar(var, "")
  m <- regmatches(var, regexec("^[pP]0*([0-9]+)(?:_|$)", var, perl = TRUE))[[1]]
  if (length(m) >= 2L) return(suppressWarnings(as.integer(m[2])))
  NA_integer_
}

.sm_mb_detect_company_positions <- function(tables) {
  positions <- sort(unique(unlist(lapply(tables, function(x) x$pos), use.names = FALSE)))
  out <- integer(0)
  for (pos in positions) {
    rows <- do.call(rbind, lapply(tables, function(tbl) tbl[tbl$pos == pos, , drop = FALSE]))
    if (!nrow(rows)) next
    heading_hit <- any(grepl("\\bempresa\\b", rows$heading_norm))
    menu_hit <- any(rows$family == "single_choice" & rows$subtype %in% c("menu", "vertical"))
    choice_counts <- unique(rows$n_choices)
    if (heading_hit && menu_hit && length(choice_counts) > 1L) {
      out <- c(out, pos)
    }
  }
  unique(out)
}

.sm_mb_expr_references_var <- function(inst, var) {
  survey <- inst$survey
  if (is.null(survey) || !nrow(survey)) return(FALSE)
  expr_cols <- intersect(c("relevant", "constraint", "calculation", "choice_filter"), names(survey))
  if (!length(expr_cols)) return(FALSE)
  pat <- paste0("${", var, "}")
  any(vapply(expr_cols, function(col) {
    any(grepl(pat, as.character(survey[[col]] %||% ""), fixed = TRUE), na.rm = TRUE)
  }, logical(1)))
}

.sm_mb_expr_reference_hits <- function(inst, var) {
  survey <- inst$survey
  if (is.null(survey) || !nrow(survey)) return(data.frame())
  expr_cols <- intersect(c("relevant", "constraint", "calculation", "choice_filter"), names(survey))
  if (!length(expr_cols)) return(data.frame())
  pat <- paste0("${", var, "}")
  hits <- list()
  for (col in expr_cols) {
    values <- as.character(survey[[col]] %||% "")
    idx <- which(grepl(pat, values, fixed = TRUE))
    if (!length(idx)) next
    for (i in idx) {
      label_col <- .sm_mb_label_col(survey)
      label <- if (!is.na(label_col)) .sm_mb_scalar(survey[[label_col]][i], "") else ""
      hits[[length(hits) + 1L]] <- data.frame(
        row_index = as.integer(i),
        name = .sm_mb_scalar(survey$name[i], ""),
        type = .sm_mb_scalar(survey$type[i], ""),
        label = label,
        col = col,
        expr = values[i],
        stringsAsFactors = FALSE,
        check.names = FALSE
      )
    }
  }
  if (!length(hits)) return(data.frame())
  do.call(rbind, hits)
}

.sm_mb_is_safe_company_ref <- function(hit, var) {
  nm <- .sm_mb_scalar(hit$name, "")
  lab <- .sm_mb_norm(.sm_mb_scalar(hit$label, ""))
  col <- .sm_mb_scalar(hit$col, "")
  type <- .sm_mb_scalar(hit$type, "")
  is_other_name <- nm %in% c(paste0(var, "_other"), paste0(var, "_otro"))
  is_other_label <- grepl("\\botro\\b|especifique", lab)
  identical(col, "relevant") && grepl("^text\\b", type) && (is_other_name || is_other_label)
}

.sm_mb_company_logic <- function(inst, vars) {
  blocked <- character(0)
  soft <- list()
  for (var in vars) {
    hits <- .sm_mb_expr_reference_hits(inst, var)
    if (!nrow(hits)) next
    safe <- vapply(seq_len(nrow(hits)), function(i) .sm_mb_is_safe_company_ref(hits[i, , drop = FALSE], var), logical(1))
    if (any(!safe)) blocked <- c(blocked, var)
    if (any(safe)) soft[[var]] <- hits[safe, , drop = FALSE]
  }
  list(blocked = unique(blocked), soft = soft)
}

.sm_mb_company_variables <- function(inst, positions) {
  vars <- vapply(positions, function(pos) .sm_mb_var_for_pos(inst, pos), character(1))
  vars[nzchar(vars)]
}

.sm_mb_compare_to_ref <- function(ref, cur, company_positions = integer()) {
  n <- max(nrow(ref), nrow(cur))
  out <- list()
  for (i in seq_len(n)) {
    if (i > nrow(ref) || i > nrow(cur)) {
      out[[length(out) + 1L]] <- list(
        pos = i, variable = paste0("p", i), severity = "blocking",
        kind = "missing_or_extra", message = "Pregunta faltante o extra.",
        ref = "", current = ""
      )
      next
    }
    hard_fields <- c("family", "subtype", "required", "validation", "n_rows", "n_cols")
    hard <- any(as.character(ref[i, hard_fields]) != as.character(cur[i, hard_fields]))
    choice_diff <- !identical(as.integer(ref$n_choices[i]), as.integer(cur$n_choices[i])) ||
      !identical(as.character(ref$choice_signature[i]), as.character(cur$choice_signature[i]))
    row_text_diff <- !identical(as.character(ref$row_signature[i]), as.character(cur$row_signature[i]))
    heading_diff <- !identical(as.character(ref$heading_norm[i]), as.character(cur$heading_norm[i]))

    if (hard) {
      out[[length(out) + 1L]] <- list(
        pos = i, variable = paste0("p", i), severity = "blocking",
        kind = "structure", message = "Tipo, filas, columnas o validacion no coinciden.",
        ref = ref$heading[i], current = cur$heading[i]
      )
    } else if (choice_diff) {
      out[[length(out) + 1L]] <- list(
        pos = i, variable = paste0("p", i), severity = "review",
        kind = "options_variant", message = "Opciones/codigos difieren; se integrara como variante con sufijo.",
        ref = ref$heading[i], current = cur$heading[i]
      )
    } else if (heading_diff || row_text_diff) {
      out[[length(out) + 1L]] <- list(
        pos = i, variable = paste0("p", i), severity = "review",
        kind = "wording", message = "Fraseo distinto; el usuario decide el texto canonico.",
        ref = ref$heading[i], current = cur$heading[i]
      )
    }
  }
  out
}

.sm_mb_question_by_pos <- function(details, pos) {
  pos <- suppressWarnings(as.integer(pos))
  if (is.na(pos) || pos < 1L) return(NULL)
  current <- 0L
  for (page in details$pages %||% list()) {
    for (q in page$questions %||% list()) {
      fam <- .sm_mb_scalar(q$family, "")
      if (identical(fam, "presentation")) next
      current <- current + 1L
      if (identical(current, pos)) return(q)
    }
  }
  NULL
}

.sm_mb_note_var_for_pos <- function(inst, pos) {
  candidates <- c(paste0("nota_p", pos), paste0("note_p", pos), paste0("p", pos, "_note"))
  hit <- candidates[vapply(candidates, .sm_mb_var_exists, logical(1), inst = inst)][1]
  if (is.na(hit)) "" else hit
}

.sm_mb_wording_diff <- function(pos, variable, ref, current, survey_id, part = "") {
  list(
    pos = as.integer(pos),
    variable = variable,
    severity = "review",
    kind = "wording",
    message = "Fraseo distinto; el usuario decide el texto canonico.",
    ref = .sm_mb_trim(ref),
    current = .sm_mb_trim(current),
    survey_id = survey_id,
    part = part
  )
}

.sm_mb_expand_wording_diff <- function(item, ref_details, cur_details, canonical_inst = NULL) {
  if (is.null(canonical_inst) || !identical(item$kind, "wording")) return(list(item))
  pos <- suppressWarnings(as.integer(item$pos %||% NA_integer_))
  ref_q <- .sm_mb_question_by_pos(ref_details, pos)
  cur_q <- .sm_mb_question_by_pos(cur_details, pos)
  if (is.null(ref_q) || is.null(cur_q)) return(list(item))

  out <- list()
  ref_heading <- .sm_mb_question_heading(ref_q)
  cur_heading <- .sm_mb_question_heading(cur_q)
  ref_rows <- .sm_mb_item_labels((ref_q$answers %||% list())$rows %||% list())
  cur_rows <- .sm_mb_item_labels((cur_q$answers %||% list())$rows %||% list())

  if (!identical(.sm_mb_norm(ref_heading), .sm_mb_norm(cur_heading))) {
    heading_var <- if (length(ref_rows) > 1L) .sm_mb_note_var_for_pos(canonical_inst, pos) else ""
    if (!nzchar(heading_var)) heading_var <- .sm_mb_var_for_pos(canonical_inst, pos)
    if (nzchar(heading_var)) {
      out[[length(out) + 1L]] <- .sm_mb_wording_diff(
        pos = pos, variable = heading_var, ref = ref_heading, current = cur_heading,
        survey_id = item$survey_id, part = "heading"
      )
    }
  }

  if (length(ref_rows) && length(cur_rows) && length(ref_rows) == length(cur_rows)) {
    for (i in seq_along(ref_rows)) {
      if (identical(.sm_mb_norm(ref_rows[i]), .sm_mb_norm(cur_rows[i]))) next
      row_var <- .sm_mb_var_for_pos(canonical_inst, pos, row = i)
      if (!nzchar(row_var) || !.sm_mb_var_exists(canonical_inst, row_var)) next
      out[[length(out) + 1L]] <- .sm_mb_wording_diff(
        pos = pos, variable = row_var, ref = ref_rows[i], current = cur_rows[i],
        survey_id = item$survey_id, part = paste0("row_", i)
      )
    }
  }

  if (length(out)) out else list(item)
}

.sm_mb_fetch_family <- function(specs, token) {
  details <- list()
  tables <- list()
  summaries <- list()
  for (spec in specs) {
    d <- sm_api_fetch_survey_details(spec$survey_id, token)
    tbl <- .sm_mb_question_table(d)
    title <- .sm_mb_trim(d$title %||% spec$label %||% spec$survey_id)
    pais <- spec$pais
    if (!nzchar(pais)) pais <- .sm_mb_country_from_title(title)
    probe <- tryCatch(
      sm_api_fetch_responses_bulk(spec$survey_id, token, page = 1L, per_page = 1L),
      error = function(e) list(total = NA_integer_, data = list(), error = conditionMessage(e))
    )
    total <- suppressWarnings(as.integer(probe$total %||% NA_integer_))
    details[[spec$survey_id]] <- d
    tables[[spec$survey_id]] <- tbl
    summaries[[length(summaries) + 1L]] <- list(
      survey_id = spec$survey_id,
      title = title,
      pais = pais,
      label = if (nzchar(spec$label)) spec$label else title,
      n_pages = as.integer(length(d$pages %||% list())),
      n_questions = as.integer(nrow(tbl)),
      n_responses = if (is.na(total)) NA_integer_ else total,
      responses_available = is.null(probe$error),
      responses_error = .sm_mb_scalar(probe$error, ""),
      data_file_id = .sm_mb_scalar(spec$data_file_id, "")
    )
  }
  list(details = details, tables = tables, summaries = summaries)
}

sm_multibase_audit <- function(specs, token, canonical_inst = NULL) {
  specs <- .sm_mb_normalize_survey_specs(specs)
  if (!length(specs)) stop("Selecciona al menos una encuesta.", call. = FALSE)
  fetched <- .sm_mb_fetch_family(specs, token)
  tables <- fetched$tables
  company_positions <- .sm_mb_detect_company_positions(tables)
  company_vars <- character(0)

  ref_id <- names(tables)[1]
  ref <- tables[[ref_id]]
  diffs <- list()
  for (id in setdiff(names(tables), ref_id)) {
    one <- .sm_mb_compare_to_ref(ref, tables[[id]], company_positions = company_positions)
    if (length(one)) {
      for (item in one) {
        item$survey_id <- id
        expanded <- .sm_mb_expand_wording_diff(
          item,
          ref_details = fetched$details[[ref_id]],
          cur_details = fetched$details[[id]],
          canonical_inst = canonical_inst
        )
        for (expanded_item in expanded) {
          diffs[[length(diffs) + 1L]] <- expanded_item
        }
      }
    }
  }

  blocking <- vapply(diffs, function(x) identical(x$severity, "blocking"), logical(1))
  review <- vapply(diffs, function(x) identical(x$severity, "review"), logical(1))
  special <- vapply(diffs, function(x) identical(x$severity, "special"), logical(1))
  list(
    ok = !any(blocking),
    surveys = fetched$summaries,
    ref_survey_id = ref_id,
    n_blocking = as.integer(sum(blocking)),
    n_review = as.integer(sum(review)),
    n_special = as.integer(sum(special)),
    company_positions = as.list(as.integer(company_positions)),
    company_variables = as.list(company_vars),
    diffs = diffs
  )
}

.sm_mb_query_aliases <- function(token) {
  token <- .sm_mb_norm(token)
  aliases <- switch(token,
    sello = c("certificada", "certificadas", "certificacion", "igualdad", "genero"),
    mujer = c("genero", "igualdad", "certificada", "certificadas"),
    mujeres = c("genero", "igualdad", "certificada", "certificadas"),
    trabajador = c("personal trabajador", "trabajador"),
    trabajadores = c("personal trabajador", "trabajador"),
    directivo = c("representantes directivos", "directivo"),
    directivos = c("representantes directivos", "directivos"),
    character(0)
  )
  unique(.sm_mb_norm(c(token, aliases)))
}

.sm_mb_query_matches <- function(q, text) {
  q_norm <- .sm_mb_norm(q)
  if (!nzchar(q_norm)) return(TRUE)
  text_norm <- .sm_mb_norm(text)
  tokens <- strsplit(q_norm, " +", perl = TRUE)[[1]]
  tokens <- tokens[nzchar(tokens)]
  if (!length(tokens)) return(TRUE)
  all(vapply(tokens, function(token) {
    aliases <- .sm_mb_query_aliases(token)
    any(vapply(aliases, function(alias) grepl(alias, text_norm, fixed = TRUE), logical(1)))
  }, logical(1)))
}

sm_multibase_list_surveys <- function(token, q = "", limit = 200L, months = 6L) {
  limit <- suppressWarnings(as.integer(limit %||% 200L))
  if (is.na(limit) || limit < 1L) limit <- 200L
  limit <- min(limit, 1000L)
  months <- suppressWarnings(as.integer(months %||% 6L))
  if (is.na(months) || months < 1L) months <- 6L

  surveys <- sm_api_list_surveys(token, per_page = 1000L)
  total <- length(surveys)
  cutoff <- as.POSIXct(Sys.Date(), tz = "UTC") - months * 31L * 24L * 60L * 60L
  surveys <- Filter(function(s) {
    mod <- .sm_api_parse_time(s$date_modified %||% NA_character_)
    !is.na(mod) && mod >= cutoff
  }, surveys)
  total_recent <- length(surveys)
  surveys <- Filter(function(s) {
    hay <- paste(
      .sm_mb_scalar(s$id, ""),
      .sm_mb_scalar(s$title, ""),
      .sm_mb_scalar(s$nickname, ""),
      .sm_mb_country_from_title(.sm_mb_scalar(s$title, ""))
    )
    .sm_mb_query_matches(q, hay)
  }, surveys)
  if (length(surveys) > limit) surveys <- surveys[seq_len(limit)]
  surveys <- lapply(surveys, function(s) {
    title <- .sm_mb_scalar(s$title, "")
    s$pais_guess <- .sm_mb_country_from_title(title)
    s
  })
  list(
    ok = TRUE,
    total_visible = as.integer(total),
    total_recent = as.integer(total_recent),
    months = as.integer(months),
    count = length(surveys),
    surveys = surveys
  )
}

.sm_mb_question_specs <- function(details) {
  pages <- details$pages %||% list()
  specs <- list()
  pos <- 0L
  for (page in pages) {
    for (q in page$questions %||% list()) {
      fam <- .sm_mb_scalar(q$family, "")
      if (identical(fam, "presentation")) next
      pos <- pos + 1L
      ans <- q$answers %||% list()
      rows <- ans$rows %||% list()
      choices <- .sm_api_question_choices(q)
      choice_by_label <- setNames(vapply(choices, `[[`, character(1), "code"),
                                  .sm_mb_norm(vapply(choices, `[[`, character(1), "label")))
      raw_choices <- ans$choices %||% list()
      choice_ids <- .sm_mb_item_ids(raw_choices)
      choice_labels <- .sm_mb_item_labels(raw_choices)
      choice_by_id <- character(0)
      if (length(choice_ids)) {
        for (i in seq_along(choice_ids)) {
          id <- choice_ids[i]
          if (!nzchar(id)) next
          lab <- choice_labels[i]
          code <- .sm_mb_named_lookup(choice_by_label, .sm_mb_norm(lab), as.character(i))
          choice_by_id[[id]] <- code
        }
      }
      row_ids <- .sm_mb_item_ids(rows)
      row_labels <- .sm_mb_item_labels(rows)
      row_pos <- seq_along(row_ids)
      names(row_pos) <- row_ids
      specs[[.sm_mb_scalar(q$id, paste0("pos_", pos))]] <- list(
        pos = pos,
        family = fam,
        subtype = .sm_mb_scalar(q$subtype, ""),
        heading = .sm_mb_question_heading(q),
        rows = rows,
        choices = choices,
        choice_by_id = choice_by_id,
        choice_by_label = choice_by_label,
        row_pos = row_pos,
        row_labels = row_labels
      )
    }
  }
  specs
}

.sm_mb_filter_responses_by_status <- function(responses,
                                              statuses = c("completed"),
                                              keep_missing = TRUE) {
  responses <- responses %||% list()
  original_n <- length(responses)
  statuses <- tolower(trimws(as.character(statuses %||% c("completed"))))
  statuses <- statuses[!is.na(statuses) & nzchar(statuses)]
  filter_info <- list(
    kind = "surveymonkey_response_status",
    statuses = as.list(statuses),
    keep_missing = isTRUE(keep_missing),
    original_rows = as.integer(original_n),
    kept_rows = as.integer(original_n),
    excluded_rows = 0L
  )
  if (!original_n || !length(statuses) || any(statuses %in% c("all", "*"))) {
    return(structure(responses, sm_response_filter = filter_info))
  }

  keep <- vapply(responses, function(resp) {
    st <- tolower(trimws(.sm_mb_scalar(resp$response_status, "")))
    if (!nzchar(st)) return(isTRUE(keep_missing))
    st %in% statuses
  }, logical(1))
  out <- responses[keep]
  filter_info$kept_rows <- as.integer(length(out))
  filter_info$excluded_rows <- as.integer(original_n - length(out))
  structure(out, sm_response_filter = filter_info)
}

.sm_mb_survey_row <- function(inst, var) {
  survey <- inst$survey
  if (is.null(survey) || !"name" %in% names(survey)) return(NULL)
  idx <- which(as.character(survey$name) == var)[1]
  if (is.na(idx)) NULL else survey[idx, , drop = FALSE]
}

.sm_mb_choices_for_var <- function(inst, var) {
  row <- .sm_mb_survey_row(inst, var)
  if (is.null(row)) return(data.frame())
  type <- as.character(row$type %||% "")
  ln <- if ("list_name" %in% names(row) && nzchar(.sm_mb_scalar(row$list_name, ""))) {
    .sm_mb_scalar(row$list_name, "")
  } else {
    .sm_mb_type_list(type)
  }
  choices <- inst$choices %||% data.frame()
  if (!nzchar(ln) || is.null(choices) || !nrow(choices) || !"list_name" %in% names(choices)) {
    return(data.frame())
  }
  out <- choices[as.character(choices$list_name) == ln, , drop = FALSE]
  lab_col <- .sm_mb_label_col(out)
  if (!is.na(lab_col)) out$label <- as.character(out[[lab_col]]) else out$label <- as.character(out$name)
  out
}

.sm_mb_code_for_label <- function(inst, var, label, fallback_code = "") {
  choices <- .sm_mb_choices_for_var(inst, var)
  if (!nrow(choices) || !"name" %in% names(choices)) {
    return(if (nzchar(fallback_code)) fallback_code else .sm_mb_scalar(label, ""))
  }
  labels_norm <- .sm_mb_norm(choices$label)
  hit <- which(labels_norm == .sm_mb_norm(label))[1]
  if (!is.na(hit)) return(as.character(choices$name[hit]))
  if (nzchar(fallback_code) && fallback_code %in% as.character(choices$name)) return(fallback_code)
  if (nzchar(fallback_code)) return(fallback_code)
  .sm_mb_scalar(label, "")
}

.sm_mb_named_lookup <- function(x, key, fallback = "") {
  key <- .sm_mb_scalar(key, "")
  if (!nzchar(key) || is.null(x) || !length(x)) return(fallback)
  nms <- names(x)
  if (is.null(nms) || !(key %in% nms)) return(fallback)
  .sm_mb_scalar(x[[key]], fallback)
}

.sm_mb_row_pos_for_answer <- function(spec, ans) {
  rid <- .sm_mb_scalar(ans$row_id, "")
  val <- .sm_mb_named_lookup(spec$row_pos, rid, "")
  suppressWarnings(as.integer(if (nzchar(val)) val else NA_integer_))
}

.sm_mb_answer_label_code <- function(ans, spec) {
  label <- ""
  code <- ""
  if (!is.null(ans$choice_id)) {
    choice_id <- .sm_mb_scalar(ans$choice_id, "")
    code <- .sm_mb_named_lookup(spec$choice_by_id, choice_id, "")
    if (nzchar(code) && length(spec$choices)) {
      idx <- which(vapply(spec$choices, `[[`, character(1), "code") == code)[1]
      if (!is.na(idx)) label <- .sm_mb_scalar(spec$choices[[idx]]$label, "")
    }
  }
  if (!nzchar(label) && !is.null(ans$col_id)) {
    col_id <- .sm_mb_scalar(ans$col_id, "")
    code <- .sm_mb_named_lookup(spec$choice_by_id, col_id, code)
  }
  if (!nzchar(label) && !is.null(ans$text)) label <- .sm_mb_trim(ans$text)
  if (!nzchar(label) && nzchar(code) && length(spec$choices)) {
    idx <- which(vapply(spec$choices, `[[`, character(1), "code") == code)[1]
    if (!is.na(idx)) label <- .sm_mb_scalar(spec$choices[[idx]]$label, "")
  }
  list(label = label, code = code)
}

.sm_mb_set_value <- function(row, var, value) {
  if (!nzchar(var) || is.null(value) || is.na(value) || !nzchar(as.character(value))) return(row)
  old <- row[[var]]
  if (is.null(old) || is.na(old) || !nzchar(as.character(old))) row[[var]] <- as.character(value)[1]
  row
}

.sm_mb_variant_lookup <- function(variant_map) {
  out <- list(by_var = list(), by_pos = list())
  for (item in variant_map %||% list()) {
    from <- .sm_mb_scalar(item$from, "")
    to <- .sm_mb_scalar(item$to, "")
    pos <- suppressWarnings(as.integer(item$pos %||% NA_integer_))
    if (!nzchar(to)) next
    if (nzchar(from)) out$by_var[[from]] <- to
    if (!is.na(pos) && pos > 0L) out$by_pos[[as.character(pos)]] <- to
  }
  out
}

.sm_mb_variant_var <- function(var, pos, lookup) {
  var <- .sm_mb_scalar(var, "")
  if (!nzchar(var)) return(var)
  by_var <- .sm_mb_scalar(lookup$by_var[[var]], "")
  if (nzchar(by_var)) return(by_var)

  pos <- suppressWarnings(as.integer(pos))
  if (is.na(pos) || pos < 1L) return(var)
  by_pos <- .sm_mb_scalar(lookup$by_pos[[as.character(pos)]], "")
  if (!nzchar(by_pos)) return(var)

  base <- paste0("p", pos)
  if (identical(var, base)) return(by_pos)
  prefix <- paste0(base, "_")
  if (startsWith(var, prefix)) return(paste0(by_pos, substring(var, nchar(base) + 1L)))
  var
}

.sm_mb_expected_names <- function(inst) {
  if (exists(".dn_expected_data_names", mode = "function")) {
    out <- as.character(.dn_expected_data_names(inst) %||% character(0))
    return(unique(out[!is.na(out) & nzchar(out)]))
  }
  survey <- inst$survey
  if (is.null(survey) || !all(c("name", "type") %in% names(survey))) return(character(0))
  type_base <- .sm_mb_type_base(survey$type)
  names_raw <- as.character(survey$name %||% "")
  unique(names_raw[!is.na(names_raw) & nzchar(names_raw) & !(type_base %in% .sm_mb_non_question_types)])
}

sm_multibase_api_responses_to_canonical_data <- function(details,
                                                         responses,
                                                         inst,
                                                         survey_id,
                                                         pais = "",
                                                         source_title = "",
                                                         company_vars = character(),
                                                         response_statuses = c("completed"),
                                                         keep_missing_status = TRUE,
                                                         variant_map = list()) {
  specs <- .sm_mb_question_specs(details)
  variant_lookup <- .sm_mb_variant_lookup(variant_map)
  responses <- .sm_mb_filter_responses_by_status(
    responses,
    statuses = response_statuses,
    keep_missing = keep_missing_status
  )
  response_filter <- attr(responses, "sm_response_filter", exact = TRUE)
  if (is.null(responses) || !length(responses)) {
    out <- data.frame()
    attr(out, "sm_response_filter") <- response_filter
    return(out)
  }
  company_vars <- as.character(company_vars %||% character(0))
  rows_out <- list()
  for (resp in responses) {
    response_id <- .sm_mb_scalar(resp$id %||% resp$response_id, "")
    row <- list(
      pais = .sm_mb_scalar(pais, ""),
      survey_id = .sm_mb_scalar(survey_id, ""),
      collector_id = .sm_mb_scalar(resp$collector_id, ""),
      respondent_id = response_id,
      response_id = response_id,
      case_uid = paste(.sm_mb_scalar(survey_id, ""), response_id, sep = ":"),
      source_title = .sm_mb_scalar(source_title, ""),
      response_status = .sm_mb_scalar(resp$response_status, ""),
      collection_mode = .sm_mb_scalar(resp$collection_mode, ""),
      date_created = .sm_mb_scalar(resp$date_created, ""),
      date_modified = .sm_mb_scalar(resp$date_modified, "")
    )
    multi_tokens <- list()
    for (page in resp$pages %||% list()) {
      for (question in page$questions %||% list()) {
        qid <- .sm_mb_scalar(question$id %||% question$question_id, "")
        spec <- specs[[qid]]
        if (is.null(spec)) next
        parent <- .sm_mb_var_for_pos(inst, spec$pos)
        parent <- .sm_mb_variant_var(parent, spec$pos, variant_lookup)
        answers <- question$answers %||% list()
        for (ans in answers) {
          if (identical(spec$family, "matrix")) {
            rpos <- .sm_mb_row_pos_for_answer(spec, ans)
            var <- .sm_mb_var_for_pos(inst, spec$pos, rpos)
            var <- .sm_mb_variant_var(var, spec$pos, variant_lookup)
            lc <- .sm_mb_answer_label_code(ans, spec)
            code <- .sm_mb_code_for_label(inst, var, lc$label, lc$code)
            row <- .sm_mb_set_value(row, var, code)
          } else if (identical(spec$family, "open_ended")) {
            rpos <- .sm_mb_row_pos_for_answer(spec, ans)
            var <- if (!is.na(rpos)) .sm_mb_var_for_pos(inst, spec$pos, rpos) else parent
            var <- .sm_mb_variant_var(var, spec$pos, variant_lookup)
            row <- .sm_mb_set_value(row, var, .sm_mb_trim(ans$text %||% ""))
          } else if (identical(spec$family, "multiple_choice")) {
            lc <- .sm_mb_answer_label_code(ans, spec)
            if (!nzchar(lc$code) && nzchar(lc$label)) {
              other_var <- paste0(parent, "_other")
              if (.sm_mb_var_exists(inst, other_var)) row <- .sm_mb_set_value(row, other_var, lc$label)
              next
            }
            code <- .sm_mb_code_for_label(inst, parent, lc$label, lc$code)
            if (nzchar(code)) multi_tokens[[parent]] <- unique(c(multi_tokens[[parent]] %||% character(0), code))
            if (!is.null(ans$text) && nzchar(.sm_mb_trim(ans$text))) {
              other_var <- paste0(parent, "_other")
              if (.sm_mb_var_exists(inst, other_var)) row <- .sm_mb_set_value(row, other_var, .sm_mb_trim(ans$text))
            }
          } else {
            lc <- .sm_mb_answer_label_code(ans, spec)
            if (parent %in% company_vars) {
              label <- if (nzchar(lc$label)) lc$label else lc$code
              row <- .sm_mb_set_value(row, parent, label)
              row <- .sm_mb_set_value(row, "empresa_source_code", lc$code)
              row <- .sm_mb_set_value(row, "empresa_source_label", label)
              row <- .sm_mb_set_value(row, "empresa_uid", paste(.sm_mb_scalar(pais, ""), .sm_mb_slug(label), sep = ":"))
            } else {
              code <- .sm_mb_code_for_label(inst, parent, lc$label, lc$code)
              row <- .sm_mb_set_value(row, parent, code)
              if (!is.null(ans$text) && nzchar(.sm_mb_trim(ans$text))) {
                other_var <- paste0(parent, "_other")
                if (.sm_mb_var_exists(inst, other_var)) row <- .sm_mb_set_value(row, other_var, .sm_mb_trim(ans$text))
              }
            }
          }
        }
      }
    }
    for (var in names(multi_tokens)) {
      row[[var]] <- paste(multi_tokens[[var]], collapse = " ")
    }
    rows_out[[length(rows_out) + 1L]] <- row
  }

  cols <- unique(unlist(lapply(rows_out, names), use.names = FALSE))
  expected <- .sm_mb_expected_names(inst)
  extras <- c("pais", "survey_id", "collector_id", "respondent_id", "response_id",
              "case_uid", "source_title", "response_status", "collection_mode",
              "date_created", "date_modified", "empresa_source_code",
              "empresa_source_label", "empresa_uid")
  cols <- unique(c(extras, expected, cols))
  cols <- cols[!is.na(cols) & nzchar(cols)]
  df <- do.call(rbind, lapply(rows_out, function(row) {
    vals <- lapply(cols, function(nm) {
      v <- row[[nm]]
      if (is.null(v) || length(v) == 0L) return(NA_character_)
      as.character(v)[1]
    })
    names(vals) <- cols
    as.data.frame(vals, stringsAsFactors = FALSE, optional = TRUE, check.names = FALSE)
  }))
  names(df) <- cols
  rownames(df) <- NULL
  attr(df, "sm_response_filter") <- response_filter
  df
}

.sm_mb_convert_company_upload <- function(df, details, inst, company_vars, pais) {
  company_vars <- as.character(company_vars %||% character(0))
  if (!length(company_vars)) return(df)
  specs <- .sm_mb_question_specs(details)
  for (var in company_vars) {
    pos <- .sm_mb_question_pos_for_var(var)
    spec <- NULL
    for (candidate in specs) {
      if (identical(candidate$pos, pos)) {
        spec <- candidate
        break
      }
    }
    if (is.null(spec) || !(var %in% names(df))) next
    vals <- as.character(df[[var]])
    labels <- vals
    for (i in seq_along(vals)) {
      code <- vals[i]
      if (is.na(code) || !nzchar(code)) next
      idx <- which(vapply(spec$choices, `[[`, character(1), "code") == code)[1]
      if (!is.na(idx)) labels[i] <- .sm_mb_scalar(spec$choices[[idx]]$label, code)
    }
    df$empresa_source_code <- vals
    df$empresa_source_label <- labels
    df$empresa_uid <- ifelse(!is.na(labels) & nzchar(labels),
                             paste(.sm_mb_scalar(pais, ""), vapply(labels, .sm_mb_slug, character(1)), sep = ":"),
                             NA_character_)
    df[[var]] <- labels
  }
  df
}

.sm_mb_read_upload_data <- function(sid, file_id, details, inst, survey_id, pais, source_title, company_vars) {
  meta <- get_file(sid, file_id)
  df <- .read_data_any_path(meta$path, meta$ext)
  df <- normalize_data_for_xlsform(df, inst)
  df <- .sm_mb_convert_company_upload(df, details, inst, company_vars, pais)
  df$pais <- .sm_mb_scalar(pais, "")
  df$survey_id <- .sm_mb_scalar(survey_id, "")
  if (!"response_id" %in% names(df) && "respondent_id" %in% names(df)) df$response_id <- df$respondent_id
  if (!"respondent_id" %in% names(df) && "response_id" %in% names(df)) df$respondent_id <- df$response_id
  if (!"collector_id" %in% names(df)) df$collector_id <- NA_character_
  df$case_uid <- paste(df$survey_id, as.character(df$response_id %||% seq_len(nrow(df))), sep = ":")
  df$source_title <- .sm_mb_scalar(source_title, "")
  df
}

.sm_mb_bind_rows <- function(dfs) {
  dfs <- Filter(function(x) is.data.frame(x) && nrow(x) > 0L, dfs)
  if (!length(dfs)) return(data.frame())
  cols <- unique(unlist(lapply(dfs, names), use.names = FALSE))
  cols <- cols[!is.na(cols) & nzchar(cols)]
  aligned <- lapply(dfs, function(df) {
    for (nm in setdiff(cols, names(df))) df[[nm]] <- NA_character_
    df[, cols, drop = FALSE]
  })
  out <- do.call(rbind, aligned)
  rownames(out) <- NULL
  out
}

.sm_mb_write_xlsx <- function(df, path) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) stop("Se requiere openxlsx.", call. = FALSE)
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "datos")
  openxlsx::writeData(wb, "datos", df, withFilter = TRUE)
  openxlsx::freezePane(wb, "datos", firstRow = TRUE)
  if (ncol(df)) openxlsx::setColWidths(wb, "datos", cols = seq_len(ncol(df)), widths = "auto")
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
}

.sm_mb_write_instrument_xlsx <- function(path_in, path_out, company_vars = character(), wording_decisions = list()) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) stop("Se requiere openxlsx.", call. = FALSE)
  sheets <- readxl::excel_sheets(path_in)
  wb <- openxlsx::createWorkbook()
  for (sheet in sheets) {
    df <- suppressWarnings(readxl::read_excel(path_in, sheet = sheet, .name_repair = "unique_quiet"))
    df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
    if (identical(tolower(sheet), "survey") && nrow(df)) {
      if (!"type" %in% names(df)) df$type <- NA_character_
      if (!"name" %in% names(df)) df$name <- NA_character_
      lab_col <- .sm_mb_label_col(df)
      if (is.na(lab_col)) {
        df$label <- NA_character_
        lab_col <- "label"
      }
      for (var in names(wording_decisions)) {
        idx <- which(as.character(df$name) == var)
        val <- .sm_mb_trim(wording_decisions[[var]])
        if (length(idx) && nzchar(val)) df[[lab_col]][idx] <- val
      }
      for (var in company_vars) {
        idx <- which(as.character(df$name) == var)
        if (!length(idx)) next
        df$type[idx] <- "text"
        for (cc in intersect(c("choice_filter", "appearance"), names(df))) df[[cc]][idx] <- NA_character_
      }
    }
    if (identical(tolower(sheet), "choices") && length(company_vars) && nrow(df)) {
      canon <- reporte_instrumento(path_in)
      list_names <- vapply(company_vars, function(var) {
        row <- .sm_mb_survey_row(canon, var)
        if (is.null(row)) return("")
        if ("list_name" %in% names(row) && nzchar(.sm_mb_scalar(row$list_name, ""))) .sm_mb_scalar(row$list_name, "")
        else .sm_mb_type_list(row$type)
      }, character(1))
      list_names <- list_names[nzchar(list_names)]
      if (length(list_names) && "list_name" %in% names(df)) {
        df <- df[!(as.character(df$list_name) %in% list_names), , drop = FALSE]
      }
    }
    openxlsx::addWorksheet(wb, sheet)
    openxlsx::writeData(wb, sheet, df)
    openxlsx::freezePane(wb, sheet, firstRow = TRUE)
    if (ncol(df)) openxlsx::setColWidths(wb, sheet, cols = seq_len(ncol(df)), widths = "auto")
  }
  if (!("settings" %in% tolower(sheets))) {
    openxlsx::addWorksheet(wb, "settings")
    openxlsx::writeData(wb, "settings", data.frame(form_title = "SurveyMonkey multibase", stringsAsFactors = FALSE))
  }
  openxlsx::saveWorkbook(wb, path_out, overwrite = TRUE)
}

sm_multibase_import <- function(sid,
                                specs,
                                token,
                                canonical_file_id = "",
                                base_name = "surveymonkey_multibase",
                                wording_decisions = list()) {
  specs <- .sm_mb_normalize_survey_specs(specs)
  canon <- .sm_mb_canonical_inst(sid, canonical_file_id)
  audit <- sm_multibase_audit(specs, token, canonical_inst = canon$inst)
  if (!isTRUE(audit$ok)) {
    stop_api(409, "E_SM_MULTIBASE_BLOCKED", "Hay diferencias bloqueantes antes de importar.")
  }
  unsupported_variants <- Filter(function(x) identical(x$kind, "options_variant"), audit$diffs %||% list())
  if (length(unsupported_variants)) {
    stop_api(409, "E_SM_MULTIBASE_VARIANTS_UNSUPPORTED", "Hay categorias distintas por origen; importa desde el flujo multi integrado.")
  }
  company_vars <- unlist(audit$company_variables %||% list(), use.names = FALSE)

  downloads_dir <- file.path(session_get(sid)$dir, "downloads")
  dir.create(downloads_dir, recursive = TRUE, showWarnings = FALSE)
  inst_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_survey_monkey_multibase.xlsx"))
  .sm_mb_write_instrument_xlsx(canon$path, inst_path, company_vars = company_vars, wording_decisions = wording_decisions)
  inst_bytes <- readBin(inst_path, what = "raw", n = file.info(inst_path)$size)
  inst_meta <- save_upload(sid, "xlsform", "survey_monkey_multibase_instrumento.xlsx", inst_bytes)
  rp_inst <- reporte_instrumento(path = inst_meta$path)

  dfs <- list()
  fetched <- .sm_mb_fetch_family(specs, token)
  summaries_by_id <- setNames(fetched$summaries, vapply(fetched$summaries, `[[`, character(1), "survey_id"))
  for (spec in specs) {
    details <- fetched$details[[spec$survey_id]]
    summary <- summaries_by_id[[spec$survey_id]]
    pais <- .sm_mb_scalar(spec$pais, summary$pais %||% "")
    title <- .sm_mb_scalar(summary$title, spec$label %||% spec$survey_id)
    if (nzchar(spec$data_file_id)) {
      df <- .sm_mb_read_upload_data(
        sid = sid, file_id = spec$data_file_id, details = details, inst = rp_inst,
        survey_id = spec$survey_id, pais = pais, source_title = title,
        company_vars = company_vars
      )
    } else {
      payload <- sm_api_fetch_all_responses_bulk(spec$survey_id, token)
      df <- sm_multibase_api_responses_to_canonical_data(
        details = details,
        responses = payload$data,
        inst = rp_inst,
        survey_id = spec$survey_id,
        pais = pais,
        source_title = title,
        company_vars = company_vars
      )
    }
    dfs[[length(dfs) + 1L]] <- df
  }
  source_filters <- Filter(
    Negate(is.null),
    lapply(dfs, function(df) attr(df, "sm_response_filter", exact = TRUE))
  )
  data_df <- .sm_mb_bind_rows(dfs)
  if (!nrow(data_df)) stop_api(409, "E_SM_NO_RESPONSES", "No hay respuestas para importar.")
  data_df <- normalize_data_for_xlsform(data_df, rp_inst)
  .carga_assert_data_xlsform_compatible(data_df, rp_inst)

  data_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_survey_monkey_multibase_data.xlsx"))
  .sm_mb_write_xlsx(data_df, data_path)
  data_bytes <- readBin(data_path, what = "raw", n = file.info(data_path)$size)
  data_meta <- save_upload(sid, "data", "survey_monkey_multibase_data.xlsx", data_bytes)
  rp_data <- reporte_data(data_df, instrumento = rp_inst)

  nombre <- .sm_mb_slug(base_name)
  if (!nzchar(nombre)) nombre <- "surveymonkey_multibase"
  if (nombre %in% names(estudio_list_bases(sid))) {
    base0 <- nombre
    idx <- 2L
    repeat {
      candidate <- paste0(base0, "_", idx)
      if (!(candidate %in% names(estudio_list_bases(sid)))) {
        nombre <- candidate
        break
      }
      idx <- idx + 1L
    }
  }
  base_meta <- estudio_add_base(
    sid,
    nombre = nombre,
    xlsform_file_id = inst_meta$file_id,
    data_file_id = data_meta$file_id,
    data_ext = "xlsx",
    rp_data = rp_data,
    rp_inst = rp_inst,
    n_filas = as.integer(nrow(data_df)),
    n_columnas = as.integer(ncol(data_df))
  )
  session_set(sid, "analitica_prep_ok", TRUE)
  session_set(sid, "analitica_fuente", sprintf("estudio:%s", nombre))

  list(
    ok = TRUE,
    base = .estudio_base_payload(base_meta),
    estudio = .estudio_payload(sid),
    audit = audit,
    source_filters = source_filters,
    n_filas = as.integer(nrow(data_df)),
    n_columnas = as.integer(ncol(data_df))
  )
}

mount_surveymonkey_multibase <- function(pr) {
  pr |>
    plumber::pr_post("/api/surveymonkey/multibase/surveys", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      parsed <- .xlsform_editor_parse_body(req)
      token <- prosecnur_secret_load("sm_token")
      if (is.na(token) || !nzchar(token)) stop_api(400, "E_SM_TOKEN", "Falta token SurveyMonkey guardado.")
      sm_multibase_list_surveys(
        token,
        q = .sm_mb_scalar(parsed$q, ""),
        limit = suppressWarnings(as.integer(parsed$limit %||% 200L)),
        months = suppressWarnings(as.integer(parsed$months %||% 6L))
      )
    })) |>
    plumber::pr_post("/api/surveymonkey/multibase/audit", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      parsed <- .xlsform_editor_parse_body(req)
      token <- prosecnur_secret_load("sm_token")
      if (is.na(token) || !nzchar(token)) stop_api(400, "E_SM_TOKEN", "Falta token SurveyMonkey guardado.")
      canonical_file_id <- .sm_mb_scalar(parsed$canonical_xlsform_file_id, "")
      canon <- tryCatch(.sm_mb_canonical_inst(sid, canonical_file_id), error = function(e) NULL)
      specs <- .sm_mb_normalize_survey_specs(parsed$surveys %||% list())
      out <- sm_multibase_audit(specs, token, canonical_inst = canon$inst %||% NULL)
      out
    })) |>
    plumber::pr_post("/api/surveymonkey/multibase/import", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      parsed <- .xlsform_editor_parse_body(req)
      token <- prosecnur_secret_load("sm_token")
      if (is.na(token) || !nzchar(token)) stop_api(400, "E_SM_TOKEN", "Falta token SurveyMonkey guardado.")
      sm_multibase_import(
        sid = sid,
        specs = parsed$surveys %||% list(),
        token = token,
        canonical_file_id = .sm_mb_scalar(parsed$canonical_xlsform_file_id, ""),
        base_name = .sm_mb_scalar(parsed$base_name, "surveymonkey_multibase"),
        wording_decisions = parsed$wording_decisions %||% list()
      )
    }))
}
