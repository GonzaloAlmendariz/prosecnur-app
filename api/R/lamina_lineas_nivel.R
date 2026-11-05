# =============================================================================
# lamina_lineas_nivel.R — la protagonista de líneas por nivel (cruces ordenados) de la lámina «total y cruce»
# =============================================================================
#
# Dibuja dentro de la caja que le da `lamina_total_y_cruce.R`, en piezas nativas y editables:
#   - guías horizontales y el eje en gris, cifras del eje a la izquierda;
#   - con series anidadas, la sombra bajo la serie interior y entre series, en el color de su parte de la franja del
#     total (la franja es la misma lámina, aplanada);
#   - una línea por serie, un punto por nivel con su cifra (la serie de arriba la lleva encima, la de abajo debajo; si
#     no cabe sobre el eje, al costado);
#   - el punto que difiere del resto lleva halo y ▲▼ (firme) o △▽ con halo punteado (frágil);
#   - un punto sin la base mínima va hueco, su tramo punteado y sin marca;
#   - bajo cada nivel, su rótulo y «N estudiantes»;
#   - la leyenda de las series a la DERECHA del gráfico, en el panel lateral, sobre la lectura (muestra, rótulo, su parte
#     del total y el chip de tendencia), y la de los símbolos al pie (lamina_lineas_nivel_leyenda.R). Revisión del PPT
#     v7.23 de CCSS, lámina 42 (ítem 10): «la leyenda va a la derecha del gráfico, no al lado del último eje de la
#     línea». Deshace el rótulo al final de cada línea de la v7.11 (lámina 45).

#' Línea recta con trazo opcional punteado
#' @keywords internal
.lam_ln_linea <- function(lz, x1, y1, x2, y2, col, pt = 2.6, punteado = FALSE, nombre = "linea") {
  l <- min(x1, x2); t <- min(y1, y2); w <- abs(x2 - x1); h <- abs(y2 - y1)
  flip <- (x2 - x1) * (y2 - y1) < 0
  xml <- paste0(
    '<p:sp><p:nvSpPr><p:cNvPr id="0" name="', .lam_xml_esc(nombre), '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>',
    '<p:spPr>', sprintf('<a:xfrm%s><a:off x="%.0f" y="%.0f"/><a:ext cx="%.0f" cy="%.0f"/></a:xfrm>', if (flip) ' flipV="1"' else '',
                        l * .EMU, t * .EMU, w * .EMU, h * .EMU),
    '<a:prstGeom prst="line"><a:avLst/></a:prstGeom>',
    '<a:ln w="', as.integer(round(pt * 12700)), '" cap="rnd"><a:solidFill><a:srgbClr val="', .lam_hex(col), '"/></a:solidFill>',
    if (punteado) '<a:prstDash val="dash"/>' else '', '<a:round/></a:ln></p:spPr>',
    '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr/></a:p></p:txBody></p:sp>')
  .lam_registrar(lz, xml, l, t, w, h)
}

#' Relleno sólido con transparencia (`alfa` de 0 a 1)
#' @keywords internal
.lam_ln_relleno <- function(col, alfa = 1) {
  a <- if (alfa < 1) sprintf('<a:alpha val="%d"/>', as.integer(round(alfa * 100000))) else ""
  paste0('<a:solidFill><a:srgbClr val="', .lam_hex(col), '">', a, '</a:srgbClr></a:solidFill>')
}

#' Polígono cerrado (la sombra entre líneas), con relleno translúcido y sin borde
#' @keywords internal
.lam_ln_poligono <- function(lz, xs, ys, col, alfa = 0.15, nombre = "sombra") {
  l <- min(xs); t <- min(ys); w <- max(xs) - l; h <- max(ys) - t
  if (w <= 0 || h <= 0) return(invisible(lz))
  W <- round(w * .EMU); H <- round(h * .EMU)
  px <- round((xs - l) * .EMU); py <- round((ys - t) * .EMU)
  pts <- sprintf('<a:pt x="%.0f" y="%.0f"/>', px, py)
  camino <- paste0('<a:moveTo>', pts[1], '</a:moveTo>', paste0('<a:lnTo>', pts[-1], '</a:lnTo>', collapse = ""), '<a:close/>')
  xml <- paste0(
    '<p:sp><p:nvSpPr><p:cNvPr id="0" name="', .lam_xml_esc(nombre), '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>',
    '<p:spPr>', .lam_xfrm(l, t, w, h),
    '<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/>',
    sprintf('<a:pathLst><a:path w="%.0f" h="%.0f">', W, H), camino, '</a:path></a:pathLst></a:custGeom>',
    .lam_ln_relleno(col, alfa), '<a:ln><a:noFill/></a:ln></p:spPr>',
    '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr/></a:p></p:txBody></p:sp>')
  .lam_registrar(lz, xml, l, t, w, h)
}

#' Círculo centrado en (cx, cy) con relleno (translúcido u opaco) y borde opcional punteado
#' @keywords internal
.lam_ln_circulo <- function(lz, cx, cy, r, fill, alfa = 1, borde = NULL, pt = 1, punteado = FALSE, nombre = "punto") {
  linea <- if (is.null(borde)) '<a:ln><a:noFill/></a:ln>' else paste0(
    '<a:ln w="', as.integer(round(pt * 12700)), '"><a:solidFill><a:srgbClr val="', .lam_hex(borde), '"/></a:solidFill>',
    if (punteado) '<a:prstDash val="dash"/>' else '', '</a:ln>')
  xml <- paste0(
    '<p:sp><p:nvSpPr><p:cNvPr id="0" name="', .lam_xml_esc(nombre), '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>',
    '<p:spPr>', .lam_xfrm(cx - r, cy - r, 2 * r, 2 * r), '<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>',
    .lam_ln_relleno(fill, alfa), linea, '</p:spPr>',
    '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr/></a:p></p:txBody></p:sp>')
  .lam_registrar(lz, xml, cx - r, cy - r, 2 * r, 2 * r)
}

#' Rótulo de una sombra entre dos líneas («por horas o fines de semana»), en el tramo donde cabe entero
#'
#' Prueba cada tramo entre niveles contiguos, del más ancho al más angosto, corriendo el texto a lo largo del tramo y en
#' altura: cabe si cada renglón, en sus dos bordes, queda por debajo de la línea de arriba y por encima de la de abajo
#' (las líneas son rectas entre puntos). Si no cabe en ninguno, no se escribe: la franja del total ya nombra esa parte.
#' @param ya,yb Altura (in) de la línea de arriba y la de abajo en cada nivel.
#' @return Lista con la caja del rótulo `c(l, t, r, b)` (vacía si no se escribió): las cifras no la pisan.
#' @keywords internal
.lam_ln_rotulo_banda <- function(lz, rotulo, XS, ya, yb, pt = 8.5) {
  K <- length(XS)
  texto <- paste0(tolower(substr(rotulo, 1, 1)), substring(rotulo, 2))
  lin <- .lam_tyc_envolver(texto, 1.15, pt)
  wk <- .lam_ancho_tinta(lin, pt); lh <- pt * 1.25 / 72; aire <- 0.05
  en <- function(y, j, x) y[j] + (y[j + 1L] - y[j]) * (x - XS[j]) / (XS[j + 1L] - XS[j])
  cabe <- function(j, xc, yc) {
    for (k in seq_along(lin)) {
      yk <- yc + (k - (length(lin) + 1) / 2) * lh
      bordes <- xc + c(-1, 1) * (wk[k] / 2 + aire)
      if (any(bordes < XS[j] + 0.2 | bordes > XS[j + 1L] - 0.2)) return(FALSE)
      if (yk - lh / 2 < max(en(ya, j, bordes)) + aire || yk + lh / 2 > min(en(yb, j, bordes)) - aire) return(FALSE)
    }
    TRUE
  }
  hueco <- (yb[-K] + yb[-1]) / 2 - (ya[-K] + ya[-1]) / 2
  for (j in order(-hueco)) {
    xm <- (XS[j] + XS[j + 1L]) / 2
    for (dx in c(0, 0.1, -0.1, 0.2, -0.2, 0.3, -0.3, 0.4, -0.4)) {
      xc <- xm + dx
      ys <- seq(min(ya[j:(j + 1L)]), max(yb[j:(j + 1L)]), by = 0.02)
      ok <- ys[vapply(ys, function(y) cabe(j, xc, y), logical(1))]
      if (!length(ok)) next
      yc <- stats::median(ok)
      for (k in seq_along(lin)) {
        .lam_tyc_txt(lz, lin[k], xc, yc + (k - (length(lin) + 1) / 2) * lh, wk[k] + 0.04, pt, .std_color("texto_suave"),
                     align = "center", nombre = "lineas:sombra:rotulo")
      }
      alto <- length(lin) * lh
      return(list(c(xc - max(wk) / 2, yc - alto / 2, xc + max(wk) / 2, yc + alto / 2)))
    }
  }
  list()
}

#' Cuerpo del chip de tendencia de la leyenda de series
#' @keywords internal
.LAM_LN_CHIP_PT <- 8.5

#' Ancho del chip pequeño de una serie
#' @keywords internal
.lam_ln_chip_ancho <- function(texto) .lam_ancho_tinta(texto, .LAM_LN_CHIP_PT, TRUE) + 0.34

#' Chip pequeño de una serie: borde continuo si es firme, punteado si es frágil, con su triángulo y su texto
#' @keywords internal
.lam_ln_chip <- function(lz, x, yc, chip) {
  fr <- isTRUE(chip$fragil); w <- .lam_ln_chip_ancho(chip$texto); h <- 0.23
  .lam_forma_borde(lz, x, yc - h / 2, w, h, fill = .std_color(if (fr) "tarjeta_fondo_95" else "tarjeta_fondo"),
                   borde = .std_color(if (fr) "tarjeta_borde_95" else "tarjeta_borde"), borde_pt = if (fr) 1 else 0.75,
                   punteado = fr, geom = "roundRect", radio = 0.06, nombre = if (fr) "chip:95" else "chip:99")
  .lam_tarjeta_triangulo(lz, x + 0.08, yc, chip$dir, fr, alto = 0.075)
  .lam_tyc_txt(lz, chip$texto, x + 0.22, yc, w - 0.24, .LAM_LN_CHIP_PT, .std_color("azul"), bold = TRUE, nombre = "chip:texto")
  invisible(w)
}

#' Escala vertical: el tope deja aire para la cifra del punto más alto; guías cada 10 o 20 puntos
#' @keywords internal
.lam_ln_escala <- function(pmax, ytop, ybot) {
  pmax <- max(5, pmax, na.rm = TRUE)
  alto <- ybot - ytop
  tope <- max(pmax + 6, pmax * alto / max(0.5, alto - 0.5))
  paso <- if (tope > 60) 20 else if (tope > 25) 10 else 5
  guias <- seq(paso, by = paso, length.out = floor((tope - 1) / paso))
  list(tope = tope, guias = guias[guias < tope - 1], y = function(p) ybot - alto * p / tope)
}

#' La protagonista de líneas: dibuja en `caja` y devuelve los ítems del panel lateral
#' @param caja `list(l, t, r, b)` en pulgadas de diseño; `b` incluye los rótulos de los niveles.
#' @return `list(panel, notas)`.
#' @keywords internal
.lam_lineas_nivel_dibujar <- function(lz, espec, caja) {
  azul <- .std_color("azul"); tenue <- .std_color("texto_tenue")
  niv <- espec$niveles; K <- nrow(niv); S <- espec$series
  h_ley <- .lam_ln_leyenda_simbolos_alto(espec)
  ybot <- caja$b - 0.62 - h_ley; x_eje <- caja$l + 0.45
  pmax <- max(unlist(lapply(S, function(s) s$puntos$p)), na.rm = TRUE)
  esc <- .lam_ln_escala(pmax, caja$t, ybot); yv <- esc$y
  # La leyenda de las series va en el panel lateral: las líneas usan todo el ancho de su caja.
  x_fin <- caja$r - 0.45
  XS <- if (K == 1L) (x_eje + x_fin) / 2 else seq(x_eje + 0.55, x_fin, length.out = K)

  # Guías y eje.
  for (gv in esc$guias) {
    .lam_caja(lz, x_eje, yv(gv) - 0.003, caja$r - x_eje, 0.006, .std_color("filete"), nombre = "lineas:guia")
    .lam_tyc_txt(lz, paste0(gv, "%"), x_eje - 0.06, yv(gv), 0.5, 8.5, tenue, align = "right", nombre = "lineas:eje")
  }
  .lam_caja(lz, x_eje, ybot - 0.005, caja$r - x_eje, 0.01, .std_color("tenue"), nombre = "lineas:base")

  # Sombras de las series anidadas (bajo la interior y entre cada par), en el color de su parte del total.
  banda_cajas <- list()
  for (b in espec$bandas %||% list()) {
    pa <- S[[b$arriba]]$puntos$p
    pb <- if (is.na(b$abajo)) rep(0, K) else S[[b$abajo]]$puntos$p
    .lam_ln_poligono(lz, c(XS, rev(XS)), c(yv(pa), rev(yv(pb))), b$color, alfa = if (is.na(b$abajo)) 0.13 else 0.22,
                     nombre = "lineas:sombra")
    if (!is.null(b$rotulo) && K >= 2L) banda_cajas <- c(banda_cajas, .lam_ln_rotulo_banda(lz, b$rotulo, XS, yv(pa), yv(pb)))
  }

  # Líneas: el tramo que toca un punto sin base va punteado.
  for (s in S) {
    pt <- s$puntos
    for (i in seq_len(K - 1L)) {
      .lam_ln_linea(lz, XS[i], yv(pt$p[i]), XS[i + 1L], yv(pt$p[i + 1L]), s$color, pt = 2.6,
                    punteado = !(pt$comparable[i] && pt$comparable[i + 1L]), nombre = "lineas:serie")
    }
  }

  # Puntos y halos.
  for (k in seq_along(S)) {
    s <- S[[k]]; pt <- s$puntos
    for (i in seq_len(K)) {
      x <- XS[i]; y <- yv(pt$p[i])
      marcado <- !is.na(pt$dir[i])
      if (marcado) .lam_ln_circulo(lz, x, y, 0.15, s$color, alfa = 0.12, borde = s$color, pt = 1.4, punteado = isTRUE(pt$fragil[i]),
                                   nombre = if (isTRUE(pt$fragil[i])) "lineas:halo:95" else "lineas:halo:99")
      if (isTRUE(pt$comparable[i])) {
        .lam_ln_circulo(lz, x, y, if (marcado) 0.085 else 0.07, s$color, borde = .std_color("tarjeta_fondo"), pt = 1.6, nombre = "lineas:punto")
      } else {
        .lam_ln_circulo(lz, x, y, 0.07, .std_color("tarjeta_fondo"), borde = s$color, pt = 1.6, nombre = "lineas:punto:sin_base")
      }
    }
  }

  # Cifras: cada una en el primer lugar libre (sin pisar líneas, puntos, el eje ni otra cifra). En cada nivel la serie
  # más alta prueba primero arriba y la más baja abajo; luego los costados y las diagonales. Los puntos marcados se
  # colocan primero. Dos series que coinciden en un nivel llevan una sola cifra.
  segmentos <- do.call(rbind, lapply(S, function(s) {
    y <- yv(s$puntos$p); data.frame(x1 = XS[-K], y1 = y[-K], x2 = XS[-1], y2 = y[-1])
  }))
  puntos <- do.call(rbind, lapply(S, function(s) data.frame(x = XS, y = yv(s$puntos$p), r = ifelse(is.na(s$puntos$dir), 0.08, 0.16))))
  ocupado <- banda_cajas
  libre <- function(r) {
    if (r[2] < caja$t - 0.1 || r[4] > ybot - 0.08 || r[1] < caja$l || r[3] > caja$r) return(FALSE)
    for (o in ocupado) if (r[1] < o[3] && o[1] < r[3] && r[2] < o[4] && o[2] < r[4]) return(FALSE)
    if (nrow(puntos)) {
      dx <- pmax(r[1] - puntos$x, 0, puntos$x - r[3]); dy <- pmax(r[2] - puntos$y, 0, puntos$y - r[4])
      if (any(sqrt(dx^2 + dy^2) < puntos$r)) return(FALSE)
    }
    t <- seq(0, 1, length.out = 30)
    for (q in seq_len(NROW(segmentos))) {
      sx <- segmentos$x1[q] + t * (segmentos$x2[q] - segmentos$x1[q]); sy <- segmentos$y1[q] + t * (segmentos$y2[q] - segmentos$y1[q])
      if (any(sx > r[1] - 0.02 & sx < r[3] + 0.02 & sy > r[2] - 0.02 & sy < r[4] + 0.02)) return(FALSE)
    }
    TRUE
  }
  orden_niv <- lapply(seq_len(K), function(i) order(-vapply(S, function(s) s$puntos$p[i], numeric(1))))
  tareas <- expand.grid(i = seq_len(K), k = seq_along(S))
  tareas$marcado <- mapply(function(i, k) !is.na(S[[k]]$puntos$dir[i]), tareas$i, tareas$k)
  tareas <- tareas[order(!tareas$marcado, tareas$i), , drop = FALSE]
  hecho <- list()
  for (q in seq_len(nrow(tareas))) {
    i <- tareas$i[q]; k <- tareas$k[q]; pt <- S[[k]]$puntos
    lab <- .tarjetas_pct(pt$p[i]); marcado <- tareas$marcado[q]
    clave <- paste(i, lab)
    if (!marcado && !is.null(hecho[[clave]]) && abs(hecho[[clave]] - yv(pt$p[i])) < 0.06) next
    x <- XS[i]; y <- yv(pt$p[i])
    size <- if (marcado) 13 else 11.5
    tw <- .lam_ancho_tinta(lab, size, TRUE); extra <- if (marcado) 0.2 else 0; W <- tw + extra; H <- size * 1.2 / 72
    pos <- match(k, orden_niv[[i]])
    arriba <- pos == 1L || pos < length(S)
    d <- if (marcado) 0.35 else 0.3; lado <- 0.2 + W / 2
    # Orden: su lado (arriba o abajo), los costados, las diagonales de su lado y, al final, el lado de la otra serie
    # (una cifra entre dos líneas se lee como de la otra).
    s_v <- if (arriba) -1 else 1
    izq_primero <- i == 1L || i == K
    costados <- if (izq_primero) list(c(-lado, 0), c(lado, 0)) else list(c(lado, 0), c(-lado, 0))
    cand <- c(list(c(0, s_v * d)), costados, list(c(lado, s_v * d * 0.75), c(-lado, s_v * d * 0.75), c(0, -s_v * d),
                                                   c(lado, -s_v * d * 0.75), c(-lado, -s_v * d * 0.75)))
    elegido <- cand[[1]]
    for (cd in cand) {
      r <- c(x + cd[1] - W / 2, y + cd[2] - H / 2, x + cd[1] + W / 2, y + cd[2] + H / 2)
      if (libre(r)) { elegido <- cd; break }
    }
    xc <- x + elegido[1]; yc <- y + elegido[2]
    ocupado[[length(ocupado) + 1L]] <- c(xc - W / 2, yc - H / 2, xc + W / 2, yc + H / 2)
    hecho[[clave]] <- y
    .lam_tyc_txt(lz, lab, xc - extra / 2, yc, tw + 0.02, size, if (isTRUE(pt$comparable[i])) azul else tenue, bold = TRUE,
                 align = "center", nombre = "lineas:cifra")
    if (marcado) .lam_tarjeta_triangulo(lz, xc - extra / 2 + tw / 2 + 0.07, yc, pt$dir[i], isTRUE(pt$fragil[i]), alto = 0.12)
  }

  # Rótulo de cada nivel y su base.
  pub <- espec$publico %||% "casos"
  for (i in seq_len(K)) {
    .lam_tyc_txt(lz, niv$etiqueta[i], XS[i], ybot + 0.22, 1.9, 11, azul, bold = TRUE, align = "center", nombre = "lineas:nivel")
    n <- niv$n[i]
    .lam_tyc_txt(lz, sprintf("%s %s", format(n, big.mark = ","), if (n == 1L) sub("s$", "", pub) else pub), XS[i], ybot + 0.44, 1.9, 9,
                 tenue, align = "center", nombre = "lineas:n")
  }

  # Al pie, la leyenda de los símbolos; a la derecha (panel lateral), la de las series sobre la lectura.
  if (h_ley > 0) .lam_ln_leyenda_simbolos(lz, espec, caja$l, caja$b - 0.12)
  list(panel = .lam_ln_leyenda_items(espec, caja$t), notas = character(0))
}
