# =============================================================================
# graficador_barras_horizontales.R — categorías como en el recetario (ADR 0092, F2.2)
# =============================================================================
#
# El recetario dibuja SIEMPRE las preguntas categóricas como barras horizontales
# (`barras_h`, docs/qa/motor-ppt-2026-10-06/herramientas/recetario.R:182-207) y
# el motor las dibujaba como columnas verticales con una paleta arcoíris. Esta
# es la versión del recetario:
#
#   - rótulo a la izquierda, alineado a la derecha; barra; cifra en negrita a la
#     derecha de la barra, todo a 12 pt;
#   - escala = máximo × 1.12, para que la cifra quepa;
#   - las residuales («Otros», «No sabe», «Ninguna», «Prefiero no responder») al
#     final, sea cual sea el orden;
#   - con más de dos categorías y un máximo único, la mayor en azul y su rótulo
#     en negrita, las demás en el tono de apoyo (regla `categoria_mayor`);
#   - grosor de la tabla `categorias` por número de filas (`.std_grosor()`), con
#     un paso de fila de 0.6 in como en el recetario y el bloque arriba: sobra
#     aire al pie antes que estirar las filas.
#
# La geometría se resuelve en pulgadas sobre el alto y el ancho con que se va a
# colocar el gráfico: el panel ocupa todo el lienzo (sin márgenes de ggplot) y
# los rótulos y las cifras viven dentro del rango de datos, así que una pulgada
# de la lámina es una cantidad conocida de unidades de datos.

.BARRAS_H_PASO_FILA_IN <- 0.6
.BARRAS_H_PT <- 12
.BARRAS_H_RESIDUAL <- "^(otro|otros|otras|no sabe|ninguna|ninguno|prefiero no)"

#' La paleta de categorías es propia del proyecto si nombra categorías reales
#'
#' El preset de fábrica trae diez colores con claves genéricas (`Categoria_1`…)
#' que se aplican por posición y pintan un arcoíris; eso no es una decisión del
#' proyecto y el estándar lo reemplaza por el realce.
#' @keywords internal
.barras_h_paleta_propia <- function(colores_categorias, paleta_colores, categorias) {
  nombres <- c(names(colores_categorias), names(paleta_colores))
  length(nombres) > 0L && any(nombres %in% categorias)
}

#' Ancho del rótulo en pulgadas, estimado como en el recetario
#' @keywords internal
.barras_h_ancho_txt <- function(s, size = .BARRAS_H_PT, bold = FALSE) {
  nchar(s) * size * (if (bold) 0.56 else 0.52) / 72
}

#' Dibuja las categorías en barras horizontales del recetario
#'
#' @param df Tabla preparada por `graficar_barras_categoricas()` (columnas
#'   `categoria`, `valor`, `label`, `fill`), ya en el orden pedido.
#' @param paleta_propia `TRUE` si el proyecto declaró colores para estas
#'   categorías; entonces se respetan y no hay realce.
#' @param ancho,alto Tamaño con que se coloca el gráfico, en pulgadas.
#' @return Objeto `ggplot` con el atributo `pulso_barras_horizontales_layout`.
#' @keywords internal
.graficar_categoricas_horizontal <- function(df, paleta_propia = FALSE, ancho = 10, alto = 6,
                                             font_family = .std_pt("fuente"), nota = NULL,
                                             color_fondo = NA, titulo = NULL, subtitulo = NULL,
                                             textos_negrita = c("titulo", "valores"),
                                             color_titulo = .std_color("coral"),
                                             color_subtitulo = .std_color("azul"),
                                             size_titulo = 16, size_subtitulo = 12) {
  ancho <- suppressWarnings(as.numeric(ancho)[1]); if (!is.finite(ancho) || ancho <= 0) ancho <- 10
  alto <- suppressWarnings(as.numeric(alto)[1]); if (!is.finite(alto) || alto <= 0) alto <- 6
  df <- df[is.finite(df$valor) & df$valor > 0, , drop = FALSE]
  if (!nrow(df)) stop("No hay categorias con valor para graficar.", call. = FALSE)

  resid <- grepl(.BARRAS_H_RESIDUAL, tolower(trimws(df$categoria)))
  if (any(resid) && !all(resid)) df <- df[c(which(!resid), which(resid)), , drop = FALSE]
  n <- nrow(df)

  realce <- !isTRUE(paleta_propia) && n > 2L && sum(df$valor == max(df$valor)) == 1L
  es_max <- realce & df$valor == max(df$valor)
  cats <- .std_paleta("categorias")
  df$fill <- if (isTRUE(paleta_propia)) df$fill else ifelse(es_max | !realce, cats$mayor, cats$resto)
  df$face <- ifelse(es_max, "bold", "plain")

  # Geometría en pulgadas. Título, subtítulo y nota se descuentan del alto para
  # que la fila física siga siendo la que se calcula.
  hay <- function(x) !is.null(x) && length(x) && !is.na(x[1]) && nzchar(paste(x, collapse = ""))
  alto_nota <- if (hay(nota)) 0.32 else 0
  alto_tit <- (if (hay(titulo)) size_titulo * 1.5 / 72 else 0) + (if (hay(subtitulo)) size_subtitulo * 1.5 / 72 else 0)
  alto_panel <- alto - alto_nota - alto_tit - 0.05
  cara <- function(parte) if (parte %in% textos_negrita) "bold" else "plain"
  paso <- min(.BARRAS_H_PASO_FILA_IN, alto_panel / n)
  filas_virtuales <- max(n, alto_panel / paso)
  g_in <- .std_grosor(n, "categorias")
  fraccion <- min(.GROSOR_TOPE_FRACCION, g_in / paso)

  wlab <- min(max(.barras_h_ancho_txt(df$categoria, bold = TRUE)), 0.32 * ancho)
  wlab <- max(wlab, 0.6)
  car_linea <- max(8L, floor(wlab / (.BARRAS_H_PT * 0.52 / 72)))
  df$rotulo <- vapply(df$categoria, function(s) paste(strwrap(s, car_linea), collapse = "\n"), "")
  wbar <- max(1, ancho - wlab - 0.12 - 0.8)
  escala <- max(df$valor) * 1.12
  k <- escala / wbar  # unidades de datos por pulgada

  df$y <- filas_virtuales - seq_len(n) + 1  # la primera categoría arriba
  mm <- .BARRAS_H_PT / ggplot2::.pt

  p <- ggplot2::ggplot(df, ggplot2::aes(y = .data$y)) +
    ggplot2::geom_col(ggplot2::aes(x = .data$valor, fill = .data$categoria),
                      width = fraccion, orientation = "y", color = NA) +
    ggplot2::geom_text(ggplot2::aes(x = -0.12 * k, label = .data$rotulo, fontface = .data$face),
                       hjust = 1, vjust = 0.5, size = mm, lineheight = 0.9,
                       colour = .std_color("azul"), family = font_family) +
    ggplot2::geom_text(ggplot2::aes(x = .data$valor + 0.04 * k, label = .data$label),
                       hjust = 0, vjust = 0.5, size = mm, fontface = cara("valores"),
                       colour = .std_color("azul"), family = font_family) +
    ggplot2::scale_fill_manual(values = stats::setNames(df$fill, df$categoria), guide = "none") +
    ggplot2::scale_x_continuous(limits = c(-(wlab + 0.12) * k, escala + 0.8 * k), expand = c(0, 0)) +
    ggplot2::scale_y_continuous(limits = c(0.5, filas_virtuales + 0.5), expand = c(0, 0)) +
    ggplot2::labs(title = if (hay(titulo)) titulo else NULL, subtitle = if (hay(subtitulo)) subtitulo else NULL,
                  caption = if (alto_nota > 0) nota else NULL) +
    ggplot2::theme_void(base_family = font_family) +
    ggplot2::theme(
      plot.background = ggplot2::element_rect(fill = color_fondo, color = NA),
      plot.title = ggplot2::element_text(colour = color_titulo, size = size_titulo, face = cara("titulo"), hjust = 0.5),
      plot.subtitle = ggplot2::element_text(colour = color_subtitulo, size = size_subtitulo, face = cara("subtitulo"), hjust = 0.5),
      plot.caption = ggplot2::element_text(colour = .std_color("azul"), size = .std_pt("base"), face = cara("nota_pie"), hjust = 1),
      plot.margin = ggplot2::margin(0, 0, 0, 0)
    )

  attr(p, "pulso_barras_horizontales_layout") <- list(
    n_categorias = n, paso_in = paso, fraccion = fraccion, grosor_in = fraccion * paso,
    ancho_rotulo_in = wlab, realce = realce, orden = df$categoria
  )
  p
}
