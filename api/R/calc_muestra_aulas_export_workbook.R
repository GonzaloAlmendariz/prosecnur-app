# Export del workbook de seleccion de aulas (D5: extraido del congelado
# calc_muestra_aulas.R, decision de Gonzalo «extraer contenido de forma tal que
# no se rompa»). Movimiento puro: el paquete sourcea todos los R/ juntos, asi
# que las llamadas cruzadas (.cm_aulas_as_df, .cm_aulas_codigo_operativo, ...)
# no cambian. Aqui viven la hoja de rutas operativas (solo la consume el
# export) y calc_muestra_aulas_exportar_workbook, el XLSX de 24+ hojas que
# descarga Entrega.

.cm_aulas_operational_routes_sheet <- function(selection_result, replacement_simulation = NULL, max_depth = NULL) {
  selection <- .cm_aulas_as_df(selection_result$selection %||% data.frame(stringsAsFactors = FALSE), "selection")
  if (!nrow(selection)) return(data.frame(stringsAsFactors = FALSE))
  cell <- function(df, candidates, row = 1L) {
    for (candidate in .cm_aulas_chr_vec(candidates)) {
      if (candidate %in% names(df) && length(df[[candidate]]) >= row) return(df[[candidate]][[row]])
    }
    ""
  }
  if (!"wave" %in% names(selection)) selection$wave <- ""
  if (!"classroom_id" %in% names(selection)) selection$classroom_id <- ""
  roles <- .cm_aulas_role_values(selection)
  titulars <- selection[roles == "titular" | as.character(selection$wave) == "M1", , drop = FALSE]
  reserves <- selection[roles == "chain_reserve", , drop = FALSE]
  if (nrow(reserves)) {
    reserves$.wave_number <- vapply(reserves$wave, .cm_aulas_wave_number, integer(1))
    reserves <- reserves[order(reserves$.wave_number), , drop = FALSE]
  }
  suggestions <- .cm_aulas_as_df(replacement_simulation$suggestions %||% data.frame(stringsAsFactors = FALSE), "replacement_suggestions")
  if (nrow(suggestions) && !"rank" %in% names(suggestions)) suggestions$rank <- seq_len(nrow(suggestions))
  # Sin profundidad pedida, la hoja sigue a la cadena que el motor construyo. El
  # default fijo en 6 exportaba 6 reemplazos por titular cuando la seleccion
  # trae 11, y esta hoja es la que viaja a campo.
  depth <- if (is.null(max_depth)) .cm_aulas_reservas_por_titular(reserves, titulars) else .cm_aulas_int(max_depth, 6L)
  depth <- max(1L, min(12L, depth))
  if (!nrow(titulars)) return(data.frame(stringsAsFactors = FALSE))
  route_rows <- lapply(seq_len(nrow(titulars)), function(i) {
    titular <- titulars[i, , drop = FALSE]
    titular_id <- .cm_aulas_scalar(cell(titular, "classroom_id"), "")
    titular_faculty <- .cm_aulas_scalar(cell(titular, c("faculty", "stratum")), "")
    titular_stratum <- .cm_aulas_scalar(cell(titular, c("stratum", "faculty")), "")
    titular_label <- .cm_aulas_scalar(cell(titular, c("course_name", "label", "classroom_id")), "")
    slots <- list()
    used <- character(0)
    if (nrow(suggestions) && "titular_classroom_id" %in% names(suggestions)) {
      sug <- suggestions[as.character(suggestions$titular_classroom_id) == titular_id, , drop = FALSE]
      if (nrow(sug)) {
        sug$.rank <- suppressWarnings(as.numeric(sug$rank))
        sug$.rank[!is.finite(sug$.rank)] <- seq_len(nrow(sug))[!is.finite(sug$.rank)]
        sug <- sug[order(sug$.rank), , drop = FALSE]
        for (j in seq_len(min(nrow(sug), depth))) {
          reserve_id <- .cm_aulas_scalar(cell(sug, "reserve_classroom_id", j), "")
          used <- c(used, reserve_id)
          slots[[length(slots) + 1L]] <- list(
            id = reserve_id,
            operational_code = .cm_aulas_scalar(cell(sug, c("reserve_operational_code", "replacement_chain_code"), j), ""),
            label = .cm_aulas_scalar(cell(sug, "reserve_label", j) %||% reserve_id, ""),
            wave = .cm_aulas_scalar(cell(sug, "wave", j), ""),
            match = .cm_aulas_scalar(cell(sug, "match_level", j), ""),
            score_delta = .cm_aulas_scalar(cell(sug, "score_delta", j), ""),
            warning = .cm_aulas_scalar(cell(sug, "warning", j), "")
          )
        }
      }
    }
    if (length(slots) < depth && nrow(reserves)) {
      fallback <- reserves
      if ("classroom_id" %in% names(fallback)) fallback <- fallback[!as.character(fallback$classroom_id) %in% used, , drop = FALSE]
      if ("selection_slot_id" %in% names(fallback) && "selection_slot_id" %in% names(titular)) {
        tied <- fallback[as.character(fallback$selection_slot_id) == .cm_aulas_scalar(cell(titular, "selection_slot_id"), ""), , drop = FALSE]
        if (nrow(tied)) fallback <- tied
      } else if ("replacement_for" %in% names(fallback)) {
        tied <- fallback[as.character(fallback$replacement_for) == titular_id, , drop = FALSE]
        if (nrow(tied)) fallback <- tied
      }
      same_stratum <- if ("stratum" %in% names(fallback)) as.character(fallback$stratum) == titular_stratum else rep(FALSE, nrow(fallback))
      same_faculty <- if ("faculty" %in% names(fallback)) as.character(fallback$faculty) == titular_faculty else rep(FALSE, nrow(fallback))
      fallback <- fallback[same_stratum | same_faculty, , drop = FALSE]
      if (nrow(fallback)) {
        for (j in seq_len(min(nrow(fallback), depth - length(slots)))) {
          reserve <- fallback[j, , drop = FALSE]
          reserve_id <- .cm_aulas_scalar(cell(reserve, "classroom_id"), "")
          slots[[length(slots) + 1L]] <- list(
            id = reserve_id,
            operational_code = .cm_aulas_scalar(cell(reserve, c("operational_code", "replacement_chain_code")), ""),
            label = .cm_aulas_scalar(cell(reserve, c("course_name", "label", "classroom_id")), ""),
            wave = .cm_aulas_scalar(cell(reserve, "wave"), ""),
            match = if (.cm_aulas_scalar(cell(reserve, "stratum"), "") == titular_stratum) "misma_celda" else "misma_facultad",
            score_delta = "",
            warning = ""
          )
        }
      }
    }
    out <- list(
      titular_operational_code = .cm_aulas_scalar(cell(titular, c("operational_code", "titular_operational_code")), ""),
      titular_classroom_id = titular_id,
      titular_label = titular_label,
      faculty = titular_faculty,
      stratum = titular_stratum,
      eligible_n = .cm_aulas_scalar(cell(titular, "eligible_n"), ""),
      schedule = .cm_aulas_scalar(cell(titular, "schedule"), ""),
      monitoring_action = "Activar siguiente reserva viable; registrar motivo; recalcular brecha efectiva; no redisenar marco base."
    )
    for (slot_index in seq_len(depth)) {
      slot <- if (length(slots) >= slot_index && is.list(slots[[slot_index]])) {
        slots[[slot_index]]
      } else {
        list(id = "", label = "", wave = "", match = "", score_delta = "", warning = "")
      }
      prefix <- paste0("m", slot_index + 1L)
      out[[paste0(prefix, "_operational_code")]] <- slot$operational_code %||% ""
      out[[paste0(prefix, "_classroom_id")]] <- slot$id
      out[[paste0(prefix, "_label")]] <- slot$label
      out[[paste0(prefix, "_wave")]] <- slot$wave
      out[[paste0(prefix, "_match")]] <- slot$match
      out[[paste0(prefix, "_score_delta")]] <- slot$score_delta
      out[[paste0(prefix, "_warning")]] <- slot$warning
    }
    as.data.frame(out, stringsAsFactors = FALSE, check.names = FALSE)
  })
  do.call(rbind, route_rows)
}

calc_muestra_aulas_exportar_workbook <- function(frame_result, selection_result, path, comparison = NULL, replacement_simulation = NULL) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop("El paquete R 'openxlsx' no esta instalado.", call. = FALSE)
  }
  wb <- openxlsx::createWorkbook()
  canonicalize_codes <- function(data, name) {
    df <- .cm_aulas_as_df(data, name)
    exact <- c(
      "operational_code", "titular_operational_code",
      "replacement_chain_code", "first_replacement_code",
      "reserve_operational_code", "replacement_operational_code"
    )
    code_cols <- names(df)[
      names(df) %in% exact |
        grepl("^m[0-9]+_operational_code$", names(df))
    ]
    for (column in code_cols) {
      df[[column]] <- .cm_aulas_codigo_operativo(df[[column]])
    }
    df
  }
  write_sheet <- function(name, data) {
    openxlsx::addWorksheet(wb, name)
    openxlsx::writeData(wb, name, canonicalize_codes(data, name))
  }
  openxlsx::addWorksheet(wb, "Marco aulas")
  openxlsx::writeData(wb, "Marco aulas", .cm_aulas_as_df(frame_result$aula_frame, "aula_frame"))
  selection_df <- canonicalize_codes(selection_result$selection, "selection")
  write_sheet("Seleccion", selection_df)
  roles <- .cm_aulas_role_values(selection_df)
  write_sheet("Aulas titulares", selection_df[roles == "titular" | selection_df$wave == "M1", , drop = FALSE])
  write_sheet("Reemplazos por titular", selection_result$diagnostics$replacement_chains %||% .cm_aulas_replacement_chains_table(selection_df))
  write_sheet("Reserva extra", selection_result$diagnostics$extra_reserve_pool %||% .cm_aulas_extra_pool_table(selection_df))
  openxlsx::addWorksheet(wb, "Auditoria marco")
  openxlsx::writeData(wb, "Auditoria marco", .cm_aulas_as_df(frame_result$audit, "audit"))
  openxlsx::addWorksheet(wb, "Resumen seleccion")
  openxlsx::writeData(wb, "Resumen seleccion", .cm_aulas_as_df(selection_result$summary, "summary"))
  write_sheet("Sustento metodológico", selection_result$methodological_sources %||% .cm_aulas_methodological_sources())
  write_sheet("Probabilidades y pesos", selection_result$diagnostics$probabilities %||% data.frame(stringsAsFactors = FALSE))
  write_sheet("Diagnóstico de balance", selection_result$diagnostics$balance %||% data.frame(stringsAsFactors = FALSE))
  profile <- selection_result$diagnostics$profile_distributions %||% data.frame(stringsAsFactors = FALSE)
  frame_profile <- if (is.data.frame(profile) && nrow(profile)) {
    unique(profile[, intersect(c("dimension", "variable", "label", "category", "source", "frame_n", "frame_prop", "tolerance"), names(profile)), drop = FALSE])
  } else {
    data.frame(stringsAsFactors = FALSE)
  }
  selected_profile <- if (is.data.frame(profile) && nrow(profile)) {
    profile[, intersect(c("dimension", "variable", "label", "category", "source", "selected_n", "selected_prop", "error_balance", "abs_error", "within_tolerance"), names(profile)), drop = FALSE]
  } else {
    data.frame(stringsAsFactors = FALSE)
  }
  write_sheet("Perfil del marco", frame_profile)
  write_sheet("Perfil seleccionado", selected_profile)
  write_sheet("Score de representatividad", selection_result$diagnostics$representativity_metrics %||% data.frame(stringsAsFactors = FALSE))
  write_sheet("Cobertura y solape", selection_result$diagnostics$coverage_overlap %||% data.frame(stringsAsFactors = FALSE))
  write_sheet("Reservas por ola", selection_result$diagnostics$reserve_depth %||% data.frame(stringsAsFactors = FALSE))
  write_sheet("Olas coordinadas", selection_result$diagnostics$waves %||% data.frame(stringsAsFactors = FALSE))
  write_sheet("No respuesta", selection_result$diagnostics$nonresponse %||% data.frame(stringsAsFactors = FALSE))
  write_sheet("Comparación con sistemático", selection_result$diagnostics$systematic_comparison %||% data.frame(stringsAsFactors = FALSE))
  comparison <- comparison %||% selection_result$method_comparison %||% NULL
  replacement_simulation <- replacement_simulation %||% selection_result$replacement_simulation %||% NULL
  write_sheet("Comparador de métodos", comparison$methods %||% data.frame(stringsAsFactors = FALSE))
  write_sheet("Simulaciones", comparison$simulation_summary %||% data.frame(stringsAsFactors = FALSE))
  write_sheet("Riesgos metodológicos", comparison$risk_flags %||% data.frame(stringsAsFactors = FALSE))
  write_sheet("Reemplazos sugeridos", replacement_simulation$suggestions %||% data.frame(stringsAsFactors = FALSE))
  write_sheet("Impacto de reemplazos", replacement_simulation$impact %||% data.frame(stringsAsFactors = FALSE))
  write_sheet("Rutas operativas aulas", .cm_aulas_operational_routes_sheet(selection_result, replacement_simulation))
  openxlsx::addWorksheet(wb, "Bitacora metodologica")
  bitacora <- data.frame(
    campo = c(
      "selection_run_id", "frame_hash", "seed", "selector_engine",
      "selector_engine_used", "probability_source", "weight_source",
      "nonresponse_policy", "replacement_policy", "methodological_warning",
      "official_reference", "academic_reference", "implementation_reference",
      "representativity_score", "representativity_distance",
      "diseno", "selector", "probabilidades", "pesos", "representatividad"
    ),
    valor = c(
      selection_result$selection_run_id,
      selection_result$frame_hash,
      as.character(selection_result$seed),
      selection_result$selector_engine %||% "",
      selection_result$selector_engine_used %||% "",
      selection_result$probability_source %||% "",
      selection_result$weight_source %||% "",
      selection_result$nonresponse_policy %||% "",
      selection_result$replacement_policy %||% "",
      paste(.cm_aulas_chr_vec(selection_result$methodological_warning), collapse = " | "),
      selection_result$official_reference %||% "",
      selection_result$academic_reference %||% "",
      selection_result$implementation_reference %||% "",
      as.character(selection_result$representativity_score %||% ""),
      as.character(selection_result$representativity_distance %||% ""),
      selection_result$methodology$design,
      selection_result$methodology$selector,
      paste(selection_result$methodology$probabilities, selection_result$methodology$monte_carlo),
      selection_result$methodology$weights %||% "",
      selection_result$methodology$representativity %||% ""
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  openxlsx::writeData(wb, "Bitacora metodologica", bitacora)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}
