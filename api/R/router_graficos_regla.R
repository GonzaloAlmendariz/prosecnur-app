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
#   `cabe_nativa`: en la escala del resumen, si la lámina nativa dibuja lo elegido (false con más filas que el tope, con
#   más de una columna «Sin información» entre las ELEGIDAS o con ninguna elegida: «Ninguna pregunta cumple la regla.»);
#   null en los demás. `motivo_imagen`: la causa cuando es false, si no null. `metrica` es null fuera del universo.
#
# `scope` es el de la vista previa (`consolidated` o vacío) y `config` la config del editor: las fuentes y los presets
# salen de `.graficos_resumenes_motor` (la vista previa; en multibase trae todas las bases del estudio; los presets, de la
# config efectiva con `config`), los mismos que /cifras. Los args del gráfico pasan por la regla inclusiva y los
# rótulos cortos que se aplicaron a las fuentes (`.graficos_resumenes_args`, N3).
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
#   Con `detalle: true` (en el pedido suelto o en el lote) la ruta acepta también los categóricos, apilados y divergentes
#   (`p_barras_categoricas`, `p_barras_agrupadas` de una serie, `p_barras_apiladas`, `p_barras_multiapiladas`,
#   `p_barras_divergentes`; graficos_cifras_detalle.R) y cada respuesta trae `detalle`, leído de la especificación que
#   dibuja la lámina (sus pesos, filtros, universo y exclusiones), o `null` si la lámina no lo publica:
#   POST /api/graficos/resumenes/cifras   {graficador, args, detalle: true, caja?: [rotulo], scope?}
#   POST /api/graficos/resumenes/cifras   {laminas: [{id, slide: {graficador, args}, caja?}], detalle: true, scope?}
#     detalle: {
#       forma: "categorica" | "escala" | "divergentes", version,
#       base: {n_ponderado, n_casos, texto},          n_* null si las filas no comparten base; texto: «Base: N» de la lámina
#       redondeo: {metodo: "estandar" | "reparto", decimales},
#       categorias: [{clave, rotulo, especial, lado}],   lado: "neg" | "neu" | "pos" | "sin_inf" (divergentes) o null
#       filas: [{clave, rotulo, es_total, base: {n_ponderado, n_casos},
#                valores: [{categoria, texto, valor, proporcion}],   texto como se rotula; valor: la cifra rotulada (%)
#                sumas: {lamina: {valor, texto}, estandar: {valor, texto}, reparto: {valor, texto, aplica}} | null,
#                caja: {rotulo, categorias: [rotulo], valor, texto, origen: "lamina" | "pedido"} | null,
#                lados: {negativo, neutro, positivo, sin_informacion: {valor, texto}} | null}]   (sólo divergentes)
#     }
#   `categoria` y `clave` son el rótulo de la lámina (estable entre variantes: la columna interna se corre al excluir).
#   La caja de la lámina es su Top Two Box (escala) o el lado de acuerdo (divergentes); con `caja` se suma la de esas
#   categorías, sin especiales. El antes y el después se piden como dos láminas del lote con distintos args (la
#   deduplicación del lote renderiza una vez las idénticas); qué categorías deja fuera un máximo es la diferencia entre
#   las `valores` de la variante con y sin él. `detalle` mal formado o `caja` inválida: 400 E_CIFRAS_INVALIDO; un
#   gráfico que no publica detalle: el error E_CIFRAS_INVALIDO en su entrada (lote) o 400 (suelto).
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
      motor <- .graficos_resumenes_motor(sid, parsed)   # mismas fuentes, presets y args convertidos que /cifras y el render
      .regla_preguntas_conteo(graficador, .graficos_resumenes_args(motor, graficador, args), motor$fuentes, motor$presets)
    })) |>
    plumber::pr_post("/api/graficos/resumenes/cifras", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      session_get(sid)
      parsed <- .graficos_preview_leer_body(req)
      detalle <- .graficos_cifras_pide_detalle(parsed[["detalle"]])
      motor <- .graficos_resumenes_motor(sid, parsed)   # graficos_resumenes_motor.R
      if (!is.null(parsed[["laminas"]])) {
        laminas <- .graficos_resumenes_laminas(motor, parsed[["laminas"]])
        return(.graficos_cifras_lote(laminas, motor$fuentes, motor$presets, detalle = detalle))
      }
      args <- .graficos_resumenes_args(motor, parsed[["graficador"]], parsed[["args"]] %||% list())
      if (!detalle) return(.graficos_cifras_de_grafico(parsed[["graficador"]], args, motor$fuentes, motor$presets))
      .graficos_cifras_de_grafico(parsed[["graficador"]], args, motor$fuentes, motor$presets, detalle = TRUE,
                                  caja = .graficos_resumenes_caja(motor, parsed[["caja"]]))
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

#' `detalle` del pedido de cifras: ausente o `false` es `FALSE`; `true` es `TRUE`; otra cosa es un 400
#' @keywords internal
.graficos_cifras_pide_detalle <- function(x) {
  if (is.null(x)) return(FALSE)
  if (is.logical(x) && length(x) == 1L && !is.na(x)) return(x)
  stop_api(400, "E_CIFRAS_INVALIDO", "`detalle` debe ser true o false.")
}
