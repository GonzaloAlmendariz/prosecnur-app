# =============================================================================
# lamina_divergentes_resumen.R — la escala del resumen ejecutivo (ADR 0134)
# =============================================================================
#
# Variante `estilo = "resumen"` de las barras divergentes (lamina_divergentes.R es la lámina 71 del recetario). Nació
# en el resumen ejecutivo de Formación General de Arte y Diseño 2026 y la validó Gonzalo en varias iteraciones:
#   - desacuerdo a la izquierda de una línea central («En desacuerdo» pegado al centro y «Totalmente en desacuerdo»
#     hacia afuera), acuerdo a la derecha, y «Sin información» en una columna gris separada;
#   - paleta Likert del estándar y leyenda en orden lógico, alineada con cada lado: lo de desacuerdo termina en el
#     centro, lo de acuerdo empieza en él y «Sin información» va sobre su columna;
#   - cifras en texto oscuro. Si la cifra no cabe en el segmento de un EXTREMO, va fuera de la barra, en negrita y
#     con el color del segmento oscurecido; si no cabe en un segmento interior, va adentro con letra más chica. Un
#     segmento en cero no se pinta ni se rotula. No hay totales por lado ni ningún «tramo crítico» rotulado.

#' Color oscurecido de un segmento, para su cifra fuera de la barra
#' @keywords internal
.lam_oscurecer <- function(col, t = 0.32) grDevices::colorRampPalette(c(col, "#000000"))(101)[round(t * 100) + 1L]

#' Geometría de la escala del resumen: filas, columna de afirmaciones y columna «Sin información»
#' @keywords internal
.lam_div_resumen_geom <- function(espec) {
  g_ <- .std_geom; ml <- g_("margen_izq"); fin <- g_("ancho") - g_("margen_der")
  n <- length(espec$filas); C <- espec$categorias
  y0 <- g_("zona_datos_y0") + 0.45; y1 <- g_("contenido_y1") - 0.05
  fila <- min(0.52, (y1 - y0) / max(1L, n))
  tinta <- max(vapply(espec$filas, function(t) .lam_ancho_tinta(t, 12, FALSE), 0))
  wq <- min(4.2, max(2.2, tinta + 0.25))
  hay_si <- any(C$lado == "sin_inf")
  wsi <- if (hay_si) max(1.5, .lam_ancho_tinta(C$rotulo[C$lado == "sin_inf"][1], 11, FALSE) + 0.45) else 0
  list(ml = ml, fin = fin, y0 = y0, fila = fila, g = fila * 0.74, wq = wq, hay_si = hay_si, wsi = wsi,
       xa = ml + wq + 0.2, xb = fin - wsi - (if (hay_si) 0.45 else 0))
}

#' ¿La escala del resumen cabe? Hasta 14 afirmaciones en dos líneas como mucho y una sola columna especial
#' @keywords internal
.lam_divergentes_resumen_cabe <- function(espec) {
  n <- length(espec$filas)
  if (n < 1L || n > 14L || sum(espec$categorias$lado == "sin_inf") > 1L) return(FALSE)
  ge <- .lam_div_resumen_geom(espec)
  (ge$xb - ge$xa) >= 4.5 && all(vapply(espec$filas, function(t) .lam_lineas_tinta(t, ge$wq, 12, FALSE) <= 2L, TRUE))
}

#' Lámina de la escala con «Sin información» aparte (estilo resumen)
#' @keywords internal
.lam_laminas_divergentes_resumen <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                             layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  azul <- .std_color("azul"); suave <- .std_color("texto_suave")
  C <- espec$categorias; U <- espec$unidades; X <- espec$cifras; n <- length(espec$filas)
  ge <- .lam_div_resumen_geom(espec); fila <- ge$fila; g <- ge$g; y0 <- ge$y0
  neu <- which(C$lado == "neu"); mitades <- if (length(neu)) rowSums(U[, neu, drop = FALSE]) / 2 else rep(0, n)
  neg <- espec$orden_neg %||% rev(which(C$lado == "neg")); pos <- espec$orden_pos %||% which(C$lado == "pos"); si <- which(C$lado == "sin_inf")
  # La escala se acerca al lado más largo de cada lado y deja 0.5 in a cada extremo para la cifra que sale de la barra.
  izq <- max(rowSums(U[, neg, drop = FALSE]) + mitades, 1); der <- max(rowSums(U[, pos, drop = FALSE]) + mitades, 1)
  px <- (ge$xb - ge$xa - 1.0) / (izq + der); xc <- ge$xa + 0.5 + izq * px
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  # Leyenda alineada con cada lado: el desacuerdo, del extremo al centro, termina en la línea; el acuerdo empieza en ella.
  yl <- y0 - 0.42
  item <- function(k) .lam_ancho_tinta(C$rotulo[k], 11, FALSE) + 0.3
  izq_ley <- rev(neg); x <- xc - 0.1 - sum(vapply(izq_ley, item, 0)) - 0.15 * max(0, length(izq_ley) - 1L)
  for (k in c(izq_ley, if (length(neu)) neu)) {
    .lam_caja(lz, x, yl + 0.075, 0.15, 0.15, C$color[k], nombre = "leyenda:cuadro")
    .lam_txt(lz, C$rotulo[k], x + 0.12, yl, item(k) + 0.2, 0.3, 11, azul, nombre = "leyenda:texto"); x <- x + item(k) + 0.15
  }
  x <- max(x, xc + 0.1)
  for (k in pos) {
    .lam_caja(lz, x, yl + 0.075, 0.15, 0.15, C$color[k], nombre = "leyenda:cuadro")
    .lam_txt(lz, C$rotulo[k], x + 0.12, yl, item(k) + 0.2, 0.3, 11, azul, nombre = "leyenda:texto"); x <- x + item(k) + 0.15
  }
  xsi <- ge$fin - ge$wsi
  if (ge$hay_si) {
    .lam_caja(lz, xsi, yl + 0.075, 0.15, 0.15, C$color[si[1]], nombre = "leyenda:cuadro")
    .lam_txt(lz, C$rotulo[si[1]], xsi + 0.12, yl, ge$wsi, 0.3, 11, azul, nombre = "leyenda:texto")
  }
  max_si <- if (ge$hay_si) max(1, max(U[, si[1]])) else 1
  for (i in seq_len(n)) {
    yb <- y0 + (i - 1) * fila + (fila - g) / 2; yc <- yb + g / 2
    hp <- .lam_alto_tinta(espec$filas[i], ge$wq, 12, FALSE)
    .lam_txt(lz, espec$filas[i], ge$ml, yc - hp / 2 - 0.02, ge$wq, hp, 12, azul, align = "right", nombre = "divergentes:afirmacion")
    mitad <- mitades[i]
    segs <- list()
    for (k in neu) segs[[length(segs) + 1L]] <- list(k = k, x = xc - mitad * px, w = 2 * mitad * px, lado = "neu")
    off <- mitad; for (k in neg) { segs[[length(segs) + 1L]] <- list(k = k, x = xc - (off + U[i, k]) * px, w = U[i, k] * px, lado = "neg"); off <- off + U[i, k] }
    off <- mitad; for (k in pos) { segs[[length(segs) + 1L]] <- list(k = k, x = xc + off * px, w = U[i, k] * px, lado = "pos"); off <- off + U[i, k] }
    # El extremo de cada lado es su último segmento con valor: ese es el que puede sacar su cifra fuera de la barra.
    ext_neg <- utils::tail(neg[U[i, neg] > 0], 1L); ext_pos <- utils::tail(pos[U[i, pos] > 0], 1L)
    for (sg in segs) {
      if (U[i, sg$k] <= 0) next
      .lam_caja(lz, sg$x - 0.002, yb, sg$w + 0.004, g, C$color[sg$k], nombre = "divergentes:segmento")
      cifra <- X[i, sg$k]
      if (sg$w >= .lam_ancho_tinta(cifra, 11, FALSE) + 0.1) {
        .lam_txt(lz, cifra, sg$x - 0.2, .lam_y_centrada(yc, 11), sg$w + 0.4, 0.28, 11, azul, align = "center", nombre = "divergentes:cifra")
      } else if (identical(sg$k, ext_neg) && identical(sg$lado, "neg")) {
        .lam_txt(lz, cifra, sg$x - 0.62, .lam_y_centrada(yc, 11), 0.58, 0.28, 11, .lam_oscurecer(C$color[sg$k]), bold = TRUE, align = "right",
                 nombre = "divergentes:cifra_fuera")
      } else if (identical(sg$k, ext_pos) && identical(sg$lado, "pos")) {
        .lam_txt(lz, cifra, sg$x + sg$w + 0.04, .lam_y_centrada(yc, 11), 0.58, 0.28, 11, .lam_oscurecer(C$color[sg$k]), bold = TRUE,
                 nombre = "divergentes:cifra_fuera")
      } else {
        .lam_txt(lz, cifra, sg$x - 0.25, .lam_y_centrada(yc, 8), sg$w + 0.5, 0.22, 8, azul, align = "center", nombre = "divergentes:cifra_chica")
      }
    }
    if (ge$hay_si && U[i, si[1]] > 0) {
      wbar <- (ge$wsi - 0.05) * U[i, si[1]] / max_si
      .lam_caja(lz, xsi, yb, wbar, g, C$color[si[1]], nombre = "divergentes:sin_inf")
      cabe <- wbar >= .lam_ancho_tinta(X[i, si[1]], 11, FALSE) + 0.1
      .lam_txt(lz, X[i, si[1]], if (cabe) xsi else xsi + wbar + 0.04, .lam_y_centrada(yc, 11), if (cabe) wbar else 0.6, 0.28, 11, azul,
               align = if (cabe) "center" else "left", nombre = "divergentes:cifra_sin_inf")
    }
  }
  # La línea central va encima de los segmentos (separa los lados), de la primera a la última fila.
  .lam_caja(lz, xc - 0.008, y0 - 0.04, 0.016, n * fila + 0.08, azul, nombre = "divergentes:centro")
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:divergentes")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}
