# Contrato de validacion derivado de una revision inmutable de instrumento.
#
# La revision conserva decisiones metodologicas que no forman parte del
# XLSForm materializado. Este resolver proyecta exclusivamente las decisiones
# ejecutables que Validacion debe rehidratar al construir su bundle AST.

.INSTRUMENT_VALIDATION_CONTRACT_SCHEMA <- "instrument_validation_contract/v1"

.instrument_validation_scalar <- function(value, default = "") {
  if (is.null(value) || !length(value) || is.na(value[[1]])) return(default)
  out <- trimws(as.character(value[[1]]))
  if (nzchar(out)) out else default
}

.instrument_validation_revision <- function(s, revision_id) {
  revision_id <- .instrument_validation_scalar(revision_id)
  if (!nzchar(revision_id)) return(NULL)
  revisions <- (s %||% list())$instrument_revisions %||% list()
  direct <- revisions[[revision_id]] %||% NULL
  if (!is.null(direct) && identical(
    .instrument_validation_scalar(direct$revision_id),
    revision_id
  )) return(direct)
  hits <- Filter(function(item) {
    identical(
      .instrument_validation_scalar((item %||% list())$revision_id),
      revision_id
    )
  }, unname(revisions))
  if (length(hits)) hits[[1]] else NULL
}

.instrument_validation_title_gate <- function(expression) {
  expression <- .instrument_validation_scalar(expression)
  if (!nzchar(expression)) return(NULL)
  match <- regexec(
    "^\\s*\\$\\{p7\\}\\s*={1,2}\\s*['\"]1['\"]\\s*$",
    expression,
    perl = TRUE
  )
  if (!length(regmatches(expression, match)[[1]])) return(NULL)
  ast_selected("p7", "1")
}

.instrument_validation_degree_year_rule <- function(config) {
  if (!identical(
    .instrument_validation_scalar(config$enforcement),
    "validation_coherence_rule_after_materialization"
  ) || !isTRUE(config$title_year_not_before_graduation)) {
    return(NULL)
  }
  title_gate <- .instrument_validation_title_gate(config$title_has_year_if)
  if (is.null(title_gate)) return(NULL)

  rule_coherence(
    when = title_gate,
    then_must = ast_compare_vars("p8", ">=", "p5"),
    nombre = "Año de título no anterior al año de egreso",
    objetivo = "Cuando existe título, su año debe ser mayor o igual que el año de egreso.",
    fuente = "instrumento",
    severidad = "error"
  )
}

#' Resuelve las reglas de Validacion autorizadas por una revision.
#'
#' @param s Estado de sesion.
#' @param revision_id Identificador exacto de la revision inmutable.
#' @return Contrato compacto con reglas AST listas para anexar a un bundle.
#' @export
instrument_validation_contract <- function(s, revision_id) {
  revision_id <- .instrument_validation_scalar(revision_id)
  revision <- .instrument_validation_revision(s, revision_id)
  provenance <- (((revision %||% list())$source %||% list())$provenance) %||% list()
  degree_year <- provenance$degree_year_rule %||% list()
  rule <- .instrument_validation_degree_year_rule(degree_year)
  rules <- if (is.null(rule)) list() else list(rule)
  executable <- list(
    schema = .INSTRUMENT_VALIDATION_CONTRACT_SCHEMA,
    degree_year_rule = if (length(rules)) list(
      title_has_year_if = "${p7} = '1'",
      title_year_not_before_graduation = TRUE,
      enforcement = "validation_coherence_rule_after_materialization",
      graduation_year_field = "p5",
      title_year_field = "p8"
    ) else list()
  )
  list(
    schema = .INSTRUMENT_VALIDATION_CONTRACT_SCHEMA,
    configured = length(rules) > 0L,
    contract_sha256 = tolower(digest::digest(executable, algo = "sha256", serialize = TRUE)),
    rules = rules
  )
}

#' Anexa reglas de un contrato de revision sin mutar el bundle de entrada.
#'
#' @param bundle Bundle producido por `build_validation_bundle()`.
#' @param contract Resultado de `instrument_validation_contract()`.
#' @return Copia del bundle con reglas deduplicadas por id y plan recompilado.
#' @export
instrument_validation_append_rules <- function(bundle, contract) {
  contract <- contract %||% list()
  contract_rules <- contract$rules %||% list()
  if (!isTRUE(contract$configured) || !length(contract_rules)) return(bundle)

  out <- bundle
  rules <- c((bundle %||% list())$rules %||% list(), contract_rules)
  ids <- vapply(rules, function(rule) as.character(rule$id %||% ""), character(1))
  out$rules <- rules[!duplicated(ids)]
  out$plan <- compile_rules_to_plan(out$rules)
  out$instrument_validation_contract <- list(
    schema = .instrument_validation_scalar(contract$schema),
    configured = TRUE,
    contract_sha256 = .instrument_validation_scalar(contract$contract_sha256),
    rule_ids = as.list(vapply(contract_rules, function(rule) rule$id, character(1)))
  )
  out
}
