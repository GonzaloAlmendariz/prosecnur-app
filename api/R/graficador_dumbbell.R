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
#
# RECETARIO (ADR 0092, F2.7a; recetario_m3c.R:29-41). El eje se acerca al rango
# de los datos (antes 0 a 120 %, con los puntos aplastados contra la derecha),
# los puntos miden ~0.26 in y la cifra de cada uno va a su costado exterior en
# el color de su base. La diferencia vive en su propia columna, con encabezado
# «Diferencia», en puntos y en azul neutro: «+12 pts».

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
    etiqueta_brecha = "pts",
    encabezado_brecha = "Diferencia",
    umbral_brecha_pct = 0,
    var_n = "n",
    titulo_eje = NULL,

    colores_grupos = NULL,
    color_segmento = "#C7D2E0",
    size_segmento = 1.4,
    size_punto = 6.2,
    mostrar_leyenda = TRUE,
    leyenda_posicion = c("abajo", "arriba", "derecha", "izquierda", "ninguna"),

    color_ejes = .PULSO_COLOR_EJES,
    size_ejes = .std_pt("leyenda"),
    size_valores = .std_pt("cifra_fuera") / ggplot2::.pt,
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
  # Segunda base menos primera: la primera es la referencia (regla del motor,
  # test-graficos-ola4-metodologia.R), y en antes/después da el cambio. Entre
  # dos públicos el signo es convención —el recetario la escribe en azul neutro,
  # «no es mejor ni peor»— y el orden de las bases lo decide el analista.
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

  colores <- .graficos_mk_palette(niveles_grupo, pal_user = colores_grupos %||% unname(.std_paleta("actores"))[1:2])

  # Eje acercado al rango de los datos, en múltiplos de 5, sin pasar de 0 ni 100.
  lim <- suppressWarnings(as.numeric(limite_x))
  if (length(lim) == 2L && all(is.finite(lim))) {
    lo <- lim[1]; hi <- lim[2]
  } else {
    vmin <- min(largo$.valor, na.rm = TRUE); vmax <- max(largo$.valor, na.rm = TRUE)
    lo <- max(0, floor((vmin - 3) / 5) * 5)
    hi <- min(100, ceiling((vmax + 3) / 5) * 5)
    if (length(lim) == 1L && is.finite(lim)) hi <- lim
    if (!is.finite(lo) || !is.finite(hi) || hi <= lo) { lo <- 0; hi <- 100 }
  }
  paso <- if (hi - lo <= 30) 5 else if (hi - lo <= 60) 10 else 20
  # La columna «Diferencia» va a la derecha del eje, fuera de sus marcas.
  x_dif <- hi + (hi - lo) * 0.16
  tope <- hi + (hi - lo) * 0.24

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
                   hjust = ifelse(.data$.izq, 1.45, -0.45), colour = .data$.grupo),
      size = size_valores,
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
        ggplot2::aes(x = x_dif, y = .data$.eje, label = .data$.lab),
        hjust = 0.5, size = 13 / ggplot2::.pt, colour = .std_color("azul"),
        family = font_family, fontface = "bold", show.legend = FALSE
      )
    }
    if (!is.null(encabezado_brecha) && nzchar(encabezado_brecha)) {
      p <- p + ggplot2::annotate(
        "text", x = x_dif, y = nrow(res) + 0.75, label = encabezado_brecha, hjust = 0.5,
        size = 10 / ggplot2::.pt, colour = .std_color("texto_suave"), fontface = "bold", family = font_family
      )
    }
  }

  # Leyenda con la base de cada grupo, «Docentes (52)», si viene la columna.
  n_g <- rep(NA_real_, length(niveles_grupo))
  # Sólo si la base del grupo es la misma en todas las filas (dos públicos comparados tema por tema, lámina 86);
  # si cambia de fila en fila, las filas son públicos y su base va en cada fila (lámina 85), no en la leyenda.
  etiquetas_leyenda <- niveles_grupo
  if (!is.null(var_n) && var_n %in% names(data)) {
    n_g <- vapply(niveles_grupo, function(g) {
      v <- suppressWarnings(as.numeric(data[[var_n]][as.character(data[[var_grupo]]) == g]))
      v <- unique(v[is.finite(v)])
      if (length(v) == 1L) v else NA_real_
    }, numeric(1))
    etiquetas_leyenda <- ifelse(is.finite(n_g), sprintf("%s (%s)", niveles_grupo, format(n_g, big.mark = ",", trim = TRUE)), niveles_grupo)
  }

  # ADR 0093 (N4): lo que afirman las pesas para la lámina nativa (láminas 85 y 86, recetario_m3c.R). Como el
  # recetario, la diferencia es el primer grupo menos el segundo («+5 pts» si el primero está más arriba) y, con
  # orden por brecha, las filas van de la diferencia mayor a la menor con su signo.
  espec_pesas <- tryCatch({
    dec_p <- suppressWarnings(as.integer(valores_decimales)[1]); if (!is.finite(dec_p) || dec_p < 0) dec_p <- 0L
    # La diferencia se resta entre las cifras que se leen (20 % y 18 % dan +2, no +3), como la serie de dos.
    r2 <- res; r2$.eje <- as.character(r2$.eje)
    r2$.dif <- .pulso_round_half_up(r2$.a, dec_p) - .pulso_round_half_up(r2$.b, dec_p)
    r2 <- switch(orden, brecha = r2[order(-r2$.dif), , drop = FALSE], valor = r2[order(-r2$.a), , drop = FALSE],
                 r2[match(ejes, r2$.eje), , drop = FALSE])
    # Los casos van en la fila cuando son los mismos para los dos grupos de esa fila (la fila es un público) y no
    # están ya en la leyenda.
    n_fila <- if (!is.null(var_n) && var_n %in% names(data) && !any(is.finite(n_g))) vapply(r2$.eje, function(e) {
      v <- suppressWarnings(as.numeric(data[[var_n]][as.character(data[[var_eje]]) == e])); v <- unique(v[is.finite(v)])
      if (length(v) == 1L) v else NA_real_
    }, numeric(1)) else rep(NA_real_, nrow(r2))
    list(version = "pesas/1", tipo = "pesas", rotulos = r2$.eje, a = r2$.a, b = r2$.b,
         cifras_a = .pulso_fmt_pct_half_up(r2$.a, dec_p, escala = 1), cifras_b = .pulso_fmt_pct_half_up(r2$.b, dec_p, escala = 1),
         diferencia = r2$.dif, textos_diferencia = paste0(ifelse(r2$.dif > 0, "+", ""), .pulso_fmt_half_up(r2$.dif, 0), " ", etiqueta_brecha),
         mostrar_diferencia = isTRUE(mostrar_brecha), encabezado_diferencia = encabezado_brecha,
         grupos = niveles_grupo, colores = unname(colores[niveles_grupo]), leyenda = unname(etiquetas_leyenda),
         n_fila = unname(n_fila), eje = c(lo = lo, hi = hi, paso = paso), titulo_eje = titulo_eje)
  }, error = function(e) NULL)

  p <- p +
    ggplot2::scale_colour_manual(values = colores, breaks = niveles_grupo, labels = etiquetas_leyenda) +
    ggplot2::scale_x_continuous(
      limits = c(lo, tope), breaks = seq(lo, hi, by = paso), expand = c(0, 0),
      labels = function(x) paste0(.pulso_fmt_half_up(x, 0), "%")
    ) +
    ggplot2::scale_y_discrete(expand = ggplot2::expansion(add = c(0.6, 1.0))) +
    ggplot2::coord_cartesian(clip = "off") +
    ggplot2::labs(
      title = titulo, subtitle = subtitulo, caption = nota_pie,
      x = titulo_eje, y = NULL, colour = NULL
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
      axis.text.x = ggplot2::element_text(colour = .std_color("texto_tenue"), size = 10, family = font_family),
      axis.title.x = ggplot2::element_text(colour = .std_color("texto_suave"), size = 10, face = "bold",
                                           family = font_family, margin = ggplot2::margin(t = 6)),
      panel.grid.minor = ggplot2::element_blank(),
      panel.grid.major.y = ggplot2::element_blank(),
      panel.grid.major.x = ggplot2::element_line(colour = .PULSO_COLOR_GRID, linewidth = 0.3),
      plot.margin = ggplot2::margin(10, 16, 8, 12)
    )
  attr(p, "pulso_espec") <- espec_pesas
  p
}
