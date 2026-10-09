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
                                             size_titulo = 16, size_subtitulo = 12,
                                             size_pt = .BARRAS_H_PT) {
  size_pt <- suppressWarnings(as.numeric(size_pt)[1]); if (!is.finite(size_pt) || size_pt <= 0) size_pt <- .BARRAS_H_PT
  ancho <- suppressWarnings(as.numeric(ancho)[1]); if (!is.finite(ancho) || ancho <= 0) ancho <- 10
  alto <- suppressWarnings(as.numeric(alto)[1]); if (!is.finite(alto) || alto <= 0) alto <- 6
  # Las categorías en 0 % se dibujan si llegan: mostrarlas o no lo decide quien
  # arma la tabla (mostrar_ceros), no el graficador.
  df <- df[is.finite(df$valor), , drop = FALSE]
  if (!nrow(df)) stop("No hay categorias con valor para graficar.", call. = FALSE)

  # Dos categorías sin paleta propia: dicotomía partida del recetario (barras_h
  # deriva a `dicotomia()` en el estilo moderno, recetario.R:187-189).
  # Sólo si las dos cifras suman 100 %: con opción múltiple o filtros la barra
  # partida contradiría a sus cifras.
  suma_pct <- suppressWarnings(sum(as.numeric(df$pct %||% NA_real_)))
  if (nrow(df) == 2L && !isTRUE(paleta_propia) && is.finite(suma_pct) && abs(suma_pct - 1) < 0.02) {
    return(.graficar_dicotomia_partida(df, ancho = ancho, alto = alto, font_family = font_family,
                                       nota = nota, color_fondo = color_fondo, titulo = titulo,
                                       subtitulo = subtitulo, textos_negrita = textos_negrita,
                                       color_titulo = color_titulo, color_subtitulo = color_subtitulo,
                                       size_titulo = size_titulo, size_subtitulo = size_subtitulo,
                                       escala_texto = size_pt / .BARRAS_H_PT))
  }

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

  wlab <- min(max(.barras_h_ancho_txt(df$categoria, size = size_pt, bold = TRUE)), 0.32 * ancho)
  wlab <- max(wlab, 0.6)
  car_linea <- max(8L, floor(wlab / (size_pt * 0.52 / 72)))
  df$rotulo <- vapply(df$categoria, function(s) paste(strwrap(s, car_linea), collapse = "\n"), "")
  wbar <- max(1, ancho - wlab - 0.12 - 0.8)
  escala <- max(df$valor) * 1.12
  k <- escala / wbar  # unidades de datos por pulgada

  df$y <- filas_virtuales - seq_len(n) + 1  # la primera categoría arriba
  mm <- size_pt / ggplot2::.pt

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


#' Dicotomía partida del recetario: cifra grande en cada extremo y la barra debajo
#'
#' Sigue a `dicotomia()` (recetario_piezas.R:38-49): cifras a 19 pt en negrita
#' (22 × 0.85, C14 y C19), la primera en azul a la izquierda y la segunda en el
#' azul medio a la derecha; rótulos a 10.5 pt debajo de cada cifra; una barra de
#' 0.34 in partida en el azul y el celeste de la paleta dicotómica.
#' @keywords internal
.graficar_dicotomia_partida <- function(df, ancho = 10, alto = 6, font_family = .std_pt("fuente"),
                                        nota = NULL, color_fondo = NA, titulo = NULL, subtitulo = NULL,
                                        textos_negrita = c("titulo", "valores"),
                                        color_titulo = .std_color("coral"), color_subtitulo = .std_color("azul"),
                                        size_titulo = 16, size_subtitulo = 12, escala_texto = 1) {
  hay <- function(x) !is.null(x) && length(x) && !is.na(x[1]) && nzchar(paste(x, collapse = ""))
  cara <- function(parte) if (parte %in% textos_negrita) "bold" else "plain"
  pt <- function(x) x / ggplot2::.pt
  cols <- .std_paleta("dicotomica")
  azul_medio <- .std_color("azul_medio")
  size_cifra <- round(22 * 0.85 * escala_texto)
  g <- 0.34
  w <- max(2, ancho - 0.8)
  p1 <- df$valor[1] / sum(df$valor)
  alto_tit <- (if (hay(titulo)) size_titulo * 1.5 / 72 else 0) + (if (hay(subtitulo)) size_subtitulo * 1.5 / 72 else 0)
  alto_nota <- if (hay(nota)) 0.32 else 0
  alto <- alto - alto_tit - alto_nota      # el panel es lo que queda bajo el título
  y0 <- alto - 0.1                       # el bloque va arriba, como en la lámina
  y_cifra <- y0 - size_cifra * 0.65 / 72
  y_rot <- y0 - size_cifra * 1.25 / 72 - 0.13
  yb1 <- y0 - size_cifra * 1.25 / 72 - 0.32
  yb0 <- yb1 - g
  # El ggplot conserva la tabla aunque dibuje con `annotate()`: quien lea la
  # lámina (tests, verificador) encuentra sus categorías en `p$data`.
  p <- ggplot2::ggplot(df) +
    ggplot2::annotate("rect", xmin = 0, xmax = w * p1, ymin = yb0, ymax = yb1, fill = cols[1], colour = NA) +
    ggplot2::annotate("rect", xmin = w * p1, xmax = w, ymin = yb0, ymax = yb1, fill = cols[2], colour = NA) +
    ggplot2::annotate("text", x = 0, y = y_cifra, label = df$label[1], hjust = 0, size = pt(size_cifra),
                      fontface = "bold", colour = .std_color("azul"), family = font_family) +
    ggplot2::annotate("text", x = w, y = y_cifra, label = df$label[2], hjust = 1, size = pt(size_cifra),
                      fontface = "bold", colour = azul_medio, family = font_family) +
    ggplot2::annotate("text", x = 0, y = y_rot, label = df$categoria[1], hjust = 0, size = pt(10.5 * escala_texto),
                      colour = .std_color("azul"), family = font_family) +
    ggplot2::annotate("text", x = w, y = y_rot, label = df$categoria[2], hjust = 1, size = pt(10.5 * escala_texto),
                      colour = .std_color("azul"), family = font_family) +
    ggplot2::scale_x_continuous(limits = c(0, ancho), expand = c(0, 0)) +
    ggplot2::scale_y_continuous(limits = c(0, alto), expand = c(0, 0)) +
    ggplot2::labs(title = if (hay(titulo)) titulo else NULL, subtitle = if (hay(subtitulo)) subtitulo else NULL,
                  caption = if (hay(nota)) nota else NULL) +
    ggplot2::theme_void(base_family = font_family) +
    ggplot2::theme(plot.background = ggplot2::element_rect(fill = color_fondo, color = NA),
                   plot.title = ggplot2::element_text(colour = color_titulo, size = size_titulo, face = cara("titulo"), hjust = 0.5),
                   plot.subtitle = ggplot2::element_text(colour = color_subtitulo, size = size_subtitulo, face = cara("subtitulo"), hjust = 0.5),
                   plot.caption = ggplot2::element_text(colour = .std_color("azul"), size = .std_pt("base"), face = cara("nota_pie"), hjust = 1),
                   plot.margin = ggplot2::margin(0, 0, 0, 0))
  attr(p, "pulso_barras_horizontales_layout") <- list(
    n_categorias = 2L, dicotomia = TRUE, grosor_in = g, size_cifra = size_cifra, orden = df$categoria,
    realce = FALSE
  )
  p
}

