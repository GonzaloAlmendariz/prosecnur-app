#' Ancho real de una etiqueta de valor, como fraccion del eje
#'
#' La decision de poner la cifra dentro o fuera de la barra se toma comparando
#' el largo del texto con el largo de la barra. Ese largo se estimaba con una
#' constante por caracter calibrada para una lamina de un solo grafico; en un
#' cuarto de lamina el mismo texto ocupa proporcionalmente el triple, asi que
#' `16.9%` se declaraba «cabe dentro», se dibujaba centrado en media barra y
#' salia por ambos lados hasta pisar la etiqueta de la categoria —`Decimo
#' ciclo16.9%` en el mazo de Contabilidad, en cuatro filas de la misma lamina—.
#'
#' Aqui el ancho se deriva del espacio fisico real, igual que ya hace el wrap
#' del eje Y (H22): mismo patron, misma constante de anchura de caracter.
#'
#' Solo aplica cuando el motor paso el ancho fisico del cajon y el panel es
#' angosto. En lamina completa la estimacion vieja esta calibrada y no se toca.
#'
#' @name graficador_ancho_etiqueta
NULL


# Anchura media de un caracter como fraccion de su cuerpo. La misma que usa el
# wrap del eje Y, para que ambas decisiones midan con la misma vara.
.ANCHO_ETQ_CHAR_FRACCION <- 0.55

# Por encima de este ancho de cajon (pulgadas) el panel es de lamina completa.
.ANCHO_ETQ_PANEL_ANGOSTO_IN <- 9


#' @param label_chars Numero de caracteres de cada etiqueta.
#' @param size_texto_pt Cuerpo del texto de la etiqueta, en puntos ggplot.
#' @param ancho_cajon_in Ancho fisico del cajon destino, en pulgadas. `NA` o
#'   `<= 0` cuando el motor no lo paso.
#' @param w_etiquetas Fraccion del ancho que ocupa la columna de etiquetas.
#' @param base_max Maximo del eje, en las unidades de los valores.
#' @return Ancho de cada etiqueta en unidades del eje, o `NULL` cuando no hay
#'   informacion fisica suficiente: `NULL` significa «quedate con la estimacion
#'   de siempre», que es distinto de «mide cero».
#' @keywords internal
.ancho_etiqueta_por_fisica <- function(label_chars, size_texto_pt,
                                       ancho_cajon_in, w_etiquetas = 0.38,
                                       base_max = 1) {
  ancho <- suppressWarnings(as.numeric(ancho_cajon_in)[1])
  if (!is.finite(ancho) || ancho <= 0 || ancho >= .ANCHO_ETQ_PANEL_ANGOSTO_IN) {
    return(NULL)
  }
  cuerpo <- suppressWarnings(as.numeric(size_texto_pt)[1])
  if (!is.finite(cuerpo) || cuerpo <= 0) return(NULL)

  w <- suppressWarnings(as.numeric(w_etiquetas)[1])
  if (!is.finite(w) || w <= 0 || w >= 1) w <- 0.38
  bm <- suppressWarnings(as.numeric(base_max)[1])
  if (!is.finite(bm) || bm <= 0) bm <- 1

  # Lo que queda para las barras una vez descontada la columna de etiquetas.
  ancho_barras_in <- ancho * (1 - w)
  if (!is.finite(ancho_barras_in) || ancho_barras_in <= 0) return(NULL)

  # ggplot mide `size` en milimetros de altura; a puntos, x 72/25.4.
  char_in <- cuerpo * (72 / 25.4) * .ANCHO_ETQ_CHAR_FRACCION / 72
  chars <- suppressWarnings(as.numeric(label_chars))
  chars[!is.finite(chars)] <- 0

  pmin(bm, chars * char_in / ancho_barras_in * bm)
}
