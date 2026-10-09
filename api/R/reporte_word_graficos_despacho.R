# =============================================================================
# reporte_word_graficos_despacho.R — qué dibuja cada gráfico en el Word (N8.9; lo usa la fachada de N8.15)
# =============================================================================
#
# El graficador cuelga de su ggplot la espec (`attr(p, "pulso_espec")`). Si su tipo tiene renderer del recetario Word,
# se usa; si no, el propio ggplot va «en su marco» (`ggplot_marco`): sin título, subtítulo ni pie (los pone el
# documento: rótulo, título y base), con el tema del Word encima del suyo. El piso de 8 pt y el fondo transparente los
# pone `.word_png()` al dibujar.

#' Renderer Word de cada tipo de espec
#' @keywords internal
.WORD_RENDERERS <- list(
  categorica = function(e) if (isTRUE(.lam_es_dicotomia(e))) .word_g_sino(e) else .word_g_barras(e),   # la misma regla que la lámina
  escala = function(e) .word_g_escala(e),
  divergentes = function(e) .word_g_divergente(e),
  pesas = function(e) .word_g_pesas(e),
  histograma = function(e) .word_g_hist(e),
  numerico = function(e) .word_g_promedios(e),
  media_rango = function(e) .word_g_rango(e),
  boxplot = function(e) .word_g_boxplot(e),
  pie = function(e) .word_g_pie(e),
  heatmap_dim = function(e) .word_g_heat(e),
  comparativo_dim = function(e) .word_g_comparativo_dim(e),
  radar = function(e) .word_g_radar(e),
  mapa = function(e) .word_g_mapa(e)
)

#' El gráfico Word de un ggplot del motor: el renderer de su espec o, sin él, el propio ggplot en su marco
#'
#' Si el renderer falla con la espec real, el gráfico no se pierde: cae al marco y lo dice por stderr, para que el
#' Word salga igual y la falla quede a la vista.
#' @param p ggplot que devolvió el graficador (con o sin `pulso_espec`).
#' @return ggplot con atributo `alto` (in, sin el pie) y `renderer` (el tipo usado o «marco»).
#' @keywords internal
.word_grafico <- function(p) {
  espec <- attr(p, "pulso_espec")
  tipo <- if (is.list(espec)) as.character(espec$tipo %||% "")[1] else ""
  f <- .WORD_RENDERERS[[tipo]]
  if (is.function(f)) {
    g <- tryCatch(f(espec), error = function(e) {
      message("[word] el renderer «", tipo, "» falló con la espec real y el gráfico va en su marco: ", conditionMessage(e))
      NULL
    })
    if (!is.null(g)) { attr(g, "renderer") <- tipo; return(g) }
  }
  .word_g_marco(p)
}

#' Un ggplot del motor en el marco del Word: sin título, subtítulo ni pie y con el tema del recetario encima del suyo
#' @param alto Alto en pulgadas; por defecto el que sugiere el propio gráfico o 2.6 (el de una figura media del recetario).
#' @keywords internal
.word_g_marco <- function(p, alto = NULL) {
  if (!inherits(p, "ggplot")) stop("El gráfico no es un ggplot y no tiene renderer Word.", call. = FALSE)
  g <- p + ggplot2::labs(title = NULL, subtitle = NULL, caption = NULL) +
    ggplot2::theme(plot.background = ggplot2::element_blank(), panel.background = ggplot2::element_blank(),
                   legend.position = "bottom", legend.title = ggplot2::element_blank())
  a <- suppressWarnings(as.numeric(alto %||% attr(p, "alto_word") %||% 2.6))
  attr(g, "alto") <- if (length(a) && is.finite(a[1]) && a[1] > 0) a[1] else 2.6
  attr(g, "renderer") <- "marco"
  g
}
