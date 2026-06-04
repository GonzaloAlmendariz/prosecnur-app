# Helpers de validación para bases integradas multibase.

.validacion_mb_scalar <- function(x, fallback = "") {
  if (is.null(x) || length(x) == 0L) return(fallback)
  x <- as.character(x)[1]
  if (is.na(x)) fallback else x
}

.validacion_mb_base_meta <- function(sid, base_name = NULL) {
  s <- session_get(sid, required = FALSE)
  bases <- (s$estudio %||% list())$bases %||% list()
  if (!length(bases)) return(NULL)
  if (!is.null(base_name) && nzchar(as.character(base_name)) && !is.null(bases[[base_name]])) {
    return(bases[[base_name]])
  }
  hits <- Filter(function(b) !is.null((b %||% list())$multi_integrated), bases)
  if (length(hits)) return(hits[[1]])
  NULL
}

.validacion_mb_chr_vec <- function(x) {
  if (is.null(x)) return(character(0))
  vals <- trimws(as.character(unlist(x, use.names = FALSE)))
  vals[!is.na(vals) & nzchar(vals)]
}

.validacion_mb_collection_exclusions <- function(base_meta = NULL) {
  rf <- (base_meta %||% list())$response_filter %||% NULL
  if (is.null(rf) || !is.list(rf)) return(list())
  sources <- rf$sources %||% list(rf)
  if (!length(sources)) return(list())

  out <- list()
  for (source in sources) {
    if (!is.list(source)) next
    vars <- .validacion_mb_chr_vec(source$excluded_validation_vars %||%
                                     source$excluded_vars %||%
                                     source$validation_excluded_vars)
    if (!length(vars)) next
    profile <- .validacion_mb_scalar(source$validation_exclusion_profile %||% source$profile, "")
    if (!nzchar(profile)) profile <- "exclusion"
    out[[length(out) + 1L]] <- list(
      survey_id = .validacion_mb_scalar(source$survey_id, ""),
      collector_ids = as.list(.validacion_mb_chr_vec(source$collector_ids %||% source$collector_id)),
      source_title = .validacion_mb_scalar(source$source_title, ""),
      source_alias = .validacion_mb_scalar(source$source_alias, ""),
      collection_strategy = .validacion_mb_scalar(source$collection_strategy, ""),
      validation_exclusion_profile = profile,
      excluded_validation_vars = as.list(unique(vars))
    )
  }
  out
}

.validacion_mb_collection_exclusions_for_base <- function(sid, base_name = NULL) {
  .validacion_mb_collection_exclusions(.validacion_mb_base_meta(sid, base_name))
}

.validacion_mb_variants <- function(base_meta) {
  mi <- (base_meta %||% list())$multi_integrated %||% NULL
  if (is.null(mi)) return(data.frame())
  key_name <- .validacion_mb_scalar(mi$origin_key_name, "")
  variant_map <- mi$variant_map %||% list()
  if (!nzchar(key_name) || !length(variant_map)) return(data.frame())

  rows <- lapply(variant_map, function(item) {
    to <- .validacion_mb_scalar(item$to, "")
    key <- .validacion_mb_scalar(item$origin_key, "")
    if (!nzchar(to) || !nzchar(key)) return(NULL)
    data.frame(
      key_name = key_name,
      key_value = key,
      target = to,
      stringsAsFactors = FALSE
    )
  })
  rows <- Filter(Negate(is.null), rows)
  if (!length(rows)) return(data.frame())
  unique(do.call(rbind, rows))
}

.validacion_mb_variant_for_var <- function(var, variants) {
  if (!is.data.frame(variants) || !nrow(variants)) return(NULL)
  var <- .validacion_mb_scalar(var, "")
  if (!nzchar(var)) return(NULL)
  hits <- which(vapply(variants$target, function(target) {
    identical(var, target) || startsWith(var, paste0(target, "_"))
  }, logical(1)))
  if (!length(hits)) return(NULL)
  variants[hits[1L], , drop = FALSE]
}

.validacion_mb_odk_value <- function(value) {
  value <- .validacion_mb_scalar(value, "")
  if (!grepl("'", value, fixed = TRUE)) return(paste0("'", value, "'"))
  if (!grepl('"', value, fixed = TRUE)) return(paste0('"', value, '"'))
  paste0("'", gsub("'", "’", value, fixed = TRUE), "'")
}

.validacion_mb_origin_relevant <- function(key_name, key_value) {
  paste0("${", key_name, "} = ", .validacion_mb_odk_value(key_value))
}

.validacion_mb_combine_relevant <- function(existing, condition) {
  existing <- .validacion_mb_scalar(existing, "")
  condition <- .validacion_mb_scalar(condition, "")
  if (!nzchar(condition)) return(if (nzchar(existing)) existing else NA_character_)
  if (!nzchar(existing)) return(condition)
  norm <- function(x) gsub("\\s+", "", tolower(as.character(x %||% "")))
  if (grepl(norm(condition), norm(existing), fixed = TRUE)) return(existing)
  paste0("(", existing, ") and (", condition, ")")
}

.validacion_patch_integrated_variant_relevants <- function(survey, base_meta = NULL) {
  variants <- .validacion_mb_variants(base_meta)
  if (!is.data.frame(survey) || !nrow(survey) || !nrow(variants) || !"name" %in% names(survey)) {
    return(survey)
  }
  survey <- as.data.frame(survey, stringsAsFactors = FALSE, check.names = FALSE)
  if (!"relevant" %in% names(survey)) survey$relevant <- NA_character_
  names_raw <- as.character(survey$name %||% "")

  for (i in seq_len(nrow(variants))) {
    target <- .validacion_mb_scalar(variants$target[i], "")
    if (!nzchar(target)) next
    idx <- which(names_raw == target | startsWith(names_raw, paste0(target, "_")))
    if (!length(idx)) next
    condition <- .validacion_mb_origin_relevant(variants$key_name[i], variants$key_value[i])
    survey$relevant[idx] <- vapply(
      survey$relevant[idx],
      .validacion_mb_combine_relevant,
      character(1),
      condition = condition
    )
  }
  survey
}

.validacion_patch_integrated_instrument <- function(inst, base_meta = NULL) {
  if (is.null(inst) || is.null((base_meta %||% list())$multi_integrated)) return(inst)
  if (!is.null(inst$survey) && is.data.frame(inst$survey)) {
    inst$survey <- .validacion_patch_integrated_variant_relevants(inst$survey, base_meta)
  }
  inst
}

.validacion_mb_ast_has_origin_gate <- function(gate, key_name, key_value) {
  if (is.null(gate) || !is_ast(gate)) return(FALSE)
  found <- FALSE
  ast_walk(gate, function(node, path) {
    if (found) return(NULL)
    if (!identical(ast_op(node), "compare_const")) return(NULL)
    if (!identical(.validacion_mb_scalar(node$var, ""), .validacion_mb_scalar(key_name, ""))) return(NULL)
    if (!identical(.validacion_mb_scalar(node$op, ""), "==")) return(NULL)
    if (identical(.validacion_mb_scalar(node$value, ""), .validacion_mb_scalar(key_value, ""))) {
      found <<- TRUE
    }
    NULL
  })
  found
}

.validacion_mb_rule_targets <- function(rule) {
  roles <- rule$variable_roles %||% list()
  unique(as.character(c(
    rule$primary_var %||% character(0),
    roles$target %||% character(0)
  )))
}

.validacion_mb_patch_rule <- function(rule, variants) {
  targets <- .validacion_mb_rule_targets(rule)
  targets <- targets[!is.na(targets) & nzchar(targets)]
  if (!length(targets)) return(rule)

  matches <- Filter(Negate(is.null), lapply(targets, .validacion_mb_variant_for_var, variants = variants))
  if (!length(matches)) return(rule)
  spec <- matches[[1L]]
  key_name <- .validacion_mb_scalar(spec$key_name, "")
  key_value <- .validacion_mb_scalar(spec$key_value, "")
  if (!nzchar(key_name) || !nzchar(key_value)) return(rule)
  if (.validacion_mb_ast_has_origin_gate(rule$gate, key_name, key_value)) return(rule)

  origin_gate <- ast_compare_const(key_name, "==", key_value)
  rule$gate <- if (is.null(rule$gate)) origin_gate else ast_normalize(ast_and(rule$gate, origin_gate))
  rule$gate_hash <- ast_hash(rule$gate)
  gate_vars <- ast_variables(origin_gate)
  rule$variables <- unique(c(rule$variables %||% character(0), gate_vars))
  rule$variable_roles <- rule$variable_roles %||% list()
  rule$variable_roles$gate <- unique(c(rule$variable_roles$gate %||% character(0), gate_vars))
  rule$variable_roles$drivers <- unique(c(rule$variable_roles$drivers %||% character(0), gate_vars))
  rule$variable_roles$all <- unique(c(
    rule$variable_roles$target %||% character(0),
    rule$variable_roles$drivers %||% character(0),
    rule$variable_roles$compare %||% character(0),
    rule$variable_roles$gate %||% character(0),
    rule$variables %||% character(0)
  ))
  rule
}

.validacion_patch_integrated_bundle <- function(bundle, base_meta = NULL) {
  if (is.null(bundle) || is.null((base_meta %||% list())$multi_integrated)) return(bundle)
  variants <- .validacion_mb_variants(base_meta)
  if (!nrow(variants) || !length(bundle$rules %||% list())) return(bundle)
  bundle$rules <- lapply(bundle$rules, .validacion_mb_patch_rule, variants = variants)
  bundle$plan <- compile_rules_to_plan(bundle$rules)
  bundle
}
