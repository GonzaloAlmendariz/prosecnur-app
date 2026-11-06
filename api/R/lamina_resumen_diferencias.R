# =============================================================================
# lamina_resumen_diferencias.R — la lámina nativa del resumen de diferencias por capítulo (especificación 2026-11-04, §1)
# =============================================================================
#
# Referencia visual: `10_resumen_diferencias_por_capitulo.png` de la maqueta del 2026-11-04. Todo en piezas nativas y
# editables, en un grupo:
#
#   - antetítulo «Resumen de diferencias» y título de la lámina, como las demás láminas nativas (`.lam_titulo`);
#   - encabezado de dos pisos: el cruce en versalitas grises con su filete y, debajo, el rótulo corto de cada grupo;
#   - filas agrupadas por capítulo (rótulo del capítulo en versalitas coral), cada una sobre su franja blanca: el rótulo,
#     el total en negrita y una celda por grupo;
#   - la celda: con diferencia, una pastilla con los puntos frente al resto y su triángulo (▲▼ al 99%, en azul si es
#     mayor y naranja si es menor, color pleno; △▽ al 95%, color tenue con borde punteado); sin diferencia, un punto
#     gris sin cifra; con el cruce tautológico, «n. a.»;
#   - leyenda de los triángulos en una línea y la base sola (sin «Fuente»), con el pie de las demás. El método no se
#     repite: lo explica la lámina «Cómo leer las diferencias» (revisión del PPT v7.11 de CCSS, lámina 59).
#
# Aquí viven también las piezas que comparte la lámina de hallazgos (lamina_hallazgos.R): el tono de cada marca, el
# triángulo, la pastilla y la leyenda.
#
# Se engancha sin crecer `reporte_plan_ppt.R`: `.lam_compositor_aplica()` y `.lam_slide_1_nativa()` (lamina_compositor.R)
# desvían aquí la espec `resumen_diferencias` (y `hallazgos`) con `.lam_dif_slide_1()`.

#' ¿La espec es de una de las láminas de diferencias (resumen o hallazgos)?
#' @keywords internal
.lam_dif_es <- function(p) {
  espec <- if (inherits(p, "ggplot")) attr(p, "pulso_espec") else NULL
  is.list(espec) && as.character(espec$tipo %||% "")[1] %in% c("resumen_diferencias", "hallazgos")
}

#' Tono de una marca: relleno, borde, texto y triángulo según la dirección y el nivel
#' @keywords internal
.lam_dif_tono <- function(dir, fragil) {
  abajo <- identical(dir, "down"); fr <- isTRUE(fragil)
  if (!fr && !abajo) return(list(fill = .std_color("azul"), borde = .std_color("azul"), texto = "#FFFFFF", linea = .std_color("azul"), punteado = FALSE))
  if (!fr && abajo) return(list(fill = .std_color("naranja_bottom_two_box"), borde = .std_color("naranja_bottom_two_box"), texto = "#FFFFFF",
                                linea = .std_color("naranja_bottom_two_box_texto"), punteado = FALSE))
  if (fr && !abajo) return(list(fill = .std_color("tarjeta_fondo_95"), borde = .std_color("tarjeta_borde_95"), texto = .std_color("tarjeta_borde_95"),
                                linea = .std_color("tarjeta_borde_95"), punteado = TRUE))
  list(fill = .std_color("fondo_destacado"), borde = .std_color("naranja_bottom_two_box"), texto = .std_color("naranja_bottom_two_box_texto"),
       linea = .std_color("naranja_bottom_two_box"), punteado = TRUE)
}

#' Triángulo de dirección, lleno (99%) o hueco (95%)
#' @keywords internal
.lam_dif_triangulo <- function(lz, x, yc, dir, color, lleno = TRUE, alto = 0.085, nombre = NULL) {
  ancho <- alto * 1.15
  .lam_forma_borde(lz, x, yc - alto / 2, ancho, alto, fill = if (isTRUE(lleno)) color else NULL, borde = color, borde_pt = 1,
                   geom = "triangle", voltear = identical(dir, "down"),
                   nombre = nombre %||% if (identical(dir, "down")) "diferencia:menor" else "diferencia:mayor")
  invisible(ancho)
}

#' Puntos de diferencia con signo tipográfico («+23», «−14»)
#' @keywords internal
.lam_dif_puntos <- function(valor) paste0(ifelse(valor >= 0, "+", "−"), floor(abs(round(valor, 6)) + 0.5))

#' Pastilla de una celda con diferencia: los puntos y el triángulo, centrados en `cx`
#' @keywords internal
.lam_dif_pastilla <- function(lz, cx, yc, w, h, valor, dir, fragil, pt = 9.5) {
  tn <- .lam_dif_tono(dir, fragil)
  .lam_forma_borde(lz, cx - w / 2, yc - h / 2, w, h, fill = tn$fill, borde = tn$borde, borde_pt = if (tn$punteado) 1 else 0.75,
                   punteado = tn$punteado, geom = "roundRect", radio = 0.035,
                   nombre = paste0("resumen:celda:", if (isTRUE(fragil)) "95" else "99"))
  txt <- .lam_dif_puntos(valor)
  wt <- .lam_ancho_tinta(txt, pt, TRUE); at <- 0.085 * 1.15; sep <- 0.05
  xi <- cx - (wt + sep + at) / 2
  .lam_tyc_txt(lz, txt, xi, yc, wt + 0.04, pt, tn$texto, bold = TRUE, nombre = "resumen:celda:puntos")
  .lam_dif_triangulo(lz, xi + wt + sep, yc, dir, tn$texto, lleno = !isTRUE(fragil))
}

#' Leyenda de los triángulos: mayor, menor, 99% y 95% de confianza, en una línea desde `x`
#' @return Ancho usado (in).
#' @keywords internal
.lam_dif_leyenda <- function(lz, x, yc, regla = NULL, pt = 9) {
  suave <- .std_color("texto_suave"); azul <- .std_color("azul"); nar <- .std_color("naranja_bottom_two_box")
  conf <- if (is.null(regla)) "95%" else .tarjetas_confianza(regla)
  x0 <- x; a <- 0.085 * 1.15
  item <- function(dibujar, texto) {
    w_icono <- dibujar(x)
    .lam_tyc_txt(lz, texto, x + w_icono + 0.07, yc, .lam_ancho_tinta(texto, pt) + 0.04, pt, suave, nombre = "leyenda:texto")
    x <<- x + w_icono + 0.07 + .lam_ancho_tinta(texto, pt) + 0.42
  }
  item(function(xx) .lam_dif_triangulo(lz, xx, yc, "up", azul, nombre = "leyenda:mayor"), "Mayor que el resto")
  item(function(xx) .lam_dif_triangulo(lz, xx, yc, "down", nar, nombre = "leyenda:menor"), "Menor que el resto")
  item(function(xx) { .lam_dif_triangulo(lz, xx, yc, "up", azul, nombre = "leyenda:99"); .lam_dif_triangulo(lz, xx + a + 0.03, yc, "down", azul, nombre = "leyenda:99"); 2 * a + 0.03 },
       "99% de confianza")
  item(function(xx) { .lam_dif_triangulo(lz, xx, yc, "up", azul, lleno = FALSE, nombre = "leyenda:95"); .lam_dif_triangulo(lz, xx + a + 0.03, yc, "down", azul, lleno = FALSE, nombre = "leyenda:95"); 2 * a + 0.03 },
       paste(conf, "de confianza"))
  x - x0
}

#' Alto de la nota al pie (o 0 sin nota), con la misma medida que `.lam_nota_sig_dibujar`
#' @keywords internal
.lam_dif_alto_nota <- function(nota) if (is.null(nota) || !nzchar(nota)) 0 else .lam_nota_sig_alto(nota)

#' Parte de abajo de la lámina: leyenda, nota fija y la base con el folio. Devuelve el documento y el límite de contenido
#' @keywords internal
.lam_dif_pie <- function(doc, espec, base, folio, leyenda = TRUE) {
  alto_nota <- .lam_dif_alto_nota(espec$nota)
  y_ley <- .std_valor("ppt", "geometria", "base_y") - alto_nota - 0.2
  if (isTRUE(leyenda)) {
    lz <- .lam_lienzo()
    .lam_dif_leyenda(lz, .std_geom("margen_izq"), y_ley, espec$regla)
    doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:leyenda_diferencias")
  }
  if (alto_nota > 0) doc <- .lam_nota_sig_dibujar(doc, espec$nota)
  .lam_pie(doc, base, folio)
}

#' Límite inferior del contenido: sobre la leyenda y la nota
#' @keywords internal
.lam_dif_limite <- function(espec) .std_valor("ppt", "geometria", "base_y") - .lam_dif_alto_nota(espec$nota) - 0.2 - 0.2

#' Recorta un texto a un ancho con «…» (corte por palabra); devuelve el texto y si se recortó
#' @keywords internal
.lam_dif_recortar <- function(s, w, pt, bold = FALSE) {
  if (.lam_ancho_tinta(s, pt, bold) <= w) return(list(texto = s, recortado = FALSE))
  pal <- strsplit(s, "\\s+")[[1]]
  while (length(pal) > 1L && .lam_ancho_tinta(paste0(paste(pal, collapse = " "), "…"), pt, bold) > w) pal <- pal[-length(pal)]
  list(texto = paste0(paste(pal, collapse = " "), "…"), recortado = TRUE)
}

#' Base de la lámina: la declarada o «Base: N público»
#' @keywords internal
.lam_dif_base <- function(slide, espec, sin_base = FALSE) {
  if (isTRUE(sin_base)) return(NULL)
  b <- (slide$slots %||% list())$base
  b <- if (inherits(b, "ppt_element_text")) b$text else if (is.character(b)) b else NULL
  b <- .dif_chr1(b)
  b %||% sprintf("Base: %s %s.", format(espec$n %||% 0, big.mark = ","), espec$publico %||% "casos")
}

#' La rama `slide_1` de las láminas de diferencias (enganche de `.lam_slide_1_nativa`)
#' @keywords internal
.lam_dif_slide_1 <- function(doc, p, slide, titulo, antetitulo, layout, master, por_lamina = function(doc) doc, sin_base = FALSE) {
  espec <- attr(p, "pulso_espec")
  texto <- function(x) if (is.null(x) || !length(x) || is.na(x[1]) || !nzchar(trimws(as.character(x)[1]))) NULL else trimws(as.character(x)[1])
  f <- if (identical(espec$tipo, "hallazgos")) .lam_laminas_hallazgos else .lam_laminas_resumen_diferencias
  f(doc, espec, titulo = texto(titulo) %||% "", ante = texto(antetitulo), base = .lam_dif_base(slide, espec, sin_base),
    folio = length(doc) + 1L, layout = layout, master = master, por_lamina = por_lamina)$doc
}

# ---- la tabla ------------------------------------------------------------------------------------------------------

#' Geometría de columnas de la tabla: rótulo, total y una columna por grupo
#'
#' v7.23, ítem 13: cada columna de grupo mide lo que su rótulo corto pide en UNA línea (`.lam_resumen_pisos`); el resto
#' del ancho se reparte entre el rótulo de la fila (lo que pide, hasta donde alcance) y las columnas (hasta 0.9 in).
#' @keywords internal
.lam_resumen_columnas <- function(espec, x0, x1) {
  K <- nrow(espec$columnas)
  rot <- unlist(lapply(espec$capitulos, function(c) vapply(c$filas, `[[`, "", "rotulo")))
  w_tot <- 0.7; util <- x1 - x0
  necesita <- if (length(rot)) max(.lam_ancho_tinta(rot, 10)) + 0.3 else 3
  # v7.25, ítem 9: el nombre completo del grupo cuando cabe (en una o dos líneas); si no, el corto.
  et <- espec$columnas$etiqueta %||% espec$columnas$corto
  ps <- if (K) .lam_resumen_rotulos_grupo(et, espec$columnas$corto, util - w_tot, cruces = espec$columnas$cruce,
                                       w_rot_min = unique(c(max(2.6, min(necesita, 3.4)), 2.6))) else list(piso = numeric(0), pt = 9.5, una_linea = TRUE)
  piso <- ps$piso
  meta <- if (K) min(0.9, (util - necesita - w_tot) / K) else 0
  # Si los pisos se comen el ancho del rótulo, las demás columnas ceden hasta su propio piso.
  while (K && sum(pmax(piso, meta)) > util - necesita - w_tot && meta > min(piso)) meta <- meta - 0.01
  cw <- pmax(piso, meta)
  w_rot <- util - w_tot - sum(cw)
  xs <- x0 + w_rot + w_tot + cumsum(cw) - cw / 2
  list(w_rot = w_rot, x_tot = x0 + w_rot + w_tot / 2, w_tot = w_tot, cw = cw, xs = xs, K = K, pt_grupo = ps$pt, una_linea = ps$una_linea,
       lineas = ps$lineas)
}

#' Encabezado de la tabla (el cruce sobre sus grupos, con su filete, y el rótulo corto de cada grupo) desde `y_h`
#' @return El `y` donde empiezan las filas.
#' @keywords internal
.lam_resumen_encabezado <- function(lz, espec, C, y_h) {
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); cols <- espec$columnas; pt <- C$pt_grupo
  for (cr in unique(cols$cruce)) {
    i <- which(cols$cruce == cr)
    xa <- C$xs[min(i)] - C$cw[min(i)] / 2 + 0.05; xb <- C$xs[max(i)] + C$cw[max(i)] / 2 - 0.05
    rc <- toupper(espec$rotulos_cruce[[cr]] %||% cr)
    .lam_tyc_txt(lz, rc, (xa + xb) / 2, y_h + 0.09, max(xb - xa, .lam_ancho_tinta(rc, 8.5, TRUE) + 0.15), 8.5, suave, bold = TRUE,
                 align = "center", nombre = "resumen:cruce")
    .lam_caja(lz, xa, y_h + 0.22, xb - xa, 0.012, .std_color("filete"), nombre = "resumen:cruce:filete")
  }
  y_g <- y_h + 0.32; lh <- pt * 1.2 / 72
  n_lin <- 1L
  for (k in seq_len(C$K)) {
    lin <- if (!is.null(C$lineas)) C$lineas[[k]] else if (isTRUE(C$una_linea)) cols$corto[k] else utils::head(.lam_tyc_envolver(cols$corto[k], C$cw[k] - 0.12, pt, TRUE), 2L)
    n_lin <- max(n_lin, length(lin))
    # Una línea: la caja de texto es tan ancha como el rótulo pide (el piso de la columna ya lo garantiza).
    for (j in seq_along(lin)) .lam_tyc_txt(lz, lin[j], C$xs[k], y_g + (j - 0.5) * lh, max(C$cw[k] - 0.04, .lam_ancho_tinta(lin[j], pt, TRUE) + 0.04),
                                          pt, azul, bold = TRUE, align = "center", nombre = "resumen:grupo")
  }
  .lam_tyc_txt(lz, "Total", C$x_tot, y_g + 0.5 * lh, C$w_tot, 9.5, azul, bold = TRUE, align = "center", nombre = "resumen:total:encabezado")
  y_g + n_lin * lh + 0.12
}

#' Filas de una lámina: capítulos con su rótulo y cada fila con su total y sus celdas, desde `y`, con renglón `h`
#' @return Número de rótulos de fila recortados.
#' @keywords internal
.lam_resumen_filas <- function(lz, espec, C, caps, x0, x1, y, h, h_letra = h) {
  azul <- .std_color("azul"); cols <- espec$columnas; recortes <- 0L
  cu <- .lam_resumen_cuerpos(h_letra)   # con alto de sobra, letra y pastilla mayores (v7.25, ítem 9)
  for (cp in caps) {
    .lam_tyc_txt(lz, toupper(cp$titulo), x0, y + .LAM_RESUMEN_CAPITULO * h / 2, C$w_rot + C$w_tot, 8.5, .std_color("coral"), bold = TRUE,
                 nombre = "resumen:capitulo")
    y <- y + .LAM_RESUMEN_CAPITULO * h
    for (f in cp$filas) {
      lin <- .lam_resumen_fila_lineas(f$rotulo, C$w_rot - 0.2)
      hf <- if (length(lin) > 1L) .LAM_RESUMEN_FILA_DOBLE * h else h
      yc <- y + hf / 2
      .lam_caja(lz, x0, y + 0.015, x1 - x0, hf - 0.03, .std_color("tarjeta_fondo"), nombre = "resumen:franja")
      if (any(endsWith(lin, "…"))) recortes <- recortes + 1L
      pt_f <- if (length(lin) > 1L) cu$fila - 0.5 else cu$fila
      # Con la letra mayor, un rótulo que cabía en una línea a 10 pt puede no caber: va en dos si el renglón las admite;
      # si no, baja medio punto hasta 9.5.
      if (length(lin) == 1L && .lam_ancho_tinta(lin, pt_f) > C$w_rot - 0.2) {
        l2 <- .lam_tyc_envolver(lin, C$w_rot - 0.2, pt_f - 0.5)
        if (length(l2) == 2L && 2 * (pt_f - 0.5) * 1.15 / 72 <= hf - 0.03) { lin <- l2; pt_f <- pt_f - 0.5 }
      }
      while (pt_f > 9.5 && max(.lam_ancho_tinta(lin, pt_f)) > C$w_rot - 0.2) pt_f <- pt_f - 0.5
      lh <- pt_f * 1.15 / 72
      for (j in seq_along(lin)) .lam_tyc_txt(lz, lin[j], x0 + 0.08, yc + (j - (length(lin) + 1) / 2) * lh, C$w_rot - 0.12, pt_f, azul,
                                            nombre = "resumen:fila")
      .lam_tyc_txt(lz, .tarjetas_pct(f$total), C$x_tot, yc, C$w_tot, cu$total, azul, bold = TRUE, align = "center", nombre = "resumen:total")
      ce <- f$celdas
      for (k in seq_len(C$K)) {
        e <- if (is.null(ce)) NULL else ce[ce$cruce == cols$cruce[k] & ce$codigo == cols$codigo[k], , drop = FALSE]
        est <- if (is.null(e) || !nrow(e)) "sin_prueba" else e$estado[1]
        if (identical(est, "dif")) {
          .lam_dif_pastilla(lz, C$xs[k], yc, min(C$cw[k] - 0.08, cu$pastilla_w), cu$pastilla_h, e$valor[1], e$dir[1], e$fragil[1], pt = cu$pastilla)
        } else if (identical(est, "na")) {
          .lam_tyc_txt(lz, "n. a.", C$xs[k], yc, C$cw[k] - 0.06, 8, .std_color("texto_tenue"), align = "center", nombre = "resumen:celda:na")
        } else {
          .lam_caja(lz, C$xs[k] - 0.025, yc - 0.025, 0.05, 0.05, .std_color("tarjeta_total"), geom = "ellipse", nombre = "resumen:celda:igual")
        }
      }
      y <- y + hf
    }
  }
  recortes
}

#' Láminas del resumen de diferencias: una o varias, por capítulos enteros (v7.23, ítem 13)
#' @return Lista con `doc` y `partes` (láminas agregadas).
#' @keywords internal
.lam_laminas_resumen_diferencias <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, layout = "Graficos2",
                                             master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  aviso <- function(...) .dif_aviso("Resumen de diferencias", ...)
  # Revisión del PPT v7.11 de CCSS (lámina 59): «¿por qué pones una nota tan grande si todo eso ya se explica al inicio?».
  # El método ya lo explica la lámina «Cómo leer las diferencias»: aquí quedan la leyenda de los símbolos y la base. La
  # nota sigue en la espec para el respaldo en ggplot (`motor_nativo = FALSE`).
  espec$nota <- NULL
  g <- .std_geom
  x0 <- g("margen_izq"); x1 <- g("ancho") - g("margen_der") - 0.1
  C <- .lam_resumen_columnas(espec, x0, x1)
  if (!isTRUE(C$una_linea)) aviso("los rótulos de grupo no caben en una línea; declara rótulos más cortos en `cortos`.")
  titulos <- list(titulo, .particion_titulo_cont(titulo) %||% titulo)
  # Alto disponible para filas: el de la lámina con el título más alto (el «(cont.)» puede ocupar una línea más).
  y_filas <- function(tk) .lam_resumen_encabezado(.lam_lienzo(), espec, C, .lam_titulo_fin(tk) + 0.12)
  y_lim <- .lam_dif_limite(espec)
  disponible <- y_lim - max(vapply(titulos, y_filas, numeric(1)))
  caps <- Filter(function(c) length(c$filas) > 0L, espec$capitulos)
  u <- vapply(caps, .lam_resumen_unidades, numeric(1), w_rot = C$w_rot - 0.2)
  paginas <- .lam_resumen_paginar(u, disponible)
  # Renglón común a todas las láminas; un capítulo que no cabe solo ni a `H_MIN` pierde sus últimas filas (con aviso).
  max_u <- if (length(paginas)) max(vapply(paginas, function(i) sum(u[i]), numeric(1))) else 1
  if (length(paginas) && disponible / max_u < .LAM_RESUMEN_H_MIN) {
    for (q in seq_along(paginas)) {
      i <- paginas[[q]]
      while (sum(u[i]) > disponible / .LAM_RESUMEN_H_MIN) {
        ult <- i[length(i)]
        if (length(caps[[ult]]$filas) > 1L) caps[[ult]]$filas <- caps[[ult]]$filas[-length(caps[[ult]]$filas)] else { i <- i[-length(i)]; paginas[[q]] <- i }
        u[ult] <- .lam_resumen_unidades(caps[[ult]], C$w_rot - 0.2)
        if (!length(i)) break
      }
    }
    aviso("las filas no caben en la lámina; se quitaron las últimas. Reduce la lista.")
    max_u <- max(vapply(paginas, function(i) sum(u[i]), numeric(1)))
  }
  h <- min(.LAM_RESUMEN_H_MAX, disponible / max(1, max_u))
  if (!length(paginas)) paginas <- list(integer(0))
  recortes <- 0L
  for (q in seq_along(paginas)) {
    tk <- titulos[[if (q == 1L) 1L else 2L]]
    doc <- officer::add_slide(doc, layout = layout, master = master)
    doc <- .lam_titulo(doc, tk, ante = ante, avisar = q == 1L)
    lz <- .lam_lienzo()
    y <- .lam_resumen_encabezado(lz, espec, C, .lam_titulo_fin(tk) + 0.12)
    # v7.25, ítem 9: cada lámina reparte SU alto (la primera ya no deja aire al pie porque la segunda va más llena); la
    # letra es la misma en todas, la del renglón común.
    h_q <- if (length(paginas[[q]])) min(.LAM_RESUMEN_H_MAX, max(h, disponible / max(1, sum(u[paginas[[q]]])))) else h
    recortes <- recortes + .lam_resumen_filas(lz, espec, C, caps[paginas[[q]]], x0, x1, y, h_q, h_letra = h)
    doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:resumen_diferencias")
    doc <- .lam_dif_pie(doc, espec, base, if (is.null(folio)) NULL else folio + q - 1L)
    doc <- por_lamina(doc)
  }
  if (recortes) aviso(sprintf("%d rótulo(s) no caben en dos líneas y se recortaron con «…»; acórtalos.", recortes))
  list(doc = doc, partes = length(paginas))
}
