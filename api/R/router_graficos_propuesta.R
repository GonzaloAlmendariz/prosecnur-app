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
#   POST /api/graficos/resumenes/propuesta/job             el mismo cuerpo que el POST (o `{slide_id}` para la guardada):
#                                                          lanza el job `graficos.propuesta_resumen` y responde
#                                                          `{ok, job_id, kind, slide_id, cache}`; se pollea con
#                                                          /api/jobs/<job_id> y su `result_data` es la respuesta síncrona
# Los síncronos responden `{ok, tipo, slide_id, modo?, base, capitulos, avisos}`; cada capítulo trae la forma que guarda el
# editor más campos de sólo lectura (`pregunta`, `cifra`, `n`, `diferencia`, `diferencia_estado` y `frase` o
# `rotulo_lamina`). Los tres comparten la caché por firma (graficos_propuesta_job.R).

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
    })) |>
    plumber::pr_post("/api/graficos/resumenes/propuesta/job", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      session_get(sid)
      parsed <- .graficos_preview_leer_body(req)
      # `[[` y no `$`: `parsed$slide` casaría por prefijo con `slide_id`.
      slide_id <- trimws(as.character(parsed[["slide_id"]] %||% "")[1])
      parsed[["slide_id"]] <- NULL
      if (is.list(parsed[["slide"]])) return(.propuesta_resumen_job_lanzar(sid, parsed = parsed))
      if (is.na(slide_id) || !nzchar(slide_id)) {
        stop_api(400, "E_PROPUESTA_SIN_LAMINA", "El cuerpo debe incluir la lámina en `slide` o su id en `slide_id`.")
      }
      parsed[["slide"]] <- NULL
      .propuesta_resumen_job_lanzar(sid, slide_id = slide_id, parsed = parsed)
    }))
}
