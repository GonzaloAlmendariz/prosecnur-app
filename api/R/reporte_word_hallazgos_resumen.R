# =============================================================================
# reporte_word_hallazgos_resumen.R — el resumen ejecutivo en el Word, como la tabla de la lámina
# =============================================================================
#
# En el PPT el resumen ejecutivo es una tabla por capítulo (lamina_hallazgos_resumen.R): cifra, frase, intervalo y la
# diferencia principal en pastillas. El Word lo dibujaba con el respaldo genérico de hallazgos (`.halla_ggplot`): puntos
# con su rango y la comparación como texto suelto a la derecha, que se cortaba en el borde de la página (CCSS v7.16,
# figuras 59 y 60). Esta figura repite la tabla a la escala del Word, con las mismas piezas y tonos (`.lam_dif_tono`).

#' Figura de Word del resumen ejecutivo: una tabla por capítulo, en pulgadas sobre un lienzo de `ancho`
#' @keywords internal
.halla_res_ggplot <- function(espec, ancho = .std_word("pagina", "ancho_util")) {
  caps <- unlist(lapply(espec$paginas %||% list(), function(pg) pg$capitulos %||% pg), recursive = FALSE)
  if (!length(caps)) caps <- list(list(titulo = "", kpis = espec$kpis %||% list()))
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); coral <- .std_color("coral"); filete <- .std_color("filete")
  x_cif <- 0; x_fr <- 0.74; x_dif <- 3.55; w_fr <- x_dif - 0.15 - x_fr; w_dif <- ancho - x_dif
  h_cap <- 0.32; h_fila <- 0.5
  txt <- list(); rec <- list(); y <- 0
  add_t <- function(x, y, s, pt, col, bold = FALSE, hj = 0) txt[[length(txt) + 1L]] <<- data.frame(x = x, y = y, s = s, pt = pt, col = col,
                                                                                                  f = if (bold) "bold" else "plain", hj = hj, stringsAsFactors = FALSE)
  add_r <- function(x0, x1, y0, y1, fill, borde = NA, lt = "solid") rec[[length(rec) + 1L]] <<- data.frame(x0 = x0, x1 = x1, y0 = y0, y1 = y1, fill = fill,
                                                                                                        borde = borde, lt = lt, stringsAsFactors = FALSE)
  envolver <- function(s, w, pt, max_l = 2L, bold = FALSE) {
    pal <- strsplit(s, " ", fixed = TRUE)[[1]]; lin <- character(0); cur <- ""
    for (p in pal) { prueba <- if (nzchar(cur)) paste(cur, p) else p
      if (.lam_ancho_tinta(prueba, pt, bold) <= w || !nzchar(cur)) cur <- prueba else { lin <- c(lin, cur); cur <- p } }
    lin <- c(lin, cur); if (length(lin) > max_l) { lin <- lin[seq_len(max_l)]; lin[max_l] <- paste0(lin[max_l], "…") }
    lin
  }
  flecha <- function(dir, fragil) if (identical(dir, "up")) (if (isTRUE(fragil)) "△" else "▲") else (if (isTRUE(fragil)) "▽" else "▼")
  add_t(x_cif, y + 0.12, "CIFRA", 6.5, suave, TRUE); add_t(x_fr, y + 0.12, "HALLAZGO", 6.5, suave, TRUE)
  add_t(x_dif, y + 0.12, "DIFERENCIA PRINCIPAL FRENTE AL RESTO", 6.5, suave, TRUE)
  y <- y + 0.24
  for (c in caps) {
    if (nzchar(c$titulo %||% "")) {
      add_t(0, y + 0.13, toupper(c$titulo), 7, coral, TRUE); add_r(0, ancho, y + 0.24, y + 0.25, coral); y <- y + h_cap
    }
    for (j in seq_along(c$kpis)) {
      k <- c$kpis[[j]]; yc <- y + h_fila / 2
      add_t(x_cif, yc, k$cifra, 17, azul, TRUE)
      lin <- envolver(k$texto %||% "", w_fr, 9)
      for (l in seq_along(lin)) add_t(x_fr, yc - 0.1 + (l - 1) * 0.15 - (length(lin) - 1) * 0.06, lin[l], 9, azul)
      add_t(x_fr, yc + 0.12 + (length(lin) - 1) * 0.06, .lam_halla_res_contexto(k), 6.5, suave)
      comp <- k$comparacion; con_t <- !is.null(k$tambien); yd <- if (con_t) yc - 0.06 else yc
      if (!is.null(comp) && length(comp$partes)) {
        if (!identical(comp$estado, "diferencia")) {
          ld <- envolver(comp$partes[[1]]$texto, w_dif - 0.05, 7.5, bold = TRUE)
          for (l in seq_along(ld)) add_t(x_dif, yd + (l - (length(ld) + 1) / 2) * 0.13, ld[l], 7.5,
                                         if (identical(comp$estado, "manual")) azul else suave, TRUE)
        } else {
          x <- x_dif
          for (pa in comp$partes) {
            s <- paste(pa$texto, flecha(pa$dir, pa$fragil)); tn <- .lam_dif_tono(pa$dir, pa$fragil)
            wp <- .lam_ancho_tinta(s, 7.5, TRUE) + 0.12
            if (x + wp > ancho + 1e-6) next
            add_r(x, x + wp, yd - 0.09, yd + 0.09, tn$fill, tn$borde, if (isTRUE(tn$punteado)) "22" else "solid")
            add_t(x + 0.07, yd, s, 7.5, tn$texto, TRUE)
            x <- x + wp + 0.06
          }
          if (!is.null(comp$cola) && x + .lam_ancho_tinta(comp$cola, 7.5, TRUE) <= ancho) add_t(x, yd, comp$cola, 7.5, suave, TRUE)
        }
      }
      if (con_t) {
        t <- k$tambien; tn <- .lam_dif_tono(t$dir, t$fragil)
        add_t(x_dif, yc + 0.15, paste("También", t$texto, flecha(t$dir, t$fragil)), 7,
              if (!isTRUE(t$fragil) && identical(t$dir, "up")) azul else tn$linea, TRUE)
      }
      if (j < length(c$kpis)) add_r(0, ancho, y + h_fila - 0.003, y + h_fila + 0.003, filete)
      y <- y + h_fila
    }
  }
  td <- do.call(rbind, txt); rd <- if (length(rec)) do.call(rbind, rec) else NULL
  td$sz <- td$pt / ggplot2::.pt
  g <- ggplot2::ggplot()
  if (!is.null(rd)) {
    rd$borde[is.na(rd$borde)] <- rd$fill[is.na(rd$borde)]
    g <- g + ggplot2::geom_rect(data = rd, ggplot2::aes(xmin = .data$x0, xmax = .data$x1, ymin = .data$y0, ymax = .data$y1,
                                                        fill = .data$fill, colour = .data$borde, linetype = .data$lt), linewidth = 0.3)
  }
  g <- g + ggplot2::geom_text(data = td, ggplot2::aes(x = .data$x, y = .data$y, label = .data$s, hjust = .data$hj, size = .data$sz,
                                                      colour = .data$col, fontface = .data$f), vjust = 0.5, family = "Arial") +
    ggplot2::scale_fill_identity() + ggplot2::scale_colour_identity() + ggplot2::scale_linetype_identity() +
    ggplot2::scale_size_identity() +
    ggplot2::scale_y_reverse(limits = c(y + 0.05, -0.02), expand = c(0, 0)) +
    ggplot2::scale_x_continuous(limits = c(0, ancho), expand = c(0, 0)) +
    ggplot2::theme_void()
  attr(g, "alto") <- y + 0.07
  attr(g, "alto_word") <- y + 0.07   # el marco del Word (`.word_g_marco`) lee este
  attr(g, "pulso_espec") <- espec
  g
}
