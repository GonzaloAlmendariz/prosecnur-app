# =============================================================================
# router_graficos_regla.R — conteo en vivo de la regla de preguntas (ADR 0135)
# =============================================================================
#
# Sólo lectura. El inspector de una lámina de resumen muestra cuántas preguntas elige su regla, cuáles y el texto de la
# nota, y deja ajustar a mano a partir de las candidatas. El cálculo vive en graficos_regla_preguntas.R (el mismo que
# usa el render, así que el contador y la lámina no discrepan); aquí sólo se valida la sesión y el pedido.
#
#   POST /api/graficos/resumenes/regla   {graficador, args, scope?}
#     -> {ok, total, seleccionadas: [tema], candidatas: [{tema, etiqueta, metrica, seleccionada}], texto_regla, avisos}
#
# `scope` es el de la vista previa (`consolidated` o vacío): las fuentes salen de `.graficos_preview_fuentes`, que en
# multibase trae todas las bases del estudio.
#
#   GET /api/graficos/resumenes/padron?scope=
#     -> {ok, bases: [{base, padron, padron_origen, meta, meta_unidad, meta_origen, motivo}]}
#   Propuesta de padrón y meta por base para la lámina de cobertura (graficos_padron_por_base.R). Sólo lectura: la UI
#   la muestra y, al confirmarla, escribe `universos` y `metas` en el payload.

mount_graficos_regla <- function(pr) {
  pr |>
    plumber::pr_post("/api/graficos/resumenes/regla", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      session_get(sid)
      parsed <- .graficos_preview_leer_body(req)
      graficador <- parsed[["graficador"]]
      if (is.null(graficador) || !nzchar(trimws(as.character(graficador)[1]))) {
        .regla_preguntas_falla("El cuerpo debe incluir el `graficador`.")
      }
      args <- parsed[["args"]] %||% list()
      if (!is.list(args)) .regla_preguntas_falla("`args` debe ser un objeto.")
      fuentes <- .graficos_preview_fuentes(sid, parsed)
      .regla_preguntas_conteo(graficador, args, fuentes)
    })) |>
    plumber::pr_get("/api/graficos/resumenes/padron", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      scope <- as.character((req$argsQuery %||% list())$scope %||% "")[1]
      fuentes <- .graficos_preview_fuentes(sid, list(scope = scope))
      .graficos_padron_respuesta(.graficos_padron_por_base(s, names(fuentes$data_sources)))
    }))
}

#' La propuesta de padrón como JSON: un NA sale como null (el serializador escribe `na = "null"`)
#' @keywords internal
.graficos_padron_respuesta <- function(filas) {
  list(ok = TRUE, bases = lapply(filas, function(f) list(
    base = f$base, padron = f$padron, padron_origen = f$padron_origen, meta = f$meta,
    meta_unidad = f$meta_unidad, meta_origen = f$meta_origen, motivo = f$motivo)))
}
