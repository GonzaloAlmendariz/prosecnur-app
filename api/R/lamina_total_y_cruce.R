# =============================================================================
# lamina_total_y_cruce.R — la lámina «total arriba y protagonista abajo» (variante 05, 2026-11-04)
# =============================================================================
#
# Composición genérica, reutilizable en el informe para cualquier pregunta con su cruce:
#
#   - arriba, la franja 100% del total de la pregunta (cualquier pregunta de categorías: una parte por categoría o las
#     partes que declare la lámina), con la llave sobre las partes que forman una serie («Trabaja 35%»);
#   - abajo, a la izquierda, la PROTAGONISTA: el cruce dibujado por una pieza enchufable;
#   - abajo, a la derecha, el panel lateral con la lectura en gris, sin marcas. Si la protagonista devuelve ítems de
#     panel (rótulo y chip de cada serie), van ahí; `lineas_nivel` los rotula al final de cada línea (v7.11, lámina 45);
#   - base y fuente al pie, con el pie de las demás láminas (`.lam_pie`).
#
# Protagonistas (`espec$protagonista`, registro `.lam_tyc_protagonista`):
#   - `lineas_nivel` (implementada, lamina_lineas_nivel.R): cruces ORDENADOS, una línea por serie y un punto por nivel;
#   - `barras_grupo` (NO implementada todavía): cruces NOMINALES (área, sexo), barras agrupadas por grupo con ▲▼ frente
#     al resto. Entraría aquí con la misma firma: `function(lz, espec, caja)` que dibuja dentro de `caja` y devuelve
#     `list(panel = <items del panel lateral>, notas = <líneas grises>)`. Su modelo puro iría en un
#     `graficos_barras_grupo*.R` que devuelva `tipo = "total_y_cruce"` y `protagonista = "barras_grupo"`.
#
# Se engancha sin crecer `reporte_plan_ppt.R`: `.lam_compositor_aplica()` y `.lam_slide_1_nativa()` (lamina_compositor.R)
# desvían aquí la espec `tipo = "total_y_cruce"`. Con `meta$motor_nativo = FALSE` la lámina sigue la ruta anterior con
# la figura ggplot (reporte_word_lineas_nivel.R).

#' Protagonista registrada para la parte de abajo
#'
#' @param nombre `espec$protagonista`. Hoy solo `lineas_nivel`; `barras_grupo` (cruces nominales) queda reservada.
#' @return Función `function(lz, espec, caja)` o NULL si no hay pieza para ese nombre.
#' @keywords internal
.lam_tyc_protagonista <- function(nombre) {
  switch(as.character(nombre %||% "")[1],
         lineas_nivel = .lam_lineas_nivel_dibujar,
         # barras_grupo = .lam_barras_grupo_dibujar,   # cruces nominales: pendiente (ver la cabecera)
         NULL)
}

#' ¿La lámina va por esta composición? Con su protagonista registrada y sin apagar el motor nativo
#' @keywords internal
.lam_total_y_cruce_aplica <- function(espec, slide = NULL) {
  is.list(espec) && identical(espec$tipo, "total_y_cruce") && !is.null(.lam_tyc_protagonista(espec$protagonista)) &&
    !identical((slide$meta %||% list())$motor_nativo, FALSE)
}

#' Texto centrado en vertical en `yc`: la caja de contenido sin los márgenes internos del cuadro (0.1 y 0.05 in)
#' @param x Borde izquierdo (align left), centro (center) o borde derecho (right) de la tinta.
#' @keywords internal
.lam_tyc_txt <- function(lz, s, x, yc, w, size, color, bold = FALSE, align = "left", lineas = 1L, nombre = "texto") {
  lh <- lineas * size * 1.2 / 72
  l <- switch(align, center = x - w / 2, right = x - w, x)
  .lam_txt(lz, s, l - 0.1, yc - lh / 2 - 0.05, w + 0.2, lh + 0.1, size, color, bold = bold, align = align, nombre = nombre)
}

#' Parte un texto en líneas que caben en `w` (corte por palabras, como PowerPoint)
#' @keywords internal
.lam_tyc_envolver <- function(s, w, size, bold = FALSE) {
  pal <- strsplit(trimws(as.character(s)[1]), "\\s+")[[1]]
  if (!length(pal)) return("")
  out <- character(0); cur <- ""
  for (p in pal) {
    cand <- if (nzchar(cur)) paste(cur, p) else p
    if (nzchar(cur) && .lam_ancho_tinta(cand, size, bold) > w) { out <- c(out, cur); cur <- p } else cur <- cand
  }
  c(out, cur)
}

#' La franja del total: partes con su cifra, rótulos debajo sin pisarse y la llave de la serie
#' @return Alto usado (in), desde `y`.
#' @keywords internal
.lam_tyc_franja <- function(lz, total, x0, x1, y) {
  suave <- .std_color("texto_suave"); azul <- .std_color("azul")
  seg <- total$segmentos
  .lam_tyc_txt(lz, total$rotulo, x0, y + 0.13, 6, 10, suave, bold = TRUE, nombre = "total:rotulo")
  yb <- y + 0.42; h <- 0.46; ancho <- x1 - x0
  pct <- pmax(0, seg$pct); pct <- if (sum(pct) > 0) pct / sum(pct) else pct
  xs <- x0 + c(0, cumsum(ancho * pct))
  cifras <- .tarjetas_pct(seg$pct)
  rot <- seg$rotulo
  for (k in seq_len(nrow(seg))) {
    wk <- xs[k + 1L] - xs[k]
    if (wk > 0.004) .lam_caja(lz, xs[k], yb, wk, h, seg$color[k], nombre = "total:segmento")
    wc <- .lam_ancho_tinta(cifras[k], 15, TRUE)
    if (wk >= wc + 0.16) {
      .lam_tyc_txt(lz, cifras[k], xs[k] + wk / 2, yb + h / 2, wc + 0.1, 15, .lam_texto_sobre(seg$color[k]), bold = TRUE,
                   align = "center", nombre = "total:cifra")
    } else {
      rot[k] <- paste(cifras[k], rot[k])   # la cifra no cabe en su parte: va con su rótulo
    }
  }
  # Rótulos bajo cada parte, centrados; si dos se pisan, se separan hacia la derecha sin salir de la franja.
  wl <- .lam_ancho_tinta(rot, 9.5)
  cx <- (xs[-1] + xs[-length(xs)]) / 2
  izq <- cx - wl / 2
  for (k in seq_along(izq)) {
    if (k > 1L) izq[k] <- max(izq[k], izq[k - 1L] + wl[k - 1L] + 0.18)
    izq[k] <- max(izq[k], x0)
  }
  exceso <- max(0, max(izq + wl) - x1)
  if (exceso > 0) izq <- izq - exceso
  for (k in seq_along(izq)) .lam_tyc_txt(lz, rot[k], izq[k], yb + h + 0.17, wl[k] + 0.02, 9.5, suave, nombre = "total:categoria")
  # Llave sobre las partes de la serie («Trabaja 35%»), en el color de su línea.
  ll <- total$llave
  if (!is.null(ll)) {
    xa <- xs[ll$desde]; xb <- xs[ll$hasta + 1L]; yl <- yb - 0.07
    col <- ll$color %||% azul
    .lam_caja(lz, xa, yl, xb - xa, 0.025, col, nombre = "total:llave")
    .lam_caja(lz, xa, yl, 0.025, 0.09, col, nombre = "total:llave")
    .lam_caja(lz, xb - 0.025, yl, 0.025, 0.09, col, nombre = "total:llave")
    lab <- paste(ll$rotulo, .tarjetas_pct(ll$pct))
    wlab <- .lam_ancho_tinta(lab, 11, TRUE)
    if (xb + 0.12 + wlab <= x1) {
      .lam_tyc_txt(lz, lab, xb + 0.12, yl - 0.02, wlab + 0.02, 11, azul, bold = TRUE, nombre = "total:llave:rotulo")
    } else {
      .lam_tyc_txt(lz, lab, xb, yl - 0.2, wlab + 0.02, 11, azul, bold = TRUE, align = "right", nombre = "total:llave:rotulo")
    }
  }
  0.42 + h + 0.17 + 0.12
}

#' Chip de una serie: borde continuo si es firme, punteado si es frágil, con su triángulo y su texto
#' @keywords internal
.lam_tyc_chip <- function(lz, x, yc, chip) {
  fr <- isTRUE(chip$fragil)
  w <- .lam_ancho_tinta(chip$texto, 10, TRUE) + 0.5; h <- 0.32
  .lam_forma_borde(lz, x, yc - h / 2, w, h, fill = .std_color(if (fr) "tarjeta_fondo_95" else "tarjeta_fondo"),
                   borde = .std_color(if (fr) "tarjeta_borde_95" else "tarjeta_borde"), borde_pt = if (fr) 1.05 else 0.75,
                   punteado = fr, geom = "roundRect", radio = 0.08, nombre = if (fr) "chip:95" else "chip:99")
  .lam_tarjeta_triangulo(lz, x + 0.14, yc, chip$dir, fr, alto = 0.1)
  .lam_tyc_txt(lz, chip$texto, x + 0.34, yc, w - 0.36, 10, .std_color("azul"), bold = TRUE, nombre = "chip:texto")
  invisible(w)
}

#' Panel lateral: rótulo y chip de cada serie a la altura de su ancla, sin pisarse; debajo la lectura y las notas
#'
#' @param items Lista de `list(rotulo, color, y, chip = list(texto, dir, fragil) o NULL)`; `y` es el ancla deseada.
#' @return Lo que bajó la lectura respecto de `y_max` (> 0 si no cupo).
#' @keywords internal
.lam_tyc_panel <- function(lz, items, lectura, notas, x, w, y_min, y_max) {
  alto_item <- function(it) {
    n <- length(.lam_tyc_envolver(it$rotulo, w, 12, TRUE))
    n * 12 * 1.2 / 72 + if (is.null(it$chip)) 0 else 0.45
  }
  if (length(items)) {
    orden <- order(vapply(items, `[[`, numeric(1), "y"))
    items <- items[orden]
    altos <- vapply(items, alto_item, numeric(1))
    tops <- vapply(items, `[[`, numeric(1), "y") - 0.14
    for (k in seq_along(tops)) {
      tops[k] <- max(tops[k], y_min)
      if (k > 1L) tops[k] <- max(tops[k], tops[k - 1L] + altos[k - 1L] + 0.22)
    }
    sobra <- max(0, tops[length(tops)] + altos[length(altos)] - y_max)
    if (sobra > 0) tops <- pmax(y_min, tops - sobra)
    for (k in seq_along(items)) {
      it <- items[[k]]
      lin <- .lam_tyc_envolver(it$rotulo, w, 12, TRUE)
      y <- tops[k]
      for (l in lin) { .lam_tyc_txt(lz, l, x, y + 0.1, w, 12, it$color, bold = TRUE, nombre = "panel:serie"); y <- y + 0.2 }
      if (!is.null(it$chip)) .lam_tyc_chip(lz, x, y + 0.24, it$chip)
    }
    y_lectura <- tops[length(tops)] + altos[length(altos)] + 0.4
  } else {
    y_lectura <- y_min
  }
  bloques <- c(if (!is.null(lectura) && nzchar(lectura)) list(list(texto = lectura, color = .std_color("texto_suave"), pt = 9.5)),
               lapply(notas %||% character(0), function(n) list(texto = n, color = .std_color("texto_tenue"), pt = 9)))
  if (!length(bloques)) return(0)
  y <- y_lectura; y0 <- y
  for (b in bloques) {
    lin <- .lam_tyc_envolver(b$texto, w - 0.16, b$pt)
    lh <- b$pt * 1.25 / 72
    for (l in lin) { .lam_tyc_txt(lz, l, x + 0.16, y + lh / 2, w - 0.16, b$pt, b$color, nombre = "panel:lectura"); y <- y + lh }
    y <- y + 0.08
  }
  .lam_caja(lz, x, y0 - 0.04, 0.018, y - y0 - 0.04, .std_color("tenue"), nombre = "panel:filete")
  y - y_max
}

#' Lámina «total arriba y protagonista abajo»
#' @return Lista con `doc` y `partes`.
#' @keywords internal
.lam_laminas_total_y_cruce <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, layout = "Graficos2",
                                       master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g <- .std_geom
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante)
  fin <- .lam_titulo_fin(titulo)
  x0 <- g("margen_izq") + 0.1; xr <- g("ancho") - g("margen_der")
  y <- fin + 0.22
  if (!is.null(espec$total)) {
    lt <- .lam_lienzo()
    y <- y + .lam_tyc_franja(lt, espec$total, x0, xr - 0.25, y)
    doc <- .lam_agrupar(doc, lt, nombre = "prosecnur:grafico:total")
  }
  lz <- .lam_lienzo()
  if (!is.null(espec$seccion)) {
    .lam_tyc_txt(lz, espec$seccion, x0, y + 0.22, 8, .std_pt("pregunta"), .std_color("azul"), bold = TRUE, nombre = "seccion:titulo")
    y <- y + 0.45
  }
  # v7.11, lámina 45: las series se rotulan al final de su línea (lamina_lineas_nivel.R); el panel sólo lleva la lectura y
  # cede ancho a la protagonista.
  ancho_panel <- 3.0
  x_panel <- xr - ancho_panel
  caja <- list(l = x0, t = y + 0.1, r = x_panel - 0.3, b = .std_comp("pie", "base_y") - 0.12)
  prot <- .lam_tyc_protagonista(espec$protagonista)
  res <- prot(lz, espec, caja)
  sobra <- .lam_tyc_panel(lz, res$panel, espec$lectura, c(res$notas, espec$no_comparables), x_panel, ancho_panel,
                          y_min = caja$t, y_max = caja$b)
  if (sobra > 0.01) .lineas_nivel_aviso(sprintf("la lectura del panel baja %.2f in más de lo que cabe; acórtala.", sobra))
  doc <- .lam_agrupar(doc, lz, nombre = paste0("prosecnur:grafico:", espec$protagonista))
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}
