# =============================================================================
# reporte_word_graficos_otros.R — dona, torta y mapas de calor del Word del recetario (N8.9)
# =============================================================================
#
# Portan `g_torta` y `g_heat` (recetario_word_graficos.R:244-258, 284-297) leyendo las especs `pie/1` y `heatmap/1`:
# las cifras con el redondeo del gráfico, el rango del color y los casos por columna ya vienen resueltos.

.WORD_PALETA_TORTA <- c("#081F5C", "#9DC3E6", "#2A9D8F", "#E9C46A", "#BFBFBF")

#' Dona (la cifra mayor al centro) o torta, con la leyenda a la derecha centrada junto al círculo (`g_torta()`)
#' @param dona `NULL` toma la forma de la espec (`forma`); la dicotomía de dos porciones va en torta.
#' @keywords internal
.word_g_pie <- function(espec, dona = NULL) {
  navy <- .std_word("colores", "titulos")
  rot <- as.character(espec$rotulos); n <- length(rot)
  v <- if (!is.null(espec$unidades)) as.numeric(espec$unidades) else as.numeric(espec$valores) * 100
  dona <- dona %||% (!identical(espec$forma, "pie") && n > 2L)
  alto <- if (n > 2L) 2.9 else 2.6                                       # recetario_word.R:352-354, con el pie
  # Más de cinco porciones: el recetario pide barras («Con más de cinco se usan barras»), pero si llega una torta no se
  # repite color; se siguen los colores de actores del estándar que no estén ya y, si aún faltan, una rampa.
  pal <- unique(c(.WORD_PALETA_TORTA, toupper(.std_paleta("actores"))))
  pal <- if (n <= length(pal)) pal[seq_len(n)] else grDevices::colorRampPalette(pal)(n)
  pal <- as.vector(.word_colores_de_espec(espec, rot, pal))                 # paleta por lista (ADR 0097) por rótulo
  # Dona y leyenda se centran JUNTAS en el ancho de la página («la leyenda no usa todo el espacio y no está centrada»).
  tl <- 9.5; panel <- alto - 0.5; leg <- max(nchar(rot)) * tl * 0.55 / 72 + 0.4
  m <- max(0.1, (.std_word("pagina", "ancho_util") - panel - leg - 0.35) / 2)
  cif <- .casos_junto_cifras(espec$cifras, .espec_casos(espec), .espec_total_casos(espec))   # «Casos junto al porcentaje»
  et <- ifelse(v >= 6 & !(dona & v == max(v)), cif, "")         # en la dona la mayor ya está al centro
  d <- data.frame(k = factor(rot, levels = rot), v = v, et = et)
  g <- ggplot2::ggplot(d, ggplot2::aes(x = if (dona) 2 else 1, y = .data$v, fill = .data$k)) +
    ggplot2::geom_col(width = 1, colour = "#FFFFFF") + ggplot2::coord_polar(theta = "y", direction = -1) +
    ggplot2::geom_text(ggplot2::aes(label = .data$et), position = ggplot2::position_stack(vjust = 0.5), size = .word_pt(8.5), fontface = "bold",
                       family = "Arial", colour = "#FFFFFF") +
    ggplot2::scale_fill_manual(values = stats::setNames(pal, rot)) + .word_tema() +
    ggplot2::theme(legend.position = "right", legend.text = ggplot2::element_text(size = tl, colour = navy, margin = ggplot2::margin(l = 4)),
                   legend.key.size = ggplot2::unit(11, "pt"), legend.key.spacing.y = ggplot2::unit(5, "pt"), legend.box.spacing = ggplot2::unit(0.35, "in"),
                   plot.margin = ggplot2::margin(6, m * 72, 4, m * 72, "pt"))
  if (dona) g <- g + ggplot2::xlim(0.6, 2.5) +
    ggplot2::annotate("text", x = 0.6, y = 0, label = espec$cifras[which.max(v)], size = .word_pt(18), fontface = "bold", colour = .WORD_TINTA$navy, family = "Arial")
  attr(g, "alto") <- alto - 0.22; g
}

#' Mapa de calor de filas por columnas (`g_heat()`): rampa de claro a oscuro sobre el rango de la espec, la cifra en blanco
#' sobre los tonos oscuros, columnas con su rótulo arriba y filas a la izquierda
#' @keywords internal
.word_g_heat <- function(espec, lo = 80, hi = 100) {
  # El Word fija el tono de 80 % a 100 % «para que un color diga lo mismo en todo el informe» (página 31; g_heat, RG:284);
  # el recetario lo cambia sólo a mano (lo = 70, 0-20, 50). La espec trae el rango del dato, que es el del PPT (recetario_m3d).
  # Gonzalo, 2026-10-09: «El recetairo es la fuente de verdad» — cada formato el suyo. Bajo el piso, el tono más claro.
  navy <- .std_word("colores", "titulos")
  M <- espec$valores; Mc <- espec$valores_crudos %||% M
  filas <- espec$filas; cols <- espec$columnas$rotulo; nf <- length(filas); nc <- length(cols)
  rampa <- grDevices::colorRampPalette(c("#EEF2F8", "#2F4B7C"))(41)
  d <- expand.grid(i = seq_len(nf), j = seq_len(nc)); d$v <- M[cbind(d$i, d$j)]; d$vc <- Mc[cbind(d$i, d$j)]
  d <- d[is.finite(d$v), , drop = FALSE]
  d$col <- rampa[pmin(41, pmax(1, round((d$vc - lo) / max(hi - lo, 1e-9) * 40) + 1))]   # el tramo lo decide el valor crudo
  d$txt <- ifelse(vapply(d$col, function(h) sum(c(.2126, .7152, .0722) * grDevices::col2rgb(h)[, 1] / 255), 0) < 0.45, "#FFFFFF", navy)
  d$x <- d$j; d$y <- nf + 1 - d$i
  g <- ggplot2::ggplot(d) + ggplot2::geom_tile(ggplot2::aes(x = .data$x, y = .data$y, fill = .data$col), colour = "#FFFFFF", linewidth = 1.2) +
    ggplot2::scale_fill_identity() +
    ggplot2::geom_text(ggplot2::aes(x = .data$x, y = .data$y, label = paste0(.data$v, "%"), colour = .data$txt), size = .word_pt(9), fontface = "bold",
                       family = "Arial") + ggplot2::scale_colour_identity() +
    ggplot2::annotate("text", x = seq_len(nc), y = nf + 0.75, label = .word_envolver(cols, 8), size = .word_pt(7.5), fontface = "bold", colour = navy,
                      family = "Arial", vjust = 0, lineheight = 0.9) +
    ggplot2::annotate("text", x = 0.42, y = rev(seq_len(nf)), label = .word_envolver(filas, 22), hjust = 1, size = .word_pt(9), fontface = "bold",
                      colour = navy, family = "Arial", lineheight = 0.9) +
    # La columna de rótulos crece con el rótulo más largo (nunca menos que la del recetario, -1.9).
    ggplot2::scale_x_continuous(limits = c(min(-1.9, .word_xmin(.word_envolver(filas, 22), 9, nc + 0.5, 0.42) - 0.1), nc + 0.5), expand = c(0, 0)) + ggplot2::scale_y_continuous(limits = c(0.5, nf + 1.35), expand = c(0, 0)) +
    .word_tema() + ggplot2::coord_cartesian(clip = "off")
  # Recetario: 2.4 in con 4 filas y 3.9 in con 11, con el pie (recetario_word.R:395, 399).
  attr(g, "alto") <- 1.54 + 0.214 * nf - 0.12
  attr(g, "nota_rango") <- sprintf("El tono va de %s%% (claro) a %s%% (oscuro)", lo, hi)
  g
}

#' Comparativo de dimensiones entre dos grupos en el Word: los puntos de `g_dos_grupos()` con la diferencia CON signo
#' (primera menos segunda, página 32: «-3 pts», «+2 pts»). La espec `comparativo_dim/1` es la del PPT (diferencia sin
#' signo, recetario_m3d); aquí sólo se leen sus valores, no se cambia.
#' @keywords internal
.word_g_comparativo_dim <- function(espec) {
  V <- espec$valores; a <- as.numeric(V[, 1]); b <- as.numeric(V[, 2]); d <- a - b
  .word_g_pesas(list(rotulos = espec$filas, a = a, b = b, cifras_a = paste0(a, "%"), cifras_b = paste0(b, "%"), diferencia = d,
                     textos_diferencia = sprintf("%+d pts", as.integer(d)), mostrar_diferencia = TRUE,
                     grupos = as.character(espec$grupos), leyenda = as.character(espec$grupos), colores = espec$colores))
}

#' Puntos por competencia, en lugar del radar (`g_competencias()` moderna): por eje, un punto por grupo sobre la línea que
#' va del menor al mayor; ejes ordenados por su promedio, el mayor arriba; colores de actores del estándar
#' @keywords internal
.word_g_competencias <- function(espec) {
  navy <- .std_word("colores", "titulos"); T <- .WORD_TINTA
  M <- .word_radar_pct(espec$valores); ejes <- as.character(espec$ejes); gr <- as.character(espec$grupos)
  cols <- if (!is.null(espec$colores)) unname(espec$colores[gr]) else rep_len(c("#0B4F8C", "#2A9D8F", "#E9C46A"), length(gr))
  o <- order(rowMeans(M)); lv <- ejes[o]
  d <- do.call(rbind, lapply(seq_along(gr), function(j) data.frame(c = factor(ejes, levels = lv), a = factor(gr[j], levels = gr), v = M[, j])))
  r <- data.frame(c = factor(ejes, levels = lv), mn = apply(M, 1, min), mx = apply(M, 1, max))
  lo <- max(0, min(80, floor(min(M) / 5) * 5))
  g <- ggplot2::ggplot() + ggplot2::geom_segment(data = r, ggplot2::aes(x = .data$mn, xend = .data$mx, y = .data$c, yend = .data$c), colour = T$gris, linewidth = 0.6) +
    ggplot2::geom_point(data = d, ggplot2::aes(.data$v, .data$c, colour = .data$a), size = 2.6) +
    ggplot2::scale_colour_manual(values = stats::setNames(cols, gr), name = NULL) +
    ggplot2::scale_x_continuous(limits = c(lo, 100.5), labels = function(x) paste0(x, "%")) + .word_tema() +
    ggplot2::theme(axis.text.y = ggplot2::element_text(size = 8.5, colour = navy, face = "bold", family = "Arial", hjust = 1),
                   axis.text.x = ggplot2::element_text(size = 8, colour = T$gris, family = "Arial"),
                   panel.grid.major.x = ggplot2::element_line(colour = "#E3E6EC", linewidth = 0.3))
  attr(g, "alto") <- 0.58 + 0.3 * length(ejes); g         # recetario_word.R:406: 6 competencias en 2.6 in con el pie
}

# `radar/1` guarda los valores de 0 a 1 (graficos_espec_radar.R); el recetario dibuja en por ciento.
.word_radar_pct <- function(V) { V <- as.matrix(V); if (max(V, na.rm = TRUE) <= 1.0001) V * 100 else V }

#' Radar (`g_radar()`): anillos cada 5 puntos desde el piso de la espec, rótulos de los anillos en la diagonal entre los dos
#' primeros ejes (donde no hay eje), una línea por grupo con los colores de la espec y la leyenda abajo
#' @keywords internal
.word_g_radar <- function(espec) {
  navy <- .std_word("colores", "titulos"); T <- .WORD_TINTA
  M <- .word_radar_pct(espec$valores); ejes <- as.character(espec$ejes); gr <- as.character(espec$grupos)
  lo <- espec$lo %||% 80; k <- length(ejes); ang <- pi / 2 - 2 * pi * (0:(k - 1)) / k
  rr <- function(v) (pmax(v, lo) - lo) / (100 - lo)
  # Los anillos los decide la espec (cada 5, 10 o 20 según el rango, .espec_radar): con piso 0 y anillos cada 5 eran 20
  # rótulos apilados (verificador de N8.9). Sin espec, cada 5 como el recetario con su piso de 80.
  anillos <- as.numeric(espec$anillos %||% seq(lo + 5, 100, 5)); anillos <- anillos[anillos > lo & anillos <= 100]
  cols <- if (!is.null(espec$colores)) unname(espec$colores[gr]) else rep_len(c("#0B4F8C", "#2A9D8F", "#E9C46A"), length(gr))
  ring <- do.call(rbind, lapply(anillos, function(v) data.frame(r = v, x = rr(v) * cos(c(ang, ang[1])), y = rr(v) * sin(c(ang, ang[1])))))
  ser <- do.call(rbind, lapply(seq_along(gr), function(j) data.frame(a = gr[j], x = rr(M[c(seq_len(k), 1), j]) * cos(c(ang, ang[1])),
                                                                  y = rr(M[c(seq_len(k), 1), j]) * sin(c(ang, ang[1])))))
  ser$a <- factor(ser$a, levels = gr)
  lab <- data.frame(t = .word_envolver(ejes, 16), x = 1.2 * cos(ang), y = 1.13 * sin(ang), h = ifelse(abs(cos(ang)) < 0.15, 0.5, ifelse(cos(ang) > 0, 0, 1)))
  g <- ggplot2::ggplot() + ggplot2::geom_path(data = ring, ggplot2::aes(.data$x, .data$y, group = .data$r), colour = "#D5D9DF", linewidth = 0.3) +
    ggplot2::annotate("text", x = rr(anillos) * cos(pi / 2 - pi / k), y = rr(anillos) * sin(pi / 2 - pi / k), label = paste0(anillos, "%"),
                      size = .word_pt(7.5), colour = T$gris, family = "Arial") +
    ggplot2::geom_path(data = ser, ggplot2::aes(.data$x, .data$y, group = .data$a, colour = .data$a), linewidth = 0.9) +
    ggplot2::geom_point(data = ser, ggplot2::aes(.data$x, .data$y, colour = .data$a), size = 1.6) +
    ggplot2::geom_text(data = lab, ggplot2::aes(.data$x, .data$y, label = .data$t, hjust = .data$h), size = .word_pt(8), colour = navy, family = "Arial",
                       fontface = "bold", lineheight = 0.9) +
    ggplot2::scale_colour_manual(values = stats::setNames(cols, gr), name = NULL) +
    ggplot2::coord_equal(xlim = c(-1.9, 1.9), ylim = c(-1.3, 1.3), clip = "off") + .word_tema()
  # Recetario: 3.4 in con 6 ejes y 3.6 con 11, con el pie (recetario_word.R:408, 412).
  attr(g, "alto") <- (if (k > 8) 3.6 else 3.4) - 0.22
  attr(g, "nota_eje") <- sprintf("El eje empieza en %s%%", lo)
  g
}

#' Mapa del Word (`g_mapa()`): el mismo dibujo que la lámina (`.lam_mapa_gg`, polígonos de `mapa/1` en su caja) con la
#' leyenda a la derecha centrada en el alto del mapa y la figura tan ancha como el dibujo y su leyenda («leyendas mal
#' posicionadas en los mapas», Gonzalo, 2026-10-08). En la forma general la leyenda nombra primero los grupos del estudio.
#' @param alto Alto de la figura en pulgadas (el recetario usa 4).
#' @keywords internal
.word_g_mapa <- function(espec, alto = 4) {
  navy <- .std_word("colores", "titulos"); T <- .WORD_TINTA
  ley_rot <- c(vapply(espec$grupos %||% list(), function(g) as.character(g$titulo), ""), as.character(espec$leyenda$rotulos %||% character(0)))
  ley_col <- c(vapply(espec$grupos %||% list(), function(g) as.character(g$color), ""), as.character(espec$leyenda$colores %||% character(0)))
  titulo <- espec$leyenda$titulo %||% ""
  cj <- espec$caja
  # La leyenda va con claves propias (los rellenos del mapa son colores, no categorías): un punto invisible por clave.
  ley <- data.frame(x = unname(cj[["xmin"]]), y = unname(cj[["ymin"]]), k = factor(ley_rot, levels = ley_rot))
  g <- .lam_mapa_gg(espec) +
    ggplot2::geom_point(data = ley, ggplot2::aes(.data$x, .data$y, colour = .data$k), alpha = 0) +
    ggplot2::scale_colour_manual(values = stats::setNames(ley_col, ley_rot), name = titulo, drop = FALSE) +
    ggplot2::guides(colour = ggplot2::guide_legend(override.aes = list(alpha = 1, shape = 22, size = 3.6, fill = ley_col, colour = "#B8C2D3"))) +
    ggplot2::theme(legend.position = "right", legend.title = ggplot2::element_text(size = 8, face = "bold", colour = T$gris, family = "Arial"),
                   legend.text = ggplot2::element_text(size = 8.5, colour = navy, family = "Arial"), legend.justification = c(0, 0.5),
                   legend.box.spacing = ggplot2::unit(0.15, "in"), plot.margin = ggplot2::margin(4, 4, 4, 4))
  asp <- unname((cj[["ymax"]] - cj[["ymin"]]) / ((cj[["xmax"]] - cj[["xmin"]]) * cos(mean(cj[c("ymin", "ymax")]) * pi / 180)))
  ley_w <- 0.35 + max(nchar(c(titulo, ley_rot))) * 8.5 * 0.5 / 72
  attr(g, "alto") <- alto - 0.22
  attr(g, "ancho") <- min(.std_word("pagina", "ancho_util"), (alto - 0.35) / asp + ley_w + 0.25)
  g
}
