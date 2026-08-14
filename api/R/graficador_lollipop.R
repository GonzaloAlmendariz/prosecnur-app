# Lollipop: ranking de muchas categorias
# ======================================
#
# PROBLEMA. Una pregunta de respuesta multiple con quince opciones se graficaba
# con barras horizontales: quince rectangulos gruesos que llenan la lamina de
# tinta y donde el ojo termina comparando areas en vez de longitudes. Las barras
# categoricas ademas declaran un maximo de diez, asi que el caso quedaba fuera
# de su limite y caia en agrupadas, que no es lo que la lamina quiere decir.
#
# DISEÑO. Un tallo fino y un punto en la punta. La misma informacion —la
# posicion del punto ES el valor— con una fraccion de la tinta, asi que quince o
# veinte categorias siguen siendo legibles. Es la forma canonica del ranking.
#
# ORDENADO POR VALOR DE FABRICA. Un lollipop existe para responder "cual es el
# mas mencionado": dejarlo en el orden del instrumento obliga a recorrerlo entero
# para contestar eso. Se puede volver al orden declarado cuando la escala tiene
# un sentido propio.

#' Ranking tipo lollipop
#'
#' @param data Data frame con una fila por categoría.
#' @param var_categoria Columna con la etiqueta de la categoría.
#' @param var_valor Columna con el valor.
#' @param top_n Conserva sólo las primeras N tras ordenar. `NULL` = todas.
#' @param orden `mayor_menor`, `menor_mayor` o `declarado`.
#' @param resaltar Categorías que se dibujan con el color de énfasis. Sirve para
#'   señalar la que la lámina viene a comentar sin cambiar el resto.
#'
#' @family graficador
#' @export
graficar_lollipop <- function(
    data,
    var_categoria,
    var_valor,
    var_n = NULL,
    escala_valor = c("proporcion_100", "proporcion_1"),
    orden = c("mayor_menor", "menor_mayor", "declarado"),
    top_n = NULL,

    titulo = NULL,
    subtitulo = NULL,
    nota_pie = NULL,

    mostrar_valores = TRUE,
    valores_decimales = 0L,
    resaltar = NULL,

    color_punto = "#0B4F8C",
    color_resalte = "#E76F51",
    color_tallo = "#C7D2E0",
    size_punto = 3.6,
    size_tallo = 0.9,

    color_ejes = .PULSO_COLOR_EJES,
    size_ejes = 9,
    size_valores = 3.0,
    limite_x = NULL,

    color_titulo = .PULSO_COLOR_TEXTO,
    size_titulo = 11,
    color_subtitulo = .PULSO_COLOR_TEXTO,
    size_subtitulo = 9,
    color_nota_pie = .PULSO_COLOR_TEXTO,
    size_nota_pie = 8,
    textos_negrita = NULL,
    font_family = "Arial"
) {
  escala_valor <- match.arg(escala_valor)
  orden <- match.arg(orden)
  face <- .graficos_face_de(textos_negrita)

  if (!is.data.frame(data) || !nrow(data)) {
    stop("`data` debe ser un data frame con al menos una fila.", call. = FALSE)
  }
  for (col in c(var_categoria, var_valor)) {
    if (!col %in% names(data)) {
      stop("La columna `", col, "` no existe en `data`.", call. = FALSE)
    }
  }

  df <- data.frame(
    .cat = as.character(data[[var_categoria]]),
    .valor = suppressWarnings(as.numeric(data[[var_valor]])),
    stringsAsFactors = FALSE
  )
  df <- df[!is.na(df$.cat) & nzchar(trimws(df$.cat)), , drop = FALSE]
  df <- df[is.finite(df$.valor), , drop = FALSE]
  if (!nrow(df)) stop("No quedan categorias con valor utilizable.", call. = FALSE)
  if (identical(escala_valor, "proporcion_1")) df$.valor <- df$.valor * 100

  df <- switch(
    orden,
    mayor_menor = df[order(-df$.valor), , drop = FALSE],
    menor_mayor = df[order(df$.valor), , drop = FALSE],
    df
  )

  total_categorias <- nrow(df)
  k <- suppressWarnings(as.integer(top_n)[1])
  # El recorte se anota para que el pie pueda decirlo: una lamina que muestra 10
  # de 22 opciones sin avisar deja creer que esas son todas.
  recortadas <- 0L
  if (is.finite(k) && k > 0 && k < nrow(df)) {
    recortadas <- nrow(df) - k
    df <- df[seq_len(k), , drop = FALSE]
  }
  if (recortadas > 0L) {
    nota_recorte <- sprintf(
      "Se muestran %s de %s categorías.",
      nrow(df),
      total_categorias
    )
    nota_existente <- as.character(nota_pie %||% "")[1]
    nota_pie <- if (!is.na(nota_existente) && nzchar(trimws(nota_existente))) {
      paste(nota_existente, nota_recorte, sep = "\n")
    } else {
      nota_recorte
    }
  }

  # El eje Y se dibuja de abajo hacia arriba, asi que el orden se invierte para
  # que el mayor quede arriba.
  df$.cat <- factor(df$.cat, levels = rev(df$.cat))
  df$.destacada <- df$.cat %in% as.character(resaltar %||% character(0))

  tope <- suppressWarnings(as.numeric(limite_x)[1])
  if (!is.finite(tope)) tope <- max(df$.valor, na.rm = TRUE) * 1.15
  if (!is.finite(tope) || tope <= 0) tope <- 100

  p <- ggplot2::ggplot(df, ggplot2::aes(x = .data$.valor, y = .data$.cat)) +
    ggplot2::geom_segment(
      ggplot2::aes(x = 0, xend = .data$.valor, y = .data$.cat, yend = .data$.cat),
      colour = color_tallo, linewidth = size_tallo, lineend = "round"
    ) +
    ggplot2::geom_point(
      ggplot2::aes(colour = .data$.destacada), size = size_punto, show.legend = FALSE
    ) +
    ggplot2::scale_colour_manual(
      values = c("FALSE" = color_punto, "TRUE" = color_resalte),
      breaks = c("FALSE", "TRUE")
    )

  if (isTRUE(mostrar_valores)) {
    dec <- suppressWarnings(as.integer(valores_decimales)[1])
    if (!is.finite(dec) || dec < 0) dec <- 0L
    # Regla de la casa: el 0,5 sube. `round()` redondea al par.
    df$.lab <- .pulso_fmt_pct_half_up(df$.valor, dec, escala = 1)
    p <- p + ggplot2::geom_text(
      data = df, ggplot2::aes(label = .data$.lab),
      hjust = -0.35, size = size_valores, colour = color_ejes,
      family = font_family, fontface = face("valores")
    )
  }

  out <- p +
    ggplot2::scale_x_continuous(
      limits = c(0, tope),
      labels = function(x) paste0(.pulso_fmt_half_up(x, 0), "%")
    ) +
    ggplot2::labs(title = titulo, subtitle = subtitulo, caption = nota_pie, x = NULL, y = NULL) +
    ggplot2::theme_minimal(base_family = font_family) +
    ggplot2::theme(
      plot.title = ggplot2::element_text(colour = color_titulo, size = size_titulo,
                                         family = font_family, face = face("titulo"), hjust = 0.5),
      plot.subtitle = ggplot2::element_text(colour = color_subtitulo, size = size_subtitulo,
                                            family = font_family, face = face("subtitulo"), hjust = 0.5),
      plot.caption = ggplot2::element_text(colour = color_nota_pie, size = size_nota_pie,
                                           family = font_family, face = face("nota_pie"), hjust = 1),
      axis.text = ggplot2::element_text(colour = color_ejes, size = size_ejes,
                                        family = font_family, face = face("ejes")),
      panel.grid.minor = ggplot2::element_blank(),
      panel.grid.major.y = ggplot2::element_blank(),
      panel.grid.major.x = ggplot2::element_line(colour = .PULSO_COLOR_GRID, linewidth = 0.3),
      plot.margin = ggplot2::margin(10, 16, 8, 12)
    )

  attr(out, "pulso_lollipop_recortadas") <- recortadas
  out
}
