# lamina_columna_llave.R — el total de una escala de una sola pregunta junto a las tarjetas: columna apilada vertical
# con el Top Two Box en una llave (ítem 23 de la v7 RV).
#
# Con las cuatro tarjetas de `todas` la barra horizontal de una sola pregunta quedaba chica y aislada en la mitad
# izquierda. Gonzalo pidió la excepción: una columna apilada vertical (la categoría más baja abajo, la más alta arriba),
# con el nombre de cada categoría a su izquierda y, a la derecha, una llave que abarca las dos de arriba y rotula
# «TOP TWO BOX» con su cifra. Todo nativo, con las piezas del motor y sus tokens; sin leyenda (los nombres van al lado).

#' ¿La lámina va con columna y llave? Una batería de una sola fila con Top Two Box
#' @keywords internal
.lam_columna_llave_aplica <- function(espec) {
  is.list(espec) && identical(espec$tipo, "escala") && NROW(espec$filas) == 1L && length(espec$box$cols %||% character(0)) > 0L &&
    is.null(espec$box2$unidades)
}

#' Dibuja la columna apilada con sus rótulos y la llave del Top Two Box en la franja `[x0, x1] × [y0, y1]`
#' @return El lienzo, con `attr(lz, "geo")` = `list(xc, wc, yb, alto)` para los tests.
#' @keywords internal
.lam_columna_llave <- function(lz, espec, x0, x1, y0, y1) {
  azul <- .std_color("azul"); tenue <- .std_color("texto_tenue")
  seg <- .lam_escala_seg(espec, 1L)
  nombres <- as.character(espec$categorias$rotulo)
  pt_cat <- .std_pt("rotulo_categoria"); pt_cifra <- .std_pt("cifra")
  w_nom <- max(.lam_ancho_tinta(paste0(nombres, "  100%"), pt_cat, FALSE))
  wc <- 1.15                                             # ancho de la columna
  rot_box <- .lam_rotulo_box(espec$box$rotulo %||% .PPT_ROTULO_TOP_TWO_BOX)
  w_box <- max(.lam_ancho_tinta(rot_box, .std_pt("rotulo_top_two_box"), TRUE), 1.2)
  # Rótulos | aire | columna | llave | rótulo del Top Two Box, centrado en la franja.
  total_w <- w_nom + 0.2 + wc + 0.35 + w_box
  xl <- x0 + max(0, (x1 - x0 - total_w) / 2)
  xc <- xl + w_nom + 0.2
  alto <- y1 - y0; yb <- y1                             # base de la columna
  # De abajo (primera categoría) hacia arriba.
  y <- yb; centros <- numeric(nrow(seg)); dentro <- logical(nrow(seg))
  for (k in seq_len(nrow(seg))) {
    hs <- if (isTRUE(seg$dibujar[k])) alto * seg$ancho[k] else 0
    if (hs > 0.004) .lam_caja(lz, xc, y - hs - (if (k < nrow(seg)) 0.004 else 0), wc, hs + (if (k < nrow(seg)) 0.004 else 0),
                              seg$color[k], nombre = "columna:segmento")
    centros[k] <- y - hs / 2
    dentro[k] <- hs >= pt_cifra * 1.25 / 72 + 0.06
    if (dentro[k]) .lam_txt(lz, seg$cifra[k], xc, centros[k] - 0.15, wc, 0.3, pt_cifra, .lam_cifra_color_seg(seg, k), bold = TRUE,
                            align = "center", nombre = "columna:cifra")
    y <- y - hs
  }
  # Rótulos a la izquierda, a la altura de su segmento; los que se pisarían se separan hacia arriba y abajo, y su guía va
  # recta: horizontal desde la columna, vertical hasta la altura del rótulo y horizontal hasta él.
  vis <- which(seg$dibujar & seg$ancho > 0)
  h_r <- pt_cat * 1.25 / 72 + 0.04
  ys <- .lam_columna_rotulos_y(centros[vis], h_r, y0 - 0.2, yb + 0.2)
  for (j in seq_along(vis)) {
    k <- vis[j]
    txt <- if (dentro[k]) nombres[k] else paste0(nombres[k], "  ", seg$cifra[k])
    .lam_txt(lz, txt, xl, ys[j] - h_r / 2, w_nom, h_r, pt_cat, azul, align = "right", nombre = "columna:rotulo")
    if (!dentro[k] || abs(ys[j] - centros[k]) > 0.01) {
      xm <- xc - 0.1
      .lam_caja(lz, xm, centros[k] - 0.006, xc - xm, 0.012, tenue, nombre = "columna:guia")
      if (abs(ys[j] - centros[k]) > 0.01) .lam_caja(lz, xm - 0.006, min(ys[j], centros[k]), 0.012, abs(ys[j] - centros[k]) + 0.006, tenue, nombre = "columna:guia")
      .lam_caja(lz, xc - 0.17, ys[j] - 0.006, xm - (xc - 0.17) + 0.006, 0.012, tenue, nombre = "columna:guia")
    }
  }
  # Llave del Top Two Box: abarca las categorías de la caja (las de arriba), con su pico al centro.
  kb <- match(espec$box$cols, espec$categorias$col); kb <- kb[!is.na(kb)]
  if (length(kb)) {
    arriba <- yb - alto * sum(seg$ancho[seq_len(max(kb))] * seg$dibujar[seq_len(max(kb))])
    abajo <- yb - alto * sum(seg$ancho[seq_len(min(kb) - 1L)] * seg$dibujar[seq_len(min(kb) - 1L)])
    verde <- .std_color("verde_top_two_box")
    xll <- xc + wc + 0.08; g <- 0.016; ym <- (arriba + abajo) / 2
    .lam_caja(lz, xll, arriba + 0.01, 0.1, g, verde, nombre = "columna:llave")
    .lam_caja(lz, xll, abajo - 0.01 - g, 0.1, g, verde, nombre = "columna:llave")
    .lam_caja(lz, xll + 0.1 - g, arriba + 0.01, g, abajo - arriba - 0.02, verde, nombre = "columna:llave")
    .lam_caja(lz, xll + 0.1, ym - g / 2, 0.08, g, verde, nombre = "columna:llave")
    xt <- xll + 0.27
    .lam_txt(lz, rot_box, xt, ym - 0.42, w_box + 0.2, 0.28, .std_pt("rotulo_top_two_box"), verde, bold = TRUE, nombre = "columna:llave:rotulo")
    .lam_txt(lz, as.character(espec$box$cifras[1]), xt, ym - 0.14, w_box + 0.2, 0.55, .std_pt("cifra") * 2, verde, bold = TRUE,
             nombre = "columna:llave:cifra")
  }
  attr(lz, "geo") <- list(xc = xc, wc = wc, yb = yb, alto = alto)
  lz
}

#' Alturas de los rótulos: cada uno junto a su segmento y, si se pisan, separados lo justo dentro de `[ymin, ymax]`
#' @keywords internal
.lam_columna_rotulos_y <- function(centros, h, ymin, ymax) {
  n <- length(centros); if (!n) return(numeric(0))
  o <- order(-centros)                    # de abajo (y mayor) hacia arriba
  y <- centros[o]
  for (i in seq_len(n)[-1]) y[i] <- min(y[i], y[i - 1] - h)
  if (y[n] < ymin) { y <- y + (ymin - y[n]); for (i in rev(seq_len(n - 1L))) y[i] <- max(y[i], y[i + 1] + h) }
  y <- pmin(y, ymax)
  out <- numeric(n); out[o] <- y
  out
}

#' Lámina del total con columna y llave, con el marco del motor (título, base, folio); las tarjetas las pone quien llama
#' @keywords internal
.lam_laminas_columna_llave <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, x1,
                                       layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante)
  y0 <- .lam_titulo_fin(titulo) + 0.55
  y1 <- .std_valor("ppt", "geometria", "base_y") - 0.45
  lz <- .lam_columna_llave(.lam_lienzo(), espec, .std_valor("ppt", "geometria", "margen_izq"), x1, y0, y1)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:columna_llave")
  doc <- .lam_pie(doc, base, folio)
  por_lamina(doc)
}
