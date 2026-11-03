# Lámina de pregunta filtro con uno o dos MAPAS dependientes: la forma V4 de la especificación aprobada de las láminas de
# variables geográficas (Gonzalo, 2026-11-03, «Maqueta de mapas dependientes», CCSS 2026).
#
# A la izquierda, una tarjeta de todo el alto con la pregunta filtro: por respuesta, el rótulo y «N (%)» en una línea y,
# debajo, una barra sobre una pista del 100 %, todas del mismo azul (también las respuestas sin mapa), sin llave, sin
# letras y sin avisos de base. A la derecha, uno o dos mapas (lamina_mapa_distribucion.R): con uno, una tarjeta ancha con
# el mapa, la leyenda debajo y la lista en todo el alto; con dos, dos tarjetas iguales. Encima de cada tarjeta, sólo su
# pregunta. Todas las bases van al pie, tal como las escribe el plan. El render es el de siempre
# (graficos_filtro_subpregunta.R); el Word pone cada pieza como su figura (reporte_word_filtro_sub.R).

#' ¿Es la espec el mapa de distribución (el dependiente que pide su propia lámina)?
#' @keywords internal
.lam_filtro_sub_es_mapa <- function(s) !is.null(s) && identical(s$tipo, "mapa") && identical(s$forma, "distribucion")

#' La tarjeta del filtro: por respuesta, rótulo y «N (%)» y una barra sobre el 100 %
#' @param n_base Base del filtro (los porcentajes son sobre ella). @keywords internal
.lam_filtro_mapa_tarjeta <- function(lz, f, n_base, x, y, w, h) {
  M <- .MAPA_DIST; P <- .LAM_MAPA_PX; azul <- M$blues5[5]
  .lam_caja(lz, x, y, w, h, "#FFFFFF", nombre = "filtro:tarjeta", borde = "#DDE1E7", borde_pt = 0.75)
  n <- suppressWarnings(as.numeric(.espec_casos(f))); n[!is.finite(n)] <- 0
  k <- length(f$rotulos); if (!k) return(invisible(lz))
  alto <- min(130 * P, (h - 60 * P) / k); bh <- (if (k >= 4) 14 else 18) * P
  yy <- y + 30 * P + max(0, (h - 60 * P - alto * k) / 2)
  xi <- x + 24 * P; wi <- w - 48 * P
  base <- if (is.finite(n_base) && n_base > 0) n_base else max(1, sum(n))
  for (j in seq_len(k)) {
    cifra <- paste0(format(as.integer(n[j]), big.mark = ","), " (", .mapa_dist_pct(n[j], base), ")")
    wc <- .lam_ancho_tinta(cifra, 10, TRUE) * 1.05 + 0.26   # con los 0.2 in de márgenes de la caja: no se parte
    # Un rótulo largo («Otra persona responsable o tutor/a (abuelo/a…)») baja su barra: nunca se monta sobre ella.
    h_lab <- max(0.27, .lam_alto_tinta(f$rotulos[j], wi - wc + 0.1, 10, TRUE))
    .lam_txt(lz, f$rotulos[j], xi - 0.1, yy, wi - wc + 0.1, h_lab, 10, M$texto, bold = TRUE, nombre = "filtro:rotulo")
    .lam_txt(lz, cifra, xi + wi - wc + 0.1, yy, wc, 0.27, 10, M$texto, bold = TRUE, align = "right", nombre = "filtro:cifra")
    .lam_caja(lz, xi, yy + h_lab + 0.02, wi, bh, M$pista, nombre = "filtro:pista")
    .lam_caja(lz, xi, yy + h_lab + 0.02, max(2 * P, wi * min(1, n[j] / base)), bh, azul, nombre = "filtro:barra")
    yy <- yy + alto
  }
  invisible(lz)
}

#' Lámina del filtro y sus mapas dependientes (uno o dos)
#' @keywords internal
.lam_laminas_filtro_mapa <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                     layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  g_ <- .std_geom; P <- .LAM_MAPA_PX
  ml <- g_("margen_izq"); ancho <- g_("ancho") - ml - g_("margen_der"); fr <- .lam_mapa_franja(); h <- fr$y1 - fr$y0
  wf <- ancho * 380 / 1490; xm <- ml + wf + 20 * P; wmz <- ml + ancho - xm
  mapas <- Filter(Negate(is.null), list(espec$sub, if (.lam_filtro_sub_es_mapa(espec$sub2)) espec$sub2))
  preguntas <- c(espec$pregunta_sub %||% "", espec$pregunta_sub2 %||% "")
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  .lam_mapa_pregunta(lz, espec$pregunta_filtro, ml, fr$y_preg, wf)
  .lam_filtro_mapa_tarjeta(lz, espec$filtro, espec$n_filtro, ml, fr$y0, wf, h)
  if (length(mapas) == 1L) {
    .lam_mapa_pregunta(lz, espec$sub$pregunta %||% preguntas[1], xm, fr$y_preg, wmz)
  } else {
    w2 <- (wmz - 22 * P) / 2
    for (i in 1:2) .lam_mapa_pregunta(lz, mapas[[i]]$pregunta %||% preguntas[i], xm + (i - 1) * (w2 + 22 * P), fr$y_preg, w2)
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:filtro_sub")
  if (length(mapas) == 1L) {
    doc <- .lam_mapa_dist_en_caja(doc, mapas[[1]], xm, fr$y0, wmz, h, modo = "ancho")
  } else {
    for (i in 1:2) doc <- .lam_mapa_dist_en_caja(doc, mapas[[i]], xm + (i - 1) * (w2 + 22 * P), fr$y0, w2, h, modo = "angosto")
  }
  # Todas las bases al pie, como las escribe el plan («Base: 400 … Mapas: 287 …; 106 …. Fuente: …»).
  pie <- if (!is.null(base) && nzchar(trimws(base))) sub("\\.?\\s*$", ".", trimws(base)) else .lam_filtro_sub_pie(base, espec)
  notas <- unique(unlist(lapply(mapas, function(m) m$nota_pie)))
  if (length(notas)) pie <- paste(pie, paste(notas, collapse = " "))
  doc <- .lam_pie(doc, pie, folio)
  list(doc = por_lamina(doc), partes = 1L)
}
