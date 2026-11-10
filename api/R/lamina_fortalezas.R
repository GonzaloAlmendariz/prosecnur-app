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
  # Con rótulos de más de dos líneas la columna de rótulos toma hasta el 60 % de la columna (la barra conserva ~1.6 in).
  todos <- unlist(lapply(espec$columnas, `[[`, "rotulos"))
  if (length(todos) && any(.lam_lineas_tinta(todos, wr + 0.1, 12, FALSE) > 2L)) wr <- w * 0.6
  n <- max(1L, max(vapply(espec$columnas, function(cl) length(cl$rotulos), 0L)))
  zona0 <- g_("zona_datos_y0") - 0.05; zona1 <- g_("contenido_y1") - 0.35
  cab <- 0.6
  h <- min(0.72, (zona1 - zona0 - cab) / n)
  # Con pocas filas el bloque (encabezados y filas) se centra en la zona de datos: no queda arriba con media lámina vacía.
  y0 <- zona0 + max(0, (zona1 - zona0) - cab - h * n) / 2
  # S4 y S5 (Arte, 2026-11-09): los rótulos van enteros, en las líneas que caben en su fila (hasta cuatro), en una columna
  # a la medida de sus rótulos (lamina_rotulos_columna.R); la barra se queda con el resto.
  lin_max <- function(size) as.integer(max(1L, min(.LAM_ROTULO_MAX_LIN, floor((h - 0.1) / (size * 1.2 / 72)))))
  alto <- function(nl, size) if (all(nl <= lin_max(size))) list(alturas = rep(h, length(nl))) else NULL
  f <- if (length(todos)) .lam_rotulos_columna(todos, NULL, w_min = 1.2, w_max = w * 0.7, desde = 12, alto = alto, n_min = length(todos)) else NULL
  size <- 12; largos <- character(0)
  if (!is.null(f)) { wr <- f$wq - 0.1; size <- f$size; largos <- f$largos }
  else if (length(todos)) {
    wr <- w * 0.7 - 0.1; size <- .LAM_ROTULO_PT_PISO
    largos <- todos[vapply(todos, .lam_rotulo_lineas, 0L, w = wr + 0.1, size = size) > lin_max(size)]
  }
  list(ml = ml, fin = fin, w = w, wr = wr, xs = c(ml, ml + w + gap), n = n, y0 = y0, cab = cab, h = h,
       g = min(0.34, h * 0.55), size = size, largos = largos)
}

#' ¿La lámina cabe? Hasta ocho filas por columna
#'
#' Un rótulo largo ya no la manda a la imagen (Arte, 2026-11-07): va entero en las líneas que admite su fila, hasta
#' cuatro (S4, `.lam_fortalezas_geom`).
#' @keywords internal
.lam_fortalezas_cabe <- function(espec) {
  cols <- espec$columnas %||% list()
  if (length(cols) != 2L) return(FALSE)
  filas <- vapply(cols, function(cl) length(cl$rotulos), 0L)
  sum(filas) > 0L && all(filas <= .FORTALEZAS_FILAS_MAX)
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
      .lam_txt(lz, cl$rotulos[i], x - 0.1, yc - ge$h / 2, ge$wr + 0.1, ge$h, ge$size, azul, nombre = "fortalezas:rotulo", anclaje = "ctr")   # S4: entero
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
  .lam_rotulos_largos_aviso(ge$largos)   # S4 (lamina_rotulos_columna.R)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:fortalezas")
  # Tras la base, qué son las cifras (Gonzalo, 2026-11-10); la regla, al analista (lamina_pie_resumen.R).
  doc <- .lam_pie(doc, .lam_pie_resumen(base, espec$texto_regla, en_pie = espec$nota_base, valores = .lam_pie_valores(espec$indicador)), folio)
  list(doc = por_lamina(doc), partes = 1L)
}
