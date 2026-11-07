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
    }))
}
