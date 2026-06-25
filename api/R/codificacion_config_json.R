CODIF_CONFIG_SCHEMA_VERSION <- "prosecnur.coding_config.v1"

.codif_config_now <- function() {
  format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
}

.codif_config_scalar <- function(x, default = "") {
  if (is.null(x) || length(x) == 0L) return(default)
  value <- as.character(x[[1]])
  if (is.na(value)) default else value
}

.codif_config_norm <- function(x) {
  x <- .codif_config_scalar(x, "")
  x <- trimws(tolower(x))
  x <- if (requireNamespace("stringi", quietly = TRUE)) {
    stringi::stri_trans_general(x, "Latin-ASCII")
  } else {
    iconv(x, from = "", to = "ASCII//TRANSLIT", sub = "")
  }
  x[is.na(x)] <- ""
  gsub("_+", "_", gsub("^_+|_+$", "", gsub("[^a-z0-9]+", "_", x)))
}

.codif_config_hash <- function(x) {
  digest::digest(x, algo = "sha256", serialize = TRUE)
}

.codif_config_app_version <- function() {
  tryCatch(as.character(utils::packageVersion("prosecnurapp")), error = function(e) "dev")
}

.codif_config_project_label <- function(sid) {
  s <- session_get(sid)
  if (!is.null(s$project_path) && nzchar(.codif_config_scalar(s$project_path))) {
    return(tools::file_path_sans_ext(basename(s$project_path)))
  }
  .codif_config_scalar((s$estudio %||% list())$nombre, "Prosecnur")
}

.codif_config_filename <- function(sid) {
  project <- if (exists(".export_project_slug", mode = "function")) {
    .export_project_slug(sid)
  } else {
    .codif_config_norm(.codif_config_project_label(sid))
  }
  sprintf("prosecnur_codificacion_%s_%s.json", project, format(Sys.Date(), "%Y-%m-%d"))
}

.codif_config_base_names <- function(sid) {
  s <- session_get(sid)
  bases <- names((s$estudio %||% list())$bases %||% list())
  if (length(bases) > 0L) return(bases)
  unique(c(.codif_config_scalar(tryCatch(codif_source_active(sid), error = function(e) "default"), "default"),
           names(s$codif_por_base %||% list())))
}

.codif_config_mode <- function(sid) {
  if (length(.codif_config_base_names(sid)) > 1L) "multibase" else "unibase"
}

.codif_config_processing_mode <- function(sid) {
  s <- session_get(sid)
  .codif_config_scalar((s$estudio %||% list())$processing_mode, .codif_config_mode(sid))
}

.codif_config_var_type_from_inst <- function(inst, var) {
  survey <- inst$survey %||% inst$survey_raw
  if (is.null(survey) || !is.data.frame(survey) || !"name" %in% names(survey)) return("")
  hit <- which(as.character(survey$name) == .codif_config_scalar(var, ""))[1]
  if (is.na(hit)) return("")
  type_raw <- .codif_config_scalar(survey$type[[hit]], "")
  sub("\\s+.*$", "", type_raw)
}

.codif_config_options_for_var <- function(inst, var) {
  list_name <- tryCatch(.codif_list_name_for_var(inst, var), error = function(e) "")
  choices <- tryCatch(.codif_choice_rows(inst, list_name), error = function(e) data.frame())
  if (is.null(choices) || !is.data.frame(choices) || nrow(choices) == 0L) return(list())
  labels <- tryCatch(.codif_choice_labels(choices), error = function(e) as.character(choices$name))
  codes <- as.character(choices$name %||% seq_len(nrow(choices)))
  lapply(seq_len(nrow(choices)), function(i) {
    list(code = .codif_config_scalar(codes[i], ""), label = .codif_config_scalar(labels[i], ""))
  })
}

.codif_config_options_similarity <- function(a, b) {
  codes_a <- vapply(a %||% list(), function(x) .codif_config_scalar(x$code, ""), character(1))
  codes_b <- vapply(b %||% list(), function(x) .codif_config_scalar(x$code, ""), character(1))
  codes_a <- codes_a[nzchar(codes_a)]
  codes_b <- codes_b[nzchar(codes_b)]
  if (!length(codes_a) && !length(codes_b)) return(1)
  if (!length(codes_a) || !length(codes_b)) return(0.4)
  length(intersect(codes_a, codes_b)) / length(union(codes_a, codes_b))
}

.codif_config_variable_fingerprint <- function(name, label, type, base_id, options = list()) {
  .codif_config_hash(list(
    name = .codif_config_norm(name),
    label = .codif_config_norm(label),
    type = .codif_config_norm(type),
    base_id = .codif_config_norm(base_id),
    options = lapply(options %||% list(), function(o) {
      list(code = .codif_config_norm(o$code), label = .codif_config_norm(o$label))
    })
  ))
}

.codif_config_groups_for_row <- function(row, groups_map) {
  keys <- unique(c(
    .codif_config_scalar(row$parent, ""),
    .codif_config_scalar(row$parent_col, ""),
    .codif_config_scalar(row$text_col, "")
  ))
  keys <- keys[nzchar(keys)]
  for (key in keys) {
    groups <- groups_map[[key]]
    if (is.list(groups) && length(groups) > 0L) return(groups)
  }
  list()
}

.codif_config_recoded_for_row <- function(row, recod_map) {
  keys <- unique(c(
    .codif_config_scalar(row$parent, ""),
    .codif_config_scalar(row$parent_col, ""),
    .codif_config_scalar(row$text_col, "")
  ))
  keys <- keys[nzchar(keys)]
  for (key in keys) {
    rec <- recod_map[[key]]
    if (!is.null(rec)) return(rec)
  }
  list()
}

.codif_config_has_effective_config <- function(exported) {
  cfg <- (exported %||% list())$configuration %||% list()
  length((exported %||% list())$categories %||% list()) > 0L ||
    length((exported %||% list())$rules %||% list()) > 0L ||
    length((exported %||% list())$recodes %||% list()) > 0L ||
    length(cfg$grupos %||% list()) > 0L
}

.codif_config_row_exportable <- function(row, groups, marked) {
  length(groups %||% list()) > 0L
}

.codif_config_exported_key <- function(exported) {
  paste(.codif_config_norm(exported$base_id), .codif_config_norm(exported$name), sep = "::")
}

.codif_config_adopted_text_keys <- function(variables) {
  out <- character()
  for (exported in variables %||% list()) {
    if (!.codif_config_has_effective_config(exported)) next
    row <- ((exported %||% list())$configuration %||% list())$familias_row %||% list()
    tipo <- .codif_config_scalar(row$tipo, .codif_config_scalar(exported$type, ""))
    text_col <- .codif_config_scalar(row$text_col, "")
    if (!tipo %in% c("select_one", "select_multiple") || !nzchar(text_col)) next
    out <- c(out, paste(.codif_config_norm(exported$base_id), .codif_config_norm(text_col), sep = "::"))
  }
  unique(out[nzchar(out)])
}

.codif_config_is_adopted_text_duplicate <- function(exported, adopted_keys) {
  if (!length(adopted_keys)) return(FALSE)
  row <- ((exported %||% list())$configuration %||% list())$familias_row %||% list()
  tipo <- .codif_config_scalar(row$tipo, .codif_config_scalar(exported$type, ""))
  identical(tipo, "text") && .codif_config_exported_key(exported) %in% adopted_keys
}

.codif_config_merge_records_missing <- function(existing, incoming, key = "code") {
  existing <- existing %||% list()
  incoming <- incoming %||% list()
  existing_keys <- vapply(existing, function(x) .codif_config_scalar(x[[key]], ""), character(1))
  out <- existing
  for (item in incoming) {
    item_key <- .codif_config_scalar(item[[key]], "")
    if (!nzchar(item_key) || item_key %in% existing_keys) next
    out[[length(out) + 1L]] <- item
    existing_keys <- c(existing_keys, item_key)
  }
  out
}

.codif_config_merge_recoded_values <- function(existing, incoming) {
  vals <- unique(c(
    as.character(unlist(existing %||% list(), use.names = FALSE)),
    as.character(unlist(incoming %||% list(), use.names = FALSE))
  ))
  vals <- vals[!is.na(vals) & nzchar(vals)]
  as.list(vals)
}

.codif_config_absorb_duplicate_text <- function(parent, child) {
  if (is.null(parent$configuration) || !is.list(parent$configuration)) parent$configuration <- list()
  parent_cfg <- parent$configuration %||% list()
  child_cfg <- child$configuration %||% list()
  parent_groups <- parent_cfg$grupos %||% list()
  child_groups <- child_cfg$grupos %||% list()
  merged_groups <- .codif_config_merge_groups_missing(parent_groups, child_groups)

  parent$categories <- .codif_config_merge_records_missing(parent$categories, child$categories, "code")
  parent$rules <- .codif_config_merge_records_missing(parent$rules, child$rules, "code")
  parent$recodes <- .codif_config_merge_records_missing(parent$recodes, child$recodes, "code")
  parent$configuration$grupos <- merged_groups
  parent$configuration$respuestas_recod <- .codif_config_merge_recoded_values(
    parent_cfg$respuestas_recod,
    child_cfg$respuestas_recod
  )
  parent$configuration$marcada <- isTRUE(parent_cfg$marcada) || isTRUE(child_cfg$marcada)
  parent
}

.codif_config_normalize_variables <- function(variables) {
  variables <- variables %||% list()
  if (!length(variables)) {
    return(list(variables = list(), adopted_text_duplicates = list()))
  }

  keys <- vapply(variables, .codif_config_exported_key, character(1))
  drop <- rep(FALSE, length(variables))
  adopted <- list()

  for (i in seq_along(variables)) {
    exported <- variables[[i]]
    row <- ((exported %||% list())$configuration %||% list())$familias_row %||% list()
    tipo <- .codif_config_scalar(row$tipo, .codif_config_scalar(exported$type, ""))
    text_col <- .codif_config_scalar(row$text_col, "")
    if (!tipo %in% c("select_one", "select_multiple") || !nzchar(text_col)) next

    child_key <- paste(.codif_config_norm(exported$base_id), .codif_config_norm(text_col), sep = "::")
    child_idx <- which(keys == child_key)[1]
    if (is.na(child_idx) || child_idx == i) next
    child <- variables[[child_idx]]
    if (!.codif_config_is_adopted_text_duplicate(child, child_key)) next

    before_groups <- length(((variables[[i]]$configuration %||% list())$grupos %||% list()))
    child_groups <- length(((child$configuration %||% list())$grupos %||% list()))
    variables[[i]] <- .codif_config_absorb_duplicate_text(variables[[i]], child)
    after_groups <- length(((variables[[i]]$configuration %||% list())$grupos %||% list()))
    drop[[child_idx]] <- TRUE
    adopted[[length(adopted) + 1L]] <- list(
      base_id = .codif_config_scalar(exported$base_id, ""),
      parent = .codif_config_scalar(exported$name, ""),
      text_col = text_col,
      mode_so = .codif_config_scalar(row$modo_so, ""),
      child = .codif_config_scalar(child$name, ""),
      parent_groups_before = as.integer(before_groups),
      child_groups = as.integer(child_groups),
      parent_groups_after = as.integer(after_groups),
      action = if (after_groups > before_groups) "absorbed_child_groups" else "deduplicated_child"
    )
  }

  list(
    variables = variables[!drop],
    adopted_text_duplicates = adopted
  )
}

.codif_config_filter_adopted_text_duplicates <- function(variables) {
  .codif_config_normalize_variables(variables)$variables
}

.codif_config_sanitize_row <- function(row) {
  keep <- c(
    "use", "q_order", "tipo", "modo_so", "modo_so_explicit",
    "parent", "parent_label", "list_norm", "parent_col",
    "other_dummy_col", "text_col", "parent_col_cands",
    "other_dummy_cands", "text_col_cands", "dummy_cands"
  )
  out <- row[intersect(keep, names(row))]
  for (nm in names(out)) {
    if (is.null(out[[nm]])) next
    if (is.factor(out[[nm]])) out[[nm]] <- as.character(out[[nm]])
  }
  out
}

.codif_config_categories <- function(groups) {
  lapply(groups %||% list(), function(g) {
    list(
      code = .codif_config_scalar(g$codigo, ""),
      label = .codif_config_scalar(g$etiqueta, ""),
      description = .codif_config_scalar(g$description, ""),
      origin = .codif_config_scalar(g$origen, "")
    )
  })
}

.codif_config_rules <- function(groups) {
  out <- list()
  for (g in groups %||% list()) {
    if (is.null(g$regla)) next
    out[[length(out) + 1L]] <- list(
      code = .codif_config_scalar(g$codigo, ""),
      label = .codif_config_scalar(g$etiqueta, ""),
      rule = g$regla
    )
  }
  out
}

.codif_config_recodes <- function(groups) {
  out <- list()
  for (g in groups %||% list()) {
    vals <- as.character(unlist(g$respuestas %||% list(), use.names = FALSE))
    vals <- vals[!is.na(vals) & nzchar(vals)]
    if (!length(vals)) next
    out[[length(out) + 1L]] <- list(
      code = .codif_config_scalar(g$codigo, ""),
      label = .codif_config_scalar(g$etiqueta, ""),
      match_values = as.list(unique(vals))
    )
  }
  out
}

.codif_config_export_variable <- function(sid, source, row, state, inst) {
  parent <- .codif_config_scalar(row$parent, "")
  type <- .codif_config_scalar(row$tipo, "")
  if (!nzchar(type) && !is.null(inst)) type <- .codif_config_var_type_from_inst(inst, parent)
  label <- if (!is.null(inst)) {
    .codif_var_label(inst, parent, .codif_config_scalar(row$parent_label, parent))
  } else {
    .codif_config_scalar(row$parent_label, parent)
  }
  groups <- .codif_config_groups_for_row(row, state$grupos_recod %||% list())
  marked <- isTRUE((state$marcadas %||% list())[[parent]])
  options <- if (!is.null(inst)) .codif_config_options_for_var(inst, parent) else list()
  recodes <- .codif_config_recodes(groups)
  rules <- .codif_config_rules(groups)
  fingerprint <- .codif_config_variable_fingerprint(parent, label, type, source, options)
  list(
    id = paste(.codif_config_scalar(source, "default"), parent, sep = "::"),
    role = "open_ended",
    base_id = .codif_config_scalar(source, "default"),
    base_label = .codif_config_scalar(source, "Base única"),
    scope = "base",
    name = parent,
    label = label,
    type = type,
    list_norm = .codif_config_scalar(row$list_norm, ""),
    parent_col = .codif_config_scalar(row$parent_col, ""),
    text_col = .codif_config_scalar(row$text_col, ""),
    mode_so = .codif_config_scalar(row$modo_so, ""),
    fingerprint = fingerprint,
    options_fingerprint = .codif_config_hash(options),
    options = options,
    categories = .codif_config_categories(groups),
    rules = rules,
    recodes = recodes,
    bins = rules,
    configuration = list(
      familias_row = .codif_config_sanitize_row(row),
      grupos = groups,
      marcada = marked,
      respuestas_recod = .codif_config_recoded_for_row(row, state$respuestas_recod %||% list())
    )
  )
}

.codif_config_source_has_state <- function(sid, source) {
  st <- codif_snapshot(sid, source)
  length((st$familias_draft %||% list())$rows %||% list()) > 0L ||
    length(st$grupos_recod %||% list()) > 0L ||
    length(st$marcadas %||% list()) > 0L ||
    length(st$respuestas_recod %||% list()) > 0L
}

.codif_config_export_sources <- function(sid) {
  s <- session_get(sid)
  sources <- names(s$codif_por_base %||% list())
  sources <- sources[vapply(sources, function(src) .codif_config_source_has_state(sid, src), logical(1))]
  if (!length(sources)) sources <- .codif_config_scalar(codif_source_active(sid), "default")
  unique(sources)
}

codif_config_export <- function(sid) {
  sources <- .codif_config_export_sources(sid)
  variables <- list()
  for (source in sources) {
    state <- codif_snapshot(sid, source)
    rows <- (state$familias_draft %||% list())$rows %||% list()
    inst <- tryCatch(codif_inst_cached(sid, source), error = function(e) NULL)
    for (row in rows) {
      groups <- .codif_config_groups_for_row(row, state$grupos_recod %||% list())
      marked <- isTRUE((state$marcadas %||% list())[[.codif_config_scalar(row$parent, "")]])
      if (!.codif_config_row_exportable(row, groups, marked)) next
      variables[[length(variables) + 1L]] <- .codif_config_export_variable(sid, source, row, state, inst)
    }
  }
  normalized <- .codif_config_normalize_variables(variables)
  variables <- normalized$variables
  list(
    ok = TRUE,
    schema_version = CODIF_CONFIG_SCHEMA_VERSION,
    exported_at = .codif_config_now(),
    app_version = .codif_config_app_version(),
    project_label = .codif_config_project_label(sid),
    mode = .codif_config_mode(sid),
    processing_mode = .codif_config_processing_mode(sid),
    suggested_filename = .codif_config_filename(sid),
    variables = variables,
    metadata = list(
      source = "prosecnur",
      notes = "",
      exported_bases = as.list(sources),
      normalization = list(
        adopted_text_duplicates = normalized$adopted_text_duplicates
      ),
      contains_case_rows = FALSE,
      contains_response_match_values = TRUE
    )
  )
}

.codif_config_validate_bundle <- function(bundle) {
  schema <- .codif_config_scalar(bundle$schema_version, "")
  if (!identical(schema, CODIF_CONFIG_SCHEMA_VERSION)) {
    stop_api(400, "E_CODIF_CONFIG_SCHEMA",
             sprintf("Schema inválido: '%s'. Se espera '%s'.", schema, CODIF_CONFIG_SCHEMA_VERSION))
  }
  vars <- bundle$variables
  if (is.null(vars) || !is.list(vars)) {
    stop_api(400, "E_CODIF_CONFIG_VARIABLES", "El JSON debe incluir 'variables' como lista.")
  }
  invisible(TRUE)
}

.codif_config_inventory_for_source <- function(sid, source) {
  inst <- tryCatch(codif_inst_cached(sid, source), error = function(e) NULL)
  if (is.null(inst)) return(list())
  survey <- inst$survey %||% inst$survey_raw
  if (is.null(survey) || !is.data.frame(survey) || !"name" %in% names(survey)) return(list())
  out <- list()
  for (i in seq_len(nrow(survey))) {
    name <- .codif_config_scalar(survey$name[[i]], "")
    if (!nzchar(name)) next
    type <- .codif_config_scalar(survey$type[[i]], "")
    type_head <- sub("\\s+.*$", "", type)
    if (type_head %in% c("begin_group", "end_group", "begin_repeat", "end_repeat", "note", "calculate")) next
    label <- .codif_var_label(inst, name, name)
    options <- .codif_config_options_for_var(inst, name)
    out[[name]] <- list(
      base_id = source,
      name = name,
      label = label,
      type = type_head,
      options = options,
      fingerprint = .codif_config_variable_fingerprint(name, label, type_head, source, options)
    )
  }
  out
}

.codif_config_target_var_has_state <- function(sid, source, var_name) {
  st <- codif_snapshot(sid, source)
  groups <- st$grupos_recod %||% list()
  has_groups <- !is.null(groups[[var_name]]) && length(groups[[var_name]]) > 0L
  recod <- st$respuestas_recod %||% list()
  has_recod <- !is.null(recod[[var_name]]) && length(recod[[var_name]]) > 0L
  marked <- isTRUE((st$marcadas %||% list())[[var_name]])
  isTRUE(has_groups || has_recod || marked)
}

.codif_config_existing_groups_for_target <- function(sid, source, var_name) {
  st <- codif_snapshot(sid, source)
  groups <- (st$grupos_recod %||% list())[[var_name]] %||% list()
  if (length(groups)) return(groups)
  rows <- (st$familias_draft %||% list())$rows %||% list()
  for (row in rows) {
    if (var_name %in% c(
      .codif_config_scalar(row$parent, ""),
      .codif_config_scalar(row$parent_col, ""),
      .codif_config_scalar(row$text_col, "")
    )) {
      return(.codif_config_groups_for_row(row, st$grupos_recod %||% list()))
    }
  }
  list()
}

.codif_config_count_changes <- function(exported, existing_groups) {
  cats <- exported$categories %||% list()
  existing_codes <- vapply(existing_groups %||% list(), function(g) .codif_config_scalar(g$codigo, ""), character(1))
  existing_labels <- stats::setNames(
    vapply(existing_groups %||% list(), function(g) .codif_config_norm(g$etiqueta), character(1)),
    existing_codes
  )
  new_count <- 0L
  overwrite_count <- 0L
  for (cat in cats) {
    code <- .codif_config_scalar(cat$code, "")
    label_norm <- .codif_config_norm(cat$label)
    if (!nzchar(code) || !code %in% existing_codes) {
      new_count <- new_count + 1L
    } else if (!identical(existing_labels[[code]] %||% "", label_norm)) {
      overwrite_count <- overwrite_count + 1L
    }
  }
  list(
    categories_new = as.integer(new_count),
    categories_overwrite = as.integer(overwrite_count),
    rules_add = as.integer(length(exported$rules %||% list())),
    recodes_add = as.integer(length(exported$recodes %||% list()))
  )
}

.codif_config_name_similar <- function(a, b) {
  an <- .codif_config_norm(a)
  bn <- .codif_config_norm(b)
  if (!nzchar(an) || !nzchar(bn)) return(FALSE)
  if (grepl(an, bn, fixed = TRUE) || grepl(bn, an, fixed = TRUE)) return(TRUE)
  tryCatch(utils::adist(an, bn)[1] <= max(2, floor(max(nchar(an), nchar(bn)) * 0.25)), error = function(e) FALSE)
}

.codif_config_score_candidate <- function(exported, candidate, same_base) {
  exp_name <- .codif_config_scalar(exported$name, "")
  exp_label <- .codif_config_scalar(exported$label, "")
  exp_type <- .codif_config_norm(exported$type)
  cand_type <- .codif_config_norm(candidate$type)
  type_ok <- nzchar(exp_type) && identical(exp_type, cand_type)
  opt_score <- .codif_config_options_similarity(exported$options %||% list(), candidate$options %||% list())
  name_exact <- identical(.codif_config_norm(exp_name), .codif_config_norm(candidate$name))
  label_exact <- nzchar(.codif_config_norm(exp_label)) && identical(.codif_config_norm(exp_label), .codif_config_norm(candidate$label))
  name_similar <- .codif_config_name_similar(exp_name, candidate$name)
  label_similar <- .codif_config_name_similar(exp_label, candidate$label)
  confidence <- "none"
  if (type_ok && name_exact && isTRUE(same_base) && opt_score >= 0.85) {
    confidence <- "strong"
  } else if (type_ok && name_exact && opt_score >= 0.75) {
    confidence <- "strong"
  } else if (type_ok && (name_exact || label_exact) && opt_score >= 0.6) {
    confidence <- "medium"
  } else if (type_ok && (name_similar || label_similar)) {
    confidence <- "weak"
  }
  list(
    confidence = confidence,
    score = switch(confidence, strong = 100L, medium = 70L, weak = 40L, none = 0L),
    options_similarity = opt_score,
    type_compatible = type_ok
  )
}

.codif_config_candidate_target_bases <- function(bundle, exported, target_bases) {
  source_mode <- .codif_config_scalar(bundle$mode, "unibase")
  source_base <- .codif_config_norm(exported$base_id)
  norms <- vapply(target_bases, .codif_config_norm, character(1))
  same <- target_bases[norms == source_base]
  if (!identical(source_mode, "multibase")) return(target_bases)
  if (length(same)) return(same)

  aliases <- target_bases[vapply(target_bases, function(target_base) {
    .codif_config_base_matches(source_base, target_base, allow_alias = TRUE)
  }, logical(1))]
  if (length(aliases) == 1L) aliases else target_bases
}

.codif_config_base_matches <- function(source_base, target_base, allow_alias = FALSE) {
  source_norm <- .codif_config_norm(source_base)
  target_norm <- .codif_config_norm(target_base)
  if (!nzchar(source_norm) || !nzchar(target_norm)) return(FALSE)
  if (identical(source_norm, target_norm)) return(TRUE)
  if (!isTRUE(allow_alias) || nchar(source_norm) < 3L) return(FALSE)
  if (endsWith(target_norm, paste0("_", source_norm))) return(TRUE)
  source_tokens <- strsplit(source_norm, "_", fixed = TRUE)[[1]]
  target_tokens <- strsplit(target_norm, "_", fixed = TRUE)[[1]]
  all(source_tokens %in% target_tokens)
}

.codif_config_best_match_for_base <- function(sid, bundle, exported, target_base, inventory = NULL) {
  inv <- inventory %||% .codif_config_inventory_for_source(sid, target_base)
  if (!length(inv)) return(NULL)
  same_base <- .codif_config_base_matches(exported$base_id, target_base, allow_alias = TRUE)
  scored <- lapply(inv, function(candidate) {
    score <- .codif_config_score_candidate(exported, candidate, same_base)
    c(candidate, score)
  })
  scored <- scored[vapply(scored, function(x) x$score > 0L, logical(1))]
  if (!length(scored)) return(NULL)
  scores <- vapply(scored, function(x) as.integer(x$score), integer(1))
  scored[[which.max(scores)]]
}

.codif_config_match_item <- function(sid, bundle, exported, target_base, inventory = NULL) {
  match <- .codif_config_best_match_for_base(sid, bundle, exported, target_base, inventory = inventory)
  match_id <- paste(.codif_config_scalar(exported$id, paste(exported$base_id, exported$name, sep = "::")),
                    target_base, sep = "=>")
  if (is.null(match)) {
    return(list(
      match_id = match_id,
      source = list(
        id = .codif_config_scalar(exported$id, ""),
        base_id = .codif_config_scalar(exported$base_id, ""),
        name = .codif_config_scalar(exported$name, ""),
        label = .codif_config_scalar(exported$label, ""),
        type = .codif_config_scalar(exported$type, ""),
        mode_so = .codif_config_scalar(exported$mode_so, ""),
        text_col = .codif_config_scalar(exported$text_col, "")
      ),
      target = list(base_id = target_base, name = "", label = "", type = ""),
      status = "missing",
      confidence = "none",
      existing_state = FALSE,
      reason = "No se encontró una variable compatible en esta base.",
      changes = .codif_config_count_changes(exported, list()),
      default_strategy = "keep",
      can_apply = FALSE
    ))
  }
  existing <- .codif_config_target_var_has_state(sid, target_base, match$name)
  status <- if (identical(match$confidence, "strong") && !existing) {
    "compatible"
  } else if (identical(match$confidence, "strong") && existing) {
    "conflict"
  } else {
    "needs_confirmation"
  }
  existing_groups <- .codif_config_existing_groups_for_target(sid, target_base, match$name)
  list(
    match_id = match_id,
    source = list(
      id = .codif_config_scalar(exported$id, ""),
      base_id = .codif_config_scalar(exported$base_id, ""),
      name = .codif_config_scalar(exported$name, ""),
      label = .codif_config_scalar(exported$label, ""),
      type = .codif_config_scalar(exported$type, ""),
      mode_so = .codif_config_scalar(exported$mode_so, ""),
      text_col = .codif_config_scalar(exported$text_col, "")
    ),
    target = list(
      base_id = target_base,
      name = .codif_config_scalar(match$name, ""),
      label = .codif_config_scalar(match$label, ""),
      type = .codif_config_scalar(match$type, ""),
      fingerprint = .codif_config_scalar(match$fingerprint, "")
    ),
    status = status,
    confidence = match$confidence,
    existing_state = existing,
    reason = switch(status,
      compatible = "Match fuerte por nombre/tipo/opciones.",
      conflict = "La variable destino ya tiene codificación.",
      needs_confirmation = "La variable parece compatible, pero requiere confirmación.",
      ""
    ),
    changes = .codif_config_count_changes(exported, existing_groups),
    default_strategy = if (existing) "keep" else "replace",
    can_apply = !identical(status, "missing")
  )
}

.codif_config_preview_items <- function(sid, bundle) {
  target_bases <- .codif_config_base_names(sid)
  inventories <- stats::setNames(vector("list", length(target_bases)), target_bases)
  inventory_loaded <- stats::setNames(rep(FALSE, length(target_bases)), target_bases)
  out <- list()
  variables <- .codif_config_filter_adopted_text_duplicates(bundle$variables %||% list())
  for (exported in variables) {
    if (!.codif_config_has_effective_config(exported)) next
    bases <- .codif_config_candidate_target_bases(bundle, exported, target_bases)
    for (target_base in bases) {
      if (!isTRUE(inventory_loaded[[target_base]])) {
        inventories[[target_base]] <- .codif_config_inventory_for_source(sid, target_base)
        inventory_loaded[[target_base]] <- TRUE
      }
      out[[length(out) + 1L]] <- .codif_config_match_item(
        sid, bundle, exported, target_base, inventory = inventories[[target_base]]
      )
    }
  }
  out
}

.codif_config_preview_summary <- function(items) {
  status <- vapply(items %||% list(), function(x) .codif_config_scalar(x$status, ""), character(1))
  names_vec <- vapply(items %||% list(), function(x) {
    target <- .codif_config_scalar(x$target$name, "")
    if (!nzchar(target)) .codif_config_scalar(x$source$name, "") else target
  }, character(1))
  list(
    compatible = as.list(names_vec[status == "compatible"]),
    needs_confirmation = as.list(names_vec[status == "needs_confirmation"]),
    missing = as.list(names_vec[status == "missing"]),
    conflicts = as.list(names_vec[status == "conflict"]),
    n_compatible = as.integer(sum(status == "compatible")),
    n_needs_confirmation = as.integer(sum(status == "needs_confirmation")),
    n_missing = as.integer(sum(status == "missing")),
    n_conflicts = as.integer(sum(status == "conflict"))
  )
}

codif_config_preview_import <- function(sid, bundle, file_name = "") {
  .codif_config_validate_bundle(bundle)
  normalized <- .codif_config_normalize_variables(bundle$variables %||% list())
  effective_normalized <- normalized$variables[
    vapply(normalized$variables %||% list(), .codif_config_has_effective_config, logical(1))
  ]
  items <- .codif_config_preview_items(sid, bundle)
  list(
    ok = TRUE,
    schema_version = .codif_config_scalar(bundle$schema_version, ""),
    file_name = .codif_config_scalar(file_name, ""),
    source = list(
      project_label = .codif_config_scalar(bundle$project_label, ""),
      exported_at = .codif_config_scalar(bundle$exported_at, ""),
      mode = .codif_config_scalar(bundle$mode, ""),
      variables = as.integer(length(bundle$variables %||% list())),
      variables_after_normalization = as.integer(length(normalized$variables %||% list())),
      variables_effective_after_normalization = as.integer(length(effective_normalized %||% list())),
      normalization = list(
        adopted_text_duplicates = normalized$adopted_text_duplicates
      )
    ),
    target = list(
      project_label = .codif_config_project_label(sid),
      mode = .codif_config_mode(sid),
      bases = as.list(.codif_config_base_names(sid))
    ),
    items = items,
    summary = .codif_config_preview_summary(items),
    requires_confirmation = TRUE
  )
}

.codif_config_find_exported <- function(bundle, source_id) {
  for (v in bundle$variables %||% list()) {
    if (identical(.codif_config_scalar(v$id, ""), source_id)) return(v)
  }
  NULL
}

.codif_config_find_preview_item <- function(items, match_id) {
  for (item in items %||% list()) {
    if (identical(.codif_config_scalar(item$match_id, ""), match_id)) return(item)
  }
  NULL
}

.codif_config_map_row_to_target <- function(row, exported_name, target_name, target_label = "") {
  out <- row
  if (is.null(out) || !is.list(out)) out <- list()
  old <- .codif_config_scalar(exported_name, "")
  new <- .codif_config_scalar(target_name, old)
  replace_if_equal <- function(x) {
    val <- .codif_config_scalar(x, "")
    if (identical(val, old)) new else val
  }
  out$parent <- new
  out$parent_col <- replace_if_equal(out$parent_col)
  out$text_col <- replace_if_equal(out$text_col)
  if (nzchar(target_label)) out$parent_label <- target_label
  out$use <- TRUE
  out
}

.codif_config_merge_groups_missing <- function(existing, incoming) {
  existing <- existing %||% list()
  incoming <- incoming %||% list()
  existing_codes <- vapply(existing, function(g) .codif_config_scalar(g$codigo, ""), character(1))
  out <- existing
  for (g in incoming) {
    code <- .codif_config_scalar(g$codigo, "")
    if (!nzchar(code) || code %in% existing_codes) next
    out[[length(out) + 1L]] <- g
    existing_codes <- c(existing_codes, code)
  }
  out
}

.codif_config_upsert_row <- function(sid, source, row) {
  draft <- codif_get(sid, "familias_draft", source = source) %||% list(rows = list(), source = "import")
  rows <- draft$rows %||% list()
  parent <- .codif_config_scalar(row$parent, "")
  hit <- FALSE
  for (i in seq_along(rows)) {
    if (.codif_config_scalar(rows[[i]]$parent, "") == parent) {
      rows[[i]] <- row
      hit <- TRUE
      break
    }
  }
  if (!hit) rows[[length(rows) + 1L]] <- row
  draft$rows <- rows
  draft$source <- "import"
  draft$updated_at <- .codif_config_now()
  codif_set(sid, "familias_draft", draft, source = source)
}

.codif_config_store_version <- function(sid, source, target_name, exported, selection) {
  versions <- codif_get(sid, "config_versions", source = source) %||% list()
  key <- paste0(target_name, "::", format(Sys.time(), "%Y%m%d%H%M%S"))
  versions[[key]] <- list(
    stored_at = .codif_config_now(),
    target_name = target_name,
    source_id = .codif_config_scalar(exported$id, ""),
    note = .codif_config_scalar(selection$note, ""),
    configuration = exported$configuration
  )
  codif_set(sid, "config_versions", versions, source = source)
}

.codif_config_apply_one <- function(sid, exported, item, selection) {
  strategy <- .codif_config_scalar(selection$strategy, item$default_strategy %||% "replace")
  target_base <- .codif_config_scalar(item$target$base_id, "")
  target_name <- .codif_config_scalar(item$target$name, "")
  target_label <- .codif_config_scalar(item$target$label, "")
  if (!nzchar(target_base) || !nzchar(target_name)) return("skipped")
  if (identical(strategy, "keep")) return("skipped")
  if (identical(strategy, "duplicate")) {
    .codif_config_store_version(sid, target_base, target_name, exported, selection)
    return("versioned")
  }

  cfg <- exported$configuration %||% list()
  row <- .codif_config_map_row_to_target(
    cfg$familias_row %||% list(),
    .codif_config_scalar(exported$name, ""),
    target_name,
    target_label
  )
  incoming_groups <- cfg$grupos %||% list()
  existing_groups <- .codif_config_existing_groups_for_target(sid, target_base, target_name)
  final_groups <- if (identical(strategy, "merge_missing")) {
    .codif_config_merge_groups_missing(existing_groups, incoming_groups)
  } else {
    incoming_groups
  }

  .codif_config_upsert_row(sid, target_base, row)
  groups_map <- codif_get(sid, "grupos_recod", source = target_base) %||% list()
  groups_map[[target_name]] <- final_groups
  codif_set(sid, "grupos_recod", groups_map, source = target_base)

  recod <- codif_get(sid, "respuestas_recod", source = target_base) %||% list()
  recoded_values <- cfg$respuestas_recod %||% NULL
  if (is.null(recoded_values)) {
    vals <- unique(unlist(lapply(final_groups, function(g) g$respuestas %||% list()), use.names = FALSE))
    vals <- as.character(vals[!is.na(vals) & nzchar(vals)])
    recoded_values <- as.list(vals)
  }
  recod[[target_name]] <- recoded_values
  codif_set(sid, "respuestas_recod", recod, source = target_base)

  marcadas <- codif_get(sid, "marcadas", source = target_base) %||% list()
  if (isTRUE(cfg$marcada) || length(final_groups) > 0L || isTRUE(row$use)) marcadas[[target_name]] <- TRUE
  codif_set(sid, "marcadas", marcadas, source = target_base)
  "imported"
}

.codif_config_audit_add <- function(sid, entry) {
  s <- session_get(sid)
  history <- s$codif_config_import_audit %||% list()
  history <- c(list(entry), history)
  if (length(history) > 50L) history <- history[seq_len(50L)]
  s$codif_config_import_audit <- history
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(history)
}

codif_config_apply_import <- function(sid, bundle, selections = list(), file_name = "") {
  preview <- codif_config_preview_import(sid, bundle, file_name)
  if (is.null(selections) || !is.list(selections) || !length(selections)) {
    stop_api(400, "E_CODIF_CONFIG_NO_SELECTION", "Selecciona al menos una variable compatible para importar.")
  }
  imported <- list()
  skipped <- list()
  versioned <- list()
  conflicts <- 0L
  for (sel in selections) {
    match_id <- .codif_config_scalar(sel$match_id, "")
    item <- .codif_config_find_preview_item(preview$items, match_id)
    if (is.null(item) || identical(.codif_config_scalar(item$status, ""), "missing")) {
      skipped[[length(skipped) + 1L]] <- match_id
      next
    }
    exported <- .codif_config_find_exported(bundle, .codif_config_scalar(item$source$id, ""))
    if (is.null(exported)) {
      skipped[[length(skipped) + 1L]] <- match_id
      next
    }
    if (isTRUE(item$existing_state)) conflicts <- conflicts + 1L
    result <- .codif_config_apply_one(sid, exported, item, sel)
    if (identical(result, "imported")) imported[[length(imported) + 1L]] <- item
    else if (identical(result, "versioned")) versioned[[length(versioned) + 1L]] <- item
    else skipped[[length(skipped) + 1L]] <- match_id
  }
  audit <- list(
    event = "coding_config_import",
    imported_at = .codif_config_now(),
    file_name = .codif_config_scalar(file_name, ""),
    schema_version = .codif_config_scalar(bundle$schema_version, ""),
    variables_imported = as.integer(length(imported)),
    variables_versioned = as.integer(length(versioned)),
    variables_skipped = as.integer(length(skipped)),
    conflicts = as.integer(conflicts)
  )
  .codif_config_audit_add(sid, audit)
  list(
    ok = TRUE,
    imported = imported,
    versioned = versioned,
    skipped = skipped,
    audit = audit,
    summary = list(
      variables_imported = as.integer(length(imported)),
      variables_versioned = as.integer(length(versioned)),
      variables_skipped = as.integer(length(skipped)),
      conflicts = as.integer(conflicts)
    )
  )
}
