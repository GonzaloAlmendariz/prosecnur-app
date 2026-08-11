# =============================================================================
# graficos_metadata_unidades.R — la unidad de las medidas de layout
# =============================================================================
#
# El editor visual de distribución del espacio degrada a «Medida exacta ·
# Unidad no publicada · Sin reparto visual» cuando el registro no dice en qué
# unidad está cada medida (`resolveLayoutMeasureContract` en
# `chartLayoutHelpers.ts` lo exige por nombre Y por unidad). Ningún preset la
# publicaba, así que el analista veía «Grupo 0,22» a secas: un número sin
# referencia, sin saber si es proporción, pulgadas o centímetros, y sin el
# reparto visual que enseña cuánto se lleva cada banda.
#
# La unidad es un hecho del motor, no una preferencia: `canvas_w_*` se normaliza
# dividiendo por su suma (`w_sum` en `graficador_barras_apiladas.R`), o sea es
# una proporción; los `*_in` y `alto_por_categoria` son pulgadas. Se estampa en
# UN sitio y por nombre, en vez de repetirla en las ~30 declaraciones sueltas
# donde ya divergiría a la tercera edición.

#' Anchos horizontales del canvas: se normalizan contra su suma, así que lo que
#' vale es la proporción y no el número absoluto.
#' @keywords internal
.GRAFICOS_ARGS_PROPORCION <- c(
  "canvas_w_grupo", "canvas_w_buf_grupo_etq", "canvas_w_etiquetas",
  "canvas_w_buf_etq_bars", "canvas_w_bars", "canvas_w_buf_bars_extra",
  "canvas_w_extra"
)

#' Medidas verticales que el motor interpreta en pulgadas.
#' @keywords internal
.GRAFICOS_ARGS_PULGADAS <- c(
  "canvas_h_header_in", "canvas_h_legend_in", "canvas_h_caption_in",
  "canvas_h_toprow_in", "canvas_h_panel_in", "alto_por_categoria"
)

#' Estampa `unidad` en los args de layout que no la traigan.
#'
#' Respeta la que ya venga declarada: si una entrada del registro dice lo suyo,
#' manda esa. Sólo rellena el hueco.
#' @keywords internal
.graficos_estampar_unidades <- function(args) {
  if (!is.list(args)) return(args)
  lapply(args, function(a) {
    if (!is.list(a) || is.null(a$name)) return(a)
    nm <- as.character(a$name)[1]
    ya <- trimws(as.character(a$unidad %||% ""))
    if (length(ya) && nzchar(ya)) return(a)
    # Con tilde: esto se PINTA en la UI. El frontend normaliza (quita acentos)
    # sólo para comparar, así que la forma correcta no le estorba.
    if (nm %in% .GRAFICOS_ARGS_PROPORCION) a$unidad <- "proporción"
    else if (nm %in% .GRAFICOS_ARGS_PULGADAS) a$unidad <- "pulgadas"
    a
  })
}

#' Aplica el estampado a todo un bloque de entradas del registro.
#'
#' Sirve igual para `presets` que para `graficadores`: los dos son listas de
#' entradas con `$args`.
#' @keywords internal
.graficos_estampar_unidades_bloque <- function(bloque) {
  if (!is.list(bloque)) return(bloque)
  lapply(bloque, function(entrada) {
    if (is.list(entrada) && !is.null(entrada$args)) {
      entrada$args <- .graficos_estampar_unidades(entrada$args)
    }
    entrada
  })
}
