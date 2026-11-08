# graficador_barras_agrupadas_cruce_choque.R — las cifras de las dos series de un par no se montan
#
# Ola 2, E2a (fix3/before/p-5.png, «Agrupada mixta»): en una lámina de dos gráficos en vertical la agrupada con cruce
# dibuja cada categoría como un par de barras pegadas; con la cifra fuera de la barra, las dos cifras del par quedaban
# una sobre otra con 0.009 in de aire (10%/27%, 18%/19%). Y con el alto real del cajón la cifra bajaba de 14 pt hasta el
# piso de 8 pt: el arreglo no podía pagar el aire achicando el cuerpo.
#
# Regla: la cifra conserva el cuerpo del preset (`.agrupadas_cruce_par`, sin achicar; va fuera si no cabe en el 72 % de
# su barra) y, ya medido el lienzo, cuando dos cifras de un mismo par quedan más cerca en vertical que su alto más
# 0.03 in y se cruzan en horizontal, la de abajo arranca 0.08 in después de donde termina la de arriba. Ninguna cifra
# cambia de valor ni se oculta. Sólo geometría.

#' Separa en horizontal las cifras de un par que se montarían
#'
#' @param p_panel Panel de barras (ggplot con `coord_flip`, capa de texto con las cifras).
#' @param w_in,h_in Ancho y alto del panel en pulgadas, como se dibuja en el lienzo.
#' @param size_pt Cuerpo de la cifra en puntos.
#' @return El panel con la capa de cifras ajustada (capa nueva: no se toca la del gráfico original), o el mismo panel.
#' @keywords internal
.agrupadas_cruce_sin_choque <- function(p_panel, w_in, h_in, size_pt) {
  tryCatch({
    capas <- vapply(p_panel$layers, function(l) class(l$geom)[1], character(1))
    k <- which(capas == "GeomText")[1]
    if (is.na(k) || !is.finite(w_in) || !is.finite(h_in) || w_in <= 0 || h_in <= 0) return(p_panel)
    b <- ggplot2::ggplot_build(p_panel)
    d <- b$data[[k]]
    datos <- p_panel$layers[[k]]$data
    if (!is.data.frame(datos) || nrow(datos) != nrow(d) || !"valor_label" %in% names(datos)) return(p_panel)
    pp <- b$layout$panel_params[[1]]
    r_val <- pp$x.range %||% pp$x$continuous_range; r_cat <- pp$y.range %||% pp$y$continuous_range
    if (length(r_val) != 2L || length(r_cat) != 2L) return(p_panel)
    in_val <- w_in / diff(r_val); in_cat <- h_in / diff(r_cat)
    lab <- as.character(d$label); ok <- !is.na(lab) & nzchar(lab) & d$hjust == 0
    if (sum(ok) < 2L) return(p_panel)
    alto <- size_pt * 1.2 / 72 + 0.03
    ancho <- rep(0, nrow(d)); ancho[ok] <- .ancho_texto_in(lab[ok], size_pt)
    x0 <- d$y   # coord_flip: el largo de la barra está en y
    nuevo <- x0
    cat_id <- round(d$x)
    for (cc in unique(cat_id[ok])) {
      i <- which(ok & cat_id == cc)
      i <- i[order(-d$x[i])]   # de arriba hacia abajo en la lámina
      if (length(i) < 2L) next
      for (j in 2:length(i)) {
        a <- i[j - 1L]; z <- i[j]
        if (abs(d$x[a] - d$x[z]) * in_cat >= alto) next
        fin_a <- nuevo[a] + ancho[a] / in_val
        if (nuevo[z] < fin_a + 0.08 / in_val && nuevo[z] + ancho[z] / in_val > nuevo[a] - 0.08 / in_val) nuevo[z] <- fin_a + 0.08 / in_val
      }
    }
    if (isTRUE(all.equal(nuevo, x0))) return(p_panel)
    datos$valor_label <- datos$valor_label + (nuevo - x0)
    vieja <- p_panel$layers[[k]]
    # Capa nueva con los mismos parámetros (las capas son entornos: cambiar la del gráfico se filtraría al original).
    capa <- ggplot2::layer(geom = vieja$geom, stat = vieja$stat, data = datos, mapping = vieja$mapping, position = vieja$position,
                           params = c(vieja$geom_params, vieja$aes_params), inherit.aes = vieja$inherit.aes,
                           show.legend = vieja$show.legend)
    capas_n <- p_panel$layers; capas_n[[k]] <- capa
    p_panel$layers <- capas_n
    # La cifra corrida lleva su guía desde donde iba (el final de su barra) hasta donde arranca.
    mov <- which((nuevo - x0) * in_val > 0.02)
    if (length(mov)) {
      gd <- data.frame(cx = d$x[mov], v0 = x0[mov], v1 = nuevo[mov] - 0.02 / in_val)
      p_panel <- p_panel + ggplot2::geom_segment(data = gd, ggplot2::aes(x = .data$cx, xend = .data$cx, y = .data$v0, yend = .data$v1),
                                                 inherit.aes = FALSE, colour = .std_color("texto_tenue"), linewidth = 0.3)
    }
    p_panel
  }, error = function(e) p_panel)
}
