# monitoreo_perf.R — perf del tablero de Monitoreo (Plan de mejoras 2026-07, Fase 3).
#
# Este archivo existe porque router_monitoreo.R y monitoreo_engine.R están
# congelados a crecimiento: toda funcionalidad nueva de perf vive aquí y los
# archivos grandes la llaman con una línea.
#
# Dos piezas:
#   1. monitoreo_data_fingerprint(): token barato de frescura de la data del
#      snapshot, que reemplaza el sha256 del dataframe completo en los tokens
#      de caché del dashboard (antes se pagaba digest::digest(data) en CADA
#      request de state, la causa #1 de los congelamientos).
#   2. Contador de builds del dashboard: instrumentación mínima para poder
#      probar (y vigilar) que una mutación de config ya no dispara el build
#      completo dos veces en el mismo request.

# --- Fingerprint barato de la data -----------------------------------------

# Supuesto de frescura (documentado a propósito): la data del snapshot de
# Monitoreo solo muta por rutas que o bien actualizan synced_at (sync de
# fuentes, aulas/sync) o bien invalidan explícitamente los caches del
# dashboard vía .monitoreo_invalidate_dashboard_caches (mutaciones de fuentes
# que reescriben columnas .source_*). Las ediciones de config no tocan la
# data: viajan en cfg y ya forman parte del token vía cfg_json/config_hash.
# Por eso dims + nombres de columnas + synced_at bastan como señal de cambio,
# sin hashear el contenido completo (que en bases reales costaba cientos de
# ms por request). Los cambios de esquema (columnas nuevas/renombradas)
# cambian ncol o el hash de nombres; los re-sync cambian synced_at.
monitoreo_data_fingerprint <- function(data, synced_at = "") {
  if (is.null(data) || !is.data.frame(data)) return("")
  nombres <- names(data) %||% character(0)
  names_sig <- if (requireNamespace("digest", quietly = TRUE)) {
    # Hashear solo el vector de nombres es barato (bytes, no la data).
    digest::digest(nombres, algo = "xxhash64")
  } else {
    paste(length(nombres), sum(nchar(nombres)), sep = "-")
  }
  paste(
    "fpv1",
    nrow(data),
    ncol(data),
    names_sig,
    .monitoreo_scalar(synced_at, ""),
    sep = ":"
  )
}

# --- Contador de builds del dashboard --------------------------------------

# Env interno (no exportado) para instrumentar cuántas veces se construye el
# dashboard completo en un proceso. Los tests lo usan para demostrar que el
# doble-rebuild de store_config quedó eliminado; en producción solo suma un
# entero por build (costo despreciable).
.monitoreo_perf_state <- new.env(parent = emptyenv())

.monitoreo_perf_note_dashboard_build <- function() {
  actual <- get0("dashboard_builds", envir = .monitoreo_perf_state, ifnotfound = 0L)
  assign("dashboard_builds", actual + 1L, envir = .monitoreo_perf_state)
  invisible(NULL)
}

monitoreo_perf_dashboard_build_count <- function() {
  get0("dashboard_builds", envir = .monitoreo_perf_state, ifnotfound = 0L)
}

monitoreo_perf_reset_dashboard_build_count <- function() {
  assign("dashboard_builds", 0L, envir = .monitoreo_perf_state)
  invisible(NULL)
}
