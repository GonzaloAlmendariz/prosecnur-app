# =============================================================================
# graficos_resumenes_motor.R — fuentes y presets del motor para los endpoints de resúmenes (ADR 0135)
# =============================================================================
#
# El conteo de la regla (`POST /api/graficos/resumenes/regla`) y las cifras del cierre (`POST .../cifras`) miden lo que
# dibuja la lámina, así que preparan las fuentes y los presets como la vista previa (`.graficos_preview_comun`): la
# regla inclusiva y los rótulos cortos de la base activa, y los presets del estudio. Antes el conteo leía las fuentes
# crudas y sin presets: con un preset `excluir_opciones = "9"` el Top Two Box daba 42 en el conteo y 51 en la lámina
# (revisión metodológica de la regla, H3).

#' Fuentes y presets del motor para un pedido de resúmenes
#'
#' @param sid Sesión. @param parsed Cuerpo del pedido (`scope`, `config`: los presets salen de su config efectiva, como
#'   en la vista previa).
#' @return `list(fuentes = list(data_sources, inst_sources), presets, inclusivo, mapa)`; `presets` es `NULL` si el
#'   estudio no declara. `inclusivo` y `mapa` (rótulos cortos) son los que se aplicaron a las fuentes: los args del
#'   gráfico se convierten igual con `.graficos_resumenes_args` (N3).
#' @keywords internal
.graficos_resumenes_motor <- function(sid, parsed) {
  fuentes <- .graficos_preview_fuentes(sid, parsed)
  comun <- .graficos_preview_comun(sid, parsed, fuentes)
  list(fuentes = list(data_sources = comun$data_sources, inst_sources = comun$inst_sources,
                     equivalencias_publicos = .tpub_equivalencias_sesion(sid)),   # el contraste empareja con la matriz (ADR 0138 §5)
       presets = if (length(comun$presets_json)) .build_presets(comun$presets_json) else NULL,
       inclusivo = isTRUE(comun$inclusivo), mapa = comun$rotulos_cortos_mapa %||% character(0))
}

#' Los args de un gráfico con la regla inclusiva y los rótulos cortos que el motor aplicó a las fuentes
#'
#' Revisión metodológica de la regla, N3: con las fuentes convertidas («No sabe / no opina» → «NS/NO») y los args
#' crudos, un `excluir_opciones` por rótulo ya no casaba y el conteo daba 42 mientras el render daba 51. La vista previa
#' convierte la lámina entera (graficos_miniaturas.R, `.inclusivo_preparar_lamina`); aquí, el gráfico.
#' @keywords internal
.graficos_resumenes_args <- function(motor, graficador, args) {
  if (!isTRUE(motor$inclusivo) || !is.list(args)) return(args)
  slide <- list(payload = list(g = list(graficador = graficador, args = args)))
  .inclusivo_preparar_lamina(slide, motor$mapa %||% character(0))$payload$g$args %||% args
}

#' Los rótulos de una caja pedida (detalle de cifras) con la misma conversión que los datos
#' @keywords internal
.graficos_resumenes_caja <- function(motor, caja) {
  if (!isTRUE(motor$inclusivo) || is.null(caja)) return(caja)
  .inclusivo_convertidor(motor$mapa %||% character(0))(caja)
}

#' Las láminas de un lote de cifras con sus args (y su caja) convertidos (`.graficos_resumenes_args`); el resto, como llegó
#' @keywords internal
.graficos_resumenes_laminas <- function(motor, laminas) {
  if (!is.list(laminas) || !isTRUE(motor$inclusivo)) return(laminas)
  lapply(laminas, function(it) {
    if (!is.list(it)) return(it)
    if (!is.null(it$caja)) it$caja <- .graficos_resumenes_caja(motor, it$caja)
    if (is.list(it$slide)) {
      if (!is.null(it$slide$caja)) it$slide$caja <- .graficos_resumenes_caja(motor, it$slide$caja)
      it$slide$args <- .graficos_resumenes_args(motor, it$slide$graficador, it$slide$args %||% list())
    } else if (!is.null(it$graficador)) {
      it$args <- .graficos_resumenes_args(motor, it$graficador, it$args %||% list())
    }
    it
  })
}
