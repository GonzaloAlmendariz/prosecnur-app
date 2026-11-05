# =============================================================================
# router_graficos_propuesta.R — la propuesta del motor para el resumen ejecutivo y el resumen de diferencias (H13)
# =============================================================================
#
# Sólo lectura. El editor muestra como lista lo que el motor elegiría con «Los propone el motor» y deja editar a partir
# de esa lista. El cálculo vive en graficos_propuesta_resumen.R; aquí sólo se valida la sesión y el pedido.
#
#   GET  /api/graficos/resumenes/propuesta?slide_id=<id>   la lámina y el plan GUARDADOS
#   POST /api/graficos/resumenes/propuesta                 {slide, config?}: la lámina (y el plan) SIN guardar, el mismo
#                                                          cuerpo que /api/graficos/preview-slide
# Los dos responden `{ok, tipo, slide_id, modo?, base, capitulos, avisos}`; cada capítulo trae la forma que guarda el
# editor más campos de sólo lectura (`pregunta`, `cifra`, `n`, `diferencia`, `diferencia_estado` y `frase` o
# `rotulo_lamina`).

mount_graficos_propuesta <- function(pr) {
  pr |>
    plumber::pr_get("/api/graficos/resumenes/propuesta", wrap_endpoint(function(req, res, slide_id = "", ...) {
      sid <- session_header(req)
      session_get(sid)
      slide_id <- trimws(as.character(slide_id %||% "")[1])
      if (is.na(slide_id) || !nzchar(slide_id)) stop_api(400, "E_PROPUESTA_SIN_LAMINA", "Falta `slide_id`.")
      .propuesta_resumen_sesion(sid, slide_id = slide_id)
    })) |>
    plumber::pr_post("/api/graficos/resumenes/propuesta", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      session_get(sid)
      parsed <- .graficos_preview_leer_body(req)
      if (!is.list(parsed$slide)) stop_api(400, "E_PROPUESTA_SIN_LAMINA", "El cuerpo debe incluir la lámina en `slide`.")
      .propuesta_resumen_sesion(sid, parsed = parsed)
    }))
}
