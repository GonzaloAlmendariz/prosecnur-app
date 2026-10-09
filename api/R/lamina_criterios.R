# =============================================================================
# lamina_criterios.R — lámina 93 del recetario: cada criterio dentro de su dimensión (ADR 0093, N5)
# =============================================================================
#
# recetario_m3d.R:61-77: la columna de públicos empieza en 5.4 in; cada dimensión lleva una barra azul de 0.05 in a su
# izquierda y su nombre en gris; los criterios a la derecha en negrita; filas de (zona − 1.3) / filas in desde 0.75 bajo
# la zona de datos; un filete al cerrar cada dimensión y la escala de cinco tramos centrada debajo.

.LAM_CRIT <- list(x_col = 5.4, x_dim = 0.15, w_dim = 2.3, x_crit = 2.5, w_crit = 2.75, y0 = 0.75, resto = 1.3)

#' Geometría de la 93
#' @keywords internal
.lam_criterios_geo <- function(espec) {
  R <- .LAM_CRIT; g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  nf <- length(espec$filas); nc <- nrow(espec$columnas)
  xl <- ml + R$x_col; wc <- (W - mr - xl - 0.1) / nc
  list(ml = ml, xl = xl, wc = wc, y0 = yt + R$y0, hc = min(0.6, (yf - yt - R$resto) / nf), nf = nf, nc = nc)
}

#' Lámina 93: mapa de calor por criterio, agrupado por dimensión y con una columna por público
#' @keywords internal
.lam_laminas_heatmap_criterios <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                           layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  R <- .LAM_CRIT; G <- .lam_criterios_geo(espec)
  azul <- .std_color("azul"); suave <- .std_color("texto_suave")
  V <- espec$valores; C <- espec$columnas; lo <- espec$rango[1]; hi <- espec$rango[2]
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  for (j in seq_len(G$nc)) {
    rot <- if (is.finite(C$n[j])) sprintf("%s (%s)", C$rotulo[j], format(round(C$n[j]), big.mark = ",", trim = TRUE)) else C$rotulo[j]
    .lam_txt(lz, rot, G$xl + (j - 1) * G$wc, G$y0 - 0.35, G$wc, 0.26, 11, azul, bold = TRUE, align = "center", nombre = "calor:columna")
  }
  for (b in espec$bloques) {
    ytop <- G$y0 + (min(b$filas) - 1) * G$hc; hb <- length(b$filas) * G$hc
    .lam_caja(lz, G$ml, ytop + 0.04, 0.05, hb - 0.08, azul, nombre = "calor:dimension_barra")
    hd <- .lam_alto_tinta(b$titulo, R$w_dim, 11, TRUE)
    .lam_txt(lz, b$titulo, G$ml + R$x_dim, ytop + (hb - hd) / 2, R$w_dim, hd, 11, suave, bold = TRUE, nombre = "calor:dimension")
    for (i in b$filas) {
      yi <- G$y0 + (i - 1) * G$hc
      .lam_txt(lz, espec$filas[i], G$ml + R$x_crit, yi + (G$hc - 0.28) / 2, R$w_crit, 0.28, 11.5, azul, bold = TRUE, align = "right", nombre = "calor:fila")
      for (j in seq_len(G$nc)) .lam_celda_calor(lz, G$xl + (j - 1) * G$wc, yi, G$wc, G$hc, V[i, j], lo, hi, v_color = espec$valores_crudos[i, j], sufijo = espec$sufijo)
    }
    .lam_separador_h(lz, G$ml, G$xl + G$nc * G$wc, G$y0 + max(b$filas) * G$hc)
  }
  .lam_escala_calor(lz, G$xl + G$nc * G$wc / 2, G$y0 + G$nf * G$hc + 0.2, lo, hi, rotulo = espec$rotulo_escala, sufijo = espec$sufijo)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:heatmap_criterios")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' ¿La 93 cabe? Filas de al menos 0.33 in, criterios en una línea, dimensiones en dos y públicos en su columna
#' @keywords internal
.lam_heatmap_criterios_cabe <- function(espec) {
  if (is.null(espec) || !identical(espec$tipo, "heatmap_criterios")) return(FALSE)
  G <- .lam_criterios_geo(espec); R <- .LAM_CRIT
  rot <- ifelse(is.finite(espec$columnas$n), sprintf("%s (%s)", espec$columnas$rotulo, format(round(espec$columnas$n), big.mark = ",", trim = TRUE)), espec$columnas$rotulo)
  G$nc >= 1L && G$nc <= 5L && G$hc >= 0.33 && all(is.finite(espec$rango)) && espec$rango[2] > espec$rango[1] &&
    all(.lam_ancho_tinta(espec$filas, 11.5, TRUE) <= R$w_crit - 0.15) &&
    all(vapply(espec$bloques, function(b) .lam_lineas_tinta(b$titulo, R$w_dim, 11, TRUE) <= min(2L, max(1L, floor(length(b$filas) * G$hc / 0.2))), TRUE)) &&
    all(.lam_ancho_tinta(rot, 11, TRUE) <= G$wc - 0.05)
}
