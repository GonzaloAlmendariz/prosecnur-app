# =============================================================================
# graficador_histograma_recetario.R — el histograma del recetario (ADR 0092, F2.7c)
# =============================================================================
#
# Porta la lámina «Histograma» del recetario (docs/qa/motor-ppt-2026-10-06/
# herramientas/recetario_graficos2.R:4-18): una barra azul por valor, su cifra
# encima a 12 pt en negrita, el valor debajo de cada barra, sin eje Y ni título
# del eje; la mediana como triángulo coral bajo su valor y su cifra arriba a la
# derecha, sin línea punteada (Gonzalo, 2026-10-08). Si se declara un límite
# superior, lo que lo supera se junta en la última barra, rotulada «N+».

#' ¿El histograma se puede dibujar con una barra por valor?
#' @keywords internal
.histograma_recetario_aplica <- function(x, grupo, bins, ancho_bin) {
  # Una lista vacía o NA cuenta como «no declarado»: el round-trip de la UI
  # guarda `ancho_bin = list()` y eso no es una decisión del analista.
  vacio <- function(v) is.null(v) || !length(v) || all(is.na(suppressWarnings(as.numeric(unlist(v)))))
  sin_grupo <- is.null(grupo) || !length(grupo) || !nzchar(trimws(as.character(grupo)[1]))
  sin_grupo && vacio(bins) && vacio(ancho_bin) && length(x) > 0L &&
    all(abs(x - round(x)) < 1e-9) && diff(range(x)) <= 40
}

#' Dibuja el histograma del recetario
#' @keywords internal
.histograma_recetario <- function(x, modo = "porcentaje_total", decimales = 0, limite_superior = NULL,
                                  titulo = NULL, subtitulo = NULL, nota_pie = NULL,
                                  textos_negrita = c("valores"), font_family = .std_pt("fuente"),
                                  color_titulo = .std_color("coral"), size_titulo = 12,
                                  color_subtitulo = .std_color("azul"), size_subtitulo = 10,
                                  color_nota_pie = .std_color("azul"), size_nota_pie = 8,
                                  unidad = "") {
  cara <- function(token) if (token %in% textos_negrita) "bold" else "plain"
  mediana <- stats::median(x)
  tope <- suppressWarnings(as.numeric(limite_superior)[1])
  xv <- if (is.finite(tope)) pmin(x, tope) else x
  niveles <- seq(min(xv), max(xv))
  cnt <- as.vector(table(factor(xv, levels = niveles)))
  valor <- switch(modo, conteo = cnt, cnt / sum(cnt) * 100)
  lab <- if (identical(modo, "conteo")) format(cnt, trim = TRUE) else .pulso_fmt_pct_half_up(valor, decimales, escala = 1)
  lab[cnt == 0] <- ""
  rot <- as.character(niveles)
  if (is.finite(tope) && any(x > tope)) rot[length(rot)] <- paste0(rot[length(rot)], "+")
  d <- data.frame(.x = seq_along(niveles), .valor = valor, .lab = lab, .rot = rot)
  ymax <- max(d$.valor) * 1.18
  x_med <- min(mediana, if (is.finite(tope)) tope else Inf) - min(xv) + 1
  texto_med <- trimws(sprintf("Mediana: %s %s", format(round(mediana, 1), trim = TRUE), unidad))
  p <- ggplot2::ggplot(d, ggplot2::aes(x = .data$.x, y = .data$.valor)) +
    ggplot2::geom_col(width = 0.88, fill = .std_color("azul")) +
    ggplot2::geom_text(ggplot2::aes(label = .data$.lab), vjust = -0.5, size = 12 / ggplot2::.pt,
                       fontface = cara("valores"), colour = .std_color("azul"), family = font_family) +
    # El valor bajo su barra y, debajo, el triángulo de la mediana.
    ggplot2::geom_text(ggplot2::aes(y = -0.07 * ymax, label = .data$.rot), size = 12 / ggplot2::.pt,
                       colour = .std_color("azul"), family = font_family) +
    ggplot2::annotate("point", x = x_med, y = -0.17 * ymax, shape = 17, size = 4.2, colour = .std_color("coral")) +
    ggplot2::annotate("text", x = nrow(d) + 0.45, y = ymax, label = texto_med, hjust = 1, vjust = 1,
                      size = 12 / ggplot2::.pt, fontface = "bold", colour = .std_color("coral"), family = font_family) +
    ggplot2::scale_x_continuous(expand = ggplot2::expansion(add = 0.55)) +
    ggplot2::scale_y_continuous(limits = c(-0.22 * ymax, ymax), expand = c(0, 0)) +
    ggplot2::coord_cartesian(clip = "off") +
    ggplot2::labs(title = titulo, subtitle = subtitulo, caption = nota_pie, x = NULL, y = NULL) +
    ggplot2::theme_void(base_family = font_family) +
    ggplot2::theme(
      plot.title = ggplot2::element_text(colour = color_titulo, size = size_titulo, face = cara("titulo"), hjust = 0.5),
      plot.subtitle = ggplot2::element_text(colour = color_subtitulo, size = size_subtitulo, face = cara("subtitulo"), hjust = 0.5),
      plot.caption = ggplot2::element_text(colour = color_nota_pie, size = size_nota_pie, face = cara("nota_pie"), hjust = 1),
      plot.margin = ggplot2::margin(8, 12, 8, 12)
    )
  attr(p, "pulso_histograma_recetario") <- list(mediana = mediana, niveles = niveles, conteos = cnt)
  # ADR 0093 (N4): lo que afirma el histograma para la lámina nativa; las cifras son las mismas que rotula el gráfico.
  attr(p, "pulso_espec") <- list(version = "histograma/1", tipo = "histograma", rotulos = rot, valores = valor, cifras = lab,
                                 conteos = cnt, mediana = mediana, x_mediana = x_med - 1, texto_mediana = texto_med)
  p
}
