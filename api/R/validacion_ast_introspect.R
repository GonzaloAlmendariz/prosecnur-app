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

.survey_label_map <- function(survey) {
  out <- character(0)
  if (is.null(survey) || !nrow(survey) || !("name" %in% names(survey))) return(out)
  vals <- vapply(seq_len(nrow(survey)), function(i) {
    resolve_label_es(as.list(survey[i, , drop = FALSE]), names(survey))
  }, character(1))
  stats::setNames(vals, as.character(survey$name))
}

.context_prefix <- function(tabla, repeat_context = NULL, seccion = NULL) {
  if (!is.null(repeat_context) && !is.na(repeat_context) && nzchar(repeat_context)) {
    return(sprintf("En la hoja de datos «%s» (sección repetida «%s»), ", tabla, repeat_context))
  }
  if (!is.null(tabla) && !is.na(tabla) && nzchar(tabla) && !identical(tabla, "principal")) {
    return(sprintf("En la hoja de datos «%s», ", tabla))
  }
  ""
}

.lookup_label <- function(label_map, var) {
  v <- as.character(var)
  if (!length(v) || is.na(v) || !nzchar(v)) return("")
  # label_map es un named character vector — indexar con [[ ]] sobre
  # un nombre inexistente da "subscript out of bounds". Chequear antes.
  if (is.null(label_map) || !length(label_map) || !(v %in% names(label_map))) {
    return(v)
  }
  lab <- as.character(label_map[[v]])
  if (is.null(lab) || is.na(lab) || !nzchar(lab)) v else lab
}

.labels_lookup_list <- function(label_map, vars) {
  vars <- unique(as.character(vars[!is.na(vars) & nzchar(vars)]))
  stats::setNames(
    as.list(vapply(vars, function(v) .lookup_label(label_map, v), character(1))),
    vars
  )
}

.enrich_ast_rule_from_survey <- function(rule,
                                         survey,
                                         target_var,
                                         compare_vars = character(0),
                                         gate_ast = NULL,
                                         nombre_humano = NULL,
                                         objetivo = NULL,
                                         subtipo_semantico = NULL,
                                         detalle_ast = NULL) {
  label_map <- .survey_label_map(survey)
  gate_vars <- if (!is.null(gate_ast)) ast_variables(gate_ast) else character(0)
  roles <- list(
    target = target_var,
    drivers = unique(c(compare_vars, gate_vars)),
    compare = compare_vars,
    gate = gate_vars,
    labels = .labels_lookup_list(label_map, c(target_var, compare_vars, gate_vars)),
    tables = stats::setNames(
      as.list(rep(rule$tabla %||% "principal", length(unique(c(target_var, compare_vars, gate_vars))))),
      unique(c(target_var, compare_vars, gate_vars))
    )
  )
  gate_humano <- if (!is.null(gate_ast)) .ast_to_human_text(gate_ast, label_map = label_map) else ""
  detalle_condicion <- if (!is.null(detalle_ast)) .ast_to_human_text(detalle_ast, label_map = label_map) else ""
  .rule_apply_metadata(
    rule,
    primary_var = target_var,
    variable_roles = roles,
    presentation = list(
      nombre_humano = nombre_humano %||% rule$nombre,
      objetivo = objetivo %||% rule$objetivo,
      gate_humano = gate_humano,
      detalle_condicion = detalle_condicion,
      subtipo_semantico = subtipo_semantico %||% NA_character_
    )
  )
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
#'
#' @param return_mode "entries" (default, legacy) o "full" (lista con entries + warnings).
#' @return Si "entries": lista de entries. Si "full": list(entries, warnings).
#'   warnings incluye autorreferencias detectadas: grupos cuyo `relevant`
#'   referencia una variable dentro del propio grupo. En esos casos el gate
#'   se anula (igual que legacy .gate_sin_autorreferencia) para no generar
#'   reglas circulares.
#' @export
build_group_gate_map <- function(survey, return_mode = c("entries", "full")) {
  return_mode <- match.arg(return_mode)

  # Helper: encuentra la fila end correspondiente a un begin en una posición.
  find_matching_end <- function(begin_i) {
    begin_type <- .type_base(as.character(survey$type[begin_i]))
    end_type <- paste0("end_", sub("^begin_", "", begin_type))
    depth <- 1L
    j <- begin_i + 1L
    n <- nrow(survey)
    while (j <= n) {
      tj <- .type_base(as.character(survey$type[j]))
      if (identical(tj, begin_type)) depth <- depth + 1L
      else if (identical(tj, end_type)) {
        depth <- depth - 1L
        if (depth == 0L) return(j)
      }
      j <- j + 1L
    }
    n  # mal cerrado — asumimos hasta el fin
  }

  stack <- list()  # cada elemento: list(name, kind, relevant_ast, row_index)
  out <- list()
  warnings <- list()

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

      # ---- Detección de autorreferencia --------------------------------
      # El relevant del grupo no debe referenciar variables que viven
      # DENTRO del grupo (quedan en loop: "variable Y sólo existe si Y==x").
      if (!is.null(rel_ast)) {
        end_i <- find_matching_end(i)
        if (end_i > i + 1L) {
          descendant_names <- unique(as.character(survey$name[(i + 1L):(end_i - 1L)]))
          descendant_names <- descendant_names[!is.na(descendant_names) & nzchar(descendant_names)]
          referenced <- ast_variables(rel_ast)
          self_refs <- intersect(referenced, descendant_names)
          if (length(self_refs)) {
            warnings[[length(warnings) + 1L]] <- list(
              group_name = name,
              kind = if (t0 == "begin_repeat") "repeat" else "group",
              row = i,
              relevant = rel_raw,
              self_references = self_refs,
              action = "gate_anulado"
            )
            rel_ast <- NULL  # match legacy: descartar el gate circular
          }
        }
      }

      stack[[length(stack) + 1L]] <- list(
        name = name,
        kind = if (t0 == "begin_repeat") "repeat" else "group",
        relevant_ast = rel_ast,
        row_index = i,
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

  if (return_mode == "full") {
    list(entries = out, warnings = warnings)
  } else {
    out
  }
}

# -----------------------------------------------------------------------------
# Sub-introspectores por tipo
# -----------------------------------------------------------------------------
.infer_required <- function(survey, ctx_map) {
  rules <- list()
  if (!("required" %in% names(survey))) return(rules)
  label_map <- .survey_label_map(survey)
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

    # Gate efectivo: acumulado de grupos padres AND relevant propio de la fila.
    # Bug crítico detectado en shadow check GIZ: sin esto, variables con
    # `relevant` propio (ej. p3_otro condicionado a p3=='other') reportaban
    # N inconsistencias incorrectamente porque el gate no incluía la
    # condición de aparición.
    eff_gate <- row$gate
    own_rel <- if ("relevant" %in% names(survey)) as.character(survey$relevant[i]) else ""
    if (!is.null(own_rel) && !is.na(own_rel) && nzchar(own_rel)) {
      parsed <- odk_parse_to_ast(own_rel, context = "relevant")
      if (!parsed$degraded_to_raw) {
        eff_gate <- if (is.null(eff_gate)) parsed$ast
                    else ast_normalize(ast_and(eff_gate, parsed$ast))
      }
    }

    nombre <- sprintf("«%s» debe responderse", label %||% var)
    r <- rule_required(
      var = var,
      gate = eff_gate,
      nombre = nombre,
      seccion = seccion,
      tabla = if (!is.null(row$repeat_context)) row$repeat_context else "principal",
      repeat_context = row$repeat_context
    )
    tabla <- if (!is.null(row$repeat_context)) row$repeat_context else "principal"
    gate_h <- if (!is.null(eff_gate)) .ast_to_human_text(eff_gate, label_map = label_map) else ""
    pref <- .context_prefix(tabla, row$repeat_context, seccion)
    objetivo <- if (nzchar(gate_h)) {
      sprintf("%sSi %s, entonces «%s» debe responderse.", pref, gate_h, label %||% var)
    } else {
      sprintf("%s«%s» debe responderse.", pref, label %||% var)
    }
    r <- .enrich_ast_rule_from_survey(
      r,
      survey = survey,
      target_var = var,
      gate_ast = eff_gate,
      nombre_humano = nombre,
      objetivo = objetivo,
      subtipo_semantico = "req"
    )
    rules[[length(rules) + 1L]] <- r
  }
  rules
}

.infer_skip <- function(survey, ctx_map) {
  rules <- list()
  if (!("relevant" %in% names(survey))) return(rules)
  label_map <- .survey_label_map(survey)
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
    gate_full <- if (is.null(row$gate)) parsed$ast else ast_normalize(ast_and(row$gate, parsed$ast))
    label <- resolve_label_es(as.list(survey[i, , drop = FALSE]), names(survey))
    seccion_row <- if (length(row$group_path)) tail(row$group_path, 1) else NA
    tabla_row <- if (!is.null(row$repeat_context)) row$repeat_context else "principal"

    # Emitimos DOS reglas de salto (match legacy _debe + _nodebe):
    #   1. must_answer_when_true: violación cuando gate=T y variable missing
    #      → la variable debería haberse respondido pero quedó vacía.
    #   2. must_be_empty_when_false: violación cuando gate=F y variable tiene valor
    #      → la variable no debió responderse pero tiene dato.
    # Ambas son válidas y complementarias; tenerlas separadas facilita UX
    # (el usuario ve cuántos casos violan cada dirección).
    r_debe <- rule_skip(
      var = var,
      gate = gate_full,
      direction = "must_answer_when_true",
      nombre = sprintf("Salto de «%s» — debe responderse", label %||% var),
      seccion = seccion_row, tabla = tabla_row, repeat_context = row$repeat_context
    )
    r_nodebe <- rule_skip(
      var = var,
      gate = gate_full,
      direction = "must_be_empty_when_false",
      nombre = sprintf("Salto de «%s» — no debe responderse", label %||% var),
      seccion = seccion_row, tabla = tabla_row, repeat_context = row$repeat_context
    )
    gate_h <- .ast_to_human_text(gate_full, label_map = label_map)
    pref <- .context_prefix(tabla_row, row$repeat_context, seccion_row)
    obj_debe <- if (nzchar(gate_h)) {
      sprintf("%sSi %s, entonces «%s» debe responderse.", pref, gate_h, label %||% var)
    } else {
      sprintf("%s«%s» debe responderse cuando el salto está activo.", pref, label %||% var)
    }
    obj_nodebe <- if (nzchar(gate_h)) {
      sprintf("%sSi no se cumple %s, entonces «%s» no debe responderse.", pref, gate_h, label %||% var)
    } else {
      sprintf("%s«%s» no debe responderse cuando el salto no aplica.", pref, label %||% var)
    }
    r_debe <- .enrich_ast_rule_from_survey(
      r_debe,
      survey = survey,
      target_var = var,
      gate_ast = gate_full,
      nombre_humano = sprintf("Salto de «%s» — debe responderse", label %||% var),
      objetivo = obj_debe,
      subtipo_semantico = "debe",
      detalle_ast = gate_full
    )
    r_nodebe <- .enrich_ast_rule_from_survey(
      r_nodebe,
      survey = survey,
      target_var = var,
      gate_ast = gate_full,
      nombre_humano = sprintf("Salto de «%s» — no debe responderse", label %||% var),
      objetivo = obj_nodebe,
      subtipo_semantico = "nodebe",
      detalle_ast = gate_full
    )
    rules[[length(rules) + 1L]] <- r_debe
    rules[[length(rules) + 1L]] <- r_nodebe
  }
  rules
}

.infer_constraint <- function(survey, ctx_map) {
  rules <- list()
  if (!("constraint" %in% names(survey))) return(rules)
  label_map <- .survey_label_map(survey)
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

    # Gate efectivo: acumulado de grupos padres AND relevant propio de la fila.
    # Si la variable tiene un relevant propio (aparece solo condicionalmente),
    # la constraint solo debe aplicar cuando ese relevant es verdadero —
    # sino reportaríamos falsos positivos en filas donde la variable ni
    # siquiera se mostró. (Mismo fix que en .infer_required.)
    eff_gate <- row$gate
    own_rel <- if ("relevant" %in% names(survey)) as.character(survey$relevant[i]) else ""
    if (!is.null(own_rel) && !is.na(own_rel) && nzchar(own_rel)) {
      parsed_rel <- odk_parse_to_ast(own_rel, context = "relevant")
      if (!parsed_rel$degraded_to_raw) {
        eff_gate <- if (is.null(eff_gate)) parsed_rel$ast
                    else ast_normalize(ast_and(eff_gate, parsed_rel$ast))
      }
    }

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
    #
    # Importante: en ODK una constraint no debe dispararse cuando la
    # respuesta está vacía; ese caso pertenece a `required` si la pregunta
    # es obligatoria. Por eso protegemos la inconsistencia con
    # `not(is_missing(var))`.
    predicate <- ast_normalize(
      ast_and(
        ast_not(ast_is_missing(var)),
        ast_not(parsed$ast)
      )
    )

    nombre <- sprintf("Consistencia de «%s»", label %||% var)
    # Construimos directamente con make_rule porque es una consistencia
    # genérica — el tipo es "constraint".
    r <- make_rule(
      nombre = nombre,
      tipo_regla = "constraint",
      fuente = "instrumento",
      predicate = predicate,
      gate = eff_gate,
      severidad = "error",
      seccion = seccion,
      tabla = tabla,
      repeat_context = row$repeat_context
    )
    pref <- .context_prefix(tabla, row$repeat_context, seccion)
    gate_h <- if (!is.null(eff_gate)) .ast_to_human_text(eff_gate, label_map = label_map) else ""
    detalle_h <- .ast_to_human_text(parsed$ast, label_map = label_map)
    objetivo <- if (nzchar(gate_h)) {
      sprintf("%sSi %s, entonces %s.", pref, gate_h, detalle_h)
    } else {
      sprintf("%s%s.", pref, detalle_h)
    }
    r <- .enrich_ast_rule_from_survey(
      r,
      survey = survey,
      target_var = var,
      compare_vars = setdiff(ast_variables(parsed$ast), var),
      gate_ast = eff_gate,
      nombre_humano = nombre,
      objetivo = objetivo,
      subtipo_semantico = "form",
      detalle_ast = parsed$ast
    )
    rules[[length(rules) + 1L]] <- r
  }
  rules
}

.infer_repeat_length <- function(survey, ctx_map) {
  rules <- list()
  if (!("repeat_count" %in% names(survey))) return(rules)
  label_map <- .survey_label_map(survey)

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
        target_lab <- .lookup_label(label_map, rep_name)
        objetivo <- sprintf("En la hoja de datos «%s», debe existir la cantidad esperada de registros para «%s» según %s.",
                            rep_name, target_lab, rc_raw)
        compare_vars <- if (is_ast(expected)) ast_variables(expected) else if (is.character(expected)) expected else character(0)
        r <- .enrich_ast_rule_from_survey(
          r,
          survey = survey,
          target_var = rep_name,
          compare_vars = compare_vars,
          nombre_humano = sprintf("Longitud de «%s»", target_lab),
          objetivo = objetivo,
          subtipo_semantico = "count"
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
  gate_full <- build_group_gate_map(survey, return_mode = "full")
  ctx_map <- gate_full$entries
  autoref_warnings <- gate_full$warnings

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
    discarded = .collect_discarded(survey, ctx_map),
    autoref_warnings = autoref_warnings
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
