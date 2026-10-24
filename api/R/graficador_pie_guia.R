# Cifras de la torta y la dona ggplot con línea guía (frente C, pedido de Gonzalo, CCSS Perfil 2026).
#
# `graficar_pie()` metía cada porcentaje en su porción aunque no cupiera: en la dona de Género el «2%» quedaba sobre el
# «0%». Aquí, con el mismo umbral de «cifra chica» que las barras apiladas y que la torta nativa
# (`.lam_circular_cifra_chica`, lamina_circular_guia.R), la cifra que no cabe sale fuera del disco con la misma guía de
# dos tramos (radial y luego en arco, `.lam_circular_guia_trazo`), y las de fuera se separan para no encimarse.

#' Qué cifras van fuera y dónde, medido en pulgadas sobre el disco con que se dibuja el panel
#'
#' @param df Porciones (`categoria`, `y_mid`, `pct`, `pct_txt`, `mostrar`) en fracciones del círculo.
#' @param r_text,r_lab Radio de la cifra dentro y radio total del panel (unidades de datos, `r_out = 1`).
#' @param d_in Diámetro en pulgadas del panel (`r_lab`).
#' @param size_pt Cuerpo de la cifra en puntos.
#' @param r_in Radio del hueco de la dona (unidades de datos); `NULL` en la torta.
#' @return `data.frame(categoria, y_mid, fuera, y_texto, r_texto, hjust, vjust)`; en atributos, el trazo de cada guía
#'   (`trazos`: `categoria`, `ang`, `rad`), el radio del arco (`r_arco`), la separación mínima entre cifras de fuera en
#'   fracciones del círculo (`minimo`) y lo que el aro de fuera pide más allá del disco, en pulgadas (`extension_in`).
#' @keywords internal
.pie_guias <- function(df, r_text, r_lab, d_in, size_pt, r_in = NULL) {
  pulg <- d_in / 2 / r_lab                       # pulgadas por unidad de radio
  arco <- 2 * pi * r_text * pulg * df$pct
  # En la dona además debe caber a lo hondo del aro: a las 3 y a las 9 la cifra se mide a lo ancho, a las 12 a lo alto.
  h_txt <- size_pt / 72
  a <- 2 * pi * df$y_mid
  hondo <- if (is.null(r_in)) Inf else (1 - r_in) * pulg
  w_tinta <- .lam_ancho_tinta(df$pct_txt, size_pt, TRUE)
  no_cabe_hondo <- abs(sin(a)) * w_tinta + abs(cos(a)) * h_txt + 0.1 > hondo   # con 0.05 in de aire a cada lado
  # Una porción de 0 % no tiene dónde llevar su cifra: va fuera como cualquier chica (antes salía «2%0%» encimado).
  fuera <- df$mostrar & (no_cabe_hondo | vapply(seq_len(nrow(df)), function(i) .lam_circular_cifra_chica(df$pct_txt[i], arco[i], size_pt), TRUE))
  largo <- .LAM_GUIA_LARGO_IN / pulg; r_arco <- 1 + largo
  minimo <- if (any(fuera)) .lam_circular_minimo(df$y_mid[fuera], w_tinta[fuera] * 1.3 + 0.06, h_txt * 1.2, r_arco * pulg) else 0   # el render de rvg mide más que systemfonts
  y_texto <- df$y_mid
  if (sum(fuera) > 1L) y_texto[fuera] <- .lam_circular_separar(df$y_mid[fuera], minimo)
  lados <- lapply(y_texto, .lam_circular_cifra_lado)
  trazos <- do.call(rbind, c(list(data.frame(categoria = character(0), ang = numeric(0), rad = numeric(0))),
                             lapply(which(fuera), function(i) cbind(categoria = as.character(df$categoria[i]),
                                                                    .lam_circular_guia_trazo(df$y_mid[i], y_texto[i], 1, largo)))))
  at <- 2 * pi * y_texto
  ext <- if (any(fuera)) .LAM_GUIA_LARGO_IN + 0.03 + max((abs(sin(at)) * w_tinta * 1.15 + abs(cos(at)) * h_txt * 1.2)[fuera]) else 0
  structure(data.frame(categoria = as.character(df$categoria), y_mid = df$y_mid, fuera = fuera, y_texto = y_texto,
                       r_texto = r_arco + 0.03 / pulg, hjust = vapply(lados, `[[`, 0, "hjust"), vjust = vapply(lados, `[[`, 0, "vjust"),
                       stringsAsFactors = FALSE),
            trazos = trazos, r_arco = r_arco, minimo = minimo, extension_in = ext)
}

#' Radio total del panel: con cifras de fuera se reserva el aro donde van (el disco se achica lo justo para que la guía
#' y la cifra quepan en el panel)
#' @param extension_in Lo que piden la guía y la cifra más allá del disco, en pulgadas (`attr(.pie_guias(), "extension_in")`).
#' @keywords internal
.pie_guias_r_lab <- function(hay_fuera, r_out = 1, d_in = NULL, extension_in = NULL) {
  if (!isTRUE(hay_fuera)) return(r_out)
  if (is.null(d_in) || is.null(extension_in) || !is.finite(d_in) || d_in <= 0) return(1.32 * r_out)
  r_out * min(1.8, max(1.15, 1 / max(0.2, 1 - 2 * extension_in / d_in)))
}

#' Agrega las cifras al panel: dentro las que caben; fuera, con su guía de dos tramos, las chicas
#' @keywords internal
.pie_guias_capas <- function(p, df_lab, guias, r_text, color_dentro, color_fuera, size, family, fontface,
                             color_guia = .std_color("texto_tenue")) {
  dentro <- df_lab[!guias$fuera[match(df_lab$categoria, guias$categoria)], , drop = FALSE]
  if (nrow(dentro)) {
    p <- p + ggplot2::geom_text(data = dentro, ggplot2::aes(x = r_text, y = .data$y_mid, label = .data$pct_txt),
                                color = color_dentro, size = size, family = family, fontface = fontface,
                                hjust = 0.5, vjust = 0.5, show.legend = FALSE, inherit.aes = FALSE)
  }
  g <- guias[guias$fuera, , drop = FALSE]
  if (!nrow(g)) return(p)
  g$pct_txt <- df_lab$pct_txt[match(g$categoria, df_lab$categoria)]
  # El grosor de la guía de las apiladas (`.apiladas_guia_codo`, 0.32); coord_polar dobla el tramo de radio fijo en arco.
  p + ggplot2::geom_path(data = attr(guias, "trazos"), ggplot2::aes(x = .data$rad, y = .data$ang, group = .data$categoria),
                         color = color_guia, linewidth = 0.32, lineend = "butt", inherit.aes = FALSE) +
    ggplot2::geom_text(data = g, ggplot2::aes(x = .data$r_texto, y = .data$y_texto, label = .data$pct_txt,
                                              hjust = .data$hjust, vjust = .data$vjust),
                       color = color_fuera, size = size, family = family, fontface = fontface,
                       show.legend = FALSE, inherit.aes = FALSE)
}

#' Diámetro en pulgadas del panel del disco, con el mismo reparto del canvas que hace `graficar_pie()` (título, leyenda a
#' la derecha o abajo con sus filas, pie)
#' @keywords internal
.pie_guias_d_in <- function(ancho, alto, usar_canvas, mostrar_leyenda, leyenda_posicion, h_title, h_caption, pad_top,
                            w_legend_right, h_legend_bottom, n_cat, ncol_bajo) {
  ancho <- suppressWarnings(as.numeric(ancho)[1]); alto <- suppressWarnings(as.numeric(alto)[1])
  if (!is.finite(ancho) || !is.finite(alto) || ancho <= 0 || alto <= 0) return(4)
  if (!isTRUE(usar_canvas)) return(min(ancho, alto))
  if (identical(leyenda_posicion, "derecha")) {
    return(min(ancho * (1 - w_legend_right), alto * max(0.01, 1 - (h_title + h_caption) - pad_top)))
  }
  h_leg <- if (isTRUE(mostrar_leyenda)) min(0.34, max(h_legend_bottom, ceiling(n_cat / max(1L, ncol_bajo)) * 0.055)) else 0.01
  min(ancho, alto * max(0.01, 1 - (h_title + h_leg + h_caption) - pad_top))
}
