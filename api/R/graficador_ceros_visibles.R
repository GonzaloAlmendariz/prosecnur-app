# =============================================================================
# graficador_ceros_visibles.R — una categoría en 0 % que se pueda ver
# =============================================================================
#
# Una categoría con cero casos ocupa cero ancho: su segmento no existe en la
# barra. El lector no distingue «esta opción no la eligió nadie» de «esta opción
# no estaba en la pregunta», que son cosas muy distintas al leer un instrumento.
#
# El apaño anterior era escribir «<1%» en los que redondeaban a cero, una
# notación que no existe en el entregable. Se retiró. Esto es lo que ocupa su
# lugar, y a diferencia de aquello es **opcional**: el analista decide si su
# lámina gana o pierde con ello.
#
# Con el interruptor encendido, cada categoría en cero recibe un piso de ancho
# —0,5 % por defecto— y el resto de la fila se recomprime en proporción, de modo
# que la barra **sigue sumando 100 %**. La cifra que se rotula NO se toca: sigue
# diciendo 0 %. Combina con mostrar la cuenta al lado, que es lo que explica al
# lector por qué ve un segmento donde el porcentaje dice cero.

#' Piso de ancho, en proporción, para una categoría sin casos.
#' @keywords internal
.BARRAS_PISO_CERO <- 0.005

#' Da ancho visible a los ceros sin romper la suma de la fila.
#'
#' @param valores Proporciones de UNA fila, ya normalizadas a suma 1.
#' @param mostrar Interruptor. Apagado devuelve los valores intactos.
#' @param piso Ancho que recibe cada cero, en proporción.
#' @return Vector del mismo largo. Con el interruptor encendido, los ceros valen
#'   `piso` y el resto se reescala para que la suma se conserve.
#' @keywords internal
.barras_inflar_ceros <- function(valores, mostrar = FALSE, piso = .BARRAS_PISO_CERO) {
  v <- suppressWarnings(as.numeric(valores))
  if (!isTRUE(mostrar)) return(v)
  piso <- suppressWarnings(as.numeric(piso)[1])
  if (!is.finite(piso) || piso <= 0) return(v)

  finitos <- is.finite(v)
  if (!any(finitos)) return(v)
  ceros <- finitos & v <= 0
  if (!any(ceros)) return(v)

  total <- sum(v[finitos], na.rm = TRUE)
  # Sin masa que repartir no hay nada que recomprimir: una fila entera de ceros
  # no puede sumar 100 % por mucho piso que se le dé.
  if (!is.finite(total) || total <= 0) return(v)

  reservado <- sum(ceros) * piso
  # Si los pisos se comen la fila, el remedio sería peor: se deja como estaba.
  if (reservado >= total) return(v)

  escala <- (total - reservado) / total
  out <- v
  out[finitos & !ceros] <- v[finitos & !ceros] * escala
  out[ceros] <- piso
  out
}
