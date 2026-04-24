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
  # repeat_length forma parte del motor AST definitivo; no lo atamos al
  # toggle legacy repeat_min1 porque viene de repeat_count del instrumento.
  c(out, "repeat_length")
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
  plan <- compile_rules_to_plan(rules)

  list(
    rules = rules,
    plan = plan,
    lex_report = ast_bundle$lex_report,
    discarded = c(ast_bundle$discarded, list()),
    dedup_info = ast_bundle$dedup_info,
    compatibility = compatibility %||% make_validation_compatibility_profile(),
    include_flags = .validation_merge_include_flags(incluir),
    legacy_bridge = list(
      n_rules = length(legacy_rules),
      plan = legacy_plan,
      error = legacy_error
    )
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

.restore_instrument_case_aliases <- function(tables, instrumento = NULL) {
  survey <- instrumento$survey %||% NULL
  if (is.null(survey) || !is.data.frame(survey) || !"name" %in% names(survey) || !length(tables)) {
    return(tables)
  }

  instrument_vars <- unique(as.character(stats::na.omit(survey$name)))
  instrument_vars <- instrument_vars[nzchar(instrument_vars)]
  if (!length(instrument_vars)) return(tables)

  lapply(tables, function(df) {
    if (!is.data.frame(df) || !ncol(df)) return(df)
    current_names <- names(df)
    canon_current <- .runtime_name_canon(current_names)

    for (var in instrument_vars) {
      if (var %in% current_names) next
      hit <- match(.runtime_name_canon(var), canon_current)
      if (!is.na(hit) && nzchar(current_names[hit])) {
        df[[var]] <- df[[current_names[hit]]]
      }
    }
    df
  })
}

.inherit_parent_columns <- function(tables, main_name) {
  if (!length(tables) || is.null(main_name) || !(main_name %in% names(tables))) return(tables)
  main <- tables[[main_name]]
  if (!is.data.frame(main) || !("_index" %in% names(main))) return(tables)

  parent_key <- as.character(main[["_index"]])
  for (nm in setdiff(names(tables), main_name)) {
    child <- tables[[nm]]
    if (!is.data.frame(child) || !("_parent_index" %in% names(child))) next
    add_cols <- setdiff(names(main), names(child))
    if (!length(add_cols)) next
    pos <- match(as.character(child[["_parent_index"]]), parent_key)
    for (cc in add_cols) {
      child[[cc]] <- main[[cc]][pos]
    }
    tables[[nm]] <- child
  }
  tables
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
    main_name <- lx$meta$main %||% names(lx$data)[1]
    tables <- .inherit_parent_columns(lx$data, main_name = main_name)
    tables <- .restore_instrument_case_aliases(tables, instrumento = instrumento)
    if (!"principal" %in% names(tables) && !is.null(main_name) && main_name %in% names(tables)) {
      tables <- c(list(principal = tables[[main_name]]), tables)
    }
    return(list(
      principal = tables$principal %||% tables[[1]],
      tables = tables,
      data_multi = tables[setdiff(names(tables), "principal")],
      rc_checks = lx$rc_checks %||% list(),
      meta = lx$meta %||% list(),
      source = "lector_limpieza"
    ))
  }

  df <- switch(ext,
    csv = utils::read.csv(path, stringsAsFactors = FALSE),
    sav = haven::read_sav(path),
    stop(sprintf("Unsupported data extension for AST runtime: %s", ext))
  )
  list(
    principal = df,
    tables = list(principal = df),
    data_multi = list(),
    rc_checks = list(),
    meta = list(main = "principal"),
    source = "single_table"
  )
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

.evaluate_repeat_length_rules <- function(rules, data_ctx) {
  if (!length(rules)) {
    return(list(resumen = tibble::tibble(), principal = data_ctx$principal))
  }

  main <- data_ctx$principal
  rows <- list()
  for (rule in rules) {
    rep_name <- as.character(rule$repeat_context %||% rule$tabla %||% rule$primary_var %||% NA_character_)
    by_parent <- data_ctx$rc_checks[[rep_name]]$by_parent %||% NULL
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

    flag_vec <- by_parent$status %in% c("faltan", "sobran")
    flag_vec[is.na(flag_vec)] <- FALSE
    if (is.data.frame(main) && nrow(main) == length(flag_vec)) {
      main[[rule$flag_name]] <- flag_vec
    }
    n_inc <- sum(flag_vec, na.rm = TRUE)
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
      detalle = NA_character_
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
                                       strict = FALSE) {
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
        n_inconsistencias = NA_integer_,
        porcentaje = NA_real_,
        estado = "incorrecta_ejecucion",
        issue_code = "missing_data_table",
        detalle = paste0("No existe hoja/tabla de datos para: ", tbl)
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
      table_name = tbl
    )
    tables_out[[tbl]] <- ev_tbl$data
    resumen_parts[[length(resumen_parts) + 1L]] <- ev_tbl$resumen
  }

  principal_now <- if (!is.null(tables_out$principal)) tables_out$principal else data_ctx$principal
  repeat_eval <- .evaluate_repeat_length_rules(
    repeat_rules,
    data_ctx = utils::modifyList(data_ctx, list(principal = principal_now))
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
    bundle = bundle
  )
}
