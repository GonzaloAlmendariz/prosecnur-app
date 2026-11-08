# =============================================================================
# router_graficos_inventario.R — qué tiene el estudio para cada tipo de gráfico (ADR 0135, selector por intención)
# =============================================================================
#
# Sólo lectura. El selector dice, por cada tipo, qué datos usa (`usa` del catálogo) y si el estudio los tiene. El
# cálculo vive en graficos_inventario.R.
#
#   GET /api/graficos/resumenes/inventario?scope=
#     -> {ok, bases: [{base, publico, n, preguntas: {escala, opcion_unica, multiple, numerica, abierta},
#                      padron: {declarado, valor, origen, motivo}}]}
#
# `scope` es el de la vista previa (`consolidated` o vacío); un scope desconocido responde 400
# E_GRAFICOS_INVENTARIO_SCOPE, y sin fuentes procesadas, el 409 E_NO_VALID_RP_DATA de Gráficos.

mount_graficos_inventario <- function(pr) {
  plumber::pr_get(pr, "/api/graficos/resumenes/inventario", wrap_endpoint(function(req, res, ...) {
    sid <- session_header(req)
    s <- session_get(sid)
    scope <- .graficos_inventario_scope(req$argsQuery)
    fuentes <- .graficos_preview_fuentes(sid, list(scope = scope))
    .graficos_inventario(s, fuentes)
  }))
}
