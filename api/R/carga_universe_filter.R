# =============================================================================
# Carga — filtro manual de universo por base
# =============================================================================

.cuf_default_config <- function() {
  list(
    version = 1L,
    enabled = FALSE,
    variable = "",
    real_values = character(0),
    test_values = character(0),
    corrections = list(),
    exclusion_rules = list(),
    missing_policy = "exclude",
    unassigned_policy = "unclassified"
  )
}

.cuf_chr <- function(x) {
  out <- trimws(as.character(unlist(x %||% list(), recursive = TRUE, use.names = FALSE)))
  unique(out[!is.na(out) & nzchar(out)])
}

.cuf_scalar <- function(x, default = "") {
  out <- as.character(x %||% default)[1]
  if (is.na(out)) default else trimws(out)
}

.cuf_rule_entries <- function(x, field, rule_fields) {
  if (is.null(x) || !length(x)) return(list())
  if (!is.list(x)) {
    stop_api(400, "E_UNIVERSE_FILTER_RULES_INVALID",
             sprintf("%s debe ser una lista de reglas.", field))
  }
  if (length(intersect(names(x) %||% character(), rule_fields))) {
    return(list(x))
  }
  if (!all(vapply(x, is.list, logical(1)))) {
    stop_api(400, "E_UNIVERSE_FILTER_RULES_INVALID",
             sprintf("Cada elemento de %s debe ser un objeto.", field))
  }
  unname(x)
}

.cuf_normalize_corrections <- function(x) {
  entries <- .cuf_rule_entries(
    x, "corrections",
    c("id", "key_variable", "key_value", "key_values", "variable",
      "from_values", "to_value", "reason")
  )
  out <- lapply(seq_along(entries), function(i) {
    rule <- entries[[i]]
    normalized <- list(
      id = .cuf_scalar(rule$id, sprintf("correction_%d", i)),
      key_variable = .cuf_scalar(rule$key_variable),
      key_values = .cuf_chr(rule$key_values %||% rule$key_value),
      variable = .cuf_scalar(rule$variable),
      from_values = .cuf_chr(rule$from_values),
      to_value = .cuf_scalar(rule$to_value),
      reason = .cuf_scalar(rule$reason)
    )
    if (!nzchar(normalized$key_variable) || !length(normalized$key_values) ||
        !nzchar(normalized$variable) || !length(normalized$from_values) ||
        !nzchar(normalized$to_value)) {
      stop_api(
        400, "E_UNIVERSE_FILTER_CORRECTION_INCOMPLETE",
        sprintf(paste0(
          "La correccion '%s' requiere key_variable, key_values, variable, ",
          "from_values y to_value."
        ), normalized$id)
      )
    }
    normalized
  })
  ids <- vapply(out, `[[`, character(1), "id")
  if (anyDuplicated(ids)) {
    stop_api(400, "E_UNIVERSE_FILTER_RULE_ID_DUPLICATED",
             "Los identificadores de corrections deben ser unicos.")
  }
  out
}

.cuf_normalize_exclusion_rules <- function(x) {
  entries <- .cuf_rule_entries(
    x, "exclusion_rules", c("id", "variable", "values", "reason")
  )
  out <- lapply(seq_along(entries), function(i) {
    rule <- entries[[i]]
    normalized <- list(
      id = .cuf_scalar(rule$id, sprintf("exclusion_%d", i)),
      variable = .cuf_scalar(rule$variable),
      values = .cuf_chr(rule$values),
      reason = .cuf_scalar(rule$reason)
    )
    if (!nzchar(normalized$variable) || !length(normalized$values)) {
      stop_api(
        400, "E_UNIVERSE_FILTER_EXCLUSION_INCOMPLETE",
        sprintf("La exclusion '%s' requiere variable y values.", normalized$id)
      )
    }
    normalized
  })
  ids <- vapply(out, `[[`, character(1), "id")
  if (anyDuplicated(ids)) {
    stop_api(400, "E_UNIVERSE_FILTER_RULE_ID_DUPLICATED",
             "Los identificadores de exclusion_rules deben ser unicos.")
  }
  out
}

normalize_carga_universe_filter <- function(config = NULL, require_real_values = TRUE) {
  defaults <- .cuf_default_config()
  if (is.null(config)) return(defaults)
  if (!is.list(config)) {
    stop_api(400, "E_UNIVERSE_FILTER_INVALID", "config debe ser un objeto.")
  }
  version <- suppressWarnings(as.integer(config$version %||% 1L))[1]
  if (is.na(version) || version != 1L) {
    stop_api(400, "E_UNIVERSE_FILTER_VERSION", "Solo se admite universe_filter version 1.")
  }
  out <- list(
    version = 1L,
    enabled = isTRUE(config$enabled),
    variable = .cuf_scalar(config$variable),
    real_values = .cuf_chr(config$real_values),
    test_values = .cuf_chr(config$test_values),
    corrections = .cuf_normalize_corrections(config$corrections),
    exclusion_rules = .cuf_normalize_exclusion_rules(config$exclusion_rules),
    missing_policy = .cuf_scalar(config$missing_policy, "exclude"),
    unassigned_policy = .cuf_scalar(config$unassigned_policy, "unclassified")
  )
  if (!identical(out$missing_policy, "exclude")) {
    stop_api(400, "E_UNIVERSE_FILTER_MISSING_POLICY", "missing_policy debe ser 'exclude'.")
  }
  if (!identical(out$unassigned_policy, "unclassified")) {
    stop_api(400, "E_UNIVERSE_FILTER_UNASSIGNED_POLICY", "unassigned_policy debe ser 'unclassified'.")
  }
  if (out$enabled && (!nzchar(out$variable) ||
                      (isTRUE(require_real_values) && !length(out$real_values)))) {
    stop_api(400, "E_UNIVERSE_FILTER_INCOMPLETE",
             "El filtro requiere variable y al menos un valor real.")
  }
  overlap <- intersect(out$real_values, out$test_values)
  if (length(overlap)) {
    stop_api(400, "E_UNIVERSE_FILTER_OVERLAP",
             sprintf("Los valores real y prueba deben ser disjuntos: %s.", paste(overlap, collapse = ", ")))
  }
  out
}

.cuf_file_df <- function(s, file_id) {
  fid <- .cuf_scalar(file_id)
  meta <- (s$files %||% list())[[fid]]
  if (!nzchar(fid) || is.null(meta) || !file.exists(meta$path %||% "")) {
    stop_api(409, "E_UNIVERSE_FILTER_SOURCE_MISSING", "No se encontro la base fuente del filtro.")
  }
  ext <- tolower(.cuf_scalar(meta$ext, tools::file_ext(meta$path)))
  df <- if (exists(".read_data_any_path", mode = "function")) {
    .read_data_any_path(meta$path, ext)
  } else if (ext %in% c("xlsx", "xls")) {
    suppressWarnings(readxl::read_excel(meta$path))
  } else if (identical(ext, "csv")) {
    utils::read.csv(meta$path, stringsAsFactors = FALSE, check.names = FALSE)
  } else if (identical(ext, "sav")) {
    haven::read_sav(meta$path)
  } else {
    stop_api(400, "E_UNIVERSE_FILTER_EXT", sprintf("Extension no soportada: %s.", ext))
  }
  list(data = as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE), meta = meta)
}

.cuf_source_fid <- function(base, source_override = NULL) {
  override <- .cuf_scalar(source_override)
  if (nzchar(override)) return(override)
  saved <- .cuf_scalar((base$universe_filter %||% list())$source_data_file_id)
  if (nzchar(saved)) return(saved)
  current <- .cuf_scalar(base$data_file_id)
  if (nzchar(current)) return(current)
  stop_api(409, "E_UNIVERSE_FILTER_SOURCE_MISSING", "La base no tiene data fuente.")
}

.cuf_repeat_source_fid <- function(base) {
  stored <- base$universe_filter %||% list()
  current <- .cuf_scalar(base$data_file_id)
  effective <- .cuf_scalar(stored$effective_data_file_id)
  # Durante un refresh, el registrador de repeats reemplaza data_file_id por
  # la nueva fuente cruda antes de reaplicar el filtro. En una aplicacion
  # ordinaria data_file_id sigue apuntando al efectivo y se conserva la fuente
  # anidada anterior.
  if (nzchar(current) && nzchar(effective) && !identical(current, effective)) {
    return(current)
  }
  .cuf_source_fid(base)
}

.cuf_empty_audit <- function(total) {
  list(
    total = as.integer(total),
    included = as.integer(total),
    excluded_test = 0L,
    excluded_unclassified = 0L
  )
}

.cuf_apply_corrections <- function(data, rules) {
  corrected_rows <- rep(FALSE, nrow(data))
  correction_changes <- 0L
  audit <- vector("list", length(rules))
  for (i in seq_along(rules)) {
    rule <- rules[[i]]
    required <- c(rule$key_variable, rule$variable)
    missing_variables <- setdiff(required, names(data))
    if (length(missing_variables)) {
      stop_api(
        409, "E_UNIVERSE_FILTER_CORRECTION_VARIABLE_UNKNOWN",
        sprintf(
          "La correccion '%s' usa variables inexistentes: %s.",
          rule$id, paste(missing_variables, collapse = ", ")
        )
      )
    }
    keys <- trimws(as.character(data[[rule$key_variable]]))
    values <- trimws(as.character(data[[rule$variable]]))
    affected <- !is.na(keys) & keys %in% rule$key_values &
      !is.na(values) & values %in% rule$from_values
    n_affected <- as.integer(sum(affected))
    if (n_affected) {
      if (is.factor(data[[rule$variable]])) {
        data[[rule$variable]] <- as.character(data[[rule$variable]])
      }
      data[[rule$variable]][affected] <- rule$to_value
      corrected_rows <- corrected_rows | affected
      correction_changes <- correction_changes + n_affected
    }
    audit[[i]] <- c(rule, list(affected = n_affected))
  }
  list(
    data = data,
    corrected = as.integer(sum(corrected_rows)),
    correction_changes = as.integer(correction_changes),
    audit = audit
  )
}

.cuf_apply_exclusions <- function(data, keep, rules) {
  audit <- vector("list", length(rules))
  total_excluded <- 0L
  for (i in seq_along(rules)) {
    rule <- rules[[i]]
    if (!(rule$variable %in% names(data))) {
      stop_api(
        409, "E_UNIVERSE_FILTER_EXCLUSION_VARIABLE_UNKNOWN",
        sprintf("La exclusion '%s' usa la variable inexistente '%s'.",
                rule$id, rule$variable)
      )
    }
    values <- trimws(as.character(data[[rule$variable]]))
    newly_excluded <- keep & !is.na(values) & values %in% rule$values
    n_excluded <- as.integer(sum(newly_excluded))
    keep[newly_excluded] <- FALSE
    total_excluded <- total_excluded + n_excluded
    audit[[i]] <- c(rule, list(excluded = n_excluded))
  }
  list(keep = keep, excluded = as.integer(total_excluded), audit = audit)
}

.cuf_classify <- function(data, config, allow_empty_selection = FALSE) {
  config <- normalize_carga_universe_filter(config, require_real_values = FALSE)
  if (!config$enabled) {
    return(list(data = data, keep = rep(TRUE, nrow(data)),
                summary = .cuf_empty_audit(nrow(data))))
  }
  prepared <- .cuf_apply_corrections(data, config$corrections)
  data <- prepared$data
  if (!(config$variable %in% names(data))) {
    stop_api(409, "E_UNIVERSE_FILTER_VARIABLE_UNKNOWN",
             sprintf("La variable '%s' no existe en la base fuente.", config$variable))
  }
  values <- trimws(as.character(data[[config$variable]]))
  missing <- is.na(values) | !nzchar(values)
  keep <- !missing & values %in% config$real_values
  is_test <- !missing & values %in% config$test_values
  unclassified <- !keep & !is_test
  excluded <- .cuf_apply_exclusions(data, keep, config$exclusion_rules)
  keep <- excluded$keep
  if (!any(keep) && !isTRUE(allow_empty_selection)) {
    stop_api(409, "E_UNIVERSE_FILTER_EMPTY", "El filtro no incluye ninguna entrevista real.")
  }
  summary <- list(
    total = as.integer(nrow(data)),
    included = as.integer(sum(keep)),
    excluded_test = as.integer(sum(is_test)),
    excluded_unclassified = as.integer(sum(unclassified))
  )
  if (length(config$corrections) || length(config$exclusion_rules)) {
    summary <- c(summary, list(
      corrected = prepared$corrected,
      correction_changes = prepared$correction_changes,
      excluded_rules = excluded$excluded,
      corrections = prepared$audit,
      exclusion_rules = excluded$audit
    ))
  }
  list(
    data = data[keep, , drop = FALSE],
    keep = keep,
    summary = summary
  )
}

.cuf_value_inventory <- function(data, variable = "") {
  vars <- lapply(names(data), function(nm) list(
    variable = nm,
    type = paste(class(data[[nm]]), collapse = "/"),
    n_distinct = as.integer(length(unique(trimws(as.character(data[[nm]])))))
  ))
  observed <- list()
  if (nzchar(variable) && variable %in% names(data)) {
    values <- trimws(as.character(data[[variable]]))
    values[is.na(values) | !nzchar(values)] <- ""
    counts <- sort(table(values), decreasing = TRUE)
    observed <- lapply(seq_along(counts), function(i) list(
      value = names(counts)[i], count = as.integer(counts[[i]]),
      missing = !nzchar(names(counts)[i])
    ))
  }
  list(variable_inventory = vars, observed_values = observed)
}

.cuf_public_config <- function(config) {
  config$real_values <- as.list(config$real_values %||% character())
  config$test_values <- as.list(config$test_values %||% character())
  config$corrections <- lapply(config$corrections %||% list(), function(rule) {
    rule$key_values <- as.list(rule$key_values %||% character())
    rule$from_values <- as.list(rule$from_values %||% character())
    rule
  })
  config$exclusion_rules <- lapply(config$exclusion_rules %||% list(), function(rule) {
    rule$values <- as.list(rule$values %||% character())
    rule
  })
  config
}

carga_universe_filter_get <- function(sid, base_name = NULL) {
  s <- session_get(sid)
  base_name <- .resolve_base_nombre(s, base_name)
  if (is.null(base_name)) stop_api(409, "E_UNIVERSE_FILTER_BASE", "El filtro requiere una base registrada.")
  base <- s$estudio$bases[[base_name]]
  stored <- base$universe_filter %||% .cuf_default_config()
  source_fid <- .cuf_source_fid(base)
  loaded <- .cuf_file_df(s, source_fid)
  cfg <- normalize_carga_universe_filter(stored, require_real_values = FALSE)
  inventory <- .cuf_value_inventory(loaded$data, cfg$variable)
  summary <- stored$audit %||% .cuf_classify(
    loaded$data,
    cfg,
    allow_empty_selection = TRUE
  )$summary
  list(
    ok = TRUE,
    base_nombre = base_name,
    config = .cuf_public_config(cfg),
    summary = summary,
    variable_inventory = inventory$variable_inventory,
    observed_values = inventory$observed_values,
    inherited_from = stored$inherited_from %||% NULL,
    read_only = identical(.cuf_scalar(stored$mode), "inherited"),
    applied_at = stored$applied_at %||% NULL
  )
}

carga_universe_filter_preview <- function(sid, base_name, config) {
  s <- session_get(sid)
  base_name <- .resolve_base_nombre(s, base_name)
  if (is.null(base_name)) stop_api(409, "E_UNIVERSE_FILTER_BASE", "El filtro requiere una base registrada.")
  base <- s$estudio$bases[[base_name]]
  if (nzchar(.cuf_scalar(base$parent_base))) {
    stop_api(409, "E_UNIVERSE_FILTER_INHERITED", "Las bases repeat heredan el filtro de su base madre.")
  }
  cfg <- normalize_carga_universe_filter(config, require_real_values = FALSE)
  source_fid <- .cuf_source_fid(base)
  loaded <- .cuf_file_df(s, source_fid)
  classified <- .cuf_classify(loaded$data, cfg, allow_empty_selection = !length(cfg$real_values))
  inventory <- .cuf_value_inventory(loaded$data, cfg$variable)
  list(ok = TRUE, base_nombre = base_name, config = .cuf_public_config(cfg),
       summary = classified$summary,
       variable_inventory = inventory$variable_inventory,
       observed_values = inventory$observed_values)
}

.cuf_repeat_children <- function(s, parent_name) {
  bases <- (s$estudio %||% list())$bases %||% list()
  names(bases)[vapply(bases, function(b) {
    identical(.cuf_scalar(b$parent_base), parent_name)
  }, logical(1))]
}

.cuf_repeat_descendants <- function(s, parent_name) {
  out <- character()
  walk <- function(current) {
    children <- .cuf_repeat_children(s, current)
    out <<- c(out, children)
    for (child in children) walk(child)
  }
  walk(parent_name)
  unique(out)
}

.cuf_prepare_tree <- function(s, base_name, config, source_override = NULL) {
  base <- s$estudio$bases[[base_name]]
  source_fid <- .cuf_source_fid(base, source_override)
  loaded <- .cuf_file_df(s, source_fid)
  classified <- .cuf_classify(loaded$data, config)
  prepared <- list()
  prepared[[base_name]] <- list(
    mode = "manual", source_fid = source_fid, source_meta = loaded$meta,
    data = classified$data, audit = classified$summary, parent = NULL
  )

  walk <- function(parent_name, parent_source, parent_effective) {
    for (child_name in .cuf_repeat_children(s, parent_name)) {
      child <- s$estudio$bases[[child_name]]
      child_source <- .cuf_repeat_source_fid(child)
      child_loaded <- .cuf_file_df(s, child_source)
      link_key <- .cuf_scalar(child$link_key)
      parent_key <- .cuf_scalar(child$parent_index_key)
      if (!nzchar(link_key) || !nzchar(parent_key) ||
          !(link_key %in% names(child_loaded$data)) || !(parent_key %in% names(parent_source))) {
        stop_api(409, "E_UNIVERSE_FILTER_REPEAT_UNLINKED",
                 sprintf("No se puede heredar el filtro hacia la base repeat '%s'.", child_name))
      }
      included_keys <- as.character(parent_effective[[parent_key]])
      child_keys <- as.character(child_loaded$data[[link_key]])
      keep <- !is.na(child_keys) & child_keys %in% included_keys
      child_effective <- child_loaded$data[keep, , drop = FALSE]
      child_audit <- .cuf_empty_audit(nrow(child_loaded$data))
      child_audit$included <- as.integer(sum(keep))
      child_audit$excluded_unclassified <- as.integer(nrow(child_loaded$data) - sum(keep))
      prepared[[child_name]] <<- list(
        mode = "inherited", source_fid = child_source, source_meta = child_loaded$meta,
        data = child_effective,
        audit = child_audit,
        parent = parent_name, link_key = link_key, parent_index_key = parent_key
      )
      walk(child_name, child_loaded$data, child_effective)
    }
  }
  walk(base_name, loaded$data, classified$data)
  prepared
}

.cuf_write_effective <- function(sid, base_name, data) {
  s <- session_get(sid)
  out_dir <- file.path(s$dir, "downloads")
  dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
  path <- file.path(out_dir, paste0(uuid::UUIDgenerate(), "_", base_name, "_universo_efectivo.xlsx"))
  .carga_write_xlsx_sheet(data, path, "datos")
  save_upload(sid, "data", paste0(base_name, "_universo_efectivo.xlsx"),
              readBin(path, "raw", n = file.info(path)$size))
}

.cuf_rp_data <- function(s, base_name, data) {
  inst <- (s$rp_inst_sources %||% list())[[base_name]]
  if (is.null(inst)) {
    base <- s$estudio$bases[[base_name]]
    xmeta <- (s$files %||% list())[[.cuf_scalar(base$xlsform_file_id)]]
    if (!is.null(xmeta)) inst <- reporte_instrumento(path = xmeta$path)
  }
  if (is.null(inst)) return(data)
  reporte_data(data, instrumento = inst)
}

carga_universe_filter_apply <- function(sid, base_name, config, source_override = NULL) {
  s <- session_get(sid)
  base_name <- .resolve_base_nombre(s, base_name)
  if (is.null(base_name)) stop_api(409, "E_UNIVERSE_FILTER_BASE", "El filtro requiere una base registrada.")
  if (nzchar(.cuf_scalar(s$estudio$bases[[base_name]]$parent_base))) {
    stop_api(409, "E_UNIVERSE_FILTER_INHERITED", "Las bases repeat heredan el filtro de su base madre.")
  }
  cfg <- normalize_carga_universe_filter(config)
  old <- s$estudio$bases[[base_name]]$universe_filter %||% list()
  revision <- as.integer(old$revision %||% 0L) + 1L

  if (!cfg$enabled) {
    targets <- c(base_name, .cuf_repeat_descendants(s, base_name))
    for (nm in targets) {
      meta <- s$estudio$bases[[nm]]
      stored <- meta$universe_filter %||% list()
      source_fid <- .cuf_scalar(stored$source_data_file_id,
                                if (identical(nm, base_name)) .cuf_source_fid(meta) else meta$data_file_id)
      loaded <- .cuf_file_df(s, source_fid)
      meta$data_file_id <- source_fid
      meta$data_ext <- .cuf_scalar(loaded$meta$ext, meta$data_ext %||% "xlsx")
      meta$n_filas <- as.integer(nrow(loaded$data))
      meta$n_columnas <- as.integer(ncol(loaded$data))
      meta$universe_filter <- c(cfg, list(
        mode = if (identical(nm, base_name)) "manual" else "inherited",
        source_data_file_id = source_fid,
        effective_data_file_id = .cuf_scalar(stored$effective_data_file_id),
        audit = .cuf_empty_audit(nrow(loaded$data)),
        revision = revision, applied_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
      ))
      s$estudio$bases[[nm]] <- meta
      s$rp_data_sources[[nm]] <- .cuf_rp_data(s, nm, loaded$data)
      s <- .invalidate_processing_state(s, nm)
    }
  } else {
    prepared <- .cuf_prepare_tree(s, base_name, cfg, source_override)
    generated <- list()
    for (nm in names(prepared)) generated[[nm]] <- .cuf_write_effective(sid, nm, prepared[[nm]]$data)
    s <- session_get(sid)
    applied_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
    for (nm in names(prepared)) {
      item <- prepared[[nm]]
      meta <- s$estudio$bases[[nm]]
      meta$data_file_id <- generated[[nm]]$file_id
      meta$data_ext <- generated[[nm]]$ext
      meta$n_filas <- as.integer(nrow(item$data))
      meta$n_columnas <- as.integer(ncol(item$data))
      stored_cfg <- cfg
      meta$universe_filter <- c(stored_cfg, list(
        mode = item$mode,
        source_data_file_id = item$source_fid,
        effective_data_file_id = generated[[nm]]$file_id,
        audit = item$audit,
        revision = revision,
        applied_at = applied_at,
        inherited_from = item$parent,
        link_key = item$link_key %||% NULL,
        parent_index_key = item$parent_index_key %||% NULL
      ))
      s$estudio$bases[[nm]] <- meta
      s$rp_data_sources[[nm]] <- .cuf_rp_data(s, nm, item$data)
      s <- .invalidate_processing_state(s, nm)
    }
  }
  first <- names(s$estudio$bases)[1]
  if (length(first) && first %in% names(s$rp_data_sources)) s$rp_data <- s$rp_data_sources[[first]]
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  carga_universe_filter_get(sid, base_name)
}

carga_universe_filter_reapply <- function(sid, base_name, source_data_file_id = NULL) {
  s <- session_get(sid, required = FALSE)
  base <- ((s$estudio %||% list())$bases %||% list())[[base_name]]
  config <- (base %||% list())$universe_filter %||% NULL
  if (is.null(config) || !isTRUE(config$enabled) || identical(.cuf_scalar(config$mode), "inherited")) {
    return(invisible(FALSE))
  }
  carga_universe_filter_apply(sid, base_name, config,
                              source_override = source_data_file_id %||% base$data_file_id)
  invisible(TRUE)
}
