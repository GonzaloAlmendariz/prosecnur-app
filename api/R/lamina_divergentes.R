# =============================================================================
# lamina_divergentes.R — barras divergentes nativas (lámina 71, recetario_m3a.R:50-77)
# =============================================================================
#
# Salió de lamina_escala.R (L10-4, bandeja CCSS 2026-10-24) para corregir su forma sin crecer aquel archivo: la línea
# del centro tachaba la cifra del neutro (se dibujaba encima de todo) y la escala reservaba 100 puntos a la derecha
# aunque el acuerdo más largo llegara a 60, así que las barras usaban menos de la mitad del ancho. Las cifras, los
# lados y el orden de las afirmaciones son los de la especificación (graficos_espec_divergentes.R).

# ---- Barras divergentes (lámina 71, recetario_m3a.R:50-77) ---------------------

#' Lámina de barras divergentes: desacuerdo a la izquierda del centro, acuerdo a la derecha y «SIN INF» aparte
#'
#' Afirmaciones en una columna de 4.5 in; segmentos desde el centro hacia afuera con su cifra dentro (o encima con
#' guía si no cabe), la suma de cada lado en coral y en verde, la columna «SIN INF» a la derecha y la leyenda
#' centrada debajo. La escala se acerca al lado de desacuerdo más largo.
#' @keywords internal
.lam_laminas_divergentes <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                     layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); tenue <- .std_color("texto_tenue")
  C <- espec$categorias; U <- espec$unidades; X <- espec$cifras; n <- length(espec$filas)
  # La columna especial se ensancha a lo que mide su cabecera, para no partir «Desconoce» (verificador de N6, ronda 3).
  hay_si <- any(C$lado == "sin_inf"); wsi <- if (hay_si) .lam_divergentes_wsi(C$rotulo[C$lado == "sin_inf"][1]) else 0
  y0 <- yt + 0.3; fila <- min(0.74, (yf - y0 - 0.35) / max(1L, n)); g <- min(0.4, fila * 0.55)
  xq <- ml + 0.1; wq <- .lam_divergentes_wq(espec$filas, fila); xa <- xq + wq + 0.25; wa <- W - mr - xa - wsi - 0.2
  neu <- which(C$lado == "neu"); mitades <- if (length(neu)) rowSums(U[, neu, drop = FALSE]) / 2 else rep(0, n)
  # L10-4: la escala va del desacuerdo más largo al acuerdo más largo (antes reservaba 100 puntos a la derecha), con
  # el sitio de la suma de cada lado (0.8 in) fuera de las barras.
  izq <- max(espec$total_neg + mitades, 1); der <- max(espec$total_pos + mitades, 1)
  px <- (wa - 1.6) / (izq + der); xc <- xa + 0.8 + izq * px
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  .lam_txt(lz, "En desacuerdo", xc - 2.2, y0 - 0.4, 2.1, 0.26, 10.5, suave, bold = TRUE, align = "right", nombre = "divergentes:encabezado")
  # «Top Two Box» sólo cuando el lado de acuerdo son exactamente dos categorías (lámina 19).
  .lam_txt(lz, if (length(espec$orden_pos) == 2L) "De acuerdo (Top Two Box)" else "De acuerdo", xc + 0.1, y0 - 0.4, 3, 0.26, 10.5, suave,
           bold = TRUE, nombre = "divergentes:encabezado")
  if (hay_si) .lam_txt(lz, C$rotulo[C$lado == "sin_inf"][1], W - mr - wsi, y0 - 0.4, wsi, 0.26, 10.5, suave, bold = TRUE, align = "center",
                       nombre = "divergentes:encabezado")
  neg <- espec$orden_neg %||% rev(which(C$lado == "neg")); pos <- espec$orden_pos %||% which(C$lado == "pos"); si <- which(C$lado == "sin_inf")
  max_si <- if (hay_si) max(1, max(U[, si])) else 1
  # L10-4: la línea del centro va DETRÁS de los segmentos y sus cifras: se ve entre filas y no tacha la cifra del neutro.
  .lam_caja(lz, xc - 0.006, y0 - 0.1, 0.012, n * fila + 0.15, azul, nombre = "divergentes:centro")
  for (i in seq_len(n)) {
    yb <- y0 + (i - 1) * fila + (fila - g) / 2
    hp <- .lam_alto_txt(espec$filas[i], wq, 10.5, TRUE)
    .lam_txt(lz, espec$filas[i], xq, yb + g / 2 - hp / 2, wq, hp, 10.5, azul, bold = TRUE, nombre = "divergentes:afirmacion")
    mitad <- if (length(neu)) sum(U[i, neu]) / 2 else 0
    segs <- list()
    for (k in neu) segs[[length(segs) + 1L]] <- list(k = k, x = xc - mitad * px, w = 2 * mitad * px)
    off <- mitad; for (k in neg) { segs[[length(segs) + 1L]] <- list(k = k, x = xc - (off + U[i, k]) * px, w = U[i, k] * px); off <- off + U[i, k] }
    off <- mitad; for (k in pos) { segs[[length(segs) + 1L]] <- list(k = k, x = xc + off * px, w = U[i, k] * px); off <- off + U[i, k] }
    fin_chica <- -Inf   # fin de la última cifra chica dibujada en la fila
    segs <- segs[order(vapply(segs, `[[`, 0, "x"))]
    for (sg in segs) {
      if (U[i, sg$k] <= 0) next
      .lam_caja(lz, sg$x - 0.002, yb, sg$w + 0.004, g, C$color[sg$k], nombre = "divergentes:segmento")
      if (sg$w >= 0.45) {
        .lam_txt(lz, X[i, sg$k], sg$x - 0.1, yb + (g - 0.28) / 2, sg$w + 0.2, 0.28, 11, azul, bold = TRUE, align = "center", nombre = "divergentes:cifra")
      } else {   # cifra chica encima con su guía, como en las apiladas
        # Si se encimaría con la cifra chica vecina, se corre hacia la derecha a la misma altura y la guía hace un
        # codo hasta ella: entre filas no hay alto para dos niveles (verificador de N6, ronda 2).
        # Y nunca sobre la línea del centro, que atraviesa el aire entre filas: la cifra se queda entera de su lado y,
        # si de ese lado no cabe junto a la vecina, pasa al otro (verificador de N6, ronda 3).
        wt <- .lam_ancho_tinta(X[i, sg$k], 10.5, TRUE); cs <- sg$x + sg$w / 2
        cl <- max(cs, fin_chica + 0.06 + wt / 2)
        if (abs(cl - xc) < wt / 2 + 0.05) {
          cl <- if (cs < xc) xc - 0.05 - wt / 2 else xc + 0.05 + wt / 2
          if (cl - wt / 2 < fin_chica + 0.06) cl <- xc + 0.05 + wt / 2
        }
        .lam_caja(lz, cs - 0.006, yb - 0.06, 0.012, 0.06, tenue, nombre = "divergentes:guia")
        if (abs(cl - cs) > 0.01) .lam_caja(lz, min(cs, cl), yb - 0.066, abs(cl - cs), 0.012, tenue, nombre = "divergentes:guia")
        .lam_txt(lz, X[i, sg$k], cl - 0.3, yb - 0.3, 0.6, 0.24, 10.5, azul, bold = TRUE, align = "center", nombre = "divergentes:cifra")
        fin_chica <- cl + wt / 2
      }
    }
    .lam_txt(lz, espec$cifras_pos[i], xc + (espec$total_pos[i] + mitad) * px + 0.08, yb + (g - 0.28) / 2, 0.7, 0.28, 11,
             .std_color("verde_top_two_box"), bold = TRUE, nombre = "divergentes:total_acuerdo")
    .lam_txt(lz, espec$cifras_neg[i], xc - (espec$total_neg[i] + mitad) * px - 0.75, yb + (g - 0.28) / 2, 0.7, 0.28, 11,
             .std_color("coral"), bold = TRUE, align = "right", nombre = "divergentes:total_desacuerdo")
    if (hay_si) {
      v <- U[i, si[1]]
      if (v > 0) .lam_caja(lz, W - mr - wsi + 0.05, yb, (wsi - 0.55) * v / max_si, g, C$color[si[1]], nombre = "divergentes:sin_inf")
      .lam_txt(lz, X[i, si[1]], W - mr - 0.5, yb + (g - 0.26) / 2, 0.5, 0.26, 10.5, suave, bold = TRUE, align = "right", nombre = "divergentes:cifra_sin_inf")
    }
  }
  .lam_leyenda(lz, y0 + n * fila + 0.25, C$rotulo, C$color, centrar_en = W / 2)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:divergentes")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' Ancho de la columna de afirmaciones: el más angosto (desde 3.4 in) en que cada afirmación cabe en su fila sin pasar de
#' tres líneas (dos si la fila es baja) ni de las que ya pedía en las 4.5 in del recetario; así el bloque de barras se
#' queda con lo que el texto no necesita
#' @keywords internal
.lam_divergentes_wq <- function(filas, fila) {
  tope <- if (fila >= 0.6) 3L else 2L
  ref_l <- vapply(filas, function(t) .lam_lineas(t, 4.5, 10.5, TRUE), 0)
  ref_h <- vapply(filas, function(t) .lam_alto_txt(t, 4.5, 10.5, TRUE), 0)
  for (w in seq(3.4, 4.5, by = 0.1)) {
    ok <- all(vapply(seq_along(filas), function(i) .lam_lineas(filas[i], w, 10.5, TRUE) <= max(tope, ref_l[i]) &&
                       .lam_alto_txt(filas[i], w, 10.5, TRUE) <= max(fila + 0.06, ref_h[i]), TRUE))
    if (ok) return(w)
  }
  4.5
}

#' Ancho de la columna especial: 0.9 in del recetario, o lo que pida su cabecera (hasta 1.6 in)
#' @keywords internal
.lam_divergentes_wsi <- function(rotulo) max(0.9, .lam_ancho_tinta(rotulo, 10.5, TRUE) + 0.2)

#' ¿Las divergentes caben? Hasta 8 afirmaciones con su texto en la fila (10.5 pt en 4.5 in)
#' @keywords internal
.lam_divergentes_cabe <- function(espec) {
  n <- length(espec$filas); y0 <- .std_geom("zona_datos_y0") + 0.3
  fila <- min(0.74, (.std_geom("contenido_y1") - y0 - 0.35) / max(1L, n))
  # La afirmación puede pasar un poco del alto de su fila (el recetario lleva una de cuatro líneas en 0.74 in).
  # Una sola categoría especial (la columna del recetario es una) y la afirmación puede pasar apenas su fila (el
  # recetario lleva una de cuatro líneas en 0.74 in).
  si <- espec$categorias$rotulo[espec$categorias$lado == "sin_inf"]
  n >= 1L && n <= 8L && length(si) <= 1L && (!length(si) || .lam_divergentes_wsi(si) <= 1.6) &&
    all(vapply(espec$filas, function(t) .lam_alto_txt(t, 4.5, 10.5, TRUE) <= fila + 0.06, TRUE))
}
