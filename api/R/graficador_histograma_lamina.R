# Histograma nativo de lámina completa que se lee como una distribución (revisión de Gonzalo del PPT v7 de CCSS Perfil
# 2026, lámina 8, «¿Cuál es tu edad?»: «tenemos que proponer de forma imperante la mejora completa del histograma»).
#
# Lo que cambia frente a la lámina 79 del recetario (lamina_numericos.R):
#  - las barras van contiguas, con un hueco uniforme de 0.03 in, sobre una línea de base fina: se leen como una sola
#    forma y no como columnas sueltas;
#  - la mediana es una línea fina coral que sube desde la base hasta su rótulo, cortada donde va la cifra de su barra.
#    Antes era un triángulo bajo el eje y el rótulo quedaba arriba a la derecha, lejos de lo que nombraba;
#  - el valor de una barra de un solo caso ya no dice «0%» (`.histograma_cifra_con_frecuencia`).
# La cola de valores con pocos casos se junta con el mando `limite_superior` del plan («30+»); el motor no la impone.
# Cifras, mediana y conteos son los de la espec: sólo cambia el dibujo.

.LAM_HIST_HUECO <- 0.03     # aire entre barras vecinas (in)
.LAM_HIST_ROTULO_MED <- 0.3 # alto de la franja del rótulo de la mediana (in)

#' Dibuja el histograma entre `y0` (arriba) y `y1` (abajo, bajo los valores del eje)
#'
#' @param espec Especificación `histograma/1` (`.histograma_recetario`). `espec$x_mediana` es la posición de la mediana
#'   en columnas desde 0 (la primera barra); entre dos valores queda en medio de sus barras.
#' @return El `y` donde termina lo dibujado.
#' @keywords internal
.lam_histograma_distribucion <- function(lz, espec, x, y0, w, y1) {
  azul <- .std_color("azul"); coral <- .std_color("coral"); tenue <- .std_color("texto_tenue")
  n <- length(espec$valores); wcol <- w / n; vmax <- max(espec$valores)
  cif <- .histograma_cifras_en_columna(espec$cifras, wcol)   # «103 (26%)» en dos líneas si no cabe en una
  h_cif <- 0.28 + (cif$lineas - 1L) * 0.2
  texto_med <- as.character(espec$texto_mediana %||% "")[1]
  med <- is.finite(suppressWarnings(as.numeric(espec$x_mediana)[1])) && nzchar(texto_med %||% "")
  yb <- y1 - 0.38                                                       # la base; debajo, los valores del eje
  y_top <- y0 + (if (med) .LAM_HIST_ROTULO_MED + 0.14 else 0) + h_cif + 0.02
  hb <- max(0.5, yb - y_top)
  tope_cifra <- rep(yb, n)
  for (k in seq_len(n)) {
    hk <- if (vmax > 0) hb * espec$valores[k] / vmax else 0; xk <- x + (k - 1) * wcol
    if (hk > 0) {
      .lam_caja(lz, xk + .LAM_HIST_HUECO / 2, yb - hk, wcol - .LAM_HIST_HUECO, hk, azul, nombre = "histograma:barra")
      lin <- strsplit(cif$textos[k], "\n", fixed = TRUE)[[1]]   # el conteo arriba y su porcentaje debajo, en cajas propias
      y_c <- yb - hk - 0.02 - h_cif
      for (j in seq_along(lin)) .lam_txt(lz, lin[j], xk, y_c + (j - 1L) * 0.2, wcol, 0.28, 12, azul, bold = TRUE,
                                         align = "center", nombre = if (j == 1L) "histograma:cifra" else "histograma:cifra_pct")
      tope_cifra[k] <- if (any(nzchar(lin))) y_c else yb - hk   # el borde de la caja de la cifra
    }
    .lam_txt(lz, espec$rotulos[k], xk, yb + 0.06, wcol, 0.28, 12, azul, align = "center", nombre = "histograma:valor")
  }
  .lam_linea(lz, x, yb, x + w, yb, tenue, pt = 0.75, nombre = "histograma:base")
  if (med) {
    xm <- x + (as.numeric(espec$x_mediana)[1] + 0.5) * wcol
    # La línea cruza la barra de la mediana desde la base y se corta donde va su cifra, para no tacharla; si la mediana cae
    # entre dos valores, corre por el hueco entre sus barras.
    centro <- abs(x + (seq_len(n) - 0.5) * wcol - xm) < wcol * 0.25
    y_ini <- y0 + .LAM_HIST_ROTULO_MED + 0.02
    if (any(centro)) {
      k <- which(centro)[1]; hk <- if (vmax > 0) hb * espec$valores[k] / vmax else 0
      if (hk > 0.06) .lam_linea(lz, xm, yb, xm, yb - hk + 0.04, coral, pt = 1, nombre = "histograma:mediana")
      y_fin <- tope_cifra[k] - 0.01
      if (y_fin > y_ini) .lam_linea(lz, xm, y_ini, xm, y_fin, coral, pt = 1, nombre = "histograma:mediana")
    } else {
      .lam_linea(lz, xm, y_ini, xm, yb, coral, pt = 1, nombre = "histograma:mediana")
    }
    wt <- .lam_ancho_tinta(texto_med, 12, TRUE) + 0.3
    xt <- min(max(x, xm - wt / 2), x + w - wt)
    .lam_txt(lz, texto_med, xt, y0, wt, .LAM_HIST_ROTULO_MED, 12, coral, bold = TRUE, align = "center", nombre = "histograma:texto_mediana")
  }
  invisible(yb + 0.34)
}
