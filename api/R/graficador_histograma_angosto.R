# Histograma del recetario en una celda angosta (CCSS-23, CCSS Perfil 2026, `p_slide_6_graficos_poblacion`).
#
# En una celda de 3.9 in las trece barras de la edad dejan 0.27 in por columna y el histograma rotulaba igual que a
# lámina completa: porcentajes encimados («21%26%18%»), números del eje pisándose y la base tachando el «18», porque el
# eje iba como texto en unidades de datos bajo la base. Aquí, cuando las cifras no caben en su columna, se rotulan sólo
# las que no tocan a su vecina (primero la moda y la de la mediana, luego las más altas), los valores del eje que caben
# (siempre el de la mediana, el primero y el último) y el eje pasa a ser texto del eje de ggplot, que se mide en
# pulgadas y no cruza la base. Ninguna cifra cambia: sólo cuáles se escriben.

#' Qué se rotula de un histograma dibujado a `ancho` pulgadas
#'
#' @param cifras,rotulos Las cifras sobre las barras ("" donde no hay casos) y los valores del eje.
#' @param valores Alto de cada barra (para la prioridad de las cifras).
#' @param x_med Columna de la mediana (desde 1).
#' @return `list(wcol, size_cifra, size_eje, cifra_visible, rotulo_visible, en_eje)`; `en_eje = FALSE` es el histograma
#'   de siempre (todo rotulado a 12 pt).
#' @keywords internal
.histograma_rotulado <- function(cifras, rotulos, valores, x_med, ancho = NULL) {
  n <- length(rotulos)
  ancho <- suppressWarnings(as.numeric(ancho)[1])
  # El panel: el ancho menos los márgenes del gráfico (12 pt a cada lado) y la expansión de 0.55 columnas a cada lado.
  wcol <- if (is.finite(ancho) && ancho > 0) (ancho - 2 * 12 / 72) / (n + 1.1) else Inf
  todo <- list(wcol = wcol, size_cifra = 12, size_eje = 12, cifra_visible = nzchar(cifras), rotulo_visible = rep(TRUE, n), en_eje = FALSE)
  if (!is.finite(wcol) || all(.lam_ancho_tinta(c(cifras[nzchar(cifras)], rotulos), 12, TRUE) <= wcol - 0.02)) return(todo)
  size <- 10
  elegir <- function(textos, orden, bold) {
    w <- .lam_ancho_tinta(textos, size, bold); vis <- rep(FALSE, n)
    for (i in orden) {
      if (!nzchar(textos[i])) next
      j <- which(vis)
      if (!length(j) || all(abs(j - i) * wcol >= (w[j] + w[i]) / 2 + 0.03)) vis[i] <- TRUE
    }
    vis
  }
  med <- min(max(1L, as.integer(round(x_med))), n); moda <- which.max(valores)
  orden_c <- unique(c(moda, med, order(-valores)))
  orden_r <- unique(c(med, 1L, n, seq_len(n)))
  list(wcol = wcol, size_cifra = size, size_eje = size, cifra_visible = elegir(cifras, orden_c, TRUE),
       rotulo_visible = elegir(rotulos, orden_r, FALSE), en_eje = TRUE)
}

#' El histograma angosto: las cifras elegidas sobre sus barras, el eje como texto del eje y la mediana arriba a la derecha
#' @keywords internal
.histograma_recetario_angosto <- function(d, rt, ymax, texto_med, titulo, subtitulo, nota_pie, cara, font_family,
                                          color_titulo, size_titulo, color_subtitulo, size_subtitulo, color_nota_pie,
                                          size_nota_pie, mediana, niveles, cnt, valor, lab, rot, x_med, enteros) {
  d$.lab_vis <- ifelse(rt$cifra_visible, d$.lab, "")
  br <- d$.x[rt$rotulo_visible]
  p <- ggplot2::ggplot(d, ggplot2::aes(x = .data$.x, y = .data$.valor)) +
    ggplot2::geom_col(width = 0.88, fill = .std_color("azul")) +
    ggplot2::geom_text(ggplot2::aes(label = .data$.lab_vis), vjust = -0.5, size = rt$size_cifra / ggplot2::.pt,
                       fontface = cara("valores"), colour = .std_color("azul"), family = font_family) +
    ggplot2::annotate("text", x = nrow(d) + 0.45, y = ymax, label = texto_med, hjust = 1, vjust = 1,
                      size = rt$size_cifra / ggplot2::.pt, fontface = "bold", colour = .std_color("coral"), family = font_family) +
    ggplot2::scale_x_continuous(breaks = br, labels = d$.rot[rt$rotulo_visible], expand = ggplot2::expansion(add = 0.55)) +
    ggplot2::scale_y_continuous(limits = c(0, ymax), expand = c(0, 0)) +
    ggplot2::coord_cartesian(clip = "off") +
    ggplot2::labs(title = titulo, subtitle = subtitulo, caption = nota_pie, x = NULL, y = NULL) +
    ggplot2::theme_void(base_family = font_family) +
    ggplot2::theme(
      axis.text.x = ggplot2::element_text(size = rt$size_eje, colour = .std_color("azul"), margin = ggplot2::margin(t = 3)),
      plot.title = ggplot2::element_text(colour = color_titulo, size = size_titulo, face = cara("titulo"), hjust = 0.5),
      plot.subtitle = ggplot2::element_text(colour = color_subtitulo, size = size_subtitulo, face = cara("subtitulo"), hjust = 0.5),
      plot.caption = ggplot2::element_text(colour = color_nota_pie, size = size_nota_pie, face = cara("nota_pie"), hjust = 1),
      plot.margin = ggplot2::margin(8, 12, 8, 12)
    )
  attr(p, "pulso_histograma_recetario") <- c(list(mediana = mediana, niveles = niveles, conteos = cnt), rt)
  attr(p, "pulso_espec") <- list(version = "histograma/1", tipo = "histograma", rotulos = rot, valores = valor, cifras = lab,
                                 conteos = cnt, mediana = mediana, x_mediana = x_med - 1, texto_mediana = texto_med, enteros = enteros)
  p
}
