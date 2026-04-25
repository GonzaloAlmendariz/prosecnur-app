# =============================================================================
# Validación AST — primitivas (Capa 0)
# =============================================================================
# Fuente de verdad del nuevo motor de validación: el predicado de una regla
# es un árbol tipado (AST), no un string de código R. Este archivo define:
#
#   - `ast()` — constructor canónico de nodos AST
#   - `ast_op()` / `ast_arg()` — accesores
#   - Los 21 ops soportados (enum cerrado) como constructores `ast_*()`
#   - `ast_is_valid()` — chequeo estructural
#   - `ast_walk()` — recorrido genérico
#   - `ast_hash()` — hash determinístico para dedup
#   - `ast_variables()` — extrae variables referenciadas
#
# Decisiones de diseño:
#   - Un AST es una `list` con atributo `class = "vd_ast"` y `op` en primera
#     posición. Simple, serializable a JSON sin extras.
#   - El enum de ops es CERRADO — agregar uno implica tocar este archivo y
#     los compiladores downstream. Intencional: cualquier caso nuevo debe
#     ser decisión explícita, no colado.
#   - Smart quotes NO se normalizan aquí; eso es trabajo del lex (Capa -1)
#     antes de llegar a primitivas.
#   - `odk_raw` es el escape hatch explícito — cuando una expresión ODK no
#     cabe en el enum tipado, se envuelve así y queda marcada.
#
# Ver `api/R/validacion_ast_normalize.R` para la canonicalización que
# colapsa patrones (OR de selecteds → any_selected, etc.).

# -----------------------------------------------------------------------------
# Enum cerrado de ops
# -----------------------------------------------------------------------------
.AST_OPS <- c(
  # --- Atómicos: nulidad / vacío ------------------------------------------
  "is_missing",           # (var)
  "is_empty_string",      # (var)
  # --- Rangos ------------------------------------------------------------
  "range_numeric",        # (var, min, max, inclusive)
  "range_date",           # (var, min, max, inclusive)
  # --- Catálogo y regex --------------------------------------------------
  "in_set",               # (var, values)
  "not_in_set",           # (var, values)
  "matches_regex",        # (var, pattern)
  # --- Comparaciones -----------------------------------------------------
  "compare_const",        # (var, op, value)   op ∈ ==, !=, <, <=, >, >=
  "compare_vars",         # (var_a, op, var_b)
  # --- Select_multiple ---------------------------------------------------
  "selected",             # (var, value)       ODK: selected(var, 'x')
  "any_selected",         # (var, values)      ODK: OR de selecteds
  "none_selected",        # (var, values)      ODK: negación
  "count_selected_cmp",   # (var, op, n)       ODK: count-selected(.) op n
  "select_multiple_exclusive", # (var, exclusive_codes)  op combinado cardinalidad+exclusividad
  # --- Columnas binarias decompuestas -----------------------------------
  "any_column_equals",    # (cols, value)      P28_2='1' or P28_3='1' ...
  "all_columns_not_equals", # (cols, value)    su negación
  # --- Data quality ------------------------------------------------------
  "duplicate_tuple",      # (vars)
  "outlier_iqr",          # (var, k)
  "outlier_zscore",       # (var, k)
  "straight_line",        # (vars, max_variance)
  # --- Repeats ----------------------------------------------------------
  "repeat_length_matches", # (repeat_name, expected_expr_ast)
  # --- Fecha de captura (today() en constraints) ------------------------
  # Ojo: today() en ODK no es "el día de hoy al validar" — es el día en que
  # el encuestador capturó el formulario. El evaluador resuelve esto a la
  # columna configurada (por default: `end` o `_submission_time`) fila a
  # fila. Se usa para verificar que la fecha reportada en `var` sea
  # coherente con el día de captura (típicamente `var <= today()`).
  "collection_date_cmp",  # (var, op)   op ∈ ==,!=,<,<=,>,>=
  "collection_date_offset_cmp", # (var, op, offset_days) compara contra today()+offset
  # --- Agregación cross-tabla (repeat → principal) ----------------------
  # Compara un valor de la tabla HOST con una agregación sobre una tabla
  # relacionada (típicamente un repeat). El evaluador necesita recibir
  # `data_multi = list(table_name = df, ...)` para poder resolver la tabla
  # fuente. Violación = comparación FALLA.
  #   host_var:   columna en la tabla host (donde vive la regla)
  #   op:         ==, !=, <, <=, >, >=
  #   source_table:     nombre de tabla relacionada (repeat)
  #   source_var:       columna a agregar en esa tabla
  #   agg_op:     sum | count | n_distinct  (paste excluido: no compara numérico)
  #   parent_key_local:  columna en host que identifica la fila padre
  #   parent_key_remote: columna en source_table que apunta al padre
  "aggregate_cmp",
  # --- Combinadores -----------------------------------------------------
  "and",                  # (args: list<ast>)
  "or",                   # (args: list<ast>)
  "not",                  # (arg: ast)
  "if_then",              # (condition: ast, consequence: ast)  — violación cuando cond=T y cons=F
  # --- Triviales --------------------------------------------------------
  "always_true",
  "always_false",
  # --- Escape hatch -----------------------------------------------------
  "odk_raw"               # (expression: chr, origin: chr)  — no canonicalizable
)

#' Enumera los ops soportados por el AST.
#' @export
ast_supported_ops <- function() .AST_OPS

# -----------------------------------------------------------------------------
# Constructor canónico + accesores
# -----------------------------------------------------------------------------
#' Construye un nodo AST.
#'
#' @param .op  string con nombre del op (debe estar en `ast_supported_ops()`).
#'   Usa leading dot para evitar colisión cuando un constructor pasa un arg
#'   llamado `op` (p.ej. `ast_compare_const` pasa `op = "!="`).
#' @param ... argumentos nombrados específicos del op.
#' @return lista con `class = c("vd_ast", "list")`.
#' @export
ast <- function(.op, ...) {
  if (!is.character(.op) || length(.op) != 1L) {
    stop("ast(): .op debe ser string de largo 1.")
  }
  if (!(.op %in% .AST_OPS)) {
    stop(sprintf("ast(): op '%s' no soportado. Válidos: %s",
                 .op, paste(.AST_OPS, collapse = ", ")))
  }
  args <- list(...)
  # No permitimos args posicionales — todos deben tener nombre. El 'op' del
  # AST vive como atributo, no mezclado con args.
  if (length(args) && (is.null(names(args)) || any(!nzchar(names(args))))) {
    stop(sprintf("ast('%s'): todos los args deben ser nombrados.", .op))
  }
  node <- args
  attr(node, "op") <- .op
  class(node) <- c("vd_ast", "list")
  node
}

#' @export
ast_op <- function(x) {
  if (!inherits(x, "vd_ast")) stop("ast_op(): x no es vd_ast.")
  attr(x, "op")
}

#' @export
ast_arg <- function(x, name, default = NULL) {
  if (!inherits(x, "vd_ast")) stop("ast_arg(): x no es vd_ast.")
  if (is.null(x[[name]])) return(default)
  x[[name]]
}

#' @export
is_ast <- function(x) inherits(x, "vd_ast")

# -----------------------------------------------------------------------------
# Constructores específicos (uno por op) — API preferida sobre `ast()` suelto.
# Son thin wrappers que validan args y devuelven el nodo.
# -----------------------------------------------------------------------------
#' @export
ast_is_missing <- function(var) {
  .check_var(var)
  ast("is_missing", var = var)
}

#' @export
ast_is_empty_string <- function(var) {
  .check_var(var)
  ast("is_empty_string", var = var)
}

#' @export
ast_range_numeric <- function(var, min = NULL, max = NULL, inclusive = TRUE) {
  .check_var(var)
  if (is.null(min) && is.null(max)) {
    stop("ast_range_numeric(): min o max requerido.")
  }
  if (!is.null(min) && !is.null(max) && is.numeric(min) && is.numeric(max) && min > max) {
    stop(sprintf("ast_range_numeric(): min (%s) > max (%s).", min, max))
  }
  ast("range_numeric", var = var, min = min, max = max, inclusive = isTRUE(inclusive))
}

#' @export
ast_range_date <- function(var, min = NULL, max = NULL, inclusive = TRUE) {
  .check_var(var)
  if (is.null(min) && is.null(max)) {
    stop("ast_range_date(): min o max requerido.")
  }
  ast("range_date",
      var = var,
      min = if (!is.null(min)) as.character(as.Date(min)) else NULL,
      max = if (!is.null(max)) as.character(as.Date(max)) else NULL,
      inclusive = isTRUE(inclusive))
}

#' @export
ast_in_set <- function(var, values) {
  .check_var(var); .check_values(values)
  ast("in_set", var = var, values = as.character(values))
}

#' @export
ast_not_in_set <- function(var, values) {
  .check_var(var); .check_values(values)
  ast("not_in_set", var = var, values = as.character(values))
}

#' @export
ast_matches_regex <- function(var, pattern) {
  .check_var(var)
  if (!is.character(pattern) || length(pattern) != 1L) {
    stop("ast_matches_regex(): pattern debe ser string.")
  }
  # Validar que sea regex parseable en R (detecta patterns rotos pronto).
  ok <- tryCatch({ grepl(pattern, "x"); TRUE }, error = function(e) FALSE)
  if (!ok) stop(sprintf("ast_matches_regex(): pattern inválido: %s", pattern))
  ast("matches_regex", var = var, pattern = pattern)
}

.BINOP_CMP <- c("==", "!=", "<", "<=", ">", ">=")

#' @export
ast_compare_const <- function(var, op, value) {
  .check_var(var)
  if (!(op %in% .BINOP_CMP)) {
    stop(sprintf("ast_compare_const(): op '%s' inválido. Válidos: %s",
                 op, paste(.BINOP_CMP, collapse = ", ")))
  }
  ast("compare_const", var = var, op = op, value = value)
}

#' @export
ast_compare_vars <- function(var_a, op, var_b) {
  .check_var(var_a); .check_var(var_b)
  if (!(op %in% .BINOP_CMP)) {
    stop(sprintf("ast_compare_vars(): op '%s' inválido.", op))
  }
  ast("compare_vars", var_a = var_a, op = op, var_b = var_b)
}

#' @export
ast_selected <- function(var, value) {
  .check_var(var)
  ast("selected", var = var, value = as.character(value))
}

#' @export
ast_any_selected <- function(var, values) {
  .check_var(var); .check_values(values)
  ast("any_selected", var = var, values = as.character(values))
}

#' @export
ast_none_selected <- function(var, values) {
  .check_var(var); .check_values(values)
  ast("none_selected", var = var, values = as.character(values))
}

#' @export
ast_count_selected_cmp <- function(var, op, n) {
  .check_var(var)
  if (!(op %in% .BINOP_CMP)) {
    stop(sprintf("ast_count_selected_cmp(): op '%s' inválido.", op))
  }
  if (!is.numeric(n) || length(n) != 1L) stop("ast_count_selected_cmp(): n debe ser número.")
  ast("count_selected_cmp", var = var, op = op, n = as.integer(n))
}

#' @export
ast_select_multiple_exclusive <- function(var, exclusive_codes, max_others = NULL) {
  .check_var(var)
  if (!length(exclusive_codes)) stop("ast_select_multiple_exclusive(): exclusive_codes vacío.")
  ast("select_multiple_exclusive",
      var = var,
      exclusive_codes = as.character(exclusive_codes),
      max_others = if (is.null(max_others)) NULL else as.integer(max_others))
}

#' @export
ast_any_column_equals <- function(cols, value) {
  .check_values(cols)
  ast("any_column_equals", cols = as.character(cols), value = as.character(value))
}

#' @export
ast_all_columns_not_equals <- function(cols, value) {
  .check_values(cols)
  ast("all_columns_not_equals", cols = as.character(cols), value = as.character(value))
}

#' @export
ast_duplicate_tuple <- function(vars) {
  if (!length(vars)) stop("ast_duplicate_tuple(): vars vacío.")
  ast("duplicate_tuple", vars = as.character(vars))
}

#' @export
ast_outlier_iqr <- function(var, k = 1.5) {
  .check_var(var)
  if (!is.numeric(k) || k <= 0) stop("ast_outlier_iqr(): k debe ser número > 0.")
  ast("outlier_iqr", var = var, k = as.numeric(k))
}

#' @export
ast_outlier_zscore <- function(var, k = 3) {
  .check_var(var)
  if (!is.numeric(k) || k <= 0) stop("ast_outlier_zscore(): k debe ser número > 0.")
  ast("outlier_zscore", var = var, k = as.numeric(k))
}

#' @export
ast_straight_line <- function(vars, max_variance = 0) {
  if (length(vars) < 2L) stop("ast_straight_line(): requiere al menos 2 vars.")
  if (!is.numeric(max_variance) || max_variance < 0) {
    stop("ast_straight_line(): max_variance debe ser >= 0.")
  }
  ast("straight_line", vars = as.character(vars),
      max_variance = as.numeric(max_variance))
}

#' Compara una variable del host contra un agregado de otra tabla (repeat).
#' @param host_var        columna en la tabla host.
#' @param op              ==,!=,<,<=,>,>=
#' @param source_table    nombre de la tabla fuente (repeat).
#' @param source_var      columna a agregar en source_table.
#' @param agg_op          sum | count | n_distinct
#' @param parent_key_local  columna en host con ID de padre (default `_uuid`).
#' @param parent_key_remote columna en source_table que referencia padre
#'                          (default `_parent_index`).
#' @export
ast_aggregate_cmp <- function(host_var, op,
                              source_table, source_var,
                              agg_op = c("sum", "count", "n_distinct"),
                              parent_key_local = "_uuid",
                              parent_key_remote = "_parent_index") {
  .check_var(host_var)
  if (!(op %in% .BINOP_CMP)) {
    stop(sprintf("ast_aggregate_cmp(): op '%s' inválido.", op))
  }
  agg_op <- match.arg(agg_op)
  if (!is.character(source_table) || length(source_table) != 1L || !nzchar(source_table)) {
    stop("ast_aggregate_cmp(): source_table requerido.")
  }
  .check_var(source_var)
  ast("aggregate_cmp",
      host_var = host_var,
      op = op,
      source_table = source_table,
      source_var = source_var,
      agg_op = agg_op,
      parent_key_local = parent_key_local,
      parent_key_remote = parent_key_remote)
}

#' Compara una variable de fecha contra la fecha de captura (today() en ODK).
#' La fecha de captura NO es el día de validación — es el día en que el
#' enumerador guardó el formulario, resuelto por el evaluador desde la
#' columna `end`/`_submission_time` (configurable).
#' @export
ast_collection_date_cmp <- function(var, op) {
  .check_var(var)
  if (!(op %in% .BINOP_CMP)) {
    stop(sprintf("ast_collection_date_cmp(): op '%s' inválido.", op))
  }
  ast("collection_date_cmp", var = var, op = op)
}

#' Compara una fecha contra la fecha de captura con desplazamiento en días.
#' Ejemplo ODK: `. >= today() - 396`.
#' @export
ast_collection_date_offset_cmp <- function(var, op, offset_days) {
  .check_var(var)
  if (!(op %in% .BINOP_CMP)) {
    stop(sprintf("ast_collection_date_offset_cmp(): op '%s' inválido.", op))
  }
  if (!is.numeric(offset_days) || length(offset_days) != 1L || is.na(offset_days)) {
    stop("ast_collection_date_offset_cmp(): offset_days debe ser número.")
  }
  ast("collection_date_offset_cmp",
      var = var,
      op = op,
      offset_days = as.integer(offset_days))
}

#' @export
ast_repeat_length_matches <- function(repeat_name, expected) {
  if (!is.character(repeat_name) || length(repeat_name) != 1L) {
    stop("ast_repeat_length_matches(): repeat_name debe ser string.")
  }
  # expected puede ser: número fijo, nombre de variable, o un sub-AST.
  if (!(is.numeric(expected) || is.character(expected) || is_ast(expected))) {
    stop("ast_repeat_length_matches(): expected debe ser número, var, o AST.")
  }
  ast("repeat_length_matches", repeat_name = repeat_name, expected = expected)
}

# --- Combinadores ------------------------------------------------------------
#' @export
ast_and <- function(...) {
  args <- list(...)
  if (length(args) == 1L && is.list(args[[1]]) && !is_ast(args[[1]])) {
    args <- args[[1]]
  }
  for (a in args) if (!is_ast(a)) stop("ast_and(): todos los args deben ser AST.")
  if (!length(args)) return(ast_always_true())
  if (length(args) == 1L) return(args[[1]])
  ast("and", args = unname(args))
}

#' @export
ast_or <- function(...) {
  args <- list(...)
  if (length(args) == 1L && is.list(args[[1]]) && !is_ast(args[[1]])) {
    args <- args[[1]]
  }
  for (a in args) if (!is_ast(a)) stop("ast_or(): todos los args deben ser AST.")
  if (!length(args)) return(ast_always_false())
  if (length(args) == 1L) return(args[[1]])
  ast("or", args = unname(args))
}

#' @export
ast_not <- function(arg) {
  if (!is_ast(arg)) stop("ast_not(): arg debe ser AST.")
  ast("not", arg = arg)
}

#' @export
ast_if_then <- function(condition, consequence) {
  if (!is_ast(condition) || !is_ast(consequence)) {
    stop("ast_if_then(): condition y consequence deben ser AST.")
  }
  ast("if_then", condition = condition, consequence = consequence)
}

#' @export
ast_always_true  <- function() ast("always_true")
#' @export
ast_always_false <- function() ast("always_false")

#' @export
ast_odk_raw <- function(expression, origin = NA_character_) {
  if (!is.character(expression) || length(expression) != 1L) {
    stop("ast_odk_raw(): expression debe ser string.")
  }
  ast("odk_raw", expression = expression, origin = as.character(origin))
}

# -----------------------------------------------------------------------------
# Validación estructural
# -----------------------------------------------------------------------------
#' Verifica que un AST esté bien formado.
#' @return lista: `ok` (logical), `errors` (character vector).
#' @export
ast_is_valid <- function(x) {
  errors <- character()
  .check_node <- function(node, path = "$") {
    if (!is_ast(node)) {
      errors <<- c(errors, sprintf("%s: no es AST", path))
      return(invisible())
    }
    op <- ast_op(node)
    if (!(op %in% .AST_OPS)) {
      errors <<- c(errors, sprintf("%s: op '%s' desconocido", path, op))
      return(invisible())
    }
    req <- .ast_required_args(op)
    for (r in req) {
      if (is.null(node[[r]])) {
        errors <<- c(errors, sprintf("%s (%s): falta arg '%s'", path, op, r))
      }
    }
    # Recurse en args que sean AST
    for (nm in names(node)) {
      v <- node[[nm]]
      if (is_ast(v)) .check_node(v, paste0(path, ".", nm))
      else if (is.list(v) && nm == "args") {
        for (i in seq_along(v)) .check_node(v[[i]], sprintf("%s.args[%d]", path, i))
      }
    }
  }
  .check_node(x)
  list(ok = !length(errors), errors = errors)
}

.ast_required_args <- function(op) {
  switch(op,
    "is_missing"               = "var",
    "is_empty_string"          = "var",
    "range_numeric"            = "var",
    "range_date"               = "var",
    "in_set"                   = c("var", "values"),
    "not_in_set"               = c("var", "values"),
    "matches_regex"            = c("var", "pattern"),
    "compare_const"            = c("var", "op", "value"),
    "compare_vars"             = c("var_a", "op", "var_b"),
    "selected"                 = c("var", "value"),
    "any_selected"             = c("var", "values"),
    "none_selected"            = c("var", "values"),
    "count_selected_cmp"       = c("var", "op", "n"),
    "select_multiple_exclusive"= c("var", "exclusive_codes"),
    "any_column_equals"        = c("cols", "value"),
    "all_columns_not_equals"   = c("cols", "value"),
    "duplicate_tuple"          = "vars",
    "outlier_iqr"              = c("var", "k"),
    "outlier_zscore"           = c("var", "k"),
    "straight_line"            = c("vars", "max_variance"),
    "repeat_length_matches"    = c("repeat_name", "expected"),
    "collection_date_cmp"      = c("var", "op"),
    "collection_date_offset_cmp" = c("var", "op", "offset_days"),
    "aggregate_cmp"            = c("host_var", "op", "source_table", "source_var", "agg_op"),
    "and"                      = "args",
    "or"                       = "args",
    "not"                      = "arg",
    "if_then"                  = c("condition", "consequence"),
    "always_true"              = character(0),
    "always_false"             = character(0),
    "odk_raw"                  = "expression",
    character(0)
  )
}

# -----------------------------------------------------------------------------
# Walker genérico
# -----------------------------------------------------------------------------
#' Recorre un AST en pre-order, llamando `fn(node, path)` en cada nodo.
#' @param fn function(node, path) — retorno ignorado.
#' @export
ast_walk <- function(x, fn, path = "$") {
  if (!is_ast(x)) return(invisible())
  fn(x, path)
  for (nm in names(x)) {
    v <- x[[nm]]
    if (is_ast(v)) {
      ast_walk(v, fn, paste0(path, ".", nm))
    } else if (is.list(v) && nm == "args") {
      for (i in seq_along(v)) {
        ast_walk(v[[i]], fn, sprintf("%s.args[%d]", path, i))
      }
    }
  }
  invisible()
}

#' Aplica `fn(node)` a cada nodo y retorna el AST transformado (post-order).
#' `fn` puede devolver un AST distinto; si devuelve NULL se usa el original.
#' @export
ast_map <- function(x, fn) {
  if (!is_ast(x)) return(x)
  # Recurse en args primero (post-order).
  mapped <- x
  for (nm in names(mapped)) {
    v <- mapped[[nm]]
    if (is_ast(v)) {
      mapped[[nm]] <- ast_map(v, fn)
    } else if (is.list(v) && nm == "args") {
      mapped[[nm]] <- lapply(v, function(sub) {
        if (is_ast(sub)) ast_map(sub, fn) else sub
      })
    }
  }
  out <- fn(mapped)
  if (is.null(out)) mapped else out
}

# -----------------------------------------------------------------------------
# Hash determinístico (para dedup y registry)
# -----------------------------------------------------------------------------
#' Hash estable del AST, independiente del orden de args en AND/OR.
#' @export
ast_hash <- function(x) {
  if (!requireNamespace("digest", quietly = TRUE)) {
    stop("ast_hash(): paquete 'digest' requerido.")
  }
  canonical <- .ast_canonical_for_hash(x)
  digest::digest(canonical, algo = "xxhash64", serialize = TRUE)
}

.ast_canonical_for_hash <- function(x) {
  if (!is_ast(x)) return(x)
  op <- ast_op(x)
  payload <- list(op = op)
  # Ordena args de AND/OR para que sean hash-invariant por orden.
  for (nm in sort(names(x))) {
    v <- x[[nm]]
    if (is_ast(v)) {
      payload[[nm]] <- .ast_canonical_for_hash(v)
    } else if (is.list(v) && nm == "args") {
      subs <- lapply(v, .ast_canonical_for_hash)
      # Ordena por hash interno para que and(a, b) == and(b, a).
      if (op %in% c("and", "or")) {
        keys <- vapply(subs, function(s) {
          digest::digest(s, algo = "xxhash64", serialize = TRUE)
        }, character(1))
        subs <- subs[order(keys)]
      }
      payload[[nm]] <- subs
    } else {
      # Ordena values/cols como sets para consistencia.
      if (nm %in% c("values", "cols", "exclusive_codes") && is.character(v)) {
        payload[[nm]] <- sort(unique(v))
      } else {
        payload[[nm]] <- v
      }
    }
  }
  payload
}

# -----------------------------------------------------------------------------
# Extracción de variables referenciadas
# -----------------------------------------------------------------------------
#' Retorna el vector de nombres de variable que aparecen en el AST.
#' @export
ast_variables <- function(x) {
  vars <- character()
  ast_walk(x, function(node, path) {
    op <- ast_op(node)
    for (key in c("var", "var_a", "var_b")) {
      v <- node[[key]]
      if (is.character(v) && length(v) == 1L && nzchar(v)) vars <<- c(vars, v)
    }
    for (key in c("vars", "cols")) {
      v <- node[[key]]
      if (is.character(v)) vars <<- c(vars, v)
    }
  })
  unique(vars)
}

# -----------------------------------------------------------------------------
# Helpers internos de validación
# -----------------------------------------------------------------------------
.check_var <- function(var) {
  if (!is.character(var) || length(var) != 1L || !nzchar(var)) {
    stop("var debe ser string no vacío.")
  }
}

.check_values <- function(values) {
  if (!length(values)) stop("values/cols no puede estar vacío.")
}

# -----------------------------------------------------------------------------
# Pretty-print (para depuración)
# -----------------------------------------------------------------------------
#' @export
print.vd_ast <- function(x, ...) {
  cat(ast_to_string(x), "\n")
  invisible(x)
}

#' Representación textual compacta de un AST (no es R ejecutable — es para leer).
#' @export
ast_to_string <- function(x, indent = 0) {
  if (!is_ast(x)) return(format(x))
  op <- ast_op(x)
  pad <- strrep("  ", indent)
  # Formatos compactos por op
  if (op %in% c("always_true", "always_false")) {
    return(paste0(pad, op, "()"))
  }
  if (op == "and" || op == "or") {
    subs <- vapply(x$args, ast_to_string, character(1), indent = indent + 1)
    return(paste0(pad, op, "(\n", paste(subs, collapse = ",\n"), "\n", pad, ")"))
  }
  if (op == "not") {
    return(paste0(pad, "not(", ast_to_string(x$arg, 0), ")"))
  }
  if (op == "if_then") {
    return(paste0(pad, "if_then(\n",
                  ast_to_string(x$condition, indent + 1), " ⇒\n",
                  ast_to_string(x$consequence, indent + 1), "\n", pad, ")"))
  }
  # Default: op(arg1=v1, arg2=v2, ...)
  parts <- character()
  for (nm in names(x)) {
    v <- x[[nm]]
    if (is_ast(v)) parts <- c(parts, paste0(nm, "=", ast_to_string(v, 0)))
    else if (is.character(v) && length(v) > 1L) {
      parts <- c(parts, paste0(nm, "=[", paste(v, collapse = ","), "]"))
    } else {
      parts <- c(parts, paste0(nm, "=", format(v)))
    }
  }
  paste0(pad, op, "(", paste(parts, collapse = ", "), ")")
}
