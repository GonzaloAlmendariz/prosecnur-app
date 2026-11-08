# graficador_barras_divergentes_saldo.R — el saldo de la divergente se mide sobre las cifras rotuladas.
#
# ADR 0135: el total de cada lado es la suma de lo que se rotula, y la diferencia se mide sobre esas cifras y se vuelve a
# redondear. La imagen sumaba los valores sin redondear: en Arte (2.597/7.792/75.325/9.091/5.195) los lados decían
# «Negativo 11%» y «Positivo 84%» y el saldo «+74 pp».

#' Saldo por fila desde los totales rotulados de la especificación
#'
#' @param items Filas del gráfico, en el orden en que la imagen las agrega.
#' @param saldo_crudo Saldo sin redondear de cada fila (respaldo si la fila no está en la espec).
#' @param espec_div Especificación `divergentes/1` (`filas`, `total_neg`, `total_pos` en unidades de `10^-decimales` %).
#' @return Saldo en puntos porcentuales por fila; sin espec, `saldo_crudo`.
#' @keywords internal
.divergentes_saldo_rotulado <- function(items, saldo_crudo, espec_div = NULL) {
  if (is.null(espec_div) || is.null(espec_div$filas) || is.null(espec_div$total_pos) || is.null(espec_div$total_neg)) {
    return(saldo_crudo)
  }
  dec <- suppressWarnings(as.integer(espec_div$decimales %||% 0L)[1])
  if (!is.finite(dec) || dec < 0L) dec <- 0L
  k <- match(as.character(items), as.character(espec_div$filas))
  dif <- (as.numeric(espec_div$total_pos) - as.numeric(espec_div$total_neg))[k] / 10^dec
  out <- .pulso_round_half_up(dif, dec)
  ifelse(is.na(k) | !is.finite(out), saldo_crudo, out)
}
