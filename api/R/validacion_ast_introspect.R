# =============================================================================
# Validación AST — Introspección desde XLSForm (Capa 6)
# =============================================================================
# Reemplazo moderno de los 7 builders del `rule_factory` heredado. Toma un
# instrumento cargado y emite reglas vía los constructores tipados. Lo
# novedoso:
#   - Todo pasa por make_rule() → validación uniforme + dedup por hash.
#   - `gate` acumulativo: grupos anidados (begin_group dentro de begin_repeat,
#     etc.) concatenan sus relevant como AND.
#   - Parser ODK → AST en vez de gsub; descarta reglas con pulldata.
#   - Repeats: la regla hereda `repeat_context`; repeat_count dinámico
#     produce un `rule_repeat_length` adicional.
#   - Hoja/tabla destino se deriva del contexto, no se pide al usuario.
#
# API pública: `infer_rules_from_xlsform(instrumento, include = ...)`

# -----------------------------------------------------------------------------
# Entrada esperada del instrumento
# -----------------------------------------------------------------------------
# Se asume que `instrumento` tiene:
#   $survey: tibble con columnas `type`, `name`, `label`, `relevant`,
#            `constraint`, `calculation`, `required`, `choice_filter`,
#            `repeat_count`, `appearance` — los nombres coinciden con los
#            headers estándar de XLSForm. Columnas multi-idioma como
#            `label::Español (es)` se prefieren sobre `label` si existen
#            (resolver Spanish-first).
#   $choices: tibble con columnas `list_name`, `name`, `label` — catálogo
#            de valores por lista.
#   $meta (opcional): metadata adicional (p.ej. collection_date_col).

# -----------------------------------------------------------------------------
# Label resolver (Spanish-first)
# -----------------------------------------------------------------------------
#' Obtiene el label en español de una fila del survey.
#' @export
resolve_label_es <- function(row, cols = names(row)) {
  # Prioridad: español explícito → español variantes → bare label → primero no vacío.
  candidates <- c(
    "label::Español (es)",
    "label::Español",
    "label::Spanish (es)",
    "label::Spanish",
    "label::es",
    "label::español",
    "label::spanish",
    "label"
  )
  for (col in candidates) {
    if (col %in% cols) {
      v <- row[[col]]
      if (!is.null(v) && !is.na(v) && nzchar(trimws(as.character(v)))) {
        return(as.character(v))
      }
    }
  }
  # Fallback: cualquier label::* con contenido
  for (col in cols) {
    if (startsWith(col, "label")) {
      v <- row[[col]]
      if (!is.null(v) && !is.na(v) && nzchar(trimws(as.character(v)))) {
        return(as.character(v))
      }
    }
  }
  ""
}

# -----------------------------------------------------------------------------
# Tipo base de una fila (primer token del campo `type`)
# -----------------------------------------------------------------------------
.type_base <- function(type_str) {
  if (is.null(type_str) || is.na(type_str)) return(NA_character_)
  parts <- strsplit(trimws(as.character(type_str)), "\\s+")[[1]]
  parts[1]
}

.is_required <- function(required_str) {
  v <- trimws(tolower(as.character(required_str %||% "")))
  v %in% c("yes", "true", "1")
}

# -----------------------------------------------------------------------------
# Análisis de grupos / repeats: construye gate acumulativo por variable
# -----------------------------------------------------------------------------
#' Recorre survey y para cada variable devuelve:
#'   - group_path: vector de nombres de grupos anidados (outer→inner)
#'   - gate_expr: AST acumulativo de los relevant de los grupos
#'   - repeat_context: nombre del begin_repeat más cercano, o NULL
#'   - row_index
#' @export
build_group_gate_map <- function(survey) {
  stack <- list()  # cada elemento: list(name, type="group"|"repeat", relevant_ast)
  out <- list()

  for (i in seq_len(nrow(survey))) {
    type_str <- as.character(survey$type[i])
    t0 <- .type_base(type_str)
    name <- as.character(survey$name[i])
    rel_raw <- if ("relevant" %in% names(survey)) as.character(survey$relevant[i]) else ""

    if (t0 == "begin_group" || t0 == "begin_repeat") {
      rel_ast <- if (!is.null(rel_raw) && !is.na(rel_raw) && nzchar(rel_raw)) {
        parsed <- odk_parse_to_ast(rel_raw, context = "relevant")
        if (!parsed$degraded_to_raw) parsed$ast else NULL
      } else NULL
      stack[[length(stack) + 1L]] <- list(
        name = name,
        kind = if (t0 == "begin_repeat") "repeat" else "group",
        relevant_ast = rel_ast,
        # Para begin_repeat, capturamos repeat_count si existe.
        repeat_count = if (t0 == "begin_repeat" && "repeat_count" %in% names(survey)) {
          rc <- as.character(survey$repeat_count[i])
          if (!is.na(rc) && nzchar(rc)) rc else NULL
        } else NULL
      )
    } else if (t0 == "end_group" || t0 == "end_repeat") {
      if (length(stack)) stack[[length(stack)]] <- NULL
    } else {
      # Hoja: captura contexto actual.
      group_path <- vapply(stack, function(s) s$name, character(1))
      repeat_ctx <- NULL
      for (s in rev(stack)) {
        if (s$kind == "repeat") { repeat_ctx <- s$name; break }
      }
      # Gate acumulativo: AND de los relevant_ast no vacíos.
      rel_asts <- Filter(Negate(is.null), lapply(stack, function(s) s$relevant_ast))
      gate <- if (length(rel_asts) == 0L) NULL
              else if (length(rel_asts) == 1L) rel_asts[[1]]
              else do.call(ast_and, rel_asts)
      if (!is.null(gate)) gate <- ast_normalize(gate)
      out[[length(out) + 1L]] <- list(
        row_index = i,
        name = name,
        group_path = group_path,
        gate = gate,
        repeat_context = repeat_ctx
      )
    }
  }

  out
}

# -----------------------------------------------------------------------------
# Sub-introspectores por tipo
# -----------------------------------------------------------------------------
.infer_required <- function(survey, ctx_map) {
  rules <- list()
  if (!("required" %in% names(survey))) return(rules)
  for (row in ctx_map) {
    i <- row$row_index
    if (!.is_required(survey$required[i])) next
    t0 <- .type_base(survey$type[i])
    # Saltamos tipos que no llevan validación de required (notes, calculates, etc.)
    if (t0 %in% c("note", "calculate", "start", "end", "today", "deviceid",
                  "subscriberid", "phonenumber", "simserial", "username",
                  "audit", "begin_group", "end_group", "begin_repeat",
                  "end_repeat", "hidden")) next
    label <- resolve_label_es(as.list(survey[i, , drop = FALSE]), names(survey))
    seccion <- if (length(row$group_path)) tail(row$group_path, 1) else NA
    var <- row$name
    # Por lo general, si hay gate, la variable debe responderse solo cuando el gate es TRUE.
    # rule_required con gate AND missing como predicado final.
    nombre <- sprintf("«%s» debe responderse", label %||% var)
    r <- rule_required(
      var = var,
      gate = row$gate,
      nombre = nombre,
      seccion = seccion,
      tabla = if (!is.null(row$repeat_context)) row$repeat_context else "principal",
      repeat_context = row$repeat_context
    )
    rules[[length(rules) + 1L]] <- r
  }
  rules
}

.infer_skip <- function(survey, ctx_map) {
  rules <- list()
  if (!("relevant" %in% names(survey))) return(rules)
  for (row in ctx_map) {
    i <- row$row_index
    t0 <- .type_base(survey$type[i])
    if (t0 %in% c("note", "calculate", "start", "end", "today", "deviceid",
                  "begin_group", "end_group", "begin_repeat", "end_repeat",
                  "hidden")) next
    rel_raw <- as.character(survey$relevant[i])
    if (is.null(rel_raw) || is.na(rel_raw) || !nzchar(rel_raw)) next
    # El relevant específico de la variable (no heredado de grupos).
    parsed <- odk_parse_to_ast(rel_raw, context = "relevant")
    if (parsed$degraded_to_raw) {
      # Regla de salto que no pudimos traducir → escape hatch con origen.
      origin <- if (is_ast(parsed$ast)) parsed$ast$origin else "raw"
      if (identical(origin, "pulldata")) next  # descarta reglas que dependen de pulldata
      label <- resolve_label_es(as.list(survey[i, , drop = FALSE]), names(survey))
      r <- rule_odk_raw(
        odk_expression = rel_raw,
        variables = row$name,
        nombre = sprintf("Salto de «%s» (modo experto)", label %||% row$name),
        seccion = if (length(row$group_path)) tail(row$group_path, 1) else NA,
        tabla = if (!is.null(row$repeat_context)) row$repeat_context else "principal",
        repeat_context = row$repeat_context,
        origin = origin
      )
      rules[[length(rules) + 1L]] <- r
      next
    }
    var <- row$name
    # Combina con gate de grupos padres: gate_full = group_gate AND relevant_local
    gate_full <- if (is.null(row$gate)) parsed$ast else ast_normalize(ast_and(row$gate, parsed$ast))
    # La regla de salto estándar: "variable debe responderse cuando gate=TRUE"
    label <- resolve_label_es(as.list(survey[i, , drop = FALSE]), names(survey))
    nombre <- sprintf("Salto de «%s»", label %||% var)
    r <- rule_skip(
      var = var,
      gate = gate_full,
      direction = "must_answer_when_true",
      nombre = nombre,
      seccion = if (length(row$group_path)) tail(row$group_path, 1) else NA,
      tabla = if (!is.null(row$repeat_context)) row$repeat_context else "principal",
      repeat_context = row$repeat_context
    )
    rules[[length(rules) + 1L]] <- r
  }
  rules
}

.infer_constraint <- function(survey, ctx_map) {
  rules <- list()
  if (!("constraint" %in% names(survey))) return(rules)
  for (row in ctx_map) {
    i <- row$row_index
    t0 <- .type_base(survey$type[i])
    if (t0 %in% c("note", "calculate", "begin_group", "end_group",
                  "begin_repeat", "end_repeat")) next
    con_raw <- as.character(survey$constraint[i])
    if (is.null(con_raw) || is.na(con_raw) || !nzchar(con_raw)) next

    var <- row$name
    parsed <- odk_parse_to_ast(con_raw, context = "constraint", self_var = var)

    label <- resolve_label_es(as.list(survey[i, , drop = FALSE]), names(survey))
    seccion <- if (length(row$group_path)) tail(row$group_path, 1) else NA
    tabla <- if (!is.null(row$repeat_context)) row$repeat_context else "principal"

    if (parsed$degraded_to_raw) {
      origin <- if (is_ast(parsed$ast)) parsed$ast$origin else "raw"
      if (identical(origin, "pulldata")) next  # descartamos pulldata
      r <- rule_odk_raw(
        odk_expression = con_raw,
        variables = var,
        nombre = sprintf("Consistencia de «%s» (modo experto)", label %||% var),
        seccion = seccion,
        tabla = tabla,
        repeat_context = row$repeat_context,
        origin = origin
      )
      rules[[length(rules) + 1L]] <- r
      next
    }

    # Semántica: constraint ODK es TRUE cuando dato es VÁLIDO.
    # Nuestro predicate es TRUE cuando hay inconsistencia.
    # → predicate = not(constraint_ast).
    predicate <- ast_normalize(ast_not(parsed$ast))

    nombre <- sprintf("Consistencia de «%s»", label %||% var)
    # Construimos directamente con make_rule porque es una consistencia
    # genérica — el tipo es "constraint".
    r <- make_rule(
      nombre = nombre,
      tipo_regla = "constraint",
      fuente = "instrumento",
      predicate = predicate,
      gate = row$gate,
      severidad = "error",
      seccion = seccion,
      tabla = tabla,
      repeat_context = row$repeat_context
    )
    rules[[length(rules) + 1L]] <- r
  }
  rules
}

.infer_repeat_length <- function(survey, ctx_map) {
  rules <- list()
  if (!("repeat_count" %in% names(survey))) return(rules)

  # Recorremos solo filas begin_repeat con repeat_count no vacío.
  stack <- list()
  for (i in seq_len(nrow(survey))) {
    t0 <- .type_base(survey$type[i])
    if (t0 == "begin_repeat") {
      rc_raw <- as.character(survey$repeat_count[i])
      if (!is.null(rc_raw) && !is.na(rc_raw) && nzchar(rc_raw)) {
        rep_name <- as.character(survey$name[i])
        # Intentar parsear el repeat_count como AST — soporta count(${rpt_X}),
        # ${var}, número fijo. Si no, cae a string raw.
        expected <- .parse_repeat_count(rc_raw)
        r <- rule_repeat_length(
          repeat_name = rep_name,
          expected = expected,
          nombre = sprintf("Longitud de «%s» coincide con %s", rep_name, rc_raw),
          seccion = NA
        )
        rules[[length(rules) + 1L]] <- r
      }
    }
  }
  rules
}

.parse_repeat_count <- function(rc) {
  # Patrones esperados:
  #   - "count(${rpt_X})"  → referencia a otro repeat — por ahora devolvemos string "count(rpt_X)"
  #   - "${var}"           → nombre de variable → devolvemos "__V__var" string
  #   - "5"                → número fijo → integer
  rc_trim <- trimws(rc)
  if (grepl("^\\d+$", rc_trim)) return(as.integer(rc_trim))
  # Intentar parsear con el parser ODK (en contexto calculate).
  parsed <- odk_parse_to_ast(rc_trim, context = "calculate")
  if (!parsed$degraded_to_raw && !(is_ast(parsed$ast) && ast_op(parsed$ast) %in% c("__var", "__num", "__str"))) {
    return(parsed$ast)
  }
  # fallback: string del expr
  rc_trim
}

# -----------------------------------------------------------------------------
# API pública
# -----------------------------------------------------------------------------
#' Infere reglas de validación a partir del instrumento.
#'
#' @param instrumento lista con `$survey`, `$choices`, `$meta`.
#' @param include vector con subconjunto de: c("required","skip","constraint","repeat_length")
#' @param dedup si TRUE, deduplica por hash (default TRUE).
#' @return `list(rules, lex_report, discarded)`:
#'   - rules: list de vd_rule (unique por hash si dedup=TRUE).
#'   - lex_report: data.frame de smart-quotes/chars detectados por el
#'     normalizador léxico; vacío si todo venía limpio.
#'   - discarded: list de filas con expresiones no parseables / descartadas
#'     por pulldata, útil para reportar al usuario.
#' @export
infer_rules_from_xlsform <- function(instrumento,
                                     include = c("required", "skip",
                                                 "constraint", "repeat_length"),
                                     dedup = TRUE) {
  if (is.null(instrumento$survey)) stop("infer_rules_from_xlsform(): falta survey.")
  survey <- instrumento$survey
  ctx_map <- build_group_gate_map(survey)

  all_rules <- list()
  if ("required" %in% include) {
    all_rules <- c(all_rules, .infer_required(survey, ctx_map))
  }
  if ("skip" %in% include) {
    all_rules <- c(all_rules, .infer_skip(survey, ctx_map))
  }
  if ("constraint" %in% include) {
    all_rules <- c(all_rules, .infer_constraint(survey, ctx_map))
  }
  if ("repeat_length" %in% include) {
    all_rules <- c(all_rules, .infer_repeat_length(survey, ctx_map))
  }

  # Dedup por id (que ya incluye hash del predicate + gate + tipo).
  if (dedup && length(all_rules)) {
    ids <- vapply(all_rules, function(r) r$id, character(1))
    keep <- !duplicated(ids)
    all_rules <- all_rules[keep]
  }

  # Aggregate lex report: recorre todas las expresiones ODK del survey una vez.
  lex_report <- .aggregate_lex_report(survey)

  list(
    rules = all_rules,
    lex_report = lex_report,
    discarded = .collect_discarded(survey, ctx_map)
  )
}

.aggregate_lex_report <- function(survey) {
  fields <- c("relevant", "constraint", "calculation", "choice_filter", "repeat_count")
  fields <- intersect(fields, names(survey))
  rows <- list()
  for (f in fields) {
    exprs <- as.character(survey[[f]])
    names_ <- as.character(survey$name %||% seq_along(exprs))
    for (i in seq_along(exprs)) {
      e <- exprs[i]
      if (is.null(e) || is.na(e) || !nzchar(e)) next
      res <- odk_normalize_lex(e, report = TRUE)
      for (find in res$findings) {
        rows[[length(rows) + 1L]] <- data.frame(
          origin = names_[i],
          field = f,
          label = find$label,
          codepoint = find$codepoint,
          count = find$count,
          stringsAsFactors = FALSE
        )
      }
    }
  }
  if (length(rows)) do.call(rbind, rows)
  else data.frame(origin = character(0), field = character(0),
                  label = character(0), codepoint = character(0),
                  count = integer(0), stringsAsFactors = FALSE)
}

.collect_discarded <- function(survey, ctx_map) {
  # Lista de filas donde parsing falló (raw) o se descartaron por pulldata.
  out <- list()
  for (row in ctx_map) {
    i <- row$row_index
    for (field in c("relevant", "constraint")) {
      if (!(field %in% names(survey))) next
      expr <- as.character(survey[[field]][i])
      if (is.null(expr) || is.na(expr) || !nzchar(expr)) next
      ctx <- if (field == "constraint") "constraint" else "relevant"
      self_v <- if (field == "constraint") row$name else NA_character_
      parsed <- odk_parse_to_ast(expr, context = ctx, self_var = self_v)
      if (parsed$degraded_to_raw) {
        origin <- if (is_ast(parsed$ast)) parsed$ast$origin else "raw"
        out[[length(out) + 1L]] <- list(
          row_name = row$name,
          field = field,
          origin = origin,
          expression = expr
        )
      }
    }
  }
  out
}
