# =============================================================================
# graficos_espec_radar.R — lo que afirma un radar (ADR 0093, N6)
# =============================================================================
#
# El radar de la lámina 90 del recetario (recetario_m3c.R:75-93): los ejes en el
# sentido del reloj desde arriba, el eje desde el piso de los datos (múltiplo de 5
# bajo el mínimo, `lo = 80` con datos de 84 a 98), anillos cada 5 puntos y, al
# lado, la tabla con las mismas cifras redondeadas que se leen en el radar.
#
# La espec la arma `graficar_radar()` con lo que ya resolvió (ejes, series, piso y
# paleta); la lámina la lee y no recalcula.

#' Especificación de un radar
#'
#' @param df_plot Datos largos con `.eje`, `.grupo` (factores) y `.valor` (0 a 1).
#' @param r_lim Límites radiales (0 a 1) que resolvió el graficador.
#' @param pal Colores por grupo (nombrados).
#' @param digits Decimales de las cifras de la tabla.
#' @param encabezado Rótulo de la primera columna de la tabla.
#' @param con_tabla ¿La lámina lleva la tabla al lado?
#' @param nota Nota al pie del gráfico (su caption), que pasa a la base.
#' @return Lista con `version`, `tipo`, `ejes`, `grupos`, `valores` (matriz eje × grupo, 0 a 1), `cifras`,
#'   `colores`, `lo` (piso en %), `anillos` (en %), `encabezado`, `con_tabla`, `nota`.
#' @keywords internal
.espec_radar <- function(df_plot, r_lim, pal = NULL, digits = 0L, encabezado = NULL, con_tabla = TRUE, nota = NULL) {
  ejes <- levels(df_plot$.eje); grupos <- levels(df_plot$.grupo)
  V <- matrix(0, length(ejes), length(grupos), dimnames = list(ejes, grupos))
  V[cbind(match(as.character(df_plot$.eje), ejes), match(as.character(df_plot$.grupo), grupos))] <- as.numeric(df_plot$.valor)
  V[!is.finite(V)] <- 0
  digits <- suppressWarnings(as.integer(digits)); if (!is.finite(digits) || digits < 0L) digits <- 0L
  cifras <- V; cifras[] <- .pulso_fmt_pct_half_up(as.numeric(V), digits)
  lo <- round(100 * (r_lim[1] %||% 0)); rango <- 100 - lo
  paso <- if (rango <= 30) 5 else if (rango <= 60) 10 else 20
  base_pal <- .std_paleta("actores")
  colores <- vapply(seq_along(grupos), function(j) {
    c0 <- if (!is.null(pal)) unname(pal[grupos[j]]) else NA_character_
    if (length(c0) && !is.na(c0) && nzchar(c0)) c0 else base_pal[(j - 1L) %% length(base_pal) + 1L]
  }, "")
  list(version = "radar/1", tipo = "radar", ejes = ejes, grupos = grupos, valores = V, cifras = cifras,
       colores = stats::setNames(colores, grupos), lo = lo, anillos = seq(lo + paso, 100, by = paso),
       encabezado = encabezado %||% "Indicador", con_tabla = isTRUE(con_tabla), nota = nota)
}
