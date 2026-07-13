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
    "text_length_cmp"          = .c_text_length_cmp(x$var, x$op, x$n),
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
    "collection_date_cmp"      = .c_collection_date_cmp(x$var, x$op),
    "collection_date_offset_cmp" = .c_collection_date_offset_cmp(x$var, x$op,
                                                                 x$offset_days),
    "aggregate_cmp"            = .c_aggregate_cmp(x$host_var, x$op, x$source_table,
                                                  x$source_var, x$agg_op,
                                                  x$parent_key_local, x$parent_key_remote),
    "referential_parent_exists"= .c_referential_parent_exists(x$source_table,
                                                              x$parent_key_local,
                                                              x$parent_key_remote),
    "roster_set_cmp"           = .c_roster_set_cmp(x$host_sm_var, x$source_table,
                                                   x$source_var, x$op,
                                                   x$parent_key_local, x$parent_key_remote),
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
  pattern <- .regex_pattern_for_r(pattern)
  sprintf("(!is.na(%s) & grepl(%s, as.character(%s), perl = TRUE))",
          var, .lit_str(pattern), var)
}

.c_text_length_cmp <- function(var, op, n) {
  sprintf("(!is.na(%s) & nchar(as.character(%s), type = 'chars') %s %d)",
          var, var, op, as.integer(n))
}

.regex_pattern_for_r <- function(pattern) {
  pattern <- as.character(pattern)
  # Algunos XLSForms llegan desde XML/API con escapes duplicados en regex ODK
  # (p.ej. "\\s" y "\\."). Para grepl(perl=TRUE) deben evaluarse como "\s" y "\.".
  gsub("\\\\\\\\([sSdDwWbB.])", "\\\\\\1", pattern, perl = TRUE)
}

.c_cmp_const <- function(var, op, value) {
  vnum <- suppressWarnings(as.numeric(value))
  if (!is.na(vnum) && !is.logical(value)) {
    # Comparación numérica (rangos, edades…): sin toque code/label.
    sprintf("(!is.na(%s) & suppressWarnings(as.numeric(%s)) %s %s)",
            var, var, op, vnum)
  } else if (op %in% c("==", "!=")) {
    # Igualdad/desigualdad contra un valor de texto: agnóstica code/label. Si la
    # variable tiene lista de opciones en `.__choices_map__`, la comparación
    # acepta el valor y su contraparte code↔label (la regla trae el código y la
    # data la etiqueta, o viceversa). Sin mapa → igualdad de string directa
    # (comportamiento histórico).
    sprintf(
      "get('.vd_cmp_const_eq', envir = globalenv())(%s, %s, %s, %s, if (exists('.__choices_map__', inherits = TRUE)) `.__choices_map__` else NULL)",
      .lit_str(var), var, .lit_str(op), .lit_str(as.character(value))
    )
  } else {
    sprintf("(!is.na(%s) & as.character(%s) %s %s)",
            var, var, op, .lit_str(as.character(value)))
  }
}

.c_cmp_vars <- function(va, op, vb) {
  # ODK coerce implícito: intentamos numérico primero; si ambos no parsean
  # como número, caemos a comparación de fechas (string ISO o Excel serial).
  # Esto cierra el gap detectado en ESPP date_residing vs date_ppl donde
  # as.numeric(date_string) = NA → silencio falso-negativo.
  va_b <- .backtick(va)
  vb_b <- .backtick(vb)
  sprintf(
    paste0(
      "{ .a_n <- suppressWarnings(as.numeric(%s)); ",
      ".b_n <- suppressWarnings(as.numeric(%s)); ",
      ".ok_num <- !is.na(.a_n) & !is.na(.b_n); ",
      ".a_d <- suppressWarnings(as.Date(%s)); ",
      ".b_d <- suppressWarnings(as.Date(%s)); ",
      ".ok_dt <- !is.na(.a_d) & !is.na(.b_d); ",
      "ifelse(.ok_num, .a_n %s .b_n, ",
      "ifelse(.ok_dt, .a_d %s .b_d, NA)) }"
    ),
    va_b, vb_b, va_b, vb_b, op, op
  )
}

.c_selected <- function(var, value) {
  sprintf(
    "get('.vd_sm_contains_all', envir = globalenv())(%s, %s, .__eval_data__, if (exists('.__choices_map__', inherits = TRUE)) `.__choices_map__` else NULL)",
    .lit_str(var),
    .lit_char_vec(as.character(value))
  )
}

.c_any_selected <- function(var, values) {
  sprintf(
    "get('.vd_sm_contains_any', envir = globalenv())(%s, %s, .__eval_data__, if (exists('.__choices_map__', inherits = TRUE)) `.__choices_map__` else NULL)",
    .lit_str(var),
    .lit_char_vec(values)
  )
}

.c_none_selected <- function(var, values) {
  sprintf(
    "get('.vd_sm_contains_none', envir = globalenv())(%s, %s, .__eval_data__, if (exists('.__choices_map__', inherits = TRUE)) `.__choices_map__` else NULL)",
    .lit_str(var),
    .lit_char_vec(values)
  )
}

.c_count_sel_cmp <- function(var, op, n) {
  sprintf(
    "(get('.vd_sm_count_selected', envir = globalenv())(%s, .__eval_data__) %s %d)",
    .lit_str(var),
    op,
    as.integer(n)
  )
}

.c_sm_exclusive <- function(var, exclusive_codes, max_others) {
  sprintf(
    "get('.vd_sm_exclusive_violation', envir = globalenv())(%s, %s, .__eval_data__, max_others = %s)",
    .lit_str(var),
    .lit_char_vec(exclusive_codes),
    if (is.null(max_others) || is.na(max_others)) "NULL" else as.character(as.integer(max_others))
  )
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
  # Backtick de cada var: las llaves canónicas del repeat (`_parent_index`) no
  # son identificadores R válidos y reventaban el parse (RC4 reusa este op con
  # tuplas (`_parent_index`, `current_code`)).
  if (length(vars) == 1L) {
    clave <- sprintf("as.character(%s)", .backtick(vars[1]))
  } else {
    parts <- vapply(vars, function(v) sprintf("as.character(%s)", .backtick(v)), character(1))
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

.c_aggregate_cmp <- function(host_var, op, source_table, source_var, agg_op,
                             parent_key_local, parent_key_remote) {
  # El evaluador inyecta `__data_multi__` como list de data.frames por tabla.
  # Si falta la tabla o las claves, la agregación devuelve NA y la
  # comparación no gatilla violación (conservador).
  tbl_lit <- .lit_str(source_table)
  sv_lit  <- .lit_str(source_var)
  pk_lit  <- .lit_str(parent_key_remote)
  # parent_key_local es nombre de COLUMNA en host data — backtick-quoted
  # (puede empezar con `_uuid`, que no es identificador R válido).
  local_ref <- .backtick(parent_key_local)
  host_ref  <- .backtick(host_var)
  agg_switch <- switch(agg_op,
    "sum"        = 'sum(suppressWarnings(as.numeric(.v_)), na.rm = TRUE)',
    "count"      = 'as.numeric(sum(!is.na(.v_) & nzchar(as.character(.v_))))',
    "n_distinct" = 'as.numeric(length(unique(.v_[!is.na(.v_) & nzchar(as.character(.v_))])))',
    stop(sprintf(".c_aggregate_cmp: agg_op '%s' no soportado.", agg_op))
  )
  sprintf(
    paste0("{ ",
      ".t_ <- if (exists('__data_multi__', inherits = TRUE)) `__data_multi__`[[%s]] else NULL; ",
      ".pk_ <- as.character(%s); ",
      ".agg_ <- if (is.null(.t_) || !(%s %%in%% names(.t_)) || !(%s %%in%% names(.t_))) ",
      "  rep(NA_real_, length(.pk_)) ",
      "else { ",
      "  .groups_ <- split(.t_[[%s]], as.character(.t_[[%s]])); ",
      "  vapply(.pk_, function(k) { .v_ <- .groups_[[k]]; if (is.null(.v_) || !length(.v_)) NA_real_ else %s }, numeric(1)) ",
      "}; ",
      ".h_ <- suppressWarnings(as.numeric(%s)); ",
      "!is.na(.h_) & !is.na(.agg_) & !(.h_ %s .agg_) ",
    "}"),
    tbl_lit, local_ref, sv_lit, pk_lit, sv_lit, pk_lit, agg_switch,
    host_ref, op
  )
}

.backtick <- function(var) {
  # Si el nombre no es identificador R válido (ej. empieza con _), lo
  # envuelve en backticks para acceso por ` ` syntax.
  if (grepl("^[A-Za-z.][A-Za-z0-9._]*$", var)) var
  else sprintf("`%s`", var)
}

# RC3 — integridad referencial. La regla corre sobre la tabla HIJA (host); el
# evaluador expone su data en `.__eval_data__` y las demás tablas (incluida la
# madre) en `__data_multi__`. Delegamos en `.vd_referential_orphans` para leer
# la tabla padre y marcar las filas hija sin padre. Como aggregate_cmp: si la
# tabla padre o su llave faltan, no marca (conservador, sin falso positivo).
.c_referential_parent_exists <- function(source_table, parent_key_local, parent_key_remote) {
  sprintf(
    "get('.vd_referential_orphans', envir = globalenv())(%s, %s, %s, .__eval_data__, if (exists('__data_multi__', inherits = TRUE)) `__data_multi__` else NULL)",
    .lit_str(source_table),
    .lit_str(parent_key_local),
    .lit_str(parent_key_remote)
  )
}

# RC5 — correspondencia roster↔selección. La regla corre sobre la MADRE (host);
# `.__eval_data__` es la madre y la tabla hija roster vive en `__data_multi__`.
# `.vd_sm_tokens_list(host_sm_var, madre)` da el set marcado por fila; el roster
# se agrupa por padre. Violación = !setequal. Si falta la hija, no marca.
.c_roster_set_cmp <- function(host_sm_var, source_table, source_var, op,
                              parent_key_local, parent_key_remote) {
  sprintf(
    "get('.vd_roster_set_violation', envir = globalenv())(%s, %s, %s, %s, %s, .__eval_data__, if (exists('__data_multi__', inherits = TRUE)) `__data_multi__` else NULL)",
    .lit_str(host_sm_var),
    .lit_str(source_table),
    .lit_str(source_var),
    .lit_str(parent_key_local),
    .lit_str(parent_key_remote)
  )
}

# -----------------------------------------------------------------------------
# Select_multiple helpers usados por AST y reglas custom
# -----------------------------------------------------------------------------

.vd_sm_chr <- function(x) {
  out <- as.character(x %||% character(0))
  out <- out[!is.na(out) & nzchar(trimws(out))]
  unique(trimws(out))
}

.vd_sm_tokenize_value <- function(x) {
  if (is.null(x) || length(x) == 0L || is.na(x[1])) return(character(0))
  x <- trimws(as.character(x[1]))
  if (!nzchar(x) || identical(toupper(x), "NA")) return(character(0))
  unique(strsplit(x, "[[:space:],;|]+", perl = TRUE)[[1]])
}

.vd_sm_dummy_code <- function(col, parent) {
  esc <- gsub("([][{}()+*^$?.|\\\\])", "\\\\\\1", parent, perl = TRUE)
  pat <- paste0("^", esc, "([_/.])(.+)$")
  if (!grepl(pat, col, perl = TRUE)) return(NA_character_)
  code <- sub(pat, "\\2", col, perl = TRUE)
  code <- sub("^0+([0-9]+)$", "\\1", code)
  if (!nzchar(code)) NA_character_ else code
}

.vd_sm_dummy_columns <- function(var, data) {
  if (!is.data.frame(data) || !length(names(data))) return(character(0))
  if (exists(".find_select_multiple_dummies", mode = "function")) {
    cols <- .find_select_multiple_dummies(var, names(data))
  } else {
    esc <- gsub("([][{}()+*^$?.|\\\\])", "\\\\\\1", var, perl = TRUE)
    cols <- names(data)[grepl(paste0("^", esc, "[_/.][^_/.]+$"), names(data), perl = TRUE)]
    cols <- cols[!grepl("_(other|specify|otro|texto)$", cols, ignore.case = TRUE)]
  }
  codes <- vapply(cols, .vd_sm_dummy_code, character(1), parent = var)
  ok <- !is.na(codes) & nzchar(codes)
  stats::setNames(cols[ok], codes[ok])
}

.vd_sm_is_selected_dummy <- function(x) {
  if (exists(".dn_is_selected_dummy", mode = "function")) {
    return(.dn_is_selected_dummy(x))
  }
  if (is.logical(x)) return(!is.na(x) & x)
  if (is.numeric(x)) return(!is.na(x) & x != 0)
  y <- trimws(as.character(x))
  y_ascii <- suppressWarnings(iconv(y, from = "", to = "ASCII//TRANSLIT", sub = ""))
  y_low <- tolower(y_ascii)
  !is.na(y_low) & y_low %in% c("1", "si", "s", "yes", "y", "true", "verdadero")
}

.vd_sm_tokens_list <- function(var, data) {
  if (!is.data.frame(data)) return(vector("list", 0L))
  var <- as.character(var %||% "")[1]
  n <- nrow(data)
  out <- vector("list", n)
  for (i in seq_len(n)) out[[i]] <- character(0)

  if (nzchar(var) && var %in% names(data)) {
    for (i in seq_len(n)) out[[i]] <- unique(c(out[[i]], .vd_sm_tokenize_value(data[[var]][i])))
  }

  dummies <- .vd_sm_dummy_columns(var, data)
  if (length(dummies)) {
    for (code in names(dummies)) {
      col <- unname(dummies[[code]])
      selected <- .vd_sm_is_selected_dummy(data[[col]])
      selected[is.na(selected)] <- FALSE
      for (i in which(selected)) out[[i]] <- unique(c(out[[i]], code))
    }
  }

  lapply(out, .vd_sm_chr)
}

# Representaciones aceptables de un valor dado el sub-mapa code→label de una
# variable: el valor mismo + su contraparte (etiqueta si el valor es código,
# código si el valor es etiqueta). Sin mapa devuelve solo el valor.
.vd_value_aliases <- function(value, var_choices = NULL) {
  v <- as.character(value)
  out <- v
  if (is.null(var_choices) || !length(var_choices)) return(unique(out))
  codes <- as.character(names(var_choices))
  labels <- as.character(unlist(var_choices, use.names = FALSE))
  vt <- trimws(v)
  hit_c <- which(trimws(codes) == vt)
  if (length(hit_c)) out <- c(out, labels[hit_c])
  hit_l <- which(trimws(labels) == vt)
  if (length(hit_l)) out <- c(out, codes[hit_l])
  unique(out[!is.na(out) & nzchar(out)])
}

# Igualdad/desigualdad agnóstica code/label para compare_const. `map` es el
# `.__choices_map__` inyectado por el evaluador (list var → (code→label)). Sin
# entrada para la variable, se comporta como igualdad de string directa.
.vd_cmp_const_eq <- function(var_name, x, op, value, map = NULL) {
  var_name <- as.character(var_name)[1]
  value <- as.character(value)
  vc <- if (!is.null(map) && length(map) && var_name %in% names(map)) map[[var_name]] else NULL
  aliases <- .vd_value_aliases(value, vc)
  present <- !is.na(x)
  hit <- present & (as.character(x) %in% aliases)
  if (identical(op, "!=")) present & !hit else hit
}

# Sub-mapa code→label de una variable dentro del choices_map inyectado.
.vd_var_choices <- function(var, choices_map) {
  if (is.null(choices_map) || !length(choices_map)) return(NULL)
  var <- as.character(var)[1]
  if (!(var %in% names(choices_map))) return(NULL)
  choices_map[[var]]
}

.vd_sm_contains_any <- function(var, values, data, choices_map = NULL) {
  values <- .vd_sm_chr(values)
  vc <- .vd_var_choices(var, choices_map)
  toks <- .vd_sm_tokens_list(var, data)
  vapply(toks, function(x) {
    if (!length(values)) return(FALSE)
    any(vapply(values, function(v) any(.vd_value_aliases(v, vc) %in% x), logical(1)))
  }, logical(1))
}

.vd_sm_contains_all <- function(var, values, data, choices_map = NULL) {
  values <- .vd_sm_chr(values)
  vc <- .vd_var_choices(var, choices_map)
  toks <- .vd_sm_tokens_list(var, data)
  vapply(toks, function(x) {
    if (!length(values)) return(FALSE)
    all(vapply(values, function(v) any(.vd_value_aliases(v, vc) %in% x), logical(1)))
  }, logical(1))
}

.vd_sm_contains_none <- function(var, values, data, choices_map = NULL) {
  values <- .vd_sm_chr(values)
  vc <- .vd_var_choices(var, choices_map)
  toks <- .vd_sm_tokens_list(var, data)
  vapply(toks, function(x) {
    if (!length(values)) return(TRUE)
    !any(vapply(values, function(v) any(.vd_value_aliases(v, vc) %in% x), logical(1)))
  }, logical(1))
}

.vd_sm_count_selected <- function(var, data) {
  toks <- .vd_sm_tokens_list(var, data)
  as.integer(vapply(toks, length, integer(1)))
}

# -----------------------------------------------------------------------------
# Coherencia relacional del repeat (RC3/RC5): helpers de dominio que leen la
# tabla relacionada desde `__data_multi__` (inyectado por el evaluador). Mismo
# contrato que `.c_aggregate_cmp`: si la tabla o las llaves faltan, devuelven
# "sin violación" (conservador) en vez de propagar error.
# -----------------------------------------------------------------------------

# RC3 — filas hija huérfanas. `eval_data` es la HIJA (host). Devuelve logical de
# largo nrow(eval_data): TRUE donde `parent_key_local` no aparece como
# `parent_key_remote` en la tabla padre `data_multi[[source_table]]`.
.vd_referential_orphans <- function(source_table, parent_key_local, parent_key_remote,
                                    eval_data, data_multi = NULL) {
  if (!is.data.frame(eval_data) || !nrow(eval_data)) return(logical(0))
  n <- nrow(eval_data)
  if (!(parent_key_local %in% names(eval_data))) return(rep(FALSE, n))
  parent <- if (!is.null(data_multi) && source_table %in% names(data_multi)) {
    data_multi[[source_table]]
  } else NULL
  child_keys <- as.character(eval_data[[parent_key_local]])
  present <- !is.na(child_keys) & nzchar(trimws(child_keys))
  if (is.null(parent) || !is.data.frame(parent) || !(parent_key_remote %in% names(parent))) {
    # Sin tabla padre no podemos afirmar orfandad → no marcamos (conservador).
    return(rep(FALSE, n))
  }
  parent_keys <- as.character(parent[[parent_key_remote]])
  present & !(child_keys %in% parent_keys)
}

# RC5 — evaluación completa por fila madre: devuelve por cada fila
# list(violation=, falta_en_roster=, sobra_en_roster=). Expuesto aparte del
# wrapper de flag para que la UI/tests inspeccionen los subtipos.
#   falta_en_roster = marcado en la madre pero SIN fila en el roster hija.
#   sobra_en_roster = fila en el roster hija que NO fue marcada en la madre.
.vd_roster_set_eval <- function(host_sm_var, source_table, source_var,
                                parent_key_local, parent_key_remote,
                                eval_data, data_multi = NULL) {
  if (!is.data.frame(eval_data) || !nrow(eval_data)) {
    return(list(violation = logical(0), falta_en_roster = list(), sobra_en_roster = list()))
  }
  n <- nrow(eval_data)
  marked <- .vd_sm_tokens_list(host_sm_var, eval_data)
  src <- if (!is.null(data_multi) && source_table %in% names(data_multi)) {
    data_multi[[source_table]]
  } else NULL
  ok_src <- !is.null(src) && is.data.frame(src) &&
    (source_var %in% names(src)) && (parent_key_remote %in% names(src)) &&
    (parent_key_local %in% names(eval_data))
  if (!isTRUE(ok_src)) {
    # Sin roster hija comparable → conservador: sin violación, sets vacíos.
    return(list(
      violation = rep(FALSE, n),
      falta_en_roster = replicate(n, character(0), simplify = FALSE),
      sobra_en_roster = replicate(n, character(0), simplify = FALSE)
    ))
  }
  groups <- split(as.character(src[[source_var]]), as.character(src[[parent_key_remote]]))
  pk <- as.character(eval_data[[parent_key_local]])
  viol <- logical(n); falta <- vector("list", n); sobra <- vector("list", n)
  for (i in seq_len(n)) {
    roster_i <- .vd_sm_chr(groups[[pk[i]]] %||% character(0))
    marked_i <- .vd_sm_chr(marked[[i]])
    falta[[i]] <- setdiff(marked_i, roster_i)  # marcado sin fila
    sobra[[i]] <- setdiff(roster_i, marked_i)  # fila sin marcar
    viol[i]    <- !setequal(roster_i, marked_i)
  }
  list(violation = viol, falta_en_roster = falta, sobra_en_roster = sobra)
}

# RC5 — wrapper de flag (lo que consume el compilador): solo el vector logical.
.vd_roster_set_violation <- function(host_sm_var, source_table, source_var,
                                     parent_key_local, parent_key_remote,
                                     eval_data, data_multi = NULL) {
  .vd_roster_set_eval(host_sm_var, source_table, source_var,
                      parent_key_local, parent_key_remote,
                      eval_data, data_multi)$violation
}

.vd_sm_exclusive_violation <- function(var, exclusive_codes, data, max_others = NULL) {
  exclusive_codes <- .vd_sm_chr(exclusive_codes)
  toks <- .vd_sm_tokens_list(var, data)
  vapply(toks, function(x) {
    if (!length(x) || !length(exclusive_codes)) return(FALSE)
    n_excl <- length(intersect(x, exclusive_codes))
    n_total <- length(x)
    n_other <- n_total - n_excl
    bad_excl <- (n_excl > 0L && n_total > n_excl) || n_excl > 1L
    bad_max <- !is.null(max_others) && !is.na(max_others) && n_other > as.integer(max_others)
    isTRUE(bad_excl || bad_max)
  }, logical(1))
}

.vd_sm_cardinality_violation <- function(var, data, min_count = NULL, max_count = NULL) {
  n <- .vd_sm_count_selected(var, data)
  bad <- rep(FALSE, length(n))
  if (!is.null(min_count) && !is.na(min_count)) bad <- bad | n < as.integer(min_count)
  if (!is.null(max_count) && !is.na(max_count)) bad <- bad | n > as.integer(max_count)
  bad
}

.vd_sm_hierarchy_violation <- function(var, hierarchy_map, data) {
  if (!exists(".transform_normalize_hierarchy_map", mode = "function")) return(rep(FALSE, nrow(data)))
  map <- .transform_normalize_hierarchy_map(hierarchy_map)
  toks <- .vd_sm_tokens_list(var, data)
  vapply(toks, function(x) {
    triggers <- intersect(names(map), x)
    if (!length(triggers)) return(FALSE)
    required <- unique(.vd_sm_chr(unlist(map[triggers], use.names = FALSE)))
    any(!(required %in% x))
  }, logical(1))
}

.c_collection_date_cmp <- function(var, op) {
  # El evaluador inyecta `__today__` en el entorno como vector as.Date
  # resuelto por fila desde la columna de captura (end/_submission_time).
  # Si el eval se corre sin ese binding, falla explícitamente — no
  # silenciosamente como hoy() de R que daría la fecha del día de la
  # validación (semánticamente incorrecto).
  xd <- sprintf("suppressWarnings(as.Date(%s))", var)
  sprintf("(!is.na(%s) & !is.na(`__today__`) & %s %s `__today__`)",
          xd, xd, op)
}

.c_collection_date_offset_cmp <- function(var, op, offset_days) {
  xd <- sprintf("suppressWarnings(as.Date(%s))", var)
  rhs <- sprintf("(`__today__` + %dL)", as.integer(offset_days))
  sprintf("(!is.na(%s) & !is.na(`__today__`) & %s %s %s)",
          xd, xd, op, rhs)
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
