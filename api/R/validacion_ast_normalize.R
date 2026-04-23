# =============================================================================
# Validación AST — canonicalizador / pattern collapser (Capa 1)
# =============================================================================
# Normaliza el AST para que dos predicados semánticamente equivalentes tengan
# la misma forma (y por tanto el mismo hash). Esto habilita:
#   - Dedup: dos reglas con el mismo AST canonicalizado son la misma regla.
#   - UI legible: OR de 9 selecteds → "any_selected" con 9 valores.
#   - Tests estables: el round-trip ODK → AST → ODK es reproducible.
#
# Transformaciones aplicadas (post-order):
#   1. Aplana AND/OR anidados: and(and(a,b), c) → and(a, b, c)
#   2. Colapsa OR de selected(v, x) → any_selected(v, [...])
#   3. Colapsa AND de NOT(selected) → none_selected
#   4. Colapsa AND de compare_const != en cols distintas → all_columns_not_equals
#   5. Colapsa OR de compare_const == en cols distintas → any_column_equals
#   6. Colapsa AND(gte(v,a), lte(v,b)) → range_numeric(v, a, b)
#   7. Constante folding: and(x, always_true) → x; or(x, always_false) → x
#   8. not(not(x)) → x
#   9. Ordena args de AND/OR por hash (determinismo)

#' Canonicaliza un AST, aplicando todas las transformaciones de colapsado.
#' Idempotente: `ast_normalize(ast_normalize(x)) == ast_normalize(x)`.
#' @export
ast_normalize <- function(x) {
  if (!is_ast(x)) return(x)
  # Iterar hasta punto fijo (típicamente 1-2 pasadas).
  prev_hash <- ""
  cur <- x
  for (i in seq_len(8L)) {
    cur <- .ast_normalize_pass(cur)
    h <- ast_hash(cur)
    if (h == prev_hash) break
    prev_hash <- h
  }
  cur
}

.ast_normalize_pass <- function(x) {
  ast_map(x, function(node) {
    op <- ast_op(node)

    # 1. Aplana AND/OR anidados.
    if (op %in% c("and", "or")) {
      flat <- list()
      for (a in node$args) {
        if (is_ast(a) && ast_op(a) == op) {
          flat <- c(flat, a$args)
        } else {
          flat <- c(flat, list(a))
        }
      }
      # 7. Constante folding.
      identity_node <- if (op == "and") "always_true" else "always_false"
      annihilator   <- if (op == "and") "always_false" else "always_true"
      flat <- Filter(function(a) !(is_ast(a) && ast_op(a) == identity_node), flat)
      if (any(vapply(flat, function(a) is_ast(a) && ast_op(a) == annihilator, logical(1)))) {
        return(if (op == "and") ast_always_false() else ast_always_true())
      }
      if (!length(flat)) return(if (op == "and") ast_always_true() else ast_always_false())
      if (length(flat) == 1L) return(flat[[1]])

      # 2-5. Colapsar patrones.
      collapsed <- .ast_collapse_patterns(op, flat)

      # 9. Orden determinístico por hash.
      hashes <- vapply(collapsed, function(a) ast_hash(a), character(1))
      collapsed <- collapsed[order(hashes)]

      if (length(collapsed) == 1L) return(collapsed[[1]])
      return(ast(op, args = collapsed))
    }

    # 8. not(not(x)) → x
    if (op == "not" && is_ast(node$arg) && ast_op(node$arg) == "not") {
      return(node$arg$arg)
    }
    # not(always_true) → always_false, not(always_false) → always_true
    if (op == "not" && is_ast(node$arg)) {
      inner <- ast_op(node$arg)
      if (inner == "always_true")  return(ast_always_false())
      if (inner == "always_false") return(ast_always_true())
    }

    node
  })
}

# -----------------------------------------------------------------------------
# Colapso de patrones — extraído para legibilidad
# -----------------------------------------------------------------------------
.ast_collapse_patterns <- function(op, args) {
  # Separar por forma
  selecteds <- list()   # op == selected(v, x)
  not_selecteds <- list()  # op == not(selected(v, x))
  eq_consts <- list()   # op == compare_const(v, "==", value)
  ne_consts <- list()   # op == compare_const(v, "!=", value)
  ranges_gte <- list()  # op == compare_const(v, ">=", min)
  ranges_lte <- list()  # op == compare_const(v, "<=", max)
  others <- list()

  for (a in args) {
    if (!is_ast(a)) { others <- c(others, list(a)); next }
    aop <- ast_op(a)
    if (aop == "selected") {
      selecteds <- c(selecteds, list(a))
    } else if (aop == "not" && is_ast(a$arg) && ast_op(a$arg) == "selected") {
      not_selecteds <- c(not_selecteds, list(a))
    } else if (aop == "compare_const") {
      if (a$op == "==") eq_consts <- c(eq_consts, list(a))
      else if (a$op == "!=") ne_consts <- c(ne_consts, list(a))
      else if (a$op == ">=") ranges_gte <- c(ranges_gte, list(a))
      else if (a$op == "<=") ranges_lte <- c(ranges_lte, list(a))
      else others <- c(others, list(a))
    } else {
      others <- c(others, list(a))
    }
  }

  out <- others

  # 2. OR de selected(v, x1), selected(v, x2), ... sobre MISMA var → any_selected.
  #    AND de NOT(selected(v, x1)), ... → none_selected.
  if (op == "or" && length(selecteds) >= 2L) {
    by_var <- split(selecteds, vapply(selecteds, function(a) a$var, character(1)))
    for (v in names(by_var)) {
      grp <- by_var[[v]]
      if (length(grp) >= 2L) {
        vals <- vapply(grp, function(a) a$value, character(1))
        out <- c(out, list(ast_any_selected(v, unique(vals))))
      } else {
        out <- c(out, grp)
      }
    }
    selecteds <- list()
  }
  if (op == "and" && length(not_selecteds) >= 2L) {
    by_var <- split(not_selecteds, vapply(not_selecteds, function(a) a$arg$var, character(1)))
    for (v in names(by_var)) {
      grp <- by_var[[v]]
      if (length(grp) >= 2L) {
        vals <- vapply(grp, function(a) a$arg$value, character(1))
        out <- c(out, list(ast_none_selected(v, unique(vals))))
      } else {
        out <- c(out, grp)
      }
    }
    not_selecteds <- list()
  }

  # 3-5. Colapsar compare_const == / != en patrones más compactos.
  #
  #   Caso A — OR de ==  todos sobre la MISMA var (con valores distintos):
  #     → in_set(var, valores)
  #   Caso B — OR de == todos con el MISMO valor en vars DISTINTAS:
  #     → any_column_equals(cols, value)  [decomposed select_multiple]
  #   Caso A' — AND de != MISMA var con valores distintos:
  #     → not_in_set(var, valores)
  #   Caso B' — AND de != MISMO valor en vars DISTINTAS:
  #     → all_columns_not_equals(cols, value)
  if (op == "or" && length(eq_consts) >= 2L) {
    remaining <- list()
    # Primero probamos agrupar por var (misma var → in_set).
    by_var <- split(eq_consts, vapply(eq_consts, function(a) a$var, character(1)))
    for (v in names(by_var)) {
      grp <- by_var[[v]]
      if (length(grp) >= 2L) {
        vals <- vapply(grp, function(a) as.character(a$value), character(1))
        if (length(unique(vals)) == length(vals)) {
          out <- c(out, list(ast_in_set(v, unique(vals))))
        } else {
          remaining <- c(remaining, grp)
        }
      } else {
        remaining <- c(remaining, grp)
      }
    }
    # Luego intentamos agrupar por valor sobre lo que quedó (vars distintas → any_column_equals).
    if (length(remaining)) {
      by_value <- split(remaining, vapply(remaining, function(a) as.character(a$value), character(1)))
      for (val in names(by_value)) {
        grp <- by_value[[val]]
        vars <- vapply(grp, function(a) a$var, character(1))
        if (length(grp) >= 2L && length(unique(vars)) == length(grp)) {
          out <- c(out, list(ast_any_column_equals(unique(vars), val)))
        } else {
          out <- c(out, grp)
        }
      }
    }
    eq_consts <- list()
  }
  if (op == "and" && length(ne_consts) >= 2L) {
    remaining <- list()
    # Primero agrupar por var (misma var → not_in_set).
    by_var <- split(ne_consts, vapply(ne_consts, function(a) a$var, character(1)))
    for (v in names(by_var)) {
      grp <- by_var[[v]]
      if (length(grp) >= 2L) {
        vals <- vapply(grp, function(a) as.character(a$value), character(1))
        if (length(unique(vals)) == length(vals)) {
          out <- c(out, list(ast_not_in_set(v, unique(vals))))
        } else {
          remaining <- c(remaining, grp)
        }
      } else {
        remaining <- c(remaining, grp)
      }
    }
    # Luego intentamos agrupar por valor (vars distintas → all_columns_not_equals).
    if (length(remaining)) {
      by_value <- split(remaining, vapply(remaining, function(a) as.character(a$value), character(1)))
      for (val in names(by_value)) {
        grp <- by_value[[val]]
        vars <- vapply(grp, function(a) a$var, character(1))
        if (length(grp) >= 2L && length(unique(vars)) == length(grp)) {
          out <- c(out, list(ast_all_columns_not_equals(unique(vars), val)))
        } else {
          out <- c(out, grp)
        }
      }
    }
    ne_consts <- list()
  }

  # 6. AND de gte(v, a) + lte(v, b) sobre MISMA var → range_numeric(v, a, b).
  if (op == "and" && length(ranges_gte) >= 1L && length(ranges_lte) >= 1L) {
    by_gte <- split(ranges_gte, vapply(ranges_gte, function(a) a$var, character(1)))
    by_lte <- split(ranges_lte, vapply(ranges_lte, function(a) a$var, character(1)))
    common_vars <- intersect(names(by_gte), names(by_lte))
    for (v in common_vars) {
      gte_node <- by_gte[[v]][[1]]
      lte_node <- by_lte[[v]][[1]]
      gte_val <- suppressWarnings(as.numeric(gte_node$value))
      lte_val <- suppressWarnings(as.numeric(lte_node$value))
      if (!is.na(gte_val) && !is.na(lte_val) && gte_val <= lte_val) {
        out <- c(out, list(ast_range_numeric(v, min = gte_val, max = lte_val, inclusive = TRUE)))
        ranges_gte <- Filter(function(a) a$var != v, ranges_gte)
        ranges_lte <- Filter(function(a) a$var != v, ranges_lte)
      }
    }
  }

  # Agregar los que quedaron sin colapsar.
  out <- c(out, selecteds, not_selecteds, eq_consts, ne_consts, ranges_gte, ranges_lte)
  out
}
