# =============================================================================
# graficos_ppt_job_args.R — los argumentos del worker del export PPT, en un solo sitio
# =============================================================================
#
# El export (POST /api/graficos/ppt) y el arnés de QA (`scripts/qa_graficos_medir.R`) arman aquí los argumentos de
# `graficos_job_worker_ppt`. Así el arnés renderiza con el mismo contexto del informe que el entregable: la regla de
# diferencias, las preguntas clave, los nombres cortos del plan (E4) y los del mazo (ADR 0141) viajan en
# `significancia` y los fija el propio worker (`.sig_informe_preparar`). Antes el arnés llamaba a `reporte_ppt_plan`
# sin ese contexto y daba rojos falsos en los rótulos (Arte, 2026-11-09).

#' Argumentos de `graficos_job_worker_ppt` para la base activa (sin `result_path` ni `progress_path`)
#' @param plan Plan ya normalizado.
#' @param presets Presets del pedido; aquí se enriquecen sin guías de depuración (D17).
#' @param scoped_sources `.graficos_processing_sources(sid)`.
#' @keywords internal
.graficos_ppt_job_args <- function(sid, cfg, plan, presets, scoped_sources) {
  delivery <- .graficos_delivery_options(
    cfg,
    template_id = plan$template_id %||% NULL,
    auto_otros_slides = plan$auto_otros_slides %||% NULL
  )
  template_pptx <- .graficos_resolve_template_pptx(
    config = cfg,
    profile_id = delivery$profile_id,
    template_id = delivery$template_id
  )
  # Las listas nombradas (multibase) viajan por RDS: no sobreviven la serialización de args.
  list(
    rp_data_path = job_save_rds(sid, "rp_data_sources", scoped_sources$data_sources),
    rp_inst_path = job_save_rds(sid, "rp_inst_sources", scoped_sources$inst_sources),
    plan = structure(plan, avisos_migracion = NULL),
    presets = .enriquecer_presets(presets, NULL),   # D17: las guías de depuración nunca llegan al entregable
    paletas = cfg$paletas %||% list(),
    # El registry viaja como argumento: una sola fuente de verdad en graficos_metadata.R.
    slide_registry = setNames(
      lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))),
      .slide_names()
    ),
    graficador_registry = .graf_names(),
    icon_registry = .graficos_icon_registry(sid, cfg),
    active_base = .graficos_active_base_name(sid),
    template_pptx = template_pptx,
    template_id = delivery$template_id,
    auto_otros_slides = delivery$auto_otros_slides
  ) |> c(.graficos_estilo_cliente_arg(sid, cfg, "ppt"), .sig_arg_job(sid, cfg, plan))   # D5 y ADR 0128
}
