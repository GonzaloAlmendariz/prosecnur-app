# =============================================================================
# Validación AST — Rule + constructores específicos + validador (Capa 4-5)
# =============================================================================
# Una `Rule` es un objeto Rule (lista con class "vd_rule") que encapsula:
#   - Identidad:  id, nombre_humano, fuente (instrumento|custom)
#   - Taxonomía:  tipo_regla, categoria_ux, severidad
#   - Lógica:     gate (condición de activación, AST|NULL), predicate (AST)
#   - Contexto:   tabla, seccion, repeat_context, residual_codes
#   - UX:         objetivo (texto humano), remediation_default, preview_chart
#   - Metadata:   variables (derivadas del predicate), hash (determinístico)
#
# El flujo de construcción:
#   1. Un constructor específico (rule_required, rule_range, ...) arma el
#      Predicate correcto y llama `make_rule(...)`.
#   2. `make_rule()` normaliza, valida estructuralmente, deriva id/hash,
#      retorna la Rule.
#   3. `validate_rule(rule, instrumento)` opcional: valida contra el
#      contexto del instrumento (variables existen, tipos coherentes).
#   4. `compile_rule(rule)` produce la fila del plan (Procesamiento string).
#
# Invariantes:
#   - Toda Rule pasa por `make_rule()`. No se construyen directamente.
#   - El `predicate` siempre está normalizado (ast_normalize aplicado).
#   - El `id` es determinístico: `hash(tipo_regla + vars + predicate_hash)`.
#   - `variables` se deriva — no se pasa a mano.

# -----------------------------------------------------------------------------
# Enums cerrados
# -----------------------------------------------------------------------------
.RULE_TIPOS <- c(
  "required",             # completitud: variable debe responderse
  "skip",                 # salto: variable debe/no-debe responderse según gate
  "constraint",           # consistencia lógica entre variables
  "range",                # fuera de rango (numérico/fecha)
  "catalog",              # valor fuera del catálogo permitido
  "outlier",              # outlier estadístico (IQR/Z)
  "duplicate",            # tuplas repetidas
  "coherence",            # coherencia entre 2+ variables
  "select_multiple_cardinality", # cardinalidad/exclusividad de select_multiple
  "pattern",              # patrones sospechosos (straight-lining)
  "calculate_check",      # validación sobre variable calculada
  "repeat_length",        # longitud de tabla repeat vs expected
  "odk_raw"               # escape hatch: ODK expression no traducible
)

.RULE_CATEGORIAS_UX <- c(
  "completitud",          # "required"
  "saltos",               # "skip"
  "consistencia",         # "constraint"
  "rangos",               # "range"
  "catálogo",             # "catalog"
  "outliers",             # "outlier"
  "duplicados",           # "duplicate"
  "coherencia",           # "coherence"
  "cardinalidad",         # "select_multiple_cardinality"
  "patrones",             # "pattern"
  "cálculos",             # "calculate_check"
  "estructura",           # "repeat_length"
  "experto"               # "odk_raw"
)

.RULE_SEVERIDADES <- c("error", "advertencia", "info")
.RULE_FUENTES <- c("instrumento", "custom")
.RULE_REMEDIATION_DEFAULTS <- c(
  "exclude_cases", "replace_value", "normalize_value",
  "impute_value", "ignore"
)
.RULE_PREVIEW_CHARTS <- c("histogram", "boxplot", "bar", "table")

#' @export
rule_supported_tipos <- function() .RULE_TIPOS
#' @export
rule_supported_categorias_ux <- function() .RULE_CATEGORIAS_UX

# -----------------------------------------------------------------------------
# Constructor canónico — única ruta de creación
# -----------------------------------------------------------------------------
#' Construye un objeto Rule tipado.
#'
#' @param nombre        character(1) humano (ej. "Edad dentro de rango válido")
#' @param tipo_regla    uno de `rule_supported_tipos()`
#' @param fuente        "instrumento" | "custom"
#' @param predicate     AST que define cuándo hay inconsistencia (TRUE)
#' @param gate          AST | NULL — cuándo aplica la regla (NULL = siempre)
#' @param severidad     "error" | "advertencia" | "info" (default "error")
#' @param categoria_ux  override de la categoría UX (por default deriva de tipo_regla)
#' @param objetivo      texto humano — qué valida la regla en lenguaje natural
#' @param tabla         tabla donde evaluar ("principal" default, o nombre de repeat)
#' @param seccion       sección del XLSForm (NULL si no aplica)
#' @param repeat_context nombre de la sección repeat donde vive la regla (NULL si main)
#' @param residual_codes códigos que el evaluador trata distinto (98/99/96/90/...)
#' @param remediation_default acción sugerida en el decision-maker
#' @param preview_chart tipo de gráfico para preview UX (opcional)
#' @param batch_editable si aplica a todos los casos juntos o caso-por-caso
#' @param id            opcional — si se omite, deriva determinísticamente
#' @export
make_rule <- function(nombre,
                      tipo_regla,
                      fuente,
                      predicate,
                      gate = NULL,
                      severidad = "error",
                      categoria_ux = NULL,
                      objetivo = NULL,
                      tabla = "principal",
                      seccion = NULL,
                      repeat_context = NULL,
                      residual_codes = character(0),
                      remediation_default = NULL,
                      preview_chart = NULL,
                      batch_editable = TRUE,
                      id = NULL) {
  # --- Validaciones de enums ---
  .assert_in(tipo_regla,   .RULE_TIPOS,        "tipo_regla")
  .assert_in(fuente,       .RULE_FUENTES,      "fuente")
  .assert_in(severidad,    .RULE_SEVERIDADES,  "severidad")
  if (is.null(categoria_ux)) {
    categoria_ux <- .default_categoria_ux(tipo_regla)
  }
  .assert_in(categoria_ux, .RULE_CATEGORIAS_UX, "categoria_ux")
  if (!is.null(remediation_default)) {
    .assert_in(remediation_default, .RULE_REMEDIATION_DEFAULTS, "remediation_default")
  } else {
    remediation_default <- .default_remediation(tipo_regla)
  }
  if (!is.null(preview_chart)) {
    .assert_in(preview_chart, .RULE_PREVIEW_CHARTS, "preview_chart")
  } else {
    preview_chart <- .default_preview_chart(tipo_regla)
  }

  # --- Validaciones estructurales ---
  if (!is.character(nombre) || length(nombre) != 1L || !nzchar(nombre)) {
    stop("make_rule(): 'nombre' debe ser string no vacío.")
  }
  if (!is_ast(predicate)) {
    stop("make_rule(): 'predicate' debe ser un AST (vd_ast).")
  }
  if (!is.null(gate) && !is_ast(gate)) {
    stop("make_rule(): 'gate' debe ser AST o NULL.")
  }

  # --- Normalizaciones ---
  predicate <- ast_normalize(predicate)
  if (!is.null(gate)) gate <- ast_normalize(gate)

  v_struct <- ast_is_valid(predicate)
  if (!v_struct$ok) {
    stop(sprintf("make_rule(): predicate AST inválido:\n  %s",
                 paste(v_struct$errors, collapse = "\n  ")))
  }
  if (!is.null(gate)) {
    v_gate <- ast_is_valid(gate)
    if (!v_gate$ok) {
      stop(sprintf("make_rule(): gate AST inválido:\n  %s",
                   paste(v_gate$errors, collapse = "\n  ")))
    }
  }

  # --- Derivaciones ---
  variables <- unique(c(ast_variables(predicate),
                        if (!is.null(gate)) ast_variables(gate) else character()))
  predicate_hash <- ast_hash(predicate)
  gate_hash <- if (is.null(gate)) "" else ast_hash(gate)

  if (is.null(id) || !nzchar(id)) {
    id <- .derive_rule_id(tipo_regla, variables, predicate_hash, gate_hash, fuente)
  }

  # Objetivo: si es NULL, generar uno razonable por defecto.
  if (is.null(objetivo) || !nzchar(objetivo)) {
    objetivo <- .default_objetivo(tipo_regla, nombre, variables)
  }

  rule <- list(
    id = id,
    nombre = nombre,
    fuente = fuente,
    tipo_regla = tipo_regla,
    categoria_ux = categoria_ux,
    severidad = severidad,
    predicate = predicate,
    gate = gate,
    variables = variables,
    # primary_var: la variable TARGET de la validación (la que se checa,
    # no las que aparecen en el gate). Los constructores la setean
    # explícitamente; si no, fallback al primer variable del predicate.
    primary_var = if (length(variables)) variables[1] else NA_character_,
    predicate_hash = predicate_hash,
    gate_hash = gate_hash,
    tabla = tabla %||% "principal",
    seccion = seccion,
    repeat_context = repeat_context,
    residual_codes = as.character(residual_codes),
    objetivo = objetivo,
    remediation_default = remediation_default,
    preview_chart = preview_chart,
    batch_editable = isTRUE(batch_editable),
    # flag name R-compatible para Procesamiento
    flag_name = .derive_flag_name(id)
  )
  .rule_apply_metadata(rule)
}

#' @export
is_rule <- function(x) inherits(x, "vd_rule")

#' @export
print.vd_rule <- function(x, ...) {
  cat(sprintf("<vd_rule %s>\n", x$id))
  cat(sprintf("  nombre:    %s\n", x$nombre))
  cat(sprintf("  tipo:      %s (%s) · severidad: %s\n",
              x$tipo_regla, x$categoria_ux, x$severidad))
  cat(sprintf("  fuente:    %s · tabla: %s%s\n",
              x$fuente, x$tabla,
              if (!is.null(x$repeat_context)) paste0(" · repeat: ", x$repeat_context) else ""))
  cat(sprintf("  variables: %s\n", paste(x$variables, collapse = ", ")))
  cat(sprintf("  objetivo:  %s\n", x$objetivo))
  cat(sprintf("  predicate:\n    %s\n",
              gsub("\n", "\n    ", ast_to_string(x$predicate))))
  if (!is.null(x$gate)) {
    cat(sprintf("  gate:\n    %s\n",
                gsub("\n", "\n    ", ast_to_string(x$gate))))
  }
  invisible(x)
}

# -----------------------------------------------------------------------------
# Constructores específicos — la API pública preferida
# -----------------------------------------------------------------------------
#' Regla: variable debe responderse. Falla si está vacía.
#' @export
rule_required <- function(var,
                          gate = NULL,
                          nombre = NULL,
                          objetivo = NULL,
                          fuente = "instrumento",
                          severidad = "error",
                          seccion = NULL,
                          tabla = "principal",
                          repeat_context = NULL) {
  predicate <- ast_is_missing(var)
  if (is.null(nombre)) nombre <- sprintf("«%s» debe responderse", var)
  r <- make_rule(
    nombre = nombre,
    tipo_regla = "required",
    fuente = fuente,
    predicate = predicate,
    gate = gate,
    severidad = severidad,
    objetivo = objetivo,
    seccion = seccion,
    tabla = tabla,
    repeat_context = repeat_context
  )
  .rule_apply_metadata(
    r,
    primary_var = var,
    variable_roles = list(
      target = var,
      drivers = if (!is.null(gate)) ast_variables(gate) else character(0),
      compare = character(0),
      gate = if (!is.null(gate)) ast_variables(gate) else character(0)
    ),
    presentation = list(subtipo_semantico = "req")
  )
}

#' Regla de salto: si `gate` es TRUE, variable debe responderse;
#' si FALSE, debe estar vacía. `direction` controla qué lado evaluar.
#' @param direction "must_answer_when_true" | "must_be_empty_when_false" | "both"
#' @export
rule_skip <- function(var,
                      gate,
                      direction = "must_answer_when_true",
                      nombre = NULL,
                      objetivo = NULL,
                      fuente = "instrumento",
                      severidad = "error",
                      seccion = NULL,
                      tabla = "principal",
                      repeat_context = NULL) {
  if (!is_ast(gate)) stop("rule_skip(): gate requerido como AST.")
  if (!(direction %in% c("must_answer_when_true", "must_be_empty_when_false", "both"))) {
    stop("rule_skip(): direction inválida.")
  }
  missing_pred <- ast_is_missing(var)
  present_pred <- ast_not(missing_pred)

  if (direction == "must_answer_when_true") {
    # Violación: gate=T y variable vacía. Se modela como: gate AND missing.
    predicate <- ast_and(gate, missing_pred)
    nombre <- nombre %||% sprintf("«%s» debe responderse cuando el salto está activo", var)
  } else if (direction == "must_be_empty_when_false") {
    # Violación: gate=F y variable respondida. Modelo: NOT(gate) AND NOT(missing).
    predicate <- ast_and(ast_not(gate), present_pred)
    nombre <- nombre %||% sprintf("«%s» no debe responderse cuando el salto está inactivo", var)
  } else {
    # both: violación si (gate AND missing) OR (NOT gate AND NOT missing)
    predicate <- ast_or(
      ast_and(gate, missing_pred),
      ast_and(ast_not(gate), present_pred)
    )
    nombre <- nombre %||% sprintf("«%s» debe responderse sí/no según corresponda al salto", var)
  }

  r <- make_rule(
    nombre = nombre,
    tipo_regla = "skip",
    fuente = fuente,
    predicate = predicate,
    gate = NULL,  # el gate ya está incorporado en el predicate
    severidad = severidad,
    objetivo = objetivo,
    seccion = seccion,
    tabla = tabla,
    repeat_context = repeat_context
  )
  .rule_apply_metadata(
    r,
    primary_var = var,
    variable_roles = list(
      target = var,
      drivers = ast_variables(gate),
      compare = character(0),
      gate = ast_variables(gate)
    ),
    presentation = list(
      subtipo_semantico = switch(direction,
        "must_answer_when_true" = "debe",
        "must_be_empty_when_false" = "nodebe",
        "both" = "ambos",
        "regla"
      )
    )
  )
}

#' @export
rule_range <- function(var,
                       min = NULL,
                       max = NULL,
                       inclusive = TRUE,
                       type = c("numeric", "date"),
                       gate = NULL,
                       nombre = NULL,
                       objetivo = NULL,
                       fuente = "instrumento",
                       severidad = "error",
                       seccion = NULL,
                       tabla = "principal",
                       repeat_context = NULL) {
  type <- match.arg(type)
  predicate <- if (type == "numeric") {
    ast_range_numeric(var, min = min, max = max, inclusive = inclusive)
  } else {
    ast_range_date(var, min = min, max = max, inclusive = inclusive)
  }
  if (is.null(nombre)) {
    nombre <- sprintf("«%s» dentro de rango [%s, %s]",
                      var, min %||% "-", max %||% "-")
  }
  r <- make_rule(
    nombre = nombre,
    tipo_regla = "range",
    fuente = fuente,
    predicate = predicate,
    gate = gate,
    severidad = severidad,
    objetivo = objetivo,
    seccion = seccion,
    tabla = tabla,
    repeat_context = repeat_context
  )
  .rule_apply_metadata(
    r,
    primary_var = var,
    variable_roles = list(
      target = var,
      drivers = if (!is.null(gate)) ast_variables(gate) else character(0),
      compare = character(0),
      gate = if (!is.null(gate)) ast_variables(gate) else character(0)
    ),
    presentation = list(
      subtipo_semantico = if (identical(type, "date")) "ventana_fecha" else "rango"
    )
  )
}

#' @export
rule_catalog <- function(var,
                         values,
                         gate = NULL,
                         nombre = NULL,
                         objetivo = NULL,
                         fuente = "instrumento",
                         severidad = "error",
                         seccion = NULL,
                         tabla = "principal",
                         repeat_context = NULL) {
  predicate <- ast_not_in_set(var, values)
  if (is.null(nombre)) {
    nombre <- sprintf("«%s» dentro del catálogo permitido (%d valores)",
                      var, length(values))
  }
  r <- make_rule(
    nombre = nombre,
    tipo_regla = "catalog",
    fuente = fuente,
    predicate = predicate,
    gate = gate,
    severidad = severidad,
    objetivo = objetivo,
    seccion = seccion,
    tabla = tabla,
    repeat_context = repeat_context
  )
  .rule_apply_metadata(
    r,
    primary_var = var,
    variable_roles = list(
      target = var,
      drivers = if (!is.null(gate)) ast_variables(gate) else character(0),
      compare = character(0),
      gate = if (!is.null(gate)) ast_variables(gate) else character(0)
    ),
    presentation = list(subtipo_semantico = "catalogo")
  )
}

#' @export
rule_outlier <- function(var,
                         method = c("iqr", "zscore"),
                         k = NULL,
                         gate = NULL,
                         nombre = NULL,
                         objetivo = NULL,
                         fuente = "custom",
                         severidad = "advertencia",
                         seccion = NULL,
                         tabla = "principal",
                         repeat_context = NULL) {
  method <- match.arg(method)
  if (is.null(k)) k <- if (method == "iqr") 1.5 else 3
  predicate <- if (method == "iqr") ast_outlier_iqr(var, k) else ast_outlier_zscore(var, k)
  if (is.null(nombre)) {
    nombre <- sprintf("«%s» outlier (%s, k=%s)", var, method, k)
  }
  r <- make_rule(
    nombre = nombre,
    tipo_regla = "outlier",
    fuente = fuente,
    predicate = predicate,
    gate = gate,
    severidad = severidad,
    objetivo = objetivo,
    seccion = seccion,
    tabla = tabla,
    repeat_context = repeat_context
  )
  .rule_apply_metadata(
    r,
    primary_var = var,
    variable_roles = list(
      target = var,
      drivers = if (!is.null(gate)) ast_variables(gate) else character(0),
      compare = character(0),
      gate = if (!is.null(gate)) ast_variables(gate) else character(0)
    ),
    presentation = list(subtipo_semantico = method)
  )
}

#' @export
rule_duplicate <- function(vars,
                           gate = NULL,
                           nombre = NULL,
                           objetivo = NULL,
                           fuente = "custom",
                           severidad = "advertencia",
                           seccion = NULL,
                           tabla = "principal") {
  predicate <- ast_duplicate_tuple(vars)
  if (is.null(nombre)) {
    nombre <- sprintf("Duplicados en (%s)", paste(vars, collapse = ", "))
  }
  r <- make_rule(
    nombre = nombre,
    tipo_regla = "duplicate",
    fuente = fuente,
    predicate = predicate,
    gate = gate,
    severidad = severidad,
    objetivo = objetivo,
    seccion = seccion,
    tabla = tabla
  )
  .rule_apply_metadata(
    r,
    primary_var = vars[[1]] %||% NA_character_,
    variable_roles = list(
      target = vars[[1]] %||% NA_character_,
      compare = vars[-1],
      drivers = character(0),
      gate = if (!is.null(gate)) ast_variables(gate) else character(0)
    ),
    presentation = list(subtipo_semantico = "duplicados")
  )
}

#' Regla de coherencia: si `when` es TRUE, entonces `then_must` debe ser TRUE.
#' Violación = when=T AND then_must=F.
#' @export
rule_coherence <- function(when,
                           then_must,
                           nombre,
                           objetivo = NULL,
                           fuente = "custom",
                           severidad = "error",
                           seccion = NULL,
                           tabla = "principal",
                           repeat_context = NULL) {
  if (!is_ast(when) || !is_ast(then_must)) {
    stop("rule_coherence(): 'when' y 'then_must' deben ser AST.")
  }
  predicate <- ast_if_then(when, then_must)
  r <- make_rule(
    nombre = nombre,
    tipo_regla = "coherence",
    fuente = fuente,
    predicate = predicate,
    severidad = severidad,
    objetivo = objetivo,
    seccion = seccion,
    tabla = tabla,
    repeat_context = repeat_context
  )
  .rule_apply_metadata(
    r,
    primary_var = ast_variables(then_must)[1] %||% ast_variables(when)[1] %||% NA_character_,
    variable_roles = list(
      target = ast_variables(then_must)[1] %||% ast_variables(when)[1] %||% NA_character_,
      compare = setdiff(ast_variables(then_must), ast_variables(then_must)[1] %||% NA_character_),
      drivers = ast_variables(when),
      gate = character(0)
    ),
    presentation = list(subtipo_semantico = "if_then")
  )
}

#' @export
rule_select_multiple_cardinality <- function(var,
                                             max_count = NULL,
                                             exclusive_codes = character(0),
                                             gate = NULL,
                                             nombre = NULL,
                                             objetivo = NULL,
                                             fuente = "instrumento",
                                             severidad = "error",
                                             seccion = NULL,
                                             tabla = "principal",
                                             repeat_context = NULL) {
  parts <- list()
  if (!is.null(max_count)) {
    parts[[length(parts) + 1L]] <- ast_count_selected_cmp(var, ">", max_count)
  }
  if (length(exclusive_codes)) {
    parts[[length(parts) + 1L]] <- ast_select_multiple_exclusive(var, exclusive_codes)
  }
  if (!length(parts)) {
    stop("rule_select_multiple_cardinality(): al menos max_count o exclusive_codes.")
  }
  predicate <- if (length(parts) == 1L) parts[[1]] else do.call(ast_or, parts)
  if (is.null(nombre)) {
    bits <- c(
      if (!is.null(max_count)) sprintf("máx %d", max_count),
      if (length(exclusive_codes)) sprintf("excl=[%s]", paste(exclusive_codes, collapse = ","))
    )
    nombre <- sprintf("«%s» cardinalidad (%s)", var, paste(bits, collapse = " · "))
  }
  r <- make_rule(
    nombre = nombre,
    tipo_regla = "select_multiple_cardinality",
    fuente = fuente,
    predicate = predicate,
    gate = gate,
    severidad = severidad,
    objetivo = objetivo,
    seccion = seccion,
    tabla = tabla,
    repeat_context = repeat_context
  )
  .rule_apply_metadata(
    r,
    primary_var = var,
    variable_roles = list(
      target = var,
      compare = character(0),
      drivers = if (!is.null(gate)) ast_variables(gate) else character(0),
      gate = if (!is.null(gate)) ast_variables(gate) else character(0)
    ),
    presentation = list(subtipo_semantico = "cardinalidad")
  )
}

#' @export
rule_pattern_straightline <- function(vars,
                                      max_variance = 0,
                                      gate = NULL,
                                      nombre = NULL,
                                      objetivo = NULL,
                                      fuente = "custom",
                                      severidad = "advertencia",
                                      seccion = NULL,
                                      tabla = "principal") {
  predicate <- ast_straight_line(vars, max_variance)
  if (is.null(nombre)) {
    nombre <- sprintf("Straight-lining en (%s)", paste(vars, collapse = ", "))
  }
  r <- make_rule(
    nombre = nombre,
    tipo_regla = "pattern",
    fuente = fuente,
    predicate = predicate,
    gate = gate,
    severidad = severidad,
    objetivo = objetivo,
    seccion = seccion,
    tabla = tabla
  )
  .rule_apply_metadata(
    r,
    primary_var = vars[[1]] %||% NA_character_,
    variable_roles = list(
      target = vars[[1]] %||% NA_character_,
      compare = vars[-1],
      drivers = if (!is.null(gate)) ast_variables(gate) else character(0),
      gate = if (!is.null(gate)) ast_variables(gate) else character(0)
    ),
    presentation = list(subtipo_semantico = "straightline")
  )
}

#' Longitud de tabla repeat debe coincidir con valor esperado.
#' `expected` puede ser: número fijo, nombre de variable, o AST.
#' @export
rule_repeat_length <- function(repeat_name,
                               expected,
                               nombre = NULL,
                               objetivo = NULL,
                               fuente = "instrumento",
                               severidad = "error",
                               seccion = NULL) {
  predicate <- ast_repeat_length_matches(repeat_name, expected)
  if (is.null(nombre)) {
    nombre <- sprintf("Longitud de «%s» coincide con %s",
                      repeat_name,
                      if (is_ast(expected)) "AST" else format(expected))
  }
  r <- make_rule(
    nombre = nombre,
    tipo_regla = "repeat_length",
    fuente = fuente,
    predicate = predicate,
    severidad = severidad,
    objetivo = objetivo,
    seccion = seccion,
    tabla = repeat_name  # la regla vive en la tabla repeat
  )
  compare_vars <- if (is_ast(expected)) ast_variables(expected) else if (is.character(expected)) expected else character(0)
  .rule_apply_metadata(
    r,
    primary_var = repeat_name,
    variable_roles = list(
      target = repeat_name,
      compare = compare_vars,
      drivers = character(0),
      gate = character(0)
    ),
    presentation = list(subtipo_semantico = "count")
  )
}

#' Regla de coherencia cross-tabla: compara un valor del host con un
#' agregado (sum/count/n_distinct) de una tabla relacionada (repeat).
#'
#' Ejemplo clásico: "`total_ingresos` del hogar = suma de `ingreso` por
#' miembro en la tabla de miembros del hogar".
#'
#' @export
rule_aggregate_check <- function(host_var,
                                 op = "==",
                                 source_table,
                                 source_var,
                                 agg_op = c("sum", "count", "n_distinct"),
                                 parent_key_local = "_uuid",
                                 parent_key_remote = "_parent_index",
                                 gate = NULL,
                                 nombre = NULL,
                                 objetivo = NULL,
                                 fuente = "custom",
                                 severidad = "error",
                                 seccion = NULL,
                                 tabla = "principal") {
  agg_op <- match.arg(agg_op)
  predicate <- ast_aggregate_cmp(
    host_var = host_var, op = op,
    source_table = source_table, source_var = source_var,
    agg_op = agg_op,
    parent_key_local = parent_key_local,
    parent_key_remote = parent_key_remote
  )
  if (is.null(nombre)) {
    nombre <- sprintf("«%s» %s %s(«%s») en %s",
                      host_var, op, agg_op, source_var, source_table)
  }
  r <- make_rule(
    nombre = nombre,
    tipo_regla = "coherence",  # es una coherencia, pero multi-tabla
    fuente = fuente,
    predicate = predicate,
    gate = gate,
    severidad = severidad,
    categoria_ux = "coherencia",
    objetivo = objetivo,
    seccion = seccion,
    tabla = tabla
  )
  .rule_apply_metadata(
    r,
    primary_var = host_var,
    variable_roles = list(
      target = host_var,
      compare = c(source_var, parent_key_local, parent_key_remote),
      drivers = if (!is.null(gate)) ast_variables(gate) else character(0),
      gate = if (!is.null(gate)) ast_variables(gate) else character(0)
    ),
    presentation = list(subtipo_semantico = agg_op)
  )
}

#' Escape hatch: regla que envuelve una expresión ODK cruda.
#' @export
rule_odk_raw <- function(odk_expression,
                         variables = character(0),
                         nombre,
                         objetivo = NULL,
                         fuente = "instrumento",
                         severidad = "error",
                         seccion = NULL,
                         tabla = "principal",
                         repeat_context = NULL,
                         origin = NA_character_) {
  predicate <- ast_odk_raw(odk_expression, origin = origin)
  # Agregamos hack para que ast_variables capture las refs declaradas.
  # El AST raw no parsea el expr, así que las variables no se derivan
  # automáticamente. El llamador las declara explícitamente.
  rule <- make_rule(
    nombre = nombre,
    tipo_regla = "odk_raw",
    fuente = fuente,
    predicate = predicate,
    severidad = severidad,
    categoria_ux = "experto",
    objetivo = objetivo,
    seccion = seccion,
    tabla = tabla,
    repeat_context = repeat_context
  )
  rule$variables <- unique(c(rule$variables, as.character(variables)))
  .rule_apply_metadata(
    rule,
    primary_var = as.character(variables[[1]] %||% NA_character_),
    variable_roles = list(
      target = as.character(variables[[1]] %||% NA_character_),
      compare = as.character(variables[-1] %||% character(0)),
      drivers = character(0),
      gate = character(0)
    ),
    presentation = list(subtipo_semantico = "raw")
  )
}

# -----------------------------------------------------------------------------
# Validador de Rule contra un instrumento cargado
# -----------------------------------------------------------------------------
#' Valida una Rule contra el contexto del instrumento.
#'
#' Chequeos:
#'   - Todas las variables referenciadas existen en el instrumento.
#'   - Tipos coherentes (range_numeric sobre variable numeric, etc.).
#'   - `repeat_context` declarado es un repeat real.
#'   - residual_codes son strings válidos.
#'
#' @param instrumento lista con `survey` (data.frame con `name`, `type`, ...)
#'   y opcionalmente `meta$repeats` (character vector de nombres de repeat).
#' @return list(ok, errors, warnings)
#' @export
validate_rule <- function(rule, instrumento = NULL) {
  errors <- character()
  warnings <- character()
  if (!is_rule(rule)) {
    return(list(ok = FALSE, errors = "no es vd_rule", warnings = character()))
  }

  if (is.null(instrumento) || is.null(instrumento$survey)) {
    # Sin instrumento, solo podemos validar estructura del AST.
    v <- ast_is_valid(rule$predicate)
    if (!v$ok) errors <- c(errors, v$errors)
    return(list(ok = !length(errors), errors = errors, warnings = warnings))
  }

  survey <- instrumento$survey
  existing_vars <- as.character(survey$name)

  # 1. Variables referenciadas existen.
  missing_vars <- setdiff(rule$variables, existing_vars)
  if (length(missing_vars)) {
    errors <- c(errors, sprintf("variables no existen en instrumento: %s",
                                 paste(missing_vars, collapse = ", ")))
  }

  # 2. Repeat context declarado existe.
  if (!is.null(rule$repeat_context)) {
    repeats <- instrumento$meta$repeats %||%
      as.character(survey$name[grepl("^begin_repeat", as.character(survey$type))])
    if (!(rule$repeat_context %in% repeats)) {
      errors <- c(errors, sprintf("repeat_context '%s' no es repeat del instrumento.",
                                   rule$repeat_context))
    }
  }

  # 3. Tipos coherentes (heurística liviana).
  type_issues <- .check_type_coherence(rule$predicate, survey)
  if (length(type_issues)) warnings <- c(warnings, type_issues)

  # 4. AST interno bien formado.
  v <- ast_is_valid(rule$predicate)
  if (!v$ok) errors <- c(errors, v$errors)

  list(ok = !length(errors), errors = errors, warnings = warnings)
}

.check_type_coherence <- function(predicate, survey) {
  issues <- character()
  # Lookup type_base por nombre de variable (heurístico sobre columna `type` del XLSForm)
  type_of <- function(v) {
    idx <- which(as.character(survey$name) == v)[1]
    if (is.na(idx)) return(NA_character_)
    t <- as.character(survey$type[idx])
    strsplit(t, "\\s+")[[1]][1]  # first token: "integer", "select_one xxx", etc.
  }
  ast_walk(predicate, function(node, path) {
    op <- ast_op(node)
    if (op %in% c("range_numeric", "outlier_iqr", "outlier_zscore")) {
      v <- node$var
      t <- type_of(v)
      if (!is.na(t) && !(t %in% c("integer", "decimal", "calculate"))) {
        issues <<- c(issues, sprintf("%s sobre variable '%s' de tipo '%s' (esperado numérico)",
                                       op, v, t))
      }
    }
    if (op %in% c("range_date", "collection_date_cmp", "collection_date_offset_cmp")) {
      v <- node$var
      t <- type_of(v)
      if (!is.na(t) && !(t %in% c("date", "datetime"))) {
        issues <<- c(issues, sprintf("%s sobre '%s' de tipo '%s' (esperado date)",
                                       op, v, t))
      }
    }
    if (op %in% c("selected", "any_selected", "none_selected",
                   "count_selected_cmp", "select_multiple_exclusive")) {
      v <- node$var
      t <- type_of(v)
      if (!is.na(t) && !grepl("^select_multiple", t)) {
        issues <<- c(issues, sprintf("%s sobre '%s' (esperado select_multiple, es '%s')",
                                       op, v, t))
      }
    }
  })
  issues
}

# -----------------------------------------------------------------------------
# Compilación Rule → fila del plan de limpieza
# -----------------------------------------------------------------------------
#' Compila una Rule a una fila tibble con el shape del plan de limpieza
#' tradicional (14 columnas). El `Procesamiento` se genera desde el AST.
#'
#' Incluye además columna `_ast_predicate` (serializado a JSON) para que el
#' evaluador AST directo (cuando esté) pueda bypassear el parse del string.
#' @export
compile_rule <- function(rule) {
  if (!is_rule(rule)) stop("compile_rule(): x debe ser vd_rule.")
  rule <- .rule_apply_metadata(rule)

  # Incorporar gate al predicate para el compilado final: si hay gate,
  # la inconsistencia es (gate AND predicate).
  effective_pred <- if (is.null(rule$gate)) rule$predicate
                    else ast_normalize(ast_and(rule$gate, rule$predicate))

  rhs <- ast_to_r(effective_pred)
  procesamiento <- sprintf("%s <- %s", rule$flag_name, rhs)

  vars_slots <- .rule_variable_slots(rule)
  vars_pad <- vars_slots$vars
  labs_pad <- vars_slots$labels

  tibble::tibble(
    ID = rule$id,
    Tabla = rule$tabla,
    `Sección` = rule$seccion %||% NA_character_,
    `Categoría` = .legacy_plan_categoria(rule$tipo_regla),
    `Tipo` = rule$tipo_regla,
    `Nombre de regla` = rule$presentation$nombre_humano %||% rule$nombre,
    `Nombre técnico` = rule$presentation$nombre_tecnico %||% rule$flag_name,
    Objetivo = rule$objetivo,
    `Variable 1` = vars_pad[1],
    `Variable 1 - Etiqueta` = labs_pad[1],
    `Variable 2` = vars_pad[2],
    `Variable 2 - Etiqueta` = labs_pad[2],
    `Variable 3` = vars_pad[3],
    `Variable 3 - Etiqueta` = labs_pad[3],
    Procesamiento = procesamiento,
    # Metadata extendida (útil para la UI, ignorada por el evaluador legacy).
    `_rule_hash` = rule$predicate_hash,
    `_severidad` = rule$severidad,
    `_fuente` = rule$fuente,
    `_tipo_regla` = rule$tipo_regla,
    `_categoria_ux` = rule$categoria_ux,
    `_nombre_humano` = rule$nombre,
    `_nombre_tecnico` = rule$presentation$nombre_tecnico %||% rule$flag_name,
    `_primary_var` = rule$primary_var %||% NA_character_,
    `_remediation` = rule$remediation_default,
    `_repeat_context` = rule$repeat_context %||% NA_character_,
    `_ast_predicate` = as.character(ast_to_json(rule$predicate)),
    `_ast_gate` = if (is.null(rule$gate)) NA_character_ else as.character(ast_to_json(rule$gate)),
    `_variable_roles_json` = as.character(jsonlite::toJSON(rule$variable_roles %||% list(), auto_unbox = TRUE, null = "null")),
    `_presentation_json` = as.character(jsonlite::toJSON(rule$presentation %||% list(), auto_unbox = TRUE, null = "null")),
    `_ast_rule_json` = as.character(rule_to_json(rule))
  )
}

# -----------------------------------------------------------------------------
# Helpers internos
# -----------------------------------------------------------------------------
.assert_in <- function(x, valid, arg_name) {
  if (is.null(x) || length(x) != 1L || !(x %in% valid)) {
    stop(sprintf("make_rule(): %s debe ser uno de {%s}, recibido: %s",
                 arg_name, paste(valid, collapse = ", "), format(x)))
  }
}

.default_categoria_ux <- function(tipo_regla) {
  switch(tipo_regla,
    "required"                    = "completitud",
    "skip"                        = "saltos",
    "constraint"                  = "consistencia",
    "range"                       = "rangos",
    "catalog"                     = "catálogo",
    "outlier"                     = "outliers",
    "duplicate"                   = "duplicados",
    "coherence"                   = "coherencia",
    "select_multiple_cardinality" = "cardinalidad",
    "pattern"                     = "patrones",
    "calculate_check"             = "cálculos",
    "repeat_length"               = "estructura",
    "odk_raw"                     = "experto",
    "consistencia"
  )
}

.default_remediation <- function(tipo_regla) {
  switch(tipo_regla,
    "required"                    = "impute_value",
    "skip"                        = "exclude_cases",
    "constraint"                  = "replace_value",
    "range"                       = "replace_value",
    "catalog"                     = "replace_value",
    "outlier"                     = "exclude_cases",
    "duplicate"                   = "exclude_cases",
    "coherence"                   = "replace_value",
    "select_multiple_cardinality" = "normalize_value",
    "pattern"                     = "exclude_cases",
    "calculate_check"             = "ignore",
    "repeat_length"               = "exclude_cases",
    "odk_raw"                     = "ignore",
    "ignore"
  )
}

.default_preview_chart <- function(tipo_regla) {
  switch(tipo_regla,
    "outlier" = "boxplot",
    "range"   = "histogram",
    "catalog" = "bar",
    "pattern" = "boxplot",
    NULL
  )
}

.default_objetivo <- function(tipo_regla, nombre, variables) {
  # Defaults en español — pueden sobrescribirse en make_rule.
  vs <- paste(sprintf("«%s»", variables), collapse = ", ")
  switch(tipo_regla,
    "required"                    = sprintf("%s debe responderse.", vs),
    "skip"                        = sprintf("El salto de %s debe respetarse.", vs),
    "constraint"                  = sprintf("%s debe cumplir la consistencia definida.", vs),
    "range"                       = sprintf("%s debe estar dentro del rango permitido.", vs),
    "catalog"                     = sprintf("%s debe estar dentro del catálogo permitido.", vs),
    "outlier"                     = sprintf("%s no debería ser un outlier estadístico.", vs),
    "duplicate"                   = sprintf("La combinación (%s) no debería repetirse.", vs),
    "coherence"                   = sprintf("%s debe mantener coherencia entre sí.", vs),
    "select_multiple_cardinality" = sprintf("%s respeta cardinalidad y exclusividad.", vs),
    "pattern"                     = sprintf("El patrón de respuesta en (%s) no debe ser sospechoso.", vs),
    "calculate_check"             = sprintf("%s calculada debe tener valor esperado.", vs),
    "repeat_length"               = sprintf("La longitud de la tabla repeat debe coincidir con lo esperado."),
    "odk_raw"                     = sprintf("Regla en modo experto: %s", nombre),
    nombre
  )
}

.legacy_plan_categoria <- function(tipo_regla) {
  switch(as.character(tipo_regla),
    "required" = "Preguntas de control",
    "skip" = "Saltos de preguntas",
    "constraint" = "Consistencia",
    "range" = "Consistencia",
    "catalog" = "Consistencia",
    "outlier" = "Valores atípicos",
    "duplicate" = "Consistencia",
    "coherence" = "Consistencia",
    "select_multiple_cardinality" = "Consistencia",
    "pattern" = "Valores atípicos",
    "calculate_check" = "Valores calculados",
    "repeat_length" = "Registros repetidos",
    "odk_raw" = "Consistencia",
    "Consistencia"
  )
}

.derive_rule_id <- function(tipo_regla, variables, predicate_hash, gate_hash, fuente) {
  # Prefijo por fuente, luego hash corto del contenido.
  prefix <- if (fuente == "instrumento") "VR" else "CR"  # validation / custom rule
  content <- paste(tipo_regla,
                   paste(sort(unique(variables)), collapse = ","),
                   predicate_hash, gate_hash, sep = "|")
  h <- digest::digest(content, algo = "xxhash64", serialize = FALSE)
  short <- substr(h, 1, 8)
  sprintf("%s_%s_%s", prefix, tolower(tipo_regla), short)
}

.derive_flag_name <- function(id) {
  # Convierte ID a identificador R válido (minúsculas, sin puntos).
  out <- gsub("[^A-Za-z0-9_]+", "_", id)
  out <- tolower(out)
  if (!grepl("^[a-z_]", out)) out <- paste0("r_", out)
  out
}

.sanitize_rule_token <- function(x) {
  out <- tolower(trimws(as.character(x %||% "")))
  out <- gsub("[^a-z0-9_]+", "_", out)
  out <- gsub("_+", "_", out)
  out <- gsub("^_|_$", "", out)
  if (!nzchar(out)) "regla" else out
}

.normalize_chr_vec <- function(x) {
  x <- as.character(x %||% character(0))
  x <- x[!is.na(x) & nzchar(trimws(x))]
  unique(x)
}

.normalize_lookup_list <- function(x) {
  if (is.null(x)) return(list())
  if (is.list(x)) {
    out <- lapply(x, function(v) as.character(v %||% NA_character_)[1])
    out <- out[!vapply(out, function(v) is.na(v) || !nzchar(v), logical(1))]
    return(out)
  }
  x <- as.character(x)
  nm <- names(x)
  if (is.null(nm)) return(list())
  keep <- !is.na(x) & nzchar(x)
  x <- x[keep]
  as.list(stats::setNames(x, nm[keep]))
}

.short_rule_hash <- function(rule) {
  sub("^.*_", "", as.character(rule$id %||% "rule"))
}

.rule_default_roles <- function(rule) {
  target <- as.character(rule$primary_var %||% NA_character_)
  if (is.na(target) || !nzchar(target)) {
    pred_vars <- ast_variables(rule$predicate)
    target <- pred_vars[1] %||% rule$variables[1] %||% NA_character_
  }
  pred_vars <- ast_variables(rule$predicate)
  gate_vars <- if (!is.null(rule$gate)) ast_variables(rule$gate) else character(0)
  compare <- setdiff(pred_vars, target)
  drivers <- unique(c(compare, gate_vars))
  list(
    target = as.character(target %||% NA_character_),
    drivers = .normalize_chr_vec(drivers),
    compare = .normalize_chr_vec(compare),
    gate = .normalize_chr_vec(gate_vars),
    all = .normalize_chr_vec(c(target, drivers, compare, gate_vars, rule$variables)),
    labels = .normalize_lookup_list(rule$variable_roles$labels %||% list()),
    tables = .normalize_lookup_list(rule$variable_roles$tables %||% list())
  )
}

.rule_merge_roles <- function(base, override = NULL) {
  if (is.null(override)) return(base)
  out <- base
  if (!is.null(override$target)) out$target <- as.character(override$target %||% NA_character_)
  if (!is.null(override$drivers)) out$drivers <- .normalize_chr_vec(override$drivers)
  if (!is.null(override$compare)) out$compare <- .normalize_chr_vec(override$compare)
  if (!is.null(override$gate)) out$gate <- .normalize_chr_vec(override$gate)
  if (!is.null(override$labels)) out$labels <- utils::modifyList(out$labels, .normalize_lookup_list(override$labels))
  if (!is.null(override$tables)) out$tables <- utils::modifyList(out$tables, .normalize_lookup_list(override$tables))
  if (!is.null(override$all)) out$all <- .normalize_chr_vec(override$all)
  out$all <- .normalize_chr_vec(c(out$target, out$drivers, out$compare, out$gate, out$all))
  out
}

.rule_default_presentation <- function(rule) {
  list(
    nombre_humano = as.character(rule$nombre %||% rule$id),
    nombre_tecnico = as.character(rule$flag_name %||% NA_character_),
    objetivo = as.character(rule$objetivo %||% .default_objetivo(rule$tipo_regla, rule$nombre, rule$variables)),
    detalle_condicion = as.character(NA_character_),
    gate_humano = as.character(NA_character_),
    subtipo_semantico = as.character(NA_character_)
  )
}

.rule_merge_presentation <- function(base, override = NULL) {
  if (is.null(override)) return(base)
  out <- base
  for (nm in names(base)) {
    if (!is.null(override[[nm]]) && length(override[[nm]]) > 0L) {
      out[[nm]] <- as.character(override[[nm]][1])
    }
  }
  out
}

.derive_rule_slug <- function(rule) {
  target <- .sanitize_rule_token(rule$primary_var %||% rule$variable_roles$target %||% "regla")
  subtype <- .sanitize_rule_token(rule$presentation$subtipo_semantico %||% "")
  prefix <- switch(as.character(rule$tipo_regla),
    "required" = "req",
    "skip" = "salto",
    "constraint" = "cons",
    "range" = "cons",
    "catalog" = "cons",
    "outlier" = "out",
    "duplicate" = "dup",
    "coherence" = "coh",
    "select_multiple_cardinality" = "cons",
    "pattern" = "pat",
    "calculate_check" = "calc",
    "repeat_length" = "rep",
    "odk_raw" = "exp",
    .sanitize_rule_token(rule$tipo_regla)
  )
  base <- switch(as.character(rule$tipo_regla),
    "required" = paste0(prefix, "_", target, "_req"),
    "skip" = paste0(prefix, "_", target, "_", if (nzchar(subtype)) subtype else "regla"),
    "constraint" = paste0(prefix, "_", target, "_", if (nzchar(subtype)) subtype else "form"),
    "range" = paste0(prefix, "_", target, "_", if (nzchar(subtype)) subtype else "rango"),
    "catalog" = paste0(prefix, "_", target, "_", if (nzchar(subtype)) subtype else "catalogo"),
    "calculate_check" = paste0(prefix, "_", target, "_", if (nzchar(subtype)) subtype else "eq"),
    "repeat_length" = paste0(prefix, "_", target, "_", if (nzchar(subtype)) subtype else "count"),
    paste0(prefix, "_", target, if (nzchar(subtype)) paste0("_", subtype) else "")
  )
  needs_hash <- as.character(rule$tipo_regla) %in% c(
    "constraint", "range", "catalog", "outlier", "duplicate",
    "coherence", "select_multiple_cardinality", "pattern",
    "calculate_check", "odk_raw"
  )
  if (needs_hash) base <- paste0(base, "_", .short_rule_hash(rule))
  .sanitize_rule_token(base)
}

.rule_apply_metadata <- function(rule,
                                 primary_var = NULL,
                                 variable_roles = NULL,
                                 presentation = NULL) {
  if (is.null(rule)) return(rule)
  if (!is.null(primary_var) && !is.na(primary_var) && nzchar(primary_var)) {
    rule$primary_var <- as.character(primary_var)
  } else if (is.null(rule$primary_var) || is.na(rule$primary_var) || !nzchar(rule$primary_var)) {
    rule$primary_var <- ast_variables(rule$predicate)[1] %||% rule$variables[1] %||% NA_character_
  }

  roles <- .rule_merge_roles(.rule_default_roles(rule), variable_roles)
  if (!is.null(rule$primary_var) && !is.na(rule$primary_var) && nzchar(rule$primary_var)) {
    roles$target <- as.character(rule$primary_var)
  }
  roles$all <- .normalize_chr_vec(c(roles$target, roles$drivers, roles$compare, roles$gate, roles$all, rule$variables))
  rule$variables <- roles$all
  rule$variable_roles <- roles

  pres <- .rule_merge_presentation(.rule_default_presentation(rule), presentation)
  force_regen_slug <- !is.null(presentation) &&
    is.null(presentation$nombre_tecnico) &&
    (!is.null(presentation$subtipo_semantico) || !is.null(primary_var) || !is.null(variable_roles))
  if (isTRUE(force_regen_slug) ||
      is.null(pres$nombre_tecnico) || is.na(pres$nombre_tecnico) ||
      !nzchar(trimws(pres$nombre_tecnico)) ||
      identical(.sanitize_rule_token(pres$nombre_tecnico), .derive_flag_name(rule$id))) {
    pres$nombre_tecnico <- .derive_rule_slug(utils::modifyList(rule, list(variable_roles = roles, presentation = pres)))
  } else {
    pres$nombre_tecnico <- .sanitize_rule_token(pres$nombre_tecnico)
  }
  pres$nombre_humano <- as.character(pres$nombre_humano %||% rule$nombre %||% rule$id)
  pres$objetivo <- as.character(pres$objetivo %||% rule$objetivo %||% pres$nombre_humano)
  rule$presentation <- pres
  rule$flag_name <- pres$nombre_tecnico
  rule$nombre <- pres$nombre_humano
  rule$objetivo <- pres$objetivo
  class(rule) <- c("vd_rule", "list")
  rule
}

.rule_label_for_var <- function(rule, var) {
  if (is.null(var) || is.na(var) || !nzchar(var)) return(NA_character_)
  labels <- rule$variable_roles$labels %||% list()
  if (!is.null(labels[[var]]) && nzchar(as.character(labels[[var]])[1])) {
    return(as.character(labels[[var]])[1])
  }
  as.character(var)
}

.rule_variable_slots <- function(rule) {
  rule <- .rule_apply_metadata(rule)
  roles <- rule$variable_roles %||% list()
  vars <- .normalize_chr_vec(c(
    roles$target,
    roles$drivers,
    roles$compare,
    roles$gate,
    roles$all,
    rule$variables
  ))
  vars_pad <- c(vars, rep(NA_character_, 3))[1:3]
  labs_pad <- vapply(vars_pad, function(v) {
    if (is.na(v) || !nzchar(v)) return(NA_character_)
    .rule_label_for_var(rule, v)
  }, character(1))
  list(vars = vars_pad, labels = labs_pad)
}

.human_label_for_var <- function(var, label_map = NULL) {
  if (is.null(var) || is.na(var) || !nzchar(var)) return("esta variable")
  lab <- if (!is.null(label_map) && length(label_map) && var %in% names(label_map)) {
    as.character(label_map[[var]] %||% "")
  } else ""
  if (length(lab) && !is.na(lab[1]) && nzchar(lab[1])) {
    return(sprintf("«%s»", lab[1]))
  }
  sprintf("«%s»", var)
}

.human_op <- function(op) {
  switch(as.character(op),
    "==" = "debe ser igual a",
    "!=" = "no debe ser igual a",
    ">" = "debe ser mayor que",
    ">=" = "debe ser mayor o igual que",
    "<" = "debe ser menor que",
    "<=" = "debe ser menor o igual que",
    op
  )
}

# -----------------------------------------------------------------------------
# Resolución de códigos de choice a sus labels humanos.
# `choices_map` es la lista construida por `.survey_choices_map()` —
# `choices_map[[var]]` es named list code → label si la variable es select.
# -----------------------------------------------------------------------------
.is_select_var <- function(choices_map, var) {
  if (is.null(choices_map) || !length(choices_map)) return(FALSE)
  v <- as.character(var)
  if (!length(v) || is.na(v) || !nzchar(v)) return(FALSE)
  v %in% names(choices_map) && !is.null(choices_map[[v]]) && length(choices_map[[v]]) > 0L
}

.resolve_choice_label <- function(choices_map, var, code) {
  if (!.is_select_var(choices_map, var)) return(NULL)
  cm <- choices_map[[as.character(var)]]
  key <- as.character(code)
  if (!length(key) || is.na(key) || !(key %in% names(cm))) return(NULL)
  lab <- as.character(cm[[key]])
  if (!length(lab) || is.na(lab) || !nzchar(lab)) NULL else lab
}

.ast_to_human_text <- function(x, label_map = NULL, choices_map = NULL) {
  if (is.null(x) || !is_ast(x)) return("")
  op <- ast_op(x)
  if (op == "not" && is_ast(x$arg) && ast_op(x$arg) == "range_numeric") {
    inner <- x$arg
    return(sprintf("%s debe estar entre %s y %s",
                   .human_label_for_var(inner$var, label_map),
                   inner$min %||% "-", inner$max %||% "-"))
  }
  if (op == "not" && is_ast(x$arg) && ast_op(x$arg) == "range_date") {
    inner <- x$arg
    return(sprintf("%s debe estar entre %s y %s",
                   .human_label_for_var(inner$var, label_map),
                   inner$min %||% "-", inner$max %||% "-"))
  }
  if (op == "not" && is_ast(x$arg) && ast_op(x$arg) == "is_missing") {
    return(sprintf("%s debe tener valor", .human_label_for_var(x$arg$var, label_map)))
  }
  switch(op,
    "compare_const" = {
      lbl <- .human_label_for_var(x$var, label_map)
      val_raw <- as.character(x$value)
      choice_lbl <- .resolve_choice_label(choices_map, x$var, val_raw)
      # Para variables select, "==" / "!=" se leen como "marcó" / "no marcó"
      # con el label del choice — mucho más legible que "debe ser igual a '1'".
      if (!is.null(choice_lbl) && x$op %in% c("==", "!=")) {
        verb <- if (identical(x$op, "==")) "marcó" else "no marcó"
        sprintf("%s %s «%s»", lbl, verb, choice_lbl)
      } else {
        sprintf("%s %s %s", lbl, .human_op(x$op), sQuote(val_raw))
      }
    },
    "compare_vars" = sprintf("%s %s %s",
      .human_label_for_var(x$left, label_map), .human_op(x$op), .human_label_for_var(x$right, label_map)),
    "is_missing" = sprintf("%s está vacía", .human_label_for_var(x$var, label_map)),
    "selected" = {
      lbl <- .human_label_for_var(x$var, label_map)
      choice_lbl <- .resolve_choice_label(choices_map, x$var, x$value)
      if (!is.null(choice_lbl)) {
        sprintf("%s marcó «%s»", lbl, choice_lbl)
      } else {
        sprintf("%s incluye %s", lbl, sQuote(as.character(x$value)))
      }
    },
    "any_selected" = {
      lbl <- .human_label_for_var(x$var, label_map)
      labs <- vapply(as.character(x$values), function(code) {
        cl <- .resolve_choice_label(choices_map, x$var, code)
        if (is.null(cl)) sprintf("'%s'", code) else sprintf("«%s»", cl)
      }, character(1))
      sprintf("%s marcó alguna de %s", lbl, paste(labs, collapse = ", "))
    },
    "in_set" = {
      lbl <- .human_label_for_var(x$var, label_map)
      if (.is_select_var(choices_map, x$var)) {
        labs <- vapply(as.character(x$values), function(code) {
          cl <- .resolve_choice_label(choices_map, x$var, code)
          if (is.null(cl)) sprintf("'%s'", code) else sprintf("«%s»", cl)
        }, character(1))
        sprintf("%s es alguna de %s", lbl, paste(labs, collapse = ", "))
      } else {
        sprintf("%s debe estar en {%s}", lbl, paste(as.character(x$values), collapse = ", "))
      }
    },
    "not_in_set" = {
      lbl <- .human_label_for_var(x$var, label_map)
      if (.is_select_var(choices_map, x$var)) {
        labs <- vapply(as.character(x$values), function(code) {
          cl <- .resolve_choice_label(choices_map, x$var, code)
          if (is.null(cl)) sprintf("'%s'", code) else sprintf("«%s»", cl)
        }, character(1))
        sprintf("%s no es ninguna de %s", lbl, paste(labs, collapse = ", "))
      } else {
        sprintf("%s no debe estar en {%s}", lbl, paste(as.character(x$values), collapse = ", "))
      }
    },
    "range_numeric" = sprintf("%s está fuera del rango permitido [%s, %s]",
      .human_label_for_var(x$var, label_map), x$min %||% "-", x$max %||% "-"),
    "range_date" = sprintf("%s está fuera del rango permitido [%s, %s]",
      .human_label_for_var(x$var, label_map), x$min %||% "-", x$max %||% "-"),
    "count_selected_cmp" = sprintf("la cantidad de opciones marcadas en %s %s %s",
      .human_label_for_var(x$var, label_map), .human_op(x$op), as.character(x$n)),
    "collection_date_cmp" = sprintf("%s %s hoy",
      .human_label_for_var(x$var, label_map), .human_op(x$op)),
    "collection_date_offset_cmp" = {
      ref <- if (isTRUE(as.integer(x$offset_days) < 0L)) {
        sprintf("%s días antes de hoy", abs(as.integer(x$offset_days)))
      } else {
        sprintf("%s días después de hoy", abs(as.integer(x$offset_days)))
      }
      sprintf("%s %s %s", .human_label_for_var(x$var, label_map), .human_op(x$op), ref)
    },
    "matches_regex" = sprintf("%s debe coincidir con el patrón %s",
      .human_label_for_var(x$var, label_map), sQuote(as.character(x$pattern))),
    "select_multiple_exclusive" = {
      lbl <- .human_label_for_var(x$var, label_map)
      labs <- vapply(as.character(x$exclusive_codes), function(code) {
        cl <- .resolve_choice_label(choices_map, x$var, code)
        if (is.null(cl)) sprintf("'%s'", code) else sprintf("«%s»", cl)
      }, character(1))
      sprintf("en %s, %s no puede coexistir con otras opciones",
              lbl, paste(labs, collapse = ", "))
    },
    "any_column_equals" = sprintf("alguna de {%s} debe ser igual a %s",
      paste(vapply(as.character(x$cols), .human_label_for_var, character(1), label_map = label_map), collapse = ", "),
      sQuote(as.character(x$value))),
    "and" = paste(vapply(x$args, .ast_to_human_text, character(1), label_map = label_map, choices_map = choices_map), collapse = " y "),
    "or" = paste(vapply(x$args, .ast_to_human_text, character(1), label_map = label_map, choices_map = choices_map), collapse = " o "),
    "not" = {
      inner <- .ast_to_human_text(x$arg, label_map = label_map, choices_map = choices_map)
      if (!nzchar(inner)) "no se cumple la condición" else paste("no", inner)
    },
    "odk_raw" = "debe cumplir una condición experta del formulario",
    ast_to_string(x)
  )
}
