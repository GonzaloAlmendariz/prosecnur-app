# =============================================================================
# lamina_mapa_distribucion.R — la lámina del mapa de distribución (especificación aprobada, Gonzalo, 2026-11-03)
# =============================================================================
#
# «Especificación aprobada para el motor» (Maqueta de mapas dependientes, CCSS 2026): encima de cada tarjeta va sólo la
# pregunta, en una línea; la tarjeta usa el alto de la lámina. El mapa ocupa la parte izquierda de su tarjeta, con la
# leyenda debajo (bloques de clase, «Sin encuestados» y, si hay, el rayado de otra respuesta). La lista lleva por fila el
# nombre a la izquierda y «N (%)» en negrita a la derecha; debajo, una barra de 11 px del color de su clase sobre una pista
# del 100 %. Las filas se reparten en el alto (54 px como máximo) y la última, «Otros distritos (n)» u «Otras regiones (n)»,
# va en gris; si queda un solo elemento fuera, se muestra él. Sin título de ranking, sin notas grises y la base al pie.
# Medidas en px del lienzo de la maqueta (1600 × 900 para 13.333 × 7.5 in).

.LAM_MAPA_PX <- 13.333 / 1600

#' Geometría vertical de las tarjetas del mapa (in): dónde va la pregunta y de dónde a dónde la tarjeta
#' @keywords internal
.lam_mapa_franja <- function() {
  y0 <- .std_geom("zona_datos_y0") - 0.03; y1 <- .std_geom("contenido_y1") + 0.02
  list(y_preg = y0 - 0.3, y0 = y0, y1 = y1)
}

#' La pregunta encima de una tarjeta: en una línea, en negrita
#' @keywords internal
.lam_mapa_pregunta <- function(lz, texto, x, y, w) {
  if (is.null(texto) || !nzchar(texto)) return(invisible(lz))
  .lam_txt(lz, texto, x - 0.1, y, w + 0.2, 0.3, 11, .std_color("azul"), bold = TRUE, nombre = "mapa:pregunta")
}

#' ¿La leyenda va en dos filas? Cuando los bloques de clase no tienen al menos 0.5 in con los extras en la misma fila
#' @keywords internal
.lam_mapa_dist_leyenda_filas <- function(espec, w, pt = 8) {
  ex <- espec$leyenda_extras %||% data.frame(texto = "Sin encuestados", tipo = "vacio", stringsAsFactors = FALSE)
  w_ex <- pmax(0.75, .lam_ancho_tinta(ex$texto, pt) * 1.08 + 0.2)
  paso <- (w - sum(w_ex) - nrow(ex) * 10 * .LAM_MAPA_PX) / max(1L, length(espec$clases$colores))
  if (paso >= 0.5) 1L else 2L
}

#' Leyenda bajo el mapa: título, bloques de clase con su rango y los extras («Sin encuestados» y el rayado de cada otra
#' respuesta). Si los bloques no caben con los extras, los extras van en una segunda fila, centrados.
#' @param x,y,w Franja de la leyenda (in). @keywords internal
.lam_mapa_dist_leyenda <- function(lz, espec, x, y, w, pt = 8) {
  M <- .MAPA_DIST; P <- .LAM_MAPA_PX; cl <- espec$clases
  ex <- espec$leyenda_extras %||% data.frame(texto = "Sin encuestados", tipo = "vacio", stringsAsFactors = FALSE)
  if (is.null(ex$grupo)) ex$grupo <- NA_integer_
  .lam_txt(lz, espec$leyenda_titulo, x, y, w, 0.24, pt, "#3C4658", bold = TRUE, align = "center", nombre = "mapa:leyenda_titulo")
  n <- length(cl$colores)
  w_ex <- pmax(0.75, .lam_ancho_tinta(ex$texto, pt) * 1.08 + 0.2)
  hueco <- 10 * P
  dos <- .lam_mapa_dist_leyenda_filas(espec, w, pt) == 2L
  paso <- if (dos) w / n else (w - sum(w_ex) - nrow(ex) * hueco) / n
  yb <- y + 0.25; hb <- 0.16
  for (j in seq_len(n)) {
    xj <- x + (j - 1) * paso
    .lam_caja(lz, xj, yb, paso - 0.01, hb, cl$colores[j], nombre = "leyenda:clase")
    .lam_txt(lz, cl$rotulos[j], xj - 0.05, yb + hb + 0.02, paso + 0.1, 0.22, pt - 0.5, "#3C4658", align = "center", nombre = "leyenda:rango")
  }
  if (dos) { xe <- x + (w - sum(w_ex) - (nrow(ex) - 1) * hueco) / 2 - hueco; yb <- yb + hb + 0.27 } else xe <- x + n * paso
  for (j in seq_len(nrow(ex))) {
    xe <- xe + hueco
    otra <- identical(ex$tipo[j], "otra")
    .lam_caja(lz, xe, yb, w_ex[j], hb, if (otra) M$otra else M$vacio, nombre = if (otra) "leyenda:otra" else "leyenda:extra",
              borde = if (otra) M$otra else M$vacio_borde, borde_pt = 0.75)
    if (otra) .lam_mapa_dist_rayas_caja(lz, xe, yb, w_ex[j], hb, sentido = if (is.na(ex$grupo[j]) || ex$grupo[j] %% 2) 1 else -1)
    .lam_txt(lz, ex$texto[j], xe - 0.05, yb + hb + 0.02, w_ex[j] + 0.1, 0.22, pt - 0.5, "#3C4658", align = "center", nombre = "leyenda:texto")
    xe <- xe + w_ex[j]
  }
  invisible(lz)
}

#' Rayas a 45° dentro de una caja de la leyenda (la muestra del rayado de otra respuesta)
#' @keywords internal
.lam_mapa_dist_rayas_caja <- function(lz, x, y, w, h, paso = 0.06, sentido = 1) {
  for (c0 in seq(x - h, x + w, by = paso)) {
    # La raya sube 45° desde el borde inferior («/») o baja («\\»); se recorta a la caja.
    x1 <- max(x, c0); x2 <- min(x + w, c0 + h)
    if (x2 - x1 < 0.005) next
    if (sentido > 0) .lam_linea(lz, x1, y + h - (x1 - c0), x2, y + h - (x2 - c0), .MAPA_DIST$otra_raya, pt = 0.5, nombre = "leyenda:raya")
    else .lam_linea(lz, x1, y + (x1 - c0), x2, y + (x2 - c0), .MAPA_DIST$otra_raya, pt = 0.5, nombre = "leyenda:raya")
  }
  invisible(lz)
}

#' Las filas que caben en la lista y la fila «otros»: si queda una sola fuera, va ella; lo que no casa con el mapa y lo de
#' otra respuesta siempre van a «otros»
#' @return data.frame `nombre`, `cifra` («N (%)»), `frac` (largo de la barra sobre el 100 %), `color`, `otros` (lógico).
#' @keywords internal
.lam_mapa_dist_filas <- function(espec, cupo) {
  M <- .MAPA_DIST; li <- espec$lista; ex <- espec$extra %||% data.frame(nombre = character(0), n = integer(0))
  base <- max(1, espec$base)
  hay_extra <- nrow(ex) > 0
  cupo <- max(1L, cupo - (if (hay_extra) 1L else 0L))
  if (nrow(li) == cupo + 1L && !hay_extra) cupo <- cupo + 1L
  top <- utils::head(li, cupo); resto <- li[-seq_len(min(nrow(li), cupo)), , drop = FALSE]
  # `paste0` con un vector vacío devuelve « ()»: sin filas, la tabla sale vacía (un mapa sin encuestados).
  out <- data.frame(nombre = top$nombre, cifra = if (nrow(top)) paste0(top$valor, " (", top$pct, ")") else character(0),
                    frac = top$n / base, color = top$color, otros = rep(FALSE, nrow(top)), stringsAsFactors = FALSE)
  n_otros <- sum(resto$n) + sum(ex$n); k <- nrow(resto) + nrow(ex)
  if (k > 0) {
    out <- rbind(out, data.frame(nombre = sprintf("%s (%d)", espec$otros_rotulo %||% "Otros", k),
                                 cifra = paste0(n_otros, " (", .mapa_dist_pct(n_otros, base), ")"), frac = n_otros / base,
                                 color = M$otros_barra, otros = TRUE, stringsAsFactors = FALSE))
  }
  out
}

#' La lista del mapa: nombre y «N (%)» en una línea y, debajo, la barra sobre su pista
#' @keywords internal
.lam_mapa_dist_lista <- function(lz, espec, x, y, w, h, pt = 8.5) {
  M <- .MAPA_DIST; P <- .LAM_MAPA_PX
  cupo <- max(1L, floor(h / (44 * P)))
  f <- .lam_mapa_dist_filas(espec, cupo)
  # La letra se ajusta al ancho para que nombre y cifra quepan en una línea (lista angosta de dos mapas), hasta 7 pt.
  pide <- max(.lam_ancho_tinta(f$nombre, 1) + .lam_ancho_tinta(f$cifra, 1, TRUE) * 1.05)
  if (is.finite(pide) && pide > 0) pt <- max(7, min(pt, (w - 0.42) / pide))
  if (!nrow(f)) { .lam_txt(lz, "Ningún área tiene encuestados.", x, y, w, 0.3, pt, M$texto, nombre = "mapa:vacio"); return(invisible(lz)) }
  fila <- min(54 * P, h / nrow(f)); hb <- 11 * P
  for (k in seq_len(nrow(f))) {
    yk <- y + (k - 1) * fila
    col_t <- if (f$otros[k]) M$otros_texto else M$texto
    wc <- .lam_ancho_tinta(f$cifra[k], pt, TRUE) * 1.05 + 0.26   # con los 0.2 in de márgenes de la caja: no se parte
    .lam_txt(lz, f$nombre[k], x - 0.1, yk, w - wc + 0.15, 0.24, pt, col_t, nombre = if (f$otros[k]) "mapa:otros" else "mapa:distrito")
    .lam_txt(lz, f$cifra[k], x + w - wc + 0.1, yk, wc, 0.24, pt, col_t, bold = TRUE, align = "right", nombre = "mapa:valor")
    .lam_caja(lz, x, yk + 0.235, w, hb, M$pista, nombre = "mapa:barra_fondo")
    .lam_caja(lz, x, yk + 0.235, max(1.5 * P, w * min(1, f$frac[k])), hb, f$color[k], nombre = "mapa:barra")
  }
  invisible(lz)
}

#' El mapa de distribución en una tarjeta: el mapa a la izquierda, la leyenda debajo y la lista a la derecha
#'
#' `modo = "ancho"` (un mapa junto a su filtro): la leyenda va bajo el mapa y la lista usa todo el alto. `modo = "angosto"`
#' (dos mapas): la leyenda cruza la tarjeta y la lista termina encima de ella. Lo usan la lámina del filtro con sus mapas
#' (lamina_filtro_mapa.R) y, con `modo = "solo"`, la del mapa suelto (mapa y lista en tarjetas separadas).
#' @param x,y,w,h La tarjeta (in). @return `doc` con la tarjeta, el mapa, la leyenda y la lista.
#' @keywords internal
.lam_mapa_dist_en_caja <- function(doc, espec, x, y, w, h, modo = c("ancho", "angosto", "solo"), w_lista = NULL) {
  modo <- match.arg(modo); P <- .LAM_MAPA_PX
  if (identical(modo, "solo")) {
    wm <- w; xl <- x + w + 20 * P; wl <- w_lista %||% 4
  } else {
    wm <- w * (if (identical(modo, "ancho")) 600 / 1090 else 290 / 534); xl <- x + wm + (if (identical(modo, "ancho")) 30 else 17) * P
    wl <- x + w - xl - (if (identical(modo, "ancho")) 30 else 16) * P
  }
  ley_w <- if (identical(modo, "angosto")) w - 30 * P else wm - 30 * P
  h_ley <- if (.lam_mapa_dist_leyenda_filas(espec, ley_w) == 2L) 132 * P else 92 * P   # dos filas de leyenda: el mapa cede ese alto
  h_map <- h - h_ley
  lz <- .lam_lienzo()
  .lam_caja(lz, x, y, w, h, "#FFFFFF", nombre = "mapa:tarjeta", borde = "#DDE1E7", borde_pt = 0.75)
  if (identical(modo, "solo")) .lam_caja(lz, xl, y, wl, h, "#FFFFFF", nombre = "mapa:lista_tarjeta", borde = "#DDE1E7", borde_pt = 0.75)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:mapa:fondo")
  panel <- .mapa_dist_panel_gg(espec, wm - 2 * P, h_map - P, .mapa_dist_pt("lamina"))
  doc <- officer::ph_with(doc, rvg::dml(ggobj = panel, bg = "transparent", fonts = list(sans = .std_pt("fuente"))),
                          location = officer::ph_location(left = x + P, top = y + P, width = wm - 2 * P, height = h_map - P,
                                                          newlabel = "prosecnur:grafico:mapa"))
  lz <- .lam_lienzo()
  .lam_mapa_dist_leyenda(lz, espec, x + 15 * P, y + h_map + 10 * P, ley_w)
  y_l <- y + 18 * P
  h_l <- if (identical(modo, "angosto")) h_map - 30 * P else h - 42 * P
  if (identical(modo, "solo")) .lam_mapa_dist_lista(lz, espec, xl + 24 * P, y_l, wl - 48 * P, h_l)
  else .lam_mapa_dist_lista(lz, espec, xl, y_l, wl, h_l)
  .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:mapa:panel")
}

#' Lámina del mapa de distribución (V5 de la especificación): la pregunta, el mapa con su leyenda y, al lado, la lista
#' @keywords internal
.lam_laminas_mapa_distribucion <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                           layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; P <- .LAM_MAPA_PX
  ml <- g_("margen_izq"); ancho <- g_("ancho") - ml - g_("margen_der"); fr <- .lam_mapa_franja()
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  wm <- ancho * 860 / 1490
  if (!is.null(espec$pregunta) && nzchar(espec$pregunta)) {
    lz <- .lam_lienzo(); .lam_mapa_pregunta(lz, espec$pregunta, ml, fr$y_preg, ancho)
    doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:mapa:pregunta")
  }
  doc <- .lam_mapa_dist_en_caja(doc, espec, ml, fr$y0, wm, fr$y1 - fr$y0, modo = "solo", w_lista = ancho - wm - 20 * P)
  base <- paste(c(if (!is.null(base) && nzchar(base)) sub("\\.?\\s*$", ".", base), espec$nota_pie), collapse = " ")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}
