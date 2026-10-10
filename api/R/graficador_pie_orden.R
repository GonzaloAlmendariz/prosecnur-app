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
                                  modo = "ninguno", pct = NULL, residuales_al_final = FALSE) {
  n <- length(categorias)
  if (!n) return(integer(0))
  idx <- seq_len(n)

  om <- .orden_manual_etiquetas(orden_manual)
  # El modo manda, y la decisión de *si* manda el orden declarado vive en
  # `.orden_manual_manda()` porque las barras agrupadas hacen lo mismo con otro
  # arg. Con una copia por graficador, arreglar uno dejaba al otro roto.
  if (.orden_manual_manda(om, modo, c("asc", "desc"))) {
    # Las categorías no listadas van al final, en su orden original: una
    # declaración incompleta no puede hacer desaparecer nada.
    return(order(match(as.character(categorias), om, nomatch = length(om) + 1L), idx))
  }

  v <- suppressWarnings(as.numeric(pct))
  if (length(v) != n || anyNA(v)) return(idx)
  o <- if (identical(modo, "desc")) order(-v, idx) else if (identical(modo, "asc")) order(v, idx) else return(idx)
  # D8: por frecuencia los residuales («Otros», «No sabe»…) van al final, como en las categóricas y en p152. Sólo si se
  # pide: el «desc» heredado de un .pulso no cambia de orden por esto.
  if (isTRUE(residuales_al_final)) {
    res <- grepl(.CATEGORIAS_RESIDUALES, as.character(categorias)[o], ignore.case = TRUE)
    if (any(res) && !all(res)) o <- c(o[!res], o[res])
  }
  o
}
