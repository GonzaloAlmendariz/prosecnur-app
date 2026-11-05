# lamina_tarjetas_columna_declarada.R — una columna de rótulos declarada no saca la lámina de tarjetas del camino nativo
#
# Checklist de mandos del mazo (2026-11-05), ítem del «Espacio para etiquetas»: en la lámina de un gráfico con el panel
# de tarjetas, `.lam_tarjetas_nativa_cabe` exigía que la columna de rótulos quedara bajo su tope (la mitad del ancho útil
# con el panel). Ese tope protege la columna NATURAL, que con rótulos largos se sale por la izquierda. Una columna
# DECLARADA (`canvas_w_etiquetas`) sólo se cumple si sus rótulos caben en ella (`.lam_barras_ancho_rotulos`; si no, avisa
# y vuelve al automático), así que no se sale. Al rechazarla, la lámina caía al respaldo ggplot: sin la pista gris hasta
# el 100 %, con el panel de tarjetas centrado en otra altura y sin el conector a su opción (CCSS, lámina ccss-059 con
# 0.55). Ahora la columna declarada y cumplida pasa, siempre que a las barras les quede su área mínima.

#' Área mínima de las barras (in) junto a una columna de rótulos declarada
#' @keywords internal
.LAM_TARJETAS_AREA_BARRAS_MIN <- 1.5

#' ¿La columna de rótulos de `geo` es la declarada por el gráfico y deja a las barras su área mínima?
#' @param espec Espec categórica con `tamanos$w_etiquetas` (fracción del ancho útil). @param geo `.lam_barras_geo(espec)`.
#' @param ancho Ancho útil (in), el mismo con que se calculó `geo`.
#' @keywords internal
.lam_tarjetas_columna_declarada_cabe <- function(espec, geo, ancho) {
  frac <- (espec$tamanos %||% list())$w_etiquetas
  if (is.null(frac)) return(FALSE)
  if (abs(geo$wlab - max(0.8, frac * ancho)) > 1e-6) return(FALSE)   # no se cumplió: va el automático, que ya se midió
  area <- ancho - geo$wlab - .LAM_BARRAS_ANCHO$sep_barra - .lam_barras_ancho_cifra(espec$cifras, geo$size)
  area >= .LAM_TARJETAS_AREA_BARRAS_MIN
}
