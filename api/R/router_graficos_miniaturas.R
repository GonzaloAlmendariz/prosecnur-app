# router_graficos_miniaturas.R — miniaturas en lote y vista previa asíncrona de una lámina (F6 §5.3, riesgo 7).
# Router delgado: valida el pedido, resuelve los contextos (graficos_miniaturas.R) y lanza el job
# (graficos_miniaturas_jobs.R). Contrato: docs/qa/contrato-miniaturas-preview-f6-2026-10-11.md.
#
#   POST /api/graficos/miniaturas              → job `graficos.miniaturas` (estado y partes por slide.id)
#   GET  /api/graficos/miniaturas/<lote_id>    → estado del lote, lámina por lámina, también a medias
#   POST /api/graficos/preview-slide-job       → job `graficos.preview_slide` (result_data = respuesta de /preview-slide)
# Progreso, cancelación y snapshot: los endpoints de siempre, /api/jobs/<job_id>[/cancel].

mount_graficos_miniaturas <- function(pr) {
  pr |>
    plumber::pr_post("/api/graficos/miniaturas", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      session_get(sid)
      parsed <- .graficos_preview_leer_body(req)
      fuentes <- .graficos_preview_fuentes(sid, parsed)
      comun <- .graficos_preview_comun(sid, parsed, fuentes)
      pedido <- .graficos_miniaturas_pedido(parsed, comun$plan_slides)
      ctxs <- lapply(pedido$slides, function(sl) .graficos_preview_lamina_ctx(comun, sl, sl$folio))
      .graficos_miniaturas_lanzar(sid, ctxs, pedido$opts, modo = "lote", publicar = .mini_publicar_lote,
                                  reemplazar = pedido$reemplazar)
    })) |>
    plumber::pr_get("/api/graficos/miniaturas/<lote_id>", wrap_endpoint(function(req, res, lote_id) {
      sid <- session_header(req)
      session_get(sid)
      .graficos_miniaturas_estado(sid, lote_id)
    })) |>
    plumber::pr_post("/api/graficos/preview-slide-job", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      session_get(sid)
      parsed <- .graficos_preview_leer_body(req)
      fuentes <- .graficos_preview_fuentes(sid, parsed)
      opts <- .graficos_preview_opciones(parsed)
      comun <- .graficos_preview_comun(sid, parsed, fuentes)
      ctx <- .graficos_preview_lamina_ctx(comun, parsed$slide, parsed$folio)
      lanzado <- .graficos_miniaturas_lanzar(sid, list(ctx), opts, modo = "preview",
                                             publicar = .mini_publicador_preview(opts))
      c(lanzado, list(hash = ctx$hash, slide_id = ctx$slide_id))
    }))
}
