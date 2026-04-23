# =============================================================================
# Limpieza y normalización — builder
# =============================================================================
# Consolida el estado de validación de una base en:
#   - KPIs de salud (total casos con ≥1 inconsistencia, reglas activas, etc.)
#   - Top 5 reglas violadas (bar_h clickable → drill en Instrumento tab)
#   - Top 5 variables problemáticas (bar_h clickable → Explorar esa variable)
#   - Checklist de progreso (plan construido, auditoría corrida, # custom)
#
# Los ViewDescriptors retornados llevan `actions` con `target_tab` y
# `target_payload` para que el frontend, al clickear, salte al tab
# correspondiente con prefill automático.

# -----------------------------------------------------------------------------
# KPIs consolidados
# -----------------------------------------------------------------------------
.limpieza_kpis <- function(scope) {
  ev <- scope$evaluacion
  plan <- scope$plan_result$plan
  reglas_custom <- scope$reglas_custom %||% list()
  desactivadas <- scope$reglas_desactivadas %||% character(0)

  n_reglas_plan <- if (!is.null(plan)) nrow(plan) else 0L
  n_reglas_custom <- length(reglas_custom)
  n_custom_activas <- sum(vapply(reglas_custom,
                                   function(r) isTRUE(r$activa), logical(1)))
  n_desactivadas <- length(desactivadas)
  n_reglas_efectivas <- max(0L, as.integer(n_reglas_plan - n_desactivadas)) +
                        n_custom_activas

  # Si no hay evaluación todavía, KPIs mínimos (progreso).
  if (is.null(ev)) {
    return(list(
      vd_kpi_card(
        title = "Reglas activas",
        value = as.integer(n_reglas_efectivas),
        subtitle = sprintf(
          "%d del instrumento · %d custom",
          as.integer(n_reglas_plan - n_desactivadas),
          as.integer(n_custom_activas)
        ),
        severidad = if (n_reglas_efectivas > 0L) "neutral" else "warn",
        icon = "list-checks"
      )
    ))
  }

  resumen <- ev$resumen
  total_raw <- tryCatch(total_inconsistencias(ev), error = function(e) NULL)
  total <- if (is.numeric(total_raw) && length(total_raw) == 1L) {
    as.integer(total_raw)
  } else if (is.list(total_raw) && !is.null(total_raw$cabecera)) {
    ca <- total_raw$cabecera
    as.integer(if (is.data.frame(ca)) ca$Total_inconsistencias[1]
               else ca[[1]]$Total_inconsistencias)
  } else NA_integer_

  n_reglas_con_casos <- if (!is.null(resumen)) {
    sum(as.integer(resumen$n_inconsistencias) > 0L, na.rm = TRUE)
  } else 0L

  sev_total <- if (is.na(total) || total == 0L) "success"
                else if (total < 50L) "warn" else "danger"

  list(
    vd_kpi_card(
      title = "Total inconsistencias",
      value = if (is.na(total)) "—" else as.integer(total),
      subtitle = sprintf("Detectadas por %d reglas activas", as.integer(n_reglas_efectivas)),
      severidad = sev_total,
      icon = "alert-triangle"
    ),
    vd_kpi_card(
      title = "Reglas con casos",
      value = as.integer(n_reglas_con_casos),
      subtitle = if (!is.null(resumen))
                    sprintf("de %d reglas evaluadas", as.integer(nrow(resumen)))
                  else "—",
      severidad = if (n_reglas_con_casos == 0L) "success" else "neutral",
      icon = "list-checks"
    ),
    vd_kpi_card(
      title = "Reglas personalizadas",
      value = as.integer(n_custom_activas),
      subtitle = if (n_custom_activas == n_reglas_custom)
                    "Todas activas"
                  else sprintf("%d/%d activas",
                                as.integer(n_custom_activas),
                                as.integer(n_reglas_custom)),
      severidad = "neutral",
      icon = "pie-chart"
    )
  )
}

# -----------------------------------------------------------------------------
# Top 5 reglas violadas (con deep-link al tab Instrumento)
# -----------------------------------------------------------------------------
.limpieza_top_reglas <- function(scope) {
  ev <- scope$evaluacion
  if (is.null(ev) || is.null(ev$resumen) || !nrow(ev$resumen)) {
    return(vd_bar_h(
      title = "Top reglas violadas",
      labels = character(), values = numeric(),
      meta = list(empty_hint = "Aún no hay auditoría corrida.")
    ))
  }
  res <- ev$resumen
  mask <- !is.na(res$n_inconsistencias) & as.integer(res$n_inconsistencias) > 0L
  res <- res[mask, , drop = FALSE]
  if (!nrow(res)) {
    return(vd_bar_h(
      title = "Top reglas violadas",
      labels = character(), values = numeric(),
      meta = list(empty_hint = "Ninguna regla reportó casos — todo OK.")
    ))
  }
  res <- res[order(-res$n_inconsistencias), , drop = FALSE]
  res <- utils::head(res, 5L)
  labels <- as.character(res$nombre_regla %||% res$id_regla)
  labels <- ifelse(nchar(labels) > 60L,
                    paste0(substr(labels, 1, 58), "…"), labels)
  ids <- as.character(res$id_regla)

  # action → jumpTo tab instrumento con id_regla prefill.
  vd_bar_h(
    title = "Top 5 reglas violadas",
    subtitle = "Resumen de las reglas que más concentran inconsistencias en la corrida actual.",
    labels = labels,
    values = as.integer(res$n_inconsistencias),
    ids = ids,
    x_title = "Casos inconsistentes",
    actions = list(list(
      id = "drill_regla",
      label = "Abrir drill en Instrumento",
      target_tab = "instrumento",
      payload = list()
    )),
    meta = list(
      eyebrow = "Resumen de salud",
      note = "Estas reglas alimentan la cola de inconsistencias por resolver."
    )
  )
}

# -----------------------------------------------------------------------------
# Top 5 variables problemáticas (agregando por variable_1 del resumen)
# -----------------------------------------------------------------------------
.limpieza_top_variables <- function(scope) {
  ev <- scope$evaluacion
  if (is.null(ev) || is.null(ev$resumen) || !nrow(ev$resumen)) {
    return(vd_bar_h(
      title = "Top variables con problemas",
      labels = character(), values = numeric(),
      meta = list(empty_hint = "Aún no hay auditoría corrida.")
    ))
  }
  # Tomamos variable_1 desde reglas_meta si existe, sino desde resumen.
  meta <- ev$reglas_meta
  res <- ev$resumen
  if (!is.null(meta) && "variable_1" %in% names(meta)) {
    merged <- dplyr::left_join(
      dplyr::select(res, id_regla, n_inconsistencias),
      dplyr::select(meta, id_regla, variable_1),
      by = "id_regla"
    )
    var_col <- "variable_1"
  } else {
    merged <- dplyr::select(res, id_regla, n_inconsistencias)
    merged$variable_1 <- NA_character_
    var_col <- "variable_1"
  }
  merged <- merged[!is.na(merged[[var_col]]) & nzchar(merged[[var_col]]), , drop = FALSE]
  if (!nrow(merged)) {
    return(vd_bar_h(
      title = "Top variables con problemas",
      labels = character(), values = numeric(),
      meta = list(empty_hint = "No se pudo identificar variables afectadas.")
    ))
  }
  agg <- aggregate(merged$n_inconsistencias,
                    by = list(var = as.character(merged[[var_col]])),
                    FUN = function(x) sum(as.integer(x), na.rm = TRUE))
  names(agg) <- c("var", "n")
  agg <- agg[order(-agg$n), , drop = FALSE]
  agg <- utils::head(agg, 5L)
  if (!nrow(agg)) {
    return(vd_bar_h(
      title = "Top variables con problemas",
      labels = character(), values = numeric(),
      meta = list(empty_hint = "Sin datos por variable.")
    ))
  }
  vd_bar_h(
    title = "Top 5 variables con problemas",
    subtitle = "Variables que concentran más casos observados en las reglas evaluadas.",
    labels = as.character(agg$var),
    values = as.integer(agg$n),
    ids = as.character(agg$var),
    x_title = "Casos acumulados",
    actions = list(list(
      id = "open_variable",
      label = "Abrir en Explorar",
      target_tab = "explorar",
      payload = list()
    )),
    meta = list(
      eyebrow = "Variables críticas",
      note = "Sirve como guía para priorizar reemplazos, normalizaciones e imputaciones dentro del cierre."
    )
  )
}

# -----------------------------------------------------------------------------
# Public: arma el payload completo de Limpieza y normalización
# -----------------------------------------------------------------------------
build_limpieza <- function(scope, sid = NULL, base_nombre = NULL, preview_override = NULL) {
  decisions <- scope$limpieza_draft %||% list()
  queue <- .limpieza_build_decision_queue(scope, decisions)
  preview <- if (!is.null(preview_override)) {
    preview_override
  } else if (!is.null(sid)) {
    .limpieza_simulate(sid, base_nombre, scope, decisions)
  } else {
    NULL
  }
  module_stats <- .limpieza_build_module_stats(decisions, queue, preview)
  summary <- .limpieza_build_summary(scope, queue, decisions, preview)

  list(
    progreso = list(
      plan_construido = !is.null(scope$plan_result),
      auditoria_corrida = !is.null(scope$evaluacion),
      n_reglas_custom = length(scope$reglas_custom %||% list())
    ),
    summary = summary,
    kpis = .limpieza_kpis(scope),
    top_reglas = .limpieza_top_reglas(scope),
    top_variables = .limpieza_top_variables(scope),
    decision_queue = queue,
    decision_draft = decisions,
    module_stats = module_stats,
    before_after_preview = preview,
    artifacts = scope$limpieza_artifacts %||% list()
  )
}
