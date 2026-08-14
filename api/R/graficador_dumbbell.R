# Dumbbell: la brecha entre dos bases
# ===================================
#
# PROBLEMA. Comparar dos publicos —o dos olas— tema por tema se hacia con
# barras agrupadas: dos barras por tema, y la brecha quedaba implicita en la
# diferencia de dos longitudes que arrancan del mismo cero. El ojo compara mal
# longitudes separadas, y con ocho temas la lamina es un bosque de barras donde
# lo que el estudio viene a decir —donde esta la brecha grande— no salta.
#
# DISEÑO. Un punto por base y un segmento que los une. La brecha ES el segmento:
# se ve larga o corta sin restar nada. Ordenando por brecha, la lamina se lee de
# arriba hacia abajo como un ranking de diferencias, que suele ser la pregunta.
#
# Consume el MISMO df tidy `(eje, grupo, valor, n)` del motor multibase que ya
# alimentan el radar comparativo y la serie temporal. Tercera lectura de los
# mismos numeros: forma (radar), evolucion (serie) y brecha (dumbbell), sin
# declarar nada nuevo.
#
# EXIGE EXACTAMENTE DOS GRUPOS. Con tres, el "segmento" ya no es una brecha sino
# un rango, y esa es otra afirmacion; el motor lo dice en vez de dibujar algo
# ambiguo.

#' Gráfico de brecha (dumbbell) entre dos bases
#'
#' @param data Data frame tidy con una fila por (tema, base).
#' @param var_eje Columna con el tema (una fila del gráfico).
#' @param var_grupo Columna con la base (debe tener exactamente dos valores).
#' @param var_valor Columna con el valor.
#' @param umbral_brecha_pct Solo se rotulan las brechas de al menos este tamano,
#'   en puntos porcentuales. El sufijo `_pct` evita que el patch de UI lo acote
#'   a la escala 0-1 de las apiladas.
#' @param orden `brecha` ordena por tamaño de la diferencia —la lectura de
#'   ranking—; `valor` por el valor del primer grupo; `declarado` respeta el
#'   orden de entrada.
#'
#' @family graficador
#' @export
graficar_dumbbell <- function(
    data,
    var_eje = "eje",
    var_grupo = "grupo",
    var_valor = "valor",
    escala_valor = c("proporcion_100", "proporcion_1"),
    orden = c("brecha", "valor", "declarado"),

    titulo = NULL,
    subtitulo = NULL,
    nota_pie = NULL,

    mostrar_valores = TRUE,
    valores_decimales = 0L,
    mostrar_brecha = TRUE,
    etiqueta_brecha = "pp",
    umbral_brecha_pct = 0,

    colores_grupos = NULL,
    color_segmento = "#C7D2E0",
    size_segmento = 1.6,
    size_punto = 3.6,
    mostrar_leyenda = TRUE,
    leyenda_posicion = c("abajo", "arriba", "derecha", "izquierda", "ninguna"),

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
  leyenda_posicion <- match.arg(leyenda_posicion)
  face <- .graficos_face_de(textos_negrita)

  if (!is.data.frame(data) || !nrow(data)) {
    stop("`data` debe ser un data frame con al menos una fila.", call. = FALSE)
  }
  for (col in c(var_eje, var_grupo, var_valor)) {
    if (!col %in% names(data)) {
      stop("La columna `", col, "` no existe en `data`.", call. = FALSE)
    }
  }

  df <- data.frame(
    .eje = as.character(data[[var_eje]]),
    .grupo = as.character(data[[var_grupo]]),
    .valor = suppressWarnings(as.numeric(data[[var_valor]])),
    stringsAsFactors = FALSE
  )
  df <- df[!is.na(df$.eje) & nzchar(trimws(df$.eje)), , drop = FALSE]
  if (identical(escala_valor, "proporcion_1")) df$.valor <- df$.valor * 100

  niveles_grupo <- if (is.factor(data[[var_grupo]])) {
    intersect(levels(data[[var_grupo]]), unique(df$.grupo))
  } else {
    unique(df$.grupo)
  }
  if (length(niveles_grupo) != 2L) {
    stop(
      "El dumbbell compara exactamente dos bases y llegaron ",
      length(niveles_grupo),
      ". Con tres o mas el segmento deja de ser una brecha y pasa a ser un rango.",
      call. = FALSE
    )
  }

  a <- niveles_grupo[[1]]; b <- niveles_grupo[[2]]
  va <- stats::setNames(df$.valor[df$.grupo == a], df$.eje[df$.grupo == a])
  vb <- stats::setNames(df$.valor[df$.grupo == b], df$.eje[df$.grupo == b])
  ejes <- intersect(names(va), names(vb))
  if (!length(ejes)) {
    stop("Ningun tema tiene valor en las dos bases: no hay brecha que dibujar.", call. = FALSE)
  }

  res <- data.frame(
    .eje = ejes,
    .a = unname(va[ejes]),
    .b = unname(vb[ejes]),
    stringsAsFactors = FALSE
  )
  res$.brecha <- res$.b - res$.a

  orden_ejes <- switch(
    orden,
    brecha = res$.eje[order(abs(res$.brecha))],
    valor  = res$.eje[order(res$.a)],
    res$.eje
  )
  if (identical(orden, "declarado")) orden_ejes <- rev(ejes)
  res$.eje <- factor(res$.eje, levels = orden_ejes)

  largo <- data.frame(
    .eje = rep(res$.eje, 2),
    .grupo = factor(rep(c(a, b), each = nrow(res)), levels = niveles_grupo),
    .valor = c(res$.a, res$.b),
    stringsAsFactors = FALSE
  )

  colores <- .graficos_mk_palette(niveles_grupo, pal_user = colores_grupos)

  tope <- suppressWarnings(as.numeric(limite_x)[1])
  if (!is.finite(tope)) tope <- max(largo$.valor, na.rm = TRUE) * 1.18
  if (!is.finite(tope) || tope <= 0) tope <- 100

  p <- ggplot2::ggplot() +
    ggplot2::geom_segment(
      data = res,
      ggplot2::aes(x = .data$.a, xend = .data$.b, y = .data$.eje, yend = .data$.eje),
      colour = color_segmento, linewidth = size_segmento, lineend = "round"
    ) +
    ggplot2::geom_point(
      data = largo,
      ggplot2::aes(x = .data$.valor, y = .data$.eje, colour = .data$.grupo),
      size = size_punto
    )

  if (isTRUE(mostrar_valores)) {
    dec <- suppressWarnings(as.integer(valores_decimales)[1])
    if (!is.finite(dec) || dec < 0) dec <- 0L
    lab <- largo
    # Regla de la casa: el 0,5 sube. `round()` redondea al par.
    lab$.lab <- .pulso_fmt_pct_half_up(lab$.valor, dec, escala = 1)
    # La cifra se aparta hacia el lado por el que ese punto es extremo, para que
    # no caiga sobre el segmento ni sobre el otro punto.
    ancla <- merge(lab, res[, c(".eje", ".a", ".b")], by = ".eje", all.x = TRUE)
    ancla$.izq <- ancla$.valor <= pmin(ancla$.a, ancla$.b)
    p <- p + ggplot2::geom_text(
      data = ancla,
      ggplot2::aes(x = .data$.valor, y = .data$.eje, label = .data$.lab,
                   hjust = ifelse(.data$.izq, 1.35, -0.35)),
      size = size_valores, colour = color_ejes,
      family = font_family, fontface = face("valores"), show.legend = FALSE
    )
  }

  if (isTRUE(mostrar_brecha)) {
    br <- res[abs(res$.brecha) >= umbral_brecha_pct, , drop = FALSE]
    if (nrow(br)) {
      br$.lab <- paste0(
        ifelse(br$.brecha > 0, "+", ""),
        .pulso_fmt_half_up(br$.brecha, 0), " ", etiqueta_brecha
      )
      p <- p + ggplot2::geom_text(
        data = br,
        ggplot2::aes(x = tope * 0.99, y = .data$.eje, label = .data$.lab),
        hjust = 1, size = size_valores, colour = color_ejes,
        family = font_family, fontface = "bold", show.legend = FALSE
      )
    }
  }

  p +
    ggplot2::scale_colour_manual(values = colores, breaks = niveles_grupo) +
    ggplot2::scale_x_continuous(
      limits = c(0, tope),
      labels = function(x) paste0(.pulso_fmt_half_up(x, 0), "%")
    ) +
    ggplot2::labs(
      title = titulo, subtitle = subtitulo, caption = nota_pie,
      x = NULL, y = NULL, colour = NULL
    ) +
    ggplot2::theme_minimal(base_family = font_family) +
    ggplot2::theme(
      legend.position = if (identical(leyenda_posicion, "ninguna") || !isTRUE(mostrar_leyenda)) {
        "none"
      } else if (identical(leyenda_posicion, "abajo")) "bottom"
      else if (identical(leyenda_posicion, "arriba")) "top"
      else leyenda_posicion,
      legend.title = ggplot2::element_blank(),
      legend.text = ggplot2::element_text(colour = color_ejes, size = size_ejes,
                                          family = font_family, face = face("leyenda")),
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
}
