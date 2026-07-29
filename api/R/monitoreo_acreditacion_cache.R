# Cache de reportes de Acreditación, por scope y dentro del `.pulso`.
#
# El problema que resuelve, medido en acrconta: el snapshot guarda UN dashboard
# —el de `advance_summary`, según `dashboard_report_scope`— y la interfaz pide
# cuatro scopes al abrir (`source`, `advance_summary`, `queries_summary`,
# `phone_summary`). Los otros tres nunca encuentran token válido, así que se
# recalculan enteros en cada apertura y en cada guardado de configuración. En
# los logs eso se ve como `report_cache= cache_hit=0` en todas las líneas de
# acreditación, y en la máquina como tres procesos de R al 97%.
#
# Territorial ya resolvió esto con un cache por entradas dentro del snapshot
# (`.monitoreo_territorial_report_cache_*`). Este archivo replica ese patrón
# para acreditación y telefónico, con dos diferencias deliberadas:
#
#   1. No hay fase ni hash de rutas: en acreditación el corte no depende de una
#      fase activa.
#   2. El hash de configuración se calcula sobre la configuración COMPLETA, no
#      sobre una lista de campos elegidos. Enumerar campos es más preciso y más
#      rápido, pero olvidar uno significa servir un reporte viejo después de
#      cambiar el estudio —y un número desactualizado que parece fresco es peor
#      que esperar—. Cualquier cambio en la configuración invalida el cache.

# La version del esquema es parte de la clave, y por eso hay que SUBIRLA cada
# vez que cambia la forma de calcular los reportes —no solo cuando cambia la
# forma de guardarlos—. Un cambio de codigo no altera ni los datos ni la
# configuracion, asi que sin subirla el cache sigue sirviendo lo que calculo la
# version anterior del motor. Paso justo eso al conectar las variables de
# interes con el reporte de control: la vista seguia mostrando "0 variables"
# con el motor ya arreglado.
#
#   v1 -> v2: los controles del reporte pasan a respetar `interest_variables`.
.MONITOREO_ACR_CACHE_SCHEMA <- "monitoreo_acreditacion_report_cache_v2"

# Cuatro scopes por corte; el margen deja convivir un par de cortes recientes
# sin que el `.pulso` crezca sin freno.
.MONITOREO_ACR_CACHE_LIMIT <- 12L

.monitoreo_acr_cache_families <- c("acreditacion", "telefonico")

#' ¿Esta familia y este scope usan el cache de reportes de acreditación?
.monitoreo_acr_cache_aplica <- function(family, report_scope, include_reports = TRUE) {
  if (!isTRUE(include_reports)) return(FALSE)
  if (!.monitoreo_scalar(family, "") %in% .monitoreo_acr_cache_families) return(FALSE)
  .monitoreo_report_scope(report_scope) %in% c("source", "advance_summary", "queries_summary", "phone_summary")
}

#' Identidad de un reporte: mismos datos + misma configuración + mismo scope.
.monitoreo_acr_cache_key_info <- function(snapshot, data, cfg, report_scope = "full") {
  scope <- .monitoreo_report_scope(report_scope)
  snapshot_hash <- monitoreo_data_fingerprint(data, snapshot$synced_at %||% "")
  config_hash <- .monitoreo_cache_digest(cfg)
  key <- .monitoreo_cache_digest(list(
    schema = .MONITOREO_ACR_CACHE_SCHEMA,
    report_scope = scope,
    snapshot_hash = snapshot_hash,
    config_hash = config_hash
  ))
  list(
    key = key,
    report_scope = scope,
    snapshot_hash = snapshot_hash,
    config_hash = config_hash
  )
}

.monitoreo_acr_cache_get <- function(snapshot) {
  cache <- snapshot$acreditacion_report_cache
  if (!is.list(cache) || !identical(.monitoreo_scalar(cache$schema, ""), .MONITOREO_ACR_CACHE_SCHEMA)) {
    cache <- list(schema = .MONITOREO_ACR_CACHE_SCHEMA, entries = list())
  }
  if (!is.list(cache$entries)) cache$entries <- list()
  cache
}

#' Busca una entrada válida.
#'
#' No basta con que la clave coincida: se revalidan los tres componentes. La
#' clave es un digest y un digest puede colisionar; servir el reporte de otro
#' corte por una colisión sería invisible y catastrófico.
.monitoreo_acr_cache_lookup <- function(snapshot, key_info) {
  if (!is.list(snapshot) || !is.list(key_info) || !nzchar(.monitoreo_scalar(key_info$key, ""))) {
    return(NULL)
  }
  cache <- .monitoreo_acr_cache_get(snapshot)
  entry <- cache$entries[[key_info$key]]
  if (!is.list(entry) || !is.list(entry$dashboard)) return(NULL)
  if (!identical(entry$key, key_info$key) ||
      !identical(entry$report_scope, key_info$report_scope) ||
      !identical(entry$snapshot_hash, key_info$snapshot_hash) ||
      !identical(entry$config_hash, key_info$config_hash)) {
    return(NULL)
  }
  entry
}

#' Deja las entradas más recientes dentro del límite.
.monitoreo_acr_cache_prune <- function(entries) {
  if (!is.list(entries) || length(entries) <= .MONITOREO_ACR_CACHE_LIMIT) return(entries)
  stamps <- vapply(entries, function(entry) .monitoreo_scalar(entry$stored_at, ""), character(1))
  entries[order(stamps, decreasing = TRUE)][seq_len(.MONITOREO_ACR_CACHE_LIMIT)]
}

#' Guarda el dashboard recién construido bajo su clave.
.monitoreo_acr_cache_store <- function(snapshot, key_info, dashboard, build_ms = NA_real_) {
  if (!is.list(key_info) || !nzchar(.monitoreo_scalar(key_info$key, "")) || !is.list(dashboard)) {
    return(snapshot)
  }
  if (!is.list(snapshot)) snapshot <- list()
  cache <- .monitoreo_acr_cache_get(snapshot)
  cache$entries[[key_info$key]] <- list(
    key = key_info$key,
    report_scope = key_info$report_scope,
    snapshot_hash = key_info$snapshot_hash,
    config_hash = key_info$config_hash,
    dashboard = dashboard,
    build_ms = if (is.finite(build_ms)) as.numeric(build_ms) else NA_real_,
    stored_at = .monitoreo_now_iso()
  )
  cache$entries <- .monitoreo_acr_cache_prune(cache$entries)
  snapshot$acreditacion_report_cache <- cache
  snapshot
}

#' Fusiona el cache que viene en un `.pulso` con el de la sesión.
#'
#' Lo entrante no pisa lo ya calculado en esta sesión: si una clave existe en
#' ambos, gana la de la sesión, que se construyó con los datos que el usuario
#' tiene delante.
.monitoreo_acr_cache_merge <- function(snapshot, incoming) {
  if (!is.list(incoming)) return(snapshot)
  if (!identical(.monitoreo_scalar(incoming$schema, ""), .MONITOREO_ACR_CACHE_SCHEMA)) return(snapshot)
  if (!is.list(snapshot)) snapshot <- list()
  cache <- .monitoreo_acr_cache_get(snapshot)
  entrantes <- incoming$entries
  if (!is.list(entrantes) || !length(entrantes)) return(snapshot)
  for (clave in names(entrantes)) {
    if (!nzchar(clave) || !is.null(cache$entries[[clave]])) next
    entry <- entrantes[[clave]]
    if (!is.list(entry) || !is.list(entry$dashboard)) next
    cache$entries[[clave]] <- entry
  }
  cache$entries <- .monitoreo_acr_cache_prune(cache$entries)
  snapshot$acreditacion_report_cache <- cache
  snapshot
}
