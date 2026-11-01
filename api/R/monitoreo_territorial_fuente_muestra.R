# =============================================================================
# monitoreo_territorial_fuente_muestra.R — Monitoreo mide contra la muestra enviada (I4, paso 2)
# =============================================================================
#
# Gonzalo (2026-11-01): Planner → Hojas de ruta define la muestra → la ENVÍA a
# Material de campo y a Monitoreo. Monitoreo mide contra la foto enviada, igual
# que Material; volver a sortear en Hojas queda permitido, con alerta de desfase
# (ADR 0118 §3, enmienda del 2026-11-01).
#
# Regla, por fase: `runs[[fase]]$envio` si existe; si no, la muestra viva de esa
# misma fase (estudios que nunca enviaron, `.pulso` viejos: igual que antes).
# De la foto salen `sample` (bloques y reemplazos), `config` y la cuota, que la
# muestra guarda al sortearse (`sample$quota`). Si la foto no trae cuota, se usa
# la viva sólo cuando la config es la misma; si no, ninguna: un vacío honesto,
# no una mezcla de muestras. `population` sigue siendo la viva (depende de la
# config, no del sorteo; si la config cambió, el aviso de I4 ya lo dice).
# =============================================================================

#' De dónde lee Monitoreo territorial la muestra de una fase (núcleo puro).
#'
#' @param run la corrida de Hojas de ruta de la fase (`hojas_ruta_runs[[fase]]`).
#' @param envio la foto normalizada (`.hojas_ruta_envio_normalize`) o `NULL`.
#' @return lista con `source` ("envio" o "viva"), `sample`, `config`, `quota`,
#'   `sample_fingerprint` y `enviado_at`.
#' @keywords internal
.monitoreo_territorial_fuente_muestra <- function(run, envio) {
  run <- if (is.list(run)) run else list()
  outputs <- run$workspace_outputs %||% run$outputs %||% list()
  quota_viva <- outputs$quota %||% outputs$quota_preview %||% outputs$quotaPreview %||% NULL
  if (is.null(envio)) {
    return(list(
      source = "viva",
      sample = outputs$sample %||% outputs$sample_preview %||% outputs$samplePreview %||% run$sample %||% list(),
      config = run$config %||% list(),
      quota = quota_viva,
      sample_fingerprint = "",
      enviado_at = ""
    ))
  }
  quota <- envio$sample$quota %||% NULL
  if (is.null(quota)) {
    config_viva <- tryCatch(hojas_ruta_integrada_normalize_config(if (is.list(run$config)) run$config else list()),
                            error = function(e) NULL)
    if (!is.null(config_viva) && identical(config_viva, envio$config)) quota <- quota_viva
  }
  list(
    source = "envio",
    sample = envio$sample,
    config = envio$config %||% list(),
    quota = quota,
    sample_fingerprint = .monitoreo_scalar(envio$sample_fingerprint, ""),
    enviado_at = .monitoreo_scalar(envio$enviado_at, "")
  )
}

# Firma de la foto enviada de la fase activa, para las llaves de caché que no
# miran la muestra (token del dashboard, casos por UMP). "" sin envío o fuera de
# territorial: así los proyectos que nunca enviaron conservan sus llaves de hoy
# y no pagan un warm start frío.
.monitoreo_territorial_route_sig <- function(sid, cfg = list()) {
  if (!identical(cfg$monitoreo_profile$family %||% "", "territorial")) return("")
  s <- tryCatch(session_get(sid, required = FALSE), error = function(e) NULL)
  if (!is.list(s)) return("")
  phase <- .monitoreo_territorial_phase(cfg$territorial$active_route_phase, "pilot")
  envio <- tryCatch(.mcamp_territorial_envio(s, phase), error = function(e) NULL)
  if (is.null(envio)) return("")
  paste("envio", phase, .monitoreo_scalar(envio$sample_fingerprint, ""),
        .monitoreo_cache_digest(envio$config %||% list()), sep = ":")
}
