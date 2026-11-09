# =============================================================================
# lamina_cobertura_categorias.R — cobertura por categorías frente al universo, con formas nativas (ADR 0140)
# =============================================================================
#
# El lenguaje visual de la cobertura y participación (lamina_cobertura.R): barras sobre una línea de base, la de la
# muestra en el azul del estándar y la del universo en gris, cada una con su cifra al extremo y la leyenda arriba. Por
# categoría, a la izquierda, su nombre y su n en segundo plano ("n = 129"); a la derecha, la diferencia en puntos. Con
# varias bases, un bloque de categorías por base bajo el nombre de la base. Lo mismo a página entera
# (`.lam_laminas_cobcat`) y en una ranura de la lámina de dos o de cuatro gráficos (`.lam_rr_cobcat_*`); las dos usan la
# misma geometría (`.lam_cobcat_geo`) dentro de su rectángulo.
#
# El enfoque son los porcentajes: las cifras de las barras son % y la diferencia sale de los valores sin redondear
# (graficos_cobertura_categorias.R). Las notas (base por público, universo, filtro, "Sin ponderar", lo que queda fuera de
# las barras, tolerancia) van al pie.

.COBCAT_FILAS_MAX <- 14L
.COBCAT_AIRE_FILAS_MIN <- 0.06   # aire mínimo entre las barras de dos categorías (in)
.COBCAT_AIRE_DER <- 0.2   # aire entre la columna de la diferencia y el borde derecho de su rectángulo (in)

#' ¿Es la especificación de la versión por categorías?
#' @keywords internal
.lam_es_cobcat <- function(espec) is.list(espec) && identical(espec$version, .COBCAT_VERSION)

#' Geometría dentro de un rectángulo: columnas de rótulo, n, barras, cifras y diferencia; alto de cada fila
#'
#' @param escala `"pagina"` o `"ranura"` (letras y mínimos de cada una).
#' @return Lista con `cabe` y lo que el dibujo necesita.
#' @keywords internal
.lam_cobcat_geo <- function(espec, x, y, w, h, escala = c("pagina", "ranura")) {
  escala <- match.arg(escala)
  if (!.lam_es_cobcat(espec)) return(list(cabe = FALSE))
  pg <- identical(escala, "pagina")
  bl <- espec$bloques
  filas <- sum(vapply(bl, function(b) NROW(b$filas), 0L))
  if (filas < 1L || filas > .COBCAT_FILAS_MAX) return(list(cabe = FALSE))
  ley <- if (pg) 0.4 else 0.32
  hcab <- if (pg) 0.4 else 0.32
  # La barra lleva el grosor de la casa (`.std_piso_panel_in`, 0.66 cm: R5 de verificar_mazo), nunca menos. Primero baja
  # el aire entre filas hasta el mínimo de la casa; si ni así caben, van las bases ENTERAS que quepan (las categorías de
  # una base suman el 100 % y se leen juntas: nunca una parte de una base) y la lámina dice cuáles van en otra. Si no cabe
  # ni una base entera, la lámina va dibujada (con su aviso).
  g_min <- .std_piso_panel_in(); fila_min <- .COBCAT_FILA_MIN()
  por_bloque <- vapply(bl, function(b) NROW(b$filas), 0L)
  m <- .cobcat_bases_que_caben(espec, h, pg)
  if (m < 1L) {
    .pulso_aviso(.aviso_en_lamina(paste0("Por espacio, ninguna base de la cobertura por categorías cabe entera con barras del ",
                                         "grosor de la casa y el gráfico va como imagen; para verlo nativo, usa una lámina de un ",
                                         "gráfico o una base por gráfico.")))
    return(list(cabe = FALSE))
  }
  omitidos <- if (m < length(bl)) vapply(bl[-seq_len(m)], function(b) as.character(b$publico %||% b$base)[1], "") else character(0)
  mostrados <- vapply(bl[seq_len(m)], function(b) as.character(b$publico %||% b$base)[1], "")
  cabeceras <- if (length(bl) > 1L || isTRUE(espec$varias_bases)) m else 0L
  vis <- c(por_bloque[seq_len(m)], rep(0L, length(bl) - m))
  bl <- bl[seq_len(m)]; filas <- sum(vis)
  disponible <- h - ley - hcab * cabeceras - 0.05
  hrow <- min(max(fila_min, if (pg) 1.0 else 0.6), disponible / filas)
  rotulos <- unlist(lapply(bl, function(b) b$filas$etiqueta))
  ns <- unlist(lapply(bl, function(b) b$filas$texto_n))
  # El rótulo baja de a medio punto hasta el piso de 10.5 pt; si no cabe en su tope, la lámina va dibujada.
  tope <- if (pg) 3.6 else min(2.4, w * 0.36)
  size_r <- NA_real_
  for (sz in .lam_rotulo_pasos_pt(if (pg) 13 else 11)) {
    if (max(.lam_ancho_tinta(rotulos, sz, FALSE)) + 0.25 <= tope) { size_r <- sz; break }
  }
  if (!is.finite(size_r)) return(list(cabe = FALSE))
  size_n <- if (pg) 10.5 else 10
  size_v <- if (pg) 11 else 10
  size_d <- if (pg) 13 else 11
  wl <- max(.lam_ancho_tinta(rotulos, size_r, FALSE)) + 0.25
  wn <- max(.lam_ancho_tinta(ns, size_n, FALSE)) + 0.25
  wd <- if (isTRUE(espec$hay_universo)) max(if (pg) 1.3 else 1.0, .lam_ancho_tinta(espec$encabezado_diferencia, 10.5, FALSE) + 0.25) else 0
  wv <- max(.lam_ancho_tinta(c("100.0%", "sin casos", "sin dato"), size_v, FALSE)) + 0.25
  xl <- x; xn <- xl + wl; xb <- xn + wn + 0.1
  # La columna de la diferencia queda dentro del rectángulo con su aire a la derecha: pegada al borde, la vista previa de la
  # app recortaba "+4.8" y "Diferencia (pts)" contra el marco del gráfico (2026-11-09).
  xd <- x + w - wd - .COBCAT_AIRE_DER
  wb <- xd - 0.1 - wv - xb
  g <- max(g_min, min(if (pg) 0.3 else 0.2, hrow * 0.3))
  cabe <- hrow >= fila_min - 1e-9 && wb >= (if (pg) 3 else 1.2)
  if (!cabe) .pulso_aviso(.aviso_en_lamina(paste0("Por espacio, las barras de la cobertura por categorías no caben a lo ancho junto a ",
                                                  "sus rótulos y el gráfico va como imagen; para verlo nativo, usa una lámina de un ",
                                                  "gráfico o rótulos más cortos.")))
  list(cabe = cabe,
       x = x, y = y, w = w, h = h, ley = ley, hcab = hcab, hrow = hrow, filas = filas, cabeceras = cabeceras,
       visibles = vis, mostrados = mostrados, omitidos = omitidos,
       size_r = size_r, size_n = size_n, size_v = size_v, size_d = size_d, size_ley = if (pg) 11 else 10.5,
       wl = wl, wn = wn, wd = wd, wv = wv, xl = xl, xn = xn, xb = xb, xd = xd, wb = wb, g = g)
}

#' Dibuja la cobertura por categorías en su rectángulo
#' @return El `y` donde terminó lo dibujado.
#' @keywords internal
.lam_cobcat_dibujar <- function(lz, espec, ge) {
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); tenue <- .std_color("texto_tenue")
  alto <- ge$ley + ge$hcab * ge$cabeceras + ge$hrow * ge$filas
  y <- ge$y + max(0, ge$h - 0.05 - alto) / 2
  # Leyenda sobre el área de barras y el encabezado de la diferencia sobre su columna.
  xl <- ge$xb
  for (k in names(espec$leyenda)) {
    t <- espec$leyenda[[k]]; wt <- .lam_ancho_tinta(t, ge$size_ley, FALSE)
    .lam_caja(lz, xl, y + 0.09, 0.14, 0.14, espec$colores[[k]], nombre = "leyenda:cuadro")
    .lam_txt(lz, t, xl + 0.12, y, wt + 0.3, 0.3, ge$size_ley, azul, nombre = "leyenda:texto")
    xl <- xl + 0.12 + wt + 0.45
  }
  if (isTRUE(espec$hay_universo)) {
    .lam_txt(lz, espec$encabezado_diferencia, ge$xd, y, ge$wd, 0.3, 10.5, suave, align = "right", nombre = "cobertura:encabezado_diferencia")
  }
  y <- y + ge$ley
  px <- function(v) ge$wb * min(1, max(0, v) / espec$escala_max)
  ref <- .lam_referencia_barra(espec)   # B8: pista gris, eje sobrio o, sin declarar, como siempre (lamina_referencia_barra.R)
  for (j in seq_along(espec$bloques)) {
    b <- espec$bloques[[j]]
    nv <- (ge$visibles %||% vapply(espec$bloques, function(z) NROW(z$filas), 0L))[j]
    if (nv < 1L) next
    f <- b$filas[seq_len(nv), , drop = FALSE]
    if (ge$cabeceras > 0L) {
      wp <- .lam_ancho_tinta(b$publico, ge$size_r + 0.5, TRUE)
      .lam_txt(lz, b$publico, ge$xl - 0.1, y + 0.02, wp + 0.3, 0.32, ge$size_r + 0.5, azul, bold = TRUE, nombre = "cobertura:publico")
      .lam_txt(lz, b$texto_n_validos, ge$xl - 0.1 + wp + 0.15, y + 0.04, ge$xd - ge$xl - wp, 0.3, ge$size_n, suave, nombre = "cobertura:publico_n")
      y <- y + ge$hcab
    }
    y0 <- y
    for (i in seq_len(NROW(f))) {
      yc <- y + (i - 0.5) * ge$hrow
      .lam_txt(lz, f$etiqueta[i], ge$xl, .lam_y_centrada(yc, ge$size_r), ge$wl, 0.34, ge$size_r, azul, align = "right", nombre = "cobertura:categoria")
      .lam_txt(lz, f$texto_n[i], ge$xn, .lam_y_centrada(yc, ge$size_n), ge$wn, 0.3, ge$size_n, if (isTRUE(f$chica[i])) azul else suave,
               bold = isTRUE(f$chica[i]), align = "right", nombre = "cobertura:n")
      series <- list(muestra = list(v = f$pct_muestra[i], t = f$texto_muestra[i], y = yc - ge$g - 0.015))
      if (!isTRUE(b$sin_universo)) series$universo <- list(v = f$pct_universo[i], t = f$texto_universo[i], y = yc + 0.015)
      for (k in names(series)) {
        s <- series[[k]]
        lb <- 0
        if (identical(ref, "pista")) .lam_barras_pista(lz, ge$xb, s$y, ge$wb, ge$g)   # B8 (lamina_referencia_barra.R)
        if (is.finite(s$v) && s$v > 0) {
          lb <- max(0.01, px(s$v))
          .lam_caja(lz, ge$xb, s$y, lb, ge$g, espec$colores[[k]], nombre = paste0("cobertura:barra_", k), borde = NA)
        }
        .lam_cifra_barra(lz, s$t, ge$xb, lb, s$y + ge$g / 2 - ge$size_v / 144 - 0.06, 0.28, ge$size_v, if (is.finite(s$v)) suave else tenue,
                         espec$colores[[k]], x_tope = ge$xb + ge$wb + ge$wv, w_fuera = ge$wv, nombre = "cobertura:valor")
      }
      if (nzchar(f$texto_diferencia[i])) {
        dentro <- isTRUE(f$dentro[i])
        .lam_txt(lz, f$texto_diferencia[i], ge$xd, .lam_y_centrada(yc, ge$size_d), ge$wd, 0.36, ge$size_d, if (dentro) suave else azul,
                 bold = !dentro, align = "right", nombre = "cobertura:diferencia")
      }
    }
    .lam_caja(lz, ge$xb - 0.01, y0 + 0.05, 0.015, ge$hrow * NROW(f) - 0.1, tenue, nombre = "cobertura:base_barras")
    if (identical(ref, "eje") && j == length(espec$bloques)) {   # B8: el eje sobrio bajo el último bloque
      .lam_eje_barras(lz, ge$xb, ge$wb, y0 + ge$hrow * NROW(f) - 0.06, tope = espec$escala_max,
                      marcas = Filter(function(m) m <= espec$escala_max + 1e-9, pretty(c(0, espec$escala_max), n = 3)), nombre = "cobertura:eje")
    }
    y <- y + ge$hrow * NROW(f)
  }
  invisible(y)
}

#' Alto mínimo de la fila de una categoría (in): las dos barras al grosor de la casa, su calle y el aire mínimo
#' @keywords internal
.COBCAT_FILA_MIN <- function() 2 * .std_piso_panel_in() + 0.03 + .COBCAT_AIRE_FILAS_MIN

#' Cuántas bases ENTERAS caben en un rectángulo de alto `h` con las barras al grosor de la casa (las primeras, en su orden)
#'
#' La comparten la lámina nativa y el dibujo de respaldo (graficos_cobertura_categorias.R): las dos dejan fuera las mismas.
#' @keywords internal
.cobcat_bases_que_caben <- function(espec, h, pg = TRUE) {
  bl <- espec$bloques; if (!length(bl)) return(0L)
  ley <- if (pg) 0.4 else 0.32; hcab <- if (pg) 0.4 else 0.32
  por_bloque <- vapply(bl, function(b) NROW(b$filas), 0L)
  varias <- length(bl) > 1L || isTRUE(espec$varias_bases)
  cabe_m <- function(m) (h - ley - hcab * (if (varias) m else 0L) - 0.05) / sum(por_bloque[seq_len(m)]) >= .COBCAT_FILA_MIN() - 1e-9
  m <- length(bl)
  while (m >= 1L && !cabe_m(m)) m <- m - 1L
  m
}

#' Bases que van en otra lámina: lo dice al pie de la lámina y en el aviso ("Por espacio, se muestran Estudiantes y
#' Docentes; Administrativos va en otra lámina")
#' @keywords internal
.lam_cobcat_omitidos_nota <- function(ge) {
  if (!length(ge$omitidos)) return(invisible(NULL))
  nota <- .cobcat_nota_omitidos(ge$mostrados, ge$omitidos)
  .LAM_RR_PIE$notas <- unique(c(.LAM_RR_PIE$notas, nota))
  .pulso_aviso(.aviso_en_lamina(nota))
  invisible(nota)
}

#' ¿La lámina de página entera cabe? Hasta 14 categorías, filas de 0.4 in y 3 in de barras
#' @keywords internal
.lam_cobcat_cabe <- function(espec) isTRUE(.lam_cobcat_pagina_geo(espec)$cabe)

#' @keywords internal
.lam_cobcat_pagina_geo <- function(espec) {
  g_ <- .std_geom; ml <- g_("margen_izq"); fin <- g_("ancho") - g_("margen_der")
  y0 <- g_("zona_datos_y0") + 0.1; y1 <- g_("contenido_y1") - 0.35
  .lam_cobcat_geo(espec, ml, y0, fin - ml, y1 - y0, "pagina")
}

#' El pie de la versión por categorías: la base escrita en la lámina, si la hay, y las notas de la especificación
#' @keywords internal
.lam_cobcat_pie <- function(base, espec) .lam_con_punto(do.call(.lam_unir_base, as.list(c(base, espec$notas_pie))))

#' Lámina de cobertura por categorías a página entera
#' @keywords internal
.lam_laminas_cobcat <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  ge <- .lam_cobcat_pagina_geo(espec)
  if (length(ge$omitidos)) {   # notas sólo de las bases que se ven, y el aviso
    espec <- .cobcat_reducir(espec, length(ge$mostrados))
    .pulso_aviso(.aviso_en_lamina(.cobcat_nota_omitidos(ge$mostrados, ge$omitidos)))
  }
  .lam_cobcat_dibujar(lz, espec, ge)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:cobertura")
  doc <- .lam_pie(doc, .lam_rr_pie_menos_filas(.lam_cobcat_pie(base, espec)), folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' Geometría en una ranura de la lámina de dos o de cuatro gráficos
#' @keywords internal
.lam_rr_cobcat_geo <- function(espec, x, y, w, h) .lam_cobcat_geo(espec, x, y, w, h, "ranura")

#' Dibujo en una ranura
#' @keywords internal
.lam_rr_cobcat <- function(lz, espec, ge) {
  .lam_cobcat_omitidos_nota(ge)   # si la ranura deja fuera una base más que el render: lo dice al pie
  .lam_cobcat_dibujar(lz, espec, ge)
}

#' El pie de una lámina mixta con las notas de la cobertura por categorías que se redibujó con su cajón (lamina_mixtas.R)
#'
#' El respaldo redibujado puede mostrar otras bases que el render inicial (su alto decide cuántas caben enteras); sus notas
#' son las de lo que se ve. Sin respaldos de cobertura por categorías, el pie queda como estaba.
#' @keywords internal
.lam_cobcat_pie_respaldos <- function(base0, base, especs, respaldo) {
  if (!length(respaldo)) return(base)
  nuevas <- especs; cambio <- FALSE
  for (k in seq_along(especs)) {
    p <- respaldo[k][[1]]
    e <- if (inherits(p, "ggplot")) attr(p, "pulso_espec", exact = TRUE)
    if (.lam_es_cobcat(e) && !identical(e$notas_pie, especs[[k]]$notas_pie)) { nuevas[[k]] <- e; cambio <- TRUE }
  }
  if (cambio) .lam_rr_pie(base0, nuevas) else base
}
