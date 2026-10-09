# =============================================================================
# lamina_paneles.R — láminas de varios gráficos del recetario (ADR 0093, N2)
# =============================================================================
#
# Porta `panel_titulo()` (recetario.R:359-363), `separador_v/h()` y `likert_panel()`
# (recetario_piezas.R:6-28) y la composición de `p_slide_2_graficos` del recetario
# (recetario_m2.R:9-16, lámina 133): cada panel lleva su pregunta encima, su Likert
# compacto debajo, un filete vertical entre columnas y UNA leyenda para la lámina.

#' Encabezado de panel: la pregunta en negrita y, debajo, su base en gris
#' @keywords internal
.lam_panel_titulo <- function(lz, x, y, w, texto, base = NULL) {
  nl <- .lam_lineas(texto, w, 13, TRUE)
  .lam_txt(lz, texto, x, y, w, 0.3 + 0.22 * (nl - 1), 13, .std_color("azul"), bold = TRUE, nombre = "panel:pregunta")
  if (!is.null(base) && nzchar(base)) {
    .lam_txt(lz, base, x, y + 0.26 + 0.22 * (nl - 1), w, 0.26, .std_pt("n"), .std_color("texto_tenue"), nombre = "panel:base")
  }
  invisible(y + 0.3 + 0.22 * (nl - 1) + (if (!is.null(base) && nzchar(base)) 0.26 else 0))
}

.lam_separador_v <- function(lz, x, y0, y1) .lam_caja(lz, x, y0, 0.008, y1 - y0, .std_color("filete"), nombre = "separador")
.lam_separador_h <- function(lz, x0, x1, y) .lam_caja(lz, x0, y, x1 - x0, 0.008, .std_color("filete"), nombre = "separador")

#' Likert compacto en un panel: rótulo a la izquierda, barra y Top Two Box de 1 in
#'
#' `filas` = índices de la especificación, en el orden en que se dibujan.
#' @keywords internal
.lam_likert_panel <- function(lz, espec, x, y, w, filas, g = 0.34, fila = 0.66, wlab = 1.45, size_lab = 11) {
  ttb_col <- !is.null(espec$box$unidades)
  verde <- .std_color("verde_top_two_box")
  wttb <- if (ttb_col) .std_geom("columna_top_two_box") else 0
  xb <- x + wlab + 0.12; wb <- w - wlab - 0.12 - wttb - (if (ttb_col) 0.1 else 0)
  if (ttb_col) .lam_txt(lz, espec$box$rotulo, x + w - wttb - 0.1, y - 0.05, wttb + 0.2, 0.24, .std_pt("rotulo_top_two_box"), verde,
                        bold = TRUE, align = "center", nombre = "box:rotulo")
  yy <- y + 0.3
  if (any(vapply(filas, function(i) .lam_tiene_peq(.lam_escala_seg(espec, i), wb), TRUE)) && fila - g < .std_geom("aire_cifra_chica")) {
    fila <- g + .std_geom("aire_cifra_chica")
  }
  for (i in filas) {
    yb <- yy + (fila - g) / 2 + 0.05
    lab <- espec$filas$rotulo[i]; h <- .lam_alto_txt(lab, wlab, size_lab, TRUE)
    .lam_txt(lz, lab, x, yb + g / 2 - h / 2, wlab, h, size_lab, .std_color("azul"), bold = TRUE, align = "right", nombre = "panel:rotulo")
    .lam_barra_apilada(lz, xb, yb, wb, .lam_escala_seg(espec, i), g)
    if (ttb_col) .lam_txt(lz, espec$box$cifras[i], x + w - wttb, yb + (g - 0.3) / 2, wttb, 0.3, .std_pt("cifra"), verde,
                          bold = TRUE, align = "center", nombre = "box:cifra")
    yy <- yy + fila
  }
  invisible(yy)
}

#' ¿Las especificaciones de los paneles comparten la escala (y por lo tanto una sola leyenda)?
#' @keywords internal
.lam_paneles_misma_escala <- function(especs) {
  firmas <- vapply(especs, function(e) paste(e$categorias$rotulo, e$categorias$color, collapse = "|"), "")
  length(unique(firmas)) == 1L
}

#' Lámina de varios gráficos de escala, con las ranuras del tipo de lámina
#'
#' @param especs Lista de especificaciones `preparar_escala()`, una por ranura, en el orden de las ranuras.
#' @param preguntas Pregunta de cada panel.
#' @param tipo Id del tipo de lámina en `estandar_pulso.json` (hoy `p_slide_2_graficos`).
#' @keywords internal
.lam_laminas_paneles <- function(doc, especs, preguntas, tipo = "p_slide_2_graficos", titulo, ante = NULL, base = NULL,
                                 folio = NULL, layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)   # antes de add_slide: el documento officer se modifica en sitio
  g_ <- .std_geom
  ranuras <- Filter(function(r) identical(r$tipo, "grafico"), .std_tipo_lamina(tipo)$ranuras)
  ranuras <- ranuras[order(vapply(ranuras, function(r) r$x, 0))]
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante)
  lz <- .lam_lienzo()
  y0 <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  for (k in seq_along(especs)) {
    r <- ranuras[[k]]; e <- especs[[k]]
    .lam_panel_titulo(lz, r$x, y0, r$w, preguntas[[k]])
    filas <- e$orden$aplicado
    # Recetario: g 0.46 y fila 0.9 con cuatro públicos; con más filas la fila se acorta para caber sobre la
    # leyenda, y la barra nunca baja de 0.24 in.
    disp <- (g_("leyenda_y") - 0.1) - (y0 + 0.5 + 0.3)
    fila <- min(0.9, disp / max(1L, length(filas))); g <- max(0.24, min(0.46, fila - 0.36))
    .lam_likert_panel(lz, e, r$x, y0 + 0.5, r$w, filas, g = g, fila = fila)
  }
  if (length(ranuras) >= 2L) {
    for (k in seq_len(length(ranuras) - 1L)) {
      xm <- (ranuras[[k]]$x + ranuras[[k]]$w + ranuras[[k + 1L]]$x) / 2
      .lam_separador_v(lz, xm, y0, yf - 0.3)
    }
  }
  e1 <- especs[[1]]; ley <- e1$leyenda
  .lam_leyenda(lz, g_("leyenda_y") - 0.04, e1$categorias$rotulo[ley], e1$categorias$color[ley], centrar_en = g_("ancho") / 2)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:paneles")
  doc <- .lam_pie(doc, base, folio)
  por_lamina(doc)
}
