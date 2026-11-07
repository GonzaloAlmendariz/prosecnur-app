# =============================================================================
# lamina_hallazgos.R — la lámina nativa de hallazgos clave (especificación 2026-11-04, §2)
# =============================================================================
#
# Referencias visuales de la maqueta del 2026-11-04:
#   - `01_hallazgos_clave.png` (modo `cifras`): tarjetas blancas con filete azul arriba, la cifra grande, el texto de lo
#     medido, la barra de 0% a 100% con el punto y la franja del intervalo, el intervalo en letras y, bajo un filete, la
#     comparación frente al resto;
#   - `15_kpi_con_grafico_por_cifra.png` (modo `cifras_con_graficos`): tres tarjetas altas con la cifra, el intervalo en
#     letras con la base, la comparación y, debajo, el gráfico de apoyo (barras con la línea roja del total);
#   - `12_franja_de_kpi_en_lamina.png` (variante con `grafico_ancho`): la franja de tres cifras compactas y un gráfico de
#     ancho completo con el punto y el intervalo de cada opción.
#
# Las piezas de marca (tono, triángulo, leyenda, nota y pie) son las del resumen (lamina_resumen_diferencias.R). La letra
# no encoge: un texto que no cabe se avisa.

#' Comparación de una cifra en tramos: cada parte en su color con su triángulo, y la cola en gris
#' @return Ancho dibujado (in).
#' @keywords internal
.lam_halla_comparacion <- function(lz, comp, x, yc, w, pt = 10.5) {
  if (is.null(comp) || !length(comp$partes)) return(0)
  if (identical(comp$estado, "sin_diferencias") && .lam_ancho_tinta(comp$partes[[1]]$texto, pt, TRUE) > w - 0.05) {
    comp$partes[[1]]$texto <- "Sin diferencias entre grupos"   # la lista de cruces no cabe: la forma corta dice lo mismo
  }
  x0 <- x; a <- 0.09 * 1.15
  for (pa in comp$partes) {
    col <- if (is.null(pa$dir)) .std_color("texto_suave") else .lam_dif_tono(pa$dir, pa$fragil)$linea
    if (!is.null(pa$dir) && !isTRUE(pa$fragil) && identical(pa$dir, "up")) col <- .std_color("azul")
    wt <- .lam_ancho_tinta(pa$texto, pt, TRUE)
    if (x + wt > x0 + w + 1e-6) {
      r <- .lam_dif_recortar(pa$texto, x0 + w - x, pt, TRUE); pa$texto <- r$texto; wt <- .lam_ancho_tinta(pa$texto, pt, TRUE)
      .dif_aviso("Hallazgos clave", "la comparación «", comp$partes[[1]]$texto, "» no cabe en su tarjeta y se recortó.")
    }
    .lam_tyc_txt(lz, pa$texto, x, yc, wt + 0.04, pt, col, bold = TRUE, nombre = "hallazgo:comparacion")
    x <- x + wt + 0.06
    if (!is.null(pa$dir)) { .lam_dif_triangulo(lz, x, yc, pa$dir, col, lleno = !isTRUE(pa$fragil), alto = 0.09); x <- x + a }
    x <- x + 0.3
  }
  if (!is.null(comp$cola)) {
    wc <- .lam_ancho_tinta(comp$cola, pt, TRUE)
    if (x + wc <= x0 + w + 1e-6) { .lam_tyc_txt(lz, comp$cola, x, yc, wc + 0.04, pt, .std_color("texto_suave"), bold = TRUE, nombre = "hallazgo:comparacion:resto"); x <- x + wc }
  }
  x - x0
}

#' Barra de 0% a 100% con las marcas de 0, 50 y 100, la franja del intervalo y el punto de la cifra
#' @keywords internal
.lam_halla_barra_intervalo <- function(lz, k, x, yc, w) {
  X <- function(p) x + w * max(0, min(1, p))
  .lam_caja(lz, x, yc - 0.02, w, 0.04, .std_color("cebra"), nombre = "hallazgo:barra:pista")
  for (t in c(0, 0.5, 1)) .lam_caja(lz, X(t) - 0.006, yc - 0.06, 0.012, 0.12, .std_color("filete"), nombre = "hallazgo:barra:marca")
  iv <- k$intervalo
  if (is.finite(iv$inferior %||% NA_real_) && is.finite(iv$superior %||% NA_real_)) {
    .lam_forma_borde(lz, X(iv$inferior), yc - 0.04, max(0.03, X(iv$superior) - X(iv$inferior)), 0.08, fill = .std_color("azul_medio"),
                     geom = "roundRect", radio = 0.04, nombre = "hallazgo:barra:intervalo")
  }
  .lam_forma_borde(lz, X(k$valor / 100) - 0.065, yc - 0.065, 0.13, 0.13, fill = .std_color("azul"), borde = "#FFFFFF", borde_pt = 1,
                   geom = "ellipse", nombre = "hallazgo:barra:cifra")
}

#' Texto partido en líneas que caben, con aviso si pasa de `max_lineas`
#' @keywords internal
.lam_halla_lineas <- function(s, w, pt, max_lineas, bold = FALSE) {
  lin <- .lam_tyc_envolver(s, w - 0.1, pt, bold)   # holgura: la tinta de PowerPoint y LibreOffice es algo más ancha
  if (length(lin) > max_lineas) {
    .dif_aviso("Hallazgos clave", sprintf("el texto «%s» ocupa %d líneas y la tarjeta tiene %d; acórtalo.", s, length(lin), max_lineas))
    lin <- c(utils::head(lin, max_lineas - 1L), .lam_dif_recortar(paste(lin[max_lineas:length(lin)], collapse = " "), w, pt, bold)$texto)
  }
  lin
}

#' Escribe líneas desde `y` (borde superior) y devuelve dónde terminan
#' @keywords internal
.lam_halla_escribir <- function(lz, lineas, x, y, w, pt, color, bold = FALSE, nombre = "hallazgo:texto") {
  lh <- pt * 1.2 / 72
  for (l in lineas) { .lam_tyc_txt(lz, l, x, y + lh / 2, w, pt, color, bold = bold, nombre = nombre); y <- y + lh }
  y
}

#' «29% a 41%, base de 400»: el intervalo y la base en una frase (la base automática va en minúscula)
#' @keywords internal
.lam_halla_intervalo_base <- function(k) {
  b <- k$base %||% sprintf("base de %s", format(k$n, big.mark = ","))
  if (grepl("^Base de ", b)) b <- sub("^Base", "base", b)
  paste(c(if (nzchar(k$intervalo_texto)) k$intervalo_texto, b), collapse = ", ")
}

#' Tarjeta de una cifra (fondo blanco y filete azul)
#' @keywords internal
.lam_halla_marco <- function(lz, l, t, w, h, filete = c("arriba", "izquierda")) {
  filete <- match.arg(filete)
  .lam_caja(lz, l, t, w, h, .std_color("tarjeta_fondo"), nombre = "hallazgo:tarjeta")
  if (identical(filete, "arriba")) .lam_caja(lz, l, t, w, 0.05, .std_color("azul"), nombre = "hallazgo:tarjeta:filete") else
    .lam_caja(lz, l, t, 0.05, h, .std_color("azul"), nombre = "hallazgo:tarjeta:filete")
}

#' Modo `cifras`: hasta seis tarjetas en cuadrícula
#' @keywords internal
.lam_halla_cuadricula <- function(lz, espec, x0, x1, y0, y1) {
  ks <- espec$kpis; n <- length(ks)
  if (!n) return(invisible(NULL))
  cols <- if (n %in% c(2L, 4L)) 2L else if (n == 1L) 1L else 3L
  filas <- ceiling(n / cols); sep <- 0.25
  w <- (x1 - x0 - sep * (cols - 1L)) / cols
  h <- min(2.6, (y1 - y0 - sep * (filas - 1L)) / filas)
  azul <- .std_color("azul"); suave <- .std_color("texto_suave")
  pad <- 0.28; wi <- w - 2 * pad
  for (i in seq_len(n)) {
    k <- ks[[i]]; r <- (i - 1L) %/% cols; c <- (i - 1L) %% cols
    l <- x0 + c * (w + sep); t <- y0 + r * (h + sep)
    .lam_halla_marco(lz, l, t, w, h)
    .lam_txt(lz, k$cifra, l + pad - 0.1, t + 0.1, wi + 0.2, 0.75, 40, azul, bold = TRUE, nombre = "hallazgo:cifra")
    y_comp <- t + h - 0.22; y_sep <- t + h - 0.44
    y_ci <- y_sep - 0.2; y_bar <- y_ci - 0.2
    max_lin <- max(1L, floor((y_bar - 0.14 - (t + 0.78)) / (12 * 1.2 / 72) + 1e-6))
    .lam_halla_escribir(lz, .lam_halla_lineas(k$texto, wi * 0.92, 12, max_lin), l + pad, t + 0.78, wi, 12, azul, nombre = "hallazgo:texto")
    .lam_halla_barra_intervalo(lz, k, l + pad, y_bar, wi)
    ci <- if (nzchar(k$intervalo_texto)) paste0(k$intervalo_texto, " con 95% de confianza") else ""
    if (!is.null(k$base)) ci <- paste0(ci, if (nzchar(ci)) ". " else "", k$base)
    .lam_tyc_txt(lz, ci, l + pad, y_ci, wi, 9, suave, nombre = "hallazgo:intervalo")
    .lam_caja(lz, l + pad, y_sep, wi, 0.01, .std_color("filete"), nombre = "hallazgo:separador")
    .lam_halla_comparacion(lz, k$comparacion, l + pad, y_comp, wi)
  }
}

#' Alto del encabezado de un gráfico de apoyo (título y base), para que los de una lámina arranquen a la misma altura
#' @keywords internal
.lam_halla_alto_encabezado <- function(gd, w) {
  length(.lam_halla_lineas(gd$titulo, w, 11, 2L, TRUE)) * 11 * 1.2 / 72 + 0.03 +
    length(.lam_halla_lineas(gd$base, w, 8.5, 2L)) * 8.5 * 1.2 / 72 + 0.12
}

#' Gráfico de apoyo en barras: rótulo, barra y cifra con su marca; la línea roja del total
#'
#' Las filas se reparten en todo el alto que queda bajo el encabezado, hasta `y1` (revisión del PPT v7.11 de CCSS,
#' lámina 7: «los elementos no aprovechan bien el alto a veces»). Antes la fila tenía un tope de 0.5 in y un gráfico de
#' dos o tres barras dejaba un bloque vacío al pie de su tarjeta. La barra engrosa con su fila hasta 0.34 in.
#' @param x_max Máximo común de la escala (0-100).
#' @param y_barras Donde empiezan las barras (el encabezado más alto de la lámina); `NULL`, bajo el propio encabezado.
#' @keywords internal
.lam_halla_barras <- function(lz, gd, x, y, w, y1, x_max, y_barras = NULL) {
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); coral <- .std_color("coral")
  y <- .lam_halla_escribir(lz, .lam_halla_lineas(gd$titulo, w, 11, 2L, TRUE), x, y, w, 11, azul, bold = TRUE, nombre = "hallazgo:grafico:titulo")
  y <- .lam_halla_escribir(lz, .lam_halla_lineas(gd$base, w, 8.5, 2L), x, y + 0.03, w, 8.5, suave, nombre = "hallazgo:grafico:base") + 0.12
  y <- max(y, y_barras %||% y)
  f <- gd$filas; n <- nrow(f)
  if (!n) return(invisible(NULL))
  reserva_total <- if (is.null(gd$total)) 0 else 0.3
  h_fila <- (y1 - y - reserva_total) / n
  if (h_fila < 0.24) .dif_aviso("Hallazgos clave", sprintf("el gráfico «%s» tiene %d barras y no caben en la tarjeta.", gd$titulo, n))
  w_rot <- min(1.7, max(.lam_ancho_tinta(f$rotulo, 10)) + 0.2); xb <- x + w_rot; wb <- w - w_rot - 0.75
  X <- function(p) xb + wb * max(0, p) / x_max
  bar <- min(0.34, h_fila * 0.5)
  for (i in seq_len(n)) {
    yc <- y + (i - 0.5) * h_fila
    lr <- .lam_halla_lineas(f$rotulo[i], w_rot, 10, 2L)
    .lam_halla_escribir(lz, lr, x, yc - length(lr) * 10 * 1.2 / 72 / 2, w_rot - 0.05, 10, azul, nombre = "hallazgo:grafico:rotulo")
    dif <- identical(f$estado[i], "dif")
    tn <- if (dif) .lam_dif_tono(f$dir[i], f$fragil[i]) else NULL
    wbar <- X(f$p[i]) - xb
    if (wbar > 0.004) {
      if (dif) .lam_forma_borde(lz, xb, yc - bar / 2, wbar, bar, fill = tn$fill, borde = if (tn$punteado) tn$borde else NULL, borde_pt = 1,
                                punteado = tn$punteado, nombre = "hallazgo:grafico:barra:difiere")
      else .lam_caja(lz, xb, yc - bar / 2, wbar, bar, .std_color("azul_rango"), nombre = "hallazgo:grafico:barra")
    }
    cifra <- .tarjetas_pct(f$p[i]); col <- if (dif) tn$linea else azul
    if (dif && !isTRUE(f$fragil[i]) && identical(f$dir[i], "up")) col <- azul
    wc <- .lam_ancho_tinta(cifra, 10, TRUE)
    xc <- X(f$p[i]) + 0.07
    if (!is.null(gd$total) && is.finite(gd$total) && X(gd$total) >= xc - 0.03 && X(gd$total) <= xc + wc + 0.05) xc <- X(gd$total) + 0.07   # no pisa la línea del total
    .lam_tyc_txt(lz, cifra, xc, yc, wc + 0.04, 10, col, bold = TRUE, nombre = "hallazgo:grafico:cifra")
    if (dif) .lam_dif_triangulo(lz, xc + wc + 0.06, yc, f$dir[i], col, lleno = !isTRUE(f$fragil[i]), alto = 0.09)
  }
  if (!is.null(gd$total) && is.finite(gd$total)) {
    xt <- X(gd$total); yb <- y + n * h_fila
    .lam_caja(lz, xt - 0.008, y - 0.04, 0.016, n * h_fila + 0.08, coral, nombre = "hallazgo:grafico:total")
    .lam_tyc_txt(lz, paste("Total", .tarjetas_pct(gd$total)), xt, yb + 0.17, 1.2, 8.5, coral, bold = TRUE, align = "center", nombre = "hallazgo:grafico:total:rotulo")
  }
}

#' Modo `cifras_con_graficos` con un gráfico por cifra: tres tarjetas altas
#' @keywords internal
.lam_halla_columnas <- function(lz, espec, x0, x1, y0, y1) {
  ks <- espec$kpis; n <- length(ks)
  if (!n) return(invisible(NULL))
  sep <- 0.25; w <- (x1 - x0 - sep * (n - 1L)) / n
  if (n < 3L) w <- (x1 - x0 - sep * 2) / 3
  azul <- .std_color("azul"); suave <- .std_color("texto_suave")
  pad <- 0.26; wi <- w - 2 * pad
  # Las tarjetas se alinean entre sí: el texto más largo fija dónde empiezan el intervalo, la comparación y el gráfico.
  lin <- lapply(ks, function(k) .lam_halla_lineas(k$texto, wi * 0.92, 12, 2L))
  n_lin <- max(vapply(lin, length, 1L))
  maximo <- max(unlist(lapply(ks, function(k) c(k$grafico$filas$p, k$grafico$total))), 1, na.rm = TRUE)
  x_max <- min(100, maximo * 1.12)
  # Las barras de las tres tarjetas arrancan a la misma altura: la del encabezado de gráfico más alto.
  enc <- max(0, unlist(lapply(ks, function(k) if (!is.null(k$grafico)) .lam_halla_alto_encabezado(k$grafico, wi))))
  for (i in seq_len(n)) {
    k <- ks[[i]]; l <- x0 + (i - 1L) * (w + sep); t <- y0
    .lam_halla_marco(lz, l, t, w, y1 - y0)
    .lam_txt(lz, k$cifra, l + pad - 0.1, t + 0.1, wi + 0.2, 0.75, 40, azul, bold = TRUE, nombre = "hallazgo:cifra")
    y <- .lam_halla_escribir(lz, lin[[i]], l + pad, t + 0.82, wi, 12, azul, nombre = "hallazgo:texto")
    y <- t + 0.82 + n_lin * 12 * 1.2 / 72
    .lam_tyc_txt(lz, .lam_halla_intervalo_base(k), l + pad, y + 0.15, wi, 9, suave, nombre = "hallazgo:intervalo")
    .lam_halla_comparacion(lz, k$comparacion, l + pad, y + 0.48, wi)
    y_sep <- y + 0.72
    .lam_caja(lz, l + pad, y_sep, wi, 0.01, .std_color("filete"), nombre = "hallazgo:separador")
    if (!is.null(k$grafico)) .lam_halla_barras(lz, k$grafico, l + pad, y_sep + 0.18, wi, y1 - 0.35, x_max, y_barras = y_sep + 0.18 + enc)
  }
}

#' Variante `grafico_ancho`: franja de cifras compactas y un gráfico de ancho completo con punto e intervalo
#' @keywords internal
.lam_halla_franja <- function(lz, espec, x0, x1, y0, y1) {
  ks <- espec$kpis; n <- length(ks)
  azul <- .std_color("azul"); suave <- .std_color("texto_suave")
  sep <- 0.25; h <- 1.25
  if (n) {
    w <- (x1 - x0 - sep * 2) / 3
    for (i in seq_len(n)) {
      k <- ks[[i]]; l <- x0 + (i - 1L) * (w + sep)
      .lam_halla_marco(lz, l, y0, w, h, filete = "izquierda")
      wc <- .lam_ancho_tinta(k$cifra, 32, TRUE)
      .lam_txt(lz, k$cifra, l + 0.2, y0 + 0.1, wc + 0.25, 0.6, 32, azul, bold = TRUE, nombre = "hallazgo:cifra")
      xt <- l + 0.2 + wc + 0.35; wt <- l + w - 0.2 - xt
      yy <- .lam_halla_escribir(lz, .lam_halla_lineas(k$texto, wt, 11, 2L), xt, y0 + 0.17, wt, 11, azul, nombre = "hallazgo:texto")
      .lam_tyc_txt(lz, .lam_halla_intervalo_base(k), xt, yy + 0.1, wt, 8.5, suave, nombre = "hallazgo:intervalo")
      .lam_caja(lz, l + 0.2, y0 + h - 0.42, w - 0.4, 0.01, .std_color("filete"), nombre = "hallazgo:separador")
      .lam_halla_comparacion(lz, k$comparacion, l + 0.2, y0 + h - 0.21, w - 0.4, pt = 10)
    }
  }
  gd <- espec$grafico_ancho
  if (is.null(gd)) return(invisible(NULL))
  y <- y0 + (if (n) h + 0.3 else 0)
  y <- .lam_halla_escribir(lz, .lam_halla_lineas(gd$titulo, x1 - x0, 13, 2L, TRUE), x0, y, x1 - x0, 13, azul, bold = TRUE, nombre = "hallazgo:grafico:titulo")
  y <- .lam_halla_escribir(lz, .lam_halla_lineas(gd$base, x1 - x0, 9, 1L), x0, y + 0.03, x1 - x0, 9, suave, nombre = "hallazgo:grafico:base") + 0.12
  f <- gd$filas; nf <- nrow(f)
  if (!nf) return(invisible(NULL))
  w_nota <- if (!is.null(gd$nota_lado)) 1.9 else 0
  w_rot <- min(4.6, max(vapply(f$rotulo, function(s) min(.lam_ancho_tinta(s, 10.5), 4.6), 0)) + 0.2)
  xa <- x0 + w_rot + 0.5; xb <- x1 - w_nota - 0.7
  y_eje <- y1 - 0.22
  h_fila <- min(0.5, (y_eje - y) / nf)
  maximo <- max(c(f$superior, f$p), na.rm = TRUE)
  x_max <- min(100, max(20, ceiling(maximo / 20) * 20))
  X <- function(p) xa + (xb - xa) * max(0, min(p, x_max)) / x_max
  for (t in seq(0, x_max, by = 20)) {
    .lam_caja(lz, X(t) - 0.004, y, 0.008, nf * h_fila, if (t == 0) .std_color("tenue") else .std_color("cebra"), nombre = "hallazgo:grafico:guia")
    .lam_tyc_txt(lz, paste0(t, "%"), X(t), y_eje + 0.08, 0.6, 8.5, suave, align = "center", nombre = "hallazgo:grafico:eje")
  }
  for (i in seq_len(nf)) {
    yc <- y + (i - 0.5) * h_fila
    lin <- .lam_halla_lineas(f$rotulo[i], w_rot, 10.5, 2L)
    .lam_halla_escribir(lz, lin, x0, yc - length(lin) * 10.5 * 1.2 / 72 / 2, w_rot, 10.5, azul, bold = identical(f$estado[i], "dif"),
                        nombre = "hallazgo:grafico:rotulo")
    if (is.finite(f$inferior[i]) && is.finite(f$superior[i])) {
      .lam_forma_borde(lz, X(f$inferior[i]), yc - 0.035, max(0.03, X(f$superior[i]) - X(f$inferior[i])), 0.07, fill = .std_color("azul_medio"),
                       geom = "roundRect", radio = 0.035, nombre = "hallazgo:grafico:intervalo")
    }
    .lam_forma_borde(lz, X(f$p[i]) - 0.09, yc - 0.09, 0.18, 0.18, fill = azul, borde = "#FFFFFF", borde_pt = 1.25, geom = "ellipse",
                     nombre = "hallazgo:grafico:punto")
    x_c <- max(if (is.finite(f$superior[i])) X(f$superior[i]) else X(f$p[i]), X(f$p[i]) + 0.09) + 0.08
    cifra <- .tarjetas_pct(f$p[i]); wc <- .lam_ancho_tinta(cifra, 11, TRUE)
    .lam_tyc_txt(lz, cifra, x_c, yc, wc + 0.04, 11, azul, bold = TRUE, nombre = "hallazgo:grafico:cifra")
    if (identical(f$estado[i], "dif")) {
      tn <- .lam_dif_tono(f$dir[i], f$fragil[i]); col <- if (!isTRUE(f$fragil[i]) && identical(f$dir[i], "up")) azul else tn$linea
      .lam_dif_triangulo(lz, x_c + wc + 0.08, yc, f$dir[i], col, lleno = !isTRUE(f$fragil[i]), alto = 0.09)
    }
  }
  if (!is.null(gd$nota_lado)) {
    lin <- .lam_tyc_envolver(gd$nota_lado, w_nota - 0.1, 9)
    .lam_halla_escribir(lz, lin, x1 - w_nota + 0.1, y + 0.05, w_nota - 0.1, 9, suave, nombre = "hallazgo:grafico:nota")
  }
}

#' Lámina de hallazgos clave
#' @return Lista con `doc` y `partes`.
#' @keywords internal
.lam_laminas_hallazgos <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, layout = "Graficos2",
                                   master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  if (isTRUE(espec$modo %in% .HALLAZGOS_MODOS_RESUMEN)) {   # el resumen ejecutivo, paginado (lamina_hallazgos_resumen.R)
    return(.lam_laminas_hallazgos_resumen(doc, espec, titulo, ante = ante, base = base, folio = folio, layout = layout, master = master,
                                          por_lamina = por_lamina))
  }
  g <- .std_geom
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante)
  x0 <- g("margen_izq"); x1 <- g("ancho") - g("margen_der") - 0.1
  y0 <- .lam_titulo_fin(titulo) + 0.3; y1 <- .lam_dif_limite(espec)
  lz <- .lam_lienzo()
  if (identical(espec$modo, "cifras")) .lam_halla_cuadricula(lz, espec, x0, x1, y0, y1)
  else if (!is.null(espec$grafico_ancho)) .lam_halla_franja(lz, espec, x0, x1, y0, y1)
  else .lam_halla_columnas(lz, espec, x0, x1, y0, y1)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:hallazgos")
  doc <- .lam_dif_pie(doc, espec, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}
