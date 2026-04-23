# =============================================================================
# Validación AST — Evaluador (Capa 5b)
# =============================================================================
# Aplica reglas (objetos vd_rule) sobre un data.frame y produce:
#   - Columnas flag booleanas (TRUE = inconsistencia) por regla evaluada.
#   - Resumen por regla: n_inconsistencias, porcentaje, estado, issue_code.
#   - Casos observados por regla con keys (UUID/index) para tracking.
#
# Decisiones de diseño:
#   - El evaluador traduce el AST al momento de evaluar — usa el compilador
#     R (Capa 2) pero inyecta bindings especiales como `__today__` antes
#     del eval. No dependen del Procesamiento string.
#   - `collection_date_col` es configurable por llamada. Default: busca
#     `end`, luego `_submission_time`, luego `interviewdate`, luego `today`.
#     Si ninguna existe, `__today__` queda NA y las reglas con
#     collection_date_cmp reportan NA (no violación).
#   - Para repeat_length_matches: el evaluador NO evalúa esta primitiva
#     aquí — requiere acceso a la data multi-tabla. Queda marcada como
#     pendiente (estado "no_evaluada") hasta que se enganche con la capa
#     multi-tabla existente.
#   - Errores de evaluación de una regla no tumban al resto — se registran
#     con estado "incorrecta_ejecucion" y se continúa.

# -----------------------------------------------------------------------------
# API principal
# -----------------------------------------------------------------------------
#' Evalúa un vector de reglas sobre un data.frame.
#'
#' @param rules  list de `vd_rule`.
#' @param data   data.frame con las columnas referenciadas por las reglas.
#' @param collection_date_col nombre de columna con fecha de captura, usada
#'   para resolver `today()` en constraints. Si NULL, se infiere.
#' @param residual_codes   vector de códigos residuales globales (98/99/96…);
#'   cada regla puede sobrescribir con su propio `$residual_codes`.
#' @param strict Si TRUE, errores de evaluación se propagan. Si FALSE
#'   (default), se capturan y reportan en `resumen`.
#' @return list:
#'   - data: data.frame con columnas flag agregadas (TRUE = inconsistencia)
#'   - resumen: tibble con una fila por regla
#'   - logs: list con parses fallidos, rules que cayeron a raw, etc.
#' @param data_multi  lista `list(nombre_tabla = data.frame, ...)` con tablas
#'   adicionales (repeats). Si una regla usa `aggregate_cmp`, referencia a
#'   una tabla aquí. Default list() — reglas cross-tabla quedan NA.
#' @export
evaluate_rules <- function(rules,
                           data,
                           data_multi = list(),
                           collection_date_col = NULL,
                           residual_codes = c("98", "99", "96", "90"),
                           strict = FALSE) {
  if (!length(rules)) {
    return(list(data = data, resumen = .empty_resumen(), logs = list()))
  }
  if (!is.data.frame(data)) {
    stop("evaluate_rules(): `data` debe ser data.frame.")
  }

  # 1. Resolver columna de fecha de captura y construir binding __today__
  col_name <- .resolve_collection_date_col(collection_date_col, data)
  today_vec <- if (!is.null(col_name) && col_name %in% names(data)) {
    suppressWarnings(as.Date(data[[col_name]]))
  } else {
    rep(as.Date(NA), nrow(data))
  }

  # 2. Preparar entorno de evaluación
  eval_env <- new.env(parent = globalenv())
  for (nm in names(data)) assign(nm, data[[nm]], envir = eval_env)
  assign("__today__", today_vec, envir = eval_env)
  # Tablas adicionales (repeats) para aggregate_cmp — si vacío, las reglas
  # que las usen devolverán NA (conservador, no falso-positivo).
  assign("__data_multi__", as.list(data_multi), envir = eval_env)

  # 3. Evaluar regla por regla
  logs <- list()
  resumen_rows <- list()
  for (rule in rules) {
    row_result <- .evaluate_single_rule(rule, eval_env, data, strict)
    # Si la regla produjo vector booleano, lo pegamos como columna a data
    if (!is.null(row_result$flag_vec)) {
      data[[rule$flag_name]] <- row_result$flag_vec
    }
    resumen_rows[[length(resumen_rows) + 1L]] <- row_result$resumen
    if (length(row_result$logs)) {
      logs[[length(logs) + 1L]] <- row_result$logs
    }
  }

  resumen <- .bind_resumen(resumen_rows)
  list(
    data = data,
    resumen = resumen,
    logs = logs,
    collection_date_col = col_name
  )
}

# -----------------------------------------------------------------------------
# Evaluación de una sola regla
# -----------------------------------------------------------------------------
.evaluate_single_rule <- function(rule, eval_env, data, strict) {
  resumen_base <- list(
    id = rule$id,
    nombre = rule$nombre,
    tipo_regla = rule$tipo_regla,
    categoria_ux = rule$categoria_ux,
    severidad = rule$severidad,
    fuente = rule$fuente,
    tabla = rule$tabla %||% "principal",
    seccion = rule$seccion %||% NA_character_,
    flag = rule$flag_name,
    n_filas = nrow(data),
    n_inconsistencias = NA_integer_,
    porcentaje = NA_real_,
    estado = "no_evaluada",
    issue_code = NA_character_,
    detalle = NA_character_
  )

  # 1. Reglas con repeat_length_matches o odk_raw: no evaluables aquí (todavía).
  if (rule$tipo_regla == "repeat_length") {
    resumen_base$estado <- "no_evaluada"
    resumen_base$issue_code <- "repeat_length_pending"
    resumen_base$detalle <- "repeat_length requiere data multi-tabla — pendiente."
    return(list(flag_vec = NULL, resumen = resumen_base, logs = list()))
  }

  # 2. Si el predicate contiene algún odk_raw, marcar como "raw" y omitir.
  has_raw <- .ast_contains_raw(rule$predicate)
  if (has_raw) {
    resumen_base$estado <- "no_evaluada"
    resumen_base$issue_code <- "odk_raw"
    resumen_base$detalle <- "Regla en modo experto — no evaluada automáticamente."
    return(list(flag_vec = NULL, resumen = resumen_base, logs = list()))
  }

  # 3. Verificar que las columnas existan.
  missing_cols <- setdiff(rule$variables, names(data))
  if (length(missing_cols)) {
    resumen_base$estado <- "incorrecta_ejecucion"
    resumen_base$issue_code <- "missing_columns"
    resumen_base$detalle <- sprintf("Columnas ausentes: %s",
                                     paste(missing_cols, collapse = ", "))
    return(list(flag_vec = NULL, resumen = resumen_base, logs = list()))
  }

  # 4. Incorporar gate al predicate (si hay) y compilar.
  effective_pred <- if (is.null(rule$gate)) rule$predicate
                    else ast_normalize(ast_and(rule$gate, rule$predicate))
  rhs <- tryCatch(ast_to_r(effective_pred), error = function(e) e)
  if (inherits(rhs, "error")) {
    resumen_base$estado <- "incorrecta_ejecucion"
    resumen_base$issue_code <- "compile_error"
    resumen_base$detalle <- conditionMessage(rhs)
    if (strict) stop(resumen_base$detalle)
    return(list(flag_vec = NULL, resumen = resumen_base, logs = list()))
  }

  # 5. Parse + eval.
  parsed <- tryCatch(parse(text = rhs), error = function(e) e)
  if (inherits(parsed, "error")) {
    resumen_base$estado <- "incorrecta_ejecucion"
    resumen_base$issue_code <- "parse_error"
    resumen_base$detalle <- conditionMessage(parsed)
    if (strict) stop(resumen_base$detalle)
    return(list(flag_vec = NULL, resumen = resumen_base, logs = list()))
  }

  result <- tryCatch(eval(parsed, envir = eval_env),
                     error = function(e) e)
  if (inherits(result, "error")) {
    resumen_base$estado <- "incorrecta_ejecucion"
    resumen_base$issue_code <- "runtime_error"
    resumen_base$detalle <- conditionMessage(result)
    if (strict) stop(resumen_base$detalle)
    return(list(flag_vec = NULL, resumen = resumen_base, logs = list()))
  }

  # 6. Coerce a booleano del mismo largo que nrow(data)
  flag_vec <- .coerce_flag_vec(result, nrow(data))
  if (is.null(flag_vec)) {
    resumen_base$estado <- "incorrecta_ejecucion"
    resumen_base$issue_code <- "type_mismatch"
    resumen_base$detalle <- sprintf("predicate no produjo vector lógico utilizable (tipo=%s, length=%d)",
                                    typeof(result), length(result))
    return(list(flag_vec = NULL, resumen = resumen_base, logs = list()))
  }

  n_total <- nrow(data)
  n_inc <- sum(flag_vec, na.rm = TRUE)
  resumen_base$estado <- "correcta"
  resumen_base$n_inconsistencias <- as.integer(n_inc)
  resumen_base$porcentaje <- if (n_total > 0L) n_inc / n_total else NA_real_
  list(flag_vec = flag_vec, resumen = resumen_base, logs = list())
}

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
.resolve_collection_date_col <- function(provided, data) {
  if (!is.null(provided) && provided %in% names(data)) return(provided)
  # Heurística por orden de preferencia
  for (cand in c("end", "_submission_time", "interviewdate", "today", "start")) {
    if (cand %in% names(data)) return(cand)
  }
  NULL
}

.ast_contains_raw <- function(x) {
  if (!is_ast(x)) return(FALSE)
  found <- FALSE
  ast_walk(x, function(node, path) {
    if (ast_op(node) == "odk_raw") found <<- TRUE
  })
  found
}

.coerce_flag_vec <- function(result, expected_len) {
  if (is.logical(result)) {
    if (length(result) == expected_len) return(result)
    if (length(result) == 1L) return(rep(result, expected_len))
    return(NULL)
  }
  # Numérico 0/1 aceptable como logical
  if (is.numeric(result)) {
    if (length(result) == expected_len) return(as.logical(result))
    if (length(result) == 1L) return(rep(as.logical(result), expected_len))
    return(NULL)
  }
  NULL
}

.empty_resumen <- function() {
  tibble::tibble(
    id = character(0),
    nombre = character(0),
    tipo_regla = character(0),
    categoria_ux = character(0),
    severidad = character(0),
    fuente = character(0),
    tabla = character(0),
    seccion = character(0),
    flag = character(0),
    n_filas = integer(0),
    n_inconsistencias = integer(0),
    porcentaje = double(0),
    estado = character(0),
    issue_code = character(0),
    detalle = character(0)
  )
}

.bind_resumen <- function(rows) {
  if (!length(rows)) return(.empty_resumen())
  cols_chr <- c("id","nombre","tipo_regla","categoria_ux","severidad","fuente",
                "tabla","seccion","flag","estado","issue_code","detalle")
  cols_int <- c("n_filas","n_inconsistencias")
  cols_dbl <- c("porcentaje")
  take <- function(r, c, default) {
    v <- r[[c]]
    if (is.null(v) || length(v) == 0L) return(default)
    v[1]
  }
  out <- list()
  for (c in cols_chr) {
    out[[c]] <- vapply(rows, function(r) {
      v <- take(r, c, NA)
      if (is.na(v)) NA_character_ else as.character(v)
    }, character(1))
  }
  for (c in cols_int) {
    out[[c]] <- vapply(rows, function(r) {
      v <- take(r, c, NA_integer_)
      suppressWarnings(as.integer(v))
    }, integer(1))
  }
  for (c in cols_dbl) {
    out[[c]] <- vapply(rows, function(r) {
      v <- take(r, c, NA_real_)
      suppressWarnings(as.numeric(v))
    }, numeric(1))
  }
  # Ordenar columnas según el contrato
  all_cols <- c("id","nombre","tipo_regla","categoria_ux","severidad","fuente",
                "tabla","seccion","flag","n_filas","n_inconsistencias",
                "porcentaje","estado","issue_code","detalle")
  tibble::as_tibble(out[all_cols])
}

# -----------------------------------------------------------------------------
# Extraer observaciones (casos específicos que violan cada regla)
# -----------------------------------------------------------------------------
#' Retorna un data.frame con las filas donde una regla dio TRUE, junto con
#' las columnas clave (UUID/index) y las variables de la regla.
#'
#' @param data data.frame retornado por evaluate_rules (tiene las columnas flag).
#' @param rule vd_rule correspondiente.
#' @param key_cols vector de columnas a preservar siempre (`_uuid`, `_index`).
#' @export
observations_for_rule <- function(data, rule, key_cols = c("_uuid", "_id", "_index")) {
  if (!(rule$flag_name %in% names(data))) return(data[0, ])
  flag <- as.logical(data[[rule$flag_name]])
  # NA tratada como no-violación por default
  flag[is.na(flag)] <- FALSE
  hits <- data[flag, , drop = FALSE]
  keep <- unique(c(intersect(key_cols, names(hits)), rule$variables))
  keep <- intersect(keep, names(hits))
  if (!length(keep)) return(hits)
  hits[, keep, drop = FALSE]
}
