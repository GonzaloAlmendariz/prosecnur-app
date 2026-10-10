# =============================================================================
# router_graficos_categorias.R — categorías de una pregunta para el orden por gráfico (D8)
# =============================================================================
#
# Contrato docs/qa/contrato-orden-categorias-f6-2026-10-10.md §7. Sólo lectura: el editor arma la lista arrastrable
# del modo «personalizado» y muestra qué dibujaría cada modo. La respuesta la arma el engine
# (`graficos_orden_categorias.R`); aquí sólo se valida la sesión, se toman las fuentes y se enruta.

mount_graficos_categorias <- function(pr) {
  pr |>
    plumber::pr_get("/api/graficos/categorias", wrap_endpoint(function(req, res, var = NULL, scope = "") {
      sid <- session_header(req)
      session_get(sid)
      consolidado <- identical(tolower(trimws(as.character(scope %||% "")[1])), "consolidado")
      sources <- if (consolidado) .graficos_consolidado_sources(sid) else .graficos_processing_sources(sid)
      if (!.graficos_sources_usable(sources$data_sources, sources$inst_sources)) {
        stop_api(409, "E_NO_VALID_RP_DATA", "La fuente procesada para Gráficos no está disponible o quedó incompleta.")
      }
      # Una `var` sin base (`p7`) se resuelve contra la base activa; en el consolidado no hay activa: la primera.
      .graficos_categorias_payload(sources, var, base_activa = if (consolidado) NULL else .graficos_active_base_name(sid))
    }))
}
