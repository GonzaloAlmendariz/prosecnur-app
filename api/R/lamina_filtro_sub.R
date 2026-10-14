# Lámina de pregunta filtro y subpregunta (recetario p192–p194, recetario_m4.R:82-148): los dos gráficos normales y una
# llave que sale de lo que habilita la subpregunta y llega a su título. El render lo arma graficos_filtro_subpregunta.R.

#' Llave vertical al costado de [y0, y1] que sale en horizontal y sube o baja hasta el título (recetario_piezas.R:92)
#' @keywords internal
.lam_llave_a_titulo <- function(lz, x, y0, y1, x_titulo, y_titulo, color = .std_color("azul"), t = 0.022) {
  xt <- x_titulo - 0.22
  .lam_caja(lz, x, y0, 0.1, t, color, nombre = "llave"); .lam_caja(lz, x, y1 - t, 0.1, t, color, nombre = "llave")
  .lam_caja(lz, x + 0.1 - t, y0, t, y1 - y0, color, nombre = "llave")
  yc <- (y0 + y1) / 2
  .lam_caja(lz, x + 0.1 - t, yc - t / 2, xt - x - 0.1 + t, t, color, nombre = "llave")
  yt <- y_titulo + 0.16
  .lam_caja(lz, xt, min(yc, yt), t, abs(yc - yt) + t, color, nombre = "llave")
  .lam_caja(lz, xt, yt - t / 2, x_titulo - 0.06 - xt, t, color, nombre = "llave")
  invisible(yt)
}

#' Llave bajo un segmento [x0, x1] que baja hasta el título de abajo (recetario_piezas.R:98)
#'
#' Si el tallo cae más allá de donde termina el texto del título, dobla a su altura y llega hasta su última letra.
#' @keywords internal
.lam_llave_baja <- function(lz, x0, x1, y, x_titulo, y_titulo, t_titulo, color = .std_color("azul"), t = 0.022) {
  .lam_caja(lz, x0, y, t, 0.1, color, nombre = "llave"); .lam_caja(lz, x1 - t, y, t, 0.1, color, nombre = "llave")
  .lam_caja(lz, x0, y + 0.1 - t, x1 - x0, t, color, nombre = "llave")
  xc <- (x0 + x1) / 2; ym <- y_titulo + 0.16
  x_fin <- x_titulo + 0.05 + .lam_ancho_tinta(t_titulo, 13, bold = TRUE)
  if (xc > x_fin + 0.15) {
    .lam_caja(lz, xc - t / 2, y + 0.1 - t, t, ym - y - 0.1 + t, color, nombre = "llave")
    .lam_caja(lz, x_fin + 0.1, ym - t / 2, xc - x_fin - 0.1 + t / 2, t, color, nombre = "llave")
  } else {
    .lam_caja(lz, xc - t / 2, y + 0.1 - t, t, y_titulo + 0.06 - y - 0.1 + t, color, nombre = "llave")
  }
  invisible(xc)
}

#' «Sólo los 20 que respondieron «Sí»»: la base de la subpregunta dicha con lo que la habilita
#' @keywords internal
.lam_filtro_sub_base <- function(espec) {
  n <- espec$n_sub
  cuantos <- if (is.finite(n)) format(as.integer(n), big.mark = ",") else ""
  quienes <- paste0("«", espec$habilita, "»", collapse = if (length(espec$habilita) > 2) ", " else " o ")
  trimws(sprintf("Sólo los %s que respondieron %s", cuantos, quienes))
}

#' ¿Cabe? Filtro de hasta 7 respuestas con alguna que habilita; subpregunta en barras de hasta 8 o una escala de una fila
#' @keywords internal
.lam_filtro_sub_cabe <- function(espec) {
  f <- espec$filtro; s <- espec$sub
  if (is.null(f) || is.null(s) || !(f$tipo %in% c("categorica", "pie")) || !length(espec$habilita)) return(FALSE)
  if (length(f$rotulos) < 2L || length(f$rotulos) > (if (identical(f$tipo, "pie")) 5L else 7L)) return(FALSE)
  if (identical(s$tipo, "categorica")) return(length(s$rotulos) >= 1L && length(s$rotulos) <= 8L)
  identical(s$tipo, "escala") && NROW(s$filas) == 1L
}

#' La subpregunta en su caja: barras de una serie o una escala al 100 % con su leyenda debajo
#' @keywords internal
.lam_filtro_sub_dibujar_sub <- function(lz, s, x, y, w, alto) {
  if (identical(s$tipo, "categorica")) {
    k <- length(s$rotulos); fila <- min(0.66, alto / max(1L, k)); g <- min(0.36, fila * 0.6)
    return(.lam_barras_h(lz, s, x, y, w, wlab = min(2.5, w * 0.4), g = g, fila = fila, size = 12))
  }
  seg <- .lam_escala_seg(s, 1L)
  .lam_barra_apilada(lz, x, y + 0.35, w, seg, 0.5)
  ver <- which(as.logical(s$dibujar[1, ]))
  .lam_leyenda(lz, y + 1.05, s$categorias$rotulo[ver], s$categorias$color[ver], centrar_en = x + w / 2)
  invisible(y + 1.4)
}

#' Lámina de pregunta filtro y subpregunta
#' @keywords internal
.lam_laminas_filtro_sub <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL, unidad_n = "respuestas",
                                    layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1"); ancho <- W - ml - mr
  azul <- .std_color("azul"); tenue <- .std_color("tenue")
  f <- espec$filtro; s <- espec$sub
  dico <- .lam_es_dicotomia(f)
  publico <- function(n) if (is.finite(n)) sprintf("%s %s", format(as.integer(n), big.mark = ","), unidad_n) else NULL
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()

  if (dico && identical(espec$disposicion, "abajo")) {
    # p192: la dicotomía a todo el ancho; la llave baja desde lo que habilita hasta el título de la subpregunta.
    d <- .lam_dicotomia_datos(f)
    wl <- 1.6; xb <- ml + wl + 0.12; wb <- ancho - wl - 0.12 - 1.1
    .lam_panel_titulo(lz, ml, yt, ancho, espec$pregunta_filtro, publico(espec$n_filtro))
    yb_fin <- .lam_dicotomia(lz, xb, yt + 0.55, wb, d$rotulos, d$cifras, d$largos, d$n, size = 26, g = 0.42, cols = d$colores)
    w1 <- wb * d$largos[1] / sum(d$largos[1:2])
    hab <- which(d$rotulos %in% espec$habilita)
    x0 <- if (identical(hab, 2L)) xb + w1 else xb
    x1 <- if (identical(hab, 1L)) xb + w1 else xb + wb
    y2 <- yb_fin + 0.75
    .lam_llave_baja(lz, x0, x1, yb_fin + 0.06, ml, y2, espec$pregunta_sub)
    ys <- .lam_panel_titulo(lz, ml, y2, ancho, espec$pregunta_sub, .lam_filtro_sub_base(espec))
    .lam_filtro_sub_dibujar_sub(lz, s, ml, ys + 0.2, ancho, yf - ys - 0.4)
  } else {
    gap <- 0.6; col <- (ancho - gap) / 2; xr <- ml + col + gap
    y0 <- .lam_panel_titulo(lz, ml, yt, col, espec$pregunta_filtro, publico(espec$n_filtro)) + 0.25
    if (identical(f$tipo, "pie")) {
      .lam_filtro_sub_circular(lz, f, espec$habilita, ml, y0, col, yf - y0, xr, yt)
    } else if (dico) {
      # p193: la dicotomía en una columna al 100 %, del alto del gráfico vecino, con sus cifras a la izquierda.
      d <- .lam_dicotomia_datos(f)
      hcol <- min(3.6, yf - y0 - 0.3); wcol <- 1.0; xcol <- ml + col - wcol - 1.3
      frac <- d$largos[1:2] / sum(d$largos[1:2]); yy <- y0; tramos <- list()
      for (k in 1:2) {
        hk <- hcol * frac[k]
        .lam_caja(lz, xcol, yy, wcol, hk + (if (k == 1) 0.004 else 0), d$colores[k], nombre = "dicotomia:segmento")
        yc <- yy + hk / 2
        .lam_txt(lz, d$cifras[k], xcol - 1.75, yc - 0.36, 1.6, 0.42, 22, azul, bold = TRUE, align = "right", nombre = "dicotomia:cifra")
        et <- if (!is.null(d$n) && is.finite(d$n[k])) sprintf("%s (%d)", d$rotulos[k], as.integer(d$n[k])) else d$rotulos[k]
        .lam_txt(lz, et, xcol - 1.75, yc + 0.04, 1.6, 0.26, 10.5, azul, align = "right", nombre = "dicotomia:rotulo")
        tramos[[k]] <- c(yy, yy + hk); yy <- yy + hk
      }
      hab <- which(d$rotulos %in% espec$habilita)
      .lam_llave_a_titulo(lz, xcol + wcol + 0.08, min(tramos[[hab[1]]]), max(tramos[[hab[length(hab)]]]), xr, yt)
    } else {
      # p194: el filtro en barras, las que habilitan en azul y el resto tenue; la llave las abraza.
      f2 <- f; f2$realce <- FALSE
      f2$colores <- stats::setNames(ifelse(f$rotulos %in% espec$habilita, azul, tenue), f$rotulos)
      k <- length(f$rotulos); fila <- min(0.66, (yf - y0 - 0.3) / k); g <- min(0.36, fila * 0.6)
      .lam_barras_h(lz, f2, ml, y0, col - 0.45, wlab = min(2.5, col * 0.4), g = g, fila = fila, size = 12)
      hab <- which(f$rotulos %in% espec$habilita)
      .lam_llave_a_titulo(lz, ml + col - 0.35, y0 + (min(hab) - 1) * fila + (fila - g) / 2,
                          y0 + (max(hab) - 1) * fila + (fila + g) / 2, xr, yt)
    }
    ys <- .lam_panel_titulo(lz, xr, yt, col, espec$pregunta_sub, .lam_filtro_sub_base(espec)) + 0.25
    .lam_filtro_sub_dibujar_sub(lz, s, xr, ys, col, yf - ys - 0.3)
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:filtro_sub")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}


#' F1: el filtro como torta o dona, girado para que lo que habilita quede a las 3, con la leyenda debajo y un conector
#' desde el borde de ese sector hasta el título de la subpregunta (el trazo de la llave)
#' @keywords internal
.lam_filtro_sub_circular <- function(lz, f, habilita, x, y0, w, alto, x_titulo, y_titulo, color = .std_color("azul"), t = 0.022) {
  k <- length(f$valores); cols <- .lam_colores_pie(k, f); dona <- !identical(f$forma, "pie")
  fila <- 0.34; d <- min(alto - k * fila - 0.25, w * 0.55, 3.2); r <- d / 2 * 0.95
  cx <- x + w * 0.42; cy <- y0 + d / 2
  fr <- f$valores / sum(f$valores); acum <- c(0, cumsum(fr))
  hab <- which(f$rotulos %in% habilita)
  medio <- if (length(hab)) (acum[min(hab)] + acum[max(hab) + 1]) / 2 else 0
  giro <- 0.25 - medio   # el centro de lo que habilita, a las 3 (fracción 0.25 desde las 12, en sentido horario)
  for (i in seq_len(k)) if (fr[i] > 0) .lam_sector(lz, cx, cy, r, acum[i] + giro, acum[i + 1] + giro, cols[i], arco = dona, borde_pt = 1.2,
                                                   nombre = if (dona) "dona:porcion" else "torta:porcion")
  if (dona && length(hab)) {
    tam <- min(24, max(14, r * 18))
    .lam_txt(lz, f$cifras[hab[1]], cx - r, cy - tam / 144 - 0.05, 2 * r, tam / 72 + 0.1, tam, color, bold = TRUE, align = "center", nombre = "dona:cifra")
  }
  # Leyenda debajo: cuadro, cifra y rótulo (lo que habilita en negrita).
  yl <- y0 + d + 0.2
  for (i in seq_len(k)) {
    yk <- yl + (i - 1) * fila
    .lam_caja(lz, x + 0.1, yk + 0.08, 0.17, 0.17, cols[i], nombre = "circular:cuadro")
    .lam_txt(lz, f$cifras[i], x + 0.34, yk, 0.8, 0.3, 13, color, bold = TRUE, nombre = "circular:cifra")
    .lam_txt(lz, f$rotulos[i], x + 1.1, yk + 0.01, w - 1.2, 0.3, 11, color, bold = i %in% hab, nombre = "circular:rotulo")
  }
  # Conector: del borde del sector a las 3, en horizontal hasta la calle, y de ahí al título de la subpregunta.
  xt <- x_titulo - 0.22; yt <- y_titulo + 0.16
  .lam_caja(lz, cx + r + 0.06, cy - t / 2, xt - (cx + r + 0.06) + t, t, color, nombre = "conector")
  .lam_caja(lz, xt, min(cy, yt), t, abs(cy - yt) + t, color, nombre = "conector")
  .lam_caja(lz, xt, yt - t / 2, x_titulo - 0.06 - xt, t, color, nombre = "conector")
  invisible(yl + k * fila)
}
