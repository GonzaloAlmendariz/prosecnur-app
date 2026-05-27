# =============================================================================
# Reglas custom — validación de schema por tipo (Sprint 4)
# =============================================================================
# Cada regla custom tiene estructura común + params específicos por tipo.
# Estas funciones validan que una definición venga completa y coherente
# antes de compilarla al plan. Lanza `stop_api(400, ...)` en error.
#
# Tipos soportados:
#   - no_nulo              — marca casos con NA en `variables[1]`.
#   - rango_num            — marca casos fuera de [min,max] en numérico.
#   - rango_fecha          — idem pero con fechas ISO (YYYY-MM-DD).
#   - outliers_iqr         — fuera de [Q1 - k·IQR, Q3 + k·IQR].
#   - outliers_z           — |z-score| > k.
#   - duplicados           — tuplas de variables repetidas.
#   - fuera_catalogo       — valor no en lista `valores`.
#   - coherencia_2v        — "si x <op> <valor_x> entonces y <op> <valor_y>".
#   - select_multiple_hierarchy — si una opcion esta marcada, exige otras.
#   - select_multiple_exclusive — opciones excluyentes no conviven con otras.
#   - select_multiple_cardinality — min/max de opciones marcadas.
#   - select_multiple_selection — contiene/no contiene codigos esperados.

.regla_tipos_soportados <- c(
  "no_nulo", "rango_num", "rango_fecha",
  "outliers_iqr", "outliers_z",
  "duplicados", "fuera_catalogo", "coherencia_2v",
  "select_multiple_hierarchy", "select_multiple_exclusive",
  "select_multiple_cardinality", "select_multiple_selection"
)

.regla_operadores_basicos <- c("==", "!=", ">", ">=", "<", "<=", "in", "not_in")
.regla_operadores_gate <- c(
  .regla_operadores_basicos,
  "contains", "not_contains", "contains_any", "contains_all", "contains_none"
)
.regla_tratamientos <- c(
  "ignore_rule", "exclude_cases", "replace_value", "set_value",
  "recode_map", "complete_select_multiple_hierarchy",
  "adjust_select_multiple", "nullify_fields"
)
.regla_alcances_tratamiento <- c("all", "selected", "single")

.validar_regla_custom <- function(r) {
  if (!is.list(r)) stop_api(400, "E_REGLA_INVALIDA", "La regla debe ser un objeto.")
  tipo <- as.character(r$tipo %||% "")
  if (!nzchar(tipo)) stop_api(400, "E_REGLA_TIPO_FALTA", "Falta 'tipo'.")
  if (!(tipo %in% .regla_tipos_soportados)) {
    stop_api(400, "E_REGLA_TIPO_NO_SOPORTADO",
             sprintf("Tipo '%s' no soportado. Válidos: %s",
                      tipo, paste(.regla_tipos_soportados, collapse = ", ")))
  }
  vars <- unlist(r$variables %||% list())
  if (!length(vars) || any(!nzchar(vars))) {
    stop_api(400, "E_REGLA_SIN_VARS",
             "Falta 'variables' (debe incluir al menos 1 variable).")
  }
  params <- r$params %||% list()

  # Helper para coaccionar params opcionales a NA cuando vengan NULL o
  # de largo 0 — sin esto, `is.na(NULL)` devuelve logical(0) y el `&&`
  # explota con "missing value where TRUE/FALSE needed" antes de que
  # pudiéramos emitir un api_error claro.
  .as_num <- function(x) {
    if (is.null(x) || length(x) == 0L) return(NA_real_)
    suppressWarnings(as.numeric(x))[1]
  }
  .as_date <- function(x) {
    if (is.null(x) || length(x) == 0L) return(as.Date(NA))
    suppressWarnings(as.Date(x))[1]
  }

  # Validaciones por tipo.
  if (tipo == "rango_num") {
    mn <- .as_num(params$min)
    mx <- .as_num(params$max)
    if (is.na(mn) && is.na(mx)) {
      stop_api(400, "E_REGLA_RANGO_VACIO",
               "'rango_num' requiere al menos 'min' o 'max'.")
    }
    if (!is.na(mn) && !is.na(mx) && mn > mx) {
      stop_api(400, "E_REGLA_RANGO_INVERTIDO",
               "En 'rango_num', 'min' no puede ser mayor que 'max'.")
    }
  } else if (tipo == "rango_fecha") {
    mn <- .as_date(params$min)
    mx <- .as_date(params$max)
    if (is.na(mn) && is.na(mx)) {
      stop_api(400, "E_REGLA_RANGO_FECHA_VACIO",
               "'rango_fecha' requiere al menos 'min' o 'max' en formato YYYY-MM-DD.")
    }
  } else if (tipo %in% c("outliers_iqr", "outliers_z")) {
    k <- .as_num(params$k)
    if (is.na(k) || k <= 0) {
      stop_api(400, "E_REGLA_OUTLIERS_K",
               "'outliers_*' requiere 'k' numérico > 0 (IQR: 1.5 típico · Z: 3 típico).")
    }
  } else if (tipo == "fuera_catalogo") {
    vals <- unlist(params$valores %||% list())
    if (!length(vals)) {
      stop_api(400, "E_REGLA_FUERA_CAT_VACIO",
               "'fuera_catalogo' requiere 'valores' (lista no vacía).")
    }
  } else if (tipo == "duplicados") {
    # No requiere params extra — la agrupación usa todas las `variables`.
  } else if (tipo == "coherencia_2v") {
    if (length(vars) < 2L) {
      stop_api(400, "E_REGLA_COHERENCIA_VARS",
               "'coherencia_2v' requiere 2 variables en 'variables'.")
    }
    ox <- as.character(params$op_x %||% "")
    oy <- as.character(params$op_y %||% "")
    if (!(ox %in% .regla_operadores_basicos)) {
      stop_api(400, "E_REGLA_OP_X",
               sprintf("'coherencia_2v': op_x inválido. Válidos: %s",
                        paste(.regla_operadores_basicos, collapse = ", ")))
    }
    if (!(oy %in% .regla_operadores_basicos)) {
      stop_api(400, "E_REGLA_OP_Y",
               sprintf("'coherencia_2v': op_y inválido. Válidos: %s",
                        paste(.regla_operadores_basicos, collapse = ", ")))
    }
    if (is.null(params$valor_x)) {
      stop_api(400, "E_REGLA_VALOR_X", "'coherencia_2v' requiere 'valor_x'.")
    }
    if (is.null(params$valor_y)) {
      stop_api(400, "E_REGLA_VALOR_Y", "'coherencia_2v' requiere 'valor_y'.")
    }
  } else if (tipo == "select_multiple_hierarchy") {
    map <- .transform_normalize_hierarchy_map(params$hierarchy_map %||% params$map %||% NULL)
    if (!length(map)) {
      stop_api(
        400,
        "E_REGLA_SM_HIERARCHY_MAP",
        "'select_multiple_hierarchy' requiere params$hierarchy_map con al menos una opcion."
      )
    }
  } else if (tipo == "select_multiple_exclusive") {
    codes <- .regla_chr_values(params$exclusive_codes %||% params$codes %||% params$valores %||% list())
    if (!length(codes)) {
      stop_api(400, "E_REGLA_SM_EXCLUSIVE_CODES",
               "'select_multiple_exclusive' requiere codigos excluyentes.")
    }
  } else if (tipo == "select_multiple_cardinality") {
    mn <- .as_num(params$min)
    mx <- .as_num(params$max)
    if (is.na(mn) && is.na(mx)) {
      stop_api(400, "E_REGLA_SM_CARDINALITY",
               "'select_multiple_cardinality' requiere al menos min o max.")
    }
    if (!is.na(mn) && !is.na(mx) && mn > mx) {
      stop_api(400, "E_REGLA_SM_CARDINALITY_INVERTIDA",
               "En cardinalidad select_multiple, min no puede ser mayor que max.")
    }
  } else if (tipo == "select_multiple_selection") {
    op <- as.character(params$op %||% params$operator %||% "")
    if (!(op %in% c("contains", "not_contains", "contains_any", "contains_all", "contains_none"))) {
      stop_api(400, "E_REGLA_SM_SELECTION_OP",
               "Operador select_multiple inválido.")
    }
    codes <- .regla_chr_values(params$codes %||% params$valores %||% list())
    if (!length(codes)) {
      stop_api(400, "E_REGLA_SM_SELECTION_CODES",
               "'select_multiple_selection' requiere al menos un código.")
    }
  }
  # `no_nulo` no requiere params adicionales.

  action <- as.character(r$planned_action_type %||% "")
  if (nzchar(action) && !(action %in% .regla_tratamientos)) {
    stop_api(400, "E_REGLA_TRATAMIENTO",
             sprintf("Tratamiento previsto inválido: %s", action))
  }
  scope <- as.character(r$recommended_scope %||% "")
  if (nzchar(scope) && !(scope %in% .regla_alcances_tratamiento)) {
    stop_api(400, "E_REGLA_ALCANCE",
             sprintf("Alcance sugerido inválido: %s", scope))
  }

  # ---- Gate condicional opcional ---------------------------------------
  # Una regla custom puede traer `gate_expr` — una expresión ODK que define
  # cuándo se aplica (ej. "${tiene_hijos} = '1'"). Si no se provee, la regla
  # evalúa siempre.
  if (!is.null(r$gate_conditions) && length(r$gate_conditions)) {
    for (cond in r$gate_conditions) {
      var <- as.character(cond$variable %||% cond$var %||% "")
      op <- as.character(cond$op %||% cond$operator %||% "")
      if (!nzchar(var)) {
        stop_api(400, "E_REGLA_GATE_VAR", "Cada condición debe incluir variable.")
      }
      if (!(op %in% .regla_operadores_gate)) {
        stop_api(400, "E_REGLA_GATE_OP",
                 sprintf("Operador de condición inválido: %s", op))
      }
    }
  } else if (!is.null(r$gate_expr) && nzchar(as.character(r$gate_expr))) {
    gate_raw <- as.character(r$gate_expr)
    ok_gate <- tryCatch({
      .regla_gate_expr_to_r(gate_raw)
      TRUE
    }, error = function(e) FALSE)
    if (!isTRUE(ok_gate) && exists("odk_parse_to_ast", mode = "function", envir = globalenv())) {
      parsed <- tryCatch(odk_parse_to_ast(gate_raw, context = "relevant"),
                         error = function(e) list(degraded_to_raw = TRUE, ast = NULL))
      ok_gate <- !isTRUE(parsed$degraded_to_raw)
    }
    if (!isTRUE(ok_gate)) {
      stop_api(400, "E_REGLA_GATE_INVALIDO",
               sprintf("gate_expr no pudo parsearse: '%s'", gate_raw))
    }
  }

  invisible(TRUE)
}

.regla_chr_values <- function(x) {
  out <- as.character(unlist(x %||% list(), use.names = FALSE))
  out <- out[!is.na(out) & nzchar(trimws(out))]
  unique(trimws(out))
}

# Severidad: "error", "advertencia", "info". Default "error".
.regla_severidad <- function(r) {
  sev <- as.character(r$severidad %||% "error")
  if (!(sev %in% c("error", "advertencia", "info"))) sev <- "error"
  sev
}

.regla_tratamiento <- function(r) {
  action <- as.character(r$planned_action_type %||% "")
  if (!(action %in% .regla_tratamientos)) action <- .regla_tratamiento_default(as.character(r$tipo %||% ""))
  action
}

.regla_alcance_tratamiento <- function(r) {
  scope <- as.character(r$recommended_scope %||% "")
  if (!(scope %in% .regla_alcances_tratamiento)) scope <- .regla_alcance_default(as.character(r$tipo %||% ""))
  scope
}

.regla_tratamiento_default <- function(tipo) {
  switch(as.character(tipo),
    select_multiple_hierarchy = "complete_select_multiple_hierarchy",
    select_multiple_exclusive = "adjust_select_multiple",
    select_multiple_cardinality = "adjust_select_multiple",
    select_multiple_selection = "adjust_select_multiple",
    duplicados = "exclude_cases",
    fuera_catalogo = "recode_map",
    no_nulo = "set_value",
    "ignore_rule"
  )
}

.regla_alcance_default <- function(tipo) {
  switch(as.character(tipo),
    select_multiple_hierarchy = "all",
    fuera_catalogo = "all",
    select_multiple_exclusive = "selected",
    select_multiple_cardinality = "selected",
    select_multiple_selection = "selected",
    duplicados = "selected",
    no_nulo = "selected",
    "single"
  )
}
