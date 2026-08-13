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
# Negritas por componente
# ============================================================
#
# `textos_negrita` es un vector de tokens ("titulo", "leyenda", …) que enciende
# la negrita de cada pieza de texto. La resolucion se repetia literal en cada
# graficador que lo soportaba —y faltaba entera en cinco que si lo ofrecian en
# la UI, donde el knob no hacia nada—, asi que vive aqui.
#
# Devuelve una funcion: `face("titulo")` da "bold" o "plain". Acepta varios
# tokens y responde "bold" si cualquiera esta encendido, para que un graficador
# con un solo eje pueda preguntar por `c("ejes", "eje_x")` de una vez.
#' Cara de una parte del gráfico según la declaración del analista.
#'
#' Hubo una version de esto que conservaba «la negrita que la parte tenia antes
#' de tener interruptor» cuando `textos_negrita` llegaba vacio. Era una muleta:
#' existia porque el motor no podia distinguir «nadie lo declaro» de «alguien
#' declaro justo el default», y sin ella cablear un interruptor escrito a fuego
#' habria cambiado el aspecto de proyectos vivos.
#'
#' El ADR 0074 quita esa ambiguedad —el `.pulso` guarda solo lo que difiere del
#' default, asi que presencia = decision— y la muleta sobra: si una parte no
#' esta declarada, no se eligio, y va en plana.
#'
#' @param textos_negrita Declaracion del analista.
#' @param token Parte que se esta dibujando.
#' @param legado Ignorado. Se conserva en la firma para no romper llamadas.
#' @keywords internal
.graficos_face_legado <- function(textos_negrita, token, legado = "bold") {
  tokens <- as.character(textos_negrita %||% character(0))
  tokens <- tokens[!is.na(tokens) & nzchar(tokens)]
  if (token %in% tokens) "bold" else "plain"
}

.graficos_face_de <- function(textos_negrita) {
  tokens <- as.character(textos_negrita %||% character(0))
  tokens <- tokens[!is.na(tokens) & nzchar(tokens)]
  function(...) {
    pedidos <- as.character(unlist(list(...)))
    if (any(pedidos %in% tokens)) "bold" else "plain"
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

#' Cara del subtítulo: la negrita se SUMA a su cursiva, no la sustituye.
#'
#' El subtítulo nace en cursiva (`face_subtitulo = "italic"`) en agrupadas y
#' apiladas. Pedir negrita le quitaba la cursiva —salía `bold` y no
#' `bold.italic`—, así que el interruptor cambiaba dos cosas cuando el analista
#' pidió una. En agrupadas era peor: `textos_negrita` ni se consultaba y el
#' mando estaba muerto.
#'
#' @param textos_negrita Declaración del analista.
#' @param face_base Cara de fábrica del subtítulo, normalmente `"italic"`.
#' @keywords internal
.graficos_face_subtitulo <- function(textos_negrita, face_base = "italic") {
  base <- as.character(face_base %||% "plain")[1]
  if (is.na(base) || !nzchar(base)) base <- "plain"
  tokens <- as.character(textos_negrita %||% character(0))
  tokens <- tokens[!is.na(tokens) & nzchar(tokens)]
  if (!"subtitulo" %in% tokens) return(base)
  # ggplot2 y grid lo escriben con punto: "bold.italic".
  if (grepl("italic", base, fixed = TRUE)) "bold.italic" else "bold"
}
