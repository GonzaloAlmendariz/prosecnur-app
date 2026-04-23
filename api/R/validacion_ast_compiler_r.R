# =============================================================================
# Validación AST — compilador AST → R (Capa 2)
# =============================================================================
# Convierte un AST en un string de código R que:
#   - Devuelve vector lógico del mismo largo que el data.frame evaluado
#   - TRUE = inconsistencia (predicado se cumple)
#   - Puede usarse como el `rhs` del Procesamiento tradicional
#     (Procesamiento = "<flag_name> <- <rhs>")
#
# Ejemplos de salida:
#   ast_is_missing("edad")           → "(is.na(edad) | as.character(edad) == '' | as.character(edad) == 'NA')"
#   ast_range_numeric("edad",0,120)  → "(!is.na(suppressWarnings(as.numeric(edad))) & (suppressWarnings(as.numeric(edad)) < 0 | suppressWarnings(as.numeric(edad)) > 120))"
#
# El evaluador luego hace `parse(text=rhs)` y `eval_bare` en un entorno con
# las columnas del data.frame. Mismo contrato que el motor heredado.

#' Compila un AST a string de código R.
#' @export
ast_to_r <- function(x) {
  if (!is_ast(x)) stop("ast_to_r(): x no es AST.")
  .compile(x)
}

.compile <- function(x) {
  op <- ast_op(x)
  switch(op,
    "is_missing"               = .c_is_missing(x$var),
    "is_empty_string"          = .c_is_empty(x$var),
    "range_numeric"            = .c_range_num(x$var, x$min, x$max, x$inclusive),
    "range_date"               = .c_range_date(x$var, x$min, x$max, x$inclusive),
    "in_set"                   = .c_in_set(x$var, x$values),
    "not_in_set"               = .c_not_in_set(x$var, x$values),
    "matches_regex"            = .c_regex(x$var, x$pattern),
    "compare_const"            = .c_cmp_const(x$var, x$op, x$value),
    "compare_vars"             = .c_cmp_vars(x$var_a, x$op, x$var_b),
    "selected"                 = .c_selected(x$var, x$value),
    "any_selected"             = .c_any_selected(x$var, x$values),
    "none_selected"            = .c_none_selected(x$var, x$values),
    "count_selected_cmp"       = .c_count_sel_cmp(x$var, x$op, x$n),
    "select_multiple_exclusive"= .c_sm_exclusive(x$var, x$exclusive_codes, x$max_others),
    "any_column_equals"        = .c_any_col_eq(x$cols, x$value),
    "all_columns_not_equals"   = .c_all_cols_ne(x$cols, x$value),
    "duplicate_tuple"          = .c_dup_tuple(x$vars),
    "outlier_iqr"              = .c_outlier_iqr(x$var, x$k),
    "outlier_zscore"           = .c_outlier_z(x$var, x$k),
    "straight_line"            = .c_straight_line(x$vars, x$max_variance),
    "repeat_length_matches"    = .c_repeat_length(x$repeat_name, x$expected),
    "and"                      = .c_bool("and", x$args),
    "or"                       = .c_bool("or",  x$args),
    "not"                      = paste0("!(", .compile(x$arg), ")"),
    "if_then"                  = .c_if_then(x$condition, x$consequence),
    "always_true"              = "TRUE",
    "always_false"             = "FALSE",
    "odk_raw"                  = .c_raw(x$expression),
    stop(sprintf("ast_to_r(): op '%s' no tiene compilador.", op))
  )
}

# -----------------------------------------------------------------------------
# Compiladores por op
# -----------------------------------------------------------------------------
.c_is_missing <- function(var) {
  sprintf("(is.na(%s) | as.character(%s) == '' | as.character(%s) == 'NA')",
          var, var, var)
}

.c_is_empty <- function(var) {
  sprintf("(is.na(%s) | trimws(as.character(%s)) == '')", var, var)
}

.c_range_num <- function(var, min, max, inclusive) {
  xnum <- sprintf("suppressWarnings(as.numeric(%s))", var)
  ops_exclude <- if (isTRUE(inclusive)) c("<", ">") else c("<=", ">=")
  parts <- character()
  if (!is.null(min)) parts <- c(parts, sprintf("%s %s %s", xnum, ops_exclude[1], .lit_num(min)))
  if (!is.null(max)) parts <- c(parts, sprintf("%s %s %s", xnum, ops_exclude[2], .lit_num(max)))
  cond <- paste(parts, collapse = " | ")
  sprintf("(!is.na(%s) & (%s))", xnum, cond)
}

.c_range_date <- function(var, min, max, inclusive) {
  xd <- sprintf("suppressWarnings(as.Date(%s))", var)
  ops_exclude <- if (isTRUE(inclusive)) c("<", ">") else c("<=", ">=")
  parts <- character()
  if (!is.null(min)) parts <- c(parts, sprintf("%s %s as.Date('%s')", xd, ops_exclude[1], as.character(min)))
  if (!is.null(max)) parts <- c(parts, sprintf("%s %s as.Date('%s')", xd, ops_exclude[2], as.character(max)))
  cond <- paste(parts, collapse = " | ")
  sprintf("(!is.na(%s) & (%s))", xd, cond)
}

.c_in_set <- function(var, values) {
  sprintf("(!is.na(%s) & (as.character(%s) %%in%% %s))",
          var, var, .lit_char_vec(values))
}

.c_not_in_set <- function(var, values) {
  sprintf("(!is.na(%s) & !(as.character(%s) %%in%% %s))",
          var, var, .lit_char_vec(values))
}

.c_regex <- function(var, pattern) {
  sprintf("(!is.na(%s) & grepl(%s, as.character(%s)))",
          var, .lit_str(pattern), var)
}

.c_cmp_const <- function(var, op, value) {
  vnum <- suppressWarnings(as.numeric(value))
  if (!is.na(vnum) && !is.logical(value)) {
    # Comparación numérica
    sprintf("(!is.na(%s) & suppressWarnings(as.numeric(%s)) %s %s)",
            var, var, op, vnum)
  } else {
    sprintf("(!is.na(%s) & as.character(%s) %s %s)",
            var, var, op, .lit_str(as.character(value)))
  }
}

.c_cmp_vars <- function(va, op, vb) {
  # Intenta comparación numérica si ambos parecen numéricos al eval — decidimos
  # siempre numérico porque ODK hace coerción. Si el usuario necesita string
  # usa compare_const con valor literal.
  sprintf(
    "(!is.na(%s) & !is.na(%s) & suppressWarnings(as.numeric(%s)) %s suppressWarnings(as.numeric(%s)))",
    va, vb, va, op, vb
  )
}

.c_selected <- function(var, value) {
  # ODK selected(var, 'x'): TRUE si 'x' está en la lista de tokens del valor.
  # El data export suele venir como string con valores separados por espacio.
  sprintf("(!is.na(%s) & grepl(sprintf('(^| )%%s( |$)', %s), as.character(%s)))",
          var, .lit_str(as.character(value)), var)
}

.c_any_selected <- function(var, values) {
  # Vectorizado: alguna de `values` está en la lista del valor.
  literals <- paste(vapply(values, function(v) {
    sprintf("grepl(sprintf('(^| )%%s( |$)', %s), as.character(%s))",
            .lit_str(as.character(v)), var)
  }, character(1)), collapse = " | ")
  sprintf("(!is.na(%s) & (%s))", var, literals)
}

.c_none_selected <- function(var, values) {
  literals <- paste(vapply(values, function(v) {
    sprintf("grepl(sprintf('(^| )%%s( |$)', %s), as.character(%s))",
            .lit_str(as.character(v)), var)
  }, character(1)), collapse = " | ")
  sprintf("(!is.na(%s) & !(%s))", var, literals)
}

.c_count_sel_cmp <- function(var, op, n) {
  # count-selected(.): cuenta tokens separados por espacio.
  sprintf(
    "(!is.na(%s) & lengths(strsplit(trimws(as.character(%s)), '\\\\s+')) %s %d)",
    var, var, op, as.integer(n)
  )
}

.c_sm_exclusive <- function(var, exclusive_codes, max_others) {
  # Violación si:
  #   (a) algún código exclusivo está seleccionado Y hay más de 1 seleccionado total
  #   (b) más de 1 exclusivo está seleccionado simultáneamente
  #   (c) (opcional) max_others excedido
  parts <- character()
  count_expr <- sprintf("lengths(strsplit(trimws(as.character(%s)), '\\\\s+'))", var)
  any_excl <- paste(vapply(exclusive_codes, function(v) {
    sprintf("grepl(sprintf('(^| )%%s( |$)', %s), as.character(%s))",
            .lit_str(as.character(v)), var)
  }, character(1)), collapse = " | ")
  # (a): si hay exclusivo Y total > 1
  parts <- c(parts, sprintf("((%s) & %s > 1)", any_excl, count_expr))
  # (b): >= 2 exclusivos seleccionados
  if (length(exclusive_codes) >= 2L) {
    counted_exclusives <- paste(vapply(exclusive_codes, function(v) {
      sprintf("as.integer(grepl(sprintf('(^| )%%s( |$)', %s), as.character(%s)))",
              .lit_str(as.character(v)), var)
    }, character(1)), collapse = " + ")
    parts <- c(parts, sprintf("((%s) >= 2)", counted_exclusives))
  }
  # (c): max_others
  if (!is.null(max_others) && !is.na(max_others)) {
    non_excl_count <- sprintf("(%s - (%s))", count_expr,
      paste(vapply(exclusive_codes, function(v) {
        sprintf("as.integer(grepl(sprintf('(^| )%%s( |$)', %s), as.character(%s)))",
                .lit_str(as.character(v)), var)
      }, character(1)), collapse = " + ")
    )
    parts <- c(parts, sprintf("(%s > %d)", non_excl_count, as.integer(max_others)))
  }
  sprintf("(!is.na(%s) & (%s))", var, paste(parts, collapse = " | "))
}

.c_any_col_eq <- function(cols, value) {
  # any_column_equals: alguna de las columnas == value.
  parts <- vapply(cols, function(c) {
    sprintf("(!is.na(%s) & as.character(%s) == %s)",
            c, c, .lit_str(as.character(value)))
  }, character(1))
  sprintf("(%s)", paste(parts, collapse = " | "))
}

.c_all_cols_ne <- function(cols, value) {
  parts <- vapply(cols, function(c) {
    sprintf("(is.na(%s) | as.character(%s) != %s)",
            c, c, .lit_str(as.character(value)))
  }, character(1))
  sprintf("(%s)", paste(parts, collapse = " & "))
}

.c_dup_tuple <- function(vars) {
  if (length(vars) == 1L) {
    clave <- sprintf("as.character(%s)", vars[1])
  } else {
    parts <- vapply(vars, function(v) sprintf("as.character(%s)", v), character(1))
    # Separador U+241F (SYMBOL FOR UNIT SEPARATOR) — muy improbable en datos.
    clave <- sprintf("paste(%s, sep = '\\u241F')", paste(parts, collapse = ", "))
  }
  sprintf("{ .k_ <- %s; .n_ <- stats::ave(seq_along(.k_), .k_, FUN = length); .n_ > 1 }",
          clave)
}

.c_outlier_iqr <- function(var, k) {
  xnum <- sprintf("suppressWarnings(as.numeric(%s))", var)
  sprintf(
    paste0("{ .x_ <- %s; .qq_ <- stats::quantile(.x_, c(.25, .75), na.rm = TRUE); ",
           ".iqr_ <- diff(.qq_); (!is.na(.x_) & (.x_ < .qq_[1] - %g * .iqr_ | .x_ > .qq_[2] + %g * .iqr_)) }"),
    xnum, k, k
  )
}

.c_outlier_z <- function(var, k) {
  xnum <- sprintf("suppressWarnings(as.numeric(%s))", var)
  sprintf(
    paste0("{ .x_ <- %s; .m_ <- mean(.x_, na.rm = TRUE); ",
           ".sd_ <- stats::sd(.x_, na.rm = TRUE); ",
           "(!is.na(.x_) & .sd_ > 0 & abs((.x_ - .m_) / .sd_) > %g) }"),
    xnum, k
  )
}

.c_straight_line <- function(vars, max_variance) {
  # Calcula varianza por fila sobre las columnas. TRUE si var <= max_variance.
  # Usa apply sobre un cbind de los vectores — sirve para detectar Likert "todas iguales".
  cols_lit <- paste(vars, collapse = ", ")
  sprintf(
    "{ .m_ <- cbind(%s); .m_ <- apply(.m_, 2, function(c) suppressWarnings(as.numeric(as.character(c)))); .v_ <- apply(.m_, 1, stats::var, na.rm = TRUE); (!is.na(.v_) & .v_ <= %g) }",
    cols_lit, as.numeric(max_variance)
  )
}

.c_repeat_length <- function(repeat_name, expected) {
  # Este op requiere evaluador con awareness de tabla repeat. Aquí se
  # compila a un marcador que el evaluador AST captura. No genera R puro.
  # Se retorna un stub que, de llegar al evaluador heredado, genera error
  # claro.
  exp_repr <- if (is_ast(expected)) ast_to_string(expected) else format(expected)
  sprintf("stop('repeat_length_matches requiere evaluador AST — repeat=%s, expected=%s')",
          repeat_name, exp_repr)
}

.c_bool <- function(op, args) {
  if (!length(args)) return(if (op == "and") "TRUE" else "FALSE")
  compiled <- vapply(args, .compile, character(1))
  sep <- if (op == "and") " & " else " | "
  paste0("(", paste(compiled, collapse = sep), ")")
}

.c_if_then <- function(condition, consequence) {
  # Violación = condición TRUE pero consecuencia FALSE.
  sprintf("((%s) & !(%s))", .compile(condition), .compile(consequence))
}

.c_raw <- function(expr) {
  # Escape hatch: usamos el ODK raw tal cual — el evaluador heredado
  # intentará reescribirlo con sus gsub tradicionales.
  paste0("(", expr, ")")
}

# -----------------------------------------------------------------------------
# Literales
# -----------------------------------------------------------------------------
.lit_str <- function(s) {
  s <- gsub("\\\\", "\\\\\\\\", as.character(s), perl = FALSE)
  s <- gsub("'", "\\\\'", s, fixed = FALSE)
  paste0("'", s, "'")
}

.lit_num <- function(n) {
  if (is.null(n) || is.na(n)) return("NA")
  format(as.numeric(n), nsmall = 0, scientific = FALSE)
}

.lit_char_vec <- function(v) {
  if (!length(v)) return("character(0)")
  parts <- vapply(v, .lit_str, character(1))
  paste0("c(", paste(parts, collapse = ", "), ")")
}
