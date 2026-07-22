# =============================================================================
# Re-anclaje de las columnas de servicio (current_code / current_label) en las
# fuentes de render de Gráficos/PPT para bases hija repeat (ADR 0030).
# =============================================================================
#
# Problema (bug de producción 0.5.16). La apertura POR SERVICIO del plan de
# Gráficos (`graficos_plan_repeat_servicios.R`) emite cada lámina con
# `filtros = list(current_code = <código>)`, que el motor PPT resuelve contra la
# data de la fuente hija (`rep_servicios`). `current_code`/`current_label` son
# campos `calculate` del roster: la fuente de PROCESAMIENTO los conserva (63
# cols), pero la fuente ANALÍTICA/adaptada los strippea (25 cols). Cuando el
# estudio tiene ambas bases codificadas (fuente "adaptados"), el render recibe
# una data SIN `current_code` y `.apply_named_filters` revienta TODA la lámina
# con "La variable de filtro `current_code` no existe en `data`".
#
# Fix robusto (independiente de qué fuente sirva el render). Justo antes de
# entregar las fuentes al render/export, garantizamos que TODA base hija repeat
# tenga `current_code` y `current_label`, re-anclándolos desde la data CRUDA de
# la propia hija con la maquinaria canónica de `entregables_repeats.R`
# (`.repeat_service_labels_from_raw`, que empareja por `_index`/`_submission__id`).
# Para bases que no son hija repeat (o cuyo raw no tiene esas columnas) es un
# no-op: `.repeat_service_labels_from_raw` devuelve NULL y no se toca nada.
#
# Lo invoca `.graficos_processing_sources` (finalize_sources) con una línea.

#' Re-ancla `current_code`/`current_label` en cada fuente hija repeat cuya data de
#' render los haya perdido. Sólo AGREGA columnas ausentes (nunca sobrescribe una
#' ya presente y correcta) y sólo cuando el re-anclaje resuelve un vector alineado
#' a las filas. Degrada sin romper: cualquier fallo por base se ignora y la fuente
#' queda como estaba (la defensa en profundidad del filtro cubre el resto).
#' @keywords internal
.graficos_reanchor_repeat_service_cols <- function(sid, src) {
  if (!is.list(src) || !is.list(src$data_sources) || !length(src$data_sources)) {
    return(src)
  }
  service_cols <- c("current_code", "current_label")
  for (nm in names(src$data_sources)) {
    data <- src$data_sources[[nm]]
    if (!is.data.frame(data) || !nrow(data)) next
    missing_cols <- service_cols[!service_cols %in% names(data)]
    if (!length(missing_cols)) next
    for (col in missing_cols) {
      vals <- tryCatch(
        .repeat_service_labels_from_raw(sid, nm, data, col),
        # Silenciamiento justificado: el re-anclaje es best-effort; una base que
        # no resuelve su servicio simplemente no gana la columna (degrada al
        # comportamiento previo, cubierto por la defensa del filtro).
        error = function(e) NULL
      )
      if (is.null(vals) || length(vals) != nrow(data)) next
      data[[col]] <- vals
    }
    src$data_sources[[nm]] <- data
  }
  src
}
