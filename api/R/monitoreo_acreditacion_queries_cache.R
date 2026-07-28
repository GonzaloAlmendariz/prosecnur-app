# Rehidratación local de las consultas internas de acreditación.
#
# El `.pulso` persiste `monitoreo_snapshot$reports$internal_queries` como una
# **lista vacía**, no como NULL. Como `%||%` (helpers_calc_comunes.R) solo cae
# con NULL o NA, la expresión
#
#     cached_reports$internal_queries %||% .monitoreo_acreditacion_internal_queries(...)
#
# devolvía la lista vacía para siempre: al reabrir un proyecto guardado, las
# cuatro pestañas de Consultas quedaban mudas aunque el snapshot trajera los
# casos reales (acrconta: 1.277 filas con Código PUCP, nombres y `dim_actor`).
#
# Eso no es cosmético. Por el ADR 0040 §3 el `case_rollup` reconciliado es la
# fuente de verdad para promover a Procesamiento, así que un cache vacío
# bloquea el handoff completo. Y la reconciliación **no necesita red**:
# `.monitoreo_acreditacion_internal_queries()` solo consume `data` y `profile`,
# ambos ya persistidos. Antes de esto, el único camino para repoblarla era
# `/api/monitoreo/sync`, que exige Google Sheets y SurveyMonkey en línea.

#' Un cache de consultas internas cuenta como ausente si no trae casos.
#'
#' Distingue "no se calculó nunca / se persistió vacío" de "se calculó y dio
#' cero", que son estados operativamente distintos: el primero se recalcula, el
#' segundo se respeta.
#' @keywords internal
.monitoreo_acreditacion_queries_cache_vacio <- function(internal_queries) {
  if (is.null(internal_queries)) return(TRUE)
  if (!is.list(internal_queries)) return(TRUE)
  if (!length(internal_queries)) return(TRUE)
  tiene_casos <- length(internal_queries$cases %||% list()) > 0L
  tiene_rollup <- length(internal_queries$case_rollup %||% list()) > 0L
  tiene_totales <- length(internal_queries$totals %||% list()) > 0L
  !(tiene_casos || tiene_rollup || tiene_totales)
}

#' Devuelve el cache de consultas internas, recalculándolo si llegó vacío.
#'
#' Sin red: reusa el snapshot ya persistido. Si el snapshot tampoco tiene data
#' utilizable devuelve el cache tal cual, para no inventar un corte.
#' @keywords internal
.monitoreo_acreditacion_queries_hidratadas <- function(data, profile = list(), cached = NULL) {
  if (!.monitoreo_acreditacion_queries_cache_vacio(cached)) return(cached)
  if (is.null(data) || !is.data.frame(data) || !nrow(data)) return(cached %||% list())
  recalculado <- tryCatch(
    .monitoreo_acreditacion_internal_queries(data, profile),
    # Un corte viejo puede no tener las columnas que espera la reconciliación.
    # Ahí se conserva el cache vacío y la UI lo dice; no se rompe la apertura
    # del proyecto por una rehidratación oportunista.
    error = function(e) NULL
  )
  # Deliberadamente NO se marca el payload con una bandera de procedencia: la
  # forma de `internal_queries` es contrato y hay pruebas que la comparan
  # completa. Si algun dia hace falta trazar la rehidratacion, va en un canal
  # aparte (log o metadata del dashboard), no dentro del contrato.
  if (is.null(recalculado)) return(cached %||% list())
  recalculado
}

#' Rehidrata las consultas internas dentro de un dashboard servido desde cache.
#'
#' NO se rehidrata en los scopes `source`, `advance_summary` ni `phone_summary`:
#' su contrato es justamente ser payloads livianos y hay pruebas que exigen
#' `internal_queries == list()` ahi. La reconstruccion vive en `queries_summary`
#' —el scope que Consultas pide— y en el dashboard cacheado, que es el camino
#' por el que se abre un `.pulso` guardado.
#'
#' `.monitoreo_dashboard_for_session()` puede devolver el dashboard completo
#' desde `snapshot$dashboard`, sin pasar por `monitoreo_acreditacion_reportes()`.
#' Ese camino es justo el de abrir un `.pulso` guardado, y es donde el cache
#' vacio se volvia permanente.
#' @keywords internal
.monitoreo_acreditacion_rehidratar_dashboard <- function(dashboard, data, profile = list()) {
  if (!is.list(dashboard) || !is.list(dashboard$acreditacion_reports)) return(dashboard)
  reports <- dashboard$acreditacion_reports
  if (!.monitoreo_acreditacion_queries_cache_vacio(reports$internal_queries)) return(dashboard)
  reports$internal_queries <- .monitoreo_acreditacion_queries_hidratadas(data, profile, reports$internal_queries)
  dashboard$acreditacion_reports <- reports
  dashboard
}
