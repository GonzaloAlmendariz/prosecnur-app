# =============================================================================
# lamina_mapa.R — los mapas de cobertura del recetario (láminas 103, 105 y 106; ADR 0093, N6)
# =============================================================================
#
# El recetario dibuja el mapa con ggplot (geom_sf con tema vacío) y todo lo demás
# nativo (recetario_m3e.R:117-270): el mapa conserva su proporción y queda arriba
# a la izquierda; a 0.4 in de su caja va un filete vertical y, a la derecha, el
# panel —la cifra de zonas con su detalle, o la lista de distritos por grupo—, la
# narrativa de la lámina y la leyenda, cuyo pie coincide con el del mapa dibujado.

.LAM_MAPA <- list(ancho_distrito = 7.4, ancho_manzanas = 7.6, ancho_general = 6.2, aire = 0.8, cifra_pt = 36, texto_pt = 12.5,
                  # La 105 con su recuadro (recetario_m3e.R:222-242): recuadro de 2.6 × 3.0 bajo su rótulo, 0.3 de aire,
                  # el mapa de 6.3 y 0.6 hasta el panel, con el filete a 0.3 del panel.
                  recuadro_w = 2.6, recuadro_h = 3.0, recuadro_aire = 0.3, ancho_con_recuadro = 6.3, aire_con_recuadro = 0.6)

#' El ggplot del mapa, desde la espec
#' @keywords internal
.lam_mapa_gg <- function(espec) {
  cj <- espec$caja
  g <- ggplot2::ggplot()
  for (capa in espec$capas) {
    g <- g + if (isTRUE(capa$sin_relleno)) {   # contornos de zona de la 106
      ggplot2::geom_polygon(data = capa$datos, ggplot2::aes(.data$x, .data$y, group = .data$group), fill = NA, colour = capa$borde, linewidth = capa$grosor)
    } else {
      ggplot2::geom_polygon(data = capa$datos, ggplot2::aes(.data$x, .data$y, group = .data$group, fill = .data$fill),
                            colour = capa$borde, linewidth = capa$grosor)
    }
  }
  g + ggplot2::scale_fill_identity() +
    ggplot2::coord_quickmap(xlim = cj[c("xmin", "xmax")], ylim = cj[c("ymin", "ymax")], expand = FALSE) +
    ggplot2::theme_void() +
    ggplot2::theme(plot.background = ggplot2::element_blank(), panel.background = ggplot2::element_blank())
}

#' El rectángulo que el mapa ocupa de verdad en su caja: conserva la proporción, arriba y centrado en el ancho
#' (rect_mapa del recetario)
#' @keywords internal
.lam_mapa_rect <- function(espec, x, y, w, h) {
  cj <- espec$caja; lat <- mean(cj[c("ymin", "ymax")]) * pi / 180
  asp <- unname((cj[["ymax"]] - cj[["ymin"]]) / ((cj[["xmax"]] - cj[["xmin"]]) * cos(lat)))
  wd <- min(w, h / asp); hd <- wd * asp
  list(x = x + (w - wd) / 2, y = y, w = wd, h = hd)
}

#' Leyenda vertical del panel: su pie coincide con el del mapa (leyenda_mapa del recetario)
#' @keywords internal
.lam_mapa_leyenda <- function(lz, x, y_fin, leyenda, w) {
  n <- length(leyenda$rotulos); y0 <- y_fin - (0.32 + n * 0.3)
  .lam_txt(lz, leyenda$titulo, x - 0.06, y0, w, 0.26, 10, .std_color("texto_suave"), bold = TRUE, nombre = "mapa:leyenda_titulo")
  for (k in seq_len(n)) {
    yk <- y0 + 0.32 + (k - 1) * 0.3; col <- leyenda$colores[k]
    claro <- toupper(col) %in% toupper(c("#FFFFFF", .std_color("mapa_fuera")))
    .lam_caja(lz, x, yk + 0.06, 0.16, 0.16, col, nombre = "leyenda:cuadro", borde = if (claro) .std_color("mapa_borde") else col, borde_pt = 0.5)
    .lam_txt(lz, leyenda$rotulos[k], x + 0.2, yk, w - 0.24, 0.28, 11, .std_color("azul"), nombre = "leyenda:texto")
  }
  invisible(y0)
}

#' Geometría de la lámina del mapa: dónde va el dibujo, el panel y hasta dónde llega lo de arriba del panel
#' @keywords internal
.lam_mapa_geo <- function(espec, texto = NULL) {
  R <- .LAM_MAPA; g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  con_recuadro <- identical(espec$forma, "distrito") && !is.null(espec$ubicacion)
  if (con_recuadro) {
    rec <- .lam_mapa_rect(espec$ubicacion, ml, yt + 0.4, R$recuadro_w, R$recuadro_h)
    xm <- ml + R$recuadro_w + R$recuadro_aire; wm <- R$ancho_con_recuadro
    r <- .lam_mapa_rect(espec, xm, yt, wm, yf - yt - 0.1)
    xr <- xm + wm + R$aire_con_recuadro; x_filete <- xr - 0.3
  } else {
    rec <- NULL; wm <- if (identical(espec$forma, "general")) R$ancho_general else if (isTRUE(espec$manzanas)) R$ancho_manzanas else R$ancho_distrito
    r <- .lam_mapa_rect(espec, ml, yt, wm, yf - yt - 0.1)
    # La 106 (recetario_m3e.R:256-258): 0.7 hasta el panel y el filete a 0.35.
    xr <- ml + wm + (if (isTRUE(espec$manzanas)) 0.7 else R$aire); x_filete <- xr - (if (isTRUE(espec$manzanas)) 0.35 else 0.4)
  }
  wr <- W - g_("margen_der") - xr
  y_ley <- r$y + r$h - (0.32 + length(espec$leyenda$rotulos) * 0.3)
  # Cada bloque de la lista: encabezado 0.42, filas de 0.34 y el total de 0.35; entre bloques, 0.35 de aire. Si con
  # una narrativa arriba no cabe hasta la leyenda, la lista se compacta (encabezado 0.38, filas de 0.28, aire 0.25).
  lista <- function(enc, fila, aire) yt + sum(vapply(espec$grupos, function(gk) enc + nrow(gk$filas) * fila + 0.35, 0)) + aire * (length(espec$grupos) - 1L)
  paso <- list(enc = 0.42, fila = 0.34, aire = 0.35)
  if (identical(espec$forma, "general") && lista(0.42, 0.34, 0.35) > y_ley - 0.15) paso <- list(enc = 0.38, fila = 0.28, aire = 0.25)
  fin_panel <- if (identical(espec$forma, "general")) lista(paso$enc, paso$fila, paso$aire) else if (!is.null(espec$cifra2)) yt + 1.65 + 1.2 else yt + 1.45
  h_texto <- if (!is.null(texto) && nzchar(texto)) .lam_alto_tinta(texto, wr + 0.1, R$texto_pt) else 0
  list(ml = ml, yt = yt, yf = yf, wm = wm, r = r, rec = rec, xr = xr, x_filete = x_filete, wr = wr, y_ley = y_ley,
       fin_panel = fin_panel, h_texto = h_texto, y_texto = fin_panel + 0.2, paso = paso)
}

#' Lámina del mapa de cobertura (103 la general; 105 y 106 la de distrito)
#' @param texto Narrativa de la lámina, que va en el panel bajo la cifra o la lista.
#' @keywords internal
.lam_laminas_mapa <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL, texto = NULL,
                              layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  if (identical(espec$forma, "resultado")) return(.lam_laminas_mapa_resultado(doc, espec, titulo, ante, base, folio, sub, layout, master, por_lamina))
  R <- .LAM_MAPA; G <- .lam_mapa_geo(espec, texto); azul <- .std_color("azul"); suave <- .std_color("texto_suave")
  fin <- .std_geom("ancho") - .std_geom("margen_der")
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  doc <- officer::ph_with(doc, rvg::dml(ggobj = .lam_mapa_gg(espec), bg = "transparent", fonts = list(sans = .std_pt("fuente"))),
                          location = officer::ph_location(left = G$r$x, top = G$r$y, width = G$r$w, height = G$r$h, newlabel = "prosecnur:grafico:mapa"))
  if (!is.null(G$rec)) {
    doc <- officer::ph_with(doc, rvg::dml(ggobj = .lam_mapa_gg(espec$ubicacion), bg = "transparent", fonts = list(sans = .std_pt("fuente"))),
                            location = officer::ph_location(left = G$rec$x, top = G$rec$y, width = G$rec$w, height = G$rec$h, newlabel = "prosecnur:grafico:mapa:ubicacion"))
  }
  lz <- .lam_lienzo()
  if (!is.null(G$rec)) .lam_txt(lz, "Ubicación en Lima", G$ml, G$yt, .LAM_MAPA$recuadro_w, 0.3, 11, suave, bold = TRUE, align = "center", nombre = "mapa:ubicacion_rotulo")
  .lam_separador_v(lz, G$x_filete, G$yt, G$yf - 0.1)
  if (identical(espec$forma, "general")) {
    yk <- G$yt
    for (gk in espec$grupos) {
      .lam_caja(lz, G$xr, yk + 0.08, 0.2, 0.2, gk$color, nombre = "mapa:grupo_color")
      .lam_txt(lz, gk$titulo, G$xr + 0.3, yk, G$wr - 0.3 - max(1.1, .lam_ancho_tinta(espec$encabezado, 10, TRUE) + 0.25), 0.34, 14, azul, bold = TRUE, nombre = "mapa:grupo")
      we <- max(1.1, .lam_ancho_tinta(espec$encabezado, 10, TRUE) + 0.25)   # en una línea: «Zonas efectivas» se partía
      .lam_txt(lz, espec$encabezado, fin - we, yk + 0.04, we, 0.28, 10, suave, bold = TRUE, align = "right", nombre = "mapa:encabezado")
      for (j in seq_len(nrow(gk$filas))) {
        yj <- yk + G$paso$enc + (j - 1) * G$paso$fila
        .lam_txt(lz, gk$filas$distrito[j], G$xr + 0.3, yj, G$wr - 1.4, 0.3, 12.5, azul, nombre = "mapa:distrito")
        .lam_txt(lz, format(gk$filas$valor[j], big.mark = ","), fin - 1.1, yj, 1.1, 0.3, .std_pt("cifra"), azul, bold = TRUE, align = "right", nombre = "mapa:valor")
      }
      yt_ <- yk + G$paso$enc + nrow(gk$filas) * G$paso$fila
      .lam_separador_h(lz, G$xr + 0.3, fin, yt_ + 0.02)
      .lam_txt(lz, "Total", G$xr + 0.3, yt_ + 0.05, 1.5, 0.3, 12.5, azul, bold = TRUE, nombre = "mapa:total")
      .lam_txt(lz, format(gk$total, big.mark = ","), fin - 1.1, yt_ + 0.05, 1.1, 0.3, .std_pt("cifra"), azul, bold = TRUE, align = "right", nombre = "mapa:total_valor")
      yk <- yt_ + 0.35 + G$paso$aire
    }
  } else {
    c0 <- espec$cifra
    .lam_txt(lz, c0$valor, G$xr, G$yt, G$wr, 0.62, R$cifra_pt, azul, bold = TRUE, nombre = "mapa:cifra")
    .lam_txt(lz, c0$rotulo, G$xr, G$yt + 0.62, G$wr, 0.3, 12, azul, bold = TRUE, nombre = "mapa:cifra_rotulo")
    .lam_txt(lz, c0$detalle, G$xr, G$yt + 0.9, G$wr, 0.26, 10, suave, nombre = "mapa:cifra_detalle")
    .lam_separador_h(lz, G$xr, fin, G$yt + 1.45)
    if (!is.null(espec$cifra2)) {   # la 106: las manzanas aplicadas bajo las zonas
      c2 <- espec$cifra2; y2 <- G$yt + 1.65
      .lam_txt(lz, c2$valor, G$xr, y2, G$wr, 0.62, R$cifra_pt, azul, bold = TRUE, nombre = "mapa:cifra2")
      .lam_txt(lz, c2$rotulo, G$xr, y2 + 0.62, G$wr, 0.3, 12, azul, bold = TRUE, nombre = "mapa:cifra2_rotulo")
      .lam_txt(lz, c2$detalle, G$xr, y2 + 0.9, G$wr, 0.26, 10, suave, nombre = "mapa:cifra2_detalle")
    }
  }
  if (G$h_texto > 0) .lam_txt(lz, texto, G$xr - 0.1, G$y_texto, G$wr + 0.1, G$h_texto, R$texto_pt, azul, nombre = "mapa:narrativa")
  .lam_mapa_leyenda(lz, G$xr, G$r$y + G$r$h, espec$leyenda, G$wr)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:mapa:panel")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' ¿El mapa cabe en la lámina del recetario? El panel (cifra o lista) y la narrativa terminan antes de la leyenda
#' @keywords internal
.lam_mapa_cabe <- function(espec, texto = NULL) {
  if (is.null(espec) || !length(espec$capas) || !all(is.finite(espec$caja))) return(FALSE)
  if (identical(espec$forma, "resultado")) return((is.null(texto) || !nzchar(texto)) && .lam_mapa_resultado_cabe(espec))   # la 104 no lleva narrativa
  G <- .lam_mapa_geo(espec, texto)
  fin_arriba <- if (G$h_texto > 0) G$y_texto + G$h_texto else G$fin_panel
  G$wr >= 2.5 && G$r$h >= 2.5 && fin_arriba <= G$y_ley - 0.15 &&
    (!identical(espec$forma, "general") || all(.lam_ancho_tinta(unlist(lapply(espec$grupos, function(gk) gk$filas$distrito)), 12.5) <= G$wr - 1.5))
}
