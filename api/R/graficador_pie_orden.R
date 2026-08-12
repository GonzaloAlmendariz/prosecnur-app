# =============================================================================
# graficador_pie_orden.R — el orden de las porciones es una decisión
# =============================================================================
#
# `ordenar_categorias` ofrece modos automáticos —`desc`, `asc`— que ordenan por
# VALOR, así que el orden depende de los datos de cada pregunta. Medido en
# «Conta 11-08»: la lámina 9 salía «No, Sí» y la 10 «Sí, No», y las dos eran
# correctas según esa regla. Para el lector, la leyenda cambiaba de orden sin
# motivo entre láminas contiguas.
#
# El orden manual da la vuelta a eso: se declara por etiqueta y no depende del
# dato. Vive en un helper y no dentro del graficador para poder verificarlo sin
# renderizar — los asserts contra el objeto ggplot no ven este orden y pasan en
# verde sin medir nada.

#' Orden en que deben salir las porciones.
#'
#' @param categorias Etiquetas, en el orden en que llegan.
#' @param orden_manual Orden declarado por el analista. Manda sobre `modo`.
#' @param modo `"desc"`, `"asc"` o cualquier otro valor para no ordenar.
#' @param pct Valores, necesarios sólo para los modos automáticos.
#' @return Índices con el orden a aplicar.
#' @keywords internal
.pie_orden_categorias <- function(categorias, orden_manual = NULL,
                                  modo = "ninguno", pct = NULL) {
  n <- length(categorias)
  if (!n) return(integer(0))
  idx <- seq_len(n)

  om <- as.character(orden_manual %||% character(0))
  om <- om[!is.na(om) & nzchar(om)]
  # El modo manda. Que el orden declarado ganara con `modo = "asc"` dejaba al
  # analista con «Ascendente» marcado viendo un orden que no era ascendente:
  # dos controles compitiendo y uno de ellos silencioso.
  #
  # Compatibilidad: un proyecto guardado antes de que «Manual» fuera un modo
  # trae la declaración sin él. Ahí se respeta, porque borrarle el orden al
  # reabrir sería peor que la incoherencia que esto viene a evitar.
  if (length(om) && (identical(modo, "manual") || !modo %in% c("asc", "desc"))) {
    # Las categorías no listadas van al final, en su orden original: una
    # declaración incompleta no puede hacer desaparecer nada.
    return(order(match(as.character(categorias), om, nomatch = length(om) + 1L), idx))
  }

  v <- suppressWarnings(as.numeric(pct))
  if (length(v) != n || anyNA(v)) return(idx)
  if (identical(modo, "desc")) return(order(-v, idx))
  if (identical(modo, "asc"))  return(order(v, idx))
  idx
}
