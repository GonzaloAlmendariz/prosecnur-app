# graficador_barras_apiladas_cabecera_aire.R — la cifra elevada de la primera fila no se pega a la cabecera de la columna
#
# Ola 2, E4 (fix3/after3/p-1.png): en la apilada con columna extra («TOP TWO BOX»), una cifra chica de la primera fila que
# sale «arriba» de su barra quedaba a 0.001 in de la cabecera: la fila superior del lienzo no reservaba aire para ella.
# La cabecera va centrada en esa fila, así que crecerla en Δ la aleja Δ/2 de las barras. Sólo geometría.

.APILADAS_CABECERA_AIRE_IN <- 0.16

#' ¿Alguna cifra de la primera fila (la de arriba) sale encima de su barra?
#' @keywords internal
.apiladas_arriba_en_fila1 <- function(df_lab) {
  if (is.null(df_lab) || !NROW(df_lab) || !all(c(".label_arriba", ".y_plot") %in% names(df_lab))) return(FALSE)
  y <- suppressWarnings(as.numeric(df_lab$.y_plot))
  if (!any(is.finite(y))) return(FALSE)
  any(df_lab$.label_arriba %in% TRUE & is.finite(y) & abs(y - max(y, na.rm = TRUE)) < 1e-9)
}
