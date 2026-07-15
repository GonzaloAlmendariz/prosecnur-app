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
  x <- if (requireNamespace("stringi", quietly = TRUE)) {
    stringi::stri_trans_general(x, "Latin-ASCII")
  } else {
    iconv(x, from = "", to = "ASCII//TRANSLIT", sub = "")
  }
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

.sm_mb_char_vector <- function(x) {
  if (is.null(x)) return(character(0))
  if (is.list(x)) x <- unlist(x, use.names = FALSE)
  x <- trimws(as.character(x))
  x[!is.na(x) & nzchar(x)]
}

.sm_mb_nullable_bool <- function(x) {
  if (is.null(x) || length(x) == 0L) return(NULL)
  isTRUE(x)
}

.sm_mb_collection_strategy <- function(x, fallback = "") {
  raw <- .sm_mb_scalar(
    x$collection_strategy %||% x$collectionStrategy %||% x$recojo %||% x$collection_mode_label %||% fallback,
    ""
  )
  norm <- gsub("[^a-z0-9]+", "_", .sm_mb_norm(raw))
  norm <- gsub("^_+|_+$", "", norm)
  if (!nzchar(norm)) return("")
  aliases <- c(
    campo = "campo",
    field = "campo",
    presencial = "campo",
    whatsapp = "whatsapp_link",
    whatsapp_link = "whatsapp_link",
    link_whatsapp = "whatsapp_link",
    web = "web_link",
    web_link = "web_link",
    weblink = "web_link",
    enlace_web = "web_link",
    email = "email",
    correo = "email",
    correo_electronico = "email",
    otro = "otro",
    other = "otro"
  )
  aliases[[norm]] %||% norm
}

.sm_mb_source_channel <- function(x, fallback = "") {
  raw <- .sm_mb_scalar(
    x$channel %||% x$canal %||% x$source_channel %||% x$collection_channel %||% fallback,
    ""
  )
  norm <- .sm_mb_norm(raw)
  if (!nzchar(norm)) {
    strategy <- .sm_mb_norm(x$collection_strategy %||% x$strategy %||% "")
    if (grepl("email|correo|web|online|link|enlace", strategy)) return("Correo")
    if (grepl("whatsapp", strategy)) return("WhatsApp")
    if (grepl("\\bsms\\b", strategy)) return("SMS")
    if (grepl("campo|telefon", strategy)) return("Telefónico")
    return("")
  }
  if (grepl("telefon", norm)) return("Telefónico")
  if (grepl("whatsapp", norm)) return("WhatsApp")
  if (grepl("\\bsms\\b", norm)) return("SMS")
  if (grepl("presencial|\\bqr\\b|ficha", norm)) return("Ficha QR")
  if (grepl("correo|email|mail|web|online|link|enlace", norm)) return("Correo")
  if (grepl("mixto|multicanal|multi canal", norm)) return("Mixto")
  .sm_mb_trim(raw)
}

.sm_mb_validation_exclusion_profile <- function(x, collection_strategy = "") {
  raw <- .sm_mb_scalar(x$validation_exclusion_profile %||% x$exclusion_profile %||% "", "")
  if (nzchar(raw)) return(raw)
  if (identical(collection_strategy, "whatsapp_link")) "admin_autoadministrado" else ""
}

.sm_mb_consent_from_spec <- function(x, fallback = list()) {
  .sm_mb_scalar(
    x$consent_var %||% x$consentimiento_var %||% x$consent_question %||%
      fallback$consent_var %||% fallback$consentimiento_var %||% fallback$consent_question,
    ""
  )
}

.sm_mb_normalize_source_spec <- function(x, fallback = list()) {
  x <- x %||% list()
  survey_id <- .sm_mb_scalar(x$survey_id %||% x$id %||% fallback$survey_id, "")
  if (!nzchar(survey_id)) stop_api(400, "E_SM_SURVEY_ID", "Cada fuente SurveyMonkey necesita survey_id.")
  collector_ids <- unique(c(
    .sm_mb_char_vector(x$collector_ids),
    .sm_mb_char_vector(x$collector_id)
  ))
  collection_strategy <- .sm_mb_collection_strategy(x, fallback$collection_strategy %||% "")
  channel <- .sm_mb_source_channel(x, fallback$channel %||% fallback$source_channel %||% "")
  validation_exclusion_profile <- .sm_mb_scalar(
    x$validation_exclusion_profile %||% x$exclusion_profile %||% fallback$validation_exclusion_profile,
    ""
  )
  if (!nzchar(validation_exclusion_profile)) {
    validation_exclusion_profile <- .sm_mb_validation_exclusion_profile(x, collection_strategy)
  }
  list(
    survey_id = survey_id,
    pais = .sm_mb_trim(x$pais %||% x$country %||% fallback$pais),
    label = .sm_mb_scalar(x$label %||% x$title %||% fallback$label, ""),
    source_alias = .sm_mb_scalar(x$source_alias %||% x$alias %||% x$label %||% fallback$source_alias %||% fallback$label, ""),
    source_title = .sm_mb_scalar(x$source_title %||% x$title %||% fallback$source_title, ""),
    data_file_id = .sm_mb_scalar(x$data_file_id %||% fallback$data_file_id, ""),
    collection_strategy = collection_strategy,
    channel = channel,
    source_channel = channel,
    consent_var = .sm_mb_consent_from_spec(x, fallback),
    validation_exclusion_profile = validation_exclusion_profile,
    excluded_validation_vars = as.list(.sm_mb_char_vector(x$excluded_validation_vars %||% x$excluded_vars)),
    response_statuses = .sm_mb_char_vector(x$response_statuses %||% x$statuses %||% x$response_status),
    keep_missing_status = .sm_mb_nullable_bool(x$keep_missing_status %||% fallback$keep_missing_status),
    collector_ids = collector_ids,
    date_modified_gte = .sm_mb_scalar(
      x$date_modified_gte %||% x$date_modified_min %||% x$modified_after %||% x$since %||%
        fallback$date_modified_gte,
      ""
    ),
    date_modified_lte = .sm_mb_scalar(
      x$date_modified_lte %||% x$date_modified_max %||% x$modified_before %||% x$until %||%
        x$cutoff %||% fallback$date_modified_lte,
      ""
    )
  )
}

.sm_mb_normalize_survey_specs <- function(items) {
  if (is.null(items) || !length(items)) return(list())
  lapply(seq_along(items), function(i) {
    x <- items[[i]]
    survey_id <- .sm_mb_scalar(x$survey_id %||% x$id, "")
    pais <- .sm_mb_trim(x$pais %||% x$country)
    label <- .sm_mb_scalar(x$label %||% x$alias %||% x$source_alias %||% x$title, "")
    source_alias <- .sm_mb_scalar(x$source_alias %||% x$alias %||% label, "")
    source_title <- .sm_mb_scalar(x$source_title %||% x$title, "")
    data_file_id <- .sm_mb_scalar(x$data_file_id, "")
    collection_strategy <- .sm_mb_collection_strategy(x)
    channel <- .sm_mb_source_channel(x)
    consent_var <- .sm_mb_consent_from_spec(x)
    validation_exclusion_profile <- .sm_mb_validation_exclusion_profile(x, collection_strategy)
    if (!nzchar(survey_id)) stop_api(400, "E_SM_SURVEY_ID", "Cada encuesta necesita survey_id.")
    spec <- list(
      survey_id = survey_id,
      pais = pais,
      label = label,
      source_alias = source_alias,
      source_title = source_title,
      data_file_id = data_file_id,
      collection_strategy = collection_strategy,
      channel = channel,
      source_channel = channel,
      consent_var = consent_var,
      validation_exclusion_profile = validation_exclusion_profile,
      excluded_validation_vars = as.list(.sm_mb_char_vector(x$excluded_validation_vars %||% x$excluded_vars)),
      response_statuses = .sm_mb_char_vector(x$response_statuses %||% x$statuses %||% x$response_status),
      keep_missing_status = .sm_mb_nullable_bool(x$keep_missing_status),
      collector_ids = unique(c(.sm_mb_char_vector(x$collector_ids), .sm_mb_char_vector(x$collector_id))),
      date_modified_gte = .sm_mb_scalar(
        x$date_modified_gte %||% x$date_modified_min %||% x$modified_after %||% x$since,
        ""
      ),
      date_modified_lte = .sm_mb_scalar(
        x$date_modified_lte %||% x$date_modified_max %||% x$modified_before %||% x$until %||% x$cutoff,
        ""
      )
    )
    source_items <- x$sources %||% x$campaigns %||% list()
    spec$sources <- if (length(source_items)) {
      lapply(source_items, .sm_mb_normalize_source_spec, fallback = spec)
    } else {
      list(.sm_mb_normalize_source_spec(spec, fallback = spec))
    }
    spec
  })
}

.sm_mb_logic_pages <- function(x) {
  if (is.null(x) || !length(x)) return(NULL)
  if (is.data.frame(x)) return(NULL)
  out <- lapply(x, function(qs) as.character(unlist(qs, use.names = FALSE)))
  names(out) <- as.character(names(x))
  out <- out[nzchar(names(out))]
  out
}

.sm_mb_logic_choice_order_overrides <- function(x) {
  if (is.null(x) || !length(x)) return(NULL)
  if (is.data.frame(x)) return(NULL)
  out <- lapply(x, function(labels) as.character(unlist(labels, use.names = FALSE)))
  names(out) <- as.character(names(x))
  out <- out[nzchar(names(out))]
  out
}

.sm_mb_logic_rules_by_survey <- function(x) {
  if (is.null(x) || !length(x)) return(list())
  out <- list()
  if (is.data.frame(x)) {
    if (!all(c("survey_id", "rules") %in% names(x))) return(list())
    for (i in seq_len(nrow(x))) {
      sid <- .sm_mb_scalar(x$survey_id[[i]], "")
      rules <- .sm_mb_scalar(x$rules[[i]], "")
      if (nzchar(sid) && nzchar(trimws(rules))) out[[sid]] <- rules
    }
    return(out)
  }
  if (!is.null(names(x)) && any(nzchar(names(x)))) {
    for (nm in names(x)) {
      sid <- .sm_mb_scalar(nm, "")
      rules <- .sm_mb_scalar(x[[nm]], "")
      if (nzchar(sid) && nzchar(trimws(rules))) out[[sid]] <- rules
    }
    return(out)
  }
  if (is.list(x)) {
    for (item in x) {
      sid <- .sm_mb_scalar(item$survey_id %||% item$id, "")
      rules <- .sm_mb_scalar(item$rules %||% item$logic_rules %||% item$reglas, "")
      if (nzchar(sid) && nzchar(trimws(rules))) out[[sid]] <- rules
    }
  }
  out
}

.sm_mb_canonical_inst <- function(sid, file_id = "") {
  if (nzchar(file_id)) {
    meta <- get_file(sid, file_id)
    return(list(path = meta$path, inst = reporte_instrumento(path = meta$path), meta = meta))
  }
  s <- session_get(sid)
  current_inst <- s$instrumento %||% NULL
  if (is.list(current_inst) &&
      is.data.frame(current_inst$survey) &&
      "name" %in% names(current_inst$survey)) {
    return(list(
      path = "",
      inst = current_inst,
      meta = list(
        file_id = "",
        kind = "xlsform_session",
        original_name = "XLSForm cargado en Carga/Editor"
      )
    ))
  }
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

.sm_mb_admin_autoadmin_label_targets <- function() {
  c(
    "codigo pulso",
    "carrera del egresado",
    "celular del egresado",
    "enumerador"
  )
}

.sm_mb_admin_autoadmin_positions_from_table <- function(tbl) {
  if (is.null(tbl) || !is.data.frame(tbl) || !nrow(tbl) || !"heading" %in% names(tbl)) {
    return(integer(0))
  }
  hit <- which(.sm_mb_norm(tbl$heading) %in% .sm_mb_admin_autoadmin_label_targets())
  as.integer(hit[!is.na(hit)])
}

.sm_mb_excluded_positions_from_source <- function(source_spec, ref_tbl) {
  explicit <- .sm_mb_char_vector(source_spec$excluded_validation_vars %||% source_spec$excluded_vars)
  explicit_pos <- suppressWarnings(as.integer(sub("^p", "", explicit[grepl("^p[0-9]+$", explicit)])))
  metadata_pos <- .sm_mb_admin_autoadmin_positions_from_table(ref_tbl)
  profile <- .sm_mb_scalar(
    source_spec$validation_exclusion_profile %||%
      .sm_mb_validation_exclusion_profile(source_spec, source_spec$collection_strategy %||% ""),
    ""
  )
  profile_pos <- if (identical(profile, "admin_autoadministrado")) {
    metadata_pos
  } else {
    integer(0)
  }
  unique(c(explicit_pos[is.finite(explicit_pos)], metadata_pos, profile_pos))
}

.sm_mb_metadata_optional_diff <- function(ref, cur, pos) {
  list(
    pos = as.integer(pos),
    variable = paste0("p", pos),
    severity = "review",
    kind = "metadata_optional",
    message = "Campo administrativo/metadata ausente o distinto en esta fuente; no bloquea la fusion.",
    ref = if (!is.null(ref) && pos <= nrow(ref)) .sm_mb_scalar(ref$heading[pos], "") else "",
    current = if (!is.null(cur) && pos <= nrow(cur)) .sm_mb_scalar(cur$heading[pos], "") else "",
    optional_metadata = TRUE
  )
}

.sm_mb_compare_to_ref <- function(ref, cur, company_positions = integer(), ignorable_missing_positions = integer()) {
  n <- max(nrow(ref), nrow(cur))
  out <- list()
  ignorable_missing_positions <- unique(suppressWarnings(as.integer(ignorable_missing_positions)))
  ignorable_missing_positions <- ignorable_missing_positions[is.finite(ignorable_missing_positions)]
  for (i in seq_len(n)) {
    if (i > nrow(ref) || i > nrow(cur)) {
      if (i > nrow(cur) && i <= nrow(ref) && i %in% ignorable_missing_positions) {
        out[[length(out) + 1L]] <- .sm_mb_metadata_optional_diff(ref, cur, i)
        next
      }
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

    if (i %in% ignorable_missing_positions && (hard || choice_diff || row_text_diff || heading_diff)) {
      out[[length(out) + 1L]] <- .sm_mb_metadata_optional_diff(ref, cur, i)
      next
    }

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

.sm_mb_preview_rows <- function(df, limit = 5L) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(list())
  limit <- max(1L, min(as.integer(limit %||% 5L), nrow(df)))
  df <- utils::head(df, limit)
  lapply(seq_len(nrow(df)), function(i) {
    row <- as.list(df[i, , drop = FALSE])
    lapply(row, function(value) {
      value <- as.character(value)[1]
      if (is.na(value)) "" else value
    })
  })
}

.sm_mb_preview_columns <- function(df) {
  if (is.null(df) || !is.data.frame(df) || !length(names(df))) return(list())
  lapply(names(df), function(nm) {
    values <- as.character(df[[nm]])
    values <- values[!is.na(values) & nzchar(values)]
    list(
      name = nm,
      non_empty = as.integer(length(values)),
      examples = as.list(utils::head(unique(values), 3L))
    )
  })
}

.sm_mb_inspect_questions <- function(tbl, limit = 80L) {
  if (is.null(tbl) || !is.data.frame(tbl) || !nrow(tbl)) return(list())
  limit <- max(1L, min(as.integer(limit %||% 80L), nrow(tbl)))
  tbl <- utils::head(tbl, limit)
  lapply(seq_len(nrow(tbl)), function(i) {
    row <- tbl[i, , drop = FALSE]
    list(
      pos = as.integer(row$pos),
      page = as.integer(row$page),
      qid = .sm_mb_scalar(row$qid, ""),
      family = .sm_mb_scalar(row$family, ""),
      subtype = .sm_mb_scalar(row$subtype, ""),
      heading = .sm_mb_trim(row$heading),
      n_choices = as.integer(row$n_choices),
      n_rows = as.integer(row$n_rows),
      n_cols = as.integer(row$n_cols)
    )
  })
}

.sm_mb_inspect_pages <- function(details) {
  pages <- sm_api_extract_pages(details, style = .sm_api_default_style())
  lapply(pages, function(page) {
    list(
      page_id = .sm_mb_scalar(page$page_id, ""),
      title = .sm_mb_trim(page$title %||% page$label %||% ""),
      range_label = .sm_mb_scalar(page$range_label, ""),
      question_count = as.integer(page$question_count %||% length(page$questions %||% list()))
    )
  })
}

sm_multibase_inspect_survey <- function(survey_id,
                                        token,
                                        base_url = "https://api.surveymonkey.com/v3",
                                        response_limit = 5L) {
  survey_id <- .sm_mb_scalar(survey_id, "")
  if (!nzchar(survey_id)) stop_api(400, "E_SM_SURVEY_ID", "Falta survey_id.")
  response_limit <- suppressWarnings(as.integer(response_limit %||% 5L))
  if (is.na(response_limit)) response_limit <- 5L
  response_limit <- max(1L, min(response_limit, 20L))

  details <- sm_api_fetch_survey_details(survey_id, token, base_url = base_url)
  summary <- sm_api_summary(details)
  tbl <- .sm_mb_question_table(details)
  probe <- tryCatch(
    sm_api_fetch_responses_bulk(survey_id, token, page = 1L, per_page = response_limit, base_url = base_url),
    error = function(e) list(total = NA_integer_, data = list(), error = conditionMessage(e))
  )
  has_response_scope <- is.null(probe$error)
  data <- if (has_response_scope) {
    sm_api_flatten_responses(details, probe$data %||% list())
  } else {
    data.frame()
  }
  total <- suppressWarnings(as.integer(probe$total %||% NA_integer_))

  list(
    ok = TRUE,
    survey_id = survey_id,
    title = .sm_mb_trim(details$title %||% summary$title %||% survey_id),
    language = .sm_mb_scalar(summary$language, ""),
    n_pages = as.integer(summary$n_paginas %||% length(details$pages %||% list())),
    n_questions = as.integer(summary$n_preguntas %||% nrow(tbl)),
    n_required = as.integer(summary$n_required %||% 0L),
    n_validation = as.integer(summary$n_validation %||% 0L),
    pages = .sm_mb_inspect_pages(details),
    questions = .sm_mb_inspect_questions(tbl),
    responses = list(
      available = has_response_scope,
      total = if (is.na(total)) NA_integer_ else total,
      returned = as.integer(nrow(data)),
      error = .sm_mb_scalar(probe$error, "")
    ),
    columns = .sm_mb_preview_columns(data),
    sample_rows = .sm_mb_preview_rows(data, limit = min(response_limit, 5L))
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

.sm_mb_survey_catalog_get <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(NULL)
  cache <- s$surveymonkey_survey_catalog %||% NULL
  if (!is.list(cache) || !is.list(cache$surveys)) return(NULL)
  cache
}

.sm_mb_survey_catalog_set <- function(sid, surveys) {
  if (is.null(sid) || !nzchar(as.character(sid))) return(invisible(NULL))
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(invisible(NULL))
  fetched_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  s$surveymonkey_survey_catalog <- list(
    version = 1L,
    source = "surveymonkey",
    fetched_at = fetched_at,
    total_visible = as.integer(length(surveys)),
    surveys = surveys
  )
  .session_env[[sid]] <- s
  invisible(s$surveymonkey_survey_catalog)
}

.sm_mb_survey_catalog_age_seconds <- function(cache) {
  fetched_at <- as.character(cache$fetched_at %||% "")
  if (!nzchar(fetched_at)) return(NA_integer_)
  dt <- .sm_api_parse_time(fetched_at)
  if (is.na(dt)) return(NA_integer_)
  as.integer(max(0, difftime(Sys.time(), dt, units = "secs")))
}

.sm_mb_stop_catalog_api_error <- function(err) {
  if (inherits(err, "api_error")) stop(err)
  message <- conditionMessage(err)
  if (grepl("Token rechazado|HTTP 401", message, ignore.case = TRUE)) {
    stop_api(401, "E_SM_TOKEN", message)
  }
  if (grepl("timeout|timed out|time-out|Timeout was reached|Operation timed out", message, ignore.case = TRUE)) {
    stop_api(
      504,
      "E_SM_TIMEOUT",
      "SurveyMonkey no respondio dentro del tiempo de espera. Revisa tu conexion y vuelve a buscar."
    )
  }
  stop_api(400, "E_SM_SURVEY_CATALOG", message)
}

sm_multibase_list_surveys <- function(token, q = "", limit = 200L, months = 6L,
                                      sid = NULL, force_refresh = FALSE) {
  limit <- suppressWarnings(as.integer(limit %||% 200L))
  if (is.na(limit) || limit < 1L) limit <- 200L
  limit <- min(limit, 1000L)
  months <- suppressWarnings(as.integer(months %||% 6L))
  if (is.na(months) || months < 1L) months <- 6L

  existing_cache <- if (!is.null(sid)) .sm_mb_survey_catalog_get(sid) else NULL
  cache <- if (!isTRUE(force_refresh)) existing_cache else NULL
  from_cache <- !is.null(cache)
  refresh_error <- ""
  refresh_failed <- FALSE
  if (from_cache) {
    surveys <- cache$surveys
  } else {
    fetched <- tryCatch(
      sm_api_list_surveys(token, per_page = 1000L),
      error = function(e) {
        refresh_error <<- conditionMessage(e)
        refresh_failed <<- TRUE
        NULL
      }
    )
    if (is.null(fetched)) {
      if (!is.null(existing_cache)) {
        cache <- existing_cache
        surveys <- cache$surveys
        from_cache <- TRUE
      } else {
        stop(refresh_error, call. = FALSE)
      }
    } else {
      surveys <- fetched
      if (!is.null(sid)) cache <- .sm_mb_survey_catalog_set(sid, surveys)
    }
  }
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
    from_cache = isTRUE(from_cache),
    cache_status = if (isTRUE(refresh_failed) && from_cache) "stale_fallback" else if (isTRUE(force_refresh)) "refreshed" else if (from_cache) "hit" else "miss",
    refresh_error = refresh_error,
    catalog_fetched_at = as.character((cache %||% list())$fetched_at %||% NA_character_),
    catalog_age_seconds = .sm_mb_survey_catalog_age_seconds(cache %||% list()),
    catalog_count = as.integer(total),
    total_visible = as.integer(total),
    total_recent = as.integer(total_recent),
    months = as.integer(months),
    count = length(surveys),
    surveys = surveys
  )
}

sm_multibase_collectors <- function(survey_id,
                                    token,
                                    base_url = "https://api.surveymonkey.com/v3") {
  survey_id <- .sm_mb_scalar(survey_id, "")
  if (!nzchar(survey_id)) stop_api(400, "E_SM_SURVEY_ID", "Falta survey_id.")
  collectors <- sm_api_fetch_collectors(
    survey_id = survey_id,
    token = token,
    base_url = base_url
  )
  rows <- lapply(collectors$data %||% list(), function(item) {
    collector_id <- .sm_mb_scalar(item$id %||% item$collector_id, "")
    response_count <- suppressWarnings(as.integer(item$response_count %||% item$num_responses %||% NA_integer_))
    list(
      id = collector_id,
      name = .sm_mb_scalar(item$name %||% item$title %||% item$collector_name, collector_id),
      type = .sm_mb_scalar(item$type %||% item$collector_type, ""),
      response_count = if (is.finite(response_count)) response_count else NA_integer_,
      date_created = .sm_mb_scalar(item$date_created, ""),
      date_modified = .sm_mb_scalar(item$date_modified, "")
    )
  })
  list(
    ok = TRUE,
    survey_id = survey_id,
    total = suppressWarnings(as.integer(collectors$total %||% length(rows))),
    collectors = rows
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

.sm_mb_parse_time <- function(x) {
  x <- .sm_mb_scalar(x, "")
  if (!nzchar(x)) return(as.POSIXct(NA))
  candidates <- unique(c(
    x,
    sub("Z$", "+0000", x),
    sub("([+-][0-9]{2}):([0-9]{2})$", "\\1\\2", x, perl = TRUE)
  ))
  fmts <- c(
    "%Y-%m-%dT%H:%M:%OS%z",
    "%Y-%m-%dT%H:%M:%S%z",
    "%Y-%m-%dT%H:%M:%OSZ",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%d %H:%M:%OS",
    "%Y-%m-%d %H:%M:%S"
  )
  for (candidate in candidates) {
    for (fmt in fmts) {
      out <- suppressWarnings(as.POSIXct(candidate, format = fmt, tz = "UTC"))
      if (!is.na(out)) return(out)
    }
  }
  if (exists(".sm_api_parse_time", mode = "function")) return(.sm_api_parse_time(x))
  suppressWarnings(as.POSIXct(x, tz = "UTC"))
}

.sm_mb_response_count_map <- function(responses, field) {
  responses <- responses %||% list()
  if (!length(responses)) return(list())
  values <- vapply(responses, function(resp) {
    val <- .sm_mb_scalar(resp[[field]], "")
    if (nzchar(val)) val else "(vacio)"
  }, character(1))
  tab <- sort(table(values), decreasing = TRUE)
  out <- as.list(as.integer(tab))
  names(out) <- names(tab)
  out
}

.sm_mb_response_custom_metadata <- function(resp) {
  out <- list(
    recipient_id = .sm_mb_scalar(resp$recipient_id %||% NA_character_),
    custom_value = .sm_mb_scalar(resp$custom_value %||% NA_character_),
    total_time = .sm_mb_scalar(resp$total_time %||% NA_character_),
    ip_address = .sm_mb_scalar(resp$ip_address %||% NA_character_)
  )
  custom <- resp$custom_variables %||% list()
  if (length(custom)) {
    for (nm in names(custom)) {
      safe <- if (exists(".sm_api_safe_name", mode = "function")) {
        .sm_api_safe_name(nm)
      } else {
        gsub("[^A-Za-z0-9_]+", "_", tolower(as.character(nm)))
      }
      out[[paste0("cv_", safe)]] <- .sm_mb_scalar(custom[[nm]] %||% NA_character_)
    }
  }
  out
}

.sm_mb_filter_responses <- function(responses,
                                    statuses = c("completed"),
                                    keep_missing_status = TRUE,
                                    collector_ids = character(),
                                    date_modified_gte = "",
                                    date_modified_lte = "") {
  responses <- responses %||% list()
  original_n <- length(responses)
  statuses <- tolower(trimws(as.character(statuses %||% c("completed"))))
  statuses <- statuses[!is.na(statuses) & nzchar(statuses)]
  collector_ids <- unique(.sm_mb_char_vector(collector_ids))
  date_modified_gte <- .sm_mb_scalar(date_modified_gte, "")
  date_modified_lte <- .sm_mb_scalar(date_modified_lte, "")
  gte_ts <- .sm_mb_parse_time(date_modified_gte)
  lte_ts <- .sm_mb_parse_time(date_modified_lte)
  filter_info <- list(
    kind = "surveymonkey_response_filter",
    statuses = as.list(statuses),
    keep_missing_status = isTRUE(keep_missing_status),
    collector_ids = as.list(collector_ids),
    date_modified_gte = if (nzchar(date_modified_gte)) date_modified_gte else NA_character_,
    date_modified_lte = if (nzchar(date_modified_lte)) date_modified_lte else NA_character_,
    original_rows = as.integer(original_n),
    kept_rows = as.integer(original_n),
    excluded_rows = 0L,
    original_status_counts = .sm_mb_response_count_map(responses, "response_status"),
    original_collector_counts = .sm_mb_response_count_map(responses, "collector_id")
  )
  status_all <- !length(statuses) || any(statuses %in% c("all", "*"))
  has_collector_filter <- length(collector_ids) > 0L
  has_gte <- nzchar(date_modified_gte) && !is.na(gte_ts)
  has_lte <- nzchar(date_modified_lte) && !is.na(lte_ts)
  if (!original_n || (status_all && !has_collector_filter && !has_gte && !has_lte)) {
    filter_info$kept_status_counts <- filter_info$original_status_counts
    filter_info$kept_collector_counts <- filter_info$original_collector_counts
    return(structure(responses, sm_response_filter = filter_info))
  }

  keep <- vapply(responses, function(resp) {
    st <- tolower(trimws(.sm_mb_scalar(resp$response_status, "")))
    status_ok <- if (status_all) {
      TRUE
    } else if (!nzchar(st)) {
      isTRUE(keep_missing_status)
    } else {
      st %in% statuses
    }
    if (!status_ok) return(FALSE)
    if (has_collector_filter) {
      collector <- .sm_mb_scalar(resp$collector_id, "")
      if (!(collector %in% collector_ids)) return(FALSE)
    }
    if (has_gte || has_lte) {
      modified <- .sm_mb_scalar(resp$date_modified %||% resp$date_created, "")
      modified_ts <- .sm_mb_parse_time(modified)
      if (is.na(modified_ts)) return(FALSE)
      if (has_gte && modified_ts < gte_ts) return(FALSE)
      if (has_lte && modified_ts > lte_ts) return(FALSE)
    }
    TRUE
  }, logical(1))
  out <- responses[keep]
  filter_info$kept_rows <- as.integer(length(out))
  filter_info$excluded_rows <- as.integer(original_n - length(out))
  filter_info$kept_status_counts <- .sm_mb_response_count_map(out, "response_status")
  filter_info$kept_collector_counts <- .sm_mb_response_count_map(out, "collector_id")
  structure(out, sm_response_filter = filter_info)
}

.sm_mb_filter_responses_by_status <- function(responses,
                                              statuses = c("completed"),
                                              keep_missing = TRUE) {
  .sm_mb_filter_responses(
    responses,
    statuses = statuses,
    keep_missing_status = keep_missing
  )
}

.sm_mb_count_values <- function(values) {
  values <- as.character(values %||% character(0))
  values[is.na(values) | !nzchar(trimws(values))] <- "(vacio)"
  tab <- sort(table(values), decreasing = TRUE)
  out <- as.list(as.integer(tab))
  names(out) <- names(tab)
  out
}

.sm_mb_question_rows <- function(inst) {
  survey <- inst$survey
  if (is.null(survey) || !is.data.frame(survey) || !nrow(survey) || !"name" %in% names(survey)) {
    return(data.frame())
  }
  type <- .sm_mb_type_base(survey$type)
  name <- as.character(survey$name)
  keep <- !is.na(name) & nzchar(name) & !(type %in% .sm_mb_non_question_types)
  survey[keep, , drop = FALSE]
}

.sm_mb_consent_var <- function(inst, configured = "") {
  questions <- .sm_mb_question_rows(inst)
  if (is.null(questions) || !nrow(questions)) return("")
  configured <- .sm_mb_scalar(configured, "")
  q_names <- as.character(questions$name %||% "")
  if (nzchar(configured)) {
    exact <- which(q_names == configured)[1]
    if (!is.na(exact)) return(configured)
    folded <- which(tolower(q_names) == tolower(configured))[1]
    if (!is.na(folded)) return(q_names[folded])
    return("")
  }
  .sm_mb_consent_candidate_var(inst)
}

.sm_mb_consent_yes <- function(values) {
  key <- .sm_mb_norm(values)
  key %in% c("1", "si", "sí", "yes", "true", "acepta", "acepto", "accepted", "y")
}

.sm_mb_consent_candidate_score <- function(name, label, type = "") {
  nm <- .sm_mb_norm(name)
  lab <- .sm_mb_norm(label)
  typ <- .sm_mb_norm(type)
  text <- paste(nm, lab)
  if (!grepl("^select one|select_one|select$", typ) && !grepl("^p[0-9]+$", nm)) return(0L)
  if (grepl("actividades|vinculacion|gustaria participar|participar con la carrera", lab) &&
      !grepl("consent|consentimiento|continuar|encuesta|entrevista", lab)) {
    return(0L)
  }
  if (grepl("consent|consentimiento", text)) return(100L)
  if (grepl("desea continuar|continuar con la encuesta|continuar encuesta", lab)) return(95L)
  if (grepl("acepta|acepto|aceptar", lab) && grepl("participar|encuesta|entrevista|estudio", lab)) return(90L)
  if (grepl("autoriz", lab) && grepl("encuesta|entrevista|estudio", lab)) return(80L)
  0L
}

.sm_mb_consent_candidate_var <- function(inst) {
  questions <- .sm_mb_question_rows(inst)
  if (is.null(questions) || !nrow(questions)) return("")
  label_col <- .sm_mb_label_col(questions)
  labels <- if (!is.na(label_col)) questions[[label_col]] else questions$name
  scores <- vapply(seq_len(nrow(questions)), function(i) {
    .sm_mb_consent_candidate_score(questions$name[[i]], labels[[i]], questions$type[[i]])
  }, integer(1))
  if (!any(scores > 0L)) return("")
  as.character(questions$name[[which.max(scores)]])
}

.sm_mb_filter_info_apply_consent <- function(filter_info, before_values, after_values, consent_var) {
  filter_info <- filter_info %||% list()
  before_n <- length(before_values %||% character(0))
  after_n <- length(after_values %||% character(0))
  filter_info$consent_var <- .sm_mb_scalar(consent_var, "")
  filter_info$consent_required <- TRUE
  filter_info$consent_positive_values <- as.list(c("1", "si", "sí", "yes", "true", "acepta", "acepto", "accepted"))
  filter_info$original_consent_counts <- .sm_mb_count_values(before_values)
  filter_info$kept_consent_counts <- .sm_mb_count_values(after_values)
  filter_info$consent_excluded_rows <- as.integer(before_n - after_n)
  filter_info$kept_rows <- as.integer(after_n)
  original_rows <- suppressWarnings(as.integer(filter_info$original_rows %||% before_n))
  if (is.finite(original_rows)) {
    filter_info$excluded_rows <- as.integer(max(0L, original_rows - after_n))
  }
  filter_info
}

.sm_mb_filter_effective_consent_df <- function(df, inst, response_filter = NULL, consent_var = "") {
  df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  consent_var <- .sm_mb_consent_var(inst, configured = consent_var)
  if (!nzchar(consent_var) || !(consent_var %in% names(df))) {
    attr(df, "sm_response_filter") <- response_filter
    return(df)
  }
  before_values <- df[[consent_var]]
  keep <- .sm_mb_consent_yes(before_values)
  out <- df[keep, , drop = FALSE]
  response_filter <- .sm_mb_filter_info_apply_consent(
    response_filter,
    before_values = before_values,
    after_values = out[[consent_var]],
    consent_var = consent_var
  )
  if ("response_status" %in% names(out)) {
    response_filter$kept_status_counts <- .sm_mb_count_values(out$response_status)
  }
  attr(out, "sm_response_filter") <- response_filter
  out
}

.sm_mb_response_consent_value <- function(resp, details, inst, consent_var = "") {
  consent_var <- .sm_mb_consent_var(inst, configured = consent_var)
  if (!nzchar(consent_var)) return("")
  pos <- .sm_mb_question_pos_for_var(consent_var)
  if (is.na(pos) || pos < 1L) return("")
  specs <- .sm_mb_question_specs(details)
  target_id <- ""
  target_spec <- NULL
  for (qid in names(specs)) {
    if (identical(as.integer(specs[[qid]]$pos), as.integer(pos))) {
      target_id <- qid
      target_spec <- specs[[qid]]
      break
    }
  }
  if (!nzchar(target_id) || is.null(target_spec)) return("")
  for (page in resp$pages %||% list()) {
    for (question in page$questions %||% list()) {
      qid <- .sm_mb_scalar(question$id %||% question$question_id, "")
      if (!identical(qid, target_id)) next
      for (ans in question$answers %||% list()) {
        lc <- .sm_mb_answer_label_code(ans, target_spec)
        val <- if (nzchar(lc$code)) lc$code else lc$label
        if (nzchar(val)) return(val)
      }
    }
  }
  ""
}

.sm_mb_filter_raw_responses_by_consent <- function(responses, details, inst, consent_var = "") {
  consent_var <- .sm_mb_consent_var(inst, configured = consent_var)
  if (!nzchar(consent_var)) {
    return(list(responses = responses %||% list(), filter = list(consent_required = FALSE)))
  }
  responses <- responses %||% list()
  values <- vapply(
    responses,
    .sm_mb_response_consent_value,
    character(1),
    details = details,
    inst = inst,
    consent_var = consent_var
  )
  keep <- .sm_mb_consent_yes(values)
  list(
    responses = responses[keep],
    filter = list(
      consent_var = consent_var,
      consent_required = TRUE,
      consent_values_before = as.list(values),
      consent_values_after = as.list(values[keep]),
      original_consent_counts = .sm_mb_count_values(values),
      kept_consent_counts = .sm_mb_count_values(values[keep]),
      consent_excluded_rows = as.integer(sum(!keep))
    )
  )
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

.sm_mb_is_other_label <- function(x) {
  norm <- .sm_mb_norm(x)
  grepl("^(otro|otra|otros|otras|other)(\\b|$)", norm, perl = TRUE)
}

.sm_mb_other_code_for_var <- function(inst, var) {
  choices <- .sm_mb_choices_for_var(inst, var)
  if (!nrow(choices) || !"name" %in% names(choices)) return("")
  labels <- if ("label" %in% names(choices)) choices$label else choices$name
  hit <- which(.sm_mb_is_other_label(labels) | .sm_mb_is_other_label(choices$name))[1]
  if (is.na(hit)) "" else .sm_mb_scalar(choices$name[hit], "")
}

.sm_mb_admin_autoadmin_vars <- function(inst) {
  survey <- (inst %||% list())$survey
  if (is.null(survey) || !is.data.frame(survey) || !nrow(survey) || !"name" %in% names(survey)) {
    return(character(0))
  }
  lab_col <- .sm_mb_label_col(survey)
  labels <- if (!is.na(lab_col)) as.character(survey[[lab_col]]) else as.character(survey$name)
  names_raw <- as.character(survey$name)
  norm <- .sm_mb_norm(labels)
  hit <- which(norm %in% .sm_mb_admin_autoadmin_label_targets())
  unique(names_raw[hit[!is.na(hit)]])
}

.sm_mb_excluded_validation_vars <- function(source_spec, profile, inst) {
  explicit <- .sm_mb_char_vector(source_spec$excluded_validation_vars %||% source_spec$excluded_vars)
  if (length(explicit)) return(unique(explicit))
  if (identical(profile, "admin_autoadministrado")) return(.sm_mb_admin_autoadmin_vars(inst))
  character(0)
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
                                                         source_channel = "",
                                                         company_vars = character(),
                                                         response_statuses = c("completed"),
                                                         keep_missing_status = TRUE,
                                                         collector_ids = character(),
                                                         date_modified_gte = "",
                                                         date_modified_lte = "",
                                                         variant_map = list(),
                                                         consent_var = "",
                                                         apply_consent_filter = TRUE) {
  specs <- .sm_mb_question_specs(details)
  variant_lookup <- .sm_mb_variant_lookup(variant_map)
  responses <- .sm_mb_filter_responses(
    responses,
    statuses = response_statuses,
    keep_missing_status = keep_missing_status,
    collector_ids = collector_ids,
    date_modified_gte = date_modified_gte,
    date_modified_lte = date_modified_lte
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
      source_channel = .sm_mb_source_channel(list(channel = source_channel), ""),
      response_status = .sm_mb_scalar(resp$response_status, ""),
      collection_mode = .sm_mb_scalar(resp$collection_mode, ""),
      date_created = .sm_mb_scalar(resp$date_created, ""),
      date_modified = .sm_mb_scalar(resp$date_modified, "")
    )
    row <- c(row, .sm_mb_response_custom_metadata(resp))
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
              if (.sm_mb_var_exists(inst, other_var)) {
                row <- .sm_mb_set_value(row, other_var, lc$label)
                other_code <- .sm_mb_other_code_for_var(inst, parent)
                if (nzchar(other_code)) {
                  multi_tokens[[parent]] <- unique(c(multi_tokens[[parent]] %||% character(0), other_code))
                }
              }
              next
            }
            code <- .sm_mb_code_for_label(inst, parent, lc$label, lc$code)
            if (nzchar(code)) multi_tokens[[parent]] <- unique(c(multi_tokens[[parent]] %||% character(0), code))
            if (!is.null(ans$text) && nzchar(.sm_mb_trim(ans$text))) {
              other_var <- paste0(parent, "_other")
              if (.sm_mb_var_exists(inst, other_var)) {
                row <- .sm_mb_set_value(row, other_var, .sm_mb_trim(ans$text))
                other_code <- .sm_mb_other_code_for_var(inst, parent)
                if (nzchar(other_code)) {
                  multi_tokens[[parent]] <- unique(c(multi_tokens[[parent]] %||% character(0), other_code))
                }
              }
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
              other_text <- .sm_mb_trim(ans$text %||% "")
              other_var <- paste0(parent, "_other")
              other_code <- if (nzchar(other_text) && .sm_mb_var_exists(inst, other_var)) {
                .sm_mb_other_code_for_var(inst, parent)
              } else {
                ""
              }
              code <- if (nzchar(other_code)) {
                other_code
              } else {
                .sm_mb_code_for_label(inst, parent, lc$label, lc$code)
              }
              row <- .sm_mb_set_value(row, parent, code)
              if (nzchar(other_text) && .sm_mb_var_exists(inst, other_var)) {
                row <- .sm_mb_set_value(row, other_var, other_text)
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
              "case_uid", "source_title", "source_channel", "response_status", "collection_mode",
              "date_created", "date_modified", "recipient_id", "custom_value",
              "total_time", "ip_address", "decision_class",
              "decision_included", "answered_questions_count", "empresa_source_code",
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
  if (isTRUE(apply_consent_filter)) {
    df <- .sm_mb_filter_effective_consent_df(df, inst, response_filter, consent_var = consent_var)
    response_filter <- attr(df, "sm_response_filter", exact = TRUE) %||% response_filter
    attr(df, "sm_response_filter") <- response_filter
  } else {
    attr(df, "sm_response_filter") <- response_filter
  }
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

.sm_mb_read_upload_data <- function(sid, file_id, details, inst, survey_id, pais, source_title, source_channel = "", company_vars) {
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
  df$source_channel <- .sm_mb_source_channel(list(channel = source_channel), "")
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

.sm_mb_snapshot_slug <- function(x, fallback = "base") {
  out <- .sm_mb_slug(x)
  out <- gsub("[^a-z0-9_]+", "_", out)
  out <- gsub("^_+|_+$", "", out)
  if (!nzchar(out)) fallback else substr(out, 1L, 64L)
}

.sm_mb_source_snapshot <- function(source_id,
                                   source_spec,
                                   source_details,
                                   payload,
                                   token,
                                   base_url = "https://api.surveymonkey.com/v3") {
  collectors <- tryCatch(
    sm_api_fetch_collectors(source_id, token = token, base_url = base_url),
    error = function(e) list(total = NA_integer_, data = list(), error = conditionMessage(e))
  )
  list(
    survey_id = .sm_mb_scalar(source_id, ""),
    source_spec = source_spec %||% list(),
    source_title = .sm_mb_scalar(source_spec$source_title %||% source_details$title %||% source_spec$label, ""),
    source_alias = .sm_mb_scalar(source_spec$source_alias %||% source_spec$label, ""),
    source_channel = .sm_mb_source_channel(source_spec, ""),
    collection_strategy = .sm_mb_collection_strategy(source_spec, ""),
    fetched_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    total = suppressWarnings(as.integer(payload$total %||% length(payload$data %||% list()))),
    responses = payload$data %||% list(),
    details = source_details %||% list(),
    collectors = collectors$data %||% list(),
    collectors_total = suppressWarnings(as.integer(collectors$total %||% length(collectors$data %||% list()))),
    collectors_error = .sm_mb_scalar(collectors$error, "")
  )
}

.sm_mb_save_raw_snapshot <- function(sid, base_name, spec, sources, policy = list()) {
  if (!requireNamespace("jsonlite", quietly = TRUE)) stop("Se requiere jsonlite.", call. = FALSE)
  payload <- list(
    version = "surveymonkey_raw_snapshot/1",
    created_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    base_name = .sm_mb_scalar(base_name, ""),
    spec = spec %||% list(),
    decision_policy = policy %||% list(),
    sources = sources %||% list()
  )
  json <- jsonlite::toJSON(payload, auto_unbox = TRUE, null = "null", pretty = FALSE)
  save_upload(
    sid,
    "data",
    paste0(.sm_mb_snapshot_slug(base_name), "_surveymonkey_raw.json"),
    charToRaw(enc2utf8(as.character(json)))
  )
}

.sm_mb_read_raw_snapshot <- function(sid, file_id) {
  fid <- .sm_mb_scalar(file_id, "")
  if (!nzchar(fid)) stop_api(409, "E_SM_RAW_SNAPSHOT_MISSING", "Esta base no tiene snapshot raw de SurveyMonkey.")
  meta <- get_file(sid, fid)
  if (is.null(meta$path) || !file.exists(meta$path)) {
    stop_api(409, "E_SM_RAW_SNAPSHOT_FILE_MISSING", "El archivo raw de SurveyMonkey no existe en la sesión.")
  }
  if (!requireNamespace("jsonlite", quietly = TRUE)) stop("Se requiere jsonlite.", call. = FALSE)
  jsonlite::fromJSON(meta$path, simplifyVector = FALSE)
}

.sm_mb_default_collector_ids <- function(spec) {
  sources <- spec$sources %||% spec$campaigns %||% list(spec)
  unique(unlist(lapply(sources, function(source) {
    .sm_mb_char_vector(source$collector_ids %||% source$collector_id)
  }), use.names = FALSE))
}

.sm_mb_default_duplicate_key_vars <- function(inst) {
  # Metadata SurveyMonkey real primero. p4/código PUCP queda disponible en UI,
  # pero no se usa como sustituto silencioso de cv_id/custom values.
  c("cv_id", "custom_value", "recipient_id")
}

.sm_mb_default_decision_policy <- function(spec, inst, response_filter = list()) {
  consent_var <- .sm_mb_spec_consent_var(spec, response_filter %||% list())
  list(
    version = 1L,
    edited = FALSE,
    statuses = as.list(c("completed")),
    collector_ids = as.list(.sm_mb_default_collector_ids(spec)),
    consent_var = consent_var,
    consent_yes_values = as.list(c("1", "si", "sí", "yes", "true", "acepta", "acepto", "accepted")),
    rejection_var = consent_var,
    rejection_values = as.list(c("0", "no", "no acepta", "no acepto", "rechaza", "rechazo", "decline", "declined")),
    include_partials = FALSE,
    partial_min_answers = 15L,
    include_rejections = FALSE,
    duplicate_key_vars = as.list(.sm_mb_default_duplicate_key_vars(inst)),
    include_duplicates = TRUE,
    duplicate_keep = "first",
    manual_include_case_uids = list(),
    saved_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  )
}

.sm_mb_decision_policy_normalize <- function(policy, spec, inst, response_filter = list()) {
  defaults <- .sm_mb_default_decision_policy(spec, inst, response_filter)
  policy <- policy %||% list()
  min_answers <- suppressWarnings(as.integer(policy$partial_min_answers %||% defaults$partial_min_answers))
  if (is.na(min_answers)) min_answers <- 15L
  min_answers <- max(10L, min_answers)
  out <- defaults
  for (key in intersect(names(policy), names(defaults))) out[[key]] <- policy[[key]]
  out$statuses <- as.list(.sm_mb_char_vector(policy$statuses %||% defaults$statuses))
  if (!length(out$statuses)) out$statuses <- as.list(c("completed"))
  out$collector_ids <- as.list(.sm_mb_char_vector(policy$collector_ids %||% defaults$collector_ids))
  out$consent_yes_values <- as.list(.sm_mb_char_vector(policy$consent_yes_values %||% defaults$consent_yes_values))
  out$rejection_values <- as.list(.sm_mb_char_vector(policy$rejection_values %||% defaults$rejection_values))
  out$consent_var <- .sm_mb_scalar(policy$consent_var %||% defaults$consent_var, "")
  out$rejection_var <- .sm_mb_scalar(policy$rejection_var %||% defaults$rejection_var, "")
  out$include_partials <- isTRUE(policy$include_partials)
  out$partial_min_answers <- as.integer(min_answers)
  out$include_rejections <- isTRUE(policy$include_rejections)
  out$duplicate_key_vars <- as.list(.sm_mb_char_vector(policy$duplicate_key_vars %||% defaults$duplicate_key_vars))
  out$include_duplicates <- if (is.null(policy$include_duplicates)) TRUE else isTRUE(policy$include_duplicates)
  out$manual_include_case_uids <- as.list(unique(.sm_mb_char_vector(policy$manual_include_case_uids %||% defaults$manual_include_case_uids)))
  duplicate_keep <- .sm_mb_scalar(policy$duplicate_keep %||% defaults$duplicate_keep, "first")
  if (!duplicate_keep %in% c("first", "latest", "most_answered")) duplicate_keep <- "first"
  out$duplicate_keep <- duplicate_keep
  out$edited <- isTRUE(policy$edited)
  out$saved_at <- .sm_mb_scalar(policy$saved_at, format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
  out
}

.sm_mb_snapshot_collector_catalog <- function(snapshot) {
  rows <- list()
  for (source in snapshot$sources %||% list()) {
    for (collector in source$collectors %||% list()) {
      id <- .sm_mb_scalar(collector$id %||% collector$collector_id, "")
      if (!nzchar(id)) next
      rows[[length(rows) + 1L]] <- list(
        id = id,
        name = .sm_mb_scalar(collector$name %||% collector$title %||% collector$collector_name, ""),
        source = .sm_mb_scalar(source$source_title %||% source$source_alias, "")
      )
    }
    counts <- names(source$collector_counts %||% list())
    for (id in counts) {
      id <- .sm_mb_scalar(id, "")
      if (nzchar(id)) rows[[length(rows) + 1L]] <- list(id = id, name = "", source = "")
    }
  }
  if (!length(rows)) return(data.frame(id = character(), name = character(), source = character(), stringsAsFactors = FALSE))
  out <- do.call(rbind, lapply(rows, as.data.frame, stringsAsFactors = FALSE, optional = TRUE))
  out <- out[!duplicated(out$id), , drop = FALSE]
  rownames(out) <- NULL
  out
}

.sm_mb_collector_is_test <- function(name, source = "") {
  text <- .sm_mb_norm(paste(.sm_mb_scalar(name, ""), .sm_mb_scalar(source, "")))
  any(strsplit(text, "\\s+")[[1]] %in% "prueba")
}

.sm_mb_decision_policy_exclude_test_collectors <- function(policy, snapshot) {
  catalog <- .sm_mb_snapshot_collector_catalog(snapshot)
  if (!nrow(catalog)) return(policy)
  is_test <- vapply(seq_len(nrow(catalog)), function(i) {
    .sm_mb_collector_is_test(catalog$name[[i]], catalog$source[[i]])
  }, logical(1))
  allowed <- unique(as.character(catalog$id[!is_test]))
  allowed <- allowed[nzchar(allowed)]
  if (!length(allowed)) return(policy)
  selected <- .sm_mb_char_vector(policy$collector_ids)
  selected <- if (length(selected)) intersect(selected, allowed) else allowed
  policy$collector_ids <- as.list(selected)
  policy
}

.sm_mb_values_match <- function(values, accepted) {
  values_norm <- .sm_mb_norm(values)
  accepted_norm <- .sm_mb_norm(accepted)
  accepted_norm <- accepted_norm[nzchar(accepted_norm)]
  if (!length(accepted_norm)) return(rep(FALSE, length(values_norm)))
  values_norm %in% accepted_norm
}

.sm_mb_nonempty <- function(x) {
  x <- as.character(x %||% "")
  !is.na(x) & nzchar(trimws(x))
}

.sm_mb_policy_source_filter <- function(df, policy) {
  collectors <- .sm_mb_char_vector(policy$collector_ids)
  if (!length(collectors) || !("collector_id" %in% names(df))) return(rep(TRUE, nrow(df)))
  as.character(df$collector_id %||% "") %in% collectors
}

.sm_mb_question_answer_counts <- function(df, inst) {
  expected <- intersect(.sm_mb_expected_names(inst), names(df))
  if (!length(expected) || !nrow(df)) return(rep(0L, nrow(df)))
  mat <- vapply(expected, function(col) .sm_mb_nonempty(df[[col]]), logical(nrow(df)))
  if (is.null(dim(mat))) mat <- matrix(mat, nrow = nrow(df))
  as.integer(rowSums(mat, na.rm = TRUE))
}

.sm_mb_required_truthy <- function(value) {
  value <- .sm_mb_norm(as.character(value %||% ""))
  value %in% c("1", "true", "yes", "si", "sí", "required", "all", "at_least", "at least")
}

.sm_mb_admin_completion_vars <- function(inst) {
  survey <- inst$survey
  if (is.null(survey) || !nrow(survey) || !"name" %in% names(survey)) return(character(0))
  names_raw <- as.character(survey$name %||% "")
  labels <- rep("", nrow(survey))
  label_cols <- grep("^label($|::)|^hint($|::)", names(survey), value = TRUE)
  for (col in label_cols) {
    value <- as.character(survey[[col]] %||% "")
    value[is.na(value)] <- ""
    fill <- !nzchar(labels) & nzchar(value)
    labels[fill] <- value[fill]
  }
  text <- .sm_mb_norm(paste(names_raw, labels))
  admin <- grepl("codigo pulso|código pulso|carrera del egresado|celular del egresado|enumerador", text)
  unique(names_raw[admin & !is.na(names_raw) & nzchar(names_raw)])
}

.sm_mb_required_question_specs <- function(inst) {
  survey <- inst$survey
  if (is.null(survey) || !nrow(survey) || !"name" %in% names(survey)) {
    return(data.frame(name = character(), relevant = character(), group_relevant = character(), stringsAsFactors = FALSE))
  }
  type_base <- .sm_mb_type_base(survey$type %||% "")
  type_raw <- trimws(as.character(survey$type %||% ""))
  names_raw <- trimws(as.character(survey$name %||% ""))
  required <- if ("required" %in% names(survey)) {
    vapply(survey$required, .sm_mb_required_truthy, logical(1))
  } else {
    rep(FALSE, nrow(survey))
  }
  keep <- nzchar(names_raw) &
    !(type_base %in% .sm_mb_non_question_types) &
    !(type_raw %in% .sm_mb_non_question_types) &
    required &
    !(names_raw %in% .sm_mb_admin_completion_vars(inst))
  out <- data.frame(
    name = names_raw[keep],
    relevant = if ("relevant" %in% names(survey)) as.character(survey$relevant[keep] %||% "") else rep("", sum(keep)),
    group_relevant = if ("group_relevant" %in% names(survey)) as.character(survey$group_relevant[keep] %||% "") else rep("", sum(keep)),
    stringsAsFactors = FALSE
  )
  out$name[is.na(out$name)] <- ""
  out$relevant[is.na(out$relevant)] <- ""
  out$group_relevant[is.na(out$group_relevant)] <- ""
  out <- out[nzchar(out$name), , drop = FALSE]
  out <- out[!duplicated(out$name), , drop = FALSE]
  rownames(out) <- NULL
  out
}

.sm_mb_selected <- function(x, code) {
  tokens <- strsplit(as.character(x %||% ""), "\\s+")
  vapply(tokens, function(items) code %in% items, logical(1))
}

.sm_mb_eval_relevant_expr <- function(expr, df) {
  expr <- .sm_mb_trim(expr)
  n <- nrow(df)
  if (!nzchar(expr) || !n) return(rep(TRUE, n))
  if (exists(".sm_eval_relevant_expr", mode = "function")) {
    out <- tryCatch(.sm_eval_relevant_expr(expr, df), error = function(e) NULL)
    if (!is.null(out) && length(out) == n) return(ifelse(is.na(as.logical(out)), FALSE, as.logical(out)))
  }
  e <- expr
  e <- gsub(
    "selected\\(\\s*\\$\\{([A-Za-z_][A-Za-z0-9_/]*)\\}\\s*,\\s*'([^']*)'\\s*\\)",
    ".sm_mb_selected(data[['\\1']], '\\2')",
    e, perl = TRUE
  )
  e <- gsub("\\$\\{([A-Za-z_][A-Za-z0-9_/]*)\\}", "as.character(data[['\\1']])", e, perl = TRUE)
  e <- gsub("(?<![!=])=(?!=)", "==", e, perl = TRUE)
  e <- gsub("\\bnot\\(", "!(", e, perl = TRUE)
  e <- gsub("\\bor\\b", "|", e, perl = TRUE)
  e <- gsub("\\band\\b", "&", e, perl = TRUE)
  out <- tryCatch(eval(parse(text = sprintf("{ res <- (%s); ifelse(is.na(res), FALSE, res) }", e)),
    envir = list(data = df, .sm_mb_selected = .sm_mb_selected)), error = function(e) NULL)
  if (is.null(out) || length(out) != n) return(rep(TRUE, n))
  ifelse(is.na(as.logical(out)), FALSE, as.logical(out))
}

.sm_mb_required_completion_info <- function(df, inst) {
  df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  n <- nrow(df)
  specs <- .sm_mb_required_question_specs(inst)
  if (!n || !nrow(specs)) {
    return(list(
      answered = rep(0L, n),
      answerable = rep(0L, n),
      ratio = rep(NA_real_, n),
      label = rep("0/0", n)
    ))
  }
  answered <- integer(n)
  answerable <- integer(n)
  for (i in seq_len(nrow(specs))) {
    var <- specs$name[[i]]
    applicable <- rep(TRUE, n)
    rels <- c(specs$group_relevant[[i]], specs$relevant[[i]])
    rels <- rels[nzchar(.sm_mb_trim(rels))]
    for (expr in rels) {
      applicable <- applicable & .sm_mb_eval_relevant_expr(expr, df)
    }
    answerable <- answerable + as.integer(applicable)
    values <- if (var %in% names(df)) df[[var]] else rep(NA_character_, n)
    answered <- answered + as.integer(applicable & .sm_mb_nonempty(values))
  }
  ratio <- ifelse(answerable > 0L, answered / answerable, NA_real_)
  list(
    answered = as.integer(answered),
    answerable = as.integer(answerable),
    ratio = ratio,
    label = paste0(answered, "/", answerable)
  )
}

.sm_mb_duplicate_info <- function(df, answer_counts, policy) {
  n <- nrow(df)
  empty <- list(
    key = rep("", n),
    key_var = rep("", n),
    group_size = rep(0L, n),
    rank = rep(1L, n),
    in_group = rep(FALSE, n),
    extra = rep(FALSE, n),
    key_vars = character(0)
  )
  if (!n) return(empty)
  key_vars <- intersect(.sm_mb_char_vector(policy$duplicate_key_vars), names(df))
  if (!length(key_vars)) return(empty)
  key <- rep("", n)
  key_var <- rep("", n)
  for (var in key_vars) {
    values <- as.character(df[[var]] %||% "")
    values[is.na(values)] <- ""
    values <- trimws(values)
    fill <- !nzchar(key) & nzchar(values)
    if (any(fill, na.rm = TRUE)) {
      key[fill] <- paste(var, values[fill], sep = "=")
      key_var[fill] <- var
    }
  }
  has_key <- nzchar(key)
  if (!any(has_key)) {
    empty$key_vars <- key_vars
    return(empty)
  }
  tab <- table(key[has_key])
  group_size <- rep(0L, n)
  group_size[has_key] <- as.integer(tab[key[has_key]])
  in_group <- has_key & group_size > 1L
  rank <- rep(1L, n)
  keep <- .sm_mb_scalar(policy$duplicate_keep, "first")
  modified <- if ("date_modified" %in% names(df)) {
    vapply(as.character(df$date_modified), .sm_mb_parse_time, numeric(1))
  } else if ("date_created" %in% names(df)) {
    vapply(as.character(df$date_created), .sm_mb_parse_time, numeric(1))
  } else {
    rep(NA_real_, n)
  }
  for (dup_key in names(tab)[tab > 1L]) {
    idx <- which(key == dup_key)
    ord <- switch(keep,
      latest = order(ifelse(is.na(modified[idx]), -Inf, modified[idx]), decreasing = TRUE),
      most_answered = order(answer_counts[idx], ifelse(is.na(modified[idx]), -Inf, modified[idx]), decreasing = TRUE),
      seq_along(idx)
    )
    rank[idx[ord]] <- seq_along(idx)
  }
  list(
    key = key,
    key_var = key_var,
    group_size = as.integer(group_size),
    rank = as.integer(rank),
    in_group = in_group,
    extra = in_group & rank > 1L,
    key_vars = key_vars
  )
}

.sm_mb_completion_compare_var <- function(inst, pattern) {
  survey <- inst$survey
  if (is.null(survey) || !nrow(survey) || !"name" %in% names(survey)) return("")
  names_raw <- as.character(survey$name %||% "")
  label_cols <- grep("^label($|::)", names(survey), value = TRUE)
  labels <- rep("", nrow(survey))
  for (col in label_cols) {
    value <- as.character(survey[[col]] %||% "")
    value[is.na(value)] <- ""
    fill <- !nzchar(labels) & nzchar(value)
    labels[fill] <- value[fill]
  }
  text <- .sm_mb_norm(paste(names_raw, labels))
  hit <- which(grepl(pattern, text))
  if (!length(hit)) return("")
  .sm_mb_scalar(names_raw[[hit[[1L]]]], "")
}

.sm_mb_compare_sensitive_status <- function(values, ref_idx) {
  values <- as.character(values %||% "")
  values[is.na(values)] <- ""
  values_norm <- .sm_mb_norm(trimws(values))
  ref <- values_norm[[ref_idx]]
  if (!nzchar(ref)) return(rep("sin dato", length(values_norm)))
  ifelse(!nzchar(values_norm), "sin dato", ifelse(values_norm == ref, "coincide", "difiere"))
}

.sm_mb_duplicate_key_label <- function(value) {
  key <- tolower(trimws(.sm_mb_scalar(value, "")))
  if (!nzchar(key)) return("llave de cruce")
  if (key %in% c("cv_id", "recipient_cv_id", "id_enlace_sm") || grepl("custom_variables.*id", key)) {
    return("ID enlace")
  }
  if (grepl("codigo pulso|código pulso", key)) return("Código Pulso")
  if (grepl("carrera", key)) return("Carrera")
  .sm_mb_scalar(value, "llave de cruce")
}

.sm_mb_duplicate_evidence <- function(df, dup, inst) {
  n <- nrow(df)
  empty <- list(
    kept_case_uid = rep("", n),
    kept_response_id = rep("", n),
    code_match = rep("", n),
    career_match = rep("", n),
    summary = rep("", n)
  )
  if (!n || is.null(dup$key) || !any(dup$in_group, na.rm = TRUE)) return(empty)
  case_uids <- as.character(df$case_uid %||% "")
  response_ids <- as.character(df$response_id %||% "")
  code_var <- .sm_mb_completion_compare_var(inst, "codigo pulso|código pulso")
  career_var <- .sm_mb_completion_compare_var(inst, "carrera del egresado")
  for (dup_key in unique(dup$key[dup$in_group])) {
    if (!nzchar(dup_key)) next
    idx <- which(dup$key == dup_key)
    if (!length(idx)) next
    ref_idx <- idx[which.min(dup$rank[idx])]
    empty$kept_case_uid[idx] <- .sm_mb_scalar(case_uids[[ref_idx]], "")
    empty$kept_response_id[idx] <- .sm_mb_scalar(response_ids[[ref_idx]], "")
    empty$summary[idx] <- sprintf("Grupo de %s por %s; se conserva respuesta %s.",
      length(idx),
      .sm_mb_duplicate_key_label(dup$key_var[[ref_idx]]),
      .sm_mb_scalar(response_ids[[ref_idx]], "-")
    )
    if (nzchar(code_var) && code_var %in% names(df)) {
      empty$code_match[idx] <- .sm_mb_compare_sensitive_status(df[[code_var]][idx], which(idx == ref_idx))
    } else {
      empty$code_match[idx] <- "sin dato"
    }
    if (nzchar(career_var) && career_var %in% names(df)) {
      empty$career_match[idx] <- .sm_mb_compare_sensitive_status(df[[career_var]][idx], which(idx == ref_idx))
    } else {
      empty$career_match[idx] <- "sin dato"
    }
  }
  empty
}

.sm_mb_decision_case_rows <- function(df, source_label = "", limit = 250L) {
  if (!is.data.frame(df) || !nrow(df)) return(list())
  limit <- suppressWarnings(as.integer(limit %||% 250L))
  if (is.na(limit) || limit < 1L) limit <- 250L
  decision <- as.character(df$decision_class %||% "")
  dup_status <- as.character(df$duplicate_status %||% "")
  status <- as.character(df$response_status %||% "")
  answers <- suppressWarnings(as.integer(df$answered_required_count %||% df$answered_questions_count %||% 0L))
  reason <- rep("", nrow(df))
  reason[decision == "duplicado_excluido"] <- "Tiene el mismo identificador que otro caso y queda fuera por la regla de duplicados."
  reason[decision == "parcial_excluida"] <- "La encuesta está parcial y no entra con la regla actual."
  reason[decision == "parcial_incluida"] <- "La encuesta está parcial, pero entra porque activaste incluir parciales."
  reason[decision == "rechazo_excluido"] <- "La persona no aceptó participar o marcó rechazo."
  reason[decision == "rechazo_incluido"] <- "La persona marcó rechazo, pero entra porque activaste incluir rechazos."
  reason[decision == "manual_incluida"] <- "Incluida manualmente por la política de revisión."
  excluded_idx <- which(decision == "excluida")
  reason[excluded_idx] <- ifelse(
    nzchar(status[excluded_idx]) & !(tolower(status[excluded_idx]) %in% c("completed", "complete")),
    "No está completa y no entra con la regla actual.",
    "No cumple los filtros actuales de consentimiento, recopilador o campaña."
  )
  reason[dup_status == "duplicado_extra"] <- "Tiene el mismo identificador que otro caso y queda como repetido."
  reason[is.na(reason)] <- ""
  observed <- nzchar(reason)
  observed_total <- sum(observed, na.rm = TRUE)
  observed_rows <- which(observed)
  regular_rows <- which(!observed)
  if (length(answers) == length(reason)) {
    if (length(observed_rows)) {
      ord <- order(decision[observed_rows] == "duplicado_excluido", decision[observed_rows] == "parcial_excluida", answers[observed_rows], decreasing = TRUE)
      observed_rows <- observed_rows[ord]
    }
    if (length(regular_rows)) {
      regular_rows <- regular_rows[order(answers[regular_rows], decreasing = TRUE)]
    }
  }
  cols <- intersect(c(
    "case_uid", "survey_id", "source_title", "source_channel", "collector_id",
    "response_id", "recipient_id", "custom_value", "cv_id", "p4",
    "response_status", "date_created", "date_modified",
    "answered_questions_count", "answered_required_count", "answerable_required_count",
    "answer_completion_ratio", "answer_completion_label", "near_complete",
    "decision_class", "decision_included",
    "decision_manual_include",
    "duplicate_status", "duplicate_key_var", "duplicate_key",
    "duplicate_group_size", "duplicate_rank",
    "duplicate_kept_case_uid", "duplicate_kept_response_id",
    "duplicate_code_match", "duplicate_career_match", "duplicate_evidence"
  ), names(df))
  rows <- utils::head(c(observed_rows, regular_rows), limit)
  out_rows <- lapply(rows, function(i) {
    out <- lapply(cols, function(col) .sm_mb_scalar(df[[col]][i], ""))
    names(out) <- cols
    out$source_label <- .sm_mb_scalar(source_label, "")
    out$observed <- isTRUE(observed[[i]])
    out$observation_reason <- .sm_mb_scalar(reason[[i]], "")
    out
  })
  attr(out_rows, "observed_total") <- as.integer(observed_total)
  attr(out_rows, "case_rows_omitted") <- as.integer(max(0L, nrow(df) - length(out_rows)))
  out_rows
}

.sm_mb_decision_apply_df <- function(df, inst, policy, source_label = "") {
  df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  if (!nrow(df)) {
    attr(df, "sm_decision_audit") <- list(
      raw_total = 0L, included = 0L, excluded = 0L, source_label = source_label
    )
    return(df)
  }
  statuses <- tolower(.sm_mb_char_vector(policy$statuses))
  if (!length(statuses)) statuses <- c("completed")
  status <- tolower(trimws(as.character(df$response_status %||% "")))
  status_included <- status %in% statuses
  completed <- status %in% c("completed", "complete")
  collector_included <- .sm_mb_policy_source_filter(df, policy)

  completion <- .sm_mb_required_completion_info(df, inst)
  answer_counts <- completion$answered
  partial_min <- suppressWarnings(as.integer(policy$partial_min_answers %||% 15L))
  if (is.na(partial_min)) partial_min <- 15L
  partial_min <- max(10L, partial_min)
  partial_revisable <- !completed & answer_counts > partial_min

  consent_var <- .sm_mb_scalar(policy$consent_var, "")
  consent_values <- if (nzchar(consent_var) && consent_var %in% names(df)) as.character(df[[consent_var]]) else rep("", nrow(df))
  consent_available <- nzchar(consent_var) && consent_var %in% names(df)
  consent_yes <- if (consent_available) {
    .sm_mb_values_match(consent_values, policy$consent_yes_values %||% character())
  } else {
    rep(TRUE, nrow(df))
  }

  rejection_var <- .sm_mb_scalar(policy$rejection_var, consent_var)
  rejection_values <- if (nzchar(rejection_var) && rejection_var %in% names(df)) as.character(df[[rejection_var]]) else rep("", nrow(df))
  rejection <- if (nzchar(rejection_var) && rejection_var %in% names(df)) {
    .sm_mb_values_match(rejection_values, policy$rejection_values %||% character())
  } else {
    rep(FALSE, nrow(df))
  }

  effective <- completed & consent_yes
  dup <- .sm_mb_duplicate_info(df, answer_counts, policy)
  duplicate_excluded <- !isTRUE(policy$include_duplicates) & dup$extra
  include_partial <- isTRUE(policy$include_partials) & partial_revisable & collector_included & !rejection
  include_rejection <- isTRUE(policy$include_rejections) & rejection & collector_included
  case_uids <- if ("case_uid" %in% names(df)) as.character(df$case_uid %||% "") else rep("", nrow(df))
  manual_case_uids <- .sm_mb_char_vector(policy$manual_include_case_uids)
  manual_include <- nzchar(case_uids) & case_uids %in% manual_case_uids & collector_included
  included <- (collector_included & !duplicate_excluded & ((status_included & effective) | include_partial | include_rejection)) | manual_include
  decision_class <- ifelse(manual_include, "manual_incluida",
    ifelse(duplicate_excluded, "duplicado_excluido",
    ifelse(included & effective, "efectiva",
    ifelse(included & partial_revisable, "parcial_incluida",
      ifelse(included & rejection, "rechazo_incluido",
        ifelse(rejection, "rechazo_excluido",
          ifelse(partial_revisable, "parcial_excluida", "excluida")))))))

  df$decision_class <- decision_class
  df$decision_included <- ifelse(included, "1", "0")
  df$decision_manual_include <- ifelse(manual_include, "1", "0")
  df$answered_questions_count <- as.character(answer_counts)
  df$answered_required_count <- as.character(completion$answered)
  df$answerable_required_count <- as.character(completion$answerable)
  df$answer_completion_ratio <- ifelse(is.na(completion$ratio), NA_character_, sprintf("%.6f", completion$ratio))
  df$answer_completion_label <- completion$label
  near_complete <- !included & !is.na(completion$ratio) & completion$ratio >= 0.95
  df$near_complete <- ifelse(near_complete, "1", "0")
  df$duplicate_key <- ifelse(nzchar(dup$key), dup$key, NA_character_)
  df$duplicate_key_var <- ifelse(nzchar(dup$key_var), dup$key_var, NA_character_)
  df$duplicate_group_size <- as.character(dup$group_size)
  df$duplicate_rank <- as.character(dup$rank)
  df$duplicate_status <- ifelse(dup$extra, "duplicado_extra",
    ifelse(dup$in_group, "duplicado_conservado", "unico"))
  dup_evidence <- .sm_mb_duplicate_evidence(df, dup, inst)
  df$duplicate_kept_case_uid <- dup_evidence$kept_case_uid
  df$duplicate_kept_response_id <- dup_evidence$kept_response_id
  df$duplicate_code_match <- dup_evidence$code_match
  df$duplicate_career_match <- dup_evidence$career_match
  df$duplicate_evidence <- dup_evidence$summary

  status_counts <- .sm_mb_count_values(status)
  collector_counts <- if ("collector_id" %in% names(df)) .sm_mb_count_values(df$collector_id) else list()
  included_collectors <- if ("collector_id" %in% names(df)) {
    unique(as.character(df$collector_id[included] %||% ""))
  } else {
    character(0)
  }
  included_collectors <- included_collectors[nzchar(included_collectors)]
  case_rows <- .sm_mb_decision_case_rows(df, source_label = source_label, limit = 250L)
  audit <- list(
    source_label = source_label,
    raw_total = as.integer(nrow(df)),
    completed = as.integer(sum(completed, na.rm = TRUE)),
    completed_with_consent = as.integer(sum(completed & consent_yes, na.rm = TRUE)),
    partials_revisable = as.integer(sum(partial_revisable, na.rm = TRUE)),
    rejections = as.integer(sum(rejection, na.rm = TRUE)),
    unclear_consent = as.integer(if (consent_available) sum(!consent_yes & !rejection & .sm_mb_nonempty(consent_values), na.rm = TRUE) else 0L),
    included = as.integer(sum(included, na.rm = TRUE)),
    excluded = as.integer(sum(!included, na.rm = TRUE)),
    collectors_included = as.integer(length(included_collectors)),
    partial_min_answers = as.integer(partial_min),
    answerable_required_max = as.integer(max(completion$answerable, na.rm = TRUE)),
    near_complete_cases = as.integer(sum(near_complete, na.rm = TRUE)),
    consent_var = consent_var,
    rejection_var = rejection_var,
    consent_available = isTRUE(consent_available),
    duplicate_key_vars = as.list(dup$key_vars),
    duplicate_keep = .sm_mb_scalar(policy$duplicate_keep, "first"),
    include_duplicates = isTRUE(policy$include_duplicates),
    duplicate_groups = as.integer(length(unique(dup$key[dup$in_group]))),
    duplicate_rows = as.integer(sum(dup$in_group, na.rm = TRUE)),
    duplicate_extra_rows = as.integer(sum(dup$extra, na.rm = TRUE)),
    duplicates_excluded = as.integer(sum(duplicate_excluded, na.rm = TRUE)),
    duplicates_included = as.integer(sum(dup$in_group & included, na.rm = TRUE)),
    manual_included = as.integer(sum(manual_include, na.rm = TRUE)),
    status_counts = status_counts,
    collector_counts = collector_counts,
    observed_cases = as.integer(attr(case_rows, "observed_total", exact = TRUE) %||% 0L),
    cases = case_rows,
    case_rows_omitted = as.integer(attr(case_rows, "case_rows_omitted", exact = TRUE) %||% max(0L, nrow(df) - 250L))
  )
  out <- df[included, , drop = FALSE]
  attr(out, "sm_decision_audit") <- audit
  out
}

.sm_mb_decision_audit_total <- function(audits) {
  audits <- Filter(function(x) is.list(x) && length(x), audits %||% list())
  sums <- function(key) as.integer(sum(vapply(audits, function(x) as.integer(x[[key]] %||% 0L), integer(1))))
  list(
    version = 1L,
    audited_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    raw_total = sums("raw_total"),
    completed = sums("completed"),
    completed_with_consent = sums("completed_with_consent"),
    partials_revisable = sums("partials_revisable"),
    rejections = sums("rejections"),
    unclear_consent = sums("unclear_consent"),
    duplicate_groups = sums("duplicate_groups"),
    duplicate_rows = sums("duplicate_rows"),
    duplicate_extra_rows = sums("duplicate_extra_rows"),
    duplicates_excluded = sums("duplicates_excluded"),
    duplicates_included = sums("duplicates_included"),
    manual_included = sums("manual_included"),
    near_complete_cases = sums("near_complete_cases"),
    observed_cases = sums("observed_cases"),
    case_rows_omitted = sums("case_rows_omitted"),
    included = sums("included"),
    excluded = sums("excluded"),
    collectors_included = sums("collectors_included"),
    sources = audits
  )
}

.sm_mb_build_effective_from_snapshot <- function(sid, base_name, policy = NULL) {
  s <- session_get(sid)
  base <- s$estudio$bases[[base_name]]
  if (is.null(base)) stop_api(404, "E_BASE_NOT_FOUND", sprintf("Base '%s' no existe.", base_name))
  snapshot <- .sm_mb_read_raw_snapshot(sid, base$surveymonkey_raw_snapshot_file_id)
  xls_fid <- .sm_mb_scalar(base$original_xlsform_file_id %||% base$xlsform_file_id, "")
  if (!nzchar(xls_fid)) stop_api(409, "E_SM_NO_XLSFORM", "La base no tiene XLSForm asociado.")
  rp_inst <- reporte_instrumento(path = get_file(sid, xls_fid)$path)
  spec <- tryCatch(.sm_mb_normalize_survey_specs(list(snapshot$spec %||% base$surveymonkey_source_spec %||% list()))[[1]], error = function(e) {
    base$surveymonkey_source_spec %||% list(survey_id = base$survey_id)
  })
  policy <- .sm_mb_decision_policy_normalize(policy %||% base$surveymonkey_decision_policy, spec, rp_inst, base$response_filter %||% list())
  policy <- .sm_mb_decision_policy_exclude_test_collectors(policy, snapshot)

  source_dfs <- list()
  source_audits <- list()
  for (source in snapshot$sources %||% list()) {
    source_id <- .sm_mb_scalar(source$survey_id %||% (source$source_spec %||% list())$survey_id, spec$survey_id)
    source_spec <- source$source_spec %||% spec
    details <- source$details %||% list()
    responses <- source$responses %||% list()
    source_title <- .sm_mb_scalar(source$source_title %||% source_spec$source_title %||% source_spec$label, "")
    source_df <- sm_multibase_api_responses_to_canonical_data(
      details = details,
      responses = responses,
      inst = rp_inst,
      survey_id = source_id,
      pais = .sm_mb_scalar(source_spec$pais %||% spec$pais, ""),
      source_title = source_title,
      source_channel = .sm_mb_source_channel(source_spec, spec$source_channel %||% ""),
      company_vars = character(0),
      response_statuses = c("all"),
      keep_missing_status = TRUE,
      collector_ids = character(0),
      date_modified_gte = "",
      date_modified_lte = "",
      consent_var = "",
      apply_consent_filter = FALSE
    )
    decided <- .sm_mb_decision_apply_df(source_df, rp_inst, policy, source_label = source_title)
    source_dfs[[length(source_dfs) + 1L]] <- decided
    audit <- attr(decided, "sm_decision_audit", exact = TRUE) %||% list()
    audit$survey_id <- source_id
    audit$source_title <- source_title
    audit$source_alias <- .sm_mb_scalar(source$source_alias %||% source_spec$source_alias %||% source_spec$label, "")
    audit$collectors <- lapply(source$collectors %||% list(), function(item) {
      list(
        id = .sm_mb_scalar(item$id %||% item$collector_id, ""),
        name = .sm_mb_scalar(item$name %||% item$title %||% item$collector_name, ""),
        type = .sm_mb_scalar(item$type %||% item$collector_type, ""),
        response_count = suppressWarnings(as.integer(item$response_count %||% item$num_responses %||% NA_integer_))
      )
    })
    source_audits[[length(source_audits) + 1L]] <- audit
  }
  data_df <- .sm_mb_bind_rows(source_dfs)
  if (nrow(data_df)) data_df <- normalize_data_for_xlsform(data_df, rp_inst)
  audit <- .sm_mb_decision_audit_total(source_audits)
  audit$policy <- policy
  list(data = data_df, inst = rp_inst, policy = policy, audit = audit, snapshot = snapshot)
}

sm_multibase_decision_preview <- function(sid, base_name, policy = NULL) {
  built <- .sm_mb_build_effective_from_snapshot(sid, base_name, policy)
  list(
    ok = TRUE,
    base_name = base_name,
    policy = built$policy,
    audit = built$audit,
    n_filas_preview = as.integer(nrow(built$data)),
    n_columnas_preview = as.integer(ncol(built$data))
  )
}

sm_multibase_decision_apply <- function(sid, base_name, policy = NULL,
                                        regenerate_data = TRUE,
                                        force_replace_adapted = FALSE) {
  built <- .sm_mb_build_effective_from_snapshot(sid, base_name, policy)
  s <- session_get(sid)
  session_before_decision_apply <- s
  base <- s$estudio$bases[[base_name]]
  is_adapted <- .sm_mb_base_current_is_adapted(s, base)
  has_downstream_progress <- .sm_mb_base_has_downstream_progress(s, base_name, base)
  generated_meta <- NULL
  replaced_active <- FALSE
  if (isTRUE(regenerate_data) && is.data.frame(built$data)) {
    data_path <- file.path(s$dir, "downloads", paste0(uuid::UUIDgenerate(), "_", base_name, "_decision_data.xlsx"))
    .sm_mb_write_xlsx(built$data, data_path)
    data_bytes <- readBin(data_path, what = "raw", n = file.info(data_path)$size)
    generated_meta <- save_upload(sid, "data", paste0(base_name, "_decision_data.xlsx"), data_bytes)
    rp_data <- reporte_data(built$data, instrumento = built$inst)
    s <- session_get(sid)
    base <- s$estudio$bases[[base_name]]
    base$surveymonkey_effective_data_file_id <- generated_meta$file_id
    if ((!isTRUE(is_adapted) && !isTRUE(has_downstream_progress)) || isTRUE(force_replace_adapted)) {
      base$data_file_id <- generated_meta$file_id
      base$data_ext <- generated_meta$ext
      base$n_filas <- as.integer(nrow(built$data))
      base$n_columnas <- as.integer(ncol(built$data))
      s$rp_data_sources[[base_name]] <- rp_data
      if (identical(names(s$estudio$bases)[1], base_name)) s$rp_data <- rp_data
      replaced_active <- TRUE
    }
    s$estudio$bases[[base_name]] <- base
    .session_env[[sid]] <- s
  }
  s <- session_get(sid)
  base <- s$estudio$bases[[base_name]]
  built$policy$edited <- TRUE
  built$policy$saved_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  base$surveymonkey_decision_policy <- built$policy
  base$surveymonkey_decision_audit <- built$audit
  base$response_filter <- built$audit
  base$surveymonkey_decision_updated_at <- built$policy$saved_at
  if (!is.null(generated_meta)) {
    base$surveymonkey_effective_data_file_id <- generated_meta$file_id
  }
  s$estudio$bases[[base_name]] <- base
  if (isTRUE(replaced_active)) {
    s <- .invalidate_processing_state(s, base_name)
  }
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  if (!is.null(generated_meta) &&
      isTRUE((base$universe_filter %||% list())$enabled)) {
    tryCatch(
      carga_universe_filter_reapply(sid, base_name, generated_meta$file_id),
      error = function(err) {
        .session_env[[sid]] <- session_before_decision_apply
        stop(err)
      }
    )
  }
  list(
    ok = TRUE,
    base_name = base_name,
    policy = built$policy,
    audit = built$audit,
    generated_file_id = generated_meta$file_id %||% NA_character_,
    replaced_active = isTRUE(replaced_active),
    kept_adapted_data = isTRUE(is_adapted) && !isTRUE(force_replace_adapted),
    kept_downstream_data = isTRUE(has_downstream_progress) && !isTRUE(force_replace_adapted),
    estudio = .estudio_payload(sid)
  )
}

.sm_mb_response_filter_total <- function(filters) {
  filters <- Filter(function(x) is.list(x) && length(x), filters %||% list())
  if (!length(filters)) return(list())
  if (length(filters) == 1L) return(filters[[1]])
  original_rows <- sum(vapply(filters, function(x) as.integer(x$original_rows %||% 0L), integer(1)))
  kept_rows <- sum(vapply(filters, function(x) as.integer(x$kept_rows %||% 0L), integer(1)))
  excluded_rows <- sum(vapply(filters, function(x) as.integer(x$excluded_rows %||% 0L), integer(1)))
  list(
    kind = "surveymonkey_multi_source_response_filter",
    source_count = as.integer(length(filters)),
    original_rows = as.integer(original_rows),
    kept_rows = as.integer(kept_rows),
    excluded_rows = as.integer(excluded_rows),
    sources = filters
  )
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

.sm_mb_write_xlsform_model <- function(model, path) {
  if (exists(".mi_write_xlsform", mode = "function")) {
    return(.mi_write_xlsform(model, path))
  }
  if (!requireNamespace("openxlsx", quietly = TRUE)) stop("Se requiere openxlsx.", call. = FALSE)
  wb <- openxlsx::createWorkbook()
  for (sheet in c("survey", "choices", "settings")) {
    df <- model[[sheet]]
    if (is.null(df)) df <- data.frame()
    openxlsx::addWorksheet(wb, sheet)
    openxlsx::writeData(wb, sheet, df)
    openxlsx::freezePane(wb, sheet, firstRow = TRUE)
    if (ncol(df)) openxlsx::setColWidths(wb, sheet, cols = seq_len(ncol(df)), widths = "auto")
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
}

.sm_mb_logic_value_count <- function(survey) {
  if (is.null(survey) || !is.data.frame(survey) || !nrow(survey)) return(0L)
  cols <- intersect(
    c("relevant", "constraint", "constraint_message", "readonly",
      "calculation", "calculate", "choice_filter", "default", "trigger"),
    names(survey)
  )
  if (!length(cols)) return(0L)
  vals <- unlist(survey[, cols, drop = FALSE], use.names = FALSE)
  vals <- trimws(as.character(vals %||% ""))
  vals[is.na(vals)] <- ""
  as.integer(sum(nzchar(vals)))
}

.sm_mb_read_xlsform_sheets_safe <- function(path) {
  if (!nzchar(.sm_mb_scalar(path, "")) || !file.exists(path)) return(NULL)
  tryCatch({
    if (exists(".estudio_xlsform_read_sheets", mode = "function")) {
      .estudio_xlsform_read_sheets(path)
    } else {
      list(
        survey = suppressWarnings(readxl::read_excel(path, sheet = "survey")),
        choices = suppressWarnings(readxl::read_excel(path, sheet = "choices")),
        settings = tryCatch(suppressWarnings(readxl::read_excel(path, sheet = "settings")), error = function(e) NULL)
      )
    }
  }, error = function(e) NULL)
}

.sm_mb_shared_logic_template_sheets <- function(sid, target_base = "") {
  s <- session_get(sid, required = FALSE)
  bases <- (s$estudio %||% list())$bases %||% list()
  if (is.null(s) || !length(bases)) return(NULL)
  family <- (s$estudio %||% list())$independent_siblings %||% list()
  if (!isTRUE(family$shared_logic)) return(NULL)

  base_names <- names(bases)
  preferred <- as.character(family$template_base %||% "")
  preferred <- preferred[nzchar(preferred) & preferred %in% base_names]
  target_base <- as.character(target_base %||% "")
  candidates <- unique(c(
    preferred,
    if (nzchar(target_base) && target_base %in% base_names) target_base else character(0),
    setdiff(base_names, target_base)
  ))

  best <- NULL
  best_count <- 0L
  for (candidate in candidates) {
    fid <- .sm_mb_scalar(bases[[candidate]]$xlsform_file_id, "")
    if (!nzchar(fid)) next
    meta <- tryCatch(get_file(sid, fid), error = function(e) NULL)
    sheets <- .sm_mb_read_xlsform_sheets_safe(meta$path %||% "")
    if (is.null(sheets) || is.null(sheets$survey)) next
    count <- .sm_mb_logic_value_count(sheets$survey)
    if (count > best_count) {
      best_count <- count
      best <- list(base = candidate, sheets = sheets, logic_value_count = count)
    }
  }
  if (is.null(best) || best_count <= 0L) return(NULL)
  best
}

.sm_mb_apply_shared_logic_to_model <- function(sid, base_name, model) {
  if (!exists(".estudio_apply_template_logic_survey", mode = "function")) {
    return(list(model = model, applied = FALSE, reason = "helper_unavailable"))
  }
  template <- .sm_mb_shared_logic_template_sheets(sid, target_base = base_name)
  if (is.null(template)) {
    return(list(model = model, applied = FALSE, reason = "template_unavailable"))
  }
  applied <- tryCatch(
    .estudio_apply_template_logic_survey(
      template_survey = template$sheets$survey,
      target_survey = model$survey,
      template_choices = template$sheets$choices,
      target_choices = model$choices,
      clear_target_logic = FALSE
    ),
    error = function(e) e
  )
  if (inherits(applied, "error")) {
    return(list(model = model, applied = FALSE, reason = conditionMessage(applied)))
  }
  model$survey <- applied$survey
  list(
    model = model,
    applied = length(applied$applied_variables %||% character(0)) > 0L ||
      as.integer(applied$changed_cells %||% 0L) > 0L,
    reason = "",
    template_base = template$base,
    changed_cells = as.integer(applied$changed_cells %||% 0L),
    applied_variables = as.list(applied$applied_variables %||% character(0)),
    logic_value_count = as.integer(template$logic_value_count %||% 0L)
  )
}

.sm_mb_apply_canonical_logic_to_model <- function(canonical, model) {
  if (is.null(canonical)) {
    return(list(model = model, applied = FALSE, reason = "canonical_unavailable"))
  }
  if (!exists(".estudio_apply_template_logic_survey", mode = "function")) {
    return(list(model = model, applied = FALSE, reason = "helper_unavailable"))
  }
  inst <- canonical$inst %||% list()
  template_survey <- inst$survey %||% NULL
  if (!is.data.frame(template_survey) || !"name" %in% names(template_survey)) {
    return(list(model = model, applied = FALSE, reason = "canonical_without_survey"))
  }
  applied <- tryCatch(
    .estudio_apply_template_logic_survey(
      template_survey = template_survey,
      target_survey = model$survey,
      template_choices = inst$choices,
      target_choices = model$choices,
      clear_target_logic = FALSE
    ),
    error = function(e) e
  )
  if (inherits(applied, "error")) {
    return(list(model = model, applied = FALSE, reason = conditionMessage(applied)))
  }
  model$survey <- applied$survey
  meta <- canonical$meta %||% list()
  records_payload <- if (exists(".estudio_records_payload", mode = "function")) {
    .estudio_records_payload(applied$missing_references)
  } else if (is.data.frame(applied$missing_references) && nrow(applied$missing_references)) {
    unname(lapply(seq_len(nrow(applied$missing_references)), function(i) as.list(applied$missing_references[i, , drop = FALSE])))
  } else {
    list()
  }
  list(
    model = model,
    applied = length(applied$applied_variables %||% character(0)) > 0L ||
      as.integer(applied$changed_cells %||% 0L) > 0L,
    reason = "",
    template_base = .sm_mb_scalar(meta$original_name %||% meta$file_id, "XLSForm base"),
    template_file_id = .sm_mb_scalar(meta$file_id, ""),
    template_kind = .sm_mb_scalar(meta$kind, "xlsform"),
    changed_cells = as.integer(applied$changed_cells %||% 0L),
    applied_variables = as.list(applied$applied_variables %||% character(0)),
    skipped_missing_variables = as.list(applied$skipped_missing_variables %||% character(0)),
    missing_references = records_payload,
    n_applied_variables = as.integer(length(applied$applied_variables %||% character(0))),
    n_skipped_missing_variables = as.integer(length(applied$skipped_missing_variables %||% character(0))),
    n_missing_references = as.integer(nrow(applied$missing_references %||% data.frame())),
    logic_columns = as.list(applied$logic_columns %||% character(0)),
    logic_value_count = as.integer(.sm_mb_logic_value_count(template_survey))
  )
}

.sm_mb_canonical_logic_sync_payload <- function(canonical, rows) {
  rows <- Filter(function(x) is.list(x) && length(x), rows %||% list())
  if (is.null(canonical) || !length(rows)) return(NULL)
  meta <- canonical$meta %||% list()
  updated <- vapply(rows, function(x) {
    if (isTRUE(x$applied) || as.integer(x$changed_cells %||% 0L) > 0L) {
      .sm_mb_scalar(x$base, "")
    } else {
      ""
    }
  }, character(1))
  updated <- updated[nzchar(updated)]
  list(
    ok = TRUE,
    template_base = .sm_mb_scalar(meta$original_name %||% meta$file_id, "XLSForm base"),
    template_file_id = .sm_mb_scalar(meta$file_id, ""),
    template_kind = .sm_mb_scalar(meta$kind, "xlsform"),
    targets = as.list(vapply(rows, function(x) .sm_mb_scalar(x$base, ""), character(1))),
    updated_bases = as.list(updated),
    n_targets = as.integer(length(rows)),
    n_updated_bases = as.integer(length(updated)),
    results = rows
  )
}

sm_multibase_apply_canonical_xlsform_logic <- function(sid,
                                                       canonical_file_id = "",
                                                       targets = NULL,
                                                       clear_target_logic = FALSE) {
  if (!estudio_is_independent_siblings(sid)) {
    stop_api(409, "E_NOT_INDEPENDENT_SIBLINGS",
             "Esta acción solo está disponible para bases hermanas independientes.")
  }
  if (!exists(".estudio_apply_template_logic_survey", mode = "function")) {
    stop_api(500, "E_XLSFORM_LOGIC_HELPER",
             "No está disponible el motor para aplicar lógica XLSForm.")
  }

  canonical <- .sm_mb_canonical_inst(sid, .sm_mb_scalar(canonical_file_id, ""))
  template <- canonical$inst %||% list()
  template_survey <- template$survey %||% NULL
  if (!is.data.frame(template_survey) || !"name" %in% names(template_survey)) {
    stop_api(400, "E_TEMPLATE_XLSFORM_INVALIDO",
             "El XLSForm base no tiene una hoja survey válida.")
  }

  bases <- estudio_list_bases(sid)
  base_names <- names(bases)
  targets <- as.character(targets %||% base_names)
  targets <- targets[nzchar(targets) & targets %in% base_names]
  if (!length(targets)) {
    stop_api(400, "E_NO_TARGETS", "No hay bases hermanas destino para aplicar la lógica.")
  }

  now <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  rows <- list()
  updated <- character()
  for (target in targets) {
    target_base <- bases[[target]]
    target_meta <- get_file(sid, target_base$xlsform_file_id)
    target_sheets <- .estudio_xlsform_read_sheets(target_meta$path)
    applied <- .estudio_apply_template_logic_survey(
      template_survey = template_survey,
      target_survey = target_sheets$survey,
      template_choices = template$choices,
      target_choices = target_sheets$choices,
      clear_target_logic = isTRUE(clear_target_logic)
    )
    rows[[length(rows) + 1L]] <- list(
      base = target,
      applied_variables = as.list(applied$applied_variables),
      skipped_missing_variables = as.list(applied$skipped_missing_variables),
      missing_references = if (exists(".estudio_records_payload", mode = "function")) {
        .estudio_records_payload(applied$missing_references)
      } else {
        list()
      },
      n_applied_variables = as.integer(length(applied$applied_variables)),
      n_skipped_missing_variables = as.integer(length(applied$skipped_missing_variables)),
      n_missing_references = as.integer(nrow(applied$missing_references)),
      changed_cells = as.integer(applied$changed_cells),
      logic_columns = as.list(applied$logic_columns),
      remapped_choices = if (exists(".estudio_records_payload", mode = "function")) {
        .estudio_records_payload(applied$remapped_choices)
      } else {
        list()
      },
      n_remapped_choices = as.integer(nrow(applied$remapped_choices))
    )
    if (applied$changed_cells <= 0L) next

    target_sheets$survey <- applied$survey
    out_path <- tempfile(sprintf("%s_canonical_logic_", target), fileext = ".xlsx")
    on.exit(unlink(out_path), add = TRUE)
    .estudio_xlsform_write_sheets(target_sheets, out_path)
    raw <- readBin(out_path, what = "raw", n = file.info(out_path)$size)
    original_name <- sprintf("%s_xlsform_logica_base_%s.xlsx", target, format(Sys.time(), "%Y%m%d_%H%M%S", tz = "UTC"))
    new_meta <- save_upload(sid, "xlsform", original_name, raw)
    new_inst <- reporte_instrumento(path = new_meta$path)

    data_meta <- get_file(sid, target_base$data_file_id)
    data_df <- .read_data_from_path(data_meta$path, data_meta$ext)
    data_df <- normalize_data_for_xlsform(data_df, new_inst)
    .carga_assert_data_xlsform_compatible(data_df, new_inst)
    new_rp_data <- reporte_data(data_df, instrumento = new_inst)

    estudio_preserve_original_base_files(sid, target)
    estudio_replace_base_files(
      sid,
      target,
      xlsform_file_id = new_meta$file_id,
      data_file_id = target_base$data_file_id,
      data_ext = target_base$data_ext,
      rp_inst = new_inst,
      rp_data = new_rp_data,
      n_filas = as.integer(nrow(data_df)),
      n_columnas = as.integer(ncol(data_df))
    )
    updated <- c(updated, target)
  }

  meta <- canonical$meta %||% list()
  sync <- list(
    ok = TRUE,
    kind = "canonical_xlsform_logic",
    template_base = .sm_mb_scalar(meta$original_name %||% meta$file_id, "XLSForm base"),
    template_file_id = .sm_mb_scalar(meta$file_id, ""),
    template_kind = .sm_mb_scalar(meta$kind, "xlsform"),
    targets = as.list(targets),
    updated_bases = as.list(updated),
    n_targets = as.integer(length(targets)),
    n_updated_bases = as.integer(length(updated)),
    clear_target_logic = isTRUE(clear_target_logic),
    applied_at = now,
    results = rows
  )

  s <- session_get(sid)
  family <- s$estudio$independent_siblings %||% list()
  family$logic_policy <- "shared_template"
  family$shared_logic <- TRUE
  family$status <- "canonical_xlsform_logic_applied"
  family$template_source <- list(
    kind = .sm_mb_scalar(meta$kind, "xlsform"),
    file_id = .sm_mb_scalar(meta$file_id, ""),
    xlsform_name = .sm_mb_scalar(meta$original_name, "XLSForm base")
  )
  family$logic_applied_at <- now
  family$logic_sync <- sync
  family$updated_at <- now
  s$estudio$independent_siblings <- family
  for (target in targets) {
    base <- s$estudio$bases[[target]]
    base$logic_template_base <- sync$template_base
    base$logic_template_file_id <- sync$template_file_id
    base$logic_template_applied_at <- now
    base$logic_template_status <- if (target %in% updated) "canonical_updated" else "canonical_unchanged"
    base$surveymonkey_xlsform_logic_sync <- sync
    s$estudio$bases[[target]] <- base
  }
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s

  sync$estudio <- .estudio_payload(sid)
  sync
}

.sm_mb_unique_base_name <- function(sid, label, fallback = "surveymonkey_base") {
  nombre <- .sm_mb_slug(label)
  if (!nzchar(nombre)) nombre <- fallback
  nombre <- substr(nombre, 1L, 72L)
  nombre <- gsub("_+$", "", nombre)
  if (!nzchar(nombre)) nombre <- fallback
  existing <- names(estudio_list_bases(sid))
  if (!(nombre %in% existing)) return(nombre)
  base0 <- nombre
  idx <- 2L
  repeat {
    suffix <- paste0("_", idx)
    candidate <- paste0(substr(base0, 1L, max(1L, 72L - nchar(suffix))), suffix)
    if (!(candidate %in% existing)) return(candidate)
    idx <- idx + 1L
  }
}

.sm_mb_summary_lookup <- function(summaries) {
  ids <- vapply(summaries, function(x) .sm_mb_scalar(x$survey_id, ""), character(1))
  stats::setNames(summaries, ids)
}

.sm_mb_independent_base_label <- function(spec, summary) {
  source_alias <- .sm_mb_trim(spec$source_alias %||% "")
  if (nzchar(source_alias)) return(source_alias)
  label <- .sm_mb_trim(spec$label %||% "")
  if (nzchar(label)) return(label)
  title <- .sm_mb_trim(summary$title %||% "")
  if (nzchar(title)) return(title)
  .sm_mb_scalar(spec$survey_id, "surveymonkey_base")
}

.sm_mb_response_statuses <- function(x) {
  if (is.null(x)) return(c("completed"))
  if (is.list(x)) x <- unlist(x, use.names = FALSE)
  x <- as.character(x)
  x <- x[!is.na(x) & nzchar(trimws(x))]
  if (!length(x)) c("completed") else x
}

.sm_mb_stop_words <- c(
  "acreditacion", "encuesta", "cuestionario", "formulario", "survey",
  "facultad", "programa", "campana", "campanas", "campaign", "campaigns",
  "adicional", "adicionales", "extra", "de", "del", "la", "las", "los",
  "el", "a", "al", "y", "e", "para", "por", "con"
)

.sm_mb_tokenize_title <- function(x) {
  toks <- unlist(strsplit(.sm_mb_norm(x), "[[:space:]]+"), use.names = FALSE)
  toks <- toks[!is.na(toks) & nchar(toks) > 2L]
  unique(setdiff(toks, .sm_mb_stop_words))
}

.sm_mb_token_similarity <- function(a, b) {
  a <- .sm_mb_scalar(a, "")
  b <- .sm_mb_scalar(b, "")
  if (!nzchar(a) || !nzchar(b)) return(0)
  if (identical(a, b)) return(1)
  max_len <- max(nchar(a), nchar(b))
  if (max_len < 5L) return(0)
  dist <- suppressWarnings(as.numeric(utils::adist(a, b, ignore.case = TRUE))[1])
  if (!is.finite(dist)) return(0)
  max(0, 1 - (dist / max_len))
}

.sm_mb_name_proximity <- function(base_tokens, candidate_tokens) {
  base_tokens <- unique(.sm_mb_char_vector(base_tokens))
  candidate_tokens <- unique(.sm_mb_char_vector(candidate_tokens))
  if (!length(base_tokens) || !length(candidate_tokens)) {
    return(list(score = 0, matches = character(0), n_matches = 0L))
  }
  sims <- numeric(length(base_tokens))
  labels <- character(length(base_tokens))
  for (i in seq_along(base_tokens)) {
    token <- base_tokens[i]
    sim <- vapply(candidate_tokens, function(cand) .sm_mb_token_similarity(token, cand), numeric(1))
    best_idx <- which.max(sim)
    best <- if (length(best_idx)) sim[best_idx] else 0
    if (is.finite(best) && best >= 0.84) {
      sims[i] <- best
      labels[i] <- if (identical(token, candidate_tokens[best_idx])) {
        token
      } else {
        paste0(token, "~", candidate_tokens[best_idx])
      }
    }
  }
  matched <- labels[nzchar(labels)]
  list(
    score = if (length(base_tokens)) sum(sims) / length(base_tokens) else 0,
    matches = unique(matched),
    n_matches = as.integer(length(unique(matched)))
  )
}

.sm_mb_source_ids <- function(spec) {
  sources <- spec$sources %||% list(spec)
  unique(vapply(sources, function(x) .sm_mb_scalar(x$survey_id, ""), character(1)))
}

.sm_mb_filter_value_names <- function(x) {
  if (is.null(x) || !length(x)) return(character(0))
  nm <- names(x)
  nm <- as.character(nm %||% character(0))
  nm <- nm[!is.na(nm) & nzchar(nm) & nm != "(vacio)"]
  nm
}

.sm_mb_filter_to_source_spec <- function(filter, fallback = list()) {
  filter <- filter %||% list()
  statuses <- .sm_mb_char_vector(filter$statuses)
  if (!length(statuses)) statuses <- .sm_mb_filter_value_names(filter$kept_status_counts)
  if (!length(statuses)) statuses <- .sm_mb_filter_value_names(filter$original_status_counts)
  collectors <- .sm_mb_char_vector(filter$collector_ids)
  if (!length(collectors)) collectors <- .sm_mb_filter_value_names(filter$kept_collector_counts)
  out <- list(
    survey_id = .sm_mb_scalar(filter$survey_id %||% fallback$survey_id, ""),
    label = .sm_mb_scalar(filter$source_alias %||% filter$source_title %||% fallback$label, ""),
    source_alias = .sm_mb_scalar(filter$source_alias %||% fallback$source_alias %||% filter$source_title, ""),
    source_title = .sm_mb_scalar(filter$source_title %||% fallback$source_title, ""),
    pais = .sm_mb_scalar(filter$pais %||% fallback$pais, ""),
    response_statuses = as.list(statuses),
    keep_missing_status = if (!is.null(filter$keep_missing_status)) isTRUE(filter$keep_missing_status) else fallback$keep_missing_status,
    collector_ids = as.list(collectors),
    date_modified_gte = .sm_mb_scalar(filter$date_modified_gte %||% fallback$date_modified_gte, ""),
    date_modified_lte = .sm_mb_scalar(filter$date_modified_lte %||% fallback$date_modified_lte, ""),
    collection_strategy = .sm_mb_scalar(filter$collection_strategy %||% fallback$collection_strategy, ""),
    channel = .sm_mb_source_channel(filter, fallback$channel %||% fallback$source_channel %||% ""),
    source_channel = .sm_mb_source_channel(filter, fallback$channel %||% fallback$source_channel %||% ""),
    consent_var = .sm_mb_consent_from_spec(filter, fallback),
    validation_exclusion_profile = .sm_mb_scalar(filter$validation_exclusion_profile %||% fallback$validation_exclusion_profile, ""),
    excluded_validation_vars = as.list(.sm_mb_char_vector(filter$excluded_validation_vars %||% fallback$excluded_validation_vars))
  )
  out[vapply(out, function(v) !(is.null(v) || (length(v) == 1L && is.na(v))), logical(1))]
}

.sm_mb_spec_consent_var <- function(spec, fallback = list()) {
  direct <- .sm_mb_consent_from_spec(spec, fallback)
  if (nzchar(direct)) return(direct)
  source_items <- spec$sources %||% spec$campaigns %||% list()
  for (source in source_items) {
    direct <- .sm_mb_consent_from_spec(source, fallback)
    if (nzchar(direct)) return(direct)
  }
  ""
}

.sm_mb_spec_apply_consent <- function(spec, consent_var = "") {
  consent_var <- .sm_mb_scalar(consent_var, "")
  if (!nzchar(consent_var)) return(spec)
  if (!nzchar(.sm_mb_scalar(spec$consent_var, ""))) {
    spec$consent_var <- consent_var
  }
  source_items <- spec$sources %||% spec$campaigns %||% list()
  if (length(source_items)) {
    spec$sources <- lapply(source_items, function(source) {
      if (!nzchar(.sm_mb_scalar(source$consent_var, ""))) {
        source$consent_var <- consent_var
      }
      source
    })
    spec$campaigns <- NULL
  }
  spec
}

.sm_mb_spec_from_base <- function(base_name, base) {
  base_consent_var <- .sm_mb_spec_consent_var(base, base$response_filter %||% list())
  saved <- base$surveymonkey_source_spec %||% base$survey_source_spec %||% NULL
  if (is.list(saved) && length(saved)) {
    spec <- tryCatch(.sm_mb_normalize_survey_specs(list(saved))[[1]], error = function(e) NULL)
    if (!is.null(spec)) return(list(ok = TRUE, spec = .sm_mb_spec_apply_consent(spec, base_consent_var), issues = list()))
  }
  survey_id <- .sm_mb_scalar(base$survey_id, "")
  if (!nzchar(survey_id)) {
    return(list(ok = FALSE, spec = NULL, issues = list("Falta survey_id en metadata de la base.")))
  }
  label <- .sm_mb_scalar(base$source_alias %||% base$source_title %||% base_name, base_name)
  source_title <- .sm_mb_scalar(base$source_title %||% label, label)
  fallback <- list(
    survey_id = survey_id,
    label = label,
    source_alias = label,
    source_title = source_title,
    channel = .sm_mb_source_channel(base, ""),
    source_channel = .sm_mb_source_channel(base, ""),
    consent_var = base_consent_var,
    response_statuses = list("completed"),
    keep_missing_status = TRUE
  )
  rf <- base$response_filter %||% list()
  sources <- if (is.list(rf) && identical(.sm_mb_scalar(rf$kind, ""), "surveymonkey_multi_source_response_filter")) {
    lapply(rf$sources %||% list(), .sm_mb_filter_to_source_spec, fallback = fallback)
  } else if (is.list(rf) && length(rf)) {
    list(.sm_mb_filter_to_source_spec(rf, fallback = fallback))
  } else {
    list(fallback)
  }
  spec <- list(
    survey_id = survey_id,
    label = label,
    source_alias = label,
    source_title = source_title,
    pais = .sm_mb_scalar(base$pais, ""),
    consent_var = base_consent_var,
    sources = sources
  )
  list(ok = TRUE, spec = .sm_mb_normalize_survey_specs(list(spec))[[1]], issues = list())
}

.sm_mb_all_used_survey_ids <- function(bases) {
  out <- character(0)
  for (nm in names(bases)) {
    info <- .sm_mb_spec_from_base(nm, bases[[nm]])
    if (isTRUE(info$ok)) out <- c(out, .sm_mb_source_ids(info$spec))
  }
  unique(out[nzchar(out)])
}

.sm_mb_campaign_suggestions <- function(base_name, base, spec, catalog, used_ids = character()) {
  base_text <- paste(base_name, spec$label, spec$source_alias, spec$source_title, collapse = " ")
  base_tokens <- .sm_mb_tokenize_title(base_text)
  source_ids <- .sm_mb_source_ids(spec)
  used_ids <- unique(c(used_ids, source_ids))
  out <- list()
  for (item in catalog %||% list()) {
    sid <- .sm_mb_scalar(item$id %||% item$survey_id, "")
    if (!nzchar(sid) || sid %in% used_ids) next
    title <- .sm_mb_scalar(item$title, "")
    nick <- .sm_mb_scalar(item$nickname, "")
    txt <- paste(title, nick)
    proximity <- .sm_mb_name_proximity(base_tokens, .sm_mb_tokenize_title(txt))
    score <- proximity$score
    min_matches <- if (length(base_tokens) <= 2L) 1L else 2L
    if (score < 0.70 || proximity$n_matches < min_matches) next
    out[[length(out) + 1L]] <- list(
      survey_id = sid,
      title = title,
      nickname = if (nzchar(nick)) nick else NULL,
      label = .sm_mb_scalar(item$source_alias %||% item$label %||% title, title),
      date_modified = .sm_mb_scalar(item$date_modified, ""),
      response_count = suppressWarnings(as.integer(item$response_count %||% NA_integer_)),
      score = round(score, 3),
      preselected = isTRUE(score >= 0.84 && proximity$n_matches >= min_matches),
      reason = if (length(proximity$matches)) {
        paste("Proximidad de nombre:", paste(proximity$matches, collapse = ", "))
      } else {
        "Proximidad de nombre"
      }
    )
  }
  if (!length(out)) return(list())
  ord <- order(vapply(out, function(x) x$score, numeric(1)), decreasing = TRUE)
  out[ord]
}

.sm_mb_campaigns_from_request <- function(request_bases, base_name) {
  if (is.null(request_bases) || !length(request_bases)) return(list())
  for (item in request_bases) {
    nm <- .sm_mb_scalar(item$base_name %||% item$nombre %||% item$name, "")
    if (!identical(nm, base_name)) next
    return(item$campaigns %||% item$sources %||% list())
  }
  list()
}

.sm_mb_spec_with_campaigns <- function(spec, campaigns) {
  campaigns <- campaigns %||% list()
  if (!length(campaigns)) return(spec)
  current <- spec$sources %||% list(.sm_mb_normalize_source_spec(spec, fallback = spec))
  existing <- .sm_mb_source_ids(spec)
  extras <- list()
  for (camp in campaigns) {
    camp_spec <- tryCatch(.sm_mb_normalize_source_spec(camp, fallback = spec), error = function(e) NULL)
    if (is.null(camp_spec)) next
    sid <- .sm_mb_scalar(camp_spec$survey_id, "")
    if (!nzchar(sid) || sid %in% existing) next
    existing <- c(existing, sid)
    extras[[length(extras) + 1L]] <- camp_spec
  }
  spec$sources <- c(current, extras)
  spec
}

.sm_mb_structure_report <- function(spec, token) {
  source_ids <- .sm_mb_source_ids(spec)
  if (length(source_ids) <= 1L) {
    return(list(ok = TRUE, n_blocking = 0L, n_review = 0L, diffs = list()))
  }
  details <- list()
  for (sid in source_ids) {
    details[[sid]] <- tryCatch(sm_api_fetch_survey_details(sid, token), error = function(e) NULL)
  }
  ref_id <- source_ids[1]
  source_specs <- spec$sources %||% list(spec)
  source_spec_by_id <- list()
  for (source_spec in source_specs) {
    sid <- .sm_mb_scalar(source_spec$survey_id, "")
    if (nzchar(sid)) source_spec_by_id[[sid]] <- source_spec
  }
  if (is.null(details[[ref_id]])) {
    return(list(ok = FALSE, n_blocking = 1L, n_review = 0L, diffs = list(list(
      survey_id = ref_id, severity = "blocking", kind = "details",
      message = "No se pudo leer la fuente principal."
    ))))
  }
  ref_tbl <- .sm_mb_question_table(details[[ref_id]])
  diffs <- list()
  for (sid in source_ids[-1]) {
    cur <- details[[sid]]
    if (is.null(cur)) {
      diffs[[length(diffs) + 1L]] <- list(
        survey_id = sid, severity = "blocking", kind = "details",
        message = "No se pudo leer la fuente adicional."
      )
      next
    }
    cur_tbl <- .sm_mb_question_table(cur)
    source_spec <- source_spec_by_id[[sid]] %||% list(survey_id = sid)
    excluded_positions <- .sm_mb_excluded_positions_from_source(source_spec, ref_tbl)
    one <- .sm_mb_compare_to_ref(ref_tbl, cur_tbl, ignorable_missing_positions = excluded_positions)
    if (length(one)) {
      one <- lapply(one, function(d) {
        d$survey_id <- sid
        d
      })
      diffs <- c(diffs, one)
    }
  }
  n_blocking <- sum(vapply(diffs, function(d) identical(.sm_mb_scalar(d$severity, ""), "blocking"), logical(1)))
  n_review <- sum(vapply(diffs, function(d) identical(.sm_mb_scalar(d$severity, ""), "review"), logical(1)))
  list(ok = n_blocking == 0L, n_blocking = as.integer(n_blocking), n_review = as.integer(n_review), diffs = diffs)
}

.sm_mb_response_case_uid <- function(survey_id, response) {
  rid <- .sm_mb_scalar(response$response_id %||% response$id %||% response$respondent_id, "")
  if (!nzchar(rid)) return("")
  paste(.sm_mb_scalar(survey_id, ""), rid, sep = ":")
}

.sm_mb_case_ids_from_data <- function(df) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(character(0))
  if ("case_uid" %in% names(df)) return(as.character(df$case_uid))
  if ("survey_id" %in% names(df) && "response_id" %in% names(df)) return(paste(as.character(df$survey_id), as.character(df$response_id), sep = ":"))
  if ("survey_id" %in% names(df) && "respondent_id" %in% names(df)) return(paste(as.character(df$survey_id), as.character(df$respondent_id), sep = ":"))
  character(0)
}

.sm_mb_local_modified_map <- function(df) {
  ids <- .sm_mb_case_ids_from_data(df)
  if (!length(ids) || !"date_modified" %in% names(df)) return(list())
  vals <- as.character(df$date_modified)
  out <- as.list(vals)
  names(out) <- ids
  out
}

.sm_mb_read_base_original_data <- function(sid, base) {
  fid <- .sm_mb_scalar(base$original_data_file_id %||% base$data_file_id, "")
  if (!nzchar(fid)) return(data.frame())
  meta <- get_file(sid, fid)
  as.data.frame(.read_data_any_path(meta$path, meta$ext), stringsAsFactors = FALSE, check.names = FALSE)
}

.sm_mb_fetch_filtered_response_refs <- function(spec, token, inst = NULL) {
  out <- list()
  filters <- list()
  source_specs <- spec$sources %||% list(spec)
  for (source_spec in source_specs) {
    source_id <- .sm_mb_scalar(source_spec$survey_id, spec$survey_id)
    statuses <- .sm_mb_char_vector(source_spec$response_statuses)
    if (!length(statuses)) statuses <- .sm_mb_char_vector(spec$response_statuses)
    if (!length(statuses)) statuses <- c("completed")
    keep_missing <- source_spec$keep_missing_status
    if (is.null(keep_missing)) keep_missing <- spec$keep_missing_status
    if (is.null(keep_missing)) keep_missing <- TRUE
    source_consent_var <- .sm_mb_consent_from_spec(source_spec, spec)
    source_details <- NULL
    if (!is.null(inst)) {
      source_details <- tryCatch(sm_api_fetch_survey_details(source_id, token), error = function(e) NULL)
    }
    payload <- sm_api_fetch_all_responses_bulk(source_id, token)
    filtered <- .sm_mb_filter_responses(
      payload$data,
      statuses = statuses,
      keep_missing_status = isTRUE(keep_missing),
      collector_ids = .sm_mb_char_vector(source_spec$collector_ids),
      date_modified_gte = .sm_mb_scalar(source_spec$date_modified_gte %||% spec$date_modified_gte, ""),
      date_modified_lte = .sm_mb_scalar(source_spec$date_modified_lte %||% spec$date_modified_lte, "")
    )
    filter_info <- attr(filtered, "sm_response_filter", exact = TRUE) %||% list()
    if (!is.null(source_details) && !is.null(inst)) {
      consent <- .sm_mb_filter_raw_responses_by_consent(
        filtered,
        source_details,
        inst,
        consent_var = source_consent_var
      )
      filtered <- consent$responses
      if (isTRUE(consent$filter$consent_required)) {
        filter_info <- .sm_mb_filter_info_apply_consent(
          filter_info,
          before_values = unlist(consent$filter$consent_values_before %||% list(), use.names = FALSE),
          after_values = unlist(consent$filter$consent_values_after %||% list(), use.names = FALSE),
          consent_var = consent$filter$consent_var %||% ""
        )
        filter_info$original_consent_counts <- consent$filter$original_consent_counts %||% list()
        filter_info$kept_consent_counts <- consent$filter$kept_consent_counts %||% list()
        filter_info$consent_excluded_rows <- consent$filter$consent_excluded_rows %||% 0L
        filter_info$kept_status_counts <- .sm_mb_response_count_map(filtered, "response_status")
      }
    }
    filters[[length(filters) + 1L]] <- filter_info
    for (resp in filtered) {
      uid <- .sm_mb_response_case_uid(source_id, resp)
      if (!nzchar(uid)) next
      out[[length(out) + 1L]] <- list(
        case_uid = uid,
        survey_id = source_id,
        response_id = .sm_mb_scalar(resp$response_id %||% resp$id %||% resp$respondent_id, ""),
        date_modified = .sm_mb_scalar(resp$date_modified %||% resp$date_created, "")
      )
    }
  }
  list(responses = out, filter = .sm_mb_response_filter_total(filters))
}

.sm_mb_incremental_counts <- function(sid, base_name, base, spec, token) {
  local_df <- .sm_mb_read_base_original_data(sid, base)
  local_ids <- unique(.sm_mb_case_ids_from_data(local_df))
  local_mod <- .sm_mb_local_modified_map(local_df)
  inst <- tryCatch({
    xls_id <- .sm_mb_scalar(base$original_xlsform_file_id %||% base$xlsform_file_id, "")
    if (!nzchar(xls_id)) NULL else reporte_instrumento(path = get_file(sid, xls_id)$path)
  }, error = function(e) NULL)
  refs <- .sm_mb_fetch_filtered_response_refs(spec, token, inst = inst)
  remote_ids <- vapply(refs$responses, function(x) x$case_uid, character(1))
  new_ids <- setdiff(remote_ids, local_ids)
  edited <- character(0)
  for (resp in refs$responses) {
    uid <- resp$case_uid
    if (!(uid %in% local_ids)) next
    old_mod <- .sm_mb_scalar(local_mod[[uid]], "")
    new_mod <- .sm_mb_scalar(resp$date_modified, "")
    if (nzchar(old_mod) && nzchar(new_mod) && !identical(old_mod, new_mod)) edited <- c(edited, uid)
  }
  list(
    current_rows = as.integer(nrow(local_df)),
    remote_rows = as.integer(length(remote_ids)),
    new_rows = as.integer(length(unique(new_ids))),
    edited_rows = as.integer(length(unique(edited))),
    edited_case_uids = as.list(utils::head(unique(edited), 20L)),
    response_filter = refs$filter
  )
}

.sm_mb_refresh_action <- function(counts, structure, accepted = list()) {
  if (nzchar(.sm_mb_scalar(counts$error, ""))) return("error")
  accepted_count <- length(accepted %||% list())
  new_rows <- suppressWarnings(as.integer(counts$new_rows %||% NA_integer_))
  no_new_known <- is.finite(new_rows) && new_rows <= 0L
  has_new <- is.finite(new_rows) && new_rows > 0L
  structure_ok <- isTRUE(structure$ok)
  if (!accepted_count && no_new_known) {
    return(if (structure_ok) "noop" else "noop_structure_warning")
  }
  if (structure_ok) return("update")
  if (has_new || accepted_count) return("blocked")
  "blocked"
}

.sm_mb_refresh_action_updateable <- function(action) {
  action %in% c("update", "noop", "noop_structure_warning")
}

.sm_mb_refresh_source_log <- function(spec, status = "", refreshed = FALSE, reason = "") {
  spec <- spec %||% list()
  source_specs <- spec$sources %||% list(spec)
  unname(lapply(seq_along(source_specs), function(i) {
    source <- source_specs[[i]] %||% list()
    list(
      index = as.integer(i),
      survey_id = .sm_mb_scalar(source$survey_id %||% spec$survey_id, ""),
      source_title = .sm_mb_scalar(source$source_title %||% source$label %||% spec$source_title, ""),
      source_alias = .sm_mb_scalar(source$source_alias %||% source$label %||% "", ""),
      channel = .sm_mb_source_channel(source, spec$source_channel %||% spec$channel %||% ""),
      refreshed = isTRUE(refreshed),
      status = .sm_mb_scalar(status, ""),
      reason = .sm_mb_scalar(reason, "")
    )
  }))
}

.sm_mb_prepare_refresh_snapshot <- function(sid, base_name, spec, token) {
  details <- sm_api_fetch_survey_details(spec$survey_id, token)
  xls_model <- sm_api_xlsform(details, style = .sm_api_default_style(), lang = "es")
  logic_sync <- .sm_mb_apply_shared_logic_to_model(sid, base_name, xls_model)
  xls_model <- logic_sync$model
  downloads_dir <- file.path(session_get(sid)$dir, "downloads")
  dir.create(downloads_dir, recursive = TRUE, showWarnings = FALSE)
  inst_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", base_name, "_refresh_xlsform.xlsx"))
  .sm_mb_write_xlsform_model(xls_model, inst_path)
  rp_inst <- reporte_instrumento(path = inst_path)

  source_dfs <- list()
  source_filters <- list()
  raw_snapshot_sources <- list()
  source_specs <- spec$sources %||% list(spec)
  for (source_spec in source_specs) {
    source_id <- .sm_mb_scalar(source_spec$survey_id, spec$survey_id)
    source_details <- if (identical(source_id, spec$survey_id)) details else sm_api_fetch_survey_details(source_id, token)
    source_title <- .sm_mb_trim(source_spec$source_title %||% source_details$title %||% source_spec$label %||% spec$source_title)
    source_alias <- .sm_mb_trim(source_spec$source_alias %||% source_spec$label %||% source_title)
    statuses <- .sm_mb_char_vector(source_spec$response_statuses)
    if (!length(statuses)) statuses <- .sm_mb_char_vector(spec$response_statuses)
    if (!length(statuses)) statuses <- c("completed")
    keep_missing <- source_spec$keep_missing_status
    if (is.null(keep_missing)) keep_missing <- spec$keep_missing_status
    if (is.null(keep_missing)) keep_missing <- TRUE
    collection_strategy <- .sm_mb_collection_strategy(source_spec, spec$collection_strategy %||% "")
    source_channel <- .sm_mb_source_channel(source_spec, spec$channel %||% spec$source_channel %||% "")
    source_consent_var <- .sm_mb_consent_from_spec(source_spec, spec)
    validation_profile <- .sm_mb_validation_exclusion_profile(source_spec, collection_strategy)
    excluded_vars <- .sm_mb_excluded_validation_vars(source_spec, validation_profile, rp_inst)
    payload <- sm_api_fetch_all_responses_bulk(source_id, token)
    raw_snapshot_sources[[length(raw_snapshot_sources) + 1L]] <- .sm_mb_source_snapshot(
      source_id = source_id,
      source_spec = source_spec,
      source_details = source_details,
      payload = payload,
      token = token
    )
    one_df <- sm_multibase_api_responses_to_canonical_data(
      details = source_details,
      responses = payload$data,
      inst = rp_inst,
      survey_id = source_id,
      pais = .sm_mb_scalar(source_spec$pais, spec$pais),
      source_title = source_title,
      source_channel = source_channel,
      company_vars = character(0),
      response_statuses = statuses,
      keep_missing_status = isTRUE(keep_missing),
      collector_ids = unique(.sm_mb_char_vector(source_spec$collector_ids)),
      date_modified_gte = .sm_mb_scalar(source_spec$date_modified_gte %||% spec$date_modified_gte, ""),
      date_modified_lte = .sm_mb_scalar(source_spec$date_modified_lte %||% spec$date_modified_lte, ""),
      consent_var = source_consent_var
    )
    one_filter <- attr(one_df, "sm_response_filter", exact = TRUE) %||% list()
    one_filter$survey_id <- source_id
    one_filter$source_title <- source_title
    one_filter$source_alias <- source_alias
    one_filter$collection_strategy <- collection_strategy
    one_filter$channel <- source_channel
    one_filter$source_channel <- source_channel
    one_filter$consent_var <- source_consent_var
    one_filter$validation_exclusion_profile <- validation_profile
    one_filter$excluded_validation_vars <- as.list(excluded_vars)
    source_dfs[[length(source_dfs) + 1L]] <- one_df
    source_filters[[length(source_filters) + 1L]] <- one_filter
  }
  remote_df <- .sm_mb_bind_rows(source_dfs)
  remote_df <- normalize_data_for_xlsform(remote_df, rp_inst)
  list(
    inst_path = inst_path,
    rp_inst = rp_inst,
    remote_df = remote_df,
    response_filter = .sm_mb_response_filter_total(source_filters),
    raw_snapshot_sources = raw_snapshot_sources,
    decision_policy = .sm_mb_default_decision_policy(spec, rp_inst, .sm_mb_response_filter_total(source_filters)),
    source_kind = if (length(source_specs) > 1L) "surveymonkey_api_multi_source" else "surveymonkey_api",
    xlsform_logic_sync = logic_sync[setdiff(names(logic_sync), "model")]
  )
}

.sm_mb_prepare_raw_snapshot <- function(sid, base_name, spec, token, rp_inst = NULL) {
  details <- sm_api_fetch_survey_details(spec$survey_id, token)
  if (is.null(rp_inst)) {
    xls_model <- sm_api_xlsform(details, style = .sm_api_default_style(), lang = "es")
    downloads_dir <- file.path(session_get(sid)$dir, "downloads")
    dir.create(downloads_dir, recursive = TRUE, showWarnings = FALSE)
    inst_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", base_name, "_raw_xlsform.xlsx"))
    .sm_mb_write_xlsform_model(xls_model, inst_path)
    rp_inst <- reporte_instrumento(path = inst_path)
  }
  raw_snapshot_sources <- list()
  source_specs <- spec$sources %||% list(spec)
  for (source_spec in source_specs) {
    source_id <- .sm_mb_scalar(source_spec$survey_id, spec$survey_id)
    source_details <- if (identical(source_id, spec$survey_id)) details else sm_api_fetch_survey_details(source_id, token)
    payload <- sm_api_fetch_all_responses_bulk(source_id, token)
    raw_snapshot_sources[[length(raw_snapshot_sources) + 1L]] <- .sm_mb_source_snapshot(
      source_id = source_id,
      source_spec = source_spec,
      source_details = source_details,
      payload = payload,
      token = token
    )
  }
  list(
    raw_snapshot_sources = raw_snapshot_sources,
    decision_policy = .sm_mb_default_decision_policy(spec, rp_inst, list()),
    source_kind = if (length(source_specs) > 1L) "surveymonkey_api_multi_source" else "surveymonkey_api"
  )
}

.sm_mb_merge_new_rows <- function(local_df, remote_df, rp_inst) {
  local_df <- as.data.frame(local_df, stringsAsFactors = FALSE, check.names = FALSE)
  remote_df <- as.data.frame(remote_df, stringsAsFactors = FALSE, check.names = FALSE)
  local_ids <- unique(.sm_mb_case_ids_from_data(local_df))
  remote_ids <- .sm_mb_case_ids_from_data(remote_df)
  add_idx <- which(nzchar(remote_ids) & !(remote_ids %in% local_ids))
  new_rows <- if (length(add_idx)) remote_df[add_idx, , drop = FALSE] else remote_df[0, , drop = FALSE]
  cols <- unique(c(names(local_df), names(new_rows)))
  for (nm in setdiff(cols, names(local_df))) local_df[[nm]] <- NA
  for (nm in setdiff(cols, names(new_rows))) new_rows[[nm]] <- NA
  combined <- rbind(local_df[, cols, drop = FALSE], new_rows[, cols, drop = FALSE])
  combined <- normalize_data_for_xlsform(combined, rp_inst)
  list(data = combined, n_new = as.integer(nrow(new_rows)))
}

.sm_mb_base_current_is_adapted <- function(s, base) {
  xls <- s$files[[.sm_mb_scalar(base$xlsform_file_id, "")]]
  dat <- s$files[[.sm_mb_scalar(base$data_file_id, "")]]
  identical(as.character((xls %||% list())$kind %||% ""), "instrumento_adaptado") ||
    identical(as.character((dat %||% list())$kind %||% ""), "data_adaptada")
}

.sm_mb_base_has_downstream_progress <- function(s, base_name, base) {
  status <- (base %||% list())$status %||% list()
  status_hit <- any(vapply(c("validacion", "codificacion", "codificacion_adaptada", "analitica", "graficos"), function(k) {
    isTRUE(status[[k]])
  }, logical(1)))
  if (isTRUE(status_hit)) return(TRUE)
  ast <- if (!is.null(s$analitica_status_por_base) && is.list(s$analitica_status_por_base)) {
    s$analitica_status_por_base[[base_name]] %||% list()
  } else {
    list()
  }
  gst <- if (!is.null(s$graficos_status_por_base) && is.list(s$graficos_status_por_base)) {
    s$graficos_status_por_base[[base_name]] %||% list()
  } else {
    list()
  }
  any(vapply(c(ast, gst), isTRUE, logical(1)))
}

.sm_mb_update_base_refresh_files <- function(sid, base_name, inst_meta, data_meta, rp_inst,
                                             rp_data, spec, response_filter, source_kind,
                                             keep_current = FALSE, n_new = 0L,
                                             raw_snapshot_file_id = "",
                                             decision_policy = NULL,
                                             decision_audit = NULL,
                                             xlsform_logic_sync = NULL) {
  s <- session_get(sid)
  session_before_refresh <- s
  base <- s$estudio$bases[[base_name]]
  reapply_universe <- isTRUE((base$universe_filter %||% list())$enabled)
  if (reapply_universe && !exists("carga_universe_filter_reapply", mode = "function")) {
    stop_api(
      500,
      "E_UNIVERSE_FILTER_REAPPLY_UNAVAILABLE",
      "No se pudo reaplicar el filtro de universo tras refrescar SurveyMonkey."
    )
  }
  base$original_xlsform_file_id <- inst_meta$file_id
  base$original_data_file_id <- data_meta$file_id
  base$original_data_ext <- data_meta$ext
  if (!isTRUE(keep_current)) {
    base$xlsform_file_id <- inst_meta$file_id
    base$data_file_id <- data_meta$file_id
    base$data_ext <- data_meta$ext
    s$rp_inst_sources[[base_name]] <- rp_inst
    s$rp_data_sources[[base_name]] <- rp_data
    base$n_filas <- nrow(rp_data)
    base$n_columnas <- ncol(rp_data)
  }
  base$source_kind <- source_kind
  base$survey_id <- spec$survey_id
  base$source_alias <- .sm_mb_scalar(spec$source_alias %||% spec$label %||% base$source_alias, base_name)
  base$source_title <- .sm_mb_scalar(spec$source_title %||% base$source_title, "")
  base$source_channel <- .sm_mb_source_channel(spec, base$source_channel %||% "")
  base$consent_var <- .sm_mb_spec_consent_var(spec, response_filter %||% list())
  base$response_filter <- response_filter
  base$surveymonkey_source_spec <- spec
  if (nzchar(.sm_mb_scalar(raw_snapshot_file_id, ""))) {
    base$surveymonkey_raw_snapshot_file_id <- .sm_mb_scalar(raw_snapshot_file_id, "")
  }
  if (!is.null(decision_policy)) base$surveymonkey_decision_policy <- decision_policy
  if (!is.null(decision_audit)) base$surveymonkey_decision_audit <- decision_audit
  base$surveymonkey_refreshed_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  base$surveymonkey_last_refresh <- list(
    refreshed_at = base$surveymonkey_refreshed_at,
    n_new = as.integer(n_new),
    source_count = as.integer(length(spec$sources %||% list(spec)))
  )
  if (is.list(xlsform_logic_sync) && length(xlsform_logic_sync)) {
    base$surveymonkey_last_refresh$xlsform_logic_sync <- xlsform_logic_sync
    if (isTRUE(xlsform_logic_sync$applied)) {
      base$logic_template_base <- .sm_mb_scalar(xlsform_logic_sync$template_base %||% base$logic_template_base, "")
      base$logic_template_applied_at <- base$surveymonkey_refreshed_at
      base$logic_template_status <- "refresh_reapplied"
    } else if (nzchar(.sm_mb_scalar(xlsform_logic_sync$reason, ""))) {
      base$logic_template_status <- paste0("refresh_not_reapplied:", .sm_mb_scalar(xlsform_logic_sync$reason, ""))
    }
  }
  s$estudio$bases[[base_name]] <- base
  if (!is.null(s$codif_por_base) && !is.null(s$codif_por_base[[base_name]])) {
    s$codif_por_base[[base_name]]$inst <- NULL
    s$codif_por_base[[base_name]]$data <- NULL
  }
  if (!isTRUE(keep_current)) {
    s <- .invalidate_processing_state(s, base_name)
  }
  first <- names(s$estudio$bases)[1]
  if (identical(first, base_name) && !isTRUE(keep_current)) {
    s$rp_inst <- s$rp_inst_sources[[base_name]]
    s$rp_data <- s$rp_data_sources[[base_name]]
  }
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  if (reapply_universe) {
    tryCatch(
      carga_universe_filter_reapply(sid, base_name, data_meta$file_id),
      error = function(err) {
        .session_env[[sid]] <- session_before_refresh
        stop(err)
      }
    )
    return(invisible(session_get(sid)$estudio$bases[[base_name]]))
  }
  invisible(base)
}

.sm_mb_update_base_raw_snapshot <- function(sid, base_name, spec, raw_snapshot_file_id,
                                            decision_policy = NULL,
                                            source_kind = "",
                                            n_new = 0L) {
  s <- session_get(sid)
  base <- s$estudio$bases[[base_name]]
  if (is.null(base)) stop_api(404, "E_BASE_NOT_FOUND", sprintf("Base '%s' no existe.", base_name))
  fid <- .sm_mb_scalar(raw_snapshot_file_id, "")
  if (!nzchar(fid)) stop_api(500, "E_SM_RAW_SNAPSHOT_SAVE", "No se pudo guardar el snapshot raw SurveyMonkey.")
  base$surveymonkey_raw_snapshot_file_id <- fid
  base$surveymonkey_source_spec <- spec
  if (nzchar(.sm_mb_scalar(source_kind, ""))) base$source_kind <- .sm_mb_scalar(source_kind, "")
  base$survey_id <- .sm_mb_scalar(spec$survey_id %||% base$survey_id, "")
  base$source_alias <- .sm_mb_scalar(spec$source_alias %||% spec$label %||% base$source_alias, base_name)
  base$source_title <- .sm_mb_scalar(spec$source_title %||% base$source_title, "")
  base$source_channel <- .sm_mb_source_channel(spec, base$source_channel %||% "")
  has_policy <- is.list(base$surveymonkey_decision_policy) && length(base$surveymonkey_decision_policy)
  if (!has_policy && !is.null(decision_policy)) base$surveymonkey_decision_policy <- decision_policy
  base$surveymonkey_refreshed_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  base$surveymonkey_last_refresh <- list(
    refreshed_at = base$surveymonkey_refreshed_at,
    n_new = as.integer(n_new),
    source_count = as.integer(length(spec$sources %||% list(spec))),
    raw_snapshot_regenerated = TRUE
  )
  s$estudio$bases[[base_name]] <- base
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(base)
}

.sm_mb_regenerate_raw_snapshot_for_base <- function(sid, base_name, base, spec, token) {
  xls_fid <- .sm_mb_scalar(base$original_xlsform_file_id %||% base$xlsform_file_id, "")
  rp_inst <- if (nzchar(xls_fid)) {
    tryCatch(reporte_instrumento(path = get_file(sid, xls_fid)$path), error = function(e) NULL)
  } else {
    NULL
  }
  snapshot <- .sm_mb_prepare_raw_snapshot(
    sid = sid,
    base_name = base_name,
    spec = spec,
    token = token,
    rp_inst = rp_inst
  )
  raw_meta <- .sm_mb_save_raw_snapshot(
    sid = sid,
    base_name = base_name,
    spec = spec,
    sources = snapshot$raw_snapshot_sources,
    policy = snapshot$decision_policy %||% list()
  )
  .sm_mb_update_base_raw_snapshot(
    sid = sid,
    base_name = base_name,
    spec = spec,
    raw_snapshot_file_id = raw_meta$file_id %||% "",
    decision_policy = snapshot$decision_policy %||% NULL,
    source_kind = snapshot$source_kind %||% ""
  )
  list(
    ok = TRUE,
    raw_snapshot_file_id = raw_meta$file_id %||% "",
    source_count = as.integer(length(snapshot$raw_snapshot_sources %||% list()))
  )
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
        source_channel = .sm_mb_source_channel(spec, ""),
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
        source_channel = .sm_mb_source_channel(spec, ""),
        company_vars = company_vars,
        consent_var = .sm_mb_consent_from_spec(spec)
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
    base = .estudio_base_payload(base_meta, session_get(sid, required = FALSE)),
    estudio = .estudio_payload(sid),
    audit = audit,
    source_filters = source_filters,
    n_filas = as.integer(nrow(data_df)),
    n_columnas = as.integer(ncol(data_df))
  )
}

sm_multibase_import_independent <- function(sid,
                                            specs,
                                            token,
                                            response_statuses = c("completed"),
                                            keep_missing_status = TRUE,
                                            canonical_file_id = "",
                                            use_canonical_xlsform_logic = FALSE,
                                            logic_rules = "",
                                            logic_rules_by_survey = NULL,
                                            logic_pages = NULL,
                                            choice_order_overrides = NULL,
                                            choice_code_maps = NULL,
                                            replace_existing_logic = FALSE) {
  specs <- .sm_mb_normalize_survey_specs(specs)
  if (!length(specs)) stop_api(400, "E_SM_NO_SURVEYS", "Selecciona al menos una encuesta.")
  logic_rules <- .sm_mb_scalar(logic_rules, "")
  has_direct_logic <- nzchar(trimws(logic_rules))
  logic_rules_by_survey <- .sm_mb_logic_rules_by_survey(logic_rules_by_survey)
  logic_pages <- .sm_mb_logic_pages(logic_pages)
  choice_order_overrides <- .sm_mb_logic_choice_order_overrides(choice_order_overrides)

  existing <- estudio_list_bases(sid)
  if (length(existing) > 0L && !estudio_is_independent_siblings(sid)) {
    stop_api(409, "E_ESTUDIO_MODE_CONFLICT",
             "El estudio ya tiene bases en otro modo. Crea un estudio nuevo o importa sobre uno de bases hermanas independientes.")
  }
  existing_names <- names(existing)
  active_before <- if (length(existing_names)) {
    tryCatch(estudio_active_base(sid), error = function(e) existing_names[1])
  } else {
    NULL
  }
  independent_limit <- if (exists(".ESTUDIO_INDEPENDENT_SIBLINGS_MAX_BASES", mode = "any")) {
    .ESTUDIO_INDEPENDENT_SIBLINGS_MAX_BASES
  } else {
    10L
  }
  if ((length(existing) + length(specs)) > independent_limit) {
    stop_api(400, "E_BASE_LIMITE",
             sprintf("La importacion excede el limite de %d bases hermanas independientes.", independent_limit))
  }

  audit <- tryCatch(
    sm_multibase_audit(specs, token, canonical_inst = NULL),
    error = function(e) list(
      ok = FALSE,
      informational_only = TRUE,
      error = conditionMessage(e),
      surveys = list(),
      diffs = list()
    )
  )
  canonical_logic <- NULL
  if (isTRUE(use_canonical_xlsform_logic) || nzchar(.sm_mb_scalar(canonical_file_id, ""))) {
    canonical_logic <- tryCatch(
      .sm_mb_canonical_inst(sid, .sm_mb_scalar(canonical_file_id, "")),
      error = function(e) e
    )
    if (inherits(canonical_logic, "error")) {
      stop_api(
        409,
        "E_NO_CANONICAL_XLSFORM",
        paste0("No encontré el XLSForm base para aplicar la lógica: ", conditionMessage(canonical_logic))
      )
    }
  }
  if (!is.null(canonical_logic)) {
    audit <- tryCatch(
      sm_multibase_audit(specs, token, canonical_inst = canonical_logic$inst %||% NULL),
      error = function(e) {
        audit$error <- conditionMessage(e)
        audit
      }
    )
  }
  fetched <- .sm_mb_fetch_family(specs, token)
  summaries_by_id <- .sm_mb_summary_lookup(fetched$summaries)
  family_id <- if (exists("estudio_independent_family_id", mode = "function")) {
    estudio_independent_family_id(sid) %||% uuid::UUIDgenerate()
  } else {
    uuid::UUIDgenerate()
  }
  imported_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  downloads_dir <- file.path(session_get(sid)$dir, "downloads")
  dir.create(downloads_dir, recursive = TRUE, showWarnings = FALSE)

  prepared <- list()
  planned_names <- names(existing)
  for (spec in specs) {
    details <- fetched$details[[spec$survey_id]]
    if (is.null(details)) {
      stop_api(502, "E_SM_SURVEY_DETAILS",
               sprintf("No se pudo leer la encuesta SurveyMonkey '%s'.", spec$survey_id))
    }
    summary <- summaries_by_id[[spec$survey_id]] %||% list()
    title <- .sm_mb_scalar(summary$title, spec$source_title %||% spec$label %||% spec$survey_id)
    pais <- .sm_mb_scalar(spec$pais, summary$pais %||% "")
    label <- .sm_mb_independent_base_label(spec, summary)
    base_name <- .sm_mb_slug(label)
    if (!nzchar(base_name)) base_name <- paste0("survey_", spec$survey_id)
    base_name <- substr(base_name, 1L, 72L)
    base_name <- gsub("_+$", "", base_name)
    if (!nzchar(base_name)) base_name <- paste0("survey_", spec$survey_id)
    base0 <- base_name
    idx <- 2L
    while (base_name %in% planned_names) {
      suffix <- paste0("_", idx)
      base_name <- paste0(substr(base0, 1L, max(1L, 72L - nchar(suffix))), suffix)
      idx <- idx + 1L
    }
    planned_names <- c(planned_names, base_name)

    xls_model <- sm_api_xlsform(details, style = .sm_api_default_style(), lang = "es")
    direct_logic_sync <- NULL
    specific_logic_rules <- .sm_mb_scalar(logic_rules_by_survey[[spec$survey_id]], "")
    specific_logic <- nzchar(trimws(specific_logic_rules))
    applied_logic_rules <- if (specific_logic) specific_logic_rules else logic_rules
    if (isTRUE(has_direct_logic) || specific_logic) {
      xls_model <- tryCatch(
        surveymonkey_aplicar_logica(
          xls_model,
          applied_logic_rules,
          xls_model$sm_logic,
          paginas = logic_pages,
          choice_order_overrides = choice_order_overrides,
          choice_code_maps = choice_code_maps,
          replace_existing = isTRUE(replace_existing_logic)
        ),
        error = function(e) {
          stop_api(
            400,
            "E_SM_LOGIC_APPLY_FAILED",
            sprintf("No se pudo aplicar la lógica SurveyMonkey a '%s': %s", label, conditionMessage(e))
          )
        }
      )
      direct_logic_sync <- list(
        kind = "surveymonkey_direct_logic",
        source = "import_independent",
        applied = TRUE,
        applied_at = imported_at,
        rules_count = as.integer(nrow(surveymonkey_parsear_logica(applied_logic_rules))),
        rules_scope = if (specific_logic) "survey" else "global",
        survey_id = spec$survey_id,
        replace_existing = isTRUE(replace_existing_logic)
      )
    }
    canonical_sync <- NULL
    if (!is.null(canonical_logic)) {
      canonical_sync <- .sm_mb_apply_canonical_logic_to_model(canonical_logic, xls_model)
      xls_model <- canonical_sync$model
    }
    inst_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", base_name, "_xlsform.xlsx"))
    .sm_mb_write_xlsform_model(xls_model, inst_path)
    rp_inst <- reporte_instrumento(path = inst_path)

    source_dfs <- list()
    source_filters <- list()
    raw_snapshot_sources <- list()
    source_specs <- spec$sources %||% list(spec)
    for (source_spec in source_specs) {
      source_id <- .sm_mb_scalar(source_spec$survey_id, spec$survey_id)
      source_details <- if (identical(source_id, spec$survey_id)) {
        details
      } else {
        sm_api_fetch_survey_details(source_id, token)
      }
      source_alias <- .sm_mb_trim(source_spec$source_alias %||% source_spec$label %||% "")
      source_title <- .sm_mb_trim(source_spec$source_title %||% source_details$title %||% source_spec$label %||% title)
      if (!nzchar(source_title)) source_title <- if (nzchar(source_alias)) source_alias else title
      source_pais <- .sm_mb_scalar(source_spec$pais, pais)
      source_statuses <- .sm_mb_char_vector(source_spec$response_statuses)
      if (!length(source_statuses)) source_statuses <- .sm_mb_char_vector(spec$response_statuses)
      if (!length(source_statuses)) source_statuses <- response_statuses
      source_keep_missing <- source_spec$keep_missing_status
      if (is.null(source_keep_missing)) source_keep_missing <- spec$keep_missing_status
      if (is.null(source_keep_missing)) source_keep_missing <- isTRUE(keep_missing_status)
      source_collectors <- unique(.sm_mb_char_vector(source_spec$collector_ids))
      source_date_gte <- .sm_mb_scalar(source_spec$date_modified_gte %||% spec$date_modified_gte, "")
      source_date_lte <- .sm_mb_scalar(source_spec$date_modified_lte %||% spec$date_modified_lte, "")
      source_data_file_id <- .sm_mb_scalar(source_spec$data_file_id, "")
      source_collection_strategy <- .sm_mb_collection_strategy(source_spec, spec$collection_strategy %||% "")
      source_channel <- .sm_mb_source_channel(source_spec, spec$channel %||% spec$source_channel %||% "")
      source_consent_var <- .sm_mb_consent_from_spec(source_spec, spec)
      source_validation_profile <- .sm_mb_validation_exclusion_profile(source_spec, source_collection_strategy)
      source_excluded_vars <- .sm_mb_excluded_validation_vars(source_spec, source_validation_profile, rp_inst)

      if (nzchar(source_data_file_id)) {
        one_df <- .sm_mb_read_upload_data(
          sid = sid,
          file_id = source_data_file_id,
          details = source_details,
          inst = rp_inst,
          survey_id = source_id,
          pais = source_pais,
          source_title = source_title,
          source_channel = source_channel,
          company_vars = character(0)
        )
        one_filter <- list(
          kind = "uploaded_data",
          survey_id = source_id,
          source_title = source_title,
          source_alias = source_alias,
          collection_strategy = source_collection_strategy,
          channel = source_channel,
          source_channel = source_channel,
          consent_var = source_consent_var,
          validation_exclusion_profile = source_validation_profile,
          excluded_validation_vars = as.list(source_excluded_vars),
          original_rows = as.integer(nrow(one_df)),
          kept_rows = as.integer(nrow(one_df)),
          excluded_rows = 0L
        )
      } else {
        payload <- sm_api_fetch_all_responses_bulk(source_id, token)
        raw_snapshot_sources[[length(raw_snapshot_sources) + 1L]] <- .sm_mb_source_snapshot(
          source_id = source_id,
          source_spec = source_spec,
          source_details = source_details,
          payload = payload,
          token = token
        )
        one_df <- sm_multibase_api_responses_to_canonical_data(
          details = source_details,
          responses = payload$data,
          inst = rp_inst,
          survey_id = source_id,
          pais = source_pais,
          source_title = source_title,
          source_channel = source_channel,
          company_vars = character(0),
          response_statuses = source_statuses,
          keep_missing_status = isTRUE(source_keep_missing),
          collector_ids = source_collectors,
          date_modified_gte = source_date_gte,
          date_modified_lte = source_date_lte,
          consent_var = source_consent_var
        )
        one_filter <- attr(one_df, "sm_response_filter", exact = TRUE) %||% list()
        one_filter$survey_id <- source_id
        one_filter$source_title <- source_title
        one_filter$source_alias <- source_alias
        one_filter$collection_strategy <- source_collection_strategy
        one_filter$channel <- source_channel
        one_filter$source_channel <- source_channel
        one_filter$consent_var <- source_consent_var
        one_filter$validation_exclusion_profile <- source_validation_profile
        one_filter$excluded_validation_vars <- as.list(source_excluded_vars)
      }
      source_dfs[[length(source_dfs) + 1L]] <- one_df
      source_filters[[length(source_filters) + 1L]] <- one_filter
    }
    data_df <- .sm_mb_bind_rows(source_dfs)
    response_filter <- .sm_mb_response_filter_total(source_filters)
    decision_policy <- .sm_mb_default_decision_policy(spec, rp_inst, response_filter)

    if (!is.data.frame(data_df) || !nrow(data_df)) {
      stop_api(409, "E_SM_NO_RESPONSES",
               sprintf("La encuesta '%s' (%s) no tiene respuestas completas para importar.", title, spec$survey_id))
    }
    data_df <- normalize_data_for_xlsform(data_df, rp_inst)
    .carga_assert_data_xlsform_compatible(data_df, rp_inst)
    data_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", base_name, "_data.xlsx"))
    .sm_mb_write_xlsx(data_df, data_path)
    rp_data <- reporte_data(data_df, instrumento = rp_inst)

    prepared[[length(prepared) + 1L]] <- list(
      base_name = base_name,
      title = title,
      source_alias = label,
      source_channel = .sm_mb_source_channel(spec, ""),
      consent_var = .sm_mb_spec_consent_var(spec, response_filter %||% list()),
      pais = pais,
      survey_id = spec$survey_id,
      source_spec = spec,
      inst_path = inst_path,
      data_path = data_path,
      rp_inst = rp_inst,
      rp_data = rp_data,
      n_filas = as.integer(nrow(data_df)),
      n_columnas = as.integer(ncol(data_df)),
      response_filter = response_filter %||% list(),
      decision_policy = decision_policy,
      raw_snapshot_sources = raw_snapshot_sources,
      canonical_logic_sync = canonical_sync,
      direct_logic_sync = direct_logic_sync,
      source_kind = if (length(source_specs) > 1L) {
        "surveymonkey_api_multi_source"
      } else if (nzchar(spec$data_file_id)) {
        "surveymonkey_upload"
      } else {
        "surveymonkey_api"
      }
    )
  }

  estudio_ensure(sid)
  estudio_set_processing_mode(sid, "independent_siblings")
  bases_out <- list()
  imported_names <- character(0)
  for (item in prepared) {
    inst_bytes <- readBin(item$inst_path, what = "raw", n = file.info(item$inst_path)$size)
    data_bytes <- readBin(item$data_path, what = "raw", n = file.info(item$data_path)$size)
    inst_meta <- save_upload(sid, "xlsform", paste0(item$base_name, "_xlsform.xlsx"), inst_bytes)
    data_meta <- save_upload(sid, "data", paste0(item$base_name, "_data.xlsx"), data_bytes)
    raw_meta <- if (length(item$raw_snapshot_sources %||% list())) {
      .sm_mb_save_raw_snapshot(
        sid = sid,
        base_name = item$base_name,
        spec = item$source_spec,
        sources = item$raw_snapshot_sources,
        policy = item$decision_policy
      )
    } else {
      NULL
    }
    base_meta <- estudio_add_base(
      sid,
      nombre = item$base_name,
      xlsform_file_id = inst_meta$file_id,
      data_file_id = data_meta$file_id,
      data_ext = "xlsx",
      rp_data = item$rp_data,
      rp_inst = item$rp_inst,
      n_filas = item$n_filas,
      n_columnas = item$n_columnas,
      extra_meta = list(
        processing_mode = "independent_siblings",
        source_kind = item$source_kind,
        survey_id = item$survey_id,
        source_alias = item$source_alias,
        source_title = item$title,
        source_channel = item$source_channel,
        consent_var = item$consent_var,
        sibling_family_id = family_id,
        imported_at = imported_at,
        response_filter = item$response_filter,
        surveymonkey_raw_snapshot_file_id = raw_meta$file_id %||% "",
        surveymonkey_decision_policy = item$decision_policy,
        surveymonkey_decision_audit = item$response_filter,
        surveymonkey_source_spec = item$source_spec,
        surveymonkey_logic_sync = item$direct_logic_sync %||% NULL
      )
    )
    if (is.list(item$canonical_logic_sync) && length(item$canonical_logic_sync)) {
      base_meta$logic_template_base <- .sm_mb_scalar(item$canonical_logic_sync$template_base, "XLSForm base")
      base_meta$logic_template_file_id <- .sm_mb_scalar(item$canonical_logic_sync$template_file_id, "")
      base_meta$logic_template_applied_at <- imported_at
      base_meta$logic_template_status <- if (isTRUE(item$canonical_logic_sync$applied)) "canonical_applied" else paste0("canonical_not_applied:", .sm_mb_scalar(item$canonical_logic_sync$reason, "unchanged"))
      base_meta$surveymonkey_xlsform_logic_sync <- item$canonical_logic_sync[setdiff(names(item$canonical_logic_sync), "model")]
      s_after_base <- session_get(sid)
      s_after_base$estudio$bases[[item$base_name]] <- base_meta
      s_after_base <- .mark_project_dirty(s_after_base)
      .session_env[[sid]] <- s_after_base
    }
    imported_names <- c(imported_names, item$base_name)
    bases_out[[length(bases_out) + 1L]] <- .estudio_base_payload(base_meta, session_get(sid, required = FALSE))
  }
  if (length(imported_names)) {
    canonical_logic_rows <- Filter(Negate(is.null), lapply(prepared, function(item) {
      sync <- item$canonical_logic_sync %||% NULL
      if (!is.list(sync) || !length(sync)) return(NULL)
      sync$model <- NULL
      sync$base <- item$base_name
      sync
    }))
    xlsform_logic_sync <- .sm_mb_canonical_logic_sync_payload(canonical_logic, canonical_logic_rows)
    if (!length(existing_names)) {
      estudio_active_base_set(sid, imported_names[1])
      active_for_source <- imported_names[1]
    } else if (!is.null(active_before) && nzchar(as.character(active_before)) &&
               active_before %in% names(estudio_list_bases(sid))) {
      estudio_active_base_set(sid, active_before)
      active_for_source <- active_before
    } else {
      active_for_source <- as.character(estudio_active_base(sid) %||% imported_names[1])
    }
    if (exists("estudio_mark_independent_shared_logic", mode = "function")) {
      estudio_mark_independent_shared_logic(
        sid,
        template_base = active_for_source,
        audit = audit,
        status = "imported_siblings"
      )
    }
    if (!is.null(canonical_logic) && !is.null(xlsform_logic_sync)) {
      s_logic <- session_get(sid)
      family <- s_logic$estudio$independent_siblings %||% list()
      family$logic_policy <- "shared_template"
      family$shared_logic <- TRUE
      family$status <- "canonical_xlsform_logic_applied"
      family$template_source <- list(
        kind = .sm_mb_scalar((canonical_logic$meta %||% list())$kind, "xlsform"),
        file_id = .sm_mb_scalar((canonical_logic$meta %||% list())$file_id, ""),
        xlsform_name = .sm_mb_scalar((canonical_logic$meta %||% list())$original_name, "XLSForm base")
      )
      family$logic_applied_at <- imported_at
      family$logic_sync <- xlsform_logic_sync
      family$updated_at <- imported_at
      s_logic$estudio$independent_siblings <- family
      s_logic <- .mark_project_dirty(s_logic)
      .session_env[[sid]] <- s_logic
    }
    if (exists("estudio_propagate_shared_codif_logic", mode = "function") &&
        length(existing_names) > 0L) {
      estudio_propagate_shared_codif_logic(
        sid,
        template_base = active_for_source,
        targets = imported_names,
        overwrite = FALSE
      )
    }
    if (is.null(canonical_logic) &&
        length(existing_names) > 0L &&
        exists("estudio_apply_template_xlsform_logic", mode = "function")) {
      xlsform_logic_sync <- tryCatch(
        estudio_apply_template_xlsform_logic(
          sid,
          template_base = active_for_source,
          targets = imported_names,
          clear_target_logic = FALSE
        ),
        error = function(e) list(
          ok = FALSE,
          template_base = active_for_source,
          targets = as.list(imported_names),
          error = conditionMessage(e)
        )
      )
    }
    session_set(sid, "analitica_prep_ok", TRUE)
    if (!length(existing_names)) {
      session_set(sid, "analitica_fuente", sprintf("estudio:%s", as.character(estudio_active_base(sid) %||% active_for_source)))
    }
  } else {
    xlsform_logic_sync <- NULL
  }
  if (length(imported_names)) {
    current_bases <- estudio_list_bases(sid)
    current_session <- session_get(sid, required = FALSE)
    bases_out <- unname(lapply(imported_names, function(name) {
      .estudio_base_payload(current_bases[[name]], current_session)
    }))
  }

  list(
    ok = TRUE,
    processing_mode = "independent_siblings",
    active_base = as.character(estudio_active_base(sid) %||% NA_character_),
    bases = bases_out,
    n_bases = length(estudio_list_bases(sid)),
    estudio = .estudio_payload(sid),
    audit = audit,
    xlsform_logic_sync = xlsform_logic_sync
  )
}

sm_multibase_refresh_plan <- function(sid,
                                      token,
                                      bases = list(),
                                      months = 12L,
                                      force_refresh = FALSE) {
  s <- session_get(sid)
  estudio_ensure(sid)
  if (!estudio_is_independent_siblings(sid)) {
    stop_api(409, "E_SM_REFRESH_MODE",
             "La actualizacion SurveyMonkey esta disponible para bases hermanas independientes.")
  }
  bases_map <- estudio_list_bases(sid)
  sm_bases <- Filter(function(b) {
    startsWith(as.character(b$source_kind %||% ""), "surveymonkey")
  }, bases_map)
  requested_names <- vapply(bases %||% list(), function(x) .sm_mb_scalar(x$base_name %||% x$nombre %||% x$name, ""), character(1))
  requested_names <- requested_names[nzchar(requested_names)]
  target_names <- if (length(requested_names)) intersect(requested_names, names(sm_bases)) else names(sm_bases)
  if (!length(target_names)) {
    return(list(ok = TRUE, bases = list(), campaign_suggestions = list(), message = "No hay bases SurveyMonkey para actualizar."))
  }

  catalog <- tryCatch(
    sm_multibase_list_surveys(
      token,
      q = "",
      limit = 500L,
      months = suppressWarnings(as.integer(months %||% 12L)),
      sid = sid,
      force_refresh = isTRUE(force_refresh)
    ),
    error = function(e) list(surveys = list(), refresh_error = conditionMessage(e))
  )
  used_ids <- .sm_mb_all_used_survey_ids(sm_bases)
  rows <- list()
  suggestions_by_base <- list()
  for (base_name in target_names) {
    base <- sm_bases[[base_name]]
    spec_info <- .sm_mb_spec_from_base(base_name, base)
    if (!isTRUE(spec_info$ok)) {
      rows[[length(rows) + 1L]] <- list(
        base_name = base_name,
        ok = FALSE,
        updateable = FALSE,
        issues = spec_info$issues,
        campaign_suggestions = list()
      )
      next
    }
    suggestions <- .sm_mb_campaign_suggestions(base_name, base, spec_info$spec, catalog$surveys, used_ids)
    accepted <- .sm_mb_campaigns_from_request(bases, base_name)
    spec <- .sm_mb_spec_with_campaigns(spec_info$spec, accepted)
    suggestions_by_base[[base_name]] <- suggestions
    structure <- tryCatch(.sm_mb_structure_report(spec, token), error = function(e) list(
      ok = FALSE,
      n_blocking = 1L,
      n_review = 0L,
      diffs = list(list(severity = "blocking", kind = "structure_error", message = conditionMessage(e)))
    ))
    counts <- tryCatch(.sm_mb_incremental_counts(sid, base_name, base, spec, token), error = function(e) list(
      current_rows = as.integer(base$n_filas %||% 0L),
      remote_rows = NA_integer_,
      new_rows = NA_integer_,
      edited_rows = NA_integer_,
      edited_case_uids = list(),
      error = conditionMessage(e)
    ))
    has_count_error <- nzchar(.sm_mb_scalar(counts$error, ""))
    refresh_action <- .sm_mb_refresh_action(counts, structure, accepted)
    updateable <- .sm_mb_refresh_action_updateable(refresh_action)
    rows[[length(rows) + 1L]] <- list(
      base_name = base_name,
      source_alias = .sm_mb_scalar(base$source_alias %||% base$source_title %||% base_name, base_name),
      source_title = .sm_mb_scalar(base$source_title, ""),
      survey_id = spec$survey_id,
      source_count = as.integer(length(spec$sources %||% list(spec))),
      existing_campaigns = as.list(.sm_mb_source_ids(spec_info$spec)),
      accepted_campaigns = as.list(vapply(accepted %||% list(), function(x) .sm_mb_scalar(x$survey_id %||% x$id, ""), character(1))),
      campaign_suggestions = suggestions,
      current_rows = counts$current_rows,
      remote_rows = counts$remote_rows,
      new_rows = counts$new_rows,
      edited_rows = counts$edited_rows,
      edited_case_uids = counts$edited_case_uids,
      structure = structure,
      codificacion = list(
        has_state = if (exists(".codif_apply_has_user_state", mode = "function")) {
          .codif_apply_has_user_state(sid, base_name)
        } else {
          FALSE
        }
      ),
      source_spec = spec,
      ok = TRUE,
      updateable = isTRUE(updateable),
      refresh_action = refresh_action,
      needs_update = identical(refresh_action, "update"),
      structure_warning_only = identical(refresh_action, "noop_structure_warning"),
      issues = if (has_count_error) list(counts$error) else list()
    )
  }
  list(
    ok = TRUE,
    bases = rows,
    campaign_suggestions = suggestions_by_base,
    catalog = list(
      from_cache = isTRUE(catalog$from_cache),
      cache_status = .sm_mb_scalar(catalog$cache_status, ""),
      refresh_error = .sm_mb_scalar(catalog$refresh_error, ""),
      catalog_fetched_at = .sm_mb_scalar(catalog$catalog_fetched_at, "")
    )
  )
}

sm_multibase_refresh <- function(sid,
                                 token,
                                 bases = list(),
                                 months = 12L,
                                 force_refresh = FALSE,
                                 reapply_codificacion = TRUE,
                                 regenerate_raw_snapshot = FALSE,
                                 raw_snapshot_only = FALSE) {
  plan <- sm_multibase_refresh_plan(
    sid = sid,
    token = token,
    bases = bases,
    months = months,
    force_refresh = force_refresh
  )
  results <- list()
  codif_jobs <- list()
  for (row in plan$bases %||% list()) {
    base_name <- .sm_mb_scalar(row$base_name, "")
    if (!nzchar(base_name)) next
    if (isTRUE(raw_snapshot_only)) {
      base <- estudio_list_bases(sid)[[base_name]]
      spec <- tryCatch(.sm_mb_normalize_survey_specs(list(row$source_spec))[[1]], error = function(e) NULL)
      raw_result <- if (!is.null(base) && !is.null(spec)) {
        tryCatch(.sm_mb_regenerate_raw_snapshot_for_base(sid, base_name, base, spec, token), error = function(e) e)
      } else {
        structure(simpleError("No se pudo reconstruir la especificación SurveyMonkey guardada."), class = c("simpleError", "error", "condition"))
      }
      if (inherits(raw_result, "error")) {
        results[[length(results) + 1L]] <- list(
          base_name = base_name,
          ok = FALSE,
          skipped = TRUE,
          raw_snapshot_only = TRUE,
          reason = conditionMessage(raw_result),
          issues = row$issues %||% list(),
          structure = row$structure %||% list(),
          refresh_action = row$refresh_action %||% "raw_snapshot_only"
        )
      } else {
        results[[length(results) + 1L]] <- list(
          base_name = base_name,
          ok = TRUE,
          skipped = TRUE,
          noop = TRUE,
          raw_snapshot_only = TRUE,
          raw_snapshot_regenerated = TRUE,
          raw_snapshot_file_id = raw_result$raw_snapshot_file_id %||% "",
          reason = "Snapshot raw regenerado; la data activa y los pasos posteriores quedaron intactos.",
          n_new = 0L,
          current_rows_before = row$current_rows,
          rows_after = row$current_rows,
          edited_rows_reported = row$edited_rows,
          source_count = raw_result$source_count %||% row$source_count,
          structure = row$structure %||% list(),
          refresh_action = row$refresh_action %||% "raw_snapshot_only"
        )
      }
      next
    }
    if (!isTRUE(row$updateable)) {
      if (isTRUE(regenerate_raw_snapshot)) {
        base <- estudio_list_bases(sid)[[base_name]]
        spec <- tryCatch(.sm_mb_normalize_survey_specs(list(row$source_spec))[[1]], error = function(e) NULL)
        raw_result <- if (!is.null(base) && !is.null(spec)) {
          tryCatch(.sm_mb_regenerate_raw_snapshot_for_base(sid, base_name, base, spec, token), error = function(e) e)
        } else {
          structure(simpleError("No se pudo reconstruir la especificación SurveyMonkey guardada."), class = c("simpleError", "error", "condition"))
        }
        if (!inherits(raw_result, "error")) {
          results[[length(results) + 1L]] <- list(
            base_name = base_name,
            ok = TRUE,
            skipped = TRUE,
            data_refresh_blocked = TRUE,
            raw_snapshot_regenerated = TRUE,
            raw_snapshot_file_id = raw_result$raw_snapshot_file_id %||% "",
            reason = "Snapshot raw regenerado; la data activa no se actualizo porque el diagnostico no permitia incorporar filas.",
            issues = row$issues %||% list(),
            structure = row$structure %||% list(),
            refresh_action = row$refresh_action %||% "blocked"
          )
          next
        }
        results[[length(results) + 1L]] <- list(
          base_name = base_name,
          ok = FALSE,
          skipped = TRUE,
          reason = conditionMessage(raw_result),
          issues = row$issues %||% list(),
          structure = row$structure %||% list(),
          refresh_action = row$refresh_action %||% "blocked"
        )
        next
      }
      results[[length(results) + 1L]] <- list(
        base_name = base_name,
        ok = FALSE,
        skipped = TRUE,
        reason = "La base no paso el diagnostico.",
        issues = row$issues %||% list(),
        structure = row$structure %||% list()
      )
      next
    }
    refresh_action <- .sm_mb_scalar(row$refresh_action, "")
    if (refresh_action %in% c("noop", "noop_structure_warning")) {
      raw_result <- NULL
      if (isTRUE(regenerate_raw_snapshot)) {
        base <- estudio_list_bases(sid)[[base_name]]
        spec <- .sm_mb_normalize_survey_specs(list(row$source_spec))[[1]]
        raw_result <- tryCatch(.sm_mb_regenerate_raw_snapshot_for_base(sid, base_name, base, spec, token), error = function(e) e)
        if (inherits(raw_result, "error")) {
          results[[length(results) + 1L]] <- list(
            base_name = base_name,
            ok = FALSE,
            skipped = TRUE,
            noop = TRUE,
            reason = conditionMessage(raw_result),
            n_new = 0L,
            current_rows_before = row$current_rows,
            rows_after = row$current_rows,
            edited_rows_reported = row$edited_rows,
            source_count = row$source_count,
            structure = row$structure %||% list(),
            refresh_action = refresh_action
          )
          next
        }
      }
      results[[length(results) + 1L]] <- list(
        base_name = base_name,
        ok = TRUE,
        skipped = TRUE,
        noop = TRUE,
        raw_snapshot_regenerated = !is.null(raw_result),
        raw_snapshot_file_id = if (!is.null(raw_result)) raw_result$raw_snapshot_file_id %||% "" else "",
        reason = if (identical(refresh_action, "noop_structure_warning")) {
          if (!is.null(raw_result)) {
            "Snapshot raw regenerado; sin filas nuevas. Hay alertas estructurales para revisar antes de incorporar futuros casos."
          } else {
            "Sin filas nuevas; se conserva la base local. Hay alertas estructurales para revisar antes de incorporar futuros casos."
          }
        } else {
          if (!is.null(raw_result)) "Snapshot raw regenerado; la base efectiva ya estaba al dia." else "Sin filas nuevas; la base ya esta al dia."
        },
        n_new = 0L,
        current_rows_before = row$current_rows,
        rows_after = row$current_rows,
        edited_rows_reported = row$edited_rows,
        source_count = row$source_count,
        structure = row$structure %||% list(),
        refresh_action = refresh_action
      )
      next
    }
    base <- estudio_list_bases(sid)[[base_name]]
    spec <- .sm_mb_normalize_survey_specs(list(row$source_spec))[[1]]
    local_df <- .sm_mb_read_base_original_data(sid, base)
    snapshot <- tryCatch(.sm_mb_prepare_refresh_snapshot(sid, base_name, spec, token), error = function(e) e)
    if (inherits(snapshot, "error")) {
      results[[length(results) + 1L]] <- list(
        base_name = base_name,
        ok = FALSE,
        skipped = TRUE,
        reason = conditionMessage(snapshot)
      )
      next
    }
    merged <- .sm_mb_merge_new_rows(local_df, snapshot$remote_df, snapshot$rp_inst)
    data_path <- file.path(session_get(sid)$dir, "downloads",
      paste0(uuid::UUIDgenerate(), "_", base_name, "_refresh_data.xlsx"))
    .sm_mb_write_xlsx(merged$data, data_path)
    inst_bytes <- readBin(snapshot$inst_path, what = "raw", n = file.info(snapshot$inst_path)$size)
    data_bytes <- readBin(data_path, what = "raw", n = file.info(data_path)$size)
    inst_meta <- save_upload(sid, "xlsform", paste0(base_name, "_refresh_xlsform.xlsx"), inst_bytes)
    data_meta <- save_upload(sid, "data", paste0(base_name, "_refresh_data.xlsx"), data_bytes)
    raw_meta <- if (length(snapshot$raw_snapshot_sources %||% list())) {
      .sm_mb_save_raw_snapshot(
        sid = sid,
        base_name = base_name,
        spec = spec,
        sources = snapshot$raw_snapshot_sources,
        policy = snapshot$decision_policy %||% list()
      )
    } else {
      NULL
    }
    rp_data <- reporte_data(merged$data, instrumento = snapshot$rp_inst)

    s_now <- session_get(sid)
    base_now <- s_now$estudio$bases[[base_name]]
    has_codif <- isTRUE((row$codificacion %||% list())$has_state)
    keep_current <- isTRUE(reapply_codificacion) && has_codif && .sm_mb_base_current_is_adapted(s_now, base_now)
    .sm_mb_update_base_refresh_files(
      sid = sid,
      base_name = base_name,
      inst_meta = inst_meta,
      data_meta = data_meta,
      rp_inst = snapshot$rp_inst,
      rp_data = rp_data,
      spec = spec,
      response_filter = snapshot$response_filter,
      source_kind = snapshot$source_kind,
      keep_current = keep_current,
      n_new = merged$n_new,
      raw_snapshot_file_id = raw_meta$file_id %||% "",
      decision_policy = snapshot$decision_policy %||% NULL,
      decision_audit = snapshot$response_filter %||% NULL,
      xlsform_logic_sync = snapshot$xlsform_logic_sync %||% NULL
    )

    codif_job <- NULL
    if (isTRUE(reapply_codificacion) && has_codif && exists(".codif_start_apply_job", mode = "function")) {
      codif_job <- tryCatch(
        .codif_start_apply_job(sid, base_name = base_name, kind = "codificacion.reaplicar_surveymonkey"),
        error = function(e) list(ok = FALSE, error = conditionMessage(e), base_name = base_name)
      )
      codif_jobs[[length(codif_jobs) + 1L]] <- codif_job
    }
    results[[length(results) + 1L]] <- list(
      base_name = base_name,
      ok = TRUE,
      skipped = FALSE,
      n_new = merged$n_new,
      current_rows_before = row$current_rows,
      rows_after = as.integer(nrow(merged$data)),
      edited_rows_reported = row$edited_rows,
      source_count = as.integer(length(spec$sources %||% list(spec))),
      raw_snapshot_regenerated = !is.null(raw_meta),
      raw_snapshot_file_id = raw_meta$file_id %||% "",
      xlsform_logic_sync = snapshot$xlsform_logic_sync %||% list(),
      codificacion_job = codif_job
    )
  }
  plan_by_base <- list()
  for (row in plan$bases %||% list()) {
    base_name <- .sm_mb_scalar(row$base_name, "")
    if (nzchar(base_name)) plan_by_base[[base_name]] <- row
  }
  results <- lapply(results, function(result) {
    if (!is.null(result$sources)) return(result)
    base_name <- .sm_mb_scalar(result$base_name, "")
    row <- plan_by_base[[base_name]] %||% list()
    spec <- row$source_spec %||% list()
    status <- if (isTRUE(result$raw_snapshot_regenerated) && isTRUE(result$skipped)) {
      "raw_snapshot_regenerado"
    } else if (isTRUE(result$ok) && !isTRUE(result$skipped)) {
      "actualizada"
    } else if (isTRUE(result$noop)) {
      "sin_cambios"
    } else if (isTRUE(result$skipped)) {
      "no_actualizada"
    } else {
      "error"
    }
    refreshed <- isTRUE(result$ok) && (!isTRUE(result$skipped) || isTRUE(result$raw_snapshot_regenerated))
    result$sources <- .sm_mb_refresh_source_log(
      spec,
      status = status,
      refreshed = refreshed,
      reason = .sm_mb_scalar(result$reason, "")
    )
    result
  })
  list(
    ok = TRUE,
    results = results,
    codificacion_jobs = codif_jobs,
    plan = plan,
    estudio = .estudio_payload(sid)
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
      profile_id <- parsed$connection_profile_id %||% parsed$profile_id %||% parsed$profileId %||% NULL
      profile_key <- trimws(as.character(profile_id %||% ""))
      token <- .connections_token_require("surveymonkey", sid, profile_id = profile_id)
      tryCatch(
        sm_multibase_list_surveys(
          token,
          q = .sm_mb_scalar(parsed$q, ""),
          limit = suppressWarnings(as.integer(parsed$limit %||% 200L)),
          months = suppressWarnings(as.integer(parsed$months %||% 6L)),
          sid = if (nzchar(profile_key)) NULL else sid,
          force_refresh = isTRUE(parsed$force_refresh) || nzchar(profile_key)
        ),
        error = .sm_mb_stop_catalog_api_error
      )
    })) |>
    plumber::pr_post("/api/surveymonkey/multibase/inspect", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      parsed <- .xlsform_editor_parse_body(req)
      profile_id <- parsed$connection_profile_id %||% parsed$connectionProfileId %||% parsed$profile_id %||% parsed$profileId %||% NULL
      token <- .connections_token_require("surveymonkey", sid, profile_id = profile_id)
      sm_multibase_inspect_survey(
        survey_id = parsed$survey_id %||% parsed$id,
        token = token,
        base_url = .sm_mb_scalar(parsed$base_url, "https://api.surveymonkey.com/v3"),
        response_limit = suppressWarnings(as.integer(parsed$response_limit %||% 5L))
      )
    })) |>
    plumber::pr_post("/api/surveymonkey/multibase/collectors", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      parsed <- .xlsform_editor_parse_body(req)
      profile_id <- parsed$connection_profile_id %||% parsed$connectionProfileId %||% parsed$profile_id %||% parsed$profileId %||% NULL
      token <- .connections_token_require("surveymonkey", sid, profile_id = profile_id)
      sm_multibase_collectors(
        survey_id = parsed$survey_id %||% parsed$id,
        token = token,
        base_url = .sm_mb_scalar(parsed$base_url, "https://api.surveymonkey.com/v3")
      )
    })) |>
    plumber::pr_post("/api/surveymonkey/multibase/audit", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      parsed <- .xlsform_editor_parse_body(req)
      token <- .connections_token_require("surveymonkey", sid)
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
      token <- .connections_token_require("surveymonkey", sid)
      sm_multibase_import(
        sid = sid,
        specs = parsed$surveys %||% list(),
        token = token,
        canonical_file_id = .sm_mb_scalar(parsed$canonical_xlsform_file_id, ""),
        base_name = .sm_mb_scalar(parsed$base_name, "surveymonkey_multibase"),
        wording_decisions = parsed$wording_decisions %||% list()
      )
    })) |>
    plumber::pr_post("/api/surveymonkey/multibase/import-independent", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      parsed <- .xlsform_editor_parse_body(req)
      token <- .connections_token_require("surveymonkey", sid)
      sm_multibase_import_independent(
        sid = sid,
        specs = parsed$surveys %||% list(),
        token = token,
        response_statuses = .sm_mb_response_statuses(parsed$response_statuses),
        keep_missing_status = if (is.null(parsed$keep_missing_status)) TRUE else isTRUE(parsed$keep_missing_status),
        canonical_file_id = .sm_mb_scalar(parsed$canonical_xlsform_file_id, ""),
        use_canonical_xlsform_logic = isTRUE(parsed$use_canonical_xlsform_logic),
        logic_rules = .sm_mb_scalar(parsed$surveymonkey_logic_rules %||% parsed$logic_rules %||% parsed$reglas, ""),
        logic_rules_by_survey = parsed$surveymonkey_logic_rules_by_survey %||% parsed$logic_rules_by_survey %||% NULL,
        logic_pages = parsed$surveymonkey_logic_pages %||% parsed$logic_pages %||% parsed$paginas %||% NULL,
        choice_order_overrides = parsed$choice_order_overrides %||% NULL,
        choice_code_maps = parsed$choice_code_maps %||% NULL,
        replace_existing_logic = isTRUE(parsed$replace_existing_logic)
      )
    })) |>
    plumber::pr_post("/api/surveymonkey/multibase/apply-canonical-xlsform-logic", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        stop_api(404, "E_NO_SESSION", "Sin sesión.")
      }
      parsed <- .xlsform_editor_parse_body(req)
      sm_multibase_apply_canonical_xlsform_logic(
        sid = sid,
        canonical_file_id = .sm_mb_scalar(parsed$canonical_xlsform_file_id, ""),
        targets = parsed$targets %||% list(),
        clear_target_logic = isTRUE(parsed$clear_target_logic)
      )
    })) |>
    plumber::pr_post("/api/surveymonkey/multibase/workbook/inspect", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        stop_api(404, "E_NO_SESSION", "Sin sesión.")
      }
      parsed <- .xlsform_editor_parse_body(req)
      sm_multibase_workbook_inspect(
        sid = sid,
        file_id = parsed$file_id %||% parsed$workbook_file_id,
        sheet_base_map = parsed$sheet_base_map %||% parsed$sheet_map %||% list(),
        missing_policy = .sm_mb_scalar(parsed$missing_required_policy %||% parsed$missing_policy, "fill_blank_warn")
      )
    })) |>
    plumber::pr_post("/api/surveymonkey/multibase/workbook/import", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        stop_api(404, "E_NO_SESSION", "Sin sesión.")
      }
      parsed <- .xlsform_editor_parse_body(req)
      sm_multibase_workbook_import(
        sid = sid,
        file_id = parsed$file_id %||% parsed$workbook_file_id,
        sheet_base_map = parsed$sheet_base_map %||% parsed$sheet_map %||% list(),
        missing_policy = .sm_mb_scalar(parsed$missing_required_policy %||% parsed$missing_policy, "fill_blank_warn")
      )
    })) |>
    plumber::pr_post("/api/surveymonkey/multibase/sav-bundle/inspect", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        stop_api(404, "E_NO_SESSION", "Sin sesión.")
      }
      parsed <- .xlsform_editor_parse_body(req)
      sm_multibase_sav_bundle_inspect(
        sid = sid,
        file_id = parsed$file_id %||% parsed$sav_bundle_file_id,
        file_base_map = parsed$file_base_map %||% parsed$sav_base_map %||% list(),
        missing_policy = .sm_mb_scalar(parsed$missing_required_policy %||% parsed$missing_policy, "fill_blank_warn")
      )
    })) |>
    plumber::pr_post("/api/surveymonkey/multibase/sav-bundle/import", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        stop_api(404, "E_NO_SESSION", "Sin sesión.")
      }
      parsed <- .xlsform_editor_parse_body(req)
      sm_multibase_sav_bundle_import(
        sid = sid,
        file_id = parsed$file_id %||% parsed$sav_bundle_file_id,
        file_base_map = parsed$file_base_map %||% parsed$sav_base_map %||% list(),
        missing_policy = .sm_mb_scalar(parsed$missing_required_policy %||% parsed$missing_policy, "fill_blank_warn")
      )
    })) |>
    plumber::pr_post("/api/surveymonkey/multibase/decision-preview", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        stop_api(404, "E_NO_SESSION", "Sin sesión.")
      }
      parsed <- .xlsform_editor_parse_body(req)
      sm_multibase_decision_preview(
        sid = sid,
        base_name = .sm_mb_scalar(parsed$base_name %||% parsed$nombre, ""),
        policy = parsed$policy %||% NULL
      )
    })) |>
    plumber::pr_post("/api/surveymonkey/multibase/decision-apply", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        stop_api(404, "E_NO_SESSION", "Sin sesión.")
      }
      parsed <- .xlsform_editor_parse_body(req)
      sm_multibase_decision_apply(
        sid = sid,
        base_name = .sm_mb_scalar(parsed$base_name %||% parsed$nombre, ""),
        policy = parsed$policy %||% NULL,
        regenerate_data = if (is.null(parsed$regenerate_data)) TRUE else isTRUE(parsed$regenerate_data),
        force_replace_adapted = isTRUE(parsed$force_replace_adapted)
      )
    })) |>
    plumber::pr_post("/api/surveymonkey/multibase/refresh-plan", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      parsed <- .xlsform_editor_parse_body(req)
      token <- .connections_token_require("surveymonkey", sid)
      sm_multibase_refresh_plan(
        sid = sid,
        token = token,
        bases = parsed$bases %||% list(),
        months = suppressWarnings(as.integer(parsed$months %||% 12L)),
        force_refresh = isTRUE(parsed$force_refresh)
      )
    })) |>
    plumber::pr_post("/api/surveymonkey/multibase/refresh", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      parsed <- .xlsform_editor_parse_body(req)
      token <- .connections_token_require("surveymonkey", sid)
      sm_multibase_refresh(
        sid = sid,
        token = token,
        bases = parsed$bases %||% list(),
        months = suppressWarnings(as.integer(parsed$months %||% 12L)),
        force_refresh = isTRUE(parsed$force_refresh),
        reapply_codificacion = if (is.null(parsed$reapply_codificacion)) TRUE else isTRUE(parsed$reapply_codificacion),
        regenerate_raw_snapshot = isTRUE(parsed$regenerate_raw_snapshot),
        raw_snapshot_only = isTRUE(parsed$raw_snapshot_only)
      )
    }))
}
