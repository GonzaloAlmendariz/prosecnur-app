# graficador_barras_agrupadas_rotulos.R — P43/P2/A12: los rótulos del eje se ensanchan antes de encoger.
#
# CCSS Perfil 2026, lámina 37 (once categorías de opción múltiple a lámina completa): el envoltorio se calculaba a 12 pt con un
# tope editorial de 32 caracteres —en una columna de 5.5 in—, salían tres líneas por fila y el cuerpo bajaba al piso de 8 pt
# SIN volver a envolver: rótulos diminutos en tres líneas con la columna medio vacía. Lámina A12 (`cifras_y_graficos`, panel de
# 6.1 x 2.59 in): el mismo envoltorio a 12 pt (cuatro líneas) dibujado a 8 pt se montaba sobre la fila vecina.
#
# Aquí el cuerpo y el envoltorio se eligen JUNTOS y medidos: para cada cuerpo, de mayor a menor, se envuelve con el ancho real
# de la columna y se comprueba que las líneas caben en la fila. Si ni al piso cabe, se ensancha la columna de rótulos (las barras
# ceden) y, si aun así no cabe, se avisa. Sólo cambia la forma de los rótulos: cifras, orden y colores no se tocan.

#' Cuerpo y envoltorio de los rótulos que caben en su columna y en su fila
#'
#' @param etiquetas Rótulos del eje.
#' @param ancho_columna_in Ancho de la columna de rótulos, en pulgadas.
#' @param size_pt Cuerpo de partida (el mayor que se intenta).
#' @param n_categorias Filas del panel.
#' @param alto_in Alto del cajón del gráfico, en pulgadas.
#' @param lineheight Interlineado.
#' @param negrita ¿Los rótulos van en negrita? (miden ~8 % más).
#' @param minimo_pt Piso legible.
#' @param frac_panel Fracción del cajón que ocupa el panel (la misma de `.agrupadas_size_que_cabe`).
#' @return `list(size, wrap, lineas, cabe)`, o `NULL` si no se puede medir (sin `systemfonts`) o faltan medidas.
#' @keywords internal
.agrupadas_rotulos_ensanchar <- function(etiquetas, ancho_columna_in, size_pt, n_categorias, alto_in, lineheight = 1.2,
                                         negrita = FALSE, minimo_pt = .std_valor("ppt", "tipografia", "cifra_minimo") %||% 8,
                                         frac_panel = 0.62) {
  et <- as.character(etiquetas %||% character(0)); et <- et[!is.na(et) & nzchar(trimws(et))]
  a <- suppressWarnings(as.numeric(ancho_columna_in)[1]); s0 <- suppressWarnings(as.numeric(size_pt)[1])
  n <- suppressWarnings(as.integer(n_categorias)[1]); alto <- suppressWarnings(as.numeric(alto_in)[1])
  lh <- suppressWarnings(as.numeric(lineheight)[1]); if (!is.finite(lh) || lh <= 0) lh <- 1.2
  if (!length(et) || !is.finite(a) || a <= 0 || !is.finite(s0) || s0 <= 0 || !is.finite(n) || is.na(n) || n <= 0 ||
      !is.finite(alto) || alto <= 0 || !requireNamespace("stringr", quietly = TRUE)) return(NULL)
  minimo_pt <- min(s0, minimo_pt)
  ancho_util <- a / (if (isTRUE(negrita)) 1.08 else 1)
  fila_in <- alto * frac_panel / n
  ultimo <- NULL
  for (s in unique(c(seq(s0, minimo_pt, by = -0.5), minimo_pt))) {
    w <- .chars_que_caben(et, ancho_util, s)
    if (is.na(w)) return(NULL)
    # El presupuesto por caracteres sale de la peor etiqueta; se comprueba con la tinta de cada línea envuelta.
    repeat {
      lineas_txt <- unlist(strsplit(stringr::str_wrap(et, width = w), "\n", fixed = TRUE))
      anchos <- .ancho_texto_in(lineas_txt, s)
      if (all(is.na(anchos) | anchos <= ancho_util) || w <= 8L) break
      w <- w - 1L
    }
    lin <- .agrupadas_lineas_eje(et, w)
    ultimo <- list(size = s, wrap = as.integer(w), lineas = lin, cabe = FALSE)
    if (lin * s * lh / 72 <= fila_in + 1e-9) { ultimo$cabe <- TRUE; return(ultimo) }
  }
  ultimo
}

#' Rótulos de la agrupada: primero el cuerpo y el envoltorio medidos; si ni al piso caben, una columna más ancha
#'
#' @param ancho Ancho del cajón (in). @param w_etiquetas,w_bars,w_resto Pesos de la fila del lienzo (sin normalizar).
#' @param titulo Para el aviso.
#' @param frac_panel Fracción del cajón que queda para las filas (sin cabecera, leyenda ni pie).
#' @return `list(size, wrap, w_etiquetas, w_bars, cabe)` o `NULL` si no se puede medir.
#' @keywords internal
.agrupadas_rotulos_ajustar <- function(etiquetas, ancho, w_etiquetas, w_bars, w_resto, size_pt, n_categorias, alto_in,
                                       lineheight = 1.2, negrita = FALSE, titulo = NULL, frac_panel = 0.62) {
  ancho <- suppressWarnings(as.numeric(ancho)[1])
  we <- suppressWarnings(as.numeric(w_etiquetas)[1]); wb <- suppressWarnings(as.numeric(w_bars)[1])
  wr <- suppressWarnings(as.numeric(w_resto)[1]); if (!is.finite(wr) || wr < 0) wr <- 0
  if (!is.finite(ancho) || ancho <= 0 || !is.finite(we) || we <= 0 || !is.finite(wb) || wb <= 0) return(NULL)
  total <- we + wb + wr; share0 <- we / total
  probar <- function(share) .agrupadas_rotulos_ensanchar(etiquetas, ancho * share - 0.12, size_pt, n_categorias, alto_in, lineheight, negrita,
                                                         frac_panel = frac_panel)
  r <- probar(share0)
  if (is.null(r)) return(NULL)
  share <- share0
  if (!isTRUE(r$cabe)) {
    # Las barras ceden hasta 0.30 del ancho; la columna de rótulos no pasa de 0.62.
    tope <- min(0.62, 1 - wr / total - 0.30)
    for (sh in seq(share0 + 0.04, tope, by = 0.04)) {
      if (sh <= share0) next
      r2 <- probar(sh)
      if (is.null(r2)) break
      r <- r2; share <- sh
      if (isTRUE(r$cabe)) break
    }
    if (!isTRUE(r$cabe)) {
      .pulso_aviso("Los rótulos de «", titulo %||% "un gráfico de barras agrupadas",
                   "» no caben en su fila ni al cuerpo mínimo con la columna ensanchada: conviene un panel más alto o rótulos más cortos.")
    }
  }
  we2 <- share * total
  list(size = r$size, wrap = r$wrap, w_etiquetas = we2, w_bars = wb - (we2 - we), cabe = isTRUE(r$cabe))
}

#' Fracción del cajón que queda para las filas: el alto menos cabecera, leyenda, pie y fila superior (nunca menos de 0.62,
#' la fracción con que `.agrupadas_size_que_cabe` decide encoger)
#' @keywords internal
.agrupadas_frac_panel <- function(alto, titulo, subtitulo, h_header, con_leyenda, h_leyenda, con_pie, h_pie, h_reserva, h_toprow) {
  a <- suppressWarnings(as.numeric(alto)[1])
  if (!is.finite(a) || a <= 0) return(0.62)
  num <- function(x) { v <- suppressWarnings(as.numeric(x)[1]); if (length(v) && is.finite(v) && v > 0) v else 0 }
  hay <- function(x) !is.null(x) && length(x) && !is.na(x[1]) && nzchar(trimws(as.character(x)[1]))
  cab <- if (hay(titulo) || hay(subtitulo)) max(num(h_header), 0.26) else 0
  resto <- cab + (if (isTRUE(con_leyenda)) num(h_leyenda) else 0) + (if (isTRUE(con_pie)) num(h_pie) else num(h_reserva)) + num(h_toprow)
  max(0.62, min(0.95, (a - resto) / a))
}
