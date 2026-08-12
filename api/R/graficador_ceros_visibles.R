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
# Con el interruptor encendido, cada categoría que se rotula 0 % recibe un piso
# de ancho —0,5 % por defecto— y el resto de la fila se recomprime en proporción,
# de modo que la barra **sigue sumando 100 %**. La cifra que se rotula NO se
# toca: sigue diciendo 0 %, y al lado va su frecuencia real, que es lo que
# explica al lector por qué ve un segmento donde el porcentaje dice cero.
#
# El criterio es «se rotula 0 %», no «vale cero», y la diferencia importa: un
# caso entre 209 es 0,48 %, se rotula 0 % y se dibuja como una astilla de medio
# milímetro. Para quien lee la lámina es indistinguible de la categoría vacía, y
# el recuento de la barra pierde ese caso sin dejar rastro en ninguna etiqueta.
# Quien decide qué se rotula 0 % es `.pulso_pct_unidades_exactas()`, la misma
# función que escribe la cifra.

#' Piso de ancho, en proporción, para una categoría que se rotula 0 %.
#' @keywords internal
.BARRAS_PISO_CERO <- 0.005

#' Qué proporciones se rotulan 0 % cuando la cifra se redondea sin repartir.
#'
#' Es el criterio de las familias que NO cierran a 100 % —una barra agrupada de
#' respuesta múltiple no tiene un resto que repartir—, donde la cifra sale del
#' redondeo directo con la regla de la casa. Vive aquí, y no repetido en cada
#' punto de uso, porque el piso de ancho y la etiqueta tienen que coincidir: un
#' segmento con piso y sin etiqueta es peor que el problema que se arregla.
#'
#' @param valores Proporciones en escala 0-1.
#' @param decimales Resolución de la cifra rotulada.
#' @return Lógico del mismo largo; `NA` cuenta como `FALSE`.
#' @keywords internal
.barras_cero_rotulado <- function(valores, decimales = 0) {
  v <- suppressWarnings(as.numeric(valores))
  out <- is.finite(v) & .pulso_round_half_up(v * 100, decimales) == 0
  out[is.na(out)] <- FALSE
  out
}

#' Da ancho visible a los ceros sin romper la suma de la fila.
#'
#' @param valores Proporciones de UNA fila, ya normalizadas a suma 1.
#' @param mostrar Interruptor. Apagado devuelve los valores intactos.
#' @param piso Ancho que recibe cada cero, en proporción.
#' @param cero_rotulado Vector lógico del mismo largo: qué entradas se rotulan
#'   0 %. Por omisión, las que valen cero exacto.
#' @return Vector del mismo largo. Con el interruptor encendido, las entradas
#'   marcadas valen al menos `piso` y el resto se reescala para que la suma se
#'   conserve.
#' @keywords internal
.barras_inflar_ceros <- function(valores, mostrar = FALSE, piso = .BARRAS_PISO_CERO,
                                 cero_rotulado = NULL) {
  v <- suppressWarnings(as.numeric(valores))
  if (!isTRUE(mostrar)) return(v)
  piso <- suppressWarnings(as.numeric(piso)[1])
  if (!is.finite(piso) || piso <= 0) return(v)

  finitos <- is.finite(v)
  if (!any(finitos)) return(v)

  ceros <- if (is.null(cero_rotulado)) v <= 0 else as.logical(cero_rotulado)
  ceros[is.na(ceros)] <- FALSE
  ceros <- finitos & ceros
  if (!any(ceros)) return(v)

  total <- sum(v[finitos], na.rm = TRUE)
  # Sin masa que repartir no hay nada que recomprimir: una fila entera de ceros
  # no puede sumar 100 % por mucho piso que se le dé.
  if (!is.finite(total) || total <= 0) return(v)

  # `pmax` y no asignación directa: una entrada que se rotula 0 % puede traer
  # más masa que el piso —0,48 % con el piso en 0,5 % no, pero 0,7 % con el piso
  # en 0,5 % sí, si el analista lo baja—, y darle el piso la encogería. El piso
  # es un mínimo, nunca un valor.
  nuevos <- pmax(v[ceros], piso)
  reservado <- sum(nuevos)
  resto <- sum(v[finitos & !ceros], na.rm = TRUE)
  # Si los pisos se comen la fila, el remedio sería peor: se deja como estaba.
  if (reservado >= total || resto <= 0) return(v)

  escala <- (total - reservado) / resto
  out <- v
  out[finitos & !ceros] <- v[finitos & !ceros] * escala
  out[ceros] <- nuevos
  out
}
