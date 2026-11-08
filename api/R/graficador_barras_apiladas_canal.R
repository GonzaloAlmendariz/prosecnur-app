# graficador_barras_apiladas_canal.R — el canal de rótulos de la apilada mide lo que su rótulo más largo
#
# Ola 3, G-c (Gonzalo, 2026-11-08, lámina «G. 2 vertical divergente con saldo»: «un espacio exagerado para etiquetas cuando
# sus labels son cortos»). La apilada con cruce reservaba el canal declarado (el 37 % de un lienzo de 10 in, 3.7 in) para
# «Asociado / Auxiliar / Contratado / Jefe de Práctica», que miden 1.3 in: el gráfico empezaba a la mitad de la lámina. El
# estándar de Contabilidad pide un ancho dinámico para el largo de las etiquetas: el canal mide la tinta del rótulo más
# largo (`.lam_ancho_tinta`, en negrita: lo más ancho que puede salir) más su aire, con lo declarado como tope y un mínimo.
# Lo que se libera va a las barras. Sólo geometría.

.APILADAS_CANAL_AIRE_IN <- 0.3
.APILADAS_CANAL_MIN_IN <- 0.8
.APILADAS_CANAL_CALLE_IN <- 0.15   # la calle entre el canal y las barras, cuando el canal se ajusta a sus rótulos

#' El canal de rótulos y el área de barras de la apilada, con el canal a la medida de sus rótulos
#'
#' @param w_etq,w_bars Fracciones del lienzo (ya normalizadas) del canal y de las barras.
#' @param etiquetas Rótulos tal como se dibujan (pueden traer saltos de línea). @param size_pt Cuerpo del rótulo.
#' @param ancho Ancho físico del lienzo (in). Sin ancho no cambia nada.
#' @param w_buf1 Calle entre el canal y las barras (fracción); con el canal ajustado, a lo más `.APILADAS_CANAL_CALLE_IN`.
#' @return `list(w_etq, w_bars, w_buf1)`.
#' @keywords internal
.apiladas_canal_dinamico <- function(w_etq, w_bars, etiquetas, size_pt, ancho, w_buf1 = 0) {
  a <- suppressWarnings(as.numeric(ancho)[1])
  lin <- unlist(strsplit(as.character(etiquetas[!is.na(etiquetas)]), "\n", fixed = TRUE))
  lin <- trimws(lin[nzchar(trimws(lin))])
  if (!length(a) || !is.finite(a) || a <= 0 || !length(lin) || !is.finite(w_etq) || w_etq <= 0) return(list(w_etq = w_etq, w_bars = w_bars, w_buf1 = w_buf1))
  tinta <- suppressWarnings(max(.lam_ancho_tinta(lin, size_pt, TRUE)))
  if (!is.finite(tinta)) return(list(w_etq = w_etq, w_bars = w_bars, w_buf1 = w_buf1))
  necesita <- max(.APILADAS_CANAL_MIN_IN, tinta + .APILADAS_CANAL_AIRE_IN) / a
  if (necesita >= w_etq) return(list(w_etq = w_etq, w_bars = w_bars, w_buf1 = w_buf1))
  calle <- min(w_buf1, .APILADAS_CANAL_CALLE_IN / a)
  list(w_etq = necesita, w_bars = w_bars + (w_etq - necesita) + (w_buf1 - calle), w_buf1 = calle)
}
