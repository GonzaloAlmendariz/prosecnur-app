# =============================================================================
# Validación AST — Puente con el motor heredado y reglas custom
# =============================================================================
# Cierra los dos universos paralelos identificados en la auditoría:
#   - Reglas del instrumento (validacion_rule_factory.R) via introspect.
#   - Reglas custom (reglas_custom_compile.R) via bridge_regla_custom().
#
# Ambos pasan por make_rule() → mismo shape, mismo dedup, misma validación.
# El resultado se puede:
#   (a) Ejecutar con el evaluador AST directo (evaluate_rules).
#   (b) Compilar a filas del plan legacy (compile_rule) y correr con
#       evaluar_consistencia() existente — sin romper el pipeline actual.
#
# Decisión: NO removemos el motor heredado en este commit. El AST es
# paralelo; el equipo puede migrar a su ritmo. Lo importante es que los
# dos coinciden en output cuando reciben el mismo input.

# -----------------------------------------------------------------------------
# Bridge: reglas custom (schema UI) → vd_rule
# -----------------------------------------------------------------------------
#' Convierte una regla custom (objeto del editor de UI) en vd_rule.
#'
#' Las reglas custom tienen shape:
#'   list(id, nombre, tipo, variables, params, mensaje, severidad, activa)
#'
#' Mapeo de `tipo` al constructor correspondiente:
#'   no_nulo        → rule_required
#'   rango_num      → rule_range(type="numeric")
#'   rango_fecha    → rule_range(type="date")
#'   outliers_iqr   → rule_outlier(method="iqr")
#'   outliers_z     → rule_outlier(method="zscore")
#'   duplicados     → rule_duplicate
#'   fuera_catalogo → rule_catalog
#'   coherencia_2v  → rule_coherence
#'
#' @export
bridge_regla_custom <- function(r) {
  if (!is.list(r)) stop("bridge_regla_custom(): r debe ser lista.")
  tipo <- as.character(r$tipo %||% "")
  vars <- as.character(unlist(r$variables %||% list()))
  params <- r$params %||% list()
  sev <- as.character(r$severidad %||% "error")
  if (!(sev %in% c("error", "advertencia", "info"))) sev <- "error"
  nombre <- as.character(r$nombre %||% r$id %||% tipo)
  objetivo <- as.character(r$mensaje %||% nombre)
  id_hint <- as.character(r$id %||% "")

  # ID provisto por el UI se respeta (para mantener referencia estable
  # entre la UI y el motor); si no hay, make_rule deriva uno.
  forced_id <- if (nzchar(id_hint)) id_hint else NULL

  rule <- switch(tipo,
    "no_nulo" = rule_required(
      var = vars[1],
      fuente = "custom",
      severidad = sev,
      nombre = nombre,
      objetivo = objetivo
    ),
    "rango_num" = rule_range(
      var = vars[1],
      min = params$min,
      max = params$max,
      inclusive = isTRUE(params$inclusive %||% TRUE),
      type = "numeric",
      fuente = "custom",
      severidad = sev,
      nombre = nombre,
      objetivo = objetivo
    ),
    "rango_fecha" = rule_range(
      var = vars[1],
      min = params$min,
      max = params$max,
      inclusive = isTRUE(params$inclusive %||% TRUE),
      type = "date",
      fuente = "custom",
      severidad = sev,
      nombre = nombre,
      objetivo = objetivo
    ),
    "outliers_iqr" = rule_outlier(
      var = vars[1],
      method = "iqr",
      k = params$k %||% 1.5,
      fuente = "custom",
      severidad = sev,
      nombre = nombre,
      objetivo = objetivo
    ),
    "outliers_z" = rule_outlier(
      var = vars[1],
      method = "zscore",
      k = params$k %||% 3,
      fuente = "custom",
      severidad = sev,
      nombre = nombre,
      objetivo = objetivo
    ),
    "duplicados" = rule_duplicate(
      vars = vars,
      fuente = "custom",
      severidad = sev,
      nombre = nombre,
      objetivo = objetivo
    ),
    "fuera_catalogo" = rule_catalog(
      var = vars[1],
      values = as.character(unlist(params$valores %||% list())),
      fuente = "custom",
      severidad = sev,
      nombre = nombre,
      objetivo = objetivo
    ),
    "coherencia_2v" = {
      # El schema legacy: params$op_x / valor_x / op_y / valor_y.
      # Construimos when = (var1 op_x valor_x) y then_must = (var2 op_y valor_y).
      when_ast <- .cond_from_legacy(vars[1], params$op_x, params$valor_x)
      then_ast <- .cond_from_legacy(vars[2], params$op_y, params$valor_y)
      rule_coherence(
        when = when_ast,
        then_must = then_ast,
        nombre = nombre,
        objetivo = objetivo,
        fuente = "custom",
        severidad = sev
      )
    },
    stop(sprintf("bridge_regla_custom(): tipo '%s' no soportado.", tipo))
  )

  # Si la UI envió un ID, lo forzamos para mantener referencia estable.
  if (!is.null(forced_id)) rule$id <- forced_id
  rule
}

.cond_from_legacy <- function(var, op, value) {
  # `op` puede ser: ==, !=, <, <=, >, >=, in, not_in
  if (op == "in") {
    ast_in_set(var, as.character(unlist(value)))
  } else if (op == "not_in") {
    ast_not_in_set(var, as.character(unlist(value)))
  } else {
    ast_compare_const(var, op, value)
  }
}

#' Convierte una lista de reglas custom a lista de vd_rule (filtrando inactivas).
#' @export
bridge_reglas_custom_list <- function(reglas) {
  if (!length(reglas)) return(list())
  # Filtrar por `activa` (consistente con el compilador legacy).
  active <- Filter(function(r) isTRUE(r$activa) || is.null(r$activa), reglas)
  lapply(active, bridge_regla_custom)
}

# -----------------------------------------------------------------------------
# Pipeline unificado: XLSForm + reglas custom → lista única de vd_rule
# -----------------------------------------------------------------------------
#' Combina reglas inferidas del instrumento + reglas custom en una sola lista,
#' deduplicada por hash. La UI ve un solo universo.
#'
#' @param instrumento  lista con $survey (requerido).
#' @param reglas_custom  lista de objetos regla custom (opcional).
#' @param include  pasa a infer_rules_from_xlsform.
#' @return list(rules, lex_report, discarded, dedup_info).
#' @export
build_unified_rules <- function(instrumento,
                                reglas_custom = list(),
                                include = c("required", "skip",
                                            "constraint", "repeat_length")) {
  # 1. Introspección del instrumento
  instr_res <- infer_rules_from_xlsform(instrumento, include = include, dedup = FALSE)
  instr_rules <- instr_res$rules

  # 2. Bridge de las reglas custom
  custom_rules <- bridge_reglas_custom_list(reglas_custom)

  # 3. Dedup por ID exacto (incluye fuente/tipo — detección gemela).
  all_rules <- c(custom_rules, instr_rules)
  ids <- vapply(all_rules, function(r) r$id, character(1))
  keep <- !duplicated(ids)
  dedup_dropped <- all_rules[!keep]
  rules <- all_rules[keep]

  # 4. Detección de duplicados SEMÁNTICOS: misma variable + mismo predicate_hash
  #    aunque vengan de fuentes o tipos distintos. No se borran (la UI decide).
  semantic_dups <- .detect_semantic_dups(rules)

  list(
    rules = rules,
    lex_report = instr_res$lex_report,
    discarded = instr_res$discarded,
    dedup_info = list(
      n_instrumento = length(instr_rules),
      n_custom = length(custom_rules),
      n_total_tras_dedup = length(rules),
      n_duplicadas = length(dedup_dropped),
      semantic_dups = semantic_dups
    )
  )
}

.detect_semantic_dups <- function(rules) {
  # Agrupa por predicate_hash + variables ordenadas. Si hay >= 2 reglas en
  # un grupo, son gemelas semánticas (checan lo mismo). Retornamos lista
  # con los grupos de ≥2 — la UI puede mostrar "esta regla equivale a X".
  if (length(rules) < 2L) return(list())
  keys <- vapply(rules, function(r) {
    paste(r$predicate_hash,
          paste(sort(r$variables), collapse = ","),
          sep = "|")
  }, character(1))
  groups <- split(seq_along(rules), keys)
  dup_groups <- groups[lengths(groups) >= 2L]
  lapply(dup_groups, function(idxs) {
    lapply(idxs, function(i) {
      list(
        id = rules[[i]]$id,
        nombre = rules[[i]]$nombre,
        fuente = rules[[i]]$fuente,
        tipo_regla = rules[[i]]$tipo_regla
      )
    })
  })
}

# -----------------------------------------------------------------------------
# Export de reglas al shape del plan legacy (compatibilidad hacia atrás)
# -----------------------------------------------------------------------------
#' Compila una lista de reglas a un tibble con el shape del plan legacy.
#' El pipeline existente (evaluar_consistencia) puede consumir este output
#' sin modificaciones.
#' @export
compile_rules_to_plan <- function(rules) {
  if (!length(rules)) {
    # Devolver tibble vacío con el shape esperado.
    return(compile_rule(rule_required("_stub_"))[0, ])
  }
  rows <- lapply(rules, function(r) {
    tryCatch(compile_rule(r), error = function(e) {
      # Si compile_rule falla (p.ej. odk_raw), devuelve NA-row para no romper.
      NULL
    })
  })
  rows <- Filter(Negate(is.null), rows)
  if (!length(rows)) return(compile_rule(rule_required("_stub_"))[0, ])
  dplyr::bind_rows(rows)
}
