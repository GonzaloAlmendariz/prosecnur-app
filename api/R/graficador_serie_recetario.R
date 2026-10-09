# =============================================================================
# graficador_serie_recetario.R — la serie temporal del recetario (ADR 0092, F2.7b)
# =============================================================================
#
# Porta `grafico_serie` (docs/qa/motor-ppt-2026-10-06/herramientas/
# recetario_piezas.R:105-140):
#
#   - eje acercado al rango (múltiplos de 10, con 8 puntos de aire) y guías
#     horizontales con su cifra a la izquierda, sin eje Y;
#   - líneas de 1.5 y puntos huecos; el nombre de cada serie al final de su
#     línea, en su color, en lugar de leyenda;
#   - la regla ROBUSTA de cifras (Gonzalo, 2026-10-08: «este porcentaje se cubre
#     con la línea, debemos ser más robustos»): la serie más alta escribe encima
#     y la más baja debajo; si un tramo sale del punto hacia ese lado, la cifra
#     se corre al lado contrario del tramo; si los dos tramos van hacia ese lado
#     (un pico), pasa al otro lado salvo que la otra serie esté cerca, y en el
#     último punto la derecha queda para el nombre de la serie.

#' Ubica la cifra de cada punto lejos de los tramos de su propia línea
#'
#' @param d Tabla con `x` (índice del período), `v` (valor) y `g` (serie).
#' @param lim Límites del eje Y.
#' @return `d` con `vj`, `hj` y `dx` para `geom_text()`.
#' @keywords internal
.serie_recetario_ubicar <- function(d, lim) {
  series <- split(d$v, d$g)
  series <- series[vapply(series, function(s) any(is.finite(s)), logical(1))]
  arriba <- names(series)[which.max(vapply(series, function(s) mean(s, na.rm = TRUE), 0))]
  np_ <- max(d$x)
  rng <- diff(lim)
  d$vj <- -1.15; d$hj <- 0.5; d$dx <- 0
  for (i in seq_len(nrow(d))) {
    gi <- as.character(d$g[i]); xi <- d$x[i]; vi <- d$v[i]
    if (!is.finite(vi)) next
    sv <- d$v[d$g == gi][order(d$x[d$g == gi])]
    sgn <- if (identical(gi, arriba)) 1 else -1
    hacia <- function(j) j >= 1 && j <= np_ && is.finite(sv[j]) && sgn * (sv[j] - vi) > 0
    pr <- hacia(xi - 1); nx <- hacia(xi + 1)
    otra <- d$v[d$x == xi & as.character(d$g) != gi]
    cerca <- length(otra) && any(is.finite(otra) & -sgn * (otra - vi) > 0 & abs(otra - vi) < 0.14 * rng)
    if (pr && nx && !cerca) { sgn <- -sgn; pr <- hacia(xi - 1); nx <- hacia(xi + 1) }
    if (xi == np_ && pr && !nx && !cerca) { sgn <- -sgn; pr <- hacia(xi - 1) }
    d$vj[i] <- if (sgn > 0) -1.15 else 2.0
    if (nx && !pr) { d$hj[i] <- 1; d$dx[i] <- -0.1 } else if (pr && !nx) { d$hj[i] <- 0; d$dx[i] <- 0.1 } else if (pr && nx) d$vj[i] <- 0.5
  }
  d
}

#' Dibuja la serie temporal con el estilo del recetario
#'
#' @param df Tabla preparada por `graficar_serie_temporal()` (`.serie`,
#'   `.periodo` factor ordenado, `.y` en 0-100).
#' @keywords internal
.serie_recetario <- function(df, colores, decimales = 0L, mostrar_valores = TRUE, limite_y = NULL,
                             titulo = NULL, subtitulo = NULL, nota_pie = NULL,
                             textos_negrita = character(0), font_family = .std_pt("fuente"),
                             color_titulo = .std_color("azul"), size_titulo = 11,
                             color_subtitulo = .std_color("azul"), size_subtitulo = 9,
                             color_nota_pie = .std_color("azul"), size_nota_pie = 8) {
  cara <- function(token) if (token %in% textos_negrita) "bold" else "plain"
  periodos <- levels(df$.periodo)
  # Se conservan las columnas de la tabla preparada (`.serie`, `.periodo`, `.y`):
  # quien lea el gráfico las encuentra igual que en el estilo clásico.
  d <- df
  d$x <- as.integer(df$.periodo); d$v <- df$.y; d$g <- df$.serie
  paso <- 10
  lim <- suppressWarnings(as.numeric(limite_y))
  if (length(lim) != 2L || !all(is.finite(lim))) {
    lim <- c(max(0, floor((min(d$v, na.rm = TRUE) - 8) / paso) * paso),
             min(100, ceiling((max(d$v, na.rm = TRUE) + 8) / paso) * paso))
  }
  if (diff(lim) <= 0) lim <- c(0, 100)
  d <- .serie_recetario_ubicar(d, lim)
  d$.lab <- .pulso_fmt_pct_half_up(d$v, decimales, escala = 1)
  guias <- seq(lim[1], lim[2], paso)
  ultimo <- do.call(rbind, lapply(split(d, d$g), function(z) {
    z <- z[is.finite(z$v), , drop = FALSE]; if (!nrow(z)) NULL else z[which.max(z$x), , drop = FALSE]
  }))
  np_ <- length(periodos)
  # Margen derecho para el nombre de la serie más largo, que va tras el último punto.
  # El nombre de la serie no es una cifra: su capa no lleva `.lab`.
  if (!is.null(ultimo)) ultimo$.lab <- NULL
  # Nombres que terminan cerca se separan en vertical para no pisarse (en el
  # mazo de referencia, «Estados Financieros» caía sobre «Tributación»).
  if (!is.null(ultimo) && nrow(ultimo) > 1L) ultimo$y_nombre <- .serie_separar_nombres(ultimo$v, lim)
  else if (!is.null(ultimo)) ultimo$y_nombre <- ultimo$v
  # El eje se alarga lo que mide el nombre más largo, para que quepa dentro del
  # lienzo (el auditor de composición mide contra el rango del eje).
  largo_nombre <- max(nchar(as.character(ultimo$g %||% "")), 0)
  x_max <- np_ + 0.3 + largo_nombre * 0.075
  margen_der <- 16
  p <- ggplot2::ggplot(d, ggplot2::aes(x = .data$x, y = .data$v, colour = .data$g)) +
    ggplot2::geom_line(linewidth = 1.5, na.rm = TRUE) +
    ggplot2::geom_point(size = 3.6, shape = 21, fill = .std_color("fondo"), stroke = 1.5, na.rm = TRUE)
  if (isTRUE(mostrar_valores)) {
    p <- p + ggplot2::geom_text(
      data = d,
      ggplot2::aes(x = .data$x + .data$dx, label = .data$.lab, vjust = .data$vj, hjust = .data$hj),
      size = 12 / ggplot2::.pt, fontface = "bold", family = font_family, show.legend = FALSE, na.rm = TRUE
    )
  }
  if (!is.null(ultimo) && nrow(ultimo)) {
    p <- p + ggplot2::geom_text(
      data = ultimo, ggplot2::aes(x = np_ + 0.16, y = .data$y_nombre, label = .data$g), hjust = 0,
      size = 13 / ggplot2::.pt, fontface = "bold", family = font_family, show.legend = FALSE
    )
  }
  p +
    ggplot2::scale_colour_manual(values = colores) +
    ggplot2::scale_x_continuous(breaks = seq_len(np_), labels = periodos,
                                limits = c(0.45, x_max), expand = c(0, 0)) +
    ggplot2::scale_y_continuous(limits = lim, breaks = guias, labels = paste0(guias, "%"), expand = c(0, 0)) +
    ggplot2::coord_cartesian(clip = "off") +
    ggplot2::labs(title = titulo, subtitle = subtitulo, caption = nota_pie, x = NULL, y = NULL) +
    ggplot2::theme_minimal(base_family = font_family) +
    ggplot2::theme(
      legend.position = "none", panel.grid = ggplot2::element_blank(),
      panel.grid.major.y = ggplot2::element_line(colour = "#DCE1E8", linewidth = 0.35),
      axis.text.y = ggplot2::element_text(size = 10, colour = .std_color("texto_tenue")),
      axis.text.x = ggplot2::element_text(size = 13, colour = .std_color("azul"), face = "bold"),
      plot.title = ggplot2::element_text(colour = color_titulo, size = size_titulo, face = cara("titulo"), hjust = 0.5),
      plot.subtitle = ggplot2::element_text(colour = color_subtitulo, size = size_subtitulo, face = cara("subtitulo"), hjust = 0.5),
      plot.caption = ggplot2::element_text(colour = color_nota_pie, size = size_nota_pie, face = cara("nota_pie"), hjust = 1),
      plot.background = ggplot2::element_blank(), panel.background = ggplot2::element_blank(),
      plot.margin = ggplot2::margin(14, margen_der, 8, 8)
    )
}


#' Separa en vertical los nombres de serie al final de sus líneas
#'
#' Mantiene cada nombre lo más cerca posible de su punto y garantiza una
#' distancia mínima (7 % del eje) entre vecinos, sin salir del eje.
#' @keywords internal
.serie_separar_nombres <- function(v, lim, gap_frac = 0.07) {
  gap <- diff(lim) * gap_frac
  o <- order(v)
  y <- v[o]
  for (k in seq_along(y)[-1]) if (y[k] - y[k - 1] < gap) y[k] <- y[k - 1] + gap
  exceso <- max(0, y[length(y)] - lim[2])
  if (exceso > 0) {
    y[length(y)] <- y[length(y)] - exceso
    for (k in rev(seq_along(y))[-1]) if (y[k + 1] - y[k] < gap) y[k] <- y[k + 1] - gap
  }
  out <- numeric(length(v)); out[o] <- y
  out
}

