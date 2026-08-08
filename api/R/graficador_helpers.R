# ============================================================
# Helpers para posición de títulos (hjust/vjust)
# ============================================================

hjust_from_pos <- function(pos) {
  # Pos puede venir en NULL, en español o en numérico.
  # Fallback: centro (0.5)
  if (is.null(pos)) return(0.5)

  # Si ya es numérico válido, se respeta
  if (is.numeric(pos) && length(pos) == 1L && is.finite(pos)) {
    return(max(0, min(1, pos)))
  }

  # Aceptar alias en texto
  pos <- tolower(as.character(pos))

  if (pos %in% c("izq", "izquierda", "left"))       return(0)
  if (pos %in% c("cen", "centro", "center", "centre")) return(0.5)
  if (pos %in% c("der", "derecha", "right"))        return(1)

  # Si viene algo raro, volvemos a centro
  0.5
}

# ============================================================
# Glifo de leyenda cuadrado de tamaño ABSOLUTO
# ============================================================
#
# El key box de ggplot hereda la altura del texto de la leyenda (más alto que
# ancho), así que tanto el glifo default de geom_col como draw_key_rect
# rinden swatches rectangulares. Este constructor devuelve una key-glyph
# function que dibuja siempre un cuadrado de `lado_cm` × `lado_cm` centrado
# en el box, sin importar tipografía ni grosor de barra (GOAL motor PPT,
# P13/P16).
.graficos_key_glyph_cuadrado <- function(lado_cm) {
  lado <- suppressWarnings(as.numeric(lado_cm)[1])
  if (!is.finite(lado) || lado <= 0) lado <- 0.30
  function(data, params, size) {
    alfa <- data$alpha %||% 1
    if (is.na(alfa)) alfa <- 1
    grid::rectGrob(
      width  = grid::unit(lado, "cm"),
      height = grid::unit(lado, "cm"),
      gp = grid::gpar(
        col = NA,
        fill = scales::alpha(data$fill %||% "grey20", alfa)
      )
    )
  }
}

# ============================================================
# Area util del pie dentro del canvas
# ============================================================
#
# El pie se alinea con la COLUMNA DE CONTENIDO, no con el borde del lienzo.
# Los canvas de barras (agrupadas y apiladas) dibujaban el caption con
# `x = hjust`, que en la posicion por defecto ("derecha") vale 1: el texto
# terminaba exactamente en x = 1, el borde absoluto de la imagen, y cualquier
# nota de mas de una linea salia tocando o cruzando ese borde. El resto del
# canvas ya reparte el ancho en columnas y ninguna llega a 1; el caption era la
# unica zona que ignoraba ese reparto.
#
# Devuelve `list(x, x0, x1)`: la coordenada donde anclar el texto y los limites
# del area util, que el modo `debug_ph_bordes` dibuja para que el reparto sea
# inspeccionable.
.graficos_caption_x <- function(hjust, x0, x1, margen = 0.012) {
  x0 <- suppressWarnings(as.numeric(x0)[1])
  x1 <- suppressWarnings(as.numeric(x1)[1])
  if (!is.finite(x0)) x0 <- 0
  if (!is.finite(x1) || x1 <= x0) x1 <- 1

  margen <- suppressWarnings(as.numeric(margen)[1])
  if (!is.finite(margen) || margen < 0) margen <- 0.012
  # Un margen mayor que el area util la invertiria; se acota a un tercio.
  margen <- min(margen, (x1 - x0) / 3)

  x0 <- x0 + margen
  x1 <- x1 - margen

  hjust <- suppressWarnings(as.numeric(hjust)[1])
  if (!is.finite(hjust)) hjust <- 1

  x <- if (hjust <= 0) x0 else if (hjust >= 1) x1 else x0 + (x1 - x0) * hjust
  list(x = x, x0 = x0, x1 = x1)
}

vjust_from_pos <- function(pos) {
  # Mismo espíritu por si en algún momento se usa en títulos de eje, etc.
  if (is.null(pos)) return(0.5)

  if (is.numeric(pos) && length(pos) == 1L && is.finite(pos)) {
    return(max(0, min(1, pos)))
  }

  pos <- tolower(as.character(pos))

  if (pos %in% c("arriba", "top"))    return(1)
  if (pos %in% c("medio", "centro", "middle", "center")) return(0.5)
  if (pos %in% c("abajo", "bottom")) return(0)

  0.5
}
