# =============================================================================
# graficos_escala_tope.R — la escala del resumen con más filas de las que admite la lámina nativa (ADR 0135)
# =============================================================================
#
# Revisión metodológica de 095e70b66: en Arte la regla «bajo 60%» elige 22 preguntas y la lámina nativa admite 20
# (`.LAM_DIV_RESUMEN_MAX_FILAS`); `.lam_divergentes_resumen_cabe` la manda entonces al dibujo de respaldo (imagen en su
# marco). Eso no se recorta ni pasa en silencio: el conteo de la regla y el render avisan con la causa.

#' Por qué la escala del resumen sale como imagen: las dos causas de `.lam_divergentes_resumen_cabe`
#'
#' - más filas que el tope: «22 preguntas bajo 60%; la lámina nativa admite 20 y la escala sale como imagen.»;
#' - más de una columna «Sin información» (98 «No sabe» y 99 «No responde»): «Hay dos opciones sin información; la
#'   lámina nativa admite una y la escala sale como imagen.» (revisión metodológica de la regla, H4).
#'
#' La geometría (`ge$xb - ge$xa`) no entra: depende de los rótulos que arma el render, y una afirmación larga ya no manda
#' la lámina a la imagen.
#' @param n Filas de la escala. @param texto_regla Nota de la regla («Se muestran las 22 bajo 60%, de 157 …»).
#' @param n_sin_inf Columnas «Sin información» de la tabla de la lámina (`.regla_div_medidas`, o la especificación).
#' @return Los avisos (uno por causa) o `NULL` si cabe.
#' @keywords internal
.divergentes_aviso_tope <- function(n, texto_regla = NULL, n_sin_inf = 0L) {
  n <- as.integer(n)[1]
  avisos <- character(0)
  if (!is.na(n) && n > .LAM_DIV_RESUMEN_MAX_FILAS) {
    criterio <- sub("^Se muestran las [0-9]+ ([^,.]+)[,.].*$", "\\1", as.character(texto_regla %||% "")[1])
    que <- if (nzchar(criterio) && !identical(criterio, as.character(texto_regla %||% "")[1])) {
      sprintf("%d preguntas %s", n, criterio)
    } else sprintf("%d preguntas", n)
    avisos <- c(avisos, sprintf("%s; la lámina nativa admite %d y la escala sale como imagen.", que, .LAM_DIV_RESUMEN_MAX_FILAS))
  }
  si <- suppressWarnings(as.integer(n_sin_inf %||% 0L)[1])
  if (is.finite(si) && si > 1L) {
    cuantas <- if (si <= length(.REGLA_PREGUNTAS_NUMEROS)) .REGLA_PREGUNTAS_NUMEROS[si] else as.character(si)
    avisos <- c(avisos, sprintf("Hay %s opciones sin información; la lámina nativa admite una y la escala sale como imagen.", cuantas))
  }
  if (length(avisos)) avisos else NULL
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
