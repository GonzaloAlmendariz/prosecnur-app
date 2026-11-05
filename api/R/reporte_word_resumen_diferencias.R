# =============================================================================
# reporte_word_resumen_diferencias.R — el resumen de diferencias en el Word, como la tabla de la lámina
# =============================================================================
#
# El Word dibujaba el resumen con el respaldo de mosaicos (`.resumen_dif_ggplot`): sin la columna Total, sin los capítulos
# y sin el cruce sobre sus grupos, así que un «+23» no tenía contra qué leerse (CCSS v7.21, gráfico 58). Esta figura
# repite la tabla de la lámina (lamina_resumen_diferencias.R) a la escala de la página: rótulo de la fila, su total, el
# cruce sobre sus grupos con su filete, el capítulo en coral y cada celda con la misma pastilla y tono (`.lam_dif_tono`).

#' Figura de Word del resumen de diferencias, en pulgadas sobre un lienzo de `ancho`
#' @keywords internal
.resumen_dif_word_ggplot <- function(espec, ancho = .std_word("pagina", "ancho_util")) {
  cols <- espec$columnas; K <- nrow(cols %||% data.frame())
  caps <- Filter(function(c) length(c$filas) > 0L, espec$capitulos %||% list())
  if (!K || !length(caps)) return(NULL)
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); tenue <- .std_color("texto_tenue")
  w_rot <- min(2.3, ancho * 0.36); w_tot <- 0.42
  cw <- (ancho - w_rot - w_tot) / K
  xs <- w_rot + w_tot + (seq_len(K) - 0.5) * cw; x_tot <- w_rot + w_tot / 2
  txt <- list(); rec <- list()
  add_t <- function(x, y, s, pt, col, bold = FALSE, hj = 0) txt[[length(txt) + 1L]] <<- data.frame(x = x, y = y, s = s, pt = pt, col = col,
                                                                                                  f = if (bold) "bold" else "plain", hj = hj, stringsAsFactors = FALSE)
  add_r <- function(x0, x1, y0, y1, fill, borde = NA, lt = "solid") rec[[length(rec) + 1L]] <<- data.frame(x0 = x0, x1 = x1, y0 = y0, y1 = y1, fill = fill,
                                                                                                        borde = borde, lt = lt, stringsAsFactors = FALSE)
  envolver <- function(s, w, pt, max_l = 2L, bold = FALSE) {
    pal <- strsplit(as.character(s %||% ""), " ", fixed = TRUE)[[1]]; lin <- character(0); cur <- ""
    for (p in pal) { prueba <- if (nzchar(cur)) paste(cur, p) else p
      if (.lam_ancho_tinta(prueba, pt, bold) <= w || !nzchar(cur)) cur <- prueba else { lin <- c(lin, cur); cur <- p } }
    lin <- c(lin, cur); if (length(lin) > max_l) { lin <- lin[seq_len(max_l)]; lin[max_l] <- paste0(lin[max_l], "…") }
    lin
  }
  # Encabezado: el cruce sobre sus grupos con su filete, y el rótulo corto de cada grupo en hasta dos líneas.
  # Un cruce más ancho que sus grupos («ESTUDIOS DE PADRES» sobre dos columnas) se parte en dos líneas, no se sale.
  y <- 0
  lin_c <- lapply(unique(cols$cruce), function(cr) {
    i <- which(cols$cruce == cr)
    envolver(toupper(espec$rotulos_cruce[[cr]] %||% cr), length(i) * cw - 0.06, 6.5, 2L, TRUE)
  })
  n_c <- max(1L, vapply(lin_c, length, integer(1)))
  for (q in seq_along(unique(cols$cruce))) {
    i <- which(cols$cruce == unique(cols$cruce)[q]); xa <- xs[min(i)] - cw / 2 + 0.03; xb <- xs[max(i)] + cw / 2 - 0.03
    for (j in seq_along(lin_c[[q]])) add_t((xa + xb) / 2, y + 0.07 + (j - 1) * 0.1 + (n_c - length(lin_c[[q]])) * 0.1, lin_c[[q]][j], 6.5, suave, TRUE, 0.5)
    add_r(xa, xb, y + 0.07 + (n_c - 1) * 0.1 + 0.09, y + 0.07 + (n_c - 1) * 0.1 + 0.098, .std_color("filete"))
  }
  # El rótulo corto de cada grupo en hasta tres líneas (columnas de 0,35 in con diez grupos).
  lin_g <- lapply(cols$corto, function(s) envolver(s, cw - 0.03, 6.5, 3L, TRUE))
  n_g <- max(1L, vapply(lin_g, length, integer(1)))
  y_g <- y + 0.07 + (n_c - 1) * 0.1 + 0.2
  for (k in seq_len(K)) for (j in seq_along(lin_g[[k]])) add_t(xs[k], y_g + (j - 1) * 0.1 + (n_g - length(lin_g[[k]])) * 0.1, lin_g[[k]][j], 6.5, azul, TRUE, 0.5)
  add_t(x_tot, y_g + (n_g - 1) * 0.1, "Total", 7, azul, TRUE, 0.5)
  y <- y_g + (n_g - 1) * 0.1 + 0.13
  h <- 0.235
  for (cp in caps) {
    if (nzchar(cp$titulo %||% "")) {
      add_t(0, y + 0.11, toupper(cp$titulo), 6.5, .std_color("coral"), TRUE)
      add_r(0, ancho, y + 0.19, y + 0.197, .std_color("coral")); y <- y + 0.24
    }
    for (f in cp$filas) {
      yc <- y + h / 2
      add_r(0, ancho, y + 0.012, y + h - 0.012, .std_color("tarjeta_fondo"))
      lr <- envolver(f$rotulo, w_rot - 0.12, 7.5, 2L)
      for (j in seq_along(lr)) add_t(0.06, yc + (j - (length(lr) + 1) / 2) * 0.105, lr[j], if (length(lr) > 1) 7 else 7.5, azul)
      add_t(x_tot, yc, .tarjetas_pct(f$total), 7.5, azul, TRUE, 0.5)
      ce <- f$celdas
      for (k in seq_len(K)) {
        e <- if (is.null(ce)) NULL else ce[ce$cruce == cols$cruce[k] & ce$codigo == cols$codigo[k], , drop = FALSE]
        est <- if (is.null(e) || !nrow(e)) "sin_prueba" else e$estado[1]
        if (identical(est, "dif")) {
          tn <- .lam_dif_tono(e$dir[1], e$fragil[1]); wp <- min(cw - 0.06, 0.5)
          add_r(xs[k] - wp / 2, xs[k] + wp / 2, yc - 0.075, yc + 0.075, tn$fill, tn$borde, if (isTRUE(tn$punteado)) "22" else "solid")
          fl <- if (identical(e$dir[1], "up")) (if (isTRUE(e$fragil[1])) "△" else "▲") else (if (isTRUE(e$fragil[1])) "▽" else "▼")
          add_t(xs[k], yc, paste(.lam_dif_puntos(e$valor[1]), fl), 6.5, tn$texto, TRUE, 0.5)
        } else if (identical(est, "na")) {
          add_t(xs[k], yc, "n. a.", 6.5, tenue, FALSE, 0.5)
        } else {
          add_t(xs[k], yc, "·", 9, .std_color("tarjeta_total"), TRUE, 0.5)
        }
      }
      y <- y + h
    }
  }
  td <- do.call(rbind, txt); rd <- do.call(rbind, rec)
  td$sz <- td$pt / ggplot2::.pt
  rd$borde[is.na(rd$borde)] <- rd$fill[is.na(rd$borde)]
  g <- ggplot2::ggplot() +
    ggplot2::geom_rect(data = rd, ggplot2::aes(xmin = .data$x0, xmax = .data$x1, ymin = .data$y0, ymax = .data$y1,
                                               fill = .data$fill, colour = .data$borde, linetype = .data$lt), linewidth = 0.3) +
    ggplot2::geom_text(data = td, ggplot2::aes(x = .data$x, y = .data$y, label = .data$s, hjust = .data$hj, size = .data$sz,
                                               colour = .data$col, fontface = .data$f), vjust = 0.5, family = "Arial") +
    ggplot2::scale_fill_identity() + ggplot2::scale_colour_identity() + ggplot2::scale_linetype_identity() + ggplot2::scale_size_identity() +
    ggplot2::scale_y_reverse(limits = c(y + 0.04, -0.02), expand = c(0, 0)) +
    ggplot2::scale_x_continuous(limits = c(0, ancho), expand = c(0, 0)) +
    ggplot2::theme_void()
  attr(g, "alto") <- y + 0.06
  attr(g, "alto_word") <- y + 0.06   # el marco del Word (`.word_g_marco`) lee este
  attr(g, "pulso_espec") <- espec
  g
}
