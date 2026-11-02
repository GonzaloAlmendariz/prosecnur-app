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
  if (isTRUE(espec$leyenda_abajo)) {
    # La distribución (graficos_mapa_distribucion_plan.R): la leyenda va debajo en dos columnas y el mapa usa todo el
    # ancho de su caja, centrado («se ve de baja calidad», Gonzalo, 2026-11-02: el mapa se quedaba en ~2.8 in).
    h_ley <- .lam_mapa_leyenda_abajo_alto(espec$leyenda)
    r <- .lam_mapa_rect(espec, ml, yt, R$ancho_mapa, yf - yt - 0.2 - h_ley)
    r$x <- ml + (R$ancho_mapa - r$w) / 2
  } else {
  r <- .lam_mapa_rect(espec, ml, yt, R$ancho_mapa, yf - yt - 0.1)
  # Un mapa ancho (el encuadre a los datos de la distribución) llegaría al margen y la leyenda caería encima: se achica
  # hasta dejarle su columna de 1.75 in. El de Lima y Callao entero es alto y no llega a esto.
  if (R$ancho_mapa - r$w < 1.75) r <- .lam_mapa_rect(espec, ml, yt, R$ancho_mapa - 1.75, yf - yt - 0.1)
  r$x <- ml + R$ancho_mapa - r$w   # alineado a la derecha de su caja
  }
  xr <- ml + R$ancho_mapa + R$aire; fin <- W - g_("margen_der")
  n <- nrow(espec$ranking); forma <- .lam_mapa_resultado_forma(n)
  ncol <- c(una = 1L, dos = 2L, lista = 3L)[[forma]]; por_col <- max(1L, ceiling(n / ncol))
  fila <- if (identical(forma, "lista")) R$fila_lista else R$fila
  wcol <- (fin - xr - (ncol - 1L) * 0.3) / ncol
  # En una columna, las medidas del recetario; en dos, el nombre y la barra se reparten el ancho de su columna.
  pt <- if (identical(forma, "lista")) 9 else if (identical(forma, "dos")) 10 else 11
  # La cifra de la distribución («103 (26%)», graficos_mapa_distribucion_plan.R) es más ancha que «77%»: su columna
  # mide su tinta. Sin esa columna rigen las medidas del recetario.
  w_cifra <- if (!is.null(espec$ranking$cifra)) max(0.45, max(c(0, .lam_ancho_tinta(espec$ranking$cifra, pt, TRUE))) + 0.28)   # 0.2 in de márgenes internos de la caja else NULL
  w_nombre <- switch(forma, una = R$w_nombre, dos = min(R$w_nombre, wcol * 0.52), lista = wcol - 0.18 - (w_cifra %||% 0.45))
  list(ml = ml, yt = yt, yf = yf, r = r, xr = xr, fin = fin, wr = fin - xr, w_ley = max(1.75, r$x - ml), forma = forma,
       ncol = ncol, por_col = por_col, fila = fila, wcol = wcol, w_nombre = w_nombre, w_cifra = w_cifra,
       pt = pt,
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
  if (isTRUE(espec$leyenda_abajo)) {
    .lam_mapa_leyenda_abajo(lz, G$ml, G$r$y + G$r$h + 0.15, espec$leyenda, R$ancho_mapa)
    if (isTRUE(espec$recortado)) .lam_mapa_marco(lz, G$r)   # el recorte se lee como encuadre, no como un corte seco
  } else {
    .lam_mapa_leyenda(lz, G$ml, G$r$y + G$r$h, espec$leyenda, G$w_ley)
  }
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
      wc <- G$w_cifra %||% 0.45
      .lam_txt(lz, f$cifra %||% paste0(f$valor, "%"), x0 + G$wcol - wc, yk - 0.03, wc, 0.26, G$pt, azul, bold = TRUE, align = "right", nombre = "mapa:valor")
      next
    }
    # La distribución escala sus barras a su área mayor (`escala_max`): sobre 100 %, un distrito con el 6 % no se ve.
    x_barra <- x0 + G$w_nombre + 0.1; wbar <- x0 + G$wcol - x_barra - (G$w_cifra %||% 0.45); wb <- wbar * f$valor / (espec$escala_max %||% 100)
    .lam_txt(lz, f$distrito, x0, yk, G$w_nombre, 0.28, G$pt, azul, align = "right", nombre = "mapa:distrito")
    if (wb > 0) .lam_caja(lz, x_barra, yk + 0.05, wb, 0.2, f$color, nombre = "mapa:barra")
    .lam_txt(lz, f$cifra %||% paste0(f$valor, "%"), x_barra + 0.05 + wb, yk - 0.01, max(0.6, G$w_cifra %||% 0), 0.28, G$pt, azul, bold = TRUE, nombre = "mapa:valor")
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
  ley_ok <- if (isTRUE(espec$leyenda_abajo)) G$r$y + G$r$h + 0.15 + .lam_mapa_leyenda_abajo_alto(espec$leyenda) <= G$yf + 0.05 else
    G$r$y + G$r$h - (0.32 + length(espec$leyenda$rotulos) * 0.3) >= G$yt
  G$y_ult <= G$yf - 0.1 && all(.lam_ancho_tinta(espec$ranking$distrito, G$pt) <= G$w_nombre - 0.15) && ley_ok
}

#' Alto (in) de la leyenda bajo el mapa (rampa de clases): título, barra y cortes
#' @keywords internal
.lam_mapa_leyenda_abajo_alto <- function(leyenda) 0.78

#' Leyenda bajo el mapa como rampa: una barra con los tonos de las clases, los cortes entre bloque y bloque y, aparte,
#' el gris de «Sin encuestados»
#'
#' Gonzalo, 2026-11-02: la lista de cuadros con rótulos («Menos de 6 %», «6 %», «7 a 8 %») «se ve bastante feo». La
#' rampa es la convención de los mapas por clases: se lee de un vistazo que el tono sube con el porcentaje, y los cortes
#' van donde cambia el tono. `leyenda$cortes` trae los cortes; sin ellos queda la lista de antes.
#' @keywords internal
.lam_mapa_leyenda_abajo <- function(lz, x, y, leyenda, w) {
  azul <- .std_color("azul"); suave <- .std_color("texto_suave")
  cortes <- leyenda$cortes; k <- length(cortes) + 1L
  cols <- leyenda$colores[seq_len(k)]; vacio <- leyenda$colores[k + 1L]
  .lam_txt(lz, leyenda$titulo, x - 0.06, y, w, 0.26, 10, suave, bold = TRUE, nombre = "mapa:leyenda_titulo")
  w_vacio <- 1.35; w_barra <- min(2.8, w - w_vacio - 0.3); paso <- w_barra / k; yb <- y + 0.3
  for (j in seq_len(k)) .lam_caja(lz, x + (j - 1) * paso, yb, paso, 0.16, cols[j], nombre = "leyenda:rampa",
                                  borde = leyenda$borde %||% cols[j], borde_pt = 0.4)   # el borde del mapa también en la rampa
  for (j in seq_along(cortes)) {
    xc <- x + j * paso
    .lam_caja(lz, xc - 0.004, yb + 0.16, 0.008, 0.06, azul, nombre = "leyenda:marca")
    .lam_txt(lz, paste0(format(cortes[j], trim = TRUE), " %"), xc - 0.4, yb + 0.2, 0.8, 0.26, 10, azul, align = "center", nombre = "leyenda:corte")
  }
  xv <- x + w_barra + 0.3
  .lam_caja(lz, xv, yb, 0.16, 0.16, vacio, nombre = "leyenda:cuadro", borde = leyenda$borde %||% vacio, borde_pt = 0.5)
  .lam_txt(lz, leyenda$rotulos[k + 1L], xv + 0.2, yb - 0.06, w_vacio, 0.28, 10, azul, nombre = "leyenda:texto")
  invisible(y)
}

#' Marco fino alrededor de un mapa recortado a sus datos: cuatro filetes del color del borde del mapa
#' @keywords internal
.lam_mapa_marco <- function(lz, r, grosor = 0.01) {
  col <- .std_color("mapa_borde")
  .lam_caja(lz, r$x, r$y, r$w, grosor, col, nombre = "mapa:marco")
  .lam_caja(lz, r$x, r$y + r$h - grosor, r$w, grosor, col, nombre = "mapa:marco")
  .lam_caja(lz, r$x, r$y, grosor, r$h, col, nombre = "mapa:marco")
  .lam_caja(lz, r$x + r$w - grosor, r$y, grosor, r$h, col, nombre = "mapa:marco")
  invisible(lz)
}
