# =============================================================================
# lamina_numericos.R — gráficos de números del recetario, con formas nativas (ADR 0093, N4)
# =============================================================================
#
# Histograma (lámina 79, recetario_graficos2.R:4-18): una barra azul por valor que
# ocupa su columna menos 0.04 in de aire, la cifra encima a 12 pt en negrita, el
# valor debajo, el triángulo coral de la mediana bajo su valor y la cifra de la
# mediana arriba a la derecha. Sin eje Y ni título del eje.

#' Histograma del recetario en un rectángulo
#'
#' @param espec Especificación `histograma/1` (adjunta por `.histograma_recetario`).
#' @param hb Alto máximo de las barras. `espec$x_mediana` es la posición de la mediana en columnas desde 0 (la primera barra).
#' @keywords internal
.lam_histograma <- function(lz, espec, x, y, w, hb) {
  azul <- .std_color("azul"); coral <- .std_color("coral")
  n <- length(espec$valores); wcol <- w / n; vmax <- max(espec$valores)
  for (k in seq_len(n)) {
    hk <- if (vmax > 0) hb * espec$valores[k] / vmax else 0; xk <- x + (k - 1) * wcol
    if (hk > 0) {
      .lam_caja(lz, xk + 0.02, y + hb - hk, wcol - 0.04, hk, azul, nombre = "histograma:barra")
      .lam_txt(lz, espec$cifras[k], xk, y + hb - hk - 0.3, wcol, 0.28, 12, azul, bold = TRUE, align = "center", nombre = "histograma:cifra")
    }
    .lam_txt(lz, espec$rotulos[k], xk, y + hb + 0.06, wcol, 0.28, 12, azul, align = "center", nombre = "histograma:valor")
  }
  xm <- x + (espec$x_mediana + 0.5) * wcol
  .lam_caja(lz, xm - 0.08, y + hb + 0.4, 0.16, 0.13, coral, nombre = "histograma:mediana", geom = "triangle")
  invisible(y + hb + 0.53)
}

#' Lámina de un histograma (lámina 79 del recetario)
#' @keywords internal
.lam_laminas_histograma <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                    layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); ancho <- W - ml - g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  .lam_histograma(lz, espec, ml, yt + 0.55, ancho, yf - yt - 1.25)
  .lam_txt(lz, espec$texto_mediana, W - g_("margen_der") - 3.2, yt, 3.2, 0.3, 12, .std_color("coral"), bold = TRUE, align = "right",
           nombre = "histograma:texto_mediana")
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:histograma")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' Columnas de una métrica por grupo (lámina 80, recetario_m3b.R:13-24)
#'
#' Columnas desde cero (guía 4.4) hasta 3.3 in, de 56 % de su paso, sobre un filete; la cifra a 16 pt en
#' negrita y, encima, los casos del grupo en gris claro; el rótulo del grupo debajo, a 12 pt en negrita.
#' @keywords internal
.lam_columnas_metrica <- function(lz, espec, x0, ybase, wv, hmax = 3.3, unidad_n = "respuestas", encabezado = NULL) {
  azul <- .std_color("azul"); tenue <- .std_color("texto_tenue")
  k <- length(espec$valores); paso <- wv / k; wcol <- paso * 0.56
  hi <- ceiling(max(espec$valores, na.rm = TRUE) * 1.1); if (!is.finite(hi) || hi <= 0) hi <- 1
  .lam_caja(lz, x0 - 0.1, ybase, wv + 0.2, 0.012, tenue, nombre = "numerico:base")
  if (!is.null(encabezado) && nzchar(encabezado)) {
    .lam_txt(lz, encabezado, x0 - 0.1, ybase - hmax - 0.75, 4, 0.26, 10, .std_color("texto_suave"), bold = TRUE, nombre = "numerico:encabezado")
  }
  for (i in seq_len(k)) {
    v <- espec$valores[i]; hk <- if (is.finite(v) && v > 0) hmax * v / hi else 0
    xk <- x0 + (i - 1) * paso + (paso - wcol) / 2
    if (hk > 0) .lam_caja(lz, xk, ybase - hk, wcol, hk, azul, nombre = "numerico:columna")
    .lam_txt(lz, espec$cifras[i], xk - 0.3, ybase - hk - 0.42, wcol + 0.6, 0.36, 16, azul, bold = TRUE, align = "center", nombre = "numerico:cifra")
    if (is.finite(espec$n[i])) {
      .lam_txt(lz, sprintf("%s %s", format(round(espec$n[i]), big.mark = ",", trim = TRUE), unidad_n), xk - 0.4, ybase - hk - 0.68,
               wcol + 0.8, 0.26, 10, tenue, align = "center", nombre = "numerico:casos")
    }
    .lam_txt(lz, espec$rotulos[i], xk - 0.4, ybase + 0.1, wcol + 0.8, .lam_alto_txt(espec$rotulos[i], wcol + 0.8, 12, TRUE), 12, azul,
             bold = TRUE, align = "center", nombre = "numerico:rotulo")
  }
  invisible(lz)
}

#' Lámina de un indicador numérico por grupo (lámina 80 del recetario)
#' @keywords internal
.lam_laminas_numerico <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL, unidad_n = "respuestas",
                                  encabezado = NULL, layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); ancho <- g_("ancho") - ml - g_("margen_der")
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  .lam_columnas_metrica(lz, espec, x0 = ml + 0.6, ybase = 6.05, wv = ancho - 1.2, unidad_n = unidad_n, encabezado = encabezado)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:numerico")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' Paso de las guías de un eje: el menor de 1, 2, 5, 10… que deja a lo sumo 12 guías
#' @keywords internal
.lam_paso_guias <- function(lo, hi) {
  for (p in c(1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000)) if ((hi - lo) / p <= 12) return(p)
  10^ceiling(log10((hi - lo) / 10))
}

#' Lámina de un diagrama de caja por grupo (lámina 81, recetario_m3b.R:27-45)
#'
#' Guías verticales con su valor arriba; por grupo, el rótulo a la derecha, el bigote gris a 1.5 RIC con sus
#' topes, la caja del 50 % central en azul claro con borde azul, la mediana como barra azul, los atípicos como
#' puntos grises y, en la columna de la derecha, la mediana escrita. Leyenda centrada bajo el eje.
#' @param unidad Unidad que acompaña a la mediana («años»); vacía, sólo la cifra.
#' @keywords internal
.lam_laminas_boxplot <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL, encabezado = NULL,
                                 unidad = "", etiqueta_caja = "50 % central de los casos", layout = "Graficos2",
                                 master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); tenue <- .std_color("texto_tenue"); claro <- .std_color("azul_rango")
  G <- espec$grupos; k <- NROW(G)
  lo <- floor(espec$rango[1]); hi <- ceiling(espec$rango[2]); if (hi <= lo) hi <- lo + 1
  xl <- ml + 1.9; wl <- W - mr - xl - 1.7; px <- function(v) xl + wl * (v - lo) / (hi - lo); fila <- (yf - yt - 0.9) / k
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  paso <- .lam_paso_guias(lo, hi)
  for (v in seq(lo, hi, by = paso)) {
    .lam_caja(lz, px(v), yt + 0.35, 0.006, k * fila, .std_color("filete"), nombre = "boxplot:guia")
    .lam_txt(lz, format(v, trim = TRUE), px(v) - 0.3, yt + 0.05, 0.6, 0.24, 10, tenue, align = "center", nombre = "boxplot:eje")
  }
  if (!is.null(encabezado) && nzchar(encabezado)) .lam_txt(lz, encabezado, xl, yt - 0.25, 3, 0.26, 10, suave, bold = TRUE, nombre = "boxplot:encabezado")
  fmt <- function(v) paste0(format(round(v, 1), trim = TRUE, nsmall = 0), if (nzchar(unidad)) paste0(" ", unidad) else "")
  for (i in seq_len(k)) {
    yc <- yt + 0.35 + (i - 0.5) * fila; hb <- min(0.42, fila * 0.55)
    .lam_txt(lz, G$rotulo[i], ml, yc - 0.15, 1.75, 0.3, 12, azul, bold = TRUE, align = "right", nombre = "boxplot:rotulo")
    bi <- G$bigote_inf[i]; bs <- G$bigote_sup[i]
    .lam_caja(lz, px(bi), yc - 0.008, max(px(bs) - px(bi), 0.002), 0.016, suave, nombre = "boxplot:bigote")
    .lam_caja(lz, px(bi) - 0.006, yc - hb / 4, 0.012, hb / 2, suave, nombre = "boxplot:tope")
    .lam_caja(lz, px(bs) - 0.006, yc - hb / 4, 0.012, hb / 2, suave, nombre = "boxplot:tope")
    .lam_caja(lz, px(G$q1[i]), yc - hb / 2, max(px(G$q3[i]) - px(G$q1[i]), 0.002), hb, claro, nombre = "boxplot:caja", borde = azul)
    .lam_caja(lz, px(G$mediana[i]) - 0.015, yc - hb / 2, 0.03, hb, azul, nombre = "boxplot:mediana")
    for (o in espec$atipicos[[i]]) .lam_caja(lz, px(o) - 0.045, yc - 0.045, 0.09, 0.09, suave, nombre = "boxplot:atipico", geom = "ellipse")
    .lam_txt(lz, fmt(G$mediana[i]), W - mr - 1.25, yc - 0.16, 1.25, 0.32, .std_pt("cifra"), azul, bold = TRUE, align = "center",
             nombre = "boxplot:cifra")
  }
  .lam_txt(lz, "Mediana", W - mr - 1.25, yt + 0.03, 1.25, 0.26, 10, azul, bold = TRUE, align = "center", nombre = "boxplot:titulo_columna")
  .lam_leyenda(lz, yf - 0.25, c(etiqueta_caja, "Mediana"), c(claro, azul), centrar_en = xl + wl / 2)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:boxplot")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' Lámina de media y rango por grupo (lámina 82, recetario_m3b.R:48-63)
#'
#' Guías verticales cada paso redondo; por grupo, el rótulo en 13 pt y sus casos debajo, la barra delgada del
#' rango en azul claro con sus extremos escritos a los lados, la media como punto azul y «Media N» a la derecha.
#' @param etiqueta_rango Rótulo de la leyenda para la barra; por defecto, según `espec$tipo_rango`.
#' @keywords internal
.lam_laminas_media_rango <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL, encabezado = NULL,
                                     unidad_n = "respuestas", etiqueta_rango = NULL, layout = "Graficos2", master = "Office Theme",
                                     por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); tenue <- .std_color("texto_tenue"); claro <- .std_color("azul_rango")
  k <- length(espec$media)
  paso <- .lam_paso_guias(min(espec$inf), max(espec$sup))
  lo <- floor(min(espec$inf) / paso) * paso; hi <- ceiling(max(espec$sup) / paso) * paso; if (hi <= lo) hi <- lo + paso
  paso <- .lam_paso_guias(lo, hi)
  xl <- ml + 2.2; wl <- W - mr - xl - 1.8; px <- function(v) xl + wl * (v - lo) / (hi - lo); fila <- (yf - yt - 1.0) / k
  num <- function(v) format(round(v, 1), trim = TRUE)
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  for (v in seq(lo, hi, by = paso)) {
    .lam_caja(lz, px(v), yt + 0.35, 0.006, k * fila, .std_color("filete"), nombre = "media_rango:guia")
    .lam_txt(lz, format(v, trim = TRUE), px(v) - 0.3, yt + 0.05, 0.6, 0.24, 10, tenue, align = "center", nombre = "media_rango:eje")
  }
  if (!is.null(encabezado) && nzchar(encabezado)) .lam_txt(lz, encabezado, xl, yt - 0.25, 3, 0.26, 10, suave, bold = TRUE, nombre = "media_rango:encabezado")
  for (i in seq_len(k)) {
    yc <- yt + 0.35 + (i - 0.5) * fila
    .lam_txt(lz, espec$rotulos[i], ml, yc - 0.27, 2.05, 0.3, 13, azul, bold = TRUE, align = "right", nombre = "media_rango:rotulo")
    if (is.finite(espec$n[i])) .lam_txt(lz, sprintf("%s %s", format(round(espec$n[i]), big.mark = ",", trim = TRUE), unidad_n), ml, yc + 0.02, 2.05,
                                        0.26, 10, tenue, align = "right", nombre = "media_rango:casos")
    .lam_caja(lz, px(espec$inf[i]), yc - 0.03, max(px(espec$sup[i]) - px(espec$inf[i]), 0.002), 0.06, claro, nombre = "media_rango:rango")
    .lam_txt(lz, num(espec$inf[i]), px(espec$inf[i]) - 0.55, yc - 0.15, 0.5, 0.28, 10.5, suave, align = "right", nombre = "media_rango:minimo")
    .lam_txt(lz, num(espec$sup[i]), px(espec$sup[i]) + 0.06, yc - 0.15, 0.5, 0.28, 10.5, suave, nombre = "media_rango:maximo")
    .lam_caja(lz, px(espec$media[i]) - 0.13, yc - 0.13, 0.26, 0.26, azul, nombre = "media_rango:media", geom = "ellipse")
    .lam_txt(lz, paste("Media", espec$cifras[i]), W - mr - 1.6, yc - 0.15, 1.6, 0.3, 12, azul, bold = TRUE, nombre = "media_rango:cifra")
  }
  etiqueta_rango <- etiqueta_rango %||% switch(espec$tipo_rango %||% "minmax", minmax = "Rango (mínimo a máximo)",
                                               iqr = "50 % central (cuartiles 1 a 3)", p10_p90 = "Percentiles 10 a 90", "Rango")
  .lam_leyenda(lz, yf - 0.25, c("Media", etiqueta_rango), c(azul, claro), centrar_en = xl + wl / 2)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:media_rango")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' Lámina de pesas: dos valores por fila unidos por un segmento (láminas 85 y 86, recetario_m3c.R:13-45)
#'
#' Eje de porcentaje con guías y su título; por fila, el rótulo (con sus casos debajo si los hay), el segmento
#' gris entre los dos valores, un punto por grupo en su color y cada cifra al costado exterior de su punto
#' (`cifras_par`). Con diferencia (brecha entre dos públicos, 86) la columna «Diferencia» a la derecha en azul
#' neutro; sin ella (puntos comparativos, 85) el eje ocupa ese ancho.
#' @keywords internal
.lam_laminas_pesas <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL, unidad_n = "respuestas",
                               layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); tenue <- .std_color("texto_tenue")
  con_dif <- isTRUE(espec$mostrar_diferencia); con_n <- any(is.finite(espec$n_fila))
  k <- length(espec$rotulos)
  xl <- ml + if (con_dif) 3.0 else 2.4; wl <- W - mr - xl - (if (con_dif) 2.4 else 1.0)
  yb <- yt + 0.75; fila <- (yf - yb - 0.6) / k
  lo <- espec$eje[["lo"]]; hi <- espec$eje[["hi"]]; paso <- espec$eje[["paso"]]
  px <- function(v) xl + wl * (v - lo) / (hi - lo)
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  for (v in seq(lo, hi, by = paso)) {
    .lam_caja(lz, px(v), yb, 0.006, k * fila, .std_color("filete"), nombre = "pesas:guia")
    .lam_txt(lz, paste0(format(v, trim = TRUE), "%"), px(v) - 0.35, yb - 0.3, 0.7, 0.24, 10, tenue, align = "center", nombre = "pesas:eje")
  }
  if (!is.null(espec$titulo_eje) && nzchar(espec$titulo_eje)) .lam_txt(lz, espec$titulo_eje, xl, yb - 0.58, 6, 0.26, 10, suave, bold = TRUE, nombre = "pesas:titulo_eje")
  if (con_dif && !is.null(espec$encabezado_diferencia) && nzchar(espec$encabezado_diferencia)) {
    .lam_txt(lz, espec$encabezado_diferencia, W - mr - 1.3, yb - 0.3, 1.3, 0.26, 10, suave, bold = TRUE, align = "center", nombre = "pesas:encabezado")
  }
  ca <- espec$colores[1]; cb <- espec$colores[2]; dp <- if (con_dif) 0.13 else 0.12; hs <- if (con_dif) 0.04 else 0.024
  for (i in seq_len(k)) {
    yc <- yb + (i - 0.5) * fila; a <- espec$a[i]; b <- espec$b[i]; wrot <- if (con_dif) 2.8 else 2.2
    if (con_n && is.finite(espec$n_fila[i])) {
      .lam_txt(lz, espec$rotulos[i], ml, yc - 0.27, wrot, 0.3, 13, azul, bold = TRUE, align = "right", nombre = "pesas:rotulo")
      .lam_txt(lz, sprintf("%s %s", format(round(espec$n_fila[i]), big.mark = ",", trim = TRUE), unidad_n), ml, yc + 0.02, wrot, 0.26, 10, tenue,
               align = "right", nombre = "pesas:casos")
    } else {
      .lam_txt(lz, espec$rotulos[i], ml, yc - 0.15, wrot, 0.3, 13, azul, bold = TRUE, align = "right", nombre = "pesas:rotulo")
    }
    .lam_caja(lz, px(min(a, b)), yc - hs / 2, max(0.01, px(max(a, b)) - px(min(a, b))), hs, tenue, nombre = "pesas:segmento")
    .lam_caja(lz, px(b) - dp, yc - dp, 2 * dp, 2 * dp, cb, nombre = "pesas:punto_b", geom = "ellipse")
    .lam_caja(lz, px(a) - dp, yc - dp, 2 * dp, 2 * dp, ca, nombre = "pesas:punto_a", geom = "ellipse")
    # cifras_par (recetario_piezas.R:138-143): cada cifra al costado exterior de su punto.
    mayor_a <- a >= b
    xa <- if (mayor_a) px(a) + 0.18 else px(a) - 0.18 - 0.7; xb <- if (mayor_a) px(b) - 0.18 - 0.7 else px(b) + 0.18
    .lam_txt(lz, espec$cifras_a[i], xa, yc - 0.16, 0.7, 0.3, 12, ca, bold = TRUE, align = if (mayor_a) "left" else "right", nombre = "pesas:cifra_a")
    .lam_txt(lz, espec$cifras_b[i], xb, yc - 0.16, 0.7, 0.3, 12, cb, bold = TRUE, align = if (mayor_a) "right" else "left", nombre = "pesas:cifra_b")
    if (con_dif) .lam_txt(lz, espec$textos_diferencia[i], W - mr - 1.3, yc - 0.15, 1.3, 0.3, 13, azul, bold = TRUE, align = "center", nombre = "pesas:diferencia")
  }
  .lam_leyenda(lz, yf - 0.3, espec$leyenda, espec$colores, centrar_en = xl + wl / 2)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:pesas")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' Lámina de una serie de dos mediciones (lámina 87, recetario_m3c.R:47-64)
#'
#' Dos verticales para los períodos y guías horizontales con su cifra; por serie, la pendiente en su color con
#' un punto en cada extremo, la primera cifra a la izquierda y, a la derecha, «Serie N%» con la diferencia en
#' puntos debajo, en coral.
#' @keywords internal
.lam_laminas_serie2 <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL, encabezado = NULL,
                                layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  azul <- .std_color("azul"); tenue <- .std_color("texto_tenue")
  x1 <- ml + 3.2; x2 <- W - mr - 3.6; yt_ <- yt + 0.6; hy <- yf - yt_ - 0.5
  lo <- espec$eje[["lo"]]; hi <- espec$eje[["hi"]]; paso <- espec$eje[["paso"]]
  py <- function(v) yt_ + hy * (hi - v) / (hi - lo)
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  for (v in seq(lo, hi, by = paso)) {
    .lam_caja(lz, x1, py(v), x2 - x1, 0.006, .std_color("filete"), nombre = "serie2:guia")
    .lam_txt(lz, paste0(format(v, trim = TRUE), "%"), x1 - 0.75, py(v) - 0.13, 0.6, 0.26, 10, tenue, align = "right", nombre = "serie2:eje")
  }
  for (k in 1:2) {
    xk <- if (k == 1) x1 else x2
    .lam_caja(lz, xk, yt_ - 0.05, 0.012, hy + 0.1, tenue, nombre = "serie2:periodo_linea")
    .lam_txt(lz, espec$periodos[k], xk - 0.5, yt_ + hy + 0.12, 1, 0.3, 14, azul, bold = TRUE, align = "center", nombre = "serie2:periodo")
  }
  if (!is.null(encabezado) && nzchar(encabezado)) .lam_txt(lz, encabezado, x1 - 0.75, yt_ - 0.45, 2, 0.26, 10, .std_color("texto_suave"), bold = TRUE,
                                                           nombre = "serie2:encabezado")
  for (i in seq_along(espec$series)) {
    col <- espec$colores[i]; a <- espec$v1[i]; b <- espec$v2[i]
    .lam_linea(lz, x1, py(a), x2, py(b), col, pt = 3, nombre = "serie2:pendiente")
    .lam_caja(lz, x1 - 0.13, py(a) - 0.13, 0.26, 0.26, col, nombre = "serie2:punto", geom = "ellipse")
    .lam_caja(lz, x2 - 0.13, py(b) - 0.13, 0.26, 0.26, col, nombre = "serie2:punto", geom = "ellipse")
    .lam_txt(lz, espec$cifras1[i], x1 - 1.55, py(a) - 0.16, 0.75, 0.32, 13, col, bold = TRUE, align = "right", nombre = "serie2:cifra_inicial")
    .lam_txt(lz, paste(espec$series[i], espec$cifras2[i]), x2 + 0.2, py(b) - 0.16, 2.6, 0.32, 13, col, bold = TRUE, nombre = "serie2:cifra_final")
    .lam_txt(lz, espec$textos_diferencia[i], x2 + 0.2, py(b) + 0.14, 2.6, 0.26, 11, .std_color("coral"), bold = TRUE, nombre = "serie2:diferencia")
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:serie2")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}
