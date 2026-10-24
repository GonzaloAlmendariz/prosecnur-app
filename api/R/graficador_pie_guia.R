# Cifras de la torta y la dona ggplot con línea guía (frente C, pedido de Gonzalo, CCSS Perfil 2026).
#
# `graficar_pie()` metía cada porcentaje en su porción aunque no cupiera: en la dona de Género el «2%» quedaba sobre el
# «1%». Aquí, con el mismo umbral de «cifra chica» que las barras apiladas y que la torta nativa
# (`.lam_circular_cifra_chica`, lamina_circular_guia.R), la cifra que no cabe sale fuera del disco unida a su porción por
# una línea fina, y las de fuera se separan para no encimarse.

#' Qué cifras van fuera y dónde, medido en pulgadas sobre el disco con que se dibuja el panel
#'
#' @param df Porciones (`categoria`, `y_mid`, `pct`, `pct_txt`, `mostrar`) en fracciones del círculo.
#' @param r_text,r_lab Radio de la cifra dentro y radio total del panel (unidades de datos, `r_out = 1`).
#' @param d_in Diámetro en pulgadas del panel (`r_lab`).
#' @param size_pt Cuerpo de la cifra en puntos.
#' @param r_in Radio del hueco de la dona (unidades de datos); `NULL` en la torta.
#' @return `data.frame(categoria, y_mid, fuera, y_texto)` con el radio de las cifras de fuera en `attr(, "r_fuera")` y la
#'   separación mínima entre ellas (en fracciones del círculo) en `attr(, "minimo")`.
#' @keywords internal
.pie_guias <- function(df, r_text, r_lab, d_in, size_pt, r_in = NULL) {
  pulg <- d_in / 2 / r_lab                       # pulgadas por unidad de radio
  arco <- 2 * pi * r_text * pulg * df$pct
  # En la dona además debe caber a lo hondo del aro: a las 3 y a las 9 la cifra se mide a lo ancho, a las 12 a lo alto.
  w_txt <- .lam_ancho_txt(df$pct_txt, size_pt, TRUE); h_txt <- size_pt / 72
  a <- 2 * pi * df$y_mid
  hondo <- if (is.null(r_in)) Inf else (1 - r_in) * pulg
  w_tinta <- .lam_ancho_tinta(df$pct_txt, size_pt, TRUE)
  no_cabe_hondo <- abs(sin(a)) * w_tinta + abs(cos(a)) * h_txt + 0.1 > hondo   # con 0.05 in de aire a cada lado
  fuera <- df$mostrar & df$pct > 0 & (no_cabe_hondo | vapply(seq_len(nrow(df)), function(i) .lam_circular_cifra_chica(df$pct_txt[i], arco[i], size_pt), TRUE))
  r_fuera <- 1.17
  # La caja medida con holgura (la estimación por carácter se queda corta en el render) y un respiro entre vecinas.
  wbox <- if (any(fuera)) max(w_txt[fuera]) * 1.3 + 0.08 else 0
  minimo <- if (any(fuera)) wbox / (2 * pi * r_fuera * pulg) else 0
  y_texto <- df$y_mid
  if (sum(fuera) > 1L) y_texto[fuera] <- .lam_circular_separar(df$y_mid[fuera], minimo)
  # Cada cifra de fuera se aleja del borde lo que mide hacia el centro (a las 3 su medio ancho, a las 12 su medio alto),
  # para que su caja no pise el disco; la guía termina ahí.
  at <- 2 * pi * y_texto
  medio <- (abs(sin(at)) * w_tinta + abs(cos(at)) * h_txt) / 2 / pulg
  r_texto <- 1.08 + medio
  structure(data.frame(categoria = as.character(df$categoria), y_mid = df$y_mid, fuera = fuera, y_texto = y_texto,
                       r_texto = r_texto, r_guia = r_texto - medio - 0.02, stringsAsFactors = FALSE),
            r_fuera = r_fuera, minimo = minimo)
}

#' Radio total del panel: con cifras de fuera se reserva el aro donde van (el disco se achica lo justo)
#' @keywords internal
.pie_guias_r_lab <- function(hay_fuera, r_out = 1) if (isTRUE(hay_fuera)) 1.32 * r_out else r_out

#' Agrega las cifras al panel: dentro las que caben; fuera, con su guía, las chicas
#' @keywords internal
.pie_guias_capas <- function(p, df_lab, guias, r_text, color_dentro, color_fuera, size, family, fontface) {
  dentro <- df_lab[!guias$fuera[match(df_lab$categoria, guias$categoria)], , drop = FALSE]
  if (nrow(dentro)) {
    p <- p + ggplot2::geom_text(data = dentro, ggplot2::aes(x = r_text, y = .data$y_mid, label = .data$pct_txt),
                                color = color_dentro, size = size, family = family, fontface = fontface,
                                hjust = 0.5, vjust = 0.5, show.legend = FALSE, inherit.aes = FALSE)
  }
  g <- guias[guias$fuera, , drop = FALSE]
  if (!nrow(g)) return(p)
  g$pct_txt <- df_lab$pct_txt[match(g$categoria, df_lab$categoria)]
  p + ggplot2::geom_segment(data = g, ggplot2::aes(x = 1.0, xend = .data$r_guia, y = .data$y_mid, yend = .data$y_texto),
                            color = color_fuera, linewidth = 0.3, inherit.aes = FALSE) +
    ggplot2::geom_text(data = g, ggplot2::aes(x = .data$r_texto, y = .data$y_texto, label = .data$pct_txt),
                       color = color_fuera, size = size, family = family, fontface = fontface,
                       hjust = 0.5, vjust = 0.5, show.legend = FALSE, inherit.aes = FALSE)
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
