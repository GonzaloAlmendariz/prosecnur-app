# Contrato analitico compacto derivado de una revision inmutable de instrumento.
#
# La procedencia completa puede contener evidencia y rutas locales que no deben
# viajar a cada entregable. Este resolver proyecta solo reglas ejecutables y las
# liga a la identidad/hash de la revision que las autorizo.

.INSTRUMENT_ANALYSIS_CONTRACT_SCHEMA <- "instrument_analysis_contract/v1"

.instrument_contract_scalar <- function(value, default = "") {
  if (is.null(value) || !length(value) || is.na(value[[1]])) return(default)
  out <- trimws(as.character(value[[1]]))
  if (nzchar(out)) out else default
}

.instrument_contract_chr <- function(value) {
  if (is.null(value)) return(character(0))
  out <- trimws(as.character(unlist(value, recursive = TRUE, use.names = FALSE)))
  unique(out[!is.na(out) & nzchar(out)])
}

.instrument_contract_hash <- function(value) {
  tolower(digest::digest(value, algo = "sha256", serialize = TRUE))
}

.instrument_contract_revision <- function(s, revision_id) {
  revision_id <- .instrument_contract_scalar(revision_id)
  revisions <- s$instrument_revisions %||% list()
  direct <- revisions[[revision_id]] %||% NULL
  if (!is.null(direct) && identical(
    .instrument_contract_scalar(direct$revision_id),
    revision_id
  )) return(direct)
  hits <- Filter(function(item) {
    identical(.instrument_contract_scalar((item %||% list())$revision_id), revision_id)
  }, unname(revisions))
  if (length(hits)) hits[[1]] else NULL
}

instrument_analysis_contract <- function(s, revision_id) {
  revision_id <- .instrument_contract_scalar(revision_id)
  revision <- .instrument_contract_revision(s, revision_id)
  provenance <- (((revision %||% list())$source %||% list())$provenance) %||% list()
  executable <- list(
    proposal_schema = .instrument_contract_scalar(provenance$proposal_schema),
    analysis_excluded_fields = as.list(.instrument_contract_chr(provenance$analysis_excluded_fields)),
    analysis_excluded_codes = provenance$analysis_excluded_codes %||% list(),
    denominator_rules = provenance$denominator_rules %||% list(),
    ppt_plan_defaults = provenance$ppt_plan_defaults %||% list(),
    special_values = provenance$special_values %||% list()
  )
  configured <- length(executable$analysis_excluded_fields) > 0L ||
    length(executable$analysis_excluded_codes) > 0L ||
    length(executable$denominator_rules) > 0L ||
    length(executable$ppt_plan_defaults) > 0L ||
    length(executable$special_values) > 0L
  list(
    schema = .INSTRUMENT_ANALYSIS_CONTRACT_SCHEMA,
    configured = configured,
    instrument_revision_id = revision_id,
    source_sha256 = .instrument_contract_scalar(((revision %||% list())$logic_audit %||% list())$source_sha256),
    contract_sha256 = .instrument_contract_hash(executable),
    proposal_schema = executable$proposal_schema,
    analysis_excluded_fields = executable$analysis_excluded_fields,
    analysis_excluded_codes = executable$analysis_excluded_codes,
    denominator_rules = executable$denominator_rules,
    ppt_plan_defaults = executable$ppt_plan_defaults,
    special_values = executable$special_values
  )
}

.instrument_contract_parse_eligibility <- function(expression) {
  expression <- .instrument_contract_scalar(expression)
  if (!nzchar(expression)) return(NULL)
  match <- regexec(
    "^\\s*\\$\\{([^}]+)\\}\\s*={1,2}\\s*['\"]([^'\"]+)['\"]\\s*$",
    expression,
    perl = TRUE
  )
  parts <- regmatches(expression, match)[[1]]
  if (length(parts) != 3L) return(NULL)
  list(variable = trimws(parts[[2]]), value = parts[[3]])
}

instrument_analysis_apply_data <- function(data, contract) {
  if (!is.data.frame(data) || !isTRUE((contract %||% list())$configured)) {
    return(list(data = data, audit = list(), warnings = character(0)))
  }
  out <- data
  audit <- list()
  warnings <- character(0)
  denominator_rules <- contract$denominator_rules %||% list()
  excluded_codes <- contract$analysis_excluded_codes %||% list()
  variables <- unique(c(names(denominator_rules), names(excluded_codes)))
  variables <- variables[!is.na(variables) & nzchar(variables)]

  for (variable in variables) {
    if (!variable %in% names(out)) {
      warnings <- c(warnings, sprintf("instrument_contract_variable_missing: %s", variable))
      next
    }
    rule <- denominator_rules[[variable]] %||% list()
    exclusions <- unique(c(
      .instrument_contract_chr(excluded_codes[[variable]] %||% NULL),
      .instrument_contract_chr(rule$exclude_codes %||% NULL)
    ))
    values <- trimws(as.character(out[[variable]]))
    nonempty <- !is.na(values) & nzchar(values) & values != "NA"
    eligible <- rep(TRUE, nrow(out))
    eligibility <- .instrument_contract_parse_eligibility(rule$eligible_if)
    eligibility_applied <- FALSE
    if (!is.null(eligibility)) {
      if (eligibility$variable %in% names(out)) {
        parent <- trimws(as.character(out[[eligibility$variable]]))
        eligible <- !is.na(parent) & parent == eligibility$value
        eligibility_applied <- TRUE
      } else {
        warnings <- c(warnings, sprintf(
          "instrument_contract_eligibility_variable_missing: %s requiere %s",
          variable,
          eligibility$variable
        ))
      }
    } else if (nzchar(.instrument_contract_scalar(rule$eligible_if))) {
      warnings <- c(warnings, sprintf(
        "instrument_contract_eligibility_unparsed: %s = %s",
        variable,
        .instrument_contract_scalar(rule$eligible_if)
      ))
    }
    excluded <- nonempty & values %in% exclusions
    valid <- eligible & nonempty & !excluded
    replace <- excluded | (!eligible & nonempty)
    if (any(replace)) out[[variable]][replace] <- NA
    n_valid <- as.integer(sum(valid))
    zero_policy <- .instrument_contract_scalar(rule$zero_denominator)
    if (identical(zero_policy, "report_na_with_warning") && n_valid == 0L) {
      warnings <- c(warnings, sprintf(
        "instrument_contract_zero_denominator: %s no tiene casos validos; reportar NA.",
        variable
      ))
    }
    audit[[variable]] <- list(
      eligible_if = .instrument_contract_scalar(rule$eligible_if),
      eligibility_applied = eligibility_applied,
      exclusions = as.list(exclusions),
      n_rows = as.integer(nrow(out)),
      n_eligible = as.integer(sum(eligible)),
      n_excluded_codes = as.integer(sum(excluded)),
      n_ineligible_nonempty = as.integer(sum(!eligible & nonempty)),
      n_empty = as.integer(sum(!nonempty)),
      n_valid = n_valid,
      zero_denominator = identical(zero_policy, "report_na_with_warning") && n_valid == 0L
    )
  }
  attr(out, "instrument_analysis_contract") <- contract
  attr(out, "instrument_analysis_audit") <- audit
  attr(out, "instrument_analysis_warnings") <- unique(warnings)
  list(data = out, audit = audit, warnings = unique(warnings))
}

instrument_analysis_apply_instrument <- function(instrument, contract) {
  if (!is.list(instrument)) return(instrument)
  if (!isTRUE((contract %||% list())$configured)) {
    attr(instrument, "instrument_analysis_contract") <- contract
    return(instrument)
  }
  out <- instrument
  out$orders_list <- out$orders_list %||% list()
  survey <- out$survey %||% data.frame()
  choices <- out$choices %||% data.frame()
  denominator_rules <- contract$denominator_rules %||% list()
  excluded_codes <- contract$analysis_excluded_codes %||% list()
  variables <- unique(c(names(denominator_rules), names(excluded_codes)))
  variables <- variables[!is.na(variables) & nzchar(variables)]

  for (variable in variables) {
    exclusions <- unique(c(
      .instrument_contract_chr(excluded_codes[[variable]] %||% NULL),
      .instrument_contract_chr((denominator_rules[[variable]] %||% list())$exclude_codes %||% NULL)
    ))
    if (!length(exclusions)) next
    list_name <- ""
    if (is.data.frame(survey) && all(c("name", "list_name") %in% names(survey))) {
      hit <- which(as.character(survey$name) == variable & !is.na(survey$list_name))[1]
      if (!is.na(hit)) list_name <- .instrument_contract_scalar(survey$list_name[[hit]])
    }
    order <- out$orders_list[[variable]] %||%
      if (nzchar(list_name)) out$orders_list[[list_name]] %||% NULL else NULL
    if (is.null(order) && is.data.frame(choices) &&
        all(c("list_name", "name", "label") %in% names(choices)) && nzchar(list_name)) {
      rows <- as.character(choices$list_name) == list_name
      order <- list(
        names = as.character(choices$name[rows]),
        labels = as.character(choices$label[rows])
      )
    }
    if (is.null(order)) next
    codes <- as.character(order$names %||% character(0))
    labels <- as.character(order$labels %||% codes)
    if (length(labels) != length(codes)) labels <- rep_len(labels, length(codes))
    keep <- !codes %in% exclusions & !labels %in% exclusions
    filtered <- order
    filtered$names <- codes[keep]
    filtered$labels <- labels[keep]
    filtered$analysis_excluded_codes <- as.list(exclusions)
    out$orders_list[[variable]] <- filtered
  }
  attr(out, "instrument_analysis_contract") <- contract
  out
}

instrument_analysis_apply_sources <- function(s, data_sources, inst_sources) {
  bases <- (s$estudio %||% list())$bases %||% list()
  common <- intersect(names(data_sources), names(inst_sources))
  audits <- list()
  warnings <- character(0)
  for (base in common) {
    revision_id <- .instrument_contract_scalar((bases[[base]] %||% list())$instrument_revision_id)
    contract <- instrument_analysis_contract(s, revision_id)
    applied <- instrument_analysis_apply_data(data_sources[[base]], contract)
    data_sources[[base]] <- applied$data
    inst_sources[[base]] <- instrument_analysis_apply_instrument(inst_sources[[base]], contract)
    attr(inst_sources[[base]], "instrument_analysis_audit") <- applied$audit
    audits[[base]] <- applied$audit
    warnings <- c(warnings, if (length(applied$warnings)) {
      paste0(base, ": ", applied$warnings)
    } else character(0))
  }
  list(
    data_sources = data_sources,
    inst_sources = inst_sources,
    audits = audits,
    warnings = unique(warnings)
  )
}
