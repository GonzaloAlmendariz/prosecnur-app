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

.regla_tipos_soportados <- c(
  "no_nulo", "rango_num", "rango_fecha",
  "outliers_iqr", "outliers_z",
  "duplicados", "fuera_catalogo", "coherencia_2v"
)

.regla_operadores_basicos <- c("==", "!=", ">", ">=", "<", "<=", "in", "not_in")

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
  }
  # `no_nulo` no requiere params adicionales.
  invisible(TRUE)
}

# Severidad: "error", "advertencia", "info". Default "error".
.regla_severidad <- function(r) {
  sev <- as.character(r$severidad %||% "error")
  if (!(sev %in% c("error", "advertencia", "info"))) sev <- "error"
  sev
}
