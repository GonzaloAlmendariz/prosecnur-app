# =============================================================================
# graficador_fila_total.R — la fila «Total» del bloque Likert por actores (ADR 0092, F2.5)
# =============================================================================
#
# En el recetario (filas_pulso, docs/qa/motor-ppt-2026-10-06/herramientas/
# propuestas_rescatables.R:23-48) el bloque por actores abre con una fila
# «Total» separada por un filete. Su distribución es la de todas las personas
# que respondieron, juntas: cada porcentaje de actor pesa por su base válida
# (`tot_pond`, ΣpᵢNᵢ / ΣNᵢ). No es una ponderación a la población: un actor con
# más respuestas pesa más, y así lo dice la nota de la lámina.

#' Agrega al principio la fila «Total» ponderada por la base de cada actor
#'
#' @param df Tabla de actores: una fila por actor con `var_n` y las columnas de
#'   porcentaje (en la escala que use el gráfico).
#' @param cols_n Columnas de frecuencia por segmento (nombradas por la columna de
#'   porcentaje), si vienen; se suman.
#' @return `df` con la fila «Total» primero, o `df` intacto si falta la base.
#' @keywords internal
.apiladas_fila_total <- function(df, var_categoria, var_etiqueta_categoria, var_n,
                                 cols_porcentaje, cols_n = NULL, etiqueta = "Total") {
  n <- suppressWarnings(as.numeric(df[[var_n]]))
  if (nrow(df) < 2L || !any(is.finite(n) & n > 0)) return(df)
  w <- ifelse(is.finite(n) & n > 0, n, 0)
  tot <- df[1, , drop = FALSE]
  for (col in cols_porcentaje) {
    v <- suppressWarnings(as.numeric(df[[col]]))
    tot[[col]] <- sum(ifelse(is.finite(v), v, 0) * w) / sum(w)
  }
  for (col in unname(cols_n %||% character(0))) {
    if (col %in% names(df)) tot[[col]] <- sum(suppressWarnings(as.numeric(df[[col]])), na.rm = TRUE)
  }
  tot[[var_n]] <- sum(w)
  tot[[var_categoria]] <- etiqueta
  if (!is.null(var_etiqueta_categoria) && var_etiqueta_categoria %in% names(df)) tot[[var_etiqueta_categoria]] <- etiqueta
  rbind(tot, df)
}
