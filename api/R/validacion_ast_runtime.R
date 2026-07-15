# =============================================================================
# Validación AST — runtime AST-first, import/export y compatibilidad
# =============================================================================

`%||%` <- function(a, b) {
  if (is.null(a)) return(b)
  if (!is.list(a) && !is.data.frame(a) && length(a) == 1L && is.na(a)) return(b)
  a
}

# -----------------------------------------------------------------------------
# Include flags v2 → AST / compat
# -----------------------------------------------------------------------------

#' Flags default del flujo v2 de validación.
#' @export
validation_default_include_flags <- function() {
  list(
    required = TRUE,
    other = TRUE,
    relevant = TRUE,
    constraint = TRUE,
    calculate = TRUE,
    choice_filter = TRUE,
    repeat_min1 = FALSE,
    tiempo_ventana = FALSE
  )
}

.validation_merge_include_flags <- function(incluir = NULL) {
  defaults <- validation_default_include_flags()
  if (is.null(incluir)) return(defaults)
  for (nm in intersect(names(defaults), names(incluir))) {
    defaults[[nm]] <- isTRUE(incluir[[nm]])
  }
  defaults
}

.validation_ast_include <- function(incluir = NULL) {
  flags <- .validation_merge_include_flags(incluir)
  out <- character(0)
  if (isTRUE(flags$required)) out <- c(out, "required")
  if (isTRUE(flags$relevant)) out <- c(out, "skip")
  if (isTRUE(flags$constraint)) out <- c(out, "constraint")
  # repeat_length, external_dataset y repeat_relational forman parte del motor
  # AST definitivo: repeat_length viene de repeat_count del instrumento;
  # external_dataset superficie las calculate con pulldata; repeat_relational es
  # la familia de coherencia relacional del repeat (RC3/RC4/RC5, + RC2 vía el
  # gate de repeat_length). No se atan a toggles legacy — siempre ON
  # (estructurales/informativos).
  c(out, "repeat_length", "external_dataset", "repeat_relational")
}

.validation_legacy_bridge_flags <- function(incluir = NULL) {
  flags <- .validation_merge_include_flags(incluir)
  list(
    required = FALSE,
    other = FALSE,
    relevant = FALSE,
    constraint = FALSE,
    calculate = isTRUE(flags$calculate),
    choice_filter = isTRUE(flags$choice_filter),
    repeat_min1 = isTRUE(flags$repeat_min1),
    tiempo_ventana = isTRUE(flags$tiempo_ventana)
  )
}

# -----------------------------------------------------------------------------
# Labels / compatibilidad con contratos legacy
# -----------------------------------------------------------------------------

.rule_legacy_categoria <- function(tipo_regla) {
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

.rule_observation_label <- function(tipo_regla) {
  switch(as.character(tipo_regla),
    "required" = "required",
    "skip" = "skip",
    "constraint" = "constraint",
    "range" = "range",
    "catalog" = "catalog",
    "outlier" = "outlier",
    "duplicate" = "duplicate",
    "coherence" = "coherence",
    "select_multiple_cardinality" = "select_multiple_cardinality",
    "pattern" = "pattern",
    "calculate_check" = "calculate",
    "repeat_length" = "repeat_length",
    "odk_raw" = "odk_raw",
    as.character(tipo_regla %||% "constraint")
  )
}

.normalize_rule_table <- function(x) {
  tbl <- as.character(x %||% "principal")
  if (!nzchar(tbl) || tbl %in% c("(principal)", "main")) "principal" else tbl
}

# -----------------------------------------------------------------------------
# Serialización AST / Rule
# -----------------------------------------------------------------------------

.ast_to_plain <- function(x) {
  if (is.null(x)) return(NULL)
  if (!is_ast(x)) {
    if (is.list(x)) return(lapply(x, .ast_to_plain))
    if (inherits(x, "Date")) return(as.character(x))
    return(x)
  }
  out <- lapply(as.list(x), .ast_to_plain)
  out$`__op__` <- ast_op(x)
  out
}

.ast_from_plain <- function(x) {
  if (is.null(x)) return(NULL)
  if (!is.list(x) || is.null(x$`__op__`)) {
    if (is.list(x)) return(lapply(x, .ast_from_plain))
    return(x)
  }
  op <- as.character(x$`__op__` %||% "")
  args <- x[setdiff(names(x), "__op__")]
  args <- lapply(args, .ast_from_plain)
  req <- tryCatch(.ast_required_args(op), error = function(e) character(0))
  if (length(req)) {
    ordered <- args[req[req %in% names(args)]]
    rest <- args[setdiff(names(args), names(ordered))]
    args <- c(ordered, rest)
  }
  do.call(ast, c(list(.op = op), args))
}

#' Serializa un AST a JSON estable.
#' @export
ast_to_json <- function(x) {
  jsonlite::toJSON(.ast_to_plain(x), auto_unbox = TRUE, null = "null")
}

#' Reconstruye un AST desde JSON.
#' @export
ast_from_json <- function(x) {
  .ast_from_plain(jsonlite::fromJSON(as.character(x), simplifyVector = FALSE))
}

.rule_to_plain <- function(rule) {
  out <- as.list(rule)
  out$predicate <- .ast_to_plain(rule$predicate)
  out$gate <- .ast_to_plain(rule$gate)
  out
}

.rule_from_plain <- function(x) {
  x$predicate <- .ast_from_plain(x$predicate)
  x$gate <- .ast_from_plain(x$gate)
  .rule_apply_metadata(x)
}

#' Serializa una regla vd_rule a JSON.
#' @export
rule_to_json <- function(rule) {
  jsonlite::toJSON(.rule_to_plain(rule), auto_unbox = TRUE, null = "null")
}

#' Reconstruye una regla vd_rule desde JSON.
#' @export
rule_from_json <- function(x) {
  .rule_from_plain(jsonlite::fromJSON(as.character(x), simplifyVector = FALSE))
}

# -----------------------------------------------------------------------------
# Compatibilidad declarativa para instrumentos fusionados
# -----------------------------------------------------------------------------

#' Construye un perfil de compatibilidad declarativo.
#' @export
make_validation_compatibility_profile <- function(optional_vars = character(),
                                                  optional_var_patterns = character(),
                                                  equivalent_vars = list()) {
  list(
    optional_vars = unique(as.character(optional_vars %||% character())),
    optional_var_patterns = unique(as.character(optional_var_patterns %||% character())),
    equivalent_vars = equivalent_vars %||% list()
  )
}

#' Perfil por base conocido.
#' Por defecto, el runtime exige paridad estricta entre instrumento y data.
#' Las excepciones declarativas se reservan para casos aprobados explícitamente.
#' @export
validation_profile_for_base <- function(base_nombre = NULL) {
  make_validation_compatibility_profile()
}

.detail_missing_vars <- function(detail) {
  txt <- sub("^Columnas ausentes:\\s*", "", as.character(detail %||% ""))
  vars <- trimws(unlist(strsplit(txt, ",")))
  vars[!is.na(vars) & nzchar(vars)]
}

.var_is_optional_by_profile <- function(var, compatibility) {
  if (is.null(compatibility)) return(FALSE)
  if (var %in% (compatibility$optional_vars %||% character())) return(TRUE)
  pats <- compatibility$optional_var_patterns %||% character()
  if (!length(pats)) return(FALSE)
  any(vapply(pats, function(p) grepl(p, var, perl = TRUE), logical(1)))
}

.is_compatible_missing_columns <- function(detail, compatibility) {
  vars <- .detail_missing_vars(detail)
  length(vars) > 0L && all(vapply(vars, .var_is_optional_by_profile,
                                  logical(1), compatibility = compatibility))
}

# -----------------------------------------------------------------------------
# Bridge: plan legacy → reglas AST
# -----------------------------------------------------------------------------

.legacy_row_to_tipo_regla <- function(row) {
  tipo <- tolower(trimws(as.character(row[["Tipo"]] %||% "")))
  catg <- trimws(as.character(row[["Categoría"]] %||% ""))

  if (identical(tipo, "calculate")) return("calculate_check")
  if (identical(tipo, "repeat_min1")) return("repeat_length")
  if (grepl("_ventana_fecha", as.character(row[["Nombre de regla"]] %||% ""), fixed = TRUE)) return("range")
  if (identical(catg, "Filtro de opciones")) return("constraint")
  if (identical(catg, "Valores calculados")) return("calculate_check")
  if (identical(catg, "Registros repetidos")) return("repeat_length")
  "constraint"
}

.legacy_row_to_categoria_ux <- function(row, tipo_regla) {
  catg <- trimws(as.character(row[["Categoría"]] %||% ""))
  if (identical(catg, "Valores calculados")) return("cálculos")
  if (identical(catg, "Registros repetidos")) return("estructura")
  if (identical(catg, "Valores atípicos")) return("outliers")
  if (identical(catg, "Saltos de preguntas")) return("saltos")
  if (identical(catg, "Preguntas de control")) return("completitud")
  if (identical(catg, "Filtro de opciones")) return("consistencia")
  if (identical(catg, "Consistencia")) return("consistencia")
  .default_categoria_ux(tipo_regla)
}

.bridge_legacy_plan_row <- function(row, fuente = "instrumento") {
  parsed <- .runtime_parse_processing(
    as.character(row[["Procesamiento"]] %||% ""),
    nombre_fallback = as.character(row[["Nombre de regla"]] %||% NA_character_)
  )
  if (is.null(parsed)) return(NULL)

  tipo_regla <- .legacy_row_to_tipo_regla(row)
  categoria_ux <- .legacy_row_to_categoria_ux(row, tipo_regla)
  tabla <- .normalize_rule_table(row[["Tabla"]] %||% "principal")
  repeat_context <- as.character(row[["_repeat_context"]] %||% if (!identical(tabla, "principal")) tabla else NA_character_)
  nombre <- as.character(row[["_nombre_humano"]] %||% row[["Objetivo"]] %||% parsed$flag)
  objetivo <- as.character(row[["Objetivo"]] %||% nombre)
  raw_origin <- if (grepl("\\bpulldata\\s*\\(", parsed$rhs, ignore.case = TRUE, perl = TRUE)) {
    "pulldata"
  } else {
    "legacy_r_expr"
  }
  predicate <- ast_odk_raw(parsed$rhs, origin = raw_origin)

  rule <- make_rule(
    nombre = nombre,
    tipo_regla = tipo_regla,
    fuente = fuente,
    predicate = predicate,
    gate = NULL,
    severidad = as.character(row[["_severidad"]] %||% "error"),
    categoria_ux = categoria_ux,
    objetivo = objetivo,
    tabla = tabla,
    seccion = as.character(row[["Sección"]] %||% NA_character_),
    repeat_context = if (!is.na(repeat_context) && nzchar(repeat_context)) repeat_context else NULL
  )

  if (!is.na(row[["ID"]] %||% NA_character_) && nzchar(as.character(row[["ID"]]))) {
    rule$id <- as.character(row[["ID"]])
  }
  rule$flag_name <- as.character(parsed$flag %||% rule$flag_name)

  vars <- c(
    as.character(row[["Variable 1"]] %||% NA_character_),
    as.character(row[["Variable 2"]] %||% NA_character_),
    as.character(row[["Variable 3"]] %||% NA_character_)
  )
  vars <- vars[!is.na(vars) & nzchar(vars)]
  if (length(vars)) {
    rule$variables <- vars
    rule <- .rule_apply_metadata(
      rule,
      primary_var = vars[1],
      variable_roles = list(
        target = vars[1],
        compare = vars[-1],
        labels = as.list(stats::setNames(
          as.character(c(
            row[["Variable 1 - Etiqueta"]] %||% NA_character_,
            row[["Variable 2 - Etiqueta"]] %||% NA_character_,
            row[["Variable 3 - Etiqueta"]] %||% NA_character_
          ))[seq_along(vars)],
          vars
        ))
      ),
      presentation = list(
        nombre_humano = nombre,
        nombre_tecnico = parsed$flag,
        objetivo = objetivo,
        subtipo_semantico = as.character(row[["Tipo"]] %||% NA_character_)
      )
    )
  } else if (identical(tipo_regla, "repeat_length")) {
    rule <- .rule_apply_metadata(
      rule,
      primary_var = as.character(repeat_context %||% tabla),
      variable_roles = list(target = as.character(repeat_context %||% tabla)),
      presentation = list(
        nombre_humano = nombre,
        nombre_tecnico = parsed$flag,
        objetivo = objetivo,
        subtipo_semantico = as.character(row[["Tipo"]] %||% "repeat")
      )
    )
  } else {
    rule <- .rule_apply_metadata(
      rule,
      presentation = list(
        nombre_humano = nombre,
        nombre_tecnico = parsed$flag,
        objetivo = objetivo,
        subtipo_semantico = as.character(row[["Tipo"]] %||% NA_character_)
      )
    )
  }

  rule
}

.runtime_parse_processing <- function(proc, nombre_fallback = NA_character_) {
  if (is.na(proc) || !nzchar(proc)) return(NULL)
  if (grepl("<-", proc, fixed = TRUE)) {
    partes <- strsplit(proc, "<-", fixed = TRUE)[[1]]
    flag <- trimws(partes[1])
    rhs <- trimws(paste(partes[-1], collapse = "<-"))
  } else {
    if (is.na(nombre_fallback) || !nzchar(nombre_fallback)) return(NULL)
    flag <- nombre_fallback
    rhs <- trimws(proc)
  }
  if (!nzchar(flag) || !nzchar(rhs)) return(NULL)
  list(flag = flag, rhs = rhs)
}

#' Puente de filas de plan legacy a reglas AST evaluables.
#' @export
bridge_legacy_plan_rows_to_rules <- function(plan_df, fuente = "instrumento") {
  if (is.null(plan_df) || !is.data.frame(plan_df) || !nrow(plan_df)) return(list())
  rows <- lapply(seq_len(nrow(plan_df)), function(i) {
    .bridge_legacy_plan_row(plan_df[i, , drop = FALSE], fuente = fuente)
  })
  Filter(Negate(is.null), rows)
}

# -----------------------------------------------------------------------------
# Bundle AST-first
# -----------------------------------------------------------------------------

.dedup_rules_exact <- function(rules) {
  if (!length(rules)) return(rules)
  ids <- vapply(rules, function(r) as.character(r$id), character(1))
  rules[!duplicated(ids)]
}

#' Construye el bundle AST-first desde instrumento + reglas custom.
#' @export
build_validation_bundle <- function(instrumento,
                                    reglas_custom = list(),
                                    incluir = NULL,
                                    rango_fecha = NULL,
                                    campo_fecha = NULL,
                                    compatibility = NULL) {
  ast_bundle <- build_unified_rules(
    instrumento = instrumento,
    reglas_custom = reglas_custom,
    include = .validation_ast_include(incluir)
  )

  legacy_flags <- .validation_legacy_bridge_flags(incluir)
  legacy_rules <- list()
  legacy_plan <- NULL
  legacy_error <- NULL
  if (isTRUE(legacy_flags$calculate) ||
      isTRUE(legacy_flags$choice_filter) ||
      isTRUE(legacy_flags$repeat_min1) ||
      isTRUE(legacy_flags$tiempo_ventana)) {
    legacy_plan <- tryCatch(
      generar_plan_limpieza(
        x = instrumento,
        incluir = legacy_flags,
        rango_fecha = rango_fecha,
        campo_fecha = campo_fecha
      ),
      error = function(e) {
        legacy_error <<- conditionMessage(e)
        NULL
      }
    )
    if (!is.null(legacy_plan)) {
      legacy_rules <- bridge_legacy_plan_rows_to_rules(legacy_plan, fuente = "instrumento")
    }
  }

  rules <- .dedup_rules_exact(c(ast_bundle$rules, legacy_rules))

  # A2 — evita mostrar dos reglas del mismo hecho: la inferencia LEGACY de
  # "valores calculados" sobre las calculate de identidad del roster
  # (`current_code`/`current_label`) es intraducible y redundante con RC5
  # (`roster_set_cmp`), que valida la correspondencia roster↔selección
  # relacionalmente. Si RC5 está presente, suprimimos la legacy duplicada.
  roster_legacy <- .suppress_redundant_roster_legacy(rules, instrumento$survey)
  rules <- roster_legacy$rules
  plan <- compile_rules_to_plan(rules)

  # Mapa code→label por variable (select_one/multiple). Lo persistimos en el
  # bundle para que el evaluador (a) haga comparaciones agnósticas code/label y
  # (b) no marque `desalineada` una regla cuyo valor SÍ pertenece a la lista de
  # opciones — o cuya data ya calza con esa lista (ver .rule_domain_mismatch).
  choices_map <- tryCatch(
    .survey_choices_map(instrumento$survey, instrumento$choices),
    error = function(e) list()
  )

  list(
    rules = rules,
    plan = plan,
    lex_report = ast_bundle$lex_report,
    discarded = c(ast_bundle$discarded, list()),
    unsupported = ast_bundle$unsupported %||% list(),
    dedup_info = ast_bundle$dedup_info,
    choices_map = choices_map,
    compatibility = compatibility %||% make_validation_compatibility_profile(),
    include_flags = .validation_merge_include_flags(incluir),
    legacy_bridge = list(
      n_rules = length(legacy_rules),
      plan = legacy_plan,
      error = legacy_error
    ),
    # Reglas legacy suprimidas por redundancia con la familia relacional (RC5).
    relational_suppressed_legacy = roster_legacy$suppressed_ids
  )
}

#' Reconstituye un bundle a partir de la hoja Plan exportada.
#' @export
validation_bundle_from_plan_df <- function(plan_df,
                                           existing_bundle = NULL,
                                           compatibility = NULL) {
  if (is.null(plan_df) || !is.data.frame(plan_df)) {
    stop("validation_bundle_from_plan_df(): plan_df debe ser data.frame.")
  }

  has_rule_json <- "_ast_rule_json" %in% names(plan_df)
  rules <- list()
  import_warnings <- character(0)

  if (isTRUE(has_rule_json)) {
    rules <- lapply(seq_len(nrow(plan_df)), function(i) {
      row <- plan_df[i, , drop = FALSE]
      raw_json <- as.character(row[["_ast_rule_json"]] %||% "")
      if (!nzchar(raw_json)) return(NULL)
      rule <- rule_from_json(raw_json)
      # Overlay editable fields del Excel; el AST sigue siendo la verdad.
      nombre_humano <- as.character(row[["_nombre_humano"]] %||% row[["Nombre de regla"]] %||% rule$nombre)
      objetivo <- as.character(row[["Objetivo"]] %||% rule$objetivo)
      nombre_tecnico_in <- as.character(row[["Nombre técnico"]] %||% row[["_nombre_tecnico"]] %||% NA_character_)
      if ("Objetivo" %in% names(row) && nzchar(as.character(row[["Objetivo"]] %||% ""))) {
        objetivo <- as.character(row[["Objetivo"]])
      }
      if ("Tabla" %in% names(row) && nzchar(as.character(row[["Tabla"]] %||% ""))) {
        rule$tabla <- .normalize_rule_table(row[["Tabla"]])
      }
      if ("Sección" %in% names(row) && nzchar(as.character(row[["Sección"]] %||% ""))) {
        rule$seccion <- as.character(row[["Sección"]])
      }
      if ("_categoria_ux" %in% names(row) && nzchar(as.character(row[["_categoria_ux"]] %||% ""))) {
        rule$categoria_ux <- as.character(row[["_categoria_ux"]])
      }
      if ("_nombre_humano" %in% names(row) && nzchar(as.character(row[["_nombre_humano"]] %||% ""))) {
        nombre_humano <- as.character(row[["_nombre_humano"]])
      }
      if ("_severidad" %in% names(row) && nzchar(as.character(row[["_severidad"]] %||% ""))) {
        rule$severidad <- as.character(row[["_severidad"]])
      }
      original_tecnico <- .rule_apply_metadata(rule)$presentation$nombre_tecnico
      if (!is.na(nombre_tecnico_in) && nzchar(nombre_tecnico_in) &&
          !identical(.sanitize_rule_token(nombre_tecnico_in), .sanitize_rule_token(original_tecnico))) {
        import_warnings <<- c(
          import_warnings,
          sprintf("Regla %s: se ignoró la edición de 'Nombre técnico' y se preservó '%s'.",
                  as.character(row[["ID"]] %||% rule$id), original_tecnico)
        )
      }
      .rule_apply_metadata(
        rule,
        presentation = list(
          nombre_humano = nombre_humano,
          objetivo = objetivo,
          nombre_tecnico = original_tecnico
        )
      )
    })
    rules <- Filter(Negate(is.null), rules)
  } else if (!is.null(existing_bundle) && length(existing_bundle$rules %||% list())) {
    # Fallback conservador: conservar reglas previas y sólo refrescar vista plan.
    rules <- existing_bundle$rules
  } else {
    rules <- bridge_legacy_plan_rows_to_rules(plan_df, fuente = "instrumento")
  }

  list(
    rules = .dedup_rules_exact(rules),
    plan = plan_df,
    lex_report = existing_bundle$lex_report %||% data.frame(),
    discarded = existing_bundle$discarded %||% list(),
    dedup_info = existing_bundle$dedup_info %||% list(),
    compatibility = compatibility %||% existing_bundle$compatibility %||% make_validation_compatibility_profile(),
    import_warnings = import_warnings %||% character(0)
  )
}

#' Carga un Excel exportado del plan AST y reconstruye el bundle.
#' @export
validation_bundle_from_plan_xlsx <- function(path,
                                             existing_bundle = NULL,
                                             compatibility = NULL) {
  plan_df <- cargar_plan_excel(path)
  validation_bundle_from_plan_df(
    plan_df = plan_df,
    existing_bundle = existing_bundle,
    compatibility = compatibility
  )
}

# -----------------------------------------------------------------------------
# Data loader AST-aware
# -----------------------------------------------------------------------------

.repeats_count_map_from_instrumento <- function(instrumento) {
  sm <- instrumento$meta$section_map %||% NULL
  if (is.null(sm) || !is.data.frame(sm) || !nrow(sm) || !"is_repeat" %in% names(sm)) return(NULL)
  keep <- isTRUE(sm$is_repeat) | as.logical(sm$is_repeat %||% FALSE)
  keep[is.na(keep)] <- FALSE
  sm <- sm[keep, , drop = FALSE]
  if (!nrow(sm) || !"group_name" %in% names(sm)) return(NULL)
  tibble::tibble(
    repeats = as.character(sm$group_name),
    repeat_count = as.character(sm$repeat_count %||% NA_character_)
  )
}

.runtime_name_canon <- function(x) {
  x <- trimws(as.character(x %||% ""))
  x <- gsub("\\s+", "_", x)
  # chartr() sobre UTF-8 multibyte falla con "'old' is longer than 'new'"
  # cuando R cuenta por bytes en vez de caracteres en locales no-UTF-8.
  # Normalizamos con iconv (transliteración ASCII) que es portable.
  y <- tryCatch(
    iconv(x, from = "UTF-8", to = "ASCII//TRANSLIT"),
    error = function(e) NULL,
    warning = function(w) NULL
  )
  if (!is.null(y) && !any(is.na(y))) x <- y
  else {
    # Fallback manual si iconv falla: gsub por letra.
    for (pair in list(c("[áàäâ]", "a"), c("[éèëê]", "e"), c("[íìïî]", "i"),
                       c("[óòöô]", "o"), c("[úùüû]", "u"), c("ñ", "n"),
                       c("[ÁÀÄÂ]", "A"), c("[ÉÈËÊ]", "E"), c("[ÍÌÏÎ]", "I"),
                       c("[ÓÒÖÔ]", "O"), c("[ÚÙÜÛ]", "U"), c("Ñ", "N"))) {
      x <- gsub(pair[1], pair[2], x, perl = TRUE)
    }
  }
  tolower(x)
}

#' Cobertura de datos de una columna (celdas no vacías tras normalizar).
#' Un placeholder totalmente en blanco cuenta 0 y no debe ganar sobre una
#' variante poblada al restaurar el nombre del instrumento.
#' @keywords internal
.restore_col_filled <- function(x) {
  if (is.null(x)) return(0L)
  v <- trimws(as.character(x))
  sum(!is.na(v) & nzchar(v) & v != "NA")
}

.restore_instrument_case_aliases <- function(tables, instrumento = NULL) {
  survey <- if (!is.null(instrumento)) instrumento$survey else NULL
  if (is.null(survey) || !is.data.frame(survey) || !"name" %in% names(survey) || !length(tables)) {
    return(tables)
  }

  instrument_vars <- unique(as.character(stats::na.omit(survey$name)))
  instrument_vars <- instrument_vars[nzchar(instrument_vars)]
  if (!length(instrument_vars)) return(tables)

  lapply(tables, function(df) {
    if (!is.data.frame(df) || !ncol(df)) return(df)
    current_names <- names(df)
    # Canon que ADEMÁS colapsa el prefijo de grupo (`grupo/var` -> `var`).
    # Sin esto, una base Kobo limpia con columnas prefijadas
    # (`D/D1_information`) no aliasa a la variable del instrumento
    # (`D1_information`) y la regla queda `no_aplicable` (falso negativo).
    canon_leaf <- .runtime_name_canon(sub("^.*/", "", current_names))

    for (var in instrument_vars) {
      var_canon <- .runtime_name_canon(sub("^.*/", "", var))
      cand_idx <- which(canon_leaf == var_canon)
      if (!length(cand_idx)) next

      # Si la variable ya existe con su nombre exacto Y con datos, respétala.
      exact_pos <- match(var, current_names)
      if (!is.na(exact_pos) && .restore_col_filled(df[[exact_pos]]) > 0L) next

      # Elegir la mejor fuente: primero la de mayor cobertura de datos; ante
      # empate, la de nombre exacto y sin prefijo de grupo. Esto evita que un
      # placeholder vacío de la madre select_multiple (que queda en blanco tras
      # la expansión a dummies) sombree la variante poblada y dispare las
      # reglas required/skip en falso sobre toda la base.
      fill <- vapply(cand_idx, function(i) .restore_col_filled(df[[i]]), integer(1))
      exactness <- vapply(cand_idx, function(i) {
        nm <- current_names[i]
        (if (identical(nm, var)) 2L else 0L) + (if (!grepl("/", nm, fixed = TRUE)) 1L else 0L)
      }, integer(1))
      best <- cand_idx[order(-fill, -exactness)][1]

      # No sobre-escribir una columna con un placeholder vacío: solo copiamos
      # si la fuente aporta datos, o si la variable aún no existía (crear el
      # alias aunque venga vacío es inocuo y preserva el comportamiento previo).
      if (.restore_col_filled(df[[best]]) > 0L || is.na(exact_pos)) {
        df[[var]] <- df[[best]]
      }
    }
    df
  })
}

.inherit_parent_columns <- function(tables, main_name) {
  if (!length(tables) || is.null(main_name) || !(main_name %in% names(tables))) return(tables)
  main <- tables[[main_name]]
  if (!is.data.frame(main) || !("_index" %in% names(main))) return(tables)

  for (nm in setdiff(names(tables), main_name)) {
    child <- tables[[nm]]
    if (!is.data.frame(child) || !("_parent_index" %in% names(child))) next
    add_cols <- setdiff(names(main), names(child))
    if (!length(add_cols)) next
    # Enlace por `_parent_index`↔`_index` (sin fallback aquí: este path ya está
    # guardado por la presencia de ambas llaves). Usa el helper compartido de
    # link-join (ADR 0030) para no duplicar la lógica de `match`.
    pos <- .dn_repeat_parent_row_positions(
      child, main, link_key = "_parent_index", parent_index_key = "_index")
    for (cc in add_cols) {
      child[[cc]] <- main[[cc]][pos]
    }
    tables[[nm]] <- child
  }
  tables
}

# Post-procesamiento común del modelo multi-tabla producido por lector_limpieza:
# herencia de columnas del padre, restauración de nombres del instrumento,
# alias `principal`, normalización + filtro SM de la hoja madre. Lo comparten la
# rama XLSX multi-hoja (`read_validation_data_ast`) y el ensamblador multi-base
# (ADR 0030 Fase 2), de modo que ambos entregan un `data_ctx` de la MISMA forma.
.finalize_multitable_data_ctx <- function(lx, instrumento = NULL,
                                          source = "lector_limpieza") {
  main_name <- lx$meta$main %||% names(lx$data)[1]
  tables <- .inherit_parent_columns(lx$data, main_name = main_name)
  tables <- .restore_instrument_case_aliases(tables, instrumento = instrumento)
  if (!"principal" %in% names(tables) && !is.null(main_name) && main_name %in% names(tables)) {
    tables <- c(list(principal = tables[[main_name]]), tables)
  }
  filtered <- list(data = tables$principal, filter = NULL)
  if (!is.null(tables$principal)) {
    tables$principal <- normalize_data_for_xlsform(tables$principal, instrumento)
    filtered <- .validation_filter_sm_partial_rows(tables$principal)
    tables$principal <- filtered$data
  }
  list(
    principal = tables$principal %||% tables[[1]],
    tables = tables,
    data_multi = tables[setdiff(names(tables), "principal")],
    rc_checks = lx$rc_checks %||% list(),
    meta = lx$meta %||% list(),
    row_filter = filtered$filter %||% NULL,
    source = source
  )
}

#' Lee data para evaluación AST con awareness de repeats.
#' @export
read_validation_data_ast <- function(path, ext, instrumento = NULL) {
  ext <- tolower(as.character(ext %||% tools::file_ext(path)))
  if (ext %in% c("xlsx", "xls")) {
    rc_map <- .repeats_count_map_from_instrumento(instrumento)
    sheets <- readxl::excel_sheets(path)
    main_sheet <- sheets[1] %||% NULL
    lx <- lector_limpieza(
      archivo = path,
      hoja_principal = main_sheet,
      repeats_count_map = rc_map,
      warn = FALSE
    )
    return(.finalize_multitable_data_ctx(lx, instrumento = instrumento,
                                         source = "lector_limpieza"))
  }

  df <- switch(ext,
    csv = utils::read.csv(path, stringsAsFactors = FALSE),
    sav = haven::read_sav(path),
    stop(sprintf("Unsupported data extension for AST runtime: %s", ext))
  )
  df <- normalize_data_for_xlsform(df, instrumento)
  filtered <- .validation_filter_sm_partial_rows(df)
  df <- filtered$data
  list(
    principal = df,
    tables = list(principal = df),
    data_multi = list(),
    rc_checks = list(),
    meta = list(main = "principal"),
    row_filter = filtered$filter %||% NULL,
    source = "single_table"
  )
}

.validation_missing_cell <- function(x) {
  if (is.factor(x)) x <- as.character(x)
  if (is.logical(x)) return(is.na(x) | !x)
  x_chr <- trimws(as.character(x))
  is.na(x_chr) | !nzchar(x_chr) | x_chr == "NA"
}

.validation_sm_page_marker_cols <- function(df) {
  if (!is.data.frame(df) || !length(names(df))) return(character(0))
  candidates <- names(df)[grepl("^p0{3,}[0-9]+$", names(df), perl = TRUE)]
  if (!length(candidates)) return(character(0))
  labelled <- candidates[vapply(candidates, function(nm) {
    lab <- attr(df[[nm]], "label", exact = TRUE)
    !is.null(lab) && grepl("^Page\\s+[0-9]+$", as.character(lab), ignore.case = TRUE)
  }, logical(1))]
  if (length(labelled)) return(labelled)
  if (length(candidates) >= 2L) candidates else character(0)
}

.validation_filter_sm_partial_rows <- function(df) {
  if (!is.data.frame(df) || !nrow(df)) {
    return(list(data = df, filter = NULL))
  }
  marker_cols <- .validation_sm_page_marker_cols(df)
  if (!length(marker_cols)) {
    return(list(data = df, filter = NULL))
  }

  marker_mat <- vapply(marker_cols, function(nm) {
    !.validation_missing_cell(df[[nm]])
  }, logical(nrow(df)))
  if (is.null(dim(marker_mat))) {
    marker_any <- marker_mat
  } else {
    marker_any <- rowSums(marker_mat, na.rm = TRUE) > 0L
  }
  marker_any[is.na(marker_any)] <- FALSE
  n_marked <- sum(marker_any)

  filter_info <- list(
    kind = "surveymonkey_partial_page_markers",
    applied = FALSE,
    original_rows = as.integer(nrow(df)),
    kept_rows = as.integer(nrow(df)),
    excluded_rows = 0L,
    marker_columns = marker_cols
  )

  # Salvaguarda: si todas las filas vienen con marcadores de página, no
  # asumimos que son parciales; algunos exports podrían usar esas columnas
  # como metadata normal. El patrón SurveyMonkey problemático marca solo
  # abandonos, como en los .sav de ingeniería.
  if (!n_marked || n_marked == nrow(df)) {
    return(list(data = df, filter = filter_info))
  }

  out <- df[!marker_any, , drop = FALSE]
  filter_info$applied <- TRUE
  filter_info$kept_rows <- as.integer(nrow(out))
  filter_info$excluded_rows <- as.integer(n_marked)
  list(data = out, filter = filter_info)
}

# -----------------------------------------------------------------------------
# Evaluación AST-first con shape compatible con evaluar_consistencia()
# -----------------------------------------------------------------------------

.rule_meta_from_bundle <- function(bundle) {
  plan <- bundle$plan %||% compile_rules_to_plan(bundle$rules)
  if (is.null(plan) || !is.data.frame(plan) || !nrow(plan)) {
    return(tibble::tibble(
      id_regla = character(),
      nombre_regla = character(),
      nombre_tecnico = character(),
      tabla = character(),
      seccion = character(),
      categoria = character(),
      tipo_observacion = character(),
      objetivo = character(),
      variable_1 = character(),
      variable_1_etiqueta = character(),
      variable_2 = character(),
      variable_2_etiqueta = character(),
      variable_3 = character(),
      variable_3_etiqueta = character(),
      procesamiento = character(),
      tipo_regla = character(),
      categoria_ux = character(),
      fuente = character(),
      tipo_variable = character(),
      variable_roles = list(),
      presentation = list()
    ))
  }

  rule_map <- stats::setNames(bundle$rules, vapply(bundle$rules, function(r) r$id, character(1)))
  out <- lapply(seq_len(nrow(plan)), function(i) {
    row <- plan[i, , drop = FALSE]
    rid <- as.character(row[["ID"]] %||% "")
    rule <- rule_map[[rid]]
    tibble::tibble(
      id_regla = rid,
      nombre_regla = as.character(rule$presentation$nombre_humano %||% rule$nombre %||% row[["_nombre_humano"]] %||% rid),
      nombre_tecnico = as.character(rule$presentation$nombre_tecnico %||% row[["Nombre técnico"]] %||% row[["_nombre_tecnico"]] %||% rule$flag_name %||% rid),
      tabla = if (!is.null(rule) && identical(rule$tipo_regla, "repeat_length")) "principal"
              else .normalize_rule_table(row[["Tabla"]] %||% "principal"),
      seccion = as.character(row[["Sección"]] %||% NA_character_),
      categoria = .rule_legacy_categoria(rule$tipo_regla %||% as.character(row[["_tipo_regla"]] %||% "constraint")),
      tipo_observacion = .rule_observation_label(rule$tipo_regla %||% as.character(row[["_tipo_regla"]] %||% "constraint")),
      objetivo = as.character(row[["Objetivo"]] %||% rule$presentation$objetivo %||% rule$objetivo %||% NA_character_),
      variable_1 = as.character(row[["Variable 1"]] %||% NA_character_),
      variable_1_etiqueta = as.character(row[["Variable 1 - Etiqueta"]] %||% NA_character_),
      variable_2 = as.character(row[["Variable 2"]] %||% NA_character_),
      variable_2_etiqueta = as.character(row[["Variable 2 - Etiqueta"]] %||% NA_character_),
      variable_3 = as.character(row[["Variable 3"]] %||% NA_character_),
      variable_3_etiqueta = as.character(row[["Variable 3 - Etiqueta"]] %||% NA_character_),
      procesamiento = as.character(row[["Procesamiento"]] %||% NA_character_),
      tipo_regla = as.character(rule$tipo_regla %||% row[["_tipo_regla"]] %||% "constraint"),
      categoria_ux = as.character(rule$categoria_ux %||% row[["_categoria_ux"]] %||% "consistencia"),
      fuente = as.character(rule$fuente %||% row[["_fuente"]] %||% "instrumento"),
      tipo_variable = NA_character_,
      variable_roles = list(rule$variable_roles %||% list()),
      presentation = list(rule$presentation %||% list())
    )
  })
  dplyr::bind_rows(out)
}

# RC2 — evalúa el `gate` (relevant del begin_repeat) contra la madre y devuelve
# un vector lógico alineado a las filas de `by_parent`. TRUE = la sección debía
# abrir; FALSE = no debía; NA = indeterminable (se trata como "abierta" aguas
# abajo para no inventar inconsistencias). Compila el gate a R (mismo camino que
# el evaluador principal) e inyecta los bindings mínimos. Cualquier error →
# NULL (degradación silenciosa: RC2 no aplica, solo RC1).
.rl_gate_true_vector <- function(gate, main, by_parent, choices_map = list()) {
  if (is.null(gate) || !is_ast(gate) || !is.data.frame(main) || !nrow(main)) return(NULL)
  rhs <- tryCatch(ast_to_r(gate), error = function(e) NULL)
  if (is.null(rhs)) return(NULL)
  eval_env <- new.env(parent = globalenv())
  for (nm in names(main)) assign(nm, main[[nm]], envir = eval_env)
  assign(".__eval_data__", main, envir = eval_env)
  assign(".__choices_map__", as.list(choices_map %||% list()), envir = eval_env)
  assign("__data_multi__", list(principal = main), envir = eval_env)
  assign("sum", .legacy_safe_sum, envir = eval_env)
  assign("mean", .legacy_safe_mean, envir = eval_env)
  assign("min", .legacy_safe_min, envir = eval_env)
  assign("max", .legacy_safe_max, envir = eval_env)
  res <- tryCatch(eval(parse(text = rhs), envir = eval_env), error = function(e) NULL)
  if (is.null(res)) return(NULL)
  gate_main <- if (is.logical(res)) res
               else if (is.numeric(res)) as.logical(res)
               else return(NULL)
  if (length(gate_main) == 1L) gate_main <- rep(gate_main, nrow(main))
  if (length(gate_main) != nrow(main)) return(NULL)

  # Alinear a las filas de by_parent: preferimos la llave del padre (primera
  # columna de by_parent, p.ej. `_index`); si no calza, fallback posicional.
  pk <- names(by_parent)[1]
  if (!is.null(pk) && pk %in% names(main) && pk %in% names(by_parent)) {
    pos <- match(as.character(by_parent[[pk]]), as.character(main[[pk]]))
    return(gate_main[pos])
  }
  if (length(gate_main) == nrow(by_parent)) return(gate_main)
  NULL
}

.evaluate_repeat_length_rules <- function(rules, data_ctx, choices_map = list()) {
  if (!length(rules)) {
    return(list(resumen = tibble::tibble(), principal = data_ctx$principal))
  }

  main <- data_ctx$principal
  rows <- list()
  for (rule in rules) {
    rep_name <- as.character(rule$repeat_context %||% rule$tabla %||% rule$primary_var %||% NA_character_)
    rc_check <- data_ctx$rc_checks[[rep_name]]
    by_parent <- if (!is.null(rc_check)) rc_check$by_parent else NULL
    if (is.null(by_parent) || !is.data.frame(by_parent) || !"status" %in% names(by_parent)) {
      rows[[length(rows) + 1L]] <- tibble::tibble(
        id = rule$id,
        nombre = rule$nombre,
        tipo_regla = rule$tipo_regla,
        categoria_ux = rule$categoria_ux,
        severidad = rule$severidad,
        fuente = rule$fuente,
        tabla = "principal",
        seccion = rule$seccion %||% NA_character_,
        flag = rule$flag_name,
        n_filas = nrow(main %||% tibble::tibble()),
        n_inconsistencias = NA_integer_,
        porcentaje = NA_real_,
        estado = "no_evaluada",
        issue_code = "repeat_length_pending",
        detalle = sprintf("No se pudo resolver repeat_count para '%s'.", rep_name)
      )
      next
    }

    status <- as.character(by_parent$status)
    have_n <- suppressWarnings(as.integer(by_parent$have_n))
    have_n[is.na(have_n)] <- 0L

    # RC2 — gate de presencia: reclasifica por fila madre cuando hay gate.
    n_gate_cerrado <- 0L
    gate_vec <- .rl_gate_true_vector(rule$gate, main, by_parent, choices_map)
    if (!is.null(gate_vec) && length(gate_vec) == length(status)) {
      gate_open <- gate_vec
      gate_open[is.na(gate_open)] <- TRUE  # indeterminable → tratar como abierta
      closed <- !gate_open
      # Gate cerrado + filas hija → inconsistencia (sección que no debía abrir).
      idx_bad <- which(closed & have_n > 0L)
      status[idx_bad] <- "sobran_gate_cerrado"
      n_gate_cerrado <- length(idx_bad)
      # Gate cerrado + 0 filas → correcto (override cualquier sin_meta/faltan).
      status[closed & have_n == 0L] <- "ok"
    }

    flag_vec <- status %in% c("faltan", "sobran", "sobran_gate_cerrado")
    flag_vec[is.na(flag_vec)] <- FALSE
    if (is.data.frame(main) && nrow(main) == length(flag_vec)) {
      main[[rule$flag_name]] <- flag_vec
    }
    n_inc <- sum(flag_vec, na.rm = TRUE)
    detalle <- NA_character_
    if (n_gate_cerrado > 0L) {
      detalle <- sprintf(
        "sobran_gate_cerrado: %d caso(s) con la sección cerrada (gate FALSE) que igual tienen registros hija.",
        as.integer(n_gate_cerrado)
      )
    }
    rows[[length(rows) + 1L]] <- tibble::tibble(
      id = rule$id,
      nombre = rule$nombre,
      tipo_regla = rule$tipo_regla,
      categoria_ux = rule$categoria_ux,
      severidad = rule$severidad,
      fuente = rule$fuente,
      tabla = "principal",
      seccion = rule$seccion %||% NA_character_,
      flag = rule$flag_name,
      n_filas = nrow(main %||% tibble::tibble()),
      n_inconsistencias = as.integer(n_inc),
      porcentaje = if (nrow(main %||% tibble::tibble()) > 0L) n_inc / nrow(main) else NA_real_,
      estado = "correcta",
      issue_code = NA_character_,
      detalle = detalle
    )
  }

  list(resumen = dplyr::bind_rows(rows), principal = main)
}

.apply_compatibility_to_resumen <- function(resumen, compatibility) {
  if (is.null(resumen) || !nrow(resumen) || is.null(compatibility)) return(resumen)
  mask <- resumen$issue_code %in% c("missing_columns", "missing_data_table")
  mask[is.na(mask)] <- FALSE
  if (!any(mask)) return(resumen)

  rows <- which(mask)
  for (i in rows) {
    if (.is_compatible_missing_columns(resumen$detalle[i], compatibility)) {
      resumen$estado[i] <- "correcta"
      resumen$issue_code[i] <- "compatible_missing_columns"
      resumen$detalle[i] <- paste0("Compatibilidad declarativa: ", as.character(resumen$detalle[i] %||% ""))
      resumen$n_inconsistencias[i] <- 0L
      resumen$porcentaje[i] <- 0
    }
  }
  resumen
}

#' Evalúa el bundle AST y devuelve el mismo shape que evaluar_consistencia().
#' @export
evaluate_validation_bundle <- function(bundle,
                                       data_input,
                                       compatibility = NULL,
                                       collection_date_col = NULL,
                                       strict = FALSE,
                                       validation_exclusions = list()) {
  stopifnot(is.list(bundle), length(bundle$rules %||% list()) >= 0)
  rules <- bundle$rules %||% list()
  if (!length(rules)) {
    return(list(
      datos = data_input$principal %||% tibble::tibble(),
      datos_tablas = data_input$tables %||% list(principal = data_input$principal %||% tibble::tibble()),
      resumen = tibble::tibble(),
      reglas_meta = .rule_meta_from_bundle(bundle),
      diagnostico_reglas = tibble::tibble()
    ))
  }

  data_ctx <- if (is.list(data_input) && !is.null(data_input$tables)) data_input else list(
    principal = data_input,
    tables = list(principal = data_input),
    data_multi = list(),
    rc_checks = list()
  )
  tables <- data_ctx$tables
  if (is.null(tables$principal) && is.data.frame(data_ctx$principal)) {
    tables$principal <- data_ctx$principal
  }

  typed_rules <- Filter(function(r) !identical(as.character(r$tipo_regla), "repeat_length"), rules)
  repeat_rules <- Filter(function(r) identical(as.character(r$tipo_regla), "repeat_length"), rules)

  resumen_parts <- list()
  tables_out <- tables

  table_names <- unique(vapply(typed_rules, function(r) .normalize_rule_table(r$tabla), character(1)))
  for (tbl in table_names) {
    tbl_rules <- typed_rules[vapply(typed_rules, function(r) .normalize_rule_table(r$tabla), character(1)) == tbl]
    if (!(tbl %in% names(tables))) {
      # ADR 0030 Fase 2 — degradación con gracia: si la tabla ausente es una
      # sección repetida declarada por el instrumento (las reglas la traen como
      # `repeat_context`) pero SIN base hija registrada (0 instancias en toda la
      # data, o proyecto no expandido), sus reglas NO son un fallo de ejecución:
      # simplemente no aplican. Distinguirlo de un "falta la tabla de datos"
      # real (flujo XLSX multi-hoja) evita ruido de la base madre.
      es_repeat_faltante <- any(vapply(tbl_rules, function(r) {
        rc <- as.character(r$repeat_context %||% "")
        nzchar(rc)
      }, logical(1)))
      if (isTRUE(es_repeat_faltante)) {
        estado_tbl <- "no_aplicable"
        issue_tbl <- "sin_datos_repeat"
        detalle_tbl <- sprintf(
          "La sección repetida «%s» no tiene registros en esta base (0 instancias); sus reglas no aplican.",
          tbl
        )
        n_inc_tbl <- 0L
        pct_tbl <- 0
      } else {
        estado_tbl <- "incorrecta_ejecucion"
        issue_tbl <- "missing_data_table"
        detalle_tbl <- paste0("No existe hoja/tabla de datos para: ", tbl)
        n_inc_tbl <- NA_integer_
        pct_tbl <- NA_real_
      }
      manual <- tibble::tibble(
        id = vapply(tbl_rules, function(r) r$id, character(1)),
        nombre = vapply(tbl_rules, function(r) r$nombre, character(1)),
        tipo_regla = vapply(tbl_rules, function(r) r$tipo_regla, character(1)),
        categoria_ux = vapply(tbl_rules, function(r) r$categoria_ux, character(1)),
        severidad = vapply(tbl_rules, function(r) r$severidad, character(1)),
        fuente = vapply(tbl_rules, function(r) r$fuente, character(1)),
        tabla = tbl,
        seccion = vapply(tbl_rules, function(r) as.character(r$seccion %||% NA_character_), character(1)),
        flag = vapply(tbl_rules, function(r) r$flag_name, character(1)),
        n_filas = NA_integer_,
        n_inconsistencias = n_inc_tbl,
        porcentaje = pct_tbl,
        estado = estado_tbl,
        issue_code = issue_tbl,
        detalle = detalle_tbl
      )
      resumen_parts[[length(resumen_parts) + 1L]] <- manual
      next
    }

    ev_tbl <- evaluate_rules(
      rules = tbl_rules,
      data = tables[[tbl]],
      data_multi = tables,
      collection_date_col = collection_date_col,
      strict = strict,
      table_name = tbl,
      validation_exclusions = validation_exclusions,
      choices_map = bundle$choices_map %||% list()
    )
    tables_out[[tbl]] <- ev_tbl$data
    resumen_parts[[length(resumen_parts) + 1L]] <- ev_tbl$resumen
  }

  principal_now <- if (!is.null(tables_out$principal)) tables_out$principal else data_ctx$principal
  repeat_eval <- .evaluate_repeat_length_rules(
    repeat_rules,
    data_ctx = utils::modifyList(data_ctx, list(principal = principal_now)),
    choices_map = bundle$choices_map %||% list()
  )
  tables_out$principal <- repeat_eval$principal
  if (nrow(repeat_eval$resumen %||% tibble::tibble())) {
    resumen_parts[[length(resumen_parts) + 1L]] <- repeat_eval$resumen
  }

  resumen_raw <- if (length(resumen_parts)) dplyr::bind_rows(resumen_parts) else tibble::tibble()
  resumen_raw <- .apply_compatibility_to_resumen(resumen_raw, compatibility %||% bundle$compatibility)

  reglas_meta <- .rule_meta_from_bundle(bundle)
  resumen <- dplyr::left_join(
    resumen_raw,
    dplyr::select(reglas_meta,
      id_regla, nombre_regla, nombre_tecnico, tabla, seccion, categoria, tipo_observacion,
      objetivo,
      variable_1, variable_1_etiqueta,
      variable_2, variable_2_etiqueta,
      variable_3, variable_3_etiqueta,
      procesamiento,
      tipo_regla, categoria_ux, fuente, tipo_variable, variable_roles, presentation
    ),
    by = c("id" = "id_regla")
  ) %>%
    dplyr::transmute(
      id_regla = .data$id,
      nombre_regla = dplyr::coalesce(.data$nombre_regla, .data$nombre),
      nombre_tecnico = .data$nombre_tecnico,
      tabla = dplyr::coalesce(.data$tabla.x, .data$tabla.y, "principal"),
      seccion = dplyr::coalesce(.data$seccion.x, .data$seccion.y),
      categoria = .data$categoria,
      tipo_observacion = .data$tipo_observacion,
      flag = .data$flag,
      variable_1 = .data$variable_1,
      variable_1_etiqueta = .data$variable_1_etiqueta,
      variable_2 = .data$variable_2,
      variable_2_etiqueta = .data$variable_2_etiqueta,
      variable_3 = .data$variable_3,
      variable_3_etiqueta = .data$variable_3_etiqueta,
      n_filas = as.integer(.data$n_filas),
      n_inconsistencias = as.integer(.data$n_inconsistencias),
      porcentaje = as.numeric(.data$porcentaje),
      estado_dinamico = .data$estado,
      issue_code = .data$issue_code,
      detalle = .data$detalle,
      expresion_evaluada = .data$procesamiento,
      tipo_regla = dplyr::coalesce(.data$tipo_regla.y, .data$tipo_regla.x),
      categoria_ux = dplyr::coalesce(.data$categoria_ux.y, .data$categoria_ux.x),
      fuente = dplyr::coalesce(.data$fuente.y, .data$fuente.x),
      tipo_variable = .data$tipo_variable,
      variable_roles = .data$variable_roles,
      presentation = .data$presentation
    ) %>%
    dplyr::arrange(dplyr::desc(.data$n_inconsistencias))

  diagnostico_reglas <- dplyr::select(
    resumen,
    "id_regla", "nombre_regla", "tabla", "flag",
    "estado_dinamico", "issue_code", "detalle", "expresion_evaluada"
  )

  list(
    datos = tables_out$principal %||% data_ctx$principal,
    datos_tablas = tables_out,
    resumen = resumen,
    reglas_meta = reglas_meta,
    diagnostico_reglas = diagnostico_reglas,
    row_filter = data_ctx$row_filter %||% NULL,
    bundle = bundle
  )
}
