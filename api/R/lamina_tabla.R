# =============================================================================
# lamina_tabla.R — la tabla del diseño (láminas 197 y 225) para `p_tabla`
# =============================================================================
#
# G11 (Gonzalo, 2026-10-13: «aún hay gráficos sin motor»): `p_tabla` es el radar con el radar escondido, y salía por la
# ruta anterior con su tabla. Aquí la misma cuenta (espec «tabla», hermana de la del radar) va en la lámina del
# diseño: antetítulo y título, la tabla editable centrada en la zona de datos y la base con el folio al pie.

#' Anchos de la tabla: la primera columna se queda con lo que dejan las de los públicos (1.6 in cada una, como la 225)
#' @keywords internal
.lam_tabla_anchos <- function(espec) {
  g_ <- .std_geom; total <- min(11.4, g_("ancho") - g_("margen_izq") - g_("margen_der"))
  k <- length(espec$grupos); col <- min(1.6, (total * 0.55) / max(1L, k))
  c(total - k * col, rep(col, k))
}

#' Altos de la tabla: 0.5 in por fila o menos si no caben; un tema de varias líneas ensancha su fila
#' @keywords internal
.lam_tabla_filas <- function(espec) {
  g_ <- .std_geom; disp <- g_("contenido_y1") - g_("zona_datos_y0") - 0.1
  K <- length(espec$ejes); w1 <- .lam_tabla_anchos(espec)[1]
  lineas <- max(1L, .lam_lineas_tinta(espec$ejes, w1, 13, TRUE))
  cab <- min(0.5, disp / (K + 1)); cuerpo <- max(cab, round(lineas * 13 * 1.2 / 72 + 12 / 72, 2))
  list(cabecera = cab, cuerpo = cuerpo, alto = cab + K * cuerpo, disp = disp)
}

#' ¿La tabla cabe en la lámina del diseño? Hasta seis públicos, filas de al menos 0.32 in, y el alto en la zona de datos
#' @keywords internal
.lam_tabla_cabe <- function(espec) {
  K <- length(espec$ejes); k <- length(espec$grupos)
  if (K < 1L || k < 1L || k > 6L) return(FALSE)
  f <- .lam_tabla_filas(espec)
  f$cabecera >= 0.32 && f$alto <= f$disp
}

#' Lámina de la tabla (197/225)
#' @keywords internal
.lam_laminas_tabla <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                               layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der"); yt <- g_("zona_datos_y0")
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  d <- data.frame(espec$ejes, espec$cifras, check.names = FALSE, stringsAsFactors = FALSE)
  names(d) <- c(espec$encabezado, espec$grupos)
  ws <- .lam_tabla_anchos(espec); f <- .lam_tabla_filas(espec)
  x <- ml + ((W - ml - mr) - sum(ws)) / 2
  doc <- .lam_tabla_ttb(doc, d, x, yt + 0.1, ws, f$cabecera, f$cuerpo, nombre = "prosecnur:grafico:tabla")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}
