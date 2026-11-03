# Lámina de pregunta filtro con un MAPA dependiente (Gonzalo, 2026-11-03: «¿y qué pasa cuando hay gráficos de mapa
# dependientes? ¿no debería haber una forma para ellos también?»). En el Perfil CCSS 2026 la subpregunta «¿en qué otra
# región del Perú?» iba en dos láminas: el filtro con la subpregunta en barras y, a continuación, el mapa, cuyo ranking
# repetía esas barras. Aquí van en una: a la izquierda el filtro en barras (p194), con las que habilitan en azul y una
# llave que las abraza; a la derecha el enunciado de la subpregunta con su base y, debajo, el mapa con su leyenda y su
# ranking (lamina_mapa_distribucion.R). El render es el de siempre (graficos_filtro_subpregunta.R): el dependiente es un
# `p_mapa_distribucion` con la base de quienes lo habilitan. El Word lo pone como dos figuras (reporte_word_filtro_sub.R).

#' Ancho (in) de la columna del filtro junto a un mapa dependiente: lo justo para sus barras, el mapa se queda el resto
#' @keywords internal
.LAM_FILTRO_MAPA_COL <- 3.3

#' ¿Es la espec el mapa de distribución (el dependiente que pide su propia lámina)?
#' @keywords internal
.lam_filtro_sub_es_mapa <- function(s) !is.null(s) && identical(s$tipo, "mapa") && identical(s$forma, "distribucion")

#' Lámina del filtro y su mapa dependiente
#' @keywords internal
.lam_laminas_filtro_mapa <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                     layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1"); ancho <- W - ml - mr
  azul <- .std_color("azul"); tenue <- .std_color("tenue")
  f <- espec$filtro
  col <- .LAM_FILTRO_MAPA_COL; gap <- 0.55; xr <- ml + col + gap; wr <- ancho - col - gap
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  y0 <- .lam_panel_titulo(lz, ml, yt, col, espec$pregunta_filtro) + 0.25
  # El filtro en barras, las que habilitan en azul y el resto tenue, repartidas en todo el alto; la llave las abraza y
  # llega al enunciado de la subpregunta, sobre el mapa.
  f2 <- f; f2$realce <- FALSE
  f2$colores <- stats::setNames(ifelse(f$rotulos %in% espec$habilita, azul, tenue), f$rotulos)
  k <- max(1L, length(f$rotulos)); fila <- min(.LAM_FILTRO_SUB_FILA_MAX, (yf - y0 - 0.3) / k); g <- min(0.36, fila * 0.6)
  .lam_barras_h(lz, f2, ml, y0, col - 0.45, wlab = min(1.7, col * 0.5), g = g, fila = fila, size = 11)
  hab <- which(f$rotulos %in% espec$habilita)
  if (length(hab)) {
    .lam_llave_a_titulo(lz, ml + col - 0.35, y0 + (min(hab) - 1) * fila + (fila - g) / 2,
                        y0 + (max(hab) - 1) * fila + (fila + g) / 2, xr, yt)
  }
  ys <- .lam_panel_titulo(lz, xr, yt, wr, espec$pregunta_sub, if (isTRUE(espec$base_en_titulo)) NULL else .lam_filtro_sub_base(espec)) + 0.12
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:filtro_sub")
  doc <- .lam_mapa_dist_en_caja(doc, espec$sub, xr, ys, wr, yf - ys)
  pie <- .lam_filtro_sub_pie(base, espec)
  if (length(espec$sub$nota_pie)) pie <- paste(pie, espec$sub$nota_pie)
  doc <- .lam_pie(doc, pie, folio)
  list(doc = por_lamina(doc), partes = 1L)
}
