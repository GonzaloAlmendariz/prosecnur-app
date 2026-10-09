# =============================================================================
# lamina_categorica.R — categóricas del recetario dibujadas desde la especificación (ADR 0093, N3)
# =============================================================================
#
# Columnas verticales de un color para la pregunta categórica (recetario_m3a.R:6-18, lámina 68) y barras
# horizontales para la de una serie (`barras_h()`, recetario.R:182-209, lámina 73). Las cifras salen de
# `preparar_categorica()`; aquí sólo se ubican.

#' Columnas verticales: eje tenue, columna navy, cifra de 16 pt encima, «N <público>» de 10 pt y rótulo debajo
#' @keywords internal
.lam_columnas <- function(lz, espec, x0, ybase, wv, hmax = 3.4, unidad_n = "respuestas") {
  n_ <- length(espec$largos); if (!n_) return(invisible(lz))
  paso <- wv / n_; wcol <- paso * 0.56
  esc <- max(espec$largos) * 1.1
  azul <- .std_color("azul"); tenue <- .std_color("texto_tenue")
  .lam_caja(lz, x0 - 0.1, ybase, wv + 0.2, 0.012, tenue, nombre = "eje")
  for (k in seq_len(n_)) {
    hk <- if (esc > 0) hmax * espec$largos[k] / esc else 0
    xk <- x0 + (k - 1) * paso + (paso - wcol) / 2
    if (hk > 0.004) .lam_caja(lz, xk, ybase - hk, wcol, hk, azul, nombre = "columna")
    .lam_txt(lz, espec$cifras[k], xk - 0.3, ybase - hk - 0.42, wcol + 0.6, 0.36, 16, azul, bold = TRUE, align = "center", nombre = "cifra")
    if (is.finite(espec$n[k])) {
      .lam_txt(lz, sprintf("%s %s", format(as.integer(espec$n[k]), big.mark = ","), unidad_n), xk - 0.4, ybase - hk - 0.68,
               wcol + 0.8, 0.26, .std_pt("n"), tenue, align = "center", nombre = "n")
    }
    .lam_txt(lz, espec$rotulos[k], xk - 0.4, ybase + 0.1, wcol + 0.8, 0.3, 12, azul, bold = TRUE, align = "center", nombre = "rotulo")
  }
  invisible(lz)
}

#' Barras horizontales de una serie: rótulo a la derecha, barra y cifra; la mayor en navy y negrita y el resto
#' tenue cuando la especificación pide realce
#' @keywords internal
.lam_barras_h <- function(lz, espec, x, y, w, wlab, g, fila, size = 12, escala = NULL) {
  v <- espec$largos; et <- espec$rotulos
  escala <- escala %||% (max(v) * 1.12)
  wbar <- w - wlab - 0.8; yy <- y
  azul <- .std_color("azul"); tenue <- .std_color("tenue")
  for (k in seq_along(et)) {
    es_max <- isTRUE(espec$realce) && v[k] == max(v)
    h <- .lam_alto_txt(et[k], wlab, size)
    .lam_txt(lz, et[k], x, yy + (fila - h) / 2, wlab, h, size, azul, bold = es_max, align = "right", nombre = "rotulo")
    yb <- yy + (fila - g) / 2; bw <- if (escala > 0) wbar * v[k] / escala else 0
    if (bw > 0.004) .lam_caja(lz, x + wlab + 0.12, yb, bw, g, if (isTRUE(espec$realce) && !es_max) tenue else azul, nombre = "barra")
    .lam_txt(lz, espec$cifras[k], x + wlab + 0.16 + bw, yb + (g - 0.3) / 2, 0.8, 0.3, size, azul, bold = TRUE, nombre = "cifra")
    yy <- yy + fila
  }
  invisible(yy)
}

#' Lámina de una categórica, en columnas (pregunta categórica) o en barras (una serie)
#'
#' Barras: la geometría de la lámina 73 del recetario (recetario_m3a.R:98-101): fila = (6.72 − 1.65 − 0.45) / n
#' con un tope de 0.62 in, barra = mín(0.42, fila × 0.62), rótulo de hasta 6.3 in (11 pt si los rótulos son largos)
#' y, en selección múltiple, el encabezado «% de encuestados que marcó cada opción».
#' @keywords internal
.lam_laminas_categorica <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                    forma = c("columnas", "barras"), unidad_n = "respuestas", encabezado = NULL,
                                    layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio); forma <- match.arg(forma)
  g_ <- .std_geom; ml <- g_("margen_izq"); ancho <- g_("ancho") - ml - g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  if (identical(forma, "columnas")) {
    .lam_columnas(lz, espec, x0 = ml + 0.6, ybase = 6.05, wv = ancho - 1.2, unidad_n = unidad_n)
  } else {
    n <- max(1L, length(espec$largos))
    largos <- any(nchar(espec$rotulos) > 45)
    size <- if (largos) 11 else 12
    fila <- min(0.62, (yf - yt - 0.45) / n); g <- min(0.42, fila * 0.62)
    wlab <- min(6.3, max(1.4, max(.lam_ancho_tinta(espec$rotulos, size)) + 0.3))
    if (!is.null(encabezado) && nzchar(encabezado)) {
      .lam_txt(lz, encabezado, ml + wlab + 0.25, yt - 0.25, 4, 0.26, .std_pt("antetitulo"), .std_color("texto_suave"), bold = TRUE, nombre = "encabezado")
    }
    .lam_barras_h(lz, espec, ml, yt + 0.2, ancho, wlab = wlab, g = g, fila = fila, size = size)
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:categorica")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' Dicotomía partida (recetario_piezas.R:38-49): cifra grande en cada extremo, rótulos debajo y la barra
#'
#' La primera categoría va en azul y la segunda en celeste; la barra mide las cifras rotuladas.
#' @keywords internal
.lam_dicotomia <- function(lz, x, y, w, rotulos, cifras, largos, n = NULL, size = 22, g = 0.34,
                           cols = .std_paleta("dicotomica")) {
  size <- round(size * 0.85)   # C14 y C19 del recetario: las cifras de la dicotomía, un poco más chicas
  azul <- .std_color("azul"); medio <- .std_color("azul_medio")
  dico <- identical(toupper(cols), toupper(.std_paleta("dicotomica")))
  et <- function(k) if (is.null(n) || !is.finite(n[k])) rotulos[k] else sprintf("%s (%d)", rotulos[k], as.integer(n[k]))
  .lam_txt(lz, cifras[1], x, y, 1.6, size * 1.3 / 72, size, if (dico) azul else medio, bold = TRUE, nombre = "dicotomia:cifra")
  .lam_txt(lz, cifras[2], x + w - 1.6, y, 1.6, size * 1.3 / 72, size, if (dico) medio else azul, bold = TRUE, align = "right",
           nombre = "dicotomia:cifra")
  yl <- y + size * 1.25 / 72; yb <- yl + 0.32
  .lam_txt(lz, et(1), x, yl, w / 2, 0.26, 10.5, azul, nombre = "dicotomia:rotulo")
  .lam_txt(lz, et(2), x + w / 2, yl, w / 2, 0.26, 10.5, azul, align = "right", nombre = "dicotomia:rotulo")
  w1 <- w * largos[1] / sum(largos[1:2])
  .lam_caja(lz, x + w1, yb, w - w1, g, cols[2], nombre = "dicotomia:segmento")
  .lam_caja(lz, x, yb, w1 + 0.004, g, cols[1], nombre = "dicotomia:segmento")
  invisible(yb + g)
}

#' ¿La especificación es una dicotomía? Dos categorías dibujadas que reparten el 100 % de una sola fila
#'
#' Categórica: exactamente dos categorías cuyos porcentajes suman 100 (con selección múltiple la barra
#' partida contradiría a sus cifras). Escala: una sola fila y exactamente dos categorías dibujadas.
#' @keywords internal
.lam_es_dicotomia <- function(espec) {
  if (is.null(espec)) return(FALSE)
  if (identical(espec$tipo, "categorica")) {
    return(length(espec$largos) == 2L && abs(sum(espec$valores) - 1) < 0.02)
  }
  if (identical(espec$tipo, "escala") && NROW(espec$filas) == 1L && is.null(espec$box2$cifras) && isFALSE(any(espec$filas$es_total))) {
    k <- which(espec$dibujar[1, ]); return(length(k) == 2L && !any(espec$categorias$especial[k] %in% TRUE))
  }
  FALSE
}

#' Las piezas de una dicotomía (rótulos, cifras, largos, n) desde cualquiera de las dos especificaciones
#' @keywords internal
.lam_dicotomia_datos <- function(espec) {
  if (identical(espec$tipo, "categorica")) {
    return(list(rotulos = espec$rotulos, cifras = espec$cifras, largos = espec$largos, n = espec$n))
  }
  k <- which(espec$dibujar[1, ])
  # La especificación de escala no guarda la frecuencia de cada categoría: los rótulos van sin «(n)».
  list(rotulos = espec$categorias$rotulo[k], cifras = unname(espec$cifras[1, k]), largos = unname(espec$anchos[1, k]), n = NULL)
}

#' Lámina de una dicotomía a todo el ancho (lámina 74 del recetario, recetario_graficos2.R:20-25)
#'
#' La pregunta encabeza el panel con su público («176 egresados») y la barra partida va debajo, con cifras
#' de 40 pt y 0.7 in de grosor.
#' @keywords internal
.lam_laminas_dicotomia <- function(doc, espec, titulo, ante = NULL, pregunta = NULL, publico = NULL, base = NULL,
                                   folio = NULL, sub = NULL, layout = "Graficos2", master = "Office Theme",
                                   por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); ancho <- g_("ancho") - ml - g_("margen_der"); yt <- g_("zona_datos_y0")
  d <- .lam_dicotomia_datos(espec)
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  y <- yt + 1.1
  if (!is.null(pregunta) && nzchar(pregunta)) .lam_panel_titulo(lz, ml, yt + 0.3, ancho, pregunta, publico)
  .lam_dicotomia(lz, ml, y, ancho, d$rotulos, d$cifras, d$largos, d$n, size = 40, g = 0.7)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:dicotomia")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}
