# =============================================================================
# router_graficos_regla.R — conteo en vivo de la regla de preguntas (ADR 0135)
# =============================================================================
#
# Sólo lectura. El inspector de una lámina de resumen muestra cuántas preguntas elige su regla, cuáles y el texto de la
# nota, y deja ajustar a mano a partir de las candidatas. El cálculo vive en graficos_regla_preguntas.R (el mismo que
# usa el render, así que el contador y la lámina no discrepan); aquí sólo se valida la sesión y el pedido.
#
#   POST /api/graficos/resumenes/regla   {graficador, args, scope?}
#     -> {ok, total, seleccionadas: [tema], candidatas: [{tema, etiqueta, metrica, seleccionada}], texto_regla, avisos,
#         tope_filas, cabe_nativa, motivo_imagen}
#   `tope_filas`: filas que admite la lámina nativa (20 en la escala del resumen) o null sin tope.
#   `cabe_nativa`: en la escala del resumen, si la lámina nativa dibuja lo elegido (false con más filas que el tope o
#   con más de una columna «Sin información»); null en los demás. `motivo_imagen`: la causa cuando es false, si no null.
#
# `scope` es el de la vista previa (`consolidated` o vacío): las fuentes y los presets salen de
# `.graficos_resumenes_motor` (la vista previa; en multibase trae todas las bases del estudio), los mismos que /cifras.
#
#   GET /api/graficos/resumenes/padron?scope=
#     -> {ok, bases: [{base, padron, padron_origen, meta, meta_unidad, meta_origen, motivo}]}
#   Propuesta de padrón y meta por base para la lámina de cobertura (graficos_padron_por_base.R). Sólo lectura: la UI
#   la muestra y, al confirmarla, escribe `universos` y `metas` en el payload.

#
#   POST /api/graficos/resumenes/cifras   {graficador, args, scope?}
#     -> {ok, tipo, cifras: [{clave, rotulo, texto, valor, unidad}], avisos}
#   Las cifras con clave estable de un gráfico de resumen (graficos_cifras_clave.R), renderizado con el motor del export y
#   los presets de la vista previa: el cierre con hallazgos las ofrece para elegir.
#   Con `laminas` en vez de `graficador` es un lote (graficos_cifras_lote.R): fuentes y presets se preparan una vez.
#   POST /api/graficos/resumenes/cifras   {laminas: [{id, slide: {graficador, args}}], scope?}
#     -> {ok, por_lamina: {<id>: {tipo, cifras, avisos, error?: {code, message}}}}   el error de una lámina va en su entrada
#
#   POST /api/graficos/resumenes/emparejado   {bases: [A, B], vars?, scope?}
#     -> {ok, bases, preguntas: [{tema, base, var, etiqueta, estado, par?, sugerencias}]}
#   Revisión del emparejado entre públicos (graficos_emparejado_sugerido.R, ADR 0135 §7). Sólo lectura: lee la matriz
#   (`s$equivalencias_publicos`, filas sin `sugerida`) y propone por texto para las preguntas sin par.

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
      motor <- .graficos_resumenes_motor(sid, parsed)   # mismas fuentes y presets que /cifras y el render
      .regla_preguntas_conteo(graficador, args, motor$fuentes, motor$presets)
    })) |>
    plumber::pr_post("/api/graficos/resumenes/cifras", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      session_get(sid)
      parsed <- .graficos_preview_leer_body(req)
      motor <- .graficos_resumenes_motor(sid, parsed)   # graficos_resumenes_motor.R
      if (!is.null(parsed[["laminas"]])) return(.graficos_cifras_lote(parsed[["laminas"]], motor$fuentes, motor$presets))
      .graficos_cifras_de_grafico(parsed[["graficador"]], parsed[["args"]] %||% list(), motor$fuentes, motor$presets)
    })) |>
    plumber::pr_post("/api/graficos/resumenes/emparejado", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      parsed <- .graficos_preview_leer_body(req)
      fuentes <- .graficos_preview_fuentes(sid, parsed)
      .graficos_emparejado(s$equivalencias_publicos, fuentes, parsed[["bases"]], parsed[["vars"]])
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
