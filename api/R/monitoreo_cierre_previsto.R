# El cierre previsto del campo, de cara al informe (Gonzalo, 2026-11-06: «que el
# reporte pueda definir la fecha esperada del cierre de campo»).
#
# No se teclea en otro sitio: es el fin de la última fase del plan de campo
# (Modelo › Plan de campo, `strategy_phases`), que ya declara cuándo entra cada
# público. Un segundo campo «cierre» podría contradecir al plan; leerlo del plan
# deja una sola fuente.

#' Fecha de cierre previsto: el `end_date` más tardío de las fases del plan.
#'
#' @param config configuración de monitoreo (lee `strategy_phases`).
#' @return `Date` o `NA` si ninguna fase declara fin.
#' @noRd
monitoreo_cierre_previsto <- function(config = list()) {
  fases <- config$strategy_phases %||% list()
  if (is.data.frame(fases)) fases <- lapply(seq_len(nrow(fases)), function(i) as.list(fases[i, , drop = FALSE]))
  if (!is.list(fases) || !length(fases)) return(as.Date(NA))
  fines <- vapply(fases, function(fase) {
    valor <- if (is.list(fase)) fase$end_date %||% "" else ""
    substr(.monitoreo_scalar(valor, ""), 1L, 10L)
  }, character(1))
  fechas <- suppressWarnings(as.Date(fines[grepl("^\\d{4}-\\d{2}-\\d{2}$", fines)]))
  fechas <- fechas[!is.na(fechas)]
  if (!length(fechas)) return(as.Date(NA))
  max(fechas)
}

#' Marca el modelo del PDF de acreditación con su tipo y su cierre previsto.
#'
#' Vive aquí y no en el router porque `router_monitoreo.R` está congelado a
#' crecimiento: el router llama a esta función en la línea donde fijaba el tipo.
#' @noRd
.monitoreo_acreditacion_marcar_reporte <- function(model, cfg) {
  model$report_kind <- "acreditacion_client_report_pdf"
  cierre <- monitoreo_cierre_previsto(cfg)
  model$cierre_previsto <- if (is.na(cierre)) "" else format(cierre, "%Y-%m-%d")
  model
}
