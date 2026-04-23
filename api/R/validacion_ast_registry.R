# =============================================================================
# Validación AST — Registry de tipos de regla (Capa 7)
# =============================================================================
# Catálogo declarativo de los tipos de regla soportados. Uso principal:
#   - UI introspectable: el frontend de "crear regla custom" consulta el
#     registry para saber qué constructores existen, qué args esperan, qué
#     preview usa cada uno.
#   - Tests: cada tipo tiene un fixture mínimo (data + predicate esperado).
#   - Extensibilidad: agregar un tipo = una llamada a `register_rule_type`.

.RULE_REGISTRY <- new.env(parent = emptyenv())

#' Registra un tipo de regla en el catálogo.
#'
#' @param tipo character(1) — el `tipo_regla`
#' @param label character(1) — nombre humano corto (ej. "Rango numérico")
#' @param description character(1) — explicación para el usuario
#' @param categoria_ux character(1)
#' @param needs_vars_min integer
#' @param needs_vars_max integer | Inf
#' @param constructor function — `rule_*()` canónico
#' @param params character — nombres de args que el constructor espera además de `var/vars`
#' @param preview_chart NULL | "histogram" | "boxplot" | "bar" | "table"
#' @param remediation_default character(1)
#' @export
register_rule_type <- function(tipo,
                               label,
                               description,
                               categoria_ux,
                               needs_vars_min = 1L,
                               needs_vars_max = 1L,
                               constructor = NULL,
                               params = character(0),
                               preview_chart = NULL,
                               remediation_default = NULL) {
  if (!is.character(tipo) || length(tipo) != 1L) stop("tipo debe ser string.")
  entry <- list(
    tipo = tipo,
    label = label,
    description = description,
    categoria_ux = categoria_ux,
    needs_vars_min = as.integer(needs_vars_min),
    needs_vars_max = needs_vars_max,
    constructor = constructor,
    params = as.character(params),
    preview_chart = preview_chart,
    remediation_default = remediation_default
  )
  assign(tipo, entry, envir = .RULE_REGISTRY)
  invisible(entry)
}

#' Obtiene la entrada del registry para un tipo.
#' @export
get_rule_type <- function(tipo) {
  if (!exists(tipo, envir = .RULE_REGISTRY, inherits = FALSE)) {
    stop(sprintf("get_rule_type(): tipo '%s' no registrado.", tipo))
  }
  get(tipo, envir = .RULE_REGISTRY, inherits = FALSE)
}

#' Lista todos los tipos registrados con su metadata.
#' @export
list_rule_types <- function() {
  names_ <- ls(envir = .RULE_REGISTRY, sorted = TRUE)
  lapply(names_, get_rule_type)
}

#' Resetea el registry — útil en tests.
#' @export
reset_rule_registry <- function() {
  rm(list = ls(envir = .RULE_REGISTRY, sorted = FALSE), envir = .RULE_REGISTRY)
  invisible(TRUE)
}

# -----------------------------------------------------------------------------
# Poblado default — los 13 tipos soportados de inicio.
# (Se ejecuta al source; safe-to-call-twice gracias a assign().)
# -----------------------------------------------------------------------------
.populate_default_registry <- function() {
  register_rule_type(
    tipo = "required",
    label = "Obligatoriedad",
    description = "La variable debe responderse. Marca los casos donde quedó vacía.",
    categoria_ux = "completitud",
    needs_vars_min = 1L, needs_vars_max = 1L,
    constructor = rule_required,
    params = c("gate"),
    remediation_default = "impute_value"
  )
  register_rule_type(
    tipo = "skip",
    label = "Salto del instrumento",
    description = "Respeta la lógica de salto: variable responde o queda vacía según la condición.",
    categoria_ux = "saltos",
    needs_vars_min = 1L, needs_vars_max = 1L,
    constructor = rule_skip,
    params = c("gate", "direction"),
    remediation_default = "exclude_cases"
  )
  register_rule_type(
    tipo = "range",
    label = "Rango numérico o de fecha",
    description = "Valor dentro de un rango [min, max]. Aplica a integer, decimal o date.",
    categoria_ux = "rangos",
    needs_vars_min = 1L, needs_vars_max = 1L,
    constructor = rule_range,
    params = c("min", "max", "inclusive", "type"),
    preview_chart = "histogram",
    remediation_default = "replace_value"
  )
  register_rule_type(
    tipo = "catalog",
    label = "Valor del catálogo",
    description = "Valor debe estar en una lista permitida (catálogo).",
    categoria_ux = "catálogo",
    needs_vars_min = 1L, needs_vars_max = 1L,
    constructor = rule_catalog,
    params = c("values"),
    preview_chart = "bar",
    remediation_default = "replace_value"
  )
  register_rule_type(
    tipo = "outlier",
    label = "Outlier estadístico",
    description = "Valor fuera de IQR o z-score. Útil para detectar extremos.",
    categoria_ux = "outliers",
    needs_vars_min = 1L, needs_vars_max = 1L,
    constructor = rule_outlier,
    params = c("method", "k"),
    preview_chart = "boxplot",
    remediation_default = "exclude_cases"
  )
  register_rule_type(
    tipo = "duplicate",
    label = "Duplicados",
    description = "La tupla (var1, var2, ...) no debería repetirse entre casos.",
    categoria_ux = "duplicados",
    needs_vars_min = 1L, needs_vars_max = Inf,
    constructor = rule_duplicate,
    params = character(0),
    preview_chart = "table",
    remediation_default = "exclude_cases"
  )
  register_rule_type(
    tipo = "coherence",
    label = "Coherencia entre variables",
    description = "Si se cumple una condición, otra debe cumplirse. Modelo si...entonces.",
    categoria_ux = "coherencia",
    needs_vars_min = 2L, needs_vars_max = Inf,
    constructor = rule_coherence,
    params = c("when", "then_must"),
    remediation_default = "replace_value"
  )
  register_rule_type(
    tipo = "select_multiple_cardinality",
    label = "Cardinalidad / exclusividad",
    description = "Un select_multiple con tope de selecciones y/o códigos exclusivos.",
    categoria_ux = "cardinalidad",
    needs_vars_min = 1L, needs_vars_max = 1L,
    constructor = rule_select_multiple_cardinality,
    params = c("max_count", "exclusive_codes"),
    remediation_default = "normalize_value"
  )
  register_rule_type(
    tipo = "pattern",
    label = "Patrón sospechoso",
    description = "Detecta straight-lining (varianza cercana a 0 en bloques Likert).",
    categoria_ux = "patrones",
    needs_vars_min = 2L, needs_vars_max = Inf,
    constructor = rule_pattern_straightline,
    params = c("max_variance"),
    preview_chart = "boxplot",
    remediation_default = "exclude_cases"
  )
  register_rule_type(
    tipo = "repeat_length",
    label = "Longitud de tabla repeat",
    description = "La cantidad de filas del repeat debe coincidir con un valor esperado.",
    categoria_ux = "estructura",
    needs_vars_min = 0L, needs_vars_max = 0L,
    constructor = rule_repeat_length,
    params = c("repeat_name", "expected"),
    remediation_default = "exclude_cases"
  )
  register_rule_type(
    tipo = "odk_raw",
    label = "Expresión ODK cruda (modo experto)",
    description = "Escape hatch para constraints/relevants que no caben en el sistema tipado.",
    categoria_ux = "experto",
    needs_vars_min = 0L, needs_vars_max = Inf,
    constructor = rule_odk_raw,
    params = c("odk_expression"),
    remediation_default = "ignore"
  )
  invisible(TRUE)
}

# Ejecutar poblado al source.
tryCatch(.populate_default_registry(), error = function(e) {
  message("Registry default no pudo poblarse: ", conditionMessage(e))
})
