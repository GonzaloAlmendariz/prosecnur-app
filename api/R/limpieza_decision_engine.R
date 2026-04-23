# =============================================================================
# Limpieza y normalización — decision maker y cierre de la base
# =============================================================================

.limpieza_now_utc <- function() {
  format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
}

.limpieza_register_download <- function(sid, kind, original_name, path, ext = NULL) {
  s <- session_get(sid)
  file_id <- uuid::UUIDgenerate()
  meta <- list(
    file_id = file_id,
    kind = kind,
    original_name = original_name,
    path = path,
    size = as.integer(file.info(path)$size %||% 0L),
    ext = ext %||% tolower(tools::file_ext(original_name %||% path)),
    uploaded_at = .limpieza_now_utc()
  )
  files <- s$files
  files[[file_id]] <- meta
  session_set(sid, "files", files)
  meta
}

.limpieza_uuid_candidates <- function() {
  c("_uuid", "uuid", "_id", "_submission_id", "_submission_uuid", "id_caso", "fila_id")
}

.limpieza_make_case_ids <- function(df, table_key = "principal") {
  if (!is.data.frame(df) || !nrow(df)) return(character(0))

  for (cand in .limpieza_uuid_candidates()) {
    if (cand %in% names(df)) {
      ids <- as.character(df[[cand]])
      ok <- !is.na(ids) & nzchar(ids)
      if (any(ok)) {
        fallback <- sprintf("%s::row::%d", table_key, seq_len(nrow(df)))
        ids[!ok] <- fallback[!ok]
        return(ids)
      }
    }
  }

  if ("_index" %in% names(df)) {
    idx <- suppressWarnings(as.integer(df[["_index"]]))
    idx[is.na(idx)] <- seq_len(nrow(df))[is.na(idx)]
    return(sprintf("%s::idx::%d", table_key, idx))
  }

  sprintf("%s::row::%d", table_key, seq_len(nrow(df)))
}

.limpieza_cast_like <- function(value, col) {
  if (is.null(value) || (length(value) == 1L && is.na(value))) return(NA)
  if (inherits(col, "Date")) return(suppressWarnings(as.Date(value)))
  if (inherits(col, c("POSIXct", "POSIXlt", "POSIXt"))) {
    return(suppressWarnings(as.POSIXct(value, tz = "UTC")))
  }
  if (inherits(col, c("haven_labelled", "haven_labelled_spss")) || is.numeric(col)) {
    return(suppressWarnings(as.numeric(value)))
  }
  if (is.integer(col)) return(suppressWarnings(as.integer(value)))
  if (is.logical(col)) return(as.logical(value))
  as.character(value)
}

.limpieza_mode_value <- function(x) {
  vals <- x[!is.na(x) & nzchar(trimws(as.character(x)))]
  if (!length(vals)) return(NA)
  tb <- sort(table(as.character(vals)), decreasing = TRUE)
  names(tb)[1]
}

.limpieza_flatten_decisions <- function(decisions) {
  if (!length(decisions)) {
    return(tibble::tibble(
      id = character(),
      source_type = character(),
      source_id = character(),
      scope = character(),
      target_case_ids = character(),
      target_variable = character(),
      action_type = character(),
      action_params = character(),
      rationale = character(),
      status = character(),
      created_at = character(),
      updated_at = character()
    ))
  }

  tibble::tibble(
    id = vapply(decisions, function(d) as.character(d$id %||% ""), character(1)),
    source_type = vapply(decisions, function(d) as.character(d$source_type %||% ""), character(1)),
    source_id = vapply(decisions, function(d) as.character(d$source_id %||% ""), character(1)),
    scope = vapply(decisions, function(d) as.character(d$scope %||% ""), character(1)),
    target_case_ids = vapply(decisions, function(d) paste(unlist(d$target_case_ids %||% list()), collapse = ", "), character(1)),
    target_variable = vapply(decisions, function(d) as.character(d$target_variable %||% ""), character(1)),
    action_type = vapply(decisions, function(d) as.character(d$action_type %||% ""), character(1)),
    action_params = vapply(decisions, function(d) jsonlite::toJSON(d$action_params %||% list(), auto_unbox = TRUE, null = "null"), character(1)),
    rationale = vapply(decisions, function(d) as.character(d$rationale %||% ""), character(1)),
    status = vapply(decisions, function(d) as.character(d$status %||% ""), character(1)),
    created_at = vapply(decisions, function(d) as.character(d$created_at %||% ""), character(1)),
    updated_at = vapply(decisions, function(d) as.character(d$updated_at %||% ""), character(1))
  )
}

.limpieza_infer_source_type <- function(source_id) {
  id <- as.character(source_id %||% "")
  if (grepl("^RC_", id)) "custom_rule" else "instrument_rule"
}

.limpieza_validate_decision <- function(payload) {
  allowed_source <- c("instrument_rule", "custom_rule")
  allowed_scope <- c("rule", "case_subset", "variable", "cell_subset")
  allowed_action <- c("ignore_rule", "exclude_cases", "replace_value", "normalize_value", "impute_value")
  allowed_status <- c("draft", "ready")

  source_id <- as.character(payload$source_id %||% "")
  if (!nzchar(source_id)) {
    stop_api(400, "E_LIMPIEZA_SOURCE_ID", "La decisión debe incluir source_id.")
  }
  source_type <- as.character(payload$source_type %||% .limpieza_infer_source_type(source_id))
  if (!(source_type %in% allowed_source)) {
    stop_api(400, "E_LIMPIEZA_SOURCE_TYPE", "source_type inválido.")
  }
  action_type <- as.character(payload$action_type %||% "")
  if (!(action_type %in% allowed_action)) {
    stop_api(400, "E_LIMPIEZA_ACTION", "action_type inválido.")
  }
  scope <- as.character(payload$scope %||% if (identical(action_type, "ignore_rule")) "rule" else "case_subset")
  if (!(scope %in% allowed_scope)) {
    stop_api(400, "E_LIMPIEZA_SCOPE", "scope inválido.")
  }
  status <- as.character(payload$status %||% "draft")
  if (!(status %in% allowed_status)) {
    stop_api(400, "E_LIMPIEZA_STATUS", "status inválido.")
  }

  target_case_ids <- unique(as.character(unlist(payload$target_case_ids %||% list())))
  target_case_ids <- target_case_ids[!is.na(target_case_ids) & nzchar(target_case_ids)]
  target_variable <- as.character(payload$target_variable %||% NA_character_)
  if (!nzchar(target_variable)) target_variable <- NA_character_

  action_params <- payload$action_params %||% list()
  rationale <- trimws(as.character(payload$rationale %||% ""))
  if (identical(status, "ready") && !nzchar(rationale)) {
    stop_api(400, "E_LIMPIEZA_RATIONALE", "Las decisiones listas requieren justificación.")
  }
  if (action_type %in% c("replace_value", "normalize_value", "impute_value") &&
      (is.na(target_variable) || !nzchar(target_variable))) {
    stop_api(400, "E_LIMPIEZA_TARGET_VAR", "Esta acción requiere target_variable.")
  }

  list(
    id = as.character(payload$id %||% ""),
    source_type = source_type,
    source_id = source_id,
    scope = scope,
    target_case_ids = as.list(target_case_ids),
    target_variable = target_variable,
    action_type = action_type,
    action_params = action_params,
    rationale = rationale,
    status = status
  )
}

.limpieza_upsert_decision <- function(existing, payload) {
  now <- .limpieza_now_utc()
  normalized <- .limpieza_validate_decision(payload)
  decisions <- existing %||% list()

  idx <- integer(0)
  if (nzchar(normalized$id)) {
    idx <- which(vapply(decisions, function(d) identical(as.character(d$id %||% ""), normalized$id), logical(1)))
  }

  if (length(idx)) {
    current <- decisions[[idx[1]]]
    normalized$created_at <- current$created_at %||% now
    normalized$updated_at <- now
    decisions[[idx[1]]] <- normalized
    return(list(decisions = decisions, decision = normalized))
  }

  normalized$id <- if (nzchar(normalized$id)) normalized$id else sprintf("PD_%03d", length(decisions) + 1L)
  normalized$created_at <- now
  normalized$updated_at <- now
  decisions[[length(decisions) + 1L]] <- normalized
  list(decisions = decisions, decision = normalized)
}

.limpieza_delete_decision <- function(existing, id) {
  id <- as.character(id %||% "")
  kept <- Filter(function(d) !identical(as.character(d$id %||% ""), id), existing %||% list())
  if (length(kept) == length(existing %||% list())) {
    stop_api(404, "E_LIMPIEZA_DECISION_NOT_FOUND", sprintf("No existe la decisión '%s'.", id))
  }
  kept
}

.limpieza_rule_case_map <- function(evaluacion, source_id) {
  res <- evaluacion$resumen %||% NULL
  if (is.null(res) || !nrow(res)) {
    return(list(table = "principal", flag = NA_character_, row_idx = integer(0), case_ids = character(0)))
  }
  idx <- which(as.character(res$id_regla) == as.character(source_id))[1]
  if (is.na(idx)) {
    return(list(table = "principal", flag = NA_character_, row_idx = integer(0), case_ids = character(0)))
  }
  tabla <- as.character(res$tabla[idx] %||% "principal")
  flag <- as.character(res$flag[idx] %||% NA_character_)
  df <- evaluacion$datos_tablas[[tabla]] %||% evaluacion$datos
  if (!is.data.frame(df) || !nzchar(flag) || !(flag %in% names(df))) {
    return(list(table = tabla, flag = flag, row_idx = integer(0), case_ids = character(0)))
  }
  mask <- df[[flag]]
  mask[is.na(mask)] <- FALSE
  idx_rows <- which(mask)
  list(
    table = tabla,
    flag = flag,
    row_idx = idx_rows,
    case_ids = .limpieza_make_case_ids(df, tabla)[idx_rows]
  )
}

.limpieza_rule_catalog <- function(scope) {
  ev <- scope$evaluacion
  if (is.null(ev) || is.null(ev$resumen) || !nrow(ev$resumen)) return(tibble::tibble())

  res <- ev$resumen
  meta <- ev$reglas_meta %||% tibble::tibble(id_regla = character())
  catalog <- dplyr::left_join(res, meta, by = c("id_regla", "nombre_regla", "tabla"))

  catalog$source_type <- vapply(catalog$id_regla, .limpieza_infer_source_type, character(1))
  catalog$origen <- ifelse(catalog$source_type == "custom_rule", "Personalizada", "Automática")

  sev_map <- setNames(
    vapply(scope$reglas_custom %||% list(), function(r) as.character(r$severidad %||% "info"), character(1)),
    vapply(scope$reglas_custom %||% list(), function(r) as.character(r$id %||% ""), character(1))
  )
  catalog$severidad <- vapply(seq_len(nrow(catalog)), function(i) {
    rid <- as.character(catalog$id_regla[i])
    if (rid %in% names(sev_map)) return(unname(sev_map[[rid]]))
    pct <- suppressWarnings(as.numeric(catalog$porcentaje[i] %||% 0))
    if (is.finite(pct) && pct >= 0.20) return("error")
    if (is.finite(pct) && pct > 0) return("advertencia")
    "info"
  }, character(1))

  catalog$variables <- lapply(seq_len(nrow(catalog)), function(i) {
    vars <- c(
      as.character(catalog$variable_1[i] %||% NA),
      as.character(catalog$variable_2[i] %||% NA),
      as.character(catalog$variable_3[i] %||% NA)
    )
    as.list(vars[!is.na(vars) & nzchar(vars)])
  })

  # --- Taxonomía tipada (contrato nuevo) --------------------------------
  # Agregamos tipo_regla (técnico, enum cerrado), categoria_ux (etiqueta
  # legible), fuente (instrumento|custom), tipo_variable (renombra el
  # ambiguo tipo_observacion). Los campos legacy (categoria, origen,
  # tipo_observacion) se mantienen para compatibilidad con código existente.
  catalog$fuente <- ifelse(catalog$source_type == "custom_rule", "custom", "instrumento")
  catalog$tipo_variable <- as.character(catalog$tipo_observacion %||% NA_character_)
  catalog$tipo_regla <- vapply(seq_len(nrow(catalog)),
                                function(i) .limpieza_infer_tipo_regla(catalog, i),
                                character(1))
  catalog$categoria_ux <- vapply(catalog$tipo_regla, .limpieza_categoria_ux_label, character(1))

  catalog
}

# Mapea taxonomía legacy → tipo_regla tipado.
.limpieza_infer_tipo_regla <- function(catalog, i) {
  rid <- as.character(catalog$id_regla[i] %||% "")
  nombre <- as.character(catalog$nombre_regla[i] %||% "")
  cat_legacy <- as.character(catalog$categoria[i] %||% "")
  # 1. Prefijos del rule_factory heredado:
  if (startsWith(nombre, "req_")) return("required")
  if (startsWith(nombre, "salto_")) return("skip")
  if (startsWith(nombre, "calc_")) return("calculate_check")
  if (startsWith(nombre, "cons_") && grepl("_cf_", nombre, fixed = TRUE)) return("constraint")
  if (startsWith(nombre, "cons_") && grepl("_ventana_fecha", nombre, fixed = TRUE)) return("range")
  if (startsWith(nombre, "cons_") && grepl("_repeat", nombre, fixed = TRUE)) return("repeat_length")
  if (startsWith(nombre, "cons_")) return("constraint")
  # 2. Reglas custom (RC_*): deriva del campo Tipo del plan si es "custom:*".
  if (startsWith(rid, "RC_") || startsWith(nombre, "rc_")) {
    # El compilador custom pone Tipo = "custom:<subtipo>"; tipo_observacion
    # puede traer ese string.
    tv <- as.character(catalog$tipo_observacion[i] %||% "")
    if (startsWith(tv, "custom:")) {
      sub <- sub("^custom:", "", tv)
      return(switch(sub,
        "no_nulo"        = "required",
        "rango_num"      = "range",
        "rango_fecha"    = "range",
        "outliers_iqr"   = "outlier",
        "outliers_z"     = "outlier",
        "duplicados"     = "duplicate",
        "fuera_catalogo" = "catalog",
        "coherencia_2v"  = "coherence",
        "coherence"
      ))
    }
    return("coherence")
  }
  # 3. Fallback por categoria legacy
  switch(cat_legacy,
    "Preguntas de control"  = "required",
    "Saltos de preguntas"   = "skip",
    "Consistencia"          = "constraint",
    "Filtro de opciones"    = "constraint",
    "Valores calculados"    = "calculate_check",
    "Valores atípicos"      = "outlier",
    "Registros repetidos"   = "repeat_length",
    "constraint"
  )
}

# Etiqueta legible (sin tecnicismos) — lo que la UI muestra al usuario.
.limpieza_categoria_ux_label <- function(tipo_regla) {
  switch(as.character(tipo_regla),
    "required"         = "Completitud",
    "skip"             = "Saltos del formulario",
    "constraint"       = "Consistencia lógica",
    "range"            = "Rangos",
    "catalog"          = "Valores de catálogo",
    "outlier"          = "Outliers",
    "duplicate"        = "Duplicados",
    "coherence"        = "Coherencia entre variables",
    "select_multiple_cardinality" = "Cardinalidad",
    "pattern"          = "Patrones sospechosos",
    "calculate_check"  = "Cálculos",
    "repeat_length"    = "Estructura de repeats",
    "odk_raw"          = "Expresión experta",
    "Otras"
  )
}

.limpieza_summarize_decision <- function(decision) {
  if (is.null(decision)) return(NA_character_)
  map <- c(
    ignore_rule = "Ignorar regla",
    exclude_cases = "Excluir casos",
    replace_value = "Reemplazar valor",
    normalize_value = "Normalizar valor",
    impute_value = "Imputar"
  )
  label <- unname(map[decision$action_type %||% ""]) %||% "Decisión"
  if (!is.null(decision$target_variable) && !is.na(decision$target_variable) && nzchar(decision$target_variable)) {
    paste(label, "·", as.character(decision$target_variable))
  } else {
    label
  }
}

.limpieza_build_decision_queue <- function(scope, decisions = NULL) {
  catalog <- .limpieza_rule_catalog(scope)
  if (!nrow(catalog)) return(list())

  # Solo reglas con ≥1 caso observado: la cola es para resolver
  # inconsistencias reales, no reglas "correctas" o sin evaluación.
  mask <- as.integer(catalog$n_inconsistencias %||% 0) > 0L
  mask[is.na(mask)] <- FALSE
  catalog <- catalog[mask, , drop = FALSE]
  if (!nrow(catalog)) return(list())

  decisions <- decisions %||% list()
  queue <- lapply(seq_len(nrow(catalog)), function(i) {
    rid <- as.character(catalog$id_regla[i])
    hits <- Filter(function(d) identical(as.character(d$source_id %||% ""), rid), decisions)
    ready_hits <- Filter(function(d) identical(as.character(d$status %||% ""), "ready"), hits)
    current <- if (length(ready_hits)) ready_hits[[length(ready_hits)]] else NULL
    vars <- unlist(catalog$variables[[i]] %||% list())
    list(
      # --- Legacy (compatibilidad) ---
      source_type = as.character(catalog$source_type[i] %||% "instrument_rule"),
      source_id = rid,
      origen = as.character(catalog$origen[i] %||% "Automática"),
      nombre_regla = as.character(catalog$nombre_regla[i] %||% rid),
      seccion = as.character(catalog$seccion[i] %||% NA_character_),
      categoria = as.character(catalog$categoria[i] %||% NA_character_),
      tipo_observacion = as.character(catalog$tipo_observacion[i] %||% NA_character_),
      # --- Taxonomía tipada nueva (contrato v3) ---
      tipo_regla = as.character(catalog$tipo_regla[i] %||% "constraint"),
      categoria_ux = as.character(catalog$categoria_ux[i] %||% "Consistencia lógica"),
      fuente = as.character(catalog$fuente[i] %||% "instrumento"),
      tipo_variable = as.character(catalog$tipo_variable[i] %||% NA_character_),
      # --- Resto ---
      severidad = as.character(catalog$severidad[i] %||% "info"),
      variables = as.list(vars),
      n_casos = as.integer(catalog$n_inconsistencias[i] %||% 0L),
      porcentaje = as.numeric(catalog$porcentaje[i] %||% NA_real_),
      decision_count = length(hits),
      current_action = if (is.null(current)) NA_character_ else .limpieza_summarize_decision(current),
      pending = length(ready_hits) == 0L,
      impact_expected = if (length(ready_hits) == 0L) {
        "Pendiente de decisión final"
      } else {
        sprintf("%d decisión(es) lista(s) para aplicar", length(ready_hits))
      }
    )
  })

  ord_pending <- vapply(queue, function(x) isTRUE(x$pending), logical(1))
  ord_cases <- vapply(queue, function(x) as.integer(x$n_casos %||% 0L), integer(1))
  queue[order(!ord_pending, -ord_cases)]
}

.limpieza_effective_plan <- function(scope, inst = NULL, decisions = NULL) {
  plan_inst <- scope$plan_result$plan %||% NULL
  desactivadas <- scope$reglas_desactivadas %||% character(0)
  if (!is.null(plan_inst) && length(desactivadas)) {
    id_col <- if ("ID" %in% names(plan_inst)) "ID" else if ("id_regla" %in% names(plan_inst)) "id_regla" else NULL
    if (!is.null(id_col)) {
      plan_inst <- plan_inst[!(as.character(plan_inst[[id_col]]) %in% desactivadas), , drop = FALSE]
    }
  }

  activas <- Filter(function(r) isTRUE(r$activa), scope$reglas_custom %||% list())
  plan_custom <- if (length(activas)) compile_reglas_custom(activas, instrumento = inst) else NULL

  plan_final <- if (!is.null(plan_inst) && nrow(plan_inst) > 0L && !is.null(plan_custom) && nrow(plan_custom) > 0L) {
    dplyr::bind_rows(plan_inst, plan_custom)
  } else if (!is.null(plan_inst) && nrow(plan_inst) > 0L) {
    plan_inst
  } else {
    plan_custom
  }

  decisions <- decisions %||% list()
  ignored_rules <- unique(vapply(Filter(function(d) identical(d$status %||% "", "ready") && identical(d$action_type %||% "", "ignore_rule"), decisions), function(d) as.character(d$source_id %||% ""), character(1)))
  if (length(ignored_rules) && !is.null(plan_final) && nrow(plan_final)) {
    id_col <- if ("ID" %in% names(plan_final)) "ID" else if ("id_regla" %in% names(plan_final)) "id_regla" else NULL
    if (!is.null(id_col)) {
      plan_final <- plan_final[!(as.character(plan_final[[id_col]]) %in% ignored_rules), , drop = FALSE]
    }
  }

  plan_final
}

.limpieza_target_case_ids <- function(decision, scope) {
  explicit_ids <- unique(as.character(unlist(decision$target_case_ids %||% list())))
  explicit_ids <- explicit_ids[!is.na(explicit_ids) & nzchar(explicit_ids)]
  if (length(explicit_ids)) return(explicit_ids)
  .limpieza_rule_case_map(scope$evaluacion, decision$source_id)$case_ids
}

.limpieza_apply_decisions_to_data <- function(df, scope, decisions) {
  if (!is.data.frame(df)) {
    return(list(
      data = df,
      excluded_cases = tibble::tibble(),
      replacements = tibble::tibble(),
      imputations = tibble::tibble(),
      trace = tibble::tibble(),
      impact = list(cases_excluded = 0L, cells_changed = 0L, replacements = 0L, normalizations = 0L, imputations = 0L)
    ))
  }

  table_key <- "principal"
  data_out <- tibble::as_tibble(df)
  data_out$`.__case_id__` <- .limpieza_make_case_ids(data_out, table_key)

  ready <- Filter(function(d) identical(as.character(d$status %||% ""), "ready"), decisions %||% list())
  if (!length(ready)) {
    return(list(
      data = dplyr::select(data_out, -dplyr::all_of(".__case_id__")),
      excluded_cases = tibble::tibble(),
      replacements = tibble::tibble(),
      imputations = tibble::tibble(),
      trace = tibble::tibble(),
      impact = list(cases_excluded = 0L, cells_changed = 0L, replacements = 0L, normalizations = 0L, imputations = 0L)
    ))
  }

  exclude_decisions <- Filter(function(d) identical(d$action_type %||% "", "exclude_cases"), ready)
  excluded_case_ids <- unique(unlist(lapply(exclude_decisions, .limpieza_target_case_ids, scope = scope)))
  excluded_case_ids <- excluded_case_ids[!is.na(excluded_case_ids) & nzchar(excluded_case_ids)]

  excluded_cases_df <- if (length(exclude_decisions)) {
    dplyr::bind_rows(lapply(exclude_decisions, function(d) {
      ids <- .limpieza_target_case_ids(d, scope)
      tibble::tibble(
        decision_id = as.character(d$id %||% ""),
        source_id = as.character(d$source_id %||% ""),
        case_id = ids,
        rationale = as.character(d$rationale %||% "")
      )
    }))
  } else tibble::tibble()

  if (length(excluded_case_ids)) {
    data_out <- data_out[!(data_out$`.__case_id__` %in% excluded_case_ids), , drop = FALSE]
  }

  replacements_log <- list()
  imputations_log <- list()
  trace_rows <- list()
  changed_replacements <- 0L
  changed_normalizations <- 0L
  changed_imputations <- 0L

  mutate_decisions <- Filter(function(d) d$action_type %in% c("replace_value", "normalize_value", "impute_value"), ready)
  for (d in mutate_decisions) {
    var <- as.character(d$target_variable %||% "")
    if (!nzchar(var) || !(var %in% names(data_out))) next

    target_ids <- .limpieza_target_case_ids(d, scope)
    row_mask <- if (length(target_ids)) data_out$`.__case_id__` %in% target_ids else rep(TRUE, nrow(data_out))
    if (!any(row_mask)) next

    col <- data_out[[var]]
    current_chr <- as.character(col)

    if (identical(d$action_type, "replace_value") || identical(d$action_type, "normalize_value")) {
      from_value <- as.character(d$action_params$from_value %||% "")
      to_value <- d$action_params$to_value %||% d$action_params$normalized_value %||% NA
      edit_mask <- row_mask
      if (nzchar(from_value)) edit_mask <- edit_mask & current_chr == from_value
      if (!any(edit_mask)) next

      old_values <- current_chr[edit_mask]
      data_out[[var]][edit_mask] <- .limpieza_cast_like(to_value, col)
      n_changed <- sum(edit_mask)
      row <- tibble::tibble(
        decision_id = as.character(d$id %||% ""),
        source_id = as.character(d$source_id %||% ""),
        target_variable = var,
        action_type = as.character(d$action_type %||% ""),
        from_value = from_value,
        to_value = as.character(to_value %||% ""),
        n_celdas = as.integer(n_changed),
        rationale = as.character(d$rationale %||% "")
      )
      replacements_log[[length(replacements_log) + 1L]] <- row
      trace_rows[[length(trace_rows) + 1L]] <- row
      if (identical(d$action_type, "replace_value")) {
        changed_replacements <- changed_replacements + as.integer(n_changed)
      } else {
        changed_normalizations <- changed_normalizations + as.integer(n_changed)
      }
      next
    }

    method <- as.character(d$action_params$method %||% "fixed")
    new_value <- if (identical(method, "median")) {
      suppressWarnings(stats::median(as.numeric(col), na.rm = TRUE))
    } else if (identical(method, "mode")) {
      .limpieza_mode_value(col)
    } else {
      d$action_params$fixed_value %||% d$action_params$value %||% NA
    }
    if (length(new_value) == 0L || (length(new_value) == 1L && is.na(new_value))) next

    data_out[[var]][row_mask] <- .limpieza_cast_like(new_value, col)
    n_changed <- sum(row_mask)
    row <- tibble::tibble(
      decision_id = as.character(d$id %||% ""),
      source_id = as.character(d$source_id %||% ""),
      target_variable = var,
      action_type = "impute_value",
      method = method,
      value = as.character(new_value),
      n_celdas = as.integer(n_changed),
      rationale = as.character(d$rationale %||% "")
    )
    imputations_log[[length(imputations_log) + 1L]] <- row
    trace_rows[[length(trace_rows) + 1L]] <- row
    changed_imputations <- changed_imputations + as.integer(n_changed)
  }

  list(
    data = dplyr::select(data_out, -dplyr::all_of(".__case_id__")),
    excluded_cases = if (length(excluded_cases_df)) excluded_cases_df else tibble::tibble(),
    replacements = if (length(replacements_log)) dplyr::bind_rows(replacements_log) else tibble::tibble(),
    imputations = if (length(imputations_log)) dplyr::bind_rows(imputations_log) else tibble::tibble(),
    trace = if (length(trace_rows)) dplyr::bind_rows(trace_rows) else tibble::tibble(),
    impact = list(
      cases_excluded = as.integer(length(unique(excluded_case_ids))),
      cells_changed = as.integer(changed_replacements + changed_normalizations + changed_imputations),
      replacements = as.integer(changed_replacements),
      normalizations = as.integer(changed_normalizations),
      imputations = as.integer(changed_imputations)
    )
  )
}

.limpieza_before_metrics <- function(scope) {
  ev <- scope$evaluacion
  if (is.null(ev) || is.null(ev$resumen)) {
    return(list(
      total_inconsistencias = 0L,
      reglas_con_casos = 0L,
      reglas_total = 0L,
      filas_base = 0L
    ))
  }
  res <- ev$resumen
  total_raw <- tryCatch(total_inconsistencias(ev), error = function(e) NULL)
  total <- if (is.numeric(total_raw) && length(total_raw) == 1L) {
    as.integer(total_raw)
  } else if (is.list(total_raw) && !is.null(total_raw$cabecera)) {
    as.integer(total_raw$cabecera$Total_inconsistencias[1] %||% 0L)
  } else 0L
  list(
    total_inconsistencias = total,
    reglas_con_casos = as.integer(sum(as.integer(res$n_inconsistencias %||% 0L) > 0L, na.rm = TRUE)),
    reglas_total = as.integer(nrow(res)),
    filas_base = as.integer(nrow(ev$datos %||% tibble::tibble()))
  )
}

.limpieza_simulate <- function(sid, base_nombre, scope, decisions = NULL) {
  before <- .limpieza_before_metrics(scope)
  ready <- Filter(function(d) identical(as.character(d$status %||% ""), "ready"), decisions %||% list())
  if (is.null(scope$evaluacion)) {
    return(list(
      before = before,
      after = before,
      impact = list(cases_excluded = 0L, cells_changed = 0L, replacements = 0L, normalizations = 0L, imputations = 0L, rules_resolved = 0L),
      residual_final = list(),
      decisions_ready = length(ready),
      data_final = NULL,
      evaluacion_final = NULL,
      logs = list(excluded_cases = tibble::tibble(), replacements = tibble::tibble(), imputations = tibble::tibble(), trace = tibble::tibble())
    ))
  }

  files <- .resolve_base_files(sid, base_nombre)
  inst <- leer_xlsform_limpieza(files$xlsform$path, verbose = FALSE)
  data_raw <- .read_data_for_validation(files$data$path, files$data_ext)
  apply_out <- .limpieza_apply_decisions_to_data(data_raw, scope, ready)
  plan_final <- .limpieza_effective_plan(scope, inst = inst, decisions = ready)

  ev_after <- if (!is.null(plan_final) && nrow(plan_final) > 0L) {
    evaluar_consistencia(
      datos = apply_out$data,
      plan = plan_final,
      contar_na_como_inconsistencia = FALSE
    )
  } else NULL

  after <- if (is.null(ev_after)) {
    list(
      total_inconsistencias = 0L,
      reglas_con_casos = 0L,
      reglas_total = 0L,
      filas_base = as.integer(nrow(apply_out$data %||% tibble::tibble()))
    )
  } else {
    total_raw <- tryCatch(total_inconsistencias(ev_after), error = function(e) NULL)
    total <- if (is.numeric(total_raw) && length(total_raw) == 1L) {
      as.integer(total_raw)
    } else if (is.list(total_raw) && !is.null(total_raw$cabecera)) {
      as.integer(total_raw$cabecera$Total_inconsistencias[1] %||% 0L)
    } else 0L
    list(
      total_inconsistencias = total,
      reglas_con_casos = as.integer(sum(as.integer(ev_after$resumen$n_inconsistencias %||% 0L) > 0L, na.rm = TRUE)),
      reglas_total = as.integer(nrow(ev_after$resumen %||% tibble::tibble())),
      filas_base = as.integer(nrow(apply_out$data %||% tibble::tibble()))
    )
  }

  impact <- apply_out$impact
  impact$rules_resolved <- as.integer(max(0L, before$reglas_con_casos - after$reglas_con_casos))

  list(
    before = before,
    after = after,
    impact = impact,
    residual_final = if (!is.null(ev_after) && !is.null(ev_after$resumen)) .plan_rows_preview(utils::head(ev_after$resumen, 500L), n = 500L) else list(),
    decisions_ready = length(ready),
    data_final = apply_out$data,
    evaluacion_final = ev_after,
    logs = list(
      excluded_cases = apply_out$excluded_cases,
      replacements = apply_out$replacements,
      imputations = apply_out$imputations,
      trace = apply_out$trace
    )
  )
}

.limpieza_build_module_stats <- function(decisions, queue, preview = NULL) {
  decisions <- decisions %||% list()
  count_action <- function(actions) {
    sum(vapply(decisions, function(d) as.character(d$action_type %||% "") %in% actions && identical(as.character(d$status %||% ""), "ready"), logical(1)))
  }
  list(
    limpieza = list(
      decisiones = as.integer(count_action(c("ignore_rule", "exclude_cases"))),
      casos_excluidos = as.integer(preview$impact$cases_excluded %||% 0L)
    ),
    reemplazo = list(
      decisiones = as.integer(count_action(c("replace_value", "normalize_value"))),
      celdas = as.integer((preview$impact$replacements %||% 0L) + (preview$impact$normalizations %||% 0L))
    ),
    imputacion = list(
      decisiones = as.integer(count_action("impute_value")),
      celdas = as.integer(preview$impact$imputations %||% 0L)
    ),
    decision_maker = list(
      pendientes = as.integer(sum(vapply(queue %||% list(), function(x) isTRUE(x$pending), logical(1)))),
      listas = as.integer(sum(vapply(decisions, function(d) identical(as.character(d$status %||% ""), "ready"), logical(1))))
    )
  )
}

.limpieza_build_summary <- function(scope, queue, decisions, preview = NULL) {
  queue <- queue %||% list()
  decisions <- decisions %||% list()
  catalog <- .limpieza_rule_catalog(scope)
  pending_count <- as.integer(sum(vapply(queue, function(x) isTRUE(x$pending), logical(1))))
  list(
    total_reglas_con_casos = as.integer(length(queue)),
    total_reglas_automaticas = as.integer(sum(vapply(queue, function(x) identical(x$source_type %||% "", "instrument_rule"), logical(1)))),
    total_reglas_custom = as.integer(sum(vapply(queue, function(x) identical(x$source_type %||% "", "custom_rule"), logical(1)))),
    total_casos_afectados = as.integer(preview$before$total_inconsistencias %||% 0L),
    total_decisiones = as.integer(length(decisions)),
    decisiones_listas = as.integer(sum(vapply(decisions, function(d) identical(as.character(d$status %||% ""), "ready"), logical(1)))),
    pendientes = pending_count,
    total_casos_excluidos = as.integer(preview$impact$cases_excluded %||% 0L),
    total_reemplazos = as.integer((preview$impact$replacements %||% 0L) + (preview$impact$normalizations %||% 0L)),
    total_imputaciones = as.integer(preview$impact$imputations %||% 0L),
    ready_to_finalize = isTRUE(!is.null(scope$evaluacion) && pending_count == 0L)
  )
}

.limpieza_export_excel <- function(path, summary, decisions, preview) {
  wb <- openxlsx::createWorkbook(creator = "prosecnur")
  st_head <- openxlsx::createStyle(textDecoration = "bold", fgFill = "#E8EAED")

  write_sheet <- function(name, df) {
    openxlsx::addWorksheet(wb, name)
    openxlsx::writeData(wb, name, df)
    if (nrow(df) >= 0L && ncol(df) > 0L) {
      openxlsx::addStyle(wb, name, st_head, rows = 1, cols = seq_len(ncol(df)), gridExpand = TRUE, stack = TRUE)
      openxlsx::freezePane(wb, name, firstRow = TRUE)
      openxlsx::setColWidths(wb, name, cols = seq_len(ncol(df)), widths = "auto")
    }
  }

  write_sheet("Resumen", tibble::as_tibble(summary))
  write_sheet("Decisiones_reglas", .limpieza_flatten_decisions(decisions))
  write_sheet("Casos_excluidos", preview$logs$excluded_cases %||% tibble::tibble())
  write_sheet("Reemplazos", preview$logs$replacements %||% tibble::tibble())
  write_sheet("Imputaciones", preview$logs$imputations %||% tibble::tibble())
  write_sheet("Trazabilidad", preview$logs$trace %||% tibble::tibble())
  write_sheet("Residual_final", if (!is.null(preview$evaluacion_final) && !is.null(preview$evaluacion_final$resumen)) tibble::as_tibble(preview$evaluacion_final$resumen) else tibble::tibble())

  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

limpieza_finalize <- function(sid, base_nombre, scope) {
  if (is.null(scope$evaluacion)) {
    stop_api(409, "E_NO_AUDITORIA", "La limpieza solo puede cerrarse después de correr la auditoría.")
  }
  decisions <- scope$limpieza_draft %||% list()
  queue <- .limpieza_build_decision_queue(scope, decisions)
  pending <- Filter(function(x) isTRUE(x$pending), queue)
  if (length(queue) > 0L && length(pending) > 0L) {
    stop_api(409, "E_LIMPIEZA_PENDING", "Todavía hay inconsistencias pendientes de decisión.")
  }

  preview <- .limpieza_simulate(sid, base_nombre, scope, decisions)
  summary <- .limpieza_build_summary(scope, queue, decisions, preview)

  s <- session_get(sid)
  downloads_dir <- file.path(s$dir, "downloads")
  dir.create(downloads_dir, showWarnings = FALSE, recursive = TRUE)

  base_slug <- if (!is.null(base_nombre) && nzchar(base_nombre)) base_nombre else "base"
  ts_slug <- format(Sys.time(), "%Y%m%d_%H%M%S")

  clean_path <- file.path(downloads_dir, sprintf("base_limpia_%s_%s.xlsx", base_slug, ts_slug))
  .bases_write_xlsx(preview$data_final, preview$data_final, clean_path, valores = "codigos")
  clean_meta <- .limpieza_register_download(
    sid = sid,
    kind = "validacion_limpieza_base_limpia",
    original_name = sprintf("base_limpia_%s.xlsx", base_slug),
    path = clean_path,
    ext = "xlsx"
  )

  limpieza_payload <- build_limpieza(scope, sid = sid, base_nombre = base_nombre, preview_override = preview)
  estudio_nombre <- session_get(sid)$estudio$nombre %||% NA_character_
  html_path <- file.path(downloads_dir, sprintf("decision_maker_%s_%s.html", base_slug, ts_slug))
  html <- build_report_html(
    scope = scope,
    base_nombre = base_nombre,
    estudio_nombre = estudio_nombre,
    generated_at = Sys.time(),
    limpieza_payload = limpieza_payload
  )
  writeLines(html, html_path, useBytes = TRUE)
  html_meta <- .limpieza_register_download(
    sid = sid,
    kind = "validacion_limpieza_html",
    original_name = sprintf("decision_maker_%s.html", base_slug),
    path = html_path,
    ext = "html"
  )

  excel_path <- file.path(downloads_dir, sprintf("decisiones_limpieza_%s_%s.xlsx", base_slug, ts_slug))
  .limpieza_export_excel(excel_path, summary, decisions, preview)
  excel_meta <- .limpieza_register_download(
    sid = sid,
    kind = "validacion_limpieza_excel",
    original_name = sprintf("decisiones_limpieza_%s.xlsx", base_slug),
    path = excel_path,
    ext = "xlsx"
  )

  artifacts <- list(
    finalized_at = .limpieza_now_utc(),
    recommended_file_id = clean_meta$file_id,
    files = list(
      list(kind = "base_limpia", label = "Base final limpia", file_id = clean_meta$file_id, original_name = clean_meta$original_name, generated_at = clean_meta$uploaded_at),
      list(kind = "reporte_html", label = "Reporte HTML ejecutivo", file_id = html_meta$file_id, original_name = html_meta$original_name, generated_at = html_meta$uploaded_at),
      list(kind = "excel_detalle", label = "Excel detalle de decisiones", file_id = excel_meta$file_id, original_name = excel_meta$original_name, generated_at = excel_meta$uploaded_at)
    )
  )

  validacion_scope_set(sid, base_nombre, "limpieza_preview", preview)
  validacion_scope_set(sid, base_nombre, "limpieza_artifacts", artifacts)

  list(
    ok = TRUE,
    summary = summary,
    before_after_preview = preview,
    artifacts = artifacts
  )
}
