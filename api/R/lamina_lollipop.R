# =============================================================================
# lamina_lollipop.R — ranking con puntos nativo (lámina 72, recetario_m3a.R:81-95)
# =============================================================================
#
# Salió de lamina_categorica.R (L10-5, bandeja CCSS 2026-10-24): con once opciones y un rótulo de dos líneas
# («Académica (grupos de lectura, seminarios temáticos, ...)») la fila medía 0.42 in, el rótulo 0.47 y la lámina caía a
# la imagen ggplot con caja blanca y letra diminuta. El rótulo ahora baja de 11 pt hasta el piso de lectura antes de
# rendirse, y las residuales se pintan con el color de no sustantivo.

#' Lámina de ranking con puntos (lámina 72, recetario_m3a.R:81-95)
#'
#' Rótulos a la derecha en una columna de 6.3 in, guías cada 10 % con su cifra arriba, un tallo fino y un punto
#' por opción con su cifra a la derecha; las residuales («Otros», «No sabe») al final y, sólo con `residuales_gris`, en gris claro.
#' @keywords internal
.lam_laminas_lollipop <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL, encabezado = NULL,
                                  layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  azul <- .std_color("azul"); tenue <- .std_color("texto_tenue"); gris <- .graficos_no_sustantivo_color()
  pt <- .lam_lollipop_pt(espec$rotulos); if (!is.finite(pt)) pt <- 11
  lab <- espec$rotulos; pc <- espec$largos * 100; k <- length(lab); cols_u <- .espec_colores_de(espec, lab)
  wl <- 6.3; xs <- ml + wl + 0.25; ws <- W - mr - xs - 0.7; fl <- (yf - yt - 0.45) / k
  esc <- max(10, ceiling(max(pc) / 10) * 10)
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  for (v in seq(0, esc, 10)) {
    xv <- xs + ws * v / esc
    .lam_caja(lz, xv, yt + 0.35, 0.006, k * fl, .std_color("filete"), nombre = "lollipop:guia")
    .lam_txt(lz, paste0(v, "%"), xv - 0.3, yt + 0.05, 0.6, 0.24, 10, tenue, align = "center", nombre = "lollipop:eje")
  }
  for (i in seq_len(k)) {
    yc <- yt + 0.35 + (i - 0.5) * fl; xv <- xs + ws * pc[i] / esc
    # Las que el analista resalta van en coral (como la ruta anterior); las residuales, en gris.
    # Con paleta del usuario (ADR 0097) cada punto lleva el color de su opción; el resaltado sigue en coral.
    col <- if (lab[i] %in% (espec$resaltar %||% character(0))) .std_color("coral") else if (!is.null(cols_u)) cols_u[i] else
      if (isTRUE(espec[["residuales_gris"]]) && grepl(.CATEGORIAS_RESIDUALES, lab[i], ignore.case = TRUE)) gris else azul
    hl <- .lam_alto_txt(lab[i], wl, pt)
    .lam_txt(lz, lab[i], ml, yc - hl / 2, wl, hl, pt, azul, align = "right", nombre = "lollipop:rotulo")
    # L10-8: el tallo es una línea de 0.024 in, no un rectángulo con contorno: el contorno se ajusta al píxel y el relleno
    # no, y según la fila se veían dos trazos paralelos (láminas 38 y 66 del mazo V2 de CCSS).
    .lam_linea(lz, xs, yc, max(xs + 0.002, xv), yc, col, pt = 0.024 * 72 + 0.25, nombre = "lollipop:tallo")   # el grosor visible de antes
    .lam_caja(lz, xv - 0.1, yc - 0.1, 0.2, 0.2, col, nombre = "lollipop:punto", geom = "ellipse")
    .lam_txt(lz, espec$cifras[i], xv + 0.14, yc - 0.15, 0.7, 0.3, 12, azul, bold = TRUE, nombre = "lollipop:cifra")
  }
  if (!is.null(encabezado) && nzchar(encabezado)) .lam_txt(lz, encabezado, xs, yt - 0.25, ws, 0.26, 10, .std_color("texto_suave"), bold = TRUE,
                                                           nombre = "lollipop:encabezado")
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:lollipop")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' ¿El ranking con puntos cabe? Hasta 15 opciones con rótulos en su fila (dos líneas en 6.3 in, a 11 pt o algo menos)
#' @keywords internal
.lam_lollipop_cabe <- function(espec) {
  k <- length(espec$rotulos)
  k >= 1L && k <= 15L && is.finite(.lam_lollipop_pt(espec$rotulos))
}

#' Tamaño de los rótulos del ranking: 11 pt del recetario o, si alguno no cabe en su fila en dos líneas, el mayor
#' (hasta 9 pt, sobre el piso de lectura de 8) en que todos caben; `NA` si ni así
#' @keywords internal
.lam_lollipop_pt <- function(rotulos) {
  k <- length(rotulos); fl <- (.std_geom("contenido_y1") - .std_geom("zona_datos_y0") - 0.45) / max(1L, k)
  for (pt in c(11, 10.5, 10, 9.5, 9)) {
    if (all(vapply(rotulos, function(r) .lam_alto_txt(r, 6.3, pt) <= max(fl, 0.4) + 0.03 && .lam_lineas(r, 6.3, pt) <= 2L, TRUE))) return(pt)
  }
  NA_real_
}
