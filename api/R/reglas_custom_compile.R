# =============================================================================
# Reglas custom — compilador a filas del plan (Sprint 4)
# =============================================================================
# Convierte una lista de objetos `ReglaCustom` en filas del plan de
# limpieza estándar (mismo shape que `generar_plan_limpieza`) para que
# `evaluar_consistencia()` pueda ejecutarlas sin modificación.
#
# Contrato del plan de limpieza (columnas relevantes):
#   ID, Tabla, Sección, Categoría, Tipo, Nombre de regla, Objetivo,
#   Variable 1/2/3, Variable 1/2/3 - Etiqueta, Procesamiento.
#
# La columna `Procesamiento` es la expresión R crítica: debe ser un
# string de la forma `<nombre> <- <expr_logica>` donde expr_logica es
# TRUE cuando hay inconsistencia. El nombre debe coincidir con un
# identificador R válido (sin puntos/slashes) para que el evaluador lo
# asigne correctamente.

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
.regla_sanitize_id <- function(x) {
  out <- gsub("[^A-Za-z0-9]+", "_", as.character(x))
  out <- gsub("_+", "_", out)
  out <- sub("^_|_$", "", out)
  if (!nzchar(out)) out <- "x"
  out
}

.regla_r_literal <- function(x) {
  # Renderiza un valor como literal R: strings con quotes, num tal cual.
  if (is.null(x)) return("NA")
  if (is.logical(x)) return(if (isTRUE(x)) "TRUE" else "FALSE")
  if (is.numeric(x) && !is.na(x)) return(as.character(x))
  # Escapar comillas simples.
  s <- as.character(x)
  s <- gsub("'", "\\\\'", s)
  paste0("'", s, "'")
}

.regla_r_list_literal <- function(xs) {
  # `c('a','b','1')` — siempre como strings (el evaluador coacciona).
  vals <- vapply(xs, .regla_r_literal, character(1))
  paste0("c(", paste(vals, collapse = ", "), ")")
}

.regla_r_named_list_literal <- function(x) {
  x <- .transform_normalize_hierarchy_map(x)
  if (!length(x)) return("list()")
  values <- vapply(x, .regla_r_list_literal, character(1))
  names_lit <- .regla_r_list_literal(names(x))
  paste0("stats::setNames(list(", paste(values, collapse = ", "), "), ", names_lit, ")")
}

.regla_r_global_call <- function(fn, ...) {
  args <- paste(c(...), collapse = ", ")
  sprintf("get('%s', envir = globalenv())(%s)", fn, args)
}

.regla_param_values <- function(x) {
  out <- as.character(unlist(x %||% list(), use.names = FALSE))
  out <- out[!is.na(out) & nzchar(trimws(out))]
  unique(trimws(out))
}

# -----------------------------------------------------------------------------
# Expresiones por tipo de regla
# -----------------------------------------------------------------------------
# Cada función devuelve un string con la expresión lógica TRUE=violación.
# Asume que las variables están disponibles como nombres sintácticos del
# entorno que usa evaluar_consistencia.

.regla_expr_no_nulo <- function(var) {
  # Marca NA o vacío como violación.
  sprintf("(is.na(%s) | as.character(%s) == '' | as.character(%s) == 'NA')",
           var, var, var)
}

.regla_expr_rango_num <- function(var, params) {
  mn <- suppressWarnings(as.numeric(params$min))
  mx <- suppressWarnings(as.numeric(params$max))
  incl <- isTRUE(params$inclusive %||% TRUE)
  ops <- if (incl) c("<", ">") else c("<=", ">=")
  xnum <- sprintf("suppressWarnings(as.numeric(%s))", var)
  parts <- c()
  if (!is.na(mn)) parts <- c(parts, sprintf("%s %s %s", xnum, ops[1], mn))
  if (!is.na(mx)) parts <- c(parts, sprintf("%s %s %s", xnum, ops[2], mx))
  cond <- paste(parts, collapse = " | ")
  sprintf("(!is.na(%s) & (%s))", xnum, cond)
}

.regla_expr_rango_fecha <- function(var, params) {
  mn <- suppressWarnings(as.Date(params$min))
  mx <- suppressWarnings(as.Date(params$max))
  xd <- sprintf("suppressWarnings(as.Date(%s))", var)
  parts <- c()
  if (!is.na(mn)) parts <- c(parts, sprintf("%s < as.Date('%s')", xd, mn))
  if (!is.na(mx)) parts <- c(parts, sprintf("%s > as.Date('%s')", xd, mx))
  cond <- paste(parts, collapse = " | ")
  sprintf("(!is.na(%s) & (%s))", xd, cond)
}

.regla_expr_outliers_iqr <- function(var, params) {
  k <- as.numeric(params$k %||% 1.5)
  xnum <- sprintf("suppressWarnings(as.numeric(%s))", var)
  # Cacheamos Q1/Q3 inline (se evalúa una vez por asignación).
  sprintf(
    paste0("{ .x_ <- %s; .qq_ <- stats::quantile(.x_, c(.25, .75), ",
           "na.rm = TRUE); .iqr_ <- diff(.qq_); ",
           "(!is.na(.x_) & (.x_ < .qq_[1] - %g * .iqr_ | .x_ > .qq_[2] + %g * .iqr_)) }"),
    xnum, k, k
  )
}

.regla_expr_outliers_z <- function(var, params) {
  k <- as.numeric(params$k %||% 3)
  xnum <- sprintf("suppressWarnings(as.numeric(%s))", var)
  sprintf(
    paste0("{ .x_ <- %s; .m_ <- mean(.x_, na.rm = TRUE); ",
           ".sd_ <- stats::sd(.x_, na.rm = TRUE); ",
           "(!is.na(.x_) & .sd_ > 0 & abs((.x_ - .m_) / .sd_) > %g) }"),
    xnum, k
  )
}

.regla_expr_duplicados <- function(vars) {
  # Marca cada fila cuya tupla (var1, var2, …) aparece más de una vez.
  clave <- if (length(vars) == 1L) {
    sprintf("as.character(%s)", vars[1])
  } else {
    parts <- vapply(vars, function(v) sprintf("as.character(%s)", v), character(1))
    sprintf("paste(%s, sep = '\\u241F')", paste(parts, collapse = ", "))
  }
  sprintf("{ .k_ <- %s; .n_ <- ave(seq_along(.k_), .k_, FUN = length); .n_ > 1 }",
           clave)
}

.regla_expr_fuera_catalogo <- function(var, params) {
  vals <- unlist(params$valores %||% list())
  lit <- .regla_r_list_literal(vals)
  sprintf("(!is.na(%s) & !(as.character(%s) %%in%% %s))", var, var, lit)
}

# La anomalía no es de ninguna fila: son las filas que faltan. Como el motor
# razona marcando filas, se marca la que precede a cada hueco — que además es la
# información útil: entre qué caso y cuál se perdió algo. El máximo nunca se
# marca: después del último no falta nada, solo no hay más.
.regla_expr_continuidad_secuencia <- function(var) {
  sprintf(paste0(
    "{ .sq_ <- suppressWarnings(as.numeric(%s)); ",
    ".mx_ <- suppressWarnings(max(.sq_, na.rm = TRUE)); ",
    "!is.na(.sq_) & is.finite(.mx_) & .sq_ < .mx_ & !((.sq_ + 1) %%in%% .sq_) }"
  ), var)
}

# Dos casos se cruzan cuando comparten identidad Y sus ventanas de tiempo se
# solapan. Ninguna de las dos señales vale sola: el solape mide una propiedad
# del `end` —que se corre si el formulario queda abierto— y una llave repetida
# puede ser legítima (dos personas del mismo hogar). El hallazgo es la
# coincidencia, y por eso vive en un tipo propio y no en dos reglas sueltas.
#
# `vars` = c(inicio, fin, llave1, llave2, …). O(n^2) sobre la base: aceptable
# para una encuesta y explícito frente a un join que escondería el costo.
.regla_expr_cruce_identidad <- function(vars) {
  ini <- vars[1]; fin <- vars[2]
  llaves <- vars[-(1:2)]
  clave <- if (length(llaves) == 1L) {
    sprintf("as.character(%s)", llaves[1])
  } else {
    sprintf("paste(%s, sep = '\\u241F')",
            paste(vapply(llaves, function(v) sprintf("as.character(%s)", v), character(1)),
                  collapse = ", "))
  }
  sprintf(paste0(
    "{ .k_ <- %s; ",
    ".a_ <- suppressWarnings(as.POSIXct(sub('([+-][0-9]{2}):([0-9]{2})$', '', as.character(%s)), ",
    "format = '%%Y-%%m-%%dT%%H:%%M:%%OS', tz = 'UTC')); ",
    ".b_ <- suppressWarnings(as.POSIXct(sub('([+-][0-9]{2}):([0-9]{2})$', '', as.character(%s)), ",
    "format = '%%Y-%%m-%%dT%%H:%%M:%%OS', tz = 'UTC')); ",
    ".n_ <- length(.k_); ",
    "vapply(seq_len(.n_), function(i) { ",
    "if (is.na(.k_[i]) || !nzchar(.k_[i]) || is.na(.a_[i]) || is.na(.b_[i])) return(FALSE); ",
    ".o_ <- which(.k_ == .k_[i] & seq_len(.n_) != i); ",
    "if (!length(.o_)) return(FALSE); ",
    "any(!is.na(.a_[.o_]) & !is.na(.b_[.o_]) & .a_[.o_] < .b_[i] & .b_[.o_] > .a_[i]) ",
    "}, logical(1)) }"
  ), clave, ini, fin)
}

.regla_expr_coherencia_2v <- function(vars, params) {
  vx <- vars[1]; vy <- vars[2]
  ox <- as.character(params$op_x)
  oy <- as.character(params$op_y)
  # Para "in" / "not_in" el valor es una lista.
  fx <- .regla_expr_cond(vx, ox, params$valor_x)
  fy <- .regla_expr_cond(vy, oy, params$valor_y)
  # Violación: cond_x es TRUE pero cond_y es FALSE.
  sprintf("((%s) & !(%s))", fx, fy)
}

.regla_expr_select_multiple_hierarchy <- function(var, params) {
  map_lit <- .regla_r_named_list_literal(params$hierarchy_map %||% params$map %||% list())
  .regla_r_global_call(
    ".vd_sm_hierarchy_violation",
    .regla_r_literal(var),
    map_lit,
    ".__eval_data__"
  )
}

.regla_expr_select_multiple_exclusive <- function(var, params) {
  codes <- .regla_param_values(params$exclusive_codes %||% params$codes %||% params$valores %||% list())
  max_others <- suppressWarnings(as.integer(params$max_others %||% NA_integer_))
  .regla_r_global_call(
    ".vd_sm_exclusive_violation",
    .regla_r_literal(var),
    .regla_r_list_literal(codes),
    ".__eval_data__",
    sprintf("max_others = %s", if (is.na(max_others)) "NULL" else as.character(max_others))
  )
}

.regla_expr_select_multiple_cardinality <- function(var, params) {
  mn <- suppressWarnings(as.integer(params$min %||% NA_integer_))
  mx <- suppressWarnings(as.integer(params$max %||% NA_integer_))
  .regla_r_global_call(
    ".vd_sm_cardinality_violation",
    .regla_r_literal(var),
    ".__eval_data__",
    sprintf("min_count = %s", if (is.na(mn)) "NULL" else as.character(mn)),
    sprintf("max_count = %s", if (is.na(mx)) "NULL" else as.character(mx))
  )
}

.regla_expr_select_multiple_selection <- function(var, params) {
  op <- as.character(params$op %||% params$operator %||% "contains_any")
  codes <- .regla_param_values(params$codes %||% params$valores %||% list())
  positive <- switch(op,
    contains = .regla_r_global_call(".vd_sm_contains_all", .regla_r_literal(var), .regla_r_list_literal(codes), ".__eval_data__"),
    contains_all = .regla_r_global_call(".vd_sm_contains_all", .regla_r_literal(var), .regla_r_list_literal(codes), ".__eval_data__"),
    contains_any = .regla_r_global_call(".vd_sm_contains_any", .regla_r_literal(var), .regla_r_list_literal(codes), ".__eval_data__"),
    not_contains = .regla_r_global_call(".vd_sm_contains_none", .regla_r_literal(var), .regla_r_list_literal(codes), ".__eval_data__"),
    contains_none = .regla_r_global_call(".vd_sm_contains_none", .regla_r_literal(var), .regla_r_list_literal(codes), ".__eval_data__"),
    .regla_r_global_call(".vd_sm_contains_any", .regla_r_literal(var), .regla_r_list_literal(codes), ".__eval_data__")
  )
  # La regla marca casos que NO cumplen el patrón esperado.
  sprintf("!(%s)", positive)
}

.regla_expr_cond <- function(var, op, valor) {
  if (op %in% c("contains", "contains_all", "contains_any", "not_contains", "contains_none")) {
    vals <- .regla_param_values(valor)
    if (op %in% c("contains", "contains_all")) {
      return(.regla_r_global_call(".vd_sm_contains_all", .regla_r_literal(var), .regla_r_list_literal(vals), ".__eval_data__"))
    }
    if (op == "contains_any") {
      return(.regla_r_global_call(".vd_sm_contains_any", .regla_r_literal(var), .regla_r_list_literal(vals), ".__eval_data__"))
    }
    return(.regla_r_global_call(".vd_sm_contains_none", .regla_r_literal(var), .regla_r_list_literal(vals), ".__eval_data__"))
  }
  if (op == "in" || op == "not_in") {
    vals <- unlist(valor)
    lit <- .regla_r_list_literal(vals)
    prefix <- if (op == "not_in") "!" else ""
    return(sprintf("%s(as.character(%s) %%in%% %s)", prefix, var, lit))
  }
  op_sym <- switch(op,
    "==" = "==", "!=" = "!=", ">" = ">", ">=" = ">=",
    "<" = "<",  "<=" = "<=", op)
  # Si el valor parece numérico, comparar como numérico; si no, como character.
  vnum <- suppressWarnings(as.numeric(valor))
  if (!is.na(vnum)) {
    sprintf("(suppressWarnings(as.numeric(%s)) %s %s)", var, op_sym, vnum)
  } else {
    sprintf("(as.character(%s) %s %s)", var, op_sym, .regla_r_literal(valor))
  }
}

.regla_gate_conditions_to_r <- function(conditions) {
  if (is.null(conditions) || !length(conditions)) return(NULL)
  parts <- vapply(conditions, function(cond) {
    var <- as.character(cond$variable %||% cond$var %||% "")
    op <- as.character(cond$op %||% cond$operator %||% "==")
    value <- cond$value %||% cond$values %||% list()
    .regla_expr_cond(var, op, value)
  }, character(1))
  parts <- parts[nzchar(parts)]
  if (!length(parts)) return(NULL)
  paste0("(", paste(parts, collapse = " & "), ")")
}

.regla_gate_expr_to_r <- function(gate_expr) {
  expr <- trimws(as.character(gate_expr %||% ""))
  if (!nzchar(expr)) return(NULL)
  atoms <- strsplit(expr, "(?i)\\s+and\\s+|\\s+&&\\s+", perl = TRUE)[[1]]
  parts <- vapply(atoms, function(atom) {
    atom <- trimws(atom)
    atom <- gsub("^\\((.*)\\)$", "\\1", atom)
    m_not_sel <- regexec("^not\\s*\\(\\s*selected\\s*\\(\\s*\\$?\\{?([A-Za-z0-9_.]+)\\}?\\s*,\\s*['\"]([^'\"]+)['\"]\\s*\\)\\s*\\)$", atom, perl = TRUE)
    got <- regmatches(atom, m_not_sel)[[1]]
    if (length(got) == 3L) return(.regla_expr_cond(got[2], "not_contains", got[3]))
    m_sel <- regexec("^selected\\s*\\(\\s*\\$?\\{?([A-Za-z0-9_.]+)\\}?\\s*,\\s*['\"]([^'\"]+)['\"]\\s*\\)$", atom, perl = TRUE)
    got <- regmatches(atom, m_sel)[[1]]
    if (length(got) == 3L) return(.regla_expr_cond(got[2], "contains", got[3]))
    m_cmp <- regexec("^\\$?\\{?([A-Za-z0-9_.]+)\\}?\\s*(==|=|!=|>=|<=|>|<)\\s*['\"]?([^'\"]+)['\"]?$", atom, perl = TRUE)
    got <- regmatches(atom, m_cmp)[[1]]
    if (length(got) == 4L) {
      op <- if (identical(got[3], "=")) "==" else got[3]
      return(.regla_expr_cond(got[2], op, got[4]))
    }
    stop(sprintf("gate_expr no soportado: %s", atom), call. = FALSE)
  }, character(1))
  paste0("(", paste(parts, collapse = " & "), ")")
}

.regla_apply_gate <- function(expr, r) {
  gate <- .regla_gate_conditions_to_r(r$gate_conditions %||% list())
  if (is.null(gate) && !is.null(r$gate_expr) && nzchar(as.character(r$gate_expr))) {
    gate <- .regla_gate_expr_to_r(r$gate_expr)
  }
  if (is.null(gate) || !nzchar(gate)) return(expr)
  sprintf("((%s) & (%s))", gate, expr)
}

# -----------------------------------------------------------------------------
# Compilar una ReglaCustom a una fila del plan
# -----------------------------------------------------------------------------
.compilar_regla_custom <- function(r, instrumento = NULL) {
  .validar_regla_custom(r)
  vars <- as.character(unlist(r$variables))
  id <- as.character(r$id %||% sprintf("RC_%s", uuid::UUIDgenerate()))
  nombre_human <- as.character(r$nombre %||% id)
  mensaje <- as.character(r$mensaje %||% nombre_human)

  # Nombre R válido para la fila del plan (Procesamiento usa "<nombre> <-").
  nombre_r <- paste0("rc_", .regla_sanitize_id(id))

  expr <- switch(r$tipo,
    "no_nulo"        = .regla_expr_no_nulo(vars[1]),
    "rango_num"      = .regla_expr_rango_num(vars[1], r$params),
    "rango_fecha"    = .regla_expr_rango_fecha(vars[1], r$params),
    "outliers_iqr"   = .regla_expr_outliers_iqr(vars[1], r$params),
    "outliers_z"     = .regla_expr_outliers_z(vars[1], r$params),
    "duplicados"     = .regla_expr_duplicados(vars),
    "fuera_catalogo" = .regla_expr_fuera_catalogo(vars[1], r$params),
    "coherencia_2v"  = .regla_expr_coherencia_2v(vars, r$params),
    "select_multiple_hierarchy" = .regla_expr_select_multiple_hierarchy(vars[1], r$params),
    "select_multiple_exclusive" = .regla_expr_select_multiple_exclusive(vars[1], r$params),
    "select_multiple_cardinality" = .regla_expr_select_multiple_cardinality(vars[1], r$params),
    "select_multiple_selection" = .regla_expr_select_multiple_selection(vars[1], r$params),
    "continuidad_secuencia" = .regla_expr_continuidad_secuencia(vars[1]),
    "cruce_identidad" = .regla_expr_cruce_identidad(vars),
    stop_api(500, "E_REGLA_TIPO", sprintf("Tipo no mapeado: %s", r$tipo))
  )
  expr <- .regla_apply_gate(expr, r)
  procesamiento <- sprintf("%s <- %s", nombre_r, expr)

  # Etiquetas humanas de las variables (busca en el instrumento si disponible).
  etiqueta <- function(v) {
    if (is.null(instrumento) || is.null(instrumento$survey)) return(NA_character_)
    s <- instrumento$survey
    if (!("name" %in% names(s)) || !("label" %in% names(s))) return(NA_character_)
    i <- which(!is.na(s$name) & as.character(s$name) == v)[1]
    if (is.na(i)) return(NA_character_)
    as.character(s$label[i])
  }
  lab1 <- etiqueta(vars[1])
  lab2 <- if (length(vars) >= 2L) etiqueta(vars[2]) else NA_character_
  lab3 <- if (length(vars) >= 3L) etiqueta(vars[3]) else NA_character_

  tibble::tibble(
    ID                     = id,
    Tabla                  = "principal",
    `Sección`              = "Reglas personalizadas",
    `Categoría`            = "custom",
    `Tipo`                 = paste0("custom:", r$tipo),
    `Nombre de regla`      = nombre_human,
    `Objetivo`             = mensaje,
    `Variable 1`           = if (length(vars) >= 1L) vars[1] else NA_character_,
    `Variable 1 - Etiqueta` = lab1,
    `Variable 2`           = if (length(vars) >= 2L) vars[2] else NA_character_,
    `Variable 2 - Etiqueta` = lab2,
    `Variable 3`           = if (length(vars) >= 3L) vars[3] else NA_character_,
    `Variable 3 - Etiqueta` = lab3,
    `Procesamiento`        = procesamiento
  )
}

# -----------------------------------------------------------------------------
# Compilar lista de reglas → plan parcial
# -----------------------------------------------------------------------------
# Filtra las inactivas (activa == FALSE).
compile_reglas_custom <- function(reglas, instrumento = NULL) {
  if (!length(reglas)) return(NULL)
  activas <- Filter(function(r) isTRUE(r$activa) || is.null(r$activa), reglas)
  if (!length(activas)) return(NULL)
  rows <- lapply(activas, .compilar_regla_custom, instrumento = instrumento)
  dplyr::bind_rows(rows)
}
