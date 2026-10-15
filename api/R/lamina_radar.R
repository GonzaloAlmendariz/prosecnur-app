# =============================================================================
# lamina_radar.R — el radar con tabla de la lámina 90 (ADR 0093, N6)
# =============================================================================
#
# El recetario dibuja el radar con ggplot (recetario_m3c.R:75-93) y todo lo demás
# nativo: antetítulo y título, la leyenda centrada bajo el radar y la tabla de
# PowerPoint al lado, con la cebra y los filetes de `tabla_ttb()`
# (recetario.R:719-730). El radar sólo va en la lámina de un gráfico.
#
# Medidas del recetario: radar en (margen, zona + 0.2) de 6.6 × 4.5 in; leyenda a
# 0.3 in del fin del contenido, centrada en margen + 3.3; tabla en x = 7.25,
# y = zona + 0.6, filas de 0.5 in, primera columna de 2.2 in.

.LAM_RADAR <- list(ancho = 6.6, alto = 4.5, dy = 0.2, x_tabla = 7.25, dy_tabla = 0.6, fila = 0.5, fila_min = 0.4,
                   col1 = 2.2, col = 1.15)

#' El ggplot del radar del recetario, desde la espec
#' @keywords internal
.lam_radar_gg <- function(espec) {
  K <- length(espec$ejes); lo <- espec$lo
  ang <- pi / 2 - 2 * pi * (seq_len(K) - 1) / K                  # desde arriba, en el sentido del reloj
  rr <- function(v) (v - lo) / (100 - lo)
  fuente <- .std_pt("fuente")
  ring <- do.call(rbind, lapply(espec$anillos, function(v) data.frame(r = v, x = rr(v) * cos(c(ang, ang[1])), y = rr(v) * sin(c(ang, ang[1])))))
  serie <- do.call(rbind, lapply(espec$grupos, function(a) {
    v <- pmax(lo, 100 * espec$valores[, a])
    data.frame(a = a, x = rr(v) * cos(ang), y = rr(v) * sin(ang))
  }))
  serie$a <- factor(serie$a, levels = espec$grupos)
  # La línea de cada serie es un trazo cerrado, no un polígono: una serie entera en el piso colapsa en el centro y
  # `rvg` revienta en C_polygon con un polígono degenerado (segfault medido por el verificador de N6). La serie que no
  # tiene extensión se queda sólo con sus puntos.
  con_area <- vapply(split(serie, serie$a), function(s0) diff(range(s0$x)) > 1e-6 || diff(range(s0$y)) > 1e-6, TRUE)
  trazo <- do.call(rbind, lapply(split(serie, serie$a)[con_area], function(s0) rbind(s0, s0[1, ])))
  labr <- data.frame(t = espec$ejes, x = 1.2 * cos(ang), y = 1.12 * sin(ang), h = ifelse(abs(cos(ang)) < 0.1, 0.5, ifelse(cos(ang) > 0, 0, 1)))
  # Las cifras de los anillos, entre los dos primeros ejes y con fondo: no pisan el rótulo del eje de arriba.
  mid <- (ang[1] + ang[2]) / 2; half <- (ang[1] - ang[2]) / 2
  niv <- data.frame(v = espec$anillos)
  niv$x <- rr(niv$v) * cos(mid) * cos(half) + 0.02; niv$y <- rr(niv$v) * sin(mid) * cos(half); niv$t <- paste0(niv$v, "%")
  ggplot2::ggplot() +
    ggplot2::geom_path(data = ring, ggplot2::aes(.data$x, .data$y, group = .data$r), colour = .std_color("anillo_radar"), linewidth = 0.4) +
    (if (!is.null(trazo) && nrow(trazo)) ggplot2::geom_path(data = trazo, ggplot2::aes(.data$x, .data$y, group = .data$a, colour = .data$a),
                                                             linewidth = 1.1, linejoin = "round")) +
    ggplot2::geom_point(data = serie, ggplot2::aes(.data$x, .data$y, colour = .data$a), size = 2.4) +
    ggplot2::geom_text(data = labr, ggplot2::aes(.data$x, .data$y, label = .data$t, hjust = .data$h), size = 12 / ggplot2::.pt,
                       colour = .std_color("azul"), family = fuente, fontface = "bold") +
    ggplot2::geom_label(data = niv, ggplot2::aes(.data$x, .data$y, label = .data$t), hjust = 0, vjust = 0.5, size = 10 / ggplot2::.pt,
                        colour = .std_color("texto_suave"), family = fuente, fill = .std_color("fondo"), label.size = 0,
                        label.padding = grid::unit(0.06, "lines")) +
    ggplot2::scale_colour_manual(values = espec$colores) +
    ggplot2::coord_equal(xlim = c(-2.15, 2.15), ylim = c(-1.25, 1.25), clip = "off") +
    ggplot2::theme_void() + ggplot2::theme(legend.position = "none")
}

#' Anchos de la tabla: 2.2 in la primera columna y cada grupo lo que pida su encabezado (mínimo 1.15 in)
#' @keywords internal
.lam_radar_anchos <- function(espec) {
  R <- .LAM_RADAR
  c(R$col1, pmax(R$col, .lam_ancho_tinta(espec$grupos, 11, TRUE) + 0.25))
}

#' Alto de fila de la tabla: 0.5 in, o menos (hasta 0.4) si no caben todas
#' @keywords internal
.lam_radar_fila <- function(espec) {
  R <- .LAM_RADAR; disp <- .std_geom("contenido_y1") - (.std_geom("zona_datos_y0") + R$dy_tabla)
  min(R$fila, disp / (length(espec$ejes) + 1))
}

#' Líneas que pide el eje más largo en la primera columna de la tabla (13 pt en negrita)
#'
#' Una, si todos caben en el ancho útil de la columna (como en la tabla del recetario); si no, las del corte por palabras.
#' @keywords internal
.lam_radar_lineas <- function(espec) {
  R <- .LAM_RADAR
  if (all(.lam_ancho_tinta(espec$ejes, 13, TRUE) <= R$col1 - 0.2)) return(1L)
  max(.lam_lineas_tinta(espec$ejes, R$col1, 13, TRUE))
}

#' Altos de la tabla: encabezado y filas del cuerpo
#'
#' Con ejes de una línea, las filas del recetario (`.lam_radar_fila`). Si un eje pide dos líneas en la primera columna, el
#' encabezado queda en 0.5 in y cada fila del cuerpo toma el alto de dos líneas de 13 pt con el relleno de 6 pt de la
#' celda (lámina 69 de acrconta_mazo, «Aprendizaje autónomo e investigación»): la tabla conserva su posición, columnas y
#' cuerpos de letra.
#' @keywords internal
.lam_radar_filas <- function(espec) {
  R <- .LAM_RADAR; n <- .lam_radar_lineas(espec)
  if (n <= 1L) { f <- .lam_radar_fila(espec); return(list(cabecera = f, cuerpo = f, lineas = n)) }
  list(cabecera = R$fila, cuerpo = max(R$fila, round(n * 13 * 1.2 / 72 + 2 * 6 / 72, 2)), lineas = n)
}

#' La tabla del recetario (`tabla_ttb`): encabezado azul con filete, primera columna en negrita y cebra
#' @keywords internal
.lam_tabla_ttb <- function(doc, d, x, y, ws, rowh, rowh_cuerpo = rowh, nombre = NULL) {
  azul <- .std_color("azul"); fuente <- .std_pt("fuente")
  ft <- flextable::flextable(d)
  ft <- flextable::font(ft, fontname = fuente, part = "all")
  ft <- flextable::fontsize(ft, size = 13, part = "body"); ft <- flextable::fontsize(ft, size = 11, part = "header")
  ft <- flextable::color(ft, color = azul, part = "all"); ft <- flextable::bold(ft, part = "header"); ft <- flextable::bold(ft, j = 1, part = "body")
  ft <- flextable::align(ft, j = seq(2, ncol(d)), align = "center", part = "all"); ft <- flextable::valign(ft, valign = "center", part = "all")
  ft <- flextable::border_remove(ft); ft <- flextable::bg(ft, bg = "transparent", part = "header")
  if (nrow(d) >= 2) ft <- flextable::bg(ft, i = seq(2, nrow(d), 2), bg = .std_color("cebra"), part = "body")
  ft <- flextable::hline_bottom(ft, border = officer::fp_border(color = azul, width = 1.25), part = "header")
  ft <- flextable::hline_bottom(ft, border = officer::fp_border(color = .std_color("filete"), width = 0.75), part = "body")
  ft <- flextable::padding(ft, padding = 6, part = "all"); ft <- flextable::width(ft, width = ws)
  ft <- flextable::height(ft, height = rowh, part = "header"); ft <- flextable::height(ft, height = rowh_cuerpo, part = "body")
  ft <- flextable::hrule(ft, rule = "exact", part = "header"); ft <- flextable::hrule(ft, rule = "exact", part = "body")
  loc <- officer::ph_location(left = x, top = y, width = sum(ws),
                              height = if (identical(rowh_cuerpo, rowh)) rowh * (nrow(d) + 1) else rowh + rowh_cuerpo * nrow(d))
  if (!is.null(nombre)) loc$ph_label <- nombre   # la tabla sola (lámina 197/225) se nombra como pieza del motor
  officer::ph_with(doc, ft, location = loc)
}

#' Lámina del radar con tabla (90)
#' @keywords internal
.lam_laminas_radar <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                               layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  R <- .LAM_RADAR; g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  doc <- officer::add_slide(doc, layout = layout, master = master)
  arriba <- .lam_leyenda_va_arriba(espec$grupos)   # G4: la leyenda sube al antetítulo
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub, leyenda = if (arriba) espec$colores)
  # Sin tabla, el radar y su leyenda se centran en la lámina.
  x_radar <- if (isTRUE(espec$con_tabla)) ml else W / 2 - R$ancho / 2
  doc <- officer::ph_with(doc, rvg::dml(ggobj = .lam_radar_gg(espec), bg = "transparent", fonts = list(sans = .std_pt("fuente"))),
                          location = officer::ph_location(left = x_radar, top = yt + R$dy, width = R$ancho, height = R$alto,
                                                          newlabel = "prosecnur:grafico:radar"))
  lz <- .lam_lienzo()
  # Una serie única sintética («Total») no lleva leyenda, como en `graficar_radar()`.
  sintetica <- length(espec$grupos) == 1L && trimws(tolower(espec$grupos[1])) %in% c("total", "")
  if (!sintetica && !arriba) .lam_leyenda(lz, yf - 0.3, espec$grupos, unname(espec$colores), centrar_en = x_radar + R$ancho / 2)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:radar:leyenda")
  if (isTRUE(espec$con_tabla)) {
    d <- data.frame(espec$ejes, espec$cifras, check.names = FALSE, stringsAsFactors = FALSE)
    names(d) <- c(espec$encabezado, espec$grupos)
    f <- .lam_radar_filas(espec)
    doc <- .lam_tabla_ttb(doc, d, R$x_tabla, yt + R$dy_tabla, .lam_radar_anchos(espec), f$cabecera, f$cuerpo)
  }
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' ¿El radar cabe en la lámina del recetario?
#'
#' De 3 a 8 ejes, cada rótulo de lado (12 pt) entre su punta y la tabla o el margen —el recetario deja «Costos y
#' presupuestos» llegar justo al borde de la tabla— y el de arriba y el de abajo en el ancho del radar; con
#' tabla, sus columnas caben a la derecha, los ejes caben en una línea de la primera columna y las filas no bajan de
#' 0.4 in —o, si un eje pide dos líneas, la tabla con filas de dos líneas termina sobre el pie del contenido—; sin
#' tabla, hasta seis series. Lo que no cabe sigue por la ruta anterior.
#' @keywords internal
.lam_radar_cabe <- function(espec) {
  R <- .LAM_RADAR; K <- length(espec$ejes); k <- length(espec$grupos)
  if (K < 3L || K > 8L || k < 1L || k > 6L) return(FALSE)
  ang <- pi / 2 - 2 * pi * (seq_len(K) - 1) / K; de_lado <- abs(cos(ang)) >= 0.1
  tinta <- .lam_ancho_tinta(espec$ejes, 12, TRUE)
  g_ <- .std_geom; W <- g_("ancho")
  x0 <- if (isTRUE(espec$con_tabla)) g_("margen_izq") else W / 2 - R$ancho / 2
  unidad <- min(R$ancho / 4.3, R$alto / 2.5); xc <- x0 + R$ancho / 2       # coord_equal en ±2.15 × ±1.25
  punta <- xc + 1.2 * cos(ang) * unidad
  tope_der <- if (isTRUE(espec$con_tabla)) R$x_tabla else W - g_("margen_der")
  disp <- ifelse(cos(ang) > 0, tope_der - punta, punta - g_("margen_izq_borde"))
  if (any(tinta[de_lado] > disp[de_lado]) || any(tinta[!de_lado] > R$ancho - 1)) return(FALSE)
  if (!isTRUE(espec$con_tabla)) return(TRUE)
  fin <- .std_geom("ancho") - .std_geom("margen_der")
  if (R$x_tabla + sum(.lam_radar_anchos(espec)) > fin + 0.01) return(FALSE)
  f <- .lam_radar_filas(espec)
  if (f$lineas <= 1L) return(f$cuerpo >= R$fila_min)
  # Ejes de dos líneas: la tabla con sus filas más altas termina sobre el pie del contenido (tres líneas, no).
  f$lineas <= 2L && .std_geom("zona_datos_y0") + R$dy_tabla + f$cabecera + f$cuerpo * K <= .std_geom("contenido_y1") + 0.01
}
