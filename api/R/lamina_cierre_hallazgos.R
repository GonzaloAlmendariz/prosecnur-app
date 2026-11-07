# =============================================================================
# lamina_cierre_hallazgos.R — la lámina nativa del cierre con hallazgos (ADR 0135, punto 6)
# =============================================================================
#
# Cada hallazgo es una tarjeta (la de hallazgos clave: fondo blanco y filete azul arriba, `.lam_halla_marco`): la cifra
# grande leída de su lámina de origen, debajo qué cifra es (el rótulo de su lámina) y la frase del analista. Sin
# intervalos. Un hallazgo sin cifra (la lámina de origen ya no está, o ya no tiene esa cifra) lleva su aviso en lugar de
# la cifra; uno cuya cifra cambió desde que se escribió la frase, el aviso al pie de la tarjeta. Tres tarjetas van en una
# fila; cuatro, en dos por dos; cinco, tres arriba y dos abajo.

#' ¿La especificación es del cierre con hallazgos y tiene de uno a cinco?
#' @keywords internal
.lam_cierre_hallazgos_cabe <- function(espec) {
  identical(espec$tipo, "cierre_hallazgos") && length(espec$hallazgos) >= 1L && length(espec$hallazgos) <= .CIERRE_HALLAZGOS_MAX
}

#' Filas de tarjetas: cuántas van en cada fila
#' @keywords internal
.lam_cierre_hallazgos_filas <- function(n) switch(as.character(n), "1" = 1L, "2" = 2L, "3" = 3L, "4" = c(2L, 2L), "5" = c(3L, 2L), 3L)

#' La cifra como se escribe en la tarjeta: con su unidad cuando la lámina la daba por entendida («+12 pts»)
#' @keywords internal
.lam_cierre_hallazgos_cifra <- function(h) {
  if (is.null(h$cifra) || !nzchar(h$cifra)) return(NULL)
  if (nzchar(h$unidad %||% "") && !grepl("%$", h$cifra) && !identical(h$unidad, "%")) paste(h$cifra, h$unidad) else h$cifra
}

#' Lámina del cierre con hallazgos (`cierre_hallazgos/1`)
#' @keywords internal
.lam_laminas_cierre_hallazgos <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                          layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; x0 <- g_("margen_izq"); x1 <- g_("ancho") - g_("margen_der")
  y0 <- g_("zona_datos_y0") + 0.15; y1 <- g_("contenido_y1") - 0.15
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); coral <- .std_color("coral")
  hs <- espec$hallazgos; filas <- .lam_cierre_hallazgos_filas(length(hs))
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  sep <- 0.3; nf <- length(filas)
  h <- min(2.6, (y1 - y0 - sep * (nf - 1L)) / nf)
  y_ini <- y0 + max(0, (y1 - y0) - (h * nf + sep * (nf - 1L))) / 2
  i <- 0L
  for (r in seq_len(nf)) {
    cols <- filas[r]; w <- (x1 - x0 - sep * (cols - 1L)) / cols
    # Una fila más corta (la de abajo con cinco) va centrada con el mismo ancho de tarjeta que la de arriba.
    w <- min(w, (x1 - x0 - sep * (max(filas) - 1L)) / max(filas))
    xi <- x0 + ((x1 - x0) - (w * cols + sep * (cols - 1L))) / 2
    t <- y_ini + (r - 1L) * (h + sep)
    for (c in seq_len(cols)) {
      i <- i + 1L; hl <- hs[[i]]; l <- xi + (c - 1L) * (w + sep)
      pad <- 0.28; wi <- w - 2 * pad
      .lam_halla_marco(lz, l, t, w, h)
      cifra <- .lam_cierre_hallazgos_cifra(hl)
      y <- t + 0.12
      if (!is.null(cifra)) {
        .lam_txt(lz, cifra, l + pad - 0.1, y, wi + 0.2, 0.75, 40, azul, bold = TRUE, nombre = "cierre:cifra")
        y <- y + 0.78
        if (nzchar(hl$rotulo %||% "")) {
          y <- .lam_halla_escribir(lz, .lam_halla_lineas(hl$rotulo, wi, 9, 2L), l + pad, y, wi, 9, suave, nombre = "cierre:rotulo") + 0.06
        }
      } else {
        y <- .lam_halla_escribir(lz, .lam_halla_lineas(hl$aviso %||% .CIERRE_SIN_ORIGEN, wi, 11, 2L, TRUE), l + pad, y + 0.1, wi, 11, coral,
                                 bold = TRUE, nombre = "cierre:aviso") + 0.1
      }
      pie_aviso <- !is.null(cifra) && !is.null(hl$aviso)
      y_fin <- t + h - 0.15 - (if (pie_aviso) 0.42 else 0)
      max_lin <- max(1L, floor((y_fin - y) / (12 * 1.2 / 72) + 1e-6))
      .lam_halla_escribir(lz, .lam_halla_lineas(hl$texto, wi, 12, max_lin), l + pad, y, wi, 12, azul, nombre = "cierre:texto")
      if (pie_aviso) .lam_halla_escribir(lz, .lam_halla_lineas(hl$aviso, wi, 9, 2L), l + pad, t + h - 0.5, wi, 9, coral, nombre = "cierre:aviso")
    }
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:cierre_hallazgos")
  doc <- .lam_pie(doc, .lam_unir_base(base), folio)
  list(doc = por_lamina(doc), partes = 1L)
}
