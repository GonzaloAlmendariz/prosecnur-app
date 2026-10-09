# =============================================================================
# lamina_dimensiones.R — mapas de calor y comparativo de dimensiones, nativos (ADR 0093, N5)
# =============================================================================
#
# Portados de recetario_m3d.R: una sola escala de azul en cinco tramos que se
# ajusta al rango de los datos (del múltiplo de 5 bajo el mínimo al de encima del
# máximo), el texto de cada celda en el color que contrasta con su tramo y, bajo
# cada cifra, su diferencia con el total en puntos.

#' Tramo de color de un valor en la escala de cinco tramos (recetario_m3d.R:24)
#' @keywords internal
.lam_calor <- function(v, lo, hi) {
  tramos <- unlist(.std_paleta("calor")$tramos)
  tramos[pmin(5L, pmax(1L, floor((v - lo) / (hi - lo) * 5) + 1L))]
}

#' Celda del mapa de calor: tramo, cifra y, si hay referencia y alto, la diferencia debajo (recetario_m3d.R:25-30)
#' @keywords internal
.lam_celda_calor <- function(lz, x, y, w, h, v, lo, hi, ref = NULL, v_color = v, sufijo = "%") {
  if (!is.finite(v)) {
    .lam_caja(lz, x + 0.02, y + 0.02, w - 0.04, h - 0.04, .std_color("cebra"), nombre = "calor:celda")
    .lam_txt(lz, "—", x, y + (h - 0.3) / 2, w, 0.3, 12, .std_color("texto_tenue"), align = "center", nombre = "calor:cifra")
    return(invisible(lz))
  }
  col <- .lam_calor(v_color, lo, hi); tc <- .lam_texto_sobre(col)
  .lam_caja(lz, x + 0.02, y + 0.02, w - 0.04, h - 0.04, col, nombre = "calor:celda")
  if (is.null(ref) || !is.finite(ref) || h < 0.6) {
    .lam_txt(lz, paste0(v, sufijo), x, y + (h - 0.3) / 2, w, 0.3, 12, tc, bold = TRUE, align = "center", nombre = "calor:cifra")
  } else {
    dd <- v - ref
    .lam_txt(lz, paste0(v, sufijo), x, y + h / 2 - 0.3, w, 0.3, 13, tc, bold = TRUE, align = "center", nombre = "calor:cifra")
    .lam_txt(lz, if (dd == 0) "=" else sprintf("%+d", as.integer(dd)), x, y + h / 2, w, 0.26, 10, tc, align = "center", nombre = "calor:diferencia")
  }
  invisible(lz)
}

#' Escala de cinco tramos con sus cortes debajo, centrada (recetario_m3d.R:31-37)
#' @keywords internal
.lam_escala_calor <- function(lz, centro, y, lo, hi, w = 3.6, rotulo = "Top Two Box", sufijo = "%") {
  tramos <- unlist(.std_paleta("calor")$tramos); suave <- .std_color("texto_suave")
  wr <- .lam_ancho_tinta(rotulo, 11, TRUE) + 0.3; tot <- wr + w; x <- centro - tot / 2
  .lam_txt(lz, rotulo, x - 0.1, y - 0.04, wr + 0.2, 0.3, 11, suave, bold = TRUE, nombre = "calor:escala_rotulo"); x <- x + wr
  cortes <- round(seq(lo, hi, length.out = 6))
  for (i in 1:5) .lam_caja(lz, x + (i - 1) * w / 5, y, w / 5 - 0.03, 0.2, tramos[i], nombre = "calor:escala_tramo")
  for (i in 1:6) .lam_txt(lz, paste0(cortes[i], sufijo), x + (i - 1) * w / 5 - 0.35, y + 0.22, 0.7, 0.26, 10, suave, align = "center", nombre = "calor:escala_corte")
  invisible(lz)
}

#' Lámina de un mapa de calor por dimensión (lámina 92, recetario_m3d.R:43-60)
#'
#' Columna Total y grupos del cruce con su encabezado de bloque; bajo cada nombre de columna sus casos (con
#' «*» si son menos de 15); filetes azules separan el Total y los bloques; la escala va centrada debajo.
#' @param rotulo_escala Rótulo de la escala («Top Two Box» o el índice que se muestre).
#' @keywords internal
.lam_laminas_heatmap_dim <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL, rotulo_escala = "Índice",
                                     layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); tenue <- .std_color("texto_tenue")
  V <- espec$valores; nf <- nrow(V); nc <- ncol(V); C <- espec$columnas
  xl <- ml + 2.9; wc <- (W - mr - xl) / nc; y0 <- yt + 0.85
  hc <- min(0.95, (yf - y0 - 1.0) / nf)
  lo <- espec$rango[1]; hi <- espec$rango[2]
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  chica <- is.finite(C$n) & C$n < 15
  for (j in seq_len(nc)) {
    .lam_txt(lz, sub(" ciclo$", "", C$rotulo[j]), xl + (j - 1) * wc, y0 - 0.58, wc, 0.26, 11, azul, bold = TRUE, align = "center", nombre = "calor:columna")
    if (is.finite(C$n[j])) .lam_txt(lz, paste0(format(round(C$n[j]), big.mark = ",", trim = TRUE), if (chica[j]) "*" else ""), xl + (j - 1) * wc, y0 - 0.33, wc, 0.24, 10,
                                    tenue, align = "center", nombre = "calor:casos")
  }
  for (b in espec$bloques) {
    .lam_txt(lz, b$titulo, xl + (min(b$cols) - 1) * wc, y0 - 0.86, length(b$cols) * wc, 0.26, 10, suave, bold = TRUE, align = "center", nombre = "calor:bloque")
  }
  for (i in seq_len(nf)) {
    yi <- y0 + (i - 1) * hc
    hf <- .lam_alto_tinta(espec$filas[i], 2.75, 13, TRUE)
    .lam_txt(lz, espec$filas[i], ml, yi + (hc - hf) / 2, 2.75, hf, 13, azul, bold = TRUE, align = "right", nombre = "calor:fila")
    for (j in seq_len(nc)) {
      ref <- if (!is.na(espec$col_total) && j != espec$col_total) V[i, espec$col_total] else NULL
      .lam_celda_calor(lz, xl + (j - 1) * wc, yi, wc, hc, V[i, j], lo, hi, ref, v_color = (espec$valores_crudos %||% V)[i, j])
    }
  }
  # Filetes azules tras la columna Total y entre bloques de grupos.
  cortes <- c(if (!is.na(espec$col_total)) espec$col_total, vapply(espec$bloques, function(b) max(b$cols), 0))
  for (k in setdiff(unique(cortes), nc)) .lam_caja(lz, xl + k * wc - 0.01, y0 - 0.1, 0.02, nf * hc + 0.1, azul, nombre = "calor:filete")
  .lam_escala_calor(lz, xl + nc * wc / 2, y0 + nf * hc + 0.45, lo, hi, rotulo = rotulo_escala)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:heatmap_dim")
  # El pie del recetario explica el asterisco y la cifra de abajo (recetario_m3d.R, pie de la lámina 92).
  notas <- c(if (any(chica)) "* Menos de 15 casos.",
             if (!is.na(espec$col_total) && nc > 1L && hc >= 0.6) "Debajo de cada cifra, la diferencia con el total en puntos")
  partes <- c(if (!is.null(base) && nzchar(trimws(base))) (if (length(notas)) sub("\\.?\\s*$", ".", trimws(base)) else trimws(base)), notas)
  base <- if (length(partes)) paste(partes, collapse = " ") else base
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' Lámina del comparativo de dimensiones entre dos grupos (lámina 94, recetario_m3d.R:79-98)
#'
#' Por dimensión, dos barras desde 0 (azul y azul medio) con su cifra al final del eje, guías finas cada 25 %,
#' la diferencia en 20 pt en su columna a la derecha y la leyenda arriba con la base de cada grupo.
#' @keywords internal
.lam_laminas_comparativo_dim <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                         layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  azul <- .std_color("azul"); suave <- .std_color("texto_suave")
  V <- espec$valores; nf <- nrow(V)
  xl <- ml + 3.1; xd <- W - mr - 2.3; wl <- xd - xl - 1.2; y0 <- yt + 0.75; bloque <- (yf - y0 - 0.35) / nf; gb <- 0.3
  px <- function(v) xl + wl * v / 100; cols <- c(azul, .std_color("azul_medio"))
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  ley <- ifelse(is.finite(espec$n), sprintf("%s (%s)", espec$grupos, format(round(espec$n), big.mark = ",", trim = TRUE)), espec$grupos)
  .lam_leyenda(lz, yt + 0.05, ley, cols, centrar_en = xl + wl / 2)
  .lam_txt(lz, "Diferencia", xd, yt + 0.05, W - mr - xd, 0.3, 12, suave, bold = TRUE, align = "center", nombre = "comparativo:encabezado")
  for (v in seq(0, 100, 25)) .lam_caja(lz, px(v) - 0.004, y0, 0.008, nf * bloque, if (v == 0) suave else .std_color("filete"), nombre = "comparativo:guia")
  for (i in seq_len(nf)) {
    yi <- y0 + (i - 1) * bloque; yc <- yi + bloque / 2
    if (i > 1) .lam_separador_h(lz, ml, xl - 0.1, yi)
    .lam_txt(lz, espec$filas[i], ml, yc - 0.17, 2.95, .lam_alto_txt(espec$filas[i], 2.95, 14, TRUE), 14, azul, bold = TRUE, align = "right", nombre = "comparativo:fila")
    for (k in 1:2) {
      yb <- yc - gb - 0.05 + (k - 1) * (gb + 0.1); v <- V[i, k]; vc <- (espec$valores_crudos %||% V)[i, k]   # la barra mide el valor
      if (is.finite(vc) && vc > 0) .lam_caja(lz, xl, yb, px(vc) - xl, gb, cols[k], nombre = "comparativo:barra")
      .lam_txt(lz, if (is.finite(v)) paste0(v, "%") else "—", xl + wl + 0.1, yb + (gb - 0.3) / 2, 0.9, 0.3, 14, azul, bold = TRUE, nombre = "comparativo:cifra")
    }
    .lam_txt(lz, espec$textos_diferencia[i], xd, yc - 0.2, W - mr - xd, 0.4, 20, azul, bold = TRUE, align = "center", nombre = "comparativo:diferencia")
  }
  .lam_separador_v(lz, xd - 0.15, yt, yf - 0.3)
  for (v in seq(0, 100, 25)) .lam_txt(lz, paste0(v, "%"), px(v) - 0.35, yf - 0.3, 0.7, 0.24, 10, suave, align = "center", nombre = "comparativo:eje")
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:comparativo_dim")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' ¿El mapa de calor o el comparativo caben en su lámina nativa? Si no, ruta anterior
#'
#' Mapa: hasta 9 columnas y 8 filas, rótulos de fila en dos líneas a 13 pt dentro de 2.75 in, nombres de columna
#' en su ancho. Comparativo: hasta 6 dimensiones con rótulos en dos líneas dentro de 2.95 in.
#' @keywords internal
.lam_dimensiones_cabe <- function(espec) {
  g_ <- .std_geom; W <- g_("ancho"); ml <- g_("margen_izq"); mr <- g_("margen_der")
  dos <- function(t, w, size) all(vapply(t, function(x) .lam_lineas(x, w, size, TRUE) <= 2L, TRUE))
  if (identical(espec$tipo, "heatmap_criterios")) return(.lam_heatmap_criterios_cabe(espec))
  if (identical(espec$tipo, "heatmap_dim")) {
    nc <- ncol(espec$valores); nf <- nrow(espec$valores); wc <- (W - mr - ml - 2.9) / max(1L, nc)
    hc <- min(0.95, (g_("contenido_y1") - g_("zona_datos_y0") - 0.85 - 1.0) / max(1L, nf))
    return(nc >= 1L && nc <= 9L && nf %in% 1:8 && all(is.finite(espec$rango)) && espec$rango[2] > espec$rango[1] &&
             dos(espec$filas, 2.75, 13) && all(.lam_alto_tinta(espec$filas, 2.75, 13, TRUE) <= hc) &&
             all(.lam_ancho_txt(sub(" ciclo$", "", espec$columnas$rotulo), 11, TRUE) <= wc - 0.05))
  }
  if (identical(espec$tipo, "comparativo_dim")) {
    # La leyenda (con la base de cada grupo) debe caber sobre las barras, sin entrar en la columna «Diferencia».
    ley <- ifelse(is.finite(espec$n), sprintf("%s (%s)", espec$grupos, format(round(espec$n), big.mark = ",", trim = TRUE)), espec$grupos)
    wl <- (W - mr - 2.3) - (ml + 3.1) - 1.2
    return(nrow(espec$valores) %in% 1:6 && dos(espec$filas, 2.95, 14) && all(is.finite(espec$valores)) &&
             sum(0.22 + .lam_ancho_tinta(ley, .std_pt("leyenda"))) + 0.3 * (length(ley) - 1) <= wl)
  }
  FALSE
}
