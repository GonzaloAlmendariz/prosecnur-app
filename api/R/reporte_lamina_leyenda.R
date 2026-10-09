# =============================================================================
# reporte_lamina_leyenda.R — la leyenda como parte de la lámina (ADR 0092, F3)
# =============================================================================
#
# Pregunta de Gonzalo (2026-10-08): «por qué en el recetario se ve tan bien y en
# las imágenes la leyenda se ve tan diferente». El recetario dibuja la leyenda
# con formas nativas de la lámina (recetario.R:143-153, `leyenda()`): cuadro de
# 0.15 in, texto a 12 pt, 0.3 in entre ítems, centrada en el bloque. El motor la
# dibujaba DENTRO de la imagen del gráfico, así que escalaba con el lienzo: en
# una batería larga el lienzo se encoge al colocarse y la letra bajaba a ~7 pt.
#
# Aquí la lámina la reemplaza: quita del gráfico las capas de su leyenda (las
# declara el graficador en `attr(, "pulso_leyenda_nativa")`) y la dibuja con
# formas nativas en el MISMO lugar —mismas filas, mismo centro—, a tamaño fijo.
# Sin el atributo no hace nada: los gráficos que no lo declaran no cambian.

.LEYENDA_CUADRO_IN <- 0.15
.LEYENDA_SEPARACION_IN <- 0.3

#' Ancho de tinta de un texto en pulgadas (Arial, estimado como el recetario)
#' @keywords internal
.leyenda_ancho_tinta <- function(s, size_pt) nchar(s, type = "width") * size_pt * 0.52 / 72

#' El dml sin las capas de su leyenda, si el gráfico la declara
#' @keywords internal
.ppt_quitar_leyenda <- function(value) {
  g <- value$ggobj
  info <- if (inherits(g, "ggplot")) attr(g, "pulso_leyenda_nativa") else NULL
  if (is.null(info) || !length(info$capas)) return(value)
  g$layers <- g$layers[-info$capas]
  value$ggobj <- g
  value
}

#' Dibuja la leyenda nativa donde el gráfico tenía la suya
#'
#' @param doc Documento `officer` con la lámina en curso.
#' @param value El `dml` ORIGINAL (con el atributo de su leyenda).
#' @param loc Ubicación con que se colocó el gráfico (`left/top/width/height`).
#' @keywords internal
.ppt_leyenda_nativa <- function(doc, value, loc) {
  g <- value$ggobj
  info <- if (inherits(g, "ggplot")) attr(g, "pulso_leyenda_nativa") else NULL
  if (is.null(info) || !length(info$etiquetas)) return(doc)
  size <- .std_pt("leyenda")
  azul <- .std_color("azul")
  fuente <- .std_pt("fuente")
  filas <- info$filas %||% rep(1L, length(info$etiquetas))
  for (r in sort(unique(filas))) {
    idx <- which(filas == r)
    anchos <- .leyenda_ancho_tinta(info$etiquetas[idx], size)
    w_items <- .LEYENDA_CUADRO_IN + 0.07 + anchos
    total <- sum(w_items) + .LEYENDA_SEPARACION_IN * (length(idx) - 1L)
    x <- loc$left + info$x_centro_npc * loc$width - total / 2
    x <- max(loc$left, min(x, loc$left + loc$width - total))
    y_centro <- loc$top + (1 - info$y_filas_npc[[r]]) * loc$height
    for (k in seq_along(idx)) {
      i <- idx[k]
      doc <- officer::ph_with(doc, value = "", location = officer::ph_location(
        left = x, top = y_centro - .LEYENDA_CUADRO_IN / 2, width = .LEYENDA_CUADRO_IN,
        height = .LEYENDA_CUADRO_IN, bg = info$colores[[i]], newlabel = paste0("prosecnur:leyenda:cuadro:", i)))
      # La caja de texto lleva 0.1 in de margen interno: se corre a la izquierda.
      doc <- officer::ph_with(doc, value = officer::fpar(officer::ftext(
        info$etiquetas[[i]], officer::fp_text(color = azul, font.size = size, font.family = fuente))),
        location = officer::ph_location(
          left = x + .LEYENDA_CUADRO_IN + 0.07 - 0.1, top = y_centro - 0.17, width = anchos[k] + 0.35,
          height = 0.34, newlabel = paste0("prosecnur:leyenda:texto:", i)))
      x <- x + w_items[k] + .LEYENDA_SEPARACION_IN
    }
  }
  doc
}
