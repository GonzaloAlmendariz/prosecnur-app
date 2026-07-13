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

# -----------------------------------------------------------------------------
# .survey_choices_map: por cada variable de tipo select_one/select_multiple,
# devuelve un named list (code -> label) usando el survey$type para encontrar
# el `list_name` y luego choices$list_name + choices$name.
#
# Ejemplo de salida:
#   list(
#     filtro    = list(`1` = "Sí", `0` = "No"),
#     consent   = list(`1` = "Sí", `0` = "No"),
#     p13       = list(`1` = "Muy insatisfecho", `2` = "Insatisfecho", ...)
#   )
#
# Se usa para que la narrativa diga «marcó «Sí»» en lugar de «debe ser igual
# a '1'» — resuelve los códigos XLSForm a su texto legible.
# -----------------------------------------------------------------------------
.survey_choices_map <- function(survey, choices) {
  if (is.null(survey) || is.null(choices) || !nrow(survey) || !nrow(choices)) {
    return(list())
  }
  if (!all(c("list_name", "name") %in% names(choices))) return(list())
  if (!all(c("type", "name") %in% names(survey))) return(list())

  # Index choices por list_name — split es O(n) y da una estructura fácil.
  choices_by_list <- split(choices, as.character(choices$list_name))

  out <- list()
  for (i in seq_len(nrow(survey))) {
    row_type <- as.character(survey$type[i])
    row_name <- as.character(survey$name[i])
    if (is.na(row_type) || is.na(row_name) || !nzchar(row_type) || !nzchar(row_name)) next

    # Captura "select_one <list>" o "select_multiple <list>" al inicio.
    m <- regmatches(row_type, regexpr("^(select_one|select_multiple)\\s+(\\S+)",
                                       row_type, perl = TRUE))
    if (!length(m)) next
    parts <- strsplit(m, "\\s+")[[1]]
    if (length(parts) < 2L) next
    list_name <- parts[2]
    ch <- choices_by_list[[list_name]]
    if (is.null(ch) || !nrow(ch)) next

    code_to_label <- stats::setNames(
      vapply(seq_len(nrow(ch)), function(j) {
        resolve_label_es(as.list(ch[j, , drop = FALSE]), names(ch))
      }, character(1)),
      as.character(ch$name)
    )
    # Filtrar entradas vacías (code sin label usable).
    keep <- nzchar(code_to_label) & !is.na(code_to_label)
    if (any(keep)) {
      out[[row_name]] <- as.list(code_to_label[keep])
    }
  }
  out
}

# -----------------------------------------------------------------------------
# Nombres estructurales del survey (grupos / repeats / notas)
# -----------------------------------------------------------------------------
# `begin_group`/`begin_repeat` (y sus `end_*`) y las `note` son nodos de
# ESTRUCTURA del XLSForm, no columnas de datos: nunca aparecen en el export.
# El chequeo de columnas requeridas de una regla NO debe tratarlos como columna
# faltante (bug de surfacing: la regla del roster salía "no aplica: Faltan
# columnas: Assistance", donde `Assistance` es el begin_group que contiene el
# repeat, no un dato). Se comparte entre la inferencia (para no meterlos en los
# roles) y — vía metadata de la propia regla — el evaluador.
# NOTA: los `calculate` que producen columna de dato (p.ej. current_code) SÍ son
# columnas; solo excluimos grupos/repeats/notas, que jamás lo son.
.survey_structural_names <- function(survey) {
  if (is.null(survey) || !is.data.frame(survey) ||
      !("type" %in% names(survey)) || !("name" %in% names(survey)) ||
      !nrow(survey)) {
    return(character(0))
  }
  tb <- vapply(as.character(survey$type), .type_base, character(1))
  structural <- as.character(survey$name)[tb %in% c(
    "begin_group", "end_group", "begin_repeat", "end_repeat", "note"
  )]
  unique(structural[!is.na(structural) & nzchar(structural)])
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
                                         detalle_ast = NULL,
                                         choices_map = NULL) {
  label_map <- .survey_label_map(survey)
  gate_vars <- if (!is.null(gate_ast)) ast_variables(gate_ast) else character(0)
  # Un grupo/repeat/nota NO es columna de datos: si el gate (o el predicate)
  # referencia el nombre de un begin_group (p.ej. el `Assistance` que contiene
  # el repeat), no debe entrar al set de columnas requeridas — si no, la regla
  # sale "no aplica: Faltan columnas: Assistance". Filtramos de los roles y del
  # `variables` acumulado. El `target` se preserva (el target de repeat_length
  # es legítimamente el nombre del repeat, y el evaluador lo trata aparte).
  structural <- setdiff(.survey_structural_names(survey), as.character(target_var))
  gate_vars <- setdiff(gate_vars, structural)
  compare_vars <- setdiff(compare_vars, structural)
  if (length(structural)) {
    rule$variables <- setdiff(rule$variables %||% character(0), structural)
  }
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
  gate_humano <- if (!is.null(gate_ast)) .ast_to_human_text(gate_ast, label_map = label_map, choices_map = choices_map) else ""
  detalle_condicion <- if (!is.null(detalle_ast)) .ast_to_human_text(detalle_ast, label_map = label_map, choices_map = choices_map) else ""
  out <- .rule_apply_metadata(
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
  # Scrub final: `.rule_apply_metadata` recompone `variables`/`roles$all` desde
  # el predicate (que sí puede referenciar el nombre del grupo vía el gate
  # embebido). Los depuramos aquí para que ni `variables` ni los roles
  # arrastren nombres estructurales. El `target` se preserva siempre.
  .rule_scrub_structural(out, structural)
}

# Quita nombres estructurales (grupos/repeats/notas) de `variables` y de todos
# los roles de una regla, preservando el `target`. Compartido por la inferencia.
.rule_scrub_structural <- function(rule, structural) {
  if (!length(structural)) return(rule)
  keep_target <- as.character(rule$variable_roles$target %||% rule$primary_var %||% character(0))
  strip <- setdiff(structural, keep_target)
  if (!length(strip)) return(rule)
  rule$variables <- setdiff(rule$variables %||% character(0), strip)
  roles <- rule$variable_roles %||% list()
  for (k in c("gate", "drivers", "compare", "all")) {
    if (!is.null(roles[[k]])) roles[[k]] <- setdiff(roles[[k]], strip)
  }
  rule$variable_roles <- roles
  rule
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
# Resiliencia por-regla: una expresión exótica no debe tumbar el plan entero
# -----------------------------------------------------------------------------
# La construcción de una regla (make_rule → ast_normalize → ast_is_valid, o los
# constructores tipados) puede fallar ante una expresión ODK que el motor aún
# no soporta. En vez de propagar el error y abortar la construcción del plan
# completo, cada regla se compila dentro de un guard: si falla, se registra como
# `no_compilable` y se continúa con las demás. La UI recibe cuántas/cuáles se
# saltaron (campo `unsupported` del resultado de infer_rules_from_xlsform).

# Colector mutable (env) de reglas no compilables. Un env evita pasar el estado
# por copia entre los cuatro sub-introspectores.
.make_rule_collector <- function() {
  env <- new.env(parent = emptyenv())
  env$items <- list()
  list(
    record = function(entry) env$items[[length(env$items) + 1L]] <- entry,
    items  = function() env$items
  )
}

.infer_record_unsupported <- function(collector, field, row, survey, error) {
  if (is.null(collector)) return(invisible())
  i <- row$row_index
  expr <- tryCatch({
    if (!is.null(field) && !is.null(i) && field %in% names(survey)) {
      as.character(survey[[field]][i])
    } else NA_character_
  }, error = function(...) NA_character_)
  collector$record(list(
    row_name = as.character(row$name %||% NA_character_),
    field = as.character(field %||% NA_character_),
    reason = "no_compilable",
    expression = as.character(expr %||% NA_character_),
    error = as.character(error %||% "")
  ))
  invisible()
}

# Compila UNA regla dentro del guard. Devuelve la regla (vd_rule) o NULL si falló.
.infer_emit <- function(collector, field, row, survey, thunk) {
  tryCatch(
    thunk(),
    error = function(e) {
      .infer_record_unsupported(collector, field, row, survey, conditionMessage(e))
      NULL
    }
  )
}

# Igual que .infer_emit pero para bloques que emiten 0..N reglas (ej. saltos que
# producen «debe» + «no debe»). Devuelve siempre una lista (vacía si falló).
.infer_emit_list <- function(collector, field, row, survey, thunk) {
  tryCatch({
    out <- thunk()
    if (is.null(out)) list() else out
  }, error = function(e) {
    .infer_record_unsupported(collector, field, row, survey, conditionMessage(e))
    list()
  })
}

# -----------------------------------------------------------------------------
# Sub-introspectores por tipo
# -----------------------------------------------------------------------------
.infer_required <- function(survey, ctx_map, choices_map = NULL, collector = NULL) {
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
      # Incorporamos el relevant propio al gate SIEMPRE, incluso si degradó a raw
      # (pulldata / expresión compleja intraducible). Antes se descartaba en
      # silencio → la regla sobre-exigía la respuesta en filas donde el campo ni
      # aparecía. Con el raw en el gate, el evaluador la clasifica como
      # requiere-roster / modo-experto sin sobre-exigir.
      eff_gate <- if (is.null(eff_gate)) parsed$ast
                  else ast_normalize(ast_and(eff_gate, parsed$ast))
    }

    # Nombre scanner-friendly: `[var_tecnica] «label» debe responderse`.
    # La var técnica al inicio permite diferenciar rápido en listas largas
    # donde muchos labels son similares ("Otro (especifique)", "Sí/No", etc.).
    nombre <- if (!is.null(label) && nzchar(label) && label != var) {
      sprintf("[%s] «%s» debe responderse", var, label)
    } else {
      sprintf("[%s] debe responderse", var)
    }
    r <- .infer_emit(collector, "required", row, survey, function() {
      rr <- rule_required(
        var = var,
        gate = eff_gate,
        nombre = nombre,
        seccion = seccion,
        tabla = if (!is.null(row$repeat_context)) row$repeat_context else "principal",
        repeat_context = row$repeat_context
      )
      tabla <- if (!is.null(row$repeat_context)) row$repeat_context else "principal"
      gate_h <- if (!is.null(eff_gate)) .ast_to_human_text(eff_gate, label_map = label_map, choices_map = choices_map) else ""
      pref <- .context_prefix(tabla, row$repeat_context, seccion)
      objetivo <- if (nzchar(gate_h)) {
        sprintf("%sSi %s, entonces «%s» debe responderse.", pref, gate_h, label %||% var)
      } else {
        sprintf("%s«%s» debe responderse.", pref, label %||% var)
      }
      .enrich_ast_rule_from_survey(
        rr,
        survey = survey,
        target_var = var,
        gate_ast = eff_gate,
        nombre_humano = nombre,
        objetivo = objetivo,
        subtipo_semantico = "req",
        choices_map = choices_map
      )
    })
    if (!is.null(r)) rules[[length(rules) + 1L]] <- r
  }
  rules
}

.infer_skip <- function(survey, ctx_map, choices_map = NULL, collector = NULL) {
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
    has_own_relevant <- !is.null(rel_raw) && !is.na(rel_raw) && nzchar(rel_raw)
    if (!has_own_relevant && is.null(row$gate)) next

    # El salto efectivo combina relevant específico de la variable con gates
    # heredados de grupos/repeats padres. Si solo existe gate heredado, igual
    # se debe controlar que la variable quede vacía cuando la sección no abre.
    own_gate <- NULL
    if (has_own_relevant) {
      parsed <- odk_parse_to_ast(rel_raw, context = "relevant")
      if (parsed$degraded_to_raw) {
        # Regla de salto que no pudimos traducir → escape hatch con origen.
        origin <- if (is_ast(parsed$ast)) parsed$ast$origin else "raw"
        if (identical(origin, "pulldata")) next  # descarta reglas que dependen de pulldata
        label <- resolve_label_es(as.list(survey[i, , drop = FALSE]), names(survey))
        r <- .infer_emit(collector, "relevant", row, survey, function() {
          rule_odk_raw(
            odk_expression = rel_raw,
            variables = row$name,
            nombre = if (!is.null(label) && nzchar(label) && label != row$name) sprintf("[%s] Salto · «%s» (modo experto)", row$name, label) else sprintf("[%s] Salto (modo experto)", row$name),
            seccion = if (length(row$group_path)) tail(row$group_path, 1) else NA,
            tabla = if (!is.null(row$repeat_context)) row$repeat_context else "principal",
            repeat_context = row$repeat_context,
            origin = origin
          )
        })
        if (!is.null(r)) rules[[length(rules) + 1L]] <- r
        next
      }
      own_gate <- parsed$ast
    }
    var <- row$name
    gate_full <- if (is.null(row$gate)) {
      own_gate
    } else if (is.null(own_gate)) {
      row$gate
    } else {
      ast_normalize(ast_and(row$gate, own_gate))
    }
    if (is.null(gate_full)) next
    produced <- .infer_emit_list(collector, "relevant", row, survey, function() {
      label <- resolve_label_es(as.list(survey[i, , drop = FALSE]), names(survey))
      seccion_row <- if (length(row$group_path)) tail(row$group_path, 1) else NA
      tabla_row <- if (!is.null(row$repeat_context)) row$repeat_context else "principal"
      required_flag <- if ("required" %in% names(survey)) .is_required(survey$required[i]) else FALSE
      emit_debe <- has_own_relevant || required_flag

      # _nodebe siempre aplica: si el salto/sección está inactivo, la variable
      # debe quedar vacía. _debe solo aplica si ya existía relevant propio o la
      # pregunta es requerida, para no volver obligatorias preguntas opcionales
      # dentro de una sección abierta.
      r_debe <- NULL
      if (isTRUE(emit_debe)) {
        r_debe <- rule_skip(
          var = var,
          gate = gate_full,
          direction = "must_answer_when_true",
          nombre = if (!is.null(label) && nzchar(label) && label != var) sprintf("[%s] Salto · «%s» — debe responderse", var, label) else sprintf("[%s] Salto — debe responderse", var),
          seccion = seccion_row, tabla = tabla_row, repeat_context = row$repeat_context
        )
      }
      r_nodebe <- rule_skip(
        var = var,
        gate = gate_full,
        direction = "must_be_empty_when_false",
        nombre = if (!is.null(label) && nzchar(label) && label != var) sprintf("[%s] Salto · «%s» — no debe responderse", var, label) else sprintf("[%s] Salto — no debe responderse", var),
        seccion = seccion_row, tabla = tabla_row, repeat_context = row$repeat_context
      )
      gate_h <- .ast_to_human_text(gate_full, label_map = label_map, choices_map = choices_map)
      gate_neg <- ast_normalize(ast_not(gate_full))
      gate_neg_h <- .ast_to_human_text(gate_neg, label_map = label_map, choices_map = choices_map)
      pref <- .context_prefix(tabla_row, row$repeat_context, seccion_row)
      obj_debe <- if (nzchar(gate_h)) {
        sprintf("%sSi %s, entonces «%s» debe responderse.", pref, gate_h, label %||% var)
      } else {
        sprintf("%s«%s» debe responderse cuando el salto está activo.", pref, label %||% var)
      }
      obj_nodebe <- if (nzchar(gate_neg_h)) {
        sprintf("%sSi %s, entonces «%s» no debe responderse.", pref, gate_neg_h, label %||% var)
      } else {
        sprintf("%s«%s» no debe responderse cuando el salto no aplica.", pref, label %||% var)
      }
      if (!is.null(r_debe)) {
        r_debe <- .enrich_ast_rule_from_survey(
          r_debe,
          survey = survey,
          target_var = var,
          gate_ast = gate_full,
          nombre_humano = if (!is.null(label) && nzchar(label) && label != var) sprintf("[%s] Salto · «%s» — debe responderse", var, label) else sprintf("[%s] Salto — debe responderse", var),
          objetivo = obj_debe,
          subtipo_semantico = "debe",
          detalle_ast = gate_full,
          choices_map = choices_map
        )
      }
      r_nodebe <- .enrich_ast_rule_from_survey(
        r_nodebe,
        survey = survey,
        target_var = var,
        gate_ast = gate_neg,
        nombre_humano = if (!is.null(label) && nzchar(label) && label != var) sprintf("[%s] Salto · «%s» — no debe responderse", var, label) else sprintf("[%s] Salto — no debe responderse", var),
        objetivo = obj_nodebe,
        subtipo_semantico = "nodebe",
        detalle_ast = gate_neg,
        choices_map = choices_map
      )
      Filter(Negate(is.null), list(r_debe, r_nodebe))
    })
    rules <- c(rules, produced)
  }
  rules
}

.infer_constraint <- function(survey, ctx_map, choices_map = NULL, collector = NULL) {
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
      # Igual que en .infer_required: el relevant propio se suma al gate aunque
      # degrade a raw, para que una constraint bajo un relevant intraducible no
      # se evalúe con un gate parcial (falsos positivos) sino que caiga en modo
      # experto / requiere-roster.
      eff_gate <- if (is.null(eff_gate)) parsed_rel$ast
                  else ast_normalize(ast_and(eff_gate, parsed_rel$ast))
    }

    if (parsed$degraded_to_raw) {
      origin <- if (is_ast(parsed$ast)) parsed$ast$origin else "raw"
      if (identical(origin, "pulldata")) next  # descartamos pulldata
      r <- .infer_emit(collector, "constraint", row, survey, function() {
        rule_odk_raw(
          odk_expression = con_raw,
          variables = var,
          nombre = if (!is.null(label) && nzchar(label) && label != var) sprintf("[%s] Consistencia · «%s» (modo experto)", var, label) else sprintf("[%s] Consistencia (modo experto)", var),
          seccion = seccion,
          tabla = tabla,
          repeat_context = row$repeat_context,
          origin = origin
        )
      })
      if (!is.null(r)) rules[[length(rules) + 1L]] <- r
      next
    }

    # Semántica: constraint ODK es TRUE cuando dato es VÁLIDO.
    # Nuestro predicate es TRUE cuando hay inconsistencia.
    #
    # Importante: en ODK una constraint no debe dispararse cuando la
    # respuesta está vacía; ese caso pertenece a `required` si la pregunta
    # es obligatoria. Por eso protegemos la inconsistencia con
    # `not(is_missing(var))`.
    r <- .infer_emit(collector, "constraint", row, survey, function() {
      predicate <- ast_normalize(
        ast_and(
          ast_not(ast_is_missing(var)),
          ast_not(parsed$ast)
        )
      )

      nombre <- if (!is.null(label) && nzchar(label) && label != var) sprintf("[%s] Consistencia · «%s»", var, label) else sprintf("[%s] Consistencia", var)
      # Construimos directamente con make_rule porque es una consistencia
      # genérica — el tipo es "constraint".
      rr <- make_rule(
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
      gate_h <- if (!is.null(eff_gate)) .ast_to_human_text(eff_gate, label_map = label_map, choices_map = choices_map) else ""
      detalle_h <- .ast_to_human_text(parsed$ast, label_map = label_map, choices_map = choices_map)
      objetivo <- if (nzchar(gate_h)) {
        sprintf("%sSi %s, entonces %s.", pref, gate_h, detalle_h)
      } else {
        sprintf("%s%s.", pref, detalle_h)
      }
      .enrich_ast_rule_from_survey(
        rr,
        survey = survey,
        target_var = var,
        compare_vars = setdiff(ast_variables(parsed$ast), var),
        gate_ast = eff_gate,
        nombre_humano = nombre,
        objetivo = objetivo,
        subtipo_semantico = "form",
        detalle_ast = parsed$ast,
        choices_map = choices_map
      )
    })
    if (!is.null(r)) rules[[length(rules) + 1L]] <- r
  }
  rules
}

.infer_repeat_length <- function(survey, ctx_map, choices_map = NULL, collector = NULL) {
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
        # pseudo-row para el reporte de no-compilables (este introspector no
        # itera sobre ctx_map sino sobre las filas del survey).
        pseudo_row <- list(row_index = i, name = rep_name)
        # RC2 — gate de presencia: el `relevant` propio del begin_repeat controla
        # si la sección debía abrir. Cuando el gate es FALSE, 0 filas hija es lo
        # correcto y >0 filas es inconsistencia (`sobran_gate_cerrado`). Solo se
        # adjunta si el relevant parsea limpio; si degrada a raw, no hay gate
        # (degradación silenciosa) y la regla sigue la lógica want/have de RC1.
        gate_ast <- NULL
        if ("relevant" %in% names(survey)) {
          rel_raw <- as.character(survey$relevant[i])
          if (!is.null(rel_raw) && !is.na(rel_raw) && nzchar(rel_raw)) {
            parsed_rel <- odk_parse_to_ast(rel_raw, context = "relevant")
            if (!isTRUE(parsed_rel$degraded_to_raw)) gate_ast <- parsed_rel$ast
          }
        }
        r <- .infer_emit(collector, "repeat_count", pseudo_row, survey, function() {
          # Intentar parsear el repeat_count como AST — soporta count(${rpt_X}),
          # ${var}, número fijo. Si no, cae a string raw.
          expected <- .parse_repeat_count(rc_raw)
          rr <- rule_repeat_length(
            repeat_name = rep_name,
            expected = expected,
            gate = gate_ast,
            nombre = sprintf("Longitud de «%s» coincide con %s", rep_name, rc_raw),
            seccion = NA
          )
          target_lab <- .lookup_label(label_map, rep_name)
          objetivo <- sprintf("En la hoja de datos «%s», debe existir la cantidad esperada de registros para «%s» según %s.",
                              rep_name, target_lab, rc_raw)
          compare_vars <- if (is_ast(expected)) ast_variables(expected) else if (is.character(expected)) expected else character(0)
          .enrich_ast_rule_from_survey(
            rr,
            survey = survey,
            target_var = rep_name,
            compare_vars = compare_vars,
            nombre_humano = sprintf("Longitud de «%s»", target_lab),
            objetivo = objetivo,
            subtipo_semantico = "count",
            choices_map = choices_map
          )
        })
        if (!is.null(r)) rules[[length(rules) + 1L]] <- r
      }
    }
  }
  rules
}

# -----------------------------------------------------------------------------
# Coherencia relacional del repeat (RC3/RC4/RC5) — familia madre↔hija
# -----------------------------------------------------------------------------
# Extrae la variable select_multiple conductora de un `count-selected(${var})`.
# Devuelve NULL si el repeat_count no tiene esa forma (degradación silenciosa).
.extract_count_selected_var <- function(rc_raw) {
  if (is.null(rc_raw) || is.na(rc_raw) || !nzchar(rc_raw)) return(NULL)
  m <- regmatches(rc_raw, regexpr("count-selected\\s*\\(\\s*\\$\\{([^}]+)\\}\\s*\\)",
                                   rc_raw, perl = TRUE))
  if (!length(m)) return(NULL)
  var <- trimws(sub(".*count-selected\\s*\\(\\s*\\$\\{([^}]+)\\}\\s*\\).*", "\\1", m, perl = TRUE))
  if (!nzchar(var)) NULL else var
}

# Enumera cada begin_repeat del survey con la metadata relacional necesaria:
#   name, begin_i, end_i, relevant_raw, repeat_count_raw,
#   sm_conductor (var del count-selected, o NULL),
#   identity_var (calculate de identidad del roster: leaf `current_code` o cuya
#     `calculation` usa `jr:choice-name(`, o NULL).
.relational_repeat_specs <- function(survey) {
  if (is.null(survey) || !nrow(survey) || !all(c("type", "name") %in% names(survey))) {
    return(list())
  }
  n <- nrow(survey)
  has_calc <- "calculation" %in% names(survey)
  has_rc   <- "repeat_count" %in% names(survey)
  has_rel  <- "relevant" %in% names(survey)

  find_end <- function(begin_i) {
    depth <- 1L; j <- begin_i + 1L
    while (j <= n) {
      tj <- .type_base(as.character(survey$type[j]))
      if (identical(tj, "begin_repeat")) depth <- depth + 1L
      else if (identical(tj, "end_repeat")) { depth <- depth - 1L; if (depth == 0L) return(j) }
      j <- j + 1L
    }
    n
  }

  out <- list()
  for (i in seq_len(n)) {
    if (!identical(.type_base(as.character(survey$type[i])), "begin_repeat")) next
    rep_name <- as.character(survey$name[i])
    if (is.na(rep_name) || !nzchar(rep_name)) next
    end_i <- find_end(i)

    rc_raw  <- if (has_rc) as.character(survey$repeat_count[i]) else NA_character_
    rel_raw <- if (has_rel) as.character(survey$relevant[i]) else NA_character_
    sm_conductor <- .extract_count_selected_var(rc_raw)

    identity_var <- NULL
    if (end_i > i + 1L) {
      for (j in (i + 1L):(end_i - 1L)) {
        if (!identical(.type_base(as.character(survey$type[j])), "calculate")) next
        nm_j <- as.character(survey$name[j])
        calc_j <- if (has_calc) as.character(survey$calculation[j]) else NA_character_
        is_id <- (!is.na(nm_j) && identical(nm_j, "current_code")) ||
                 (!is.na(calc_j) && nzchar(calc_j) &&
                    grepl("jr:choice-name\\s*\\(", calc_j, perl = TRUE))
        if (isTRUE(is_id) && !is.na(nm_j) && nzchar(nm_j)) { identity_var <- nm_j; break }
      }
    }

    out[[length(out) + 1L]] <- list(
      name = rep_name,
      begin_i = i,
      end_i = end_i,
      relevant_raw = rel_raw,
      repeat_count_raw = rc_raw,
      sm_conductor = sm_conductor,
      identity_var = identity_var
    )
  }
  out
}

# RC3 — integridad referencial: una regla por repeat (tabla = <repeat>). Marca
# filas hija huérfanas (`_parent_index` sin madre). Se emite SIEMPRE por repeat:
# toda base hija debe enlazar con un caso de la principal.
.infer_referential_integrity <- function(survey, choices_map = NULL, collector = NULL) {
  rules <- list()
  label_map <- .survey_label_map(survey)
  for (spec in .relational_repeat_specs(survey)) {
    rep_name <- spec$name
    pseudo_row <- list(row_index = spec$begin_i, name = rep_name)
    r <- .infer_emit(collector, "type", pseudo_row, survey, function() {
      target_lab <- .lookup_label(label_map, rep_name)
      rule_referential_parent_exists(
        repeat_table = rep_name,
        source_table = "principal",
        parent_key_local = "_parent_index",
        parent_key_remote = "_index",
        nombre = sprintf("Cada fila de «%s» tiene su persona", target_lab),
        objetivo = sprintf(
          "Cada fila de «%s» debe pertenecer a una persona que exista en la base principal.",
          target_lab
        )
      )
    })
    if (!is.null(r)) rules[[length(rules) + 1L]] <- r
  }
  rules
}

# RC4 — unicidad de roster: reusa rule_duplicate sobre (`_parent_index`,
# <identity_var>). Solo se emite si el repeat declara una calculate de identidad
# de roster (`current_code` / `jr:choice-name`). Severidad advertencia.
.infer_roster_uniqueness <- function(survey, choices_map = NULL, collector = NULL) {
  rules <- list()
  label_map <- .survey_label_map(survey)
  for (spec in .relational_repeat_specs(survey)) {
    if (is.null(spec$identity_var)) next
    rep_name <- spec$name
    idv <- spec$identity_var
    pseudo_row <- list(row_index = spec$begin_i, name = rep_name)
    r <- .infer_emit(collector, "calculation", pseudo_row, survey, function() {
      target_lab <- .lookup_label(label_map, rep_name)
      rr <- rule_duplicate(
        vars = c("_parent_index", idv),
        tabla = rep_name,
        severidad = "advertencia",
        fuente = "instrumento",
        nombre = sprintf("Sin filas duplicadas en «%s»", target_lab),
        objetivo = sprintf(
          "En «%s», «%s» no debe repetirse dentro de la misma persona.",
          target_lab, idv
        )
      )
      rr$repeat_context <- rep_name  # degrada con gracia si no hay base hija
      .rule_apply_metadata(
        rr,
        primary_var = "_parent_index",
        variable_roles = list(
          target = "_parent_index",
          compare = idv,
          drivers = character(0),
          gate = character(0)
        ),
        presentation = list(subtipo_semantico = "relacional")
      )
    })
    if (!is.null(r)) rules[[length(rules) + 1L]] <- r
  }
  rules
}

# RC5 — correspondencia roster↔selección: una regla por repeat que tenga AMBOS
# referentes (SM conductor del count-selected + identidad current_code). Si
# falta cualquiera, NO se emite (degradación silenciosa, no error).
.infer_roster_correspondence <- function(survey, choices_map = NULL, collector = NULL) {
  rules <- list()
  label_map <- .survey_label_map(survey)
  for (spec in .relational_repeat_specs(survey)) {
    if (is.null(spec$sm_conductor) || is.null(spec$identity_var)) next
    rep_name <- spec$name
    sm_var <- spec$sm_conductor
    idv <- spec$identity_var
    pseudo_row <- list(row_index = spec$begin_i, name = rep_name)
    r <- .infer_emit(collector, "repeat_count", pseudo_row, survey, function() {
      sm_lab <- .lookup_label(label_map, sm_var)
      rule_roster_correspondence(
        host_sm_var = sm_var,
        source_table = rep_name,
        source_var = idv,
        parent_key_local = "_index",
        parent_key_remote = "_parent_index",
        nombre = sprintf("Las filas coinciden con lo marcado · «%s»", sm_lab),
        objetivo = sprintf(
          "Las opciones marcadas en «%s» deben corresponder exactamente con las filas repetidas de «%s».",
          sm_lab, rep_name
        )
      )
    })
    if (!is.null(r)) rules[[length(rules) + 1L]] <- r
  }
  rules
}

# -----------------------------------------------------------------------------
# Calculates con pulldata → categoría informativa "requiere listado externo"
# -----------------------------------------------------------------------------
# Los `calculate` que jalan de un dataset externo vía `pulldata('<roster>', …)`
# (p.ej. sede_ppl/date_ppl/genero_ppl del PDM contra `listadoedp`) hoy se
# descartan en silencio: el builder legacy los marca "no ejecutable" y ninguna
# regla los representa. Eso los vuelve invisibles — el usuario no sabe que
# existen ni por qué no se validan. No es que la sintaxis no se soporte: falta el
# dato externo. Los superficiamos como reglas odk_raw con origin="pulldata"; el
# evaluador las etiqueta con issue_code `requires_external_dataset` (distinto de
# "modo experto"), y el detalle nombra el roster para que la UI (Fase 4) lo
# muestre. NO se evalúan (no hay contra qué): son informativas.
.infer_external_dataset_calculates <- function(survey, ctx_map, choices_map = NULL,
                                               collector = NULL) {
  rules <- list()
  if (!("calculation" %in% names(survey))) return(rules)
  label_map <- .survey_label_map(survey)
  for (row in ctx_map) {
    i <- row$row_index
    t0 <- .type_base(survey$type[i])
    if (!identical(t0, "calculate")) next
    calc_raw <- as.character(survey$calculation[i])
    if (is.null(calc_raw) || is.na(calc_raw) || !nzchar(calc_raw)) next
    if (!grepl("\\bpulldata\\s*\\(", calc_raw, perl = TRUE)) next

    var <- row$name
    label <- resolve_label_es(as.list(survey[i, , drop = FALSE]), names(survey))
    datasets <- .pulldata_dataset_names(calc_raw)
    ds_txt <- if (length(datasets)) {
      paste(vapply(datasets, function(d) sprintf("«%s»", d), character(1)), collapse = ", ")
    } else {
      "externo"
    }
    seccion <- if (length(row$group_path)) tail(row$group_path, 1) else NA
    tabla <- if (!is.null(row$repeat_context)) row$repeat_context else "principal"

    r <- .infer_emit(collector, "calculation", row, survey, function() {
      rr <- rule_odk_raw(
        odk_expression = calc_raw,
        variables = var,
        nombre = if (!is.null(label) && nzchar(label) && label != var) {
          sprintf("[%s] «%s» — requiere listado externo %s", var, label, ds_txt)
        } else {
          sprintf("[%s] requiere listado externo %s", var, ds_txt)
        },
        objetivo = sprintf(
          "El valor de «%s» se obtiene del listado externo %s mediante pulldata; no se puede validar contra las respuestas sin ese dato precargado.",
          label %||% var, ds_txt
        ),
        seccion = seccion,
        tabla = tabla,
        repeat_context = row$repeat_context,
        origin = "pulldata"
      )
      # Categoría propia para que la UX no la confunda con "modo experto".
      rr$categoria_ux <- "roster_externo"
      rr
    })
    if (!is.null(r)) rules[[length(rules) + 1L]] <- r
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
  # Solo aceptamos el AST como `expected` si es plenamente válido y no es un
  # pseudo-nodo de valor (`__var`/`__num`/`__str`). Expresiones que no se
  # pliegan a un valor esperado tipado —p.ej. count-selected(${x})— caen al
  # string crudo: repeat_length_matches no lo evalúa (es un stub en compiler y
  # evaluador), solo lo muestra, así que el string preserva la expresión
  # original y no revienta ast_is_valid en make_rule.
  is_bare_value <- is_ast(parsed$ast) && ast_op(parsed$ast) %in% c("__var", "__num", "__str")
  if (!parsed$degraded_to_raw && !is_bare_value &&
      is_ast(parsed$ast) && isTRUE(ast_is_valid(parsed$ast)$ok)) {
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
                                                 "constraint", "repeat_length",
                                                 "external_dataset",
                                                 "repeat_relational"),
                                     dedup = TRUE) {
  if (is.null(instrumento$survey)) stop("infer_rules_from_xlsform(): falta survey.")
  survey <- instrumento$survey
  # choices_map se construye una sola vez y se propaga a todos los
  # sub-inferidores. Permite que los textos humanos resuelvan códigos
  # de choice a labels (ej: "marcó «Sí»" en vez de "debe ser igual a '1'").
  choices_map <- .survey_choices_map(survey, instrumento$choices)
  gate_full <- build_group_gate_map(survey, return_mode = "full")
  ctx_map <- gate_full$entries
  autoref_warnings <- gate_full$warnings

  # Colector de reglas no compilables: si una expresión exótica revienta al
  # construir su regla, se registra y se salta — el plan se arma con las demás.
  collector <- .make_rule_collector()

  all_rules <- list()
  if ("required" %in% include) {
    all_rules <- c(all_rules, .infer_required(survey, ctx_map, choices_map = choices_map, collector = collector))
  }
  if ("skip" %in% include) {
    all_rules <- c(all_rules, .infer_skip(survey, ctx_map, choices_map = choices_map, collector = collector))
  }
  if ("constraint" %in% include) {
    all_rules <- c(all_rules, .infer_constraint(survey, ctx_map, choices_map = choices_map, collector = collector))
  }
  if ("repeat_length" %in% include) {
    all_rules <- c(all_rules, .infer_repeat_length(survey, ctx_map, choices_map = choices_map, collector = collector))
  }
  # Calculates con pulldata → categoría "requiere listado externo" (siempre ON):
  # es informativo, barato, y evita que estas reglas queden invisibles.
  if ("external_dataset" %in% include) {
    all_rules <- c(all_rules, .infer_external_dataset_calculates(survey, ctx_map, choices_map = choices_map, collector = collector))
  }
  # Familia "coherencia relacional del repeat" (RC3/RC4/RC5): trata madre+hija
  # como un instrumento con base relacionada. RC2 (presencia por gate) va con
  # repeat_length. Default ON en `.validation_ast_include`.
  if ("repeat_relational" %in% include) {
    all_rules <- c(
      all_rules,
      .infer_referential_integrity(survey, choices_map = choices_map, collector = collector),
      .infer_roster_uniqueness(survey, choices_map = choices_map, collector = collector),
      .infer_roster_correspondence(survey, choices_map = choices_map, collector = collector)
    )
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
    autoref_warnings = autoref_warnings,
    # Reglas que no se pudieron compilar (expresión no soportada). El plan se
    # construye igual con el resto; esto le da transparencia a la UI.
    unsupported = collector$items()
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
