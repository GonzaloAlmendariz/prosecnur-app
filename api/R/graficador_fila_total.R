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
#' D-a (Gonzalo, 2026-10-11): la fila Total es una OPCIÓN, apagada por defecto (`fila_total = FALSE` en
#' `graficar_barras_apiladas()` y `preparar_escala()`). Encendida, cada fila pesa por su base:
#'
#' - todas las filas de una misma base: por su suma de pesos (ΣW, `var_n`): es la distribución ponderada del
#'   conjunto, la misma que daría tabular a todos juntos con el peso del estudio;
#' - filas de varias bases (multibase): por sus casos sin ponderar (`var_n_casos`): los pesos de dos bases no están en
#'   la misma escala y sumarlos no tiene sentido.
#'
#' La fila Total lleva en `var_n` la suma ponderada y en `var_n_casos` los casos, como cualquier otra fila.
#'
#' @param df Tabla de actores: una fila por actor con `var_n` y las columnas de
#'   porcentaje (en la escala que use el gráfico).
#' @param cols_n Columnas de frecuencia por segmento (nombradas por la columna de
#'   porcentaje), si vienen; se suman. Puede traer también las de casos.
#' @param var_n_casos Columna de casos sin ponderar de cada fila (contrato base-sin-ponderar F6); sin ella, `var_n`.
#' @param varias_bases ¿Las filas vienen de bases distintas? Decide el peso de cada fila (D-a).
#' @return `df` con la fila «Total» primero, o `df` intacto si falta la base.
#' @keywords internal
.apiladas_fila_total <- function(df, var_categoria, var_etiqueta_categoria, var_n,
                                 cols_porcentaje, cols_n = NULL, etiqueta = "Total",
                                 var_n_casos = NULL, varias_bases = FALSE) {
  n <- suppressWarnings(as.numeric(df[[var_n]]))
  if (nrow(df) < 2L || !any(is.finite(n) & n > 0)) return(df)
  con_casos <- !is.null(var_n_casos) && !identical(var_n_casos, var_n) && var_n_casos %in% names(df)
  nc <- if (con_casos) suppressWarnings(as.numeric(df[[var_n_casos]])) else n
  base <- if (isTRUE(varias_bases)) nc else n
  w <- ifelse(is.finite(base) & base > 0, base, 0)
  if (sum(w) <= 0) return(df)
  tot <- df[1, , drop = FALSE]
  for (col in cols_porcentaje) {
    v <- suppressWarnings(as.numeric(df[[col]]))
    tot[[col]] <- sum(ifelse(is.finite(v), v, 0) * w) / sum(w)
  }
  for (col in unique(unname(unlist(cols_n %||% character(0))))) {
    if (col %in% names(df)) tot[[col]] <- sum(suppressWarnings(as.numeric(df[[col]])), na.rm = TRUE)
  }
  tot[[var_n]] <- sum(ifelse(is.finite(n) & n > 0, n, 0))
  if (con_casos) tot[[var_n_casos]] <- sum(ifelse(is.finite(nc) & nc > 0, nc, 0))
  tot[[var_categoria]] <- etiqueta
  if (!is.null(var_etiqueta_categoria) && var_etiqueta_categoria %in% names(df)) tot[[var_etiqueta_categoria]] <- etiqueta
  rbind(tot, df)
}
