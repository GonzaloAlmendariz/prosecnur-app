# La dona de lámina completa de más de dos porciones, nativa (L4, CCSS Perfil 2026, lámina 8).
#
# La dona del recetario (lámina 70, `.lam_laminas_dona`) es una dicotomía: la cifra clave al centro y la otra en la
# lectura. Con más porciones, o con un rótulo que no cabe en el hueco, la lámina iba a la imagen ggplot: título rojo
# repetido bajo el de la lámina, paleta fuera de marca, leyenda chica y un hueco blanco junto a la porción de 0 %.
# Aquí va como la dona de los paneles en grande: el aro en los azules de la marca (`.lam_colores_pie`), la cifra de la
# primera porción al centro, la cifra de cada porción en su aro o, si no cabe, fuera con su guía (lamina_circular_guia.R),
# y a la derecha la leyenda con el % grande, el rótulo y «n de N». Cifras, orden y base son los de la espec.

#' Medidas de la leyenda de la dona grande para `k` porciones, o `NULL` si no cabe
#' @keywords internal
.lam_dona_grande_geo <- function(espec) {
  k <- length(espec$valores); if (k < 2L) return(NULL)
  g_ <- .std_geom; yt <- g_("zona_datos_y0")
  x0 <- 6.7; x1 <- g_("ancho") - g_("margen_der")
  alto <- g_("contenido_y1") - yt - 0.2
  fila <- min(0.95, alto / k)
  escalas <- list(list(fila = 0.8, cifra = 28, rotulo = 14, casos = TRUE), list(fila = 0.5, cifra = 22, rotulo = 13, casos = FALSE),
                  list(fila = 0.34, cifra = 16, rotulo = 12, casos = FALSE))
  for (s in escalas) {
    if (fila < s$fila) next
    wcif <- max(.lam_ancho_tinta(espec$cifras, s$cifra, TRUE)) + 0.3
    xr <- x0 + 0.45 + wcif; wr <- x1 - xr
    alto_rot <- (if (isTRUE(s$casos)) fila - 0.3 else fila - 0.04)
    if (wr > 1 && all(vapply(espec$rotulos, function(r) .lam_alto_tinta(r, wr, s$rotulo, TRUE) - 0.05 <= alto_rot, TRUE))) {
      return(c(s, list(x0 = x0, xr = xr, wr = wr, wcif = wcif, alto_fila = fila, y0 = 4.0 - fila * k / 2)))
    }
  }
  NULL
}

#' ¿La dona grande cabe? Hasta donde la leyenda se lee entera en la columna derecha
#' @keywords internal
.lam_dona_grande_cabe <- function(espec) !is.null(.lam_dona_grande_geo(espec))

#' Lámina de una dona de varias porciones: el aro, la cifra al centro, las cifras con su guía y la leyenda de cifras
#' @keywords internal
.lam_laminas_dona_grande <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL, unidad_n = "respuestas",
                                     rotulo_centro = NULL, layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); yt <- g_("zona_datos_y0")
  azul <- .std_color("azul"); k <- length(espec$valores); cols <- .lam_colores_pie(k, espec)
  geo <- .lam_dona_grande_geo(espec)
  d <- 4.0; xd <- ml + 1.2; yd <- yt + 0.35; cx <- xd + d / 2; cy <- yd + d / 2; r <- d / 2 * 0.79
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  f <- espec$valores / sum(espec$valores); acum <- c(0, cumsum(f))
  for (i in seq_len(k)) if (f[i] > 0) .lam_sector(lz, cx, cy, r, acum[i], acum[i + 1], cols[i], arco = TRUE, borde_pt = 2.4, nombre = "dona:porcion")
  # La cifra de cada porción a media altura del aro (el aro mide 0.213 del diámetro); la que no cabe, fuera con su guía.
  .lam_circular_cifras(lz, espec, cx, cy, r, f, acum, cols, prefijo = "dona", r_cifra = r * (1 - 0.213), color_sobre = TRUE,
                       nombre_dentro = "dona:cifra_aro")
  .lam_txt(lz, espec$cifras[1], cx - 0.9, cy - 0.45, 1.8, 0.66, 34, azul, bold = TRUE, align = "center", nombre = "dona:cifra")
  rc <- rotulo_centro %||% espec$rotulos[1]
  hueco <- 2 * r * (1 - 2 * 0.213) - 0.2
  if (.lam_alto_tinta(rc, hueco, 12) <= 0.56) .lam_txt(lz, rc, cx - hueco / 2, cy + 0.2, hueco, 0.56, 12, azul, align = "center", nombre = "dona:rotulo")
  for (i in seq_len(k)) {
    yk <- geo$y0 + (i - 1) * geo$alto_fila
    lado <- min(0.3, geo$cifra / 72 * 0.8)
    .lam_caja(lz, geo$x0, yk + 0.08, lado, lado, cols[i], nombre = "dona:cuadro")
    .lam_txt(lz, espec$cifras[i], geo$x0 + 0.35, yk - 0.03, geo$wcif + 0.1, geo$cifra / 72 * 1.2 + 0.1, geo$cifra,
             if (i == 1L) azul else .std_color("azul_medio"), bold = TRUE, nombre = "dona:cifra_leyenda")
    h_rot <- if (isTRUE(geo$casos)) geo$alto_fila - 0.32 else geo$alto_fila - 0.04
    .lam_txt(lz, espec$rotulos[i], geo$xr, yk + 0.02, geo$wr, h_rot, geo$rotulo, azul, bold = TRUE, nombre = "dona:rotulo_leyenda")
    if (isTRUE(geo$casos) && is.finite(.espec_casos(espec)[i]) && is.finite(.espec_total_casos(espec))) {
      # U5: pegado bajo su rótulo (su alto medido), no al fondo de la fila: ahí quedaba más cerca de la categoría siguiente.
      y_cas <- min(yk + geo$alto_fila - 0.3, yk + 0.02 + .lam_alto_tinta(espec$rotulos[i], geo$wr, geo$rotulo, TRUE) - 0.04)
      .lam_txt(lz, sprintf("%s de %s %s", format(round(.espec_casos(espec)[i]), big.mark = ",", trim = TRUE),
                           format(round(.espec_total_casos(espec)), big.mark = ",", trim = TRUE), unidad_n),
               geo$xr, y_cas, geo$wr, 0.26, 11, .std_color("texto_tenue"), nombre = "dona:casos")
    }
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:dona")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}
