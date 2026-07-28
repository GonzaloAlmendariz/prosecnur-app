# =============================================================================
# Multi integrado: varios instrumentos hermanos -> una base + un XLSForm comun
# =============================================================================

.mi_scalar <- function(x, fallback = "") {
  if (is.null(x) || length(x) == 0L) return(fallback)
  x <- as.character(x)[1]
  if (is.na(x)) fallback else x
}

.mi_trim <- function(x) {
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

.mi_norm <- function(x) {
  x <- tolower(.mi_trim(x))
  x <- chartr(
    "áàäâãåéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÅÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ",
    "aaaaaaeeeeiiiiooooouuuuncaaaaaaeeeeiiiiooooouuuunc",
    x
  )
  x <- iconv(x, to = "ASCII//TRANSLIT", sub = "")
  x <- gsub("[^a-z0-9]+", " ", x)
  gsub("[[:space:]]+", " ", trimws(x))
}

.mi_slug <- function(x, fallback = "valor") {
  out <- .mi_norm(x)
  out <- gsub("[[:space:]]+", "_", out)
  out <- gsub("^_+|_+$", "", out)
  out[!nzchar(out) | is.na(out)] <- fallback
  out
}

.mi_key_name <- function(x) {
  out <- .mi_slug(x, "origen")
  if (!grepl("^[A-Za-z_]", out)) out <- paste0("k_", out)
  out
}

.mi_label_col <- function(df) {
  cols <- .mi_label_candidates(df)
  if (!length(cols)) return(NA_character_)
  non_empty_count <- function(col) {
    if (!col %in% names(df)) return(0L)
    v <- .mi_trim(df[[col]])
    as.integer(sum(v != ""))
  }
  scores <- vapply(cols, non_empty_count, integer(1), USE.NAMES = FALSE)
  nz <- which(scores > 0L)
  if (length(nz)) return(cols[order(-scores, seq_along(cols))][1L])
  cols[1L]
}

.mi_label_candidates <- function(df) {
  nms <- names(df %||% data.frame())
  if (is.null(nms) || !length(nms)) return(character(0))
  explicit <- c(
    "label",
    "label::es",
    "label::Spanish (ES)",
    "label_spanish_es",
    "label_spanish",
    "label_es",
    "label::espanol (es)",
    "label::espanol(es)",
    "label::espanol",
    "label::español (es)",
    "label::español(es)",
    "label::español"
  )
  out <- intersect(explicit, nms)
  extras <- nms[grep("^label(::|_)", nms, ignore.case = TRUE)]
  unique(c(out, extras))
}

.mi_label_fill <- function(df, candidates) {
  n <- nrow(df %||% data.frame())
  if (!n) return(character(0))
  if (!length(candidates)) return(rep("", n))
  out <- rep("", n)
  for (col in intersect(candidates, names(df))) {
    v <- .mi_trim(df[[col]])
    idx <- !nzchar(out) & nzchar(v)
    if (any(idx)) out[idx] <- v[idx]
    if (all(nzchar(out))) break
  }
  out
}

.mi_type_base <- function(type) {
  trimws(sub("\\s+.*$", "", as.character(type %||% "")))
}

.mi_type_list <- function(type) {
  type <- trimws(as.character(type %||% ""))
  if (!grepl("^select_(one|multiple)\\s+", type)) return("")
  trimws(sub("^select_(one|multiple)\\s+", "", type))
}

.mi_non_question_types <- c(
  "begin_group", "end_group", "begin_repeat", "end_repeat",
  "note", "start", "end", "today", "deviceid", "subscriberid",
  "phonenumber", "simserial", "username", "audit", "calculate"
)

.mi_read_sheet <- function(path, sheet, default_cols = character()) {
  sheets <- readxl::excel_sheets(path)
  if (!(tolower(sheet) %in% tolower(sheets))) {
    out <- as.data.frame(setNames(replicate(length(default_cols), character(0), simplify = FALSE), default_cols),
                         stringsAsFactors = FALSE, check.names = FALSE)
    return(out)
  }
  real <- sheets[match(tolower(sheet), tolower(sheets))]
  out <- suppressWarnings(readxl::read_excel(path, sheet = real, .name_repair = "unique_quiet"))
  out <- as.data.frame(out, stringsAsFactors = FALSE, check.names = FALSE)
  for (nm in default_cols) if (!(nm %in% names(out))) out[[nm]] <- character(nrow(out))
  out
}

.mi_xlsform_model_from_frames <- function(survey, choices = data.frame(), settings = data.frame(),
                                          path = "", file_id = "", label = "") {
  survey <- as.data.frame(survey %||% data.frame(), stringsAsFactors = FALSE, check.names = FALSE)
  choices <- as.data.frame(choices %||% data.frame(), stringsAsFactors = FALSE, check.names = FALSE)
  settings <- as.data.frame(settings %||% data.frame(), stringsAsFactors = FALSE, check.names = FALSE)
  for (nm in c("type", "name", "label")) if (!(nm %in% names(survey))) survey[[nm]] <- character(nrow(survey))
  for (nm in c("list_name", "name", "label")) if (!(nm %in% names(choices))) choices[[nm]] <- character(nrow(choices))
  if (!("type" %in% names(survey)) || !("name" %in% names(survey))) {
    stop_api(400, "E_MULTI_BAD_XLSFORM", "El XLSForm necesita columnas 'type' y 'name'.")
  }
  lab_col <- .mi_label_col(survey)
  if (is.na(lab_col)) {
    survey$label <- ""
    lab_col <- "label"
  }
  survey$label <- .mi_label_fill(survey, .mi_label_candidates(survey))
  if (!all(survey$label == "")) {
    lab_col <- .mi_label_col(survey)
  }
  type_base <- .mi_type_base(survey$type)
  q_idx <- which(nzchar(as.character(survey$name %||% "")) & !(type_base %in% .mi_non_question_types))
  questions <- survey[q_idx, , drop = FALSE]
  questions$.row_index <- q_idx
  questions$.pos <- seq_along(q_idx)
  questions$.type_base <- .mi_type_base(questions$type)
  questions$.list_name <- vapply(questions$type, .mi_type_list, character(1))
  questions$.label <- .mi_trim(questions[[lab_col]])
  questions$.label_norm <- .mi_norm(questions$.label)
  questions$.choice_signature <- vapply(seq_len(nrow(questions)), function(i) {
    ln <- .mi_scalar(questions$.list_name[i], "")
    if (!nzchar(ln) || !("list_name" %in% names(choices))) return("")
    rows <- choices[as.character(choices$list_name) == ln, , drop = FALSE]
    if (!nrow(rows)) return("")
    lab <- if ("label" %in% names(rows)) rows$label else rows$name
    paste(.mi_norm(paste(rows$name %||% "", lab %||% "", sep = "=")), collapse = " || ")
  }, character(1))
  list(
    path = path,
    file_id = file_id,
    label = label,
    survey = survey,
    choices = choices,
    settings = settings,
    label_col = lab_col,
    questions = questions
  )
}

.mi_xlsform_model <- function(path, file_id = "", label = "") {
  survey <- .mi_read_sheet(path, "survey", character())
  choices <- .mi_read_sheet(path, "choices", c("list_name", "name", "label"))
  settings <- .mi_read_sheet(path, "settings", character())
  .mi_xlsform_model_from_frames(survey, choices, settings, path = path, file_id = file_id, label = label)
}

.mi_origin_specs <- function(items) {
  if (is.null(items) || !length(items)) return(list())
  lapply(seq_along(items), function(i) {
    x <- items[[i]]
    source_kind <- .mi_scalar(x$source_kind %||% x$kind, "")
    if (!nzchar(source_kind)) {
      source_kind <- if (nzchar(.mi_scalar(x$survey_id, ""))) "surveymonkey" else "manual"
    }
    key_value <- .mi_trim(.mi_scalar(x$key_value %||% x$origin %||% x$pais, ""))
    label <- .mi_scalar(x$label %||% x$title, "")
    survey_id <- .mi_scalar(x$survey_id, "")
    xlsform_file_id <- .mi_scalar(x$xlsform_file_id, "")
    data_file_id <- .mi_scalar(x$data_file_id, "")
    if (!nzchar(key_value)) key_value <- .mi_trim(label)
    if (!nzchar(key_value)) key_value <- .mi_trim(survey_id)
    if (!nzchar(key_value)) key_value <- paste0("origen_", i)
    if (!nzchar(label)) label <- key_value
    if (!source_kind %in% c("manual", "surveymonkey")) {
      stop_api(400, "E_MULTI_SOURCE_KIND", "source_kind debe ser 'manual' o 'surveymonkey'.")
    }
    if (identical(source_kind, "manual")) {
      if (!nzchar(xlsform_file_id)) stop_api(400, "E_MULTI_XLSFORM", "Cada origen manual necesita xlsform_file_id.")
      if (!nzchar(data_file_id)) stop_api(400, "E_MULTI_DATA", "Cada origen manual necesita data_file_id.")
    }
    if (identical(source_kind, "surveymonkey") && !nzchar(survey_id)) {
      stop_api(400, "E_MULTI_SURVEY_ID", "Cada origen SurveyMonkey necesita survey_id.")
    }
    list(
      id = paste(source_kind, if (nzchar(survey_id)) survey_id else xlsform_file_id, i, sep = ":"),
      source_kind = source_kind,
      key_value = key_value,
      key_slug = .mi_slug(key_value, paste0("origen_", i)),
      label = label,
      xlsform_file_id = xlsform_file_id,
      data_file_id = data_file_id,
      survey_id = survey_id
    )
  })
}

.mi_variant_name <- function(base, origin, existing = character()) {
  stem <- .mi_slug(base, "pregunta")
  suffix <- .mi_slug(origin, "origen")
  out <- paste(stem, suffix, sep = "_")
  i <- 2L
  while (out %in% existing) {
    out <- paste(stem, suffix, i, sep = "_")
    i <- i + 1L
  }
  out
}

.mi_diff <- function(id, origin, variable, kind, severity, message,
                     ref = "", current = "", needs_decision = FALSE,
                     suggested_name = "", suggested_label = "", pos = NA_integer_,
                     ref_origin_id = "", ref_origin_key = "") {
  list(
    id = id,
    origin_id = origin$id,
    source_kind = origin$source_kind,
    origin_key = origin$key_value,
    ref_origin_id = .mi_scalar(ref_origin_id, ""),
    ref_origin_key = .mi_scalar(ref_origin_key, ""),
    variable = variable,
    pos = if (is.na(pos)) NA_integer_ else as.integer(pos),
    kind = kind,
    severity = severity,
    message = message,
    ref = ref,
    current = current,
    needs_decision = isTRUE(needs_decision),
    suggested_name = suggested_name,
    suggested_label = suggested_label
  )
}

.mi_compare_manual_origin <- function(guide, origin_model, origin, existing_names) {
  diffs <- list()
  gq <- guide$questions
  oq <- origin_model$questions
  g_names <- as.character(gq$name)
  o_names <- as.character(oq$name)
  for (i in seq_len(nrow(oq))) {
    nm <- as.character(oq$name[i])
    if (!nzchar(nm)) next
    gi <- match(nm, g_names)
    suggested_name <- .mi_variant_name(nm, origin$key_value, existing_names)
    suggested_label <- paste(.mi_scalar(oq$.label[i], nm), origin$key_value, sep = " - ")
    if (is.na(gi)) {
      diffs[[length(diffs) + 1L]] <- .mi_diff(
        id = paste(origin$id, nm, "extra", sep = "::"),
        origin = origin,
        variable = nm,
        kind = "extra_question",
        severity = "review",
        message = "La pregunta existe solo en este origen; se agregara como variante con sufijo.",
        current = .mi_scalar(oq$.label[i], nm),
        needs_decision = TRUE,
        suggested_name = suggested_name,
        suggested_label = suggested_label,
        pos = oq$.pos[i]
      )
      existing_names <- c(existing_names, suggested_name)
      next
    }
    type_diff <- !identical(.mi_scalar(gq$.type_base[gi], ""), .mi_scalar(oq$.type_base[i], ""))
    choice_diff <- !identical(.mi_scalar(gq$.choice_signature[gi], ""), .mi_scalar(oq$.choice_signature[i], ""))
    label_diff <- !identical(.mi_scalar(gq$.label_norm[gi], ""), .mi_scalar(oq$.label_norm[i], ""))
    if (type_diff || choice_diff) {
      diffs[[length(diffs) + 1L]] <- .mi_diff(
        id = paste(origin$id, nm, if (type_diff) "structure" else "options", sep = "::"),
        origin = origin,
        variable = nm,
        kind = if (type_diff) "structure_variant" else "options_variant",
        severity = "review",
        message = "La pregunta comparte nombre, pero su tipo u opciones difieren; se integrara como variante con sufijo para este origen.",
        ref = .mi_scalar(gq$.label[gi], nm),
        current = .mi_scalar(oq$.label[i], nm),
        needs_decision = TRUE,
        suggested_name = suggested_name,
        suggested_label = suggested_label,
        pos = oq$.pos[i]
      )
      existing_names <- c(existing_names, suggested_name)
    } else if (label_diff) {
      diffs[[length(diffs) + 1L]] <- .mi_diff(
        id = paste(origin$id, nm, "wording", sep = "::"),
        origin = origin,
        variable = nm,
        kind = "wording",
        severity = "review",
        message = "El fraseo difiere; se mantiene el label guia salvo que el usuario defina otro.",
        ref = .mi_scalar(gq$.label[gi], nm),
        current = .mi_scalar(oq$.label[i], nm),
        needs_decision = TRUE,
        suggested_name = nm,
        suggested_label = .mi_scalar(gq$.label[gi], nm),
        pos = oq$.pos[i]
      )
    }
  }
  for (i in seq_len(nrow(gq))) {
    nm <- as.character(gq$name[i])
    if (!nzchar(nm) || nm %in% o_names) next
    diffs[[length(diffs) + 1L]] <- .mi_diff(
      id = paste(origin$id, nm, "missing", sep = "::"),
      origin = origin,
      variable = nm,
      kind = "missing_in_origin",
      severity = "info",
      message = "La pregunta guia no existe en este origen; quedara vacia para sus casos.",
      ref = .mi_scalar(gq$.label[i], nm),
      needs_decision = FALSE,
      suggested_name = nm,
      suggested_label = .mi_scalar(gq$.label[i], nm),
      pos = gq$.pos[i]
    )
  }
  diffs
}

.mi_decision_ids <- function(decisions) {
  ids <- decisions$resolved_ids %||% decisions$resolvedIds %||% character(0)
  as.character(unlist(ids, use.names = FALSE))
}

.mi_decision_label <- function(decisions, name, fallback = "") {
  labels <- decisions$label_overrides %||% decisions$labelOverrides %||% list()
  val <- .mi_scalar(labels[[name]], "")
  if (nzchar(val)) val else fallback
}

.mi_decision_variant_name <- function(decisions, diff, existing) {
  variants <- decisions$variant_names %||% decisions$variantNames %||% list()
  raw <- .mi_scalar(variants[[diff$id]], "")
  val <- if (nzchar(raw)) .mi_key_name(raw) else ""
  if (!nzchar(val)) val <- diff$suggested_name
  if (!nzchar(val)) val <- .mi_variant_name(diff$variable, diff$origin_key, existing)
  if (val %in% existing) {
    if (identical(val, diff$suggested_name)) return(val)
    val <- .mi_variant_name(val, diff$origin_key, existing)
  }
  val
}

.mi_label_overrides_by_key <- function(audit, decisions = list()) {
  diffs <- audit$diffs %||% list()
  diffs <- Filter(function(diff) {
    .mi_scalar(diff$kind, "") %in% c("wording", "surveymonkey_wording")
  }, diffs)
  out <- list()
  for (diff in diffs) {
    var <- .mi_scalar(diff$suggested_name, .mi_scalar(diff$variable, ""))
    if (!nzchar(var)) next
    current_key <- .mi_scalar(diff$origin_key, "")
    current_txt <- .mi_scalar(diff$current, "")
    if (nzchar(current_key) && nzchar(current_txt)) {
      if (is.null(out[[current_key]])) out[[current_key]] <- list()
      out[[current_key]][[var]] <- current_txt
    }
    ref_key <- .mi_scalar(diff$ref_origin_key, "")
    ref_txt <- .mi_scalar(diff$ref, "")
    if (nzchar(ref_key) && nzchar(ref_txt)) {
      if (is.null(out[[ref_key]])) out[[ref_key]] <- list()
      out[[ref_key]][[var]] <- ref_txt
    }
  }
  out
}

.mi_standard_label_overrides <- function(audit, decisions = list()) {
  diffs <- audit$diffs %||% list()
  diffs <- Filter(function(diff) {
    .mi_scalar(diff$kind, "") %in% c("wording", "surveymonkey_wording")
  }, diffs)
  out <- list()
  for (diff in diffs) {
    if (isTRUE(diff$needs_decision) && !(diff$id %in% .mi_decision_ids(decisions))) next
    var <- .mi_scalar(diff$suggested_name, .mi_scalar(diff$variable, ""))
    if (!nzchar(var)) next
    label <- .mi_decision_label(decisions, var, diff$suggested_label)
    if (!nzchar(.mi_scalar(label, ""))) next
    out[[var]] <- label
  }
  explicit <- decisions$label_overrides %||% decisions$labelOverrides %||% list()
  if (is.list(explicit) && length(explicit)) {
    for (name in names(explicit)) {
      val <- .mi_scalar(explicit[[name]], "")
      if (nzchar(name) && nzchar(val)) out[[name]] <- val
    }
  }
  out
}

.mi_question_label <- function(model, variable, fallback = "") {
  q <- model$questions
  idx <- which(as.character(q$name %||% "") == variable)[1]
  if (!is.na(idx)) {
    label <- .mi_scalar(q$.label[idx], "")
    if (nzchar(label)) return(label)
  }
  .mi_scalar(fallback, variable)
}

.mi_manual_models <- function(sid, origins) {
  out <- list()
  for (origin in origins) {
    if (!identical(origin$source_kind, "manual")) next
    meta <- get_file(sid, origin$xlsform_file_id)
    out[[origin$id]] <- .mi_xlsform_model(meta$path, origin$xlsform_file_id, origin$label)
  }
  out
}

.mi_sm_models <- function(origins, token) {
  out <- list()
  sm_origins <- Filter(function(origin) identical(origin$source_kind, "surveymonkey"), origins)
  if (!length(sm_origins)) return(out)
  if (is.na(token) || !nzchar(token)) stop_api(400, "E_SM_TOKEN", "Falta token SurveyMonkey guardado.")
  for (origin in sm_origins) {
    details <- sm_api_fetch_survey_details(origin$survey_id, token)
    xls <- sm_api_xlsform(details, style = .sm_api_default_style(), lang = "es")
    out[[origin$id]] <- .mi_xlsform_model_from_frames(
      xls$survey,
      xls$choices,
      xls$settings,
      path = paste0("surveymonkey:", origin$survey_id),
      file_id = origin$survey_id,
      label = .mi_scalar(details$title, origin$label)
    )
  }
  out
}

.mi_audit <- function(sid, guide_xlsform_file_id, origins, origin_key_name = "origen", profile_id = NULL) {
  guide_ref <- .sm_mb_canonical_inst(sid, guide_xlsform_file_id)
  guide_meta <- guide_ref$meta
  guide <- .mi_xlsform_model(guide_meta$path, guide_meta$file_id, guide_meta$original_name)
  key_name <- .mi_key_name(origin_key_name)
  if (key_name %in% as.character(guide$survey$name %||% "")) {
    stop_api(409, "E_MULTI_KEY_CONFLICT", sprintf("El XLSForm guia ya tiene una variable llamada '%s'.", key_name))
  }
  origins <- .mi_origin_specs(origins)
  if (length(origins) < 1L) stop_api(400, "E_MULTI_ORIGINS", "Agrega al menos un origen.")
  key_values <- vapply(origins, `[[`, character(1), "key_slug")
  if (anyDuplicated(key_values)) {
    stop_api(400, "E_MULTI_KEY_DUP", "Los valores de llave deben ser unicos dentro de la integracion.")
  }

  diffs <- list()
  models <- .mi_manual_models(sid, origins)
  existing <- as.character(guide$questions$name)
  for (origin in origins) {
    if (identical(origin$source_kind, "manual")) {
      one <- .mi_compare_manual_origin(guide, models[[origin$id]], origin, existing)
      if (length(one)) {
        for (d in one) {
          diffs[[length(diffs) + 1L]] <- d
          if (nzchar(d$suggested_name)) existing <- unique(c(existing, d$suggested_name))
        }
      }
    }
  }

  sm_origins <- Filter(function(x) identical(x$source_kind, "surveymonkey"), origins)
  sm_audit <- NULL
  company_vars <- character(0)
  if (length(sm_origins)) {
    token <- .connections_token_require("surveymonkey", sid, profile_id = profile_id)
    sm_specs <- lapply(sm_origins, function(o) list(
      survey_id = o$survey_id,
      pais = o$key_value,
      label = o$label,
      data_file_id = o$data_file_id
    ))
    sm_audit <- sm_multibase_audit(sm_specs, token, canonical_inst = reporte_instrumento(guide_meta$path))
    company_vars <- unlist(sm_audit$company_variables %||% list(), use.names = FALSE)
    ref_survey_id <- .mi_scalar(sm_audit$ref_survey_id, sm_origins[[1]]$survey_id)
    ref_origin_idx <- which(vapply(sm_origins, `[[`, character(1), "survey_id") == ref_survey_id)[1]
    if (is.na(ref_origin_idx)) ref_origin_idx <- 1L
    ref_origin <- sm_origins[[ref_origin_idx]]
    variant_seen <- character(0)
    if (length(sm_audit$diffs %||% list())) {
      for (d in sm_audit$diffs) {
        origin_idx <- which(vapply(sm_origins, `[[`, character(1), "survey_id") == .mi_scalar(d$survey_id, ""))[1]
        if (is.na(origin_idx)) origin_idx <- 1L
        origin <- sm_origins[[origin_idx]]
        raw_kind <- .mi_scalar(d$kind, "diff")
        variable <- .mi_scalar(d$variable, paste0("p", d$pos))
        is_variant <- raw_kind %in% c("options_variant")
        if (is_variant) variant_seen <- unique(c(variant_seen, paste(origin$id, variable, sep = "::")))
        final_kind <- if (is_variant) raw_kind else paste0("surveymonkey_", raw_kind)
        suggested_name <- if (is_variant) .mi_variant_name(variable, origin$key_value, existing) else variable
        suggested_label <- if (is_variant) {
          paste(.mi_scalar(d$current, .mi_scalar(d$ref, variable)), origin$key_value, sep = " - ")
        } else {
          .mi_scalar(d$ref, "")
        }
        needs <- !identical(d$severity, "special")
        diffs[[length(diffs) + 1L]] <- .mi_diff(
          id = paste(origin$id, variable, raw_kind, sep = "::"),
          origin = origin,
          variable = variable,
          kind = final_kind,
          severity = if (identical(d$kind, "company_logic")) "blocking" else .mi_scalar(d$severity, "review"),
          message = .mi_scalar(d$message, "Diferencia SurveyMonkey detectada."),
          ref = .mi_scalar(d$ref, ""),
          current = .mi_scalar(d$current, ""),
          needs_decision = needs && !identical(d$severity, "blocking"),
          suggested_name = suggested_name,
          suggested_label = suggested_label,
          pos = suppressWarnings(as.integer(d$pos %||% NA_integer_)),
          ref_origin_id = ref_origin$id,
          ref_origin_key = ref_origin$key_value
        )
        if (is_variant && nzchar(suggested_name)) existing <- unique(c(existing, suggested_name))
      }
    }
    option_vars <- unique(vapply(
      Filter(function(d) identical(.mi_scalar(d$kind, ""), "options_variant"), sm_audit$diffs %||% list()),
      function(d) .mi_scalar(d$variable, paste0("p", d$pos)),
        character(1)
      ))
    option_vars <- option_vars[nzchar(option_vars)]
    if (length(option_vars)) {
      for (variable in option_vars) {
        seed <- Filter(function(d) identical(.mi_scalar(d$variable, ""), variable), sm_audit$diffs %||% list())[[1]]
        pos <- suppressWarnings(as.integer(seed$pos %||% .sm_mb_question_pos_for_var(variable)))
        ref_label <- .mi_question_label(guide, variable, .mi_scalar(seed$ref, variable))
        for (origin in sm_origins) {
          key <- paste(origin$id, variable, sep = "::")
          if (key %in% variant_seen) next
          suggested_name <- .mi_variant_name(variable, origin$key_value, existing)
          synthetic <- .mi_diff(
            id = paste(origin$id, variable, "options_variant", "source", sep = "::"),
            origin = origin,
            variable = variable,
            kind = "options_variant",
            severity = "review",
            message = "Esta pregunta se integrara como variante por llave.",
            ref = ref_label,
            current = ref_label,
            needs_decision = TRUE,
            suggested_name = suggested_name,
            suggested_label = paste(ref_label, origin$key_value, sep = " - "),
            pos = pos,
            ref_origin_id = ref_origin$id,
            ref_origin_key = ref_origin$key_value
          )
          synthetic$replace_source <- identical(origin$survey_id, ref_survey_id)
          diffs[[length(diffs) + 1L]] <- synthetic
          variant_seen <- unique(c(variant_seen, key))
          existing <- unique(c(existing, suggested_name))
        }
      }
    }
  }

  pending <- vapply(diffs, function(d) isTRUE(d$needs_decision), logical(1))
  blocking <- vapply(diffs, function(d) identical(d$severity, "blocking"), logical(1))
  list(
    ok = !any(blocking),
    origin_key_name = key_name,
    guide = list(file_id = guide_meta$file_id, original_name = guide_meta$original_name),
    origins = lapply(origins, function(o) list(
      id = o$id, source_kind = o$source_kind, key_value = o$key_value,
      label = o$label, survey_id = o$survey_id,
      xlsform_file_id = o$xlsform_file_id, data_file_id = o$data_file_id
    )),
    n_origins = length(origins),
    n_pending = as.integer(sum(pending)),
    n_blocking = as.integer(sum(blocking)),
    n_info = as.integer(sum(vapply(diffs, function(d) identical(d$severity, "info"), logical(1)))),
    company_variables = as.list(company_vars),
    diffs = diffs
  )
}

.mi_row_like <- function(df, values = list()) {
  out <- as.data.frame(setNames(replicate(ncol(df), NA_character_, simplify = FALSE), names(df)),
                       stringsAsFactors = FALSE, check.names = FALSE)
  for (nm in names(values)) {
    if (!(nm %in% names(out))) out[[nm]] <- NA_character_
    out[[nm]][1] <- values[[nm]]
  }
  out[, names(df), drop = FALSE]
}

.mi_replace_type_list <- function(type, new_list) {
  base <- .mi_type_base(type)
  if (!base %in% c("select_one", "select_multiple")) return(type)
  paste(base, new_list)
}

.mi_copy_variant_rows <- function(origin_model, diff, new_name, new_label) {
  names_raw <- as.character(origin_model$survey$name)
  exact_idx <- which(names_raw == diff$variable)[1]
  prefix <- paste0(diff$variable, "_")
  child_idx <- which(startsWith(names_raw, prefix))
  idx <- unique(c(exact_idx[!is.na(exact_idx)], child_idx))
  if (!length(idx)) return(list(survey = NULL, choices = NULL))
  row <- origin_model$survey[idx, , drop = FALSE]
  row$label <- .mi_label_fill(row, .mi_label_candidates(row))
  if (!"name" %in% names(row)) row$name <- NA_character_
  if (!"type" %in% names(row)) row$type <- NA_character_
  lab_col <- .mi_label_col(row)
  if (is.na(lab_col)) {
    row$label <- NA_character_
    lab_col <- "label"
  }
  old_list <- .mi_type_list(row$type[1])
  new_list <- ""
  if (nzchar(old_list)) {
    new_list <- paste0(new_name, "_list")
    row$type <- vapply(row$type, .mi_replace_type_list, character(1), new_list = new_list)
  }
  old_names <- as.character(row$name)
  row$name <- ifelse(
    old_names == diff$variable,
    new_name,
    paste0(new_name, substring(old_names, nchar(diff$variable) + 1L))
  )
  expr_cols <- intersect(c("relevant", "constraint", "calculation", "choice_filter"), names(row))
  if (length(expr_cols)) {
    old_ref <- paste0("${", diff$variable, "}")
    new_ref <- paste0("${", new_name, "}")
    for (col in expr_cols) {
      row[[col]] <- gsub(old_ref, new_ref, as.character(row[[col]] %||% ""), fixed = TRUE)
      row[[col]][!nzchar(row[[col]])] <- NA_character_
    }
  }
  main_idx <- which(as.character(row$name) == new_name)[1]
  if (nzchar(new_label) && !is.na(main_idx)) row[[lab_col]][main_idx] <- new_label
  if (nzchar(new_label) && !is.na(main_idx) && lab_col != "label" && "label" %in% names(row)) {
    row$label[main_idx] <- new_label
  }
  choices <- NULL
  if (nzchar(old_list) && "list_name" %in% names(origin_model$choices)) {
    choices <- origin_model$choices[as.character(origin_model$choices$list_name) == old_list, , drop = FALSE]
    if (nrow(choices)) choices$list_name <- new_list
  }
  list(survey = row, choices = choices)
}

.mi_remove_source_variant_rows <- function(survey, choices, source_vars) {
  source_vars <- unique(as.character(source_vars %||% character(0)))
  source_vars <- source_vars[!is.na(source_vars) & nzchar(source_vars)]
  if (!length(source_vars) || is.null(survey) || !nrow(survey) || !"name" %in% names(survey)) {
    return(list(survey = survey, choices = choices))
  }
  remove_idx <- integer(0)
  remove_lists <- character(0)
  names_raw <- as.character(survey$name %||% "")
  for (var in source_vars) {
    idx <- which(names_raw == var | startsWith(names_raw, paste0(var, "_")))
    if (!length(idx)) next
    remove_idx <- unique(c(remove_idx, idx))
    remove_lists <- unique(c(remove_lists, vapply(survey$type[idx], .mi_type_list, character(1))))
  }
  remove_lists <- remove_lists[nzchar(remove_lists)]
  if (length(remove_idx)) survey <- survey[-remove_idx, , drop = FALSE]
  if (length(remove_lists) && !is.null(choices) && nrow(choices) && "list_name" %in% names(choices)) {
    choices <- choices[!(as.character(choices$list_name) %in% remove_lists), , drop = FALSE]
  }
  list(survey = survey, choices = choices)
}

.mi_variant_anchor_sort_key <- function(guide, variable, pos = NA_integer_) {
  survey <- guide$survey %||% data.frame()
  if (!is.null(survey) && nrow(survey) && "name" %in% names(survey)) {
    names_raw <- as.character(survey$name %||% "")
    idx <- which(names_raw == variable | startsWith(names_raw, paste0(variable, "_")))
    if (length(idx)) return(as.numeric(max(idx, na.rm = TRUE)))
  }
  pos <- suppressWarnings(as.integer(pos %||% NA_integer_))
  questions <- guide$questions %||% data.frame()
  if (!is.na(pos) && !is.null(questions) && nrow(questions) >= pos && ".row_index" %in% names(questions)) {
    idx <- suppressWarnings(as.numeric(questions$.row_index[pos]))
    if (is.finite(idx)) return(idx)
  }
  if (!is.null(survey) && nrow(survey)) return(as.numeric(nrow(survey)))
  1
}

.mi_safe_company_ref_row <- function(survey, idx, var, col) {
  nm <- .mi_scalar(survey$name[idx], "")
  type <- .mi_scalar(survey$type[idx], "")
  lab_col <- .mi_label_col(survey)
  label <- if (!is.na(lab_col)) .mi_scalar(survey[[lab_col]][idx], "") else ""
  is_other_name <- nm %in% c(paste0(var, "_other"), paste0(var, "_otro"))
  is_other_label <- grepl("\\botro\\b|especifique", .mi_norm(label))
  identical(col, "relevant") && grepl("^text\\b", type) && (is_other_name || is_other_label)
}

.mi_clear_safe_company_refs <- function(survey, company_vars) {
  expr_cols <- intersect(c("relevant", "constraint", "calculation", "choice_filter"), names(survey))
  if (!length(expr_cols) || !length(company_vars)) return(survey)
  for (var in company_vars) {
    pat <- paste0("${", var, "}")
    for (col in expr_cols) {
      values <- as.character(survey[[col]] %||% "")
      idx <- which(grepl(pat, values, fixed = TRUE))
      if (!length(idx)) next
      safe <- vapply(idx, function(i) .mi_safe_company_ref_row(survey, i, var, col), logical(1))
      if (any(safe)) survey[[col]][idx[safe]] <- NA_character_
    }
  }
  survey
}

.mi_origin_key_list_name <- function(key_name) {
  paste0(.mi_slug(key_name, "origen"), "_opciones")
}

.mi_origin_key_choices <- function(choices, origins, list_name) {
  if (is.null(choices) || !is.data.frame(choices)) choices <- data.frame()
  for (col in c("list_name", "name", "label")) {
    if (!col %in% names(choices)) choices[[col]] <- character(nrow(choices))
  }
  origins <- .mi_origin_specs(origins)
  values <- vapply(origins, function(origin) .mi_scalar(origin$key_value, ""), character(1))
  labels <- vapply(origins, function(origin) .mi_scalar(origin$key_label %||% origin$key_value, ""), character(1))
  keep <- nzchar(values) & !duplicated(values)
  values <- values[keep]
  labels <- labels[keep]
  if (!length(values)) return(choices)

  choices <- choices[as.character(choices$list_name %||% "") != list_name, , drop = FALSE]
  label_cols <- grep("^label", names(choices), value = TRUE, ignore.case = TRUE)
  rows <- lapply(seq_along(values), function(i) {
    row <- .mi_row_like(choices, list(list_name = list_name, name = values[[i]], label = labels[[i]]))
    for (col in label_cols) row[[col]][1] <- labels[[i]]
    row
  })
  rbind(choices, do.call(rbind, rows))
}

.mi_odk_value <- function(value) {
  value <- .mi_scalar(value, "")
  if (!grepl("'", value, fixed = TRUE)) return(paste0("'", value, "'"))
  if (!grepl('"', value, fixed = TRUE)) return(paste0('"', value, '"'))
  paste0("'", gsub("'", "’", value, fixed = TRUE), "'")
}

.mi_origin_relevant <- function(key_name, key_value) {
  paste0("${", key_name, "} = ", .mi_odk_value(key_value))
}

.mi_combine_relevant <- function(existing, condition) {
  existing <- .mi_scalar(existing, "")
  condition <- .mi_scalar(condition, "")
  if (!nzchar(condition)) return(if (nzchar(existing)) existing else NA_character_)
  if (!nzchar(existing)) return(condition)
  norm <- function(x) gsub("\\s+", "", tolower(as.character(x %||% "")))
  if (grepl(norm(condition), norm(existing), fixed = TRUE)) return(existing)
  paste0("(", existing, ") and (", condition, ")")
}

.mi_scope_rows_to_origin <- function(survey, key_name, key_value) {
  if (is.null(survey) || !is.data.frame(survey) || !nrow(survey)) return(survey)
  if (!"relevant" %in% names(survey)) survey$relevant <- NA_character_
  condition <- .mi_origin_relevant(key_name, key_value)
  survey$relevant <- vapply(
    survey$relevant,
    .mi_combine_relevant,
    character(1),
    condition = condition
  )
  survey
}

.mi_build_instrument <- function(sid, guide_file_id, origins, audit, decisions, sm_token = NA_character_) {
  guide_ref <- .sm_mb_canonical_inst(sid, guide_file_id)
  guide_meta <- guide_ref$meta
  guide <- .mi_xlsform_model(guide_meta$path, guide_file_id, guide_meta$original_name)
  origins <- .mi_origin_specs(origins)
  origin_by_id <- setNames(origins, vapply(origins, `[[`, character(1), "id"))
  manual_models <- .mi_manual_models(sid, origins)
  sm_variant_diffs <- Filter(function(diff) {
    origin <- origin_by_id[[diff$origin_id]]
    !is.null(origin) &&
      identical(origin$source_kind, "surveymonkey") &&
      diff$kind %in% c("options_variant", "structure_variant", "extra_question")
  }, audit$diffs %||% list())
  sm_models <- if (length(sm_variant_diffs)) .mi_sm_models(origins, sm_token) else list()
  survey <- guide$survey
  choices <- guide$choices
  survey$.mi_sort_key <- seq_len(nrow(survey))
  lab_col <- .mi_label_col(survey)
  if (is.na(lab_col)) {
    survey$label <- NA_character_
    lab_col <- "label"
  }

  key_name <- audit$origin_key_name %||% "origen"
  key_list <- .mi_origin_key_list_name(key_name)
  key_row <- .mi_row_like(survey, list(type = paste("select_one", key_list), name = key_name, label = key_name))
  key_row$.mi_sort_key <- 0
  key_row[[lab_col]][1] <- key_name
  if (lab_col != "label" && "label" %in% names(key_row)) key_row$label[1] <- key_name
  survey <- rbind(key_row, survey)
  choices <- .mi_origin_key_choices(choices, origins, key_list)

  company_vars <- unlist(audit$company_variables %||% list(), use.names = FALSE)
  if (length(company_vars)) {
    for (var in company_vars) {
      idx <- which(as.character(survey$name) == var)
      if (length(idx)) {
        survey$type[idx] <- "text"
        for (cc in intersect(c("choice_filter", "appearance"), names(survey))) survey[[cc]][idx] <- NA_character_
      }
    }
    survey <- .mi_clear_safe_company_refs(survey, company_vars)
  }

  for (name in names(decisions$label_overrides %||% list())) {
    idx <- which(as.character(survey$name) == name)
    val <- .mi_scalar(decisions$label_overrides[[name]], "")
    if (length(idx) && nzchar(val)) {
      survey[[lab_col]][idx] <- val
      if (lab_col != "label" && "label" %in% names(survey)) survey$label[idx] <- val
    }
  }

  replace_source_vars <- unique(vapply(
    Filter(function(diff) {
      isTRUE(diff$replace_source) &&
        diff$kind %in% c("extra_question", "options_variant", "structure_variant") &&
        diff$id %in% .mi_decision_ids(decisions)
    }, audit$diffs %||% list()),
    function(diff) .mi_scalar(diff$variable, ""),
    character(1)
  ))
  removed <- .mi_remove_source_variant_rows(survey, choices, replace_source_vars)
  survey <- removed$survey
  choices <- removed$choices

  variant_map <- list()
  existing_names <- as.character(survey$name)
  variant_order <- 0L
  for (diff in audit$diffs %||% list()) {
    if (!diff$kind %in% c("extra_question", "options_variant", "structure_variant")) next
    if (!(diff$id %in% .mi_decision_ids(decisions))) next
    origin <- origin_by_id[[diff$origin_id]]
    if (is.null(origin)) next
    origin_model <- if (identical(origin$source_kind, "manual")) {
      manual_models[[origin$id]]
    } else if (identical(origin$source_kind, "surveymonkey")) {
      sm_models[[origin$id]]
    } else {
      NULL
    }
    if (is.null(origin_model)) next
    new_name <- .mi_decision_variant_name(decisions, diff, existing_names)
    new_label <- .mi_decision_label(decisions, new_name, diff$suggested_label)
    if (!nzchar(new_label)) new_label <- paste(diff$current %||% diff$variable, diff$origin_key, sep = " - ")
    copied <- .mi_copy_variant_rows(origin_model, diff, new_name, new_label)
    if (!is.null(copied$survey) && nrow(copied$survey)) {
      copied$survey <- .mi_scope_rows_to_origin(copied$survey, key_name, origin$key_value)
      variant_order <- variant_order + 1L
      anchor <- .mi_variant_anchor_sort_key(guide, diff$variable, diff$pos)
      copied$survey$.mi_sort_key <- anchor + (variant_order / 100) + (seq_len(nrow(copied$survey)) / 10000)
      for (nm in setdiff(names(survey), names(copied$survey))) copied$survey[[nm]] <- NA_character_
      for (nm in setdiff(names(copied$survey), names(survey))) survey[[nm]] <- NA_character_
      survey <- rbind(survey, copied$survey[, names(survey), drop = FALSE])
      existing_names <- c(existing_names, new_name)
      variant_map[[diff$id]] <- list(
        origin_id = origin$id,
        origin_key = origin$key_value,
        origin_label = origin$label,
        source_kind = origin$source_kind,
        survey_id = origin$survey_id,
        from = diff$variable,
        to = new_name,
        pos = diff$pos,
        kind = diff$kind,
        replace_source = isTRUE(diff$replace_source)
      )
    }
    if (!is.null(copied$choices) && nrow(copied$choices)) {
      for (nm in setdiff(names(choices), names(copied$choices))) copied$choices[[nm]] <- NA_character_
      for (nm in setdiff(names(copied$choices), names(choices))) choices[[nm]] <- NA_character_
      choices <- rbind(choices, copied$choices[, names(choices), drop = FALSE])
    }
  }

  if (".mi_sort_key" %in% names(survey)) {
    sort_key <- suppressWarnings(as.numeric(survey$.mi_sort_key))
    sort_key[!is.finite(sort_key)] <- max(sort_key[is.finite(sort_key)], 0) + seq_len(sum(!is.finite(sort_key)))
    survey <- survey[order(sort_key), , drop = FALSE]
    survey$.mi_sort_key <- NULL
  }

  list(survey = survey, choices = choices, settings = guide$settings, variant_map = variant_map)
}

.mi_write_xlsform <- function(model, path) {
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

.mi_data_cols <- function(rp_inst, key_name) {
  survey <- rp_inst$survey
  if (!is.null(survey) && all(c("name", "type") %in% names(survey))) {
    types <- .mi_type_base(survey$type)
    keep <- !(types %in% .mi_non_question_types)
    vars <- as.character(survey$name[keep])
  } else if (!is.null(survey) && "name" %in% names(survey)) {
    vars <- as.character(survey$name)
  } else {
    vars <- character(0)
  }
  vars <- vars[!is.na(vars) & nzchar(vars)]
  unique(c(key_name, vars[vars != key_name]))
}

.mi_align_data <- function(df, cols) {
  cols <- as.character(cols %||% character(0))
  cols <- unique(cols[!is.na(cols) & nzchar(cols)])
  for (nm in setdiff(cols, names(df))) df[[nm]] <- rep(NA_character_, nrow(df))
  extras <- setdiff(names(df), cols)
  extras <- extras[!is.na(extras) & nzchar(extras)]
  df[, c(cols, extras), drop = FALSE]
}

.mi_import_manual_data <- function(sid, origin, variant_map, origin_key_name, rp_inst_final) {
  xls_meta <- get_file(sid, origin$xlsform_file_id)
  dat_meta <- get_file(sid, origin$data_file_id)
  rp_origin <- reporte_instrumento(path = xls_meta$path)
  df <- .read_data_from_path(dat_meta$path, dat_meta$ext)
  df <- normalize_data_for_xlsform(df, rp_origin)
  for (item in variant_map) {
    if (!identical(item$origin_id, origin$id)) next
    from <- .mi_scalar(item$from, "")
    to <- .mi_scalar(item$to, "")
    if (!nzchar(from) || !nzchar(to)) next
    cols <- names(df)[names(df) == from | startsWith(names(df), paste0(from, "_"))]
    for (col in cols) {
      target <- if (identical(col, from)) to else paste0(to, substring(col, nchar(from) + 1L))
      df[[target]] <- df[[col]]
      df[[col]] <- NA
    }
  }
  df[[origin_key_name]] <- origin$key_value
  .mi_align_data(as.data.frame(df, stringsAsFactors = FALSE), .mi_data_cols(rp_inst_final, origin_key_name))
}

.mi_import_sm_data <- function(origin, token, guide_inst, origin_key_name, company_vars, sid = NULL, variant_map = list()) {
  details <- sm_api_fetch_survey_details(origin$survey_id, token)
  title <- .mi_scalar(details$title, origin$label)
  origin_variants <- Filter(function(item) {
    identical(item$origin_id, origin$id) && identical(item$source_kind, "surveymonkey")
  }, variant_map %||% list())
  if (nzchar(origin$data_file_id) && !is.null(sid)) {
    df <- .sm_mb_read_upload_data(
      sid = sid, file_id = origin$data_file_id, details = details, inst = guide_inst,
      survey_id = origin$survey_id, pais = origin$key_value, source_title = title,
      company_vars = company_vars
    )
    for (item in origin_variants) {
      from <- .mi_scalar(item$from, "")
      to <- .mi_scalar(item$to, "")
      if (!nzchar(from) || !nzchar(to)) next
      cols <- names(df)[names(df) == from | startsWith(names(df), paste0(from, "_"))]
      for (col in cols) {
        target <- if (identical(col, from)) to else paste0(to, substring(col, nchar(from) + 1L))
        df[[target]] <- df[[col]]
        df[[col]] <- NA
      }
    }
  } else {
    payload <- sm_api_fetch_all_responses_bulk(origin$survey_id, token)
    df <- sm_multibase_api_responses_to_canonical_data(
      details = details,
      responses = payload$data,
      inst = guide_inst,
      survey_id = origin$survey_id,
      pais = origin$key_value,
      source_title = title,
      company_vars = company_vars,
      variant_map = origin_variants
    )
  }
  response_filter <- attr(df, "sm_response_filter", exact = TRUE)
  df[[origin_key_name]] <- rep(origin$key_value, nrow(df))
  if (!identical(origin_key_name, "pais") && "pais" %in% names(df)) df$pais <- NULL
  out <- as.data.frame(df, stringsAsFactors = FALSE)
  if (!is.null(response_filter)) {
    response_filter$survey_id <- origin$survey_id
    response_filter$key_value <- origin$key_value
    response_filter$label <- origin$label
    attr(out, "sm_response_filter") <- response_filter
  }
  out
}

.mi_draft_payload <- function(x) {
  if (is.null(x)) return(NULL)
  list(
    version = as.integer(x$version %||% 1L),
    source_mode = .mi_scalar(x$source_mode, "manual"),
    guide_xlsform_file_id = .mi_scalar(x$guide_xlsform_file_id, ""),
    guide_options = x$guide_options %||% list(),
    guide_survey_id = .mi_scalar(x$guide_survey_id, ""),
    origin_key_name = .mi_scalar(x$origin_key_name, "origen"),
    base_name = .mi_scalar(x$base_name, "base_integrada"),
    query = .mi_scalar(x$query, ""),
    rows = x$rows %||% list(),
    audit = x$audit %||% NULL,
    decisions = x$decisions %||% list(resolved_ids = character(0)),
    updated_at = .mi_scalar(
      x$updated_at,
      format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
    )
  )
}

.mi_persist_project_if_requested <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s) || is.null(s$project_path) || !nzchar(s$project_path)) {
    return(list(saved = FALSE, reason = "no_project"))
  }
  tryCatch({
    out <- build_pulso(sid, s$project_path)
    list(saved = TRUE, saved_at = out$saved_at, path = out$path)
  }, error = function(e) {
    list(saved = FALSE, error = conditionMessage(e))
  })
}

.mi_store_draft <- function(sid, draft, persist_project = FALSE) {
  payload <- .mi_draft_payload(draft)
  session_set(sid, "multi_integrated_draft", payload)
  project <- if (isTRUE(persist_project)) .mi_persist_project_if_requested(sid) else list(saved = FALSE, reason = "not_requested")
  list(ok = TRUE, draft = payload, project = project)
}

multi_integrated_import <- function(sid,
                                    guide_xlsform_file_id,
                                    origins,
                                    origin_key_name = "origen",
                                    base_name = "base_integrada",
                                    decisions = list(),
                                    profile_id = NULL) {
  origins <- .mi_origin_specs(origins)
  audit <- .mi_audit(
    sid,
    guide_xlsform_file_id,
    origins,
    origin_key_name,
    profile_id = profile_id
  )
  if (!isTRUE(audit$ok)) {
    stop_api(409, "E_MULTI_BLOCKED", "Hay diferencias bloqueantes antes de importar.")
  }
  pending_ids <- vapply(audit$diffs %||% list(), function(d) if (isTRUE(d$needs_decision)) d$id else NA_character_, character(1))
  pending_ids <- pending_ids[!is.na(pending_ids)]
  missing <- setdiff(pending_ids, .mi_decision_ids(decisions))
  if (length(missing)) {
    stop_api(409, "E_MULTI_PENDING_DECISIONS", "Resuelve las diferencias pendientes antes de importar.")
  }

  token <- NA_character_
  if (any(vapply(origins, function(o) identical(o$source_kind, "surveymonkey"), logical(1)))) {
    token <- .connections_token_require("surveymonkey", sid, profile_id = profile_id)
  }

  built <- .mi_build_instrument(sid, guide_xlsform_file_id, origins, audit, decisions, sm_token = token)
  downloads_dir <- file.path(session_get(sid)$dir, "downloads")
  dir.create(downloads_dir, recursive = TRUE, showWarnings = FALSE)
  inst_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_multi_integrado.xlsx"))
  .mi_write_xlsform(built, inst_path)
  inst_meta <- save_upload(
    sid, "xlsform", "instrumento_integrado.xlsx",
    readBin(inst_path, what = "raw", n = file.info(inst_path)$size)
  )
  rp_inst_final <- reporte_instrumento(path = inst_meta$path)

  guide_ref <- .sm_mb_canonical_inst(sid, guide_xlsform_file_id)
  guide_meta <- guide_ref$meta
  guide_inst <- reporte_instrumento(path = guide_meta$path)
  company_vars <- unlist(audit$company_variables %||% list(), use.names = FALSE)
  dfs <- lapply(origins, function(origin) {
    if (identical(origin$source_kind, "manual")) {
      .mi_import_manual_data(sid, origin, built$variant_map, audit$origin_key_name, rp_inst_final)
    } else {
      df <- .mi_import_sm_data(origin, token, rp_inst_final, audit$origin_key_name, company_vars, sid = sid, variant_map = built$variant_map)
      response_filter <- attr(df, "sm_response_filter", exact = TRUE)
      aligned <- .mi_align_data(df, .mi_data_cols(rp_inst_final, audit$origin_key_name))
      if (!is.null(response_filter)) attr(aligned, "sm_response_filter") <- response_filter
      aligned
    }
  })
  source_filters <- Filter(
    Negate(is.null),
    lapply(dfs, function(df) attr(df, "sm_response_filter", exact = TRUE))
  )
  data_df <- .sm_mb_bind_rows(dfs)
  if (!nrow(data_df)) stop_api(409, "E_MULTI_NO_ROWS", "No hay respuestas para importar.")
  data_df <- .mi_align_data(data_df, .mi_data_cols(rp_inst_final, audit$origin_key_name))
  data_df <- normalize_data_for_xlsform(data_df, rp_inst_final)
  .carga_assert_data_xlsform_compatible(data_df, rp_inst_final)

  data_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_multi_integrado_data.xlsx"))
  .sm_mb_write_xlsx(data_df, data_path)
  data_meta <- save_upload(
    sid, "data", "base_integrada.xlsx",
    readBin(data_path, what = "raw", n = file.info(data_path)$size)
  )
  rp_data <- reporte_data(data_df, instrumento = rp_inst_final)
  nombre <- .mi_slug(base_name, "base_integrada")
  if (nombre %in% names(estudio_list_bases(sid))) {
    base0 <- nombre
    i <- 2L
    repeat {
      candidate <- paste0(base0, "_", i)
      if (!(candidate %in% names(estudio_list_bases(sid)))) {
        nombre <- candidate
        break
      }
      i <- i + 1L
    }
  }
  base_meta <- estudio_add_base(
    sid,
    nombre = nombre,
    xlsform_file_id = inst_meta$file_id,
    data_file_id = data_meta$file_id,
    data_ext = "xlsx",
    rp_data = rp_data,
    rp_inst = rp_inst_final,
    n_filas = as.integer(nrow(data_df)),
    n_columnas = as.integer(ncol(data_df))
  )
  s_meta <- session_get(sid)
  if (!is.null(s_meta$estudio$bases[[nombre]])) {
    s_meta$estudio$bases[[nombre]]$multi_integrated <- list(
      version = 1L,
      kind = "integrated_instruments",
      origin_key_name = audit$origin_key_name,
      guide_xlsform_file_id = guide_xlsform_file_id,
      origins = audit$origins %||% list(),
      variant_map = built$variant_map %||% list(),
      label_overrides_standard = .mi_standard_label_overrides(audit, decisions),
      label_overrides_by_key = .mi_label_overrides_by_key(audit, decisions),
      imported_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
    )
    s_meta <- .mark_project_dirty(s_meta)
    .session_env[[sid]] <- s_meta
    base_meta <- s_meta$estudio$bases[[nombre]]
  }
  session_set(sid, "analitica_prep_ok", TRUE)
  session_set(sid, "analitica_multibase_available", TRUE)
  session_set(sid, "analitica_fuente", sprintf("estudio:%s", nombre))
  session_set(sid, "multi_integrated_draft", NULL)
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

.mi_docx_kind_label <- function(kind) {
  kind <- .mi_scalar(kind, "")
  if (kind %in% c("wording", "surveymonkey_wording")) return("Fraseo")
  if (kind %in% c("options_variant", "surveymonkey_options_variant", "surveymonkey_options")) return("Categorias distintas")
  if (kind %in% c("structure_variant", "surveymonkey_structure")) return("Estructura distinta")
  if (kind %in% c("extra_question")) return("Pregunta diferencial")
  if (kind %in% c("missing_in_origin")) return("Ausente")
  kind
}

.mi_docx_group_key <- function(diff) {
  kind <- .mi_scalar(diff$kind, "")
  if (kind %in% c("wording", "surveymonkey_wording")) {
    return(paste("wording", .mi_scalar(diff$suggested_name, diff$variable), sep = "::"))
  }
  if (grepl("options|structure|extra_question", kind)) {
    return(paste(kind, .mi_scalar(diff$variable, diff$id), sep = "::"))
  }
  paste("single", .mi_scalar(diff$id, ""), sep = "::")
}

.mi_docx_group_diffs <- function(diffs) {
  groups <- list()
  order <- character(0)
  for (diff in diffs %||% list()) {
    key <- .mi_docx_group_key(diff)
    if (is.null(groups[[key]])) {
      groups[[key]] <- list(key = key, diffs = list())
      order <- c(order, key)
    }
    groups[[key]]$diffs[[length(groups[[key]]$diffs) + 1L]] <- diff
  }
  groups[order]
}

.mi_docx_diff_parts <- function(value, against) {
  value <- .mi_scalar(value, "")
  against <- .mi_scalar(against, "")
  if (!nzchar(value) || identical(value, against)) {
    return(list(list(text = value, highlight = FALSE)))
  }
  v <- strsplit(value, "", fixed = TRUE)[[1]]
  a <- strsplit(against, "", fixed = TRUE)[[1]]
  prefix <- 0L
  max_prefix <- min(length(v), length(a))
  while (prefix < max_prefix && identical(v[[prefix + 1L]], a[[prefix + 1L]])) prefix <- prefix + 1L
  suffix <- 0L
  max_suffix <- min(length(v) - prefix, length(a) - prefix)
  while (
    suffix < max_suffix &&
      identical(v[[length(v) - suffix]], a[[length(a) - suffix]])
  ) {
    suffix <- suffix + 1L
  }
  before <- if (prefix > 0L) paste(v[seq_len(prefix)], collapse = "") else ""
  middle_end <- length(v) - suffix
  middle <- if (middle_end > prefix) paste(v[(prefix + 1L):middle_end], collapse = "") else ""
  after <- if (suffix > 0L) paste(v[(length(v) - suffix + 1L):length(v)], collapse = "") else ""
  Filter(function(x) nzchar(x$text), list(
    list(text = before, highlight = FALSE),
    list(text = middle, highlight = TRUE),
    list(text = after, highlight = FALSE)
  ))
}

.mi_docx_add_diff_line <- function(label, value, against = "", highlight = TRUE, keep_with_next = FALSE) {
  normal <- officer::fp_text(font.size = 9.5, font.family = "Arial", color = "#2b3442")
  bold <- officer::fp_text(font.size = 9.5, font.family = "Arial", bold = TRUE, color = "#5f6b7a")
  mark <- officer::fp_text(font.size = 9.5, font.family = "Arial", color = "#1f2937", shading.color = "#fff2a8")
  label <- .mi_scalar(label, "")
  if (!nzchar(label)) label <- "Referencia"
  runs <- list(
    officer::ftext("• ", prop = normal),
    officer::ftext(paste0(label, ": "), prop = bold)
  )
  parts <- if (isTRUE(highlight)) .mi_docx_diff_parts(value, against) else list(list(text = .mi_scalar(value, ""), highlight = FALSE))
  for (part in parts) {
    runs[[length(runs) + 1L]] <- officer::ftext(part$text, prop = if (isTRUE(part$highlight)) mark else normal)
  }
  do.call(officer::fpar, c(runs, list(fp_p = officer::fp_par(
    line_spacing = 1.08,
    padding.left = 28,
    padding.bottom = 8,
    keep_with_next = isTRUE(keep_with_next)
  ))))
}

.mi_docx_first_origin_key <- function(audit) {
  origins <- audit$origins %||% list()
  if (length(origins)) {
    val <- .mi_scalar(origins[[1]]$key_value %||% origins[[1]]$origin_key, "")
    if (nzchar(val)) return(val)
  }
  "Referencia"
}

.mi_docx_nonempty <- function(x, fallback = "") {
  val <- .mi_scalar(x, "")
  if (nzchar(val)) val else fallback
}

.mi_docx_group_references <- function(diffs_group, audit = list()) {
  out <- list()
  seen <- character(0)
  add <- function(key, text, against = "", highlight = TRUE) {
    key <- .mi_docx_nonempty(key, "Origen")
    text <- .mi_scalar(text, "")
    if (!nzchar(text)) return(NULL)
    id <- paste(key, text, sep = "\r")
    if (id %in% seen) return(NULL)
    seen <<- c(seen, id)
    out[[length(out) + 1L]] <<- list(key = key, text = text, against = against, highlight = highlight)
    NULL
  }
  ref_key <- .mi_docx_nonempty(diffs_group[[1]]$ref_origin_key, .mi_docx_first_origin_key(audit))
  ref_text <- .mi_scalar(diffs_group[[1]]$ref, "")
  ref_against <- ""
  for (item in diffs_group) {
    candidate <- .mi_scalar(item$current, "")
    if (nzchar(candidate) && !identical(candidate, ref_text)) {
      ref_against <- candidate
      break
    }
  }
  add(ref_key, ref_text, ref_against, nzchar(ref_against))
  for (item in diffs_group) {
    add(.mi_docx_nonempty(item$origin_key, "Origen"), .mi_scalar(item$current, ""), ref_text, TRUE)
  }
  out
}

.mi_decisions_docx <- function(audit, decisions = list(), path) {
  if (!requireNamespace("officer", quietly = TRUE)) {
    stop_api(500, "E_OFFICER_MISSING", "Para exportar Word se requiere el paquete officer.")
  }
  diffs <- audit$diffs %||% list()
  diffs <- Filter(function(d) .mi_scalar(d$kind, "") %in% c("wording", "surveymonkey_wording"), diffs)
  groups <- .mi_docx_group_diffs(diffs)
  title_prop <- officer::fp_text(font.size = 18, bold = TRUE, font.family = "Arial", color = "#0b2f66")
  meta_prop <- officer::fp_text(font.size = 10, font.family = "Arial", color = "#5f6b7a")
  label_prop <- officer::fp_text(font.size = 10, bold = TRUE, font.family = "Arial", color = "#243244")
  blank_prop <- officer::fp_text(font.size = 10, font.family = "Arial", color = "#6b7280", italic = TRUE)

  doc <- officer::read_docx()
  doc <- officer::body_add_fpar(doc, officer::fpar(
    officer::ftext("Revisión de diferencias", title_prop),
    fp_p = officer::fp_par(padding.bottom = 4, keep_with_next = TRUE)
  ))
  doc <- officer::body_add_fpar(doc, officer::fpar(
    officer::ftext(sprintf(
      "%s origen(es) · %s diferencia(s) · llave %s",
      .mi_scalar(audit$n_origins, "0"),
      length(diffs),
      .mi_scalar(audit$origin_key_name, "origen")
    ), meta_prop),
    fp_p = officer::fp_par(padding.bottom = 10)
  ))

  if (!length(groups)) {
    doc <- officer::body_add_par(doc, "No hay diferencias de fraseo para documentar.", style = "Normal")
    print(doc, target = path)
    return(path)
  }

  idx <- 0L
  for (group in groups) {
    idx <- idx + 1L
    diffs_group <- group$diffs
    diff <- diffs_group[[1]]
    variable <- .mi_scalar(diff$variable, "")
    references <- .mi_docx_group_references(diffs_group, audit)

    doc <- officer::body_add_fpar(doc, officer::fpar(
      officer::ftext(sprintf("%02d. Fraseo", idx), label_prop),
      officer::ftext(if (nzchar(variable)) paste0(" · ", variable) else "", meta_prop),
      fp_p = officer::fp_par(
        padding.top = if (idx == 1L) 6 else 16,
        padding.bottom = 4,
        keep_with_next = TRUE
      )
    ))
    doc <- officer::body_add_fpar(doc, officer::fpar(
      officer::ftext("Fraseo final: ", label_prop),
      officer::ftext("____________________________________________________________", blank_prop),
      fp_p = officer::fp_par(padding.bottom = 12, keep_with_next = TRUE)
    ))
    doc <- officer::body_add_fpar(doc, officer::fpar(
      officer::ftext("Referencias por llave", label_prop),
      fp_p = officer::fp_par(padding.bottom = 5, keep_with_next = length(references) > 0L)
    ))

    for (i in seq_along(references)) {
      item <- references[[i]]
      doc <- officer::body_add_fpar(
        doc,
        .mi_docx_add_diff_line(
          item$key,
          item$text,
          item$against,
          highlight = item$highlight,
          keep_with_next = i < length(references)
        )
      )
    }
  }
  print(doc, target = path)
  path
}

mount_multi_integrated <- function(pr) {
  pr |>
    plumber::pr_get("/api/multi/integrated/draft", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      s <- session_get(sid)
      list(ok = TRUE, draft = s$multi_integrated_draft %||% NULL)
    })) |>
    plumber::pr_put("/api/multi/integrated/draft", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      parsed <- .xlsform_editor_parse_body(req)
      persist_project <- isTRUE(parsed$persist_project %||% FALSE)
      draft <- parsed$draft %||% parsed
      draft$persist_project <- NULL
      .mi_store_draft(sid, draft, persist_project = persist_project)
    })) |>
    plumber::pr_delete("/api/multi/integrated/draft", wrap_endpoint(function(req, res, persist_project = FALSE, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      persist_project <- .mi_scalar(persist_project, "") %in% c("TRUE", "true", "1", "yes", "si")
      session_set(sid, "multi_integrated_draft", NULL)
      project <- if (isTRUE(persist_project)) .mi_persist_project_if_requested(sid) else list(saved = FALSE, reason = "not_requested")
      list(ok = TRUE, draft = NULL, project = project)
    })) |>
    plumber::pr_post("/api/multi/integrated/audit", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      parsed <- .xlsform_editor_parse_body(req)
      profile_id <- trimws(.mi_scalar(
        parsed$connection_profile_id %||% parsed$connectionProfileId %||% parsed$profile_id %||% parsed$profileId,
        ""
      ))
      if (!nzchar(profile_id)) profile_id <- NULL
      .mi_audit(
        sid = sid,
        guide_xlsform_file_id = .mi_scalar(parsed$guide_xlsform_file_id, ""),
        origins = parsed$origins %||% list(),
        origin_key_name = .mi_scalar(parsed$origin_key_name, "origen"),
        profile_id = profile_id
      )
    })) |>
    plumber::pr_post("/api/multi/integrated/import", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      parsed <- .xlsform_editor_parse_body(req)
      profile_id <- trimws(.mi_scalar(
        parsed$connection_profile_id %||% parsed$connectionProfileId %||% parsed$profile_id %||% parsed$profileId,
        ""
      ))
      if (!nzchar(profile_id)) profile_id <- NULL
      multi_integrated_import(
        sid = sid,
        guide_xlsform_file_id = .mi_scalar(parsed$guide_xlsform_file_id, ""),
        origins = parsed$origins %||% list(),
        origin_key_name = .mi_scalar(parsed$origin_key_name, "origen"),
        base_name = .mi_scalar(parsed$base_name, "base_integrada"),
        decisions = parsed$decisions %||% list(),
        profile_id = profile_id
      )
    })) |>
    plumber::pr_post("/api/multi/integrated/decisions-docx", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      parsed <- .xlsform_editor_parse_body(req)
      audit <- parsed$audit %||% NULL
      if (is.null(audit) || is.null(audit$diffs)) {
        stop_api(400, "E_MULTI_AUDIT_REQUIRED", "Falta la auditoria para generar el Word.")
      }
      downloads_dir <- file.path(session_get(sid)$dir, "downloads")
      dir.create(downloads_dir, recursive = TRUE, showWarnings = FALSE)
      filename <- "diferencias_integracion.docx"
      out_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", filename))
      .mi_decisions_docx(audit, parsed$decisions %||% list(), out_path)
      n <- file.info(out_path)$size
      bytes <- readBin(out_path, what = "raw", n = n)
      res$setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
      res$setHeader("Content-Length", as.character(n))
      res$setHeader("Content-Disposition", sprintf('attachment; filename="%s"', filename))
      res$body <- bytes
      res
    }))
}
