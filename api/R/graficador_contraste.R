# Contraste de públicos: el dumbbell del resumen ejecutivo (ADR 0134)
# ===================================================================
#
# `graficar_dumbbell(estilo = "resumen")` llega aquí. La metodología vive en `.espec_contraste()`
# (graficos_espec_contraste.R) y la lámina nativa en `.lam_laminas_contraste()` (lamina_contraste.R); este archivo
# sólo dibuja la misma especificación con ggplot, para el Word y para la lámina que no cabe en nativo.

#' Dibujo ggplot de una especificación `contraste/1`
#' @keywords internal
.graficar_contraste_gg <- function(espec, titulo = NULL, subtitulo = NULL, nota_pie = NULL, font_family = "Arial") {
  n <- length(espec$rotulos); k <- length(espec$grupos); par <- identical(espec$modo, "par")
  paso <- if (par) 1 else k + 0.7
  centro <- (n - seq_len(n) + 1) * paso
  largo <- do.call(rbind, lapply(seq_len(k), function(j) {
    dy <- if (par) 0 else ((k + 1) / 2 - j) * 1
    data.frame(fila = seq_len(n), grupo = espec$grupos[j], x = espec$valores[, j], y = centro + dy, cifra = espec$cifras[, j],
               stringsAsFactors = FALSE)
  }))
  largo$grupo <- factor(largo$grupo, levels = espec$grupos)
  eje <- espec$eje; ancho <- eje[["hi"]] - eje[["lo"]]
  formas_gg <- stats::setNames(unname(c(ellipse = 21, rect = 22, triangle = 24, diamond = 23)[espec$formas]), espec$grupos)
  con_base <- identical(espec$base_en %||% "tabla", "tabla")
  x_tabla <- eje[["hi"]] + ancho * c(0.18, if (con_base) 0.18 + 0.26 * seq_len(k))
  p <- ggplot2::ggplot()   # P10: sin bandas alternas, sobre el fondo de la lámina
  for (s in espec$separadores %||% integer(0)) {
    p <- p + ggplot2::geom_hline(yintercept = centro[s] - paso / 2, linetype = "dashed", colour = .std_color("texto_tenue"), linewidth = 0.3)
  }
  if (par) {
    seg <- data.frame(y = centro, x0 = apply(espec$valores, 1, min), x1 = apply(espec$valores, 1, max))
    p <- p + ggplot2::geom_segment(data = seg, ggplot2::aes(x = .data$x0, xend = .data$x1, y = .data$y, yend = .data$y),
                                   colour = .lam_aclarar(.std_color("tenue"), 0.35), linewidth = 1.4)
    # La cifra del punto de más abajo va a su izquierda; la del otro, a su derecha (en un empate, el primer grupo a la izquierda).
    largo$izq <- stats::ave(largo$x, largo$fila, FUN = function(v) rank(v, ties.method = "first")) == 1
    p <- p + ggplot2::geom_text(data = largo, ggplot2::aes(x = .data$x, y = .data$y, label = .data$cifra, hjust = ifelse(.data$izq, 1.6, -0.6)),
                                size = 3, colour = .std_color("texto_suave"), family = font_family)
  } else {
    p <- p + ggplot2::geom_segment(data = largo, ggplot2::aes(x = eje[["lo"]], xend = .data$x, y = .data$y, yend = .data$y, colour = .data$grupo),
                                   alpha = 0.3, linewidth = 0.8, show.legend = FALSE) +
      # La cifra a una distancia fija de su punto (con `hjust` relativo, un "0" de un carácter quedaba bajo la marca).
      ggplot2::geom_text(data = largo, ggplot2::aes(x = .data$x, y = .data$y, label = .data$cifra), hjust = 0, nudge_x = ancho * 0.018, size = 2.8,
                         colour = .std_color("azul"), family = font_family)
  }
  tabla <- data.frame(x = x_tabla[1], y = centro, t = espec$textos_diferencia, stringsAsFactors = FALSE)
  if (con_base) for (j in seq_len(k)) tabla <- rbind(tabla, data.frame(x = x_tabla[j + 1], y = centro, t = espec$bases[, j], stringsAsFactors = FALSE))
  # Encabezado de la tabla sobre la primera fila; con sub-filas, sobre su sub-fila de arriba (no a un paso entero).
  alto_cab <- if (par) paso * 0.9 else (k + 1) / 2 + 0.4
  cab <- data.frame(x = x_tabla, y = max(centro) + alto_cab, t = c(espec$encabezado_diferencia, if (con_base) espec$grupos), stringsAsFactors = FALSE)
  p <- p +
    ggplot2::geom_point(data = largo, ggplot2::aes(x = .data$x, y = .data$y, fill = .data$grupo, shape = .data$grupo),
                        size = if (par) 3.6 else 3, colour = "white", stroke = 0.6) +
    ggplot2::geom_text(data = tabla, ggplot2::aes(x = .data$x, y = .data$y, label = .data$t), size = 3, colour = .std_color("texto_suave"), family = font_family) +
    ggplot2::geom_text(data = cab, ggplot2::aes(x = .data$x, y = .data$y, label = .data$t), size = 3, fontface = "bold",
                       colour = .std_color("texto_suave"), family = font_family) +
    ggplot2::scale_fill_manual(values = stats::setNames(espec$colores, espec$grupos), labels = espec$leyenda %||% espec$grupos, name = NULL) +
    # La línea de cada sub-fila en el color de su grupo (sin esta escala tomaba la paleta por defecto de ggplot).
    ggplot2::scale_colour_manual(values = stats::setNames(espec$colores, espec$grupos), guide = "none") +
    ggplot2::scale_shape_manual(values = formas_gg, labels = espec$leyenda %||% espec$grupos, name = NULL) +
    ggplot2::scale_x_continuous(limits = c(eje[["lo"]], max(x_tabla) + ancho * 0.12), breaks = seq(eje[["lo"]], eje[["hi"]], by = eje[["paso"]]),
                                labels = function(x) paste0(x, "%"), expand = c(0, 0)) +
    # Los rótulos van partidos en una columna de 4 in y hasta tres líneas, con «…» si no caben: un enunciado entero de
    # 200 caracteres se quedaba con todo el ancho, el panel quedaba en negativo y rvg pintaba un rectángulo del color de
    # un grupo sobre la lámina, sin puntos (Arte, 2026-11-07).
    ggplot2::scale_y_continuous(breaks = centro, labels = .gg_rotulos_resumen(espec$rotulos, 4, 10, .gg_rotulos_max_lineas(n * paso)),
                                expand = ggplot2::expansion(add = c(if (par) 0.6 else (k + 1) / 2, if (par) paso * 1.3 else alto_cab + 0.5))) +
    ggplot2::coord_cartesian(clip = "off") +
    # La base de cada grupo va al pie de la lámina, abajo a la izquierda (`note_outside`), no dentro del dibujo.
    ggplot2::labs(title = titulo, subtitle = subtitulo, caption = NULL, x = NULL, y = NULL) +
    ggplot2::theme_minimal(base_family = font_family) +
    ggplot2::theme(legend.position = "top", legend.justification = "left",
                   panel.grid.minor = ggplot2::element_blank(), panel.grid.major.y = ggplot2::element_blank(),
                   panel.grid.major.x = ggplot2::element_line(colour = .PULSO_COLOR_GRID, linewidth = 0.3),
                   axis.text.y = ggplot2::element_text(colour = .std_color("azul"), size = 10, hjust = 1, lineheight = 0.95),
                   axis.text.x = ggplot2::element_text(colour = .std_color("texto_tenue"), size = 9),
                   plot.background = ggplot2::element_rect(fill = NA, colour = NA))
  attr(p, "pulso_espec") <- espec
  # Quién menos quién va en el pie, como en la lámina nativa («Diferencia: Docentes − Estudiantes, en puntos»).
  nota <- .lam_unir_base(espec$nota_base, nota_pie, .contraste_sentido_nota(espec))
  if (nzchar(nota)) attr(p, "note_outside") <- nota
  p
}
