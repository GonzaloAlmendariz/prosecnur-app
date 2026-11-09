# =============================================================================
# router_graficos_rotulos.R — ranking y guardado de los rótulos cortos del mazo (ADR 0141, ROT-2)
# =============================================================================
#
#   GET  /api/graficos/rotulos/ranking?scope=graficos
#     -> {ok, scope, bases: [{base, preguntas: [{ref, etiqueta, largo, usos, corto?, corto_en_grafico?}],
#                                   opciones: [{ref, codigo, etiqueta, largo, usos, corto?}]}]}
#   POST /api/graficos/rotulos   {preguntas?: {"base$var": corto|null}, opciones?: {"rótulo completo": corto|null}}
#     -> {ok, rotulos_cortos, avisos: [{tipo, base, corto, refs}], saved_at}
#
# Delgado: lee la sesión, llama al motor (graficos_rotulos_ranking.R, graficos_rotulos_cortos_plan.R) y serializa. El
# guardado escribe `plan$rotulos_cortos` de la config de Gráficos de la base activa; Analítica no se lee ni se escribe.

mount_graficos_rotulos <- function(pr) {
  pr |>
    plumber::pr_get("/api/graficos/rotulos/ranking", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      session_get(sid)
      .graficos_rotulos_scope(req$argsQuery)
      payload <- .graficos_variables_sources_payload(sid, scoped = TRUE)
      .graficos_rotulos_ranking(payload$sources, .graficos_config_get(sid)$plan)
    })) |>
    plumber::pr_post("/api/graficos/rotulos", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      session_get(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      pedido <- tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
                         error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e)))
      cfg <- .graficos_config_get(sid)
      sources <- .graficos_variables_sources_payload(sid, scoped = TRUE)$sources
      r <- .rotulos_cortos_guardar(cfg$plan$rotulos_cortos, pedido, .rotulos_enunciado_de(sources))
      cfg$plan$rotulos_cortos <- r$rotulos_cortos
      .graficos_config_set(sid, cfg)
      list(ok = TRUE, rotulos_cortos = r$rotulos_cortos %||% structure(list(), names = character(0)),
           avisos = I(r$avisos), saved_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
    }))
}
