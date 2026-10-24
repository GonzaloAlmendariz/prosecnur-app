# =============================================================================
# reporte_word_tabla_grafico.R — la tabla de datos encima de la figura del Word (Gonzalo, 2026-10-23)
# =============================================================================
#
# «En el Word: puede ir o no ir, por defecto no va; cuando va, encima, en formato de tabla nativo y centrado.»
#
# `word_tabla` (solo-Word, defecto FALSE) la pide; el radar entre públicos cuelga de su figura la tabla (`pulso_word_tabla`,
# graficos_radar_tabla.R) y `.word_figura()` la pone entre el rótulo y la imagen. Es la tabla del documento (`.word_ft_base`
# y `.word_poner_tabla`: Arial, filetes finos, encabezado en navy), no una imagen; el encabezado de la primera columna es el
# nombre del indicador. Va centrada y NO se numera como «Tabla N»: es parte de la figura.

#' Tabla de datos del radar en el Word: nativa, centrada y pegada a la figura que acompaña
#'
#' @param doc Documento officer.
#' @param info Salida de `.radar_mb_tabla_cifras()` (`encabezado`, `ejes`, `grupos`, `cifras`).
#' @return El documento con la tabla puesta.
#' @keywords internal
.word_tabla_encima <- function(doc, info) {
  df <- .radar_mb_tabla_df(info)
  util <- .std_word("pagina", "ancho_util")
  k <- ncol(df) - 1L
  # Criterios a la izquierda (más ancho) y una columna por público; si no llena la página, queda centrada en ella.
  anchos <- c(2.6, rep(1.1, k))
  ft <- .word_ft_base(df, anchos)
  ft <- flextable::align(ft, j = seq_len(k) + 1L, align = "center", part = "all")
  .word_poner_tabla(doc, ft, ancho = min(util, sum(anchos)), align = "center", pegada = TRUE)
}
