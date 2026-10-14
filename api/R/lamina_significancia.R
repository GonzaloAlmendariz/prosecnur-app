# Lámina de diferencias significativas entre públicos: tabla de letras y un panel por par (recetario p112,
# propuestas_rescatables.R:322-347). La tabla da cifras y letras; cada panel dibuja la diferencia de un par con su
# intervalo, punto lleno si es significativa. El cálculo vive en graficos_significancia_publicos.R.

#' ¿Cabe? Dos o tres públicos (hasta tres paneles) y hasta diez temas
#' @keywords internal
.lam_significancia_cabe <- function(espec) {
  k <- length(espec$publicos); t <- length(espec$temas)
  k >= 2L && k <= 3L && t >= 1L && t <= 10L && all(vapply(espec$temas, function(s) .lam_alto_tinta(s, 2.9, 13) <= 0.5, TRUE))
}

#' Escala común de los paneles: del menor extremo de los intervalos al mayor, con el cero dentro y guías cada 10 o 20
#' @keywords internal
.lam_significancia_escala <- function(lo, hi) {
  v <- c(lo, hi, 0); v <- v[is.finite(v)]
  paso <- if (diff(range(v)) > 50) 20 else 10
  c(lo = floor((min(v) - 2) / paso) * paso, hi = ceiling((max(v) + 2) / paso) * paso, paso = paso)
}

#' Lámina de diferencias significativas
#' @keywords internal
.lam_laminas_significancia <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                       layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der"); yt <- g_("zona_datos_y0")
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); letra_col <- .std_color("azul_medio")
  gris_ns <- .std_color("texto_tenue"); fondo <- .std_color("cebra"); filete <- .std_color("filete")
  K <- length(espec$publicos); npar <- length(espec$par_etiqueta); nt <- length(espec$temas)
  wi <- 2.9; wv <- 1.05; xv <- ml + 3.0 + (seq_len(K) - 1) * 1.1; fin_tabla <- xv[K] + wv
  xg0 <- fin_tabla + 0.35; wg <- W - mr - xg0; gp <- 0.25; wpan <- (wg - gp * (npar - 1)) / npar
  esc <- .lam_significancia_escala(espec$lo, espec$hi)
  xpan <- function(k) xg0 + (k - 1) * (wpan + gp)
  px <- function(k, v) xpan(k) + (min(max(v, esc[["lo"]]), esc[["hi"]]) - esc[["lo"]]) / (esc[["hi"]] - esc[["lo"]]) * wpan
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  yh <- yt - 0.1
  for (k in seq_len(K)) {
    .lam_txt(lz, espec$publicos[k], xv[k] - 0.1, yh, wv + 0.2, 0.28, 11.5, azul, bold = TRUE, align = "center", nombre = "significancia:publico")
    .lam_txt(lz, espec$letras_publico[k], xv[k], yh + 0.26, wv, 0.26, 11, letra_col, bold = TRUE, align = "center", nombre = "significancia:letra_publico")
  }
  for (k in seq_len(npar)) {
    .lam_txt(lz, espec$par_etiqueta[k], xpan(k) - 0.1, yh, wpan + 0.2, 0.28, 11.5, azul, bold = TRUE, align = "center", nombre = "significancia:par")
    .lam_txt(lz, espec$par_publicos[k], xpan(k) - 0.1, yh + 0.26, wpan + 0.2, 0.26, 9.5, suave, align = "center", nombre = "significancia:par_publicos")
  }
  .lam_caja(lz, ml, yh + 0.58, fin_tabla - ml, 0.01, filete, nombre = "significancia:filete")
  rh <- min(0.42, (g_("contenido_y1") - yh - 1.5) / nt); ytop <- yh + 0.66; y <- ytop
  centros <- numeric(nt)
  for (i in seq_len(nt)) {
    hay <- any(espec$sig[i, ])
    .lam_txt(lz, espec$temas[i], ml - 0.1, y + (rh - 0.3) / 2, wi, 0.3, 13, azul, bold = hay, nombre = "significancia:tema")
    for (k in seq_len(K)) {
      cad <- if (is.finite(espec$p[i, k])) paste0(round(espec$p[i, k]), "%") else "–"; l <- espec$letras[i, k]
      if (nzchar(l)) {
        wnum <- .lam_ancho_tinta(cad, 13, TRUE); wl <- .lam_ancho_tinta(l, 11, TRUE); x0 <- xv[k] + (wv - wnum - wl - 0.08) / 2
        .lam_txt(lz, cad, x0 - 0.1, y + (rh - 0.3) / 2, wnum + 0.25, 0.3, 13, azul, bold = TRUE, nombre = "significancia:cifra")
        .lam_txt(lz, l, x0 + wnum - 0.02, y + (rh - 0.26) / 2, wl + 0.25, 0.28, 11, letra_col, bold = TRUE, nombre = "significancia:letra")
      } else {
        .lam_txt(lz, cad, xv[k], y + (rh - 0.3) / 2, wv, 0.3, 13, azul, align = "center", nombre = "significancia:cifra")
      }
    }
    centros[i] <- y + rh / 2
    .lam_caja(lz, ml, y + rh, fin_tabla - ml, 0.008, filete, nombre = "significancia:filete")
    y <- y + rh
  }
  ybot <- y
  for (k in seq_len(npar)) {
    .lam_caja(lz, xpan(k), ytop, wpan, ybot - ytop, fondo, nombre = "significancia:panel")
    marcas <- seq(esc[["lo"]], esc[["hi"]], by = esc[["paso"]])
    # Rótulos: no en los bordes del panel (se montarían sobre los del vecino) y, si no caben, uno de cada dos; el cero siempre.
    cada <- if (wpan / length(marcas) < 0.42) 2 * esc[["paso"]] else esc[["paso"]]
    for (v in marcas) {
      .lam_caja(lz, px(k, v) - 0.006, ytop, 0.012, ybot - ytop, if (v == 0) suave else "#FFFFFF", nombre = if (v == 0) "significancia:cero" else "significancia:guia")
      rotular <- v == 0 || (v > esc[["lo"]] && v < esc[["hi"]] && v %% cada == 0)
      if (rotular) .lam_txt(lz, if (v == 0) "0" else sprintf("%+d", as.integer(v)), px(k, v) - 0.3, ybot + 0.04, 0.6, 0.24, 9, suave,
                            align = "center", nombre = "significancia:eje")
    }
    for (i in seq_len(nt)) {
      if (!is.finite(espec$d[i, k])) next
      s_ <- isTRUE(espec$sig[i, k]); col <- if (s_) azul else gris_ns; yc <- centros[i]
      x1 <- px(k, espec$lo[i, k]); x2 <- px(k, espec$hi[i, k])
      .lam_caja(lz, x1, yc - 0.012, max(0.01, x2 - x1), 0.024, col, nombre = "significancia:intervalo")
      .lam_caja(lz, px(k, espec$d[i, k]) - 0.08, yc - 0.08, 0.16, 0.16, if (s_) azul else "#FFFFFF", geom = "ellipse",
                borde = col, borde_pt = 1.25, nombre = if (s_) "significancia:punto_lleno" else "significancia:punto_vacio")
    }
  }
  .lam_txt(lz, "La letra indica de qué público es mayor. Cada panel muestra la diferencia de un par con su intervalo. Punto lleno: diferencia significativa.",
           ml, ybot + 0.35, W - ml - mr, 0.3, 12, azul, nombre = "significancia:lectura")
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:significancia")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' Pie de la lámina: la prueba y la base (la de la lámina o, si no hay, la de cada público)
#' @keywords internal
.lam_significancia_pie <- function(espec, base = "") {
  prueba <- sprintf("Prueba z entre cada par de públicos, con corrección de Bonferroni (α = %s)", format(espec$alpha %||% 0.05, nsmall = 2))
  if (!nzchar(trimws(base %||% ""))) {
    nmax <- apply(espec$n, 2, max)
    bases <- paste(sprintf("%s %s", format(as.integer(nmax), big.mark = ","), tolower(espec$publicos)), collapse = ", ")
    base <- paste("Base:", sub(", ([^,]*)$", " y \\1", bases))
  }
  paste0(prueba, ". ", base)
}
