# =============================================================================
# Reporte metodologico de Validacion
# =============================================================================

.vmr_text <- function(x, default = "") {
  x <- as.character(x %||% default)
  if (!length(x) || is.na(x[[1L]])) return(default)
  out <- trimws(x[[1L]])
  out <- gsub("[\u2018\u2019]", "'", out, perl = TRUE)
  out <- gsub("[\u201c\u201d]", '"', out, perl = TRUE)
  out <- gsub("[\u2013\u2014]", "-", out, perl = TRUE)
  out
}

.vmr_fallback_variable_label <- function(code) {
  code <- .vmr_text(code, "variable")
  if (grepl("(?:^|[_-])no[_-]?label$|nolabel", code, ignore.case = TRUE, perl = TRUE)) {
    return("Variable sin etiqueta en el formulario")
  }
  gsub("_+", " ", code)
}

.vmr_replace_choice_values <- function(text, value_labels) {
  out <- text
  value_labels <- unlist(value_labels %||% list(), use.names = TRUE)
  value_labels <- value_labels[!is.na(value_labels) & nzchar(names(value_labels)) & nzchar(trimws(value_labels))]
  if (!length(value_labels)) return(out)
  ordered_values <- names(value_labels)[order(nchar(names(value_labels)), decreasing = TRUE)]
  for (value in ordered_values) {
    label <- .vmr_text(value_labels[[value]], value)
    out <- gsub(paste0("'", value, "'"), paste0("«", label, "»"), out, fixed = TRUE)
    out <- gsub(paste0('"', value, '"'), paste0("«", label, "»"), out, fixed = TRUE)
  }
  blocks <- unique(regmatches(out, gregexpr("\\{[^{}]+\\}", out, perl = TRUE))[[1L]])
  blocks <- blocks[blocks != "-1"]
  for (block in blocks) {
    values <- trimws(strsplit(substring(block, 2L, nchar(block) - 1L), ",", fixed = TRUE)[[1L]])
    if (length(values) && all(values %in% names(value_labels))) {
      replacement <- paste0("«", unname(value_labels[values]), "»", collapse = " o ")
      out <- gsub(block, replacement, out, fixed = TRUE)
    }
  }
  out
}

.vmr_humanize_title <- function(x, variable_labels = list(), choice_labels = list()) {
  out <- .vmr_text(x)
  choice_variables <- names(choice_labels %||% list())
  relevant_choice_variables <- choice_variables[vapply(choice_variables, function(code) {
    grepl(code, out, fixed = TRUE)
  }, logical(1))]
  labels <- unlist(variable_labels %||% list(), use.names = TRUE)
  labels <- labels[!is.na(labels) & nzchar(names(labels)) & nzchar(trimws(as.character(labels)))]
  # Resolver primero las etiquetas que dependen de otras etiquetas del
  # instrumento. Así, los pases editoriales comparan texto ya humanizado y no
  # dejan duplicados cuando el XLSForm usa referencias entre variables.
  for (pass in seq_len(5L)) {
    before <- labels
    for (code in names(labels)) {
      value <- .vmr_text(labels[[code]], gsub("_+", " ", code))
      tokens <- unique(regmatches(
        value,
        gregexpr("\\$\\{[A-Za-z][A-Za-z0-9_.-]*\\}", value, perl = TRUE)
      )[[1L]])
      tokens <- tokens[tokens != "-1"]
      for (token in tokens) {
        reference <- substring(token, 3L, nchar(token) - 1L)
        if (!(reference %in% names(labels))) next
        value <- gsub(
          token,
          .vmr_text(labels[[reference]], gsub("_+", " ", reference)),
          value,
          fixed = TRUE
        )
      }
      labels[[code]] <- value
    }
    if (identical(labels, before)) break
  }
  # Algunas etiquetas del XLSForm contienen referencias a otras variables.
  # Repetir el pase permite resolver esas referencias sin depender del orden
  # en que el instrumento declaró las columnas.
  for (pass in seq_len(3L)) {
    before <- out
    for (code in names(labels)) {
      label <- .vmr_text(labels[[code]], gsub("_+", " ", code))
      out <- gsub(paste0("${", code, "}"), label, out, fixed = TRUE)
      out <- gsub(paste0("«", code, "»"), paste0("«", label, "»"), out, fixed = TRUE)
      out <- gsub(paste0("[", code, "]"), label, out, fixed = TRUE)
    }
    if (identical(out, before)) break
  }
  # Los prefijos editoriales como [SATI_014] se retiran; si el contenido
  # entre corchetes era una variable conocida, el pase anterior ya lo
  # sustituyó por su etiqueta y por tanto se conserva.
  out <- sub("^\\[[^]]+\\]\\s*", "", out, perl = TRUE)
  for (code in names(labels)) {
    label <- .vmr_text(labels[[code]], gsub("_+", " ", code))
    out <- gsub(
      paste0(label, " Salto · «", label, "» - no debe responderse"),
      paste0("«", label, "» debe permanecer sin respuesta cuando no corresponde"),
      out,
      fixed = TRUE
    )
    out <- gsub(
      paste0(label, " Salto · «", label, "» - debe responderse"),
      paste0("«", label, "» debe responderse cuando corresponde"),
      out,
      fixed = TRUE
    )
    out <- gsub(
      paste0(label, " Salto · «", label, "» (condición avanzada)"),
      paste0("«", label, "» se evalúa con una condición avanzada"),
      out,
      fixed = TRUE
    )
    out <- gsub(
      paste0(label, " «", label, "»"),
      paste0("«", label, "»"),
      out,
      fixed = TRUE
    )
  }
  advanced_parts <- strsplit(out, " Salto · ", fixed = TRUE)[[1L]]
  if (length(advanced_parts) == 2L && identical(
    advanced_parts[[2L]],
    paste0("«", advanced_parts[[1L]], "» (condición avanzada)")
  )) {
    out <- paste0("«", advanced_parts[[1L]], "» se evalúa con una condición avanzada")
  }
  out <- gsub("Regla en modo experto:\\s*", "", out, ignore.case = TRUE, perl = TRUE)
  out <- gsub("\\(modo experto\\)", "(condición avanzada)", out, ignore.case = TRUE, perl = TRUE)
  advanced_parts <- strsplit(out, " Salto · ", fixed = TRUE)[[1L]]
  if (length(advanced_parts) == 2L && identical(
    advanced_parts[[2L]],
    paste0("«", advanced_parts[[1L]], "» (condición avanzada)")
  )) {
    out <- paste0("«", advanced_parts[[1L]], "» se evalúa con una condición avanzada")
  }
  out <- gsub("['\"]Yes['\"]", "«Sí»", out, ignore.case = TRUE, perl = TRUE)
  out <- gsub("['\"]No['\"]", "«No»", out, ignore.case = TRUE, perl = TRUE)
  out <- gsub("\\[([A-Za-z][A-Za-z0-9.-]*_[A-Za-z0-9_.-]+)\\]\\s*", "", out, perl = TRUE)
  odk_tokens <- unique(regmatches(out, gregexpr("\\$\\{[A-Za-z][A-Za-z0-9_]*\\}", out, perl = TRUE))[[1L]])
  odk_tokens <- odk_tokens[odk_tokens != "-1"]
  for (token in odk_tokens) {
    code <- substring(token, 3L, nchar(token) - 1L)
    out <- gsub(token, .vmr_fallback_variable_label(code), out, fixed = TRUE)
  }
  matches <- unique(regmatches(out, gregexpr("«[A-Za-z][A-Za-z0-9_]*»", out, perl = TRUE))[[1L]])
  matches <- matches[matches != "-1"]
  for (token in matches) {
    code <- substring(token, 2L, nchar(token) - 1L)
    label <- .vmr_fallback_variable_label(code)
    out <- gsub(token, paste0("«", label, "»"), out, fixed = TRUE)
  }
  for (code in relevant_choice_variables) {
    label <- .vmr_text(labels[[code]] %||% "opción evaluada")
    out <- if (grepl("^[A-Za-z][A-Za-z0-9_]*$", code)) {
      gsub(paste0("\\b", code, "\\b"), label, out, perl = TRUE)
    } else {
      gsub(code, label, out, fixed = TRUE)
    }
    out <- .vmr_replace_choice_values(out, choice_labels[[code]])
  }
  out <- gsub("\\s+-\\s+opción evaluada", " para la opción evaluada", out, ignore.case = TRUE, perl = TRUE)
  out <- gsub("\\s+([?!,.;:])", "\\1", out, perl = TRUE)
  gsub("\\s+", " ", trimws(out), perl = TRUE)
}

.vmr_humanize_state <- function(x) {
  raw <- .vmr_text(x)
  key <- tolower(raw)
  if (grepl("^no[_ ]?evalu", key, perl = TRUE)) return("No evaluada en el último análisis")
  if (grepl("^no[_ ]?aplica", key, perl = TRUE)) return("No aplicable a la base analizada")
  if (grepl("incorrect|error|fall", key, perl = TRUE)) return("No se pudo ejecutar en el último análisis")
  if (identical(key, "correcta")) return("Evaluada")
  raw
}

.vmr_df <- function(x) {
  if (is.data.frame(x)) return(x)
  if (!is.list(x) || !length(x)) return(data.frame())
  tryCatch(as.data.frame(x, stringsAsFactors = FALSE, check.names = FALSE), error = function(e) data.frame())
}

.vmr_col <- function(df, aliases) {
  if (!ncol(df)) return("")
  key <- function(x) gsub("[^a-z0-9]", "", iconv(tolower(x), to = "ASCII//TRANSLIT"))
  idx <- match(key(aliases), key(names(df)))
  idx <- idx[!is.na(idx)]
  if (length(idx)) names(df)[idx[[1L]]] else ""
}

.vmr_value <- function(df, i, aliases, default = "") {
  nm <- .vmr_col(df, aliases)
  if (!nzchar(nm) || i > nrow(df)) return(default)
  value <- df[[nm]][[i]]
  if (length(value) > 1L) value <- paste(value, collapse = ", ")
  .vmr_text(value, default)
}

.vmr_number <- function(df, i, aliases, default = NA_real_) {
  raw <- .vmr_value(df, i, aliases, "")
  out <- suppressWarnings(as.numeric(raw))
  if (length(out) && is.finite(out[[1L]])) out[[1L]] else default
}

.vmr_default_narrative <- function(type, variables) {
  type <- tolower(.vmr_text(type, "regla"))
  target <- if (nzchar(variables)) variables else "las variables involucradas"
  if (grepl("required|oblig", type)) return(paste("Comprueba que", target, "tenga respuesta cuando corresponde."))
  if (grepl("skip|salto|relev", type)) return(paste("Comprueba la ruta de salto y la aplicacion condicional de", target, "."))
  if (grepl("range|rango|fecha", type)) return(paste("Comprueba que", target, "permanezca dentro del rango permitido."))
  if (grepl("duplicate|duplic", type)) return(paste("Detecta registros repetidos por la llave definida en", target, "."))
  if (grepl("repeat", type)) return("Contrasta el numero de filas del grupo repeat con el conteo declarado por el instrumento.")
  if (grepl("catalog|choice", type)) return(paste("Comprueba que", target, "use valores admitidos por el catalogo."))
  paste("Evalua la consistencia definida para", target, ".")
}

.vmr_formula_kind <- function(type, formula, source_expression = "") {
  type_key <- tolower(.vmr_text(type))
  formula_key <- tolower(.vmr_text(formula))
  source_key <- tolower(.vmr_text(source_expression))
  if (grepl("repeat_length", type_key) || grepl("stop\\s*\\(", formula_key)) return("specialized_runtime")
  if (grepl("odk_raw|pulldata", type_key) || grepl("pulldata\\s*\\(", source_key) || grepl("pulldata\\s*\\(", formula_key)) return("source_odk")
  if (nzchar(formula_key)) return("exact_r")
  if (nzchar(source_key)) return("source_odk")
  "not_executed"
}

.vmr_formula_display <- function(type, formula, source_expression, kind) {
  if (identical(kind, "specialized_runtime")) {
    return("Runtime especializado: compara el conteo observado del repeat con el conteo esperado del instrumento.")
  }
  if (identical(kind, "source_odk")) return(.vmr_text(source_expression, .vmr_text(formula, "Expresion fuente no ejecutada en R.")))
  if (identical(kind, "not_executed")) return("Sin expresion R ejecutable registrada.")
  .vmr_text(formula, "Sin expresion R registrada.")
}

.vmr_eval_table <- function(evaluation) {
  candidates <- list(
    evaluation$resumen_tabla %||% NULL,
    evaluation$resumen %||% NULL,
    evaluation$summary %||% NULL,
    evaluation$resultados %||% NULL,
    evaluation$rules %||% NULL,
    evaluation
  )
  for (candidate in candidates) {
    df <- .vmr_df(candidate)
    if (nrow(df) && nzchar(.vmr_col(df, c("id_regla", "rule_id", "id")))) return(df)
  }
  data.frame()
}

.vmr_ast_ops <- function(x) {
  if (is.null(x)) return(character(0))
  out <- character(0)
  visit <- function(node) {
    if (is.null(node)) return(invisible(NULL))
    op <- attr(node, "op", exact = TRUE)
    if (!is.null(op) && length(op)) out <<- c(out, as.character(op[[1L]]))
    if (is.list(node)) {
      for (child in unclass(node)) {
        if (is.list(child)) visit(child)
      }
    }
    invisible(NULL)
  }
  visit(x)
  unique(out)
}

.vmr_ast_raw_expressions <- function(x) {
  if (is.null(x)) return(character(0))
  out <- character(0)
  visit <- function(node) {
    if (is.null(node)) return(invisible(NULL))
    if (identical(attr(node, "op", exact = TRUE), "odk_raw")) {
      value <- .vmr_text(node$expression %||% node$expr %||% "")
      if (nzchar(value)) out <<- c(out, value)
    }
    if (is.list(node)) {
      for (child in unclass(node)) {
        if (is.list(child)) visit(child)
      }
    }
    invisible(NULL)
  }
  visit(x)
  unique(out)
}

.vmr_ast_variable_values <- function(x) {
  out <- list()
  visit <- function(node) {
    if (is.null(node)) return(invisible(NULL))
    op <- attr(node, "op", exact = TRUE)
    variable <- .vmr_text(node$var %||% "")
    values <- if (identical(op, "compare_const")) {
      as.character(node$value %||% character(0))
    } else if (identical(op, "in_set")) {
      as.character(node$values %||% character(0))
    } else {
      character(0)
    }
    values <- values[!is.na(values) & nzchar(values)]
    if (nzchar(variable) && length(values)) out[[variable]] <<- unique(c(out[[variable]] %||% character(0), values))
    if (is.list(node)) for (child in unclass(node)) if (is.list(child)) visit(child)
    invisible(NULL)
  }
  visit(x)
  out
}

.vmr_choice_labels_by_variable <- function(rules, choices_map) {
  observed <- list()
  for (rule in rules) {
    for (found in list(
      .vmr_ast_variable_values(rule$predicate),
      .vmr_ast_variable_values(rule$gate)
    )) {
      for (variable in names(found)) {
        observed[[variable]] <- unique(c(
          observed[[variable]] %||% character(0),
          found[[variable]]
        ))
      }
    }
  }
  maps <- lapply(choices_map %||% list(), function(values) {
    values <- unlist(values %||% list(), use.names = TRUE)
    values[!is.na(values) & nzchar(names(values))]
  })
  maps <- maps[lengths(maps) > 0L]
  out <- list()
  for (variable in names(observed)) {
    values <- observed[[variable]]
    candidates <- names(maps)[vapply(maps, function(map) all(values %in% names(map)), logical(1))]
    if (length(candidates) == 1L) out[[variable]] <- maps[[candidates[[1L]]]]
  }
  out
}

.vmr_unresolved_label_codes <- function(rules) {
  text <- unlist(lapply(rules, function(rule) c(
    unlist((rule$variable_roles %||% list())$labels %||% list(), use.names = FALSE),
    rule$nombre %||% "", rule$objetivo %||% "",
    (rule$presentation %||% list())$nombre_humano %||% "",
    (rule$presentation %||% list())$objetivo %||% "",
    (rule$presentation %||% list())$gate_humano %||% ""
  )), use.names = FALSE)
  tokens <- unique(unlist(regmatches(text, gregexpr("\\$\\{[A-Za-z][A-Za-z0-9_.-]*\\}", text, perl = TRUE)), use.names = FALSE))
  substring(tokens, 3L, nchar(tokens) - 1L)
}

.vmr_internal_choice_variables <- function(rules, choice_labels) {
  variables <- names(choice_labels %||% list())
  unresolved <- .vmr_unresolved_label_codes(rules)
  for (variable in names(choice_labels %||% list())) {
    stem <- sub("(?:[_.-]?code)$", "", variable, ignore.case = TRUE, perl = TRUE)
    if (identical(stem, variable)) next
    siblings <- unresolved[sub("(?:[_.-]?label)$", "", unresolved, ignore.case = TRUE, perl = TRUE) == stem]
    variables <- c(variables, siblings)
  }
  unique(variables[nzchar(variables)])
}

.vmr_external_reference_grammar <- function(text, external_labels) {
  out <- text
  labels <- unique(as.character(unlist(external_labels %||% list(), use.names = FALSE)))
  labels <- labels[!is.na(labels) & nzchar(labels)]
  for (label in labels) {
    lower <- tolower(label)
    feminine <- grepl("(?:a|á|ción|sión|dad|tad|tud)$", lower, perl = TRUE) || lower %in% c("sede")
    replacement <- if (feminine) paste0("de la ", lower, " registrada") else paste0("del ", lower, " registrado")
    out <- gsub(paste0("de ", label), replacement, out, fixed = TRUE)
  }
  out
}

.vmr_external_target_label <- function(rule) {
  target <- as.character((rule$variable_roles %||% list())$target %||% character(0))
  target <- target[!is.na(target) & nzchar(target)]
  if (length(target) != 1L) return(list())
  expressions <- unique(c(
    .vmr_ast_raw_expressions(rule$predicate),
    .vmr_ast_raw_expressions(rule$gate)
  ))
  if (!length(expressions)) return(list())
  pattern <- "pulldata\\s*\\(\\s*['\"][^'\"]+['\"]\\s*,\\s*['\"]([^'\"]+)['\"]"
  for (expression in expressions) {
    match <- regexec(pattern, expression, ignore.case = TRUE, perl = TRUE)
    groups <- regmatches(expression, match)[[1L]]
    if (length(groups) >= 2L && nzchar(trimws(groups[[2L]]))) {
      return(stats::setNames(list(trimws(groups[[2L]])), target[[1L]]))
    }
  }
  list()
}

.vmr_rule_technical_kind <- function(rule) {
  ops <- unique(c(.vmr_ast_ops(rule$predicate), .vmr_ast_ops(rule$gate)))
  if (!length(ops)) return("not_executed")
  if ("odk_raw" %in% ops) return("source_odk")
  specialized <- c(
    "repeat_length_matches", "aggregate_cmp",
    "referential_parent_exists", "roster_set_cmp"
  )
  if (any(ops %in% specialized)) return("specialized_runtime")
  "exact_r"
}

.vmr_technical_label <- function(kind) {
  switch(kind,
    exact_r = "Fórmula R",
    specialized_runtime = "Regla sobre tablas relacionadas",
    source_odk = "Expresión original del formulario",
    not_executed = "Sin fórmula R",
    "Fórmula no disponible"
  )
}

.vmr_remediation_text <- function(value) {
  key <- tolower(.vmr_text(value))
  switch(key,
    impute_value = "Revisar el caso y completar el valor únicamente cuando exista una fuente verificable.",
    set_missing = "Revisar el caso y, si corresponde, dejar el valor como faltante documentado.",
    drop_row = "Confirmar el hallazgo antes de excluir el registro.",
    keep_first = "Confirmar la duplicidad y conservar la observación que corresponda según el protocolo.",
    "Revisar el caso y documentar la decisión antes de modificar la base."
  )
}

.vmr_rule_variables <- function(rule) {
  vars <- unique(as.character(rule$variables %||% rule$variable_roles$all %||% character(0)))
  vars <- vars[!is.na(vars) & nzchar(vars)]
  labels <- rule$variable_roles$labels %||% list()
  display <- vapply(vars, function(var) {
    label <- .vmr_text(labels[[var]] %||% "")
    if (nzchar(label) && !identical(label, var)) sprintf("%s [%s]", label, var) else var
  }, character(1))
  list(codes = vars, display = display, labels = labels)
}

.vmr_portable_r <- function(expression) {
  gsub(
    "get\\((['\"])(\\.[A-Za-z0-9_.]+)\\1, envir = globalenv\\(\\)\\)",
    "\\2",
    expression,
    perl = TRUE
  )
}

.vmr_rule_formula <- function(rule, kind) {
  if (identical(kind, "source_odk")) {
    source <- unique(c(
      .vmr_ast_raw_expressions(rule$predicate),
      .vmr_ast_raw_expressions(rule$gate)
    ))
    return(list(raw = "", display = paste(source, collapse = "\n"), source = paste(source, collapse = "\n")))
  }
  if (identical(kind, "specialized_runtime")) {
    return(list(
      raw = "",
      display = "Esta comprobación requiere las tablas relacionadas y sus llaves de enlace.",
      source = ""
    ))
  }
  if (!identical(kind, "exact_r")) {
    return(list(raw = "", display = "Esta regla no tiene fórmula R.", source = ""))
  }
  effective <- if (is.null(rule$gate)) rule$predicate else ast_normalize(ast_and(rule$gate, rule$predicate))
  raw <- tryCatch(.vmr_portable_r(ast_to_r(effective)), error = function(e) "")
  if (!nzchar(raw)) {
    return(list(raw = "", display = "No fue posible generar la fórmula R de esta regla.", source = ""))
  }
  list(raw = raw, display = raw, source = "")
}

.vmr_evaluation_for_rule <- function(eval_df, eval_id_col, id, evaluation_available) {
  if (!evaluation_available) {
    return(list(available = FALSE, state = "Plan configurado; aún no ejecutado", reviewed = NA_real_, findings = NA_real_))
  }
  idx <- match(id, as.character(eval_df[[eval_id_col]]))
  if (is.na(idx)) {
    return(list(available = FALSE, state = "No evaluada en el último análisis", reviewed = NA_real_, findings = NA_real_))
  }
  findings <- .vmr_number(eval_df, idx, c("n_violaciones", "n_inconsistencias", "hallazgos", "n_hallazgos", "violations", "casos"), NA_real_)
  reviewed <- .vmr_number(eval_df, idx, c("n_evaluados", "n_filas", "revisados", "n_revisados", "evaluated", "total"), NA_real_)
  raw_state <- .vmr_value(eval_df, idx, c("estado_dinamico", "estado", "status", "resultado"), "")
  invalid_state <- nzchar(raw_state) && grepl(
    "no[_ ]?evalu|no[_ ]?aplica|incorrect|error|fall|desaline",
    raw_state,
    ignore.case = TRUE,
    perl = TRUE
  )
  available <- !invalid_state && (is.finite(reviewed) || is.finite(findings) || grepl("correct|evaluad", raw_state, ignore.case = TRUE))
  state <- if (nzchar(raw_state)) {
    .vmr_humanize_state(raw_state)
  } else if (!available) {
    "Resultado no disponible"
  } else if (is.finite(findings) && findings > 0) {
    "Evaluada con casos para revisar"
  } else if (is.finite(findings)) {
    "Evaluada sin casos señalados"
  } else {
    "Evaluada; conteo de señalamientos no disponible"
  }
  list(available = available, state = state, reviewed = reviewed, findings = findings)
}

.vmr_universe_records <- function(x) {
  if (is.null(x) || !length(x)) return(list())
  if (is.data.frame(x)) {
    return(lapply(seq_len(nrow(x)), function(i) as.list(x[i, , drop = FALSE])))
  }
  if (!is.list(x)) return(list())
  record_fields <- c(
    "id", "variable", "key_variable", "key_values", "from_values",
    "to_value", "values", "reason"
  )
  if (length(intersect(names(x) %||% character(0), record_fields))) return(list(x))
  Filter(is.list, unname(x))
}

.vmr_universe_values <- function(x) {
  out <- as.character(unlist(x %||% character(0), use.names = FALSE))
  unique(out[!is.na(out) & nzchar(out)])
}

.vmr_universe_corrections <- function(x) {
  records <- .vmr_universe_records(x)
  out <- lapply(seq_along(records), function(i) {
    item <- records[[i]]
    list(
      id = .vmr_text(item$id %||% paste0("correction_", i)),
      key_variable = .vmr_text(item$key_variable %||% ""),
      key_values = .vmr_universe_values(item$key_values),
      variable = .vmr_text(item$variable %||% ""),
      from_values = .vmr_universe_values(item$from_values),
      to_value = .vmr_text(item$to_value %||% ""),
      reason = .vmr_text(item$reason %||% "")
    )
  })
  Filter(function(item) {
    nzchar(item$key_variable) && length(item$key_values) &&
      nzchar(item$variable) && nzchar(item$to_value)
  }, out)
}

.vmr_universe_exclusion_rules <- function(x) {
  records <- .vmr_universe_records(x)
  out <- lapply(seq_along(records), function(i) {
    item <- records[[i]]
    list(
      id = .vmr_text(item$id %||% paste0("exclusion_", i)),
      variable = .vmr_text(item$variable %||% ""),
      values = .vmr_universe_values(item$values),
      reason = .vmr_text(item$reason %||% "")
    )
  })
  Filter(function(item) nzchar(item$variable) && length(item$values), out)
}

.vmr_universe_count <- function(value, fallback = 0L) {
  out <- suppressWarnings(as.integer(value %||% fallback))[1L]
  if (is.na(out)) as.integer(fallback) else out
}

.vmr_universe_rejection_count <- function(universe) {
  rules <- universe$exclusion_rules %||% list()
  audits <- .vmr_universe_records(universe$exclusion_audit %||% list())
  if (!length(rules)) return(0L)
  rejection_ids <- vapply(rules, function(rule) {
    grepl("rechaz|consent", paste(rule$reason, rule$variable), ignore.case = TRUE)
  }, logical(1))
  if (!any(rejection_ids)) return(0L)
  if (!length(audits)) return(.vmr_universe_count(universe$excluded_rules, 0L))
  audit_counts <- vapply(audits, function(item) .vmr_universe_count(item$excluded, 0L), integer(1))
  audit_ids <- vapply(audits, function(item) .vmr_text(item$id %||% ""), character(1))
  rule_ids <- vapply(rules[rejection_ids], `[[`, character(1), "id")
  sum(audit_counts[audit_ids %in% rule_ids])
}

.vmr_universe_preparation_sentences <- function(universe) {
  corrections <- universe$corrections %||% list()
  exclusions <- universe$exclusion_rules %||% list()
  human_value <- function(value) {
    normalized <- tolower(.vmr_text(value))
    if (identical(normalized, "test")) return("prueba")
    if (identical(normalized, "real")) return("real")
    .vmr_text(value)
  }
  correction_lines <- vapply(corrections, function(item) {
    keys <- paste(item$key_values, collapse = ", ")
    from <- if (length(item$from_values)) {
      paste(vapply(item$from_values, human_value, character(1)), collapse = ", ")
    } else {
      "su clasificación anterior"
    }
    sprintf(
      "%s: se corrigió la clasificación de %s a %s.",
      keys, from, human_value(item$to_value)
    )
  }, character(1))
  exclusion_lines <- vapply(exclusions, function(item) {
    if (grepl("rechaz|consent", paste(item$reason, item$variable), ignore.case = TRUE)) {
      return("Se retiraron las encuestas con rechazo de consentimiento.")
    }
    if (nzchar(item$reason)) return(paste0("Se retiraron las encuestas por ", tolower(item$reason), "."))
    sprintf("Se retiraron las encuestas que cumplían el criterio %s.", item$id)
  }, character(1))
  excluded_test <- .vmr_universe_count(universe$excluded_test, 0L)
  filter_line <- if (excluded_test > 0L) {
    paste0(
      "Después de las correcciones se conservaron las entrevistas reales y se ",
      "retir", if (excluded_test == 1L) "ó " else "aron ", excluded_test,
      if (excluded_test == 1L) " encuesta de prueba." else " encuestas de prueba."
    )
  } else character(0)
  c(correction_lines, filter_line, exclusion_lines)
}

.vmr_universe_formula <- function(universe) {
  variable <- .vmr_text(universe$variable %||% "")
  real_values <- as.character(unlist(universe$real_values %||% character(0), use.names = FALSE))
  test_values <- as.character(unlist(universe$test_values %||% character(0), use.names = FALSE))
  corrections <- .vmr_universe_corrections(universe$corrections %||% list())
  exclusion_rules <- .vmr_universe_exclusion_rules(universe$exclusion_rules %||% list())
  real_values <- real_values[!is.na(real_values)]
  test_values <- test_values[!is.na(test_values)]
  if (!isTRUE(universe$applied) || !nzchar(variable) || !length(real_values)) return("")
  literal <- function(x) paste(deparse(x, width.cutoff = 500L), collapse = "\n")
  has_preparation <- length(corrections) || length(exclusion_rules)
  required_variables <- unique(c(
    variable,
    vapply(corrections, `[[`, character(1), "key_variable"),
    vapply(corrections, `[[`, character(1), "variable"),
    vapply(exclusion_rules, `[[`, character(1), "variable")
  ))
  required_variables <- required_variables[nzchar(required_variables)]
  correction_block <- unlist(lapply(seq_along(corrections), function(i) {
    item <- corrections[[i]]
    match_name <- paste0(".correction_match_", i)
    key_line <- paste0(
      "  as.character(base_preparada[[", literal(item$key_variable), "]]) %in% ",
      literal(item$key_values)
    )
    value_line <- if (length(item$from_values)) paste0(
      "  as.character(base_preparada[[", literal(item$variable), "]]) %in% ",
      literal(item$from_values)
    ) else character(0)
    c(
      paste0("# Corrección: ", .vmr_text(item$reason, item$id)),
      paste0(match_name, " <-"),
      paste0(key_line, if (length(value_line)) " &" else ""),
      value_line,
      paste0("base_preparada[[", literal(item$variable), "]] <- as.character(base_preparada[[", literal(item$variable), "]])"),
      paste0("base_preparada[[", literal(item$variable), "]][", match_name, "] <- ", literal(item$to_value)),
      ""
    )
  }), use.names = FALSE)
  exclusion_block <- unlist(lapply(seq_along(exclusion_rules), function(i) {
    item <- exclusion_rules[[i]]
    match_name <- paste0(".exclusion_match_", i)
    c(
      paste0("# Exclusión: ", .vmr_text(item$reason, item$id)),
      paste0(match_name, " <-"),
      paste0("  as.character(base_preparada[[", literal(item$variable), "]]) %in% ", literal(item$values)),
      paste0(".filter_keep <- .filter_keep & !", match_name),
      ""
    )
  }), use.names = FALSE)
  preparation_start <- if (has_preparation) c(
    "# Trabajar sobre una copia de la base recibida",
    "base_preparada <- data",
    "",
    paste0(".required_preparation_variables <- ", literal(required_variables)),
    "if (!all(.required_preparation_variables %in% names(base_preparada))) {",
    "  stop(",
    "    \"Faltan variables para preparar el universo.\",",
    "    call. = FALSE",
    "  )",
    "}",
    ""
  ) else character(0)
  source_name <- if (has_preparation) "base_preparada" else "data"
  paste(c(
    preparation_start,
    correction_block,
    "# Conservar entrevistas reales y separar las pruebas",
    paste0(".filter_variable <- ", literal(variable)),
    paste0(".filter_real_values <- ", literal(real_values)),
    paste0(".filter_test_values <- ", literal(test_values)),
    paste0(".filter_values <- trimws(as.character(", source_name, "[[.filter_variable]]))"),
    ".filter_missing <- is.na(.filter_values) | !nzchar(.filter_values)",
    ".filter_keep <- !.filter_missing & .filter_values %in% .filter_real_values",
    ".filter_is_test <- !.filter_missing & .filter_values %in% .filter_test_values",
    ".filter_unclassified <- !.filter_keep & !.filter_is_test",
    "",
    exclusion_block,
    paste0("base_validacion <- ", source_name, "[.filter_keep, , drop = FALSE]")
  ), collapse = "\n")
}

.vmr_universe_model <- function(upstream_universe = NULL) {
  universe <- upstream_universe %||% list(applied = FALSE)
  universe$corrections <- .vmr_universe_corrections(universe$corrections %||% list())
  universe$exclusion_rules <- .vmr_universe_exclusion_rules(universe$exclusion_rules %||% list())
  universe$corrected <- .vmr_universe_count(universe$corrected, 0L)
  universe$correction_changes <- .vmr_universe_count(universe$correction_changes, universe$corrected)
  universe$excluded_rules <- .vmr_universe_count(universe$excluded_rules, 0L)
  universe$excluded_rejections <- .vmr_universe_rejection_count(universe)
  universe$formula_r <- .vmr_universe_formula(universe)
  universe$formula_available <- nzchar(universe$formula_r)
  universe
}

.vmr_inconsistency_summary <- function(rules, evaluation_available) {
  if (!isTRUE(evaluation_available)) {
    return(list(
      evaluated = 0L, with_findings = NA_integer_, without_findings = NA_integer_,
      not_evaluated = NA_integer_, not_applicable = NA_integer_, execution_failed = NA_integer_,
      findings_total = NA_real_, reviewed_total = NA_real_, findings_rate = NA_real_,
      by_category = data.frame()
    ))
  }
  valid <- Filter(function(rule) {
    isTRUE(rule$evaluated) && !isTRUE(rule$disabled) && !isTRUE(rule$excluded)
  }, rules)
  active <- Filter(function(rule) !isTRUE(rule$disabled) && !isTRUE(rule$excluded), rules)
  states <- vapply(active, `[[`, character(1), "state")
  finite_findings <- Filter(function(rule) is.finite(rule$findings), valid)
  finite_reviewed <- Filter(function(rule) is.finite(rule$reviewed), valid)
  findings_total <- if (length(finite_findings)) sum(vapply(finite_findings, `[[`, numeric(1), "findings")) else NA_real_
  reviewed_total <- if (length(finite_reviewed)) sum(vapply(finite_reviewed, `[[`, numeric(1), "reviewed")) else NA_real_
  categories <- unique(vapply(valid, `[[`, character(1), "category"))
  by_category <- if (length(categories)) {
    do.call(rbind, lapply(categories, function(category) {
      subset <- Filter(function(rule) identical(rule$category, category), valid)
      subset_findings <- vapply(subset, `[[`, numeric(1), "findings")
      subset_reviewed <- vapply(subset, `[[`, numeric(1), "reviewed")
      data.frame(
        category = category,
        evaluated = length(subset),
        with_findings = sum(is.finite(subset_findings) & subset_findings > 0),
        findings = if (any(is.finite(subset_findings))) sum(subset_findings[is.finite(subset_findings)]) else NA_real_,
        reviewed = if (any(is.finite(subset_reviewed))) sum(subset_reviewed[is.finite(subset_reviewed)]) else NA_real_,
        stringsAsFactors = FALSE
      )
    }))
  } else data.frame()
  list(
    evaluated = length(valid),
    with_findings = if (length(finite_findings)) sum(vapply(finite_findings, `[[`, numeric(1), "findings") > 0) else NA_integer_,
    without_findings = if (length(finite_findings)) sum(vapply(finite_findings, `[[`, numeric(1), "findings") == 0) else NA_integer_,
    not_evaluated = sum(grepl("no[_ ]?evalu|resultado no disponible", states, ignore.case = TRUE, perl = TRUE)),
    not_applicable = sum(grepl("no[_ ]?aplica", states, ignore.case = TRUE, perl = TRUE)),
    execution_failed = sum(grepl("incorrect|error|fall|no se pudo ejecutar|incidencia de ejec", states, ignore.case = TRUE, perl = TRUE)),
    findings_total = findings_total,
    reviewed_total = reviewed_total,
    findings_rate = if (is.finite(findings_total) && is.finite(reviewed_total) && reviewed_total > 0) findings_total / reviewed_total else NA_real_,
    by_category = by_category
  )
}

.vmr_rule_from_bundle <- function(rule, eval_df, eval_id_col, evaluation_available,
                                  disabled_ids = character(0), excluded_variables = character(0),
                                  variable_labels = list(), choice_labels = list(),
                                  internal_variables = character(0), external_labels = list()) {
  id <- .vmr_text(rule$id)
  vars <- .vmr_rule_variables(rule)
  local_labels <- as.list(vars$labels %||% list())
  if (length(local_labels)) {
    local_labels <- local_labels[vapply(names(local_labels), function(code) {
      value <- .vmr_text(local_labels[[code]])
      nzchar(value) && !identical(value, code)
    }, logical(1))]
  }
  shared_labels <- utils::modifyList(as.list(variable_labels %||% list()), local_labels)
  variables_display_by_code <- vapply(vars$codes, function(code) {
    raw_label <- .vmr_text(shared_labels[[code]] %||% "")
    if (!nzchar(raw_label) || identical(raw_label, code)) {
      raw_label <- .vmr_fallback_variable_label(code)
    }
    label <- .vmr_humanize_title(
      raw_label,
      shared_labels,
      choice_labels
    )
    label <- .vmr_external_reference_grammar(label, external_labels)
    if (code %in% internal_variables) return(label)
    if (nzchar(label) && !identical(label, code)) sprintf("%s [%s]", label, code) else code
  }, character(1))
  variables_display <- unique(variables_display_by_code[nzchar(variables_display_by_code)])
  kind <- .vmr_rule_technical_kind(rule)
  formula <- .vmr_rule_formula(rule, kind)
  evaluation <- .vmr_evaluation_for_rule(eval_df, eval_id_col, id, evaluation_available)
  disabled <- id %in% disabled_ids
  excluded <- length(intersect(vars$codes, excluded_variables)) > 0L
  if (disabled) evaluation$state <- "Desactivada en el plan actual"
  if (excluded) evaluation$state <- "Excluida del alcance por variable"
  gate_text <- .vmr_text(rule$presentation$gate_humano %||% rule$presentation$detalle_condicion %||% "")
  target_code <- as.character((rule$variable_roles %||% list())$target %||% character(0))
  target_code <- target_code[!is.na(target_code) & nzchar(target_code)]
  target_label <- if (length(target_code)) {
    raw_target_label <- .vmr_text(shared_labels[[target_code[[1L]]]] %||% "")
    if (!nzchar(raw_target_label) || identical(raw_target_label, target_code[[1L]])) {
      raw_target_label <- .vmr_fallback_variable_label(target_code[[1L]])
    }
    .vmr_humanize_title(
      raw_target_label,
      shared_labels,
      choice_labels
    )
  } else {
    "variable objetivo"
  }
  human_name <- .vmr_humanize_title(
    .vmr_text(rule$presentation$nombre_humano %||% rule$nombre, id),
    shared_labels,
    choice_labels
  )
  human_validates <- .vmr_humanize_title(
    .vmr_text(rule$objetivo %||% rule$presentation$objetivo, .vmr_default_narrative(rule$tipo_regla, paste(variables_display, collapse = ", "))),
    shared_labels,
    choice_labels
  )
  if (identical(human_name, "Salto - debe responderse")) {
    human_name <- paste0("«", target_label, "» debe responderse cuando corresponde")
  } else if (identical(human_name, "Salto - no debe responderse")) {
    human_name <- paste0("«", target_label, "» debe permanecer sin respuesta cuando no corresponde")
  }
  human_name <- gsub("«\\s*»", paste0("«", target_label, "»"), human_name, perl = TRUE)
  human_validates <- gsub("«\\s*»", paste0("«", target_label, "»"), human_validates, perl = TRUE)
  human_name <- .vmr_external_reference_grammar(human_name, external_labels)
  human_validates <- .vmr_external_reference_grammar(human_validates, external_labels)
  applies_when <- if (nzchar(gate_text)) {
    .vmr_external_reference_grammar(
      .vmr_humanize_title(gate_text, shared_labels, choice_labels),
      external_labels
    )
  } else {
    "Se aplica a los registros en los que la pregunta o control corresponde."
  }
  list(
    id = id,
    name = human_name,
    source = .vmr_text(rule$fuente, "Instrumento"),
    type = .vmr_text(rule$tipo_regla, "regla"),
    category = .vmr_text(rule$categoria_ux %||% rule$tipo_regla, "Consistencia"),
    severity = .vmr_text(rule$severidad, "Informativa"),
    table = .vmr_text(rule$tabla, "principal"),
    variables = vars$codes,
    variables_display = variables_display,
    variable_display_by_code = as.list(variables_display_by_code),
    target_variable = if (length(target_code)) target_code[[1L]] else "",
    applies_when = applies_when,
    validates = human_validates,
    violation = "Se señala el registro cuando no cumple la condición descrita.",
    action = .vmr_remediation_text(rule$remediation_default),
    state = evaluation$state,
    reviewed = evaluation$reviewed,
    findings = evaluation$findings,
    evaluated = isTRUE(evaluation$available) && !disabled && !excluded,
    disabled = disabled,
    excluded = excluded,
    formula_kind = kind,
    technical_label = .vmr_technical_label(kind),
    formula_raw = formula$raw,
    formula = formula$display,
    source_expression = formula$source,
    rule_hash = .vmr_text(rule$predicate_hash %||% ""),
    ast_ops = unique(c(.vmr_ast_ops(rule$predicate), .vmr_ast_ops(rule$gate)))
  )
}

.vmr_rule_context_candidates <- function(rule) {
  by_code <- unlist(rule$variable_display_by_code %||% list(), use.names = TRUE)
  if (!length(by_code)) return(character(0))
  target <- .vmr_text(rule$target_variable %||% "")
  if (nzchar(target)) by_code <- by_code[names(by_code) != target]
  labels <- sub("\\s*\\[[^]]+\\]\\s*$", "", as.character(by_code), perl = TRUE)
  unique(labels[!is.na(labels) & nzchar(trimws(labels))])
}

.vmr_disambiguate_rule_names <- function(rules) {
  if (length(rules) < 2L) return(rules)
  rule_names <- vapply(rules, `[[`, character(1), "name")
  duplicated_names <- unique(rule_names[duplicated(rule_names)])
  for (duplicated_name in duplicated_names) {
    indices <- which(rule_names == duplicated_name)
    candidates <- lapply(rules[indices], .vmr_rule_context_candidates)
    common <- if (length(candidates)) Reduce(intersect, candidates) else character(0)
    for (j in seq_along(indices)) {
      context <- setdiff(candidates[[j]], common)
      if (!length(context)) context <- candidates[[j]]
      if (!length(context)) {
        context <- if (identical(.vmr_text(rules[[indices[[j]]]]$table), "principal")) {
          "la base principal"
        } else {
          "la sección relacionada del formulario"
        }
      }
      rules[[indices[[j]]]]$name <- paste0(
        "En relación con «", context[[1L]], "»: ", duplicated_name
      )
    }
    refreshed <- vapply(rules[indices], `[[`, character(1), "name")
    if (anyDuplicated(refreshed)) {
      duplicated_groups <- split(seq_along(refreshed), refreshed)
      for (group in duplicated_groups[lengths(duplicated_groups) > 1L]) {
        for (position in seq_along(group)) {
          idx <- indices[[group[[position]]]]
          rules[[idx]]$name <- paste0(rules[[idx]]$name, " · comprobación ", position)
        }
      }
    }
    rule_names[indices] <- vapply(rules[indices], `[[`, character(1), "name")
  }
  rules
}

.vmr_rule_from_plan <- function(plan, i, eval_df, eval_id_col, evaluation_available, base_nombre) {
  id <- .vmr_value(plan, i, c("id_regla", "rule_id", "id"), sprintf("regla_%04d", i))
  type <- .vmr_value(plan, i, c("tipo_regla", "tipo", "rule_type"), "regla")
  variables <- vapply(1:3, function(j) .vmr_value(plan, i, c(sprintf("Variable %d", j)), ""), character(1))
  variables <- unique(variables[nzchar(variables)])
  labels <- vapply(seq_along(variables), function(j) {
    label <- .vmr_value(plan, i, c(sprintf("Variable %d - Etiqueta", j)), "")
    if (nzchar(label)) sprintf("%s [%s]", label, variables[[j]]) else variables[[j]]
  }, character(1))
  evaluation <- .vmr_evaluation_for_rule(eval_df, eval_id_col, id, evaluation_available)
  list(
    id = id,
    name = .vmr_value(plan, i, c("Nombre de regla", "nombre_regla", "nombre", "regla", "descripcion"), id),
    source = .vmr_value(plan, i, c("_fuente", "fuente", "origen", "source"), "Plan importado"),
    type = type,
    category = .vmr_value(plan, i, c("_categoria_ux", "categoria", "familia", "category"), type),
    severity = .vmr_value(plan, i, c("_severidad", "severidad", "severity", "nivel"), "Informativa"),
    table = .vmr_value(plan, i, c("tabla", "base", "repeat_group", "hoja"), .vmr_text(base_nombre, "Base activa")),
    variables = variables,
    variables_display = labels,
    applies_when = "Se aplica según la condición declarada en el plan importado.",
    validates = .vmr_value(plan, i, c("objetivo", "que_valida", "descripcion", "regla", "narrativa"), .vmr_default_narrative(type, paste(labels, collapse = ", "))),
    violation = "Se señala el registro cuando no cumple la condición descrita.",
    action = "Revisar el caso y documentar la decisión antes de modificar la base.",
    state = evaluation$state,
    reviewed = evaluation$reviewed,
    findings = evaluation$findings,
    evaluated = isTRUE(evaluation$available),
    disabled = FALSE,
    excluded = FALSE,
    formula_kind = "not_executed",
    technical_label = .vmr_technical_label("not_executed"),
    formula_raw = "",
    formula = "El plan importado conserva la expresión como referencia, pero no se ejecuta en el script entregable sin un AST verificable.",
    source_expression = .vmr_value(plan, i, c("Procesamiento (R)", "Procesamiento", "formula_r", "r_expression", "processing"), ""),
    rule_hash = .vmr_value(plan, i, c("_rule_hash"), ""),
    ast_ops = character(0)
  )
}

build_validation_methodology_report_model <- function(scope,
                                                       base_nombre = NULL,
                                                       estudio_nombre = NULL,
                                                       upstream_universe = NULL,
                                                       generated_at = Sys.time()) {
  plan <- .vmr_df((scope$plan_result %||% list())$plan %||% NULL)
  if (!nrow(plan)) stop_api(409, "E_NO_PLAN", "No hay un plan de validacion construido para generar el reporte.")
  eval_df <- .vmr_eval_table(scope$evaluacion %||% list())
  eval_id_col <- .vmr_col(eval_df, c("id_regla", "rule_id", "id"))
  evaluation_available <- nrow(eval_df) > 0L && nzchar(eval_id_col)

  disabled_ids <- as.character(scope$reglas_desactivadas %||% character(0))
  excluded_variables <- as.character(scope$variables_excluidas %||% character(0))
  bundle_rules <- (scope$plan_result %||% list())$bundle$rules %||% list()
  shared_variable_labels <- list()
  external_variable_labels <- list()
  for (bundle_rule in bundle_rules) {
    inferred <- .vmr_external_target_label(bundle_rule)
    if (length(inferred)) {
      for (code in names(inferred)) {
        external_variable_labels[[code]] <- inferred[[code]]
        current <- .vmr_text(shared_variable_labels[[code]] %||% "")
        if (!nzchar(current) || identical(current, code)) {
          shared_variable_labels[[code]] <- inferred[[code]]
        }
      }
    }
    labels <- as.list((bundle_rule$variable_roles %||% list())$labels %||% list())
    labels <- labels[vapply(names(labels), function(code) {
      value <- .vmr_text(labels[[code]])
      nzchar(value) && !identical(value, code)
    }, logical(1))]
    shared_variable_labels <- utils::modifyList(shared_variable_labels, labels)
  }
  shared_choice_labels <- .vmr_choice_labels_by_variable(
    bundle_rules,
    (scope$plan_result %||% list())$bundle$choices_map %||% list()
  )
  internal_variables <- .vmr_internal_choice_variables(bundle_rules, shared_choice_labels)
  for (code in internal_variables) {
    current <- .vmr_text(shared_variable_labels[[code]] %||% "")
    if (!nzchar(current) || identical(current, code)) shared_variable_labels[[code]] <- "opción evaluada"
  }
  rules <- if (length(bundle_rules)) {
    lapply(bundle_rules, .vmr_rule_from_bundle,
      eval_df = eval_df, eval_id_col = eval_id_col,
      evaluation_available = evaluation_available,
      disabled_ids = disabled_ids,
      excluded_variables = excluded_variables,
      variable_labels = shared_variable_labels,
      choice_labels = shared_choice_labels,
      internal_variables = internal_variables,
      external_labels = external_variable_labels
    )
  } else {
    lapply(seq_len(nrow(plan)), function(i) {
      .vmr_rule_from_plan(plan, i, eval_df, eval_id_col, evaluation_available, base_nombre)
    })
  }
  rules <- .vmr_disambiguate_rule_names(rules)

  ids <- vapply(rules, `[[`, character(1), "id")
  if (anyDuplicated(ids)) {
    stop_api(409, "E_REGLAS_DUPLICADAS", sprintf("El inventario contiene identificadores de regla duplicados: %s.", paste(unique(ids[duplicated(ids)]), collapse = ", ")))
  }

  kinds <- vapply(rules, `[[`, character(1), "formula_kind")
  operational_config <- scope$operational_config %||% (scope$plan_result %||% list())$operational_config %||% list()
  unsupported <- (scope$plan_result %||% list())$bundle$unsupported %||% list()
  universe_model <- .vmr_universe_model(upstream_universe)
  inconsistency_summary <- .vmr_inconsistency_summary(rules, evaluation_available)
  inventory_hash <- digest::digest(list(
    ids = ids,
    hashes = vapply(rules, `[[`, character(1), "rule_hash"),
    kinds = kinds,
    disabled = sort(disabled_ids),
    excluded = sort(excluded_variables),
    unsupported = unsupported
  ), algo = "sha256", serialize = TRUE)
  list(
    schema = "validation_methodology_report_v2",
    title = "Plan de validación y limpieza",
    base_nombre = .vmr_text(base_nombre, "Base activa"),
    estudio_nombre = .vmr_text(estudio_nombre, "Estudio"),
    generated_at = format(as.POSIXct(generated_at), "%Y-%m-%d %H:%M %Z"),
    evaluation_available = evaluation_available,
    run_certified = FALSE,
    inventory_hash = inventory_hash,
    upstream_universe = universe_model,
    operational_config = operational_config,
    disabled_rule_ids = as.list(disabled_ids),
    excluded_variables = as.list(excluded_variables),
    unsupported = unsupported,
    rules = rules,
    summary = list(
      total = length(rules),
      active = sum(!vapply(rules, function(rule) isTRUE(rule$disabled) || isTRUE(rule$excluded), logical(1))),
      evaluated = inconsistency_summary$evaluated,
      with_findings = inconsistency_summary$with_findings,
      without_findings = inconsistency_summary$without_findings,
      not_evaluated = inconsistency_summary$not_evaluated,
      not_applicable = inconsistency_summary$not_applicable,
      execution_failed = inconsistency_summary$execution_failed,
      findings_total = inconsistency_summary$findings_total,
      reviewed_total = inconsistency_summary$reviewed_total,
      findings_rate = inconsistency_summary$findings_rate,
      by_category = inconsistency_summary$by_category,
      exact_r = sum(kinds == "exact_r"),
      specialized_runtime = sum(kinds == "specialized_runtime"),
      source_odk = sum(kinds == "source_odk"),
      not_executed = sum(kinds == "not_executed"),
      disabled = length(disabled_ids),
      excluded = length(excluded_variables),
      unsupported = length(unsupported)
    )
  )
}

.vmr_wrap <- function(text, width = 100L) paste(strwrap(.vmr_text(text), width = width), collapse = "\n")

.vmr_page <- function(title, subtitle = "") {
  grid::grid.newpage()
  grid::grid.rect(gp = grid::gpar(fill = "#F4F7FB", col = NA))
  grid::grid.rect(x = 0.5, y = 0.975, width = 0.92, height = 0.008, gp = grid::gpar(fill = "#082E67", col = NA))
  grid::grid.text("PULSO PUCP", x = 0.06, y = 0.95, just = "left", gp = grid::gpar(col = "#082E67", fontsize = 10, fontface = "bold"))
  grid::grid.text(title, x = 0.06, y = 0.91, just = "left", gp = grid::gpar(col = "#172238", fontsize = 20, fontface = "bold"))
  if (nzchar(subtitle)) grid::grid.text(subtitle, x = 0.06, y = 0.875, just = "left", gp = grid::gpar(col = "#66738A", fontsize = 9))
}

.vmr_card <- function(x, y, w, label, value, accent = "#168A55") {
  grid::grid.roundrect(x = x, y = y, width = w, height = 0.12, r = grid::unit(3, "mm"), gp = grid::gpar(fill = "white", col = "#D6E0EE"))
  grid::grid.rect(x = x - w / 2 + 0.005, y = y, width = 0.01, height = 0.12, gp = grid::gpar(fill = accent, col = NA))
  grid::grid.text(label, x = x - w / 2 + 0.025, y = y + 0.025, just = "left", gp = grid::gpar(col = "#66738A", fontsize = 8))
  grid::grid.text(as.character(value), x = x - w / 2 + 0.025, y = y - 0.018, just = "left", gp = grid::gpar(col = "#172238", fontsize = 18, fontface = "bold"))
}

.vmr_pdf_theme <- function() {
  list(
    navy = "#062F68",
    navy_dark = "#041E42",
    ink = "#172238",
    text = "#35435A",
    muted = "#68768C",
    line = "#D4DFEC",
    paper = "#F4F7FB",
    white = "#FFFFFF",
    teal = "#008C95",
    mint = "#63D2C6",
    green = "#18865A",
    amber = "#C98314",
    rose = "#B14B58",
    code = "#082E67",
    soft_blue = "#EAF1F8",
    soft_teal = "#E7F5F4",
    soft_amber = "#FFF6E5"
  )
}

.vmr_category_label <- function(x) {
  key <- tolower(.vmr_text(x, "consistencia"))
  labels <- c(
    completitud = "Completitud",
    saltos = "Lógica de saltos",
    experto = "Condiciones avanzadas",
    consistencia = "Consistencia interna",
    estructura = "Estructura del formulario",
    roster_externo = "Correspondencia con listas externas",
    coherencia = "Coherencia entre respuestas",
    duplicados = "Registros duplicados",
    calculos = "Cálculos derivados",
    `cálculos` = "Cálculos derivados"
  )
  if (key %in% names(labels)) return(unname(labels[[key]]))
  label <- gsub("_+", " ", key)
  paste0(toupper(substr(label, 1L, 1L)), substr(label, 2L, nchar(label)))
}

.vmr_result_family_rows <- function(by_category, max_rows = 7L) {
  if (!is.data.frame(by_category) || !all(c("category", "evaluated") %in% names(by_category))) {
    return(data.frame(label = character(0), evaluated = numeric(0), share = numeric(0)))
  }
  max_rows <- max(1L, as.integer(max_rows %||% 7L))
  evaluated <- suppressWarnings(as.numeric(by_category$evaluated))
  keep <- is.finite(evaluated) & evaluated > 0
  if (!any(keep)) {
    return(data.frame(label = character(0), evaluated = numeric(0), share = numeric(0)))
  }
  rows <- data.frame(
    label = vapply(by_category$category[keep], .vmr_category_label, character(1)),
    evaluated = evaluated[keep],
    stringsAsFactors = FALSE
  )
  rows <- rows[order(rows$evaluated, decreasing = TRUE, rows$label), , drop = FALSE]
  if (nrow(rows) > max_rows) {
    visible_count <- max(0L, max_rows - 1L)
    visible <- if (visible_count) rows[seq_len(visible_count), , drop = FALSE] else rows[0, , drop = FALSE]
    remainder <- rows[seq.int(visible_count + 1L, nrow(rows)), , drop = FALSE]
    rows <- rbind(
      visible,
      data.frame(label = "Otras familias", evaluated = sum(remainder$evaluated), stringsAsFactors = FALSE)
    )
  }
  total <- sum(rows$evaluated)
  rows$share <- if (is.finite(total) && total > 0) rows$evaluated / total else 0
  rownames(rows) <- NULL
  rows
}

.vmr_category_description <- function(x) {
  key <- tolower(.vmr_text(x, "consistencia"))
  descriptions <- c(
    completitud = "Verifica que las respuestas requeridas estén presentes cuando corresponde.",
    saltos = "Comprueba que cada entrevista siga las rutas y condiciones definidas por el instrumento.",
    experto = "Reúne condiciones especializadas que requieren una lectura técnica adicional.",
    consistencia = "Contrasta respuestas relacionadas para detectar combinaciones incompatibles.",
    estructura = "Comprueba la integridad de grupos, listas y relaciones internas del formulario.",
    roster_externo = "Contrasta la información declarada con listas o estructuras relacionadas.",
    coherencia = "Evalúa la correspondencia lógica entre respuestas de una misma entrevista.",
    duplicados = "Identifica registros iguales o con una alta similitud en las respuestas seleccionadas.",
    calculos = "Recalcula totales, porcentajes y resultados derivados para comprobar su consistencia.",
    `cálculos` = "Recalcula totales, porcentajes y resultados derivados para comprobar su consistencia."
  )
  if (key %in% names(descriptions)) return(unname(descriptions[[key]]))
  "Otras reglas de revisión de la base."
}

.vmr_logo_path <- function() {
  search_roots <- unique(vapply(
    0:6,
    function(depth) {
      path <- getwd()
      if (depth > 0L) {
        for (i in seq_len(depth)) path <- dirname(path)
      }
      normalizePath(path, winslash = "/", mustWork = FALSE)
    },
    character(1)
  ))
  candidates <- c(
    system.file("manuales_qmd/files_manuales/img/logo_pulso.png", package = "prosecnurapp"),
    file.path(search_roots, "api", "inst", "manuales_qmd", "files_manuales", "img", "logo_pulso.png"),
    file.path(search_roots, "inst", "manuales_qmd", "files_manuales", "img", "logo_pulso.png")
  )
  candidates <- candidates[nzchar(candidates) & file.exists(candidates)]
  if (length(candidates)) normalizePath(candidates[[1L]], winslash = "/", mustWork = FALSE) else ""
}

.vmr_raster_height_inches <- function(img, width_inches) {
  dimensions <- dim(img)
  if (length(dimensions) < 2L || dimensions[[1L]] <= 0L || dimensions[[2L]] <= 0L) {
    stop("La imagen no tiene dimensiones válidas.", call. = FALSE)
  }
  as.numeric(width_inches) * dimensions[[1L]] / dimensions[[2L]]
}

.vmr_rule_wrap_widths <- function() {
  c(description = 100L, formula = 104L)
}

.vmr_deparse_r <- function(expression) {
  paste(deparse(expression, width.cutoff = 500L), collapse = " ")
}

.vmr_pretty_r_formula <- function(text, width = 90L) {
  source <- .vmr_text(text)
  if (!nzchar(source)) return("")
  width <- max(32L, as.integer(width %||% 90L))
  parsed <- tryCatch(parse(text = source, keep.source = FALSE), error = function(e) NULL)
  if (is.null(parsed) || !length(parsed)) return(source)

  call_name <- function(node) {
    if (!is.call(node)) return("")
    .vmr_deparse_r(node[[1L]])
  }
  flatten_operator <- function(node, operator) {
    if (is.call(node) && identical(call_name(node), operator) && length(node) == 3L) {
      return(c(flatten_operator(node[[2L]], operator), flatten_operator(node[[3L]], operator)))
    }
    list(node)
  }
  append_suffix <- function(lines, suffix) {
    lines[[length(lines)]] <- paste0(lines[[length(lines)]], suffix)
    lines
  }
  pack_values <- function(values, available) {
    out <- character(0)
    current <- ""
    for (value in values) {
      token <- if (nzchar(current)) paste0(", ", value) else value
      if (nzchar(current) && nchar(paste0(current, token), type = "width") > available) {
        out <- c(out, paste0(current, ","))
        current <- value
      } else {
        current <- paste0(current, token)
      }
    }
    c(out, current)
  }
  unwrap_parentheses <- function(node) {
    while (is.call(node) && identical(call_name(node), "(") && length(node) == 2L) {
      node <- node[[2L]]
    }
    node
  }

  format_node <- function(node, available = width, top_level = FALSE) {
    if (is.call(node) && identical(call_name(node), "(") && length(node) == 2L && isTRUE(top_level)) {
      return(format_node(unwrap_parentheses(node), available, top_level = TRUE))
    }

    single <- .vmr_deparse_r(node)
    if (!is.call(node)) return(single)

    operator <- call_name(node)
    # Este helper aparece muchas veces dentro de condiciones de salto. Mantenerlo
    # en una sola línea evita convertir una llamada breve en seis líneas solo por
    # la profundidad de los paréntesis que la contienen.
    if (identical(operator, ".vd_cmp_const_eq") &&
        nchar(single, type = "width") <= width) {
      return(single)
    }
    if (operator %in% c("|", "&", "||", "&&")) {
      parts <- flatten_operator(node, operator)
      if (length(parts) < 3L && nchar(single, type = "width") <= available) return(single)
      lines <- character(0)
      for (i in seq_along(parts)) {
        part_lines <- format_node(parts[[i]], max(24L, available - if (i > 1L) 2L else 0L))
        if (i < length(parts)) part_lines <- append_suffix(part_lines, paste0(" ", operator))
        if (i > 1L) part_lines <- paste0("  ", part_lines)
        lines <- c(lines, part_lines)
      }
      return(lines)
    }

    if (nchar(single, type = "width") <= available) return(single)

    infix_operators <- c(
      "+", "-", "*", "/", "^", "%%", "%/%", "%in%", ":",
      "==", "!=", "<", "<=", ">", ">=", "$", "@", "::", ":::"
    )
    if (operator %in% infix_operators && length(node) == 3L) {
      left <- format_node(node[[2L]], max(20L, available - 3L))
      right <- format_node(node[[3L]], max(20L, available - 2L))
      left <- append_suffix(left, paste0(" ", operator))
      return(c(left, paste0("  ", right)))
    }

    if (operator %in% c("!", "+", "-", "~") && length(node) == 2L) {
      inner <- format_node(unwrap_parentheses(node[[2L]]), max(20L, available - 3L))
      return(c(paste0(operator, "("), paste0("  ", inner), ")"))
    }

    if (operator %in% c("[", "[[")) {
      return(deparse(node, width.cutoff = max(32L, available)))
    }

    if (operator %in% c("<-", "=", "~") && length(node) == 3L) {
      left <- .vmr_deparse_r(node[[2L]])
      right <- format_node(node[[3L]], max(24L, available - 2L))
      if (length(right) == 1L && nchar(paste(left, operator, right), type = "width") <= available) {
        return(paste(left, operator, right))
      }
      return(c(paste(left, operator), paste0("  ", right)))
    }

    if (identical(operator, "(") && length(node) == 2L) {
      inner <- format_node(unwrap_parentheses(node[[2L]]), max(24L, available - 4L))
      if (length(inner) == 1L) return(paste0("(", inner, ")"))
      inner[[1L]] <- paste0("(", inner[[1L]])
      inner[[length(inner)]] <- paste0(inner[[length(inner)]], ")")
      return(inner)
    }

    if (identical(operator, "c")) {
      values <- vapply(as.list(node)[-1L], .vmr_deparse_r, character(1))
      packed <- pack_values(values, max(20L, available - 4L))
      return(c("c(", paste0("  ", packed), ")"))
    }

    if (operator %in% c("{", "if", "for", "while", "function")) {
      return(deparse(node, width.cutoff = max(32L, available)))
    }

    arguments <- as.list(node)[-1L]
    argument_names <- names(arguments) %||% rep("", length(arguments))
    lines <- paste0(operator, "(")
    if (!length(arguments)) return(paste0(operator, "()"))
    for (i in seq_along(arguments)) {
      prefix <- if (nzchar(argument_names[[i]])) paste0(argument_names[[i]], " = ") else ""
      argument_lines <- format_node(
        arguments[[i]],
        max(20L, available - 2L - nchar(prefix, type = "width"))
      )
      argument_lines[[1L]] <- paste0(prefix, argument_lines[[1L]])
      if (i < length(arguments)) argument_lines <- append_suffix(argument_lines, ",")
      lines <- c(lines, paste0("  ", argument_lines))
    }
    c(lines, ")")
  }

  formatted <- unlist(
    lapply(parsed, format_node, available = width, top_level = TRUE),
    use.names = FALSE
  )
  paste(formatted, collapse = "\n")
}

.vmr_client_r_formula <- function(text) {
  out <- .vmr_text(text)
  if (!nzchar(out)) return("")
  out <- gsub(
    "if\\s*\\(exists\\([\"']\\.__choices_map__[\"'],\\s*inherits\\s*=\\s*TRUE\\)\\)\\s*`?\\.__choices_map__`?\\s*else\\s*NULL",
    ".opciones",
    out,
    perl = TRUE
  )
  gsub(".__eval_data__", "data", out, fixed = TRUE)
}

.vmr_numbered_rule_title <- function(number, title) {
  title <- .vmr_text(title, "Regla sin título")
  consistency_parts <- strsplit(title, " Consistencia · «", fixed = TRUE)[[1L]]
  if (length(consistency_parts) == 2L) {
    base_title <- trimws(consistency_parts[[1L]])
    repeated_title <- sub("»$", "", trimws(consistency_parts[[2L]]))
    if (identical(base_title, repeated_title)) title <- paste0("Consistencia de «", base_title, "»")
  }
  display_title <- if (grepl("«", title, fixed = TRUE)) title else paste0("«", title, "»")
  sprintf("Regla %d: %s", as.integer(number), display_title)
}

.vmr_ordered_rule_indices <- function(rules) {
  if (!length(rules)) return(integer(0))
  categories <- vapply(
    rules,
    function(rule) .vmr_text(rule$category, "consistencia"),
    character(1)
  )
  unlist(lapply(unique(categories), function(category) which(categories == category)), use.names = FALSE)
}

.vmr_presented_rule_indices <- function(model) {
  rules <- model$rules %||% list()
  ordered <- .vmr_ordered_rule_indices(rules)
  if (!isTRUE(model$evaluation_available)) return(ordered)
  applied <- vapply(
    rules,
    function(rule) isTRUE(rule$evaluated) && !isTRUE(rule$disabled) && !isTRUE(rule$excluded),
    logical(1)
  )
  ordered[applied[ordered]]
}

.vmr_rule_formula_label <- function(rule) {
  kind <- .vmr_text(rule$formula_kind, "not_executed")
  if (identical(kind, "exact_r")) return("Fórmula R de comprobación")
  if (identical(kind, "source_odk") && isTRUE(rule$evaluated)) return("Expresión usada en la comprobación")
  if (identical(kind, "source_odk")) return("Expresión del formulario original")
  if (identical(kind, "specialized_runtime")) return("Comprobación con estructura relacionada")
  "Sin fórmula R verificable"
}

.vmr_rule_formula_text <- function(rule, width = 104L) {
  kind <- .vmr_text(rule$formula_kind, "not_executed")
  text <- if (identical(kind, "exact_r")) {
    rule$formula_raw
  } else if (identical(kind, "source_odk")) {
    .vmr_text(rule$source_expression, rule$formula)
  } else if (identical(kind, "specialized_runtime")) {
    "Usa la base principal y la tabla relacionada para comprobar esta condición."
  } else {
    rule$formula
  }
  if (identical(kind, "exact_r") || (identical(kind, "source_odk") && isTRUE(rule$evaluated))) {
    return(.vmr_pretty_r_formula(.vmr_client_r_formula(text), width = width))
  }
  .vmr_text(text)
}

.vmr_script_comment <- function(text, width = 108L) {
  value <- .vmr_text(text)
  if (!nzchar(value)) return("#")
  source_lines <- strsplit(value, "\n", fixed = TRUE)[[1L]]
  wrapped <- unlist(lapply(source_lines, function(line) {
    pieces <- strwrap(line, width = width)
    if (length(pieces)) pieces else ""
  }), use.names = FALSE)
  paste0("# ", wrapped)
}

.vmr_script_count <- function(value, fallback = "-") {
  number <- suppressWarnings(as.numeric(value))
  if (!length(number) || !is.finite(number[[1L]])) return(fallback)
  format(number[[1L]], big.mark = ",", scientific = FALSE, trim = TRUE)
}

.vmr_rule_uses_repeat_rows <- function(rule) {
  !identical(.vmr_text(rule$table, "principal"), "principal")
}

.vmr_script_result_lines <- function(rule, parent_total = NA_real_) {
  if (isTRUE(rule$evaluated)) {
    lines <- character(0)
    if (is.finite(rule$reviewed)) {
      reviewed_label <- if (.vmr_rule_uses_repeat_rows(rule)) "Respuestas evaluadas" else "Encuestas evaluadas"
      lines <- c(lines, paste0("# ", reviewed_label, ": ", .vmr_script_count(rule$reviewed)))
      if (.vmr_rule_uses_repeat_rows(rule) && is.finite(suppressWarnings(as.numeric(parent_total)))) {
        lines <- c(lines, paste0("# Encuestas incluidas: ", .vmr_script_count(parent_total)))
      }
    }
    if (is.finite(rule$reviewed) && is.finite(rule$findings)) {
      lines <- c(lines, paste0("# Sin casos: ", .vmr_script_count(max(0, rule$reviewed - rule$findings))))
    }
    if (is.finite(rule$findings)) {
      lines <- c(lines, paste0("# Casos encontrados: ", .vmr_script_count(rule$findings)))
    }
    if (length(lines)) return(lines)
  }
  paste0("# Estado: ", .vmr_text(rule$state, "Resultado no disponible"))
}

.vmr_pdf_rule_description <- function(text, category, width = 100L, max_lines = 7L) {
  text <- .vmr_text(text, "Comprueba el criterio definido para esta regla.")
  if (length(strwrap(text, width = width)) <= max_lines) return(text)
  category_label <- tolower(.vmr_category_label(category))
  paste0(
    "Comprueba una condición de ", category_label,
    " en los registros a los que corresponde la regla. ",
    "La fórmula R conserva el criterio completo, incluidas todas sus combinaciones y condiciones de aplicación."
  )
}

.vmr_draw_brand <- function(x, y, width = 0.15, on_dark = FALSE) {
  logo <- .vmr_logo_path()
  if (nzchar(logo) && requireNamespace("png", quietly = TRUE)) {
    img <- png::readPNG(logo)
    logo_width <- grid::unit(width, "npc")
    logo_width_inches <- grid::convertWidth(logo_width, "in", valueOnly = TRUE)
    logo_height <- grid::unit(.vmr_raster_height_inches(img, logo_width_inches), "in")
    if (isTRUE(on_dark)) {
      grid::grid.roundrect(
        x = x, y = y,
        width = logo_width + grid::unit(4, "mm"),
        height = logo_height + grid::unit(4, "mm"),
        r = grid::unit(2.5, "mm"),
        gp = grid::gpar(fill = "white", col = NA)
      )
    }
    grid::grid.raster(img, x = x, y = y, width = logo_width, height = logo_height, interpolate = TRUE)
  } else {
    grid::grid.text(
      "PULSO\nPUCP", x = x, y = y, just = "center",
      gp = grid::gpar(col = if (isTRUE(on_dark)) "white" else "#062F68", fontsize = 10, fontface = "bold", lineheight = 0.86)
    )
  }
}

.vmr_generated_label <- function(x) {
  parsed <- suppressWarnings(as.POSIXct(x, tz = "America/Lima"))
  if (is.na(parsed)) return(.vmr_text(x))
  months <- c("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre")
  sprintf("%d de %s de %d", as.integer(format(parsed, "%d")), months[[as.integer(format(parsed, "%m"))]], as.integer(format(parsed, "%Y")))
}

.vmr_short_date_label <- function(x) {
  value <- suppressWarnings(as.Date(x))
  if (is.na(value)) return(.vmr_text(x))
  months <- c("ene.", "feb.", "mar.", "abr.", "may.", "jun.",
              "jul.", "ago.", "set.", "oct.", "nov.", "dic.")
  sprintf("%d %s %d", as.integer(format(value, "%d")),
          months[[as.integer(format(value, "%m"))]],
          as.integer(format(value, "%Y")))
}

.vmr_dput_lines <- function(x) {
  paste(utils::capture.output(dput(x)), collapse = "\n")
}

.vmr_runtime_helper_sources <- function(formulas) {
  formulas <- formulas[nzchar(formulas)]
  hits <- unique(unlist(regmatches(
    formulas,
    gregexpr("\\.(?:vd|legacy|AGG)_[A-Za-z0-9_.]+", formulas, perl = TRUE)
  ), use.names = FALSE))
  if (any(grepl("\\bnumber\\s*\\(", formulas, perl = TRUE))) hits <- c(hits, ".vd_odk_number")
  if (any(grepl("\\bint\\s*\\(", formulas, perl = TRUE))) hits <- c(hits, ".vd_odk_int")
  queue <- unique(hits[nzchar(hits)])
  found <- list()
  while (length(queue)) {
    name <- queue[[1L]]
    queue <- queue[-1L]
    if (name %in% names(found) || !exists(name, mode = "function", inherits = TRUE)) next
    fun <- get(name, mode = "function", inherits = TRUE)
    found[[name]] <- fun
    globals <- tryCatch({
      discovered <- codetools::findGlobals(fun, merge = FALSE)
      unique(c(discovered$functions, discovered$variables))
    }, error = function(e) character(0))
    globals <- globals[vapply(globals, function(candidate) {
      startsWith(candidate, ".") && exists(candidate, mode = "function", inherits = TRUE)
    }, logical(1))]
    queue <- unique(c(queue, setdiff(globals, names(found))))
  }
  if (!length(found)) return(character(0))
  vapply(names(found), function(name) {
    lhs <- if (make.names(name) == name) name else paste0("`", name, "`")
    paste0(lhs, " <- ", paste(deparse(found[[name]], width.cutoff = 500L), collapse = "\n"))
  }, character(1), USE.NAMES = FALSE)
}

.vmr_script_manifest <- function(model, rule_order = NULL) {
  rules <- model$rules %||% list()
  if (is.null(rule_order)) rule_order <- .vmr_ordered_rule_indices(rules)
  rules <- rules[rule_order]
  rule_number <- function(rule, field) {
    value <- suppressWarnings(as.numeric(rule[[field]] %||% NA_real_))
    if (length(value) && is.finite(value[[1L]])) value[[1L]] else NA_real_
  }
  data.frame(
    numero_regla = seq_along(rules),
    rule_id = vapply(rules, `[[`, character(1), "id"),
    nombre = vapply(rules, `[[`, character(1), "name"),
    que_comprueba = vapply(rules, `[[`, character(1), "validates"),
    tabla = vapply(rules, `[[`, character(1), "table"),
    familia = vapply(rules, `[[`, character(1), "category"),
    severidad = vapply(rules, `[[`, character(1), "severity"),
    variables = vapply(rules, function(rule) paste(rule$variables_display %||% character(0), collapse = " | "), character(1)),
    variables_tecnicas = vapply(rules, function(rule) paste(rule$variables %||% character(0), collapse = "|"), character(1)),
    estado_tecnico = vapply(
      rules,
      function(rule) .vmr_technical_label(rule$formula_kind %||% "not_executed"),
      character(1)
    ),
    executable = vapply(rules, function(rule) identical(rule$formula_kind, "exact_r") && nzchar(rule$formula_raw), logical(1)),
    unidad_evaluada = vapply(rules, function(rule) {
      if (.vmr_rule_uses_repeat_rows(rule)) "respuesta" else "encuesta"
    }, character(1)),
    unidades_evaluadas = vapply(rules, rule_number, numeric(1), field = "reviewed"),
    casos_encontrados = vapply(rules, rule_number, numeric(1), field = "findings"),
    rule_hash = vapply(rules, `[[`, character(1), "rule_hash"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

#' Escribe el plan de validación como un script R legible y ejecutable.
#' El archivo define funciones; no lee ni modifica datos al cargarse.
#' @keywords internal
validation_methodology_report_r <- function(model, path) {
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  source_rules <- model$rules %||% list()
  rule_order <- .vmr_presented_rule_indices(model)
  rules <- source_rules[rule_order]
  manifest <- .vmr_script_manifest(model, rule_order)
  executable_idx <- which(manifest$executable)
  formulas <- vapply(rules[executable_idx], `[[`, character(1), "formula_raw")
  helper_sources <- .vmr_runtime_helper_sources(formulas)

  rule_sections <- character(0)
  if (length(rules)) {
    for (i in seq_along(rules)) {
      rule <- rules[[i]]
      function_name <- sprintf(".plan_rule_%04d", i)
      formula_block <- character(0)
      if (isTRUE(manifest$executable[[i]])) {
        pretty_formula <- .vmr_rule_formula_text(
          rule,
          width = unname(.vmr_rule_wrap_widths()[["formula"]])
        )
        formula_source <- paste0(
          "    ",
          strsplit(pretty_formula, "\n", fixed = TRUE)[[1L]],
          collapse = "\n"
        )
        formula_block <- paste0(
          function_name, " <- function(data, context) {\n",
          "  .__eval_data__ <- data\n",
          "  .__choices_map__ <- context$choices_map\n",
          "  .opciones <- context$choices_map\n",
          "  `__today__` <- context$collection_date\n",
          "  `__data_multi__` <- context$tables\n\n",
          "  with(data, {\n", formula_source, "\n  })\n",
          "}"
        )
      } else {
        formula_text <- .vmr_rule_formula_text(
          rule,
          width = unname(.vmr_rule_wrap_widths()[["formula"]])
        )
        if (nzchar(formula_text)) formula_block <- .vmr_script_comment(formula_text)
      }
      rule_sections <- c(rule_sections, paste(c(
        "# -----------------------------------------------------------------------------",
        paste0("# ", .vmr_numbered_rule_title(i, rule$name)),
        "#",
        "# Qué comprueba",
        .vmr_script_comment(rule$validates),
        "#",
        paste0("# ", .vmr_rule_formula_label(rule)),
        formula_block,
        "#",
        "# Resultado",
        .vmr_script_result_lines(rule, model$upstream_universe$included %||% NA_real_)
      ), collapse = "\n"))
    }
  }

  rule_names <- sprintf(".plan_rule_%04d", executable_idx)
  function_map <- if (length(rule_names)) {
    paste0(
      ".plan_rule_functions <- structure(list(", paste(rule_names, collapse = ", "), "), names = ",
      .vmr_dput_lines(manifest$rule_id[executable_idx]), ")"
    )
  } else {
    ".plan_rule_functions <- list()"
  }
  universe <- .vmr_universe_model(model$upstream_universe %||% list(applied = FALSE))
  universe_formula <- .vmr_text(universe$formula_r %||% "")
  universe_function_source <- if (nzchar(universe_formula)) {
    formula_lines <- strsplit(
      universe_formula,
      "\n",
      fixed = TRUE
    )[[1L]]
    paste(c(
      "prepare_validation_universe <- function(data) {",
      paste0("  ", formula_lines),
      "  base_validacion",
      "}"
    ), collapse = "\n")
  } else {
    paste(
      "prepare_validation_universe <- function(data) {",
      "  warning('No se registró un filtro de encuestas de prueba en este plan.', call. = FALSE)",
      "  data",
      "}",
      sep = "\n"
    )
  }

  overview <- c(
    "# REGLAS Y RESULTADOS",
    paste0("# Reglas aplicadas: ", .vmr_script_count(length(rules))),
    paste0("# Evaluaciones: ", .vmr_script_count(model$summary$reviewed_total)),
    paste0("# Casos encontrados: ", .vmr_script_count(model$summary$findings_total)),
    paste0("# Reglas con fórmula R: ", .vmr_script_count(sum(manifest$executable)))
  )

  universe_summary <- c("# DATOS INCLUIDOS EN LA VALIDACIÓN")
  if (isTRUE(universe$applied)) {
    rejection_count <- .vmr_universe_count(universe$excluded_rejections, 0L)
    other_exclusions <- max(0L, .vmr_universe_count(universe$excluded_rules, 0L) - rejection_count)
    universe_summary <- c(
      universe_summary,
      paste0("# Encuestas recibidas: ", .vmr_script_count(universe$total)),
      paste0("# Encuestas reclasificadas de prueba a real: ", .vmr_script_count(universe$corrected, "0")),
      paste0("# Pruebas retiradas: ", .vmr_script_count(universe$excluded_test, "0")),
      if (rejection_count > 0L) paste0("# Rechazos retirados: ", .vmr_script_count(rejection_count, "0")) else NULL,
      if (other_exclusions > 0L) paste0("# Otras exclusiones: ", .vmr_script_count(other_exclusions, "0")) else NULL,
      paste0("# Encuestas incluidas: ", .vmr_script_count(universe$included)),
      "#",
      "# Preparación del universo"
    )
    preparation_sentences <- .vmr_universe_preparation_sentences(universe)
    if (length(preparation_sentences)) {
      universe_summary <- c(universe_summary, unlist(lapply(preparation_sentences, .vmr_script_comment), use.names = FALSE))
    }
  } else {
    universe_summary <- c(universe_summary, "# No se registró un filtro de encuestas de prueba.")
  }
  universe_summary <- c(
    universe_summary,
    "#",
    "# Fórmula R usada para filtrar",
    universe_function_source
  )

  operational_lines <- character(0)
  operational <- model$operational_config %||% list()
  field_period <- operational$field_period %||% list()
  duplicates <- operational$duplicates %||% list()
  if (isTRUE(field_period$enabled) || isTRUE(duplicates$enabled)) {
    operational_lines <- c("# REGLAS AÑADIDAS")
  }
  if (isTRUE(field_period$enabled)) {
    operational_lines <- c(
      operational_lines,
      "# Fechas de campo",
      .vmr_script_comment(sprintf(
        "Del %s al %s, usando la variable %s (%s).",
        .vmr_short_date_label(field_period$start_date),
        .vmr_short_date_label(field_period$end_date),
        .vmr_text(field_period$variable),
        .vmr_text(field_period$timezone, "America/Lima")
      ))
    )
  }
  if (isTRUE(duplicates$enabled)) {
    duplicate_variables <- as.character(unlist(duplicates$variables %||% character(0), use.names = FALSE))
    threshold <- suppressWarnings(as.numeric(duplicates$similarity_threshold %||% NA_real_))
    minimum_coverage <- suppressWarnings(as.numeric(duplicates$minimum_coverage %||% NA_real_))
    operational_lines <- c(
      operational_lines,
      "# Entrevistas con respuestas similares",
      .vmr_script_comment(sprintf(
        paste(
          "Se comparan %d preguntas. Se registra un caso cuando dos entrevistas coinciden en al menos %.0f%% de ellas",
          "y ambas tienen respuestas comparables en al menos %.0f%%. No se elimina ninguna entrevista."
        ),
        length(duplicate_variables),
        100 * threshold,
        100 * minimum_coverage
      ))
    )
  }

  category_keys <- unique(vapply(rules, function(rule) .vmr_text(rule$category, "consistencia"), character(1)))
  category_lines <- c("# REGLAS POR TEMA")
  for (category in category_keys) {
    count <- sum(vapply(rules, function(rule) identical(.vmr_text(rule$category, "consistencia"), category), logical(1)))
    unit <- if (identical(count, 1L)) "regla" else "reglas"
    category_lines <- c(category_lines, sprintf("# %s: %d %s", .vmr_category_label(category), count, unit))
  }

  final_summary <- c(
    "# RESUMEN FINAL",
    paste0("# Reglas aplicadas: ", .vmr_script_count(length(rules))),
    paste0("# Encuestas incluidas: ", .vmr_script_count(universe$included)),
    paste0("# Casos encontrados: ", .vmr_script_count(model$summary$findings_total))
  )

  lines <- c(
    "# =============================================================================",
    "# PLAN DE VALIDACIÓN Y LIMPIEZA",
    "# Reglas aplicadas, resultados y fórmulas R",
    "#",
    paste0("# Estudio: ", model$estudio_nombre),
    paste0("# Base analizada: ", model$base_nombre),
    paste0("# Fecha del informe: ", .vmr_generated_label(model$generated_at)),
    "# =============================================================================",
    "",
    overview,
    "",
    universe_summary,
    "",
    operational_lines,
    "",
    category_lines,
    "",
    rule_sections,
    "",
    "# =============================================================================",
    "# MOTOR DE EJECUCIÓN",
    "# =============================================================================",
    "",
    "`%||%` <- function(x, y) if (is.null(x)) y else x",
    helper_sources,
    if (any(grepl("\\bnumber\\s*\\(", formulas, perl = TRUE))) "number <- .vd_odk_number" else character(0),
    if (any(grepl("\\bint\\s*\\(", formulas, perl = TRUE))) "int <- .vd_odk_int" else character(0),
    "",
    paste0("PLAN_INVENTORY_HASH <- ", .vmr_dput_lines(model$inventory_hash)),
    paste0("plan_manifest <- ", .vmr_dput_lines(manifest)),
    "",
    function_map,
    "",
    "read_validation_data <- function(path, sheet = 1L) {",
    "  if (!file.exists(path)) stop(sprintf('No existe el archivo: %s', path), call. = FALSE)",
    "  ext <- tolower(tools::file_ext(path))",
    "  if (ext == 'csv') return(utils::read.csv(path, check.names = FALSE, stringsAsFactors = FALSE))",
    "  if (ext == 'rds') return(readRDS(path))",
    "  if (ext %in% c('xlsx', 'xls')) {",
    "    if (!requireNamespace('readxl', quietly = TRUE)) stop('Para leer Excel se requiere el paquete readxl.', call. = FALSE)",
    "    return(as.data.frame(readxl::read_excel(path, sheet = sheet), check.names = FALSE))",
    "  }",
    "  stop('Formato no admitido. Use CSV, RDS o Excel.', call. = FALSE)",
    "}",
    "",
    ".plan_collection_dates <- function(data, collection_date_col = NULL, timezone = 'America/Lima') {",
    "  candidates <- unique(c(collection_date_col, 'end', '_submission_time', 'interviewdate', 'today'))",
    "  candidates <- candidates[!is.na(candidates) & nzchar(candidates)]",
    "  column <- candidates[candidates %in% names(data)][1]",
    "  if (!length(column) || is.na(column)) return(rep(as.Date(NA), nrow(data)))",
    "  x <- data[[column]]",
    "  if (inherits(x, 'Date')) return(x)",
    "  if (inherits(x, 'POSIXt')) return(as.Date(x, tz = timezone))",
    "  parsed <- suppressWarnings(as.POSIXct(as.character(x), tz = timezone))",
    "  out <- as.Date(parsed, tz = timezone)",
    "  fallback <- suppressWarnings(as.Date(as.character(x)))",
    "  out[is.na(out)] <- fallback[is.na(out)]",
    "  out",
    "}",
    "",
    "validate_data <- function(data, tables = list(principal = data), collection_date_col = NULL,",
    "                          choices_map = list(), timezone = 'America/Lima', output_dir = NULL) {",
    "  if (!is.data.frame(data)) stop('data debe ser un data.frame.', call. = FALSE)",
    "  if (is.null(tables$principal)) tables$principal <- data",
    "  summary_rows <- vector('list', nrow(plan_manifest))",
    "  finding_rows <- list()",
    "  for (i in seq_len(nrow(plan_manifest))) {",
    "    meta <- plan_manifest[i, , drop = FALSE]",
    "    table_data <- tables[[meta$tabla]]",
    "    if (is.null(table_data) && identical(meta$tabla, 'principal')) table_data <- data",
    "    status <- 'sin_formula_r'",
    "    detail <- meta$estado_tecnico",
    "    reviewed <- if (is.data.frame(table_data)) nrow(table_data) else NA_integer_",
    "    findings <- NA_integer_",
    "    if (isTRUE(meta$executable) && is.data.frame(table_data)) {",
    "      variables <- strsplit(meta$variables_tecnicas, '|', fixed = TRUE)[[1]]",
    "      variables <- variables[nzchar(variables)]",
    "      missing <- setdiff(variables, names(table_data))",
    "      if (length(missing)) {",
    "        status <- 'no_aplicable'",
    "        detail <- paste('Variables ausentes:', paste(missing, collapse = ', '))",
    "        findings <- 0L",
    "      } else {",
    "        context <- list(",
    "          tables = tables, choices_map = choices_map,",
    "          collection_date = .plan_collection_dates(table_data, collection_date_col, timezone)",
    "        )",
    "        flag <- tryCatch(.plan_rule_functions[[meta$rule_id]](table_data, context), error = function(e) e)",
    "        if (inherits(flag, 'error')) {",
    "          status <- 'error_de_ejecucion'",
    "          detail <- conditionMessage(flag)",
    "        } else {",
    "          if (length(flag) == 1L) flag <- rep(flag, nrow(table_data))",
    "          if (!is.logical(flag) || length(flag) != nrow(table_data)) {",
    "            status <- 'error_de_ejecucion'",
    "            detail <- 'La comprobación no devolvió un vector lógico del largo esperado.'",
    "          } else {",
    "            status <- 'evaluada'",
    "            detail <- ''",
    "            findings <- sum(flag, na.rm = TRUE)",
    "            idx <- which(flag %in% TRUE)",
    "            if (length(idx)) finding_rows[[length(finding_rows) + 1L]] <- data.frame(",
    "              rule_id = meta$rule_id, tabla = meta$tabla, fila = idx, stringsAsFactors = FALSE",
    "            )",
    "          }",
    "        }",
    "      }",
    "    } else if (isTRUE(meta$executable) && !is.data.frame(table_data)) {",
    "      status <- 'no_aplicable'",
    "      detail <- paste('No se proporcionó la tabla', meta$tabla)",
    "    }",
    "    summary_rows[[i]] <- data.frame(",
    "      rule_id = meta$rule_id, nombre = meta$nombre, tabla = meta$tabla, estado = status,",
    "      unidad_evaluada = meta$unidad_evaluada, unidades_evaluadas = reviewed,",
    "      casos_encontrados = findings, detalle = detail,",
    "      stringsAsFactors = FALSE",
    "    )",
    "  }",
    "  summary <- do.call(rbind, summary_rows)",
    "  findings <- if (length(finding_rows)) do.call(rbind, finding_rows) else data.frame(",
    "    rule_id = character(0), tabla = character(0), fila = integer(0), stringsAsFactors = FALSE",
    "  )",
    "  result <- list(inventory_hash = PLAN_INVENTORY_HASH, resumen_reglas = summary, hallazgos_por_fila = findings, manifiesto = plan_manifest)",
    "  if (!is.null(output_dir)) {",
    "    dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)",
    "    utils::write.csv(summary, file.path(output_dir, 'resumen_reglas.csv'), row.names = FALSE, na = '')",
    "    utils::write.csv(findings, file.path(output_dir, 'casos_por_fila.csv'), row.names = FALSE, na = '')",
    "    utils::write.csv(plan_manifest, file.path(output_dir, 'inventario_reglas.csv'), row.names = FALSE, na = '')",
    "  }",
    "  result",
    "}",
    "",
    final_summary,
    "",
    "# CÓMO VOLVER A EJECUTAR LA VALIDACIÓN",
    "# source('plan_validacion_limpieza.R')",
    "# base_recibida <- read_validation_data('base.csv')",
    "# base_validacion <- prepare_validation_universe(base_recibida)",
    "# resultado <- validate_data(base_validacion, output_dir = 'resultados_validacion')"
  )
  writeLines(enc2utf8(lines), path, useBytes = TRUE)
  invisible(path)
}

validation_methodology_report_pdf <- function(model, path) {
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  source_rules <- model$rules %||% list()
  rules <- source_rules[.vmr_presented_rule_indices(model)]
  theme <- .vmr_pdf_theme()
  rule_wrap_widths <- .vmr_rule_wrap_widths()
  wrap_lines <- function(text, width) {
    source_lines <- strsplit(.vmr_text(text), "\n", fixed = TRUE)[[1L]]
    out <- unlist(lapply(source_lines, function(line) {
      wrapped <- strwrap(line, width = width)
      if (length(wrapped)) wrapped else ""
    }), use.names = FALSE)
    if (length(out)) out else ""
  }
  wrap_code_lines <- function(text, width = 68L) {
    source_lines <- strsplit(.vmr_text(text), "\n", fixed = TRUE)[[1L]]
    out <- character(0)
    for (line in source_lines) {
      pending <- line
      if (!nzchar(pending)) {
        out <- c(out, "")
        next
      }
      while (nchar(pending, type = "width") > width) {
        window <- substr(pending, 1L, width)
        breaks <- gregexpr("[[:space:],)]|&&?|\\|\\|?", window, perl = TRUE)[[1L]]
        break_lengths <- attr(breaks, "match.length")
        valid <- breaks > 0L & (breaks + break_lengths - 1L) > floor(width * 0.55)
        break_ends <- breaks[valid] + break_lengths[valid] - 1L
        cut_at <- if (length(break_ends)) max(break_ends) else width
        out <- c(out, substr(pending, 1L, cut_at))
        pending <- paste0("  ", trimws(substr(pending, cut_at + 1L, nchar(pending))))
      }
      out <- c(out, pending)
    }
    if (length(out)) out else ""
  }
  fmt <- function(x, fallback = "-") {
    value <- suppressWarnings(as.numeric(x))
    if (length(value) && is.finite(value[[1L]])) format(value[[1L]], big.mark = ",", scientific = FALSE, trim = TRUE) else fallback
  }
  pct <- function(numerator, denominator) {
    if (!is.finite(numerator) || !is.finite(denominator) || denominator <= 0) return(NA_real_)
    numerator / denominator
  }

  rule_pages <- list()
  ordered_rules <- .vmr_ordered_rule_indices(rules)
  category_keys <- unique(vapply(
    rules[ordered_rules],
    function(rule) .vmr_text(rule$category, "consistencia"),
    character(1)
  ))
  report_rule_number <- 0L
  for (rule_idx in ordered_rules) {
    rule <- rules[[rule_idx]]
    report_rule_number <- report_rule_number + 1L
    category_key <- .vmr_text(rule$category, "consistencia")
    category_rule_indices <- which(vapply(rules, function(item) identical(.vmr_text(item$category, "consistencia"), category_key), logical(1)))
    category_rule_number <- match(rule_idx, category_rule_indices)
    formula_label <- .vmr_rule_formula_label(rule)
    formula_display <- .vmr_rule_formula_text(rule, rule_wrap_widths[["formula"]])
    rule_pages[[length(rule_pages) + 1L]] <- list(
      title = rule$name,
      category_key = category_key,
      category_label = .vmr_category_label(category_key),
      category_rule_number = category_rule_number,
      category_rule_total = length(category_rule_indices),
      rule_number = report_rule_number,
      table = .vmr_text(rule$table, "principal"),
      validates_lines = wrap_lines(
        .vmr_pdf_rule_description(
          rule$validates,
          category_key,
          width = rule_wrap_widths[["description"]]
        ),
        rule_wrap_widths[["description"]]
      ),
      formula_label = formula_label,
      formula_kind = rule$formula_kind,
      formula_lines = wrap_code_lines(formula_display, rule_wrap_widths[["formula"]]),
      state = rule$state,
      reviewed = rule$reviewed,
      findings = rule$findings,
      evaluated = rule$evaluated
    )
  }

  universe <- .vmr_universe_model(model$upstream_universe %||% list(applied = FALSE))
  field_period <- model$operational_config$field_period %||% list(enabled = FALSE)
  duplicates <- model$operational_config$duplicates %||% list(enabled = FALSE)

  valid_by_category <- model$summary$by_category %||% data.frame()
  category_rows <- lapply(category_keys, function(category) {
    subset <- Filter(function(rule) identical(.vmr_text(rule$category, "consistencia"), category), rules)
    result_idx <- if (nrow(valid_by_category)) match(category, valid_by_category$category) else NA_integer_
    evaluated <- if (is.na(result_idx)) 0L else valid_by_category$evaluated[[result_idx]]
    findings <- if (is.na(result_idx)) NA_real_ else valid_by_category$findings[[result_idx]]
    list(
      key = category,
      label = .vmr_category_label(category),
      description = .vmr_category_description(category),
      controls = length(subset),
      evaluated = evaluated,
      findings = findings,
      rule_pages = sum(vapply(rule_pages, function(page) identical(page$category_key, category), logical(1)))
    )
  })
  rich_preparation <- length(universe$corrections %||% list()) > 0L ||
    length(universe$exclusion_rules %||% list()) > 0L
  preparation_pages <- if (rich_preparation) 2L else 1L
  summary_chunk_count <- max(1L, ceiling(length(category_rows) / 10L))
  intro_pages <- 2L + preparation_pages + summary_chunk_count
  cursor <- intro_pages + 1L
  for (i in seq_along(category_rows)) {
    category_rows[[i]]$divider_page <- cursor
    category_rows[[i]]$first_rule_page <- cursor + 1L
    category_rows[[i]]$last_rule_page <- cursor + category_rows[[i]]$rule_pages
    cursor <- category_rows[[i]]$last_rule_page + 1L
  }
  summary_chunks <- split(category_rows, ceiling(seq_along(category_rows) / 10L))
  if (!length(summary_chunks)) summary_chunks <- list(list())
  closing_page <- cursor
  total_pages <- closing_page

  grDevices::cairo_pdf(path, width = 8.27, height = 11.69, onefile = TRUE, family = "Helvetica")
  on.exit(grDevices::dev.off(), add = TRUE)

  draw_footer <- function(page_number, section = "") {
    grid::grid.lines(x = c(0.065, 0.935), y = c(0.068, 0.068), gp = grid::gpar(col = theme$line, lwd = 0.8))
    if (nzchar(section)) grid::grid.text(section, x = 0.5, y = 0.038, just = "center", gp = grid::gpar(col = theme$muted, fontsize = 7.5))
    grid::grid.text(sprintf("%d / %d", page_number, total_pages), x = 0.935, y = 0.038, just = "right", gp = grid::gpar(col = theme$muted, fontsize = 7.5, fontface = "bold"))
  }
  draw_shell <- function(title, subtitle, page_number, section = "") {
    grid::grid.newpage()
    grid::grid.rect(gp = grid::gpar(fill = theme$paper, col = NA))
    grid::grid.rect(x = 0.5, y = 0.982, width = 1, height = 0.036, gp = grid::gpar(fill = theme$navy, col = NA))
    .vmr_draw_brand(0.115, 0.935, width = 0.12)
    if (nzchar(section)) grid::grid.text(toupper(section), x = 0.935, y = 0.935, just = "right", gp = grid::gpar(col = theme$teal, fontsize = 7.8, fontface = "bold"))
    grid::grid.text(title, x = 0.07, y = 0.872, just = "left", gp = grid::gpar(col = theme$ink, fontsize = 23, fontface = "bold"))
    if (nzchar(subtitle)) grid::grid.text(subtitle, x = 0.07, y = 0.832, just = "left", gp = grid::gpar(col = theme$muted, fontsize = 9.5))
    draw_footer(page_number, section)
  }

  # Portada editorial independiente.
  page_number <- 1L
  grid::grid.newpage()
  grid::grid.rect(gp = grid::gpar(fill = theme$paper, col = NA))
  grid::grid.rect(x = 0.81, y = 0.5, width = 0.38, height = 1, gp = grid::gpar(fill = theme$navy_dark, col = NA))
  grid::grid.rect(x = 0.605, y = 0.86, width = 0.012, height = 0.19, gp = grid::gpar(fill = theme$mint, col = NA))
  grid::grid.rect(x = 0.635, y = 0.79, width = 0.012, height = 0.12, gp = grid::gpar(fill = theme$teal, col = NA))
  .vmr_draw_brand(0.17, 0.91, width = 0.20)
  grid::grid.roundrect(x = 0.205, y = 0.79, width = 0.27, height = 0.038, r = grid::unit(4, "mm"), gp = grid::gpar(fill = theme$soft_teal, col = NA))
  grid::grid.text("Informe de validación", x = 0.09, y = 0.79, just = "left", gp = grid::gpar(col = theme$teal, fontsize = 8.5, fontface = "bold"))
  cover_title <- wrap_lines(model$title, 25L)
  grid::grid.text(paste(cover_title, collapse = "\n"), x = 0.08, y = 0.705, just = c("left", "top"), gp = grid::gpar(col = theme$ink, fontsize = 29, fontface = "bold", lineheight = 1.02))
  grid::grid.text(.vmr_wrap("Reglas aplicadas, resultados y fórmulas R", 35L), x = 0.08, y = 0.54, just = c("left", "top"), gp = grid::gpar(col = theme$text, fontsize = 13, lineheight = 1.2))
  grid::grid.lines(x = c(0.08, 0.54), y = c(0.44, 0.44), gp = grid::gpar(col = theme$line, lwd = 1.2))
  grid::grid.text("ESTUDIO", x = 0.08, y = 0.40, just = "left", gp = grid::gpar(col = theme$teal, fontsize = 8, fontface = "bold"))
  grid::grid.text(.vmr_wrap(model$estudio_nombre, 38L), x = 0.08, y = 0.368, just = c("left", "top"), gp = grid::gpar(col = theme$ink, fontsize = 12, fontface = "bold", lineheight = 1.15))
  grid::grid.text("BASE ANALIZADA", x = 0.08, y = 0.285, just = "left", gp = grid::gpar(col = theme$teal, fontsize = 8, fontface = "bold"))
  grid::grid.text(.vmr_wrap(model$base_nombre, 38L), x = 0.08, y = 0.253, just = c("left", "top"), gp = grid::gpar(col = theme$text, fontsize = 10.5, lineheight = 1.15))
  grid::grid.text(.vmr_generated_label(model$generated_at), x = 0.08, y = 0.10, just = "left", gp = grid::gpar(col = theme$muted, fontsize = 8.5))
  grid::grid.text("VALIDACIÓN\nY LIMPIEZA\nDE DATOS", x = 0.67, y = 0.87, just = c("left", "top"), gp = grid::gpar(col = theme$white, fontsize = 13, fontface = "bold", lineheight = 1.05))
  s <- model$summary
  applied_controls <- length(rules)
  applied_exact_r <- sum(vapply(
    rules,
    function(rule) identical(rule$formula_kind, "exact_r") && nzchar(rule$formula_raw),
    logical(1)
  ))
  cover_metrics <- list(
    c("REGLAS APLICADAS", fmt(applied_controls)),
    c("CON FÓRMULA R", fmt(applied_exact_r)),
    c("ENCUESTAS INCLUIDAS", fmt(universe$included %||% NA_real_))
  )
  metric_y <- c(0.57, 0.40, 0.23)
  for (i in seq_along(cover_metrics)) {
    grid::grid.text(cover_metrics[[i]][[1L]], x = 0.67, y = metric_y[[i]] + 0.04, just = "left", gp = grid::gpar(col = theme$mint, fontsize = 7.5, fontface = "bold"))
    grid::grid.text(cover_metrics[[i]][[2L]], x = 0.67, y = metric_y[[i]], just = "left", gp = grid::gpar(col = theme$white, fontsize = 24, fontface = "bold"))
    grid::grid.lines(x = c(0.67, 0.94), y = c(metric_y[[i]] - 0.055, metric_y[[i]] - 0.055), gp = grid::gpar(col = "#31547F", lwd = 0.8))
  }
  grid::grid.text("PULSO PUCP", x = 0.94, y = 0.055, just = "right", gp = grid::gpar(col = theme$white, fontsize = 8, fontface = "bold"))

  # Resultados generales: el trabajo realizado precede a los estados pendientes.
  page_number <- 2L
  draw_shell(
    "Reglas y resultados",
    "Encuestas, respuestas y casos encontrados",
    page_number,
    "Resultados generales"
  )
  total_controls <- as.numeric(applied_controls)
  evaluated_controls <- if (isTRUE(model$evaluation_available)) total_controls else 0
  coverage <- if (isTRUE(model$evaluation_available)) pct(evaluated_controls, total_controls) else NA_real_
  pending_controls <- 0
  result_intro <- if (isTRUE(model$evaluation_available)) {
    sprintf(
      "Se aplicaron %s reglas sobre %s encuestas. En conjunto, produjeron %s evaluaciones y encontraron %s casos.",
      fmt(total_controls),
      fmt(universe$included %||% NA_real_),
      fmt(s$reviewed_total),
      fmt(s$findings_total)
    )
  } else {
    "Las reglas aún no se han ejecutado sobre la base."
  }
  grid::grid.text(.vmr_wrap(result_intro, 92L), x = 0.07, y = 0.775, just = c("left", "top"), gp = grid::gpar(col = theme$text, fontsize = 10, lineheight = 1.2))

  result_metrics <- list(
    list(
      label = "REGLAS APLICADAS",
      value = if (isTRUE(model$evaluation_available)) fmt(evaluated_controls) else "—",
      support = "aplicadas a la base"
    ),
    list(
      label = "EVALUACIONES",
      value = if (is.finite(s$reviewed_total)) fmt(s$reviewed_total) else "—",
      support = "reglas aplicadas a encuestas y respuestas"
    ),
    list(
      label = "CASOS ENCONTRADOS",
      value = if (is.finite(s$findings_total)) fmt(s$findings_total) else "—",
      support = "requieren revisión"
    )
  )
  metric_x <- c(0.205, 0.50, 0.795)
  for (i in seq_along(result_metrics)) {
    item <- result_metrics[[i]]
    x <- metric_x[[i]]
    grid::grid.roundrect(x = x, y = 0.665, width = 0.25, height = 0.105, r = grid::unit(3, "mm"), gp = grid::gpar(fill = theme$white, col = theme$line))
    grid::grid.rect(x = x - 0.121, y = 0.665, width = 0.008, height = 0.105, gp = grid::gpar(fill = if (i == 3L) theme$green else theme$teal, col = NA))
    grid::grid.text(item$label, x = x - 0.102, y = 0.694, just = "left", gp = grid::gpar(col = theme$teal, fontsize = 7.2, fontface = "bold"))
    grid::grid.text(item$value, x = x - 0.102, y = 0.655, just = "left", gp = grid::gpar(col = theme$ink, fontsize = 20, fontface = "bold"))
    grid::grid.text(.vmr_wrap(item$support, 31L), x = x - 0.102, y = 0.632, just = c("left", "top"), gp = grid::gpar(col = theme$muted, fontsize = 6.9, lineheight = 1.08))
  }

  grid::grid.text("Reglas aplicadas por tema", x = 0.07, y = 0.575, just = "left", gp = grid::gpar(col = theme$ink, fontsize = 12.5, fontface = "bold"))
  grid::grid.roundrect(x = 0.5, y = 0.407, width = 0.86, height = 0.285, r = grid::unit(3, "mm"), gp = grid::gpar(fill = theme$white, col = theme$line))
  family_rows <- .vmr_result_family_rows(s$by_category %||% data.frame(), max_rows = 7L)
  if (nrow(family_rows)) {
    row_y <- seq(0.515, 0.299, length.out = nrow(family_rows))
    max_family <- max(family_rows$evaluated)
    bar_track_width <- 0.19
    for (i in seq_len(nrow(family_rows))) {
      y <- row_y[[i]]
      bar_width <- max(0.008, bar_track_width * family_rows$evaluated[[i]] / max_family)
      grid::grid.text(.vmr_wrap(family_rows$label[[i]], 35L), x = 0.09, y = y, just = "left", gp = grid::gpar(col = theme$text, fontsize = 7.8, fontface = "bold"))
      grid::grid.roundrect(x = 0.625 + bar_track_width / 2, y = y, width = bar_track_width, height = 0.012, r = grid::unit(1.5, "mm"), gp = grid::gpar(fill = theme$soft_blue, col = NA))
      grid::grid.roundrect(x = 0.625 + bar_width / 2, y = y, width = bar_width, height = 0.012, r = grid::unit(1.5, "mm"), gp = grid::gpar(fill = theme$teal, col = NA))
      grid::grid.text(
        sprintf("%s · %.1f%%", fmt(family_rows$evaluated[[i]]), family_rows$share[[i]] * 100),
        x = 0.91,
        y = y,
        just = "right",
        gp = grid::gpar(col = theme$navy, fontsize = 7.7, fontface = "bold")
      )
    }
  } else {
    grid::grid.text(
      .vmr_wrap("La composición por familia estará disponible después de aplicar el plan a la base.", 72L),
      x = 0.09,
      y = 0.415,
      just = c("left", "top"),
      gp = grid::gpar(col = theme$muted, fontsize = 9.5, lineheight = 1.2)
    )
  }

  grid::grid.roundrect(x = 0.5, y = 0.17, width = 0.86, height = 0.13, r = grid::unit(3, "mm"), gp = grid::gpar(fill = theme$white, col = theme$line))
  grid::grid.text("BASE USADA", x = 0.09, y = 0.209, just = "left", gp = grid::gpar(col = theme$teal, fontsize = 7.5, fontface = "bold"))
  rejection_count <- .vmr_universe_count(universe$excluded_rejections, 0L)
  exclusion_value <- if (rejection_count > 0L) rejection_count else .vmr_universe_count(universe$excluded_rules, 0L)
  exclusion_label <- if (rejection_count > 0L) "Rechazos retirados" else "Otras exclusiones"
  base_values <- c(
    universe$total %||% NA_real_,
    universe$corrected %||% 0L,
    universe$excluded_test %||% NA_real_,
    exclusion_value,
    universe$included %||% NA_real_
  )
  base_labels <- c("Encuestas recibidas", "Reclasificadas", "Pruebas retiradas", exclusion_label, "Encuestas incluidas")
  base_x <- seq(0.125, 0.875, length.out = 5L)
  for (i in seq_along(base_x)) {
    if (i > 1L) grid::grid.lines(x = rep(base_x[[i]] - 0.1125, 2L), y = c(0.125, 0.19), gp = grid::gpar(col = theme$line, lwd = 0.8))
    grid::grid.text(fmt(base_values[[i]]), x = base_x[[i]], y = 0.165, gp = grid::gpar(col = theme$ink, fontsize = 16, fontface = "bold"))
    grid::grid.text(.vmr_wrap(base_labels[[i]], 28L), x = base_x[[i]], y = 0.135, just = c("center", "top"), gp = grid::gpar(col = theme$muted, fontsize = 7.1, lineheight = 1.08))
  }

  # Base y decisiones de alcance.
  page_number <- 3L
  draw_shell("Datos incluidos en la validación", "Encuestas de prueba, fechas de campo y respuestas similares", page_number, "Preparación")
  if (isTRUE(model$evaluation_available)) {
    invisible(NULL)
  }
  if (isTRUE(universe$applied)) {
    rejection_count <- .vmr_universe_count(universe$excluded_rejections, 0L)
    other_exclusions <- max(0L, .vmr_universe_count(universe$excluded_rules, 0L) - rejection_count)
    count_text <- paste0(
      "De ", fmt(universe$total %||% NA_real_), " encuestas recibidas, ",
      fmt(universe$corrected %||% 0L), " se reclasificaron de prueba a real. ",
      "Quedaron fuera ", fmt(universe$excluded_test %||% 0L),
      if (identical(.vmr_universe_count(universe$excluded_test, 0L), 1L)) " prueba retirada" else " pruebas retiradas",
      if (rejection_count > 0L) paste0(" y ", fmt(rejection_count), if (rejection_count == 1L) " rechazo retirado" else " rechazos retirados") else "",
      if (other_exclusions > 0L) paste0(" y ", fmt(other_exclusions), " por otros criterios") else "",
      ". Se incluyeron ", fmt(universe$included %||% NA_real_), " encuestas."
    )
    preparation_details <- .vmr_universe_preparation_sentences(universe)
    criterion <- paste(c(count_text, preparation_details), collapse = " ")
    grid::grid.roundrect(x = 0.5, y = 0.735, width = 0.86, height = 0.13, r = grid::unit(3, "mm"), gp = grid::gpar(fill = theme$soft_teal, col = NA))
    grid::grid.text("PREPARACIÓN DEL UNIVERSO", x = 0.09, y = 0.775, just = "left", gp = grid::gpar(col = theme$teal, fontsize = 8, fontface = "bold"))
    grid::grid.text(.vmr_wrap(criterion, 82L), x = 0.09, y = 0.744, just = c("left", "top"), gp = grid::gpar(col = theme$text, fontsize = 8.6, lineheight = 1.15))
  } else {
    grid::grid.roundrect(x = 0.5, y = 0.745, width = 0.86, height = 0.11, r = grid::unit(3, "mm"), gp = grid::gpar(fill = theme$soft_amber, col = NA))
    grid::grid.text(.vmr_wrap("No consta un filtro de encuestas de prueba aplicado; por ello no se presenta una fórmula de filtrado.", 76L), x = 0.09, y = 0.765, just = c("left", "top"), gp = grid::gpar(col = "#6D5315", fontsize = 9.5, lineheight = 1.18))
  }
  filter_formula <- .vmr_text(universe$formula_r %||% "")
  filter_lines <- if (nzchar(filter_formula)) {
    display_formula <- if (rich_preparation) {
      filter_formula
    } else {
      .vmr_pretty_r_formula(filter_formula, 68L)
    }
    wrap_code_lines(display_formula, if (rich_preparation) 94L else 68L)
  } else {
    character(0)
  }
  if (length(filter_lines) && !rich_preparation) {
    filter_h <- min(0.31, 0.085 + length(filter_lines) * 0.016)
    filter_top <- 0.645
    grid::grid.roundrect(x = 0.5, y = filter_top - filter_h / 2, width = 0.86, height = filter_h, r = grid::unit(3, "mm"), gp = grid::gpar(fill = theme$code, col = NA))
    grid::grid.text("FÓRMULA R USADA PARA FILTRAR", x = 0.09, y = filter_top - 0.03, just = "left", gp = grid::gpar(col = theme$mint, fontsize = 8.5, fontface = "bold"))
    grid::grid.text(paste(filter_lines, collapse = "\n"), x = 0.09, y = filter_top - 0.068, just = c("left", "top"), gp = grid::gpar(col = theme$white, fontsize = 8.6, family = "mono", lineheight = 1.12))
    decisions_top <- filter_top - filter_h - 0.045
  } else {
    decisions_top <- 0.62
  }
  grid::grid.text("Reglas añadidas", x = 0.07, y = decisions_top, just = "left", gp = grid::gpar(col = theme$ink, fontsize = 12.5, fontface = "bold"))
  duplicate_variables <- as.character(unlist(duplicates$variables %||% list(), use.names = FALSE))
  duplicate_variables <- duplicate_variables[!is.na(duplicate_variables) & nzchar(duplicate_variables)]
  duplicate_threshold <- suppressWarnings(as.numeric(duplicates$similarity_threshold %||% 0.90))[1]
  duplicate_coverage <- suppressWarnings(as.numeric(duplicates$minimum_coverage %||% 0.80))[1]
  scope_items <- list(
    list(label = "Fechas de campo", value = if (isTRUE(field_period$enabled)) sprintf(
      "Del %s al %s, usando la variable %s (%s)",
      .vmr_short_date_label(field_period$start_date),
      .vmr_short_date_label(field_period$end_date),
      field_period$variable,
      field_period$timezone
    ) else "No se configuró un control operativo adicional de fechas."),
    list(label = "Entrevistas con respuestas similares", value = if (isTRUE(duplicates$enabled)) sprintf(
      paste0(
        "Se comparan %d preguntas. Se registra un caso cuando dos entrevistas ",
        "coinciden en al menos %.0f%% de ellas y ambas tienen respuestas comparables ",
        "en al menos %.0f%%. No se elimina ninguna entrevista."
      ),
      length(duplicate_variables),
      100 * duplicate_threshold,
      100 * duplicate_coverage
    ) else "No se configuró una comparación adicional por similitud de respuestas.")
  )
  row_top <- decisions_top - 0.035
  for (item in scope_items) {
    value_lines <- wrap_lines(item$value, 73L)
    row_height <- max(0.078, 0.056 + length(value_lines) * 0.017)
    row_y <- row_top - row_height / 2
    grid::grid.roundrect(x = 0.5, y = row_y, width = 0.86, height = row_height, r = grid::unit(2.5, "mm"), gp = grid::gpar(fill = theme$white, col = theme$line))
    grid::grid.text(item$label, x = 0.09, y = row_top - 0.019, just = "left", gp = grid::gpar(col = theme$teal, fontsize = 8, fontface = "bold"))
    grid::grid.text(paste(value_lines, collapse = "\n"), x = 0.09, y = row_top - 0.050, just = c("left", "top"), gp = grid::gpar(col = theme$text, fontsize = 8.7, lineheight = 1.15))
    row_top <- row_top - row_height - 0.014
  }

  if (rich_preparation) {
    page_number <- 4L
    draw_shell(
      "Fórmula R de preparación",
      "Correcciones, clasificación y exclusiones aplicadas antes de validar",
      page_number,
      "Preparación"
    )
    grid::grid.roundrect(
      x = 0.5, y = 0.47, width = 0.86, height = 0.66,
      r = grid::unit(3, "mm"),
      gp = grid::gpar(fill = theme$code, col = NA)
    )
    grid::grid.text(
      "CÓDIGO EJECUTABLE",
      x = 0.09, y = 0.775, just = "left",
      gp = grid::gpar(col = theme$mint, fontsize = 8.5, fontface = "bold")
    )
    code_size <- if (length(filter_lines) > 44L) 6.3 else if (length(filter_lines) > 34L) 6.8 else 7.4
    grid::grid.text(
      paste(filter_lines, collapse = "\n"),
      x = 0.09, y = 0.742, just = c("left", "top"),
      gp = grid::gpar(col = theme$white, fontsize = code_size, family = "mono", lineheight = 1.08)
    )
  }

  # Índice completo de familias y guía de lectura. Nunca se trunca con head().
  for (chunk_idx in seq_along(summary_chunks)) {
    page_number <- 2L + preparation_pages + chunk_idx
    subtitle <- if (length(summary_chunks) > 1L) sprintf("Páginas de cada grupo · %d de %d", chunk_idx, length(summary_chunks)) else "Páginas de cada grupo"
    draw_shell("Reglas por tema", subtitle, page_number, "Índice")
    if (chunk_idx == 1L) {
      grid::grid.text("Contenido de cada regla", x = 0.07, y = 0.775, just = "left", gp = grid::gpar(col = theme$ink, fontsize = 12.5, fontface = "bold"))
      guide <- list(
        c("1", "Qué comprueba", "Condición que debe cumplir el dato"),
        c("2", "Fórmula R", "Código usado para revisar la condición"),
        c("3", "Resultado", "Encuestas o respuestas evaluadas y casos encontrados")
      )
      for (i in seq_along(guide)) {
        x <- c(0.205, 0.50, 0.795)[[i]]
        grid::grid.roundrect(x = x, y = 0.705, width = 0.25, height = 0.095, r = grid::unit(3, "mm"), gp = grid::gpar(fill = theme$white, col = theme$line))
        grid::grid.text(guide[[i]][[1L]], x = x - 0.098, y = 0.724, just = "left", gp = grid::gpar(col = theme$teal, fontsize = 14, fontface = "bold"))
        grid::grid.text(guide[[i]][[2L]], x = x - 0.065, y = 0.725, just = "left", gp = grid::gpar(col = theme$ink, fontsize = 8.2, fontface = "bold"))
        grid::grid.text(.vmr_wrap(guide[[i]][[3L]], 25L), x = x - 0.098, y = 0.688, just = c("left", "top"), gp = grid::gpar(col = theme$muted, fontsize = 7.5, lineheight = 1.1))
      }
      y <- 0.61
    } else {
      y <- 0.76
    }
    index_bar_width <- 0.17
    for (row in summary_chunks[[chunk_idx]]) {
      row_coverage <- if (isTRUE(model$evaluation_available)) pct(row$evaluated, row$controls) else NA_real_
      page_range <- if (row$first_rule_page == row$last_rule_page) sprintf("p. %d", row$first_rule_page) else sprintf("pp. %d-%d", row$first_rule_page, row$last_rule_page)
      grid::grid.roundrect(x = 0.5, y = y, width = 0.86, height = 0.050, r = grid::unit(2, "mm"), gp = grid::gpar(fill = theme$white, col = theme$line))
      grid::grid.text(row$label, x = 0.09, y = y + 0.010, just = "left", gp = grid::gpar(col = theme$ink, fontsize = 8.8, fontface = "bold"))
      grid::grid.text(sprintf("%s %s · %s ejecutadas", fmt(row$controls), if (row$controls == 1L) "regla" else "reglas", fmt(row$evaluated)), x = 0.09, y = y - 0.014, just = "left", gp = grid::gpar(col = theme$muted, fontsize = 7.5))
      grid::grid.roundrect(x = 0.59 + index_bar_width / 2, y = y, width = index_bar_width, height = 0.012, r = grid::unit(1.5, "mm"), gp = grid::gpar(fill = "#E2E9F2", col = NA))
      if (is.finite(row_coverage) && row_coverage > 0) grid::grid.roundrect(x = 0.59 + index_bar_width * min(row_coverage, 1) / 2, y = y, width = index_bar_width * min(row_coverage, 1), height = 0.012, r = grid::unit(1.5, "mm"), gp = grid::gpar(fill = theme$teal, col = NA))
      grid::grid.text(if (is.finite(row_coverage)) sprintf("%.0f%%", row_coverage * 100) else "Pendiente", x = 0.82, y = y, just = "right", gp = grid::gpar(col = theme$text, fontsize = 8, fontface = "bold"))
      grid::grid.text(page_range, x = 0.91, y = y, just = "right", gp = grid::gpar(col = theme$navy, fontsize = 8, fontface = "bold"))
      y <- y - 0.055
    }
  }

  # Anexo técnico organizado por familias.
  page_number <- intro_pages
  for (category_idx in seq_along(category_rows)) {
    category <- category_rows[[category_idx]]
    page_number <- page_number + 1L
    grid::grid.newpage()
    grid::grid.rect(gp = grid::gpar(fill = theme$paper, col = NA))
    grid::grid.rect(x = 0.18, y = 0.5, width = 0.24, height = 1, gp = grid::gpar(fill = theme$navy_dark, col = NA))
    .vmr_draw_brand(0.15, 0.92, width = 0.15, on_dark = TRUE)
    grid::grid.text(sprintf("%02d", category_idx), x = 0.15, y = 0.67, just = "center", gp = grid::gpar(col = theme$mint, fontsize = 48, fontface = "bold"))
    grid::grid.text("FAMILIA", x = 0.15, y = 0.60, just = "center", gp = grid::gpar(col = theme$white, fontsize = 8, fontface = "bold"))
    grid::grid.text("ANEXO TÉCNICO", x = 0.15, y = 0.13, just = "center", gp = grid::gpar(col = "#9FB6D2", fontsize = 7.5, fontface = "bold"))
    category_title_lines <- wrap_lines(category$label, 28L)
    category_title_size <- if (length(category_title_lines) <= 1L) 25 else 21
    grid::grid.text(paste(category_title_lines, collapse = "\n"), x = 0.34, y = 0.78, just = c("left", "top"), gp = grid::gpar(col = theme$ink, fontsize = category_title_size, fontface = "bold", lineheight = 1.04))
    category_description_y <- 0.78 - length(category_title_lines) * (category_title_size / 540) - 0.045
    grid::grid.text(.vmr_wrap(category$description, 48L), x = 0.34, y = category_description_y, just = c("left", "top"), gp = grid::gpar(col = theme$text, fontsize = 11, lineheight = 1.25))
    category_metrics <- list(
      c("REGLAS", fmt(category$controls)),
      c("APLICADAS", fmt(category$evaluated)),
      c("CASOS ENCONTRADOS", fmt(category$findings, "No disponible"))
    )
    metric_y <- c(0.50, 0.37, 0.24)
    for (i in seq_along(category_metrics)) {
      grid::grid.roundrect(x = 0.63, y = metric_y[[i]], width = 0.58, height = 0.095, r = grid::unit(3, "mm"), gp = grid::gpar(fill = theme$white, col = theme$line))
      grid::grid.text(category_metrics[[i]][[1L]], x = 0.37, y = metric_y[[i]] + 0.018, just = "left", gp = grid::gpar(col = theme$teal, fontsize = 7.8, fontface = "bold"))
      grid::grid.text(category_metrics[[i]][[2L]], x = 0.37, y = metric_y[[i]] - 0.018, just = "left", gp = grid::gpar(col = theme$ink, fontsize = 17, fontface = "bold"))
    }
    grid::grid.text(sprintf("Fichas %d-%d · páginas %d-%d", sum(vapply(category_rows[seq_len(category_idx - 1L)], `[[`, numeric(1), "controls")) + 1L, sum(vapply(category_rows[seq_len(category_idx)], `[[`, numeric(1), "controls")), category$first_rule_page, category$last_rule_page), x = 0.34, y = 0.125, just = "left", gp = grid::gpar(col = theme$muted, fontsize = 8.5))
    draw_footer(page_number, category$label)

    pages_in_category <- Filter(function(page) identical(page$category_key, category$key), rule_pages)
    for (page in pages_in_category) {
      page_number <- page_number + 1L
      grid::grid.newpage()
      grid::grid.rect(gp = grid::gpar(fill = theme$paper, col = NA))
      grid::grid.rect(x = 0.5, y = 0.982, width = 1, height = 0.036, gp = grid::gpar(fill = theme$navy, col = NA))
      .vmr_draw_brand(0.115, 0.935, width = 0.12)
      grid::grid.text(toupper(page$category_label), x = 0.935, y = 0.935, just = "right", gp = grid::gpar(col = theme$teal, fontsize = 7.7, fontface = "bold"))
      title_text <- .vmr_numbered_rule_title(page$rule_number, page$title)
      title_lines <- wrap_lines(title_text, 52L)
      title_size <- if (length(title_lines) <= 2L) 18.5 else if (length(title_lines) == 3L) 16 else 14
      grid::grid.text(paste(title_lines, collapse = "\n"), x = 0.07, y = 0.875, just = c("left", "top"), gp = grid::gpar(col = theme$ink, fontsize = title_size, fontface = "bold", lineheight = 1.07))
      title_bottom <- 0.875 - length(title_lines) * (title_size / 600)
      content_top <- title_bottom - 0.035
      if (length(page$validates_lines)) {
        validates_h <- 0.068 + length(page$validates_lines) * 0.018
        grid::grid.roundrect(x = 0.5, y = content_top - validates_h / 2, width = 0.86, height = validates_h, r = grid::unit(3, "mm"), gp = grid::gpar(fill = theme$soft_teal, col = NA))
        grid::grid.text("Qué comprueba", x = 0.09, y = content_top - 0.028, just = "left", gp = grid::gpar(col = theme$teal, fontsize = 8.2, fontface = "bold"))
        grid::grid.text(paste(page$validates_lines, collapse = "\n"), x = 0.09, y = content_top - 0.064, just = c("left", "top"), gp = grid::gpar(col = theme$text, fontsize = 9.8, lineheight = 1.16))
        formula_top <- content_top - validates_h - 0.025
      } else {
        formula_top <- content_top
      }
      if (length(page$formula_lines)) {
        result_h <- 0.175
        result_bottom <- 0.135
      available_formula_h <- max(0.12, formula_top - 0.025 - result_h - result_bottom)
      formula_line_step <- min(0.0145, max(0.0105, (available_formula_h - 0.068) / max(1L, length(page$formula_lines))))
      formula_max_width <- max(nchar(page$formula_lines, type = "width"), 1L)
      formula_font_vertical <- 8.6 * formula_line_step / 0.0145
      formula_font_horizontal <- 8.6 * 90 / max(90, formula_max_width)
      formula_font <- min(8.6, max(7.2, formula_font_vertical), formula_font_horizontal)
        formula_h <- 0.068 + length(page$formula_lines) * formula_line_step
        formula_fill <- if (identical(page$formula_kind, "exact_r")) "#EEF4F8" else theme$soft_amber
        grid::grid.roundrect(x = 0.5, y = formula_top - formula_h / 2, width = 0.86, height = formula_h, r = grid::unit(3, "mm"), gp = grid::gpar(fill = formula_fill, col = theme$line, lwd = 0.9))
        grid::grid.rect(x = 0.074, y = formula_top - formula_h / 2, width = 0.008, height = formula_h, gp = grid::gpar(fill = theme$navy, col = NA))
        grid::grid.text(page$formula_label, x = 0.09, y = formula_top - 0.027, just = "left", gp = grid::gpar(col = theme$teal, fontsize = 8.4, fontface = "bold"))
        grid::grid.text(paste(page$formula_lines, collapse = "\n"), x = 0.09, y = formula_top - 0.061, just = c("left", "top"), gp = grid::gpar(col = theme$navy_dark, fontsize = formula_font, family = "mono", lineheight = 1.1))
        result_top <- formula_top - formula_h - 0.025
      } else {
        result_top <- formula_top
      }
      draw_result_diagram <- function(top) {
        result_h <- 0.175
        result_y <- top - result_h / 2
        grid::grid.roundrect(x = 0.5, y = result_y, width = 0.86, height = result_h, r = grid::unit(3, "mm"), gp = grid::gpar(fill = theme$white, col = theme$line))
        grid::grid.rect(x = 0.074, y = result_y, width = 0.008, height = result_h, gp = grid::gpar(fill = theme$teal, col = NA))
        grid::grid.text("Resultado", x = 0.09, y = top - 0.028, just = "left", gp = grid::gpar(col = theme$teal, fontsize = 8.4, fontface = "bold"))
        if (isTRUE(page$evaluated) && is.finite(page$reviewed) && is.finite(page$findings)) {
          reviewed <- max(0, as.numeric(page$reviewed))
          findings <- max(0, min(reviewed, as.numeric(page$findings)))
          without_findings <- max(0, reviewed - findings)
          repeat_rows <- !identical(.vmr_text(page$table, "principal"), "principal")
          reviewed_label <- if (repeat_rows) "RESPUESTAS EVALUADAS" else "ENCUESTAS EVALUADAS"
          result_label <- if (repeat_rows) "RESULTADO DE LAS RESPUESTAS" else "RESULTADO DE LAS ENCUESTAS"
          grid::grid.text(reviewed_label, x = 0.10, y = top - 0.071, just = "left", gp = grid::gpar(col = theme$muted, fontsize = 7.1, fontface = "bold"))
          grid::grid.text(fmt(reviewed), x = 0.10, y = top - 0.122, just = "left", gp = grid::gpar(col = theme$ink, fontsize = 21, fontface = "bold"))
          if (repeat_rows && is.finite(suppressWarnings(as.numeric(universe$included %||% NA_real_)))) {
            grid::grid.text(
              sprintf("De %s encuestas incluidas", fmt(universe$included)),
              x = 0.10,
              y = top - 0.151,
              just = "left",
              gp = grid::gpar(col = theme$muted, fontsize = 6.8)
            )
          }
          bar_x <- 0.66
          bar_width <- 0.50
          grid::grid.text(result_label, x = 0.41, y = top - 0.071, just = "left", gp = grid::gpar(col = theme$muted, fontsize = 7.1, fontface = "bold"))
          grid::grid.roundrect(x = bar_x, y = top - 0.101, width = bar_width, height = 0.016, r = grid::unit(2, "mm"), gp = grid::gpar(fill = "#DFE8F1", col = NA))
          if (reviewed > 0 && without_findings > 0) {
            clear_width <- bar_width * without_findings / reviewed
            grid::grid.roundrect(x = bar_x - bar_width / 2 + clear_width / 2, y = top - 0.101, width = clear_width, height = 0.016, r = grid::unit(2, "mm"), gp = grid::gpar(fill = theme$teal, col = NA))
          }
          if (reviewed > 0 && findings > 0) {
            finding_width <- bar_width * findings / reviewed
            grid::grid.rect(x = bar_x + bar_width / 2 - finding_width / 2, y = top - 0.101, width = finding_width, height = 0.016, gp = grid::gpar(fill = theme$amber, col = NA))
          }
          grid::grid.rect(x = 0.41, y = top - 0.139, width = 0.010, height = 0.010, gp = grid::gpar(fill = theme$teal, col = NA))
          grid::grid.text(sprintf("Sin casos  %s", fmt(without_findings)), x = 0.425, y = top - 0.139, just = "left", gp = grid::gpar(col = theme$text, fontsize = 7.4))
          grid::grid.rect(x = 0.69, y = top - 0.139, width = 0.010, height = 0.010, gp = grid::gpar(fill = theme$amber, col = NA))
          grid::grid.text(sprintf("Casos encontrados  %s", fmt(findings)), x = 0.705, y = top - 0.139, just = "left", gp = grid::gpar(col = theme$text, fontsize = 7.4, fontface = "bold"))
        } else {
          grid::grid.text("PENDIENTE DE EVALUACIÓN", x = 0.10, y = top - 0.078, just = "left", gp = grid::gpar(col = theme$muted, fontsize = 7.1, fontface = "bold"))
          grid::grid.text(.vmr_text(page$state, "Resultado no disponible"), x = 0.10, y = top - 0.122, just = "left", gp = grid::gpar(col = theme$ink, fontsize = 12, fontface = "bold"))
        }
      }
      draw_result_diagram(result_top)
      progress <- page$category_rule_number / page$category_rule_total
      grid::grid.text(sprintf("%s · regla %d de %d", page$category_label, page$category_rule_number, page$category_rule_total), x = 0.07, y = 0.091, just = "left", gp = grid::gpar(col = theme$muted, fontsize = 7.4))
      grid::grid.roundrect(x = 0.74, y = 0.091, width = 0.36, height = 0.006, r = grid::unit(1, "mm"), gp = grid::gpar(fill = "#DDE6F0", col = NA))
      grid::grid.roundrect(x = 0.56 + 0.36 * progress / 2, y = 0.091, width = 0.36 * progress, height = 0.006, r = grid::unit(1, "mm"), gp = grid::gpar(fill = theme$teal, col = NA))
      draw_footer(page_number, page$category_label)
    }
  }

  # Resumen final.
  page_number <- closing_page
  draw_shell("Resumen final", "Reglas aplicadas y casos encontrados", page_number, "Resumen")
  closing_headline <- if (isTRUE(model$evaluation_available)) sprintf("%s reglas aplicadas sobre %s encuestas", fmt(evaluated_controls), fmt(universe$included %||% NA_real_)) else "Las reglas aún no se han ejecutado"
  grid::grid.text(closing_headline, x = 0.07, y = 0.755, just = "left", gp = grid::gpar(col = theme$ink, fontsize = 21, fontface = "bold"))
  closing_text <- if (isTRUE(model$evaluation_available)) {
    sprintf("Las reglas aplicadas encontraron %s casos para revisar.", fmt(s$findings_total))
  } else {
    "El informe contiene las reglas y sus fórmulas; falta ejecutarlas sobre la base."
  }
  closing_text <- paste(closing_text, "Un caso encontrado debe revisarse antes de modificar la base.")
  grid::grid.text(.vmr_wrap(closing_text, 78L), x = 0.07, y = 0.705, just = c("left", "top"), gp = grid::gpar(col = theme$text, fontsize = 10.5, lineheight = 1.25))
  closing_metrics <- list(
    c("ENCUESTAS EVALUADAS", fmt(universe$included %||% NA_real_)),
    c("REGLAS APLICADAS", fmt(evaluated_controls)),
    c("CASOS ENCONTRADOS", fmt(s$findings_total, "No disponible")),
    c("REGLAS CON FÓRMULA R", fmt(applied_exact_r))
  )
  positions <- list(c(0.285, 0.52), c(0.715, 0.52), c(0.285, 0.36), c(0.715, 0.36))
  for (i in seq_along(closing_metrics)) {
    x <- positions[[i]][[1L]]
    y <- positions[[i]][[2L]]
    accent <- if (i == 3L) theme$teal else theme$navy
    grid::grid.roundrect(x = x, y = y, width = 0.38, height = 0.125, r = grid::unit(3, "mm"), gp = grid::gpar(fill = theme$white, col = theme$line))
    grid::grid.rect(x = x - 0.186, y = y, width = 0.008, height = 0.125, gp = grid::gpar(fill = accent, col = NA))
    grid::grid.text(closing_metrics[[i]][[1L]], x = x - 0.16, y = y + 0.027, just = "left", gp = grid::gpar(col = theme$muted, fontsize = 7.6, fontface = "bold"))
    grid::grid.text(closing_metrics[[i]][[2L]], x = x - 0.16, y = y - 0.018, just = "left", gp = grid::gpar(col = theme$ink, fontsize = 19, fontface = "bold"))
  }
  grid::grid.roundrect(x = 0.5, y = 0.205, width = 0.86, height = 0.105, r = grid::unit(3, "mm"), gp = grid::gpar(fill = theme$navy, col = NA))
  grid::grid.text("ARCHIVOS ENTREGADOS", x = 0.09, y = 0.232, just = "left", gp = grid::gpar(col = theme$mint, fontsize = 8.2, fontface = "bold"))
  grid::grid.text(.vmr_wrap("El PDF presenta las reglas aplicadas y sus resultados. El archivo .R contiene las fórmulas y expresiones usadas en esas comprobaciones.", 78L), x = 0.09, y = 0.202, just = c("left", "top"), gp = grid::gpar(col = theme$white, fontsize = 9, lineheight = 1.17))
  invisible(path)
}

validacion_methodology_report_pdf_job_runner <- function(model_path,
                                                         result_path = NULL,
                                                         progress_path = NULL) {
  report <- if (!is.null(progress_path)) job_progress_writer(progress_path) else function(...) invisible(NULL)
  report("prepare", percent = 15, message = "Preparando inventario metodologico...")
  model <- readRDS(model_path)
  report("render", percent = 55, message = "Renderizando reglas y formulas...")
  validation_methodology_report_pdf(model, result_path)
  report("export", percent = 95, message = "Guardando PDF...")
  list(ok = TRUE, size = as.numeric(file.info(result_path)$size %||% 0), filename = basename(result_path), n_rules = length(model$rules %||% list()))
}

validation_methodology_report_bundle_job_runner <- function(model_path,
                                                            result_path = NULL,
                                                            progress_path = NULL) {
  report <- if (!is.null(progress_path)) job_progress_writer(progress_path) else function(...) invisible(NULL)
  report("prepare", percent = 10, message = "Preparando el plan de validación y limpieza...")
  model <- readRDS(model_path)
  stage <- tempfile("validation_methodology_bundle_")
  dir.create(stage, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
  slug <- tolower(iconv(.vmr_text(model$base_nombre, "base"), to = "ASCII//TRANSLIT"))
  slug <- gsub("[^a-z0-9]+", "_", slug)
  slug <- gsub("^_+|_+$", "", slug)
  if (!nzchar(slug)) slug <- "base"
  stem <- paste0("plan_validacion_limpieza_", slug)
  pdf_path <- file.path(stage, paste0(stem, ".pdf"))
  r_path <- file.path(stage, paste0(stem, ".R"))
  report("render_pdf", percent = 35, message = "Generando el documento para cliente...")
  validation_methodology_report_pdf(model, pdf_path)
  report("render_r", percent = 70, message = "Generando el script R reproducible...")
  validation_methodology_report_r(model, r_path)
  if (!requireNamespace("zip", quietly = TRUE)) {
    stop("El paquete zip es necesario para crear el entregable.", call. = FALSE)
  }
  report("package", percent = 92, message = "Empaquetando PDF y script R...")
  zip::zipr(
    zipfile = result_path,
    files = c(basename(pdf_path), basename(r_path)),
    root = stage,
    mode = "cherry-pick"
  )
  entries <- zip::zip_list(result_path)$filename
  list(
    ok = TRUE,
    size = as.numeric(file.info(result_path)$size %||% 0),
    filename = basename(result_path),
    n_rules = length(model$rules %||% list()),
    inventory_hash = model$inventory_hash,
    entries = as.list(entries)
  )
}
