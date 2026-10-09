# =============================================================================
# lamina_mapa_resultado.R — lámina 104 del recetario: resultado por distrito en el mapa de Lima (ADR 0093)
# =============================================================================
#
# recetario_m3e.R:201-216: el mapa de Lima y Callao en una caja de 4.6 in, alineado a la derecha; la leyenda de clases
# queda en el mar, abajo a la izquierda, con su pie en el del mapa; a 0.35 in del filete, el panel con el indicador y
# los distritos de mayor a menor (filas de 0.33 in desde 0.62 bajo el panel), cada uno con su barra del color de su
# clase y la cifra en negrita.
#
# El recetario muestra doce distritos. Un estudio de Lima suele tener más, y la lámina no puede quedarse sin sus cifras
# (verificador, ronda 14): hasta 13 distritos, una columna con barras; hasta 26, dos columnas con barras; con más, una
# lista en tres columnas con el cuadro del color de su clase y la cifra, que alcanza para Lima y Callao enteros.

.LAM_MAPA_RES <- list(ancho_mapa = 4.6, aire = 0.7, fila = 0.33, inicio = 0.62, w_nombre = 2.35, x_barra = 2.45, resto = 2.9,
                      max_una = 13L, max_dos = 26L, fila_lista = 0.25)

#' Forma del ranking según cuántos distritos hay: «una», «dos» (columnas con barras) o «lista» (tres columnas)
#' @keywords internal
.lam_mapa_resultado_forma <- function(n) {
  R <- .LAM_MAPA_RES
  if (n <= R$max_una) "una" else if (n <= R$max_dos) "dos" else "lista"
}

#' Geometría de la lámina 104
#' @keywords internal
.lam_mapa_resultado_geo <- function(espec) {
  R <- .LAM_MAPA_RES; g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  r <- .lam_mapa_rect(espec, ml, yt, R$ancho_mapa, yf - yt - 0.1)
  r$x <- ml + R$ancho_mapa - r$w   # alineado a la derecha de su caja
  xr <- ml + R$ancho_mapa + R$aire; fin <- W - g_("margen_der")
  n <- nrow(espec$ranking); forma <- .lam_mapa_resultado_forma(n)
  ncol <- c(una = 1L, dos = 2L, lista = 3L)[[forma]]; por_col <- max(1L, ceiling(n / ncol))
  fila <- if (identical(forma, "lista")) R$fila_lista else R$fila
  wcol <- (fin - xr - (ncol - 1L) * 0.3) / ncol
  # En una columna, las medidas del recetario; en dos, el nombre y la barra se reparten el ancho de su columna.
  w_nombre <- switch(forma, una = R$w_nombre, dos = min(R$w_nombre, wcol * 0.52), lista = wcol - 0.63)
  list(ml = ml, yt = yt, yf = yf, r = r, xr = xr, fin = fin, wr = fin - xr, w_ley = max(1.75, r$x - ml), forma = forma,
       ncol = ncol, por_col = por_col, fila = fila, wcol = wcol, w_nombre = w_nombre,
       pt = if (identical(forma, "lista")) 9 else if (identical(forma, "dos")) 10 else 11,
       y_ult = yt + R$inicio + (por_col - 1L) * fila + 0.28)
}

#' Lámina 104: mapa por clases, leyenda y ranking de distritos
#' @keywords internal
.lam_laminas_mapa_resultado <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                        layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  R <- .LAM_MAPA_RES; G <- .lam_mapa_resultado_geo(espec); azul <- .std_color("azul")
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  doc <- officer::ph_with(doc, rvg::dml(ggobj = .lam_mapa_gg(espec), bg = "transparent", fonts = list(sans = .std_pt("fuente"))),
                          location = officer::ph_location(left = G$r$x, top = G$r$y, width = G$r$w, height = G$r$h, newlabel = "prosecnur:grafico:mapa"))
  lz <- .lam_lienzo()
  .lam_mapa_leyenda(lz, G$ml, G$r$y + G$r$h, espec$leyenda, G$w_ley)
  .lam_separador_v(lz, G$xr - 0.35, G$yt, G$yf - 0.1)
  .lam_panel_titulo(lz, G$xr, G$yt, G$wr, espec$panel$titulo, espec$panel$sub)
  if (!nrow(espec$ranking)) {   # el vacío se dice dentro de la lámina, con el mapa y su leyenda en pie
    .lam_txt(lz, "Ningún distrito llega a los casos mínimos para mostrar su resultado.", G$xr, G$yt + R$inicio, G$wr, 0.6, 12.5, azul, nombre = "mapa:vacio")
  }
  for (k in seq_len(nrow(espec$ranking))) {
    f <- espec$ranking[k, ]; col <- (k - 1L) %/% G$por_col; fi <- (k - 1L) %% G$por_col
    x0 <- G$xr + col * (G$wcol + 0.3); yk <- G$yt + R$inicio + fi * G$fila
    if (identical(G$forma, "lista")) {
      .lam_caja(lz, x0, yk + 0.05, 0.14, 0.14, f$color, nombre = "mapa:clase", borde = .std_color("mapa_borde"), borde_pt = 0.5)
      .lam_txt(lz, f$distrito, x0 + 0.18, yk - 0.03, G$w_nombre, 0.26, G$pt, azul, nombre = "mapa:distrito")
      .lam_txt(lz, paste0(f$valor, "%"), x0 + G$wcol - 0.45, yk - 0.03, 0.45, 0.26, G$pt, azul, bold = TRUE, align = "right", nombre = "mapa:valor")
      next
    }
    x_barra <- x0 + G$w_nombre + 0.1; wbar <- x0 + G$wcol - x_barra - 0.45; wb <- wbar * f$valor / 100
    .lam_txt(lz, f$distrito, x0, yk, G$w_nombre, 0.28, G$pt, azul, align = "right", nombre = "mapa:distrito")
    if (wb > 0) .lam_caja(lz, x_barra, yk + 0.05, wb, 0.2, f$color, nombre = "mapa:barra")
    .lam_txt(lz, paste0(f$valor, "%"), x_barra + 0.05 + wb, yk - 0.01, 0.6, 0.28, G$pt, azul, bold = TRUE, nombre = "mapa:valor")
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:mapa:panel")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' ¿La 104 cabe? El ranking termina sobre el pie del contenido, cada nombre entra en su columna y la leyenda no sube por
#' encima del inicio de la zona de datos. Sin distritos pintados también cabe: la lámina dice su vacío.
#' @keywords internal
.lam_mapa_resultado_cabe <- function(espec) {
  if (is.null(espec) || !identical(espec$forma, "resultado") || is.null(espec$ranking)) return(FALSE)
  G <- .lam_mapa_resultado_geo(espec)
  G$y_ult <= G$yf - 0.1 && all(.lam_ancho_tinta(espec$ranking$distrito, G$pt) <= G$w_nombre - 0.15) &&
    G$r$y + G$r$h - (0.32 + length(espec$leyenda$rotulos) * 0.3) >= G$yt
}
