# =============================================================================
# lamina_cifras_pieza.R — las cifras de las láminas de composición, como la pieza `cifra()` del recetario (K15)
# =============================================================================
#
# En «Cifras en columna lateral» (p169) y «Cifras en banda superior» (p171) el recetario dibuja cada cifra con
# `cifra()` (recetario_piezas.R:51-56): la caja empieza en el borde de su columna, el valor mide 0.62, el rótulo va 0.62
# más abajo y el detalle 0.9; la pieza ocupa 1.15. Los separadores entre cifras van de y + 0.05 a y + 1.2. Las láminas
# de cifras solas (p174/p175) dibujan otra banda —caja corrida 0.1, valor medido por su tamaño, calle de 0.45— y siguen
# en `.lam_cifras_banda`. Las medidas salen del estándar (`ppt.geometria.cifra_pieza`).

#' Dibuja cifras con la geometría de la pieza `cifra()`
#'
#' @param it Ítems de la especificación de cifras.
#' @param pieza `ppt.geometria.cifra_pieza` del estándar.
#' @return `list(iconos, alto)`, como `.lam_cifras_banda()`.
#' @keywords internal
.lam_cifras_pieza <- function(lz, it, x, y, w, size, calle, pieza) {
  n <- length(it); wc <- (w - calle * (n - 1)) / n
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); filete <- .std_color("filete")
  # Un rótulo de dos líneas empuja al detalle; el recetario los escribe de una.
  hr <- max(pieza$rotulo_h, max(vapply(it, function(i) min(.lam_alto_txt(i$rotulo, wc, 12, TRUE), 2 * 12 * 1.2 / 72 + 0.1), 0)))
  extra <- hr - pieza$rotulo_h
  alto <- pieza$alto + extra
  for (k in seq_len(n)) {
    xk <- x + (k - 1) * (wc + calle)
    if (k > 1) .lam_linea(lz, xk - calle / 2, y + pieza$separador_dy, xk - calle / 2, y + pieza$separador_dy + alto, filete, pt = 0.75,
                          nombre = "cifra:separador")
    .lam_txt(lz, it[[k]]$valor, xk, y, wc, pieza$valor_h, size, azul, bold = TRUE, nombre = "cifra:valor")
    .lam_txt(lz, it[[k]]$rotulo, xk, y + pieza$rotulo_dy, wc, hr, 12, azul, bold = TRUE, nombre = "cifra:rotulo")
    if (nzchar(it[[k]]$detalle)) .lam_txt(lz, it[[k]]$detalle, xk, y + pieza$detalle_dy + extra, wc, pieza$detalle_h, 10, suave,
                                         nombre = "cifra:detalle")
  }
  list(iconos = list(), alto = alto)
}
