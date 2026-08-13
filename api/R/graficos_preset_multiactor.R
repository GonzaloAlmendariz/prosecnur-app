# =============================================================================
# graficos_preset_multiactor.R — el reparto multiactor es un preset, no una
# constante escondida en el motor
# =============================================================================
#
# El layout multiactor —una lámina con varios públicos comparados sobre la misma
# escala— reparte su ancho en cuatro columnas: el TEMA (el enunciado del
# bloque), el EJE Y (el nombre del actor), las BARRAS y la BARRA EXTRA. Ese
# reparto vivía escrito a mano dentro de `reporte_plan_ppt.R` y se mezclaba POR
# ENCIMA de los presets, así que los cuatro args existían en el inspector y no
# hacían nada.
#
# Medido: poner `canvas_w_grupo = 0.40` en el preset `multi_apiladas` de un
# proyecto no cambia un píxel del PPT. El motor lo pisa con su 0.13.
#
# Aquí el reparto pasa a ser lo que ya era en la práctica —un preset— pero
# declarado donde el analista lo ve y lo puede tocar. Dos reglas lo mantienen
# coherente:
#
#   · **Las barras son el resto.** No se declaran: se calculan con lo que sobra
#     después del tema, el eje y la barra extra. Así la suma cierra siempre en 1
#     y ensanchar el tema tiene una consecuencia visible en vez de romper la
#     geometría por detrás.
#   · **Las barras tienen un piso.** Por debajo de él la lámina deja de ser un
#     gráfico de barras, así que el reparto se rechaza y se avisa en vez de
#     dibujar algo ilegible.

#' Piso de las barras. Por debajo, el gráfico deja de serlo.
#' @keywords internal
.MULTIACTOR_W_BARS_MIN <- 0.45

#' Reparto de fábrica del layout multiactor.
#'
#' El tema se lleva 0.20 y el eje 0.10 —y no al revés, que era lo que había—
#' porque el tema es una pregunta completa y el actor es una palabra. Además el
#' actor va pegado al borde derecho de su canal (`hjust = 1`), así que estrechar
#' ese canal no le mueve el texto: sólo recorta el hueco vacío que tenía delante.
#'
#' @keywords internal
.MULTIACTOR_CANVAS_BASE <- list(
  canvas_w_grupo         = 0.20,
  canvas_w_buf_grupo_etq = 0.01,
  canvas_w_etiquetas     = 0.10,
  canvas_w_buf_etq_bars  = 0.01
)

#' Resuelve el reparto de ancho de una lámina multiactor.
#'
#' @param preset_args Args del preset `multi_apiladas_multiactor` tal como los
#'   trae el proyecto. Lo que no declare se toma del reparto de fábrica.
#' @param show_extra ¿La lámina lleva barra extra (Top 2 Box y compañía)?
#' @return Lista con las siete fracciones que consume el graficador.
#' @keywords internal
.multiactor_canvas_resolver <- function(preset_args = list(), show_extra = FALSE) {
  `%|N|%` <- function(a, b) if (is.null(a)) b else a
  preset_args <- preset_args %|N|% list()

  frac <- function(nm, fallback) {
    v <- suppressWarnings(as.numeric(preset_args[[nm]] %|N|% fallback)[1])
    if (!is.finite(v) || is.na(v) || v < 0) fallback else v
  }

  w_grupo <- frac("canvas_w_grupo",         .MULTIACTOR_CANVAS_BASE$canvas_w_grupo)
  w_buf1  <- frac("canvas_w_buf_grupo_etq", .MULTIACTOR_CANVAS_BASE$canvas_w_buf_grupo_etq)
  w_etq   <- frac("canvas_w_etiquetas",     .MULTIACTOR_CANVAS_BASE$canvas_w_etiquetas)
  w_buf2  <- frac("canvas_w_buf_etq_bars",  .MULTIACTOR_CANVAS_BASE$canvas_w_buf_etq_bars)

  # La barra extra sólo ocupa cuando existe. Un ancho declarado con la barra
  # apagada sería espacio muerto entre las barras y el borde.
  w_extra <- if (isTRUE(show_extra)) frac("canvas_w_extra", 0.10) else 0
  w_buf3  <- if (isTRUE(show_extra)) frac("canvas_w_buf_bars_extra", 0.02) else 0

  ocupado <- w_grupo + w_buf1 + w_etq + w_buf2 + w_buf3 + w_extra
  w_bars  <- 1 - ocupado

  if (w_bars < .MULTIACTOR_W_BARS_MIN) {
    .pulso_aviso(sprintf(
      paste0("El reparto de ancho de la lamina multiactor deja %.0f%% para las barras y el ",
             "minimo es %.0f%%: se vuelve al reparto de fabrica. Baja el ancho del tema o ",
             "el del eje en Configuracion global > Multi-apiladas multiactor."),
      w_bars * 100, .MULTIACTOR_W_BARS_MIN * 100
    ))
    return(.multiactor_canvas_resolver(list(), show_extra = show_extra))
  }

  list(
    canvas_w_grupo          = w_grupo,
    canvas_w_buf_grupo_etq  = w_buf1,
    canvas_w_etiquetas      = w_etq,
    canvas_w_buf_etq_bars   = w_buf2,
    canvas_w_bars           = w_bars,
    canvas_w_buf_bars_extra = w_buf3,
    canvas_w_extra          = w_extra
  )
}

#' Cuántos caracteres sostiene la columna del tema.
#'
#' El wrap tiene que seguir al ancho o ensancharlo no sirve de nada: medido, con
#' la columna a 0.22 y el wrap intacto el enunciado no cambió ni una línea.
#'
#' La relación NO es proporcional al ancho. Escalar linealmente desde el origen
#' —0.36 × (w / 0.13)— da 0.55 con la columna en 0.20 y el texto se sale por la
#' izquierda; medido, ahí el valor bueno es 0.42. Los dos puntos observados
#' —(0.13, 0.36) y (0.20, 0.42)— definen una recta con pendiente 0.857, y la
#' diferencia con la proporcional es el margen fijo que el canal necesita
#' independientemente de lo ancho que sea.
#'
#' @param w_grupo Fracción de ancho de la columna del tema.
#' @param wrap_y_eff Ancho de referencia en caracteres del eje Y.
#' @keywords internal
.multiactor_wrap_tema <- function(w_grupo, wrap_y_eff) {
  w <- suppressWarnings(as.numeric(w_grupo)[1])
  if (!is.finite(w) || is.na(w) || w <= 0) w <- .MULTIACTOR_CANVAS_BASE$canvas_w_grupo
  base <- suppressWarnings(as.numeric(wrap_y_eff)[1])
  if (!is.finite(base) || is.na(base) || base <= 0) base <- 40
  max(10, floor(base * (0.36 + (w - 0.13) * 0.857)))
}
