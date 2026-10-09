# =============================================================================
# Proyecto DEMO de aulas (HSVG PUCP 2025)
# =============================================================================
#
# El preset sembrado que alimenta la demo del motor de aulas: estudiantes
# sintéticos, comparación de métodos y simulación de reemplazos sobre el
# catálogo `preset_hsvg_pucp_2025_aulas_demo.json`.
#
# Vive aquí y no en `calc_muestra_aulas.R` porque ese archivo está congelado a
# crecimiento y llevaba 625 líneas de demo dentro del motor. No es código de
# producto: no construye el marco de ningún estudio real, sólo fabrica uno de
# ejemplo. Sacarlo devuelve el motor por debajo de su línea base y deja el gate
# de congelados en verde sin subir el techo, que es lo que la regla pide.
#
# `.cm_aulas_wave_number()` NO se movió: pese al nombre vecino de
# `.cm_aulas_demo_wave_number()`, la usa el motor en cinco sitios
# (reemplazos y orden de olas), así que se queda donde estaba.
#
# Todo lo de aquí es interno al paquete: `calc_muestra_engine.R` y dos tests
# llaman a `calc_muestra_aulas_demo_hsvg_2025()` por nombre, que sigue
# resolviendo en el mismo namespace.

.cm_aulas_demo_path <- function() {
  if (exists(".cm_locate_catalog", mode = "function")) {
    return(.cm_locate_catalog("preset_hsvg_pucp_2025_aulas_demo.json"))
  }
  candidates <- c(
    file.path(getwd(), "api", "inst", "catalogos", "preset_hsvg_pucp_2025_aulas_demo.json"),
    file.path(getwd(), "inst", "catalogos", "preset_hsvg_pucp_2025_aulas_demo.json"),
    file.path(getwd(), "..", "api", "inst", "catalogos", "preset_hsvg_pucp_2025_aulas_demo.json")
  )
  hit <- candidates[file.exists(candidates)][1]
  if (is.na(hit)) stop("No se encontro el preset de aulas demo 2025.", call. = FALSE)
  hit
}

.cm_aulas_demo_wave_number <- function(x) {
  vapply(x, function(item) {
    key <- .cm_aulas_scalar(item, "")
    out <- suppressWarnings(as.integer(gsub("[^0-9]", "", key)))
    if (is.finite(out)) out else 999L
  }, integer(1))
}

.cm_aulas_demo_student_key <- function(x) {
  key <- .cm_aulas_text_key(x)
  if (!nzchar(key)) key <- "global"
  key
}

.cm_aulas_demo_with_synthetic_students <- function(aula_frame, population_n = 0L) {
  if (!nrow(aula_frame)) return(aula_frame)
  aula_frame$eligible_n <- suppressWarnings(as.numeric(aula_frame$eligible_n))
  aula_frame$eligible_n[!is.finite(aula_frame$eligible_n) | aula_frame$eligible_n < 0] <- 0
  population_n <- max(1L, .cm_aulas_int(population_n, sum(aula_frame$eligible_n, na.rm = TRUE)))
  exposure_by_faculty <- stats::aggregate(eligible_n ~ faculty, data = aula_frame, FUN = sum)
  total_exposure <- sum(exposure_by_faculty$eligible_n, na.rm = TRUE)
  if (!is.finite(total_exposure) || total_exposure <= 0) total_exposure <- nrow(aula_frame)
  pool_sizes <- pmax(1L, round(population_n * exposure_by_faculty$eligible_n / total_exposure))
  delta <- population_n - sum(pool_sizes)
  if (delta != 0L && length(pool_sizes)) {
    ord <- order(exposure_by_faculty$eligible_n, decreasing = TRUE)
    for (i in seq_len(abs(delta))) {
      idx <- ord[((i - 1L) %% length(ord)) + 1L]
      pool_sizes[[idx]] <- max(1L, pool_sizes[[idx]] + if (delta > 0L) 1L else -1L)
    }
  }
  pool_lookup <- stats::setNames(pool_sizes, exposure_by_faculty$faculty)
  cursor <- stats::setNames(rep(0L, length(pool_lookup)), names(pool_lookup))
  aula_frame <- aula_frame[order(.cm_aulas_demo_wave_number(aula_frame$wave), aula_frame$historical_order %||% seq_len(nrow(aula_frame))), , drop = FALSE]
  ids <- character(nrow(aula_frame))
  for (i in seq_len(nrow(aula_frame))) {
    faculty <- .cm_aulas_scalar(aula_frame$faculty[[i]], "sin_facultad")
    pool <- max(1L, .cm_aulas_int(pool_lookup[[faculty]], 1L))
    n <- max(1L, .cm_aulas_int(aula_frame$eligible_n[[i]], 1L))
    start <- cursor[[faculty]] %% pool
    local <- ((seq_len(n) + start - 1L) %% pool) + 1L
    prefix <- paste0("demo2025_", .cm_aulas_demo_student_key(faculty), "_")
    ids[[i]] <- paste0(prefix, sprintf("%05d", local), collapse = "|")
    cursor[[faculty]] <- cursor[[faculty]] + max(1L, round(n * 0.78))
  }
  aula_frame$unique_student_ids <- ids
  aula_frame$student_ids_policy <- "sinteticos_anonimos_para_demo"
  rownames(aula_frame) <- NULL
  aula_frame
}

.cm_aulas_demo_metric <- function(df, metric, column = "value", default = NA_real_) {
  if (!is.data.frame(df) || !nrow(df) || !"metric" %in% names(df) || !column %in% names(df)) return(default)
  out <- suppressWarnings(as.numeric(df[[column]][df$metric == metric][[1]] %||% default))
  if (is.finite(out)) out else default
}

.cm_aulas_demo_balance_score <- function(representativity) {
  metrics <- .cm_aulas_as_df(representativity$metrics %||% data.frame(stringsAsFactors = FALSE), "metrics")
  metrics <- metrics[metrics$metric_group == "balance" & metrics$active %in% TRUE, , drop = FALSE]
  if (!nrow(metrics)) return(NA_real_)
  weights <- suppressWarnings(as.numeric(metrics$normalized_weight))
  scores <- suppressWarnings(as.numeric(metrics$score))
  ok <- is.finite(weights) & weights > 0 & is.finite(scores)
  if (any(ok)) return(round(stats::weighted.mean(scores[ok], weights[ok]), 1))
  round(mean(scores[is.finite(scores)], na.rm = TRUE), 1)
}

.cm_aulas_demo_method_comparison <- function(frame_result, selection_result, config, representativity) {
  historical_score <- .cm_aulas_num(representativity$representativity_score, 82)
  balance_score <- .cm_aulas_demo_balance_score(representativity)
  if (!is.finite(balance_score)) balance_score <- historical_score
  coverage <- .cm_aulas_as_df(representativity$coverage_overlap %||% data.frame(stringsAsFactors = FALSE), "coverage")
  coverage_pct <- .cm_aulas_demo_metric(coverage, "coverage_population_pct", "value", NA_real_)
  duplicate_loss <- .cm_aulas_demo_metric(coverage, "duplicate_loss", "value", NA_real_)
  selection_df <- .cm_aulas_as_df(selection_result$selection, "selection")
  repeated <- sum(suppressWarnings(as.numeric(selection_df$duplicate_overlap)), na.rm = TRUE)
  reserve_depth <- .cm_aulas_as_df(representativity$reserve_depth %||% data.frame(stringsAsFactors = FALSE), "reserve_depth")
  reserve_ratio <- if (nrow(reserve_depth)) mean(suppressWarnings(as.numeric(reserve_depth$depth_ratio)), na.rm = TRUE) else NA_real_
  methods <- data.frame(
    method_id = c("sistematico_pps", "cube_balanceado", "local_pivotal_balanceado", "pool_controlado"),
    method_label = c("Seleccion proporcional historica", .cm_aulas_method_label("cube_balanceado"), .cm_aulas_method_label("local_pivotal_balanceado"), .cm_aulas_method_label("pool_controlado")),
    engine_used = c("historical_import_2025", "pendiente_de_recalculo", "pendiente_de_recalculo", "pendiente_de_recalculo"),
    probability_source = c("historical_systematic_pps_reconstructed_from_mos", "prescribed_design", "prescribed_design", "monte_carlo_after_optimization"),
    balance_score = c(balance_score, min(100, balance_score + 3), min(100, balance_score + 4), min(100, balance_score + 5)),
    repeated_students = c(repeated, max(0, round(repeated * 0.82)), max(0, round(repeated * 0.76)), max(0, round(repeated * 0.55))),
    duplicate_loss = c(duplicate_loss, max(0, duplicate_loss * 0.86), max(0, duplicate_loss * 0.80), max(0, duplicate_loss * 0.62)),
    repetition_score = c(NA_real_, NA_real_, NA_real_, NA_real_),
    unique_students_covered = c(
      sum(suppressWarnings(as.numeric(selection_df$unique_added[selection_df$wave == "M1"])), na.rm = TRUE),
      NA_real_,
      NA_real_,
      NA_real_
    ),
    coverage_unique_pct = c(coverage_pct, min(1, coverage_pct * 1.02), min(1, coverage_pct * 1.03), min(1, coverage_pct * 1.05)),
    coverage_score = c(NA_real_, NA_real_, NA_real_, NA_real_),
    schedule_concentration_delta = c(NA_real_, NA_real_, NA_real_, NA_real_),
    concentration_score = c(NA_real_, NA_real_, NA_real_, NA_real_),
    reserve_depth_ratio = c(reserve_ratio, reserve_ratio, reserve_ratio, reserve_ratio),
    reserve_score = c(NA_real_, NA_real_, NA_real_, NA_real_),
    weight_cv = c(.cm_aulas_demo_metric(.cm_aulas_as_df(representativity$weight_stability, "weight_stability"), "cv", "cv", NA_real_), NA_real_, NA_real_, NA_real_),
    n_eff_ratio = c(.cm_aulas_num(representativity$weight_stability$n_eff_ratio, NA_real_), NA_real_, NA_real_, NA_real_),
    representativity_score = c(historical_score, min(100, historical_score + 3.5), min(100, historical_score + 4), min(100, historical_score + 5)),
    representativity_distance = c(1 - historical_score / 100, 1 - min(100, historical_score + 3.5) / 100, 1 - min(100, historical_score + 4) / 100, 1 - min(100, historical_score + 5) / 100),
    overall_score = c(historical_score, min(100, historical_score + 3.5), min(100, historical_score + 4), min(100, historical_score + 5)),
    warnings = c(
      "Replica historica importada desde workbook 2025.",
      "Recalcular para obtener seleccion actual con cube_balanceado.",
      "Requiere BalancedSampling; registra fallback si no esta disponible.",
      "Si se usa, pi_final debe estimarse por Monte Carlo posterior a optimizacion."
    ),
    operational_reason = c(
      "Reproduce el orden historico M1...M12 del estudio 2025.",
      .cm_aulas_method_explanation("cube_balanceado"),
      .cm_aulas_method_explanation("local_pivotal_balanceado"),
      .cm_aulas_method_explanation("pool_controlado")
    ),
    methodological_reason = c(
      "Benchmark PPS historico con probabilidades reconstruidas desde tamaño elegible y trazabilidad de olas.",
      "Motor recomendado para mejorar balance sin esconder la logica probabilistica.",
      "Modo avanzado para balance y dispersion cuando se quiere reducir concentracion.",
      "Optimizacion operativa; no reportar probabilidades puras de cube como finales."
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  methods$representativity_distance <- round(methods$representativity_distance, 6)
  balance <- .cm_aulas_balance_diagnostic(
    .cm_aulas_as_df(frame_result$aula_frame, "aula_frame"),
    selection_df,
    config$selector$balance_vars
  )
  if (nrow(balance)) balance$method_id <- "sistematico_pps"
  sim <- data.frame(
    method_id = methods$method_id,
    requested_runs = .cm_aulas_int(config$selector$simulation_runs, 500L),
    executed_runs = 0L,
    score_mean = methods$representativity_score,
    score_sd = NA_real_,
    score_p10 = NA_real_,
    score_p90 = NA_real_,
    coverage_mean = methods$coverage_unique_pct,
    duplicate_loss_mean = methods$duplicate_loss,
    note = c(
      "Demo precargada desde seleccion historica; corre Comparar metodos para simular de nuevo.",
      "Estimacion preliminar de mejora; recalculable con el marco cargado.",
      "Estimacion preliminar; depende de disponibilidad de BalancedSampling.",
      "Estimacion preliminar; exige Monte Carlo si se usa como seleccion final."
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  risks <- data.frame(
    code = c("historical_import", "privacy_sanitized", "sex_aux_missing", "recompute_available"),
    severity = c("baja", "ok", "media", "ok"),
    title = c("Replica historica", "Datos personales excluidos", "Sexo por aula no precargado", "Comparador recalculable"),
    detail = c(
      "La seleccion M1...M12 fue importada del workbook 2025 para reproducir el caso real.",
      "La demo no guarda nombres, correos, telefonos ni codigos reales de estudiantes o docentes.",
      "Si se carga la base madre completa, el selector puede recalcular balance por sexo desde estudiantes unicos.",
      "El usuario puede correr Comparar metodos para producir metricas actuales con los motores disponibles."
    ),
    method = c("sistematico_pps", "sistematico_pps", "sistematico_pps", "cube_balanceado"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  list(
    schema = "calc_muestra_aulas_method_comparison_v1",
    generated_at = .cm_aulas_now_iso(),
    frame_hash = .cm_aulas_scalar(frame_result$frame_hash, ""),
    selector = .cm_aulas_method_comparison_selector_snapshot(config$selector, config$objective),
    methods = methods,
    recommendation = list(
      method_id = "cube_balanceado",
      method_label = .cm_aulas_method_label("cube_balanceado"),
      operational_reason = "Usar la replica historica para entender el caso 2025 y recalcular con balance por cuotas cuando se construya una nueva seleccion.",
      methodological_reason = "Cube balanceado mejora representatividad manteniendo probabilidades prescritas; pool controlado queda como modo avanzado con Monte Carlo.",
      overall_score = methods$overall_score[methods$method_id == "cube_balanceado"][[1]],
      representativity_score = methods$representativity_score[methods$method_id == "cube_balanceado"][[1]],
      representativity_distance = methods$representativity_distance[methods$method_id == "cube_balanceado"][[1]]
    ),
    objective_config = config$objective,
    frame_profiles = unique(representativity$profile_distributions[, intersect(c("dimension", "variable", "label", "category", "source", "frame_n", "frame_prop"), names(representativity$profile_distributions)), drop = FALSE]),
    method_profiles = transform(representativity$profile_distributions, method_id = "sistematico_pps"),
    representativity_metrics = transform(representativity$metrics, method_id = "sistematico_pps"),
    simulation_summary = sim,
    balance = balance,
    reserve_depth = representativity$reserve_depth,
    risk_flags = risks,
    simulation_runs = .cm_aulas_int(config$selector$simulation_runs, 500L),
    notes = list(
      "Demo historica sanitarizada del flujo base -> calculo -> seleccion -> agenda.",
      "La comparacion precargada separa replica historica de motores recalculables.",
      "Monitoreo debe activar reservas trazadas sin redisenar el marco base."
    )
  )
}

.cm_aulas_demo_replacements <- function(frame_result, selection_result, config) {
  selection_df <- .cm_aulas_as_df(selection_result$selection, "selection")
  roles <- .cm_aulas_role_values(selection_df)
  titulars <- selection_df[roles == "titular" | selection_df$wave == "M1", , drop = FALSE]
  reserves <- selection_df[roles == "chain_reserve", , drop = FALSE]
  base_score <- .cm_aulas_num(selection_result$representativity_score, 0)
  suggestions <- list()
  impacts <- list()
  for (i in seq_len(nrow(titulars))) {
    titular <- titulars[i, , drop = FALSE]
    candidates <- reserves[reserves$selection_slot_id == titular$selection_slot_id[[1]] | reserves$replacement_for == titular$classroom_id[[1]], , drop = FALSE]
    if (nrow(candidates)) {
      ord_chain <- suppressWarnings(as.numeric(candidates$replacement_order))
      ord_chain[!is.finite(ord_chain)] <- vapply(candidates$wave[!is.finite(ord_chain)], .cm_aulas_wave_number, integer(1)) - 1L
      candidates <- candidates[order(ord_chain), , drop = FALSE]
    }
    if (!nrow(candidates)) candidates <- reserves[reserves$faculty == titular$faculty[[1]], , drop = FALSE]
    if (!nrow(candidates)) candidates <- reserves
    if (!nrow(candidates)) next
    cand_scores <- vapply(seq_len(nrow(candidates)), function(j) {
      reserve <- candidates[j, , drop = FALSE]
      score <- 0
      if (.cm_aulas_scalar(reserve$faculty[[1]], "") == .cm_aulas_scalar(titular$faculty[[1]], "")) score <- score + 40
      if (.cm_aulas_scalar(reserve$program[[1]], "") == .cm_aulas_scalar(titular$program[[1]], "")) score <- score + 24
      if (.cm_aulas_scalar(reserve$level[[1]], "") == .cm_aulas_scalar(titular$level[[1]], "")) score <- score + 12
      if (.cm_aulas_scalar(reserve$size_group[[1]], "") == .cm_aulas_scalar(titular$size_group[[1]], "")) score <- score + 10
      score + max(0, 14 - abs(.cm_aulas_num(reserve$eligible_n[[1]], 0) - .cm_aulas_num(titular$eligible_n[[1]], 0)) / max(1, .cm_aulas_num(titular$eligible_n[[1]], 1)) * 14)
    }, numeric(1))
    ord <- order(cand_scores, decreasing = TRUE)[seq_len(min(3L, length(cand_scores)))]
    for (rank in seq_along(ord)) {
      reserve <- candidates[ord[[rank]], , drop = FALSE]
      score <- cand_scores[[ord[[rank]]]]
      delta <- round((score - 70) / 18, 2)
      match_level <- if (.cm_aulas_scalar(reserve$faculty[[1]], "") == .cm_aulas_scalar(titular$faculty[[1]], "") &&
        .cm_aulas_scalar(reserve$program[[1]], "") == .cm_aulas_scalar(titular$program[[1]], "")) {
        "misma_celda"
      } else if (.cm_aulas_scalar(reserve$faculty[[1]], "") == .cm_aulas_scalar(titular$faculty[[1]], "")) {
        "celda_equivalente"
      } else {
        "celda_cercana"
      }
      suggestions[[length(suggestions) + 1L]] <- data.frame(
        selection_slot_id = titular$selection_slot_id[[1]] %||% "",
        titular_operational_code = titular$operational_code[[1]] %||% "",
        titular_classroom_id = titular$classroom_id[[1]],
        titular_label = titular$course_name[[1]] %||% titular$label[[1]],
        reserve_operational_code = reserve$operational_code[[1]] %||% "",
        replacement_chain_code = reserve$replacement_chain_code[[1]] %||% "",
        reserve_classroom_id = reserve$classroom_id[[1]],
        reserve_label = reserve$course_name[[1]] %||% reserve$label[[1]],
        rank = rank,
        wave = reserve$wave[[1]],
        replacement_order = reserve$replacement_order[[1]] %||% rank,
        match_level = match_level,
        score = round(score, 2),
        before_score = base_score,
        after_score = round(max(0, min(100, base_score + delta)), 1),
        score_delta = delta,
        overlap_delta = .cm_aulas_int(reserve$duplicate_overlap, 0L),
        eligible_delta = .cm_aulas_int(reserve$eligible_n, 0L) - .cm_aulas_int(titular$eligible_n, 0L),
        reason = sprintf("%s; mantiene %s y cambia elegibles %+s.", match_level, reserve$wave[[1]], .cm_aulas_int(reserve$eligible_n, 0L) - .cm_aulas_int(titular$eligible_n, 0L)),
        warning = if (match_level == "celda_cercana") "Revisar: cambia facultad frente al titular." else "",
        stringsAsFactors = FALSE,
        check.names = FALSE
      )
    }
    best <- candidates[ord[[1]], , drop = FALSE]
    impacts[[length(impacts) + 1L]] <- data.frame(
      selection_slot_id = titular$selection_slot_id[[1]] %||% "",
      titular_operational_code = titular$operational_code[[1]] %||% "",
      titular_classroom_id = titular$classroom_id[[1]],
      replacement_operational_code = best$operational_code[[1]] %||% "",
      suggested_replacement_id = best$classroom_id[[1]],
      before_faculty = titular$faculty[[1]],
      after_faculty = best$faculty[[1]],
      before_program = titular$program[[1]],
      after_program = best$program[[1]],
      before_score = base_score,
      after_score = suggestions[[length(suggestions) - length(ord) + 1L]]$after_score[[1]],
      score_delta = suggestions[[length(suggestions) - length(ord) + 1L]]$score_delta[[1]],
      eligible_delta = .cm_aulas_int(best$eligible_n, 0L) - .cm_aulas_int(titular$eligible_n, 0L),
      overlap_delta = .cm_aulas_int(best$duplicate_overlap, 0L),
      balance_effect = if (.cm_aulas_scalar(best$stratum[[1]], "") == .cm_aulas_scalar(titular$stratum[[1]], "")) "mantiene_estrato" else "altera_estrato",
      warning = if (.cm_aulas_scalar(best$stratum[[1]], "") == .cm_aulas_scalar(titular$stratum[[1]], "")) "" else "El reemplazo sugerido cambia la celda metodologica.",
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  }
  suggestions_df <- if (length(suggestions)) do.call(rbind, suggestions) else data.frame(stringsAsFactors = FALSE)
  impact_df <- if (length(impacts)) do.call(rbind, impacts) else data.frame(stringsAsFactors = FALSE)
  list(
    schema = "calc_muestra_aulas_replacement_simulation_v1",
    generated_at = .cm_aulas_now_iso(),
    selection_run_id = selection_result$selection_run_id %||% "",
    frame_hash = .cm_aulas_scalar(frame_result$frame_hash, ""),
    objective_config = selection_result$objective_config,
    planned_representativity = selection_result$representativity,
    suggestions = suggestions_df,
    impact = impact_df,
    summary = data.frame(
      metric = c("titulares", "reservas", "titulares_con_sugerencia", "sugerencias", "reservas_usadas_en_campo_2025"),
      value = c(nrow(titulars), nrow(reserves), length(unique(suggestions_df$titular_classroom_id %||% character(0))), nrow(suggestions_df), sum(selection_df$used_as_replacement %in% TRUE | .cm_aulas_text_key(selection_df$used_as_replacement) == "true")),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
}

calc_muestra_aulas_demo_hsvg_2025 <- function() {
  demo_path <- .cm_aulas_demo_path()
  payload <- jsonlite::fromJSON(demo_path, simplifyVector = TRUE)
  rows <- payload$rows
  if (!is.data.frame(rows)) rows <- .cm_aulas_as_df(rows, "demo_rows")
  rows <- as.data.frame(rows, stringsAsFactors = FALSE, check.names = FALSE)
  summary <- payload$summary %||% list()
  cfg <- calc_muestra_aulas_default_config()
  cfg$input_mode <- "base_madre"
  cfg$filters$min_eligible_per_class <- 1L
  cfg$selector$seed <- 20250831L
  cfg$selector$n_aulas <- max(1L, .cm_aulas_int(summary$planned_m1, 170L))
  cfg$selector$replacement_waves <- 11L
  cfg$selector$selector_engine <- "sistematico_pps"
  cfg$selector$method_family <- "pps_probability"
  cfg$selector$strata_cols <- as.list(c("faculty", "size_group"))
  cfg$selector$balance_vars <- as.list(c("faculty", "program", "level", "schedule", "modality", "size_group"))
  cfg$selector$spread_vars <- as.list(c("program", "level", "schedule", "size_group"))
  cfg$selector$simulation_runs <- 500L
  cfg$selector$monte_carlo_n <- 500L
  cfg$selector$mos_strategy <- "eligible_yield_winsorized"
  cfg$selector$coordination_mode <- "permanent_random_number_historical_import"

  rows$eligible_n <- suppressWarnings(as.numeric(rows$eligible_n))
  rows$eligible_n[!is.finite(rows$eligible_n)] <- 0
  rows$enrolled_total <- suppressWarnings(as.numeric(rows$enrolled_total))
  rows$enrolled_total[!is.finite(rows$enrolled_total)] <- rows$eligible_n[!is.finite(rows$enrolled_total)]
  rows$teacher <- ""
  rows$teacher_email <- ""
  rows$sex_top_1 <- ""
  rows$sex_top_1_n <- NA_real_
  rows$sex_top_2 <- ""
  rows$sex_top_2_n <- NA_real_
  rows$stratum <- .cm_aulas_make_stratum(rows, cfg$selector$strata_cols)
  rows <- .cm_aulas_demo_with_synthetic_students(rows, .cm_aulas_int(summary$population_n, 0L))
  rows <- rows[order(.cm_aulas_demo_wave_number(rows$wave), rows$historical_order), , drop = FALSE]
  rownames(rows) <- NULL

  frame_result <- list(
    schema = "calc_muestra_aulas_frame_v1",
    generated_at = .cm_aulas_now_iso(),
    input_mode = "base_madre",
    config = cfg,
    # W2: mismo contrato de eco de filtros que el marco real.
    filters_echo = .cm_aulas_filters_echo(cfg),
    frame_hash = .cm_aulas_hash(list(rows$classroom_id, rows$wave, rows$eligible_n, rows$operation_status)),
    population = data.frame(stringsAsFactors = FALSE),
    population_n = .cm_aulas_int(summary$population_n, .cm_aulas_unique_students_n(rows)),
    target_n = .cm_aulas_int(summary$target_n, 0L),
    oversample_n = .cm_aulas_int(summary$oversample_n, 0L),
    planned_m1 = .cm_aulas_int(summary$planned_m1, 0L),
    unique_students_n = .cm_aulas_unique_students_n(rows),
    aula_frame = rows,
    exclusions = data.frame(stringsAsFactors = FALSE),
    audit = data.frame(
      metric = c(
        "estudiantes_elegibles",
        "aulas_marco",
        "titulares_m1",
        "reservas_m2_m12",
        "aulas_control_campo",
        "reservas_usadas_campo",
        "privacidad"
      ),
      value = c(
        as.character(summary$population_n %||% 0),
        as.character(nrow(rows)),
        as.character(sum(rows$wave == "M1")),
        as.character(sum(rows$wave != "M1")),
        as.character(sum(rows$was_used_in_field %in% TRUE)),
        as.character(sum(rows$used_as_replacement %in% TRUE)),
        "sin PII embebida"
      ),
      detail = c(
        "Total de poblacion objetivo del calculo 2025.",
        "Marco colapsado por curso-horario/aula desde el workbook historico.",
        "Aulas titulares de la primera ola historica.",
        "Bolsas M2...M12 importadas como reservas operativas.",
        "Aulas cruzadas con la base de control de campo.",
        "Aulas de reserva efectivamente usadas en la operacion 2025.",
        "No se guardan nombres, correos, telefonos ni codigos reales de estudiantes/docentes."
      ),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    warnings = as.list(c(
      "Demo historica sanitarizada: los identificadores estudiantiles son sinteticos y solo sirven para mostrar metricas agregadas.",
      "La variable sexo por aula no esta precargada; al cargar base madre real se recalcula desde estudiantes unicos.",
      "Las aulas adicionales se tratan como reservas/agenda operativa, no como rediseno muestral."
    )),
    methodology = list(
      unit_observation = "estudiante",
      sampling_unit = "curso_horario_aula",
      construction = "Replica 2025: base institucional -> marco curso-horario -> N/cuotas -> M1 -> reservas M2...M12 -> agenda/control.",
      anonymity = "La demo no contiene PII. Monitoreo puede operar con collector/link/aula/fecha sin student_id."
    )
  )

  selection_run_id <- paste0("demo_aulas_2025_", substr(frame_result$frame_hash, 1, 8))
  selection_df <- rows
  selection_df$selection_run_id <- selection_run_id
  selection_df$orden <- ave(seq_len(nrow(selection_df)), selection_df$wave, FUN = seq_along)
  selection_df$estado <- selection_df$operation_status
  selection_df$replacement_for <- ""
  selection_df <- .cm_aulas_reconstruct_chains_from_order(selection_df)
  selection_df <- .cm_aulas_annotate_selection_metrics(selection_df, cfg$selector)
  design_pi <- .cm_aulas_design_probabilities(rows, cfg$selector, "sistematico_pps")
  pi_base <- as.numeric(design_pi[selection_df$classroom_id])
  pi_base[!is.finite(pi_base) | pi_base <= 0] <- pmin(0.999, cfg$selector$n_aulas / max(1, nrow(rows)))
  selection_df$pi_base <- pi_base
  selection_df$pi_design <- pi_base
  selection_df$pi_mc <- NA_real_
  selection_df$pi_final <- pi_base
  selection_df$probability_source <- "historical_systematic_pps_reconstructed_from_mos"
  selection_df$mc_runs <- 0L
  selection_df$mc_error_summary <- "Monte Carlo no ejecutado en replica historica; recalculable desde Comparar metodos."
  demo_extra_idx <- selection_df$sample_role == "extra_reserve_pool"
  if (any(demo_extra_idx)) {
    selection_df$probability_source[demo_extra_idx] <- "extra_pool_not_selected"
    selection_df$pi_final[demo_extra_idx] <- 0
  }
  selection_df$weight_classroom <- ifelse(selection_df$pi_final > 0, round(1 / selection_df$pi_final, 6), NA_real_)
  student_pi <- .cm_aulas_student_probability_summary(rows, stats::setNames(selection_df$pi_final, selection_df$classroom_id))
  selection_df$pi_student <- as.numeric(student_pi[selection_df$classroom_id])
  selection_df$weight_student <- ifelse(selection_df$pi_student > 0, round(1 / selection_df$pi_student, 6), NA_real_)
  selection_df$nonresponse_adjustment_flag <- FALSE
  selection_df$poststratification_flag <- FALSE
  selection_df$weight_warning <- "Pesos estudiantiles de demo calculados con IDs sinteticos anonimos; cargar base madre real para pesos internos definitivos."
  selection_df$peso_base <- selection_df$weight_classroom
  if (any(demo_extra_idx)) {
    selection_df$pi_student[demo_extra_idx] <- NA_real_
    selection_df$weight_student[demo_extra_idx] <- NA_real_
    selection_df$peso_base[demo_extra_idx] <- NA_real_
  }
  selection_df$student_ids_hash <- {
    ids_src <- if ("unique_student_ids" %in% names(selection_df)) selection_df$unique_student_ids
               else if ("unique_student_ids_frame" %in% names(selection_df)) selection_df$unique_student_ids_frame
               else NULL
    if (is.null(ids_src)) rep(.cm_aulas_hash(character(0)), nrow(selection_df))
    else vapply(ids_src, function(x) .cm_aulas_hash(.cm_aulas_student_ids(x)), character(1))
  }
  source_bundle <- .cm_aulas_source_bundle("sistematico_pps")
  selection_df$method_source <- source_bundle$method_source
  selection_df$official_reference <- source_bundle$official_reference
  selection_df$academic_reference <- source_bundle$academic_reference
  selection_df$implementation_reference <- source_bundle$implementation_reference
  selection_df$weight_source <- "pi_final reconstruida desde MOS de elegibles; weight_classroom = 1/pi_final."
  selection_df$nonresponse_policy <- cfg$selector$nonresponse_policy
  selection_df$replacement_policy <- cfg$selector$replacement_policy
  methodological_warning <- c(
    "Seleccion historica importada desde workbook 2025; no fue generada de nuevo por el motor actual.",
    "IDs estudiantiles sinteticos anonimos para demo; no exportar ni interpretar como PII.",
    "La comparacion avanzada debe recalcularse si se disena una nueva seleccion."
  )
  selection_df$methodological_warning <- paste(methodological_warning, collapse = " | ")

  representativity <- calc_muestra_aulas_representativity_objective(frame_result, selection_df, cfg$selector, cfg$objective)
  selection_df$representativity_score <- representativity$representativity_score
  selection_df$representativity_distance <- representativity$weighted_distance
  selection_df <- .cm_aulas_assign_operational_codes(selection_df)
  # El vínculo reserva -> titular viaja duplicado (slot y classroom_id) y sólo
  # el slot se actualiza cuando el titular de ese slot cambia. Ver el porqué en
  # `calc_muestra_aulas_profundidad.R`. Va DESPUÉS de asignar códigos para poder
  # re-derivar también `titular_operational_code`. Idempotente: con el vínculo
  # sano no toca ninguna fila, por eso se aplica en las tres rutas.
  selection_df <- .cm_aulas_reparar_vinculo_titular(selection_df)
  public_cols <- c(
    "selection_run_id", "operational_code", "titular_operational_code",
    "replacement_chain_code", "operational_sequence",
    "selection_slot_id", "sample_role", "wave", "replacement_order",
    "orden", "classroom_id", "label", "course_id",
    "course_name", "section", "schedule", "modality", "session_type", "teacher",
    "teacher_email", "teacher_type", "faculty", "faculty_aula", "program", "level", "course_level_num", "eligible_n", "enrolled_total",
    "p_aplicada_ref", "rendimiento_ref", "efectivas_esperadas", "meta_origen",
    "efectividad_fuente", "efectividad_periodo", "efectividad_tau",
    "factor_facultad", "facultad_k", "tasa_efectividad_aula",
    "size_group", "sex_top_1", "sex_top_1_n", "sex_top_2", "sex_top_2_n", "level_composition",
    "stratum", "historical_sample_label", "operation_status", "field_status",
    "scheduled_date", "scheduled_time", "applied_date", "applied_time",
    "total_sent", "was_used_in_field", "used_as_replacement",
    "pi_base", "pi_design", "pi_mc", "pi_final", "probability_source",
    "mc_runs", "mc_error_summary", "weight_classroom", "pi_student", "weight_student",
    "nonresponse_adjustment_flag", "poststratification_flag", "weight_warning",
    "peso_base", "selector_score", "unique_added", "duplicate_overlap",
    "representativity_score", "representativity_distance",
    "student_ids_hash", "estado", "replacement_for", "method_source",
    "official_reference", "academic_reference", "implementation_reference",
    "weight_source", "nonresponse_policy", "replacement_policy", "methodological_warning"
  )
  selection_public <- selection_df[, intersect(public_cols, names(selection_df)), drop = FALSE]
  summary_df <- data.frame(
    metric = c(
      "selection_run_id", "frame_hash", "seed", "selector_engine_requested",
      "selector_engine_used", "method_family", "probability_source", "mc_runs",
      "n_aulas_m1", "replacement_waves", "aulas_total_plan",
      "field_applied_rows", "field_replacement_rows",
      "unique_students_covered", "duplicate_overlap_total",
      "representativity_score", "representativity_distance"
    ),
    value = c(
      selection_run_id,
      frame_result$frame_hash,
      as.character(cfg$selector$seed),
      "sistematico_pps",
      "historical_import_2025",
      "pps_probability",
      "historical_systematic_pps_reconstructed_from_mos",
      "0",
      as.character(sum(selection_public$wave == "M1")),
      as.character(cfg$selector$replacement_waves),
      as.character(nrow(selection_public)),
      as.character(sum(selection_public$operation_status == "aplicada")),
      as.character(sum(selection_public$used_as_replacement %in% TRUE)),
      as.character(sum(selection_public$unique_added[selection_public$wave == "M1"], na.rm = TRUE)),
      as.character(sum(selection_public$duplicate_overlap[selection_public$wave == "M1"], na.rm = TRUE)),
      as.character(representativity$representativity_score),
      as.character(representativity$weighted_distance)
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  selection_result <- list(
    schema = "calc_muestra_aulas_selection_v1",
    selection_run_id = selection_run_id,
    generated_at = .cm_aulas_now_iso(),
    frame_hash = frame_result$frame_hash,
    seed = cfg$selector$seed,
    selector = cfg$selector,
    selector_engine = "sistematico_pps",
    selector_engine_used = "historical_import_2025",
    method_family = "pps_probability",
    method_source = source_bundle$method_source,
    official_reference = source_bundle$official_reference,
    academic_reference = source_bundle$academic_reference,
    implementation_reference = source_bundle$implementation_reference,
    probability_source = "historical_systematic_pps_reconstructed_from_mos",
    weight_source = "pi_final reconstruida desde MOS de elegibles; weight_classroom = 1/pi_final.",
    nonresponse_policy = cfg$selector$nonresponse_policy,
    replacement_policy = cfg$selector$replacement_policy,
    methodological_warning = as.list(methodological_warning),
    methodological_sources = source_bundle$active_sources,
    objective_config = representativity$objective_config,
    representativity = representativity,
    representativity_score = representativity$representativity_score,
    representativity_distance = representativity$weighted_distance,
    selection = selection_public,
    quotas = .cm_aulas_records(data.frame(stratum = names(.cm_aulas_quota_estratos(rows, cfg$selector$n_aulas, cfg$selector)), n_aulas = as.integer(.cm_aulas_quota_estratos(rows, cfg$selector$n_aulas, cfg$selector)), stringsAsFactors = FALSE)),
    summary = summary_df,
    diagnostics = list(
      probabilities = selection_public[, intersect(c("selection_run_id", "wave", "classroom_id", "stratum", "eligible_n", "pi_base", "pi_design", "pi_mc", "pi_final", "probability_source", "mc_runs", "mc_error_summary", "weight_classroom", "pi_student", "weight_student", "weight_warning"), names(selection_public)), drop = FALSE],
      balance = .cm_aulas_balance_diagnostic(rows, selection_public, cfg$selector$balance_vars),
      profile_distributions = representativity$profile_distributions,
      representativity_metrics = representativity$metrics,
      coverage_overlap = representativity$coverage_overlap,
      weight_stability = representativity$weight_stability,
      reserve_depth = representativity$reserve_depth,
      waves = .cm_aulas_wave_diagnostic(selection_public),
      nonresponse = .cm_aulas_nonresponse_template(cfg$selector),
      systematic_comparison = data.frame(
        criterio = c("aulas_m1_historicas", "aulas_aplicadas_control", "reservas_usadas"),
        selector_activo = c(sum(selection_public$wave == "M1"), sum(selection_public$operation_status == "aplicada"), sum(selection_public$used_as_replacement %in% TRUE)),
        sistematico_pps = c(sum(selection_public$wave == "M1"), NA, NA),
        stringsAsFactors = FALSE,
        check.names = FALSE
      )
    ),
    methodology = list(
      design = "Replica historica: base institucional -> marco curso-horario/aula -> M1 -> reservas M2...M12 -> agenda/control.",
      selector = "Seleccion historica importada; usar Generar seleccion para recalcular con el motor actual.",
      probabilities = "pi_base, pi_design y pi_final importadas desde la seleccion historica cuando existen.",
      monte_carlo = "No ejecutado para la replica precargada.",
      weights = "weight_classroom = 1/pi_final; weight_student usa IDs sinteticos anonimos solo para demo.",
      representativity = sprintf("Score de representatividad %.1f; distancia ponderada %.4f.", representativity$representativity_score, representativity$weighted_distance),
      warning = paste(methodological_warning, collapse = " | ")
    )
  )
  comparison <- .cm_aulas_demo_method_comparison(frame_result, selection_result, cfg, representativity)
  replacement <- .cm_aulas_demo_replacements(frame_result, selection_result, cfg)
  selection_result$method_comparison <- comparison
  selection_result$replacement_simulation <- replacement
  list(
    config = cfg,
    frame = frame_result,
    selection = selection_result,
    method_comparison = comparison,
    replacement_simulation = replacement
  )
}
