# =============================================================================
# lamina_mapa_distribucion.R — la lámina del mapa de distribución (diseño aprobado, lienzo «Maqueta de mapas», tableros 2–4)
# =============================================================================
#
# A la izquierda, una tarjeta blanca con el mapa (el panel de graficos_mapa_distribucion_dibujo.R, vectorial) y, en su
# propia franja debajo, la leyenda escalonada: bloques iguales con su rango debajo, «Sin encuestados» aparte con borde y,
# si lo hay, lo que va fuera de escala; centrada y a todo el ancho, sin tapar nunca el mapa. A la derecha, la tarjeta del
# ranking, del mismo alto: título, subtítulo, encabezado de columnas, filas repartidas en todo el alto con la barra del
# color de su clase y la cifra alineada a la derecha, y una nota al pie (lo que no entra, lo que queda fuera del mapa).
# Medidas en px del lienzo (1/96 in), como la maqueta.

.LAM_MAPA_DIST <- list(aire = 28, h_ley = 74, pad = 20, pad_x = 24, col_nombre = 140, col_valor = 92)

#' Cómo se reparte la leyenda escalonada en un ancho: bloques de clase iguales y, si no caben en la misma fila, los
#' extras («fuera de escala», «Sin encuestados») en una segunda fila
#' @return `list(filas, paso, extras, colores_extra, ancho_extra, alto)` (in).
#' @keywords internal
.lam_mapa_dist_leyenda_reparto <- function(espec, w, pt = 8.25) {
  P <- .MAPA_DIST_PX; M <- .MAPA_DIST; cl <- espec$clases
  extras <- c(if (!is.null(espec$fuera)) paste(espec$fuera$nombre, "(fuera de escala)"), "Sin encuestados")
  cols_extra <- c(if (!is.null(espec$fuera)) rep(M$fuera, nrow(espec$fuera)), M$vacio)
  ancho_extra <- vapply(extras, function(t) max(0.9, .lam_ancho_tinta(t, pt) * 1.08 + 0.3), 0)
  n <- length(cl$colores); util <- w - 48 * P
  paso_min <- max(.lam_ancho_tinta(cl$rotulos, pt)) * 1.08 + 0.3   # cada rango cabe en una línea bajo su bloque
  una <- n * paso_min + sum(ancho_extra) + length(extras) * 14 * P <= util
  paso <- if (una) (util - sum(ancho_extra) - length(extras) * 14 * P) / n else util / n
  list(filas = if (una) 1L else 2L, paso = paso, extras = extras, colores_extra = cols_extra, ancho_extra = ancho_extra,
       alto = if (una) 74 * P else 112 * P)
}

#' Leyenda escalonada bajo el mapa
#' @param x,y,w Franja de la leyenda (in). @keywords internal
.lam_mapa_dist_leyenda <- function(lz, espec, x, y, w) {
  P <- .MAPA_DIST_PX; M <- .MAPA_DIST
  r <- .lam_mapa_dist_leyenda_reparto(espec, w)
  .lam_caja(lz, x, y, w, 0.008, "#E3E6EB", nombre = "mapa:leyenda_filete")
  .lam_txt(lz, espec$leyenda_titulo, x, y + 8 * P, w, 0.24, 8.25, "#3C4658", bold = TRUE, align = "center", nombre = "mapa:leyenda_titulo")
  cl <- espec$clases; n <- length(cl$colores); paso <- r$paso
  x0 <- x + 24 * P; yb <- y + 30 * P
  for (j in seq_len(n)) {
    xj <- x0 + (j - 1) * paso
    .lam_caja(lz, xj + P, yb, paso - 2 * P, 12 * P, cl$colores[j], nombre = "leyenda:clase")
    .lam_txt(lz, cl$rotulos[j], xj - 0.05, yb + 14 * P, paso + 0.1, 0.24, 8.25, "#3C4658", align = "center", nombre = "leyenda:rango")
  }
  # En una fila, los extras siguen a los bloques; en dos, van centrados debajo.
  if (r$filas == 1L) { xe <- x0 + n * paso; ye <- yb } else {
    xe <- x + (w - sum(r$ancho_extra) - length(r$extras) * 14 * P) / 2; ye <- yb + 38 * P
  }
  for (j in seq_along(r$extras)) {
    xe <- xe + 14 * P
    vacio <- identical(r$colores_extra[j], M$vacio)
    .lam_caja(lz, xe, ye, r$ancho_extra[j], 12 * P, r$colores_extra[j], nombre = "leyenda:extra",
              borde = if (vacio) M$vacio_borde else r$colores_extra[j], borde_pt = 0.75)
    .lam_txt(lz, r$extras[j], xe - 0.05, ye + 14 * P, r$ancho_extra[j] + 0.1, 0.24, 8.25, "#3C4658", align = "center", nombre = "leyenda:texto")
    xe <- xe + r$ancho_extra[j]
  }
  invisible(lz)
}

#' Tarjeta del ranking: filas repartidas en todo el alto, barras del color de su clase, cifras a la derecha
#' @keywords internal
.lam_mapa_dist_ranking <- function(lz, espec, x, y, w, h) {
  P <- .MAPA_DIST_PX; R <- .LAM_MAPA_DIST; azul <- .MAPA_DIST$texto
  .lam_caja(lz, x, y, w, h, "#FFFFFF", nombre = "mapa:ranking_tarjeta", borde = "#DDE1E7", borde_pt = 0.75)
  xi <- x + R$pad_x * P; wi <- w - 2 * R$pad_x * P; yi <- y + R$pad * P
  .lam_txt(lz, espec$ranking_titulo, xi - 0.06, yi, wi, 0.3, 11.25, azul, bold = TRUE, nombre = "mapa:ranking_titulo")
  .lam_txt(lz, espec$ranking_sub, xi - 0.06, yi + 0.27, wi, 0.26, 9, .MAPA_DIST$gris, nombre = "mapa:ranking_sub")
  rk <- espec$ranking
  pt_val <- 9.4
  # Cada caja de texto pierde 0.1 in por lado (sus márgenes internos): sin sumarlos, «(16%)» se partía en dos líneas.
  w_det <- max(c(0, .lam_ancho_tinta(rk$detalle, pt_val))) * 1.08 + 0.22
  w_val <- max(c(0.3, .lam_ancho_tinta(rk$valor, pt_val, TRUE))) * 1.08 + 0.2
  col_valor <- max(R$col_valor * P, w_det + w_val + 0.1)
  col_nombre <- min(max(R$col_nombre * P, max(c(0, .lam_ancho_tinta(rk$nombre, pt_val))) * 1.08 + 0.25), wi * 0.45)
  yh <- yi + 0.62
  .lam_txt(lz, toupper(espec$ranking_columnas[1]), xi - 0.06, yh, col_nombre + 0.06, 0.24, 7.9, "#8A93A3", bold = TRUE, align = "right",
           nombre = "mapa:ranking_columna")
  .lam_txt(lz, toupper(espec$ranking_columnas[2]), xi + wi - col_valor, yh, col_valor + 0.06, 0.24, 7.9, "#8A93A3", bold = TRUE, align = "right",
           nombre = "mapa:ranking_columna")
  .lam_caja(lz, xi, yh + 0.26, wi, 0.008, "#D5D9E0", nombre = "mapa:ranking_filete")
  h_nota <- if (length(espec$notas)) 0.22 * length(espec$notas) + 0.12 else 0
  y0 <- yh + 0.32; y1 <- y + h - R$pad * P * 0.8 - h_nota
  n <- nrow(rk)
  if (!n) {
    .lam_txt(lz, "Ningún área tiene encuestados.", xi, y0, wi, 0.3, 10, azul, nombre = "mapa:vacio")
  }
  fila <- if (n) (y1 - y0) / n else 0
  x_bar <- xi + col_nombre + 12 * P; w_bar <- wi - col_nombre - col_valor - 24 * P
  for (k in seq_len(n)) {
    yk <- y0 + (k - 1) * fila; yc <- yk + fila / 2
    .lam_txt(lz, rk$nombre[k], xi - 0.06, yc - 0.13, col_nombre + 0.06, 0.26, pt_val, "#2A3448", align = "right", nombre = "mapa:distrito")
    hb <- min(16 * P, fila * 0.62)
    .lam_caja(lz, x_bar, yc - hb / 2, w_bar, hb, "#F1F3F6", nombre = "mapa:barra_fondo")
    if (rk$barra[k] > 0) .lam_caja(lz, x_bar, yc - hb / 2, max(0.01, w_bar * rk$barra[k]), hb, rk$color[k], nombre = "mapa:barra")
    .lam_txt(lz, rk$detalle[k], xi + wi - w_det + 0.06, yc - 0.13, w_det, 0.26, pt_val, .MAPA_DIST$gris, align = "right", nombre = "mapa:detalle")
    .lam_txt(lz, rk$valor[k], xi + wi - w_det - w_val + 0.16, yc - 0.13, w_val, 0.26, pt_val, azul, bold = TRUE, align = "right",
             nombre = "mapa:valor")
    if (k < n) .lam_caja(lz, xi, yk + fila, wi, 0.006, "#F0F2F5", nombre = "mapa:ranking_linea")
  }
  if (length(espec$notas)) .lam_txt(lz, paste(espec$notas, collapse = "\n"), xi - 0.06, y1 + 0.08, wi, h_nota, 8.6, .MAPA_DIST$gris,
                                    nombre = "mapa:ranking_nota")
  invisible(lz)
}

#' Lámina del mapa de distribución
#' @keywords internal
.lam_laminas_mapa_distribucion <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                           layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  P <- .MAPA_DIST_PX; R <- .LAM_MAPA_DIST; g_ <- .std_geom
  ml <- g_("margen_izq"); ancho <- g_("ancho") - ml - g_("margen_der"); yt <- g_("zona_datos_y0") - 0.1; yf <- g_("contenido_y1")
  h <- yf - yt
  # La tarjeta del mapa mide lo que su contenido pide (entre el 40 % y el 62 % del ancho): un ancho fijo dejaba franjas de
  # mar vacías a los lados («se ve raro el encuadre», Gonzalo, 2026-11-02). La leyenda decide su alto con ese ancho.
  wm <- min(0.62 * ancho, max(0.4 * ancho, .mapa_dist_ancho_natural(espec, h - R$h_ley * P - P, .mapa_dist_pt("lamina")) + 2 * P))
  h_ley <- .lam_mapa_dist_leyenda_reparto(espec, wm)$alto; h_map <- h - h_ley
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  .lam_caja(lz, ml, yt, wm, h, "#FFFFFF", nombre = "mapa:tarjeta", borde = "#DDE1E7", borde_pt = 0.75)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:mapa:fondo")
  panel <- .mapa_dist_panel_gg(espec, wm - 2 * P, h_map - P, .mapa_dist_pt("lamina"))
  doc <- officer::ph_with(doc, rvg::dml(ggobj = panel, bg = "transparent", fonts = list(sans = .std_pt("fuente"))),
                          location = officer::ph_location(left = ml + P, top = yt + P, width = wm - 2 * P, height = h_map - P,
                                                          newlabel = "prosecnur:grafico:mapa"))
  lz <- .lam_lienzo()
  .lam_mapa_dist_leyenda(lz, espec, ml, yt + h_map, wm)
  .lam_mapa_dist_ranking(lz, espec, ml + wm + R$aire * P, yt, ancho - wm - R$aire * P, h)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:mapa:panel")
  base <- paste(c(if (!is.null(base) && nzchar(base)) sub("\\.?\\s*$", ".", base), espec$nota_pie), collapse = " ")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}
