# =============================================================================
# lamina_categorica.R — categóricas del recetario dibujadas desde la especificación (ADR 0093, N3)
# =============================================================================
#
# Columnas verticales de un color para la pregunta categórica (recetario_m3a.R:6-18, lámina 68) y barras
# horizontales para la de una serie (`barras_h()`, recetario.R:182-209, lámina 73). Las cifras salen de
# `preparar_categorica()`; aquí sólo se ubican.

#' Columnas verticales: eje tenue, columna navy, cifra de 16 pt encima, «N <público>» de 10 pt y rótulo debajo
#' @keywords internal
.lam_columnas <- function(lz, espec, x0, ybase, wv, hmax = 3.4, unidad_n = "respuestas") {
  n_ <- length(espec$largos); if (!n_) return(invisible(lz))
  paso <- wv / n_; wcol <- paso * 0.56
  esc <- max(espec$largos) * 1.1
  azul <- .std_color("azul"); tenue <- .std_color("texto_tenue")
  .lam_caja(lz, x0 - 0.1, ybase, wv + 0.2, 0.012, tenue, nombre = "eje")
  for (k in seq_len(n_)) {
    hk <- if (esc > 0) hmax * espec$largos[k] / esc else 0
    xk <- x0 + (k - 1) * paso + (paso - wcol) / 2
    if (hk > 0.004) .lam_caja(lz, xk, ybase - hk, wcol, hk, azul, nombre = "columna")
    .lam_txt(lz, espec$cifras[k], xk - 0.3, ybase - hk - 0.42, wcol + 0.6, 0.36, 16, azul, bold = TRUE, align = "center", nombre = "cifra")
    if (is.finite(espec$n[k])) {
      .lam_txt(lz, sprintf("%s %s", format(as.integer(espec$n[k]), big.mark = ","), unidad_n), xk - 0.4, ybase - hk - 0.68,
               wcol + 0.8, 0.26, .std_pt("n"), tenue, align = "center", nombre = "n")
    }
    .lam_txt(lz, espec$rotulos[k], xk - 0.4, ybase + 0.1, wcol + 0.8, 0.3, 12, azul, bold = TRUE, align = "center", nombre = "rotulo")
  }
  invisible(lz)
}

#' Barras horizontales de una serie: rótulo a la derecha, barra y cifra; la mayor en navy y negrita y el resto
#' tenue cuando la especificación pide realce
#' @keywords internal
.lam_barras_h <- function(lz, espec, x, y, w, wlab, g, fila, size = 12, escala = NULL) {
  v <- espec$largos; et <- espec$rotulos
  escala <- escala %||% (max(v) * 1.12)
  wbar <- w - wlab - 0.8; yy <- y
  azul <- .std_color("azul"); tenue <- .std_color("tenue")
  for (k in seq_along(et)) {
    es_max <- isTRUE(espec$realce) && v[k] == max(v)
    h <- .lam_alto_txt(et[k], wlab, size)
    .lam_txt(lz, et[k], x, yy + (fila - h) / 2, wlab, h, size, azul, bold = es_max, align = "right", nombre = "rotulo")
    yb <- yy + (fila - g) / 2; bw <- if (escala > 0) wbar * v[k] / escala else 0
    if (bw > 0.004) .lam_caja(lz, x + wlab + 0.12, yb, bw, g, if (isTRUE(espec$realce) && !es_max) tenue else azul, nombre = "barra")
    .lam_txt(lz, espec$cifras[k], x + wlab + 0.16 + bw, yb + (g - 0.3) / 2, 0.8, 0.3, size, azul, bold = TRUE, nombre = "cifra")
    yy <- yy + fila
  }
  invisible(yy)
}

#' Lámina de una categórica, en columnas (pregunta categórica) o en barras (una serie)
#' @keywords internal
.lam_laminas_categorica <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                    forma = c("columnas", "barras"), unidad_n = "respuestas",
                                    layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio); forma <- match.arg(forma)
  g_ <- .std_geom; ml <- g_("margen_izq"); ancho <- g_("ancho") - ml - g_("margen_der")
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  if (identical(forma, "columnas")) {
    .lam_columnas(lz, espec, x0 = ml + 0.6, ybase = 6.05, wv = ancho - 1.2, unidad_n = unidad_n)
  } else {
    n <- length(espec$largos); g <- .std_grosor(n, "categorias")
    fila <- min(0.62, ((g_("leyenda_y") - 0.1) - (g_("zona_datos_y0") + 0.3)) / max(1L, n))
    wlab <- min(3.2, max(1.4, max(.lam_ancho_tinta(espec$rotulos, 12)) + 0.3))
    .lam_barras_h(lz, espec, ml, g_("zona_datos_y0") + 0.3, ancho, wlab = wlab, g = g, fila = max(fila, g + 0.2))
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:categorica")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}
