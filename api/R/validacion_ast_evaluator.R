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
#     Si ninguna existe, o si la columna resolvió solo NA, las reglas que
#     dependan de `today()` quedan como `no_evaluada` con
#     `issue_code = "missing_collection_date"`.
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
                           strict = FALSE,
                           table_name = "principal",
                           validation_exclusions = list()) {
  if (!length(rules)) {
    return(list(data = data, resumen = .empty_resumen(), logs = list()))
  }
  if (!is.data.frame(data)) {
    stop("evaluate_rules(): `data` debe ser data.frame.")
  }

  # 1. Resolver columna de fecha de captura y construir binding __today__
  col_name <- .resolve_collection_date_col(collection_date_col, data)
  today_vec <- if (!is.null(col_name) && col_name %in% names(data)) {
    .coerce_collection_date_vec(data[[col_name]])
  } else {
    rep(as.Date(NA), nrow(data))
  }
  has_collection_date <- !is.null(col_name) && any(!is.na(today_vec))

  # 2. Preparar entorno de evaluación
  eval_env <- new.env(parent = globalenv())
  for (nm in names(data)) assign(nm, data[[nm]], envir = eval_env)
  assign(".__eval_data__", data, envir = eval_env)
  assign("__today__", today_vec, envir = eval_env)
  assign("sum", .legacy_safe_sum, envir = eval_env)
  assign("mean", .legacy_safe_mean, envir = eval_env)
  assign("min", .legacy_safe_min, envir = eval_env)
  assign("max", .legacy_safe_max, envir = eval_env)
  # Tablas adicionales (repeats) para aggregate_cmp — si vacío, las reglas
  # que las usen devolverán NA (conservador, no falso-positivo).
  assign("__data_multi__", as.list(data_multi), envir = eval_env)
  if (exists(".AGG_prepare", mode = "function") &&
      (length(data_multi) > 1L || !identical(table_name, "principal"))) {
    tablas_ctx <- as.list(data_multi)
    tablas_ctx[[table_name]] <- data
    assign(".AGG_CTX", .AGG_prepare(tablas_ctx, table_name), envir = eval_env)
  }

  # 3. Evaluar regla por regla
  logs <- list()
  resumen_rows <- list()
  for (rule in rules) {
    row_result <- .evaluate_single_rule(
      rule = rule,
      eval_env = eval_env,
      data = data,
      strict = strict,
      collection_date_col = col_name,
      has_collection_date = has_collection_date,
      validation_exclusions = validation_exclusions
    )
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
.evaluate_single_rule <- function(rule,
                                  eval_env,
                                  data,
                                  strict,
                                  collection_date_col = NULL,
                                  has_collection_date = FALSE,
                                  validation_exclusions = list()) {
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

  # 2. Si el predicate contiene odk_raw, permitir solo los origins que ya
  #    vienen bridgeados desde expresiones R del legacy. El resto sigue
  #    siendo modo experto no evaluable.
  raw_origins <- .ast_raw_origins(rule$predicate)
  has_raw <- length(raw_origins) > 0L
  if (has_raw && !all(raw_origins %in% c("legacy_r_expr"))) {
    resumen_base$estado <- "no_evaluada"
    resumen_base$issue_code <- "odk_raw"
    resumen_base$detalle <- "Regla en modo experto — no evaluada automáticamente."
    return(list(flag_vec = NULL, resumen = resumen_base, logs = list()))
  }

  # 3. Verificar que las columnas existan.
  # Una variable ausente en el export de datos NO significa que la regla
  # esté rota — significa que esa columna no aplica a esta base. Marcamos
  # como `no_aplicable` (no propaga error) para:
  #   (a) variable objetivo ausente → no hay nada que checkear.
  #   (b) variable del gate ausente → el gate nunca puede ser TRUE,
  #       así que la regla nunca dispara.
  #   (c) variable de comparación ausente (coherence) → idem.
  # Esto calza con el comportamiento esperado cuando ODK no exporta una
  # columna porque ningún caso activó la rama condicional.
  missing_info <- .rule_missing_columns(rule, names(data))
  missing_cols <- missing_info$all
  if (length(missing_cols)) {
    # Rescate para select_multiple exportado en columnas dummy:
    # SurveyMonkey (y otros exports) descomponen la pregunta canónica
    # `q0007` en columnas binarias `q0007_0001`, `q0007_0002`, ...
    # Si la regla es `required` sobre el target ausente y encontramos
    # esas dummies, reescribimos el predicate como "todas las dummies
    # están vacías" en vez de marcar la regla como no_aplicable. Sin
    # este rescate, todas las preguntas select_multiple required de
    # encuestas SM se reportaban como "no aplica" — falsos negativos.
    rescue <- .try_rescue_select_multiple(rule, missing_info, names(data))
    if (!is.null(rescue)) {
      rule <- rescue$rule
      resumen_base$detalle <- rescue$note
    } else {
      resumen_base$estado <- "no_aplicable"
      resumen_base$issue_code <- "missing_columns"
      resumen_base$detalle <- .format_missing_columns_detail(missing_info)
      resumen_base$n_inconsistencias <- 0L
      resumen_base$porcentaje <- 0
      return(list(flag_vec = NULL, resumen = resumen_base, logs = list()))
    }
  }

  # 3c. Guardrail de dominio: si la regla compara una columna bien poblada
  #     contra un valor constante ausente en sus datos observados, con
  #     incompatibilidad de tipo (texto vs numérico), es casi seguro un desfase
  #     entre la versión del instrumento que generó la regla y los datos. El gate
  #     nunca se cumpliría y las reglas de salto dispararían en falso sobre toda
  #     la base. No la contamos como inconsistencia: la marcamos `desalineada`
  #     para que sea una alerta visible y accionable, no un falso positivo mudo.
  domain_mismatch <- .rule_domain_mismatch(rule, data)
  if (!is.null(domain_mismatch)) {
    resumen_base$estado <- "desalineada"
    resumen_base$issue_code <- "domain_mismatch"
    resumen_base$n_inconsistencias <- 0L
    resumen_base$porcentaje <- 0
    resumen_base$detalle <- sprintf(
      paste0("La regla compara «%s» con el valor «%s», que no aparece en los datos ",
             "(valores observados: %s). Probable desfase entre la versión del ",
             "instrumento y los datos; no se contabiliza para evitar falsos positivos."),
      domain_mismatch$var, domain_mismatch$expected, domain_mismatch$observed_sample
    )
    return(list(flag_vec = NULL, resumen = resumen_base, logs = list()))
  }

  # 3b. Reglas que dependen de today() requieren fecha de captura usable.
  if (.rule_requires_collection_date(rule) && !isTRUE(has_collection_date)) {
    resumen_base$estado <- "no_evaluada"
    resumen_base$issue_code <- "missing_collection_date"
    resumen_base$detalle <- .format_missing_collection_date_detail(collection_date_col)
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

  exclusion <- .validation_exclusion_mask_for_rule(rule, data, validation_exclusions)
  excluded_n <- sum(exclusion$mask, na.rm = TRUE)
  if (excluded_n > 0L) {
    flag_vec[exclusion$mask] <- FALSE
    note <- sprintf(
      "%d filas excluidas por perfil %s.",
      as.integer(excluded_n),
      paste(exclusion$profiles, collapse = ", ")
    )
    if (length(exclusion$vars)) {
      note <- paste0(note, " Variables: ", paste(exclusion$vars, collapse = ", "), ".")
    }
    old_detail <- as.character(resumen_base$detalle %||% "")
    resumen_base$detalle <- if (nzchar(old_detail) && !is.na(old_detail)) {
      paste(old_detail, note)
    } else {
      note
    }
  }

  n_total <- nrow(data)
  n_inc <- sum(flag_vec, na.rm = TRUE)
  resumen_base$estado <- "correcta"
  resumen_base$n_inconsistencias <- as.integer(n_inc)
  resumen_base$porcentaje <- if (n_total > 0L) n_inc / n_total else NA_real_
  list(flag_vec = flag_vec, resumen = resumen_base, logs = list())
}

.validation_chr_vec <- function(x) {
  if (is.null(x)) return(character(0))
  if (is.data.frame(x)) x <- as.list(x)
  if (is.list(x) && is.null(names(x))) {
    x <- unlist(x, use.names = FALSE)
  }
  vals <- trimws(as.character(x %||% character(0)))
  vals[!is.na(vals) & nzchar(vals)]
}

.validation_exclusion_records <- function(validation_exclusions) {
  if (is.null(validation_exclusions)) return(list())
  if (is.data.frame(validation_exclusions)) {
    return(lapply(seq_len(nrow(validation_exclusions)), function(i) as.list(validation_exclusions[i, , drop = FALSE])))
  }
  if (is.list(validation_exclusions) &&
      length(validation_exclusions) &&
      all(vapply(validation_exclusions, function(x) is.list(x) && !is.data.frame(x), logical(1)))) {
    return(validation_exclusions)
  }
  list()
}

.validation_exclusion_vars <- function(record) {
  vars <- .validation_chr_vec(record$excluded_validation_vars %||%
                                record$excluded_vars %||%
                                record$variables %||%
                                record$vars)
  unique(vars)
}

.validation_rule_target_vars <- function(rule) {
  roles <- rule$variable_roles %||% list()
  vars <- .validation_chr_vec(roles$target %||% rule$primary_var %||% rule$variables)
  unique(vars)
}

.validation_record_row_mask <- function(record, data) {
  n <- nrow(data)
  if (!n) return(logical(0))
  mask <- rep(TRUE, n)
  criteria <- 0L

  survey_id <- .validation_chr_vec(record$survey_id)
  if (length(survey_id) && "survey_id" %in% names(data)) {
    criteria <- criteria + 1L
    mask <- mask & as.character(data$survey_id %||% "") %in% survey_id
  }

  collector_ids <- .validation_chr_vec(record$collector_ids %||% record$collector_id)
  if (length(collector_ids) && "collector_id" %in% names(data)) {
    criteria <- criteria + 1L
    mask <- mask & as.character(data$collector_id %||% "") %in% collector_ids
  }

  source_titles <- .validation_chr_vec(record$source_title %||% record$source_titles)
  if (length(source_titles) && "source_title" %in% names(data)) {
    criteria <- criteria + 1L
    mask <- mask & as.character(data$source_title %||% "") %in% source_titles
  }

  source_aliases <- .validation_chr_vec(record$source_alias %||% record$source_aliases)
  if (length(source_aliases) && "source_alias" %in% names(data)) {
    criteria <- criteria + 1L
    mask <- mask & as.character(data$source_alias %||% "") %in% source_aliases
  }

  if (criteria == 0L) rep(FALSE, n) else mask
}

.validation_exclusion_mask_for_rule <- function(rule, data, validation_exclusions = list()) {
  out <- rep(FALSE, nrow(data))
  target_vars <- .validation_rule_target_vars(rule)
  if (!length(target_vars) || !nrow(data)) {
    return(list(mask = out, profiles = character(0), vars = character(0)))
  }

  profiles <- character(0)
  vars_hit <- character(0)
  for (record in .validation_exclusion_records(validation_exclusions)) {
    excluded_vars <- .validation_exclusion_vars(record)
    hit_vars <- intersect(target_vars, excluded_vars)
    if (!length(hit_vars)) next
    mask <- .validation_record_row_mask(record, data)
    if (!any(mask, na.rm = TRUE)) next
    out <- out | mask
    vars_hit <- unique(c(vars_hit, hit_vars))
    profile <- as.character(record$validation_exclusion_profile %||% record$profile %||% "exclusion")
    profile <- profile[!is.na(profile) & nzchar(profile)]
    profiles <- unique(c(profiles, profile %||% "exclusion"))
  }
  list(
    mask = out,
    profiles = if (length(profiles)) profiles else character(0),
    vars = vars_hit
  )
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

.coerce_collection_date_vec <- function(x) {
  if (inherits(x, "Date")) return(as.Date(x))
  if (inherits(x, c("POSIXct", "POSIXlt"))) return(as.Date(x))

  if (is.numeric(x)) {
    out <- suppressWarnings(as.Date(x, origin = "1899-12-30"))
    return(out)
  }

  vals <- trimws(as.character(x))
  vals[!nzchar(vals) | vals %in% c("NA", "NULL", "NaN")] <- NA_character_
  out <- rep(as.Date(NA), length(vals))

  # Primera pasada ISO (as.Date por default) — R reciente ERRA (no warn) en
  # strings no-ISO, por eso `tryCatch` blindado.
  rem <- is.na(out) & !is.na(vals)
  if (any(rem)) {
    iso_ymd <- sub("^([0-9]{4}-[0-9]{2}-[0-9]{2}).*$", "\\1", vals[rem], perl = TRUE)
    hit <- grepl("^[0-9]{4}-[0-9]{2}-[0-9]{2}$", iso_ymd)
    idx <- which(rem)[hit]
    parsed <- tryCatch(as.Date(iso_ymd[hit]),
                       error = function(e) rep(as.Date(NA), length(iso_ymd[hit])))
    out[idx] <- parsed
  }

  # Pasada Excel serial numbers (strings numéricos representando días desde
  # 1899-12-30). Común cuando el XLSX fue leído como texto.
  rem <- is.na(out) & !is.na(vals)
  if (any(rem)) {
    excel_num <- grepl("^[0-9]+(\\.[0-9]+)?$", vals[rem])
    idx <- which(rem)[excel_num]
    nums <- suppressWarnings(as.numeric(vals[rem][excel_num]))
    # Rango razonable: entre 1990 (32874) y 2080 (65754) evita confundir
    # enteros tipo "20" o "1999" con fechas genuinas.
    safe <- !is.na(nums) & nums >= 20000 & nums <= 80000
    out[idx[safe]] <- as.Date(nums[safe], origin = "1899-12-30")
  }

  rem <- is.na(out) & !is.na(vals)
  if (any(rem)) {
    ymd_slash <- sub("^([0-9]{4}/[0-9]{2}/[0-9]{2}).*$", "\\1", vals[rem], perl = TRUE)
    hit <- grepl("^[0-9]{4}/[0-9]{2}/[0-9]{2}$", ymd_slash)
    idx <- which(rem)[hit]
    out[idx] <- suppressWarnings(as.Date(ymd_slash[hit], format = "%Y/%m/%d"))
  }

  rem <- is.na(out) & !is.na(vals)
  if (any(rem)) {
    dmy_slash <- sub("^([0-9]{2}/[0-9]{2}/[0-9]{4}).*$", "\\1", vals[rem], perl = TRUE)
    hit <- grepl("^[0-9]{2}/[0-9]{2}/[0-9]{4}$", dmy_slash)
    idx <- which(rem)[hit]
    out[idx] <- suppressWarnings(as.Date(dmy_slash[hit], format = "%d/%m/%Y"))
  }

  rem <- is.na(out) & !is.na(vals)
  if (any(rem)) {
    posix <- suppressWarnings(as.POSIXct(
      vals[rem],
      tz = "UTC",
      tryFormats = c(
        "%Y-%m-%d %H:%M:%OS",
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%OS",
        "%Y/%m/%d %H:%M:%S",
        "%d/%m/%Y %H:%M:%OS",
        "%d/%m/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M:%OS",
        "%m/%d/%Y %H:%M:%S"
      )
    ))
    idx <- which(rem)
    out[idx] <- suppressWarnings(as.Date(posix))
  }

  out
}

.ast_contains_raw <- function(x) {
  if (!is_ast(x)) return(FALSE)
  found <- FALSE
  ast_walk(x, function(node, path) {
    if (ast_op(node) == "odk_raw") found <<- TRUE
  })
  found
}

.ast_raw_origins <- function(x) {
  if (!is_ast(x)) return(character(0))
  out <- character(0)
  ast_walk(x, function(node, path) {
    if (ast_op(node) == "odk_raw") {
      out <<- c(out, as.character(node$origin %||% "raw"))
    }
  })
  unique(out)
}

.ast_uses_collection_date <- function(x) {
  if (!is_ast(x)) return(FALSE)
  found <- FALSE
  ast_walk(x, function(node, path) {
    op <- ast_op(node)
    if (op %in% c("collection_date_cmp", "collection_date_offset_cmp")) {
      found <<- TRUE
    }
  })
  found
}

.rule_requires_collection_date <- function(rule) {
  .ast_uses_collection_date(rule$predicate) || .ast_uses_collection_date(rule$gate)
}

.format_missing_collection_date_detail <- function(collection_date_col = NULL) {
  base <- paste(
    "La regla requiere fecha de captura para resolver today()",
    "(end, _submission_time, interviewdate, today o start)."
  )
  if (!is.null(collection_date_col) && nzchar(as.character(collection_date_col))) {
    paste0(base, " La columna resuelta fue '", as.character(collection_date_col), "', pero no tuvo valores de fecha utilizables.")
  } else {
    base
  }
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

.role_missing_subset <- function(x, data_names) {
  vals <- as.character(x %||% character(0))
  vals <- vals[!is.na(vals) & nzchar(vals)]
  setdiff(unique(vals), data_names)
}

.rule_missing_columns <- function(rule, data_names) {
  roles <- rule$variable_roles %||% list()
  target <- .role_missing_subset(roles$target, data_names)
  compare <- .role_missing_subset(roles$compare, data_names)
  gate <- .role_missing_subset(roles$gate, data_names)
  drivers <- .role_missing_subset(roles$drivers, data_names)
  all <- unique(c(target, compare, gate, drivers, setdiff(rule$variables %||% character(0), data_names)))

  # Las preguntas select_multiple pueden no existir como variable madre si el
  # export trae solo dummies (p7.1, p7.2...). En ese caso no son "missing":
  # los compiladores de selected/count usan helpers que leen esas dummies.
  dummy_backed <- all[vapply(all, function(v) length(.find_select_multiple_dummies(v, data_names)) > 0L, logical(1))]
  if (length(dummy_backed)) {
    target <- setdiff(target, dummy_backed)
    compare <- setdiff(compare, dummy_backed)
    gate <- setdiff(gate, dummy_backed)
    drivers <- setdiff(drivers, dummy_backed)
    all <- setdiff(all, dummy_backed)
  }

  list(
    target = target,
    compare = compare,
    gate = gate,
    drivers = drivers,
    all = all
  )
}

# Detecta columnas dummy de un select_multiple exportado por SM/ODK.
# Convenciones soportadas (cualquiera de estas, en orden):
#   q0007_0001, q0007_0002, ...   (SAV de SurveyMonkey, padding 4)
#   q0007_1, q0007_2, ...         (ODK clásico)
#   q0007/1, q0007/2, ...         (ODK con slash)
#   q0007.opt1, q0007.opt2, ...   (xlsx custom con punto)
# Devuelve `character(0)` si no encuentra ninguna.
.find_select_multiple_dummies <- function(target, data_names) {
  if (!nzchar(target)) return(character(0))
  pat <- sprintf("^%s[_/.][^_/.]+$", gsub("([.+*?^$()\\[\\]])", "\\\\\\1", target))
  matches <- data_names[grepl(pat, data_names)]
  # Filtrar columnas tipo "_other" o "_specify" que NO son opciones marcables
  # sino texto libre asociado.
  matches <- matches[!grepl("_(other|specify|otro|texto)$", matches, ignore.case = TRUE)]
  matches
}

# Si el target del rule falta pero hay dummies de select_multiple, devuelve
# una versión del rule con el predicate reescrito como "todas las dummies
# están vacías" (= violación de required: el respondiente no marcó nada).
# Devuelve NULL si no aplica el rescate.
.try_rescue_select_multiple <- function(rule, missing_info, data_names) {
  if (!identical(rule$tipo_regla, "required")) return(NULL)
  # Solo aplica si lo único que falta es el target.
  if (length(missing_info$compare) > 0L ||
      length(missing_info$gate) > 0L ||
      length(missing_info$drivers) > 0L) {
    return(NULL)
  }
  if (length(missing_info$target) != 1L) return(NULL)
  target <- missing_info$target[1]
  dummies <- .find_select_multiple_dummies(target, data_names)
  if (!length(dummies)) return(NULL)

  # Fallback legacy: la carga nueva normaliza estas dummies antes de llegar al
  # evaluador. Si aun asi entra data vieja no normalizada, required se viola
  # solo cuando ninguna dummy esta marcada como 1. NA, vacio y 0 cuentan como
  # "no seleccionada".
  preds <- lapply(dummies, function(d) ast_not(ast_compare_const(d, "==", 1)))
  pred <- if (length(preds) == 1L) preds[[1]] else do.call(ast_and, preds)
  rule$predicate <- pred
  # Actualizar variable_roles para que el resto del pipeline (drill, etc.)
  # sepa que ahora estamos validando las dummies, no el canónico.
  if (!is.null(rule$variable_roles)) {
    rule$variable_roles$target <- dummies
    rule$variable_roles$all <- unique(c(dummies,
                                         rule$variable_roles$compare %||% character(0),
                                         rule$variable_roles$gate %||% character(0),
                                         rule$variable_roles$drivers %||% character(0)))
  }
  rule$variables <- unique(c(dummies, rule$variables %||% character(0)))
  list(
    rule = rule,
    note = sprintf("Pregunta select_multiple validada contra %d columnas dummy: %s.",
                   length(dummies),
                   paste(utils::head(dummies, 6), collapse = ", "))
  )
}

.format_missing_columns_detail <- function(missing_info) {
  parts <- character(0)
  if (length(missing_info$target)) {
    parts <- c(parts, sprintf("objetivo: %s", paste(missing_info$target, collapse = ", ")))
  }
  if (length(missing_info$compare)) {
    parts <- c(parts, sprintf("comparación: %s", paste(missing_info$compare, collapse = ", ")))
  }
  if (length(missing_info$drivers)) {
    parts <- c(parts, sprintf("drivers: %s", paste(missing_info$drivers, collapse = ", ")))
  }
  if (length(missing_info$gate)) {
    parts <- c(parts, sprintf("gate: %s", paste(missing_info$gate, collapse = ", ")))
  }
  if (!length(parts)) {
    parts <- sprintf("Columnas ausentes: %s", paste(missing_info$all, collapse = ", "))
  }
  paste(c(
    sprintf("Columnas ausentes: %s", paste(missing_info$all, collapse = ", ")),
    parts
  ), collapse = " | ")
}

# -----------------------------------------------------------------------------
# Guardrail de dominio: detecta reglas cuyo gate/predicado comparan una columna
# contra un valor constante que NO existe en el dominio observado de esa columna,
# con una incompatibilidad de TIPO (texto vs numérico). Ese patrón es la firma de
# un desfase de versión entre el instrumento con el que se generó la regla y los
# datos (p.ej. una regla `consent == 'OK'` — codificación `acknowledge` de una
# versión vieja — evaluada sobre datos donde `consent` es 1/0). Sin este chequeo,
# el gate nunca se cumple y las reglas de salto disparan en falso sobre toda la
# base. Marcamos la regla como `desalineada` y NO la contamos como inconsistencia.
# -----------------------------------------------------------------------------

# Recolecta literales de igualdad/pertenencia POSITIVA (col == v, selected,
# any_selected, in_set) de un AST. Devuelve lista de list(var=, values=).
.ast_positive_equality_literals <- function(node) {
  acc <- list()
  if (is.null(node) || !is_ast(node)) return(acc)
  ast_walk(node, function(n, path) {
    op <- ast_op(n)
    if (identical(op, "compare_const")) {
      if (identical(as.character(ast_arg(n, "op")), "==")) {
        acc[[length(acc) + 1L]] <<- list(var = as.character(ast_arg(n, "var")),
                                         values = as.character(ast_arg(n, "value")))
      }
    } else if (identical(op, "selected")) {
      acc[[length(acc) + 1L]] <<- list(var = as.character(ast_arg(n, "var")),
                                       values = as.character(ast_arg(n, "value")))
    } else if (op %in% c("any_selected", "in_set")) {
      acc[[length(acc) + 1L]] <<- list(var = as.character(ast_arg(n, "var")),
                                       values = as.character(ast_arg(n, "values")))
    }
  })
  acc
}

# TRUE si al menos `frac` de los valores no vacíos parsean como numérico.
.vec_mostly_numeric <- function(x, frac = 0.9) {
  x <- x[!is.na(x) & nzchar(x)]
  if (!length(x)) return(FALSE)
  mean(!is.na(suppressWarnings(as.numeric(x)))) >= frac
}

# Devuelve NULL si la regla está alineada; si no, un descriptor del desajuste.
.rule_domain_mismatch <- function(rule, data, min_obs = 20L, min_frac = 0.05) {
  literals <- c(.ast_positive_equality_literals(rule$gate),
                .ast_positive_equality_literals(rule$predicate))
  if (!length(literals)) return(NULL)
  n <- nrow(data)
  threshold <- max(as.integer(min_obs), as.integer(ceiling(min_frac * n)))
  for (lit in literals) {
    col <- lit$var
    if (length(col) != 1L || is.na(col) || !nzchar(col) || !(col %in% names(data))) next
    obs <- trimws(as.character(data[[col]]))
    obs <- obs[!is.na(obs) & nzchar(obs) & obs != "NA"]
    if (length(obs) < threshold) next            # columna poco poblada → no opinar
    dom <- unique(obs)
    dom_numeric <- .vec_mostly_numeric(obs)
    for (val in lit$values) {
      v <- trimws(as.character(val))
      if (!nzchar(v) || v == "NA") next          # centinelas de vacío, no códigos
      if (v %in% dom) next                        # el valor sí aparece → alineada
      val_numeric <- !is.na(suppressWarnings(as.numeric(v)))
      # Solo marcamos cuando hay incompatibilidad de TIPO (texto vs numérico):
      # esa es la firma inequívoca de desfase de codificación, y evita marcar
      # códigos válidos que simplemente no tienen casos (p.ej. `q == '98'`).
      type_mismatch <- (!val_numeric && dom_numeric) || (val_numeric && !dom_numeric)
      if (!type_mismatch) next
      return(list(
        var = col,
        expected = v,
        observed_sample = paste(utils::head(sort(dom), 6L), collapse = ", "),
        n_obs = length(obs)
      ))
    }
  }
  NULL
}

.legacy_numeric_coerce <- function(x) {
  if (is.factor(x)) x <- as.character(x)
  if (is.character(x)) return(suppressWarnings(as.numeric(x)))
  x
}

.legacy_safe_sum <- function(..., na.rm = FALSE) {
  args <- lapply(list(...), .legacy_numeric_coerce)
  do.call(base::sum, c(args, list(na.rm = na.rm)))
}

.legacy_safe_mean <- function(..., na.rm = FALSE) {
  args <- lapply(list(...), .legacy_numeric_coerce)
  do.call(base::mean, c(args, list(na.rm = na.rm)))
}

.legacy_safe_min <- function(..., na.rm = FALSE) {
  args <- lapply(list(...), .legacy_numeric_coerce)
  do.call(base::min, c(args, list(na.rm = na.rm)))
}

.legacy_safe_max <- function(..., na.rm = FALSE) {
  args <- lapply(list(...), .legacy_numeric_coerce)
  do.call(base::max, c(args, list(na.rm = na.rm)))
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
#' las columnas clave (UUID/respondent_id/index) y las variables de la regla.
#'
#' @param data data.frame retornado por evaluate_rules (tiene las columnas flag).
#' @param rule vd_rule correspondiente.
#' @param key_cols vector de columnas a preservar siempre (`_uuid`, `respondent_id`, `_index`).
#' @export
observations_for_rule <- function(data, rule, key_cols = c("_uuid", "uuid", "respondent_id", "response_id", "_id", "_index")) {
  if (!(rule$flag_name %in% names(data))) return(data[0, ])
  flag <- as.logical(data[[rule$flag_name]])
  # NA tratada como no-violación por default
  flag[is.na(flag)] <- FALSE
  hits <- data[flag, , drop = FALSE]
  keep <- unique(c(
    intersect(key_cols, names(hits)),
    rule$variable_roles$target %||% character(0),
    rule$variable_roles$drivers %||% character(0),
    rule$variable_roles$compare %||% character(0),
    rule$variable_roles$gate %||% character(0),
    rule$variables
  ))
  keep <- intersect(keep, names(hits))
  if (!length(keep)) return(hits)
  hits[, keep, drop = FALSE]
}
