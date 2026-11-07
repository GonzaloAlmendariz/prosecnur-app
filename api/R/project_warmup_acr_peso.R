# Patch del warm start de Monitoreo acreditación/telefónico, sin duplicados.
#
# Cuando un reporte se construye o se recupera del cache persistente, el router
# lo deja también en `monitoreo_dashboard_cache_<scope>` de la sesión. En el
# worker los dos son el MISMO objeto, pero el patch se serializa para volver al
# backend y ahí se escribe dos veces: 388 MB de más por scope en un proyecto de
# 45 mil casos (test-monitoreo-acreditacion-cache-peso.R).
#
# El cache persistente es el que manda —es el que viaja en el `.pulso`—, así que
# se omite la copia de sesión. La primera lectura del scope lo encuentra en el
# cache (router_monitoreo.R, `dashboard_source = "project"`) sin reconstruir y
# vuelve a llenar el campo de sesión por referencia.

#' @keywords internal
.project_warmup_acr_session_patch <- function(sid, scopes = character(0)) {
  acr_cache <- session_get(sid)$monitoreo_snapshot$acreditacion_report_cache %||% NULL
  list(
    monitoreo = .project_warmup_acr_sin_duplicar(.project_warmup_monitoreo_cache_patch(sid, scopes), acr_cache),
    # Los caches de sesión mueren al cerrar; este viaja en el `.pulso` y es
    # el que evita recalcular los cuatro scopes en la próxima apertura.
    monitoreo_acreditacion = list(acreditacion_report_cache = acr_cache)
  )
}

#' Quita del patch de sesión los dashboards que ya viajan en el cache persistente
#'
#' Se omite el dashboard y también su token: un token sin su dashboard validaría
#' el dashboard viejo que la sesión destino tuviera en ese campo.
#' `identical()` compara primero la dirección, así que el caso normal (el mismo
#' objeto) no recorre el reporte.
#' @keywords internal
.project_warmup_acr_sin_duplicar <- function(patch, acr_cache) {
  entries <- if (is.list(acr_cache)) acr_cache$entries else NULL
  if (!is.list(patch) || !is.list(entries) || !length(entries)) return(patch)
  campos <- grep("^monitoreo_dashboard_cache_(?!token_)", names(patch), value = TRUE, perl = TRUE)
  for (campo in campos) {
    dashboard <- patch[[campo]]
    if (!is.list(dashboard)) next
    en_cache <- any(vapply(entries, function(entry) identical(entry$dashboard, dashboard), logical(1)))
    if (!en_cache) next
    patch[[campo]] <- NULL
    patch[[sub("^monitoreo_dashboard_cache_", "monitoreo_dashboard_cache_token_", campo)]] <- NULL
  }
  patch
}
