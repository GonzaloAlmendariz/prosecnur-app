# =============================================================================
# router_graficos_citas.R — candidatas de citas para la tarjeta de aprobación (O3b-a, plan-texto-abierto-ccss)
# =============================================================================
#
# Sólo lectura. La tarjeta muestra las candidatas de `.citas_seleccionar` para que el analista apruebe, recorte o marque
# [sic]; lo que aprueba viaja en `citas_aprobadas` de `p_citas`. La respuesta la arma `citas_candidatas_payload()`
# (texto_citas.R); aquí sólo se valida la sesión, se toman las fuentes de Gráficos y se enruta.

mount_graficos_citas <- function(pr) {
  pr |>
    plumber::pr_get("/api/graficos/citas-candidatas", wrap_endpoint(function(req, res, variable = NULL, base = NULL,
                                                                             filtros = NULL, var_persona = NULL, ...) {
      sid <- session_header(req)
      session_get(sid)
      sources <- .graficos_processing_sources(sid)
      if (!.graficos_sources_usable(sources$data_sources, sources$inst_sources)) {
        stop_api(409, "E_NO_VALID_RP_DATA", "La fuente procesada para Gráficos no está disponible o quedó incompleta.")
      }
      citas_candidatas_payload(sources, variable = variable, base = base, base_activa = .graficos_active_base_name(sid),
                               filtros = filtros, var_persona = var_persona)
    }))
}
