# =============================================================================
# lamina_circulares.R — torta y dona del recetario con formas nativas (ADR 0093, N6)
# =============================================================================
#
# El recetario dibuja el disco con ggplot (recetario.R:344-358, recetario_m3a.R:34-47);
# aquí se dibuja con los sectores y arcos propios de PowerPoint, que se ven igual y
# quedan editables. La primera porción arranca a las 12 y gira en sentido horario,
# como el `coord_polar(direction = -1)` del recetario.

#' Ángulo de PowerPoint (60000avos de grado, horario desde las 3) para una fracción del círculo desde las 12
#' @keywords internal
.lam_angulo_ppt <- function(f) as.integer(round(((270 + 360 * f) %% 360) * 60000))

#' Sector circular (`prst="pie"`) o arco (`prst="blockArc"`) entre dos fracciones del círculo
#' @param grosor Para el arco, el grosor del aro como fracción del diámetro (0-0.5).
#' @keywords internal
.lam_sector <- function(lz, cx, cy, r, f0, f1, fill, arco = FALSE, grosor = 0.213, borde = .std_color("fondo"), borde_pt = 1.7,
                        nombre = "sector") {
  if (f1 - f0 >= 0.99999) f1 <- f0 + 0.99999   # un sector del círculo entero se dibuja casi completo
  l <- cx - r; t <- cy - r; d <- 2 * r
  av <- if (isTRUE(arco)) sprintf('<a:gd name="adj1" fmla="val %d"/><a:gd name="adj2" fmla="val %d"/><a:gd name="adj3" fmla="val %d"/>',
                                  .lam_angulo_ppt(f0), .lam_angulo_ppt(f1), as.integer(round(grosor * 100000)))
        else sprintf('<a:gd name="adj1" fmla="val %d"/><a:gd name="adj2" fmla="val %d"/>', .lam_angulo_ppt(f0), .lam_angulo_ppt(f1))
  xml <- paste0(
    '<p:sp><p:nvSpPr><p:cNvPr id="0" name="', .lam_xml_esc(nombre), '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>',
    '<p:spPr>', .lam_xfrm(l, t, d, d), '<a:prstGeom prst="', if (isTRUE(arco)) "blockArc" else "pie", '"><a:avLst>', av, '</a:avLst></a:prstGeom>',
    '<a:solidFill><a:srgbClr val="', .lam_hex(fill), '"/></a:solidFill>',
    '<a:ln w="', as.integer(round(borde_pt * 12700)), '"><a:solidFill><a:srgbClr val="', .lam_hex(borde), '"/></a:solidFill></a:ln></p:spPr>',
    '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr/></a:p></p:txBody></p:sp>')
  .lam_registrar(lz, xml, l, t, d, d)
}

#' Colores de las porciones: la paleta del usuario si la espec la trae (ADR 0097); si no, la dicotómica para dos y la
#' de categorías para más
#' @keywords internal
.lam_colores_pie <- function(k, espec = NULL) {
  propios <- if (!is.null(espec)) .espec_colores_de(espec)
  if (length(propios) == k) return(propios)
  if (k <= 2L) return(unname(.std_paleta("dicotomica"))[seq_len(k)])
  base <- c(.std_color("azul"), .std_color("azul_medio"), .std_color("tenue"), .std_color("azul_rango"), .std_color("texto_tenue"))
  # Frente C: con más de cinco porciones el ciclo repetía el azul de la primera; se reparte la rampa de la marca.
  if (k <= length(base)) base[seq_len(k)] else grDevices::colorRampPalette(base[1:4])(k)
}

#' Lámina de una torta con leyenda de cifras (lámina 69, recetario_m3a.R:20-31)
#'
#' El disco a la izquierda con la cifra dentro de cada porción (blanca sobre la primera, azul sobre las demás; fuera
#' si la porción es menor que 12 %), y a la derecha, por porción: cuadro de color, la cifra en 34 pt, su rótulo y
#' «n de N <unidad>».
#' @keywords internal
.lam_laminas_torta <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL, unidad_n = "respuestas",
                               layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc,
                               rotulo_centro = NULL) {   # la torta no tiene centro: comparte la llamada con la dona
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); yt <- g_("zona_datos_y0")
  azul <- .std_color("azul"); k <- length(espec$valores); cols <- .lam_colores_pie(k, espec)
  # El disco ocupa el 79.5 % de su caja de 4.4 in, como el coord_polar del recetario.
  d <- 4.4; xp <- ml + 1.0; yp <- yt + 0.25; cx <- xp + d / 2; cy <- yp + d / 2; r <- d / 2 * 0.795
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  f <- espec$valores / sum(espec$valores); acum <- c(0, cumsum(f))
  for (i in seq_len(k)) if (f[i] > 0) .lam_sector(lz, cx, cy, r, acum[i], acum[i + 1], cols[i], nombre = "torta:porcion")
  # Frente C: la cifra que no cabe en su porción sale fuera con su línea guía (lamina_circular_guia.R).
  .lam_circular_cifras(lz, espec, cx, cy, r, f, acum, cols, prefijo = "torta")
  for (i in seq_len(k)) {
    yk <- yt + 1.0 + (i - 1) * min(1.9, 3.8 / k)
    .lam_caja(lz, 6.7, yk + 0.12, 0.3, 0.3, cols[i], nombre = "torta:cuadro")
    .lam_txt(lz, espec$cifras[i], 7.15, yk - 0.05, 2.2, 0.62, 34, if (i == 1L) azul else .std_color("azul_medio"), bold = TRUE, nombre = "torta:cifra_leyenda")
    .lam_txt(lz, espec$rotulos[i], 7.15, yk + 0.58, 5.5, 0.3, 13, azul, bold = TRUE, nombre = "torta:rotulo")
    if (is.finite(.espec_casos(espec)[i]) && is.finite(.espec_total_casos(espec))) {
      .lam_txt(lz, sprintf("%s de %s %s", format(round(.espec_casos(espec)[i]), big.mark = ",", trim = TRUE), format(round(.espec_total_casos(espec)), big.mark = ",", trim = TRUE), unidad_n),
               7.15, yk + 0.86, 5.5, 0.26, 11, .std_color("texto_tenue"), nombre = "torta:casos")
    }
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:torta")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' Lámina de una dona con la cifra clave al centro y su lectura al lado (lámina 70, recetario_m3a.R:34-47)
#' @param lectura Texto de la narrativa (la frase con las cifras); `NULL`, la arma con las dos porciones.
#' @keywords internal
.lam_laminas_dona <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL, unidad_n = "respuestas",
                              rotulo_centro = NULL, layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); yt <- g_("zona_datos_y0")
  azul <- .std_color("azul"); k <- length(espec$valores); cols <- .lam_colores_pie(k, espec)
  d <- 4.0; xd <- ml + 1.2; yd <- yt + 0.35; cx <- xd + d / 2; cy <- yd + d / 2; r <- d / 2 * 0.79
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  f <- espec$valores / sum(espec$valores); acum <- c(0, cumsum(f))
  for (i in seq_len(k)) if (f[i] > 0) .lam_sector(lz, cx, cy, r, acum[i], acum[i + 1], cols[i], arco = TRUE, borde_pt = 2.4, nombre = "dona:porcion")
  .lam_txt(lz, espec$cifras[1], xd, cy - 0.45, d, 0.66, 34, azul, bold = TRUE, align = "center", nombre = "dona:cifra")
  .lam_txt(lz, rotulo_centro %||% espec$rotulos[1], xd, cy + 0.2, d, 0.3, 12, azul, align = "center", nombre = "dona:rotulo")
  # Lectura con filete coral (narrativa del recetario): «De N <unidad>, n1 <rótulo 1> y n2 (p2) <rótulo 2>».
  if (all(is.finite(.espec_casos(espec))) && is.finite(.espec_total_casos(espec)) && k == 2L) {
    .lam_caja(lz, 6.9, yt + 1.05, 0.05, 2.5, .std_color("coral"), nombre = "dona:filete")
    fmt <- function(x) format(round(x), big.mark = ",", trim = TRUE)
    tramos <- list(list("De ", FALSE), list(paste(fmt(.espec_total_casos(espec)), unidad_n), TRUE), list(", ", FALSE), list(fmt(.espec_casos(espec)[1]), TRUE),
                   list(sprintf(" responden «%s» y ", espec$rotulos[1]), FALSE), list(sprintf("%s (%s)", fmt(.espec_casos(espec)[2]), espec$cifras[2]), TRUE),
                   list(sprintf(" responden «%s».", espec$rotulos[2]), FALSE))
    .lam_txt_tramos(lz, tramos, 7.12, yt + 1.0, 5.68, 2.6, 17, azul, nombre = "dona:lectura")
  }
  .lam_leyenda(lz, yd + d + 0.1, espec$rotulos, cols, centrar_en = cx)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:dona")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' ¿La torta o la dona caben? La torta lleva su leyenda de cifras (hasta 3 porciones con el rótulo en una línea
#' de 5.5 in); la dona, hasta 4 porciones con su leyenda bajo el disco.
#' @keywords internal
.lam_circular_cabe <- function(espec) {
  k <- length(espec$valores)
  if (identical(espec$forma, "pie")) return(k >= 2L && k <= 3L && all(.lam_ancho_tinta(espec$rotulos, 13, TRUE) <= 5.4))
  # La dona del recetario es una dicotomía: la cifra clave al centro y la otra en la lectura, que necesita las
  # frecuencias. Con más porciones o sin n se perderían cifras (verificador de N6): ruta anterior. El rótulo del
  # centro debe caber en el hueco (≈ 1.8 in).
  k == 2L && all(is.finite(.espec_casos(espec))) && is.finite(.espec_total_casos(espec)) &&
    .lam_ancho_tinta(espec$rotulos[1], 12) <= 1.6 &&
    sum(0.22 + .lam_ancho_tinta(espec$rotulos, .std_pt("leyenda"))) + 0.3 * (k - 1) <= 4.0
}
