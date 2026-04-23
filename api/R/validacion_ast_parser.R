# =============================================================================
# Validación AST — parser ODK → AST (Capa 2b)
# =============================================================================
# Convierte una expresión ODK (de relevant/constraint/calculate) a un AST
# tipado. Patrones manejados (documentados contra los 4 XLSForms reales):
#
#   Sustituciones léxicas (via odk_normalize_lex): smart quotes, NBSP, etc.
#   Referencias a variable:  ${var}                   → var
#   Literales:                'x', "x", 123, 3.14      → string/number node
#   Comparación:              ${v} = 'x' | != | > | >= → compare_const
#   Comparación cruzada:      ${v1} > ${v2}            → compare_vars
#   Lógica:                   and, or, not             → ast_and/or/not
#   Selecteds:                selected(${v}, 'x')      → ast_selected
#   Cuenta seleccionados:     count-selected(.) > 3    → count_selected_cmp
#   Regex:                    regex(., '^\\d+$')       → matches_regex
#   Referencia de salto:      ${v} != '' (relevant)    → not(is_missing(v))
#   Empty compare:            ${v} = ''                → is_missing
#   today():                  . <= today()             → compare_const con ref
#   pulldata(...):                                     → ast_odk_raw (se filtra
#                                                         en introspección; la
#                                                         regla entera se descarta)
#
# Patrones fuera de scope (caen a odk_raw):
#   indexed-repeat, position(..), jr:choice-name, coalesce,
#   selected-at, once(), format-date, decimal-date, string-length
#
# Para el contexto de constraint, `.` se refiere a la variable definida en
# la misma fila del XLSForm (el "self"). El caller debe pasar `self_var`.

# -----------------------------------------------------------------------------
# API principal
# -----------------------------------------------------------------------------
#' Parsea una expresión ODK a AST.
#'
#' @param expr        character(1) — expresión ODK (puede traer smart quotes).
#' @param context     "relevant" | "constraint" | "calculate" | "choice_filter"
#' @param self_var    character(1) — variable actual (usada para `.` en constraints).
#'                    Requerida si `context = "constraint"`.
#' @param strict      si TRUE, expresiones no parseables → error. Si FALSE (default),
#'                    caen a ast_odk_raw.
#' @return list(ast, findings, degraded_to_raw) — findings del lex normalizer;
#'         degraded_to_raw TRUE si el parseo cayó al escape hatch.
#' @export
odk_parse_to_ast <- function(expr, context = c("relevant", "constraint", "calculate", "choice_filter"),
                             self_var = NULL, strict = FALSE) {
  context <- match.arg(context)
  if (context == "constraint" && (is.null(self_var) || !nzchar(self_var))) {
    # Se tolera — si aparece `.` en el expr, caerá a raw si no se puede resolver.
    self_var <- NA_character_
  }

  if (is.null(expr) || is.na(expr) || !nzchar(expr)) {
    return(list(ast = ast_always_true(), findings = list(), degraded_to_raw = FALSE))
  }

  # 1. Normalización léxica (Capa -1).
  lex <- odk_normalize_lex(expr, report = TRUE)
  norm <- lex$text

  # 2. Shortcut: si contiene pulldata, la regla entera se descarta — el caller
  #    debe interpretar degraded_to_raw=TRUE + origin="pulldata" como "skip".
  if (grepl("\\bpulldata\\s*\\(", norm)) {
    return(list(
      ast = ast_odk_raw(norm, origin = "pulldata"),
      findings = lex$findings,
      degraded_to_raw = TRUE
    ))
  }

  # 3. Pre-expansión de `${var}` → tokens especiales `__V__var`.
  #    Esto evita que el tokenizador se confunda con el `$` y `{`.
  pre <- .expand_var_refs(norm)

  # 4. Parsing propiamente. Intentamos AST tipado; si falla, caemos a raw.
  parsed <- tryCatch(
    .parse_expr(pre, context = context, self_var = self_var),
    error = function(e) NULL
  )

  if (is.null(parsed) || is.null(parsed$ast)) {
    if (strict) stop(sprintf("odk_parse_to_ast(): no pude parsear: %s", norm))
    return(list(
      ast = ast_odk_raw(norm, origin = sprintf("unparseable:%s", context)),
      findings = lex$findings,
      degraded_to_raw = TRUE
    ))
  }

  list(
    ast = ast_normalize(parsed$ast),
    findings = lex$findings,
    degraded_to_raw = FALSE
  )
}

# -----------------------------------------------------------------------------
# Pre-expansión de ${var} → __V__var
# -----------------------------------------------------------------------------
.expand_var_refs <- function(s) {
  # Reemplaza ${foo_bar} → __V__foo_bar. Soporta nombres con _ y alfanuméricos.
  out <- gsub("\\$\\{([A-Za-z_][A-Za-z0-9_]*)\\}", "__V__\\1", s, perl = TRUE)
  # Si quedan $ sueltos (rarísimo, caso mal formado), los normalizamos a cadena.
  out
}

.unexpand_var <- function(tok) {
  sub("^__V__", "", tok)
}

.is_var_token <- function(tok) {
  grepl("^__V__", tok)
}

# -----------------------------------------------------------------------------
# Tokenizer ODK
# -----------------------------------------------------------------------------
# Produce lista de tokens con {type, value}. Types:
#   "var", "str", "num", "dot", "ident", "lparen", "rparen", "comma", "op_bin"
#   "and", "or", "not", "plus_minus"
# -----------------------------------------------------------------------------
.tokenize <- function(s) {
  tokens <- list()
  i <- 1L
  n <- nchar(s)
  chars <- strsplit(s, "", fixed = TRUE)[[1]]

  push <- function(type, value) {
    tokens[[length(tokens) + 1L]] <<- list(type = type, value = value)
  }

  is_digit <- function(c) grepl("[0-9]", c)
  is_alpha <- function(c) grepl("[A-Za-z_]", c)
  is_alnum <- function(c) grepl("[A-Za-z0-9_:-]", c)  # permite : (jr:choice-name) y - (count-selected)

  while (i <= n) {
    c <- chars[i]
    # Espacios
    if (grepl("\\s", c)) { i <- i + 1L; next }

    # Strings
    if (c == "'" || c == "\"") {
      quote <- c
      i <- i + 1L
      start <- i
      while (i <= n && chars[i] != quote) {
        # Escape básico: \x dentro del string
        if (chars[i] == "\\" && i < n) i <- i + 1L
        i <- i + 1L
      }
      # Caso vacío ('' o ""): start > i-1, paste con slice invertido daría c(start, start-1).
      val <- if (i > start) paste(chars[start:(i - 1L)], collapse = "") else ""
      push("str", val)
      i <- i + 1L  # skip closing quote
      next
    }

    # Números
    if (is_digit(c) || (c == "-" && i < n && is_digit(chars[i + 1L]) &&
                        (length(tokens) == 0L ||
                         tokens[[length(tokens)]]$type %in% c("op_bin", "lparen", "comma", "and", "or", "not")))) {
      start <- i
      if (c == "-") i <- i + 1L
      while (i <= n && (is_digit(chars[i]) || chars[i] == ".")) i <- i + 1L
      num <- suppressWarnings(as.numeric(paste(chars[start:(i - 1L)], collapse = "")))
      push("num", num)
      next
    }

    # Operadores binarios multi-char
    if (c == "!" && i < n && chars[i + 1L] == "=") {
      push("op_bin", "!="); i <- i + 2L; next
    }
    if (c == "<" && i < n && chars[i + 1L] == "=") {
      push("op_bin", "<="); i <- i + 2L; next
    }
    if (c == ">" && i < n && chars[i + 1L] == "=") {
      push("op_bin", ">="); i <- i + 2L; next
    }
    # XPath '=' comparador
    if (c == "=") {
      push("op_bin", "=="); i <- i + 1L; next  # normalizamos a ==
    }
    if (c == "<" || c == ">") {
      push("op_bin", c); i <- i + 1L; next
    }
    # Operadores + - (para cálculos, raro en validación pero por si acaso)
    if (c == "+" || (c == "-" && length(tokens) > 0L &&
                      tokens[[length(tokens)]]$type %in% c("var", "num", "rparen"))) {
      push("plus_minus", c); i <- i + 1L; next
    }

    # Paréntesis y coma
    if (c == "(") { push("lparen", "("); i <- i + 1L; next }
    if (c == ")") { push("rparen", ")"); i <- i + 1L; next }
    if (c == ",") { push("comma", ","); i <- i + 1L; next }

    # Dot (self reference)
    if (c == "." && (i == n || !is_alnum(chars[i + 1L]))) {
      push("dot", "."); i <- i + 1L; next
    }

    # Variable expandida (__V__)
    if (c == "_" && i + 3L <= n && paste(chars[i:(i+3)], collapse = "") == "__V_") {
      start <- i
      # Consume toda la secuencia hasta no alnum/_
      while (i <= n && is_alnum(chars[i])) i <- i + 1L
      tok <- paste(chars[start:(i - 1L)], collapse = "")
      push("var", tok)
      next
    }

    # Identificadores (funciones como 'selected', 'today', 'and', 'or', 'not')
    if (is_alpha(c)) {
      start <- i
      while (i <= n && is_alnum(chars[i])) i <- i + 1L
      id <- paste(chars[start:(i - 1L)], collapse = "")
      low <- tolower(id)
      if (low == "and") { push("and", "and"); next }
      if (low == "or")  { push("or", "or"); next }
      if (low == "not") { push("not", "not"); next }
      if (low == "true") { push("num", 1); next }
      if (low == "false") { push("num", 0); next }
      push("ident", id)
      next
    }

    # Carácter no reconocido — lo saltamos para robustez
    i <- i + 1L
  }

  tokens
}

# -----------------------------------------------------------------------------
# Parser recursivo descendente
# -----------------------------------------------------------------------------
# Gramática (precedencia baja → alta):
#   expr    := or_expr
#   or_expr := and_expr (OR and_expr)*
#   and_expr:= not_expr (AND not_expr)*
#   not_expr:= NOT not_expr | cmp_expr
#   cmp_expr:= atom (OP_BIN atom)?
#   atom    := literal | var | call | '(' expr ')' | '.' | '-' atom

.parse_expr <- function(s, context, self_var) {
  tokens <- .tokenize(s)
  if (!length(tokens)) return(list(ast = ast_always_true()))

  state <- list(toks = tokens, pos = 1L, self_var = self_var, context = context)
  result <- .parse_or(state)
  if (is.null(result)) return(NULL)
  final_state <- attr(result, "state")
  if (is.null(final_state) || final_state$pos <= length(final_state$toks)) {
    return(NULL)
  }
  list(ast = result$ast)
}

# Helper para avanzar
.peek <- function(state) {
  if (state$pos > length(state$toks)) return(NULL)
  state$toks[[state$pos]]
}

.consume <- function(state, type = NULL, value = NULL) {
  tok <- .peek(state)
  if (is.null(tok)) return(list(state = state, tok = NULL, ok = FALSE))
  if (!is.null(type) && tok$type != type) return(list(state = state, tok = NULL, ok = FALSE))
  if (!is.null(value) && tok$value != value) return(list(state = state, tok = NULL, ok = FALSE))
  state$pos <- state$pos + 1L
  list(state = state, tok = tok, ok = TRUE)
}

.parse_or <- function(state) {
  .parse_left_binop(state, next_parser = .parse_and, op_type = "or", combiner = ast_or)
}

.parse_and <- function(state) {
  .parse_left_binop(state, next_parser = .parse_not, op_type = "and", combiner = ast_and)
}

.parse_left_binop <- function(state, next_parser, op_type, combiner) {
  # Parse first operand, then loop consuming `op_type` and collecting more.
  # Uso environment para evitar pasar estado por copia en cada iteración.
  env <- new.env(parent = emptyenv())
  env$state <- state

  res <- next_parser(env$state)
  if (is.null(res)) return(NULL)
  env$state <- attr(res, "state")
  loop_args <- list(res$ast)

  repeat {
    tok <- .peek(env$state)
    if (is.null(tok) || tok$type != op_type) break
    consumed <- .consume(env$state, type = op_type)
    if (!consumed$ok) break
    env$state <- consumed$state
    res <- next_parser(env$state)
    if (is.null(res)) return(NULL)
    env$state <- attr(res, "state")
    loop_args[[length(loop_args) + 1L]] <- res$ast
  }

  out <- if (length(loop_args) == 1L) {
    list(ast = loop_args[[1]])
  } else {
    list(ast = do.call(combiner, loop_args))
  }
  attr(out, "state") <- env$state
  out
}

.parse_not <- function(state) {
  tok <- .peek(state)
  if (!is.null(tok) && tok$type == "not") {
    consumed <- .consume(state, type = "not")
    state <- consumed$state
    inner <- .parse_not(state)
    if (is.null(inner)) return(NULL)
    out <- list(ast = ast_not(inner$ast))
    attr(out, "state") <- attr(inner, "state")
    return(out)
  }
  # "not" también puede venir como función: not(expr)
  # Eso se captura en .parse_atom vía ident="not" + lparen.
  .parse_cmp(state)
}

.parse_cmp <- function(state) {
  left <- .parse_atom(state)
  if (is.null(left)) return(NULL)
  state <- attr(left, "state")
  tok <- .peek(state)
  if (is.null(tok) || tok$type != "op_bin") {
    attr(left, "state") <- state
    return(left)
  }
  op <- tok$value
  consumed <- .consume(state, type = "op_bin")
  state <- consumed$state
  right <- .parse_atom(state)
  if (is.null(right)) return(NULL)
  state <- attr(right, "state")

  left_ast <- left$ast
  right_ast <- right$ast
  ast_cmp <- .build_compare(left_ast, op, right_ast)
  out <- list(ast = ast_cmp)
  attr(out, "state") <- state
  out
}

# Construye un AST de comparación a partir de nodos izquierdo/derecho.
# Reglas especiales:
#   var == '' or '' == var → is_missing
#   var != '' or '' != var → not(is_missing)
#   var OP literal         → compare_const (o selected si OP == y var es SM, pero
#                            sin tipo_info no lo sabemos; queda como compare_const)
#   var OP var             → compare_vars
#   `.` OP literal         → usa self_var (resuelto en .parse_atom)
.build_compare <- function(left, op, right) {
  l_is_var <- is_ast(left) && ast_op(left) == "__var"
  r_is_var <- is_ast(right) && ast_op(right) == "__var"
  l_is_lit <- is_ast(left) && ast_op(left) %in% c("__str", "__num")
  r_is_lit <- is_ast(right) && ast_op(right) %in% c("__str", "__num")
  l_is_today <- is_ast(left) && ast_op(left) == "__today"
  r_is_today <- is_ast(right) && ast_op(right) == "__today"

  # var OP today() → collection_date_cmp(var, op)
  # today() OP var → invertimos el operador
  if (l_is_var && r_is_today) {
    return(ast_collection_date_cmp(left$name, op))
  }
  if (r_is_var && l_is_today) {
    swapped <- switch(op, "==" = "==", "!=" = "!=",
                      "<" = ">", "<=" = ">=", ">" = "<", ">=" = "<=")
    return(ast_collection_date_cmp(right$name, swapped))
  }

  # var OP lit
  if (l_is_var && r_is_lit) {
    v <- left$name
    val <- if (ast_op(right) == "__str") right$value else as.character(right$value)
    # Special case: empty string → is_missing
    if (ast_op(right) == "__str" && !nzchar(right$value)) {
      if (op == "==") return(ast_is_missing(v))
      if (op == "!=") return(ast_not(ast_is_missing(v)))
    }
    return(ast_compare_const(v, op, val))
  }
  # lit OP var (swap)
  if (r_is_var && l_is_lit) {
    v <- right$name
    val <- if (ast_op(left) == "__str") left$value else as.character(left$value)
    swapped <- switch(op, "==" = "==", "!=" = "!=",
                      "<" = ">", "<=" = ">=", ">" = "<", ">=" = "<=")
    if (ast_op(left) == "__str" && !nzchar(left$value)) {
      if (op == "==") return(ast_is_missing(v))
      if (op == "!=") return(ast_not(ast_is_missing(v)))
    }
    return(ast_compare_const(v, swapped, val))
  }
  # var OP var
  if (l_is_var && r_is_var) {
    return(ast_compare_vars(left$name, op, right$name))
  }
  # fallback: devuelve un nodo raw con la representación textual
  ast_odk_raw(sprintf("COMPARE[%s]", op), origin = "build_compare_complex")
}

# .parse_atom: maneja literales, variables, llamadas a funciones, y paréntesis.
.parse_atom <- function(state) {
  tok <- .peek(state)
  if (is.null(tok)) return(NULL)

  # Paréntesis
  if (tok$type == "lparen") {
    consumed <- .consume(state, type = "lparen")
    state <- consumed$state
    inner <- .parse_or(state)
    if (is.null(inner)) return(NULL)
    state <- attr(inner, "state")
    consumed <- .consume(state, type = "rparen")
    if (!consumed$ok) return(NULL)
    state <- consumed$state
    out <- list(ast = inner$ast)
    attr(out, "state") <- state
    return(out)
  }

  # Self-reference '.'
  if (tok$type == "dot") {
    consumed <- .consume(state, type = "dot")
    state <- consumed$state
    sv <- attr(state, "self_var", exact = TRUE) %||% state$self_var
    # Representamos `.` como variable si hay self_var.
    if (!is.null(sv) && !is.na(sv) && nzchar(sv)) {
      node <- .__var(sv)
    } else {
      node <- .__var("__SELF__")  # placeholder; caller que arregle
    }
    out <- list(ast = node)
    attr(out, "state") <- state
    return(out)
  }

  # Literal número
  if (tok$type == "num") {
    consumed <- .consume(state, type = "num")
    state <- consumed$state
    out <- list(ast = .__num(tok$value))
    attr(out, "state") <- state
    return(out)
  }

  # Literal string
  if (tok$type == "str") {
    consumed <- .consume(state, type = "str")
    state <- consumed$state
    out <- list(ast = .__str(tok$value))
    attr(out, "state") <- state
    return(out)
  }

  # Variable expandida ${var} → __V__var
  if (tok$type == "var") {
    consumed <- .consume(state, type = "var")
    state <- consumed$state
    out <- list(ast = .__var(.unexpand_var(tok$value)))
    attr(out, "state") <- state
    return(out)
  }

  # Identificador: puede ser llamada a función si sigue '('
  if (tok$type == "ident") {
    consumed <- .consume(state, type = "ident")
    state <- consumed$state
    next_tok <- .peek(state)
    if (!is.null(next_tok) && next_tok$type == "lparen") {
      # Llamada a función: func(arg1, arg2, ...)
      consumed <- .consume(state, type = "lparen")
      state <- consumed$state
      args <- list()
      repeat {
        peek2 <- .peek(state)
        if (is.null(peek2)) return(NULL)
        if (peek2$type == "rparen") {
          consumed <- .consume(state, type = "rparen")
          state <- consumed$state
          break
        }
        arg <- .parse_or(state)
        if (is.null(arg)) return(NULL)
        state <- attr(arg, "state")
        args[[length(args) + 1L]] <- arg$ast
        peek3 <- .peek(state)
        if (!is.null(peek3) && peek3$type == "comma") {
          consumed <- .consume(state, type = "comma")
          state <- consumed$state
          next
        }
        if (!is.null(peek3) && peek3$type == "rparen") {
          consumed <- .consume(state, type = "rparen")
          state <- consumed$state
          break
        }
        return(NULL)
      }
      node <- .resolve_function_call(tok$value, args, self_var = state$self_var)
      if (is.null(node)) {
        # Función no reconocida → escape hatch
        node <- ast_odk_raw(sprintf("%s(...)", tok$value),
                            origin = sprintf("unknown_fn:%s", tok$value))
      }
      out <- list(ast = node)
      attr(out, "state") <- state
      return(out)
    }
    # Identificador suelto (sin paréntesis): raro pero lo tratamos como variable bare.
    out <- list(ast = .__var(tok$value))
    attr(out, "state") <- state
    return(out)
  }

  # Fallback: no reconocido
  NULL
}

# -----------------------------------------------------------------------------
# Resolución de funciones ODK conocidas
# -----------------------------------------------------------------------------
.resolve_function_call <- function(fname, args, self_var = NULL) {
  fl <- tolower(fname)
  switch(fl,
    "selected"       = .resolve_selected(args),
    "count-selected" = .resolve_count_selected(args),
    "count_selected" = .resolve_count_selected(args),
    "regex"          = .resolve_regex(args),
    "not"            = .resolve_not(args),
    "today"          = .resolve_today(args),
    "now"            = .resolve_now(args),
    # Funciones fuera de scope → raw
    "once"          = ast_odk_raw("once(...)", origin = "once"),
    "pulldata"      = ast_odk_raw("pulldata(...)", origin = "pulldata"),
    "jr:choice-name"= ast_odk_raw("jr:choice-name(...)", origin = "jr_choice_name"),
    "indexed-repeat"= ast_odk_raw("indexed-repeat(...)", origin = "indexed_repeat"),
    "position"      = ast_odk_raw("position(..)", origin = "position"),
    "selected-at"   = ast_odk_raw("selected-at(...)", origin = "selected_at"),
    "if"            = ast_odk_raw("if(...)", origin = "if_calculate"),
    "coalesce"      = ast_odk_raw("coalesce(...)", origin = "coalesce"),
    "concat"        = ast_odk_raw("concat(...)", origin = "concat"),
    "int"           = ast_odk_raw("int(...)", origin = "int"),
    "number"        = ast_odk_raw("number(...)", origin = "number"),
    NULL
  )
}

.resolve_selected <- function(args) {
  # selected(var, 'x') — exige var + literal string
  if (length(args) != 2L) return(NULL)
  a1 <- args[[1]]; a2 <- args[[2]]
  if (!is_ast(a1) || !(ast_op(a1) %in% c("__var"))) return(NULL)
  if (!is_ast(a2) || ast_op(a2) != "__str") return(NULL)
  ast_selected(a1$name, a2$value)
}

.resolve_count_selected <- function(args) {
  # count-selected(var) — devuelve número. Solo útil en comparación → el caller
  # tiene que cruzarlo con un op. Aquí producimos un "atom" que luego .parse_cmp
  # detectará. Como no tenemos un tipo "counted", retornamos un odk_raw marcador
  # que el pattern pass de normalización puede reconocer.
  # Simplificación: no soportamos count-selected fuera de comparación directa.
  ast_odk_raw(sprintf("count_selected(%s)", .arg_repr(args[[1]])),
              origin = "count_selected_standalone")
}

.resolve_regex <- function(args) {
  if (length(args) != 2L) return(NULL)
  a1 <- args[[1]]; a2 <- args[[2]]
  # El primer arg suele ser `.` (convertido a self_var) o variable
  var_name <- if (is_ast(a1) && ast_op(a1) == "__var") a1$name else NULL
  pattern <- if (is_ast(a2) && ast_op(a2) == "__str") a2$value else NULL
  if (is.null(var_name) || is.null(pattern)) return(NULL)
  ast_matches_regex(var_name, pattern)
}

.resolve_not <- function(args) {
  if (length(args) != 1L) return(NULL)
  ast_not(args[[1]])
}

.resolve_today <- function(args) {
  # today() NO es "el día actual al validar" — es la fecha de captura de
  # la encuesta. .build_compare lo convierte a collection_date_cmp cuando
  # está del lado derecho (o izquierdo) de una comparación contra una
  # variable. Aquí producimos un pseudo-nodo interno que el caller
  # reconoce.
  .__today()
}

.resolve_now <- function(args) {
  # now() es equivalente a today() para fines de validación (ignoramos hora).
  .__today()
}


.arg_repr <- function(x) {
  if (!is_ast(x)) return(format(x))
  op <- ast_op(x)
  if (op == "__var") return(x$name)
  if (op == "__str") return(sprintf("'%s'", x$value))
  if (op == "__num") return(format(x$value))
  ast_to_string(x)
}

# -----------------------------------------------------------------------------
# Pseudo-AST nodes internos (no expuestos al exterior) para variable/literal.
# No van al enum .AST_OPS — se usan solo dentro del parser y se convierten
# a verdadero AST en .build_compare. Si sobreviven a la salida del parser,
# algo está mal.
# -----------------------------------------------------------------------------
.__var <- function(name) {
  out <- list(name = name)
  attr(out, "op") <- "__var"
  class(out) <- c("vd_ast", "list")
  out
}
.__str <- function(value) {
  out <- list(value = value)
  attr(out, "op") <- "__str"
  class(out) <- c("vd_ast", "list")
  out
}
.__num <- function(value) {
  out <- list(value = value)
  attr(out, "op") <- "__num"
  class(out) <- c("vd_ast", "list")
  out
}
# Pseudo-nodo para today()/now() — reconocido por .build_compare.
.__today <- function() {
  out <- list()
  attr(out, "op") <- "__today"
  class(out) <- c("vd_ast", "list")
  out
}
