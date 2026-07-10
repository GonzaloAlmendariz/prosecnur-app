# =============================================================================
# Coherencia home de proyecto <-> vista viva de "Avance territorial"
# =============================================================================
#
# El home arma la tarjeta de Monitoreo (familia territorial) desde
# `snapshot$dashboard$territorial_reports$kpis` (ver .overview_monitoreo_facts
# en project_overview.R). Ese tablero SOLO se reescribe cuando se reconstruye
# con report_scope = "full" (ver .monitoreo_state_payload). La pagina "Avance
# territorial" recomputa en vivo con report_scope = "advance_summary" y
# deliberadamente NO reescribe `snapshot$dashboard` para no romper el contrato
# de `dashboard_cache_token` / `dashboard_cache_key`, que estan atados al scope
# "full". Resultado del bug: el home quedaba con los KPIs del ultimo tablero
# completo (p.ej. 85.7% / 1028 de 1351) mientras la vista viva ya mostraba el
# avance fresco (p.ej. 107% / 1283 de 1200).
#
# Solucion: un campo liviano y dedicado en el snapshot,
# `territorial_overview_facts`, que espeja los KPIs territoriales que la vista
# viva acaba de servir. El home lo prefiere sobre el tablero congelado. No se
# toca el token ni el scope del tablero "full", asi que el resto de lectores de
# `snapshot$dashboard` sigue viendo un tablero coherente.

# KPIs minimos que consume la tarjeta de Monitoreo territorial del home. Deben
# coincidir con las llaves que lee .overview_monitoreo_facts (project_overview.R).
.MONITOREO_OVERVIEW_TERRITORIAL_KEYS <- c(
  "total_respuestas", "validas", "meta", "avance_pct", "revision", "geo_no_defendible"
)

# Extrae del tablero servido los KPIs territoriales que la tarjeta del home
# necesita. Devuelve NULL si el tablero no trae KPIs territoriales utilizables
# (asi el caller no espeja ruido y el home cae al fallback del tablero).
monitoreo_territorial_overview_facts <- function(dashboard) {
  if (!is.list(dashboard)) return(NULL)
  kpis <- (dashboard$territorial_reports %||% list())$kpis %||% NULL
  if (!is.list(kpis) || !length(kpis)) return(NULL)
  facts <- kpis[.MONITOREO_OVERVIEW_TERRITORIAL_KEYS]
  names(facts) <- .MONITOREO_OVERVIEW_TERRITORIAL_KEYS
  # Sin ninguna senal real (todo NULL) no vale la pena espejar nada.
  if (all(vapply(facts, is.null, logical(1)))) return(NULL)
  facts
}

# Refresca `snapshot$territorial_overview_facts` con los KPIs que la vista viva
# acaba de servir. Devuelve list(snapshot = , changed = ) para que el caller
# persista SOLO cuando de verdad cambio (evita churn innecesario de session_set
# en cada carga del payload).
monitoreo_snapshot_refresh_territorial_facts <- function(snapshot, dashboard) {
  if (!is.list(snapshot)) return(list(snapshot = snapshot, changed = FALSE))
  facts <- monitoreo_territorial_overview_facts(dashboard)
  if (is.null(facts)) return(list(snapshot = snapshot, changed = FALSE))
  if (identical(snapshot$territorial_overview_facts %||% NULL, facts)) {
    return(list(snapshot = snapshot, changed = FALSE))
  }
  snapshot$territorial_overview_facts <- facts
  list(snapshot = snapshot, changed = TRUE)
}
