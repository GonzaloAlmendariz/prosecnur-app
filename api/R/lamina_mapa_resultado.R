# =============================================================================
# lamina_mapa_resultado.R — lámina 104 del recetario: resultado por distrito en el mapa de Lima (ADR 0093)
# =============================================================================
#
# recetario_m3e.R:201-216: el mapa de Lima y Callao en una caja de 4.6 in, alineado a la derecha; la leyenda de clases
# queda en el mar, abajo a la izquierda, con su pie en el del mapa; a 0.35 in del filete, el panel con el indicador y
# los distritos de mayor a menor (filas de 0.33 in desde 0.62 bajo el panel), cada uno con su barra del color de su
# clase y la cifra en negrita.

.LAM_MAPA_RES <- list(ancho_mapa = 4.6, aire = 0.7, fila = 0.33, inicio = 0.62, w_nombre = 2.35, x_barra = 2.45, resto = 2.9)

#' Geometría de la lámina 104
#' @keywords internal
.lam_mapa_resultado_geo <- function(espec) {
  R <- .LAM_MAPA_RES; g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  r <- .lam_mapa_rect(espec, ml, yt, R$ancho_mapa, yf - yt - 0.1)
  r$x <- ml + R$ancho_mapa - r$w   # alineado a la derecha de su caja
  xr <- ml + R$ancho_mapa + R$aire; fin <- W - g_("margen_der")
  list(ml = ml, yt = yt, yf = yf, r = r, xr = xr, fin = fin, wr = fin - xr, w_ley = max(1.75, r$x - ml),
       y_ult = yt + R$inicio + (nrow(espec$ranking) - 1L) * R$fila + 0.28)
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
  wbar <- G$fin - G$xr - R$resto
  for (k in seq_len(nrow(espec$ranking))) {
    f <- espec$ranking[k, ]; yk <- G$yt + R$inicio + (k - 1L) * R$fila; wb <- wbar * f$valor / 100
    .lam_txt(lz, f$distrito, G$xr, yk, R$w_nombre, 0.28, 11, azul, align = "right", nombre = "mapa:distrito")
    if (wb > 0) .lam_caja(lz, G$xr + R$x_barra, yk + 0.05, wb, 0.2, f$color, nombre = "mapa:barra")
    .lam_txt(lz, paste0(f$valor, "%"), G$xr + R$x_barra + 0.05 + wb, yk - 0.01, 0.6, 0.28, 11, azul, bold = TRUE, nombre = "mapa:valor")
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:mapa:panel")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' ¿La 104 cabe? Hay al menos un distrito pintado, el ranking termina sobre el pie del contenido y cada nombre entra
#' en su columna a 11 pt; la leyenda no sube por encima del inicio de la zona de datos
#' @keywords internal
.lam_mapa_resultado_cabe <- function(espec) {
  if (is.null(espec) || !identical(espec$forma, "resultado") || !nrow(espec$ranking %||% data.frame())) return(FALSE)
  G <- .lam_mapa_resultado_geo(espec)
  G$y_ult <= G$yf - 0.1 && all(.lam_ancho_tinta(espec$ranking$distrito, 11) <= .LAM_MAPA_RES$w_nombre - 0.15) &&
    G$r$y + G$r$h - (0.32 + length(espec$leyenda$rotulos) * 0.3) >= G$yt
}
