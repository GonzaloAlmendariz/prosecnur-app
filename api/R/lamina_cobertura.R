# =============================================================================
# lamina_cobertura.R — cobertura y participación con formas nativas (ADR 0135, punto 6)
# =============================================================================
#
# Página 2 del resumen de Arte y Diseño FG 2026 (`cobertura/1`, graficador_cobertura.R). A la izquierda, una fila por
# público: la cifra grande de casos en el color del público, el público en negrita y «de 327» debajo; luego las filas
# extra, sin barra. A la derecha, por público, dos barras sobre una línea de base: la tasa de respuesta (azul del
# estándar) y la meta de la propuesta (gris), cada una con su cifra al extremo; la leyenda arriba. Sin padrón no hay
# tasa: la fila sólo lleva la cifra.

.COBERTURA_FILAS_MAX <- 7L

#' Geometría de la lámina: columna de cifras, rótulos de las barras y área de barras
#' @keywords internal
.lam_cobertura_geom <- function(espec) {
  g_ <- .std_geom; ml <- g_("margen_izq"); fin <- g_("ancho") - g_("margen_der")
  pb <- espec$publicos; ex <- espec$extras
  filas <- nrow(pb) + nrow(ex)
  cifras <- c(pb$texto_casos, ex$cifra)
  wc <- max(.lam_ancho_tinta(cifras, 40, TRUE)) + 0.25
  zona0 <- g_("zona_datos_y0") + 0.1; zona1 <- g_("contenido_y1") - 0.35
  h <- min(1.15, (zona1 - zona0) / max(1L, filas))
  y0 <- zona0 + max(0, (zona1 - zona0) - h * filas) / 2
  xt <- ml + wc + 0.1
  wizq <- if (isTRUE(espec$con_barras)) 4.4 else fin - xt
  rot <- if (nrow(pb)) max(.lam_ancho_tinta(pb$publico, 13, FALSE)) + 0.3 else 0
  xr <- ml + wc + 0.1 + 0.1 + max(3.0, wizq - wc) + 0.4   # inicio de los rótulos de las barras
  xb <- xr + rot + 0.1                                      # línea de base de las barras
  list(ml = ml, fin = fin, wc = wc, xt = xt, h = h, y0 = y0, filas = filas, xr = xr, wrot = rot, xb = xb,
       wb = fin - 0.7 - xb, g = min(0.34, h * 0.32))
}

#' ¿La lámina cabe? Hasta siete filas y el área de barras con al menos 3 in
#' @keywords internal
.lam_cobertura_cabe <- function(espec) {
  if (!identical(espec$tipo, "cobertura")) return(FALSE)
  if (.lam_es_cobcat(espec)) return(.lam_cobcat_cabe(espec))   # ADR 0140: por categorías (lamina_cobertura_categorias.R)
  ge <- .lam_cobertura_geom(espec)
  ge$filas >= 1L && ge$filas <= .COBERTURA_FILAS_MAX && (!isTRUE(espec$con_barras) || ge$wb >= 3)
}

#' Lámina de cobertura y participación (`cobertura/1`)
#' @keywords internal
.lam_laminas_cobertura <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                   layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  if (.lam_es_cobcat(espec)) {   # ADR 0140: por categorías (lamina_cobertura_categorias.R)
    return(.lam_laminas_cobcat(doc, espec, titulo, ante = ante, base = base, folio = folio, sub = sub, layout = layout,
                               master = master, por_lamina = por_lamina))
  }
  force(folio)
  azul <- .std_color("azul"); suave <- .std_color("texto_suave")
  ge <- .lam_cobertura_geom(espec); pb <- espec$publicos; ex <- espec$extras
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  fila <- function(cifra, color, rotulo, detalle, i) {
    yc <- ge$y0 + (i - 0.5) * ge$h
    .lam_txt(lz, cifra, ge$ml - 0.1, yc - 0.42, ge$wc + 0.1, 0.8, 40, color, bold = TRUE, nombre = "cobertura:cifra")
    w <- if (isTRUE(espec$con_barras)) ge$xr - ge$xt - 0.3 else ge$fin - ge$xt
    con_detalle <- nzchar(detalle)
    .lam_txt(lz, rotulo, ge$xt, yc - (if (con_detalle) 0.3 else 0.16), w, 0.32, 14, azul, bold = TRUE, nombre = "cobertura:rotulo")
    if (con_detalle) .lam_txt(lz, detalle, ge$xt, yc - 0.02, w, 0.3, 13, suave, nombre = "cobertura:detalle")
    yc
  }
  centros <- numeric(nrow(pb))
  for (i in seq_len(nrow(pb))) centros[i] <- fila(pb$texto_casos[i], pb$color[i], pb$rotulo[i], pb$texto_padron[i], i)
  for (j in seq_len(nrow(ex))) fila(ex$cifra[j], azul, ex$rotulo[j], ex$detalle[j], nrow(pb) + j)
  if (isTRUE(espec$con_barras) && nrow(pb)) {
    # Leyenda arriba del área de barras, con las series que hay.
    x <- ge$xb; yl <- ge$y0 - 0.3
    for (k in names(espec$leyenda)) {
      .lam_caja(lz, x, yl + 0.09, 0.14, 0.14, espec$colores[[k]], nombre = "leyenda:cuadro")
      .lam_txt(lz, espec$leyenda[[k]], x + 0.12, yl, .lam_ancho_tinta(espec$leyenda[[k]], 11, FALSE) + 0.3, 0.3, 11, azul, nombre = "leyenda:texto")
      x <- x + 0.12 + .lam_ancho_tinta(espec$leyenda[[k]], 11, FALSE) + 0.5
    }
    .lam_caja(lz, ge$xb - 0.01, ge$y0 + 0.05, 0.015, ge$h * nrow(pb) - 0.1, .std_color("texto_tenue"), nombre = "cobertura:base_barras")
    for (i in seq_len(nrow(pb))) {
      yc <- centros[i]
      .lam_txt(lz, pb$publico[i], ge$xr, .lam_y_centrada(yc, 13), ge$wrot, 0.32, 13, azul, align = "right", nombre = "cobertura:publico")
      series <- list(tasa = list(v = pb$tasa[i], t = pb$texto_tasa[i], y = yc - ge$g - 0.02),
                     meta = list(v = pb$meta[i], t = pb$texto_meta[i], y = yc + 0.02))
      for (k in names(series)) {
        s <- series[[k]]
        if (!is.finite(s$v)) next
        lb <- max(0.01, ge$wb * min(100, max(0, s$v)) / 100)
        .lam_caja(lz, ge$xb, s$y, lb, ge$g, espec$colores[[k]], nombre = paste0("cobertura:barra_", k), borde = NA)
        .lam_txt(lz, s$t, ge$xb + lb + 0.02, s$y + ge$g / 2 - 0.15, 0.7, 0.3, 10.5, suave, nombre = "cobertura:valor")
      }
    }
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:cobertura")
  doc <- .lam_pie(doc, .lam_unir_base(base), folio)
  list(doc = por_lamina(doc), partes = 1L)
}
