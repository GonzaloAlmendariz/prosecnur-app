# graficador_barras_apiladas_ancho_cifra.R — ancho físico de la cifra de un segmento de apilada.
#
# `.estimate_label_width_apiladas` mide la cifra como fracción de la barra sin saber cuánto mide la barra en pulgadas. En
# una lámina de composición (barra de ~4.4 in, cifra de 14 pt en negrita) se quedaba en la mitad: «4%» en un segmento de
# 0.164 in contaba como «entra», y ni la pasada de choques ni el repel lo veían montado sobre el «7%» vecino (Arte,
# 2026-11-08). Aquí se mide la tinta real con `.lam_ancho_tinta` y se divide por el ancho físico del área de barras.

#' Ancho físico (in) del área de barras de una apilada, antes del layout del lienzo
#'
#' Repite el reparto de columnas del lienzo (`graficar_barras_apiladas`, bloque «widths»): grupo, etiquetas, barras y
#' columna extra en pulgadas. Las etiquetas se miden sin envolver, que es lo más ancho que pueden ser: si se equivoca, lo
#' hace achicando la barra y la cifra sale fuera, nunca montada.
#' @return Pulgadas, o `NA` si no hay ancho.
#' @keywords internal
.apiladas_ancho_barras_in <- function(ancho, w_grupo, w_buf0, w_etq, w_buf1, w_bars, w_buf2, w_extra,
                                      w_legend_side = 0, col_extra_in = NA_real_) {
  ancho <- suppressWarnings(as.numeric(ancho)[1])
  num <- function(x) { x <- suppressWarnings(as.numeric(x)[1]); if (length(x) && is.finite(x)) x else 0 }
  pesos <- c(num(w_legend_side), num(w_grupo), num(w_buf0), num(w_etq), num(w_buf1), num(w_bars), num(w_buf2), num(w_extra))
  if (!is.finite(ancho) || ancho <= 0 || pesos[6] <= 0) return(NA_real_)
  frac <- pesos / sum(pesos)
  col_in <- suppressWarnings(as.numeric(col_extra_in)[1])
  if (frac[8] > 0 && is.finite(col_in) && col_in > 0 && ancho > col_in + 1) {
    w_extra_std <- col_in / ancho
    w_buf2_std <- 0.1 / ancho
    frac[6] <- frac[6] * (1 - w_extra_std - w_buf2_std) / (1 - frac[8] - frac[7])
  }
  frac[6] * ancho
}

#' Ancho de la cifra como fracción del área de barras (escala 0-1 del panel)
#'
#' @param labels Cifras tal como se rotulan.
#' @param size Tamaño ggplot (mm) de cada cifra.
#' @param bold Si la cifra va en negrita.
#' @param ancho_barras_in Ancho físico del área de barras (`.apiladas_ancho_barras_in`).
#' @return Fracción por cifra; `0` si no se puede medir (quien llama se queda con su estimación).
#' @keywords internal
.apiladas_ancho_cifra_frac <- function(labels, size, bold = FALSE, ancho_barras_in = NA_real_) {
  labels <- as.character(labels)
  if (!length(labels)) return(numeric(0))
  if (!is.finite(ancho_barras_in) || ancho_barras_in <= 0) return(rep(0, length(labels)))
  size <- suppressWarnings(as.numeric(size))
  size <- rep_len(if (length(size)) size else 3, length(labels))
  size[!is.finite(size)] <- 3
  # Una cifra con frecuencia trae «\n(n)»: manda la línea más larga.
  primera <- vapply(strsplit(ifelse(is.na(labels), "", labels), "\n", fixed = TRUE), function(l) {
    if (!length(l)) "" else l[which.max(nchar(l))]
  }, character(1))
  out <- numeric(length(labels))
  for (s in unique(size)) {
    k <- which(size == s)
    out[k] <- .lam_ancho_tinta(primera[k], s * ggplot2::.pt, bold = bold) / ancho_barras_in
  }
  out[!is.finite(out)] <- 0
  out
}
