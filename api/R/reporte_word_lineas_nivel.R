# =============================================================================
# reporte_word_lineas_nivel.R — la figura ggplot de la lámina «total arriba y líneas por nivel»
# =============================================================================
#
# El Word no tiene pieza nativa para esta lámina: dibuja esta figura por el flujo de figuras de siempre
# (`.word_grafico` → `.word_g_marco`, sin título ni pie; el documento pone rótulo, título y base debajo). Es la misma
# espec que la lámina nativa (`.lineas_nivel_modelo`): mismas cifras, mismas marcas y el mismo chip de tendencia. También
# es la figura de la ruta anterior del PPT cuando la lámina apaga el motor nativo (`meta$motor_nativo = FALSE`).

#' Franja del total en ggplot: partes, cifras, rótulos y la llave de la serie
#' @keywords internal
.lineas_nivel_gg_franja <- function(total, fam) {
  seg <- total$segmentos
  pct <- pmax(0, seg$pct); pct <- if (sum(pct) > 0) pct / sum(pct) else pct
  x1 <- cumsum(pct); x0 <- c(0, x1[-length(x1)])
  d <- data.frame(x0 = x0, x1 = x1, xm = (x0 + x1) / 2, cifra = .tarjetas_pct(seg$pct), rotulo = seg$rotulo,
                  color = seg$color, cabe = pct >= 0.07, stringsAsFactors = FALSE)
  d$tinta <- vapply(d$color, .lam_texto_sobre, character(1))
  # Rótulos bajo cada parte: centrados y, si dos se pisan, corridos a la derecha (el ancho en fracción de la franja).
  d$rot <- ifelse(d$cabe, d$rotulo, paste(d$cifra, d$rotulo))
  wl <- .lam_ancho_tinta(d$rot, 8) / 6.1
  izq <- d$xm - wl / 2
  for (k in seq_along(izq)) { if (k > 1L) izq[k] <- max(izq[k], izq[k - 1L] + wl[k - 1L] + 0.02); izq[k] <- max(izq[k], 0) }
  izq <- izq - max(0, max(izq + wl) - 1)
  d$xr <- izq
  azul <- .std_color("azul")
  g <- ggplot2::ggplot(d) +
    ggplot2::geom_rect(ggplot2::aes(xmin = x0, xmax = x1, ymin = 0, ymax = 1), fill = d$color, colour = NA) +
    ggplot2::geom_text(data = d[d$cabe, , drop = FALSE], ggplot2::aes(x = xm, y = 0.5, label = cifra),
                       colour = d$tinta[d$cabe], fontface = "bold", size = 4.2, family = fam) +
    ggplot2::geom_text(ggplot2::aes(x = xr, y = -0.45, label = rot), hjust = 0, colour = .std_color("texto_suave"), size = 2.8,
                       family = fam) +
    ggplot2::annotate("text", x = 0, y = 1.75, label = total$rotulo, hjust = 0, colour = .std_color("texto_suave"),
                      fontface = "bold", size = 3, family = fam)
  ll <- total$llave
  if (!is.null(ll)) {
    xa <- x0[ll$desde]; xb <- x1[ll$hasta]
    g <- g + ggplot2::annotate("segment", x = c(xa, xa, xb), xend = c(xb, xa, xb), y = c(1.2, 1.2, 1.2), yend = c(1.2, 1.02, 1.02),
                               colour = ll$color %||% azul, linewidth = 0.6) +
      ggplot2::annotate("text", x = xb + 0.012, y = 1.25, label = paste(ll$rotulo, .tarjetas_pct(ll$pct)), hjust = 0,
                        colour = azul, fontface = "bold", size = 3.2, family = fam)
  }
  g + ggplot2::scale_x_continuous(limits = c(0, 1), expand = c(0.005, 0.005)) +
    ggplot2::scale_y_continuous(limits = c(-0.75, 1.95), expand = c(0, 0)) +
    ggplot2::theme_void(base_family = fam)
}

#' Las líneas por nivel en ggplot: sombras, líneas, puntos con halo y marca, rótulo y chip de cada serie a la derecha
#' @keywords internal
.lineas_nivel_gg_lineas <- function(espec, fam) {
  niv <- espec$niveles; K <- nrow(niv); S <- espec$series
  azul <- .std_color("azul"); tenue <- .std_color("texto_tenue")
  largo <- do.call(rbind, lapply(seq_along(S), function(k) {
    pt <- S[[k]]$puntos
    data.frame(serie = k, x = seq_len(K), p = pt$p, dir = pt$dir, fragil = pt$fragil, comparable = pt$comparable,
               color = S[[k]]$color, stringsAsFactors = FALSE)
  }))
  # En cada nivel la serie más alta rotula arriba y la más baja abajo, como en la lámina.
  largo$arriba <- stats::ave(largo$p, largo$x, FUN = function(v) rank(-v, ties.method = "first") < max(2L, length(v)))
  largo$arriba <- as.logical(largo$arriba) | length(S) == 1L
  largo$lab <- .tarjetas_pct(largo$p)
  tope <- max(largo$p, na.rm = TRUE) * 1.25 + 4
  g <- ggplot2::ggplot()
  for (b in espec$bandas %||% list()) {
    pa <- S[[b$arriba]]$puntos$p
    pb <- if (is.na(b$abajo)) rep(0, K) else S[[b$abajo]]$puntos$p
    g <- g + ggplot2::annotate("ribbon", x = seq_len(K), ymin = pb, ymax = pa, fill = b$color, alpha = if (is.na(b$abajo)) 0.13 else 0.22)
  }
  for (k in seq_along(S)) {
    d <- largo[largo$serie == k, , drop = FALSE]
    g <- g + ggplot2::annotate("path", x = d$x, y = d$p, colour = S[[k]]$color, linewidth = 1.1)
    m <- d[!is.na(d$dir), , drop = FALSE]
    if (nrow(m)) g <- g + ggplot2::annotate("point", x = m$x, y = m$p, size = 7, shape = 21, fill = S[[k]]$color, alpha = 0.18,
                                            colour = S[[k]]$color, stroke = 0.6)
    g <- g + ggplot2::annotate("point", x = d$x, y = d$p, size = 2.6, shape = 21, stroke = 0.9, colour = ifelse(d$comparable, "white", S[[k]]$color),
                               fill = ifelse(d$comparable, S[[k]]$color, "white"))
  }
  dy <- tope * 0.07
  g <- g + ggplot2::annotate("text", x = largo$x, y = largo$p + ifelse(largo$arriba, dy, -dy), label = largo$lab,
                             colour = ifelse(largo$comparable, azul, tenue), fontface = "bold", size = 3.3, family = fam)
  m <- largo[!is.na(largo$dir), , drop = FALSE]
  if (nrow(m)) {
    g <- g + ggplot2::annotate("point", x = m$x + 0.2, y = m$p + ifelse(m$arriba, dy, -dy), shape = ifelse(m$dir == "up", 24, 25),
                               size = 2, colour = azul, fill = ifelse(m$fragil, "white", azul), stroke = 0.7)
  }
  # Rótulo y chip de cada serie a la derecha, a la altura de su último punto (sin pisarse).
  ult <- vapply(S, function(s) s$puntos$p[K], numeric(1))
  yl <- ult; o <- order(-yl)
  for (j in seq_along(o)[-1]) yl[o[j]] <- min(yl[o[j]], yl[o[j - 1L]] - tope * 0.17)
  xr <- K + 0.32
  for (k in seq_along(S)) {
    g <- g + ggplot2::annotate("text", x = xr, y = yl[k] + tope * 0.03, label = S[[k]]$rotulo, hjust = 0, colour = S[[k]]$color,
                               fontface = "bold", size = 3.4, family = fam)
    td <- S[[k]]$tendencia
    if (!is.null(td)) {
      g <- g + ggplot2::annotate("label", x = xr, y = yl[k] - tope * 0.05, label = paste(if (td$dir == "up") "↑" else "↓", td$texto),
                                 hjust = 0, colour = azul, fill = .std_color(if (isTRUE(td$fragil)) "tarjeta_fondo_95" else "tarjeta_fondo"),
                                 size = 2.8, family = fam, fontface = "bold")
    }
  }
  etq <- sprintf("%s\n%s %s", niv$etiqueta, format(niv$n, big.mark = ","), espec$publico %||% "casos")
  g + ggplot2::scale_x_continuous(breaks = seq_len(K), labels = etq, limits = c(0.6, K + 1.6), expand = c(0, 0)) +
    ggplot2::scale_y_continuous(limits = c(0, tope), labels = function(v) paste0(v, "%"), expand = c(0, 0)) +
    ggplot2::labs(subtitle = espec$seccion, x = NULL, y = NULL) +
    ggplot2::theme_minimal(base_family = fam) +
    ggplot2::theme(panel.grid.major.x = ggplot2::element_blank(), panel.grid.minor = ggplot2::element_blank(),
                   panel.grid.major.y = ggplot2::element_line(colour = .std_color("filete"), linewidth = 0.3),
                   axis.text.x = ggplot2::element_text(colour = azul, size = 9, face = "bold"),
                   axis.text.y = ggplot2::element_text(colour = tenue, size = 7),
                   plot.subtitle = ggplot2::element_text(colour = azul, face = "bold", size = 11))
}

#' Figura completa: la franja del total arriba (si la hay) y las líneas abajo; debajo, la lectura en gris
#' @keywords internal
.lineas_nivel_ggplot <- function(espec) {
  fam <- .std_pt("fuente")
  abajo <- .lineas_nivel_gg_lineas(espec, fam)
  notas <- c(espec$lectura, espec$no_comparables)
  if (length(notas)) {
    abajo <- abajo + ggplot2::labs(caption = paste(stringr::str_wrap(notas, 110), collapse = "\n")) +
      ggplot2::theme(plot.caption = ggplot2::element_text(colour = .std_color("texto_suave"), size = 8, hjust = 0))
  }
  # Siempre dentro de un lienzo de cowplot: el marco del Word quita título y pie del gráfico de afuera, no la lectura.
  p <- if (!is.null(espec$total)) {
    cowplot::plot_grid(.lineas_nivel_gg_franja(espec$total, fam), abajo, ncol = 1, rel_heights = c(0.3, 1))
  } else cowplot::plot_grid(abajo, ncol = 1)
  attr(p, "alto_word") <- if (!is.null(espec$total)) 4.4 else 3.4
  p
}
