# =============================================================================
# lamina_fortalezas.R — fortalezas y alertas con formas nativas (ADR 0135, punto 6)
# =============================================================================
#
# Dos columnas lado a lado, «Más altas» y «Más bajas» (`fortalezas/1`, graficador_fortalezas.R). Cada fila: el rótulo
# de la pregunta y una barra horizontal sobre una pista de 0 a 100 (las dos columnas comparten la escala), con la
# cifra dentro de la barra y, si no cabe, fuera, en negrita. El tono de cada columna es el del estándar. La base del
# público va en el pie, abajo a la izquierda, seguida del texto de la regla.

.FORTALEZAS_FILAS_MAX <- 8L

#' Geometría de las dos columnas
#' @keywords internal
.lam_fortalezas_geom <- function(espec) {
  g_ <- .std_geom; ml <- g_("margen_izq"); fin <- g_("ancho") - g_("margen_der")
  gap <- 0.6; w <- (fin - ml - gap) / 2
  wr <- min(3.1, w * 0.5)
  n <- max(1L, max(vapply(espec$columnas, function(cl) length(cl$rotulos), 0L)))
  zona0 <- g_("zona_datos_y0") - 0.05; zona1 <- g_("contenido_y1") - 0.35
  cab <- 0.6
  h <- min(0.72, (zona1 - zona0 - cab) / n)
  # Con pocas filas el bloque (encabezados y filas) se centra en la zona de datos: no queda arriba con media lámina vacía.
  y0 <- zona0 + max(0, (zona1 - zona0) - cab - h * n) / 2
  list(ml = ml, fin = fin, w = w, wr = wr, xs = c(ml, ml + w + gap), n = n, y0 = y0, cab = cab, h = h,
       g = min(0.34, h * 0.55))
}

#' ¿La lámina cabe? Hasta ocho filas por columna y cada rótulo en dos líneas como mucho (12 pt)
#' @keywords internal
.lam_fortalezas_cabe <- function(espec) {
  cols <- espec$columnas %||% list()
  if (length(cols) != 2L) return(FALSE)
  filas <- vapply(cols, function(cl) length(cl$rotulos), 0L)
  if (!sum(filas) || any(filas > .FORTALEZAS_FILAS_MAX)) return(FALSE)
  ge <- .lam_fortalezas_geom(espec)
  todos <- unlist(lapply(cols, `[[`, "rotulos"))
  all(vapply(todos, function(t) .lam_lineas_tinta(t, ge$wr + 0.1, 12, FALSE) <= 2L, TRUE))
}

#' Lámina de fortalezas y alertas (`fortalezas/1`)
#' @keywords internal
.lam_laminas_fortalezas <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                    layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); pista <- .std_color("banda_clara")
  ge <- .lam_fortalezas_geom(espec)
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  for (j in seq_along(espec$columnas)) {
    cl <- espec$columnas[[j]]; x <- ge$xs[j]
    # Encabezado de la columna: su tono, su nombre y un filete en el mismo tono.
    .lam_caja(lz, x, ge$y0 + 0.1, 0.18, 0.18, cl$color, nombre = "fortalezas:tono")
    .lam_txt(lz, cl$titulo, x + 0.22, ge$y0, ge$w - 0.3, 0.38, 14, azul, bold = TRUE, nombre = "fortalezas:columna")
    .lam_caja(lz, x, ge$y0 + ge$cab - 0.1, ge$w, 0.025, cl$color, nombre = "fortalezas:filete")
    xb <- x + ge$wr + 0.15; wb <- ge$w - ge$wr - 0.15 - 0.6
    for (i in seq_along(cl$rotulos)) {
      yc <- ge$y0 + ge$cab + (i - 0.5) * ge$h
      # El cuadro ocupa la fila entera y centra su texto: una o dos líneas quedan centradas con la barra sin depender
      # de cuántas líneas estime la medición (LibreOffice y PowerPoint parten distinto en la frontera).
      .lam_txt(lz, cl$rotulos[i], x - 0.1, yc - ge$h / 2, ge$wr + 0.1, ge$h, 12, azul, nombre = "fortalezas:rotulo", anclaje = "ctr")
      .lam_caja(lz, xb, yc - ge$g / 2, wb, ge$g, pista, nombre = "fortalezas:pista", borde = NA)
      lb <- max(0.01, wb * max(0, min(100, cl$valores[i])) / 100)
      .lam_caja(lz, xb, yc - ge$g / 2, lb, ge$g, cl$color, nombre = "fortalezas:barra", borde = NA)
      tinta <- .lam_ancho_tinta(cl$cifras[i], 12, TRUE) + 0.22
      if (lb >= tinta) {
        .lam_txt(lz, cl$cifras[i], xb + lb - tinta - 0.02, .lam_y_centrada(yc, 12), tinta, 0.3, 12, .lam_texto_sobre(cl$color), bold = TRUE,
                 align = "right", nombre = "fortalezas:cifra")
      } else {
        .lam_txt(lz, cl$cifras[i], xb + lb + 0.02, .lam_y_centrada(yc, 12), 0.7, 0.3, 12, azul, bold = TRUE, nombre = "fortalezas:cifra")
      }
    }
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:fortalezas")
  nota <- sprintf("Barras: %s de cada pregunta", espec$indicador %||% "Top Two Box")
  doc <- .lam_pie(doc, .lam_unir_base(espec$nota_base, base, espec$texto_regla, nota), folio)
  list(doc = por_lamina(doc), partes = 1L)
}
