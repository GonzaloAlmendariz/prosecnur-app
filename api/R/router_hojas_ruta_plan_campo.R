# Plan de campo y costo (U14). Router delgado: toma la muestra guardada del run
# activo y los supuestos del cuerpo; arma el plan sin guardar nada. Los supuestos
# se persisten aparte en ui_state$plan_campo con /api/hojas-ruta/workspace.

mount_hojas_ruta_plan_campo <- function(pr) {
  pr |>
    plumber::pr_post("/api/hojas-ruta/plan-campo", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      active <- .hojas_ruta_active_run(sid)
      outputs <- .hojas_ruta_workspace_outputs_normalize(active$run$workspace_outputs %||% list())
      muestra <- parsed$sample %||% outputs$sample %||% NULL
      if (is.null(muestra) || !length(muestra$blocks %||% list())) {
        stop_api(409, "E_NO_SAMPLE", "Primero sortea las manzanas: el plan de campo se arma sobre las rutas.")
      }
      plan <- hojas_ruta_plan_campo(muestra$blocks, parsed$supuestos %||% list())
      su <- plan$supuestos
      .hojas_ruta_bitacora_intentar(sid, "plan_supuestos", sprintf(
        "Plan de campo: %d encuestador(es), %d visitas por jornada → %d jornadas, %d días.",
        as.integer(su$encuestadores), as.integer(su$visitas_por_jornada), as.integer(plan$resumen$jornadas), as.integer(plan$resumen$dias)
      ), list(supuestos = su), origen = parsed$origen)
      plan
    }))
}
