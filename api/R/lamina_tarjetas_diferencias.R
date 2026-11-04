# =============================================================================
# lamina_tarjetas_diferencias.R — la lámina del total con sus tarjetas de diferencias (ADR 0129, propuesta P08)
# =============================================================================
#
# Referencia visual exacta: `generadores/tarjetas2.mjs` de la maqueta del 2026-11-03 (láminas `v2-t*`). Todo en piezas
# nativas y editables, en dos grupos: el gráfico del total a la izquierda y el panel de tarjetas a la derecha.
#
#   - Título = la pregunta, sin subtítulo. El total conserva el tamaño del mazo: rótulos de 11 pt, cifras de 12 pt,
#     barras de hasta 0.36 in (versión 6). Las filas que tienen tarjeta van en negrita.
#   - Panel: una columna de 1/3 del ancho útil con 4 tarjetas o menos; dos columnas en la mitad con 5 o 6.
#   - Tarjeta: antetítulo del cruce, la fila, el total en gris y los grupos con ▲▼ (99%, borde continuo) o △▽ (95%,
#     borde punteado). Sin nota de significancia: solo base y fuente (la lectura va en «Cómo leer las diferencias»).
#
# Se engancha sin crecer `reporte_plan_ppt.R`: `.lam_citas_aplica()` y `.lam_citas_slide_1_nativa()` (lamina_citas.R)
# desvían aquí la lámina cuyo gráfico trae `pulso_tarjetas` con al menos una tarjeta. Sin diferencias, la lámina sigue
# su camino de siempre: el total ocupa la lámina.

#' Medidas de la tarjeta según su ancho (pulgadas y puntos; las de `tarjetas2.mjs`)
#' @keywords internal
.lam_tarjeta_medidas <- function(w, nombres = character(0)) {
  angosta <- w < 3.4; media <- !angosta && w < 4.6
  xn <- if (angosta) 1.3 else if (media) 1.45 else 2.15
  # La columna de rótulos crece hasta el 45% del ancho interno si un nombre la pide; si ni así cabe, se parte.
  if (length(nombres)) xn <- max(xn, min(max(.lam_ancho_tinta(nombres, if (angosta) 9.5 else 10, TRUE)) + 0.04, 0.45 * (w - 0.34)))
  list(angosta = angosta, pad_x = 0.17, pad_t = 0.12, pad_b = 0.1,
       xn = xn, reserva_cifra = if (angosta) 0.62 else 0.72,
       fila = if (angosta) 0.23 else 0.25, barra = if (angosta) 0.15 else 0.16, barra_dy = if (angosta) 0.04 else 0.045,
       pt_cruce = 8, pt_titulo = if (angosta) 10.5 else 11, pt_nombre = if (angosta) 9.5 else 10,
       pt_cifra = if (angosta) 10 else 10.5, alto_cruce = 0.17, aire_titulo = 0.08, aire_total = 0.04)
}

#' Líneas que ocupa un rótulo de grupo en su columna (1 o 2)
#' @keywords internal
.lam_tarjeta_lineas_nombre <- function(nombre, m) min(2L, max(1L, as.integer(.lam_lineas_tinta(nombre, m$xn + 0.2, m$pt_nombre, TRUE))))

#' Alto de una tarjeta (in) en un ancho
#' @keywords internal
.lam_tarjeta_alto <- function(t, w, cortos = character(0), tipo = "multiple") {
  nombres <- .tarjetas_rotulo_grupo(t$grupos$etiqueta, cortos)
  m <- .lam_tarjeta_medidas(w, nombres)
  lineas <- .lam_lineas_tinta(.tarjetas_rotulo_fila(t$fila, tipo), w - 2 * m$pad_x + 0.2, m$pt_titulo, TRUE)
  extra <- sum(vapply(nombres, function(x) .lam_tarjeta_lineas_nombre(x, m) - 1L, integer(1))) * 0.16
  m$pad_t + m$alto_cruce + lineas * m$pt_titulo * 1.2 / 72 + m$aire_titulo + (nrow(t$grupos) + 1L) * m$fila +
    m$aire_total + extra + m$pad_b + 0.02
}

#' Forma con borde (continuo o punteado), relleno opcional y volteo vertical
#' @keywords internal
.lam_forma_borde <- function(lz, l, t, w, h, fill = NULL, borde = NULL, borde_pt = 0.75, punteado = FALSE,
                             geom = "rect", voltear = FALSE, radio = 0, nombre = "forma") {
  av <- if (identical(geom, "roundRect") && radio > 0) sprintf('<a:gd name="adj" fmla="val %d"/>', as.integer(min(50000, 100000 * radio / max(1e-6, min(w, h))))) else ""
  relleno <- if (is.null(fill)) "<a:noFill/>" else paste0('<a:solidFill><a:srgbClr val="', .lam_hex(fill), '"/></a:solidFill>')
  linea <- if (is.null(borde)) "<a:ln><a:noFill/></a:ln>" else paste0(
    '<a:ln w="', as.integer(round(borde_pt * 12700)), '"><a:solidFill><a:srgbClr val="', .lam_hex(borde), '"/></a:solidFill>',
    if (punteado) '<a:prstDash val="dash"/>' else "", '<a:round/></a:ln>')
  xfrm <- sprintf('<a:xfrm%s><a:off x="%.0f" y="%.0f"/><a:ext cx="%.0f" cy="%.0f"/></a:xfrm>', if (voltear) ' flipV="1"' else "",
                  l * .EMU, t * .EMU, max(0, w) * .EMU, max(0, h) * .EMU)
  xml <- paste0(
    '<p:sp><p:nvSpPr><p:cNvPr id="0" name="', .lam_xml_esc(nombre), '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>',
    '<p:spPr>', xfrm, '<a:prstGeom prst="', geom, '"><a:avLst>', av, '</a:avLst></a:prstGeom>', relleno, linea, '</p:spPr>',
    '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr/></a:p></p:txBody></p:sp>')
  .lam_registrar(lz, xml, l, t, w, h)
}

#' Triángulo de dirección: ▲▼ lleno (99%) o △▽ hueco (95%)
#' @keywords internal
.lam_tarjeta_triangulo <- function(lz, x, yc, dir, fragil, alto = 0.075) {
  ancho <- alto * 1.15
  col <- if (isTRUE(fragil)) .std_color("tarjeta_borde_95") else .std_color("azul")
  .lam_forma_borde(lz, x, yc - alto / 2, ancho, alto, fill = if (isTRUE(fragil)) NULL else col, borde = col, borde_pt = 1,
                   geom = "triangle", voltear = identical(dir, "down"), nombre = if (identical(dir, "down")) "tarjeta:menor" else "tarjeta:mayor")
}

#' Backend de dibujo de la tarjeta en piezas nativas del PPT
#'
#' La tarjeta se describe una sola vez (`.lam_tarjeta_dibujar`) contra tres primitivas: `rect`, `txt` (caja de CONTENIDO,
#' sin los márgenes internos del cuadro de texto) y `tri`. El Word usa las mismas con `grid` (reporte_word_tarjetas.R).
#' @keywords internal
.lam_tarjeta_backend_ppt <- function(lz) {
  list(
    rect = function(l, t, w, h, fill = NULL, borde = NULL, pt = 0.75, punteado = FALSE, radio = 0, nombre = "tarjeta:caja") {
      .lam_forma_borde(lz, l, t, w, h, fill = fill, borde = borde, borde_pt = pt, punteado = punteado,
                       geom = if (radio > 0) "roundRect" else "rect", radio = radio, nombre = nombre)
    },
    txt = function(s, l, t, w, h, size, color, bold = FALSE, align = "left", nombre = "tarjeta:texto") {
      .lam_txt(lz, s, l - 0.1, t - 0.05, w + 0.2, h + 0.1, size, color, bold = bold, align = align, nombre = nombre)
    },
    tri = function(x, yc, dir, fragil) .lam_tarjeta_triangulo(lz, x, yc, dir, fragil)
  )
}

#' Dibuja una tarjeta con un backend (`.lam_tarjeta_backend_ppt` o el de grid del Word)
#' @param t Tarjeta de `.tarjetas_seleccionar()`.
#' @param box Caja de la tarjeta `list(l, t, w, h)` en pulgadas de diseño.
#' @param rotulo_cruce Antetítulo («Área»).
#' @keywords internal
.lam_tarjeta_dibujar <- function(b, t, box, rotulo_cruce, cortos = character(0), tipo = "multiple") {
  nombres <- .tarjetas_rotulo_grupo(t$grupos$etiqueta, cortos)
  m <- .lam_tarjeta_medidas(box$w, nombres)
  fr <- isTRUE(t$fragil)
  azul <- .std_color("azul"); suave <- .std_color("texto_suave")
  b$rect(box$l, box$t, box$w, box$h, fill = .std_color(if (fr) "tarjeta_fondo_95" else "tarjeta_fondo"),
         borde = .std_color(if (fr) "tarjeta_borde_95" else "tarjeta_borde"), pt = if (fr) 1.05 else 0.75,
         punteado = fr, radio = 0.0625, nombre = if (fr) "tarjeta:95" else "tarjeta:99")
  x0 <- box$l + m$pad_x; wi <- box$w - 2 * m$pad_x; y <- box$t + m$pad_t
  # Antetítulo del cruce: versalitas de 8 pt, como el antetítulo de la lámina.
  b$txt(toupper(rotulo_cruce), x0, y, wi, m$alto_cruce, m$pt_cruce, suave, bold = TRUE, nombre = "tarjeta:cruce")
  y <- y + m$alto_cruce
  fila <- .tarjetas_rotulo_fila(t$fila, tipo)
  h_tit <- .lam_lineas_tinta(fila, wi + 0.2, m$pt_titulo, TRUE) * m$pt_titulo * 1.2 / 72
  b$txt(fila, x0, y, wi, h_tit, m$pt_titulo, azul, bold = TRUE, nombre = "tarjeta:fila")
  y <- y + h_tit + m$aire_titulo
  ancho_barra <- wi - m$xn - 0.08 - m$reserva_cifra
  maximo <- max(c(t$total, t$grupos$p), na.rm = TRUE) * 1.04
  X <- function(p) x0 + m$xn + 0.08 + if (is.finite(p) && maximo > 0) ancho_barra * p / maximo else 0
  # El rótulo del grupo va siempre en azul y negrita; la cifra lleva el nivel (negrita al 99%, azul medio al 95%).
  renglon <- function(nombre, p, color_barra, color_txt, negrita, color_nombre, nombre_negrita, dir = NULL, fragil = FALSE,
                      alto = m$fila, clase = "grupo", cifra = NULL) {
    h_n <- m$pt_nombre * 1.2 / 72 * .lam_tarjeta_lineas_nombre(nombre, m)
    b$txt(nombre, x0, y + (alto - h_n) / 2, m$xn, h_n, m$pt_nombre, color_nombre, bold = nombre_negrita, align = "right",
          nombre = paste0("tarjeta:", clase, ":rotulo"))
    xb <- x0 + m$xn + 0.08; wb <- X(p) - xb
    if (wb > 0.004) b$rect(xb, y + (alto - m$barra) / 2, wb, m$barra, fill = color_barra, nombre = paste0("tarjeta:", clase, ":barra"))
    cifra <- if (is.null(cifra) || is.na(cifra) || !nzchar(cifra)) .tarjetas_pct(p) else cifra
    h_c <- m$pt_cifra * 1.2 / 72
    w_c <- .lam_ancho_tinta(cifra, m$pt_cifra, negrita)
    b$txt(cifra, X(p) + 0.07, y + (alto - h_c) / 2, w_c + 0.05, h_c, m$pt_cifra, color_txt, bold = negrita,
          nombre = paste0("tarjeta:", clase, ":cifra"))
    if (!is.null(dir)) b$tri(X(p) + 0.07 + w_c + 0.05, y + alto / 2, dir, fragil)
    y <<- y + alto
  }
  renglon("Total", t$total, .std_color("tarjeta_total"), suave, FALSE, suave, FALSE, clase = "total", cifra = t$cifra_total)
  y <- y + m$aire_total
  for (k in seq_len(nrow(t$grupos))) {
    fr_k <- isTRUE(t$grupos$fragil[k])
    alto_k <- m$fila + (.lam_tarjeta_lineas_nombre(nombres[k], m) - 1L) * 0.16
    renglon(nombres[k], t$grupos$p[k], .std_color(if (fr_k) "tarjeta_barra_95" else "azul"),
            .std_color(if (fr_k) "tarjeta_borde_95" else "azul"), !fr_k, azul, TRUE, dir = t$grupos$dir[k], fragil = fr_k,
            alto = alto_k)
  }
  invisible(b)
}

#' Disposición del panel de tarjetas: columnas, ancho y alto de cada fila
#' @param y0,y1 Zona vertical disponible (in).
#' @keywords internal
.lam_tarjetas_disponer <- function(tarjetas, y0, y1, cortos = character(0), tipo = "multiple") {
  g <- .std_geom
  util <- g("ancho") - g("margen_izq") - g("margen_der"); sep <- 0.12
  arma <- function(cols) {
    wp <- if (cols == 1L) util / 3 else util / 2
    xp <- g("ancho") - g("margen_der") - wp
    cw <- (wp - sep * (cols - 1L)) / cols
    altos <- vapply(tarjetas, .lam_tarjeta_alto, numeric(1), w = cw, cortos = cortos, tipo = tipo)
    filas <- split(seq_along(tarjetas), ceiling(seq_along(tarjetas) / cols))
    alto_fila <- vapply(filas, function(i) max(altos[i]), numeric(1))
    total <- sum(alto_fila) + sep * max(0L, length(filas) - 1L)
    list(cols = cols, wp = wp, xp = xp, cw = cw, filas = filas, alto_fila = alto_fila, total = total, sep = sep,
         cabe = total <= y1 - y0 + 1e-6)
  }
  L <- arma(.tarjetas_columnas_ppt(length(tarjetas)))
  if (!L$cabe && L$cols == 1L) L <- arma(2L)
  if (!L$cabe && exists(".pulso_aviso", mode = "function")) {
    .pulso_aviso(sprintf("Tarjetas de diferencias: el panel mide %.2f in y la lámina tiene %.2f in.", L$total, y1 - y0))
  }
  y <- y0 + max(0, (y1 - y0 - L$total) / 2)
  cajas <- list()
  for (r in seq_along(L$filas)) {
    for (c in seq_along(L$filas[[r]])) {
      i <- L$filas[[r]][c]
      cajas[[i]] <- list(l = L$xp + (c - 1L) * (L$cw + L$sep), t = y, w = L$cw, h = L$alto_fila[r])
    }
    y <- y + L$alto_fila[r] + L$sep
  }
  L$cajas <- cajas
  L
}

#' El total a la izquierda: barras horizontales (múltiple, opción única) con la letra del mazo
#' @keywords internal
.lam_tarjetas_total_barras <- function(lz, espec, negritas, x0, ancho, y0, y1) {
  rot <- min(3.4, ancho * 0.42); xb <- x0 + rot + 0.18; wbar <- ancho - rot - 0.18 - 0.65
  n <- length(espec$rotulos); fh <- min(0.9, (y1 - y0) / max(1L, n))
  yi <- y0 + max(0, (y1 - y0 - fh * n) / 2)
  maximo <- max(espec$largos, na.rm = TRUE) * 1.08
  azul <- .std_color("azul")
  for (k in seq_len(n)) {
    yc <- yi + (k - 0.5) * fh; bh <- min(0.36, fh * 0.55)
    w <- if (maximo > 0) wbar * espec$largos[k] / maximo else 0
    neg <- espec$rotulos[k] %in% negritas
    h_r <- .lam_alto_tinta(espec$rotulos[k], rot + 0.2, 11, neg)
    .lam_txt(lz, espec$rotulos[k], x0 - 0.1, yc - h_r / 2, rot + 0.2, h_r, 11, azul, bold = neg, align = "right", nombre = "total:rotulo")
    if (w > 0.004) .lam_caja(lz, xb, yc - bh / 2, w, bh, azul, nombre = "total:barra")
    .lam_txt(lz, espec$cifras[k], xb + w + 0.07 - 0.1, yc - 0.15, 0.9, 0.3, 12, azul, bold = TRUE, nombre = "total:cifra")
  }
  invisible(lz)
}

#' El total de una dicotómica: una barra partida con la cifra grande (lámina T2 de la maqueta)
#' @keywords internal
.lam_tarjetas_total_dicotomica <- function(lz, espec, x0, ancho, y0, y1) {
  w <- ancho - 0.3; ys <- (y0 + y1) / 2 - 0.5
  v <- espec$largos / max(1e-9, sum(espec$largos[1:2]))
  azul <- .std_color("azul"); banda <- .std_color("banda_clara")
  .lam_txt(lz, "Total", x0 + 0.05, ys - 0.45, 4, 0.32, 12, .std_color("texto_suave"), nombre = "total:rotulo")
  x <- x0 + 0.15
  for (k in 1:2) {
    wk <- w * v[k]
    .lam_caja(lz, x, ys, wk, 0.85, if (k == 1L) azul else banda, nombre = "total:barra")
    if (wk > 0.7) .lam_txt(lz, espec$cifras[k], x, ys + 0.18, wk, 0.55, 28, if (k == 1L) "#FFFFFF" else azul, bold = TRUE,
                           align = "center", nombre = "total:cifra")
    .lam_txt(lz, espec$rotulos[k], x - 0.2, ys + 0.92, wk + 0.4, 0.34, 13, if (k == 1L) azul else .std_color("texto_suave"),
             bold = k == 1L, align = "center", nombre = "total:categoria")
    x <- x + wk
  }
  invisible(lz)
}

#' El total de una batería de escala: barra apilada, Top Two Box a la derecha y leyenda debajo (lámina T5)
#' @keywords internal
.lam_tarjetas_total_escala <- function(lz, espec, negritas, x0, ancho, y0, y1) {
  rot <- min(3.0, ancho * 0.4); xb <- x0 + rot + 0.18; wbar <- ancho - rot - 0.18 - 0.95
  filas <- espec$filas; n <- nrow(filas)
  fh <- min(1.0, (y1 - y0 - 0.45) / max(1L, n)); yi <- y0 + 0.2 + max(0, (y1 - y0 - 0.45 - fh * n) / 2)
  azul <- .std_color("azul"); verde <- .std_color("verde_acuerdo")
  cats <- espec$categorias; box <- espec$box
  .lam_txt(lz, box$rotulo %||% "Top Two Box", xb + wbar + 0.05 - 0.1, yi - 0.3, 1.1, 0.3, 10, verde, bold = TRUE, align = "center",
           nombre = "total:encabezado_box")
  for (k in seq_len(n)) {
    yc <- yi + (k - 0.5) * fh
    neg <- filas$rotulo[k] %in% negritas
    h_r <- .lam_alto_tinta(filas$rotulo[k], rot + 0.2, 11, neg)
    .lam_txt(lz, filas$rotulo[k], x0 - 0.1, yc - h_r / 2, rot + 0.2, h_r, 11, azul, bold = neg, align = "right", nombre = "total:rotulo")
    x <- xb
    for (j in seq_len(nrow(cats))) {
      a <- espec$anchos[k, cats$col[j]]
      if (!is.finite(a) || a <= 0) next
      w <- wbar * a
      .lam_caja(lz, x, yc - 0.2, w, 0.4, cats$color[j], nombre = "total:segmento")
      pct <- 100 * a
      if (pct >= 6) .lam_txt(lz, as.character(floor(pct + 0.5)), x - 0.1, yc - 0.13, w + 0.2, 0.28, 11,
                             if (identical(toupper(cats$color[j]), toupper(.std_color("verde_top_two_box")))) "#FFFFFF" else azul,
                             bold = TRUE, align = "center", nombre = "total:segmento:cifra")
      x <- x + w
    }
    cif <- if (length(box$cifras) >= k) box$cifras[k] else ""
    .lam_txt(lz, cif, xb + wbar + 0.05 - 0.1, yc - 0.17, 1.1, 0.36, 15, verde, bold = TRUE, align = "center", nombre = "total:box")
  }
  # Leyenda: cuadro de color y rótulo, en filas que caben en el ancho de las barras.
  yl <- yi + n * fh + 0.04; xl <- xb
  for (j in seq_len(nrow(cats))) {
    w_txt <- .lam_ancho_tinta(cats$rotulo[j], 9) + 0.2
    if (xl + 0.15 + w_txt > xb + wbar + 0.9) { xl <- xb; yl <- yl + 0.2 }
    .lam_caja(lz, xl, yl + 0.045, 0.11, 0.11, cats$color[j], nombre = "total:leyenda:color")
    .lam_txt(lz, cats$rotulo[j], xl + 0.11, yl - 0.02, w_txt, 0.24, 9, azul, nombre = "total:leyenda:rotulo")
    xl <- xl + 0.11 + w_txt + 0.06
  }
  invisible(lz)
}

#' ¿La lámina va con su panel de tarjetas? Solo si hay al menos una diferencia que mostrar
#' @keywords internal
.lam_tarjetas_aplica <- function(p, slide = NULL) {
  if (identical((slide$meta %||% list())$motor_nativo, FALSE) || !inherits(p, "ggplot")) return(FALSE)
  t <- attr(p, "pulso_tarjetas")
  espec <- attr(p, "pulso_espec")
  !is.null(t) && length(t$tarjetas) > 0L && !is.null(espec) && espec$tipo %in% c("categorica", "escala")
}

#' Lámina del total con su panel de tarjetas
#' @return Lista con `doc`.
#' @keywords internal
.lam_laminas_tarjetas <- function(doc, p, titulo, ante = NULL, base = NULL, folio = NULL, layout = "Graficos2",
                                  master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  t <- attr(p, "pulso_tarjetas"); espec <- attr(p, "pulso_espec")
  g <- .std_geom
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante)   # versión 6: título = pregunta, sin subtítulo
  fin <- .lam_titulo_fin(titulo)
  y0 <- fin + 0.32; y1 <- g("base_y") - 0.12
  cortos <- t$opcion$cortos
  L <- .lam_tarjetas_disponer(t$tarjetas, y0, y1, cortos = cortos, tipo = t$tipo)
  lz <- .lam_lienzo()
  for (i in seq_along(t$tarjetas)) {
    tj <- t$tarjetas[[i]]
    .lam_tarjeta_dibujar(.lam_tarjeta_backend_ppt(lz), tj, L$cajas[[i]], unname(t$rotulos_cruce[tj$cruce]) %||% tj$cruce, cortos = cortos, tipo = t$tipo)
  }
  # El total: de la izquierda al panel, con la misma letra del mazo.
  x0 <- g("margen_izq"); ancho <- L$xp - 0.45 - x0
  lt <- .lam_lienzo()
  negritas <- unique(vapply(t$tarjetas, `[[`, character(1), "fila"))
  yd0 <- fin + 0.38; yd1 <- g("base_y") - 0.1
  if (identical(t$tipo, "bateria")) {
    .lam_tarjetas_total_escala(lt, espec, negritas, x0, ancho, yd0, yd1)
  } else if (identical(t$tipo, "dicotomica") && length(espec$rotulos) == 2L) {
    .lam_tarjetas_total_dicotomica(lt, espec, x0, ancho, yd0, yd1)
  } else {
    .lam_tarjetas_total_barras(lt, espec, negritas, x0, ancho, yd0, yd1)
  }
  doc <- .lam_agrupar(doc, lt, nombre = "prosecnur:grafico:total")
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:tarjetas_diferencias")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' La rama `slide_1` con tarjetas: resuelve la base como la lámina nativa y compone (enganche de lamina_citas.R)
#' @keywords internal
.lam_tarjetas_slide_1 <- function(doc, p, slide, titulo, el_plot, presets, layout, master, antetitulo, base_auto, nota_de,
                                  sin_base = FALSE, sin_pie = FALSE, por_lamina = function(doc) doc) {
  slots <- slide$slots %||% list()
  texto <- function(x) {
    v <- if (inherits(x, "ppt_element_text")) x$text else if (is.character(x)) x else NULL
    if (is.null(v) || !length(v) || is.na(v[1]) || !nzchar(trimws(v[1]))) NULL else trimws(as.character(v)[1])
  }
  base <- if (isTRUE(sin_base)) NULL else texto(slots$base)
  if (!isTRUE(sin_base) && is.null(base)) {
    base <- texto(base_auto(el = el_plot, sufijo_auto = presets$base$args$sufijo_auto %||% NULL,
                            formato = presets$base$args$formato %||% "Base: %s"))
  }
  pie <- if (isTRUE(sin_pie)) NULL else texto(slots$footer)
  if (!isTRUE(sin_pie) && is.null(pie)) pie <- texto(nota_de(p, el_plot$overrides$nota_pie %||% el_plot$nota_pie %||% NULL))
  if (!isTRUE(sin_base) && is.null(base) && is.null(pie)) base <- texto((attr(p, "pulso_espec") %||% list())$nota)
  .lam_laminas_tarjetas(doc, p, titulo = texto(titulo) %||% "", ante = texto(antetitulo), base = .lam_unir_base(base, pie),
                        folio = length(doc) + 1L, layout = layout, master = master, por_lamina = por_lamina)$doc
}
