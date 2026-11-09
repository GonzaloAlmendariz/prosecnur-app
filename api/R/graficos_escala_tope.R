# =============================================================================
# graficos_escala_tope.R — la escala del resumen con más filas de las que admite la lámina nativa (ADR 0135)
# =============================================================================
#
# Revisión metodológica de 095e70b66: en Arte la regla «bajo 60%» elige 22 preguntas y la lámina nativa admite 20
# (`.LAM_DIV_RESUMEN_MAX_FILAS`); `.lam_divergentes_resumen_cabe` la manda entonces al dibujo de respaldo (imagen en su
# marco). Eso no pasa en silencio: el conteo de la regla y el render avisan con la causa. E3 (2026-11-09): esa imagen
# salía ilegible; ahora la lámina nativa muestra las que caben y el pie lo dice (graficos_tope_espacio.R).

#' Por qué la escala del resumen sale como imagen: más de una columna «Sin información»
#'
#' E3 (2026-11-09): más filas que el tope ya no manda la escala a la imagen (salía ilegible, con las cifras montadas):
#' la lámina muestra las que caben en el orden de la regla y lo dice en el pie (graficos_tope_espacio.R). La única causa
#' de imagen que queda es la de las columnas especiales: «Hay dos opciones sin información; la lámina nativa admite una
#' y la escala sale como imagen.» (revisión metodológica de la regla, H4).
#' @param n Filas de la escala. @param texto_regla Nota de la regla (se conserva por compatibilidad de la firma).
#' @param n_sin_inf Columnas «Sin información» de la tabla de la lámina (`.regla_div_medidas`, o la especificación).
#' @return Los avisos de imagen o `NULL` si cabe.
#' @keywords internal
.divergentes_aviso_tope <- function(n, texto_regla = NULL, n_sin_inf = 0L) {
  avisos <- character(0)
  si <- suppressWarnings(as.integer(n_sin_inf %||% 0L)[1])
  if (is.finite(si) && si > 1L) {
    cuantas <- if (si <= length(.REGLA_PREGUNTAS_NUMEROS)) .REGLA_PREGUNTAS_NUMEROS[si] else as.character(si)
    avisos <- c(avisos, sprintf("Hay %s opciones sin información; la lámina nativa admite una y la escala sale como imagen.", cuantas))
  }
  if (length(avisos)) avisos else NULL
}

#' Aviso del conteo cuando la regla elige más filas de las que caben: la lámina muestra las primeras en su orden
#' @keywords internal
.divergentes_aviso_espacio <- function(n, regla = NULL) {
  n <- as.integer(n)[1]
  if (is.na(n) || n <= .LAM_DIV_RESUMEN_MAX_FILAS) return(NULL)
  sprintf("La regla elige %d preguntas y la lámina admite %d: %s", n, .LAM_DIV_RESUMEN_MAX_FILAS,
          sub("^Se muestran", "se muestran", .tope_espacio_frase(regla, .LAM_DIV_RESUMEN_MAX_FILAS, n)))
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
