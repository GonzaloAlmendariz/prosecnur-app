# =============================================================================
# graficador_guia_codo.R — la guía de una cifra chica, en codo como el recetario
# =============================================================================
#
# Gonzalo, 2026-10-08: «en algunos porcetajes pequenos se hacia una linea recta en
# diagonal en vez de la linea progeiosnal del recetarios para porcetajes
# pequenos». El recetario (`barra_apilada()`, recetario.R:157-180) sube una guía
# vertical corta desde el centro del segmento y, si la cifra se corrió para no
# pisar a su vecina, sigue en horizontal hasta quedar bajo ella: un codo, nunca
# una diagonal. El color es el de la cifra (`.col_conector`): por defecto el gris
# tenue del recetario (`color_conectores_etiquetas = "tenue"`), el mismo de la
# lámina nativa (`lamina_escala.R`).

#' Capas de la guía en codo para las cifras que suben
#'
#' `df` trae `x_conector_barra` (centro del segmento), `x_conector_label` (bajo la
#' cifra), `y_conector_barra` (techo de la barra), `y_conector_label` (altura del
#' tramo horizontal) y `.col_conector`. Devuelve dos `geom_segment`: el vertical
#' y el horizontal; el color pasa por la escala identidad del gráfico.
#' @keywords internal
.apiladas_guia_codo <- function(df, linewidth = 0.32) {
  list(
    ggplot2::geom_segment(
      data = df,
      mapping = ggplot2::aes(x = x_conector_barra, xend = x_conector_barra, y = y_conector_barra, yend = y_conector_label,
                             colour = .data$.col_conector),
      linewidth = linewidth, lineend = "butt", inherit.aes = FALSE, show.legend = FALSE
    ),
    ggplot2::geom_segment(
      data = df,
      mapping = ggplot2::aes(x = x_conector_barra, xend = x_conector_label, y = y_conector_label, yend = y_conector_label,
                             colour = .data$.col_conector),
      linewidth = linewidth, lineend = "butt", inherit.aes = FALSE, show.legend = FALSE
    )
  )
}
