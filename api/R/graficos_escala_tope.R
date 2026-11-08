# =============================================================================
# graficos_escala_tope.R — la escala del resumen con más filas de las que admite la lámina nativa (ADR 0135)
# =============================================================================
#
# Revisión metodológica de 095e70b66: en Arte la regla «bajo 60%» elige 22 preguntas y la lámina nativa admite 20
# (`.LAM_DIV_RESUMEN_MAX_FILAS`); `.lam_divergentes_resumen_cabe` la manda entonces al dibujo de respaldo (imagen en su
# marco). Eso no se recorta ni pasa en silencio: el conteo de la regla y el render avisan con la causa.

#' Aviso del tope de filas: «22 preguntas bajo 60%; la lámina nativa admite 20 y la escala sale como imagen.»
#'
#' @param n Filas de la escala. @param texto_regla Nota de la regla («Se muestran las 22 bajo 60%, de 157 …»).
#' @return El aviso o `NULL` si cabe.
#' @keywords internal
.divergentes_aviso_tope <- function(n, texto_regla = NULL) {
  n <- as.integer(n)[1]
  if (is.na(n) || n <= .LAM_DIV_RESUMEN_MAX_FILAS) return(NULL)
  criterio <- sub("^Se muestran las [0-9]+ ([^,.]+)[,.].*$", "\\1", as.character(texto_regla %||% "")[1])
  que <- if (nzchar(criterio) && !identical(criterio, as.character(texto_regla %||% "")[1])) {
    sprintf("%d preguntas %s", n, criterio)
  } else sprintf("%d preguntas", n)
  sprintf("%s; la lámina nativa admite %d y la escala sale como imagen.", que, .LAM_DIV_RESUMEN_MAX_FILAS)
}

#' Tope de filas de la lámina nativa para un graficador con regla (el que publica `POST /api/graficos/resumenes/regla`)
#'
#' La escala del resumen (`p_barras_divergentes`; la regla sólo existe en el estilo resumen) admite
#' `.LAM_DIV_RESUMEN_MAX_FILAS`. Los demás no tienen un tope por número de preguntas: el panorama compara públicos, el
#' contraste mide filas y sub-filas según los grupos y las fortalezas cuentan por columna (`.FORTALEZAS_FILAS_MAX`), así
#' que un total no los describe y la respuesta lleva `null`.
#' @return Entero o `NA_integer_` (la API lo escribe `null`).
#' @keywords internal
.regla_tope_filas <- function(graficador) {
  if (identical(trimws(as.character(graficador %||% "")[1]), "p_barras_divergentes")) .LAM_DIV_RESUMEN_MAX_FILAS else NA_integer_
}
